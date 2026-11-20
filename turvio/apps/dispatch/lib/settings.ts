import type { DriverSettings } from "@turvio/shared";
import { api } from "./api";
import { EN_T, type TFunction } from "./i18n";

/* Settings, personal preferences and live tracking administration (Phase B endpoints). */

export interface Preferences {
  language: string | null;
  theme: "system" | "dark" | "light";
  dateFormat: string;
  orgDefaults: Record<string, { defaultDepotId?: string | null; toursView?: "day" | "all" | "archived" }>;
  updatedAt: string | null;
}

export interface CompanySettings {
  company: {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
    contactEmail: string | null;
    contactPhone: string | null;
    address: { street: string | null; postalCode: string | null; city: string | null; country: string };
    website: string | null;
  };
  tracking: {
    mode: TrackingMode;
    intervalSeconds: number;
    noticeVersion: number;
    retentionDays: number;
    enabledAt: string | null;
    activeDrivers: number;
    pilots: number;
    pilotLimit: number;
    acknowledgedCurrentNotice: number;
    /** The company's part of the tracking notice (optional: older API versions do not send it). */
    notice?: TrackingNotice;
  };
  proofRetentionDays: number;
  driverRules: Required<Pick<DriverSettings, "podLocation" | "showRecipientPhone">> & { failureReasons: NonNullable<DriverSettings["failureReasons"]>; customFailureReasons: boolean };
  subscription: { plan: string; planCode: string; status: string } | null;
  yourRole: string;
  canEdit: { company: boolean; tracking: boolean; driverRules: boolean; team: boolean; locations: boolean };
  roles: Record<string, string[]>;
}

export type TrackingMode = "off" | "pilot" | "active_tours";

/** The company's part of the driver tracking notice; null = not set. */
export interface TrackingNotice {
  controller: string | null;
  contact: string | null;
  legalBasis: string | null;
  text: string | null;
}
/** Server limits (PATCH /tracking `notice`). */
export const NOTICE_MAX: Record<keyof TrackingNotice, number> = { controller: 500, contact: 300, legalBasis: 500, text: 2000 };

/** PATCH body for the notice form: trimmed, empty → null (the server does the same). */
export function noticePatch(form: Record<keyof TrackingNotice, string>): { notice: TrackingNotice } {
  const v = (s: string) => (s.trim() === "" ? null : s.trim());
  return { notice: { controller: v(form.controller), contact: v(form.contact), legalBasis: v(form.legalBasis), text: v(form.text) } };
}
export type DriverTrackingState =
  | "disabled"
  | "pilot_not_enabled"
  | "no_app_login"
  | "awaiting_acknowledgement"
  | "no_active_tour"
  | "tour_paused"
  | "no_recent_position"
  | "live";

export interface DriverTracking {
  driverId: string;
  name: string;
  depotId: string | null;
  depotName: string | null;
  pilot: boolean;
  hasAppLogin: boolean;
  effective: boolean;
  acknowledgedVersion: number | null;
  acknowledgedAt: string | null;
  acknowledgedCurrent: boolean;
  currentTour: { id: string; name: string; status: string } | null;
  lastPositionAt: string | null;
  positionAgeSeconds: number | null;
  permission: "unknown";
  state: DriverTrackingState;
}

export interface TrackingDrivers {
  serverTime: string;
  mode: TrackingMode;
  noticeVersion: number;
  staleAfterSeconds: number;
  /** Server rule; absent on older API versions (then derived, see trackingThresholds). */
  offlineAfterSeconds?: number;
  pilotLimit: number;
  summary: Partial<Record<DriverTrackingState, number>>;
  drivers: DriverTracking[];
}

/** Tone per driver tracking state; texts come from `trackingStateLabel` / `trackingStateExplain`. */
export const TRACKING_STATE: Record<DriverTrackingState, { tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  live: { tone: "success" },
  no_recent_position: { tone: "danger" },
  tour_paused: { tone: "neutral" },
  no_active_tour: { tone: "neutral" },
  awaiting_acknowledgement: { tone: "warning" },
  no_app_login: { tone: "neutral" },
  pilot_not_enabled: { tone: "neutral" },
  disabled: { tone: "neutral" },
};

export const trackingStateLabel = (s: DriverTrackingState, t: TFunction = EN_T) => t(`settings.state.${s}`);
export const trackingStateExplain = (s: DriverTrackingState, t: TFunction = EN_T) => t(`settings.explain.${s}`);
export const modeLabel = (m: TrackingMode, t: TFunction = EN_T) => t(`settings.mode.${m}`);

/** English mode names (kept for callers without a translator). */
export const MODE_LABEL: Record<TrackingMode, string> = { off: modeLabel("off"), pilot: modeLabel("pilot"), active_tours: modeLabel("active_tours") };

export const settingsApi = (org: string) => ({
  preferences: () => api<Preferences>("GET", "/v1/me/preferences"),
  savePreferences: (p: Partial<Pick<Preferences, "theme" | "orgDefaults" | "language">>) => api<Preferences>("PUT", "/v1/me/preferences", p),
  overview: () => api<CompanySettings>("GET", `/v1/orgs/${org}/settings`),
  saveCompany: (p: Record<string, string | null>) => api<void>("PATCH", `/v1/orgs/${org}/settings/company`, p),
  saveDriverRules: (r: DriverSettings) => api<unknown>("PUT", `/v1/orgs/${org}/settings/driver`, r),
  trackingDrivers: () => api<TrackingDrivers>("GET", `/v1/orgs/${org}/tracking/drivers`),
  setTracking: (b: { mode?: TrackingMode; pilotDriverIds?: string[]; confirmPilotConsent?: true; confirmPrerequisites?: true; newNoticeVersion?: boolean; notice?: Partial<TrackingNotice> }) =>
    api<{ mode: TrackingMode; intervalSeconds: number; noticeVersion: number; retentionDays: number }>("PATCH", `/v1/orgs/${org}/tracking`, b),
  setPilots: (driverIds: string[], enabled: boolean) =>
    api<{ changed: number; pilots: number }>("POST", `/v1/orgs/${org}/tracking/pilots`, { driverIds, enabled, ...(enabled ? { confirmPilotConsent: true } : {}) }),
});
