# Route optimization – audit, engine and Hannover benchmark (2026-11-07)

The product goal: a driver imports 80–100 stops, presses **Optimize** and gets the best
practical order – real road times, deadlines respected, no backtracking, nothing hidden when a
constraint cannot be met. The map only *shows* the result; this document is about the result.

## 1. Audit of the previous engine (before 2026-11-07)
| Area | Finding |
|---|---|
| Engine | Google OR-Tools 9.15 (Apache-2.0), self-hosted Python service; parallel cheapest insertion + guided local search, time limit 5 s (≤60 stops) / 10 s |
| Travel times | Real road network: OSRM `table` matrix (BSD-2, self-hosted). Straight-line fallback only if routing is not required (staging: required) |
| Road data | OSRM extract covers **Region Hannover only** (≈52.07–52.67 N, 9.18–10.15 E; checked on a 0.2° grid). Not Lower Saxony, not Germany |
| Express | "As early as possible" cost per second for priority stops – pulled 12:00 parcels to the front and zig-zagged the tour |
| Deadlines / shift | Hard. A stop that could not be on time, or did not fit the shift, was **dropped** and silently appended at the end (real-OSM pilot report: 32 of 96 stops on one tour) |
| Pickup → delivery | Not modelled |
| Active tours | Re-optimizing a tour on the road changed it immediately, no preview, no version check |
| Benchmarks | None for route quality |

## 2. What changed
- **Objective**: road driving time + working time; no earliness cost (express = real deadline).
- **Deadlines** soft with a penalty far above any driving saving: an on-time order always wins
  when one exists; otherwise the stop is served late and **reported per stop with minutes**.
  `strictTimeWindows` keeps the old drop behaviour (multi-vehicle planning).
- **Shift**: a driver's own tour keeps every parcel; overtime is reported, never "solved" by dropping.
- **Pickup → delivery pairs** (same vehicle, pickup first).
- **Hybrid search** (default): VROOM 1.15 (BSD-2, `pyvroom`) builds the first routes on the
  same OSRM matrix (0.1–6 s), stops it cannot place on time are inserted where they cause the
  least lateness, then OR-Tools continues with the full model in the remaining budget (≤10 s).
- **Results** carry drive/service/wait time, finish time, per-stop lateness and a list of
  violations; dispatch and the driver app show them in plain words.
- **Re-optimization** of a tour on the road: preview first, explicit confirmation (dispatcher)
  or the driver's own button, version check; with live GPS the remaining route starts at the
  vehicle's real position.

## 3. Benchmark method (`services/optimizer/bench/hannover.py`)
- Stops: **real public OSM addresses** (© OpenStreetMap contributors, ODbL) in Hannover-List,
  Vahrenwald, Oststadt, Groß-Buchholz/Bothfeld (+ Nordstadt, Mitte for 150–200 stops); depot in
  the Hannover-Lahe commercial area (illustrative, not a company site). 3 tours per size (seeds 1–3).
- Realism: ~15 % of stops with 2–3 parcels (longer service), ~6 % second recipient in the same
  building, ~10 % express (deliver by 10:30 or 12:00), shift 08:00, 90 s service + 30 s per extra parcel.
- Travel times: **real OSRM matrix** (car profile, Region Hannover extract). No traffic.
- Every method scored by the **same evaluator** on the same matrix (driving, distance, arrival
  simulation with service/waiting, late stops, dropped stops, street re-entries).
- Hardware: this development container (4 vCPU). Times are wall-clock.
- Reproduce: `OSRM_URL=… .venv/bin/python -m bench.hannover [--sizes …] [--methods …]`;
  `BENCH_PICKUPS=0` for delivery-only tours. Raw results: `docs/benchmarks/*.json`.

## 4. Results
Averages over 3 tours per size. "Dropped" = stops the method left out (appended at the end for
the evaluation). Imported order = shuffled manifest order.

### A. Delivery tours with express deadlines

