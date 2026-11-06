# turvio-staging – read-only audit and migration plan (for approval)

Audit date 2026-11-06, project ref `xwryomkbrkwjytwofgcu`, with the existing 7-day project-scoped token. **Nothing was written to the project.** SQL ran with `read_only: true`, which Supabase executes as `supabase_read_only_user` in a read-only transaction.

## 1. What the audit found

| Area | Result | Source (HTTP status) |
|---|---|---|
| Project ref | `xwryomkbrkwjytwofgcu` answers every project-scoped endpoint → reference confirmed | several (200) |
| Region | **eu-central-1 (Frankfurt)** – pooler host `aws-1-eu-central-1.pooler.supabase.com` | `GET /config/database/pooler` (200) |
| Status / health | not readable; the database answers queries, so it is running | `GET /v1/projects/{ref}`, `/health`, `/upgrade/status` (403 `project_admin_read`) |
| Postgres | 17.11, UTF8, collation en_US.UTF-8 | SQL (201) |
| Schemas | only Supabase defaults: auth, extensions, graphql, graphql_public, public, realtime, storage, vault | SQL |
| TURVIO objects | none: 0 tables in `public`, no `app`/`geo` schemas, 0 migrations recorded | SQL; `GET /database/migrations` (200 `[]`) |
| Users | 0 in `auth.users` | SQL |
| Storage | 0 buckets; file size limit 50 MB; S3 protocol on, image transformation off | `GET /storage/buckets`, `/config/storage` (200) |
| Extensions | installed: pgcrypto 1.3, uuid-ossp 1.1. Available, not installed: pg_cron, pg_net, pg_trgm, unaccent | SQL |
| Roles | `postgres` (bypassrls, CREATEROLE, not superuser); `authenticated`, `anon`, `service_role`, `authenticator` present; `auth.users` owned by `supabase_auth_admin` | SQL |
| `auth.uid()` | reads `request.jwt.claim.sub`, then `request.jwt.claims->>'sub'` – the API sets both, so RLS works unchanged | SQL |
| PostgREST | exposed schemas `public, graphql_public`, max rows 1000 | `GET /postgrest` (200) |
| Auth | e-mail sign-in on, **sign-up open** (`disable_signup=false`), e-mail confirmation on, **password min. length 6**, JWT 3600 s, refresh-token rotation on, **TOTP MFA enroll+verify on**, phone/WebAuthn off, **no custom SMTP** (built-in mailer, 2 e-mails/h), `site_url=http://localhost:3000`, no redirect URLs, no CAPTCHA, anonymous sign-in off, no third-party auth | `GET /config/auth` (200) |

### Compatibility check of the TURVIO migrations
- All 9 files in `supabase/migrations/` were applied to a fresh **PostgreSQL 17.11** (same version as the project; Supabase role stubs from `supabase/local/00_supabase_stubs.sql`): no errors, all 19 `public` tables have RLS on.
- The 46 API integration tests (RLS, tenant isolation via the API, driver RPCs, proofs, editing, geocoder, routing) **pass on PostgreSQL 17.11**.
- The migrations use only `auth.uid()` and read `auth.users` (foreign keys, e-mail for the team list). They need no extension beyond what is installed, create no triggers on `auth.users`, touch neither `storage` nor `cron`.
- `supabase/local/*` must **never** be applied to the hosted project (local auth schema, local password role).
- New: `supabase/hosted/10_turvio_service.sql` is the hosted counterpart of the local service role. It grants `authenticated` (switched to per request), read-only access to `auth.users(id, email)`, and the same function grants. It does not bypass RLS and contains no password. It was validated on PG 17.

### Not verified (and why)
- Status/health, backups, SSL enforcement and network restrictions: the token lacks the read permissions (list below).
- Whether the token can **write**: not probed on purpose (no write attempts).
- Connecting the TURVIO API to the hosted database from this cloud environment: the pooler hostname does not resolve here (only HTTPS via proxy). The API has to run on your machine or in hosting to talk to staging.

## 2. Missing permissions

