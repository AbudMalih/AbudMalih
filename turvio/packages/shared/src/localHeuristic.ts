import { estimateDrive } from "./geo";
import type { GeoPoint, Stop } from "./schemas";
import { resequence, sortBySequence } from "./tour";

/**
 * Offline fallback ordering for a single driver: nearest-neighbour construction
 * followed by 2-opt improvement on estimated drive times.
 *
 * Limitations (by design – the OR-Tools service handles these):
 *  - time windows and shift limits are NOT considered,
 *  - priority stops are simply visited before non-priority stops,
 *  - travel times are straight-line estimates.
 * The result is a reasonable heuristic order, not an optimal one.
 */
export interface LocalOrderResult {
  stops: Stop[];
  /** Pending stops without coordinates; kept at the end in their old order. */
  unlocatedStopIds: string[];
  estimatedDriveSeconds: number;
}

type Located = Stop & { location: GeoPoint };

function legSeconds(a: GeoPoint, b: GeoPoint) {
  return estimateDrive(a, b).seconds;
}

function pathCost(start: GeoPoint, path: Located[], end?: GeoPoint) {
  let cost = 0;
  let prev = start;
  for (const s of path) {
    cost += legSeconds(prev, s.location);
    prev = s.location;
  }
  if (end) cost += legSeconds(prev, end);
  return cost;
}

function nearestNeighbour(start: GeoPoint, items: Located[]): Located[] {
  const remaining = [...items];
  const out: Located[] = [];
  let cur = start;
  while (remaining.length) {
    let best = 0;
    let bestCost = Infinity;
    remaining.forEach((s, i) => {
      const c = legSeconds(cur, s.location);
      if (c < bestCost) {
        bestCost = c;
        best = i;
      }
    });
    const [next] = remaining.splice(best, 1);
    out.push(next!);
    cur = next!.location;
  }
  return out;
}

function twoOpt(start: GeoPoint, path: Located[], end?: GeoPoint, maxPasses = 50): Located[] {
  let best = path;
  let bestCost = pathCost(start, best, end);
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const c = pathCost(start, candidate, end);
        if (c + 1e-6 < bestCost) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/**
 * Reorder the *pending* stops of a tour. Completed stops keep their place at
 * the front so the driver's history is preserved (re-optimization of the
 * remaining stops from `from`, e.g. the current position).
 */
export function orderStopsLocally(stops: Stop[], from: GeoPoint, end?: GeoPoint): LocalOrderResult {
  const ordered = sortBySequence(stops);
  const done = ordered.filter((s) => s.status !== "pending");
  const pending = ordered.filter((s) => s.status === "pending");
  const located = pending.filter((s): s is Located => s.location !== null);
  const unlocated = pending.filter((s) => s.location === null);

  const priority = located.filter((s) => s.priority);
  const normal = located.filter((s) => !s.priority);

  const prioPath = twoOpt(from, nearestNeighbour(from, priority));
  const afterPrio = prioPath.at(-1)?.location ?? from;
  const normalPath = twoOpt(afterPrio, nearestNeighbour(afterPrio, normal), end);
  const path = [...prioPath, ...normalPath];

  return {
    stops: resequence([...done, ...path, ...unlocated]),
    unlocatedStopIds: unlocated.map((s) => s.id),
    estimatedDriveSeconds: pathCost(from, path, end),
  };
}
