import type { Db } from '../db/client';
import type { OpportunityType } from '../domain/types';

/**
 * Paramétrage initial d'un freelance.
 *
 * Trois questions, et c'est une règle produit inscrite jusque dans le
 * commentaire de la table : chaque champ supplémentaire est une friction qui
 * coûte des inscriptions, et le moteur sait très bien travailler avec des
 * préférences larges. Un paramétrage vide ne restreint rien — il vaut mieux
 * proposer trop que ne rien proposer.
 *
 * Les trois questions sont choisies pour ce qu'elles changent réellement au
 * matching :
 *
 *   les services    filtre binaire : une opportunité hors de cette liste
 *                   n'est jamais proposée, quel que soit son score ;
 *   le périmètre    la seule contrainte qu'un freelance ne peut pas lever ;
 *   les exclusions  ce qu'il ne veut pas voir, pour ne pas gâcher une des
 *                   cinq places de sa journée.
 */

export interface OnboardingAnswers {
  services: OpportunityType[];
  locationMode: 'france' | 'region' | 'city' | 'france_remote';
  city: string | null;
  region: string | null;
  excludedIndustries: string[];
}

export interface OnboardingResult {
  ok: boolean;
  /** Ce qui manque pour que le paramétrage ait un sens. */
  problem: string | null;
}

/**
 * Ce qu'on refuse d'enregistrer.
 *
 * Un périmètre local sans lieu ne produirait aucune correspondance : la base
 * a une contrainte pour l'interdire, et un utilisateur qui la déclencherait
 * verrait une erreur technique au lieu d'une question claire.
 */
export function validateAnswers(answers: OnboardingAnswers): OnboardingResult {
  const local = answers.locationMode === 'city' || answers.locationMode === 'region';

  if (local && !answers.city && !answers.region) {
    return {
      ok: false,
      problem: 'Indique ta ville ou ta région pour un périmètre local.',
    };
  }

  return { ok: true, problem: null };
}

/**
 * Enregistre le paramétrage et ouvre le compte à l'attribution.
 *
 * `onboarding_completed` est posé en dernier : tant qu'il est faux, le moteur
 * d'attribution écarte le compte. Un profil à moitié rempli ne doit pas
 * recevoir un lot construit sur des préférences incomplètes.
 */
export async function completeOnboarding(
  db: Db,
  userId: string,
  answers: OnboardingAnswers,
): Promise<OnboardingResult> {
  const validation = validateAnswers(answers);
  if (!validation.ok) return validation;

  const { error: prefError } = await db
    .from('user_preferences')
    .upsert({
      user_id: userId,
      services: answers.services,
      location_mode: answers.locationMode,
      city: answers.city,
      region: answers.region,
      excluded_industries: answers.excludedIndustries,
    }, { onConflict: 'user_id' });

  if (prefError) return { ok: false, problem: prefError.message };

  // La ville et la région sont recopiées sur le profil : le moteur s'en sert
  // comme repli quand aucune préférence n'a été enregistrée.
  const { error: profileError } = await db
    .from('profiles')
    .update({
      city: answers.city,
      region: answers.region,
      onboarding_completed: true,
    })
    .eq('id', userId);

  if (profileError) return { ok: false, problem: profileError.message };

  return { ok: true, problem: null };
}

/** Préférences actuelles, pour réafficher le formulaire. */
export async function readPreferences(
  db: Db,
  userId: string,
): Promise<OnboardingAnswers> {
  const { data } = await db
    .from('user_preferences')
    .select('services, location_mode, city, region, excluded_industries')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    services: (data?.services ?? []) as OpportunityType[],
    locationMode: (data?.location_mode ?? 'france') as OnboardingAnswers['locationMode'],
    city: data?.city ?? null,
    region: data?.region ?? null,
    excludedIndustries: (data?.excluded_industries ?? []) as string[],
  };
}
