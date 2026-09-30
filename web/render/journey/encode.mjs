// Encodes finished frames into web-ready WebP sequences.
//   node render/journey/encode.mjs /tmp/journey/post/desktop public/journey/d
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const [src, dst, quality = "70"] = process.argv.slice(2);
mkdirSync(dst, { recursive: true });
let total = 0;
const files = readdirSync(src).filter((f) => /^f\d{3}\.png$/.test(f)).sort();
for (const f of files) {
  const out = join(dst, `${f.slice(1, 4)}.webp`);
  const info = await sharp(join(src, f)).webp({ quality: Number(quality), effort: 6, smartSubsample: true }).toFile(out);
  total += info.size;
}
console.log(`${files.length} frames, ${(total / 1048576).toFixed(1)} MB, avg ${(total / files.length / 1024).toFixed(0)} KB`);
