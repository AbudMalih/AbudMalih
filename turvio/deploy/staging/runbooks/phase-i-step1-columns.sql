-- Phase I, step 1 – per-column fingerprint of stops and location_pings (READ-ONLY; names, counts, hashes,
-- times only). Run it twice and compare line by line:
--   (a) on staging:            ... psql "<staging>" -X -v ON_ERROR_STOP=1 -v since=<backup time, e.g. 2026-11-19T10:15:00Z> -f this file
--   (b) on the restored backup: COLUMNS_SQL=<this file> bash turvio-staging-backup-verify.sh <dump>.gpg
-- Every hash is ordered by the primary key (no collation involved). A column whose hash differs in (a) and
-- (b) while the serialization settings in S0 are equal is a real data change in that column.
begin transaction read only;
-- Same float text on every server (Supabase sessions default to 0 = rounded to 15 digits).
set local extra_float_digits = 1;

\echo '== S0. serialization settings'
select current_setting('server_version') server_version, current_setting('TimeZone') timezone,
       current_setting('extra_float_digits') extra_float_digits, current_setting('DateStyle') datestyle;

\echo '== S1. column types'
select table_name, md5(string_agg(column_name || ' ' || data_type, ',' order by column_name)) types_md5, count(*) columns
  from information_schema.columns where table_schema = 'public' and table_name in ('stops', 'location_pings') group by 1 order by 1;

\echo '== S2. stops: rows, newest change, hash per column (id order)'
select count(*) n, max(updated_at) newest_updated_at, max(created_at) newest_created_at from public.stops;
select key as column, md5(string_agg(value::text, '|' order by x.id)) h
  from public.stops x, jsonb_each(to_jsonb(x)) group by key order by key;

\echo '== S3. location_pings: rows, id range, newest ping, hash per column (id order)'
select count(*) n, min(id) min_id, max(id) max_id, max(recorded_at) newest_ping from public.location_pings;
select key as column, md5(string_agg(value::text, '|' order by x.id)) h
  from public.location_pings x, jsonb_each(to_jsonb(x)) group by key order by key;

\if :{?since}
\echo '== S4. staging only: rows changed or added after the backup was taken'
select (select count(*) from public.stops where updated_at > :'since'::timestamptz) stops_updated_after_backup,
       (select count(*) from public.stops where created_at > :'since'::timestamptz) stops_created_after_backup,
       (select count(*) from public.location_pings where recorded_at > :'since'::timestamptz) pings_after_backup;
\endif

rollback;
