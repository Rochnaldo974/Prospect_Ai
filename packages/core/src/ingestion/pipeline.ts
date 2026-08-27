import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Company, Insert, Update } from '../domain/types';
import type { Logger } from '../logger';
import type { CompanySourceAdapter, NormalizedCompanyCandidate } from '../sources/types';

export interface IngestReport {
  read: number;
  created: number;
  merged: number;
  /** Lignes écartées avant même la résolution d'identité. */
  rejected: number;
  errors: number;
  rejectionReasons: Record<string, number>;
  /** Champs présents mais écartés à la normalisation, par motif. */
  fieldRejections: Record<string, number>;
  sample: { line: string; reason: string }[];
}

export interface IngestOptions {
  /** Taille des lots d'écriture. 500 est un bon compromis mémoire / latence. */
  batchSize?: number;
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  /** N'écrit rien : sert à mesurer ce qu'un fichier produirait. */
  dryRun?: boolean;
}

const emptyReport = (): IngestReport => ({
  read: 0,
  created: 0,
  merged: 0,
  rejected: 0,
  errors: 0,
  rejectionReasons: {},
  fieldRejections: {},
  sample: [],
});

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Champs à ne compléter que s'ils manquent.
 *
 * Une source ne doit jamais effacer une information plus fiable acquise
 * ailleurs : un import CSV sans téléphone ne doit pas supprimer le téléphone
 * trouvé par une source de POI.
 *
 * Écrit champ par champ plutôt que par construction dynamique : les types
 * générés depuis le schéma valident alors réellement ce qu'on écrit.
 */
function fillOnlyMissing(
  candidate: NormalizedCompanyCandidate,
  existing: Company,
): Update<'companies'> {
  const patch: Update<'companies'> = { last_seen_at: new Date().toISOString() };

  if (existing.siren === null && candidate.siren !== null) patch.siren = candidate.siren;
  if (existing.siret === null && candidate.siret !== null) patch.siret = candidate.siret;
  if (existing.commercial_name === null && candidate.commercialName !== null) {
    patch.commercial_name = candidate.commercialName;
  }
  if (existing.domain === null && candidate.domain !== null) {
    patch.domain = candidate.domain;
    patch.website_url = candidate.websiteUrl;
  }
  if (existing.phone === null && candidate.phone !== null) patch.phone = candidate.phone;
  if (existing.contact_form_url === null && candidate.contactFormUrl !== null) {
    patch.contact_form_url = candidate.contactFormUrl;
  }
  if (existing.address === null && candidate.address !== null) patch.address = candidate.address;
  if (existing.postal_code === null && candidate.postalCode !== null) {
    patch.postal_code = candidate.postalCode;
  }
  if (existing.city === null && candidate.city !== null) patch.city = candidate.city;
  if (existing.region === null && candidate.region !== null) patch.region = candidate.region;
  if (existing.lat === null && candidate.lat !== null) {
    patch.lat = candidate.lat;
    patch.lon = candidate.lon;
  }
  if (existing.industry_code === null && candidate.industryCode !== null) {
    patch.industry_code = candidate.industryCode;
  }
  if (existing.industry_label === null && candidate.industryLabel !== null) {
    patch.industry_label = candidate.industryLabel;
  }
  if (existing.employee_min === null && candidate.employeeMin !== null) {
    patch.employee_min = candidate.employeeMin;
    patch.employee_max = candidate.employeeMax;
  }
  if (existing.creation_date === null && candidate.creationDate !== null) {
    patch.creation_date = candidate.creationDate;
  }

  // Le statut administratif progresse vers une valeur connue, jamais l'inverse.
  if (candidate.companyStatus !== 'unknown' && existing.company_status === 'unknown') {
    patch.company_status = candidate.companyStatus;
  }

  // La confiance d'identité ne peut que monter : une source faible ne doit pas
  // dégrader une identité établie par un SIRET vérifié.
  if (candidate.identityConfidence > existing.identity_confidence) {
    patch.identity_confidence = candidate.identityConfidence;
  }

  // Une restriction de prospection est toujours retenue : le sens prudent veut
  // qu'une seule source qui l'interdit suffise.
  if (!candidate.prospectingAllowed && existing.prospecting_allowed) {
    patch.prospecting_allowed = false;
  }

  return patch;
}

