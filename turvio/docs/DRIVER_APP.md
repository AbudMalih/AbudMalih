# TURVIO Driver (Phases 4–5)

Expo SDK 58 / React Native 0.88 / Expo Router. iOS and Android (plus a web build used only for automated tests).

> **Verification status (Phase 5).** Verified with unit/integration tests, the browser build against the real API/PostgreSQL/OR-Tools/OSRM, and a **native Android release build** (Gradle, arm64; the OCR module and ML Kit model compile and are packaged). **Not verified:** running on a physical Android or iOS device (none available), any iOS build. See [DEVICE_TESTING.md](DEVICE_TESTING.md) for installation and the device test plan.

## Screens

| Screen | Purpose |
|---|---|
| Today (`(tabs)/index`) | Two hero actions – **Scan parcels**, **Optimize route** – then the active route: progress, open stops, remaining distance/time (labelled straight-line estimates, *remaining of total*), next stop with *Continue*, start/pause/finish; quick actions *Add stop*, *Import*, *New route*; route switcher when there are several; sync pill. |
| Stops | Search (tracking no., name, address), Open/Done/All, compact cards (number, recipient, address, parcels loaded/total, time window, priority, needs-location), reorder mode with lock/unlock. |
| Map | Numbered markers (current/next highlighted, pickups square, closed stops grey/red), dashed order line from the last closed stop (labelled: order, not road geometry), next-stop card with Navigate, optional "my location". |
| Stop detail | Recipient, address, status, failure reason, Navigate, *I'm here* (arrival), *Delivered* → proof of delivery, *Picked up*, *Not delivered* → outcome, dispatcher instructions, time window, phone (only if the company allows), parcels with scan state, proofs (pending upload marked), driver note, lock position, set/move pin. |
| Scanner | Continuous camera scanning, see below. |
| Label | Label photo → barcode (+ OCR when an engine is registered) → review form with confidence per field → stop. |
| Add stop | Address search (provider) or typed address, map pin, delivery/pickup, tracking numbers, time window, phone, notes, priority; duplicate-address hint. |
| Import | Paste / CSV / Excel (.xlsx) → preview with per-row errors and edit/remove → summary (stops, parcels, rows with errors, needs-location, duplicates) → import. |
| Optimize | Start (depot/last stop or device position), end (depot or last stop), keep locked stops; result labelled with engine and travel-time source. |
| Proof of delivery | Photo, signature, *received by*, note; optional location (company setting). |
| Not delivered | Failed / Attempted / Rescheduled / Returned + configurable reason + note (required for some reasons). |
| Settings | Account & sign-out (warns about unsent changes), sync queue with rejected items (retry/discard), language (de/en/ro/ar, RTL), navigation app, light/dark/system, privacy note. |

## How it works

### Offline-first data flow

```
action on the phone ──► store (applied immediately, persisted to AsyncStorage)
                    └─► outbox item {client id, time} ──► API (in order) ──► Postgres RPC (RLS)
```

* Every change gets a **client-generated UUID**: stop status events (`clientEventId`), notes, new tours (`id`), new stops (`id`), proofs (`id`). The API/DB treat a repeated id as the same change, so a retry after an interrupted upload (request committed, response lost; app killed) never duplicates anything.
* The outbox is **drained in order**; a network/server error stops the drain (exponential backoff 2 s … 5 min) so dependent items keep their order (a new stop is created before its status is sent). Rejections (4xx) are moved to a visible **Rejected changes** list – retry or discard – never silently dropped.
* After each successful drain the app re-reads `GET /v1/me/tours` and re-applies still-queued changes on top (`applyOutbox`), so nothing disappears from the screen while waiting.
* **Ordering across devices:** each status carries `occurredAt`; an older offline update arriving after a newer one is recorded in the history but not applied (`stop_events.applied = false`, shown struck-through in Dispatch).
* Sync runs on start, every 30 s, on app foreground, on pull-to-refresh and after every change. The sync pill shows *Updated hh:mm*, *n changes waiting*, *Offline* or *rejected*.
* Proof photos wait in the app's private document directory and are deleted after the server confirmed them.

### Continuous scanning (`app/scan.tsx`, `packages/shared/src/capture/barcode.ts`)

