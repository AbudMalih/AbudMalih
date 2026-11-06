import { deleteTemporary } from "./files";

/**
 * Items shared into TURVIO from other apps (WhatsApp, Gallery, Messages …) through the
 * system share sheet (Android intent / iOS Share Extension, via expo-share-intent).
 * Kept only in memory until the photo-import screen reads them; files are app-private
 * copies and are deleted after reading.
 */
export type SharedItem = { kind: "image"; uri: string } | { kind: "text"; text: string };

interface IncomingShare {
  text?: string | null;
  webUrl?: string | null;
  files?: { path: string; mimeType?: string | null; size?: number | null }[] | null;
}

export const MAX_SHARED_IMAGES = 10;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
let pending: SharedItem[] = [];

/** Accepts images (max 10, ≤ 25 MB each) and text; other files are discarded (their copies deleted). */
export function setPendingShare(share: IncomingShare): number {
  const items: SharedItem[] = [];
  for (const f of share.files ?? []) {
    const isImage = (f.mimeType ?? "").startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.path);
    const ok = isImage && (f.size ?? 0) <= MAX_IMAGE_BYTES && items.filter((i) => i.kind === "image").length < MAX_SHARED_IMAGES;
    if (ok) items.push({ kind: "image", uri: f.path });
    else void deleteTemporary(f.path).catch(() => undefined);
  }
  const text = (share.text ?? share.webUrl ?? "").trim();
  if (text) items.push({ kind: "text", text: text.slice(0, 20_000) });
  pending = items;
  return items.length;
}

export function hasPendingShare(): boolean {
  return pending.length > 0;
}

export async function consumeSharedItems(): Promise<SharedItem[]> {
  const out = pending;
  pending = [];
  return out;
}
