-- Les fonctions du pipeline ne s'appellent pas depuis le navigateur.
--
-- Constat fait sur la base hébergée, à la veille de la mise en production :
-- claim_jobs, complete_job, fail_job, reclaim_stalled_jobs,
-- ensure_month_partitions et company_in_cooldown étaient exécutables par
-- anon et authenticated via /rest/v1/rpc — n'importe qui muni de la clé
-- publiable pouvait vider la file ou marquer des jobs terminés.
--
-- Les migrations d'origine révoquaient bien `from public`, mais sur le projet
-- hébergé les privilèges par défaut de Supabase avaient déjà accordé EXECUTE
-- explicitement à anon et authenticated à la création de chaque fonction
-- antérieure au durcissement (20260827172422). Un revoke sur PUBLIC ne retire
-- pas un droit accordé nommément à un rôle : la base locale, elle, n'avait
-- jamais reçu ces grants, d'où l'écart invisible aux tests.
--
-- On répare de façon générique et idempotente : toute fonction SECURITY
-- DEFINER non-trigger du schéma public est réservée à service_role, sauf les
-- deux que les policies RLS évaluent pour l'utilisateur connecté.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end
$$;

-- Les policies RLS (profiles, user_preferences, assignments…) appellent
-- is_admin() dans le contexte de l'utilisateur ; les gardes de triggers
-- appellent is_end_user_request(). Ces deux-là restent ouvertes aux comptes
-- connectés — et à eux seuls, jamais à anon.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_end_user_request() to authenticated;

-- Contrôle : plus aucune fonction privilégiée accessible sans clé service.
do $$
declare
  leaked text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and p.proname not in ('is_admin', 'is_end_user_request')
    and (has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute'));

  if leaked is not null then
    raise exception 'Fonctions encore exécutables par anon ou authenticated : %', leaked;
  end if;

  if has_function_privilege('anon', 'public.is_admin()', 'execute') then
    raise exception 'is_admin() reste exécutable par anon';
  end if;
end
$$;
