'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * Votre matinée, racontée — l'animation du héros.
 *
 * Une histoire en quatre temps, et chaque ligne RESTE affichée : la
 * précédente ne disparaît pas quand la suivante arrive. Le lecteur peut
 * décrocher, revenir, tout est encore là. La version d'avant montrait le
 * pipeline du moteur — compteurs, entonnoir, cinq écrans en dix secondes :
 * exact, et illisible. Ici c'est SA matinée, pas notre machine.
 *
 * Sans animation, tout est affiché d'emblée : l'histoire complète est
 * l'état final.
 */

const STEPS = [
  {
    time: '08:00',
    text: <>Vous avez <strong>5 nouvelles entreprises</strong> à prospecter.</>,
  },
  {
    time: '08:02',
    text: <>Vous ouvrez la première : <strong>Restaurant · Angers</strong> — refonte de site, son site ne répond plus.</>,
  },
  {
    time: '08:03',
    text: <>Vous envoyez <strong>l’e-mail personnalisé</strong> — écrit depuis le dossier, signé à votre nom.</>,
  },
] as const;

export function MorningShow() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  // 0 → rien · 1..3 → les étapes · 4 → le bilan · 5 → pause avant reprise.
  const step = reduced ? 4 : Math.min(tick, 5);
  const shown = reduced ? STEPS.length : Math.min(step, STEPS.length);

  useEffect(() => {
    if (reduced) return;
    const delay = step === 0 ? 800 : step >= 4 ? 4200 : 2600;
    const timer = window.setTimeout(() => setTick((t) => (t >= 5 ? 0 : t + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [step, reduced]);

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.05),0_18px_50px_-18px_rgba(44,75,255,.22),0_36px_90px_-36px_rgba(11,13,20,.3)]">
      <figcaption className="flex items-center gap-2.5 border-b bg-[var(--mist)]/60 px-5 py-3.5">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-[var(--brand)] opacity-60 motion-safe:animate-ping [animation-duration:2.2s]" />
          <span className="relative inline-flex size-2 rounded-full bg-[var(--brand)]" />
        </span>
        <span className="field-label">Votre matinée avec Prospect AI</span>
      </figcaption>

      <div className="min-h-[19.5rem] p-6">
        <ol className="space-y-5">
          {STEPS.slice(0, shown).map((item) => (
            <li
              key={item.time}
              className="flex gap-4 motion-safe:animate-[findingIn_.5s_cubic-bezier(.2,.7,.3,1)_both]"
            >
              <span className="tabular mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                {item.time}
              </span>
              <p className="text-[15px] leading-relaxed [&_strong]:font-semibold">
                {item.text}
              </p>
            </li>
          ))}
        </ol>

        {/* Le bilan : la seule chose à retenir, en grand, et il reste. */}
        {step >= 4 ? (
          <div className="mt-6 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-wash)] p-4 motion-safe:animate-[heroCard_.5s_cubic-bezier(.16,.84,.44,1)_both]">
            <p className="text-[15px] font-semibold text-[var(--brand)]">
              Cette entreprise ? Prospectée en 1 minute.
            </p>
            <p className="mt-1 text-sm text-[var(--brand)]/75">
              Il vous en reste 4 — un quart d’heure en tout, et la matinée est à vous.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-1 px-5 pb-4" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
              step >= n ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>
    </figure>
  );
}
