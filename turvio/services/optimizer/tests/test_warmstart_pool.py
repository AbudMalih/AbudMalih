"""The pre-started worker pool keeps exactly POOL_SIZE idle workers, also under concurrent requests
(#17: three concurrent requests used to leave three idle VROOM workers in the 768 MB container)."""

from __future__ import annotations

import threading
import time

import pytest
from turvio_optimizer import warmstart


class FakeProc:
    def __init__(self) -> None:
        self.alive = True

    def poll(self):
        return None if self.alive else 0


@pytest.fixture()
def pool(monkeypatch):
    spawned: list[FakeProc] = []

    def slow_spawn():
        time.sleep(0.05)  # widen the race window between deciding and starting
        p = FakeProc()
        spawned.append(p)
        return p

    monkeypatch.setattr(warmstart, "_spawn", slow_spawn)
    monkeypatch.setattr(warmstart, "_IDLE", [])
    monkeypatch.setattr(warmstart, "_STARTING", 0, raising=False)
    return spawned


def _settle():
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline and (warmstart._STARTING or threading.active_count() > 1 and any(t.daemon for t in threading.enumerate())):
        time.sleep(0.02)
    time.sleep(0.1)


def test_concurrent_takes_do_not_overshoot_the_pool(pool):
    warmstart.prestart()
    assert len(warmstart._IDLE) == warmstart.POOL_SIZE
    taken: list = []
    threads = [threading.Thread(target=lambda: taken.append(warmstart._take())) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    _settle()
    assert len(taken) == 5
    assert len(warmstart._IDLE) == warmstart.POOL_SIZE
    assert warmstart._STARTING == 0


def test_dead_spares_are_replaced_and_dropped(pool):
    warmstart.prestart()
    warmstart._IDLE[0].alive = False
    warmstart._refill()
    assert len(warmstart._IDLE) == warmstart.POOL_SIZE and all(p.alive for p in warmstart._IDLE)


def test_failed_spawn_does_not_leak_the_starting_count(monkeypatch, pool):
    def broken():
        raise OSError("pids limit")

    monkeypatch.setattr(warmstart, "_spawn", broken)
    warmstart._refill()
    assert warmstart._STARTING == 0 and warmstart._IDLE == []
