-- Phase I, step 3 – tracking stabilization migration 20261120000100 on turvio-staging.
-- RUN ONLY AFTER THE OWNER'S EXPLICIT APPROVAL. Additive (new columns, functions, triggers).
\set ON_ERROR_STOP 1
set statement_timeout = '120s';

\echo '== 1/2 20261120000100_tracking_stabilization'
begin; set local lock_timeout = '5s';
do $$ begin
  if (select max(version) from supabase_migrations.schema_migrations) <> '20261119000500' then
    raise exception 'staging is not at 20261119000500 – stop';
  end if;
end $$;
\ir ../../../supabase/migrations/20261120000100_tracking_stabilization.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261120000100', 'tracking_stabilization');
commit;

\echo '== 2/2 hosted service-role grants (idempotent)'
\ir ../../../supabase/hosted/10_turvio_service.sql

select max(version) as latest_migration from supabase_migrations.schema_migrations;
\echo '== done – now run phase-i-step3-verify.sql'
