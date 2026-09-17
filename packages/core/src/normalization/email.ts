/**
 * Adresses e-mail : normalisation et classification.
 *
 * La liste des boîtes génériques vit ICI et nulle part ailleurs : c'est elle
 * qui décide ce que le produit ose afficher et envoyer. Une boîte de fonction
 * (contact@, info@…) n'est pas une donnée personnelle ; une adresse nominative
 * relève du RGPD et n'est ni affichée ni utilisée pour l'e-mail tant qu'aucune
 * stratégie conforme n'est prévue. Une adresse chez un fournisseur grand
 * public (gmail, orange…) est une boîte personnelle même si elle est publiée
 * sur le site d'un commerce ; un noreply n'est pas un contact.
 */

/** Préfixes de boîtes de fonction, comparés lettres seules (contact-pro → contactpro ≠ contact). */
export const GENERIC_LOCAL_PARTS = new Set([
  'contact', 'info', 'infos', 'accueil', 'bonjour', 'hello', 'bienvenue',
  'commercial', 'sales', 'commande', 'commandes', 'vente', 'ventes', 'devis',
  'service', 'serviceclient', 'sav', 'support', 'clients', 'client',
  'secretariat', 'direction', 'gerance', 'admin', 'administration', 'office',
  'communication', 'marketing', 'presse',
  'reservation', 'reservations', 'booking', 'resa',
  'boutique', 'magasin', 'restaurant', 'atelier', 'cabinet', 'agence', 'studio',
  'mail', 'email', 'courrier', 'contactez',
]);

/** Boîtes de rôle : une fonction, pas une personne, mais moins « porte d'entrée » qu'un contact@. */
export const ROLE_LOCAL_PARTS = new Set([
  'rh', 'recrutement', 'jobs', 'careers', 'compta', 'comptabilite', 'facturation', 'billing',
  'technique', 'tech', 'it', 'webmaster', 'postmaster', 'hostmaster', 'abuse', 'dpo', 'rgpd',
  'juridique', 'legal', 'qualite', 'achats', 'logistique', 'export', 'partenariats', 'partners',
]);

const NOREPLY_PATTERN = /^(no-?reply|ne-?pas-?repondre|donotreply|do-?not-?reply|mailer-?daemon|bounce)/;

/** Fournisseurs grand public : une adresse chez eux est une boîte personnelle, pas celle de l'entreprise. */
export const FREE_PROVIDER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.fr', 'yahoo.com', 'ymail.com', 'hotmail.fr', 'hotmail.com',
  'outlook.fr', 'outlook.com', 'live.fr', 'live.com', 'msn.com', 'orange.fr', 'wanadoo.fr',
  'free.fr', 'sfr.fr', 'neuf.fr', 'laposte.net', 'bbox.fr', 'numericable.fr', 'aol.com', 'aol.fr',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me', 'gmx.fr', 'gmx.com', 'yandex.com',
]);

export type EmailCategory =
  | 'GENERIC_BUSINESS'
  | 'ROLE_BASED'
  | 'PERSONAL_BUSINESS'
  | 'PERSONAL_FREE_PROVIDER'
  | 'NOREPLY'
  | 'INVALID';

export interface EmailNormalizationResult {
  email: string | null;
  /**
   * `generic` : boîte de fonction (contact@…), pas une donnée personnelle.
   * `personal` : probablement nominative (prenom.nom@…), relève du RGPD.
   */
  kind: 'generic' | 'personal' | null;
}

export interface EmailClassification {
  email: string | null;
  category: EmailCategory;
  /** 0–100 : ce que vaut l'adresse pour écrire à l'entreprise. */
  quality: number;
  isGeneric: boolean;
  isPersonal: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function normalizeEmail(input: string | null | undefined): string | null {
  return normalizeEmailDetailed(input).email;
}

export function normalizeEmailDetailed(
  input: string | null | undefined,
): EmailNormalizationResult {
  const classified = classifyEmail(input);
  if (!classified.email) return { email: null, kind: null };
  return { email: classified.email, kind: classified.isGeneric ? 'generic' : 'personal' };
}

/**
 * Classe une adresse. La qualité est celle d'un canal d'écriture vers
 * l'entreprise : contact@ vaut plus que rh@, qui vaut plus que prenom.nom@,
 * qui vaut plus qu'une adresse gmail ; un noreply ne vaut rien.
 */
export function classifyEmail(input: string | null | undefined): EmailClassification {
  const invalid: EmailClassification = { email: null, category: 'INVALID', quality: 0, isGeneric: false, isPersonal: false };
  if (!input) return invalid;

  const value = input.trim().toLowerCase().replace(/^mailto:/, '');
  if (!EMAIL_PATTERN.test(value)) return invalid;

  const at = value.lastIndexOf('@');
  const localPart = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (localPart.length === 0 || localPart.length > 64 || domain.length > 253) return invalid;

  if (NOREPLY_PATTERN.test(localPart)) {
    return { email: value, category: 'NOREPLY', quality: 0, isGeneric: true, isPersonal: false };
  }

  const simplified = localPart.replace(/[^a-z]/g, '');
  if (GENERIC_LOCAL_PARTS.has(simplified)) {
    return { email: value, category: 'GENERIC_BUSINESS', quality: 90, isGeneric: true, isPersonal: false };
  }
  if (ROLE_LOCAL_PARTS.has(simplified)) {
    return { email: value, category: 'ROLE_BASED', quality: 70, isGeneric: true, isPersonal: false };
  }
  if (FREE_PROVIDER_DOMAINS.has(domain)) {
    return { email: value, category: 'PERSONAL_FREE_PROVIDER', quality: 20, isGeneric: false, isPersonal: true };
  }
  return { email: value, category: 'PERSONAL_BUSINESS', quality: 40, isGeneric: false, isPersonal: true };
}

/** Une boîte de fonction n'est pas une donnée personnelle au sens du RGPD. */
export function isGenericEmail(input: string | null | undefined): boolean {
  return classifyEmail(input).isGeneric && classifyEmail(input).category !== 'NOREPLY';
}

/** Ce que le produit accepte d'afficher et d'utiliser pour écrire : générique ou rôle, jamais nominatif. */
export function isUsableBusinessEmail(input: string | null | undefined): boolean {
  const c = classifyEmail(input);
  return c.category === 'GENERIC_BUSINESS' || c.category === 'ROLE_BASED';
}
