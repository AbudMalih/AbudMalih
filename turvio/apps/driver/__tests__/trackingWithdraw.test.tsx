import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { translate, type Locale } from "@turvio/shared";

/**
 * Live tracking, driver side: withdrawing the acknowledgement from Settings, the company's notice
 * details, and resuming after an app restart.
 */
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
jest.mock("expo-task-manager", () => ({ isTaskDefined: () => true, defineTask: jest.fn() }));
jest.mock("../src/lib/optimizer", () => ({ ...jest.requireActual("../src/lib/optimizer"), apiBaseUrl: () => "https://api.example.test" }));

type LocMock = Record<"getForegroundPermissionsAsync" | "getBackgroundPermissionsAsync" | "hasStartedLocationUpdatesAsync" | "startLocationUpdatesAsync" | "stopLocationUpdatesAsync", jest.Mock>;
const loc = jest.requireMock("expo-location") as LocMock;

import { ApiError } from "../src/lib/auth";
import { setTrackingClient, startTracking, readSession, useTrackingStatus, isWithdrawalPending, type NoticeDetails } from "../src/lib/tracking";
import { appendFixes, bufferedCount, clearBuffer, type Fix } from "../src/lib/trackingBuffer";
import { checkSetup, isAutoPromptSuppressed, resetAutoPrompt, useTrackingSetup } from "../src/lib/trackingOnboarding";
import { useTourTracking } from "../src/lib/useTourTracking";
import { NoticeDetailsBlock, TrackingSettingsSection } from "../src/components/Tracking";
import { TrackingSetupSheet } from "../src/components/TrackingSetup";
import { setAuthClient, useTourStore } from "../src/store/tourStore";

const request = jest.fn();
setTrackingClient(() => ({ request }) as never);
setAuthClient({ request } as never);

let config: Record<string, unknown>;
let running = false;
let offline = false;
const NOTICE: NoticeDetails = { controller: "JARBOU Logistik GmbH, Hannover", contact: "datenschutz@jarbou.example", legalBasis: "§ 26 BDSG", text: "Positions are only visible to dispatch." };
const tour = { id: "tour1", organizationId: "org1", driverId: "d1", name: "Hannover List", status: "in_progress", plannedStartMinute: 480, date: "2026-11-20" };
let n = 0;
const fix = (): Fix => ({ id: `fx-${++n}`, orgId: "org1", tourId: "tour1", lat: 52.38, lng: 9.74, accuracy: 5, speed: 1, heading: 0, recordedAt: new Date().toISOString() });
const calls = (suffix: string) => request.mock.calls.filter(([m, p]) => m === "POST" && String(p).endsWith(suffix));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await clearBuffer();
  running = false;
  offline = false;
  resetAutoPrompt();
  useTrackingStatus.setState({ state: "off", buffered: 0, acknowledgedVersion: undefined, withdrawalPending: false, notice: undefined }, false);
  useTrackingSetup.setState({ open: false, status: null });
  config = { mode: "active_tours", intervalSeconds: 10, noticeVersion: 2, acknowledgedVersion: 2, retentionDays: 30, notice: NOTICE };
  request.mockImplementation(async (method: string, path: string) => {
    if (offline) throw new ApiError(0, "network", "No connection");
    if (method === "GET" && path.endsWith("/tracking/config")) return config;
    if (method === "POST" && path.endsWith("/tracking/notice/withdraw")) {
      config.acknowledgedVersion = null;
      return { withdrawn: 1, acknowledgedVersion: null };
    }
    if (method === "POST" && path.endsWith("/tracking/notice")) {
      config.acknowledgedVersion = config.noticeVersion;
      return { acknowledgedVersion: config.noticeVersion };
    }
    if (method === "POST" && path.endsWith("/locations")) return { accepted: 1, duplicates: 0, rejected: [] };
    throw new Error(`unexpected ${method} ${path}`);
  });
  const granted = { status: "granted", canAskAgain: true, android: { accuracy: "fine" }, ios: { accuracy: "full" } };
  loc.getForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.getBackgroundPermissionsAsync.mockResolvedValue(granted);
  loc.hasStartedLocationUpdatesAsync.mockImplementation(async () => running);
  loc.startLocationUpdatesAsync.mockImplementation(async () => {
    running = true;
  });
  loc.stopLocationUpdatesAsync.mockImplementation(async () => {
    running = false;
  });
  useTourStore.setState({ user: { id: "u1", email: "lena@example.test", name: "Lena" }, locale: "en", driverId: "d1", tours: [tour], stops: [], organizationId: "org1" } as never);
});

