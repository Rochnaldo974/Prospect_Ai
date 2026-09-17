import { describe, expect, it } from 'vitest';
import { detectTechnologies, deepDetector } from '../../packages/core/src/enrichment/technology-detector';
import { readPerformanceFacts, isPerformanceSuspect, extractAssetUrls, summarizeAssets, auditPerformance } from '../../packages/core/src/enrichment/performance-audit';
import { detectChanges } from '../../packages/core/src/enrichment/domain-scanner';
import { heavyPageDetector, slowTtfbDetector, unstableWebsiteDetector, renderBlockingDetector } from '../../packages/core/src/signals/detectors/performance';
import { scoreOpportunity, type ScoringInput, type ScoringSignal } from '../../packages/core/src/opportunities/scoring';
import { ruleFor, familyOf } from '../../packages/core/src/opportunities/rules';
import { buildEvidence, explainOpportunity } from '../../packages/core/src/opportunities/explain';
import type { CompanyContext } from '../../packages/core/src/signals/types';

/**
 * Lot 6 : des technologies avec leur version, la performance comme octets et
 * millisecondes, un historique de ce qui change, et des preuves structurées
 * derrière chaque phrase.
 */

describe('détection technologique approfondie', () => {
  it('lit la version de WordPress dans le generator et les fichiers du cœur', () => {
    const html = '<html><head><meta name="generator" content="WordPress 6.4.2"><script src="/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script></head></html>';
    const out = detectTechnologies(html, { technologies: ['WordPress', 'jQuery'], datedComponents: [] });
    const wp = out.find((t) => t.technology === 'wordpress')!;
    const jq = out.find((t) => t.technology === 'jquery')!;
    expect(wp.version).toBe('6.4.2');
    expect(wp.confidence).toBeGreaterThanOrEqual(0.95);
    expect(jq.version).toBe('3.7.1');
    expect(jq.source).toBe('deep_scan');
  });
  it('lit une version dans un chemin de bibliothèque, et garde le rapide sans version', () => {
    const html = '<link href="https://cdn.jsdelivr.net/npm/bootstrap/4.6.2/dist/css/bootstrap.min.css" rel="stylesheet">';
    const out = detectTechnologies(html, { technologies: ['Bootstrap', 'Cloudflare'], datedComponents: [] });
    expect(out.find((t) => t.technology === 'bootstrap')?.version).toBe('4.6.2');
    expect(out.find((t) => t.technology === 'cloudflare')?.version).toBeNull();
  });
  it('« Divi v4.18.0 » est divi en 4.18.0, pas « diviv »', () => {
    const out = deepDetector.detect('<meta name="generator" content="Divi v4.18.0">', { technologies: [], datedComponents: [] });
    expect(out).toEqual([{ technology: 'divi', version: '4.18.0', confidence: 0.95, source: 'deep_scan' }]);
  });
  it('le détecteur approfondi seul ne parle que de ce qu’il lit', () => {
    expect(deepDetector.detect('<html></html>', { technologies: ['Wix'], datedComponents: [] })).toEqual([]);
  });
});

describe('performance : faits rapides et présélection', () => {
  const html = `<html><head>${'<script src="/a.js"></script>'.repeat(6)}<script async src="/b.js"></script><link rel="stylesheet" href="/s.css"></head><body>${'<img src="/i.jpg">'.repeat(3)}<img src="/l.jpg" loading="lazy"><iframe></iframe></body></html>`;
  it('compte scripts, scripts bloquants, styles, images', () => {
    const f = readPerformanceFacts(html, { ttfbMs: 300, bytes: 12000 });
    expect(f.scriptCount).toBe(7);
    expect(f.renderBlockingScripts).toBe(6);
    expect(f.stylesheetCount).toBe(1);
    expect(f.imageCount).toBe(4);
    expect(f.lazyImages).toBe(1);
    expect(f.iframeCount).toBe(1);
  });
  it('désigne un suspect sur un seul seuil dépassé', () => {
    const f = readPerformanceFacts('<html></html>', { ttfbMs: 250, bytes: 5000 });
    expect(isPerformanceSuspect(f)).toBe(false);
    expect(isPerformanceSuspect({ ...f, ttfbMs: 1500 })).toBe(true);
    expect(isPerformanceSuspect(readPerformanceFacts(html, { ttfbMs: 250, bytes: 5000 }))).toBe(true);
  });
});

