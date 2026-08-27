import type { z } from 'zod';
import type { Db } from '../db/client';
import type { Logger } from '../logger';
import type { Json } from '../db/database.types';

/** Ce qu'un handler reçoit pour travailler. */
export interface JobContext {
  db: Db;
  logger: Logger;
  /** Passe à `aborted` quand le worker s'arrête : les handlers longs doivent le consulter. */
  signal: AbortSignal;
  jobId: number;
  attempt: number;
}

/** Ce qu'un handler rapporte, journalisé dans job_runs. */
export interface JobResult {
  processed: number;
  succeeded: number;
  failed: number;
  metadata?: Record<string, Json>;
}

export interface JobHandler<TPayload = unknown> {
  type: string;
  /**
   * Valide le payload. Un payload invalide ne devient jamais un réessai :
   * il ne sera pas plus valide à la troisième tentative.
   */
  schema: z.ZodType<TPayload>;
  /** Priorité par défaut à la planification. */
  defaultPriority?: number;
  /** Tentatives avant abandon. */
  maxAttempts?: number;
  run(payload: TPayload, context: JobContext): Promise<JobResult>;
}

/** Erreur qui ne doit pas être réessayée. */
export class PermanentJobError extends Error {
  override readonly name = 'PermanentJobError';
  constructor(message: string) {
    super(message);
  }
}

export const emptyResult = (): JobResult => ({ processed: 0, succeeded: 0, failed: 0 });
