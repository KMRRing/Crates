// Moor as a harbour, drawn with three.js (vendor/three.js, kept on the device, so it works offline): the board is a basin of
// water laid out in cells, walled by a timber quay with the counts painted on it, a town behind (warehouses, stacked
// containers, a crane). Each dock is a timber platform on piles with a lamp (green once its barge is moored), each barge a
// slate hull with a timber deck and crates, lying along the edge of its dock; open water you have noted is a ripple. It is
// the puzzle, played: a tap on a cell calls the page's press(cell, "tap") (the page moors, marks and clears, as on the chart),
// a right click press(cell, "dot"), a drag turns the view, two fingers (or the wheel) zoom in and pan, and a hint's cells
// glow gilt. The page calls set(P) for a new puzzle and update(marks, breaks, hint) after a change. It draws only while it
// is on screen and nothing has paused it (the menu, a hidden tab), at most twenty-four frames a second.
// Throws where there is no WebGL (the page then keeps the chart).
import * as THREE from "./vendor/three.js";

const DEG = Math.PI / 180;
const MIN_EL = 32 * DEG, MAX_EL = 86 * DEG, FOV = 30 * DEG;
const HOME_UP = 72 * DEG, HOME_SIDE = 58 * DEG;      // the first view's elevation: higher on a tall card, lower on a wide one
const MAX_ZOOM = 3.2;
const SLIP = 9;                                 // pixels a finger may stray and still tap
const FRAME_MS = 1000 / 24;
const QUAY = 1.1, LAND = 70;                    // the quay's width round the basin, and how far the town reaches
const WAVE = (x, z, t) => 0.012 * Math.sin(x * 1.1 + t * 0.9) + 0.01 * Math.sin(z * 1.4 - t * 0.7);

