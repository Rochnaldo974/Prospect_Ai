-- engine_metrics dépassait la minute sur la base hébergée : cinq comptages
-- balayaient la table des entreprises (dix secondes chacun, lecture disque),
-- les contacts du jour n'avaient pas d'index de date, et la source de chaque
-- opportunité du jour allait chercher sa ligne dans la table. Des index
-- partiels ou couvrants : chaque compteur se sert dans l'index.

create index if not exists companies_with_phone_idx on public.companies (id) where phone is not null;
create index if not exists companies_with_email_idx on public.companies (id) where best_email is not null;
create index if not exists companies_with_form_idx on public.companies (id) where contact_form_url is not null;
create index if not exists companies_with_phone_and_email_idx on public.companies (id) where phone is not null and best_email is not null;
create index if not exists companies_contactable_idx on public.companies (id) where has_contact or has_email;
create index if not exists company_contacts_first_seen_idx on public.company_contacts (first_seen_at desc);
create index if not exists company_sources_company_first_idx on public.company_sources (company_id, discovered_at) include (source_name);
