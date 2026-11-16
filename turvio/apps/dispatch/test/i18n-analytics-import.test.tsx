import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsView } from "../components/AnalyticsView";
import { FileImport } from "../components/FileImport";
import { PickupsView } from "../components/PickupsView";
import { analyticsApi, num, pct } from "../lib/analytics";
import { createFormat, createT, type Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n/client";
import { optimizeNotes, optimizeProblems } from "../lib/optimize";
import { DispatchProvider, type SessionInfo, type OptimizeMeta } from "../lib/store";

/** Analytics, pickups and file import in German and Arabic. */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/analytics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = {
  userName: "Test",
  email: "t@example.test",
  role: "dispatcher",
  organizationId: "org_jarbou",
  organizationName: "JARBOU (synthetic)",
  companyWide: true,
  workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "dispatcher" }],
  environment: null,
};

const figures = (n: number) => ({
  stops: { stops: 120 * n, delivered: 90 * n, pickedUp: 6 * n, failed: 8 * n, attempted: 2 * n, rescheduled: 0, returned: 0, skipped: 2 * n, cancelled: 4 * n, open: 8 * n, processed: 108 * n, successRate: n ? 0.8889 : null },
  tours: { tours: 6 * n, byStatus: { planned: n, running: n, completed: 4 * n, cancelled: 0 }, archived: 0, toursStarted: 5 * n, completionRate: 0.8, onTimeStartRate: 0.6, avgTourMinutes: 412, activeHours: 27.5, stopsPerTour: 21.6, stopsPerActiveHour: 3.4, planned: { coveredTours: 3, plannedDistanceKm: 214.6, plannedMinutes: 1205 } },
  avgIntervalMinutes: 11.2,
});
const summary = {
  range: { from: "2026-11-02", to: "2026-11-05" },
  previousRange: { from: "2026-10-29", to: "2026-11-01" },
  timeZone: "Europe/Berlin",
  granularity: "week",
  onTimeToleranceMinutes: 15,
  current: figures(1),
  previous: figures(0),
  trend: [{ bucket: "2026-11-02", tours: 2, toursCompleted: 2, stops: 50, delivered: 40, pickedUp: 2, failed: 4, attempted: 1, rescheduled: 0, returned: 0, skipped: 1, cancelled: 2, open: 0, processed: 48, successRate: 0.875 }],
  failureReasons: [{ reason: "recipient_absent", status: "failed", count: 8 }],
  definitions: {
    successRate: "(Delivered + picked up) ÷ processed stops. Open and cancelled stops are excluded.",
    avgIntervalMinutes: "Average time between two consecutive recorded outcomes on the same tour. This is not the service time at a stop.",
    someNewFigure: "A figure the client does not know yet.",
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.includes("/dispatch?")) return json(base);
      if (url.endsWith("/events")) return json([]);
      if (url.includes("/location-checks")) return json({ checks: [], pending: false });
      if (url.endsWith("/v1/me/preferences") && method === "GET") return json({ language: null, theme: "system", dateFormat: "dmy", orgDefaults: {}, updatedAt: null });
      if (url.includes("/analytics/summary")) return json(summary);
      if (url.includes("/analytics/drivers")) return json({ drivers: [] });
      if (url.endsWith("/v1/geocode/postcodes")) return json({ available: true, results: [] });
      if (url.endsWith("/parcels/lookup")) return json({ found: [], blocking: 0 });
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

describe("Analytics in German and Arabic", () => {
  it("German: labels, KPI definitions by key, numbers and the chart stay LTR", async () => {
    wrap(<AnalyticsView />, "de");
    expect((await screen.findByTestId("kpi-Success rate")).textContent).toBe("88,9 %");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Auswertungen");
    expect(screen.getByRole("tab", { name: "Letzter Monat" })).toBeTruthy();
    expect(screen.getByText("Abstand zwischen Ergebnissen")).toBeTruthy();
    expect(screen.getByText("Nicht die Zeit am Stopp")).toBeTruthy();
    expect(screen.getByText("1.205 Min.")).toBeTruthy();
    // Known definition translated, keeping the accuracy rule; unknown keys would keep the server text.
    expect(screen.getByRole("button", { name: /Definition: \(Zugestellt \+ abgeholt\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /nicht die Servicezeit am Stopp/ })).toBeTruthy();
    expect(screen.getByText(/Empfänger nicht angetroffen/)).toBeTruthy();
    expect(screen.getAllByText(/KW ab 02\.11\./).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Bearbeitete Stopps pro Zeitraum" }).parentElement!.getAttribute("dir")).toBe("ltr");
    expect(screen.queryByText("Success rate")).toBeNull();
    expect(screen.queryByText("Interval between outcomes")).toBeNull();
  });

  it("Arabic: labels translated, English ones gone", async () => {
    wrap(<AnalyticsView />, "ar");
    await screen.findByTestId("kpi-Success rate");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("التحليلات");
    expect(screen.getByText("الفاصل بين النتائج")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "الشهر الماضي" })).toBeTruthy();
    expect(screen.queryByText("Breakdown")).toBeNull();
    expect(screen.queryByText("Last month")).toBeNull();
  });

  it("exports ask the API for headings in the user's language; figures formatting is unchanged without fmt", () => {
    const url = analyticsApi("org").exportUrl({ from: "2026-11-01", to: "2026-11-05" }, "drivers", "csv", "ar");
    expect(new URL(url, "http://x").searchParams.get("lang")).toBe("ar");
    expect(pct(0.8889)).toBe("88.9 %");
    expect(num(1205)).toBe("1.205");
    expect(pct(0.8889, 1, createFormat("en"))).toBe("88.9 %");
    expect(num(1205, 0, createFormat("en"))).toBe("1,205");
  });
});

describe("Pickups and optimizer messages", () => {
  it("German pickups page", async () => {
    wrap(<PickupsView />, "de");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Abholungen");
    expect(screen.getByRole("tab", { name: /^Handlungsbedarf/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^Alle/ })).toBeTruthy();
    expect(screen.queryByText("Needs attention")).toBeNull();
  });

  it("Arabic pickups page", async () => {
    wrap(<PickupsView />, "ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("عمليات الاستلام");
    expect(screen.queryByText("Pickups")).toBeNull();
  });

  it("optimizer problems keep English by default and are translated with t", () => {
    const r = { violations: [{ kind: "late", minutes: 12.4 }], unassignedStopIds: [], matrixSource: "osrm", approachStopIds: ["a", "b"] } as unknown as OptimizeMeta;
    expect(optimizeProblems(r)).toEqual(["1 stop(s) cannot be reached before their deadline (up to 12 min late)"]);
    expect(optimizeProblems(r, createT("de"))).toEqual(["1 Stopp kann nicht vor seiner Frist erreicht werden (bis zu 12 Min. zu spät)"]);
    expect(optimizeNotes(r, createT("ar"))).toEqual(["أوقات القيادة من شبكة الطرق", "وُجّهت محطتان إلى نقطة الاقتراب المعتمدة لهما"]);
  });
});

describe("File import in German and Arabic", () => {
  const CSV = ["Sdg-Nr;Empf.;Anschrift;PLZ;Zielort", "TVO1000001;Kiosk am Platz;Lister Meile 44a;30161;Hannover", "TVO1000002;Anna Ay;Lister Meile 44a;30161;Hannover"].join("\n");

  for (const [locale, mapping, column, header, button] of [
    ["de", "Spaltenzuordnung", /^Spalte 1 /, "Spalten", /^(Importieren|\d+ Stopps? importieren)/],
    ["ar", "ربط الأعمدة", /^العمود 1 /, "الأعمدة", /^استيراد/],
  ] as const) {
    it(`${locale}: mapping UI and review are translated, data stays untouched`, async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      wrap(<FileImport organizationId="org_jarbou" onChange={onChange} />, locale);
      const input = document.querySelector("input[type=file]") as HTMLInputElement;
      await user.upload(input, new File([CSV], "m.csv", { type: "text/csv" }));
      const region = await screen.findByRole("region", { name: mapping });
      expect(within(region).getByText(header)).toBeTruthy();
      expect(within(region).getAllByRole("combobox", { name: column })).toHaveLength(1);
      expect(screen.getAllByText("Kiosk am Platz").length).toBeGreaterThan(0);
      expect(screen.queryByText("Columns")).toBeNull();
      expect(screen.queryByText("First row is a header")).toBeNull();
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      const label = onChange.mock.calls.at(-1)![0].label as string;
      expect(label).toMatch(button);
    });
  }
});
