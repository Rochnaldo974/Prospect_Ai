import type { Metadata } from 'next';
import Link from 'next/link';
import { OPPORTUNITY_TYPE_LABELS, type FollowUp, type OutcomeStats } from '@prospect/core';
import { getMyFollowUps } from '@/lib/opportunities/mine';
import { FollowUpForm } from '@/components/dashboard/follow-up-form';

export const metadata: Metadata = { title: 'À relancer — Prospect AI' };

/**
 * Ce qui a été appelé et qui attend une suite.
 *
 * C'était le trou du produit. Le service livrait cinq entreprises par jour et
 * les oubliait dès l'issue déclarée : un freelance qui décroche un « rappelez-
 * moi en octobre » n'avait aucun endroit où le retrouver. Au bout d'une
 * semaine, l'outil lui faisait perdre plus d'affaires qu'il ne lui en
 * apportait.
 *
 * Les dossiers sont classés du plus ancien au plus récent, parce que c'est
 * celui qu'on a laissé dormir trois semaines qui coûte quelque chose, pas
 * celui d'hier.
 */
export default async function FollowUpPage() {
  const { followUps, stats } = await getMyFollowUps();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">À relancer</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Les entreprises que vous avez appelées et qui ne sont pas closes. Du dossier le plus
          ancien au plus récent.
        </p>
      </header>

      <Stats stats={stats} />

      {followUps.length === 0 ? (
        <div className="mt-8 rounded-2xl border bg-card px-6 py-12 text-center">
          <p className="font-medium">Rien à relancer pour le moment</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Un dossier arrive ici dès que vous déclarez « intéressé », « rendez-vous » ou
            « devis envoyé » après un appel.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
          >
            Voir ce matin
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {followUps.map((followUp) => (
            <Row key={followUp.assignmentId} followUp={followUp} />
          ))}
        </div>
      )}
    </main>
  );
}

const OUTCOME_LABELS: Record<FollowUp['outcome'], string> = {
  interested: 'Intéressé',
  meeting: 'Rendez-vous',
  proposal: 'Devis envoyé',
};

function Row({ followUp }: { followUp: FollowUp }) {
  const { company } = followUp;

  // Trois semaines sans nouvelle, c'est le moment où un dossier se perd.
  const stale = followUp.daysSince >= 21;

  return (
    <article className="rounded-2xl border bg-card px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="shrink-0 rounded-full bg-[var(--brand-wash)] px-3 py-1.5 text-[13px] font-medium text-[var(--brand)]">
          {OUTCOME_LABELS[followUp.outcome]}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">
            {company.name}
            {company.city ? (
              <span className="font-normal text-muted-foreground"> · {company.city}</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {OPPORTUNITY_TYPE_LABELS[followUp.type]}
          </p>
        </div>

        <span
          className="shrink-0 font-mono text-[11px]"
          style={{ color: stale ? 'var(--finding)' : 'var(--ink-2)' }}
        >
          {followUp.daysSince === 0
            ? 'aujourd’hui'
            : `il y a ${followUp.daysSince} j`}
        </span>

        {company.phone ? (
          <a
            href={`tel:${company.phone}`}
            className="shrink-0 font-mono text-sm underline-offset-4 hover:underline"
          >
            {formatPhone(company.phone)}
          </a>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-4">
        <FollowUpForm assignmentId={followUp.assignmentId} current={followUp.outcome} />
      </div>
    </article>
  );
}

/**
 * Le compte des issues.
 *
 * Cinq nombres bruts, sans taux ni comparaison : un freelance qui a passé
 * douze appels n'a pas d'échantillon, et lui servir un « taux de conversion
 * de 8,3 % » serait une précision inventée. Les rapports viendront quand les
 * nombres les porteront.
 */
function Stats({ stats }: { stats: OutcomeStats }) {
  const cells: Array<[string, number]> = [
    ['Appelées', stats.contacted],
    ['Intéressées', stats.interested],
    ['Rendez-vous', stats.meeting],
    ['Devis', stats.proposal],
    ['Clients', stats.client],
  ];

  if (stats.contacted === 0) return null;

  return (
    <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-[var(--line)] sm:grid-cols-5">
      {cells.map(([label, value]) => (
        <div key={label} className="bg-card px-5 py-5 last:col-span-2 sm:last:col-span-1">
          <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
          <p className="field-label mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** +33241888198 se lit mal ; 02 41 88 81 98 se compose. */
function formatPhone(phone: string): string {
  const french = phone.replace(/^\+33/, '0').replace(/\s/g, '');
  return /^0\d{9}$/.test(french)
    ? french.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
    : phone;
}
