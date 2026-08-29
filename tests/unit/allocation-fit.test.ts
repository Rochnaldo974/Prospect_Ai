import { describe, expect, it } from 'vitest';
import {
  isEligible, fitScore, matchScore,
  type MatchingPreferences, type OpportunityCandidate,
} from '../../packages/core/src/allocation/fit';

/**
 * Adéquation entre une opportunité et un freelance.
 *
 * Une opportunité excellente dans l'absolu ne vaut rien pour quelqu'un qui ne
 * peut pas s'en occuper. L'enjeu de ces tests est la distinction entre « mal
 * adapté » — qui se traduit par un score bas — et « à ne pas proposer », qui
 * doit être un refus net : une place perdue sur cinq, c'est vingt pour cent
 * de la journée du freelance.
 */

const candidate = (over: Partial<OpportunityCandidate> = {}): OpportunityCandidate => ({
  opportunityType: 'website_redesign',
  baseScore: 80,
  confidenceScore: 0.9,
  city: 'Angers',
  region: 'Pays de la Loire',
  industryCode: '56.10A',
  ...over,
});

const prefs = (over: Partial<MatchingPreferences> = {}): MatchingPreferences => ({
  services: [],
  locationMode: 'france',
  city: 'Angers',
  region: 'Pays de la Loire',
  preferredIndustries: [],
  excludedIndustries: [],
  ...over,
});

describe('ce qu’il ne faut pas proposer du tout', () => {
  it('refuse un secteur explicitement exclu', () => {
    expect(isEligible(candidate(), prefs({ excludedIndustries: ['56'] }))).toBe(false);
  });

  it('applique l’exclusion de façon hiérarchique', () => {
    // Le code NAF est hiérarchique : exclure la restauration exclut chacune
    // de ses sous-classes, sans avoir à toutes les énumérer.
    expect(isEligible(candidate({ industryCode: '56.30Z' }), prefs({ excludedIndustries: ['56.3'] })))
      .toBe(false);
    expect(isEligible(candidate({ industryCode: '47.11B' }), prefs({ excludedIndustries: ['56'] })))
      .toBe(true);
  });

  it('refuse un service que le freelance ne rend pas', () => {
    expect(isEligible(candidate({ opportunityType: 'ecommerce' }), prefs({ services: ['seo'] })))
      .toBe(false);
  });

  it('ne restreint rien quand aucun service n’est déclaré', () => {
    // Un paramétrage vide ne doit pas se traduire par un stock vide.
    expect(isEligible(candidate(), prefs({ services: [] }))).toBe(true);
  });

  it('respecte un périmètre limité à la ville', () => {
    const local = prefs({ locationMode: 'city', city: 'Angers' });
    expect(isEligible(candidate({ city: 'Angers' }), local)).toBe(true);
    expect(isEligible(candidate({ city: 'Nantes' }), local)).toBe(false);
  });

  it('compare les lieux sans se laisser arrêter par la casse ou les accents', () => {
    const local = prefs({ locationMode: 'city', city: 'Villeneuve-d’Ascq' });
    expect(isEligible(candidate({ city: "VILLENEUVE D'ASCQ" }), local)).toBe(true);
  });

  it('ne filtre pas en France entière', () => {
    expect(isEligible(candidate({ city: 'Bastia', region: 'Corse' }), prefs())).toBe(true);
  });
});

describe('ce qui fait un bon rapprochement', () => {
  it('privilégie la proximité, même sans restriction géographique', () => {
    // Se déplacer chez un commerçant vaut trois échanges téléphoniques.
    const ici = fitScore(candidate({ city: 'Angers' }), prefs());
    const region = fitScore(candidate({ city: 'Nantes' }), prefs());
    const ailleurs = fitScore(candidate({ city: 'Lille', region: 'Hauts-de-France' }), prefs());
    expect(ici).toBeGreaterThan(region);
    expect(region).toBeGreaterThan(ailleurs);
  });

  it('récompense un secteur explicitement préféré', () => {
    expect(fitScore(candidate(), prefs({ preferredIndustries: ['56'] })))
      .toBeGreaterThan(fitScore(candidate(), prefs({ preferredIndustries: ['47'] })));
  });

  it('reste neutre quand aucun secteur n’est préféré', () => {
    // Ne rien déclarer ne doit pas être puni : le freelance qui n'a pas
    // d'avis n'est pas un freelance difficile à servir.
    const neutre = fitScore(candidate(), prefs({ preferredIndustries: [] }));
    const rejete = fitScore(candidate(), prefs({ preferredIndustries: ['47'] }));
    expect(neutre).toBeGreaterThan(rejete);
  });

  it('fait peser la qualité de l’opportunité plus que l’adéquation', () => {
    // Mieux vaut une très bonne opportunité un peu loin qu'une opportunité
    // tiède au coin de la rue.
    const bonneLoin = matchScore(
      candidate({ baseScore: 95, city: 'Lille', region: 'Hauts-de-France' }), prefs(),
    );
    const tiedeIci = matchScore(candidate({ baseScore: 55, city: 'Angers' }), prefs());
    expect(bonneLoin).toBeGreaterThan(tiedeIci);
  });

  it('reste borné entre 0 et 100', () => {
    expect(matchScore(candidate({ baseScore: 100, confidenceScore: 1 }), prefs()))
      .toBeLessThanOrEqual(100);
    expect(matchScore(candidate({ baseScore: 0, confidenceScore: 0 }), prefs()))
      .toBeGreaterThanOrEqual(0);
  });
});
