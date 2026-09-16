import { describe, expect, it } from 'vitest';
import { looksLikeRegistryName } from '../../packages/core/src/sources/sirene/enricher';

/** L'enseigne du répertoire ne doit jamais recouvrir un nom relevé sur la devanture. */
describe('nom de répertoire ou nom de devanture', () => {
  it('reconnaît une raison sociale', () => {
    expect(looksLikeRegistryName('SARL LES MARRONNIERS')).toBe(true);
    expect(looksLikeRegistryName('RESTAURANT PIERRE ORSI')).toBe(true);
    expect(looksLikeRegistryName('Dupont sas')).toBe(true);
  });
  it('laisse un nom de devanture tranquille', () => {
    expect(looksLikeRegistryName('The Albion')).toBe(false);
    expect(looksLikeRegistryName('Coolé')).toBe(false);
    expect(looksLikeRegistryName("Bar de L'Eldorado")).toBe(false);
  });
});
