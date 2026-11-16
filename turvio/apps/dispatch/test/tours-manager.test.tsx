import { createDispatchDataset, type Tour } from "@turvio/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StopEditActions } from "../components/StopEditActions";
import { TourActionsMenu } from "../components/TourActions";
import { ToursManager } from "../components/ToursManager";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { DispatchProvider, useDispatch, type SessionInfo } from "../lib/store";
import type { ListedTour } from "../lib/lifecycle";

/**
 * Phase C: Tours manager, tour actions, bulk work with previews, archive / restore, delete
 * eligibility and stop management – every control calls the real Phase B endpoint.
 */
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/list",
  useRouter: () => ({ push: vi.fn(), replace }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session = (role: SessionInfo["role"] = "admin"): SessionInfo => ({
  userName: "Test",
  email: "t@example.test",
  role,
  organizationId: "org_jarbou",
  organizationName: "JARBOU (synthetic)",
  companyWide: true,
  workspaces: [{ id: "org_jarbou", name: "JARBOU", role }],
  environment: null,
});

const tour = (over: Partial<Tour>): Tour => ({ ...base.tours[0]!, version: 3, publishedAt: null, archivedAt: null, closedAt: null, closedRemotely: false, closeReason: null, ...over });
const listed = (t: Tour, stops = 4): ListedTour => ({ tour: t, depotName: "Hannover", driverName: "Lena Hoffmann", vehicleLabel: null, stops: { total: stops, open: 1, delivered: stops - 1, notDelivered: 0, cancelled: 0, skipped: 0 } });

const completed = tour({ id: "t_done", name: "HAN-01", status: "completed", closedAt: "2026-11-05T16:00:00Z" });
const running = tour({ id: "t_run", name: "HAN-02", status: "in_progress", publishedAt: "2026-11-05T06:00:00Z" });
const draft = tour({ id: "t_draft", name: "HAN-03", status: "planned" });

let calls: { method: string; url: string; body: any }[] = [];
let listRows: ListedTour[] = [];
let eligibility: unknown;

beforeEach(() => {
  calls = [];
  listRows = [listed(completed), listed(running), listed(draft, 0)];
  eligibility = { tour: { id: "t_draft", name: "HAN-03", date: draft.date, status: "planned", driverName: null, version: 3 }, eligible: true, reasons: [], stops: 0, processedStops: 0, stopEvents: 0, proofs: 0, scannedParcels: 0, locationPoints: 0, completedDeliveries: 0 };
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
      if (url.includes("/tours/calendar")) return json({ month: "2026-11", days: [{ day: "2026-11-05", tours: 3, archived: 1, cancelled: 0, completed: 1, active: 1, empty: 1 }] });
      if (url.includes("/tours/bulk/preview"))
        return json({
          summary: { action: body.action, selected: 2, eligible: 1, protected: 1, unchanged: 0, affectedStops: 4, completedDeliveries: 3 },
          tours: [
            { id: "t_done", name: "HAN-01", date: "2026-11-05", status: "completed", published: false, archived: false, driverName: null, stops: 4, completedDeliveries: 3, openStops: 0, eligible: true, unchanged: false, reasons: [], version: 3 },
            { id: "t_run", name: "HAN-02", date: "2026-11-05", status: "in_progress", published: true, archived: false, driverName: null, stops: 4, completedDeliveries: 3, openStops: 1, eligible: false, unchanged: false, reasons: ["active"], version: 3 },
          ],
        });
      if (url.endsWith("/tours/bulk") && method === "POST") return json({ action: body.action, selected: 2, done: 1, unchanged: 0, skipped: 1, failed: 0, results: [{ id: "t_done", name: "HAN-01", result: "done" }, { id: "t_run", name: "HAN-02", result: "skipped", code: "active" }] });
      if (url.includes("/delete-eligibility")) return json(eligibility);
      if (url.includes("/tours?")) {
        const p = new URL(url, "http://x").searchParams;
        if (p.get("ids") === "1") return json({ total: 60, ids: listRows.map((r) => r.tour.id), truncated: false });
        return json({ range: { from: "2026-11-05", to: "2026-11-05" }, total: p.get("limit") === "1" ? 2 : 60, limit: 25, offset: 0, tours: listRows });
      }
      if (method === "DELETE") return new Response(null, { status: 204 });
      if (url.endsWith("/close")) return json({ tour: { ...running, status: body.status }, openStops: { count: 1, action: "returned_to_pool" } });
      return json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap(ui: ReactNode, role: SessionInfo["role"] = "admin") {
  return render(
    <TooltipProvider>
      <DispatchProvider base={base} session={session(role)}>
        {ui}
      </DispatchProvider>
    </TooltipProvider>,
  );
}
const listCalls = () => calls.filter((c) => c.method === "GET" && c.url.includes("/tours?") && !c.url.includes("ids=1"));
const lastList = () => new URL(listCalls().at(-1)!.url, "http://x").searchParams;

describe("Tours manager", () => {
  it("loads the server list for the day; month and archived views send their filters", async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<ToursManager archived="exclude" />);
    expect(await screen.findByText("HAN-01")).toBeTruthy();
    expect(lastList().get("date")).toBe(base.date);
    expect(lastList().get("archived")).toBe("exclude");
    await user.click(screen.getByRole("tab", { name: "Month" }));
    await waitFor(() => expect(lastList().get("month")).toBe(base.date.slice(0, 7)));
    await user.click(screen.getByRole("checkbox", { name: "Only tours without stops" }));
    await waitFor(() => expect(lastList().get("empty")).toBe("true"));
    unmount();
    wrap(<ToursManager archived="only" />);
    await screen.findAllByText("HAN-01");
    expect(lastList().get("archived")).toBe("only");
    expect(lastList().get("month")).toBe(base.date.slice(0, 7));
  });

  it("bulk archive: preview shows exact counts and reasons, the run sends the selected ids with the seen versions", async () => {
    const user = userEvent.setup();
    wrap(<ToursManager archived="exclude" />);
    await screen.findByText("HAN-01");
    await user.click(screen.getByRole("checkbox", { name: `Select HAN-01 ${completed.date}` }));
    await user.click(screen.getByRole("checkbox", { name: `Select HAN-02 ${running.date}` }));
    expect(screen.getByTestId("selection-count").textContent).toMatch(/^2 selected/);
    await user.click(within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: /Archive/ }));
    const preview = await screen.findByTestId("bulk-preview");
    expect(within(preview).getByText("Will change").previousSibling?.textContent).toBe("1");
    expect(within(preview).getByText("Not possible").previousSibling?.textContent).toBe("1");
    expect(within(preview).getByText(/HAN-02.*running/)).toBeTruthy();
    const pv = calls.find((c) => c.url.endsWith("/tours/bulk/preview"))!;
    expect(pv.body).toEqual({ action: "archive", selection: { tourIds: ["t_done", "t_run"] } });
    await user.click(screen.getByRole("button", { name: "Archive 1 tour" }));
    await screen.findByTestId("bulk-result");
    const run = calls.find((c) => c.method === "POST" && c.url.endsWith("/tours/bulk"))!;
    expect(run.body).toEqual({ action: "archive", selection: { tourIds: ["t_done", "t_run"] }, versions: { t_done: 3, t_run: 3 } });
  });

  it("select all matching uses the server filter; finish needs a reason", async () => {
    const user = userEvent.setup();
    wrap(<ToursManager archived="exclude" />);
    await screen.findByText("HAN-01");
    await user.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 60 matching" }));
    expect(screen.getByTestId("selection-count").textContent).toMatch(/60 selected \(all matching/);
    await user.click(screen.getByRole("button", { name: /Finish…/ }));
    await screen.findByTestId("bulk-preview");
    const go = screen.getByRole("button", { name: "Finish 1 tour" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await user.type(screen.getByRole("textbox", { name: "Reason" }), "Schicht beendet");
    await user.click(go);
    await screen.findByTestId("bulk-result");
    const run = calls.find((c) => c.method === "POST" && c.url.endsWith("/tours/bulk"))!;
    expect(run.body).toMatchObject({ action: "finish", reason: "Schicht beendet", openStops: "return", selection: { filter: { date: base.date, archived: "exclude" } } });
    expect(run.body.versions).toBeUndefined();
  });

  it("daily clean-up counts closed tours and empty drafts and previews them with day filters", async () => {
    const user = userEvent.setup();
    wrap(<ToursManager archived="exclude" />);
    await screen.findByText("HAN-01");
    await user.click(screen.getByRole("button", { name: /Clean up a day/ }));
    await user.click(await screen.findByRole("button", { name: /Delete 2 empty draft/ }));
    await screen.findByTestId("bulk-preview");
    const pv = calls.filter((c) => c.url.endsWith("/tours/bulk/preview")).at(-1)!;
    expect(pv.body.action).toBe("delete");
    expect(pv.body.selection.filter).toMatchObject({ status: ["planned"], empty: true, published: false, archived: "exclude" });
  });

  it("export downloads the filtered list (CSV and Excel)", async () => {
    const user = userEvent.setup();
    const clicked: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute("href")!);
    });
    wrap(<ToursManager archived="only" />);
    await screen.findAllByText("HAN-01");
    await user.click(screen.getByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "CSV (Excel, semicolon)" }));
    spy.mockRestore();
    const p = new URL(clicked[0]!, "http://x");
    expect(p.pathname).toBe("/api/turvio/v1/orgs/org_jarbou/tours/export");
    expect([p.searchParams.get("archived"), p.searchParams.get("format")]).toEqual(["only", "csv"]);
  });

  it("the calendar shows per-day counts and jumps to the picked day", async () => {
    const user = userEvent.setup();
    wrap(<ToursManager archived="exclude" />);
    await screen.findByText("HAN-01");
    await user.click(screen.getByRole("button", { name: /Calendar/ }));
    await user.click(await screen.findByRole("button", { name: "2026-11-05: 3 tour(s)" }));
    await waitFor(() => expect(lastList().get("date")).toBe("2026-11-05"));
  });
});

