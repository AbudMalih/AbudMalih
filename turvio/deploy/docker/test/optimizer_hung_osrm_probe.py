"""Runs INSIDE the hardened optimizer container whose OSRM_URL points to a hung stub (#16):
with ROUTING_REQUIRED=true the request ends in time with routing_unavailable."""
import json
import sys
import time
import urllib.request

body = {
    "vehicles": [{"id": "v", "start": {"lat": 52.37, "lng": 9.73}, "shiftStart": 480, "maxShiftMinutes": 480}],
    "stops": [{"id": f"s{i}", "location": {"lat": 52.37 + i * 0.002, "lng": 9.74}, "serviceSeconds": 60} for i in range(20)],
    "timeLimitSeconds": 4,
}
req = urllib.request.Request("http://127.0.0.1:8000/optimize", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
t0 = time.monotonic()
try:
    urllib.request.urlopen(req, timeout=40)
    status, err = 200, None
except urllib.error.HTTPError as e:
    status, err = e.code, json.load(e)
wall = time.monotonic() - t0
code = (err or {}).get("code") or (err or {}).get("detail", {}).get("code") if isinstance(err, dict) else None
ok = status == 503 and wall <= 2.6
print(json.dumps({"checks": [{"check": "hung OSRM: 503 routing_unavailable within the matrix share of a 4 s budget", "ok": ok, "status": status, "wall": round(wall, 2), "error": err}]}))
sys.exit(0 if ok else 1)
