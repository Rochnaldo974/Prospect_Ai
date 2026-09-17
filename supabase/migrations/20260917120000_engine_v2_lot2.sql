-- Lot 2 du moteur V2 : exclusivité réparée, attribution sélectionnée en
-- base, découverte planifiée.
--
-- 1. Réglages du moteur, lisibles depuis SQL et depuis Node.
-- 2. Expiration des attributions : un repos après une exclusivité non
--    utilisée, une fin pour les attributions « contactées » sans issue.
-- 3. assign_opportunity : l'attribution et le changement de statut de
--    l'opportunité dans une seule transaction.
-- 4. select_allocation_candidates : le stock filtré en base par profil,
--    mémoire comprise — plus de plafond à mille lignes chargées en Node.
-- 5. discovery_areas : les zones à découvrir (OpenStreetMap), en rotation.
-- 6. Crons : planification de la découverte, AFNIC quotidien, BODACC → contacts.

-- ─── 1. Réglages ────────────────────────────────────────────────────────────

create table if not exists public.engine_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.engine_settings (key, value, description) values
  ('expired_unused_cooldown_days', '7', 'Repos d''une entreprise dont l''exclusivité a expiré sans avoir été travaillée.'),
  ('contacted_without_outcome_days', '14', 'Au bout de combien de jours une attribution « contactée » sans issue déclarée est close.'),
  ('contacted_without_outcome_cooldown_days', '45', 'Repos posé quand une attribution « contactée » est close sans issue (même durée que « sans réponse »).'),
  ('allocation_candidates_per_user', '300', 'Combien d''opportunités le moteur d''attribution charge par profil, après filtrage en base.'),
  ('user_memory_days', '30', 'Silence entre deux propositions d''une même entreprise au même freelance, sans issue déclarée.'),
  ('discovery_areas_per_night', '20', 'Zones OpenStreetMap découvertes ou rafraîchies chaque nuit.'),
  ('discovery_refresh_days', '30', 'Délai avant qu''une zone découverte soit revisitée.')
on conflict (key) do nothing;

alter table public.engine_settings enable row level security;
grant select on public.engine_settings to service_role;
grant all on public.engine_settings to service_role;

create or replace function public.engine_setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::integer from public.engine_settings where key = p_key), p_default);
$$;

revoke execute on function public.engine_setting_int(text, integer) from public, anon, authenticated;

-- ─── 2. Expiration des attributions, avec repos ─────────────────────────────
--
-- Avant : une exclusivité expirée rendait l'entreprise attribuable à
-- n'importe qui dès le balayage suivant ; une attribution « contactée » sans
-- issue verrouillait l'entreprise pour toujours. Maintenant : un repos court
-- après une expiration non utilisée, et une clôture des « contactées »
-- muettes au bout d'un délai, avec le repos « sans réponse ».

create or replace function public.expire_stale_assignments()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
  unused_days integer := public.engine_setting_int('expired_unused_cooldown_days', 7);
  contacted_days integer := public.engine_setting_int('contacted_without_outcome_days', 14);
  contacted_cooldown_days integer := public.engine_setting_int('contacted_without_outcome_cooldown_days', 45);
begin
  with released as (
    update public.assignments
    set status = 'expired'
    where status = 'active'
      and contacted_at is null
      and exclusive_until <= now()
    returning id, company_id, opportunity_id
  ),
  restocked as (
    update public.opportunities o
    set status = 'available', updated_at = now()
    from released r
    where o.id = r.opportunity_id
      and o.status = 'assigned'
      and o.expires_at > now()
    returning o.id
  ),
  rested as (
    -- Un repos court : le dossier a déjà été proposé à quelqu'un qui ne l'a
    -- pas travaillé ; le remettre dans le stock le lendemain fait tourner
    -- la même entreprise entre freelances sans qu'aucun ne l'appelle.
    insert into public.company_cooldowns (company_id, reason, starts_at, ends_at, permanent, assignment_id)
    select r.company_id, 'expired_unused', now(), now() + make_interval(days => unused_days), false, r.id
    from released r
    where unused_days > 0
    returning company_id
  ),
  closed as (
    -- Une attribution contactée sans issue déclarée finit par être close :
    -- l'entreprise a été appelée, on lui laisse le repos « sans réponse ».
    update public.assignments
    set status = 'expired'
    where status in ('active', 'contacted')
      and contacted_at is not null
      and outcome is null
      and contacted_at <= now() - make_interval(days => contacted_days)
    returning id, company_id, opportunity_id
  ),
  consumed as (
    update public.opportunities o
    set status = 'expired', updated_at = now()
    from closed c
    where o.id = c.opportunity_id and o.status = 'assigned'
    returning o.id
  ),
  rested_after_contact as (
    insert into public.company_cooldowns (company_id, reason, starts_at, ends_at, permanent, assignment_id)
    select c.company_id, 'no_response', now(), now() + make_interval(days => contacted_cooldown_days), false, c.id
    from closed c
    returning company_id
  )
  select (select count(*) from released) + (select count(*) from closed) into affected;

  return affected;
end;
$$;

-- ─── 3. L'attribution en une transaction ────────────────────────────────────
--
-- L'insertion de l'attribution (avec ses garde-fous) et le passage de
-- l'opportunité à « assigned » réussissent ou échouent ensemble. Une
-- opportunité qui n'est plus disponible fait échouer l'appel : le moteur
-- passe à la suivante, rien n'est écrit.

