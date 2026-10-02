/**
 * Builds the globe land texture used by the WebGL Earth.
 *  R = sharp land mask, G = softened relief (height), B = coastline band.
 * Run: node scripts/build-globe-texture.mjs  (requires ImageMagick `convert`)
 * Output: public/textures/earth-land-{4096,2048}.webp
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { feature } from "topojson-client";
import { geoEquirectangular, geoPath } from "d3-geo";

const W = 4096, H = 2048;
const topo = JSON.parse(readFileSync("node_modules/world-atlas/land-50m.json", "utf8"));
const land = feature(topo, topo.objects.land);
const projection = geoEquirectangular().fitExtent([[0, 0], [W, H]], { type: "Sphere" });
const d = geoPath(projection)(land);
const tmp = "scripts/.tmp";
mkdirSync(tmp, { recursive: true });
mkdirSync("public/textures", { recursive: true });
writeFileSync(`${tmp}/land.mvg`, `viewbox 0 0 ${W} ${H}\nfill black\nrectangle 0,0 ${W},${H}\nfill white\nfill-rule evenodd\npath '${d}'\n`);
const sh = (c) => execSync(c, { stdio: "inherit" });
sh(`convert mvg:${tmp}/land.mvg -colorspace Gray ${tmp}/mask.png`);
sh(`convert ${tmp}/mask.png -blur 0x7 ${tmp}/relief.png`);
// coastline band: difference of slightly blurred masks
sh(`convert ${tmp}/mask.png \\( ${tmp}/mask.png -blur 0x3 \\) -compose difference -composite -level 0,35% ${tmp}/coast.png`);
sh(`convert ${tmp}/mask.png ${tmp}/relief.png ${tmp}/coast.png -combine -define webp:method=6 -quality 88 public/textures/earth-land-4096.webp`);
sh(`convert public/textures/earth-land-4096.webp -resize 2048x1024 -quality 86 public/textures/earth-land-2048.webp`);
console.log("globe textures written");
