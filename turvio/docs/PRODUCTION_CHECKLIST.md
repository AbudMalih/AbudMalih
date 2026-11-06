# TURVIO – security review and production checklist

Review date 2026-11-06 (Phase 5). Technical controls exist; that alone does **not** make TURVIO GDPR-compliant – the organisational measures below (DPA, DPIA, records, works council, incident process) are required and are not software.

## Review of implemented controls

| Area | State | Evidence / gaps |
|---|---|---|
| Tenant isolation | RLS on every tenant table, composite tenant FKs, per-request `authenticated` role; double-booking indexes include the tenant | DB tests (52) + API integration tests; **external penetration test still missing** |
| Depot scope | dispatchers limited by `membership_depots` in RLS | tests incl. route/proof endpoints |
| Authentication | short JWTs, rotated refresh tokens with reuse detection, throttled login, httpOnly cookies (web), keystore (app) | TOTP MFA built; enforced for company administration and platform endpoints (`REQUIRE_ADMIN_MFA`); Supabase mapping **not verified live**; no recovery codes |
| API authorization | permission guard + RLS (defence in depth); drivers only via checked RPCs | tested per endpoint |
| Rate limiting | per IP (600/min), stricter for login, geocoding (2/s), batch geocoding | add WAF/proxy limits in production |
| Private proofs | private storage, access-checked streaming, `no-store`, CSP sandbox, magic-number + SVG whitelist, idempotent uploads, **read access logged** (`audit_log` action `read`) | Supabase Storage adapter only mock-tested |
| File uploads | 5 MB limit, JPEG/PNG/SVG only, label photos never uploaded | malware scanning not needed for re-encoded images; keep limits |
| Audit | changes (trigger) + proof reads | no UI to review the log yet |
| Backups | Supabase PITR (plan setting) | **restore drill not done** |
| Retention | per-tenant purge of locations/proofs, file deletion queue | schedule the cron job in the hosted project |
| Location | foreground only, on request; PoD location only if the company enables it; no background permission in the app manifest | needs DPIA + works-council agreement before enabling |
| Secrets | env/secret stores only; `.env*` ignored; EAS secrets for keys | rotate the dev JWT secret; never reuse dev values |
| Mobile | no microphone/biometric/overlay permissions; tokens in keystore; data cleared on sign-out | jailbreak/root detection not implemented (not planned for pilot) |
| Dependencies | locked versions | add `pnpm audit`/Dependabot in CI after the repository move |

## Before the first real (pilot) data

- [ ] Hosted Supabase in Frankfurt, PITR on, restore tested once.
- [ ] `AUTH_PROVIDER=supabase` verified end to end (login, reset mail, invitation).
- [ ] Private `proofs` bucket; upload/download verified with the Supabase adapter.
- [ ] SMTP with SPF/DKIM; no dev mailbox.
- [ ] OSRM with a real Germany/Niedersachsen extract; geocoder imported; attribution shown.
- [ ] MFA for owners/admins/platform admins: built (local provider tested); verify with `AUTH_PROVIDER=supabase` on staging, every owner/admin/platform admin enrolled.
- [ ] Penetration test (external) on staging; findings fixed.
- [ ] DPA (Art. 28) between Lunapact and JARBOU; TOMs; records of processing; DPIA for location and proof-of-delivery photos; privacy notice for drivers; works-council (BetrVG §87(1) no. 6) agreement if location is used.
- [ ] Incident and breach-notification process (72 h), support contacts.
- [ ] Device test plan ([DEVICE_TESTING.md](DEVICE_TESTING.md)) passed on the pilot phones.
- [ ] Monitoring/alerting (API errors, optimizer latency, OSRM health, outbox backlog), log retention without personal data.
- [ ] No DHL or other carrier system is connected; any such integration needs written authorization.
