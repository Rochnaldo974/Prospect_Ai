-- Génération des opportunités, après la détection des signaux.
--
-- Chaîne nocturne complète :
--   00h30  sync_bodacc             créations, cessions, exclusions
--   02h00  scan_domains            état des sites connus
--   03h00  companies_from_domains  entreprises identifiées par leur site
--   03h30  resolve_websites        recherche de sites manquants
--   04h30  enrich_from_sirene      dates de création, effectifs, activité
--   05h30  detect_signals          faits datés → signaux
--   06h00  generate_opportunities  signaux → opportunités scorées

select cron.schedule(
  'companies-from-domains',
  '0 3 * * *',
  $$ select public.schedule_recurring_job(
       'companies_from_domains', 68::smallint, '{"limit": 500}'::jsonb, 'YYYYMMDD'
     ) $$
);

select cron.schedule(
  'generate-opportunities',
  '0 6 * * *',
  $$ select public.schedule_recurring_job(
       'generate_opportunities', 78::smallint, '{"limit": 20000}'::jsonb, 'YYYYMMDD'
     ) $$
);
