import { describe, expect, it } from 'vitest';
import { validateAnswers } from '../../packages/core/src/allocation/onboarding';
import type { OnboardingAnswers } from '../../packages/core/src/allocation/onboarding';

/**
 * Paramétrage initial.
 *
 * Trois questions, et un principe : un paramétrage vide ne restreint rien.
 * Un freelance qui ne coche aucun service doit recevoir des opportunités,
 * pas un tableau de bord vide qu'il attribuerait au moteur.
 */

const answers = (over: Partial<OnboardingAnswers> = {}): OnboardingAnswers => ({
  services: [],
  locationMode: 'france',
  city: null,
  region: null,
  excludedIndustries: [],
  ...over,
});

describe('ce qu’on accepte', () => {
  it('accepte un formulaire entièrement vide', () => {
    // Ne rien répondre revient à tout accepter : c'est le comportement voulu,
    // pas une lacune à corriger par une validation.
    expect(validateAnswers(answers()).ok).toBe(true);
  });

  it('accepte un périmètre national sans lieu', () => {
    expect(validateAnswers(answers({ locationMode: 'france_remote' })).ok).toBe(true);
  });

  it('accepte un périmètre local avec la ville seule', () => {
    expect(validateAnswers(answers({ locationMode: 'city', city: 'Angers' })).ok).toBe(true);
  });

  it('accepte un périmètre régional avec la région seule', () => {
    expect(validateAnswers(answers({ locationMode: 'region', region: 'Pays de la Loire' })).ok)
      .toBe(true);
  });
});

describe('ce qu’on refuse', () => {
  it('refuse un périmètre local sans aucun lieu', () => {
    // La base a une contrainte pour l'interdire. La laisser se déclencher
    // montrerait une erreur technique là où une question claire suffit.
    const result = validateAnswers(answers({ locationMode: 'city' }));
    expect(result.ok).toBe(false);
    expect(result.problem).toMatch(/ville ou votre région/i);
  });

  it('refuse aussi pour un périmètre régional sans lieu', () => {
    expect(validateAnswers(answers({ locationMode: 'region' })).ok).toBe(false);
  });
});
