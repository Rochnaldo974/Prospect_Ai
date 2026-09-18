import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OPPORTUNITY_TYPE_LABELS, getAuditShareForAssignment, getServiceClient } from '@prospect/core';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { shareAudit } from '@/app/dashboard/actions';
import { requireUser } from '@/lib/auth/session';
import { siteOrigin } from '@/lib/site-url';
import { DossierActions } from '@/components/dashboard/dossier-actions';
import { SitePreview } from '@/components/dashboard/site-preview';
import type { DailyOpportunity } from '@/lib/opportunities/mine';
import { Chip, formatHoursLeft } from '@/components/dashboard/ui';

export const metadata: Metadata = { title: 'Dossier' };

/**
 * La page de travail d'un dossier.
 *
 * La liste sert à choisir ; cette page sert à AGIR. Elle est organisée dans
 * l'ordre du geste réel : comprendre en dix secondes pourquoi cette
 * entreprise (le problème, les preuves), pouvoir agir sans chercher
 * (appeler, écrire, ouvrir le site — les gros boutons), vérifier si l'on
 * veut (l'aperçu du site), et rendre compte (l'issue, en bas).
 *
 * Pas de réseau social ici, et c'est un choix, pas un oubli : le service ne
 * collecte aucun profil social — décision de fond, la même qui interdit les
 * e-mails nominatifs. L'e-mail affiché, quand il existe, est une adresse
 * générique relevée sur le site de l'entreprise elle-même.
 */
