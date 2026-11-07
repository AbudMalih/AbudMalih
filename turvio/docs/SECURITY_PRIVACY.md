# Security & privacy

TURVIO processes personal data of recipients (name, address), drivers (identity, working time, location) and customer staff. GDPR applies – internal or B2B use is **not** an exemption. Customers (e.g. JARBOU) are controllers; the TURVIO operator is a processor and needs a data processing agreement (Art. 28 GDPR / AVV) with each tenant.

## Implemented

| Area | Measure |
|---|---|
| Tenant isolation | RLS on all tables, composite tenant FKs, explicit tenant in API routes, tests (see ARCHITECTURE §3.2) |
| Least privilege | Roles owner/admin/dispatcher/driver; drivers change state only through checked RPCs; `anon` has no table access; platform admins see no operational data |
| Authentication | JWT verified (issuer, audience, signature, expiry); local provider: scrypt hashes, 15-min access tokens, hashed + rotated refresh tokens with reuse detection (revokes all sessions), login throttling, single-use reset tokens, no account enumeration on password reset; dev bypass and dev mailbox refused in production |
| Two-step verification (MFA) | TOTP (RFC 6238, SHA-1/30 s/6 digits, ±1 step) for any account; with `REQUIRE_ADMIN_MFA` (default on in production) company administration (`org.settings.manage`, `org.members.manage`, `org.billing.view`) and every `/v1/platform/*` endpoint need an `aal2` session, otherwise 403 `mfa_required` (checked *after* membership/role checks, never instead of them). Local provider: secret encrypted at rest (AES-256-GCM, key derived from `JWT_SECRET` via HKDF), codes single-use (replay protection by time step), second-step token hashed, 5-minute, single-use, 5 attempts per challenge and 10 wrong codes per account per 15 min; activating MFA signs out password-only sessions; `aal` kept on refresh. Supabase provider maps to GoTrue MFA factors (mock-tested only). Web: challenge token only in an `httpOnly` cookie; set-up page `/security` |
| Sessions in web apps | Tokens only in `httpOnly`/`SameSite=Lax`/`Secure` cookies behind a same-origin proxy – never readable by page scripts; logout revokes the refresh token server-side |
| Sessions in the driver app | Tokens in the OS keystore (`expo-secure-store`) |
| Database access | Each request runs as role `authenticated` with the user's claims, so RLS applies to every API query; service connection only for auth tables and invitation acceptance |
| Concurrency | Optimistic `version` on tours (409 on conflict), DB transactions per request, **unique partial indexes** against double-booking a driver or vehicle on two open dispatch tours on the same day (tested with simultaneous requests), idempotent offline events (`client_event_id`), stale offline updates recorded but not applied |
| Invitations | Single-use, hashed, expiring tokens; role + depot scope set by an admin; audited |
| Proof of delivery | Files in private storage (local disk or private Supabase bucket), never public URLs; the API streams a file only after RLS confirmed access to the proof record (`Cache-Control: private, no-store`, CSP sandbox, nosniff); content checked by magic number; signatures accepted only as path-only SVG (whitelist, no scripts/links/styles); idempotent uploads; admins can delete; retention purge removes records and queues file deletion |
| Camera / location | Permissions requested in context with an explanation; camera only while scanning or capturing; location on request (map, optimize-from-here), with proof of delivery **only if the company enables it**, and – only if the company switched live tracking on (default off) and the driver acknowledged the notice – in the background **while a tour is in progress** (visible notification; docs/LIVE_TRACKING.md); microphone permission removed from the manifest |
| Label photos | Deleted on the device right after barcode/text extraction; never uploaded |
| Delivery photos | Downscaled and re-encoded (EXIF removed) before upload; kept in the app's private directory until the upload is confirmed, then deleted |
| Recipient phone numbers | Sent to drivers only when the company enables `showRecipientPhone` |
| Offline data on the phone | Tour, queue and scans in app storage; tokens in the OS keystore. Signing out clears queued data and pending files (with a warning when changes are unsent) |
| Input validation | Zod schemas on client and API; Pydantic in the optimizer; DB CHECK constraints |
| Error handling | API never returns internal errors or upstream addresses to clients |
| Audit | Trigger-based audit log: actor, table, record id, *names* of changed columns – no copies of personal data |
| Data minimisation | Location pings only for the driver's own in-progress tour; drivers cannot read pings back; admin console shows only aggregates |
| Retention | Per-tenant `location_retention_days` (default 30) and `proof_retention_days` (default 90); `app.purge_expired_data()` for a daily pg_cron job |
| Secrets | Only via environment variables; `.env*` git-ignored; `EXPO_PUBLIC_*` documented as non-secret |
| Web headers | `X-Frame-Options: DENY`, `nosniff`, referrer policy; Dispatch disables camera/mic/geolocation; Admin is `noindex` |
| Synthetic data | All development data is fictional; tracking numbers use a made-up `TVO…` format |

