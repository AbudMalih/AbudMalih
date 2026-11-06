import {
  SCAN_BARCODE_TYPES,
  extractAddresses,
  findDuplicates,
  type AddressCandidate,
  type AddressExtraction,
  type Confidence,
  type DuplicateFinding,
  type GeoPoint,
  type NewStopInput,
  type Stop,
  type TrackingCandidate,
} from "@turvio/shared";
import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { deleteTemporary } from "./files";
import { ApiError, isTransient, type AuthClient } from "./auth";
import { ocrEngine } from "./ocr";
import { emptyStopForm, parseStopForm, type StopFormValues } from "./stopForm";

/**
 * "Add stops from a photo or screenshot": pick images, read them ON THE DEVICE (barcodes +
 * OCR), turn every address found into a draft, geocode exact matches, flag duplicates.
 * Images are never uploaded; app-private copies are deleted right after reading.
 */

export const MAX_IMAGES = 10;

/**
 * Where a draft's map position stands. Coordinates are only ever set from the geocoder's
 * exact house match, from the driver's pin, or after the driver confirmed a street-level hit.
 */
export type GeoState =
  | { status: "found"; location: GeoPoint } //            exact house-level match
  | { status: "confirm"; suggestion: GeoPoint } //        street-level only: driver must confirm or pin
  | { status: "confirmed"; location: GeoPoint } //        driver confirmed the street-level position
  | { status: "pinned"; location: GeoPoint } //           driver set the pin
  | { status: "not_found" } //                            no match: pin or save without position
  | { status: "unavailable" | "offline" } //              no address search right now
  | { status: "pending" };

export interface ImportDraft {
  key: string;
  values: StopFormValues;
  confidence: Partial<Record<keyof StopFormValues, Confidence>>;
  kind: AddressCandidate["kind"];
  tracking: TrackingCandidate[];
  warnings: string[];
  geo: GeoState;
  /** Driver chose to save without a map position (it is marked "needs position"). */
  withoutPosition: boolean;
  include: boolean;
  duplicates: DuplicateFinding[];
  /** Which image it came from (1-based; 0 = pasted or shared text) – shown on the card. */
  image: number;
}

export type ImageSource = "camera" | "gallery";

/** Opens the camera (one photo) or the system photo picker (several images, no gallery permission needed). */
export async function pickImages(source: ImageSource): Promise<{ uris: string[]; denied?: boolean }> {
  if (source === "camera" && Platform.OS !== "web") {
    const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ granted: false }));
    if (!perm.granted) return { uris: [], denied: true };
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    return { uris: r.canceled ? [] : r.assets.map((a) => a.uri) };
  }
  // Android Photo Picker / iOS PHPicker: the driver chooses images, the app gets copies only.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: MAX_IMAGES, quality: 0.9, exif: false });
  return { uris: r.canceled ? [] : r.assets.map((a) => a.uri).slice(0, MAX_IMAGES) };
}

/**
 * Reads one image. `ownsFile`: the URI is an app-private copy (camera, picker, share) and is
 * deleted afterwards – the driver's original in the gallery is never touched.
 */
export async function readImage(uri: string, ownsFile = true): Promise<{ extraction: AddressExtraction; ocr: boolean }> {
  try {
    const barcodes = await scanFromURLAsync(uri, [...SCAN_BARCODE_TYPES]).catch(() => []);
    const engine = ocrEngine();
    const lines = engine ? await engine.recognize(uri).catch(() => []) : [];
    return { extraction: extractAddresses(lines, barcodes.map((b) => ({ data: b.data, type: b.type }))), ocr: !!engine };
  } finally {
    if (ownsFile) await deleteTemporary(uri).catch(() => undefined);
  }
}

/** Reads plain text (shared text, clipboard) – no OCR needed. */
export function readText(text: string): AddressExtraction {
  return extractAddresses(text);
}

let seq = 0;
export function draftsFromExtraction(x: AddressExtraction, image: number): ImportDraft[] {
  return x.addresses.map((a) => {
    const notes = [
      a.kind === "packstation" ? `${a.street.value ?? "Packstation"} ${a.houseNumber.value ?? ""} – Postnummer: ${a.postNumber ?? "?"}`.trim() : null,
      a.kind === "parcel_shop" && a.shopName ? a.shopName : null,
    ].filter(Boolean);
    const values: StopFormValues = {
      ...emptyStopForm(""),
      recipientName: a.recipientName.value ?? "",
      street: a.street.value ?? "",
      houseNumber: a.houseNumber.value ?? "",
      postalCode: a.postalCode.value ?? "",
      city: a.city.value ?? "", // never filled from elsewhere (e.g. the depot city)
      trackingNumbers: a.trackingNumbers.map((t) => t.code).join("\n"),
      notes: notes.join("\n"),
    };
    const tc = a.trackingNumbers.length ? a.trackingNumbers.reduce<Confidence>((m, t) => (rank(t.confidence) < rank(m) ? t.confidence : m), "high") : undefined;
    return {
      key: `d${Date.now().toString(36)}${(seq++).toString(36)}`,
      values,
      confidence: { recipientName: a.recipientName.confidence, street: a.street.confidence, houseNumber: a.houseNumber.confidence, postalCode: a.postalCode.confidence, city: a.city.confidence, ...(tc ? { trackingNumbers: tc } : {}) },
      kind: a.kind,
      tracking: a.trackingNumbers,
      warnings: a.warnings,
      geo: { status: "pending" },
      withoutPosition: false,
      include: true,
      duplicates: [],
      image,
    };
  });
}

