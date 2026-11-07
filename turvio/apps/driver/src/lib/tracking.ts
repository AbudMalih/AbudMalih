import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { create } from "zustand";
import { ApiError, type AuthClient } from "./auth";
import { uuid } from "./ids";
import { UploadRefused, appendFixes, bufferedCount, clearBuffer, flushBuffer, type Fix, type UploadResult } from "./trackingBuffer";

/**
 * Live tour tracking on the driver's phone (docs/LIVE_TRACKING.md).
 *
 * Runs only while a tour is being driven, only when the company switched tracking on and the
 * driver acknowledged the notice. Android shows a permanent notification while it runs (a
 * foreground service – this is what keeps it working with the screen locked); iOS shows the
 * blue location indicator. The OS can still stop it (battery savers, "Allow only while using"),
 * which the app reports instead of pretending to track.
 */
export const TRACKING_TASK = "turvio-live-tracking";
const SESSION_KEY = "turvio-tracking-session-v1";
/** Upload at most this often from the background task (each upload wakes the radio). */
const UPLOAD_EVERY_MS = 15_000;

export interface TrackingSession {
  orgId: string;
  tourId: string;
  tourName: string;
  intervalSeconds: number;
  startedAt: string;
}

export type TrackingState =
  | "off" // no tour on the road, or demo mode
  | "disabled" // company has tracking switched off
  | "notice_required" // driver has to read and confirm the notice
  | "permission_denied" // location not allowed (or only "while using")
  | "starting"
  | "active"
  | "error";

export interface TrackingStatus {
  state: TrackingState;
  tourId?: string;
  intervalSeconds?: number;
  retentionDays?: number;
  noticeVersion?: number;
  buffered: number;
  lastFixAt?: string;
  lastUploadAt?: string;
  message?: string;
}

export const useTrackingStatus = create<TrackingStatus>(() => ({ state: "off", buffered: 0 }));
const setStatus = (patch: Partial<TrackingStatus>) => useTrackingStatus.setState(patch);

export interface TrackingConfig {
  mode: "off" | "active_tours";
  intervalSeconds: number;
  noticeVersion: number;
  acknowledgedVersion: number | null;
  retentionDays: number;
}

/** Replaceable for tests: the authenticated API client. */
let clientFactory: (() => AuthClient) | null = null;
export function setTrackingClient(factory: () => AuthClient) {
  clientFactory = factory;
}
function api(): AuthClient {
  if (!clientFactory) throw new Error("tracking client not configured");
  return clientFactory();
}

export async function readSession(): Promise<TrackingSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TrackingSession) : null;
  } catch {
    return null;
  }
}

async function send(orgId: string, tourId: string, points: Fix[]): Promise<UploadResult> {
  try {
    return await api().request<UploadResult>("POST", `/v1/orgs/${orgId}/tours/${tourId}/locations`, {
      points: points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, accuracy: p.accuracy, speed: p.speed, heading: p.heading, recordedAt: p.recordedAt })),
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === "tracking_disabled") throw new UploadRefused("tracking_disabled", e.message);
      if (e.code === "tracking_notice_required") throw new UploadRefused("tracking_notice_required", e.message);
      if (e.status === 404) throw new UploadRefused("tour_gone", e.message);
    }
    throw e;
  }
}

let lastUpload = 0;
/** Upload what is buffered (also called on reconnect / app foreground). */
export async function uploadNow(): Promise<void> {
  lastUpload = Date.now();
  const out = await flushBuffer(send);
  setStatus({ buffered: out.remaining, ...(out.sent || !out.error ? { lastUploadAt: new Date().toISOString() } : {}) });
  if (out.refused === "tracking_disabled") {
    await stopTracking("disabled");
  } else if (out.refused === "tracking_notice_required") {
    await stopTracking("notice_required");
  } else if (out.error) {
    setStatus({ message: out.error });
  }
}

