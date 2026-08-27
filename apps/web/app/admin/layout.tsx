import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { signOut } from '@/app/(auth)/actions';

// Ne lister que les pages qui existent : un lien mort dans une console
// d'observation fait douter de ce qu'on regarde.
const NAV = [
  { href: '/admin', label: 'Vue d’ensemble' },
  { href: '/admin/companies', label: 'Entreprises' },
  { href: '/admin/jobs', label: 'Jobs' },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Vérification serveur du rôle — jamais côté client.
  await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
          <Link href="/admin" className="text-sm font-semibold">
            Prospect AI <span className="text-muted-foreground">· admin</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              ← Retour à l&apos;app
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </div>
  );
}
