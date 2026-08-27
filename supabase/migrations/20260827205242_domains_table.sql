-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 6 — Le domaine devient une entité à part entière.
--
-- Constat posé en phase 4b : les enseignes de réseau partagent le site de la
-- marque. Cinq magasins Carrefour renvoient tous vers carrefour.fr. Scanner
-- par entreprise ferait cinq fois le même travail, et produirait cinq
-- opportunités de refonte pour un seul site.
--
-- Le domaine est donc scanné une fois, et les entreprises qui le revendiquent
-- lisent le même résultat. C'est aussi ce qui permet le rattachement inverse :
-- on extrait le SIREN des mentions légales du site, et on le joint au
-- répertoire — un lien déterministe, là où la correspondance par nom n'est
-- jamais qu'une inférence.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.domain_status as enum (
  'unknown',      -- jamais visité
  'reachable',    -- répond et sert du HTML
  'placeholder',  -- répond, mais page d'attente ou domaine parké
  'broken',       -- erreur HTTP durable
  'unreachable',  -- DNS ou connexion en échec
  'excluded'      -- exclu par robots.txt
);

create table public.domains (
  domain            text primary key,

  status            public.domain_status not null default 'unknown',
  http_status       integer,
  final_url         text,
  redirect_chain    jsonb not null default '[]',

  title             text,
  meta_description  text,
  content_hash      text,
  tech_hash         text,

  cms               text,
  framework         text,
  technologies      jsonb not null default '[]',

  has_ssl           boolean,
  has_viewport_meta boolean,
  has_media_queries boolean,
  html_bytes        integer,
  ttfb_ms           integer,

  ecommerce_detected    boolean not null default false,
  booking_detected      boolean not null default false,
  contact_form_detected boolean not null default false,
  contact_form_url      text,

  /* Extraits du site lui-même : ils permettent de vérifier un rattachement. */
  sirens_found      text[] not null default '{}',
  phones_found      text[] not null default '{}',
  emails_found      text[] not null default '{}',
  copyright_year    smallint,

  /* La page de mentions légales a-t-elle été explorée ? */
  legal_page_url    text,
  legal_page_checked_at timestamptz,

  first_seen_at     timestamptz not null default now(),
  last_checked_at   timestamptz,
  next_check_at     timestamptz not null default now(),
  check_error       text,
  check_attempts    smallint not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.domains is
  'Un domaine scanné une fois, quel que soit le nombre d''entreprises qui le revendiquent. Les enseignes de réseau partagent le site de la marque.';
comment on column public.domains.sirens_found is
  'SIREN extraits des mentions légales. En France, un site professionnel doit les afficher : c''est le rattachement site → entreprise le plus fiable qui existe.';

create index domains_scan_queue_idx on public.domains (next_check_at)
  where status <> 'excluded';
create index domains_status_idx on public.domains (status);
create index domains_sirens_idx on public.domains using gin (sirens_found);
create index domains_content_hash_idx on public.domains (content_hash)
  where content_hash is not null;

create trigger domains_set_updated_at
  before update on public.domains
  for each row execute function public.set_updated_at();

-- ─── Alimentation depuis les entreprises ─────────────────────────────────
--
-- Toute entreprise qui déclare un domaine le fait entrer dans la file de scan.

create or replace function public.register_company_domains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domains (domain)
  select distinct n.domain from new_rows n where n.domain is not null
  on conflict (domain) do nothing;
  return null;
end;
$$;

create trigger companies_register_domain_ins
  after insert on public.companies
  referencing new table as new_rows
  for each statement execute function public.register_company_domains();

create trigger companies_register_domain_upd
  after update on public.companies
  referencing new table as new_rows
  for each statement execute function public.register_company_domains();

-- Les domaines déjà présents entrent dans la file.
insert into public.domains (domain)
select distinct domain from public.companies where domain is not null
on conflict (domain) do nothing;

-- ─── Rattachement inverse : du site vers le répertoire ───────────────────

/**
 * Rattache un domaine aux entreprises dont le SIREN figure dans ses mentions
 * légales.
 *
 * C'est le chemin le plus fiable : déterministe, sans rapprochement approché.
 * Il n'écrase jamais un domaine déjà attribué — une entreprise qui a son
 * propre site ne doit pas se voir attribuer celui d'une autre.
 */
create or replace function public.attach_domain_by_legal_siren(p_domain text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_sirens text[];
  attached integer;
begin
  select sirens_found into found_sirens from public.domains where domain = p_domain;
  if found_sirens is null or cardinality(found_sirens) = 0 then return 0; end if;

  with updated as (
    update public.companies c
    set domain = p_domain,
        website_url = 'https://' || p_domain,
        website_confidence = 0.99,
        website_last_resolved_at = now(),
        updated_at = now()
    where c.siren = any(found_sirens)
      and c.domain is null
    returning c.id
  )
  select count(*) into attached from updated;

  return attached;
end;
$$;

comment on function public.attach_domain_by_legal_siren is
  'Rattache un site aux entreprises dont le SIREN figure dans ses mentions légales. Confiance 0,99 : c''est une obligation légale d''affichage, pas une inférence.';

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke all on public.domains from anon, authenticated;
grant all on public.domains to service_role;

revoke execute on function public.attach_domain_by_legal_siren(text) from public;
grant execute on function public.attach_domain_by_legal_siren(text) to service_role;

alter table public.domains enable row level security;
