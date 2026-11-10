"""Post-deployment probe, run INSIDE the staging optimizer container (stdlib only, read-only):

    docker exec -i turvio-staging-optimizer-1 python - < deploy/staging/test/staging-optimizer-probe.py

Synthetic stops only – nothing is stored, no tour is touched (the optimizer has no database).
Checks on the real staging OSRM graph: road matrix used (never straight-line), budget held,
nothing dropped, route durations equal OSRM's own road route for the same order (the basis of the
road-based ETA), concurrency, the spare-worker pool, and container memory.
"""

import json
import os
import random
import sys
import threading
import time
import urllib.parse
import urllib.request

OPT = "http://127.0.0.1:8000"
OSRM = os.environ.get("OSRM_URL", "http://osrm:5000")
CITIES = {  # centre (lat, lng), spread in degrees – street grid of each pilot city
    "Hannover": ((52.3759, 9.7320), (0.045, 0.075)),
    "Suhl": ((50.6096, 10.6930), (0.020, 0.030)),
    "Kassel": ((51.3127, 9.4797), (0.030, 0.045)),
    "Bremen": ((53.0793, 8.8017), (0.035, 0.060)),
    "Cologne": ((50.9375, 6.9603), (0.040, 0.060)),
}
results = []


def check(name, ok, **info):
    results.append({"check": name, "ok": bool(ok), **info})


def post(path, body, timeout=90):
    req = urllib.request.Request(OPT + path, data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    t = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r), time.monotonic() - t
    except urllib.error.HTTPError as e:
        return e.code, json.load(e), time.monotonic() - t


def request(city, n, vehicles, budget, seed):
    (lat, lng), (dlat, dlng) = CITIES[city]
    rnd = random.Random(seed)
    return {
        "vehicles": [{"id": f"v{i}", "start": {"lat": lat, "lng": lng}, "end": {"lat": lat, "lng": lng}, "shiftStart": 480, "maxShiftMinutes": 720} for i in range(vehicles)],
        "stops": [{"id": f"s{i}", "location": {"lat": lat + (rnd.random() - 0.5) * 2 * dlat, "lng": lng + (rnd.random() - 0.5) * 2 * dlng}, "serviceSeconds": 90} for i in range(n)],
        "timeLimitSeconds": budget,
        **({"overtimePenaltyPerMinute": 600} if vehicles == 1 else {}),
    }


def osrm_route_seconds(points):
    coords = ";".join(f"{p['lng']:.6f},{p['lat']:.6f}" for p in points)
    with urllib.request.urlopen(f"{OSRM}/route/v1/driving/{coords}?overview=false&continue_straight=false", timeout=30) as r:
        d = json.load(r)
    return d["routes"][0]["duration"], d["routes"][0]["distance"]


def workers():
    n = 0
    for pid in os.listdir("/proc"):
        if pid.isdigit():
            try:
                with open(f"/proc/{pid}/cmdline", "rb") as f:
                    n += b"turvio_optimizer.warmstart" in f.read()
            except OSError:
                pass
    return n


def mem_mb():
    for p in ("/sys/fs/cgroup/memory.current", "/sys/fs/cgroup/memory/memory.usage_in_bytes"):
        try:
            with open(p) as f:
                return round(int(f.read()) / 2**20)
        except OSError:
            pass
    return None


def scenario(city, n, v, budget, seed, eta=False):
    body = request(city, n, v, budget, seed)
    st, out, wall = post("/optimize", body)
    t = out.get("timings", {}) if isinstance(out, dict) else {}
    ok = st == 200 and out.get("matrixSource") == "osrm" and not out.get("unassignedStopIds") and wall <= budget + 1.5
    check(f"{city} {n} stops / {v} vehicle(s), budget {budget}s", ok, status=st, wall=round(wall, 2), matrixSource=out.get("matrixSource"),
          matrixS=t.get("matrixSeconds"), warmStartS=t.get("warmStartSeconds"), unassigned=len(out.get("unassignedStopIds", []) or []),
          km=round(sum(r["distanceMeters"] for r in out.get("routes", [])) / 1000, 1) if st == 200 else None,
          error=None if st == 200 else str(out)[:200])
    if eta and st == 200:
        # The driving time of the planned order must equal OSRM's own road route for that order.
        r = max(out["routes"], key=lambda x: len(x["visits"]))
        loc = {s["id"]: s["location"] for s in body["stops"]}
        start = body["vehicles"][0]["start"]
        pts = [start] + [loc[x["stopId"]] for x in r["visits"]] + [start]
        legs = [pts[i:i + 25] for i in range(0, len(pts) - 1, 24)]  # OSRM route requests in parts
        osrm_s = sum(osrm_route_seconds(seg)[0] for seg in legs if len(seg) > 1)
        diff = abs(r["driveSeconds"] - osrm_s) / max(osrm_s, 1)
        check(f"{city}: planned driving time = OSRM road route (ETA basis)", diff <= 0.02, plannedDriveMin=round(r["driveSeconds"] / 60, 1),
              osrmRouteMin=round(osrm_s / 60, 1), diffPct=round(diff * 100, 2))
        mins = [x["arrivalMinute"] for x in r["visits"]]
        check(f"{city}: ETAs increase along the route, start 08:00", all(b >= a for a, b in zip(mins, mins[1:])) and mins[0] >= 480,
              first=round(mins[0], 1), last=round(mins[-1], 1))


health = json.load(urllib.request.urlopen(OPT + "/health", timeout=10))
check("optimizer health", health.get("status") == "ok", **health)
check("spare worker pool: one idle worker", workers() == 1, workers=workers())
check("memory before", True, mb=mem_mb())

scenario("Hannover", 100, 1, 10, 11, eta=True)
scenario("Hannover", 500, 5, 15, 12)
scenario("Hannover", 500, 1, 15, 13)
for i, c in enumerate(["Suhl", "Kassel", "Bremen", "Cologne"]):
    scenario(c, 60, 1, 5, 20 + i, eta=(c == "Suhl"))

walls = []
def one(seed):
    st, out, w = post("/optimize", request("Hannover", 150, 2, 10, seed))
    walls.append((st, round(w, 2), out.get("matrixSource") if isinstance(out, dict) else None))
th = [threading.Thread(target=one, args=(40 + i,)) for i in range(3)]
[t.start() for t in th]
[t.join() for t in th]
check("3 concurrent 150-stop requests", all(s == 200 and w <= 11.5 and m == "osrm" for s, w, m in walls), results=walls)

time.sleep(2)
check("spare worker pool after load: one idle worker", workers() == 1, workers=workers())
mb = mem_mb()
check("memory after load (limit 768 MB)", mb is None or mb < 700, mb=mb)

print(json.dumps({"ok": all(r["ok"] for r in results), "checks": results}))
sys.exit(0 if all(r["ok"] for r in results) else 1)
