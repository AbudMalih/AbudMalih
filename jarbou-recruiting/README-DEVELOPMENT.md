# JARBOU Recruiting Command Center – Developer guide (v2.0 NAS)

## Architecture

```
Browser (frontend/, plain HTML/CSS/JS, no build step, no external CDN)
   │  JSON over HTTP(S), session cookie + X-CSRF-Token, Server-Sent Events for live updates
   ▼
app container  (Node 22 + Express, backend/src)          ← port 8080 published
   │  parameterised SQL (pg), transactions
   ▼
db container   (PostgreSQL 16, internal Docker network only, no published port)
   │
NAS folders: data/postgres · data/uploads · backups
```

| Folder | Content |
|---|---|
| `frontend/` | existing UI (design unchanged), `login.html`, `js/api.js` (HTTP client), `js/auth.js` (user/permissions/UI gating), `js/store.js` (server-backed store), views, translations `js/lang/de.js`, `js/lang/ar.js` |
| `backend/src/` | `server.js` (app, headers, errors), `auth.js`, `rbac.js`, `candidate-model.js`, `routes-*.js`, `attachments.js`, `backup.js`, `audit.js`, `migrate.js`, `cli.js` |
| `database/migrations/` | forward-only numbered SQL migrations |
| `docs/API.md` | complete API reference |
| `tests/` | API tests (`node --test`) and the full stack test script |
| `docker/`, `Dockerfile`, `docker-compose*.yml` | deployment |

## Migration plan (offline v1 → NAS v2) – as implemented

1. **Inventory of v1** – single-page app; all candidate mutations went through `J.app.save → J.store.put`
   (IndexedDB), settings through `J.store.saveSettings`. Business logic (readiness, warnings, KPIs,
   targets) lived in `logic.js` and operated on in-memory candidate objects.
2. **Keep the seam, replace the storage** – `db.js` (IndexedDB) was replaced by `store.js` with the
   *same interface*. The in-memory working copy is filled from `GET /api/candidates` and kept current by
   incremental sync (`?since=`) + SSE. Therefore all existing screens, filters, sorting, exports,
   print, translations and RTL keep working, and `logic.js` still computes readiness consistently.
3. **Relational schema** – the nested candidate object is normalised into `candidates`,
   `candidate_documents`, `contracts`, `candidate_onboarding`, `follow_ups`, `candidate_activity`,
   `candidate_notes`, `attachments` plus master data (`projects`, `stations`, `positions`,
   `recruitment_sources`, `document_types`, `onboarding_templates`, `recruitment_targets`), `users`,
   `sessions`, `settings`, `audit_logs`, `backup_history`. `candidate-model.js` maps both ways.
4. **Writes as field-level changes** – the store diffs the working copy against the last server
   version and sends `{path, from, to}`; the server applies a change only if nobody else changed that
   field (409 otherwise). Different fields edited by two users merge; same-field edits never
   overwrite silently.
5. **Security layer** – sessions, CSRF, RBAC on every route, audit log, secure uploads.
6. **Operations** – server backups with retention and atomic restore, health check, Docker.
7. **Data migration** – `Settings → Import offline backup` reads the v1 JSON backup, previews,
   detects duplicates (name / phone), imports in one transaction, records an audit entry.
8. **Removed on purpose** – browser-local backup/restore and "erase local database"
   (replaced by server backups and admin restore).

## Local development

```bash
cp .env.example .env            # set POSTGRES_PASSWORD, APP_SECRET, INITIAL_ADMIN_*
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
# frontend/ and backend/src are live-mounted: reload the browser for frontend changes,
# `docker compose restart app` for backend changes.
docker compose logs -f app
```
Open http://localhost:8080. Without Docker you can run the backend directly
(`cd backend && npm ci && DB_HOST=localhost POSTGRES_PASSWORD=… node src/server.js`) against any PostgreSQL 16.

### Frontend conventions
- No build step, no external dependencies, strict CSP (`script-src 'self'`): **no inline scripts or
  `onclick=`**. Use the delegated action system: `data-action="x"` + `J.actions.x = function (el, e) {}`
  (`data-change`, `data-input` likewise).
