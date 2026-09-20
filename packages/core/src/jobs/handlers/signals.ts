import { z } from 'zod';
import { runSignalEngine } from '../../signals/engine';
import { enrichFromSirene } from '../../sources/sirene/enricher';
import { resolveIdentityByName } from '../../sources/sirene/identity';
import { fillPostalCodesFromCoordinates } from '../../sources/ban/reverse';
import { fanOut } from '../fan-out';
import type { JobHandler } from '../types';

const signalsPayload = z.object({
  limit: z.number().int().min(1).max(20_000).default(2000),
  /** N'examiner que ce qui a bougé depuis N heures. */
  sinceHours: z.number().int().min(1).max(720).optional(),
  /** Tranche d'une passe découpée en plusieurs jobs. */
  offset: z.number().int().min(0).optional(),
  /** Toute la base, une tranche par job : voir generate_opportunities. */
  all: z.boolean().default(false),
});

const SLICE = 20_000;

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
    if (payload.all) {
      const { count, error } = await db
        .from('companies')
        .select('id', { count: 'exact', head: true })
        .eq('prospecting_allowed', true)
        .eq('suppression_global', false)
        .neq('company_status', 'closed');
      if (error) throw new Error(error.message);
      const out = await fanOut(db, {
        type: 'detect_signals', total: count ?? 0, chunk: SLICE, priority: 75,
        ...(payload.sinceHours ? { payload: { sinceHours: payload.sinceHours } } : {}), prefix: 'detect-signals',
      });
      logger.info('Passe complète du moteur de signaux planifiée', { entreprises: count ?? 0, tranches: out.slices, jobs: out.enqueued });
      return { processed: count ?? 0, succeeded: out.enqueued, failed: 0, metadata: { fan_out: true, slices: out.slices, enqueued: out.enqueued } };
    }

    const report = await runSignalEngine(db, {
      limit: payload.limit,
      ...(payload.offset !== undefined ? { offset: payload.offset } : {}),
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
    // Dans l'ordre où chaque étape rend la suivante possible : le code postal
    // permet la recherche par nom, le SIREN permet l'enrichissement.
    const common = { limit: payload.limit, logger, ...(signal ? { signal } : {}) };
    await fillPostalCodesFromCoordinates(db, common);
    await resolveIdentityByName(db, common);
    const report = await enrichFromSirene(db, common);

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
