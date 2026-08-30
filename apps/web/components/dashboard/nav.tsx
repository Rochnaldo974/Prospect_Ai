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

export function DashboardNav({ followUpCount = 0 }: { followUpCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 text-sm">
      {TABS.map(([href, label]) => {
        const active = pathname === href;
        const badge = href === '/dashboard/suivi' && followUpCount > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-3.5 flex items-center gap-1.5 border-b-2 pb-3.5 transition-colors ${
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
                {followUpCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
