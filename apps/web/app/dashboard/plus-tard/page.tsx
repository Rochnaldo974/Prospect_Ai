import type { Metadata } from 'next';
import Link from 'next/link';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';

export const metadata: Metadata = { title: 'Plus tard' };

/**
 * Les dossiers mis de côté.
 *
 * Un matin réel ne passe pas cinq appels d'affilée : on en traite deux et
 * on garde les autres pour la fin de journée. Sans cet endroit, un dossier
 * différé sortait du champ de vision et se perdait.
 *
 * L'honnêteté du produit tient en une ligne, répétée ici : mettre de côté
 * ne fige RIEN. L'exclusivité court, et un dossier oublié repart dans le
 * circuit — le temps restant est affiché sur chaque ligne.
 */
export default async function SnoozedPage() {
  const { opportunities } = await getMyOpportunities();
  const snoozed = opportunities.filter((o) => o.snoozedAt !== null);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">Plus tard</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Les dossiers que vous avez mis de côté. L’exclusivité court toujours : passé son
          terme, un dossier repart dans le circuit.
        </p>
      </header>

      {snoozed.length === 0 ? (
        <div className="mt-8 rounded-2xl border bg-card px-6 py-12 text-center">
          <p className="font-medium">Rien de mis de côté</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Depuis un dossier, « Plus tard » le range ici — pour la fin de journée, sans le
            perdre de vue.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
          >
            Voir aujourd’hui
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {snoozed.map((opportunity) => (
            <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />
          ))}
        </div>
      )}
    </main>
  );
}
