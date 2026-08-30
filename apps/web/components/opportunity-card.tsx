import type { TodayOpportunity } from '@prospect/core';
import { OutcomeForm } from '@/components/outcome-form';

/**
 * Le dossier d'une opportunité, déplié.
 *
 * L'ordre de lecture est délibéré : d'abord le PROBLÈME, puis ce qui le
 * prouve, puis ce qu'on ignore encore, et seulement ensuite par quoi
 * commencer et le moyen de joindre. Un numéro de téléphone en tête ferait de
 * cet écran un annuaire ; or ce qu'un freelance ne peut pas produire seul,
 * c'est la raison d'appeler.
 *
 * Chaque bloc porte sa couleur, et chaque couleur porte une fonction : le
 * problème et ses preuves en corail puisqu'ils constatent, la réserve en
 * ambre parce qu'elle suspend le jugement, l'angle d'appel en bleu parce que
 * c'est la seule ligne qui dit quoi FAIRE.
 *
 * L'en-tête appartient à la ligne qui ouvre ce dossier : le répéter ici
 * ferait lire deux fois le nom de l'entreprise.
 *
 * Rien n'indique qu'une des cinq a été tirée au hasard : la mesurer suppose
 * que le freelance ne puisse pas la reconnaître.
 */
export function OpportunityCard({ opportunity }: { opportunity: TodayOpportunity }) {
  const { company, explanation: why } = opportunity;

  return (
    <div>
      <div className="grid gap-x-10 gap-y-8 px-5 py-7 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <section>
            <h3 className="field-label" style={{ color: 'var(--finding)' }}>
              Le problème
            </h3>
            <p className="reasoning mt-2.5">{why.why}</p>
          </section>

          {/* Vide quand rien ne date le contact. Le générateur ne fabrique
              jamais d'urgence, et cette absence est elle-même une information. */}
          {why.whyNow ? (
            <section>
              <h3 className="field-label">Pourquoi maintenant</h3>
              <p className="reasoning mt-2.5">{why.whyNow}</p>
            </section>
          ) : null}
        </div>

        <div className="space-y-5">
          {why.signals.length > 0 ? (
            <section>
              <h3 className="field-label">Ce qui le prouve</h3>
              <ul className="mt-3 space-y-2.5">
                {why.signals.map((signal) => (
                  <li key={signal} className="flex items-start gap-3 text-sm leading-snug">
                    <span
                      aria-hidden
                      className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--finding)]"
                    />
                    {signal}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {why.caveats.length > 0 ? (
            <section
              className="rounded-xl border px-4 py-3.5"
              style={{
                borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--warning) 8%, transparent)',
              }}
            >
              <h3 className="field-label" style={{ color: 'var(--warning)' }}>
                À vérifier avant d’appeler
              </h3>
              <ul className="mt-1.5 space-y-1">
                {why.caveats.map((caveat) => (
                  <li key={caveat} className="text-sm leading-snug" style={{ color: 'var(--warning)' }}>
                    {caveat}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl bg-[var(--brand-wash)] px-4 py-3.5">
            <h3 className="field-label" style={{ color: 'var(--brand)' }}>
              Par quoi commencer
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand)]">{why.angle}</p>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t bg-[var(--mist)] px-5 py-4 sm:px-6">
        {company.phone ? (
          <a
            href={`tel:${company.phone}`}
            className="font-mono text-lg tracking-tight underline-offset-4 hover:underline"
          >
            {formatPhone(company.phone)}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">Pas de numéro publié</span>
        )}
        {company.contactFormUrl ? (
          <ExternalLink href={company.contactFormUrl}>Formulaire de contact</ExternalLink>
        ) : null}
        {company.websiteUrl ? (
          <ExternalLink href={company.websiteUrl}>Voir le site</ExternalLink>
        ) : null}
      </div>

      <div className="px-5 py-5 sm:px-6">
        <OutcomeForm
          assignmentId={opportunity.assignmentId}
          contactedAt={opportunity.contactedAt}
        />
      </div>
    </div>
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
