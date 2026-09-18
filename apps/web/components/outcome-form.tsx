import { declareContacted, declareOptOut, declareOutcome } from '@/app/dashboard/actions';

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

const ISSUES: { value: string; label: string; hint: string; tone: 'neutral' | 'positive' | 'won' }[] = [
  { value: 'no_response', label: 'Pas de réponse', hint: 'Personne au bout du fil', tone: 'neutral' },
  { value: 'not_interested', label: 'Pas intéressé', hint: 'La proposition ne l’intéresse pas', tone: 'neutral' },
  { value: 'interested', label: 'Intéressé', hint: 'À rappeler, la discussion est ouverte', tone: 'positive' },
  { value: 'meeting', label: 'Rendez-vous', hint: 'Un échange est calé', tone: 'positive' },
  { value: 'proposal', label: 'Devis envoyé', hint: 'Une proposition chiffrée est partie', tone: 'positive' },
  { value: 'client', label: 'Client signé', hint: 'C’est gagné', tone: 'won' },
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
      <form action={declareContacted} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <button
          type="submit"
          className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
        >
          J&apos;ai contacté
        </button>
        <p className="text-[13px] text-muted-foreground">
          Après l’appel ou l’e-mail : vous direz ce que ça a donné juste après, en un clic.
        </p>
      </form>
    );
  }

  const contacted = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(contactedAt));

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Contactée le <span className="font-medium text-foreground">{contacted}</span>. Qu&apos;est-ce que ça a donné ?
      </p>

      {/* Un seul formulaire pour les six issues : la note doit partir avec
          le bouton cliqué, et six formulaires séparés ne peuvent pas
          partager un champ. */}
      <form action={declareOutcome} className="space-y-3">
        <input type="hidden" name="assignmentId" value={assignmentId} />

        <div className="flex flex-wrap gap-2">
          {ISSUES.map((issue) => (
            <button
              key={issue.value}
              type="submit"
              name="outcome"
              value={issue.value}
              title={issue.hint}
              className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150 hover:-translate-y-px ${
                issue.tone === 'won'
                  ? 'border-[var(--success)]/40 bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] hover:bg-[color-mix(in_srgb,var(--success)_16%,transparent)]'
                  : issue.tone === 'positive'
                    ? 'border-[var(--brand)]/35 bg-[var(--brand-wash)] text-[var(--brand)] hover:bg-[var(--brand)]/15'
                    : 'border-[var(--line)] bg-card text-foreground hover:bg-[var(--mist)]'
              }`}
            >
              {issue.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          name="notes"
          maxLength={500}
          placeholder="Une note pour vous, facultative — ex. rappeler jeudi, demander le gérant"
          className="w-full rounded-lg border bg-[var(--mist)] px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        />
      </form>

      <form action={declareOptOut}>
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          L&apos;entreprise demande à ne plus être contactée
        </button>
      </form>
    </div>
  );
}
