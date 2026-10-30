"""Request/response models. Mirrors packages/shared/src/schemas.ts (OptimizeRequest/OptimizeResponse)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class _Model(BaseModel):
    # JSON uses camelCase (TypeScript side); Python uses snake_case.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class GeoPoint(_Model):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class TimeWindow(_Model):
    start: int = Field(ge=0, le=1439, description="Minutes since midnight")
    end: int = Field(ge=0, le=1439)

    @model_validator(mode="after")
    def _check(self) -> "TimeWindow":
        if self.end <= self.start:
            raise ValueError("Time window end must be after start")
        return self


class Vehicle(_Model):
    id: str = Field(min_length=1)
    start: GeoPoint
    end: Optional[GeoPoint] = None
    shift_start: int = Field(ge=0, le=1439)
    max_shift_minutes: int = Field(ge=1, le=24 * 60)
    capacity: Optional[int] = Field(default=None, ge=1)


class Stop(_Model):
    id: str = Field(min_length=1)
    location: GeoPoint
    service_seconds: int = Field(ge=0)
    time_window: Optional[TimeWindow] = None
    priority: bool = False
    demand: int = Field(default=1, ge=0)


class OptimizeRequest(_Model):
    vehicles: list[Vehicle] = Field(min_length=1, max_length=100)
    stops: list[Stop] = Field(min_length=1, max_length=2000)
    time_limit_seconds: int = Field(default=10, ge=1, le=120)

    @model_validator(mode="after")
    def _unique_ids(self) -> "OptimizeRequest":
        if len({s.id for s in self.stops}) != len(self.stops):
            raise ValueError("Stop ids must be unique")
        if len({v.id for v in self.vehicles}) != len(self.vehicles):
            raise ValueError("Vehicle ids must be unique")
        return self


class Visit(_Model):
    stop_id: str
    arrival_minute: float


class Route(_Model):
    vehicle_id: str
    visits: list[Visit]
    distance_meters: float
    duration_seconds: float


class OptimizeResponse(_Model):
    routes: list[Route]
    unassigned_stop_ids: list[str]
    matrix_source: Literal["osrm", "haversine_estimate"]
    # "feasible": a valid solution was found. OR-Tools' local search does not
    # prove optimality, so we never report "optimal".
    status: Literal["feasible", "no_solution"]
    engine: str
