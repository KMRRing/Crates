// Drift in 3D: a Hanseatic quay of stone and timber in the quay's shape (a hull, a pier, a basin...), water lapping at its
// edges, bollards, piles, a timber crane and a lighter, drawn with three.js (vendor/three-run.js, kept on the device so it plays
// offline). Everything is made in code, no models and no textures. Goods are four merged models (a salt sack, a herring
// barrel, a bale of furs, a lump of amber), each drawn with one InstancedMesh; they slide and tumble with a weight of their own
// (barrels tip and roll, sacks drag and slump, bales slump, amber skips), stop against each other in order, and a line that
// ships is lifted by the crane into the lighter. The weather is the forecast's: flags and ripples show the wind, a squall
// darkens the light and rains, fog thickens, a rogue wave heaves the sea. Skins: Codex by day and night, Office by night.
// It answers the same calls as the flat board in drift.js (draw, place, arrive, shove, slide, ship, popup, finish, cell, theme,
// resize, dispose). It draws only while something moves: a tween (a turn playing), and the sea's slow lap at about fifteen
// frames a second while the page is showing and the game is not paused (not at all under reduced motion).
import * as THREE from "./vendor/three-run.js";
import { SHAPES } from "./drift-shapes.js";
import { WATER, EMPTY, MOORED, SEALED } from "./drift-engine.js";
import { sound } from "./drift-sound.js";

const DECK = 0.36, DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
const HALF = [0.32, 0.35, 0.25, 0.28, 0.26], TOP = [0.64, 0.7, 0.5, 0.52];       // a good's half height and height (a rock's half is last)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), mix = (a, b, t) => a + (b - a) * t;
const ease = u => u * u * (3 - 2 * u), easeIn = u => u * u;
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// ---------- skins ----------
const SKINS = {
  codex: {
    day: { bg: 0xcfe0dc, sea: [0x5fa3a6, 0x3d7f90], stone: 0xc4b89c, stoneDark: 0x988d78, timber: 0x9c7545, timberDark: 0x694a2b, foam: 0xf6f2e6, sun: 0xfff0d2, sunI: 2.6, sky: 0xd6e8f0, ground: 0x7b6d56, hemi: 1.5, roof: 0x9a4332, lamp: null },
    night: { bg: 0x0b1620, sea: [0x1d4a5f, 0x10303f], stone: 0x8f8974, stoneDark: 0x625d4f, timber: 0x8d6840, timberDark: 0x4b3926, foam: 0xa9c1d4, sun: 0xa9c4ee, sunI: 1.9, sky: 0x6d8cbf, ground: 0x2c3138, hemi: 1.6, roof: 0x5e2d25, lamp: 0xffc56a },
  },
  office: {
    night: { bg: 0x090e16, sea: [0x1a4272, 0x0e2744], stone: 0x62666d, stoneDark: 0x3c3f44, timber: 0x70747b, timberDark: 0x40434a, foam: 0x9ccbfa, sun: 0xcfe4fb, sunI: 1.8, sky: 0x6f8db3, ground: 0x23272d, hemi: 1.45, roof: 0x2f6aa8, lamp: 0x9ccbfa },
  },
};
function skinNow() {
  const root = document.documentElement, theme = root.dataset.theme === "office" ? "office" : "codex";
  const night = theme === "office" || (root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches);
  return { name: `${theme} ${night ? "night" : "day"}`, night, ...SKINS[theme][night ? "night" : "day"] };
}