| Stops | Method | Runtime | Driving | Distance | Finish | Late stops | Dropped | Driving vs previous |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 25 | Imported order | 0.0 s | 166.0 min | 84.4 km | 11:24 | 0.0 | 0.0 | +103.8 % |
| 25 | NN + 2-opt/or-opt (deadline-blind) | 0.0 s | 76.8 min | 37.8 km | 09:55 | 0.0 | 0.0 | -5.7 % |
| 25 | VROOM 1.15 (independent, hard deadlines) | 0.1 s | 74.6 min | 35.1 km | 09:53 | 0.0 | 0.0 | -8.4 % |
| 25 | Previous TURVIO solver (10 s) | 5.0 s | 81.5 min | 35.3 km | 10:00 | 0.0 | 0.0 | – |
| 25 | New model, OR-Tools only (10 s) | 5.0 s | 74.6 min | 35.1 km | 09:53 | 0.0 | 0.0 | -8.4 % |
| 25 | New model, OR-Tools only (30 s) | 30.0 s | 74.6 min | 35.1 km | 09:53 | 0.0 | 0.0 | -8.4 % |
| 25 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 4.1 s | 74.6 min | 35.1 km | 09:53 | 0.0 | 0.0 | -8.4 % |
| 50 | Imported order | 0.0 s | 280.8 min | 134.6 km | 14:00 | 2.7 | 0.0 | +155.8 % |
| 50 | NN + 2-opt/or-opt (deadline-blind) | 0.3 s | 100.7 min | 45.7 km | 11:00 | 0.3 | 0.0 | -8.3 % |
| 50 | VROOM 1.15 (independent, hard deadlines) | 0.1 s | 97.2 min | 41.1 km | 10:57 | 0.0 | 0.0 | -11.5 % |
| 50 | Previous TURVIO solver (10 s) | 5.0 s | 109.8 min | 45.6 km | 11:09 | 0.0 | 0.0 | – |
| 50 | New model, OR-Tools only (10 s) | 5.0 s | 98.1 min | 41.7 km | 10:57 | 0.0 | 0.0 | -10.6 % |
| 50 | New model, OR-Tools only (30 s) | 30.0 s | 96.7 min | 40.9 km | 10:56 | 0.0 | 0.0 | -12.0 % |
| 50 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 4.1 s | 97.2 min | 41.1 km | 10:57 | 0.0 | 0.0 | -11.5 % |
| 80 | Imported order | 0.0 s | 449.6 min | 219.3 km | 17:37 | 5.7 | 0.0 | +222.2 % |
| 80 | NN + 2-opt/or-opt (deadline-blind) | 1.0 s | 118.8 min | 50.6 km | 12:06 | 2.3 | 0.0 | -14.9 % |
| 80 | VROOM 1.15 (independent, hard deadlines) | 0.6 s | 116.7 min | 46.0 km | 12:04 | 0.0 | 0.0 | -16.3 % |
| 80 | Previous TURVIO solver (10 s) | 10.0 s | 139.6 min | 57.6 km | 12:27 | 0.0 | 0.0 | – |
| 80 | New model, OR-Tools only (10 s) | 10.0 s | 118.2 min | 46.6 km | 12:06 | 0.0 | 0.0 | -15.3 % |
| 80 | New model, OR-Tools only (30 s) | 30.0 s | 117.3 min | 46.2 km | 12:05 | 0.0 | 0.0 | -16.0 % |
| 80 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.6 s | 116.6 min | 46.1 km | 12:04 | 0.0 | 0.0 | -16.4 % |
| 100 | Imported order | 0.0 s | 843.5 min | 437.5 km | 24:44 | 7.0 | 0.0 | +302.5 % |
| 100 | NN + 2-opt/or-opt (deadline-blind) | 1.8 s | 175.5 min | 69.7 km | 13:36 | 5.0 | 0.0 | -16.3 % |
| 100 | VROOM 1.15 (independent, hard deadlines) | 1.2 s | 178.5 min | 70.7 km | 13:39 | 0.0 | 0.0 | -14.8 % |
| 100 | Previous TURVIO solver (10 s) | 10.0 s | 209.6 min | 88.1 km | 14:10 | 0.0 | 0.0 | – |
| 100 | New model, OR-Tools only (10 s) | 10.0 s | 180.8 min | 72.0 km | 13:41 | 0.0 | 0.0 | -13.8 % |
| 100 | New model, OR-Tools only (30 s) | 30.0 s | 178.5 min | 71.1 km | 13:39 | 0.0 | 0.0 | -14.8 % |
| 100 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.3 s | 177.9 min | 70.6 km | 13:38 | 0.0 | 0.0 | -15.1 % |
| 150 | Imported order | 0.0 s | 1289.1 min | 689.3 km | 33:26 | 13.3 | 0.0 | +323.8 % |
| 150 | NN + 2-opt/or-opt (deadline-blind) | 11.3 s | 253.4 min | 104.1 km | 16:10 | 9.7 | 0.0 | -16.7 % |
| 150 | VROOM 1.15 (independent, hard deadlines) | 4.9 s | 261.9 min | 107.0 km | 16:19 | 0.0 | 0.0 | -13.9 % |
| 150 | Previous TURVIO solver (10 s) | 10.0 s | 304.2 min | 133.5 km | 17:01 | 0.0 | 0.0 | – |
| 150 | New model, OR-Tools only (10 s) | 10.0 s | 257.1 min | 104.6 km | 16:14 | 0.0 | 0.0 | -15.5 % |
| 150 | New model, OR-Tools only (30 s) | 30.0 s | 254.3 min | 102.0 km | 16:11 | 0.0 | 0.0 | -16.4 % |
| 150 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.6 s | 259.0 min | 105.3 km | 16:16 | 0.0 | 0.0 | -14.9 % |
| 200 | Imported order | 0.0 s | 1763.2 min | 957.9 km | 42:42 | 16.3 | 0.0 | +482.1 % |
| 200 | NN + 2-opt/or-opt (deadline-blind) | 29.5 s | 279.6 min | 111.8 km | 17:58 | 14.3 | 0.0 | -7.7 % |
| 200 | VROOM 1.15 (independent, hard deadlines) | 21.0 s | 360.3 min | 159.8 km | 19:19 | 0.3 | 6.0 | +18.9 % |
| 200 | Previous TURVIO solver (10 s) | 10.0 s | 302.9 min | 127.7 km | 17:58 | 0.0 | 14.7 | – |
| 200 | New model, OR-Tools only (10 s) | 10.0 s | 342.8 min | 145.7 km | 19:02 | 0.0 | 0.0 | +13.2 % |
| 200 | New model, OR-Tools only (30 s) | 30.0 s | 320.7 min | 133.6 km | 18:40 | 0.0 | 0.0 | +5.9 % |
| 200 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.5 s | 328.4 min | 138.6 km | 18:47 | 0.0 | 0.0 | +8.4 % |

