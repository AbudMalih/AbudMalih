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
    # Start: earliest service (the driver waits if early). End: deadline – see
    # OptimizeRequest.strict_time_windows for how a deadline that cannot be met is handled.
    time_window: Optional[TimeWindow] = None
    priority: bool = False
    demand: int = Field(default=1, ge=0)


class PickupDelivery(_Model):
    """The pickup must be served before the delivery, by the same vehicle."""

    pickup_id: str = Field(min_length=1)
    delivery_id: str = Field(min_length=1)


class OptimizeRequest(_Model):
    vehicles: list[Vehicle] = Field(min_length=1, max_length=100)
    stops: list[Stop] = Field(min_length=1, max_length=2000)
    time_limit_seconds: int = Field(default=10, ge=1, le=120)
    pickup_deliveries: list[PickupDelivery] = Field(default_factory=list, max_length=1000)
    # False (default): a deadline that cannot be met is served late (heavily penalised) and
    # reported in `violations`. True: such a stop is dropped (unassigned) instead.
    strict_time_windows: bool = False
    # None: the shift length is a hard limit (stops that do not fit become unassigned – used
    # for multi-vehicle planning). A number: the shift may be exceeded at this cost per minute,
    # every stop stays on the route and the overtime is reported (single driver's own tour).
    overtime_penalty_per_minute: Optional[int] = Field(default=None, ge=0, le=100_000)

    @model_validator(mode="after")
    def _unique_ids(self) -> "OptimizeRequest":
        ids = {s.id for s in self.stops}
        if len(ids) != len(self.stops):
            raise ValueError("Stop ids must be unique")
        if len({v.id for v in self.vehicles}) != len(self.vehicles):
            raise ValueError("Vehicle ids must be unique")
        seen: set[str] = set()
        for pd in self.pickup_deliveries:
            if pd.pickup_id not in ids or pd.delivery_id not in ids or pd.pickup_id == pd.delivery_id:
                raise ValueError("pickup_deliveries must reference two different existing stops")
            if pd.pickup_id in seen or pd.delivery_id in seen:
                raise ValueError("A stop can be part of only one pickup/delivery pair")
            seen.update((pd.pickup_id, pd.delivery_id))
        return self


class Visit(_Model):
    stop_id: str
    # Planned service start (after waiting for the window to open) – unchanged meaning.
    arrival_minute: float
    # When the vehicle physically gets there (≤ arrival_minute; earlier = waiting).
    travel_arrival_minute: Optional[float] = None
    # Minutes after the stop's deadline (0 when on time or no deadline).
    late_minutes: float = 0


class Route(_Model):
    vehicle_id: str
    visits: list[Visit]
    distance_meters: float
    # Start of the shift to arrival back at the end point (driving + service + waiting).
    duration_seconds: float
    drive_seconds: float = 0
    service_seconds: float = 0
    wait_seconds: float = 0
    start_minute: Optional[float] = None
    end_minute: Optional[float] = None
    overtime_minutes: float = 0


class Violation(_Model):
    """Why the plan is not fully within the constraints – shown to the driver/dispatcher."""

    kind: Literal["late", "overtime", "unassigned_unreachable", "unassigned_infeasible", "pair_split"]
    stop_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    minutes: Optional[float] = None


class Timings(_Model):
    """Where the time budget went (seconds). total ≤ budget except when the road matrix alone
    takes longer (OSRM) – measured end to end inside the optimizer."""

    budget_seconds: float
    matrix_seconds: float
    warm_start_seconds: float
    reinsertion_seconds: float
    search_seconds: float
    total_seconds: float
    # Out of re-insertion time: remaining left-out stops went to their cheapest position.
    reinsertion_truncated: bool = False
    # The search returned nothing in time: the validated warm start is the result.
    warm_start_fallback: bool = False


class OptimizeResponse(_Model):
    routes: list[Route]
    unassigned_stop_ids: list[str]
    matrix_source: Literal["osrm", "haversine_estimate"]
    # Set when OSRM is configured but failed and the estimate was used instead.
    matrix_note: str | None = None
    # "feasible": a valid solution was found. OR-Tools' local search does not
    # prove optimality, so we never report "optimal".
    status: Literal["feasible", "no_solution"]
    engine: str
    # Empty when every stop is served on time within the shift.
    violations: list[Violation] = Field(default_factory=list)
    solve_seconds: Optional[float] = None
    timings: Optional[Timings] = None
