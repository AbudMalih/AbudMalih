# Security & privacy

TURVIO processes personal data of recipients (name, address), drivers (identity, working time, location) and customer staff. GDPR applies – internal or B2B use is **not** an exemption. Customers (e.g. JARBOU) are controllers; the TURVIO operator is a processor and needs a data processing agreement (Art. 28 GDPR / AVV) with each tenant.

## Implemented

| Area | Measure |
|---|---|
| Tenant isolation | RLS on all tables, composite tenant FKs, explicit tenant in API routes, tests (see ARCHITECTURE §3.2) |
| Least privilege | Roles owner/admin/dispatcher/driver; drivers change state only through checked RPCs; `anon` has no table access; platform admins see no operational data |
| Authentication | Supabase JWT verified (issuer, audience, signature, expiry); dev bypass refused in production |
| Input validation | Zod schemas on client and API; Pydantic in the optimizer; DB CHECK constraints |
| Error handling | API never returns internal errors or upstream addresses to clients |
| Audit | Trigger-based audit log: actor, table, record id, *names* of changed columns – no copies of personal data |
| Data minimisation | Location pings only for the driver's own in-progress tour; drivers cannot read pings back; admin console shows only aggregates |
| Retention | Per-tenant `location_retention_days` (default 30) and `proof_retention_days` (default 90); `app.purge_expired_data()` for a daily pg_cron job |
| Secrets | Only via environment variables; `.env*` git-ignored; `EXPO_PUBLIC_*` documented as non-secret |
| Web headers | `X-Frame-Options: DENY`, `nosniff`, referrer policy; Dispatch disables camera/mic/geolocation; Admin is `noindex` |
| Synthetic data | All development data is fictional; tracking numbers use a made-up `TVO…` format |

## Required before production

* Hosting in the EU (Supabase Frankfurt); TLS only; HSTS at the edge.
* Records of processing, DPIA for location tracking and OCR, TOMs, DPA template for tenants, privacy notices for drivers (works council involvement in Germany for employee location tracking – BetrVG §87(1) no. 6).
* Storage bucket policies for `proofs` (tenant-prefixed paths), signed URLs with short expiry, purge of storage objects with the DB rows.
* MFA for owners/admins/platform admins; session revocation on member removal.
* Rate limiting and request logging without personal data in the API.
* Dependency scanning and a penetration test before onboarding the second customer.

## Carrier integrations

TURVIO does **not** connect to DHL or any other carrier system. No real carrier customer data is processed. Any integration requires written authorization from the carrier and the customer, and a legal review.
