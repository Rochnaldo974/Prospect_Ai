# Prospect_Ai — Architecture technique

> Moteur qui surveille les entreprises françaises, détecte celles qui présentent aujourd'hui
> les meilleurs signaux commerciaux, et attribue automatiquement les 5 meilleures à chaque freelance.

**Segment V1 :** commerces & artisans locaux (France).
**Contrainte de contact :** téléphone OU formulaire de site.
**Budget :** 50-150 €/mois.
**Validation :** 1 opportunité sur 5 est un contrôle aléatoire aveugle.

---

## 1. Vue d'ensemble

```
┌─── SOURCES ─────────────┐
│ OSM / Overpass (POI)    │  découverte volume, gratuit
│ SIRENE (identité)       │  socle légal, gratuit
│ AFNIC .fr (domaines)    │  signal "nouveau domaine", gratuit
│ Cert Transparency       │  signal "nouveau site", gratuit
│ POI API payante         │  téléphone + preuve d'absence de site, ciblé
│ CSV / manuel            │  admin
└──────────┬──────────────┘
           │  RawCompany
           ▼
    NORMALIZE  ──────►  IDENTITY RESOLUTION (dedupe)  ──────►  companies (1 entité = 1 ligne)
                                                                    │
           ┌────────────────────────────────────────────────────────┤
           ▼                                                        ▼
    WEBSITE RESOLVER                                          company_sources
    (dont: SIREN dans mentions légales)                       (payloads bruts conservés)
           │
           ▼
    CHEAP SCAN (HTTP+HTML, ~150ms)  ──►  website_snapshots  ──►  diff hash  ──►  company_events
           │                                                                          │
           ▼ (top 1% seulement)                                                       │
    DEEP SCAN (PSI, analyse fine)  ─────────────────────────────────────────────►  ───┤
                                                                                      ▼
                                                                              SIGNAL ENGINE
                                                                                      │
                                                                                      ▼
                                                                            OPPORTUNITY ENGINE
                                                                            (need/timing/fresh/conf)
                                                                                      │
                                                                                      ▼
                                                                              QUALITY GATE
                                                                                      │
                                                                                      ▼
                                                        MATCHING  ──►  ALLOCATION (greedy par regret)
                                                                                      │
                                                                                      ▼
                                                              LLM rerank + rédaction (top ~10/user)
                                                                                      │
                                                                                      ▼
                                                                assignments + assignment_cards (figées)
```

**Règle structurante :** le moteur est *event-driven*. Un signal statique (« site lent »)
ne crée jamais une opportunité à lui seul — il **module** le score d'une opportunité
déclenchée par un événement daté.

---

## 2. Découpage runtime

| Composant | Hébergement | Rôle |
|---|---|---|
| `apps/web` | Vercel | app utilisateur + admin (Next.js App Router) |
| `apps/worker` | Fly.io / VPS | pipeline : discovery, crawl, scan, signaux, allocation |
| Postgres | Supabase | source de vérité unique + file de jobs |
| `packages/core` | — | toute la logique métier, importée par les deux |

**Pas de Redis, pas de BullMQ, pas de microservices.** La file de jobs est une table
Postgres avec `FOR UPDATE SKIP LOCKED` — suffisant à plusieurs centaines de milliers
de jobs/jour, et elle donne l'idempotence + l'observabilité gratuitement.

`pg_cron` **planifie** (insère des jobs), il n'**exécute** jamais de logique métier.

---

## 3. Schéma PostgreSQL

### 3.1 Identité & sources

