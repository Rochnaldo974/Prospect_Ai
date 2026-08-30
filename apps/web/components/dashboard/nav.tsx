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
  ['/dashboard', 'Ce matin'],
  ['/dashboard/suivi', 'À relancer'],
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 text-sm">
      {TABS.map(([href, label]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-3.5 border-b-2 pb-3.5 transition-colors ${
              active
                ? 'border-[var(--brand)] font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
