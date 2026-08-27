'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signIn, type AuthActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Connexion…' : 'Se connecter'}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string | undefined }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(signIn, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accède à tes opportunités du jour.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

          {/* Renvoie l'utilisateur là où il allait avant d'être intercepté. */}
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <SubmitButton />
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
