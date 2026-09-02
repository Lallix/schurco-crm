-- ============================================================================
-- Schurco CRM — initial schema migration
-- Project: gxdyhhdyyobbzfnanoan (Schurco-Audit, shared with the Site Audit App)
--
-- Additive only. Does not alter any existing column, policy, trigger, or
-- function belonging to the Site Audit App. Safe to run against the live
-- project without affecting index.html / admin.html.
--
-- Adds:
--   - clients, contacts, contracts, activities (new CRM-owned tables)
--   - client_id (nullable FK) on audits and opportunities
--   - crm_role (nullable) on profiles
--   - crm_role() helper function, mirroring the existing is_admin()/my_org_id()
--     pattern used throughout the current schema
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New tables
-- ----------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations(id),
  name text not null,
  type text check (type in ('Customer','Distributor','Prospect','Contractor','Supplier')),
  country text,
  region text,
  address text,
  location jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  name text not null,
  role text check (role in (
    'Plant Engineer','Head of Engineering','Maintenance Foreman','Store Manager',
    'Procurement Manager','Plant Manager','Production Manager','Other'
  )),
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  opportunity_id text references public.opportunities(id),
  contract_type text,
  status text check (status in ('Draft','Active','Under Review','Terminated','Expired')) default 'Draft',
  start_date date,
  end_date date,
  termination_notice_period text,
  has_termination_for_convenience_clause boolean default false,
  termination_clause_notes text,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  contact_id uuid references public.contacts(id),
  opportunity_id text references public.opportunities(id),
  type text not null check (type in ('Call','Email','Site Visit','Task','Note')),
  due_date date,
  assigned_to uuid references public.profiles(id),
  status text not null default 'Open' check (status in ('Open','Done')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- 2. Additive columns on existing tables (nullable, no defaults that change
--    existing row behaviour, existing app code is unaffected)
-- ----------------------------------------------------------------------------

alter table public.audits add column client_id uuid references public.clients(id);
alter table public.opportunities add column client_id uuid references public.clients(id);
alter table public.profiles add column crm_role text check (crm_role in ('Admin','Sales','Finance','Viewer'));

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------

create index clients_org_id_idx on public.clients(org_id);
create index contacts_client_id_idx on public.contacts(client_id);
create index contracts_client_id_idx on public.contracts(client_id);
create index contracts_opportunity_id_idx on public.contracts(opportunity_id);
create index activities_client_id_idx on public.activities(client_id);
create index activities_contact_id_idx on public.activities(contact_id);
create index activities_opportunity_id_idx on public.activities(opportunity_id);
create index activities_assigned_to_idx on public.activities(assigned_to);
create index audits_client_id_idx on public.audits(client_id);
create index opportunities_client_id_idx on public.opportunities(client_id);

-- ----------------------------------------------------------------------------
-- 4. org_id auto-fill trigger on clients, reusing the existing
--    auto_set_org_id() function already used by audits/opportunities/pumps
-- ----------------------------------------------------------------------------

create trigger t_org_clients
  before insert on public.clients
  for each row execute function public.auto_set_org_id();

-- ----------------------------------------------------------------------------
-- 5. crm_role() helper, mirroring the existing is_admin()/my_org_id() style
-- ----------------------------------------------------------------------------

create or replace function public.crm_role()
returns text
language plpgsql
stable
as $$
DECLARE v text;
BEGIN
  SELECT crm_role INTO v FROM public.profiles WHERE id = auth.uid();
  RETURN v;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.contracts enable row level security;
alter table public.activities enable row level security;

-- clients: any org member reads (incl. Viewer); Admin/Sales write
create policy clients_select on public.clients
  for select using (is_admin() or org_id = my_org_id());

create policy clients_insert on public.clients
  for insert with check (is_admin() or crm_role() in ('Admin','Sales'));

create policy clients_update on public.clients
  for update using (is_admin() or crm_role() in ('Admin','Sales'));

create policy clients_delete on public.clients
  for delete using (is_admin());

-- contacts: scoped via parent client's org; Admin/Sales write
create policy contacts_select on public.contacts
  for select using (
    is_admin() or exists (
      select 1 from public.clients c
      where c.id = contacts.client_id and c.org_id = my_org_id()
    )
  );

create policy contacts_insert on public.contacts
  for insert with check (
    is_admin() or (
      crm_role() in ('Admin','Sales') and exists (
        select 1 from public.clients c
        where c.id = contacts.client_id and c.org_id = my_org_id()
      )
    )
  );

create policy contacts_update on public.contacts
  for update using (
    is_admin() or (
      crm_role() in ('Admin','Sales') and exists (
        select 1 from public.clients c
        where c.id = contacts.client_id and c.org_id = my_org_id()
      )
    )
  );

create policy contacts_delete on public.contacts
  for delete using (is_admin());

-- contracts: any org member reads; Admin/Finance write (financial ownership)
create policy contracts_select on public.contracts
  for select using (
    is_admin() or exists (
      select 1 from public.clients c
      where c.id = contracts.client_id and c.org_id = my_org_id()
    )
  );

create policy contracts_insert on public.contracts
  for insert with check (
    is_admin() or (
      crm_role() in ('Admin','Finance') and exists (
        select 1 from public.clients c
        where c.id = contracts.client_id and c.org_id = my_org_id()
      )
    )
  );

create policy contracts_update on public.contracts
  for update using (
    is_admin() or (
      crm_role() in ('Admin','Finance') and exists (
        select 1 from public.clients c
        where c.id = contracts.client_id and c.org_id = my_org_id()
      )
    )
  );

create policy contracts_delete on public.contracts
  for delete using (is_admin());

-- activities: readable by assignee/creator or any org member of the linked
-- client; writable by Admin/Sales/Finance (not Viewer), own-record update
create policy activities_select on public.activities
  for select using (
    is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or (client_id is not null and exists (
      select 1 from public.clients c
      where c.id = activities.client_id and c.org_id = my_org_id()
    ))
  );

create policy activities_insert on public.activities
  for insert with check (
    created_by = auth.uid()
    and (is_admin() or crm_role() in ('Admin','Sales','Finance'))
  );

create policy activities_update on public.activities
  for update using (
    is_admin() or created_by = auth.uid() or assigned_to = auth.uid()
  );

create policy activities_delete on public.activities
  for delete using (is_admin());
