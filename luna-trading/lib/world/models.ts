/**
 * Procedural line models — real-world dimensions in metres.
 * These are PLACEHOLDER geometry for the technical "line-world" stage.
 * Production renders / image sequences replace them per chapter
 * (see content/sequences.ts) without touching the scroll architecture.
 */
import { Lines, Occluders, rng, type V3 } from "./builder";

/* ISO 40' container: 12.19 × 2.44 × 2.59 — long axis on Z */
export const CONTAINER = { L: 12.19, W: 2.44, H: 2.59 };

export function container(
  L: Lines,
  O: Occluders | null,
  cx: number,
  y: number,
  cz: number,
  detail: 0 | 1 | 2 = 1
) {
  const { L: len, W, H } = CONTAINER;
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - len / 2, z1 = cz + len / 2;
  L.box(x0, y, z0, x1, y + H, z1);
  O?.add(x0, y, z0, x1, y + H, z1);
  if (detail === 0) return;
  // corrugation on long sides
  const step = detail === 2 ? 0.28 : 0.7;
  const inset = 0.12;
  for (let z = z0 + 0.4; z < z1 - 0.3; z += step) {
    L.seg([x0, y + inset, z], [x0, y + H - inset, z]);
    L.seg([x1, y + inset, z], [x1, y + H - inset, z]);
  }
  // top & bottom side rails
  L.seg([x0, y + inset, z0], [x0, y + inset, z1]).seg([x1, y + inset, z0], [x1, y + inset, z1]);
  L.seg([x0, y + H - inset, z0], [x0, y + H - inset, z1]).seg([x1, y + H - inset, z0], [x1, y + H - inset, z1]);
  // doors (rear, +z): split + 4 locking bars
  L.seg([cx, y + 0.08, z1], [cx, y + H - 0.08, z1]);
  for (const f of [-0.85, -0.55, 0.55, 0.85]) {
    L.seg([cx + (f * W) / 2, y + 0.18, z1 + 0.02], [cx + (f * W) / 2, y + H - 0.18, z1 + 0.02]);
  }
  if (detail === 2) {
    // corner castings
    const c = 0.17;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) {
      const sx = px === x0 ? 1 : -1;
      const sz = pz === z0 ? 1 : -1;
      L.rectXY(px, y, px + sx * c, y + c, pz).rectXY(px, y + H - c, px + sx * c, y + H, pz);
      L.rectYZ(y, pz, y + c, pz + sz * c, px);
    }
    // front wall corrugation (horizontal)
    for (let yy = y + 0.25; yy < y + H - 0.2; yy += 0.3) L.seg([x0, yy, z0], [x1, yy, z0]);
  }
}

