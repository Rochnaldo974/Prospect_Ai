-- ═══════════════════════════════════════════════════════════════════════════
-- Planification des sources externes.
--
-- BODACC publie tous les jours ouvrés : une synchronisation quotidienne suffit,
-- avec une fenêtre de trois jours pour absorber le décalage de publication et
-- les week-ends. La déduplication par clé rend le recouvrement gratuit.
--
-- La découverte OpenStreetMap n'est PAS planifiée ici : elle dépend d'un
-- périmètre géographique qui relève d'une décision produit, pas d'un rythme.
-- Elle se déclenche à la demande (`pnpm discover osm <ville>`) ou depuis le
-- moteur d'inventaire, quand un type d'opportunité manque de stock.
-- ═══════════════════════════════════════════════════════════════════════════

select cron.schedule(
  'sync-bodacc',
  '30 5 * * *',
  $$ select public.schedule_recurring_job(
       'sync_bodacc',
       80::smallint,
       '{"sinceDays": 3, "limit": 8000}'::jsonb,
       'YYYYMMDD'
     ) $$
);
