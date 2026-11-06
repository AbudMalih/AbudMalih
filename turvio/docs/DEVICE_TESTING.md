# TURVIO Driver – builds, installation and device testing

Status 2026-11-06: an **Android release APK was built in the development environment** (Gradle, arm64-v8a, `com.lunapact.turvio.driver.preview`, debug-signed, ML Kit OCR model included). It was **not run on a phone or emulator** (no device, no KVM). **No iOS build was made** (needs macOS/Xcode or EAS). Every item in the test plan below is therefore still open.

## Build variants

| Variant (`APP_VARIANT`) | App id | Name on the phone | Purpose |
|---|---|---|---|
| `development` | `com.lunapact.turvio.driver.dev` | TURVIO Driver (Dev) | dev client – loads JavaScript from Metro on your computer |
| `preview` | `com.lunapact.turvio.driver.preview` | TURVIO Driver (Test) | self-contained test build (internal distribution) |
| `production` | `com.lunapact.turvio.driver` | TURVIO Driver | store build |

The three ids differ, so all three can be installed side by side. `EXPO_PUBLIC_API_URL` decides which server a build talks to (it is a build-time value, not a secret). **Without it the app runs in demo mode with synthetic data** – useful for testing scanning, OCR, maps and the UI without a server.

## Android

### A. The APK from this environment (demo mode)
`app-release.apk` (preview variant, arm64 phones – practically every phone from 2017 on, debug-signed):
1. Copy the APK to the phone (USB, cloud drive or e-mail to yourself).
2. Open it; Android asks to allow installing from this source (Settings → Apps → special access → *Install unknown apps* → allow for the file manager/browser you used).
3. Install, open *TURVIO Driver (Test)*. Allow the camera when you first scan.
4. The map needs a Google Maps key on Android (`GOOGLE_MAPS_ANDROID_API_KEY`); without it the map area stays empty – everything else works.

### B. Your own builds with EAS (recommended)
Prerequisites: an Expo account (owned by Lunapact), `npm i -g eas-cli`, then in `apps/driver`:
```bash
eas login
```
```bash
eas init
```
`eas init` links the project and prints a project id – put it into the EAS environment variable `EAS_PROJECT_ID` (or the app config). Then:
```bash
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://api.staging.your-domain.example --visibility plaintext
```
```bash
eas env:create --environment preview --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --visibility secret
```
```bash
eas build -p android --profile preview
```
EAS prints a link/QR code; open it on the phone and install. For day-to-day development use `--profile development` (dev client, then `npx expo start` on your computer).

### C. Local build (Linux/macOS with Android SDK + JDK 17)
```bash
cd apps/driver && APP_VARIANT=preview npx expo prebuild -p android --clean
```
```bash
cd apps/driver/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```
Output: `apps/driver/android/app/build/outputs/apk/release/app-release.apk`. Install with `adb install -r app-release.apk`. The `android/` folder is generated (not committed).

## iOS
iOS builds need Apple signing. **What you must do (cannot be done from here):**
1. Apple Developer Program membership for Lunapact Technologies (organisation account, D-U-N-S number).
2. Register test iPhones: `eas device:create` (opens a link that installs a profile on the iPhone and registers its UDID).
3. Build: `eas build -p ios --profile development` (dev client) or `--profile preview` (self-contained). EAS creates certificates and provisioning profiles when you log in with the Apple account.
4. Install from the EAS link on the registered iPhone; on iOS 16+ enable *Settings → Privacy & Security → Developer Mode* for development builds.
5. Later: TestFlight via `eas submit -p ios` (production profile).

The iOS OCR uses Apple's Vision framework (no extra pod); this code was written but **never compiled** – the first EAS iOS build is its first compile check.

## Device test plan (please run on your own phones)

Use synthetic labels only (print labels with fictional names, addresses and tracking numbers – never real customer parcels). Record phone model, OS version, build variant and date for every run.

### 1. Installation & permissions
- [ ] App installs, icon/splash show the TURVIO mark, name "TURVIO Driver (Test)".
- [ ] First scan asks for camera with the TURVIO explanation; denying shows the explanation and "Open settings".
- [ ] Location is asked only when tapping "My location" or "Optimize from my position"; no background-location prompt ever.
- [ ] No microphone or photo-library permission is requested.

### 2. Continuous scanning (hardware matrix)
Prepare 200 printed labels (Code 128 + DataMatrix/QR mix, fictional numbers). For each run note the figures from *Scan history* (parcels, repeats, scans/min, median interval).

| Run | Phone | Light | Parcels | Expected | Scans/min | Median s | Missed | Wrong duplicates | Battery % used |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | daylight | 50 | 50 new, 0 duplicates | | | | | |
| 2 | | daylight | 100 | 100 new | | | | | |
| 3 | | van interior / dusk + torch | 100 | 100 new | | | | | |
| 4 | | daylight | 200 | 200 new | | | | | |
| 5 | | daylight | 50 + 10 rescanned | 10 duplicates flagged | | | | | |

Also check: holding a code in front of the lens does **not** count it twice; haptic feedback for new / duplicate / invalid; torch on/off; pause/resume; auto-pause after 60 s without scans; scanning in airplane mode, then sync after reconnecting.

### 3. Label OCR (Android: ML Kit, iOS: Vision)
- [ ] Clear German label (name, street + no., PLZ, city, barcode): all fields filled, PLZ/city "certain".
- [ ] Label photographed 90° rotated – still read.
- [ ] Dim light / crumpled label – fields marked "check/unsure", nothing invented.
- [ ] Sender + recipient on one label – recipient chosen, warning shown.
- [ ] Label with two barcodes – both offered.
- [ ] After saving, the label photo is gone (no photo in the gallery).

### 4. Map performance
Create routes with 50, 100, 150 and 250 stops (Dispatch paste import or `e2e/pilot.mjs`). Pan and zoom for 30 s each:
- [ ] No freeze > 0.5 s; zooming out shows count bubbles, tapping a bubble zooms in; the current stop is always visible.
- [ ] Selecting a stop responds immediately.

### 5. Delivery, proof and offline
- [ ] 20 deliveries in airplane mode incl. photo + signature, force-close the app, reopen offline (all still there), go online → Dispatch shows all 20 and the proofs, nothing duplicated.
- [ ] Not delivered with reason; note; arrival.
- [ ] Navigation to Google Maps, Waze, Apple Maps (iOS); uninstall Waze → the browser link opens.
- [ ] Drag-and-drop reorder, lock a stop, re-optimize – locked stop keeps its place.
- [ ] Dark mode; Arabic (restart → right-to-left).

Report results in a copy of this file; anything failing is a pilot blocker.
