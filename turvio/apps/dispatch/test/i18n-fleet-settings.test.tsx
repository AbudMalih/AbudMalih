import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FleetView } from "../components/FleetView";
import { SettingsView } from "../components/SettingsView";
import { TrackingStatusPanel } from "../components/TrackingStatusPanel";
import { createT, type Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n/client";
import { ageLabel } from "../lib/live";
import { modeLabel, trackingStateLabel, type DriverTracking } from "../lib/settings";
import { DispatchProvider, type SessionInfo } from "../lib/store";

/** Fleet & team, Settings and the tracking panel in German and Arabic (incl. the legal wording). */
let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const SERVER_NOW = "2026-11-05T10:00:00.000Z";
const session: SessionInfo = {
  userName: "Test",
  email: "t@example.test",
  role: "admin",
  organizationId: "org_jarbou",
  organizationName: "JARBOU (synthetic)",
  companyWide: true,
  workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }],
  environment: null,
};
const overview = {
  company: { id: "org_jarbou", name: "JARBOU Logistik", slug: "jarbou", timeZone: "Europe/Berlin", contactEmail: null, contactPhone: null, address: { street: null, postalCode: null, city: "Hannover", country: "DE" }, website: null },
  tracking: { mode: "off", intervalSeconds: 15, noticeVersion: 2, retentionDays: 30, enabledAt: null, activeDrivers: 3, pilots: 0, pilotLimit: 20, acknowledgedCurrentNotice: 1 },
  proofRetentionDays: 90,
  driverRules: { failureReasons: [{ code: "recipient_absent" }], customFailureReasons: false, podLocation: false, showRecipientPhone: false },
  subscription: { plan: "Business", planCode: "business", status: "active" },
  yourRole: "admin",
  canEdit: { company: true, tracking: true, driverRules: true, team: true, locations: true },
  roles: { admin: ["tours.manage", "org.settings.manage"], dispatcher: ["tours.manage"] },
};
const drv = (over: Partial<DriverTracking>): DriverTracking => ({
  driverId: "d1", name: "Lena Hoffmann", depotId: "dep_hannover", depotName: "Hannover", pilot: false, hasAppLogin: true, effective: false,
  acknowledgedVersion: 1, acknowledgedAt: "2026-11-01T08:00:00Z", acknowledgedCurrent: false, currentTour: null, lastPositionAt: null, positionAgeSeconds: null,
  permission: "unknown", state: "awaiting_acknowledgement", ...over,
});
let drivers: DriverTracking[] = [];
let mode = "off";

