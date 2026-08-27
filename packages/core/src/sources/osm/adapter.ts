import type { Json } from '../../db/database.types';
import {
  normalizeAddress,
  normalizeCity,
  normalizeCompanyName,
  normalizeDomainDetailed,
  normalizeEmailDetailed,
  normalizePhone,
  normalizePostalCode,
  normalizeSiret,
  sirenFromSiret,
} from '../../normalization';
import type {
  CompanySourceAdapter,
  DiscoveryParams,
  NormalizedCompanyCandidate,
  RawCompany,
} from '../types';
import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../http/client';

/**
 * OpenStreetMap, via Overpass.
 *
 * C'est la source qui résout le problème central : SIRENE donne l'identité mais
 * aucun moyen de joindre l'entreprise. OSM apporte le téléphone, le site et
 * parfois l'e-mail — et, pour une part importante des commerces français, un
 * `ref:FR:SIRET` qui rattache le point de vente au répertoire de façon
 * déterministe, sans aucun rapprochement approché.
 *
 * Mesures relevées sur quelques villes : téléphone 24-51 %, site 13-43 %,
 * SIRET 47-71 % selon la densité de contribution locale.
 */

/** Catégories OSM correspondant au segment commerce et artisanat. */
const LOCAL_COMMERCE_QUERY = `
  nwr["shop"]["name"](area.zone);
  nwr["craft"]["name"](area.zone);
  nwr["office"~"^(estate_agent|insurance|travel_agent|lawyer|accountant)$"]["name"](area.zone);
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|pharmacy|veterinary|driving_school|dentist|doctors)$"]["name"](area.zone);
  nwr["leisure"~"^(fitness_centre|sports_centre)$"]["name"](area.zone);
  nwr["tourism"~"^(hotel|guest_house|apartment|camp_site)$"]["name"](area.zone);
`;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Instances Overpass publiques.
 *
 * Elles sont tenues par des bénévoles et renvoient régulièrement 504 en
 * période de charge. Un job de découverte qui abandonne parce qu'une instance
 * est occupée ne sert à rien : on bascule sur la suivante.
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

export interface OsmAdapterOptions {
  /**
   * Zones à interroger par défaut, quand `discover` est appelé sans paramètre.
   * Le pipeline d'ingestion ne connaît pas la géographie : c'est la source qui
   * porte son périmètre.
   */
  cities?: string[];
  boundingBox?: [number, number, number, number];
  /** Points d'accès Overpass, essayés dans l'ordre. */
  endpoints?: string[];
  userAgent?: string;
  /** Débit : Overpass est un service bénévole, une requête à la fois suffit. */
  requestsPerSecond?: number;
}

export interface OsmDiscoveryParams extends DiscoveryParams {
  /** Communes à interroger, par leur nom OSM (« Lyon », « Bordeaux »). */
  cities?: string[];
  /** Ou une emprise rectangulaire : [sud, ouest, nord, est]. */
  boundingBox?: [number, number, number, number];
}

export class OsmCompanySource implements CompanySourceAdapter {
  readonly sourceName = 'openstreetmap';
  readonly #endpoints: string[];
  readonly #http: RateLimitedHttpClient;
  readonly #defaultCities: string[];
  readonly #defaultBoundingBox: [number, number, number, number] | undefined;

