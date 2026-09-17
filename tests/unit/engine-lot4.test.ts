import { describe, expect, it } from 'vitest';
import { scoreOpportunity, type ScoringInput, type ScoringSignal } from '../../packages/core/src/opportunities/scoring';
import { ruleFor } from '../../packages/core/src/opportunities/rules';
import { opportunityFingerprint } from '../../packages/core/src/opportunities/engine';
import { evaluateHealth, type HealthSnapshot } from '../../packages/core/src/ops/health';
import { readCommerceFacts, readSeoFacts } from '../../packages/core/src/enrichment/page-analysis';
import { catalogWithoutCartDetector, seoGapsDetector } from '../../packages/core/src/signals/detectors/seo-commerce';
import type { CompanyContext } from '../../packages/core/src/signals/types';

/**
 * Lot 4 : le SEO et le commerce en ligne comme faits mesurés, jamais comme
 * notes ; une empreinte par opportunité ; des alertes quand le moteur
 * s'arrête de produire.
 */

const signal = (over: Partial<ScoringSignal> = {}): ScoringSignal => ({
  signalType: 'missing_title', kind: 'modifier', category: 'need', strength: 0.9, confidence: 0.9,
  occurredAt: null, triggerEventId: null, ...over,
} as ScoringSignal);

const input = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  companyId: 'c1', identityConfidence: 0.95, websiteStatus: 'reachable', signals: [], now: new Date(), ...over,
} as ScoringInput);

describe('SEO : des faits comptés', () => {
  it('lit ce que la page montre : titre, description, H1, images sans alt, longueur', () => {
    const html = '<html><head><title>Bijouterie Martin</title></head><body><h1>Bienvenue</h1><img src="a.jpg"><img src="b.jpg" alt="bague"><img src="c.jpg"><img src="d.jpg"></body></html>';
    const facts = readSeoFacts(html, 'Bienvenue chez nous', 'Bijouterie Martin', null);
    expect(facts.hasTitle).toBe(true);
    expect(facts.hasMetaDescription).toBe(false);
    expect(facts.h1Count).toBe(1);
    expect(facts.imagesTotal).toBe(4);
    expect(facts.imagesWithoutAlt).toBe(3);
    expect(facts.hasJsonLd).toBe(false);
  });

  it('un seul manque mineur ne fait pas une opportunité', () => {
    const rule = ruleFor('seo')!;
    const r = scoreOpportunity(rule, input({ signals: [signal({ signalType: 'no_canonical', strength: 0.4 })] }));
    expect(r).toBeNull();
  });

  it('plusieurs manques forts font une opportunité diagnostique', () => {
    const rule = ruleFor('seo')!;
    const r = scoreOpportunity(rule, input({ signals: [
      signal({ signalType: 'missing_title', strength: 1 }),
      signal({ signalType: 'missing_meta_description', strength: 0.8 }),
      signal({ signalType: 'images_without_alt', strength: 0.7 }),
      signal({ signalType: 'thin_content', strength: 0.8 }),
    ] }));
    expect(r).not.toBeNull();
    expect(r!.triggerEventId).toBeNull();
  });

  it('le détecteur ne parle que d’un site joignable', () => {
    const ctx = (domain: CompanyContext['domain']) => ({ company: {} as CompanyContext['company'], domain, domainCompanyCount: 1, events: [] });
    expect(seoGapsDetector.detect(ctx({ status: 'unreachable', seo_facts: { hasTitle: false } } as unknown as CompanyContext['domain']))).toEqual([]);
    const out = seoGapsDetector.detect(ctx({ status: 'reachable', seo_facts: { hasTitle: false, hasMetaDescription: true, h1Count: 1, wordCount: 800 } } as unknown as CompanyContext['domain']));
    expect(out.map((s) => s.signalType)).toEqual(['missing_title']);
  });
});

