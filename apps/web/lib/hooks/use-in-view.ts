'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * Savoir si un bloc est entré dans le champ de vision.
 *
 * Même discipline que Reveal, pour la même raison : une animation qui attend
 * un déclencheur doit avoir un filet. Ici le retour vaut « affiche l'état
 * final » — un composant qui s'en sert doit rester lisible même si le
 * déclencheur n'arrive jamais.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);
    const failsafe = window.setTimeout(() => setShown(true), 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return { ref, inView: shown || reduced } as const;
}
