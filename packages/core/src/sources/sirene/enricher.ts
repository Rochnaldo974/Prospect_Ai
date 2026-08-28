import type { Db } from '../../db/client';
import type { Update } from '../../domain/types';
import type { Logger } from '../../logger';
import { normalizeSiren, normalizePostalCode } from '../../normalization';
import { parseEmployeeRange, isProspectable, normalizeNafCode, parseSireneDate } from '../csv/sirene-codes';
import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../http/client';

/**
 * Enrichissement depuis le répertoire, par l'API Recherche d'entreprises.
 *
 * OpenStreetMap apporte le contact mais aucun fait daté : ni date de création,
 * ni effectif, ni statut administratif. Or la création récente est le meilleur
 * déclencheur du produit — mesuré sur les données réelles, son absence
 * réduisait à trois le nombre d'entreprises capables de produire une
 * opportunité sur près de neuf cents.
 *
 * Le SIREN vient du `ref:FR:SIRET` d'OSM : le rattachement est déterministe,
 * il n'y a donc aucun rapprochement approché à faire ici.
 *
 * API publique, gratuite, sans clé, plafonnée à sept requêtes par seconde.
 */

const ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search';

interface ApiEtablissement {
  siret?: string | null;
  date_creation?: string | null;
  etat_administratif?: string | null;
  statut_diffusion_etablissement?: string | null;
  tranche_effectif_salarie?: string | null;
  activite_principale?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  liste_enseignes?: string[] | null;
  nom_commercial?: string | null;
  adresse?: string | null;
}

interface ApiResult {
  siren?: string | null;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  date_creation?: string | null;
  activite_principale?: string | null;
  siege?: ApiEtablissement | null;
  matching_etablissements?: ApiEtablissement[] | null;
}

interface ApiResponse {
  results?: ApiResult[];
}

export interface EnrichReport {
  examined: number;
  enriched: number;
  notFound: number;
  unchanged: number;
  errors: number;
  fieldsFilled: Record<string, number>;
}

export interface EnrichOptions {
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  requestsPerSecond?: number;
}

/**
 * Complète les entreprises qui portent un SIREN mais à qui il manque des
 * faits du répertoire.
 *
 * Ne remplit que ce qui manque : une donnée déjà présente vient d'une source
 * qui l'a observée sur le terrain, et n'a pas à être écrasée.
 */
export async function enrichFromSirene(
  db: Db,
  options: EnrichOptions = {},
): Promise<EnrichReport> {
  const report: EnrichReport = {
    examined: 0, enriched: 0, notFound: 0, unchanged: 0, errors: 0, fieldsFilled: {},
  };

  const log = options.logger;
  const http = new RateLimitedHttpClient({
    // Sous le plafond annoncé : rien ne presse, et le service est public.
    requestsPerSecond: options.requestsPerSecond ?? 5,
    userAgent: DEFAULT_USER_AGENT,
    timeoutMs: 20_000,
    maxRetries: 2,
  });

  const { data: targets, error } = await db
    .from('companies')
    .select('id, siren, siret, creation_date, employee_min, industry_code, lat, commercial_name, city, postal_code')
    .not('siren', 'is', null)
    .is('creation_date', null)
    .order('updated_at', { ascending: false })
    .limit(options.limit ?? 200);

  if (error) throw new Error(`enrichFromSirene : ${error.message}`);

  for (const company of targets ?? []) {
    if (options.signal?.aborted) break;
    report.examined += 1;

    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set('q', company.siren!);
      url.searchParams.set('per_page', '1');
      url.searchParams.set('limite_matching_etablissements', '10');

      const response = await http.fetchJson<ApiResponse>(url.toString(), {}, options.signal);
      const result = response.results?.find((r) => normalizeSiren(r.siren) === company.siren);

      if (!result) {
        report.notFound += 1;
        continue;
      }

      // On préfère l'établissement exact quand on connaît son SIRET : la date
      // d'ouverture d'un point de vente n'est pas celle de l'unité légale.
      const establishment =
        (company.siret
          ? result.matching_etablissements?.find((e) => e.siret === company.siret)
          : null)
        ?? result.siege
        ?? null;

      const patch = buildPatch(company, result, establishment);

      if (Object.keys(patch).length === 0) {
        report.unchanged += 1;
        continue;
      }

      const { error: updateError } = await db
        .from('companies')
        .update(patch)
        .eq('id', company.id);

      if (updateError) {
        report.errors += 1;
        log?.warn('Enrichissement non enregistré', {
          company_id: company.id, error: updateError.message,
        });
        continue;
      }

      report.enriched += 1;
      for (const field of Object.keys(patch)) {
        report.fieldsFilled[field] = (report.fieldsFilled[field] ?? 0) + 1;
      }
    } catch (fetchError: unknown) {
      report.errors += 1;
      log?.warn('Appel au répertoire en échec', {
        siren: company.siren,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
    }
  }

  log?.info('Enrichissement depuis le répertoire terminé', {
    examined: report.examined,
    enriched: report.enriched,
    not_found: report.notFound,
  });

  return report;
}

type Target = {
  creation_date: string | null;
  employee_min: number | null;
  industry_code: string | null;
  lat: number | null;
  commercial_name: string | null;
  city: string | null;
  postal_code: string | null;
};

/** Ne remplit que ce qui manque. */
function buildPatch(
  company: Target,
  result: ApiResult,
  establishment: ApiEtablissement | null,
): Update<'companies'> {
  const patch: Update<'companies'> = {};

  if (company.creation_date === null) {
    const date = parseSireneDate(establishment?.date_creation ?? result.date_creation ?? null);
    if (date) patch.creation_date = date;
  }

  if (company.employee_min === null && establishment?.tranche_effectif_salarie) {
    const range = parseEmployeeRange(establishment.tranche_effectif_salarie);
    if (range.min !== null) {
      patch.employee_min = range.min;
      patch.employee_max = range.max;
    }
  }

  if (company.industry_code === null) {
    const naf = normalizeNafCode(establishment?.activite_principale ?? result.activite_principale ?? null);
    if (naf) patch.industry_code = naf;
  }

  if (company.lat === null && establishment?.latitude && establishment.longitude) {
    const lat = Number(establishment.latitude);
    const lon = Number(establishment.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0) {
      patch.lat = lat;
      patch.lon = lon;
    }
  }

  if (company.postal_code === null && establishment?.code_postal) {
    const postal = normalizePostalCode(establishment.code_postal);
    if (postal) patch.postal_code = postal;
  }

  if (company.commercial_name === null) {
    const enseigne = establishment?.liste_enseignes?.[0] ?? establishment?.nom_commercial ?? null;
    if (enseigne) patch.commercial_name = enseigne.slice(0, 300);
  }

  // Statut administratif : une fermeture prime toujours, elle retire
  // l'entreprise de la prospection.
  if (establishment?.etat_administratif === 'F') {
    patch.company_status = 'closed';
  } else if (establishment?.etat_administratif === 'A') {
    patch.company_status = 'active';
  }

  // Statut de diffusion : une restriction est toujours retenue.
  if (establishment?.statut_diffusion_etablissement
      && !isProspectable(establishment.statut_diffusion_etablissement)) {
    patch.prospecting_allowed = false;
  }

  if (Object.keys(patch).length > 0) {
    patch.last_seen_at = new Date().toISOString();
  }

  return patch;
}
