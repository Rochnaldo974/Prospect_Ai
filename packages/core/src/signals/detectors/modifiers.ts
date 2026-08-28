import type { SignalDetector } from '../types';
import { ageInDays, clamp01 } from '../types';

/**
 * Détecteurs de modificateurs.
 *
 * Un modificateur décrit un ÉTAT. Il ne déclenche jamais une opportunité — il
 * module le score d'une opportunité déclenchée par ailleurs. « Site lent » est
 * vrai en permanence pour une large part du parc : en faire un motif de
 * contact reviendrait à démarcher au hasard.
 */

/**
 * Aucun site, avec preuve d'absence.
 *
 * Distinction capitale : ne pas AVOIR TROUVÉ de site n'est pas la même chose
 * que constater qu'il n'y en a pas. On n'émet ce signal que sur preuve
 * positive — une fiche de commerce complète, avec un téléphone, sans champ
 * site. Sans cette règle, on livrerait des faux positifs en masse, et un
 * freelance qui appelle en proposant un site à quelqu'un qui en a déjà un
 * perd sa crédibilité au premier appel.
 */
export const noWebsiteDetector: SignalDetector = {
  id: 'no_website_proven',
  describes: 'Aucun site, attesté par une fiche de commerce complète',

  detect({ company }) {
    if (company.domain !== null) return [];
    // La preuve : l'entreprise est joignable et vient d'une source de POI qui
    // aurait renseigné le site s'il existait.
    if (!company.has_contact) return [];
    if (company.website_resolution_attempts < 1) return [];

    return [{
      signalType: 'no_website_proven',
      kind: 'modifier',
      category: 'need',
      strength: 0.95,
      // La confiance monte avec le nombre de recherches infructueuses.
      confidence: clamp01(0.6 + 0.12 * company.website_resolution_attempts),
      evidence: {
        resolution_attempts: company.website_resolution_attempts,
        has_phone: company.phone !== null,
      },
      fingerprint: 'no_website_proven',
    }];
  },
};

/** Site répondant mais vide : page d'attente, domaine parké, « en construction ». */
export const placeholderSiteDetector: SignalDetector = {
  id: 'website_placeholder',
  describes: 'Site réduit à une page d’attente',

  detect({ domain }) {
    if (domain?.status !== 'placeholder') return [];

    return [{
      signalType: 'website_placeholder',
      kind: 'modifier',
      category: 'need',
      strength: 0.9,
      confidence: 0.9,
      evidence: { domain: domain.domain },
      fingerprint: 'website_placeholder',
    }];
  },
};

/** Site en erreur durable. */
export const brokenSiteDetector: SignalDetector = {
  id: 'website_broken',
  describes: 'Site en erreur ou injoignable',

  detect({ domain }) {
    if (domain?.status !== 'broken' && domain?.status !== 'unreachable') return [];

    return [{
      signalType: 'website_broken',
      kind: 'modifier',
      category: 'need',
      strength: 0.85,
      confidence: domain.status === 'broken' ? 0.95 : 0.75,
      evidence: { status: domain.status, http_status: domain.http_status },
      fingerprint: `website_broken:${domain.status}`,
    }];
  },
};

/**
 * Solution vieillissante ou de bricolage.
 *
 * Ces plateformes correspondent à un site fait rapidement, souvent par le
 * dirigeant lui-même ou un proche. Elles signalent un besoin, pas un défaut :
 * le commerçant a voulu une présence en ligne sans y mettre de budget.
 */
const DATED_PLATFORMS = new Set([
  'Wix', 'Jimdo', 'IONOS MyWebsite', 'Weebly', 'e-monsite', 'Google Sites', 'SPIP',
]);

export const datedPlatformDetector: SignalDetector = {
  id: 'dated_platform',
  describes: 'Site bâti sur une solution de bricolage ou vieillissante',

  detect({ domain }) {
    if (!domain?.cms || !DATED_PLATFORMS.has(domain.cms)) return [];

    return [{
      signalType: 'dated_platform',
      kind: 'modifier',
      category: 'need',
      strength: 0.75,
      confidence: 0.9,
      evidence: { cms: domain.cms },
      fingerprint: `dated_platform:${domain.cms}`,
    }];
  },
};

