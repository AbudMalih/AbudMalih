# TURVIO NEXT – completion plan (2026-11-19)

Basis: a code-level audit of all four applications with every test suite run (not the docs' claims).
Release rule: an application counts as finished only after its real workflows pass end-to-end tests –
browser E2E for Admin and Dispatch, real Android and iPhone devices for the Driver app.
Approvals stay with the owner: staging migrations/deployments, store submissions, production, billing.

## Baseline (audit results)

| Area | Typecheck | Tests | Verdict |
|---|---|---|---|
| API + DB + security | clean | API 292 passed / 18 skipped (road-routing server), shared 192, optimizer 451 | Core finished; hardening gaps below |
| Dispatch Web | clean | 180 passed (incl. new Team tests), production build OK | Feature-complete except member management, 100-stop reordering, import atomicity; clutter |
| Admin Web | clean | 23 passed, production build OK | Read-mostly: only "create company" works; no i18n |
| Driver (Android + iOS) | clean | 152 passed | Workflows complete in code; store blockers; iOS never compiled; no device tests |

Staging: PostgreSQL 17 at `20261118000100`, verified encrypted backup; Phase I step 2 prepared
(`deploy/staging/runbooks/phase-i-step2-rollout.md`), waiting for the float-column re-check and approval.

## Status by requirement

| Requirement | Status | Gap |
|---|---|---|
| Premium UI, light/dark | Dispatch/Admin/Driver have both themes | Dispatch: saved theme not applied on load, no quick toggle; Admin: toggle overrides "system"; old design still reachable (`?ui=classic`) |
| Driver DE/EN/RO/AR + RTL | Complete key sets | English error strings; RTL needs manual restart; RO/AR need native review |
| Dispatch EN/DE/AR + RTL | Done | Server error texts / invitation e-mail English |
| Admin EN/DE/AR + RTL | **Missing** | ~270 strings; share Dispatch's i18n core |
| Roles + company/location isolation | Done in API + RLS | Dispatch: no member management; Fleet ignores location switcher; Admin: no user/admin/location management |
| Bulk Excel/CSV import | Works | Partial saves reported as "nothing saved"; no file-size limit; no geocoding progress; `/geocode/batch` 500 on geocoder errors |
| DHL label scanning | Partial | No GS1 multi-field / DHL DataMatrix parsing; `00340` 20-digit rule unreachable; thin tests |
| Route optimization 80–100 stops | Done (budgets, fallback) | Reordering 100 stops = one request per arrow click; needs move-to-position / drag |
| Live GPS + dispatch map | Done | OSM tile server not allowed for production use → configurable tile provider (Leaflet kept) |
| Driver workflows, POD, failures, offline | Done in code | Scans/sequence lack client ids; no real-device test |
| Admin dashboard | **Incomplete** | Suspend/plan/limits, users, platform admins, company detail, audit actor/paging, companies without subscription |
| No debug clutter | Partial | Error refs in every toast, env badge, server URL in Driver settings, demo/test texts |
| Team loading bug | **Fixed** (462cfa5) | Verify on staging after deployment |
| Security | Good | CSP missing; `app.failure_reason_allowed` membership check; DB pool without timeouts; purge job opt-in |
| iOS | Not built | Privacy manifest, background modes, never compiled (OCR module), TestFlight via EAS |
| Store readiness | Blocked | Privacy text contradicts background tracking; privacy-policy link; account deletion |

## Phases (each: implement → tests → commit/push → report)

**J0 – Staging (owner approval).** Float-column re-check → Phase I step 2 (migrations + release) → staging smoke.

**J1 – Backend hardening (no staging change until approved).**
DB pool timeouts and statement timeout; `/geocode/batch` error mapping and bounded parallelism;
retention purge on by default; CSP for Dispatch and Admin; migration for the
`failure_reason_allowed` membership check (prepared, applied only with approval); client ids for scans;
API for member management, company suspend/reactivate, plan change, limit overrides, platform admins,
company audit log with actor and paging.

**J2 – Dispatch completion.** Member management UI; move-to-position / drag reordering saved in one request;
truthful partial-save reporting + file-size limit + geocoding progress; Fleet follows the location switcher;
theme from the server on load + quick toggle; translated server error codes and invitation e-mail;
configurable map tiles; remove clutter (error refs behind "details", env badge, `?ui=classic`, raw ids, "pilot" wording).

**J3 – Admin completion.** Shared i18n package (EN/DE/AR + RTL); company detail (locations, members, plan,
limits, suspend/reactivate); platform admins; audit log with actor, filters, paging; companies without a
subscription; MFA redirect; locale-correct dates; clutter removal.

**J4 – Driver completion (Android + iOS, one Expo codebase).** Store blockers: correct privacy/location
wording, privacy-policy link, account-deletion request; GS1/DHL DataMatrix parser + tests, `00340` fix;
localized errors; automatic reload after a language-direction change; remove server URL / raw errors from
normal screens; iOS: privacy manifest, background location modes and texts, build number via EAS, OCR
module compile; battery-optimisation guidance for tracking.

**J5 – Builds.** Android APK locally (SDK present) and via EAS; iOS through EAS → TestFlight (needs the
existing Expo/Apple setup; no store submission without approval).

**J6 – End-to-end and release.** Browser E2E on a local full stack (API + PostgreSQL + optimizer +
Dispatch + Admin) for every workflow; staging smoke after deployment; owner device tests on Android and
iPhone with `docs/ANDROID_DEVICE_TEST_CHECKLIST.md` (+ iOS checklist); store listings and privacy forms.
