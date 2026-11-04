// Carrom's board in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline). The only view the game has: a
// birch board in a walnut frame tipped away from you, the men as turned counters, the striker on your baseline. It draws what it
// is told, replays a shot with carrom-engine.js's own simulation (the very steps the game was decided by, so what is seen is what
// was played, on every phone) and takes the touches: slide the striker along the baseline, pull back from it to aim and set the
// power, let go to shoot.
// Light by construction: three InstancedMeshes for the men, one for the striker, one for the soft shadows, a static mesh for the
// board and its markings and one dynamic mesh for the aim; it draws only while something moves; the pixel ratio is at most 2. When a
// phone is slow the physics does not change (the steps come from a clock, as many as are owed, never fewer): the shadows and
// the pixel ratio go instead (`lite`).
import * as THREE from "./vendor/three.js";
import { startSim, stepSim, firstContact, baseY, L, R, RS, PC, XR, MEN, STRIKER } from "./carrom-engine.js";

const S = 0.01, DEG = Math.PI / 180, FOV = 30 * DEG;
const FRAME = 0.5, FRAME_H = 0.16, SLAB = 0.34, MAN_H = 0.14, STRIKER_H = 0.15;
const STEPS_PER_MS = 0.12;                           // 120 steps a second, the pace a shot is played at
const MAX_PER_FRAME = 10;
const PULL_MIN = 34, PULL_MAX = 300;                 // board units: the finger's distance from the striker, where aiming starts and full power is
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DYNAMIC = 35048;

function parseCss(text, fallback) {
  const s = String(text || "").trim();
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i) || s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return m.slice(1, 4).map(v => (s.startsWith("color(") ? Number(v) * 255 : Number(v)));
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (h) { const f = h.length === 3 ? [...h].map(c => c + c).join("") : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); }
  return fallback;
}
const lin = ([r, g, b]) => { const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, "srgb"); return [c.r, c.g, c.b]; };
const shade = (rgb, k) => rgb.map(v => clamp(v * k, 0, 255));

/** A triangle soup with a colour (r, g, b, a) a vertex, for the board's markings and the aim. */
function soup(cap) {
  const p = new Float32Array(cap * 3), c = new Float32Array(cap * 4);
  const o = { p, c, n: 0, cap, clear() { o.n = 0; } };
  o.v = (x, y, z, col) => {
    if (o.n >= cap) { if (!o.full) { o.full = true; console.warn("carrom-3d: a mesh ran out of room"); } return; }
    p[o.n * 3] = x; p[o.n * 3 + 1] = y; p[o.n * 3 + 2] = z;
    c[o.n * 4] = col[0]; c[o.n * 4 + 1] = col[1]; c[o.n * 4 + 2] = col[2]; c[o.n * 4 + 3] = col[3] ?? 1;
    o.n++;
  };
  o.tri = (a, b, d, y, col) => { o.v(a[0], y, a[1], col); o.v(b[0], y, b[1], col); o.v(d[0], y, d[1], col); };
  o.quad = (a, b, d, e, y, col) => { o.tri(a, b, d, y, col); o.tri(a, d, e, y, col); };
  /** A line of width w from (x0, z0) to (x1, z1). */
  o.line = (x0, z0, x1, z1, w, y, col) => {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
    o.quad([x0 + nx, z0 + nz], [x0 - nx, z0 - nz], [x1 - nx, z1 - nz], [x1 + nx, z1 + nz], y, col);
  };
  o.disc = (cx, cz, r, y, col, edge = col, segs = 28) => {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      o.v(cx, y, cz, col); o.v(cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r, edge); o.v(cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r, edge);
    }
  };
  o.ring = (cx, cz, r0, r1, y, col, segs = 40) => {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      o.quad([cx + c0 * r0, cz + s0 * r0], [cx + c0 * r1, cz + s0 * r1], [cx + c1 * r1, cz + s1 * r1], [cx + c1 * r0, cz + s1 * r0], y, col);
    }
  };
  /** A triangle pointing from (x, z) along (dx, dz), `len` long and `w` wide at its base. */
  o.arrow = (x, z, dx, dz, len, w, y, col) => {
    const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    o.tri([x + ux * len, z + uz * len], [x - uz * w / 2, z + ux * w / 2], [x + uz * w / 2, z - ux * w / 2], y, col);
  };
  return o;
}
const toGeometry = (q, n = q.n) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(q.p.slice(0, n * 3), 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(q.c.slice(0, n * 4), 4));
  return g;
};

