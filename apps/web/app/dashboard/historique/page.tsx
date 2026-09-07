import type { Metadata } from 'next';
import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, getHistory, getServiceClient } from '@prospect/core';
import { requireOnboardedUser } from '@/lib/auth/session';

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
          Tout ce que vous avez traité, du plus récent au plus ancien.
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
        <div className="mt-8 divide-y overflow-hidden rounded-2xl border bg-card">
          {entries.map((entry) => (
            <article key={entry.assignmentId} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-6">
              <OutcomePill outcome={entry.outcome} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">
                  {entry.company.name}
                  {entry.company.city ? (
                    <span className="font-normal text-muted-foreground"> · {entry.company.city}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {OPPORTUNITY_TYPE_LABELS[entry.type]}
                  {entry.notes ? <> — {entry.notes}</> : null}
                </p>
              </div>
              <time
                dateTime={entry.outcomeAt}
                className="shrink-0 font-mono text-[11px] text-muted-foreground"
              >
                {new Date(entry.outcomeAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </time>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * L'issue, en couleur : bleu pour ce qui a rapporté, neutre pour le reste,
 * jamais de rouge — un refus est une information, pas une faute.
 */
function OutcomePill({ outcome }: { outcome: string }) {
  const LABELS: Record<string, [string, boolean]> = {
    client: ['Client signé', true],
    proposal: ['Devis envoyé', true],
    meeting: ['Rendez-vous', true],
    interested: ['Intéressé', true],
    not_interested: ['Pas intéressé', false],
    no_response: ['Pas de réponse', false],
  };
  const [label, positive] = LABELS[outcome] ?? [outcome, false];

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${
        positive ? 'bg-[var(--brand-wash)] text-[var(--brand)]' : 'bg-[var(--mist)] text-muted-foreground'
      }`}
    >
      {label}
    </span>
  );
}
