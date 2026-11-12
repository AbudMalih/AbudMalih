# syntax=docker/dockerfile:1.7
# One-off import job: download (checksummed), extract and load OpenStreetMap addresses into geodb,
# validate, then switch atomically (deploy/geodb/prepare.py). No system packages: pyosmium and
# psycopg come as pinned wheels. © OpenStreetMap contributors, ODbL.
# Optional build secret `build_ca`: extra CA for a TLS-inspecting proxy (CI/sandboxes) – never stored.
ARG PY_IMAGE=python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90
# Same Debian release (13) in full: only to take libexpat (pyosmium's one system dependency) without apt.
ARG PY_FULL_IMAGE=python:3.13@sha256:ecbe213fb818d557fd19db4078244339e2e2e52874f9c81052d3094ea114d797
FROM ${PY_FULL_IMAGE} AS libs
RUN mkdir /out && cp -a /usr/lib/"$(uname -m)"-linux-gnu/libexpat.so.1* /out/

FROM ${PY_IMAGE}
COPY --from=libs /out/ /usr/local/lib/
RUN ldconfig
RUN --mount=type=secret,id=build_ca,required=false,mode=0444 \
    if [ -f /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi \
 && pip install --no-cache-dir --disable-pip-version-check osmium==4.3.2 "psycopg[binary]==3.3.9" \
 && useradd --system --uid 10003 --no-create-home geodb \
 && mkdir -p /work && chown geodb /work
COPY deploy/geodb/prepare.py deploy/geodb/schema.sql /opt/geodb/
COPY tools/osm_addresses.py /opt/geodb/osm_addresses.py
USER geodb
ENTRYPOINT ["python3", "/opt/geodb/prepare.py"]
