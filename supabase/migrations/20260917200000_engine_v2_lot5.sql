-- Lot 5 du moteur V2 : un matching explicable qui tient compte de la
-- technologie du site et de la fraîcheur, des lots variés, une vérification
-- avant livraison qui réutilise un scan récent, et les réglages qui vont avec.

-- ─── 1. Les technologies qu'un freelance maîtrise ───────────────────────────
--
-- Clés normalisées (wordpress, shopify, prestashop, woocommerce, webflow, wix…)
-- comparées au CMS mesuré sur le site de l'entreprise. Ce n'est pas un filtre :
-- un spécialiste WordPress voit toujours les autres sites, seulement après.

alter table public.user_preferences
  add column if not exists technologies text[] not null default '{}';

comment on column public.user_preferences.technologies is
  'Technologies maîtrisées, clés normalisées (wordpress, shopify…). Affinité au matching, jamais un filtre.';

-- ─── 2. Le pourquoi d'une attribution ───────────────────────────────────────
--
-- Chaque composante du score de rang, telle qu'elle a été calculée le matin
-- de l'attribution : la console et le freelance peuvent lire pourquoi ce
-- dossier, pour cette personne, ce jour-là.

alter table public.assignments
  add column if not exists match_data jsonb;

comment on column public.assignments.match_data is
  'Décomposition du score de rang : géographie, secteur, technologie, fraîcheur, qualité, poids.';

-- ─── 3. Réglages ────────────────────────────────────────────────────────────

insert into public.engine_settings (key, value, description) values
  ('verify_scan_max_age_hours', '36', 'Âge maximal d''un scan pour être réutilisé à la vérification avant livraison, sans revisiter le site.'),
  ('allocation_max_per_type', '3', 'Combien de dossiers d''un même type d''opportunité dans un lot, quand le stock permet de varier.'),
  ('allocation_max_per_industry', '2', 'Combien de dossiers d''un même secteur (deux premiers chiffres du NAF) dans un lot, quand le stock permet de varier.')
on conflict (key) do nothing;

-- ─── 4. La sélection en base renvoie aussi le CMS et la date ────────────────

drop function if exists public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer);

create function public.select_allocation_candidates(
  p_user_id             uuid,
  p_services            public.opportunity_type[] default '{}',
  p_location_mode       text default 'france',
  p_city                text default null,
  p_region              text default null,
  p_excluded_industries text[] default '{}',
  p_require_phone       boolean default false,
  p_limit               integer default 300
)
returns table (
  opportunity_id    uuid,
  company_id        uuid,
  opportunity_type  public.opportunity_type,
  base_score        numeric,
  confidence_score  numeric,
  reason_data       jsonb,
  phone_ready       boolean,
  outreach_ready    boolean,
  city              text,
  region            text,
  industry_code     text,
  best_email        text,
  cms               text,
  created_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with memory_days as (
    select public.engine_setting_int('user_memory_days', 30) as d
  ),
  seen as (
    select a.company_id
    from public.assignments a, memory_days m
    where a.user_id = p_user_id
      and (a.outcome is not null or a.assigned_at > now() - make_interval(days => m.d))
  )
  select o.id, o.company_id, o.opportunity_type, o.base_score, o.confidence_score, o.reason_data,
         o.phone_ready, o.outreach_ready, c.city, c.region, c.industry_code, c.best_email,
         d.cms, o.created_at
  from public.opportunities o
  join public.companies c on c.id = o.company_id
  left join public.domains d on d.domain = c.domain
  where o.status = 'available'
    and o.expires_at > now()
    and c.prospecting_allowed
    and not c.suppression_global
    and c.cooldown_until is null
    and not c.has_live_assignment
    and not exists (select 1 from seen s where s.company_id = o.company_id)
    and (cardinality(p_services) = 0 or o.opportunity_type = any (p_services))
    and (not p_require_phone or o.phone_ready)
    and not exists (
      select 1 from unnest(p_excluded_industries) x
      where c.industry_code is not null and c.industry_code like x || '%'
    )
    and (
      p_location_mode not in ('city', 'region')
      or (p_location_mode = 'city' and p_city is not null and lower(c.city) = lower(p_city))
      or (p_location_mode = 'region' and p_region is not null and lower(c.region) = lower(p_region))
    )
  order by o.base_score desc, o.created_at desc
  limit greatest(1, least(p_limit, 2000));
$$;

revoke execute on function public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer) from public, anon, authenticated;
grant execute on function public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer) to service_role;

-- ─── 5. L'attribution enregistre son pourquoi ───────────────────────────────

drop function if exists public.assign_opportunity(uuid, uuid, uuid, smallint, numeric, boolean, timestamptz);

create function public.assign_opportunity(
  p_user_id         uuid,
  p_opportunity_id  uuid,
  p_batch_id        uuid,
  p_rank            smallint,
  p_match_score     numeric,
  p_is_control      boolean,
  p_exclusive_until timestamptz,
  p_match_data      jsonb default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_assignment uuid;
  v_updated integer;
begin
  select company_id into v_company
  from public.opportunities
  where id = p_opportunity_id and status = 'available' and expires_at > now()
  for update;

  if v_company is null then
    raise exception 'opportunité indisponible' using errcode = 'check_violation';
  end if;

  insert into public.assignments (user_id, company_id, opportunity_id, batch_id, rank, match_score, is_control, exclusive_until, match_data)
  values (p_user_id, v_company, p_opportunity_id, p_batch_id, p_rank, p_match_score, p_is_control, p_exclusive_until, p_match_data)
  returning id into v_assignment;

  update public.opportunities set status = 'assigned', updated_at = now()
  where id = p_opportunity_id and status = 'available';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'opportunité prise entre-temps' using errcode = 'check_violation';
  end if;

  return v_assignment;
end;
$$;

revoke execute on function public.assign_opportunity(uuid, uuid, uuid, smallint, numeric, boolean, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.assign_opportunity(uuid, uuid, uuid, smallint, numeric, boolean, timestamptz, jsonb) to service_role;
