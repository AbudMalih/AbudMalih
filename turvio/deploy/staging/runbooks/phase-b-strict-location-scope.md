# Runbook – Phase B: strict location scope (migration 20261117000100)

Target: **turvio-staging** (`xwryomkbrkwjytwofgcu`, eu-central-1, PostgreSQL 17). Never production.
Migration-first: the database change goes live before the application release that reads it.

| Item | Value |
|---|---|
| Migration | `supabase/migrations/20261117000100_strict_location_scope.sql` |
| DB rollback | `supabase/rollback/20261117000100_strict_location_scope.down.sql` |
| Fingerprint (read-only) | `supabase/rollback/fingerprint.sql` – counts + hashes, no personal data |
| Release now running | `9e21c2bc39877999a7544390bd3f7faa871dca39` (works with and without the migration) |
| New release | the Phase B commit named in the approval message |

Tested locally: apply + rollback round trip (PostgreSQL 16 server and 18 PGlite), catalog identical after
rollback, all rows preserved, re-apply works; before/after visibility matrix (no user sees more; owners,
admins, drivers and located dispatchers see exactly the same). See `apps/api/test/integration/rollback.test.ts`
and `packages/db/test/rollback-pgnext.test.ts`.

## 0. Pre-checks (read-only)

1. Project name `turvio-staging`, status `ACTIVE_HEALTHY`.
2. Latest `supabase_migrations.schema_migrations` version is `20261116000100`; `20261117000100` absent.
3. `select count(*) from memberships m where m.active and m.role = 'dispatcher' and not exists (select 1 from membership_depots md where md.membership_id = m.id)` → **0** (the migration refuses otherwise – then a Company Admin decides per dispatcher: assign locations or grant all locations).
4. Open driver invitations for already linked profiles → 0 (they would be refused on acceptance after the migration – intended).
5. `all_locations` columns, `invitations_guard` / `drivers_link_guard` triggers and `app.can_link_driver` absent.
6. Run `fingerprint.sql`, keep the output as the baseline.

## 1. Backups

The migration changes no rows; backups are insurance. Staging has no Supabase backups and no PITR.

### A. Offline encrypted dump (operator, on the Mac)

Scripts (tested end to end, including wrong passphrase, tampered file and failed dump):
`deploy/staging/backup/turvio-staging-backup.sh` and `deploy/staging/backup/turvio-staging-backup-verify.sh`.

- Target fixed to turvio-staging (session pooler user `postgres.xwryomkbrkwjytwofgcu`); aborts unless the
  server is PostgreSQL 17 with latest migration `20261116000100`.
- Database password and backup passphrase are typed at hidden prompts; never stored or logged.
- `pg_dump | gpg` (AES-256, SHA-512 key derivation): the dump never exists unencrypted on disk; a failed
  dump leaves no file. Output `~/turvio-backups/turvio-staging-<UTC time>.dump.gpg` (read-only) + `.sha256`.
- Verify: checksum, encryption, archive readable (table of contents), full restore of tables and rows into a
  throwaway PostgreSQL 17 container (memory only, no network, deleted afterwards; decrypted stream piped
  directly), then a per-table fingerprint (counts + hashes, no personal data) to compare with staging.

### B. In-database snapshot (Claude, with approval, just before the migration)

Same project, schema not exposed by the API, no extra copy of personal data leaves the database:

```sql
begin;
create schema if not exists turvio_backup;
revoke all on schema turvio_backup from public, anon, authenticated;
create table turvio_backup.memberships_20261117       as table public.memberships;
create table turvio_backup.membership_depots_20261117 as table public.membership_depots;
create table turvio_backup.invitations_20261117       as table public.invitations;
create table turvio_backup.drivers_20261117           as table public.drivers;
commit;
```

Verify the counts against the baseline. Drop the schema 14 days after a successful release.

## 2. Apply the migration (Claude, with approval)

One transaction, `lock_timeout 5s`, recorded in `schema_migrations`:

```
begin; set local lock_timeout = '5s';
<migration file>
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261117000100', 'strict_location_scope', ...);
commit;
```

If the pre-flight or a lock timeout aborts it, nothing is changed: fix the cause, re-run step 0.

## 3. Verify the database (read-only)

- `all_locations` on memberships and invitations; 0 rows with `all_locations = true`.
- Triggers `invitations_guard`, `drivers_link_guard`; function `app.can_link_driver`.
- `app.accept_invitation` still executable by `turvio_service` and not by `anon`/`authenticated`.
- `fingerprint.sql` identical to the baseline (except `audit_log` if people worked in the meantime).
- The running release `9e21c2b` keeps working: Dispatch login, tour list.

## 4. Deploy the application (operator, on Hetzner)

```bash
/opt/turvio/bin/deploy <40-character Phase B commit>
```

Built-in health gate: container health checks, then smoke through Caddy (API `/health`, Dispatch `/login`,
Admin `/login`). If unhealthy, the script switches back to the previous release automatically.

Then the usual smoke scripts from the release directory (`smoke-optimizer.mjs`, `smoke-cities.mjs`).

## 5. Browser checks

- Owner: Fleet → Team lists both members, scope "All locations"; all tours and HER-01 map unchanged.
- Invite dialog: dispatcher without a location cannot be sent; "All locations" option works.
- Driver app: the driver signs in and sees the published tour; tracking unchanged.

## 6. Rollback

| Situation | Action |
|---|---|
| New release unhealthy at deploy | Automatic (deploy script). The migrated database stays – `9e21c2b` works with it. |
| Problem in the new release after deploy | `/opt/turvio/bin/deploy --rollback` (back to `9e21c2b`). Database stays. |
| Problem caused by the migration itself | 1. Application rollback first (the new release needs `all_locations`). 2. Run the `.down.sql` (one transaction; it refuses where the migration is not applied and lists any all-locations grants that will be lost). 3. Verify: catalog as before, `fingerprint.sql` equal to the baseline, `20261117000100` removed from `schema_migrations`. |

The database rollback re-opens the Phase B vulnerabilities; use it only for a functional failure.
Restoring dump A is never needed for this migration (it changes no rows); it covers unrelated accidents.
