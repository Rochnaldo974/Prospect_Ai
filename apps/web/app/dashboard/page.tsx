import type { Metadata } from 'next';
import Link from 'next/link';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';
import { EmptyDay } from '@/components/empty-day';

export const metadata: Metadata = { title: 'Ce matin' };

/**
 * Ce qui arrive ce matin.
 *
 * L'écran est construit autour d'une contrainte de temps : le freelance a dix
 * minutes avant de retourner à son travail facturé. Il doit donc pouvoir
 * CHOISIR avant de lire — les cinq entreprises sont repliées, et seule la
 * première est ouverte.
 *
 * La progression du jour est affichée parce que la boucle du service se ferme
 * sur elle : cinq dossiers reçus, cinq issues déclarées. Un freelance qui ne
 * voit pas où il en est ne déclare rien, et sans issues déclarées le moteur
 * ne peut plus rien apprendre.
 */
export default async function DashboardPage() {
  const { firstName, opportunities, diagnosis, followUpCount } = await getMyOpportunities();

  // Les dossiers mis de côté vivent sous « Plus tard » : les laisser ici
  // ferait de la mise de côté un simple marquage, pas un rangement.
  const today = opportunities.filter((o) => o.snoozedAt === null);
  const done = today.filter((o) => o.contactedAt !== null).length;
  const total = today.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Bonjour{firstName ? ` ${firstName}` : ''}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">
            {total > 0
              ? `${total} ${total > 1 ? 'entreprises vous attendent' : 'entreprise vous attend'}`
              : 'Rien ce matin'}
          </h1>
        </div>

        {total > 0 ? <Progress done={done} total={total} /> : null}
      </header>

      {total === 0 ? (
        <div className="mt-10">
          <EmptyDay diagnosis={diagnosis} />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {today.map((opportunity) => (
            <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />
          ))}
        </div>
      )}

      {followUpCount > 0 ? (
        <Link
          href="/dashboard/suivi"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-5 transition-colors hover:bg-[var(--white)]"
        >
          <div>
            <p className="text-sm font-medium">
              {followUpCount} {followUpCount > 1 ? 'entreprises attendent' : 'entreprise attend'} une
              relance
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Intéressées, en rendez-vous ou en attente de devis.
            </p>
          </div>
          <span aria-hidden className="text-muted-foreground">
            →
          </span>
        </Link>
      ) : null}
    </main>
  );
}

/**
 * Où en est la journée.
 *
 * Une pastille par dossier, pleine dès qu'il a été appelé. Un « 3/5 » se lit
 * aussi, mais il faut le lire ; les pastilles se comptent d'un regard, et
 * c'est tout ce qu'on demande à cet élément.
 */
function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`size-2.5 rounded-full ${
              i < done ? 'bg-[var(--brand)]' : 'border border-[var(--line)] bg-[var(--white)]'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {done === total ? 'Tout est traité' : `${done} sur ${total} appelées`}
      </p>
    </div>
  );
}
