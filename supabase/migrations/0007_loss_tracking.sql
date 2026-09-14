-- ============================================================================
-- Schurco CRM — loss tracking on the Opportunities pipeline
--
-- Mirrors how "Won" already works: pipeline_stages gets an is_lost flag
-- (mutually exclusive with is_won), and a "Lost" stage is seeded so it
-- shows up as its own Kanban column. loss_reasons is admin-extensible,
-- same pattern as pipeline_stages/job_titles — seeded with common reasons.
-- opportunities gets a nullable loss_reason_id plus a free-text loss_notes
-- for extra detail beyond the fixed list.
-- ============================================================================

alter table public.pipeline_stages add column is_lost boolean not null default false;
alter table public.pipeline_stages
  add constraint pipeline_stages_not_won_and_lost check (not (is_won and is_lost));

create table public.loss_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

alter table public.loss_reasons enable row level security;

create policy loss_reasons_select on public.loss_reasons
  for select using (auth.uid() is not null);
create policy loss_reasons_insert on public.loss_reasons
  for insert with check (is_admin());
create policy loss_reasons_update on public.loss_reasons
  for update using (is_admin());
create policy loss_reasons_delete on public.loss_reasons
  for delete using (is_admin());

grant select, insert, update, delete on public.loss_reasons to authenticated;

insert into public.loss_reasons (name, sort_order) values
  ('Price', 1),
  ('Lost to competitor', 2),
  ('Budget cut / no budget', 3),
  ('Timing / delayed', 4),
  ('Went cold / no decision', 5),
  ('Other', 6);

alter table public.opportunities add column loss_reason_id uuid references public.loss_reasons(id);
alter table public.opportunities add column loss_notes text;

insert into public.pipeline_stages (name, sort_order, color, is_won, is_lost) values
  ('Lost', 6, '#b3261e', false, true);
