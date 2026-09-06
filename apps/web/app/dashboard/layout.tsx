import Link from 'next/link';
import { getFollowUps, getServiceClient } from '@prospect/core';
import { getSessionProfile } from '@/lib/auth/session';
import { signOut } from '@/app/(auth)/actions';
import { DashboardNav } from '@/components/dashboard/nav';
import { Sidebar } from '@/components/dashboard/sidebar';

/**
 * La coque du tableau de bord.
 *
 * Deux formes pour une même liste d'écrans : la colonne à gauche dès
 * 1024 px — c'est elle qui fait « produit » et non « site avec des pages » —
 * et la barre horizontale en dessous, sans tiroir à ouvrir d'une main dans
 * le métro. Les nombres à agir (mis de côté, à relancer) voyagent avec.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  let followUpCount = 0;
  let snoozedCount = 0;
  if (profile) {
    const db = getServiceClient();
    const [followUps, snoozed] = await Promise.all([
      getFollowUps(db, profile.id),
      db.from('assignments').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .in('status', ['active', 'contacted'])
        .not('snoozed_at', 'is', null),
    ]);
    followUpCount = followUps.length;
    snoozedCount = snoozed.count ?? 0;
  }

  return (
    <div className="flex min-h-dvh bg-[var(--mist)]">
      <Sidebar
        followUpCount={followUpCount}
        snoozedCount={snoozedCount}
        plan={profile?.plan ?? 'free'}
        isAdmin={profile?.role === 'admin'}
        signOutAction={signOut}
      />

      <div className="min-w-0 flex-1">
        {/* La barre mobile : mêmes écrans, forme horizontale. */}
        <header className="sticky top-0 z-30 border-b bg-[var(--white)] lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
            <Link href="/dashboard" className="text-lg font-semibold tracking-[-0.03em]">
              prospect<span className="text-[var(--brand)]">.ai</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard/abonnement"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Abonnement
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
          <div className="overflow-x-auto px-5">
            <DashboardNav followUpCount={followUpCount} snoozedCount={snoozedCount} />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
