'use client';

import { startTransition, useActionState, useState } from 'react';
import { EMAIL_INTENTS, type EmailIntent } from '@prospect/core';
import type { EmailIdentity } from '@/lib/email/identity';
import { renderEmailText } from '@/lib/email/render';
import { recordExternalSend, sendProspectingEmail, type SendState } from './actions';

/**
 * L'éditeur d'envoi : le message à gauche, l'e-mail final à droite.
 *
 * L'aperçu montre EXACTEMENT ce qui partira — signature, logo, mise en
 * page — parce que c'est la promesse de la page : pas de surprise entre ce
 * qu'on relit et ce que le prospect reçoit.
 *
 * L'envoi passe par Gmail, sans serveur à payer : un clic copie le message
 * entier — texte, signature, logo — et ouvre Gmail avec le destinataire
 * et l'objet remplis. Le freelance colle, envoie, et revient le dire ; le
 * dossier passe en contacté comme pour un envoi direct. Quand un serveur
 * d'envoi est configuré, le bouton « Envoyer » direct s'ajoute à côté.
 */
export function EmailSendForm({
  assignmentId,
  to,
  drafts,
  identity,
  smtpReady,
}: {
  assignmentId: string;
  to: string;
  drafts: Record<EmailIntent, { subject: string; body: string }>;
  identity: EmailIdentity;
  smtpReady: boolean;
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendProspectingEmail, {});
  const [external, confirmExternal, confirming] = useActionState<SendState, FormData>(recordExternalSend, {});

  // L'intention pilote le texte. Changer d'intention remplace le brouillon
  // entier — assumé et annoncé : mieux vaut un texte cohérent qu'un collage.
  const [intent, setIntent] = useState<EmailIntent>('call');
  const [subject, setSubject] = useState(drafts.call.subject);
  const [body, setBody] = useState(drafts.call.body);
  const [attachCv, setAttachCv] = useState(false);
  const [gmail, setGmail] = useState<'idle' | 'opened'>('idle');

  const pick = (next: EmailIntent) => {
    setIntent(next);
    setSubject(drafts[next].subject);
    setBody(drafts[next].body);
    if (next === 'intro' && identity.cvUrl) setAttachCv(true);
  };

  /**
   * Gmail reçoit tout par l'adresse : destinataire, objet, et le message
   * validé dans l'aperçu, mot pour mot, signature comprise. Rien d'autre à
   * faire là-bas qu'« Envoyer ».
   */
  const composeUrl = () => {
    const compose = new URL('https://mail.google.com/mail/');
    compose.searchParams.set('view', 'cm');
    compose.searchParams.set('fs', '1');
    compose.searchParams.set('to', to);
    compose.searchParams.set('su', subject);
    compose.searchParams.set('body', renderEmailText(body, identity));
    return compose.toString();
  };

  const openGmail = () => {
    setGmail('opened');
    window.open(composeUrl(), '_blank', 'noopener');
  };

  if (state.sent || external.sent) {
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
          <p className="text-xs leading-relaxed text-muted-foreground">
            Pour joindre votre CV dans Gmail, glissez-le dans le message :{' '}
            <a href={identity.cvUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] underline-offset-4 hover:underline">
              télécharger mon CV
            </a>.
          </p>
        ) : null}

        {/* ── Gmail : tout est rempli, il reste « Envoyer » ── */}
        {gmail === 'idle' ? (
          <button
            type="button"
            onClick={openGmail}
            className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px"
          >
            Envoyer avec Gmail à {to}
          </button>
        ) : (
          <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-wash)] px-4 py-4 text-sm leading-relaxed">
            <p className="font-medium text-[var(--brand)]">Gmail est ouvert : adresse, objet et message sont remplis.</p>
            <p className="mt-1.5 text-[var(--brand)]/85">Relisez, puis « Envoyer ». Revenez ensuite dire que c’est parti.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const data = new FormData();
                  data.set('assignmentId', assignmentId);
                  data.set('subject', subject);
                  data.set('body', body);
                  startTransition(() => confirmExternal(data));
                }}
                disabled={confirming}
                className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {confirming ? 'Un instant…' : 'C’est envoyé'}
              </button>
              <a
                href={composeUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--brand)] underline-offset-4 hover:underline"
              >
                Rouvrir Gmail
              </a>
            </div>
            {external.problem ? <p className="mt-2 text-[var(--finding)]">{external.problem}</p> : null}
          </div>
        )}

        {smtpReady ? (
          <>
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
                Joindre mon CV (PDF) à l’envoi direct
              </label>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-[var(--mist)] disabled:opacity-60"
            >
              {pending ? 'Envoi…' : `Envoyer directement à ${to}`}
            </button>
          </>
        ) : null}

        {state.problem ? (
          <p className="rounded-lg bg-[var(--finding-wash)] px-4 py-3 text-sm text-[var(--finding)]">
            {state.problem}
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          L’e-mail part de votre boîte Gmail, sous votre nom : les réponses y arrivent directement. L’adresse du
          destinataire est celle que l’entreprise publie sur son site.
        </p>
      </div>

      {/* ── L'e-mail tel qu'il partira ── */}
      <div>
        <p className="field-label">Ce que le prospect recevra</p>
        <LivePreview identity={identity} body={body} attachCv={attachCv && smtpReady} />
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
