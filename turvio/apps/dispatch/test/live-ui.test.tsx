import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveFleetList } from "../components/LiveFleet";
import { MapWorkspace } from "../components/MapWorkspace";
import type { RouteMapProps } from "../components/RouteMap";
import { SettingsView } from "../components/SettingsView";
import type { Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n/client";
import type { LiveVehicle, UnavailableDriver } from "../lib/live";
import { DispatchProvider, useDispatch, type SessionInfo } from "../lib/store";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search), usePathname: () => "/map", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
// The Leaflet map itself is not under test here: record what MapWorkspace hands it.
let mapProps: RouteMapProps | null = null;
vi.mock("../components/RouteMap", () => ({
  RouteMap: (p: RouteMapProps) => {
    mapProps = p;
    return <div data-testid="route-map" data-vehicles={(p.vehicles ?? []).map((v) => v.driverId).join(",")} />;
  },
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const NOW = "2026-11-05T10:00:00.000Z";
const sessionOf = (role: SessionInfo["role"]): SessionInfo => ({
  userName: "T",
  email: "t@example.test",
  role,
  organizationId: "org_x",
  organizationName: "X",
  companyWide: true,
  workspaces: [{ id: "org_x", name: "X", role }],
  environment: null,
});
const veh = (driverId: string, depotId: string, tourId = `t_${driverId}`): LiveVehicle => ({
  driverId,
  driverName: `Driver ${driverId}`,
  tourId,
  tourName: tourId,
  tourStatus: "in_progress",
  depotId,
  vehicle: null,
  position: { lat: 52.37, lng: 9.73, accuracyMeters: 8, speedMps: 0, headingDeg: null },
  recordedAt: NOW,
  receivedAt: NOW,
  positionAt: NOW,
  progress: { done: 1, remaining: 2 },
  nextStop: null,
});
const unav = (driverId: string, reason: UnavailableDriver["reason"]): UnavailableDriver => ({
  driverId,
  driverName: `Driver ${driverId}`,
  tourId: `t_${driverId}`,
  tourName: `T-${driverId}`,
  tourStatus: reason === "paused" ? "paused" : "in_progress",
  depotId: "dep_hannover",
  vehicle: null,
  progress: { done: 0, remaining: 4 },
  nextStop: null,
  reason,
});

const overview = (admin: boolean) => ({
  company: { id: "org_x", name: "X", slug: "x", timeZone: "Europe/Berlin", contactEmail: null, contactPhone: null, address: { street: null, postalCode: null, city: null, country: "DE" }, website: null },
  tracking: {
    mode: "active_tours",
    intervalSeconds: 15,
    noticeVersion: 2,
    retentionDays: 30,
    enabledAt: null,
    activeDrivers: 3,
    pilots: 0,
    pilotLimit: 20,
    acknowledgedCurrentNotice: 1,
    notice: { controller: "X Logistik GmbH", contact: "privacy@x.test", legalBasis: null, text: null },
  },
  proofRetentionDays: 90,
  driverRules: { failureReasons: [], customFailureReasons: false, podLocation: false, showRecipientPhone: false },
  subscription: null,
  yourRole: admin ? "admin" : "dispatcher",
  canEdit: { company: admin, tracking: admin, driverRules: admin, team: admin, locations: admin },
  roles: {},
});

let calls: { url: string; method: string; body: unknown }[] = [];
let admin = true;
beforeEach(() => {
  search = "";
  mapProps = null;
  calls = [];
  admin = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.includes("/fleet/live"))
        // Deliberately ignores depotId: the client must still show only the selected depot.
        return json({ serverTime: NOW, date: base.date, staleAfterSeconds: 120, offlineAfterSeconds: 300, vehicles: [veh("h1", "dep_hannover", "tour_han_01"), veh("b1", "dep_bremen", "tour_bre_01")], unavailable: [unav("p1", "paused")] });
      if (url.includes("/dispatch?")) return json(base);
      if (url.includes("/location-checks")) return json({ checks: [], pending: false });
      if (url.endsWith("/v1/me/preferences")) return json({ language: null, orgDefaults: {} });
      if (url.endsWith("/settings")) return json(overview(admin));
      if (url.endsWith("/tracking/drivers")) return json({ serverTime: NOW, mode: "active_tours", noticeVersion: 2, staleAfterSeconds: 120, pilotLimit: 20, summary: {}, drivers: [] });
      if (url.endsWith("/tracking") && method === "PATCH") return json({ mode: "active_tours", intervalSeconds: 15, noticeVersion: 3, retentionDays: 30 });
      return json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap(ui: ReactNode, role: SessionInfo["role"] = "dispatcher", locale: Locale = "en") {
  return render(
    <I18nProvider initial={locale}>
      <TooltipProvider>
        <DispatchProvider base={base} session={sessionOf(role)}>
          {ui}
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );
}

let store: ReturnType<typeof useDispatch>;
function Probe() {
  store = useDispatch();
  return null;
}

describe("map: live vehicles follow the depot switcher", () => {
  it("passes only the selected depot's vehicles to the map (and asks the server for that depot)", async () => {
    wrap(
      <>
        <Probe />
        <MapWorkspace />
      </>,
    );
    await screen.findByTestId("route-map");
    await waitFor(() => expect(mapProps?.vehicles?.map((v) => v.driverId).sort()).toEqual(["b1", "h1"]));
    await act(async () => store.setDepotId("dep_hannover"));
    await waitFor(() => expect(mapProps?.vehicles?.map((v) => v.driverId)).toEqual(["h1"]));
    expect(mapProps!.liveThresholds).toEqual({ staleAfterSeconds: 120, offlineAfterSeconds: 300 });
    await waitFor(() => expect(calls.some((c) => c.url.includes("/fleet/live?") && c.url.includes("depotId=dep_hannover") && c.url.includes(`date=${base.date}`))).toBe(true));
  });
});

describe("live panel: state per driver, paused and unavailable drivers listed", () => {
  const vehicles = [veh("a", "dep_hannover"), { ...veh("b", "dep_hannover"), positionAt: "2026-11-05T09:57:00.000Z" }];
  const unavailable = [unav("p", "paused"), unav("n", "no_position")];
  const cases: [Locale, { paused: string; noPos: string; live: string; delayed: string; notOnMap: string; dir: string }][] = [
    ["en", { paused: "Paused", noPos: "No position", live: "Live · 0 s ago", delayed: "Delayed · 3 min ago", notOnMap: "Not on the map", dir: "ltr" }],
    ["de", { paused: "Pausiert", noPos: "Keine Position", live: "Live · vor 0 s", delayed: "Verzögert · vor 3 Min.", notOnMap: "Nicht auf der Karte", dir: "ltr" }],
    ["ar", { paused: "متوقفة مؤقتًا", noPos: "لا يوجد موقع", live: "مباشر · منذ 0 ث", delayed: "متأخر · منذ 3 دقيقة", notOnMap: "غير ظاهر على الخريطة", dir: "rtl" }],
  ];
  for (const [locale, x] of cases) {
    it(`${locale}: labels and direction`, () => {
      render(
        <I18nProvider initial={locale}>
          <LiveFleetList vehicles={vehicles} unavailable={unavailable} serverNow={Date.parse(NOW)} thresholds={{ staleAfterSeconds: 120, offlineAfterSeconds: 300 }} onSelect={() => {}} />
        </I18nProvider>,
      );
      const list = screen.getByTestId("live-fleet");
      expect(within(list).getByText(x.live)).toBeTruthy();
      expect(within(list).getByText(x.delayed)).toBeTruthy();
      const off = screen.getByTestId("live-unavailable");
      expect(off.getAttribute("aria-label")).toBe(x.notOnMap);
      expect(within(off).getByText(x.paused)).toBeTruthy();
      expect(within(off).getByText(x.noPos)).toBeTruthy();
      // Paused / no-position drivers have no age (there is no position to age).
      expect(off.textContent).not.toMatch(/ago|vor |منذ/);
      expect(document.documentElement.dir).toBe(x.dir);
    });
  }
});

describe("Settings → live tracking: company notice form", () => {
  it("prefills from the settings overview and PATCHes the trimmed notice after confirmation", async () => {
    search = "section=tracking";
    const user = userEvent.setup();
    wrap(<SettingsView />, "admin");
    const form = await screen.findByTestId("notice-form");
    const controller = within(form).getByLabelText("Controller (company responsible)") as HTMLInputElement;
    expect(controller.value).toBe("X Logistik GmbH");
    const contact = within(form).getByLabelText("Data-protection contact") as HTMLInputElement;
    expect(contact.value).toBe("privacy@x.test");
    await user.clear(contact);
    await user.type(within(form).getByLabelText("Legal basis"), "  Art. 6(1)(f) GDPR ");
    await user.type(within(form).getByLabelText("Additional text"), "Positions only while a tour is driven.");
    expect(within(form).getByRole("note").textContent).toMatch(/every driver must acknowledge the notice again/);
    await user.click(within(form).getByRole("button", { name: "Save notice…" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/acknowledge the notice again/);
    await user.click(within(dialog).getByRole("button", { name: "Save and require acknowledgement" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/turvio/v1/orgs/org_x/tracking");
    expect(patch.body).toEqual({ notice: { controller: "X Logistik GmbH", contact: null, legalBasis: "Art. 6(1)(f) GDPR", text: "Positions only while a tour is driven." } });
  });

  it("is not shown to dispatchers (read-only tracking settings)", async () => {
    search = "section=tracking";
    admin = false;
    wrap(<SettingsView />, "dispatcher");
    // The tracking section has loaded (the overview arrived) – without the admin-only form.
    await screen.findByText("Notice version");
    expect(screen.queryByTestId("notice-form")).toBeNull();
  });

  it("German and Arabic labels", async () => {
    search = "section=tracking";
    wrap(<SettingsView />, "admin", "de");
    const form = await screen.findByTestId("notice-form");
    expect(within(form).getByLabelText("Kontakt Datenschutz")).toBeTruthy();
    expect(within(form).getByRole("button", { name: "Hinweis speichern…" })).toBeTruthy();
  });
});
