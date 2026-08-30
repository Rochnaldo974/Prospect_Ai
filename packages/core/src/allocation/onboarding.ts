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
  /**
   * Conservé dans le modèle mais plus demandé : le moteur en a besoin, et un
   * studio local pourrait vouloir le restreindre un jour. La valeur par défaut
   * couvre la France entière.
   */
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
      problem: 'Indiquez votre ville ou votre région pour un périmètre local.',
    };
  }

  return { ok: true, problem: null };
}

/**
 * Les étapes, dans l'ordre. Le nombre est affiché à l'utilisateur.
 *
 * Le périmètre géographique en a été retiré. Les développeurs web et mobile
 * travaillent à distance : leur demander où ils habitent était une friction
 * pour une information qui ne change rien à ce qu'on leur propose. Le
 * paramétrage par défaut couvre donc la France entière, missions à distance
 * assumées.
 */
export const ONBOARDING_STEPS = ['services', 'secteurs', 'recapitulatif'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Enregistre une réponse partielle.
 *
 * Chaque étape écrit dès qu'elle est validée, et `onboarding_completed` reste
 * faux jusqu'à la dernière. Quelqu'un qui ferme son navigateur au milieu
 * retrouve ses réponses ; et un profil à moitié rempli ne reçoit pas un lot
 * construit sur des préférences incomplètes.
 */
export async function saveStep(
  db: Db,
  userId: string,
  patch: Partial<OnboardingAnswers>,
): Promise<OnboardingResult> {
  const current = await readPreferences(db, userId);
  const merged = { ...current, ...patch };

  if (patch.locationMode !== undefined || patch.city !== undefined || patch.region !== undefined) {
    const validation = validateAnswers(merged);
    if (!validation.ok) return validation;
  }

  const { error } = await db
    .from('user_preferences')
    .upsert({
      user_id: userId,
      services: merged.services,
      location_mode: merged.locationMode,
      city: merged.city,
      region: merged.region,
      excluded_industries: merged.excludedIndustries,
    }, { onConflict: 'user_id' });

  return error ? { ok: false, problem: error.message } : { ok: true, problem: null };
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
      // Le périmètre n'est plus demandé : la cible travaille à distance.
      location_mode: 'france_remote',
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
