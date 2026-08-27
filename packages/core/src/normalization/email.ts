/**
 * Adresses e-mail.
 *
 * Le V1 ne prospecte pas par e-mail nominatif : le gate de contact est
 * téléphone ou formulaire. La distinction générique / nominatif est néanmoins
 * faite dès maintenant, parce qu'elle change le régime juridique applicable et
 * qu'on ne veut pas avoir à requalifier des données stockées à plat.
 */

const GENERIC_LOCAL_PARTS = new Set([
  'contact', 'info', 'infos', 'accueil', 'bonjour', 'hello',
  'commercial', 'commande', 'commandes', 'vente', 'ventes',
  'service', 'serviceclient', 'sav', 'support', 'admin',
  'secretariat', 'direction', 'gerance', 'reservation', 'reservations',
  'boutique', 'magasin', 'restaurant', 'devis', 'mail', 'email',
]);

export interface EmailNormalizationResult {
  email: string | null;
  /**
   * `generic` : boîte de fonction (contact@…), pas une donnée personnelle.
   * `personal` : probablement nominative (prenom.nom@…), relève du RGPD.
   */
  kind: 'generic' | 'personal' | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function normalizeEmail(input: string | null | undefined): string | null {
  return normalizeEmailDetailed(input).email;
}

export function normalizeEmailDetailed(
  input: string | null | undefined,
): EmailNormalizationResult {
  if (!input) return { email: null, kind: null };

  const value = input.trim().toLowerCase().replace(/^mailto:/, '');
  if (!EMAIL_PATTERN.test(value)) return { email: null, kind: null };

  const at = value.lastIndexOf('@');
  const localPart = value.slice(0, at);
  const domain = value.slice(at + 1);

  if (localPart.length === 0 || localPart.length > 64) return { email: null, kind: null };
  if (domain.length > 253) return { email: null, kind: null };

  const simplified = localPart.replace(/[^a-z]/g, '');
  const kind = GENERIC_LOCAL_PARTS.has(simplified) ? 'generic' : 'personal';

  return { email: value, kind };
}

/** Une boîte de fonction n'est pas une donnée personnelle au sens du RGPD. */
export function isGenericEmail(input: string | null | undefined): boolean {
  return normalizeEmailDetailed(input).kind === 'generic';
}
