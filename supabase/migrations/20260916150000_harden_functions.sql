-- Relevé de sécurité Supabase avant le lancement.
--
-- Les fonctions de déclencheur sont SECURITY DEFINER : PostgREST les
-- expose en RPC à anon et authenticated, alors qu'elles n'ont de sens
-- qu'appelées par leur trigger (qui ne vérifie pas EXECUTE au moment du
-- tir). On retire le droit d'appel direct. Trois fonctions utilitaires
-- n'avaient pas de search_path figé : on le fige sur public.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'guard_assignment_eligibility', 'guard_assignment_user_fields', 'guard_daily_limit',
    'guard_profile_privileges', 'handle_new_profile', 'handle_new_user',
    'on_company_related_change', 'register_company_domains', 'register_event_dedupe_key'
  ] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = fn) then
      execute format('revoke execute on function public.%I() from anon, authenticated, public', fn);
    end if;
  end loop;
end $$;

alter function public.set_updated_at() set search_path = public;
alter function public.normalize_name_key(text) set search_path = public;
alter function public.geo_distance_m(double precision, double precision, double precision, double precision) set search_path = public;
