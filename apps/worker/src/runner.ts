import { getServerEnv, getServiceClient, logger } from '@prospect/core';
import { installShutdownHandlers, sleep } from './shutdown';

/**
 * Boucle principale du worker.
 *
 * Phase 0 : le worker démarre, valide sa configuration, vérifie l'accès à la
 * base et tourne à vide. La réclamation de jobs (`job_queue` +
 * `FOR UPDATE SKIP LOCKED`) arrive en phase 3.
 */
async function main(): Promise<void> {
  const env = getServerEnv();
  const shutdown = installShutdownHandlers();

  const log = logger.child({ component: 'worker', worker_id: env.WORKER_ID });
  log.info('Démarrage du worker', {
    concurrency: env.WORKER_CONCURRENCY,
    poll_interval_ms: env.WORKER_POLL_INTERVAL_MS,
  });

  const db = getServiceClient();

  // Vérification d'accès à la base : mieux vaut échouer au démarrage
  // qu'à la première réclamation de job.
  const { error } = await db.from('profiles').select('id', { count: 'exact', head: true });
  if (error) {
    log.error('Base inaccessible au démarrage', { error: error.message });
    process.exitCode = 1;
    return;
  }
  log.info('Connexion à la base établie');

  let tick = 0;
  while (!shutdown.isShuttingDown) {
    tick += 1;
    log.debug('Tick — aucune file de jobs avant la phase 3', { tick });
    await sleep(env.WORKER_POLL_INTERVAL_MS, shutdown.signal);
  }

  log.info('Worker arrêté proprement', { ticks: tick });
}

main().catch((error: unknown) => {
  logger.error('Le worker s’est arrêté sur une erreur fatale', { error });
  process.exit(1);
});
