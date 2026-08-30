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
    .select('id, outcome, outcome_at, opportunities!inner(opportunity_type), companies!inner(legal_name, commercial_name, city, phone, website_url)')
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
