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
 * Résolution d'identité sur clés exactes.
 *
 * Phase 4 : SIRET, SIREN et domaine, qui sont déterministes. Le rapprochement
 * approché (téléphone, adresse, similarité de nom) arrive en phase 5 — le
 * mélanger ici reviendrait à fusionner des entreprises sur des indices faibles
 * avant d'avoir la machinerie pour arbitrer les cas ambigus.
 *
 * Point délicat : le SIREN identifie l'UNITÉ LÉGALE, le SIRET l'ÉTABLISSEMENT.
 * Une chaîne de boulangeries a un seul SIREN et autant de SIRET que de points
 * de vente. Un candidat qui porte un SIRET ne doit donc jamais retomber sur le
 * SIREN en cas d'absence de correspondance : ce serait fusionner un magasin de
 * Bordeaux avec le siège parisien. On prospecte des établissements, pas des
 * unités légales.
 */
async function findExistingCompany(
  db: Db,
  candidate: NormalizedCompanyCandidate,
): Promise<{ id: string; key: string } | null> {
  if (candidate.siret) {
    const { data } = await db.from('companies').select('id').eq('siret', candidate.siret).maybeSingle();
    if (data) return { id: data.id, key: 'siret' };

    // Pas de repli sur le SIREN : un SIRET différent est un autre établissement.
    // On tente néanmoins le domaine, qui reste propre à un site donné.
    if (candidate.domain) {
      const { data: byDomain } = await db
        .from('companies')
        .select('id, siret')
        .eq('domain', candidate.domain)
        .maybeSingle();
      // …sauf si ce domaine appartient déjà à un autre établissement identifié.
      if (byDomain && byDomain.siret === null) return { id: byDomain.id, key: 'domain' };
    }

    return null;
  }

  if (candidate.siren) {
    // Sans SIRET, on rapproche au niveau de l'unité légale — mais uniquement
    // d'une entreprise elle-même sans SIRET, pour ne pas absorber un
    // établissement précis dans une fiche générique.
    // `limit(1)` et non `maybeSingle` : le SIREN n'étant pas unique, plusieurs
    // fiches sans SIRET pourraient le partager.
    const { data } = await db
      .from('companies')
      .select('id')
      .eq('siren', candidate.siren)
      .is('siret', null)
      .order('created_at', { ascending: true })
      .limit(1);
    if (data && data[0]) return { id: data[0].id, key: 'siren' };
  }

  if (candidate.domain) {
    const { data } = await db.from('companies').select('id').eq('domain', candidate.domain).maybeSingle();
    if (data) return { id: data.id, key: 'domain' };
  }

  return null;
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
 * Ingère un flux de candidats.
 *
 * Traite ligne par ligne plutôt qu'en lot unique : une erreur sur une ligne ne
 * doit jamais faire perdre les 2 999 autres d'un fichier de 3 000.
 */
export async function ingestFromSource(
  db: Db,
  adapter: CompanySourceAdapter,
  options: IngestOptions = {},
): Promise<IngestReport> {
  const report = emptyReport();
  const log = options.logger;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  const discoverParams = {
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
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
      if (report.sample.length < 20) {
        report.sample.push({
          line: raw.sourceExternalId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
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

    if (options.dryRun) {
      report.created += 1;
      continue;
    }

    try {
      const existing = await findExistingCompany(db, candidate);

      if (existing) {
        const { data: current } = await db
          .from('companies')
          .select('*')
          .eq('id', existing.id)
          .single();

        if (current) {
          await db.from('companies').update(fillOnlyMissing(candidate, current)).eq('id', existing.id);
        }

        await recordSource(db, existing.id, candidate);
        report.merged += 1;
        bump(report.rejectionReasons, `fusion sur ${existing.key}`);
      } else {
        const { data: inserted, error } = await db
          .from('companies')
          .insert(toInsertRow(candidate))
          .select('id')
          .single();

        if (error) throw new Error(error.message);

        await recordSource(db, inserted.id, candidate);
        report.created += 1;
      }
    } catch (error: unknown) {
      report.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (report.sample.length < 20) {
        report.sample.push({ line: raw.sourceExternalId, reason: message });
      }
      log?.warn('Ligne en erreur', { external_id: raw.sourceExternalId, error: message });
    }
  }

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

/** Conserve la trace d'origine et la provenance des champs apportés. */
async function recordSource(
  db: Db,
  companyId: string,
  candidate: NormalizedCompanyCandidate,
): Promise<void> {
  const now = new Date().toISOString();

  await db.from('company_sources').upsert(
    {
      company_id: companyId,
      source_name: candidate.raw.sourceName,
      source_external_id: candidate.raw.sourceExternalId,
      raw_payload: candidate.raw.payload as Json,
      confidence: candidate.raw.confidence,
      last_seen_at: now,
    },
    { onConflict: 'source_name,source_external_id' },
  );

  const provenance = (
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
    }));

  if (provenance.length > 0) {
    await db.from('company_field_provenance').upsert(provenance, {
      onConflict: 'company_id,field,source_name',
    });
  }
}