### B. Delivery tours plus business pickups (window 14:00–17:00)

| Stops | Method | Runtime | Driving | Distance | Finish | Late stops | Dropped | Driving vs previous |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 10 | Imported order | 0.0 s | 69.0 min | 35.1 km | 09:24 | 0.0 | 0.0 | +32.4 % |
| 10 | Sorted by postcode/street | 0.0 s | 58.5 min | 26.5 km | 09:14 | 0.0 | 0.0 | +12.1 % |
| 10 | NN + 2-opt/or-opt (deadline-blind) | 0.0 s | 51.0 min | 27.4 km | 09:06 | 0.0 | 0.0 | -2.3 % |
| 10 | VROOM 1.15 (independent, hard deadlines) | 0.1 s | 49.9 min | 26.9 km | 09:05 | 0.0 | 0.0 | -4.2 % |
| 10 | Previous TURVIO solver (10 s) | 5.0 s | 52.1 min | 27.3 km | 09:07 | 0.0 | 0.0 | – |
| 10 | New model, OR-Tools only (10 s) | 5.0 s | 49.9 min | 26.9 km | 09:05 | 0.0 | 0.0 | -4.2 % |
| 10 | New model, OR-Tools only (30 s) | 30.0 s | 49.9 min | 26.9 km | 09:05 | 0.0 | 0.0 | -4.2 % |
| 25 | Imported order | 0.0 s | 167.2 min | 83.5 km | 15:12 | 0.3 | 0.0 | +91.2 % |
| 25 | Sorted by postcode/street | 0.0 s | 106.8 min | 48.7 km | 14:51 | 1.0 | 0.0 | +22.1 % |
| 25 | NN + 2-opt/or-opt (deadline-blind) | 0.0 s | 76.8 min | 37.8 km | 15:04 | 1.0 | 0.0 | -12.1 % |
| 25 | VROOM 1.15 (independent, hard deadlines) | 0.0 s | 76.4 min | 36.9 km | 14:24 | 0.0 | 0.0 | -12.7 % |
| 25 | Previous TURVIO solver (10 s) | 5.0 s | 87.5 min | 39.5 km | 14:20 | 0.0 | 0.0 | – |
| 25 | New model, OR-Tools only (10 s) | 5.0 s | 87.4 min | 39.5 km | 14:19 | 0.0 | 0.0 | -0.0 % |
| 25 | New model, OR-Tools only (30 s) | 30.0 s | 87.4 min | 39.5 km | 14:19 | 0.0 | 0.0 | -0.0 % |
| 25 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 4.3 s | 87.4 min | 39.5 km | 14:19 | 0.0 | 0.0 | -0.0 % |
| 50 | Imported order | 0.0 s | 288.7 min | 137.7 km | 17:17 | 3.0 | 0.0 | +139.3 % |
| 50 | Sorted by postcode/street | 0.0 s | 165.8 min | 73.2 km | 16:15 | 2.7 | 0.0 | +37.4 % |
| 50 | NN + 2-opt/or-opt (deadline-blind) | 0.2 s | 100.7 min | 45.7 km | 16:06 | 4.0 | 0.0 | -16.6 % |
| 50 | VROOM 1.15 (independent, hard deadlines) | 0.2 s | 100.7 min | 42.6 km | 14:52 | 0.0 | 0.0 | -16.5 % |
| 50 | Previous TURVIO solver (10 s) | 5.0 s | 120.7 min | 52.3 km | 14:23 | 0.0 | 0.0 | – |
| 50 | New model, OR-Tools only (10 s) | 5.0 s | 118.8 min | 54.6 km | 14:23 | 0.0 | 0.0 | -1.5 % |
| 50 | New model, OR-Tools only (30 s) | 30.0 s | 118.5 min | 52.7 km | 14:23 | 0.0 | 0.0 | -1.8 % |
| 50 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 4.3 s | 116.4 min | 52.3 km | 14:25 | 0.0 | 0.0 | -3.5 % |
| 80 | Imported order | 0.0 s | 432.9 min | 207.7 km | 21:04 | 8.7 | 0.0 | +184.1 % |
| 80 | Sorted by postcode/street | 0.0 s | 223.4 min | 97.3 km | 18:16 | 7.3 | 0.0 | +46.6 % |
| 80 | NN + 2-opt/or-opt (deadline-blind) | 1.2 s | 118.8 min | 50.6 km | 17:34 | 8.0 | 0.0 | -22.0 % |
| 80 | VROOM 1.15 (independent, hard deadlines) | 0.7 s | 119.6 min | 47.6 km | 15:17 | 0.0 | 0.0 | -21.5 % |
| 80 | Previous TURVIO solver (10 s) | 10.0 s | 152.4 min | 64.4 km | 14:28 | 0.0 | 0.0 | – |
| 80 | New model, OR-Tools only (10 s) | 10.0 s | 148.7 min | 62.2 km | 14:28 | 0.0 | 0.0 | -2.4 % |
| 80 | New model, OR-Tools only (30 s) | 30.0 s | 148.6 min | 62.2 km | 14:28 | 0.0 | 0.0 | -2.5 % |
| 80 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.6 s | 149.4 min | 61.7 km | 14:28 | 0.0 | 0.0 | -2.0 % |
| 100 | Imported order | 0.0 s | 883.2 min | 462.9 km | 27:58 | 9.7 | 0.0 | +289.7 % |
| 100 | Sorted by postcode/street | 0.0 s | 361.1 min | 169.2 km | 19:46 | 8.7 | 0.0 | +59.3 % |
| 100 | NN + 2-opt/or-opt (deadline-blind) | 1.8 s | 175.5 min | 69.7 km | 18:42 | 11.3 | 0.0 | -22.6 % |
| 100 | VROOM 1.15 (independent, hard deadlines) | 1.1 s | 183.0 min | 74.5 km | 15:50 | 0.0 | 0.0 | -19.2 % |
| 100 | Previous TURVIO solver (10 s) | 10.0 s | 226.6 min | 97.4 km | 14:38 | 0.0 | 0.0 | – |
| 100 | New model, OR-Tools only (10 s) | 10.0 s | 195.8 min | 81.5 km | 14:46 | 0.0 | 0.0 | -13.6 % |
| 100 | New model, OR-Tools only (30 s) | 30.0 s | 194.0 min | 80.5 km | 14:56 | 0.0 | 0.0 | -14.4 % |
| 100 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.5 s | 196.9 min | 81.8 km | 14:54 | 0.0 | 0.0 | -13.1 % |
| 150 | Imported order | 0.0 s | 1326.1 min | 712.8 km | 36:11 | 17.7 | 0.0 | +331.2 % |
| 150 | Sorted by postcode/street | 0.0 s | 510.2 min | 236.0 km | 24:18 | 15.7 | 0.0 | +65.9 % |
| 150 | NN + 2-opt/or-opt (deadline-blind) | 9.9 s | 253.4 min | 104.4 km | 21:23 | 17.7 | 0.0 | -17.6 % |
| 150 | VROOM 1.15 (independent, hard deadlines) | 5.4 s | 270.5 min | 113.1 km | 17:38 | 0.0 | 0.0 | -12.0 % |
| 150 | Previous TURVIO solver (10 s) | 10.0 s | 307.5 min | 133.9 km | 17:02 | 0.0 | 1.3 | – |
| 150 | New model, OR-Tools only (10 s) | 10.0 s | 279.2 min | 116.6 km | 16:41 | 0.0 | 0.0 | -9.2 % |
| 150 | New model, OR-Tools only (30 s) | 30.0 s | 269.3 min | 111.3 km | 16:43 | 0.0 | 0.0 | -12.4 % |
| 150 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.7 s | 275.7 min | 114.9 km | 16:34 | 0.0 | 0.0 | -10.3 % |
| 200 | Imported order | 0.0 s | 1705.2 min | 929.6 km | 46:26 | 26.3 | 0.0 | +453.7 % |
| 200 | Sorted by postcode/street | 0.0 s | 634.9 min | 293.4 km | 27:54 | 23.3 | 0.0 | +106.2 % |
| 200 | NN + 2-opt/or-opt (deadline-blind) | 30.2 s | 282.7 min | 114.0 km | 21:56 | 21.0 | 0.0 | -8.2 % |
| 200 | VROOM 1.15 (independent, hard deadlines) | 24.9 s | 406.4 min | 188.6 km | 20:06 | 2.7 | 9.0 | +32.0 % |
| 200 | Previous TURVIO solver (10 s) | 10.0 s | 308.0 min | 132.4 km | 17:57 | 0.0 | 17.7 | – |
| 200 | New model, OR-Tools only (10 s) | 10.0 s | 426.1 min | 185.9 km | 20:25 | 0.0 | 0.0 | +38.4 % |
| 200 | New model, OR-Tools only (30 s) | 30.0 s | 348.5 min | 146.7 km | 19:07 | 0.0 | 0.0 | +13.2 % |
| 200 | **TURVIO now: VROOM start + OR-Tools (≤10 s)** | 9.6 s | 351.1 min | 151.8 km | 19:10 | 0.0 | 0.0 | +14.0 % |


