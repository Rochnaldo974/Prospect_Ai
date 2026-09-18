import type { Metadata } from 'next';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';
import { EmptyDay } from '@/components/empty-day';
import { SimulateButton } from '@/components/dashboard/simulate-button';
import { Kpi, PageHeader, Panel, Workspace } from '@/components/dashboard/ui';
import { DayCard, DeadlinesCard, MixCard, PipelineCard, PlanCard } from '@/components/dashboard/rail-widgets';
import { simulateMyNextDelivery } from './actions';

export const metadata: Metadata = { title: 'Aujourd’hui' };

/**
 * Ce qui arrive aujourd'hui.
 *
 * L'écran est construit autour d'une contrainte de temps : le freelance a dix
 * minutes avant de retourner à son travail facturé. Il doit donc pouvoir
 * CHOISIR avant de lire. Le corps est la liste ; le rail, à droite, tient
 * la page pleine avec ce qui aide à choisir : où en est la journée, ce qui
 * expire en premier, ce que les appels ont produit, de quoi le lot est fait.
 */
export default async function DashboardPage() {
  const { firstName, role, opportunities, diagnosis, followUpCount, plan, stats } =
    await getMyOpportunities();

  const today = opportunities.filter((o) => o.snoozedAt === null);
  const snoozedCount = opportunities.length - today.length;
  const done = today.filter((o) => o.contactedAt !== null).length;
  const total = today.length;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const arrivedToday = today.filter((o) => new Date(o.assignedAt) >= startOfDay);
  const stillOpen = today.filter((o) => new Date(o.assignedAt) < startOfDay);

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

  const dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const inDiscussion = stats.interested + stats.meeting + stats.proposal;
  const soonest = today.filter((o) => o.contactedAt === null).reduce<number | null>((m, o) => (m === null || o.hoursLeft < m ? o.hoursLeft : m), null);
  const withPhone = today.filter((o) => o.company.phone).length;
  const withEmail = today.filter((o) => o.company.email).length;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader
        eyebrow={dateLabel}
        title={`Bonjour${firstName ? ` ${firstName}` : ''}`}
        lead={total > 0
          ? `${total} ${total > 1 ? 'entreprises vous attendent' : 'entreprise vous attend'} — chacune vérifiée cette nuit, réservée pour vous 72 h.`
          : 'Rien de nouveau aujourd’hui.'}
        actions={role === 'admin' ? (
          <form action={simulateMyNextDelivery}><SimulateButton plan={plan} /></form>
        ) : undefined}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Dossiers du jour" value={total} hint={total > 0 ? `${withPhone} avec téléphone · ${withEmail} avec e-mail` : 'Le prochain lot arrive demain'} tone={total === 0 ? 'muted' : 'brand'} />
        <Kpi label="Traités" value={done} hint={total > 0 ? `${total - done} encore à appeler` : '—'} tone={done > 0 && done === total ? 'won' : done === 0 ? 'muted' : 'default'} />
        <Kpi label="Expire au plus tôt" value={soonest === null ? '—' : soonest <= 0 ? '0' : soonest >= 24 ? Math.floor(soonest / 24) : soonest} unit={soonest === null ? undefined : soonest >= 24 ? 'j' : 'h'} hint="d’exclusivité restante" tone={soonest !== null && soonest < 12 ? 'finding' : 'default'} />
        <Kpi href="/dashboard/plus-tard" label="Mises de côté" value={snoozedCount} hint="À reprendre quand vous voulez →" tone={snoozedCount === 0 ? 'muted' : 'default'} />
        <Kpi href="/dashboard/suivi" label="À relancer" value={followUpCount} hint="Elles attendent votre retour →" tone={followUpCount > 0 ? 'urgent' : 'muted'} />
        <Kpi href="/dashboard/historique" label="Clients signés" value={stats.client} hint={inDiscussion > 0 ? `${inDiscussion} en discussion →` : 'Depuis votre arrivée →'} tone={stats.client > 0 ? 'won' : 'muted'} />
      </div>

      <Workspace
        rail={(
          <>
            <DayCard opportunities={today} />
            <DeadlinesCard opportunities={today} />
            <PipelineCard stats={stats} />
            <MixCard opportunities={today} />
            <PlanCard plan={plan} />
          </>
        )}
      >
        {total === 0 ? (
          <EmptyDay diagnosis={diagnosis} />
        ) : (
          <>
            <Panel title="Arrivées aujourd’hui" aside={arrivedToday.length > 0 ? `${arrivedToday.length} ${arrivedToday.length > 1 ? 'dossiers' : 'dossier'}` : undefined} padded={false}>
              {arrivedToday.length > 0 ? (
                <div className="space-y-2 px-3 pb-3 pt-3">
                  {arrivedToday.map((opportunity) => <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />)}
                </div>
              ) : (
                <p className="px-5 pb-4 pt-2 text-sm text-muted-foreground">
                  Rien de nouveau ce matin. Les dossiers ci-dessous restent à traiter avant la fin de leur exclusivité.
                </p>
              )}
            </Panel>

            {previousDays.map(([key, group]) => (
              <Panel key={key} title={dayLabel(key)} aside="encore ouvertes — elles disparaissent à la fin de leur exclusivité" padded={false}>
                <div className="space-y-2 px-3 pb-3 pt-3">
                  {group.map((opportunity) => <OpportunityRow key={opportunity.assignmentId} opportunity={opportunity} />)}
                </div>
              </Panel>
            ))}
          </>
        )}
      </Workspace>
    </main>
  );
}
