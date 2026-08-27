'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { decideDuplicate } from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/session';

const decisionSchema = z.object({
  pairId: z.uuid(),
  decision: z.enum(['merge', 'reject']),
});

export interface DecisionState {
  error?: string;
  message?: string;
}

/**
 * Arbitre une paire de doublons.
 *
 * L'identité de l'admin est enregistrée avec la décision : une fusion détruit
 * une ligne, on doit pouvoir savoir qui l'a validée.
 */
export async function decidePair(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const profile = await requireAdmin();
  const db = await getAdminDb();

  const parsed = decisionSchema.safeParse({
    pairId: formData.get('pairId'),
    decision: formData.get('decision'),
  });
  if (!parsed.success) return { error: 'Décision invalide.' };

  try {
    const { survivorId } = await decideDuplicate(
      db,
      parsed.data.pairId,
      parsed.data.decision,
      profile.email,
    );

    revalidatePath('/admin/duplicates');
    revalidatePath('/admin/companies');

    return {
      message: survivorId
        ? 'Fusion effectuée. L’entreprise absorbée reste consultable dans le journal des fusions.'
        : 'Paire écartée : les deux entreprises restent distinctes.',
    };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