/* -------------------------------------------------------------------------- */
/* European semi-trailer combination (≈16.5 m), local origin = trailer centre, */
/* forward = −Z.                                                                */
/* -------------------------------------------------------------------------- */
export function truck(L: Lines, O: Occluders, R: Lines) {
  const w = 1.27; // half width
  // --- skeletal container chassis ---
  const fy0 = 0.98, fy1 = 1.32;
  L.box(-0.55, fy0, -6.25, -0.35, fy1, 6.25).box(0.35, fy0, -6.25, 0.55, fy1, 6.25);
  for (const z of [-6.2, -3.0, 0, 3.0, 6.2]) L.seg([-1.22, fy1, z], [1.22, fy1, z]);
  L.seg([-1.22, fy1, -6.2], [-1.22, fy1, 6.2]).seg([1.22, fy1, -6.2], [1.22, fy1, 6.2]);
  // landing legs
  L.seg([-0.9, fy0, -3.9], [-0.9, 0.25, -3.9]).seg([0.9, fy0, -3.9], [0.9, 0.25, -3.9]);
  // tri-axle
  for (const z of [3.05, 4.36, 5.67]) wheelPair(L, O, z, 0.48, 1.03);
  // rear bumper / under-run guard + lights
  L.box(-1.2, 0.48, 6.18, 1.2, 0.6, 6.3);
  R.rectXY(-1.18, 0.64, -0.82, 0.86, 6.31).rectXY(0.82, 0.64, 1.18, 0.86, 6.31);
  // side under-run rails
  L.seg([-1.22, 0.62, -2.4], [-1.22, 0.62, 2.4]).seg([1.22, 0.62, -2.4], [1.22, 0.62, 2.4]);

  // --- tractor ---
  const cz0 = -10.2, cz1 = -7.85, cy0 = 1.02, cy1 = 3.62, roof = 3.95;
  // cab body
  L.box(-w, cy0, cz0, w, cy1, cz1);
  O.add(-w, cy0, cz0, w, roof, cz1);
  // roof spoiler (tapered)
  L.poly([[-w + 0.06, cy1, cz0 + 0.25], [-w + 0.12, roof, cz0 + 0.55], [w - 0.12, roof, cz0 + 0.55], [w - 0.06, cy1, cz0 + 0.25]]);
  L.poly([[-w + 0.12, roof, cz0 + 0.55], [-w + 0.12, roof, cz1], [w - 0.12, roof, cz1], [w - 0.12, roof, cz0 + 0.55]]);
  L.seg([-w + 0.06, cy1, cz1], [-w + 0.12, roof, cz1]).seg([w - 0.06, cy1, cz1], [w - 0.12, roof, cz1]);
  // windscreen
  L.rectXY(-w + 0.12, 2.12, w - 0.12, 3.28, cz0 - 0.005);
  L.seg([0, 2.12, cz0 - 0.005], [0, 3.28, cz0 - 0.005]);
  // sun visor
  L.seg([-w + 0.05, 3.4, cz0 - 0.08], [w - 0.05, 3.4, cz0 - 0.08]);
  // grille
  for (let y = 1.3; y <= 1.95; y += 0.13) L.seg([-0.82, y, cz0 - 0.005], [0.82, y, cz0 - 0.005]);
  // headlights
  L.rectXY(-w + 0.1, 0.98, -w + 0.55, 1.18, cz0 - 0.01).rectXY(w - 0.55, 0.98, w - 0.1, 1.18, cz0 - 0.01);
  // bumper
  L.box(-w, 0.45, cz0 - 0.12, w, 0.98, cz0 + 0.2);
  O.add(-w, 0.45, cz0 - 0.12, w, 0.98, cz0 + 0.2);
  // side windows + door
  for (const x of [-w - 0.005, w + 0.005]) {
    L.poly([[x, 2.15, cz0 + 0.18], [x, 3.2, cz0 + 0.18], [x, 3.2, cz0 + 1.25], [x, 2.15, cz0 + 1.42]], true);
    L.poly([[x, 1.1, cz0 + 0.12], [x, 3.3, cz0 + 0.12], [x, 3.3, cz0 + 1.6], [x, 1.1, cz0 + 1.6]], false);
    // steps
    L.seg([x, 0.62, cz0 + 0.3], [x, 0.62, cz0 + 1.1]).seg([x, 0.82, cz0 + 0.3], [x, 0.82, cz0 + 1.1]);
  }
  // mirrors
  for (const s of [-1, 1]) {
    L.seg([s * w, 2.9, cz0 + 0.25], [s * (w + 0.32), 2.95, cz0 + 0.05]);
    L.box(s > 0 ? w + 0.28 : -w - 0.42, 2.45, cz0 - 0.02, s > 0 ? w + 0.42 : -w - 0.28, 3.05, cz0 + 0.1);
  }
  // tractor chassis + fuel tank + fifth wheel
  L.box(-0.5, 0.72, cz1, -0.34, 1.02, -4.0).box(0.34, 0.72, cz1, 0.5, 1.02, -4.0);
  L.box(w - 0.62, 0.48, cz1 + 0.15, w - 0.02, 1.0, cz1 + 1.35);
  L.box(-0.8, 1.02, -5.25, 0.8, 1.12, -4.15);
  // exhaust / fairing behind cab
  L.seg([-w + 0.1, cy1, cz1 + 0.04], [-w + 0.1, cy0 + 0.3, cz1 + 0.04]).seg([w - 0.1, cy1, cz1 + 0.04], [w - 0.1, cy0 + 0.3, cz1 + 0.04]);
  // axles
  wheelPair(L, O, -8.85, 0.52, 1.02);
  wheelPair(L, O, -4.7, 0.52, 1.02);
  // wheel arches over front axle
  for (const s of [-1, 1]) {
    const pts: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (i / 10);
      pts.push([s * w, 0.52 + Math.sin(a) * 0.68, -8.85 + Math.cos(a) * 0.68]);
    }
    L.poly(pts);
  }
}

