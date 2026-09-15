-- La rédaction des fiches suit l'attribution : vingt minutes après, le temps
-- que la distribution de tous les abonnés soit terminée. Rejouable : une
-- fiche rédigée ne l'est jamais deux fois.
select cron.schedule(
  'write-cards',
  '20 7 * * *',
  $$ select public.schedule_recurring_job('write_cards', 85::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);