```sql
create table companies (
  id            uuid primary key default gen_random_uuid(),

  siren         text,
  siret         text,
  legal_name    text not null,
  commercial_name text,

  domain        text,                    -- normalisé, sans www ni scheme
  website_url   text,
  website_confidence numeric(3,2),
  website_resolution_attempts int not null default 0,
  website_last_resolved_at timestamptz,

  phone         text,                    -- E.164
  phone_source  text,
  contact_form_url text,

  address       text,
  postal_code   text,
  city          text,
  region        text,
  country       text not null default 'FR',
  lat           double precision,
  lon           double precision,

  industry_code text,                    -- NAF
  industry_label text,
  segment       text,                    -- 'local_commerce' | 'b2b' | ...

  employee_min  int,
  employee_max  int,
  creation_date date,
  company_status text not null default 'active',   -- active|closed|unknown

  identity_confidence numeric(3,2) not null default 0.5,
  data_quality_score  int not null default 0,      -- 0-100, cf §8

  prospecting_allowed boolean not null default true,
  suppression_global  boolean not null default false,
  suppression_reason  text,

  last_seen_at    timestamptz,
  last_scanned_at timestamptz,
  next_scan_at    timestamptz,
  scan_priority   int not null default 50,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_siret_uq on companies (siret) where siret is not null;
create unique index companies_siren_uq on companies (siren) where siren is not null;
create unique index companies_domain_uq on companies (domain) where domain is not null;
create index companies_scan_q on companies (scan_priority desc, next_scan_at)
  where company_status = 'active' and suppression_global = false;
create index companies_geo on companies using gist (ll_to_earth(lat, lon));
create index companies_name_trgm on companies using gin (legal_name gin_trgm_ops);
create index companies_city_naf on companies (postal_code, industry_code);
```

```sql
create table company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  source_name text not null,
  source_external_id text not null,
  raw_payload jsonb not null,
  confidence numeric(3,2) not null default 0.8,
  discovered_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (source_name, source_external_id)
);
```

Le payload brut n'est **jamais** écrasé : il permet de rejouer la normalisation
après amélioration des parsers, sans re-collecter.

### 3.2 Provenance par champ

```sql
create table company_field_provenance (
  company_id uuid not null references companies(id) on delete cascade,
  field      text not null,               -- 'phone' | 'domain' | 'lat' | ...
  value      text,
  source_name text not null,
  confidence numeric(3,2) not null,
  observed_at timestamptz not null default now(),
  primary key (company_id, field, source_name)
);
```

Répond à « d'où vient cette information ? » pour n'importe quel champ affiché à
l'utilisateur. La valeur retenue dans `companies` est celle de plus haute confiance.

### 3.3 Observation du web (partitionné par mois)

```sql
create table website_snapshots (
  id uuid default gen_random_uuid(),
  company_id uuid not null,
  domain text not null,
  http_status int,
  final_url text,
  redirect_chain jsonb,
  title text,
  meta_description text,
  html_hash text,                    -- hash du contenu textuel normalisé
  tech_hash text,
  cms text,
  framework text,
  technologies jsonb not null default '[]',
  has_ssl boolean,
  ssl_expires_at timestamptz,
  has_viewport_meta boolean,
  has_media_queries boolean,
  html_bytes int,
  ttfb_ms int,
  ecommerce_detected boolean not null default false,
  booking_detected boolean not null default false,
  contact_form_detected boolean not null default false,
  siren_found_in_legal text,         -- ← lien déterministe site → entreprise
  copyright_year int,
  performance_score int, mobile_score int, seo_score int, accessibility_score int,
  scan_depth text not null default 'cheap',   -- cheap | deep
  captured_at timestamptz not null default now(),
  primary key (id, captured_at)
) partition by range (captured_at);
```

### 3.4 Événements, signaux, opportunités

```sql
create table company_events (
  id uuid default gen_random_uuid(),
  company_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}',
  importance int not null default 50,
  confidence numeric(3,2) not null default 0.8,
  source text not null,
  detected_at timestamptz not null default now(),
  occurred_at timestamptz,           -- date réelle si connue (≠ date de détection)
  expires_at timestamptz,
  dedupe_key text,
  primary key (id, detected_at)
) partition by range (detected_at);

create unique index company_events_dedupe on company_events (dedupe_key, detected_at)
  where dedupe_key is not null;
```

