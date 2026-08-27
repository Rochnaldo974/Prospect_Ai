import {
  claimJobs,
  executeJob,
  getServerEnv,
  getServiceClient,
  logger,
  registeredJobTypes,
  reclaimStalledJobs,
  type Db,
  type Logger,
} from '@prospect/core';
import { installShutdownHandlers, sleep, type ShutdownController } from './shutdown';
import { TaskPool } from './pool';

/** Périodicité du balayage des jobs abandonnés par un worker mort. */
const RECLAIM_INTERVAL_MS = 5 * 60_000;

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
  let idleSince: number | null = null;

  while (!shutdown.isShuttingDown) {
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

    let batch;
    try {
      batch = await claimJobs(db, workerId, capacity);
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
      await pool.spawn(async () => {
        const outcome = await executeJob(job, {
          db,
          logger: log,
          workerId,
          signal: shutdown.signal,
        });
        if (outcome.status === 'succeeded') stats.succeeded += 1;
        else if (outcome.status === 'retrying') stats.retried += 1;
        else stats.abandoned += 1;
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
