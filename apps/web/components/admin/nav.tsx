'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Les onglets de la console.
 *
 * La page courante porte un filet plein sous son intitulé. Sans ce repère, on
 * reclique sur le lien où l'on se trouve déjà en se demandant si la page a
 * changé — c'est la première chose qu'on remarque en travaillant vraiment dans
 * une console.
 */
export function AdminNav({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      {items.map((item) => {
        // La vue d'ensemble est un préfixe de tout le reste : elle exige une
        // correspondance exacte, les autres non.
        const active = item.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`relative py-1 transition-colors ${
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
            {active ? (
              <span
                aria-hidden
                className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-[var(--verified)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