export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getMyOpportunity(id);
  if (!found) notFound();

  const { opportunity, plan } = found;
  const { company, explanation } = opportunity;
  const snoozed = opportunity.snoozedAt !== null;
  const profile = await requireUser();
  const share = await getAuditShareForAssignment(getServiceClient(), opportunity.assignmentId, profile.id);
  const auditUrl = share ? `${await siteOrigin()}/audit/${share.id}` : null;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <Link
        href={snoozed ? '/dashboard/plus-tard' : '/dashboard'}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← {snoozed ? 'Plus tard' : 'Aujourd’hui'}
      </Link>

      {/* ── L'en-tête : qui, et pourquoi ça compte ── */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">{company.name}</h1>
          <p className="mt-1.5 text-muted-foreground">
            {[company.industry, company.city].filter(Boolean).join(' · ') || 'Localisation inconnue'}
            {company.google?.rating != null && company.google.reviewCount != null ? (
              <>
                {' · '}
                {company.google.mapsUrl ? (
                  <a href={company.google.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline" title="Voir la fiche Google">
                    ★ {company.google.rating.toFixed(1).replace('.', ',')} · {company.google.reviewCount} avis
                  </a>
                ) : (
                  <>★ {company.google.rating.toFixed(1).replace('.', ',')} · {company.google.reviewCount} avis</>
                )}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Chip tone="brand">{OPPORTUNITY_TYPE_LABELS[opportunity.type]}</Chip>
          <span
            className="tabular grid size-11 place-items-center rounded-lg font-mono text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--brand)' }}
            title="Score d’opportunité calculé pour vous"
          >
            {Math.round(opportunity.matchScore)}
          </span>
        </div>
      </header>

      {/* Les faits qui font décider, alignés sous le titre : ce qu'on peut
          faire, ce qui reste, ce que le site vaut. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip tone={company.phone ? 'success' : 'outline'} mono>{company.phone ? '● téléphone' : '○ pas de téléphone'}</Chip>
        <Chip tone={company.email ? 'success' : 'outline'} mono>{company.email ? '● e-mail' : '○ pas d’e-mail'}</Chip>
        <Chip tone={company.contactFormUrl ? 'success' : 'outline'} mono>{company.contactFormUrl ? '● formulaire' : '○ pas de formulaire'}</Chip>
        {opportunity.audit ? <Chip tone={opportunity.audit.score < 40 ? 'finding' : opportunity.audit.score < 70 ? 'warning' : 'neutral'} mono>site {opportunity.audit.score}/100</Chip> : null}
        <Chip tone={opportunity.hoursLeft < 12 ? 'finding' : 'neutral'} mono title="Passé ce délai, l’entreprise est proposée à un autre freelance">
          {opportunity.hoursLeft <= 0 ? 'exclusivité expirée' : `à vous seul encore ${formatHoursLeft(opportunity.hoursLeft)}`}
        </Chip>
        {opportunity.contactedAt ? <Chip tone="success" mono>appelée</Chip> : null}
      </div>

      <DossierActions
        assignmentId={opportunity.assignmentId}
        contactedAt={opportunity.contactedAt}
        snoozed={snoozed}
        phone={company.phone}
        email={company.email}
        contactFormUrl={company.contactFormUrl}
        websiteUrl={company.websiteUrl}
      />

      {/* ── Comprendre : le dossier en dix secondes ── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="panel rounded-xl border bg-card px-6 py-5">
            <h2 className="field-label" style={{ color: 'var(--finding)' }}>Le problème</h2>
            <p className="reasoning mt-2.5">{explanation.why}</p>
            {/* La phrase à dire au téléphone, quand une fiche a été rédigée :
                on ne demande pas au freelance de l'inventer à chaud. */}
            {explanation.opener ? (
              <p className="mt-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-wash)] px-4 py-3 text-sm leading-relaxed text-[var(--brand)]">
                <span className="field-label mr-2">Pour ouvrir l’appel</span>
                {explanation.opener}
              </p>
            ) : null}

            {explanation.whyNow ? (
              <div className="mt-6 border-t pt-5">
                <h2 className="field-label">Pourquoi maintenant</h2>
                <p className="reasoning mt-2.5">{explanation.whyNow}</p>
              </div>
            ) : null}

            <div className="mt-6 rounded-xl bg-[var(--brand-wash)] px-5 py-4">
              <h2 className="field-label" style={{ color: 'var(--brand)' }}>Par quoi commencer</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand)]">{explanation.angle}</p>
            </div>
          </section>

          {/* Les faits bruts : une valeur, une date, une adresse. Ce que le
              freelance peut ouvrir devant son interlocuteur. */}
          {explanation.evidence.length > 0 ? (
            <section className="panel rounded-xl border bg-card px-6 py-5">
              <h2 className="field-label">Mesuré sur le site</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Chaque ligne s’ouvre devant le commerçant : une valeur, une date, une adresse.</p>
              <dl className="mt-3 divide-y rounded-xl border text-sm">
                {explanation.evidence.map((e) => (
                  <div key={`${e.fact}-${e.value}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                    <dt className="text-muted-foreground">{e.fact}</dt>
                    <dd className="font-medium tabular-nums">
                      {e.sourceUrl ? (
                        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{e.value}</a>
                      ) : e.value}
                      {e.observedAt ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">le {new Date(e.observedAt).toLocaleDateString('fr-FR')}</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {opportunity.matchExplanation ? <WhyForYou explanation={opportunity.matchExplanation} /> : null}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {opportunity.audit ? <SiteAudit audit={opportunity.audit} /> : null}

          {explanation.signals.length > 0 ? (
            <section>
              <h2 className="field-label">Ce qui le prouve</h2>
              <ul className="mt-3 space-y-2.5">
                {explanation.signals.map((signal) => (
                  <li key={signal} className="flex items-start gap-3 text-sm leading-snug">
                    <span aria-hidden className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--finding)]" />
                    {signal}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {explanation.caveats.length > 0 ? (
            <section
              className="rounded-xl border px-4 py-3.5"
              style={{
                borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--warning) 8%, transparent)',
              }}
            >
              <h2 className="field-label" style={{ color: 'var(--warning)' }}>À vérifier avant d’appeler</h2>
              <ul className="mt-1.5 space-y-1">
                {explanation.caveats.map((caveat) => (
                  <li key={caveat} className="text-sm leading-snug" style={{ color: 'var(--warning)' }}>
                    {caveat}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel rounded-xl border bg-card p-5">
            <h2 className="field-label">L’entreprise</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              {company.address ? <Row label="Adresse">{company.address}</Row> : null}
              {company.phone ? (
                <Row label="Téléphone">
                  <a href={`tel:${company.phone}`} className="font-mono underline-offset-4 hover:underline">
                    {formatPhone(company.phone)}
                  </a>
                </Row>
              ) : null}
              {company.email ? (
                <Row label="E-mail">
                  <a href={`mailto:${company.email}`} className="underline-offset-4 hover:underline">
                    {company.email}
                  </a>
                </Row>
              ) : null}
              {company.websiteUrl ? (
                <Row label="Site">
                  <a
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all underline-offset-4 hover:underline"
                  >
                    {company.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </Row>
              ) : null}
            </dl>
          </section>

      {/* ── Envoyer : l'audit d'une page, au nom du freelance ── */}
          <section className="panel rounded-xl border bg-card px-5 py-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <h2 className="field-label">Audit à envoyer</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Une page à votre nom : la capture, la note, les constats et votre proposition. Le prospect l’ouvre sans compte ;
              vous saurez quand.
            </p>
            {auditUrl ? (
              <p className="mt-3 break-all font-mono text-[13px]">
                <a href={auditUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] underline-offset-4 hover:underline">{auditUrl}</a>
              </p>
            ) : null}
          </div>
          {share ? (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className="tabular rounded-full border px-3 py-1.5 font-mono text-xs"
                style={{ color: share.openCount > 0 ? 'var(--brand)' : 'var(--ink-2)' }}
              >
                {share.openCount === 0
                  ? 'pas encore ouvert'
                  : `ouvert ${share.openCount} fois${share.lastOpenedAt ? `, dernière le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(share.lastOpenedAt))}` : ''}`}
              </span>
              {company.email ? (
                <Link href={`/dashboard/opportunite/${opportunity.assignmentId}/email`} className="text-sm text-[var(--brand)] underline-offset-4 hover:underline">
                  L’envoyer par e-mail →
                </Link>
              ) : null}
            </div>
          ) : plan === 'premium' ? (
            <form action={shareAudit}>
              <input type="hidden" name="assignmentId" value={opportunity.assignmentId} />
              <button type="submit" className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand-wash)] px-5 py-3 text-sm font-medium text-[var(--brand)] transition-all duration-200 hover:-translate-y-0.5">
                Préparer l’audit
              </button>
            </form>
          ) : (
            <Link href="/dashboard/abonnement" className="rounded-full border px-5 py-3 text-sm text-muted-foreground">
              Réservé au plan Solo
            </Link>
          )}
        </div>
      </section>

        </div>
      </div>

      {/* ── Vérifier : le site tel que ses clients le voient ── */}
      {company.websiteUrl ? (
        <div className="mt-6">
          <SitePreview url={company.websiteUrl} screenshotUrl={company.screenshotUrl} />
        </div>
      ) : null}

    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** +33241888198 se lit mal ; 02 41 88 81 98 se compose. */
function formatPhone(phone: string): string {
  const french = phone.replace(/^\+33/, '0').replace(/\s/g, '');
  return /^0\d{9}$/.test(french)
    ? french.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
    : phone;
}

/**
 * La note du site, telle que le moteur l'a mesurée en vérifiant le dossier.
 *
 * Quatre barres et les constats chiffrés : c'est ce que le freelance peut
 * dire au téléphone sans avoir ouvert le site, et ce que le commerçant peut
 * vérifier lui-même. Aucun avis de goût n'entre ici.
 */
function SiteAudit({ audit }: { audit: NonNullable<DailyOpportunity['audit']> }) {
  const tone = (v: number) => (v < 40 ? 'var(--finding)' : v < 70 ? 'var(--warning)' : 'var(--brand)');
  const bars: Array<{ label: string; value: number }> = [
    { label: 'Vitesse', value: audit.scores.speed },
    { label: 'Téléphone', value: audit.scores.mobile },
    { label: 'Bases SEO', value: audit.scores.seo },
    { label: 'Confiance', value: audit.scores.trust },
  ];
  const measured = audit.measuredAt
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(audit.measuredAt))
    : null;

  return (
    <section className="panel rounded-xl border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="field-label">Note du site</h2>
        <span className="tabular font-mono text-2xl font-semibold" style={{ color: tone(audit.score) }}>
          {audit.score}<span className="text-sm text-muted-foreground">/100</span>
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {bars.map((bar) => (
          <li key={bar.label} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">{bar.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--mist)]">
              <span className="block h-full rounded-full" style={{ width: `${bar.value}%`, backgroundColor: tone(bar.value) }} />
            </span>
            <span className="tabular w-7 text-right font-mono">{bar.value}</span>
          </li>
        ))}
      </ul>
      {audit.findings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t pt-3">
          {audit.findings.slice(0, 5).map((finding) => (
            <li key={finding} className="text-sm leading-snug">{finding}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">Aucun défaut mesurable : le site tient la route techniquement.</p>
      )}
      {measured ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Mesuré par le moteur le {measured}, en ouvrant le site comme un visiteur.</p>
      ) : null}
    </section>
  );
}

/**
 * Pourquoi ce dossier pour cette personne : la décomposition du rang, telle
 * que le moteur l'a calculée le matin de l'attribution. Cinq composantes sur
 * cent, et leur poids.
 */
function WhyForYou({ explanation }: { explanation: NonNullable<DailyOpportunity['matchExplanation']> }) {
  const rows: { label: string; value: number; weight: number }[] = [
    { label: 'Proximité', value: explanation.geo, weight: explanation.weights.geo },
    { label: 'Technologie', value: explanation.technology, weight: explanation.weights.technology },
    { label: 'Secteur', value: explanation.industry, weight: explanation.weights.industry },
    { label: 'Fraîcheur', value: explanation.freshness, weight: explanation.weights.freshness },
    { label: 'Solidité du dossier', value: explanation.quality, weight: explanation.weights.quality },
  ];
  return (
    <section className="panel rounded-xl border bg-card p-5">
      <h2 className="field-label">Pourquoi pour vous</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Qualité du dossier {Math.round(explanation.base)} × 0,7 + adéquation {Math.round(explanation.fit)} × 0,3 = {Math.round(explanation.match)}.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span>{row.label} <span className="text-xs text-muted-foreground">× {row.weight.toFixed(2).replace('.', ',')}</span></span>
              <span className="tabular-nums font-medium">{Math.round(row.value)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.max(2, Math.min(100, row.value))}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
