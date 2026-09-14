-- ============================================================================
-- Schurco CRM — user deactivation + edit audit trail
--
-- Part 1: profiles.deactivated_at — a denormalized marker the new
-- deactivate-user Edge Function sets after banning someone in Supabase
-- Auth (auth.users isn't directly queryable via PostgREST, so this is
-- how the Team screen shows/filters status without another round trip).
--
-- Part 2: updated_by + an auto-set trigger on the 4 CRM-owned tables
-- (clients, contacts, contracts, activities). References public.profiles
-- rather than auth.users directly so it can be embedded in a normal
-- select (`updated_by:profiles(name)`). Deliberately scoped to CRM-owned
-- tables only — audits/opportunities stay untouched, consistent with the
-- rest of this build.
-- ============================================================================

alter table public.profiles add column deactivated_at timestamptz;

create or replace function public.set_updated_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

alter table public.clients add column updated_by uuid references public.profiles(id);
alter table public.contacts add column updated_by uuid references public.profiles(id);
alter table public.contracts add column updated_by uuid references public.profiles(id);
alter table public.activities add column updated_by uuid references public.profiles(id);

create trigger t_audit_clients before update on public.clients
  for each row execute function public.set_updated_audit();
create trigger t_audit_contacts before update on public.contacts
  for each row execute function public.set_updated_audit();
create trigger t_audit_contracts before update on public.contracts
  for each row execute function public.set_updated_audit();
create trigger t_audit_activities before update on public.activities
  for each row execute function public.set_updated_audit();
