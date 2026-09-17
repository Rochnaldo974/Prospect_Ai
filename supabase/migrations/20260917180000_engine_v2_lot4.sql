-- Lot 4 du moteur V2 : ce que le scan mesure pour le SEO et le commerce en
-- ligne, une empreinte par opportunité, un rapprochement SIRENE approché,
-- et des alertes quand le moteur s'arrête de produire.

-- ─── 1. Les faits SEO et commerce, mesurés au scan ──────────────────────────

alter table public.domains
  add column if not exists seo_facts jsonb,
  add column if not exists commerce_facts jsonb;

comment on column public.domains.seo_facts is
  'Mesuré à l''ouverture de la page : titre, description, H1, canonique, données structurées, images sans alt, nombre de mots, attribut lang.';
comment on column public.domains.commerce_facts is
  'Mesuré à l''ouverture de la page : plateforme e-commerce, catalogue, panier, paiement.';

-- ─── 2. L'empreinte d'une opportunité ───────────────────────────────────────
--
-- hash(entreprise, type, événement d'ancrage ou « diagnostic », constats
-- majeurs, mois). Deux passes qui voient les mêmes faits produisent la même
-- empreinte ; un nouvel événement légitime en produit une autre. Une
-- empreinte déjà consommée récemment ne redevient pas une nouveauté.

alter table public.opportunities
  add column if not exists fingerprint text;

create index if not exists opportunities_fingerprint_idx on public.opportunities (fingerprint, created_at desc) where fingerprint is not null;

-- ─── 3. Rapprochement SIRENE approché ───────────────────────────────────────
--
-- Après l'égalité stricte, la similarité de trigrammes au même code postal :
-- « boulangerie martin » et « boulangerie martin et fils » se ressemblent.
-- On part des établissements du code postal (quelques milliers, index
-- existant) et on compare leur enseigne puis la dénomination de leur unité
-- légale : aucun index de trigrammes sur neuf millions de lignes, une
-- vingtaine de millisecondes par appel. Seuil strict, un seul SIREN, clé
-- d'au moins six caractères.

drop index if exists public.sirene_reference_name_trgm_idx;
drop index if exists public.sirene_units_name_trgm_idx;

-- Les établissements d'un code postal, sans condition sur l'enseigne.
create index if not exists sirene_reference_postal_idx on public.sirene_reference (postal_code) where active and diffusible;

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
  local_units as (
    select r.siret, r.siren, r.naf_code, r.creation_date, r.is_head_office, r.name_key as storefront_key
    from public.sirene_reference r, c
    where length(c.name_key) >= 6 and r.postal_code = c.postal_code and r.active and r.diffusible
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

revoke execute on function public.match_company_to_sirene_fuzzy(uuid, real) from public, anon, authenticated;
grant execute on function public.match_company_to_sirene_fuzzy(uuid, real) to service_role;

-- ─── 4. Les alertes du moteur ───────────────────────────────────────────────

create table if not exists public.engine_alerts (
  id          bigint generated always as identity primary key,
  kind        text not null,
  severity    text not null check (severity in ('info', 'warning', 'critical')),
  message     text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- Une alerte par motif et par jour.
create unique index if not exists engine_alerts_daily_uq on public.engine_alerts (kind, ((created_at at time zone 'utc')::date));

comment on table public.engine_alerts is
  'Ce que le moteur aurait dû faire et n''a pas fait : découverte à zéro, production en chute, file bloquée, synchronisation manquée. Une par motif et par jour.';

create index if not exists engine_alerts_open_idx on public.engine_alerts (created_at desc) where resolved_at is null;

alter table public.engine_alerts enable row level security;
grant all on public.engine_alerts to service_role;
grant usage, select on all sequences in schema public to service_role;

select cron.schedule(
  'check-health',
  '15 * * * *',
  $$ select public.schedule_recurring_job('check_health', 30::smallint, '{}'::jsonb, 'YYYYMMDDHH24') $$
);
