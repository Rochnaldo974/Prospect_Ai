import { describe, expect, it } from 'vitest';
import { isEligible, type MatchingPreferences, type OpportunityCandidate } from '../../packages/core/src/allocation/fit';
import { opportunityFingerprint } from '../../packages/core/src/opportunities/engine';
import { scoreAll, scoreOpportunity, type ScoringInput, type ScoringSignal } from '../../packages/core/src/opportunities/scoring';
import { ruleFor } from '../../packages/core/src/opportunities/rules';
import { contactReadiness } from '../../packages/core/src/contacts/readiness';
import { FLAG_DEFAULTS } from '../../packages/core/src/ops/flags';

/**
 * Les contrats de la spec (phase 51) qui se vérifient sans base, réunis en
 * un endroit : téléphone, e-mail et dédoublonnage vivent déjà dans
 * contacts.test.ts et normalization.test.ts ; SEO et e-commerce dans
 * engine-lot4 ; ici, ce qui manquait.
 */

const candidate = (over: Partial<OpportunityCandidate> = {}): OpportunityCandidate => ({
  opportunityType: 'website_creation', baseScore: 80, confidenceScore: 0.9, city: 'Angers', region: 'Pays de la Loire', industryCode: '56.10A',
  cms: null, triggerType: null, triggerOccurredAt: null, createdAt: null, ...over,
});
const prefs = (over: Partial<MatchingPreferences> = {}): MatchingPreferences => ({
  services: [], technologies: [], locationMode: 'france_remote', city: null, region: null, preferredIndustries: [], excludedIndustries: [], excludeAssociations: false, ...over,
});
const sig = (over: Partial<ScoringSignal>): ScoringSignal => ({ signalType: 'x', kind: 'modifier', category: 'need', strength: 0.9, confidence: 0.9, occurredAt: null, triggerEventId: null, ...over });
const input = (signals: ScoringSignal[], over: Partial<ScoringInput> = {}): ScoringInput => ({ companyId: 'c', identityConfidence: 0.95, websiteStatus: null, now: Date.now(), signals, ...over } as ScoringInput);

describe('MOBILE ONLY USER', () => {
  it('un freelance mobile ne reçoit jamais une création de site', () => {
    expect(isEligible(candidate({ opportunityType: 'website_creation' }), prefs({ services: ['mobile_application'] }))).toBe(false);
    expect(isEligible(candidate({ opportunityType: 'mobile_application' }), prefs({ services: ['mobile_application'] }))).toBe(true);
  });
});

describe('BODACC : événement + entreprise + téléphone résolu → candidate', () => {
  it('une immatriculation récente avec une preuve d’absence de site fait une création, et le téléphone la rend PHONE_READY', () => {
    const rule = ruleFor('website_creation')!;
    const r = scoreOpportunity(rule, input([
      sig({ signalType: 'company_recently_created', kind: 'trigger', category: 'timing', strength: 0.9, occurredAt: new Date(Date.now() - 20 * 86_400_000).toISOString(), triggerEventId: 'bodacc-1' }),
      sig({ signalType: 'no_website_proven', strength: 0.95 }),
      sig({ signalType: 'active_business', category: 'quality', strength: 1 }),
    ]));
    expect(r).not.toBeNull();
    const readiness = contactReadiness({ phone: '+33241000000', bestEmail: null, contactFormUrl: null } as never);
    expect(readiness.phoneReady).toBe(true);
  });
});

describe('OPPORTUNITY FINGERPRINT', () => {
  const base = { type: 'website_redesign', baseScore: 70, reason: { need_breakdown: [{ signal: 'outdated_stack', points: 35 }, { signal: 'not_responsive', points: 40 }] } };
  it('mêmes faits → même opportunité ; un nouvel événement légitime → une nouvelle', () => {
    const a = opportunityFingerprint('c1', { ...base, triggerEventId: null } as never);
    const b = opportunityFingerprint('c1', { ...base, triggerEventId: null } as never);
    expect(a).toBe(b);
    const later = opportunityFingerprint('c1', { ...base, triggerEventId: 'website_went_down:2026-10-02', reason: { ...base.reason, trigger_occurred_at: '2026-10-02T00:00:00Z' } } as never);
    expect(later).not.toBe(a);
  });
});

describe('FEATURE FLAGS', () => {
  it('le payant est coupé par défaut, le reste ouvert', () => {
    expect(FLAG_DEFAULTS.enable_commercial_enrichment).toBe(false);
    expect(Object.entries(FLAG_DEFAULTS).filter(([k, v]) => k !== 'enable_commercial_enrichment' && !v)).toEqual([]);
  });
  it('une règle coupée ne produit plus, une famille de signaux coupée ne pèse plus', () => {
    const seo = [sig({ signalType: 'missing_title', strength: 1 }), sig({ signalType: 'missing_meta_description', strength: 0.8 }), sig({ signalType: 'thin_content', strength: 0.8 })];
    expect(scoreAll(input(seo, { websiteStatus: 'reachable' })).some((o) => o.type === 'seo')).toBe(true);
    expect(scoreAll(input(seo, { websiteStatus: 'reachable', disabledTypes: ['seo'] })).some((o) => o.type === 'seo')).toBe(false);
    const perf = [sig({ signalType: 'slow_ttfb' }), sig({ signalType: 'heavy_page' }), sig({ signalType: 'large_images' })];
    expect(scoreAll(input(perf, { websiteStatus: 'reachable' })).some((o) => o.type === 'maintenance')).toBe(true);
    expect(scoreAll(input(perf, { websiteStatus: 'reachable', disabledSignals: ['slow_ttfb', 'heavy_page', 'large_images'] })).some((o) => o.type === 'maintenance')).toBe(false);
  });
});
