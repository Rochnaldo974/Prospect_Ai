import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import { enqueueJob } from './queue';

/**
 * Une passe complète, découpée en tranches.
 *
 * Plusieurs moteurs travaillent par pages, avec un plafond par job : le
 * moteur d'opportunités ne regarde que vingt mille entreprises à la fois.
 * Programmer UN job par nuit, c'est ne regarder que les vingt mille
 * premières — les mêmes chaque nuit — pendant que le reste de la base
 * attend sans que rien ne le dise. C'est exactement ce qui plafonnait le
 * stock : deux cent trente-six mille entreprises signalées, vingt mille
 * examinées.
 *
 * Le job « toute la base » compte, découpe, et enfile une tranche par job,
 * chacune idempotente pour la nuit. Les tranches tournent en parallèle sur
 * les workers ; une tranche interrompue est reprise par la file.
 */

export interface Slice {
  offset: number;
  limit: number;
}

/** Les tranches qui couvrent `total` éléments, `chunk` par tranche. Pur. */
export function planSlices(total: number, chunk: number): Slice[] {
  if (!Number.isFinite(total) || total <= 0 || chunk <= 0) return [];
  const slices: Slice[] = [];
  for (let offset = 0; offset < total; offset += chunk) {
    slices.push({ offset, limit: Math.min(chunk, total - offset) });
  }
  return slices;
}

export interface FanOutOptions {
  type: string;
  total: number;
  chunk: number;
  priority: number;
  /** Le reste de la charge utile, copié dans chaque tranche. */
  payload?: Record<string, Json>;
  /** Préfixe de la clé d'idempotence ; la date du jour et l'index complètent. */
  prefix: string;
}

/** Enfile une tranche par job ; renvoie le nombre de jobs réellement créés. */
export async function fanOut(db: Db, options: FanOutOptions): Promise<{ slices: number; enqueued: number }> {
  const slices = planSlices(options.total, options.chunk);
  const today = new Date().toISOString().slice(0, 10);
  let enqueued = 0;
  for (const [index, slice] of slices.entries()) {
    const id = await enqueueJob(db, options.type, { ...(options.payload ?? {}), offset: slice.offset, limit: slice.limit }, {
      priority: options.priority,
      dedupeKey: `${options.prefix}:${today}:${index}`,
    });
    if (id !== null) enqueued += 1;
  }
  return { slices: slices.length, enqueued };
}
