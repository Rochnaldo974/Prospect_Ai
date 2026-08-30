import type { Metadata } from 'next';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { signOut } from '@/app/(auth)/actions';
import { OpportunityCard } from '@/components/opportunity-card';
import { EmptyDay } from '@/components/empty-day';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Mes opportunités' };

export default async function DashboardPage() {
  const { firstName, role, opportunities, diagnosis } = await getMyOpportunities();

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
          <Link
            href="/onboarding?modifier"
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
          >
            Préférences
          </Link>
          {role === 'admin' ? (
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
            >
              Admin
            </Link>
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
        <EmptyDay diagnosis={diagnosis} />
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