```sql
create table signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  signal_type text not null,
  category text not null,            -- need | timing | risk | quality
  value jsonb not null default '{}',
  strength   numeric(3,2) not null,  -- 0-1, à quel point le signal est marqué
  confidence numeric(3,2) not null,  -- 0-1, à quel point on est sûr de l'observation
  detected_at timestamptz not null default now(),
  expires_at  timestamptz,
  source text not null,
  evidence jsonb not null default '[]',
  fingerprint text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index signals_fp on signals (company_id, fingerprint) where active;
```

```sql
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  opportunity_type text not null,

  need_score       numeric(5,2) not null,
  timing_score     numeric(5,2) not null,
  freshness_factor numeric(4,3) not null,   -- multiplicateur ]0,1]
  confidence_score numeric(3,2) not null,
  base_score       numeric(5,2) not null,

  trigger_event_id uuid,                    -- l'événement daté déclencheur
  signal_ids uuid[] not null default '{}',
  reason_data jsonb not null default '{}',  -- décomposition du score, auditable

  ai_relevance_score int,
  ai_explanation text, ai_why_now text, ai_contact_angle text,
  ai_model text, ai_prompt_version text,

  status text not null default 'available', -- available|assigned|expired|rejected
  algorithm_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index opp_pool on opportunities (opportunity_type, base_score desc)
  where status = 'available';
```

### 3.5 Attribution

```sql
create table assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  opportunity_id uuid not null references opportunities(id),
  user_id uuid not null references profiles(id),
  batch_id uuid references daily_batches(id),
  rank int not null,
  match_score numeric(5,2) not null,
  is_control boolean not null default false,   -- ← groupe témoin, invisible en UI
  assigned_at timestamptz not null default now(),
  exclusive_until timestamptz not null,        -- assigned_at + 72h si non contactée
  status text not null default 'active',       -- active|contacted|expired|released
  outcome text,                                -- no_response|not_interested|interested|meeting|proposal|client
  viewed_at timestamptz, contacted_at timestamptz, outcome_at timestamptz
);

-- LA garantie anti-doublon inter-utilisateurs :
create unique index one_live_assignment_per_company
  on assignments (company_id) where status in ('active','contacted');
```

**Snapshot figé livré à l'utilisateur** — résout RLS, perf et immuabilité de l'historique :

```sql
create table assignment_cards (
  assignment_id uuid primary key references assignments(id) on delete cascade,
  user_id uuid not null references profiles(id),
  card jsonb not null,        -- nom, ville, tel, site, signaux, why, why_now, angle, scores
  created_at timestamptz not null default now()
);
alter table assignment_cards enable row level security;
create policy own_cards on assignment_cards for select using (user_id = auth.uid());
```

L'utilisateur ne lit **jamais** `companies`. Aucune policy `EXISTS` sur 1M+ lignes.

### 3.6 File de jobs

```sql
create table job_queue (
  id bigserial primary key,
  job_type text not null,
  payload jsonb not null default '{}',
  priority int not null default 50,
  status text not null default 'pending',    -- pending|running|done|failed|dead
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz, locked_by text,
  last_error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index job_ready on job_queue (priority desc, run_after)
  where status = 'pending';
```

Réclamation d'un lot par un worker :

```sql
update job_queue j set status='running', locked_at=now(), locked_by=$worker,
       attempts = attempts + 1
from (
  select id from job_queue
  where status='pending' and run_after <= now()
  order by priority desc, run_after
  limit $batch
  for update skip locked
) s
where j.id = s.id
returning j.*;
```

---

## 4. Résolution du site web

Ordre des stratégies, la première qui atteint la confiance requise gagne :

| # | Stratégie | Confiance | Coût |
|---|---|---|---|
| 1 | Domaine fourni par la source (OSM `website`, POI API) | 0.90 | 0 |
| 2 | **SIREN trouvé dans les mentions légales du site** | 0.99 | 1 fetch |
| 3 | Téléphone du site == téléphone de l'entreprise | 0.92 | 1 fetch |
| 4 | Adresse du site == adresse de l'entreprise (normalisée) | 0.85 | 1 fetch |
| 5 | Nom commercial + ville, via trigram, sur index de domaines | 0.60 | 0 |
| 6 | Heuristique `nomcommercial.fr` + validation du contenu | 0.55 | 1 DNS + 1 fetch |

