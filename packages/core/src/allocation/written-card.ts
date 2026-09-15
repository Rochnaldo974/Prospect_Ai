import { z } from 'zod';
import type { Db } from '../db/client';

/**
 * La fiche rédigée, telle qu'elle est figée à côté de l'attribution.
 *
 * Séparée de la rédaction elle-même pour que la lecture du jour puisse la
 * relire sans embarquer le client de l'API : le tableau de bord lit, il
 * n'écrit jamais.
 */
export const WrittenCardSchema = z.object({
  /** Le défaut ou l'occasion, dit comme au commerçant. 90 caractères au plus. */
  headline: z.string().min(10).max(120),
  /** Le constat, deux ou trois phrases, uniquement à partir des faits fournis. */
  why: z.string().min(40).max(700),
  /** Ce qui date le contact. Vide si aucun fait daté n'a été fourni. */
  whyNow: z.string().max(400),
  /** La proposition concrète à faire, une ou deux phrases. */
  angle: z.string().min(20).max(500),
  /** La première phrase à prononcer au téléphone, vouvoiement, sans formule creuse. */
  opener: z.string().min(20).max(260),
});

export type WrittenCard = z.infer<typeof WrittenCardSchema>;

/** Relit les fiches rédigées d'un lot, par attribution. */
export async function loadWrittenCards(
  db: Db,
  assignmentIds: string[],
): Promise<Map<string, WrittenCard>> {
  const cards = new Map<string, WrittenCard>();
  if (assignmentIds.length === 0) return cards;
  const { data } = await db
    .from('assignment_cards')
    .select('assignment_id, card')
    .in('assignment_id', assignmentIds);
  for (const row of data ?? []) {
    const written = (row.card as { written?: unknown } | null)?.written;
    const parsed = WrittenCardSchema.safeParse(written);
    if (parsed.success) cards.set(row.assignment_id, parsed.data);
  }
  return cards;
}
