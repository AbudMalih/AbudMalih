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

### C. Germany-wide graph: Hannover, Kassel, Bremen, Suhl (built and tested locally 2026-11-07)
Graph: OSM Germany extract 2026-11-06 (GWDG mirror of Geofabrik, md5 `788ca110…`), OSRM v26.4.1
CH, car profile – the same binaries as the staging image. Not deployed anywhere yet.

| Step | Wall time | Peak memory | Output |
|---|---:|---:|---|
| extract (2 threads) | 32 min | 13.9 GB RSS + 5.5 GB swap (OOM-killed twice without swap) | |
| contract (4 threads) | 57 min | 8.0 GB | graph 7.5 GB on disk |
| serve, default (`osrm-routed`) | load 15 s | 4.8 GB RSS | |
| serve, `--mmap` | load 1 s | 0.8 GB idle, ~3 GB after a Flensburg–Konstanz route (file-backed, evictable) | |
| archive for `deploy.sh --osrm-import` | 3 min | | 3.6 GB `.tar.gz` |

City check (`deploy/staging/osrm/check.sh`): Suhl, Hannover, Kassel, Bremen, Cologne and
Suhl → Hannover (288.9 km, 207 min) all pass; München, Berlin and Flensburg → Konstanz
(987 km) route too. 100 × 100 matrices in all four cities: 0 zero-cost legs between different
addresses, 0 unroutable pairs, max snap 35–137 m, 0.12–0.19 s. Points outside Germany (Paris,
Vienna) snap 190–300 km away and are refused by the API (`OSRM_MAX_SNAP_METERS=1000` →
`routing_out_of_coverage`), never routed in a straight line.

