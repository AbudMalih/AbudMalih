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
- All 11 files in `supabase/migrations/` were applied to a fresh **PostgreSQL 17.11** (same version as the project; Supabase role stubs from `supabase/local/00_supabase_stubs.sql`): no errors, all 19 `public` tables have RLS on.
- The 46 API integration tests (RLS, tenant isolation via the API, driver RPCs, proofs, editing, geocoder, routing) **pass on PostgreSQL 17.11**.
- The migrations use only `auth.uid()` and read `auth.users` (foreign keys, e-mail for the team list). They need no extension beyond what is installed, create no triggers on `auth.users`, touch neither `storage` nor `cron`.
- `supabase/local/*` must **never** be applied to the hosted project (local auth schema, local password role).
- New: `supabase/hosted/10_turvio_service.sql` is the hosted counterpart of the local service role. It grants `authenticated` (switched to per request), read-only access to `auth.users(id, email)`, and the same function grants. It does not bypass RLS and contains no password. It was validated on PG 17.

### Not verified (and why)
- Status/health, backups, SSL enforcement and network restrictions: the token lacks the read permissions (list below).
- Whether the token can **write**: not probed on purpose (no write attempts).
- Connecting the TURVIO API to the hosted database from this cloud environment: the pooler hostname does not resolve here (only HTTPS via proxy). The API has to run on your machine or in hosting to talk to staging.

## 2. Token: what it can do, what it needs

**The existing token** can read only. Even when asked for a non-read-only query, Supabase runs it as `supabase_read_only_user` inside a read-only transaction (checked with a plain `SELECT`, 2026-11-06). It can:
- read the auth config, the PostgREST config, storage buckets and config, and the pooler config;
- list migrations;
- run read-only SQL.

It **cannot** apply migrations, create roles or buckets, or change any setting.

**Required for the deployment.** These use the token form's resource names and access levels ([Supabase access tokens](https://supabase.com/docs/guides/platform/access-tokens)). Grant them on the `turvio-staging` project only, with a 1–2 day expiry:

| Resource | Level | Used for |
|---|---|---|
| Database | Read-write | steps 1–4, 6, 8: migrations, service role, bucket (SQL), verification |
| Auth Config | Read-write | step 5: invite-only, 12-character passwords |
| Data API / PostgREST config | Read-write | step 7: stop exposing `public` over REST/GraphQL |

Recommended reads: Project admin (status/health), Backups. **Not needed:**
- organisation or account access;
- API keys (you copy them from the dashboard into the secret stores yourself);
- Storage Read-write (the bucket is created with SQL);
- edge functions, branches, network/SSL write.

## 3. Final review of the files to run

| # | File | SHA-256 (first 16) | Effect |
|---|---|---|---|
| 1 | 20261030000100_tenancy_core.sql | 2319190b8f669c29 | schema `app`, 14 tables with RLS, policies, helper functions, retention function |
| 2 | 20261030000200_billing.sql | 728b3e5965b30292 | plans, subscriptions (RLS) |
| 3 | 20261105000100_depot_scope.sql | 5cb03f36d4ca7f41 | depot-scoped memberships; replaces 10 policies from file 1 |
| 4 | 20261106000100_dispatch_persistence.sql | d9b13196c3ec0962 | tour events, invitations, live-update triggers (NOTIFY) |
| 5 | 20261107000100_stop_status_values.sql | a77d89cfc63d5da3 | adds enum values |
| 6 | 20261107000200_driver_execution.sql | c084b6d5a7074f30 | driver RPCs, proofs metadata, `app.storage_deletions`; replaces 1 function and 1 policy from earlier files |
| 7 | 20261108000100_geocoder.sql | 9d359d12563794b5 | schema `geo`, `geo.addresses` (no access for anon/authenticated) |
| 8 | 20261108000200_route_editing.sql | 59fa958a883159c3 | stop edit/delete/merge RPCs |
| 9 | 20261108000300_access_audit.sql | 28c2a1c3e45d21b0 | `app.log_read` (not callable by clients) |
| 10 | 20261109000100_geocoder_spelling.sql | 2f3cc00885a9855c | new normaliser; rebuilds an index on the (empty) address table |
| 11 | **20261110000100_privilege_hardening.sql** | 84f28b038ca552e5 | **new since the report:** removes TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on public tables from anon and authenticated |

