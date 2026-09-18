import type { Metadata } from 'next';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getIdentity } from '@/lib/email/identity';
import { IdentityForm } from './form';
import { Kpi, PageHeader, Panel, Workspace } from '@/components/dashboard/ui';

export const metadata: Metadata = { title: 'Signature e-mail' };

/**
 * Vos infos pour les e-mails : nom, métier, logo, coordonnées.
 *
 * C'est ce qui fait qu'un e-mail envoyé depuis un dossier ressemble à un
 * message de VOTRE entreprise, pas à une sortie de machine. Le rail montre
 * la signature telle qu'elle partira, et ce qui manque encore.
 */
export default async function SignaturePage() {
  const profile = await requireOnboardedUser();
  const identity = await getIdentity(profile.id);
  const name = identity.fromName || profile.full_name || '';

  const checklist: Array<[string, boolean, string]> = [
    ['Nom', Boolean(name), 'Le prospect sait à qui il répond.'],
    ['Métier', Boolean(identity.title), 'Une ligne sous le nom : ce que vous faites.'],
    ['Téléphone', Boolean(identity.phone), 'Pour être rappelé sans chercher.'],
    ['Site web', Boolean(identity.website), 'La preuve que vous existez.'],
    ['Présentation', Boolean(identity.presentation), 'Deux phrases, reprises en tête d’e-mail.'],
    ['Logo', Boolean(identity.logoUrl), 'Facultatif, mais il fait entreprise.'],
  ];
  const filled = checklist.filter(([, ok]) => ok).length;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader eyebrow="Compte" title="Signature e-mail" lead="Ce que vos prospects verront en bas de chaque e-mail. Remplissez une fois — chaque envoi la reprend." />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Signature" value={`${filled}/${checklist.length}`} hint={filled === checklist.length ? 'complète' : 'éléments renseignés'} tone={filled === checklist.length ? 'won' : filled >= 4 ? 'brand' : 'urgent'} />
        <Kpi label="Envoi" value={name && (identity.title || identity.phone) ? 'prêt' : 'à compléter'} hint="nom et un moyen de vous joindre" tone={name && (identity.title || identity.phone) ? 'won' : 'urgent'} />
        <Kpi label="CV joint" value={identity.cvUrl ? 'oui' : 'non'} hint="joint aux e-mails de candidature" tone={identity.cvUrl ? 'default' : 'muted'} />
        <Kpi label="Réponses" value="chez vous" hint={`elles arrivent sur ${profile.email}`} tone="default" />
      </div>

      <Workspace
        rail={(
          <>
            <Panel eyebrow="Aperçu" title="Telle qu’elle partira">
              <div className="rounded-lg border border-dashed px-4 py-4">
                <p className="text-[13px] leading-relaxed text-muted-foreground">…votre message…</p>
                <p className="mt-3 text-[13px] text-muted-foreground">Bien à vous,</p>
                <div className="mt-4 border-t pt-3">
                  {identity.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={identity.logoUrl} alt="Votre logo" className="mb-2.5 h-9 w-auto max-w-36 object-contain" />
                  ) : null}
                  <p className="text-[13px] font-semibold">{name || 'Votre nom'}</p>
                  {(identity.title || identity.company) ? <p className="mt-0.5 text-[12px] text-muted-foreground">{[identity.title, identity.company].filter(Boolean).join(' · ')}</p> : null}
                  {(identity.phone || identity.website) ? <p className="mt-1 text-[12px] text-muted-foreground">{[identity.phone, identity.website].filter(Boolean).join(' · ')}</p> : null}
                </div>
              </div>
            </Panel>
            <Panel eyebrow="Complétude" title={filled === checklist.length ? 'Rien ne manque' : `${checklist.length - filled} à renseigner`}>
              <ul className="space-y-2">
                {checklist.map(([label, ok, why]) => (
                  <li key={label} className="flex items-start gap-2.5 text-[13px]">
                    <span aria-hidden className={`mt-[3px] grid size-4 shrink-0 place-items-center rounded-full text-[10px] ${ok ? 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]' : 'border border-[var(--line)] text-transparent'}`}>✓</span>
                    <span><span className={ok ? 'font-medium' : 'font-medium text-muted-foreground'}>{label}</span><span className="block text-[12px] text-muted-foreground">{why}</span></span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel eyebrow="Dans l’e-mail" title="Comment elle est utilisée">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                L’e-mail commence par « Bonjour, je suis {name || 'votre nom'}{identity.title ? `, ${identity.title.toLowerCase()}` : ''} », reprend votre présentation, dit le problème vu sur le site et votre proposition, puis se termine par cette signature. Les réponses arrivent dans votre boîte.
              </p>
            </Panel>
          </>
        )}
      >
        <IdentityForm identity={identity} defaultName={profile.full_name ?? ''} />
      </Workspace>
    </main>
  );
}
