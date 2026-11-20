import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Offline buffer for live-tracking GPS fixes (docs/LIVE_TRACKING.md).
 *
 * Kept separate from the action outbox: fixes arrive every few seconds, so they are stored
 * in their own keys and uploaded in batches. Every fix has a client UUID – the server ignores
 * repeats, so a batch whose response was lost can simply be sent again.
 *
 * Storage layout (v2): small chunks of at most CHUNK_SIZE fixes under their own keys plus one
 * index key listing the chunks in order. An append only rewrites the last chunk (and the index),
 * never the whole buffer, and no single value gets near Android's ~2 MB row limit. A v1 buffer
 * (one JSON array under BUFFER_KEY) is migrated on first access, so nothing buffered before an
 * app update is lost.
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

/** v1 layout: one JSON array (migrated on first access). */
export const BUFFER_KEY = "turvio-gps-buffer-v1";
export const INDEX_KEY = "turvio-gps-buffer-v2:index";
const CHUNK_PREFIX = "turvio-gps-buffer-v2:chunk:";
/** About 8 hours at one fix per 10 s – far more than a dead zone; oldest dropped beyond. */
export const MAX_BUFFERED = 3000;
export const BATCH_SIZE = 200;
/** Fixes per storage key (~60 KB). */
export const CHUNK_SIZE = 250;

interface Index {
  /** Chunks oldest first, with their fix counts (so counting needs no chunk reads). */
  chunks: { id: number; n: number }[];
  /** Next chunk id (monotonic: a rewrite never overwrites a chunk the index still names). */
  next: number;
}

const chunkKey = (id: number) => `${CHUNK_PREFIX}${id}`;

let chain: Promise<unknown> = Promise.resolve();
/** Serialise buffer access: the background task and the app may run at the same time. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

function parseFixes(raw: string | null | undefined): Fix[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Fix[]) : [];
  } catch {
    return [];
  }
}

async function readIndex(): Promise<Index | null> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const idx = JSON.parse(raw) as Index;
    return Array.isArray(idx?.chunks) && typeof idx.next === "number" ? idx : null;
  } catch {
    return null;
  }
}

/**
 * Replace the whole buffer: new chunks are written under fresh ids first, then the index (the
 * commit point), then the old chunks are removed – an interrupted rewrite leaves the old buffer.
 */
async function rewrite(prev: Index, fixes: Fix[]): Promise<Index> {
  const kept = fixes.length > MAX_BUFFERED ? fixes.slice(fixes.length - MAX_BUFFERED) : fixes;
  const idx: Index = { chunks: [], next: prev.next };
  const pairs: [string, string][] = [];
  for (let i = 0; i < kept.length; i += CHUNK_SIZE) {
    const part = kept.slice(i, i + CHUNK_SIZE);
    const id = idx.next++;
    idx.chunks.push({ id, n: part.length });
    pairs.push([chunkKey(id), JSON.stringify(part)]);
  }
  if (pairs.length) await AsyncStorage.multiSet(pairs);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  if (prev.chunks.length) await AsyncStorage.multiRemove(prev.chunks.map((c) => chunkKey(c.id))).catch(() => undefined);
  return idx;
}

/** The index, migrating a v1 single-blob buffer the first time. */
async function load(): Promise<Index> {
  const idx = await readIndex();
  if (idx) return idx;
  let old: Fix[] = [];
  try {
    old = parseFixes(await AsyncStorage.getItem(BUFFER_KEY));
  } catch {
    old = [];
  }
  const migrated = await rewrite({ chunks: [], next: 1 }, old);
  await AsyncStorage.removeItem(BUFFER_KEY).catch(() => undefined);
  return migrated;
}

async function readAll(idx: Index): Promise<Fix[]> {
  if (!idx.chunks.length) return [];
  const rows = await AsyncStorage.multiGet(idx.chunks.map((c) => chunkKey(c.id)));
  return rows.flatMap(([, raw]) => parseFixes(raw));
}

