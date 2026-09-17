-- Les fonctions des lots 1 à 3 avaient retiré EXECUTE à `public`, dont
-- `service_role` hérite : le worker et le site ne pouvaient plus les
-- appeler en RPC. Le droit est rendu à la clé de service, et à elle seule.

grant execute on function public.engine_metrics(date) to service_role;
grant execute on function public.prune_opportunity_rejections(interval) to service_role;
grant execute on function public.engine_setting_int(text, integer) to service_role;
grant execute on function public.assign_opportunity(uuid, uuid, uuid, smallint, numeric, boolean, timestamptz) to service_role;
grant execute on function public.select_allocation_candidates(uuid, public.opportunity_type[], text, text, text, text[], boolean, integer) to service_role;
grant execute on function public.match_company_to_sirene(uuid) to service_role;