beforeEach(() => {
  search = "";
  mode = "off";
  drivers = [drv({})];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.includes("/dispatch?")) return json(base);
      if (url.endsWith("/events")) return json([]);
      if (url.includes("/location-checks")) return json({ checks: [], pending: false });
      if (url.endsWith("/v1/me/preferences")) return json({ language: null, theme: "system", dateFormat: "dmy", orgDefaults: {}, updatedAt: null });
      if (url.endsWith("/settings")) return json(overview);
      if (url.endsWith("/tracking/drivers")) return json({ serverTime: SERVER_NOW, mode, noticeVersion: 2, staleAfterSeconds: 120, pilotLimit: 20, summary: {}, drivers });
      if (url.endsWith("/vehicles")) return json([{ id: "v1", label: "Sprinter 1", licensePlate: "H-JL 101", depotId: base.depots[0]!.id, capacityParcels: 120, active: true }]);
      if (url.endsWith("/members")) return json({ members: [{ membershipId: "m1", email: "d@example.test", role: "dispatcher", active: true, depotIds: [], driverId: null }], invitations: [] });
      if (method !== "GET") return new Response(null, { status: 204 });
      return json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap(ui: ReactNode, locale: Locale) {
  return render(
    <I18nProvider initial={locale}>
      <TooltipProvider>
        <DispatchProvider base={base} session={session}>
          {ui}
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );
}

describe("helpers keep English by default and translate with a translator", () => {
  it("age, mode and tracking state labels", () => {
    expect(ageLabel(185)).toBe("3 min ago");
    expect(ageLabel(185, createT("de"))).toBe("vor 3 Min.");
    expect(modeLabel("pilot")).toBe("Pilot (named drivers)");
    expect(modeLabel("active_tours", createT("ar"))).toBe("جميع السائقين المؤهلين");
    expect(trackingStateLabel("awaiting_acknowledgement", createT("de"))).toBe("Kenntnisnahme ausstehend");
  });
});

describe("Settings · live tracking in German and Arabic", () => {
  it("German: the mode dialog states that acknowledgement is not consent", async () => {
    const user = userEvent.setup();
    search = "section=tracking";
    wrap(<SettingsView />, "de");
    const table = await screen.findByRole("table", { name: "Ortungsstatus der Fahrer" });
    expect(within(table).getByText("Kenntnisnahme ausstehend")).toBeTruthy();
    expect(within(table).getByText("v1 – v2 ausstehend")).toBeTruthy();
    expect(screen.getByText("Diese Liste zeigt nie, wo sich ein Fahrer befindet.", { exact: false })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Alle berechtigten Fahrer/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/ersetzt keine Einwilligung und kein arbeitsrechtliches Verfahren/)).toBeTruthy();
    expect(within(dialog).getByText(/§ 87 Abs\. 1 Nr\. 6 BetrVG/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Umstellen" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByRole("checkbox", { name: "Ich bestätige die Voraussetzungen" })).toBeTruthy();
    expect(screen.queryByText("Live tracking")).toBeNull();
    expect(screen.queryByText(/does not replace any consent/)).toBeNull();
  });

  it("Arabic: sections, tracking texts and the acknowledgement-is-not-consent note", async () => {
    const user = userEvent.setup();
    search = "section=tracking";
    wrap(<SettingsView />, "ar");
    await screen.findByRole("table", { name: "حالة تتبع السائقين" });
    expect(screen.getByRole("button", { name: /تفضيلاتي/ })).toBeTruthy();
    expect(screen.getAllByText("بانتظار تأكيد الاطلاع").length).toBeGreaterThan(0);
    expect(screen.getByText("30 يومًا")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /جميع السائقين المؤهلين/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/لا يحل محل أي موافقة أو أي إجراء يقتضيه قانون العمل/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "إلغاء" })).toBeTruthy();
    expect(screen.queryByText("Driver tracking status")).toBeNull();
    expect(screen.queryByText("Awaiting acknowledgement")).toBeNull();
  });

  it("German preferences keep the language selector and translate the rest", async () => {
    wrap(<SettingsView />, "de");
    expect(await screen.findByRole("radiogroup", { name: "Sprache" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dunkel" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Standard-Standort" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Einstellungen speichern" })).toBeTruthy();
    expect(screen.queryByText("Save preferences")).toBeNull();
  });
});

describe("Fleet & team and tracking panel", () => {
  it("German vehicles tab and Arabic team tab with role names and scope", async () => {
    search = "tab=vehicles";
    const { unmount } = wrap(<FleetView />, "de");
    expect(await screen.findByText("Sprinter 1")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Flotte & Team" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Kennzeichen" })).toBeTruthy();
    expect(screen.getByText("Aktiv")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Fahrzeug hinzufügen/ })).toBeTruthy();
    expect(screen.queryByText("Add vehicle")).toBeNull();
    unmount();
    search = "tab=team";
    wrap(<FleetView />, "ar");
    expect(await screen.findByText("d@example.test")).toBeTruthy();
    expect(screen.getByText("منسق إرسال")).toBeTruthy();
    expect(screen.getByText("لا مواقع – لا وصول")).toBeTruthy();
    expect(screen.getByRole("button", { name: /دعوة عضو/ })).toBeTruthy();
    expect(screen.queryByText("Invite member")).toBeNull();
  });

  it("Arabic tracking panel counts and explains states", async () => {
    mode = "pilot";
    drivers = [drv({ driverId: "b", name: "B Ack", currentTour: { id: "t", name: "HAN-01", status: "in_progress" } })];
    wrap(<TrackingStatusPanel />, "ar");
    const counts = await screen.findByTestId("tracking-counts");
    expect(counts.textContent).toContain("1 بانتظار تأكيد الاطلاع");
    expect(screen.getByText("الوضع: تجريبي (سائقون محددون)")).toBeTruthy();
    expect(screen.queryByText(/Awaiting acknowledgement/)).toBeNull();
  });
});
