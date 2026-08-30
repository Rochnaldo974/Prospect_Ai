'use client';

import { useSyncExternalStore } from 'react';

/**
 * L'utilisateur demande-t-il moins de mouvement ?
 *
 * Lu par `useSyncExternalStore` plutôt que par un effet : un `setState`
 * synchrone dans un effet déclenche un rendu en cascade, et la valeur serait
 * de toute façon fausse pendant le premier rendu.
 *
 * Le rendu serveur répond « non » — seul choix possible sans connaître le
 * réglage du visiteur — et la valeur est corrigée dès l'hydratation, avant
 * qu'aucune animation n'ait eu le temps de se jouer.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
