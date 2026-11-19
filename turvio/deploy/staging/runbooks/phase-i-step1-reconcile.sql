-- Phase I, step 1 – reconcile the pre-check with the verified backup (READ-ONLY, counts/hashes/names only).
-- Usage: same psql command as phase-i-step1-prechecks.sql, with this file instead.
begin transaction read only;
set local statement_timeout = '60s';

\echo '== R1. the unpinned SECURITY DEFINER function (name, origin, settings, who may execute it)'
select p.oid::regprocedure as function, pg_get_userbyid(p.proowner) as owner, l.lanname as language,
       coalesce(p.proconfig::text, 'none') as settings,
       coalesce((select e.extname from pg_depend d join pg_extension e on e.oid = d.refobjid
                  where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'), '-') as from_extension,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
       md5(p.prosrc) as body_md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
 where n.nspname in ('app', 'public') and p.prosecdef and not coalesce(p.proconfig, '{}') @> array['search_path=""'];

\echo '== R2. organizations / stops with the backup-verify formula (full rows) – must equal the backup [5] hashes'
select 'organizations' t, count(*) n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) h from public.organizations x
union all select 'stops', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.stops x;

\echo '== R3. location_pings: database collation, then the hash in three orderings'
select datcollate, datctype, datlocprovider from pg_database where datname = current_database();
select 'text order, database collation' variant, count(*) n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) h from public.location_pings x
union all select 'text order, collate "C"', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text collate "C"), '')) from public.location_pings x
union all select 'id order (collation-free)', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.location_pings x;
select count(*) > 0 as has_en_us from pg_collation where collname = 'en_US.utf8' \gset
\if :has_en_us
\echo '   the order the backup-verify container (postgres:17, en_US.utf8) used:'
select 'text order, collate "en_US.utf8"' variant, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text collate "en_US.utf8"), '')) h from public.location_pings x;
\else
\echo '   (collation en_US.utf8 not available on this server)'
\endif
select min(id) as min_id, max(id) as max_id, max(recorded_at) as latest_ping from public.location_pings;

rollback;
