import type { WindowCounts } from '@prospect/core';
import type { Metadata } from 'next';
import { getMyStatistics } from '@/lib/opportunities/mine';
import { StatsChart } from '@/components/dashboard/stats-chart';
import { Bar, Kpi, PageHeader, Panel, Workspace } from '@/components/dashboard/ui';

export const metadata: Metadata = { title: 'Statistiques' };

/**
 * Le relevé du mois.
 *
 * Trois étages : les comptes (ce qui s'est passé), les courbes (quand),
 * l'entonnoir (ce que ça devient). Chaque nombre est comparé aux trente
 * jours précédents. Le rail porte les taux et les repères du mois.
 */
export default async function StatisticsPage() {
  const { monthly, activity, stats } = await getMyStatistics();
  const { current, previous } = monthly;

  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  const responseRate = rate(current.responses, current.contacted);
  const callRate = rate(current.contacted, current.proposed);
  const bestDay = activity.reduce<typeof activity[number] | null>((best, d) => (best === null || d.contacted > best.contacted ? d : best), null);
  const activeDays = activity.filter((d) => d.contacted > 0).length;
  const totalCalls = activity.reduce((s, d) => s + d.contacted, 0);
  const week = activity.slice(-7).reduce((s, d) => s + d.contacted, 0);
  const prevWeek = activity.slice(-14, -7).reduce((s, d) => s + d.contacted, 0);

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader eyebrow="30 derniers jours" title="Statistiques" lead="Chaque nombre est comparé aux trente jours précédents." />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Proposées" value={current.proposed} delta={current.proposed - previous.proposed} hint="par le moteur" tone={current.proposed === 0 ? 'muted' : 'default'} />
        <Kpi label="Contactées" value={current.contacted} delta={current.contacted - previous.contacted} hint={callRate !== null ? `${callRate} % des proposées` : 'vs 30 jours précédents'} tone={current.contacted === 0 ? 'muted' : 'brand'} />
        <Kpi label="Réponses positives" value={current.responses} delta={current.responses - previous.responses} hint={responseRate !== null ? `${responseRate} % des appels` : 'vs 30 jours précédents'} tone={current.responses === 0 ? 'muted' : 'default'} />
        <Kpi label="Refus" value={current.notInterested} hint="ni bon ni mauvais : le métier" tone="muted" />
        <Kpi label="Sans réponse" value={current.noResponse} hint="personne au bout du fil" tone="muted" />
        <Kpi label="Clientes signées" value={current.clients} delta={current.clients - previous.clients} hint={stats.client > 0 ? `${stats.client} depuis votre arrivée` : 'vs 30 jours précédents'} tone={current.clients > 0 ? 'won' : 'muted'} />
      </div>

      <Workspace
        rail={(
          <>
            <Panel eyebrow="Taux du mois" title="Ce que vos appels rendent">
              <div className="space-y-2.5">
                <Bar label="Appelées sur proposées" value={callRate ?? 0} max={100} suffix=" %" />
                <Bar label="Réponses positives sur appels" value={responseRate ?? 0} max={100} color="var(--success)" suffix=" %" />
                <Bar label="Clientes sur réponses" value={rate(current.clients, current.responses) ?? 0} max={100} color="var(--success)" suffix=" %" />
              </div>
              <p className="mt-3 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
                Avec moins de vingt appels, un pourcentage bouge beaucoup d’un jour à l’autre : lisez la tendance, pas la décimale.
              </p>
            </Panel>
            <Panel eyebrow="Repères" title="Le rythme">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <div><dt className="text-[11px] text-muted-foreground">Cette semaine</dt><dd className="tabular font-mono text-lg font-medium">{week} <span className="text-[11px] font-normal text-muted-foreground">{prevWeek > 0 || week > 0 ? (week - prevWeek >= 0 ? `+${week - prevWeek}` : `${week - prevWeek}`) : ''}</span></dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Jours actifs</dt><dd className="tabular font-mono text-lg font-medium">{activeDays}<span className="text-[11px] font-normal text-muted-foreground">/30</span></dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Appels par jour actif</dt><dd className="tabular font-mono text-lg font-medium">{activeDays > 0 ? (totalCalls / activeDays).toFixed(1).replace('.', ',') : '—'}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Meilleur jour</dt><dd className="tabular font-mono text-lg font-medium">{bestDay && bestDay.contacted > 0 ? `${bestDay.contacted}` : '—'}<span className="ml-1 text-[11px] font-normal text-muted-foreground">{bestDay && bestDay.contacted > 0 ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${bestDay.date}T12:00:00`)) : ''}</span></dd></div>
              </dl>
            </Panel>
            <Panel eyebrow="Depuis votre arrivée" title="En tout">
              <div className="space-y-2.5">
                {([['Appelées', stats.contacted], ['Intéressées', stats.interested], ['Rendez-vous', stats.meeting], ['Devis', stats.proposal], ['Clients', stats.client]] as Array<[string, number]>).map(([label, value]) => (
                  <Bar key={label} label={label} value={value} max={Math.max(1, stats.contacted)} color={label === 'Clients' ? 'var(--success)' : 'var(--brand)'} />
                ))}
              </div>
            </Panel>
          </>
        )}
      >
        <Panel title="Jour par jour" aside={(
          <span className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-[var(--brand)]" />appelées</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-[var(--success)]" />réponses positives</span>
          </span>
        )}>
          <StatsChart data={activity} />
        </Panel>

        <Panel title="L’entonnoir du mois" aside="de la proposition à la signature">
          <Funnel current={current} />
        </Panel>
      </Workspace>
    </main>
  );
}

/** L'entonnoir : quatre barres, chacune en proportion de la première. */
function Funnel({ current }: { current: WindowCounts }) {
  const steps: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Proposées', value: current.proposed, tone: 'bg-[var(--brand)]/25' },
    { label: 'Contactées', value: current.contacted, tone: 'bg-[var(--brand)]/55' },
    { label: 'Réponses positives', value: current.responses, tone: 'bg-[var(--brand)]' },
    { label: 'Clientes signées', value: current.clients, tone: 'bg-[var(--success)]' },
  ];
  const base = Math.max(1, current.proposed);

  return (
    <div className="mt-2 space-y-3">
      {steps.map((step, i) => {
        const prev = steps[i - 1];
        const conversion = prev && prev.value > 0 ? Math.round((step.value / prev.value) * 100) : null;
        return (
          <div key={step.label} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-x-4 sm:grid-cols-[11rem_1fr_auto]">
            <p className="text-xs text-muted-foreground">{step.label}</p>
            <div className="h-7 overflow-hidden rounded-md bg-[var(--mist)]">
              <div className={`funnel-bar h-full rounded-md ${step.tone}`} style={{ width: `${Math.max(step.value > 0 ? 2.5 : 0, (step.value / base) * 100)}%`, animationDelay: `${0.15 + i * 0.18}s` }} />
            </div>
            <p className="tabular w-24 text-right font-mono text-[11px] text-muted-foreground">
              <span className="text-sm font-medium text-foreground">{step.value}</span>
              {conversion !== null ? <span className="ml-1.5">· {conversion} %</span> : null}
            </p>
          </div>
        );
      })}
    </div>
  );
}
