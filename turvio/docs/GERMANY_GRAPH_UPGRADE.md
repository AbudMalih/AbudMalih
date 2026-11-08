# Staging: 16 GB server + Germany routing graph (runbook, prepared 2026-11-07)

> **Status 2026-11-08:** server is a CPX42 (8 vCPU, 16 GB); release `845ecb7` is deployed; the
> archive is at `/home/turviodeploy/turvio-osrm-germany-2026-11-07.tar.gz`. Use **section 0**
> below (it supersedes sections 2–7 for the import). Rehearsed locally with the repository's own
> scripts (`deploy/staging/test/osrm-import-rehearsal.sh`): checksum, refusal of a wrong graph,
> import in ~1 min, 6/6 city checks, revert to Hannover, roll forward.

## 0. Import procedure (one step at a time, as `turviodeploy`)
The installed `/opt/turvio/bin/deploy` predates `--osrm-import`; the deployed release contains the
current script and its OSRM image contains import/switch/revert/check. Use the release's script:
`R=/opt/turvio/releases/$(cat /opt/turvio/state/current)/turvio/deploy/staging`.

| Step | Changes | Command |
|---|---|---|
| 1. Preflight | nothing | release, script support, checksum, disk, RAM, OSRM settings, current graph (`bash $R/deploy.sh --server-check`) |
| 2. Settings | `.env` (backup first) | `OSRM_MMAP=false`, `OSRM_MEM_LIMIT=6g` (Germany needs 4.8 GB RAM; 512 MB would fail the check and auto-revert) |
| 3. Import | OSRM volume, OSRM container | `bash $R/deploy.sh --osrm-import <archive> <sha256>` – verifies SHA-256, unpacks (~7.5 GB), checks META/OSRM version, switches, restarts only OSRM, runs the city check and switches back to Hannover by itself if a city fails |
| 4. Verify | nothing | `--osrm-check` (6 × OK), `--status`, `--server-check` (OSRM ≈ 4.8 GB), API health, `deploy/staging/smoke-cities.mjs` inside the API container (5 × OK) |
| Rollback | OSRM volume, `.env` | `bash $R/deploy.sh --osrm-revert` (Hannover graph is kept as "previous"), restore `.env` backup |

During step 3 only optimization and live ETA pause (~1 min, "road routing is not available");
GPS positions are still accepted. Known issue in the deployed image (fixed in the repository,
next deploy): a *refused* archive leaves its unpacked directory behind until the next switch.


Every step marked **APPROVAL** changes staging or costs money and is done only after the owner
has approved that individual step. Everything else is read-only or local to the owner's Mac.

What is affected, and what is not:
- **Database (Supabase, Frankfurt)**: not on the VPS – untouched by every step. Tours, accounts
  and recorded GPS positions stay where they are.
- **GPS ingestion** (`POST …/locations`) does not use OSRM. While OSRM restarts (~1 min) only
  optimization and live ETA pause ("road routing is not available") – never straight-line values.
- **Server off during the resize** (~5–10 min): the driver app keeps positions in its offline
  buffer and sends them afterwards; Dispatch shows the vehicle as delayed / no signal meanwhile.
  → Do the resize when no tour is in progress (Dispatch: no vehicle in "Live fleet").

Graph archive: `turvio-osrm-germany-2026-11-07.tar.gz`, 3,615,201,679 bytes,
SHA-256 `e227cd8f2b9da8aba44945e1b880d1370fd071bda0b56086e3322cb608aaa986`
(OSM 2026-11-06, OSRM v26.4.1 CH; city checks and benchmarks: ROUTE_OPTIMIZATION.md §4C).
Measured: load 26 s, peak 4.8 GB RAM → container limit 6 GB, no mmap.

## 1. Mac – download and verify (no server change)
Download the 9 parts (`…part-00` … `…part-08`) and `SHA256SUMS` into one folder, then:
```bash
cd ~/Downloads/turvio-graph
```
```bash
grep part- SHA256SUMS | shasum -a 256 -c -
```
All 9 lines must say `OK`. Join and verify the whole archive:
```bash
cat turvio-osrm-germany-2026-11-07.tar.gz.part-0* > turvio-osrm-germany-2026-11-07.tar.gz && shasum -a 256 turvio-osrm-germany-2026-11-07.tar.gz
```
Must print `e227cd8f2b9da8aba44945e1b880d1370fd071bda0b56086e3322cb608aaa986`.

