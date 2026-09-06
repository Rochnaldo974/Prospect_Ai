import type { Metadata } from 'next';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getIdentity } from '@/lib/email/identity';
import { IdentityForm } from './form';

export const metadata: Metadata = { title: 'Signature e-mail' };

/**
 * Vos infos pour les e-mails : nom, métier, logo, coordonnées.
 *
 * C'est ce qui fait qu'un e-mail envoyé depuis un dossier ressemble à un
 * message de VOTRE entreprise, pas à une sortie de machine. Rempli une
 * fois, appliqué à chaque envoi.
 */
export default async function SignaturePage() {
  const profile = await requireOnboardedUser();
  const identity = await getIdentity(profile.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">Signature e-mail</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Ce que vos prospects verront en bas de chaque e-mail. Remplissez une fois — chaque
          envoi la reprend.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <IdentityForm identity={identity} defaultName={profile.full_name ?? ''} />

        {/* L'aperçu : la signature telle qu'elle partira. */}
        <div>
          <p className="field-label">Aperçu</p>
          <div className="mt-3 rounded-2xl border bg-card p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">…votre message…</p>
            <p className="mt-4 text-sm text-muted-foreground">Bien à vous,</p>
            <div className="mt-5 border-t pt-4">
              {identity.logoUrl ? (
                // Domaine local dynamique : l'optimiseur Next exigerait une
                // liste d'hôtes pour une image qui n'a pas besoin de lui.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={identity.logoUrl} alt="Votre logo" className="mb-2.5 h-10 w-auto max-w-40 object-contain" />
              ) : (
                <span className="mb-2.5 inline-flex h-10 items-center rounded-md border border-dashed px-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  votre logo ici
                </span>
              )}
              <p className="text-sm font-semibold">{identity.fromName || 'Votre nom'}</p>
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
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Les réponses de vos prospects arrivent directement dans votre boîte
            ({/* l'adresse du compte est celle de connexion */}celle de votre compte).
          </p>
        </div>
      </div>
    </main>
  );
}

