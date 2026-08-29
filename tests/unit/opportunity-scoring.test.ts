import { describe, expect, it } from 'vitest';
import {
  confidenceOf,
  freshnessOf,
  scoreAll,
  scoreOpportunity,
  type ScoringInput,
  type ScoringSignal,
} from '../../packages/core/src/opportunities/scoring';
import { ruleFor } from '../../packages/core/src/opportunities/rules';

/**
 * Scoring des opportunités.
 *
 * La propriété qui compte : fraîcheur et confiance sont des ATTÉNUATEURS
 * multiplicatifs. Une opportunité à fort besoin mais mal établie doit passer
 * derrière une opportunité moyenne et sûre — une somme pondérée ferait
 * l'inverse.
 */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const signal = (over: Partial<ScoringSignal> = {}): ScoringSignal => ({
  signalType: 'no_website_proven',
  kind: 'modifier',
  category: 'need',
  strength: 0.9,
  confidence: 0.9,
  occurredAt: null,
  triggerEventId: null,
  ...over,
});

const trigger = (over: Partial<ScoringSignal> = {}): ScoringSignal =>
  signal({
    signalType: 'bodacc_creation',
    kind: 'trigger',
    category: 'timing',
    strength: 0.9,
    confidence: 0.99,
    occurredAt: daysAgo(20),
    triggerEventId: 'evt-1',
    ...over,
  });

const input = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  signals: [],
  identityConfidence: 0.95,
  websiteStatus: null,
  ...over,
});

describe('fraîcheur', () => {
  it('décroît selon la demi-vie du type de fait', () => {
    // bodacc_creation : demi-vie 45 jours.
    expect(freshnessOf('bodacc_creation', daysAgo(0))).toBeCloseTo(1, 2);
    expect(freshnessOf('bodacc_creation', daysAgo(45))).toBeCloseTo(0.5, 2);
    expect(freshnessOf('bodacc_creation', daysAgo(90))).toBeCloseTo(0.25, 2);
  });

  it('vieillit beaucoup plus vite pour un site tombé', () => {
    // Un site tombé cesse d'être un motif dès qu'il est réparé : demi-vie 7 j.
    expect(freshnessOf('website_went_down', daysAgo(7))).toBeCloseTo(0.5, 2);
    expect(freshnessOf('website_went_down', daysAgo(30)))
      .toBeLessThan(freshnessOf('bodacc_cession', daysAgo(30)));
  });

  it('pénalise un fait sans date', () => {
    expect(freshnessOf('bodacc_creation', null)).toBe(0.3);
  });

  it('traite une date future comme une aberration, pas une aubaine', () => {
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    expect(freshnessOf('bodacc_creation', future)).toBe(0.5);
  });
});

describe('confiance', () => {
  it('est pondérée par la confiance d’identité', () => {
    const signals = [signal({ confidence: 0.9 })];
    expect(confidenceOf(signals, 0.95, [])).toBeCloseTo(0.855, 2);
    expect(confidenceOf(signals, 0.5, [])).toBeCloseTo(0.45, 2);
  });

  it('recule sous les signaux de risque', () => {
    const signals = [signal({ confidence: 0.9 })];
    const sans = confidenceOf(signals, 0.95, []);
    const avec = confidenceOf(signals, 0.95, [
      signal({ signalType: 'weak_identity', category: 'risk', strength: 1 }),
    ]);
    expect(avec).toBeLessThan(sans);
  });

  it('vaut zéro sans signal contributif', () => {
    expect(confidenceOf([], 0.95, [])).toBe(0);
  });
});

