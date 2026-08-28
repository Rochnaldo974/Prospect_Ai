import { MODIFIER_DETECTORS } from './modifiers';
import { TRIGGER_DETECTORS } from './triggers';
import type { SignalDetector } from '../types';

export * from './triggers';
export * from './modifiers';

/**
 * Tous les détecteurs, déclencheurs d'abord.
 *
 * L'ordre n'a pas d'incidence sur le résultat, mais il rend les journaux et
 * la console lisibles : ce qui date vient avant ce qui décrit.
 */
export const ALL_DETECTORS: SignalDetector[] = [...TRIGGER_DETECTORS, ...MODIFIER_DETECTORS];

const byId = new Map(ALL_DETECTORS.map((d) => [d.id, d]));
if (byId.size !== ALL_DETECTORS.length) {
  const seen = new Set<string>();
  const duplicates = ALL_DETECTORS.map((d) => d.id).filter((id) => !seen.add(id));
  throw new Error(`Détecteurs en double : ${duplicates.join(', ')}`);
}

export function getDetector(id: string): SignalDetector | undefined {
  return byId.get(id);
}
