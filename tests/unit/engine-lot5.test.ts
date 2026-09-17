import { describe, expect, it } from 'vitest';
import { explainMatch, isEligible, type MatchingPreferences, type OpportunityCandidate } from '../../packages/core/src/allocation/fit';
import { withinCaps, industryFamily, relaxCaps, RELAXATION_STEPS } from '../../packages/core/src/allocation/engine';
import { shouldRescan } from '../../packages/core/src/allocation/verify';
import { intentOf, scoreOpportunity, type ScoringInput, type ScoringSignal } from '../../packages/core/src/opportunities/scoring';
import { ruleFor } from '../../packages/core/src/opportunities/rules';
import { normalizeTechnology, technologyMatches } from '../../packages/core/src/normalization/technology';

/**
 * Lot 5 : un matching qui s'explique, des lots qui ne se répètent pas, une
 * vérification qui ne revisite pas un site scanné cette nuit, et une
 * intention qui monte quand plusieurs faits datés convergent.
 */

const candidate = (over: Partial<OpportunityCandidate> = {}): OpportunityCandidate => ({
  opportunityType: 'website_redesign', baseScore: 80, confidenceScore: 0.9,
  city: 'Angers', region: 'Pays de la Loire', industryCode: '56.10A',
  cms: null, triggerType: null, triggerOccurredAt: null, createdAt: null, ...over,
});
const prefs = (over: Partial<MatchingPreferences> = {}): MatchingPreferences => ({
  services: [], technologies: [], locationMode: 'france_remote', city: null, region: null,
  preferredIndustries: [], excludedIndustries: [], ...over,
});

describe('technologies : une clé, pas un nom', () => {
  it('normalise ce que le scanner nomme', () => {
    expect(normalizeTechnology('PrestaShop')).toBe('prestashop');
    expect(normalizeTechnology('Next.js')).toBe('nextjs');
    expect(normalizeTechnology('IONOS MyWebsite')).toBe('ionos');
    expect(normalizeTechnology('')).toBeNull();
  });
  it('WooCommerce est du WordPress', () => {
    expect(technologyMatches('WooCommerce', ['wordpress'])).toBe(true);
    expect(technologyMatches('Shopify', ['wordpress'])).toBe(false);
    expect(technologyMatches('WordPress', [])).toBe(false);
  });
});

describe('matching V2 : explicable', () => {
  it('un spécialiste WordPress voit un site WordPress passer devant, sans écarter un site Wix', () => {
    const p = prefs({ technologies: ['wordpress'] });
    const wp = explainMatch(candidate({ cms: 'WordPress' }), p);
    const wix = explainMatch(candidate({ cms: 'Wix' }), p);
    const none = explainMatch(candidate({ cms: null }), p);
    expect(wp.technology).toBe(100);
    expect(wix.technology).toBe(40);
    expect(none.technology).toBe(60);
    expect(wp.match).toBeGreaterThan(wix.match);
    expect(isEligible(candidate({ cms: 'Wix' }), p)).toBe(true);
  });
  it('sans préférence technologique, la technologie ne compte ni pour ni contre', () => {
    expect(explainMatch(candidate({ cms: 'WordPress' }), prefs()).technology).toBe(60);
  });
  it('un fait daté récent est plus frais qu’un fait ancien, et qu’un diagnostic qui traîne', () => {
    const now = Date.parse('2026-09-17T08:00:00Z');
    const fresh = explainMatch(candidate({ triggerType: 'website_went_down', triggerOccurredAt: '2026-09-16T00:00:00Z' }), prefs(), now);
    const old = explainMatch(candidate({ triggerType: 'website_went_down', triggerOccurredAt: '2026-08-01T00:00:00Z' }), prefs(), now);
    const staleDiag = explainMatch(candidate({ createdAt: '2026-06-01T00:00:00Z' }), prefs(), now);
    const newDiag = explainMatch(candidate({ createdAt: '2026-09-16T00:00:00Z' }), prefs(), now);
    expect(fresh.freshness).toBeGreaterThan(old.freshness);
    expect(newDiag.freshness).toBeGreaterThan(staleDiag.freshness);
    expect(fresh.freshness).toBeGreaterThan(newDiag.freshness);
  });
  it('la décomposition porte chaque composante et les poids', () => {
    const e = explainMatch(candidate(), prefs({ city: 'Angers' }));
    expect(e.geo).toBe(100);
    expect(e.weights.geo + e.weights.technology + e.weights.industry + e.weights.freshness + e.weights.quality).toBeCloseTo(1);
    expect(e.match).toBeCloseTo(0.7 * e.base + 0.3 * e.fit, 1);
  });
});

