import type { Db } from '../db/client';
import type { OpportunityType } from '../domain/types';
import { isEligible, type MatchingPreferences } from './fit';
import { readPreferences } from './onboarding';

/**
 * Pourquoi la journée est vide.
 *
 * Un tableau de bord vide qui répond « le moteur repasse cette nuit » est une
 * réponse polie et inutile. Trois causes très différentes produisent le même
 * écran, et l'utilisateur ne peut agir que s'il sait laquelle :
 *
 *   le stock est vide          → il n'y a rien à faire, il faut attendre ;
 *   le stock existe mais son   → une case décochée suffit à tout écarter, et
 *   paramétrage l'écarte         c'est corrigible en dix secondes ;
 *   il a déjà été servi        → tout va bien, il a simplement déjà tout lu.
 *
 * Le deuxième cas est le plus fréquent au démarrage, et le seul que
 * l'utilisateur attribuerait au produit s'il n'était pas expliqué.
 */

export type EmptyReason =
  | 'servi'
  | 'stock-vide'
  | 'services-non-retenus'
  | 'secteurs-exclus'
  | 'inconnu';

export interface EmptyDiagnosis {
  reason: EmptyReason;
  /** Opportunités en stock, tous filtres ignorés. */
  inStock: number;
  /** Familles présentes en stock mais absentes du paramétrage. */
  missedTypes: OpportunityType[];
}

export async function diagnoseEmptyDay(
  db: Db,
  userId: string,
): Promise<EmptyDiagnosis> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count: served } = await db
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('assigned_at', dayStart.toISOString());

  if ((served ?? 0) > 0) {
    return { reason: 'servi', inStock: 0, missedTypes: [] };
  }

  const { data: stock } = await db
    .from('opportunities')
    .select('opportunity_type, confidence_score, base_score, companies!inner(city, region, industry_code)')
    .eq('status', 'available')
    .limit(500);

  const rows = stock ?? [];
  if (rows.length === 0) {
    return { reason: 'stock-vide', inStock: 0, missedTypes: [] };
  }

  const preferences = await readPreferences(db, userId);
  const eligible = rows.filter((row) => {
    const company = row.companies as unknown as {
      city: string | null; region: string | null; industry_code: string | null;
    };
    return isEligible({
      opportunityType: row.opportunity_type as OpportunityType,
      baseScore: Number(row.base_score),
      confidenceScore: Number(row.confidence_score),
      city: company.city,
      region: company.region,
      industryCode: company.industry_code,
    }, preferences as MatchingPreferences);
  });

  if (eligible.length > 0) {
    // Du stock passe le filtre : le vide vient d'ailleurs — cooldown,
    // entreprise déjà attribuée, ou score sous le seuil de livraison.
    return { reason: 'inconnu', inStock: rows.length, missedTypes: [] };
  }

  // Rien ne passe. Reste à dire QUEL filtre a tout écarté, parce que la
  // correction n'est pas la même.
  const stockTypes = [...new Set(rows.map((r) => r.opportunity_type as OpportunityType))];
  const missedTypes = preferences.services.length === 0
    ? []
    : stockTypes.filter((type) => !preferences.services.includes(type));

  return {
    reason: missedTypes.length === stockTypes.length && missedTypes.length > 0
      ? 'services-non-retenus'
      : 'secteurs-exclus',
    inStock: rows.length,
    missedTypes,
  };
}
