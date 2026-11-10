import { dispatchKpis, formatClock, roadWaypoints, summarizeTours, minuteOfDay, type DispatchDataset, type Stop, type Tour, type TourRoad } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListView } from "../components/ListView";
import { LiveVehiclePanel } from "../components/LiveFleet";
import { TourDetail } from "../components/TourDetail";
import { TourList } from "../components/TourList";
import { finishValue, stopTooltipHtml } from "../lib/eta";
import type { LiveVehicle } from "../lib/live";
import { DispatchProvider, type SessionInfo } from "../lib/store";

/**
 * P0-2 verification in the rendered views: the same tour shows the same finish, ETAs and status in
 * the list, tour cards, detail, map tooltip, KPIs and live panel – for a planned tour tomorrow, a
 * planned tour that missed its 08:00 start today, a paused, a running and a completed tour.
 * Road legs 10 min each, service 2 min; the clock is 10:00 (UTC dataset).
 */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/list", useRouter: () => ({ push: vi.fn() }) }));

const DEPOT = { lat: 52.37, lng: 9.73 };
const at = (m: number) => `2026-11-10T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00.000Z`;
const minuteOf = (iso: string | undefined) => minuteOfDay(iso, "UTC");
const stop = (tourId: string, i: number, extra: Partial<Stop> = {}): Stop =>
  ({
    id: `${tourId}-s${i}`,
    tourId,
    type: "delivery",
    sequence: i,
    status: "pending",
    recipientName: `${tourId} Kunde ${i}`,
    address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30161", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.38 + i * 0.002, lng: 9.74 },
    serviceSeconds: 120,
    priority: false,
    parcels: [],
    ...extra,
  }) as Stop;
const tour = (id: string, driverId: string, extra: Partial<Tour>): Tour =>
  ({ id, organizationId: "o", name: id, date: "2026-11-10", depotId: "d", driverId, vehicleId: null, status: "planned", plannedStartMinute: 480, version: 1, ...extra }) as Tour;
const roadOf = (t: Tour, stops: Stop[]): TourRoad => {
  const wp = roadWaypoints(t, stops, DEPOT, minuteOf);
  const legs = (n: number) => Array.from({ length: n }, () => ({ meters: 3000, seconds: 600 }));
  return {
    source: "osrm",
    plan: { stopIds: wp.plan.stopIds, legs: legs(wp.plan.points.length - 1) },
    ...(wp.remaining ? { remaining: { stopIds: wp.remaining.stopIds, anchorStopId: wp.remaining.anchorStopId, legs: legs(wp.remaining.points.length - 1) } } : {}),
  };
};

function dataset(date: string, asOfMinute: number, isToday: boolean): DispatchDataset {
  const late = tour("LATE", "d1", { date });
  const paused = tour("PAUSE", "d2", { date, status: "paused", startedAt: at(480) });
  const done = tour("DONE", "d3", { date, status: "completed", startedAt: at(470), finishedAt: at(545) });
  const run = tour("RUN", "d4", { date, status: "in_progress", startedAt: at(480) });
  const stops = [
    ...[0, 1, 2].map((i) => stop("LATE", i)),
    stop("PAUSE", 0, { status: "delivered", completedAt: at(492) }),
    stop("PAUSE", 1),
    stop("PAUSE", 2),
    ...[0, 1].map((i) => stop("DONE", i, { status: "delivered", completedAt: at(490 + i * 15) })),
    stop("RUN", 0, { status: "delivered", completedAt: at(560) }),
    stop("RUN", 1),
  ];
  const tours = [late, paused, done, run];
  return {
    organizationId: "o",
    date,
    asOfMinute,
    isToday,
    timeZone: "UTC",
    depots: [{ id: "d", organizationId: "o", name: "Depot", address: { street: "x", houseNumber: "1", postalCode: "30161", city: "Hannover", countryCode: "DE" }, location: DEPOT }],
    drivers: ["d1", "d2", "d3", "d4"].map((id) => ({ id, organizationId: "o", displayName: `Fahrer ${id}`, depotId: "d", maxShiftMinutes: 480, active: true })),
    vehicles: [],
    tours,
    stops,
    unassigned: [],
    roads: Object.fromEntries(tours.map((t) => [t.id, roadOf(t, stops.filter((s) => s.tourId === t.id))])),
  } as DispatchDataset;
}

