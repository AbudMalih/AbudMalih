import * as THREE from "three";

/**
 * Globe V2 (lab): a nautical-chart Earth.
 *
 * One sphere, one shader: charcoal oceans with depth contours drawn from the
 * coast-distance channel of the existing land texture (r = land, g = height,
 * b = distance to coast), ivory land lit by the real height field with
 * engraved latitude hatching in the shade, a crisp champagne coastline and
 * a faint graticule. A thin fresnel atmosphere, and trade lanes as tubes that
 * draw themselves (uProgress) with a soft travelling highlight.
 *
 * Rendering stops when the canvas is off-screen or the tab is hidden; pixel
 * density is capped (1.5 on small screens, 2 otherwise).
 */

export type Lane = {
  id: string;
  points: [number, number][]; // lon, lat
  color: string;
  width: number;
  arc: number; // altitude of the arc's middle (0 = on the surface)
};
export type Marker = { id: string; lon: number; lat: number; strong?: boolean };

export type Globe2 = {
  /** camera target: longitude/latitude facing the viewer, distance */
  view: { lon: number; lat: number; dist: number };
  offset: { x: number; y: number };
  /** distance multiplier for narrow screens */
  zoom: { k: number };
  lanes: Record<string, { progress: number; opacity: number }>;
  reveal: { v: number };
  project: (lon: number, lat: number) => { x: number; y: number; front: number };
  resize: () => void;
  setSpin: (on: boolean) => void;
  invalidate: () => void;
  dispose: () => void;
};

const D2R = Math.PI / 180;

/** unit vector for lon/lat in the sphere's own space (Three's SphereGeometry UVs) */
function vec(lon: number, lat: number, r = 1) {
  const phi = (lon / 360 + 0.5) * Math.PI * 2;
  const theta = (90 - lat) * D2R;
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta) * r,
    Math.cos(theta) * r,
    Math.sin(phi) * Math.sin(theta) * r,
  );
}

/** points along the lane, densified on the sphere, lifted into an arc */
function lanePath(l: Lane) {
  const pts: THREE.Vector3[] = [];
  const raw = l.points.map(([lo, la]) => vec(lo, la));
  // total angular length for the arc profile
  let total = 0;
  for (let i = 1; i < raw.length; i++) total += raw[i - 1].angleTo(raw[i]);
  let run = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1], b = raw[i];
    const ang = a.angleTo(b);
    const n = Math.max(2, Math.ceil(ang / (1.2 * D2R)));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const v = a.clone().lerp(b, t).normalize();
      const s = (run + ang * t) / total;
      const lift = 1.006 + l.arc * Math.sin(Math.PI * s);
      pts.push(v.multiplyScalar(lift));
    }
    run += ang;
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.2);
}

