-- Déduplication quotidienne, sur les entreprises récemment touchées.
--
-- Après la découverte nocturne : c'est à ce moment que les doublons
-- apparaissent, une même enseigne pouvant être vue par plusieurs sources.
select cron.schedule(
  'detect-duplicates',
  '45 5 * * *',
  $$ select public.schedule_recurring_job(
       'detect_duplicates',
       55::smallint,
       '{"limit": 5000, "sinceHours": 48}'::jsonb,
       'YYYYMMDD'
     ) $$
);
