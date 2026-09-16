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
  /**
   * La part de l'e-mail que seule la rédaction peut écrire : comment on est
   * tombé sur ce commerce dans son métier, ce qu'un client voit, ce qu'on
   * propose — avec des mots de tous les jours. La présentation du freelance
   * et la signature sont ajoutées à part.
   */
  email: z.object({
    subject: z.string().min(8).max(80),
    hook: z.string().min(60).max(600),
    proposal: z.string().min(30).max(400),
  }).optional(),
});

/**
 * Les mots qu'un commerçant ne comprend pas. Un e-mail qui en contient un
 * est un e-mail qu'on ne lit pas jusqu'au bout ; la part e-mail d'une fiche
 * qui en contient est écartée, la fiche reste.
 */
const JARGON = /\b(https?|ssl|tls|certificat|responsive|seo|cms|audit|refonte|stack|framework|h[ée]bergement|cache|balise|r[ée]f[ée]rencement|ttfb|html|css|javascript|wordpress|plugin|backend|frontend|serveur|navigateur|http)\b/i;

export function emailHasJargon(email: NonNullable<WrittenCard['email']>): boolean {
  return JARGON.test(`${email.subject} ${email.hook} ${email.proposal}`);
}

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