function toInsertRow(candidate: NormalizedCompanyCandidate): Insert<'companies'> {
  return {
    siren: candidate.siren,
    siret: candidate.siret,
    legal_name: candidate.legalName,
    commercial_name: candidate.commercialName,
    domain: candidate.domain,
    website_url: candidate.websiteUrl,
    phone: candidate.phone,
    contact_form_url: candidate.contactFormUrl,
    address: candidate.address,
    postal_code: candidate.postalCode,
    city: candidate.city,
    region: candidate.region,
    lat: candidate.lat,
    lon: candidate.lon,
    industry_code: candidate.industryCode,
    industry_label: candidate.industryLabel,
    segment: candidate.segment,
    employee_min: candidate.employeeMin,
    employee_max: candidate.employeeMax,
    creation_date: candidate.creationDate,
    company_status: candidate.companyStatus,
    identity_confidence: candidate.identityConfidence,
    prospecting_allowed: candidate.prospectingAllowed,
    last_seen_at: new Date().toISOString(),
  };
}

/**
 * Fusionne les doublons internes au lot.
 *
 * Un même établissement peut apparaître deux fois dans un fichier, ou une
 * découverte peut renvoyer deux POI portant le même SIRET. Sans cette passe,
 * l'insertion groupée échoue sur la contrainte d'unicité et tout le lot
 * bascule en traitement unitaire — une seule ligne en double suffirait à
 * annuler le gain de performance.
 *
 * Le premier candidat l'emporte ; les suivants ne servent qu'à combler ses
 * champs manquants, ce qui est la même règle qu'entre deux sources.
 */
function collapseDuplicates(
  candidates: NormalizedCompanyCandidate[],
): { kept: NormalizedCompanyCandidate[]; collapsed: number } {
  const byKey = new Map<string, NormalizedCompanyCandidate>();
  const kept: NormalizedCompanyCandidate[] = [];
  let collapsed = 0;

  for (const candidate of candidates) {
    // Seules les clés déterministes déduplinquent : deux entreprises peuvent
    // légitimement partager un domaine, jamais un SIRET.
    const key = candidate.siret
      ? `siret:${candidate.siret}`
      : candidate.siren && !candidate.siret
        ? `siren:${candidate.siren}`
        : null;

    if (!key) {
      kept.push(candidate);
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      kept.push(candidate);
      continue;
    }

    // Complète le premier avec ce que le second apporte en plus.
    existing.phone ??= candidate.phone;
    existing.domain ??= candidate.domain;
    existing.websiteUrl ??= candidate.websiteUrl;
    existing.contactFormUrl ??= candidate.contactFormUrl;
    existing.address ??= candidate.address;
    existing.postalCode ??= candidate.postalCode;
    existing.city ??= candidate.city;
    existing.lat ??= candidate.lat;
    existing.lon ??= candidate.lon;
    existing.industryCode ??= candidate.industryCode;
    existing.industryLabel ??= candidate.industryLabel;
    existing.commercialName ??= candidate.commercialName;
    existing.creationDate ??= candidate.creationDate;
    collapsed += 1;
  }

  return { kept, collapsed };
}

/**
 * Résout l'identité de tout un lot en un seul appel.
 *
 * La version ligne par ligne faisait trois à quatre allers-retours par
 * entreprise. Mesuré en local avec 3,5 ms de latence : 1,5 ms par ligne en
 * unitaire contre 0,02 ms en lot, soit un facteur 96 — et l'écart se creuse
 * sur une base distante, où chaque aller-retour coûte 30 à 50 ms.
 *
 * Passe par une fonction SQL appelée en POST plutôt que par `in(...)` : avec
 * 500 identifiants, l'URL d'une requête GET dépasse la limite de la
 * passerelle, qui répond « URI too long » et fait échouer le lot entier.
 */
