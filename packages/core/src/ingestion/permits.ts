import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { fetchRecentPermits, type BuildingPermit } from '../sources/sitadel/adapter';

/**
 * Les permis créant des locaux, rattachés par SIRET.
 *
 * Un permis n'est jamais un lead seul : il devient un événement daté
 * (« l'entreprise ouvre un local ») sur l'entreprise que l'on connaît
 * déjà. Une entreprise inconnue n'est pas créée à partir d'un permis — on
 * n'a ni téléphone ni site, seulement un chantier.
 */

export interface PermitIngestionReport {
  fetched: number;
  stored: number;
  matched: number;
  eventsCreated: number;
  eventsSkipped: number;
  errors: number;
}

export interface PermitIngestOptions {
  limit?: number;
  since?: string;
  logger?: Logger;
  signal?: AbortSignal;
  /** Injectable : les tests ne sollicitent pas l'API. */
  fetch?: (options: { limit?: number; since?: string; signal?: AbortSignal }) => Promise<BuildingPermit[]>;
}

const EVENT_IMPORTANCE: Record<string, number> = { commercial: 60, hotel: 60, office: 50, industrial: 40, warehouse: 35, public: 30, other: 30 };

export async function ingestPermits(db: Db, options: PermitIngestOptions = {}): Promise<PermitIngestionReport> {
  const report: PermitIngestionReport = { fetched: 0, stored: 0, matched: 0, eventsCreated: 0, eventsSkipped: 0, errors: 0 };
  const log = options.logger;
  const fetch = options.fetch ?? fetchRecentPermits;
  const permits = await fetch({ ...(options.limit !== undefined ? { limit: options.limit } : {}), ...(options.since ? { since: options.since } : {}), ...(options.signal ? { signal: options.signal } : {}) });
  report.fetched = permits.length;

  for (const permit of permits) {
    if (options.signal?.aborted) break;
    try {
      // L'entreprise : par SIRET, sinon par SIREN quand il n'y a qu'un établissement connu.
      let companyId: string | null = null;
      if (permit.applicantSiret) {
        const { data } = await db.from('companies').select('id').eq('siret', permit.applicantSiret).limit(1).maybeSingle();
        companyId = data?.id ?? null;
      }
      if (!companyId && permit.applicantSiren) {
        const { data } = await db.from('companies').select('id').eq('siren', permit.applicantSiren).limit(2);
        if (data && data.length === 1) companyId = data[0]!.id;
      }

      const { error: storeError } = await db.from('building_permits').upsert({
        permit_id: permit.permitId, commune_code: permit.communeCode, permit_type: permit.permitType,
        applicant_siren: permit.applicantSiren, applicant_siret: permit.applicantSiret, applicant_name: permit.applicantName, applicant_naf: permit.applicantNaf,
        site_address: permit.siteAddress, site_postal_code: permit.sitePostalCode, site_city: permit.siteCity,
        destination: permit.destination, surfaces: permit.surfaces as Json, premises_kind: permit.premisesKind,
        authorized_at: permit.authorizedAt, deposited_at: permit.depositedAt, company_id: companyId,
      }, { onConflict: 'permit_id' });
      if (storeError) throw new Error(storeError.message);
      report.stored += 1;
      if (!companyId) continue;
      report.matched += 1;

      const { error } = await db.from('company_events').insert({
        company_id: companyId,
        event_type: 'new_business_premises',
        payload: {
          permit_id: permit.permitId, premises_kind: permit.premisesKind, surfaces: permit.surfaces,
          site_address: permit.siteAddress, site_postal_code: permit.sitePostalCode, site_city: permit.siteCity,
        } as Json,
        importance: EVENT_IMPORTANCE[permit.premisesKind] ?? 30,
        confidence: 0.95,
        source: 'sitadel',
        occurred_at: `${permit.authorizedAt}T00:00:00Z`,
        dedupe_key: `permit:${permit.permitId}:${companyId}`,
      });
      if (!error) report.eventsCreated += 1;
      else if (error.code === '23505') report.eventsSkipped += 1;
      else throw new Error(error.message);
    } catch (cause: unknown) {
      report.errors += 1;
      log?.warn('Permis non intégré', { permit: permit.permitId, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  log?.info('Permis de construire intégrés', { ...report });
  return report;
}
