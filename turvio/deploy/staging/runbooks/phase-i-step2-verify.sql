-- Phase I, step 2 – verify the migrated database (READ-ONLY; counts, names and hashes only).
begin transaction read only;
set local statement_timeout = '60s';
set local extra_float_digits = 1;

\echo '== V1. migrations (expect latest 20261119000300; 20261119000100/0200/0300 present once each)'
select version, name from supabase_migrations.schema_migrations where version >= '20261118000100' order by version;

\echo '== V2. data fingerprint (expect identical to the fingerprint taken just before the apply)'
\ir ../../../supabase/rollback/fingerprint.sql

\echo '== V3. new columns empty (expect 0 | 0 | 0)'
select (select count(*) from public.tours where closed_at is not null or archived_at is not null or closed_remotely) as tours_with_lifecycle,
       (select count(*) from public.stops where cancelled_at is not null or returned_from_tour_id is not null) as stops_with_lifecycle,
       (select count(*) from public.tours where status = 'cancelled') + (select count(*) from public.stops where status = 'cancelled') as cancelled_rows;

\echo '== V4. RLS on new tables (expect both t); anon grants on them (expect 0)'
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('tour_deletions', 'user_preferences') order by 1;
select count(*) as anon_grants from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('tour_deletions', 'user_preferences') and grantee in ('anon', 'PUBLIC');

\echo '== V5. SECURITY DEFINER functions without search_path='''' (expect only public.rls_auto_enable(), pre-existing)'
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app', 'public') and p.prosecdef and not coalesce(p.proconfig, '{}') @> array['search_path=""'];

\echo '== V6. lifecycle objects (expect 5 functions, 2 triggers)'
select count(*) as lifecycle_functions from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('close_tour', 'cancel_stop', 'delete_tour', 'tour_delete_eligibility', 'delete_draft_stop');
select tgname from pg_trigger where not tgisinternal and tgname in ('tours_lifecycle_guard', 'user_preferences_touch') order by 1;

\echo '== V7. health (expect no transaction older than 1 minute, no blocked locks)'
select count(*) as old_transactions from pg_stat_activity
 where datname = current_database() and xact_start is not null and now() - xact_start > interval '1 minute' and pid <> pg_backend_pid();
select count(*) as blocked_lock_waits from pg_locks where not granted;

rollback;
