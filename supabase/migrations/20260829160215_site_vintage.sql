-- Datation d'un site.
--
-- « Site vieux » est un jugement qu'un commerçant peut contester ; « jQuery
-- 1.7.2, sorti en 2011 » est un fait qu'il peut lire dans le code source de sa
-- propre page. Le produit ne vaut que par cette différence.
--
-- tech_year retient l'année du composant le PLUS RÉCENT, jamais du plus
-- ancien : un site refait l'an dernier peut traîner une vieille bibliothèque
-- pour une raison légitime, et l'accuser d'être obsolète serait faux.
alter table public.domains
  add column tech_year          smallint,
  add column dated_components   jsonb not null default '[]'::jsonb;

comment on column public.domains.tech_year is
  'Année du composant daté le plus récent. Borne inférieure de la dernière refonte, null si rien n''est datable.';
comment on column public.domains.dated_components is
  'Composants dont la version est lisible et l''année de publication certaine.';

-- Les sites datés d'avant-hier sont la cible : index partiel sur eux seuls.
create index domains_tech_year_idx
  on public.domains (tech_year)
  where tech_year is not null;
