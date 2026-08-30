-- Priorité de scan.
--
-- Le parc compte 4,59 millions de .fr actifs. À trois domaines par seconde,
-- les balayer tous demande seize jours de scan continu — et l'essentiel de cet
-- effort porterait sur des domaines qui ne nous concernent pas : parkings,
-- redirections, sites personnels, entreprises hors segment.
--
-- Deux indices sont disponibles AVANT toute visite, donc gratuits :
--
--   le nom  un domaine contenant « boulangerie », « garage » ou « coiffure »
--           appartient presque certainement à un commerce local. 259 000
--           domaines sur 4,59 millions, soit 22 heures de scan au lieu de 16
--           jours, sur exactement le segment visé ;
--   l'âge   un domaine déposé il y a quinze ans a bien plus de chances de
--           porter un site vieillissant qu'un domaine de l'an dernier.
--
-- Ce n'est pas un filtre mais un ordre de passage : tout le parc finira par
-- être visité, en commençant par là où le rendement est le plus élevé.
alter table public.domains
  add column scan_priority smallint not null default 50;

comment on column public.domains.scan_priority is
  'Ordre de passage du scan, 0 à 100. Calculé avant toute visite, à partir du nom et de l''âge du domaine.';

-- Vocabulaire des métiers de proximité. Volontairement large sur les métiers,
-- strict sur la forme : un mot entier, pas une sous-chaîne, pour éviter que
-- « macon » attrape « maconnaise ».
create or replace function public.local_trade_score(p_domain text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case when p_domain ~ '(boulangerie|patisserie|boucherie|primeur|epicerie|fromagerie|caviste|traiteur|restaurant|brasserie|pizzeria|creperie|bistro|coiffure|coiffeur|barbier|esthetique|onglerie|garage|carrosserie|mecanique|plomberie|plombier|electricien|chauffagiste|menuiserie|menuisier|serrurier|couvreur|maconnerie|carreleur|paysagiste|jardinier|fleuriste|opticien|pharmacie|veterinaire|osteopathe|kinesitherapeute|dentiste|notaire|comptable|architecte|immobilier|hotel|camping|auto-ecole|pressing|cordonnerie|bijouterie|horlogerie|librairie|papeterie|quincaillerie|jardinerie|animalerie|toilettage)'
    then 30 else 0 end::smallint;
$$;

comment on function public.local_trade_score is
  'Le nom du domaine désigne-t-il un métier de proximité ? Indice gratuit, disponible avant toute visite.';

-- Calcul initial : le nom, puis l'ancienneté par paliers.
update public.domains
set scan_priority = least(100, greatest(0,
      40
      + public.local_trade_score(domain)
      + case
          when registered_at is null then 0
          when registered_at < current_date - interval '15 years' then 25
          when registered_at < current_date - interval '10 years' then 20
          when registered_at < current_date - interval '5 years'  then 10
          -- Un domaine tout neuf n'a pas de site vieillissant, mais il peut
          -- être vide : c'est une autre opportunité, moins prioritaire ici.
          when registered_at > current_date - interval '90 days'  then 5
          else 0
        end
    ))::smallint;

-- L'index de file d'attente est remplacé plutôt que doublé : le tri porte
-- désormais sur deux colonnes, et garder l'ancien coûterait une écriture de
-- plus à chaque scan sans jamais servir.
drop index if exists public.domains_scan_queue_idx;

create index domains_scan_queue_idx
  on public.domains (scan_priority desc, next_check_at)
  where status is distinct from 'excluded';
