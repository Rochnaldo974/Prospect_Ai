import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { normalizeSiren, normalizePhone, normalizePostalCode } from '../normalization';
import { normalizeNafCode, parseEmployeeRange, parseSireneDate, isProspectable } from '../sources/csv/sirene-codes';
import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../sources/http/client';

/**
 * Découverte inverse : du site vers l'entreprise.
 *
 * C'est le chemin qui produit le plus de volume, et le seul qui livre à la
 * fois l'identité ET le contact.
 *
 * Un site professionnel français doit afficher son SIREN dans ses mentions
 * légales. Notre scanner l'extrait déjà. Quand ce SIREN ne correspond à
 * aucune entreprise connue, on tient pourtant tout ce qu'il faut : l'identité
 * légale, le site, et le téléphone que la page affiche.
 *
 * Mesuré sur 120 domaines .fr récemment déposés : 13 % livrent un SIREN et
 * 6 % livrent SIREN et téléphone. Rapporté aux 4,6 millions de domaines .fr
 * actifs, c'est le gisement principal du produit — là où SIRENE ne donne
 * jamais de contact et OpenStreetMap jamais de date.
 */

export interface DomainToCompanyReport {
  domainsExamined: number;
  sirensSeen: number;
  alreadyKnown: number;
  companiesCreated: number;
  /** SIREN écartés parce que présents sur plusieurs domaines — agences web. */
  sharedSkipped: number;
  /** Domaines dont les mentions légales portent plusieurs exploitants possibles. */
  ambiguousOwnership: number;
  notFoundInRegistry: number;
  errors: number;
}

export interface DomainToCompanyOptions {
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  requestsPerSecond?: number;
}

const REGISTRY_ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search';

interface RegistryEstablishment {
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
  adresse?: string | null;
  est_siege?: boolean | null;
}

interface RegistryResult {
  siren?: string | null;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  date_creation?: string | null;
  activite_principale?: string | null;
  siege?: RegistryEstablishment | null;
}

/**
 * Crée les entreprises identifiées par les mentions légales de leur site.
 *
 * Le nom vient du répertoire et non de la page : une balise `title` est un
 * argument commercial, pas une raison sociale.
 */
