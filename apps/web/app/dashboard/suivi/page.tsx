import type { Metadata } from 'next';
import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, type FollowUp } from '@prospect/core';
import { getMyFollowUps } from '@/lib/opportunities/mine';
import { FollowUpForm } from '@/components/dashboard/follow-up-form';
import { Chip, EmptyPanel, Kpi, PageHeader, Panel, Workspace, formatPhone } from '@/components/dashboard/ui';
import { PipelineCard } from '@/components/dashboard/rail-widgets';

export const metadata: Metadata = { title: 'À relancer' };

/**
 * Ce qui a été appelé et qui attend une suite.
 *
 * Les dossiers sont classés du plus ancien au plus récent : c'est celui
 * qu'on a laissé dormir trois semaines qui coûte quelque chose, pas celui
 * d'hier. Le rail donne le tunnel et les rappels qui pressent.
 */
const OUTCOME_LABELS: Record<FollowUp['outcome'], string> = {
  interested: 'Intéressé',
  meeting: 'Rendez-vous',
  proposal: 'Devis envoyé',
};

export default async function FollowUpPage() {
  const { followUps, stats } = await getMyFollowUps();
  const stale = followUps.filter((f) => f.daysSince >= 21);
  const byOutcome = (o: FollowUp['outcome']) => followUps.filter((f) => f.outcome === o).length;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader
        eyebrow="Suivi"
        title="À relancer"
        lead="Les entreprises que vous avez appelées et qui ne sont pas closes. Du dossier le plus ancien au plus récent."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Ouvertes" value={followUps.length} tone={followUps.length === 0 ? 'muted' : 'brand'} hint="discussions en cours" />
        <Kpi label="Intéressées" value={byOutcome('interested')} tone={byOutcome('interested') === 0 ? 'muted' : 'default'} hint="à rappeler" />
        <Kpi label="Rendez-vous" value={byOutcome('meeting')} tone={byOutcome('meeting') === 0 ? 'muted' : 'default'} hint="un échange est calé" />
        <Kpi label="Devis envoyés" value={byOutcome('proposal')} tone={byOutcome('proposal') === 0 ? 'muted' : 'default'} hint="en attente de réponse" />
        <Kpi label="Sans nouvelle depuis 21 j" value={stale.length} tone={stale.length > 0 ? 'finding' : 'muted'} hint="c’est là qu’un dossier se perd" />
      </div>

      <Workspace
        rail={(
          <>
            <PipelineCard stats={stats} href="/dashboard/historique" />
            {stale.length > 0 ? (
              <Panel tone="finding" eyebrow="À rappeler en premier" title={`${stale.length} ${stale.length > 1 ? 'dossiers dorment' : 'dossier dort'}`}>
                <ul className="space-y-1.5 text-[13px]">
                  {stale.slice(0, 6).map((f) => (
                    <li key={f.assignmentId} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{f.company.name}</span>
                      <span className="tabular shrink-0 font-mono text-[11px] text-[var(--finding)]">{f.daysSince} j</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
            <Panel eyebrow="Comment ça marche" title="Un dossier avance ici">
              <ol className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                <li><span className="font-medium text-foreground">Intéressé</span> — la discussion est ouverte, rappelez à la date convenue.</li>
                <li><span className="font-medium text-foreground">Rendez-vous</span> — un échange est calé, préparez le dossier.</li>
                <li><span className="font-medium text-foreground">Devis envoyé</span> — relancez à une semaine sans réponse.</li>
                <li><span className="font-medium text-foreground">Client signé</span> — le dossier se clôt et passe dans l’historique.</li>
              </ol>
            </Panel>
          </>
        )}
      >
        {followUps.length === 0 ? (
          <EmptyPanel
            title="Rien à relancer pour le moment"
            explanation="Un dossier arrive ici dès que vous déclarez « intéressé », « rendez-vous » ou « devis envoyé » après un appel."
            action={{ href: '/dashboard', label: 'Voir aujourd’hui' }}
          />
        ) : (
          <div className="space-y-3">
            {followUps.map((followUp) => <Row key={followUp.assignmentId} followUp={followUp} />)}
          </div>
        )}
      </Workspace>
    </main>
  );
}

function Row({ followUp }: { followUp: FollowUp }) {
  const { company } = followUp;
  const stale = followUp.daysSince >= 21;

  return (
    <article className={`panel rounded-xl border bg-card px-5 py-4 ${stale ? 'border-[var(--finding)]/30' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Chip tone="brand">{OUTCOME_LABELS[followUp.outcome]}</Chip>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">
            {company.name}
            {company.city ? <span className="font-normal text-muted-foreground"> · {company.city}</span> : null}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {OPPORTUNITY_TYPE_LABELS[followUp.type]}
            {followUp.notes ? <span> — <span className="text-foreground/80">{followUp.notes}</span></span> : null}
          </p>
        </div>
        <span className="tabular shrink-0 font-mono text-[11px]" style={{ color: stale ? 'var(--finding)' : 'var(--ink-2)' }}>
          {followUp.daysSince === 0 ? 'aujourd’hui' : `il y a ${followUp.daysSince} j`}
        </span>
        {company.phone ? (
          <a href={`tel:${company.phone}`} className="shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[13px] transition-colors hover:bg-[var(--mist)]">
            {formatPhone(company.phone)}
          </a>
        ) : null}
        {company.websiteUrl ? (
          <Link href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[13px] text-muted-foreground underline-offset-4 hover:underline">
            Site →
          </Link>
        ) : null}
      </div>
      <div className="mt-3 border-t pt-3">
        <FollowUpForm assignmentId={followUp.assignmentId} current={followUp.outcome} notes={followUp.notes} />
      </div>
    </article>
  );
}
