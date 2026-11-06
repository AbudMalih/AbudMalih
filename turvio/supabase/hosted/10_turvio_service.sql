-- =============================================================================
-- Hosted Supabase only (staging / production). Applied ONCE, after all files in
-- supabase/migrations/, by a project owner – never by the local scripts.
--
-- Creates the login role the TURVIO API connects with. Like the local
-- `turvio_service` it does NOT bypass RLS: every request switches to
-- `authenticated` with the caller's JWT claims (Db.asUser). With
-- AUTH_PROVIDER=supabase the API never writes auth.users, so – unlike the
-- local file – no auth.* write grants and no app_auth schema.
--
-- The password is NOT in this file. Set it afterwards in the SQL editor
-- (alter role turvio_service password '...') with a generated secret and store
-- it only in the hosting provider's secret store (DATABASE_URL).
-- Connect via the Supavisor *session* pooler (port 5432, user
-- turvio_service.<project-ref>) – LISTEN/NOTIFY does not work on 6543.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'turvio_service') then
    create role turvio_service login;
  end if;
end $$;

grant authenticated to turvio_service;
grant usage on schema public, app to turvio_service;
-- Team list and invitation e-mails (read only).
grant select (id, email) on auth.users to turvio_service;
grant usage on schema auth to turvio_service;
grant execute on function app.accept_invitation(text, uuid), app.invitation_info(text) to turvio_service;
grant select, update, delete on app.storage_deletions to turvio_service;
grant execute on function app.purge_expired_data() to turvio_service;
grant usage on schema geo to turvio_service;
grant select, insert, update, delete on geo.addresses to turvio_service;
grant usage, select on all sequences in schema geo to turvio_service;
grant execute on function geo.norm(text) to turvio_service;
grant execute on function app.log_read(uuid, uuid, text, text) to turvio_service;
