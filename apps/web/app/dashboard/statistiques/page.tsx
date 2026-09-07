import type { Metadata } from 'next';
import { getMyStatistics } from '@/lib/opportunities/mine';
import { StatsChart } from '@/components/dashboard/stats-chart';

export const metadata: Metadata = { title: 'Statistiques' };

/**
 * Le relevé du mois.
 *
 * Trois étages, du plus brut au plus parlant : les comptes (ce qui s'est
 * passé), les courbes (quand ça s'est passé), l'entonnoir (ce que ça
 * devient). Chaque nombre est comparé aux trente jours précédents — un
 * chiffre seul ne dit rien, c'est son mouvement qui parle.
 */
export default async function StatisticsPage() {
  const { monthly, activity, stats } = await getMyStatistics();
  const { current, previous } = monthly;

  const responseRate = current.contacted > 0
    ? Math.round((current.responses / current.contacted) * 100)
    : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          30 derniers jours
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Statistiques</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Chaque nombre est comparé aux trente jours précédents.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          label="Proposées par le moteur"
          value={current.proposed}
          delta={current.proposed - previous.proposed}
        />
        <MetricCard
          label="Contactées"
          value={current.contacted}
          delta={current.contacted - previous.contacted}
        />
        <MetricCard
          label="Réponses positives"
          value={current.responses}
          delta={current.responses - previous.responses}
          hint={responseRate !== null ? `${responseRate} % des appels` : undefined}
        />
        <MetricCard
          label="Refus"
          value={current.notInterested}
          delta={current.notInterested - previous.notInterested}
          neutral
        />
        <MetricCard
          label="Sans réponse"
          value={current.noResponse}
          delta={current.noResponse - previous.noResponse}
          neutral
        />
        <MetricCard
          label="Clientes signées"
          value={current.clients}
          delta={current.clients - previous.clients}
          won={current.clients > 0}
          hint={stats.client > 0 ? `${stats.client} depuis votre arrivée` : undefined}
        />
      </div>

      <section className="mt-8 rounded-2xl border bg-card px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-sm font-medium">Jour par jour</h2>
          <div className="flex items-center gap-5 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[var(--brand)]" />
              appelées
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
              réponses positives
            </span>
          </div>
        </div>
        <StatsChart data={activity} />
      </section>

      <section className="mt-8 rounded-2xl border bg-card px-6 py-5">
        <h2 className="text-sm font-medium">L’entonnoir du mois</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que deviennent les dossiers, de la proposition à la signature.
        </p>
        <Funnel current={current} />
      </section>
    </main>
  );
}

/**
 * Un compte du mois, avec son mouvement.
 *
 * Le delta ne juge que ce qui se juge : plus d'appels ou plus de clientes
 * est un progrès (vert), plus de refus n'est ni bon ni mauvais — c'est le
 * métier (gris). Un zéro reste gris : pas de culpabilité fabriquée.
 */
function MetricCard({
  label,
  value,
  delta,
  hint,
  neutral = false,
  won = false,
}: {
  label: string;
  value: number;
  delta: number;
  hint?: string | undefined;
  neutral?: boolean;
  won?: boolean;
}) {
  const deltaTone = neutral || delta === 0
    ? 'text-muted-foreground/70'
    : delta > 0
      ? 'text-emerald-600'
      : 'text-muted-foreground/70';

  return (
    <div className="rounded-2xl border bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <p
          className={`tabular font-mono text-3xl font-medium ${
            value === 0 ? 'text-muted-foreground/50' : won ? 'text-emerald-600' : 'text-foreground'
          }`}
        >
          {value}
        </p>
        <p className={`tabular font-mono text-[11px] ${deltaTone}`}>
          {delta > 0 ? `↗ +${delta}` : delta < 0 ? `↘ ${delta}` : '—'}
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {hint ?? 'vs 30 jours précédents'}
      </p>
    </div>
  );
}

/**
 * L'entonnoir : quatre barres, chacune en proportion de la première.
 *
 * Les pourcentages sont relatifs à l'étape d'avant — c'est la conversion
 * qui intéresse, pas la part du total. Les barres poussent de gauche à
 * droite à l'arrivée, en cascade.
 */
function Funnel({ current }: { current: import('@prospect/core').WindowCounts }) {
  const steps: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Proposées', value: current.proposed, tone: 'bg-[var(--brand)]/25' },
    { label: 'Contactées', value: current.contacted, tone: 'bg-[var(--brand)]/55' },
    { label: 'Réponses positives', value: current.responses, tone: 'bg-[var(--brand)]' },
    { label: 'Clientes signées', value: current.clients, tone: 'bg-emerald-500' },
  ];
  const base = Math.max(1, current.proposed);

  return (
    <div className="mt-5 space-y-3">
      {steps.map((step, i) => {
        const prev = steps[i - 1];
        const conversion = prev && prev.value > 0
          ? Math.round((step.value / prev.value) * 100)
          : null;
        return (
          <div key={step.label} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-x-4 sm:grid-cols-[11rem_1fr_auto]">
            <p className="text-xs text-muted-foreground">{step.label}</p>
            <div className="h-7 overflow-hidden rounded-md bg-[var(--mist)]">
              <div
                className={`funnel-bar h-full rounded-md ${step.tone}`}
                style={{
                  width: `${Math.max(step.value > 0 ? 2.5 : 0, (step.value / base) * 100)}%`,
                  animationDelay: `${0.15 + i * 0.18}s`,
                }}
              />
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
