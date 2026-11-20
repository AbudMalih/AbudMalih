# Phase II – live GPS tracking and Dispatch map: audit (2026-11-20, for future reference)

Status: **not scheduled.** TURVIO NEXT is frozen after the operational-pilot stabilization; this
document records the audit of the existing tracking stack and the milestone plan that was proposed
but not started. Staging baseline at the time: release `c9de80951877d2d22ce2a7c825e126cd6bd6793a`.

Tests run during the audit: Dispatch live/map/i18n 16/16, Driver tracking 24/24, API tracking
integration 12/12.

## Existing implementation (works today)

| Area | What exists (file:line) |
|---|---|
| Database | Company modes off / pilot (named drivers) / active_tours, interval 5–60 s (`20261112000100_live_tracking.sql:16-21`, `20261113000100_tracking_pilot.sql:7-20`); per-version notice acknowledgement (`tracking_notice_acks`); `driver_record_locations` (current: `20261119000200_tour_lifecycle.sql:194+`) – batch 1–500, own tour only, tracking enabled + current notice acknowledged, range checks, future > 2 min refused, only inside a driving period from tour_events ±30 s, idempotent client_id, latest position never moves back in time; live position cleared on completed/cancelled (`tour_lifecycle.sql:181-190`); retention: pings after `location_retention_days` (default 30), live rows after 24 h, hourly in the API (`server.ts:87-92`); RLS depot-scoped reads, no direct inserts. |
| API | `GET /tracking/config`, `POST /tracking/notice`, `POST /tours/:id/locations`, `GET /fleet/live` (runs as the user → RLS company/depot scope), `GET /tours/:id/track` (audited), `GET /tours/:id/eta` (OSRM), `PATCH /tracking` (admin + aal2 + prerequisites), `GET /tracking/drivers` (status/reason per driver); SSE `position` events filtered by depot, 25 s heartbeat (`routes/tracking.ts`, `routes/settings.ts`, `routes/events.ts`). |
| Driver app | expo-location background task, High accuracy, company interval, Android foreground service, iOS background indicator (`lib/tracking.ts:229-240`); parked fixes thinned (1/min or 15 m); upload ≤ every 15 s; offline buffer 5000 fixes (AsyncStorage) with batches of 200; stops on pause/finish/sign-out/tracking off/notice missing; onboarding incl. Android 13 notifications (`trackingOnboarding.ts`). |
| Dispatch | `useLiveFleet` (SSE + 15 s polling + server clock offset, `lib/live.ts`); live ≤ 90 s / delayed ≤ 5 min / offline; panel with driver, vehicle, progress, accuracy, speed, last fix, next stop, ETA (`LiveFleet.tsx`); markers with heading and accuracy circle (`RouteMap.tsx:300-346`); tracking status panel in Settings; EN/DE/AR. |

## Findings

Confirmed defects (non-critical):
1. Live markers ignore the depot/date selector (`MapWorkspace.tsx:157`) – they show all drivers the user is *allowed* to see (RLS-scoped), not only the selected depot.
2. Live layer rebuilt on every 5 s tick and update – no marker reuse or smoothing.
3. A paused tour's last position ages into "No signal" on the map (the panel says "paused").
4. Freshness thresholds differ: Dispatch 90 s / 5 min vs. API max(120 s, 3 × interval); freshness uses the device's `recordedAt` (a slow phone clock shows "delayed").
5. Marker colours are fixed hex (not light/dark aware); `useLiveEta` is unused; `docs/LIVE_TRACKING.md` partly out of date (pilot mode, `/tracking/drivers`, purge runs in the API, not pg_cron).

Potential risks:
- Accuracy up to 10 km accepted as the latest position; no jump/jitter filter.
- Every position event makes every open Dispatch tab refetch the whole fleet; one SSE connection per tab, no cap.
- Phone clock skew can push fixes outside the ±30 s driving window (refused → gaps in history).
- iOS: continuous wake-ups (battery); tracking stops after force-quit; no restart after reboot until the app is opened.
- Offline buffer is one JSON blob rewritten per append (~1 MB at the 5000 cap, Android row limit ~2 MB).
- Untested on real devices (OEM battery killers, Doze).

Privacy / compliance gaps:
- No in-app withdrawal of the acknowledgement (admins can remove a driver from pilot tracking).
- Notice text is fixed; it does not name the controller or legal basis.
- Open per `docs/LIVE_TRACKING.md`: DPIA, works-council agreement, Art. 13 information, Play background-location declaration.

## Proposed milestones (not started)

- **M1** Dispatch live map: depot/date filter, marker reuse + smooth movement, one status model from the API, server-received freshness, theme-aware markers.
- **M2** Spoke-like panel: per-driver status/reason, GPS trail from `/track`, follow-driver, fit-all, driver search.
- **M3** Server efficiency and quality (one additive migration): delta SSE events, shared connection across tabs + cap, accuracy/jump filter for the live position, clear on pause, notify only on change, load test 50 drivers × 20 tabs.
- **M4** Driver battery and reliability: adaptive sampling, client accuracy filter, append-only buffer, resume after reboot, battery-optimisation guidance, device measurements.
- **M5** Privacy: in-app withdrawal, per-company notice (controller, legal basis) in DE/EN/RO/AR, docs, DPIA inputs, Play declaration.
- **M6** Staged rollout with approval per milestone, pilot mode, two-phone field tests.