const session: SessionInfo = { userName: "T", email: "t@example.test", role: "admin", organizationId: "o", organizationName: "Test (synthetic)", companyWide: true, workspaces: [{ id: "o", name: "Test", role: "admin" }], environment: null };
let current: DispatchDataset;
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url.includes("/dispatch?") ? new Response(JSON.stringify(current), { status: 200 }) : url.endsWith("/events") ? new Response("[]", { status: 200 }) : new Response("{}", { status: 200 }))),
  );
});
afterEach(() => vi.unstubAllGlobals());
const wrap = (ui: ReactNode, data: DispatchDataset) => {
  current = data;
  return render(
    <TooltipProvider>
      <DispatchProvider base={data} session={session}>
        {ui}
      </DispatchProvider>
    </TooltipProvider>,
  );
};
const listRow = (name: string) => screen.getAllByRole("row").find((r) => within(r).queryAllByText(name, { exact: true }).length > 0)!;
const card = (name: string) => screen.getAllByRole("listitem").find((li) => within(li).queryAllByText(name, { exact: true }).length > 0)!;

describe("today 10:00: one figure per tour in every view", () => {
  const data = dataset("2026-11-10", 600, true);
  const sums = summarizeTours(data);
  const by = Object.fromEntries(sums.map((s) => [s.tour.id, s]));

  it("the projections themselves: scheduled vs revised, resume now, actual completion", () => {
    expect(by.LATE!.timeline.projection).toMatchObject({ condition: "start_now", fromMinute: 600, finishMinute: 646, scheduledFinishMinute: 526 });
    expect(by.PAUSE!.timeline.projection).toMatchObject({ condition: "resume_now", fromMinute: 600, scheduledFinishMinute: null });
    expect(by.DONE!.timeline.projection).toMatchObject({ origin: "completed", finishMinute: 545, remainingDriveSeconds: 0, complete: true });
    expect(by.RUN!.timeline.projection).toMatchObject({ condition: null, fromMinute: 600 });
  });

  it("ListView: finish column = projection; late start names the scheduled finish", () => {
    wrap(<ListView />, data);
    for (const s of sums) {
      const row = listRow(s.tour.name);
      const expected = s.status === "completed" ? formatClock(s.timeline.projectedEndMinute) : finishValue(s.timeline.projection);
      expect(row.textContent).toContain(expected);
    }
    expect(listRow("LATE").textContent).toContain("10:46");
    expect(listRow("LATE").textContent).toContain("if departing now · scheduled finish 08:46");
    expect(listRow("DONE").textContent).toContain("09:05");
    expect(listRow("DONE").textContent).toContain("finished");
  });

  it("TourList cards: the same finish value as the list for the missed start; same status labels as the list", () => {
    wrap(<TourList />, data);
    expect(card("LATE").textContent).toContain("Start 08:00 missed · Return 10:46 if departing now");
    const cardText = Object.fromEntries(sums.map((x) => [x.tour.id, card(x.tour.name).textContent!]));
    // Cards of running tours show a finish only next to pickup deadlines (none here) – never a
    // clock time that differs from the projection's finish.
    for (const x of sums.filter((y) => y.tour.id !== "LATE" && y.status !== "completed")) {
      const times = cardText[x.tour.id]!.match(/\d\d:\d\d/g) ?? [];
      expect(times.filter((c) => c !== finishValue(x.timeline.projection))).toEqual([]);
    }
    expect(cardText.PAUSE).toContain("Paused");
    expect(cardText.DONE).toContain("Completed");
  });

  it("TourDetail: revised finish as the value, scheduled vs revised spelled out; stop rows use the same ETAs", () => {
    wrap(<TourDetail summary={by.LATE!} />, data);
    expect(screen.getByTestId("tour-finish").textContent).toBe("10:46");
    expect(screen.getByTestId("scheduled-vs-revised").textContent).toBe("Scheduled: departure 08:00, finish 08:46. Revised: departure now, finish 10:46.");
    expect(screen.getByTestId("projection-basis").textContent).toContain("Not started yet – times assume the tour starts now · scheduled finish 08:46");
    expect(screen.getAllByTestId("stop-eta").map((e) => e.textContent)).toEqual(["10:10", "10:22", "10:34"]);
  });

  it("TourDetail: completed tour shows actual times, no projection notes", () => {
    wrap(<TourDetail summary={by.DONE!} />, data);
    expect(screen.getByTestId("tour-finish").textContent).toBe("09:05");
    expect(screen.queryByTestId("projection-basis")).toBeNull();
    expect(screen.queryByTestId("projection-notice")).toBeNull();
    expect(screen.getAllByTestId("stop-eta").map((e) => e.textContent)).toEqual(["08:10", "08:25"]);
  });

  it("TourDetail: paused tour shows the conditional note", () => {
    wrap(<TourDetail summary={by.PAUSE!} />, data);
    expect(screen.getByTestId("projection-notice").textContent).toContain("Paused – times assume the driver resumes now");
    expect(screen.getByTestId("tour-finish").textContent).toBe(finishValue(by.PAUSE!.timeline.projection));
  });

  it("map tooltip: the stop row's ETA; completed stops show their status", () => {
    const s = by.LATE!;
    expect(stopTooltipHtml(s, s.stops[0]!, 1)).toContain("ETA 10:10");
    expect(stopTooltipHtml(by.DONE!, by.DONE!.stops[0]!, 1)).toContain("delivered");
    expect(stopTooltipHtml(by.PAUSE!, by.PAUSE!.stops[1]!, 2)).toContain(`ETA ${formatClock(by.PAUSE!.timeline.projections.get("PAUSE-s1")!.etaMinute)}`);
  });

  it("KPIs count the same statuses the list shows", () => {
    const k = dispatchKpis(data, sums);
    expect(k.delayedTours).toBe(sums.filter((s) => s.status === "delayed").length);
    expect(k.delayedConfirmed + k.delayedProjected + k.delayedEstimated).toBe(k.delayedTours);
  });

  it("LiveFleet panel: same next-stop ETA and finish as the list and detail (running and paused)", () => {
    for (const id of ["RUN", "PAUSE"] as const) {
      const s = by[id]!;
      const next = s.stops.find((x) => x.status === "pending")!;
      const v: LiveVehicle = {
        driverId: s.tour.driverId!,
        driverName: "Fahrer",
        tourId: id,
        tourName: id,
        tourStatus: s.tour.status,
        depotId: "d",
        vehicle: null,
        position: { lat: 52.38, lng: 9.74, accuracyMeters: 5, speedMps: 0, headingDeg: null },
        recordedAt: "2026-11-10T09:59:50.000Z",
        receivedAt: "2026-11-10T09:59:51.000Z",
        progress: { done: 1, remaining: 1 },
        nextStop: { id: next.id, sequence: next.sequence, lat: 52.38, lng: 9.74, name: null, street: "Teststraße", houseNumber: "1", city: "Hannover", twEnd: null },
      };
      const { unmount } = wrap(<LiveVehiclePanel v={v} serverNow={Date.parse("2026-11-10T10:00:00Z")} onFocus={() => {}} />, data);
      const live = screen.getByTestId("live-eta").textContent!;
      expect(live).toContain(`Next stop ETA ${formatClock(s.timeline.projections.get(next.id)!.etaMinute)}`);
      expect(live).toContain(finishValue(s.timeline.projection));
      if (id === "PAUSE") expect(live).toContain("Paused – times assume the driver resumes now");
      unmount();
    }
  });
});

