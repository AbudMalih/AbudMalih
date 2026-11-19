-- Phase I, step 2 – apply the three pending migrations to turvio-staging, then re-run the hosted grants.
-- RUN ONLY AFTER THE OWNER'S EXPLICIT APPROVAL. Additive only; no existing row is changed.
-- Each migration is its own transaction (an enum value cannot be used in the transaction that adds it).
-- Every transaction first checks the exact expected state and aborts otherwise (psql ON_ERROR_STOP=1),
-- so a re-run after a partial failure continues safely or stops; a lock timeout changes nothing.
\set ON_ERROR_STOP 1
set statement_timeout = '120s';

\echo '== 1/6 20261119000100_tour_lifecycle_enums'
begin; set local lock_timeout = '5s';
do $$ begin
  if (select max(version) from supabase_migrations.schema_migrations) <> '20261118000100' then
    raise exception 'staging is not at 20261118000100 – stop';
  end if;
end $$;
\ir ../../../supabase/migrations/20261119000100_tour_lifecycle_enums.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000100', 'tour_lifecycle_enums');
commit;

\echo '== 2/6 20261119000200_tour_lifecycle'
begin; set local lock_timeout = '5s';
do $$ begin
  if (select max(version) from supabase_migrations.schema_migrations) <> '20261119000100' then
    raise exception 'expected 20261119000100 before the lifecycle migration – stop';
  end if;
end $$;
\ir ../../../supabase/migrations/20261119000200_tour_lifecycle.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000200', 'tour_lifecycle');
commit;

\echo '== 3/6 20261119000300_settings_preferences'
begin; set local lock_timeout = '5s';
do $$ begin
  if (select max(version) from supabase_migrations.schema_migrations) <> '20261119000200' then
    raise exception 'expected 20261119000200 before the settings migration – stop';
  end if;
end $$;
\ir ../../../supabase/migrations/20261119000300_settings_preferences.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000300', 'settings_preferences');
commit;

\echo '== 4/6 20261119000400_failure_reason_private'
begin; set local lock_timeout = '5s';
do $$ begin
  if (select max(version) from supabase_migrations.schema_migrations) <> '20261119000300' then
    raise exception 'expected 20261119000300 before 0400 – stop';
  end if;
end $$;
\ir ../../../supabase/migrations/20261119000400_failure_reason_private.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000400', 'failure_reason_private');
commit;

\echo '== 5/6 20261119000500_platform_admin_management'
begin; set local lock_timeout = '5s';
do $$ begin
  if (select max(version) from supabase_migrations.schema_migrations) <> '20261119000400' then
    raise exception 'expected 20261119000400 before 0500 – stop';
  end if;
end $$;
\ir ../../../supabase/migrations/20261119000500_platform_admin_management.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000500', 'platform_admin_management');
commit;

\echo '== 6/6 hosted service-role grants (idempotent)'
\ir ../../../supabase/hosted/10_turvio_service.sql

select max(version) as latest_migration from supabase_migrations.schema_migrations;
\echo '== done – now run phase-i-step2-verify.sql'
