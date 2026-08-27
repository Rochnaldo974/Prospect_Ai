import { z } from 'zod';

/**
 * Filtres de la console d'administration.
 *
 * Parsés depuis les paramètres d'URL : l'état de la liste est entièrement dans
 * l'adresse, donc partageable et rechargeable. `catch` partout — un paramètre
 * invalide doit dégrader vers la valeur par défaut, jamais faire planter la page.
 */
export const companyFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),

  segment: z
    .enum(['local_commerce', 'b2b', 'ecommerce', 'other'])
    .optional()
    .catch(undefined),
  city: z.string().trim().max(80).optional().catch(undefined),
  industry: z.string().trim().max(10).optional().catch(undefined),
  source: z.string().trim().max(40).optional().catch(undefined),

  website: z.enum(['with', 'without']).optional().catch(undefined),
  contact: z.enum(['with', 'without']).optional().catch(undefined),
  opportunity: z
    .enum([
      'website_creation', 'website_redesign', 'ecommerce', 'web_application',
      'mobile_application', 'ai_automation', 'seo', 'maintenance', 'other',
    ])
    .optional()
    .catch(undefined),

  assigned: z.enum(['yes', 'no']).optional().catch(undefined),
  cooldown: z.enum(['yes', 'no']).optional().catch(undefined),
  prospectable: z.enum(['yes', 'no']).optional().catch(undefined),

  minScore: z.coerce.number().min(0).max(100).optional().catch(undefined),
  minConfidence: z.coerce.number().min(0).max(1).optional().catch(undefined),

  sort: z
    .enum(['score', 'recent', 'name', 'signals', 'scan'])
    .default('score')
    .catch('score'),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

export const PAGE_SIZE = 50;

/** Vrai dès qu'un filtre autre que le tri et la pagination est actif. */
export function hasActiveFilters(filters: CompanyFilters): boolean {
  const { sort: _sort, page: _page, ...rest } = filters;
  return Object.values(rest).some((v) => v !== undefined && v !== '');
}

/** Sérialise les filtres en query string, en omettant les valeurs par défaut. */
export function filtersToSearchParams(
  filters: Partial<CompanyFilters>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === null) continue;
    if (key === 'sort' && value === 'score') continue;
    if (key === 'page' && value === 1) continue;
    params.set(key, String(value));
  }
  return params;
}
