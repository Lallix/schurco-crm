-- ============================================================================
-- Schurco CRM — contract document storage
--
-- Adds a private 'contracts' Storage bucket for uploaded contract documents
-- (referenced by public.contracts.document_path). No existing bucket exists
-- in this project to follow, so this establishes a fresh convention:
-- object path = "<contract id>/<original filename>".
--
-- Read is available to any org member whose client the contract belongs to
-- (mirrors the contracts table's own SELECT policy, via a join back to
-- contracts + clients). Write (upload/replace/delete) is Admin/Finance only,
-- matching the contracts table's own write policy.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false);

create policy contracts_docs_select on storage.objects
  for select using (
    bucket_id = 'contracts' and (
      is_admin() or exists (
        select 1 from public.contracts co
        join public.clients cl on cl.id = co.client_id
        where co.document_path = storage.objects.name and cl.org_id = my_org_id()
      )
    )
  );

create policy contracts_docs_insert on storage.objects
  for insert with check (
    bucket_id = 'contracts' and (is_admin() or crm_role() = 'Finance')
  );

create policy contracts_docs_update on storage.objects
  for update using (
    bucket_id = 'contracts' and (is_admin() or crm_role() = 'Finance')
  );

create policy contracts_docs_delete on storage.objects
  for delete using (
    bucket_id = 'contracts' and (is_admin() or crm_role() = 'Finance')
  );
