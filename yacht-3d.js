// Yacht's dice thrown on a felt (Menu, View: 3D), drawn with three.js (vendor/three.js, kept on the device, so it plays
// offline): five ivory dice with rounded edges and pips, a felt table in a wooden rim edged in brass, a lamp over it. The
// flat dice are the default and this is the page's second drawing of the same state: yacht.js hands over what the game
// says (the five faces, which are held, whether they've been rolled, a key that changes with each roll) and gets back a tap
// on a die. The throw is a scripted tumble (a toss, bounces, a spin that settles) ending on the face the game gave: the
// faces never come from the animation, and where a die lies on the felt comes from the game's seed (yacht-3d-geo.js).
// Held dice stand in a row near you; tap one to hold it or let it go. It draws only while something moves, 30 frames a
// second at the most, and the pixel ratio is capped at 2.
import * as THREE from "./vendor/three.js";
import { DIE, FELT, ROW_Z, SCATTER, GAP, heldSpot, scatterSpots, keyNumber, FACES, PIP_AT } from "./yacht-3d-geo.js";

const PCF = 1;                                                              // THREE.PCFShadowMap (the soft one is not in the bundle)
const NEAR = 1, FAR = 120, FOV = 30 * Math.PI / 180, ELEV = 54 * Math.PI / 180, TARGET_Z = 0.3;
const FIT = [[-4.1, 0, -3.0], [4.1, 0, -3.0], [-4.1, 0, 3.4], [4.1, 0, 3.4], [-4.1, 1.2, -3.0], [4.1, 1.2, -3.0]];   // what the camera must keep in view
const clamp01 = u => Math.max(0, Math.min(1, u));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const V = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
/** A box with rounded edges and corners. */
function roundedBox(size, r, seg = 5) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, inner = size / 2 - r, c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    V.set(p.getX(i), p.getY(i), p.getZ(i));
    c.set(Math.max(-inner, Math.min(inner, V.x)), Math.max(-inner, Math.min(inner, V.y)), Math.max(-inner, Math.min(inner, V.z)));
    V.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, V.x, V.y, V.z);
  }
  g.computeVertexNormals();
  return g;
}
/** Geometries joined into one (positions, normals and indices). */
function merge(list) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    const ix = g.index;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}
/** The pips of a die: a flattened bead on each face where the face's number has one; the one's apart (it is red). */
function pipGeometry(onlyOne) {
  const parts = [], off = DIE * 0.24;
  for (const [nx, ny, nz, value] of FACES) {
    if ((value === 1) !== onlyOne) continue;
    const n = new THREE.Vector3(nx, ny, nz), u = Math.abs(ny) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), w = new THREE.Vector3().crossVectors(n, u);
    for (const [a, b] of PIP_AT[value]) {
      const g = new THREE.SphereGeometry(value === 1 ? 0.12 : 0.085, 12, 8), m = new THREE.Matrix4();
      const p = n.clone().multiplyScalar(DIE / 2 - 0.012).addScaledVector(u, a * off).addScaledVector(w, b * off);
      // squash the bead along the face's normal, then turn that axis to it
      const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
      m.compose(p, q, new THREE.Vector3(1, 0.34, 1));
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  return merge(parts);
}

/** The die's turn that shows `value` on top, turned `yaw` about the vertical. */
function showing(value, yaw) {
  const f = FACES.find(x => x[3] === value) || FACES[0];
  const q = new THREE.Quaternion().setFromUnitVectors(V.set(f[0], f[1], f[2]), UP);
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(q);
}

export function createYacht3d(host, { onTap = () => {}, onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });   // throws where there is no WebGL: the page draws flat
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  host.replaceChildren(canvas);

  const scene = new THREE.Scene();
  // a perspective camera from an orthographic one's parts (the bundle has no perspective camera): its matrix is set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.8), hemi = new THREE.HemisphereLight(0xfff4e4, 0x4a3a2c, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 4, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.position.set(-4, 14, 6);
  scene.add(sun, sun.target, hemi);

  const own = [];
  const track = o => { own.push(o); return o; };
  const std = (color, roughness, metalness = 0) => track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  const matFelt = std(0x2f6a56, 0.96), matRim = std(0x5a3b25, 0.5), matBrass = std(0xc8923a, 0.34, 0.55);
  const matDie = std(0xffffff, 0.32), matPip = std(0x1c2a34, 0.5), matRed = std(0xc0262d, 0.5);

  // ---------- the table ----------
  const mesh = (g, m, cast = true, receive = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = receive; o.frustumCulled = false; scene.add(o); return o; };
  const box = (w, h, d, x, y, z) => { const g = track(new THREE.BoxGeometry(w, h, d)); const o = mesh(g, matRim, false, true); o.position.set(x, y, z); return o; };
  const W = FELT.w, D = FELT.d, R = 0.55;
  mesh(track(new THREE.BoxGeometry(W, 0.4, D)), matFelt, false, true).position.set(0, -0.2, 0);
  box(W + 2 * R, 0.7, R, 0, -0.05, -(D / 2 + R / 2)); box(W + 2 * R, 0.7, R, 0, -0.05, D / 2 + R / 2);
  box(R, 0.7, D, -(W / 2 + R / 2), -0.05, 0); box(R, 0.7, D, W / 2 + R / 2, -0.05, 0);
  for (const [w, d, x, z] of [[W, 0.07, 0, -D / 2], [W, 0.07, 0, D / 2], [0.07, D, -W / 2, 0], [0.07, D, W / 2, 0]]) {
    const g = track(new THREE.BoxGeometry(w, 0.05, d)), o = new THREE.Mesh(g, matBrass); o.position.set(x, 0.01, z); scene.add(o);
  }

  { const g = track(new THREE.BoxGeometry(6.6, 0.03, 0.05)), o = new THREE.Mesh(g, matBrass); o.position.set(0, 0.012, ROW_Z - 0.8); scene.add(o); }   // the rail the held dice stand behind

  // ---------- the dice ----------
  const bodyGeo = track(roundedBox(DIE, 0.085)), pipGeo = track(pipGeometry(false)), redGeo = track(pipGeometry(true));
  const body = new THREE.InstancedMesh(bodyGeo, matDie, 5), pips = new THREE.InstancedMesh(pipGeo, matPip, 5), reds = new THREE.InstancedMesh(redGeo, matRed, 5);
  for (const m of [body, pips, reds]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
  const dice = Array.from({ length: 5 }, () => ({ p: new THREE.Vector3(0, DIE / 2, ROW_Z), q: new THREE.Quaternion(), where: "", value: 0, token: null }));
  let ivory = new THREE.Color(0xfbf4e4);
  const DIM = 0.55;
  const REST = DIE / 2;

  // ---------- the camera ----------
  let width = 1, height = 1, night = false;
  const P = new THREE.Vector3();
  function pose(dist) {
    camera.position.set(0, Math.sin(ELEV) * dist, TARGET_Z + Math.cos(ELEV) * dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, TARGET_Z);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const t = NEAR * Math.tan(FOV / 2), r = t * (width / height);
    camera.projectionMatrix.makePerspective(-r, r, t, -t, NEAR, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  const fits = () => FIT.every(([x, y, z]) => { P.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); return Math.abs(P.x) <= 1 && Math.abs(P.y) <= 1; });
  function frameAll() {
    let dist = 6;
    pose(dist);
    while (!fits() && dist < 60) { dist += 0.25; pose(dist); }
    invalidate();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (width * height)))));
    renderer.setSize(width, height, false);
    frameAll();
  }
  function applySkin() {
    const root = document.documentElement, css = getComputedStyle(root);
    night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    const yard = (css.getPropertyValue("--yard") || "").trim(), hex = /^#[0-9a-f]{6}$/i.test(yard) ? yard : night ? "#10181F" : "#E8DFC9";
    renderer.setClearColor(hex, 1);
    matFelt.color.set(night ? 0x1f4a3c : 0x2f6a56);
    ivory = new THREE.Color(night ? 0xede3cc : 0xfbf4e4);
    sun.intensity = night ? 2.3 : 2.8;
    hemi.intensity = night ? 0.85 : 1.0;
    paint();
    invalidate();
  }

  // ---------- drawing, only while something moves ----------
  let frameId = 0, dead = false, dirty = false, lastDraw = 0, frames = 0;
  const anims = [];
  const M4 = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1);
  function invalidate() { dirty = true; if (!frameId && !dead) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame(t) {
    frameId = 0;
    if (t - lastDraw < 30) { if (dirty || anims.length) frameId = requestAnimationFrame(frame); return; }
    lastDraw = t;
    const now = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](now)) anims.splice(i, 1);
    dice.forEach((d, k) => { M4.compose(d.p, d.q, ONE); body.setMatrixAt(k, M4); pips.setMatrixAt(k, M4); reds.setMatrixAt(k, M4); });
    body.instanceMatrix.needsUpdate = pips.instanceMatrix.needsUpdate = reds.instanceMatrix.needsUpdate = true;
    dirty = false;
    renderer.render(scene, camera);
    frames++;
    if (anims.length) invalidate();
  }

  // ---------- what the game says ----------
  let shown = null, roll = null;                                           // the last view set; the roll key it was for
  const tint = new THREE.Color();
  /** The body colours: ivory, dimmed before the roll, tinted green when held. */
  function paint() {
    if (!shown) return;
    dice.forEach((d, k) => {
      tint.copy(ivory);
      if (shown.blank) tint.multiplyScalar(DIM);
      else if (shown.held[k]) tint.lerp(new THREE.Color(night ? 0x7fc2a8 : 0x8fd3ae), 0.6);
      body.setColorAt(k, tint);
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  }
  const calmPlace = (d, spot, value) => { d.p.set(spot.x, REST, spot.z); d.q.copy(showing(value, spot.yaw)); };

  /** A die tossed from where it is to its place, tumbling, bouncing, landing on `value`. */
  function toss(d, spot, value, delay) {
    const end = showing(value, spot.yaw);
    if (calm()) { calmPlace(d, spot, value); return; }
    const token = d.token = {}, p0 = d.p.clone(), t0 = performance.now() + delay, T = 950 + Math.random() * 160;
    const axis = new THREE.Vector3(Math.random() - 0.5, 0.35 + Math.random() * 0.3, Math.random() - 0.5).normalize(), turns = (3 + Math.random() * 1.6) * Math.PI * 2, whirl = new THREE.Quaternion();
    go(t => {
      if (d.token !== token) return false;
      if (t < t0) return true;
      const u = clamp01((t - t0) / T), out = 1 - (1 - u) ** 3;
      d.p.set(p0.x + (spot.x - p0.x) * out, REST + 2.1 * Math.abs(Math.cos(u * Math.PI * 2.6)) * (1 - u) ** 2.2 * (u < 0.12 ? 1 + (0.12 - u) * 6 : 1) , p0.z + (spot.z - p0.z) * out);
      whirl.setFromAxisAngle(axis, turns * (1 - u) ** 2);
      d.q.copy(whirl).multiply(end);
      return u < 1;
    });
  }
  /** A die lifted and set down in another place (held, or let go), keeping its face. */
  function hop(d, spot, value) {
    const end = showing(value, spot.yaw);
    if (calm()) { calmPlace(d, spot, value); return; }
    const token = d.token = {}, p0 = d.p.clone(), q0 = d.q.clone(), t0 = performance.now(), T = 380;
    go(t => {
      if (d.token !== token) return false;
      const u = clamp01((t - t0) / T), e = u * u * (3 - 2 * u);
      d.p.set(p0.x + (spot.x - p0.x) * e, REST + 0.9 * Math.sin(Math.PI * u), p0.z + (spot.z - p0.z) * e);
      d.q.copy(q0).slerp(end, e);
      return u < 1;
    });
  }

  let spots = null, spotsKey = "";
  /** v: { dice, held, blank, canHold, key, seed }. */
  function set(v) {
    const first = !shown;
    const newRoll = !first && v.key !== roll && !v.blank;
    shown = v;
    paint();
    const sk = `${v.seed}:${v.key}`;
    if (spotsKey !== sk) { spots = scatterSpots(v.seed >>> 0, keyNumber(v.key)); spotsKey = sk; }
    dice.forEach((d, k) => {
      const face = v.blank ? (k % 6) + 1 : v.dice[k] || 1;
      const where = v.blank || v.held[k] ? "row" : "scatter", spot = where === "row" ? heldSpot(k) : spots[k];
      const moved = d.where !== where || d.value !== face;
      d.where = where;
      d.value = face;
      if (first) calmPlace(d, spot, face);
      else if (newRoll && where === "scatter") toss(d, spot, face, k * 70);
      else if (moved) hop(d, spot, face);
    });
    roll = v.key;
    canvas.style.cursor = v.canHold ? "pointer" : "default";
    invalidate();
  }

  // ---------- a tap on a die ----------
  function screenOf(p) { P.copy(p).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); return [(P.x + 1) / 2 * width, (1 - P.y) / 2 * height]; }
  function pick(x, y) {
    let best = -1, near = Infinity;
    dice.forEach((d, k) => {
      const [sx, sy] = screenOf(d.p), [ex] = screenOf(V.copy(d.p).setX(d.p.x + DIE * 0.75)), r = Math.max(14, Math.abs(ex - sx) * 1.05), dist = Math.hypot(sx - x, sy - y);
      if (dist < r && dist < near) { near = dist; best = k; }
    });
    return best;
  }
  const ac = new AbortController();
  host.addEventListener("click", e => {
    if (!shown?.canHold) return;
    const r = host.getBoundingClientRect(), k = pick(e.clientX - r.left, e.clientY - r.top);
    if (k >= 0) onTap(k);
  }, { signal: ac.signal });

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost(); });
  canvas.addEventListener("webglcontextrestored", invalidate);
  applySkin();
  resize();

  return {
    set,
    /** The number on top of each die, read from how it lies (for tests: it should be the game's). */
    get diceUp() { return dice.map(d => FACES.reduce((b, [x, y, z, v]) => { const up = V.set(x, y, z).applyQuaternion(d.q).y; return up > b[0] ? [up, v] : b; }, [-2, 0])[1]); },
    get where() { return dice.map(d => ({ x: d.p.x, z: d.p.z, where: d.where })); },
    get busy() { return anims.length > 0; },
    get frames() { return frames; },
    /** Where a die is on the page, in pixels from the box's top left (for tests: where a real tap should land). */
    screenOfDie: k => screenOf(dice[k].p),
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      ac.abort();
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", applySkin);
      for (const o of own) o.dispose?.();
      body.dispose(); pips.dispose(); reds.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
    },
  };
}
