# Live GPS tracking (driver smartphones)

Status: implemented end-to-end behind a per-company switch that is **off by default**. Not
enabled for any company. Enabling it for real employees needs the owner decisions in
"Before switching it on" below.

## What it does
While a driver's tour is **in progress**, the TURVIO Driver app sends the phone's GPS position
to the TURVIO API; dispatchers of that company (and depot) see the vehicle on the dispatch map
with its tour progress, next stop and how current the position is.

## Data flow
```
phone (expo-location background task, Android foreground service / iOS background mode)
  -> offline buffer (AsyncStorage, ≤5000 fixes, client UUID per fix)
  -> POST /v1/orgs/:org/tours/:tour/locations   (batches ≤500, every 15 s + on reconnect)
  -> driver_record_locations()  (Postgres, SECURITY DEFINER: all checks below)
       -> location_pings (history, RLS)      -> driver_positions (latest, RLS)
       -> pg_notify -> SSE "position" event (only roles with tracking.view_live)
  -> dispatch: GET /v1/orgs/:org/fleet/live  (latest position + progress, depot scope)
```

## Rules enforced by the database (not only by the app)
| Rule | Where |
|---|---|
| Company switch `organizations.tracking_mode` = `off` (default) → every upload refused, buffered points deleted on the phone | `driver_record_locations`, app |
| Driver must have acknowledged the current notice version | `tracking_notice_acks`, `driver_ack_tracking_notice` |
| Only the tour's own driver can record for it | `driver_record_locations` |
| A point is stored only if recorded inside a driving period (started/resumed → paused/completed, from `tour_events`, ±30 s) – also for offline-buffered points | `driver_record_locations` |
| No future timestamps (>2 min), coordinate/accuracy/speed/heading ranges | same |
| Idempotent by client UUID (retries never duplicate) | unique index `(organization_id, client_id)` |
| Live position moves only while the tour is `in_progress`; removed when the tour completes | function + trigger |
| Dispatch sees only its company and depot scope; drivers see only their own live row, never history | RLS policies |
| Direct inserts into `location_pings` are closed | revoked privilege |
| Every read of a recorded track is written to the audit log | `GET /tours/:id/track` → `app.log_read` |
| History deleted after `organizations.location_retention_days` (default 30); stale live rows after 24 h | `app.purge_expired_data()` (pg_cron / `BACKGROUND_JOBS`) |

## Driver app
- Starts when the driver's tour becomes `in_progress`; stops on pause, finish, sign-out, or
  when the company switches tracking off. Re-checked on app start/foreground (no duplicate
  sessions; an app restart during a tour resumes; no session → the background task records
  nothing and stops itself).
- Notice sheet before anything is requested: what (position, accuracy, speed, heading, time),
  when (only during tours), who (dispatch of the company), why, retention, rights. The driver
  must confirm; a new notice version requires confirmation again.
- Permissions: "while using" first, then "Allow all the time" (Android 10+/iOS) – needed for
  the locked screen. Denied → the app says so ("Location access needed"), it never pretends.
- Visible while on: Android permanent notification ("TURVIO – live location on"), iOS blue
  location indicator, a green "Live location on" pill in the app header, status in Settings.
- Sampling every `tracking_interval_seconds` (company setting, default 10 s, 5–60); while
  parked only one fix per minute is kept (heartbeat – dispatch can tell parked from lost).

## Dispatch
- Vehicles on the existing dispatch map + "Live fleet" list. Freshness from the server clock:
  **Live** ≤ 90 s, **Delayed** ≤ 5 min, **No signal** > 5 min (grey, dashed, "last known
  position – not live"). A stale position is never shown as live.
- Vehicle panel: driver, vehicle, progress, next stop + deadline, accuracy, speed, last fix,
  focus. Recorded track per tour (`GET /tours/:id/track`, incl. gaps > 2 min).
- Positions never complete a delivery and never reorder stops (re-optimizing a tour on the road
  needs the dispatcher's confirmation, see the optimize endpoint).

## Known operating-system limits (not hidden from users)
- Android: battery savers / "Put app to sleep" (Samsung "Sleeping apps") or force-stopping the
  app can stop the foreground service. The driver then sees no notification and dispatch sees
  "Delayed/No signal". For pilot phones: exclude TURVIO from battery optimisation.
- iOS: without "Always" permission tracking stops when the app is in the background. iOS may
  defer updates in low-power mode.
- Accuracy depends on the phone (urban canyons: 10–50 m; tunnels: no fix).
- Google Play: apps using background location need a policy declaration (prominent
  disclosure + video) before publishing in the Play Store. Internal APK testing does not.

## Before switching it on (owner / legal decisions)
1. Data protection impact assessment (DPIA, Art. 35 GDPR) – systematic monitoring of employees.
2. Works-council agreement (§87(1) Nr. 6 BetrVG) where a works council exists.
3. Driver information (Art. 13 GDPR) – the in-app notice is a summary, not a replacement.
4. Retention period (default 30 days) and who in dispatch may see live positions/history.
5. The admin switch (`PATCH /v1/orgs/:org/tracking`, admin + second factor) only accepts
   `active_tours` together with `confirmPrerequisites: true`; who switched it on and when is
   stored.

## Tests
- Database (PGlite): `packages/db/test/tenant-isolation.test.ts` – off by default, notice,
  driving periods incl. offline buffer across a pause, duplicates, invalid input, other driver,
  other tenant, completion.
- API (PostgreSQL): `apps/api/test/integration/tracking.test.ts`.
- Driver app: `apps/driver/__tests__/tracking*.test.ts` – lifecycle with mocked OS APIs, buffer.
- Dispatch: `apps/dispatch/test/live.test.ts` – freshness thresholds.
- **Not yet verified on a physical device**: background recording with the screen locked,
  network loss and recovery, battery use. Requires a native build (new dependency
  `expo-task-manager`, background-location permission) and a pilot phone.
