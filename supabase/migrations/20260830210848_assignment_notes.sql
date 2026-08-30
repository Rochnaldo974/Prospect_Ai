-- La note du freelance vit sur SON attribution.
--
-- recordOutcome l'écrivait uniquement dans company_cooldowns : une table
-- système que l'utilisateur ne relit jamais. « Rappeler jeudi, demander
-- Marc » était donc enregistré... et perdu pour la seule personne à qui il
-- servait. L'écran À relancer la relit d'ici.
alter table assignments add column if not exists notes text;
