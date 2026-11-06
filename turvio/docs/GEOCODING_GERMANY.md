# Germany-wide geocoding – options and recommendation (2026-11-06)

**Goal.** Exact address → map position for stops entered by drivers (typing, photo or screenshot) anywhere in Germany. Coordinates are never invented:
- an exact house match is applied automatically;
- a street-level match needs the driver's confirmation;
- anything else needs a pin.

**Current state.**
- TURVIO has a self-hosted geocoder (`GEOCODER=postgres`, table `geo.addresses`, OSM data). It was verified with 326,599 real addresses for Region Hannover; see HOSTING.md.
- On staging it is **off** (`GEOCODER=none`), so drivers set pins by hand.
- Germany-wide data is estimated at 20–30 M rows and 4–6 GB including indexes (MAP_DATA_PLAN.md). That does not fit the Supabase Free plan.

## Options

| Option | Monthly cost | Data protection | Notes |
|---|---|---|---|
| **A. Self-hosted geocoder in its own Postgres on the staging VPS** (`GEOCODER_DATABASE_URL`, new) | **€0 extra**; ~6–10 GB disk on the existing VPS | data stays on our server; OSM (ODbL, attribution) | same code as today; import prepared offline like the OSRM graph; monthly refresh |
| B. Same data inside Supabase (Pro plan) | $25 / month for Pro, 8 GB disk included, then $0.125 / GB ([Supabase pricing](https://supabase.com/pricing)) | EU (Frankfurt) | simplest operations; 4–6 GB of addresses uses most of the included disk |
| C. Geoapify API (German company, OSM-based) | free 3,000 requests/day, "limited commercial use"; paid from ~$59 / month ([Geoapify pricing](https://geoapify.com/pricing)) | DPA required; external processor | no hosting; quota and terms must be checked for production use |
| D. HERE Geocoding | free quota reported differently by sources (1,000/day vs. 250k/month) ([HERE pricing](https://developer.here.com/pricing)) | DPA required | storage terms for results must be confirmed with HERE |
| E. Google Geocoding | pay per request; results may not be stored permanently | US processor | not recommended (cost, storage restrictions) |
| F. Photon / Nominatim self-hosted | €0 software; Nominatim import for Germany needs much more RAM than the VPS has | own server | fuzzy search; heavier than A for our exact-match use |

**Recommendation: A**, with C as an optional later fallback for addresses missing in OSM, only after approval and a DPA.
- It is free, keeps addresses on our own server, and reuses tested code: the exact-match API and the normalisation of "Str."/"Straße", umlauts and ASCII spellings.
- The VPS needs ~6–10 GB more disk. Queries are indexed lookups, so 4 GB RAM is enough. This is an estimate; measure after the import.
- **Not yet built:** the extra `geodb` container (Postgres with the `geo` schema) and its import job are not in `compose.yml`. They are the next step after your approval.
- **Ready now:** the API side. With `GEOCODER=postgres` and `GEOCODER_DATABASE_URL=postgres://…/geo`, address search and the photo import's automatic positions use that database.

**Coverage limits (all OSM-based options).**
- Some buildings have no address in OSM, e.g. Trammplatz 2 in Hannover. Those give no result and the driver sets the pin.
- A street-level match is never treated as a house position.

Prices were checked on 2026-11-06; third-party figures are marked in the sources. **Nothing has been purchased or upgraded.**
