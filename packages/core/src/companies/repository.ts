import type { Db } from '../db/client';
import type { Database } from '../db/database.types';
import { PAGE_SIZE, type CompanyFilters } from './filters';

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
  let query = db
    .from('admin_company_overview')
    .select('*', { count: 'exact' });

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

  if (filters.assigned === 'yes') query = query.not('assigned_user_id', 'is', null);
  if (filters.assigned === 'no') query = query.is('assigned_user_id', null);

  if (filters.cooldown === 'yes') query = query.eq('in_cooldown', true);
  if (filters.cooldown === 'no') query = query.eq('in_cooldown', false);

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

export async function getFilterOptions(db: Db): Promise<FilterOptions> {
  const [cities, industries, sources] = await Promise.all([
    db.from('companies').select('city').not('city', 'is', null).limit(5000),
    db.from('companies').select('industry_code, industry_label').not('industry_code', 'is', null).limit(5000),
    db.from('company_sources').select('source_name').limit(5000),
  ]);

  const uniqueIndustries = new Map<string, string>();
  for (const row of industries.data ?? []) {
    if (row.industry_code) uniqueIndustries.set(row.industry_code, row.industry_label ?? row.industry_code);
  }

  return {
    cities: [...new Set((cities.data ?? []).map((r) => r.city).filter((c): c is string => !!c))].sort(),
    industries: [...uniqueIndustries.entries()]
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    sources: [...new Set((sources.data ?? []).map((r) => r.source_name))].sort(),
  };
}

// ─── Compteurs de la vue d'ensemble ─────────────────────────────────────────

export type AdminStats = Database['public']['Views']['admin_stats']['Row'];
export type InventoryRow = Database['public']['Views']['admin_inventory']['Row'];

export async function getAdminStats(db: Db): Promise<AdminStats | null> {
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
