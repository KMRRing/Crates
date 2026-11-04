// Lanterns as a strait, drawn with three.js (vendor/three.js, kept on the device, so it works offline): the board's white
// cells are shoals, flat slabs just under the surface of a slowly moving sea, its rocks are rocks with their number on a
// chip of the page laid over them. The sea is a channel between stone cliffs, open at both ends (the water runs off to a hazy
// horizon away from the viewer and out of the frame towards them), with small cogs sailing along it both ways, beside the board
// and never over a cell. A lantern is a lighthouse: a white tower with a red band, a gilt lamp and a dark cap.
// Its beams run along the row and the column to the next rock, a pale strip on the water with a brighter patch of light
// sweeping out along it, and every cell they cross turns warm. It is the puzzle, played: a tap on a shoal calls the page's
// press(cell, "tap"), a hold press(cell, "hold") (the page lights, dots and clears, as on the flat board), a drag turns the
// board, two fingers (or the wheel) zoom, and a hint's cells glow gilt. Which cell a finger means is worked out here from
// the ground under it (and, for a tower, from the lamp's height too), tested in Node as `cellUnder`.
// The page calls set(puzzle) for a new puzzle and update(marks, breaks, hint) after a change. Everything that repeats is an
// InstancedMesh: a handful of draw calls for any board. There are no shadows and no filters (the beams are stacked
// translucent strips). It draws only while it is on screen and nothing has paused it (the menu, a hidden tab), at the
// screen's own rate (the ships never stop moving); the ships advance by the time between frames, so a pause holds them.
// Throws where there is no WebGL (the page then keeps the flat board).
import * as THREE from "./vendor/three.js";
import { cellAtGround, cellXZ, runsFrom, fitDistance, homeElevation } from "./lanterns-model.js";

const DEG = Math.PI / 180;
const FOV = 58 * DEG, MIN_EL = 20 * DEG, MAX_EL = 82 * DEG, HOME_AZ = 0;
const MAX_ZOOM = 3.2;
const HOLD = 430, SLIP = 9;                      // ms a press takes to dot a cell (as on the flat board), and the pixels a finger may stray and still tap
const SIDE = 0.9;                                // cells of water kept in the frame beside the board, so the strait is seen
const SLAB = 0.12, TOWER = 0.95;                 // the shoal's thickness, and a tower's height
const LANE0 = 1.0, LANE_GAP = 0.9;   // ships keep to lanes beside the board, this far from its edge
// side (−1 left, 1 right), lane, way (1 towards the viewer, −1 away), speed in cells a second, where on the strait it starts (0..1), size
const SHIPS = [
  [-1, 0, -1, 1.3, 0.42, 0.9], [-1, 0, -1, 1.3, 0.92, 1], [-1, 1, 1, 0.9, 0.62, 0.95], [-1, 1, 1, 0.9, 0.12, 0.9],
  [1, 0, 1, 1.1, 0.5, 0.95], [1, 0, 1, 1.1, 0.0, 1], [1, 1, -1, 1.6, 0.35, 0.85], [1, 1, -1, 1.6, 0.85, 0.9],
];
const WAVE = (x, z, t) => 0.022 * Math.sin(x * 0.9 + t * 0.8) + 0.016 * Math.sin(z * 1.3 - t * 0.6) + 0.01 * Math.sin((x + z) * 2.1 + t * 1.7);

export const SKINS = {
  day: { sea: 0x3f8db4, slab: 0xcfe7e1, lit: 0xffe39a, dark: 0xd98a78, hint: 0xf2c14e, rock: 0x77716a, rockHi: 0x8c857b, tower: 0xf4efe2, band: 0xb5432f, lamp: 0xffd98a, cap: 0x3b4a58, buoy: 0xf4efe2,
    beam: 0xffe9a0, beamA: 0.3, comet: 0xfff6d0, cometA: 0.55, hemi: 1.15, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.3, exposure: 1.0, clash: 0xd0422e,
    haze: 0xd3e4ea, skyTop: 0x86b8de, cliff: 0x7b7168, hull: 0x5b3e2d, sail: 0xf3ecd9, cloth: 0xc4533a },
  night: { sea: 0x1d4361, slab: 0x7da3b3, lit: 0xf1cf78, dark: 0xb86a58, hint: 0xf4cf6a, rock: 0x8d877d, rockHi: 0xa29c91, tower: 0xe8e3d4, band: 0xc9543c, lamp: 0xffe29a, cap: 0x2a3644, buoy: 0xe8e3d4,
    beam: 0xffe08a, beamA: 0.42, comet: 0xfff1bd, cometA: 0.7, hemi: 0.95, sky: 0x9fb2d6, ground: 0x14202c, key: 0xb9cbef, keyI: 1.5, exposure: 1.1, clash: 0xe8705a,
    haze: 0x3a5c82, skyTop: 0x0c1a30, cliff: 0x59606b, hull: 0x7a5640, sail: 0xd9d3c0, cloth: 0xa8483a },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { night, ...SKINS[night ? "night" : "day"] };
}

