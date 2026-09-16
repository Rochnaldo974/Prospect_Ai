'use client';

import { useState } from 'react';
import type { EmailIdentity } from '@/lib/email/identity';
import { renderEmailText, renderSignatureFragment } from '@/lib/email/render';

/**
 * Mettre sa signature dans Gmail, une fois.
 *
 * Les e-mails partent de Gmail ; c'est donc Gmail qui ajoute la signature
 * — logo compris — à chaque message, y compris ceux que Prospect ouvre.
 * Ce bloc copie la signature en HTML, dit où la coller, et c'est réglé
 * pour tous les envois suivants.
 */
export function GmailSignature({ identity }: { identity: EmailIdentity }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    const html = renderSignatureFragment(identity);
    const text = renderEmailText('', identity).replace(/^\s*--\n/, '');
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="mt-6 rounded-2xl border bg-card p-6">
      <p className="text-sm font-semibold">Votre signature dans Gmail</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Vos e-mails partent de Gmail. Mettez-y votre signature une fois, avec le logo : Gmail
        l’ajoutera à chaque message que Prospect ouvre pour vous.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
        <li>Cliquez « Copier ma signature ».</li>
        <li>Dans Gmail : ⚙ → Voir tous les paramètres → Signature → Créer.</li>
        <li>Collez (⌘V), puis choisissez cette signature pour les nouveaux messages, et enregistrez.</li>
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          disabled={!identity.fromName}
          className="rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--mist)] disabled:opacity-60"
        >
          Copier ma signature
        </button>
        {state === 'copied' ? <span className="text-sm font-medium text-[var(--brand)]">Copiée ✓</span> : null}
        {state === 'failed' ? <span className="text-sm text-[var(--finding)]">La copie a été refusée par le navigateur.</span> : null}
        <a
          href="https://mail.google.com/mail/u/0/#settings/general"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--brand)] underline-offset-4 hover:underline"
        >
          Ouvrir les paramètres Gmail
        </a>
      </div>
    </div>
  );
}
