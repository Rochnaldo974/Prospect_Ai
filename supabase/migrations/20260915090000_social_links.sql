-- Les réseaux sociaux d'une entreprise, quand une source les connaît.
--
-- Un commerce actif sur Instagram ou Facebook mais sans aucun site est le
-- profil qui donne le plus envie à un freelance de décrocher : l'entreprise
-- a déjà pris la peine d'exister en ligne, il lui manque la vitrine. C'est
-- le retour du propriétaire sur les premières fiches réelles : ce sont ces
-- dossiers-là qu'on a envie d'ouvrir, pas « domaine déposé il y a neuf ans ».
--
-- OpenStreetMap porte ces liens (contact:instagram, contact:facebook…) sur
-- une part des points d'intérêt ; mesuré sur Bordeaux, 1 commerce sur 40 est
-- présent sur un réseau sans site, et la moitié avec un téléphone.
alter table public.companies
  add column if not exists social_links jsonb;

comment on column public.companies.social_links is
  'Réseaux sociaux connus, {réseau: url}. Null : aucune source ne s''est prononcée. Un objet vide : la source a été lue et n''en cite aucun.';
