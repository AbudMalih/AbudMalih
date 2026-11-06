-- Phase 5: record read access to personal data (proof-of-delivery files) in the audit log.
-- Called by the API service connection only, after RLS confirmed the reader's access.
create or replace function app.log_read(p_org uuid, p_actor uuid, p_table text, p_record text) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (organization_id, actor_user_id, action, table_name, record_id)
  values (p_org, p_actor, 'read', p_table, p_record);
$$;
revoke execute on function app.log_read(uuid, uuid, text, text) from public, anon, authenticated;
