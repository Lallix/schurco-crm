-- ============================================================================
-- Schurco CRM — pipeline stage configuration
--
-- Adds an admin-configurable list of pipeline stages for the Opportunities
-- Kanban board. opportunities.stage stays a free-text column (unchanged,
-- Audit app compatible) — this table just gives the CRM a canonical,
-- reorderable, colorable set of stages to render as Kanban columns.
-- Seeded with the same 5 stage names already live in opportunities.stage
-- today (confirmed via query), so nothing currently in the pipeline goes
-- "missing" from the board on day one.
-- ============================================================================

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null,
  color text not null default '#218240',
  is_won boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

alter table public.pipeline_stages enable row level security;

create policy pipeline_stages_select on public.pipeline_stages
  for select using (auth.uid() is not null);

create policy pipeline_stages_insert on public.pipeline_stages
  for insert with check (is_admin());

create policy pipeline_stages_update on public.pipeline_stages
  for update using (is_admin());

create policy pipeline_stages_delete on public.pipeline_stages
  for delete using (is_admin());

insert into public.pipeline_stages (name, sort_order, color, is_won) values
  ('Identified', 1, '#5b6b62', false),
  ('Qualifying', 2, '#3465a4', false),
  ('Quoting', 3, '#a15c00', false),
  ('Negotiation', 4, '#b3261e', false),
  ('Won', 5, '#218240', true);
