import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Offline buffer for live-tracking GPS fixes (docs/LIVE_TRACKING.md).
 *
 * Kept separate from the action outbox: fixes arrive every few seconds, so they are stored
 * in their own key and uploaded in batches. Every fix has a client UUID – the server ignores
 * repeats, so a batch whose response was lost can simply be sent again.
 */
export interface Fix {
  id: string;
  orgId: string;
  tourId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  /** ISO time the device measured the position (not upload time). */
  recordedAt: string;
}

export interface UploadResult {
  accepted: number;
  duplicates: number;
  rejected: { id: string; reason: string }[];
}

/** Upload error the buffer reacts to (anything else counts as transient: keep and retry). */
export class UploadRefused extends Error {
  constructor(
    readonly kind: "tracking_disabled" | "tracking_notice_required" | "tour_gone",
    message: string,
  ) {
    super(message);
  }
}

export const BUFFER_KEY = "turvio-gps-buffer-v1";
/** About 14 hours at one fix per 10 s – far more than a dead zone; oldest dropped beyond. */
export const MAX_BUFFERED = 5000;
export const BATCH_SIZE = 200;

let chain: Promise<unknown> = Promise.resolve();
/** Serialise buffer access: the background task and the app may run at the same time. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function read(): Promise<Fix[]> {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Fix[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function write(fixes: Fix[]): Promise<void> {
  await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(fixes));
}

/** Add fixes; returns the buffer size. Beyond MAX_BUFFERED the oldest fixes are dropped. */
export function appendFixes(fixes: Fix[]): Promise<{ size: number; dropped: number }> {
  return locked(async () => {
    const all = [...(await read()), ...fixes];
    const dropped = Math.max(0, all.length - MAX_BUFFERED);
    await write(dropped ? all.slice(dropped) : all);
    return { size: all.length - dropped, dropped };
  });
}

export function bufferedCount(): Promise<number> {
  return locked(async () => (await read()).length);
}

export function clearBuffer(filter?: (f: Fix) => boolean): Promise<void> {
  return locked(async () => write(filter ? (await read()).filter((f) => !filter(f)) : []));
}

export interface FlushOutcome {
  sent: number;
  rejected: number;
  remaining: number;
  /** Set when uploading stopped early (network, server refused). */
  error?: string;
  refused?: UploadRefused["kind"];
}

/**
 * Upload buffered fixes in batches per tour, oldest first. A fix leaves the buffer once the
 * server answered for it (accepted, duplicate or rejected as invalid / outside the tour). On
 * a transient error the rest stays for the next attempt.
 */
export function flushBuffer(send: (orgId: string, tourId: string, points: Fix[]) => Promise<UploadResult>): Promise<FlushOutcome> {
  return locked(async () => {
    let buffer = await read();
    let sent = 0;
    let rejected = 0;
    while (buffer.length) {
      const first = buffer[0]!;
      const batch = buffer.filter((f) => f.tourId === first.tourId).slice(0, BATCH_SIZE);
      let result: UploadResult;
      try {
        result = await send(first.orgId, first.tourId, batch);
      } catch (e) {
        if (e instanceof UploadRefused) {
          if (e.kind === "tracking_disabled" || e.kind === "tour_gone") {
            // Not allowed / nowhere to store: these positions must not be kept on the phone.
            buffer = buffer.filter((f) => f.tourId !== first.tourId);
            await write(buffer);
          }
          return { sent, rejected, remaining: buffer.length, error: e.message, refused: e.kind };
        }
        return { sent, rejected, remaining: buffer.length, error: e instanceof Error ? e.message : String(e) };
      }
      const done = new Set(batch.map((f) => f.id));
      buffer = buffer.filter((f) => !done.has(f.id));
      await write(buffer);
      sent += result.accepted;
      rejected += result.rejected.length;
    }
    return { sent, rejected, remaining: 0 };
  });
}
