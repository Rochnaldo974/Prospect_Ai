-- Lot 9 du moteur V2 : les drapeaux d'activation, les critères de succès,
-- l'offre face à la demande, et le modèle logique d'une entreprise.

-- ─── 1. Drapeaux : même table de réglages, valeur booléenne ─────────────────

create or replace function public.engine_flag(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}') in ('true', '1', 'on') from public.engine_settings where key = p_key), p_default);
$$;
revoke execute on function public.engine_flag(text, boolean) from public, anon, authenticated;
grant execute on function public.engine_flag(text, boolean) to service_role;

insert into public.engine_settings (key, value, description) values
  ('enable_osm_scheduler', 'true', 'Découverte OpenStreetMap planifiée chaque nuit.'),
  ('enable_afnic_daily', 'true', 'Import quotidien des .fr créés.'),
  ('enable_bodacc_contact_resolution', 'true', 'Rapprochement BODACC → contacts.'),
  ('enable_seo_opportunities', 'true', 'Règle SEO (faits mesurés au scan).'),
  ('enable_performance_opportunities', 'true', 'Signaux de performance dans les règles (maintenance, refonte).'),
  ('enable_performance_audit', 'true', 'Audit de performance approfondi après présélection.'),
  ('enable_ecommerce_v2', 'true', 'Règle e-commerce V2 (catalogue sans panier, plateforme datée).'),
  ('enable_joafe', 'true', 'Relevé des associations du Journal officiel.'),
  ('enable_sitadel', 'true', 'Relevé des permis créant des locaux.'),
  ('enable_commercial_enrichment', 'false', 'Fournisseur de contacts payant en dernier recours. Aucun n''est branché.')
on conflict (key) do nothing;

-- ─── 2. Critères de succès et offre / demande ───────────────────────────────

create or replace function public.success_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select count(*) as total,
           count(*) filter (where phone is not null) as with_phone,
           count(*) filter (where has_email) as with_email,
           count(*) filter (where phone is not null and has_email) as with_both
    from companies where prospecting_allowed
  ),
  stock as (
    select count(*) filter (where status = 'available') as qualified,
           count(*) filter (where status = 'available' and phone_ready) as phone_ready,
           count(*) filter (where status = 'available' and outreach_ready) as outreach_ready
    from opportunities where expires_at > now()
  ),
  last24 as (
    select count(*) as qualified,
           count(*) filter (where phone_ready) as phone_ready,
           count(*) filter (where outreach_ready) as outreach_ready
    from opportunities where created_at > now() - interval '24 hours'
  ),
  by_type as (
    select opportunity_type::text as k, count(*) as n from opportunities where status = 'available' and expires_at > now() group by 1
  ),
  by_source as (
    select coalesce(s.source_name, 'unknown') as k, count(distinct o.id) as n
    from opportunities o
    left join company_sources s on s.company_id = o.company_id
    where o.status = 'available' and o.expires_at > now()
    group by 1
  ),
  supply as (
    select coalesce(avg(d.n_phone), 0) as phone_ready, coalesce(avg(d.n_out), 0) as outreach_ready
    from (
      select (created_at at time zone 'utc')::date as day,
             count(*) filter (where phone_ready) as n_phone,
             count(*) filter (where outreach_ready) as n_out
      from opportunities where created_at > now() - interval '7 days' group by 1
    ) d
  ),
  demand as (
    select count(*) filter (where plan = 'free') as free_users,
           count(*) filter (where plan = 'premium') as premium_users,
           -- Le gratuit reçoit un dossier par semaine ; le payant sa limite chaque jour.
           coalesce(sum(case when plan = 'free' then 1.0 / 7 else daily_opportunity_limit end), 0) as daily
    from profiles where onboarding_completed
  ),
  demand_by_type as (
    -- Un freelance sans service coché veut tout ; sinon sa limite se partage entre ses services.
    select t.k, sum(case when p.plan = 'free' then 1.0 / 7 else p.daily_opportunity_limit end
                    / greatest(1, coalesce(cardinality(up.services), 0))) as daily
    from profiles p
    left join user_preferences up on up.user_id = p.id
    cross join lateral (
      select unnest(case when coalesce(cardinality(up.services), 0) = 0 then enum_range(null::opportunity_type) else up.services end)::text as k
    ) t
    where p.onboarding_completed
    group by t.k
  )
  select jsonb_build_object(
    'companies', (select jsonb_build_object('total', total, 'with_phone', with_phone, 'with_email', with_email, 'with_phone_and_email', with_both,
                    'phone_pct', case when total > 0 then round(100.0 * with_phone / total, 1) end,
                    'email_pct', case when total > 0 then round(100.0 * with_email / total, 1) end,
                    'both_pct', case when total > 0 then round(100.0 * with_both / total, 1) end) from c),
    'stock', (select to_jsonb(stock) from stock),
    'last_24h', (select to_jsonb(last24) from last24),
    'by_type', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from by_type),
    'by_source', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from by_source),
    'supply_demand', jsonb_build_object(
      'daily_supply_phone_ready', (select round(phone_ready, 1) from supply),
      'daily_supply_outreach_ready', (select round(outreach_ready, 1) from supply),
      'free_users', (select free_users from demand),
      'premium_users', (select premium_users from demand),
      'daily_demand', (select round(daily, 1) from demand),
      'supply_demand_ratio', (select case when d.daily > 0 then round(s.phone_ready / d.daily, 2) end from supply s, demand d),
      'by_service', (select coalesce(jsonb_object_agg(t.k, jsonb_build_object('stock', coalesce(b.n, 0), 'daily_demand', round(t.daily, 2),
                        'ratio', case when t.daily > 0 then round(coalesce(b.n, 0) / t.daily, 1) end)), '{}'::jsonb)
                     from demand_by_type t left join by_type b on b.k = t.k)
    )
  );
