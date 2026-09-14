-- ============================================================================
-- Schurco CRM — automatic client linking + job titles
--
-- Part 1: replaces the one-off "matching script" idea with a standing
-- database mechanism, now that the Audit app's data has been wiped clean.
-- Going forward, a new audit/opportunity with a customer name that matches
-- an existing client gets linked automatically (client_id), and a new or
-- renamed client retroactively claims any still-unlinked audits/
-- opportunities that match its name. Matching stays conservative — exact
-- normalized name only, same policy as the earlier manual pass. Anything
-- ambiguous (more than one client with the same normalized name) is left
-- unlinked rather than guessed at.
--
-- Part 2: adds an admin-extensible list of job titles, separate from
-- crm_role. crm_role (Admin/Sales/Finance/Viewer) stays the small fixed
-- set that drives RLS/permissions; job_title is purely descriptive and
-- meant to grow over time (Financial Manager, Project Engineer, etc.).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Normalization helper (reused by both trigger directions)
-- ----------------------------------------------------------------------------

create or replace function public.normalize_name(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(trim(txt), '\s+', ' ', 'g'));
$$;

-- ----------------------------------------------------------------------------
-- 2. Forward link: audits/opportunities -> clients
-- ----------------------------------------------------------------------------

create or replace function public.link_record_to_client()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cnt int;
  found_id uuid;
begin
  if new.client_id is not null or new.customer is null or trim(new.customer) = '' then
    return new;
  end if;

  select count(*) into cnt
  from public.clients
  where deleted_at is null
    and normalize_name(name) = normalize_name(new.customer);

  if cnt = 1 then
    select id into found_id
    from public.clients
    where deleted_at is null
      and normalize_name(name) = normalize_name(new.customer)
    limit 1;
    new.client_id := found_id;
  end if;

  return new;
end;
$$;

create trigger t_link_audit_client
  before insert or update of customer on public.audits
  for each row execute function public.link_record_to_client();

create trigger t_link_opportunity_client
  before insert or update of customer on public.opportunities
  for each row execute function public.link_record_to_client();

-- ----------------------------------------------------------------------------
-- 3. Reverse link: a new/renamed client claims matching unlinked records
-- ----------------------------------------------------------------------------

create or replace function public.link_existing_records_to_client()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.audits
  set client_id = new.id
  where client_id is null
    and deleted_at is null
    and normalize_name(customer) = normalize_name(new.name);

  update public.opportunities
  set client_id = new.id
  where client_id is null
    and deleted_at is null
    and normalize_name(customer) = normalize_name(new.name);

  return new;
end;
$$;

create trigger t_link_client_to_existing
  after insert or update of name on public.clients
  for each row execute function public.link_existing_records_to_client();

-- ----------------------------------------------------------------------------
-- 4. Job titles — descriptive, admin-extensible, separate from crm_role
-- ----------------------------------------------------------------------------

create table public.job_titles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

alter table public.job_titles enable row level security;

create policy job_titles_select on public.job_titles
  for select using (auth.uid() is not null);

create policy job_titles_insert on public.job_titles
  for insert with check (is_admin());

create policy job_titles_update on public.job_titles
  for update using (is_admin());

create policy job_titles_delete on public.job_titles
  for delete using (is_admin());

grant select, insert, update, delete on public.job_titles to authenticated;

insert into public.job_titles (name, sort_order) values
  ('Financial Manager', 1),
  ('Sales Manager', 2),
  ('Project Engineer', 3),
  ('Mechanical Engineer', 4),
  ('Sales Executive', 5);

alter table public.profiles add column job_title_id uuid references public.job_titles(id);
