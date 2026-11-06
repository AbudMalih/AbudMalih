-- =============================================================================
-- Geocoder: ASCII umlaut spellings ("Herrenhaeuser Strasse", "Mueller") match
-- the umlaut forms. Found with real OpenStreetMap data for Region Hannover.
-- Must stay identical to normAddressPart() in apps/api/src/geocode.ts (tested).
-- Stored generated columns are not recomputed when the function changes, so
-- they are rebuilt; rows that now normalise identically are de-duplicated.
-- =============================================================================
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

drop index geo.addresses_uniq;
update geo.addresses set street = street, city = city;
delete from geo.addresses a using geo.addresses b
 where a.id > b.id and a.street_norm = b.street_norm and a.hn_norm = b.hn_norm and a.postcode = b.postcode;
create unique index addresses_uniq on geo.addresses (street_norm, hn_norm, postcode);
