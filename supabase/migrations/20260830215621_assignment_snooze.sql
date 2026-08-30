-- « Plus tard » : le freelance met un dossier de côté sans le perdre.
--
-- Un matin réel ne traite pas cinq appels d'affilée : il en passe deux et
-- garde les autres pour la fin de journée. Sans endroit pour ça, le dossier
-- différé disparaît du champ de vision — le même trou que les relances.
--
-- La mise de côté ne prolonge RIEN : l'exclusivité court, l'expiration
-- aussi. C'est un marque-page, pas une extension de droits.
alter table assignments add column if not exists snoozed_at timestamptz;
