import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import type { Db } from "./db";

/**
 * Private storage for proof-of-delivery files. Files are never served
 * publicly: the API checks access (RLS on public.proofs) and streams them.
 *
 * - LocalProofStore: files on the API's disk (development / self-hosting with an encrypted volume).
 * - SupabaseProofStore: private Supabase Storage bucket, accessed with the service key
 *   (implemented against the documented REST API, not yet run against a live project).
 */
export interface ProofStore {
  readonly kind: string;
  put(path: string, bytes: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  delete(path: string): Promise<void>;
}

const SAFE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|svg)$/;
export function assertSafePath(path: string) {
  if (!SAFE_PATH.test(path)) throw new Error(`unsafe storage path: ${path}`);
}

const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", svg: "image/svg+xml" };

export class LocalProofStore implements ProofStore {
  readonly kind = "local";
  constructor(private readonly root: string) {}
  private file(path: string) {
    assertSafePath(path);
    const full = normalize(join(this.root, path));
    if (!full.startsWith(normalize(this.root) + sep)) throw new Error("path escapes storage root");
    return full;
  }
  async put(path: string, bytes: Buffer) {
    const f = this.file(path);
    await mkdir(dirname(f), { recursive: true, mode: 0o700 });
    await writeFile(f, bytes, { mode: 0o600 });
  }
  async get(path: string) {
    try {
      const bytes = await readFile(this.file(path));
      return { bytes, contentType: TYPE_BY_EXT[path.split(".").at(-1)!] ?? "application/octet-stream" };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async delete(path: string) {
    await rm(this.file(path), { force: true });
  }
}

export class SupabaseProofStore implements ProofStore {
  readonly kind = "supabase";
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket = "proofs",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  private headers(extra: Record<string, string> = {}) {
    return { authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }
  async put(path: string, bytes: Buffer, contentType: string) {
    assertSafePath(path);
    const r = await this.fetchImpl(`${this.url}/storage/v1/object/${this.bucket}/${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": contentType, "x-upsert": "true", "cache-control": "no-store" }),
      body: new Uint8Array(bytes),
    });
    if (!r.ok) throw new Error(`storage upload failed (${r.status})`);
  }
  async get(path: string) {
    assertSafePath(path);
    const r = await this.fetchImpl(`${this.url}/storage/v1/object/authenticated/${this.bucket}/${path}`, { headers: this.headers() });
    if (r.status === 404 || r.status === 400) return null;
    if (!r.ok) throw new Error(`storage download failed (${r.status})`);
    return { bytes: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get("content-type") ?? TYPE_BY_EXT[path.split(".").at(-1)!]! };
  }
  async delete(path: string) {
    assertSafePath(path);
    const r = await this.fetchImpl(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!r.ok && r.status !== 404) throw new Error(`storage delete failed (${r.status})`);
  }
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Checks the bytes really are what the client claims (magic numbers / strict SVG whitelist). */
export function validateProofContent(contentType: string, bytes: Buffer): string | null {
  if (bytes.length === 0 || bytes.length > MAX_PROOF_BYTES) return "file_size_invalid";
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? null : "not_a_jpeg";
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? null : "not_a_png";
  if (contentType === "image/svg+xml") return isSafeSignatureSvg(bytes.toString("utf8")) ? null : "svg_not_allowed";
  return "content_type_not_allowed";
}

const SVG_TAGS = new Set(["svg", "path", "g", "rect", "polyline"]);
const SVG_ATTRS = new Set(["xmlns", "viewBox", "width", "height", "d", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "x", "y"]);

/** Signatures are SVG drawn by the app: only paths, no scripts, links, styles, text or external references. */
export function isSafeSignatureSvg(svg: string): boolean {
  if (svg.length > 512 * 1024) return false;
  const s = svg.trim();
  if (!/^<svg[\s>]/.test(s) || !/<\/svg>$/.test(s)) return false;
  // Nothing but tags and whitespace (no text nodes, CDATA, comments, entities, processing instructions).
  if (/<!|<\?|&/.test(s)) return false;
  const withoutTags = s.replace(/<\/?[a-z]+(?:\s+[a-zA-Z-]+="[^"<>]*")*\s*\/?>/g, "");
  if (withoutTags.trim() !== "") return false;
  for (const m of s.matchAll(/<\/?([a-z]+)((?:\s+[a-zA-Z-]+="[^"<>]*")*)\s*\/?>/g)) {
    if (!SVG_TAGS.has(m[1]!)) return false;
    for (const a of m[2]!.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
      const [name, value] = [a[1]!, a[2]!];
      if (!SVG_ATTRS.has(name)) return false;
      if (name === "xmlns" ? value !== "http://www.w3.org/2000/svg" : !/^[-#a-zA-Z0-9 .,]*$/.test(value)) return false;
    }
  }
  return true;
}

/** Deletes files of proofs removed by admins or the retention purge (queue filled by a DB trigger). */
export async function processStorageDeletions(db: Db, store: ProofStore, log: (m: string) => void, batch = 100): Promise<number> {
  return db.asService(async (tx) => {
    const { rows } = await tx.query<{ id: string; path: string }>(
      `select id, path from app.storage_deletions where bucket = 'proofs' order by id limit $1 for update skip locked`,
      [batch],
    );
    let done = 0;
    for (const r of rows) {
      try {
        await store.delete(r.path);
        await tx.query(`delete from app.storage_deletions where id = $1`, [r.id]);
        done++;
      } catch (e) {
        log(`proof file deletion failed for queue item ${r.id}: ${(e as Error).message}`);
      }
    }
    return done;
  });
}
