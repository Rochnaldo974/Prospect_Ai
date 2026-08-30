'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signUp, type AuthActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { GoogleButton } from '@/components/google-button';
import { Field } from '@/components/auth-field';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Création…' : 'Créer mon compte'}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(signUp, {});

  return (
    <>
      <h1 className="text-3xl tracking-tight">Trois questions, puis cinq par jour</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Le paramétrage prend une minute. Le premier lot arrive le lendemain matin.
      </p>

      <div className="mt-8">
        <GoogleButton label="S’inscrire avec Google" />
      </div>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="field-label">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}
        {state.notice ? <Alert variant="success">{state.notice}</Alert> : null}

        <Field id="fullName" label="Nom" type="text" autoComplete="name" />
        <Field id="email" label="E-mail" type="email" autoComplete="email" />
        <div>
          <Field id="password" label="Mot de passe" type="password" autoComplete="new-password" />
          <p className="mt-1.5 text-xs text-muted-foreground">8 caractères minimum.</p>
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Déjà inscrit ?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
