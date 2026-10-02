import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Lines, Occluders, rng, type V3 } from "./builder";
import {
  CARTON,
  container,
  truck as buildTruck,
  gantryCrane,
  spreader as buildSpreader,
  stsCrane,
  ship,
  lampPost,
  gantrySign,
  rackRow,
  conveyor,
  carton as buildCarton,
} from "./models";
import type { Tier } from "@/lib/stage/store";
import { ANCHOR_DEFS } from "./anchors";

/**
 * THE LINE-WORLD
 * One continuous technical space in which the camera travels:
 *   container terminal → road → logistics facility → warehouse → one carton.
 * A single red route runs through all of it (continuation of the globe route).
 * Parameterised by a single journey value t ∈ [0, 1].
 */

const BG = 0x060607;
/**
 * Tonal rhythm of the journey (background = fog = occluder colour):
 * terminal near-black → road graphite → warehouse industrial metallic →
 * carton isolated in a lighter graphite (prepares the light chapters).
 */
const TONES: [number, number][] = [
  [0.0, 0x060607],
  [0.26, 0x08090a],
  [0.4, 0x0f1012],
  [0.6, 0x141518],
  [0.68, 0x1c1d21],
  [0.8, 0x202125],
  [0.9, 0x18191c],
  [1.0, 0x141518],
];
const COL = { dim: 0x2b2c30, mid: 0x5d5e63, hi: 0xd2d3d6, red: 0xc90216 };

export type WorldAnchor = { id: string; x: number; y: number; visible: boolean };
export type WorldHandle = {
  setSize: (w: number, h: number, dpr: number) => void;
  render: (t: number) => void;
  anchors: () => WorldAnchor[];
  cartonRect: () => { x: number; y: number; w: number; h: number };
  dispose: () => void;
};

/* --------------------------------------------------------------------------- */
/* Layout constants                                                             */
/* --------------------------------------------------------------------------- */
const FACADE_Z = -650;
const CARTON_POS = new THREE.Vector3(0, 0.86, -736);
const ROAD_PTS: V3[] = [
  [0, 0, 160], [0, 0, 60], [0, 0, 0], [0, 0, -70], [3, 0, -150], [22, 0, -250],
  [38, 0, -350], [34, 0, -450], [16, 0, -540], [2, 0, -605], [0, 0, -640],
];



type Key = { t: number; s: "w" | "k"; p: V3; l: V3; fov: number };
const KEYS: Key[] = [
  { t: 0.0, s: "w", p: [0.0, 150, 0.6], l: [0, 0, 0], fov: 30 },
  { t: 0.05, s: "w", p: [2, 62, 8], l: [0, 0, -1], fov: 32 },
  { t: 0.11, s: "w", p: [17, 6.5, 27], l: [0, 3, -2], fov: 34 },
  { t: 0.19, s: "w", p: [34, 15, 42], l: [-6, 9, -8], fov: 38 },
  { t: 0.26, s: "w", p: [24, 6.5, 36], l: [0, 6, 0], fov: 35 },
  { t: 0.3, s: "w", p: [15, 3.4, 21], l: [0, 4.4, 0], fov: 34 },
  { t: 0.36, s: "w", p: [8.6, 2.0, 9.5], l: [0, 2.6, -1], fov: 36 },
  { t: 0.41, s: "k", p: [7.6, 1.6, -19], l: [0, 2.2, -2], fov: 36 },
  { t: 0.47, s: "k", p: [5.4, 1.25, -24], l: [0, 2.4, -5], fov: 32 },
  { t: 0.525, s: "k", p: [-6.5, 3.6, 17], l: [0, 2.6, -32], fov: 40 },
  { t: 0.58, s: "k", p: [-2.2, 9.5, 31], l: [0, 3.5, -64], fov: 42 },
  { t: 0.62, s: "w", p: [0, 10.5, -584], l: [0, 6.2, -660], fov: 42 },
  { t: 0.655, s: "w", p: [0, 5.6, -642], l: [0, 4.8, -700], fov: 48 },
  { t: 0.7, s: "w", p: [0.4, 3.3, -668], l: [0, 3.1, -722], fov: 50 },
  { t: 0.765, s: "w", p: [1.6, 2.9, -702], l: [0, 1.8, -736], fov: 45 },
  { t: 0.82, s: "w", p: [2.3, 1.9, -725], l: [0, 1.06, -736], fov: 38 },
  { t: 0.89, s: "w", p: [0.85, 1.42, -733.9], l: [0, 1.06, -736], fov: 34 },
  { t: 1.0, s: "w", p: [0.0, 1.07, -734.15], l: [0, 1.06, -736], fov: 30 },
];