// ---------- geometry: little builders merged into one vertex-coloured model per thing ----------
const dummy = new THREE.Object3D();
function lathe(profile, seg = 8, jit = 0, seed = 0) {
  const pos = [], idx = [], n = profile.length;
  for (let s = 0; s < seg; s++) for (let k = 0; k < n; k++) {
    const a = (s / seg) * Math.PI * 2, [r, y] = profile[k], j = 1 + (hash(s, k, seed) - 0.5) * jit;
    pos.push(Math.cos(a) * r * j, y, Math.sin(a) * r * j);
  }
  for (let s = 0; s < seg; s++) for (let k = 0; k < n - 1; k++) { const a = s * n + k, b = ((s + 1) % seg) * n + k; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
/** A shape moved, turned and scaled: p position, s scale, r rotation (x, y, z). */
function put(g, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] } = {}) {
  dummy.position.set(...p); dummy.rotation.set(...r); dummy.scale.set(...s); dummy.updateMatrix();
  return g.applyMatrix4(dummy.matrix);
}
/** A rough lump: a low sphere with its corners pushed about (by position, so the faces stay joined). */
function lump(r, amount, seed, o = {}) {
  const g = new THREE.SphereGeometry(r, 6, 4).toNonIndexed(), a = g.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const k = 1 + (hash(Math.round(a.getX(i) * 50), Math.round(a.getY(i) * 50) + seed, Math.round(a.getZ(i) * 50)) - 0.5) * amount;
    a.setXYZ(i, a.getX(i) * k, a.getY(i) * k, a.getZ(i) * k);
  }
  return put(g, o);
}
/** Parts [{ g, c (colour) }] as one model with a colour on every vertex and a face normal on every face. */
function merge(parts) {
  const pos = [], col = [];
  for (const { g, c } of parts) {
    const ng = g.index ? g.toNonIndexed() : g, a = ng.attributes.position, k = new THREE.Color(c);
    for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); col.push(k.r, k.g, k.b); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
const box = (w, h, d, o) => put(new THREE.BoxGeometry(w, h, d), o), cyl = (r0, r1, h, seg, o) => put(new THREE.CylinderGeometry(r0, r1, h, seg), o);
const cone = (r, h, seg, o) => put(new THREE.ConeGeometry(r, h, seg), o);

// The goods, each centred on the middle of its height. Salt: a sack tied at the neck. Herring: an oak barrel, iron hoops and a
// silver fish on the lid. Furs: a corded bale with tawny fur showing. Amber: a rough lump with two chips.
const MODELS = () => [
  merge([
    { g: lathe([[0, -0.32], [0.24, -0.32], [0.35, -0.25], [0.39, -0.06], [0.34, 0.12], [0.22, 0.24], [0.11, 0.28], [0.15, 0.36], [0.07, 0.38], [0, 0.34]], 8, 0.1, 1), c: 0xece6d2 },
    { g: cyl(0.125, 0.125, 0.05, 8, { p: [0, 0.26, 0] }), c: 0x8a6a45 },
    { g: lump(0.05, 0.4, 3, { p: [0.14, -0.2, 0.28] }), c: 0xffffff }, { g: lump(0.04, 0.4, 4, { p: [-0.2, 0, 0.3] }), c: 0xf6f3ea },
  ]),
  merge([
    { g: lathe([[0, -0.35], [0.27, -0.35], [0.34, -0.2], [0.385, 0], [0.34, 0.2], [0.27, 0.35], [0, 0.35]], 10, 0.02, 2), c: 0xa9763f },
    ...[-0.27, -0.12, 0.12, 0.27].map(y => ({ g: cyl(0.385 - (y / 0.35) ** 2 * 0.115 + 0.012, 0.385 - (y / 0.35) ** 2 * 0.115 + 0.012, 0.045, 10, { p: [0, y, 0] }), c: 0x3d4247 })),
    { g: cyl(0.26, 0.26, 0.02, 10, { p: [0, 0.355, 0] }), c: 0xc9985a },
    { g: box(0.24, 0.012, 0.07, { p: [0, 0.372, 0], r: [0, 0.6, 0] }), c: 0xd3dde2 }, { g: cone(0.04, 0.09, 3, { p: [-0.1, 0.372, 0.06], r: [0, 0.6, Math.PI / 2] }), c: 0xd3dde2 },
  ]),
  merge([
    { g: box(0.8, 0.44, 0.6, { p: [0, -0.02, 0] }), c: 0x5e3f4d },
    { g: box(0.76, 0.1, 0.56, { p: [0, 0.2, 0] }), c: 0x93704f },
    ...[[-0.25, 0.1], [0, -0.12], [0.22, 0.12], [-0.12, -0.14], [0.3, -0.1], [-0.3, -0.08], [0.06, 0.16]].map(([x, z], i) => ({ g: cone(0.07, 0.15, 4, { p: [x, 0.3, z], r: [0, i, 0] }), c: i % 2 ? 0xb08a62 : 0x93704f })),
    { g: box(0.06, 0.5, 0.64, { p: [-0.2, -0.02, 0] }), c: 0xd0bd8c }, { g: box(0.06, 0.5, 0.64, { p: [0.2, -0.02, 0] }), c: 0xd0bd8c },
  ]),
  merge([
    { g: lump(0.3, 0.45, 5, { p: [0, -0.04, 0], s: [1, 0.85, 0.9] }), c: 0xe49a14 },
    { g: lump(0.17, 0.4, 6, { p: [0.27, -0.14, 0.12] }), c: 0xf3b83c }, { g: lump(0.13, 0.4, 7, { p: [-0.22, -0.16, -0.14] }), c: 0xd68a0e },
    { g: lump(0.1, 0.3, 8, { p: [0.04, 0.12, 0.1] }), c: 0xfbd36a },
  ]),
  merge([{ g: lump(0.34, 0.6, 9, { s: [1, 0.78, 0.92] }), c: 0x7e7c78 }, { g: lump(0.18, 0.5, 10, { p: [0.22, -0.1, 0.16] }), c: 0x636260 }, { g: lump(0.14, 0.5, 11, { p: [-0.2, -0.12, -0.1] }), c: 0x8d8b86 }]),
  merge([{ g: cyl(0.5, 0.5, 0.05, 12), c: 0x2e3236 }, { g: cyl(0.52, 0.52, 0.02, 12, { p: [0, 0.03, 0] }), c: 0xc79a3c }]),        // a mooring plate
  merge([{ g: cyl(0.1, 0.1, 0.03, 10), c: 0xa82f2f }, { g: cyl(0.12, 0.12, 0.02, 10, { p: [0, -0.015, 0] }), c: 0xd8b24a }, { g: cone(0.04, 0.05, 5, { p: [0, 0.035, 0] }), c: 0xd8b24a }]),   // the harbour master's wax
];
const ROUGH = [0.95, 0.75, 1, 0.22, 0.9, 0.5, 0.45];

export function create3D(box_, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });     // throws where there is no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  const canvas = renderer.domElement;
  canvas.className = "dr-3d";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The quay in 3D");
  const labels = document.createElement("div");
  labels.className = "dr-labels";
  box_.append(canvas, labels);

  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  sun.position.set(-5, 11, 7);
  scene.add(hemi, sun, sun.target);
  const world = new THREE.Group(), statics = new THREE.Group();     // statics: the quay, rebuilt for a shape or a skin
  scene.add(world);
  world.add(statics);

  let skin = skinNow(), shape = null, W = 7, H = 7, edges = [], disposed = false;
  const mats = new Map();
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, flatShading: true, ...extra });

  // ----- the goods: instanced, one mesh a good (and a ghost twin, see-through, for what is only forecast or only aimed) -----
  const GEO = MODELS(), goodMat = GEO.map((_, c) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ROUGH[c], metalness: c === 3 ? 0.1 : 0, flatShading: true, emissive: c === 3 ? 0x3a1c00 : 0x000000, side: THREE.DoubleSide }));
  const ghostMat = GEO.map((_, c) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, transparent: true, opacity: 0.5, depthWrite: false }));
  const solid = GEO.map((g, c) => { const m = new THREE.InstancedMesh(g, goodMat[c], 96); m.count = 0; m.frustumCulled = false; m.castShadow = c < 5; m.receiveShadow = c < 5; world.add(m); return m; });
  const ghost = GEO.slice(0, 5).map((g, c) => { const m = new THREE.InstancedMesh(g, ghostMat[c], 12); m.count = 0; m.frustumCulled = false; world.add(m); return m; });
  // marks on the deck: the aimed square, the strays' squares, a wave's band, the ringed
  const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.025, 0.92), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }), 90);
  marks.count = 0; marks.frustumCulled = false;
  const arrows = new THREE.InstancedMesh(put(new THREE.ConeGeometry(0.17, 0.42, 5), { r: [0, 0, -Math.PI / 2] }), new THREE.MeshBasicMaterial({ color: 0x0d4d63, transparent: true, opacity: 0.9 }), 12);
  arrows.count = 0; arrows.frustumCulled = false;
  world.add(marks, arrows);

  // ----- the weather's furniture: spray, rain, cloud shadow-dark veil -----
  const SPRAY = 70, RAIN = 150;
  const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), SPRAY);
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.5, 0.016), new THREE.MeshBasicMaterial({ color: 0xcfe0ee, transparent: true, opacity: 0.8, depthWrite: false }), RAIN);
  spray.frustumCulled = rain.frustumCulled = false;
  spray.count = rain.count = 0;
  world.add(spray, rain);
  const seeds = Array.from({ length: Math.max(SPRAY, RAIN) }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3), hash(i, 4)]);

  // ----- state of the drawing -----
  const recs = new Map();           // square -> a resting crate { c, k, x, z, ... }
  let rockRecs = [], ghostRecs = [], markRecs = [], arrowRecs = [], wind = 0;
  const weather = { squall: 0, fog: 0, wave: 0, gust: 0, surge: 0, tSquall: 0, tFog: 0, tWave: 0, tGust: 0 };
  let sea = null, seaBase = null, seaSize = 0, crane = null, lighter = null, flags = [], lamps = null;
  const cell = i => [(i % W) - W / 2 + 0.5, Math.floor(i / W) - H / 2 + 0.5];
  const newRec = (c, k, i) => { const [x, z] = cell(i); return { c, k, i, x, z, dy: 0, sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, order: "XYZ", yAbs: null, hide: false }; };

  function paint() {
    const counts = new Array(GEO.length).fill(0), gc = [0, 0, 0, 0, 0];
    const putRec = (mesh, n, r, half) => {
      dummy.position.set(r.x, r.yAbs ?? DECK + half * r.sy + r.dy, r.z);
      dummy.rotation.order = r.order;
      dummy.rotation.set(r.rx, r.ry, r.rz);
      dummy.scale.set(r.sx, r.sy, r.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
    };
    const plain = { order: "XYZ", rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, dy: 0, yAbs: null };
    for (const r of recs.values()) {
      if (r.hide) continue;
      putRec(solid[r.c], counts[r.c]++, r, HALF[r.c]);
      if (r.k === MOORED) putRec(solid[5], counts[5]++, { ...plain, x: r.x, z: r.z, yAbs: DECK + 0.025 }, 0);
      if (r.k === SEALED) putRec(solid[6], counts[6]++, { ...plain, x: r.x, z: r.z, yAbs: r.yAbs == null ? DECK + TOP[r.c] * r.sy + 0.06 + r.dy : r.yAbs + TOP[r.c] * 0.5 }, 0);
    }
    for (const r of rockRecs) putRec(solid[4], counts[4]++, r, HALF[4]);
    for (const m of solid) { m.count = counts[solid.indexOf(m)]; m.instanceMatrix.needsUpdate = true; }
    for (const r of ghostRecs) { const t = r.rock ? 4 : r.c; putRec(ghost[t], gc[t]++, r, HALF[t]); }
    ghost.forEach((m, t) => { m.count = gc[t]; m.instanceMatrix.needsUpdate = true; });
    marks.count = Math.min(90, markRecs.length);
    markRecs.slice(0, 90).forEach((m, n) => { dummy.position.set(m.x, DECK + 0.02, m.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); marks.setMatrixAt(n, dummy.matrix); marks.setColorAt(n, new THREE.Color(m.col)); });
    marks.instanceMatrix.needsUpdate = true;
    if (marks.instanceColor) marks.instanceColor.needsUpdate = true;
    arrows.count = arrowRecs.length;
    arrowRecs.forEach((m, n) => { dummy.position.set(m.x, DECK + 0.1, m.z); dummy.rotation.set(0, m.yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); arrows.setMatrixAt(n, dummy.matrix); });
    arrows.instanceMatrix.needsUpdate = true;
  }

  // ----- the static quay -----
  const isOpen = (x, y) => x >= 0 && y >= 0 && x < W && y < H && shape.open[y * W + x];
  function buildStatics() {
    statics.traverse(o => o.geometry?.dispose?.());
    statics.clear();
    for (const m of mats.values()) m.dispose();
    mats.clear();
    skin = skinNow();
    const parts = [], piles = [], bollards = [], lampParts = [];
    edges = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isOpen(x, y)) continue;
      const [wx, wz] = [x - W / 2 + 0.5, y - H / 2 + 0.5], shade = (hash(x, y, 1) - 0.5) * 0.16;
      parts.push({ g: box(0.99, 0.95, 0.99, { p: [wx, DECK - 0.5, wz] }), c: new THREE.Color(skin.stone).offsetHSL(0, 0, shade) });
      const along = hash(x, y, 2) < 0.5;                                              // planks run one way or the other
      for (let p = 0; p < 4; p++) {
        const o = -0.36 + p * 0.24, lum = (hash(x, y, 10 + p) - 0.5) * 0.12;
        parts.push({ g: box(along ? 0.97 : 0.215, 0.05, along ? 0.215 : 0.97, { p: [wx + (along ? 0 : o), DECK - 0.005, wz + (along ? o : 0)] }), c: new THREE.Color(skin.timber).offsetHSL(0, 0, lum) });
      }
      for (let d = 0; d < 4; d++) {
        if (isOpen(x + DX[d], y + DZ[d])) continue;
        const ex = wx + DX[d] * 0.5, ez = wz + DZ[d] * 0.5, horizontal = d % 2 === 0;
        edges.push({ x: ex, z: ez, d });
        parts.push({ g: box(horizontal ? 1.02 : 0.15, 0.1, horizontal ? 0.15 : 1.02, { p: [ex - DX[d] * 0.04, DECK + 0.03, ez - DZ[d] * 0.04] }), c: skin.stoneDark });
        piles.push([ex + DX[d] * 0.08, ez + DZ[d] * 0.08]);
        if ((x + y * 3 + d) % 3 === 0) bollards.push([ex - DX[d] * 0.22 + (horizontal ? 0.3 : 0), ez - DZ[d] * 0.22 + (horizontal ? 0 : 0.3)]);
      }
    }
    piles.forEach(([px, pz], n) => {
      if (n % 2) return;
      parts.push({ g: cyl(0.075, 0.085, 1.5, 6, { p: [px, DECK - 0.25, pz] }), c: skin.timberDark });
      parts.push({ g: cyl(0.06, 0.075, 0.05, 6, { p: [px, DECK + 0.5, pz] }), c: skin.timber });
      if (skin.lamp && n % 8 === 0) lampParts.push({ g: new THREE.SphereGeometry(0.06, 5, 4).translate(px, DECK + 0.58, pz), c: skin.lamp });
    });
    bollards.forEach(([bx, bz]) => {
      parts.push({ g: cyl(0.075, 0.1, 0.17, 7, { p: [bx, DECK + 0.1, bz] }), c: 0x2b2e31 });
      parts.push({ g: new THREE.SphereGeometry(0.095, 6, 4).translate(bx, DECK + 0.2, bz), c: 0x383c40 });
    });
    // the crane's plinth, north of the top row; the lighter lies beside it
    const top = [...Array(W).keys()].filter(x => isOpen(x, 0)).sort((a, b) => Math.abs(a - (W - 1) / 2) - Math.abs(b - (W - 1) / 2))[0] ?? 0;
    const cx = top - W / 2 + 0.5, cz = -H / 2 - 0.5, side = top <= (W - 1) / 2 ? 1 : -1;
    parts.push({ g: box(1, 0.95, 1, { p: [cx, DECK - 0.5, cz] }), c: skin.stone }, { g: box(1.02, 0.1, 1.02, { p: [cx, DECK + 0.03, cz] }), c: skin.stoneDark });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push({ g: box(0.1, 2.5, 0.1, { p: [cx + sx * 0.3, DECK + 1.3, cz + sz * 0.3] }), c: skin.timberDark });
    for (const y of [0.7, 1.5, 2.3]) for (const s of [-0.3, 0.3]) parts.push({ g: box(0.7, 0.05, 0.05, { p: [cx, DECK + y, cz + s] }), c: skin.timber }, { g: box(0.05, 0.05, 0.7, { p: [cx + s, DECK + y, cz] }), c: skin.timber });
    for (const s of [-0.3, 0.3]) parts.push({ g: box(0.04, 1.7, 0.04, { p: [cx + s, DECK + 1.2, cz - 0.3 * Math.sign(s)], r: [0, 0, 0.5 * Math.sign(s)] }), c: skin.timber });
    const body = new THREE.Mesh(merge(parts), std(0xffffff, { vertexColors: true }));
    body.castShadow = body.receiveShadow = true;
    statics.add(body);
    if (lampParts.length) statics.add(new THREE.Mesh(merge(lampParts), new THREE.MeshBasicMaterial({ vertexColors: true })));

    // the crane's turning head, trolley and hook; the lighter; the flags
    const JIB = 4.2, JY = DECK + 2.95;
    const head = new THREE.Group();
    head.position.set(cx, DECK + 2.55, cz);
    const headBody = merge([
      { g: box(0.82, 0.55, 0.82, { p: [0, 0.27, 0] }), c: skin.timber }, { g: cone(0.72, 0.55, 4, { p: [0, 0.82, 0], r: [0, Math.PI / 4, 0] }), c: skin.roof },
      { g: box(0.14, 0.14, JIB + 0.3, { p: [0, 0.4, JIB / 2 - 0.05] }), c: skin.timberDark }, { g: box(0.07, 0.07, JIB * 0.9, { p: [0, 0.12, JIB * 0.45], r: [-0.07, 0, 0] }), c: skin.timber },
      { g: box(0.3, 0.3, 0.5, { p: [0, 0.35, -0.75] }), c: skin.stoneDark }, { g: cyl(0.5, 0.5, 0.14, 12, { p: [0.5, 0.2, 0], r: [0, 0, Math.PI / 2] }), c: skin.timberDark }, { g: cyl(0.4, 0.4, 0.16, 12, { p: [0.5, 0.2, 0], r: [0, 0, Math.PI / 2] }), c: skin.timber },
    ]);
    head.add(new THREE.Mesh(headBody, std(0xffffff, { vertexColors: true })));
    const trolley = new THREE.Group(), chain = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1, 0.025), std(0x2b2e31)), hook = new THREE.Mesh(merge([{ g: box(0.09, 0.1, 0.09), c: 0x2b2e31 }, { g: box(0.2, 0.03, 0.03, { p: [0, -0.07, 0] }), c: 0x2b2e31 }]), std(0xffffff, { vertexColors: true }));
    trolley.add(chain, hook);
    head.add(trolley);
    head.children.forEach(c => (c.castShadow = true));
    statics.add(head);
    const flagAt = (parent, y, len, col) => {
      const f = new THREE.Group(); f.position.set(0, y, 0);
      const segs = []; let at = f;
      for (let s = 0; s < 4; s++) { const seg = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(len / 4, len * 0.3, 0.012), std(s % 2 ? 0xf1ead8 : col, { side: THREE.DoubleSide })); m.position.x = len / 8; seg.add(m); seg.position.x = s ? len / 4 : 0; at.add(seg); segs.push(seg); at = seg; }
      parent.add(f);
      flags.push({ f, segs });
    };
    flags = [];
    const craneTop = new THREE.Group(); craneTop.position.set(cx, DECK + 3.55, cz); statics.add(craneTop);
    craneTop.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), std(0x2b2e31)));
    craneTop.children[0].position.y = 0.2;
    flagAt(craneTop, 0.34, 0.42, 0xa8382b);
    const lx = cx + side * 1.9, lz = cz + 0.05;
    const boat = new THREE.Group();
    boat.position.set(lx, 0, lz);
    boat.add(new THREE.Mesh(merge([
      { g: box(1.5, 0.3, 0.62, { p: [0, 0.02, 0] }), c: skin.timberDark }, { g: cone(0.31, 0.5, 4, { p: [0.95, 0.02, 0], r: [0, Math.PI / 4, -Math.PI / 2], s: [1, 1, 0.75] }), c: skin.timberDark },
      { g: cone(0.31, 0.45, 4, { p: [-0.92, 0.02, 0], r: [0, Math.PI / 4, Math.PI / 2], s: [1, 1, 0.75] }), c: skin.timberDark },
      { g: box(1.55, 0.05, 0.66, { p: [0, 0.18, 0] }), c: skin.timber }, { g: box(1.2, 0.03, 0.4, { p: [0, 0.17, 0] }), c: skin.stoneDark },
      { g: cyl(0.025, 0.03, 1.2, 5, { p: [-0.55, 0.78, 0] }), c: skin.timber },
    ]), std(0xffffff, { vertexColors: true })));
    boat.children[0].castShadow = true;
    const hold = new THREE.Group(); hold.position.y = 0.2; boat.add(hold);
    const mast = new THREE.Group(); mast.position.set(-0.55, 1.2, 0); boat.add(mast);
    flagAt(mast, 0, 0.5, 0x2f6690);
    statics.add(boat);
    lighter = { boat, hold, x: lx, z: lz, cargo: 0 };
    // at rest the jib hangs over the water, above the lighter, so it never covers the quay
    crane = { head, trolley, chain, hook, cx, cz, JIB, JY, theta: 0, r: 0, len: 0, rest: { theta: Math.atan2(lx - cx, lz - cz), r: Math.hypot(lx - cx, lz - cz), len: 0.8 } };
    setCrane(crane.rest.theta, crane.rest.r, crane.rest.len);
    fitCamera(cx, cz);
    buildSea();
    sun.shadow.camera.left = -W / 2 - 3; sun.shadow.camera.right = W / 2 + 3; sun.shadow.camera.top = H / 2 + 4; sun.shadow.camera.bottom = -H / 2 - 3; sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
    sun.shadow.camera.updateProjectionMatrix();
  }

  function setCrane(theta, r, len) {
    crane.theta = theta; crane.r = r; crane.len = len;
    crane.head.rotation.y = theta;
    crane.trolley.position.set(0, 0.34, r);
    crane.chain.scale.y = len; crane.chain.position.y = -len / 2;
    crane.hook.position.y = -len - 0.05;
  }
  const hookAt = () => ({ x: crane.cx + Math.sin(crane.theta) * crane.r, z: crane.cz + Math.cos(crane.theta) * crane.r, y: DECK + 2.55 + 0.34 - crane.len - 0.05 });

  // ----- the sea: a faceted sheet, shallower near the quay, heaving with the wind -----
  const SEA = 76, SEG = 52;
  function buildSea() {
    if (sea) { sea.geometry.dispose(); sea.material.dispose(); world.remove(sea); }
    const g = new THREE.PlaneGeometry(SEA, SEA, SEG, SEG), p = g.attributes.position, col = [], c0 = new THREE.Color(skin.sea[0]), c1 = new THREE.Color(skin.sea[1]), tmp = new THREE.Color();
    seaBase = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = -p.getY(i), d = Math.max(0, Math.abs(x) - W / 2, Math.abs(z) - H / 2), t = clamp(d / 9, 0, 1);
      seaBase.push(x, z);
      tmp.copy(c0).lerp(c1, ease(t)).offsetHSL(0, 0, (hash(i) - 0.5) * 0.03);
      col.push(tmp.r, tmp.g, tmp.b);
    }
    g.rotateX(-Math.PI / 2);
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    sea = new THREE.Mesh(g, std(0xffffff, { vertexColors: true, roughness: 0.3, metalness: 0.1 }));
    sea.position.y = -0.04;
    sea.receiveShadow = true;
    world.add(sea);
    foam = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: skin.foam, transparent: true, opacity: 0.6, depthWrite: false }), Math.max(1, edges.length));
    foam.frustumCulled = false;
    statics.add(foam);
  }
  let foam = null;
  function seaTick(t) {
    const p = sea.geometry.attributes.position, wx = DX[wind], wz = DZ[wind];
    const amp = 0.035 + weather.gust * 0.03 + weather.squall * 0.05 + weather.wave * 0.05 + weather.surge * 0.3, speed = 1.2 + weather.gust * 0.5 + weather.squall * 0.8;
    for (let i = 0; i < p.count; i++) {
      const x = seaBase[i * 2], z = seaBase[i * 2 + 1], along = x * wx + z * wz;
      let y = Math.sin(along * 1.1 - t * speed) * amp + Math.sin((x * 0.7 - z * 0.9) + t * 0.6) * amp * 0.6;
      if (weather.wave + weather.surge > 0.01) y += (weather.wave * 0.12 + weather.surge * 0.5) * Math.sin(along * 0.42 - t * 1.6);
      p.setY(i, y);
    }
    p.needsUpdate = true;
    foam.count = edges.length;
    edges.forEach((e, n) => {
      const lap = 0.5 + 0.5 * Math.sin(t * 1.3 + n * 1.7), hz = e.d % 2 === 0;
      dummy.position.set(e.x + DX[e.d] * (0.07 + lap * 0.06), 0.0, e.z + DZ[e.d] * (0.07 + lap * 0.06));
      dummy.rotation.set(0, hz ? 0 : Math.PI / 2, 0);
      dummy.scale.set(0.9 + lap * 0.1, 1, 0.6 + lap * 0.9);
      dummy.updateMatrix();
      foam.setMatrixAt(n, dummy.matrix);
    });
    foam.instanceMatrix.needsUpdate = true;
    foam.material.opacity = 0.35 + weather.squall * 0.15 + weather.surge * 0.3 + 0.1 * Math.sin(t * 0.9);
    // spray and rain
    const sn = Math.round(weather.gust * 18 + 22 + weather.squall * 30), rn = Math.round(weather.squall * RAIN);
    spray.count = Math.min(SPRAY, sn); rain.count = rn;
    for (let i = 0; i < spray.count; i++) {
      const s = seeds[i], u = (s[0] + t * (0.09 + s[1] * 0.07)) % 1, span = SEA * 0.22;
      const a = (u - 0.5) * 2 * span, b = (s[2] - 0.5) * 2 * (Math.max(W, H) * 0.7);
      dummy.position.set(wx ? a * wx : b, 0.1 + s[3] * 0.7 + Math.sin(t * 3 + i) * 0.05, wz ? a * wz : b);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.6 + s[1]); dummy.updateMatrix();
      spray.setMatrixAt(i, dummy.matrix);
    }
    spray.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < rain.count; i++) {
      const s = seeds[i], u = (s[0] + t * (1.3 + s[1] * 0.5)) % 1;
      dummy.position.set((s[2] - 0.5) * (W + 6) + wx * (1 - u) * 1.2, 5 * (1 - u) - 0.1, (s[3] - 0.5) * (H + 6) + wz * (1 - u) * 1.2);
      dummy.rotation.set(wz * 0.18, 0, -wx * 0.18); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      rain.setMatrixAt(i, dummy.matrix);
    }
    rain.instanceMatrix.needsUpdate = true;
    // flags stream downwind and flutter; the lighter and the hook bob
    const dir = Math.atan2(-wz, wx);
    for (const { f, segs } of flags) {
      f.rotation.y = dir;
      segs.forEach((s, k) => { s.rotation.y = Math.sin(t * (5 + weather.gust * 3 + weather.squall * 4) - k * 0.9) * (0.18 + weather.gust * 0.12 + weather.squall * 0.1); s.rotation.z = Math.sin(t * 4 - k) * 0.05; });
    }
    lighter.boat.position.y = Math.sin(t * 1.1) * 0.03 - 0.1 - lighter.cargo * 0.01;
    lighter.boat.rotation.z = Math.sin(t * 0.9) * 0.025 + weather.surge * 0.1;
    lighter.boat.rotation.x = Math.sin(t * 0.7 + 1) * 0.02;
  }

  // ----- the camera: from the south, looking down; pulled back until the quay, the crane and the lighter all show -----
  let camD = 16;
  function fitCamera() {
    const w = box_.clientWidth, h = box_.clientHeight;
    if (!w || !h || !crane) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const pitch = (50 * Math.PI) / 180, span = [[-W / 2 - 0.5, 0, H / 2 + 0.5], [W / 2 + 0.5, 0, H / 2 + 0.5], [-W / 2 - 0.5, 0, -H / 2 - 1.2], [W / 2 + 0.5, 0, -H / 2 - 1.2], [crane.cx, 3.8, crane.cz], [crane.cx + Math.sin(crane.rest.theta) * 4.4, 3.4, crane.cz + Math.cos(crane.rest.theta) * 4.4], [lighter.x + Math.sign(lighter.x - crane.cx) * 0.8, 0.4, lighter.z], [crane.cx - Math.sign(lighter.x - crane.cx) * 0.5, 0, crane.cz]].map(a => new THREE.Vector3(...a));
    const mid = new THREE.Vector3(0, 0.3, -0.55);
    const ok = d => {
      cam.position.set(mid.x, mid.y + Math.sin(pitch) * d, mid.z + Math.cos(pitch) * d);
      cam.lookAt(mid);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      return span.every(v => { const p = v.clone().project(cam); return Math.abs(p.x) <= 0.97 && Math.abs(p.y) <= 0.97; });
    };
    let lo = 4, hi = 90;
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
    ok(hi);
    camD = hi;
    sun.target.position.copy(mid);
    bump();
  }

  // ----- the weather and the skin, applied -----
  function lights() {
    const k = 1 - weather.squall * 0.45;
    sun.color.set(skin.sun); sun.intensity = skin.sunI * k * (1 - weather.fog * 0.3);
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi * (1 - weather.squall * 0.25);
    const bg = new THREE.Color(skin.bg).lerp(new THREE.Color(skin.night ? 0x3b4752 : 0xb4bdc0), weather.fog * 0.65 + weather.squall * 0.2);
    renderer.setClearColor(bg);
    if (!scene.fog) scene.fog = new THREE.Fog(bg, 40, 130);
    scene.fog.color.copy(bg);
    scene.fog.near = camD * mix(3, 0.55, weather.fog); scene.fog.far = camD * mix(9, 1.9, weather.fog) * (1 - weather.squall * 0.25);
  }

  // ----- drawing a state -----
  function draw(cells, extra = {}) {
    const sh = SHAPES[extra.shape];
    if (sh && sh !== shape) { shape = sh; W = sh.w; H = sh.h; edges = []; buildStatics(); lights(); }
    wind = extra.wind ?? wind;
    const sky = extra.sky || {};
    weather.tSquall = sky.squall ? 1 : 0; weather.tFog = sky.fog ? 1 : 0; weather.tWave = sky.wave ? 1 : 0; weather.tGust = sky.gust ? 1 : 0;
    const stakes = new Set(extra.stakes || []);
    recs.clear();
    cells.forEach((c, i) => { if (c >= 0) recs.set(i, newRec(c, stakes.has(i) ? MOORED : extra.sealAt === i ? SEALED : 0, i)); });
    rockRecs = (extra.rocks || []).map(i => { const [x, z] = cell(i); return { c: 4, x, z, dy: 0, sx: 1.05 + hash(i) * 0.2, sy: 0.9 + hash(i, 1) * 0.5, sz: 1.05 + hash(i, 2) * 0.2, rx: 0, ry: hash(i, 3) * 6, rz: 0, order: "XYZ", yAbs: null }; });
    ghostRecs = []; markRecs = []; arrowRecs = [];
    if (extra.omens !== false) {
      for (const q of extra.strays || []) if (cells[q.at] === EMPTY) { const r = newRec(q.colour, 0, q.at); r.dy = 0.04; ghostRecs.push(r); markRecs.push({ x: r.x, z: r.z, col: 0x9fb4c8 }); }
      if (extra.reef >= 0 && cells[extra.reef] === EMPTY) { const [x, z] = cell(extra.reef); ghostRecs.push({ rock: true, c: 4, x, z, dy: 0, sx: 1.1, sy: 1, sz: 1.1, rx: 0, ry: 1, rz: 0, order: "XYZ", yAbs: null }); markRecs.push({ x, z, col: 0x9fb4c8 }); }
      const wv = extra.wave;
      if (wv) for (let k = 0; k < (wv.axis === 0 ? W : H); k++) {
        const x = wv.axis === 0 ? k : wv.at, y = wv.axis === 0 ? wv.at : k;
        if (!isOpen(x, y)) continue;
        const [wx, wz] = cell(y * W + x);
        markRecs.push({ x: wx, z: wz, col: 0x1b87a3 });
        arrowRecs.push({ x: wx, z: wz, yaw: wv.axis === 0 ? (wv.dir > 0 ? 0 : Math.PI) : wv.dir > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
    for (const i of extra.ring || []) { const [x, z] = cell(i); markRecs.push({ x, z, col: 0xe6c04a }); }
    if (extra.ghost) {
      const { at, c, k } = extra.ghost, r = newRec(c, k, at);
      ghostRecs.push(r);
      markRecs.push({ x: r.x, z: r.z, col: 0xf1d36a });
    }
    paint();
    lights();
    bump();
  }

  // ----- tweens: everything that plays is one of these, so a tap can finish them all at once -----
  let tweens = [], raf = 0, timer = 0, lastT = 0, lastAmbient = 0, paused = false, soundOn = false;
  const clock0 = performance.now();
  let skipping = false;
  function tween(ms, fn) {
    if (skipping) { fn(1); return Promise.resolve(); }
    return new Promise(done => { tweens.push({ ms, fn, at: 0, done }); invalidate(); });
  }
  const finish = () => { const t = tweens; tweens = []; for (const w of t) { w.fn(1); w.done(); } paint(); invalidate(); };
  const ambientOn = () => !disposed && !paused && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  function invalidate() {
    if (disposed) return;
    if (tweens.length) { if (timer) { clearTimeout(timer); timer = 0; } if (!raf) raf = requestAnimationFrame(frame); }
    else if (!raf && !timer) timer = setTimeout(() => { timer = 0; frame(performance.now()); }, 16);
  }
  function frame(now) {
    raf = 0;
    if (disposed || frozen) return;
    const dt = Math.min(64, now - (lastT || now));
    lastT = now;
    const ambient = advance(dt, now);
    if (tweens.length) raf = requestAnimationFrame(frame);
    else if (ambient) timer = setTimeout(() => { timer = 0; frame(performance.now()); }, 66);
    else lastT = 0;
  }
  /** Moves every tween on by dt and draws; says whether the sea is in motion too. */
  function advance(dt, now) {
    const moving = tweens.length > 0, t = (now - clock0) / 1000;
    if (moving) {
      const ran = tweens; tweens = [];
      for (const w of ran) { w.at += dt; const u = clamp(w.at / w.ms, 0, 1); w.fn(u); if (u >= 1) w.done(); else tweens.push(w); }
      paint();
    }
    weather.squall += (weather.tSquall - weather.squall) * 0.06; weather.fog += (weather.tFog - weather.fog) * 0.06;
    weather.wave += (weather.tWave - weather.wave) * 0.06; weather.gust += (weather.tGust - weather.gust) * 0.06;
    const ambient = ambientOn();
    if (moving || (ambient && now - lastAmbient > 62)) { lastAmbient = now; if (sea) { seaTick(t); lights(); } renderer.render(scene, cam); }
    else if (!ambient && !moving && dirty) renderer.render(scene, cam);
    dirty = false;
    syncSound(ambient);
    return ambient;
  }
  let frozen = false;
  let dirty = true, bedAt = -1;
  function syncSound(ambient) {
    const want = ambient && sound.on && sound.primed, strength = 0.22 + weather.gust * 0.2 + weather.squall * 0.35;
    if (want && (!soundOn || Math.abs(strength - bedAt) > 0.03)) { sound.bed(true, strength); bedAt = strength; }
    else if (!want && soundOn) sound.bed(false);
    soundOn = want;
  }
  const bump = () => { dirty = true; invalidate(); };

  // ----- the turn, played -----
  /** The crate laid drops from above and squashes as it lands. */
  async function place(i) {
    const r = recs.get(i);
    if (!r) return;
    let thudded = false;
    await tween(400, u => {
      if (u < 0.62) { const f = u / 0.62; r.dy = 2.1 * (1 - easeIn(f)); r.sy = 1; r.sx = r.sz = 1; }
      else { const k = (u - 0.62) / 0.38; r.dy = 0; r.sy = 1 - 0.2 * Math.exp(-k * 4) * Math.cos(k * 9) * (k < 1 ? 1 : 0); r.sx = r.sz = 1 + (1 - r.sy) * 0.5; if (!thudded) { thudded = true; if (u < 1) sound.drop(r.c); } }
      r.hide = false;
    });
    r.dy = 0; r.sy = r.sx = r.sz = 1;
  }
  /** The squall's strays fall and a rock rises from the water. */
  async function arrive(list, reef = -1) {
    const rs = list.map(i => recs.get(i)).filter(Boolean), rk = reef >= 0 ? rockRecs.find(q => q.x === cell(reef)[0] && q.z === cell(reef)[1]) : null;
    if (rs.length) sound.rain(0.7);
    const played = new Set();
    await tween(560, u => {
      rs.forEach((r, n) => {
        const f = clamp((u * 560 - n * 70) / 330, 0, 1);
        r.dy = 3 * (1 - easeIn(f));
        if (f >= 1 && !played.has(r)) { played.add(r); if (u < 1) sound.drop(r.c); }
        r.sy = f >= 1 ? 1 - 0.15 * Math.exp(-(u * 560 - n * 70 - 330) / 70) : 1;
      });
      if (rk) { const f = ease(u); rk.yAbs = mix(-0.5, DECK + HALF[4] * rk.sy, f); rk.sx = rk.sz = f * 1.1 + 0.05; if (u > 0.2 && !played.has(rk)) { played.add(rk); if (u < 1) sound.wash(0.5); } }
    });
    rs.forEach(r => { r.dy = 0; r.sy = 1; });
    if (rk) { rk.yAbs = null; rk.sx = rk.sz = 1.1; }
  }
  /** A rogue wave shoves a row or column one square: the crates slide with the surge. */
  async function shove(moved) {
    const rs = moved.map(([f, t]) => ({ r: recs.get(t), f: cell(f), t: cell(t) })).filter(m => m.r);
    sound.wash(0.9);
    weather.surge = 1;
    await tween(520, u => {
      weather.surge = 1 - u;
      for (const { r, f, t } of rs) { const e = ease(u); r.x = mix(f[0], t[0], e); r.z = mix(f[1], t[1], e); r.dy = Math.sin(u * Math.PI) * 0.1; r.rz = Math.sin(u * Math.PI) * 0.08; }
    });
    weather.surge = 0;
    for (const { r, t } of rs) { r.x = t[0]; r.z = t[1]; r.dy = 0; r.rz = 0; }
  }
  // each good's weight: how hard the wind pushes it (cells/s squared), how it settles, how it moves
  const WEIGHT = [{ a: 24, slump: 0.2 }, { a: 44, slump: 0.05 }, { a: 20, slump: 0.16 }, { a: 34, slump: 0.03 }];
  /** The wind blows: each crate that moves accelerates, tumbles in its own way and stops against the edge or the one ahead. */
  async function slide(moved, w) {
    const horizontal = w % 2 === 1, sign = w === 1 || w === 2 ? 1 : -1;
    const items = moved.map(([f, t]) => {
      const r = recs.get(t);
      if (!r) return null;
      const [fx, fz] = cell(f), dist = Math.hypot(r.x - fx, r.z - fz), P = WEIGHT[r.c];
      const a = Math.max(P.a, (2 * dist) / 0.55 ** 2), T = Math.sqrt((2 * dist) / a);
      r.order = r.c === 1 ? (horizontal ? "ZYX" : "XYZ") : "XYZ";
      return { r, fx, fz, tx: r.x, tz: r.z, dist, T, P, sound: false, slid: false };
    }).filter(Boolean);
    if (!items.length) return;
    const total = Math.max(...items.map(m => m.T)) + 0.24;
    const go = (m) => { if (!m.slid) { m.slid = true; sound.slide(m.r.c, m.T, m.dist / 3); } };
    await tween(total * 1000, u => {
      const tt = u * total;
      for (const m of items) {
        const { r, T, P } = m;
        if (tt < T) {
          go(m);
          const p = (tt / T) ** 2, trav = m.dist * p;
          r.x = mix(m.fx, m.tx, p); r.z = mix(m.fz, m.tz, p);
          const lean = Math.min(1, tt / 0.1) * Math.min(1, (T - tt) / 0.12 + 0.3);
          if (r.c === 1) {                                              // a barrel tips over and rolls on its side
            const tip = Math.min(1, tt / 0.09) * clamp((T - tt) / 0.1, 0, 1);
            r.rz = horizontal ? -sign * tip * Math.PI / 2 : 0; r.rx = horizontal ? 0 : sign * tip * Math.PI / 2;
            r.ry = (horizontal ? -sign : sign) * trav / 0.38 * (horizontal ? 1 : -1);
            r.dy = 0.02 + Math.abs(Math.sin(trav * 2.2)) * 0.015;
          } else if (r.c === 0) {                                       // a sack drags: leans back, stretches along the way
            const k = lean * 0.3;
            r.rz = horizontal ? sign * k : 0; r.rx = horizontal ? 0 : -sign * k;
            r.sx = horizontal ? 1 + lean * 0.08 : 1; r.sz = horizontal ? 1 : 1 + lean * 0.08; r.sy = 1 - lean * 0.05;
          } else if (r.c === 2) {                                       // a bale ploughs along, nose down
            const k = lean * 0.1;
            r.rz = horizontal ? -sign * k : 0; r.rx = horizontal ? 0 : sign * k;
            r.dy = Math.sin(trav * 3) * 0.008;
          } else {                                                      // amber skips and spins
            r.dy = Math.abs(Math.sin(trav * 3.4)) * 0.09 * lean; r.ry = trav * 1.8;
          }
        } else {
          const k = tt - T;
          if (!m.sound) { m.sound = true; if (u < 1) sound.thud(r.c); }
          r.x = m.tx; r.z = m.tz;
          const env = Math.exp(-k * 9) * Math.cos(k * 26);
          r.rx = r.rz = r.dy = 0;
          if (r.c === 1) { r.ry = 0; r.rx = r.rz = 0; r.order = "XYZ"; const tip = Math.max(0, 1 - k / 0.13); r.rz = horizontal ? -sign * tip * Math.PI / 2 : 0; r.rx = horizontal ? 0 : sign * tip * Math.PI / 2; r.dy = Math.max(0, env) * 0.05; }
          else if (r.c === 3) r.ry = m.dist * 1.8;
          else if (r.c === 0) r.ry = 0;
          r.sy = 1 - P.slump * env * 0.9; const sp = 1 + (1 - r.sy) * 0.55; r.sx = r.sz = sp;
          if (r.c === 0 || r.c === 2) { const d = env * 0.04; r.x += horizontal ? sign * d : 0; r.z += horizontal ? 0 : sign * d; }
        }
      }
    });
    for (const { r, tx, tz } of items) { r.x = tx; r.z = tz; r.rx = r.rz = r.ry = r.dy = 0; r.sx = r.sy = r.sz = 1; r.order = "XYZ"; }
  }
  /** A line ships: the crates are slung by the crane and lowered into the lighter, which rides lower for it. */
  async function ship(cleared) {
    const list = cleared.map(i => recs.get(i)).filter(Boolean);
    if (!list.length) return;
    sound.bell(list.length >= 5 ? 2 : 1);
    const cx = list.reduce((a, r) => a + r.x, 0) / list.length, cz = list.reduce((a, r) => a + r.z, 0) / list.length;
    await tween(150, u => { const s = 1 + 0.13 * Math.sin(u * Math.PI); for (const r of list) { r.sx = r.sy = r.sz = s; r.dy = 0.06 * Math.sin(u * Math.PI); } });
    // the hook swings over the crates and drops
    const { theta: th0, r: r0, len: l0 } = crane, th1 = Math.atan2(cx - crane.cx, cz - crane.cz), rr1 = clamp(Math.hypot(cx - crane.cx, cz - crane.cz), 0.9, crane.JIB), len1 = DECK + 2.55 + 0.29 - (DECK + 1.15);
    sound.chain(0.5);
    await tween(260, u => { const e = ease(u); setCrane(angleLerp(th0, th1, e), mix(r0, rr1, e), mix(l0, len1, e)); for (const r of list) { r.sx = r.sy = r.sz = 1; r.dy = 0; } });
    // lifted
    const from = list.map(r => ({ r, x: r.x, z: r.z, y: DECK + HALF[r.c] }));
    await tween(220, u => {
      const e = ease(u), hl = mix(len1, 1.15, e);
      setCrane(th1, rr1, hl);
      const h = hookAt();
      from.forEach(({ r, x, z, y }, n) => { r.x = mix(x, h.x + Math.sin(n * 2.1) * 0.1 * e, e); r.z = mix(z, h.z + Math.cos(n * 2.1) * 0.1 * e, e); r.yAbs = mix(y, h.y - 0.3 + (n % 2) * 0.08, e); r.sx = r.sy = r.sz = 1 - 0.35 * e; r.ry = e * n; });
    });
    // swung to the lighter
    const thL = Math.atan2(lighter.x - crane.cx, lighter.z - crane.cz), rL = clamp(Math.hypot(lighter.x - crane.cx, lighter.z - crane.cz), 0.9, crane.JIB + 0.5);
    sound.creak(0.5);
    await tween(280, u => {
      const e = ease(u);
      setCrane(angleLerp(th1, thL, e), mix(rr1, rL, e), mix(1.15, 0.95, Math.sin(e * Math.PI) * 0.5 + e * 0.5));
      const h = hookAt();
      list.forEach((r, n) => { r.x = h.x + Math.sin(n * 2.1) * 0.1 + Math.sin(u * 5) * 0.03; r.z = h.z + Math.cos(n * 2.1) * 0.1; r.yAbs = h.y - 0.3 + (n % 2) * 0.08; r.ry += 0.05; });
    });
    // lowered and stowed
    sound.chain(0.35);
    await tween(180, u => {
      const e = ease(u);
      setCrane(thL, rL, mix(0.95, 1.5, e));
      const h = hookAt();
      list.forEach((r, n) => { r.x = h.x; r.z = h.z; r.yAbs = h.y - 0.3 - e * 0.3; r.sx = r.sy = r.sz = 0.65 - 0.5 * e; });
    });
    for (const r of list) { r.hide = true; recs.delete(r.i); }
    stow(list[0].c, list.length);
    await tween(160, u => { const e = ease(u), q = crane.rest; setCrane(angleLerp(thL, q.theta, e), mix(rL, q.r, e), mix(1.5, q.len, e)); });
  }
  /** The lighter's hold takes the crates: little ones, piled; it rides lower, and when it is full it sails off and another comes. */
  function stow(c, n) {
    for (let k = 0; k < Math.min(n, 3); k++) {
      if (lighter.cargo >= 9) { lighter.hold.clear(); lighter.cargo = 0; }
      const m = new THREE.Mesh(GEO[c], goodMat[c]);
      m.scale.setScalar(0.4);
      const q = lighter.cargo++;
      m.position.set(-0.4 + (q % 4) * 0.28, 0.1 + Math.floor(q / 4) * 0.2, ((q * 7) % 3 - 1) * 0.12);
      m.rotation.y = q;
      lighter.hold.add(m);
    }
  }

  // ----- looking and picking -----
  const ray = { o: new THREE.Vector3(), t: new THREE.Vector3() };
  /** The square under a point of the screen, or -1 for water. */
  function cellAt(px, py) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return -1;
    const ndc = new THREE.Vector3(((px - rect.left) / rect.width) * 2 - 1, -(((py - rect.top) / rect.height) * 2 - 1), 0.5).unproject(cam);
    ray.o.copy(cam.position);
    ray.t.copy(ndc).sub(ray.o);
    if (ray.t.y >= 0) return -1;
    const s = (DECK + 0.1 - ray.o.y) / ray.t.y, x = Math.floor(ray.o.x + ray.t.x * s + W / 2), y = Math.floor(ray.o.z + ray.t.z * s + H / 2);
    return isOpen(x, y) ? y * W + x : -1;
  }
  function popup(cells, gain) {
    const u = [...new Set(cells)];
    if (!u.length) return;
    const rect = canvas.getBoundingClientRect(), v = new THREE.Vector3(0, 1.2, 0);
    for (const i of u) { const [x, z] = cell(i); v.x += x / u.length; v.z += z / u.length; }
    v.project(cam);
    const n = document.createElement("span");
    n.className = `dr-pop3d${u.length >= 6 ? " big" : ""}`;
    n.textContent = `+${gain.toLocaleString("en-GB")}`;
    n.style.left = `${((v.x + 1) / 2) * rect.width}px`;
    n.style.top = `${((1 - v.y) / 2) * rect.height}px`;
    labels.append(n);
    setTimeout(() => n.remove(), 1100);
  }

  const resizing = new ResizeObserver(() => fitCamera());
  resizing.observe(box_);
  const onVisible = () => { lastT = 0; bump(); };
  document.addEventListener("visibilitychange", onVisible);
  skin = skinNow();
  lights();

  return {
    flat: false, draw, place, arrive, shove, slide, ship, popup, finish, cell: cellAt, canvas,
    theme() { if (shape) { buildStatics(); lights(); paint(); bump(); } },
    resize: fitCamera,
    pause(on) { paused = on; if (on) syncSound(false); else bump(); },
    wake: bump,
    /** For looking at a turn mid-motion: stops the clock and moves it on by hand (ms at a time), drawing each. */
    step(ms, now = performance.now()) { frozen = true; clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = 0; lastAmbient = 0; advance(ms, now); },
    set fast(v) { skipping = !!v; },
    dispose() {
      disposed = true;
      clearTimeout(timer); cancelAnimationFrame(raf);
      resizing.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      sound.bed(false);
      scene.traverse(o => { o.geometry?.dispose?.(); });
      for (const m of [...mats.values(), ...goodMat, ...ghostMat]) m.dispose();
      renderer.dispose();
      canvas.remove(); labels.remove();
    },
    get stats() { return { tweens: tweens.length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, skin: skin.name, crates: recs.size }; },
  };
}
