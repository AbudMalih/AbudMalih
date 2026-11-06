# syntax=docker/dockerfile:1.7
# TURVIO API – bundled with esbuild, runs as the unprivileged `node` user.
# Optional build secret `build_ca`: extra CA for a TLS-inspecting proxy (CI/sandboxes).
# Not needed on the staging server; never stored in an image layer.
ARG NODE_IMAGE=node:22-trixie-slim@sha256:be1e2a3dc2c4fd68cdfadad2a696a280e0d2749098bee509230174d72fb768c6

FROM ${NODE_IMAGE} AS build
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
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm_config_cafile=/run/secrets/build_ca PIP_CERT=/run/secrets/build_ca; fi && pnpm install --frozen-lockfile --filter "@turvio/api..." --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @turvio/api build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=root:root /src/apps/api/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/server.mjs"]
