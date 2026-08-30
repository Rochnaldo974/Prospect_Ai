'use client';

import { Reveal } from '@/components/landing/reveal';

/**
 * D'où viennent les cinq dossiers.
 *
 * Un schéma plutôt qu'un paragraphe : la chaîne compte quatre maillons et
 * chacun élimine. Le dire en prose obligerait à retenir quatre nombres ; le
 * montrer laisse voir d'un coup que le tri est brutal, et c'est précisément
 * l'argument — ce qui arrive au bout a survécu à tout le reste.
 *
 * Les nombres sont ceux du parc réel, mesurés : 4,59 millions de .fr actifs,
 * 259 000 dont le nom désigne un métier, et les taux relevés sur les scans
 * effectués. Le dernier maillon est la promesse produit, pas une mesure.
 */
const STAGES = [
  { n: '4 590 087', label: 'domaines .fr actifs', note: 'le parc entier, importé' },
  { n: '259 452', label: 'entreprises identifiables', note: 'nom de métier, site analysable' },
  { n: '~20 %', label: 'reliées à leur SIREN', note: 'lu dans les mentions légales' },
  { n: '5', label: 'dossiers, pour vous', note: 'défaut réel, contact joignable, exclusif' },
];

export function Pipeline() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {STAGES.map((stage, i) => (
        <Reveal key={stage.label} delay={i * 90}>
          <div className="relative h-full bg-[var(--white)] p-6">
            {/* Le rang encode une position dans une chaîne, pas une liste :
                l'ordre porte l'information — chaque étage élimine. */}
            <span
              className={`font-mono text-[11px] ${
                i === STAGES.length - 1 ? 'text-[var(--brand)]' : 'text-muted-foreground'
              }`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <p
              className={`tabular mt-3 text-2xl font-semibold tracking-[-0.03em] ${
                i === STAGES.length - 1 ? 'text-[var(--brand)]' : ''
              }`}
            >
              {stage.n}
            </p>
            <p className="mt-1.5 text-sm font-medium leading-snug">{stage.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stage.note}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
