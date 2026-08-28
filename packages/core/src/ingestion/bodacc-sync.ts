import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { BodaccSource, type BodaccAnnouncement, type BodaccFamily } from '../sources/bodacc/adapter';

export interface BodaccSyncReport {
  fetched: number;
  /** Entreprises créées à partir d'une annonce de création. */
  companiesCreated: number;
  /** Annonces dont le SIREN correspond à une entreprise connue. */
  matched: number;
  eventsCreated: number;
  /** Entreprises retirées de la prospection (procédure collective, radiation). */
  excluded: number;
  duplicates: number;
  errors: number;
  byFamily: Record<string, number>;
}

export interface BodaccSyncOptions {
  since: Date;
  /**
   * Créer l'entreprise quand une annonce de création la concerne.
   *
   * Sans cela, BODACC ne fait qu'enrichir ce qu'on a déjà — or les créations
   * sont précisément les entreprises qu'on n'a PAS. Mesuré sur les données
   * réelles : la plus récente création parmi les commerces cartographiés dans
   * OpenStreetMap datait de cinq mois, parce qu'il faut du temps avant qu'un
   * nouveau commerce soit cartographié. Le meilleur déclencheur du produit ne
   * peut donc pas venir de là.
   */
  createMissing?: boolean;
  until?: Date;
  families?: BodaccFamily[];
  departments?: string[];
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
}

/**
 * Synchronise les annonces BODACC vers les événements du moteur.
 *
 * Deux effets distincts :
 *
 *   1. Un événement daté sur les entreprises connues. C'est ce qui permet au
 *      moteur de répondre « pourquoi maintenant » : une cession de fonds
 *      publiée la semaine dernière est un motif de contact autrement plus
 *      solide qu'un site mal fichu depuis trois ans.
 *
 *   2. Une exclusion pour les procédures collectives et les radiations. On ne
 *      démarche pas une entreprise en redressement : c'est inefficace, et
 *      c'est déplacé.
 *
 * Les annonces sans correspondance sont ignorées : BODACC couvre toute la
 * France, notre base n'en couvre qu'une partie. Les rapprocher créerait des
 * entreprises sans aucune donnée exploitable.
 */
export async function syncBodacc(
  db: Db,
  options: BodaccSyncOptions,
): Promise<BodaccSyncReport> {
  const report: BodaccSyncReport = {
    fetched: 0,
    companiesCreated: 0,
    matched: 0,
    eventsCreated: 0,
    excluded: 0,
    duplicates: 0,
    errors: 0,
    byFamily: {},
  };

  const source = new BodaccSource();
  const log = options.logger;

  // Traitement par lots : une requête de correspondance par annonce ferait des
  // milliers d'allers-retours pour une synchronisation quotidienne.
  const batch: BodaccAnnouncement[] = [];
  const BATCH_SIZE = 200;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;

    const sirens = [...new Set(batch.map((a) => a.siren))];
    const { data: companies, error } = await db
      .from('companies')
      .select('id, siren')
      .in('siren', sirens);

    if (error) {
      report.errors += batch.length;
      log?.error('Échec de correspondance BODACC', { error: error.message });
      batch.length = 0;
      return;
    }

    // Un SIREN peut porter plusieurs établissements : l'annonce concerne
    // l'unité légale, donc tous ses établissements connus.
    const bySiren = new Map<string, string[]>();
    for (const company of companies ?? []) {
      if (!company.siren) continue;
      const list = bySiren.get(company.siren) ?? [];
      list.push(company.id);
      bySiren.set(company.siren, list);
    }

    // Les créations font naître l'entreprise si elle est inconnue : c'est la
    // seule source qui livre les commerces neufs au moment où ils ouvrent.
    if (options.createMissing) {
      const missing = batch.filter(
        (a) =>
          (a.family === 'Créations' || a.family === 'Immatriculations')
          && a.tradeName
          && !bySiren.has(a.siren),
      );

      // Une même entreprise peut faire l'objet de deux annonces dans le lot.
      const unique = new Map(missing.map((a) => [a.siren, a]));

      for (const announcement of unique.values()) {
        const { data: created, error: createError } = await db
          .from('companies')
          .insert({
            siren: announcement.siren,
            legal_name: announcement.tradeName!.slice(0, 300),
            city: announcement.city,
            postal_code: announcement.postalCode,
            segment: 'other',
            company_status: 'active',
            // Identité modeste : on n'a ni SIRET, ni activité, ni contact.
            // L'enrichissement depuis le répertoire complétera.
            identity_confidence: 0.7,
            last_seen_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (createError) {
          // 23505 : une autre annonce du même lot l'a déjà créée.
          if (createError.code !== '23505') report.errors += 1;
          continue;
        }

        report.companiesCreated += 1;
        bySiren.set(announcement.siren, [created.id]);
      }
    }

    for (const announcement of batch) {
      const companyIds = bySiren.get(announcement.siren);
      if (!companyIds || companyIds.length === 0) continue;

      report.matched += 1;
      report.byFamily[announcement.family] = (report.byFamily[announcement.family] ?? 0) + 1;

      for (const companyId of companyIds) {
        const { error: eventError } = await db.from('company_events').insert({
          company_id: companyId,
          event_type: announcement.eventType,
          payload: {
            bodacc_id: announcement.id,
            famille: announcement.family,
            commercant: announcement.tradeName,
            tribunal: announcement.court,
            url: announcement.url,
          } as Json,
          importance: announcement.importance,
          confidence: 0.99,
          source: 'bodacc',
          occurred_at: `${announcement.publishedAt}T00:00:00Z`,
          dedupe_key: `bodacc:${announcement.id}:${companyId}`,
        });

        if (eventError) {
          // 23505 : l'annonce a déjà été enregistrée lors d'une synchronisation
          // précédente. C'est le fonctionnement attendu, pas une erreur.
          if (eventError.code === '23505') {
            report.duplicates += 1;
          } else {
            report.errors += 1;
            log?.warn('Événement BODACC non enregistré', {
              bodacc_id: announcement.id,
              error: eventError.message,
            });
          }
          continue;
        }

        report.eventsCreated += 1;

        if (announcement.excludes) {
          await db
            .from('companies')
            .update({
              prospecting_allowed: false,
              company_status: announcement.family === 'Radiations' ? 'closed' : 'active',
            })
            .eq('id', companyId);
          report.excluded += 1;
        }
      }
    }

    batch.length = 0;
  };

  for await (const announcement of source.fetch({
    since: options.since,
    ...(options.until ? { until: options.until } : {}),
    ...(options.families ? { families: options.families } : {}),
    ...(options.departments ? { departments: options.departments } : {}),
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  })) {
    report.fetched += 1;
    batch.push(announcement);
    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();

  log?.info('Synchronisation BODACC terminée', {
    fetched: report.fetched,
    companies_created: report.companiesCreated,
    matched: report.matched,
    events: report.eventsCreated,
    excluded: report.excluded,
    duplicates: report.duplicates,
  });

  return report;
}
