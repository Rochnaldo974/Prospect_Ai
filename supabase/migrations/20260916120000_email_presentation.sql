-- La courte présentation du freelance, écrite une fois dans sa signature
-- et reprise en tête de chaque e-mail, juste après « Je suis … ». Un
-- e-mail de prospection qui ne dit pas qui écrit part à la corbeille.
alter table public.email_identities
  add column if not exists presentation text not null default '';
