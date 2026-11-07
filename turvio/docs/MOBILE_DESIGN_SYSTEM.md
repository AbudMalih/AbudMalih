# TURVIO Driver – Mobile Design System

Scope: the driver app (`apps/driver`). The web dashboard follows `DESIGN_SYSTEM.md`. Tokens live in
`apps/driver/src/theme.ts`, components in `apps/driver/src/components/ui.tsx`.

## Direction
A driver looks at the phone for a few seconds between stops, often one-handed, outdoors, all day.
- **Route first.** Today shows the active route (progress, remaining figures, next stop, one primary action) before anything else.
- **One primary action per screen.** Filled blue = do this now; everything else is secondary (outlined/neutral) or a tile.
- **Hierarchy from weight and colour, not size.** Largest text is 24 pt (greeting); figures are 18 pt tabular.
- **Flat.** 1-px borders and two surface tones (`bg`, `card`) instead of shadows or gradients.
- **Honest numbers.** A figure is labelled "road network" only when it comes from road routing (OSRM); otherwise "straight-line estimate". No figure is shown when there is no data.

## Tokens
| Group | Values |
|---|---|
| Spacing (4-pt grid) | `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24` – screen gutter `lg` |
| Radii | `sm 8 · md 10 · lg 14 (cards, tiles) · xl 18 · pill` |
| Touch | min **48 dp** for anything tapped; buttons 48 / large 52; tiles 64 |
| Type | display 24/700 · title 20/700 · h2 17/600 · body 15/400 · bodyStrong 15/600 · small 13/400 · smallStrong 13/600 · caption 12/600 (uppercase labels) · metric 18/700 tabular |
| Colour | TURVIO palette from `@turvio/shared` (light) + `DARK` in `theme.ts`. Status: primary (in progress), success (done), warning (needs decision / estimate), danger (failed / invalid). Text on soft backgrounds uses the `*Ink` tones (≥ 4.5:1). |

Theme follows the system setting unless the driver picks light/dark in Settings.

## Components
- `Screen` – scroll container with keyboard avoidance and bottom safe-area padding; optional sticky `footer`.
- `BottomBar` – sticky footer for the screen's primary action, padded by the bottom inset (never under the 3-button bar or gesture handle).
- `Button` (`primary · secondary · ghost · danger · success`, sizes `sm 40 · md 48 · lg 52`), `ActionTile` (icon + label, 64 dp), `Card`, `Stat`, `Pill`, `Banner`, `Checkbox`, `Segmented`, `Sheet`, `EmptyState`, `StopCard`.

## Safe areas
- Expo Router provides the `SafeAreaProvider`; screens read `useSafeAreaInsets()`. No hard-coded system-bar padding.
- Tab bar: `height = 68 + insets.bottom`, `paddingBottom = insets.bottom + 6` – covers Android edge-to-edge with gesture *and* 3-button navigation and the iOS home indicator.
- Header-less screens (Today, Map, Login) pad `insets.top`; footers and the map pin-confirm button pad `insets.bottom`.
- Forms: `KeyboardAvoidingView` (`padding` on iOS, `height` on Android).

## Maps
The map is visualisation only (stops, route line, driver position, tap to inspect, pin to confirm an address); optimisation never depends on it.
- **Android:** Google Maps via `react-native-maps` (`PROVIDER_GOOGLE`). The key comes from the build environment variable `GOOGLE_MAPS_ANDROID_API_KEY` (EAS secret) – never committed. Without a key the build shows a "map not available" notice instead of an empty grey map; if tiles do not load within 15 s a load-failure notice is shown. Everything else keeps working.
- **iOS:** Apple Maps (`PROVIDER_DEFAULT`), no key needed.
- **Why the map was missing:** builds made without `GOOGLE_MAPS_ANDROID_API_KEY` have no `com.google.android.geo.API_KEY` in the manifest; Google Maps would crash, so the app shows "map not available" instead. A **native rebuild** with the key is required (it is baked into the APK; an OTA/JS update cannot add it).
- **Key setup** (Google Cloud, by the account owner):
  1. Project for TURVIO (billing account linked – Google requires it even though mobile dynamic map loads are free) → enable **Maps SDK for Android** only.
  2. *Credentials → Create API key* → *Application restrictions: Android apps* → add package `com.lunapact.turvio.driver.preview` with SHA-1 `85:F1:90:76:5C:02:88:0E:70:BE:73:36:AD:87:54:BF:97:6A:4C:1B`; *API restrictions:* Maps SDK for Android.
  3. expo.dev → project *turvio-driver* → Environment variables → environment **preview** → name `GOOGLE_MAPS_ANDROID_API_KEY`, visibility **Sensitive** (so local builds can pull it with `eas env:pull`; "Secret" works only for EAS cloud builds).
- **Signing:** the dedicated test keystore `turvio-preview` (SHA-1 above) is stored in EAS credentials as the default for `com.lunapact.turvio.driver.preview`; EAS cloud builds use it automatically. Local release builds use it when `TURVIO_ANDROID_KEYSTORE` / `TURVIO_ANDROID_KEYSTORE_PASSWORD` are set (`plugins/withReleaseSigning.js`), otherwise the public debug key – which the Maps key will (correctly) reject. Production (`com.lunapact.turvio.driver`) needs its own keystore / Play App Signing SHA-1 added to the key.
- **Build (local):** `eas env:pull --environment preview` → `APP_VARIANT=preview npx expo prebuild -p android --clean` → `./gradlew assembleRelease` with the signing variables set. **Build (cloud):** `eas build -p android --profile preview`.