Retour : `{ domain, confidence, evidence[] }`. **En dessous de 0.80, on n'attribue pas** —
on écrit `website_unknown` et on incrémente `website_resolution_attempts`.

**Chemin inverse (le plus fort) :** on crawle les domaines `.fr` (open data AFNIC +
Certificate Transparency), on extrait le SIREN des mentions légales, et on joint vers
SIRENE. C'est déterministe et gratuit. Ce chemin alimente aussi le signal
« nouveau domaine déposé, pas encore de site ».

---

## 5. Déduplication

`resolveCompanyIdentity(candidate) → { action: 'merge'|'create'|'review', companyId?, confidence, evidence[] }`

Cascade déterministe, du plus fort au plus faible :

| Clé | Confiance | Action |
|---|---|---|
| SIRET exact | 1.00 | merge |
| SIREN exact | 0.98 | merge |
| domaine exact | 0.95 | merge |
| téléphone E.164 exact + même code postal | 0.93 | merge |
| adresse normalisée exacte + nom trigram > 0.6 | 0.88 | merge |
| géo < 50 m + nom trigram > 0.75 | 0.85 | merge |
| nom trigram > 0.9 + même code postal | 0.80 | review |
| — | < 0.75 | create |

Le trigram passe par `pg_trgm` + index GIN — pas de service externe, pas de LLM.
Le LLM n'intervient que sur la file `review`, en volume marginal, et jamais en batch massif.

Blocking pour éviter le O(n²) : les candidats sont restreints par `postal_code` ou
par tuile géographique avant tout calcul de similarité.

---

## 6. Signaux — catalogue V1 (commerce local)

### Déclencheurs (événements datés — obligatoires pour créer une opportunité)

| Signal | Source | Détection |
|---|---|---|
| `company_recently_created` | SIRENE | `creation_date` entre J-15 et J-90 |
| `new_domain_registered` | AFNIC | domaine déposé < 60 j |
| `new_tls_certificate` | Cert Transparency | 1er certificat observé sur le domaine |
| `website_went_down` | cheap scan | 200 → 5xx/DNS fail entre 2 snapshots |
| `website_changed` | cheap scan | `html_hash` différent, écart > seuil |
| `cms_changed` | cheap scan | `cms` différent entre 2 snapshots |
| `ssl_expired` | cheap scan | `ssl_expires_at` dépassé |
| `new_establishment` | SIRENE | nouvel établissement du même SIREN |

### Modulateurs (état — ne déclenchent jamais seuls)

`no_website_proven` (fiche POI complète, champ website vide) · `weak_website`
(pas de viewport meta, pas de media queries) · `slow_website` (TTFB élevé, HTML lourd)
· `outdated_stack` (Wix/Jimdo/IONOS/WP thème ancien) · `stale_content`
(copyright ≥ 3 ans) · `broken_ssl` · `no_contact_form` · `active_business`
(fiche POI vivante, horaires renseignés).

**`no_website` n'est émis que sur preuve positive d'absence.** Une résolution
infructueuse produit `website_unknown`, qui n'est pas distribuable.

---

## 7. Scoring V0

```ts
// 0-100 chacun
need    = Σ(poids[signal] × strength) borné à 100        // besoin du service
timing  = f(événement déclencheur, son âge, son importance)

freshnessFactor  = exp(-ln(2) * ageDays / halfLife[eventType])   // ∈ ]0,1]
confidenceFactor = 0.4 + 0.6 * confidence                        // ∈ [0.4,1]

base = (need * 0.55 + timing * 0.45) * freshnessFactor * confidenceFactor
```

