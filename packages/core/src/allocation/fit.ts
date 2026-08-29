import type { OpportunityType } from '../domain/types';

/**
 * Adéquation entre une opportunité et un freelance.
 *
 * Distincte du score de l'opportunité, qui mesure sa qualité dans l'absolu.
 * Une refonte urgente à Lille est excellente et ne vaut rien pour quelqu'un
 * qui ne travaille qu'autour de Marseille.
 *
 * Trois composantes, dans cet ordre d'importance : où, quoi, et à quel point
 * l'opportunité est solide. La géographie pèse le plus parce que c'est la
 * seule contrainte qu'un freelance ne peut pas lever.
 */

/**
 * Préférences telles que le calcul d'adéquation les utilise.
 *
 * Forme normalisée, distincte de la ligne `user_preferences` : les valeurs
 * absentes y sont déjà remplacées par le repli, si bien qu'aucun appelant
 * n'a à décider ce que « pas de préférence » veut dire.
 */
export interface MatchingPreferences {
  services: string[];
  locationMode: 'france' | 'region' | 'city' | 'france_remote';
  city: string | null;
  region: string | null;
  preferredIndustries: string[];
  excludedIndustries: string[];
}

export interface OpportunityCandidate {
  opportunityType: OpportunityType;
  baseScore: number;
  confidenceScore: number;
  city: string | null;
  region: string | null;
  industryCode: string | null;
}

export const FIT_WEIGHTS = { geo: 0.6, industry: 0.25, quality: 0.15 } as const;
export const MATCH_WEIGHTS = { base: 0.7, fit: 0.3 } as const;

/** Comparaison de noms de lieux : casse, accents et tirets ne comptent pas. */
const key = (value: string | null): string =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Une opportunité qu'on ne doit pas proposer du tout.
 *
 * Distinct d'une mauvaise adéquation : ici il n'y a pas de score bas, il y a
 * refus. Livrer un secteur explicitement exclu, ou une ville hors périmètre,
 * fait perdre au freelance une des cinq places de sa journée.
 */
export function isEligible(
  candidate: OpportunityCandidate,
  preferences: MatchingPreferences,
): boolean {
  if (preferences.services.length > 0
      && !preferences.services.includes(candidate.opportunityType)) {
    return false;
  }

  // Le code NAF est hiérarchique : exclure « 56 » exclut « 56.10A ».
  if (candidate.industryCode !== null
      && preferences.excludedIndustries.some((code) => candidate.industryCode!.startsWith(code))) {
    return false;
  }

  switch (preferences.locationMode) {
    // « France entière » et « France à distance » ne filtrent rien : c'est le
    // choix de quelqu'un qui accepte de travailler sans se déplacer.
    case 'france':
    case 'france_remote':
      return true;
    case 'region':
      return preferences.region === null || key(candidate.region) === key(preferences.region);
    case 'city':
      return preferences.city === null || key(candidate.city) === key(preferences.city);
  }
}

/** Adéquation sur 100. */
export function fitScore(
  candidate: OpportunityCandidate,
  preferences: MatchingPreferences,
): number {
  const geo = geoFit(candidate, preferences);

  const industry = candidate.industryCode !== null
      && preferences.preferredIndustries.some((code) => candidate.industryCode!.startsWith(code))
    ? 100
    // Aucun secteur préféré déclaré : on ne pénalise pas, on reste neutre.
    : preferences.preferredIndustries.length === 0 ? 60 : 30;

  // La confiance entre ici plutôt que dans le score de base pour éviter de la
  // compter deux fois : elle y est déjà un atténuateur multiplicatif.
  const quality = candidate.confidenceScore * 100;

  return clamp(
    FIT_WEIGHTS.geo * geo + FIT_WEIGHTS.industry * industry + FIT_WEIGHTS.quality * quality,
  );
}

function geoFit(candidate: OpportunityCandidate, preferences: MatchingPreferences): number {
  const sameCity = preferences.city !== null && key(candidate.city) === key(preferences.city);
  const sameRegion = preferences.region !== null && key(candidate.region) === key(preferences.region);

  // Même en France entière, la proximité reste un avantage réel : se déplacer
  // chez un commerçant vaut trois échanges téléphoniques.
  if (sameCity) return 100;
  if (sameRegion) return 75;
  return preferences.locationMode === 'france_remote' ? 60 : 45;
}

/**
 * Score de rang final.
 *
 * La qualité intrinsèque pèse plus que l'adéquation : mieux vaut une très
 * bonne opportunité un peu loin qu'une opportunité tiède au coin de la rue.
 */
export function matchScore(
  candidate: OpportunityCandidate,
  preferences: MatchingPreferences,
): number {
  return clamp(
    MATCH_WEIGHTS.base * candidate.baseScore + MATCH_WEIGHTS.fit * fitScore(candidate, preferences),
  );
}

const clamp = (value: number): number =>
  Number(Math.max(0, Math.min(100, value)).toFixed(2));
