import type { Db } from '../../db/client';
import type { Logger } from '../../logger';
import { normalizeDomainDetailed } from '../../normalization/domain';

/**
 * AFNIC, liste quotidienne des .fr créés la veille.
 *
 * L'AFNIC publie chaque matin un fichier texte des domaines créés la
 * veille, gardé en ligne sept jours, réutilisable sans licence :
 * https://www.afnic.fr/wp-media/ftp/domaineTLD_Afnic/YYYYMMDD_CREA_fr.txt
 *
 * Un domaine n'est pas une entreprise : il entre dans `domains` avec sa
 * date de dépôt et une priorité de scan haute, le scanner le visite dans la
 * nuit, et c'est le SIREN de ses mentions légales qui fera — ou non — le
 * rattachement. L'import mensuel historique (`import:afnic`) reste tel quel.
 */

export const AFNIC_DAILY_BASE = 'https://www.afnic.fr/wp-media/ftp/domaineTLD_Afnic';

export function afnicDailyUrl(day: Date, tld = 'fr'): string {
  const stamp = day.toISOString().slice(0, 10).replace(/-/g, '');
  return `${AFNIC_DAILY_BASE}/${stamp}_CREA_${tld}.txt`;
}

/** Les domaines d'une liste quotidienne : un par ligne, normalisés, dédoublonnés. */
export function parseAfnicDailyList(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // Certaines lignes portent le nom seul, d'autres « nom;… » : la première colonne suffit.
    const first = line.split(/[;,\t ]/)[0] ?? '';
    const { domain } = normalizeDomainDetailed(first);
    if (domain && domain.endsWith('.fr')) seen.add(domain);
  }
  return [...seen];
}

export interface AfnicDailyReport {
  days: number;
  fetched: number;
  missing: number;
  read: number;
  queued: number;
  alreadyKnown: number;
  errors: number;
}

export interface AfnicDailyOptions {
  /** Combien de jours en arrière relire (le site en garde sept). */
  lookbackDays?: number;
  /** Injectable pour les tests : renvoie le texte d'une URL, ou null si absent. */
  fetchText?: (url: string) => Promise<string | null>;
  logger?: Logger;
  signal?: AbortSignal;
}

async function defaultFetchText(url: string, signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ProspectAIBot/0.1 (+prospection B2B ; import quotidien AFNIC)' },
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`AFNIC ${url} : HTTP ${response.status}`);
  return response.text();
}

/**
 * Relit les listes des derniers jours et met en file ce qu'on ne connaît
 * pas encore. Idempotent : un domaine déjà présent garde son historique,
 * seule sa priorité de scan est relevée s'il n'a jamais été visité.
 */
export async function importAfnicDaily(db: Db, options: AfnicDailyOptions = {}): Promise<AfnicDailyReport> {
  const report: AfnicDailyReport = { days: 0, fetched: 0, missing: 0, read: 0, queued: 0, alreadyKnown: 0, errors: 0 };
  const log = options.logger;
  const lookback = Math.min(Math.max(options.lookbackDays ?? 3, 1), 7);
  const fetchText = options.fetchText ?? ((url: string) => defaultFetchText(url, options.signal));

  for (let back = 1; back <= lookback; back += 1) {
    if (options.signal?.aborted) break;
    const day = new Date(Date.now() - back * 86_400_000);
    report.days += 1;
    let text: string | null;
    try {
      text = await fetchText(afnicDailyUrl(day));
    } catch (cause: unknown) {
      report.errors += 1;
      log?.warn('Liste AFNIC quotidienne non lue', { day: day.toISOString().slice(0, 10), error: cause instanceof Error ? cause.message : String(cause) });
      continue;
    }
    if (text === null) { report.missing += 1; continue; }
    report.fetched += 1;

    const domains = parseAfnicDailyList(text);
    report.read += domains.length;
    const registeredAt = day.toISOString().slice(0, 10);

    for (let i = 0; i < domains.length; i += 1000) {
      const rows = domains.slice(i, i + 1000).map((domain) => ({ domain, registered_at: registeredAt }));
      const { data, error } = await db
        .from('domains')
        .upsert(rows, { onConflict: 'domain', ignoreDuplicates: true })
        .select('domain');
      if (error) { report.errors += rows.length; log?.warn('Lot AFNIC non enregistré', { error: error.message }); continue; }
      const inserted = data?.length ?? 0;
      report.queued += inserted;
      report.alreadyKnown += rows.length - inserted;

      // Un domaine tout neuf passe devant tout le monde : c'est le moment où
      // le site est vide ou en construction, et où un freelance a quelque
      // chose à proposer.
      if (inserted > 0) {
        await db.from('domains')
          .update({ scan_priority: 95, next_check_at: new Date().toISOString() })
          .in('domain', (data ?? []).map((r) => r.domain))
          .is('last_checked_at', null);
      }
    }
  }

  log?.info('Import AFNIC quotidien terminé', { ...report });
  return report;
}
