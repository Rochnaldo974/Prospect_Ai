import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { toggleSnooze } from '@/app/dashboard/actions';
import { OutcomeForm } from '@/components/outcome-form';
import { SitePreview } from '@/components/dashboard/site-preview';

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

  const { opportunity } = found;
  const { company, explanation } = opportunity;
  const snoozed = opportunity.snoozedAt !== null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href={snoozed ? '/dashboard/plus-tard' : '/dashboard'}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← {snoozed ? 'Plus tard' : 'Ce matin'}
      </Link>

      {/* ── L'en-tête : qui, et pourquoi ça compte ── */}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">{company.name}</h1>
          <p className="mt-1.5 text-muted-foreground">
            {[company.industry, company.city].filter(Boolean).join(' · ') || 'Localisation inconnue'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[var(--brand-wash)] px-3.5 py-1.5 text-sm font-medium text-[var(--brand)]">
            {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
          </span>
          <span
            className="tabular grid size-12 place-items-center rounded-xl font-mono text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--brand)' }}
            title="Score d’opportunité calculé pour vous"
          >
            {Math.round(opportunity.matchScore)}
          </span>
        </div>
      </header>

      <Exclusivity hoursLeft={opportunity.hoursLeft} />

      {/* ── Agir : les gestes, sans chercher ── */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {company.phone ? (
          <a
            href={`tel:${company.phone}`}
            className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-all duration-200 hover:-translate-y-0.5"
          >
            Appeler · {formatPhone(company.phone)}
          </a>
        ) : null}
        {/* L'e-mail vit sur sa propre page : brouillon, signature, aperçu
            fidèle et envoi direct. Sans adresse relevée, le bouton reste
            VISIBLE mais éteint, la raison écrite dessus : le cacher ferait
            croire à un bug d'un dossier à l'autre, le laisser actif ferait
            payer un clic pour une impasse. */}
        {company.email ? (
          <Link
            href={`/dashboard/opportunite/${opportunity.assignmentId}/email`}
            className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand-wash)] px-6 py-3 text-sm font-medium text-[var(--brand)] transition-all duration-200 hover:-translate-y-0.5"
          >
            E-mail personnalisé
          </Link>
        ) : (
          <span
            className="cursor-not-allowed rounded-full border border-dashed px-6 py-3 text-sm text-muted-foreground"
            title="Le site de cette entreprise ne publie aucune adresse e-mail générique. Le téléphone reste la meilleure voie."
          >
            E-mail — aucune adresse publiée
          </span>
        )}
        {company.contactFormUrl ? (
          <ActionLink href={company.contactFormUrl} external>Formulaire de contact</ActionLink>
        ) : null}
        {company.websiteUrl ? (
          <ActionLink href={company.websiteUrl} external>Voir le site</ActionLink>
        ) : null}

        {/* Le marque-page. À l'écart des gestes de contact : il ne parle pas
            au prospect, il parle à votre journée. */}
        <form action={toggleSnooze} className="ml-auto">
          <input type="hidden" name="assignmentId" value={opportunity.assignmentId} />
          <input type="hidden" name="snoozed" value={snoozed ? 'false' : 'true'} />
          <button
            type="submit"
            className="rounded-full border px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
          >
            {snoozed ? 'Remettre dans ma journée' : 'Plus tard'}
          </button>
        </form>
      </div>

      {/* ── Comprendre : le dossier en dix secondes ── */}
      <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-7">
          <section>
            <h2 className="field-label" style={{ color: 'var(--finding)' }}>Le problème</h2>
            <p className="reasoning mt-2.5">{explanation.why}</p>
          </section>

          {explanation.whyNow ? (
            <section>
              <h2 className="field-label">Pourquoi maintenant</h2>
              <p className="reasoning mt-2.5">{explanation.whyNow}</p>
            </section>
          ) : null}

          <section className="rounded-xl bg-[var(--brand-wash)] px-5 py-4">
            <h2 className="field-label" style={{ color: 'var(--brand)' }}>Par quoi commencer</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--brand)]">{explanation.angle}</p>
          </section>
        </div>

        <div className="space-y-6">
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

          <section className="rounded-2xl border bg-card p-5">
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
        </div>
      </div>

      {/* ── Vérifier : le site tel que ses clients le voient ── */}
      {company.websiteUrl ? (
        <div className="mt-10">
          <SitePreview url={company.websiteUrl} />
        </div>
      ) : null}

      {/* ── Rendre compte ── */}
      <div className="mt-10 rounded-2xl border bg-card px-5 py-4 sm:px-6">
        <OutcomeForm
          assignmentId={opportunity.assignmentId}
          contactedAt={opportunity.contactedAt}
        />
      </div>
    </main>
  );
}

/** Le temps d'exclusivité, en toutes lettres — corail quand il presse. */
function Exclusivity({ hoursLeft }: { hoursLeft: number }) {
  if (hoursLeft <= 0) {
    return <p className="mt-3 font-mono text-xs text-muted-foreground">Exclusivité expirée</p>;
  }
  const urgent = hoursLeft < 12;
  const label = hoursLeft >= 24
    ? `${Math.floor(hoursLeft / 24)} j ${hoursLeft % 24} h`
    : `${hoursLeft} h`;

  return (
    <p
      className="mt-3 font-mono text-xs"
      style={{ color: urgent ? 'var(--finding)' : 'var(--ink-2)' }}
    >
      Ce dossier est à vous seul encore {label}
      {urgent ? ' — il repartira dans le circuit ensuite' : ''}
    </p>
  );
}

function ActionLink({
  href, external = false, children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="rounded-full border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
    >
      {children}
    </a>
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
