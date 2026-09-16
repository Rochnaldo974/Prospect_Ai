import type { Metadata } from 'next';
import Link from 'next/link';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';
import { EmptyDay } from '@/components/empty-day';
import { SimulateButton } from '@/components/dashboard/simulate-button';
import { simulateMyNextDelivery } from './actions';

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
  const { firstName, role, opportunities, diagnosis, followUpCount, plan, stats } =
    await getMyOpportunities();

  // Les dossiers mis de côté vivent sous « Plus tard » : les laisser ici
  // ferait de la mise de côté un simple marquage, pas un rangement.
  const today = opportunities.filter((o) => o.snoozedAt === null);
  const snoozedCount = opportunities.length - today.length;
  const done = today.filter((o) => o.contactedAt !== null).length;
  const total = today.length;

  // Ce qui est arrivé ce matin, et ce qui reste ouvert des jours d'avant :
  // deux listes, parce que ce ne sont pas les mêmes décisions. Le second
  // groupe a une échéance qui approche ; c'est elle qu'on affiche en gros.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const arrivedToday = today.filter((o) => new Date(o.assignedAt) >= startOfDay);
  const stillOpen = today.filter((o) => new Date(o.assignedAt) < startOfDay);

  // Les jours précédents, un groupe par jour d'arrivée, du plus récent au
  // plus ancien : « hier » se traite avant « il y a trois jours », parce que
  // l'exclusivité du second tombe plus tôt.
  const dayKey = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const byDay = new Map<number, typeof stillOpen>();
  for (const o of stillOpen) {
    const key = dayKey(o.assignedAt);
    byDay.set(key, [...(byDay.get(key) ?? []), o]);
  }
  const previousDays = [...byDay.entries()].sort((a, b) => b[0] - a[0]);
  const dayLabel = (key: number) => {
    const days = Math.round((startOfDay.getTime() - key) / 86_400_000);
    if (days === 1) return 'Arrivées hier';
    if (days === 2) return 'Arrivées avant-hier';
    return `Arrivées le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(key))}`;
  };

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

        <div className="flex flex-wrap items-center gap-4">
          {total > 0 ? <Progress done={done} total={total} /> : null}
          {/* L'outil de simulation n'existe que pour l'administrateur : le
              freelance vit au rythme réel, un matin par jour. */}
          {role === 'admin' ? (
            <form action={simulateMyNextDelivery}>
              <SimulateButton plan={plan} />
            </form>
          ) : null}
        </div>
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
          <h2 className="mt-10 text-sm font-medium">Arrivées aujourd’hui</h2>
          {arrivedToday.length > 0 ? (
            <div className="mt-3 space-y-3">
              {arrivedToday.map((opportunity) => (
                <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed px-5 py-4 text-sm text-muted-foreground">
              Rien de nouveau ce matin. Les dossiers ci-dessous restent à traiter avant la fin de leur exclusivité.
            </p>
          )}

          {previousDays.map(([key, group]) => (
            <section key={key}>
              <h2 className="mt-10 text-sm font-medium">
                {dayLabel(key)}
                <span className="ml-2 font-normal text-muted-foreground">
                  — encore ouvertes, elles disparaissent à la fin de leur exclusivité
                </span>
              </h2>
              <div className="mt-3 space-y-3">
                {group.map((opportunity) => (
                  <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />
                ))}
              </div>
            </section>
          ))}
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
