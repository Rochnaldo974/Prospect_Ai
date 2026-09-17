-- Lot 7 du moteur V2 : nouvelles sources datées (BOAMP V2, JOAFE, Sitadel),
-- enrichissement payant en dernier recours avec son coût, opposition
-- explicite au contact, rétention des tables techniques.

-- ─── 1. Type d'organisation et opposition au contact ────────────────────────

alter table public.companies
  add column if not exists organization_type text not null default 'company',
  add column if not exists do_not_contact boolean not null default false;

alter table public.companies drop constraint if exists companies_organization_type_check;
alter table public.companies add constraint companies_organization_type_check
  check (organization_type in ('company', 'association', 'public_body', 'other'));

create index if not exists companies_do_not_contact_idx on public.companies (id) where do_not_contact;
create index if not exists companies_organization_type_idx on public.companies (organization_type) where organization_type <> 'company';

comment on column public.companies.organization_type is 'company, association (JOAFE), public_body (acheteur BOAMP), other.';
comment on column public.companies.do_not_contact is 'Opposition explicite : jamais attribuée, quelle que soit la suite. Posée à l''issue « opt_out ».';

-- Ce qui existe déjà comme opposition passe au nouveau drapeau.
update public.companies c set do_not_contact = true
from public.company_cooldowns k
where k.company_id = c.id and k.reason = 'opt_out' and not c.do_not_contact;

-- Les acheteurs publics déjà connus par un appel d'offres.
update public.companies c set organization_type = 'public_body'
where organization_type = 'company'
  and exists (select 1 from public.company_events e where e.company_id = c.id and e.event_type = 'tender_published');

alter table public.user_preferences
  add column if not exists exclude_associations boolean not null default false;

-- ─── 2. Permis de construire créant des locaux (Sitadel) ────────────────────
--
-- Source secondaire : un permis n'est pas un lead. Le demandeur porte son
-- SIRET, ce qui rattache le permis à l'entreprise sans deviner une adresse.
-- Le signal — nouveau local commercial, hôtel, bureaux — renforce une
-- intention, il ne la crée pas seul.

create table if not exists public.building_permits (
  permit_id        text primary key,
  commune_code     text not null,
  permit_type      text not null,
  applicant_siren  text,
  applicant_siret  text,
  applicant_name   text,
  applicant_naf    text,
  site_address     text,
  site_postal_code text,
  site_city        text,
  destination      smallint,
  surfaces         jsonb not null default '{}'::jsonb,
  premises_kind    text not null,
  authorized_at    date not null,
  deposited_at     date,
  company_id       uuid references public.companies(id) on delete set null,
  imported_at      timestamptz not null default now()
);

create index if not exists building_permits_siret_idx on public.building_permits (applicant_siret) where applicant_siret is not null;
create index if not exists building_permits_authorized_idx on public.building_permits (authorized_at desc);

comment on table public.building_permits is
  'Autorisations d''urbanisme créant des locaux non résidentiels (Sitadel, DiDo). premises_kind : commercial, hotel, office, industrial, warehouse, public, other.';

alter table public.building_permits enable row level security;
grant all on public.building_permits to service_role;

-- ─── 3. Le coût de chaque enrichissement ────────────────────────────────────

create table if not exists public.enrichment_costs (
  id           bigint generated always as identity primary key,
  company_id   uuid references public.companies(id) on delete set null,
  provider     text not null,
  cost_cents   numeric(10, 2) not null default 0,
  credits_used numeric(10, 2) not null default 0,
  outcome      text not null default 'unknown',
  created_at   timestamptz not null default now()
);

create index if not exists enrichment_costs_created_idx on public.enrichment_costs (created_at desc);
create index if not exists enrichment_costs_provider_idx on public.enrichment_costs (provider, created_at desc);

comment on table public.enrichment_costs is
  'Chaque appel payant ou mesuré : fournisseur, coût en centimes, crédits, issue. Sert au coût par OUTREACH_READY.';

alter table public.enrichment_costs enable row level security;
grant all on public.enrichment_costs to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Économie par jour : ce que le moteur a coûté et ce qu'il a produit.
create or replace view public.engine_economics_daily
with (security_invoker = true) as
with costs as (
  select (created_at at time zone 'utc')::date as day, provider, count(*) as calls, sum(cost_cents) as cost_cents
  from public.enrichment_costs
  group by 1, 2
),
produced as (
  select (created_at at time zone 'utc')::date as day,
         count(*) as opportunities_created,
         count(*) filter (where phone_ready) as phone_ready_created,
         count(*) filter (where outreach_ready) as outreach_ready_created
  from public.opportunities
  group by 1
)
select
  coalesce(c.day, p.day) as day,
  coalesce(sum(c.cost_cents), 0) as cost_cents,
  jsonb_object_agg(coalesce(c.provider, 'none'), coalesce(c.cost_cents, 0)) filter (where c.provider is not null) as cost_by_provider,
  coalesce(max(p.opportunities_created), 0) as opportunities_created,
  coalesce(max(p.phone_ready_created), 0) as phone_ready_created,
  coalesce(max(p.outreach_ready_created), 0) as outreach_ready_created,
  case when coalesce(max(p.outreach_ready_created), 0) > 0
       then round(coalesce(sum(c.cost_cents), 0) / max(p.outreach_ready_created), 2) end as cost_per_outreach_ready_cents
