-- L'identité par le référentiel local se fait dans la base, la nuit.
--
-- Le worker appelait le rapprochement entreprise par entreprise à travers
-- l'API, qui coupe toute requête à huit secondes : sur une base dont le
-- cache ne tient pas les six millions d'établissements, le rapprochement
-- approché prend cinq à quinze secondes et tombait sur chaque entreprise,
-- sans même la dater — vingt mille échecs par nuit, zéro identité.
--
-- pg_cron exécute désormais une passe complète dans la base : l'égalité
-- stricte pour tout le lot (quelques millisecondes chacune), puis le
-- rapprochement approché dans un budget de temps, et le reste est daté
-- pour passer derrière. Une ligne de job_runs garde la trace, comme pour
-- un job du worker.

create index if not exists companies_identity_queue_idx
  on public.companies (identity_lookup_at nulls first, id)
  where siren is null and postal_code is not null and prospecting_allowed;

create or replace function public.resolve_identity_local_batch(p_limit integer default 20000, p_fuzzy_budget interval default interval '25 minutes')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_run_id uuid := gen_random_uuid();
  v_examined integer := 0;
  v_matched integer := 0;
  v_fuzzy integer := 0;
  v_ambiguous integer := 0;
  v_unmatched integer := 0;
  v_errors integer := 0;
  v_fuzzy_skipped integer := 0;
  v_company record;
  v_hit record;
  v_is_fuzzy boolean;
begin
  insert into public.job_runs (id, job_type, status, started_at, worker_id)
  values (v_run_id, 'resolve_identity_local', 'running', v_started, 'pg_cron');

  create temp table identity_batch on commit drop as
    select id from public.companies
    where siren is null and postal_code is not null and prospecting_allowed
    order by identity_lookup_at nulls first, id
    limit p_limit;

  for v_company in select id from identity_batch loop
    v_examined := v_examined + 1;
    v_is_fuzzy := false;
    begin
      select * into v_hit from public.match_company_to_sirene(v_company.id) limit 1;
      if v_hit.siren is null then
        -- L'approché coûte des secondes : seulement tant que le budget tient.
        if clock_timestamp() < v_started + p_fuzzy_budget then
          select * into v_hit from public.match_company_to_sirene_fuzzy(v_company.id, 0.72) limit 1;
          v_is_fuzzy := v_hit.siren is not null;
        else
          v_fuzzy_skipped := v_fuzzy_skipped + 1;
        end if;
      end if;

      if v_hit.siren is null then
        v_unmatched := v_unmatched + 1;
        update public.companies set identity_lookup_at = now() where id = v_company.id;
        continue;
      end if;

      if coalesce(v_hit.candidates, 1) > 1 then v_ambiguous := v_ambiguous + 1; end if;
      v_matched := v_matched + 1;
      if v_is_fuzzy then v_fuzzy := v_fuzzy + 1; end if;

      begin
        update public.companies set
          siren = v_hit.siren,
          siret = v_hit.siret,
          industry_code = coalesce(v_hit.naf_code, industry_code),
          creation_date = coalesce(v_hit.creation_date, creation_date),
          identity_confidence = case when v_is_fuzzy then 0.76 else 0.8 end,
          identity_lookup_at = now()
        where id = v_company.id and siren is null;
      exception when unique_violation then
        -- Le SIRET est déjà porté par une autre fiche : on garde le SIREN seul.
        update public.companies set
          siren = v_hit.siren,
          identity_confidence = case when v_is_fuzzy then 0.76 else 0.8 end,
          identity_lookup_at = now()
        where id = v_company.id and siren is null;
      end;
    exception when others then
      v_errors := v_errors + 1;
    end;
  end loop;

  update public.job_runs set
    status = 'succeeded',
    completed_at = clock_timestamp(),
    processed_count = v_examined,
    success_count = v_matched,
    failed_count = v_errors,
    metadata = jsonb_build_object('fuzzy', v_fuzzy, 'ambiguous', v_ambiguous, 'unmatched', v_unmatched, 'fuzzy_skipped', v_fuzzy_skipped, 'in_database', true)
  where id = v_run_id;

  return jsonb_build_object('examined', v_examined, 'matched', v_matched, 'fuzzy', v_fuzzy, 'ambiguous', v_ambiguous,
    'unmatched', v_unmatched, 'errors', v_errors, 'fuzzy_skipped', v_fuzzy_skipped,
    'seconds', round(extract(epoch from (clock_timestamp() - v_started))));
end;
$$;

revoke execute on function public.resolve_identity_local_batch(integer, interval) from public, anon, authenticated;
grant execute on function public.resolve_identity_local_batch(integer, interval) to service_role;

-- Le cron appelle la base directement : le rôle postgres n'a pas les huit
-- secondes de l'API (statement_timeout à trente minutes).
select cron.unschedule('resolve-identity-local');
select cron.schedule(
  'resolve-identity-local',
  '50 4 * * *',
  $$ select public.resolve_identity_local_batch(20000, interval '25 minutes') $$
);
