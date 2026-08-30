import Link from 'next/link';
import { getFollowUps, getServiceClient } from '@prospect/core';
import { getSessionProfile } from '@/lib/auth/session';
import { signOut } from '@/app/(auth)/actions';
import { DashboardNav } from '@/components/dashboard/nav';

/**
 * La coque du tableau de bord.
 *
 * Le service tient en deux écrans — ce qui arrive ce matin, et ce qui reste à
 * relancer — et la barre le dit. Une navigation à deux entrées n'a pas besoin
 * d'être repliée dans un menu : la montrer entière fait comprendre le produit
 * plus vite que n'importe quelle visite guidée.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  const followUpCount = profile
    ? (await getFollowUps(getServiceClient(), profile.id)).length
    : 0;

  return (
    <div className="min-h-dvh bg-[var(--mist)]">
      <header className="sticky top-0 z-30 border-b bg-[var(--white)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-3.5">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold tracking-[-0.03em]">
              prospect<span className="text-[var(--brand)]">.ai</span>
            </Link>
            <DashboardNav followUpCount={followUpCount} />
          </div>

          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/onboarding?modifier"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Préférences
            </Link>
            {profile?.role === 'admin' ? (
              <Link
                href="/admin"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Admin
              </Link>
            ) : null}
            {/* Server action plutôt qu'un route handler : un seul chemin de
                déconnexion, et pas d'URL POST exposée sans usage. */}
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
      </header>

      {children}
    </div>
  );
}