describe("company notice details", () => {
  const locales: Locale[] = ["de", "en", "ro", "ar"];
  it.each(locales)("shows controller, contact, legal basis and text with translated labels (%s)", async (locale) => {
    useTourStore.setState({ locale } as never);
    await render(<NoticeDetailsBlock notice={NOTICE} />);
    expect(screen.getByText(translate(locale, "tracking.noticeCompany"))).toBeTruthy();
    for (const key of ["tracking.noticeController", "tracking.noticeContact", "tracking.noticeLegalBasis", "tracking.noticeText"] as const) {
      const label = translate(locale, key);
      expect(label).toBeTruthy();
      expect(label).not.toBe(key);
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(NOTICE.controller!)).toBeTruthy();
    expect(screen.getByText(NOTICE.contact!)).toBeTruthy();
    expect(screen.getByText(NOTICE.legalBasis!)).toBeTruthy();
    expect(screen.getByText(NOTICE.text!)).toBeTruthy();
  });

  it("renders nothing when the company set nothing (null notice)", async () => {
    await render(<NoticeDetailsBlock notice={null} />);
    expect(screen.queryByTestId("tracking-notice-company")).toBeNull();
  });

  it("renders nothing when all fields are empty", async () => {
    await render(<NoticeDetailsBlock notice={{ controller: null, contact: "  ", legalBasis: null, text: null }} />);
    expect(screen.queryByTestId("tracking-notice-company")).toBeNull();
  });

  it("shows only the filled-in fields", async () => {
    await render(<NoticeDetailsBlock notice={{ controller: null, contact: "dpo@example.test", legalBasis: null, text: null }} />);
    expect(screen.getByTestId("notice-contact")).toBeTruthy();
    expect(screen.queryByTestId("notice-controller")).toBeNull();
    expect(screen.queryByTestId("notice-legal-basis")).toBeNull();
    expect(screen.queryByTestId("notice-text")).toBeNull();
  });

  it("the notice step of the set-up shows the details below the standard text", async () => {
    config.acknowledgedVersion = null;
    const s = await checkSetup("org1");
    expect(s.notice).toEqual(NOTICE);
    await render(<TrackingSetupSheet visible status={s} onRecheck={async () => undefined} />);
    expect(screen.getByTestId("tracking-setup-notice")).toBeTruthy();
    expect(screen.getByText(NOTICE.legalBasis!)).toBeTruthy();
  });

  it("the notice step without company details shows the standard text only", async () => {
    config.acknowledgedVersion = null;
    config.notice = { controller: null, contact: null, legalBasis: null, text: null };
    await render(<TrackingSetupSheet visible status={await checkSetup("org1")} onRecheck={async () => undefined} />);
    expect(screen.getByTestId("tracking-setup-notice")).toBeTruthy();
    expect(screen.queryByTestId("tracking-notice-company")).toBeNull();
  });
});

