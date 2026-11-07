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
- Tab bar: `height = 62 + insets.bottom`, `paddingBottom = insets.bottom + 8` – covers Android edge-to-edge with gesture *and* 3-button navigation and the iOS home indicator.
- Header-less screens (Today, Map, Login) pad `insets.top`; footers and the map pin-confirm button pad `insets.bottom`.
- Forms: `KeyboardAvoidingView` (`padding` on iOS, `height` on Android).

## Maps
The map is visualisation only (stops, route line, driver position, tap to inspect, pin to confirm an address); optimisation never depends on it.
- **Android:** Google Maps via `react-native-maps` (`PROVIDER_GOOGLE`). The key comes from the build environment variable `GOOGLE_MAPS_ANDROID_API_KEY` (EAS secret) – never committed. Without a key the build shows a "map not available" notice instead of an empty grey map; if tiles do not load within 15 s a load-failure notice is shown. Everything else keeps working.
- **iOS:** Apple Maps (`PROVIDER_DEFAULT`), no key needed.
- **Key setup** (Google Cloud, by the account owner):
  1. Project for TURVIO → enable *Maps SDK for Android* (only that API).
  2. Create an API key → *Application restrictions: Android apps* → package `com.lunapact.turvio.driver.preview` (and `com.lunapact.turvio.driver` for production) + the SHA-1 of the signing certificate that signs the APK; *API restrictions:* Maps SDK for Android.
  3. Store it as the EAS `preview` secret `GOOGLE_MAPS_ANDROID_API_KEY`; build with EAS (or `eas env:pull` before a local build).
- **Signing:** locally built test APKs are signed with the public React Native debug keystore. A key restricted to that SHA-1 offers no real protection, so production keys must be restricted to a dedicated keystore (EAS-managed, or the Play App Signing certificate).
