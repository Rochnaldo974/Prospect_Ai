import type { Json } from '../../db/database.types';
import {
  normalizeAddress,
  normalizeCity,
  normalizeCompanyName,
  normalizeDomainDetailed,
  normalizePhone,
  normalizePostalCode,
  normalizeSiren,
  normalizeSiret,
  sirenFromSiret,
} from '../../normalization';
import type {
  CompanySourceAdapter,
  DiscoveryParams,
  NormalizedCompanyCandidate,
  RawCompany,
} from '../types';
import { inferMapping, type ColumnMapping } from './mapping';
import { parseCsv, type CsvRow } from './parser';
import {
  isLocalCommerce,
  isProspectable,
  normalizeNafCode,
  parseAdministrativeStatus,
  parseEmployeeRange,
  parseSireneDate,
} from './sirene-codes';

export interface CsvAdapterOptions {
  sourceName: string;
  content: string;
  mapping?: ColumnMapping;
  /** Confiance appliquée aux lignes de ce fichier. */
  confidence?: number;
  /** Le fichier suit-il les conventions SIRENE (statut de diffusion, codes) ? */
  sireneConventions?: boolean;
  /** N'ingérer que le segment commerce et artisanat local. */
  localCommerceOnly?: boolean;
}

/**
 * Source CSV.
 *
 * C'est le chemin principal d'ingestion SIRENE : l'API de l'INSEE est limitée à
 * quelques dizaines de requêtes par minute, ce qui interdit d'y faire passer un
 * stock national. Le fichier open data, lui, se lit d'un bloc et ne demande
 * aucune clé. L'API reste utile pour l'incrémental, pas pour la constitution
 * du socle.
 */
export class CsvCompanySource implements CompanySourceAdapter {
  readonly sourceName: string;
  readonly #content: string;
  readonly #confidence: number;
  readonly #sireneConventions: boolean;
  readonly #localCommerceOnly: boolean;
  #mapping: ColumnMapping;
  #headers: string[] = [];
  #malformed: { lineNumber: number; reason: string }[] = [];

  constructor(options: CsvAdapterOptions) {
    this.sourceName = options.sourceName;
    this.#content = options.content;
    this.#confidence = options.confidence ?? 0.8;
    this.#sireneConventions = options.sireneConventions ?? false;
    this.#localCommerceOnly = options.localCommerceOnly ?? false;
    this.#mapping = options.mapping ?? {};
  }

  get mapping(): ColumnMapping {
    return this.#mapping;
  }

  get headers(): string[] {
    return this.#headers;
  }

  get malformedLines(): { lineNumber: number; reason: string }[] {
    return this.#malformed;
  }

