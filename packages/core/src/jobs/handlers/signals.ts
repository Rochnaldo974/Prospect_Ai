import { z } from 'zod';
import { runSignalEngine } from '../../signals/engine';
import { enrichFromSirene } from '../../sources/sirene/enricher';
import type { JobHandler } from '../types';

const signalsPayload = z.object({
  limit: z.number().int().min(1).max(20_000).default(2000),
  /** N'examiner que ce qui a bougé depuis N heures. */
  sinceHours: z.number().int().min(1).max(720).optional(),
});

/**
 * Moteur de signaux.
 *
 * Travaille par différence : un signal toujours vrai garde son identité et sa
 * date de détection, un signal devenu faux est désactivé. Sans cela, la
 * fraîcheur refléterait la dernière exécution du moteur plutôt que le moment
 * où le fait a été constaté.
 */
export const detectSignalsHandler: JobHandler<z.infer<typeof signalsPayload>> = {
  type: 'detect_signals',
  schema: signalsPayload,
  defaultPriority: 75,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await runSignalEngine(db, {
      limit: payload.limit,
      logger,
      ...(payload.sinceHours
        ? { since: new Date(Date.now() - payload.sinceHours * 3_600_000) }
        : {}),
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.examined,
      succeeded: report.created + report.unchanged,
      failed: report.errors,
      metadata: {
        created: report.created,
        unchanged: report.unchanged,
        deactivated: report.deactivated,
        triggers_found: report.triggersFound,
        // Le chiffre qui compte : seules ces entreprises peuvent produire une
        // opportunité, puisqu'un signal d'état n'en déclenche jamais.
        companies_with_trigger: report.companiesWithTrigger,
        by_type: report.byType,
      },
    };
  },
};

const enrichPayload = z.object({
  limit: z.number().int().min(1).max(2000).default(200),
});

/**
 * Enrichissement depuis le répertoire.
 *
 * OpenStreetMap apporte le contact mais aucun fait daté, et BODACC l'inverse.
 * Cet enrichissement comble le premier manque pour toute entreprise portant un
 * SIREN — date de création, effectif, activité, statut administratif.
 */
export const enrichSireneHandler: JobHandler<z.infer<typeof enrichPayload>> = {
  type: 'enrich_from_sirene',
  schema: enrichPayload,
  defaultPriority: 70,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await enrichFromSirene(db, {
      limit: payload.limit,
      logger,
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.examined,
      succeeded: report.enriched,
      failed: report.errors,
      metadata: {
        not_found: report.notFound,
        unchanged: report.unchanged,
        fields_filled: report.fieldsFilled,
      },
    };
  },
};