### Reading the results
- **vs the previous solver**: the current engine drives **8–16 % less on 25–150-stop delivery
  tours** (−8.4 % at 25, −16.4 % at 80, −14.9 % at 150) with the same zero deadline
  violations. At 200 stops it drives 8 % *more* – because the previous solver left on average
  15 of the 200 parcels out of the route (and then appended them unplanned); the current engine
  plans all 200.
- **vs an independent engine (VROOM)**: on delivery tours the current engine is equal at 25–100
  stops (±0.5 %) and better at 150 (−1.1 %) and 200 stops (−8.8 %), where VROOM alone also drops
  6 stops because its deadlines and shift are hard.
- **Deadline-blind local search** is shorter by a few percent but misses on average 0.3 (50
  stops) to 14 (200 stops) express deadlines per tour – that is the price of the deadlines,
  not a weakness of the solver.
- Scenario B shows a real trade-off: pickups opening at 14:00 cause waiting. TURVIO minimises
  driving *and* the working day; VROOM minimises driving only and finishes later (e.g. 100
  stops: 15:50 vs 14:56). At 200 stops with pickups the previous solver dropped 17.7 stops.
- Not proven optimal (no exact lower bound for 80–200 stops). OR-Tools alone with 30 s is
  between 0.6 % longer (80 stops) and 2.3 % shorter (200 stops) than the 10 s hybrid.

