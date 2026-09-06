'use client';

import { useActionState } from 'react';
import type { EmailIdentity } from '@/lib/email/identity';
import { sendProspectingEmail, type SendState } from './actions';

/**
 * L'éditeur d'envoi : le message à gauche, l'e-mail final à droite.
 *
 * L'aperçu montre EXACTEMENT ce qui partira — signature, logo, mise en
 * page — parce que c'est la promesse de la page : pas de surprise entre ce
 * qu'on relit et ce que le prospect reçoit. Le bouton dit le destinataire,
 * et l'état « envoyé » remplace le formulaire : un envoi n'est pas un
 * brouillon qu'on rejoue.
 */
export function EmailSendForm({
  assignmentId,
  to,
  draft,
  identity,
}: {
  assignmentId: string;
  to: string;
  draft: { subject: string; body: string };
  identity: EmailIdentity;
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(
    sendProspectingEmail,
    {},
  );

  if (state.sent) {
    return (
      <div className="rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-wash)] px-6 py-8 text-center">
        <p className="text-lg font-semibold text-[var(--brand)]">E-mail envoyé à {to}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--brand)]/80">
          L’entreprise est marquée comme contactée. Dès qu’elle répond — dans votre boîte
          mail — déclarez l’issue depuis le dossier.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      <div className="space-y-4">
        <label className="block">
          <span className="field-label">Objet</span>
          <input
            type="text"
            name="subject"
            defaultValue={draft.subject}
            required
            className="mt-2 w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>

        <label className="block">
          <span className="field-label">Message</span>
          <textarea
            name="body"
            defaultValue={draft.body}
            rows={13}
            required
            className="mt-2 w-full resize-y rounded-lg border bg-card px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>

        {state.problem ? (
          <p className="rounded-lg bg-[var(--finding-wash)] px-4 py-3 text-sm text-[var(--finding)]">
            {state.problem}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px disabled:opacity-60"
        >
          {pending ? 'Envoi…' : `Envoyer à ${to}`}
        </button>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Les réponses arrivent dans votre boîte mail. L’adresse du destinataire est celle
          que l’entreprise publie sur son site.
        </p>
      </div>

      {/* ── L'e-mail tel qu'il partira ── */}
      <div>
        <p className="field-label">Ce que le prospect recevra</p>
        <LivePreview identity={identity} />
      </div>
    </form>
  );
}

/**
 * L'aperçu suit la frappe : il relit le textarea du même formulaire.
 * Un aperçu qui ignore ce qu'on vient de taper ment.
 */
function LivePreview({ identity }: { identity: EmailIdentity }) {
  return (
    <div className="mt-3 rounded-2xl border bg-card p-6">
      <PreviewBody />
      <div className="mt-5 border-t pt-4">
        {identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.logoUrl} alt="" className="mb-2.5 h-10 w-auto max-w-40 object-contain" />
        ) : null}
        <p className="text-sm font-semibold">{identity.fromName}</p>
        {(identity.title || identity.company) ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {[identity.title, identity.company].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        {(identity.phone || identity.website) ? (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {[identity.phone, identity.website].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

import { useSyncExternalStore } from 'react';

/**
 * Le textarea est la source de vérité, lue par useSyncExternalStore : pas
 * de setState dans un effet (le compilateur React le refuse à raison), et
 * l'aperçu suit la frappe sans dupliquer l'état du formulaire.
 */
function PreviewBody() {
  const text = useSyncExternalStore(
    (notify) => {
      const area = document.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
      area?.addEventListener('input', notify);
      return () => area?.removeEventListener('input', notify);
    },
    () => document.querySelector<HTMLTextAreaElement>('textarea[name="body"]')?.value ?? '',
    () => '',
  );

  return (
    <div className="space-y-3.5 text-sm leading-relaxed">
      {text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>
  );
}
