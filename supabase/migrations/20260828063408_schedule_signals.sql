-- Enrichissement puis détection, dans cet ordre.
--
-- Le moteur de signaux passe en dernier de la chaîne nocturne : il consomme ce
-- que la découverte, le scan et l'enrichissement ont produit. L'inverser
-- ferait tourner la détection sur les données de la veille.
--
--   00h30  sync_bodacc          créations, cessions, exclusions
--   02h00  scan_domains         état des sites connus
--   03h30  resolve_websites     recherche de sites manquants
--   04h30  enrich_from_sirene   dates de création, effectifs, activité
--   05h30  detect_signals       faits datés → signaux

select cron.schedule(
  'enrich-from-sirene',
  '30 4 * * *',
  $$ select public.schedule_recurring_job(
       'enrich_from_sirene', 70::smallint, '{"limit": 500}'::jsonb, 'YYYYMMDD'
     ) $$
);

select cron.schedule(
  'detect-signals',
  '30 5 * * *',
  $$ select public.schedule_recurring_job(
       'detect_signals', 75::smallint, '{"limit": 20000}'::jsonb, 'YYYYMMDD'
     ) $$
);

-- BODACC remonte plus tôt : c'est lui qui fait naître les entreprises neuves,
-- et tout le reste de la chaîne travaille dessus.
select cron.unschedule('sync-bodacc');
select cron.schedule(
  'sync-bodacc',
  '30 0 * * *',
  $$ select public.schedule_recurring_job(
       'sync_bodacc', 80::smallint,
       '{"sinceDays": 3, "limit": 8000, "createMissing": true}'::jsonb,
       'YYYYMMDD'
     ) $$
);
