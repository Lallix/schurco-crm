-- ============================================================================
-- Schurco CRM — OMNI customer code on clients
--
-- Groundwork for the upcoming client aging screen: OMNI (the external
-- accounting/ERP system) identifies customers by its own code, not by
-- name, so aging records need an explicit mapping rather than the
-- name-based auto-linking already used for audits/opportunities.
-- Nullable and admin/sales-editable like the rest of the clients table —
-- populated by hand until/unless OMNI's own data suggests a bulk match.
-- ============================================================================

alter table public.clients add column omni_code text;
create index clients_omni_code_idx on public.clients(omni_code) where omni_code is not null;
