'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signIn, type AuthActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { GoogleButton } from '@/components/google-button';
import { Field } from '@/components/auth-field';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Connexion…' : 'Se connecter'}
    </Button>
  );
}

/**
 * Google d'abord, le mot de passe ensuite.
 *
 * C'est le chemin le plus court, et aucun mot de passe n'y transite. Le
 * formulaire reste offert entier en dessous : imposer un fournisseur externe
 * exclurait ceux qui n'en veulent pas.
 */
export function LoginForm({ next }: { next?: string | undefined }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(signIn, {});

  return (
    <>
      <h1 className="text-3xl tracking-tight">Content de te revoir</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tes cinq opportunités du jour t’attendent.
      </p>

      <div className="mt-8">
        <GoogleButton {...(next ? { next } : {})} label="Continuer avec Google" />
      </div>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="field-label">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

        {/* Renvoie l'utilisateur là où il allait avant d'être intercepté. */}
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Field id="email" label="E-mail" type="email" autoComplete="email" />
        <Field id="password" label="Mot de passe" type="password" autoComplete="current-password" />

        <SubmitButton />
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
