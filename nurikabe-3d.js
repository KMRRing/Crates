// Atoll in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline): the whole board is solid land,
// a grassy block a cell, and the sea the player shades is carved out of it as a river, a channel whose bed lies lower and
// holds water. A number stays on the land that is left (a plate over its block, which stands a little higher, with a pale
// meadow on top); a dot, the player's note that a cell is island, is a stone on the turf. Same game as the flat board:
// a tap calls the page's press(cell, "tap") (it cycles clear, sea, dot) and a right click press(cell, "dot"); a drag turns
// the board, two fingers (or the wheel, or + and −) zoom in and move it, two taps on the bare card turn it back. The page
// calls set(puzzle) for a new puzzle and update(look) after a change. A block sinks or rises over a moment, and the frames
// are drawn only while something moves or a finger is down, so a board at rest costs nothing.
// Throws where there is no WebGL (the page then keeps the flat board).
import * as THREE from "./vendor/three.js";
import { SEA, LAND } from "./nurikabe-engine.js";
import { scale } from "./wide.js";

const DEG = Math.PI / 180;
export const MIN_EL = 32 * DEG, MAX_EL = 84 * DEG, FOV = 30 * DEG;
const HOME_AZ = 0;                               // the first view: the top of the flat board is the far side
const MAX_ZOOM = 3;                              // how far in: the board's fit is 1
const SLIP = 9;                                  // px a finger may stray and still tap
const BUSY_MS = 1000 / 30, BUSY_FOR = 900;       // the time between frames, and how long a touch keeps the drawing going
export const LAND_H = 0.7, CLUE_H = 0.8, BED_H = 0.12, WATER_H = 0.36, CAP = 0.12, GAP = 0.03;   // heights, in cells; the gap between two blocks
const SINK = 0.055;                              // seconds, the time constant of a block sinking or rising
const LOOK_Y = 0.25;                             // what the camera looks at, over the board's middle
const CLEAR = 0.55;                              // how far a solved river turns toward verdigris: it flashes gilt, then runs clear and green (gilt kept, blue and gold mix to grey)

