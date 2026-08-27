-- ═══════════════════════════════════════════════════════════════════════════
-- Fusion de deux entreprises.
--
-- L'opération supprime une ligne : c'est la seule du moteur qui détruit de la
-- donnée. Trois précautions en découlent.
--
--   1. Le survivant est choisi par une règle explicite, pas par l'ordre
--      d'arrivée : l'identité la mieux établie l'emporte.
--   2. Tout ce qui pend à l'absorbée est transféré — sources, provenance,
--      signaux, opportunités, événements, attributions, cooldowns. Rien n'est
--      supprimé en cascade.
--   3. L'état complet de l'absorbée est conservé dans company_merges. Sans
--      cela, la disparition d'une entreprise serait inexplicable.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.merge_companies(
  p_survivor_id uuid,
  p_absorbed_id uuid,
  p_score       numeric default 1.0,
  p_evidence    jsonb   default '[]',
  p_decided_by  text    default 'auto'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  survivor  public.companies;
  absorbed  public.companies;
begin
  if p_survivor_id = p_absorbed_id then
    raise exception 'Fusion impossible : une entreprise ne peut pas s''absorber elle-même';
  end if;

  -- Verrouillage dans un ordre déterministe : deux fusions concurrentes
  -- portant sur les mêmes entreprises ne doivent pas se bloquer mutuellement.
  if p_survivor_id < p_absorbed_id then
    select * into survivor from public.companies where id = p_survivor_id for update;
    select * into absorbed from public.companies where id = p_absorbed_id for update;
  else
    select * into absorbed from public.companies where id = p_absorbed_id for update;
    select * into survivor from public.companies where id = p_survivor_id for update;
  end if;

  if survivor.id is null or absorbed.id is null then
    raise exception 'Fusion impossible : entreprise introuvable (% ou %)',
      p_survivor_id, p_absorbed_id;
  end if;

  -- Garde-fou définitif : deux établissements identifiés ne fusionnent jamais,
  -- quelle que soit la décision transmise.
  if survivor.siret is not null and absorbed.siret is not null
     and survivor.siret <> absorbed.siret then
    raise exception 'Fusion refusée : SIRET différents (% et %), ce sont deux établissements',
      survivor.siret, absorbed.siret
      using errcode = 'check_violation';
  end if;

  if survivor.siren is not null and absorbed.siren is not null
     and survivor.siren <> absorbed.siren then
    raise exception 'Fusion refusée : SIREN différents (% et %), ce sont deux unités légales',
      survivor.siren, absorbed.siren
      using errcode = 'check_violation';
  end if;

  -- ── Trace, avant toute modification ────────────────────────────────────
  insert into public.company_merges
    (survivor_id, absorbed_id, absorbed_snapshot, score, evidence, decided_by)
  values
    (p_survivor_id, p_absorbed_id, to_jsonb(absorbed), p_score, p_evidence, p_decided_by);

  -- ── Le survivant hérite de ce qui lui manque ───────────────────────────
  update public.companies c
  set siren               = coalesce(c.siren, absorbed.siren),
      siret               = coalesce(c.siret, absorbed.siret),
      commercial_name     = coalesce(c.commercial_name, absorbed.commercial_name),
      domain              = coalesce(c.domain, absorbed.domain),
      website_url         = coalesce(c.website_url, absorbed.website_url),
      website_confidence  = coalesce(c.website_confidence, absorbed.website_confidence),
      phone               = coalesce(c.phone, absorbed.phone),
      contact_form_url    = coalesce(c.contact_form_url, absorbed.contact_form_url),
      address             = coalesce(c.address, absorbed.address),
      postal_code         = coalesce(c.postal_code, absorbed.postal_code),
      city                = coalesce(c.city, absorbed.city),
      region              = coalesce(c.region, absorbed.region),
      lat                 = coalesce(c.lat, absorbed.lat),
      lon                 = coalesce(c.lon, absorbed.lon),
      industry_code       = coalesce(c.industry_code, absorbed.industry_code),
      industry_label      = coalesce(c.industry_label, absorbed.industry_label),
      employee_min        = coalesce(c.employee_min, absorbed.employee_min),
      employee_max        = coalesce(c.employee_max, absorbed.employee_max),
      creation_date       = coalesce(c.creation_date, absorbed.creation_date),
      -- L'état le plus renseigné l'emporte ; « unknown » ne remplace rien.
      company_status      = case when c.company_status = 'unknown'
                                 then absorbed.company_status else c.company_status end,
      identity_confidence = greatest(c.identity_confidence, absorbed.identity_confidence),
      data_quality_score  = greatest(c.data_quality_score, absorbed.data_quality_score),
      -- Une restriction l'emporte toujours : il suffit qu'une source l'ait posée.
      prospecting_allowed = c.prospecting_allowed and absorbed.prospecting_allowed,
      suppression_global  = c.suppression_global or absorbed.suppression_global,
      suppression_reason  = coalesce(c.suppression_reason, absorbed.suppression_reason),
      last_seen_at        = greatest(c.last_seen_at, absorbed.last_seen_at),
      -- Priorité de scan : la plus urgente des deux.
      scan_priority       = greatest(c.scan_priority, absorbed.scan_priority),
      updated_at          = now()
  where c.id = p_survivor_id;

  -- ── Transfert de tout ce qui pend à l'absorbée ─────────────────────────
  --
  -- `on conflict do nothing` partout : le survivant peut déjà porter la même
  -- source ou le même signal, auquel cas l'absorbé est simplement abandonné.

  update public.company_sources set company_id = p_survivor_id
  where company_id = p_absorbed_id
    and not exists (
      select 1 from public.company_sources s2
      where s2.company_id = p_survivor_id
        and s2.source_name = company_sources.source_name
        and s2.source_external_id = company_sources.source_external_id
    );
  delete from public.company_sources where company_id = p_absorbed_id;

  update public.company_field_provenance set company_id = p_survivor_id
  where company_id = p_absorbed_id
    and not exists (
      select 1 from public.company_field_provenance p2
      where p2.company_id = p_survivor_id
        and p2.field = company_field_provenance.field
        and p2.source_name = company_field_provenance.source_name
    );
  delete from public.company_field_provenance where company_id = p_absorbed_id;

  update public.signals set company_id = p_survivor_id
  where company_id = p_absorbed_id
    and not exists (
      select 1 from public.signals s2
      where s2.company_id = p_survivor_id
        and s2.fingerprint = signals.fingerprint
        and s2.active
    );
  delete from public.signals where company_id = p_absorbed_id;

  -- Opportunités : une seule vivante par (entreprise, type).
  update public.opportunities set company_id = p_survivor_id
  where company_id = p_absorbed_id
    and not exists (
      select 1 from public.opportunities o2
      where o2.company_id = p_survivor_id
        and o2.opportunity_type = opportunities.opportunity_type
        and o2.status in ('available', 'assigned')
    );
  delete from public.opportunities where company_id = p_absorbed_id;

  update public.company_events set company_id = p_survivor_id where company_id = p_absorbed_id;
  update public.company_cooldowns set company_id = p_survivor_id where company_id = p_absorbed_id;

  -- Attributions : au plus une vivante par entreprise. Si les deux en ont une,
  -- celle de l'absorbée est relâchée — l'utilisateur garde son historique.
  update public.assignments set status = 'released'
  where company_id = p_absorbed_id
    and status in ('active', 'contacted')
    and exists (
      select 1 from public.assignments a2
      where a2.company_id = p_survivor_id and a2.status in ('active', 'contacted')
    );
  update public.assignments set company_id = p_survivor_id where company_id = p_absorbed_id;

  -- Paires de doublons impliquant l'absorbée : elles n'ont plus d'objet.
  delete from public.company_duplicate_candidates
  where company_a_id = p_absorbed_id or company_b_id = p_absorbed_id;

  delete from public.companies where id = p_absorbed_id;

  perform public.refresh_company_metrics(array[p_survivor_id]);

  return p_survivor_id;
end;
$$;

comment on function public.merge_companies is
  'Fusionne deux entreprises. Transfère tout ce qui pend à l''absorbée, conserve son état dans company_merges, et refuse toujours deux SIRET ou SIREN différents.';

/**
 * Choisit le survivant entre deux entreprises.
 *
 * Règle explicite plutôt qu'ordre d'arrivée : c'est l'identité la mieux
 * établie qui doit subsister, sans quoi une fiche pauvre pourrait absorber une
 * fiche complète.
 */
create or replace function public.pick_merge_survivor(a_id uuid, b_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.companies
  where id in (a_id, b_id)
  order by
    (siret is not null) desc,          -- établissement identifié
    (siren is not null) desc,
    identity_confidence desc,
    (domain is not null) desc,
    (phone is not null) desc,
    created_at asc                     -- à égalité, la plus ancienne
  limit 1;
$$;

revoke execute on function public.merge_companies(uuid, uuid, numeric, jsonb, text) from public;
revoke execute on function public.pick_merge_survivor(uuid, uuid) from public;
grant execute on function public.merge_companies(uuid, uuid, numeric, jsonb, text) to service_role;
grant execute on function public.pick_merge_survivor(uuid, uuid) to service_role;