- Escape all data with `J.util.esc`.
- Every visible text: `J.t('English literal', arg0, …)` – first argument must be a string literal
  (keys are extracted from the source). Add German/Arabic translations to `js/lang/de.js` and `js/lang/ar.js`.
- Permissions in the UI: `J.auth.can('candidate.write')` etc. (cosmetic – the server enforces).

### Backend conventions
- Only parameterised queries (`$1`), transactions via `db.tx(async (q) => …)`.
- Every mutating route: `requirePerm(...)`, validation, `audit.write(q, req, …)`, `events.publish(...)`.
- Throw `errors.badRequest/forbidden/notFound/conflict` – never leak stack traces.
- Never log passwords, hashes, tokens or document contents.

## Database migrations

- Files `database/migrations/NNN_description.sql`, applied in order at every start by
  `backend/src/migrate.js` (inside a transaction each, guarded by a PostgreSQL advisory lock,
  recorded in `schema_migrations` with a checksum).
- **Never edit an applied migration.** Add a new file, e.g. `003_add_driver_card.sql`.
- Migrations must be **additive and data-preserving** (add columns with defaults, backfill, then
  constrain). Never `DROP` data that users entered.
- Manual run: `docker compose exec app node src/cli.js migrate`.

## Update / rollback procedure
BACKUP → STOP APP → UPDATE CODE → BUILD + START (migrations run) → VERIFY → ROLLBACK IF REQUIRED
(details for operators in `README-UGREEN.md` §20). A failed migration aborts the start and leaves
the database unchanged (transaction). If a successful migration must be undone, restore the
pre-update backup.

## Backups (implementation)
`backend/src/backup.js`: `pg_dump` (plain SQL, sessions excluded) + `uploads/` + `manifest.json` →
`backups/jarbou-recruiting_<date>_<time>_<kind>.tar.gz`. Scheduler checks every minute (container
time zone `TZ`). Retention GFS: daily/weekly/monthly for automatic backups. Restore: safety backup →
stage documents inside the uploads mount → `DROP SCHEMA public CASCADE; CREATE SCHEMA public; \i dump`
in **one** `psql --single-transaction` → swap documents → run migrations → delete all sessions.
`pg_dump`/`psql` come from the same PostgreSQL 16 image the database uses, so versions always match.

## Security notes
| Topic | Implementation |
|---|---|
| Passwords | Argon2id (19 MiB, t=2), policy (length, letters+numbers, not containing username), forced change of initial/temporary passwords |
| Sessions | random 256-bit token, stored as HMAC(APP_SECRET), HttpOnly + SameSite=Strict cookie, `Secure` configurable, idle + absolute expiry, rotated per login (no fixation), revoked on deactivation/password reset/restore |
| CSRF | per-session token header on every write + Origin check + SameSite=Strict |
| Access control | `requirePerm` on every route; 401/403; object ids validated; archive/delete restricted |
| Mass assignment | only whitelisted field paths are writable; read-only fields ignored |
| SQL injection | parameterised queries only; table names only from fixed whitelists |
| XSS | output escaping in the UI, CSP without inline script, uploads served as attachments with `nosniff` + sandbox CSP |
| Uploads | content sniffing (magic bytes), whitelist (PDF/JPG/PNG/WEBP/HEIC/DOCX/XLSX, no macros), size limit, generated names, path-traversal guard, stored outside the web root |
| Brute force | per-user and per-IP login rate limiting, generic error messages, constant-time dummy hash for unknown users |
| Network | PostgreSQL on an `internal: true` Docker network, no published port |
| Audit | append-only table (trigger rejects UPDATE/DELETE/TRUNCATE) |
| Privacy | no analytics, no CDN, no external calls; SSE events carry only ids |

## Tests

```bash
tests/run-stack-tests.sh          # builds an isolated stack (port 18080) and runs everything:
                                  # API tests, permissions, conflicts, uploads, import,
                                  # audit immutability, persistence across restarts, backup+restore
KEEP=1 tests/run-stack-tests.sh   # keep the test stack running afterwards
```
API tests only (against a running instance):
`TEST_BASE_URL=http://127.0.0.1:18080 TEST_ADMIN_USER=admin TEST_ADMIN_PASS=… node --test tests/api/`
