import type { DetectedSignal, SignalDetector } from '../types';
import type { Json } from '../../db/database.types';

/**
 * Ce que le scan mesure pour le référencement et la vente en ligne.
 *
 * Aucun de ces signaux ne vaut une opportunité seul : ce sont des faits
 * comptés, jamais des notes, que les règles SEO et e-commerce combinent.
 * Un titre absent se vérifie en ouvrant la page ; « mauvais SEO » ne se
 * vérifie pas.
 */

interface SeoFacts {
  hasTitle?: boolean; titleLength?: number; hasMetaDescription?: boolean; h1Count?: number;
  hasCanonical?: boolean; hasJsonLd?: boolean; hasLang?: boolean; imagesTotal?: number; imagesWithoutAlt?: number; wordCount?: number;
}
interface CommerceFacts { platform?: string | null; catalog?: boolean; cart?: boolean; checkout?: boolean }

const RETAIL_PREFIXES = ['47.', '10.7', '46.'];
const OBSOLETE_PLATFORMS = new Set(['magento', 'prestashop', 'wix-stores']);

function seoOf(domain: { status: string; seo_facts?: unknown } | null): SeoFacts | null {
  if (!domain || domain.status !== 'reachable' || !domain.seo_facts || typeof domain.seo_facts !== 'object') return null;
  return domain.seo_facts as SeoFacts;
}

function commerceOf(domain: { status: string; commerce_facts?: unknown } | null): CommerceFacts | null {
  if (!domain || domain.status !== 'reachable' || !domain.commerce_facts || typeof domain.commerce_facts !== 'object') return null;
  return domain.commerce_facts as CommerceFacts;
}

const seoSignal = (type: string, strength: number, confidence: number, evidence: Json): DetectedSignal => ({
  signalType: type, kind: 'modifier', category: 'need', strength, confidence, evidence, fingerprint: type,
});

export const seoGapsDetector: SignalDetector = {
  id: 'seo_gaps',
  describes: 'Manques de référencement mesurés sur la page d’accueil',

  detect({ domain }) {
    const seo = seoOf(domain);
    if (!seo) return [];
    const out: DetectedSignal[] = [];
    if (seo.hasTitle === false) out.push(seoSignal('missing_title', 1, 0.95, { title_length: 0 }));
    if (seo.hasMetaDescription === false) out.push(seoSignal('missing_meta_description', 0.8, 0.95, {}));
    if ((seo.h1Count ?? 1) === 0) out.push(seoSignal('missing_h1', 0.8, 0.9, { h1_count: 0 }));
    if (seo.hasJsonLd === false) out.push(seoSignal('no_structured_data', 0.6, 0.85, {}));
    if (seo.hasCanonical === false) out.push(seoSignal('no_canonical', 0.4, 0.8, {}));
    if ((seo.imagesTotal ?? 0) >= 4 && (seo.imagesWithoutAlt ?? 0) / (seo.imagesTotal ?? 1) >= 0.5) {
      out.push(seoSignal('images_without_alt', 0.7, 0.9, { images: seo.imagesTotal ?? 0, without_alt: seo.imagesWithoutAlt ?? 0 }));
    }
    if ((seo.wordCount ?? 999) < 150) out.push(seoSignal('thin_content', 0.8, 0.8, { words: seo.wordCount ?? 0 }));
    return out;
  },
};

/** Un catalogue affiché (produits, prix) sans panier ni paiement. */
export const catalogWithoutCartDetector: SignalDetector = {
  id: 'catalog_without_cart',
  describes: 'Catalogue de produits sans vente en ligne',

  detect({ domain }) {
    const commerce = commerceOf(domain);
    if (!commerce || !commerce.catalog || commerce.cart) return [];
    return [{
      signalType: 'catalog_without_cart', kind: 'modifier', category: 'need', strength: 0.9, confidence: 0.8,
      evidence: { platform: commerce.platform ?? null }, fingerprint: 'catalog_without_cart',
    }];
  },
};

/** Une boutique en ligne sur une plateforme lourde et datée, avec des composants anciens. */
export const obsoleteEcommerceStackDetector: SignalDetector = {
  id: 'obsolete_ecommerce_stack',
  describes: 'Boutique en ligne sur une plateforme datée',

  detect({ domain }) {
    const commerce = commerceOf(domain);
    if (!commerce || !commerce.cart || !commerce.platform) return [];
    const techYear = (domain as { tech_year: number | null } | null)?.tech_year ?? null;
    const dated = techYear !== null && new Date().getFullYear() - techYear >= 5;
    if (!OBSOLETE_PLATFORMS.has(commerce.platform) && !dated) return [];
    return [{
      signalType: 'obsolete_ecommerce_stack', kind: 'modifier', category: 'need', strength: dated ? 0.9 : 0.6, confidence: 0.85,
      evidence: { platform: commerce.platform, tech_year: techYear }, fingerprint: `obsolete_ecommerce_stack:${commerce.platform}`,
    }];
  },
};

export const SEO_COMMERCE_DETECTORS: SignalDetector[] = [seoGapsDetector, catalogWithoutCartDetector, obsoleteEcommerceStackDetector];

export { RETAIL_PREFIXES as COMMERCE_RETAIL_PREFIXES };
