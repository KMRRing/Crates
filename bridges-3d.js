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
// The page calls set(layout, grid, …) for a new puzzle and update(marks, breaks, hint) after a change; this file builds every
// link's bridges once (a single and a double), and a change only shows and hides them. It draws only while it is on screen
// and nothing has paused it (the menu, a hidden tab), at most thirty frames a second: the ships go slowly.
// Throws where there is no WebGL (the page then keeps the chart).
import * as THREE from "./vendor/three.js";
import { cellXZ, labelOf, seaOf, createFleet, shipsFor, piersOf, wallOutline, linkLine, pickLink, pickTolerance, islandRadius, deckProfile } from "./bridges-model.js";

const DEG = Math.PI / 180;
const DOUBLE_SIDE = 2;                           // THREE.DoubleSide (not in the bundle's exports)
const MIN_EL = 30 * DEG, MAX_EL = 80 * DEG, FOV = 30 * DEG;   // not lower: from the side the hills hide the links behind them
const HOME_AZ = 32 * DEG, HOME_EL = 52 * DEG;
const MAX_ZOOM = 3.6;                           // how far in: the board's fit is 1
const HOLD = 430, SLIP = 9;                     // ms a press takes to clear a link (as on the chart), and the pixels a finger may stray and still tap
const FRAME_MS = 1000 / 30;
const DECK = 0.17, VIADUCT = 0.8;               // the heights of a low bridge's deck and of the top of a viaduct
const GUIDE = 0.09, GUIDE_HIGH = VIADUCT + 0.02;  // the dashes on a link without a bridge lie a little over the swell (a viaduct's in the air where it would stand)
const WAVE = (x, z, t) => 0.028 * Math.sin(x * 0.9 + t * 0.8) + 0.02 * Math.sin(z * 1.3 - t * 0.6) + 0.012 * Math.sin((x + z) * 2.1 + t * 1.7);

// ---------- the skins ----------
const MODES = {
  day: { sea: 0x3f8db4, sand: 0xe6d6ab, hill: [0xd8c28f, 0xc4a870, 0xa98b55], copper: 0xd9a27a, timber: 0x9a6a3b, stone: 0xd9d0bc, deck: 0xbfb394, guide: 0xffffff, guideA: 0.62, hemi: 1.15, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.5, exposure: 1.0, lantern: false, grass: 0x8fae62, tree: 0x4d7a45, shallow: 0xb9e6e3, shallowA: 0.42, rail: 0x6b4a2b },
  night: { sea: 0x3a6684, sand: 0xbdb292, hill: [0xb3a47c, 0x9d8e68, 0x857852], copper: 0xc08a68, timber: 0x84603a, stone: 0xb4aea0, deck: 0x9a9380, guide: 0xdfeaf5, guideA: 0.5, hemi: 1.3, sky: 0xa5b4d2, ground: 0x1c2a38, key: 0xcfdcf6, keyI: 2.1, exposure: 1.1, lantern: true, grass: 0x6f8a55, tree: 0x3e6339, shallow: 0x8fb8c4, shallowA: 0.34, rail: 0x5e4328 },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { night, ...MODES[night ? "night" : "day"] };
}

