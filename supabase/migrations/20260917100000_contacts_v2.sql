-- Lot 1 du moteur V2 : les contacts deviennent des lignes avec provenance,
-- l'entreprise porte son meilleur e-mail et un score de contactabilité,
-- l'opportunité dit si elle se prospecte par téléphone ou par écrit, et les
-- rejets du quality gate sont enfin écrits quelque part.
--
-- Rétrocompatible : companies.phone, companies.contact_form_url,
-- domains.phones_found et domains.emails_found restent en place et restent
-- lus. has_contact garde sa définition ; has_email s'ajoute à côté.

-- ─── 1. Les contacts, un par ligne, avec leur origine ───────────────────────

create table if not exists public.company_contacts (
  id                bigint generated always as identity primary key,
  company_id        uuid not null references public.companies(id) on delete cascade,
  type              text not null check (type in (
                      'phone', 'email', 'contact_form', 'linkedin', 'instagram',
                      'facebook', 'whatsapp', 'other')),
  value             text not null,
  normalized_value  text not null,
  source            text not null check (source in (
                      'osm', 'website', 'legal_page', 'contact_page', 'sirene', 'bodacc',
                      'boamp', 'csv', 'manual', 'enrichment_provider', 'other')),
  source_url        text,
  is_generic        boolean not null default false,
  is_personal       boolean not null default false,
  person_name       text,
  role              text,
  confidence        numeric(3,2) not null default 0.80 check (confidence between 0 and 1),
  prospecting_allowed boolean not null default true,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  verified_at       timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  constraint company_contacts_dedupe unique (company_id, type, normalized_value)
);

comment on table public.company_contacts is
  'Un moyen de joindre une entreprise, avec sa provenance. La même valeur vue par deux sources reste une ligne : la première source gagne, last_seen_at avance.';

create index if not exists company_contacts_company_idx on public.company_contacts (company_id);
create index if not exists company_contacts_type_idx on public.company_contacts (type) where prospecting_allowed;

alter table public.company_contacts enable row level security;

-- ─── 2. L'entreprise : meilleur e-mail, contactabilité, état de résolution ──

alter table public.companies
  add column if not exists best_email text,
  add column if not exists has_email boolean generated always as (best_email is not null) stored,
  add column if not exists contactability_score smallint not null default 0
    check (contactability_score between 0 and 100),
  add column if not exists contact_resolution_status text not null default 'pending'
    check (contact_resolution_status in ('not_needed', 'pending', 'resolved', 'partial', 'failed')),
  add column if not exists contact_resolution_attempts smallint not null default 0,
  add column if not exists last_contact_resolution_at timestamptz,
  add column if not exists next_contact_resolution_at timestamptz;

comment on column public.companies.best_email is
  'La meilleure adresse écrite connue : générique d''abord (contact@, info@…), jamais une boîte grand public ni un noreply. Choisie par le ContactResolver.';
comment on column public.companies.contactability_score is
  '0–100 : téléphone 50, e-mail générique 30 (rôle 20, personnel 10), formulaire 15, réseau social 5.';

create index if not exists companies_has_email_idx on public.companies (id) where has_email;

-- ─── 3. L'opportunité dit par quel canal elle se prospecte ──────────────────

alter table public.opportunities
  add column if not exists phone_ready boolean not null default false,
  add column if not exists outreach_ready boolean not null default false;

comment on column public.opportunities.phone_ready is
  'Qualifiée ET un téléphone valide : le dossier d''un compte gratuit.';
comment on column public.opportunities.outreach_ready is
  'Qualifiée ET (e-mail exploitable OU formulaire) : le dossier où l''on peut écrire.';

create index if not exists opportunities_phone_ready_idx
  on public.opportunities (opportunity_type, base_score desc) where status = 'available' and phone_ready;
create index if not exists opportunities_outreach_ready_idx
  on public.opportunities (opportunity_type, base_score desc) where status = 'available' and outreach_ready;

-- ─── 4. Les rejets du quality gate, écrits, purgés ──────────────────────────

create table if not exists public.opportunity_rejections (
  id              bigint generated always as identity primary key,
  company_id      uuid not null references public.companies(id) on delete cascade,
  candidate_type  public.opportunity_type not null,
  reason          text not null check (reason in (
                    'NO_CONTACT', 'LOW_IDENTITY_CONFIDENCE', 'LOW_SCORE', 'LOW_CONFIDENCE',
                    'COOLDOWN', 'DUPLICATE', 'NO_RELEVANT_SERVICE', 'STALE_SIGNAL')),
  score           numeric(5,2),
  created_at      timestamptz not null default now()
);

comment on table public.opportunity_rejections is
  'Pourquoi un candidat n''est pas devenu une opportunité, par passe du moteur. Purgé après quatorze jours : c''est une mesure, pas un historique.';

create index if not exists opportunity_rejections_created_idx on public.opportunity_rejections (created_at);
create index if not exists opportunity_rejections_reason_idx on public.opportunity_rejections (reason, created_at);
create index if not exists opportunity_rejections_company_idx on public.opportunity_rejections (company_id, created_at);

alter table public.opportunity_rejections enable row level security;

