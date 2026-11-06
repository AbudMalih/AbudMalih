-- Phase 5: self-hosted address search (no paid service, no data leaves the system).
-- geo.addresses is filled from an OpenStreetMap extract (tools/osm_addresses.py ->
-- apps/api import-addresses). Not tenant data: read only by the API service role.
create schema if not exists geo;

-- Normalised form for matching German addresses: case/diacritics/ß folded,
-- "straße/strasse/str." unified, punctuation and spaces removed.
create or replace function geo.norm(t text) returns text
language sql immutable parallel safe as $$
  select regexp_replace(
           regexp_replace(
             translate(replace(lower(coalesce(t, '')), 'ß', 'ss'), 'äöüàáâãåçèéêëìíîïñòóôõùúûýășțş', 'aouaaaaaceeeeiiiinoooouuuyasts'),
             '(strasse|straße|str\.|str)(\s|$)', 'str\2', 'g'),
           '[^a-z0-9]', '', 'g');
$$;

create table geo.addresses (
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
create index addresses_street_idx on geo.addresses (street_norm text_pattern_ops, postcode);
create index addresses_postcode_idx on geo.addresses (postcode);
create index addresses_city_idx on geo.addresses (city_norm text_pattern_ops);
create unique index addresses_uniq on geo.addresses (street_norm, hn_norm, postcode);

revoke all on schema geo from public, anon, authenticated;
revoke all on all tables in schema geo from public, anon, authenticated;
