import type { OptimizeMeta } from "./store";

/** Constraint problems of an optimization, in plain words (never hidden behind "optimized"). */
export function optimizeProblems(r: OptimizeMeta): string[] {
  const v = r.violations ?? [];
  const late = v.filter((x) => x.kind === "late");
  const overtime = v.find((x) => x.kind === "overtime");
  const unreachable = v.filter((x) => x.kind === "unassigned_unreachable").length;
  const infeasible = v.filter((x) => x.kind === "unassigned_infeasible").length;
  return [
    late.length ? `${late.length} stop(s) cannot be reached before their deadline (up to ${Math.round(Math.max(...late.map((x) => x.minutes ?? 0)))} min late)` : null,
    overtime ? `Tour runs ${Math.round(overtime.minutes ?? 0)} min past the driver's shift` : null,
    unreachable ? `${unreachable} stop(s) cannot be reached by road – kept at the end, check the address` : null,
    infeasible ? `${infeasible} stop(s) could not be scheduled – kept at the end` : null,
    r.locationErrors?.length ? `${r.locationErrors.length} stop(s) with a wrong or unreachable location were not optimized – kept at the end, check their location` : null,
    // Older optimizer responses without violation details.
    !v.length && r.unassignedStopIds.length ? `${r.unassignedStopIds.length} stop(s) could not be scheduled within windows/shift` : null,
  ].filter((x): x is string => !!x);
}

export function optimizeNotes(r: OptimizeMeta): string[] {
  return [
    r.matrixSource === "osrm" ? "road-network travel times" : "straight-line travel-time ESTIMATE (no road routing configured)",
    r.unlocatedStopIds?.length ? `${r.unlocatedStopIds.length} stop(s) without map position kept at the end` : null,
    r.approachStopIds?.length ? `${r.approachStopIds.length} stop(s) routed to their accepted approach point` : null,
  ].filter((x): x is string => !!x);
}
