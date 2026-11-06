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
uniform float uEnv;
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

  // uEnv: 0 = the dark-world globe, 1 = smoked graphite / silver for daylight
  vec3 ocean = mix(vec3(0.016, 0.017, 0.019), vec3(0.072, 0.076, 0.085), uEnv);
  vec3 landLo = mix(vec3(0.085, 0.087, 0.095), vec3(0.22, 0.226, 0.24), uEnv);
  vec3 landHi = mix(vec3(0.165, 0.168, 0.18), vec3(0.44, 0.449, 0.472), uEnv);
  vec3 base = mix(ocean, mix(landLo, landHi, smoothstep(0.5, 1.0, h)), land);

  vec3 col = base * (mix(0.03, 0.07, uEnv) + 1.05 * diff);
  // daylight bounce: the shadow side becomes smoked graphite, never a black hole
  col += vec3(0.135, 0.14, 0.152) * uEnv * (1.0 - diff) * (0.75 + 0.25 * land);

  float lit = smoothstep(-0.05, 0.25, dot(N, L));
  float specO = pow(max(dot(N, H), 0.0), 260.0) * (1.0 - land) * 0.25;
  float specL = pow(max(dot(Np, H), 0.0), 24.0) * land * 0.056;
  col += vec3(0.80, 0.81, 0.84) * (specO * (1.0 + 1.4 * uEnv) + specL * (1.0 + 2.2 * uEnv)) * lit;

  col += vec3(0.55, 0.56, 0.6) * coast * 0.11 * (0.2 + diff);

  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  // metallic edge: bright on the lit side, falling away into shadow (dimensional on light grounds)
  float rimSide = smoothstep(-0.35, 0.7, dot(N, L));
  col += vec3(0.52, 0.53, 0.57) * fr * (mix(0.056, 0.02, uEnv) + mix(0.62, 0.78, uEnv) * rimSide);

  // 15° graticule — barely there, a sense of measurement rather than a HUD
  vec2 g = vec2(vUv.x * 24.0, vUv.y * 12.0);
  vec2 gw = fwidth(g);
  vec2 gl = abs(fract(g - 0.5) - 0.5) / max(gw, vec2(1e-4));
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  col += vec3(0.62) * line * uGrat * (0.15 + diff);

  // revealed by opacity (not from black), so it emerges cleanly on any ground
  gl_FragColor = vec4(col, uReveal);
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
uniform float uEnv;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 V = normalize(uCam - vP);
  float rim = 1.0 - abs(dot(normalize(vN), V));
  // visible annulus spans rim ≈ 0.71 (globe edge) → 1.0 (halo edge)
  float a = pow(clamp((1.0 - rim) / 0.29, 0.0, 1.0), 2.4);
  float side = 0.35 + 0.65 * smoothstep(-0.6, 0.8, dot(normalize(vN), normalize(uLight)));
  // dark grounds: a silver atmosphere; daylight: a soft contact shadow on the side away from the light
  // a quieter atmosphere: present, never a glow ring
  float glow = a * side * 0.22;
  float shade = a * (1.0 - side) * 0.4;
  vec3 c = mix(vec3(0.62, 0.63, 0.67), vec3(0.16, 0.165, 0.18), uEnv);
  gl_FragColor = vec4(c, mix(glow, shade, uEnv) * uReveal);
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
  /** 0 = dark world, 1 = daylight (opening) */
  env: number;
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

  const tmp = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
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
    uEnv: { value: 0 },
  };

  const sphereGeo = new THREE.SphereGeometry(1, opts.hiRes ? 160 : 96, opts.hiRes ? 120 : 72);
  const globeMat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true });
  const globe = new THREE.Mesh(sphereGeo, globeMat);
  spin.add(globe);

  const haloGeo = new THREE.SphereGeometry(1.045, 64, 48);
  const haloMat = new THREE.ShaderMaterial({
    vertexShader: haloVert,
    fragmentShader: haloFrag,
    uniforms: { uCam: uniforms.uCam, uLight: uniforms.uLight, uReveal: uniforms.uReveal, uEnv: uniforms.uEnv },
    side: THREE.BackSide,
    blending: THREE.NormalBlending,
    transparent: true,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.renderOrder = -1; // behind the (transparent) globe body
  scene.add(halo);

  // --- Ports: small lights at real trade hubs (Cologne in Luna red) ------
  const PORTS: [number, number, number][] = [
    [121.5, 31.2, 0], [114.1, 22.5, 0], [121.6, 29.9, 0], [120.4, 36.1, 0], [113.3, 23.1, 0], [118.1, 24.5, 0],
    [117.7, 39.0, 0], [129.0, 35.1, 0], [103.8, 1.3, 0], [55.0, 25.0, 0], [32.5, 30.0, 0], [23.6, 37.9, 0],
    [4.4, 51.9, 0], [9.9, 53.5, 0], [4.4, 51.2, 0], [8.6, 53.5, 0], [6.8, 51.4, 0], [6.96, 50.94, 1],
    [-74.0, 40.7, 0], [-118.3, 33.7, 0], [72.9, 19.0, 0], [139.8, 35.6, 0],
  ];
  const portGeo = new THREE.BufferGeometry();
  const portPos = new Float32Array(PORTS.length * 3);
  const portKind = new Float32Array(PORTS.length);
  const portPhase = new Float32Array(PORTS.length);
  PORTS.forEach(([lon, lat, k], i) => {
    const v = lonLatToVec3(lon, lat, 1.006, tmpV);
    portPos.set([v.x, v.y, v.z], i * 3);
    portKind[i] = k;
    portPhase[i] = (i * 0.37) % 1;
  });
  portGeo.setAttribute("position", new THREE.BufferAttribute(portPos, 3));
  portGeo.setAttribute("aKind", new THREE.BufferAttribute(portKind, 1));
  portGeo.setAttribute("aPhase", new THREE.BufferAttribute(portPhase, 1));
  const portUniforms = { uTime: { value: 0 }, uReveal: uniforms.uReveal, uCam: uniforms.uCam, uScale: { value: 1 } };
  const portMat = new THREE.ShaderMaterial({
    uniforms: portUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
attribute float aKind;
attribute float aPhase;
uniform float uTime;
uniform float uScale;
uniform vec3 uCam;
varying float vKind;
varying float vA;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  // only the side facing the camera, fading at the limb
  float facing = dot(normalize(w.xyz), normalize(uCam - w.xyz));
  vA = smoothstep(0.05, 0.35, facing);
  vKind = aKind;
  float pulse = 0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 6.2831);
  gl_PointSize = uScale * (aKind > 0.5 ? 11.0 : 6.5 + 2.5 * pulse);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
uniform float uReveal;
varying float vKind;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.18, d);
  vec3 col = vKind > 0.5 ? vec3(0.86, 0.04, 0.1) : vec3(0.93, 0.94, 0.96);
  gl_FragColor = vec4(col, core * vA * uReveal * (vKind > 0.5 ? 1.0 : 0.85));
}`,
  });
  const ports = new THREE.Points(portGeo, portMat);
  ports.frustumCulled = false;
  spin.add(ports);

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
    portUniforms.uScale.value = dpr * (w < 768 ? 0.85 : 1);
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
    uniforms.uEnv.value = f.env;
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

    portUniforms.uTime.value = performance.now() / 1000;
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
    portGeo.dispose();
    portMat.dispose();
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
