-- ═══════════════════════════════════════════════════════════════════════════
-- Recalibrage de la pondération, sur similarités mesurées.
--
-- Valeurs relevées sur des cas réels :
--
--   « BOULANGERIE MOREAU » / « Boulangerie Moreau SARL »   1,000
--   « Le Fournil de la Gare » / « Fournil de la Gare »     0,905
--   « GARAGE DUBOIS » / « GARAGE DUBOIS ET FILS »          0,636
--   « Carrefour City » / « Carrefour Market »              0,476
--   « BOULANGERIE MOREAU » / « GARAGE DUBOIS »             0,000
--
-- La zone dangereuse est 0,40 – 0,70 : c'est là que se trouvent les enseignes
-- d'un même réseau, qu'il ne faut surtout pas fusionner. Une pondération
-- linéaire leur accordait presque autant qu'à une correspondance franche.
--
-- Le carré de la similarité écrase cette zone tout en préservant le haut :
--   1,000 → 1,000     0,905 → 0,819     0,636 → 0,404     0,476 → 0,227
--
-- La proximité géographique est par ailleurs revalorisée : pour du commerce
-- local, deux relevés à moins de trente mètres portant un nom voisin sont
-- presque toujours le même point de vente.
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
begin
  select * into t from public.companies where id = target_id;
  if not found then return; end if;

  lat_delta := 0.00135;
  lon_delta := case
    when t.lat is null then null
    else 0.00135 / greatest(cos(radians(t.lat)), 0.2)
  end;

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
        -- Carré de la similarité : écrase la zone ambiguë des enseignes de réseau.
        + power(s.name_similarity, 2) * 0.45
        + case when s.postal_match then 0.08 else 0 end
        + case when s.address_match then 0.20 else 0 end
        + case when s.domain_match then 0.25 else 0 end
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
