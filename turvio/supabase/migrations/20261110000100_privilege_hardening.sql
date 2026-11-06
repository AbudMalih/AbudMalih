-- =============================================================================
-- Privilege hardening for hosted Supabase. The project's default privileges give
-- anon and authenticated TRUNCATE, REFERENCES, TRIGGER and (PG 17) MAINTAIN on
-- every new table in public. TRUNCATE is not subject to RLS, and none of these
-- are needed by TURVIO (foreign keys are checked as the table owner). Removed for
-- existing tables and for tables created later by this role. Data is untouched.
-- =============================================================================
do $$
declare
  extra text := case when current_setting('server_version_num')::int >= 170000 then ', maintain' else '' end;
begin
  execute 'revoke truncate, references, trigger' || extra || ' on all tables in schema public from anon, authenticated';
  execute 'alter default privileges in schema public revoke truncate, references, trigger' || extra || ' on tables from anon, authenticated';
end $$;
