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

jest.mock("../src/lib/optimizer", () => ({ ...jest.requireActual("../src/lib/optimizer"), apiBaseUrl: () => "https://api.example.test" }));

import { ApiError } from "../src/lib/auth";
import { setAuthClient, useTourStore } from "../src/store/tourStore";
import { appendFixes, bufferedCount, clearBuffer, type Fix } from "../src/lib/trackingBuffer";
import {
  MAX_ACCURACY_METERS,
  TRACKING_TASK,
  acknowledgeNotice,
  defineTrackingTask,
  isUsableLocation,
  isWithdrawalPending,
  keepFix,
  resetFixFilter,
  readSession,
  retryPendingWithdrawal,
  setTrackingClient,
  startTracking,
  stopTracking,
  uploadNow,
  useTrackingStatus,
  withdrawAcknowledgement,
} from "../src/lib/tracking";

const input = { orgId: "org1", tourId: "tour1", tourName: "Hannover List", notificationTitle: "T", notificationBody: "B" };
let config: Record<string, unknown>;
const request = jest.fn();
setTrackingClient(() => ({ request }) as never);
setAuthClient({ request } as never);

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
    expect(opts).toMatchObject({ accuracy: 4, timeInterval: 10_000, deferredUpdatesInterval: 10_000, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: "T", notificationBody: "B" } });
    // Battery: no fix every second while standing.
    expect(opts.distanceInterval).toBeGreaterThanOrEqual(10);
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

const at = (dSeconds: number) => Date.now() + dSeconds * 1000;
const loc = (lat: number, lng: number, accuracy: number | null | undefined, ts: number) => ({ coords: { latitude: lat, longitude: lng, accuracy, speed: 3, heading: 10 }, timestamp: ts });
const uploads = () => request.mock.calls.filter(([m, p]) => m === "POST" && String(p).endsWith("/locations"));
const withdrawCalls = () => request.mock.calls.filter(([m, p]) => m === "POST" && String(p).endsWith("/tracking/notice/withdraw"));
let fixN = 0;
const fix = (): Fix => ({ id: `f-${++fixN}`, orgId: "org1", tourId: "tour1", lat: 52.38, lng: 9.74, accuracy: 5, speed: 1, heading: 0, recordedAt: new Date().toISOString() });

describe("accuracy filter", () => {
  it("drops fixes worse than 500 m and fixes without coordinates; keeps the rest (also without accuracy)", () => {
    expect(MAX_ACCURACY_METERS).toBe(500);
    expect(isUsableLocation(loc(52.38, 9.74, 499, 0) as never)).toBe(true);
    expect(isUsableLocation(loc(52.38, 9.74, 500, 0) as never)).toBe(true);
    expect(isUsableLocation(loc(52.38, 9.74, 501, 0) as never)).toBe(false);
    expect(isUsableLocation(loc(52.38, 9.74, null, 0) as never)).toBe(true);
    expect(isUsableLocation({ coords: { latitude: NaN, longitude: 9.74 } } as never)).toBe(false);
    expect(isUsableLocation({ coords: { longitude: 9.74 } } as never)).toBe(false);
    expect(isUsableLocation({} as never)).toBe(false);
  });

  it("the background task never buffers a > 500 m guess", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    request.mockImplementation(async (method: string, path: string) => {
      if (path.endsWith("/locations")) throw new ApiError(0, "network", "offline");
      return config;
    });
    await mockTaskExecutor!({ data: { locations: [loc(52.38, 9.74, 2000, at(0)), loc(52.5, 9.9, 800, at(1)), { coords: {}, timestamp: at(2) }, loc(52.38, 9.74, 25, at(3))] } });
    expect(await bufferedCount()).toBe(1);
  });

  it("uploads are batched and throttled: one request for many fixes, not one per fix", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await uploadNow(); // resets the throttle window
    for (let i = 0; i < 5; i++) await mockTaskExecutor!({ data: { locations: [loc(52.38 + i * 0.01, 9.74, 5, at(i))] } });
    expect(uploads()).toHaveLength(0); // all within the 15 s window
    expect(await bufferedCount()).toBe(5);
    await uploadNow();
    expect(uploads()).toHaveLength(1);
    expect(uploads()[0]![2].points).toHaveLength(5);
  });
});

describe("refused uploads", () => {
  it("notice missing (new version): stops the task but keeps the positions for after re-acknowledgement", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await appendFixes([fix(), fix()]);
    request.mockImplementation(async (method: string, path: string) => {
      if (path.endsWith("/locations")) throw new ApiError(409, "tracking_notice_required", "notice");
      return config;
    });
    await uploadNow();
    expect(useTrackingStatus.getState().state).toBe("notice_required");
    expect(running).toBe(false);
    expect(await readSession()).toBeNull();
    expect(await bufferedCount()).toBe(2);
  });
});

