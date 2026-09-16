-- La présence Google d'un commerce : note, avis, photos, lien Maps.
--
-- Ce que les outils du marché montrent en premier, et ce qui donne envie
-- d'appeler : « 4,7 sur 214 avis, et un site de 2012 ». La note dit que
-- l'entreprise marche, donc qu'elle peut payer ; le site dit qu'elle en a
-- besoin. Sans la première moitié, la seconde est une opinion.
--
-- Relevée uniquement sur les dossiers livrés, à la vérification : c'est un
-- appel payant, il se borne à ce qui sert. Datée, pour ne pas la redemander
-- avant un mois.
alter table public.companies
  add column if not exists google_place_id text,
  add column if not exists google_rating numeric(2,1),
  add column if not exists google_review_count integer,
  add column if not exists google_photo_count integer,
  add column if not exists google_maps_url text,
  add column if not exists google_checked_at timestamptz;

comment on column public.companies.google_checked_at is
  'Dernière interrogation de Google Places pour cette entreprise. Null : jamais faite. Une fiche introuvable est datée aussi.';
