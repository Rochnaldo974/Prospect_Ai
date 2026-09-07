'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Le menu latéral — la colonne vertébrale du produit connecté.
 *
 * Quatre entrées de travail dans l'ordre de la journée (ce qui arrive, ce
 * qu'on a différé, ce qu'on relance, ce qui est clos), puis le compte. Les
 * badges portent les nombres qui appellent une action ; l'historique n'en
 * a pas — un total n'est pas une tâche.
 *
 * Sous 1024 px, la colonne disparaît au profit de la barre horizontale :
 * même liste, autre forme, aucun tiroir à ouvrir.
 */
const WORK: Array<[string, string, string]> = [
  ['/dashboard', 'Aujourd’hui', 'jour'],
  ['/dashboard/plus-tard', 'Plus tard', 'snooze'],
  ['/dashboard/suivi', 'À relancer', 'relance'],
  ['/dashboard/historique', 'Historique', ''],
  ['/dashboard/statistiques', 'Statistiques', ''],
];

export function Sidebar({
  followUpCount = 0,
  snoozedCount = 0,
  plan = 'free',
  isAdmin = false,
  signOutAction,
}: {
  followUpCount?: number;
  snoozedCount?: number;
  plan?: 'free' | 'premium';
  isAdmin?: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const counts: Record<string, number> = { snooze: snoozedCount, relance: followUpCount };

  const isActive = (href: string) =>
    pathname === href
    || (href === '/dashboard' && pathname.startsWith('/dashboard/opportunite'));

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-[var(--white)] px-4 py-6 lg:flex">
      <Link href="/dashboard" className="px-3 text-lg font-semibold tracking-[-0.03em]">
        prospect<span className="text-[var(--brand)]">.ai</span>
      </Link>

      <nav className="mt-8 space-y-1">
        {WORK.map(([href, label, countKey]) => {
          const active = isActive(href);
          const count = counts[countKey] ?? 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-[var(--brand-wash)] font-medium text-[var(--brand)]'
                  : 'text-muted-foreground hover:bg-[var(--mist)] hover:text-foreground'
              }`}
            >
              {label}
              {count > 0 ? (
                <span
                  className={`tabular grid min-w-5 place-items-center rounded-full px-1 py-0.5 font-mono text-[10px] leading-none ${
                    active ? 'bg-[var(--brand)] text-white' : 'bg-[var(--mist)] text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {plan === 'free' ? (
        <Link
          href="/dashboard/abonnement"
          className="mt-6 block rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-wash)] px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <p className="text-sm font-medium text-[var(--brand)]">Passer en Solo</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--brand)]/75">
            5 dossiers par jour et l’e-mail prêt à envoyer.
          </p>
        </Link>
      ) : null}

      <div className="mt-auto space-y-1 border-t pt-4">
        <SecondaryLink href="/dashboard/abonnement" active={pathname === '/dashboard/abonnement'}>
          Abonnement
          {plan === 'premium' ? (
            <span className="rounded-full bg-[var(--brand-wash)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--brand)]">
              Solo
            </span>
          ) : null}
        </SecondaryLink>
        <SecondaryLink href="/dashboard/signature" active={pathname === '/dashboard/signature'}>
          Signature e-mail
        </SecondaryLink>
        <SecondaryLink href="/onboarding?modifier" active={false}>Préférences</SecondaryLink>
        {isAdmin ? <SecondaryLink href="/admin" active={false}>Admin</SecondaryLink> : null}
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-[var(--mist)] hover:text-foreground"
          >
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}

function SecondaryLink({
  href, active, children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-[var(--mist)] font-medium'
          : 'text-muted-foreground hover:bg-[var(--mist)] hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}
