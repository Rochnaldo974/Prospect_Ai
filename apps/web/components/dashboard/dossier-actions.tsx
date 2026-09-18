import Link from 'next/link';
import { declareOptOut, toggleSnooze } from '@/app/dashboard/actions';
import { OutcomeForm } from '@/components/outcome-form';
import { formatPhone } from './ui';

/**
 * Tout ce que le freelance FAIT sur un dossier, en un panneau sous le titre.
 *
 * Deux rangées, deux moments. « Joindre » : les gestes vers le prospect —
 * appeler, écrire, ouvrir le formulaire ou le site. « Rendre compte » : ce
 * que le geste a donné, puis le sort du dossier — le garder pour plus
 * tard, ou le retirer du service parce que l'entreprise l'a demandé.
 *
 * « Ne pas prospecter » est visible en permanence : un commerçant peut le
 * dire dès le premier appel. Mais c'est définitif, donc en deux temps —
 * le bouton ouvre la confirmation, la confirmation retire. Pas de boîte de
 * dialogue du navigateur : un <details> natif, qui marche sans script.
 */
export function DossierActions({
  assignmentId, contactedAt, snoozed, phone, email, contactFormUrl, websiteUrl,
}: {
  assignmentId: string;
  contactedAt: string | null;
  snoozed: boolean;
  phone: string | null;
  email: string | null;
  contactFormUrl: string | null;
  websiteUrl: string | null;
}) {
  return (
    <section className="panel mt-5 overflow-hidden rounded-xl border bg-card" aria-label="Actions sur le dossier">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2.5 px-5 py-4">
        <span className="eyebrow mr-1.5 w-full sm:w-auto">Joindre</span>
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-all duration-200 hover:-translate-y-0.5"
          >
            Appeler · {formatPhone(phone)}
          </a>
        ) : (
          <Disabled title="Aucun numéro relevé pour cette entreprise.">Appeler — aucun numéro</Disabled>
        )}
        {email ? (
          <Link
            href={`/dashboard/opportunite/${assignmentId}/email`}
            className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand-wash)] px-5 py-2.5 text-sm font-medium text-[var(--brand)] transition-all duration-200 hover:-translate-y-0.5"
          >
            E-mail personnalisé
          </Link>
        ) : (
          <Disabled title="Le site de cette entreprise ne publie aucune adresse e-mail générique. Le téléphone reste la meilleure voie.">
            E-mail — aucune adresse publiée
          </Disabled>
        )}
        {contactFormUrl ? <Outline href={contactFormUrl} external>Formulaire de contact</Outline> : null}
        {websiteUrl ? <Outline href={websiteUrl} external>Voir le site</Outline> : null}
      </div>

      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-3 border-t bg-[var(--mist)]/50 px-5 py-4">
        <span className="eyebrow mr-1.5 w-full pt-2.5 sm:w-auto">Rendre compte</span>
        <div className="min-w-0 flex-1">
          <OutcomeForm assignmentId={assignmentId} contactedAt={contactedAt} />
        </div>

        {/* Le sort du dossier, à part des issues : garder, ou retirer. */}
        <div className="flex w-full flex-wrap items-center gap-2 border-t pt-3 sm:w-auto sm:border-t-0 sm:pt-0">
          <form action={toggleSnooze}>
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="snoozed" value={snoozed ? 'false' : 'true'} />
            <button type="submit" className="rounded-full border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--mist)]" title={snoozed ? 'Le dossier revient dans Aujourd’hui' : 'Le dossier passe dans Plus tard ; l’exclusivité court toujours'}>
              {snoozed ? 'Remettre dans ma journée' : 'Plus tard'}
            </button>
          </form>

          <details className="group relative">
            <summary className="list-none cursor-pointer select-none rounded-full border border-[var(--finding)]/40 bg-card px-4 py-2.5 text-sm font-medium text-[var(--finding)] transition-colors hover:bg-[var(--finding-wash)] [&::-webkit-details-marker]:hidden">
              Ne pas prospecter
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-[var(--finding)]/30 bg-card p-4 shadow-[0_20px_50px_-20px_rgba(11,13,20,.35)]">
              <p className="text-sm font-semibold">Retirer cette entreprise du service ?</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                À réserver au cas où l’entreprise vous a demandé de ne plus être contactée. Elle ne sera plus jamais proposée, ni à vous ni à un autre freelance. Ce n’est pas un « pas intéressé ».
              </p>
              <form action={declareOptOut} className="mt-3 space-y-2.5">
                <input type="hidden" name="assignmentId" value={assignmentId} />
                <input
                  type="text"
                  name="notes"
                  maxLength={500}
                  placeholder="Ce qu’elle a dit, facultatif"
                  className="w-full rounded-lg border bg-[var(--mist)] px-3 py-2 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--finding)]"
                />
                <button type="submit" className="w-full rounded-full bg-[var(--finding)] px-4 py-2.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px">
                  Confirmer : ne plus jamais la proposer
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function Disabled({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span className="cursor-not-allowed rounded-full border border-dashed px-5 py-2.5 text-sm text-muted-foreground" title={title}>
      {children}
    </span>
  );
}

function Outline({ href, external = false, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="rounded-full border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
    >
      {children}
    </a>
  );
}