const SKINS = {
  day: { turf: 0x78a652, meadow: 0x9bc16a, earth: 0x8b6a45, base: 0x5d4731, water: 0x3f8db4, bad: 0xa8382b, good: 0x2f9a6b, gilt: 0xc8923a, stone: 0xf1ece0, hemi: 1.1, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.4, exposure: 1 },
  night: { turf: 0x5f8745, meadow: 0x7da35c, earth: 0x735a3d, base: 0x4a3a28, water: 0x4d8db3, bad: 0xe8806f, good: 0x4fbf94, gilt: 0xe2b865, stone: 0xdcd6c6, hemi: 1.3, sky: 0xa5b4d2, ground: 0x1c2a38, key: 0xcfdcf6, keyI: 2.1, exposure: 1.1 },
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
  const labels = document.createElement("div");
  labels.className = "nk3-labels";
  host.replaceChildren(canvas, labels);

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

  const box = new THREE.BoxGeometry(1, 1, 1), stone = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  const solid = (extra = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const M = {
    earth: solid(), turf: solid(), base: solid(),
    water: solid({ roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.86, depthWrite: false }),
    stone: solid({ roughness: 0.6 }),
    halo: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
  };

  // ---------- the world: four instanced meshes a cell each (earth below, turf over it, water over the bed, a stone for a dot) and a halo for a hint ----------
  let N = 0, clue = [], plates = [], earth, turf, water, dots, halos, baseMesh;
  let cur = [], tgt = [], jitter = [], look = null, waveAt = 0, spinUntil = 0;
  const MA = new THREE.Matrix4(), Q = new THREE.Quaternion(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), C = new THREE.Color(), C2 = new THREE.Color(), C3 = new THREE.Color();
  const mesh = (geo, mat, n, shadow) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.castShadow = shadow === "cast"; m.receiveShadow = shadow !== "none";
    m.instanceMatrix.setUsage?.(35048);
    scene.add(m);
    return m;
  };
  function disposeWorld() {
    for (const m of [earth, turf, water, dots, halos, baseMesh]) if (m) { scene.remove(m); m.dispose?.(); }
    earth = turf = water = dots = halos = baseMesh = null;
  }
  /** A fixed spread of a cell's green, from its place only: the same board looks the same on every phone. */
  const spread = x => { const s = Math.sin(x * 12.9898 + 4.1414) * 43758.5453; return (s - Math.floor(s)) - 0.5; };
  function set(puzzle) {
    disposeWorld();
    N = puzzle.N; clue = puzzle.clue;
    const n = N * N;
    earth = mesh(box, M.earth, n, "cast"); turf = mesh(box, M.turf, n, "cast"); water = mesh(box, M.water, n, "receive");
    dots = mesh(stone, M.stone, n, "cast"); halos = mesh(box, M.halo, n, "none");
    baseMesh = mesh(box, M.base, 1, "cast");
    baseMesh.setMatrixAt(0, MA.compose(PV.set(0, -0.07, 0), Q.identity(), SV.set(N + 0.3, 0.14, N + 0.3)));
    baseMesh.setColorAt(0, C.set(skinNow().base));
    tgt = Array.from({ length: n }, (_, x) => (clue[x] ? CLUE_H : LAND_H));
    cur = tgt.slice();
    jitter = Array.from({ length: n }, (_, x) => spread(x));
    look = null; waveAt = 0;
    labels.replaceChildren();
    plates = [];
    for (let x = 0; x < n; x++) {
      if (!clue[x]) continue;
      const node = document.createElement("div");
      node.className = "nk3-n";
      node.textContent = clue[x];
      labels.appendChild(node);
      const [cx, cz] = cellXZ(N, x);
      plates.push({ x, el: node, p: new THREE.Vector3(cx, CLUE_H + 0.02, cz), w: 0, h: 0 });
    }
    measure = true; zoom = 1; pan.x = pan.z = 0; orbited = false;
    az = HOME_AZ; el = homeElevation(width / height);
    shapeSun();
    fit();
    place(true);
    wake();
  }
  /** Puts every instance where its block is now (heights `cur`) and colours the turf, water and halos from the page's look. */
  function place(colours) {
    if (!earth) return;
    const l = look, seaAt = x => l && l.marks[x] === SEA, landAt = x => l && l.marks[x] === LAND;
    const k = skinNow();
    for (let x = 0; x < N * N; x++) {
      const [cx, cz] = cellXZ(N, x), h = cur[x], w = 1 - GAP;
      const capH = Math.max(0.001, CAP * Math.min(1, (h - BED_H) / (LAND_H - BED_H)));     // the turf thins away as the block sinks
      earth.setMatrixAt(x, MA.compose(PV.set(cx, (h - capH) / 2, cz), Q.identity(), SV.set(w, h - capH, w)));     // the earth stops under the turf, so their tops never share a plane
      turf.setMatrixAt(x, MA.compose(PV.set(cx, h - capH / 2, cz), Q.identity(), SV.set(w + 0.002, capH, w + 0.002)));
      const depth = Math.max(0, WATER_H - h);
      water.setMatrixAt(x, MA.compose(PV.set(cx, h + depth / 2, cz), Q.identity(), depth > 0.002 ? SV.set(1, depth, 1) : SV.set(0, 0, 0)));
      const top = Math.max(h, depth > 0 ? WATER_H : 0);
      const dotted = landAt(x) ? 1 : 0;
      dots.setMatrixAt(x, MA.compose(PV.set(cx, h + 0.03, cz), Q.identity(), SV.set(0.2 * dotted, 0.06 * dotted + 0.0001, 0.2 * dotted)));
      const lit = l?.lit?.has(x), why = l?.why?.has(x), on = lit || why;
      halos.setMatrixAt(x, MA.compose(PV.set(cx, top + 0.03, cz), Q.identity(), on ? SV.set(lit ? 0.9 : 0.8, 0.045, lit ? 0.9 : 0.8) : SV.set(0, 0.0001, 0)));
      if (colours) {
        C.set(clue[x] ? k.meadow : k.turf);
        C.offsetHSL(0, 0, jitter[x] * 0.07);
        if (l?.over?.has(x)) C.lerp(C2.set(k.bad), 0.55);
        turf.setColorAt(x, C);
        earth.setColorAt(x, C.set(k.earth).offsetHSL(0, 0, jitter[x] * 0.05));
        dots.setColorAt(x, C.set(k.stone));
        halos.setColorAt(x, C.set(k.gilt).lerp(C2.set(0xffffff), lit ? 0 : 0.35));
      }
    }
    for (const m of [earth, turf, water, dots, halos]) m.instanceMatrix.needsUpdate = true;
    if (colours) for (const m of [earth, turf, dots, halos]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    seaColours(performance.now());
    if (colours) baseMesh.setColorAt(0, C.set(k.base));
    if (baseMesh.instanceColor) baseMesh.instanceColor.needsUpdate = true;
  }
  /** The river's colour a cell at a time: the water, red where a rule is broken, gilt in a wave from the top left once solved. Returns whether the wave is still running. */
  function seaColours(now) {
    if (!water) return false;
    const k = skinNow(), l = look;
    let running = false;
    for (let x = 0; x < N * N; x++) {
      C.set(k.water);
      if (l && (l.pool?.has(x) || l.cut?.has(x))) C.lerp(C2.set(k.bad), 0.62);
      if (l?.solved && waveAt) {
        const [cx, cz] = cellXZ(N, x), t = still ? 1e9 : now - waveAt - (cx + cz + N - 1) * 55;
        if (t < 800) running = true;
        // gilt at the peak, then settling to verdigris
        if (t > 0) {
          C3.set(k.water).lerp(C2.set(k.good), CLEAR);
          if (t < 320) C.lerp(C2.set(k.gilt), t / 320);
          else C.set(k.gilt).lerp(C3, Math.min(1, (t - 320) / 480));
        }
      }
      water.setColorAt(x, C);
    }
    if (water.instanceColor) water.instanceColor.needsUpdate = true;
    return running;
  }
  function update(next) {
    if (!earth) return;
    look = next;
    for (let x = 0; x < N * N; x++) tgt[x] = clue[x] ? CLUE_H : next.marks[x] === SEA ? BED_H : LAND_H;
    if (still) cur = tgt.slice();
    if (!next.solved) waveAt = 0;
    else if (!waveAt) waveAt = 1;                                      // a solved board loaded: its wave is long past (celebrate() plays it)
    for (const pl of plates) {
      const cl = pl.el.classList;
      cl.toggle("done", next.done?.has(pl.x) ?? false);
      cl.toggle("over", next.over?.has(pl.x) ?? false);
      cl.toggle("why", (next.why?.has(pl.x) || next.lit?.has(pl.x)) ?? false);
    }
    place(true);
    wake();
  }

  // ---------- the skin ----------
  function applySkin() {
    const k = skinNow();
    M.water.color.set(0xffffff);
    hemi.color.set(k.sky); hemi.groundColor.set(k.ground); hemi.intensity = k.hemi;
    sun.color.set(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    place(true);
    wake();
  }

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
    camDirty = true;
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
  let shown = false, held = false, frameId = 0, last = 0, busyUntil = 0, lastAt = 0, waving = false;
  function draw(now) {
    if (!earth) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastAt) / 1000));
    lastAt = now;
    if (spinUntil > now) { az += 0.35 * dt; fit(); }
    let moving = false;
    for (let x = 0; x < cur.length; x++) {
      if (cur[x] === tgt[x]) continue;
      const d = tgt[x] - cur[x];
      cur[x] = Math.abs(d) < 0.003 ? tgt[x] : cur[x] + d * (1 - Math.exp(-dt / SINK));
      moving = true;
    }
    if (moving) place(false);
    if (waving) waving = seaColours(now);
    if (camDirty || measure) placePlates();
    renderer.render(scene, camera);
    if (moving) busyUntil = Math.max(busyUntil, now + 120);
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last >= BUSY_MS - 2) { last = now; draw(now); }
    if (now < busyUntil || spinUntil > now) frameId = requestAnimationFrame(frame);
  }
  /** Something happened (a touch, a change of the marks): draw for a moment. */
  function wake() {
    if (!shown || held || !earth) return;
    busyUntil = performance.now() + BUSY_FOR;
        if (!frameId) { lastAt = performance.now(); frameId = requestAnimationFrame(frame); }
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
    return cellHit(N, cur, o, d);
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
    celebrate(ms = 6000) { waveAt = performance.now(); waving = !still; if (!still) spinUntil = waveAt + ms; place(true); wake(); },
    orbit, reset,
    get angles() { return [az, el]; },
    get view() { return { zoom, x: pan.x, z: pan.z }; },
    zoomTo(z, cx, cy) { zoomAt(z, cx, cy); },
    /** For tests: the page's (clientX, clientY) of a cell's top, as a finger would tap it. */
    where(x) {
      const [cx, cz] = cellXZ(N, x), r = canvas.getBoundingClientRect();
      V.set(cx, tgt[x], cz).project(camera);
      return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
    },
    pick: pickAt,
    /** For tests: the blocks' heights now, and what is on show. */
    get live() { return { heights: cur.slice(), targets: tgt.slice(), plates: plates.length, shown, calls: renderer.info.render.calls }; },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeWorld(); renderer.dispose(); },
  };
}
