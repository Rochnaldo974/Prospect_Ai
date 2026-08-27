import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { JobResult } from './types';

/**
 * Trace d'exécution, indépendante de la file.
 *
 * job_queue est éphémère : les jobs terminés finissent purgés. job_runs garde
 * l'historique — sans lui, impossible de savoir après coup pourquoi une nuit
 * de pipeline a produit moins d'opportunités que la précédente.
 */
export async function startRun(
  db: Db,
  jobType: string,
  jobId: number,
  workerId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('job_runs')
    .insert({ job_type: jobType, job_id: jobId, worker_id: workerId, status: 'running' })
    .select('id')
    .single();

  // Une trace manquante ne doit jamais empêcher le job de tourner.
  if (error) return null;
  return data.id;
}

export async function finishRun(
  db: Db,
  runId: string | null,
  result: JobResult,
): Promise<void> {
  if (!runId) return;
  await db
    .from('job_runs')
    .update({
      status: 'succeeded',
      completed_at: new Date().toISOString(),
      processed_count: result.processed,
      success_count: result.succeeded,
      failed_count: result.failed,
      metadata: (result.metadata ?? {}) as Json,
    })
    .eq('id', runId);
}

export async function failRun(db: Db, runId: string | null, message: string): Promise<void> {
  if (!runId) return;
  await db
    .from('job_runs')
    .update({ status: 'failed', completed_at: new Date().toISOString(), error: message })
    .eq('id', runId);
}
