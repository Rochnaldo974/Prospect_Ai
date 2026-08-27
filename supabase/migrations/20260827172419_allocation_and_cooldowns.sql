-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1e — Attribution, exclusivité et cooldowns.
--
-- C'est la partie du schéma où les garanties doivent être structurelles.
-- Une règle d'attribution qui ne vit que dans le code applicatif finira par
-- être contournée par un bug, un job concurrent ou une action admin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ company_cooldowns ════════════════════════════════════════════════════

create table public.company_cooldowns (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  reason        public.cooldown_reason not null,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  permanent     boolean not null default false,

  assignment_id uuid,
  notes         text,
  created_at    timestamptz not null default now(),

  constraint company_cooldowns_bounds check (
    (permanent and ends_at is null) or (not permanent and ends_at > starts_at)
  )
);

comment on table public.company_cooldowns is
  'Mise au repos temporaire d''une entreprise. À distinguer de companies.suppression_global, qui est définitif et prime toujours.';

create index company_cooldowns_active_idx on public.company_cooldowns (company_id, ends_at desc);
create index company_cooldowns_permanent_idx on public.company_cooldowns (company_id)
  where permanent;

create or replace function public.company_in_cooldown(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_cooldowns
    where company_id = target_company
      and starts_at <= now()
      and (permanent or ends_at > now())
  );
$$;

-- ═══ daily_batches ════════════════════════════════════════════════════════

create table public.daily_batches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  batch_date        date not null,

  generated_at      timestamptz not null default now(),
  algorithm_version text not null,
  status            text not null default 'ready'
                      check (status in ('ready', 'partial', 'empty')),
  requested_count   smallint not null,
  delivered_count   smallint not null default 0,

  created_at        timestamptz not null default now(),

  unique (user_id, batch_date)
);

comment on table public.daily_batches is
  'Un lot par utilisateur et par jour. status = partial quand le stock n''a pas permis de livrer le compte demandé — on assume la pénurie plutôt que de remplir avec du bruit.';

create index daily_batches_user_idx on public.daily_batches (user_id, batch_date desc);

-- ═══ assignments ══════════════════════════════════════════════════════════

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete restrict,
  opportunity_id  uuid not null references public.opportunities(id) on delete restrict,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  batch_id        uuid references public.daily_batches(id) on delete set null,

  rank            smallint not null check (rank between 1 and 20),
  match_score     numeric(5,2) not null check (match_score between 0 and 100),

  -- Groupe témoin : une opportunité sur cinq est tirée au hasard dans le pool
  -- éligible, sans scoring, et reste invisible pour l'utilisateur. Sans cela,
  -- rien ne permet de démontrer que le moteur bat le hasard.
  is_control      boolean not null default false,

  assigned_at     timestamptz not null default now(),
  exclusive_until timestamptz not null,

  status          public.assignment_status not null default 'active',
  outcome         public.assignment_outcome,

  viewed_at       timestamptz,
  contacted_at    timestamptz,
  outcome_at      timestamptz,

  constraint assignments_outcome_requires_contact check (
    outcome is null or contacted_at is not null
  ),
  constraint assignments_completed_has_outcome check (
    status <> 'completed' or outcome is not null
  )
);

comment on table public.assignments is
  'Attribution d''une opportunité à un utilisateur. L''exclusivité est garantie par index, pas par le code applicatif.';
comment on column public.assignments.is_control is
  'Opportunité témoin tirée au hasard. Ne jamais exposer ce champ dans l''API utilisateur.';
comment on column public.assignments.exclusive_until is
  'Fin d''exclusivité (72 h par défaut). Une opportunité non contactée sous 72 h ne le sera jamais : la relâcher vaut mieux que geler l''inventaire.';

-- ═══ LA garantie anti-doublon inter-utilisateurs ══════════════════════════
--
-- Deux workers qui allouent en parallèle ne peuvent pas attribuer la même
-- entreprise : le second se prend une violation d'unicité et passe à la
-- candidate suivante. Aucun verrou applicatif ne remplace cette contrainte.

create unique index assignments_one_live_per_company
  on public.assignments (company_id)
  where status in ('active', 'contacted');

create index assignments_user_idx on public.assignments (user_id, assigned_at desc);
create index assignments_batch_idx on public.assignments (batch_id);
create index assignments_expiry_idx on public.assignments (exclusive_until)
  where status = 'active';
create index assignments_opportunity_idx on public.assignments (opportunity_id);

