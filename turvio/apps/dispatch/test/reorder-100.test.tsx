import { summarizeTours, type DispatchDataset, type Stop, type Tour } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TourDetail } from "../components/TourDetail";
import { moveOpenStop } from "../lib/helpers";
import { I18nProvider } from "../lib/i18n/client";
import { DispatchProvider, type SessionInfo } from "../lib/store";

/**
 * 80–100-stop tours: any stop reaches any position with one save (position field or drag-and-drop),
 * never one request per arrow click. Done stops keep their place.
 */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/planning", useRouter: () => ({ push: vi.fn() }) }));

describe("moveOpenStop", () => {
  const ids = ["a", "b", "c", "d"];
  it("moves forward, backward and clamps", () => {
    expect(moveOpenStop(ids, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveOpenStop(ids, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveOpenStop(ids, "b", 99)).toEqual(["a", "c", "d", "b"]);
    expect(moveOpenStop(ids, "x", 1)).toEqual(ids);
  });
});

const N = 100;
const stop = (i: number): Stop =>
  ({
    id: `s${i}`,
    organizationId: "o",
    tourId: "T",
    type: "delivery",
    sequence: i,
    status: i < 3 ? "delivered" : "pending",
    completedAt: i < 3 ? "2026-11-10T08:30:00.000Z" : undefined,
    recipientName: `Kunde ${i}`,
    address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30161", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.38 + i * 0.0005, lng: 9.74 },
    serviceSeconds: 120,
    priority: false,
    parcels: [],
  }) as Stop;
const tour = { id: "T", organizationId: "o", name: "Tour 100", date: "2026-11-10", depotId: "d", driverId: "d1", vehicleId: null, status: "in_progress", startedAt: "2026-11-10T08:00:00.000Z", plannedStartMinute: 480, version: 1 } as Tour;
const data = {
  organizationId: "o",
  date: "2026-11-10",
  asOfMinute: 600,
  isToday: true,
  timeZone: "UTC",
  depots: [{ id: "d", organizationId: "o", name: "Depot", address: { street: "x", houseNumber: "1", postalCode: "30161", city: "Hannover", countryCode: "DE" }, location: { lat: 52.37, lng: 9.73 } }],
  drivers: [{ id: "d1", organizationId: "o", displayName: "Fahrer", depotId: "d", maxShiftMinutes: 480, active: true }],
  vehicles: [],
  tours: [tour],
  stops: Array.from({ length: N }, (_, i) => stop(i)),
  unassigned: [],
} as unknown as DispatchDataset;
const session: SessionInfo = { userName: "T", email: "t@example.test", role: "dispatcher", organizationId: "o", organizationName: "Test (synthetic)", companyWide: true, workspaces: [{ id: "o", name: "Test", role: "dispatcher" }], environment: null };

const saves: Array<string[]> = [];
beforeEach(() => {
  saves.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/sequence")) {
        saves.push(JSON.parse(String(init!.body)).stopIds);
        return new Response(null, { status: 204 });
      }
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(data), { status: 200 });
      if (url.endsWith("/events")) return new Response("[]", { status: 200 });
      return new Response("{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap() {
  const summary = summarizeTours(data).find((s) => s.tour.id === "T")!;
  return render(
    <I18nProvider initial="en">
      <TooltipProvider>
        <DispatchProvider base={data} session={session}>
          <TourDetail summary={summary} />
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );
}
const openIds = () => data.stops.filter((s) => s.status === "pending").map((s) => s.id);

describe("100-stop tour reordering", () => {
  it("position field: stop 4 to position 80 in one save", async () => {
    wrap();
    await userEvent.click(screen.getByRole("button", { name: /^Kunde 3Teststraße/ }));
    const actions = await screen.findByTestId("stop-edit-actions");
    await userEvent.type(within(actions).getByLabelText("Position"), "80");
    await userEvent.click(within(actions).getByRole("button", { name: "Move" }));
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toHaveLength(N - 3);
    expect(saves[0]!.indexOf("s3")).toBe(79);
    expect(saves[0]).toEqual(moveOpenStop(openIds(), "s3", 79));
  });

  it("drag-and-drop: last open stop onto the first open one, one save; done stops are not draggable", async () => {
    wrap();
    const rows = screen.getAllByTestId("draggable-stop");
    expect(rows).toHaveLength(N - 3);
    const store = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => store.set(k, v), getData: (k: string) => store.get(k) ?? "", effectAllowed: "" };
    fireEvent.dragStart(rows[rows.length - 1]!, { dataTransfer });
    fireEvent.dragOver(rows[0]!, { dataTransfer });
    fireEvent.drop(rows[0]!, { dataTransfer });
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]![0]).toBe(`s${N - 1}`);
    expect(saves[0]).toHaveLength(N - 3);
  });
});
