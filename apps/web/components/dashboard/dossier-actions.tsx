import Link from 'next/link';
import { declareOptOut, toggleSnooze } from '@/app/dashboard/actions';
import { OutcomeForm } from '@/components/outcome-form';
import { formatPhone } from './ui';

/**
 * Tout ce que le freelance FAIT sur un dossier, en un panneau sous le titre.
 *
 * Deux rangées, deux moments. « Joindre » : les gestes vers le prospect.
 * « Rendre compte » : ce que le geste a donné, puis le sort du dossier.
 *
 * Une seule famille de boutons, même taille, même forme : un plein par
 * rangée — le geste principal — et des contours pour le reste. Ce qui n'est
 * pas possible reste à sa place, grisé, avec la raison au survol : le
 * cacher ferait croire à un bug d'un dossier à l'autre. « Ne pas
 * prospecter » a le même contour que les autres et ne se colore qu'au
 * survol : définitif, il se confirme en deux temps.
 */
export const PILL = 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium leading-none transition-all duration-150';
export const PILL_PRIMARY = `${PILL} bg-[var(--brand)] text-white shadow-[0_8px_24px_-10px_rgba(44,75,255,.55)] hover:-translate-y-px`;
export const PILL_OUTLINE = `${PILL} border border-[var(--line)] bg-card text-foreground hover:border-foreground/25 hover:bg-[var(--mist)]`;
export const PILL_DISABLED = `${PILL} cursor-not-allowed border border-[var(--line)] bg-card text-muted-foreground/60`;
export const PILL_DANGER = `${PILL} cursor-pointer select-none border border-[var(--line)] bg-card text-muted-foreground hover:border-[var(--finding)]/50 hover:bg-[var(--finding-wash)] hover:text-[var(--finding)]`;

const I = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  form: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  site: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  check: <path d="M5 12l4 4L19 7" />,
  later: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
  stop: <><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></>,
} as const;

export function Icon({ name }: { name: keyof typeof I }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {I[name]}
    </svg>
  );
}

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
    <section className="panel mt-5 rounded-xl border bg-card" aria-label="Actions sur le dossier">
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <span className="eyebrow mr-2 w-full sm:w-auto">Joindre</span>
        {phone ? (
          <a href={`tel:${phone}`} className={PILL_PRIMARY}><Icon name="phone" />Appeler · {formatPhone(phone)}</a>
        ) : (
          <span className={PILL_DISABLED} title="Aucun numéro relevé pour cette entreprise."><Icon name="phone" />Aucun numéro</span>
        )}
        {email ? (
          <Link href={`/dashboard/opportunite/${assignmentId}/email`} className={PILL_OUTLINE}><Icon name="mail" />E-mail personnalisé</Link>
        ) : (
          <span className={PILL_DISABLED} title="Le site de cette entreprise ne publie aucune adresse e-mail générique. Le téléphone reste la meilleure voie."><Icon name="mail" />Aucune adresse publiée</span>
        )}
        {contactFormUrl ? (
          <a href={contactFormUrl} target="_blank" rel="noopener noreferrer" className={PILL_OUTLINE}><Icon name="form" />Formulaire de contact</a>
        ) : null}
        {websiteUrl ? (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className={PILL_OUTLINE}><Icon name="site" />Voir le site</a>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-x-2 gap-y-3 border-t bg-[var(--mist)]/50 px-5 py-4">
        <span className="eyebrow mr-2 w-full pt-3 sm:w-auto">Rendre compte</span>
        <div className="min-w-0 flex-1">
          <OutcomeForm assignmentId={assignmentId} contactedAt={contactedAt} />
        </div>

        {/* Le sort du dossier, à part des issues : garder, ou retirer. */}
        <div className="flex w-full flex-wrap items-center gap-2 border-t pt-3 sm:w-auto sm:border-t-0 sm:pt-0">
          <form action={toggleSnooze}>
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="snoozed" value={snoozed ? 'false' : 'true'} />
            <button type="submit" className={PILL_OUTLINE} title={snoozed ? 'Le dossier revient dans Aujourd’hui' : 'Le dossier passe dans Plus tard ; l’exclusivité court toujours'}>
              <Icon name="later" />{snoozed ? 'Remettre dans ma journée' : 'Plus tard'}
            </button>
          </form>

          <details className="group relative">
            <summary className={`${PILL_DANGER} list-none [&::-webkit-details-marker]:hidden group-open:border-[var(--finding)]/50 group-open:text-[var(--finding)]`}>
              <Icon name="stop" />Ne pas prospecter
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
                <button type="submit" className={`${PILL} w-full justify-center bg-[var(--finding)] text-white hover:-translate-y-px`}>
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