const rank = (c: Confidence) => ({ none: 0, low: 1, medium: 2, high: 3 })[c];

/**
 * Geocodes drafts that have no position yet through the TURVIO API (exact structured
 * matches only). Packstation/shop numbers are not street addresses: they need a pin.
 */
export async function geocodeDrafts(client: Pick<AuthClient, "request"> | null, drafts: ImportDraft[]): Promise<ImportDraft[]> {
  const todo = drafts.filter((d) => d.geo.status === "pending");
  if (!todo.length) return drafts;
  if (!client) return drafts.map((d) => (d.geo.status === "pending" ? { ...d, geo: { status: "unavailable" } } : d));
  const byKey = new Map<string, GeoState>();
  const routable = todo.filter((d) => d.kind !== "packstation" && d.values.street.trim().length >= 2 && /^\d{5}$/.test(d.values.postalCode.trim()));
  for (const d of todo) if (!routable.includes(d)) byKey.set(d.key, { status: "not_found" });
  try {
    for (let k = 0; k < routable.length; k += 200) {
      const chunk = routable.slice(k, k + 200);
      const res = await client.request<{ results: ({ precision?: string; location: GeoPoint } | null)[] }>("POST", "/v1/geocode/batch", {
        addresses: chunk.map((d) => ({ street: d.values.street.trim(), houseNumber: d.values.houseNumber.trim() || undefined, postalCode: d.values.postalCode.trim(), city: d.values.city.trim() || undefined })),
      });
      res.results.forEach((hit, j) => {
        const d = chunk[j]!;
        if (hit?.precision === "house") byKey.set(d.key, { status: "found", location: hit.location });
        else if (hit?.precision === "street") byKey.set(d.key, { status: "confirm", suggestion: hit.location });
        else byKey.set(d.key, { status: "not_found" });
      });
    }
  } catch (e) {
    // 503 = no geocoder configured; offline/5xx/429 = try later; other client errors = no result.
    const status = e instanceof ApiError && e.status === 503 ? "unavailable" : isTransient(e) ? "offline" : "not_found";
    for (const d of routable) if (!byKey.has(d.key)) byKey.set(d.key, { status } as GeoState);
  }
  return drafts.map((d) => (byKey.has(d.key) ? { ...d, geo: byKey.get(d.key)! } : d));
}

/** Recomputes duplicate findings against the tour and the other drafts of this import. */
export function markDuplicates(drafts: ImportDraft[], tourStops: Stop[]): ImportDraft[] {
  return drafts.map((d, i) => {
    const others = drafts.filter((o, j) => j < i && o.include).map((o) => ({ address: addrOf(o.values), trackingNumbers: codesOf(o.values) }));
    return { ...d, duplicates: findDuplicates({ type: d.values.type, address: addrOf(d.values), trackingNumbers: codesOf(d.values) }, tourStops, others) };
  });
}

const addrOf = (v: StopFormValues) => ({ street: v.street.trim(), houseNumber: v.houseNumber.trim(), postalCode: v.postalCode.trim(), city: v.city.trim() });
const codesOf = (v: StopFormValues) => v.trackingNumbers.split(/[\s,;]+/).filter(Boolean);

/** Position to save, or null. Never a street-level suggestion the driver did not confirm. */
export function positionOf(d: ImportDraft): GeoPoint | null {
  return d.geo.status === "found" || d.geo.status === "confirmed" || d.geo.status === "pinned" ? d.geo.location : null;
}

export type DraftReadiness = { ready: true; reason?: undefined } | { ready: false; reason: "invalid" | "needs_position_decision" | "excluded" };

/** A draft can be saved when its fields are valid and the position is settled (or explicitly skipped). */
export function readiness(d: ImportDraft): DraftReadiness {
  if (!d.include) return { ready: false, reason: "excluded" };
  if (!parseStopForm(d.values).ok) return { ready: false, reason: "invalid" };
  if (!positionOf(d) && !d.withoutPosition) return { ready: false, reason: "needs_position_decision" };
  return { ready: true };
}

/** NewStopInput for the store (source "geocoder" only for exact or confirmed geocoder positions). */
export function toStopInput(d: ImportDraft): NewStopInput {
  const r = parseStopForm({ ...d.values, location: positionOf(d), locationSource: d.geo.status === "pinned" ? "manual_pin" : positionOf(d) ? "geocoder" : null });
  if (!r.ok) throw new Error("draft is not valid");
  return r.value;
}
