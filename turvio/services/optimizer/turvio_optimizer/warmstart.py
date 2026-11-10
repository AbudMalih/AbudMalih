"""VROOM warm start in a separate process that is killed at its deadline.

VROOM's own `timeout` stops its search but not its construction heuristics: on one 500-stop
route these overran a 1 s timeout by 0.4–1 s on road matrices and by 5 s on straight-line ones
(measured 2026-11-10). A process can be stopped at any point, so the optimizer's time budget
holds whatever VROOM does.

Each job runs in a fresh `python -m turvio_optimizer.warmstart` process (job and result as pickles
over stdin/stdout, nothing on disk). One process is kept started in advance with VROOM already
imported, so a request normally does not pay the interpreter start-up; after each job a new one
is prepared in the background. Without worker processes the job runs in-process instead (VROOM's
own timeout only).
"""

from __future__ import annotations

import datetime
import os
import pickle
import subprocess
import sys
import threading
import time

_PKG_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LOCK = threading.Lock()
_IDLE: list[subprocess.Popen] = []
POOL_SIZE = 1


def solve_vroom(payload: dict) -> list[list[int]] | None:
    """The VROOM run itself. payload: plain lists only (no pydantic objects)."""
    import vroom  # type: ignore[import-not-found]

    p = vroom.Input()
    p.set_durations_matrix(profile="car", matrix_input=payload["durations"])
    p.add_vehicle(
        [
            vroom.Vehicle(v["id"], start=v["start"], end=v["end"], time_window=vroom.TimeWindow(*v["tw"]), **({"capacity": [v["capacity"]]} if v["capacity"] is not None else {}))
            for v in payload["vehicles"]
        ]
    )
    jobs = []
    for j in payload["jobs"]:
        kw: dict = {}
        if j["tw"] is not None:
            kw["time_windows"] = [vroom.TimeWindow(*j["tw"])]
        if j["delivery"] is not None:
            kw["delivery"] = [j["delivery"]]
        jobs.append(vroom.Job(j["id"], location=j["location"], default_service=j["service"], priority=j["priority"], **kw))
    p.add_job(jobs)
    kw_solve = {"timeout": datetime.timedelta(seconds=payload["timeout"])} if payload["timeout"] is not None else {}
    sol = p.solve(exploration_level=payload["level"], nb_threads=payload["threads"], **kw_solve)
    r = sol.routes
    routes: list[list[int]] = [[] for _ in payload["vehicles"]]
    for vid, typ, jid in zip(r["vehicle_id"].tolist(), r["type"].tolist(), r["id"].tolist()):
        if typ == "job":
            routes[int(vid) - 1].append(int(jid))
    return routes


def _spawn() -> subprocess.Popen:
    env = dict(os.environ)
    env["PYTHONPATH"] = _PKG_PARENT + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    env["PYTHONDONTWRITEBYTECODE"] = "1"  # read-only container file system
    return subprocess.Popen(
        [sys.executable, "-m", "turvio_optimizer.warmstart"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=env,
        cwd=_PKG_PARENT,
    )


def _refill() -> None:
    try:
        with _LOCK:
            missing = POOL_SIZE - sum(1 for p in _IDLE if p.poll() is None)
        for _ in range(max(0, missing)):
            proc = _spawn()
            with _LOCK:
                _IDLE.append(proc)
    except Exception:  # noqa: BLE001 – the next job starts its own process
        pass


def _take() -> subprocess.Popen:
    with _LOCK:
        while _IDLE:
            proc = _IDLE.pop()
            if proc.poll() is None:
                break
        else:
            proc = None
    threading.Thread(target=_refill, daemon=True).start()
    return proc if proc is not None else _spawn()


def run(payload: dict, hard_deadline: float) -> list[list[int]] | None:
    """VROOM routes (job ids per vehicle), or None when VROOM fails or is not finished by
    hard_deadline (time.monotonic()); the process is then killed and the caller continues."""
    try:
        proc = _take()
    except Exception:  # noqa: BLE001 – no worker processes possible: in-process, VROOM's own timeout
        try:
            return solve_vroom(payload)
        except Exception:  # noqa: BLE001
            return None
    try:
        out, _ = proc.communicate(pickle.dumps(payload, protocol=pickle.HIGHEST_PROTOCOL), timeout=max(0.01, hard_deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.communicate()
        return None
    except Exception:  # noqa: BLE001
        proc.kill()
        return None
    if proc.returncode != 0 or not out:
        return None
    try:
        result = pickle.loads(out)
    except Exception:  # noqa: BLE001
        return None
    return result if isinstance(result, list) else None


def prestart() -> None:
    """Prepare the first worker before the first request (app start-up)."""
    _refill()


def _main() -> None:  # pragma: no cover – runs in the worker process
    import vroom  # noqa: F401 – loaded before the job arrives

    payload = pickle.load(sys.stdin.buffer)
    try:
        result = solve_vroom(payload)
    except Exception:  # noqa: BLE001
        result = None
    sys.stdout.buffer.write(pickle.dumps(result, protocol=pickle.HIGHEST_PROTOCOL))
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    _main()
