-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1c — Observation du web et événements datés.
--
-- Ces deux tables sont append-only et croissent vite (un snapshot par scan et
-- par entreprise). Elles sont partitionnées par mois dès le départ :
-- rétro-partitionner à 50 M de lignes est un chantier qu'on ne veut pas.
-- ═══════════════════════════════════════════════════════════════════════════

-- Les partitions vivent dans un schéma dédié : elles n'ont pas à apparaître
-- dans les types générés, ni dans Studio, ni à être interrogeables directement.
-- Les requêtes passent toujours par la table parente dans `public`.
create schema if not exists partitions;
grant usage on schema partitions to service_role;

-- ═══ website_snapshots ════════════════════════════════════════════════════
--
-- On n'écrase jamais une analyse : c'est la comparaison entre deux snapshots
-- qui produit les événements (site tombé, CMS changé, contenu modifié).

create table public.website_snapshots (
  id                    uuid not null default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  domain                text not null,
  http_status           integer,
  final_url             text,
  redirect_chain        jsonb not null default '[]',

  title                 text,
  meta_description      text,

  -- Détection de changement : si les hash sont identiques, on s'arrête là.
  -- Pas de diff, pas d'événement, pas d'appel LLM. C'est le principal
  -- levier de maîtrise des coûts du pipeline.
  html_hash             text,
  tech_hash             text,

  cms                   text,
  framework             text,
  technologies          jsonb not null default '[]',

  has_ssl               boolean,
  ssl_expires_at        timestamptz,

  has_viewport_meta     boolean,
  has_media_queries     boolean,
  html_bytes            integer,
  ttfb_ms               integer,

  ecommerce_detected    boolean not null default false,
  booking_detected      boolean not null default false,
  contact_form_detected boolean not null default false,

  -- Lien déterministe site → entreprise : en France, le SIREN doit figurer
  -- dans les mentions légales. C'est la stratégie de résolution la plus fiable.
  siren_found_in_legal  text,
  copyright_year        smallint,

  performance_score     smallint check (performance_score between 0 and 100),
  mobile_score          smallint check (mobile_score between 0 and 100),
  seo_score             smallint check (seo_score between 0 and 100),
  accessibility_score   smallint check (accessibility_score between 0 and 100),

  scan_depth            text not null default 'cheap'
                          check (scan_depth in ('cheap', 'deep')),
  scan_error            text,

  captured_at           timestamptz not null default now(),

  primary key (id, captured_at)
) partition by range (captured_at);

comment on table public.website_snapshots is
  'Historique d''observation d''un site. Partitionnée par mois. Jamais mise à jour, uniquement insérée.';
comment on column public.website_snapshots.siren_found_in_legal is
  'SIREN extrait des mentions légales — permet de rattacher un site à une entreprise sans aucun fuzzy matching.';

create index website_snapshots_company_idx
  on public.website_snapshots (company_id, captured_at desc);
create index website_snapshots_domain_idx
  on public.website_snapshots (domain, captured_at desc);
create index website_snapshots_siren_legal_idx
  on public.website_snapshots (siren_found_in_legal)
  where siren_found_in_legal is not null;

-- ═══ company_events ═══════════════════════════════════════════════════════
--
-- Le cœur du moteur. Un signal statique (« site lent ») ne crée jamais une
-- opportunité à lui seul : il faut un événement DATÉ pour justifier un
-- « pourquoi maintenant ». Sans cette table, le produit se comporte comme
-- de la prospection aléatoire.

create table public.company_events (
  id           uuid not null default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,

  event_type   text not null,
  payload      jsonb not null default '{}',

  importance   smallint not null default 50 check (importance between 0 and 100),
  confidence   numeric(3,2) not null default 0.80 check (confidence between 0 and 1),
  source       text not null,

  -- occurred_at est la date réelle du fait (création d'entreprise, dépôt de
  -- domaine) ; detected_at est la date à laquelle NOUS l'avons vu. La fraîcheur
  -- se calcule sur occurred_at quand il est connu, sinon sur detected_at.
  occurred_at  timestamptz,
  detected_at  timestamptz not null default now(),
  expires_at   timestamptz,

  dedupe_key   text,

  primary key (id, detected_at)
) partition by range (detected_at);

