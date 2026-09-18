import type { Metadata } from 'next';
import { getMyOpportunities } from '@/lib/opportunities/mine';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';
import { EmptyPanel, Kpi, PageHeader, Panel, Workspace } from '@/components/dashboard/ui';
import { DeadlinesCard, MixCard, PipelineCard } from '@/components/dashboard/rail-widgets';

export const metadata: Metadata = { title: 'Plus tard' };

/**
 * Les dossiers mis de côté.
 *
 * Mettre de côté ne fige RIEN : l'exclusivité court, et un dossier oublié
 * repart dans le circuit. Le rail le répète avec les échéances, dans
 * l'ordre où elles tombent.
 */
export default async function SnoozedPage() {
  const { opportunities, stats } = await getMyOpportunities();
  const snoozed = opportunities.filter((o) => o.snoozedAt !== null);
  const urgent = snoozed.filter((o) => o.hoursLeft < 12 && o.contactedAt === null).length;
  const soonest = snoozed.reduce<number | null>((m, o) => (m === null || o.hoursLeft < m ? o.hoursLeft : m), null);

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader
        eyebrow="Mis de côté"
        title="Plus tard"
        lead="Les dossiers que vous avez mis de côté. L’exclusivité court toujours : passé son terme, un dossier repart dans le circuit."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Mis de côté" value={snoozed.length} tone={snoozed.length === 0 ? 'muted' : 'default'} hint="dans votre réserve" />
        <Kpi label="Sous 12 h" value={urgent} tone={urgent > 0 ? 'finding' : 'muted'} hint="à traiter avant ce soir" />
        <Kpi label="Expire au plus tôt" value={soonest === null ? '—' : soonest >= 24 ? Math.floor(soonest / 24) : Math.max(0, soonest)} unit={soonest === null ? undefined : soonest >= 24 ? 'j' : 'h'} hint="d’exclusivité restante" />
        <Kpi href="/dashboard" label="Dans ma journée" value={opportunities.length - snoozed.length} hint="Retour à aujourd’hui →" />
      </div>

      <Workspace rail={(<><DeadlinesCard opportunities={snoozed} title="Réserve" /><MixCard opportunities={snoozed} /><PipelineCard stats={stats} /></>)}>
        {snoozed.length === 0 ? (
          <EmptyPanel
            title="Rien de mis de côté"
            explanation="Depuis un dossier, « Plus tard » le range ici — pour la fin de journée, sans le perdre de vue."
            action={{ href: '/dashboard', label: 'Voir aujourd’hui' }}
          />
        ) : (
          <Panel title="Votre réserve" aside="du plus pressé au moins pressé" padded={false}>
            <div className="space-y-2 px-3 pb-3 pt-3">
              {[...snoozed].sort((a, b) => a.hoursLeft - b.hoursLeft).map((o) => <OpportunityRow key={o.assignmentId} opportunity={o} />)}
            </div>
          </Panel>
        )}
      </Workspace>
    </main>
  );
}
