import type { Metadata } from 'next';
import { getServiceClient, registeredJobTypes } from '@prospect/core';
import { requireAdmin } from '@/lib/auth/session';
import { Count, Pill, Section, formatDateTime, relativeDays } from '@/components/admin/primitives';

export const metadata: Metadata = { title: 'Jobs' };

const STATUS_TONE = {
  dead: 'danger',
  failed: 'warning',
  running: 'info',
  pending: 'neutral',
  done: 'success',
} as const;

export default async function AdminJobsPage() {
  await requireAdmin();
  const db = getServiceClient();

  const [byStatus, recent, runs, cron] = await Promise.all([
    db.from('job_queue').select('job_type, status'),
    db.from('job_queue').select('*').order('id', { ascending: false }).limit(40),
    db.from('job_runs').select('*').order('started_at', { ascending: false }).limit(20),
    db.from('admin_cron_schedule').select('*').order('jobname'),
  ]);

  const handlers = registeredJobTypes();

  const counts = new Map<string, Map<string, number>>();
  for (const row of byStatus.data ?? []) {
    const perType = counts.get(row.job_type) ?? new Map<string, number>();
    perType.set(row.status, (perType.get(row.status) ?? 0) + 1);
    counts.set(row.job_type, perType);
  }

  const dead = (recent.data ?? []).filter((j) => j.status === 'dead');

  // Un type planifié sans handler produirait des jobs morts à chaque passage
  // du cron — c'est le genre de panne silencieuse qu'on ne voit qu'ici.
  const orphanTypes = [...counts.keys()].filter((type) => !handlers.includes(type));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          pg_cron planifie, le worker exécute. Réclamation par lots avec SKIP LOCKED.
        </p>
      </div>

      {orphanTypes.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Types de job sans handler enregistré :{' '}
          <span className="font-mono">{orphanTypes.join(', ')}</span>. Ils seront abandonnés à
          chaque tentative.
        </div>
      ) : null}

      {dead.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dead.length} job{dead.length > 1 ? 's' : ''} abandonné{dead.length > 1 ? 's' : ''} après
          épuisement des tentatives.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Planification" count={cron.data?.length ?? 0} empty="Aucune entrée cron.">
          <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 pb-2 font-medium">Entrée</th>
                <th className="px-2 pb-2 font-medium">Rythme</th>
                <th className="px-2 pb-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {(cron.data ?? []).map((entry) => (
                <tr key={entry.jobid} className="border-t">
                  <td className="px-2 py-1.5 font-mono text-xs">{entry.jobname}</td>
                  <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                    {entry.schedule}
                  </td>
                  <td className="px-2 py-1.5">
                    <Pill tone={entry.active ? 'success' : 'danger'}>
                      {entry.active ? 'oui' : 'non'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Handlers enregistrés" count={handlers.length}>
          <ul className="flex flex-wrap gap-1.5">
            {handlers.map((type) => (
              <li key={type}>
                <Pill tone="info">{type}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Un job dont le type n&apos;est pas dans cette liste est abandonné sans réessai :
            réessayer ne fera pas apparaître le handler.
          </p>
        </Section>
      </div>

      <Section title="File par type" count={counts.size} empty="File vide — aucun job planifié.">
        <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 pb-2 font-medium">Type</th>
              <th className="px-2 pb-2 text-right font-medium">En attente</th>
              <th className="px-2 pb-2 text-right font-medium">En cours</th>
              <th className="px-2 pb-2 text-right font-medium">Terminés</th>
              <th className="px-2 pb-2 text-right font-medium">Abandonnés</th>
            </tr>
          </thead>
          <tbody>
            {[...counts.entries()].map(([type, perStatus]) => (
              <tr key={type} className="border-t">
                <td className="px-2 py-1.5 font-mono text-xs">{type}</td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={perStatus.get('pending') ?? 0} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={perStatus.get('running') ?? 0} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={perStatus.get('done') ?? 0} tone="muted" />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={perStatus.get('dead') ?? 0} tone="danger" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Derniers jobs" count={recent.data?.length ?? 0} empty="Aucun job en file.">
        <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 pb-2 font-medium">#</th>
              <th className="px-2 pb-2 font-medium">Type</th>
              <th className="px-2 pb-2 font-medium">Statut</th>
              <th className="px-2 pb-2 text-right font-medium">Tentatives</th>
              <th className="px-2 pb-2 font-medium">Worker</th>
              <th className="px-2 pb-2 font-medium">Planifié</th>
              <th className="px-2 pb-2 font-medium">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {(recent.data ?? []).map((job) => (
              <tr key={job.id} className="border-t">
                <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{job.id}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{job.job_type}</td>
                <td className="px-2 py-1.5">
                  <Pill tone={STATUS_TONE[job.status]}>{job.status}</Pill>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {job.attempts} / {job.max_attempts}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{job.locked_by ?? '—'}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {relativeDays(job.run_after)}
                </td>
                <td className="max-w-64 truncate px-2 py-1.5 text-xs text-destructive">
                  {job.last_error ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Exécutions" count={runs.data?.length ?? 0} empty="Aucune exécution enregistrée.">
        <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 pb-2 font-medium">Type</th>
              <th className="px-2 pb-2 font-medium">Statut</th>
              <th className="px-2 pb-2 font-medium">Démarré</th>
              <th className="px-2 pb-2 text-right font-medium">Traités</th>
              <th className="px-2 pb-2 text-right font-medium">Succès</th>
              <th className="px-2 pb-2 text-right font-medium">Échecs</th>
              <th className="px-2 pb-2 font-medium">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((run) => (
              <tr key={run.id} className="border-t">
                <td className="px-2 py-1.5 font-mono text-xs">{run.job_type}</td>
                <td className="px-2 py-1.5">
                  <Pill
                    tone={
                      run.status === 'failed' ? 'danger' : run.status === 'running' ? 'info' : 'success'
                    }
                  >
                    {run.status}
                  </Pill>
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {formatDateTime(run.started_at)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={run.processed_count} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={run.success_count} tone="success" />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Count value={run.failed_count} tone="danger" />
                </td>
                <td className="max-w-56 truncate px-2 py-1.5 text-xs text-destructive">
                  {run.error ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          Un job abandonné pour type inconnu ou payload invalide n&apos;apparaît pas ici : rien
          n&apos;a été exécuté. Il figure dans « Derniers jobs » avec son motif.
        </p>
      </Section>
    </div>
  );
}
