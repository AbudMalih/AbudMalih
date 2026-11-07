import AsyncStorage from "@react-native-async-storage/async-storage";
import { BATCH_SIZE, MAX_BUFFERED, UploadRefused, appendFixes, bufferedCount, clearBuffer, flushBuffer, type Fix } from "../src/lib/trackingBuffer";

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
});
