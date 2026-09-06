-- Le CV (ou dossier de présentation) du freelance, joignable à l'envoi.
alter table email_identities add column if not exists cv_url text;
