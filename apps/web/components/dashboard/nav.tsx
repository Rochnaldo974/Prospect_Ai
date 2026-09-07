'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Les deux écrans du service.
 *
 * L'onglet actif est marqué par un trait sous le libellé plutôt que par une
 * couleur seule : un daltonien doit savoir où il est, et le trait le dit sans
 * dépendre de la teinte.
 */
const TABS = [
  ['/dashboard', 'Aujourd’hui'],
  ['/dashboard/plus-tard', 'Plus tard'],
  ['/dashboard/suivi', 'À relancer'],
  ['/dashboard/historique', 'Historique'],
] as const;

export function DashboardNav({
  followUpCount = 0,
  snoozedCount = 0,
}: {
  followUpCount?: number;
  snoozedCount?: number;
}) {
  const pathname = usePathname();
  const counts: Record<string, number> = {
    '/dashboard/suivi': followUpCount,
    '/dashboard/plus-tard': snoozedCount,
  };

  return (
    <nav className="flex items-center gap-6 whitespace-nowrap pb-0 text-sm">
      {TABS.map(([href, label]) => {
        // La page dossier appartient à « Aujourd’hui » : on y arrive par elle.
        const active = pathname === href
          || (href === '/dashboard' && pathname.startsWith('/dashboard/opportunite'));
        const count = counts[href] ?? 0;
        const badge = count > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 transition-colors ${
              active
                ? 'border-[var(--brand)] font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {/* Le compte des dossiers ouverts : c'est lui qui ramène sur
                l'onglet — un « À relancer » nu se laisse oublier. */}
            {badge ? (
              <span className="tabular grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 py-0.5 font-mono text-[10px] leading-none text-white">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
