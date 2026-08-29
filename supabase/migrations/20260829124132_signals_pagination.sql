-- Pagination de la sélection des entreprises à réévaluer.
--
-- Deux défauts se combinaient pour rendre la réévaluation impossible au-delà
-- de mille entreprises :
--
--   1. l'API tronque silencieusement toute réponse à mille lignes, y compris
--      celle d'une fonction — demander une limite plus haute ne servait à rien ;
--   2. l'ordre plaçait en dernier les entreprises ayant déjà des signaux, or ce
--      sont exactement celles dont un signal peut être devenu faux.
--
-- Conséquence observée : après reclassement de quatre-vingts domaines, les
-- signaux de panne correspondants sont restés actifs, faute d'être jamais
-- resélectionnés. Un signal qu'on ne réévalue pas est un signal qui ment.
create or replace function public.companies_needing_signals(
  p_limit integer default 1000,
  p_since timestamptz default null,
  p_offset integer default 0
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
  -- L'identifiant départage : sans ordre total, deux pages successives
  -- pourraient se recouvrir et en oublier autant.
  order by c.active_signal_count asc, c.updated_at desc, c.id
  limit p_limit
  offset p_offset;
$$;

revoke all on function public.companies_needing_signals(integer, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.companies_needing_signals(integer, timestamptz, integer) to service_role;
