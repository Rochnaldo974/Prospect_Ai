'use client';

import { useActionState } from 'react';
import { finish, type StepState } from '../actions';
import { Step } from '@/components/onboarding-shell';

export function FinishForm({
  total,
  rows,
}: {
  total: number;
  rows: { label: string; value: string; href: string }[];
}) {
  const [state, action, pending] = useActionState<StepState, FormData>(finish, {});

  return (
    <form action={action}>
      <Step
        question="On y est."
        help="Vérifie, corrige si besoin, et le premier lot t'attendra demain matin."
        problem={state.problem}
        pending={pending}
        submitLabel="Terminer"
        back="/onboarding/secteurs"
      >
        <dl className="rounded-lg border bg-card">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 border-b p-4 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4"
            >
              <dt className="field-label pt-0.5">{row.label}</dt>
              <dd className="flex items-start justify-between gap-4 text-sm">
                <span className="min-w-0">{row.value}</span>
                <a
                  href={row.href}
                  className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Modifier
                </a>
              </dd>
            </div>
          ))}
        </dl>

        {/* Le chiffre est présenté comme un état daté, jamais comme une
            promesse : le stock aura changé demain matin, et l'exclusivité fait
            qu'une opportunité prise ne revient pas. */}
        <p className="mt-6 rounded-lg border border-dashed p-4 text-sm leading-relaxed">
          {total === 0 ? (
            <>
              Avec ce paramétrage,{' '}
              <strong className="font-medium">rien n&apos;est disponible en ce moment</strong>. Le
              moteur repasse chaque nuit — élargis ton périmètre ou tes services si tu ne veux pas
              attendre.
            </>
          ) : (
            <>
              Avec ce paramétrage,{' '}
              <strong className="tabular font-medium text-[var(--verified)]">{total}</strong>{' '}
              {total === 1 ? 'opportunité correspond' : 'opportunités correspondent'} en ce moment.
              Tu en recevras cinq par jour, jamais les mêmes que quelqu&apos;un d&apos;autre.
            </>
          )}
        </p>
      </Step>
    </form>
  );
}
