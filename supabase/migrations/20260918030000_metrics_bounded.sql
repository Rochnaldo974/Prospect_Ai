-- Les métriques du moteur ne comptent plus le parc entier : estimation du
-- planificateur pour le total, comptages bornés pour ce qui est dû.

create or replace function public.engine_metrics(p_day date default (now() at time zone 'utc')::date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with day as (
    select p_day::timestamptz as d0, (p_day + 1)::timestamptz as d1
  )
  select jsonb_build_object(
    'day', p_day,
    'discovery', jsonb_build_object(
      'companies_discovered_total', (select count(*) from companies),
      'companies_discovered_today', (select count(*) from companies, day where created_at >= d0 and created_at < d1),
      'companies_discovered_by_source', (
        select coalesce(jsonb_object_agg(source_name, n), '{}'::jsonb) from (
          select source_name, count(distinct company_id) n from company_sources group by 1
        ) s)
    ),
    'domains', jsonb_build_object(
      -- Estimation du planificateur : compter quatre millions et demi de lignes coûtait huit secondes.
      'domains_discovered_total', (select greatest(0, reltuples)::bigint from pg_class where oid = 'public.domains'::regclass),
      'domains_discovered_today', (select count(*) from domains, day where created_at >= d0 and created_at < d1),
      'domains_scanned_today', (select count(*) from domains, day where last_checked_at >= d0 and last_checked_at < d1),
      -- Borné à cent mille : « plus de cent mille » suffit à la console et au contrôle de santé.
      'domains_due_for_scan', (select count(*) from (select 1 from domains where next_check_at <= now() and status <> 'excluded' limit 100000) x),
      'domains_scan_success_rate', (
        select case when count(*) = 0 then null
               else round(count(*) filter (where status in ('reachable','placeholder'))::numeric / count(*), 3) end
        from (select status from domains where last_checked_at is not null limit 200000) d)
    ),
    'contacts', jsonb_build_object(
      'companies_with_phone', (select count(*) from companies where phone is not null),
      'companies_with_email', (select count(*) from companies where best_email is not null),
      'companies_with_form', (select count(*) from companies where contact_form_url is not null),
      'companies_with_phone_and_email', (select count(*) from companies where phone is not null and best_email is not null),
      'companies_contactable', (select count(*) from companies where has_contact or has_email),
      'contacts_found_today', (select count(*) from company_contacts, day where first_seen_at >= d0 and first_seen_at < d1),
      'contacts_found_by_source', (
        select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (
          select source, count(*) n from company_contacts group by 1) s),
      'contacts_found_by_type', (
        select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (
          select type, count(*) n from company_contacts group by 1) s)
    ),
    'opportunities', jsonb_build_object(
      'opportunities_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1),
      'opportunities_created_by_type', (
        select coalesce(jsonb_object_agg(opportunity_type, n), '{}'::jsonb) from (
          select opportunity_type, count(*) n from opportunities, day where created_at >= d0 and created_at < d1 group by 1) s),
      'opportunities_created_by_source', (
        select coalesce(jsonb_object_agg(src, n), '{}'::jsonb) from (
          select coalesce((select source_name from company_sources cs where cs.company_id = o.company_id order by discovered_at limit 1), 'inconnue') src, count(*) n
          from opportunities o, day where o.created_at >= d0 and o.created_at < d1 group by 1) s),
      'qualified_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1),
      'phone_ready_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1 and phone_ready),
      'outreach_ready_created_today', (select count(*) from opportunities, day where created_at >= d0 and created_at < d1 and outreach_ready),
      'stock_qualified', (select count(*) from opportunities where status = 'available' and expires_at > now()),
      'stock_phone_ready', (select count(*) from opportunities where status = 'available' and expires_at > now() and phone_ready),
      'stock_outreach_ready', (select count(*) from opportunities where status = 'available' and expires_at > now() and outreach_ready),
      'stock_phone_and_email_ready', (
        select count(*) from opportunities o join companies c on c.id = o.company_id
        where o.status = 'available' and o.expires_at > now() and c.phone is not null and c.best_email is not null),
      'stock_by_type', (
        select coalesce(jsonb_object_agg(opportunity_type, n), '{}'::jsonb) from (
          select opportunity_type, count(*) n from opportunities where status = 'available' and expires_at > now() group by 1) s)
    ),
    'rejections', jsonb_build_object(
      'opportunities_rejected_today', (select count(*) from opportunity_rejections, day where created_at >= d0 and created_at < d1),
      'rejections_by_reason', (
        select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from (
          select reason, count(*) n from opportunity_rejections, day where created_at >= d0 and created_at < d1 group by 1) s)
    )
  );
$$;
