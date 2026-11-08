-- Minimal stand-ins for objects Supabase provides, so the migrations can run on
-- a plain PostgreSQL (local development, CI) and PGlite (unit tests).
-- NOT applied to a Supabase project – Supabase already provides these.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) unique, -- as on hosted Supabase (auth.users.email is varchar(255))
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;
-- Default privileges as found on the hosted turvio-staging project (2026-11-06,
-- pg_default_acl for role postgres in schema public): new tables give anon,
-- authenticated and service_role TRUNCATE, REFERENCES, TRIGGER (+ MAINTAIN on PG 17).
-- Emulated here so local tests see the same privileges the hosted project will.
do $$
begin
  execute 'alter default privileges in schema public grant truncate, references, trigger'
    || case when current_setting('server_version_num')::int >= 170000 then ', maintain' else '' end
    || ' on tables to anon, authenticated, service_role';
end $$;
