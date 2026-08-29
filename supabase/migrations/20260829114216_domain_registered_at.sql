-- Date d'enregistrement du domaine.
--
-- Le fichier AFNIC porte cette date pour chacun des 4,5 millions de .fr
-- actifs, et l'ingestion la lisait déjà sans avoir où l'écrire. C'est le seul
-- fait daté du fichier, et le seul qui relie une entreprise joignable à un
-- événement récent : une entreprise établie ne « vient pas d'être créée », mais
-- elle peut très bien venir de déposer un nom de domaine.
--
-- À ne pas confondre avec first_seen_at, qui date notre propre découverte.
alter table public.domains
  add column registered_at date;

comment on column public.domains.registered_at is
  'Date de dépôt du domaine (AFNIC). Fait daté sur le monde, à la différence de first_seen_at.';

-- Index partiel : seuls les dépôts récents servent de déclencheur, et ils sont
-- une fraction infime du stock.
create index domains_recently_registered_idx
  on public.domains (registered_at desc)
  where registered_at is not null;