from costs c
full outer join produced p on p.day = c.day
group by coalesce(c.day, p.day)
order by 1 desc;

grant select on public.engine_economics_daily to service_role;

insert into public.engine_settings (key, value, description) values
  ('google_places_cost_cents', '3', 'Coût retenu pour un appel Google Places (recherche textuelle), en centimes.'),
  ('commercial_enrichment_min_score', '70', 'Score d''opportunité minimal avant d''engager un fournisseur de contacts payant.'),
  ('boamp_max_notices', '500', 'Nombre maximal d''avis BOAMP relevés par passage (pages de 100).')
on conflict (key) do nothing;

-- ─── 4. La sélection en base exclut les oppositions et, au choix, les associations

drop function if exists public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer);

create function public.select_allocation_candidates(
  p_user_id              uuid,
  p_services             public.opportunity_type[] default '{}',
  p_location_mode        text default 'france',
  p_city                 text default null,
  p_region               text default null,
  p_excluded_industries  text[] default '{}',
  p_require_phone        boolean default false,
  p_limit                integer default 300,
  p_exclude_associations boolean default false
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
  best_email        text,
  cms               text,
  created_at        timestamptz
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
         o.phone_ready, o.outreach_ready, c.city, c.region, c.industry_code, c.best_email,
         d.cms, o.created_at
  from public.opportunities o
  join public.companies c on c.id = o.company_id
  left join public.domains d on d.domain = c.domain
  where o.status = 'available'
    and o.expires_at > now()
    and c.prospecting_allowed
    and not c.suppression_global
    and not c.do_not_contact
    and (not p_exclude_associations or c.organization_type <> 'association')
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

revoke execute on function public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer, boolean) from public, anon, authenticated;
grant execute on function public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer, boolean) to service_role;

-- ─── 5. Rétention : le bruit technique s'efface, l'histoire commerciale reste

create or replace function public.prune_engine_noise()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signals integer; v_opportunities integer; v_runs integer; v_queue integer; v_alerts integer; v_events integer; v_snapshots integer;
begin
  -- Signaux éteints depuis longtemps : le moteur les recrée s'ils reviennent.
  delete from public.signals where not active and created_at < now() - interval '180 days';
  get diagnostics v_signals = row_count;
  -- Opportunités expirées ou rejetées, jamais attribuées : rien à raconter.
  delete from public.opportunities o
  where o.status in ('expired', 'rejected') and o.updated_at < now() - interval '180 days'
    and not exists (select 1 from public.assignments a where a.opportunity_id = o.id);
  get diagnostics v_opportunities = row_count;
  delete from public.job_runs where started_at < now() - interval '60 days';
  get diagnostics v_runs = row_count;
  delete from public.job_queue where status = 'done' and coalesce(completed_at, created_at) < now() - interval '14 days';
  get diagnostics v_queue = row_count;
  delete from public.engine_alerts where resolved_at is not null and resolved_at < now() - interval '90 days';
  get diagnostics v_alerts = row_count;
  -- Les événements mineurs vieillissent ; les faits importants (création,
  -- cession, appel d'offres) restent : c'est l'histoire de l'entreprise.
  delete from public.company_events where importance < 50 and detected_at < now() - interval '365 days';
  get diagnostics v_events = row_count;
  delete from public.website_snapshots where captured_at < now() - interval '90 days';
  get diagnostics v_snapshots = row_count;
  return jsonb_build_object('signals', v_signals, 'opportunities', v_opportunities, 'job_runs', v_runs, 'job_queue', v_queue,
                            'alerts', v_alerts, 'events', v_events, 'snapshots', v_snapshots);
end;
$$;

revoke execute on function public.prune_engine_noise() from public, anon, authenticated;
grant execute on function public.prune_engine_noise() to service_role;

select cron.schedule('prune-engine-noise', '50 6 * * 0', $$ select public.prune_engine_noise() $$);

-- ─── 6. Planification des nouvelles sources ─────────────────────────────────

select cron.schedule(
  'ingest-joafe',
  '15 1 * * *',
  $$ select public.schedule_recurring_job('ingest_joafe', 60::smallint, '{"limit": 500}'::jsonb, 'YYYYMMDD') $$
);

select cron.schedule(
  'ingest-sitadel',
  '30 1 * * 1',
  $$ select public.schedule_recurring_job('ingest_sitadel', 40::smallint, '{"limit": 2000}'::jsonb, 'YYYYMMDD') $$
);
