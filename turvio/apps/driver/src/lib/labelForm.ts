import type { Confidence, LabelExtraction } from "@turvio/shared";
import type { StopFormValues } from "./stopForm";

/** Turns a label extraction into form values + per-field confidence. */
export function formFromExtraction(x: LabelExtraction, base: StopFormValues, code?: string): { value: StopFormValues; confidence: Partial<Record<keyof StopFormValues, Confidence>> } {
  const pick = (f: { value: string | null }, fallback: string) => f.value ?? fallback;
  const tracking = code ?? x.trackingNumber.value ?? "";
  return {
    value: {
      ...base,
      recipientName: pick(x.recipientName, base.recipientName),
      street: pick(x.street, base.street),
      houseNumber: pick(x.houseNumber, base.houseNumber),
      postalCode: pick(x.postalCode, base.postalCode),
      city: pick(x.city, base.city),
      trackingNumbers: tracking,
    },
    confidence: {
      recipientName: x.recipientName.confidence,
      street: x.street.confidence,
      houseNumber: x.houseNumber.confidence,
      postalCode: x.postalCode.confidence,
      city: x.city.confidence,
      trackingNumbers: code ? "high" : x.trackingNumber.confidence,
    },
  };
}

