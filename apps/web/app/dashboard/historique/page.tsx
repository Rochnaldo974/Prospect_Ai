import type { Metadata } from 'next';
import { OPPORTUNITY_TYPE_LABELS, getHistory, getServiceClient } from '@prospect/core';
import { requireOnboardedUser } from '@/lib/auth/session';
import { HistoryList } from '@/components/dashboard/history-list';
import { HistorySummary } from '@/components/dashboard/history-summary';
import { EmptyPanel, Kpi, PageHeader, Panel, Workspace } from '@/components/dashboard/ui';

export const metadata: Metadata = { title: 'Historique' };

/**
 * Tout ce qui a été traité — refus, silences et clients compris.
 *
 * En lecture seule : une issue se corrige depuis À relancer tant que le
 * dossier est ouvert, et un dossier clos est clos. Le rail compte ce que
 * la liste montre.
 */
export default async function HistoryPage() {
  const profile = await requireOnboardedUser();
  const entries = await getHistory(getServiceClient(), profile.id);
  const n = (o: string) => entries.filter((e) => e.outcome === o).length;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader eyebrow="Archive" title="Historique" lead="Tout ce que vous avez traité. Cherchez, filtrez, retrouvez." />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Traités" value={entries.length} tone={entries.length === 0 ? 'muted' : 'default'} hint="dossiers clos ou en cours" />
        <Kpi label="Clients signés" value={n('client')} tone={n('client') > 0 ? 'won' : 'muted'} hint="depuis votre arrivée" />
        <Kpi label="Pas intéressés" value={n('not_interested')} tone="muted" hint="c’est le métier" />
        <Kpi label="Sans réponse" value={n('no_response')} tone="muted" hint="personne au bout du fil" />
      </div>

      <Workspace rail={entries.length > 0 ? <HistorySummary entries={entries} /> : (
        <Panel eyebrow="Ce que vous verrez ici" title="Chaque issue, datée">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <li><span className="font-medium text-foreground">Client signé</span> — la seule ligne qui compte vraiment.</li>
            <li><span className="font-medium text-foreground">Devis, rendez-vous, intéressé</span> — tant qu’ils sont ouverts, ils vivent dans À relancer.</li>
            <li><span className="font-medium text-foreground">Pas intéressé, sans réponse</span> — clos, mais gardés : vous saurez qui vous avez déjà eu au bout du fil.</li>
          </ul>
          <p className="mt-3 border-t pt-3 text-[12px] text-muted-foreground">Les filtres — issue, mission, période, ville, notes — apparaissent dès le premier dossier.</p>
        </Panel>
      )}>
        {entries.length === 0 ? (
          <EmptyPanel
            title="Encore rien ici"
            explanation="Chaque issue que vous déclarez — client signé comme silence radio — se retrouve sur cette page."
            action={{ href: '/dashboard', label: 'Voir aujourd’hui' }}
          />
        ) : (
          <HistoryList entries={entries} typeLabels={OPPORTUNITY_TYPE_LABELS} />
        )}
      </Workspace>
    </main>
  );
}
