-- L'audit d'une page, à envoyer au prospect.
--
-- La force numéro un des outils du marché : un livrable court, aux couleurs
-- du freelance, envoyé en un clic, et l'alerte quand le prospect l'ouvre.
-- Nous avons la capture, la note et les constats ; il manquait la page qui
-- les assemble sous un lien qu'on peut coller dans un e-mail.
--
-- Le contenu est FIGÉ à la création : ce que le prospect lit reste ce que
-- le freelance a envoyé, même si le site est rescanné le lendemain. Le
-- lien est un UUID : impossible à deviner, et sans session — le prospect
-- n'a pas de compte chez nous.
create table public.audit_shares (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  snapshot      jsonb not null,
  created_at    timestamptz not null default now(),
  opened_at     timestamptz,
  last_opened_at timestamptz,
  open_count    integer not null default 0
);

comment on table public.audit_shares is
  'Audit d''une page partagé avec un prospect. snapshot : le contenu figé ; open_count : les ouvertures constatées.';

alter table public.audit_shares enable row level security;

-- Le freelance relit ses propres partages ; le service écrit et sert la
-- page publique par son identifiant.
grant select on public.audit_shares to authenticated;
grant all on public.audit_shares to service_role;

create policy audit_shares_select_own on public.audit_shares
  for select to authenticated
  using (user_id = (select auth.uid()));
