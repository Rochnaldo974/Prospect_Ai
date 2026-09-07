import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS, countActiveFilters, distinctCities, filterHistory,
  type HistoryItem,
} from '../../apps/web/lib/history-filter';

/**
 * Le filtrage de l'historique.
 *
 * Chaque filtre se teste seul, puis combinés : un dossier doit passer TOUS
 * les filtres actifs pour rester. La recherche ignore les accents — on
 * tape vite, on tape mal, on doit trouver quand même.
 */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const entry = (over: Partial<HistoryItem> & { assignmentId: string }): HistoryItem => ({
  outcome: 'no_response', outcomeAt: daysAgo(1), notes: null,
  type: 'website_redesign', company: { name: 'Boulangerie Test', city: 'Angers' },
  ...over,
});

const CORPUS: HistoryItem[] = [
  entry({ assignmentId: 'a', outcome: 'client', outcomeAt: daysAgo(2), notes: 'Signé — acompte reçu.', company: { name: 'Cabinet Véto Anjou', city: 'Angers' } }),
  entry({ assignmentId: 'b', outcome: 'not_interested', outcomeAt: daysAgo(10), type: 'ecommerce', company: { name: 'Fleuriste Océane', city: 'Nantes' } }),
  entry({ assignmentId: 'c', outcome: 'no_response', outcomeAt: daysAgo(45), company: { name: 'Garage du Port', city: 'Rennes' } }),
  entry({ assignmentId: 'd', outcome: 'no_response', outcomeAt: daysAgo(5), notes: 'Boîte vocale pleine.', company: { name: 'Studio Lumière', city: null } }),
];

const ids = (items: HistoryItem[]) => items.map((i) => i.assignmentId);

describe('filtrage de l’historique', () => {
  it('sans filtre, tout passe, du plus récent au plus ancien', () => {
    expect(ids(filterHistory(CORPUS, EMPTY_FILTERS))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('le tri s’inverse', () => {
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, sort: 'oldest' }))).toEqual(['c', 'b', 'd', 'a']);
  });

  it('les issues cochées se cumulent (OU logique)', () => {
    const kept = filterHistory(CORPUS, { ...EMPTY_FILTERS, outcomes: ['client', 'not_interested'] });
    expect(ids(kept)).toEqual(['a', 'b']);
  });

  it('la période coupe à la date de l’issue', () => {
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, periodDays: 7 }))).toEqual(['a', 'd']);
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, periodDays: 30 }))).toEqual(['a', 'd', 'b']);
  });

  it('la recherche ignore les accents et fouille les notes', () => {
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, search: 'veto' }))).toEqual(['a']);
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, search: 'vocale' }))).toEqual(['d']);
  });

  it('ville, type et note filtrent chacun', () => {
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, city: 'Nantes' }))).toEqual(['b']);
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, types: ['ecommerce'] }))).toEqual(['b']);
    expect(ids(filterHistory(CORPUS, { ...EMPTY_FILTERS, withNotesOnly: true }))).toEqual(['a', 'd']);
  });

  it('les filtres combinés exigent tout à la fois', () => {
    const kept = filterHistory(CORPUS, {
      ...EMPTY_FILTERS, outcomes: ['no_response'], periodDays: 7, withNotesOnly: true,
    });
    expect(ids(kept)).toEqual(['d']);
  });

  it('le compteur ne compte que les filtres actifs', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: ' x ', city: 'Angers', sort: 'oldest' })).toBe(2);
  });

  it('les villes distinctes ignorent les absentes et se trient', () => {
    expect(distinctCities(CORPUS)).toEqual(['Angers', 'Nantes', 'Rennes']);
  });
});
