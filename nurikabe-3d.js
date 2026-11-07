// Dujiang in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline), after a Song hydraulic landscape
// (Korbi, 4 November 2026): the board is a polder, a plot a cell. The sea the player shades is a canal cut into it, its water
// flowing along the channels (a current and caustics, drawn by the water's own shader from a flow map), and an island is a raised
// plot on its levee: bare soil while it is only a promise, a flooded paddy or a field of millet once its number is whole. A number
// is carved on a stone marker (a plate of the page over its block, which stands a little higher). A dot, the player's note that
// a cell is island, is a small ink stone. Where channels meet the edge or turn there are the works (nurikabe-works.js decides
// where from the sea alone): a weir at the intake, a sluice at the outlet, pound locks, sluices, arch bridges, norias, and once
// the sea is the answer the network fills, the gates lift and grain barges ride from the intake to the outlet. The scenery
// (nurikabe-scene.js) is ink-wash mountains in mist, willows, a pavilion and, by night, lanterns and the moon on the water.
// Same game as the flat board: a tap calls the page's press(cell, "tap") (it cycles clear, sea, dot) and a right click
// press(cell, "dot"); a drag turns the board, two fingers (or the wheel, or + and −) zoom in and move it, two taps on the bare card
// turn it back. The page calls set(puzzle) for a new puzzle and update(look) after a change. A block sinks or rises over a moment.
// Frames are drawn only while something moves or a finger is down; the current runs at a low rate for a while after a touch
// or a solve, then the picture rests (and not at all under reduced motion), so a board at rest costs nothing.
// Throws where there is no WebGL (the page then keeps the flat board).
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { SEA, LAND } from "./nurikabe-engine.js";
import { works, plotsOf, outward } from "./nurikabe-works.js";
import { createScenery, paintBackdrop } from "./nurikabe-scene.js";
import { scale } from "./wide.js";

const DEG = Math.PI / 180;
export const MIN_EL = 32 * DEG, MAX_EL = 84 * DEG, FOV = 30 * DEG;
const HOME_AZ = 0;                               // the first view: the top of the flat board is the far side
const MAX_ZOOM = 3;                              // how far in: the board's fit is 1
const SLIP = 9;                                  // px a finger may stray and still tap
const BUSY_MS = 1000 / 30, FLOW_MS = 1000 / 12, BUSY_FOR = 900;   // the time between frames (moving, flowing), and how long a touch keeps the drawing going
const FLOW_FOR = 20000, FEAST_FOR = 40000;       // how long the current runs after a touch, and after a solve (barges ride)
export const LAND_H = 0.7, CLUE_H = 0.8, BED_H = 0.12, WATER_H = 0.36, WATER_FULL = 0.52, CAP = 0.12, GAP = 0.03;   // heights, in cells; the gap between two blocks
const SINK = 0.055;                              // seconds, the time constant of a block sinking or rising
const LOOK_Y = 0.25;                             // what the camera looks at, over the board's middle
const FILL_MS = 120;                             // a solved network fills this long per cell of distance from the intake

// A Song palette: celadon water, rice-paper and ink, vermilion only for accents (gates, lanterns, the pavilion), oxblood for an error.
const SKINS = {
  day: {
    night: false, soil: 0xd6c28e, levee: 0x9a7b55, stone: 0xd6d1c1, water: 0x3d8e87, bed: 0x6d8b83, paddy: 0x7fa55a, millet: 0xd0a93f, sheen: 0xa5d0c6, ink: 0x23262a,
    vermilion: 0xc8452d, bad: 0xa8382b, good: 0x2f9a6b, gilt: 0xc8923a, base: 0xbdb7a6, wood: 0x6b5240, straw: 0xd8c27a,
    willow: 0x9db26a, willow2: 0xb0c27c, trunk: 0x4b4237, roof: 0x4a5058, mound: 0x8a9a68, hemi: 1.05, sky: 0xfff6e2, ground: 0xb9b3a0, key: 0xfff0d2, keyI: 2.3, exposure: 1,
    skyTop: 0xe4e6da, skyLow: 0xd9dfd3, paper: 0xefe8d4, far: 0xb4c0ba, mid: 0x8fa19d, near: 0x6a7f7c, mist: 0xe8eadc, moon: 0xe9ebd8, glint: 0.25,
  },
  night: {
    night: true, soil: 0x8f8160, levee: 0x5b4a38, stone: 0x9fa196, water: 0x2f8688, bed: 0x3e5a5a, paddy: 0x5e9050, millet: 0xb38f36, sheen: 0x6fa9a2, ink: 0xe8e4d4,
    vermilion: 0xe0583a, bad: 0xe8806f, good: 0x4fbf94, gilt: 0xe2b865, base: 0x6e6a5e, wood: 0x4a3a2e, straw: 0xa89256,
    willow: 0x6e8a56, willow2: 0x7a965f, trunk: 0x30291f, roof: 0x23282e, mound: 0x4c5b3f, hemi: 0.95, sky: 0x8fa6c8, ground: 0x1a2a30, key: 0xbfd0f0, keyI: 1.6, exposure: 1.1,
    skyTop: 0x0f1a24, skyLow: 0x1a2a33, paper: 0x1c2b30, far: 0x2a3d49, mid: 0x203139, near: 0x17252c, mist: 0x2b3c45, moon: 0xe9ebd8, glint: 0.2,
  },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return SKINS[night ? "night" : "day"];
}

