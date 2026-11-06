# syntax=docker/dockerfile:1.7
# TURVIO Dispatch / Admin (Next.js standalone server). Build with --build-arg APP=dispatch|admin.
# Optional build secret `build_ca`: extra CA for a TLS-inspecting proxy (CI/sandboxes).
# Not needed on the staging server; never stored in an image layer.
ARG NODE_IMAGE=node:22-trixie-slim@sha256:be1e2a3dc2c4fd68cdfadad2a696a280e0d2749098bee509230174d72fb768c6

FROM ${NODE_IMAGE} AS build
ARG APP
ARG TURVIO_ENV=staging
RUN test "$APP" = dispatch || test "$APP" = admin
WORKDIR /src
RUN --mount=type=secret,id=build_ca,required=false if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm_config_cafile=/run/secrets/build_ca PIP_CERT=/run/secrets/build_ca; fi && npm install -g pnpm@10.28.0 --no-audit --no-fund
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/dispatch/package.json apps/dispatch/
COPY apps/admin/package.json apps/admin/
COPY apps/driver/package.json apps/driver/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/web-ui/package.json packages/web-ui/
COPY packages/web-session/package.json packages/web-session/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm_config_cafile=/run/secrets/build_ca PIP_CERT=/run/secrets/build_ca; fi && pnpm install --frozen-lockfile --filter "@turvio/${APP}..." --ignore-scripts
COPY packages/shared packages/shared
COPY packages/web-ui packages/web-ui
COPY packages/web-session packages/web-session
COPY apps/${APP} apps/${APP}
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone NEXT_PUBLIC_TURVIO_ENV=${TURVIO_ENV}
# Limit the build's heap so it fits next to running services on a 4 GB server.
RUN NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter "@turvio/${APP}" build
RUN mkdir -p /out && cp -r apps/${APP}/.next/standalone/. /out/ \
 && mkdir -p /out/apps/${APP}/.next && cp -r apps/${APP}/.next/static /out/apps/${APP}/.next/static \
 && if [ -d apps/${APP}/public ]; then cp -r apps/${APP}/public /out/apps/${APP}/public; fi \
 # Sources may arrive with umask 077 (deploy export): readable + traversable for the node user.
 && chmod -R u=rwX,go=rX /out

FROM ${NODE_IMAGE} AS runtime
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 APP=${APP}
WORKDIR /app
COPY --from=build --chown=root:root /out ./
# Next.js writes its fetch/image cache here; mounted as tmpfs in compose (read-only root FS).
RUN mkdir -p /app/apps/${APP}/.next/cache && chown node:node /app/apps/${APP}/.next/cache
USER node
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"]
CMD ["sh", "-c", "exec node apps/${APP}/server.js"]
