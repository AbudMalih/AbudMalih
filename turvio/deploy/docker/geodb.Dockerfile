# syntax=docker/dockerfile:1.7
# Self-hosted address database for the geocoder (GEOCODER=postgres + GEOCODER_DATABASE_URL).
# One image, two uses:
#   geodb          the Postgres server (internal network only; the API reads it as geo_reader)
#   geodb-prepare  one-off import job: deploy/geodb/prepare.sh (download, checksum, extract, load,
#                  validate, atomic switch) – deploy.sh --geodb-refresh
# Data is NOT baked in. © OpenStreetMap contributors, ODbL.
# Pin the digest on the server before the first deployment (docker buildx imagetools inspect).
# Optional build secret `build_ca`: extra CA for a TLS-inspecting proxy (CI/sandboxes) – never stored.
ARG PG_IMAGE=postgres:17-bookworm
FROM ${PG_IMAGE}
RUN --mount=type=secret,id=build_ca,required=false,mode=0444 \
    APT_OPTS=""; if [ -f /run/secrets/build_ca ]; then \
      sed -i 's#http://#https://#g' /etc/apt/sources.list.d/*.sources 2>/dev/null || true; \
      APT_OPTS="-o Acquire::https::CAInfo=/run/secrets/build_ca"; fi \
 && apt-get $APT_OPTS update \
 && apt-get $APT_OPTS install -y --no-install-recommends python3 python3-pyosmium curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY deploy/geodb/schema.sql deploy/geodb/prepare.sh deploy/geodb/init.sh /opt/geodb/
COPY tools/osm_addresses.py /opt/geodb/osm_addresses.py
RUN chmod 0755 /opt/geodb/*.sh && ln -s /opt/geodb/init.sh /docker-entrypoint-initdb.d/10-geodb.sh \
 && mkdir -p /work && chown postgres:postgres /work
