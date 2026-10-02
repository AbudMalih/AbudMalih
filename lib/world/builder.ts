import * as THREE from "three";

export type V3 = [number, number, number];

/** Accumulates line segments (pairs of points) for one LineSegments draw call. */
export class Lines {
  data: number[] = [];

  seg(a: V3, b: V3) {
    this.data.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    return this;
  }

  poly(pts: V3[], closed = false) {
    for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i], pts[i + 1]);
    if (closed && pts.length > 2) this.seg(pts[pts.length - 1], pts[0]);
    return this;
  }

  /** Axis-aligned box from min corner (x0,y0,z0) to (x1,y1,z1) — 12 edges. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const p: V3[] = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    this.poly([p[0], p[1], p[2], p[3]], true);
    this.poly([p[4], p[5], p[6], p[7]], true);
    for (let i = 0; i < 4; i++) this.seg(p[i], p[i + 4]);
    return this;
  }

  /** Circle in the YZ plane (wheels), centre c, radius r. */
  circleYZ(c: V3, r: number, n = 20) {
    const pts: V3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([c[0], c[1] + Math.sin(a) * r, c[2] + Math.cos(a) * r]);
    }
    return this.poly(pts, true);
  }

  /** Rectangle in the XY plane at depth z. */
  rectXY(x0: number, y0: number, x1: number, y1: number, z: number) {
    return this.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], true);
  }

  /** Rectangle in the YZ plane at x. */
  rectYZ(y0: number, z0: number, y1: number, z1: number, x: number) {
    return this.poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], true);
  }

  /** Append another builder transformed by matrix m. */
  merge(other: Lines, m?: THREE.Matrix4) {
    if (!m) {
      for (const v of other.data) this.data.push(v);
      return this;
    }
    const v = new THREE.Vector3();
    for (let i = 0; i < other.data.length; i += 3) {
      v.set(other.data[i], other.data[i + 1], other.data[i + 2]).applyMatrix4(m);
      this.data.push(v.x, v.y, v.z);
    }
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.data, 3));
    g.computeBoundingSphere();
    return g;
  }

  get count() {
    return this.data.length / 6;
  }
}

/** Collects solid occluder boxes (drawn in background colour → hidden-line look). */
export class Occluders {
  boxes: [number, number, number, number, number, number][] = [];
  add(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    this.boxes.push([x0, y0, z0, x1, y1, z1]);
    return this;
  }
  mesh(material: THREE.Material) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, this.boxes.length));
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const q = new THREE.Quaternion();
    this.boxes.forEach((b, i) => {
      // shrink a hair so outlines on the faces are never z-fought
      const e = 0.01;
      scl.set(Math.max(0.001, b[3] - b[0] - e), Math.max(0.001, b[4] - b[1] - e), Math.max(0.001, b[5] - b[2] - e));
      pos.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = this.boxes.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
}

/** Deterministic PRNG so the world is identical on every visit. */
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