function wheelPair(L: Lines, O: Occluders, z: number, r: number, x: number) {
  for (const s of [-1, 1]) {
    const cx = s * x;
    L.circleYZ([cx + s * 0.18, r, z], r, 22);
    L.circleYZ([cx + s * 0.18, r, z], r * 0.52, 14);
    L.circleYZ([cx - s * 0.12, r, z], r, 22);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      L.seg([cx + s * 0.18, r + Math.sin(a) * r * 0.18, z + Math.cos(a) * r * 0.18], [cx + s * 0.18, r + Math.sin(a) * r * 0.5, z + Math.cos(a) * r * 0.5]);
    }
    O.add(cx - 0.15 * (s > 0 ? 1 : 1.0) - 0.0, 0.02, z - r * 0.9, cx + 0.18, r * 1.9, z + r * 0.9);
  }
}

/* Rubber-tyred gantry crane straddling X ∈ [−span, span], centred at z. */
export function gantryCrane(L: Lines, cz: number, span = 11.5, height = 19.5) {
  const legsZ = [cz - 5.5, cz + 5.5];
  for (const sx of [-span, span]) {
    for (const z of legsZ) {
      L.box(sx - 0.35, 0.9, z - 0.35, sx + 0.35, height, z + 0.35);
      // bogie
      L.box(sx - 0.6, 0, z - 1.4, sx + 0.6, 0.9, z + 1.4);
      L.circleYZ([sx - 0.62, 0.45, z - 0.8], 0.42, 14).circleYZ([sx - 0.62, 0.45, z + 0.8], 0.42, 14);
    }
    // sill beam + diagonal bracing between legs
    L.box(sx - 0.3, 0.9, legsZ[0], sx + 0.3, 1.6, legsZ[1]);
    L.seg([sx, 1.6, legsZ[0]], [sx, height - 2.5, legsZ[1]]).seg([sx, 1.6, legsZ[1]], [sx, height - 2.5, legsZ[0]]);
    // E-room / cabin on one leg
    if (sx > 0) L.box(sx - 1.6, height - 6.5, legsZ[1] - 1.2, sx - 0.35, height - 4.6, legsZ[1] + 1.2);
  }
  // top girders along X at both z
  for (const z of legsZ) {
    L.box(-span - 0.8, height, z - 0.45, span + 0.8, height + 1.2, z + 0.45);
    for (let x = -span; x <= span; x += 2.3) L.seg([x, height, z - 0.45], [x + 1.15, height + 1.2, z - 0.45]).seg([x + 1.15, height + 1.2, z - 0.45], [x + 2.3, height, z - 0.45]);
  }
  // end ties
  for (const sx of [-span, span]) L.box(sx - 0.35, height - 0.8, legsZ[0], sx + 0.35, height + 1.2, legsZ[1]);
}

export function spreader(L: Lines) {
  const { L: len, W } = CONTAINER;
  L.box(-W / 2, 0, -len / 2, W / 2, 0.42, len / 2);
  L.seg([0, 0.42, -len / 2], [0, 0.42, len / 2]);
  L.box(-0.6, 0.42, -1.2, 0.6, 0.9, 1.2);
}

/* Ship-to-shore crane at quay x, centred at z — boom extends towards −X (over the ship). */
export function stsCrane(L: Lines, qx: number, cz: number) {
  const legs: [number, number][] = [[qx + 12, cz - 9], [qx + 12, cz + 9], [qx - 18, cz - 9], [qx - 18, cz + 9]];
  for (const [x, z] of legs) L.box(x - 0.6, 0, z - 0.6, x + 0.6, 46, z + 0.6);
  for (const x of [qx + 12, qx - 18]) {
    L.seg([x, 46, cz - 9], [x, 46, cz + 9]).seg([x, 14, cz - 9], [x, 14, cz + 9]);
    L.seg([x, 14, cz - 9], [x, 46, cz + 9]).seg([x, 14, cz + 9], [x, 46, cz - 9]);
  }
  for (const z of [cz - 9, cz + 9]) {
    L.seg([qx + 12, 46, z], [qx - 18, 46, z]).seg([qx + 12, 14, z], [qx - 18, 14, z]);
    // boom over water + backreach
    L.seg([qx + 30, 44, z], [qx - 64, 44, z]).seg([qx + 30, 47.5, z], [qx - 64, 47.5, z]);
    for (let x = qx - 64; x < qx + 30; x += 4) L.seg([x, 44, z], [x + 2, 47.5, z]).seg([x + 2, 47.5, z], [x + 4, 44, z]);
    // apex + forestays
    L.seg([qx - 3, 46, z], [qx - 3, 66, z]);
    L.seg([qx - 3, 66, z], [qx - 64, 47.5, z]).seg([qx - 3, 66, z], [qx + 30, 47.5, z]);
  }
  L.seg([qx - 3, 66, cz - 9], [qx - 3, 66, cz + 9]);
}

