import type { Metadata } from 'next';
import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, getHistory, getServiceClient } from '@prospect/core';
import { requireOnboardedUser } from '@/lib/auth/session';
import { HistoryList } from '@/components/dashboard/history-list';

export const metadata: Metadata = { title: 'Historique' };

/**
 * Tout ce qui a été traité — refus, silences et clients compris.
 *
 * Un « pas de réponse » déclaré disparaissait de l'écran à la seconde même :
 * impossible de retrouver qui on avait déjà eu, ou pas eu, au bout du fil.
 * L'historique referme cette trappe. Il est en lecture seule : une issue se
 * corrige depuis À relancer tant que le dossier est ouvert, et un dossier
 * clos est clos.
 */
export default async function HistoryPage() {
  const profile = await requireOnboardedUser();
  const entries = await getHistory(getServiceClient(), profile.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">Historique</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Tout ce que vous avez traité. Cherchez, filtrez, retrouvez.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border bg-card px-6 py-12 text-center">
          <p className="font-medium">Encore rien ici</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Chaque issue que vous déclarez — client signé comme silence radio — se retrouve
            sur cette page.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
          >
            Voir aujourd’hui
          </Link>
        </div>
      ) : (
        <HistoryList entries={entries} typeLabels={OPPORTUNITY_TYPE_LABELS} />
      )}
    </main>
  );
}
