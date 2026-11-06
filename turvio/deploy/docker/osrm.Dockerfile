# syntax=docker/dockerfile:1.7
# OSRM road routing – the same build that was verified locally: npm @project-osrm/osrm 26.4.1
# binaries on Ubuntu 24.04 with libtbb12. Data is NOT baked in: deploy/staging/osrm/prepare.sh
# builds it into the osrm-data volume.
# Optional build secret `build_ca`: extra CA for a TLS-inspecting proxy (CI/sandboxes).
# Not needed on the staging server; never stored in an image layer.
ARG NODE_IMAGE=node:22-trixie-slim@sha256:be1e2a3dc2c4fd68cdfadad2a696a280e0d2749098bee509230174d72fb768c6
ARG RUNTIME_IMAGE=ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
ARG OSRM_VERSION=26.4.1

FROM ${NODE_IMAGE} AS fetch
ARG OSRM_VERSION
WORKDIR /tmp/osrm
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm_config_cafile=/run/secrets/build_ca; fi \
 && npm init -y >/dev/null && npm install --no-audit --no-fund "@project-osrm/osrm@${OSRM_VERSION}" \
 && mkdir -p /opt/osrm && cp -r node_modules/@project-osrm/osrm/lib/binding_napi_v8 /opt/osrm/bin \
 && cp -r node_modules/@project-osrm/osrm/profiles /opt/osrm/profiles && rm -f /opt/osrm/bin/node_osrm.node

FROM ${RUNTIME_IMAGE}
# apt verifies package signatures; HTTPS is used only when a proxy CA is supplied (sandbox builds).
RUN --mount=type=secret,id=build_ca,required=false,mode=0444 \
    APT_OPTS=""; if [ -f /run/secrets/build_ca ]; then \
      sed -i 's#http://#https://#g' /etc/apt/sources.list.d/ubuntu.sources; \
      APT_OPTS="-o Acquire::https::CAInfo=/run/secrets/build_ca"; fi \
 && apt-get $APT_OPTS update \
 && apt-get $APT_OPTS install -y --no-install-recommends libtbb12 libtbbmalloc2 curl ca-certificates \
 && sed -i 's#https://#http://#g' /etc/apt/sources.list.d/ubuntu.sources \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10002 --no-create-home osrm \
 && mkdir -p /data && chown osrm:osrm /data
COPY --from=fetch /opt/osrm /opt/osrm
COPY --chmod=755 deploy/staging/osrm/prepare.sh /opt/osrm/prepare.sh
ENV PATH=/opt/osrm/bin:$PATH
USER 10002
EXPOSE 5000
# Coordinates inside Region Hannover (Hannover Hbf area).
HEALTHCHECK --interval=20s --timeout=4s --start-period=30s --retries=3 \
  CMD ["curl", "-fsS", "-o", "/dev/null", "http://127.0.0.1:5000/nearest/v1/driving/9.7409,52.3766"]
CMD ["osrm-routed", "--algorithm", "ch", "--max-table-size", "1000", "--max-viaroute-size", "1000", "--port", "5000", "/data/current/map.osrm"]
