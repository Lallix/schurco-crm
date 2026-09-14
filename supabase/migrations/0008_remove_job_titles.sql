-- ============================================================================
-- Schurco CRM — remove the job_titles feature
--
-- Superseded by profiles.role, the free-text field already captured when
-- a user is created in the Site Audit App's own admin page — no need for
-- a second, CRM-only job title concept. 2 profiles currently have
-- job_title_id set; that assignment is discarded here since profiles.role
-- is the new source of truth for the same information.
-- ============================================================================

alter table public.profiles drop column job_title_id;
drop table public.job_titles;