/** A counter turned on a lathe: profile points [radius, height, colourIndex], revolved round the vertical axis, shaded smooth round and hard between rings. */
function lathe(profile, colours, segs = 30) {
  const pos = [], nor = [], col = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, y0, c0] = profile[k], [r1, y1] = profile[k + 1];
    const dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy) || 1, nr = dy / l, ny = -dr / l;       // the segment's outward normal
    const colr = colours[c0];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, cs = [Math.cos(a0), Math.cos(a1)], sn = [Math.sin(a0), Math.sin(a1)];
      const P = (rr, yy, j) => [rr * cs[j], yy, rr * sn[j]], N = j => [nr * cs[j], ny, nr * sn[j]];
      const quad = [[P(r0, y0, 0), N(0)], [P(r1, y1, 0), N(0)], [P(r1, y1, 1), N(1)], [P(r0, y0, 1), N(1)]];
      for (const idx of [0, 1, 2, 0, 2, 3]) { pos.push(...quad[idx][0]); nor.push(...quad[idx][1]); col.push(...colr); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const counter = (r, h, body, groove) => lathe([[0, 0, 0], [r - 0.02, 0, 0], [r, 0.018, 0], [r, h - 0.03, 0], [r - 0.02, h, 0], [r * 0.74, h, 0], [r * 0.74, h - 0.006, 1], [r * 0.5, h - 0.006, 1], [r * 0.5, h, 0], [0, h, 0]], [body, groove]);

/**
 * The scene in `host` (an empty box the board fills). hooks: slide(x) a finger moving the striker along the baseline, shoot(shot)
 * a shot let go, aim({ power, valid }) while aiming, lost() the graphics were lost for good. Throws where there is no WebGL.
 */
export function createScene(host, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  let ratioCap = 2, lite = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, ratioCap));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "ca-gl";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The carrom board");
  canvas.style.touchAction = "none";
  host.replaceChildren(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);        // a perspective one made from its parts (the bundle has none)
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1), key = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, key, key.target);

  const pal = { surface: [226, 196, 140], wood: [92, 58, 38], line: [90, 52, 30], red: [168, 56, 43], pocket: [20, 18, 18], white: [243, 233, 208], black: [44, 38, 35], queen: [178, 44, 38], striker: [46, 130, 138], brass: [184, 137, 45], ok: [47, 125, 91], bad: [168, 56, 43], night: false };
  const stdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.02 });
  const flat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: 2 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  const decalMat = flat(), aimMat = flat(), shadowMat = flat();
  decalMat.polygonOffset = true; decalMat.polygonOffsetFactor = -2; decalMat.polygonOffsetUnits = -2;

  // ---------- the board: slab, surface, frame, and the markings on it ----------
  const board = new THREE.Group();
  const surfaceMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 10), boardMat);
  surfaceMesh.position.y = -0.025;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(10 + 2 * FRAME, SLAB, 10 + 2 * FRAME), frameMat);
  slab.position.y = -0.05 - SLAB / 2;
  const rails = [[FRAME, 10 + 2 * FRAME, 5 + FRAME / 2, 0], [FRAME, 10 + 2 * FRAME, -5 - FRAME / 2, 0], [10, FRAME, 0, 5 + FRAME / 2], [10, FRAME, 0, -5 - FRAME / 2]].map(([w, d, x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, FRAME_H, d), frameMat);
    m.position.set(x, FRAME_H / 2, z);
    return m;
  });
  board.add(slab, surfaceMesh, ...rails);
  scene.add(board);
  const decals = soup(12000), decalMesh = new THREE.Mesh(new THREE.BufferGeometry(), decalMat);
  decalMesh.frustumCulled = false; decalMesh.renderOrder = 1;
  scene.add(decalMesh);
  function drawDecals() {
    const d = decals, ink = [...lin(pal.line), 1], red = [...lin(pal.red), 1], blk = [...lin(pal.pocket), 1], brass = [...lin(pal.brass), 1], Y = 0.004;
    d.clear();
    // the pockets: a hole in each corner of the frame and the board, ringed in brass
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * PC * S, cz = sz * PC * S;
      d.disc(cx, cz, 0.53, Y + 0.001, brass, brass, 30);
      d.disc(cx, cz, 0.47, Y + 0.002, blk, blk, 30);
      d.disc(cx, cz, 0.53, FRAME_H + 0.003, brass, brass, 30);
      d.disc(cx, cz, 0.47, FRAME_H + 0.004, blk, blk, 30);
      // a corner arrow, the way each corner is drawn on a board
      d.line(sx * 3.55, sz * 3.55, sx * 2.55, sz * 2.55, 0.035, Y, ink);
      d.arrow(sx * 2.45, sz * 2.45, -sx, -sz, 0.34, 0.26, Y, ink);
      d.ring(sx * 4.2, sz * 4.2, 0.1, 0.135, Y, ink, 24);
    }
    // the baselines: a band with a ring at each end, the striker's place; and the middle: two rings
    for (const sgn of [-1, 1]) {
      const zz = sgn * 3.8;
      for (const o of [-0.26, 0.26]) d.line(-2.9, zz + o, 2.9, zz + o, 0.03, Y, ink);
      for (const ex of [-2.9, 2.9]) { d.ring(ex, zz, 0.24, 0.27, Y, ink, 28); d.disc(ex, zz, 0.17, Y, red, red, 24); }
      d.line(-3.3, zz - sgn * 0.5, 3.3, zz - sgn * 0.5, 0.025, Y, [...ink.slice(0, 3), 0.55]);
    }
    for (const sgn of [-1, 1]) {                       // the same two baselines across the board
      const xx = sgn * 3.8;
      for (const o of [-0.26, 0.26]) d.line(xx + o, -2.9, xx + o, 2.9, 0.03, Y, ink);
      for (const ez of [-2.9, 2.9]) { d.ring(xx, ez, 0.24, 0.27, Y, ink, 28); d.disc(xx, ez, 0.17, Y, red, red, 24); }
    }
    d.ring(0, 0, 0.84, 0.88, Y, ink, 56); d.ring(0, 0, 0.38, 0.41, Y, red, 40); d.disc(0, 0, 0.1, Y, red, red, 20);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3927; d.line(Math.cos(a) * 0.5, Math.sin(a) * 0.5, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.025, Y, red); }
    d.ring(0, 0, 3.0, 3.03, Y, [...ink.slice(0, 3), 0.5], 80);
    const g = toGeometry(d);
    decalMesh.geometry.dispose();
    decalMesh.geometry = g;
  }

  // ---------- the men ----------
  let manGeo = null;
  const men = {
    white: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 9),
    black: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 9),
    queen: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 1),
    striker: new THREE.InstancedMesh(new THREE.BufferGeometry(), stdMat, 1),
  };
  for (const m of Object.values(men)) { m.instanceMatrix.setUsage(DYNAMIC); m.frustumCulled = false; scene.add(m); }
  const disc = soup(120); disc.disc(0, 0, 1, 0, [0, 0, 0, 0.34], [0, 0, 0, 0], 20);
  const SHADOWS = MEN + 1;
  const shadows = new THREE.InstancedMesh(toGeometry(disc), shadowMat, SHADOWS);
  shadows.instanceMatrix.setUsage(DYNAMIC); shadows.frustumCulled = false; shadows.renderOrder = 2;
  scene.add(shadows);

  const aim = soup(6000), aimMesh = new THREE.Mesh(new THREE.BufferGeometry(), aimMat);
  const aimGeo = new THREE.BufferGeometry();
  aimGeo.setAttribute("position", new THREE.Float32BufferAttribute(aim.p, 3));
  aimGeo.setAttribute("color", new THREE.Float32BufferAttribute(aim.c, 4));
  aimGeo.attributes.position.setUsage(DYNAMIC); aimGeo.attributes.color.setUsage(DYNAMIC);
  aimGeo.setDrawRange(0, 0);
  aimMesh.geometry = aimGeo; aimMesh.frustumCulled = false; aimMesh.renderOrder = 3;
  scene.add(aimMesh);

  function applySkin() {
    const cs = getComputedStyle(document.documentElement), get = (n, f) => parseCss(cs.getPropertyValue(n), f);
    const root = document.documentElement;
    pal.night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    for (const [k, v, f] of [["surface", "--ca-board", pal.surface], ["wood", "--ca-frame", pal.wood], ["line", "--ca-line", pal.line], ["red", "--ca-red", pal.red], ["pocket", "--ca-pocket", pal.pocket],
      ["white", "--ca-white", pal.white], ["black", "--ca-black", pal.black], ["queen", "--ca-queen", pal.queen], ["striker", "--ca-striker", pal.striker], ["brass", "--brass", pal.brass]]) pal[k] = get(v, f);
    boardMat.color.setRGB(...lin(pal.surface));
    frameMat.color.setRGB(...lin(pal.wood));
    for (const m of [boardMat, frameMat]) m.needsUpdate = true;
    const mk = (c, g) => counter(R * S, MAN_H, lin(c), lin(g));
    men.white.geometry.dispose(); men.white.geometry = mk(pal.white, shade(pal.white, 0.62));
    men.black.geometry.dispose(); men.black.geometry = mk(pal.black, shade(pal.black, 2.4));
    men.queen.geometry.dispose(); men.queen.geometry = mk(pal.queen, shade(pal.queen, 0.62));
    men.striker.geometry.dispose(); men.striker.geometry = counter(RS * S, STRIKER_H, lin(pal.striker), lin(shade(pal.striker, 1.5)));
    hemi.color.set(pal.night ? 0xb9c4e0 : 0xfff6e4); hemi.groundColor.set(pal.night ? 0x2a2c38 : 0x7a6a55); hemi.intensity = pal.night ? 1.7 : 1.5;
    key.color.set(pal.night ? 0xd6defa : 0xfff1d6); key.intensity = pal.night ? 1.9 : 2.2;
    drawDecals();
    aimKey = "";
    wake();
  }

  // ---------- where everything is ----------
  // Each body 0..19 (the striker last): x, y in board units, on (drawn), fall (the sim step it went down at, or -1), pop (when it appeared, ms)
  const B = { x: new Float64Array(MEN + 1), y: new Float64Array(MEN + 1), on: new Uint8Array(MEN + 1), fall: new Int32Array(MEN + 1).fill(-1), pocket: new Uint8Array(MEN + 1), pop: new Float64Array(MEN + 1).fill(-1e9) };
  let state = null;                                   // the last state drawn (px, py, st)
  let play = null;                                    // a shot being replayed: { sim, from, to, acc, at, done }
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function put(st, now, popIds = []) {
    state = st;
    for (let i = 0; i < MEN; i++) {
      const on = st.st[i] === 0;
      if (on && !B.on[i]) B.pop[i] = popIds.includes(i) ? now : -1e9;
      B.on[i] = on ? 1 : 0; B.x[i] = st.px[i]; B.y[i] = st.py[i]; B.fall[i] = -1;
    }
    B.on[STRIKER] = 0;
  }
  const manMesh = i => (i === 0 ? men.queen : i <= 9 ? men.white : men.black);
  const M4 = new THREE.Matrix4(), POS = new THREE.Vector3(), QUAT = new THREE.Quaternion(), SCL = new THREE.Vector3();
  const slot = i => (i === 0 ? 0 : i <= 9 ? i - 1 : i - 10);
  function place(mesh, k, x, y, h, sc) {
    POS.set(x * S, h, -y * S); SCL.set(sc, sc, sc);
    M4.compose(POS, QUAT, SCL); mesh.setMatrixAt(k, M4);
  }
  const hidden = (mesh, k) => { POS.set(0, -5, 0); SCL.set(0.001, 0.001, 0.001); M4.compose(POS, QUAT, SCL); mesh.setMatrixAt(k, M4); };
  /** Draws every body where it is: a fallen one sinking into its pocket, a returned one growing. */
  function layout(now) {
    let busy = false;
    for (let i = 0; i <= MEN; i++) {
      const mesh = i === STRIKER ? men.striker : manMesh(i), k = i === STRIKER ? 0 : slot(i);
      let x = B.x[i], y = B.y[i], h = 0, sc = 1, show = B.on[i] === 1;
      if (B.fall[i] >= 0) {                           // sinking into the pocket over a dozen steps
        const t = clamp(((play ? play.sim.steps : B.fall[i] + 99) - B.fall[i]) / 14, 0, 1);
        if (t < 1) {
          const px = (B.pocket[i] & 1 ? PC : -PC), py = (B.pocket[i] & 2 ? PC : -PC);
          x += (px - x) * t; y += (py - y) * t; h = -0.28 * t; sc = 1 - 0.5 * t; show = true; busy = true;
        } else show = false;
      }
      if (show && B.pop[i] > -1e8) {
        const u = clamp((now - B.pop[i]) / 320, 0, 1);
        if (u < 1) { sc *= 0.2 + 0.8 * (1 - (1 - u) * (1 - u)); busy = true; }
      }
      if (!show) { hidden(mesh, k); POS.set(0, -5, 0); SCL.set(0.001, 0.001, 0.001); M4.compose(POS, QUAT, SCL); shadows.setMatrixAt(i, M4); continue; }
      place(mesh, k, x, y, h, sc);
      const r = lite ? 0.001 : (i === STRIKER ? RS : R) * S * 1.12 * sc;      // lite: no soft shadows
      POS.set(x * S, 0.006, -y * S); SCL.set(r, 1, r); M4.compose(POS, QUAT, SCL); shadows.setMatrixAt(i, M4);
    }
    for (const m of [...Object.values(men), shadows]) m.instanceMatrix.needsUpdate = true;
    return busy;
  }

  // ---------- the aim: what the page says is happening on the baseline ----------
  let model = { seat: 0, x: 0, canPlay: false, blocked: [] };        // the page's: whose shot, the striker's place, whether a finger may act
  let pull = null;                                                   // the finger: { mode: "slide" | "pull", to: [bx, by], power, valid, ux, uy }
  let aimKey = "";
  const AIMY = 0.012;
  function drawAim() {
    const showing = !play && model.canPlay;
    const key2 = JSON.stringify([showing, model.seat, model.x, model.guide, model.blocked, pull && [pull.mode, Math.round(pull.to?.[0]), Math.round(pull.to?.[1])], state && state.n, state && state.shots]);
    if (key2 === aimKey) return false;
    aimKey = key2;
    aim.clear();
    if (!showing) { aimGeo.setDrawRange(0, 0); return true; }
    const sy = baseY(model.seat), sx = model.x, z = -sy * S, x = sx * S, c = a => [...lin(pal.brass), a];
    const ink = [...lin(pal.white), 0.9];
    // the baseline's free stretch, with arrows each side of the striker saying it slides
    aim.line(-XR * S, z, XR * S, z, 0.07, AIMY - 0.004, [...lin(pal.brass), pull?.mode === "slide" ? 0.55 : 0.28]);
    for (const [a, b] of model.blocked || []) aim.line(a * S, z, b * S, z, 0.09, AIMY - 0.002, [...lin(pal.bad), 0.7]);
    if (!pull || pull.mode === "slide") {
      aim.arrow(x - 0.46, z, -1, 0, 0.2, 0.24, AIMY, c(0.9)); aim.arrow(x + 0.46, z, 1, 0, 0.2, 0.24, AIMY, c(0.9));
    }
    aim.ring(x, z, RS * S, RS * S + 0.03, AIMY, c(0.95), 28);
    if (pull && pull.mode === "pull" && pull.valid != null) {
      const col = pull.valid ? (pull.power > 0.75 ? [...lin(pal.bad), 0.95] : pull.power > 0.4 ? [...lin(pal.brass), 0.95] : [...lin(pal.ok), 0.95]) : [...lin(pal.bad), 0.55];
      // the band back to the finger, growing with the pull
      aim.line(x, z, pull.to[0] * S, -pull.to[1] * S, 0.05 + 0.1 * pull.power, AIMY + 0.001, col);
      aim.disc(pull.to[0] * S, -pull.to[1] * S, 0.13, AIMY + 0.002, col, col, 18);
      if (pull.valid && model.guide !== "off" && state) {
        const hit = firstContact(state.px, state.py, state.st, sx, sy, pull.ux, pull.uy);
        // dashes from the striker to where it first touches, a ring where it stops, and the line the struck man will take
        const total = hit.t * S;
        for (let d = 0.34; d < total - 0.12; d += 0.34) aim.line(x + pull.ux * d, z - pull.uy * d, x + pull.ux * Math.min(d + 0.18, total), z - pull.uy * Math.min(d + 0.18, total), 0.045, AIMY, ink);
        aim.ring(hit.x * S, -hit.y * S, RS * S - 0.02, RS * S + 0.012, AIMY, ink, 28);
        if (hit.id >= 0) {
          const mx = state.px[hit.id], my = state.py[hit.id], dx = mx - hit.x, dy = my - hit.y, l = Math.hypot(dx, dy) || 1;
          const nx = dx / l, ny = dy / l;
          for (let d = R + 10; d < 330; d += 30) aim.line((mx + nx * d) * S, -(my + ny * d) * S, (mx + nx * (d + 14)) * S, -(my + ny * (d + 14)) * S, 0.04, AIMY, [...lin(pal.brass), 0.85]);
        }
      }
    }
    const n = aim.n, pos = aimGeo.attributes.position, col = aimGeo.attributes.color;
    pos.array.set(aim.p.subarray(0, n * 3)); col.array.set(aim.c.subarray(0, n * 4));
    pos.clearUpdateRanges(); col.clearUpdateRanges(); pos.addUpdateRange(0, n * 3); col.addUpdateRange(0, n * 4);
    pos.needsUpdate = col.needsUpdate = true;
    aimGeo.setDrawRange(0, n);
    return true;
  }

  // ---------- the camera: from the shooter's side, tilted, fitted to the room ----------
  let width = 1, height = 1, yaw = 0, yawTo = 0, yawFrom = 0, yawAt = -1;
  const LOOK = new THREE.Vector3(0, 0, 0.1), V = new THREE.Vector3(), G = new THREE.Vector3();
  const FIT = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.4, FRAME_H + 0.1]) FIT.push([sx * (5 + FRAME), y, sz * (5 + FRAME)]);
  let homeEl = 58 * DEG;
  function fit() {
    const aspect = width / height, ty = Math.tan(FOV / 2), top = ty, right = ty * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, 1, 90);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const el = homeEl, ce = Math.cos(el), se = Math.sin(el);
    const place = d => {
      camera.position.set(Math.sin(yaw) * ce * d, se * d, Math.cos(yaw) * ce * d).add(LOOK);
      camera.up.set(0, 1, 0); camera.lookAt(LOOK); camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    };
    const fits = d => {
      place(d);
      for (const [x, y, z] of FIT) {
        V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        const dep = -V.z; V.applyMatrix4(camera.projectionMatrix);
        if (dep <= 1 || Math.abs(V.x) > 1 - 10 / width || Math.abs(V.y) > 1 - 6 / height) return false;
      }
      return true;
    };
    let lo = 6, hi = 70;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    place(hi);
    key.position.set(Math.sin(yaw - 0.7) * 9, 12, Math.cos(yaw - 0.7) * 9);
    key.target.position.set(0, 0, 0);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    homeEl = (width / height > 1.1 ? 74 : 70) * DEG;                 // as steep as still looks like a table: the steeper, the larger the board in the room
    fit();
    wake();
  }
  const project = (x, y, z) => {
    V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const depth = -V.z;
    V.applyMatrix4(camera.projectionMatrix);
    return [((V.x + 1) / 2) * width, ((1 - V.y) / 2) * height, depth];
  };
  /** The board point (in board units) under a pixel, on the plane the men slide on. */
  function boardAt(cx, cy) {
    const r = canvas.getBoundingClientRect(), sx = (cx - r.left) * (width / (r.width || 1)), sy = (cy - r.top) * (height / (r.height || 1));
    G.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const p = camera.position, dx = G.x - p.x, dy = G.y - p.y, dz = G.z - p.z, h = 0.1;
    if (Math.abs(dy) < 1e-9) return null;
    const t = (h - p.y) / dy;
    return t > 0 ? [(p.x + dx * t) / S, -(p.z + dz * t) / S] : null;
  }
  /** Pixels a board unit covers at the striker (for how big a finger's target is). */
  function pixelsPerUnit() {
    const [ax, ay] = project(model.x * S, 0.1, -baseY(model.seat) * S), [bx, by] = project((model.x + 100) * S, 0.1, -baseY(model.seat) * S);
    return Math.hypot(bx - ax, by - ay) / 100 || 0.3;
  }

  // ---------- the frame loop ----------
  let frameId = 0, shown = true, paused = false, dirty = true, lastDraw = 0, slow = 0, frames = 0, lostTimer = 0;
  function tick(now) {
    let busy = false;
    if (yawAt >= 0) {                                // the board turned to the other player
      const u = clamp((now - yawAt) / 420, 0, 1), e = u * u * (3 - 2 * u);
      yaw = yawFrom + (yawTo - yawFrom) * e;
      fit();
      if (u >= 1) yawAt = -1; else busy = true;
    }
    if (play && !play.held) {
      const dt = clamp(now - play.at, 0, 120);
      play.at = now;
      play.acc += dt * STEPS_PER_MS;
      let n = 0;
      while (play.acc >= 1 && !play.sim.done && n < MAX_PER_FRAME + (lite ? 6 : 0)) {
        stepSim(play.sim);
        for (const e of play.sim.events) if (B.fall[e.id] < 0 && !(play.sim.on[e.id])) { B.fall[e.id] = e.step; B.pocket[e.id] = e.pocket; }
        play.acc -= 1; n++;
      }
      const s = play.sim;
      for (let i = 0; i <= MEN; i++) { if (B.fall[i] < 0 && s.on[i]) { B.x[i] = s.x[i]; B.y[i] = s.y[i]; B.on[i] = 1; } else if (B.fall[i] < 0) B.on[i] = 0; }
      if (s.done) finish(now); else busy = true;
    }
    if (layout(now)) busy = true;
    if (drawAim()) busy = true;
    return busy;
  }
  function finish(now) {
    const p = play; play = null;
    const done = p.done;
    if (p.to) put(p.to, now, p.pops || []);
    layout(now);
    dirty = true;
    done?.();
  }
  function frame(now) {
    frameId = 0;
    if (!shown || paused || document.hidden) return;
    if (now - lastDraw < 14) { frameId = requestAnimationFrame(frame); return; }
    const began = performance.now();
    lastDraw = now; dirty = false;
    const moving = tick(now);
    renderer.render(scene, camera);
    frames++;
    const took = performance.now() - began;
    if (frames > 20 && !lite) { slow = slow * 0.92 + took * 0.08; if (slow > 22) goLite(); }     // a phone that cannot keep up: the soft shadows and the sharp pixels go, the physics never
    if (moving || dirty || play) frameId = requestAnimationFrame(frame);
  }
  function goLite() {
    lite = true; ratioCap = 1;
    renderer.setPixelRatio(1); renderer.setSize(width, height, false);
    wake();
  }
  function wake() {
    if (!shown || paused) return;
    dirty = true;
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  // ---------- fingers ----------
  const spotOnBaseline = p => (p ? clamp(p[0], -XR, XR) : model.x);
  canvas.addEventListener("pointerdown", e => {
    if (!model.canPlay || play || pull || e.button > 0) return;
    const p = boardAt(e.clientX, e.clientY);
    if (!p) return;
    const sy = baseY(model.seat), ppu = pixelsPerUnit(), near = Math.max(RS * 1.7, 30 / ppu), band = Math.max(70, 26 / ppu);
    const d = Math.hypot(p[0] - model.x, p[1] - sy);
    if (d <= near) pull = { mode: "pull", to: p, power: 0, valid: null, ux: 0, uy: 0, id: e.pointerId };
    else if (Math.abs(p[1] - sy) <= band && Math.abs(p[0]) <= XR + 70) { pull = { mode: "slide", to: p, id: e.pointerId }; hooks.slide?.(spotOnBaseline(p), false); }
    else return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a touch that has gone */ }
    e.preventDefault();
    aimKey = ""; wake();
  });
  canvas.addEventListener("pointermove", e => {
    if (!pull || e.pointerId !== pull.id) return;
    const p = boardAt(e.clientX, e.clientY);
    if (!p) return;
    pull.to = p;
    if (pull.mode === "slide") hooks.slide?.(spotOnBaseline(p), false);
    else {
      const sy = baseY(model.seat), vx = model.x - p[0], vy = sy - p[1], len = Math.hypot(vx, vy);
      if (len < PULL_MIN) { pull.valid = null; pull.power = 0; }
      else {
        pull.ux = vx / len; pull.uy = vy / len;
        pull.power = clamp((len - PULL_MIN) / (PULL_MAX - PULL_MIN), 0, 1);
        pull.valid = (model.seat === 0 ? pull.uy : -pull.uy) >= 0.12;
      }
      hooks.aim?.({ power: pull.power, valid: pull.valid });
    }
    aimKey = ""; wake();
  });
  const release = (e, cancel) => {
    if (!pull || e.pointerId !== pull.id) return;
    const was = pull; pull = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    hooks.aim?.(null);
    if (was.mode === "slide") hooks.slide?.(spotOnBaseline(was.to), true);
    else if (!cancel && was.valid && was.power > 0.02) {
      hooks.shoot?.({ x: Math.round(model.x), ax: Math.round(was.ux * 1000), ay: Math.round(was.uy * 1000), p: clamp(Math.round(was.power * 1000), 1, 1000) });
    } else if (!cancel && was.valid === false) hooks.refuse?.("Shoot forwards, away from your baseline");
    aimKey = ""; wake();
  };
  canvas.addEventListener("pointerup", e => release(e, false));
  canvas.addEventListener("pointercancel", e => release(e, true));

  // ---------- the page tells the scene what to show ----------
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(host);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); clearTimeout(lostTimer); lostTimer = setTimeout(() => hooks.lost?.(), 2500); });
  canvas.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); applySkin(); });
  applySkin();
  resize();

  return {
    /** Whose side the board is seen from (0: the bottom baseline is nearest). `still` jumps rather than turning. */
    look(seat, still) {
      const to = seat === 0 ? 0 : Math.PI;
      if (to === yawTo && yawAt < 0) return;
      yawFrom = yaw; yawTo = to;
      if (still || reduced()) { yaw = to; yawAt = -1; fit(); } else yawAt = performance.now();
      wake();
    },
    /** The men where a state has them. */
    snap(st, popIds = []) { play = null; put(st, performance.now(), popIds); aimKey = ""; wake(); },
    /** The page's picture of the shooter: who, where the striker stands, whether a finger may act, which stretches of baseline are blocked. */
    setModel(m) { model = { ...model, ...m }; aimKey = ""; wake(); },
    /** A shot replayed from the state before it; `to` is the state after it (the men are put there at the end; the returned ones grow). Resolves when it is over. */
    replay(from, shot, seat, to, pops) {
      return new Promise(resolve => {
        put(from, performance.now());
        if (reduced()) { put(to, performance.now(), pops); aimKey = ""; wake(); resolve(); return; }
        const sim = startSim(from.px, from.py, from.st, shot, seat);
        B.x[STRIKER] = shot.x; B.y[STRIKER] = baseY(seat); B.on[STRIKER] = 1; B.fall[STRIKER] = -1;
        play = { sim, acc: 0, at: performance.now(), to, pops, done: resolve, held: false };
        aimKey = ""; wake();
      });
    },
    /** Finish a replay at once (a new move came in, or the menu closed over it). */
    skip() {
      if (!play) return;
      while (stepSim(play.sim));
      finish(performance.now());
    },
    get playing() { return !!play; },
    pause() { paused = true; if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    resume() { paused = false; if (play) play.at = performance.now(); wake(); },
    setShown(on) { shown = on; if (on) wake(); },
    redraw() { applySkin(); },
    get lite() { return lite; },
    /** Where on the screen a board point is (the page's labels). */
    screenOf(bx, by) { return project(bx * S, 0.1, -by * S); },
    dispose() {
      cancelAnimationFrame(frameId); clearTimeout(lostTimer); sizeWatch.disconnect();
      for (const m of [...Object.values(men), shadows, decalMesh, aimMesh]) m.geometry.dispose();
      renderer.dispose();
    },
  };
}