### Stops from photos, screenshots, pasted or shared text (Phase 6)
- **Text recognition runs on the phone** (ML Kit / Apple Vision). Images and their text are **never uploaded**. The only thing sent to the TURVIO API is the address fields, for the exact-match address search (`/v1/geocode/batch`, signed-in users, rate-limited).
- **Gallery access:** only through the system photo picker (Android Photo Picker, iOS PHPicker). There is no gallery or storage permission: on Android `READ_MEDIA_*`, `READ/WRITE_EXTERNAL_STORAGE` are removed from the manifest, and on iOS there is no `NSPhotoLibraryUsageDescription`. The app receives copies of the chosen images only.
- **Shares from other apps** (Android `SEND`/`SEND_MULTIPLE`, iOS Share Extension with an App Group):
  - only images (max 10, ≤ 25 MB each) and text are accepted;
  - other files are deleted immediately;
  - shared items are held in memory only, until the import screen reads them;
  - an import started while signed out waits for sign-in.
- **No copies kept:** camera, picker and share copies are deleted right after reading; the driver's originals in the gallery are not touched. Extracted names and addresses live in an **in-memory, non-persisted** session until the driver saves or leaves.
- **Coordinates are never invented:**
  - set automatically only for exact house-level matches;
  - street-level matches need the driver's confirmation;
  - otherwise the driver sets a pin or explicitly saves "without position".
- **Audit:** stops created this way go through the normal stop creation. They are written to `audit_log` with the driver as actor (insert trigger on `stops`), and the authorization rules are unchanged (driver → own route only).
- **Not yet logged:** the source of a stop ("from photo"). That would need a database column (migration, needs approval).

## Required before production

* Hosting in the EU (Supabase Frankfurt); TLS only; HSTS at the edge.
* Records of processing, DPIA for location tracking and OCR, TOMs, DPA template for tenants, privacy notices for drivers (works council involvement in Germany for employee location tracking – BetrVG §87(1) no. 6).
* Create the private `proofs` bucket in the hosted project and verify the Supabase storage adapter against it (only tested with a mocked Storage API).
* DPIA for proof-of-delivery photos/signatures and (if enabled) PoD location; works-council agreement for location data.
* MFA: verify the Supabase (GoTrue) MFA mapping against the hosted project (only mock-tested); recovery procedure for lost authenticators (today: an operator deletes the row in `app_auth.mfa_factors` / the Supabase factor after identity checks – no self-service recovery codes yet); session revocation on member removal.
* Production mail (SMTP, SPF/DKIM) – today mails go to a development outbox.
* Rate limiting and request logging without personal data in the API.
* Dependency scanning and a penetration test before onboarding the second customer.

## Carrier integrations

TURVIO does **not** connect to DHL or any other carrier system. No real carrier customer data is processed. Any integration requires written authorization from the carrier and the customer, and a legal review.
