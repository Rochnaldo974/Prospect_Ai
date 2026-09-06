'use client';

import { useActionState } from 'react';
import { saveIdentity, type IdentityState } from './actions';
import type { EmailIdentity } from '@/lib/email/identity';

/**
 * Le formulaire d'identité, avec ses états rendus sur place.
 *
 * Un logo trop lourd ou un CV au mauvais format jetait sur la page d'erreur
 * générique — l'utilisateur perdait sa saisie et l'explication. Chaque refus
 * s'affiche maintenant à côté du bouton, en une phrase qui dit quoi faire ;
 * l'enregistrement réussi se dit aussi, sinon on clique deux fois.
 */
export function IdentityForm({
  identity,
  defaultName,
}: {
  identity: EmailIdentity;
  defaultName: string;
}) {
  const [state, action, pending] = useActionState<IdentityState, FormData>(saveIdentity, {});

  return (
    <form action={action} className="space-y-5 rounded-2xl border bg-card p-6">
      <Field label="Votre nom" name="from_name" value={identity.fromName || defaultName} placeholder="Eliott Roche" required />
      <Field label="Votre métier" name="title" value={identity.title} placeholder="Développeur web indépendant" />
      <Field label="Votre structure (facultatif)" name="company" value={identity.company} placeholder="Studio Roche" />
      <Field label="Téléphone" name="phone" value={identity.phone} placeholder="06 12 34 56 78" />
      <Field label="Site web" name="website" value={identity.website} placeholder="votresite.fr" />

      <label className="block">
        <span className="field-label">Logo (PNG, JPG, SVG — 512 Ko max)</span>
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border file:border-solid file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-[var(--mist)]"
        />
      </label>

      <label className="block">
        <span className="field-label">CV ou dossier de présentation (PDF — 2 Mo max)</span>
        <input
          type="file"
          name="cv"
          accept="application/pdf"
          className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border file:border-solid file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-[var(--mist)]"
        />
        {identity.cvUrl ? (
          <a
            href={identity.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-[var(--brand)] underline-offset-4 hover:underline"
          >
            Voir le CV actuel
          </a>
        ) : null}
      </label>

      {state.problem ? (
        <p className="rounded-lg bg-[var(--finding-wash)] px-4 py-3 text-sm text-[var(--finding)]">
          {state.problem}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {state.saved && !state.problem ? (
          <span className="text-sm font-medium text-[var(--brand)]">Enregistré ✓</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label, name, value, placeholder, required = false,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      />
    </label>
  );
}
