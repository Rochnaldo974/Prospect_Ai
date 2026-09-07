'use client';

import { useMemo, useState } from 'react';
import {
  EMPTY_FILTERS, countActiveFilters, distinctCities, filterHistory,
  type HistoryFilters, type HistoryItem,
} from '@/lib/history-filter';

/**
 * L'historique filtrable.
 *
 * Tous les filtres agissent à la frappe, en mémoire : issue, type de
 * mission, période, ville, notes, recherche libre, tri. La barre annonce
 * ce qu'elle a trouvé (« 12 dossiers sur 41 ») et un seul geste remet
 * tout à zéro — un filtre qu'on ne sait pas enlever est un piège.
 */
const OUTCOME_LABELS: Record<string, [string, boolean]> = {
  client: ['Client signé', true],
  proposal: ['Devis envoyé', true],
  meeting: ['Rendez-vous', true],
  interested: ['Intéressé', true],
  not_interested: ['Pas intéressé', false],
  no_response: ['Pas de réponse', false],
};

const PERIODS: Array<[number | null, string]> = [
  [7, '7 jours'], [30, '30 jours'], [90, '90 jours'], [null, 'Tout'],
];

export function HistoryList({
  entries,
  typeLabels,
}: {
  entries: HistoryItem[];
  typeLabels: Record<string, string>;
}) {
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);

  const cities = useMemo(() => distinctCities(entries), [entries]);
  const presentOutcomes = useMemo(
    () => Object.keys(OUTCOME_LABELS).filter((o) => entries.some((e) => e.outcome === o)),
    [entries],
  );
  const presentTypes = useMemo(
    () => [...new Set(entries.map((e) => e.type))],
    [entries],
  );

  const visible = useMemo(() => filterHistory(entries, filters), [entries, filters]);
  const active = countActiveFilters(filters);

  const toggle = (key: 'outcomes' | 'types', value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  return (
    <>
      <section className="mt-8 rounded-2xl border bg-card px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">⌕</span>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Entreprise, ville ou note…"
              className="w-full rounded-xl border bg-[var(--white)] py-2.5 pl-9 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[var(--brand)]/30"
            />
          </label>

          <select
            value={filters.city ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || null }))}
            className="rounded-xl border bg-[var(--white)] px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
          >
            <option value="">Toutes les villes</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>

          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, sort: f.sort === 'recent' ? 'oldest' : 'recent' }))}
            className="rounded-xl border bg-[var(--white)] px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {filters.sort === 'recent' ? 'Plus récents d’abord ↓' : 'Plus anciens d’abord ↑'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Issue</span>
          {presentOutcomes.map((outcome) => {
            const [label, positive] = OUTCOME_LABELS[outcome]!;
            const on = filters.outcomes.includes(outcome);
            return (
              <FilterPill key={outcome} on={on} accent={positive} onClick={() => toggle('outcomes', outcome)}>
                {label}
              </FilterPill>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Mission</span>
          {presentTypes.map((type) => (
            <FilterPill key={type} on={filters.types.includes(type)} onClick={() => toggle('types', type)}>
              {typeLabels[type] ?? type}
            </FilterPill>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Période</span>
          {PERIODS.map(([days, label]) => (
            <FilterPill
              key={label}
              on={filters.periodDays === days}
              onClick={() => setFilters((f) => ({ ...f, periodDays: days }))}
            >
              {label}
            </FilterPill>
          ))}
          <span className="mx-2 h-4 w-px bg-[var(--line)]" aria-hidden />
          <FilterPill
            on={filters.withNotesOnly}
            onClick={() => setFilters((f) => ({ ...f, withNotesOnly: !f.withNotesOnly }))}
          >
            Avec note
          </FilterPill>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <p className="font-mono text-[11px] text-muted-foreground">
            {visible.length === entries.length
              ? `${entries.length} ${entries.length > 1 ? 'dossiers' : 'dossier'}`
              : `${visible.length} ${visible.length > 1 ? 'dossiers' : 'dossier'} sur ${entries.length}`}
          </p>
          {active > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm text-[var(--brand)] transition-opacity hover:opacity-75"
            >
              Réinitialiser ({active})
            </button>
          ) : null}
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-card px-6 py-12 text-center">
          <p className="font-medium">Aucun dossier ne correspond</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Élargissez la période ou retirez un filtre.
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card">
          {visible.map((entry) => {
            const [label, positive] = OUTCOME_LABELS[entry.outcome] ?? [entry.outcome, false];
            return (
              <article key={entry.assignmentId} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-6">
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                    positive ? 'bg-[var(--brand-wash)] text-[var(--brand)]' : 'bg-[var(--mist)] text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {entry.company.name}
                    {entry.company.city ? (
                      <span className="font-normal text-muted-foreground"> · {entry.company.city}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {typeLabels[entry.type] ?? entry.type}
                    {entry.notes ? <> — {entry.notes}</> : null}
                  </p>
                </div>
                <time dateTime={entry.outcomeAt} className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(entry.outcomeAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </time>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterPill({
  on,
  accent = false,
  onClick,
  children,
}: {
  on: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        on
          ? accent
            ? 'border-transparent bg-[var(--brand)] font-medium text-white'
            : 'border-transparent bg-foreground font-medium text-[var(--white)]'
          : 'border-[var(--line)] bg-[var(--white)] text-muted-foreground hover:border-foreground/25 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
