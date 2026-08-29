-- Contenu des événements dans le contexte de détection.
--
-- Les détecteurs ne recevaient que le type et la date d'un événement. Cela
-- suffisait tant qu'un type valait une signification — une création est une
-- création. Un appel d'offres, lui, porte sa date limite de réponse dans son
-- contenu : sans elle, impossible de distinguer un marché ouvert jusqu'en
-- décembre d'un marché clos hier, et le moteur proposerait des avis auxquels
-- il est déjà trop tard pour répondre.

create or replace function public.load_signal_context(
  p_company_ids uuid[],
  p_event_window_days integer default 180
)
returns table (
  company               public.companies,
  domain                public.domains,
  domain_company_count  integer,
  events                jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c,
    d,
    coalesce(dc.count, 0)::integer,
    coalesce(ev.events, '[]'::jsonb)
  from public.companies c
  left join public.domains d on d.domain = c.domain
  left join lateral (
    -- Combien d'établissements revendiquent ce site. Au-delà d'un, c'est un
    -- réseau : le site n'appartient pas au point de vente.
    select count(*)::integer as count
    from public.companies sibling
    where c.domain is not null and sibling.domain = c.domain
  ) dc on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'importance', e.importance,
        'confidence', e.confidence,
        'occurred_at', coalesce(e.occurred_at, e.detected_at),
        'detected_at', e.detected_at,
        'payload', e.payload
      )
      order by coalesce(e.occurred_at, e.detected_at) desc
    ) as events
    from public.company_events e
    where e.company_id = c.id
      and e.detected_at >= now() - make_interval(days => p_event_window_days)
  ) ev on true
  where c.id = any(p_company_ids);
$$;
