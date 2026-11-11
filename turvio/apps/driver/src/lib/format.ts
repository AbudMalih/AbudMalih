import { formatAddress, formatMinuteOfDay, isNotDelivered, isSuccess, type Stop, type StopStatus } from "@turvio/shared";
import type { Tone } from "../components/ui";

export const km = (m: number) => (m / 1000).toFixed(m < 10_000 ? 1 : 0);
export const minutes = (s: number) => Math.round(s / 60);
export function duration(s: number): string {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const windowText = (s: Stop) => (s.timeWindow ? `${formatMinuteOfDay(s.timeWindow.start)}–${formatMinuteOfDay(s.timeWindow.end)}` : null);
export const addressLine = (s: Stop) => formatAddress(s);
export function statusTone(st: StopStatus): Tone {
  if (isSuccess(st)) return "success";
  if (isNotDelivered(st)) return "danger";
  if (st === "in_progress") return "primary";
  if (st === "skipped") return "warning";
  return "neutral";
}
/**
 * Today's date as YYYY-MM-DD. With the company's time zone (from the server) this is the
 * company's calendar day – the day the server lists tours for. Without it (demo mode, before the
 * first sync) the phone's own day is used.
 */
export const todayIso = (timeZone?: string | null) => {
  const d = new Date();
  if (timeZone) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
      if (p.year && p.month && p.day) return `${p.year}-${p.month}-${p.day}`;
    } catch {
      // unknown zone on this device: fall back to the phone's day
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