Observed 403s with the existing token (exact permission names from Supabase's responses):

| Permission | Needed for | Required? |
|---|---|---|
| `project_admin_read` | project status, health, upgrade status | recommended (read) |
| `backups_read` | confirm a backup exists before migrating | recommended (read) |
| `database_ssl_config_read` | verify SSL enforcement | optional (read) |
| `database_network_restrictions_read` | verify network restrictions | optional (read) |
| `database_readonly_config_read` | read-only-mode status | optional |
| `api_gateway_keys_read` | API keys | **not needed** – you copy keys from the dashboard straight into the secret stores |
| `edge_functions_read`, `edge_functions_secrets_read`, branches | edge functions / branching | **not needed** (TURVIO uses neither) |

**Write access needed for the plan.** These names are inferred from Supabase's `<area>_read` naming. Confirm the exact labels in the token form, and grant them only on `turvio-staging`.

| Step | Access |
|---|---|
| Apply migrations, `turvio_service` role, `pg_cron` schedule (steps 2–4, 7) | database **write** (run SQL that is not read-only / apply migrations) |
| Auth settings (step 5) | auth config **write** |
| Private `proofs` bucket (step 6) | storage **write** (buckets) |

No organisation-wide or account permissions are needed. A 1–2-day expiry is enough for the change window.

## 3. Migration plan (nothing below has been run)

0. **Precondition.** The project is empty (0 tables, 0 users), so no existing data can be affected. With `backups_read` I would confirm the daily backup first. The Free plan has no point-in-time recovery, so the rollback in step 9 is the safety net.
1. **Dry run (done).** All migrations and integration tests pass on PG 17.11 locally.
2. **Migrations.** Apply the 9 files in filename order with the Management API's migration endpoint (`POST /v1/projects/{ref}/database/migrations`, one file per call). This records each one in `supabase_migrations.schema_migrations`, so a later `supabase db push` from your Mac sees them as applied. Each file runs in its own transaction, and I stop at the first error.
3. **Service role.** Apply `supabase/hosted/10_turvio_service.sql`. **You** set the password in the dashboard SQL editor (`alter role turvio_service password '<generated>'`), so it never passes through me or the chat. Then store `DATABASE_URL=postgres://turvio_service.xwryomkbrkwjytwofgcu:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require` in the API host's secret store. Use the **session** pooler (5432): the live updates use LISTEN/NOTIFY, which does not work on the transaction pooler (6543).
4. **Read-only verification.**
   - Every `public` table has RLS.
   - The policy count matches the local database.
   - `anon` has no table grants.
   - `turvio_service` has no `bypassrls`.
   - A tenant-isolation smoke test runs inside a transaction that is rolled back.
5. **Auth settings.**
   - `disable_signup=true` (TURVIO is invite-only).
   - Password minimum length 12, with letters and digits required.
   - `site_url` and redirect URLs set to the staging Dispatch/Admin URLs, once hosting exists.
   - Keep e-mail confirmation and TOTP MFA (already on).
   - Leaked-password protection, if the plan offers it.
   - **SMTP:** the built-in mailer (2 mails/h) is too slow for inviting 7 pilot users. It needs an EU SMTP provider, which is your decision (cost).
6. **Storage.** Create the private bucket `proofs`:
   - `public=false`;
   - 5 MB file size limit, matching the API's `MAX_PROOF_BYTES`;
   - allowed types `image/jpeg`, `image/png`, `image/svg+xml`;
   - no storage policies for `anon`/`authenticated`. Only the API reads and writes it with the service key, after its own access check.
7. **Retention.** `create extension pg_cron;` then `select cron.schedule('turvio-retention', '17 3 * * *', 'select app.purge_expired_data()');`. Alternatively, skip pg_cron and set `BACKGROUND_JOBS=true` on one API instance.
8. **Synthetic JARBOU pilot data.** Create users through the real invitation flow (Admin app → invitation e-mail), not by writing `auth.users`. The current seed writes `auth.users` directly; that is fine locally but must not be used on hosted Supabase. Synthetic tours/stops then go through the API (Dispatch import), not raw SQL. No real customer data.
9. **Rollback** (destructive, so only with your explicit go-ahead at that moment): the project is otherwise empty, so it is
   - `drop schema app cascade; drop schema geo cascade;`
   - drop the TURVIO tables in `public`;
   - `drop role turvio_service;`
   - delete the `proofs` bucket;
   - delete the rows in `supabase_migrations.schema_migrations`.

Order and time: steps 2–4 take about 10 min, 5–7 about 10 min, and 8 depends on SMTP and hosting.
