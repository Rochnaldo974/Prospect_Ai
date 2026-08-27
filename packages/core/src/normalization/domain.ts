/**
 * Domaines.
 *
 * La contrainte d'unicité sur `companies.domain` est ce qui empêche deux
 * entreprises de revendiquer le même site. Elle ne vaut que si toutes les
 * sources convergent vers exactement la même chaîne.
 */

/**
 * Sous-domaines à retirer : ils désignent le même site.
 * `blog.` ou `shop.` sont volontairement conservés — ce sont des sites distincts.
 */
const STRIPPED_PREFIXES = ['www.', 'www2.', 'ww2.'];

/**
 * Hébergeurs de pages qui ne sont pas un site d'entreprise.
 * Une page Facebook n'est pas un domaine : c'est justement le signal inverse.
 */
const NOT_A_WEBSITE = new Set([
  'facebook.com', 'fb.com', 'm.facebook.com',
  'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'tiktok.com', 'youtube.com', 'pinterest.com',
  'google.com', 'business.site', 'sites.google.com',
  'pagesjaunes.fr', 'tripadvisor.fr', 'tripadvisor.com',
  'thefork.fr', 'lafourchette.com', 'deliveroo.fr', 'ubereats.com',
  'doctolib.fr', 'planity.com', 'booking.com', 'airbnb.fr',
  'wixsite.com', 'blogspot.com', 'wordpress.com', 'over-blog.com',
]);

export interface DomainNormalizationResult {
  domain: string | null;
  /** Renseigné quand l'entrée est valide mais n'est pas un site d'entreprise. */
  rejectedReason?: 'plateforme' | 'format' | 'local';
}

/**
 * Ramène une URL ou un domaine à sa forme canonique :
 * `https://WWW.Exemple.FR/contact?x=1` → `exemple.fr`
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  return normalizeDomainDetailed(input).domain;
}

export function normalizeDomainDetailed(
  input: string | null | undefined,
): DomainNormalizationResult {
  if (!input) return { domain: null, rejectedReason: 'format' };

  let value = input.trim().toLowerCase();
  if (!value) return { domain: null, rejectedReason: 'format' };

  // Retire le schéma, les identifiants, le chemin, la requête et le fragment.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.replace(/^[^@/]*@/, '');
  const separator = value.search(/[/?#]/);
  if (separator !== -1) value = value.slice(0, separator);

  // Port éventuel.
  value = value.replace(/:\d+$/, '');

  for (const prefix of STRIPPED_PREFIXES) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
      break;
    }
  }

  value = value.replace(/\.+$/, '');

  // Testé avant l'exigence d'un point : « localhost » n'en a pas.
  if (value === 'localhost') return { domain: null, rejectedReason: 'local' };

  if (!value.includes('.')) return { domain: null, rejectedReason: 'format' };
  if (!/^[a-z0-9.-]+$/.test(value)) return { domain: null, rejectedReason: 'format' };
  if (value.includes('..') || value.startsWith('.') || value.startsWith('-')) {
    return { domain: null, rejectedReason: 'format' };
  }

  const labels = value.split('.');
  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { domain: null, rejectedReason: 'format' };
  }
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return { domain: null, rejectedReason: 'format' };
  }
  if (value.length > 253) return { domain: null, rejectedReason: 'format' };

  if (tld === 'local' || tld === 'test' || tld === 'invalid' || tld === 'localhost') {
    return { domain: null, rejectedReason: 'local' };
  }

  // Une page sur une plateforme tierce n'est pas le site de l'entreprise.
  const registrable = labels.slice(-2).join('.');
  const registrableThree = labels.slice(-3).join('.');
  if (NOT_A_WEBSITE.has(value) || NOT_A_WEBSITE.has(registrable) || NOT_A_WEBSITE.has(registrableThree)) {
    return { domain: null, rejectedReason: 'plateforme' };
  }

  return { domain: value };
}

/** Reconstruit une URL affichable à partir d'un domaine normalisé. */
export function domainToUrl(domain: string | null): string | null {
  return domain ? `https://${domain}` : null;
}

/** Vrai si le domaine est hébergé sur une plateforme sociale ou d'annuaire. */
export function isPlatformUrl(input: string | null | undefined): boolean {
  return normalizeDomainDetailed(input).rejectedReason === 'plateforme';
}