create or replace function public.assign_opportunity(
  p_user_id         uuid,
  p_opportunity_id  uuid,
  p_batch_id        uuid,
  p_rank            smallint,
  p_match_score     numeric,
  p_is_control      boolean,
  p_exclusive_until timestamptz
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_assignment uuid;
  v_updated integer;
begin
  select company_id into v_company
  from public.opportunities
  where id = p_opportunity_id and status = 'available' and expires_at > now()
  for update;

  if v_company is null then
    raise exception 'opportunité indisponible' using errcode = 'check_violation';
  end if;

  insert into public.assignments (user_id, company_id, opportunity_id, batch_id, rank, match_score, is_control, exclusive_until)
  values (p_user_id, v_company, p_opportunity_id, p_batch_id, p_rank, p_match_score, p_is_control, p_exclusive_until)
  returning id into v_assignment;

  update public.opportunities set status = 'assigned', updated_at = now()
  where id = p_opportunity_id and status = 'available';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'opportunité prise entre-temps' using errcode = 'check_violation';
  end if;

  return v_assignment;
end;
$$;

revoke execute on function public.assign_opportunity(uuid, uuid, uuid, smallint, numeric, boolean, timestamptz) from public, anon, authenticated;

-- ─── 4. Le stock filtré en base, par profil ─────────────────────────────────
--
-- Tout ce qui peut être décidé sans lire le dossier est décidé ici : statut,
-- validité, garde-fous d'entreprise, mémoire du freelance, services
-- choisis, secteurs exclus, zone, canal exigé. Ce qui sort est déjà trié
-- par score ; Node ne fait plus que l'adéquation fine et la vérification.

create or replace function public.select_allocation_candidates(
  p_user_id             uuid,
  p_services            public.opportunity_type[] default '{}',
  p_location_mode       text default 'france',
  p_city                text default null,
  p_region              text default null,
  p_excluded_industries text[] default '{}',
  p_require_phone       boolean default false,
  p_limit               integer default 300
)
returns table (
  opportunity_id    uuid,
  company_id        uuid,
  opportunity_type  public.opportunity_type,
  base_score        numeric,
  confidence_score  numeric,
  reason_data       jsonb,
  phone_ready       boolean,
  outreach_ready    boolean,
  city              text,
  region            text,
  industry_code     text,
  best_email        text
)
language sql
stable
security definer
set search_path = public
as $$
  with memory_days as (
    select public.engine_setting_int('user_memory_days', 30) as d
  ),
  seen as (
    select a.company_id
    from public.assignments a, memory_days m
    where a.user_id = p_user_id
      and (a.outcome is not null or a.assigned_at > now() - make_interval(days => m.d))
  )
  select o.id, o.company_id, o.opportunity_type, o.base_score, o.confidence_score, o.reason_data,
         o.phone_ready, o.outreach_ready, c.city, c.region, c.industry_code, c.best_email
  from public.opportunities o
  join public.companies c on c.id = o.company_id
  where o.status = 'available'
    and o.expires_at > now()
    and c.prospecting_allowed
    and not c.suppression_global
    and c.cooldown_until is null
    and not c.has_live_assignment
    and not exists (select 1 from seen s where s.company_id = o.company_id)
    and (cardinality(p_services) = 0 or o.opportunity_type = any (p_services))
    and (not p_require_phone or o.phone_ready)
    and not exists (
      select 1 from unnest(p_excluded_industries) x
      where c.industry_code is not null and c.industry_code like x || '%'
    )
    and (
      p_location_mode not in ('city', 'region')
      or (p_location_mode = 'city' and p_city is not null and lower(c.city) = lower(p_city))
      or (p_location_mode = 'region' and p_region is not null and lower(c.region) = lower(p_region))
    )
  order by o.base_score desc, o.created_at desc
  limit greatest(1, least(p_limit, 2000));
$$;

revoke execute on function public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer) from public, anon, authenticated;

-- ─── 5. Les zones de découverte ─────────────────────────────────────────────

create table if not exists public.discovery_areas (
  id                bigint generated always as identity primary key,
  source            text not null default 'openstreetmap',
  area_type         text not null check (area_type in ('commune', 'departement', 'zone')),
  area_id           text not null,
  name              text not null,
  department        text,
  population        integer,
  priority          smallint not null default 50,
  status            text not null default 'pending' check (status in ('pending', 'active', 'paused', 'failed')),
  last_scanned_at   timestamptz,
  next_scan_at      timestamptz not null default now(),
  last_success_at   timestamptz,
  last_error        text,
  last_duration_ms  integer,
  runs              integer not null default 0,
  companies_seen    integer not null default 0,
  companies_created integer not null default 0,
  companies_updated integer not null default 0,
  contacts_found    integer not null default 0,
  stats             jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint discovery_areas_uq unique (source, area_type, area_id)
);

comment on table public.discovery_areas is
  'Les zones que la découverte parcourt en rotation : jamais vues d''abord, puis les plus peuplées, puis les plus anciennes.';

create index if not exists discovery_areas_due_idx on public.discovery_areas (next_scan_at) where status <> 'paused';

alter table public.discovery_areas enable row level security;
grant all on public.discovery_areas to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ─── 6. Crons ───────────────────────────────────────────────────────────────

-- La découverte, planifiée avant le reste de la nuit : les entreprises
-- trouvées sont scannées et signalées dans la même nuit.
select cron.schedule(
  'plan-discovery',
  '5 0 * * *',
  $$ select public.schedule_recurring_job('plan_discovery', 72::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);

-- Les .fr créés la veille, publiés par l'AFNIC chaque matin.
select cron.schedule(
  'afnic-daily',
  '30 2 * * *',
  $$ select public.schedule_recurring_job('import_afnic_daily', 82::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);

-- Les entreprises BODACC sans contact, rapprochées de l'annuaire puis résolues.
select cron.schedule(
  'resolve-bodacc-contacts',
  '45 3 * * *',
  $$ select public.schedule_recurring_job('resolve_bodacc_contacts', 66::smallint, '{"limit": 500}'::jsonb, 'YYYYMMDD') $$
);
