import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { buildRoute, lonLatToVec3 } from "./geo";

/**
 * The Luna Earth — a sculptural graphite globe.
 *  - land relief is embossed from a pre-baked height channel (no political borders: trade without borders)
 *  - oceans are near-black with a narrow metallic specular
 *  - lighting is fixed to the camera (studio light), so the terminator stays composed while the globe turns
 */

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D uLand;
uniform vec3 uLight;
uniform vec3 uCam;
uniform vec3 uNorth;
uniform vec2 uTexel;
uniform float uReveal;
uniform float uGrat;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;

float hgt(vec2 uv) { return texture2D(uLand, uv).g; }

void main() {
  vec3 tex = texture2D(uLand, vUv).rgb;
  float land = tex.r;
  float h = tex.g;
  float coast = tex.b;

  vec3 N = normalize(vN);
  vec3 E = normalize(cross(uNorth, N) + 1e-5);
  vec3 Nn = normalize(cross(N, E));
  float hx = hgt(vUv + vec2(uTexel.x * 2.0, 0.0)) - hgt(vUv - vec2(uTexel.x * 2.0, 0.0));
  float hy = hgt(vUv + vec2(0.0, uTexel.y * 2.0)) - hgt(vUv - vec2(0.0, uTexel.y * 2.0));
  vec3 Np = normalize(N - (E * hx + Nn * hy) * 2.6);

  vec3 L = normalize(uLight);
  vec3 V = normalize(uCam - vP);
  vec3 H = normalize(L + V);
  float ndl = dot(Np, L);
  float diff = smoothstep(-0.18, 1.0, ndl);

  vec3 ocean = vec3(0.016, 0.017, 0.019);
  vec3 landLo = vec3(0.085, 0.087, 0.095);
  vec3 landHi = vec3(0.165, 0.168, 0.18);
  vec3 base = mix(ocean, mix(landLo, landHi, smoothstep(0.5, 1.0, h)), land);

  vec3 col = base * (0.03 + 1.05 * diff);

  float lit = smoothstep(-0.05, 0.25, dot(N, L));
  float specO = pow(max(dot(N, H), 0.0), 260.0) * (1.0 - land) * 0.22;
  float specL = pow(max(dot(Np, H), 0.0), 24.0) * land * 0.05;
  col += vec3(0.80, 0.81, 0.84) * (specO + specL) * lit;

  col += vec3(0.55, 0.56, 0.6) * coast * 0.11 * (0.2 + diff);

  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  col += vec3(0.52, 0.53, 0.57) * fr * (0.05 + 0.55 * smoothstep(-0.35, 0.7, dot(N, L)));

  // 15° graticule — barely there, a sense of measurement rather than a HUD
  vec2 g = vec2(vUv.x * 24.0, vUv.y * 12.0);
  vec2 gw = fwidth(g);
  vec2 gl = abs(fract(g - 0.5) - 0.5) / max(gw, vec2(1e-4));
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  col += vec3(0.62) * line * uGrat * (0.15 + diff);

  gl_FragColor = vec4(col * uReveal, 1.0);
}`;

const haloVert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const haloFrag = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uLight;
uniform float uReveal;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 V = normalize(uCam - vP);
  float rim = 1.0 - abs(dot(normalize(vN), V));
  // visible annulus spans rim ≈ 0.71 (globe edge) → 1.0 (halo edge)
  float a = pow(clamp((1.0 - rim) / 0.29, 0.0, 1.0), 2.4);
  float side = 0.35 + 0.65 * smoothstep(-0.6, 0.8, dot(normalize(vN), normalize(uLight)));
  gl_FragColor = vec4(vec3(0.62, 0.63, 0.67) * a * side * 0.42 * uReveal, 1.0);
}`;

export type GlobeFrame = {
  lon: number;
  lat: number;
  dist: number;
  /** viewport-relative offsets of the globe centre (fractions of width / height) */
  ox: number;
  oy: number;
  reveal: number;
  route: number;
};

export type GlobeHandle = {
  ready: Promise<void>;
  setSize: (w: number, h: number, dpr: number) => void;
  render: (f: GlobeFrame) => void;
  /** project lon/lat → css px; `front` = facing the camera */
  project: (lon: number, lat: number) => { x: number; y: number; front: boolean };
  routeHead: () => { lon: number; lat: number };
  dispose: () => void;
};