comment on table public.company_events is
  'Événements datés. Seul un événement peut déclencher une opportunité — les signaux d''état ne font que moduler le score.';
comment on column public.company_events.occurred_at is
  'Date réelle du fait, si connue. Différente de detected_at : une entreprise créée il y a 40 jours et découverte aujourd''hui n''est pas un signal frais.';

create index company_events_company_idx
  on public.company_events (company_id, detected_at desc);
create index company_events_type_idx
  on public.company_events (event_type, detected_at desc);

-- ─── Déduplication des événements ────────────────────────────────────────
--
-- Un index unique sur une table partitionnée doit inclure la clé de partition.
-- `unique (dedupe_key, detected_at)` ne dédupliquerait donc rien : deux
-- détections du même fait à deux instants différents passeraient toutes les
-- deux. On déporte l'unicité dans un registre non partitionné, et un trigger
-- l'alimente pour qu'aucun chemin d'insertion ne puisse le contourner.

create table public.company_event_keys (
  dedupe_key       text primary key,
  company_id       uuid not null references public.companies(id) on delete cascade,
  first_detected_at timestamptz not null default now()
);

comment on table public.company_event_keys is
  'Registre d''unicité des événements. Étroit et purgeable par âge, contrairement à company_events.';

create index company_event_keys_age_idx on public.company_event_keys (first_detected_at);
create index company_event_keys_company_idx on public.company_event_keys (company_id);

create or replace function public.register_event_dedupe_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dedupe_key is null then
    return new;
  end if;

  -- Lève une violation d'unicité (23505) si le fait a déjà été enregistré.
  insert into public.company_event_keys (dedupe_key, company_id, first_detected_at)
  values (new.dedupe_key, new.company_id, new.detected_at);

  return new;
end;
$$;

create trigger company_events_dedupe
  before insert on public.company_events
  for each row execute function public.register_event_dedupe_key();

-- ═══ Gestion des partitions ═══════════════════════════════════════════════

create or replace function public.ensure_month_partitions(
  months_back  integer default 1,
  months_ahead integer default 3
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_table text;
  target_month date;
  partition_name text;
  created integer := 0;
begin
  foreach parent_table in array array['website_snapshots', 'company_events'] loop
    for offset_months in -months_back .. months_ahead loop
      target_month := (date_trunc('month', now()) + make_interval(months => offset_months))::date;
      partition_name := parent_table || '_' || to_char(target_month, 'YYYYMM');

      if not exists (
        select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relname = partition_name and n.nspname = 'partitions'
      ) then
        execute format(
          'create table partitions.%I partition of public.%I for values from (%L) to (%L)',
          partition_name,
          parent_table,
          target_month,
          (target_month + interval '1 month')::date
        );

        -- Les privilèges par défaut de Supabase accordent TRUNCATE, REFERENCES,
        -- TRIGGER et MAINTAIN à anon et authenticated sur toute table créée.
        -- Le REVOKE du parent ne protège pas les partitions créées ensuite.
        execute format('revoke all on partitions.%I from anon, authenticated', partition_name);

        created := created + 1;
      end if;
    end loop;
  end loop;

  return created;
end;
$$;

comment on function public.ensure_month_partitions is
  'Crée les partitions mensuelles manquantes. Appelée par cron. Volontairement pas de partition DEFAULT : une insertion hors plage doit échouer bruyamment plutôt que de s''entasser silencieusement.';

revoke execute on function public.ensure_month_partitions(integer, integer) from public;
grant execute on function public.ensure_month_partitions(integer, integer) to service_role;

-- Partitions initiales : 12 mois en arrière (reprise d'historique) et 3 en avant.
select public.ensure_month_partitions(12, 3);

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke all on public.website_snapshots, public.company_events, public.company_event_keys
  from anon, authenticated;
grant all on public.website_snapshots, public.company_events, public.company_event_keys
  to service_role;

alter table public.website_snapshots enable row level security;
alter table public.company_events enable row level security;
alter table public.company_event_keys enable row level security;
