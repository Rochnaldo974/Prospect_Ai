-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1f — File de jobs, traçabilité d'exécution et coûts.
--
-- La file est une table Postgres exploitée avec FOR UPDATE SKIP LOCKED.
-- Pas de Redis, pas de broker : à l'échelle visée c'est suffisant, et cela
-- offre gratuitement l'idempotence, l'observabilité et les transactions.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ job_queue ════════════════════════════════════════════════════════════

create table public.job_queue (
  id            bigint generated always as identity primary key,
  job_type      text not null,
  payload       jsonb not null default '{}',

  priority      smallint not null default 50 check (priority between 0 and 100),
  status        public.job_status not null default 'pending',

  attempts      smallint not null default 0,
  max_attempts  smallint not null default 3,

  run_after     timestamptz not null default now(),
  locked_at     timestamptz,
  locked_by     text,

  last_error    text,

  -- Idempotence : deux planifications du même travail ne créent qu'un job.
  dedupe_key    text unique,

  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

comment on table public.job_queue is
  'File de travail du pipeline. Réclamation par lots avec FOR UPDATE SKIP LOCKED : deux workers ne prennent jamais le même job.';
comment on column public.job_queue.dedupe_key is
  'Clé d''idempotence. Exemple : scan:cheap:<company_id>:2026-08-27. Empêche les doublons de planification.';

create index job_queue_ready_idx on public.job_queue (priority desc, run_after, id)
  where status = 'pending';
create index job_queue_running_idx on public.job_queue (locked_at)
  where status = 'running';
create index job_queue_type_idx on public.job_queue (job_type, status);

-- ─── Réclamation atomique d'un lot ───────────────────────────────────────

create or replace function public.claim_jobs(
  worker      text,
  batch_size  integer default 10,
  types       text[] default null
)
returns setof public.job_queue
language sql
volatile
security definer
set search_path = ''
as $$
  update public.job_queue j
  set status    = 'running',
      locked_at = now(),
      locked_by = worker,
      attempts  = j.attempts + 1
  from (
    select id
    from public.job_queue
    where status = 'pending'
      and run_after <= now()
      and (types is null or job_type = any(types))
    order by priority desc, run_after, id
    limit batch_size
    for update skip locked
  ) candidate
  where j.id = candidate.id
  returning j.*;
$$;

comment on function public.claim_jobs is
  'Réclame jusqu''à batch_size jobs. SKIP LOCKED garantit qu''aucun worker n''attend un autre worker.';

-- ─── Fin de job : succès, échec avec backoff, ou abandon ─────────────────

create or replace function public.complete_job(job_id bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.job_queue
  set status = 'done', completed_at = now(), locked_at = null, locked_by = null, last_error = null
  where id = job_id;
$$;

create or replace function public.fail_job(job_id bigint, error_message text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  job record;
begin
  select attempts, max_attempts into job from public.job_queue where id = job_id;

  if job.attempts >= job.max_attempts then
    -- Épuisé : on ne réessaie plus, mais on garde la trace pour l'admin.
    update public.job_queue
    set status = 'dead', last_error = error_message, locked_at = null, locked_by = null,
        completed_at = now()
    where id = job_id;
  else
    -- Backoff exponentiel plafonné à une heure.
    update public.job_queue
    set status = 'pending',
        last_error = error_message,
        locked_at = null,
        locked_by = null,
        run_after = now() + least(interval '1 hour',
                                  make_interval(secs => power(4, job.attempts)::double precision))
    where id = job_id;
  end if;
end;
$$;

-- ─── Récupération des jobs orphelins ─────────────────────────────────────
--
-- Un worker tué net laisse des jobs en 'running' pour toujours. Ce balayage
-- les remet en file : c'est ce qui rend le pipeline reprenable.

create or replace function public.reclaim_stalled_jobs(stalled_after interval default interval '15 minutes')
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reclaimed integer;
begin
  with revived as (
    update public.job_queue
    set status = 'pending', locked_at = null, locked_by = null,
        last_error = coalesce(last_error, 'worker interrompu, job repris')
    where status = 'running' and locked_at < now() - stalled_after
    returning 1
  )
  select count(*) into reclaimed from revived;
  return reclaimed;
end;
$$;

-- ═══ job_runs ═════════════════════════════════════════════════════════════

create table public.job_runs (
  id              uuid primary key default gen_random_uuid(),
  job_type        text not null,
  job_id          bigint,
  worker_id       text,

  status          text not null default 'running'
                    check (status in ('running', 'succeeded', 'failed')),

  started_at      timestamptz not null default now(),
  completed_at    timestamptz,

  processed_count integer not null default 0,
  success_count   integer not null default 0,
  failed_count    integer not null default 0,

  metadata        jsonb not null default '{}',
  error           text
);

comment on table public.job_runs is
  'Historique d''exécution, indépendant de la file : un job supprimé ne fait pas disparaître sa trace.';

create index job_runs_type_idx on public.job_runs (job_type, started_at desc);
create index job_runs_status_idx on public.job_runs (status, started_at desc);

-- ═══ cost_events ══════════════════════════════════════════════════════════

create table public.cost_events (
  id                 bigint generated always as identity primary key,
  provider           text not null,
  operation          text not null,
  units              integer not null default 1,
  estimated_cost_eur numeric(10,6) not null,

  company_id         uuid references public.companies(id) on delete set null,
  job_id             bigint,

  created_at         timestamptz not null default now()
);

comment on table public.cost_events is
  'Chaque appel payant (API de POI, LLM, enrichissement). Permet de mesurer coût / entreprise enrichie et coût / opportunité générée.';

create index cost_events_provider_idx on public.cost_events (provider, created_at desc);
create index cost_events_company_idx on public.cost_events (company_id)
  where company_id is not null;

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke all on public.job_queue, public.job_runs, public.cost_events
  from anon, authenticated;
grant all on public.job_queue, public.job_runs, public.cost_events to service_role;

revoke execute on function public.claim_jobs(text, integer, text[]) from public;
revoke execute on function public.complete_job(bigint) from public;
revoke execute on function public.fail_job(bigint, text) from public;
revoke execute on function public.reclaim_stalled_jobs(interval) from public;
revoke execute on function public.company_in_cooldown(uuid) from public;

grant execute on function public.claim_jobs(text, integer, text[]) to service_role;
grant execute on function public.complete_job(bigint) to service_role;
grant execute on function public.fail_job(bigint, text) to service_role;
grant execute on function public.reclaim_stalled_jobs(interval) to service_role;
grant execute on function public.company_in_cooldown(uuid) to service_role;

alter table public.job_queue enable row level security;
alter table public.job_runs enable row level security;
alter table public.cost_events enable row level security;
