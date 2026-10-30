# Feature parity checklist – Spoke Route Planner & Spoke Dispatch

TURVIO is developed independently. This list compares against **publicly documented** Spoke capabilities only. No Spoke code, graphics or assets are used.

## How to read this

**Spoke column**
* **Documented** – the feature appears in text from an official Spoke source (spoke.com, help.spoke.com, routeplannerhelp.spoke.com, developer.dispatch.spoke.com). Research date 2026-10-30. *Caveat:* the research environment could not open those pages directly; the text was taken from search-engine results for the exact official URLs. Re-check pricing/tier details on the live pages before relying on them.
* **Unconfirmed** – mentioned somewhere, but no official documentation found, or official sources contradict each other.

**TURVIO column**
* **Done** – implemented and covered by tests in this repository.
* **Partial** – part of the feature works (scope stated in Notes).
* **Planned (M#)** – scheduled in [ROADMAP.md](ROADMAP.md) milestone #.

---

## 1. Driver app (vs. Spoke Route Planner and the Dispatch driver app)

| Feature | Spoke | TURVIO | Notes |
|---|---|---|---|
| Add stop by typing an address | Documented | **Partial** | Manual form (street, no., postcode, city, recipient, tracking numbers, time window, priority, notes) with validation. No address autocomplete/geocoding yet (M3). |
| Long-press/tap map to place a stop | Documented | **Partial** | Tap map in the add-stop form sets the stop position. |
| Extended search for partial addresses | Documented | Planned (M3) | Needs geocoding provider. |
| Voice entry / dictation | Documented | Planned (M5) | |
| Camera scan of an address label (OCR) | Documented | Planned (M4) | Recipient name, address, tracking no. + review/correct screen. |
| Barcode scanning, continuous | Documented (Dispatch driver app) | Planned (M4) | expo-camera barcode scanning. |
| Manifest / PDF / image import (OCR) | Documented | Planned (M4) | |
| Spreadsheet import (CSV/XLS/XLSX) | Documented | Planned (M3) | Shared parser used by driver app and Dispatch. |
| Paste multiple addresses | Unconfirmed | Planned (M3) | Required by TURVIO spec regardless. |
| Group parcels for the same address | – | **Done** | Normalised address matching merges parcels into the existing pending stop. |
| Edit stop after adding | Documented | Planned (M2) | |
| Multi-stop optimization | Documented | **Done** | OR-Tools service via API; offline heuristic fallback. |
| Start/end location, round trip | Documented | **Done** (engine) | Per-vehicle start/end supported by optimizer; UI to change them: M2. |
| Time windows | Documented | **Done** (engine) | Enforced by OR-Tools; entry in add-stop form. Offline heuristic ignores them (labelled). |
| Service time per stop | Documented | **Done** (engine) | Derived from parcel count; editable field: M2. |
| Priority stops | Documented (Dispatch "ASAP") | **Done** | |
| Manual reorder | Documented | **Done** | Up/down controls in the stop list. Drag-and-drop: M2. |
| Draw on map to reorder | Documented | Not planned yet | |
| "Update route" vs full re-optimize | Documented | **Partial** | Re-optimization of remaining stops keeps completed stops in place; minimal-change insert: M5. |
| Offline route access | Documented | **Done** | Tour persisted on device (AsyncStorage). Sync/conflict handling: M2. |
| Breaks | Documented | Planned (M5) | Schema has `break` stop type; solver support pending. |
| Start / pause / finish tour | – | **Done** | State machine in app and DB RPC. |
| Navigation handoff (Google/Apple Maps) | Documented (+Waze, HERE, Sygic) | **Done** | Apple Maps on iOS, Google Maps elsewhere; Waze option: M5. |
| In-app turn-by-turn navigation | Documented | Not planned | Handoff to navigation apps is the chosen approach. |
| Android Auto / CarPlay | Documented | Not planned yet | |
| Mark delivered / failed / skipped, reopen | Documented | **Done** | Notes per stop. Failure reason codes: M2. |
| Proof of delivery – photo | Documented | Planned (M2) | Private bucket path scheme + table ready. |
| Proof of delivery – signature | Documented | Planned (M2) | |
| Package finder / parcel position in van | Documented | Planned (M5) | |
| Package photo at stop creation | Documented | Planned (M5) | |
| Search by tracking no., recipient, address | – | **Done** | |
| Map with stop markers and order preview | Documented | **Done** | Order shown as straight lines, not road geometry. |
| Completed-tour statistics | Unconfirmed | **Partial** | Progress, delivered/failed/skipped counts, estimated distance/time. History view: M5. |
| Live disruption alerts | Documented | Not planned yet | |
| Languages de/en/ro/ar incl. RTL | – | **Done** (driver app) | ro/ar need native review; web apps: M6. |

## 2. Dispatch (vs. Spoke Dispatch)

| Feature | Spoke | TURVIO | Notes |
|---|---|---|---|
| Secure login, role-based access | Documented | **Partial** | Roles, RLS and API token checks done and tested; login UI: M2. |
| Multiple depots | Documented | **Partial** | Schema + list view; management UI: M3. |
| Driver management | Documented | **Partial** | Schema, list view, plan-limit enforcement; CRUD UI: M3. |
| Vehicle management (capacity) | Documented (weight) | **Partial** | Parcel-count capacity in schema + optimizer; weight: M5. |
| Create and assign tours | Documented | Planned (M3) | Read-only tour views now. |
| Import stops (spreadsheet) | Documented | Planned (M3) | |
| Barcode data import | Documented | Planned (M4) | |
| Multi-driver optimization | Documented | **Partial** | Optimizer supports many vehicles + capacity; Dispatch UI optimizes one tour (preview, not saved). |
| Optimization objective (balance workload etc.) | Documented | Planned (M5) | |
| Linked pickup → delivery | Documented | Planned (M5) | |
| Reassign stops | Documented | Planned (M3) | |
| Max stops per driver, allowed drivers per stop | Documented | Planned (M5) | |
| Live tour progress | Documented | **Partial** | Progress per tour from data; realtime updates + live driver positions: M3 (`location_pings` table + RLS ready). |
| Pickups and delivery deadlines | Documented | **Partial** | Pickup stop type + time windows in schema, optimizer and UI display. |
| Reports / analytics | Documented | Planned (M5) | |
| Export (CSV/manifests) | Documented | Planned (M5) | |
| Recipient notifications + tracking page | Documented | Planned (M6) | Needs GDPR review (recipient contact data). |
| Proof of custody (scan trail) | Documented | Planned (M4) | `stop_events` is the base. |
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
| Admin console: tenants, plans, system status | **Partial** | Read-only on synthetic data. |