/**
 * Contenu figé depuis longtemps.
 *
 * L'année de copyright est le seul marqueur d'abandon lisible sans historique.
 * Contrairement à ce qu'on pourrait croire, l'absence de balise viewport ne
 * discrimine plus rien : sur 47 sites de commerces réellement scannés, tous en
 * avaient une. Les hébergeurs et CMS l'ajoutent systématiquement.
 */
export const staleContentDetector: SignalDetector = {
  id: 'stale_content',
  describes: 'Contenu qui n’a pas bougé depuis plusieurs années',

  detect({ domain }) {
    if (!domain?.copyright_year) return [];

    const yearsBehind = new Date().getFullYear() - domain.copyright_year;
    if (yearsBehind < 2) return [];

    return [{
      signalType: 'stale_content',
      kind: 'modifier',
      category: 'need',
      strength: clamp01(0.3 + 0.15 * yearsBehind),
      // Un pied de page peut être figé alors que le site vit : indice, pas preuve.
      confidence: 0.65,
      evidence: { copyright_year: domain.copyright_year, years_behind: yearsBehind },
      fingerprint: `stale_content:${domain.copyright_year}`,
    }];
  },
};

/** Site lent. Mesuré au premier octet, sans jugement sur le rendu. */
export const slowSiteDetector: SignalDetector = {
  id: 'slow_website',
  describes: 'Temps de réponse élevé',

  detect({ domain }) {
    if (!domain?.ttfb_ms || domain.ttfb_ms < 1200) return [];

    return [{
      signalType: 'slow_website',
      kind: 'modifier',
      category: 'need',
      strength: clamp01((domain.ttfb_ms - 1200) / 3000),
      // Une seule mesure : la lenteur peut être passagère.
      confidence: 0.6,
      evidence: { ttfb_ms: domain.ttfb_ms },
      fingerprint: 'slow_website',
    }];
  },
};

/** Absence de HTTPS. Visible par les visiteurs, signalée par les navigateurs. */
export const noSslDetector: SignalDetector = {
  id: 'no_ssl',
  describes: 'Site sans HTTPS',

  detect({ domain }) {
    if (!domain || domain.status !== 'reachable' || domain.has_ssl !== false) return [];

    return [{
      signalType: 'no_ssl',
      kind: 'modifier',
      category: 'need',
      strength: 0.8,
      confidence: 0.95,
      evidence: { domain: domain.domain },
      fingerprint: 'no_ssl',
    }];
  },
};

/** Commerce de détail sans vente en ligne. */
const RETAIL_PREFIXES = ['47.', '10.7', '46.'];

export const noEcommerceDetector: SignalDetector = {
  id: 'retail_without_ecommerce',
  describes: 'Commerce de détail sans vente en ligne',

  detect({ company, domain }) {
    if (!domain || domain.status !== 'reachable') return [];
    if (domain.ecommerce_detected) return [];
    if (!company.industry_code) return [];
    if (!RETAIL_PREFIXES.some((p) => company.industry_code!.startsWith(p))) return [];

    return [{
      signalType: 'retail_without_ecommerce',
      kind: 'modifier',
      category: 'need',
      strength: 0.6,
      // Hypothèse commerciale, pas un constat : beaucoup de commerces n'ont
      // aucun intérêt à vendre en ligne.
      confidence: 0.5,
      evidence: { industry_code: company.industry_code, domain: domain.domain },
      fingerprint: 'retail_without_ecommerce',
    }];
  },
};

/** Site joignable sans aucun moyen de contact. */
export const noContactFormDetector: SignalDetector = {
  id: 'no_contact_form',
  describes: 'Site sans formulaire ni page de contact',

  detect({ domain }) {
    if (!domain || domain.status !== 'reachable' || domain.contact_form_detected) return [];

    return [{
      signalType: 'no_contact_form',
      kind: 'modifier',
      category: 'need',
      strength: 0.5,
      confidence: 0.8,
      evidence: { domain: domain.domain },
      fingerprint: 'no_contact_form',
    }];
  },
};