const EARTH_VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const EARTH_FS = /* glsl */ `
uniform sampler2D uLand;
uniform vec3 uSun;
uniform vec3 uCam;
uniform vec2 uTexel;
uniform float uReveal;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;

float line(float v, float width) {
  float w = max(fwidth(v) * width, 1e-4);
  return 1.0 - smoothstep(0.0, w, abs(fract(v - 0.5) - 0.5));
}

void main() {
  vec3 t = texture2D(uLand, vUv).rgb;
  float land = smoothstep(0.35, 0.65, t.r);
  float coast = t.b;
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  vec3 L = normalize(uSun);
  float ndl = dot(N, L);
  float day = smoothstep(-0.25, 0.55, ndl);

  // height field → hill shading (east/west and north/south slopes)
  float hx = texture2D(uLand, vUv + vec2(uTexel.x * 1.5, 0.0)).g - texture2D(uLand, vUv - vec2(uTexel.x * 1.5, 0.0)).g;
  float hy = texture2D(uLand, vUv + vec2(0.0, uTexel.y * 1.5)).g - texture2D(uLand, vUv - vec2(0.0, uTexel.y * 1.5)).g;
  float hill = clamp(0.74 + (-hx * 0.9 + hy * 0.7) * 5.0, 0.35, 1.18);

  float lat = (vUv.y - 0.5) * 180.0;
  float lon = (vUv.x - 0.5) * 360.0;

  // ocean: deep charcoal, lighter towards the lit limb, contour lines near coasts
  vec3 ocean = mix(vec3(0.035, 0.038, 0.047), vec3(0.085, 0.09, 0.105), day);
  float contours = line(coast * 7.0, 1.1) * step(0.03, coast) * (1.0 - land);
  ocean += vec3(0.80, 0.72, 0.56) * contours * (0.10 + 0.22 * day);
  vec3 R = reflect(-L, N);
  float glint = pow(max(dot(R, V), 0.0), 80.0) * 0.35 + pow(max(dot(R, V), 0.0), 8.0) * 0.04;
  ocean += vec3(0.95, 0.88, 0.75) * glint * (1.0 - land);

  // land: ivory stone, hill-shaded; engraved hatching appears in the shade
  vec3 ivory = vec3(0.86, 0.83, 0.77);
  float lightL = day * hill;
  vec3 ground = mix(vec3(0.12, 0.12, 0.13), ivory, smoothstep(0.0, 1.0, lightL));
  float hatch = line(lat * 2.4, 0.9) * (1.0 - smoothstep(0.35, 0.9, lightL));
  ground = mix(ground, ground * 0.55, hatch * 0.85);

  vec3 col = mix(ocean, ground, land);

  // coastline: crisp champagne hairline
  float cw = max(fwidth(t.r) * 1.2, 1e-3);
  float cl = 1.0 - smoothstep(0.0, cw, abs(t.r - 0.5));
  col = mix(col, vec3(0.86, 0.76, 0.55), cl * (0.55 + 0.35 * day));

  // graticule every 30°
  float g = max(line(lat / 30.0, 1.0), line(lon / 30.0, 1.0)) * 0.08;
  col += vec3(0.8, 0.72, 0.56) * g * (1.0 - land * 0.6);

  // limb darkening, then the reveal
  float limb = pow(max(dot(N, V), 0.0), 0.35);
  col *= mix(0.55, 1.0, limb);
  gl_FragColor = vec4(col * uReveal, 1.0);
}`;

const ATMO_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ATMO_FS = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uReveal;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float f = 1.0 - max(dot(N, V), 0.0);
  float rim = pow(f, 4.0);
  float sunSide = 0.35 + 0.65 * smoothstep(-0.4, 0.8, dot(N, normalize(uSun)));
  vec3 c = vec3(0.92, 0.86, 0.74);
  gl_FragColor = vec4(c, rim * 0.55 * sunSide * uReveal);
}`;

const LANE_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LANE_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
void main() {
  if (vUv.x > uProgress) discard;
  // a soft highlight travels along the drawn part; brightest at the head
  float head = smoothstep(uProgress - 0.12, uProgress, vUv.x) * step(uProgress, 0.999);
  float run = smoothstep(0.0, 0.08, 1.0 - abs(fract(vUv.x * 2.0 - uTime * 0.12) - 0.5) * 2.0);
  vec3 c = uColor * (0.85 + 0.25 * run) + vec3(1.0) * head * 0.35;
  gl_FragColor = vec4(c, uOpacity);
}`;

