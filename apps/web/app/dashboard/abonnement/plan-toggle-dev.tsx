import { revalidatePath } from 'next/cache';
import { getServiceClient } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';

/**
 * La bascule de plan — développement uniquement.
 *
 * Tester les deux visages du produit (le composeur verrouillé, le quota
 * hebdomadaire, l'encart latéral) exige de changer de plan en un clic.
 * En production ce composant ne rend rien : le plan y sera l'affaire du
 * paiement, pas d'un bouton.
 */
export function PlanToggleDev({ current }: { current: 'free' | 'premium' }) {
  if (process.env.NODE_ENV === 'production') return null;

  async function toggle(): Promise<void> {
    'use server';
    if (process.env.NODE_ENV === 'production') return;
    const profile = await requireUser();
    await getServiceClient()
      .from('profiles')
      .update({ plan: current === 'premium' ? 'free' : 'premium' })
      .eq('id', profile.id);
    revalidatePath('/dashboard', 'layout');
  }

  return (
    <form action={toggle} className="mt-10 border-t pt-5">
      <button
        type="submit"
        className="rounded-full border border-dashed px-4 py-2 font-mono text-xs text-muted-foreground transition-colors hover:bg-[var(--mist)]"
      >
        [dev] basculer vers {current === 'premium' ? 'Gratuit' : 'Solo'}
      </button>
    </form>
  );
}
