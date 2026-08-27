-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 3 — Cycle de vie des jobs et opérations de maintenance.
--
-- Chaque opération de masse est une fonction SQL ensembliste : atomique, une
-- seule aller-retour, et impossible à laisser à moitié faite si le worker meurt
-- en cours de route. Le worker orchestre et journalise, il ne boucle pas sur
-- des lignes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Échec définitif ─────────────────────────────────────────────────────
--
-- fail_job replanifie avec backoff. Certains échecs ne valent pas d'être
-- réessayés : un payload malformé le restera à la troisième tentative.

create or replace function public.kill_job(job_id bigint, error_message text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.job_queue
  set status = 'dead',
      last_error = error_message,
      locked_at = null,
      locked_by = null,
      completed_at = now()
  where id = job_id;
$$;

comment on function public.kill_job is
  'Abandonne un job sans réessai. Pour les erreurs qu''une nouvelle tentative ne corrigera pas (payload invalide, entité disparue).';

-- ─── Planification idempotente ───────────────────────────────────────────

create or replace function public.enqueue_job(
  p_job_type    text,
  p_payload     jsonb   default '{}',
  p_priority    smallint default 50,
  p_run_after   timestamptz default now(),
  p_dedupe_key  text    default null,
  p_max_attempts smallint default 3
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  insert into public.job_queue (job_type, payload, priority, run_after, dedupe_key, max_attempts)
  values (p_job_type, p_payload, p_priority, p_run_after, p_dedupe_key, p_max_attempts)
  on conflict (dedupe_key) do nothing
  returning id into new_id;

  -- null = un job équivalent est déjà planifié, ce n'est pas une erreur.
  return new_id;
end;
$$;

comment on function public.enqueue_job is
  'Planifie un job. Avec dedupe_key, une planification déjà présente renvoie null plutôt que de créer un doublon.';

-- ═══ Opérations de maintenance ════════════════════════════════════════════

-- ─── Opportunités périmées ───────────────────────────────────────────────

create or replace function public.expire_stale_opportunities()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  with expired as (
    update public.opportunities
    set status = 'expired', updated_at = now()
    where status = 'available' and expires_at <= now()
    returning 1
  )
  select count(*) into affected from expired;

  return affected;
end;
$$;

-- ─── Attributions non utilisées ──────────────────────────────────────────
--
-- Une opportunité non contactée dans son délai d'exclusivité ne le sera jamais.
-- La relâcher vaut mieux que geler l'inventaire : c'est la contrainte
-- structurelle du produit, le stock français ne supporte pas une exclusivité
-- longue. L'historique n'est jamais supprimé, seul le statut change.

create or replace function public.expire_stale_assignments()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  -- Les deux CTE modifiantes s'exécutent toujours intégralement, même si la
  -- requête principale ne lit pas la seconde : c'est garanti par PostgreSQL.
  -- Elles partagent le même instantané, donc `restocked` voit exactement les
  -- attributions libérées par `released`, ni plus ni moins.
  with released as (
    update public.assignments
    set status = 'expired'
    where status = 'active'
      and contacted_at is null
      and exclusive_until <= now()
    returning id, opportunity_id
  ),
  restocked as (
    -- L'opportunité retourne au stock si elle est encore valide.
    update public.opportunities o
    set status = 'available', updated_at = now()
    from released r
    where o.id = r.opportunity_id
      and o.status = 'assigned'
      and o.expires_at > now()
    returning o.id
  )
  select count(*) into affected from released;

  return affected;
end;
$$;

-- ─── Purge du registre de déduplication d'événements ─────────────────────
--
-- Le registre est étroit mais croît indéfiniment. Au-delà d'un an, rejouer un
-- événement ancien n'est plus un doublon : c'est un fait nouveau.

create or replace function public.prune_event_keys(older_than interval default interval '400 days')
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  with pruned as (
    delete from public.company_event_keys
    where first_detected_at < now() - older_than
    returning 1
  )
  select count(*) into affected from pruned;

  return affected;
end;
$$;

-- ═══ Privilèges ═══════════════════════════════════════════════════════════

revoke execute on function public.kill_job(bigint, text) from public;
revoke execute on function public.enqueue_job(text, jsonb, smallint, timestamptz, text, smallint) from public;
revoke execute on function public.expire_stale_opportunities() from public;
revoke execute on function public.expire_stale_assignments() from public;
revoke execute on function public.prune_event_keys(interval) from public;

grant execute on function public.kill_job(bigint, text) to service_role;
grant execute on function public.enqueue_job(text, jsonb, smallint, timestamptz, text, smallint) to service_role;
grant execute on function public.expire_stale_opportunities() to service_role;
grant execute on function public.expire_stale_assignments() to service_role;
grant execute on function public.prune_event_keys(interval) to service_role;
