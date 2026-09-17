import { z } from 'zod';
import type { JobHandler } from '../types';
import { planDiscovery } from '../../discovery/planner';
import { importAfnicDaily } from '../../sources/afnic/daily';
import { resolveBodaccContacts } from '../../ingestion/bodacc-contacts';
import { resolveIdentityLocally } from '../../ingestion/identity-local';

const planPayload = z.object({ perNight: z.number().int().min(1).max(200).optional() });

/** Planifie la découverte de la nuit : quelques zones dues, un job chacune. */
export const planDiscoveryHandler: JobHandler<z.infer<typeof planPayload>> = {
  type: 'plan_discovery',
  schema: planPayload,
  defaultPriority: 72,

  async run(payload, { db, logger }) {
    const report = await planDiscovery(db, { ...(payload.perNight ? { perNight: payload.perNight } : {}), logger });
    return { processed: report.due, succeeded: report.planned, failed: 0, metadata: { areas: report.areas } };
  },
};
const afnicPayload = z.object({
  lookbackDays: z.number().int().min(1).max(7).default(3),
});

/** Les .fr créés la veille (et les deux jours d'avant, au cas où une nuit a manqué). */
export const importAfnicDailyHandler: JobHandler<z.infer<typeof afnicPayload>> = {
  type: 'import_afnic_daily',
  schema: afnicPayload,
  defaultPriority: 82,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await importAfnicDaily(db, { lookbackDays: payload.lookbackDays, logger, signal });
    return {
      processed: report.read,
      succeeded: report.queued,
      failed: report.errors,
      metadata: { days: report.days, fetched: report.fetched, missing: report.missing, already_known: report.alreadyKnown },
    };
  },
};

const bodaccPayload = z.object({
  limit: z.number().int().min(1).max(1000).default(500),
  minScore: z.number().min(0.7).max(1).default(0.9),
  dryRun: z.boolean().default(false),
});

/** Les entreprises BODACC sans contact, rapprochées de l'annuaire puis résolues. */
export const resolveBodaccContactsHandler: JobHandler<z.infer<typeof bodaccPayload>> = {
  type: 'resolve_bodacc_contacts',
  schema: bodaccPayload,
  defaultPriority: 66,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await resolveBodaccContacts(db, { limit: payload.limit, minScore: payload.minScore, dryRun: payload.dryRun, logger, signal });
    return {
      processed: report.examined,
      succeeded: report.merged,
      failed: report.errors,
      metadata: { matched: report.matched, now_contactable: report.nowContactable, ambiguous: report.ambiguous, unmatched: report.unmatched, dry_run: payload.dryRun },
    };
  },
};

const identityPayload = z.object({
  limit: z.number().int().min(1).max(20_000).default(1000),
  dryRun: z.boolean().default(false),
});

/** L'identité par le référentiel SIRENE local : même enseigne, même code postal, un seul SIREN. */
export const resolveIdentityLocalHandler: JobHandler<z.infer<typeof identityPayload>> = {
  type: 'resolve_identity_local',
  schema: identityPayload,
  defaultPriority: 69,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await resolveIdentityLocally(db, { limit: payload.limit, dryRun: payload.dryRun, logger, signal });
    return {
      processed: report.examined,
      succeeded: report.matched,
      failed: report.errors,
      metadata: { ambiguous: report.ambiguous, unmatched: report.unmatched, dry_run: payload.dryRun },
    };
  },
};
