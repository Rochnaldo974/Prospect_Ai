import { z } from 'zod';
import { runAllocation } from '../../allocation/engine';
import type { JobHandler } from '../types';

const payload = z.object({
  /** Rattraper un seul utilisateur, sans rejouer toute la distribution. */
  userId: z.string().uuid().optional(),
});

/**
 * Attribution quotidienne.
 *
 * Dernier maillon, et le seul que l'utilisateur voit : fait → événement →
 * signal → opportunité → ATTRIBUTION.
 *
 * Rejouable sans précaution — un utilisateur déjà servi dans la journée est
 * ignoré. C'est ce qui permet de relancer après un incident nocturne sans
 * risquer de livrer deux lots au même freelance.
 */
export const allocateDailyHandler: JobHandler<z.infer<typeof payload>> = {
  type: 'allocate_daily',
  schema: payload,
  defaultPriority: 90,
  maxAttempts: 3,

  async run(input, { db, logger, signal }) {
    const report = await runAllocation(db, {
      logger,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.usersExamined,
      succeeded: report.assignmentsCreated,
      failed: report.errors,
      metadata: {
        users_served: report.usersServed,
        users_already_served: report.usersAlreadyServed,
        // Servis en dessous de leur plafond : c'est la mesure la plus utile
        // du produit — elle dit si le stock suit la demande.
        users_underserved: report.usersUnderserved,
        controls_placed: report.controlsPlaced,
        rejected_by_guards: report.rejectedByGuards,
      },
    };
  },
};
