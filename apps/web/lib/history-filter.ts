/**
 * Le filtrage de l'historique — pur, sans React, testable à sec.
 *
 * Les deux cents dossiers au plus sont déjà chargés : filtrer en mémoire
 * répond à la frappe sans un aller-retour serveur. Le jour où un compte
 * dépasse la limite, le filtre descendra dans la requête — pas avant.
 */

export interface HistoryItem {
  assignmentId: string;
  outcome: string;
  outcomeAt: string;
  notes: string | null;
  type: string;
  company: { name: string; city: string | null };
}

export interface HistoryFilters {
  /** Recherche libre : nom, ville, note. Insensible aux accents. */
  search: string;
  /** Issues cochées ; vide = toutes. */
  outcomes: string[];
  /** Types de mission cochés ; vide = tous. */
  types: string[];
  /** Fenêtre en jours ; null = depuis le début. */
  periodDays: number | null;
  /** Ville exacte ; null = toutes. */
  city: string | null;
  /** Ne garder que les dossiers annotés. */
  withNotesOnly: boolean;
  sort: 'recent' | 'oldest';
}

export const EMPTY_FILTERS: HistoryFilters = {
  search: '', outcomes: [], types: [], periodDays: null, city: null,
  withNotesOnly: false, sort: 'recent',
};

/** Minuscules et sans accents : « Véto » répond à « veto ». */
const fold = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function countActiveFilters(filters: HistoryFilters): number {
  return (
    (filters.search.trim() ? 1 : 0)
    + (filters.outcomes.length > 0 ? 1 : 0)
    + (filters.types.length > 0 ? 1 : 0)
    + (filters.periodDays !== null ? 1 : 0)
    + (filters.city !== null ? 1 : 0)
    + (filters.withNotesOnly ? 1 : 0)
  );
}

export function filterHistory(
  entries: HistoryItem[],
  filters: HistoryFilters,
  now = Date.now(),
): HistoryItem[] {
  const needle = fold(filters.search.trim());
  const cutoff = filters.periodDays === null
    ? null
    : now - filters.periodDays * 86_400_000;

  const kept = entries.filter((entry) => {
    if (filters.outcomes.length > 0 && !filters.outcomes.includes(entry.outcome)) return false;
    if (filters.types.length > 0 && !filters.types.includes(entry.type)) return false;
    if (cutoff !== null && new Date(entry.outcomeAt).getTime() < cutoff) return false;
    if (filters.city !== null && entry.company.city !== filters.city) return false;
    if (filters.withNotesOnly && !entry.notes) return false;
    if (needle) {
      const haystack = fold(
        `${entry.company.name} ${entry.company.city ?? ''} ${entry.notes ?? ''}`,
      );
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return kept.sort((a, b) => {
    const delta = new Date(b.outcomeAt).getTime() - new Date(a.outcomeAt).getTime();
    return filters.sort === 'recent' ? delta : -delta;
  });
}

/** Les villes présentes, triées, pour peupler le sélecteur. */
export function distinctCities(entries: HistoryItem[]): string[] {
  return [...new Set(entries.map((e) => e.company.city).filter((c): c is string => c !== null))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
}
