import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 2 },
}));
type LocMock = Record<"getForegroundPermissionsAsync" | "requestForegroundPermissionsAsync" | "getBackgroundPermissionsAsync" | "requestBackgroundPermissionsAsync" | "hasStartedLocationUpdatesAsync" | "startLocationUpdatesAsync" | "stopLocationUpdatesAsync", jest.Mock>;
const mockLoc = jest.requireMock("expo-location") as LocMock;
let mockTaskExecutor: ((body: { data?: unknown; error?: unknown }) => Promise<void>) | null = null;
jest.mock("expo-task-manager", () => ({
  isTaskDefined: () => mockTaskExecutor !== null,
  defineTask: (_name: string, fn: typeof mockTaskExecutor) => {
    mockTaskExecutor = fn;
  },
}));

import { ApiError } from "../src/lib/auth";
import { bufferedCount, clearBuffer } from "../src/lib/trackingBuffer";
import { TRACKING_TASK, defineTrackingTask, keepFix, resetFixFilter, readSession, setTrackingClient, startTracking, stopTracking, uploadNow, useTrackingStatus } from "../src/lib/tracking";

const input = { orgId: "org1", tourId: "tour1", tourName: "Hannover List", notificationTitle: "T", notificationBody: "B" };
let config: Record<string, unknown>;
const request = jest.fn();
setTrackingClient(() => ({ request }) as never);

const granted = { status: "granted", canAskAgain: true };
let running = false;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await clearBuffer();
  running = false;
  config = { mode: "active_tours", intervalSeconds: 10, noticeVersion: 1, acknowledgedVersion: 1, retentionDays: 30 };
  request.mockImplementation(async (method: string, path: string) => {
    if (method === "GET" && path.endsWith("/tracking/config")) return config;
    if (method === "POST" && path.endsWith("/locations")) return { accepted: 1, duplicates: 0, rejected: [] };
    throw new Error(`unexpected ${method} ${path}`);
  });
  mockLoc.getForegroundPermissionsAsync.mockResolvedValue(granted);
  mockLoc.getBackgroundPermissionsAsync.mockResolvedValue(granted);
  mockLoc.hasStartedLocationUpdatesAsync.mockImplementation(async () => running);
  mockLoc.startLocationUpdatesAsync.mockImplementation(async () => {
    running = true;
  });
  mockLoc.stopLocationUpdatesAsync.mockImplementation(async () => {
    running = false;
  });
});

describe("live tracking lifecycle", () => {
  it("does not record anything while the company has tracking switched off", async () => {
    config.mode = "off";
    expect(await startTracking(input, { requestPermissions: true })).toBe("disabled");
    expect(mockLoc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockLoc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(await readSession()).toBeNull();
  });

  it("waits for the driver to acknowledge the notice before asking for anything", async () => {
    config.acknowledgedVersion = null;
    expect(await startTracking(input, { requestPermissions: true })).toBe("notice_required");
    expect(mockLoc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockLoc.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("reports a missing background permission instead of pretending to track", async () => {
    mockLoc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    mockLoc.requestBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: false });
    expect(await startTracking(input, { requestPermissions: true })).toBe("permission_denied");
    expect(mockLoc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(useTrackingStatus.getState().state).toBe("permission_denied");
  });

  it("starts one foreground-service session per tour (no duplicates) with the company interval", async () => {
    expect(await startTracking(input, { requestPermissions: true })).toBe("active");
    expect(await startTracking(input, { requestPermissions: false })).toBe("active");
    expect(mockLoc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    const [task, opts] = mockLoc.startLocationUpdatesAsync.mock.calls[0]!;
    expect(task).toBe(TRACKING_TASK);
    expect(opts).toMatchObject({ timeInterval: 10_000, distanceInterval: 0, foregroundService: { notificationTitle: "T", notificationBody: "B" } });
    expect((await readSession())?.tourId).toBe("tour1");
  });

  it("buffers fixes from the background task and stops cleanly, uploading the rest", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await mockTaskExecutor!({ data: { locations: [{ coords: { latitude: 52.38, longitude: 9.74, accuracy: 5, speed: -1, heading: 10 }, timestamp: Date.now() }] } });
    // Uploads at most every 15 s: the first fix is uploaded immediately, a second one waits.
    await mockTaskExecutor!({ data: { locations: [{ coords: { latitude: 52.381, longitude: 9.741, accuracy: 5, speed: 3, heading: 10 }, timestamp: Date.now() }] } });
    expect(await bufferedCount()).toBe(1);
    await stopTracking();
    expect(mockLoc.stopLocationUpdatesAsync).toHaveBeenCalledWith(TRACKING_TASK);
    expect(await bufferedCount()).toBe(0);
    expect(await readSession()).toBeNull();
    const uploads = request.mock.calls.filter(([m, p]) => m === "POST" && String(p).endsWith("/locations"));
    expect(uploads).toHaveLength(2);
    // Negative speed (unknown) is sent as null, never as a made-up value.
    expect(uploads[0]![2].points[0].speed).toBeNull();
  });

  it("never records without an active session (e.g. after the tour ended while the app was closed)", async () => {
    defineTrackingTask();
    running = true;
    await mockTaskExecutor!({ data: { locations: [{ coords: { latitude: 1, longitude: 1 }, timestamp: Date.now() }] } });
    expect(await bufferedCount()).toBe(0);
    expect(mockLoc.stopLocationUpdatesAsync).toHaveBeenCalled();
  });

  it("company switched tracking off mid-tour: stops and deletes buffered positions", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    request.mockImplementation(async (method: string, path: string) => {
      if (path.endsWith("/locations")) throw new ApiError(409, "tracking_disabled", "off");
      return config;
    });
    await mockTaskExecutor!({ data: { locations: [{ coords: { latitude: 52.38, longitude: 9.74 }, timestamp: Date.now() + 20_000 }] } });
    // (upload throttled) – force it:
    await uploadNow();
    expect(useTrackingStatus.getState().state).toBe("disabled");
    expect(await bufferedCount()).toBe(0);
    expect(running).toBe(false);
  });

  it("thins fixes while parked but keeps a once-a-minute sign of life", () => {
    resetFixFilter();
    const t0 = 1_700_000_000_000;
    const p = (dSeconds: number, dMeters = 0) => ({ lat: 52.38 + dMeters / 111_320, lng: 9.74, at: t0 + dSeconds * 1000 });
    expect(keepFix(p(0))).toBe(true);
    expect(keepFix(p(10, 3))).toBe(false); // parked, GPS jitter
    expect(keepFix(p(20, 2))).toBe(false);
    expect(keepFix(p(61, 1))).toBe(true); // one per minute
    expect(keepFix(p(71, 40))).toBe(true); // moving again
  });
});
