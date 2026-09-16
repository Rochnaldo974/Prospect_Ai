import { z } from 'zod';
import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { TodayOpportunity } from './today';

/**
 * L'audit d'une page, à envoyer au prospect.
 *
 * Ce que le freelance a de plus convaincant, réuni sous un lien : la
 * capture du site, la note et ses quatre barres, les trois constats les
 * plus graves formulés pour être lus par le commerçant, la proposition, et
 * sa propre signature. Le prospect l'ouvre sans compte ; on compte les
 * ouvertures, parce qu'un audit ouvert deux fois vaut un rappel.
 *
 * Le contenu est figé à la création. Le site sera rescanné, la note
 * bougera : ce que le prospect a lu ne doit pas changer sous ses yeux.
 */

export const AuditSnapshotSchema = z.object({
  company: z.object({
    name: z.string(),
    city: z.string().nullable(),
    industry: z.string().nullable(),
    websiteUrl: z.string().nullable(),
  }),
  screenshotUrl: z.string().nullable(),
  headline: z.string(),
  score: z.number().nullable(),
  scores: z.object({ speed: z.number(), mobile: z.number(), seo: z.number(), trust: z.number() }).nullable(),
  /** Les constats, formulés pour le prospect. Au plus cinq. */
  findings: z.array(z.string()),
  proposal: z.string(),
  /** Le freelance : ce qu'il a choisi de montrer dans sa signature. */
  author: z.object({
    name: z.string(),
    title: z.string(),
    company: z.string(),
    phone: z.string(),
    website: z.string(),
    email: z.string(),
    logoUrl: z.string().nullable(),
  }),
  measuredAt: z.string().nullable(),
  /** Ce que ses clients en disent : la note Google, quand elle a été relevée. */
  google: z.object({ rating: z.number(), reviewCount: z.number() }).nullable().optional(),
});

export type AuditSnapshot = z.infer<typeof AuditSnapshotSchema>;

export interface AuditAuthor {
  name: string;
  title: string;
  company: string;
  phone: string;
  website: string;
  email: string;
  logoUrl: string | null;
}

export interface AuditShare {
  id: string;
  assignmentId: string;
  snapshot: AuditSnapshot;
  createdAt: string;
  openedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
}

/** Ce que le prospect lira : assemblé depuis le dossier, sans rien d'autre. */
export function buildAuditSnapshot(opportunity: TodayOpportunity, author: AuditAuthor): AuditSnapshot {
  const { company, explanation, audit } = opportunity;
  const findings = mergeFindings(audit?.findings ?? [], explanation.signals);

  return AuditSnapshotSchema.parse({
    company: {
      name: company.name,
      city: company.city,
      industry: company.industry,
      websiteUrl: company.websiteUrl,
    },
    screenshotUrl: company.screenshotUrl,
    headline: explanation.headline ?? explanation.signals[0] ?? 'Ce que votre site montre à vos clients',
    score: audit?.score ?? null,
    scores: audit?.scores ?? null,
    findings,
    proposal: explanation.angle,
    author: {
      ...author,
      website: author.website && !/^https?:\/\//i.test(author.website) ? `https://${author.website}` : author.website,
    },
    measuredAt: audit?.measuredAt ?? null,
    google: company.google?.rating != null && company.google.reviewCount != null
      ? { rating: company.google.rating, reviewCount: company.google.reviewCount }
      : null,
  });
}

/** Mots qui désignent un même sujet : deux lignes qui en partagent un disent la même chose. */
const THEMES: RegExp[] = [
  /https|certificat|sécuri/i,
  /téléphone|mobile/i,
  /titre|description|référencement|seo|h1/i,
  /charg|lent|répond|vitesse|\d+,\d+ s/i,
  /contact|formulaire/i,
  /copyright|©|figé|mise à jour/i,
  /panne|ne répond pas|erreur http/i,
];

/**
 * Les constats mesurés d'abord — chiffrés, vérifiables — puis ceux du
 * relevé, seulement s'ils parlent d'autre chose. Deux lignes sur le même
 * certificat n'en font pas deux constats, et jamais plus de cinq : un audit
 * qui liste tout n'est plus un audit, c'est un procès.
 */
export function mergeFindings(measured: string[], observed: string[]): string[] {
  const kept: string[] = [];
  const themes = new Set<number>();
  // Une ligne peut toucher plusieurs sujets — « ni téléphone, ni formulaire »
  // parle du mobile ET du contact ; elle bloque tous ceux qu'elle cite.
  const themesOf = (line: string) => THEMES.flatMap((re, i) => (re.test(line) ? [i] : []));
  for (const line of [...measured, ...observed]) {
    if (kept.length >= 5 || kept.includes(line)) continue;
    const mine = themesOf(line);
    if (mine.some((t) => themes.has(t))) continue;
    for (const t of mine) themes.add(t);
    kept.push(line);
  }
  return kept;
}

function rowToShare(row: {
  id: string; assignment_id: string; snapshot: unknown; created_at: string;
  opened_at: string | null; last_opened_at: string | null; open_count: number;
}): AuditShare | null {
  const parsed = AuditSnapshotSchema.safeParse(row.snapshot);
  if (!parsed.success) return null;
  return {
    id: row.id, assignmentId: row.assignment_id, snapshot: parsed.data, createdAt: row.created_at,
    openedAt: row.opened_at, lastOpenedAt: row.last_opened_at, openCount: row.open_count,
  };
}

/** Crée le partage d'un dossier, ou renvoie celui qui existe : un seul lien par dossier. */
export async function ensureAuditShare(
  db: Db,
  input: { assignmentId: string; userId: string; opportunity: TodayOpportunity; author: AuditAuthor },
): Promise<AuditShare> {
  const existing = await getAuditShareForAssignment(db, input.assignmentId, input.userId);
  if (existing) return existing;

  const snapshot = buildAuditSnapshot(input.opportunity, input.author);
  const { data, error } = await db
    .from('audit_shares')
    .insert({ assignment_id: input.assignmentId, user_id: input.userId, snapshot: snapshot as unknown as Json })
    .select('id, assignment_id, snapshot, created_at, opened_at, last_opened_at, open_count')
    .single();
  if (error) throw new Error(`ensureAuditShare : ${error.message}`);
  const share = rowToShare(data);
  if (!share) throw new Error('ensureAuditShare : instantané illisible');
  return share;
}

export async function getAuditShareForAssignment(
  db: Db,
  assignmentId: string,
  userId: string,
): Promise<AuditShare | null> {
  const { data } = await db
    .from('audit_shares')
    .select('id, assignment_id, snapshot, created_at, opened_at, last_opened_at, open_count')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ? rowToShare(data) : null;
}

/** La page publique : par identifiant, sans session. Null si le lien n'existe pas. */
export async function loadAuditShare(db: Db, id: string): Promise<AuditShare | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db
    .from('audit_shares')
    .select('id, assignment_id, snapshot, created_at, opened_at, last_opened_at, open_count')
    .eq('id', id)
    .maybeSingle();
  return data ? rowToShare(data) : null;
}

/** Une ouverture de plus. La première est datée à part : c'est elle qui compte pour la relance. */
export async function recordAuditOpen(db: Db, id: string): Promise<void> {
  const { data } = await db
    .from('audit_shares')
    .select('opened_at, open_count')
    .eq('id', id)
    .maybeSingle();
  if (!data) return;
  const now = new Date().toISOString();
  await db
    .from('audit_shares')
    .update({
      opened_at: data.opened_at ?? now,
      last_opened_at: now,
      open_count: data.open_count + 1,
    })
    .eq('id', id);
}
