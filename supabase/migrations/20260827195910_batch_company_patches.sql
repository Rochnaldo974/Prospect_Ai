-- ═══════════════════════════════════════════════════════════════════════════
-- Application groupée des mises à jour d'entreprises.
--
-- Après le passage de l'insertion en lots, le réimport restait à 500 lignes/s
-- contre 5 000 à la création : chaque fusion faisait un UPDATE isolé. Sur un
-- rafraîchissement de stock national, où presque tout est une fusion, c'est le
-- cas dominant.
--
-- Un seul UPDATE alimenté par un tableau JSON traite tout le lot. Les champs
-- absents du patch conservent leur valeur actuelle : c'est la règle « ne
-- jamais écraser une information déjà acquise », exprimée en SQL.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.apply_company_patches(patches jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  with input as (
    select * from jsonb_to_recordset(patches) as x(
      id                  uuid,
      siren               text,
      siret               text,
      commercial_name     text,
      domain              text,
      website_url         text,
      phone               text,
      contact_form_url    text,
      address             text,
      postal_code         text,
      city                text,
      region              text,
      lat                 double precision,
      lon                 double precision,
      industry_code       text,
      industry_label      text,
      employee_min        integer,
      employee_max        integer,
      creation_date       date,
      company_status      public.company_status,
      identity_confidence numeric,
      prospecting_allowed boolean,
      last_seen_at        timestamptz
    )
  ),
  updated as (
    update public.companies c
    set siren               = coalesce(i.siren, c.siren),
        siret               = coalesce(i.siret, c.siret),
        commercial_name     = coalesce(i.commercial_name, c.commercial_name),
        domain              = coalesce(i.domain, c.domain),
        website_url         = coalesce(i.website_url, c.website_url),
        phone               = coalesce(i.phone, c.phone),
        contact_form_url    = coalesce(i.contact_form_url, c.contact_form_url),
        address             = coalesce(i.address, c.address),
        postal_code         = coalesce(i.postal_code, c.postal_code),
        city                = coalesce(i.city, c.city),
        region              = coalesce(i.region, c.region),
        lat                 = coalesce(i.lat, c.lat),
        lon                 = coalesce(i.lon, c.lon),
        industry_code       = coalesce(i.industry_code, c.industry_code),
        industry_label      = coalesce(i.industry_label, c.industry_label),
        employee_min        = coalesce(i.employee_min, c.employee_min),
        employee_max        = coalesce(i.employee_max, c.employee_max),
        creation_date       = coalesce(i.creation_date, c.creation_date),
        company_status      = coalesce(i.company_status, c.company_status),
        identity_confidence = coalesce(i.identity_confidence, c.identity_confidence),
        prospecting_allowed = coalesce(i.prospecting_allowed, c.prospecting_allowed),
        last_seen_at        = coalesce(i.last_seen_at, c.last_seen_at),
        updated_at          = now()
    from input i
    where c.id = i.id
    returning 1
  )
  select count(*) into affected from updated;

  return affected;
end;
$$;

comment on function public.apply_company_patches is
  'Applique un lot de mises à jour partielles en une instruction. Un champ absent du patch conserve sa valeur : une source ne doit jamais effacer ce qu''une autre a apporté.';

revoke execute on function public.apply_company_patches(jsonb) from public;
grant execute on function public.apply_company_patches(jsonb) to service_role;