describe('conditions d’existence', () => {
  it('ne propose pas de refonte à une entreprise sans site', () => {
    const result = scoreOpportunity(ruleFor('website_redesign')!, input({
      websiteStatus: null,
      signals: [trigger(), signal({ signalType: 'dated_platform', strength: 1 })],
    }));
    // Ce n'est pas un score faible : c'est un contresens.
    expect(result).toBeNull();
  });

  it('ne propose pas de création à une entreprise qui a un site', () => {
    expect(scoreOpportunity(ruleFor('website_creation')!, input({
      websiteStatus: 'reachable',
      signals: [trigger(), signal()],
    }))).toBeNull();
  });

  it('interdit la refonte quand le site appartient au réseau', () => {
    const signals = [
      trigger({ signalType: 'bodacc_cession', strength: 0.9 }),
      signal({ signalType: 'dated_platform', strength: 1 }),
      signal({ signalType: 'shared_domain', category: 'risk', strength: 0.8 }),
    ];
    // Le gérant d'un point de vente n'a aucune prise sur le site de l'enseigne.
    expect(scoreOpportunity(ruleFor('website_redesign')!, input({ websiteStatus: 'reachable', signals })))
      .toBeNull();
  });

  it('exige un déclencheur daté', () => {
    // Un état, si marqué soit-il, ne justifie jamais un appel.
    expect(scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [signal({ strength: 1 }), signal({ signalType: 'active_business', strength: 1 })],
    }))).toBeNull();
  });

  it('exige un besoin au-dessus du plancher du type', () => {
    expect(scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [trigger(), signal({ signalType: 'active_business', strength: 0.5 })],
    }))).toBeNull();
  });
});

describe('atténuateurs multiplicatifs', () => {
  const strongNeed = [trigger(), signal({ strength: 1, confidence: 0.95 })];

  it('fait passer un fort besoin mal établi derrière un besoin moyen et sûr', () => {
    const fort = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: strongNeed,
      identityConfidence: 0.35,
    }))!;
    const moyen = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [trigger({ strength: 0.6 }), signal({ strength: 0.75, confidence: 0.95 })],
      identityConfidence: 0.98,
    }))!;

    expect(fort.needScore).toBeGreaterThan(moyen.needScore);
    // Et pourtant il passe derrière : c'est le comportement attendu.
    expect(fort.baseScore).toBeLessThan(moyen.baseScore);
  });

  it('fait reculer une opportunité qui vieillit', () => {
    const frais = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [trigger({ occurredAt: daysAgo(2) }), signal({ strength: 1 })],
    }))!;
    const vieux = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [trigger({ occurredAt: daysAgo(120) }), signal({ strength: 1 })],
    }))!;

    expect(frais.needScore).toBe(vieux.needScore);
    expect(frais.baseScore).toBeGreaterThan(vieux.baseScore * 2);
  });

  it('ne dépasse jamais 100', () => {
    const result = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [
        trigger({ strength: 1, occurredAt: daysAgo(0) }),
        signal({ strength: 1, confidence: 1 }),
        signal({ signalType: 'website_placeholder', strength: 1, confidence: 1 }),
        signal({ signalType: 'active_business', strength: 1, confidence: 1 }),
      ],
      identityConfidence: 1,
    }))!;
    expect(result.baseScore).toBeLessThanOrEqual(100);
    expect(result.needScore).toBeLessThanOrEqual(100);
  });
});

describe('décomposition auditable', () => {
  it('détaille chaque contribution au besoin', () => {
    const result = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [trigger(), signal({ strength: 0.8 })],
    }))!;

    const breakdown = result.reason['need_breakdown'] as { signal: string; points: number }[];
    expect(breakdown.some((b) => b.signal === 'no_website_proven')).toBe(true);
    expect(result.reason['formula']).toContain('fraîcheur');
    expect(result.reason['trigger']).toBe('bodacc_creation');
  });

  it('conserve le lien vers l’événement déclencheur', () => {
    const result = scoreOpportunity(ruleFor('website_creation')!, input({
      signals: [trigger({ triggerEventId: 'evt-42' }), signal()],
    }))!;
    expect(result.triggerEventId).toBe('evt-42');
  });
});

describe('évaluation de tous les types', () => {
  it('classe les opportunités du meilleur au moins bon', () => {
    const results = scoreAll(input({
      websiteStatus: 'reachable',
      signals: [
        trigger({ signalType: 'bodacc_cession', strength: 0.95, occurredAt: daysAgo(5) }),
        signal({ signalType: 'dated_platform', strength: 1 }),
        signal({ signalType: 'no_ssl', strength: 1 }),
        signal({ signalType: 'slow_website', strength: 0.9 }),
        signal({ signalType: 'retail_without_ecommerce', strength: 0.9, confidence: 0.5 }),
      ],
    }));

    expect(results.length).toBeGreaterThan(1);
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1]!.baseScore).toBeGreaterThanOrEqual(results[i]!.baseScore);
    }
  });

  it('ne renvoie rien quand aucun type ne tient', () => {
    expect(scoreAll(input({ signals: [signal({ signalType: 'active_business' })] }))).toEqual([]);
  });
});
