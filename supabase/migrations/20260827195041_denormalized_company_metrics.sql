-- ═══════════════════════════════════════════════════════════════════════════
-- Agrégats dénormalisés sur companies.
--
-- Mesure à l'origine de ce changement : à 100 000 entreprises, la liste admin
-- mettait 550 ms, plus 130 ms de comptage. La vue calculait cinq sous-requêtes
-- LATERAL pour CHAQUE ligne avant de trier — et comme le tri porte sur un
-- agrégat calculé, aucun index ne pouvait l'éviter. À 3 millions de lignes,
-- c'est plusieurs secondes par page.
--
-- Les agrégats sont donc maintenus sur la ligne d'entreprise, et le tri devient
-- un simple parcours d'index.
--
-- Les triggers sont au niveau INSTRUCTION et non ligne : le moteur écrit les
-- signaux et opportunités par lots de plusieurs milliers, un trigger par ligne
-- multiplierait le coût d'écriture par le nombre de lignes du lot.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.companies
  add column if not exists active_signal_count  smallint not null default 0,
  add column if not exists trigger_signal_count smallint not null default 0,
  add column if not exists opportunity_count    smallint not null default 0,
  add column if not exists best_opportunity_score numeric(5,2),
  add column if not exists best_opportunity_type  public.opportunity_type,
  add column if not exists has_live_assignment  boolean not null default false,
  add column if not exists cooldown_until       timestamptz;

comment on column public.companies.best_opportunity_score is
  'Agrégat maintenu par trigger. Dénormalisé pour que le tri de la console admin soit un parcours d''index et non un calcul sur toute la table.';

-- Index de tri et de filtrage de la console.
create index if not exists companies_best_score_idx
  on public.companies (best_opportunity_score desc nulls last, id);
create index if not exists companies_signal_count_idx
  on public.companies (active_signal_count desc, id);
create index if not exists companies_opportunity_type_idx
  on public.companies (best_opportunity_type)
  where best_opportunity_type is not null;
create index if not exists companies_created_at_idx on public.companies (created_at desc, id);
create index if not exists companies_cooldown_idx on public.companies (cooldown_until)
  where cooldown_until is not null;
create index if not exists companies_assigned_idx on public.companies (has_live_assignment)
  where has_live_assignment;
create index if not exists companies_last_scanned_idx on public.companies (last_scanned_at nulls first, id);

-- ─── Recalcul ciblé ──────────────────────────────────────────────────────

create or replace function public.refresh_company_metrics(target_ids uuid[])
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.companies c
  set active_signal_count  = coalesce(s.active_count, 0),
      trigger_signal_count = coalesce(s.trigger_count, 0),
      opportunity_count    = coalesce(o.count, 0),
      best_opportunity_score = o.best_score,
      best_opportunity_type  = o.best_type,
      has_live_assignment    = coalesce(a.live, false),
      cooldown_until         = cd.ends_at
  from (select unnest(target_ids) as id) t
  left join lateral (
    select count(*)::int as active_count,
           count(*) filter (where kind = 'trigger')::int as trigger_count
    from public.signals where company_id = t.id and active
  ) s on true
  left join lateral (
    select count(*)::int as count,
           max(base_score) as best_score,
           (array_agg(opportunity_type order by base_score desc))[1] as best_type
    from public.opportunities where company_id = t.id and status = 'available'
  ) o on true
  left join lateral (
    select true as live from public.assignments
    where company_id = t.id and status in ('active', 'contacted') limit 1
  ) a on true
  left join lateral (
    -- Un cooldown permanent est représenté par une échéance très lointaine :
    -- une seule colonne suffit alors à répondre « est-elle en cooldown ? ».
    select case when permanent then 'infinity'::timestamptz else ends_at end as ends_at
    from public.company_cooldowns
    where company_id = t.id and starts_at <= now() and (permanent or ends_at > now())
    order by permanent desc, ends_at desc nulls first limit 1
  ) cd on true
  where c.id = t.id;
$$;

