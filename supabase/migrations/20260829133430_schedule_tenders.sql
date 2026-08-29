-- Relevé quotidien des appels d'offres.
--
-- Placé avant la détection des signaux : un avis intégré à 5 h doit produire
-- son opportunité dans la même nuit. Les avis ont une date limite fixée par
-- l'acheteur, et chaque jour de retard est pris sur le temps dont le freelance
-- dispose pour répondre.
select cron.schedule(
  'ingest-tenders',
  '0 5 * * *',
  $$ select public.schedule_recurring_job(
       'ingest_tenders', 85::smallint, '{"limit": 100}'::jsonb, 'YYYYMMDD'
     ) $$
);
