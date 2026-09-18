import { OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import type { HistoryItem } from '@/lib/history-filter';
import { Bar, Panel } from './ui';

/**
 * Le résumé de l'historique : ce que les issues disent une fois comptées.
 * Rien de nouveau, tout vient des mêmes lignes — par issue, par mission,
 * par ville, et le rythme des dernières semaines.
 */
const OUTCOMES: Array<[string, string, string]> = [
  ['client', 'Clients signés', 'var(--success)'],
  ['proposal', 'Devis envoyés', 'var(--brand)'],
  ['meeting', 'Rendez-vous', 'var(--brand)'],
  ['interested', 'Intéressés', 'color-mix(in srgb, var(--brand) 60%, transparent)'],
  ['not_interested', 'Pas intéressés', 'var(--ink-2)'],
  ['no_response', 'Sans réponse', 'var(--line)'],
];

export function HistorySummary({ entries }: { entries: HistoryItem[] }) {
  if (entries.length === 0) return null;
  const count = (fn: (e: HistoryItem) => boolean) => entries.filter(fn).length;
  const positive = count((e) => ['client', 'proposal', 'meeting', 'interested'].includes(e.outcome));
  const byType = new Map<string, number>();
  const byCity = new Map<string, number>();
  for (const e of entries) {
    byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
    if (e.company.city) byCity.set(e.company.city, (byCity.get(e.company.city) ?? 0) + 1);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const last30 = count((e) => new Date(e.outcomeAt) >= cutoff);
  const max = Math.max(1, ...OUTCOMES.map(([k]) => count((e) => e.outcome === k)));

  return (
    <>
      <Panel eyebrow="Résumé" title={`${entries.length} ${entries.length > 1 ? 'dossiers traités' : 'dossier traité'}`} aside={`${last30} sur 30 j`}>
        <div className="space-y-2.5">
          {OUTCOMES.filter(([k]) => count((e) => e.outcome === k) > 0).map(([k, label, color]) => (
            <Bar key={k} label={label} value={count((e) => e.outcome === k)} max={max} color={color} />
          ))}
        </div>
        <p className="mt-3 border-t pt-3 text-[12px] text-muted-foreground">
          <span className="tabular font-mono text-foreground">{entries.length > 0 ? Math.round((positive / entries.length) * 100) : 0} %</span> d’issues positives sur l’ensemble.
        </p>
      </Panel>
      <Panel eyebrow="Par mission" title="Ce que vous avez traité">
        <div className="space-y-2.5">
          {[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => (
            <Bar key={type} label={OPPORTUNITY_TYPE_LABELS[type as keyof typeof OPPORTUNITY_TYPE_LABELS] ?? type} value={n} max={entries.length} />
          ))}
        </div>
      </Panel>
      {byCity.size > 0 ? (
        <Panel eyebrow="Par ville" title="Où vous avez appelé">
          <ul className="space-y-1.5 text-[13px]">
            {[...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([city, n]) => (
              <li key={city} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{city}</span>
                <span className="tabular font-mono text-[11px] text-muted-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
