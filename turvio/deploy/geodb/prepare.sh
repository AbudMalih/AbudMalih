#!/usr/bin/env bash
# Loads OpenStreetMap addresses into the geodb database and switches the geocoder to them atomically.
# Runs inside the geodb image:  deploy.sh --geodb-refresh   (docker compose … run --rm geodb-prepare)
#
#   GEODB_REGIONS     Geofabrik Germany sub-regions, default "niedersachsen bremen"
#                     (e.g. add "hessen" for the Kassel/Haiger depots)
#   GEODB_PBF_FILES   instead of downloading: space-separated local .osm.pbf files (tests, offline)
#   GEODB_MIN_ROWS    refuse to activate an import with fewer rows (default 300000)
#   PGHOST/PGUSER/PGPASSWORD/PGDATABASE   the geodb server (admin), GEODB_READER_PASSWORD for geo_reader
#
# Safety: the new data is loaded into geo.addresses_new and validated (row count, sample lookups)
# before one short transaction swaps it in. A failed or refused run leaves the active data untouched.
# Data: © OpenStreetMap contributors, ODbL – attribution is shown wherever results appear.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REGIONS="${GEODB_REGIONS:-niedersachsen bremen}"
MIN_ROWS="${GEODB_MIN_ROWS:-300000}"
WORK="${GEODB_WORK:-/work}"
: "${GEODB_READER_PASSWORD:?set GEODB_READER_PASSWORD}"
export PGDATABASE="${PGDATABASE:-geo}"
psqlq() { psql -v ON_ERROR_STOP=1 -X -q "$@"; }

need_mb=$(( $(echo "$REGIONS" | wc -w) * 1500 ))
free_mb=$(df -Pm "$WORK" | awk 'NR == 2 { print $4 }')
echo "preflight: regions='$REGIONS' free disk in $WORK: ${free_mb} MB (needs ~${need_mb} MB)"
[ "$free_mb" -ge "$need_mb" ] || { echo "REFUSED: not enough disk in $WORK" >&2; exit 3; }

run="$WORK/run-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$run"
trap 'rm -rf "$run"' EXIT

# ---- 1. source files (download with checksum, or given local files) -------------------------
files=()
sources=()
if [ -n "${GEODB_PBF_FILES:-}" ]; then
  for f in $GEODB_PBF_FILES; do files+=("$f"); sources+=("file:$(basename "$f")@$(md5sum "$f" | cut -c1-12)"); done
else
  for r in $REGIONS; do
    url="https://download.geofabrik.de/europe/germany/$r-latest.osm.pbf"
    echo "downloading $url"
    curl -fSL --retry 3 --max-time 3600 -o "$run/$r.osm.pbf" "$url"
    curl -fsSL --retry 3 -o "$run/$r.md5" "$url.md5"
    want=$(cut -d' ' -f1 "$run/$r.md5")
    got=$(md5sum "$run/$r.osm.pbf" | cut -d' ' -f1)
    [ "$want" = "$got" ] || { echo "checksum mismatch for $r ($got != $want)" >&2; exit 4; }
    files+=("$run/$r.osm.pbf"); sources+=("geofabrik:$r@$want")
  done
fi

# ---- 2. extract addresses (street;house_number;postcode;city;lat;lng) ---------------------
csv="$run/addresses.csv"
: >"$csv"
for f in "${files[@]}"; do
  echo "extracting addresses from $(basename "$f")"
  python3 "$HERE/osm_addresses.py" "$f" | tail -n +2 >>"$csv"
done
echo "extracted $(wc -l <"$csv") address rows (before de-duplication)"

