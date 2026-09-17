import type { Db } from '../../db/client';
import { httpClientFor } from '../http/policy';
import type { Update } from '../../domain/types';
import type { Logger } from '../../logger';
import { companyNameKey, normalizePostalCode, normalizeSiren } from '../../normalization';
import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../http/client';
import { runPool } from '../http/pool';
import {
  buildRegistryPatch, REGISTRY_SEARCH_ENDPOINT,
  type ApiEtablissement, type ApiResponse, type ApiResult,
} from './enricher';

/**
 * Rapprochement d'identité par le nom.
 *
 * Les deux tiers des commerces découverts sur OpenStreetMap n'ont pas de
 * SIREN, et sans SIREN la porte de qualité les refuse : une identité à 0,6
 * n'atteint pas le seuil, et un « site en panne » constaté sur une entreprise
 * qu'on ne sait pas nommer légalement ne se livre pas. Ce sont pourtant les
 * mieux joignables du stock — le téléphone vient du terrain.
 *
 * Le répertoire officiel répond par nom et code postal. Le rapprochement est
 * volontairement strict : la clé de nom doit être identique, l'établissement
 * doit porter le même code postal, et il ne doit exister qu'un seul SIREN
 * candidat. Un doute n'est pas une réponse — on préfère ne pas rattacher que
 * livrer une fiche sous un mauvais nom.
 *
 * Chaque tentative est datée sur l'entreprise, pour ne pas reposer la même
 * question chaque nuit ; un introuvable n'est réexaminé qu'après un mois, le
 * temps qu'une source apporte un élément neuf.
 */

/** Confiance accordée à un rapprochement nom + code postal sans ambiguïté. */
export const NAME_MATCH_CONFIDENCE = 0.8;

const RETRY_AFTER_DAYS = 30;

export interface NameMatchTarget {
  legal_name: string;
  commercial_name: string | null;
  postal_code: string | null;
}

export interface RegistryMatch {
  siren: string;
  result: ApiResult;
  establishment: ApiEtablissement | null;
}

function nameKeysOf(company: NameMatchTarget): Set<string> {
  const keys = new Set<string>();
  for (const name of [company.legal_name, company.commercial_name]) {
    const key = companyNameKey(name);
    if (key) keys.add(key);
  }
  return keys;
}

