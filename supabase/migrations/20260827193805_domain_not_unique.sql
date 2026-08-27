-- ═══════════════════════════════════════════════════════════════════════════
-- Correction : le domaine n'est pas unique non plus.
--
-- Constat fait sur une vraie découverte OpenStreetMap : 9 insertions sur 800
-- échouaient sur companies_domain_uq. Les enseignes de réseau partagent le
-- site de la marque — cinq magasins Carrefour renvoient tous vers
-- carrefour.fr tout en étant cinq établissements distincts, avec cinq SIRET.
--
-- Un domaine désigne une présence web, qui appartient à une marque ou à une
-- unité légale, pas à un point de vente. La contrainte d'unicité posait donc
-- la même erreur de niveau que celle qui existait sur le SIREN.
--
-- Conséquence en aval, à traiter le moment venu : le scanner de sites doit
-- analyser un domaine une fois et non une fois par établissement, et le moteur
-- d'opportunités ne doit pas produire cinq refontes pour un seul site.
-- ═══════════════════════════════════════════════════════════════════════════

drop index if exists public.companies_domain_uq;

create index if not exists companies_domain_idx on public.companies (domain)
  where domain is not null;

comment on column public.companies.domain is
  'Domaine normalisé. Non unique : les enseignes de réseau partagent le site de la marque. Le rapprochement par domaine n''est retenu que s''il est sans ambiguïté.';