describe('lots variés', () => {
  const caps = { perTheme: 2, perType: 3, perIndustry: 2 };
  const counts = () => ({ theme: new Map<string, number>(), type: new Map<string, number>(), industry: new Map<string, number>() });
  it('refuse un troisième restaurant, un quatrième du même type, un troisième du même thème', () => {
    const c = counts();
    c.industry.set('56', 2);
    expect(withinCaps({ theme: 'x', opportunityType: 'website_creation', industryCode: '56.10A' }, c, caps)).toBe(false);
    expect(withinCaps({ theme: 'x', opportunityType: 'website_creation', industryCode: '47.71Z' }, c, caps)).toBe(true);
    c.type.set('website_creation', 3);
    expect(withinCaps({ theme: 'x', opportunityType: 'website_creation', industryCode: '47.71Z' }, c, caps)).toBe(false);
    c.theme.set('certificate_expired', 2);
    expect(withinCaps({ theme: 'certificate_expired', opportunityType: 'maintenance', industryCode: '47.71Z' }, c, caps)).toBe(false);
  });
  it('les plafonds se desserrent par paliers : tels quels, doublés, levés', () => {
    expect(RELAXATION_STEPS).toEqual([1, 2, Number.POSITIVE_INFINITY]);
    expect(relaxCaps(caps, 2)).toEqual({ perTheme: 4, perType: 6, perIndustry: 4 });
    const c = counts(); c.type.set('website_redesign', 5);
    expect(withinCaps({ theme: 'x', opportunityType: 'website_redesign', industryCode: null }, c, relaxCaps(caps, 2))).toBe(true);
    expect(withinCaps({ theme: 'x', opportunityType: 'website_redesign', industryCode: null }, c, relaxCaps(caps, Number.POSITIVE_INFINITY))).toBe(true);
  });
  it('un secteur inconnu n’est jamais plafonné', () => {
    const c = counts(); c.industry.set('??', 5);
    expect(withinCaps({ theme: 'x', opportunityType: 'seo', industryCode: null }, c, caps)).toBe(true);
  });
  it('le secteur est la division NAF', () => {
    expect(industryFamily('56.10A')).toBe('56');
    expect(industryFamily(null)).toBe('??');
  });
});

describe('vérification avant livraison : réutiliser un scan récent', () => {
  const now = Date.parse('2026-09-17T08:00:00Z');
  it('ne revisite pas un site scanné cette nuit', () => {
    expect(shouldRescan('2026-09-17T02:00:00Z', 36, now)).toBe(false);
  });
  it('revisite un site scanné il y a trois jours, ou jamais', () => {
    expect(shouldRescan('2026-09-14T02:00:00Z', 36, now)).toBe(true);
    expect(shouldRescan(null, 36, now)).toBe(true);
  });
});

describe('intention croisée', () => {
  const now = Date.parse('2026-09-17T08:00:00Z');
  const trig = (signalType: string, occurredAt: string, strength = 0.8): ScoringSignal => ({
    signalType, kind: 'trigger', category: 'timing', strength, confidence: 0.9, occurredAt, triggerEventId: `e-${signalType}`,
  });
  it('deux familles récentes se renforcent, deux avis de la même famille non', () => {
    const two = intentOf([trig('company_recently_created', '2026-09-01T00:00:00Z'), trig('domain_recently_registered', '2026-09-05T00:00:00Z')], now);
    expect(two.families.sort()).toEqual(['company', 'domain']);
    expect(two.multiplier).toBe(1.12);
    const same = intentOf([trig('bodacc_creation', '2026-09-01T00:00:00Z'), trig('company_recently_created', '2026-09-02T00:00:00Z')], now);
    expect(same.multiplier).toBe(1);
  });
  it('un fait trop ancien ne compte pas', () => {
    const r = intentOf([trig('company_recently_created', '2026-05-01T00:00:00Z'), trig('domain_recently_registered', '2026-09-05T00:00:00Z')], now);
    expect(r.multiplier).toBe(1);
  });
  it('le score de base monte avec l’intention et le tracé le dit', () => {
    const rule = ruleFor('website_creation')!;
    const base = (signals: ScoringSignal[]): ScoringInput => ({
      companyId: 'c1', identityConfidence: 0.95, websiteStatus: 'placeholder', now, signals,
    } as ScoringInput);
    const need: ScoringSignal[] = [
      { signalType: 'website_placeholder', kind: 'modifier', category: 'need', strength: 0.9, confidence: 0.9, occurredAt: null, triggerEventId: null },
    ];
    const one = scoreOpportunity(rule, base([...need, trig('domain_recently_registered', '2026-09-05T00:00:00Z')]))!;
    const two = scoreOpportunity(rule, base([...need, trig('domain_recently_registered', '2026-09-05T00:00:00Z'), trig('company_recently_created', '2026-09-01T00:00:00Z', 0.7)]))!;
    expect(two.baseScore).toBeGreaterThan(one.baseScore);
    expect((two.reason['intent'] as { multiplier: number }).multiplier).toBe(1.12);
  });
});

describe('maintenance : un site tombé hier', () => {
  it('un site tombé récemment suffit à porter une maintenance', () => {
    const rule = ruleFor('maintenance')!;
    const r = scoreOpportunity(rule, {
      companyId: 'c1', identityConfidence: 0.95, websiteStatus: 'broken', now: Date.now(),
      signals: [{ signalType: 'website_went_down', kind: 'trigger', category: 'timing', strength: 0.9, confidence: 0.9, occurredAt: new Date(Date.now() - 86_400_000).toISOString(), triggerEventId: 'e1' }],
    } as ScoringInput);
    expect(r).not.toBeNull();
  });
});
