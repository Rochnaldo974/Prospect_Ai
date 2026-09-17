-- Le rapprochement approché ne parcourt pas un arrondissement entier : sur la
-- base hébergée, un code postal à plus de dix mille établissements dépassait le
-- délai d'une requête. Au-delà de quatre mille établissements actifs, on ne
-- tranche pas — une zone aussi dense est de toute façon ambiguë.

create or replace function public.match_company_to_sirene_fuzzy(p_company_id uuid, p_min_similarity real default 0.72)
returns table (siret text, siren text, naf_code text, creation_date date, is_head_office boolean, similarity real, candidates integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with c as (
    select name_key, postal_code from public.companies where id = p_company_id
  ),
  density as (
    select count(*) as n from public.sirene_reference r, c
    where r.postal_code = c.postal_code and r.active and r.diffusible
  ),
  local_units as (
    select r.siret, r.siren, r.naf_code, r.creation_date, r.is_head_office, r.name_key as storefront_key
    from public.sirene_reference r, c, density
    where length(c.name_key) >= 6 and density.n <= 4000
      and r.postal_code = c.postal_code and r.active and r.diffusible
  ),
  found as (
    select l.siret, l.siren, l.naf_code, coalesce(l.creation_date, u.creation_date) as creation_date, l.is_head_office,
      greatest(
        case when l.storefront_key <> '' then extensions.similarity(l.storefront_key, c.name_key) else 0 end,
        case when u.name_key is not null and u.name_key <> '' then extensions.similarity(u.name_key, c.name_key) else 0 end
      ) as sim
    from local_units l
    cross join c
    left join public.sirene_units u on u.siren = l.siren and u.active and u.diffusible
  ),
  strong as (
    select * from found where sim >= p_min_similarity
  )
  select s.siret, s.siren, s.naf_code, s.creation_date, s.is_head_office, s.sim, (select count(*)::integer from strong)
  from strong s
  where (select count(distinct siren) from strong) = 1
  order by s.sim desc, s.is_head_office desc
  limit 1;
$$;