export function createGlobe2(
  canvas: HTMLCanvasElement,
  opts: { lanes: Lane[]; markers: Marker[]; small: boolean; still: boolean },
): Globe2 {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);

  const holder = new THREE.Group(); // screen offset
  const earth = new THREE.Group(); // rotation
  holder.add(earth);
  scene.add(holder);

  const tex = new THREE.TextureLoader().load(
    opts.small ? "/textures/earth-land-2048.webp" : "/textures/earth-land-4096.webp",
    () => invalidate(),
  );
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const texel = opts.small ? 1 / 2048 : 1 / 4096;

  const sun = new THREE.Vector3(-0.55, 0.55, 0.62).normalize();
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VS,
    fragmentShader: EARTH_FS,
    uniforms: {
      uLand: { value: tex },
      uSun: { value: sun },
      uCam: { value: camera.position },
      uTexel: { value: new THREE.Vector2(texel, texel * 2) },
      uReveal: { value: 0 },
    },
  });
  const seg = opts.small ? 96 : 160;
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg / 2), earthMat));

  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VS,
    fragmentShader: ATMO_FS,
    uniforms: { uCam: { value: camera.position }, uSun: { value: sun }, uReveal: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  holder.add(new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 48), atmoMat));

  // lanes
  const laneState: Record<string, { progress: number; opacity: number }> = {};
  const laneMats: THREE.ShaderMaterial[] = [];
  for (const l of opts.lanes) {
    const curve = lanePath(l);
    const geo = new THREE.TubeGeometry(curve, opts.small ? 220 : 420, l.width, 8, false);
    const mat = new THREE.ShaderMaterial({
      vertexShader: LANE_VS,
      fragmentShader: LANE_FS,
      uniforms: {
        uColor: { value: new THREE.Color(l.color) },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    laneMats.push(mat);
    earth.add(new THREE.Mesh(geo, mat));
    laneState[l.id] = { progress: 0, opacity: 1 };
  }
  // markers: small discs flush with the surface
  for (const m of opts.markers) {
    const p = vec(m.lon, m.lat, 1.004);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(m.strong ? 0.016 : 0.009, 24),
      new THREE.MeshBasicMaterial({ color: m.strong ? 0xc90216 : 0xf2ede2 }),
    );
    disc.position.copy(p);
    disc.lookAt(p.clone().multiplyScalar(2));
    earth.add(disc);
    if (m.strong) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.033, 48),
        new THREE.MeshBasicMaterial({ color: 0xc90216, transparent: true, opacity: 0.8 }),
      );
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2));
      earth.add(ring);
    }
  }

  const view = { lon: 100, lat: 25, dist: 4.2 };
  const offset = { x: 0, y: 0 };
  const zoom = { k: 1 };
  const reveal = { v: 0 };
  let spin = !opts.still;
  let dirty = true;
  let w = 1, h = 1;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.small ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  resize();

  const apply = () => {
    earth.rotation.order = "XYZ";
    const phi = (view.lon / 360 + 0.5) * Math.PI * 2;
    const az = Math.atan2(-Math.cos(phi), Math.sin(phi));
    earth.rotation.set(view.lat * D2R, -az, 0);
    holder.position.set(offset.x, offset.y, 0);
    camera.position.z = view.dist * zoom.k;
    earthMat.uniforms.uReveal.value = reveal.v;
    atmoMat.uniforms.uReveal.value = reveal.v;
    opts.lanes.forEach((l, i) => {
      laneMats[i].uniforms.uProgress.value = laneState[l.id].progress;
      laneMats[i].uniforms.uOpacity.value = laneState[l.id].opacity * reveal.v;
    });
  };

  // render loop: only while visible
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  });
  io.observe(canvas);
  const onVis = () => {
    if (!document.hidden && visible) loop();
  };
  document.addEventListener("visibilitychange", onVis);

  const tmp = new THREE.Vector3();
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function frame(now: number) {
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (spin) {
      view.lon -= dt * 2.2;
      dirty = true;
    }
    const time = now / 1000;
    laneMats.forEach((m) => (m.uniforms.uTime.value = time));
    apply();
    renderer.render(scene, camera);
    dirty = false;
    raf = requestAnimationFrame(frame);
  }
  loop();

  function invalidate() {
    dirty = true;
  }

  const project = (lon: number, lat: number) => {
    tmp.copy(vec(lon, lat, 1.01));
    earth.localToWorld(tmp);
    const n = tmp.clone().sub(holder.position).normalize();
    const toCam = camera.position.clone().sub(tmp).normalize();
    const front = n.dot(toCam);
    tmp.project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, front };
  };

  return {
    view,
    offset,
    zoom,
    lanes: laneState,
    reveal,
    project,
    resize,
    setSpin: (on) => {
      spin = on && !opts.still;
    },
    invalidate,
    dispose: () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose();
      });
      tex.dispose();
      renderer.dispose();
      void dirty;
    },
  };
}
