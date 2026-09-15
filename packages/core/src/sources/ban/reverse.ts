import type { Db } from '../../db/client';
import type { Logger } from '../../logger';
import { normalizePostalCode } from '../../normalization';
import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../http/client';
import { runPool } from '../http/pool';

/**
 * Code postal depuis les coordonnées, par la Base Adresse Nationale.
 *
 * Un point d'intérêt OpenStreetMap a presque toujours ses coordonnées et
 * rarement son code postal : le contributeur a placé le commerce sur la
 * carte, pas rempli sa fiche. Or le code postal est la clé qui permet
 * d'interroger le répertoire par nom sans se perdre dans les homonymes — une
 * « Boulangerie du Centre » existe dans chaque ville de France.
 *
 * Service public, gratuit, sans clé. On reste très en dessous de son plafond.
 */

const ENDPOINT = 'https://api-adresse.data.gouv.fr/reverse/';

interface BanFeature {
  properties?: {
    postcode?: string | null;
    city?: string | null;
    score?: number | null;
  } | null;
}

interface BanResponse {
  features?: BanFeature[] | null;
}

export interface ReverseGeocodeReport {
  examined: number;
  filled: number;
  notFound: number;
  errors: number;
}

export interface ReverseGeocodeOptions {
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  requestsPerSecond?: number;
  /** Requêtes en vol simultanément ; le débit reste borné par le limiteur. */
  concurrency?: number;
}

export async function fillPostalCodesFromCoordinates(
  db: Db,
  options: ReverseGeocodeOptions = {},
): Promise<ReverseGeocodeReport> {
  const report: ReverseGeocodeReport = { examined: 0, filled: 0, notFound: 0, errors: 0 };
  const log = options.logger;
  const http = new RateLimitedHttpClient({
    requestsPerSecond: options.requestsPerSecond ?? 10,
    userAgent: DEFAULT_USER_AGENT,
    timeoutMs: 15_000,
    maxRetries: 2,
  });

  const { data: targets, error } = await db
    .from('companies')
    .select('id, lat, lon, city')
    .is('postal_code', null)
    .not('lat', 'is', null)
    .not('lon', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(options.limit ?? 500);

  if (error) throw new Error(`fillPostalCodesFromCoordinates : ${error.message}`);

  await runPool(targets ?? [], options.concurrency ?? 6, async (company) => {
    if (options.signal?.aborted) return;
    report.examined += 1;

    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set('lat', String(company.lat));
      url.searchParams.set('lon', String(company.lon));
      url.searchParams.set('limit', '1');

      const response = await http.fetchJson<BanResponse>(url.toString(), {}, options.signal);
      const found = response.features?.[0]?.properties ?? null;
      const postal = normalizePostalCode(found?.postcode ?? null);

      // Un score faible signale un point loin de toute adresse connue : en
      // pleine zone d'activité ou en bord de route, mieux vaut ne rien écrire
      // qu'un code postal voisin.
      if (!postal || (found?.score ?? 0) < 0.4) {
        report.notFound += 1;
        return;
      }

      const { error: updateError } = await db
        .from('companies')
        .update({
          postal_code: postal,
          ...(company.city === null && found?.city ? { city: found.city } : {}),
        })
        .eq('id', company.id);

      if (updateError) {
        report.errors += 1;
        log?.warn('Code postal non enregistré', { company_id: company.id, error: updateError.message });
        return;
      }
      report.filled += 1;
    } catch (fetchError: unknown) {
      report.errors += 1;
      log?.warn('Géocodage inverse en échec', {
        company_id: company.id,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
    }
  });

  log?.info('Codes postaux complétés depuis les coordonnées', {
    examined: report.examined, filled: report.filled, not_found: report.notFound,
  });

  return report;
}