describe('e-commerce : un catalogue sans panier', () => {
  it('reconnaît un catalogue avec des prix mais sans vente', () => {
    const html = '<html><body><h2>Nos produits</h2><p>Bague or 250 € — Collier 120,00 € — Bracelet 80 € — Montre 300 € — Boucles 45 €</p></body></html>';
    const facts = readCommerceFacts(html, 'Nos produits Bague or 250 € Collier 120,00 € Bracelet 80 € Montre 300 € Boucles 45 €');
    expect(facts.catalog).toBe(true);
    expect(facts.cart).toBe(false);
  });

  it('le détecteur émet catalog_without_cart, et la règle en fait un candidat', () => {
    const ctx = { company: {} as CompanyContext['company'], domain: { status: 'reachable', commerce_facts: { catalog: true, cart: false, platform: null } } as unknown as CompanyContext['domain'], domainCompanyCount: 1, events: [] };
    const out = catalogWithoutCartDetector.detect(ctx);
    expect(out).toHaveLength(1);
    const rule = ruleFor('ecommerce')!;
    const r = scoreOpportunity(rule, input({ signals: [
      signal({ signalType: 'catalog_without_cart', strength: 0.9 }),
      signal({ signalType: 'dated_platform', strength: 0.7 }),
    ] }));
    expect(r).not.toBeNull();
  });

  it('une boutique qui vend déjà n’est pas un catalogue sans panier', () => {
    const ctx = { company: {} as CompanyContext['company'], domain: { status: 'reachable', commerce_facts: { catalog: true, cart: true, platform: 'shopify' } } as unknown as CompanyContext['domain'], domainCompanyCount: 1, events: [] };
    expect(catalogWithoutCartDetector.detect(ctx)).toEqual([]);
  });
});

describe('empreinte d’opportunité', () => {
  const base = { type: 'seo', triggerEventId: null, baseScore: 60, reason: { need_breakdown: [{ signal: 'missing_title', points: 40 }, { signal: 'no_canonical', points: 6 }] } };
  it('mêmes faits majeurs, même empreinte ; un fait mineur en plus ne la change pas', () => {
    const a = opportunityFingerprint('c1', base as never);
    const b = opportunityFingerprint('c1', { ...base, reason: { need_breakdown: [{ signal: 'missing_title', points: 40 }] } } as never);
    expect(a).toBe(b);
  });
  it('un autre fait majeur ou un autre type change l’empreinte', () => {
    const a = opportunityFingerprint('c1', base as never);
    const b = opportunityFingerprint('c1', { ...base, reason: { need_breakdown: [{ signal: 'thin_content', points: 35 }] } } as never);
    const c = opportunityFingerprint('c1', { ...base, type: 'website_redesign' } as never);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
  it('un fait daté est ancré sur son événement et son mois', () => {
    const a = opportunityFingerprint('c1', { ...base, triggerEventId: 'e1', reason: { trigger_occurred_at: '2026-09-02T00:00:00Z' } } as never);
    const b = opportunityFingerprint('c1', { ...base, triggerEventId: 'e2', reason: { trigger_occurred_at: '2026-09-02T00:00:00Z' } } as never);
    expect(a).not.toBe(b);
    expect(a.endsWith('2026-09')).toBe(true);
  });
});

describe('santé du moteur', () => {
  const healthy: HealthSnapshot = {
    discoveredToday: 120, discoveredYesterday: 140, scannedToday: 800, scanSuccessRate: 0.8,
    phoneReadyToday: 60, phoneReady7dAverage: 55, outreachReadyToday: 9, outreachReadyYesterday: 8,
    queuePending: 3, queueOldestPendingMinutes: 12, queueFailed24h: 1,
    lastSuccessHours: { sync_bodacc: 5, plan_discovery: 10 }, hourUtc: 10,
  };
  it('rien à dire quand tout tourne', () => {
    expect(evaluateHealth(healthy)).toEqual([]);
  });
  it('découverte à zéro deux jours de suite, après la nuit', () => {
    const kinds = evaluateHealth({ ...healthy, discoveredToday: 0, discoveredYesterday: 0 }).map((a) => a.kind);
    expect(kinds).toContain('discovery_zero');
    expect(evaluateHealth({ ...healthy, discoveredToday: 0, discoveredYesterday: 0, hourUtc: 3 })).toEqual([]);
  });
  it('production PHONE_READY en chute, file bloquée, synchronisation manquée', () => {
    const alerts = evaluateHealth({ ...healthy, phoneReadyToday: 2, queueOldestPendingMinutes: 400, lastSuccessHours: { sync_bodacc: 50 } });
    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(['phone_ready_drop', 'queue_stalled', 'sync_missed:sync_bodacc']));
    expect(alerts.find((a) => a.kind === 'phone_ready_drop')!.severity).toBe('critical');
  });
});