describe("withdrawing from Settings", () => {
  async function settingsWithTracking() {
    await startTracking({ orgId: "org1", tourId: "tour1", tourName: "Hannover List", notificationTitle: "T", notificationBody: "B" }, { requestPermissions: false });
    useTrackingSetup.setState({ status: await checkSetup("org1") });
    expect(running).toBe(true);
    await appendFixes([fix(), fix()]);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await render(<TrackingSettingsSection />);
    return alert;
  }

  it("asks first, explains the effect, then stops tracking and resets the acknowledgement", async () => {
    const alert = await settingsWithTracking();
    expect(screen.getByText("Stop live tracking (withdraw acknowledgement)")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId("tracking-withdraw")));
    const [title, body, buttons] = alert.mock.calls[0]!;
    expect(title).toBe(translate("en", "tracking.withdrawTitle"));
    expect(body).toMatch(/until you acknowledge the tracking notice again/);
    expect(body).toMatch(/deliveries keep working/);
    // Nothing happens before the driver confirms.
    expect(calls("/withdraw")).toHaveLength(0);
    await act(async () => {
      await buttons!.find((b) => b.style === "destructive")!.onPress!();
    });
    await waitFor(() => expect(screen.getByText(translate("en", "tracking.withdrawDone"))).toBeTruthy());
    expect(calls("/withdraw")).toHaveLength(1);
    expect(running).toBe(false);
    expect(await bufferedCount()).toBe(0);
    expect(useTrackingStatus.getState()).toMatchObject({ state: "notice_required", acknowledgedVersion: null });
    // The set-up knows the notice is missing again (shown again later, not right now).
    expect(useTrackingSetup.getState().status).toMatchObject({ acknowledgedVersion: null });
    expect(useTrackingSetup.getState().status!.missing).toContain("notice");
    expect(useTrackingSetup.getState().open).toBe(false);
    expect(isAutoPromptSuppressed()).toBe(true);
    await waitFor(() => expect(screen.getByText(translate("en", "tracking.withdrawDone"))).toBeTruthy());
    expect(screen.queryByTestId("tracking-withdraw")).toBeNull();
    alert.mockRestore();
  });

  it("offline: stops locally right away, says it will tell the company later, sends it when online", async () => {
    const alert = await settingsWithTracking();
    await act(async () => fireEvent.press(screen.getByTestId("tracking-withdraw")));
    offline = true;
    await act(async () => {
      await alert.mock.calls[0]![2]!.find((b) => b.style === "destructive")!.onPress!();
    });
    await waitFor(() => expect(screen.getByText(translate("en", "tracking.withdrawPending"))).toBeTruthy());
    expect(running).toBe(false);
    expect(await bufferedCount()).toBe(0);
    expect(await isWithdrawalPending("org1")).toBe(true);
    expect(calls("/locations")).toHaveLength(0);
    offline = false;
    await act(async () => {
      await useTourStore.getState().sync();
    });
    expect(await isWithdrawalPending("org1")).toBe(false);
    expect(config.acknowledgedVersion).toBeNull();
    alert.mockRestore();
  });

  it("server error: localized message (never raw server text), still stopped and kept pending", async () => {
    const alert = await settingsWithTracking();
    await act(async () => fireEvent.press(screen.getByTestId("tracking-withdraw")));
    request.mockImplementation(async (method: string, path: string) => {
      if (path.endsWith("/withdraw")) throw new ApiError(500, "internal", "db.ts:12 exploded");
      return config;
    });
    await act(async () => {
      await alert.mock.calls[0]![2]!.find((b) => b.style === "destructive")!.onPress!();
    });
    await waitFor(() => expect(screen.getByText(new RegExp(translate("en", "errors.server").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy());
    expect(screen.queryByText(/exploded/)).toBeNull();
    expect(running).toBe(false);
    expect(await isWithdrawalPending("org1")).toBe(true);
    alert.mockRestore();
  });
});

describe("app restart", () => {
  function Harness() {
    useTourTracking();
    return null;
  }

  it("tour on the road + acknowledged notice: tracking resumes (same session, no duplicate) and the buffer is uploaded", async () => {
    await AsyncStorage.setItem("turvio-tracking-session-v1", JSON.stringify({ orgId: "org1", tourId: "tour1", tourName: "Hannover List", intervalSeconds: 10, startedAt: new Date().toISOString() }));
    running = true; // the OS kept the foreground service alive while the app was restarted
    await appendFixes([fix(), fix(), fix()]);
    await render(<Harness />);
    await waitFor(() => expect(calls("/locations")).toHaveLength(1));
    expect(calls("/locations")[0]![2].points).toHaveLength(3);
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(useTrackingStatus.getState().state).toBe("active");
    await waitFor(async () => expect(await bufferedCount()).toBe(0));
  });

  it("the service was killed with the app: it is started again for the running tour", async () => {
    await appendFixes([fix()]);
    await render(<Harness />);
    await waitFor(() => expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1));
    expect((await readSession())?.tourId).toBe("tour1");
    await waitFor(() => expect(calls("/locations")).toHaveLength(1));
  });

  it("after a withdrawal the restart does not resume tracking", async () => {
    config.acknowledgedVersion = null;
    await appendFixes([fix()]);
    await render(<Harness />);
    await waitFor(() => expect(useTrackingStatus.getState().state).toBe("notice_required"));
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(calls("/locations")).toHaveLength(0);
  });
});
