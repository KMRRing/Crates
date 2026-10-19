// Survey in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a block of rock, n cubes
// each way, on a brass-trimmed plinth. Every cube is one instance of a rounded cube, so a block is a single draw; a cube
// that is chipped shrinks away in a burst of shards and leaves a hollow you can see into. The readings (one per row of
// cubes, in all three directions) are not in the picture: they are small plates of the page, laid over the canvas and
// moved to where their row comes out of the block, on the faces turned toward you (survey.css draws them). The camera goes
// round the block under a finger and tips from low to nearly overhead; it is a perspective one made from an
// orthographic camera's parts (the bundle has none), fitted so the block and its readings fill the room at every angle.
// The page (survey.js) changes the run, then calls update(); this file works out what each cube should look like from the
// run and animates the difference.
import * as THREE from "./vendor/three.js";
import { linesOf, coordsOf } from "./survey-engine.js";

const DEG = Math.PI / 180;
const BACK = 1;                                   // THREE.BackSide (not in the bundle's exports)
const MIN_EL = 14 * DEG, MAX_EL = 80 * DEG;
const OFF = 0.1;                                  // how far beyond its face a row's reading floats, in cubes
const CHIP_MS = 260, STRIKE_MS = 460, MARK_MS = 200, WAVE_MS = 38, SPIN = 0.5;   // animations; the wave of ore at the end (ms a cube later); the slow turn after a win (rad/s)
const SHARDS = 220;

// ---------- the skins ----------
const MODES = {
  day: { rock: 0xb9ab92, sky: 0xf1e6cd, ground: 0x5a4d3c, hemi: 1.15, key: 0xfff1d6, keyI: 2.6, exposure: 1.0, shadow: 0.55 },
  night: { rock: 0x98938a, sky: 0x6c80a6, ground: 0x141a22, hemi: 1.05, key: 0xcbdaf5, keyI: 2.2, exposure: 1.05, shadow: 0.6 },
};
const THEMES = { almanac: { brass: [0xcfa142, 0xc39a3e], plate: [0x1c2a34, 0x0d151c] }, modern: { brass: [0xd7ad3f, 0xc9a23c], plate: [0x2a3238, 0x151b20] }, kontor: { brass: [0xc4a248, 0xbb9a40], plate: [0x22302a, 0x0f1612] } };
/** The skin in force: the suite's theme and day or night (as set, else as the device), with the theme's gold and blue enamels (ore, marks). */
export function skinNow() {
  const root = document.documentElement, theme = THEMES[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), pick = (name, or) => { const v = (css.getPropertyValue(name) || "").trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : or; };
  const i = night ? 1 : 0;
  return { name: `${theme} ${night ? "night" : "day"}`, night, ...MODES[night ? "night" : "day"], brass: THEMES[theme].brass[i], plate: THEMES[theme].plate[i], ore: pick("--c0", "#D49A22"), mark: pick("--c2", "#2C5B8A") };
}

