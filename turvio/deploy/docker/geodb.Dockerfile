# syntax=docker/dockerfile:1.7
# Address database server for the geocoder (GEOCODER=postgres + GEOCODER_DATABASE_URL).
# Plain PostgreSQL 17 + the geo schema (created on the first start of the geodb-data volume).
# Internal network only; the API reads it with the select-only role geo_reader.
# Addresses are loaded by the separate geodb-prepare image (deploy.sh --geodb-refresh).
ARG PG_IMAGE=postgres:17-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994
FROM ${PG_IMAGE}
# The deploy export uses umask 077: the initdb hook runs as postgres and must read both files.
COPY --chmod=644 deploy/geodb/schema.sql /opt/geodb/
COPY --chmod=755 deploy/geodb/init.sh /opt/geodb/
RUN chmod 0755 /opt/geodb && ln -s /opt/geodb/init.sh /docker-entrypoint-initdb.d/10-geodb.sh
