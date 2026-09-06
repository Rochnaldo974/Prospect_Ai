'use client';

import { useActionState, useState } from 'react';
import { EMAIL_INTENTS, type EmailIntent } from '@prospect/core';
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
  drafts,
  identity,
}: {
  assignmentId: string;
  to: string;
  drafts: Record<EmailIntent, { subject: string; body: string }>;
  identity: EmailIdentity;
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(
    sendProspectingEmail,
    {},
  );

  // L'intention pilote le texte. Changer d'intention remplace le brouillon
  // entier — assumé et annoncé : mieux vaut un texte cohérent qu'un collage.
  const [intent, setIntent] = useState<EmailIntent>('call');
  const [subject, setSubject] = useState(drafts.call.subject);
  const [body, setBody] = useState(drafts.call.body);
  const [attachCv, setAttachCv] = useState(false);

  const pick = (next: EmailIntent) => {
    setIntent(next);
    setSubject(drafts[next].subject);
    setBody(drafts[next].body);
    if (next === 'intro' && identity.cvUrl) setAttachCv(true);
  };

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
        {/* L'intention d'abord : que voulez-vous obtenir de cet e-mail ? */}
        <div>
          <span className="field-label">Que proposez-vous ?</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMAIL_INTENTS.map(({ id, label, hint }) => (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                title={hint}
                aria-pressed={intent === id}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  intent === id
                    ? 'border-[var(--brand)] bg-[var(--brand-wash)] font-medium text-[var(--brand)]'
                    : 'hover:bg-[var(--mist)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="field-label">Objet</span>
          <input
            type="text"
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            className="mt-2 w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>

        <label className="block">
          <span className="field-label">Message</span>
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={13}
            required
            className="mt-2 w-full resize-y rounded-lg border bg-card px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>

        {identity.cvUrl ? (
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="attachCv"
              value="true"
              checked={attachCv}
              onChange={(event) => setAttachCv(event.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Joindre mon CV (PDF)
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ajoutez votre CV dans{' '}
            <a href="/dashboard/signature" className="text-[var(--brand)] underline-offset-4 hover:underline">
              Signature e-mail
            </a>{' '}
            pour pouvoir le joindre.
          </p>
        )}

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
        <LivePreview identity={identity} body={body} attachCv={attachCv} />
      </div>
    </form>
  );
}

/** L'aperçu suit l'état du formulaire : ce qu'on relit est ce qui part. */
function LivePreview({
  identity, body, attachCv,
}: {
  identity: EmailIdentity;
  body: string;
  attachCv: boolean;
}) {
  return (
    <div className="mt-3 rounded-2xl border bg-card p-6">
      <div className="space-y-3.5 text-sm leading-relaxed">
        {body.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">{paragraph}</p>
        ))}
      </div>
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
      {attachCv ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--mist)] px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <span aria-hidden>📎</span> CV.pdf joint
        </p>
      ) : null}
    </div>
  );
}
