# TURVIO – GDPR / DSGVO operational checklist

**This is a working checklist, not legal advice and not a compliance claim.** Technical controls alone do not make TURVIO compliant. JARBOU, as controller, and Lunapact, as processor, must complete the organisational items below with their data-protection officer or lawyer. Controls already built are described in [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md). Pre-launch technical items are in [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md). This file does not repeat either.

**Staging rule:**
- `turvio-staging` and the pilot simulation use **synthetic data only**.
- Fictional recipients and tracking numbers. Public OSM addresses are allowed.
- No real customer parcels, no real recipient names, no DHL data.
- Real driver accounts only after the items marked **before real data** are done.

## 1. Roles and contracts

| # | Item | Owner | Status |
|---|---|---|---|
| 1.1 | JARBOU Logistik GmbH = **controller** (its deliveries, its drivers, its recipients' data) | JARBOU | ☐ confirm |
| 1.2 | Lunapact Technologies (UAE) = **processor** (Art. 28) | Lunapact | ☐ confirm |
| 1.3 | **AVV / DPA** JARBOU ↔ Lunapact per Art. 28(3): subject, duration, data types, TOMs (section 6), sub-processors (section 2), deletion on end of contract, audit rights | both | ☐ **before real data** |
| 1.4 | Lunapact is outside the EU: check whether it needs an **EU representative** under Art. 27, and how its staff in the UAE access the data. UAE support access to EU data is a **third-country transfer** that needs SCCs or a similar basis. | Lunapact, legal | ☐ **before real data** |
| 1.5 | Data-protection officer: JARBOU checks whether one is required (BDSG §38) and names the contact | JARBOU | ☐ |

## 2. Sub-processors (to list in the DPA)

| Sub-processor | Purpose | Location | Personal data? | Status |
|---|---|---|---|---|
| Supabase | Database, auth, proof storage | Frankfurt (eu-central-1), verified | yes, all | ☐ sign Supabase DPA; ☐ check its sub-processors (AWS) |
| Hosting provider (e.g. Hetzner, see [STAGING_HOSTING_COMPARISON.md](STAGING_HOSTING_COMPARISON.md)) | API, optimizer, OSRM | Germany | in transit and in memory; logs | ☐ choose; ☐ sign provider DPA |
| SMTP provider (not chosen) | Invitation and password e-mails | EU required | e-mail addresses | ☐ choose an EU provider; ☐ DPA |
| Expo / EAS (650 Industries, USA) | **Builds the app only**. No runtime data: the app talks to TURVIO's API directly | USA | none at runtime; developer accounts | ☐ confirm no OTA/telemetry service is enabled that sends user data; document |
| Google Maps SDK (Android) | Map tiles in the driver app | Google (global) | device IP address and map viewport, sent by the phone to Google | ☐ decide; ☐ mention in the driver privacy notice; alternative: an OSM-based tile source |
| Apple Maps (iOS) | Map tiles | Apple | device IP address and viewport | ☐ mention in the notice |
| OpenStreetMap data (ODbL) | Self-hosted routing and geocoding; **no requests leave our servers** | – | none | attribution only (see [MAP_DATA_PLAN.md](MAP_DATA_PLAN.md)) |

## 3. Records of processing (Art. 30), drafts for JARBOU's register

| Processing | Data subjects | Data | Purpose / legal basis (to confirm) | Retention |
|---|---|---|---|---|
| Driver accounts | JARBOU drivers, dispatchers, admins | name, work e-mail, role, depot, login and MFA records, audit log | Employment contract: §26 BDSG / Art. 88 GDPR, Art. 6(1)(b) | while employed, then delete |
| Driver location | drivers | (a) GPS point with proof of delivery if the tenant enabled it; (b) **live tour tracking** (docs/LIVE_TRACKING.md): GPS every 5–60 s **only while a tour is in progress**, only if the tenant switched it on (default off) and the driver acknowledged the notice; enforced in the database | Proof of delivery / operational tour monitoring, §26 BDSG; **DPIA and works-council agreement required before enabling (b)** | `location_retention_days`, default **30**; live position removed at tour end |
| Proof of delivery | drivers, recipients | photo, signature (SVG), time, optional location | Contract performance with the sender; evidence | `proof_retention_days`, default **90** |
| Delivery stops | recipients | name, address, phone (optional), notes, tracking numbers | Art. 6(1)(b)/(f) on behalf of the sender | ☐ JARBOU must set a period; **no automatic purge of stop records yet** |
| Label OCR | recipients | label photo processed **on the device**, then discarded; no cloud OCR | data entry | not stored |
| Access audit | staff | who read which proof (`app.log_read`), changes (`audit_log`) | Security, Art. 32 | ☐ define a period |

Retention is enforced by `app.purge_expired_data()`. It needs either the daily `pg_cron` job (step 7 of the staging plan) or `BACKGROUND_JOBS=true` on one API instance. ☐ Verify that it actually ran on staging.

## 4. Data subject rights (Art. 15–21)

| Right | Procedure | Status |
|---|---|---|
| Access (Art. 15) | JARBOU receives the request. Lunapact exports the user's or recipient's rows within 7 days (SQL export per tenant). | ☐ write the export script; ☐ test it |
| Rectification | Dispatch / Admin edit screens | built |
| Erasure | Admin deletes users and proofs. Recipient data in tours has **no self-service delete** yet; it is a manual SQL step | ☐ tool or runbook |
| Restriction / objection | manual, by the controller | ☐ runbook |
| Deadline | one month (Art. 12(3)) | ☐ |

## 5. DPIA screening (Art. 35) and works council

- Location and activity data of employees (drivers) is systematic monitoring of employees. A **DPIA is likely needed**: ☐ JARBOU's DPO decides and documents it.
- **Betriebsrat:** technical systems that can monitor employee behaviour or performance need co-determination (**§87(1) Nr. 6 BetrVG**). This applies to TURVIO's delivery times, status history and POD location. ☐ JARBOU consults its works council, if it has one. ☐ **Legal review needed**; this point is flagged, not assessed.
- Driver information under Art. 13: ☐ privacy notice for drivers, covering what is recorded, when location is stored, retention and the map providers.

## 6. Technical and organisational measures (Art. 32), mapped to what exists

| Measure | Implemented control | Verified where |
|---|---|---|
| Tenant separation | Row-level security on every table; API sets a per-request role with the user's JWT claims | local tests; PG 17 integration tests; ☐ hosted staging |
| Need-to-know inside a tenant | Depot scope; drivers see only their own tours | local tests; ☐ hosted |
| Strong authentication | TOTP MFA required for admin actions in production; refresh-token rotation; invite-only (planned on staging) | local and mocked tests; ☐ hosted |
| Private proofs | Private bucket; API streams after its own access check; no public URLs | local; ☐ hosted bucket |
| Access logging | `app.log_read` for proof reads; `audit_log` for changes | local |
| Abuse protection | IP rate limit (600/min), login throttling | local |
| Encryption | TLS in transit (Caddy / Supabase); at rest by Supabase (provider statement, ☐ check its DPA) | not verified by us |
| Least privilege | `turvio_service` without RLS bypass; `anon` without table grants | PG 17 validation |
| Data minimisation | Background location only during tours in progress and only with tracking switched on (default off); parked fixes thinned to 1/min; no microphone; on-device OCR; label photo not stored | code review, DB tests; ☐ device test |
| Backups / restore | Supabase backups (Free plan: limited, ☐ check); restore test | ☐ |
| Secrets | Only in secret stores or the server's `.env`; never in Git or chat | process |

## 7. Breaches (Art. 33/34)

- ☐ Runbook: detect → contain → assess → **JARBOU notifies its authority within 72 h** (Lunapact informs JARBOU without undue delay, with the deadline set in the DPA) → inform data subjects if the risk is high.
- ☐ Contact list (JARBOU DPO, Lunapact on-call, Supabase and hosting support).
- ☐ Breach log, including incidents that did not need notification.

## 8. International transfers

- Production data should stay in the EU: Supabase Frankfurt and German hosting.
- Transfers that remain:
  - Lunapact staff access from the UAE (item 1.4);
  - Expo/EAS in the US (build-time only, no personal data at runtime);
  - Google Maps tile requests from the phones.
- ☐ Document each, with its legal basis or the decision to avoid it.

## Before the first real data (summary)
1.3, 1.4, Supabase + hosting + SMTP DPAs, 3 (stop-record retention), 5 (DPIA decision, works council, driver notice), 7 (breach runbook), and the hosted security tests from the staging plan.
