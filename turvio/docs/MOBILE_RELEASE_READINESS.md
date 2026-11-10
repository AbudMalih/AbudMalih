# TURVIO Driver – TestFlight and Android internal-testing readiness (P0-3.6)

Status as of 2026-11-10. Builds and installation steps: `docs/DEVICE_TESTING.md`. This list is what
must be true before the first iOS TestFlight build and the first Android internal-testing track
release, and what can only be verified on a physical phone.

Legend: **[done]** verified here (automated tests, web build, local stack) · **[you]** needs an
account, credential or decision of Lunapact · **[device]** needs a physical phone.

## 1. Accounts, identities and signing

| Item | iOS | Android |
|---|---|---|
| Developer account (organisation, D-U-N-S) | [you] Apple Developer Program for Lunapact Technologies | [you] Google Play Console organisation account (one-time fee) |
| App ID / package | `com.lunapact.turvio.driver` (production), `.preview` (internal test) – [you] confirm before the first upload; it cannot be changed later | same ids |
| Signing | [you] EAS-managed certificates/profiles after `eas login` with the Apple account | [you] EAS-generated upload keystore on the first build – keep it; Play App Signing holds the app key |
| Store listing (internal) | [you] App Store Connect app record, TestFlight internal group | [you] Play Console app, internal-testing track + tester list |
| EAS project | [done] `@lunapact-technologies/turvio-driver`, profiles development / preview / production in `apps/driver/eas.json` | same |

## 2. Configuration per build profile (no secrets in the repo)

- [you] `EXPO_PUBLIC_API_URL` in the EAS environment of the profile = HTTPS address of the staging API
  (without it the build runs in demo mode).
- [you] `GOOGLE_MAPS_ANDROID_API_KEY` (EAS secret), restricted to the package + signing SHA-1.
- [done] Version `0.2.0`, `runtimeVersion: appVersion`; Android `versionCode` must increase for every
  build handed out (production profile: `autoIncrement`).
- [done] Permissions declared with purpose strings: camera (scanning, labels, photos), location
  when-in-use (map, proof), background location only for live tracking that the company enabled and
  the driver acknowledged; microphone, broad storage and gallery permissions are blocked.

## 3. Store review and privacy (both platforms)

- [you] Privacy policy URL and support contact (Lunapact Technologies, UAE; data processed for a
  German pilot customer – GDPR, see `docs/GDPR_CHECKLIST.md`).
- [you] App Privacy (Apple) / Data safety (Google): precise location (app functionality; optional
  background for live tracking), photos (proof of delivery), contact/address data of recipients
  (processed for the employer), no tracking for advertising, no data sale.
- [you] Background location justification: Apple review notes + Google's background-location
  declaration with a short video of the in-app notice → acknowledgement → tracking flow.
- [you] A reviewer test account on staging with synthetic data only (never real customers).
- [done] Location-history and audit purpose documented (`docs/LOCATION_HISTORY.md`).

## 4. Verified without a phone

- [done] 108 Driver unit/integration tests (jest), incl. offline outbox, retries without duplicates,
  failed-item list, server-mode sync, location warnings, approach navigation, stale-version (409)
  handling, consecutive offline pin moves.
- [done] Driver web build against the local stack (e2e/location-safeguards.mjs): login, tour and
  stops, location pills, issue texts in German and Arabic, offline tour start queued and synced.
- [done] Navigation URLs: Google (`google.navigation:` / `comgooglemaps://`), Apple Maps, Waze, with
  the accepted approach point when one is valid, else the pin, else the address text.
- [done] Translations: en / de / ro / ar, incl. all location issue texts (completeness test).

## 5. Requires a physical device (not verifiable here)

| # | Check | Platforms |
|---|---|---|
| 1 | Install from TestFlight / internal track; update over an earlier build keeps login and outbox | both |
| 2 | Permission prompts and texts (camera, location when-in-use, background location upgrade) in de/en/ro/ar; Arabic right-to-left layout after the restart prompt | both |
| 3 | Navigation hand-off opens Google Maps / Apple Maps / Waze at the **approach point** (stop with an accepted approach) and at the pin otherwise; the in-app note names the approach road | both |
| 4 | Offline in a real dead zone (airplane mode): deliver, photo + signature proof, pin move, address edit; back online → all sent once, in order, no duplicates | both |
| 5 | Offline pin move while dispatch moves the same pin → after sync the driver's change appears in the failed list with the "changed by someone else" message; the dispatcher's position stays | both |
| 6 | Location warnings: "Location problem" / "Check location" pills; stop screen texts in the chosen language; nothing shown while a check is pending | both |
| 7 | Live tracking in the background (screen off, other apps in front) for a full tour; battery use; stops when the tour completes | both |
| 8 | Camera scanning (continuous), label OCR (Android ML Kit, **iOS Vision – never compiled yet: the first iOS build is its first compile check**) | both |
| 9 | Map performance with 100 stops; dark mode; small screens (iPhone SE / 5.5" Android) | both |
| 10 | Share sheet into TURVIO (screenshot/text → stops) | both |
| 11 | Push-free behaviour: app resumes and syncs after hours in the background | both |

Record phone model, OS version, build profile and date for each run (template in `docs/DEVICE_TESTING.md`).

## 6. Not yet done / blocking

- No EAS cloud build has been made yet (Android or iOS); no staging host exists for `EXPO_PUBLIC_API_URL`.
- iOS native code (Vision OCR, background location) has never been compiled.
- P0-3 location features depend on the staging migration `20261118000100_stop_location_history`
  (not applied). A new driver build against the current staging API still works: the missing
  `/tours/:id/location-checks` endpoint just shows no warnings, and the old API ignores the new
  version/reason fields – but then there is no stale-edit protection. Deploy database + API first.
