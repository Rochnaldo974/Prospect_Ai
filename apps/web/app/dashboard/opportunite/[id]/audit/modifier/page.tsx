import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureAuditShare, getServiceClient } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity } from '@/lib/email/identity';
import { siteOrigin } from '@/lib/site-url';
import { Panel, Workspace } from '@/components/dashboard/ui';
import { AuditEditForm } from './form';

export const metadata: Metadata = { title: 'Modifier l’audit' };

/**
 * Relire l'audit avant de l'envoyer.
 *
 * Le moteur écrit une première version depuis les faits ; le freelance la
 * fait sienne. À gauche le texte, à droite ce qui ne bouge pas — la note,
 * la capture — et les deux sorties : la page en ligne, le PDF.
 */
export default async function EditAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireUser();
  const found = await getMyOpportunity(id);
  if (!found) notFound();
  const { opportunity, plan } = found;

  if (plan !== 'premium') {
    return (
      <main className="px-5 py-6 sm:px-6 xl:px-8">
        <Link href={`/dashboard/opportunite/${id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">← Retour au dossier</Link>
        <Panel className="mt-6" title="L’audit est réservé au plan Solo">
          <p className="text-sm text-muted-foreground">Une page et un PDF à votre nom, à envoyer au commerçant.</p>
          <Link href="/dashboard/abonnement" className="mt-4 inline-flex h-10 items-center rounded-full bg-[var(--brand)] px-5 text-[13.5px] font-medium text-white">Voir le plan Solo</Link>
        </Panel>
      </main>
    );
  }

  const identity = await getIdentity(profile.id);
  const share = await ensureAuditShare(getServiceClient(), {
    assignmentId: opportunity.assignmentId,
    userId: profile.id,
    opportunity,
    author: {
      name: identity.fromName || profile.full_name || 'Votre développeur web',
      title: identity.title, company: identity.company, phone: identity.phone, website: identity.website,
      email: profile.email, logoUrl: identity.logoUrl,
    },
  });
  const s = share.snapshot;
  const auditUrl = `${await siteOrigin()}/audit/${share.id}`;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <Link href={`/dashboard/opportunite/${id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">← Retour au dossier</Link>
      <header className="mt-4">
        <p className="eyebrow">Audit à votre nom</p>
        <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.03em]">Relire l’audit de {opportunity.company.name}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Le moteur a écrit une première version depuis les faits. Faites-la vôtre : la page en ligne et le PDF reprennent ce que vous enregistrez.</p>
      </header>

      <Workspace
        rail={(
          <>
            <Panel eyebrow="Ne change pas" title="Les mesures">
              {s.score !== null && s.scores ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <div className="col-span-2 flex items-baseline justify-between"><dt className="text-muted-foreground">Note globale</dt><dd className="tabular font-mono text-lg font-medium">{s.score}<span className="text-xs text-muted-foreground">/100</span></dd></div>
                  {([['Vitesse', s.scores.speed], ['Téléphone', s.scores.mobile], ['SEO', s.scores.seo], ['Confiance', s.scores.trust]] as Array<[string, number]>).map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="tabular font-mono">{value}</dd></div>
                  ))}
                </dl>
              ) : <p className="text-[13px] text-muted-foreground">Pas de note mesurée pour ce site.</p>}
              {s.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- capture distante
                <img src={s.screenshotUrl} alt="" className="mt-3 w-full rounded-lg border object-cover object-top" />
              ) : null}
              <p className="mt-3 text-[12px] text-muted-foreground">La capture et la note sont celles du moteur : c’est ce qui rend l’audit crédible.</p>
            </Panel>
            <Panel eyebrow="Sorties" title="La page et le fichier">
              <div className="flex flex-col gap-2">
                <a href={auditUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--line)] bg-card px-4 text-[13.5px] font-medium transition-colors hover:bg-[var(--mist)]">Voir la page en ligne</a>
                <a href={`/dashboard/opportunite/${id}/audit`} className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--line)] bg-card px-4 text-[13.5px] font-medium transition-colors hover:bg-[var(--mist)]">Télécharger le PDF</a>
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">Ouvert {share.openCount} fois par le commerçant.</p>
            </Panel>
          </>
        )}
      >
        <AuditEditForm assignmentId={opportunity.assignmentId} headline={s.headline} findings={s.findings} proposal={s.proposal} />
      </Workspace>
    </main>
  );
}
