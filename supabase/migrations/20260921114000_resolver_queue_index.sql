-- La recherche de sites sert d'abord les entreprises joignables et identifiées.
-- Sans index dans cet ordre, la sélection triait deux cent mille lignes à
-- chaque tranche et dépassait le délai de l'API. L'index rend l'ordre : la
-- tranche se lit sans tri.
create index if not exists companies_website_resolution_queue_idx
  on public.companies (has_contact desc, identity_confidence desc, website_resolution_attempts, id)
  where domain is null and prospecting_allowed and website_resolution_attempts < 3;