* `expo-camera` `CameraView` with Code 128, Code 39, Code 93, EAN-13/8, UPC-A/E, ITF-14, Codabar, QR, Data Matrix, PDF417, Aztec.
* The camera stays open; `ScanSession` decides per decoded value: **matched** (parcel of this route), **unknown** (new parcel), **duplicate** (scanned before – warning), **repeat** (same code still in view < 1.5 s – ignored), **invalid**. Values are normalised (AIM prefixes, GS1 SSCC, tracking URLs in QR codes).
* Feedback: success/warning/error haptics + coloured banner; counters (scanned / on route / new); torch; pause/resume; manual entry; scan history.
* Scans are stored on the phone immediately and sent in batches every 3 s (offline queue); the server marks matching parcels as loaded (`parcels.loaded_at`) and Dispatch shows "n/m scanned in".
* Unknown parcels → *Add n new parcels as stops* → label capture for each code.
* Camera permission is requested in context with an explanation; a denied permission links to the system settings; without a camera manual entry still works.

### Parcel-label capture & OCR boundary

* Takes a photo (`expo-image-picker`), decodes barcodes from it (`expo-camera` `scanFromURLAsync`), runs the registered OCR engine if any, then `parseLabelText()` extracts recipient, street, house number, postal code, city and tracking number with a confidence per field (sender block ignored, multiple-address and missing-field warnings). The driver reviews and corrects every field. **The label photo is deleted right after reading.**
* **On-device OCR (Phase 5):** local Expo module `apps/driver/modules/turvio-ocr` – Google ML Kit text recognition (bundled Latin model, Android) and Apple Vision `VNRecognizeTextRequest` (iOS, languages de/en, no language correction so names and numbers are not "corrected"). No image leaves the phone. If little text is found, the image is analysed again at 90°/270°/180° (labels photographed sideways). Lines come back with confidence and position; `orderOcrLines()` restores reading order per text block (sender and recipient side by side).
* The parser (`packages/shared/src/capture/label.ts`) handles German specifics: `D-` prefixes, `Str.` without space, house-number ranges/letters, Packstation, `c/o` lines, OCR digit confusions in postal codes (`3O161` → `30161`, flagged "check"), several barcodes (carrier codes ranked above product EANs; ties → driver chooses), multiple addresses (recipient confidence "low"), missing fields reported instead of guessed. The recipient is never marked "certain".
* The module only exists in development/production builds; Expo Go, the web build and unit tests have no OCR (the screen says so).
* Without an engine the screen says so; the barcode is still read and the address is typed (with address search if configured).

### Stops, imports and addresses

* Manual entry, label capture, scanning, paste, CSV (`;`, `,`, tab, `|`, quotes, BOM) and Excel `.xlsx` (first sheet; legacy `.xls` is refused with a message) and dispatcher-assigned tours.
* Column detection in German/English/Romanian (street, Hausnummer, PLZ, Ort, Sendungsnummer, lat/lng, Hinweis, from/to, priority, type…). Excel's dropped leading zeros of German postal codes are restored with a warning.
* **Grouping:** rows/parcels for the same address and stop type become one stop; all tracking numbers are kept; duplicate tracking numbers are reported. On the server, sending an existing stop id with more tracking numbers adds the missing parcels.
* **Addresses:** `GET /v1/geocode/search` uses the provider configured on the API (`GEOCODER=nominatim|photon`, self-hosted; default `none`). Without a provider the address is kept as typed and the stop is marked **needs map position** – it is never given invented coordinates and is left out of optimization (reported). The driver can set or move the pin on the map (`location_source = manual_pin`), or pick a search result (`geocoder`).

### Optimization

* Saved routes are optimized on the server with OR-Tools (time windows, priorities, shift length, vehicle capacity, multiple parcels per stop as demand). Options: start at the device position (only if the driver chooses it), end at depot or last stop, keep locked stops (they keep their slot; the other open stops are optimized around them).
* Offline (or demo mode): on-device nearest-neighbour + 2-opt; the result says that time windows, shift and capacity were not considered.
* Travel times are **straight-line estimates** unless `OSRM_URL` is configured on the optimizer; every figure is labelled. Dispatch and the driver app use the same `routeMetrics()` (total vs remaining) – this fixed the earlier 36.9 km / 34.6 km mismatch (the app had summed only open stops from the depot).

### Navigation

Google Maps (`google.navigation:` / `comgooglemaps://`), Apple Maps (iOS, `maps://`), Waze (`waze://`); each with an https fallback that opens when the app is not installed. The driver can choose a default app. Coordinates are used when known, otherwise the address text.

### Delivery execution & proof of delivery

