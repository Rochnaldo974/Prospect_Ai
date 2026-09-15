-- Le rapprochement d'identité par le nom laisse une trace.
--
-- Les deux tiers des commerces découverts sur OpenStreetMap n'ont pas de
-- SIREN : la porte de qualité les refuse (identité sous 0,75) alors que le
-- répertoire officiel, interrogé par nom et code postal, les reconnaît sans
-- ambiguïté dans bien des cas. Le job qui fait ce rapprochement doit savoir
-- qui il a déjà tenté, sinon il reposerait chaque nuit la même question sur
-- les mêmes introuvables. Une date par entreprise, indépendante de
-- last_seen_at, qui appartient aux sources ayant réellement observé
-- l'entreprise.
alter table public.companies
  add column if not exists identity_lookup_at timestamptz;

comment on column public.companies.identity_lookup_at is
  'Dernière tentative de rapprochement d''identité par le nom auprès du répertoire. Null : jamais tentée.';

create index if not exists companies_identity_lookup_idx
  on public.companies (identity_lookup_at nulls first)
  where siren is null;
