-- La note du site, mesurée par notre navigateur.
--
-- Un freelance juge un dossier en une seconde : un chiffre sur 100, quatre
-- sous-notes, et les mesures derrière. Les outils du marché l'ont tous ;
-- nous avions les faits sans la note. Elle est calculée à la vérification du
-- dossier, dans la même session de navigateur que la capture d'écran, à
-- partir de mesures réelles — temps de chargement, poids, débordement sur
-- téléphone, balises — jamais d'un avis.
alter table public.domains
  add column if not exists site_score smallint,
  add column if not exists site_scores jsonb,
  add column if not exists audited_at timestamptz;

comment on column public.domains.site_score is
  'Note globale du site sur 100, mesurée par le navigateur du moteur. Null : jamais audité.';
comment on column public.domains.site_scores is
  'Sous-notes {speed, mobile, seo, trust} et mesures brutes, avec les constats lisibles.';
