# Feature parity checklist – Spoke Route Planner & Spoke Dispatch

TURVIO is developed independently. This list compares against **publicly documented** Spoke capabilities only. No Spoke code, graphics or assets are used.

## How to read this

**Spoke column**
* **Documented** – the feature appears in text from an official Spoke source (spoke.com, help.spoke.com, routeplannerhelp.spoke.com, developer.dispatch.spoke.com). Research date 2026-10-30. *Caveat:* the research environment could not open those pages directly; the text was taken from search-engine results for the exact official URLs. Re-check pricing/tier details on the live pages before relying on them.
* **Unconfirmed** – mentioned somewhere, but no official documentation found, or official sources contradict each other.

**TURVIO column**
* **Done** – implemented and covered by tests in this repository. For the driver app, "Done" means verified by unit/integration tests and the browser build – **not on a physical device** (see the verification matrix in [DRIVER_APP.md](DRIVER_APP.md)).
* **Done (device test pending)** – implemented with native modules (camera, map, haptics, location) whose behaviour could only be verified up to the bundle/prebuild stage.
* **Partial** – part of the feature works (scope stated in Notes).
* **Planned (M#)** – scheduled in [ROADMAP.md](ROADMAP.md) milestone #.

---

## 1. Driver app (vs. Spoke Route Planner and the Dispatch driver app)

Updated 2026-11-05 (Phase 4).

| Feature | Spoke | TURVIO | Notes |
|---|---|---|---|
| Add stop by typing an address | Documented | **Done** | Form with validation; duplicate-address hint; address autocomplete when a geocoder is configured. |
| Address autocomplete / geocoding | Documented | **Partial** | Provider abstraction (self-hosted Nominatim/Photon) + API endpoint, tested with mocked providers. No provider is configured yet – addresses are then kept and marked "needs map position" (never invented coordinates). |
| Long-press/tap map to place a stop | Documented | **Done (device test pending)** | Tap/drag pin in the stop form and "set/move pin" for existing stops. |
| Extended search for partial addresses | Documented | Planned | Depends on the geocoder. |
| Voice entry / dictation | Documented | Planned (M5) | |
| Continuous barcode scanning | Documented (Dispatch driver app) | **Done (device test pending)** | Camera stays open, Code 128/39/93, EAN, UPC, ITF, Codabar, QR, Data Matrix, PDF417, Aztec; duplicate/repeat handling, counters, haptics, torch, pause, history, manual entry, offline queue; parcels marked loaded in Dispatch. Scan logic tested; camera decoding not hardware-verified. |
| Camera scan of an address label (OCR) | Documented | **Partial** | Label photo → barcode from photo → review screen with confidence per field; label-text parser tested. **No OCR engine bundled** (needs ML Kit + dev build). Photo deleted after reading. |
| Manifest / PDF / image import (OCR) | Documented | Planned (M4) | |
| Spreadsheet import (CSV/XLS/XLSX) | Documented | **Done** | CSV and .xlsx with preview, per-row errors, edit/remove, grouping. Legacy .xls refused with a message. |
| Paste multiple addresses | Unconfirmed | **Done** | One stop per line incl. tracking numbers and optional coordinates. |
| Group parcels for the same address | – | **Done** | Import, manual entry, label capture; all tracking numbers kept, duplicates reported. |
| Edit stop after adding | Documented | **Partial** | Notes, lock, map position. Editing address fields of an existing stop: planned. |
| Multi-stop optimization | Documented | **Done** | Server OR-Tools for saved routes (time windows, priorities, shift, capacity, multiple parcels); offline heuristic fallback, labelled. |
| Optimize remaining stops / from current position | Documented | **Done** | Completed stops stay; optional device position as start. |
| Start/end location, round trip | Documented | **Partial** | Start: depot/last stop or device position; end: depot or last stop. Arbitrary addresses as start/end: planned. |
| Time windows | Documented | **Done** | |
| Service time per stop | Documented | **Partial** | Used by the optimizer; not editable in the app yet. |
| Priority stops | Documented (Dispatch "ASAP") | **Done** | |
| Manual reorder | Documented | **Done** | Up/down in reorder mode; synced to the server. Drag-and-drop: planned. |
| Lock stop positions | Documented ("pin") | **Done** | Locked stops keep their slot on re-optimization (server and offline). |
| Draw on map to reorder | Documented | Not planned yet | |
| Road-network travel times | Documented | **Partial** | OSRM client ready; not hosted → straight-line estimates, always labelled. |
| Offline route access | Documented | **Done** | Persistent store + outbox with client ids; restart and interrupted-upload recovery tested. |
| Breaks | Documented | Planned (M5) | |
| Start / pause / finish tour | – | **Done** | |
| Navigation handoff (Google/Apple Maps/Waze) | Documented (+HERE, Sygic) | **Done (device test pending)** | Native schemes with https fallback when an app is missing; default app setting. |
| In-app turn-by-turn navigation | Documented | Not planned | Handoff is the chosen approach. |
| Android Auto / CarPlay | Documented | Not planned yet | |
| Arrival, delivered / failed / attempted / rescheduled / returned | Documented (subset) | **Done** | Configurable failure reasons per company; notes; reopen. |
| Proof of delivery – photo | Documented | **Done (device test pending)** | Private storage, idempotent upload, offline queue; camera capture not device-verified. |
| Proof of delivery – signature | Documented | **Done** | SVG signature pad; verified in the browser e2e incl. Dispatch viewing it. |
| Recipient name, timestamp, location with PoD | Documented | **Done** | Location only when the company enables it. |
| Package finder / parcel position in van | Documented | Planned (M5) | |
| Search by tracking no., recipient, address | – | **Done** | |
| Map with stop markers and order preview | Documented | **Done (device test pending)** | Numbered, current/next, pickups, completed; order line is straight (labelled). Web build uses a schematic. |
| Current device location on the map | Documented | **Done (device test pending)** | Only after the driver turns it on; not sent anywhere. |
| Completed-tour statistics | Unconfirmed | **Partial** | Progress, outcomes, remaining/total estimates. History view: M5. |
| Personal routes (driver-created) | Documented (Route Planner) | **Done** | Visible to the depot's dispatch. |
| Dark mode | Documented | **Done** | System/light/dark. |
| Languages de/en/ro/ar incl. RTL | – | **Done** | ro/ar need native review. |

## 2. Dispatch (vs. Spoke Dispatch)

| Feature | Spoke | TURVIO | Notes |
|---|---|---|---|
| Secure login, role-based access | Documented | **Done** (local auth) | Login, password reset, invitations, session refresh, logout, workspace switch, role/depot-scoped navigation. Supabase Auth provider implemented, not yet tested live. MFA: planned. |
| Multiple depots | Documented | **Done** | Depot switcher, depot-scoped dispatchers (RLS), depot create/edit in Fleet. |
| Driver management | Documented | **Done** | Create/edit/deactivate in Fleet; plan-limit enforced in DB; driver login via invitation. |
| Vehicle management (capacity) | Documented (weight) | **Partial** | Parcel-count capacity in schema + optimizer; weight: M5. |
| Create and assign tours | Documented | **Done** | Persistent tours with driver/vehicle, double-booking check, optimistic versioning, publish/withdraw to the driver, activity log. |
| Import stops (spreadsheet) | Documented | **Partial** | Paste list (address; lat; lng; …) and single-stop form. CSV/XLSX upload and geocoding: M3 – coordinates are required today. |
| Barcode data import | Documented | **Partial** | Driver scans mark parcels loaded and are visible in Dispatch; bulk barcode file import: planned. |
| Multi-driver optimization | Documented | **Done** | Per tour and whole depot plan (OR-Tools), saved to the DB. Travel times are straight-line estimates until OSRM is hosted (labelled). |
| Optimization objective (balance workload etc.) | Documented | Planned (M5) | |
| Linked pickup → delivery | Documented | Planned (M5) | |
| Reassign stops | Documented | **Done** | Assign unassigned stops/pickups to tours; deleting a tour returns its stops to unassigned. |
| Max stops per driver, allowed drivers per stop | Documented | Planned (M5) | |
| Live tour progress | Documented | **Partial** | Stop statuses from the driver app appear in Dispatch within seconds (SSE change feed, polling fallback). No live GPS positions – the map deliberately shows none without authorized location data. |
| Pickups and delivery deadlines | Documented | **Done** | Pickups workspace on persisted data: windows, deadlines, projected ETA, conflicts, assignment. |
| Reports / analytics | Documented | Planned (M5) | |
| Export (CSV/manifests) | Documented | Planned (M5) | |
| Recipient notifications + tracking page | Documented | Planned (M6) | Needs GDPR review (recipient contact data). |
| Proof of custody (scan trail) | Documented | **Partial** | Load scans (`parcels.loaded_at`), status history with reasons, notes and proofs in the tour activity. Per-scan audit trail: planned. |
| Proof of delivery in Dispatch | Documented | **Done** | Photos/signatures via authenticated proxy; admins can delete; retention purge. |
| REST API / webhooks | Documented | **Partial** | Internal API exists (tenant-scoped); public API + webhooks: M6. |
| Client portal | Documented | Not planned yet | |
| Data history retention by plan | Documented | **Partial** | Per-tenant retention settings + purge function (location pings, proofs). |
| Audit log | – | **Done** | Trigger-based, records who changed which columns. |

## 3. SaaS / platform (TURVIO-specific)

| Feature | TURVIO | Notes |
|---|---|---|
| Multi-tenant isolation (RLS + composite FKs + API) | **Done** | 22 DB tests + 9 API tests. |
| Plans, per-driver seats, limits, overrides, trials | **Done** (rules) | DB-enforced limits; shared rule functions tested. |
| Upgrades/downgrades with limit check | **Done** (rules) | `checkPlanChange`; no UI yet. |
| Stripe Billing | Planned (M7) | Intentionally inactive. |
| Admin console: tenants, plans, system status | **Partial** | Live tenant stats (aggregates only), activity, create company with owner invitation. Plan changes in the UI: planned. |
