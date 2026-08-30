'use client';

import { useEffect, useState } from 'react';

/**
 * La barre du haut.
 *
 * Elle est translucide en tête de page, où elle n'a rien à séparer, et
 * devient opaque dès que le contenu passe dessous. Un fond à 85 % laissait
 * les gros titres la traverser en gris fantôme pendant tout le défilement :
 * lisible, mais sale, et c'est le premier élément que le visiteur voit.
 */
export function SiteHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? 'border-b bg-[var(--white)] shadow-[0_1px_12px_-6px_rgba(11,13,20,.35)]'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      {children}
    </header>
  );
}