describe('performance : audit approfondi', () => {
  it('résout, dédoublonne et borne les ressources', () => {
    const html = '<script src="/app.js"></script><script src="/app.js"></script><link rel="stylesheet" href="css/x.css"><img src="data:image/png;base64,xx"><img src="https://cdn.example.com/a.jpg">';
    const assets = extractAssetUrls(html, 'https://example.fr/page/');
    expect(assets.map((a) => a.url)).toEqual(['https://example.fr/app.js', 'https://example.fr/page/css/x.css', 'https://cdn.example.com/a.jpg']);
  });
  it('résume les poids par famille et retient l’image la plus lourde', () => {
    const audit = summarizeAssets([
      { asset: { url: 'a.js', kind: 'js' }, bytes: 500_000 },
      { asset: { url: 'b.css', kind: 'css' }, bytes: 100_000 },
      { asset: { url: 'c.jpg', kind: 'image' }, bytes: 900_000 },
      { asset: { url: 'd.jpg', kind: 'image' }, bytes: 2_000_000 },
      { asset: { url: 'e.jpg', kind: 'image' }, bytes: null },
    ], '2026-09-17T05:00:00Z');
    expect(audit.totalBytes).toBe(3_500_000);
    expect(audit.jsBytes).toBe(500_000);
    expect(audit.largestImageUrl).toBe('d.jpg');
    expect(audit.assetsFailed).toBe(1);
  });
  it('audite les sites en attente sans réseau réel, et écrit le résultat', async () => {
    const writes: Record<string, unknown>[] = [];
    const db = {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: table === 'domains' ? [{ domain: 'lent.fr', final_url: 'https://lent.fr/' }] : [], error: null }) }) }) }) }),
        update: (patch: Record<string, unknown>) => ({ eq: async () => { writes.push(patch); return { error: null }; } }),
      }),
    } as never;
    const report = await auditPerformance(db, {
      fetchPage: async () => ({ html: '<script src="/big.js"></script><img src="/huge.jpg">', finalUrl: 'https://lent.fr/' }),
      measure: async (url) => (url.endsWith('.js') ? 1_200_000 : 2_500_000),
    });
    expect(report).toEqual({ examined: 1, audited: 1, failed: 0 });
    expect(writes[0]!['performance_audit_status']).toBe('done');
    expect((writes[0]!['performance_audit'] as { jsBytes: number }).jsBytes).toBe(1_200_000);
  });
});

describe('ce qui change entre deux scans', () => {
  const scan = (over: Record<string, unknown> = {}) => ({
    domain: 'x.fr', status: 'reachable', fetch: { status: 200 }, contentChanged: false,
    analysis: { cms: 'WordPress', title: 'Accueil', technologies: ['WordPress'], phones: ['+33100000000'], emails: [], ecommerceDetected: false, commerce: { platform: null } },
    ...over,
  }) as never;
  it('site revenu en ligne, site disparu', () => {
    expect(detectChanges({ domain: 'x.fr', content_hash: 'h', check_attempts: 2, tech_year: null, status: 'unreachable' }, scan()).map((c) => c.kind)).toEqual(['site_came_back_online']);
    expect(detectChanges({ domain: 'x.fr', content_hash: 'h', check_attempts: 0, tech_year: null, status: 'reachable', phones_found: ['+33100000000'], emails_found: [] }, scan({ status: 'broken', analysis: null })).map((c) => c.kind)).toEqual(['site_disappeared']);
  });
  it('technologie changée, vente en ligne apparue, contact changé', () => {
    const kinds = detectChanges({ domain: 'x.fr', content_hash: 'h', check_attempts: 0, tech_year: null, status: 'reachable', cms: 'Wix', ecommerce_detected: false, phones_found: [], emails_found: [], title: 'Accueil', tech_hash: 'WordPress' },
      scan({ analysis: { cms: 'WordPress', title: 'Accueil', technologies: ['WordPress'], phones: ['+33100000000'], emails: [], ecommerceDetected: true, commerce: { platform: 'woocommerce' } } })).map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(['technology_changed', 'new_ecommerce', 'contact_changed']));
  });
  it('quelques caractères changés ne font pas une refonte ; un nouveau titre et une nouvelle pile, si', () => {
    const prev = { domain: 'x.fr', content_hash: 'h', check_attempts: 0, tech_year: null, status: 'reachable', cms: 'WordPress', ecommerce_detected: false, phones_found: ['+33100000000'], emails_found: [], title: 'Accueil', tech_hash: 'WordPress' };
    expect(detectChanges(prev, scan({ contentChanged: true })).map((c) => c.kind)).not.toContain('major_redesign');
    expect(detectChanges(prev, scan({ contentChanged: true, analysis: { cms: 'Webflow', title: 'Bienvenue', technologies: ['Webflow'], phones: ['+33100000000'], emails: [], ecommerceDetected: false, commerce: { platform: null } } })).map((c) => c.kind)).toContain('major_redesign');
  });
});

