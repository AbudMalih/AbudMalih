"""HTTP API of the optimizer. Internal service: it is called by apps/api only
and must not be exposed publicly (no end-user authentication here)."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import __version__
from .matrix import RoutingError
from .models import OptimizeRequest, OptimizeResponse
from .solver import solve

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # The first VROOM worker process (warmstart.py) starts here, not inside the first request's budget.
    from . import warmstart

    warmstart.prestart()
    yield


app = FastAPI(title="TURVIO Optimizer", version=__version__, lifespan=lifespan)


@app.exception_handler(RoutingError)
def routing_error(_req: Request, e: RoutingError) -> JSONResponse:
    # 422: the request's locations cannot be routed; 503: the routing service is down/missing.
    status = 422 if e.code in ("routing_out_of_coverage", "routing_degenerate") else 503
    return JSONResponse(status_code=status, content={"detail": {"code": e.code, "message": e.message, "points": e.points}})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.post("/optimize", response_model=OptimizeResponse, response_model_by_alias=True)
def optimize(req: OptimizeRequest) -> OptimizeResponse:
    # Sync endpoint: FastAPI runs it in a worker thread, so the CPU-bound
    # solver does not block the event loop.
    # The time budget counts from here (request parsed) to the response.
    return solve(req, started_at=time.monotonic())
