import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Linking, PermissionsAndroid, Platform } from "react-native";
import { create } from "zustand";
import { acknowledgeNotice, getTrackingConfig, isWithdrawalPending, retryPendingWithdrawal, type NoticeDetails, type TrackingConfig } from "./tracking";

/*
 * Live-location set-up for drivers (Phase E). Shown after sign-in when the company tracks this
 * driver (pilot or all eligible drivers) and something is missing:
 *   1. location while using the app, 2. precise location, 3. location "all the time"
 *   (Android: "Allow all the time"; iOS: "Always"), 4. Android 13+: notifications – so the
 *   foreground-service notification shown while tracking is actually visible, 5. the tracking
 *   notice – read and acknowledged.
 * Nothing is asked when tracking is off for the driver. A step the driver postponed or denied is
 * not asked again by itself: it comes back only when something changes (a permission revoked,
 * a new notice version, tracking newly switched on). The Android foreground-service notification
 * and the iOS location indicator stay – they are the operating system's disclosure.
 */

export type SetupStep = "location" | "precise" | "background" | "notifications" | "notice";
export const STEP_ORDER: SetupStep[] = ["location", "precise", "background", "notifications", "notice"];

/** Android 13+ asks for notification permission; without it the tracking notification is hidden. */
const needsNotificationPermission = () => Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version >= 33;

export interface Permissions {
  foreground: boolean;
  foregroundCanAsk: boolean;
  /** null when not granted yet (unknown). */
  precise: boolean | null;
  background: boolean;
  backgroundCanAsk: boolean;
  /** Notifications may be shown (always true where no permission exists). */
  notifications: boolean;
}

export interface SetupStatus {
  /** The company tracks this driver (pilot or all eligible). */
  tracked: boolean;
  orgId: string;
  noticeVersion: number;
  acknowledgedVersion: number | null;
  intervalSeconds: number;
  retentionDays: number;
  /** The company's part of the notice (controller, contact, legal basis, text). */
  notice: NoticeDetails | null;
  missing: SetupStep[];
  permissions: Permissions;
  /** Identifies this exact situation; a postponed one is not shown again until it changes. */
  signature: string;
}

const DISMISSED_KEY = "turvio-tracking-setup-dismissed-v1";

export async function readPermissions(): Promise<Permissions> {
  const fg = await Location.getForegroundPermissionsAsync();
  const foreground = fg.status === "granted";
  let precise: boolean | null = null;
  if (foreground) {
    if (Platform.OS === "android") precise = fg.android?.accuracy === "fine";
    else if (Platform.OS === "ios") precise = fg.ios?.accuracy !== "reduced";
    else precise = true;
  }
  const bg = foreground ? await Location.getBackgroundPermissionsAsync() : null;
  const notifications = needsNotificationPermission() ? await PermissionsAndroid.check("android.permission.POST_NOTIFICATIONS").catch(() => true) : true;
  return { foreground, foregroundCanAsk: fg.canAskAgain, precise, background: bg?.status === "granted", backgroundCanAsk: bg?.canAskAgain ?? true, notifications };
}

/** Steps still missing, in order (pure – tested). */
export function missingSteps(p: Permissions, cfg: Pick<TrackingConfig, "noticeVersion" | "acknowledgedVersion">): SetupStep[] {
  const out: SetupStep[] = [];
  if (!p.foreground) out.push("location");
  if (p.foreground && p.precise === false) out.push("precise");
  if (!p.background) out.push("background");
  if (!p.notifications) out.push("notifications");
  if (cfg.acknowledgedVersion !== cfg.noticeVersion) out.push("notice");
  return out;
}

export function signatureOf(orgId: string, cfg: Pick<TrackingConfig, "noticeVersion">, missing: SetupStep[]): string {
  return `${orgId}|v${cfg.noticeVersion}|${missing.join(",")}`;
}

export async function checkSetup(orgId: string): Promise<SetupStatus> {
  await retryPendingWithdrawal().catch(() => undefined);
  const cfg = await getTrackingConfig(orgId);
  // Withdrawn offline and not yet sent: for this phone the notice is not acknowledged.
  if (await isWithdrawalPending(orgId)) cfg.acknowledgedVersion = null;
  const tracked = cfg.mode === "active_tours";
  // Not tracked: never ask for location in the background (nothing to set up).
  const permissions = Platform.OS === "web" ? { foreground: true, foregroundCanAsk: false, precise: true, background: true, backgroundCanAsk: false, notifications: true } : await readPermissions();
  const missing = tracked && Platform.OS !== "web" ? missingSteps(permissions, cfg) : [];
  return {
    tracked,
    orgId,
    noticeVersion: cfg.noticeVersion,
    acknowledgedVersion: cfg.acknowledgedVersion,
    intervalSeconds: cfg.intervalSeconds,
    retentionDays: cfg.retentionDays,
    notice: cfg.notice ?? null,
    missing,
    permissions,
    signature: signatureOf(orgId, cfg, missing),
  };
}

export async function wasDismissed(signature: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === signature;
  } catch {
    return false;
  }
}
export async function rememberDismissed(signature: string): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_KEY, signature).catch(() => undefined);
}
export async function forgetDismissed(): Promise<void> {
  await AsyncStorage.removeItem(DISMISSED_KEY).catch(() => undefined);
}

/** Runs one step. Returns true when the system dialog / settings page was shown. */
export async function performStep(step: SetupStep, status: SetupStatus): Promise<"asked" | "settings" | "acknowledged"> {
  const p = status.permissions;
  switch (step) {
    case "location":
      if (!p.foregroundCanAsk) {
        await Linking.openSettings();
        return "settings";
      }
      await Location.requestForegroundPermissionsAsync();
      return "asked";
    case "precise":
      // Android 12+: asking again offers "Precise"; iOS only changes it in the Settings app.
      if (Platform.OS === "android" && p.foregroundCanAsk) {
        await Location.requestForegroundPermissionsAsync();
        return "asked";
      }
      await Linking.openSettings();
      return "settings";
    case "background":
      // Android 11+: opens the app's location page where "Allow all the time" is chosen.
      if (!p.backgroundCanAsk) {
        await Linking.openSettings();
        return "settings";
      }
      await Location.requestBackgroundPermissionsAsync();
      return "asked";
    case "notifications": {
      const r = await PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS");
      if (r === "never_ask_again") {
        await Linking.openSettings();
        return "settings";
      }
      return "asked";
    }
    case "notice":
      await acknowledgeNotice(status.orgId);
      return "acknowledged";
  }
}

/** Open state of the set-up sheet (opened automatically, from Settings, or at tour start). */
export const useTrackingSetup = create<{ open: boolean; status: SetupStatus | null }>(() => ({ open: false, status: null }));
export const openTrackingSetup = (status?: SetupStatus) => useTrackingSetup.setState((s) => ({ open: true, status: status ?? s.status }));
export const closeTrackingSetup = () => useTrackingSetup.setState({ open: false });

/**
 * Right after the driver withdrew the acknowledgement the set-up must not pop up again by itself
 * (it would ask for exactly what was just withdrawn). It comes back on the next app start / sign-in;
 * the driver can always open it from Settings.
 */
let autoPromptSuppressed = false;
export const suppressAutoPrompt = () => {
  autoPromptSuppressed = true;
};
export const resetAutoPrompt = () => {
  autoPromptSuppressed = false;
};
export const isAutoPromptSuppressed = () => autoPromptSuppressed;
