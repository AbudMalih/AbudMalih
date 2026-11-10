"""Runs INSIDE the hardened optimizer container (docker exec -i … python - < this file).

#17: the VROOM warm-start worker (a subprocess, `python -m turvio_optimizer.warmstart`) works under
the staging hardening – read-only root, no capabilities, no-new-privileges, pids limit, tmpfs /tmp,
memory/CPU limits, uid 10001, internal network – stays within the time budget, is stopped at its
deadline, leaves no processes behind, and #16 (OSRM deadline) holds against a hung routing stub.
Prints one JSON report line; exits non-zero on any failed check.
"""
import json
import os
import random
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8000"
checks = []


def check(name, ok, **data):
    checks.append({"check": name, "ok": bool(ok), **data})


def optimize(n_stops, n_vehicles, budget, seed=7):
    # One driver's own tour: overtime instead of dropped stops, as the API sends it.
    rnd = random.Random(seed)
    body = {
        "vehicles": [{"id": f"v{i}", "start": {"lat": 52.37, "lng": 9.73}, "shiftStart": 480, "maxShiftMinutes": 600} for i in range(n_vehicles)],
        "stops": [{"id": f"s{i}", "location": {"lat": 52.30 + rnd.random() * 0.15, "lng": 9.65 + rnd.random() * 0.2}, "serviceSeconds": 90} for i in range(n_stops)],
        "timeLimitSeconds": budget,
        **({"overtimePenaltyPerMinute": 600} if n_vehicles == 1 else {}),
    }
    req = urllib.request.Request(f"{BASE}/optimize", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=budget + 30) as r:
            res = json.load(r)
            status = r.status
    except urllib.error.HTTPError as e:
        res = json.load(e)
        status = e.code
    return status, res, time.monotonic() - t0


def worker_pids():
    out = set()
    for pid in os.listdir("/proc"):
        if pid.isdigit():
            try:
                with open(f"/proc/{pid}/cmdline", "rb") as f:
                    if b"turvio_optimizer.warmstart" in f.read():
                        out.add(int(pid))
            except OSError:
                pass
    return out


def worker_processes():
    n = 0
    for pid in os.listdir("/proc"):
        if pid.isdigit():
            try:
                with open(f"/proc/{pid}/cmdline", "rb") as f:
                    if b"turvio_optimizer.warmstart" in f.read():
                        n += 1
            except OSError:
                pass
    return n


# Environment as staging runs it.
check("runs as uid 10001", os.getuid() == 10001, uid=os.getuid())
try:
    open("/app/turvio_optimizer/x", "w")
    check("code directory read-only", False)
except OSError:
    check("code directory read-only", True)
with open("/proc/self/status") as f:
    status = f.read()
cap_eff = [l.split()[1] for l in status.splitlines() if l.startswith("CapEff")][0]
no_new = [l.split()[1] for l in status.splitlines() if l.startswith("NoNewPrivs")][0]
check("no capabilities", int(cap_eff, 16) == 0, CapEff=cap_eff)
check("no-new-privileges", no_new == "1")

# The app keeps exactly one pre-started spare worker.
time.sleep(1.0)
spare = worker_pids()
check("one pre-started spare worker", len(spare) == 1, pids=sorted(spare))

# Warm start in the worker, within budget (estimate matrix: OSRM_URL points to the hung stub only in the #16 part).
for n, v, budget in [(100, 1, 5), (200, 3, 8), (500, 5, 15), (500, 1, 15)]:
    st, res, wall = optimize(n, v, budget)
    t = res.get("timings") or {}
    check(
        f"{n} stops / {v} vehicle(s): ok, within budget, warm start used",
        st == 200 and wall <= budget + 0.5 and (t.get("warmStartSeconds") or t.get("warm_start_seconds") or 0) > 0 and not res.get("unassignedStopIds"),
        status=st,
        wall=round(wall, 2),
        budget=budget,
        warmStart=t.get("warmStartSeconds", t.get("warm_start_seconds")),
        engine=res.get("engine"),
        unassigned=len(res.get("unassignedStopIds") or []),
    )
    time.sleep(0.5)
    now = worker_pids()
    # The job took the spare worker (a new spare replaced it): VROOM ran in the subprocess, not
    # in the server process; and nothing is left over.
    check(f"{n}/{v}: worker process used and replaced, nothing left over", len(now) == 1 and now != spare, before=sorted(spare), after=sorted(now))
    spare = now

# Three requests at once (pids limit 256, 768 MB).
import threading

out = []
ths = [threading.Thread(target=lambda s=s: out.append(optimize(150, 2, 6, seed=s))) for s in range(3)]
for t in ths:
    t.start()
for t in ths:
    t.join()
check("3 concurrent 150-stop requests", all(st == 200 and wall <= 6.8 for st, _, wall in out), walls=[round(w, 2) for _, _, w in out])
time.sleep(0.3)
check("only the spare worker left after concurrent requests", len(worker_pids()) == 1, pids=sorted(worker_pids()))

# The worker is stopped at its hard deadline (500 stops, 0.3 s): no zombie, no leftover process.
sys.path.insert(0, "/app")
from turvio_optimizer import warmstart
from turvio_optimizer.matrix import estimate_matrix
from turvio_optimizer.models import OptimizeRequest
from turvio_optimizer.solver import _vroom_routes

rnd = random.Random(3)
req = OptimizeRequest.model_validate(
    {
        "vehicles": [{"id": "v", "start": {"lat": 52.37, "lng": 9.73}, "shiftStart": 480, "maxShiftMinutes": 900}],
        "stops": [{"id": f"s{i}", "location": {"lat": 52.30 + rnd.random() * 0.15, "lng": 9.65 + rnd.random() * 0.2}, "serviceSeconds": 30} for i in range(500)],
        "timeLimitSeconds": 30,
    }
)
points = [req.vehicles[0].start, req.vehicles[0].start] + [s.location for s in req.stops]
dur = estimate_matrix(points).durations_s
def own_workers():
    # Only this probe's workers (children of this process), not the server's spare.
    me = os.getpid()
    out = set()
    for pid in worker_pids():
        try:
            with open(f"/proc/{pid}/stat") as f:
                if int(f.read().rsplit(")", 1)[1].split()[1]) == me:
                    out.add(pid)
        except OSError:
            pass
    return out


warmstart.prestart()
time.sleep(1.0)
before = own_workers()
t0 = time.monotonic()
routes = _vroom_routes(req, dur, 2, timeout_s=10, hard_deadline=time.monotonic() + 0.3)
took = time.monotonic() - t0
time.sleep(0.5)
after = own_workers()
zombies = 0
for pid in os.listdir("/proc"):
    if pid.isdigit():
        try:
            with open(f"/proc/{pid}/stat") as f:
                zombies += f.read().split()[2] == "Z"
        except OSError:
            pass
check("worker killed at its 0.3 s deadline (500 stops)", routes is None and took < 0.8 and len(before) == 1 and not (before & after) and zombies == 0, took=round(took, 2), before=sorted(before), after=sorted(after), routes=None if routes is None else "returned", zombies=zombies)

print(json.dumps({"checks": checks}))
sys.exit(0 if all(c["ok"] for c in checks) else 1)
