import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { fetchAssociationNotices, type AssociationNotice } from '../sources/joafe/adapter';

/**
 * Les associations du Journal officiel, comme entreprises d'un autre type.
 *
 * Même chaîne que tout le reste : une fiche identifiée (le RNA), un
 * événement daté (création ou modification), un domaine si l'annonce en
 * porte un — le déclencheur d'entreprise enregistre le domaine et le scan
 * suivra. Sans site, l'association est exactement le cas « pas de site »
 * de la règle de création. Une association qui existe déjà n'est pas
 * recréée : le RNA la retrouve.
 */

export interface AssociationIngestionReport {
  fetched: number;
  companiesCreated: number;
  companiesKnown: number;
  eventsCreated: number;
  eventsSkipped: number;
  errors: number;
}

export interface AssociationIngestOptions {
  limit?: number;
  since?: string;
  logger?: Logger;
  signal?: AbortSignal;
  /** Injectable : les tests ne sollicitent pas l'API. */
  fetch?: (options: { limit?: number; since?: string; signal?: AbortSignal }) => Promise<AssociationNotice[]>;
}

export async function ingestAssociations(db: Db, options: AssociationIngestOptions = {}): Promise<AssociationIngestionReport> {
  const report: AssociationIngestionReport = { fetched: 0, companiesCreated: 0, companiesKnown: 0, eventsCreated: 0, eventsSkipped: 0, errors: 0 };
  const log = options.logger;
  const fetch = options.fetch ?? fetchAssociationNotices;
  const notices = await fetch({ ...(options.limit !== undefined ? { limit: options.limit } : {}), ...(options.since ? { since: options.since } : {}), ...(options.signal ? { signal: options.signal } : {}) });
  report.fetched = notices.length;

  for (const notice of notices) {
    if (options.signal?.aborted) break;
    try {
      const companyId = await upsertAssociation(db, notice, report);
      if (!companyId) continue;
      const { error } = await db.from('company_events').insert({
        company_id: companyId,
        event_type: notice.kind === 'creation' ? 'association_created' : 'association_modified',
        payload: {
          rna: notice.rna, title: notice.name, purpose: notice.purpose, activity: notice.activityLabel,
          website: notice.websiteUrl, declared_at: notice.declaredAt, notice_id: notice.id,
        } as Json,
        importance: notice.kind === 'creation' ? 70 : 45,
        confidence: 0.95,
        source: 'joafe',
        occurred_at: `${notice.publishedAt}T00:00:00Z`,
        dedupe_key: `joafe:${notice.id}`,
      });
      if (!error) report.eventsCreated += 1;
      else if (error.code === '23505') report.eventsSkipped += 1;
      else throw new Error(error.message);
    } catch (cause: unknown) {
      report.errors += 1;
      log?.warn('Annonce JOAFE non intégrée', { notice: notice.id, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  log?.info('Associations intégrées', { ...report });
  return report;
}

async function upsertAssociation(db: Db, notice: AssociationNotice, report: AssociationIngestionReport): Promise<string | null> {
  const { data: known } = await db
    .from('company_sources')
    .select('company_id')
    .eq('source_name', 'joafe')
    .eq('source_external_id', notice.rna)
    .limit(1)
    .maybeSingle();

  if (known) {
    report.companiesKnown += 1;
    // Une modification peut apporter un site ou une adresse qui manquaient.
    await db.from('companies').update({
      ...(notice.domain ? { domain: notice.domain, website_url: notice.websiteUrl } : {}),
      ...(notice.address ? { address: notice.address } : {}),
      ...(notice.postalCode ? { postal_code: notice.postalCode } : {}),
      ...(notice.city ? { city: notice.city } : {}),
    }).eq('id', known.company_id).is('domain', null);
    await db.from('company_sources').update({ last_seen_at: new Date().toISOString() })
      .eq('source_name', 'joafe').eq('source_external_id', notice.rna);
    return known.company_id;
  }

  const { data: created, error } = await db
    .from('companies')
    .insert({
      legal_name: notice.name,
      commercial_name: null,
      organization_type: 'association',
      address: notice.address,
      postal_code: notice.postalCode,
      city: notice.city,
      domain: notice.domain,
      website_url: notice.websiteUrl,
      industry_label: notice.activityLabel,
      segment: 'other',
      // Le RNA identifie sans ambiguïté, mais ce n'est pas un SIREN : la
      // confiance reste sous celle d'une immatriculation.
      identity_confidence: 0.75,
      prospecting_allowed: true,
      creation_date: notice.kind === 'creation' ? (notice.declaredAt ?? notice.publishedAt) : null,
    })
    .select('id')
    .maybeSingle();
  if (error || !created) throw new Error(error?.message ?? 'création impossible');

  await db.from('company_sources').insert({
    company_id: created.id, source_name: 'joafe', source_external_id: notice.rna, confidence: 0.95,
    raw_payload: { notice_id: notice.id, kind: notice.kind, activity: notice.activityLabel } as Json,
  });
  report.companiesCreated += 1;
  return created.id;
}
