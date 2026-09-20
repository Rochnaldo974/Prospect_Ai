import { z } from 'zod';
import { runOpportunityEngine } from '../../opportunities/engine';
import { fanOut } from '../fan-out';
import type { JobHandler } from '../types';

const payload = z.object({
  /** Tranche d'une passe découpée en plusieurs jobs. */
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(20_000).default(5000),
  /** Abaisser le seuil pour mesurer ce qu'un gate plus permissif produirait. */
  minBaseScore: z.number().min(0).max(100).optional(),
  dryRun: z.boolean().default(false),
  /**
   * Toute la base : compte les entreprises signalées et enfile une tranche
   * par job. Sans cela, une seule passe ne voit que les vingt mille
   * premières — les mêmes chaque nuit.
   */
  all: z.boolean().default(false),
});

const SLICE = 20_000;

/**
 * Moteur d'opportunités.
 *
 * Dernier maillon : fait → événement → signal → opportunité. N'examine que les
 * entreprises portant un déclencheur actif, puisqu'un signal d'état ne peut
 * jamais créer une opportunité à lui seul.
 *
 * Les motifs de refus sont comptés et remontés : c'est ce qui permet de
 * calibrer le quality gate sur des données réelles plutôt que sur une
 * intuition. Un gate trop strict assèche le stock, un gate trop lâche fait
 * perdre son temps au freelance — et la seconde erreur coûte plus cher.
 */
export const generateOpportunitiesHandler: JobHandler<z.infer<typeof payload>> = {
  type: 'generate_opportunities',
  schema: payload,
  defaultPriority: 78,
  maxAttempts: 2,

  async run(input, { db, logger, signal }) {
    if (input.all) {
      const { count, error } = await db
        .from('companies')
        .select('id', { count: 'exact', head: true })
        .eq('prospecting_allowed', true)
        .eq('suppression_global', false)
        .or('trigger_signal_count.gt.0,active_signal_count.gt.0');
      if (error) throw new Error(error.message);
      const out = await fanOut(db, {
        type: 'generate_opportunities', total: count ?? 0, chunk: SLICE, priority: 78,
        payload: { dryRun: input.dryRun }, prefix: 'generate-opportunities',
      });
      logger.info('Passe complète du moteur d’opportunités planifiée', { entreprises: count ?? 0, tranches: out.slices, jobs: out.enqueued });
      return { processed: count ?? 0, succeeded: out.enqueued, failed: 0, metadata: { fan_out: true, slices: out.slices, enqueued: out.enqueued } };
    }

    const report = await runOpportunityEngine(db, {
      limit: input.limit,
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
      dryRun: input.dryRun,
      logger,
      ...(input.minBaseScore !== undefined ? { gate: { minBaseScore: input.minBaseScore } } : {}),
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.companiesExamined,
      succeeded: report.created + report.updated,
      failed: report.errors,
      metadata: {
        scored: report.scored,
        created: report.created,
        updated: report.updated,
        rejected: report.rejected,
        rejection_reasons: report.rejectionReasons,
        by_type: report.byType,
      },
    };
  },
};
