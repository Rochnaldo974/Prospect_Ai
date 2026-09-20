import { z } from 'zod';
import type { JobHandler } from '../types';
import { backfillContacts } from '../../contacts/backfill';

/**
 * Récupération des contacts déjà connus, par tranches reprenables.
 *
 * Un job traite une page d'entreprises à partir d'un curseur et, s'il en
 * reste, ré-enfile la suite lui-même : une seule commande lance tout le
 * backfill, et une interruption ne coûte que la page en cours.
 */
const backfillPayload = z.object({
  limit: z.number().int().min(1).max(1000).default(1000),
  cursor: z.string().uuid().nullable().default(null),
  dryRun: z.boolean().default(false),
  /** Enfile automatiquement la page suivante tant qu'il en reste. */
  chain: z.boolean().default(false),
  /** Les entreprises encore en attente seulement : reprise sans curseur. */
  pendingOnly: z.boolean().default(false),
  /** Rang de la page dans la chaîne de la nuit (clé d'idempotence). */
  page: z.number().int().min(0).default(0),
});

export const backfillContactsHandler: JobHandler<z.infer<typeof backfillPayload>> = {
  type: 'backfill_contacts',
  schema: backfillPayload,
  defaultPriority: 20,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await backfillContacts(db, {
      limit: payload.limit,
      cursor: payload.cursor,
      dryRun: payload.dryRun,
      pendingOnly: payload.pendingOnly,
      logger,
      signal,
    });

    if (payload.chain && !report.done && !signal.aborted && (payload.pendingOnly || report.nextCursor)) {
      // En mode « en attente », la page suivante se sert toute seule : pas
      // de curseur, une clé par nuit et par rang. Sinon, le curseur reste
      // la clé — reprendre au même endroit ne double rien.
      const today = new Date().toISOString().slice(0, 10);
      await db.rpc('enqueue_job', {
        p_job_type: 'backfill_contacts',
        p_payload: payload.pendingOnly
          ? { ...payload, cursor: null, page: payload.page + 1 }
          : { ...payload, cursor: report.nextCursor },
        p_priority: 20,
        p_dedupe_key: payload.pendingOnly
          ? `backfill-contacts:${today}:${payload.page + 1}`
          : `backfill-contacts:${report.nextCursor}`,
      });
    }

    return {
      processed: report.examined,
      succeeded: report.resolved,
      failed: report.errors,
      metadata: {
        with_candidates: report.withCandidates,
        contacts_written: report.contactsWritten,
        newly_contactable: report.newlyContactable,
        newly_with_email: report.newlyWithEmail,
        no_candidates: report.noCandidates,
        next_cursor: report.nextCursor,
        done: report.done,
        dry_run: payload.dryRun,
      },
    };
  },
};

const prunePayload = z.object({
  olderThanDays: z.number().int().min(1).max(365).default(14),
});

/** Les rejets du quality gate sont une mesure, pas un historique : quinze jours suffisent. */
export const pruneRejectionsHandler: JobHandler<z.infer<typeof prunePayload>> = {
  type: 'prune_rejections',
  schema: prunePayload,
  defaultPriority: 10,

  async run(payload, { db, logger }) {
    const { data, error } = await db.rpc('prune_opportunity_rejections', {
      older_than: `${payload.olderThanDays} days`,
    });
    if (error) throw new Error(error.message);
    const pruned = data ?? 0;
    if (pruned > 0) logger.info('Rejets purgés', { pruned });
    return { processed: pruned, succeeded: pruned, failed: 0 };
  },
};
