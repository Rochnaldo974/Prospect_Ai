-- Le rafraîchissement des statistiques d'administration passait par un job
-- du worker, donc par l'API et ses huit secondes de délai : avec trois cent
-- quarante mille entreprises, la vue matérialisée ne se rafraîchissait plus
-- (job en échec toutes les cinq minutes). pg_cron l'exécute directement,
-- dans la base, sans ce délai.
select cron.unschedule('refresh-admin-stats');
select cron.schedule(
  'refresh-admin-stats',
  '*/15 * * * *',
  $$ refresh materialized view concurrently public.admin_stats_cache $$
);