const SKINS = {
  day: { sea: 0x4a8fb5, foam: 0xffffff, quay: 0xb89a6a, quayLo: 0x8a6c42, ground: 0x93a872, plaza: 0xc9c2ad, wood: 0x9a6a3b, woodLo: 0x5e3f20, hull: 0x2f4f66, deck: 0xcfd8de, gilt: 0xe6b93a, red: 0xb5432f,
    crates: [0xb5432f, 0xc8923a, 0x3f7f78], walls: [0xd8cfb8, 0xb9a98a, 0x9aa6ae], roof: 0x8a4b3a, lampOff: 0x6f6f6f, lampOn: 0x3fbf7a, hemi: 1.15, sky: 0xfff4dc, under: 0x6d8fa6, key: 0xfff0d2, keyI: 2.3, exposure: 1.0 },
  night: { sea: 0x34607f, foam: 0xdfeaf5, quay: 0x8d7a58, quayLo: 0x65563c, ground: 0x56694a, plaza: 0x8f8a7b, wood: 0xb5854d, woodLo: 0x7a5430, hull: 0x86a9c2, deck: 0xdfe8ee, gilt: 0xf4cf6a, red: 0xd8705a,
    crates: [0xd8705a, 0xe2b865, 0x6fbdb3], walls: [0x9c9585, 0x857a63, 0x7b8790], roof: 0x7a4a3d, lampOff: 0x8a8a8a, lampOn: 0x6ff0a8, hemi: 1.3, sky: 0xa5b4d2, under: 0x1c2a38, key: 0xcfdcf6, keyI: 1.9, exposure: 1.1 },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { key: night ? "night" : "day", ...SKINS[night ? "night" : "day"] };
}
const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const hash = n => { let t = (n + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/**
 * The model in `host`. Calls: set(P) for a new puzzle (moor-engine's), update(marks, br, hint) when the marks or the hint changed,
 * show(on) to start or stop drawing, hold(on) to stand still (the menu is open), celebrate() after a solve, dispose().
 * `opts`: press(cell, "tap" | "dot") for a finger on a cell, playable() whether a finger may mark now.
 */
export function createModel(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "mr3-gl";
  const labels = document.createElement("div");
  labels.className = "mr3-labels";
  host.replaceChildren(canvas, labels);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Bridges' is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-9, 14, 7);
  scene.add(hemi, sun);

  const solid = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const M = {
    sea: solid(0x4a8fb5, { roughness: 0.55, metalness: 0.05 }), foam: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
    grid: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }),
    quay: solid(0xb89a6a), quayLo: solid(0x8a6c42), ground: solid(0x93a872), plaza: solid(0xc9c2ad), wood: solid(0x9a6a3b), woodLo: solid(0x5e3f20),
    deck: solid(0xd9b97a), roof: solid(0x8a4b3a), crate: [0, 1, 2].map(() => solid(0xb5432f)), wall: [0, 1, 2].map(() => solid(0xd8cfb8)),
    ripple: solid(0xffffff, { transparent: true, opacity: 0.55 }), ripple2: solid(0x4a8fb5),
    litMat: new THREE.MeshBasicMaterial({ color: 0xe6b93a, transparent: true, opacity: 0.6, depthWrite: false }),
    whyMat: new THREE.MeshBasicMaterial({ color: 0xe6b93a, transparent: true, opacity: 0.28, depthWrite: false }),
  };
  let skin = null;
  const restyle = () => {
    const k = skinNow();
    if (skin && skin.key === k.key) return;
    skin = k;
    M.sea.color.setHex(k.sea); M.ripple2.color.setHex(k.sea); M.foam.color.setHex(k.foam); M.ripple.color.setHex(k.foam);
    for (const [m, c] of [[M.quay, k.quay], [M.quayLo, k.quayLo], [M.ground, k.ground], [M.plaza, k.plaza], [M.wood, k.wood], [M.woodLo, k.woodLo], [M.deck, k.deck], [M.roof, k.roof]]) m.color.setHex(c);
    M.crate.forEach((m, i) => m.color.setHex(k.crates[i])); M.wall.forEach((m, i) => m.color.setHex(k.walls[i]));
    M.litMat.color.setHex(k.gilt); M.whyMat.color.setHex(k.gilt);
    hemi.color.setHex(k.sky); hemi.groundColor.setHex(k.under); hemi.intensity = k.hemi; sun.color.setHex(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    for (const b of barges.values()) b.hull.material.color.setHex(b.bad ? k.red : k.hull);
    for (const d of docks) d.lamp.material.color.setHex(d.on ? k.lampOn : k.lampOff);
    dirty = true;
  };

  // ---------- the puzzle on show ----------
  let P = null, N = 0, world = null, barges = new Map(), docks = [], ripples = new Map(), glows = new Map(), clueEls = [], marks = "", won = false, fitPts = [];
  const cellXZ = x => [(x % N) - N / 2 + 0.5, Math.floor(x / N) - N / 2 + 0.5];
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  function dispose() {
    if (world) { scene.remove(world); world.traverse(o => o.geometry?.dispose()); }
    world = null; barges = new Map(); docks = []; ripples = new Map(); glows = new Map(); clueEls = [];
    labels.replaceChildren();
  }

  /** The basin, its quay, the town behind it, the docks and the counts. */
  function build() {
    dispose();
    world = new THREE.Group();
    scene.add(world);
    const T = 0.34;                                                    // the quay's height over the water
    const half = N / 2, size = N + 2 * LAND;
    // water: the basin, a little over so no edge shows under the quay
    const sea = box(N + 0.4, 0.5, N + 0.4, M.sea, 0, -0.25, 0);
    world.add(sea);
    // the cells, drawn as pale lines on the water (where a finger may tap)
    const pos = [], idx = [];
    const strip = (x0, z0, x1, z1) => { const n = pos.length / 3, w = 0.018; if (x0 === x1) pos.push(x0 - w, 0.012, z0, x0 + w, 0.012, z0, x0 - w, 0.012, z1, x0 + w, 0.012, z1); else pos.push(x0, 0.012, z0 - w, x0, 0.012, z0 + w, x1, 0.012, z0 - w, x1, 0.012, z0 + w); idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); };
    for (let i = 0; i <= N; i++) { strip(i - half, -half, i - half, half); strip(-half, i - half, half, i - half); }
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    grid.setIndex(idx);
    world.add(new THREE.Mesh(grid, M.grid));
    // the quay: four timber slabs round the basin with a darker lip, then the town's ground
    const ring = (inner, outer, h, mat, y) => {
      const w = outer - inner;
      for (const [sx, sz, wx, wz, px, pz] of [[1, 0, w, 2 * outer, (inner + outer) / 2, 0], [-1, 0, w, 2 * outer, -(inner + outer) / 2, 0], [0, 1, 2 * inner, w, 0, (inner + outer) / 2], [0, -1, 2 * inner, w, 0, -(inner + outer) / 2]]) world.add(box(wx, h, wz, mat, px, y, pz));
    };
    ring(half, half + QUAY, T + 0.3, M.quay, (T - 0.3) / 2);
    ring(half - 0.06, half + 0.06, T + 0.42, M.quayLo, (T - 0.42) / 2 + 0.02);
    ring(half + QUAY, half + QUAY + LAND, T + 0.3, M.ground, (T - 0.3) / 2 - 0.02);
    ring(half + QUAY, half + QUAY + 3.2, T + 0.3, M.plaza, (T - 0.3) / 2 - 0.005);
    // bollards along the quay
    for (let i = 0; i < N; i += 2) for (const [x, z] of [[i - half + 0.5, -half - 0.95], [i - half + 0.5, half + 0.95], [-half - 0.95, i - half + 0.5], [half + 0.95, i - half + 0.5]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.1, 8), M.woodLo);
      b.position.set(x, T + 0.03, z); world.add(b);
    }
    town(half + QUAY + 3.2, T);
    // the docks
    for (const d of P.docks) {
      const [x, z] = cellXZ(d), g = new THREE.Group();
      g.position.set(x, 0, z);
      // a pier: a timber deck well over the water on four piles, a mooring post, a hut with a roof, and a lamp on a post
      g.add(box(0.82, 0.1, 0.82, M.wood, 0, 0.36, 0));
      for (const dz of [-0.2, 0.2]) g.add(box(0.8, 0.014, 0.03, M.woodLo, 0, 0.415, dz));
      for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8), M.woodLo); p.position.set(dx, -0.02, dz); g.add(p); }
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.16, 8), M.woodLo); bollard.position.set(0.26, 0.5, 0.26); g.add(bollard);
      g.add(box(0.34, 0.3, 0.28, M.wall[hash(d) * 3 | 0], 0.06, 0.56, -0.1), box(0.42, 0.07, 0.36, M.roof, 0.06, 0.74, -0.1));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), M.woodLo); post.position.set(-0.3, 0.66, 0.28); g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0x6f6f6f }));
      lamp.position.set(-0.3, 0.9, 0.28); g.add(lamp);
      world.add(g);
      docks.push({ cell: d, g, lamp, on: false });
    }
    // the counts, painted on the quay: labels of the page that follow the picture
    clueEls = [];
    for (let i = 0; i < 2 * N; i++) {
      const el = document.createElement("div");
      el.className = "mr3-n";
      el.textContent = P.need[i];
      labels.append(el);
      const c = i < N ? [-half - QUAY / 2, T + 0.12, i - half + 0.5] : [i - N - half + 0.5, T + 0.12, -half - QUAY / 2];
      clueEls.push({ el, p: new THREE.Vector3(...c), cls: "" });
    }
    fitPts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) fitPts.push(new THREE.Vector3(sx * (half + QUAY), 0, sz * (half + QUAY)));
    fitPts.push(new THREE.Vector3(0, 1, 0));
    marks = ""; won = false;
    restyle(); dirty = true;
  }
  /** The town behind the quay: warehouses, stacked containers and a crane, placed from the puzzle's grid so it is the same every time. */
  function town(from, T) {
    const rnd = (k, a) => hash(P.docks.length * 131 + N * 17 + k * 7 + a);
    for (let side = 0; side < 4; side++) for (let k = 0; k < 6; k++) {
      const along = (rnd(side * 10 + k, 1) - 0.5) * (N + 4), out = from + 1.2 + rnd(side * 10 + k, 2) * 7, w = 1.6 + rnd(side * 10 + k, 3) * 2.4, d = 1.4 + rnd(side * 10 + k, 4) * 1.6, h = 0.9 + rnd(side * 10 + k, 5) * 1.6;
      const [px, pz] = [[out, along], [-out, along], [along, out], [along, -out]][side], flip = side < 2;
      const wx = flip ? d : w, wz = flip ? w : d, kind = (rnd(side * 10 + k, 6) * 3) | 0;
      if (kind === 0) {          // stacked containers
        for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) world.add(box(wx * 0.45, 0.32, wz * 0.3, M.crate[(i + j + side) % 3], px + (i - 0.5) * wx * 0.5, T + 0.16 + (j > 1 ? 0.33 : 0), pz + ((j % 2) - 0.5) * wz * 0.35));
        continue;
      }
      world.add(box(wx, h, wz, M.wall[kind], px, T + h / 2 - 0.02, pz));
      world.add(box(wx * 1.06, 0.12, wz * 1.06, M.roof, px, T + h + 0.04, pz));
    }
    // a crane on the far quay
    const cx = -N * 0.2, cz = -(from + 0.3);
    world.add(box(0.3, 3.2, 0.3, M.woodLo, cx, T + 1.6, cz), box(0.18, 0.18, 4.2, M.woodLo, cx, T + 3.1, cz + 1.7), box(0.05, 1.3, 0.05, M.woodLo, cx, T + 2.45, cz + 3.4), box(0.5, 0.35, 0.5, M.crate[1], cx, T + 1.65, cz + 3.4));
  }

  // ---------- a barge: a slate hull along its dock's edge, a timber deck, two crates, a ring of foam ----------
  const hullGeo = (() => {
    const s = new THREE.Shape();
    [[-0.44, -0.23], [0.22, -0.23], [0.45, 0], [0.22, 0.23], [-0.44, 0.23]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.09, 0);
    return g;
  })();
  const deckGeo = new THREE.BoxGeometry(0.74, 0.025, 0.34), foamGeo = new THREE.BoxGeometry(1.02, 0.006, 0.68), crateGeo = new THREE.BoxGeometry(0.22, 0.17, 0.24);
  function angleOf(x) {
    const [r, c] = [Math.floor(x / N), x % N];
    if ((r > 0 && P.dock[x - N]) || (r < N - 1 && P.dock[x + N])) return 0;
    if ((c > 0 && P.dock[x - 1]) || (c < N - 1 && P.dock[x + 1])) return 90;
    return 0;
  }
  function cast(x) {
    const [px, pz] = cellXZ(x), g = new THREE.Group(), hull = new THREE.Mesh(hullGeo, solid(skin?.hull ?? 0x2f4f66));
    g.add(hull);
    const foam = new THREE.Mesh(foamGeo, M.foam); foam.position.y = 0.012; g.add(foam);
    const deck = new THREE.Mesh(deckGeo, M.deck); deck.position.set(-0.05, 0.215, 0); g.add(deck);
    const c1 = new THREE.Mesh(crateGeo, M.crate[hash(x) * 3 | 0]); c1.position.set(-0.2, 0.3, 0); g.add(c1);
    const c2 = new THREE.Mesh(crateGeo, M.crate[hash(x + 77) * 3 | 0]); c2.position.set(0.06, 0.3, 0); c2.scale.set(0.8, 0.9, 0.9); g.add(c2);
    g.rotation.y = angleOf(x) * DEG;
    g.position.set(px, 0, pz);
    world.add(g);
    barges.set(x, { g, hull, bad: false, x: px, z: pz, a: angleOf(x) * DEG, phase: hash(x + 3) * 6.28 });
  }
  function ripple(x) {
    const [px, pz] = cellXZ(x), g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.012, 24), M.ripple), b = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.014, 24), M.ripple2);
    a.position.y = 0.014; b.position.y = 0.0145; g.add(a, b);
    g.position.set(px, 0, pz);
    world.add(g);
    ripples.set(x, g);
  }
  function glow(x, mat) {
    const [px, pz] = cellXZ(x), m = box(0.94, 0.016, 0.94, mat, px, 0.04, pz);
    world.add(m);
    glows.set(x, m);
  }

  /** A new puzzle. */
  function set(puzzle) {
    P = puzzle; N = puzzle.N;
    build();
    reset();
  }
  /** After a change of marks, breaks or hint: barges cast off or moored, ripples, red hulls, lamps, counts, the hint's glow. */
  function update(next, br, hint) {
    if (!world) return;
    marks = next;
    const bad = new Set([...br.touch, ...br.stray]);
    for (let x = 0; x < P.cells; x++) {
      const m = next[x];
      if (m === "1" && !barges.has(x)) cast(x);
      if (m !== "1" && barges.has(x)) { const b = barges.get(x); world.remove(b.g); b.hull.material.dispose(); barges.delete(x); }
      if (m === "2" && !ripples.has(x)) ripple(x);
      if (m !== "2" && ripples.has(x)) { world.remove(ripples.get(x)); ripples.delete(x); }
    }
    for (const [x, b] of barges) { const isBad = bad.has(x); if (b.bad !== isBad) { b.bad = isBad; b.hull.material.color.setHex(isBad ? skin.red : skin.hull); } b.g.rotation.y = angleOf(x) * DEG; }
    const moored = new Set(br.moored);
    for (const d of docks) { const on = moored.has(d.cell); if (d.on !== on) { d.on = on; d.lamp.material.color.setHex(on ? skin.lampOn : skin.lampOff); } }
    const done = new Set(br.full), over = new Set(br.over);
    clueEls.forEach((c, i) => { const cls = `mr3-n${over.has(i) ? " over" : done.has(i) ? " done" : ""}`; if (c.cls !== cls) { c.cls = cls; c.el.className = cls; } });
    for (const m of glows.values()) world.remove(m);
    glows.clear();
    for (const x of hint?.focus || []) if (!glows.has(x)) glow(x, M.whyMat);
    for (const x of hint?.set || []) { if (glows.has(x)) world.remove(glows.get(x)); glow(x, M.litMat); }
    if (won) M.deck.color.setHex(skin.gilt);
    wake();
  }
  function celebrate() { won = true; M.deck.color.setHex(skin.gilt); wake(); }

  // ---------- the camera: round the board under a finger ----------
  let width = 1, height = 1, rem = 16, az = 0, el = HOME_UP, dist = 14, fitDist = 14, zoom = 1, dirty = true, orbited = false;
  const pan = { x: 0, z: 0 };
  const LOOK = new THREE.Vector3(), V = new THREE.Vector3(), G = new THREE.Vector3();
  function pose() {
    LOOK.set(pan.x, 0.1, pan.z);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** Whether every point to keep in view is on screen with `pad` pixels to spare, the camera `d` away, looking at the middle. */
  function fitsAt(d, aspect, near, top, right) {
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, 300);
    LOOK.set(0, 0.1, 0);
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    camera.up.set(0, 1, 0); camera.lookAt(LOOK); camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const px = (2 * 0.9 * rem) / width, py = (2 * 0.9 * rem) / height;
    for (const p of fitPts) { V.copy(p).applyMatrix4(camera.matrixWorldInverse); if (V.z > -near) return false; V.applyMatrix4(camera.projectionMatrix); if (Math.abs(V.x) > 1 - px || Math.abs(V.y) > 1 - py) return false; }
    return true;
  }
  function fit() {
    if (!N) return;
    const aspect = width / height, ty = Math.tan(FOV / 2), near = 0.5, top = near * ty, right = top * aspect;
    let lo = 4, hi = 200;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fitsAt(mid, aspect, near, top, right)) hi = mid; else lo = mid; }
    fitDist = hi;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, 300);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    dist = fitDist / zoom;
    pose();
    dirty = true;
  }
  function orbit(a, e) { orbited = true; az = a; el = Math.max(MIN_EL, Math.min(MAX_EL, e)); fit(); wake(); }
  function reset() { zoom = 1; pan.x = pan.z = 0; az = 0; orbited = false; resize(); }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    renderer.setSize(width, height, false);
    if (!orbited) el = height > width ? HOME_UP : HOME_SIDE;
    fit(); wake();
  }
  const ro = new ResizeObserver(() => { if (shown) resize(); });
  ro.observe(host);

  // ---------- zoom and pan ----------
  function groundAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, t = (0.1 - o.y) / (G.y - o.y);
    return { x: o.x + (G.x - o.x) * t, z: o.z + (G.z - o.z) * t };
  }
  const canvasPoint = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * (width / (r.width || 1)), (cy - r.top) * (height / (r.height || 1))]; };
  function clampPan() { const lim = (N / 2) * (1 - 1 / zoom) + 0.5; pan.x = Math.max(-lim, Math.min(lim, pan.x)); pan.z = Math.max(-lim, Math.min(lim, pan.z)); }
  function zoomAt(z, cx, cy) {
    if (!N) return;
    const [sx, sy] = cx == null ? [width / 2, height / 2] : canvasPoint(cx, cy), before = groundAt(sx, sy);
    zoom = Math.max(1, Math.min(MAX_ZOOM, z));
    fit();
    if (zoom === 1) pan.x = pan.z = 0; else { const after = groundAt(sx, sy); pan.x += before.x - after.x; pan.z += before.z - after.z; clampPan(); }
    fit(); wake();
  }
  function panBy(ax, ay, bx, by) {
    const p = groundAt(ax, ay), q = groundAt(bx, by);
    pan.x += p.x - q.x; pan.z += p.z - q.z;
    clampPan(); fit(); wake();
  }
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }, { passive: false });

  // ---------- playing it: a tap marks, a drag turns the view, two fingers zoom and pan ----------
  /** The cell under a finger at the page's (clientX, clientY), or -1. */
  function cellAtPoint(cx, cy) {
    if (!N) return -1;
    const [sx, sy] = canvasPoint(cx, cy), p = groundAt(sx, sy), c = Math.floor(p.x + N / 2), r = Math.floor(p.z + N / 2);
    return c < 0 || r < 0 || c >= N || r >= N ? -1 : r * N + c;
  }
  const fingers = new Map();
  let pinch = null, g = null;      // two fingers: { d0, zoom0, anchor }; the finger down: { id, x0, y0, x, y, turning }
  const pinchNow = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  canvas.addEventListener("pointerdown", e => {
    if (e.button === 2) { const x = cellAtPoint(e.clientX, e.clientY); if (x >= 0 && opts.playable?.()) opts.press?.(x, "dot"); return; }
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
    if (pinch && fingers.size >= 2) {
      const { d, mx, my } = pinchNow(), [sx, sy] = canvasPoint(mx, my);
      zoom = Math.max(1, Math.min(MAX_ZOOM, pinch.zoom0 * (d / pinch.d0)));
      fit();
      const now = groundAt(sx, sy);
      pan.x += pinch.anchor.x - now.x; pan.z += pinch.anchor.z - now.z;
      if (zoom === 1) pan.x = pan.z = 0; else clampPan();
      fit(); wake();
      return;
    }
    if (!g || e.pointerId !== g.id) return;
    if (!g.turning && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > SLIP * (rem / 16)) g.turning = true;
    if (g.turning) { orbit(az - (e.clientX - g.x) * 0.008, el + (e.clientY - g.y) * 0.006); }
    g.x = e.clientX; g.y = e.clientY;
  });
  const lift = e => {
    fingers.delete(e.pointerId);
    if (pinch) { if (fingers.size < 2) pinch = null; if (!fingers.size) g = null; return; }
    if (!g || e.pointerId !== g.id) return;
    const tap = !g.turning && e.type === "pointerup";
    g = null;
    if (!tap || !opts.playable?.()) return;
    const x = cellAtPoint(e.clientX, e.clientY);
    if (x >= 0) opts.press?.(x, "tap");
  };
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // ---------- drawing ----------
  let shown = false, held = false, frameId = 0, last = 0, busyUntil = 0;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function project(c) {
    V.copy(c.p).applyMatrix4(camera.matrixWorldInverse);
    if (V.z > -0.5) { c.el.style.display = "none"; return; }
    V.applyMatrix4(camera.projectionMatrix);
    c.el.style.display = "";
    c.el.style.transform = `translate(${((V.x + 1) / 2) * width}px, ${((1 - V.y) / 2) * height}px) translate(-50%, -50%)`;
  }
  function draw(now) {
    restyle();
    const t = now / 1000;
    for (const b of barges.values()) {
      b.g.position.y = WAVE(b.x, b.z, t) + 0.01 + (won ? 0.015 * Math.sin(t * 4 + b.phase) : 0);
      b.g.rotation.z = 0.02 * Math.sin(t * 0.9 + b.phase); b.g.rotation.x = 0.015 * Math.sin(t * 0.7 + b.phase * 2);
    }
    if (dirty || clueEls.length) {
      const k = Math.max(0.8, Math.min(1.35, (width / (N + 3)) / 26));       // the labels grow with the cells, so a number is as big as its room allows
      labels.style.setProperty("--k", k.toFixed(2));
      for (const c of clueEls) project(c);
      dirty = false;
    }
    renderer.render(scene, camera);
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last >= FRAME_MS - 2) { last = now; draw(now); }
    if (!still || now < busyUntil) frameId = requestAnimationFrame(frame);
  }
  /** Something happened (a touch, a change of the marks): draw at once, and keep drawing for a moment if the player asked for less motion. */
  function wake() {
    if (!shown || held || !world) return;
    busyUntil = performance.now() + 1200;
    if (still) draw(performance.now());
    if (!frameId) frameId = requestAnimationFrame(frame);
  }
  function show(on) {
    shown = on;
    if (on) { resize(); wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; }
  }
  function hold(on) { held = on; if (!on) wake(); }
  function destroy() {
    show(false); ro.disconnect(); dispose();
    renderer.dispose();
  }
  restyle();
  /** Where a cell's middle is on the page, for tests that tap it as a finger would. */
  function cellScreen(x) {
    const [px, pz] = cellXZ(x), r = canvas.getBoundingClientRect();
    V.set(px, 0.1, pz).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
  }
  return { set, update, show, hold, celebrate, dispose: destroy, orbit, cellScreen, get angles() { return { az, el, zoom }; } };
}
