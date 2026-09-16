import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, TIER_LABELS } from '@prospect/core';
import type { DailyOpportunity } from '@/lib/opportunities/mine';

/**
 * Une ligne de la liste : elle mène au dossier, elle ne le contient plus.
 *
 * La liste sert à CHOISIR — métier, ville, premier constat, score, temps
 * restant — et la page du dossier sert à TRAVAILLER : appeler, vérifier le
 * site, noter l'issue. Le <details> qui dépliait tout sur place mélangeait
 * les deux et plafonnait ce qu'un dossier pouvait offrir.
 *
 * Une seule rangée, jamais de repli : le centre tronque à l'ellipse, les
 * extrémités sont fixes.
 */
export function OpportunityRow({ opportunity }: { opportunity: DailyOpportunity }) {
  const { company, explanation } = opportunity;
  const done = opportunity.contactedAt !== null;

  return (
    <Link
      href={`/dashboard/opportunite/${opportunity.assignmentId}`}
      className="group flex items-center gap-4 rounded-2xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(11,13,20,.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(11,13,20,.25)] sm:gap-5 sm:px-6"
    >
      <Score value={opportunity.matchScore} done={done} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight">
          {company.name}
          {company.city ? (
            <span className="font-normal text-muted-foreground"> · {company.city}</span>
          ) : null}
        </span>
        {/* Le premier constat suffit à décider : les autres attendent le dossier. */}
        <span className="mt-1 block truncate text-[15px] leading-snug text-muted-foreground">
          {explanation.headline ?? explanation.signals[0] ?? explanation.why}
        </span>
        {company.google?.rating != null && company.google.reviewCount != null ? (
          <span className="mt-1 block text-xs text-muted-foreground" title="Ce que ses clients en disent sur Google">
            ★ {company.google.rating.toFixed(1).replace('.', ',')} · {company.google.reviewCount} avis Google
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="flex items-center gap-1.5">
          <TierBadge tier={opportunity.tier} />
          {opportunity.audit ? <SiteScore value={opportunity.audit.score} /> : null}
          <span className="rounded-full bg-[var(--brand-wash)] px-2.5 py-1 text-xs font-medium text-[var(--brand)] sm:px-3 sm:py-1.5 sm:text-[13px]">
            {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
          </span>
        </span>
        <Remaining hoursLeft={opportunity.hoursLeft} />
      </span>

      <span
        aria-hidden
        className="hidden shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
      >
        →
      </span>
    </Link>
  );
}

/**
 * La pertinence, telle que le moteur la calcule pour CET utilisateur.
 * Pondérée par ses prestations et sa zone : deux freelances voyant la même
 * entreprise n'y lisent pas le même nombre.
 */
function Score({ value, done }: { value: number; done: boolean }) {
  if (done) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--mist)] text-[var(--brand)]">
        ✓
      </span>
    );
  }

  const intensity = Math.min(1, Math.max(0.55, (value - 45) / 45));

  return (
    <span
      className="tabular grid size-12 shrink-0 place-items-center rounded-xl font-mono text-sm font-medium text-white"
      style={{ backgroundColor: 'var(--brand)', opacity: intensity }}
    >
      {Math.round(value)}
    </span>
  );
}

/** Le temps d'exclusivité restant — corail sous douze heures. */
function Remaining({ hoursLeft }: { hoursLeft: number }) {
  if (hoursLeft <= 0) {
    return <span className="shrink-0 font-mono text-[11px] text-muted-foreground">expiré</span>;
  }

  const label =
    hoursLeft >= 24 ? `${Math.floor(hoursLeft / 24)} j ${hoursLeft % 24} h` : `${hoursLeft} h`;

  return (
    <span
      className="shrink-0 font-mono text-[11px]"
      style={{ color: hoursLeft < 12 ? 'var(--finding)' : 'var(--ink-2)' }}
      title="Temps d’exclusivité restant sur cette entreprise"
    >
      {label}
    </span>
  );
}

/**
 * La note du site, mesurée par le moteur : rouge sous 40, ambre sous 70.
 * C'est l'état du site, pas la pertinence du dossier — les deux nombres
 * disent des choses différentes et ne se confondent pas.
 */
function SiteScore({ value }: { value: number }) {
  const color = value < 40 ? 'var(--finding)' : value < 70 ? 'var(--warning)' : 'var(--ink-2)';
  return (
    <span
      className="tabular rounded-full border px-2 py-1 font-mono text-[11px] font-medium"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
      title="Note du site mesurée par le moteur : vitesse, mobile, bases SEO, confiance"
    >
      site {value}
    </span>
  );
}

/**
 * Le palier, et pourquoi, au survol. Diamant se voit ; Bronze s'efface :
 * l'œil doit aller au dossier qui réunit le plus d'atouts.
 */
function TierBadge({ tier }: { tier: DailyOpportunity['tier'] }) {
  const styles: Record<typeof tier.level, { color: string; bg: string }> = {
    diamant: { color: '#1d4ed8', bg: '#dbeafe' },
    or: { color: '#92400e', bg: '#fef3c7' },
    argent: { color: '#475569', bg: '#f1f5f9' },
    bronze: { color: '#78716c', bg: '#f5f5f4' },
  };
  const s = styles[tier.level];
  return (
    <span
      className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: s.color, backgroundColor: s.bg }}
      title={tier.reasons.length > 0 ? `Réunit ${tier.reasons.join(', ')}` : 'Aucun atout mesuré'}
    >
      {TIER_LABELS[tier.level]}
    </span>
  );
}
