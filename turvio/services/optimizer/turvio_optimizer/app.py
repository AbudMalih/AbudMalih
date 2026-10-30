"""HTTP API of the optimizer. Internal service: it is called by apps/api only
and must not be exposed publicly (no end-user authentication here)."""

from __future__ import annotations

from fastapi import FastAPI

from . import __version__
from .models import OptimizeRequest, OptimizeResponse
from .solver import solve

app = FastAPI(title="TURVIO Optimizer", version=__version__)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.post("/optimize", response_model=OptimizeResponse, response_model_by_alias=True)
def optimize(req: OptimizeRequest) -> OptimizeResponse:
    # Sync endpoint: FastAPI runs it in a worker thread, so the CPU-bound
    # solver does not block the event loop.
    return solve(req)