describe('signaux de performance et maintenance diagnostique', () => {
  const ctx = (domain: Record<string, unknown>, events: { event_type: string; occurred_at: string }[] = []): CompanyContext =>
    ({ company: {} as CompanyContext['company'], domain: { status: 'reachable', ...domain } as unknown as CompanyContext['domain'], domainCompanyCount: 1, events: events as CompanyContext['events'] });
  it('un serveur à 2,4 s, six scripts bloquants, une page de 5 Mo', () => {
    expect(slowTtfbDetector.detect(ctx({ performance_facts: { ttfbMs: 2400, renderBlockingScripts: 0, scriptCount: 3 } }))[0]?.strength).toBeCloseTo(0.88, 1);
    expect(renderBlockingDetector.detect(ctx({ performance_facts: { ttfbMs: 200, renderBlockingScripts: 6, scriptCount: 8 } }))).toHaveLength(1);
    expect(heavyPageDetector.detect(ctx({ performance_audit: { totalBytes: 5_000_000, assetsSampled: 10 } }))[0]?.signalType).toBe('heavy_page');
    expect(slowTtfbDetector.detect(ctx({ performance_facts: { ttfbMs: 300 } }))).toEqual([]);
  });
  it('un site tombé deux fois en trois mois est instable', () => {
    const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    expect(unstableWebsiteDetector.detect(ctx({}, [{ event_type: 'website_went_down', occurred_at: d(10) }, { event_type: 'website_went_down', occurred_at: d(40) }]))).toHaveLength(1);
    expect(unstableWebsiteDetector.detect(ctx({}, [{ event_type: 'website_went_down', occurred_at: d(10) }]))).toEqual([]);
  });
  it('trois constats de performance font une maintenance sans fait daté, un seul non', () => {
    const rule = ruleFor('maintenance')!;
    const sig = (signalType: string, strength = 0.9): ScoringSignal => ({ signalType, kind: 'modifier', category: 'need', strength, confidence: 0.9, occurredAt: null, triggerEventId: null });
    const input = (signals: ScoringSignal[]): ScoringInput => ({ companyId: 'c', identityConfidence: 0.95, websiteStatus: 'reachable', now: Date.now(), signals } as ScoringInput);
    const three = scoreOpportunity(rule, input([sig('slow_ttfb'), sig('heavy_page'), sig('large_images')]))!;
    expect(three).not.toBeNull();
    expect(three.reason['family']).toBe('performance');
    expect(scoreOpportunity(rule, input([sig('slow_ttfb')]))).toBeNull();
  });
  it('les familles nomment ce qui se vend derrière', () => {
    expect(familyOf('heavy_scripts')).toBe('performance');
    expect(familyOf('invalid_certificate')).toBe('security');
    expect(familyOf('inconnu')).toBe('other');
  });
});

describe('preuves structurées', () => {
  it('chaque preuve porte une valeur, la date du scan et l’adresse', () => {
    const evidence = buildEvidence({
      opportunityType: 'maintenance', companyName: 'X', city: null, industryLabel: null, triggerType: null, triggerOccurredAt: null,
      needSignals: [{ signal: 'slow_ttfb', points: 36 }, { signal: 'heavy_page', points: 36 }],
      facts: { domain: 'lent.fr', observedAt: '2026-09-17T02:00:00Z', performance: { ttfbMs: 2400, htmlBytes: 700_000 }, performanceAudit: { totalBytes: 4_200_000 } },
      confidenceScore: 0.9,
    }, ['slow_ttfb', 'heavy_page']);
    expect(evidence).toEqual([
      { fact: 'Temps avant la première réponse du serveur', value: '2,4 s', observedAt: '2026-09-17T02:00:00Z', sourceUrl: 'https://lent.fr/' },
      { fact: 'Poids de la page d’accueil', value: '4,2 Mo', observedAt: '2026-09-17T02:00:00Z', sourceUrl: 'https://lent.fr/' },
    ]);
  });
  it('l’explication complète expose les preuves, jamais inventées', () => {
    const e = explainOpportunity({
      opportunityType: 'website_redesign', companyName: 'Boulangerie Martin', city: 'Angers', industryLabel: 'Boulangerie', triggerType: null, triggerOccurredAt: null,
      needSignals: [{ signal: 'not_responsive', points: 40 }, { signal: 'outdated_stack', points: 30 }, { signal: 'stale_content', points: 20 }],
      facts: { domain: 'martin.fr', observedAt: '2026-09-17T02:00:00Z', datedComponents: [{ name: 'jQuery', version: '1.8', year: 2012 }], copyrightYear: 2016 },
      confidenceScore: 0.9,
    });
    expect(e.evidence.map((x) => x.fact)).toEqual(expect.arrayContaining(['Adaptation au mobile', 'Composant le plus ancien', 'Année affichée en bas de page']));
    expect(e.evidence.every((x) => x.sourceUrl === 'https://martin.fr/')).toBe(true);
  });
});
