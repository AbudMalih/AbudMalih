import AsyncStorage from "@react-native-async-storage/async-storage";
import { BATCH_SIZE, BUFFER_KEY, CHUNK_SIZE, INDEX_KEY, MAX_BUFFERED, UploadRefused, appendFixes, bufferedCount, clearBuffer, flushBuffer, type Fix } from "../src/lib/trackingBuffer";

let n = 0;
const fix = (tourId = "t1", extra: Partial<Fix> = {}): Fix => ({
  id: `fix-${++n}`,
  orgId: "org",
  tourId,
  lat: 52.38,
  lng: 9.74,
  accuracy: 5,
  speed: 8,
  heading: 90,
  recordedAt: new Date(1_700_000_000_000 + n * 10_000).toISOString(),
  ...extra,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearBuffer();
});

describe("GPS offline buffer", () => {
  it("keeps fixes until the server answered, in order, in batches per tour", async () => {
    await appendFixes([fix("t1"), fix("t2"), fix("t1")]);
    const calls: { tourId: string; ids: string[] }[] = [];
    const out = await flushBuffer(async (_org, tourId, points) => {
      calls.push({ tourId, ids: points.map((p) => p.id) });
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(out).toEqual({ sent: 3, rejected: 0, remaining: 0 });
    expect(calls.map((c) => c.tourId)).toEqual(["t1", "t2"]);
    expect(calls[0]!.ids).toHaveLength(2);
    expect(await bufferedCount()).toBe(0);
  });

  it("keeps everything on a network error and sends it again later (idempotent ids)", async () => {
    const batch = [fix(), fix()];
    await appendFixes(batch);
    const offline = await flushBuffer(async () => {
      throw new Error("Network request failed");
    });
    expect(offline).toMatchObject({ sent: 0, remaining: 2, error: "Network request failed" });
    const seen: string[] = [];
    await flushBuffer(async (_o, _t, points) => {
      seen.push(...points.map((p) => p.id));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(seen).toEqual(batch.map((f) => f.id));
  });

  it("splits large backlogs into batches", async () => {
    await appendFixes(Array.from({ length: BATCH_SIZE * 2 + 5 }, () => fix()));
    const sizes: number[] = [];
    await flushBuffer(async (_o, _t, points) => {
      sizes.push(points.length);
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(sizes).toEqual([BATCH_SIZE, BATCH_SIZE, 5]);
  });

  it("drops the oldest fixes beyond the cap", async () => {
    const first = fix();
    await appendFixes([first]);
    const r = await appendFixes(Array.from({ length: MAX_BUFFERED }, () => fix()));
    expect(r).toEqual({ size: MAX_BUFFERED, dropped: 1 });
    const ids: string[] = [];
    await flushBuffer(async (_o, _t, points) => {
      ids.push(...points.map((p) => p.id));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(ids).not.toContain(first.id);
  });

  it("deletes positions when the company switched tracking off, keeps them when the notice is missing", async () => {
    await appendFixes([fix("t1"), fix("t2")]);
    const off = await flushBuffer(async () => {
      throw new UploadRefused("tracking_disabled", "off");
    });
    expect(off.refused).toBe("tracking_disabled");
    expect(await bufferedCount()).toBe(1); // t1 removed, t2 not attempted yet
    const notice = await flushBuffer(async () => {
      throw new UploadRefused("tracking_notice_required", "notice");
    });
    expect(notice.refused).toBe("tracking_notice_required");
    expect(await bufferedCount()).toBe(1);
  });

  it("removes fixes the server rejected as invalid (they would be rejected forever)", async () => {
    const [a, b] = [fix(), fix()];
    await appendFixes([a, b]);
    const out = await flushBuffer(async () => ({ accepted: 1, duplicates: 0, rejected: [{ id: b.id, reason: "outside_active_tour" }] }));
    expect(out).toEqual({ sent: 1, rejected: 1, remaining: 0 });
  });

  it("serialises concurrent writers (background task + app)", async () => {
    await Promise.all(Array.from({ length: 20 }, () => appendFixes([fix()])));
    expect(await bufferedCount()).toBe(20);
  });

  it("stores fixes in small chunks (no single big value) and reads them back in order", async () => {
    const all = Array.from({ length: CHUNK_SIZE * 2 + 17 }, () => fix());
    // Several appends of different sizes, as the background task delivers them.
    await appendFixes(all.slice(0, 3));
    await appendFixes(all.slice(3, 300));
    await appendFixes(all.slice(300));
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("turvio-gps-buffer-v2:chunk:"));
    expect(keys).toHaveLength(3);
    for (const k of keys) expect((JSON.parse((await AsyncStorage.getItem(k))!) as Fix[]).length).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(await AsyncStorage.getItem(BUFFER_KEY)).toBeNull();
    expect(await bufferedCount()).toBe(all.length);
    const ids: string[] = [];
    await flushBuffer(async (_o, _t, points) => {
      ids.push(...points.map((p) => p.id));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(ids).toEqual(all.map((f) => f.id));
    expect((await AsyncStorage.getAllKeys()).filter((k) => k.includes(":chunk:"))).toHaveLength(0);
  });

  it("caps at 3000 fixes, dropping the oldest (also across chunk borders)", async () => {
    expect(MAX_BUFFERED).toBe(3000);
    const all = Array.from({ length: MAX_BUFFERED + 123 }, () => fix());
    for (let i = 0; i < all.length; i += 700) await appendFixes(all.slice(i, i + 700));
    expect(await bufferedCount()).toBe(MAX_BUFFERED);
    const ids: string[] = [];
    await flushBuffer(async (_o, _t, points) => {
      ids.push(...points.map((p) => p.id));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(ids).toEqual(all.slice(123).map((f) => f.id));
  });

  it("migrates a buffer of the old single-blob format after an app update (nothing lost)", async () => {
    await AsyncStorage.clear(); // fresh install of the old version: no v2 index yet
    const old = Array.from({ length: 612 }, () => fix());
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(old));
    expect(await bufferedCount()).toBe(612);
    expect(await AsyncStorage.getItem(BUFFER_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(INDEX_KEY)).not.toBeNull();
    const extra = fix();
    await appendFixes([extra]);
    const ids: string[] = [];
    await flushBuffer(async (_o, _t, points) => {
      ids.push(...points.map((p) => p.id));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(ids).toEqual([...old, extra].map((f) => f.id));
  });

  it("migrates an oversized old buffer down to the cap (newest kept) and survives a corrupt one", async () => {
    await AsyncStorage.clear();
    const old = Array.from({ length: MAX_BUFFERED + 10 }, () => fix());
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(old));
    expect(await bufferedCount()).toBe(MAX_BUFFERED);
    await AsyncStorage.clear();
    await AsyncStorage.setItem(BUFFER_KEY, "{not json");
    expect(await bufferedCount()).toBe(0);
    await appendFixes([fix()]);
    expect(await bufferedCount()).toBe(1);
  });

  it("appends during an upload are neither lost nor sent twice (serialised access)", async () => {
    await appendFixes(Array.from({ length: 450 }, () => fix()));
    const sent: string[] = [];
    const late = Array.from({ length: 30 }, () => fix());
    const flushing = flushBuffer(async (_o, _t, points) => {
      sent.push(...points.map((p) => p.id));
      await new Promise((r) => setTimeout(r, 1));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    const appending = Promise.all(late.map((f) => appendFixes([f])));
    const cleared = clearBuffer((f) => f.id === "nope");
    await Promise.all([flushing, appending, cleared]);
    expect(sent).toHaveLength(450);
    expect(new Set(sent).size).toBe(450);
    expect(await bufferedCount()).toBe(30);
    const rest: string[] = [];
    await flushBuffer(async (_o, _t, points) => {
      rest.push(...points.map((p) => p.id));
      return { accepted: points.length, duplicates: 0, rejected: [] };
    });
    expect(rest).toEqual(late.map((f) => f.id));
  });

  it("clears with a filter (e.g. one company's positions) and completely", async () => {
    await appendFixes([fix("t1"), fix("t2", { orgId: "other" }), fix("t1")]);
    await clearBuffer((f) => f.orgId === "other");
    expect(await bufferedCount()).toBe(2);
    await clearBuffer();
    expect(await bufferedCount()).toBe(0);
  });
});
