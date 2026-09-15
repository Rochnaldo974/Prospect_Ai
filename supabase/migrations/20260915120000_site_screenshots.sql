-- La capture d'écran du site, prise par le moteur au moment de la vérification.
--
-- L'aperçu en iframe restait blanc presque partout : la plupart des sites
-- interdisent l'intégration, et sans scripts un site moderne n'affiche rien.
-- Le freelance ne voyait donc jamais ce qu'on lui décrivait. Une capture
-- prise par notre propre navigateur, à l'instant où le dossier est vérifié,
-- montre le site tel que ses clients le voient — et c'est la preuve de ce
-- que la fiche affirme, datée.
alter table public.domains
  add column if not exists screenshot_path text,
  add column if not exists screenshot_at timestamptz;

comment on column public.domains.screenshot_path is
  'Chemin de la dernière capture dans le bucket site-shots. Null : jamais capturé.';

-- Bucket public en lecture : la capture d'un site public n'a rien de secret,
-- et une URL directe évite un aller-retour signé à chaque affichage. Seul le
-- service écrit (service_role passe outre les policies).
insert into storage.buckets (id, name, public)
values ('site-shots', 'site-shots', true)
on conflict (id) do nothing;
