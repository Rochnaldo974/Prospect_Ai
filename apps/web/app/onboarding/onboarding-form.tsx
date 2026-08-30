'use client';

import { useActionState, useState } from 'react';
import { OPPORTUNITY_TYPE_LABELS, INDUSTRY_GROUPS } from '@prospect/core';
import type { OnboardingAnswers } from '@prospect/core';
import { saveOnboarding, type OnboardingState } from './actions';
import { Button } from '@/components/ui/button';

/**
 * Trois questions, pas une de plus.
 *
 * Règle produit inscrite jusque dans le commentaire de la table : chaque champ
 * supplémentaire est une friction qui coûte des inscriptions, et le moteur
 * travaille très bien avec des préférences larges.
 *
 * Chaque question dit ce qu'elle change. Un formulaire qui demande sans
 * expliquer se remplit au hasard, et des préférences au hasard produisent des
 * opportunités hors sujet que l'utilisateur reprochera au moteur.
 */

/** Les familles qu'un freelance web propose réellement. */
const SERVICES = [
  'website_creation', 'website_redesign', 'ecommerce', 'maintenance',
  'seo', 'web_application', 'mobile_application', 'ai_automation',
] as const;

export function OnboardingForm({ initial }: { initial: OnboardingAnswers }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    saveOnboarding,
    {},
  );
  const [mode, setMode] = useState(initial.locationMode);
  const local = mode === 'city' || mode === 'region';

  return (
    <form action={action} className="space-y-10">
      <Question
        number={1}
        title="Qu'est-ce que tu fais ?"
        help="Une opportunité qui ne correspond à aucun de ces services ne te sera jamais proposée, quel que soit son score. Ne rien cocher revient à tout accepter."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICES.map((service) => (
            <label
              key={service}
              className="flex items-center gap-2.5 rounded-md border p-3 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                name="services"
                value={service}
                defaultChecked={initial.services.includes(service)}
                className="size-4"
              />
              {OPPORTUNITY_TYPE_LABELS[service]}
            </label>
          ))}
        </div>
      </Question>

      <Question
        number={2}
        title="Où travailles-tu ?"
        help="La seule contrainte qu'on ne peut pas lever pour toi. À périmètre large, la proximité reste un avantage dans le classement — se déplacer chez un commerçant vaut trois échanges téléphoniques."
      >
        <div className="space-y-2">
          {([
            ['france', 'Partout en France'],
            ['france_remote', 'Partout en France, à distance'],
            ['region', 'Ma région'],
            ['city', 'Ma ville et ses environs'],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2.5 rounded-md border p-3 text-sm hover:bg-accent">
              <input
                type="radio"
                name="locationMode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field name="city" label="Ville" defaultValue={initial.city} required={local} />
          <Field name="region" label="Région" defaultValue={initial.region} required={local} />
        </div>
        {local ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Renseigne au moins l&apos;un des deux : sans lieu, un périmètre local ne peut rien
            trouver.
          </p>
        ) : null}
      </Question>

      <Question
        number={3}
        title="Y a-t-il des secteurs que tu ne veux pas ?"
        help="Facultatif. Une opportunité écartée ici ne prendra pas une des cinq places de ta journée."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {INDUSTRY_GROUPS.map((group) => (
            <label
              key={group.label}
              className="flex items-center gap-2.5 rounded-md border p-3 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                name="excluded"
                value={group.codes[0]}
                defaultChecked={group.codes.some((c) => initial.excludedIndustries.includes(c))}
                className="size-4"
              />
              {group.label}
            </label>
          ))}
        </div>
      </Question>

      {state.problem ? (
        <p role="alert" className="text-sm text-destructive">{state.problem}</p>
      ) : null}

      <div className="flex items-center gap-3 border-t pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Voir mes opportunités'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Tu pourras tout modifier plus tard.
        </p>
      </div>
    </form>
  );
}

function Question({
  number,
  title,
  help,
  children,
}: {
  number: number;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-tight">
          <span className="text-muted-foreground">{number}.</span> {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{help}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  required: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium leading-none text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        aria-required={required}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
