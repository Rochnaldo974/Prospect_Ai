import { z } from 'zod';
import { ingestTenders } from '../../ingestion/tenders';
import type { JobHandler } from '../types';

const payload = z.object({
  limit: z.number().int().min(1).max(200).default(100),
});

/**
 * Relevé des appels d'offres.
 *
 * Passe tous les jours : un avis publié le matin peut avoir une date limite à
 * trois semaines, et le freelance qui l'apprend une semaine plus tard a perdu
 * un tiers du temps dont il disposait pour monter son dossier.
 *
 * Priorité haute : c'est la seule source où le besoin est déclaré, et la seule
 * dont les opportunités s'éteignent à une date fixée par un tiers.
 */
export const ingestTendersHandler: JobHandler<z.infer<typeof payload>> = {
  type: 'ingest_tenders',
  schema: payload,
  defaultPriority: 85,
  maxAttempts: 3,

  async run(input, { db, logger, signal }) {
    const report = await ingestTenders(db, {
      limit: input.limit,
      logger,
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.fetched,
      succeeded: report.eventsCreated,
      failed: report.errors,
      metadata: {
        companies_created: report.companiesCreated,
        companies_known: report.companiesKnown,
        events_created: report.eventsCreated,
        events_skipped: report.eventsSkipped,
        // Sans SIRET on ne crée rien : le compter dit ce que la source coûte
        // en couverture, et permet d'arbitrer plus tard.
        without_identity: report.withoutIdentity,
      },
    };
  },
};