revoke execute on function public.refresh_company_metrics(uuid[]) from public;
grant execute on function public.refresh_company_metrics(uuid[]) to service_role;

-- ─── Triggers au niveau instruction ──────────────────────────────────────

create or replace function public.on_company_related_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected uuid[];
begin
  -- Les tables de transition donnent l'ensemble des lignes touchées par
  -- l'instruction : un seul UPDATE, quel que soit le volume du lot.
  if tg_op = 'INSERT' then
    select array_agg(distinct company_id) into affected from new_rows;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct company_id) into affected from old_rows;
  else
    select array_agg(distinct company_id) into affected
    from (select company_id from new_rows union select company_id from old_rows) u;
  end if;

  if affected is not null then
    perform public.refresh_company_metrics(affected);
  end if;

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['signals', 'opportunities', 'assignments', 'company_cooldowns'] loop
    execute format('drop trigger if exists %I_refresh_metrics_ins on public.%I', t, t);
    execute format('drop trigger if exists %I_refresh_metrics_upd on public.%I', t, t);
    execute format('drop trigger if exists %I_refresh_metrics_del on public.%I', t, t);

    execute format($f$
      create trigger %I_refresh_metrics_ins
      after insert on public.%I
      referencing new table as new_rows
      for each statement execute function public.on_company_related_change()
    $f$, t, t);

    execute format($f$
      create trigger %I_refresh_metrics_upd
      after update on public.%I
      referencing new table as new_rows old table as old_rows
      for each statement execute function public.on_company_related_change()
    $f$, t, t);

    execute format($f$
      create trigger %I_refresh_metrics_del
      after delete on public.%I
      referencing old table as old_rows
      for each statement execute function public.on_company_related_change()
    $f$, t, t);
  end loop;
end
$$;

-- Renseigne les colonnes pour les données déjà présentes.
select public.refresh_company_metrics(array_agg(id)) from public.companies;

-- ─── La vue devient une simple projection ────────────────────────────────

drop view if exists public.admin_company_overview;

create view public.admin_company_overview
with (security_invoker = true)
as
select
  c.id, c.legal_name, c.commercial_name, c.siren, c.siret,
  c.domain, c.website_url, c.website_confidence,
  c.phone, c.contact_form_url, c.has_contact,
  c.city, c.postal_code, c.region,
  c.industry_code, c.industry_label, c.segment,
  c.company_status, c.creation_date,
  c.identity_confidence, c.data_quality_score,
  c.prospecting_allowed, c.suppression_global,
  c.scan_priority, c.last_scanned_at, c.next_scan_at, c.created_at,

  c.active_signal_count,
  c.trigger_signal_count,
  c.opportunity_count,
  c.best_opportunity_score,
  c.best_opportunity_type,
  (c.cooldown_until is not null) as in_cooldown,
  c.cooldown_until as cooldown_ends_at,
  (c.cooldown_until = 'infinity'::timestamptz) as cooldown_permanent,
  c.has_live_assignment,

  -- Seule information encore jointe : qui détient l'attribution. Elle n'est
  -- ni triable ni filtrable dans la liste, donc son coût reste marginal.
  asg.user_id    as assigned_user_id,
  asg.status     as assignment_status,
  asg.assigned_at,

  -- Les sources restent agrégées à la volée : la colonne est affichée mais
  -- jamais triée, et company_sources est indexée par company_id.
  coalesce(src.source_names, '{}') as source_names

from public.companies c
left join lateral (
  select a.user_id, a.status, a.assigned_at
  from public.assignments a
  where a.company_id = c.id and a.status in ('active', 'contacted')
  limit 1
) asg on c.has_live_assignment
left join lateral (
  select array_agg(distinct cs.source_name order by cs.source_name) as source_names
  from public.company_sources cs where cs.company_id = c.id
) src on true;

comment on view public.admin_company_overview is
  'Projection de companies avec ses agrégats dénormalisés. Le tri et les filtres portent sur des colonnes indexées.';

revoke all on public.admin_company_overview from anon, authenticated;
grant select on public.admin_company_overview to service_role;
