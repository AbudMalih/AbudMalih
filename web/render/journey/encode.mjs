// Encodes finished frames into web-ready AVIF + WebP sequences.
//   node render/journey/encode.mjs /tmp/journey/post/desktop public/journey/d 1280x720
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const [src, dst, size] = process.argv.slice(2);
// optional target size "WxH" (frames are downscaled for lighter playback)
const [W, H] = size ? size.split("x").map(Number) : [];
const WEBP_Q = Number(process.env.WEBP_Q ?? 72);
const AVIF_Q = Number(process.env.AVIF_Q ?? 52);
// AVIF is only used for the poster/still images; limit it to those frames
const AVIF_ONLY = process.env.AVIF_ONLY ? new Set(process.env.AVIF_ONLY.split(",")) : null;
mkdirSync(dst, { recursive: true });
const files = readdirSync(src).filter((f) => /^f\d{3}\.png$/.test(f)).sort();
const total = { webp: 0, avif: 0 };
for (const f of files) {
  const base = join(dst, f.slice(1, 4));
  const img = W ? sharp(join(src, f)).resize(W, H, { kernel: "lanczos3" }) : sharp(join(src, f));
  total.webp += (await img.clone().webp({ quality: WEBP_Q, effort: 6, smartSubsample: true }).toFile(`${base}.webp`)).size;
  if (!AVIF_ONLY || AVIF_ONLY.has(f.slice(1, 4))) {
    total.avif += (await img.clone().avif({ quality: AVIF_Q, effort: 6, chromaSubsampling: "4:2:0" }).toFile(`${base}.avif`)).size;
  }
}
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`${files.length} frames · webp ${mb(total.webp)} MB (avg ${(total.webp / files.length / 1024).toFixed(0)} KB) · avif ${mb(total.avif)} MB (avg ${(total.avif / files.length / 1024).toFixed(0)} KB)`);
