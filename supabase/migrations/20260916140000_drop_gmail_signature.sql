-- Le logo ne passe plus par Gmail : la signature part en texte dans le
-- message, et la colonne qui disait « ma signature est dans Gmail » n'a
-- plus de sens.
alter table public.email_identities drop column if exists gmail_signature;
