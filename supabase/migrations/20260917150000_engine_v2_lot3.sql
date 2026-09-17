-- Lot 3 du moteur V2 : un référentiel SIRENE local, un rescan qui s'adapte,
-- et la performance mesurée par source et par type.

-- ─── 1. Référentiel SIRENE local ────────────────────────────────────────────
--
-- Les établissements actifs et diffusibles des métiers qui nous intéressent,
-- importés depuis le fichier public de l'INSEE (StockEtablissement, licence
-- ouverte). Pas une table applicative : une référence, à côté, que le
-- rapprochement d'identité interroge en une requête au lieu d'appeler l'API
-- unité par unité. Ce qu'on garde : de quoi identifier (SIREN, SIRET, NAF,
-- création, état), de quoi rapprocher (enseigne, dénomination usuelle, code
-- postal, commune) — jamais une personne physique.

create table if not exists public.sirene_reference (
  siret            text primary key,
  siren            text not null,
  is_head_office   boolean not null default false,
  storefront_name  text,
  -- La même clé de nom que companies.name_key, par la même fonction : le
  -- rapprochement compare des clés produites par un seul code.
  name_key         text generated always as (public.normalize_name_key(coalesce(storefront_name, ''))) stored,
  naf_code         text,
  postal_code      text,
  city             text,
  creation_date    date,
  active           boolean not null default true,
  diffusible       boolean not null default true,
  employee_range   text,
  imported_at      timestamptz not null default now()
);

comment on table public.sirene_reference is
  'Établissements SIRENE (fichier public INSEE) des métiers ciblés : identité et localisation, pour rapprocher sans appel externe. Aucune personne physique.';

create index if not exists sirene_reference_match_idx on public.sirene_reference (postal_code, name_key) where active and diffusible and name_key <> '';
create index if not exists sirene_reference_siren_idx on public.sirene_reference (siren);

alter table public.sirene_reference enable row level security;
grant all on public.sirene_reference to service_role;

-- Les sociétés, par leur dénomination : la plupart des établissements n'ont
-- pas d'enseigne, mais la société qui les porte a un nom, souvent le même
-- que la devanture. Jamais une personne physique (catégorie 1000 exclue).

create table if not exists public.sirene_units (
  siren          text primary key,
  legal_name     text not null,
  name_key       text generated always as (public.normalize_name_key(legal_name)) stored,
  naf_code       text,
  creation_date  date,
  active         boolean not null default true,
  diffusible     boolean not null default true,
  legal_category text,
  imported_at    timestamptz not null default now()
);

create index if not exists sirene_units_name_idx on public.sirene_units (name_key) where active and diffusible and name_key <> '';
create index if not exists sirene_reference_siren_postal_idx on public.sirene_reference (siren, postal_code) where active and diffusible;

alter table public.sirene_units enable row level security;
grant all on public.sirene_units to service_role;

/**
 * Rapproche une entreprise sans SIREN d'un établissement du référentiel :
 * même code postal et même clé de nom — celle de l'enseigne, ou celle de
 * la société qui porte l'établissement — et un seul SIREN candidat. Le
 * même critère que l'identité par API, sans l'API.
 */
create or replace function public.match_company_to_sirene(p_company_id uuid)
returns table (siret text, siren text, naf_code text, creation_date date, is_head_office boolean, candidates integer)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select name_key, postal_code from public.companies where id = p_company_id
  ),
  -- Deux chemins indexés : l'enseigne au même code postal, ou la société
  -- de ce nom qui a un établissement au même code postal.
  by_storefront as (
    select r.siret, r.siren, r.naf_code, r.creation_date, r.is_head_office
    from public.sirene_reference r, c
    where r.active and r.diffusible and r.name_key <> '' and r.postal_code = c.postal_code and r.name_key = c.name_key
  ),
  by_legal_name as (
    select r.siret, r.siren, r.naf_code, coalesce(r.creation_date, u.creation_date) as creation_date, r.is_head_office
    from public.sirene_units u
    join c on u.name_key = c.name_key
    join public.sirene_reference r on r.siren = u.siren and r.postal_code = c.postal_code and r.active and r.diffusible
    where u.active and u.diffusible and u.name_key <> ''
  ),
  found as (
    select * from by_storefront union select * from by_legal_name
  )
  select f.siret, f.siren, f.naf_code, f.creation_date, f.is_head_office, (select count(*)::integer from found)
  from found f
  where (select count(distinct siren) from found) = 1
  order by f.is_head_office desc
  limit 1;
