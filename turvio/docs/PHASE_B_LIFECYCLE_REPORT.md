# Phase B – Tour lifecycle, Analytics, Settings: database and API

Status: implemented and tested locally (PostgreSQL with all migrations). **Not applied to staging,
not deployed.** No Dispatch frontend deployed, no APK built. Production untouched.

## Migrations (additive)

| File | Content | Rollback |
|---|---|---|
| `20261119000100_tour_lifecycle_enums.sql` | `tour_status` + `cancelled`, `stop_status` + `cancelled` (own file: a new enum value cannot be used in the transaction that adds it) | none – Postgres cannot drop enum values; unused values are harmless |
| `20261119000200_tour_lifecycle.sql` | tour close/archive columns, stop cancel/return columns, `tour_deletions` log, lifecycle guard trigger, new tour-event kinds, closed-tour guards in every driver write, `close_tour`, `cancel_stop`, `tour_delete_eligibility`, `delete_tour`, `delete_draft_stop`, unique "one open tour per driver/vehicle/day" now ignores cancelled/archived tours | `supabase/rollback/20261119000200_tour_lifecycle.down.sql` (needs `turvio.confirm_drop_tour_lifecycle = 'yes'`; refuses while cancelled tours/stops exist) |
| `20261119000300_settings_preferences.sql` | `user_preferences` (own row only, RLS), company contact fields, reporting index | `supabase/rollback/20261119000300_settings_preferences.down.sql` (needs `turvio.confirm_drop_settings = 'yes'`) |

No existing row is rewritten (tested: data fingerprint identical before/after on a seeded database
with real activity). `supabase/rollback/fingerprint.sql` now ignores the new columns, so the staging
runbook comparison keeps working.

### Rules enforced by the database
- **Archive is a marker, not a status.** Restore only clears it → a completed/cancelled tour can never be reactivated by restore. Archived tours are read-only. Only completed, cancelled, or planned-and-unpublished tours can be archived.
- **Closed tours never reopen** (completed/cancelled → anything else is refused).
- **Withdraw / Finish / Cancel are separate:** withdraw = existing unpublish (not started only); finish = `completed` (started tours only); cancel = `cancelled`. Dispatch closes record actor, time, reason (3–500 chars) and `closed_remotely`.
- **Open stops on finish/cancel:** back to the location's unassigned pool by default (`returned_from_tour_id` kept), or cancelled with the reason. Delivered/failed stops, proofs, scans, events and GPS history are never touched.
- **Closed-tour guard:** stop status, proofs, scans, edits, sequence, end changes are refused (`409 tour_closed`) when they happened after the close (+30 s clock grace). **Offline events from before the close are applied** (decision 4) – including stops already returned to the pool, which go back onto their tour.
- **Cancelled stop:** a real outcome recorded before the cancel wins over it; later reports are refused (`409 stop_cancelled`). Drivers cannot set `cancelled`.
- **GPS:** a cancel now closes the driving period (pings after it are rejected, before it accepted); the live position is removed on cancel as on completion. Acknowledgement rules unchanged.
- **Permanent delete** is decided from history, never from status: only planned, unpublished, never-started tours whose stops have no outcome, events, proofs, scans, tracking, and no returned stops. Cancelled or archived does not make a tour eligible. Each delete is recorded in `tour_deletions` (name, date, driver, stop count, who, when). Stops return to the pool unless the caller asks to delete them (they are unprocessed by definition).
- **Draft stop delete** (`DELETE /stops/:id`) is now limited to stops without any history; others must be cancelled.

## API

New (all scoped by company + location via RLS; role checks per permission):

| Endpoint | Permission |
|---|---|
| `GET /v1/orgs/:org/tours` – filters: `date` / `from`+`to` (≤ 366 days) / `month`, `driverId`, `depotId`, `status`, `archived=exclude\|only\|all` (default exclude), `published`, `empty`, `q`; paging; `ids=1` = all matching ids (≤ 1000) | tours.view_all |
| `GET /tours/calendar?month=` – per-day counts (tours, archived, cancelled, completed, active, empty) | tours.view_all |
| `GET /tours/export?…&format=csv\|xlsx` – filtered list (e.g. Archived view), audited | reports.export |
| `POST /tours/:id/close` `{status: completed\|cancelled, expectedVersion, reason, openStops: return\|cancel}` | tours.close |
| `POST /tours/:id/archive`, `POST /tours/:id/restore` `{expectedVersion}` | tours.archive |
| `GET /tours/:id/delete-eligibility` – name, date, driver, stops, completed deliveries, protected records, reasons | tours.view_all |
| `DELETE /tours/:id?expectedVersion&deleteStops` (now via `delete_tour`) | tours.delete |
| `POST /tours/:id/duplicate` `{date, name?, driverId?, vehicleId?, includeStops}` – stops copied as new open stops, no parcels/history | tours.manage |
| `POST /stops/:id/cancel` `{reason}` | stops.manage |
| `POST /tours/bulk/preview` and `POST /tours/bulk` – actions archive, restore, delete, finish, cancel, withdraw; selection by ids or by filter (day, range, …); preview: selected / eligible / protected / unchanged / affected stops / completed deliveries; execution: per-tour result, one savepoint per tour, optional per-tour versions | action's permission |
| `GET /analytics/summary`, `/analytics/drivers`, `/analytics/depots`, `/analytics/tours` | reports.view |
| `GET /analytics/export?view=drivers\|depots\|tours\|trend&format=csv\|xlsx`, audited | reports.export |
| `GET /v1/me/preferences`, `PUT /v1/me/preferences` | any signed-in user, own row |
| `GET /settings` (overview + what the caller may edit), `PATCH /settings/company` | settings.view_company / org.settings.manage (+ 2nd factor) |
| `GET /tracking/drivers` – per-driver state, never coordinates | tracking.view_live |
| `POST /tracking/pilots` `{driverIds, enabled, confirmPilotConsent}` (pilot cap 20, as before) | org.settings.manage (+ 2nd factor) |