-- ─── Garde-fou : ne jamais attribuer une entreprise interdite ─────────────
--
-- Le moteur d'allocation filtre déjà ces cas. Ce trigger est le filet :
-- une action admin, un job mal écrit ou une reprise manuelle ne doivent pas
-- pouvoir contourner une suppression.

create or replace function public.guard_assignment_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company record;
begin
  select prospecting_allowed, suppression_global, legal_name
    into company
  from public.companies
  where id = new.company_id;

  if company.suppression_global then
    raise exception 'Entreprise % en liste de suppression : attribution refusée (%)',
      new.company_id, company.legal_name
      using errcode = 'check_violation';
  end if;

  if not company.prospecting_allowed then
    raise exception 'Entreprise % non prospectable : attribution refusée (%)',
      new.company_id, company.legal_name
      using errcode = 'check_violation';
  end if;

  if public.company_in_cooldown(new.company_id) then
    raise exception 'Entreprise % en cooldown actif : attribution refusée',
      new.company_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger assignments_guard_eligibility
  before insert on public.assignments
  for each row execute function public.guard_assignment_eligibility();

-- ─── Garde-fou : plafond quotidien par utilisateur ────────────────────────

create or replace function public.guard_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limit_for_user integer;
  already integer;
begin
  select daily_opportunity_limit into limit_for_user
  from public.profiles where id = new.user_id;

  select count(*) into already
  from public.assignments
  where user_id = new.user_id
    and assigned_at >= date_trunc('day', new.assigned_at)
    and assigned_at <  date_trunc('day', new.assigned_at) + interval '1 day';

  if already >= limit_for_user then
    raise exception 'Plafond quotidien atteint pour l''utilisateur % (% / %)',
      new.user_id, already, limit_for_user
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger assignments_guard_daily_limit
  before insert on public.assignments
  for each row execute function public.guard_daily_limit();

-- ═══ assignment_cards ═════════════════════════════════════════════════════
--
-- Snapshot figé de ce que l'utilisateur voit, matérialisé au moment de
-- l'attribution. Trois problèmes résolus d'un coup :
--   1. RLS triviale (user_id = auth.uid()) au lieu d'un EXISTS sur 1 M+ lignes ;
--   2. lecture instantanée, aucune jointure ;
--   3. historique immuable — la fiche ne change pas quand la donnée évolue.
--
-- C'est la SEULE table du moteur lisible par un utilisateur final.

create table public.assignment_cards (
  assignment_id uuid primary key references public.assignments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  card          jsonb not null,
  created_at    timestamptz not null default now()
);

comment on table public.assignment_cards is
  'Fiche figée livrée à l''utilisateur. Ne doit jamais contenir is_control ni la décomposition interne du score.';

create index assignment_cards_user_idx on public.assignment_cards (user_id, created_at desc);

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke all on public.company_cooldowns, public.daily_batches,
              public.assignments, public.assignment_cards
  from anon, authenticated;
grant all on public.company_cooldowns, public.daily_batches,
             public.assignments, public.assignment_cards
  to service_role;

-- L'utilisateur lit ses lots et ses fiches, et met à jour uniquement le suivi
-- de ses propres attributions (contacté, issue).
grant select on public.daily_batches to authenticated;
grant select on public.assignment_cards to authenticated;
grant select, update on public.assignments to authenticated;

alter table public.company_cooldowns enable row level security;
alter table public.daily_batches enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_cards enable row level security;

create policy daily_batches_select_own on public.daily_batches
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy assignment_cards_select_own on public.assignment_cards
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy assignments_select_own on public.assignments
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy assignments_update_own on public.assignments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- L'utilisateur ne doit pouvoir modifier que le suivi de son contact.
-- Même raisonnement que pour profiles.role : RLS ne restreint pas les colonnes.
create or replace function public.guard_assignment_user_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
    return new;
  end if;

  new.company_id      := old.company_id;
  new.opportunity_id  := old.opportunity_id;
  new.user_id         := old.user_id;
  new.batch_id        := old.batch_id;
  new.rank            := old.rank;
  new.match_score     := old.match_score;
  new.is_control      := old.is_control;
  new.assigned_at     := old.assigned_at;
  new.exclusive_until := old.exclusive_until;

  return new;
end;
$$;

create trigger assignments_guard_user_fields
  before update on public.assignments
  for each row execute function public.guard_assignment_user_fields();
