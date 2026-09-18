import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, TIER_LABELS } from '@prospect/core';
import type { DailyOpportunity } from '@/lib/opportunities/mine';
import { Chip, formatHoursLeft } from './ui';

/**
 * Une ligne de la liste : elle mène au dossier, elle ne le contient plus.
 *
 * La liste sert à CHOISIR — métier, ville, premier constat, canaux, score,
 * temps restant — et la page du dossier sert à TRAVAILLER. Une seule
 * rangée, dense : la vignette, le nom et le constat au centre, et à droite
 * la colonne des faits qui font décider, alignée d'une ligne à l'autre.
 */
export function OpportunityRow({ opportunity }: { opportunity: DailyOpportunity }) {
  const { company, explanation } = opportunity;
  const done = opportunity.contactedAt !== null;
  const urgent = !done && opportunity.hoursLeft < 12;

  return (
    <Link
      href={`/dashboard/opportunite/${opportunity.assignmentId}`}
      className={`group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 rounded-xl border bg-card px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_12px_32px_-18px_rgba(11,13,20,.3)] sm:grid-cols-[auto_minmax(0,1fr)_auto] ${done ? 'opacity-70' : ''}`}
    >
      <Tile screenshotUrl={company.screenshotUrl} icon={company.industryIcon} industry={company.industry} done={done} />

      <span className="min-w-0">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold tracking-tight">{company.name}</span>
          {company.city ? <span className="shrink-0 text-[13px] text-muted-foreground">{company.city}</span> : null}
          {company.industry ? <span className="hidden shrink-0 text-[12px] text-muted-foreground/70 md:inline">· {company.industry}</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-[14px] leading-snug text-muted-foreground">
          {explanation.headline ?? explanation.signals[0] ?? explanation.why}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
          <Chip tone="brand">{OPPORTUNITY_TYPE_LABELS[opportunity.type]}</Chip>
          <span className="tabular font-mono text-[11px]" style={{ color: urgent ? 'var(--finding)' : 'var(--ink-2)' }}>{formatHoursLeft(opportunity.hoursLeft)}</span>
        </span>
      </span>

      <span className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
        <span className="flex items-center gap-1.5">
          <TierBadge tier={opportunity.tier} />
          <Chip tone="brand">{OPPORTUNITY_TYPE_LABELS[opportunity.type]}</Chip>
        </span>
        <span className="flex items-center gap-2.5 font-mono text-[11px] text-muted-foreground">
          <Channels phone={!!company.phone} email={!!company.email} form={!!company.contactFormUrl} />
          <span className="tabular" title="Pertinence pour vous : vos prestations, votre zone, la technologie du site">{Math.round(opportunity.matchScore)} %</span>
          <span className="tabular" style={{ color: urgent ? 'var(--finding)' : undefined }} title="Passé ce délai, l’entreprise est proposée à un autre freelance">
            {done ? 'appelée' : `expire ${formatHoursLeft(opportunity.hoursLeft)}`}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Les canaux disponibles, en trois points : plein quand il existe. */
function Channels({ phone, email, form }: { phone: boolean; email: boolean; form: boolean }) {
  const dot = (on: boolean, label: string) => (
    <span title={`${label} ${on ? 'disponible' : 'absent'}`} className={`inline-block size-1.5 rounded-full ${on ? 'bg-[var(--brand)]' : 'border border-[var(--line)]'}`} />
  );
  return (
    <span className="flex items-center gap-1" aria-label="Canaux de contact">
      {dot(phone, 'Téléphone')}{dot(email, 'E-mail')}{dot(form, 'Formulaire')}
    </span>
  );
}

function Tile({
  screenshotUrl, icon, industry, done,
}: {
  screenshotUrl: string | null; icon: string; industry: string | null; done: boolean;
}) {
  if (done) {
    return <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]">✓</span>;
  }
  if (screenshotUrl) {
    return (
      <span className="block size-11 shrink-0 overflow-hidden rounded-lg border bg-[var(--mist)]" title={industry ?? undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- capture distante */}
        <img src={screenshotUrl} alt="" className="size-full object-cover object-top" />
      </span>
    );
  }
  return (
    <span role="img" aria-label={industry ?? 'Commerce'} title={industry ?? undefined} className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--mist)] text-xl leading-none">
      {icon}
    </span>
  );
}

function TierBadge({ tier }: { tier: DailyOpportunity['tier'] }) {
  const icons: Record<typeof tier.level, string> = { diamant: '💎', or: '🥇', argent: '🥈', bronze: '🥉' };
  return (
    <span role="img" aria-label={`Palier ${TIER_LABELS[tier.level]}`} className="text-[15px] leading-none" title={`${TIER_LABELS[tier.level]}${tier.reasons.length > 0 ? ` — réunit ${tier.reasons.join(', ')}` : ' — aucun atout mesuré'}`}>
      {icons[tier.level]}
    </span>
  );
}