La confiance et la fraîcheur sont des **atténuateurs multiplicatifs**, jamais des
mérites additifs : une opportunité `need=95, confidence=0.2` doit passer *derrière*
une `need=70, confidence=0.95`, pas devant.

Demi-vies V0 : `company_recently_created` 45 j · `new_domain_registered` 30 j ·
`website_went_down` 7 j · `website_changed` 14 j · `ssl_expired` 10 j.

Poids et demi-vies vivent dans une table `scoring_config` versionnée, pas dans le code.

### Quality gate (avant entrée en stock)

```
base_score >= 55
confidence_score >= 0.60
identity_confidence >= 0.75
au moins 1 déclencheur daté actif
prospecting_allowed && !suppression_global
téléphone OU formulaire de contact connu     ← gate contact V1
pas de cooldown actif
```

### UserFit

```ts
if (!user.services.includes(opp.opportunity_type)) return null;   // filtre binaire
if (user.excluded_industries.includes(company.industry_code)) return null;

fit = 0.60 * geoScore(user, company)        // 1.0 même ville → 0.3 France
    + 0.25 * industryPreferenceScore
    + 0.15 * dataQualityScore/100;

matchScore = 0.70 * base + 0.30 * (fit * 100);
```

---

## 8. Allocation

Une fois par nuit, en une transaction par utilisateur :

1. Construire les paires candidates `(user, opportunity)` — filtre binaire service + géo,
   plafonné aux ~200 meilleures par utilisateur.
2. **Trier par regret**, pas par score : `regret(u) = score(meilleur dispo) − score(6ᵉ dispo)`.
   On sert d'abord l'utilisateur qui perd le plus à ne pas être servi. Cela évite que les
   profils de niche (app mobile, petite ville) ne soient jamais servis.
3. Pour chaque utilisateur, verrouiller les opportunités candidates
   (`select … for update skip locked`), attribuer, insérer dans `assignments`.
   L'index unique partiel `one_live_assignment_per_company` est le garde-fou final :
   une violation = l'entreprise a été prise entre-temps → on passe à la suivante.
4. Remplacer une des 5 (position aléatoire) par un tirage uniforme dans le pool éligible,
   `is_control = true`.
5. Appeler le LLM sur les ~10 finalistes de chaque utilisateur pour la rédaction
   (`why`, `why_now`, `angle`) — **après** l'allocation, jamais avant.
6. Matérialiser `assignment_cards`.

**Pénurie assumée :** si moins de 5 opportunités passent le gate, on en livre 3 ou 4 avec
un message honnête. Remplir avec du bruit détruit la confiance en trois jours.

À terme : min-cost-flow (problème de transport, quelques ms pour 1000×5). Pas en V0.

---

## 9. Rafraîchissement & contrôle des coûts

| État de l'entreprise | Priorité | Intervalle de rescan |
|---|---|---|
| opportunité active distribuée | 95 | 7 j |
| entreprise récente (< 90 j) | 90 | 10 j |
| candidate intéressante | 70 | 30 j |
| site stable, pas de signal | 30 | 90 j |
| aucun intérêt détecté | 10 | 180 j |

Le **hash** est le levier de coût principal : si `html_hash` et `tech_hash` sont
inchangés, on s'arrête là — pas de diff, pas d'événement, pas de LLM.

Entonnoir cible : `1M découvertes → 300k pré-filtrées → 200k avec site → 50k scannées
finement → 5k opportunités → ~10/user au LLM → 5 livrées`.

```sql
create table cost_events (
  id bigserial primary key,
  provider text not null, operation text not null,
  units int not null default 1,
  estimated_cost_eur numeric(10,6) not null,
  company_id uuid, job_id bigint,
  created_at timestamptz not null default now()
);
```
Vues admin : `coût / entreprise enrichie`, `coût / opportunité générée`, `coût / RDV obtenu`.

---

## 10. Jobs

