import { api } from "./api";
import type { Format, Locale } from "./i18n";

/* Analytics (Phase B endpoints). Every figure comes from stored records; definitions come with it. */

export interface StopFigures {
  stops: number;
  delivered: number;
  pickedUp: number;
  failed: number;
  attempted: number;
  rescheduled: number;
  returned: number;
  skipped: number;
  cancelled: number;
  open: number;
  processed: number;
  successRate: number | null;
}

export interface TourFigures {
  tours: number;
  byStatus: { planned: number; running: number; completed: number; cancelled: number };
  archived: number;
  toursStarted: number;
  completionRate: number | null;
  onTimeStartRate: number | null;
  avgTourMinutes: number | null;
  activeHours: number;
  stopsPerTour: number | null;
  stopsPerActiveHour: number | null;
  planned: { coveredTours: number; plannedDistanceKm: number | null; plannedMinutes: number | null };
}

export interface PeriodFigures {
  stops: StopFigures;
  tours: TourFigures;
  avgIntervalMinutes: number | null;
}

export interface TrendBucket extends StopFigures {
  bucket: string;
  tours: number;
  toursCompleted: number;
}

export interface Summary {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  timeZone: string;
  granularity: "day" | "week" | "month";
  onTimeToleranceMinutes: number;
  current: PeriodFigures;
  previous: PeriodFigures;
  trend: TrendBucket[];
  failureReasons: { reason: string | null; status: string; count: number }[];
  definitions: Record<string, string>;
}

export type DriverRow = StopFigures & TourFigures & { driverId: string | null; name: string | null };
export type DepotRow = StopFigures & TourFigures & { depotId: string; name: string; drivers: number };
export type TourRow = StopFigures & {
  tourId: string;
  name: string;
  date: string;
  status: string;
  archived: boolean;
  depot: string;
  driver: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  minutes: number | null;
  plannedDistanceKm: number | null;
  plannedMinutes: number | null;
};

export interface AnalyticsQuery {
  from: string;
  to: string;
  depotId?: string;
  driverId?: string;
  granularity?: "day" | "week" | "month";
}

const qs = (q: AnalyticsQuery) => {
  const p = new URLSearchParams({ from: q.from, to: q.to });
  if (q.depotId) p.set("depotId", q.depotId);
  if (q.driverId) p.set("driverId", q.driverId);
  if (q.granularity) p.set("granularity", q.granularity);
  return p;
};

export const analyticsApi = (org: string) => ({
  summary: (q: AnalyticsQuery) => api<Summary>("GET", `/v1/orgs/${org}/analytics/summary?${qs(q)}`),
  drivers: (q: AnalyticsQuery) => api<{ drivers: DriverRow[] }>("GET", `/v1/orgs/${org}/analytics/drivers?${qs(q)}`),
  depots: (q: AnalyticsQuery) => api<{ depots: DepotRow[] }>("GET", `/v1/orgs/${org}/analytics/depots?${qs(q)}`),
  tours: (q: AnalyticsQuery) => api<{ tours: TourRow[] }>("GET", `/v1/orgs/${org}/analytics/tours?${qs(q)}`),
  /** `lang`: language of the export's column headings and labels (the figures are the same in every language). */
  exportUrl: (q: AnalyticsQuery, view: "drivers" | "depots" | "tours" | "trend", format: "csv" | "xlsx", lang?: Locale) => {
    const p = qs(q);
    p.set("view", view);
    p.set("format", format);
    if (lang) p.set("lang", lang);
    return `/api/turvio/v1/orgs/${org}/analytics/export?${p}`;
  },
});

/** Not delivered = failed + attempted + rescheduled + returned + skipped (processed, not successful). */
export const notDelivered = (s: StopFigures) => s.failed + s.attempted + s.rescheduled + s.returned + s.skipped;
export const delivered = (s: StopFigures) => s.delivered + s.pickedUp;

const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Calendar periods relative to the company's today (weeks start on Monday). */
export function presetRange(preset: "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "last_30", today: string): { from: string; to: string } {
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [y, m] = today.split("-").map(Number) as [number, number];
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: shift(today, -1), to: shift(today, -1) };
    case "week":
      return { from: shift(today, -dow), to: today };
    case "last_week":
      return { from: shift(today, -dow - 7), to: shift(today, -dow - 1) };
    case "month":
      return { from: monthStart, to: today };
    case "last_month": {
      const end = shift(monthStart, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
    case "last_30":
      return { from: shift(today, -29), to: today };
  }
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
}

/** "88.9 %". With `fmt` (from useI18n) the number follows the user's language; without it the output is unchanged. */
export const pct = (v: number | null, digits = 1, fmt?: Format) => (v === null ? "–" : fmt ? `${fmt.number(v * 100, digits)} %` : `${(v * 100).toFixed(digits)} %`);
/** Grouped number. With `fmt` in the user's language; without it German grouping as before. */
export const num = (v: number | null, digits = 0, fmt?: Format) =>
  v === null ? "–" : fmt ? fmt.number(v, digits) : v.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits });
