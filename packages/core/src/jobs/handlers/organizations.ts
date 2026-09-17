import { z } from 'zod';
import { ingestAssociations } from '../../ingestion/associations';
import { ingestPermits } from '../../ingestion/permits';
import type { JobHandler } from '../types';

const joafePayload = z.object({
  limit: z.number().int().min(1).max(5000).default(500),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Les associations du Journal officiel : créations et modifications, chaque nuit. */
export const ingestJoafeHandler: JobHandler<z.infer<typeof joafePayload>> = {
  type: 'ingest_joafe',
  schema: joafePayload,
  defaultPriority: 60,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await ingestAssociations(db, { limit: payload.limit, ...(payload.since ? { since: payload.since } : {}), logger, ...(signal ? { signal } : {}) });
    return { processed: report.fetched, succeeded: report.eventsCreated, failed: report.errors, metadata: { ...report } };
  },
};

const sitadelPayload = z.object({
  limit: z.number().int().min(1).max(20000).default(2000),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Les permis créant des locaux : une fois par semaine, rattachés par SIRET. */
export const ingestSitadelHandler: JobHandler<z.infer<typeof sitadelPayload>> = {
  type: 'ingest_sitadel',
  schema: sitadelPayload,
  defaultPriority: 40,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await ingestPermits(db, { limit: payload.limit, ...(payload.since ? { since: payload.since } : {}), logger, ...(signal ? { signal } : {}) });
    return { processed: report.fetched, succeeded: report.eventsCreated, failed: report.errors, metadata: { ...report } };
  },
};
