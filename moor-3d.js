// Moor as a harbour, drawn with three.js (vendor/three.js, kept on the device, so it works offline): the puzzle is a basin of
// water laid out in cells, walled on three sides by a timber quay with the counts painted on it and open on the fourth to the
// harbour mouth between two moles (breakwaters), a lighthouse on one and a beacon on the other, and the open sea beyond with
// ships at anchor that are only scenery. Behind the quay stands a town of Hanseatic gabled warehouses with a crane. Each dock is
// a timber platform on piles with a lamp (green once its barge is moored), each barge a navy hull with a cream gunwale, a
// wheelhouse and crates, lying along the edge of its dock; open water you have noted is a ripple. It is the puzzle, played: a tap
// on a cell calls the page's press(cell, "tap") (the page moors, marks and clears, as on the chart), a right click press(cell,
// "dot"), a drag turns the view, two fingers (or the wheel) zoom in and pan, two taps beside the board put it back, and a hint's
// cells glow gilt. The page calls set(P) for a new puzzle and update(marks, breaks, hint) after a change. It draws only while it
// is on screen and nothing has paused it (the menu, a hidden tab), at most twenty-four frames a second. The scenery is a few
// instanced meshes (a draw call per material), so it stays cheap on a phone.
// Throws where there is no WebGL (the page then keeps the chart).
import * as THREE from "./vendor/three.js";
import { createGesture } from "./moor-gesture.js";

const DEG = Math.PI / 180;
const MIN_EL = 14 * DEG, MAX_EL = 86 * DEG, FOV = 30 * DEG, FAR = 420;
const HOME_UP = 68 * DEG, HOME_SIDE = 52 * DEG;      // the first view's elevation: higher on a tall card, lower on a wide one
const MAX_ZOOM = 3.2;
const SLIP = 9;                                 // pixels a finger may stray and still tap
const FRAME_MS = 1000 / 24;
const QUAY = 1.1, LAND = 70;                    // the quay's width, and how far the land reaches
const ARM = 3.4;                                  // how far the moles run out past the basin's open edge
const SEA_VIEW = 6;                           // how much sea the first view keeps beyond the basin
const WAVE = (x, z, t) => 0.012 * Math.sin(x * 1.1 + t * 0.9) + 0.01 * Math.sin(z * 1.4 - t * 0.7);

