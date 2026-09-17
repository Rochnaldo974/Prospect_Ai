-- Les deux buckets publics de la signature (logo, CV), créés une fois ici
-- plutôt qu'à chaque enregistrement par la clé de service.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 524288, array['image/png', 'image/jpeg', 'image/webp']),
  ('documents', 'documents', true, 2097152, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
