'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Le menu latéral — la colonne vertébrale du produit connecté.
 *
 * Deux groupes : le travail, dans l'ordre de la journée, puis le compte.
 * Chaque entrée a son signe, tracé au trait, et les badges ne portent que
 * les nombres qui appellent un geste. En bas, qui est connecté et sur quel
 * plan : un poste de travail dit à qui il appartient.
 */
const WORK: Array<[string, string, string, keyof typeof ICONS]> = [
  ['/dashboard', 'Aujourd’hui', 'jour', 'today'],
  ['/dashboard/plus-tard', 'Plus tard', 'snooze', 'later'],
  ['/dashboard/suivi', 'À relancer', 'relance', 'followup'],
  ['/dashboard/statistiques', 'Statistiques', '', 'stats'],
  ['/dashboard/historique', 'Historique', '', 'history'],
];

const ICONS = {
  today: <path d="M4 6.5h16M4 12h10M4 17.5h7" />,
  later: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
  followup: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5" />,
  stats: <path d="M4 19V11M10 19V5M16 19v-8M22 19H2" />,
  history: <path d="M5 5h14v14H5zM8 9.5h8M8 13h5" />,
  plan: <path d="M3 8l4-3h10l4 3-9 12z" />,
  signature: <path d="M4 18c3-6 6-6 8-2 2-6 4-6 8 0" />,
  prefs: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
  admin: <path d="M12 3l8 4v5c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7z" />,
  out: <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />,
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[17px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export function Sidebar({
  followUpCount = 0,
  snoozedCount = 0,
  plan = 'free',
  isAdmin = false,
  userName = '',
  userEmail = '',
  signOutAction,
}: {
  followUpCount?: number;
  snoozedCount?: number;
  plan?: 'free' | 'premium';
  isAdmin?: boolean;
  userName?: string;
  userEmail?: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const counts: Record<string, number> = { snooze: snoozedCount, relance: followUpCount };

  const isActive = (href: string) =>
    pathname === href
    || (href === '/dashboard' && pathname.startsWith('/dashboard/opportunite'));

  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '·';

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-[var(--white)] px-3 py-5 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-3 text-lg font-semibold tracking-[-0.03em]">
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--ink)] font-mono text-[11px] text-white">P</span>
        <span>prospect<span className="text-[var(--brand)]">.ai</span></span>
      </Link>

      <p className="eyebrow mt-7 px-3">Travail</p>
      <nav className="mt-2 space-y-0.5">
        {WORK.map(([href, label, countKey, icon]) => {
          const active = isActive(href);
          const count = counts[countKey] ?? 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                active
                  ? 'bg-[var(--brand-wash)] font-medium text-[var(--brand)]'
                  : 'text-muted-foreground hover:bg-[var(--mist)] hover:text-foreground'
              }`}
            >
              <Icon name={icon} />
              <span className="flex-1">{label}</span>
              {count > 0 ? (
                <span className={`tabular grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${active ? 'bg-[var(--brand)] text-white' : 'bg-[var(--mist)] text-foreground'}`}>
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <p className="eyebrow mt-7 px-3">Compte</p>
      <nav className="mt-2 space-y-0.5">
        <SecondaryLink href="/dashboard/abonnement" active={pathname === '/dashboard/abonnement'} icon="plan">
          Abonnement
          {plan === 'premium' ? (
            <span className="ml-auto rounded-full bg-[var(--brand-wash)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--brand)]">Solo</span>
          ) : null}
        </SecondaryLink>
        <SecondaryLink href="/dashboard/signature" active={pathname === '/dashboard/signature'} icon="signature">Signature e-mail</SecondaryLink>
        <SecondaryLink href="/onboarding?modifier" active={false} icon="prefs">Préférences</SecondaryLink>
        {isAdmin ? <SecondaryLink href="/admin" active={false} icon="admin">Admin</SecondaryLink> : null}
      </nav>

      {plan === 'free' ? (
        <Link
          href="/dashboard/abonnement"
          className="mt-6 block rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-wash)] px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <p className="text-[13px] font-medium text-[var(--brand)]">Passer en Solo</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--brand)]/75">5 dossiers par jour et l’e-mail prêt à envoyer.</p>
        </Link>
      ) : null}

      <div className="mt-auto border-t pt-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--mist)] font-mono text-[11px] font-medium">{initials}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{userName || 'Votre compte'}</p>
            <p className="truncate text-[11px] text-muted-foreground">{userEmail || (plan === 'premium' ? 'Plan Solo' : 'Plan gratuit')}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-[var(--mist)] hover:text-foreground">
            <Icon name="out" />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}

function SecondaryLink({
  href, active, icon, children,
}: {
  href: string;
  active: boolean;
  icon: keyof typeof ICONS;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
        active ? 'bg-[var(--mist)] font-medium text-foreground' : 'text-muted-foreground hover:bg-[var(--mist)] hover:text-foreground'
      }`}
    >
      <Icon name={icon} />
      {children}
    </Link>
  );
}