// ---------- pure parts (tested in Node) ----------
/** A cell's middle on the ground, the board centred on the origin: row 0 is the far side. */
export const cellXZ = (N, x) => [(x % N) - (N - 1) / 2, Math.floor(x / N) - (N - 1) / 2];
/** The camera's vectors for a turn and a tilt: toward the camera, to its right and up. */
export function basis(az, el) {
  const ce = Math.cos(el), se = Math.sin(el);
  return { c: [Math.sin(az) * ce, se, Math.cos(az) * ce], r: [Math.cos(az), 0, -Math.sin(az)], u: [-se * Math.sin(az), ce, -se * Math.cos(az)] };
}
/** How far the camera must stand, looking at the middle of the board, for the whole of it (and a pad of pixels round) to be in view. */
export function fitDistance(N, az, el, tx, ty, padX, padY) {
  const { c, r, u } = basis(az, el), h = N / 2 + 0.2, top = CLUE_H + 0.15;
  let d = 4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.15, top]) {
    const p = [sx * h, y - LOOK_Y, sz * h];
    const along = p[0] * c[0] + p[1] * c[1] + p[2] * c[2], across = p[0] * r[0] + p[1] * r[1] + p[2] * r[2], up = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    d = Math.max(d, along + Math.abs(across) / (tx * (1 - padX)), along + Math.abs(up) / (ty * (1 - padY)));
  }
  return d;
}
/** The first view's tilt: a tall card is seen steeper from above, a wide one flatter. */
export const homeElevation = aspect => Math.max(46, Math.min(66, 38 + 24 * aspect)) * DEG;
/** The cell a ray from `o` along `d` first meets, given each cell's block height, or -1. */
export function cellHit(N, heights, o, d) {
  let best = -1, near = Infinity;
  const half = 0.5 - GAP / 2;
  for (let x = 0; x < N * N; x++) {
    const [cx, cz] = cellXZ(N, x), lo = [cx - half, 0, cz - half], hi = [cx + half, heights[x], cz + half];
    let t0 = 0, t1 = Infinity;
    for (let a = 0; a < 3 && t0 <= t1; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) t1 = -1; continue; }
      let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t0 <= t1 && t0 < near) { near = t0; best = x; }
  }
  return best;
}

// The water's own shader, added to a standard material: caustics and drifting streaks along the current (read, smoothed, from the flow
// map: red and green the direction, blue how much the place belongs to the flowing network), and the moon's (or sun's) glitter. The
// surface is one flat sheet, and everything is drawn from the world's x and z alone, so it looks the same from any side.
const WATER_FRAG_FUNCS = `
varying vec3 vW;
uniform sampler2D uFlow; uniform float uN, uTime, uLight; uniform vec3 uMoon; uniform float uMoonI;
float caus(vec2 p, float t) {
  vec2 i = p; float c = 1.0; float inten = 0.012;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 3.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
void main() {`;
function waterShader(mat, U) {
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = "varying vec3 vW;\n" + shader.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
      vec4 wpos = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wpos = instanceMatrix * wpos;
      #endif
      vW = (modelMatrix * wpos).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", WATER_FRAG_FUNCS)
      .replace("#include <color_fragment>", `#include <color_fragment>
      vec2 bc = vW.xz + uN * 0.5;
      vec4 fl = texture2D(uFlow, clamp(bc, vec2(0.0), vec2(uN)) / uN);       // bilinear: the current bends smoothly over the cell borders, so no seam shows
      vec2 dir = fl.rg * 2.0 - 1.0; float wet = fl.b; float spd = length(dir);
      vec2 dn = spd > 0.05 ? dir / spd : vec2(0.0, 1.0);
      float ca = caus(vW.xz * 2.4 - dir * uTime * 0.55 * wet, uTime * 0.3 * (0.3 + wet));
      ca = isnan(ca) ? 0.0 : clamp(ca, 0.0, 1.0);
      float aa = dot(vW.xz, dn) - uTime * 0.5 * wet * max(spd, 0.25);
      float bb = dot(vW.xz, vec2(-dn.y, dn.x));
      float st = pow(0.5 + 0.5 * sin(aa * 7.0 + 2.0 * sin(bb * 5.0)), 12.0);
      diffuseColor.rgb += (ca * 0.12 + st * 0.06 * wet) * uLight * vec3(0.75, 1.0, 0.95);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      vec2 dm = vW.xz - uMoon.xy;
      float mg = exp(-dot(dm, dm) / uMoon.z) * pow(0.5 + 0.5 * sin(vW.x * 14.0 + uTime * 1.3 + 3.0 * sin(vW.z * 11.0 - uTime)), 8.0);
      totalEmissiveRadiance += mg * uMoonI * vec3(0.9, 0.95, 1.0);`);
  };
  mat.customProgramCacheKey = () => "nk-water";
}

/**
 * The model in `host`. `opts`: press(cell, "tap" | "dot") for a finger on a cell, playable() whether a finger may mark now.
 * Calls: set({ N, clue }) for a new puzzle; update({ marks, pool, cut, over, done, lit, why, solved }) after any change (sets of
 * cells; a number's cell is in `done` when its island is whole); show(on); hold(on) while a menu is open; celebrate() after a win.
 */
