-- Self-hosted address database for TURVIO's geocoder (GEOCODER=postgres + GEOCODER_DATABASE_URL).
-- Runs once when the geodb volume is created (docker-entrypoint-initdb.d) and again, idempotently,
-- before every import (prepare.sh). Not tenant data: OpenStreetMap addresses (© OpenStreetMap
-- contributors, ODbL). The API reads it with the select-only role geo_reader.
--
-- geo.norm() and the table must stay identical to supabase/migrations/20261108000100_geocoder.sql
-- and 20261109000100_geocoder_spelling.sql (same matching rules as normAddressPart() in
-- apps/api/src/geocode.ts; the API's geocoder tests cover both).
create schema if not exists geo;

create or replace function geo.norm(t text) returns text
language sql immutable parallel safe as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               translate(replace(lower(coalesce(t, '')), 'ß', 'ss'), 'äöüàáâãåçèéêëìíîïñòóôõùúûýășțş', 'aouaaaaaceeeeiiiinoooouuuyasts'),
               '([aou])e', '\1', 'g'),
             '(strasse|straße|str\.|str)(\s|$)', 'str\2', 'g'),
           '[^a-z0-9]', '', 'g');
$$;

create table if not exists geo.addresses (
  id bigint generated always as identity primary key,
  street text not null,
  house_number text,
  postcode text not null check (postcode ~ '^[0-9]{5}$'),
  city text not null,
  country_code char(2) not null default 'DE',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  source text not null default 'osm',
  street_norm text generated always as (geo.norm(street)) stored,
  city_norm text generated always as (geo.norm(city)) stored,
  hn_norm text generated always as (lower(regexp_replace(coalesce(house_number, ''), '\s', '', 'g'))) stored
);
create index if not exists addresses_street_idx on geo.addresses (street_norm text_pattern_ops, postcode);
create index if not exists addresses_postcode_idx on geo.addresses (postcode);
create index if not exists addresses_city_idx on geo.addresses (city_norm text_pattern_ops);
create unique index if not exists addresses_uniq on geo.addresses (street_norm, hn_norm, postcode);
-- Reverse geocoding filters a small lat/lng box; without this every lookup scans all rows.
create index if not exists addresses_latlng_idx on geo.addresses (lat, lng);

-- What is loaded: one row per successful import (latest = active data).
create table if not exists geo.meta (
  version text primary key,
  regions text not null,
  rows bigint not null,
  source text not null,
  imported_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'geo_reader') then
    create role geo_reader login;
  end if;
end $$;
revoke all on schema geo from public;
grant usage on schema geo to geo_reader;
grant select on all tables in schema geo to geo_reader;
grant execute on function geo.norm(text) to geo_reader;
alter default privileges in schema geo grant select on tables to geo_reader;
