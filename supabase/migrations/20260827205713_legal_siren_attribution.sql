-- ═══════════════════════════════════════════════════════════════════════════
-- Rattachement par les mentions légales : deux corrections issues du terrain.
--
-- 1. Le SIREN d'une page de mentions légales n'est pas toujours celui du
--    commerçant. Constaté sur un scan réel : 424761419 figure à la fois sur
--    renovcuir.com et hollysdiner.fr, deux commerces sans lien. C'est le SIREN
--    de l'agence qui a réalisé les deux sites — mention courante en pied de
--    page. L'attribuer au commerçant serait une erreur franche.
--
--    Parade : un SIREN présent sur plusieurs domaines distincts n'identifie
--    plus un exploitant. Le seuil est bas parce qu'un commerçant n'a qu'un
--    site, alors qu'une agence en signe des dizaines.
--
-- 2. Un site déjà attribué à une entreprise dont le SIREN figure dans les
--    mentions légales n'est pas un rattachement mais une CONFIRMATION. Elle
--    vaut mieux que l'attribution d'origine : la loi impose cet affichage,
--    là où une correspondance de nom depuis un POI reste une inférence.
-- ═══════════════════════════════════════════════════════════════════════════

/** Nombre de domaines distincts où figure ce SIREN. */
create or replace function public.siren_domain_count(p_siren text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.domains where p_siren = any(sirens_found);
$$;

-- Le type de retour change : PostgreSQL refuse un CREATE OR REPLACE dans ce
-- cas, il faut supprimer l'ancienne version.
drop function if exists public.attach_domain_by_legal_siren(text);

/**
 * Rattache ou confirme un site à partir de ses mentions légales.
 *
 * Renvoie le détail de ce qui a été fait, pour que le rapport de scan
 * distingue une découverte d'une confirmation.
 */
create or replace function public.attach_domain_by_legal_siren(p_domain text)
returns table (attached integer, confirmed integer, skipped_shared integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_sirens text[];
  owner_sirens text[];
  shared_count integer := 0;
  s text;
begin
  select sirens_found into found_sirens from public.domains where domain = p_domain;
  if found_sirens is null or cardinality(found_sirens) = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  -- Écarte les SIREN présents sur plus de deux domaines : agences, hébergeurs,
  -- éditeurs de solutions. Ils ne désignent pas l'exploitant du commerce.
  owner_sirens := '{}';
  foreach s in array found_sirens loop
    if public.siren_domain_count(s) <= 2 then
      owner_sirens := array_append(owner_sirens, s);
    else
      shared_count := shared_count + 1;
    end if;
  end loop;

  if cardinality(owner_sirens) = 0 then
    return query select 0, 0, shared_count;
    return;
  end if;

  -- Confirmation : l'entreprise revendiquait déjà ce domaine, et son SIREN
  -- figure bien dans les mentions légales. La confiance monte au maximum.
  with confirmed_rows as (
    update public.companies c
    set website_confidence = 0.99,
        website_last_resolved_at = now(),
        updated_at = now()
    where c.siren = any(owner_sirens)
      and c.domain = p_domain
      and coalesce(c.website_confidence, 0) < 0.99
    returning c.id
  ),
  -- Rattachement : l'entreprise n'avait pas de site, et le sien le nomme.
  attached_rows as (
    update public.companies c
    set domain = p_domain,
        website_url = 'https://' || p_domain,
        website_confidence = 0.99,
        website_last_resolved_at = now(),
        updated_at = now()
    where c.siren = any(owner_sirens)
      and c.domain is null
    returning c.id
  )
  select
    (select count(*)::integer from attached_rows),
    (select count(*)::integer from confirmed_rows),
    shared_count
  into attached, confirmed, skipped_shared;

  return next;
end;
$$;

comment on function public.attach_domain_by_legal_siren is
  'Rattache ou confirme un site depuis ses mentions légales. Écarte les SIREN présents sur plusieurs domaines : ce sont ceux des agences, pas des commerçants.';

revoke execute on function public.siren_domain_count(text) from public;
revoke execute on function public.attach_domain_by_legal_siren(text) from public;
grant execute on function public.siren_domain_count(text) to service_role;
grant execute on function public.attach_domain_by_legal_siren(text) to service_role;
