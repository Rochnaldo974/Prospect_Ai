import { normalizeSiren } from '../../normalization';
import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../http/client';

/**
 * BODACC — Bulletin officiel des annonces civiles et commerciales.
 *
 * C'est le flux d'événements datés qui manquait au moteur. SIRENE dit ce qui
 * existe ; BODACC dit ce qui vient de se passer, et publie tous les jours :
 *
 *   Créations             une entreprise vient d'ouvrir
 *   Ventes et cessions    un fonds change de mains — le repreneur refait
 *                         souvent l'enseigne, le site, la carte
 *   Modifications         changement d'activité, d'adresse, de dirigeant
 *   Procédures collectives  redressement ou liquidation — signal d'EXCLUSION,
 *                         on ne démarche pas une entreprise en difficulté
 *
 * Gratuit, sans clé, ~50 millions d'annonces historiques.
 */

const ENDPOINT =
  'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';

export type BodaccFamily =
  | 'Créations'
  | 'Ventes et cessions'
  | 'Modifications diverses'
  | 'Procédures collectives'
  | 'Radiations'
  | 'Immatriculations';

/** Ce que chaque famille signifie pour le moteur. */
export const FAMILY_MEANING: Record<
  string,
  { eventType: string; importance: number; excludes: boolean }
> = {
  'Créations': { eventType: 'bodacc_creation', importance: 92, excludes: false },
  'Immatriculations': { eventType: 'bodacc_immatriculation', importance: 88, excludes: false },
  'Ventes et cessions': { eventType: 'bodacc_cession', importance: 90, excludes: false },
  'Modifications diverses': { eventType: 'bodacc_modification', importance: 60, excludes: false },
  'Procédures collectives': { eventType: 'bodacc_procedure_collective', importance: 95, excludes: true },
  'Radiations': { eventType: 'bodacc_radiation', importance: 95, excludes: true },
};

export interface BodaccAnnouncement {
  id: string;
  siren: string;
  family: string;
  eventType: string;
  /** Une entreprise sous procédure ou radiée ne doit plus être démarchée. */
  excludes: boolean;
  importance: number;
  publishedAt: string;
  city: string | null;
  postalCode: string | null;
  department: string | null;
  tradeName: string | null;
  court: string | null;
  url: string | null;
  raw: Record<string, unknown>;
}

interface BodaccRecord {
  id?: string;
  registre?: string[] | string | null;
  familleavis_lib?: string | null;
  dateparution?: string | null;
  ville?: string | null;
  cp?: string | null;
  numerodepartement?: string | null;
  commercant?: string | null;
  tribunal?: string | null;
  url_complete?: string | null;
  [key: string]: unknown;
}

interface BodaccResponse {
  total_count: number;
  results: BodaccRecord[];
}

export interface BodaccFetchParams {
  since: Date;
  until?: Date;
  families?: BodaccFamily[];
  departments?: string[];
  /** Plafond d'annonces à parcourir. */
  limit?: number;
  signal?: AbortSignal;
}

export class BodaccSource {
  readonly sourceName = 'bodacc';
  readonly #http: RateLimitedHttpClient;

  constructor(options: { userAgent?: string; requestsPerSecond?: number } = {}) {
    this.#http = new RateLimitedHttpClient({
      requestsPerSecond: options.requestsPerSecond ?? 2,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      timeoutMs: 60_000,
    });
  }

  #buildWhere(params: BodaccFetchParams): string {
    const clauses = [`dateparution >= date'${params.since.toISOString().slice(0, 10)}'`];

    if (params.until) {
      clauses.push(`dateparution <= date'${params.until.toISOString().slice(0, 10)}'`);
    }

    if (params.families?.length) {
      const list = params.families.map((f) => `"${f}"`).join(', ');
      clauses.push(`familleavis_lib in (${list})`);
    }

    if (params.departments?.length) {
      const list = params.departments.map((d) => `"${d}"`).join(', ');
      clauses.push(`numerodepartement in (${list})`);
    }

    return clauses.join(' and ');
  }

  /**
   * Parcourt les annonces publiées depuis une date.
   *
   * Pagination par offset : l'API plafonne à 100 par page et 10 000 au total
   * pour une même recherche. Au-delà, il faut découper par date — c'est ce que
   * fait l'appelant en synchronisant jour par jour.
   */
  async *fetch(params: BodaccFetchParams): AsyncIterable<BodaccAnnouncement> {
    const pageSize = 100;
    const hardLimit = params.limit ?? 10_000;
    let offset = 0;

    while (offset < hardLimit) {
      if (params.signal?.aborted) return;

      const url = new URL(ENDPOINT);
      url.searchParams.set('where', this.#buildWhere(params));
      url.searchParams.set('limit', String(Math.min(pageSize, hardLimit - offset)));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('order_by', 'dateparution desc');

      const response = await this.#http.fetchJson<BodaccResponse>(
        url.toString(),
        {},
        params.signal,
      );

      if (response.results.length === 0) return;

      for (const record of response.results) {
        const announcement = this.normalize(record);
        if (announcement) yield announcement;
      }

      offset += response.results.length;
      if (offset >= response.total_count) return;
    }
  }

  /** Nombre d'annonces correspondant aux critères, sans les parcourir. */
  async count(params: BodaccFetchParams): Promise<number> {
    const url = new URL(ENDPOINT);
    url.searchParams.set('where', this.#buildWhere(params));
    url.searchParams.set('limit', '1');

    const response = await this.#http.fetchJson<BodaccResponse>(
      url.toString(),
      {},
      params.signal,
    );
    return response.total_count;
  }

  normalize(record: BodaccRecord): BodaccAnnouncement | null {
    // `registre` contient le SIREN sous plusieurs graphies (avec et sans
    // espaces), parfois répétées. Une seule suffit, validée par sa clé.
    const registre = Array.isArray(record.registre)
      ? record.registre
      : record.registre
        ? [record.registre]
        : [];

    let siren: string | null = null;
    for (const entry of registre) {
      siren = normalizeSiren(entry);
      if (siren) break;
    }
    if (!siren) return null;

    const family = record.familleavis_lib ?? '';
    const meaning = FAMILY_MEANING[family];
    if (!meaning) return null;

    const publishedAt = record.dateparution;
    if (!publishedAt) return null;

    return {
      id: record.id ?? `${siren}-${publishedAt}-${family}`,
      siren,
      family,
      eventType: meaning.eventType,
      excludes: meaning.excludes,
      importance: meaning.importance,
      publishedAt,
      city: record.ville ?? null,
      postalCode: record.cp ?? null,
      department: record.numerodepartement ?? null,
      tradeName: record.commercant ?? null,
      court: record.tribunal ?? null,
      url: record.url_complete ?? null,
      raw: record,
    };
  }
}
