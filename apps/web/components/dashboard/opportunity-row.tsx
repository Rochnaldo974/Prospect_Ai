import { OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import type { DailyOpportunity } from '@/lib/opportunities/mine';
import { OpportunityCard } from '@/components/opportunity-card';

/**
 * Une opportunité, repliée.
 *
 * Cinq dossiers dépliés font une page de deux mille mots qu'on parcourt au
 * pouce. Le freelance a dix minutes : il lui faut d'abord CHOISIR lequel
 * appeler, et pour choisir il n'a besoin que du métier, de la ville et du
 * défaut. Le dossier s'ouvre ensuite, sur celui qu'il a retenu.
 *
 * Un <details> plutôt qu'un état React : l'ouverture fonctionne sans
 * JavaScript, se pilote au clavier, et le navigateur gère déjà tout.
 *
 * La première ligne est ouverte d'emblée. Une liste entièrement fermée oblige
 * à un clic avant de voir quoi que ce soit, et donne l'impression d'une page
 * vide.
 */
export function OpportunityRow({
  opportunity,
  open,
}: {
  opportunity: DailyOpportunity;
  open: boolean;
}) {
  const { company, explanation } = opportunity;
  const done = opportunity.contactedAt !== null;

  return (
    <details
      open={open}
      className="group overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04)]"
    >
      {/* Une seule rangée, jamais de repli : sur 390 px de large, le
          flex-wrap éclatait le nom sur trois lignes et tronquait le constat
          à une lettre. Le centre tronque, les extrémités sont fixes, et la
          prestation s'empile au-dessus du temps restant à droite. */}
      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 transition-colors hover:bg-[var(--mist)] sm:gap-5 sm:px-6">
        <Score value={opportunity.matchScore} done={done} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {company.name}
            {company.city ? (
              <span className="font-normal text-muted-foreground"> · {company.city}</span>
            ) : null}
          </p>
          {/* Le premier constat suffit à décider : les autres attendent
              l'ouverture du dossier. */}
          <p className="mt-1 truncate text-[15px] leading-snug text-muted-foreground">
            {explanation.signals[0] ?? explanation.why}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full bg-[var(--brand-wash)] px-2.5 py-1 text-xs font-medium text-[var(--brand)] sm:px-3 sm:py-1.5 sm:text-[13px]">
            {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
          </span>
          <Remaining hoursLeft={opportunity.hoursLeft} />
        </div>

        <span
          aria-hidden
          className="hidden shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 sm:block"
        >
          +
        </span>
      </summary>

      <div className="border-t">
        <OpportunityCard opportunity={opportunity} />
      </div>
    </details>
  );
}

/**
 * La pertinence, telle que le moteur la calcule pour CET utilisateur.
 *
 * Ce n'est pas la note de l'opportunité seule : elle est pondérée par
 * l'adéquation avec les prestations et la zone déclarées. Deux freelances
 * voyant la même entreprise n'y liront pas le même nombre, et l'étiquette
 * de la liste le dit.
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

/**
 * Le temps d'exclusivité restant.
 *
 * L'exclusivité de 72 heures est la promesse la plus concrète du service, et
 * elle n'était nulle part à l'écran : le freelance ne pouvait pas savoir
 * qu'une entreprise allait lui échapper. Rendu sur le serveur à chaque
 * requête — un compte à rebours animé demanderait du JavaScript pour une
 * information qui change à l'heure. Le calcul se fait dans la couche de
 * données : une horloge appelée pendant le rendu rend le composant impur.
 */
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
