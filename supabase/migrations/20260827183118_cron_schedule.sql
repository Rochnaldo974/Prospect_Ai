-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 3 — Planification récurrente.
--
-- pg_cron PLANIFIE, il n'EXÉCUTE jamais de logique métier : chaque entrée se
-- contente d'insérer un job dans la file. Le worker reste le seul endroit où
-- le travail se fait.
--
-- Cette séparation est ce qui permettra de remplacer pg_cron par autre chose
-- (Cloud Scheduler, un déclencheur externe) sans toucher au moteur.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- ─── Planificateur ───────────────────────────────────────────────────────
--
-- La dedupe_key porte l'horodatage de la fenêtre : deux exécutions du cron
-- dans la même minute ne créent qu'un job, mais la fenêtre suivante en crée
-- bien un nouveau.

create or replace function public.schedule_recurring_job(
  p_job_type   text,
  p_priority   smallint default 50,
  p_payload    jsonb default '{}',
  p_window     text default 'YYYYMMDDHH24MI'
)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  select public.enqueue_job(
    p_job_type,
    p_payload,
    p_priority,
    now(),
    p_job_type || ':' || to_char(now(), p_window),
    3::smallint
  );
$$;

comment on function public.schedule_recurring_job is
  'Planifie un job récurrent de façon idempotente. La fenêtre dans la dedupe_key évite les doublons sans bloquer la prochaine occurrence.';

revoke execute on function public.schedule_recurring_job(text, smallint, jsonb, text) from public;
grant execute on function public.schedule_recurring_job(text, smallint, jsonb, text) to service_role;

-- ─── Entrées du planificateur ────────────────────────────────────────────

select cron.schedule(
  'reclaim-stalled-jobs',
  '*/5 * * * *',
  $$ select public.schedule_recurring_job('reclaim_stalled_jobs', 95::smallint) $$
);

select cron.schedule(
  'expire-assignments',
  '*/15 * * * *',
  $$ select public.schedule_recurring_job('expire_assignments', 60::smallint) $$
);

select cron.schedule(
  'expire-opportunities',
  '17 * * * *',
  $$ select public.schedule_recurring_job('expire_opportunities', 40::smallint, '{}'::jsonb, 'YYYYMMDDHH24') $$
);

-- Quotidien : les partitions doivent exister bien avant qu'on en ait besoin,
-- sinon une insertion hors plage fait échouer le pipeline le 1er du mois.
select cron.schedule(
  'ensure-partitions',
  '5 3 * * *',
  $$ select public.schedule_recurring_job('ensure_partitions', 90::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);

select cron.schedule(
  'prune-event-keys',
  '40 4 * * 0',
  $$ select public.schedule_recurring_job('prune_event_keys', 10::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);

-- ─── Observabilité de la planification ───────────────────────────────────
--
-- `cron.job` n'est pas exposé par PostgREST. Sans cette vue, la console admin
-- ne peut pas répondre à « le pipeline est-il réellement armé ? », qui est la
-- première question à se poser quand plus rien n'arrive le matin.

create view public.admin_cron_schedule
with (security_invoker = true)
as
select
  jobid,
  jobname,
  schedule,
  active,
  command
from cron.job;

comment on view public.admin_cron_schedule is
  'Entrées du planificateur, pour la console admin. En lecture seule.';

revoke all on public.admin_cron_schedule from anon, authenticated;
grant select on public.admin_cron_schedule to service_role;
