import { RateLimitedHttpClient, DEFAULT_USER_AGENT } from '../http/client';
import { normalizePostalCode } from '../../normalization';

/**
 * Sitadel : les autorisations d'urbanisme créant des locaux non
 * résidentiels, servies par l'API DiDo du ministère.
 *
 * Source secondaire. Un permis n'est pas un lead : c'est un signal de
 * contexte — une entreprise qui ouvre un local commercial, un hôtel, des
 * bureaux est dans un moment d'investissement. Le demandeur porte son
 * SIRET : on rattache par identité, jamais par une adresse devinée.
 */

const DATAFILE = 'f8f0700f-806c-40a7-83b1-f21cf507e7c4';
const ENDPOINT = `https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles/${DATAFILE}/rows`;

export type PremisesKind = 'commercial' | 'hotel' | 'office' | 'industrial' | 'warehouse' | 'public' | 'other';

export interface BuildingPermit {
  permitId: string;
  communeCode: string;
  permitType: string;
  applicantSiren: string | null;
  applicantSiret: string | null;
  applicantName: string | null;
  applicantNaf: string | null;
  siteAddress: string | null;
  sitePostalCode: string | null;
  siteCity: string | null;
  destination: number | null;
  surfaces: Record<string, number>;
  premisesKind: PremisesKind;
  authorizedAt: string;
  depositedAt: string | null;
}

export interface SitadelRow {
  COMM?: string | null; TYPE_DAU?: string | null; NUM_DAU?: string | null;
  SIREN_DEM?: string | null; SIRET_DEM?: string | null; DENOM_DEM?: string | null; APE_DEM?: string | null;
  ADR_NUM_TER?: string | null; ADR_LIBVOIE_TER?: string | null; ADR_LOCALITE_TER?: string | null; ADR_CODPOST_TER?: string | null;
  DESTINATION_PRINCIPALE?: number | null;
  SURF_COM_CREEE?: number | null; SURF_HEB_CREEE?: number | null; SURF_BUR_CREEE?: number | null;
  SURF_IND_CREEE?: number | null; SURF_ENT_CREEE?: number | null; SURF_PUB_CREEE?: number | null;
  DATE_REELLE_AUTORISATION?: string | null; DR_DEPOT?: string | null;
}

/** La sorte de local : la surface créée la plus grande décide. */
export function premisesKindOf(surfaces: Record<string, number>): PremisesKind {
  const ranked = Object.entries(surfaces).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  switch (top) {
    case 'commercial': return 'commercial';
    case 'hotel': return 'hotel';
    case 'office': return 'office';
    case 'industrial': return 'industrial';
    case 'warehouse': return 'warehouse';
    case 'public': return 'public';
    default: return 'other';
  }
}

export function normalizePermit(row: SitadelRow, today = new Date().toISOString().slice(0, 10)): BuildingPermit | null {
  const commune = row.COMM?.trim();
  const num = row.NUM_DAU?.trim();
  const authorizedAt = row.DATE_REELLE_AUTORISATION?.trim();
  if (!commune || !num || !authorizedAt || !/^\d{4}-\d{2}-\d{2}$/.test(authorizedAt)) return null;
  // Des dates d'autorisation dans le futur figurent dans la source : on ne
  // date pas un fait qui n'a pas eu lieu.
  if (authorizedAt > today) return null;
  const siret = row.SIRET_DEM && /^\d{14}$/.test(row.SIRET_DEM) ? row.SIRET_DEM : null;
  const siren = siret ? siret.slice(0, 9) : (row.SIREN_DEM && /^\d{9}$/.test(row.SIREN_DEM) ? row.SIREN_DEM : null);
  const surfaces: Record<string, number> = {
    commercial: Number(row.SURF_COM_CREEE ?? 0), hotel: Number(row.SURF_HEB_CREEE ?? 0), office: Number(row.SURF_BUR_CREEE ?? 0),
    industrial: Number(row.SURF_IND_CREEE ?? 0), warehouse: Number(row.SURF_ENT_CREEE ?? 0), public: Number(row.SURF_PUB_CREEE ?? 0),
  };
  const address = [row.ADR_NUM_TER, row.ADR_LIBVOIE_TER].filter((v) => v && String(v).trim()).join(' ').trim() || null;
  return {
    permitId: `${commune}-${num}`,
    communeCode: commune,
    permitType: row.TYPE_DAU?.trim() || 'PC',
    applicantSiren: siren,
    applicantSiret: siret,
    applicantName: row.DENOM_DEM?.trim() || null,
    applicantNaf: row.APE_DEM?.trim() || null,
    siteAddress: address,
    sitePostalCode: normalizePostalCode(row.ADR_CODPOST_TER ?? null),
    siteCity: row.ADR_LOCALITE_TER?.trim() || null,
    destination: row.DESTINATION_PRINCIPALE ?? null,
    surfaces,
    premisesKind: premisesKindOf(surfaces),
    authorizedAt,
    depositedAt: row.DR_DEPOT ?? null,
  };
}

export interface FetchPermitsOptions {
  /** Autorisations depuis cette date (AAAA-MM-JJ). */
  since?: string;
  limit?: number;
  signal?: AbortSignal;
}

const COLUMNS = ['COMM', 'TYPE_DAU', 'NUM_DAU', 'SIREN_DEM', 'SIRET_DEM', 'DENOM_DEM', 'APE_DEM',
  'ADR_NUM_TER', 'ADR_LIBVOIE_TER', 'ADR_LOCALITE_TER', 'ADR_CODPOST_TER', 'DESTINATION_PRINCIPALE',
  'SURF_COM_CREEE', 'SURF_HEB_CREEE', 'SURF_BUR_CREEE', 'SURF_IND_CREEE', 'SURF_ENT_CREEE', 'SURF_PUB_CREEE',
  'DATE_REELLE_AUTORISATION', 'DR_DEPOT'];

/** Les permis autorisés depuis une date, les plus récents d'abord, par pages de cent. Seuls ceux avec SIRET sont gardés. */
export async function fetchRecentPermits(options: FetchPermitsOptions = {}): Promise<BuildingPermit[]> {
  const http = new RateLimitedHttpClient({ requestsPerSecond: 1, userAgent: DEFAULT_USER_AGENT, timeoutMs: 90_000 });
  const limit = Math.min(options.limit ?? 2000, 20_000);
  const since = options.since ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const out: BuildingPermit[] = [];
  const pageSize = 100;
  for (let page = 1; (page - 1) * pageSize < limit; page += 1) {
    if (options.signal?.aborted) break;
    const url = `${ENDPOINT}?page=${page}&pageSize=${pageSize}&orderBy=-DATE_REELLE_AUTORISATION`
      + `&DATE_REELLE_AUTORISATION=gte:${since}&columns=${COLUMNS.join(',')}`;
    const response = await http.fetchJson<{ data?: SitadelRow[] }>(url, {}, options.signal);
    const rows = response?.data ?? [];
    for (const row of rows) {
      const permit = normalizePermit(row);
      if (permit && permit.applicantSiret) out.push(permit);
    }
    if (rows.length < pageSize) break;
  }
  return out;
}
