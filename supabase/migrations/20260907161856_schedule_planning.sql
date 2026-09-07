-- Le planificateur remplace le quota fixe.
--
-- « scan-domains » programmait 500 domaines par nuit, quel que soit le
-- nombre d'abonnés ou l'état du stock. Le job plan_scanning calcule
-- désormais la mission chaque nuit — demande des abonnés, stock d'avance
-- visé, rendement mesuré des quatorze derniers jours — et met lui-même en
-- file les jobs de scan de la nuit. Un seul propriétaire du volume.
select cron.unschedule('scan-domains');

select cron.schedule(
  'plan-scanning',
  '45 1 * * *',
  $$ select public.schedule_recurring_job('plan_scanning', 80::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);