describe("withdrawing the acknowledgement", () => {
  beforeEach(() => {
    const base = request.getMockImplementation()!;
    request.mockImplementation(async (method: string, path: string, body?: unknown) => {
      if (method === "POST" && path.endsWith("/tracking/notice/withdraw")) {
        config.acknowledgedVersion = null;
        return { withdrawn: 1, acknowledgedVersion: null };
      }
      if (method === "POST" && path.endsWith("/tracking/notice")) {
        config.acknowledgedVersion = config.noticeVersion;
        return { acknowledgedVersion: config.noticeVersion };
      }
      if (method === "GET" && path === "/v1/me/tours") return { tours: [] };
      return base(method, path, body);
    });
  });

  it("online: tells the server, stops the task at once, deletes buffered positions, resets the state", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await appendFixes([fix(), fix(), fix()]);
    const r = await withdrawAcknowledgement("org1");
    expect(r.sent).toBe(true);
    expect(withdrawCalls()).toHaveLength(1);
    expect(withdrawCalls()[0]![1]).toBe("/v1/orgs/org1/tracking/notice/withdraw");
    expect(mockLoc.stopLocationUpdatesAsync).toHaveBeenCalledWith(TRACKING_TASK);
    expect(running).toBe(false);
    expect(await readSession()).toBeNull();
    expect(await bufferedCount()).toBe(0);
    expect(useTrackingStatus.getState()).toMatchObject({ state: "notice_required", acknowledgedVersion: null, withdrawalPending: false, buffered: 0 });
    expect(await isWithdrawalPending("org1")).toBe(false);
    // Nothing recorded before the withdrawal was sent.
    expect(uploads()).toHaveLength(0);
    // Tour still on the road (app foreground): tracking does not start again by itself.
    expect(await startTracking(input, { requestPermissions: false })).toBe("notice_required");
    expect(mockLoc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });

  it("no uploads after the withdrawal, even from a background delivery racing with it", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await withdrawAcknowledgement("org1");
    // A delivery that was already in flight (session read before it was removed) appends late:
    await appendFixes([fix()]);
    await uploadNow();
    expect(uploads()).toHaveLength(0);
    expect(await bufferedCount()).toBe(0);
    // And the task itself never records without a session.
    await mockTaskExecutor!({ data: { locations: [loc(52.38, 9.74, 5, at(30))] } });
    expect(await bufferedCount()).toBe(0);
    expect(uploads()).toHaveLength(0);
  });

  it("offline: stops and deletes locally at once, keeps a pending flag and sends the withdrawal on the next sync", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await appendFixes([fix(), fix()]);
    const online = request.getMockImplementation()!;
    let offline = true;
    request.mockImplementation(async (method: string, path: string, body?: unknown) => {
      if (offline) throw new ApiError(0, "network", "No connection");
      return online(method, path, body);
    });
    const r = await withdrawAcknowledgement("org1");
    expect(r.sent).toBe(false);
    expect((r.error as ApiError).code).toBe("network");
    expect(running).toBe(false);
    expect(await bufferedCount()).toBe(0);
    expect(await isWithdrawalPending("org1")).toBe(true);
    expect(useTrackingStatus.getState()).toMatchObject({ state: "notice_required", acknowledgedVersion: null, withdrawalPending: true });

    // Still offline at the next tour start / foreground: no tracking, nothing sent.
    expect(await startTracking(input, { requestPermissions: false })).toBe("notice_required");
    expect(mockLoc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    await appendFixes([fix()]);
    await uploadNow();
    expect(await bufferedCount()).toBe(0);

    // Back online: the next sync sends the withdrawal (once), the flag is gone.
    const attemptsOffline = withdrawCalls().length; // the first try + the retry at tour start
    expect(attemptsOffline).toBe(2);
    offline = false;
    useTourStore.setState({ user: { id: "u1", email: "d@example.test", name: "D" } } as never);
    await useTourStore.getState().sync();
    expect(withdrawCalls()).toHaveLength(attemptsOffline + 1);
    await useTourStore.getState().sync();
    expect(withdrawCalls()).toHaveLength(attemptsOffline + 1); // sent once
    expect(await isWithdrawalPending("org1")).toBe(false);
    expect(useTrackingStatus.getState().withdrawalPending).toBe(false);
    expect(uploads()).toHaveLength(0);
    expect(config.acknowledgedVersion).toBeNull();
    useTourStore.setState({ user: null } as never);
  });

  it("the pending flag survives an app restart (persisted) and is retried", async () => {
    let offline = true;
    const online = request.getMockImplementation()!;
    request.mockImplementation(async (method: string, path: string, body?: unknown) => {
      if (offline) throw new ApiError(0, "network", "No connection");
      return online(method, path, body);
    });
    await withdrawAcknowledgement("org1");
    expect(await AsyncStorage.getItem("turvio-tracking-withdraw-pending-v1")).toContain("org1");
    offline = false;
    expect(await retryPendingWithdrawal()).toBe(true);
    expect(withdrawCalls().length).toBeGreaterThanOrEqual(1);
    expect(await AsyncStorage.getItem("turvio-tracking-withdraw-pending-v1")).toBeNull();
  });

  it("acknowledging again allows tracking again", async () => {
    defineTrackingTask();
    await startTracking(input, { requestPermissions: true });
    await withdrawAcknowledgement("org1");
    await acknowledgeNotice("org1");
    expect(useTrackingStatus.getState().acknowledgedVersion).toBe(1);
    expect(await startTracking(input, { requestPermissions: false })).toBe("active");
    expect(running).toBe(true);
    await mockTaskExecutor!({ data: { locations: [loc(52.38, 9.74, 5, at(60))] } });
    await uploadNow();
    expect(uploads()).toHaveLength(1);
  });
});
