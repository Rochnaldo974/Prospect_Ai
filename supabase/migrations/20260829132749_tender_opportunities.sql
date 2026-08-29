-- Réponse à appel d'offres.
--
-- Toutes les autres opportunités du produit reposent sur une inférence : on
-- observe un fait — pas de site, site en panne, certificat expiré — et on en
-- déduit qu'une proposition serait pertinente. L'explication livrée au
-- freelance doit d'ailleurs le préciser à chaque fois : « ces éléments ne
-- disent pas que l'entreprise a formulé ce besoin ».
--
-- Ici, si. L'acheteur a publié lui-même ce qu'il cherche, avec une date limite
-- et un budget. C'est la seule famille où il n'y a rien à déduire, et donc la
-- seule où « pourquoi maintenant » se réduit à recopier une date.
--
-- Contrepartie assumée : ces acheteurs sont des organismes publics, pas les
-- commerces et artisans du segment initial. Le volume est faible — quelques
-- dizaines d'avis ouverts en France à un instant donné — mais c'est de la
-- qualité, pas du volume, qu'on vient chercher ici.
alter type public.opportunity_type add value if not exists 'tender_response';

comment on type public.opportunity_type is
  'Familles d''opportunité. tender_response = besoin déclaré publiquement par l''acheteur, pas déduit.';
