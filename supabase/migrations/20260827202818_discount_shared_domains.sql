-- ═══════════════════════════════════════════════════════════════════════════
-- Un domaine partagé par plusieurs entreprises n'identifie rien.
--
-- Constaté sur les données réelles d'Angers : deux magasins Biocoop distants
-- de deux kilomètres obtenaient 0,78 parce qu'ils partagent biocoop.fr. Le
-- domaine pesait 0,25 alors qu'il ne prouvait qu'une appartenance au même
-- réseau — exactement ce qu'il ne faut pas confondre avec une identité.
--
-- Le poids du domaine devient donc dégressif : plein quand il désigne une
-- seule autre entreprise, nul dès qu'il en désigne plusieurs.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.find_duplicate_candidates(
  target_id uuid,
  min_score numeric default 0.70,
  max_results integer default 20
)
returns table (candidate_id uuid, score numeric, evidence jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  lat_delta double precision;
  lon_delta double precision;
  domain_holders integer;
begin
  select * into t from public.companies where id = target_id;
  if not found then return; end if;

  lat_delta := 0.00135;
  lon_delta := case
    when t.lat is null then null
    else 0.00135 / greatest(cos(radians(t.lat)), 0.2)
  end;

  -- Combien d'entreprises revendiquent ce domaine ? Au-delà de deux, c'est
  -- l'enseigne d'un réseau, pas le site d'un établissement.
  select count(*) into domain_holders
  from public.companies where t.domain is not null and domain = t.domain;

  return query
  with blocked as (
    select c.id from public.companies c
    where t.phone is not null and c.phone = t.phone and c.id <> t.id

    union
    select c.id from public.companies c
    where t.postal_code is not null and t.name_key is not null
      and c.postal_code = t.postal_code
      and c.name_key operator(extensions.%) t.name_key
      and c.id <> t.id

    union
    select c.id from public.companies c
    where t.lat is not null and t.name_key is not null
      and c.lat between t.lat - lat_delta and t.lat + lat_delta
      and c.lon between t.lon - lon_delta and t.lon + lon_delta
      and c.name_key operator(extensions.%) t.name_key
      and c.id <> t.id

    union
    select c.id from public.companies c
    where t.address is not null and t.postal_code is not null
      and c.address = t.address and c.postal_code = t.postal_code
      and c.id <> t.id
  ),
  scored as (
    select
      c.id,
      (c.siret is not null and t.siret is not null and c.siret <> t.siret) as siret_conflict,
      (c.siren is not null and t.siren is not null and c.siren <> t.siren) as siren_conflict,
      (c.phone is not null and c.phone = t.phone)                as phone_match,
      coalesce(extensions.similarity(c.name_key, t.name_key), 0) as name_similarity,
      (c.postal_code is not null and c.postal_code = t.postal_code) as postal_match,
      (c.address is not null and c.address = t.address)          as address_match,
      (c.domain is not null and c.domain = t.domain)             as domain_match,
      (c.industry_code is not null and c.industry_code = t.industry_code) as industry_match,
      public.geo_distance_m(c.lat, c.lon, t.lat, t.lon)          as distance_m
    from public.companies c
    join blocked b on b.id = c.id
  ),
  weighted as (
    select
      s.*,
      least(1.0,
          case when s.phone_match then 0.45 else 0 end
        + power(s.name_similarity, 2) * 0.45
        + case when s.postal_match then 0.08 else 0 end
        + case when s.address_match then 0.20 else 0 end
        -- Poids dégressif : un domaine porté par trois entreprises ou plus
        -- désigne un réseau et ne prouve aucune identité.
        + case when s.domain_match and domain_holders <= 2 then 0.25 else 0 end
        + case when s.industry_match then 0.05 else 0 end
        + case
            when s.distance_m is null then 0
            when s.distance_m < 30 then 0.25
            when s.distance_m < 150 then 0.10
            else 0
          end
      )::numeric(4,3) as raw_score
    from scored s
  )
  select
    w.id,
    w.raw_score,
    jsonb_build_object(
      'phone', w.phone_match,
      'name_similarity', round(w.name_similarity::numeric, 3),
      'postal', w.postal_match,
      'address', w.address_match,
      'domain', w.domain_match,
      'domain_shared_by', domain_holders,
      'industry', w.industry_match,
      'distance_m', round(w.distance_m::numeric, 0)
    )
  from weighted w
  where not w.siret_conflict
    and not w.siren_conflict
    and w.raw_score >= min_score
  order by w.raw_score desc
  limit max_results;
end;
$$;

revoke execute on function public.find_duplicate_candidates(uuid, numeric, integer) from public;
grant execute on function public.find_duplicate_candidates(uuid, numeric, integer) to service_role;
