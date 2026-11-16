import { EN_T, type TFunction } from "./i18n";
import type { OptimizeMeta } from "./store";

/** Constraint problems of an optimization, in plain words (never hidden behind "optimized"). */
export function optimizeProblems(r: OptimizeMeta, t: TFunction = EN_T): string[] {
  const v = r.violations ?? [];
  const late = v.filter((x) => x.kind === "late");
  const overtime = v.find((x) => x.kind === "overtime");
  const unreachable = v.filter((x) => x.kind === "unassigned_unreachable").length;
  const infeasible = v.filter((x) => x.kind === "unassigned_infeasible").length;
  return [
    late.length ? t("analytics.optimize.late", { count: late.length, min: Math.round(Math.max(...late.map((x) => x.minutes ?? 0))) }) : null,
    overtime ? t("analytics.optimize.overtime", { min: Math.round(overtime.minutes ?? 0) }) : null,
    unreachable ? t("analytics.optimize.unreachable", { count: unreachable }) : null,
    infeasible ? t("analytics.optimize.infeasible", { count: infeasible }) : null,
    r.locationErrors?.length ? t("analytics.optimize.locationErrors", { count: r.locationErrors.length }) : null,
    // Older optimizer responses without violation details.
    !v.length && r.unassignedStopIds.length ? t("analytics.optimize.unassigned", { count: r.unassignedStopIds.length }) : null,
  ].filter((x): x is string => !!x);
}

export function optimizeNotes(r: OptimizeMeta, t: TFunction = EN_T): string[] {
  return [
    r.matrixSource === "osrm" ? t("analytics.optimize.road") : t("analytics.optimize.estimate"),
    r.unlocatedStopIds?.length ? t("analytics.optimize.unlocated", { count: r.unlocatedStopIds.length }) : null,
    r.approachStopIds?.length ? t("analytics.optimize.approach", { count: r.approachStopIds.length }) : null,
  ].filter((x): x is string => !!x);
}
