-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 0 — Fondations : extensions, helpers, profils, rôles.
--
-- Le schéma métier (companies, signals, opportunities, assignments…) arrive en
-- phase 1. Cette migration ne pose que ce dont l'authentification a besoin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"  with schema extensions;  -- gen_random_uuid
create extension if not exists "pg_trgm"   with schema extensions;  -- similarité de noms (dedupe)
create extension if not exists "unaccent"  with schema extensions;  -- normalisation FR
create extension if not exists "cube"      with schema extensions;  -- prérequis earthdistance
create extension if not exists "earthdistance" with schema extensions;  -- proximité géographique

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger générique : met à jour updated_at à chaque UPDATE.';

-- ─── Rôles applicatifs ─────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('user', 'admin');
  end if;
end
$$;

-- ─── profiles ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  full_name               text,
  company_name            text,

  country                 text not null default 'FR',
  city                    text,
  region                  text,

  onboarding_completed    boolean not null default false,
  daily_opportunity_limit integer not null default 5
                            check (daily_opportunity_limit between 1 and 20),

  role                    public.app_role not null default 'user',

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.profiles is
  'Profil applicatif, en miroir de auth.users. Créé automatiquement à l''inscription.';
comment on column public.profiles.role is
  'Rôle applicatif. Non modifiable par l''utilisateur (cf. trigger guard_profile_privileges).';

create index if not exists profiles_role_idx on public.profiles (role) where role = 'admin';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Création automatique du profil à l'inscription ────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Garde-fou : un utilisateur ne peut pas s'auto-promouvoir ──────────────
--
-- RLS ne sait pas restreindre une colonne. Ce trigger rétablit les valeurs
-- privilégiées si l'appelant n'est pas service_role. Sans lui, la policy
-- « un utilisateur met à jour son propre profil » permettrait role = 'admin'.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
    return new;
  end if;

  new.role                    := old.role;
  new.daily_opportunity_limit := old.daily_opportunity_limit;
  new.id                      := old.id;
  new.created_at              := old.created_at;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ─── is_admin() ────────────────────────────────────────────────────────────
--
-- security definer + search_path vide : évite la récursion RLS quand cette
-- fonction est appelée depuis une policy sur profiles.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ─── Privilèges de table ───────────────────────────────────────────────────
--
-- Deux couches distinctes, à ne jamais confondre :
--   * les GRANT décident QUELLES TABLES un rôle peut toucher ;
--   * les policies RLS décident QUELLES LIGNES il voit.
--
-- Les tables du moteur (companies, opportunities…) ne recevront JAMAIS de grant
-- pour `authenticated` : l'utilisateur final ne lit que ses assignment_cards.

grant usage on schema public to anon, authenticated, service_role;

revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Pas de policy INSERT ni DELETE : la création passe par le trigger
-- handle_new_user (security definer), la suppression par la cascade auth.users.