  constructor(options: OsmAdapterOptions = {}) {
    this.#defaultCities = options.cities ?? [];
    this.#defaultBoundingBox = options.boundingBox;
    this.#endpoints = options.endpoints ?? OVERPASS_ENDPOINTS;
    this.#http = new RateLimitedHttpClient({
      // Une requête toutes les 2 secondes : Overpass est une ressource
      // partagée et bénévole, la saturer nous en ferait exclure.
      requestsPerSecond: options.requestsPerSecond ?? 0.5,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      timeoutMs: 180_000,
      maxRetries: 1,
    });
  }

  /**
   * Interroge la première instance qui répond.
   *
   * Chaque instance a déjà ses propres relances ; ici on change de serveur,
   * ce qui est la seule chose utile face à un 504 persistant.
   */
  async #query(query: string, signal?: AbortSignal): Promise<OverpassResponse> {
    const failures: string[] = [];

    for (const endpoint of this.#endpoints) {
      if (signal?.aborted) throw new Error('Découverte annulée');

      try {
        return await this.#http.fetchJson<OverpassResponse>(
          endpoint,
          {
            method: 'POST',
            body: new URLSearchParams({ data: query }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
          signal,
        );
      } catch (error: unknown) {
        failures.push(`${new URL(endpoint).host} : ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`Aucune instance Overpass disponible — ${failures.join(' ; ')}`);
  }

  #buildQuery(params: OsmDiscoveryParams): string {
    const limit = params.limit ?? 2000;

    if (params.boundingBox) {
      const [south, west, north, east] = params.boundingBox;
      const bbox = `${south},${west},${north},${east}`;
      const body = LOCAL_COMMERCE_QUERY.replace(/\(area\.zone\)/g, `(${bbox})`);
      return `[out:json][timeout:170];(${body});out center ${limit};`;
    }

    const city = params.cities?.[0];
    if (!city) throw new Error('OsmCompanySource : préciser `cities` ou `boundingBox`');

    return [
      '[out:json][timeout:170];',
      `area["name"="${city.replace(/"/g, '')}"]["admin_level"~"^(8|9)$"]->.zone;`,
      `(${LOCAL_COMMERCE_QUERY});`,
      `out center ${limit};`,
    ].join('\n');
  }

  async *discover(params: OsmDiscoveryParams = {}): AsyncIterable<RawCompany> {
    const boundingBox = params.boundingBox ?? this.#defaultBoundingBox;
    const cities = params.cities ?? this.#defaultCities;

    const zones: OsmDiscoveryParams[] = boundingBox
      ? [{ ...params, boundingBox }]
      : cities.map((city) => ({ ...params, cities: [city] }));

    if (zones.length === 0) {
      throw new Error('OsmCompanySource : préciser `cities` ou `boundingBox`');
    }

    for (const zone of zones) {
      if (params.signal?.aborted) return;

      const response = await this.#query(this.#buildQuery(zone), params.signal);

      for (const element of response.elements) {
        if (!element.tags?.['name']) continue;
        yield {
          sourceName: this.sourceName,
          sourceExternalId: `${element.type}/${element.id}`,
          payload: element as unknown as Record<string, Json>,
          // Donnée contributive : fiable sur le contact, moins sur l'exhaustivité.
          confidence: 0.85,
        };
      }
    }
  }

  normalize(raw: RawCompany): NormalizedCompanyCandidate | null {
    const element = raw.payload as unknown as OverpassElement;
    const tags = element.tags ?? {};
    const rejections: NormalizedCompanyCandidate['rejections'] = [];

    const reject = (field: string, value: string | undefined, reason: string): void => {
      if (value) rejections.push({ field, value, reason });
    };

    const name = tags['name'];
    if (!name || !normalizeCompanyName(name)) return null;

    // ── Le rattachement déterministe au répertoire ────────────────────────
    const rawSiret = tags['ref:FR:SIRET'];
    const siret = normalizeSiret(rawSiret);
    if (rawSiret && !siret) reject('siret', rawSiret, 'clé de contrôle invalide');

    // ── Contact ───────────────────────────────────────────────────────────
    const rawPhone = tags['phone'] ?? tags['contact:phone'] ?? tags['contact:mobile'];
    const phone = normalizePhone(rawPhone);
    if (rawPhone && !phone) reject('phone', rawPhone, 'numéro non reconnu');

    const rawWebsite = tags['website'] ?? tags['contact:website'] ?? tags['url'];
    const websiteResult = normalizeDomainDetailed(rawWebsite);
    if (rawWebsite && !websiteResult.domain) {
      reject('domain', rawWebsite, websiteResult.rejectedReason ?? 'format');
    }

    const rawEmail = tags['email'] ?? tags['contact:email'];
    const emailResult = normalizeEmailDetailed(rawEmail);
    if (rawEmail && !emailResult.email) reject('email', rawEmail, 'adresse invalide');

    // ── Localisation ──────────────────────────────────────────────────────
    const lat = element.lat ?? element.center?.lat ?? null;
    const lon = element.lon ?? element.center?.lon ?? null;

    const streetParts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean);
    const address = streetParts.length > 0 ? normalizeAddress(streetParts.join(' ')) : null;
    const postalCode = normalizePostalCode(tags['addr:postcode']);

    return {
      siren: sirenFromSiret(siret),
      siret,
      // OSM donne le nom d'enseigne, pas la raison sociale. On le place en
      // nom légal faute de mieux : la fusion sur SIRET récupérera la raison
      // sociale de SIRENE quand elle existe.
      legalName: name.slice(0, 300),
      commercialName: tags['brand'] ?? tags['operator'] ?? null,

      domain: websiteResult.domain,
      websiteUrl: websiteResult.domain ? `https://${websiteResult.domain}` : null,

      phone,
      contactFormUrl: null,

      address,
      postalCode,
      city: tags['addr:city'] ? titleCase(normalizeCity(tags['addr:city'])) : null,
      region: null,
      lat,
      lon,

      industryCode: null,
      industryLabel: describeCategory(tags),
      segment: 'local_commerce',

      employeeMin: null,
      employeeMax: null,
      creationDate: null,
      // OSM ne décrit pas l'état administratif ; un POI cartographié est
      // supposé exister, mais on ne l'affirme pas.
      companyStatus: 'unknown',

      // OSM ne porte aucune restriction de diffusion. La contrainte
      // éventuelle viendra de SIRENE lors de la fusion.
      prospectingAllowed: true,
      identityConfidence: siret ? 0.95 : postalCode && lat !== null ? 0.6 : 0.4,

      raw,
      rejections,
    };
  }
}

/** Libellé lisible à partir des étiquettes OSM. */
function describeCategory(tags: Record<string, string>): string | null {
  const key = tags['shop'] ?? tags['craft'] ?? tags['amenity'] ?? tags['office']
    ?? tags['leisure'] ?? tags['tourism'];
  if (!key) return null;
  return key.replace(/_/g, ' ');
}

function titleCase(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );
}
