-- Attribution quotidienne, dernier maillon de la nuit.
--
-- Chaîne complète :
--   00h30  sync_bodacc              créations, cessions, exclusions
--   02h00  scan_domains             état des sites connus
--   03h00  companies_from_domains   entreprises identifiées par leur site
--   03h30  resolve_websites         recherche de sites manquants
--   04h30  enrich_from_sirene       dates de création, effectifs, activité
--   05h00  ingest_tenders           appels d'offres publics
--   05h30  detect_signals           faits datés → signaux
--   06h00  generate_opportunities   signaux → opportunités scorées
--   07h00  allocate_daily           opportunités → cinq par freelance
--
-- Sept heures laisse une marge : le lot doit être prêt quand le freelance
-- ouvre son ordinateur, et une heure de battement permet de rattraper un
-- maillon qui aurait échoué sans décaler la livraison.
select cron.schedule(
  'allocate-daily',
  '0 7 * * *',
  $$ select public.schedule_recurring_job(
       'allocate_daily', 90::smallint, '{}'::jsonb, 'YYYYMMDD'
     ) $$
);
