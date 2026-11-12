# TURVIO Driver – Android real-device test (staging pilot)

**Build:** EAS `preview` build `815c945f` (commit 86b06e9) – staging API, internal distribution.
Install from https://expo.dev/accounts/lunapact-technologies/projects/turvio-driver/builds/815c945f-31ed-4b20-b5d4-ed6fc5de353f
(open on the phone → *Install*; allow "install unknown apps" for the browser once). It has the same version code (2)
as the previous test build: if Android refuses the update, uninstall the old TURVIO Driver first.

**Data:** synthetic only. Dispatch creates the test tour (QA driver account, `QA-…` tour name, fictional
recipients, public addresses – the staging smoke test `e2e/staging-smoke.mjs` creates such a tour). Never
scan or enter real customer parcels in this test.

**Record per run:** phone model · Android version · date · tester · build id · pass/fail + note/screenshot per line.

## A. Install, sign-in, permissions

| # | Check | Pass |
|---|---|---|
| A1 | App installs and starts (splash, then sign-in) | ☐ |
| A2 | Sign in with the QA driver account; today's synthetic tour appears | ☐ |
| A3 | Camera permission prompt appears on first scan, text is understandable (de) | ☐ |
| A4 | Location "while using" prompt appears when the map/tour needs it | ☐ |
| A5 | Language switch de → en → ro → ar; Arabic shows right-to-left after the restart prompt | ☐ |
| A6 | Close and reopen the app: still signed in, tour still there | ☐ |

## B. Tour work

| # | Check | Pass |
|---|---|---|
| B1 | Map shows all stops and the route; next stop highlighted; 25+ stops scroll smoothly | ☐ |
| B2 | "Start tour" → Dispatch shows the tour *in progress* within 1 minute | ☐ |
| B3 | Navigation hand-off opens Google Maps at the stop (and Waze if installed) | ☐ |
| B4 | Deliver without proof → next stop appears; *Undo* works | ☐ |
| B5 | Deliver with photo proof → photo visible in Dispatch | ☐ |
| B6 | Signature proof → visible in Dispatch | ☐ |
| B7 | Failed delivery with a reason + note → reason and note visible in Dispatch | ☐ |
| B8 | Driver optimizes the remaining stops → result says "road network"; order changes only after confirming | ☐ |

## C. Scanning and labels (synthetic labels only)

| # | Check | Pass |
|---|---|---|
| C1 | Continuous scan of 10 printed test barcodes (TVOQA…): each beeps/vibrates once | ☐ |
| C2 | Same barcode twice → flagged as duplicate, not added twice | ☐ |
| C3 | Unknown code → offered as new stop/parcel | ☐ |
| C4 | Label photo (printed synthetic label with address + code): address and tracking number recognised; fields needing review are marked | ☐ |
| C5 | Poor light / angled label: app asks for review instead of guessing | ☐ |

## D. Personal routes and imports

| # | Check | Pass |
|---|---|---|
| D1 | New route (+ "New route") → date shown is **today's company date**, route appears under Today | ☐ |
| D2 | Import pasted stops into that route → stops land in **that** route (not in the running tour) | ☐ |
| D3 | D1+D2 again with the phone set to another time zone (Settings → time zone, e.g. New York) | ☐ |

## E. Offline and sync

| # | Check | Pass |
|---|---|---|
| E1 | Airplane mode → deliver 3 stops (one with photo) → app shows queued changes | ☐ |
| E2 | Airplane mode off → everything syncs once, in order; Dispatch shows all 3, no duplicates | ☐ |
| E3 | Kill the app while offline with queued changes → reopen online → changes still sent | ☐ |

## F. Location and background (only if live tracking is enabled for the company)

| # | Check | Pass |
|---|---|---|
| F1 | Tracking notice shown and acknowledged before any position is sent | ☐ |
| F2 | Dispatch live map shows the vehicle within ~1 min of starting the tour | ☐ |
| F3 | Screen off / other app in front for 15 min while driving → positions keep arriving | ☐ |
| F4 | Tour completed → tracking stops (no more positions in Dispatch) | ☐ |
| F5 | Battery use after a 1-hour test drive noted (Settings → Battery) | ☐ |

## G. Robustness

| # | Check | Pass |
|---|---|---|
| G1 | Small screen (≈5.5") and large font setting: nothing cut off on Today, Stop, Scan | ☐ |
| G2 | Rotate / split screen does not lose data | ☐ |
| G3 | App resumes and syncs after hours in the background | ☐ |

Report failures with the screen, the steps and – for server errors – the `Ref req-…` shown in Dispatch.