export function createModel(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "nk3-gl";
  const back = document.createElement("canvas");              // the painted mountains behind everything
  back.className = "nk3-back";
  const labels = document.createElement("div");
  labels.className = "nk3-labels";
  host.replaceChildren(back, canvas, labels);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Bridges' is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  const box = new THREE.BoxGeometry(1, 1, 1), stone = new THREE.CylinderGeometry(0.5, 0.5, 1, 14), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cylOpen = new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1, true);
  const cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  const solid = (extra = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const U = { uFlow: { value: null }, uN: { value: 8 }, uTime: { value: 0 }, uLight: { value: 1 }, uMoon: { value: new THREE.Vector3() }, uMoonI: { value: 0 } };
  const M = {
    earth: solid(), turf: solid(), base: solid(),
    water: solid({ roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.88, depthWrite: false, vertexColors: true }),
    stone: solid({ roughness: 0.6 }),
    rows: solid(), sheen: solid({ roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.6, depthWrite: false }),
    halo: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
    wood: solid({ roughness: 0.8 }), pstone: solid(), vermil: solid(), straw: solid(), foam: solid({ roughness: 0.4, transparent: true, opacity: 0.8, depthWrite: false }),
  };
  waterShader(M.water, U);
  let scenic = null;                         // built for each board size in set()

  // ---------- the world: instanced meshes a cell each (earth below, turf over it, water over the bed, a stone for a dot, crop rows, a paddy's sheen) and a halo for a hint ----------
  let N = 0, clue = [], bridge = [], rules = null, plates = [], earth, turf, water, dots, halos, rows, sheen, baseMesh, rim, flowTex = null, flowCtx = null;
  let cur = [], tgt = [], wcur = [], wtgt = [], jitter = [], look = null, waveAt = 0, spinUntil = 0, plan = null, planKey = "", owner = null, fillAt = 0, lift = 0;
  const MA = new THREE.Matrix4(), Q = new THREE.Quaternion(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), C = new THREE.Color(), C2 = new THREE.Color(), C3 = new THREE.Color();
  const mesh = (geo, mat, n, shadow) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.castShadow = shadow === "cast"; m.receiveShadow = shadow !== "none";
    m.instanceMatrix.setUsage?.(35048);
    scene.add(m);
    return m;
  };
  const props = new THREE.Group();
  scene.add(props);
  let gates = [], wheels = [], barges = [], bargeLen = 0, bargePts = [];
  function disposeWorld() {
    for (const m of [earth, turf, water, dots, halos, rows, sheen, baseMesh, rim]) if (m) { scene.remove(m); m.geometry === box || m.geometry === stone ? m.dispose?.() : (m.geometry.dispose(), m.dispose?.()); }
    earth = turf = water = dots = halos = rows = sheen = baseMesh = rim = null;
    props.clear(); gates = []; wheels = []; barges = []; planKey = "";
  }
  /** A fixed spread of a cell's green, from its place only: the same board looks the same on every phone. */
  const spread = x => { const s = Math.sin(x * 12.9898 + 4.1414) * 43758.5453; return (s - Math.floor(s)) - 0.5; };
  /** The water: one sheet over the whole board (two triangles a cell, so a cell can have its own colour, but the corners are shared heights: no step between cells). */
  function sheet(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 18), 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Float32Array.from({ length: n * 18 }, (_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 18).fill(1), 3));
    const m = new THREE.Mesh(g, M.water);
    m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1;
    scene.add(m);
    return m;
  }
  /** The sheet's height at a board corner (i, j): the mean of the water levels of the cells that meet there. */
  function cornerH(i, j) {
    let sum = 0, k = 0;
    for (let a = i - 1; a <= i; a++) for (let b = j - 1; b <= j; b++) if (a >= 0 && b >= 0 && a < N && b < N) { sum += wcur[b * N + a]; k++; }
    return sum / k;
  }
  function shapeSheet() {
    const P = water.geometry.attributes.position.array, o = -N / 2;
    let q = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const h00 = cornerH(c, r), h10 = cornerH(c + 1, r), h11 = cornerH(c + 1, r + 1), h01 = cornerH(c, r + 1);
      for (const [dx, dz, h] of [[0, 0, h00], [0, 1, h01], [1, 1, h11], [0, 0, h00], [1, 1, h11], [1, 0, h10]]) { P[q++] = o + c + dx; P[q++] = h; P[q++] = o + r + dz; }
    }
    water.geometry.attributes.position.needsUpdate = true;
  }
  /** The surface's height over a point of the board (for what floats on it). */
  const levelAt = (x, z) => wcur[Math.max(0, Math.min(N - 1, Math.floor(z + N / 2))) * N + Math.max(0, Math.min(N - 1, Math.floor(x + N / 2)))] ?? WATER_H;
  /** What a ray or a finger meets in a cell: the block, or the water over it where the cell is sea. */
  const topOf = x => (look && (look.marks[x] === SEA || bridge[x]) ? Math.max(cur[x], wcur[x]) : cur[x]);
  const isPaddy = number => number % 2 === 0;               // a plot is a flooded paddy or a millet field by its number's place, fixed
  /** A new puzzle ends the win's turning, and the camera is back at the base view, still (Korbi, 7 Nov 2026). */
  function set(puzzle) { spinUntil = 0; setPuzzle(puzzle); reset(); }
  function setPuzzle(puzzle) {
    disposeWorld();
    if (puzzle.N !== N || !scenic) { scenic?.dispose(); scenic = createScenery(scene, puzzle.N); }
    N = puzzle.N; clue = puzzle.stone || puzzle.clue;
    const n = N * N;
    bridge = puzzle.bridge || new Uint8Array(n); rules = puzzle.rules || null;       // (the rule's arch bridges: a deck over the canal, the cell island that the water runs under)
    earth = mesh(box, M.earth, n, "cast"); turf = mesh(box, M.turf, n, "cast"); water = sheet(n);
    rim = mesh(box, M.earth, 4 * N + 4, "cast");
    dots = mesh(stone, M.stone, n, "cast"); halos = mesh(box, M.halo, n, "none");
    rows = mesh(box, M.rows, n * 3, "cast"); sheen = mesh(box, M.sheen, n, "receive");
    baseMesh = mesh(box, M.base, 1, "cast");
    baseMesh.setMatrixAt(0, MA.compose(PV.set(0, -0.07, 0), Q.identity(), SV.set(N + 0.3, 0.14, N + 0.3)));
    baseMesh.setColorAt(0, C.set(skinNow().base));
    tgt = Array.from({ length: n }, (_, x) => (clue[x] ? CLUE_H : bridge[x] ? BED_H : LAND_H));
    cur = tgt.slice();
    wtgt = Array(n).fill(WATER_H); wcur = wtgt.slice();
    jitter = Array.from({ length: n }, (_, x) => spread(x));
    look = null; waveAt = 0; fillAt = 0; lift = 0; plan = null;
    flowTex?.dispose?.();
    const fc = document.createElement("canvas");
    fc.width = fc.height = N;
    flowCtx = fc.getContext("2d", { willReadFrequently: true });
    flowTex = new CanvasTexture(fc);
    flowTex.flipY = false; flowTex.generateMipmaps = false; flowTex.minFilter = flowTex.magFilter = 1003;
    U.uFlow.value = flowTex; U.uN.value = N;
    labels.replaceChildren();
    plates = [];
    for (let x = 0; x < n; x++) {
      if (!clue[x]) continue;
      const node = document.createElement("div");
      node.className = "nk3-n";
      node.textContent = puzzle.labels?.[x] ?? clue[x];
      labels.appendChild(node);
      const [cx, cz] = cellXZ(N, x);
      plates.push({ x, el: node, p: new THREE.Vector3(cx, CLUE_H + 0.02, cz), w: 0, h: 0 });
    }
    measure = true; zoom = 1; pan.x = pan.z = 0; orbited = false;
    az = HOME_AZ; el = homeElevation(width / height);
    scenic.skin(skinNow());
    shapeSun();
    fit();
    place(true);
    wake();
  }

  // ---------- the works: props decided by nurikabe-works.js from the sea as it is ----------
  const put = (parent, geo, mat, [x, y, z], [sx, sy, sz], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  /** A gate across a channel running along local x: two posts on the banks, a vermilion lintel, a plank that lifts. */
  function gate(g, closedY = 0.38, openY = 0.78) {
    for (const s of [-1, 1]) put(g, box, M.pstone, [0, 0.45, s * 0.45], [0.11, 0.95, 0.11]);
    put(g, box, M.vermil, [0, 0.96, 0], [0.09, 0.06, 1.0]);
    const plank = put(g, box, M.wood, [0, closedY, 0], [0.05, 0.3, 0.8]);
    gates.push({ plank, closedY, openY });
  }
  /** Where the water leaves or enters over a weir: the sill, a snout dividing the stream, and the white water falling outside the edge. */
  function weir(g, snout) {
    put(g, box, M.pstone, [0.43, 0.24, 0], [0.14, 0.48, 1]);
    put(g, box, M.pstone, [0.62, -0.1, 0], [0.34, 0.08, 0.9]);
    const f = put(g, box, M.foam, [0.6, 0.15, 0], [0.1, 0.62, 0.7]);
    f.castShadow = false;
    if (snout) put(g, cone4, M.pstone, [0.24, 0.3, 0], [0.32, 0.3, 0.32], [0, Math.PI / 4, Math.PI / 2]);
  }
  const stand = (cx, cz, theta) => { const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = theta; props.add(g); return g; };
  const yawOf = ([ox, oz]) => Math.atan2(-oz, ox);
  function buildProps(w) {
    props.clear(); gates = []; wheels = []; barges = [];
    const at = x => cellXZ(N, x);
    if (w.source >= 0) { const o = outward(N, w.source); if (o) { const [cx, cz] = at(w.source); weir(stand(cx, cz, yawOf(o)), true); } }
    if (w.outlet >= 0) {
      const o = outward(N, w.outlet);
      if (o) { const [cx, cz] = at(w.outlet), g = stand(cx, cz, yawOf(o)); weir(g, false); const gg = new THREE.Group(); gg.position.x = 0.3; g.add(gg); gate(gg); }
    }
    for (const lock of w.locks) for (const c of lock.gates) { const [cx, cz] = at(c); gate(stand(cx, cz, lock.axis === "x" ? 0 : Math.PI / 2)); }
    for (const s of w.sluices) {
      const [cx, cz] = at(s.cell);
      gate(stand(cx, cz, s.axis === "x" ? 0 : Math.PI / 2));
    }
    for (const b of w.bridges) {
      const [cx, cz] = at(b.cell), g = stand(cx, cz, b.axis === "x" ? 0 : Math.PI / 2);
      [-0.4, -0.2, 0, 0.2, 0.4].forEach((z, i) => put(g, box, M.pstone, [0, [0.73, 0.84, 0.9, 0.84, 0.73][i], z], [0.36, 0.07, 0.22]));
      for (const s of [-1, 1]) put(g, box, M.vermil, [s * 0.16, 0.96, 0], [0.025, 0.05, 0.5], [0, 0, 0]).visible = false;
    }
    // the rule's arch bridges: a timber deck humped over the canal between vermilion rails, level with the banks at its ends
    // (the decoration over plain water is a bare stone arch: never mistaken for these)
    for (let x = 0; x < N * N; x++) {
      if (!bridge[x]) continue;
      const [cx, cz] = at(x), g = stand(cx, cz, bridge[x] === 1 ? 0 : Math.PI / 2);
      [-0.4, -0.2, 0, 0.2, 0.4].forEach((p, i) => {
        const y = [0.74, 0.82, 0.88, 0.82, 0.74][i];
        put(g, box, M.wood, [p, y, 0], [0.2, 0.09, 0.62]);
        for (const s of [-1, 1]) put(g, box, M.vermil, [p, y + 0.1, s * 0.3], [0.2, 0.1, 0.04]);
      });
      for (const s of [-1, 1]) { put(g, box, M.vermil, [s * 0.47, 0.88, 0.3], [0.06, 0.3, 0.06]); put(g, box, M.vermil, [s * 0.47, 0.88, -0.3], [0.06, 0.3, 0.06]); }
    }
    for (const nr of w.norias) {
      const [cx, cz] = at(nr.cell), g = stand(cx, cz, nr.axis === "x" ? 0 : Math.PI / 2), z = (nr.axis === "x" ? nr.side : -nr.side) * 0.3;
      const wheel = new THREE.Group();
      wheel.position.set(0, 0.62, z);
      put(wheel, cylOpen, M.wood, [0, 0, 0], [0.8, 0.07, 0.8], [Math.PI / 2, 0, 0]).material = M.wood;
      for (let k = 0; k < 4; k++) put(wheel, box, M.wood, [0, 0, 0], [0.8, 0.03, 0.04], [0, 0, (k * Math.PI) / 4]);
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; put(wheel, box, M.straw, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], [0.1, 0.07, 0.1], [0, 0, a]); }
      g.add(wheel);
      for (const s of [-1, 1]) put(g, box, M.pstone, [0, 0.5, z + s * 0.08], [0.06, 1.0, 0.04]);
      wheels.push({ wheel, wet: w.wet[nr.cell] });
    }
    if (w.path.length >= 4) {
      bargePts = w.path.map(x => at(x));
      bargeLen = 0;
      const cum = [0];
      for (let i = 1; i < bargePts.length; i++) cum.push(cum[i - 1] + Math.hypot(bargePts[i][0] - bargePts[i - 1][0], bargePts[i][1] - bargePts[i - 1][1]));
      bargeLen = cum[cum.length - 1];
      bargePts.cum = cum;
      for (let i = 0; i < w.barges; i++) {
        const g = new THREE.Group();
        put(g, box, M.wood, [0, 0.0, 0], [0.34, 0.08, 0.15]);       // the hull rides half under the surface
        put(g, box, M.wood, [0.2, 0.0, 0], [0.1, 0.08, 0.1], [0, Math.PI / 4, 0]);
        put(g, cyl, M.straw, [-0.02, 0.1, 0], [0.1, 0.16, 0.1], [0, 0, Math.PI / 2]);
        g.visible = false; g.userData = { i, yaw: 0 };
        props.add(g); barges.push(g);
      }
    }
    colourProps();
  }
  function colourProps() {
    const k = skinNow();
    M.wood.color.set(k.wood); M.pstone.color.set(k.stone); M.vermil.color.set(k.vermilion); M.straw.color.set(k.straw);
    M.foam.color.set(0xf4f6ee); M.sheen.color.set(k.sheen); M.rows.color.set(0xffffff);
  }
  /** Where a barge `s` cells along its route is: the point and the heading. */
  function along(s) {
    const L = bargeLen, cum = bargePts.cum;
    s = ((s % L) + L) % L;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const a = bargePts[i - 1], b = bargePts[i], t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), edge: Math.min(s, L - s) };
  }
  /** The flow map: each cell's current (red, green) and whether it belongs to the flowing network (blue). */
  function paintFlow(w) {
    const img = flowCtx.createImageData(N, N), d = img.data;
    for (let x = 0; x < N * N; x++) {
      d[x * 4] = Math.round((w.flow[x * 2] * 0.5 + 0.5) * 255); d[x * 4 + 1] = Math.round((w.flow[x * 2 + 1] * 0.5 + 0.5) * 255);
      d[x * 4 + 2] = w.sea[x] ? (w.wet[x] ? 255 : 90) : 0; d[x * 4 + 3] = 255;
    }
    flowCtx.putImageData(img, 0, 0);
    flowTex.needsUpdate = true;
  }
  /** Rebuilds the works and the plots when the sea has changed. */
  function replan() {
    if (!look) return;
    const key = look.marks;
    if (key === planKey) return;
    planKey = key;
    // the water runs under a rule bridge, so for the works its cell is sea (and no decoration stands there)
    const wet = bridge.some(Boolean) ? Array.from(look.marks, (m, x) => (bridge[x] ? SEA : m)).join("") : look.marks;
    plan = works(N, clue, wet, bridge);
    if (bridge.some(Boolean)) plan.bridges = [];                  // decorative arches would pass for the rule's: a puzzle with bridges has only those
    owner = plotsOf(N, clue, look.marks, rules);
    paintFlow(plan);
    buildProps(plan);
  }

  /** Puts every instance where its block is now (heights `cur`) and colours the turf, water and halos from the page's look. */
  function place(colours) {
    if (!earth) return;
    const l = look, seaAt = x => l && (l.marks[x] === SEA || bridge[x] > 0), landAt = x => l && l.marks[x] === LAND;
    const k = skinNow(), solved = !!l?.solved;
    if (colours) replan();
    for (let x = 0; x < N * N; x++) {
      const [cx, cz] = cellXZ(N, x), h = cur[x], w = 1 - GAP;      // the earth fills its cell (no slit between blocks for the water to show in), the turf lies a hair inside it
      const capH = Math.max(0.001, CAP * Math.min(1, (h - BED_H) / (LAND_H - BED_H)));     // the turf thins away as the block sinks
      earth.setMatrixAt(x, MA.compose(PV.set(cx, (h - capH) / 2, cz), Q.identity(), SV.set(1, h - capH, 1)));     // the earth stops under the turf, so their tops never share a plane
      turf.setMatrixAt(x, MA.compose(PV.set(cx, h - capH / 2, cz), Q.identity(), SV.set(w + 0.002, capH, w + 0.002)));
      const top = seaAt(x) ? Math.max(h, wcur[x]) : h;
      const dotted = landAt(x) ? 1 : 0;
      dots.setMatrixAt(x, MA.compose(PV.set(cx, h + 0.03, cz), Q.identity(), SV.set(0.2 * dotted, 0.06 * dotted + 0.0001, 0.2 * dotted)));
      const lit = l?.lit?.has(x), why = l?.why?.has(x), on = lit || why;
      halos.setMatrixAt(x, MA.compose(PV.set(cx, top + 0.03, cz), Q.identity(), on ? SV.set(lit ? 0.9 : 0.8, 0.045, lit ? 0.9 : 0.8) : SV.set(0, 0.0001, 0)));
      // a whole plot: crop rows (and a paddy's mirror), but never on a number's stone
      const own = owner ? owner[x] : -1, crop = own >= 0 && !clue[x] && h > LAND_H - 0.01, paddy = crop && isPaddy(own);
      for (let r = 0; r < 3; r++) {
        const rh = crop ? (paddy ? 0.1 : solved ? 0.2 : 0.15) : 0.0001;
        rows.setMatrixAt(x * 3 + r, MA.compose(PV.set(cx, h + rh / 2, cz + (r - 1) * 0.28), Q.identity(), crop ? SV.set(0.8, rh, 0.09) : SV.set(0, 0.0001, 0)));
      }
      sheen.setMatrixAt(x, MA.compose(PV.set(cx, h + 0.02, cz), Q.identity(), paddy ? SV.set(0.94, 0.04, 0.94) : SV.set(0, 0.0001, 0)));
      if (colours) {
        const ownNumber = own >= 0;
        if (clue[x]) C.set(k.stone).lerp(C2.set(k.good), ownNumber ? 0.3 : 0);
        else C.set(k.soil).offsetHSL(0, 0, jitter[x] * 0.06);
        if (l?.over?.has(x)) C.lerp(C2.set(k.bad), 0.55);
        turf.setColorAt(x, C);
        earth.setColorAt(x, seaAt(x) ? C.set(k.bed) : C.set(k.levee).offsetHSL(0, 0, jitter[x] * 0.05));
        dots.setColorAt(x, C.set(k.ink));
        halos.setColorAt(x, C.set(k.gilt).lerp(C2.set(0xffffff), lit ? 0 : 0.35));
        const cropColour = paddy ? k.paddy : k.millet;
        for (let r = 0; r < 3; r++) rows.setColorAt(x * 3 + r, C.set(cropColour).offsetHSL(0, 0, (r - 1) * 0.03 + (solved && !paddy ? 0.04 : 0)));
        sheen.setColorAt(x, C.set(k.sheen));
      }
    }
    for (const m of [earth, turf, dots, halos, rows, sheen, rim]) m.instanceMatrix.needsUpdate = true;
    shapeSheet();
    shapeRim();
    if (colours) for (const m of [earth, turf, dots, halos, rows, sheen, rim]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (colours) for (let i = 0; i < rim.count; i++) rim.setColorAt(i, C.set(k.levee).offsetHSL(0, 0, 0.03));
    seaColours();
    if (colours) baseMesh.setColorAt(0, C.set(k.base));
    if (baseMesh.instanceColor) baseMesh.instanceColor.needsUpdate = true;
  }
  /** The levee round the polder, so the water at the board's edge has a bank too (open only where the weir and the outlet pass through it). */
  function shapeRim() {
    const t = 0.15, h = LAND_H, half = N / 2;
    let i = 0;
    const open = (x, dx, dz) => { const o = plan && (x === plan.source || x === plan.outlet) ? outward(N, x) : null; return !!o && o[0] === dx && o[1] === dz; };
    for (let k = 0; k < N; k++) {
      const [cx] = cellXZ(N, k);
      const [, rz] = cellXZ(N, k * N);
      for (const [x, px, pz, dx, dz] of [[k, cx, -half - t / 2, 0, -1], [k * N + N - 1, half + t / 2, rz, 1, 0], [(N - 1) * N + k, cx, half + t / 2, 0, 1], [k * N, -half - t / 2, rz, -1, 0]]) {
        rim.setMatrixAt(i++, MA.compose(PV.set(px, h / 2, pz), Q.identity(), open(x, dx, dz) ? SV.set(0, 0.0001, 0) : dx ? SV.set(t, h, 1) : SV.set(1, h, t)));
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rim.setMatrixAt(i++, MA.compose(PV.set(sx * (half + t / 2), h / 2, sz * (half + t / 2)), Q.identity(), SV.set(t, h, t)));
  }
  /** The canal's colour a cell at a time: celadon, oxblood where a rule is broken. */
  function seaColours() {
    if (!water) return;
    const k = skinNow(), l = look;
    for (let x = 0; x < N * N; x++) {
      C.set(k.water);
      if (l && (l.pool?.has(x) || l.cut?.has(x))) C.lerp(C2.set(k.bad), 0.62);
      const col = water.geometry.attributes.color.array;
      for (let v = 0; v < 6; v++) { col[x * 18 + v * 3] = C.r; col[x * 18 + v * 3 + 1] = C.g; col[x * 18 + v * 3 + 2] = C.b; }
    }
    water.geometry.attributes.color.needsUpdate = true;
  }
  function update(next) {
    if (!earth) return;
    look = next;
    for (let x = 0; x < N * N; x++) tgt[x] = clue[x] ? CLUE_H : next.marks[x] === SEA || bridge[x] ? BED_H : LAND_H;
    if (still) cur = tgt.slice();
    if (!next.solved) { waveAt = 0; fillAt = 0; for (let x = 0; x < N * N; x++) wtgt[x] = WATER_H; }
    else if (!waveAt) { waveAt = 1; fillAt = 1; }                      // a solved board loaded: its water already stands full (celebrate() plays the filling)
    for (const pl of plates) {
      const cl = pl.el.classList;
      cl.toggle("done", next.done?.has(pl.x) ?? false);
      cl.toggle("over", next.over?.has(pl.x) ?? false);
      cl.toggle("why", (next.why?.has(pl.x) || next.lit?.has(pl.x)) ?? false);
    }
    place(true);
    wake(next.solved ? FEAST_FOR : FLOW_FOR);
  }

  // ---------- the skin ----------
  function applySkin() {
    const k = skinNow();
    M.water.color.set(0xffffff);
    hemi.color.set(k.sky); hemi.groundColor.set(k.ground); hemi.intensity = k.hemi;
    sun.color.set(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    U.uMoonI.value = k.glint;
    scenic?.skin(k);
    paintBack();
    colourProps();
    place(true);
    wake();
  }
  let backW = 0, backH = 0;
  /** The mountains are painted at the host's size, a fifth wider than the card so a turn of the board can slide them a little. */
  function paintBack() {
    if (!width || !height) return;
    const pr = Math.min(devicePixelRatio || 1, 1.5);
    backW = Math.round(width * 1.2 * pr); backH = Math.round(height * pr);
    back.width = backW; back.height = backH;
    paintBackdrop(back.getContext("2d"), backW, backH, skinNow());
    slideBack();
  }
  function slideBack() { back.style.transform = `translateX(${(Math.sin(az) * width * 0.08).toFixed(1)}px)`; }

  // ---------- the camera ----------
  let width = 1, height = 1, rem = 16, az = HOME_AZ, el = homeElevation(1), dist = 14, fitDist = 14, orbited = false, measure = true, camDirty = true;
  let zoom = 1;
  const pan = { x: 0, z: 0 };
  const LOOK = new THREE.Vector3(0, LOOK_Y, 0), V = new THREE.Vector3(), G = new THREE.Vector3();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function pose() {
    LOOK.set(pan.x, LOOK_Y, pan.z);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** The sun stands behind the camera's left shoulder wherever the board is turned to, so the carving always shows its walls. */
  function shapeSun() {
    const D = N * 3 + 8, la = az - 0.7, le = Math.min(el + 0.35, 1.25), s = N * 0.8 + 2;
    sun.position.set(Math.sin(la) * Math.cos(le) * D, Math.sin(le) * D, Math.cos(la) * Math.cos(le) * D);
    sun.target.position.set(0, 0, 0);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: D * 2 });
    sun.shadow.camera.updateProjectionMatrix();
    // the moon's (or sun's) glitter lies on the water toward the far side of the view
    U.uMoon.value.set(-Math.sin(az) * N * 0.22, -Math.cos(az) * N * 0.22, N * N * 0.09);
  }
  function fit() {
    if (!N) return;
    const aspect = width / height, ty = Math.tan(FOV / 2), tx = ty * aspect, near = 0.5, top = near * ty, right = top * aspect, pad = 0.9 * rem;
    fitDist = fitDistance(N, az, el, tx, ty, (2 * pad) / width, (2 * pad) / height);
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, Math.max(60, fitDist + N + 10));
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    dist = fitDist / zoom;
    pose();
    shapeSun();
    scenic?.face(az);
    slideBack();
    camDirty = true;
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    if (!orbited) el = homeElevation(width / height);
    fit();
    paintBack();
    measure = true;
    wake();
  }
  let plateK = 1;
  /** The plates follow their blocks on the screen; their size follows the cell's pixels, so a number never covers its neighbour's. */
  function placePlates() {
    const ppu = (height / 2) / (dist * Math.tan(FOV / 2)), k = Math.round(Math.max(0.8, Math.min(1.5, (0.62 * ppu) / (1.3 * rem))) * 20) / 20;
    if (k !== plateK) { plateK = k; labels.style.setProperty("--k", String(k)); measure = true; }
    if (measure) { for (const pl of plates) { pl.w = pl.el.offsetWidth; pl.h = pl.el.offsetHeight; } measure = false; }
    for (const pl of plates) {
      V.copy(pl.p).project(camera);
      pl.el.style.transform = `translate(${Math.round(((V.x + 1) / 2) * width - pl.w / 2)}px, ${Math.round(((1 - V.y) / 2) * height - pl.h / 2)}px)`;
      pl.el.style.zIndex = String(2000 - Math.round(camera.position.distanceTo(pl.p) * 20));
    }
    camDirty = false;
  }

  // ---------- drawing ----------
  let shown = false, held = false, frameId = 0, last = 0, busyUntil = 0, flowUntil = 0, lastAt = 0, clock = 0;
  const ease = (a, b, dt, tau) => (Math.abs(b - a) < 0.003 ? b : a + (b - a) * (1 - Math.exp(-dt / tau)));
  function draw(now) {
    if (!earth) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastAt) / 1000));
    lastAt = now;
    if (spinUntil > now) { az += 0.35 * dt; fit(); }
    let moving = false;
    for (let x = 0; x < cur.length; x++) {
      if (cur[x] === tgt[x]) continue;
      cur[x] = ease(cur[x], tgt[x], dt, SINK);
      moving = true;
    }
    // a solved network fills outward from the intake, the gates lift
    const solved = !!look?.solved;
    for (let x = 0; x < wcur.length; x++) {
      let want = WATER_H;
      if (solved && plan) {
        const d = plan.dist[x] < 0 ? 0 : plan.dist[x];
        want = fillAt === 1 || still || now - fillAt > d * FILL_MS ? WATER_FULL : WATER_H;
      }
      if (wcur[x] !== want) { wcur[x] = ease(wcur[x], want, dt, 0.25); moving = true; }
    }
    const liftTo = solved && (fillAt === 1 || still || now - fillAt > 500) ? 1 : 0;
    if (lift !== liftTo) { lift = ease(lift, liftTo, dt, 0.35); moving = true; for (const g of gates) g.plank.position.y = g.closedY + (g.openY - g.closedY) * lift; }
    else if (lift === 1 || lift === 0) for (const g of gates) g.plank.position.y = g.closedY + (g.openY - g.closedY) * lift;
    if (moving) place(false);
    // the current, the norias and the barges while the clock runs
    const flowing = !still && now < flowUntil;
    if (flowing) {
      clock += dt;
      U.uTime.value = clock;
      for (const w of wheels) w.wheel.rotation.z -= dt * (solved ? 0.7 : 0.25 + 0.3 * (w.wet ? 1 : 0.2));
    }
    for (const b of barges) {
      const on = solved && bargeLen > 0;
      b.visible = on;
      if (!on) continue;
      const s = along(clock * 0.45 + (b.userData.i * bargeLen) / barges.length), grow = Math.max(0.01, Math.min(1, s.edge / 0.8));
      let dy = s.yaw - b.userData.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      b.userData.yaw += dy * Math.min(1, dt * 6);
      b.position.set(s.x, levelAt(s.x, s.z) + Math.sin(clock * 2 + b.userData.i) * 0.004, s.z);
      b.rotation.y = b.userData.yaw;
      b.scale.setScalar(grow);
    }
    if (camDirty || measure) placePlates();
    renderer.render(scene, camera);
    if (moving) busyUntil = Math.max(busyUntil, now + 120);
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    const busy = now < busyUntil || spinUntil > now, flowing = !still && now < flowUntil;
    if (now - last >= (busy ? BUSY_MS : FLOW_MS) - 2) { last = now; draw(now); }
    if (busy || flowing) frameId = requestAnimationFrame(frame);
  }
  /** Something happened (a touch, a change of the marks): draw for a moment, and let the water run for `flow` ms. */
  function wake(flow = FLOW_FOR) {
    if (!shown || held || !earth) return;
    const now = performance.now();
    busyUntil = now + BUSY_FOR;
    flowUntil = Math.max(flowUntil, now + flow);
    if (!frameId) { lastAt = now; frameId = requestAnimationFrame(frame); }
  }

  // ---------- playing it: a tap marks a cell, a drag turns the board ----------
  const playable = () => (opts.playable ? !!opts.playable() : false);
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  /** The ray through a canvas pixel: where it starts and its direction. */
  function rayAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, d = [G.x - o.x, G.y - o.y, G.z - o.z], l = Math.hypot(...d);
    return { o: [o.x, o.y, o.z], d: d.map(v => v / l) };
  }
  /** The cell under a finger at the page's (clientX, clientY), or -1. */
  function pickAt(cx, cy) {
    if (!earth) return -1;
    const { o, d } = rayAt(...canvasPoint(cx, cy));
    return cellHit(N, cur.map((_, x) => topOf(x)), o, d);
  }
  function groundAt(sx, sy) {
    const { o, d } = rayAt(sx, sy), t = (LOOK_Y - o[1]) / d[1];
    return { x: o[0] + d[0] * t, z: o[2] + d[2] * t };
  }
  function clampPan() {
    const lim = (N / 2) * (1 - 1 / zoom) + 0.5;
    pan.x = Math.max(-lim, Math.min(lim, pan.x)); pan.z = Math.max(-lim, Math.min(lim, pan.z));
  }
  function zoomAt(z, cx, cy) {
    if (!earth) return;
    const [sx, sy] = cx == null ? [width / 2, height / 2] : canvasPoint(cx, cy), before = groundAt(sx, sy);
    zoom = Math.max(1, Math.min(MAX_ZOOM, z));
    fit();
    if (zoom === 1) pan.x = pan.z = 0; else { const after = groundAt(sx, sy); pan.x += before.x - after.x; pan.z += before.z - after.z; clampPan(); }
    fit(); wake();
  }
  function reset() { zoom = 1; pan.x = pan.z = 0; orbited = false; orbit(HOME_AZ, homeElevation(width / height)); }
  function orbit(a, e) { az = a; el = Math.max(MIN_EL, Math.min(MAX_EL, e)); fit(); wake(); }
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }, { passive: false });
  const fingers = new Map();
  let pinch = null, g = null, lastTap = null;
  const pinchNow = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  canvas.addEventListener("pointerdown", e => {
    if (e.button === 2) { const x = playable() ? pickAt(e.clientX, e.clientY) : -1; if (x >= 0) opts.press?.(x, "dot"); return; }
    if (e.button > 0) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g && fingers.size === 2 && !pinch) {
      g.turning = true;
      const { d, mx, my } = pinchNow();
      pinch = { d0: d, zoom0: zoom, anchor: groundAt(...canvasPoint(mx, my)) };
      return;
    }
    if (g) return;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, turning: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  });
  canvas.addEventListener("pointermove", e => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size === 2) {
      const { d, mx, my } = pinchNow();
      zoom = Math.max(1, Math.min(MAX_ZOOM, pinch.zoom0 * (d / pinch.d0)));
      fit();
      if (zoom === 1) pan.x = pan.z = 0; else { const now = groundAt(...canvasPoint(mx, my)); pan.x += pinch.anchor.x - now.x; pan.z += pinch.anchor.z - now.z; clampPan(); }
      fit(); wake();
      return;
    }
    if (!g || e.pointerId !== g.id) return;
    if (!g.turning) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) <= SLIP * scale()) return;
      g.turning = true;
      g.x = e.clientX; g.y = e.clientY;
      return;
    }
    orbited = true;
    az -= (e.clientX - g.x) * 0.008;
    el = Math.max(MIN_EL, Math.min(MAX_EL, el + (e.clientY - g.y) * 0.006));
    fit(); wake();
    g.x = e.clientX; g.y = e.clientY;
  });
  const letGo = e => {
    fingers.delete(e.pointerId);
    if (pinch && fingers.size < 2) { pinch = null; const p = g && fingers.get(g.id); if (p) { g.x = p.x; g.y = p.y; } }
    if (!g || e.pointerId !== g.id) return;
    const { turning } = g, now = performance.now();
    g = null;
    if (e.type === "pointercancel" || turning) return;
    const x = pickAt(e.clientX, e.clientY);
    if (x >= 0) { lastTap = null; if (playable()) opts.press?.(x, "tap"); return; }
    // two taps beside the board turn it back to where it began
    if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; reset(); } else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.style.touchAction = "none";
  // zoom buttons, for a mouse without a wheel (a touch screen has its fingers: the stylesheet hides them there)
  const zoomBox = document.createElement("div");
  zoomBox.className = "nk3-zoom";
  for (const [text, label, by] of [["+", "Zoom in", 1.4], ["−", "Zoom out", 1 / 1.4]]) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label);
    b.addEventListener("click", () => zoomAt(zoom * by));
    zoomBox.appendChild(b);
  }
  host.appendChild(zoomBox);
  addEventListener("keydown", ev => {
    if (!shown || held || ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector("dialog[open]") || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) return;
    if (ev.key === "+" || ev.key === "=") zoomAt(zoom * 1.4);
    else if (ev.key === "-" || ev.key === "_") zoomAt(zoom / 1.4);
    else if (ev.key === "0") reset();
    else return;
    ev.preventDefault();
  });

  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  document.addEventListener("visibilitychange", wake);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => { applySkin(); wake(); });
  applySkin();
  resize();

  return {
    canvas, set, update,
    show(on) { shown = !!on; if (shown) { resize(); wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    /** Holds the drawing still while the menu is open, then lets it go on. */
    hold(on) { held = !!on; if (held && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); },
    /** After a win: the board turns slowly for a few seconds. */
    celebrate(ms = 6000) { waveAt = fillAt = performance.now(); if (!still) spinUntil = waveAt + ms; place(true); wake(FEAST_FOR); },
    orbit, reset,
    get angles() { return [az, el]; },
    get view() { return { zoom, x: pan.x, z: pan.z }; },
    zoomTo(z, cx, cy) { zoomAt(z, cx, cy); },
    /** For tests: the page's (clientX, clientY) of a cell's top, as a finger would tap it. */
    where(x) {
      const [cx, cz] = cellXZ(N, x), r = canvas.getBoundingClientRect();
      V.set(cx, look && look.marks[x] === SEA ? wcur[x] : tgt[x], cz).project(camera);
      return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
    },
    pick: pickAt,
    /** For tests: the blocks' heights now, and what is on show. */
    get live() { return { heights: cur.slice(), targets: tgt.slice(), plates: plates.length, shown, calls: renderer.info.render.calls, works: plan, flowing: performance.now() < flowUntil }; },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeWorld(); scenic?.dispose(); renderer.dispose(); },
  };
}
