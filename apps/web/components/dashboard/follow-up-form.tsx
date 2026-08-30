import { declareOutcome } from '@/app/dashboard/actions';
import type { FollowUp } from '@prospect/core';

/**
 * Faire avancer un dossier déjà appelé.
 *
 * Les six issues du premier appel ne conviennent pas ici : « pas de réponse »
 * n'a plus de sens sur une entreprise avec qui la discussion est ouverte. Ne
 * restent que les suites possibles, et l'issue déjà déclarée est marquée pour
 * qu'on voie d'où l'on part.
 */
const NEXT: Array<{ value: string; label: string }> = [
  { value: 'interested', label: 'Toujours intéressé' },
  { value: 'meeting', label: 'Rendez-vous' },
  { value: 'proposal', label: 'Devis envoyé' },
  { value: 'client', label: 'Client signé' },
  { value: 'not_interested', label: 'N’a pas donné suite' },
];

export function FollowUpForm({
  assignmentId,
  current,
}: {
  assignmentId: string;
  current: FollowUp['outcome'];
}) {
  return (
    <form action={declareOutcome} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <span className="field-label mr-1">Où ça en est</span>

      {NEXT.map((step) => (
        <button
          key={step.value}
          type="submit"
          name="outcome"
          value={step.value}
          aria-current={step.value === current ? 'true' : undefined}
          className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
            step.value === current
              ? 'border-[var(--brand)] bg-[var(--brand-wash)] font-medium text-[var(--brand)]'
              : 'hover:bg-[var(--mist)]'
          }`}
        >
          {step.label}
        </button>
      ))}
    </form>
  );
}
