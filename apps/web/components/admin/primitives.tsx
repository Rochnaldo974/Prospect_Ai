import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Un compteur de la vue d'ensemble.
 *
 * Le chiffre est en chasse fixe : ces cartes se lisent en colonne, et des
 * chiffres de largeurs différentes se comparent mal. L'intitulé passe en
 * étiquette de marge, comme partout ailleurs dans le produit.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  tone?: 'default' | 'warning' | 'danger' | undefined;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:border-[var(--rule)]">
      <p className="field-label">{label}</p>
      <p
        className={cn(
          'tabular mt-1.5 text-[1.75rem] font-semibold leading-none tracking-tight',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Score sur 100, coloré par palier.
 *
 * Les seuils correspondent au quality gate : sous 55, l'opportunité n'entre
 * pas en stock — la lecture visuelle doit refléter la règle métier.
 */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const value = Math.round(score);
  return (
    <span
      className={cn(
        'tabular inline-flex min-w-11 justify-center rounded border px-1.5 py-0.5 font-mono text-xs',
        // Les seuils suivent le quality gate : sous 55 l'opportunité n'entre
        // pas en stock, et la lecture visuelle doit refléter la règle.
        value >= 75 && 'border-[var(--verified)]/30 bg-[var(--verified)]/10 text-[var(--verified)]',
        value >= 55 && value < 75 && 'border-[var(--caution)]/30 bg-[var(--caution)]/10 text-[var(--caution)]',
        value < 55 && 'border-transparent bg-muted text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-4',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'danger' && 'bg-destructive/15 text-destructive',
        tone === 'info' && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Bloc de section pour la fiche entreprise.
 *
 * Le compteur vit à droite du titre, en chasse fixe : dans une fiche qui en
 * empile huit, c'est lui qu'on parcourt pour savoir où regarder.
 */
export function Section({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  empty?: string;
}) {
  const isEmpty = count === 0;
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="field-label">{title}</h2>
        {count !== undefined ? (
          <span className="tabular font-mono text-xs text-muted-foreground">{count}</span>
        ) : null}
      </header>
      <div className="p-4">
        {isEmpty && empty ? (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Paire libellé / valeur, pour les blocs d'identité. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeDays(value: string | null): string {
  if (!value) return '—';
  const days = Math.round((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 0) return `dans ${-days} j`;
  return `il y a ${days} j`;
}

/**
 * Nombre en colonne. Une valeur nulle reste neutre : colorer les zéros en
 * rouge crée un bruit visuel qui masque les vrais problèmes.
 */
export function Count({
  value,
  tone = 'neutral',
}: {
  value: number | null;
  tone?: 'neutral' | 'muted' | 'success' | 'danger';
}) {
  const n = value ?? 0;
  return (
    <span
      className={cn(
        'tabular-nums',
        n === 0 && 'text-muted-foreground',
        n > 0 && tone === 'success' && 'text-success',
        n > 0 && tone === 'danger' && 'font-medium text-destructive',
        n > 0 && tone === 'muted' && 'text-muted-foreground',
      )}
    >
      {n}
    </span>
  );
}