$$;
revoke execute on function public.success_metrics() from public, anon, authenticated;
grant execute on function public.success_metrics() to service_role;

-- ─── 3. Le modèle logique d'une entreprise, en un document ──────────────────
--
-- Pas de base graphe : PostgreSQL agrège ce que les tables savent d'une
-- entreprise — identité, site, contacts, technologies, événements, signaux,
-- opportunités, attributions, issues.

create or replace function public.company_graph(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'identity', (select jsonb_build_object('id', id, 'legal_name', legal_name, 'commercial_name', commercial_name, 'siren', siren, 'siret', siret,
                   'naf', industry_code, 'organization_type', organization_type, 'address', address, 'postal_code', postal_code, 'city', city,
                   'region', region, 'lat', lat, 'lon', lon, 'identity_confidence', identity_confidence, 'do_not_contact', do_not_contact,
                   'social_links', social_links) from companies where id = p_company_id),
    'domains', (select coalesce(jsonb_agg(jsonb_build_object('domain', d.domain, 'status', d.status, 'cms', d.cms, 'last_checked_at', d.last_checked_at,
                   'technologies', (select coalesce(jsonb_agg(jsonb_build_object('technology', t.technology, 'version', t.version)), '[]'::jsonb) from domain_technologies t where t.domain = d.domain),
                   'changes', (select coalesce(jsonb_agg(jsonb_build_object('kind', ch.kind, 'changed_at', ch.changed_at) order by ch.changed_at desc), '[]'::jsonb) from (select * from domain_changes where domain = d.domain order by changed_at desc limit 10) ch))), '[]'::jsonb)
                from domains d where d.domain = (select domain from companies where id = p_company_id)),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('type', type, 'value', value, 'source', source, 'is_personal', is_personal)), '[]'::jsonb) from company_contacts where company_id = p_company_id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', event_type, 'occurred_at', occurred_at, 'importance', importance) order by occurred_at desc), '[]'::jsonb)
               from (select * from company_events where company_id = p_company_id order by occurred_at desc limit 30) e),
    'signals', (select coalesce(jsonb_agg(jsonb_build_object('type', signal_type, 'strength', strength, 'active', active)), '[]'::jsonb) from signals where company_id = p_company_id and active),
    'opportunities', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', opportunity_type, 'status', status, 'base_score', base_score, 'phone_ready', phone_ready, 'outreach_ready', outreach_ready, 'family', reason_data->>'family')), '[]'::jsonb) from opportunities where company_id = p_company_id),
    'assignments', (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'assigned_at', assigned_at, 'status', status, 'outcome', outcome, 'match_score', match_score) order by assigned_at desc), '[]'::jsonb) from assignments where company_id = p_company_id),
    'permits', (select coalesce(jsonb_agg(jsonb_build_object('kind', premises_kind, 'authorized_at', authorized_at)), '[]'::jsonb) from building_permits where company_id = p_company_id)
  );
$$;
revoke execute on function public.company_graph(uuid) from public, anon, authenticated;
grant execute on function public.company_graph(uuid) to service_role;
