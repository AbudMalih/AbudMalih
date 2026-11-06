"""HTTP API of the optimizer. Internal service: it is called by apps/api only
and must not be exposed publicly (no end-user authentication here)."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import __version__
from .matrix import RoutingError
from .models import OptimizeRequest, OptimizeResponse
from .solver import solve

app = FastAPI(title="TURVIO Optimizer", version=__version__)


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
    return solve(req)
