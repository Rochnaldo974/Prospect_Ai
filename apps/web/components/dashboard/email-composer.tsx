'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * L'e-mail prêt à envoyer — le cœur du plan payant.
 *
 * Le brouillon arrive pré-rempli depuis le dossier ; tout est modifiable
 * sur place, et deux gestes suffisent : « Ouvrir dans ma messagerie »
 * (mailto:, l'e-mail part de l'adresse du freelance — délivrabilité,
 * droit, zéro infrastructure) ou « Copier » pour coller où l'on veut.
 *
 * En plan gratuit, le bloc montre ce qu'il rendrait — flouté — et dit le
 * prix du déblocage. Montrer l'outil vaut tous les argumentaires.
 */
export function EmailComposer({
  premium,
  email,
  draft,
}: {
  premium: boolean;
  email: string | null;
  draft: { subject: string; body: string };
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);

  if (!premium) {
    return (
      <section className="relative overflow-hidden rounded-2xl border bg-card">
        <div aria-hidden className="select-none p-6 blur-[6px]">
          <p className="field-label">E-mail prêt à envoyer</p>
          <p className="mt-3 text-sm font-medium">{draft.subject}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {draft.body.split('\n').slice(0, 5).join('\n')}
          </p>
        </div>
        <div className="absolute inset-0 grid place-items-center bg-[var(--white)]/55 p-6 text-center">
          <div>
            <p className="font-medium">Un e-mail personnalisé, prêt à envoyer</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Rédigé depuis les constats du dossier, modifiable, envoyé depuis votre
              messagerie. Réservé au plan Solo.
            </p>
            <Link
              href="/dashboard/abonnement"
              className="mt-4 inline-flex rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px"
            >
              Voir le plan Solo
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible (permissions) : la sélection manuelle reste.
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b bg-[var(--mist)]/60 px-5 py-3.5">
        <p className="field-label">E-mail prêt à envoyer</p>
        <p className="text-xs text-muted-foreground">
          Généré depuis le dossier — relisez, ajustez, envoyez.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <label className="block">
          <span className="field-label">Objet</span>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-2 w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>

        <label className="block">
          <span className="field-label">Message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={11}
            className="mt-2 w-full resize-y rounded-lg border bg-card px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          {mailto ? (
            <a
              href={mailto}
              className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px"
            >
              Ouvrir dans ma messagerie · {email}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune adresse générique trouvée sur le site — copiez le texte pour le
              formulaire de contact.
            </p>
          )}
          <button
            type="button"
            onClick={copy}
            className="rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
          >
            {copied ? 'Copié ✓' : 'Copier'}
          </button>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          L’e-mail part de votre messagerie, sous votre nom : c’est ce qui le fait arriver
          en boîte de réception. L’adresse est celle que l’entreprise publie elle-même.
        </p>
      </div>
    </section>
  );
}
