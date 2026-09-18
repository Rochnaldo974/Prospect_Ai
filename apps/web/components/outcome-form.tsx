import { declareContacted, declareOutcome } from '@/app/dashboard/actions';
import { Icon, PILL, PILL_OUTLINE, PILL_PRIMARY } from '@/components/dashboard/dossier-actions';

/**
 * Ce qui se passe après l'appel.
 *
 * Deux temps délibérément séparés. Tant que le freelance n'a pas appelé, une
 * seule action lui est proposée ; lui présenter d'emblée six issues possibles
 * lui demanderait de choisir avant d'avoir quoi que ce soit à déclarer.
 *
 * Les issues ont toutes le même contour ; seule une pastille dit leur sens —
 * grise, bleue, verte. L'ordre suit le tunnel réel, du plus fréquent au plus
 * rare. L'opposition de l'entreprise n'est pas une issue : elle a son propre
 * bouton, à côté, en deux temps.
 */

const ISSUES: { value: string; label: string; hint: string; dot: string }[] = [
  { value: 'no_response', label: 'Pas de réponse', hint: 'Personne au bout du fil', dot: 'var(--line)' },
  { value: 'not_interested', label: 'Pas intéressé', hint: 'La proposition ne l’intéresse pas', dot: 'var(--ink-2)' },
  { value: 'interested', label: 'Intéressé', hint: 'À rappeler, la discussion est ouverte', dot: 'var(--brand)' },
  { value: 'meeting', label: 'Rendez-vous', hint: 'Un échange est calé', dot: 'var(--brand)' },
  { value: 'proposal', label: 'Devis envoyé', hint: 'Une proposition chiffrée est partie', dot: 'var(--brand)' },
  { value: 'client', label: 'Client signé', hint: 'C’est gagné', dot: 'var(--success)' },
];

export function OutcomeForm({
  assignmentId,
  contactedAt,
}: {
  assignmentId: string;
  contactedAt: string | null;
}) {
  if (contactedAt === null) {
    return (
      <form action={declareContacted} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <button type="submit" className={PILL_PRIMARY}><Icon name="check" />J&apos;ai contacté</button>
        <p className="text-[13px] text-muted-foreground">
          Après l’appel ou l’e-mail. Vous direz ce que ça a donné juste après.
        </p>
      </form>
    );
  }

  const contacted = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(contactedAt));

  return (
    <form action={declareOutcome} className="space-y-2.5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <p className="text-[13px] text-muted-foreground">
        Contactée le <span className="font-medium text-foreground">{contacted}</span>. Qu&apos;est-ce que ça a donné ?
      </p>

      {/* Un seul formulaire pour les six issues : la note doit partir avec
          le bouton cliqué, et six formulaires séparés ne peuvent pas
          partager un champ. */}
      <div className="flex flex-wrap gap-2">
        {ISSUES.map((issue) => (
          <button key={issue.value} type="submit" name="outcome" value={issue.value} title={issue.hint} className={PILL_OUTLINE}>
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: issue.dot }} />
            {issue.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        name="notes"
        maxLength={500}
        placeholder="Une note pour vous, facultative — ex. rappeler jeudi, demander le gérant"
        className={`${PILL} w-full max-w-xl justify-start rounded-lg border bg-card font-normal placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]`}
      />
    </form>
  );
}
