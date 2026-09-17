import type { Db } from '../db/client';
import type { Logger } from '../logger';

/**
 * La découverte en rotation.
 *
 * On ne parcourt pas la France chaque nuit : quelques zones par nuit, en
 * priorité celles qu'on n'a jamais vues, puis les plus peuplées, puis les
 * plus anciennes. Chaque passage laisse ses chiffres sur la zone — vues,
 * créées, mises à jour, contacts — pour savoir où la découverte rapporte.
 */

export interface DiscoveryArea {
  id: number;
  name: string;
  area_type: 'commune' | 'departement' | 'zone';
  area_id: string;
  population: number | null;
  priority: number;
  status: string;
  last_scanned_at: string | null;
  next_scan_at: string;
  runs: number;
}

/** Le choix, en pur : jamais vues d'abord, puis priorité, puis population, puis ancienneté. */
export function pickDueAreas(areas: DiscoveryArea[], count: number, now = new Date()): DiscoveryArea[] {
  return areas
    .filter((a) => a.status !== 'paused' && new Date(a.next_scan_at).getTime() <= now.getTime())
    .sort((a, b) =>
      Number(a.last_scanned_at !== null) - Number(b.last_scanned_at !== null)
      || b.priority - a.priority
      || (b.population ?? 0) - (a.population ?? 0)
      || new Date(a.next_scan_at).getTime() - new Date(b.next_scan_at).getTime())
    .slice(0, Math.max(0, count));
}

export interface PlanDiscoveryReport {
  due: number;
  planned: number;
  areas: string[];
}

/** Enfile un job de découverte par zone due, jusqu'au quota de la nuit. */
export async function planDiscovery(
  db: Db,
  options: { perNight?: number; logger?: Logger } = {},
): Promise<PlanDiscoveryReport> {
  const { data: setting } = await db.rpc('engine_setting_int', { p_key: 'discovery_areas_per_night', p_default: 20 });
  const perNight = options.perNight ?? setting ?? 20;

  const { data, error } = await db
    .from('discovery_areas')
    .select('id, name, area_type, area_id, population, priority, status, last_scanned_at, next_scan_at, runs')
    .neq('status', 'paused')
    .lte('next_scan_at', new Date().toISOString())
    .order('next_scan_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(`planDiscovery : ${error.message}`);

  const due = (data ?? []) as DiscoveryArea[];
  const chosen = pickDueAreas(due, perNight);
  const today = new Date().toISOString().slice(0, 10);

  let planned = 0;
  for (const area of chosen) {
    const { data: id } = await db.rpc('enqueue_job', {
      p_job_type: 'discover_osm',
      p_payload: { cities: [area.name], limit: 5000, areaId: area.id },
      p_priority: 70,
      p_dedupe_key: `discover-osm:${area.id}:${today}`,
    });
    if (id !== null) planned += 1;
  }

  options.logger?.info('Découverte planifiée', { due: due.length, planned, areas: chosen.map((a) => a.name) });
  return { due: due.length, planned, areas: chosen.map((a) => a.name) };
}

/** Le passage est fini : la zone garde ses chiffres et sa prochaine échéance. */
export async function recordDiscoveryRun(
  db: Db,
  areaId: number,
  outcome: { ok: boolean; error?: string; durationMs: number; seen: number; created: number; updated: number; contacts: number },
): Promise<void> {
  const { data: refresh } = await db.rpc('engine_setting_int', { p_key: 'discovery_refresh_days', p_default: 30 });
  const { data: area } = await db.from('discovery_areas').select('runs, companies_seen, companies_created, companies_updated, contacts_found, population').eq('id', areaId).maybeSingle();
  if (!area) return;
  // Les grandes villes bougent plus vite : revisitées deux fois plus souvent.
  const days = (area.population ?? 0) >= 100_000 ? Math.max(7, Math.round((refresh ?? 30) / 2)) : (refresh ?? 30);
  const now = new Date();
  await db.from('discovery_areas').update({
    status: outcome.ok ? 'active' : 'failed',
    last_scanned_at: now.toISOString(),
    next_scan_at: new Date(now.getTime() + (outcome.ok ? days : 2) * 86_400_000).toISOString(),
    ...(outcome.ok ? { last_success_at: now.toISOString(), last_error: null } : { last_error: outcome.error ?? 'inconnue' }),
    last_duration_ms: outcome.durationMs,
    runs: area.runs + 1,
    companies_seen: area.companies_seen + outcome.seen,
    companies_created: area.companies_created + outcome.created,
    companies_updated: area.companies_updated + outcome.updated,
    contacts_found: area.contacts_found + outcome.contacts,
  }).eq('id', areaId);
}
