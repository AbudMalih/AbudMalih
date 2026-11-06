# TURVIO – Germany-wide map data plan (routing + addresses)

## What is verified and what is not

| | Region Hannover | Germany |
|---|---|---|
| Source | BBBike city extract `Hannover.osm.pbf` (80 MB, data of 2026-10-31, MD5 checked) | Geofabrik `germany-latest.osm.pbf` (~4.5 GB, unverified size) |
| OSRM car graph | **built and used** (46 s; Hbf → Messe 11.8 km / 14.8 min) | **not done** |
| Addresses | **326,599 imported**, real-address queries tested | **not done** |
| Pilot | 7/7 checks on real roads ([report](pilot-report-2026-11-06-real-osm.json)) | – |

Details are in [HOSTING.md](HOSTING.md). Every figure for Germany below is an estimate until the first real run.

## 1. Data source

- **Geofabrik** (`https://download.geofabrik.de/europe/germany-latest.osm.pbf`, daily updates, with `.md5`): the standard source. From this cloud development environment the TLS connection is **reset upstream**. That is a limit of this environment, not of the plan.
- **Plan: download on the staging/production server itself** (`curl -fLO` + `md5sum -c`), never via a developer laptop.
- **BBBike** offers city extracts only (Hannover verified). It works for the pilot area but not for Germany.
- **Federal-state extracts** from Geofabrik (e.g. `niedersachsen-latest.osm.pbf`) are a middle step if JARBOU's area grows before Germany is needed.

## 2. Hardware (OSRM car profile)

| Pipeline | Prepare (extract + contract/partition) | Serve | Notes |
|---|---|---|---|
| **CH** (current: `osrm-routed --algorithm ch`) | ≥ 16 GB RAM, "Germany should fit into 16 GB" ([OSRM maintainer, 2018](https://lists.openstreetmap.org/pipermail/osrm-talk/2018-March/001658.html)); plan for 32 GB; disk ~3–4× the PBF | ~ size of the `.osrm*` files (rule of thumb from the [OSRM wiki](https://github.com/Project-OSRM/osrm-backend/wiki/Disk-and-Memory-Requirements)) ≈ 6–10 GB, unverified | Fastest for **distance matrices**, which the optimizer uses heavily |
| **MLD** | Similar RAM to extract; `partition` + `customize` instead of `contract`, faster to prepare | similar | Matrix queries are 2–3× slower than CH (same source); allows quick traffic updates. Not needed now |

**Recommendation:** keep CH. Prepare on a 32 GB machine, e.g. Hetzner CX53 or a dedicated server (see [STAGING_HOSTING_COMPARISON.md](STAGING_HOSTING_COMPARISON.md)), and serve from a machine with ≥ 16 GB. Preparation time is likely 30–90 minutes on 8–16 cores (estimate). Pin the OSRM version: the data files must be prepared and served by the same version.

## 3. Refresh (weekly routing, monthly addresses)

1. Download into a new folder `data/YYYY-MM-DD/` and check the MD5.
2. `osrm-extract -p car.lua` → `osrm-contract` (CH).
3. Start a **second** `osrm-routed` on another port (green) with the new data.
4. Health check on green:
   - `GET /nearest/v1/driving/9.73,52.37` returns `code: Ok`;
   - a known route (Hannover Hbf → Messe) stays within ±20 % of the previous run.
5. Switch: point `OSRM_URL`, or a Caddy/Compose service alias, to green, then reload the API and optimizer. Both already fall back to a labelled straight-line estimate on errors.
6. Keep the previous (blue) data for 7 days, then delete it.
7. If the health check fails, keep blue and alert.

## 4. Addresses (self-hosted geocoder)

| Step | Command / note |
|---|---|
| Extract | `python3 tools/osm_addresses.py germany-latest.osm.pbf > addresses.csv`. Includes nodes, buildings and multipolygon relations. Requires `addr:street`, `addr:housenumber`, a 5-digit `addr:postcode`, and `addr:city`/`addr:suburb` |
| Volume | Hannover gave 338k rows → Germany is **~20–30 M rows** (estimate). CSV ~2–3 GB; table plus 4 indexes ≈ **4–6 GB** (estimate) |
| Import | `npx tsx apps/api/src/scripts/import-addresses.ts addresses.csv --replace`. It runs in one transaction. Run it as the **table owner**, so `TRUNCATE` is used. The `turvio_service` role falls back to `DELETE`, which is much slower for 25 M rows. Hannover: 11 s for 326k rows, so Germany ≈ 15–25 min (estimate) |
| Supabase sizing | 4–6 GB exceeds the Free plan's database size, so **Germany-wide addresses need Supabase Pro** (or the geocoder on the self-hosted Postgres). Region Hannover (~60 MB) fits staging |
| Refresh | monthly; the import transaction keeps the old data visible until commit |

### Quality limits found with real data (Hannover)

- Some public buildings carry **no address in OSM**, e.g. Trammplatz 2 (Neues Rathaus). They give **no result**, and the driver or dispatcher sets the pin by hand. Coordinates are never invented.
- An unknown house number gives a **street-level** result. It is labelled as such and not used automatically in imports.
- ASCII spellings (`Strasse`, `Haeuser`), `str.` and missing postcodes are handled (migration `20261109000100_geocoder_spelling.sql`).
- OSM coverage varies by region. ☐ Measure the hit rate on JARBOU's real address list once that data may be used (authorisation needed).

## 5. Licence: ODbL

- Show **"© OpenStreetMap contributors"**, linked to `https://www.openstreetmap.org/copyright`, wherever routes or geocoded positions are displayed: Dispatch map, driver app map, and exports.
- The routing graph and the address table are derived databases. If they are shared outside Lunapact/JARBOU they must be offered under ODbL. Internal use only creates no sharing duty (☐ confirm with legal for the SaaS setting).
- Keep the download date and source per dataset in `data/YYYY-MM-DD/SOURCE.txt`.

## 6. Open items

- ☐ First Germany run on the server: record download size, preparation time, peak RAM and file sizes, and replace the estimates above.
- ☐ Choose where the geocoder table lives (Supabase Pro or self-hosted Postgres).
- ☐ Attribution text in all map views (check Dispatch and the driver app).
