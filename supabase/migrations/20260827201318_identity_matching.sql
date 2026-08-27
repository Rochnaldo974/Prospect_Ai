-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 5 — Rapprochement approché.
--
-- Les clés exactes (SIRET, SIREN, domaine) ne couvrent qu'une partie des cas :
-- une entreprise sans identifiant se recrée à chaque import. Il faut donc
-- rapprocher sur des indices faibles — nom, téléphone, adresse, proximité —
-- sans jamais fusionner à tort.
--
-- Deux règles structurent tout ce qui suit :
--
--   1. Le rapprochement se fait EN BASE. Comparer chaque entreprise à toutes
--      les autres est en O(n²) : à 3 millions de lignes, c'est 4,5 × 10¹²
--      comparaisons. Le blocage restreint les candidats à un voisinage étroit
--      avant toute comparaison.
--
--   2. Deux SIRET différents ne fusionnent JAMAIS. Ce sont deux
--      établissements, quel que soit ce que disent le nom et l'adresse — un
--      centre commercial en aligne des dizaines à la même adresse.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Clé de comparaison des noms ─────────────────────────────────────────
--
-- `translate` plutôt qu'`unaccent` : unaccent dépend d'un dictionnaire et
-- n'est donc pas IMMUTABLE, ce qu'exige une colonne générée.

create or replace function public.normalize_name_key(input text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              replace(
                lower(translate(
                  coalesce(input, ''),
                  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
                  'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuy'
                )),
                '&', ' et '
              ),
              '[''’]', ' ', 'g'
            ),
            '[^a-z0-9]+', ' ', 'g'
          ),
          -- Formes juridiques et mots trop courants pour distinguer.
          '\y(sarl|eurl|sas|sasu|sa|snc|scs|sca|sci|scp|scm|selarl|selas|sel|scop|sem|gie|gaec|earl|scea|ei|eirl|association|asso|societe|ste|ets|etablissements|entreprise|cie|compagnie|groupe|holding|france|international)\y',
          ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

comment on function public.normalize_name_key is
  'Clé de comparaison des noms d''entreprise. Doit rester alignée sur normalizeCompanyName côté TypeScript — un test compare les deux sur un corpus.';

alter table public.companies
  add column if not exists name_key text
    generated always as (
      public.normalize_name_key(coalesce(commercial_name, legal_name))
    ) stored;

comment on column public.companies.name_key is
  'Nom normalisé, calculé par la base. Sert au blocage et à la similarité trigramme.';

create index if not exists companies_name_key_trgm_idx
  on public.companies using gin (name_key extensions.gin_trgm_ops);

-- ─── Journal des fusions ─────────────────────────────────────────────────
--
-- Une fusion supprime une ligne. Sans trace, on ne peut ni auditer une erreur,
-- ni comprendre pourquoi une entreprise a disparu de la base.

create table if not exists public.company_merges (
  id            uuid primary key default gen_random_uuid(),
  survivor_id   uuid not null references public.companies(id) on delete cascade,
  /* La ligne absorbée n'existe plus : on conserve son identifiant et son état. */
  absorbed_id   uuid not null,
  absorbed_snapshot jsonb not null,
  score         numeric(4,3) not null,
  evidence      jsonb not null default '[]',
  decided_by    text not null,          -- 'auto' ou l'identifiant de l'admin
  merged_at     timestamptz not null default now()
);

create index if not exists company_merges_survivor_idx on public.company_merges (survivor_id);
create index if not exists company_merges_absorbed_idx on public.company_merges (absorbed_id);

comment on table public.company_merges is
  'Trace des fusions. Une entreprise absorbée disparaît de companies : sans ce journal, sa disparition serait inexplicable.';

-- ─── File de revue ───────────────────────────────────────────────────────

create type public.duplicate_status as enum ('pending', 'merged', 'rejected');

create table if not exists public.company_duplicate_candidates (
  id           uuid primary key default gen_random_uuid(),
  /* Paire ordonnée par identifiant, pour qu'un couple n'apparaisse qu'une fois. */
  company_a_id uuid not null references public.companies(id) on delete cascade,
  company_b_id uuid not null references public.companies(id) on delete cascade,
  score        numeric(4,3) not null,
  evidence     jsonb not null default '[]',
  status       public.duplicate_status not null default 'pending',
  decided_at   timestamptz,
  decided_by   text,
  created_at   timestamptz not null default now(),

  constraint duplicate_pair_ordered check (company_a_id < company_b_id)
);

create unique index if not exists duplicate_pair_uq
  on public.company_duplicate_candidates (company_a_id, company_b_id);
create index if not exists duplicate_pending_idx
  on public.company_duplicate_candidates (score desc, created_at)
  where status = 'pending';

comment on table public.company_duplicate_candidates is
  'Paires trop proches pour être ignorées, trop incertaines pour être fusionnées automatiquement. Arbitrées depuis la console.';

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke all on public.company_merges, public.company_duplicate_candidates
  from anon, authenticated;
grant all on public.company_merges, public.company_duplicate_candidates to service_role;

alter table public.company_merges enable row level security;
alter table public.company_duplicate_candidates enable row level security;