// ---------- shapes ----------
/** A unit cube with rounded edges: a box with four segments, its outer rings pulled onto quarter-circles of radius r. */
function roundedCube(r = 0.085) {
  const g = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4), pos = g.attributes.position, nor = g.attributes.normal, inner = 0.5 - r;
  const ring = c => { const a = Math.abs(c); return Math.sign(c) * (a > 0.4 ? 0.5 : a > 0.1 ? inner : 0); };      // the five rows of vertices -> the corner of each round
  const tint = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) {
    const m = [ring(pos.getX(k)), ring(pos.getY(k)), ring(pos.getZ(k))], cl = m.map(c => Math.max(-inner, Math.min(inner, c))), off = m.map((c, i) => c - cl[i]), len = Math.hypot(...off);
    pos.setXYZ(k, cl[0] + (off[0] / len) * r, cl[1] + (off[1] / len) * r, cl[2] + (off[2] / len) * r);
    nor.setXYZ(k, off[0] / len, off[1] / len, off[2] / len);
    const h = Math.sin(k * 12.9898 + 4.1) * 43758.5453, v = 0.9 + 0.1 * (h - Math.floor(h));                         // a mottle, the same on every cube: rock is never one flat grey
    tint.set([v, v, v], k * 3);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(tint, 3));
  return g;
}
/** The mark of a cube you think is ore: a diamond outline on each of its six faces. */
function diamonds() {
  const R = 0.44, r = 0.34, z = 0.508, pos = [], idx = [];
  const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  for (const [n, a, b] of faces) {
    const base = pos.length / 3, at = (s, t) => pos.push(...[0, 1, 2].map(i => n[i] * z + a[i] * s + b[i] * t));
    at(R, 0); at(0, R); at(-R, 0); at(0, -R); at(r, 0); at(0, r); at(-r, 0); at(0, -r);
    for (let k = 0; k < 4; k++) { const o = base + k, i = base + 4 + k, o2 = base + (k + 1) % 4, i2 = base + 4 + ((k + 1) % 4); idx.push(o, o2, i, i, o2, i2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/**
 * The block's picture in `host`: a canvas and the layer of readings over it. Throws where there's no WebGL (the page then
 * says so). Calls: set(puzzle, run) for a new puzzle, update() after the run changed, pick(x, y) for the cube under a point of
 * the screen, focus/halo/emphasise for showing a cube and its rows, orbit/setView for the camera, spin() after a win.
 */
export function createBlock(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                      // THREE.PCFShadowMap (the soft one is gone from newer three.js)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "sv-gl";
  const labels = document.createElement("div");
  labels.className = "sv-labels";
  host.replaceChildren(canvas, labels);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const cubeGeo = roundedCube(), markGeo = diamonds();
  const cubeMat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, vertexColors: true });
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  haloMat.side = BACK;
  const halo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), haloMat);
  halo.visible = false;
  scene.add(halo);
  const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.25 }), trimMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), plateMat), trim = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), trimMat);
  plinth.receiveShadow = true;
  scene.add(plinth, trim);
  const shardMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const shards = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), shardMat, SHARDS);
  shards.frustumCulled = false;
  scene.add(shards);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), V = new THREE.Vector3(), ndc = new THREE.Vector3();
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0), C = new THREE.Color();
  const LOOK = new THREE.Vector3(0, -0.15, 0);

  // the puzzle on show
  let P = null, R = null, n = 0, cubes = null, marks = null, lab = [];
  let ctr = new Float32Array(0), tint = new Float32Array(0);
  let st = new Int8Array(0), mk = new Uint8Array(0), left = new Int16Array(0);           // per cube: 0 rock, 1 gone, 2 ore shown; marked; per row: cubes left in it
  const anims = new Map();                                                                 // cube -> { kind, t0 }
  let hot = new Set(), focusCell = -1, focusUntil = 0, haloCell = -1, haloUntil = 0, spinUntil = 0;
  let skin = skinNow();
  const rock = new THREE.Color(), gold = new THREE.Color(), blue = new THREE.Color();

  // ---------- the skin ----------
  function applySkin() {
    skin = skinNow();
    rock.set(skin.rock); gold.set(skin.ore); blue.set(skin.mark).lerp(C.set(0xffffff), 0.1);
    hemi.color.set(skin.sky); hemi.groundColor.set(skin.ground); hemi.intensity = skin.hemi;
    sun.color.set(skin.key); sun.intensity = skin.keyI;
    renderer.toneMappingExposure = skin.exposure;
    plateMat.color.set(skin.plate).lerp(C.set(skin.brass), skin.night ? 0.2 : 0.3); trimMat.color.set(skin.brass);
    markMat.color.set(skin.night ? 0xffffff : 0xfff8e6);
    haloMat.color.set(skin.brass).lerp(C.set(0xffffff), 0.35);
    shardMat.color.set(skin.rock);
    if (cubes) { paintAll(); invalidate(); }
  }

  // ---------- the camera ----------
  let width = 1, height = 1, az = 35 * DEG, el = 34 * DEG, dist = 20;
  function pose(a = az, e = el) {
    camera.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  // what must stay in view from any side at this height: the block with room for its readings, and the plinth
  function extent(e) {
    const H = n / 2 + 0.4, B = n / 2 + 0.65, lo = -n / 2 - 0.52;               // the plates round the block; the plinth, a little wider, below
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let a = 0; a < 90; a += 10) {
      pose(a * DEG, e);
      for (const [y, h] of [[lo, B], [H, H]]) for (const x of [-h, h]) for (const z of [-h, h]) {
        V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        const u = V.x / -V.z, v = V.y / -V.z;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
    }
    return { u0, u1, v0, v1 };
  }
  function fit() {
    if (!n) return;
    const x = extent(el), pad = 0.015, aspect = width / height;
    const cu = (x.u0 + x.u1) / 2, cv = (x.v0 + x.v1) / 2;
    let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
    if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
    camera.projectionMatrix.makePerspective(cu - hu, cu + hu, cv + hv, cv - hv, 1, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    pose();
    // the light turns with the camera (from above, a little to the left), so the faces you see are lit the same from every side
    const la = az - 0.55, le = Math.min(el + 0.45, 1.3), D = n * 3 + 8;
    sun.position.set(Math.sin(la) * Math.cos(le) * D, Math.sin(le) * D, Math.cos(la) * Math.cos(le) * D);
    sun.target.position.set(0, 0, 0);
    const s = n * 0.95 + 2.2;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: D * 2 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    fit();
    invalidate();
  }
  const screenOf = (x, y, z) => { V.set(x, y, z).project(camera); return [((V.x + 1) / 2) * width, ((1 - V.y) / 2) * height]; };
  /** Pixels a cube spans on the screen at the middle of the block. */
  const cellPx = () => (camera.projectionMatrix.elements[0] * (width / 2)) / dist;

  // ---------- the block ----------
  /** Shows a puzzle (and the run in it, which the page goes on changing: call update() after). */
  function set(puzzle, run) {
    P = puzzle; R = run; n = puzzle.n;
    dist = n * 3.9 + 8;
    anims.clear(); hot = new Set(); focusCell = -1; haloCell = -1; hintRows = []; haloUntil = 0; halo.visible = false; spinUntil = 0;
    if (cubes) { scene.remove(cubes, marks); cubes.dispose(); marks.dispose(); }
    const count = n ** 3;
    cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, count);
    marks = new THREE.InstancedMesh(markGeo, markMat, count);
    for (const m of [cubes, marks]) { m.frustumCulled = false; }
    cubes.castShadow = cubes.receiveShadow = true;
    scene.add(cubes, marks);
    ctr = new Float32Array(count * 3); tint = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const c = coordsOf(n, i);
      ctr.set(c.map(v => v - (n - 1) / 2), i * 3);
      const h = Math.sin(i * 78.233 + n) * 43758.5453;
      tint[i] = 0.93 + 0.1 * (h - Math.floor(h));
    }
    st = new Int8Array(count).fill(-1); mk = new Uint8Array(count);
    left = new Int16Array(3 * n * n);
    plinth.scale.set(n + 0.9, 0.34, n + 0.9); plinth.position.set(0, -n / 2 - 0.17, 0);
    trim.scale.set(n + 1.2, 0.12, n + 1.2); trim.position.set(0, -n / 2 - 0.34 - 0.06, 0);
    lab = buildLabels();
    applySkin();
    fit();
    update(false);
  }
  function buildLabels() {
    labels.replaceChildren();
    return linesOf(n).map((ln, k) => {
      const el = document.createElement("div"), shape = P.readings === "counts" ? "" : ["", "", " ring", " box"][P.clues[k].g];   // one seam or none: a plain plate
      el.className = "sv-lab";
      el.style.visibility = "hidden";                                                              // until its first place on the screen
      el.textContent = String(P.clues[k].c);
      labels.append(el);
      return { el, ln, shape, x: -1e9, y: -1e9, o: -1, cls: "" };
    });
  }

  /** What a cube is in the run now: 0 rock, 1 gone, 2 ore shown (at the end, every cube left is). */
  function stateOf(i, gone, shown) { return gone.has(i) ? 1 : R.done || shown.has(i) ? 2 : 0; }
  /** Reads the run again: every cube's look, with a chip, a strike or a mark animated where one just happened (not on the first call after set(), or with animate off). */
  function update(animate = true) {
    if (!P) return;
    const gone = new Set(R.gone), shown = new Set(R.shown), marked = new Set(R.marked), now = performance.now(), count = n ** 3;
    const first = st[0] === -1, ending = R.done && st.some(s => s === 0);
    let wave = 0;
    for (let i = 0; i < count; i++) {
      const s = stateOf(i, gone, shown), m = s === 0 && marked.has(i) ? 1 : 0;
      if (s !== st[i] && animate && !first) {
        if (s === 1) { anims.set(i, { kind: "chip", t0: now }); burst(i); }
        else if (s === 2) anims.set(i, { kind: "strike", t0: now + (ending ? wave++ * WAVE_MS : 0) });
      } else if (m && !mk[i] && animate && !first) anims.set(i, { kind: "mark", t0: now });
      st[i] = s; mk[i] = m;
    }
    for (let k = 0; k < lab.length; k++) left[k] = lab[k].ln.cells.reduce((t, c) => t + (st[c] === 1 ? 0 : 1), 0);
    paintAll();
    invalidate();
  }
  const scaleOf = i => (st[i] === 1 ? 0 : 1);
  function paint(i, a = null, now = 0) {
    // size and colour of one cube, animated by `a` if it has an animation going
    let s = scaleOf(i), glow = 1, toGold = st[i] === 2 ? 1 : 0;
    if (a) {
      const t = (now - a.t0) / ({ chip: CHIP_MS, strike: STRIKE_MS, mark: MARK_MS }[a.kind]);
      if (t < 0) { toGold = 0; s = 1; }                                                      // waiting its turn in the wave
      else if (a.kind === "chip") s = t < 0.25 ? 1 + 0.12 * (t / 0.25) : Math.max(0, 1.12 * (1 - ease((t - 0.25) / 0.75)));
      else if (a.kind === "strike") { s = 1 + 0.17 * Math.sin(Math.PI * Math.min(1, t)); toGold = ease(Math.min(1, t * 1.4)); glow = 1 + 0.7 * Math.sin(Math.PI * Math.min(1, t)); }
      else s = 1 + 0.1 * Math.sin(Math.PI * Math.min(1, t));
    }
    P3.set(ctr[i * 3], ctr[i * 3 + 1], ctr[i * 3 + 2]);
    if (s <= 0.001) { cubes.setMatrixAt(i, HIDE); } else { S3.set(s, s, s); M.compose(P3, Q, S3); cubes.setMatrixAt(i, M); }
    C.copy(rock).multiplyScalar(tint[i]);
    if (mk[i]) C.lerp(blue, 0.8);
    if (toGold > 0) C.lerp(gold, toGold);
    if (i === focusCell) C.multiplyScalar(1.28);
    if (i === haloCell && halo.visible) C.lerp(haloMat.color, 0.3 + 0.2 * Math.sin(now / 130));      // a hinted cube breathes
    cubes.setColorAt(i, C.multiplyScalar(glow));
    if (mk[i] && st[i] === 0 && s > 0.001) { S3.set(s, s, s); M.compose(P3, Q, S3); marks.setMatrixAt(i, M); } else marks.setMatrixAt(i, HIDE);
  }
  function paintAll() {
    const now = performance.now();
    for (let i = 0; i < n ** 3; i++) paint(i, anims.get(i) || null, now);
    cubes.instanceMatrix.needsUpdate = marks.instanceMatrix.needsUpdate = true;
    if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
  }
  const ease = t => 1 - (1 - t) * (1 - t);

  // ---------- shards: what a chipped cube breaks into ----------
  const sh = Array.from({ length: SHARDS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, spin: 0, rx: 0, ry: 0 }));
  let shardAt = 0;
  for (let i = 0; i < SHARDS; i++) { shards.setMatrixAt(i, HIDE); shards.setColorAt(i, C.set(0xffffff)); }
  function burst(i) {
    for (let k = 0; k < 7; k++) {
      const p = sh[shardAt = (shardAt + 1) % SHARDS], ox = Math.random() - 0.5, oy = Math.random() - 0.5, oz = Math.random() - 0.5;
      const len = Math.hypot(ox, oy, oz) || 1, out = 1.6 + Math.random() * 2.2;
      Object.assign(p, { life: 0.55 + Math.random() * 0.3, x: ctr[i * 3] + ox * 0.7, y: ctr[i * 3 + 1] + oy * 0.7, z: ctr[i * 3 + 2] + oz * 0.7,
        vx: (ox / len) * out, vy: (oy / len) * out + 2.2, vz: (oz / len) * out, s: 0.07 + Math.random() * 0.07, spin: (Math.random() - 0.5) * 12, rx: Math.random() * 6, ry: Math.random() * 6 });
      shards.setColorAt(shardAt, C.copy(rock).multiplyScalar(0.8 + Math.random() * 0.3));
    }
    if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
  }
  function stepShards(dt) {
    let live = false;
    for (let i = 0; i < SHARDS; i++) {
      const p = sh[i];
      if (p.life <= 0) { if (p.on) { shards.setMatrixAt(i, HIDE); p.on = false; } continue; }
      live = p.on = true;
      p.life -= dt; p.vy -= 13 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.spin * dt; p.ry += p.spin * dt * 0.7;
      const k = Math.max(0, Math.min(1, p.life / 0.3)) * p.s;
      Q.setFromAxisAngle(V.set(Math.sin(p.rx), Math.cos(p.ry), 0.4).normalize(), p.rx);
      M.compose(P3.set(p.x, p.y, p.z), Q, S3.set(k, k, k));
      shards.setMatrixAt(i, M);
    }
    Q.identity();
    shards.instanceMatrix.needsUpdate = true;
    return live;
  }

  // ---------- the readings over the canvas ----------
  const dir = new THREE.Vector3();
  function placeLabels() {
    if (!P) return;
    dir.copy(camera.position).sub(LOOK).normalize();
    const px = cellPx();
    labels.style.setProperty("--cell", `${px.toFixed(1)}px`);
    const lo = (n - 1) / 2, d = [dir.x, dir.y, dir.z];
    for (let k = 0; k < lab.length; k++) {
      const l = lab[k], { a, u, v } = l.ln, s = d[a] >= 0 ? 1 : -1, facing = Math.abs(d[a]), p = [0, 0, 0];
      p[a] = s * (n / 2 + OFF); p[(a + 1) % 3] = u - lo; p[(a + 2) % 3] = v - lo;
      const [x, y] = screenOf(p[0], p[1], p[2]);
      const empty = left[k] === 0, done = !empty && left[k] === P.clues[k].c, on = hot.has(k);
      const fade = Math.max(0, Math.min(1, (facing - 0.2) / 0.3));
      const o = empty ? 0 : fade * (done && !on ? 0.4 : 1), cls = `sv-lab${l.shape}${done ? " done" : ""}${on ? " hot" : ""}`;
      if (Math.abs(x - l.x) > 0.15 || Math.abs(y - l.y) > 0.15) { l.x = x; l.y = y; l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`; }
      if (Math.abs(o - l.o) > 0.01) { l.o = o; l.el.style.opacity = o.toFixed(2); l.el.style.visibility = o < 0.03 ? "hidden" : "visible"; }
      if (cls !== l.cls) { l.cls = cls; l.el.className = cls; }
    }
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, last = 0, dead = false;
  function invalidate() { if (!frameId && !dead) frameId = requestAnimationFrame(frame); }
  function frame(ts) {
    frameId = 0;
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016, now = performance.now();
    last = ts;
    let busy = false;
    if (spinUntil > now) { az += dt * SPIN; fit(); busy = true; }
    if (anims.size) {
      for (const [i, a] of anims) if (now - a.t0 > Math.max(CHIP_MS, STRIKE_MS, MARK_MS)) anims.delete(i);
      paintAll();
      busy = true;
    }
    if (stepShards(dt)) busy = true;
    if (focusCell >= 0 && focusUntil && now > focusUntil) focus(-1);
    if (haloUntil) {
      if (now > haloUntil) haloAt(-1);
      else if (halo.visible) {
        const t = 1 + 0.06 * Math.sin(now / 130);
        halo.scale.set(t, t, t); haloMat.opacity = 0.5 + 0.25 * Math.sin(now / 130);
        paint(haloCell, anims.get(haloCell) || null, now);
        cubes.instanceColor.needsUpdate = true; cubes.instanceMatrix.needsUpdate = true;
        busy = true;
      }
    }
    renderer.render(scene, camera);
    placeLabels();
    if (busy) frameId = requestAnimationFrame(frame); else last = 0;
  }

  // ---------- looking at it ----------
  /** The cube under a point of the screen (client coordinates): the nearest one still in the block, or -1. */
  function pick(cx, cy) {
    if (!P) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1), 0.5).unproject(camera);
    const o = camera.position, d = ndc.sub(o).normalize();
    let best = -1, bt = Infinity;
    for (let i = 0; i < n ** 3; i++) {
      if (st[i] === 1) continue;
      let t0 = 0, t1 = Infinity;
      for (let a = 0; a < 3; a++) {
        const c = ctr[i * 3 + a], oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
        if (Math.abs(da) < 1e-9) { if (oa < c - 0.5 || oa > c + 0.5) { t1 = -1; break; } continue; }
        let a0 = (c - 0.5 - oa) / da, a1 = (c + 0.5 - oa) / da;
        if (a0 > a1) [a0, a1] = [a1, a0];
        t0 = Math.max(t0, a0); t1 = Math.min(t1, a1);
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = i; }
    }
    return best;
  }
  /** Shows a cube (brighter) and the three rows through it; `ms` how long, 0 to hold it until focus(-1). */
  function focus(i, ms = 0) {
    const before = focusCell;
    focusCell = i;
    focusUntil = i >= 0 && ms ? performance.now() + ms : 0;
    relight();
    if (before >= 0 && before !== i) paint(before, anims.get(before) || null, performance.now());
    if (i >= 0) paint(i, anims.get(i) || null, performance.now());
    if (cubes) { cubes.instanceMatrix.needsUpdate = true; if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true; }
    invalidate();
  }
  const rowsOf = i => { const c = coordsOf(n, i); return [0, 1, 2].map(a => a * n * n + c[(a + 1) % 3] * n + c[(a + 2) % 3]); };
  let hintRows = [];
  /** The rows lit: those through the cube pressed and the ones a hint names. */
  function relight() { hot = new Set([...(focusCell >= 0 ? rowsOf(focusCell) : []), ...hintRows]); }
  /** A glow round a cube (-1: none) and the rows lit with it, for a hint; they fade after a while. A cube still inside the block has no glow, only its rows. */
  function haloAt(i, rows = []) {
    haloCell = i;
    hintRows = rows;
    halo.visible = i >= 0 && st[i] !== 1 && exposedNow(i);
    if (i >= 0) halo.position.set(ctr[i * 3], ctr[i * 3 + 1], ctr[i * 3 + 2]);
    haloUntil = i >= 0 || rows.length ? performance.now() + 9000 : 0;
    relight();
    invalidate();
  }
  /** Whether a cube has a side to the open air (it can be seen, and chipped). */
  function exposedNow(i) {
    const c = coordsOf(n, i);
    return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(d => {
      const x = c[0] + d[0], y = c[1] + d[1], z = c[2] + d[2];
      return x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n || st[x + n * (y + n * z)] === 1;
    });
  }
  function orbit(dAz, dEl) {
    spinUntil = 0;
    az += dAz;
    el = Math.max(MIN_EL, Math.min(MAX_EL, el + dEl));
    fit();
    invalidate();
  }
  function setView(a, e) {
    az = Number.isFinite(a) ? a : 35 * DEG;
    el = Number.isFinite(e) ? Math.max(MIN_EL, Math.min(MAX_EL, e)) : 34 * DEG;
    fit();
    invalidate();
  }

  /** Where a cube is on the page (client coordinates, as a pointer event has them). */
  function where(i) { const [x, y] = screenOf(ctr[i * 3], ctr[i * 3 + 1], ctr[i * 3 + 2]), r = canvas.getBoundingClientRect(); return [x + r.left, y + r.top]; }

  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => { applySkin(); invalidate(); });
  applySkin();
  resize();

  return {
    canvas, set, update, pick, focus, halo: haloAt, orbit, setView,
    /** After a win: the block turns slowly for a few seconds. */
    spin(ms = 6000) { spinUntil = performance.now() + ms; invalidate(); },
    redraw: invalidate,
    /** Whether a cube can be seen from here (the ray through its middle meets it first). */
    visible(i) { const [x, y] = where(i); return pick(x, y) === i; },
    get angles() { return [az, el]; },
    get skin() { return skin; },
    /** For tests: what is animating, which rows are lit. */
    where,
    get live() { return { anims: anims.size, shards: sh.filter(p => p.life > 0).length, hot: [...hot], halo: haloCell, cellPx: cellPx() }; },
    size: () => [width, height],
  };
}
