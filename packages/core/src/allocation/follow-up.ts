import type { Db } from '../db/client';
import type { OpportunityType } from '../domain/types';

/**
 * Ce qu'il reste à faire après l'appel.
 *
 * Le tableau de bord livrait cinq entreprises par jour et les oubliait dès
 * l'issue déclarée. Un freelance qui décroche un « rappelez-moi en octobre »
 * n'a alors aucun endroit où le retrouver : au bout d'une semaine, l'outil
 * lui fait perdre plus d'affaires qu'il ne lui en apporte.
 *
 * Trois issues seulement rouvrent un dossier — intéressé, rendez-vous, devis.
 * « Pas de réponse » et « pas intéressé » sont des fins de parcours ; les
 * afficher encaisserait la même déception tous les matins.
 */

/** Les issues qui appellent une suite. Dans l'ordre du tunnel. */
export const OPEN_OUTCOMES = ['interested', 'meeting', 'proposal'] as const;
export type OpenOutcome = (typeof OPEN_OUTCOMES)[number];

export interface FollowUp {
  assignmentId: string;
  outcome: OpenOutcome;
  /** La note laissée à la déclaration — la mémoire du freelance. */
  notes: string | null;
  /** Date de la dernière déclaration, pour trier du plus ancien au plus récent. */
  outcomeAt: string;
  daysSince: number;
  type: OpportunityType;
  company: {
    name: string;
    city: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
}

export async function getFollowUps(db: Db, userId: string): Promise<FollowUp[]> {
  const { data, error } = await db
    .from('assignments')
    .select('id, outcome, outcome_at, notes, opportunities!inner(opportunity_type), companies!inner(legal_name, commercial_name, city, phone, website_url)')
    .eq('user_id', userId)
    .in('outcome', OPEN_OUTCOMES)
    .order('outcome_at', { ascending: true });

  if (error) throw new Error(`getFollowUps : ${error.message}`);
  if (!data) return [];

  const now = Date.now();

  return data.map((row) => {
    const company = row.companies as unknown as {
      legal_name: string; commercial_name: string | null;
      city: string | null; phone: string | null; website_url: string | null;
    };
    const opportunity = row.opportunities as unknown as { opportunity_type: OpportunityType };
    const outcomeAt = row.outcome_at as string;

    return {
      assignmentId: row.id as string,
      outcome: row.outcome as OpenOutcome,
      notes: (row.notes as string | null) ?? null,
      outcomeAt,
      daysSince: Math.floor((now - new Date(outcomeAt).getTime()) / 86_400_000),
      type: opportunity.opportunity_type,
      company: {
        name: company.commercial_name ?? company.legal_name,
        city: company.city,
        phone: company.phone,
        websiteUrl: company.website_url,
      },
    };
  });
}

export interface OutcomeStats {
  /** Entreprises effectivement appelées. */
  contacted: number;
  interested: number;
  meeting: number;
  proposal: number;
  client: number;
}

/**
 * Le compte des issues déclarées.
 *
 * Sans engagement de durée : le freelance veut savoir si ça marche POUR LUI,
 * et une fenêtre glissante de trente jours dirait autre chose que ce total.
 * Le jour où l'échantillon sera assez gros pour qu'une tendance ait un sens,
 * ce sera une autre fonction, et elle le dira.
 */
export async function getOutcomeStats(db: Db, userId: string): Promise<OutcomeStats> {
  const { data, error } = await db
    .from('assignments')
    .select('outcome')
    .eq('user_id', userId)
    .not('outcome', 'is', null);

  if (error) throw new Error(`getOutcomeStats : ${error.message}`);

  const rows = data ?? [];
  const count = (value: string) => rows.filter((row) => row.outcome === value).length;

  return {
    contacted: rows.length,
    interested: count('interested'),
    meeting: count('meeting'),
    proposal: count('proposal'),
    client: count('client'),
  };
}

export interface HistoryEntry {
  assignmentId: string;
  outcome: string;
  outcomeAt: string;
  notes: string | null;
  type: OpportunityType;
  company: { name: string; city: string | null };
}

/**
 * Tout ce qui a été traité, du plus récent au plus ancien.
 *
 * Les relances montrent ce qui ATTEND ; l'historique montre ce qui est
 * PASSÉ — refus, silences, clients compris. Sans lui, un « pas de
 * réponse » disparaissait de l'écran à la seconde où on le déclarait,
 * et rien ne permettait de retrouver qui on avait déjà eu au bout du fil.
 */
export async function getHistory(db: Db, userId: string): Promise<HistoryEntry[]> {
  const { data, error } = await db
    .from('assignments')
    .select('id, outcome, outcome_at, notes, opportunities!inner(opportunity_type), companies!inner(legal_name, commercial_name, city)')
    .eq('user_id', userId)
    .not('outcome', 'is', null)
    .order('outcome_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`getHistory : ${error.message}`);

  return (data ?? []).map((row) => {
    const company = row.companies as unknown as {
      legal_name: string; commercial_name: string | null; city: string | null;
    };
    const opportunity = row.opportunities as unknown as { opportunity_type: OpportunityType };
    return {
      assignmentId: row.id as string,
      outcome: row.outcome as string,
      outcomeAt: row.outcome_at as string,
      notes: (row.notes as string | null) ?? null,
      type: opportunity.opportunity_type,
      company: { name: company.commercial_name ?? company.legal_name, city: company.city },
    };
  });
}

export interface ActivityDay {
  /** Le jour, en AAAA-MM-JJ, fuseau Europe/Paris. */
  date: string;
  /** Entreprises appelées ce jour-là. */
  contacted: number;
  /** Issues positives déclarées ce jour-là. */
  responses: number;
}

/** Les issues qui comptent comme une réponse obtenue. */
const RESPONSE_OUTCOMES = new Set(['interested', 'meeting', 'proposal', 'client']);

/**
 * L'activité jour par jour, sur une fenêtre glissante.
 *
 * Deux courbes seulement : ce que le freelance a fait (appels) et ce que ça
 * a produit (réponses positives). Les refus et les silences n'y figurent
 * pas — le graphique mesure l'effort et son fruit, pas la déception.
 *
 * La grille est complète : un jour sans activité vaut zéro, pas une absence.
 * Un graphique qui saute les jours creux ment sur la régularité.
 */
export async function getActivitySeries(
  db: Db,
  userId: string,
  days = 30,
): Promise<ActivityDay[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await db
    .from('assignments')
    .select('contacted_at, outcome, outcome_at')
    .eq('user_id', userId)
    .or(`contacted_at.gte.${cutoff},outcome_at.gte.${cutoff}`);

  if (error) throw new Error(`getActivitySeries : ${error.message}`);

  // fr-CA donne AAAA-MM-JJ ; le fuseau est fixé pour que « le même jour »
  // veuille dire la même chose sur le serveur et chez l'utilisateur.
  const dayKey = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  });

  const series = new Map<string, ActivityDay>();
  const now = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = dayKey.format(new Date(now - i * 86_400_000));
    series.set(date, { date, contacted: 0, responses: 0 });
  }

  for (const row of data ?? []) {
    if (row.contacted_at) {
      const day = series.get(dayKey.format(new Date(row.contacted_at as string)));
      if (day) day.contacted += 1;
    }
    if (row.outcome_at && RESPONSE_OUTCOMES.has(row.outcome as string)) {
      const day = series.get(dayKey.format(new Date(row.outcome_at as string)));
      if (day) day.responses += 1;
    }
  }

  return [...series.values()];
}
