-- Le freelance a mis sa signature (avec logo) dans Gmail : les e-mails
-- ouverts dans Gmail ne la répètent pas dans le corps du message.
alter table public.email_identities
  add column if not exists gmail_signature boolean not null default false;