const SKINS = {
  day: { sea: 0x4a8fb5, foam: 0xffffff, quay: 0xb89a6a, quayLo: 0x8a6c42, ground: 0x93a872, plaza: 0xc9c2ad, wood: 0x9a6a3b, woodLo: 0x5e3f20, hull: 0x1d3750, rim: 0xf3e8c8, deck: 0xcfd8de, gilt: 0xe6b93a, red: 0xb5432f,
    crates: [0xb5432f, 0xc8923a, 0x3f7f78], walls: [0xa8523c, 0xd6b97a, 0xe4dac0, 0x8e9aa3], roofs: [0x6b3a2e, 0x4d5560], win: 0x34424e, rock: 0x8b8f8c, lampOff: 0x6f6f6f, lampOn: 0x3fbf7a,
    hemi: 1.15, sky: 0xfff4dc, under: 0x6d8fa6, key: 0xfff0d2, keyI: 2.3, exposure: 1.0, horizon: 0xd3e5ee, zenith: 0x6fa8dc, orb: 0xfff6cf, night: false },
  night: { sea: 0x2b5775, foam: 0xdfeaf5, quay: 0x8d7a58, quayLo: 0x65563c, ground: 0x4c5e42, plaza: 0x8f8a7b, wood: 0xb5854d, woodLo: 0x7a5430, hull: 0x9dbad0, rim: 0xfff0cf, deck: 0xdfe8ee, gilt: 0xf4cf6a, red: 0xd8705a,
    crates: [0xd8705a, 0xe2b865, 0x6fbdb3], walls: [0x91503f, 0xa38b60, 0xa09983, 0x71808a], roofs: [0x5b3328, 0x424a54], win: 0xf2c35c, rock: 0x74797a, lampOff: 0x8a8a8a, lampOn: 0x6ff0a8,
    hemi: 1.3, sky: 0xa5b4d2, under: 0x1c2a38, key: 0xcfdcf6, keyI: 1.9, exposure: 1.1, horizon: 0x33476a, zenith: 0x08102a, orb: 0xe9eefc, night: true },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { key: night ? "night" : "day", ...SKINS[night ? "night" : "day"] };
}
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
  renderer.setClearColor(0x000000, 1);
  const canvas = renderer.domElement;
  canvas.className = "mr3-gl";
  const labels = document.createElement("div");
  labels.className = "mr3-labels";
  // the Move switch: while on, a one-finger drag turns the view even across the board (a tap still marks); the first-time hint says the rest
  let moving = false;
  const moveBtn = document.createElement("button");
  moveBtn.type = "button"; moveBtn.className = "mr3-move"; moveBtn.textContent = "Move"; moveBtn.setAttribute("aria-pressed", "false");
  moveBtn.addEventListener("click", () => { moving = !moving; moveBtn.setAttribute("aria-pressed", String(moving)); });
  const tip = document.createElement("p");
  tip.className = "mr3-tip"; tip.textContent = "Tap marks · drag along a row marks water · drag the sea or use Move to turn · pinch zooms";
  let tipSeen = false;
  try { tipSeen = !!localStorage.getItem("moor:tip3d"); } catch { /* storage may be blocked */ }
  tip.hidden = tipSeen;
  const dropTip = () => { if (tip.hidden) return; tip.hidden = true; try { localStorage.setItem("moor:tip3d", "1"); } catch { /* storage may be blocked */ } };
  let tipTimer = 0;
  host.replaceChildren(canvas, labels, tip, moveBtn);
  if (!tipSeen) tipTimer = setTimeout(dropTip, 9000);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Bridges' is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, FAR);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-9, 14, 7);
  scene.add(hemi, sun);
  // haze: the bundle has no Fog, but the renderer only reads these fields of one
  const fog = { isFog: true, name: "Fog", color: new THREE.Color(0xffffff), near: 30, far: 150 };
  scene.fog = fog;
  // the sky: a dome shaded from the horizon's haze up to the zenith, and the sun or moon on it
  const domeGeo = new THREE.SphereGeometry(260, 20, 12), orbGeo = new THREE.SphereGeometry(9, 14, 10);
  domeGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(domeGeo.attributes.position.count * 3), 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: 1, fog: false, depthWrite: false, toneMapped: false }));
  const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false }));
  dome.frustumCulled = orb.frustumCulled = false;
  dome.renderOrder = -2; orb.renderOrder = -1;
  orb.position.set(-80, 70, -185);
  scene.add(dome, orb);

  const solid = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const shipMats = new Map();
  const sm = color => { if (!shipMats.has(color)) shipMats.set(color, solid(color)); return shipMats.get(color); };
  const M = {
    sea: solid(0x4a8fb5, { roughness: 0.55, metalness: 0.05 }), foam: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
    swell: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }),
    grid: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: 2 }),
    quay: solid(0xb89a6a), quayLo: solid(0x8a6c42), ground: solid(0x93a872), plaza: solid(0xc9c2ad), wood: solid(0x9a6a3b), woodLo: solid(0x5e3f20),
    deck: solid(0xd9b97a), rim: solid(0xf3e8c8), rock: solid(0x8b8f8c), cream: solid(0xeee6d2), red: solid(0xb5432f),
    roof: [0, 1].map(() => solid(0x6b3a2e)), crate: [0, 1, 2].map(() => solid(0xb5432f)), wall: [0, 1, 2, 3].map(() => solid(0xd8cfb8)),
    win: new THREE.MeshBasicMaterial({ color: 0x34424e }), lantern: new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
    beam: new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.13, depthWrite: false, blending: 2 }),
    ripple: solid(0xffffff, { transparent: true, opacity: 0.55 }), ripple2: solid(0x4a8fb5),
    litMat: new THREE.MeshBasicMaterial({ color: 0xe6b93a, transparent: true, opacity: 0.6, depthWrite: false }),
    whyMat: new THREE.MeshBasicMaterial({ color: 0xe6b93a, transparent: true, opacity: 0.28, depthWrite: false }),
  };
  let skin = null;
  const restyle = () => {
    const k = skinNow();
    if (skin && skin.key === k.key) return;
    skin = k;
    M.sea.color.setHex(k.sea); M.ripple2.color.setHex(k.sea); M.foam.color.setHex(k.foam); M.swell.color.setHex(k.foam); M.ripple.color.setHex(k.foam);
    for (const [m, c] of [[M.quay, k.quay], [M.quayLo, k.quayLo], [M.ground, k.ground], [M.plaza, k.plaza], [M.wood, k.wood], [M.woodLo, k.woodLo], [M.deck, k.deck], [M.rim, k.rim], [M.rock, k.rock], [M.win, k.win], [M.red, k.red]]) m.color.setHex(c);
    M.roof.forEach((m, i) => m.color.setHex(k.roofs[i])); M.crate.forEach((m, i) => m.color.setHex(k.crates[i])); M.wall.forEach((m, i) => m.color.setHex(k.walls[i]));
    M.litMat.color.setHex(k.gilt); M.whyMat.color.setHex(k.gilt); M.lantern.color.setHex(k.night ? 0xffe28a : 0xf5efd8);
    M.beam.visible = k.night;
    hemi.color.setHex(k.sky); hemi.groundColor.setHex(k.under); hemi.intensity = k.hemi; sun.color.setHex(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    fog.color.setHex(k.horizon); renderer.setClearColor(k.horizon, 1);
    orb.material.color.setHex(k.orb);
    const lo = new THREE.Color(k.horizon), hi = new THREE.Color(k.zenith), pos = domeGeo.attributes.position, col = domeGeo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.pow(Math.max(0, Math.min(1, pos.getY(i) / 260)), 0.55);
      col.setXYZ(i, lo.r + (hi.r - lo.r) * t, lo.g + (hi.g - lo.g) * t, lo.b + (hi.b - lo.b) * t);
    }
    col.needsUpdate = true;
    for (const b of barges.values()) b.hull.material.color.setHex(b.bad ? k.red : k.hull);
    for (const d of docks) d.lamp.material.color.setHex(d.on ? k.lampOn : k.lampOff);
    dirty = true;
  };

  // ---------- the puzzle on show ----------
  let P = null, N = 0, world = null, barges = new Map(), docks = [], ripples = new Map(), glows = new Map(), clueEls = [], marks = "", won = false, fitPts = [], fx = null;
  const cellXZ = x => [(x % N) - N / 2 + 0.5, Math.floor(x / N) - N / 2 + 0.5];
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  function dispose() {
    if (world) { scene.remove(world); world.traverse(o => o.geometry?.dispose()); }
    world = null; barges = new Map(); docks = []; ripples = new Map(); glows = new Map(); clueEls = []; fx = null;
    labels.replaceChildren();
  }

  /** The basin, its quay, the moles and the sea, the town behind, the docks and the counts. */
  function build() {
    dispose();
    world = new THREE.Group();
    scene.add(world);
    const T = 0.34;                                                    // the quay's height over the water
    const half = N / 2, HX = half + QUAY, L = HX + LAND;
    const HOOK = N * 0.2 + 0.8;                                       // how far each mole's head bends in: the harbour mouth is what is left
    // ----- scenery as instances of unit shapes: one draw call per shape and material -----
    const prism = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
    const spire = new THREE.ConeGeometry(0.5, 1, 4); spire.rotateY(Math.PI / 4);
    const geo = { box: new THREE.BoxGeometry(1, 1, 1), prism, cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cone: spire };
    const acc = new Map(), tmp = new THREE.Matrix4();
    /** An instance of a unit shape scaled (w, h, d), put at (x, y, z) turned about y, x, z, inside `parent`'s frame. */
    const put = (g, mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0, parent = null) => {
      const m = new THREE.Matrix4();
      if (parent) m.copy(parent);
      m.multiply(tmp.makeTranslation(x, y, z));
      if (ry) m.multiply(tmp.makeRotationY(ry));
      if (rx) m.multiply(tmp.makeRotationX(rx));
      if (rz) m.multiply(tmp.makeRotationZ(rz));
      m.multiply(tmp.makeScale(w, h, d));
      const key = `${mat.uuid}${Object.keys(geo).find(k => geo[k] === g)}`;
      if (!acc.has(key)) acc.set(key, { g, mat, ms: [] });
      acc.get(key).ms.push(m);
    };
    const frame = (x, z, ry) => new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(ry));
    // the sea, wide enough to meet the haze
    world.add(box(340, 2, 340, M.sea, 0, -1, 0));
    // the cells, drawn as pale lines on the water (where a finger may tap)
    const pos = [], idx = [];
    const strip = (x0, z0, x1, z1) => { const n = pos.length / 3, w = 0.018; if (x0 === x1) pos.push(x0 - w, 0.012, z0, x0 + w, 0.012, z0, x0 - w, 0.012, z1, x0 + w, 0.012, z1); else pos.push(x0, 0.012, z0 - w, x0, 0.012, z0 + w, x1, 0.012, z1 - w, x1, 0.012, z1 + w); idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); };
    for (let i = 0; i <= N; i++) { strip(i - half, -half, i - half, half); strip(-half, i - half, half, i - half); }
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    grid.setIndex(idx);
    world.add(new THREE.Mesh(grid, M.grid));
    // the quay: the far side and the two moles, each a timber slab with a darker lip on the water side
    const slab = (x0, x1, z0, z1, mat, h = T + 0.3, y = (T - 0.3) / 2) => put(geo.box, mat, x1 - x0, h, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2);
    const zEnd = half + ARM;
    slab(-HX, HX, -HX, -half, M.quay);
    slab(-HX, -half, -HX, zEnd, M.quay); slab(half, HX, -HX, zEnd, M.quay);
    slab(-HX, -half + 0.0, zEnd - QUAY, zEnd, M.quay);
    put(geo.box, M.quayLo, 2 * half + 0.12, T + 0.42, 0.12, 0, (T - 0.42) / 2 + 0.02, -half);
    for (const s of [-1, 1]) put(geo.box, M.quayLo, 0.12, T + 0.42, zEnd + half, s * half, (T - 0.42) / 2 + 0.02, (zEnd - half) / 2);
    // each mole's head bends in toward the mouth, with a pad for the light
    for (const s of [-1, 1]) {
      slab(s > 0 ? half - HOOK : -half, s > 0 ? half : -(half - HOOK), zEnd - QUAY, zEnd, M.quay);
      put(geo.box, M.quayLo, 1.5, T + 0.42, 1.5, s * (half - HOOK + 0.35), (T - 0.42) / 2 + 0.02, zEnd - 0.4);
    }
    // the land behind and beside: ground, a paved strip along the quay, and a sea wall where it meets the water
    slab(-L, L, -L, -HX, M.ground, T + 0.3, (T - 0.3) / 2 - 0.02);
    for (const s of [-1, 1]) slab(s > 0 ? HX : -L, s > 0 ? L : -HX, -HX, half, M.ground, T + 0.3, (T - 0.3) / 2 - 0.02);
    slab(-(HX + 3.2), HX + 3.2, -(HX + 3.2), -HX, M.plaza, T + 0.3, (T - 0.3) / 2 - 0.005);
    for (const s of [-1, 1]) {
      slab(s > 0 ? HX : -(HX + 3.2), s > 0 ? HX + 3.2 : -HX, -HX, half, M.plaza, T + 0.3, (T - 0.3) / 2 - 0.005);
      slab(s > 0 ? HX : -L, s > 0 ? L : -HX, half, half + 0.3, M.quayLo, T + 0.6, (T - 0.6) / 2 - 0.02);
    }
    // bollards along the quay and the moles
    for (let i = 0; i < N; i += 2) put(geo.cyl, M.woodLo, 0.12, 0.1, 0.12, i - half + 0.5, T + 0.03, -half - 0.95);
    for (const s of [-1, 1]) for (let z = -half + 0.5; z < zEnd - 0.6; z += 2) put(geo.cyl, M.woodLo, 0.12, 0.1, 0.12, s * (half + 0.95), T + 0.03, z);
    // rock armour on the right mole's sea face, and a white edge of surf on both
    for (let z = half + 0.1, i = 0; z < zEnd + 0.8; z += 0.55, i++) {
      const sz = 0.5 + hash(i + 9) * 0.35;
      put(geo.box, M.rock, sz, sz * 0.8, sz, HX + 0.1 + hash(i + 3) * 0.3, 0.05, z, hash(i) * 3, hash(i + 5) * 0.5, hash(i + 7) * 0.5);
      put(geo.box, M.rock, sz * 0.9, sz * 0.7, sz, -(HX + 0.1 + hash(i + 13) * 0.3), 0.05, z, hash(i + 2) * 3, hash(i + 6) * 0.5, hash(i + 8) * 0.5);
    }
    for (const s of [-1, 1]) put(geo.box, M.foam, 0.45, 0.01, ARM + 0.8, s * (HX + 0.35), 0.02, half + (ARM + 0.8) / 2 - 0.1);
    town(put, geo, frame, T, half, HX);
    // the lighthouse on the right mole's head, a red beacon on the left
    const lx = half - HOOK + 0.35, lz = zEnd - 0.4, LH = new THREE.Matrix4().makeTranslation(lx, 0, lz);
    for (let i = 0; i < 4; i++) put(geo.cyl, i % 2 ? M.red : M.cream, 0.78 - i * 0.07, 0.62, 0.78 - i * 0.07, 0, T + 0.31 + i * 0.62, 0, 0, 0, 0, LH);
    put(geo.cyl, M.woodLo, 0.92, 0.08, 0.92, 0, T + 2.54, 0, 0, 0, 0, LH);
    put(geo.cyl, M.lantern, 0.4, 0.34, 0.4, 0, T + 2.75, 0, 0, 0, 0, LH);
    put(geo.cone, M.red, 0.62, 0.4, 0.62, 0, T + 3.12, 0, 0, 0, 0, LH);
    const BK = new THREE.Matrix4().makeTranslation(-lx, 0, lz);
    put(geo.cyl, M.red, 0.34, 0.9, 0.34, 0, T + 0.45, 0, 0, 0, 0, BK);
    put(geo.cyl, M.lantern, 0.24, 0.24, 0.24, 0, T + 1.0, 0, 0, 0, 0, BK);
    for (const { g, mat, ms } of acc.values()) {
      const im = new THREE.InstancedMesh(g, mat, ms.length);
      ms.forEach((m, i) => im.setMatrixAt(i, m));
      im.frustumCulled = false;
      world.add(im);
    }
    // the lighthouse's beam, which turns at night
    const beam = new THREE.Group();
    beam.add(box(7, 0.1, 0.3, M.beam, 3.5, 0, 0), box(7, 0.1, 0.3, M.beam, -3.5, 0, 0));
    beam.position.set(lx, T + 2.75, lz);
    world.add(beam);
    fx = { beam, ships: [], gulls: [], swell: null };
    // the sea beyond: swell lines drifting, ships at anchor, gulls
    const swell = [];
    for (let i = 0; i < 26; i++) swell.push({ x: (hash(i + 1) - 0.5) * 90, z: zEnd + 2 + hash(i + 40) * 46, len: 2 + hash(i + 80) * 4, ph: hash(i + 120) * 6.28 });
    const sw = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.01, 0.09), M.swell, swell.length);
    sw.frustumCulled = false;
    world.add(sw);
    fx.swell = { mesh: sw, list: swell };
    ships(half, HX, zEnd, HOOK);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), wing = s => { const p = new THREE.Group(); p.add(box(0.1, 0.012, 0.3, M.cream, 0, 0, s * 0.15)); p.position.z = 0; return p; };
      const body = box(0.2, 0.05, 0.07, M.cream, 0, 0, 0), l = wing(1), r = wing(-1);
      g.add(body, l, r);
      g.scale.setScalar(0.75);
      world.add(g);
      fx.gulls.push({ g, l, r, cx: (hash(i + 200) - 0.5) * N * 0.6, cz: half + 1 + hash(i + 210) * 4, rad: 3 + hash(i + 220) * 5, h: 2.2 + hash(i + 230) * 2.5, sp: 0.25 + hash(i + 240) * 0.2, ph: hash(i + 250) * 6.28 });
    }
    // the docks
    for (const d of P.docks) {
      const [x, z] = cellXZ(d), g = new THREE.Group();
      g.position.set(x, 0, z);
      // a pier: a timber deck well over the water on four piles, a mooring post, a hut with a roof, and a lamp on a post
      g.add(box(0.7, 0.1, 0.7, M.wood, 0, 0.36, 0));
      for (const dz of [-0.2, 0.2]) g.add(box(0.68, 0.014, 0.03, M.woodLo, 0, 0.415, dz));
      for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.9, 8), M.woodLo); p.position.set(dx, -0.02, dz); g.add(p); }
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.16, 8), M.woodLo); bollard.position.set(0.22, 0.5, 0.22); g.add(bollard);
      g.add(box(0.28, 0.24, 0.24, M.wall[hash(d) * 4 | 0], 0.04, 0.53, -0.1), box(0.34, 0.06, 0.3, M.roof[0], 0.04, 0.68, -0.1));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), M.woodLo); post.position.set(-0.25, 0.62, 0.24); g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0x6f6f6f }));
      lamp.position.set(-0.25, 0.84, 0.24); g.add(lamp);
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
    // what the first view keeps on screen: the quay's corners, the town's first row, and some sea out to the mole's head
    fitPts = [];
    for (const sx of [-1, 1]) { fitPts.push(new THREE.Vector3(sx * HX, 0, -HX - 2)); fitPts.push(new THREE.Vector3(sx * HX, 0, half + SEA_VIEW)); }
    fitPts.push(new THREE.Vector3(0, 1, 0));
    marks = ""; won = false;
    restyle(); dirty = true;
  }

  /** One Hanseatic warehouse in `P`'s frame, its front on +z: a wall, a stepped gable above it, a steep roof behind, windows, a hoist. */
  function house(put, geo, P, T, w, h, d, wi, ri, lit) {
    put(geo.box, M.wall[wi], w, h, d, 0, T + h / 2 - 0.02, 0, 0, 0, 0, P);
    for (let i = 0; i < 4; i++) put(geo.box, M.wall[wi], w * (0.86 - 0.2 * i), 0.26, 0.14, 0, T + h + 0.13 + 0.26 * i - 0.02, d / 2 - 0.07, 0, 0, 0, P);
    put(geo.prism, M.roof[ri], w * 0.98, 1.04, d * 1.02, 0, T + h - 0.02, 0, 0, 0, 0, P);
    const floors = Math.max(1, Math.round(h / 0.75)), cols = Math.max(2, Math.round(w / 0.7));
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      if (f === 0 && c === Math.floor(cols / 2)) { put(geo.box, M.woodLo, 0.34, 0.5, 0.03, (c - (cols - 1) / 2) * (w / cols), T + 0.25, d / 2 + 0.015, 0, 0, 0, P); continue; }
      put(geo.box, M.win, 0.15, 0.25, 0.03, (c - (cols - 1) / 2) * (w / cols), T + 0.5 + f * 0.72, d / 2 + 0.015, 0, 0, 0, P);
    }
    put(geo.box, M.woodLo, 0.08, 0.08, 0.5, 0, T + h + 0.7, d / 2 + 0.2, 0, 0, 0, P);
  }
  /** The town behind the quay: a street of gabled warehouses facing the water along the far side and both flanks, a second row and a church behind, container stacks and a portal crane. Placed from the puzzle's size, so the same every time. */
  function town(put, geo, frame, T, half, HX) {
    const front = HX + 2.9;
    // the far side, shoulder to shoulder, and the taller row behind it
    for (let x = -(half + 11), i = 0; x < half + 11; i++) {
      const w = 1.7 + hash(i * 7 + N) * 1.3, h = 1.5 + hash(i * 7 + N + 1) * 1.5, d = 2.4 + hash(i * 7 + N + 2) * 0.8;
      if (!(x + w / 2 > half * 0.12 && x + w / 2 < half * 0.12 + 3.2)) house(put, geo, frame(x + w / 2, -front - d / 2, 0), T, w, h, d, (hash(i * 7 + N + 3) * 4) | 0, hash(i + 77) < 0.5 ? 0 : 1);
      x += w + 0.08;
    }
    for (let x = -(half + 9), i = 0; x < half + 9; i++) {
      const w = 2 + hash(i * 5 + 300) * 1.6, h = 2.3 + hash(i * 5 + 301) * 1.8, d = 3;
      house(put, geo, frame(x + w / 2, -front - 6.4 - d / 2, 0), T, w, h, d, (hash(i * 5 + 302) * 4) | 0, hash(i + 177) < 0.5 ? 0 : 1);
      x += w + 0.2;
    }
    const ch = new THREE.Matrix4().makeTranslation(-half * 0.55, 0, -front - 4.2);          // the church: a tower and a spire over the roofs
    put(geo.box, M.wall[0], 1.5, 4.6, 1.5, 0, T + 2.3, 0, 0, 0, 0, ch);
    put(geo.cone, M.roof[1], 1.9, 3.2, 1.9, 0, T + 6.2, 0, 0, 0, 0, ch);
    for (const dx of [-1, 1]) put(geo.box, M.win, 0.18, 0.7, 0.03, dx * 0.3, T + 3.8, 0.76, 0, 0, 0, ch);
    // the flanks, facing inward
    for (const s of [-1, 1]) for (let z = -HX + 0.5, i = 0; z < half - 2; i++) {
      const w = 1.7 + hash(i * 3 + 500 + s) * 1.2, h = 1.4 + hash(i * 3 + 501 + s) * 1.3, d = 2.2 + hash(i * 3 + 502 + s) * 0.7;
      if (i % 4 !== 3) house(put, geo, frame(s * (front + d / 2), z + w / 2, -s * Math.PI / 2), T, w, h, d, (hash(i * 3 + 503 + s) * 4) | 0, hash(i + 277 + s) < 0.5 ? 0 : 1);
      z += w + 0.1;
    }
    // containers stacked on the right flank's paving
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k <= j; k++) put(geo.box, M.crate[(i + j + k) % 3], 0.62, 0.3, 1.5, HX + 1.15 + j * 0.7, T + 0.15 + k * 0.31, half - 2.4 - i * 0.8);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) put(geo.box, M.crate[(i + k * 2) % 3], 1.5, 0.3, 0.62, half * 0.45 + i * 0.8, T + 0.15 + k * 0.31, -HX - 1.2);
    // a portal crane over the far quay: four legs, a bridge, a cab, a jib reaching out over the water and a counter-jib behind
    const C = frame(-half * 0.3, -(HX + 1.9), 0);
    for (const [dx, dz] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) put(geo.box, M.woodLo, 0.12, 1.9, 0.12, dx, T + 0.95, dz, 0, 0, 0, C);
    put(geo.box, M.woodLo, 1.7, 0.14, 1.3, 0, T + 1.95, 0, 0, 0, 0, C);
    put(geo.box, M.crate[1], 0.5, 0.36, 0.5, 0, T + 2.2, -0.1, 0, 0, 0, C);
    put(geo.box, M.woodLo, 0.1, 0.1, 3.4, 0, T + 2.6, 1.3, 0, -0.34, 0, C);
    put(geo.box, M.woodLo, 0.1, 0.1, 1.2, 0, T + 2.22, -0.9, 0, 0.34, 0, C);
    put(geo.box, M.rock, 0.4, 0.3, 0.4, 0, T + 2.05, -1.35, 0, 0, 0, C);
    put(geo.box, M.woodLo, 0.03, 1.1, 0.03, 0, T + 2.4, 2.65, 0, 0, 0, C);
    put(geo.box, M.crate[0], 0.5, 0.3, 0.9, 0, T + 1.7, 2.65, 0, 0, 0, C);
  }
  /** Ships at anchor and a coaster at the left mole, beyond the puzzle and not to be played: bigger, duller, and rocking on their own. */
  function ships(half, HX, zEnd, HOOK) {
    const hullG = (() => {
      const s = new THREE.Shape();
      [[-0.5, -0.5], [0.22, -0.5], [0.5, 0], [0.22, 0.5], [-0.5, 0.5]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const part = (g, mat, w, h, d, x, y, z, rz = 0) => { const m = new THREE.Mesh(g, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.z = rz; return m; };
    const unit = new THREE.BoxGeometry(1, 1, 1), tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    const add = (g, x, z, ry, sway) => { g.position.set(x, 0, z); g.rotation.y = ry; world.add(g); fx.ships.push({ g, x, z, ph: hash(Math.round(x * 7 + z * 3)) * 6.28, sway }); };
    // a tanker
    let g = new THREE.Group();
    g.add(part(hullG, sm(0x7a2a22), 7, 1, 1.7, 0, -0.62, 0), part(unit, sm(0x3d4a52), 6.4, 0.06, 1.4, -0.2, 0.4, 0), part(unit, sm(0xeeeeee), 0.9, 1.2, 1.4, -2.7, 0.95, 0), part(unit, sm(0xeeeeee), 0.7, 0.4, 1.3, -2.7, 1.75, 0), part(tube, sm(0xb5432f), 0.35, 0.7, 0.35, -3.1, 1.9, 0));
    for (let i = 0; i < 4; i++) g.add(part(tube, sm(0x9aa3a8), 0.55, 0.3, 0.55, -1 + i * 1.15, 0.58, 0));
    add(g, half * 0.5 + 2.4, zEnd + 8, -0.5, 0.01);
    // a Hanseatic cog under no sail but a furled one
    g = new THREE.Group();
    g.add(part(hullG, sm(0x7a3a24), 2.8, 1.0, 1.0, 0, -0.55, 0), part(unit, sm(0x7a5230), 0.9, 0.5, 1.1, -1.3, 0.75, 0), part(unit, sm(0x7a5230), 0.6, 0.4, 1.0, 1.2, 0.7, 0), part(tube, sm(0x5e3f20), 0.09, 3, 0.09, 0.1, 1.6, 0), part(unit, sm(0xf0e6c8), 0.1, 0.12, 1.7, 0.1, 1.9, 0), part(unit, sm(0xf0e6c8), 0.9, 0.04, 0.9, 0.1, 0.5, 0), part(unit, sm(0xb5432f), 0.25, 0.04, 0.25, 0.1, 3.1, 0));
    g.scale.setScalar(0.8);
    add(g, -half * 0.12, zEnd + 1.3, 0.3, 0.02);
    // a coaster moored along the left mole's sea face
    g = new THREE.Group();
    g.add(part(hullG, sm(0x23507a), 3.4, 0.9, 1.0, 0, -0.5, 0), part(unit, sm(0x6b7a80), 2.2, 0.06, 0.85, 0.2, 0.36, 0), part(unit, sm(0xf0ece0), 0.7, 0.7, 0.9, -1.2, 0.75, 0), part(tube, sm(0xe6b93a), 0.22, 0.5, 0.22, -1.35, 1.3, 0));
    add(g, -(HX + 0.75), half + 1.6, -Math.PI / 2, 0.01);
    // a container ship far out
    g = new THREE.Group();
    g.add(part(hullG, sm(0x26343f), 9, 1.1, 2.1, 0, -0.65, 0), part(unit, sm(0xeeeeee), 0.9, 1.5, 1.8, -3.6, 1.1, 0));
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) g.add(part(unit, M.crate[(i + k) % 3], 0.9, 0.42, 1.7, -2.4 + i * 1.0, 0.65 + k * 0.43, 0));
    add(g, -4, zEnd + 34, 0.12, 0.006);
  }

  // ---------- a barge: a navy hull along its dock's edge with a cream gunwale, a wheelhouse, a deck and two crates, a ring of foam ----------
  const outline = (s) => { const sh = new THREE.Shape(); [[-0.48, -0.37], [0.17, -0.37], [0.49, 0], [0.17, 0.37], [-0.48, 0.37]].forEach(([x, y], i) => (i ? sh.lineTo(x * s, y * s) : sh.moveTo(x * s, y * s))); sh.closePath(); return sh; };
  const flat = (shape, depth, y) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  const hullGeo = flat(outline(1), 0.36, -0.12), rimGeo = flat(outline(1.05), 0.04, 0.215);
  const deckGeo = new THREE.BoxGeometry(0.82, 0.025, 0.62), foamGeo = new THREE.BoxGeometry(1.08, 0.006, 0.88), crateGeo = new THREE.BoxGeometry(0.26, 0.22, 0.4), houseGeo = new THREE.BoxGeometry(0.24, 0.26, 0.5), roofGeo = new THREE.BoxGeometry(0.3, 0.04, 0.56);
  function angleOf(x) {
    const [r, c] = [Math.floor(x / N), x % N];
    if ((r > 0 && P.dock[x - N]) || (r < N - 1 && P.dock[x + N])) return 0;
    if ((c > 0 && P.dock[x - 1]) || (c < N - 1 && P.dock[x + 1])) return 90;
    return 0;
  }
  function cast(x) {
    const [px, pz] = cellXZ(x), g = new THREE.Group(), hull = new THREE.Mesh(hullGeo, solid(skin?.hull ?? 0x1d3750));
    g.add(hull);
    g.add(new THREE.Mesh(rimGeo, M.rim));
    const foam = new THREE.Mesh(foamGeo, M.swell); foam.position.y = 0.012; g.add(foam);
    const deck = new THREE.Mesh(deckGeo, M.deck); deck.position.set(-0.03, 0.245, 0); g.add(deck);
    const wh = new THREE.Mesh(houseGeo, M.wall[1]); wh.position.set(-0.3, 0.39, 0); g.add(wh);
    const rf = new THREE.Mesh(roofGeo, M.roof[0]); rf.position.set(-0.3, 0.535, 0); g.add(rf);
    const c1 = new THREE.Mesh(crateGeo, M.crate[hash(x) * 3 | 0]); c1.position.set(0.02, 0.365, 0); g.add(c1);
    const c2 = new THREE.Mesh(crateGeo, M.crate[hash(x + 77) * 3 | 0]); c2.position.set(0.27, 0.345, 0); c2.scale.set(0.8, 0.8, 0.9); g.add(c2);
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
  const CZ = (SEA_VIEW - 1.2) / 2 - 0.4;     // the view's middle sits toward the sea, since the quay's town is cropped and the sea is kept
  let width = 1, height = 1, rem = 16, az = 0, el = HOME_UP, dist = 14, fitDist = 14, zoom = 1, dirty = true, orbited = false;
  const pan = { x: 0, z: 0 };
  const LOOK = new THREE.Vector3(), V = new THREE.Vector3(), G = new THREE.Vector3();
  function pose() {
    LOOK.set(pan.x, 0.1, pan.z + CZ);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  /** Whether every point to keep in view is on screen with `pad` pixels to spare, the camera `d` away, looking at the middle. */
  function fitsAt(d, aspect, near, top, right) {
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, FAR);
    LOOK.set(0, 0.1, CZ);
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d).add(LOOK);
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
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    dist = fitDist / zoom;
    fog.near = Math.max(40, dist * 2.2); fog.far = Math.max(fog.near + 40, Math.min(dist * 7, 170));
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
  /** The point of the water (y = 0.1) under a pixel of the canvas; far off when the pixel is sky. */
  function groundAt(sx, sy) {
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const o = camera.position, dy = G.y - o.y;
    if (dy > -1e-4) return { x: 1e6, z: 1e6 };
    const t = (0.1 - o.y) / dy;
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
    if (Math.abs(p.x) > 1e5 || Math.abs(q.x) > 1e5) return;
    pan.x += p.x - q.x; pan.z += p.z - q.z;
    clampPan(); fit(); wake();
  }
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }, { passive: false });

  // ---------- playing it: a tap marks, a drag from a cell paints water and one from the sea turns the view, two fingers zoom and pan, two taps beside the board put it back ----------
  /** The cell under a finger at the page's (clientX, clientY), or -1. */
  function cellAtPoint(cx, cy) {
    if (!N) return -1;
    const [sx, sy] = canvasPoint(cx, cy), p = groundAt(sx, sy), c = Math.floor(p.x + N / 2), r = Math.floor(p.z + N / 2);
    return c < 0 || r < 0 || c >= N || r >= N ? -1 : r * N + c;
  }
  let pinch = null, lastTap = null, reach = null;      // pinch: { zoom0, anchor } while two fingers are down
  const gesture = createGesture(() => SLIP * (rem / 16), {
    // a drag that begins on a cell of a game in play paints water, as on the flat board; anywhere else (or on Move, or with shift) it turns
    marks: (cx, cy, shift) => !moving && !shift && !!opts.playable?.() && cellAtPoint(cx, cy) >= 0,
    paint: (cx, cy, begin) => {
      dropTip();
      if (begin) reach = opts.stroke?.(cellAtPoint(cx, cy)) || null; else reach?.(cellAtPoint(cx, cy));
      wake();
    },
    paintEnd: () => { reach = null; },
    pinchStart: (mx, my) => { pinch = { zoom0: zoom, anchor: groundAt(...canvasPoint(mx, my)) }; },
    pinchMove: (scale, mx, my) => {
      if (!pinch) return;
      const [sx, sy] = canvasPoint(mx, my);
      zoom = Math.max(1, Math.min(MAX_ZOOM, pinch.zoom0 * scale));
      fit();
      const now = groundAt(sx, sy);
      if (Math.abs(now.x) < 1e5 && Math.abs(pinch.anchor.x) < 1e5) { pan.x += pinch.anchor.x - now.x; pan.z += pinch.anchor.z - now.z; }
      if (zoom === 1) pan.x = pan.z = 0; else clampPan();
      fit(); wake();
    },
    pinchEnd: () => { pinch = null; },
    turn: (dx, dy, shift, x, y) => {
      dropTip();
      if (shift) panBy(...canvasPoint(x - dx, y - dy), ...canvasPoint(x, y));      // shift and drag moves the board
      else orbit(az - dx * 0.008, el + dy * 0.006);
    },
    tap: (cx, cy) => {
      if (!opts.playable?.()) return;
      const x = cellAtPoint(cx, cy);
      if (x >= 0) { lastTap = null; opts.press?.(x, "tap"); return; }
      const now = performance.now();       // two taps beside the board turn it back to where it began
      if (lastTap && now - lastTap.t < 350 && Math.hypot(cx - lastTap.x, cy - lastTap.y) < 30) { lastTap = null; reset(); } else lastTap = { t: now, x: cx, y: cy };
    },
  });
  canvas.addEventListener("pointerdown", e => {
    if (e.button === 2) { const x = cellAtPoint(e.clientX, e.clientY); if (x >= 0 && opts.playable?.()) opts.press?.(x, "dot"); return; }
    if (e.button > 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    gesture.down(e.pointerId, e.clientX, e.clientY, e.isPrimary, e.shiftKey && e.pointerType === "mouse");
  });
  canvas.addEventListener("pointermove", e => gesture.move(e.pointerId, e.clientX, e.clientY, e.shiftKey && e.pointerType === "mouse"));
  const lift = e => gesture.up(e.pointerId, e.clientX, e.clientY, e.type !== "pointerup");
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("lostpointercapture", e => { if (gesture.busy && !e.target.hasPointerCapture?.(e.pointerId)) lift(e); });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // ---------- drawing ----------
  let shown = false, held = false, frameId = 0, last = 0, busyUntil = 0;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sm4 = new THREE.Matrix4();
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
    if (fx) {
      for (const s of fx.ships) { s.g.position.y = 0.05 + WAVE(s.x, s.z, t) * 2; s.g.rotation.z = s.sway * Math.sin(t * 0.6 + s.ph) * 2; s.g.rotation.x = s.sway * Math.cos(t * 0.5 + s.ph); }
      fx.swell.list.forEach((w, i) => {
        sm4.makeScale(w.len * (0.75 + 0.25 * Math.sin(t * 0.8 + w.ph)), 1, 1).setPosition(w.x + 1.5 * Math.sin(t * 0.25 + w.ph), 0.02, w.z + 1.2 * Math.sin(t * 0.35 + w.ph * 1.3));
        fx.swell.mesh.setMatrixAt(i, sm4);
      });
      fx.swell.mesh.instanceMatrix.needsUpdate = true;
      for (const b of fx.gulls) {
        const a = b.sp * t + b.ph;
        b.g.position.set(b.cx + b.rad * Math.cos(a), b.h + 0.25 * Math.sin(a * 3), b.cz + b.rad * Math.sin(a));
        b.g.rotation.y = -Math.atan2(Math.cos(a), -Math.sin(a));
        const f = 0.5 * Math.sin(t * 6 + b.ph);
        b.l.rotation.x = f; b.r.rotation.x = -f;
      }
      if (M.beam.visible) fx.beam.rotation.y = t * 0.9;
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
    if (on) { resize(); wake(); } else { gesture.cancel(); if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } }
  }
  function hold(on) { held = on; if (on) gesture.cancel(); else wake(); }
  function destroy() {
    clearTimeout(tipTimer);
    show(false); ro.disconnect(); dispose();
    domeGeo.dispose(); orbGeo.dispose();
    renderer.dispose();
  }
  restyle();
  /** Where a cell's middle is on the page, for tests that tap it as a finger would. */
  function cellScreen(x) {
    const [px, pz] = cellXZ(x), r = canvas.getBoundingClientRect();
    V.set(px, 0.1, pz).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    return { x: r.left + ((V.x + 1) / 2) * r.width, y: r.top + ((1 - V.y) / 2) * r.height };
  }
  return { set, update, show, hold, celebrate, dispose: destroy, orbit, reset, cellScreen, get angles() { return { az, el, zoom }; } };
}
