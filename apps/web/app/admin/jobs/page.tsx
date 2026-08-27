import type { Metadata } from 'next';
import { getServiceClient } from '@prospect/core';
import { requireAdmin } from '@/lib/auth/session';
import { Pill, Section, formatDateTime, relativeDays } from '@/components/admin/primitives';

export const metadata: Metadata = { title: 'Jobs' };

export default async function AdminJobsPage() {
  await requireAdmin();
  const db = getServiceClient();

  const [byStatus, recent, runs] = await Promise.all([
    db.from('job_queue').select('job_type, status'),
    db.from('job_queue').select('*').order('id', { ascending: false }).limit(40),
    db.from('job_runs').select('*').order('started_at', { ascending: false }).limit(20),
  ]);

  const counts = new Map<string, Map<string, number>>();
  for (const row of byStatus.data ?? []) {
    const perType = counts.get(row.job_type) ?? new Map<string, number>();
    perType.set(row.status, (perType.get(row.status) ?? 0) + 1);
    counts.set(row.job_type, perType);
  }

  const tone = (status: string) =>
    status === 'dead' ? 'danger' : status === 'failed' ? 'warning' : status === 'running' ? 'info' : 'neutral';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          File de travail du pipeline. Le worker réclame par lots avec SKIP LOCKED.
        </p>
      </div>

      <Section title="File par type" count={counts.size} empty="File vide — aucun job planifié.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 text-right font-medium">En attente</th>
              <th className="pb-2 text-right font-medium">En cours</th>
              <th className="pb-2 text-right font-medium">Terminés</th>
              <th className="pb-2 text-right font-medium">Abandonnés</th>
            </tr>
          </thead>
          <tbody>
            {[...counts.entries()].map(([type, perStatus]) => (
              <tr key={type} className="border-t">
                <td className="py-1.5 font-mono text-xs">{type}</td>
                <td className="py-1.5 text-right tabular-nums">{perStatus.get('pending') ?? 0}</td>
                <td className="py-1.5 text-right tabular-nums">{perStatus.get('running') ?? 0}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                  {perStatus.get('done') ?? 0}
                </td>
                <td className="py-1.5 text-right tabular-nums text-destructive">
                  {perStatus.get('dead') ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Derniers jobs" count={recent.data?.length ?? 0} empty="Aucun job en file.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Statut</th>
              <th className="pb-2 text-right font-medium">Tentatives</th>
              <th className="pb-2 font-medium">Worker</th>
              <th className="pb-2 font-medium">Planifié</th>
              <th className="pb-2 font-medium">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {(recent.data ?? []).map((job) => (
              <tr key={job.id} className="border-t">
                <td className="py-1.5 tabular-nums text-muted-foreground">{job.id}</td>
                <td className="py-1.5 font-mono text-xs">{job.job_type}</td>
                <td className="py-1.5">
                  <Pill tone={tone(job.status)}>{job.status}</Pill>
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {job.attempts} / {job.max_attempts}
                </td>
                <td className="py-1.5 text-xs text-muted-foreground">{job.locked_by ?? '—'}</td>
                <td className="py-1.5 text-xs text-muted-foreground">{relativeDays(job.run_after)}</td>
                <td className="max-w-64 truncate py-1.5 text-xs text-destructive">
                  {job.last_error ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Exécutions" count={runs.data?.length ?? 0} empty="Aucune exécution enregistrée.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Statut</th>
              <th className="pb-2 font-medium">Démarré</th>
              <th className="pb-2 text-right font-medium">Traités</th>
              <th className="pb-2 text-right font-medium">Succès</th>
              <th className="pb-2 text-right font-medium">Échecs</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((run) => (
              <tr key={run.id} className="border-t">
                <td className="py-1.5 font-mono text-xs">{run.job_type}</td>
                <td className="py-1.5">
                  <Pill tone={run.status === 'failed' ? 'danger' : run.status === 'running' ? 'info' : 'success'}>
                    {run.status}
                  </Pill>
                </td>
                <td className="py-1.5 text-xs text-muted-foreground">{formatDateTime(run.started_at)}</td>
                <td className="py-1.5 text-right tabular-nums">{run.processed_count}</td>
                <td className="py-1.5 text-right tabular-nums text-success">{run.success_count}</td>
                <td className="py-1.5 text-right tabular-nums text-destructive">{run.failed_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
