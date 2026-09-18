'use client';

import { useActionState } from 'react';
import { saveAudit, type AuditEditState } from '../actions';

/**
 * Le formulaire de relecture : trois champs, pas plus.
 *
 * Le titre est ce que le commerçant lit en premier ; les constats sont un
 * par ligne, dans l'ordre où ils s'affichent ; la proposition est la
 * seule partie où le freelance parle de lui. Les mesures ne se modifient
 * pas : elles sont du moteur, et c'est ce qui les rend crédibles.
 */
export function AuditEditForm({
  assignmentId, headline, findings, proposal,
}: {
  assignmentId: string;
  headline: string;
  findings: string[];
  proposal: string;
}) {
  const [state, action, pending] = useActionState<AuditEditState, FormData>(saveAudit, {});

  return (
    <form action={action} className="panel space-y-5 rounded-xl border bg-card p-6">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      <label className="block">
        <span className="field-label">Le titre</span>
        <input
          type="text"
          name="headline"
          defaultValue={headline}
          maxLength={160}
          required
          className="mt-2 w-full rounded-lg border bg-card px-3.5 py-2.5 text-[15px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        />
        <span className="mt-1.5 block text-xs text-muted-foreground">Ce que le commerçant lit en premier : le défaut, comme on le lui dirait.</span>
      </label>

      <label className="block">
        <span className="field-label">Les constats — un par ligne, cinq au plus</span>
        <textarea
          name="findings"
          defaultValue={findings.join('\n')}
          rows={6}
          required
          className="mt-2 w-full resize-y rounded-lg border bg-card px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        />
        <span className="mt-1.5 block text-xs text-muted-foreground">Gardez des faits vérifiables. Retirez ce que vous ne voulez pas dire, reformulez le reste.</span>
      </label>

      <label className="block">
        <span className="field-label">Ce que vous proposez</span>
        <textarea
          name="proposal"
          defaultValue={proposal}
          rows={4}
          maxLength={1000}
          required
          className="mt-2 w-full resize-y rounded-lg border bg-card px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        />
        <span className="mt-1.5 block text-xs text-muted-foreground">Avec vos mots, en une ou deux phrases. C’est la seule partie de l’audit qui parle de vous.</span>
      </label>

      {state.problem ? (
        <p className="rounded-lg bg-[var(--finding-wash)] px-4 py-3 text-sm text-[var(--finding)]">{state.problem}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-[var(--ink)] px-5 text-[13.5px] font-medium text-white transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="submit"
          name="back"
          value="email"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-card px-5 text-[13.5px] font-medium transition-colors hover:bg-[var(--mist)] disabled:opacity-60"
        >
          Enregistrer et passer à l’e-mail
        </button>
        {state.saved && !state.problem ? <span className="text-sm font-medium text-[var(--brand)]">Enregistré ✓ — la page et le PDF sont à jour.</span> : null}
      </div>
    </form>
  );
}
