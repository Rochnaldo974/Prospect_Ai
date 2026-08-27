-- ═══════════════════════════════════════════════════════════════════════════
-- Détection des doublons : blocage puis pondération.
-- ═══════════════════════════════════════════════════════════════════════════

/** Distance en mètres entre deux points, formule de haversine. */
create or replace function public.geo_distance_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  end;
$$;

/**
 * Candidats au rapprochement pour une entreprise donnée.
 *
 * Le blocage précède toute comparaison : sans lui, rapprocher 3 millions de
 * lignes demanderait 4,5 × 10¹² comparaisons. Quatre voisinages étroits,
 * chacun appuyé sur un index :
 *
 *   téléphone identique · code postal + similarité de nom ·
 *   proximité géographique + similarité de nom · adresse identique
 *
 * Chaque indice apporte des points ; aucun ne décide seul. Le nom seul ne
 * vaut rien — « Boulangerie Martin » existe dans chaque ville de France.
 */
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

  -- Emprise correspondant à 150 m, pour que le filtre géographique reste
  -- indexable. La distance exacte est vérifiée ensuite.
  lat_delta := 0.00135;
  lon_delta := case
    when t.lat is null then null
    else 0.00135 / greatest(cos(radians(t.lat)), 0.2)
  end;

  return query
  with blocked as (
    -- Téléphone identique : l'indice isolé le plus fort après les identifiants.
    select c.id from public.companies c
    where t.phone is not null and c.phone = t.phone and c.id <> t.id

    union
    -- Même commune et nom proche.
    select c.id from public.companies c
    where t.postal_code is not null and t.name_key is not null
      and c.postal_code = t.postal_code
      -- L'opérateur % de pg_trgm vit dans le schéma extensions, et c'est lui
      -- qui active l'index GIN : le remplacer par similarity() forcerait un
      -- parcours complet.
      and c.name_key operator(extensions.%) t.name_key
      and c.id <> t.id

    union
    -- Même point de vente vu par deux sources, à quelques mètres près.
    select c.id from public.companies c
    where t.lat is not null and t.name_key is not null
      and c.lat between t.lat - lat_delta and t.lat + lat_delta
      and c.lon between t.lon - lon_delta and t.lon + lon_delta
      and c.name_key operator(extensions.%) t.name_key
      and c.id <> t.id

    union
    -- Adresse strictement identique dans la même commune.
    select c.id from public.companies c
    where t.address is not null and t.postal_code is not null
      and c.address = t.address and c.postal_code = t.postal_code
      and c.id <> t.id
  ),
  scored as (
    select
      c.id,
      -- Deux SIRET différents désignent deux établissements. Aucun faisceau
      -- d'indices ne peut renverser cela : un centre commercial aligne des
      -- dizaines d'enseignes à la même adresse, avec des noms voisins.
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
        + s.name_similarity * 0.40
        + case when s.postal_match then 0.08 else 0 end
        + case when s.address_match then 0.20 else 0 end
        + case when s.domain_match then 0.25 else 0 end
        + case when s.industry_match then 0.05 else 0 end
        + case
            when s.distance_m is null then 0
            when s.distance_m < 30 then 0.15
            when s.distance_m < 150 then 0.08
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

comment on function public.find_duplicate_candidates is
  'Candidats au rapprochement, blocage indexé puis pondération. Un SIRET ou un SIREN différent écarte définitivement la paire.';

revoke execute on function public.geo_distance_m(double precision, double precision, double precision, double precision) from public;
revoke execute on function public.find_duplicate_candidates(uuid, numeric, integer) from public;
grant execute on function public.find_duplicate_candidates(uuid, numeric, integer) to service_role;