  async *discover(params: DiscoveryParams = {}): AsyncIterable<RawCompany> {
    const parsed = parseCsv(this.#content, params.limit ? { limit: params.limit } : {});
    this.#headers = parsed.headers;
    this.#malformed = parsed.malformed;

    if (Object.keys(this.#mapping).length === 0) {
      this.#mapping = inferMapping(parsed.headers);
    }

    for (const row of parsed.rows) {
      if (params.signal?.aborted) return;
      yield this.#toRaw(row);
    }
  }

  #toRaw(row: CsvRow): RawCompany {
    const get = (field: keyof ColumnMapping): string | null => {
      const column = this.#mapping[field];
      if (!column) return null;
      const value = row.values[column];
      return value && value.trim() ? value.trim() : null;
    };

    // Identifiant stable : le SIRET s'il existe, sinon la ligne du fichier.
    const siret = get('siret');
    const externalId = siret ?? `${this.sourceName}:ligne-${row.lineNumber}`;

    return {
      sourceName: this.sourceName,
      sourceExternalId: externalId,
      payload: row.values as Record<string, Json>,
      confidence: this.#confidence,
    };
  }

  normalize(raw: RawCompany): NormalizedCompanyCandidate | null {
    const values = raw.payload as Record<string, string>;
    const rejections: NormalizedCompanyCandidate['rejections'] = [];

    const get = (field: keyof ColumnMapping): string | null => {
      const column = this.#mapping[field];
      if (!column) return null;
      const value = values[column];
      return value && value.trim() ? value.trim() : null;
    };

    const reject = (field: string, value: string | null, reason: string): void => {
      if (value) rejections.push({ field, value, reason });
    };

    // ── Identité ──────────────────────────────────────────────────────────
    const rawSiret = get('siret');
    const rawSiren = get('siren');

    const siret = normalizeSiret(rawSiret);
    if (rawSiret && !siret) reject('siret', rawSiret, 'clé de contrôle invalide');

    const siren = normalizeSiren(rawSiren) ?? sirenFromSiret(siret);
    if (rawSiren && !normalizeSiren(rawSiren)) {
      reject('siren', rawSiren, 'clé de contrôle invalide');
    }

    const rawLegalName = get('legalName');
    const rawCommercialName = get('commercialName');

    // Sans nom exploitable, la ligne ne peut produire aucune entreprise.
    const legalName = rawLegalName ?? rawCommercialName;
    if (!legalName || !normalizeCompanyName(legalName)) return null;

    // ── Présence web ──────────────────────────────────────────────────────
    const rawDomain = get('domain');
    const domainResult = normalizeDomainDetailed(rawDomain);
    if (rawDomain && !domainResult.domain) {
      reject('domain', rawDomain, domainResult.rejectedReason ?? 'format');
    }

    // ── Contact ───────────────────────────────────────────────────────────
    const rawPhone = get('phone');
    const phone = normalizePhone(rawPhone);
    if (rawPhone && !phone) reject('phone', rawPhone, 'numéro non reconnu');

    // ── Localisation ──────────────────────────────────────────────────────
    const rawPostal = get('postalCode');
    const postalCode = normalizePostalCode(rawPostal);
    if (rawPostal && !postalCode) reject('postalCode', rawPostal, 'code postal invalide');

    const lat = toCoordinate(get('lat'), 90);
    const lon = toCoordinate(get('lon'), 180);

    // ── Activité ──────────────────────────────────────────────────────────
    const rawNaf = get('industryCode');
    const industryCode = this.#sireneConventions ? normalizeNafCode(rawNaf) : rawNaf;
    if (rawNaf && !industryCode) reject('industryCode', rawNaf, 'code NAF non reconnu');

    if (this.#localCommerceOnly && !isLocalCommerce(industryCode)) return null;

    // ── Conformité ────────────────────────────────────────────────────────
    const diffusion = get('diffusion');
    const prospectingAllowed = this.#sireneConventions ? isProspectable(diffusion) : true;

    const employees = this.#sireneConventions
      ? parseEmployeeRange(get('employeeRange'))
      : { min: null, max: null };

    const companyStatus = this.#sireneConventions
      ? parseAdministrativeStatus(get('status'))
      : 'unknown';

    return {
      siren,
      siret,
      legalName: legalName.slice(0, 300),
      commercialName: rawCommercialName && rawCommercialName !== rawLegalName
        ? rawCommercialName.slice(0, 300)
        : null,

      domain: domainResult.domain,
      websiteUrl: domainResult.domain ? `https://${domainResult.domain}` : null,

      phone,
      contactFormUrl: null,

      address: normalizeAddress(get('address')),
      postalCode,
      city: get('city') ? titleCase(normalizeCity(get('city'))) : null,
      region: get('region'),
      lat,
      lon,

      industryCode,
      industryLabel: get('industryLabel'),
      segment: isLocalCommerce(industryCode) ? 'local_commerce' : 'other',

      employeeMin: employees.min,
      employeeMax: employees.max,
      creationDate: parseSireneDate(get('creationDate')),
      companyStatus,

      prospectingAllowed,
      // Un SIRET vérifié vaut mieux qu'un nom et une ville.
      identityConfidence: siret ? 0.98 : siren ? 0.92 : postalCode ? 0.65 : 0.45,

      raw,
      rejections,
    };
  }
}

function toCoordinate(value: string | null, bound: number): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || Math.abs(parsed) > bound) return null;
  // 0,0 est le point nul de l'Atlantique : c'est une valeur manquante déguisée.
  if (parsed === 0) return null;
  return parsed;
}

function titleCase(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );
}
