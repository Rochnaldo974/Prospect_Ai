-- Lot 8 du moteur V2 : l'état du pipeline en une fonction, pour la console.

create or replace function public.pipeline_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pending_domain_resolution', (select count(*) from companies where domain is null and website_url is null and prospecting_allowed and (website_last_resolved_at is null)),
    'pending_contact_resolution', (select count(*) from companies where contact_resolution_status = 'pending' and prospecting_allowed),
    -- Bornés à cent mille : le parc compte des millions de domaines, et « plus de cent mille » suffit à la console.
    'pending_scan', (select count(*) from (select 1 from domains where next_check_at <= now() and status <> 'excluded' limit 100000) x),
    'pending_deep_scan', (select count(*) from domains where performance_audit_status = 'pending'),
    'pending_identity', (select count(*) from companies where siren is null and postal_code is not null and prospecting_allowed and identity_lookup_at is null),
    'never_scanned', (select count(*) from (select 1 from domains where last_checked_at is null and status <> 'excluded' limit 100000) x),
    'changes_7d', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) as n from domain_changes where changed_at > now() - interval '7 days' group by kind) c),
    'top_technologies', (select coalesce(jsonb_agg(jsonb_build_object('technology', technology, 'domains', n) order by n desc), '[]'::jsonb) from (select technology, count(*) as n from domain_technologies group by technology order by n desc limit 12) t),
    'economics_7d', (select coalesce(jsonb_agg(to_jsonb(e) order by e.day desc), '[]'::jsonb) from (select * from engine_economics_daily where day > current_date - 7) e)
  );
$$;

revoke execute on function public.pipeline_health() from public, anon, authenticated;
grant execute on function public.pipeline_health() to service_role;