* Statuses: pending → in progress (arrived) → delivered / picked up / failed / attempted / rescheduled / returned (/ skipped); closed stops can be reopened. Not-delivered outcomes require a reason from the company's list (`organizations.driver_settings.failureReasons`, defaults provided; reasons can require a note).
* Proof: photo (downscaled to 1280 px, re-encoded JPEG – EXIF removed), signature (SVG paths drawn with `react-native-svg`), recipient name, note, timestamp, and the device position **only if the company enabled `podLocation`**. Uploads are idempotent; files are private (see SECURITY_PRIVACY.md).
* Dispatch receives starts, outcomes, reasons, notes, scans and proofs through the existing change feed; it shows proofs through the authenticated proxy and admins can delete them (file removal via the deletion queue).

### Design

Design tokens from `@turvio/shared` with a light and a dark palette (`src/theme.ts`), large touch targets (≥ 48 px, primary 56–60 px, hero 84 px), official TURVIO lockup (light/dark raster assets), bottom tab bar with active pill, short transitions (≤ 220 ms), haptic and visual completion feedback. All texts in de/en/ro/ar; Arabic switches to RTL (native: after an app restart; web: immediately). Romanian and Arabic texts are machine-assisted drafts and need native review.

## Verification matrix

| Feature | Automated (unit/integration) | Browser e2e (web build, real API + DB) | Native bundle / prebuild | Real device |
|---|---|---|---|---|
| Sign-in, sync, offline queue, restart recovery, interrupted upload | ✓ | ✓ (offline via browser offline mode) | ✓ | **not tested** |
| Continuous scan logic (duplicates, repeats, counters, history) | ✓ | ✓ (manual entry – no camera in the test browser) | ✓ | **camera decoding, torch, haptics not tested** |
| Label photo → barcode → review | parser + form ✓ (synthetic labels) | – | ✓ Android build | **not tested** |
| OCR text recognition | parser ✓; native module mock-free path untested | – | Android: compiled + model packaged; iOS: not compiled | **not tested** |
| Paste / CSV / XLSX import, grouping | ✓ | ✓ (paste) | ✓ | file picker **not tested** |
| Address search | ✓ PostgreSQL geocoder with synthetic OSM fixture; batch for imports | ✓ (synthetic addresses) | ✓ | **not tested** |
| Optimization (server, options, locks) | ✓ | ✓ (real OR-Tools; OSRM on a synthetic grid in the pilot run) | ✓ | **not tested** |
| Map (clustering for 50–250 stops, road line) | clustering ✓ (Node timing only) | schematic web stand-in | ✓ Android build | **react-native-maps performance not measured** |
| Navigation hand-off | ✓ (URL building, fallback) | – | ✓ | **not tested** |
| Statuses, reasons, notes | ✓ | ✓ | ✓ | **not tested** |
| Proof of delivery | ✓ (upload, idempotency, access control) | ✓ (signature; Dispatch views it) | ✓ | **photo capture not tested** |
| Dark mode, RTL | – | ✓ (screenshots) | ✓ | **not tested** |

Build checks run: `expo export --platform android` and `--platform ios` (Hermes bytecode bundles), `expo export --platform web`, `expo prebuild --clean` (Android manifest: camera, fine/coarse location, background location and microphone removed; iOS Info.plist: camera and when-in-use location only, LSApplicationQueriesSchemes for Google Maps/Waze). Not run: Gradle/Xcode compilation, store builds, on-device tests.

## Phase 5 additions
* Route editing: edit address (old position dropped unless a new pin is set – enforced in the database), merge stops (all parcels kept), remove stops from personal routes, drag-and-drop reorder with fixed-height rows, lock positions.
* Scanner: parcel-label barcode profile (faster), autofocus, camera off in background, auto-pause after 60 s idle, throughput statistics in the scan history (for the hardware matrix).
* Road routing: cached OSRM route per stop order (valid only while the order matches), solid road line on the map, road-network figures labelled.

## Next steps for the driver app

1. EAS development builds for Android and iOS and a device test plan (scanning speed with real labels, torch, haptics, map performance with 150+ stops, offline in a dead zone, battery).
2. OCR engine (ML Kit) in the dev build + label test set.
3. Hosted geocoder (self-hosted Photon/Nominatim, Germany extract) and OSRM for road travel times and route geometry.
4. Native review of Romanian and Arabic texts; accessibility audit (TalkBack/VoiceOver).
