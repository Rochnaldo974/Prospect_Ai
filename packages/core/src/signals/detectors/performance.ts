import type { DetectedSignal, SignalDetector } from '../types';
import type { PerformanceAudit, PerformanceFacts } from '../../enrichment/performance-audit';

/**
 * La performance comme faits mesurés.
 *
 * Aucun de ces signaux ne juge : ils comptent des millisecondes, des octets,
 * des scripts. « Site lent » ne se vérifie pas ; « 2,4 secondes avant le
 * premier octet » se vérifie avec n'importe quel navigateur.
 */

const need = (type: string, strength: number, confidence: number, evidence: Record<string, string | number | null>): DetectedSignal => ({
  signalType: type, kind: 'modifier', category: 'need', strength: Math.max(0, Math.min(1, strength)), confidence, evidence, fingerprint: type,
});

function factsOf(domain: { status: string; performance_facts?: unknown } | null): PerformanceFacts | null {
  if (!domain || domain.status !== 'reachable' || !domain.performance_facts || typeof domain.performance_facts !== 'object') return null;
  return domain.performance_facts as PerformanceFacts;
}
function auditOf(domain: { status: string; performance_audit?: unknown } | null): PerformanceAudit | null {
  if (!domain || domain.status !== 'reachable' || !domain.performance_audit || typeof domain.performance_audit !== 'object') return null;
  return domain.performance_audit as PerformanceAudit;
}

/** Temps de première réponse élevé : le serveur lui-même est lent. */
export const slowTtfbDetector: SignalDetector = {
  id: 'slow_ttfb',
  describes: 'Serveur lent à répondre (temps avant le premier octet)',
  detect({ domain }) {
    const facts = factsOf(domain);
    if (!facts || facts.ttfbMs === null || facts.ttfbMs < 1200) return [];
    return [need('slow_ttfb', 0.4 + (facts.ttfbMs - 1200) / 2500, 0.8, { ttfb_ms: facts.ttfbMs })];
  },
};

/** Scripts dans l'en-tête sans async ni defer : la page attend chacun. */
export const renderBlockingDetector: SignalDetector = {
  id: 'render_blocking_scripts',
  describes: 'Scripts qui bloquent l’affichage de la page',
  detect({ domain }) {
    const facts = factsOf(domain);
    if (!facts || facts.renderBlockingScripts < 5) return [];
    return [need('render_blocking_scripts', 0.5 + (facts.renderBlockingScripts - 5) / 10, 0.9, { blocking_scripts: facts.renderBlockingScripts, scripts: facts.scriptCount })];
  },
};

/** Page lourde : HTML très gros, ou poids total mesuré à l'audit. */
export const heavyPageDetector: SignalDetector = {
  id: 'heavy_page',
  describes: 'Page d’accueil très lourde',
  detect({ domain }) {
    const facts = factsOf(domain);
    const audit = auditOf(domain);
    const total = audit?.totalBytes ?? 0;
    if (total >= 3_000_000) return [need('heavy_page', 0.5 + (total - 3_000_000) / 6_000_000, 0.9, { total_bytes: total, assets_sampled: audit?.assetsSampled ?? 0 })];
    if (facts && (facts.htmlBytes ?? 0) >= 600_000) return [need('heavy_page', 0.5, 0.8, { html_bytes: facts.htmlBytes })];
    return [];
  },
};

/** Beaucoup de JavaScript : par le poids audité, ou par le nombre de scripts. */
export const heavyScriptsDetector: SignalDetector = {
  id: 'heavy_scripts',
  describes: 'Beaucoup de JavaScript à charger',
  detect({ domain }) {
    const facts = factsOf(domain);
    const audit = auditOf(domain);
    if (audit && audit.jsBytes >= 800_000) return [need('heavy_scripts', 0.5 + (audit.jsBytes - 800_000) / 2_000_000, 0.9, { js_bytes: audit.jsBytes })];
    if (facts && facts.scriptCount >= 20) return [need('heavy_scripts', 0.4 + (facts.scriptCount - 20) / 40, 0.8, { scripts: facts.scriptCount })];
    return [];
  },
};

/** Images trop lourdes : la plus grosse, ou le total. */
export const largeImagesDetector: SignalDetector = {
  id: 'large_images',
  describes: 'Images non optimisées',
  detect({ domain }) {
    const audit = auditOf(domain);
    if (!audit) return [];
    if (audit.largestImageBytes >= 800_000 || audit.imageBytes >= 3_000_000) {
      return [need('large_images', 0.5 + Math.max(audit.largestImageBytes - 800_000, (audit.imageBytes - 3_000_000) / 2) / 2_500_000, 0.9,
        { largest_image_bytes: audit.largestImageBytes, largest_image_url: audit.largestImageUrl, image_bytes: audit.imageBytes })];
    }
    return [];
  },
};

/** Un site qui tombe et revient : l'hébergement n'est pas fiable. */
export const unstableWebsiteDetector: SignalDetector = {
  id: 'unstable_website',
  describes: 'Site tombé puis revenu en ligne récemment',
  detect({ domain, events }) {
    if (!domain || domain.status !== 'reachable') return [];
    const cutoff = Date.now() - 90 * 86_400_000;
    const downs = events.filter((e) => e.event_type === 'website_went_down' && new Date(e.occurred_at).getTime() > cutoff).length;
    const back = events.find((e) => e.event_type === 'website_came_back_online' && Date.now() - new Date(e.occurred_at).getTime() < 30 * 86_400_000);
    if (!back && downs < 2) return [];
    return [need('unstable_website', downs >= 2 ? 0.9 : 0.6, 0.85, { downtimes_90d: downs, came_back_at: back?.occurred_at ?? null })];
  },
};

export const PERFORMANCE_DETECTORS: SignalDetector[] = [
  slowTtfbDetector, renderBlockingDetector, heavyPageDetector, heavyScriptsDetector, largeImagesDetector, unstableWebsiteDetector,
];
