import { createDispatchDataset } from "@turvio/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsView } from "../components/AnalyticsView";
import { SettingsView } from "../components/SettingsView";
import { TrackingStatusPanel, fleetStateOf } from "../components/TrackingStatusPanel";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { DispatchProvider, type SessionInfo } from "../lib/store";
import type { DriverTracking } from "../lib/settings";
import { presetRange } from "../lib/analytics";

/** Phase D: Settings, live tracking administration, Live Fleet states, Analytics. */
let search = "";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session = (role: SessionInfo["role"]): SessionInfo => ({
  userName: "Test",
  email: "t@example.test",
  role,
  organizationId: "org_jarbou",
  organizationName: "JARBOU (synthetic)",
  companyWide: true,
  workspaces: [{ id: "org_jarbou", name: "JARBOU", role }],
  environment: null,
});

const overview = (admin: boolean) => ({
  company: { id: "org_jarbou", name: "JARBOU Logistik", slug: "jarbou", timeZone: "Europe/Berlin", contactEmail: null, contactPhone: null, address: { street: null, postalCode: null, city: "Hannover", country: "DE" }, website: null },
  tracking: { mode: "off", intervalSeconds: 15, noticeVersion: 2, retentionDays: 30, enabledAt: null, activeDrivers: 3, pilots: 0, pilotLimit: 20, acknowledgedCurrentNotice: 1 },
  proofRetentionDays: 90,
  driverRules: { failureReasons: [{ code: "recipient_absent" }, { code: "other", requiresNote: true }], customFailureReasons: false, podLocation: false, showRecipientPhone: false },
  subscription: admin ? { plan: "Business", planCode: "business", status: "active" } : null,
  yourRole: admin ? "admin" : "dispatcher",
  canEdit: { company: admin, tracking: admin, driverRules: admin, team: admin, locations: admin },
  roles: { admin: ["tours.manage", "org.settings.manage"], dispatcher: ["tours.manage"] },
});
const drv = (over: Partial<DriverTracking>): DriverTracking => ({
  driverId: "d1", name: "Lena Hoffmann", depotId: "dep_hannover", depotName: "Hannover", pilot: false, hasAppLogin: true, effective: false,
  acknowledgedVersion: 2, acknowledgedAt: "2026-11-01T08:00:00Z", acknowledgedCurrent: true, currentTour: null, lastPositionAt: null, positionAgeSeconds: null,
  permission: "unknown", state: "disabled", ...over,
});
let trackingMode = "off";
let trackingDrivers: DriverTracking[] = [];
let calls: { method: string; url: string; body: any }[] = [];
const SERVER_NOW = "2026-11-05T10:00:00.000Z";

const summary = {
  range: { from: "2026-11-02", to: "2026-11-05" },
  previousRange: { from: "2026-10-29", to: "2026-11-01" },
  timeZone: "Europe/Berlin",
  granularity: "day",
  onTimeToleranceMinutes: 15,
  current: {
    stops: { stops: 120, delivered: 90, pickedUp: 6, failed: 8, attempted: 2, rescheduled: 0, returned: 0, skipped: 2, cancelled: 4, open: 8, processed: 108, successRate: 0.8889 },
    tours: { tours: 6, byStatus: { planned: 1, running: 1, completed: 4, cancelled: 0 }, archived: 0, toursStarted: 5, completionRate: 0.8, onTimeStartRate: 0.6, avgTourMinutes: 412, activeHours: 27.5, stopsPerTour: 21.6, stopsPerActiveHour: 3.4, planned: { coveredTours: 3, plannedDistanceKm: 214.6, plannedMinutes: 1205 } },
    avgIntervalMinutes: 11.2,
  },
  previous: {
    stops: { stops: 0, delivered: 0, pickedUp: 0, failed: 0, attempted: 0, rescheduled: 0, returned: 0, skipped: 0, cancelled: 0, open: 0, processed: 0, successRate: null },
    tours: { tours: 0, byStatus: { planned: 0, running: 0, completed: 0, cancelled: 0 }, archived: 0, toursStarted: 0, completionRate: null, onTimeStartRate: null, avgTourMinutes: null, activeHours: 0, stopsPerTour: null, stopsPerActiveHour: null, planned: { coveredTours: 0, plannedDistanceKm: null, plannedMinutes: null } },
    avgIntervalMinutes: null,
  },
  trend: [
    { bucket: "2026-11-02", tours: 2, toursCompleted: 2, stops: 50, delivered: 40, pickedUp: 2, failed: 4, attempted: 1, rescheduled: 0, returned: 0, skipped: 1, cancelled: 2, open: 0, processed: 48, successRate: 0.875 },
    { bucket: "2026-11-03", tours: 0, toursCompleted: 0, stops: 0, delivered: 0, pickedUp: 0, failed: 0, attempted: 0, rescheduled: 0, returned: 0, skipped: 0, cancelled: 0, open: 0, processed: 0, successRate: null },
  ],
  failureReasons: [{ reason: "recipient_absent", status: "failed", count: 8 }],
  definitions: { successRate: "(Delivered + picked up) ÷ processed stops.", avgIntervalMinutes: "This is not the service time at a stop.", plannedDistanceKm: "Road distance from the optimizer." },
};

