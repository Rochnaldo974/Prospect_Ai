/**
 * Le palier d'un dossier : Diamant, Or, Argent, Bronze.
 *
 * Le score de pertinence dit à quel point le dossier correspond au
 * freelance ; le palier dit combien d'atouts le dossier réunit pour que
 * l'appel aboutisse. Les outils du marché l'affichent tous, et pour une
 * raison simple : l'œil va au Diamant en premier.
 *
 * Chaque point a une raison lisible, parce qu'un palier qu'on ne peut pas
 * expliquer se discute. Un fait daté pèse double : c'est ce qui distingue
 * un dossier d'une ligne d'annuaire.
 */

export type TierLevel = 'diamant' | 'or' | 'argent' | 'bronze';

export interface TierInput {
  /** Un fait daté déclenche le dossier (panne, création, dépôt, appel d'offres). */
  dated: boolean;
  phone: boolean;
  email: boolean;
  contactForm: boolean;
  hasWebsite: boolean;
  /** Note du site mesurée, quand elle existe. */
  siteScore: number | null;
  /** Présente sur les réseaux sociaux, sans site. */
  socialWithoutWebsite: boolean;
  /** SIREN connu et identité solide. */
  identified: boolean;
  /** Avis Google, quand la fiche a été relevée. */
  googleReviews?: number | null;
  googleRating?: number | null;
}

export interface Tier {
  level: TierLevel;
  points: number;
  reasons: string[];
}

export const TIER_LABELS: Record<TierLevel, string> = {
  diamant: 'Diamant', or: 'Or', argent: 'Argent', bronze: 'Bronze',
};

export function tierOf(input: TierInput): Tier {
  const reasons: string[] = [];
  let points = 0;

  if (input.dated) { points += 2; reasons.push('un fait daté'); }
  if (input.phone) { points += 1; reasons.push('un téléphone'); }
  if (input.email || input.contactForm) { points += 1; reasons.push(input.email ? 'un e-mail' : 'un formulaire'); }
  if (input.hasWebsite && input.siteScore !== null && input.siteScore < 50) {
    points += 1; reasons.push(`un site noté ${input.siteScore}`);
  } else if (!input.hasWebsite && input.socialWithoutWebsite) {
    points += 1; reasons.push('une page sociale sans site');
  }
  if (input.identified) { points += 1; reasons.push('une identité sûre'); }
  // La capacité : un commerce noté par ses clients marche, donc peut payer.
  if ((input.googleReviews ?? 0) >= 20 && (input.googleRating ?? 0) >= 4) {
    points += 1; reasons.push(`une clientèle établie (${input.googleRating} sur ${input.googleReviews} avis)`);
  }

  const level: TierLevel = points >= 5 ? 'diamant' : points >= 3 ? 'or' : points >= 1 ? 'argent' : 'bronze';
  return { level, points, reasons };
}