describe("tomorrow (clock 00:00, not today): the plan, nothing 'now'", () => {
  const data = dataset("2026-11-11", 0, false);
  // Only the planned tour makes sense on a future day.
  const tomorrow = { ...data, tours: data.tours.filter((t) => t.id === "LATE"), stops: data.stops.filter((s) => s.tourId === "LATE") } as DispatchDataset;
  const s = summarizeTours(tomorrow)[0]!;

  it("projects from the planned 08:00 departure", () => {
    expect(s.timeline.projection).toMatchObject({ condition: null, fromMinute: 480, finishMinute: 526, scheduledFinishMinute: null });
    expect(s.status).toBe("planned");
  });
  it("list, card and detail show 08:46 and no 'departing now'", () => {
    const { unmount } = wrap(<ListView />, tomorrow);
    expect(listRow("LATE").textContent).toContain("08:46");
    expect(listRow("LATE").textContent).not.toContain("departing now");
    unmount();
    const t = wrap(<TourList />, tomorrow);
    expect(card("LATE").textContent).toContain("Starts 08:00");
    t.unmount();
    wrap(<TourDetail summary={s} />, tomorrow);
    expect(screen.getByTestId("tour-finish").textContent).toBe("08:46");
    expect(screen.queryByTestId("scheduled-vs-revised")).toBeNull();
    expect(screen.getAllByTestId("stop-eta").map((e) => e.textContent)).toEqual(["08:10", "08:22", "08:34"]);
  });
});
