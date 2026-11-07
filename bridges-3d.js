// Bridges as a model, drawn with three.js (vendor/three.js, kept on the device, so it works offline): the chart's islands as
// a relief map's, each as big as its number (a one is an islet, an eight nearly fills its cell) with a beach, grass and trees,
// hills in terraces like contour lines, timber bridges arched over their trestles with railings (up to three side by side on a
// wide road, a post each side of a narrow one's middle), a viaduct as a stone arcade with a parapet high over the low bridges, a
// strait as a line of buoys with its number on a plate, and on the water, slowly, seventeenth-century merchantmen sailing through
// whatever water is free (bridges-model.js: they go round what the player builds, and under a viaduct's arches). It is the puzzle, played: a dashed guide lies on every link without a
// bridge, a tap on a link calls the page's press(link, "tap") and a hold press(link, "hold") (the page builds, cycles and
// clears, as on the chart), a drag turns the board, two fingers (or the wheel, or the + and − beside it) zoom in and pan, and a
// hint's link glows gilt. Which link a finger means is worked out in
// bridges-model.js (the links as the screen shows them, the nearest wins), tested in Node.
// The page calls set(layout, grid, …) for a new puzzle and update(marks, breaks, hint) after a change. The whole board is a
// handful of draw calls (bridges-batch.js): every island, every bridge a link may have (a single, a double, a triple), every
// link's dashes and glows are built once into a few meshes with a colour on each vertex, and a change of the marks only chooses
// which of their vertices are drawn; the ships and buoys are instances of one piece each. The shadows are drawn again only when
// something that casts one changes. It draws only while it is on screen and nothing has paused it (the menu, a hidden tab): thirty
// frames a second while the player is doing something, fifteen when the sea and the ships are all that move.
// Throws where there is no WebGL (the page then keeps the chart).
import * as THREE from "./vendor/three.js";
import { createBatch, prep } from "./bridges-batch.js";
import { coastOf, TAU } from "./bridges-coast.js";
import { straitLine, boxOf } from "./bridges-lattice.js";
import { cellXZ, spanOf, frameTurn, labelOf, seaOf, createFleet, shipsFor, piersOf, wallOutline, linkLine, pickLink, pickTolerance, islandRadius, deckProfile, fitDistance, homeElevation } from "./bridges-model.js";

const DEG = Math.PI / 180;
const DOUBLE_SIDE = 2;                           // THREE.DoubleSide (not in the bundle's exports)
const MIN_EL = 30 * DEG, MAX_EL = 80 * DEG, FOV = 30 * DEG;   // not lower: from the side the hills hide the links behind them
const HOME_AZ = 32 * DEG;                       // the first view's turn; its elevation follows the card's shape (homeElevation)
const MAX_ZOOM = 3.6;                           // how far in: the board's fit is 1
const HOLD = 430, SLIP = 9;                     // ms a press takes to clear a link (as on the chart), and the pixels a finger may stray and still tap
const BUSY_MS = 1000 / 30, CALM_MS = 1000 / 15, BUSY_FOR = 1400;   // the time between frames while something is being done, and when nothing is, and how long a doing counts
const DECK = 0.17, VIADUCT = 0.8;               // the heights of a low bridge's deck and of the top of a viaduct
const GUIDE = 0.09, GUIDE_HIGH = VIADUCT + 0.02;  // the dashes on a link without a bridge lie a little over the swell (a viaduct's in the air where it would stand)
const WAVE = (x, z, t) => 0.028 * Math.sin(x * 0.9 + t * 0.8) + 0.02 * Math.sin(z * 1.3 - t * 0.6) + 0.012 * Math.sin((x + z) * 2.1 + t * 1.7);
const HOME_LOOK = [0, 0.15, 0];                 // what the camera looks at when the whole board is in view

// ---------- the skins ----------
// Two realms (docs/bridges.md, "The two realms' language"): blue islands are round and have white decks with blue rails, orange islands are
// square-cut clay with orange decks and a double dark rail; each has a collar of its colour round its foot, gilded once its number is met.
// The colours are chosen for the sea and the timber they stand on and for colour-blind eyes (tests/bridges-look.mjs measures them): never
// retune one by eye. A gilt rim round the collar says an island's number is met.
export const REALMS = {
  day: { collar0: 0x17408c, collar1: 0xf07a14, deck0: 0xeaf1f8, deck1: 0xe8691a, rail0: 0x174a94, rail1: 0x4a1f06, rim: 0xe6b93a, clay: 0xd0601c, clay0: 0xe27a32, clay1: 0xc9622a, clay2: 0xa84c1e },
  night: { collar0: 0x6aaeee, collar1: 0xffa14a, deck0: 0xd6e3f0, deck1: 0xde6c16, rail0: 0x2c68bc, rail1: 0x5e2c0e, rim: 0xf4cf6a, clay: 0xe08848, clay0: 0xee9a58, clay1: 0xd98446, clay2: 0xb86b34 },
};
export const SHORE = {
  day: { cSand: 0xe2d2a4, cliff: 0x8c8068, cliffHi: 0x9c8f76, grass: 0x7d9c5a, grassHi: 0x6e8d52, hill: 0x587a48, rock: 0x7b756a, pine: 0x3c6a3e, white: 0xf1ece0, red: 0xb5432f },
  night: { cSand: 0xb4a98a, cliff: 0x7a7060, cliffHi: 0x877c69, grass: 0x5f7a4a, grassHi: 0x546d42, hill: 0x45603f, rock: 0x6c675f, pine: 0x34583a, white: 0xd9d5c8, red: 0xa04230 },
};
export const MODES = {
  day: { sea: 0x3f8db4, sand: 0xe6d6ab, hill: [0xd8c28f, 0xc4a870, 0xa98b55], timber: 0x9a6a3b, stone: 0xd9d0bc, deck: 0xbfb394, guide: 0xffffff, guideA: 0.62, hemi: 1.15, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.5, exposure: 1.0, lantern: false, grass: 0x8fae62, tree: 0x4d7a45, shallow: 0xb9e6e3, shallowA: 0.42, rail: 0x6b4a2b, realm: REALMS.day, shore: SHORE.day },
  // by night the timber and stone are lighter than the day's, or they sink into the dark sea
  night: { sea: 0x3a6684, sand: 0xbdb292, hill: [0xb3a47c, 0x9d8e68, 0x857852], timber: 0xb5854d, stone: 0xcbc4b4, deck: 0xb0a995, guide: 0xdfeaf5, guideA: 0.5, hemi: 1.3, sky: 0xa5b4d2, ground: 0x1c2a38, key: 0xcfdcf6, keyI: 2.1, exposure: 1.1, lantern: true, grass: 0x6f8a55, tree: 0x3e6339, shallow: 0x8fb8c4, shallowA: 0.34, rail: 0x8a6439, realm: REALMS.night, shore: SHORE.night },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { night, ...MODES[night ? "night" : "day"] };
}
/** The colour of each role the batches name (bridges-batch.js) in a skin. */
export const palette = k => ({ sand: k.sand, h0: k.hill[0], h1: k.hill[1], h2: k.hill[2], timber: k.timber, stone: k.stone, deck: k.deck, grass: k.grass, tree: k.tree, rail: k.rail, trim: 0xc9a23c, teal: 0x1e7f8c, ...k.realm, ...k.shore });
const SHIP_COLORS = { hull: 0x6a4426, trim: 0xc9a23c, sail: 0xf0e6cc, flag: 0xb5432f };

