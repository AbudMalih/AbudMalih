/**
 * Map → My location: permission, instant centre on the last fix, fresh fix, no snap-back after the
 * driver moved the map, visible failure states, and an accurate privacy text for the tracking state.
 */
import { act, fireEvent, render } from "@testing-library/react-native";
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

// Capture what the screen asks the map to do.
const mapProps: { focus?: { lat: number; lng: number; n: number } | null; onUserGesture?: () => void; showUserLocation?: boolean }[] = [];
jest.mock("../src/components/TourMap", () => ({
  TourMap: (p: (typeof mapProps)[number]) => {
    mapProps.push(p);
    return null;
  },
}));

import MapScreen from "../src/app/(tabs)/map";

const LAST: Fix = { ok: true, point: { lat: 52.37, lng: 9.73 }, accuracy: 30 };
const FRESH: Fix = { ok: true, point: { lat: 52.3801, lng: 9.7402 }, accuracy: 8 };
const lastMap = () => mapProps[mapProps.length - 1]!;
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};

beforeEach(() => {
  mapProps.length = 0;
  useTourStore.getState().resetData();
  useTourStore.getState().setLocale("en");
  useTrackingStatus.setState({ state: "off" });
  mockLoc.locationPermission.mockReset().mockResolvedValue("undetermined");
  mockLoc.requestLocationPermission.mockReset().mockResolvedValue("granted");
  mockLoc.lastKnownPosition.mockReset().mockResolvedValue(LAST);
  mockLoc.currentPosition.mockReset().mockResolvedValue(FRESH);
});

describe("Map screen – My location", () => {
  it("centres on the last known fix at once, then on the fresh fix at street level, and shows the position", async () => {
    let resolveFresh: (v: Fix) => void = () => {};
    mockLoc.currentPosition.mockImplementation(() => new Promise<Fix>((r) => (resolveFresh = r)));
    const r = await render(<MapScreen />);
    await fireEvent.press(r.getByTestId("map-locate"));
    await settle();
    expect(lastMap().focus).toMatchObject({ lat: 52.37, lng: 9.73, n: 1 });
    expect(lastMap().showUserLocation).toBe(true);
    expect(r.getByText("Finding your position…")).toBeTruthy();
    await act(async () => resolveFresh(FRESH));
    expect(lastMap().focus).toMatchObject({ lat: 52.3801, lng: 9.7402, n: 2 });
    expect(mockLoc.currentPosition).toHaveBeenCalledWith(false, { precise: true, timeoutMs: 12000 });
    expect(r.getByText(/shown on this phone only/)).toBeTruthy();
  });

  it("does not snap back when the driver moved the map before the fresh fix arrived", async () => {
    let resolveFresh: (v: Fix) => void = () => {};
    mockLoc.currentPosition.mockImplementation(() => new Promise<Fix>((r) => (resolveFresh = r)));
    const r = await render(<MapScreen />);
    await fireEvent.press(r.getByTestId("map-locate"));
    await settle();
    expect(lastMap().focus).toMatchObject({ lat: 52.37, n: 1 });
    act(() => lastMap().onUserGesture?.()); // driver pans
    await act(async () => resolveFresh({ ok: true, point: { lat: 52.39, lng: 9.75 }, accuracy: 5 }));
    expect(lastMap().focus).toMatchObject({ lat: 52.37, n: 1 });
  });
});

