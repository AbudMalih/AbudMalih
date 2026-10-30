import { NewStopInput, parseMinuteOfDay, type GeoPoint, type NewStopParsed } from "@turvio/shared";

export interface StopFormValues {
  type: "delivery" | "pickup";
  recipientName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  trackingNumbers: string;
  windowFrom: string;
  windowTo: string;
  priority: boolean;
  notes: string;
  location: GeoPoint | null;
}

export const emptyStopForm = (city = ""): StopFormValues => ({
  type: "delivery",
  recipientName: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city,
  trackingNumbers: "",
  windowFrom: "",
  windowTo: "",
  priority: false,
  notes: "",
  location: null,
});

export type StopFormErrors = Partial<Record<keyof StopFormValues, true>>;

/** Convert raw form strings into a validated NewStopInput, or field errors. */
export function parseStopForm(
  v: StopFormValues,
): { ok: true; value: NewStopParsed } | { ok: false; errors: StopFormErrors } {
  const errors: StopFormErrors = {};
  const from = v.windowFrom.trim() ? parseMinuteOfDay(v.windowFrom) : null;
  const to = v.windowTo.trim() ? parseMinuteOfDay(v.windowTo) : null;
  if (v.windowFrom.trim() && from === null) errors.windowFrom = true;
  if (v.windowTo.trim() && to === null) errors.windowTo = true;
  if ((from === null) !== (to === null) && !errors.windowFrom && !errors.windowTo) {
    errors[from === null ? "windowFrom" : "windowTo"] = true;
  }

  const result = NewStopInput.safeParse({
    type: v.type,
    recipientName: v.recipientName.trim() || undefined,
    address: {
      street: v.street,
      houseNumber: v.houseNumber.trim() || undefined,
      postalCode: v.postalCode,
      city: v.city,
    },
    location: v.location,
    timeWindow: from !== null && to !== null ? { start: from, end: to } : undefined,
    priority: v.priority,
    notes: v.notes.trim() || undefined,
    trackingNumbers: v.trackingNumbers
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  });

  if (!result.success) {
    for (const issue of result.error.issues) {
      const [head, sub] = issue.path;
      if (head === "address" && typeof sub === "string") errors[sub as keyof StopFormValues] = true;
      else if (head === "timeWindow") errors.windowTo = true;
      else if (typeof head === "string") errors[head as keyof StopFormValues] = true;
    }
  }
  if (Object.keys(errors).length > 0 || !result.success) return { ok: false, errors };
  return { ok: true, value: result.data };
}
