-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1g — Durcissement des privilèges par défaut.
--
-- Constat fait en vérifiant le schéma : les partitions créées dynamiquement
-- portaient `Dxtm` pour anon et authenticated, hérité des privilèges par
-- défaut de Supabase. Aucun droit de lecture, mais TRUNCATE accordé à des
-- rôles non authentifiés — un droit de destruction, pas de consultation.
--
-- Plutôt que de réparer table par table, on inverse le défaut : dans ce
-- projet, une nouvelle table doit être invisible aux utilisateurs tant qu'un
-- GRANT explicite ne l'ouvre pas. C'est cohérent avec le modèle produit —
-- l'utilisateur final ne lit que ses propres assignment_cards.
-- ═══════════════════════════════════════════════════════════════════════════

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

alter default privileges for role postgres in schema partitions
  revoke all on tables from anon, authenticated;

-- Nettoyage des partitions déjà créées avec les anciens privilèges.
do $$
declare
  part record;
  cleaned integer := 0;
begin
  for part in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relispartition and c.relkind = 'r'
      and n.nspname in ('public', 'partitions')
  loop
    execute format('revoke all on %I.%I from anon, authenticated', part.nspname, part.relname);
    cleaned := cleaned + 1;
  end loop;

  raise notice 'Privilèges retirés sur % partitions', cleaned;
end
$$;

-- Contrôle : aucune table du schéma public ne doit accorder de droit à anon.
do $$
declare
  leaked text;
begin
  select string_agg(c.relname, ', ')
    into leaked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'partitions')
    and c.relkind in ('r', 'p')
    and c.relacl is not null
    and array_to_string(c.relacl, ' ') like '%anon=%';

  if leaked is not null then
    raise exception 'Des tables accordent encore des privilèges à anon : %', leaked;
  end if;
end
$$;
