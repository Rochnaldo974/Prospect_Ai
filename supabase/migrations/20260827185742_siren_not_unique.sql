-- ═══════════════════════════════════════════════════════════════════════════
-- Correction : le SIREN n'est pas unique dans un modèle par établissement.
--
-- La phase 1 posait un index UNIQUE sur companies.siren. C'est faux : le SIREN
-- identifie l'UNITÉ LÉGALE, le SIRET l'ÉTABLISSEMENT. Une chaîne de trois
-- boulangeries a un seul SIREN et trois SIRET.
--
-- Le produit prospecte des établissements — c'est le point de vente qu'on
-- appelle, pas le siège social. La contrainte rendait donc impossible
-- d'ingérer plus d'un établissement par entreprise, ce qui aurait amputé le
-- socle SIRENE d'une part considérable sans que rien ne le signale.
--
-- Le SIRET reste unique : c'est la bonne clé d'identité à ce niveau.
-- ═══════════════════════════════════════════════════════════════════════════

drop index if exists public.companies_siren_uq;

-- Toujours indexé, mais sans unicité : c'est un critère de rapprochement et de
-- regroupement (« tous les établissements de cette entreprise »), pas une clé.
create index if not exists companies_siren_idx on public.companies (siren)
  where siren is not null;

comment on column public.companies.siren is
  'Unité légale. Non unique : plusieurs établissements la partagent. La clé d''identité d''un établissement est le SIRET.';
comment on column public.companies.siret is
  'Établissement. Unique — c''est le niveau auquel le produit prospecte.';