async function resolveBatch(
  db: Db,
  candidates: NormalizedCompanyCandidate[],
): Promise<Map<number, { id: string; key: string; existing: Company }>> {
  const resolved = new Map<number, { id: string; key: string; existing: Company }>();

  const sirets = [...new Set(candidates.map((c) => c.siret).filter((v): v is string => !!v))];
  const sirens = [...new Set(
    candidates.filter((c) => !c.siret).map((c) => c.siren).filter((v): v is string => !!v),
  )];
  const domains = [...new Set(
    candidates.filter((c) => !c.siret && !c.siren).map((c) => c.domain).filter((v): v is string => !!v),
  )];

  if (sirets.length === 0 && sirens.length === 0 && domains.length === 0) return resolved;

  const { data, error } = await db.rpc('resolve_company_identities', {
    p_sirets: sirets,
    p_sirens: sirens,
    p_domains: domains,
  });

  if (error) throw new Error(`resolveBatch : ${error.message}`);

  const siretIndex = new Map<string, Company>();
  const sirenIndex = new Map<string, Company>();
  const domainMatches = new Map<string, Company[]>();

  for (const row of data ?? []) {
    const company = row.company as Company;
    if (row.match_key === 'siret' && company.siret) siretIndex.set(company.siret, company);
    if (row.match_key === 'siren' && company.siren) sirenIndex.set(company.siren, company);
    if (row.match_key === 'domain' && company.domain) {
      const list = domainMatches.get(company.domain) ?? [];
      list.push(company);
      domainMatches.set(company.domain, list);
    }
  }

  candidates.forEach((candidate, index) => {
    if (candidate.siret) {
      const found = siretIndex.get(candidate.siret);
      // Pas de repli sur le SIREN : un SIRET différent est un autre établissement.
      if (found) resolved.set(index, { id: found.id, key: 'siret', existing: found });
      return;
    }

    if (candidate.siren) {
      const found = sirenIndex.get(candidate.siren);
      if (found) resolved.set(index, { id: found.id, key: 'siren', existing: found });
      return;
    }

    if (candidate.domain) {
      // Le domaine n'est retenu que s'il désigne une seule entreprise : les
      // enseignes de réseau partagent le site de la marque, rapprocher au
      // hasard fusionnerait deux magasins sans lien.
      const matches = domainMatches.get(candidate.domain);
      if (matches?.length === 1 && matches[0]) {
        resolved.set(index, { id: matches[0].id, key: 'domain', existing: matches[0] });
      }
    }
  });

  return resolved;
}

/**
 * Ingère un flux de candidats.
 *
 * Traitement par lots : une erreur sur un lot ne fait perdre que ce lot, et le
 * nombre d'allers-retours passe de trois par ligne à environ cinq par lot.
 */
