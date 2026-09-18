import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, TIER_LABELS, type OutcomeStats } from '@prospect/core';
import type { DailyOpportunity } from '@/lib/opportunities/mine';
import { Bar, Panel, ProgressRing, formatHoursLeft } from './ui';

/**
 * Le rail de contexte : ce qui tient la page pleine et utile.
 *
 * Aucune donnée nouvelle ici — les mêmes dossiers, les mêmes issues, lus
 * autrement : où en est la journée, ce qui expire en premier, ce que les
 * appels ont produit, de quoi le lot est fait. Chaque bloc tient en un
 * regard et mène quelque part.
 */

/** La journée : l'anneau, puis chaque dossier avec son état. */
export function DayCard({ opportunities }: { opportunities: DailyOpportunity[] }) {
  const total = opportunities.length;
  const done = opportunities.filter((o) => o.contactedAt !== null).length;
  return (
    <Panel eyebrow="Votre journée" title={total === 0 ? 'Rien à traiter' : done === total ? 'Tout est traité' : `${total - done} à appeler`}>
      <ProgressRing
        done={done}
        total={total}
        label={total > 0 ? <span>{done} {done > 1 ? 'appelées' : 'appelée'} sur {total}<br /><span className="text-xs">chacune réservée 72 h</span></span> : <span className="text-xs">Le prochain lot arrive demain matin.</span>}
      />
      {total > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {[...opportunities].sort((a, b) => Number(a.contactedAt !== null) - Number(b.contactedAt !== null) || a.hoursLeft - b.hoursLeft).slice(0, 8).map((o) => (
            <li key={o.assignmentId}>
              <Link href={`/dashboard/opportunite/${o.assignmentId}`} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-[13px] transition-colors hover:bg-[var(--mist)]">
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${o.contactedAt ? 'bg-[var(--success)]' : o.hoursLeft < 12 ? 'bg-[var(--finding)]' : 'border border-[var(--ink-2)]/50'}`} />
                <span className={`min-w-0 flex-1 truncate ${o.contactedAt ? 'text-muted-foreground line-through decoration-[var(--line)]' : ''}`}>{o.company.name}</span>
                <span className="tabular shrink-0 font-mono text-[11px] text-muted-foreground">{o.contactedAt ? 'fait' : formatHoursLeft(o.hoursLeft)}</span>
              </Link>
            </li>
          ))}
          {opportunities.length > 8 ? (
            <li className="px-1.5 pt-1 text-[11px] text-muted-foreground">et {opportunities.length - 8} autres dans la liste</li>
          ) : null}
        </ul>
      ) : null}
    </Panel>
  );
}

/** Les échéances : ce qui repart dans le circuit en premier. */
export function DeadlinesCard({ opportunities, title = 'Échéances' }: { opportunities: DailyOpportunity[]; title?: string }) {
  const open = opportunities.filter((o) => o.contactedAt === null).sort((a, b) => a.hoursLeft - b.hoursLeft).slice(0, 6);
  if (open.length === 0) return null;
  const horizon = 72;
  return (
    <Panel eyebrow={title} title="Exclusivité restante" aside="sur 72 h">
      <ul className="space-y-2.5">
        {open.map((o) => {
          const pct = Math.max(2, Math.min(100, (o.hoursLeft / horizon) * 100));
          const urgent = o.hoursLeft < 12;
          return (
            <li key={o.assignmentId}>
              <Link href={`/dashboard/opportunite/${o.assignmentId}`} className="block rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--mist)]">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">{o.company.name}</span>
                  <span className="tabular shrink-0 font-mono text-[11px]" style={{ color: urgent ? 'var(--finding)' : 'var(--ink-2)' }}>{formatHoursLeft(o.hoursLeft)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--mist)]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: urgent ? 'var(--finding)' : 'var(--brand)' }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Le pipeline : ce que les appels ont produit, de l'appel au client. */
export function PipelineCard({ stats, href = '/dashboard/suivi' }: { stats: OutcomeStats; href?: string }) {
  const steps: Array<[string, number, string]> = [
    ['Appelées', stats.contacted, 'color-mix(in srgb, var(--brand) 35%, transparent)'],
    ['Intéressées', stats.interested, 'color-mix(in srgb, var(--brand) 60%, transparent)'],
    ['Rendez-vous', stats.meeting, 'var(--brand)'],
    ['Devis', stats.proposal, 'var(--brand)'],
    ['Clients', stats.client, 'var(--success)'],
  ];
  const max = Math.max(1, ...steps.map((s) => s[1]));
  return (
    <Panel eyebrow="Pipeline" title="Depuis votre arrivée" aside={<Link href={href} className="text-[var(--brand)] underline-offset-4 hover:underline">À relancer →</Link>}>
      {stats.contacted === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">Vos premiers appels dessineront ce tunnel : appelées, intéressées, rendez-vous, devis, clients.</p>
      ) : (
        <div className="space-y-2.5">
          {steps.map(([label, value, color]) => <Bar key={label} label={label} value={value} max={max} color={color} />)}
        </div>
      )}
    </Panel>
  );
}

/** De quoi le lot est fait : familles, paliers, canaux. */
export function MixCard({ opportunities }: { opportunities: DailyOpportunity[] }) {
  if (opportunities.length === 0) return null;
  const byType = new Map<string, number>();
  const byTier = new Map<string, number>();
  let phone = 0; let email = 0; let form = 0;
  for (const o of opportunities) {
    byType.set(o.type, (byType.get(o.type) ?? 0) + 1);
    byTier.set(o.tier.level, (byTier.get(o.tier.level) ?? 0) + 1);
    if (o.company.phone) phone += 1;
    if (o.company.email) email += 1;
    if (o.company.contactFormUrl) form += 1;
  }
  const n = opportunities.length;
  return (
    <Panel eyebrow="Le lot" title={`${n} ${n > 1 ? 'dossiers' : 'dossier'}`}>
      <div className="space-y-2.5">
        {[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => (
          <Bar key={type} label={OPPORTUNITY_TYPE_LABELS[type as keyof typeof OPPORTUNITY_TYPE_LABELS] ?? type} value={count} max={n} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
        {[['Téléphone', phone], ['E-mail', email], ['Formulaire', form]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[var(--mist)] px-2 py-2">
            <p className={`tabular font-mono text-lg font-medium leading-none ${value === 0 ? 'text-muted-foreground/45' : ''}`}>{value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {(['diamant', 'or', 'argent', 'bronze'] as const).filter((t) => byTier.get(t)).map((t) => (
          <span key={t}>{TIER_LABELS[t]} <span className="tabular font-mono text-foreground">{byTier.get(t)}</span></span>
        ))}
      </p>
    </Panel>
  );
}

/** Le rappel du plan gratuit, à sa place dans le rail. */
export function PlanCard({ plan }: { plan: 'free' | 'premium' }) {
  if (plan !== 'free') return null;
  return (
    <Panel tone="brand" eyebrow="Plan gratuit" title="Un dossier par semaine">
      <p className="text-[13px] leading-relaxed text-[var(--brand)]/80">Le plan Solo en livre cinq par jour, avec l’e-mail prêt à envoyer et l’audit à votre nom.</p>
      <Link href="/dashboard/abonnement" className="mt-3 inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-[13px] font-medium text-white transition-transform duration-200 hover:-translate-y-px">
        Voir le plan Solo
      </Link>
    </Panel>
  );
}
