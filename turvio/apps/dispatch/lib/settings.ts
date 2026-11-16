import type { DriverSettings } from "@turvio/shared";
import { api } from "./api";

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
  tracking: { mode: TrackingMode; intervalSeconds: number; noticeVersion: number; retentionDays: number; enabledAt: string | null; activeDrivers: number; pilots: number; pilotLimit: number; acknowledgedCurrentNotice: number };
  proofRetentionDays: number;
  driverRules: Required<Pick<DriverSettings, "podLocation" | "showRecipientPhone">> & { failureReasons: NonNullable<DriverSettings["failureReasons"]>; customFailureReasons: boolean };
  subscription: { plan: string; planCode: string; status: string } | null;
  yourRole: string;
  canEdit: { company: boolean; tracking: boolean; driverRules: boolean; team: boolean; locations: boolean };
  roles: Record<string, string[]>;
}

export type TrackingMode = "off" | "pilot" | "active_tours";
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
  pilotLimit: number;
  summary: Partial<Record<DriverTrackingState, number>>;
  drivers: DriverTracking[];
}

export const TRACKING_STATE: Record<DriverTrackingState, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info"; explain: string }> = {
  live: { label: "Live", tone: "success", explain: "On an active tour, sending positions." },
  no_recent_position: { label: "No recent position", tone: "danger", explain: "On an active tour, but no position recently – never shown as live." },
  tour_paused: { label: "Tour paused", tone: "neutral", explain: "No positions are recorded while the tour is paused." },
  no_active_tour: { label: "No active tour", tone: "neutral", explain: "Tracking is ready; it only runs while a tour is being driven." },
  awaiting_acknowledgement: { label: "Awaiting acknowledgement", tone: "warning", explain: "The driver has not confirmed the current tracking notice – nothing is recorded." },
  no_app_login: { label: "No app login", tone: "neutral", explain: "This driver profile has no TURVIO Driver account." },
  pilot_not_enabled: { label: "Not in pilot", tone: "neutral", explain: "Pilot mode: only named pilot drivers are tracked." },
  disabled: { label: "Tracking off", tone: "neutral", explain: "Live tracking is switched off for the company." },
};

export const MODE_LABEL: Record<TrackingMode, string> = { off: "Off", pilot: "Pilot (named drivers)", active_tours: "All eligible drivers" };

export const settingsApi = (org: string) => ({
  preferences: () => api<Preferences>("GET", "/v1/me/preferences"),
  savePreferences: (p: Partial<Pick<Preferences, "theme" | "orgDefaults" | "language">>) => api<Preferences>("PUT", "/v1/me/preferences", p),
  overview: () => api<CompanySettings>("GET", `/v1/orgs/${org}/settings`),
  saveCompany: (p: Record<string, string | null>) => api<void>("PATCH", `/v1/orgs/${org}/settings/company`, p),
  saveDriverRules: (r: DriverSettings) => api<unknown>("PUT", `/v1/orgs/${org}/settings/driver`, r),
  trackingDrivers: () => api<TrackingDrivers>("GET", `/v1/orgs/${org}/tracking/drivers`),
  setTracking: (b: { mode?: TrackingMode; pilotDriverIds?: string[]; confirmPilotConsent?: true; confirmPrerequisites?: true; newNoticeVersion?: boolean }) =>
    api<{ mode: TrackingMode; intervalSeconds: number; noticeVersion: number; retentionDays: number }>("PATCH", `/v1/orgs/${org}/tracking`, b),
  setPilots: (driverIds: string[], enabled: boolean) =>
    api<{ changed: number; pilots: number }>("POST", `/v1/orgs/${org}/tracking/pilots`, { driverIds, enabled, ...(enabled ? { confirmPilotConsent: true } : {}) }),
});