Then the hosted-only files (never run locally):
- `supabase/hosted/10_turvio_service.sql`: API login role, no RLS bypass, no password.
- `supabase/hosted/20_proofs_bucket.sql`: private `proofs` bucket, 5 MB, JPEG/PNG/SVG, no client policies.
- `supabase/hosted/90_verify.sql`: verification. It always rolls back.

**Destructive statements: none against existing data.** The project has 0 tables and 0 users. All `drop` statements replace objects created earlier in the same set (policies, one function, one constraint, one index). Every `delete` either sits inside a runtime function or targets the empty address table (file 10). There is no `drop table`, no `truncate`, no change to `auth`, `storage` or Supabase roles, and nothing grants `anon` access.

**Why file 11 is new.** This project's real default privileges (`pg_default_acl`) give anon and authenticated TRUNCATE, REFERENCES, TRIGGER and MAINTAIN on every new table, and TRUNCATE ignores RLS. The local stubs now emulate these defaults:
- Without file 11, `authenticated` could truncate all 19 tables.
- With it, none.

## 4. Execution plan (awaiting approval; nothing has been run)

0. **Gate.** Check that the project is still empty: 0 tables in `public` and 0 migrations recorded. If not, stop.
1. **Migrations.** Apply files 1–11 in order through `POST /v1/projects/{ref}/database/migrations`, one call per file, so each one is recorded in Supabase's migration history.
   - After file 1, check that the tables are owned by `postgres`; if not, stop.
   - Stop at the first error. Each file runs in its own transaction.
2. **Service role.** Run `hosted/10_turvio_service.sql`.
   - **You** then set the password in the dashboard SQL editor: `alter role turvio_service password '<generated>'`.
   - Store the connection string only in the API host's secret store: session pooler, port 5432, user `turvio_service.xwryomkbrkwjytwofgcu`.
3. **Bucket.** Run `hosted/20_proofs_bucket.sql`.
4. **Retention job.** `create extension if not exists pg_cron;` then `select cron.schedule('turvio-retention', '17 3 * * *', 'select app.purge_expired_data()');`
5. **Auth.** `PATCH /config/auth` with exactly `supabase/hosted/auth-config.staging.json`:
   - sets `disable_signup=true` and `password_min_length=12` (letters and digits required);
   - restates the existing protections unchanged: e-mail confirmation on, TOTP on, anonymous sign-in off, refresh-token rotation on.

   Not changed yet: site URL and redirect URLs (no staging host exists), and SMTP (your decision, it costs money). Invitations keep working with sign-up off, because TURVIO creates accounts through the admin API. TURVIO's own policy is raised to 12 characters as well.
6. **Verify.** Run `hosted/90_verify.sql`; it rolls back. It covers:
   - driver sees own tour only;
   - depot-scoped dispatcher;
   - cross-tenant reads and writes;
   - user without membership;
   - anon has no access;
   - no TRUNCATE;
   - RLS on every table;
   - ownership;
   - `turvio_service`;
   - private bucket with no client policies.

   Locally on PG 17: 12/12 with file 11, and 10/12 without it.
7. **Data API.** Restrict the exposed schemas so `public` is no longer served over Supabase's REST/GraphQL. TURVIO never uses them (checked: no client calls `/rest/v1` or `/graphql/v1`). This removes a path that would bypass the TURVIO API's MFA enforcement and rate limits. Then re-read the config.
8. **Auth tests against hosted GoTrue** (sign-up refused, short password refused, invite → login → TOTP). These need two things this environment doesn't have yet:
   - the host `xwryomkbrkwjytwofgcu.supabase.co` added to the network allowlist;
   - the project's publishable (anon) key, saved as a secret through the secure form and never in chat.

   I'll ask for both at that step.

**Rollback** (only with your explicit go-ahead at that moment): drop schemas `app` and `geo` with cascade, drop the TURVIO tables and types in `public`, drop role `turvio_service`, delete the `proofs` bucket, unschedule the cron job, delete the migration-history rows, and restore the auth JSON values read in the audit.
