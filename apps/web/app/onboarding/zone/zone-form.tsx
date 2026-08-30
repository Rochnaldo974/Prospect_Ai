'use client';

import { useActionState, useState } from 'react';
import type { OnboardingAnswers } from '@prospect/core';
import { saveZone, type StepState } from '../actions';
import { Choice, Step } from '@/components/onboarding-shell';

const MODES = [
  ['france', 'Partout en France', 'Tout le stock. La proximité reste un avantage au classement.'],
  ['france_remote', 'Partout, à distance', 'Même chose, en assumant de ne pas se déplacer.'],
  ['region', 'Ma région', 'Rien en dehors.'],
  ['city', 'Ma ville et ses environs', 'Le périmètre le plus étroit — et le plus rare en stock.'],
] as const;

export function ZoneForm({ initial }: { initial: OnboardingAnswers }) {
  const [state, action, pending] = useActionState<StepState, FormData>(saveZone, {});
  const [mode, setMode] = useState(initial.locationMode);
  const local = mode === 'city' || mode === 'region';

  return (
    <form action={action}>
      <Step
        question="Où travailles-tu ?"
        help="La seule contrainte qu'on ne peut pas lever pour toi. Se déplacer chez un commerçant vaut trois échanges téléphoniques — même sans restriction, la proximité pèse dans le classement."
        problem={state.problem}
        pending={pending}
        submitLabel="Continuer"
        back="/onboarding/services"
      >
        <div className="grid gap-2.5">
          {MODES.map(([value, title, note]) => (
            <Choice
              key={value}
              name="locationMode"
              value={value}
              type="radio"
              checked={mode === value}
              onChange={() => setMode(value)}
              title={title}
              note={<span className="text-muted-foreground">{note}</span>}
            />
          ))}
        </div>

        {/* Les champs de lieu n'apparaissent que s'ils servent : les afficher
            en permanence donnerait à croire qu'ils sont exigés. */}
        <div
          className={`grid gap-4 overflow-hidden transition-all duration-300 sm:grid-cols-2 ${
            local ? 'mt-6 max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
          aria-hidden={!local}
        >
          <Field name="city" label="Ville" defaultValue={initial.city} disabled={!local} />
          <Field name="region" label="Région" defaultValue={initial.region} disabled={!local} />
        </div>

        {local ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Renseigne au moins l&apos;un des deux : sans lieu, un périmètre local ne peut rien
            trouver.
          </p>
        ) : null}
      </Step>
    </form>
  );
}

function Field({
  name, label, defaultValue, disabled,
}: {
  name: string; label: string; defaultValue: string | null; disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="field-label block">{label}</label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        disabled={disabled}
        autoComplete={name === 'city' ? 'address-level2' : 'address-level1'}
        className="h-10 w-full rounded-md border bg-card px-3 text-sm transition-colors focus-visible:border-[var(--verified)]"
      />
    </div>
  );
}
