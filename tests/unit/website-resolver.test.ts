import { describe, expect, it } from 'vitest';
import {
  candidateDomains,
  MIN_ASSIGNMENT_CONFIDENCE,
  scoreMatch,
} from '../../packages/core/src/enrichment/website-resolver';

/**
 * Résolution de site.
 *
 * Le principe : on ne devine pas, on exige une preuve. Un site attribué à tort
 * envoie le freelance démarcher le mauvais interlocuteur — plus coûteux que
 * l'absence d'information.
 */
describe('candidats de domaine', () => {
  it('propose des formes plausibles à partir du nom', () => {
    const candidates = candidateDomains({
      legal_name: 'MOREAU SARL',
      commercial_name: 'Boulangerie Moreau',
    });
    expect(candidates).toContain('boulangeriemoreau.fr');
    expect(candidates).toContain('boulangerie-moreau.fr');
  });

  it('privilégie le nom commercial à la raison sociale', () => {
    const candidates = candidateDomains({
      legal_name: 'SARL DUPONT INVESTISSEMENTS',
      commercial_name: 'Le Fournil',
    });
    expect(candidates.some((c) => c.startsWith('fournil'))).toBe(true);
  });

  it('renonce quand le nom ne donne rien d’exploitable', () => {
    expect(candidateDomains({ legal_name: 'SARL', commercial_name: null })).toEqual([]);
    expect(candidateDomains({ legal_name: 'AB', commercial_name: null })).toEqual([]);
    expect(candidateDomains({
      legal_name: 'A'.repeat(200),
      commercial_name: null,
    })).toEqual([]);
  });

  it('reste peu nombreux : chaque candidat coûte une requête', () => {
    const candidates = candidateDomains({
      legal_name: 'BOULANGERIE PATISSERIE MOREAU ET FILS',
      commercial_name: null,
    });
    expect(candidates.length).toBeLessThanOrEqual(4);
  });
});

describe('preuve d’appartenance', () => {
  const company = {
    siren: '552100554',
    phone: '+33241222479',
    city: 'Angers',
    legal_name: 'MOREAU SARL',
    commercial_name: 'Boulangerie Moreau',
  };

  const page = (over: Partial<Parameters<typeof scoreMatch>[1]> = {}) => ({
    sirens: [],
    phones: [],
    title: null,
    text: '',
    ...over,
  });

  it('donne sa confiance maximale au SIREN des mentions légales', () => {
    const result = scoreMatch(company, page({ sirens: ['552100554'] }));
    expect(result.confidence).toBe(0.99);
    expect(result.evidence[0]?.kind).toBe('siren_legal');
  });

  it('accorde une forte confiance au téléphone', () => {
    const result = scoreMatch(company, page({ phones: ['+33241222479'] }));
    expect(result.confidence).toBe(0.92);
    expect(result.confidence).toBeGreaterThanOrEqual(MIN_ASSIGNMENT_CONFIDENCE);
  });

  it('n’attribue pas sur le nom et la ville seuls', () => {
    const result = scoreMatch(company, page({
      title: 'Boulangerie Moreau — Angers',
      text: 'Notre boulangerie à Angers vous accueille',
    }));
    // 0,70 : signalé, mais sous le seuil d'attribution.
    expect(result.confidence).toBe(0.7);
    expect(result.confidence).toBeLessThan(MIN_ASSIGNMENT_CONFIDENCE);
  });

  it('n’accorde presque rien au nom seul', () => {
    // « Boulangerie Martin » existe dans chaque ville de France.
    const result = scoreMatch(company, page({ text: 'Bienvenue chez Boulangerie Moreau' }));
    expect(result.confidence).toBe(0.45);
  });

  it('ne conclut rien sur une page sans rapport', () => {
    const result = scoreMatch(company, page({ title: 'Garage Dubois', text: 'Réparation auto' }));
    expect(result.confidence).toBe(0);
    expect(result.evidence).toEqual([]);
  });

  it('retient la preuve la plus forte quand plusieurs concordent', () => {
    const result = scoreMatch(company, page({
      sirens: ['552100554'],
      phones: ['+33241222479'],
      text: 'Boulangerie Moreau Angers',
    }));
    expect(result.confidence).toBe(0.99);
    expect(result.evidence.map((e) => e.kind)).toEqual(
      expect.arrayContaining(['siren_legal', 'phone', 'name_and_city']),
    );
  });

  it('ignore un SIREN qui n’est pas celui de l’entreprise', () => {
    const result = scoreMatch(company, page({ sirens: ['380129866'] }));
    expect(result.confidence).toBe(0);
  });
});