/* Container vessel alongside the quay, hull long axis on Z. */
export function ship(L: Lines, O: Occluders, x: number, z0: number, z1: number, detail: number) {
  const bw = 24, hull = 14;
  const len = z1 - z0;
  // hull with bow taper toward −z
  const top = (zz: number, side: 1 | -1): V3 => [x + side * bw, hull, zz];
  L.poly([top(z1, -1), top(z0 + 30, -1), [x, hull, z0], top(z0 + 30, 1), top(z1, 1)]);
  L.seg(top(z1, -1), top(z1, 1));
  L.poly([[x - bw + 2, 0, z1], [x - bw + 2, 0, z0 + 34], [x, 0, z0 + 8], [x + bw - 2, 0, z0 + 34], [x + bw - 2, 0, z1]]);
  L.seg([x + bw, hull, z1], [x + bw - 2, 0, z1]).seg([x - bw, hull, z1], [x - bw + 2, 0, z1]);
  L.seg([x + bw, hull, z0 + 30], [x + bw - 2, 0, z0 + 34]).seg([x, hull, z0], [x, 0, z0 + 8]);
  O.add(x - bw, 0, z0 + 30, x + bw, hull, z1);
  // deckhouse near stern
  L.box(x - 14, hull, z1 - 26, x + 14, hull + 26, z1 - 14);
  O.add(x - 14, hull, z1 - 26, x + 14, hull + 26, z1 - 14);
  for (let yy = hull + 3; yy < hull + 26; yy += 3) L.seg([x + 14.01, yy, z1 - 26], [x + 14.01, yy, z1 - 14]);
  // container bays
  const r = rng(31);
  for (let zz = z0 + 36; zz < z1 - 32; zz += 13.4) {
    const tiers = 3 + Math.floor(r() * 4);
    for (let cx = -bw + 3; cx <= bw - 3; cx += 2.6) {
      if (detail < 1 && r() < 0.5) continue;
      const tt = Math.max(1, tiers - (Math.abs(cx) > bw - 6 ? 1 : 0));
      const y = hull;
      L.box(x + cx - 1.22, y, zz - 6.1, x + cx + 1.22, y + tt * 2.59, zz + 6.1);
      O.add(x + cx - 1.22, y, zz - 6.1, x + cx + 1.22, y + tt * 2.59, zz + 6.1);
      for (let k = 1; k < tt; k++) L.seg([x + cx + 1.22, y + k * 2.59, zz - 6.1], [x + cx + 1.22, y + k * 2.59, zz + 6.1]);
    }
  }
  void len;
}

export function lampPost(L: Lines, base: V3, dir: [number, number], h = 11) {
  const [x, y, z] = base;
  L.seg([x, y, z], [x, y + h, z]);
  const ax = x + dir[0] * 2.6, az = z + dir[1] * 2.6;
  L.seg([x, y + h, z], [ax, y + h + 0.35, az]);
  L.seg([ax, y + h + 0.35, az], [ax + dir[0] * 0.9, y + h + 0.25, az + dir[1] * 0.9]);
}

export function gantrySign(L: Lines, cx: number, cz: number, halfSpan = 9.5) {
  for (const s of [-1, 1]) L.box(cx + s * halfSpan - 0.25, 0, cz - 0.25, cx + s * halfSpan + 0.25, 7.6, cz + 0.25);
  L.seg([cx - halfSpan, 6.6, cz], [cx + halfSpan, 6.6, cz]).seg([cx - halfSpan, 7.6, cz], [cx + halfSpan, 7.6, cz]);
  for (let x = cx - halfSpan; x < cx + halfSpan - 0.1; x += 1) L.seg([x, 6.6, cz], [x + 1, 7.6, cz]);
  // two panels facing +z (approaching traffic)
  for (const ox of [-4.4, 1.4]) {
    L.rectXY(cx + ox, 4.3, cx + ox + 3.8, 6.5, cz + 0.3);
    L.rectXY(cx + ox + 0.12, 4.42, cx + ox + 3.68, 6.38, cz + 0.31);
    // arrow glyph
    const ax = cx + ox + 0.6;
    L.seg([ax, 4.75, cz + 0.32], [ax, 5.85, cz + 0.32]).seg([ax - 0.22, 5.6, cz + 0.32], [ax, 5.85, cz + 0.32]).seg([ax + 0.22, 5.6, cz + 0.32], [ax, 5.85, cz + 0.32]);
    for (let k = 0; k < 2; k++) L.seg([ax + 0.6, 5.55 - k * 0.5, cz + 0.32], [ax + 2.6 - k * 0.6, 5.55 - k * 0.5, cz + 0.32]);
  }
}

