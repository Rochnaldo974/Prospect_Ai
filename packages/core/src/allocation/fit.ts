import type { OpportunityType } from '../domain/types';
import { freshnessOf } from '../opportunities/scoring';
import { technologyMatches } from '../normalization/technology';

/**
 * Adéquation entre une opportunité et un freelance.
 *
 * Distincte du score de l'opportunité, qui mesure sa qualité dans l'absolu.
 * Une refonte urgente à Lille est excellente et ne vaut rien pour quelqu'un
 * qui ne travaille qu'autour de Marseille.
 *
 * Cinq composantes, dans cet ordre d'importance : où, sur quelle
 * technologie, dans quel secteur, depuis quand, et à quel point le dossier
 * est solide. La géographie pèse le plus parce que c'est la seule contrainte
 * qu'un freelance ne peut pas lever ; la technologie vient ensuite parce
 * qu'un spécialiste WordPress vend mieux une refonte WordPress.
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
  /** Clés normalisées : wordpress, shopify… Vide : pas de préférence. */
  technologies: string[];
  locationMode: 'france' | 'region' | 'city' | 'france_remote';
  city: string | null;
  region: string | null;
  preferredIndustries: string[];
  excludedIndustries: string[];
  /** Ne jamais proposer d'association (JOAFE). */
  excludeAssociations: boolean;
}

export interface OpportunityCandidate {
  opportunityType: OpportunityType;
  baseScore: number;
  confidenceScore: number;
  city: string | null;
  region: string | null;
  industryCode: string | null;
  /** CMS mesuré sur le site, tel que le scanner le nomme. Null : pas de site ou inconnu. */
  cms: string | null;
  /** Le fait daté qui porte le dossier, s'il y en a un. */
  triggerType: string | null;
  triggerOccurredAt: string | null;
  /** Quand le moteur a produit l'opportunité : la fraîcheur d'un diagnostic. */
  createdAt: string | null;
}

export const FIT_WEIGHTS = { geo: 0.45, technology: 0.15, industry: 0.15, freshness: 0.15, quality: 0.10 } as const;
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

/** Chaque composante sur 100, puis l'adéquation et le rang : lisible tel quel dans la console. */
export interface MatchExplanation {
  geo: number;
  technology: number;
  industry: number;
  freshness: number;
  quality: number;
  fit: number;
  base: number;
  match: number;
  weights: typeof FIT_WEIGHTS;
}

export function explainMatch(
  candidate: OpportunityCandidate,
  preferences: MatchingPreferences,
  now = Date.now(),
): MatchExplanation {
  const geo = geoFit(candidate, preferences);
  const technology = technologyFit(candidate, preferences);

  const industry = candidate.industryCode !== null
      && preferences.preferredIndustries.some((code) => candidate.industryCode!.startsWith(code))
    ? 100
    // Aucun secteur préféré déclaré : on ne pénalise pas, on reste neutre.
    : preferences.preferredIndustries.length === 0 ? 60 : 30;

  const freshness = freshnessFit(candidate, now);

  // La confiance entre ici plutôt que dans le score de base pour éviter de la
  // compter deux fois : elle y est déjà un atténuateur multiplicatif.
  const quality = candidate.confidenceScore * 100;

  const fit = clamp(
    FIT_WEIGHTS.geo * geo + FIT_WEIGHTS.technology * technology + FIT_WEIGHTS.industry * industry
      + FIT_WEIGHTS.freshness * freshness + FIT_WEIGHTS.quality * quality,
  );
  const match = clamp(MATCH_WEIGHTS.base * candidate.baseScore + MATCH_WEIGHTS.fit * fit);

  return {
    geo, technology, industry, freshness: Number(freshness.toFixed(1)), quality: Number(quality.toFixed(1)),
    fit, base: candidate.baseScore, match, weights: FIT_WEIGHTS,
  };
}

/** Adéquation sur 100. */
export function fitScore(
  candidate: OpportunityCandidate,
  preferences: MatchingPreferences,
  now = Date.now(),
): number {
  return explainMatch(candidate, preferences, now).fit;
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
 * La technologie du site face à ce que le freelance maîtrise.
 *
 * Pas de préférence, ou pas de site : neutre. Le site tourne sur une
 * technologie déclarée : plein. Sur une autre : en retrait, sans être
 * écarté — refaire un site Wix en WordPress est un travail courant.
 */
function technologyFit(candidate: OpportunityCandidate, preferences: MatchingPreferences): number {
  if (preferences.technologies.length === 0 || candidate.cms === null) return 60;
  return technologyMatches(candidate.cms, preferences.technologies) ? 100 : 40;
}

/**
 * Depuis quand le dossier attend.
 *
 * Un fait daté décroît selon sa propre demi-vie, la même qu'au scoring. Un
 * diagnostic n'a pas de date : c'est la date de production qui vieillit,
 * lentement — un site de 2011 ne rajeunit pas, mais un dossier qui a fait
 * le tour du stock sans être pris mérite de passer derrière un nouveau.
 */
function freshnessFit(candidate: OpportunityCandidate, now: number): number {
  if (candidate.triggerType && candidate.triggerOccurredAt) {
    return freshnessOf(candidate.triggerType, candidate.triggerOccurredAt, now) * 100;
  }
  if (!candidate.createdAt) return 60;
  const ageDays = Math.max(0, (now - new Date(candidate.createdAt).getTime()) / 86_400_000);
  return 60 * Math.exp((-Math.LN2 * ageDays) / 45);
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
  now = Date.now(),
): number {
  return explainMatch(candidate, preferences, now).match;
}

const clamp = (value: number): number =>
  Number(Math.max(0, Math.min(100, value)).toFixed(2));