beforeEach(() => {
  calls = [];
  search = "";
  trackingMode = "off";
  trackingDrivers = [drv({})];
  replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      if (url.includes("/dispatch?")) return json(base);
      if (url.endsWith("/events")) return json([]);
      if (url.includes("/location-checks")) return json({ checks: [], pending: false });
      if (url.endsWith("/v1/me/preferences") && method === "GET") return json({ language: null, theme: "system", dateFormat: "dmy", orgDefaults: {}, updatedAt: null });
      if (url.endsWith("/v1/me/preferences")) return json({ language: null, theme: body.theme, dateFormat: "dmy", orgDefaults: body.orgDefaults, updatedAt: SERVER_NOW });
      if (url.endsWith("/settings")) return json(overview(url.includes("admin") || currentRole !== "dispatcher"));
      if (url.endsWith("/tracking/drivers")) return json({ serverTime: SERVER_NOW, mode: trackingMode, noticeVersion: 2, staleAfterSeconds: 120, pilotLimit: 20, summary: {}, drivers: trackingDrivers });
      if (url.endsWith("/tracking/pilots")) return json({ changed: body.driverIds.length, pilots: body.driverIds.length });
      if (url.endsWith("/tracking") && method === "PATCH") return json({ mode: body.mode ?? trackingMode, intervalSeconds: 15, noticeVersion: 2, retentionDays: 30 });
      if (url.includes("/analytics/summary")) return json(summary);
      if (url.includes("/analytics/drivers")) return json({ drivers: [] });
      if (method === "PATCH" || method === "PUT") return new Response(null, { status: 204 });
      return json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
let currentRole: SessionInfo["role"] = "admin";

function wrap(ui: ReactNode, role: SessionInfo["role"] = "admin") {
  currentRole = role;
  return render(
    <TooltipProvider>
      <DispatchProvider base={base} session={session(role)}>
        {ui}
      </DispatchProvider>
    </TooltipProvider>,
  );
}

describe("Settings", () => {
  it("personal preferences: appearance, default location and Tours view are saved to the account", async () => {
    const user = userEvent.setup();
    wrap(<SettingsView />, "dispatcher");
    await user.click(await screen.findByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.selectOptions(screen.getByRole("combobox", { name: "Default location" }), base.depots[0]!.id);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tours page opens with" }), "all");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.url.endsWith("/v1/me/preferences"))).toBeTruthy());
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ theme: "dark", orgDefaults: { org_jarbou: { defaultDepotId: base.depots[0]!.id, toursView: "all" } } });
  });

  it("company details: admins save only changed fields; dispatchers see them read-only", async () => {
    const user = userEvent.setup();
    search = "section=company";
    const { unmount } = wrap(<SettingsView />, "admin");
    const phone = await screen.findByRole("textbox", { name: "Contact phone" });
    await user.type(phone, "+49 511 1234");
    await user.click(screen.getByRole("button", { name: "Save company details" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH" && c.url.endsWith("/settings/company"))!.body).toEqual({ contactPhone: "+49 511 1234" }));
    unmount();
    wrap(<SettingsView />, "dispatcher");
    expect(((await screen.findByRole("textbox", { name: "Contact phone" })) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save company details" })).toBeNull();
    expect(screen.getByText("Read-only for your role.")).toBeTruthy();
  });

  it("driver app rules: a new reason is added; existing ones cannot be removed", async () => {
    const user = userEvent.setup();
    search = "section=driver-rules";
    wrap(<SettingsView />, "admin");
    await user.type(await screen.findByRole("textbox", { name: "New reason" }), "Paket beschädigt");
    await user.click(screen.getByRole("button", { name: /Add reason/ }));
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save driver app rules" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.url.endsWith("/settings/driver"))).toBeTruthy());
    expect(calls.find((c) => c.url.endsWith("/settings/driver"))!.body.failureReasons).toEqual([
      { code: "recipient_absent" },
      { code: "other", requiresNote: true },
      { code: "paket_beschaedigt", label: "Paket beschädigt" },
    ]);
  });
});

describe("Live tracking administration", () => {
  it("switching to all eligible drivers needs the legal confirmation; the existing tracking API is used", async () => {
    const user = userEvent.setup();
    search = "section=tracking";
    wrap(<SettingsView />, "admin");
    await user.click(await screen.findByRole("radio", { name: /All eligible drivers/ }));
    const dialog = await screen.findByRole("dialog");
    const go = within(dialog).getByRole("button", { name: "Switch" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(within(dialog).getByText(/does not replace any consent or employment-law process/)).toBeTruthy();
    await user.click(within(dialog).getByRole("checkbox", { name: "I confirm the prerequisites" }));
    await user.click(go);
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH" && c.url.endsWith("/tracking"))!.body).toEqual({ mode: "active_tours", confirmPrerequisites: true }));
  });

  it("pilot mode cannot start without pilots; per-driver and bulk pilot switches need the drivers' consent", async () => {
    const user = userEvent.setup();
    search = "section=tracking";
    trackingDrivers = [drv({}), drv({ driverId: "d2", name: "Mihai Popescu" })];
    wrap(<SettingsView />, "admin");
    await user.click(await screen.findByRole("radio", { name: /Pilot/ }));
    let dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByRole("button", { name: "Switch" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("switch", { name: "Pilot tracking for Lena Hoffmann" }));
    dialog = await screen.findByRole("dialog");
    const add = within(dialog).getByRole("button", { name: "Add to pilot" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    await user.click(within(dialog).getByRole("checkbox", { name: "Each driver agreed" }));
    await user.click(add);
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/tracking/pilots"))!.body).toEqual({ driverIds: ["d1"], enabled: true, confirmPilotConsent: true }));
    await user.click(screen.getByRole("checkbox", { name: "Select Lena Hoffmann" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Mihai Popescu" }));
    await user.click(screen.getByRole("button", { name: "Remove 2 from pilot" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove from pilot" }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/tracking/pilots")).at(-1)!.body).toEqual({ driverIds: ["d1", "d2"], enabled: false }));
  });

  it("dispatchers see the status read-only and never coordinates", async () => {
    search = "section=tracking";
    trackingDrivers = [drv({ state: "awaiting_acknowledgement", acknowledgedCurrent: false, acknowledgedVersion: 1 })];
    wrap(<SettingsView />, "dispatcher");
    const table = await screen.findByRole("table", { name: "Driver tracking status" });
    expect(within(table).getByText("Awaiting acknowledgement")).toBeTruthy();
    expect(within(table).getByText("v1 – v2 pending")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect((screen.getByRole("radio", { name: /All eligible drivers/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Live Fleet states", () => {
  const now = Date.parse(SERVER_NOW);
  const onTour = { currentTour: { id: "t", name: "HAN-01", status: "in_progress" } };
  it("a position is live only while fresh – older ones are stale or no signal", () => {
    expect(fleetStateOf(drv({ ...onTour, state: "live", lastPositionAt: new Date(now - 30_000).toISOString() }), now)).toBe("live");
    // The server may still say "live" for a 100 s old fix; the map rule (90 s) wins: stale.
    expect(fleetStateOf(drv({ ...onTour, state: "live", lastPositionAt: new Date(now - 100_000).toISOString() }), now)).toBe("stale");
    expect(fleetStateOf(drv({ ...onTour, state: "no_recent_position", lastPositionAt: new Date(now - 400_000).toISOString() }), now)).toBe("no_signal");
    expect(fleetStateOf(drv({ ...onTour, state: "no_recent_position", lastPositionAt: null }), now)).toBe("no_signal");
    expect(fleetStateOf(drv({ ...onTour, state: "awaiting_acknowledgement" }), now)).toBe("awaiting_acknowledgement");
    expect(fleetStateOf(drv({ ...onTour, state: "pilot_not_enabled" }), now)).toBe("disabled");
    expect(fleetStateOf(drv({ ...onTour, state: "tour_paused" }), now)).toBe("tour_paused");
  });

  it("the overview panel counts drivers on active tours by state and explains the ones not live", async () => {
    trackingMode = "pilot";
    trackingDrivers = [
      drv({ driverId: "a", name: "A Live", ...onTour, state: "live", lastPositionAt: new Date(Date.now() - 10_000).toISOString() }),
      drv({ driverId: "b", name: "B Ack", ...onTour, state: "awaiting_acknowledgement" }),
      drv({ driverId: "c", name: "C Off", ...onTour, state: "pilot_not_enabled" }),
      drv({ driverId: "d", name: "D No tour", state: "no_active_tour" }),
    ];
    vi.stubGlobal("Date", Date);
    wrap(<TrackingStatusPanel />, "dispatcher");
    const counts = await screen.findByTestId("tracking-counts");
    expect(counts.textContent).toMatch(/1 Awaiting acknowledgement/);
    expect(counts.textContent).toMatch(/1 Not tracked/);
    expect(screen.getByText("B Ack")).toBeTruthy();
    expect(screen.queryByText("D No tour")).toBeNull();
  });
});

describe("Analytics", () => {
  it("shows recorded KPIs with definitions, planned figures labelled as planned, and the exports", async () => {
    wrap(<AnalyticsView />, "dispatcher");
    expect((await screen.findByTestId("kpi-Success rate")).textContent).toBe("88.9 %");
    expect(screen.getByTestId("kpi-Delivered / picked up").textContent).toBe("96");
    expect(screen.getByTestId("kpi-Not delivered").textContent).toBe("12");
    expect(screen.getByText("Planned distance").parentElement!.textContent).toMatch(/planned/);
    expect(screen.getByText(/Optimizer · 3 of 6 tours/)).toBeTruthy();
    expect(screen.getByText("Interval between outcomes")).toBeTruthy();
    expect(screen.getByText("Not the time spent at a stop")).toBeTruthy();
    expect(screen.getByText(/Actual driven distance is not recorded/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Definition: \(Delivered \+ picked up\)/ })).toBeTruthy();
    const q = new URL(calls.find((c) => c.url.includes("/analytics/summary"))!.url, "http://x").searchParams;
    expect(q.get("from")).toBe(presetRange("week", base.date).from);
  });

  it("period presets and custom ranges drive the query; exports carry the same filters", async () => {
    const user = userEvent.setup();
    wrap(<AnalyticsView />, "dispatcher");
    await screen.findByTestId("kpi-Success rate");
    await user.click(screen.getByRole("tab", { name: "Last month" }));
    await waitFor(() => {
      const q = new URL(calls.filter((c) => c.url.includes("/analytics/summary")).at(-1)!.url, "http://x").searchParams;
      expect([q.get("from"), q.get("to")]).toEqual([presetRange("last_month", base.date).from, presetRange("last_month", base.date).to]);
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Group by" }), "week");
    await waitFor(() => expect(new URL(calls.filter((c) => c.url.includes("/analytics/summary")).at(-1)!.url, "http://x").searchParams.get("granularity")).toBe("week"));
    const clicked: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute("href")!);
    });
    await user.click(screen.getAllByRole("button", { name: /Export/ })[0]!);
    await user.click(await screen.findByRole("menuitem", { name: "Excel (.xlsx)" }));
    spy.mockRestore();
    expect(clicked).toHaveLength(1);
    const p = new URL(clicked[0]!, "http://x").searchParams;
    expect([p.get("view"), p.get("format"), p.get("granularity")]).toEqual(["trend", "xlsx", "week"]);
  });

  it("a trend table is available instead of the chart", async () => {
    const user = userEvent.setup();
    wrap(<AnalyticsView />, "dispatcher");
    await screen.findByTestId("kpi-Success rate");
    await user.click(screen.getByRole("button", { name: /Table/ }));
    const t = screen.getByRole("table", { name: "Outcomes per period" });
    expect(within(t).getAllByRole("row")).toHaveLength(3);
    expect(within(t).getByText("87.5 %")).toBeTruthy();
  });

  it("presets: weeks start on Monday, months on the 1st", () => {
    expect(presetRange("week", "2026-11-05")).toEqual({ from: "2026-11-02", to: "2026-11-05" });
    expect(presetRange("last_week", "2026-11-05")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(presetRange("last_month", "2026-11-05")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("month", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-05" });
  });
});
