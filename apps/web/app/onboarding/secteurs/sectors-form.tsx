'use client';

import { useActionState } from 'react';
import { INDUSTRY_GROUPS } from '@prospect/core';
import { saveSectors, type StepState } from '../actions';
import { Choice, Step } from '@/components/onboarding-shell';

export function SectorsForm({ excluded }: { excluded: string[] }) {
  const [state, action, pending] = useActionState<StepState, FormData>(saveSectors, {});

  return (
    <form action={action}>
      <Step
        question="Y a-t-il des secteurs que tu ne veux pas ?"
        help="Facultatif, et la plupart n'en cochent aucun. Une opportunité écartée ici ne prendra pas une des cinq places de ta journée."
        problem={state.problem}
        pending={pending}
        submitLabel="Continuer"
        back="/onboarding/zone"
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {INDUSTRY_GROUPS.map((group) => (
            <Choice
              key={group.label}
              name="excluded"
              value={group.codes[0] ?? ''}
              defaultChecked={group.codes.some((code) => excluded.includes(code))}
              title={group.label}
            />
          ))}
        </div>
      </Step>
    </form>
  );
}
