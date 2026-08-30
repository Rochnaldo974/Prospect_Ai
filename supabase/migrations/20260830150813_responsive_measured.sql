-- Adaptation au mobile, réellement mesurée.
--
-- has_media_queries ne testait que le HTML de la page. Or la quasi-totalité
-- des sites tiennent leur CSS dans un fichier séparé : la colonne valait false
-- pour des enseignes nationales dont le site est évidemment responsive —
-- vérifié sur generale-optique.com et boutique.sfr.fr, zéro media query dans
-- le HTML, site parfaitement adapté.
--
-- Bâtir un signal « site non adapté au mobile » là-dessus aurait répété
-- l'erreur du code 403 pris pour une panne : une accusation fausse, que le
-- commerçant réfute en sortant son téléphone. La colonne est donc conservée
-- comme mesure brute, et la conclusion est tirée d'une lecture effective des
-- feuilles de style.
alter table public.domains
  add column responsive boolean;

comment on column public.domains.responsive is
  'Le site s''adapte-t-il au mobile ? Conclusion tirée des feuilles de style lues, pas du seul HTML. null = non déterminé.';
comment on column public.domains.has_media_queries is
  'Media queries présentes dans le HTML de la page. Mesure brute : un false ne signifie PAS que le site est inadapté, la plupart des sites ayant leur CSS à part. Voir responsive.';
