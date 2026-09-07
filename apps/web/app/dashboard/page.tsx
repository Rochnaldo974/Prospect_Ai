import type { Metadata } from 'next';
import Link from 'next/link';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';
import { EmptyDay } from '@/components/empty-day';

export const metadata: Metadata = { title: 'Aujourd’hui' };

/**
 * Ce qui arrive aujourd'hui.
 *
 * L'écran est construit autour d'une contrainte de temps : le freelance a dix
 * minutes avant de retourner à son travail facturé. Il doit donc pouvoir
 * CHOISIR avant de lire — les cinq entreprises sont repliées, et seule la
 * première est ouverte.
 *
 * Au-dessus de la liste, le relevé du pipeline : mises de côté, relances,
 * discussions en cours, clients signés. Quatre nombres qui sont chacun une
 * porte vers la page où on agit dessus — jamais des chiffres de décor.
 */
export default async function DashboardPage() {
  const { firstName, opportunities, diagnosis, followUpCount, plan, stats } =
    await getMyOpportunities();

  // Les dossiers mis de côté vivent sous « Plus tard » : les laisser ici
  // ferait de la mise de côté un simple marquage, pas un rangement.
  const today = opportunities.filter((o) => o.snoozedAt === null);
  const snoozedCount = opportunities.length - today.length;
  const done = today.filter((o) => o.contactedAt !== null).length;
  const total = today.length;

  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const inDiscussion = stats.interested + stats.meeting + stats.proposal;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {dateLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
            Bonjour{firstName ? ` ${firstName}` : ''}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total > 0
              ? `${total} ${
                total > 1 ? 'entreprises vous attendent' : 'entreprise vous attend'
              } — chacune vérifiée cette nuit, réservée pour vous 72 h.`
              : 'Rien de nouveau aujourd’hui.'}
          </p>
        </div>

        {total > 0 ? <Progress done={done} total={total} /> : null}
      </header>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          href="/dashboard/plus-tard"
          label="Mises de côté"
          value={snoozedCount}
          hint="À reprendre quand vous voulez"
        />
        <StatCard
          href="/dashboard/suivi"
          label="À relancer"
          value={followUpCount}
          hint="Elles attendent votre retour"
          urgent={followUpCount > 0}
        />
        <StatCard
          href="/dashboard/suivi"
          label="En discussion"
          value={inDiscussion}
          hint="Intéressées, rendez-vous, devis"
        />
        <StatCard
          href="/dashboard/historique"
          label="Clients signés"
          value={stats.client}
          hint="Depuis votre arrivée"
          won={stats.client > 0}
        />
      </div>

      {total === 0 ? (
        <div className="mt-10">
          <EmptyDay diagnosis={diagnosis} />
        </div>
      ) : (
        <>
          <h2 className="mt-10 text-sm font-medium">À prospecter aujourd’hui</h2>
          <div className="mt-3 space-y-3">
            {today.map((opportunity) => (
              <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />
            ))}
          </div>
        </>
      )}

      {plan === 'free' ? (
        <Link
          href="/dashboard/abonnement"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-wash)] px-6 py-5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <div>
            <p className="text-sm font-medium text-[var(--brand)]">
              Plan gratuit — un dossier par semaine
            </p>
            <p className="mt-0.5 text-sm text-[var(--brand)]/75">
              Le plan Solo en livre cinq par jour, avec l’e-mail prêt à envoyer.
            </p>
          </div>
          <span aria-hidden className="text-[var(--brand)]">→</span>
        </Link>
      ) : null}
    </main>
  );
}

/**
 * Une case du relevé : un nombre, sa porte.
 *
 * Le nombre est gros et mono parce qu'il se compare d'un jour à l'autre ;
 * la teinte ne change que quand elle dit quelque chose — l'ambre appelle
 * une relance, le vert marque un client. Un zéro reste gris : pas de
 * culpabilité fabriquée.
 */
function StatCard({
  href,
  label,
  value,
  hint,
  urgent = false,
  won = false,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  urgent?: boolean;
  won?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border bg-card px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`tabular mt-1.5 font-mono text-2xl font-medium ${
          value === 0
            ? 'text-muted-foreground/50'
            : urgent
              ? 'text-amber-600'
              : won
                ? 'text-emerald-600'
                : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 hidden text-[11px] leading-snug text-muted-foreground sm:block">
        {hint}
        <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
      </p>
    </Link>
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