export async function createCompaniesFromDomains(
  db: Db,
  options: DomainToCompanyOptions = {},
): Promise<DomainToCompanyReport> {
  const report: DomainToCompanyReport = {
    domainsExamined: 0, sirensSeen: 0, alreadyKnown: 0, companiesCreated: 0,
    sharedSkipped: 0, ambiguousOwnership: 0, notFoundInRegistry: 0, errors: 0,
  };

  const log = options.logger;
  const http = new RateLimitedHttpClient({
    requestsPerSecond: options.requestsPerSecond ?? 5,
    userAgent: DEFAULT_USER_AGENT,
    timeoutMs: 20_000,
    maxRetries: 2,
  });

  const { data: domains, error } = await db
    .from('domains')
    .select('domain, sirens_found, phones_found, emails_found, contact_form_url, status')
    .not('sirens_found', 'eq', '{}')
    .eq('status', 'reachable')
    .order('last_checked_at', { ascending: false })
    .limit(options.limit ?? 200);

  if (error) throw new Error(`createCompaniesFromDomains : ${error.message}`);

  for (const row of domains ?? []) {
    if (options.signal?.aborted) break;
    report.domainsExamined += 1;

    // Écarte d'emblée les SIREN d'agences et d'hébergeurs, présents sur
    // plusieurs domaines : ils n'identifient pas l'exploitant du site.
    const owners: string[] = [];
    for (const rawSiren of row.sirens_found) {
      const siren = normalizeSiren(rawSiren);
      if (!siren) continue;
      report.sirensSeen += 1;

      const { data: sharedCount } = await db.rpc('siren_domain_count', { p_siren: siren });
      if ((sharedCount ?? 0) > 2) {
        report.sharedSkipped += 1;
        continue;
      }
      owners.push(siren);
    }

    // Plusieurs SIREN restants : la page ne dit pas lequel exploite le site.
    // Constaté sur un opticien de réseau, dont les mentions légales portaient
    // à la fois le franchisé et le franchiseur — créer les deux leur attribuait
    // à tort le même téléphone local. Sans preuve, on n'attribue rien.
    if (owners.length !== 1) {
      if (owners.length > 1) report.ambiguousOwnership += 1;
      continue;
    }

    {
      const siren = owners[0]!;

      try {

        const { data: existing } = await db
          .from('companies')
          .select('id, domain')
          .eq('siren', siren)
          .limit(1);

        if (existing && existing.length > 0) {
          report.alreadyKnown += 1;
          continue;
        }

        const identity = await fetchRegistryIdentity(http, siren, options.signal);
        if (!identity) {
          report.notFoundInRegistry += 1;
          continue;
        }

        const phone = row.phones_found.map((p) => normalizePhone(p)).find((p) => p !== null) ?? null;
        const establishment = identity.siege ?? null;

        const { error: insertError } = await db.from('companies').insert({
          siren,
          siret: establishment?.siret ?? null,
          legal_name: (identity.nom_raison_sociale ?? identity.nom_complet ?? siren).slice(0, 300),
          commercial_name: establishment?.liste_enseignes?.[0]?.slice(0, 300) ?? null,
          domain: row.domain,
          website_url: `https://${row.domain}`,
          // Le SIREN figure dans les mentions légales : obligation légale
          // d'affichage, pas une inférence.
          website_confidence: 0.99,
          website_last_resolved_at: new Date().toISOString(),
          phone,
          contact_form_url: row.contact_form_url,
          postal_code: normalizePostalCode(establishment?.code_postal ?? null),
          city: establishment?.libelle_commune ?? null,
          lat: toCoordinate(establishment?.latitude),
          lon: toCoordinate(establishment?.longitude),
          industry_code: normalizeNafCode(
            establishment?.activite_principale ?? identity.activite_principale ?? null,
          ),
          creation_date: parseSireneDate(
            establishment?.date_creation ?? identity.date_creation ?? null,
          ),
          company_status: establishment?.etat_administratif === 'F' ? 'closed' : 'active',
          ...employeeRange(establishment?.tranche_effectif_salarie),
          // Identité solide : SIREN vérifié auprès du répertoire, site confirmé
          // par les mentions légales.
          identity_confidence: establishment?.siret ? 0.97 : 0.93,
          prospecting_allowed: establishment?.statut_diffusion_etablissement
            ? isProspectable(establishment.statut_diffusion_etablissement)
            : true,
          segment: 'other',
          last_seen_at: new Date().toISOString(),
        });

        if (insertError) {
          // 23505 : créée entre-temps par un autre chemin.
          if (insertError.code !== '23505') {
            report.errors += 1;
            log?.warn('Création depuis un domaine en échec', {
              domain: row.domain, siren, error: insertError.message,
            });
          }
          continue;
        }

        report.companiesCreated += 1;
        log?.debug('Entreprise créée depuis son site', {
          domain: row.domain, siren, has_phone: phone !== null,
        });
      } catch (fetchError: unknown) {
        report.errors += 1;
        log?.warn('Interrogation du répertoire en échec', {
          siren,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
      }
    }
  }

  log?.info('Découverte inverse terminée', {
    domains: report.domainsExamined,
    created: report.companiesCreated,
    already_known: report.alreadyKnown,
    shared_skipped: report.sharedSkipped,
    ambiguous: report.ambiguousOwnership,
  });

  return report;
}

async function fetchRegistryIdentity(
  http: RateLimitedHttpClient,
  siren: string,
  signal?: AbortSignal,
): Promise<RegistryResult | null> {
  const url = new URL(REGISTRY_ENDPOINT);
  url.searchParams.set('q', siren);
  url.searchParams.set('per_page', '1');

  const response = await http.fetchJson<{ results?: RegistryResult[] }>(
    url.toString(), {}, signal,
  );

  return response.results?.find((r) => normalizeSiren(r.siren) === siren) ?? null;
}

function toCoordinate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function employeeRange(code: string | null | undefined): {
  employee_min: number | null;
  employee_max: number | null;
} {
  const range = parseEmployeeRange(code);
  return { employee_min: range.min, employee_max: range.max };
}