Changed: `PATCH /tours/:id` also moves date and location (not-started tours only, location must be
accessible); closed/archived tours refuse edits, new stops, optimization (`409 tour_closed` /
`tour_archived`). `GET /dispatch` hides cancelled/archived tours and cancelled stops unless
`lifecycle=1` (the deployed Dispatch keeps working unchanged).

New permissions: `tours.close`, `tours.archive`, `tours.delete`, `settings.view_company`
(dispatchers and admins). Tracking administration stays company-admin only (`org.settings.manage`).
No new role: location managers are depot-scoped admins/dispatchers (decision 2).

### Analytics definitions (returned with every response)
Scope = tours dated in the period (company calendar day), archived included, accessible locations.
Success rate = (delivered + picked up) ÷ processed (open and cancelled excluded). Completion rate =
completed ÷ started tours. On-time start = started ≤ planned start + 15 min. Average tour minutes /
active hours include pauses. **"Average interval between recorded outcomes"** is explicitly not a
service time (not recorded). Planned distance/minutes only from a road-network single-tour
optimization made before the start; coverage reported; actual driven distance not shown.

### Live tracking states
`disabled` → `pilot_not_enabled` → `no_app_login` → `awaiting_acknowledgement` → `no_active_tour`
→ `tour_paused` → `no_recent_position` (missing or older than max(120 s, 3 × interval)) → `live`.
Permission state: `unknown` (the installed app does not report it; Phase E).

## Installed Android app (compatibility)
- Feed (`/v1/me/tours`) and route never contain `cancelled` tours/stops or archived tours; tested that every status in the feed is one the installed app parses.
- A cancelled/archived tour disappears from the driver's list at the next sync; the app stops tracking (no tour in progress).
- A tour finished by Dispatch arrives as `completed` (known status). The app's own later "complete" is a no-op (200).
- Actions the installed app sends after a close are refused with `409` → shown in the app's failed list (permanent, not retried, not silently dropped). Actions from before the close (it sends `occurredAt` / `capturedAt`) are applied.
- Scan responses are byte-identical unless a scan was refused (then an extra `rejected` key).
- Normal flow (start, scan, deliver, proof, complete, retries) covered by a regression test.

## Tests
- `test/integration/lifecycle.test.ts` (21): APK contract, finish/cancel, GPS before/after close, offline events, closed-tour guards, archive keeps all evidence (counts + outcomes compared), restore never reactivates, delete eligibility and protection, bulk preview/execution counts, stale versions, company/location/role isolation, duplicate, reschedule, filters, calendar, export audit.
- `test/integration/analytics.test.ts` (6): every KPI against a hand-computed fixture, location isolation, roles, CSV/XLSX equality, export audit.
- `test/integration/settings.test.ts` (7 + rule unit test): preferences isolation, admin-only edits + audit, tracking states end to end, stale positions never live, new notice version requires new acknowledgement, scope.
- `test/integration/lifecycle-rollback.test.ts` (5): staging-style apply changes no row; rollbacks refuse without confirmation and while cancelled data exists; catalog restored exactly; re-apply works.
- `test/integration/lifecycle-perf.test.ts` (opt-in `TURVIO_PERF=1`): 60 drivers × 30 days × 90 stops (162,000 stops, 1,800 tours) as a location dispatcher with RLS: analytics summary 30 days 2.2 s, driver table 1.6 s, tours export 1.7 s, month list 1.3 s, all ids 2.0 s, bulk preview 500 → 1.3 s, bulk archive 500 → 3.3 s, close 100-stop tour 0.7 s.
- Shared (`tabular.test.ts`): CSV quoting / formula neutralisation, XLSX round trip.

## Applying to staging (needs your action)
This session has no staging database credentials. After approval, per `docs/STAGING_MIGRATION_PLAN.md`:
1. Backup / fingerprint (`supabase/rollback/fingerprint.sql`).
2. Apply `20261119000100`, `…0200`, `…0300` in order (`supabase db push`, one transaction per file).
3. Fingerprint again – must be identical.
4. Deploy the API build of this branch to staging (Dispatch frontend unchanged).

## Remaining risks
- Enum values cannot be rolled back (harmless when unused).
- RLS evaluates the location check per tour row; analytics over very large ranges (> 1 year, many locations) will be slower than measured. A set-based location policy would remove this cost – not changed here (core security policy).
- Archive of planned unpublished tours keeps their stops on the tour (not in the pool) – restore brings them back as they were.
- Permission state of the phone is only known after the Phase E app; until then shown as `unknown`.
- Dispatch still English-only until Phase F; the API returns stable codes, labels are the UI's job.
