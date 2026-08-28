-- ═══════════════════════════════════════════════════════════════════════════
-- Contexte de détection, chargé en une requête.
--
-- Un détecteur a besoin de l'entreprise, de son site et de ses événements
-- récents. Les charger séparément ferait trois allers-retours par entreprise ;
-- sur un passage nocturne de plusieurs centaines de milliers de lignes, c'est
-- la différence entre quelques minutes et plusieurs heures.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.load_signal_context(
  p_company_ids uuid[],
  p_event_window_days integer default 180
)
returns table (
  company               public.companies,
  domain                public.domains,
  domain_company_count  integer,
  events                jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c,
    d,
    coalesce(dc.count, 0)::integer,
    coalesce(ev.events, '[]'::jsonb)
  from public.companies c
  left join public.domains d on d.domain = c.domain
  left join lateral (
    -- Combien d'établissements revendiquent ce site. Au-delà d'un, c'est un
    -- réseau : le site n'appartient pas au point de vente.
    select count(*)::integer as count
    from public.companies sibling
    where c.domain is not null and sibling.domain = c.domain
  ) dc on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'importance', e.importance,
        'confidence', e.confidence,
        'occurred_at', coalesce(e.occurred_at, e.detected_at),
        'detected_at', e.detected_at
      )
      order by coalesce(e.occurred_at, e.detected_at) desc
    ) as events
    from public.company_events e
    where e.company_id = c.id
      and e.detected_at >= now() - make_interval(days => p_event_window_days)
  ) ev on true
  where c.id = any(p_company_ids);
$$;

comment on function public.load_signal_context is
  'Charge en une requête tout ce dont les détecteurs ont besoin : entreprise, site partagé, événements datés récents.';

/**
 * Sélectionne les entreprises à examiner.
 *
 * Priorité à ce qui a bougé : une entreprise dont rien n'a changé depuis le
 * dernier passage produira les mêmes signaux. Les réexaminer toutes chaque
 * nuit serait du travail perdu.
 */
create or replace function public.companies_needing_signals(
  p_limit integer default 1000,
  p_since timestamptz default null
)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.companies c
  where c.prospecting_allowed
    and not c.suppression_global
    and c.company_status <> 'closed'
    and (
      p_since is null
      or c.updated_at >= p_since
      -- Un événement récent change le contexte même si l'entreprise n'a pas bougé.
      or exists (
        select 1 from public.company_events e
        where e.company_id = c.id and e.detected_at >= p_since
      )
      -- Un site rescanné aussi.
      or exists (
        select 1 from public.domains d
        where d.domain = c.domain and d.last_checked_at >= p_since
      )
    )
  order by c.active_signal_count asc, c.updated_at desc
  limit p_limit;
$$;

revoke execute on function public.load_signal_context(uuid[], integer) from public;
revoke execute on function public.companies_needing_signals(integer, timestamptz) from public;
grant execute on function public.load_signal_context(uuid[], integer) to service_role;
grant execute on function public.companies_needing_signals(integer, timestamptz) to service_role;
