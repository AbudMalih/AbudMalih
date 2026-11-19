# Phase H – security fix and staging readiness (2026-11-19)

Scope: everything built in Phases B–G plus the Phase H security upgrade, for the next staging release.
Nothing was deployed, no migration was applied to staging, no APK was built, production untouched.
Deployment steps: `deploy/staging/runbooks/release-phase-b-h.md`.

## 1. Security fix

| Package | Before | After | Advisories fixed |
|---|---|---|---|
| next (Dispatch, Admin, web-session) | 16.4.3 | 16.4.6 | GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8 (moderate: `use cache` information disclosure across root params) |
| nodemailer (API) | 9.1.1 | 10.6.0 | 2 high (GHSA-v53p-9fqp-m79j, GHSA-prgh-xp8r-p3m5), 11 moderate (address parser, DKIM/SMTP parsing, DNS cache) |

- Lockfile: only these two packages changed; Driver dependencies untouched.
- Next.js no longer stops production builds with its security notice.
- nodemailer: one type import adjusted (`Transporter`); `createTransport(url)` / `sendMail` unchanged;
  verified by sending through `SmtpMailer` to a local SMTP sink (envelope and headers correct).
- `pnpm audit` after: 0 critical, 1 high, 7 moderate, 1 low – **all in Driver build/test tooling**
  (`expo > @expo/cli` → zod 3.25.76, node-forge 1.4.2; `jest` → glob, minimatch). None ships in the
  APK or runs on a server. Left unchanged (Driver app frozen); update with the next Driver build.

## 2. Database migrations

Staging is at `20261118000100` (per the last release record; re-checked as pre-check 0.2 – the
Supabase Management API token in this session was rejected, so it could not be read live here).
Pending, in order: `20261119000100` (enum values, own transaction), `20261119000200` (tour lifecycle),
`20261119000300` (settings / preferences). Phases C–H added no migrations.

- Additive only: nullable columns (one `boolean not null default false`, metadata-only), new tables
  `tour_deletions` / `user_preferences` with RLS, new functions/trigger, constraints re-created as
  supersets, two partial unique indexes re-created with a *looser* rule (cannot reject existing rows).
  All row updates are inside function bodies – the migrations change no existing row.
- Rollback scripts are guarded (explicit confirmation; lifecycle rollback refuses while cancelled
  tours/stops exist). Enum values cannot be dropped (harmless when unused).
- **Rehearsal PASSED** (`deploy/staging/test/release-rehearsal-lifecycle.sh`, local PostgreSQL 16,
  stand-in written by the deployed release f4f4c1e: 4 tours, 28 stops, 25 parcels): pre-checks,
  encrypted backup, apply in three transactions with lock_timeout, hosted grants, fingerprint unchanged,
  new columns empty, RLS, search_path, no anon grants, lifecycle in use (cancel, archive, guard blocks
  editing an archived tour), post-migration backup, rollback refusals, rollback keeps every row,
  schema back at 20261118000100, pre-migration backup restored = baseline. Staging runs PostgreSQL 17:
  the PG17 backup/verify scripts run on the owner's machine (rehearsed on 17 for the P0-3 release;
  Docker images could not be pulled here – Docker Hub rate limit).

## 3. Compatibility

- **Deployed API on the new schema** (window between migration and app switch): its own test suite
  passes against the migrated schema (250/250 runnable; 1 test needs a road-routing server and fails
  identically on the old schema).
- **New API, Dispatch, Admin** together: all suites pass (below).
- **Installed Driver APK 0.2.0** (commit 86b06e9): all 20 endpoints it calls exist unchanged; it does
  not strict-parse responses (extra fields harmless); contract tests: the feed never carries
  `cancelled`, the normal flow (start, scan, deliver with proof, complete) and idempotent offline
  replays are unchanged; offline deliveries from before a Dispatch close are applied.

## 4. Security review

- Database: RLS enabled on all 27 public tables; no policy for anon/public; every SECURITY DEFINER
  function pins `search_path`; anon has no USAGE on schema `app` (the 13 default-executable helper
  functions are unreachable for it).
- Tested by the suites: cross-company and cross-location isolation for every lifecycle action, team,
  drivers, live events; MFA (aal2) for company/platform administration (`REQUIRE_ADMIN_MFA=true` on
  staging); per-user rate limits; tracking only after the driver's acknowledgement, pilot mode limited
  to named drivers, nothing recorded while tracking is off; session proxy forwards every method used.
- Staging config: `NODE_ENV=production`, CORS limited to the Dispatch/Admin hosts, HSTS, nosniff,
  referrer policy, `X-Frame-Options: DENY`, permissions policy, `poweredByHeader: false`.
- No new environment variables (only test-only perf switches).

**Findings (not blocking staging):**
1. Medium – no Content-Security-Policy on Dispatch/Admin. Recommended before production; needs a
   nonce or hash for the inline theme script.
2. Low – `app.failure_reason_allowed(org, code)` is callable by any signed-in user for any company and
   reveals whether a failure-reason code exists there (yes/no). Not reachable for anonymous users and
   the `app` schema is not exposed through the Supabase REST API; add a membership check in a later
   migration.
3. Low – Driver tooling advisories (see §1), to update with the next Driver build.

## 5. Tests, type checks, builds (all exit 0)

| Check | Result |
|---|---|
| API (with PostgreSQL) | 292 passed, 18 skipped (road-routing/geocoder servers) |
| Dispatch | 176 passed |
| Admin | 23 passed |
| Shared | 192 passed |
| Driver | 152 passed |
| Type checks | API, Dispatch, Admin, Driver, shared, web-ui, web-session clean |
| Production builds | API, Dispatch, Admin (Next.js 16.4.6, first attempt, no security stop), Driver web export |
| Standalone (Docker build step) | Dispatch and Admin standalone servers start; `/login` 200, charcoal design, fonts served, G styles present |
| Browser | all Dispatch screens EN/DE/AR (lang, RTL, no overflow, no errors), saved language in a fresh browser; all Admin screens dark/light; design unchanged vs. approved screenshots |