## 5. Limits (stated, not hidden)
- **No traffic**: OSRM uses static road speeds. Rush-hour delays are not in the travel times.
- **Coverage**: Region Hannover only. Stops outside are refused with a clear message.
- **Not tested** with real JARBOU tours yet (addresses are real, the tours are synthetic).
- Grouping: identical-building stops are always consecutive (0 split in all TURVIO runs);
  street re-entries at 150–200 stops are 5–9 per tour (district boundaries, deadlines).

## 6. Routing / optimization providers
| Option | Licence / cost model | Fit for TURVIO |
|---|---|---|
| **OR-Tools** (in use) | Apache-2.0, self-hosted, no fees | Full model (soft deadlines, overtime, pairs, capacity, multi-vehicle) |
| **VROOM** (in use, warm start) | BSD-2, self-hosted, no fees | Very fast, strong routes; hard deadlines only, no lateness reporting |
| **OSRM** (in use) | BSD-2, self-hosted | Fastest matrices; no traffic; Germany needs a larger server (below) |
| Valhalla | MIT, self-hosted | Alternative router with time-dependent speeds; slower matrices; not needed now |
| GraphHopper / jsprit | Apache-2.0 open source; commercial API paid | Comparable; no advantage over the current stack |
| Google Route Optimization API | Paid per optimized shipment (check current Google pricing); data processed by Google | Traffic-aware, but recurring cost per stop and personal data (addresses) leave the EU/own systems – not recommended for the core |

## 7. Decisions that need the owner (no cost incurred so far)
1. **Road data beyond Region Hannover** (Lower Saxony or Germany): self-hosted OSRM for Germany
   needs a server with substantially more RAM than the planned 4 GB staging server (CH
   preprocessing estimate in `deploy/staging/osrm/prepare.sh`: ~16 GB). This is a paid
   infrastructure change – please approve a size/provider (quote needed).
2. **Traffic-aware travel times**: only via a paid data source (e.g. a commercial traffic API)
   or historical speed profiles. Not started.
3. **Time budget for very large tours**: 10 s is the current limit; 150–200 stops benefit from
   15–20 s (measured +0–6 % with 30 s). Proposed: 15 s above 150 stops (no cost).