$$;

revoke execute on function public.match_company_to_sirene(uuid) from public, anon, authenticated;

-- ─── 2. Rescan adaptatif : la série d'« inchangé » ──────────────────────────

alter table public.domains
  add column if not exists unchanged_streak smallint not null default 0;

comment on column public.domains.unchanged_streak is
  'Passages consécutifs sans changement de contenu : plus elle monte, plus le prochain passage s''éloigne.';

-- ─── 3. Performance par source et par type ──────────────────────────────────
--
-- Deux vues qui répondent à « 100 000 entreprises OSM ont produit combien
-- de dossiers prospectables, et combien de rendez-vous ? ».

create or replace view public.source_performance as
with first_source as (
  select distinct on (company_id) company_id, source_name
  from public.company_sources
  order by company_id, discovered_at
),
c as (
  select co.id, coalesce(fs.source_name, 'inconnue') as source,
         (co.phone is not null) as has_phone, (co.best_email is not null) as has_email,
         (co.has_contact or co.has_email) as contactable
  from public.companies co
  left join first_source fs on fs.company_id = co.id
)
select
  c.source,
  count(*)                                                   as companies_seen,
  count(*) filter (where c.contactable)                      as companies_contactable,
  count(*) filter (where c.has_phone)                        as companies_with_phone,
  count(*) filter (where c.has_email)                        as companies_with_email,
  (select count(*) from public.opportunities o join c c2 on c2.id = o.company_id where c2.source = c.source) as opportunities_created,
  (select count(*) from public.opportunities o join c c2 on c2.id = o.company_id where c2.source = c.source and o.status = 'available' and o.expires_at > now()) as stock_qualified,
  (select count(*) from public.opportunities o join c c2 on c2.id = o.company_id where c2.source = c.source and o.status = 'available' and o.expires_at > now() and o.phone_ready) as stock_phone_ready,
  (select count(*) from public.opportunities o join c c2 on c2.id = o.company_id where c2.source = c.source and o.status = 'available' and o.expires_at > now() and o.outreach_ready) as stock_outreach_ready,
  (select count(*) from public.assignments a join c c2 on c2.id = a.company_id where c2.source = c.source) as assigned,
  (select count(*) from public.assignments a join c c2 on c2.id = a.company_id where c2.source = c.source and a.contacted_at is not null) as contacted,
  (select count(*) from public.assignments a join c c2 on c2.id = a.company_id where c2.source = c.source and a.outcome in ('interested', 'meeting', 'proposal', 'client')) as positive_outcomes
from c
group by c.source;

create or replace view public.opportunity_type_performance as
select
  o.opportunity_type,
  count(*)                                                                      as created,
  count(*) filter (where o.status = 'available' and o.expires_at > now())         as stock,
  count(*) filter (where o.status = 'available' and o.expires_at > now() and o.phone_ready)    as stock_phone_ready,
  count(*) filter (where o.status = 'available' and o.expires_at > now() and o.outreach_ready) as stock_outreach_ready,
  (select count(*) from public.assignments a where a.opportunity_id in (select id from public.opportunities x where x.opportunity_type = o.opportunity_type)) as assigned,
  (select count(*) from public.assignments a where a.contacted_at is not null and a.opportunity_id in (select id from public.opportunities x where x.opportunity_type = o.opportunity_type)) as contacted,
  (select count(*) from public.assignments a where a.outcome = 'interested' and a.opportunity_id in (select id from public.opportunities x where x.opportunity_type = o.opportunity_type)) as interested,
  (select count(*) from public.assignments a where a.outcome = 'meeting' and a.opportunity_id in (select id from public.opportunities x where x.opportunity_type = o.opportunity_type)) as meetings,
  (select count(*) from public.assignments a where a.outcome = 'proposal' and a.opportunity_id in (select id from public.opportunities x where x.opportunity_type = o.opportunity_type)) as quotes,
  (select count(*) from public.assignments a where a.outcome = 'client' and a.opportunity_id in (select id from public.opportunities x where x.opportunity_type = o.opportunity_type)) as clients
from public.opportunities o
group by o.opportunity_type;

grant select on public.source_performance, public.opportunity_type_performance to service_role;

-- ─── 4. Cron : rapprochement local d'identité, après l'enrichissement ───────

select cron.schedule(
  'resolve-identity-local',
  '50 4 * * *',
  $$ select public.schedule_recurring_job('resolve_identity_local', 69::smallint, '{"limit": 5000}'::jsonb, 'YYYYMMDD') $$
);
