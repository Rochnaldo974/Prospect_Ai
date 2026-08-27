-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1d — Signaux, opportunités et configuration du scoring.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ signals ══════════════════════════════════════════════════════════════

create table public.signals (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,

  signal_type  text not null,
  kind         public.signal_kind not null,
  category     public.signal_category not null,

  value        jsonb not null default '{}',

  -- strength  : à quel point le signal est marqué (un site à 200 ms vs 8 s)
  -- confidence: à quel point on est sûr de l'observation elle-même
  strength     numeric(3,2) not null check (strength between 0 and 1),
  confidence   numeric(3,2) not null check (confidence between 0 and 1),

  source       text not null,
  evidence     jsonb not null default '[]',

  -- Événement déclencheur, pour les signaux de kind = 'trigger'.
  -- Pas de clé étrangère : company_events est partitionnée, une FK imposerait
  -- de traîner detected_at partout pour un gain nul.
  trigger_event_id uuid,

  detected_at  timestamptz not null default now(),
  expires_at   timestamptz,
  active       boolean not null default true,

  fingerprint  text not null,
  created_at   timestamptz not null default now(),

  constraint signals_trigger_needs_event check (
    kind <> 'trigger' or trigger_event_id is not null
  )
);

comment on table public.signals is
  'Signaux détectés. kind = trigger : peut déclencher une opportunité. kind = modifier : module seulement le score.';
comment on column public.signals.strength is
  'Intensité du signal, distincte de la confiance. Un site très lent observé de façon certaine : strength élevée, confidence élevée.';
comment on column public.signals.fingerprint is
  'Empreinte stable du signal pour une entreprise donnée. Empêche de recréer le même signal à chaque scan.';

create unique index signals_fingerprint_uq on public.signals (company_id, fingerprint)
  where active;
create index signals_company_idx on public.signals (company_id) where active;
create index signals_type_idx on public.signals (signal_type, detected_at desc) where active;
create index signals_expiry_idx on public.signals (expires_at) where active and expires_at is not null;

-- ═══ opportunities ════════════════════════════════════════════════════════

create table public.opportunities (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  opportunity_type  public.opportunity_type not null,

  -- ── Les quatre composantes, jamais un score unique ─────────────────────
  need_score        numeric(5,2) not null check (need_score between 0 and 100),
  timing_score      numeric(5,2) not null check (timing_score between 0 and 100),

  -- Fraîcheur et confiance sont des ATTÉNUATEURS multiplicatifs, pas des
  -- mérites additifs. Une opportunité need=95 / confidence=0.2 doit passer
  -- derrière une need=70 / confidence=0.95, jamais devant.
  freshness_factor  numeric(4,3) not null check (freshness_factor > 0 and freshness_factor <= 1),
  confidence_score  numeric(3,2) not null check (confidence_score between 0 and 1),

  base_score        numeric(5,2) not null check (base_score between 0 and 100),

  trigger_event_id  uuid,
  signal_ids        uuid[] not null default '{}',
  reason_data       jsonb not null default '{}',

  -- ── Analyse IA (phase 15), toujours après le scoring déterministe ──────
  ai_relevance_score  smallint check (ai_relevance_score between 0 and 100),
  ai_explanation      text,
  ai_why_now          text,
  ai_contact_angle    text,
  ai_model            text,
  ai_prompt_version   text,

  status            public.opportunity_status not null default 'available',
  algorithm_version text not null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  expires_at        timestamptz not null,

  constraint opportunities_expiry_after_creation check (expires_at > created_at)
);

comment on table public.opportunities is
  'Opportunité commerciale calculée. Une entreprise peut en produire plusieurs (refonte ET e-commerce).';
comment on column public.opportunities.reason_data is
  'Décomposition complète du score : quel signal a apporté combien de points. C''est ce qui rend l''admin auditable plutôt qu''une boîte noire.';
comment on column public.opportunities.freshness_factor is
  'exp(-ln(2) * age / demi-vie). Multiplicatif : une opportunité qui vieillit perd du score, elle n''en gagne jamais.';

-- Une seule opportunité vivante par (entreprise, type) : sinon le même besoin
-- serait distribué plusieurs fois.
create unique index opportunities_live_uq on public.opportunities (company_id, opportunity_type)
  where status in ('available', 'assigned');

create index opportunities_pool_idx on public.opportunities (opportunity_type, base_score desc)
  where status = 'available';
create index opportunities_company_idx on public.opportunities (company_id);
create index opportunities_expiry_idx on public.opportunities (expires_at)
  where status = 'available';

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ═══ scoring_config ═══════════════════════════════════════════════════════
--
-- Poids, demi-vies et seuils vivent en base, pas dans le code : les ajuster ne
-- doit pas exiger un déploiement, et chaque opportunité garde la trace de la
-- version d'algorithme qui l'a produite.

create table public.scoring_config (
  version     text primary key,
  weights     jsonb not null,
  half_lives  jsonb not null,
  thresholds  jsonb not null,
  active      boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create unique index scoring_config_single_active on public.scoring_config ((true)) where active;

comment on table public.scoring_config is
  'Configuration versionnée du scoring. Une seule version active à la fois, garantie par index unique.';

insert into public.scoring_config (version, weights, half_lives, thresholds, active, notes)
values (
  'v0',
  jsonb_build_object(
    'need', 0.55,
    'timing', 0.45,
    'confidence_floor', 0.40,
    'user_fit_geo', 0.60,
    'user_fit_industry', 0.25,
    'user_fit_quality', 0.15,
    'match_base_weight', 0.70,
    'match_fit_weight', 0.30
  ),
  jsonb_build_object(
    'company_recently_created', 45,
    'new_domain_registered', 30,
    'new_tls_certificate', 30,
    'website_went_down', 7,
    'website_changed', 14,
    'cms_changed', 21,
    'ssl_expired', 10,
    'new_establishment', 45,
    'default', 30
  ),
  jsonb_build_object(
    'min_base_score', 55,
    'min_confidence', 0.60,
    'min_identity_confidence', 0.75,
    'exclusivity_hours', 72,
    'opportunity_ttl_days', 30
  ),
  true,
  'Scoring initial. base = (need*0.55 + timing*0.45) * freshness_factor * (0.40 + 0.60*confidence).'
);

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke all on public.signals, public.opportunities, public.scoring_config
  from anon, authenticated;
grant all on public.signals, public.opportunities, public.scoring_config to service_role;

alter table public.signals enable row level security;
alter table public.opportunities enable row level security;
alter table public.scoring_config enable row level security;
