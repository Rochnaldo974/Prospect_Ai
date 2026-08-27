import { z } from 'zod';
import { ingestFromSource } from '../../ingestion/pipeline';
import { syncBodacc } from '../../ingestion/bodacc-sync';
import { OsmCompanySource } from '../../sources/osm/adapter';
import type { JobHandler } from '../types';

const osmPayload = z.object({
  cities: z.array(z.string().min(1).max(80)).min(1).max(20),
  limit: z.number().int().min(1).max(10_000).default(2000),
});

/**
 * Découverte OpenStreetMap.
 *
 * La source qui apporte ce que SIRENE n'a pas : le moyen de joindre
 * l'entreprise. Une part importante des POI français porte en plus un
 * `ref:FR:SIRET`, ce qui rattache le point de vente au répertoire sans aucun
 * rapprochement approché.
 */
export const discoverOsmHandler: JobHandler<z.infer<typeof osmPayload>> = {
  type: 'discover_osm',
  schema: osmPayload,
  defaultPriority: 70,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    // Le périmètre géographique est porté par la source : le pipeline
    // d'ingestion est générique et n'a pas à connaître la géographie.
    const source = new OsmCompanySource({ cities: payload.cities });

    const report = await ingestFromSource(db, source, {
      logger,
      signal,
      limit: payload.limit,
    });

    return {
      processed: report.read,
      succeeded: report.created + report.merged,
      failed: report.errors,
      metadata: {
        created: report.created,
        merged: report.merged,
        rejected: report.rejected,
        cities: payload.cities,
      },
    };
  },
};

const bodaccPayload = z.object({
  sinceDays: z.number().int().min(1).max(90).default(2),
  departments: z.array(z.string().min(1).max(3)).optional(),
  limit: z.number().int().min(1).max(10_000).default(5000),
});

/**
 * Synchronisation BODACC.
 *
 * Alimente le moteur en événements datés — créations, cessions de fonds,
 * modifications — et retire de la prospection les entreprises en procédure
 * collective ou radiées.
 *
 * Fenêtre de deux jours par défaut plutôt qu'un seul : le BODACC publie avec
 * un décalage variable, et le recouvrement ne coûte rien puisque la
 * déduplication est assurée par clé.
 */
export const syncBodaccHandler: JobHandler<z.infer<typeof bodaccPayload>> = {
  type: 'sync_bodacc',
  schema: bodaccPayload,
  defaultPriority: 80,
  maxAttempts: 3,

  async run(payload, { db, logger, signal }) {
    const since = new Date(Date.now() - payload.sinceDays * 86_400_000);

    const report = await syncBodacc(db, {
      since,
      limit: payload.limit,
      logger,
      ...(payload.departments ? { departments: payload.departments } : {}),
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.fetched,
      succeeded: report.eventsCreated,
      failed: report.errors,
      metadata: {
        matched: report.matched,
        excluded: report.excluded,
        duplicates: report.duplicates,
        by_family: report.byFamily,
      },
    };
  },
};
