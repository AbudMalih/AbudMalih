# JARBOU Recruiting Command Center – application image (frontend + API)
#
# Runtime base = the official PostgreSQL 16 image: it already contains pg_dump/psql in EXACTLY the
# same version as the database server (needed for backups/restore), plus su-exec, tar, wget and tzdata.
# Node.js is copied in from the official Node image (same Alpine release).

# ---- 1) install backend dependencies -------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- 2) runtime ----------------------------------------------------------------------------------
FROM postgres:16-alpine
COPY --from=deps /usr/local/bin/node /usr/local/bin/node
RUN addgroup -S node && adduser -S -G node -H -h /app node \
 && mkdir -p /app /data/uploads /backups

WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/src ./src
COPY frontend /app/frontend
COPY database /app/database
COPY VERSION /app/VERSION
COPY docker/entrypoint.sh /usr/local/bin/app-entrypoint.sh
RUN chmod +x /usr/local/bin/app-entrypoint.sh && node --version

ENV NODE_ENV=production \
    APP_PORT_INTERNAL=8080 \
    FRONTEND_DIR=/app/frontend \
    MIGRATIONS_DIR=/app/database/migrations \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/backups \
    TZ=Europe/Berlin

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1

STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/app-entrypoint.sh"]
CMD ["node", "src/server.js"]
