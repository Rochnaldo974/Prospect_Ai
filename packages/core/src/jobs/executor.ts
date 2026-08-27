import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { completeJob, failJob, killJob, type QueuedJob } from './queue';
import { getHandler } from './registry';
import { failRun, finishRun, startRun } from './runs';
import { PermanentJobError, type JobHandler, type JobResult } from './types';

export interface ExecuteOptions {
  db: Db;
  logger: Logger;
  workerId: string;
  signal: AbortSignal;
  /**
   * Résolution du handler. Injectable pour que les tests puissent exercer les
   * chemins d'échec sans avoir à casser un handler réel du registre.
   */
  resolveHandler?: (type: string) => JobHandler<never> | undefined;
}

export type ExecutionOutcome =
  | { status: 'succeeded'; result: JobResult }
  | { status: 'retrying'; error: string }
  | { status: 'abandoned'; error: string };

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Exécute un job réclamé, du début à sa conclusion en base.
 *
 * Trois issues, jamais une exception qui remonte : la boucle du worker ne doit
 * pas pouvoir être arrêtée par un handler défaillant.
 *
 *   succeeded  — le job est marqué terminé
 *   retrying   — replanifié avec backoff exponentiel
 *   abandoned  — abandonné sans réessai (erreur qu'une tentative ne corrigera pas)
 */
export async function executeJob(
  job: QueuedJob,
  { db, logger, workerId, signal, resolveHandler = getHandler }: ExecuteOptions,
): Promise<ExecutionOutcome> {
  const log = logger.child({ job_id: job.id, job_type: job.job_type, attempt: job.attempts });

  const handler = resolveHandler(job.job_type);
  if (!handler) {
    // Réessayer ne fera pas apparaître le handler.
    const message = `Aucun handler enregistré pour « ${job.job_type} »`;
    log.error(message);
    await killJob(db, job.id, message);
    return { status: 'abandoned', error: message };
  }

  const parsed = handler.schema.safeParse(job.payload ?? {});
  if (!parsed.success) {
    const message = `Payload invalide : ${parsed.error.issues
      .map((i) => `${i.path.join('.') || '(racine)'} ${i.message}`)
      .join(' ; ')}`;
    log.error(message, { payload: job.payload });
    await killJob(db, job.id, message);
    return { status: 'abandoned', error: message };
  }

  const runId = await startRun(db, job.job_type, job.id, workerId);
  const startedAt = Date.now();

  try {
    const result = await handler.run(parsed.data as never, {
      db,
      logger: log,
      signal,
      jobId: job.id,
      attempt: job.attempts,
    });

    await finishRun(db, runId, result);
    await completeJob(db, job.id);

    log.debug('Job terminé', { duration_ms: Date.now() - startedAt, ...result });
    return { status: 'succeeded', result };
  } catch (error: unknown) {
    const message = describe(error);
    await failRun(db, runId, message);

    if (error instanceof PermanentJobError) {
      log.error('Job abandonné définitivement', { error: message });
      await killJob(db, job.id, message);
      return { status: 'abandoned', error: message };
    }

    const willRetry = job.attempts < job.max_attempts;
    log[willRetry ? 'warn' : 'error'](
      willRetry ? 'Job en échec, replanifié' : 'Job en échec, tentatives épuisées',
      { error: message, attempt: job.attempts, max_attempts: job.max_attempts },
    );

    await failJob(db, job.id, message);
    return { status: willRetry ? 'retrying' : 'abandoned', error: message };
  }
}
