-- Lot 6 du moteur V2 : les technologies d'un site avec leur version, les
-- faits de performance mesurés puis audités après présélection, et un
-- historique léger de ce qui change d'un scan à l'autre.

-- ─── 1. Technologies par domaine ────────────────────────────────────────────
--
-- Une ligne par (domaine, technologie), clé normalisée (wordpress, jquery…),
-- version quand la page la révèle, première et dernière observation. Le
-- détecteur rapide et le détecteur approfondi écrivent au même endroit.

create table if not exists public.domain_technologies (
  domain         text not null references public.domains(domain) on delete cascade,
  technology     text not null,
  version        text,
  confidence     real not null default 0.8,
  source         text not null default 'fast_scan',
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (domain, technology)
);

create index if not exists domain_technologies_technology_idx on public.domain_technologies (technology, last_seen_at desc);

comment on table public.domain_technologies is
  'Technologies observées sur la page d''accueil, clé normalisée, version si connue, première et dernière observation.';

alter table public.domain_technologies enable row level security;
grant all on public.domain_technologies to service_role;

-- ─── 2. Performance : faits rapides, audit approfondi après présélection ────

alter table public.domains
  add column if not exists performance_facts jsonb,
  add column if not exists performance_audit jsonb,
  add column if not exists performance_audit_status text not null default 'none',
  add column if not exists last_performance_audit_at timestamptz;

alter table public.domains drop constraint if exists domains_performance_audit_status_check;
alter table public.domains add constraint domains_performance_audit_status_check
  check (performance_audit_status in ('none', 'pending', 'done', 'failed'));

create index if not exists domains_performance_pending_idx on public.domains (last_checked_at desc) where performance_audit_status = 'pending';

comment on column public.domains.performance_facts is
  'Mesuré à l''ouverture de la page : temps de première réponse, poids du HTML, scripts, feuilles de style, scripts bloquants, images.';
comment on column public.domains.performance_audit is
  'Audit approfondi, seulement pour les sites présélectionnés : poids des scripts, des styles, des images, image la plus lourde.';

-- ─── 3. Ce qui change d'un scan à l'autre ───────────────────────────────────

create table if not exists public.domain_changes (
  id          bigint generated always as identity primary key,
  domain      text not null references public.domains(domain) on delete cascade,
  changed_at  timestamptz not null default now(),
  kind        text not null,
  before      jsonb,
  after       jsonb
);

create index if not exists domain_changes_domain_idx on public.domain_changes (domain, changed_at desc);
create index if not exists domain_changes_kind_idx on public.domain_changes (kind, changed_at desc);

comment on table public.domain_changes is
  'Historique léger : site apparu, disparu, revenu en ligne, technologie changée, vente en ligne apparue, contact changé, refonte majeure.';

alter table public.domain_changes enable row level security;
grant all on public.domain_changes to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ─── 4. Réglages et planification ───────────────────────────────────────────

insert into public.engine_settings (key, value, description) values
  ('performance_audits_per_night', '200', 'Combien de sites présélectionnés reçoivent un audit de performance approfondi chaque nuit.'),
  ('domain_changes_retention_days', '180', 'Durée de conservation de l''historique des changements de sites.')
on conflict (key) do nothing;

select cron.schedule(
  'audit-performance',
  '15 5 * * *',
  $$ select public.schedule_recurring_job('audit_performance', 70::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);

-- Purge de l'historique, avec celle des rejets.
create or replace function public.prune_domain_changes()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.domain_changes
    where changed_at < now() - make_interval(days => public.engine_setting_int('domain_changes_retention_days', 180))
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke execute on function public.prune_domain_changes() from public, anon, authenticated;
grant execute on function public.prune_domain_changes() to service_role;

select cron.schedule('prune-domain-changes', '40 6 * * 0', $$ select public.prune_domain_changes() $$);
