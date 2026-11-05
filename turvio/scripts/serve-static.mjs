// Minimal static file server with SPA fallback for the TURVIO Driver web build
// (used for local testing only):  node scripts/serve-static.mjs <dir> <port>
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 8081);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2" };

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const html = existsSync(`${file}.html`) ? `${file}.html` : join(root, "index.html");
    file = existsSync(join(file, "index.html")) ? join(file, "index.html") : html;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on :${port}`));
