-- État du certificat TLS.
--
-- has_ssl ne disait que le schéma de l'URL. Or un certificat auto-signé,
-- expiré ou émis pour un autre nom fait afficher au visiteur un avertissement
-- de sécurité pleine page : le site est de fait inaccessible au public, alors
-- qu'il répond parfaitement à un robot qui ne vérifie rien.
--
-- C'est le défaut le plus vérifiable qu'un freelance puisse montrer — il
-- suffit d'ouvrir l'adresse — et le plus invisible à son propriétaire, qui a
-- cliqué « continuer malgré tout » une fois pour toutes.
--
-- Constaté sur un restaurant d'Angers dont le certificat est auto-signé et
-- que le moteur voyait comme un site en bonne santé.
alter table public.domains
  add column tls_valid    boolean,
  add column tls_reason   text,
  add column tls_valid_to date,
  add column tls_issuer   text;

comment on column public.domains.tls_valid is
  'Certificat accepté par une chaîne de confiance publique. null = non examiné ou pas de port 443.';
comment on column public.domains.tls_valid_to is
  'Fin de validité du certificat. Date le défaut quand il a expiré.';

-- Les certificats invalides sont une petite minorité : index partiel.
create index domains_invalid_tls_idx
  on public.domains (tls_valid_to)
  where tls_valid is false;