/** An extruded outline: points [x, y] along and up, `depth` thick (centred on z = 0). */
function wall(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A box `w` × `h` × `d` with its middle at (x, y, z), as a piece for `merged`. */
const box = (w, h, d, x, y, z) => [new THREE.BoxGeometry(w, h, d), new THREE.Matrix4().makeTranslation(x, y, z)];
/** Many pieces [geometry, matrix] as one geometry, so a bridge with a hundred posts is one thing to draw and not a hundred. */
function merged(list) {
  const pos = [], nor = [];
  for (const [geo, m] of list) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    g.dispose(); geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/**
 * The model in `host`. Calls: set(puzzle) for a new puzzle (its layout `lay` and `size`), update(marks, br, hint)
 * when the bridges, the islands' state or the hint's link changed, show(on) to start or stop drawing, spin() after a win,
 * orbit(az, el) / angles for the camera, dispose(). `opts`: press(link, "tap" | "hold") is called for a finger on a link,
 * playable() says whether a finger may build now (not when it is won, paused, or only watching), blocked(link) whether no
 * bridge can go on the link (another crosses it), which makes it lose a close call.
 */
export function createModel(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
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

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const M = {
    sea: mat(0x3f8db4, { roughness: 0.55, metalness: 0.05 }), sand: mat(0xe6d6ab), copper: mat(0xd9a27a),
    h0: mat(0xd8c28f), h1: mat(0xc4a870), h2: mat(0xa98b55), timber: mat(0x9a6a3b), stone: mat(0xd9d0bc), deck: mat(0xbfb394),
    hull: mat(0x6a4426), trim: mat(0xc9a23c, { metalness: 0.4, roughness: 0.4 }), sail: mat(0xf0e6cc, { side: DOUBLE_SIDE }), flag: mat(0xb5432f, { side: DOUBLE_SIDE }),
    grass: mat(0x8fae62), tree: mat(0x4d7a45), rail: mat(0x6b4a2b), teal: mat(0x1e7f8c), white: mat(0xf4efe2), lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
    shallow: new THREE.MeshBasicMaterial({ color: 0xb9e6e3, transparent: true, opacity: 0.4, depthWrite: false }),
    guide: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: DOUBLE_SIDE }),
    halo: new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.5, depthWrite: false, side: DOUBLE_SIDE }),
  };
  const C = new THREE.Color();

  // ---------- the sea ----------
  let sea = null, seaTop = [], seaSize = 0;
  function buildSea(size) {
    if (sea) { scene.remove(sea); sea.geometry.dispose(); }
    seaSize = size + 40;                             // the camera sees a long way over it from a low angle
    const g = new THREE.BoxGeometry(seaSize, 0.5, seaSize, 64, 1, 64), pos = g.attributes.position;
    seaTop = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) seaTop.push(i);
    g.translate(0, -0.25, 0);
    sea = new THREE.Mesh(g, M.sea);
    sea.receiveShadow = true;
    scene.add(sea);
  }
  function stirSea(t) {
    if (!sea) return;
    const pos = sea.geometry.attributes.position;
    for (const i of seaTop) pos.setY(i, WAVE(pos.getX(i), pos.getZ(i), t));
    pos.needsUpdate = true;
  }

  // ---------- a ship: a hull from a side profile, three masts, square sails, a lateen on the mizzen, a flag and a lantern ----------
  function ship() {
    const g = new THREE.Group(), hullShape = new THREE.Shape();
    [[-0.3, 0.17], [-0.31, 0.02], [-0.24, -0.05], [0.14, -0.05], [0.31, 0.07], [0.29, 0.09], [0.13, 0.075], [-0.12, 0.075], [-0.12, 0.11], [-0.2, 0.11], [-0.2, 0.17]]
      .forEach(([x, y], i) => (i ? hullShape.lineTo(x, y) : hullShape.moveTo(x, y)));
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.15, bevelEnabled: false });
    hullGeo.translate(0, 0, -0.075);
    const hull = new THREE.Mesh(hullGeo, M.hull);
    hull.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.158), M.trim);
    stripe.position.set(0.02, 0.062, 0);
    g.add(hull, stripe);
    const mast = (x, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, h, 6), M.hull); m.position.set(x, 0.05 + h / 2, 0); m.castShadow = true; g.add(m); };
    mast(0.04, 0.42); mast(0.2, 0.31); mast(-0.17, 0.28);
    const sailBox = (x, y, w, h) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, h, w), M.sail); s.position.set(x, y, 0); s.castShadow = true; g.add(s); };
    sailBox(0.055, 0.2, 0.25, 0.15); sailBox(0.055, 0.37, 0.18, 0.1);
    sailBox(0.215, 0.17, 0.18, 0.12); sailBox(0.215, 0.29, 0.12, 0.07);
    const lateen = new THREE.Shape();
    lateen.moveTo(-0.17, 0.12); lateen.lineTo(-0.17, 0.3); lateen.lineTo(-0.33, 0.14); lateen.closePath();
    const lat = new THREE.Mesh(new THREE.ShapeGeometry(lateen), M.sail);
    lat.castShadow = true;
    g.add(lat);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.004), M.flag);
    flag.position.set(-0.01, 0.45, 0);
    g.add(flag);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.lamp);
    lamp.position.set(-0.3, 0.2, 0);
    g.add(lamp);
    g.userData = { flag, lamp };
    g.scale.setScalar(1.7);
    return g;
  }

  // ---------- the puzzle on show ----------
  let P = null, size = 0, lay = null;
  let world = null, linkMeshes = [], lines = [], plates = [], ships = [], buoys = [], fleet = null, lastSail = 0, marks = "";
  let lit = new Set(), litIsland = -1, aim = -1, winUntil = 0;     // the hint's links and island, the link under a finger or the pointer, the end of the win's glow
  function disposeWorld() {
    if (world) { scene.remove(world); world.traverse(o => o.geometry?.dispose()); }
    world = null; linkMeshes = []; lines = []; ships = []; buoys = []; fleet = null;
    labels.replaceChildren(); plates = [];
    lit = new Set(); litIsland = aim = -1; winUntil = 0;
  }
  const place = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; };
  const shadowed = obj => { obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; };

  /** An island as big as its number: on sand, a beach, a lawn and trees (more of them the bigger it is); a hill in terraces; and a pale ring of shallows round it. */
  function island(i) {
    const isle = lay.isl[i], [x, z] = cellXZ(size, isle.r, isle.c), R = islandRadius(isle.n), g = new THREE.Group(), top = isle.realm ? M.copper : M.sand;
    if (isle.hill) {
      // terraces: contour lines made solid
      const k = R / 0.47, t = [[0.47, 0.44, 0.3, M.h0], [0.37, 0.36, 0.62, M.h1], [0.27, 0.26, 1.0, M.h2]];
      for (const [rb, rt, h, m] of t) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt * k, rb * k, h + 0.1, 20), isle.realm ? M.copper : m); c.position.y = (h - 0.1) / 2; g.add(c); }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * k, 0.26 * k, 0.05, 14), M.trim);
      cap.position.y = 1.02;
      g.add(cap);
    } else {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.93, R, 0.34, 24), top);
      c.position.y = 0.03;
      g.add(c);
      if (!isle.realm && R > 0.3) {
        const lawn = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.66, R * 0.74, 0.04, 20), M.grass);
        lawn.position.y = 0.2;
        g.add(lawn);
        // trees on the diagonals, the bridges leaving by the four sides
        const trunks = [], crowns = [], count = isle.n >= 7 ? 3 : isle.n >= 5 ? 2 : isle.n >= 3 ? 1 : 0;
        for (let q = 0; q < count; q++) {
          const a = (((i + [0, 2, 1][q]) % 4) + 0.5) * (Math.PI / 2) + 0.1 * q, d = R * (0.42 + 0.07 * q), s = 0.8 + 0.12 * ((i * 7 + q * 3) % 4), px = Math.cos(a) * d, pz = Math.sin(a) * d;
          trunks.push([new THREE.CylinderGeometry(0.014 * s, 0.02 * s, 0.1 * s, 5), new THREE.Matrix4().makeTranslation(px, 0.22 + 0.05 * s, pz)]);
          crowns.push([new THREE.ConeGeometry(0.085 * s, 0.24 * s, 7), new THREE.Matrix4().makeTranslation(px, 0.22 + 0.2 * s, pz)]);
        }
        if (count) g.add(new THREE.Mesh(merged(trunks), M.rail), new THREE.Mesh(merged(crowns), M.tree));
      }
    }
    shadowed(g);
    const out = new THREE.Group(), ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.26, 0.012, 28), M.shallow);
    ring.position.y = 0.07;                                      // over the swell's crests
    out.add(g, ring);
    out.position.set(x, 0, z);
    return out;
  }
  /** Where a low bridge's deck runs along its link (from the first island's middle): its ends tucked a little into the islands, and how high it arches. */
  function lowSpan(a, b, span) {
    const xa = islandRadius(a.n) - 0.06, xb = span - islandRadius(b.n) + 0.06, len = xb - xa;
    return { xa, xb, len, hump: Math.max(0.04, Math.min(0.15, 0.035 * len)) };
  }
  /** A link's bridges, once: a single and a double of each, shown and hidden as the marks change. */
  function bridgesOf(l) {
    const link = lay.links[l], a = lay.isl[link.a], b = lay.isl[link.b], [x, z] = cellXZ(size, a.r, a.c), span = link.vertical ? b.r - a.r : b.c - a.c;
    const ry = link.vertical ? -Math.PI / 2 : 0, one = new THREE.Group(), two = new THREE.Group(), three = new THREE.Group(), deckM = a.realm ? M.copper : M.timber;
    const sets = [[one, [0]], [two, [-0.1, 0.1]], ...(link.cap === 3 ? [[three, [-0.17, 0, 0.17]]] : [])];      // a wide road has room for a third bridge
    if (link.high) {
      // a stone arcade with a kerb along each edge of the road
      const ra = islandRadius(a.n), rb = islandRadius(b.n), piers = piersOf(lay, l);
      const outline = wallOutline(span, piers, { top: VIADUCT - 0.04, rise: 0.7, reach: ra, reachEnd: rb }), xa = 0.55 * ra, xb = span - 0.55 * rb, mid = (xa + xb) / 2;
      for (const [grp, lanes] of sets) for (const off of lanes) {
        const w = [0.24, 0.12, 0.085][lanes.length - 1], m = new THREE.Mesh(wall(outline, [0.17, 0.08, 0.06][lanes.length - 1]), M.stone), d = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.05, w), M.deck);
        m.position.z = off;
        d.position.set(mid, VIADUCT - 0.02, off);
        const kerb = new THREE.Mesh(merged([box(xb - xa, 0.07, 0.022, mid, VIADUCT + 0.04, off - (w / 2 - 0.011)), box(xb - xa, 0.07, 0.022, mid, VIADUCT + 0.04, off + (w / 2 - 0.011))]), M.stone);
        grp.add(m, d, kerb);
      }
    } else {
      // an arched timber deck with railings, on trestles
      const { xa, xb, len, hump } = lowSpan(a, b, span), ytop = u => DECK + hump * Math.sin((Math.PI * (u - xa)) / len);
      for (const [grp, lanes] of sets) for (const off of lanes) {
        const w = [0.15, 0.085, 0.065][lanes.length - 1], top = deckProfile(len, hump, Math.max(6, Math.round(len * 5))).map(([u, dy]) => [xa + u, DECK + dy]);
        const deck = wall([...top, ...top.map(([u, y]) => [u, y - 0.045]).reverse()], w);
        deck.translate(0, 0, off);
        grp.add(new THREE.Mesh(deck, deckM));
        const parts = [];
        for (const side of lanes.length === 1 ? [-1, 1] : off === 0 ? [] : [off < 0 ? -1 : 1]) {      // posts and a rail along the edges (a double or a triple has its outer ones)
          const zz = off + side * (w / 2 - 0.011);
          for (let u = xa + 0.12; u <= xb - 0.1; u += 0.3) parts.push(box(0.02, 0.09, 0.02, u, ytop(u) + 0.045, zz));
          const rail = wall([...top.map(([u, y]) => [u, y + 0.1]), ...top.map(([u, y]) => [u, y + 0.082]).reverse()], 0.018);
          rail.translate(0, 0, zz);
          parts.push([rail, null]);
        }
        for (let u = xa + 0.35; u <= xb - 0.3; u += 0.75) {                             // trestles: a pair of piles and a beam under the deck
          const below = ytop(u) - 0.045, h = below + 0.12;
          for (const side of [-1, 1]) parts.push([new THREE.CylinderGeometry(0.02, 0.024, h, 5), new THREE.Matrix4().makeTranslation(u, below - h / 2, off + side * (w / 2 - 0.02))]);
          parts.push(box(0.04, 0.03, w + 0.01, u, below - 0.015, off));
        }
        grp.add(new THREE.Mesh(merged(parts), M.rail));
      }
    }
    const out = new THREE.Group();
    out.add(one, two, three);
    place(out, x, 0, z, ry);
    one.visible = two.visible = three.visible = false;
    shadowed(out);
    return { out, one, two, three };
  }

  /** Flat strips along a link in its own frame (from its first island along +x, `y` up), each [from, to, half width]. */
  function strips(list, y, zoff = 0) {
    const pos = [], idx = [];
    for (const [x0, x1, hw] of list) { const n = pos.length / 3; pos.push(x0, y, zoff - hw, x1, y, zoff - hw, x0, y, zoff + hw, x1, y, zoff + hw); idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  /** One strip from x0 to x1 that follows a deck's arch (`hump` high over the deck that runs from `xa`, `len` long), above y = 0: the glow of a built bridge. */
  function arched(x0, x1, hw, hump, xa, len) {
    const n = Math.max(2, Math.round((x1 - x0) / 0.2)), pos = [], idx = [];
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = hump * Math.sin(Math.PI * Math.max(0, Math.min(1, (x - xa) / len))); pos.push(x, y, -hw, x, y, hw); }
    for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  /** What a link shows before it has a bridge: dashes along it (where a finger may tap), and the glow a hint or a finger gives it. */
  function guideOf(l) {
    const link = lay.links[l], a = lay.isl[link.a], b = lay.isl[link.b], [x, z] = cellXZ(size, a.r, a.c), span = link.vertical ? b.r - a.r : b.c - a.c;
    const ry = link.vertical ? -Math.PI / 2 : 0, high = !!link.high, y = high ? GUIDE_HIGH : GUIDE, from = islandRadius(a.n) + 0.1, to = span - islandRadius(b.n) - 0.1;
    const n = Math.max(1, Math.round((to - from) / 0.3)), step = (to - from) / n, hw = 0.04 + 0.004 * Math.max(0, size - 7), list = [];
    for (let i = 0; i < n; i++) list.push([from + i * step + (step - 0.17) / 2, from + i * step + (step + 0.17) / 2, hw]);
    const low = high ? null : lowSpan(a, b, span), wide = link.cap === 3, hh = wide ? 0.3 : 0.2;
    const dashes = new THREE.Group();                                  // a wide road shows its three lanes
    for (const zoff of wide ? [-0.17, 0, 0.17] : [0]) dashes.add(new THREE.Mesh(strips(list.map(([x0, x1, w]) => [x0, x1, wide ? w * 0.8 : w]), y, zoff), M.guide));
    const halo = new THREE.Mesh(high ? strips([[from - 0.05, to + 0.05, hh]], 0) : arched(from - 0.05, to + 0.05, hh, low.hump, low.xa, low.len), M.halo);
    halo.visible = false;
    const out = new THREE.Group();
    out.add(dashes, halo);
    if (link.cap === 1) {                                              // a narrow road: a bollard each side of its middle
      const posts = [];
      for (const side of [-1, 1]) posts.push([new THREE.CylinderGeometry(0.045, 0.055, 0.26, 7), new THREE.Matrix4().makeTranslation(span / 2, 0.1, side * 0.21)]);
      out.add(shadowed(new THREE.Mesh(merged(posts), M.stone)));
    }
    place(out, x, 0, z, ry);
    return { out, dashes, halo, haloY: high ? VIADUCT + 0.085 : DECK + 0.115, guideY: y + 0.012 };
  }

  /** Shows a puzzle: `p` is { lay, size } (the page's P). */
  function set(p) {
    P = p; lay = p.lay; size = p.size;
    disposeWorld();
    world = new THREE.Group();
    buildSea(size);
    lay.isl.forEach((_, i) => {
      world.add(island(i));
      const el = document.createElement("span");
      el.className = "brg3-n";
      el.textContent = labelOf(lay.isl[i]);
      labels.appendChild(el);
      plates.push({ el, i, cls: "" });
    });
    isleReach = Math.max(0, ...lay.isl.map(o => Math.hypot(...cellXZ(size, o.r, o.c)))) + 1.0;
    lines = lay.links.map((_, l) => linkLine(lay, size, l, { deck: DECK, viaduct: VIADUCT, pad: o => islandRadius(o.n) + 0.05 }));
    linkMeshes = lay.links.map((_, l) => { const m = bridgesOf(l), g = guideOf(l); world.add(m.out, g.out); return { ...m, ...g }; });
    // the sea's own: a line of buoys along each strait, its number on a plate at the edge; merchantmen in the free water
    lay.groups.forEach((g, k) => {
      const half = size / 2, line = g.gap + 1 - half, el = document.createElement("span");
      for (let t = -half - 0.4, i = 0; t <= half + 0.4; t += 0.5, i++) {
        const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.12, 8), i % 2 ? M.white : M.teal), x = g.across ? line : t, z = g.across ? t : line;
        buoy.position.set(x, 0.03, z);
        buoy.castShadow = true;
        world.add(buoy);
        buoys.push({ buoy, x, z });
      }
      el.className = "brg3-n strait";
      el.textContent = String(g.mx);
      labels.appendChild(el);
      plates.push({ el, at: g.across ? [line, 0.35, -half - 0.95] : [-half - 0.95, 0.35, line], strait: k, cls: "" });
    });
    fleet = createFleet(shipsFor(size), 1 + size);
    ships = fleet.ships.map(sh => ({ s: ship(), sh }));
    for (const { s } of ships) world.add(s);
    scene.add(world);
    applySkin();
    fit();
    update(marks.length === lay.links.length ? marks : "0".repeat(lay.links.length), null);
    draw(performance.now());
  }
  /** Shows the bridges the marks say (a dashed guide on each link without one), each island's state (met, over, cut) on its plate, and the hint's: `hint` is { set: [links], island } or null. */
  function update(m, br, hint) {
    if (!lay) return;
    marks = m;
    lit = new Set(hint?.set || []);
    litIsland = hint?.island ?? -1;
    linkMeshes.forEach(({ one, two, three, dashes, halo, haloY, guideY }, l) => {
      one.visible = m[l] === "1"; two.visible = m[l] === "2"; three.visible = m[l] === "3";
      dashes.visible = m[l] === "0";
      halo.position.y = m[l] === "0" ? guideY : haloY;
      halo.scale.y = m[l] === "0" ? 0 : 1;                    // a link without a bridge glows flat; a bridge's glow follows its arch
    });
    const over = new Set(br?.over), met = new Set(br?.met), cut = new Set(br?.cut), loop = new Set((br?.ring || []).flatMap(l => [lay.links[l].a, lay.links[l].b]));
    for (const pl of plates) {
      let cls;
      if (pl.strait != null) cls = `brg3-n strait${br?.straitsOver?.includes(pl.strait) ? " over" : br?.straitsMet?.includes(pl.strait) ? " met" : ""}${hint?.strait === pl.strait ? " why" : ""}`;
      else {
        const isle = lay.isl[pl.i];
        cls = `brg3-n${isle.realm ? " r1" : ""}${isle.kind ? " rng" : ""}${over.has(pl.i) ? " over" : met.has(pl.i) ? " met" : ""}${cut.has(pl.i) ? " cut" : ""}${loop.has(pl.i) ? " loop" : ""}${pl.i === litIsland ? " why" : ""}`;
      }
      if (cls !== pl.cls) { pl.cls = cls; pl.el.className = cls; }
    }
    fleet?.setSea(seaOf(lay, m));
    glow();
    wake();
  }
  /** Which links glow gilt: the hint's, the one under a finger, and after a win every bridge. */
  function glow() {
    const win = performance.now() < winUntil, under = playable() ? aim : -1;      // a pointer left over a link after the win shows nothing
    linkMeshes.forEach(({ halo }, l) => { halo.visible = l === under || lit.has(l) || (win && marks[l] !== "0"); });
  }

  // ---------- the skin ----------
  function applySkin() {
    const k = skinNow();
    M.sea.color.set(k.sea); M.sand.color.set(k.sand); M.copper.color.set(k.copper);
    M.h0.color.set(k.hill[0]); M.h1.color.set(k.hill[1]); M.h2.color.set(k.hill[2]);
    M.timber.color.set(k.timber); M.stone.color.set(k.stone); M.deck.color.set(k.deck);
    M.grass.color.set(k.grass); M.tree.color.set(k.tree); M.rail.color.set(k.rail); M.shallow.color.set(k.shallow); M.shallow.opacity = k.shallowA;
    M.guide.color.set(k.guide); M.guide.opacity = k.guideA;
    hemi.color.set(k.sky); hemi.groundColor.set(k.ground); hemi.intensity = k.hemi;
    sun.color.set(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    for (const { s } of ships) s.userData.lamp.visible = k.lantern;
    wake();
  }

  // ---------- the camera: round the board under a finger ----------
  let isleReach = 0;                                             // how far the farthest island is from the board's middle, and room for its plate
  let width = 1, height = 1, az = HOME_AZ, el = HOME_EL, dist = 14, fitDist = 14, spinUntil = 0;
  let zoom = 1;                                                  // 1 shows the whole board; in, the camera comes nearer to what it looks at
  const pan = { x: 0, z: 0 };                                    // where it looks, from the board's middle, once zoomed in
  const LOOK = new THREE.Vector3(0, 0.15, 0), V = new THREE.Vector3(), G = new THREE.Vector3();
  function pose() {
    LOOK.set(pan.x, 0.15, pan.z);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  function fit() {
    if (!size) return;
    const aspect = width / height, near = 0.5, far = 120, top = near * Math.tan(FOV / 2), right = top * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the islands (and the plates over them) in view from any side, the tighter of the two fields of view; a board whose islands
    // keep off its corners comes nearer, but not so near that the sea round it, where the ships sail, is all out of sight
    const edge = (size / 2 - 0.5) * Math.SQRT2 + 0.7, reach = Math.max(isleReach, 0.8 * edge), half = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect));
    fitDist = reach / Math.sin(half);
    dist = fitDist / zoom;
    pose();
    const D = size * 3 + 8, la = az - 0.6, le = Math.min(el + 0.5, 1.3);
    sun.position.set(Math.sin(la) * Math.cos(le) * D, Math.sin(le) * D, Math.cos(la) * Math.cos(le) * D);
    sun.target.position.set(0, 0, 0);
    const s = size * 0.8 + 3;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: D * 2 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    fit();
    wake();
  }
  function placePlates() {
    const plateScale = Math.round((1 + 0.22 * Math.min(2, zoom - 1)) * 100) / 100;      // the plates grow a little with the islands
    for (const pl of plates) {
      if (pl.at) V.set(...pl.at).project(camera);
      else { const isle = lay.isl[pl.i], [x, z] = cellXZ(size, isle.r, isle.c); V.set(x, isle.hill ? 1.35 : 0.55, z).project(camera); }
      pl.el.style.transform = `translate(${((V.x + 1) / 2) * width}px, ${((1 - V.y) / 2) * height}px) translate(-50%, -50%)${plateScale === 1 ? "" : ` scale(${plateScale})`}`;
    }
  }

  // ---------- drawing: only while it is shown and not paused, at thirty frames a second ----------
  let shown = false, held = false, frameId = 0, last = 0, t0 = performance.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function draw(now) {
    const t = still ? 0 : (now - t0) / 1000;
    if (spinUntil > now) { az += 0.35 * (FRAME_MS / 1000); fit(); }
    stirSea(t);
    M.halo.opacity = still ? 0.5 : 0.42 + 0.18 * Math.sin(t * 5);
    if (winUntil && now > winUntil) { winUntil = 0; glow(); }
    for (const { buoy, x, z } of buoys) buoy.position.y = 0.02 + WAVE(x, z, t);
    const dt = Math.min(0.1, Math.max(0, (now - lastSail) / 1000));       // seconds since the last frame, never a jump after a pause
    lastSail = now;
    if (!still) fleet?.advance(dt);
    for (const { s, sh } of ships) {
      const bob = WAVE(sh.x, sh.z, t);
      s.position.set(sh.x, bob + 0.01, sh.z);
      s.rotation.set(0.05 * Math.sin(t * 0.9 + sh.x), sh.heading, 0.04 * Math.sin(t * 0.7 + sh.z));
      s.userData.flag.rotation.y = 0.35 * Math.sin(t * 3 + sh.x * 4);
    }
    renderer.render(scene, camera);
    placePlates();
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last >= FRAME_MS - 2) { last = now; draw(now); }
    if (!still || spinUntil > now) frameId = requestAnimationFrame(frame);
  }
  function wake() {
    if (!shown || held || !lay) return;
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
    const isles = lay.isl.map(o => { const [wx, wz] = cellXZ(size, o.r, o.c), [x, y] = scr(wx, o.hill ? 0.5 : 0.15, wz); return { x, y, r: (islandRadius(o.n) - 0.02) * ppu }; });
    return { r, kx, ky, segs, isles, tol: pickTolerance(ppu * Math.sin(el)) };
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
  function reset() { zoom = 1; pan.x = pan.z = 0; orbit(HOME_AZ, HOME_EL); }
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
    // two taps on the water turn the board back to where it began
    if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; reset(); } else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.addEventListener("pointerleave", e => { if (!g && e.pointerType === "mouse") aimAt(-1); });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.style.touchAction = "none";
  function orbit(a, e) { az = a; el = Math.max(MIN_EL, Math.min(MAX_EL, e)); fit(); wake(); }
  // the zoom buttons, for a mouse without a wheel and a hand that doesn't pinch
  const zoomBox = document.createElement("div");
  zoomBox.className = "brg3-zoom";
  for (const [text, label, by] of [["+", "Zoom in", 1.4], ["−", "Zoom out", 1 / 1.4]]) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label);
    b.addEventListener("click", () => zoomAt(zoom * by));
    zoomBox.appendChild(b);
  }
  host.appendChild(zoomBox);

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
    /** For tests: what is on show. */
    get live() { return { ships: ships.length, buoys: buoys.length, bridges: linkMeshes.filter(m => m.one.visible || m.two.visible || m.three.visible).length, guides: linkMeshes.filter(m => m.dashes.visible).length, glowing: linkMeshes.filter(m => m.halo.visible).length, lit: [...lit], aim, plates: plates.length, shown }; },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeWorld(); renderer.dispose(); },
  };
}
