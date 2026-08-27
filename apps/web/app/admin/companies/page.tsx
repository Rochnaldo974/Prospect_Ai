import type { Metadata } from 'next';
import Link from 'next/link';
import {
  companyFiltersSchema,
  filtersToSearchParams,
  getFilterOptions,
  listCompanies,
  OPPORTUNITY_TYPE_LABELS,
  PAGE_SIZE,
} from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import { CompanyFilters } from '@/components/admin/company-filters';
import { Pill, ScoreBadge, relativeDays } from '@/components/admin/primitives';

export const metadata: Metadata = { title: 'Entreprises' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const filters = companyFiltersSchema.parse(raw);

  const db = await getAdminDb();
  const [result, options] = await Promise.all([listCompanies(db, filters), getFilterOptions(db)]);

  const from = (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  const pageHref = (page: number) => {
    const params = filtersToSearchParams({ ...filters, page });
    return params.size ? `/admin/companies?${params}` : '/admin/companies';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entreprises</h1>
        <p className="text-sm text-muted-foreground">
          Tout ce que le moteur a collecté, avant tout filtrage produit.
        </p>
      </div>

      <CompanyFilters options={options} />

      <p className="text-sm text-muted-foreground tabular-nums">
        {result.total === 0
          ? 'Aucune entreprise ne correspond à ces critères.'
          : `${from}–${to} sur ${result.total.toLocaleString('fr-FR')}`}
      </p>

      {result.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Entreprise</th>
                <th className="px-3 py-2 font-medium">Ville</th>
                <th className="px-3 py-2 font-medium">Activité</th>
                <th className="px-3 py-2 font-medium">Site</th>
                <th className="px-3 py-2 font-medium">Sources</th>
                <th className="px-3 py-2 text-right font-medium">Signaux</th>
                <th className="px-3 py-2 font-medium">Opportunité</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 font-medium">État</th>
                <th className="px-3 py-2 font-medium">Scan</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="max-w-64 px-3 py-2">
                    <Link
                      href={`/admin/companies/${row.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {row.commercial_name ?? row.legal_name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.commercial_name ? row.legal_name : (row.siren ?? '—')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.city ?? '—'}
                    <span className="ml-1 text-xs tabular-nums opacity-60">{row.postal_code}</span>
                  </td>
                  <td className="max-w-44 truncate px-3 py-2 text-xs text-muted-foreground">
                    {row.industry_label ?? '—'}
                  </td>
                  <td className="max-w-52 px-3 py-2">
                    {row.domain ? (
                      <a
                        href={row.website_url ?? `https://${row.domain}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block truncate text-xs hover:underline"
                      >
                        {row.domain}
                      </a>
                    ) : (
                      <Pill tone="warning">aucun site</Pill>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {(row.source_names ?? []).map((source) => (
                        <Pill key={source}>{source}</Pill>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {row.active_signal_count ?? 0}
                    {(row.trigger_signal_count ?? 0) > 0 ? (
                      <span className="ml-1 text-xs text-success">↑{row.trigger_signal_count}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.best_opportunity_type
                      ? OPPORTUNITY_TYPE_LABELS[row.best_opportunity_type]
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ScoreBadge score={row.best_opportunity_score} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {row.suppression_global ? <Pill tone="danger">supprimée</Pill> : null}
                      {!row.prospecting_allowed ? <Pill tone="danger">non prospectable</Pill> : null}
                      {row.in_cooldown ? <Pill tone="warning">cooldown</Pill> : null}
                      {row.assigned_user_id ? <Pill tone="info">attribuée</Pill> : null}
                      {!row.has_contact ? <Pill>injoignable</Pill> : null}
                      {row.company_status === 'closed' ? <Pill tone="danger">fermée</Pill> : null}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {relativeDays(row.last_scanned_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <span className="tabular-nums text-muted-foreground">
            Page {result.page} sur {result.pageCount}
          </span>
          <span className="flex gap-2">
            {result.page > 1 ? (
              <Link
                href={pageHref(result.page - 1)}
                className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
              >
                Précédent
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={pageHref(result.page + 1)}
                className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
              >
                Suivant
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
