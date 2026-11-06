# TURVIO Driver – builds, installation and device testing

Status 2026-11-06: an **Android release APK was built in the development environment** (Gradle, arm64-v8a, `com.lunapact.turvio.driver.preview`, debug-signed, ML Kit OCR model included). It was **not run on a phone or emulator** (no device, no KVM). **No iOS build was made** (needs macOS/Xcode or EAS). Every item in the test plan below is therefore still open.

## Build variants

| Variant (`APP_VARIANT`) | App id | Name on the phone | Purpose |
|---|---|---|---|
| `development` | `com.lunapact.turvio.driver.dev` | TURVIO Driver (Dev) | dev client – loads JavaScript from Metro on your computer |
| `preview` | `com.lunapact.turvio.driver.preview` | TURVIO Driver (Test) | self-contained test build (internal distribution) |
| `production` | `com.lunapact.turvio.driver` | TURVIO Driver | store build |

The three ids differ, so all three can be installed side by side. `EXPO_PUBLIC_API_URL` decides which server a build talks to (it is a build-time value, not a secret). **Without it the app runs in demo mode with synthetic data** – useful for testing scanning, OCR, maps and the UI without a server.

**Changing the server in test builds:** development and preview builds that were built with `EXPO_PUBLIC_API_URL` show a *Server (test build)* panel on the sign-in screen. Tap it to point the app at another TURVIO server (for example a laptop on the same Wi-Fi). Only `https://` is accepted, except `http://` for `localhost`, `10.x.x.x` and `192.168.x.x`. The choice is stored on the phone; *Use the built-in server* removes it. Production builds have no such panel and always use the built-in server. The panel cannot turn a demo build into a server build.

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

### EAS preview build – status (2026-11-06)
- Project `@lunapact-technologies/turvio-driver` (id `9ebfcd40-…`) is linked; `eas config --profile preview` resolves to package `com.lunapact.turvio.driver.preview`, APK, internal distribution, EAS environment `preview`.
- **Not yet built on EAS.** Before the first build:
  1. `EXPO_PUBLIC_API_URL` (plain text) in the EAS `preview` environment = the HTTPS address of the staging API (no staging host exists yet; without it the build runs in demo mode).
  2. `GOOGLE_MAPS_ANDROID_API_KEY` (secret) in the same environment, restricted in Google Cloud to package `com.lunapact.turvio.driver.preview` + the EAS signing certificate SHA-1 (shown by `eas credentials -p android` after step 3).
  3. Signing: the first `eas build -p android --profile preview` asks whether EAS should generate and store an Android keystore – answer yes (or approve that it is done for you). Keep that keystore; losing it means testers must uninstall to update.
- Each cloud build counts against the Expo plan's monthly build allowance; no paid add-ons are used.

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

### 6. Stops from photo, screenshot or text (Phase 6)
Test material (synthetic only): `docs/testing/capture-samples/`. It holds DHL, Hermes, DPD, GLS and Packstation labels with real Code 128 barcodes, a rotated Hermes label, two WhatsApp-style screenshots (one and three addresses) and a maps-share screenshot. Expected results are in `expected.json`. Regenerate them with `python3 tools/synthetic_capture_samples.py docs/testing/capture-samples`.

Preparation:
- Print the labels (A6 or A4).
- Put the screenshots in the phone's gallery: send them to yourself, or open them on a second screen and take screenshots.
- Use a route of today. Use a server build with the address search on (`GEOCODER=postgres` with addresses for the test area) and also a build without it.

- [ ] Home → **From photo** → **Take photo** of each printed label:
  - one card per label: recipient, street, house no., postcode and city correct;
  - the tracking number shown with its carrier (DHL / HERMES / DPD / GLS);
  - the sender is never taken.
- [ ] Rotated Hermes label (hold the phone sideways): still read.
- [ ] **Screenshots / photos** → select `whatsapp_single`, `whatsapp_multi` and `maps_share` together:
  - 5 cards ("Image 1–3");
  - time stamps, "online", phone number and greetings are ignored.
- [ ] **Paste copied text**: copy a WhatsApp message with two addresses, paste it, get 2 cards ("Text").
- [ ] Packstation label: card marked "Packstation"; the notes contain "Postnummer: 12345678".
- [ ] Map positions:
  - with the address search on, an exact address shows "Map position found";
  - a street with an unknown house number shows "Only the street was found – confirm". **Confirm** opens the correction screen with the pin; saving confirms it.
  - an unknown street shows "set the pin";
  - with the address search off or in airplane mode, every card asks for a decision (pin, or "Save without position"). No position is ever filled in automatically.
- [ ] Duplicates:
  - an address already on the route shows "parcels will be added to that stop", and saving merges it (no second stop);
  - a tracking number already on another stop shows a warning;
  - the same address twice in one import shows a warning.
- [ ] Correct a field (tap the card), switch a card to **Skip**, then **Add N stops**. The stops appear on the route; in airplane mode they sync after reconnecting.
- [ ] After saving, **Re-optimize**: road routing, and completed and locked stops keep their place. Outside the routing data, an error is shown, not a straight-line order.
- [ ] Privacy:
  - no gallery permission is requested (Android 13+: system photo picker; iOS: PHPicker);
  - after reading, the copies are gone and the originals in the gallery are unchanged;
  - the import list is empty after saving or leaving the screen.

Record per run: phone model, OS version, build, number of images, addresses found vs. expected, and fields corrected by hand.

### 7. Share into TURVIO (Phase B)
**Android** (preview APK or EAS preview build):
- [ ] WhatsApp → long-press a message with an address → Share → **TURVIO Driver (Test)** → the app opens "Stops from photo or screenshot" with the card(s) ("Text").
- [ ] WhatsApp → open an image (a screenshot from `docs/testing/capture-samples`) → Share → TURVIO → card(s) ("Image 1").
- [ ] Gallery → select 3 screenshots → Share → TURVIO → all are read (SEND_MULTIPLE). With more than 10 images, only 10 are read.
- [ ] Share a PDF: TURVIO is not offered for PDFs; if forced, nothing is imported.
- [ ] Signed out: share → login screen → after signing in the import opens with the shared items.

**iOS** (needs the EAS build below):
- [ ] Share sheet shows **TURVIO Test**. Text, one image and several images (up to 10) open in TURVIO as above.
- [ ] Choosing screenshots in the app opens the system picker; no "Allow access to photos" prompt.

**iOS build steps (Apple account needed; this cannot be done from the cloud environment):**
1. In the Apple Developer account: App IDs `com.lunapact.turvio.driver.preview` and `com.lunapact.turvio.driver.preview.share-extension`, and the App Group `group.com.lunapact.turvio.driver.preview` enabled for both. EAS can create the IDs and the App Group capability when you log in with the Apple account during `eas build`.
2. Register the test iPhones:
   ```bash
   eas device:create
   ```
3. Build:
   ```bash
   eas build -p ios --profile preview
   ```
   EAS creates the certificate and **two** provisioning profiles (app and share extension; declared in `extra.eas.build.experimental.ios.appExtensions` by the expo-share-intent plugin).
4. Install from the EAS link. This is also the first compile check of the iOS OCR module and the share extension.
