import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Mes opportunités' };

export default async function DashboardPage() {
  const profile = await requireUser();
  const firstName = profile.full_name?.split(' ')[0] ?? '';

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour {firstName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Tes 5 opportunités du jour</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile.role === 'admin' ? (
            <a
              href="/admin"
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
            >
              Admin
            </a>
          ) : null}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Le moteur n&apos;a pas encore tourné</CardTitle>
          <CardDescription>
            Les opportunités apparaîtront ici dès que le pipeline de découverte et
            d&apos;attribution sera en place (phases 4 à 13).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 0 terminée : authentification, base de données et espace de travail sont
            opérationnels.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
