import type { Db } from '../db/client';
import type { Database } from '../db/database.types';
import { hasActiveFilters, PAGE_SIZE, type CompanyFilters } from './filters';

export type CompanyOverviewRow = Database['public']['Views']['admin_company_overview']['Row'];

export interface CompanyListResult {
  rows: CompanyOverviewRow[];
  total: number;
  page: number;
  pageCount: number;
}

const SORTS: Record<
  CompanyFilters['sort'],
  { column: string; ascending: boolean; nullsFirst: boolean }
> = {
  score:   { column: 'best_opportunity_score', ascending: false, nullsFirst: false },
  recent:  { column: 'created_at',             ascending: false, nullsFirst: false },
  name:    { column: 'legal_name',             ascending: true,  nullsFirst: false },
  signals: { column: 'active_signal_count',    ascending: false, nullsFirst: false },
  scan:    { column: 'last_scanned_at',        ascending: true,  nullsFirst: true  },
};

/**
 * Liste paginée des entreprises pour la console admin.
 *
 * Lit `admin_company_overview` : tous les agrégats (signaux, sources,
 * opportunités, attribution, cooldown) sont déjà calculés côté base.
 */
export async function listCompanies(
  db: Db,
  filters: CompanyFilters,
): Promise<CompanyListResult> {
  // Comptage estimé quand aucun filtre n'est actif : sur une table de plusieurs
  // millions de lignes, un count(*) exact coûte plus cher que la page elle-même,
  // pour une information dont personne n'a besoin au chiffre près.
  const countMode = hasActiveFilters(filters) ? 'exact' : 'estimated';

  let query = db
    .from('admin_company_overview')
    .select('*', { count: countMode });

  if (filters.q) {
    // Échappe les caractères significatifs de la syntaxe `or` de PostgREST.
    const term = filters.q.replace(/[,()]/g, ' ').trim();
    if (term) {
      query = query.or(
        [
          `legal_name.ilike.*${term}*`,
          `commercial_name.ilike.*${term}*`,
          `domain.ilike.*${term}*`,
          `city.ilike.*${term}*`,
          `siren.ilike.${term}*`,
        ].join(','),
      );
    }
  }

  if (filters.segment) query = query.eq('segment', filters.segment);
  if (filters.city) query = query.ilike('city', filters.city);
  if (filters.industry) query = query.eq('industry_code', filters.industry);
  if (filters.source) query = query.contains('source_names', [filters.source]);
  if (filters.opportunity) query = query.eq('best_opportunity_type', filters.opportunity);

  if (filters.website === 'with') query = query.not('domain', 'is', null);
  if (filters.website === 'without') query = query.is('domain', null);

  if (filters.contact === 'with') query = query.eq('has_contact', true);
  if (filters.contact === 'without') query = query.eq('has_contact', false);

  // Colonnes dénormalisées et indexées, plutôt qu'un test sur une jointure.
  if (filters.assigned === 'yes') query = query.eq('has_live_assignment', true);
  if (filters.assigned === 'no') query = query.eq('has_live_assignment', false);

  // La vue expose la colonne dénormalisée sous le nom `cooldown_ends_at`.
  if (filters.cooldown === 'yes') query = query.not('cooldown_ends_at', 'is', null);
  if (filters.cooldown === 'no') query = query.is('cooldown_ends_at', null);

  if (filters.prospectable === 'yes') {
    query = query.eq('prospecting_allowed', true).eq('suppression_global', false);
  }
  if (filters.prospectable === 'no') {
    query = query.or('prospecting_allowed.eq.false,suppression_global.eq.true');
  }

  if (filters.minScore !== undefined) {
    query = query.gte('best_opportunity_score', filters.minScore);
  }
  if (filters.minConfidence !== undefined) {
    query = query.gte('identity_confidence', filters.minConfidence);
  }

  const sort = SORTS[filters.sort];
  const from = (filters.page - 1) * PAGE_SIZE;

  const { data, error, count } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst })
    .order('id', { ascending: true }) // départage : pagination stable
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw new Error(`listCompanies : ${error.message}`);

  const total = count ?? 0;
  return {
    rows: data ?? [],
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ─── Détail d'une entreprise ─────────────────────────────────────────────────

export interface CompanyDetail {
  company: Database['public']['Tables']['companies']['Row'];
  overview: CompanyOverviewRow | null;
  sources: Database['public']['Tables']['company_sources']['Row'][];
  provenance: Database['public']['Tables']['company_field_provenance']['Row'][];
  snapshots: Database['public']['Tables']['website_snapshots']['Row'][];
  events: Database['public']['Tables']['company_events']['Row'][];
  signals: Database['public']['Tables']['signals']['Row'][];
  opportunities: Database['public']['Tables']['opportunities']['Row'][];
  assignments: Database['public']['Tables']['assignments']['Row'][];
  cooldowns: Database['public']['Tables']['company_cooldowns']['Row'][];
}

/**
 * Dossier complet d'une entreprise.
 *
 * Toutes les requêtes partent en parallèle : ce sont neuf lectures indépendantes
 * sur des index, les enchaîner n'apporterait rien.
 */
export async function getCompanyDetail(db: Db, id: string): Promise<CompanyDetail | null> {
  const [
    company, overview, sources, provenance,
    snapshots, events, signals, opportunities, assignments, cooldowns,
  ] = await Promise.all([
    db.from('companies').select('*').eq('id', id).maybeSingle(),
    db.from('admin_company_overview').select('*').eq('id', id).maybeSingle(),
    db.from('company_sources').select('*').eq('company_id', id).order('discovered_at', { ascending: false }),
    db.from('company_field_provenance').select('*').eq('company_id', id).order('confidence', { ascending: false }),
    db.from('website_snapshots').select('*').eq('company_id', id).order('captured_at', { ascending: false }).limit(20),
    db.from('company_events').select('*').eq('company_id', id).order('detected_at', { ascending: false }).limit(50),
    db.from('signals').select('*').eq('company_id', id).order('detected_at', { ascending: false }),
    db.from('opportunities').select('*').eq('company_id', id).order('base_score', { ascending: false }),
    db.from('assignments').select('*').eq('company_id', id).order('assigned_at', { ascending: false }),
    db.from('company_cooldowns').select('*').eq('company_id', id).order('starts_at', { ascending: false }),
  ]);

  if (company.error) throw new Error(`getCompanyDetail : ${company.error.message}`);
  if (!company.data) return null;

  return {
    company: company.data,
    overview: overview.data,
    sources: sources.data ?? [],
    provenance: provenance.data ?? [],
    snapshots: snapshots.data ?? [],
    events: events.data ?? [],
    signals: signals.data ?? [],
    opportunities: opportunities.data ?? [],
    assignments: assignments.data ?? [],
    cooldowns: cooldowns.data ?? [],
  };
}

// ─── Valeurs disponibles pour les listes déroulantes de filtres ──────────────

export interface FilterOptions {
  cities: string[];
  industries: { code: string; label: string }[];
  sources: string[];
}

/**
 * Valeurs proposées dans les filtres.
 *
 * Lues depuis la vue matérialisée : la version précédente chargeait 5 000
 * lignes de companies et autant de company_sources à chaque affichage pour
 * alimenter trois menus déroulants.
 */
export async function getFilterOptions(db: Db): Promise<FilterOptions> {
  const { data, error } = await db
    .from('admin_filter_options')
    .select('kind, code, label')
    .order('usage_count', { ascending: false })
    .limit(3000);

  if (error) throw new Error(`getFilterOptions : ${error.message}`);

  const cities: string[] = [];
  const industries: { code: string; label: string }[] = [];
  const sources: string[] = [];

  for (const row of data ?? []) {
    if (!row.code) continue;
    if (row.kind === 'city') cities.push(row.code);
    else if (row.kind === 'industry') industries.push({ code: row.code, label: row.label ?? row.code });
    else if (row.kind === 'source') sources.push(row.code);
  }

  return {
    cities: cities.sort((a, b) => a.localeCompare(b, 'fr')),
    industries: industries.sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    sources: sources.sort(),
  };
}

// ─── Compteurs de la vue d'ensemble ─────────────────────────────────────────

export type AdminStats = Database['public']['Views']['admin_stats']['Row'];
export type InventoryRow = Database['public']['Views']['admin_inventory']['Row'];

/**
 * Compteurs de la vue d'ensemble.
 *
 * Lus dans le cache précalculé. En cas d'absence — juste après une migration,
 * avant le premier rafraîchissement — on retombe sur le calcul direct plutôt
 * que d'afficher une page vide.
 */
export async function getAdminStats(
  db: Db,
): Promise<(AdminStats & { computed_at?: string | null }) | null> {
  const cached = await db.from('admin_stats_cache').select('*').maybeSingle();
  if (!cached.error && cached.data) return cached.data;

  const { data, error } = await db.from('admin_stats').select('*').maybeSingle();
  if (error) throw new Error(`getAdminStats : ${error.message}`);
  return data;
}

export async function getInventory(db: Db): Promise<InventoryRow[]> {
  const { data, error } = await db
    .from('admin_inventory')
    .select('*')
    .order('available', { ascending: false });
  if (error) throw new Error(`getInventory : ${error.message}`);
  return data ?? [];
}
