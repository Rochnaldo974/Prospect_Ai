-- Les comptages du jour sur les domaines (découverts, scannés) parcouraient
-- le parc entier : deux index sur les dates suffisent.

create index if not exists domains_created_at_idx on public.domains (created_at desc);
create index if not exists domains_last_checked_idx on public.domains (last_checked_at desc) where last_checked_at is not null;
