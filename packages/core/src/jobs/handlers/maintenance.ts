import { z } from 'zod';
import type { JobHandler } from '../types';

const noPayload = z.object({}).loose();

/**
 * Opportunités arrivées à expiration.
 *
 * Une opportunité non distribuée finit par ne plus rien valoir : les signaux
 * qui l'ont produite ont vieilli. La laisser en stock fausserait l'inventaire
 * et la découverte pilotée par la demande.
 */
export const expireOpportunitiesHandler: JobHandler<z.infer<typeof noPayload>> = {
  type: 'expire_opportunities',
  schema: noPayload,
  defaultPriority: 40,

  async run(_payload, { db, logger }) {
    const { data, error } = await db.rpc('expire_stale_opportunities');
    if (error) throw new Error(error.message);

    const expired = data ?? 0;
    if (expired > 0) logger.info('Opportunités expirées', { expired });

    return { processed: expired, succeeded: expired, failed: 0 };
  },
};

/**
 * Attributions jamais utilisées.
 *
 * Passé le délai d'exclusivité sans contact, l'entreprise repart au stock.
 * C'est ce qui empêche l'inventaire de se figer sur des opportunités que
 * personne n'exploitera.
 */
export const expireAssignmentsHandler: JobHandler<z.infer<typeof noPayload>> = {
  type: 'expire_assignments',
  schema: noPayload,
  defaultPriority: 60,

  async run(_payload, { db, logger }) {
    const { data, error } = await db.rpc('expire_stale_assignments');
    if (error) throw new Error(error.message);

    const released = data ?? 0;
    if (released > 0) logger.info('Attributions expirées et entreprises relâchées', { released });

    return { processed: released, succeeded: released, failed: 0 };
  },
};

const partitionsPayload = z.object({
  monthsBack: z.number().int().min(0).max(24).default(1),
  monthsAhead: z.number().int().min(1).max(12).default(3),
});

/**
 * Partitions mensuelles à venir.
 *
 * Volontairement sans partition DEFAULT : une insertion hors plage doit
 * échouer bruyamment plutôt que de s'entasser silencieusement. Ce job est donc
 * la seule chose qui empêche le pipeline de s'arrêter le 1er du mois.
 */
export const ensurePartitionsHandler: JobHandler<z.infer<typeof partitionsPayload>> = {
  type: 'ensure_partitions',
  schema: partitionsPayload,
  defaultPriority: 90,

  async run(payload, { db, logger }) {
    const { data, error } = await db.rpc('ensure_month_partitions', {
      months_back: payload.monthsBack,
      months_ahead: payload.monthsAhead,
    });
    if (error) throw new Error(error.message);

    const created = data ?? 0;
    if (created > 0) logger.info('Partitions créées', { created });

    return { processed: created, succeeded: created, failed: 0 };
  },
};

const reclaimPayload = z.object({
  stalledAfterMinutes: z.number().int().min(1).max(1440).default(15),
});

/**
 * Jobs abandonnés par un worker mort.
 *
 * Sans ce balayage, un worker tué net laisse ses jobs en `running` pour
 * toujours et le pipeline se vide silencieusement.
 */
export const reclaimStalledHandler: JobHandler<z.infer<typeof reclaimPayload>> = {
  type: 'reclaim_stalled_jobs',
  schema: reclaimPayload,
  defaultPriority: 95,

  async run(payload, { db, logger }) {
    const { data, error } = await db.rpc('reclaim_stalled_jobs', {
      stalled_after: `${payload.stalledAfterMinutes} minutes`,
    });
    if (error) throw new Error(error.message);

    const reclaimed = data ?? 0;
    if (reclaimed > 0) logger.warn('Jobs repris après interruption d’un worker', { reclaimed });

    return { processed: reclaimed, succeeded: reclaimed, failed: 0 };
  },
};

const prunePayload = z.object({
  olderThanDays: z.number().int().min(30).max(2000).default(400),
});

/** Purge du registre de déduplication d'événements. */
export const pruneEventKeysHandler: JobHandler<z.infer<typeof prunePayload>> = {
  type: 'prune_event_keys',
  schema: prunePayload,
  defaultPriority: 10,

  async run(payload, { db, logger }) {
    const { data, error } = await db.rpc('prune_event_keys', {
      older_than: `${payload.olderThanDays} days`,
    });
    if (error) throw new Error(error.message);

    const pruned = data ?? 0;
    if (pruned > 0) logger.info('Clés d’événements purgées', { pruned });

    return { processed: pruned, succeeded: pruned, failed: 0 };
  },
};

/**
 * Valeurs des listes déroulantes de la console.
 *
 * Précalculées plutôt que dérivées à chaque affichage : sur une base de
 * plusieurs millions d'entreprises, alimenter trois menus déroulants ne doit
 * pas coûter un parcours de table.
 */
export const refreshFilterOptionsHandler: JobHandler<z.infer<typeof noPayload>> = {
  type: 'refresh_filter_options',
  schema: noPayload,
  defaultPriority: 20,

  async run(_payload, { db, logger }) {
    const { data, error } = await db.rpc('refresh_filter_options');
    if (error) throw new Error(error.message);

    const total = data ?? 0;
    logger.info('Options de filtre rafraîchies', { total });

    return { processed: total, succeeded: total, failed: 0 };
  },
};

/**
 * Compteurs de la vue d'ensemble.
 *
 * Dix-huit sous-requêtes de comptage : 82 ms à 300 000 entreprises, environ
 * 800 ms à trois millions. Précalculés toutes les cinq minutes, l'affichage
 * devient gratuit — et ces chiffres décrivent un état, pas une transaction.
 */
export const refreshAdminStatsHandler: JobHandler<z.infer<typeof noPayload>> = {
  type: 'refresh_admin_stats',
  schema: noPayload,
  defaultPriority: 15,

  async run(_payload, { db }) {
    const { error } = await db.rpc('refresh_admin_stats');
    if (error) throw new Error(error.message);
    return { processed: 1, succeeded: 1, failed: 0 };
  },
};
