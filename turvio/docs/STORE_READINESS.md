# TURVIO Driver – App Store and Google Play readiness

One Expo / React Native codebase (`apps/driver`) for Android and iOS. Builds through EAS
(project `lunapact-technologies/turvio-driver`). **Nothing is submitted or published without the
owner's explicit approval** (TestFlight upload = submission).

## Build profiles (eas.json)

| Profile | Android | iOS | Use |
|---|---|---|---|
| `preview` | APK, internal | ad-hoc (registered devices) | staging test builds (`TURVIO Driver (Test)`, `.preview` ids) |
| `store-test` | AAB → Play internal track (draft) | store build → TestFlight | store pipeline test against staging |
| `production` | AAB | App Store build | release (production API) |

Version: `0.3.0` (Android versionCode 3; EAS increments build numbers remotely).

## In-app requirements (done in code)

| Requirement | Where |
|---|---|
| Accurate location disclosure (incl. background tracking) | Settings → Privacy (`settings.privacyText`, DE/EN/RO/AR); iOS permission texts in `app.config.ts` (expo-location plugin); tracking notice + acknowledgement before any tracking |
| Account deletion from inside the app (Apple 5.1.1(v), Google Play) | Settings → Privacy → "Request account deletion" → `POST /v1/me/account-deletion-request` → TURVIO support (`SUPPORT_EMAIL`) |
| Privacy policy link | Settings → Privacy, when the build sets `EXPO_PUBLIC_PRIVACY_URL` |
| No tracking / ads | iOS privacy manifest `NSPrivacyTracking=false`; no ad or analytics SDKs |
| Required-reason APIs | iOS privacy manifest: UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1 |
| No debug/staging details in store builds | server address hidden in production; server picker only in test builds |
| Export compliance | standard HTTPS only (`usesNonExemptEncryption: false` for test builds; set for production at release) |

## Store forms (owner fills in, must match the app)

**Apple App Privacy / Google Data safety** – data collected, linked to the driver's company account,
used only for app functionality, not for tracking, not sold:
precise location (incl. background during tours, only when the company enabled live tracking and the
driver acknowledged the notice), photos (proof of delivery, label photos – label photos deleted after
reading), name, e-mail address, user ID, other user content (signatures, delivery notes).
Encrypted in transit; deletion on request (in-app request, plus the web link below).

**Background location justification (Google Play declaration, Apple review notes):** live position
of the vehicle for the dispatch team during an active delivery tour, only when the company switched
live tracking on and the driver acknowledged the notice; stops when the tour is paused or finished;
a persistent notification shows while active. Include a short screen recording for Google.

**Review access:** a synthetic demo company with a reviewer driver account and a published demo tour
(staging or a dedicated review tenant). Credentials go into App Store Connect / Play Console, never
into the repository.

## Owner inputs still needed (blockers for submission, not for test builds)

1. Privacy policy URL (public web page) → EAS env `EXPO_PUBLIC_PRIVACY_URL` (preview + production).
2. Support mailbox → API setting `SUPPORT_EMAIL` (staging + production).
3. Account-deletion web page or form for Google Play's "delete account URL".
4. Store listing texts (DE/EN/RO/AR), screenshots (phone, both platforms), feature graphic (Play).
5. Native-speaker review of the Romanian and Arabic texts.
6. Production bundle id / package confirmation (`com.lunapact.turvio.driver`) and App Store Connect app record.
7. Real-device test runs (Android + iPhone) with `docs/ANDROID_DEVICE_TEST_CHECKLIST.md` and the iOS checklist.
