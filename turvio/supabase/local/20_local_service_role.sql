-- =============================================================================
-- Local service role for the TURVIO API (equivalent of connecting as the
-- `postgres` role in Supabase). It may switch to `authenticated` for
-- per-request RLS and use the local auth schema. It does NOT bypass RLS.
-- The password is set by scripts/db.sh from TURVIO_DB_PASSWORD.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'turvio_service') then
    create role turvio_service login;
  end if;
end $$;

grant authenticated to turvio_service;
grant usage on schema public, auth, app, app_auth to turvio_service;
grant select, insert, update on auth.users to turvio_service;
grant select, insert, update, delete on all tables in schema app_auth to turvio_service;
grant usage, select on all sequences in schema app_auth to turvio_service;
grant execute on function app.accept_invitation(text, uuid), app.invitation_info(text) to turvio_service;
grant select, update, delete on app.storage_deletions to turvio_service;
grant execute on function app.purge_expired_data() to turvio_service;
grant usage on schema geo to turvio_service; grant select, insert, update, delete on geo.addresses to turvio_service; grant usage, select on all sequences in schema geo to turvio_service; grant execute on function geo.norm(text) to turvio_service;
grant execute on function app.log_read(uuid, uuid, text, text) to turvio_service;
-- Stop location checks (20261118000100_stop_location_history); skipped on older schemas.
do $$
begin
  if to_regprocedure('app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int)') is not null then
    grant execute on function app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int) to turvio_service;
  end if;
end $$;
