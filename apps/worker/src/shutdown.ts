import { logger } from '@prospect/core';

export interface ShutdownController {
  /** Résolu dès qu'un arrêt est demandé. */
  readonly signal: AbortSignal;
  readonly isShuttingDown: boolean;
}

/**
 * Arrêt propre : on cesse de réclamer de nouveaux jobs et on laisse ceux en
 * cours se terminer. Un second signal force la sortie.
 */
export function installShutdownHandlers(): ShutdownController {
  const controller = new AbortController();
  let shuttingDown = false;

  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      logger.warn('Second signal reçu, arrêt immédiat', { signal });
      process.exit(1);
    }
    shuttingDown = true;
    logger.info('Arrêt demandé, plus aucun job ne sera réclamé', { signal });
    controller.abort();
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  process.on('unhandledRejection', (reason) => {
    logger.error('Rejet de promesse non géré', { reason });
  });

  return {
    signal: controller.signal,
    get isShuttingDown() {
      return shuttingDown;
    },
  };
}

/** Attente interruptible par l'arrêt. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}
