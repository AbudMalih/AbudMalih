import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { create } from "zustand";
import { ApiError, isTransient, type AuthClient } from "./auth";
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
/** Standing still: keep one "still here" fix per minute instead of one per interval. */
const STATIONARY_KEEP_MS = 60_000;
const MOVED_METERS = 15;
/** Fixes less accurate than this are useless even as history (cell-tower guesses): dropped on the phone. */
export const MAX_ACCURACY_METERS = 500;
/** Minimum movement between fixes the OS reports (no fix every second while standing). */
export const DISTANCE_INTERVAL_METERS = 10;
const WITHDRAW_PENDING_KEY = "turvio-tracking-withdraw-pending-v1";

/** A position worth buffering: real coordinates and not a > 500 m guess (missing accuracy is kept). */
export function isUsableLocation(l: Pick<Location.LocationObject, "coords"> | null | undefined): boolean {
  const c = l?.coords;
  if (!c) return false;
  const { latitude: lat, longitude: lng, accuracy } = c;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy > MAX_ACCURACY_METERS)) return false;
  return true;
}

let lastKept: { lat: number; lng: number; at: number } | null = null;
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const k = Math.PI / 180;
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  const y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}
/**
 * Thin out fixes while parked (unloading, traffic jam): moving -> every fix; standing still ->
 * one per minute, so dispatch still sees "live" (not "offline") without a stream of identical points.
 */
export function keepFix(f: { lat: number; lng: number; at: number }): boolean {
  if (!lastKept || f.at - lastKept.at >= STATIONARY_KEEP_MS || metersBetween(lastKept, f) >= MOVED_METERS) {
    lastKept = f;
    return true;
  }
  return false;
}
export function resetFixFilter() {
  lastKept = null;
}

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
  acknowledgedVersion?: number | null;
  /** The company's part of the notice (from the last config read). */
  notice?: NoticeDetails | null;
  /** The driver withdrew the acknowledgement while offline; the server is told when back online. */
  withdrawalPending?: boolean;
  buffered: number;
  lastFixAt?: string;
  lastUploadAt?: string;
  message?: string;
}

export const useTrackingStatus = create<TrackingStatus>(() => ({ state: "off", buffered: 0 }));
const setStatus = (patch: Partial<TrackingStatus>) => useTrackingStatus.setState(patch);

/** The company's own part of the tracking notice; every field may be missing. */
export interface NoticeDetails {
  controller: string | null;
  contact: string | null;
  legalBasis: string | null;
  text: string | null;
}

export interface TrackingConfig {
  mode: "off" | "active_tours";
  companyMode?: string;
  intervalSeconds: number;
  noticeVersion: number;
  acknowledgedVersion: number | null;
  retentionDays: number;
  notice?: NoticeDetails | null;
}

/** True when at least one company notice field is filled in. */
export function hasNoticeDetails(n: NoticeDetails | null | undefined): n is NoticeDetails {
  return !!n && [n.controller, n.contact, n.legalBasis, n.text].some((v) => typeof v === "string" && v.trim().length > 0);
}

