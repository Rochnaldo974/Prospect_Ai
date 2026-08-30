import { declareContacted, declareOptOut, declareOutcome } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

/**
 * Ce qui se passe après l'appel.
 *
 * Deux temps délibérément séparés. Tant que le freelance n'a pas appelé, une
 * seule action lui est proposée ; lui présenter d'emblée six issues possibles
 * lui demanderait de choisir avant d'avoir quoi que ce soit à déclarer.
 *
 * L'ordre des issues suit le tunnel réel, du plus fréquent au plus rare. « Ne
 * plus contacter » est à l'écart et formulé sans ambiguïté : ce n'est pas un
 * refus commercial de plus, c'est une demande de l'entreprise qui la retire
 * définitivement du service.
 */

const ISSUES: { value: string; label: string; hint: string }[] = [
  { value: 'no_response', label: 'Pas de réponse', hint: 'Personne au bout du fil' },
  { value: 'not_interested', label: 'Pas intéressé', hint: 'La proposition ne l’intéresse pas' },
  { value: 'interested', label: 'Intéressé', hint: 'À rappeler, la discussion est ouverte' },
  { value: 'meeting', label: 'Rendez-vous', hint: 'Un échange est calé' },
  { value: 'proposal', label: 'Devis envoyé', hint: 'Une proposition chiffrée est partie' },
  { value: 'client', label: 'Client signé', hint: 'C’est gagné' },
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
      <form action={declareContacted} className="border-t pt-4">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm">J&apos;ai contacté</Button>
          <p className="text-xs text-muted-foreground">
            Vous pourrez dire ce que ça a donné juste après.
          </p>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Qu&apos;est-ce que ça a donné ?
      </p>

      {/* Un seul formulaire pour les six issues : la note doit partir avec
          le bouton cliqué, et six formulaires séparés ne peuvent pas
          partager un champ. */}
      <form action={declareOutcome} className="space-y-3">
        <input type="hidden" name="assignmentId" value={assignmentId} />

        <div className="flex flex-wrap gap-2">
          {ISSUES.map((issue) => (
            <Button
              key={issue.value}
              type="submit"
              name="outcome"
              value={issue.value}
              variant="outline"
              size="sm"
              title={issue.hint}
            >
              {issue.label}
            </Button>
          ))}
        </div>

        {/* La mémoire du freelance : relue telle quelle dans À relancer.
            Facultative — un champ requis ferait mentir. */}
        <input
          type="text"
          name="notes"
          maxLength={500}
          placeholder="Une note pour vous, facultative — ex. rappeler jeudi, demander le gérant"
          className="w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        />
      </form>

      {/* À l'écart du reste : ce n'est pas une issue commerciale de plus, et
          la confondre avec « pas intéressé » retirerait du service une
          entreprise qui n'a rien demandé. */}
      <form action={declareOptOut}>
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <button
          type="submit"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          L&apos;entreprise demande à ne plus être contactée
        </button>
      </form>
    </div>
  );
}
