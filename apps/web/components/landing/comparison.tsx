'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * Une semaine de prospection, avant et après.
 *
 * Le chiffre qui porte l'argument n'est pas le nombre de prospects mais le
 * nombre d'heures. Un développeur freelance ne manque pas de contacts : il
 * manque de temps, et il sait très bien qu'envoyer soixante e-mails à froid ne
 * rapporte presque rien.
 *
 * Ces nombres sont donnés comme un EXEMPLE et le disent. Les présenter comme
 * une moyenne mesurée serait inventer une statistique — exactement le genre de
 * chose que le produit reproche aux fichiers de contacts qu'il remplace.
 *
 * Les barres se remplissent à l'entrée dans le champ de vision : la
 * comparaison se lit alors comme un geste, pas comme un tableau.
 */

const BEFORE = [
  { label: 'À chercher des entreprises', value: 4, unit: 'h' },
  { label: 'À vérifier si le site vaut un appel', value: 2, unit: 'h' },
  { label: 'À écrire et relancer', value: 2, unit: 'h' },
];

const AFTER = [
  { label: 'À lire les cinq dossiers du matin', value: 1, unit: 'h' },
];

const MAX = 8;

export function WeekComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const reduced = usePrefersReducedMotion();
  const run = seen || reduced;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setSeen(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -15% 0px' });

    observer.observe(node);
    // Comme ailleurs : le contenu passe avant l'effet.
    const failsafe = window.setTimeout(() => setSeen(true), 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div ref={ref} className="grid gap-px overflow-hidden rounded-2xl border bg-[var(--line)] md:grid-cols-2">
      <Panel
        eyebrow="Une semaine sans"
        total="8 h"
        totalNote="et deux réponses sur soixante e-mails"
        rows={BEFORE}
        run={run}
        tone="finding"
      />
      <Panel
        eyebrow="Une semaine avec"
        total="1 h"
        totalNote="vingt-cinq entreprises, chacune avec sa raison"
        rows={AFTER}
        run={run}
        tone="brand"
      />
    </div>
  );
}

function Panel({
  eyebrow,
  total,
  totalNote,
  rows,
  run,
  tone,
}: {
  eyebrow: string;
  total: string;
  totalNote: string;
  rows: { label: string; value: number; unit: string }[];
  run: boolean;
  tone: 'finding' | 'brand';
}) {
  const color = tone === 'finding' ? 'var(--finding)' : 'var(--brand)';

  return (
    <div className="bg-[var(--white)] p-7">
      <p className="field-label">{eyebrow}</p>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-5xl font-semibold tracking-[-0.04em]" style={{ color }}>
          {total}
        </span>
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{totalNote}</p>

      <div className="mt-7 space-y-4">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm leading-snug">{row.label}</span>
              <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                {row.value} {row.unit}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--mist)]">
              <div
                className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
                style={{
                  width: run ? `${(row.value / MAX) * 100}%` : '0%',
                  transitionDelay: `${i * 140}ms`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
