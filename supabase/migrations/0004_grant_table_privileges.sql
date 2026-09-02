-- ============================================================================
-- Schurco CRM — fix missing table grants
--
-- CREATE TABLE via raw SQL does not grant PostgREST-usable privileges the
-- way Supabase's dashboard table editor does. RLS policies only filter rows
-- AFTER a base GRANT permits the operation — without this, every request
-- against these 5 tables is rejected before RLS is even evaluated
-- ("permission denied for table ..."). audits/opportunities already have
-- these grants (pre-existing, unaffected); this brings the 5 new CRM
-- tables in line with that same convention.
-- ============================================================================

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.pipeline_stages to authenticated;