/** Background task: runs at module load (index of the JS bundle), also when the app is not open. */
export function defineTrackingTask() {
  if (Platform.OS === "web" || TaskManager.isTaskDefined(TRACKING_TASK)) return;
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const session = await readSession();
    if (!session) {
      // No active tour session: never record. Stop the stray service.
      await Location.stopLocationUpdatesAsync(TRACKING_TASK).catch(() => undefined);
      return;
    }
    const fixes: Fix[] = data.locations.map((l) => ({
      id: uuid(),
      orgId: session.orgId,
      tourId: session.tourId,
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      accuracy: l.coords.accuracy ?? null,
      speed: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
      heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
      recordedAt: new Date(l.timestamp).toISOString(),
    }));
    const { size } = await appendFixes(fixes);
    setStatus({ buffered: size, lastFixAt: fixes.at(-1)!.recordedAt });
    if (Date.now() - lastUpload >= UPLOAD_EVERY_MS) await uploadNow().catch(() => undefined);
  });
}

async function isRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
  } catch {
    return false;
  }
}

export interface StartInput {
  orgId: string;
  tourId: string;
  tourName: string;
  /** Texts for the Android notification (localised by the caller). */
  notificationTitle: string;
  notificationBody: string;
}

/**
 * Start tracking for a tour on the road – or report why not. Idempotent: calling it again for
 * the same tour keeps the running session (no duplicate sessions).
 */
export async function startTracking(input: StartInput, opts: { requestPermissions: boolean }): Promise<TrackingState> {
  if (Platform.OS === "web") return "off";
  let cfg: TrackingConfig;
  try {
    cfg = await api().request<TrackingConfig>("GET", `/v1/orgs/${input.orgId}/tracking/config`);
  } catch (e) {
    // Offline at tour start: keep a running session (it buffers), otherwise retry later.
    const running = await isRunning();
    setStatus({ state: running ? "active" : "error", message: e instanceof Error ? e.message : String(e) });
    return running ? "active" : "error";
  }
  setStatus({ intervalSeconds: cfg.intervalSeconds, retentionDays: cfg.retentionDays, noticeVersion: cfg.noticeVersion });
  if (cfg.mode !== "active_tours") {
    await stopTracking("disabled");
    return "disabled";
  }
  if (cfg.acknowledgedVersion !== cfg.noticeVersion) {
    await stopTracking("notice_required");
    return "notice_required";
  }
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted" && opts.requestPermissions && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  let bg = fg.status === "granted" ? await Location.getBackgroundPermissionsAsync() : null;
  if (bg && bg.status !== "granted" && opts.requestPermissions && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
  if (fg.status !== "granted" || bg?.status !== "granted") {
    await stopTracking("permission_denied");
    return "permission_denied";
  }

  const current = await readSession();
  if (current?.tourId === input.tourId && (await isRunning())) {
    setStatus({ state: "active", tourId: input.tourId, buffered: await bufferedCount() });
    return "active";
  }
  setStatus({ state: "starting", tourId: input.tourId });
  const session: TrackingSession = { orgId: input.orgId, tourId: input.tourId, tourName: input.tourName, intervalSeconds: cfg.intervalSeconds, startedAt: new Date().toISOString() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (await isRunning()) await Location.stopLocationUpdatesAsync(TRACKING_TASK).catch(() => undefined);
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: cfg.intervalSeconds * 1000,
    // Standing still (unloading, traffic light) produces no new fixes: saves battery and data.
    distanceInterval: 10,
    deferredUpdatesInterval: cfg.intervalSeconds * 1000,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: input.notificationTitle, notificationBody: input.notificationBody, notificationColor: "#2563EB", killServiceOnDestroy: false },
  });
  setStatus({ state: "active", tourId: input.tourId, message: undefined, buffered: await bufferedCount() });
  return "active";
}

/** Stop recording (tour paused/finished, signed out, company switched off). Uploads the rest. */
export async function stopTracking(reason: TrackingState = "off"): Promise<void> {
  if (Platform.OS === "web") return;
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
  if (await isRunning()) await Location.stopLocationUpdatesAsync(TRACKING_TASK).catch(() => undefined);
  if (reason !== "disabled" && reason !== "notice_required") await flushBuffer(send).catch(() => undefined);
  if (reason === "disabled") await clearBuffer();
  setStatus({ state: reason, tourId: undefined, buffered: await bufferedCount() });
}

/** The driver confirmed the tracking notice. */
export async function acknowledgeNotice(orgId: string): Promise<void> {
  await api().request("POST", `/v1/orgs/${orgId}/tracking/notice`, {});
}

export async function getTrackingConfig(orgId: string): Promise<TrackingConfig> {
  return api().request<TrackingConfig>("GET", `/v1/orgs/${orgId}/tracking/config`);
}
