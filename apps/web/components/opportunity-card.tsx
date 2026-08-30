import type { TodayOpportunity } from '@prospect/core';
import { OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import { OutcomeForm } from '@/components/outcome-form';

/**
 * Une opportunité, telle que le freelance la reçoit.
 *
 * La carte est composée comme une pièce de dossier, et l'ordre de lecture est
 * délibéré : d'abord POURQUOI cette entreprise, puis POURQUOI MAINTENANT, et
 * seulement ensuite le moyen de la joindre. Un numéro de téléphone en tête
 * ferait de cette page un annuaire ; or ce qu'un freelance ne peut pas
 * produire seul, c'est la raison.
 *
 * Deux voix typographiques, et c'est la décision qui porte l'écran : le
 * raisonnement du moteur est composé en serif, dans une justification de
 * lecture, parce qu'on lit un argument. Les constats sont en monospace avec
 * leur repère de marge, parce qu'on les vérifie caractère par caractère.
 *
 * Rien n'indique ici qu'une des cinq a été tirée au hasard : la mesurer
 * suppose que le freelance ne puisse pas la reconnaître.
 */
export function OpportunityCard({ opportunity }: { opportunity: TodayOpportunity }) {
  const { company, explanation: why } = opportunity;

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(22,29,26,.04)] transition-shadow duration-300 hover:shadow-[0_2px_12px_rgba(22,29,26,.07)]">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b p-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-xl leading-tight tracking-tight">{company.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[company.industry, company.city].filter(Boolean).join(' · ') || 'Localisation inconnue'}
          </p>
        </div>
        <span className="field-label shrink-0 rounded-full border px-2.5 py-1">
          {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
        </span>
      </header>

      <div className="space-y-6 p-5">
        <Block title="Pourquoi cette entreprise">{why.why}</Block>

        {/* Vide quand rien ne date le contact. Le générateur ne fabrique jamais
            d'urgence, et cette absence est elle-même une information. */}
        {why.whyNow ? <Block title="Pourquoi maintenant">{why.whyNow}</Block> : null}

        <Block title="Par quoi commencer">{why.angle}</Block>

        {why.signals.length > 0 ? (
          <section>
            <h3 className="field-label">Ce qui a été constaté</h3>
            <div className="mt-2">
              {why.signals.map((signal, index) => (
                <p key={signal} className="evidence">
                  <span className="evidence__mark" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="evidence__fact">{signal}</span>
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {why.caveats.length > 0 ? (
          <section className="rounded-lg bg-[var(--finding-wash)] p-4">
            <h3 className="field-label" style={{ color: 'var(--finding)' }}>
              À savoir avant d’appeler
            </h3>
            <ul className="mt-2 space-y-1.5">
              {why.caveats.map((caveat) => (
                <li key={caveat} className="text-sm leading-relaxed text-[var(--finding)]">
                  {caveat}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-5">
          {company.phone ? (
            <a
              href={`tel:${company.phone}`}
              className="font-mono text-base tracking-tight underline-offset-4 hover:underline"
            >
              {formatPhone(company.phone)}
            </a>
          ) : null}
          {company.contactFormUrl ? (
            <ExternalLink href={company.contactFormUrl}>Formulaire de contact</ExternalLink>
          ) : null}
          {company.websiteUrl ? (
            <ExternalLink href={company.websiteUrl}>Voir le site</ExternalLink>
          ) : null}
        </div>

        <OutcomeForm
          assignmentId={opportunity.assignmentId}
          contactedAt={opportunity.contactedAt}
        />
      </div>
    </article>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </a>
  );
}

/** +33241888198 se lit mal ; 02 41 88 81 98 se compose. */
function formatPhone(phone: string): string {
  const french = phone.replace(/^\+33/, '0').replace(/\s/g, '');
  return /^0\d{9}$/.test(french)
    ? french.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
    : phone;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="field-label">{title}</h3>
      {/* La prose du moteur, composée pour être lue. */}
      <p className="reasoning mt-2">{children}</p>
    </section>
  );
}