describe("tour actions", () => {
  it("offers only what the state allows: completed → archive / duplicate, running → finish / cancel", async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<TourActionsMenu item={{ tour: completed, stopCount: 4 }} />);
    await user.click(screen.getByRole("button", { name: "Actions for HAN-01" }));
    const items = (await screen.findAllByRole("menuitem")).map((m) => m.textContent);
    expect(items).toEqual(expect.arrayContaining(["Duplicate…", "Archive", "Delete permanently…"]));
    expect(items).not.toContain("Finish remotely…");
    expect(items).not.toContain("Edit tour…");
    unmount();
    wrap(<TourActionsMenu item={{ tour: running, stopCount: 4 }} />);
    await user.click(screen.getByRole("button", { name: "Actions for HAN-02" }));
    const run = (await screen.findAllByRole("menuitem")).map((m) => m.textContent);
    expect(run).toEqual(expect.arrayContaining(["Finish remotely…", "Cancel tour…", "Edit tour…"]));
    expect(run).not.toContain("Archive");
    expect(run).not.toContain("Delete permanently…");
  });

  it("finish remotely: reason required; sends status, reason and the open-stop choice", async () => {
    const user = userEvent.setup();
    wrap(<TourActionsMenu item={{ tour: running, stopCount: 4, openStops: 1, driverName: "Lena" }} />);
    await user.click(screen.getByRole("button", { name: "Actions for HAN-02" }));
    await user.click(await screen.findByRole("menuitem", { name: "Finish remotely…" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Live tracking for it stops now/)).toBeTruthy();
    const go = within(dialog).getByRole("button", { name: "Finish tour" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await user.type(within(dialog).getByRole("textbox", { name: "Reason" }), "Fahrzeugschaden");
    await user.click(within(dialog).getByRole("radio", { name: /Cancel them/ }));
    await user.click(go);
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/tours/t_run/close"))).toBeTruthy());
    expect(calls.find((c) => c.url.endsWith("/tours/t_run/close"))!.body).toEqual({ status: "completed", expectedVersion: 3, reason: "Fahrzeugschaden", openStops: "cancel" });
  });

  it("delete: a protected tour shows why and cannot be deleted", async () => {
    eligibility = {
      tour: { id: "t_done", name: "HAN-01", date: completed.date, status: "completed", driverName: "Lena Hoffmann", version: 3 },
      eligible: false,
      reasons: ["status_completed", "processed_stops", "proofs"],
      stops: 4, processedStops: 3, stopEvents: 6, proofs: 2, scannedParcels: 0, locationPoints: 0, completedDeliveries: 3,
    };
    const user = userEvent.setup();
    wrap(<TourActionsMenu item={{ tour: completed, stopCount: 4 }} />);
    await user.click(screen.getByRole("button", { name: "Actions for HAN-01" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete permanently…" }));
    const preview = await screen.findByTestId("delete-preview");
    expect(within(preview).getByText(/Protected – cannot be deleted/)).toBeTruthy();
    expect(within(preview).getByText(/has proofs of delivery/)).toBeTruthy();
    expect(within(preview).getByText(/3 stops with an outcome · 6 stop history entries · 2 proofs of delivery/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Delete permanently" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("delete: an eligible draft is deleted with the version from the preview", async () => {
    const user = userEvent.setup();
    wrap(<TourActionsMenu item={{ tour: draft, stopCount: 0 }} />);
    await user.click(screen.getByRole("button", { name: "Actions for HAN-03" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete permanently…" }));
    await screen.findByText(/Eligible: no deliveries/);
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(calls.find((c) => c.method === "DELETE")).toBeTruthy());
    expect(calls.find((c) => c.method === "DELETE")!.url).toBe("/api/turvio/v1/orgs/org_jarbou/tours/t_draft?expectedVersion=3&deleteStops=false");
  });

  it("archived tours offer restore (status unchanged) and nothing that edits them", async () => {
    const user = userEvent.setup();
    wrap(<TourActionsMenu item={{ tour: { ...completed, archivedAt: "2026-11-06T08:00:00Z" }, stopCount: 4 }} />);
    await user.click(screen.getByRole("button", { name: "Actions for HAN-01" }));
    const items = (await screen.findAllByRole("menuitem")).map((m) => m.textContent);
    expect(items).toContain("Restore from archive");
    expect(items).not.toContain("Archive");
    await user.click(screen.getByRole("menuitem", { name: "Restore from archive" }));
    expect(await screen.findByText(/A completed or cancelled tour is not reopened/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/tours/t_done/restore"))!.body).toEqual({ expectedVersion: 3 }));
  });
});

describe("stop management", () => {
  function StopHarness() {
    const { summaries } = useDispatch();
    const s = summaries.find((x) => x.stops.some((st) => st.status === "pending"))!;
    const stop = s.stops.find((st) => st.status === "pending")!;
    return (
      <div data-stop={stop.id}>
        <StopEditActions summary={s} stop={stop} />
      </div>
    );
  }

  it("Remove returns the stop to the unassigned list; Cancel needs a reason and calls the cancel endpoint", async () => {
    const user = userEvent.setup();
    const { container } = wrap(<StopHarness />);
    const stopId = container.querySelector("[data-stop]")!.getAttribute("data-stop")!;
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await user.click(await screen.findByRole("button", { name: "Remove from tour" }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/stops/assign"))!.body).toEqual({ stopIds: [stopId], tourId: null }));
    await user.click(screen.getByRole("button", { name: /Cancel stop/ }));
    const dialog = await screen.findByRole("dialog");
    const go = within(dialog).getByRole("button", { name: /Cancel stop/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await user.type(within(dialog).getByRole("textbox", { name: "Reason for cancelling the stop" }), "Kunde verzogen");
    await user.click(go);
    await waitFor(() => expect(calls.find((c) => c.url.endsWith(`/stops/${stopId}/cancel`))!.body).toEqual({ reason: "Kunde verzogen" }));
  });
});
