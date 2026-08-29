import { z } from 'zod';
import { runOpportunityEngine } from '../../opportunities/engine';
import type { JobHandler } from '../types';

const payload = z.object({
  limit: z.number().int().min(1).max(20_000).default(5000),
  /** Abaisser le seuil pour mesurer ce qu'un gate plus permissif produirait. */
  minBaseScore: z.number().min(0).max(100).optional(),
  dryRun: z.boolean().default(false),
});

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
    const report = await runOpportunityEngine(db, {
      limit: input.limit,
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
