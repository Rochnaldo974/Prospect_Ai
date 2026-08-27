import type { Opportunity } from '@prospect/core';
import { OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import { Pill, ScoreBadge, formatDate } from './primitives';

interface ReasonData {
  trigger?: string;
  formula?: string;
  need_breakdown?: { signal: string; contribution: number }[];
}

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Component({
  label,
  value,
  display,
  note,
}: {
  label: string;
  value: number;
  display: string;
  note: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{display}</span>
      </div>
      <div className="mt-1">
        <Bar value={value} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

/**
 * Décomposition complète du score d'une opportunité.
 *
 * L'objectif est qu'aucune recommandation ne soit une boîte noire : on doit
 * pouvoir lire pourquoi le moteur propose cette entreprise, et surtout
 * repérer quand il a tort.
 */
export function ScoreBreakdown({ opportunity }: { opportunity: Opportunity }) {
  const reason = (opportunity.reason_data ?? {}) as ReasonData;

  const need = Number(opportunity.need_score);
  const timing = Number(opportunity.timing_score);
  const freshness = Number(opportunity.freshness_factor);
  const confidence = Number(opportunity.confidence_score);
  const base = Number(opportunity.base_score);

  const weighted = need * 0.55 + timing * 0.45;
  const confidenceFactor = 0.4 + 0.6 * confidence;

  return (
    <article className="rounded-lg border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {OPPORTUNITY_TYPE_LABELS[opportunity.opportunity_type]}
          </h3>
          <Pill tone={opportunity.status === 'available' ? 'success' : 'neutral'}>
            {opportunity.status}
          </Pill>
          {base < 55 ? <Pill tone="danger">sous le seuil du gate</Pill> : null}
          {confidence < 0.6 ? <Pill tone="danger">confiance insuffisante</Pill> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>algo {opportunity.algorithm_version}</span>
          <span>expire le {formatDate(opportunity.expires_at)}</span>
          <ScoreBadge score={base} />
        </div>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Component
          label="Besoin"
          value={need}
          display={need.toFixed(0)}
          note="L’entreprise semble-t-elle avoir besoin du service ?"
        />
        <Component
          label="Timing"
          value={timing}
          display={timing.toFixed(0)}
          note="Y a-t-il une raison de contacter maintenant ?"
        />
        <Component
          label="Fraîcheur"
          value={freshness * 100}
          display={`×${freshness.toFixed(3)}`}
          note="Atténuateur : décroissance exponentielle depuis l’événement."
        />
        <Component
          label="Confiance"
          value={confidence * 100}
          display={`×${confidenceFactor.toFixed(3)}`}
          note={`Confiance ${confidence.toFixed(2)} ramenée dans [0,40 – 1,00].`}
        />
      </div>

      <div className="mt-4 rounded-md bg-muted/50 p-3 font-mono text-xs">
        <div className="text-muted-foreground">
          ({need.toFixed(0)} × 0,55 + {timing.toFixed(0)} × 0,45) × {freshness.toFixed(3)} ×{' '}
          {confidenceFactor.toFixed(3)}
        </div>
        <div className="mt-1">
          = {weighted.toFixed(1)} × {freshness.toFixed(3)} × {confidenceFactor.toFixed(3)} ={' '}
          <strong>{base.toFixed(2)}</strong>
        </div>
      </div>

      {reason.trigger ? (
        <p className="mt-3 text-xs">
          <span className="text-muted-foreground">Déclencheur : </span>
          <span className="font-mono">{reason.trigger}</span>
        </p>
      ) : null}

      {reason.need_breakdown?.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {reason.need_breakdown.map((item) => (
            <li key={item.signal}>
              <Pill>
                {item.signal} +{item.contribution}
              </Pill>
            </li>
          ))}
        </ul>
      ) : null}

      {opportunity.ai_explanation ? (
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <p>{opportunity.ai_explanation}</p>
          {opportunity.ai_why_now ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Pourquoi maintenant : </span>
              {opportunity.ai_why_now}
            </p>
          ) : null}
          {opportunity.ai_contact_angle ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Angle suggéré : </span>
              {opportunity.ai_contact_angle}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