export function createModel(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "lan3-gl";
  const labels = document.createElement("div");
  labels.className = "lan3-labels";
  host.replaceChildren(canvas, labels);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Bridges' is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);

  const solid = (extra = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, flatShading: true, ...extra });
  const glass = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const M = {
    sea: solid({ color: 0x3f8db4, roughness: 0.55, metalness: 0.05 }), slab: solid({ color: 0xffffff }), rock: solid({ color: 0xffffff }),
    tower: solid({ color: 0xffffff }), band: solid({ color: 0xb5432f }), cap: solid({ color: 0x3b4a58 }), buoy: solid({ color: 0xf4efe2 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a }), beam: glass(0xffe9a0, 0.3), comet: glass(0xfff6d0, 0.55),
    cliff: solid({ color: 0xffffff, vertexColors: true, roughness: 0.95 }), hull: solid({ color: 0x5b3e2d }), sail: solid({ color: 0xffffff, side: 2 }),
  };
  // the sky: a dome that follows the camera, haze at the rim fading up to the sky's colour; the sea's fog is the haze's colour, so the water melts into it
  const SKY_R = 100, skyGeo = new THREE.SphereGeometry(SKY_R, 16, 10);
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(skyGeo.attributes.position.count * 3, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: 1, depthWrite: false, depthTest: false, fog: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  // the bundle has no Fog class; the renderer only asks a fog for these
  scene.fog = { isFog: true, color: new THREE.Color(0xd3e4ea), near: 20, far: 60 };
  const paintSky = k => {
    const c = skyGeo.attributes.color, p = skyGeo.attributes.position, lo = new THREE.Color(k.haze), hi = new THREE.Color(k.skyTop), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { t.copy(lo).lerp(hi, Math.pow(Math.max(0, p.getY(i) / SKY_R), 0.55)); c.setXYZ(i, t.r, t.g, t.b); }
    c.needsUpdate = true;
  };
  const MA = new THREE.Matrix4(), MB = new THREE.Matrix4(), QA = new THREE.Quaternion(), VA = new THREE.Vector3(), VB = new THREE.Vector3(), CA = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  // ---------- the world: rebuilt for each puzzle ----------
  let N = 0, black = null, size = 0, world = null, sea = null, seaTop = [], slabs = null, rocks = null, chips = [];
  let towers = null, bands = null, lamps = null, caps = null, buoys = null, beams = null, comets = null;
  let cliffs = [], ships = [], shipParts = null, shipPose = null, HALF = 60, ZMIN = -59, ZMAX = 18;   // the strait runs ±HALF; ships sail from ZMIN (in the haze) to ZMAX (below the frame)
  let marks = "", br = null, hint = null, fitPts = [], lightList = [], runs = [];   // what is on show
  const disposeWorld = () => {
    if (world) { scene.remove(world); world.traverse(o => o.geometry?.dispose()); }
    world = sea = slabs = rocks = towers = bands = lamps = caps = buoys = beams = comets = shipParts = null;
    cliffs = []; ships = [];
    labels.replaceChildren();
    chips = [];
  };
  /** A rock's look from its cell: the same every time, a little different from its neighbours'. */
  const jitter = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  function build(puzzle) {
    disposeWorld();
    N = puzzle.size; size = N;
    black = Uint8Array.from(puzzle.grid, ch => (ch === "." ? 0 : 1));
    world = new THREE.Group();
    scene.add(world);
    // the sea: a long channel through the middle of the scene, its top moving gently, running off in the fog at both ends
    HALF = N / 2 + 52; ZMIN = 1 - HALF; ZMAX = N / 2 + 13;
    const wide = N + 40, sg = new THREE.BoxGeometry(wide, 0.5, HALF * 2, Math.ceil(wide / 1.0), 1, Math.ceil((HALF * 2) / 1.2)), sp = sg.attributes.position;
    seaTop = [];
    for (let i = 0; i < sp.count; i++) if (sp.getY(i) > 0) seaTop.push(i);
    sg.translate(0, -0.25 - SLAB, 0);
    sea = new THREE.Mesh(sg, M.sea);
    sea.frustumCulled = false;
    world.add(sea);
    // a shoal under every white cell, a rock on every black one
    const whites = [], blacks = [];
    for (let x = 0; x < N * N; x++) (black[x] ? blacks : whites).push(x);
    slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, SLAB + 0.1, 0.92), M.slab, Math.max(1, whites.length));
    slabs.count = whites.length;
    slabs.userData.cells = whites;
    whites.forEach((x, i) => { const [cx, cz] = cellXZ(N, x); slabs.setMatrixAt(i, MA.makeTranslation(cx, -0.05 - SLAB / 2 + 0.06, cz)); slabs.setColorAt(i, CA.set(0xffffff)); });
    world.add(slabs);
    rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), M.rock, Math.max(1, blacks.length * 2));
    rocks.count = blacks.length * 2;
    blacks.forEach((x, i) => {
      const [cx, cz] = cellXZ(N, x);
      for (let k = 0; k < 2; k++) {
        const s = k ? 0.5 + jitter(x, 3) * 0.2 : 0.82 + jitter(x, 1) * 0.12, h = k ? 0.5 : 0.7 + jitter(x, 2) * 0.2;
        QA.setFromAxisAngle(UP, jitter(x, 4 + k) * 6.28);
        MA.compose(VA.set(cx + (k ? (jitter(x, 5) - 0.5) * 0.3 : 0), h * 0.5 - 0.02 + (k ? 0.18 : 0), cz + (k ? (jitter(x, 6) - 0.5) * 0.3 : 0)), QA, VB.set(s, h, s));
        rocks.setMatrixAt(i * 2 + k, MA);
        rocks.setColorAt(i * 2 + k, CA.set(k ? 0xd9d4ca : 0xffffff));
      }
      if (puzzle.grid[x] !== "#") {
        const chip = document.createElement("div");
        chip.className = "lan3-n";
        chip.textContent = puzzle.grid[x];
        labels.appendChild(chip);
        chips.push({ el: chip, x, p: new THREE.Vector3(cx, 0.98, cz), w: 0, h: 0 });
      }
    });
    world.add(rocks);
    buildCliffs(puzzle.grid);
    buildShips();
    // lighthouses: up to one on every white cell (shown or hidden by the marks); each is four pieces
    const cap = Math.max(1, whites.length);
    towers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.19, 0.3, TOWER, 14), M.tower, cap);
    bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.235, 0.265, 0.2, 14), M.band, cap);
    lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 12), M.lamp, cap);
    caps = new THREE.InstancedMesh(new THREE.ConeGeometry(0.25, 0.22, 14), M.cap, cap);
    buoys = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), M.buoy, cap);
    for (const m of [towers, bands, lamps, caps, buoys]) { m.count = 0; m.frustumCulled = false; world.add(m); }
    beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), M.beam, cap * 4);
    comets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.03, 1), M.comet, cap * 4);
    for (const m of [beams, comets]) { m.count = 0; m.frustumCulled = false; world.add(m); }
    const h = N / 2 + 0.12;
    fitPts = [];
    for (const y of [-0.1, 1.15]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) fitPts.push(sx * (h + SIDE), y, sz * h);
    marks = ""; br = null; hint = null;
    applySkin();
    resize();
  }

  // ---------- the cliffs: rock massifs down both sides of the channel ----------
  const hash3 = (x, y, z, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.19) * 43758.5453; return v - Math.floor(v); };
  const corner = (p, i) => [Math.round(p.getX(i) * 400), Math.round(p.getY(i) * 400), Math.round(p.getZ(i) * 400)];
  /** One kind of rock: a lumpy low-poly mass (0 boulder, 1 crag, 2 shelf, 3 spire), shaded dark at the foot and light at the top. */
  function crag(kind) {
    let g = kind === 3 ? new THREE.CylinderGeometry(0.1, 1, 2, 6, 3) : new THREE.IcosahedronGeometry(1, 1);
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position, col = new Float32Array(p.count * 3), height = [];
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const j = 0.76 + 0.46 * hash3(...corner(p, i), kind);     // the same lump wherever a corner is shared
      if (kind === 1) { const f = 1 - 0.38 * Math.max(0, y); x *= f; z *= f; y *= 1.7; }
      else if (kind === 2) { x *= 1.35; z *= 1.1; y *= 0.55; }
      else if (kind === 0) y *= 0.85;
      x *= j; z *= j; y = Math.max(-0.4, y * (kind === 3 ? 0.8 + 0.4 * j : j));
      p.setXYZ(i, x, y, z);
      height.push(y);
    }
    const hi = Math.max(...height);
    for (let i = 0; i < p.count; i++) {
      const sh = 0.7 + 0.42 * Math.min(1, Math.max(0, (height[i] + 0.4) / (hi + 0.4))) + 0.07 * hash3(...corner(p, i), 9);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = sh;
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  /** The cliffs of this puzzle (the same for the same puzzle): three rows of rock a side, low at the water, high behind. */
  function buildCliffs(seedText) {
    let a = 0;
    for (let i = 0; i < seedText.length; i++) a = (Math.imul(a, 31) + seedText.charCodeAt(i)) | 0;
    const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const rows = [
      { step: 1.9, off: 0, r: [1.3, 2.3], h: [0.8, 1.6], kinds: [0, 0, 2, 2, 1] },
      { step: 2.7, off: 3.2, r: [1.9, 3.0], h: [1.2, 2.1], kinds: [0, 1, 1, 3, 2] },
      { step: 3.8, off: 7.2, r: [2.8, 4.2], h: [1.3, 2.1], kinds: [1, 1, 3, 3, 0] },
    ];
    const lists = [[], [], [], []];
    for (const side of [-1, 1]) {
      const ph = side < 0 ? 0 : 2.1, edge = z => N / 2 + 4.0 + 0.6 * Math.sin(z * 0.19 + 1.3 + ph) + 0.3 * Math.sin(z * 0.43 + ph * 2);     // the channel wanders a little
      for (const row of rows) for (let z = -HALF - 4; z <= HALF + 4; z += row.step * (0.8 + 0.4 * rnd())) {
        const r = row.r[0] + (row.r[1] - row.r[0]) * rnd(), sx = r * (0.9 + 0.4 * rnd()), sz = r * (0.9 + 0.4 * rnd()), sy = r * (row.h[0] + (row.h[1] - row.h[0]) * rnd());
        const kind = row.kinds[Math.floor(rnd() * row.kinds.length)];
        lists[kind].push({ x: side * (edge(z) + sx * 1.25 + row.off + (rnd() - 0.5) * 0.8), y: 0.3 * sy - 0.1, z, rot: rnd() * 6.28, sx, sy, sz, tint: 0.85 + 0.3 * rnd() });
      }
    }
    lists.forEach((list, kind) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(crag(kind), M.cliff, list.length);
      list.forEach((c, i) => m.setMatrixAt(i, MA.compose(VA.set(c.x, c.y, c.z), QA.setFromAxisAngle(UP, c.rot), VB.set(c.sx, c.sy, c.sz))));
      m.frustumCulled = false;
      m.userData.tints = list.map(c => c.tint);
      world.add(m);
      cliffs.push(m);
    });
  }
  const paintCliffs = k => { for (const m of cliffs) { m.userData.tints.forEach((t, i) => m.setColorAt(i, CA.set(k.cliff).multiplyScalar(t))); m.instanceColor.needsUpdate = true; } };

  // ---------- the ships: cogs in lanes beside the board, some sailing each way, a few meshes in all ----------
  function buildShips() {
    const hullG = new THREE.BoxGeometry(0.46, 0.22, 1.3), hp = hullG.attributes.position;
    for (let i = 0; i < hp.count; i++) {                      // the bow narrows and rises, the keel is narrower than the deck
      const z = hp.getZ(i), y = hp.getY(i);
      let x = hp.getX(i);
      if (z > 0) { x *= 1 - 0.85 * (z / 0.65); hp.setY(i, y + 0.07 * (z / 0.65)); }
      if (y < 0) x *= 0.7;
      hp.setX(i, x);
    }
    const piece = (g, mat, n) => { const m = new THREE.InstancedMesh(g, mat, n); m.frustumCulled = false; world.add(m); return m; }, n = SHIPS.length;
    shipParts = {
      hull: piece(hullG, M.hull, n),
      castle: piece(new THREE.BoxGeometry(0.4, 0.17, 0.4), M.hull, n),
      mast: piece(new THREE.CylinderGeometry(0.022, 0.03, 1.15, 6), M.hull, n),
      sail: piece(new THREE.BoxGeometry(1, 1, 0.03), M.sail, n * 2),
    };
    // where each piece sits on a ship (its bow is +z)
    const at = (x, y, z, sx = 1, sy = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, 1));
    shipPose = { hull: [at(0, 0.06, 0)], castle: [at(0, 0.24, -0.5)], mast: [at(0, 0.7, 0.05)], sail: [at(0, 0.78, 0.1, 0.8, 0.5), at(0, 1.18, 0.1, 0.52, 0.28)] };
    ships = SHIPS.map(([side, lane, way, speed, from, size], i) => ({ x: side * (N / 2 + LANE0 + lane * LANE_GAP), way, speed, from, s: from, size, ph: i * 1.7, cloth: i % 3 === 1 }));
  }
  const QY = new THREE.Quaternion(), QP = new THREE.Quaternion(), QR = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1), MS = new THREE.Matrix4();
  /** Put every ship at its place along the channel, bobbing on the water; small at either end, where it is out of sight in the haze. */
  function sail(t) {
    if (!shipParts) return;
    const span = ZMAX - ZMIN;
    ships.forEach((sh, i) => {
      const z = sh.way > 0 ? ZMIN + sh.s * span : ZMAX - sh.s * span, k = Math.min(1, Math.max(0.001, Math.min(z - ZMIN, ZMAX - z) / 6)) * sh.size;
      QA.copy(QY.setFromAxisAngle(UP, sh.way > 0 ? 0 : Math.PI)).multiply(QP.setFromAxisAngle(AX, 0.03 * Math.sin(t * 1.3 + sh.ph))).multiply(QR.setFromAxisAngle(AZ, 0.05 * Math.sin(t * 1.7 + sh.ph)));
      MS.compose(VA.set(sh.x, WAVE(sh.x, z, t) + 0.01, z), QA, VB.set(k, k, k));
      for (const key of ["hull", "castle", "mast"]) shipParts[key].setMatrixAt(i, MA.multiplyMatrices(MS, shipPose[key][0]));
      shipPose.sail.forEach((pm, j) => shipParts.sail.setMatrixAt(i * 2 + j, MA.multiplyMatrices(MS, pm)));
    });
    for (const m of Object.values(shipParts)) m.instanceMatrix.needsUpdate = true;
  }
  /** The ships sail on by `dt` seconds (a pause gives none, so they stand still with the menu). */
  function advanceShips(dt) {
    const span = ZMAX - ZMIN;
    for (const sh of ships) sh.s = (sh.s + (sh.speed * dt) / span) % 1;
  }
  const paintShips = k => {
    if (!shipParts) return;
    ships.forEach((sh, i) => { for (let j = 0; j < 2; j++) shipParts.sail.setColorAt(i * 2 + j, CA.set(sh.cloth && j === 0 ? k.cloth : k.sail)); });
    shipParts.sail.instanceColor.needsUpdate = true;
  };

  // ---------- what the marks show ----------
  /** Lanterns, buoys (a dot is a cell with no lantern) and beams, and the colour of each shoal. */
  function refresh() {
    if (!world) return;
    const k = skinNow(), whites = slabs.userData.cells, lit = br?.lit, hinted = new Set(hint?.set || []), why = new Set(hint?.focus || []);
    const clash = new Set(br?.clash || []), dark = new Set(br?.dark || []);
    lightList = []; runs = [];
    let nb = 0;
    whites.forEach((x, i) => {
      const m = marks[x];
      CA.set(hinted.has(x) ? k.hint : why.has(x) ? k.hint : dark.has(x) ? k.dark : lit?.[x] ? k.lit : k.slab);
      if (why.has(x) && !hinted.has(x)) CA.lerp(new THREE.Color(k.slab), 0.45);
      slabs.setColorAt(i, CA);
      if (m === "1") { lightList.push(x); runs.push(runsFrom(N, black, x)); }
      else if (m === "2") { const [cx, cz] = cellXZ(N, x); buoys.setMatrixAt(nb++, MA.makeTranslation(cx, 0.1, cz)); }
    });
    slabs.instanceColor.needsUpdate = true;
    buoys.count = nb;
    buoys.instanceMatrix.needsUpdate = true;
    const n = lightList.length;
    towers.count = bands.count = lamps.count = caps.count = n;
    lightList.forEach((x, i) => {
      const [cx, cz] = cellXZ(N, x), bad = clash.has(x);
      towers.setMatrixAt(i, MA.makeTranslation(cx, TOWER / 2 - 0.02, cz));
      bands.setMatrixAt(i, MA.makeTranslation(cx, TOWER * 0.5, cz));
      lamps.setMatrixAt(i, MA.makeTranslation(cx, TOWER - 0.02 + 0.08, cz));
      caps.setMatrixAt(i, MA.makeTranslation(cx, TOWER - 0.02 + 0.27, cz));
      towers.setColorAt(i, CA.set(bad ? k.clash : k.tower));
    });
    for (const m of [towers, bands, lamps, caps]) m.instanceMatrix.needsUpdate = true;
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    // the beams: a pale strip along each run, on the water a little over the shoals
    let b = 0;
    lightList.forEach((x, i) => {
      const [cx, cz] = cellXZ(N, x), r = runs[i];
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dz], d) => {
        const len = r[d];
        if (!len) return;
        MA.compose(VA.set(cx + (dx * (len + 0.5)) / 2, 0.09, cz + (dz * (len + 0.5)) / 2), QA.identity(), VB.set(dx ? len + 0.5 : 0.32, 1, dz ? len + 0.5 : 0.32));
        beams.setMatrixAt(b++, MA);
      });
    });
    beams.count = b;
    beams.instanceMatrix.needsUpdate = true;
    placeChips(true);
    wake();
  }
  function paintChips() {
    const over = new Set(br?.over || []), short = new Set(br?.short || []), done = new Set(br?.done || []), why = new Set(hint?.focus || []);
    for (const c of chips) {
      const cls = `lan3-n${over.has(c.x) || short.has(c.x) ? " over" : done.has(c.x) ? " met" : ""}${why.has(c.x) ? " why" : ""}`;
      if (c.el.className !== cls) c.el.className = cls;
    }
  }

  // ---------- the camera: round the board under a finger ----------
  let width = 1, height = 1, rem = 16, az = HOME_AZ, el = homeElevation(1), dist = 14, fitDist = 14, spinUntil = 0, orbited = false, zoom = 1, camDirty = true, measure = true;
  const pan = { x: 0, z: 0 }, LOOK = new THREE.Vector3(0, 0.2, 0);
  function pose() {
    LOOK.set(pan.x, 0.2, pan.z);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    sky.position.copy(camera.position);
    scene.fog.near = dist + size * 0.3 + 1;                  // the board and the water round it are clear, the far strait goes to haze
    scene.fog.far = scene.fog.near + 32;
  }
  function fit() {
    if (!size) return;
    const aspect = width / height, ty = Math.tan(FOV / 2), tx = ty * aspect, near = 0.5, top = near * ty, right = top * aspect, pad = 0.4 * rem;
    fitDist = Math.max(4, fitDistance(fitPts, az, el, [0, 0.2, 0], tx, ty, (2 * pad) / width, (2 * pad) / height));
    const far = Math.max(180, fitDist + size * 2 + 130);
    dist = fitDist / zoom;
    pose();
    // the board fills the width, and a tall card has room above and below it: slide the frame up (the view stays the same, only the frame moves) until
    // the board's near edge is at the bottom, so the far strait and its haze fill the top
    let lowest = 0;
    for (let i = 0; i < fitPts.length; i += 3) { VA.set(fitPts[i], fitPts[i + 1], fitPts[i + 2]).applyMatrix4(camera.matrixWorldInverse); lowest = Math.min(lowest, VA.y / -VA.z); }
    const lift = Math.max(0, Math.min(1.1 * ty, lowest + ty - 0.12));
    camera.projectionMatrix.makePerspective(-right, right, top + near * lift, -top + near * lift, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camDirty = true;
    const D = size * 2 + 8, la = az - 0.7, le = Math.min(el + 0.4, 1.2);
    sun.position.set(Math.sin(la) * Math.cos(le) * D, Math.sin(le) * D, Math.cos(la) * Math.cos(le) * D);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    if (!orbited) el = homeElevation(width / height);
    fit();
    measure = true;
    wake();
  }
  function applySkin() {
    const k = skinNow();
    M.sea.color.set(k.sea); M.band.color.set(k.band); M.cap.color.set(k.cap); M.buoy.color.set(k.buoy); M.lamp.color.set(k.lamp);
    M.beam.color.set(k.beam); M.beam.opacity = k.beamA; M.comet.color.set(k.comet); M.comet.opacity = k.cometA;
    M.rock.color.set(k.rock); M.slab.color.set(0xffffff); M.tower.color.set(0xffffff); M.hull.color.set(k.hull);
    scene.fog.color.set(k.haze);
    paintSky(k); paintCliffs(k); paintShips(k);
    hemi.color.set(k.sky); hemi.groundColor.set(k.ground); hemi.intensity = k.hemi;
    sun.color.set(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    refresh();
  }
  /** The number chips follow the camera: whole pixels (a number between two pixels is a blur), the nearer over the farther. */
  function placeChips(force) {
    if (!chips.length || !(camDirty || force || measure)) return;
    const ppu = (height / 2) / (dist * Math.tan(FOV / 2)), k = Math.round(Math.max(0.75, Math.min(1.3, (0.55 * ppu) / (1.2 * rem))) * 20) / 20;
    if (labels.style.getPropertyValue("--k") !== String(k)) { labels.style.setProperty("--k", String(k)); measure = true; }
    if (measure) { for (const c of chips) { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; } measure = false; }
    paintChips();
    for (const c of chips) {
      VA.copy(c.p).project(camera);
      c.el.style.transform = `translate(${Math.round(((VA.x + 1) / 2) * width - c.w / 2)}px, ${Math.round(((1 - VA.y) / 2) * height - c.h / 2)}px)`;
      c.el.style.zIndex = String(2000 - Math.round(camera.position.distanceTo(c.p) * 20));
    }
    camDirty = false;
  }

  // ---------- drawing: only while it is shown and not paused ----------
  let shown = false, held = false, frameId = 0, winUntil = 0, lastT = performance.now();
  const t0 = performance.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let drawn = 0;
  function draw(now) {
    if (!world) return;
    const t = still ? 0 : (now - t0) / 1000, dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (spinUntil > now) { az += 0.35 * dt; fit(); }
    if (!still) advanceShips(dt);
    sail(t);
    const sp = sea.geometry.attributes.position;
    for (const i of seaTop) sp.setY(i, WAVE(sp.getX(i), sp.getZ(i), t));
    sp.needsUpdate = true;
    // the lamp room turns, and a patch of light sweeps out along each beam, a little behind its neighbour's
    const winning = winUntil > now;
    let c = 0;
    lightList.forEach((x, i) => {
      const [cx, cz] = cellXZ(N, x), r = runs[i];
      MA.makeRotationY(t * 1.6 + i);
      MA.setPosition(cx, TOWER - 0.02 + 0.27, cz);
      caps.setMatrixAt(i, MA);
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dz], d) => {
        const len = r[d];
        if (!len) return;
        const reach = len + 0.5, at = still ? 0.5 * reach + 0.45 : (t * 1.8 + i * 0.37 + d * 0.21) % (reach + 0.9);
        const end = Math.min(at, reach), start = Math.max(0, at - 0.9), seg = Math.max(0.05, end - start), mid = (start + end) / 2;
        MA.compose(VA.set(cx + dx * mid, 0.11, cz + dz * mid), QA.identity(), VB.set(dx ? seg : 0.2, 1, dz ? seg : 0.2));
        comets.setMatrixAt(c++, MA);
      });
    });
    comets.count = c;
    comets.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    M.beam.opacity = skinNow().beamA * (winning ? 1.6 : 1);
    if (winUntil && now > winUntil) winUntil = 0;
    if (camDirty || measure) placeChips();
    renderer.render(scene, camera);
    drawn++;
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    draw(now);
    if (!still || spinUntil > now) frameId = requestAnimationFrame(frame);
  }
  /** Something happened (a touch, a change of the marks): draw at full rate for a moment, and again once if the player asked for less motion. */
  function wake() {
    if (!shown || held || !world) return;
    if (still) draw(performance.now());
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  // ---------- which cell a finger means ----------
  /** The point of the plane y = `y` under a pixel of the canvas. */
  function groundAt(sx, sy, y = 0) {
    VA.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, t = (y - o.y) / (VA.y - o.y);
    return { x: o.x + (VA.x - o.x) * t, z: o.z + (VA.z - o.z) * t };
  }
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  /** The white cell under the page's point (a tower is met at its lamp as well as its foot), or −1. */
  function cellUnder(cx, cy) {
    if (!world) return -1;
    const [sx, sy] = canvasPoint(cx, cy);
    for (const y of [TOWER * 0.55, 0]) {          // the middle of a tower first: it hides the cell behind it
      const p = groundAt(sx, sy, y), x = cellAtGround(N, p.x, p.z);
      if (x >= 0 && !black[x] && (y === 0 || marks[x] === "1")) return x;
    }
    return -1;
  }
  const shoalAt = cellUnder;
  function clampPan() { const lim = (size / 2) * (1 - 1 / zoom) + 0.5; pan.x = Math.max(-lim, Math.min(lim, pan.x)); pan.z = Math.max(-lim, Math.min(lim, pan.z)); }
  function zoomAt(z, cx, cy) {
    if (!world) return;
    const [sx, sy] = cx == null ? [width / 2, height / 2] : canvasPoint(cx, cy), before = groundAt(sx, sy, 0.2);
    zoom = Math.max(1, Math.min(MAX_ZOOM, z));
    fit();
    if (zoom === 1) { pan.x = pan.z = 0; } else { const after = groundAt(sx, sy, 0.2); pan.x += before.x - after.x; pan.z += before.z - after.z; clampPan(); }
    fit(); wake();
  }
  function reset() { zoom = 1; pan.x = pan.z = 0; orbited = false; orbit(HOME_AZ, homeElevation(width / height)); }
  function orbit(a, e) { az = a; el = Math.max(MIN_EL, Math.min(MAX_EL, e)); fit(); wake(); }
  const playable = () => !!opts.playable?.();
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }, { passive: false });
  const fingers = new Map();
  let pinch = null, g = null, lastTap = null;
  const pinchNow = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  canvas.addEventListener("pointerdown", e => {
    if (e.button === 2) { const x = playable() ? cellUnder(e.clientX, e.clientY) : -1; if (x >= 0) opts.press?.(x, "hold"); return; }
    if (e.button > 0) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g && fingers.size === 2 && !pinch) {
      clearTimeout(g.timer); g.turning = true;
      const { d, mx, my } = pinchNow();
      pinch = { d0: d, zoom0: zoom, anchor: groundAt(...canvasPoint(mx, my), 0.2) };
      return;
    }
    if (g) return;
    const cell = playable() ? cellUnder(e.clientX, e.clientY) : -1;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, cell, turning: false, held: false, timer: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    if (cell < 0) return;
    g.timer = setTimeout(() => {
      if (!g || g.turning) return;
      g.held = true;
      navigator.vibrate?.(14);
      opts.press?.(g.cell, "hold");
    }, HOLD);
  });
  canvas.addEventListener("pointermove", e => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size === 2) {
      const { d, mx, my } = pinchNow();
      zoom = Math.max(1, Math.min(MAX_ZOOM, pinch.zoom0 * (d / pinch.d0)));
      fit();
      if (zoom === 1) pan.x = pan.z = 0; else { const now = groundAt(...canvasPoint(mx, my), 0.2); pan.x += pinch.anchor.x - now.x; pan.z += pinch.anchor.z - now.z; clampPan(); }
      fit(); wake();
      return;
    }
    if (!g || e.pointerId !== g.id) return;
    if (!g.turning) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) <= SLIP) return;
      g.turning = true;
      clearTimeout(g.timer);
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
    clearTimeout(g.timer);
    const { cell, turning, held: wasHeld } = g, now = performance.now();
    g = null;
    if (e.type === "pointercancel" || turning || wasHeld) return;
    if (cell >= 0) { lastTap = null; opts.press?.(cell, "tap"); return; }
    if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; reset(); } else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.style.touchAction = "none";
  const zoomBox = document.createElement("div");
  zoomBox.className = "lan3-zoom";
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
  resize();

  return {
    canvas,
    /** A new puzzle: { size, grid }. */
    set: build,
    /** The run's marks, what they break (breaks() of the engine) and the hint showing ({ set, focus } or null). */
    update(m, broken, h) { marks = m; br = broken; hint = h; refresh(); },
    show(on) { shown = !!on; if (shown) { resize(); wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    hold(on) { held = !!on; if (held && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); },
    /** After a win: the board turns slowly for a few seconds and the beams brighten. */
    spin(ms = 7000) { spinUntil = performance.now() + ms; winUntil = performance.now() + 3200; wake(); },
    orbit, reset,
    get angles() { return [az, el]; },
    get view() { return { zoom, x: pan.x, z: pan.z }; },
    zoomTo(z, cx, cy) { zoomAt(z, cx, cy); },
    /** For tests: the page's (clientX, clientY) of cell `x`'s middle, as a finger would tap it. */
    where(x, y = 0) {
      const [cx, cz] = cellXZ(N, x), r = canvas.getBoundingClientRect();
      VA.set(cx, y, cz).project(camera);
      return { x: r.left + ((VA.x + 1) / 2) * r.width, y: r.top + ((1 - VA.y) / 2) * r.height };
    },
    pick: cellUnder,
    shoalAt,
    get live() { return { ships: ships.length, cliffs: cliffs.reduce((n, m) => n + m.count, 0), lanterns: lightList.length, buoys: buoys?.count || 0, beams: beams?.count || 0, chips: chips.length, shown, frames: drawn }; },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeWorld(); skyGeo.dispose(); renderer.dispose(); },
  };
}
