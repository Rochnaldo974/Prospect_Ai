-- Scan des sites et recherche de sites manquants.
--
-- Étalés dans la nuit : ces jobs sortent sur Internet à un rythme volontairement
-- lent — une requête par seconde et par hôte — et il n'y a aucune raison de les
-- faire tourner en même temps que la découverte.

select cron.schedule(
  'scan-domains',
  '0 2 * * *',
  $$ select public.schedule_recurring_job(
       'scan_domains', 65::smallint, '{"limit": 500}'::jsonb, 'YYYYMMDD'
     ) $$
);

select cron.schedule(
  'resolve-websites',
  '30 3 * * *',
  $$ select public.schedule_recurring_job(
       'resolve_websites', 60::smallint, '{"limit": 200}'::jsonb, 'YYYYMMDD'
     ) $$
);
