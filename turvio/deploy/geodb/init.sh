#!/usr/bin/env bash
# docker-entrypoint-initdb.d hook: runs once, when the geodb volume is first created.
set -euo pipefail
: "${GEODB_READER_PASSWORD:?set GEODB_READER_PASSWORD}"
psql -v ON_ERROR_STOP=1 -X -q --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /opt/geodb/schema.sql
psql -v ON_ERROR_STOP=1 -X -q --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "alter role geo_reader password '$(printf %s "$GEODB_READER_PASSWORD" | sed "s/'/''/g")'"
