import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking, PermissionsAndroid, Platform } from "react-native";

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 2 },
}));
jest.mock("expo-task-manager", () => ({ isTaskDefined: () => true, defineTask: jest.fn() }));

type LocMock = Record<"getForegroundPermissionsAsync" | "requestForegroundPermissionsAsync" | "getBackgroundPermissionsAsync" | "requestBackgroundPermissionsAsync", jest.Mock>;
const loc = jest.requireMock("expo-location") as LocMock;

import { setTrackingClient } from "../src/lib/tracking";
import { checkSetup, missingSteps, performStep, signatureOf, useTrackingSetup, wasDismissed } from "../src/lib/trackingOnboarding";
import { TrackingSetupSheet } from "../src/components/TrackingSetup";

const request = jest.fn();
setTrackingClient(() => ({ request }) as never);
let config: Record<string, unknown>;
const fg = (over: Record<string, unknown> = {}) => ({ status: "granted", canAskAgain: true, android: { accuracy: "fine" }, ios: { scope: "whenInUse", accuracy: "full" }, ...over });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useTrackingSetup.setState({ open: false, status: null });
  config = { mode: "active_tours", intervalSeconds: 10, noticeVersion: 2, acknowledgedVersion: 2, retentionDays: 30 };
  request.mockImplementation(async (method: string, path: string) => {
    if (method === "GET" && path.endsWith("/tracking/config")) return config;
    if (method === "POST" && path.endsWith("/tracking/notice")) {
      config.acknowledgedVersion = config.noticeVersion;
      return { acknowledgedVersion: config.noticeVersion };
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
  loc.getForegroundPermissionsAsync.mockResolvedValue(fg());
  loc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
});

describe("what is missing", () => {
  const all = { foreground: true, foregroundCanAsk: true, precise: true, background: true, backgroundCanAsk: true, notifications: true };
  const ok = { noticeVersion: 2, acknowledgedVersion: 2 };
  it("steps in order: location, precise, background, notice", () => {
    expect(missingSteps(all, ok)).toEqual([]);
    expect(missingSteps({ ...all, foreground: false, precise: null, background: false }, { noticeVersion: 2, acknowledgedVersion: null })).toEqual(["location", "background", "notice"]);
    expect(missingSteps({ ...all, precise: false }, ok)).toEqual(["precise"]);
    expect(missingSteps({ ...all, background: false }, ok)).toEqual(["background"]);
    expect(missingSteps(all, { noticeVersion: 3, acknowledgedVersion: 2 })).toEqual(["notice"]);
    expect(missingSteps({ ...all, notifications: false }, { noticeVersion: 2, acknowledgedVersion: 1 })).toEqual(["notifications", "notice"]);
  });
  it("a new notice version or a revoked permission is a new situation (shown again)", () => {
    expect(signatureOf("o", { noticeVersion: 2 }, ["background"])).not.toBe(signatureOf("o", { noticeVersion: 3 }, ["background"]));
    expect(signatureOf("o", { noticeVersion: 2 }, ["notice"])).not.toBe(signatureOf("o", { noticeVersion: 2 }, ["background", "notice"]));
  });
});

describe("checking the set-up", () => {
  it("tracking off for this driver: nothing to set up, background location is never asked", async () => {
    config.mode = "off";
    loc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    const s = await checkSetup("org1");
    expect(s).toMatchObject({ tracked: false, missing: [] });
    expect(loc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("Android: approximate location is reported as missing precise; background via the settings page when refused", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "android");
    loc.getForegroundPermissionsAsync.mockResolvedValue(fg({ android: { accuracy: "coarse" } }));
    loc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: false });
    const s = await checkSetup("org1");
    expect(s.missing).toEqual(["precise", "background"]);
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    await expect(performStep("precise", s)).resolves.toBe("asked");
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    // Refused before (cannot ask again): no dialog loop – the settings page opens.
    await expect(performStep("background", s)).resolves.toBe("settings");
    expect(loc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    restore.restore();
  });

  it("Android 13+: notifications must be allowed, so the tracking notification is really visible", async () => {
    const os = jest.replaceProperty(Platform, "OS", "android");
    const ver = jest.spyOn(Platform, "Version", "get").mockReturnValue(34);
    const check = jest.spyOn(PermissionsAndroid, "check").mockResolvedValue(false);
    const req = jest.spyOn(PermissionsAndroid, "request").mockResolvedValue("never_ask_again");
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const s = await checkSetup("org1");
    expect(s.missing).toEqual(["notifications"]);
    await expect(performStep("notifications", s)).resolves.toBe("settings");
    expect(req).toHaveBeenCalledWith("android.permission.POST_NOTIFICATIONS");
    expect(open).toHaveBeenCalled();
    // Android 12 and older have no such permission: never a step there.
    ver.mockReturnValue(31);
    expect((await checkSetup("org1")).missing).toEqual([]);
    ver.mockRestore();
    check.mockRestore();
    req.mockRestore();
    os.restore();
  });

  it("the notice is acknowledged through the existing API (no other way around it)", async () => {
    config.acknowledgedVersion = 1;
    const s = await checkSetup("org1");
    expect(s.missing).toEqual(["notice"]);
    await expect(performStep("notice", s)).resolves.toBe("acknowledged");
    expect(request).toHaveBeenCalledWith("POST", "/v1/orgs/org1/tracking/notice", {});
    expect((await checkSetup("org1")).missing).toEqual([]);
  });
});

describe("set-up sheet", () => {
  async function show(over: Partial<typeof config> = {}) {
    Object.assign(config, over);
    const s = await checkSetup("org1");
    useTrackingSetup.setState({ open: true, status: s });
    const recheck = jest.fn(async () => useTrackingSetup.setState({ status: await checkSetup("org1") }));
    const utils = await render(<Harness onRecheck={recheck} />);
    return { ...utils, recheck };
  }
  function Harness({ onRecheck }: { onRecheck: () => Promise<void> }) {
    const { open, status } = useTrackingSetup();
    return <TrackingSetupSheet visible={open} status={status} onRecheck={onRecheck} />;
  }

  it("walks through location → background → notice with the exact acknowledgement wording, then says it is done", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    loc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    loc.requestForegroundPermissionsAsync.mockImplementation(async () => {
      loc.getForegroundPermissionsAsync.mockResolvedValue(fg());
      return fg();
    });
    loc.requestBackgroundPermissionsAsync.mockImplementation(async () => {
      loc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
      return { status: "granted" };
    });
    const screen = await show({ acknowledgedVersion: null });
    expect(screen.getByTestId("tracking-setup-progress").props.children).toBe("Step 1 of 3");
    await act(async () => fireEvent.press(screen.getByTestId("tracking-setup-location")));
    await waitFor(() => expect(screen.getByTestId("tracking-setup-background")).toBeTruthy());
    expect(screen.getByTestId("tracking-setup-progress").props.children).toBe("Step 2 of 3");
    await act(async () => fireEvent.press(screen.getByTestId("tracking-setup-background")));
    await waitFor(() => expect(screen.getByTestId("tracking-setup-notice")).toBeTruthy());
    expect(screen.getByText("I have read and understood the location tracking information.")).toBeTruthy();
    expect(screen.getByText(/They stay visible on purpose/)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId("tracking-setup-notice")));
    await waitFor(() => expect(screen.getByTestId("tracking-setup-done")).toBeTruthy());
    expect(request).toHaveBeenCalledWith("POST", "/v1/orgs/org1/tracking/notice", {});
  });

  it("a refused permission is not asked in a loop: the next press opens the settings page", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    loc.requestForegroundPermissionsAsync.mockImplementation(async () => {
      loc.getForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: false });
      return { status: "denied" };
    });
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const screen = await show();
    await act(async () => fireEvent.press(screen.getByTestId("tracking-setup-location")));
    await waitFor(() => expect(screen.getByText("This was refused. Open the app settings and allow it there.")).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByTestId("tracking-setup-location")));
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalled();
  });

  it("“Later” remembers exactly this situation – it is not shown again until something changes", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    const screen = await show();
    const sig = useTrackingSetup.getState().status!.signature;
    await act(async () => fireEvent.press(screen.getByTestId("tracking-setup-later")));
    expect(useTrackingSetup.getState().open).toBe(false);
    expect(await wasDismissed(sig)).toBe(true);
    config.noticeVersion = 3;
    expect(await wasDismissed((await checkSetup("org1")).signature)).toBe(false);
  });
});
