import { describe, expect, it } from 'vitest';
import { tierOf } from '../../packages/core/src/allocation/tier';

/** Le palier compte des atouts ; chacun a une raison qu'on peut lire. */
const base = {
  dated: false, phone: false, email: false, contactForm: false, hasWebsite: true,
  siteScore: null, socialWithoutWebsite: false, identified: false,
};

describe('palier', () => {
  it('donne Diamant à un fait daté, joignable, identifié, sur un site en défaut', () => {
    const tier = tierOf({ ...base, dated: true, phone: true, email: true, siteScore: 42, identified: true });
    expect(tier.level).toBe('diamant');
    expect(tier.points).toBe(6);
    expect(tier.reasons).toContain('un site noté 42');
  });

  it('compte la page sociale sans site comme un atout de création', () => {
    const tier = tierOf({ ...base, hasWebsite: false, socialWithoutWebsite: true, phone: true, identified: true });
    expect(tier.level).toBe('or');
    expect(tier.reasons).toContain('une page sociale sans site');
  });

  it('laisse en Bronze un dossier sans aucun atout', () => {
    expect(tierOf(base).level).toBe('bronze');
  });

  it('compte une clientèle établie comme atout de capacité', () => {
    const tier = tierOf({ ...base, googleReviews: 214, googleRating: 4.7 });
    expect(tier.points).toBe(1);
    expect(tier.reasons[0]).toMatch(/clientèle établie \(4.7 sur 214 avis\)/);
    expect(tierOf({ ...base, googleReviews: 5, googleRating: 4.9 }).points).toBe(0);
  });

  it('fait peser un fait daté double', () => {
    expect(tierOf({ ...base, dated: true }).points).toBe(2);
  });
});
