-- Un refus d'accès n'est pas une panne.
--
-- Le scanner classait tout code HTTP ≥ 400 en « broken ». Or 401, 403 et 429
-- ne disent rien sur l'état du site : ils disent que le serveur a refusé NOTRE
-- requête — pare-feu applicatif, protection anti-robot, limitation de débit.
-- Le site fonctionne parfaitement pour un visiteur ordinaire.
--
-- Constaté sur une enseigne nationale de bijouterie renvoyant 403 à notre
-- récupérateur : le moteur en avait fait une opportunité de refonte à 84/100.
-- Annoncer à un commerçant que son site est en panne alors qu'il s'ouvre
-- normalement dans son navigateur coûte au freelance sa crédibilité en un
-- appel, et au produit sa raison d'être.
alter type public.domain_status add value if not exists 'blocked';

comment on type public.domain_status is
  'État constaté d''un domaine. blocked = accès refusé au scanner, l''état réel du site reste inconnu.';
