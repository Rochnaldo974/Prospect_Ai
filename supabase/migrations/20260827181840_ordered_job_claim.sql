-- ═══════════════════════════════════════════════════════════════════════════
-- Correction : garantir l'ordre de traitement des jobs réclamés.
--
-- `UPDATE … RETURNING` ne préserve pas l'ordre du sous-SELECT. La version
-- précédente sélectionnait bien les N jobs les plus prioritaires, mais les
-- rendait dans un ordre arbitraire : un worker pouvait traiter un job de
-- priorité 10 avant un job de priorité 95 réclamé dans le même lot.
--
-- Le tri est donc réappliqué sur le résultat de la CTE.
-- ═══════════════════════════════════════════════════════════════════════════

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
  with claimed as (
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
    returning j.*
  )
  select * from claimed
  order by priority desc, run_after, id;
$$;

comment on function public.claim_jobs is
  'Réclame jusqu''à batch_size jobs, rendus dans l''ordre de priorité. SKIP LOCKED garantit qu''aucun worker n''attend un autre worker.';
