import {
  claimJobs,
  executeJob,
  getServerEnv,
  getServiceClient,
  heartbeatJobs,
  logger,
  registeredJobTypes,
  reclaimStalledJobs,
  type Db,
  type Logger,
} from '@prospect/core';
import { installShutdownHandlers, sleep, type ShutdownController } from './shutdown';
import { TaskPool } from './pool';
import { claimPlan } from './caps';

/** Périodicité du balayage des jobs abandonnés par un worker mort. */
const RECLAIM_INTERVAL_MS = 5 * 60_000;
/**
 * Périodicité du signe de vie : un job en cours voit son verrou rafraîchi,
 * pour que le balayage ne le prenne pas pour abandonné. Sans cela, tout job
 * de plus de quinze minutes — un scan de deux mille domaines, une passe
 * d'identité — était repris et exécuté une seconde fois en parallèle.
 */
const HEARTBEAT_INTERVAL_MS = 60_000;

interface LoopStats {
  [key: string]: number;
  claimed: number;
  succeeded: number;
  retried: number;
  abandoned: number;
}

async function runLoop(
  db: Db,
  log: Logger,
  workerId: string,
  pollIntervalMs: number,
  pool: TaskPool,
  shutdown: ShutdownController,
): Promise<LoopStats> {
  const stats: LoopStats = { claimed: 0, succeeded: 0, retried: 0, abandoned: 0 };
  let lastReclaim = 0;
  let lastHeartbeat = Date.now();
  let idleSince: number | null = null;
  const allTypes = registeredJobTypes();
  const inFlightByType = new Map<string, number>();
  const inFlightIds = new Set<number>();

  while (!shutdown.isShuttingDown) {
    if (pool.inFlight > 0 && Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = Date.now();
      try {
        await heartbeatJobs(db, workerId, [...inFlightIds]);
      } catch (error: unknown) {
        log.warn('Signe de vie non enregistré', { error });
      }
    }

    // Balayage périodique : un worker tué net laisse ses jobs verrouillés.
    if (Date.now() - lastReclaim > RECLAIM_INTERVAL_MS) {
      lastReclaim = Date.now();
      try {
        const reclaimed = await reclaimStalledJobs(db);
        if (reclaimed > 0) log.warn('Jobs repris après interruption', { reclaimed });
      } catch (error: unknown) {
        log.error('Échec du balayage des jobs bloqués', { error });
      }
    }

    // Ne réclamer que ce qu'on peut traiter : un job réclamé mais en attente
    // d'une place est un job verrouillé pour rien.
    const capacity = pool.available;
    if (capacity <= 0) {
      await Promise.race([sleep(50, shutdown.signal)]);
      continue;
    }

    // Les types à une seule place (découverte OSM…) sont réclamés un par
    // un, puis le reste de la capacité va aux autres : les jobs plafonnés
    // n'attendent plus dans le pool, les autres passent devant.
    const plan = claimPlan(allTypes, inFlightByType);

    let batch;
    try {
      batch = [];
      let remaining = capacity;
      for (const type of plan.capped) {
        if (remaining <= 0) break;
        const claimed = await claimJobs(db, workerId, 1, [type]);
        batch.push(...claimed);
        remaining -= claimed.length;
      }
      if (remaining > 0 && plan.uncapped.length > 0) {
        batch.push(...await claimJobs(db, workerId, remaining, plan.uncapped));
      }
    } catch (error: unknown) {
      log.error('Échec de réclamation, nouvelle tentative après attente', { error });
      await sleep(pollIntervalMs, shutdown.signal);
      continue;
    }

    if (batch.length === 0) {
      if (idleSince === null) {
        idleSince = Date.now();
        log.debug('File vide, passage en attente');
      }
      await sleep(pollIntervalMs, shutdown.signal);
      continue;
    }

    if (idleSince !== null) {
      log.debug('Reprise après attente', { idle_ms: Date.now() - idleSince });
      idleSince = null;
    }

    stats.claimed += batch.length;

    for (const job of batch) {
      inFlightByType.set(job.job_type, (inFlightByType.get(job.job_type) ?? 0) + 1);
      inFlightIds.add(job.id);
      await pool.spawn(async () => {
        try {
          const outcome = await executeJob(job, {
            db,
            logger: log,
            workerId,
            signal: shutdown.signal,
          });
          if (outcome.status === 'succeeded') stats.succeeded += 1;
          else if (outcome.status === 'retrying') stats.retried += 1;
          else stats.abandoned += 1;
        } finally {
          inFlightIds.delete(job.id);
          inFlightByType.set(job.job_type, Math.max(0, (inFlightByType.get(job.job_type) ?? 1) - 1));
        }
      });
    }
  }

  return stats;
}

async function main(): Promise<void> {
  const env = getServerEnv();
  const shutdown = installShutdownHandlers();

  const log = logger.child({ component: 'worker', worker_id: env.WORKER_ID });
  log.info('Démarrage du worker', {
    concurrency: env.WORKER_CONCURRENCY,
    poll_interval_ms: env.WORKER_POLL_INTERVAL_MS,
    handlers: registeredJobTypes(),
  });

  const db = getServiceClient();

  // Mieux vaut échouer au démarrage qu'à la première réclamation de job.
  const { error } = await db.from('job_queue').select('id', { count: 'exact', head: true });
  if (error) {
    log.error('Base inaccessible au démarrage', { error: error.message });
    process.exitCode = 1;
    return;
  }
  log.info('Connexion à la base établie');

  const pool = new TaskPool(env.WORKER_CONCURRENCY);
  const stats = await runLoop(
    db,
    log,
    env.WORKER_ID,
    env.WORKER_POLL_INTERVAL_MS,
    pool,
    shutdown,
  );

  // Arrêt propre : on cesse de réclamer, mais on laisse finir ce qui est en
  // cours. Un job interrompu serait repris par le balayage, donc exécuté deux
  // fois — les handlers sont idempotents, mais autant l'éviter.
  if (pool.inFlight > 0) {
    log.info('Attente des jobs en cours', { in_flight: pool.inFlight });
    await pool.drain();
  }

  log.info('Worker arrêté proprement', stats);
}

main().catch((error: unknown) => {
  logger.error('Le worker s’est arrêté sur une erreur fatale', { error });
  process.exit(1);
});