/** Replaceable for tests: the authenticated API client. */
let clientFactory: (() => AuthClient) | null = null;
export function setTrackingClient(factory: () => AuthClient) {
  clientFactory = factory;
}
/** Who is signed in (a pending withdrawal is only ever sent for the driver who withdrew). */
let currentUser: () => string | null = () => null;
export function setTrackingUser(fn: () => string | null) {
  currentUser = fn;
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
  // The driver withdrew: nothing recorded before (or racing with) the withdrawal is ever sent.
  if (await uploadsBlocked()) {
    await clearBuffer();
    setStatus({ buffered: 0 });
    return;
  }
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
    const fixes: Fix[] = data.locations
      // Accuracy filter first, so a bad fix never becomes the "last kept" reference.
      .filter((l) => isUsableLocation(l) && keepFix({ lat: l.coords.latitude, lng: l.coords.longitude, at: l.timestamp }))
      .map((l) => ({
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
    if (!fixes.length) return;
    const { size } = await appendFixes(fixes);
    // Withdrawn while this delivery was in flight: drop it, never upload.
    if (await uploadsBlocked()) {
      await clearBuffer();
      setStatus({ buffered: 0 });
      return;
    }
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
  // A withdrawal the server has not heard of yet: send it first; until it is through, never track.
  await retryPendingWithdrawal().catch(() => undefined);
  if (await isWithdrawalPending(input.orgId)) {
    await stopTracking("notice_required", { discardBuffer: true });
    setStatus({ acknowledgedVersion: null, withdrawalPending: true });
    return "notice_required";
  }
  let cfg: TrackingConfig;
  try {
    cfg = await api().request<TrackingConfig>("GET", `/v1/orgs/${input.orgId}/tracking/config`);
  } catch (e) {
    // Offline at tour start: keep a running session (it buffers), otherwise retry later.
    const running = await isRunning();
    setStatus({ state: running ? "active" : "error", message: e instanceof Error ? e.message : String(e) });
    return running ? "active" : "error";
  }
  setStatus({ intervalSeconds: cfg.intervalSeconds, retentionDays: cfg.retentionDays, noticeVersion: cfg.noticeVersion, acknowledgedVersion: cfg.acknowledgedVersion, notice: cfg.notice ?? null, withdrawalPending: false });
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

  withdrawnInThisRun = false;
  const current = await readSession();
  if (current?.tourId === input.tourId && (await isRunning())) {
    setStatus({ state: "active", tourId: input.tourId, buffered: await bufferedCount() });
    return "active";
  }
  setStatus({ state: "starting", tourId: input.tourId });
  const session: TrackingSession = { orgId: input.orgId, tourId: input.tourId, tourName: input.tourName, intervalSeconds: cfg.intervalSeconds, startedAt: new Date().toISOString() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  resetFixFilter();
  if (await isRunning()) await Location.stopLocationUpdatesAsync(TRACKING_TASK).catch(() => undefined);
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: cfg.intervalSeconds * 1000,
    // At most one fix per company interval and only after ~10 m of movement, so the OS does not
    // wake the app every second while standing; keepFix() additionally keeps a once-a-minute sign
    // of life while parked. pausesUpdatesAutomatically stays false: iOS would otherwise stop
    // tracking for good during a longer delivery stop.
    distanceInterval: DISTANCE_INTERVAL_METERS,
    deferredUpdatesInterval: cfg.intervalSeconds * 1000,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: input.notificationTitle, notificationBody: input.notificationBody, notificationColor: "#2563EB", killServiceOnDestroy: false },
  });
  setStatus({ state: "active", tourId: input.tourId, message: undefined, buffered: await bufferedCount() });
  return "active";
}

/**
 * Stop recording (tour paused/finished, signed out, company switched off). Uploads the rest –
 * except when tracking is no longer allowed: switched off (buffer deleted), notice missing (kept,
 * it may be sent once the driver acknowledges again) or withdrawn (`discardBuffer`: deleted).
 */
export async function stopTracking(reason: TrackingState = "off", opts: { discardBuffer?: boolean } = {}): Promise<void> {
  if (Platform.OS === "web") return;
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
  if (await isRunning()) await Location.stopLocationUpdatesAsync(TRACKING_TASK).catch(() => undefined);
  const discard = reason === "disabled" || !!opts.discardBuffer || (await uploadsBlocked());
  if (!discard && reason !== "notice_required") await flushBuffer(send).catch(() => undefined);
  if (discard) await clearBuffer();
  setStatus({ state: reason, tourId: undefined, buffered: await bufferedCount() });
}

/* ---------- Withdrawing the acknowledgement ---------- */

interface PendingWithdrawal {
  orgId: string;
  userId: string | null;
  at: string;
}
/** Set from the moment of a withdrawal until tracking is allowed again (this JS run only). */
let withdrawnInThisRun = false;

async function readPending(): Promise<PendingWithdrawal[]> {
  try {
    const raw = await AsyncStorage.getItem(WITHDRAW_PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as PendingWithdrawal[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
async function writePending(list: PendingWithdrawal[]): Promise<void> {
  if (list.length) await AsyncStorage.setItem(WITHDRAW_PENDING_KEY, JSON.stringify(list));
  else await AsyncStorage.removeItem(WITHDRAW_PENDING_KEY);
}

/**
 * A withdrawal for this company is waiting to reach the server. Matches this driver's entries;
 * when the signed-in driver is not known (background start before the store loaded) every entry
 * counts – blocking uploads is the safe side.
 */
export async function isWithdrawalPending(orgId?: string): Promise<boolean> {
  const me = currentUser();
  return (await readPending()).some((p) => (orgId === undefined || p.orgId === orgId) && (me === null || p.userId === null || p.userId === me));
}

async function uploadsBlocked(): Promise<boolean> {
  return withdrawnInThisRun || (await isWithdrawalPending());
}

let withdrawChain: Promise<unknown> = Promise.resolve();
/** Withdrawals, their retries and acknowledgements reach the server in the order they happened. */
function inOrder<T>(fn: () => Promise<T>): Promise<T> {
  const next = withdrawChain.then(fn, fn);
  withdrawChain = next.catch(() => undefined);
  return next;
}

export interface WithdrawResult {
  /** The server confirmed; false = kept as pending and sent when back online. */
  sent: boolean;
  error?: unknown;
}

/**
 * The driver withdraws the acknowledgement of the tracking notice. Locally this takes effect at
 * once, online or not: the background task stops, buffered positions are deleted and nothing is
 * sent any more. The server is told now, or – without connection – on the next sync / app start
 * (a small pending flag is persisted first, so even a crash in between cannot lose it).
 */
export function withdrawAcknowledgement(orgId: string): Promise<WithdrawResult> {
  return inOrder(async () => {
    withdrawnInThisRun = true;
    const pending = (await readPending()).filter((p) => p.orgId !== orgId);
    await writePending([...pending, { orgId, userId: currentUser(), at: new Date().toISOString() }]);
    await stopTracking("notice_required", { discardBuffer: true });
    let result: WithdrawResult;
    try {
      await api().request("POST", `/v1/orgs/${orgId}/tracking/notice/withdraw`, {});
      await writePending((await readPending()).filter((p) => p.orgId !== orgId));
      result = { sent: true };
    } catch (e) {
      result = { sent: false, error: e };
    }
    // A background delivery racing with the withdrawal may have appended again: delete.
    await clearBuffer();
    setStatus({ state: "notice_required", acknowledgedVersion: null, withdrawalPending: !result.sent, buffered: 0, tourId: undefined });
    return result;
  });
}

/**
 * Send withdrawals made offline (next sync, app foreground, tour start). Returns true when none
 * is left. Refusals that can never succeed (no longer a driver of that company) are dropped.
 */
export function retryPendingWithdrawal(): Promise<boolean> {
  return inOrder(async () => {
    const all = await readPending();
    if (!all.length) return true;
    const me = currentUser();
    let left = all;
    for (const p of all) {
      if (p.userId !== me) continue;
      try {
        await api().request("POST", `/v1/orgs/${p.orgId}/tracking/notice/withdraw`, {});
      } catch (e) {
        if (isTransient(e) || (e instanceof ApiError && e.status === 401)) continue;
      }
      left = left.filter((x) => x !== p);
    }
    await writePending(left);
    const mine = left.some((p) => p.userId === me);
    if (useTrackingStatus.getState().withdrawalPending && !mine) setStatus({ withdrawalPending: false });
    return !mine;
  });
}

/** The driver confirmed the tracking notice (also after an earlier withdrawal). */
export function acknowledgeNotice(orgId: string): Promise<void> {
  return inOrder(async () => {
    const r = await api().request<{ acknowledgedVersion?: number } | undefined>("POST", `/v1/orgs/${orgId}/tracking/notice`, {});
    // A withdrawal still waiting for this company is superseded by the new acknowledgement.
    await writePending((await readPending()).filter((p) => p.orgId !== orgId));
    withdrawnInThisRun = false;
    setStatus({ withdrawalPending: false, acknowledgedVersion: r?.acknowledgedVersion ?? useTrackingStatus.getState().noticeVersion ?? null });
  });
}

export async function getTrackingConfig(orgId: string): Promise<TrackingConfig> {
  return api().request<TrackingConfig>("GET", `/v1/orgs/${orgId}/tracking/config`);
}
