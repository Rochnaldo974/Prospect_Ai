'use client';

import { usePathname } from 'next/navigation';
import { ONBOARDING_STEPS } from '@prospect/core';

/**
 * Où on en est, et combien il reste.
 *
 * Reprise de la marge d'un formulaire administratif : les intitulés vivent à
 * gauche, numérotés, et l'étape courante est la seule à porter de l'encre
 * pleine. La numérotation est ici légitime — c'est une vraie séquence, et
 * l'ordre porte une information dont le lecteur a besoin.
 */
const TITLES: Record<string, string> = {
  services: 'Ce que tu fais',
  zone: 'Où tu travailles',
  secteurs: 'Ce que tu évites',
  recapitulatif: 'Vérification',
};

export function StepRail({ total }: { total: number }) {
  const pathname = usePathname();
  const current = ONBOARDING_STEPS.findIndex((step) => pathname.endsWith(`/${step}`));
  const index = current === -1 ? 0 : current;

  return (
    <nav aria-label="Étapes du paramétrage" className="md:sticky md:top-16 md:self-start">
      <p className="field-label">
        Étape <span className="tabular text-foreground">{index + 1}</span> sur {total}
      </p>

      {/* Barre compacte sur mobile : la liste complète prendrait tout l'écran
          avant même la première question. */}
      <div
        className="mt-3 flex gap-1.5 md:hidden"
        role="presentation"
      >
        {ONBOARDING_STEPS.map((step, i) => (
          <span
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i <= index ? 'bg-[var(--verified)]' : 'bg-border'
            }`}
          />
        ))}
      </div>

      <ol className="mt-6 hidden md:block">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = i < index;
          const now = i === index;

          return (
            <li key={step} className="relative flex gap-3 pb-6 last:pb-0">
              {/* Filet vertical : il relie les étapes comme les lignes d'un
                  bordereau, et s'arrête à la dernière. */}
              {i < ONBOARDING_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute left-[0.4375rem] top-5 h-full w-px ${
                    done ? 'bg-[var(--verified)]' : 'bg-border'
                  }`}
                />
              ) : null}

              <span
                aria-hidden
                className={`relative mt-1 size-3.5 shrink-0 rounded-full border transition-colors ${
                  now
                    ? 'border-[var(--verified)] bg-[var(--verified)]'
                    : done
                      ? 'border-[var(--verified)] bg-background'
                      : 'border-border bg-background'
                }`}
              />

              <span
                className={`text-sm leading-tight ${
                  now ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {TITLES[step]}
                {now ? <span className="sr-only"> — étape en cours</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
