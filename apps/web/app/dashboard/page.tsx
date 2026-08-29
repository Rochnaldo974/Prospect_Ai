import type { Metadata } from 'next';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { signOut } from '@/app/(auth)/actions';
import { OpportunityCard } from '@/components/opportunity-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Mes opportunités' };

export default async function DashboardPage() {
  const { firstName, role, opportunities } = await getMyOpportunities();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour {firstName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {opportunities.length > 0
              ? `Tes ${opportunities.length} opportunités du jour`
              : 'Tes opportunités du jour'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {role === 'admin' ? (
            <a
              href="/admin"
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
            >
              Admin
            </a>
          ) : null}
          {/* Server action plutôt qu'un route handler : un seul chemin de
              déconnexion, et pas d'URL POST exposée sans usage. */}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>

      {opportunities.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Rien à te proposer aujourd&apos;hui</CardTitle>
            <CardDescription>
              Mieux vaut ne rien envoyer qu&apos;envoyer du remplissage : une opportunité
              n&apos;est livrée que si un fait daté et vérifiable la justifie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Le moteur repasse chaque nuit. Élargir ton périmètre géographique ou tes
              secteurs augmente le nombre de correspondances.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.assignmentId} opportunity={opportunity} />
          ))}
        </div>
      )}
    </main>
  );
}