const FOG: [number, number, number][] = [
  [0.0, 90, 560],
  [0.08, 30, 430],
  [0.3, 24, 360],
  [0.6, 26, 430],
  [0.66, 14, 210],
  [0.8, 8, 120],
  [0.88, 2.2, 16],
  [0.95, 0.9, 4.5],
  [1.0, 0.8, 3.2],
];

const sm = (x: number) => x * x * (3 - 2 * x);
const cl = (x: number) => Math.min(1, Math.max(0, x));
const rg = (x: number, a: number, b: number) => cl((x - a) / (b - a));
const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createWorld(canvas: HTMLCanvasElement, tier: Tier): WorldHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(BG, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 40, 500);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 1600);

  const mats = {
    dim: new THREE.LineBasicMaterial({ color: COL.dim, fog: true }),
    mid: new THREE.LineBasicMaterial({ color: COL.mid, fog: true }),
    hi: new THREE.LineBasicMaterial({ color: COL.hi, fog: true }),
    redThin: new THREE.LineBasicMaterial({ color: COL.red, fog: true }),
    occ: new THREE.MeshBasicMaterial({ color: BG, fog: true, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 }),
  };
  const disposables: { dispose: () => void }[] = Object.values(mats);
  const add = (L: Lines, m: THREE.Material, parent: THREE.Object3D = scene) => {
    const g = L.geometry();
    disposables.push(g);
    const ls = new THREE.LineSegments(g, m);
    ls.frustumCulled = false;
    parent.add(ls);
    return ls;
  };
  const addOcc = (O: Occluders, parent: THREE.Object3D = scene) => {
    const mesh = O.mesh(mats.occ);
    disposables.push(mesh.geometry);
    parent.add(mesh);
    return mesh;
  };

  const lowTier = tier === "low";
  const r = rng(11);

  /* ------------------------------------------------------------------------- */
  /* Road + route                                                               */
  /* ------------------------------------------------------------------------- */
  const road = new THREE.CatmullRomCurve3(ROAD_PTS.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const roadLen = road.getLength();
  const sAtZ = (z: number) => {
    let a = 0, b = 1;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (road.getPointAt(m).z > z) a = m;
      else b = m;
    }
    return ((a + b) / 2) * roadLen;
  };
  const S_CRANE = sAtZ(0);
  const S_WAIT = S_CRANE - 95;
  const S_STOP = sAtZ(-617);

  const routePts: THREE.Vector3[] = [];
  for (let s = 0; s <= roadLen; s += 1.2) routePts.push(road.getPointAt(s / roadLen));
  for (let z = -641; z >= -727; z -= 1.2) routePts.push(new THREE.Vector3(0, 0, z));
  const routeCum = [0];
  for (let i = 1; i < routePts.length; i++) routeCum.push(routeCum[i - 1] + routePts[i].distanceTo(routePts[i - 1]));
  const routeGeo = new LineGeometry();
  routeGeo.setPositions(routePts.flatMap((p) => [p.x, 0.03, p.z]));
  const routeMat = new LineMaterial({ color: COL.red, linewidth: 2, worldUnits: false, fog: true } as never);
  const route = new Line2(routeGeo, routeMat);
  route.frustumCulled = false;
  scene.add(route);
  disposables.push(routeGeo, routeMat);

  // road furniture
  {
    const L = new Lines();
    const D = new Lines();
    const tmp = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const s0 = sAtZ(-62);
    let prevL: V3 | null = null, prevR: V3 | null = null, prevL2: V3 | null = null, prevR2: V3 | null = null;
    for (let s = s0; s <= roadLen; s += 3) {
      road.getPointAt(s / roadLen, tmp);
      road.getTangentAt(s / roadLen, tan);
      const nx = -tan.z, nz = tan.x;
      const pl: V3 = [tmp.x + nx * 3.9, 0, tmp.z + nz * 3.9];
      const pr: V3 = [tmp.x - nx * 3.9, 0, tmp.z - nz * 3.9];
      const pl2: V3 = [tmp.x + nx * 5.6, 0, tmp.z + nz * 5.6];
      const pr2: V3 = [tmp.x - nx * 5.6, 0, tmp.z - nz * 5.6];
      if (prevL && prevR && prevL2 && prevR2) {
        L.seg(prevL, pl).seg(prevR, pr);
        D.seg(prevL2, pl2).seg(prevR2, pr2);
      }
      prevL = pl; prevR = pr; prevL2 = pl2; prevR2 = pr2;
    }
    // guard rail on outer side (posts + rail)
    for (let s = s0 + 40; s <= roadLen - 30; s += 6) {
      road.getPointAt(s / roadLen, tmp);
      road.getTangentAt(s / roadLen, tan);
      const nx = -tan.z, nz = tan.x;
      const p: V3 = [tmp.x - nx * 6.4, 0, tmp.z - nz * 6.4];
      D.seg(p, [p[0], 0.75, p[2]]);
      road.getPointAt(Math.min(1, (s + 6) / roadLen), tmp);
      road.getTangentAt(Math.min(1, (s + 6) / roadLen), tan);
      D.seg([p[0], 0.72, p[2]], [tmp.x + tan.z * 6.4, 0.72, tmp.z - tan.x * 6.4]);
    }
    // lamp posts
    let side = 1;
    for (let s = s0 + 20; s < roadLen - 25; s += lowTier ? 70 : 46) {
      road.getPointAt(s / roadLen, tmp);
      road.getTangentAt(s / roadLen, tan);
      const nx = -tan.z * side, nz = tan.x * side;
      lampPost(D, [tmp.x + nx * 7.4, 0, tmp.z + nz * 7.4], [-nx, -nz]);
      side *= -1;
    }
    // overhead gantry sign
    {
      const s = sAtZ(-318);
      road.getPointAt(s / roadLen, tmp);
      road.getTangentAt(s / roadLen, tan);
      const G = new Lines();
      gantrySign(G, 0, 0);
      const yaw = Math.atan2(-tan.x, -tan.z);
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(tmp.x, 0, tmp.z);
      L.merge(G, m);
    }
    // terminal lane markings
    for (let z = 140; z > -60; z -= 9) {
      D.seg([-3.4, 0, z], [-3.4, 0, z - 4.5]).seg([3.4, 0, z], [3.4, 0, z - 4.5]);
    }
    // terminal gate canopy
    L.box(-15, 6.8, -76, 15, 7.6, -66);
    for (const x of [-13.5, -4.6, 4.6, 13.5]) L.seg([x, 0, -71], [x, 6.8, -71]);
    L.box(-6.2, 0, -73, -5.0, 2.6, -69).box(5.0, 0, -73, 6.2, 2.6, -69);
    add(L, mats.mid);
    add(D, mats.dim);
  }

  /* ------------------------------------------------------------------------- */
  /* Container terminal                                                         */
  /* ------------------------------------------------------------------------- */
  {
    const L = new Lines();
    const O = new Occluders();
    // stacks inside the crane span, either side of the truck lane
    for (const cx of [-8.6, -5.8, 5.8, 8.6]) {
      for (let zz = -44; zz <= 70; zz += 12.6) {
        if (Math.abs(zz) < 7 && Math.abs(cx) < 6) continue;
        const tiers = 1 + Math.floor(r() * 4);
        for (let k = 0; k < tiers; k++) container(L, O, cx, k * 2.59, zz, Math.abs(zz) < 30 ? 1 : 0);
      }
    }
    // outer blocks
    const blocks = lowTier ? 4 : 8;
    for (let b = 0; b < blocks; b++) {
      const side = b % 2 === 0 ? 1 : -1;
      const bx = side * (22 + Math.floor(b / 2) * 18);
      if (bx < -60) continue;
      for (let row = 0; row < 5; row++) {
        for (let zz = -60; zz <= 110; zz += 12.6) {
          if (r() < 0.12) continue;
          const tiers = 1 + Math.floor(r() * 4);
          for (let k = 0; k < tiers; k++) container(L, O, bx + row * 2.8, k * 2.59, zz, 0);
        }
      }
      const G = new Lines();
      gantryCrane(G, 0, 8.6, 18.5);
      L.merge(G, new THREE.Matrix4().makeTranslation(bx + 5.6, 0, -20 + (b % 3) * 38));
    }
    add(L, mats.dim);
    addOcc(O);

    // the hero crane over the lane
    const C = new Lines();
    gantryCrane(C, 0, 11.5, 19.5);
    add(C, mats.mid);

    // quay + ship-to-shore cranes + vessel (left)
    const Q = new Lines();
    const QO = new Occluders();
    Q.seg([-74, 0, -160], [-74, 0, 220]).seg([-74, -2, -160], [-74, -2, 220]);
    for (let z = -150; z < 220; z += 12) Q.seg([-74, 0, z], [-74, -2, z]);
    for (const z of lowTier ? [20] : [-60, 0, 60, 120]) stsCrane(Q, -76, z);
    ship(Q, QO, -112, -130, 200, lowTier ? 0 : 1);
    add(Q, mats.dim);
    addOcc(QO);
  }

  /* ------------------------------------------------------------------------- */
  /* Wind turbines on the horizon (rotor angle is scroll-driven)                */
  /* ------------------------------------------------------------------------- */
  const rotors: THREE.Group[] = [];
  if (!lowTier) {
    const T = new Lines();
    const spots: [number, number][] = [[260, -380], [330, -470], [-240, -520], [300, -600], [-320, -330], [420, -540]];
    for (const [x, z] of spots) {
      const h = 95;
      T.seg([x - 1.8, 0, z], [x - 0.9, h, z]).seg([x + 1.8, 0, z], [x + 0.9, h, z]);
      T.box(x - 1.2, h - 0.8, z - 1.5, x + 1.2, h + 1.6, z + 4.5);
      const g = new THREE.Group();
      g.position.set(x, h + 0.4, z - 1.6);
      const R = new Lines();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        R.seg([0, 0, 0], [Math.cos(a) * 46, Math.sin(a) * 46, 0]);
      }
      add(R, mats.dim, g);
      g.rotation.z = r() * Math.PI;
      scene.add(g);
      rotors.push(g);
    }
    add(T, mats.dim);
  }

  /* ------------------------------------------------------------------------- */
  /* Logistics facility                                                         */
  /* ------------------------------------------------------------------------- */
  const door = new THREE.Group();
  {
    const L = new Lines();
    const D = new Lines();
    const O = new Occluders();
    const X = 92, H = 14, Z1 = FACADE_Z - 130, z = FACADE_Z;
    L.box(-X, 0, Z1, X, H, z);
    // parapet
    L.seg([-X, H + 0.9, z], [X, H + 0.9, z]).seg([-X, H, z], [-X, H + 0.9, z]).seg([X, H, z], [X, H + 0.9, z]);
    // facade cladding + column rhythm
    for (let y = 1.2; y < H; y += 1.15) {
      D.seg([-X, y, z + 0.02], [-4.6, y, z + 0.02]).seg([4.6, y, z + 0.02], [X, y, z + 0.02]);
    }
    for (let y = 7.6; y < H; y += 1.15) D.seg([-4.6, y, z + 0.02], [4.6, y, z + 0.02]);
    for (let x = -X; x <= X; x += 7.5) L.seg([x, 0, z + 0.03], [x, H, z + 0.03]);
    // dock doors
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const cx = s * (13 + i * 5.4);
        L.rectXY(cx - 1.5, 1.2, cx + 1.5, 4.2, z + 0.05);
        D.rectXY(cx - 1.85, 0.95, cx + 1.85, 4.55, z + 0.35);
        D.seg([cx - 1.85, 4.55, z + 0.35], [cx - 1.85, 4.55, z + 0.05]).seg([cx + 1.85, 4.55, z + 0.35], [cx + 1.85, 4.55, z + 0.05]);
        for (let y = 1.6; y < 4.2; y += 0.42) D.seg([cx - 1.5, y, z + 0.06], [cx + 1.5, y, z + 0.06]);
        D.box(cx - 1.4, 0.0, z + 0.05, cx + 1.4, 1.2, z + 0.5);
      }
    }
    // main door frame + canopy
    L.rectXY(-4.6, 0, 4.6, 7.6, z + 0.05);
    L.box(-6.5, 8.4, z, 6.5, 8.8, z + 3.2);
    // front wall occluders (leave the door opening)
    O.add(-X, 0, z - 0.4, -4.6, H, z).add(4.6, 0, z - 0.4, X, H, z).add(-4.6, 7.6, z - 0.4, 4.6, H, z);
    // roof + side walls + back (thin) — hide the interior from outside
    O.add(-X, H - 0.3, Z1, X, H, z).add(-X, 0, Z1, -X + 0.3, H, z).add(X - 0.3, 0, Z1, X, H, z).add(-X, 0, Z1, X, H, Z1 + 0.3);
    // yard markings in front
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const cx = s * (13 + i * 5.4);
        D.seg([cx - 1.7, 0.01, z + 1], [cx - 1.7, 0.01, z + 24]).seg([cx + 1.7, 0.01, z + 1], [cx + 1.7, 0.01, z + 24]);
      }
    }
    add(L, mats.mid);
    add(D, mats.dim);
    addOcc(O);

    // sectional door (rises on scroll)
    const DL = new Lines();
    DL.rectXY(-4.5, 0, 4.5, 7.55, 0);
    for (let y = 0.62; y < 7.5; y += 0.62) DL.seg([-4.5, y, 0], [4.5, y, 0]);
    DL.rectXY(-3.6, 3.9, 3.6, 4.4, 0.01);
    const DO = new Occluders();
    DO.add(-4.5, 0, -0.08, 4.5, 7.55, -0.02);
    add(DL, mats.mid, door);
    addOcc(DO, door);
    door.position.set(0, 0, z - 0.45);
    scene.add(door);
  }

  /* ------------------------------------------------------------------------- */
  /* Warehouse interior                                                         */
  /* ------------------------------------------------------------------------- */
  {
    const L = new Lines();
    const D = new Lines();
    const O = new Occluders();
    const levels = [0.15, 1.85, 3.55, 5.25, 6.95, 8.65];
    const rows = tier === "high" ? 8 : tier === "medium" ? 6 : 4;
    const loadRows = tier === "high" ? 5 : tier === "medium" ? 3 : 2;
    for (let k = 0; k < rows; k++) {
      for (const s of [-1, 1]) {
        const c = s * (6.2 + k * 5.6);
        rackRow(k < 2 ? L : D, D, O, c - 1.2, c + 1.2, -720, -662, {
          levels,
          bay: 2.9,
          loads: k < loadRows,
          fill: 0.62,
          seed: 100 + k * 7 + (s > 0 ? 3 : 0),
        });
      }
    }
    // floor markings
    for (const x of [-4.2, 4.2]) D.seg([x, 0.01, FACADE_Z - 1], [x, 0.01, -775]);
    for (let z = -662; z >= -722; z -= 2.9) {
      D.seg([-4.2, 0.01, z], [-3.6, 0.01, z]).seg([3.6, 0.01, z], [4.2, 0.01, z]);
    }
    // ceiling luminaires
    for (let z = -656; z > -776; z -= 6) {
      for (const x of [0, -9, 9, -20, 20, -31, 31]) L.seg([x, 12.4, z], [x, 12.4, z - 3.2]);
    }
    // roof trusses
    for (let z = FACADE_Z - 7.5; z > -780; z -= 15) {
      D.seg([-92, 13.6, z], [92, 13.6, z]).seg([-92, 12.9, z], [92, 12.9, z]);
    }
    // columns
    for (let z = FACADE_Z - 15; z > -780; z -= 15) for (const x of [-34, -17, 17, 34]) D.seg([x, 0, z], [x, 13.6, z]);
    // conveyor + neighbouring cartons
    conveyor(L, D, -748, -726);
    const CB = new Lines();
    for (const zc of [-730.6, -741.4, -744.8]) {
      const c = new Lines();
      buildCarton(c);
      CB.merge(c, new THREE.Matrix4().makeTranslation(0, 0.86, zc));
      O.add(-CARTON.w / 2, 0.86, zc - CARTON.d / 2, CARTON.w / 2, 0.86 + CARTON.h, zc + CARTON.d / 2);
    }
    add(L, mats.mid);
    add(D, mats.dim);
    add(CB, mats.mid);
    addOcc(O);
  }

  /* ------------------------------------------------------------------------- */
  /* Dynamic actors                                                             */
  /* ------------------------------------------------------------------------- */
  const heroBox = new THREE.Group();
  {
    const L = new Lines();
    const O = new Occluders();
    container(L, O, 0, 0, 0, 2);
    add(L, mats.hi, heroBox);
    addOcc(O, heroBox);
    scene.add(heroBox);
  }

  const truckG = new THREE.Group();
  {
    const L = new Lines();
    const O = new Occluders();
    const R = new Lines();
    buildTruck(L, O, R);
    add(L, mats.hi, truckG);
    add(R, mats.redThin, truckG);
    addOcc(O, truckG);
    scene.add(truckG);
  }

  const spreaderG = new THREE.Group();
  {
    const L = new Lines();
    buildSpreader(L);
    add(L, mats.mid, spreaderG);
    const T = new Lines();
    T.box(-1.8, 20.7, -1.4, 1.8, 22.0, 1.4);
    add(T, mats.mid);
    scene.add(spreaderG);
  }
  const ropeArr = new Float32Array(4 * 6);
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute("position", new THREE.BufferAttribute(ropeArr, 3));
  const ropes = new THREE.LineSegments(ropeGeo, mats.mid);
  ropes.frustumCulled = false;
  scene.add(ropes);
  disposables.push(ropeGeo);

  const cartonG = new THREE.Group();
  {
    const L = new Lines();
    buildCarton(L);
    const O = new Occluders();
    O.add(-CARTON.w / 2, 0, -CARTON.d / 2, CARTON.w / 2, CARTON.h, CARTON.d / 2);
    add(L, mats.hi, cartonG);
    addOcc(O, cartonG);
    cartonG.position.copy(CARTON_POS);
    scene.add(cartonG);
  }

  /* ------------------------------------------------------------------------- */
  /* Per-frame evaluation                                                        */
  /* ------------------------------------------------------------------------- */
  let W = 1, H = 1;
  const tP = new THREE.Vector3();
  const tT = new THREE.Vector3();
  const v = new THREE.Vector3();

  function truckS(t: number) {
    if (t < 0.225) return S_WAIT;
    if (t < 0.31) return S_WAIT + (S_CRANE - S_WAIT) * (1 - Math.pow(1 - rg(t, 0.225, 0.31), 3));
    if (t < 0.4) return S_CRANE;
    return S_CRANE + (S_STOP - S_CRANE) * io(rg(t, 0.4, 0.605));
  }

  function placeTruck(t: number) {
    const s = truckS(t);
    const u = Math.min(1, Math.max(0, s / roadLen));
    road.getPointAt(u, tP);
    road.getTangentAt(u, tT);
    truckG.position.copy(tP);
    truckG.rotation.set(0, Math.atan2(-tT.x, -tT.z), 0);
    truckG.updateMatrixWorld(true);
    return s;
  }

  function placeContainer(t: number) {
    const top = 2.59;
    let y = 0;
    if (t < 0.13) y = 0;
    else if (t < 0.215) y = 8.4 * io(rg(t, 0.13, 0.215));
    else if (t < 0.32) y = 8.4;
    else y = 8.4 + (1.36 - 8.4) * io(rg(t, 0.32, 0.38));
    if (t >= 0.38) {
      heroBox.position.set(0, 1.36, 0).applyMatrix4(truckG.matrixWorld);
      heroBox.rotation.copy(truckG.rotation);
    } else {
      heroBox.position.set(0, y, 0);
      heroBox.rotation.set(0, 0, 0);
    }
    // spreader: attached until release, then hoists back up
    let sy = y + top;
    if (t >= 0.38) sy = 1.36 + top + (12.5 - 1.36 - top) * io(rg(t, 0.385, 0.47));
    if (t < 0.12) sy = top + 6.5 * (1 - io(rg(t, 0.03, 0.12)));
    spreaderG.position.set(0, sy, 0);
    const corners: [number, number][] = [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]];
    corners.forEach(([x, z], i) => {
      ropeArr.set([x, 20.7, z, x * 0.5, sy + 0.9, z * 2.5], i * 6);
    });
    ropeGeo.attributes.position.needsUpdate = true;
  }

  const kp = new THREE.Vector3();
  const kl = new THREE.Vector3();
  function keyWorld(k: Key, outP: THREE.Vector3, outL: THREE.Vector3) {
    outP.set(...k.p);
    outL.set(...k.l);
    if (k.s === "k") {
      outP.applyMatrix4(truckG.matrixWorld);
      outL.applyMatrix4(truckG.matrixWorld);
    }
  }
  const P = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const Lk = [0, 1, 2, 3].map(() => new THREE.Vector3());
  function catmull(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u: number) {
    const u2 = u * u, u3 = u2 * u;
    out.set(0, 0, 0)
      .addScaledVector(a, -0.5 * u3 + u2 - 0.5 * u)
      .addScaledVector(b, 1.5 * u3 - 2.5 * u2 + 1)
      .addScaledVector(c, -1.5 * u3 + 2 * u2 + 0.5 * u)
      .addScaledVector(d, 0.5 * u3 - 0.5 * u2);
    return out;
  }

  function placeCamera(t: number) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
    [k0, k1, k2, k3].forEach((k, j) => keyWorld(k, P[j], Lk[j]));
    let u = cl((t - k1.t) / (k2.t - k1.t));
    u = u + (sm(u) - u) * 0.35;
    catmull(kp, P[0], P[1], P[2], P[3], u);
    catmull(kl, Lk[0], Lk[1], Lk[2], Lk[3], u);
    camera.position.copy(kp);
    camera.up.set(0, 1, 0);
    camera.lookAt(kl);
    let fov = k1.fov + (k2.fov - k1.fov) * sm(u);
    const aspect = W / H;
    if (aspect < 1.5) {
      const f = Math.pow(1.6 / aspect, 0.55);
      fov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * f) * 180) / Math.PI;
    }
    camera.fov = Math.min(fov, 78);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function placeFog(t: number) {
    let i = 0;
    while (i < FOG.length - 2 && FOG[i + 1][0] <= t) i++;
    const a = FOG[i], b = FOG[i + 1];
    const u = sm(cl((t - a[0]) / (b[0] - a[0])));
    const fog = scene.fog as THREE.Fog;
    fog.near = a[1] + (b[1] - a[1]) * u;
    fog.far = a[2] + (b[2] - a[2]) * u;
  }

  const dimLit = new THREE.Color(0x4c4d52);
  const midLit = new THREE.Color(0x8a8b90);
  const toneA = new THREE.Color();
  const toneB = new THREE.Color();
  const tone = new THREE.Color();
  function placeTone(t: number) {
    let i = 0;
    while (i < TONES.length - 2 && TONES[i + 1][0] <= t) i++;
    const [ta, ca] = TONES[i];
    const [tb, cb] = TONES[i + 1];
    const u = sm(cl((t - ta) / (tb - ta)));
    tone.copy(toneA.setHex(ca)).lerp(toneB.setHex(cb), u);
    renderer.setClearColor(tone, 1);
    (scene.fog as THREE.Fog).color.copy(tone);
    mats.occ.color.copy(tone);
    // metallic warehouse: lines lift with the background
    const metal = sm(cl((t - 0.58) / 0.12)) * (1 - sm(cl((t - 0.86) / 0.12)));
    mats.dim.color.setHex(COL.dim).lerp(dimLit, metal);
    mats.mid.color.setHex(COL.mid).lerp(midLit, metal);
  }

  function render(t: number) {
    placeTone(t);
    const s = placeTruck(t);
    placeContainer(t);
    placeCamera(t);
    placeFog(t);
    door.position.y = 7.2 * io(rg(t, 0.585, 0.64));
    rotors.forEach((g, i) => (g.rotation.z = i * 1.3 + t * 26));
    // route reveal: ahead of the container / truck, complete inside the facility
    const reveal = t >= 0.6 ? 1e9 : Math.max(S_CRANE + 120, s + 95);
    let n = 0;
    while (n < routeCum.length - 1 && routeCum[n] < reveal) n++;
    (routeGeo as unknown as THREE.InstancedBufferGeometry).instanceCount = Math.max(1, n);
    renderer.render(scene, camera);
  }

  function setSize(w: number, h: number, dpr: number) {
    W = w;
    H = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    routeMat.resolution.set(w * dpr, h * dpr);
  }

  function projectPoint(p: THREE.Vector3) {
    v.copy(p).project(camera);
    const inFront = v.z < 1 && v.z > -1;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, inFront };
  }

  const anchorVec = new THREE.Vector3();
  function anchors(): WorldAnchor[] {
    return ANCHOR_DEFS.map((a) => {
      anchorVec.set(...a.p);
      const pp = projectPoint(anchorVec);
      return { id: a.id, x: pp.x, y: pp.y, visible: pp.inFront && pp.x > -50 && pp.x < W + 50 };
    });
  }

  const cc = new THREE.Vector3();
  function cartonRect() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const { w, h, d } = CARTON;
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
      cc.set((sx * w) / 2, sy * h, (sz * d) / 2).add(CARTON_POS);
      const p = projectPoint(cc);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function dispose() {
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { setSize, render, anchors, cartonRect, dispose };
}