# ---- 3. load into geo.addresses_new ---------------------------------------------------------
psqlq -f "$HERE/schema.sql"
psqlq -c "alter role geo_reader password '$(printf %s "$GEODB_READER_PASSWORD" | sed "s/'/''/g")'"
psqlq <<'SQL'
drop table if exists geo.addresses_new;
create table geo.addresses_new (like geo.addresses including defaults including generated including identity including constraints);
create unique index addresses_new_uniq on geo.addresses_new (street_norm, hn_norm, postcode);
drop table if exists geo.load_raw;
create unlogged table geo.load_raw (street text, house_number text, postcode text, city text, lat double precision, lng double precision);
SQL
psqlq -c "\copy geo.load_raw from '$csv' with (format csv, delimiter ';')"
psqlq <<'SQL'
-- The unique index is the conflict arbiter: OSM duplicates (node + building) keep the first row.
insert into geo.addresses_new (street, house_number, postcode, city, lat, lng)
select street, nullif(house_number, ''), postcode, city, lat, lng from geo.load_raw
 where postcode ~ '^[0-9]{5}$' and lat between -90 and 90 and lng between -180 and 180
on conflict do nothing;
drop table geo.load_raw;
create index addresses_new_street_idx on geo.addresses_new (street_norm text_pattern_ops, postcode);
create index addresses_new_postcode_idx on geo.addresses_new (postcode);
create index addresses_new_city_idx on geo.addresses_new (city_norm text_pattern_ops);
create index addresses_new_latlng_idx on geo.addresses_new (lat, lng);
analyze geo.addresses_new;
SQL

# ---- 4. validate before activating ----------------------------------------------------------
rows=$(psql -XAtq -c "select count(*) from geo.addresses_new")
echo "loaded $rows unique addresses"
if [ "$rows" -lt "$MIN_ROWS" ]; then
  echo "REFUSED: only $rows rows (< GEODB_MIN_ROWS=$MIN_ROWS); active data unchanged" >&2
  psqlq -c "drop table geo.addresses_new"; exit 5
fi
# Sample lookups: each downloaded region must answer for its main city's postcodes.
if [ -z "${GEODB_PBF_FILES:-}" ]; then
  for r in $REGIONS; do
    case "$r" in niedersachsen) prefix=301 ;; bremen) prefix=281 ;; hessen) prefix=341 ;; *) continue ;; esac
    n=$(psql -XAtq -c "select count(*) from geo.addresses_new where postcode like '$prefix%'")
    echo "check $r: $n addresses with postcode $prefix…"
    [ "$n" -gt 1000 ] || { echo "REFUSED: region $r looks empty; active data unchanged" >&2; psqlq -c "drop table geo.addresses_new"; exit 6; }
  done
fi

# ---- 5. atomic switch -----------------------------------------------------------------------
version="osm-$(date -u +%Y%m%d)-$(echo "${sources[*]}" | md5sum | cut -c1-8)"
psqlq <<SQL
begin;
alter table geo.addresses rename to addresses_previous;
alter index geo.addresses_street_idx rename to addresses_previous_street_idx;
alter index geo.addresses_postcode_idx rename to addresses_previous_postcode_idx;
alter index geo.addresses_city_idx rename to addresses_previous_city_idx;
alter index geo.addresses_uniq rename to addresses_previous_uniq;
alter index if exists geo.addresses_latlng_idx rename to addresses_previous_latlng_idx;
alter table geo.addresses_new rename to addresses;
alter index geo.addresses_new_street_idx rename to addresses_street_idx;
alter index geo.addresses_new_postcode_idx rename to addresses_postcode_idx;
alter index geo.addresses_new_city_idx rename to addresses_city_idx;
alter index geo.addresses_new_uniq rename to addresses_uniq;
alter index geo.addresses_new_latlng_idx rename to addresses_latlng_idx;
grant select on geo.addresses to geo_reader;
insert into geo.meta (version, regions, rows, source) values ('$version', '$REGIONS', $rows, '${sources[*]}')
  on conflict (version) do update set rows = excluded.rows, imported_at = now();
commit;
drop table geo.addresses_previous;
SQL
echo "ACTIVE: $version ($rows addresses). Set ADDRESS_DATA_VERSION=$version in .env (deploy.sh picks it up)."
