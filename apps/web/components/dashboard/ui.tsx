import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Les pièces du poste de travail.
 *
 * Une page du tableau de bord se compose toujours de la même façon : un
 * en-tête bas, une grille de relevés, un corps large et un rail de contexte
 * à droite qui tient la page pleine. Ces pièces portent cette grammaire ;
 * les pages n'ont plus qu'à dire ce qu'elles mettent dedans.
 */

/** L'en-tête : un surtitre mono, un titre serré, une phrase, et la place pour agir à droite. */
export function PageHeader({
  eyebrow, title, lead, actions,
}: {
  eyebrow?: ReactNode | undefined;
  title: ReactNode;
  lead?: ReactNode | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
        {lead ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/** La grille à deux colonnes : le corps, et le rail qui le tient. */
export function Workspace({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <div className={`mt-6 grid gap-6 ${rail ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
      <div className="min-w-0 space-y-6">{children}</div>
      {rail ? <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">{rail}</aside> : null}
    </div>
  );
}

/** Un panneau : bord fin, fond blanc, un titre qui dit ce qu'il contient. */
export function Panel({
  title, eyebrow, aside, children, className = '', padded = true, tone = 'default',
}: {
  title?: ReactNode | undefined;
  eyebrow?: ReactNode | undefined;
  aside?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  padded?: boolean | undefined;
  tone?: 'default' | 'brand' | 'finding' | undefined;
}) {
  const tones = {
    default: 'border-[var(--line)] bg-card',
    brand: 'border-[var(--brand)]/25 bg-[var(--brand-wash)]',
    finding: 'border-[var(--finding)]/25 bg-[var(--finding-wash)]',
  } as const;
  return (
    <section className={`panel rounded-xl border ${tones[tone]} ${className}`}>
      {title || eyebrow || aside ? (
        <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${padded ? 'px-5 pt-4' : 'px-5 pt-4'}`}>
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
          </div>
          {aside ? <div className="text-xs text-muted-foreground">{aside}</div> : null}
        </div>
      ) : null}
      <div className={padded ? 'px-5 pb-5 pt-3' : ''}>{children}</div>
    </section>
  );
}

/**
 * Un relevé : le nombre en mono, son libellé, et ce qui l'explique.
 * La teinte ne parle que quand elle dit quelque chose.
 */
export function Kpi({
  label, value, hint, href, tone = 'default', delta, unit,
}: {
  label: string;
  value: number | string;
  hint?: ReactNode | undefined;
  href?: string | undefined;
  tone?: 'default' | 'brand' | 'urgent' | 'won' | 'muted' | 'finding' | undefined;
  delta?: number | null | undefined;
  unit?: string | undefined;
}) {
  const color = {
    default: 'text-foreground',
    brand: 'text-[var(--brand)]',
    urgent: 'text-[var(--warning)]',
    won: 'text-[var(--success)]',
    finding: 'text-[var(--finding)]',
    muted: 'text-muted-foreground/45',
  }[tone];
  const body = (
    <>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`tabular font-mono text-[26px] font-medium leading-none ${color}`}>
          {value}
          {unit ? <span className="ml-0.5 text-sm text-muted-foreground">{unit}</span> : null}
        </p>
        {delta !== undefined && delta !== null ? (
          <span className={`tabular font-mono text-[11px] ${delta > 0 ? 'text-[var(--success)]' : delta < 0 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
            {delta > 0 ? `↗ +${delta}` : delta < 0 ? `↘ ${delta}` : '—'}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </>
  );
  const base = 'block rounded-xl border border-[var(--line)] bg-card px-4 py-3.5';
  return href ? (
    <Link href={href} className={`${base} group transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_12px_28px_-18px_rgba(11,13,20,.35)]`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** Une pastille de sens : type, palier, état. */
export function Chip({
  children, tone = 'neutral', title, mono = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'finding' | 'success' | 'warning' | 'outline' | undefined;
  title?: string | undefined;
  mono?: boolean | undefined;
}) {
  const tones = {
    neutral: 'bg-[var(--mist)] text-muted-foreground',
    brand: 'bg-[var(--brand-wash)] text-[var(--brand)]',
    finding: 'bg-[var(--finding-wash)] text-[var(--finding)]',
    success: 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]',
    warning: 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]',
    outline: 'border border-[var(--line)] bg-card text-muted-foreground',
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none ${mono ? 'font-mono text-[11px]' : ''} ${tones}`}>
      {children}
    </span>
  );
}

/** Une barre de proportion, fine, avec sa valeur. */
export function Bar({
  label, value, max, color = 'var(--brand)', suffix,
}: {
  label: ReactNode;
  value: number;
  max: number;
  color?: string | undefined;
  suffix?: ReactNode | undefined;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[12px]">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="tabular font-mono text-[11px] text-foreground">{value}{suffix}</span>
      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[var(--mist)]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/** L'anneau d'avancement : ce qui est fait sur ce qui est arrivé. */
export function ProgressRing({
  done, total, size = 64, label,
}: {
  done: number;
  total: number;
  size?: number;
  label?: ReactNode;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? done / total : 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${done} sur ${total}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={ratio >= 1 ? 'var(--success)' : 'var(--brand)'} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-700"
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-[var(--ink)] font-mono text-[13px] font-medium">
          {done}/{total}
        </text>
      </svg>
      {label ? <div className="text-sm text-muted-foreground">{label}</div> : null}
    </div>
  );
}

/** Un état vide qui dit quoi faire, sans dramatiser. */
export function EmptyPanel({
  title, explanation, action, children,
}: {
  title: string;
  explanation: string;
  action?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-dashed border-[var(--line)] bg-card px-6 py-10 text-center">
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{explanation}</p>
      {children}
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
        >
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

/** +33241888198 se lit mal ; 02 41 88 81 98 se compose. */
export function formatPhone(phone: string): string {
  const french = phone.replace(/^\+33/, '0').replace(/\s/g, '');
  return /^0\d{9}$/.test(french) ? french.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : phone;
}

/** « 2 j 4 h », « 9 h », « expiré ». */
export function formatHoursLeft(hoursLeft: number): string {
  if (hoursLeft <= 0) return 'expiré';
  return hoursLeft >= 24 ? `${Math.floor(hoursLeft / 24)} j ${hoursLeft % 24} h` : `${hoursLeft} h`;
}