function establishmentNames(establishment: ApiEtablissement | null | undefined): string[] {
  if (!establishment) return [];
  return [establishment.nom_commercial ?? null, ...(establishment.liste_enseignes ?? [])]
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

function matchesAnyName(names: (string | null | undefined)[], keys: Set<string>): boolean {
  return names.some((name) => {
    const key = companyNameKey(name);
    return key !== null && keys.has(key);
  });
}

/**
 * Choisit le SIREN qui correspond, ou rien.
 *
 * Fonction pure, pour être testée sans réseau : les résultats sont ceux de
 * l'API, l'entreprise est celle de la base.
 */
export function pickRegistryMatch(
  company: NameMatchTarget,
  results: ApiResult[],
): RegistryMatch | null {
  const keys = nameKeysOf(company);
  if (keys.size === 0) return null;
  const postal = normalizePostalCode(company.postal_code);

  const matches = new Map<string, RegistryMatch>();

  for (const result of results) {
    const siren = normalizeSiren(result.siren);
    if (!siren) continue;

    const establishments = [
      ...(result.matching_etablissements ?? []),
      ...(result.siege ? [result.siege] : []),
    ];

    // L'établissement retenu est celui du bon code postal ; sans code postal
    // connu, on ne sait pas lequel, et on ne rattache que l'unité légale.
    const located = postal
      ? establishments.filter((e) => normalizePostalCode(e.code_postal) === postal)
      : [];
    if (postal && located.length === 0) continue;

    const unitNames = [result.nom_complet, result.nom_raison_sociale];
    const namedEstablishment = located.find((e) => matchesAnyName(establishmentNames(e), keys))
      ?? null;
    const nameMatches = namedEstablishment !== null
      || matchesAnyName(unitNames, keys)
      || (!postal && establishments.some((e) => matchesAnyName(establishmentNames(e), keys)));

    if (!nameMatches) continue;

    if (!matches.has(siren)) {
      matches.set(siren, {
        siren,
        result,
        establishment: namedEstablishment ?? located[0] ?? null,
      });
    }
  }

  // Deux SIREN plausibles, c'est zéro certitude.
  if (matches.size !== 1) return null;
  return matches.values().next().value ?? null;
}

export interface IdentityReport {
  examined: number;
  matched: number;
  /** Rapprochés à une entreprise déjà connue sous ce SIRET : à fusionner. */
  duplicates: number;
  ambiguous: number;
  notFound: number;
  errors: number;
}

export interface IdentityOptions {
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  requestsPerSecond?: number;
  /**
   * Requêtes en vol simultanément. Le débit reste borné par le limiteur ;
   * la concurrence ne sert qu'à ne pas payer la latence du service une
   * requête après l'autre.
   */
  concurrency?: number;
}

export async function resolveIdentityByName(
  db: Db,
  options: IdentityOptions = {},
): Promise<IdentityReport> {
  const report: IdentityReport = { examined: 0, matched: 0, duplicates: 0, ambiguous: 0, notFound: 0, errors: 0 };
  const log = options.logger;
  const http = options.requestsPerSecond !== undefined ? new RateLimitedHttpClient({
    requestsPerSecond: options.requestsPerSecond ?? 5,
    userAgent: DEFAULT_USER_AGENT,
    timeoutMs: 20_000,
    maxRetries: 2,
  }) : httpClientFor('sirene_api');

  const retryBefore = new Date(Date.now() - RETRY_AFTER_DAYS * 86_400_000).toISOString();

  const { data: targets, error } = await db
    .from('companies')
    .select('id, legal_name, commercial_name, postal_code, identity_confidence, creation_date, employee_min, industry_code, lat, city, siret, identity_lookup_at')
    .is('siren', null)
    .not('postal_code', 'is', null)
    .or(`identity_lookup_at.is.null,identity_lookup_at.lt.${retryBefore}`)
    .order('identity_lookup_at', { ascending: true, nullsFirst: true })
    .limit(options.limit ?? 300);

  if (error) throw new Error(`resolveIdentityByName : ${error.message}`);

  await runPool(targets ?? [], options.concurrency ?? 4, async (company) => {
    if (options.signal?.aborted) return;
    report.examined += 1;
    const now = new Date().toISOString();

    try {
      const url = new URL(REGISTRY_SEARCH_ENDPOINT);
      url.searchParams.set('q', company.legal_name);
      url.searchParams.set('code_postal', company.postal_code!);
      url.searchParams.set('per_page', '5');
      url.searchParams.set('limite_matching_etablissements', '10');

      const response = await http.fetchJson<ApiResponse>(url.toString(), {}, options.signal);
      const results = response.results ?? [];
      const match = pickRegistryMatch(company, results);

      if (!match) {
        if (results.length > 1) report.ambiguous += 1; else report.notFound += 1;
        await db.from('companies').update({ identity_lookup_at: now }).eq('id', company.id);
        return;
      }

      const registryName = match.result.nom_raison_sociale ?? match.result.nom_complet ?? null;
      const patch: Update<'companies'> = {
        ...buildRegistryPatch(
          { ...company, commercial_name: company.commercial_name },
          match.result,
          match.establishment,
        ),
        siren: match.siren,
        ...(match.establishment?.siret ? { siret: match.establishment.siret } : {}),
        identity_confidence: Math.max(Number(company.identity_confidence), NAME_MATCH_CONFIDENCE),
        identity_lookup_at: now,
      };

      // Le nom du terrain devient l'enseigne, la raison sociale prend sa
      // place : c'est elle qui figure sur les devis et les mentions légales.
      if (registryName && companyNameKey(registryName) !== companyNameKey(company.legal_name)) {
        patch.legal_name = registryName.slice(0, 300);
        if (company.commercial_name === null) patch.commercial_name = company.legal_name.slice(0, 300);
      }

      let { error: updateError } = await db.from('companies').update(patch).eq('id', company.id);

      // Le SIRET est déjà porté par une autre fiche : l'entreprise est connue
      // par une autre source, et c'est un doublon à fusionner, pas une erreur.
      // On pose le SIREN seul — non unique par construction — et la
      // déduplication nocturne, qui rapproche les SIREN identiques, fera la
      // fusion. Sans cela, la fiche restait sans date de tentative et
      // revenait en tête de file à chaque passage.
      if (updateError?.code === '23505') {
        delete patch.siret;
        ({ error: updateError } = await db.from('companies').update(patch).eq('id', company.id));
        if (!updateError) report.duplicates += 1;
      }

      if (updateError) {
        report.errors += 1;
        await db.from('companies').update({ identity_lookup_at: now }).eq('id', company.id);
        log?.warn('Rapprochement non enregistré', { company_id: company.id, error: updateError.message });
        return;
      }

      report.matched += 1;
      log?.debug?.('Identité rapprochée par le nom', {
        company_id: company.id, siren: match.siren, name: company.legal_name,
      });
    } catch (fetchError: unknown) {
      report.errors += 1;
      log?.warn('Interrogation du répertoire par nom en échec', {
        company_id: company.id,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
    }
  });

  log?.info('Rapprochement d’identité par le nom terminé', {
    examined: report.examined, matched: report.matched, duplicates: report.duplicates,
    ambiguous: report.ambiguous, not_found: report.notFound, errors: report.errors,
  });

  return report;
}
