import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';

/**
 * Ce que le moteur aurait dû faire et n'a pas fait.
 *
 * Pas de système externe : une passe horaire lit les métriques et la file,
 * compare à ce qu'on attend, et écrit une alerte par motif et par jour,
 * journalisée en erreur pour qu'un simple grep des logs la trouve. La
 * console d'administration affiche les alertes ouvertes.
 */

export interface HealthAlert {
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
}

export interface HealthSnapshot {
  discoveredToday: number;
  discoveredYesterday: number;
  scannedToday: number;
  scanSuccessRate: number | null;
  phoneReadyToday: number;
  phoneReady7dAverage: number;
  outreachReadyToday: number;
  outreachReadyYesterday: number;
  queuePending: number;
  queueOldestPendingMinutes: number | null;
  queueFailed24h: number;
  /** Dernière exécution réussie par job récurrent, en heures. */
  lastSuccessHours: Record<string, number | null>;
  hourUtc: number;
}

/** Les règles, en pur : testables sans base. */
export function evaluateHealth(s: HealthSnapshot): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  // Après 8 h UTC, la nuit est censée avoir produit.
  const afterNight = s.hourUtc >= 8;

  if (afterNight && s.discoveredToday === 0 && s.discoveredYesterday === 0) {
    alerts.push({ kind: 'discovery_zero', severity: 'warning', message: 'Aucune entreprise découverte depuis deux jours.', details: {} });
  }
  if (afterNight && s.scannedToday > 50 && s.scanSuccessRate !== null && s.scanSuccessRate < 0.5) {
    alerts.push({ kind: 'scan_success_low', severity: 'warning', message: `Taux de scans réussis à ${Math.round(s.scanSuccessRate * 100)} %.`, details: { rate: s.scanSuccessRate, scanned: s.scannedToday } });
  }
  if (afterNight && s.phoneReady7dAverage >= 20 && s.phoneReadyToday < s.phoneReady7dAverage * 0.2) {
    alerts.push({ kind: 'phone_ready_drop', severity: 'critical', message: `Production PHONE_READY à ${s.phoneReadyToday} contre ${Math.round(s.phoneReady7dAverage)} par jour en moyenne.`, details: { today: s.phoneReadyToday, average_7d: s.phoneReady7dAverage } });
  }
  if (afterNight && s.outreachReadyToday === 0 && s.outreachReadyYesterday > 0) {
    alerts.push({ kind: 'outreach_ready_zero', severity: 'warning', message: 'Aucune opportunité OUTREACH_READY produite aujourd’hui.', details: { yesterday: s.outreachReadyYesterday } });
  }
  if (s.queueOldestPendingMinutes !== null && s.queueOldestPendingMinutes > 180 && s.queuePending > 0) {
    alerts.push({ kind: 'queue_stalled', severity: 'critical', message: `Un job attend depuis ${Math.round(s.queueOldestPendingMinutes / 60)} h ; ${s.queuePending} en attente.`, details: { pending: s.queuePending, oldest_minutes: s.queueOldestPendingMinutes } });
  }
  if (s.queueFailed24h >= 10) {
    alerts.push({ kind: 'jobs_failing', severity: 'warning', message: `${s.queueFailed24h} jobs en échec sur vingt-quatre heures.`, details: { failed: s.queueFailed24h } });
  }
  for (const [job, hours] of Object.entries(s.lastSuccessHours)) {
    if (hours === null || hours > 36) {
      alerts.push({ kind: `sync_missed:${job}`, severity: 'warning', message: `${job} n’a pas réussi depuis ${hours === null ? 'toujours' : `${Math.round(hours)} h`}.`, details: { job, hours } });
    }
  }
  return alerts;
}

const WATCHED_JOBS = ['sync_bodacc', 'import_afnic_daily', 'plan_discovery', 'detect_signals', 'generate_opportunities', 'allocate_daily'];

export async function snapshotHealth(db: Db): Promise<HealthSnapshot> {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const [{ data: m0 }, { data: m1 }] = await Promise.all([
    db.rpc('engine_metrics', { p_day: day(today) }),
    db.rpc('engine_metrics', { p_day: day(yesterday) }),
  ]);
  const num = (o: unknown, k: string): number => Number(((o as Record<string, Record<string, unknown>>) ?? {})[k] ?? 0);
  const section = (m: unknown, s: string) => ((m as Record<string, unknown>) ?? {})[s];

  // Moyenne sur sept jours de la production PHONE_READY.
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count: phone7 } = await db.from('opportunities').select('id', { count: 'exact', head: true }).gte('created_at', since7).eq('phone_ready', true);

  const [pending, failed, oldest] = await Promise.all([
    db.from('job_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('job_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    db.from('job_queue').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ]);

  const lastSuccessHours: Record<string, number | null> = {};
  for (const job of WATCHED_JOBS) {
    const { data } = await db.from('job_runs').select('completed_at').eq('job_type', job).eq('status', 'succeeded').order('completed_at', { ascending: false }).limit(1).maybeSingle();
    lastSuccessHours[job] = data?.completed_at ? (Date.now() - Date.parse(data.completed_at)) / 3_600_000 : null;
  }

  return {
    discoveredToday: num(section(m0, 'discovery'), 'companies_discovered_today'),
    discoveredYesterday: num(section(m1, 'discovery'), 'companies_discovered_today'),
    scannedToday: num(section(m0, 'domains'), 'domains_scanned_today'),
    scanSuccessRate: (section(m0, 'domains') as Record<string, number | null> | undefined)?.['domains_scan_success_rate'] ?? null,
    phoneReadyToday: num(section(m0, 'opportunities'), 'phone_ready_created_today'),
    phoneReady7dAverage: (phone7 ?? 0) / 7,
    outreachReadyToday: num(section(m0, 'opportunities'), 'outreach_ready_created_today'),
    outreachReadyYesterday: num(section(m1, 'opportunities'), 'outreach_ready_created_today'),
    queuePending: pending.count ?? 0,
    queueOldestPendingMinutes: oldest.data?.created_at ? (Date.now() - Date.parse(oldest.data.created_at)) / 60_000 : null,
    queueFailed24h: failed.count ?? 0,
    lastSuccessHours,
    hourUtc: today.getUTCHours(),
  };
}

/** Évalue, écrit une alerte par motif et par jour, journalise. */
export async function checkHealth(db: Db, options: { logger?: Logger } = {}): Promise<{ alerts: HealthAlert[]; written: number }> {
  const snapshot = await snapshotHealth(db);
  const alerts = evaluateHealth(snapshot);
  let written = 0;
  for (const alert of alerts) {
    const { error } = await db.from('engine_alerts').insert({
      kind: alert.kind, severity: alert.severity, message: alert.message, details: alert.details as Json,
    });
    // Déjà levée aujourd'hui : rien à réécrire.
    if (!error) written += 1;
    else if (error.code !== '23505') options.logger?.warn('Alerte non enregistrée', { kind: alert.kind, error: error.message });
    const log = alert.severity === 'critical' ? options.logger?.error : options.logger?.warn;
    log?.call(options.logger, `Alerte moteur : ${alert.message}`, { kind: alert.kind, ...alert.details });
  }
  return { alerts, written };
}