export function createGlobe(canvas: HTMLCanvasElement, opts: { hiRes: boolean }): GlobeHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 50);
  camera.position.set(0, 0, 4);

  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);

  const uniforms = {
    uLand: { value: null as THREE.Texture | null },
    uLight: { value: new THREE.Vector3(-0.62, 0.42, 0.66) },
    uCam: { value: new THREE.Vector3() },
    uNorth: { value: new THREE.Vector3(0, 1, 0) },
    uTexel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) },
    uReveal: { value: 0 },
    uGrat: { value: 0.03 },
  };

  const sphereGeo = new THREE.SphereGeometry(1, opts.hiRes ? 160 : 96, opts.hiRes ? 120 : 72);
  const globeMat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms });
  const globe = new THREE.Mesh(sphereGeo, globeMat);
  spin.add(globe);

  const haloGeo = new THREE.SphereGeometry(1.045, 64, 48);
  const haloMat = new THREE.ShaderMaterial({
    vertexShader: haloVert,
    fragmentShader: haloFrag,
    uniforms: { uCam: uniforms.uCam, uLight: uniforms.uLight, uReveal: uniforms.uReveal },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(haloGeo, haloMat));

  // --- Route ---------------------------------------------------------------
  const route = buildRoute(1.0035);
  const routeGeo = new LineGeometry();
  routeGeo.setPositions(route.pts.flatMap((p) => [p.x, p.y, p.z]));
  const routeMat = new LineMaterial({ color: 0xc90216, linewidth: 2, worldUnits: false });
  const routeLine = new Line2(routeGeo, routeMat);
  routeLine.computeLineDistances();
  routeLine.frustumCulled = false;
  spin.add(routeLine);
  const segCount = route.pts.length - 1;
  let headIndex = 0;
  let headFrac = 0;

  // --- Texture -------------------------------------------------------------
  const ready = new Promise<void>((resolve) => {
    const src = opts.hiRes ? "/textures/earth-land-4096.webp" : "/textures/earth-land-2048.webp";
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.wrapS = THREE.RepeatWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        uniforms.uLand.value = tex;
        const img = tex.image as { width: number; height: number };
        uniforms.uTexel.value.set(1 / img.width, 1 / img.height);
        resolve();
      },
      undefined,
      () => resolve()
    );
  });

  let W = 1;
  let H = 1;
  const tmp = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  function setSize(w: number, h: number, dpr: number) {
    W = w;
    H = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    routeMat.resolution.set(w * dpr, h * dpr);
    routeMat.linewidth = w < 768 ? 1.6 : 2;
  }

  function render(f: GlobeFrame) {
    const D = Math.PI / 180;
    spin.rotation.y = 0;
    // rotate so (lon, lat) faces +z: first around Y, then tilt around X
    const p = lonLatToVec3(f.lon, 0, 1, tmp);
    const az = Math.atan2(p.x, p.z);
    spin.rotation.y = -az;
    tilt.rotation.x = f.lat * D;

    camera.position.set(0, 0, f.dist);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, -f.ox * W, -f.oy * H, W, H);
    camera.updateMatrixWorld();
    uniforms.uCam.value.copy(camera.position);
    uniforms.uReveal.value = f.reveal;
    uniforms.uNorth.value.set(0, 1, 0).applyQuaternion(tilt.quaternion);

    // route progress (instanced segments)
    const r = Math.max(0, Math.min(1, f.route));
    let i = 0;
    while (i < route.cum.length - 1 && route.cum[i + 1] < r) i++;
    headIndex = i;
    const span = route.cum[i + 1] - route.cum[i] || 1;
    headFrac = Math.max(0, Math.min(1, (r - route.cum[i]) / span));
    (routeGeo as unknown as THREE.InstancedBufferGeometry).instanceCount = r <= 0 ? 0 : Math.min(segCount, i + 1);
    routeLine.visible = r > 0;

    renderer.render(scene, camera);
  }

  function project(lon: number, lat: number) {
    lonLatToVec3(lon, lat, 1.004, tmp);
    tmp.applyMatrix4(spin.matrixWorld);
    tmpN.copy(tmp).normalize();
    camDir.copy(camera.position).sub(tmp).normalize();
    const front = tmpN.dot(camDir) > 0.06;
    tmp.project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H, front };
  }

  function routeHead() {
    const a = route.ll[headIndex];
    const b = route.ll[Math.min(headIndex + 1, route.ll.length - 1)];
    return { lon: a.lon + (b.lon - a.lon) * headFrac, lat: a.lat + (b.lat - a.lat) * headFrac };
  }

  function dispose() {
    sphereGeo.dispose();
    globeMat.dispose();
    haloGeo.dispose();
    haloMat.dispose();
    routeGeo.dispose();
    routeMat.dispose();
    uniforms.uLand.value?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { ready, setSize, render, project, routeHead, dispose };
}