create or replace function public.prune_opportunity_rejections(older_than interval default '14 days')
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.opportunity_rejections where created_at < now() - older_than returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.prune_opportunity_rejections(interval) from public, anon, authenticated;

-- ─── 5. Les métriques du moteur, en une requête ─────────────────────────────
--
-- Tout ce que le tableau de bord de lancement demande, calculé à la demande
-- sur un jour donné (défaut : aujourd'hui, UTC). Les compteurs « du jour »
-- lisent les dates de première apparition ; les compteurs de stock lisent
-- l'état courant.

create or replace function public.engine_metrics(p_day date default (now() at time zone 'utc')::date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with day as (
    select p_day::timestamptz as d0, (p_day + 1)::timestamptz as d1
  )
  select jsonb_build_object(
    'day', p_day,
    'discovery', jsonb_build_object(
      'companies_discovered_total', (select count(*) from companies),
      'companies_discovered_today', (select count(*) from companies, day where created_at >= d0 and created_at < d1),
      'companies_discovered_by_source', (
        select coalesce(jsonb_object_agg(source_name, n), '{}'::jsonb) from (
          select source_name, count(distinct company_id) n from company_sources group by 1
        ) s)
    ),
    'domains', jsonb_build_object(
      'domains_discovered_total', (select count(*) from domains),
      'domains_discovered_today', (select count(*) from domains, day where created_at >= d0 and created_at < d1),
      'domains_scanned_today', (select count(*) from domains, day where last_checked_at >= d0 and last_checked_at < d1),
      'domains_due_for_scan', (select count(*) from domains where next_check_at <= now() and status <> 'excluded'),
      'domains_scan_success_rate', (
        select case when count(*) = 0 then null
               else round(count(*) filter (where status in ('reachable','placeholder'))::numeric / count(*), 3) end
        from domains where last_checked_at is not null)
    ),
    'contacts', jsonb_build_object(
      'companies_with_phone', (select count(*) from companies where phone is not null),
      'companies_with_email', (select count(*) from companies where best_email is not null),
      'companies_with_form', (select count(*) from companies where contact_form_url is not null),
      'companies_with_phone_and_email', (select count(*) from companies where phone is not null and best_email is not null),
      'companies_contactable', (select count(*) from companies where has_contact or has_email),
      'contacts_found_today', (select count(*) from company_contacts, day where first_seen_at >= d0 and first_seen_at < d1),
      'contacts_found_by_source', (
        select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (
          select source, count(*) n from company_contacts group by 1) s),
      'contacts_found_by_type', (
        select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (
          select type, count(*) n from company_contacts group by 1) s)
    ),
    'opportunities', jsonb_build_object(
      'opportunities_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1),
      'opportunities_created_by_type', (
        select coalesce(jsonb_object_agg(opportunity_type, n), '{}'::jsonb) from (
          select opportunity_type, count(*) n from opportunities, day where created_at >= d0 and created_at < d1 group by 1) s),
      'opportunities_created_by_source', (
        select coalesce(jsonb_object_agg(src, n), '{}'::jsonb) from (
          select coalesce((select source_name from company_sources cs where cs.company_id = o.company_id order by discovered_at limit 1), 'inconnue') src, count(*) n
          from opportunities o, day where o.created_at >= d0 and o.created_at < d1 group by 1) s),
      'qualified_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1),
      'phone_ready_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1 and phone_ready),
      'outreach_ready_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1 and outreach_ready),
      'stock_qualified', (select count(*) from opportunities where status = 'available' and expires_at > now()),
      'stock_phone_ready', (select count(*) from opportunities where status = 'available' and expires_at > now() and phone_ready),
      'stock_outreach_ready', (select count(*) from opportunities where status = 'available' and expires_at > now() and outreach_ready),
      'stock_phone_and_email_ready', (
        select count(*) from opportunities o join companies c on c.id = o.company_id
        where o.status = 'available' and o.expires_at > now() and c.phone is not null and c.best_email is not null),
      'stock_by_type', (
        select coalesce(jsonb_object_agg(opportunity_type, n), '{}'::jsonb) from (
          select opportunity_type, count(*) n from opportunities where status = 'available' and expires_at > now() group by 1) s)
    ),
    'rejections', jsonb_build_object(
      'opportunities_rejected_today', (select count(*) from opportunity_rejections, day where created_at >= d0 and created_at < d1),
      'rejections_by_reason', (
        select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from (
          select reason, count(*) n from opportunity_rejections, day where created_at >= d0 and created_at < d1 group by 1) s)
    )
  );
$$;

revoke execute on function public.engine_metrics(date) from public, anon, authenticated;

-- ─── 6. Droits : le worker et le site (clé de service) seulement ────────────
--
-- Aucun grant à `authenticated` : l'utilisateur final ne lit jamais ces
-- tables directement, le serveur les lui présente. RLS activée sans policy.

grant all on public.company_contacts, public.opportunity_rejections to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ─── 7. La purge hebdomadaire des rejets, à côté de celle des clés ──────────

select cron.schedule(
  'prune-rejections',
  '50 4 * * 0',
  $$ select public.schedule_recurring_job('prune_rejections', 10::smallint, '{}'::jsonb, 'IYYY-IW') $$
);