/** An extruded outline: points [x, y] along and up, `depth` thick (centred on z = 0). */
function wall(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const PINE_TRUNK = prep(new THREE.CylinderGeometry(0.022, 0.03, 0.14, 5)), PINE_LOW = prep(new THREE.ConeGeometry(0.15, 0.34, 7)), PINE_HIGH = prep(new THREE.ConeGeometry(0.1, 0.28, 7));
const POST = prep(new THREE.BoxGeometry(0.02, 0.09, 0.02)), PILE = prep(new THREE.CylinderGeometry(0.02, 0.024, 1, 5)), BEAMS = {};     // a bridge's pieces, made once: a rail post, a trestle's pile (one unit high, stretched to fit) and its beam by the lane's width

/** Flat strips along a link in its own frame (from its first island along +x, `y` up), each [from, to, half width]. */
function strips(list, y, zoff = 0) {
  const pos = [], idx = [];
  for (const [x0, x1, hw] of list) { const n = pos.length / 3; pos.push(x0, y, zoff - hw, x1, y, zoff - hw, x0, y, zoff + hw, x1, y, zoff + hw); idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
/** A flat annulus in the y = 0 plane, facing up (the bundle has no RingGeometry). */
function flatRing(r0, r1, n) {
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), j = (i + 1) % n; pos.push(c * r0, 0, s * r0, c * r1, 0, s * r1); idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
/** One strip from x0 to x1 that follows a deck's arch (`hump` high over the deck that runs from `xa`, `len` long), `y0` above the water: the glow of a built bridge. */
function arched(x0, x1, hw, hump, xa, len, y0) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.2)), pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + hump * Math.sin(Math.PI * Math.max(0, Math.min(1, (x - xa) / len))); pos.push(x, y, -hw, x, y, hw); }
  for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
/** Where a low bridge's deck runs along its link (from the first island's middle): its ends tucked a little into the islands, and how high it arches. */
function lowSpan(a, b, span) {
  const xa = islandRadius(a.n) - 0.06, xb = span - islandRadius(b.n) + 0.06, len = xb - xa;
  return { xa, xb, len, hump: Math.max(0.04, Math.min(0.15, 0.035 * len)) };
}

/**
 * The model in `host`. Calls: set(puzzle) for a new puzzle (its layout `lay` and `size`), update(marks, br, hint)
 * when the bridges, the islands' state or the hint's link changed, show(on) to start or stop drawing, spin() after a win,
 * orbit(az, el) / angles for the camera, dispose(). `opts`: press(link, "tap" | "hold") is called for a finger on a link,
 * playable() says whether a finger may build now (not when it is won, paused, or only watching), blocked(link) whether no
 * bridge can go on the link (another crosses it), which makes it lose a close call. Together: island(i) is called for a tap on an
 * island, names(set) makes the plates of those islands say "?", and ping(i, { slot, soft, ms }) rings an island's plate.
 */