/* Double-sided pallet rack row, long axis Z, between x0..x1. */
export function rackRow(
  L: Lines,
  Ld: Lines,
  O: Occluders,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  opts: { levels: number[]; bay: number; loads: boolean; fill: number; seed: number }
) {
  const r = rng(opts.seed);
  const top = opts.levels[opts.levels.length - 1] + 1.6;
  for (let z = z0; z <= z1 + 0.01; z += opts.bay) {
    L.seg([x0, 0, z], [x0, top, z]).seg([x1, 0, z], [x1, top, z]);
    L.seg([x0, top, z], [x1, top, z]);
  }
  for (const y of opts.levels) {
    L.seg([x0, y, z0], [x0, y, z1]).seg([x1, y, z0], [x1, y, z1]);
  }
  if (!opts.loads) return;
  const slot = opts.bay / 3;
  for (let z = z0; z < z1 - 0.1; z += opts.bay) {
    for (const y of opts.levels) {
      for (let k = 0; k < 3; k++) {
        if (r() > opts.fill) continue;
        const za = z + k * slot + 0.06, zb = z + (k + 1) * slot - 0.06;
        const hgt = 0.9 + r() * 0.55;
        const xa = x0 + 0.05, xb = x1 - 0.05;
        // pallet + load
        Ld.box(xa, y + 0.02, za, xb, y + 0.16, zb);
        L.box(xa + 0.03, y + 0.16, za + 0.02, xb - 0.03, y + 0.16 + hgt, zb - 0.02);
        O.add(xa + 0.03, y + 0.16, za + 0.02, xb - 0.03, y + 0.16 + hgt, zb - 0.02);
        if (r() > 0.45) {
          const ym = y + 0.16 + hgt / 2;
          Ld.seg([xa + 0.03, ym, za + 0.02], [xa + 0.03, ym, zb - 0.02]).seg([xb - 0.03, ym, za + 0.02], [xb - 0.03, ym, zb - 0.02]);
        }
      }
    }
  }
}

/* Roller conveyor along Z at x=0, top at height h. */
export function conveyor(L: Lines, Ld: Lines, z0: number, z1: number, h = 0.86, w = 0.72) {
  for (const s of [-1, 1]) {
    L.seg([s * w / 2, h, z0], [s * w / 2, h, z1]).seg([s * w / 2, h - 0.14, z0], [s * w / 2, h - 0.14, z1]);
    for (let z = z0; z <= z1; z += 2.0) Ld.seg([s * w / 2, 0, z], [s * w / 2, h - 0.14, z]);
  }
  for (let z = z0 + 0.12; z < z1; z += 0.22) Ld.seg([-w / 2, h - 0.04, z], [w / 2, h - 0.04, z]);
}

/** Shipping carton, local origin at bottom-centre. Long side on X. */
export const CARTON = { w: 0.6, h: 0.4, d: 0.4 };
export function carton(L: Lines) {
  const { w, h, d } = CARTON;
  L.box(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  // flaps seam + tape across top and down the faces
  L.seg([-w / 2, h, 0], [w / 2, h, 0]);
  L.seg([-w / 2, h, -0.03], [w / 2, h, -0.03]).seg([-w / 2, h, 0.03], [w / 2, h, 0.03]);
  L.seg([-w / 2, h, -0.03], [-w / 2, h - 0.09, -0.03]).seg([-w / 2, h, 0.03], [-w / 2, h - 0.09, 0.03]);
  L.seg([w / 2, h, -0.03], [w / 2, h - 0.09, -0.03]).seg([w / 2, h, 0.03], [w / 2, h - 0.09, 0.03]);
  // label on the front face
  L.rectXY(0.08, 0.1, 0.26, 0.22, d / 2 + 0.002);
  L.seg([0.1, 0.14, d / 2 + 0.002], [0.24, 0.14, d / 2 + 0.002]);
}
