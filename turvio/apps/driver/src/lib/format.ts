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
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