export async function ingestFromSource(
  db: Db,
  adapter: CompanySourceAdapter,
  options: IngestOptions = {},
): Promise<IngestReport> {
  const report = emptyReport();
  const log = options.logger;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const batchSize = options.batchSize ?? 500;

  const discoverParams = {
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  let batch: NormalizedCompanyCandidate[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const { kept: current, collapsed } = collapseDuplicates(batch);
    batch = [];

    if (collapsed > 0) {
      report.merged += collapsed;
      bump(report.rejectionReasons, 'doublon interne au lot');
    }

    if (options.dryRun) {
      report.created += current.length;
      return;
    }

    try {
      const resolved = await resolveBatch(db, current);

      const toInsert: { candidate: NormalizedCompanyCandidate; row: Insert<'companies'> }[] = [];
      const toUpdate: { id: string; candidate: NormalizedCompanyCandidate; patch: Update<'companies'> }[] = [];

      current.forEach((candidate, index) => {
        const match = resolved.get(index);
        if (match) {
          toUpdate.push({
            id: match.id,
            candidate,
            patch: fillOnlyMissing(candidate, match.existing),
          });
          bump(report.rejectionReasons, `fusion sur ${match.key}`);
        } else {
          toInsert.push({ candidate, row: toInsertRow(candidate) });
        }
      });

      const written: { companyId: string; candidate: NormalizedCompanyCandidate }[] = [];

      if (toInsert.length > 0) {
        const { data, error } = await db
          .from('companies')
          .insert(toInsert.map((entry) => entry.row))
          .select('id');

        if (error) {
          // Un lot rejeté en bloc est repris ligne par ligne : une seule
          // entreprise fautive ne doit pas faire perdre les 499 autres.
          await insertOneByOne(db, toInsert, report, written, log);
        } else {
          (data ?? []).forEach((row, i) => {
            const entry = toInsert[i];
            if (entry) written.push({ companyId: row.id, candidate: entry.candidate });
          });
          report.created += data?.length ?? 0;
        }
      }

      // Les patches diffèrent ligne à ligne, mais une fonction SQL alimentée
      // par un tableau JSON les applique en une seule instruction. Sur un
      // rafraîchissement de stock, où presque tout est une fusion, c'est le
      // chemin dominant.
      if (toUpdate.length > 0) {
        const { data: applied, error } = await db.rpc('apply_company_patches', {
          patches: toUpdate.map((entry) => ({ id: entry.id, ...entry.patch })) as unknown as Json,
        });

        if (error) {
          report.errors += toUpdate.length;
          recordSample(report, `lot de ${toUpdate.length} fusions`, error.message);
        } else {
          report.merged += applied ?? toUpdate.length;
          for (const entry of toUpdate) {
            written.push({ companyId: entry.id, candidate: entry.candidate });
          }
        }
      }

      await recordSourcesBatch(db, written);
    } catch (error: unknown) {
      report.errors += current.length;
      const message = error instanceof Error ? error.message : String(error);
      recordSample(report, `lot de ${current.length} lignes`, message);
      log?.error('Lot en erreur', { size: current.length, error: message });
    }
  };

  for await (const raw of adapter.discover(discoverParams)) {
    if (options.signal?.aborted) break;
    if (report.read >= limit) break;

    report.read += 1;

    let candidate: NormalizedCompanyCandidate | null;
    try {
      candidate = adapter.normalize(raw);
    } catch (error: unknown) {
      report.errors += 1;
      recordSample(report, raw.sourceExternalId, error instanceof Error ? error.message : String(error));
      continue;
    }

    if (!candidate) {
      report.rejected += 1;
      bump(report.rejectionReasons, 'ligne inexploitable (nom ou activité)');
      continue;
    }

    for (const rejection of candidate.rejections) {
      bump(report.fieldRejections, `${rejection.field} : ${rejection.reason}`);
    }

    batch.push(candidate);
    if (batch.length >= batchSize) await flush();
  }

  await flush();

  log?.info('Ingestion terminée', {
    source: adapter.sourceName,
    read: report.read,
    created: report.created,
    merged: report.merged,
    rejected: report.rejected,
    errors: report.errors,
  });

  return report;
}

function recordSample(report: IngestReport, line: string, reason: string): void {
  if (report.sample.length < 20) report.sample.push({ line, reason });
}

/** Reprise ligne par ligne après le rejet d'un lot. */
async function insertOneByOne(
  db: Db,
  entries: { candidate: NormalizedCompanyCandidate; row: Insert<'companies'> }[],
  report: IngestReport,
  written: { companyId: string; candidate: NormalizedCompanyCandidate }[],
  log?: Logger,
): Promise<void> {
  for (const entry of entries) {
    const { data, error } = await db
      .from('companies')
      .insert(entry.row)
      .select('id')
      .single();

    if (error) {
      report.errors += 1;
      recordSample(report, entry.candidate.raw.sourceExternalId, error.message);
      log?.warn('Ligne en erreur', {
        external_id: entry.candidate.raw.sourceExternalId,
        error: error.message,
      });
      continue;
    }

    written.push({ companyId: data.id, candidate: entry.candidate });
    report.created += 1;
  }
}

/**
 * Conserve la trace d'origine et la provenance des champs apportés.
 *
 * Deux upserts pour tout un lot, au lieu de deux par entreprise.
 */
async function recordSourcesBatch(
  db: Db,
  written: { companyId: string; candidate: NormalizedCompanyCandidate }[],
): Promise<void> {
  if (written.length === 0) return;
  const now = new Date().toISOString();

  const sources = written.map(({ companyId, candidate }) => ({
    company_id: companyId,
    source_name: candidate.raw.sourceName,
    source_external_id: candidate.raw.sourceExternalId,
    raw_payload: candidate.raw.payload as Json,
    confidence: candidate.raw.confidence,
    last_seen_at: now,
  }));

  await db.from('company_sources').upsert(sources, {
    onConflict: 'source_name,source_external_id',
  });

  const provenance = written.flatMap(({ companyId, candidate }) =>
    (
      [
        ['siren', candidate.siren],
        ['siret', candidate.siret],
        ['domain', candidate.domain],
        ['phone', candidate.phone],
        ['postal_code', candidate.postalCode],
        ['industry_code', candidate.industryCode],
      ] as const
    )
      .filter(([, value]) => value !== null)
      .map(([field, value]) => ({
        company_id: companyId,
        field,
        value,
        source_name: candidate.raw.sourceName,
        confidence: candidate.raw.confidence,
        observed_at: now,
      })),
  );

  if (provenance.length > 0) {
    await db.from('company_field_provenance').upsert(provenance, {
      onConflict: 'company_id,field,source_name',
    });
  }
}
