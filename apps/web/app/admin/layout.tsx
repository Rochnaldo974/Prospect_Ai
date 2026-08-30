import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { signOut } from '@/app/(auth)/actions';
import { AdminNav } from '@/components/admin/nav';

/**
 * La console d'observation.
 *
 * Elle sert à une seule chose : juger si ce que le moteur produit vaut la
 * peine d'être livré. Elle est donc composée comme un poste de contrôle et non
 * comme un tableau de bord de vente — pas de grands chiffres décoratifs, des
 * données comparables et des filets qui séparent.
 *
 * La barre d'onglets marque la page courante : sans repère, on clique deux
 * fois sur le même lien en se demandant si la page a changé.
 */
const NAV = [
  { href: '/admin', label: 'Vue d’ensemble' },
  { href: '/admin/companies', label: 'Entreprises' },
  { href: '/admin/duplicates', label: 'Doublons' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/mesure', label: 'Mesure' },
  { href: '/admin/import', label: 'Import' },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Vérification serveur du rôle — jamais côté client.
  const profile = await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-[var(--paper)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/admin" className="field-label shrink-0">
            Prospect AI <span className="text-[var(--verified)]">console</span>
          </Link>

          <AdminNav items={NAV} />

          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{profile.email}</span>
            <Link href="/dashboard" className="hover:text-foreground">
              L&apos;application
            </Link>
            <form action={signOut}>
              <button type="submit" className="hover:text-foreground">Déconnexion</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
