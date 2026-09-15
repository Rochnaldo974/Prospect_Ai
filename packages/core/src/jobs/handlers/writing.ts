import { z } from 'zod';
import { writeCards } from '../../allocation/writing';
import type { JobHandler } from '../types';

const payload = z.object({
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

/**
 * Rédaction des fiches, après l'attribution.
 *
 * Passe sur les dossiers vivants sans fiche rédigée. Sans clé d'API, ne
 * fait rien et le dit : le relevé du moteur reste affiché.
 */
export const writeCardsHandler: JobHandler<z.infer<typeof payload>> = {
  type: 'write_cards',
  schema: payload,
  defaultPriority: 85,
  maxAttempts: 2,

  async run(input, { db, logger, signal }) {
    const report = await writeCards(db, {
      logger,
      limit: input.limit,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(signal ? { signal } : {}),
    });
    return {
      processed: report.usersExamined,
      succeeded: report.written,
      failed: report.errors,
      metadata: { already_written: report.alreadyWritten, skipped: report.skipped },
    };
  },
};