Delivery tours (`BENCH_PICKUPS=0`), 3 tours per size, stops drawn from the **whole city**
(wider than one driver's district, so absolute km are high). Full tables:
`docs/benchmarks/{hannover,kassel,bremen,suhl}-germany-graph-2026-11-07.md`.

| City | Stops | Import order km | TURVIO km | TURVIO drive min | Saving | vs previous solver | Late / dropped | Runtime |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hannover | 80 | 845.8 | 171.8 | 330 | −73 % | −13.1 % drive | 0 / 0 | 9.7 s |
| Hannover | 100 | 1140.9 | 182.8 | 365 | −77 % | −12.4 % | 0 / 0 | 9.2 s |
| Kassel | 80 | 483.1 | 95.1 | 200 | −76 % | −16.1 % | 0 / 0 | 9.7 s |
| Kassel | 100 | 587.0 | 115.0 | 243 | −76 % | −18.3 % | 0 / 0 | 9.2 s |
| Bremen | 80 | 627.3 | 131.5 | 257 | −74 % | −16.4 % | 0 / 0 | 9.6 s |
| Bremen | 100 | 808.3 | 142.3 | 292 | −77 % | −18.0 % | 0 / 0 | 9.3 s |
| Suhl | 80 | 339.8 | 69.1 | 160 | −74 % | −15.8 % | 0 / 0 | 9.5 s |
| Suhl | 100 | 420.4 | 74.9 | 176 | −77 % | −19.5 % | 0 / 0 | 9.9 s |

TURVIO drives 0–2.3 % less than plain VROOM everywhere. "Nearest neighbour + 2-opt" is
between 2.4 % longer and 5.6 % shorter, but it ignores deadlines and is late at 3–6 stops per
tour, so it is not a valid alternative. Optimizer process peak memory:
154–156 MB for the whole run of 100-stop tours.

### D. Real-road regression checks (2026-11-08)
**Fixed defects (found by the 2026-11-08 audit and the new real-path test):**
1. *"End at last stop" was planned as a round trip.* The open end was modelled as a node at the
   start position with the real drive time back, so the order, distance and end time were those
   of a round trip. Now arcs into an open end cost nothing (`solver.py`); regression tests
   `test_open_end_*` fail on the old solver. Tours store the choice (`tours.end_mode`), so the road
   route and live ETA have no return leg either.
2. *Shown road route ≠ planned route.* `GET /tours/:id/route` and the live ETA used OSRM `route`
   with the car default `continue_straight=true` (no turning at a stop), the optimizer the `table`
   (any direction). On a 100-stop Hannover tour the shown route was +20 % km / +44 % time over
   the plan. Now `continue_straight=false`; route and plan agree within 0.1 % (OSRM's U-turn
   penalty).

**API integration test on real data** (`apps/api/test/integration/real-optimizer.test.ts`: API →
optimizer service → OSRM Germany graph; real OSM addresses, fixtures/osm-addresses.json; runs when
both services are up, skipped otherwise):

| Case | Import order | TURVIO | Independent baseline (NN + 2-opt/or-opt, same matrix) | Solve |
|---|---:|---:|---:|---:|
| Hannover 100 stops, back to depot | 193.2 km | 37.5 km, 95.3 min driving | 99.7 min (TURVIO −4.4 %) | 9.6 s |
| Same, end at last stop | – | 32.7 km, 86.1 min | 91.6 min (−6.0 %) | ~10 s |
| Suhl 80 stops, own start address, end at last stop (Kassel depot) | – | 65.6 km, 153.4 min | 157.2 min (−2.4 %) | ~10 s |
| Stop in Paris | refused: 422 `routing_out_of_coverage` (no straight-line fallback) | | | |

**Quality gate** (`services/optimizer/bench/run_quality_gate.sh`, checks in `bench/quality_gate.py`):
4 cities × 80/100 stops × back to depot / end at last stop, 2 tours each, whole-city stops with
express deadlines. Fails on any late/unplanned stop, > VROOM + 2 %, > 97 % of the previous solver,
> 50 % of the import order, or a solve over budget + 1.5 s. Result 2026-11-08: **passed**.

| City | End | Stops | Import km | TURVIO km | TURVIO drive min | vs VROOM | vs previous solver | TURVIO late / unplanned | Max solve s |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hannover | depot | 80 | 832 | 175.7 | 336 | -0.5 % | -13.3 % | 0 / 0 | 9.6 |
| Hannover | depot | 100 | 1127 | 186.4 | 373 | -0.9 % | -11.3 % | 0 / 0 | 9.9 |
| Kassel | depot | 80 | 495 | 98.9 | 206 | -1.4 % | -16.9 % | 0 / 0 | 9.6 |
| Kassel | depot | 100 | 585 | 117.7 | 251 | -0.3 % | -19.2 % | 0 / 0 | 10.0 |
| Bremen | depot | 80 | 618 | 135.8 | 263 | -2.6 % | -15.1 % | 0 / 0 | 9.6 |
| Bremen | depot | 100 | 772 | 139.9 | 288 | -3.1 % | -17.1 % | 0 / 0 | 9.9 |
| Suhl | depot | 80 | 327 | 69.3 | 160 | -1.2 % | -15.8 % | 0 / 0 | 9.5 |
| Suhl | depot | 100 | 412 | 75.5 | 178 | -1.9 % | -17.0 % | 0 / 0 | 9.7 |
| Hannover | last stop | 80 | 823 | 163.5 | 314 | -2.0 % | -15.9 % | 0 / 0 | 9.6 |
| Hannover | last stop | 100 | 1115 | 175.3 | 355 | -3.4 % | -13.5 % | 0 / 0 | 9.7 |
| Kassel | last stop | 80 | 487 | 94.7 | 198 | -1.0 % | -18.6 % | 0 / 0 | 9.5 |
| Kassel | last stop | 100 | 581 | 112.6 | 243 | -1.3 % | -21.1 % | 0 / 0 | 10.0 |
| Bremen | last stop | 80 | 609 | 132.3 | 254 | -1.1 % | -15.6 % | 0 / 0 | 9.5 |
| Bremen | last stop | 100 | 763 | 130.0 | 266 | -0.2 % | -20.9 % | 0 / 0 | 9.9 |
| Suhl | last stop | 80 | 324 | 65.3 | 152 | +0.0 % | -18.3 % | 0 / 0 | 9.5 |
| Suhl | last stop | 100 | 409 | 75.4 | 177 | -0.7 % | -16.7 % | 0 / 0 | 9.8 |

"Previous solver" for "last stop" includes the open-end defect (it drove back to the depot in its
plan). NN + 2-opt ignores deadlines: it is late at 2–6 stops per tour; TURVIO at none. Full tables:
`docs/benchmarks/*-gate-2026-11-08.md`.

### E. Time budget for the whole optimization (2026-11-10)
**Defect (route intelligence audit, 2026-11-09):** the time limit applied only to the OR-Tools search.
The VROOM warm start and the Python re-insertion of stops VROOM leaves out ran unbounded: a 500-stop
tour for one driver took 365 s against a 15 s budget (the API gives up after budget + 30 s → error).

**Now** one deadline covers matrix, warm start, re-insertion, search and response (`solver.py`):
- VROOM runs in a separate worker process (`warmstart.py`, `python -m turvio_optimizer.warmstart`,
  pickles over stdin/stdout, one process kept ready) and is stopped at its share of the budget (40 %);
  its own timeout is asked for less (construction overruns it). One driver with > 200 stops: VROOM
  timeout 3 s, exploration level 0 above 200 stops.
- Re-insertion: same choice as before (least lateness, then least extra driving, same ties) but
  visits positions in order of a lower bound and simulates only while a position can still win;
  checked against the old exhaustive implementation on 400 random instances with express deadlines
  and non-metric matrices (`tests/test_time_budget.py`). 500-stop tour: ~280 s → 0.2–0.4 s.
- OR-Tools gets exactly the remaining time. If it returns nothing in time, the warm start is
  returned only after validation (each stop once, capacity, strict windows, hard shift; re-inserted
  stops that break a hard constraint are taken out and reported unassigned; otherwise `no_solution`).
  If VROOM is not done in time, one driver's tour starts from nearest neighbour + exact re-insertion.
- Every result is checked to contain each requested stop exactly once (route or unassigned).
- Responses carry `timings` (matrix, warm start, re-insertion, search, total, budget).

**Before / after** (same Hannover OSRM graph, same tours, end to end incl. matrix; 4 vCPU):
| Tour | Budget | Before: time | After: time | Driving before → after | Late / unassigned after |
|---|---:|---:|---:|---:|---:|
| 80 stops dense, 3 tours | 10 s | 9.6–9.8 s | 9.9 s | identical (all 3) | 0 / 0 |
| 100 stops dense, 3 tours | 10 s | 9.1–9.5 s | 9.9 s | identical (all 3) | 0 / 0 |
| 80 stops suburban, 3 tours | 10 s | 9.5–9.7 s | 9.9 s | identical (all 3) | 0 / 0 |
| 100 stops suburban, 3 tours | 10 s | 9.2–9.5 s | 9.9 s | identical (all 3) | 0 / 0 |
| 200 stops, 1 driver | 15 s | 14.4 s | 14.9 s | 520.4 → 518.8 min (−0.3 %) | 0 / 0 |
| 500 stops, 1 driver | 15 s | **365 s** (API error) | **14.9 s** | 912.2 → 937.1 min (+2.7 %) | 23 late (same as before) / 0 |
| 500 stops, 5 drivers | 15 s | **25.4 s** | **14.9 s** | 890.3 → 917.8 min (+3.1 %) | 0 / 0 |
The 500-stop rows trade a few percent of driving for answering within the budget; a 30 s budget did
not improve them reliably (measured), so the API budgets (5/10/15 s) are unchanged.

## 5. Limits (stated, not hidden)
- **No traffic**: OSRM uses static road speeds. Rush-hour delays are not in the travel times.
- **Coverage**: staging still serves Region Hannover only. The Germany graph (section 4C) is
  built and tested but not imported – importing needs the owner's approval and a server with
  ≥ 6 GB free RAM (or `OSRM_MMAP=true`) and ~12 GB free disk during the switch.
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
1. **Road data for Germany**: the graph is prepared off-server (measured ~20 GB RAM incl. swap
   for extract), so the staging server only has to *serve* it (4.8 GB RAM, or <1 GB idle with
   `OSRM_MMAP=true`). Import with `deploy.sh --osrm-import FILE SHA256` needs approval.
2. **Traffic-aware travel times**: only via a paid data source (e.g. a commercial traffic API)
   or historical speed profiles. Not started.
3. **Time budget for very large tours**: 15 s above 150 stops (in use since 2026-11-07).
