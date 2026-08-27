'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { OPPORTUNITY_TYPE_LABELS, type FilterOptions } from '@prospect/core';
import { cn } from '@/lib/utils/cn';

/**
 * Barre de filtres.
 *
 * L'état vit entièrement dans l'URL : une vue filtrée est partageable et
 * survit à un rechargement. Chaque changement remet la pagination à 1 —
 * rester en page 7 après avoir restreint à 12 résultats n'a pas de sens.
 */
export function CompanyFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const currentQuery = searchParams.get('q') ?? '';

  const update = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    startTransition(() => {
      router.push(params.size ? `/admin/companies?${params}` : '/admin/companies');
    });
  };

  const value = (key: string) => searchParams.get(key) ?? '';
  const activeCount = [...searchParams.keys()].filter((k) => k !== 'sort' && k !== 'page').length;

  const selectClass =
    'h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className={cn('space-y-3', isPending && 'opacity-60')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get('q');
          update({ q: typeof value === 'string' && value.trim() ? value.trim() : undefined });
        }}
        className="flex gap-2"
      >
        {/* Non contrôlé, avec une clé dérivée de l'URL : le champ se réinitialise
            quand la recherche change côté serveur, sans effet de synchronisation. */}
        <input
          key={currentQuery}
          name="q"
          defaultValue={currentQuery}
          placeholder="Nom, domaine, ville, SIREN…"
          className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Rechercher
        </button>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.push('/admin/companies'))}
            className="h-9 rounded-md border border-input px-3 text-sm hover:bg-accent"
          >
            Réinitialiser ({activeCount})
          </button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        <select className={selectClass} value={value('website')} onChange={(e) => update({ website: e.target.value })}>
          <option value="">Site : tous</option>
          <option value="with">Avec site</option>
          <option value="without">Sans site</option>
        </select>

        <select className={selectClass} value={value('contact')} onChange={(e) => update({ contact: e.target.value })}>
          <option value="">Contact : tous</option>
          <option value="with">Joignable</option>
          <option value="without">Non joignable</option>
        </select>

        <select
          className={selectClass}
          value={value('opportunity')}
          onChange={(e) => update({ opportunity: e.target.value })}
        >
          <option value="">Opportunité : toutes</option>
          {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select className={selectClass} value={value('city')} onChange={(e) => update({ city: e.target.value })}>
          <option value="">Ville : toutes</option>
          {options.cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <select className={selectClass} value={value('industry')} onChange={(e) => update({ industry: e.target.value })}>
          <option value="">Activité : toutes</option>
          {options.industries.map((industry) => (
            <option key={industry.code} value={industry.code}>
              {industry.label}
            </option>
          ))}
        </select>

        <select className={selectClass} value={value('source')} onChange={(e) => update({ source: e.target.value })}>
          <option value="">Source : toutes</option>
          {options.sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>

        <select className={selectClass} value={value('assigned')} onChange={(e) => update({ assigned: e.target.value })}>
          <option value="">Attribution : toutes</option>
          <option value="yes">Attribuée</option>
          <option value="no">Non attribuée</option>
        </select>

        <select className={selectClass} value={value('cooldown')} onChange={(e) => update({ cooldown: e.target.value })}>
          <option value="">Cooldown : tous</option>
          <option value="yes">En cooldown</option>
          <option value="no">Hors cooldown</option>
        </select>

        <select
          className={selectClass}
          value={value('prospectable')}
          onChange={(e) => update({ prospectable: e.target.value })}
        >
          <option value="">Prospectable : tous</option>
          <option value="yes">Prospectable</option>
          <option value="no">Exclue</option>
        </select>

        <select className={selectClass} value={value('minScore')} onChange={(e) => update({ minScore: e.target.value })}>
          <option value="">Score : tous</option>
          <option value="55">≥ 55 (seuil du gate)</option>
          <option value="70">≥ 70</option>
          <option value="85">≥ 85</option>
        </select>

        <select className={selectClass} value={value('sort') || 'score'} onChange={(e) => update({ sort: e.target.value })}>
          <option value="score">Tri : score</option>
          <option value="recent">Tri : ajout récent</option>
          <option value="signals">Tri : signaux</option>
          <option value="scan">Tri : scan le plus ancien</option>
          <option value="name">Tri : nom</option>
        </select>
      </div>
    </div>
  );
}
