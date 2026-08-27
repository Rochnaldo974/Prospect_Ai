-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1b — Company Intelligence Database.
--
-- Une entreprise n'existe qu'UNE seule fois. Toutes les sources convergent vers
-- la même ligne ; aucune source n'a sa propre table d'entités.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.companies (
  id                  uuid primary key default gen_random_uuid(),

  -- ── Identité légale ─────────────────────────────────────────────────────
  siren               text,
  siret               text,
  legal_name          text not null,
  commercial_name     text,

  -- ── Présence web ────────────────────────────────────────────────────────
  domain              text,        -- normalisé : ni scheme, ni www, ni slash final
  website_url         text,
  website_confidence  numeric(3,2) check (website_confidence between 0 and 1),
  website_resolution_attempts integer not null default 0,
  website_last_resolved_at timestamptz,

  -- ── Contact ─────────────────────────────────────────────────────────────
  phone               text,        -- E.164
  contact_form_url    text,
  -- Gate de contact du V1 : téléphone OU formulaire. Pas d'e-mail nominatif.
  has_contact         boolean generated always as (
                        phone is not null or contact_form_url is not null
                      ) stored,

  -- ── Localisation ────────────────────────────────────────────────────────
  address             text,
  postal_code         text,
  city                text,
  region              text,
  country             text not null default 'FR',
  lat                 double precision check (lat between -90 and 90),
  lon                 double precision check (lon between -180 and 180),

  -- ── Activité ────────────────────────────────────────────────────────────
  industry_code       text,        -- NAF
  industry_label      text,
  segment             public.company_segment not null default 'other',

  employee_min        integer,
  employee_max        integer,
  creation_date       date,
  company_status      public.company_status not null default 'unknown',

  -- ── Qualité et conformité ───────────────────────────────────────────────
  identity_confidence numeric(3,2) not null default 0.50
                        check (identity_confidence between 0 and 1),
  data_quality_score  smallint not null default 0
                        check (data_quality_score between 0 and 100),

  prospecting_allowed boolean not null default true,
  suppression_global  boolean not null default false,
  suppression_reason  text,

  -- ── Ordonnancement des scans ────────────────────────────────────────────
  last_seen_at        timestamptz,
  last_scanned_at     timestamptz,
  next_scan_at        timestamptz,
  scan_priority       smallint not null default 50
                        check (scan_priority between 0 and 100),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint companies_siren_format check (siren is null or siren ~ '^[0-9]{9}$'),
  constraint companies_siret_format check (siret is null or siret ~ '^[0-9]{14}$'),
  constraint companies_siret_matches_siren check (
    siret is null or siren is null or left(siret, 9) = siren
  ),
  constraint companies_employee_range check (
    employee_min is null or employee_max is null or employee_min <= employee_max
  ),
  constraint companies_geo_complete check (
    (lat is null) = (lon is null)
  ),
  constraint companies_suppression_has_reason check (
    not suppression_global or suppression_reason is not null
  )
);

comment on table public.companies is
  'Entité centrale. Une entreprise réelle = une ligne, quelles que soient les sources qui la décrivent.';
comment on column public.companies.domain is
  'Domaine normalisé. La contrainte d''unicité est ce qui empêche deux entreprises de revendiquer le même site.';
comment on column public.companies.has_contact is
  'Gate de contact du V1 : une opportunité n''est distribuable que si l''entreprise est joignable.';
comment on column public.companies.identity_confidence is
  'Confiance dans le fait que cette ligne décrit une entreprise réelle et unique. Un score commercial élevé sur une identité douteuse ne doit pas être distribué.';

-- ── Index d'unicité : la première ligne de défense contre les doublons ────
create unique index companies_siret_uq  on public.companies (siret)  where siret is not null;
create unique index companies_siren_uq  on public.companies (siren)  where siren is not null;
create unique index companies_domain_uq on public.companies (domain) where domain is not null;

-- ── Index de déduplication (blocking avant comparaison) ──────────────────
create index companies_name_trgm_idx on public.companies
  using gin (legal_name extensions.gin_trgm_ops);
create index companies_commercial_name_trgm_idx on public.companies
  using gin (commercial_name extensions.gin_trgm_ops)
  where commercial_name is not null;
create index companies_postal_code_idx on public.companies (postal_code)
  where postal_code is not null;
create index companies_phone_idx on public.companies (phone) where phone is not null;
create index companies_geo_idx on public.companies (lat, lon) where lat is not null;

-- ── File de scan ─────────────────────────────────────────────────────────
create index companies_scan_queue_idx on public.companies (scan_priority desc, next_scan_at)
  where company_status = 'active' and suppression_global = false;

-- ── Sélection des candidats (matching et inventaire) ─────────────────────
create index companies_segment_city_idx on public.companies (segment, postal_code)
  where prospecting_allowed and not suppression_global;
create index companies_industry_idx on public.companies (industry_code)
  where industry_code is not null;
create index companies_no_website_idx on public.companies (segment)
  where domain is null and prospecting_allowed and not suppression_global;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ═══ company_sources ══════════════════════════════════════════════════════
--
-- Le payload brut n'est jamais écrasé : il permet de rejouer la normalisation
-- après amélioration d'un parser, sans re-collecter la donnée.

create table public.company_sources (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,

  source_name        text not null,
  source_external_id text not null,
  raw_payload        jsonb not null,
  confidence         numeric(3,2) not null default 0.80
                       check (confidence between 0 and 1),

  discovered_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),

  unique (source_name, source_external_id)
);

comment on table public.company_sources is
  'Trace d''origine. Répond à « d''où vient cette entreprise ? » et permet de rejouer la normalisation.';

create index company_sources_company_idx on public.company_sources (company_id);
create index company_sources_name_idx on public.company_sources (source_name, last_seen_at desc);

-- ═══ company_field_provenance ═════════════════════════════════════════════
--
-- Répond à « d'où vient CETTE information ? » champ par champ. La valeur
-- retenue dans companies est celle de plus haute confiance.

create table public.company_field_provenance (
  company_id  uuid not null references public.companies(id) on delete cascade,
  field       text not null,
  value       text,
  source_name text not null,
  confidence  numeric(3,2) not null check (confidence between 0 and 1),
  observed_at timestamptz not null default now(),

  primary key (company_id, field, source_name)
);

comment on table public.company_field_provenance is
  'Provenance par champ. Toute information affichée à l''utilisateur doit être auditable jusqu''à sa source.';

create index company_field_provenance_field_idx
  on public.company_field_provenance (field, confidence desc);

-- ═══ Privilèges ═══════════════════════════════════════════════════════════
--
-- AUCUN grant pour `authenticated`. L'utilisateur final ne lit jamais
-- companies : il ne voit que la carte figée de ses propres attributions.
-- RLS activée sans policy = refus par défaut, y compris si un grant était
-- ajouté par erreur plus tard.

revoke all on public.companies, public.company_sources, public.company_field_provenance
  from anon, authenticated;
grant all on public.companies, public.company_sources, public.company_field_provenance
  to service_role;

alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.company_field_provenance enable row level security;
