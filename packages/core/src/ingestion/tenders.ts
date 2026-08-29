import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { fetchWebTenders, type Tender } from '../sources/boamp/adapter';

/**
 * Intégration des appels d'offres.
 *
 * L'acheteur devient une entreprise comme une autre — il en est une, avec un
 * SIRET — et l'avis devient un événement daté. La suite de la chaîne ne change
 * pas : événement → signal → opportunité. Rien de spécifique n'est ajouté au
 * moteur, seulement une source de plus.
 *
 * Le contact est l'adresse publique de l'avis, jamais la personne nommée qui y
 * figure : on répond à un marché sur la plateforme, et la V1 ne collecte
 * aucune donnée nominative.
 */

export interface TenderIngestionReport {
  fetched: number;
  /** Écartés faute de SIRET : sans identité certaine, on ne crée rien. */
  withoutIdentity: number;
  companiesCreated: number;
  companiesKnown: number;
  eventsCreated: number;
  eventsSkipped: number;
  errors: number;
}

export async function ingestTenders(
  db: Db,
  options: { limit?: number; logger?: Logger; signal?: AbortSignal } = {},
): Promise<TenderIngestionReport> {
  const report: TenderIngestionReport = {
    fetched: 0, withoutIdentity: 0, companiesCreated: 0, companiesKnown: 0,
    eventsCreated: 0, eventsSkipped: 0, errors: 0,
  };

  const tenders = await fetchWebTenders({
    openOnly: true,
    limit: options.limit ?? 100,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  report.fetched = tenders.length;

  for (const tender of tenders) {
    if (options.signal?.aborted) break;

    // Même discipline que partout ailleurs : sans identifiant certain, on
    // n'invente pas une entreprise à partir d'un nom.
    if (tender.siret === null) {
      report.withoutIdentity += 1;
      continue;
    }

    try {
      const companyId = await upsertBuyer(db, tender, report);
      if (companyId === null) continue;

      const { error } = await db.from('company_events').insert({
        company_id: companyId,
        event_type: 'tender_published',
        payload: {
          tender_id: tender.id,
          objet: tender.subject,
          cpv: tender.cpv,
          cpv_label: tender.cpvLabel,
          deadline: tender.deadline,
          procedure: tender.procedure,
          notice_url: tender.noticeUrl,
          platform_url: tender.platformUrl,
        } as Json,
        // Le besoin est déclaré, pas déduit : c'est le fait le plus important
        // que le produit puisse enregistrer.
        importance: 98,
        confidence: 1,
        source: 'boamp',
        occurred_at: `${tender.publishedAt}T00:00:00Z`,
        dedupe_key: `tender:${tender.id}`,
      });

      if (!error) report.eventsCreated += 1;
      else if (error.code === '23505') report.eventsSkipped += 1;
      else {
        report.errors += 1;
        options.logger?.warn('Avis non enregistré', { tender: tender.id, error: error.message });
      }
    } catch (cause: unknown) {
      report.errors += 1;
      options.logger?.warn('Avis en échec', {
        tender: tender.id,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  options.logger?.info('Appels d’offres intégrés', {
    fetched: report.fetched,
    companies_created: report.companiesCreated,
    events_created: report.eventsCreated,
    without_identity: report.withoutIdentity,
  });

  return report;
}

async function upsertBuyer(
  db: Db,
  tender: Tender,
  report: TenderIngestionReport,
): Promise<string | null> {
  const { data: existing } = await db
    .from('companies')
    .select('id')
    .eq('siret', tender.siret!)
    .maybeSingle();

  if (existing) {
    report.companiesKnown += 1;
    return existing.id;
  }

  const { data: created, error } = await db
    .from('companies')
    .insert({
      siret: tender.siret,
      siren: tender.siret!.slice(0, 9),
      legal_name: tender.buyerName,
      city: tender.city,
      postal_code: tender.postalCode,
      // On répond à un marché sur la plateforme de dématérialisation, pas au
      // téléphone : l'avis lui-même est le canal de contact.
      contact_form_url: tender.platformUrl ?? tender.noticeUrl,
      // Un SIRET publié par l'acheteur lui-même au Journal officiel ne laisse
      // aucune place au doute d'identité.
      identity_confidence: 1,
    })
    .select('id')
    .maybeSingle();

  if (error || !created) {
    report.errors += 1;
    return null;
  }

  report.companiesCreated += 1;
  return created.id;
}