export function createModel(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;             // the shadows are drawn again when the sun moves or a bridge changes (shadowDirty), not every frame
  renderer.shadowMap.type = 1;                       // the plain PCF map
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "brg3-gl";
  const labels = document.createElement("div");
  labels.className = "brg3-labels";
  host.replaceChildren(canvas, labels);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Survey's is
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

  const solid = (extra = {}) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const M = {
    sea: solid({ color: 0x3f8db4, roughness: 0.55, metalness: 0.05 }), land: solid({ vertexColors: true }), ship: solid({ vertexColors: true, side: DOUBLE_SIDE }),
    buoyTeal: solid({ color: 0x1e7f8c }), buoyWhite: solid({ color: 0xf4efe2 }), lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
    shallow: new THREE.MeshBasicMaterial({ color: 0xb9e6e3, transparent: true, opacity: 0.4, depthWrite: false }),
    guide: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: DOUBLE_SIDE }),
    halo: new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.5, depthWrite: false, side: DOUBLE_SIDE }),
  };
  const MA = new THREE.Matrix4(), MB = new THREE.Matrix4();       // scratch: a frame allocates nothing

  // ---------- the sea ----------
  let sea = null, seaTop = [], seaSize = 0;
  function buildSea(half) {
    if (sea) { scene.remove(sea); sea.geometry.dispose(); }
    seaSize = 2 * half;                              // the coast's bay and a little over: the land hides the rest of the box, wherever the camera is
    const cuts = Math.max(24, Math.min(56, Math.ceil(seaSize / 0.6)));      // a swell is seven cells long at least: a cell of 0.6 draws it
    const g = new THREE.BoxGeometry(seaSize, 0.5, seaSize, cuts, 1, cuts), pos = g.attributes.position;
    seaTop = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) seaTop.push(i);
    g.translate(0, -0.25, 0);
    sea = new THREE.Mesh(g, M.sea);
    sea.receiveShadow = true;
    sea.frustumCulled = false;                       // its vertices move; it fills the view anyway
    scene.add(sea);
  }
  function stirSea(t) {
    if (!sea) return;
    const pos = sea.geometry.attributes.position;
    for (const i of seaTop) pos.setY(i, WAVE(pos.getX(i), pos.getZ(i), t));
    pos.needsUpdate = true;
  }

  // ---------- a ship: a hull from a side profile, three masts, square sails, a lateen on the mizzen, a flag; one geometry, drawn once for every ship ----------
  function shipGeometry() {
    const b = createBatch(), S = new THREE.Matrix4().makeScale(1.7, 1.7, 1.7), hullShape = new THREE.Shape();
    const put = (geo, role, x = 0, y = 0, z = 0) => b.add("ship", geo, at(x, y, z).premultiply(S), role);
    [[-0.3, 0.17], [-0.31, 0.02], [-0.24, -0.05], [0.14, -0.05], [0.31, 0.07], [0.29, 0.09], [0.13, 0.075], [-0.12, 0.075], [-0.12, 0.11], [-0.2, 0.11], [-0.2, 0.17]]
      .forEach(([x, y], i) => (i ? hullShape.lineTo(x, y) : hullShape.moveTo(x, y)));
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.15, bevelEnabled: false });
    hullGeo.translate(0, 0, -0.075);
    put(hullGeo, "hull");
    put(new THREE.BoxGeometry(0.5, 0.012, 0.158), "trim", 0.02, 0.062, 0);
    for (const [x, h] of [[0.04, 0.42], [0.2, 0.31], [-0.17, 0.28]]) put(new THREE.CylinderGeometry(0.009, 0.012, h, 6), "hull", x, 0.05 + h / 2, 0);
    for (const [x, y, w, h] of [[0.055, 0.2, 0.25, 0.15], [0.055, 0.37, 0.18, 0.1], [0.215, 0.17, 0.18, 0.12], [0.215, 0.29, 0.12, 0.07]]) put(new THREE.BoxGeometry(0.008, h, w), "sail", x, y, 0);
    const lateen = new THREE.Shape();
    lateen.moveTo(-0.17, 0.12); lateen.lineTo(-0.17, 0.3); lateen.lineTo(-0.33, 0.14); lateen.closePath();
    put(new THREE.ShapeGeometry(lateen), "sail");
    put(new THREE.BoxGeometry(0.1, 0.045, 0.004), "flag", -0.01, 0.45, 0);
    const mesh = b.build(M.ship, r => SHIP_COLORS[r]), geo = mesh.geometry;
    return geo;
  }
  /** `out` as the matrix of a ship at (x, y, z) heading `ry`, rolled `rx` and pitched `rz` (a turn about x, then y, then z: three.js's own order). */
  function shipMatrix(out, x, y, z, rx, ry, rz) {
    out.makeRotationX(rx); MB.makeRotationY(ry); out.multiply(MB); MB.makeRotationZ(rz); out.multiply(MB);
    return out.setPosition(x, y, z);
  }

  // ---------- the puzzle on show ----------
  let P = null, size = 0, lay = null, realmed = false, coast = null;      // the puzzle on show, whether it has two realms, and its shore
  const xz = (r, c) => cellXZ(size, r, c, !!lay?.hex);                     // where a lattice point stands (the hex board's are a unit apart on slants)
  let world = null, lines = [], plates = [], fleet = null, lastSail = 0, marks = "";
  let batches = null, hulls = null, lamps = null, buoyMeshes = [], buoys = [], fitPts = [];       // the meshes of the board, the ships and their lamps, the buoys, and the points the camera keeps in view
  let lit = new Set(), litIsland = -1, aim = -1, winUntil = 0;     // the hint's links and island, the link under a finger or the pointer, the end of the win's glow
  let state = { bridges: 0, guides: 0, glowing: 0 }, buildMs = 0;       // what is on show; how long the last board took to build
  let shadowDirty = true, camDirty = true, measure = true, builtKey = null;           // the shadows, the plates' places and their sizes need doing again; the bridges the shadows were drawn for
  function disposeWorld() {
    if (world) { scene.remove(world); world.traverse(o => o.geometry?.dispose()); }
    world = null; lines = []; batches = hulls = lamps = null; buoys = []; buoyMeshes = []; fleet = null; fitPts = []; builtKey = null;
    labels.replaceChildren(); plates = [];
    lit = new Set(); litIsland = aim = -1; winUntil = 0;
  }
  /** A batch's mesh into the world: lit and shadowed, or glass-like and not, and never culled (it is the whole board). */
  function mount(batch, material, { shadows = false, order = 0 } = {}) {
    const mesh = batch.build(material);
    mesh.castShadow = mesh.receiveShadow = shadows;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    world.add(mesh);
    return batch;
  }

  /** An island as big as its number: on sand, a beach, a lawn and trees (more of them the bigger it is); a hill in terraces; and a pale ring of shallows round it. */
  function island(land, rings, i) {
    const isle = lay.isl[i], [x, z] = xz(isle.r, isle.c), R = islandRadius(isle.n), here = y => at(x, y, z);
    const clay = !!isle.realm;                                          // an orange realm's island: square-cut clay, no lawn or trees; a blue one is round and green as an island always was
    // a hill or islet is round or square; a square one's four-sided cylinder is turned to the axes (its corners are `r` from the middle, its sides 0.7 r)
    const body = (rt, rb, h, segs) => (clay ? new THREE.CylinderGeometry(rt * 1.25, rb * 1.25, h, 4).rotateY(Math.PI / 4) : new THREE.CylinderGeometry(rt, rb, h, segs));
    if (realmed) land.add("all", clay ? new THREE.BoxGeometry(2 * R * 0.9 + 0.3, 0.03, 2 * R * 0.9 + 0.3) : new THREE.CylinderGeometry(R + 0.15, R + 0.15, 0.03, 28), here(0.095), `collar${isle.realm ? 1 : 0}`);     // the realm's colour round the foot, over the swell's crests
    if (isle.hill) {
      // terraces: contour lines made solid
      const k = R / 0.47;
      for (const [rb, rt, h, role] of [[0.47, 0.44, 0.3, "h0"], [0.37, 0.36, 0.62, "h1"], [0.27, 0.26, 1.0, "h2"]]) land.add("all", body(rt * k, rb * k, h + 0.1, 20), here((h - 0.1) / 2), clay ? `clay${role[1]}` : role);
      land.add("all", body(0.2 * k, 0.26 * k, 0.05, 14), here(1.02), "trim");
    } else {
      land.add("all", body(R * 0.93, R, 0.34, 24), here(0.03), clay ? "clay" : "sand");
      if (!clay && R > 0.3) {
        land.add("all", new THREE.CylinderGeometry(R * 0.66, R * 0.74, 0.04, 20), here(0.2), "grass");
        // trees between the bridges' ways out: on the diagonals of the square board, between the six directions of the hex one
        const count = isle.n >= 7 ? 3 : isle.n >= 5 ? 2 : isle.n >= 3 ? 1 : 0;
        for (let q = 0; q < count; q++) {
          const sides = lay.hex ? 6 : 4, a = (((i + [0, 2, 1][q]) % sides) + 0.5) * (TAU / sides) + 0.1 * q, d = R * (0.42 + 0.07 * q), s = 0.8 + 0.12 * ((i * 7 + q * 3) % 4), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
          land.add("all", new THREE.CylinderGeometry(0.014 * s, 0.02 * s, 0.1 * s, 5), at(px, 0.22 + 0.05 * s, pz), "rail");
          land.add("all", new THREE.ConeGeometry(0.085 * s, 0.24 * s, 7), at(px, 0.22 + 0.2 * s, pz), "tree");
        }
      }
    }
    rings.add("all", new THREE.CylinderGeometry(R + 0.2, R + 0.26, 0.012, 22), here(0.07), "shallow");      // over the swell's crests
    if (realmed) {
      // a gilt rim round the collar of an island whose number is met (shown by update, a group of the land: no mesh of its own): "done" and, by its shape, whose
      const q = (clay ? 2 * R * 0.9 + 0.3 : 2 * R + 0.3) / 2, g = `m${i}`;
      if (clay) for (const [w, l, ox, oz] of [[2 * q + 0.12, 0.06, 0, -q - 0.03], [2 * q + 0.12, 0.06, 0, q + 0.03], [0.06, 2 * q, -q - 0.03, 0], [0.06, 2 * q, q + 0.03, 0]]) land.add(g, new THREE.BoxGeometry(w, 0.034, l), here(0.108).multiply(at(ox, 0, oz)), "rim");
      else land.add(g, flatRing(q, q + 0.07, 32), here(0.114), "rim");
    }
    // what the camera keeps in view: the shallows' corners, and the plate over the island
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fitPts.push(x + sx * (R + 0.22), 0, z + sz * (R + 0.22));
    fitPts.push(x, isle.hill ? 1.35 : 0.68, z);
  }
  /** A link's bridges, once: a single, a double and (on a wide road) a triple, as groups `l.1`, `l.2`, `l.3` of the batch, shown and hidden as the marks change. */
  function bridgesOf(b, l) {
    const link = lay.links[l], a = lay.isl[link.a], bb = lay.isl[link.b], [x, z] = xz(a.r, a.c), span = spanOf(lay, link);
    const linkM = new THREE.Matrix4().makeRotationY(frameTurn(lay, link)).setPosition(x, 0, z), r = realmed ? (a.realm ? 1 : 0) : -1, stone = link.cap === 3 && r < 0, deckRole = r >= 0 ? `deck${r}` : stone ? "stone" : "timber", railRole = r >= 0 ? `rail${r}` : stone ? "stone" : "rail";   // a bridge on a wide road is a stone one, so the road shows it can hold three even with one on it (Korbi, 8 November 2026)
    const sets = [[1, [0]], [2, [-0.1, 0.1]], ...(link.cap === 3 ? [[3, [-0.17, 0, 0.17]]] : [])];      // a wide road has room for a third bridge
    const put = (n, geo, local, role) => b.add(`${l}.${n}`, geo, local ? linkM.clone().multiply(local) : linkM, role);
    if (link.high) {
      // a stone arcade with a kerb along each edge of the road
      const ra = islandRadius(a.n), rb = islandRadius(bb.n), piers = piersOf(lay, l);
      const outline = wallOutline(span, piers, { top: VIADUCT - 0.04, rise: 0.7, reach: ra, reachEnd: rb }), xa = 0.55 * ra, xb = span - 0.55 * rb, mid = (xa + xb) / 2;
      for (const [n, lanes] of sets) for (const off of lanes) {
        const w = [0.24, 0.12, 0.085][lanes.length - 1];
        put(n, wall(outline, [0.17, 0.08, 0.06][lanes.length - 1]), at(0, 0, off), "stone");
        put(n, new THREE.BoxGeometry(xb - xa, 0.05, w), at(mid, VIADUCT - 0.02, off), r >= 0 ? deckRole : "deck");
        for (const side of [-1, 1]) put(n, new THREE.BoxGeometry(xb - xa, 0.07, 0.022), at(mid, VIADUCT + 0.04, off + side * (w / 2 - 0.011)), r >= 0 ? railRole : "stone");
      }
    } else {
      // an arched timber deck with railings, on trestles: the posts, piles and beams are the same few pieces placed again and again (prep, put), and the
      // deck and rail of a link are one outline that each lane only moves sideways
      const { xa, xb, len, hump } = lowSpan(a, bb, span), ytop = u => DECK + hump * Math.sin((Math.PI * (u - xa)) / len);
      const top = deckProfile(len, hump, Math.max(6, Math.round(len * 5))).map(([u, dy]) => [xa + u, DECK + dy]), decks = {};
      const rail = prep(wall([...top.map(([u, y]) => [u, y + 0.1]), ...top.map(([u, y]) => [u, y + 0.082]).reverse()], 0.018));
      const rail2 = r === 1 ? prep(wall([...top.map(([u, y]) => [u, y + 0.058]), ...top.map(([u, y]) => [u, y + 0.04]).reverse()], 0.018)) : null;      // an orange bridge has a second, lower rail: the same fact the colours give, for eyes that can't tell them
      for (const [n, lanes] of sets) for (const off of lanes) {
        const w = [0.15, 0.085, 0.065][lanes.length - 1], g = `${l}.${n}`;
        decks[w] ||= prep(wall([...top, ...top.map(([u, y]) => [u, y - 0.045]).reverse()], w));
        b.put(g, decks[w], linkM, deckRole, 0, 0, off);
        for (const side of lanes.length === 1 ? [-1, 1] : off === 0 ? [] : [off < 0 ? -1 : 1]) {      // posts and a rail along the edges (a double or a triple has its outer ones)
          const zz = off + side * (w / 2 - 0.011);
          for (let u = xa + 0.12; u <= xb - 0.1; u += 0.3) b.put(g, POST, linkM, railRole, u, ytop(u) + 0.045, zz);
          b.put(g, rail, linkM, railRole, 0, 0, zz);
          if (rail2) b.put(g, rail2, linkM, railRole, 0, 0, zz);
        }
        BEAMS[w] ||= prep(new THREE.BoxGeometry(0.04, 0.03, w + 0.01));
        for (let u = xa + 0.35; u <= xb - 0.3; u += 0.75) {                             // trestles: a pair of piles and a beam under the deck
          const below = ytop(u) - 0.045, h = below + 0.12;
          for (const side of [-1, 1]) b.put(g, PILE, linkM, "rail", u, below - h / 2, off + side * (w / 2 - 0.02), h);
          b.put(g, BEAMS[w], linkM, "rail", u, below - 0.015, off);
        }
      }
    }
  }
  /** What a link shows before it has a bridge: dashes along it (where a finger may tap), and the glow a hint or a finger gives it (flat, `f`, over a link without a bridge, and arched, `a`, along a built one's deck). */
  function guideOf(land, dashes, halos, l) {
    const link = lay.links[l], a = lay.isl[link.a], b = lay.isl[link.b], [x, z] = xz(a.r, a.c), span = spanOf(lay, link);
    const linkM = new THREE.Matrix4().makeRotationY(frameTurn(lay, link)).setPosition(x, 0, z), high = !!link.high, y = high ? GUIDE_HIGH : GUIDE;
    const from = islandRadius(a.n) + 0.1, to = span - islandRadius(b.n) - 0.1, n = Math.max(1, Math.round((to - from) / 0.3)), step = (to - from) / n, hw = 0.04 + 0.004 * Math.max(0, size - 7), list = [];
    for (let i = 0; i < n; i++) list.push([from + i * step + (step - 0.17) / 2, from + i * step + (step + 0.17) / 2, hw]);
    const wide = link.cap === 3, hh = wide ? 0.3 : 0.2;
    for (const zoff of wide ? [-0.17, 0, 0.17] : [0]) dashes.add(`${l}`, strips(list.map(([x0, x1, w]) => [x0, x1, wide ? w * 0.8 : w]), y, zoff), linkM, "guide");      // a wide road shows its three lanes
    halos.add(`f${l}`, strips([[from - 0.05, to + 0.05, hh]], y + 0.012), linkM, "halo");
    if (high) halos.add(`a${l}`, strips([[from - 0.05, to + 0.05, hh]], VIADUCT + 0.085), linkM, "halo");
    else { const low = lowSpan(a, b, span); halos.add(`a${l}`, arched(from - 0.05, to + 0.05, hh, low.hump, low.xa, low.len, DECK + 0.115), linkM, "halo"); }
    if (link.cap === 1) {                                              // a narrow road: a gate, a post each side of the road's middle cell and a bar across them
      const mid = Math.floor(span / 2);
      for (const side of [-1, 1]) land.add("all", new THREE.CylinderGeometry(0.07, 0.085, 0.46, 8), linkM.clone().multiply(at(mid, 0.17, side * 0.27)), "stone");
      land.add("all", new THREE.BoxGeometry(0.07, 0.06, 0.62), linkM.clone().multiply(at(mid, 0.42, 0)), "stone");
    }
  }

  /**
   * The shore round the sea (bridges-coast.js): its land in the colours of its slopes (sand, cliff, grass, hill), rocks, clumps of pines and a lighthouse, all
   * one mesh with the board's land colours, and a pale ribbon of shallows along the waterline in the translucent batch. Built once with the puzzle.
   */
  function shoreOf(batch, shallows) {
    const roles = new Map();
    for (const t of coast.tris) { const list = roles.get(t.role) || roles.set(t.role, []).get(t.role); for (let q = 0; q < 9; q++) list.push(t.p[q]); }
    for (const [role, list] of roles) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(list, 3));
      g.computeVertexNormals();
      batch.add("all", g, null, role);
    }
    for (const r of coast.rocks) batch.add("all", new THREE.IcosahedronGeometry(1, 0), at(r.x, r.y, r.z).multiply(new THREE.Matrix4().makeRotationY(r.ry)).multiply(new THREE.Matrix4().makeScale(r.s, r.s * 0.7, r.s)), "rock");
    for (const q of coast.pines) {
      const m = at(q.x, q.y, q.z);
      batch.put("all", PINE_TRUNK, m, "rail", 0, 0.06, 0);
      batch.put("all", PINE_LOW, m, "pine", 0, 0.1 + 0.17 * q.s, 0, q.s);
      batch.put("all", PINE_HIGH, m, "pine", 0, 0.1 + 0.34 * q.s, 0, q.s);
    }
    const lh = coast.lighthouse;
    if (lh) {
      const m = at(lh.x, lh.y, lh.z);
      batch.add("all", new THREE.CylinderGeometry(0.11, 0.17, 1.1, 10), m.clone().multiply(at(0, 0.55, 0)), "white");
      batch.add("all", new THREE.CylinderGeometry(0.128, 0.138, 0.2, 10), m.clone().multiply(at(0, 0.6, 0)), "red");
      batch.add("all", new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), m.clone().multiply(at(0, 1.12, 0)), "white");
      batch.add("all", new THREE.CylinderGeometry(0.085, 0.085, 0.15, 8), m.clone().multiply(at(0, 1.21, 0)), "trim");
      batch.add("all", new THREE.ConeGeometry(0.14, 0.15, 8), m.clone().multiply(at(0, 1.36, 0)), "red");
      batch.add("all", new THREE.CylinderGeometry(0.22, 0.26, 0.1, 8), m.clone().multiply(at(0, -0.02, 0)), "cliff");
    }
    // shallows: a ribbon of pale water along the waterline, outside it, over the swell's crests
    const pos = [], idx = [], n = coast.n;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU, r = coast.water[i], c = Math.cos(t), s = Math.sin(t);
      pos.push(c * (r - 0.55), 0.075, s * (r - 0.55), c * (r + 0.04), 0.075, s * (r + 0.04));
      const j = (i + 1) % n;
      idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    shallows.add("all", g, null, "shallow");
  }

  /** Shows a puzzle: `p` is { lay, size, seed } (the page's P and the run's seed, which gives the shore). */
  /** A new puzzle ends the win's turning, and the camera is back at the base view, still (Korbi, 7 Nov 2026). */
  function set(p) { spinUntil = 0; winUntil = 0; setPuzzle(p); reset(); }
  function setPuzzle(p) {
    const began = performance.now();
    P = p; lay = p.lay; size = p.size; realmed = lay.isl.some(o => o.realm);
    disposeWorld();
    world = new THREE.Group();
    coast = coastOf(p.seed ?? lay.isl.map(o => `${o.r}${o.c}${o.n}`).join(""), size);       // every puzzle has a bay of its own
    buildSea(coast.seaHalf);
    zoom = 1; pan.x = pan.z = 0; orbited = false; az = HOME_AZ; el = homeElevation(width / height);       // a new board is seen from the first view, all of it
    const land = createBatch(), rings = createBatch(), bridges = createBatch(), dashes = createBatch(), halos = createBatch(), shore = createBatch();
    lay.isl.forEach((isle, i) => {
      island(land, rings, i);
      const plate = document.createElement("span"), [x, z] = xz(isle.r, isle.c);
      plate.className = "brg3-n";
      plate.textContent = labelOf(isle);
      labels.appendChild(plate);
      plates.push({ el: plate, i, cls: "", text: plate.firstChild, shown: plate.textContent, p: new THREE.Vector3(x, isle.hill ? 1.35 : 0.68, z), w: 0, h: 0 });
    });
    lines = lay.links.map((_, l) => linkLine(lay, size, l, { deck: DECK, viaduct: VIADUCT, pad: o => islandRadius(o.n) + 0.05 }));
    lay.links.forEach((_, l) => { bridgesOf(bridges, l); guideOf(land, dashes, halos, l); });
    // the sea's own: a line of buoys along each strait, its number on a plate at the edge; merchantmen in the free water
    const buoyList = [];
    lay.groups.forEach((g, k) => {
      if (lay.hex) {
        // straits on the hex board run in three families, each a line between two lattice lines (bridges-lattice.js), cut to the hexagon
        const [bw, bh] = boxOf(size, true), [[x0, y0], [x1, y1]] = straitLine(size, true, g.fam, g.gap, 0.55), p0 = [x0 - bw / 2, y0 - bh / 2], p1 = [x1 - bw / 2, y1 - bh / 2];
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), plate = document.createElement("span");
        land.add("all", new THREE.BoxGeometry(len, 0.025, 0.03), at((p0[0] + p1[0]) / 2, 0.04, (p0[1] + p1[1]) / 2).multiply(new THREE.Matrix4().makeRotationY(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0]))), "teal");       // the rope
        for (let t = 0, i = 0; t <= len + 0.01; t += 0.5, i++) buoyList.push({ x: p0[0] + ((p1[0] - p0[0]) * t) / len, z: p0[1] + ((p1[1] - p0[1]) * t) / len, white: i % 2 === 1 });
        plate.className = "brg3-n strait";
        plate.textContent = String(g.mx);
        labels.appendChild(plate);
        const ux = (p0[0] - p1[0]) / len, uz = (p0[1] - p1[1]) / len, px = p0[0] + ux * 0.8, pz = p0[1] + uz * 0.8;       // a little past the line's end
        plates.push({ el: plate, p: new THREE.Vector3(px, 0.35, pz), strait: k, cls: "", w: 0, h: 0 });
        fitPts.push(px, 0.35, pz);
        return;
      }
      const half = size / 2, line = g.gap + 1 - half, plate = document.createElement("span"), end = size + 0.8;
      land.add("all", new THREE.BoxGeometry(g.across ? 0.03 : end, 0.025, g.across ? end : 0.03), at(g.across ? line : 0, 0.04, g.across ? 0 : line), "teal");        // the rope
      for (let t = -half - 0.4, i = 0; t <= half + 0.41; t += 0.5, i++) buoyList.push({ x: g.across ? line : t, z: g.across ? t : line, white: i % 2 === 1 });
      plate.className = "brg3-n strait";
      plate.textContent = String(g.mx);
      labels.appendChild(plate);
      const [px, py, pz] = g.across ? [line, 0.35, -half - 0.95] : [-half - 0.95, 0.35, line];
      plates.push({ el: plate, p: new THREE.Vector3(px, py, pz), strait: k, cls: "", w: 0, h: 0 });
      fitPts.push(px, py, pz);
    });
    // the board's own square, so a sparse board is framed as a full one is
    const [bw, bh] = boxOf(size, !!lay.hex), sqx = (bw / 2 - 0.5) * 0.9 + 0.55, sqz = (bh / 2 - 0.5) * 0.9 + 0.55;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fitPts.push(sx * sqx, 0, sz * sqz);
    shoreOf(shore, rings);
    batches = { land: mount(land, M.land, { shadows: true }), bridges: mount(bridges, M.land, { shadows: true }), shore: mount(shore, M.land), rings: mount(rings, M.shallow), dashes: mount(dashes, M.guide, { order: 1 }), halos: mount(halos, M.halo, { order: 2 }) };
    batches.land.show(null); batches.rings.show(null); batches.shore.show(null);
    // the buoys: two instanced meshes, a colour each; the ships: one, and a lamp for each at night
    buoys = [];
    for (const white of [false, true]) {
      const list = buoyList.filter(q => q.white === white);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.09, 0.2, 10), white ? M.buoyWhite : M.buoyTeal, list.length);
      mesh.frustumCulled = false;
      list.forEach((q, i) => buoys.push({ mesh, i, x: q.x, z: q.z }));
      buoyMeshes.push(mesh);
      world.add(mesh);
    }
    fleet = createFleet(shipsFor(size), 1 + size);
    hulls = new THREE.InstancedMesh(shipGeometry(), M.ship, fleet.ships.length);
    lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022 * 1.7, 8, 6), M.lamp, fleet.ships.length);
    for (const m of [hulls, lamps]) { m.frustumCulled = false; world.add(m); }
    scene.add(world);
    applySkin();
    sunKey = "";
    fit();
    measure = true; shadowDirty = true;
    update(marks.length === lay.links.length ? marks : "0".repeat(lay.links.length), null);
    buildMs = Math.round(performance.now() - began);
    draw(performance.now());
  }
  /** The islands whose number this player is not shown (a set of island indexes): their plates say "?". Takes effect at the next update(). */
  let unknown = new Set();
  const names = set => { unknown = set || new Set(); };
  /** A ring on an island's plate for `ms`, in a player's colour: `soft` is your own tap, a quiet echo of the one your partner sees. */
  function ping(i, { slot = 0, soft = false, ms = 2200 } = {}) {
    const pl = plates.find(q => q.i === i && q.strait == null);
    if (!pl) return;
    clearTimeout(pl.ring);
    pl.el.querySelector(".brg3-ping")?.remove();
    const ring = document.createElement("span");
    ring.className = `brg3-ping${soft ? " soft" : ""}`;
    ring.style.setProperty("--pinger", `var(--p${slot})`);
    pl.el.appendChild(ring);
    pl.top = true;                                               // a pinged plate is over every other
    pl.el.style.zIndex = "5000";
    pl.ring = setTimeout(() => { ring.remove(); pl.top = false; camDirty = true; }, ms);
  }
  /** Shows the bridges the marks say (a dashed guide on each link without one), each island's state (met, over, cut) on its plate, and the hint's: `hint` is { set: [links], island } or null. */
  function update(m, br, hint) {
    if (!lay || !batches) return;
    marks = m;
    lit = new Set(hint?.set || []);
    litIsland = hint?.island ?? -1;
    const built = [], bare = [];
    for (let l = 0; l < lay.links.length; l++) { if (m[l] === "0") bare.push(`${l}`); else built.push(`${l}.${m[l]}`); }
    const key = built.join();
    if (key !== builtKey) { builtKey = key; shadowDirty = true; }          // the bridges cast the shadows: a change of them draws the shadow map again
    batches.bridges.show(built);
    batches.dashes.show(bare);
    state.bridges = built.length; state.guides = bare.length;
    const over = new Set(br?.over), met = new Set(br?.met), cut = new Set(br?.cut), loop = new Set((br?.ring || []).flatMap(l => [lay.links[l].a, lay.links[l].b])), done = [];
    for (const pl of plates) {
      let cls;
      if (pl.strait != null) cls = `brg3-n strait${br?.straitsOver?.includes(pl.strait) ? " over" : br?.straitsMet?.includes(pl.strait) ? " met" : ""}${hint?.strait === pl.strait ? " why" : ""}`;
      else {
        const isle = lay.isl[pl.i];
        const word = unknown.has(pl.i) ? "?" : labelOf(isle);
        if (word !== pl.shown) { pl.shown = word; pl.text.data = word; measure = true; }
        if (realmed && !unknown.has(pl.i) && !over.has(pl.i) && met.has(pl.i)) done.push(`m${pl.i}`);       // a gilt rim on an island that has its bridges (and a number this player knows)
        cls = `brg3-n${realmed ? (isle.realm ? " r1" : " r0") : ""}${isle.kind && !unknown.has(pl.i) ? " rng" : ""}${unknown.has(pl.i) ? " unk" : ""}${over.has(pl.i) ? " over" : met.has(pl.i) ? " met" : ""}${cut.has(pl.i) ? " cut" : ""}${loop.has(pl.i) ? " loop" : ""}${pl.i === litIsland ? " why" : ""}`;
      }
      if (cls !== pl.cls) { pl.cls = cls; pl.el.className = cls; }
    }
    batches.land.show(done.length ? ["all", ...done] : null);
    fleet?.setSea(seaOf(lay, m));
    glow();
    wake();
  }
  /** Which links glow gilt: the hint's, the one under a finger, and after a win every bridge. */
  function glow() {
    if (!batches) return;
    const win = performance.now() < winUntil, under = playable() ? aim : -1, on = [];      // a pointer left over a link after the win shows nothing
    for (let l = 0; l < lay.links.length; l++) if (l === under || lit.has(l) || (win && marks[l] !== "0")) on.push(marks[l] === "0" ? `f${l}` : `a${l}`);
    batches.halos.show(on);
    state.glowing = on.length;
  }

  // ---------- the skin ----------
  function applySkin() {
    const k = skinNow(), pal = palette(k);
    M.sea.color.set(k.sea); M.shallow.color.set(k.shallow); M.shallow.opacity = k.shallowA; M.guide.color.set(k.guide); M.guide.opacity = k.guideA;
    batches?.land.recolor(r => pal[r]);
    batches?.bridges.recolor(r => pal[r]);
    batches?.shore.recolor(r => pal[r]);
    hemi.color.set(k.sky); hemi.groundColor.set(k.ground); hemi.intensity = k.hemi;
    sun.color.set(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    if (lamps) lamps.visible = k.lantern;
    wake();
  }

  // ---------- the camera: round the board under a finger ----------
  let width = 1, height = 1, rem = 16, az = HOME_AZ, el = homeElevation(1), dist = 14, fitDist = 14, spinUntil = 0, orbited = false;
  let zoom = 1;                                                  // 1 shows the whole board; in, the camera comes nearer to what it looks at
  const pan = { x: 0, z: 0 };                                    // where it looks, from the board's middle, once zoomed in
  const LOOK = new THREE.Vector3(0, 0.15, 0), V = new THREE.Vector3(), G = new THREE.Vector3();
  let sunKey = "";
  function pose() {
    LOOK.set(pan.x, 0.15, pan.z);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** The camera for the angle and the zoom: the whole board (and the plates over it) in view at the first zoom, from whichever side, to the pixel. */
  function fit() {
    if (!size) return;
    const aspect = width / height, ty = Math.tan(FOV / 2), tx = ty * aspect, near = 0.5, top = near * ty, right = top * aspect, pad = 1.2 * rem;
    fitDist = Math.max(4, fitDistance(fitPts, az, el, HOME_LOOK, tx, ty, (2 * pad) / width, (2 * pad) / height));
    const far = Math.max(120, fitDist + (coast ? coast.far : 0) + 30);       // the land is seen to its far edge from the farthest the camera stands
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    dist = fitDist / zoom;
    pose();
    camDirty = true;
    const key = `${az.toFixed(3)}|${el.toFixed(3)}`;      // the sun follows the camera's turn: the shadows are drawn again when it moves
    if (key === sunKey) return;
    sunKey = key; shadowDirty = true;
    const D = size * 3 + 8, la = az - 0.6, le = Math.min(el + 0.5, 1.3), s = size * 0.8 + 3;
    sun.position.set(Math.sin(la) * Math.cos(le) * D, Math.sin(le) * D, Math.cos(la) * Math.cos(le) * D);
    sun.target.position.set(0, 0, 0);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: D * 2 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    if (!orbited) el = homeElevation(width / height);            // the first view follows the card's shape
    fit();
    measure = true;
    wake();
  }
  /** The plates' sizes follow the board's: a cell's pixels (about `ppu` across the board's middle) say how big a number may be before it covers its neighbour's. */
  let plateK = 1;
  function placePlates() {
    const ppu = (height / 2) / (dist * Math.tan(FOV / 2)), k = Math.round(Math.max(0.92, Math.min(1.3, (0.6 * ppu) / (1.3 * rem))) * 20) / 20;
    if (k !== plateK) { plateK = k; labels.style.setProperty("--k", String(k)); measure = true; }
    if (measure) { for (const pl of plates) { pl.w = pl.el.offsetWidth; pl.h = pl.el.offsetHeight; } measure = false; }     // read all, then write all
    for (const pl of plates) {
      V.copy(pl.p).project(camera);
      // whole pixels: a number between two pixels is a blur
      pl.el.style.transform = `translate(${Math.round(((V.x + 1) / 2) * width - pl.w / 2)}px, ${Math.round(((1 - V.y) / 2) * height - pl.h / 2)}px)`;
      if (!pl.top) pl.el.style.zIndex = String(2000 - Math.round(camera.position.distanceTo(pl.p) * 20));      // the nearer plate over the farther
    }
    camDirty = false;
  }

  // ---------- drawing: only while it is shown and not paused; thirty frames a second while something is being done, fifteen while only the sea moves ----------
  let shown = false, held = false, frameId = 0, last = 0, busyUntil = 0, t0 = performance.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let drawn = 0, drawMs = 0, calls = 0, shadowCalls = 0;           // frames drawn, what one costs on average, and the draw calls of one without and with the shadows (for tuning: stats)
  function draw(now) {
    if (!lay || !hulls) return;
    const began = performance.now();
    const t = still ? 0 : (now - t0) / 1000, dt = Math.min(0.1, Math.max(0, (now - lastSail) / 1000));       // seconds since the last frame, never a jump after a pause
    lastSail = now;
    if (spinUntil > now) { az += 0.35 * dt; fit(); }
    stirSea(t);
    M.halo.opacity = still ? 0.5 : 0.42 + 0.18 * Math.sin(t * 5);
    if (winUntil && now > winUntil) { winUntil = 0; glow(); }
    for (const { mesh, i, x, z } of buoys) mesh.setMatrixAt(i, MA.makeTranslation(x, 0.05 + WAVE(x, z, t), z));
    for (const m of buoyMeshes) m.instanceMatrix.needsUpdate = true;
    if (!still) fleet?.advance(dt);
    const ships = fleet?.ships || [];
    for (let i = 0; i < ships.length; i++) {
      const sh = ships[i];
      shipMatrix(MA, sh.x, WAVE(sh.x, sh.z, t) + 0.01, sh.z, 0.05 * Math.sin(t * 0.9 + sh.x), sh.heading, 0.04 * Math.sin(t * 0.7 + sh.z));
      hulls.setMatrixAt(i, MA);
      if (lamps.visible) { V.set(-0.51, 0.34, 0).applyMatrix4(MA); lamps.setMatrixAt(i, MB.makeTranslation(V.x, V.y, V.z)); }
    }
    hulls.instanceMatrix.needsUpdate = true;
    if (lamps.visible) lamps.instanceMatrix.needsUpdate = true;
    if (camDirty || measure) placePlates();
    const casting = shadowDirty;
    renderer.shadowMap.needsUpdate = shadowDirty;
    shadowDirty = false;
    renderer.render(scene, camera);
    if (casting) shadowCalls = renderer.info.render.calls; else calls = renderer.info.render.calls;
    drawn++;
    drawMs = drawn === 1 ? performance.now() - began : drawMs * 0.9 + (performance.now() - began) * 0.1;
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last >= (now < busyUntil ? BUSY_MS : CALM_MS) - 2) { last = now; draw(now); }
    if (!still || spinUntil > now) frameId = requestAnimationFrame(frame);
  }
  /** Something happened (a touch, a change of the marks): draw at full rate for a moment, and again once if the player asked for less motion. */
  function wake() {
    if (!shown || held || !lay) return;
    busyUntil = performance.now() + BUSY_FOR;
    if (still) draw(performance.now());
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  // ---------- playing it: a tap builds, a hold clears, a drag turns the board ----------
  const playable = () => (opts.playable ? !!opts.playable() : false);
  /** The links and islands as the screen shows them right now, and how near a finger must be. */
  function onScreen() {
    const r = canvas.getBoundingClientRect(), kx = width / (r.width || 1), ky = height / (r.height || 1);
    const scr = (x, y, z) => { V.set(x, y, z).project(camera); return [((V.x + 1) / 2) * width, ((1 - V.y) / 2) * height]; };
    const ppu = (height / 2) / (dist * Math.tan(FOV / 2));      // a cell's pixels across the board's middle; down a column it is less, the lower the camera
    const segs = lines.map((q, l) => {
      const [ax, ay] = scr(q.x0, q.y, q.z0), [bx, by] = scr(q.x1, q.y, q.z1);
      return { l, ax, ay, bx, by, high: q.high, bias: opts.blocked?.(l) ? 3 : 0 };
    });
    // an island is two discs on the screen: the island itself and its plate (the number is what a finger goes for)
    const isles = [], spots = [];
    lay.isl.forEach((o, i) => {
      const [wx, wz] = xz(o.r, o.c), [x, y] = scr(wx, o.hill ? 0.5 : 0.15, wz), pl = plates[i], disc = { x, y, r: (islandRadius(o.n) - 0.02) * ppu };
      isles.push(disc); spots.push({ i, ...disc });
      if (!pl) return;
      const [px, py] = scr(pl.p.x, pl.p.y, pl.p.z), plate = { x: px, y: py, r: (Math.max(pl.w, pl.h) / 2 || 10) * kx };
      isles.push(plate); spots.push({ i, ...plate });
    });
    return { r, kx, ky, segs, isles, spots, tol: pickTolerance(ppu * Math.sin(el)) };
  }
  /** The island under a finger at the page's (clientX, clientY), or -1: a thumb's width at least, so a small island is still found. */
  function islandAt(cx, cy) {
    if (!lay) return -1;
    const { r, kx, ky, spots } = onScreen(), x = (cx - r.left) * kx, y = (cy - r.top) * ky;
    let best = -1, near = Infinity;
    for (const o of spots) { const d = Math.hypot(o.x - x, o.y - y); if (d < Math.max(o.r, 16 * kx) && d < near) { near = d; best = o.i; } }
    return best;
  }
  /** The link under a finger at the page's (clientX, clientY), or -1. */
  function pickAt(cx, cy) {
    if (!lay || !lines.length) return -1;
    const { r, kx, ky, segs, isles, tol } = onScreen();
    return pickLink(segs, (cx - r.left) * kx, (cy - r.top) * ky, tol, isles);
  }
  const aimAt = l => { if (l === aim) return; aim = l; glow(); canvas.style.cursor = l >= 0 ? "pointer" : ""; wake(); };

  // ---------- zoom and pan ----------
  /** The point of the islands' plane (as high as the camera looks) under a pixel of the canvas. */
  function groundAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, t = (LOOK.y - o.y) / (G.y - o.y);
    return { x: o.x + (G.x - o.x) * t, z: o.z + (G.z - o.z) * t };
  }
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  /** Keeps the view over the board: the further in, the further from the middle it may look. */
  function clampPan() {
    const lim = (size / 2) * (1 - 1 / zoom) + 0.5;
    pan.x = Math.max(-lim, Math.min(lim, pan.x)); pan.z = Math.max(-lim, Math.min(lim, pan.z));
  }
  /** Zooms to `z` (1 to MAX_ZOOM) keeping what is under the page's point (cx, cy) under it (the middle if none). */
  function zoomAt(z, cx, cy) {
    if (!lay) return;
    const [sx, sy] = cx == null ? [width / 2, height / 2] : canvasPoint(cx, cy), before = groundAt(sx, sy);
    zoom = Math.max(1, Math.min(MAX_ZOOM, z));
    fit();
    if (zoom === 1) { pan.x = pan.z = 0; } else { const after = groundAt(sx, sy); pan.x += before.x - after.x; pan.z += before.z - after.z; clampPan(); }
    fit(); wake();
  }
  /** Moves the view so what was under the canvas pixel (ax, ay) is under (bx, by): a drag of the ground. */
  function panBy(ax, ay, bx, by) {
    const p = groundAt(ax, ay), q = groundAt(bx, by);
    pan.x += p.x - q.x; pan.z += p.z - q.z;
    clampPan(); fit(); wake();
  }
  /** Back to where it began: turned to the first view, all of the board in sight. */
  function reset() { zoom = 1; pan.x = pan.z = 0; orbited = false; orbit(HOME_AZ, homeElevation(width / height)); }
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);       // ctrl is a trackpad's pinch
  }, { passive: false });
  const fingers = new Map();       // the pointers down: id → { x, y } on the page
  let pinch = null;                // two fingers: { d0, zoom0, anchor } the distance when they met, the zoom then, and the ground under their middle
  const pinchNow = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };

  let g = null, lastTap = null;      // the finger down: { id, x0, y0, x, y, link, turning, held, timer }; the last tap that hit nothing
  canvas.addEventListener("pointerdown", e => {
    if (e.button === 2) { const l = playable() ? pickAt(e.clientX, e.clientY) : -1; if (l >= 0) opts.press?.(l, "hold"); return; }   // a right click clears, as on the chart
    if (e.button > 0) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g && fingers.size === 2 && !pinch) {            // a second finger: no tap or hold now, the two zoom and pan
      clearTimeout(g.timer); g.turning = true; aimAt(-1);
      const { d, mx, my } = pinchNow();
      pinch = { d0: d, zoom0: zoom, anchor: groundAt(...canvasPoint(mx, my)) };
      return;
    }
    if (g) return;
    const link = playable() ? pickAt(e.clientX, e.clientY) : -1;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, link, turning: false, held: false, timer: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    if (link < 0) return;
    aimAt(link);
    g.timer = setTimeout(() => {
      if (!g || g.turning) return;
      g.held = true;
      navigator.vibrate?.(14);
      opts.press?.(g.link, "hold");
      aimAt(-1);
    }, HOLD);
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
    if (!g) { if (e.pointerType === "mouse" && lay) aimAt(playable() ? pickAt(e.clientX, e.clientY) : -1); return; }
    if (e.pointerId !== g.id) return;
    if (!g.turning) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) <= SLIP) return;      // a finger shakes: still a tap
      g.turning = true;
      clearTimeout(g.timer);
      aimAt(-1);
      g.x = e.clientX; g.y = e.clientY;
      return;
    }
    if (e.shiftKey && e.pointerType === "mouse") panBy(...canvasPoint(g.x, g.y), ...canvasPoint(e.clientX, e.clientY));      // shift and drag moves the board
    else {
      orbited = true;
      az -= (e.clientX - g.x) * 0.008;
      el = Math.max(MIN_EL, Math.min(MAX_EL, el + (e.clientY - g.y) * 0.006));
      fit();
      wake();
    }
    g.x = e.clientX; g.y = e.clientY;
  });
  const letGo = e => {
    fingers.delete(e.pointerId);
    if (pinch && fingers.size < 2) { pinch = null; const p = g && fingers.get(g.id); if (p) { g.x = p.x; g.y = p.y; } }     // one finger left: it turns the board on from where it is
    if (!g || e.pointerId !== g.id) return;
    clearTimeout(g.timer);
    const { link, turning, held } = g, now = performance.now();
    g = null;
    if (e.pointerType !== "mouse") aimAt(-1);
    if (e.type === "pointercancel" || turning || held) return;
    if (link >= 0) { lastTap = null; opts.press?.(link, "tap"); return; }
    const isle = opts.island && playable() ? islandAt(e.clientX, e.clientY) : -1;       // a tap on an island points it out (together), it doesn't turn the board back
    if (isle >= 0) { lastTap = null; opts.island(isle); return; }
    // two taps on the water turn the board back to where it began
    if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; reset(); } else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.addEventListener("pointerleave", e => { if (!g && e.pointerType === "mouse") aimAt(-1); });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.style.touchAction = "none";
  function orbit(a, e) { az = a; el = Math.max(MIN_EL, Math.min(MAX_EL, e)); fit(); wake(); }
  // the zoom buttons, for a mouse without a wheel and a hand that doesn't pinch (a touch screen has its fingers: the stylesheet hides them there)
  const zoomBox = document.createElement("div");
  zoomBox.className = "brg3-zoom";
  for (const [text, label, by] of [["+", "Zoom in", 1.4], ["−", "Zoom out", 1 / 1.4]]) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label);
    b.addEventListener("click", () => zoomAt(zoom * by));
    zoomBox.appendChild(b);
  }
  host.appendChild(zoomBox);
  // the keys, as on the chart: + and − zoom, 0 puts the board back
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
  canvas.addEventListener("webglcontextrestored", () => { shadowDirty = true; applySkin(); wake(); });
  applySkin();
  resize();

  return {
    canvas, set, update, names, ping,
    /** Draws (or stops drawing). */
    show(on) { shown = !!on; if (shown) { resize(); wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    /** Holds the drawing still while the menu is open, then lets it go on. */
    hold(on) { held = !!on; if (held && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); },
    /** After a win: the board turns slowly for a few seconds. */
    spin(ms = 7000) { spinUntil = performance.now() + ms; winUntil = performance.now() + 3200; glow(); wake(); },
    orbit, reset,
    get angles() { return [az, el]; },
    /** For tests and the page: the zoom (1 is all of the board) and where it looks. */
    get view() { return { zoom, x: pan.x, z: pan.z }; },
    zoomTo(z, cx, cy) { zoomAt(z, cx, cy); },
    /** For tests: the page's (clientX, clientY) of link `l`, a fraction `f` of the way along it (the middle), as a finger would tap it. */
    where(l, f = 0.5) {
      const q = lines[l], r = canvas.getBoundingClientRect();
      V.set(q.x0 + (q.x1 - q.x0) * f, q.y, q.z0 + (q.z1 - q.z0) * f).project(camera);
      return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
    },
    /** For tests: the link under the page's (clientX, clientY). */
    pick: pickAt,
    /** For tuning and tests: the draw calls of a frame (and of one that draws the shadows again), triangles, what is held (geometries), and the frames drawn and their average cost in ms. */
    get stats() {
      const i = renderer.info, parts = {};
      for (const [k, b] of Object.entries(batches || {})) parts[k] = [b.drawn / 3, b.vertices / 3];      // triangles drawn, and held
      return { calls, shadowCalls, triangles: i.render.triangles, geometries: i.memory.geometries, frames: drawn, ms: Math.round(drawMs * 100) / 100, buildMs, parts };
    },
    /** For tests: what is on show. */
    get live() { return { ships: fleet?.ships.length || 0, buoys: buoys.length, bridges: state.bridges, guides: state.guides, glowing: state.glowing, lit: [...lit], aim, plates: plates.length, shown }; },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeWorld(); renderer.dispose(); },
  };
}
