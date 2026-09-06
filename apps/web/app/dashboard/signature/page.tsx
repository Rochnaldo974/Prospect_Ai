import type { Metadata } from 'next';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getIdentity } from '@/lib/email/identity';
import { saveIdentity } from './actions';

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
        <form action={saveIdentity} className="space-y-5 rounded-2xl border bg-card p-6">
          <Field label="Votre nom" name="from_name" value={identity.fromName || (profile.full_name ?? '')} placeholder="Eliott Roche" required />
          <Field label="Votre métier" name="title" value={identity.title} placeholder="Développeur web indépendant" />
          <Field label="Votre structure (facultatif)" name="company" value={identity.company} placeholder="Studio Roche" />
          <Field label="Téléphone" name="phone" value={identity.phone} placeholder="06 12 34 56 78" />
          <Field label="Site web" name="website" value={identity.website} placeholder="votresite.fr" />

          <label className="block">
            <span className="field-label">Logo (PNG, JPG, SVG — 512 Ko max)</span>
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border file:border-solid file:bg-card file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-[var(--mist)]"
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px"
          >
            Enregistrer
          </button>
        </form>

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
              ) : null}
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

function Field({
  label, name, value, placeholder, required = false,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      />
    </label>
  );
}
