import { describe, expect, it } from 'vitest';
import { describeIndustry } from '../../packages/core/src/domain/industries';

/** Un métier se lit en français et se reconnaît à un signe, quelle que soit la source. */
describe('métiers', () => {
  it('traduit une étiquette OpenStreetMap', () => {
    expect(describeIndustry('hairdresser')).toEqual({ label: 'Coiffeur', icon: '✂️' });
    expect(describeIndustry('estate agent').label).toBe('Agence immobilière');
  });
  it('garde un libellé du répertoire et lui trouve un signe', () => {
    const d = describeIndustry('RESTAURATION TRADITIONNELLE');
    expect(d.label).toBe('Restauration traditionnelle');
    expect(d.icon).toBe('🍽️');
  });
  it('a une devanture par défaut', () => {
    expect(describeIndustry(null)).toEqual({ label: 'Commerce', icon: '🏪' });
    expect(describeIndustry('zzz').icon).toBe('🏪');
  });
});
