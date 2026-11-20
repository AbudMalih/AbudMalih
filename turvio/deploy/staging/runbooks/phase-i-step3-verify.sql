-- Phase I, step 3 – verify the tracking stabilization migration (READ-ONLY).
begin transaction read only;
set local statement_timeout = '60s';
set local extra_float_digits = 1;

\echo '== S1. migration (expect latest 20261120000100)'
select max(version) as latest_migration from supabase_migrations.schema_migrations;

\echo '== S2. data fingerprint (expect identical to the fingerprint taken just before the apply)'
\ir ../../../supabase/rollback/fingerprint.sql

\echo '== S3. new objects (expect t | t | t | 4)'
select exists (select 1 from pg_trigger where tgname = 'driver_positions_quality') as quality_trigger,
       exists (select 1 from pg_trigger where tgname = 'tracking_notice_acks_audit') as ack_audit_trigger,
       to_regprocedure('public.driver_withdraw_tracking_ack(uuid)') is not null as withdraw_function,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name like 'tracking_notice_%' and column_name <> 'tracking_notice_version') as notice_columns;

\echo '== S4. withdraw function: executable by authenticated, not by anon (expect t | f)'
select has_function_privilege('authenticated', 'public.driver_withdraw_tracking_ack(uuid)', 'EXECUTE') as authenticated_exec,
       has_function_privilege('anon', 'public.driver_withdraw_tracking_ack(uuid)', 'EXECUTE') as anon_exec;

\echo '== S5. SECURITY DEFINER search_path (same rule as step 2 V5: expect no function listed, 0 | 1, f | f)'
select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as unpinned_definer_function
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app', 'public') and p.prosecdef
   and not coalesce(p.proconfig, '{}') && array['search_path=""', 'search_path=pg_catalog']
   and p.oid is distinct from to_regprocedure('public.rls_auto_enable()')
 order by 1;
select count(*) filter (where not pinned and not exception) as unpinned_definer_functions,
       count(*) filter (where exception) as documented_exceptions
  from (select coalesce(p.proconfig, '{}') && array['search_path=""', 'search_path=pg_catalog'] as pinned,
               coalesce(p.oid = to_regprocedure('public.rls_auto_enable()'), false) as exception
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('app', 'public') and p.prosecdef) d;
select case when e is null then null else has_function_privilege('anon', e, 'EXECUTE') end as exception_anon_execute,
       case when e is null then null else has_function_privilege('authenticated', e, 'EXECUTE') end as exception_authenticated_execute
  from (select to_regprocedure('public.rls_auto_enable()') as e) x;

\echo '== S6. live positions still present for running tours (informational)'
select count(*) as live_positions from public.driver_positions;

rollback;
