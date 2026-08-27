import type { Db } from '../db/client';
import type { Json } from '../db/database.types';

export interface QueuedJob {
  id: number;
  job_type: string;
  payload: Json;
  attempts: number;
  max_attempts: number;
}

export interface EnqueueOptions {
  priority?: number;
  runAfter?: Date;
  /** Rend la planification idempotente : une clé déjà en file n'est pas dupliquée. */
  dedupeKey?: string;
  maxAttempts?: number;
}

/**
 * Planifie un job.
 * Renvoie null si un job portant la même dedupeKey est déjà en file.
 */
export async function enqueueJob(
  db: Db,
  type: string,
  payload: Record<string, Json> = {},
  options: EnqueueOptions = {},
): Promise<number | null> {
  // Les clés optionnelles sont omises plutôt que passées à undefined :
  // exactOptionalPropertyTypes distingue les deux, et PostgREST aussi.
  const { data, error } = await db.rpc('enqueue_job', {
    p_job_type: type,
    p_payload: payload,
    p_priority: options.priority ?? 50,
    p_run_after: (options.runAfter ?? new Date()).toISOString(),
    p_max_attempts: options.maxAttempts ?? 3,
    ...(options.dedupeKey ? { p_dedupe_key: options.dedupeKey } : {}),
  });

  if (error) throw new Error(`enqueueJob(${type}) : ${error.message}`);
  return typeof data === 'number' ? data : null;
}

/** Réclame un lot de jobs, rendus par priorité décroissante. */
export async function claimJobs(
  db: Db,
  worker: string,
  batchSize: number,
  types?: string[],
): Promise<QueuedJob[]> {
  const { data, error } = await db.rpc('claim_jobs', {
    worker,
    batch_size: batchSize,
    ...(types && types.length > 0 ? { types } : {}),
  });

  if (error) throw new Error(`claimJobs : ${error.message}`);
  return (data ?? []) as unknown as QueuedJob[];
}

export async function completeJob(db: Db, jobId: number): Promise<void> {
  const { error } = await db.rpc('complete_job', { job_id: jobId });
  if (error) throw new Error(`completeJob(${jobId}) : ${error.message}`);
}

/** Replanifie avec backoff exponentiel, ou abandonne si les tentatives sont épuisées. */
export async function failJob(db: Db, jobId: number, message: string): Promise<void> {
  const { error } = await db.rpc('fail_job', { job_id: jobId, error_message: message });
  if (error) throw new Error(`failJob(${jobId}) : ${error.message}`);
}

/** Abandonne sans réessai. */
export async function killJob(db: Db, jobId: number, message: string): Promise<void> {
  const { error } = await db.rpc('kill_job', { job_id: jobId, error_message: message });
  if (error) throw new Error(`killJob(${jobId}) : ${error.message}`);
}

/**
 * Remet en file les jobs verrouillés par un worker qui ne répond plus.
 * C'est ce qui rend le pipeline reprenable après un crash ou un déploiement.
 */
export async function reclaimStalledJobs(
  db: Db,
  stalledAfterMinutes = 15,
): Promise<number> {
  const { data, error } = await db.rpc('reclaim_stalled_jobs', {
    stalled_after: `${stalledAfterMinutes} minutes`,
  });
  if (error) throw new Error(`reclaimStalledJobs : ${error.message}`);
  return data ?? 0;
}
