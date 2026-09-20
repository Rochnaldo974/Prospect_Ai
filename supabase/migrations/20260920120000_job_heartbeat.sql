-- Signe de vie des jobs en cours.
--
-- Le balayage reprend tout job « running » dont le verrou a plus de quinze
-- minutes. Sans signe de vie, un scan de deux mille domaines (quarante
-- minutes) ou une passe d'identité était repris et exécuté une seconde
-- fois, en parallèle de la première. Le worker rafraîchit désormais le
-- verrou de ses jobs chaque minute ; seul un worker réellement mort laisse
-- le verrou vieillir.

create or replace function public.heartbeat_jobs(worker text, ids bigint[])
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with touched as (
    update public.job_queue
    set locked_at = now()
    -- Le nom ET les identifiants : après un redémarrage, le même nom porte
    -- encore les verrous de l'ancien processus.
    where status = 'running' and locked_by = worker and id = any(ids)
    returning id
  )
  select count(*)::integer from touched;
$$;

revoke execute on function public.heartbeat_jobs(text, bigint[]) from public, anon, authenticated;
grant execute on function public.heartbeat_jobs(text, bigint[]) to service_role;
