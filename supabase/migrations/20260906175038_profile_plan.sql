-- Le plan de l'utilisateur : gratuit ou payant.
--
-- Le gratuit reçoit UN dossier par SEMAINE — assez pour juger sur pièce,
-- pas assez pour prospecter. Ce n'est pas un simple quota plus bas : la
-- fenêtre change (semaine, pas jour), et c'est le moteur qui l'applique.
--
-- Le quota du payant reste daily_opportunity_limit : deux réglages
-- distincts, parce qu'un plan n'est pas un nombre.
create type profile_plan as enum ('free', 'premium');

alter table profiles
  add column if not exists plan profile_plan not null default 'free';
