// Production build: one self-contained ESM bundle per entry point (no TypeScript
// runner, no node_modules at runtime). Workspace packages (@turvio/shared) are inlined.
import { build } from "esbuild";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
await build({
  absWorkingDir: root,
  entryPoints: { server: "src/server.ts", "import-addresses": "src/scripts/import-addresses.ts" },
  outdir: out,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  // Optional native binding of `pg`, never installed.
  external: ["pg-native"],
  // Some CommonJS dependencies call require(); provide it inside the ESM bundle.
  banner: { js: "import { createRequire as __turvioCreateRequire } from 'node:module'; const require = __turvioCreateRequire(import.meta.url);" },
  legalComments: "linked",
  logLevel: "warning",
});
console.log(`built ${out}/server.mjs and import-addresses.mjs`);
