-- L'identité d'expéditeur du freelance, et la trace de chaque envoi.
--
-- Un e-mail de prospection qui a l'air d'une machine est jeté ; un e-mail
-- signé — nom, métier, logo, coordonnées — est lu. L'identité appartient à
-- l'utilisateur et n'entre dans aucun dossier : elle habille l'envoi.
create table email_identities (
  user_id uuid primary key references auth.users (id) on delete cascade,
  from_name text not null default '',
  title text not null default '',
  company text not null default '',
  phone text not null default '',
  website text not null default '',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table email_identities enable row level security;

-- La trace : à qui, quoi, quand — depuis quelle attribution. Un envoi est
-- un acte de prospection ; ne pas le tracer, c'est rappeler deux fois.
create table assignment_emails (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now()
);

alter table assignment_emails enable row level security;

create index assignment_emails_assignment_idx on assignment_emails (assignment_id, sent_at desc);

-- Les droits, explicites : une table créée hors du rôle d'administration
-- Supabase n'hérite pas des privilèges par défaut, et même service_role se
-- voit refuser l'écriture. Vécu au premier enregistrement.
grant all on table email_identities, assignment_emails to service_role;
grant select on table email_identities, assignment_emails to authenticated;
