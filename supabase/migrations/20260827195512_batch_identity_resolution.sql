-- ═══════════════════════════════════════════════════════════════════════════
-- Résolution d'identité par lot.
--
-- La version précédente passait par `in(...)` côté PostgREST, donc par une
-- requête GET dont l'URL portait les 500 identifiants du lot. Au-delà de
-- quelques centaines de valeurs, la passerelle répond « URI too long » et le
-- lot entier échoue — constaté en ingérant 20 000 lignes.
--
-- Une fonction appelée en POST supprime la limite, et laisse le travail de
-- rapprochement à la base plutôt qu'à trois allers-retours.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.resolve_company_identities(
  p_sirets  text[] default '{}',
  p_sirens  text[] default '{}',
  p_domains text[] default '{}'
)
returns table (match_key text, company public.companies)
language sql
stable
security definer
set search_path = ''
as $$
  -- SIRET : identité d'établissement, la clé la plus forte.
  select 'siret'::text, c
  from public.companies c
  where c.siret = any(p_sirets)

  union all

  -- SIREN : seulement entre fiches sans établissement identifié, pour ne pas
  -- absorber un point de vente précis dans une fiche générique.
  select 'siren'::text, c
  from public.companies c
  where c.siren = any(p_sirens) and c.siret is null

  union all

  -- Domaine : rendu par l'appelant, qui écartera ceux désignant plusieurs
  -- entreprises. Les enseignes de réseau partagent le site de la marque.
  select 'domain'::text, c
  from public.companies c
  where c.domain = any(p_domains);
$$;

comment on function public.resolve_company_identities is
  'Rapprochement par clés exactes pour tout un lot, en un appel. Appelée en POST : les identifiants ne transitent pas par l''URL.';

revoke execute on function public.resolve_company_identities(text[], text[], text[]) from public;
grant execute on function public.resolve_company_identities(text[], text[], text[]) to service_role;
