-- ═══════════════════════════════════════════════════════════════════════════
-- Les garde-fous anti-altération ne visaient pas la bonne population.
--
-- Ils laissaient passer service_role et bloquaient TOUT le reste. Or « le
-- reste » comprend les opérations serveur qui ne passent pas par PostgREST :
-- une fonction SQL appelée depuis pg_cron, une maintenance en psql, ou —
-- constaté ici — merge_companies transférant les attributions d'une entreprise
-- absorbée. La fusion échouait avec une violation de clé étrangère parce que
-- le garde-fou avait silencieusement annulé le changement de company_id.
--
-- La condition est inversée : le garde-fou ne s'applique QUE lorsque
-- l'appelant est un utilisateur final authentifié. C'est précisément la
-- population contre laquelle il protège, et rien d'autre.
-- ═══════════════════════════════════════════════════════════════════════════

/** Vrai si la requête provient d'un utilisateur final connecté. */
create or replace function public.is_end_user_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'authenticated';
$$;

comment on function public.is_end_user_request is
  'Distingue une requête d''utilisateur final d''une opération serveur. Sans claims JWT — pg_cron, psql, fonction interne — la réponse est faux.';

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;

  new.role                    := old.role;
  new.daily_opportunity_limit := old.daily_opportunity_limit;
  new.id                      := old.id;
  new.created_at              := old.created_at;

  return new;
end;
$$;

create or replace function public.guard_assignment_user_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
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

revoke execute on function public.is_end_user_request() from public;
grant execute on function public.is_end_user_request() to authenticated, service_role;
