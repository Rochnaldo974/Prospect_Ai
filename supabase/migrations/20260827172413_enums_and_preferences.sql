-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1a — Vocabulaire du domaine et préférences utilisateur.
--
-- Un seul enum `opportunity_type` sert à la fois aux services recherchés par
-- l'utilisateur et au type d'une opportunité. C'est ce qui rend le filtre
-- service binaire et trivial : opportunity.type = ANY(preferences.services).
-- ═══════════════════════════════════════════════════════════════════════════

create type public.opportunity_type as enum (
  'website_creation',
  'website_redesign',
  'ecommerce',
  'web_application',
  'mobile_application',
  'ai_automation',
  'seo',
  'maintenance',
  'other'
);

create type public.location_mode as enum (
  'france',          -- toute la France
  'region',          -- la région de l'utilisateur
  'city',            -- sa ville et sa proximité immédiate
  'france_remote'    -- France entière, missions à distance assumées
);

create type public.company_status as enum ('active', 'closed', 'unknown');

create type public.company_segment as enum (
  'local_commerce',  -- segment du V1 : commerces et artisans
  'b2b',
  'ecommerce',
  'other'
);

-- Deux dimensions distinctes pour un signal, à ne pas confondre :
--   kind     = ce signal peut-il DÉCLENCHER une opportunité ?
--   category = quelle composante du score il informe.
create type public.signal_kind as enum ('trigger', 'modifier');
create type public.signal_category as enum ('need', 'timing', 'risk', 'quality');

create type public.opportunity_status as enum (
  'available',   -- en stock, allouable
  'assigned',    -- attribuée à un utilisateur
  'expired',     -- périmée sans avoir été distribuée
  'rejected'     -- écartée par le quality gate ou par un admin
);

create type public.assignment_status as enum (
  'active',      -- attribuée, pas encore contactée
  'contacted',   -- l'utilisateur a déclaré avoir contacté
  'completed',   -- issue enregistrée, l'entreprise passe en cooldown
  'expired',     -- non contactée dans le délai d'exclusivité
  'released'     -- rendue au stock (admin, ou renoncement)
);

create type public.assignment_outcome as enum (
  'no_response',
  'not_interested',
  'interested',
  'meeting',
  'proposal',
  'client'
);

create type public.cooldown_reason as enum (
  'no_response',
  'not_interested',
  'interested',
  'meeting',
  'proposal',
  'client',
  'expired_unused',
  'manual',
  'opt_out'        -- opposition explicite : la suppression prime, jamais de redistribution
);

create type public.job_status as enum ('pending', 'running', 'done', 'failed', 'dead');

-- ─── user_preferences ──────────────────────────────────────────────────────
--
-- Volontairement minimaliste : trois questions d'onboarding, rien de plus.
-- Chaque paramètre supplémentaire est une friction qui coûte des inscriptions.

create table public.user_preferences (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.profiles(id) on delete cascade,

  services            public.opportunity_type[] not null default '{}',

  location_mode       public.location_mode not null default 'france',
  city                text,
  region              text,

  preferred_industries text[] not null default '{}',
  excluded_industries  text[] not null default '{}',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Un mode local sans localisation ne peut produire aucun match.
  constraint user_preferences_local_needs_place check (
    location_mode not in ('region', 'city')
    or city is not null
    or region is not null
  )
);

comment on table public.user_preferences is
  'Préférences de matching. Trois questions maximum — cf. règle produit : moins l''utilisateur configure, mieux c''est.';
comment on column public.user_preferences.services is
  'Filtre binaire, jamais une pondération : une opportunité hors de cette liste n''est jamais proposée.';

create index user_preferences_services_idx on public.user_preferences using gin (services);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Création automatique des préférences en même temps que le profil.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Privilèges + RLS
revoke all on public.user_preferences from anon, authenticated;
grant select, update on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;

alter table public.user_preferences enable row level security;

create policy user_preferences_select_own on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy user_preferences_update_own on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
