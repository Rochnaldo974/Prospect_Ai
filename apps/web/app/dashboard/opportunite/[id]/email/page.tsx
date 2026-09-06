import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { draftProspectingEmail, getServiceClient } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity, identityReady } from '@/lib/email/identity';
import { EmailSendForm } from './composer';

export const metadata: Metadata = { title: 'E-mail personnalisé' };

/**
 * La page d'envoi : un e-mail, un dossier, un geste.
 *
 * Le brouillon est écrit depuis les faits du dossier, la signature vient
 * des infos de l'utilisateur — nom, métier, logo — et l'aperçu montre le
 * message exactement comme le prospect le recevra. Rien à copier :
 * « Envoyer », et c'est parti.
 *
 * La page dit aussi ses préalables au lieu de les cacher : sans signature,
 * elle envoie d'abord la remplir ; sans adresse relevée, elle oriente vers
 * le formulaire de contact de l'entreprise.
 */
export default async function EmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getMyOpportunity(id);
  if (!found) notFound();

  const { opportunity, plan, firstName } = found;
  const { company } = opportunity;
  const profile = await requireUser();
  const identity = await getIdentity(profile.id);

  const back = `/dashboard/opportunite/${id}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href={back} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        ← Retour au dossier
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          E-mail à {company.name}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Rédigé depuis les constats du dossier, signé à votre nom. Relisez, ajustez, envoyez.
        </p>
      </header>

      <div className="mt-8">
        <EmailPageBody
          plan={plan}
          identityOk={identityReady(identity)}
          email={company.email}
          contactFormUrl={company.contactFormUrl}
          assignmentId={opportunity.assignmentId}
          draft={draftProspectingEmail(opportunity)}
          identity={identity}
          sentBefore={await lastSend(opportunity.assignmentId)}
          firstName={firstName}
        />
      </div>
    </main>
  );
}

async function lastSend(assignmentId: string): Promise<string | null> {
  const { data } = await getServiceClient()
    .from('assignment_emails')
    .select('sent_at')
    .eq('assignment_id', assignmentId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.sent_at ?? null;
}

function EmailPageBody({
  plan, identityOk, email, contactFormUrl, assignmentId, draft, identity, sentBefore, firstName,
}: {
  plan: 'free' | 'premium';
  identityOk: boolean;
  email: string | null;
  contactFormUrl: string | null;
  assignmentId: string;
  draft: { subject: string; body: string };
  identity: Awaited<ReturnType<typeof getIdentity>>;
  sentBefore: string | null;
  firstName: string;
}) {
  if (plan !== 'premium') {
    return (
      <div className="rounded-2xl border bg-card px-6 py-12 text-center">
        <p className="text-lg font-semibold">L’e-mail prêt à envoyer est réservé au plan Solo</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Un message rédigé depuis les constats du dossier, signé à votre nom avec votre
          logo, envoyé en un clic — les réponses arrivent dans votre boîte.
        </p>
        <Link
          href="/dashboard/abonnement"
          className="mt-6 inline-flex rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px"
        >
          Voir le plan Solo
        </Link>
      </div>
    );
  }

  if (!identityOk) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-12 text-center">
        <p className="text-lg font-semibold">D’abord, votre signature</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {firstName ? `${firstName}, un` : 'Un'} e-mail sans nom ni signature ressemble à une
          machine. Renseignez vos infos une fois — chaque envoi les reprendra.
        </p>
        <Link
          href="/dashboard/signature"
          className="mt-6 inline-flex rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-transform duration-200 hover:-translate-y-px"
        >
          Remplir ma signature
        </Link>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-12 text-center">
        <p className="text-lg font-semibold">Pas d’adresse e-mail relevée</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Le site de cette entreprise ne publie aucune adresse générique. Le téléphone reste
          la meilleure voie{contactFormUrl ? ', ou son formulaire de contact' : ''}.
        </p>
        {contactFormUrl ? (
          <a
            href={contactFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
          >
            Ouvrir le formulaire de contact
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {sentBefore ? (
        <p className="mb-6 rounded-xl border border-[var(--warning)]/30 bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] px-4 py-3 text-sm" style={{ color: 'var(--warning)' }}>
          Un e-mail a déjà été envoyé à cette entreprise le{' '}
          {new Date(sentBefore).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.
          Celui-ci partirait en relance.
        </p>
      ) : null}
      <EmailSendForm
        assignmentId={assignmentId}
        to={email}
        draft={draft}
        identity={identity}
      />
    </>
  );
}