const total = (idx: Index) => idx.chunks.reduce((s, c) => s + c.n, 0);

/** Add fixes; returns the buffer size. Beyond MAX_BUFFERED the oldest fixes are dropped. */
export function appendFixes(fixes: Fix[]): Promise<{ size: number; dropped: number }> {
  return locked(async () => {
    let idx = await load();
    if (!fixes.length) return { size: total(idx), dropped: 0 };
    const pairs: [string, string][] = [];
    const chunks = [...idx.chunks];
    let next = idx.next;
    let rest = fixes;
    // Fill up the last chunk (only that one is read and rewritten).
    const last = chunks.at(-1);
    if (last && last.n < CHUNK_SIZE) {
      const current = parseFixes(await AsyncStorage.getItem(chunkKey(last.id)));
      const merged = [...current, ...rest.slice(0, CHUNK_SIZE - current.length)];
      rest = rest.slice(CHUNK_SIZE - current.length);
      pairs.push([chunkKey(last.id), JSON.stringify(merged)]);
      chunks[chunks.length - 1] = { id: last.id, n: merged.length };
    }
    for (let i = 0; i < rest.length; i += CHUNK_SIZE) {
      const part = rest.slice(i, i + CHUNK_SIZE);
      const id = next++;
      chunks.push({ id, n: part.length });
      pairs.push([chunkKey(id), JSON.stringify(part)]);
    }
    await AsyncStorage.multiSet(pairs);
    idx = { chunks, next };
    // Cap: drop whole oldest chunks, then trim the (new) oldest one.
    let drop = Math.max(0, total(idx) - MAX_BUFFERED);
    const dropped = drop;
    const removed: number[] = [];
    while (drop > 0 && idx.chunks[0] && idx.chunks[0].n <= drop) {
      drop -= idx.chunks[0].n;
      removed.push(idx.chunks[0].id);
      idx.chunks.shift();
    }
    if (drop > 0 && idx.chunks[0]) {
      const first = idx.chunks[0];
      const trimmed = parseFixes(await AsyncStorage.getItem(chunkKey(first.id))).slice(drop);
      await AsyncStorage.setItem(chunkKey(first.id), JSON.stringify(trimmed));
      idx.chunks[0] = { id: first.id, n: trimmed.length };
    }
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx));
    if (removed.length) await AsyncStorage.multiRemove(removed.map(chunkKey)).catch(() => undefined);
    return { size: total(idx), dropped };
  });
}

export function bufferedCount(): Promise<number> {
  return locked(async () => total(await load()));
}

/** Remove all fixes (or those matching the filter). */
export function clearBuffer(filter?: (f: Fix) => boolean): Promise<void> {
  return locked(async () => {
    const idx = await load();
    await rewrite(idx, filter ? (await readAll(idx)).filter((f) => !filter(f)) : []);
  });
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
 * Upload buffered fixes in batches per tour, oldest first (never one request per fix). A fix
 * leaves the buffer once the server answered for it (accepted, duplicate or rejected as invalid /
 * outside the tour). On a transient error the rest stays for the next attempt.
 */
export function flushBuffer(send: (orgId: string, tourId: string, points: Fix[]) => Promise<UploadResult>): Promise<FlushOutcome> {
  return locked(async () => {
    let idx = await load();
    let buffer = await readAll(idx);
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
            idx = await rewrite(idx, buffer);
          }
          return { sent, rejected, remaining: buffer.length, error: e.message, refused: e.kind };
        }
        return { sent, rejected, remaining: buffer.length, error: e instanceof Error ? e.message : String(e) };
      }
      const done = new Set(batch.map((f) => f.id));
      buffer = buffer.filter((f) => !done.has(f.id));
      idx = await rewrite(idx, buffer);
      sent += result.accepted;
      rejected += result.rejected.length;
    }
    return { sent, rejected, remaining: 0 };
  });
}
