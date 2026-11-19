-- Phase I, step 1 – staging pre-checks (READ-ONLY).
-- Runs inside a READ ONLY transaction: PostgreSQL rejects any write. Prints counts and hashes only,
-- no personal data. Usage (owner's Mac, staging connection string from the password manager):
--   psql "$STAGING_DB_URL" -X -v ON_ERROR_STOP=1 -f turvio/deploy/staging/runbooks/phase-i-step1-prechecks.sql
-- or paste into the Supabase SQL editor (turvio-staging). Expected values are noted per check.
begin transaction read only;
set local statement_timeout = '30s';
set local extra_float_digits = 1;   -- same float text as the backup verification

\echo '== 1. server version (expect 17.x)'
select current_setting('server_version') as server_version;

\echo '== 2. migration history (expect latest 20261118000100; none of 20261119000100/0200/0300)'
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;
select count(*) filter (where version like '20261119%') as pending_versions_already_present,
       max(version) as latest from supabase_migrations.schema_migrations;

\echo '== 3. schema still at the baseline (expect 0 | 0 | 0)'
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tours' and column_name in ('archived_at','closed_at')) as lifecycle_columns,
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('user_preferences','tour_deletions')) as new_tables,
       (select count(*) from pg_enum where enumlabel = 'cancelled' and enumtypid in ('public.tour_status'::regtype, 'public.stop_status'::regtype)) as cancelled_enum_values;

\echo '== 4. health: connections, long-running / idle-in-transaction sessions (expect none older than 1 min)'
select state, count(*) from pg_stat_activity where datname = current_database() group by state order by 2 desc;
select pid, state, now() - xact_start as xact_age, left(query, 60) as query
  from pg_stat_activity
 where datname = current_database() and xact_start is not null and now() - xact_start > interval '1 minute' and pid <> pg_backend_pid()
 order by xact_start;
select count(*) as blocked_lock_waits from pg_locks where not granted;
select pg_size_pretty(pg_database_size(current_database())) as database_size;

\echo '== 5. existing data (counts only)'
select (select count(*) from public.organizations) as organizations, (select count(*) from public.depots) as depots,
       (select count(*) from public.drivers) as drivers, (select count(*) from public.vehicles) as vehicles,
       (select count(*) from public.tours) as tours, (select count(*) from public.stops) as stops,
       (select count(*) from public.parcels) as parcels, (select count(*) from public.proofs) as proofs,
       (select count(*) from public.location_pings) as location_pings, (select count(*) from public.audit_log) as audit_log;
select status, count(*) from public.tours group by 1 order by 1;

\echo '== 6. rule the new unique index enforces (expect 0 rows)'
select organization_id, driver_id, tour_date, count(*) from public.tours
 where driver_id is not null and status <> 'completed' and origin = 'dispatch'
 group by 1, 2, 3 having count(*) > 1;

\echo '== 7. RLS state (expect tables_without_rls = 0, anon_policies = 0, unpinned_definer_functions = 0)'
select count(*) filter (where not c.relrowsecurity) as tables_without_rls, count(*) as public_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
select count(*) as anon_policies from pg_policies where schemaname = 'public' and roles && array['anon','public']::name[];
select count(*) as unpinned_definer_functions from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app','public') and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=""'];
select has_schema_privilege('anon', 'app', 'USAGE') as anon_can_use_app_schema;

\echo '== 8. data fingerprint (keep this output: it must be identical after the migrations)'
\ir ../../../supabase/rollback/fingerprint.sql

rollback;