## 2. Mac → VPS – copy the archive (no running service changes; uses ~3.6 GB of 46 GB free disk)
Use your normal admin SSH login (resumable with `rsync --partial`):
```bash
rsync --partial --progress turvio-osrm-germany-2026-11-07.tar.gz <admin>@62.238.106.34:/tmp/
```
On the VPS:
```bash
sudo install -d -o turviodeploy -g turviodeploy -m 700 /opt/turvio/osrm-import && sudo mv /tmp/turvio-osrm-germany-2026-11-07.tar.gz /opt/turvio/osrm-import/ && sudo chown turviodeploy: /opt/turvio/osrm-import/turvio-osrm-germany-2026-11-07.tar.gz
```
```bash
sha256sum /opt/turvio/osrm-import/turvio-osrm-germany-2026-11-07.tar.gz
```

## 3. Backup and baseline (read-only, plus one local copy of the config)
As `turviodeploy`:
```bash
/opt/turvio/bin/deploy --status; /opt/turvio/bin/deploy --server-check; /opt/turvio/bin/deploy --osrm-check
```
Keep the output (the "before" state). Config backup, stays on the server, root-only:
```bash
sudo tar -czf /root/turvio-config-2026-11-07.tgz /opt/turvio/.env /opt/turvio/state /opt/turvio/supabase-ca.crt && sudo chmod 600 /root/turvio-config-2026-11-07.tgz
```
**APPROVAL (small cost)** – Hetzner Console → server → Snapshots → Create snapshot. Billed per
GB per month until deleted (price shown in the console); delete it once the pilot is stable.

## 4. APPROVAL – resize to 16 GB (paid)
1. Dispatch: confirm no vehicle in "Live fleet" / no tour in progress.
2. Graceful shutdown on the VPS: `sudo poweroff` (stops rootless Docker cleanly).
3. Hetzner Console → server → Rescale → CX43 (8 vCPU, 16 GB). Choose **CPU and RAM only**
   (keeps the disk, so you can scale back). Check the final price, confirm, then Power on.
4. After boot, as `turviodeploy`:
```bash
free -g; nproc; systemctl --user is-active docker; /opt/turvio/bin/deploy --status
```
   Expected: ~15 GB total, 8 CPUs, `active`, all services healthy (they restart by themselves:
   linger is enabled and containers use `restart: unless-stopped`). If Docker is not active:
```bash
systemctl --user start docker && sleep 20 && /opt/turvio/bin/deploy --status
```
   If containers are still down after that:
```bash
docker start $(docker ps -aq --filter label=com.docker.compose.project=turvio-staging) && /opt/turvio/bin/deploy --status
```
5. Quick check before going on (still Hannover graph):
```bash
curl -s https://api.staging.turvio.online/health; curl -s -o /dev/null -w ' fleet/live:%{http_code}\n' https://api.staging.turvio.online/v1/orgs/x/fleet/live
```
   Expected `{"status":"ok"}` and `401`. Florin: start a test tour → Dispatch shows "Live".

## 5. APPROVAL – import the Germany graph
1. In `/opt/turvio/.env` set (edit with `nano`, keep mode 600):
   `OSRM_MMAP=false` and `OSRM_MEM_LIMIT=6g`. Do **not** run `--osrm-refresh` afterwards
   (that would rebuild on the server).
2. Import (verifies SHA-256, unpacks ~7.5 GB, restarts only OSRM, runs the city check and
   switches back to Hannover automatically if any city fails):
```bash
/opt/turvio/bin/deploy --osrm-import /opt/turvio/osrm-import/turvio-osrm-germany-2026-11-07.tar.gz e227cd8f2b9da8aba44945e1b880d1370fd071bda0b56086e3322cb608aaa986
```
   Expected at the end: six `OK` lines (Suhl, Hannover, Kassel, Bremen, Cologne, Suhl → Hannover)
   and `routing graph active and verified`.

## 6. Verification
```bash
/opt/turvio/bin/deploy --status; /opt/turvio/bin/deploy --server-check
```
`turvio-staging-osrm` ≈ 4.8 GB of 6 GB; META shows `REGION=germany`.
- **Dispatch**: a test tour in Kassel or Suhl → *Optimize* → preview only (do not apply):
  realistic km/min, no `routing_out_of_coverage`.
- **GPS**: Florin starts a tour → "Live" within 90 s; live ETA says
  "Road route from the current GPS position (OSRM)".
- Hannover tours: optimize preview works as before.

## 7. Rollback
- **Graph** (seconds, Hannover graph is kept as "previous"):
```bash
/opt/turvio/bin/deploy --osrm-revert
```
  then set `OSRM_MEM_LIMIT` back to its old value (from the config backup).
- **Server size**: Rescale back to the previous type (possible because the disk was not
  enlarged), or restore the snapshot.
- **Application**: the release (`74d0ab9…`) is not changed by any step; nothing to roll back.

## 8. Clean-up (after a few stable days)
Delete `/opt/turvio/osrm-import/*.tar.gz`, the Hetzner snapshot, and the parts on the Mac.