// ─── Qualité et risque ───────────────────────────────────────────────────────

/** Entreprise joignable : condition du gate de contact du V1. */
export const reachableDetector: SignalDetector = {
  id: 'reachable',
  describes: 'Entreprise joignable par téléphone ou formulaire',

  detect({ company }) {
    if (!company.has_contact) return [];

    return [{
      signalType: 'reachable',
      kind: 'modifier',
      category: 'quality',
      strength: company.phone !== null ? 0.9 : 0.6,
      confidence: 0.95,
      evidence: { phone: company.phone !== null, form: company.contact_form_url !== null },
      fingerprint: 'reachable',
    }];
  },
};

/** Identité incertaine : un score commercial élevé ne suffit pas à distribuer. */
export const weakIdentityDetector: SignalDetector = {
  id: 'weak_identity',
  describes: 'Identité de l’entreprise mal établie',

  detect({ company }) {
    if (company.identity_confidence >= 0.75) return [];

    return [{
      signalType: 'weak_identity',
      kind: 'modifier',
      category: 'risk',
      strength: clamp01(1 - company.identity_confidence),
      confidence: 0.9,
      evidence: {
        identity_confidence: company.identity_confidence,
        has_siret: company.siret !== null,
      },
      fingerprint: 'weak_identity',
    }];
  },
};

/**
 * Site partagé par plusieurs établissements.
 *
 * Signal de RISQUE, pas de besoin : le site appartient au réseau, pas au point
 * de vente. Proposer une refonte au gérant d'un magasin d'enseigne serait
 * s'adresser à quelqu'un qui n'a aucune prise sur le sujet.
 */
export const sharedDomainDetector: SignalDetector = {
  id: 'shared_domain',
  describes: 'Site partagé avec d’autres établissements du même réseau',

  detect({ domain, domainCompanyCount }) {
    if (!domain || domainCompanyCount <= 1) return [];

    return [{
      signalType: 'shared_domain',
      kind: 'modifier',
      category: 'risk',
      strength: clamp01(0.4 + 0.15 * domainCompanyCount),
      confidence: 0.95,
      evidence: { domain: domain.domain, establishments: domainCompanyCount },
      fingerprint: `shared_domain:${domainCompanyCount}`,
    }];
  },
};

/** Site jamais visité : on ne sait rien, et il faut le dire. */
export const unscannedDetector: SignalDetector = {
  id: 'website_unscanned',
  describes: 'Site déclaré mais jamais analysé',

  detect({ company, domain }) {
    if (company.domain === null) return [];
    if (domain && domain.status !== 'unknown') return [];

    return [{
      signalType: 'website_unscanned',
      kind: 'modifier',
      category: 'risk',
      strength: 0.5,
      confidence: 0.99,
      evidence: { domain: company.domain, first_seen_at: domain?.first_seen_at ?? null },
      fingerprint: 'website_unscanned',
    }];
  },
};

/** Entreprise vue récemment par une source : elle est encore en activité. */
export const activeBusinessDetector: SignalDetector = {
  id: 'active_business',
  describes: 'Entreprise confirmée active par une source récente',

  detect({ company }) {
    const age = ageInDays(company.last_seen_at);
    if (age === null || age > 60) return [];
    if (company.company_status === 'closed') return [];

    return [{
      signalType: 'active_business',
      kind: 'modifier',
      category: 'quality',
      strength: clamp01(1 - age / 60),
      confidence: 0.8,
      evidence: { last_seen_at: company.last_seen_at, age_days: Math.round(age) },
      fingerprint: 'active_business',
    }];
  },
};

export const MODIFIER_DETECTORS: SignalDetector[] = [
  noWebsiteDetector,
  placeholderSiteDetector,
  brokenSiteDetector,
  datedPlatformDetector,
  staleContentDetector,
  slowSiteDetector,
  noSslDetector,
  noEcommerceDetector,
  noContactFormDetector,
  reachableDetector,
  weakIdentityDetector,
  sharedDomainDetector,
  unscannedDetector,
  activeBusinessDetector,
];
