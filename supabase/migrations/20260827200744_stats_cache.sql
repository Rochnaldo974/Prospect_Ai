-- ═══════════════════════════════════════════════════════════════════════════
-- Compteurs de la vue d'ensemble, précalculés.
--
-- La vue admin_stats enchaîne dix-huit sous-requêtes de comptage. Mesuré à
-- 300 000 entreprises : 82 ms, soit environ 800 ms à trois millions. C'est le
-- dernier point lent de la console.
--
-- Ces chiffres décrivent l'état du moteur, pas une transaction : ils n'ont pas
-- besoin d'être exacts à la seconde. Un rafraîchissement toutes les cinq
-- minutes suffit, et rend l'affichage gratuit.
-- ═══════════════════════════════════════════════════════════════════════════

create materialized view if not exists public.admin_stats_cache as
select 1 as singleton, *, now() as computed_at from public.admin_stats;

-- REFRESH … CONCURRENTLY exige un index unique sur une COLONNE, pas sur une
-- expression : d'où la colonne constante `singleton` plutôt qu'un index sur
-- ((true)), que PostgreSQL refuse.
create unique index if not exists admin_stats_cache_uq
  on public.admin_stats_cache (singleton);

comment on materialized view public.admin_stats_cache is
  'Compteurs de la vue d''ensemble. Rafraîchis toutes les cinq minutes — ces chiffres décrivent un état, pas une transaction.';

create or replace function public.refresh_admin_stats()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  refresh materialized view concurrently public.admin_stats_cache;
$$;

revoke all on public.admin_stats_cache from anon, authenticated;
grant select on public.admin_stats_cache to service_role;

revoke execute on function public.refresh_admin_stats() from public;
grant execute on function public.refresh_admin_stats() to service_role;

select cron.schedule(
  'refresh-admin-stats',
  '*/5 * * * *',
  $$ select public.schedule_recurring_job('refresh_admin_stats', 15::smallint) $$
);
