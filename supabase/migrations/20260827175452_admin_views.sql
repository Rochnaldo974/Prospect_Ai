-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2 — Vues d'agrégation pour la console d'administration.
--
-- Sans elles, afficher un tableau de 50 entreprises coûterait 250 requêtes
-- (signaux, sources, opportunités, attribution, cooldown par ligne). Les
-- agrégats sont calculés en une passe côté base, par LATERAL indexé.
-- ═══════════════════════════════════════════════════════════════════════════

create view public.admin_company_overview
with (security_invoker = true)
as
select
  c.id,
  c.legal_name,
  c.commercial_name,
  c.siren,
  c.siret,
  c.domain,
  c.website_url,
  c.website_confidence,
  c.phone,
  c.contact_form_url,
  c.has_contact,
  c.city,
  c.postal_code,
  c.region,
  c.industry_code,
  c.industry_label,
  c.segment,
  c.company_status,
  c.creation_date,
  c.identity_confidence,
  c.data_quality_score,
  c.prospecting_allowed,
  c.suppression_global,
  c.scan_priority,
  c.last_scanned_at,
  c.next_scan_at,
  c.created_at,

  coalesce(sig.active_count, 0)      as active_signal_count,
  coalesce(sig.trigger_count, 0)     as trigger_signal_count,
  coalesce(src.source_names, '{}')   as source_names,
  coalesce(opp.opportunity_count, 0) as opportunity_count,
  opp.best_score                     as best_opportunity_score,
  opp.best_type                      as best_opportunity_type,
  asg.user_id                        as assigned_user_id,
  asg.status                         as assignment_status,
  asg.assigned_at                    as assigned_at,
  cd.ends_at                         as cooldown_ends_at,
  cd.permanent                       as cooldown_permanent,
  (cd.company_id is not null)        as in_cooldown

from public.companies c

left join lateral (
  select
    count(*)                                  as active_count,
    count(*) filter (where s.kind = 'trigger') as trigger_count
  from public.signals s
  where s.company_id = c.id and s.active
) sig on true

left join lateral (
  select array_agg(distinct cs.source_name order by cs.source_name) as source_names
  from public.company_sources cs
  where cs.company_id = c.id
) src on true

left join lateral (
  select
    count(*)                                       as opportunity_count,
    max(o.base_score)                              as best_score,
    (array_agg(o.opportunity_type order by o.base_score desc))[1] as best_type
  from public.opportunities o
  where o.company_id = c.id and o.status = 'available'
) opp on true

-- Attribution vivante : au plus une par entreprise, garantie par index unique.
left join lateral (
  select a.user_id, a.status, a.assigned_at
  from public.assignments a
  where a.company_id = c.id and a.status in ('active', 'contacted')
  limit 1
) asg on true

left join lateral (
  select cc.company_id, cc.ends_at, cc.permanent
  from public.company_cooldowns cc
  where cc.company_id = c.id
    and cc.starts_at <= now()
    and (cc.permanent or cc.ends_at > now())
  order by cc.permanent desc, cc.ends_at desc nulls first
  limit 1
) cd on true;

comment on view public.admin_company_overview is
  'Vue de listing admin. Un LATERAL par agrégat plutôt qu''un GROUP BY : chacun est indexé et n''élargit pas le produit cartésien.';

-- ═══ Compteurs de la vue d'ensemble ═══════════════════════════════════════

create view public.admin_stats
with (security_invoker = true)
as
select
  (select count(*) from public.companies)                                     as companies_total,
  (select count(*) from public.companies
     where created_at >= date_trunc('day', now()))                            as companies_added_today,
  (select count(*) from public.companies where domain is not null)            as companies_with_website,
  (select count(*) from public.companies where has_contact)                   as companies_with_contact,
  (select count(*) from public.companies where last_scanned_at is not null)   as companies_scanned,
  (select count(*) from public.companies
     where suppression_global or not prospecting_allowed)                     as companies_excluded,

  (select count(*) from public.signals where active)                          as signals_active,
  (select count(*) from public.opportunities where status = 'available')      as opportunities_available,
  (select count(*) from public.opportunities where status = 'assigned')       as opportunities_assigned,

  (select count(*) from public.assignments
     where assigned_at >= date_trunc('day', now()))                           as assignments_today,
  (select count(*) from public.assignments where status in ('active','contacted')) as assignments_live,
  (select count(*) from public.assignments where contacted_at is not null)    as contacts_made,
  (select count(*) from public.assignments where outcome = 'meeting')         as meetings,
  (select count(*) from public.assignments where outcome = 'client')          as clients,

  (select count(*) from public.profiles)                                      as users_total,
  (select count(*) from public.profiles where onboarding_completed)           as users_onboarded,

  (select count(*) from public.job_queue where status = 'pending')            as jobs_pending,
  (select count(*) from public.job_queue where status = 'running')            as jobs_running,
  (select count(*) from public.job_queue where status = 'dead')               as jobs_dead;

comment on view public.admin_stats is
  'Compteurs de la vue d''ensemble admin. Une seule requête plutôt qu''une quinzaine.';

-- ═══ Inventaire par type d'opportunité ════════════════════════════════════
--
-- Alimente la règle : la découverte suit la demande. Un type dont le stock
-- descend sous quelques jours doit remonter en priorité de collecte.

create view public.admin_inventory
with (security_invoker = true)
as
select
  o.opportunity_type,
  count(*) filter (where o.status = 'available')                as available,
  count(*) filter (where o.status = 'assigned')                 as assigned,
  round(avg(o.base_score) filter (where o.status = 'available'), 1) as avg_score,
  coalesce(consumption.per_day, 0)                              as consumed_per_day,
  case
    when coalesce(consumption.per_day, 0) = 0 then null
    else round(
      count(*) filter (where o.status = 'available')::numeric / consumption.per_day,
      1
    )
  end                                                           as days_of_inventory
from public.opportunities o
left join lateral (
  -- Consommation moyenne sur les 7 derniers jours.
  select round(count(*)::numeric / 7, 2) as per_day
  from public.assignments a
  join public.opportunities ao on ao.id = a.opportunity_id
  where ao.opportunity_type = o.opportunity_type
    and a.assigned_at >= now() - interval '7 days'
) consumption on true
group by o.opportunity_type, consumption.per_day;

comment on view public.admin_inventory is
  'Jours de stock par type d''opportunité. days_of_inventory est le signal qui doit piloter la priorité de découverte.';

-- ═══ Privilèges ═══════════════════════════════════════════════════════════
--
-- Les vues d'admin ne sont jamais lues avec les droits d'un utilisateur final :
-- l'accès passe par le rôle service_role, après vérification serveur du rôle
-- applicatif par requireAdmin().

revoke all on public.admin_company_overview, public.admin_stats, public.admin_inventory
  from anon, authenticated;
grant select on public.admin_company_overview, public.admin_stats, public.admin_inventory
  to service_role;
