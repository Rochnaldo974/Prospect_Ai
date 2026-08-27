-- ═══════════════════════════════════════════════════════════════════════════
-- Valeurs des listes déroulantes de la console.
--
-- Elles étaient obtenues en chargeant 5 000 lignes de companies et 5 000 de
-- company_sources à chaque affichage, puis en dédupliquant en mémoire. Sur une
-- table de plusieurs millions de lignes, c'est un parcours complet pour
-- alimenter trois menus déroulants.
--
-- Une vue matérialisée les précalcule. Elle n'a pas besoin d'être fraîche à la
-- seconde : une ville qui apparaît aujourd'hui peut n'être proposée que demain.
-- ═══════════════════════════════════════════════════════════════════════════

create materialized view if not exists public.admin_filter_options as
select 'city' as kind, city as code, city as label, count(*) as usage_count
from public.companies where city is not null group by city
union all
select 'industry', industry_code, coalesce(max(industry_label), industry_code), count(*)
from public.companies where industry_code is not null group by industry_code
union all
select 'source', source_name, source_name, count(*)
from public.company_sources group by source_name
union all
select 'region', region, region, count(*)
from public.companies where region is not null group by region;

create unique index if not exists admin_filter_options_uq
  on public.admin_filter_options (kind, code);
create index if not exists admin_filter_options_kind_idx
  on public.admin_filter_options (kind, usage_count desc);

comment on materialized view public.admin_filter_options is
  'Valeurs distinctes pour les filtres de la console. Rafraîchie par le job refresh_filter_options.';

create or replace function public.refresh_filter_options()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  -- CONCURRENTLY : le rafraîchissement ne bloque pas la lecture de la console.
  -- Exige l'index unique déclaré plus haut.
  refresh materialized view concurrently public.admin_filter_options;
  select count(*) into total from public.admin_filter_options;
  return total;
end;
$$;

revoke all on public.admin_filter_options from anon, authenticated;
grant select on public.admin_filter_options to service_role;

revoke execute on function public.refresh_filter_options() from public;
grant execute on function public.refresh_filter_options() to service_role;

select cron.schedule(
  'refresh-filter-options',
  '20 4 * * *',
  $$ select public.schedule_recurring_job('refresh_filter_options', 20::smallint, '{}'::jsonb, 'YYYYMMDD') $$
);
