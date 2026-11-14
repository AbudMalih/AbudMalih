/**
 * Map → My location (hook level, separate file for a clean module registry): permission, instant centre on the last fix, fresh fix, no snap-back after the
 * driver moved the map, visible failure states, and an accurate privacy text for the tracking state.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useTourStore } from "../src/store/tourStore";
import { useTrackingStatus } from "../src/lib/tracking";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

type Fix = { ok: true; point: { lat: number; lng: number }; accuracy: number } | { ok: false; reason: string } | null;
const mockLoc = {
  locationPermission: jest.fn<Promise<string>, []>(),
  requestLocationPermission: jest.fn<Promise<string>, []>(),
  lastKnownPosition: jest.fn<Promise<Fix>, []>(),
  currentPosition: jest.fn<Promise<Fix>, unknown[]>(),
};
jest.mock("../src/lib/location", () => ({
  locationPermission: () => mockLoc.locationPermission(),
  requestLocationPermission: () => mockLoc.requestLocationPermission(),
  lastKnownPosition: () => mockLoc.lastKnownPosition(),
  currentPosition: (...a: unknown[]) => mockLoc.currentPosition(...a),
}));

import { useMyLocation } from "../src/lib/useMyLocation";

const LAST: Fix = { ok: true, point: { lat: 52.37, lng: 9.73 }, accuracy: 30 };
const FRESH: Fix = { ok: true, point: { lat: 52.3801, lng: 9.7402 }, accuracy: 8 };
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};

beforeEach(() => {
  useTourStore.getState().resetData();
  useTourStore.getState().setLocale("en");
  useTrackingStatus.setState({ state: "off" });
  mockLoc.locationPermission.mockReset().mockResolvedValue("undetermined");
  mockLoc.requestLocationPermission.mockReset().mockResolvedValue("granted");
  mockLoc.lastKnownPosition.mockReset().mockResolvedValue(LAST);
  mockLoc.currentPosition.mockReset().mockResolvedValue(FRESH);
});

describe("useMyLocation – failure states and privacy text", () => {
  async function run() {
    const h = await renderHook(() => useMyLocation());
    await act(async () => h.result.current.locate());
    return h;
  }

  it("explains a denied permission and offers Settings when it cannot be asked again", async () => {
    mockLoc.requestLocationPermission.mockResolvedValue("blocked");
    const h = await run();
    expect(h.result.current.notice).toMatchObject({ tone: "warning", action: { label: "Settings" } });
    expect(h.result.current.notice!.text).toMatch(/Location access is off/);
    expect(h.result.current.focus).toBeNull();
    expect(h.result.current.locating).toBe(false);
  });

  it("asks again (Retry) when permission was only denied once", async () => {
    mockLoc.requestLocationPermission.mockResolvedValue("denied");
    const h = await run();
    expect(h.result.current.notice?.action?.label).toBe("Retry");
  });

  it("offers Retry when no position is available, and Retry runs the lookup again", async () => {
    mockLoc.lastKnownPosition.mockResolvedValue(null);
    mockLoc.currentPosition.mockResolvedValue({ ok: false, reason: "unavailable" });
    const h = await run();
    expect(h.result.current.notice!.text).toMatch(/not available right now/);
    await act(async () => h.result.current.notice!.action!.onPress());
    await settle();
    expect(mockLoc.requestLocationPermission).toHaveBeenCalledTimes(2);
  });

  it("keeps the last known position and says so when no fresh fix arrives", async () => {
    mockLoc.currentPosition.mockResolvedValue({ ok: false, reason: "unavailable" });
    const h = await run();
    expect(h.result.current.focus).toMatchObject({ lat: 52.37 });
    expect(h.result.current.notice!.text).toMatch(/last known position/);
  });

  it("states that dispatch sees the position only when live tracking is actually active", async () => {
    useTrackingStatus.setState({ state: "active" });
    const h = await run();
    expect(h.result.current.notice!.text).toMatch(/Live tracking is on for this tour/);
  });
});
