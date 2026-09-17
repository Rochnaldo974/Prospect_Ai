'use client';

import { useActionState } from 'react';
import { INDUSTRY_GROUPS } from '@prospect/core';
import { saveSectors, type StepState } from '../actions';
import { Choice, Step } from '@/components/onboarding-shell';

export function SectorsForm({ excluded, excludeAssociations }: { excluded: string[]; excludeAssociations: boolean }) {
  const [state, action, pending] = useActionState<StepState, FormData>(saveSectors, {});

  return (
    <form action={action}>
      <Step
        question="Des secteurs dont vous ne voulez pas ?"
        help="Facultatif, et la plupart n'en cochent aucun. Une opportunité écartée ici ne prendra pas une des cinq places de votre journée."
        problem={state.problem}
        pending={pending}
        submitLabel="Continuer"
        back="/onboarding/services"
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

        {/* Les associations viennent du Journal officiel : un public réel
            pour un site vitrine, mais pas pour tout le monde. */}
        <div className="mt-5">
          <Choice
            name="exclude_associations"
            value="on"
            defaultChecked={excludeAssociations}
            title="Ne pas me proposer d’associations"
            note="Clubs, fédérations, fondations : elles ont souvent besoin d’un site, avec des budgets plus modestes."
          />
        </div>
      </Step>
    </form>
  );
}