`sync_sirene` · `discover_poi` · `sync_afnic_domains` · `watch_cert_transparency` ·
`normalize_candidates` · `resolve_identities` · `resolve_websites` · `cheap_web_scan` ·
`deep_web_scan` · `detect_events` · `detect_signals` · `generate_opportunities` ·
`expire_opportunities` · `calculate_inventory` · `allocate_daily_opportunities` ·
`ai_enrich_finalists` · `expire_assignments` · `apply_cooldowns` · `schedule_rescans`

Chacun : idempotent (via `dedupe_key`), retryable (backoff exponentiel), paginé,
rate-limit aware, et trace dans `job_runs`.

---

## 11. Structure du dépôt

```
apps/
  web/                    Next.js App Router (Vercel)
    app/(auth)/ onboarding/ dashboard/ history/ settings/
    app/admin/companies/ opportunities/ users/ jobs/ inventory/ analytics/
  worker/                 Node long-running (Fly.io)
    src/runner.ts         boucle de claim sur job_queue
    src/handlers/         un fichier par job_type
packages/
  core/
    companies/            repository, normalization, identity
    sources/              sirene/ osm/ afnic/ cert-transparency/ poi/ csv/
    enrichment/           website-resolver, cheap-scanner, deep-scanner, tech-detect
    signals/              engine, detectors/
    opportunities/        engine, scoring, quality-gate
    matching/             user-fit, matcher
    allocation/           allocator, locks
    inventory/            engine
    ai/                   provider, anthropic, openai, schemas (Zod), prompts (versionnés)
    db/                   client, types générés
supabase/migrations/
tests/
```

---

## 12. Tests critiques (écrits avant les features correspondantes)

1. dedupe : même SIRET → une seule company ; SIREN sans SIRET → merge correct
2. normalisation domaine : `https://www.X.fr/` == `X.fr`
3. normalisation téléphone : `01 23 45 67 89` == `+33123456789`
4. **concurrence** : 20 workers tentent d'attribuer la même company → exactement 1 gagne
5. plafond : aucun utilisateur ne reçoit plus de `daily_opportunity_limit`
6. cooldown / suppression : jamais attribuées
7. filtre service : un freelance « refonte » ne reçoit jamais une opportunité mobile
8. RLS : l'utilisateur A ne lit pas les cartes de l'utilisateur B
9. scoring : `confidence` basse fait bien reculer une opportunité à `need` élevé
10. allocation : un profil de niche finit servi (test anti-starvation)
11. groupe contrôle : exactement 1 sur 5, tirage uniforme, invisible dans la réponse API

---

## 13. Plan de développement

| Phase | Contenu | Sortie observable |
|---|---|---|
| 0 | monorepo, Next.js, Supabase, auth, migrations, CI ✅ | app qui démarre |
| 1 | schéma complet + RLS + seed ✅ | tables en place |
| 2 | **admin `/admin/companies`** (liste, filtres, détail) ✅ | on voit les données |
| 3 | file de jobs + worker + `job_runs` ✅ | jobs observables |
| 4 | ingestion SIRENE + CSV + normalisation ✅ | entreprises réelles en base |
| 5 | résolution d'identité (dedupe) | doublons fusionnés |
| 6 | découverte POI + résolution de site | domaines rattachés |
| 7 | cheap scanner + snapshots + hash | observation du web |
| 8 | détection d'événements + signaux | timeline par entreprise |
| 9 | moteur d'opportunités + quality gate | stock d'opportunités |
| 10 | **admin debug scoring** (décomposition complète) — livré en avance avec la phase 2 ✅ | on comprend le moteur |
| 11 | onboarding minimal + préférences | premiers utilisateurs |
| 12 | matching + allocation + groupe contrôle | 5/jour attribuées |
| 13 | dashboard utilisateur + feedback | produit utilisable |
| 14 | inventaire + rescan + cron | fonctionnement autonome |
| 15 | LLM rerank + rédaction | qualité finale |
| 16 | analytics de conversion + contrôle vs scoré | validation du moteur |

L'IA arrive en phase 15. L'admin arrive en phase 2 — avant le dashboard utilisateur.
