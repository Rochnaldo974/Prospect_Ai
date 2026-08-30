'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * Une section qui monte en entrant dans le champ de vision.
 *
 * Deux précautions, apprises en la cassant : une animation d'apparition qui
 * masque son contenu en attendant un déclencheur laisse une page BLANCHE dès
 * que ce déclencheur tarde ou n'arrive jamais. Pour un effet purement
 * décoratif, c'est le pire défaut possible.
 *
 *   un filet de sécurité révèle tout au bout d'une seconde, quoi qu'il arrive ;
 *   la préférence « moins de mouvement » affiche le contenu sans condition.
 *
 * Aucun contrôle manuel de la position : l'observateur signale de lui-même un
 * élément déjà visible au montage. L'observer est débranché après le premier
 * passage — une animation qui rejoue à chaque défilement fait un manège.
 */
export function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    const failsafe = window.setTimeout(() => setShown(true), 1000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const visible = shown || reduced;

  return (
    <div
      ref={ref}
      className={
        visible
          ? 'motion-safe:animate-[revealUp_.65s_cubic-bezier(.16,.84,.44,1)_both]'
          : 'opacity-0 motion-reduce:opacity-100'
      }
      style={visible ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
