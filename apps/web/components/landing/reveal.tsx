'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Une section qui monte en entrant dans le champ de vision.
 *
 * Trois précautions, apprises en la cassant : une animation d'apparition qui
 * masque son contenu en attendant un déclencheur laisse une page BLANCHE dès
 * que ce déclencheur tarde ou n'arrive jamais. C'est le pire défaut possible
 * pour un effet purement décoratif.
 *
 *   ce qui est déjà visible au montage n'est jamais masqué ;
 *   un filet de sécurité révèle tout au bout d'une seconde, quoi qu'il
 *     arrive — observateur absent, script en échec, onglet en arrière-plan ;
 *   la préférence « moins de mouvement » court-circuite tout.
 *
 * L'observateur est débranché après le premier passage : une animation qui
 * rejoue à chaque défilement transforme une page en manège.
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

  useEffect(() => {
    const node = ref.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !node || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    // Déjà à l'écran au chargement : on affiche sans attendre de croisement,
    // qui pourrait ne jamais se produire pour un élément immobile.
    if (node.getBoundingClientRect().top < window.innerHeight) {
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
      { rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);

    // Filet : au-delà d'une seconde, le contenu passe avant l'effet.
    const failsafe = window.setTimeout(() => {
      setShown(true);
      observer.disconnect();
    }, 1000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={
        shown
          ? 'motion-safe:animate-[revealUp_.65s_cubic-bezier(.16,.84,.44,1)_both]'
          : 'opacity-0'
      }
      style={shown ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
