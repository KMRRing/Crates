// Yacht's dice thrown on a felt (Menu, View: 3D), drawn with three.js (vendor/three.js, kept on the device, so it plays
// offline): five ivory dice with rounded edges and pips, a lamp over them, on a mahogany table of the card room's own (a polished top under
// a brass line, a brass band and a dark-wood edge under it, its shadow on the page), the only table on the page. The
// flat dice are the default and this is the page's second drawing of the same state: yacht.js hands over what the game
// says (the five faces, which are held, whether they've been rolled, a key that changes with each roll) and gets back a tap
// on a die. The throw is a scripted tumble (a toss, bounces, a spin that settles) ending on the face the game gave: the
// faces never come from the animation, and where a die lies on the felt comes from the game's seed (yacht-3d-geo.js).
// Held dice stand in a row near you; tap one to hold it or let it go. It draws only while something moves, 30 frames a
// second at the most, and the pixel ratio is capped at 2.
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";
import { DIE, ROW_Z, SCATTER, GAP, heldSpot, scatterSpots, keyNumber, FACES, PIP_AT } from "./yacht-3d-geo.js";

const PCF = 1;                                                              // THREE.PCFShadowMap (the soft one is not in the bundle)
const NEAR = 1, FAR = 120, FOV = 30 * Math.PI / 180, ELEV = 54 * Math.PI / 180, TARGET_Z = 0.3;
// the table: its top's half width and depth, the brass band and the dark wood under it (Korbi, 10 Nov 2026: "yacht: not 3D", the dice
// had stood on the page's flat box; the table is drawn here now, as the card games' tipped table, and the page's box is gone in 3D)
const TOP = { hw: 4.35, z0: -3.75, z1: 3.85, r: 0.42, wood: 0.12, band: 0.1, edge: 0.42 };
const DROP = TOP.wood + TOP.band + TOP.edge;
const FIT = [[-TOP.hw, 0, TOP.z0], [TOP.hw, 0, TOP.z0], [-TOP.hw, -DROP, TOP.z1 + 0.35], [TOP.hw, -DROP, TOP.z1 + 0.35], [-3.4, 1.4, -2.9], [3.4, 1.4, -2.9]];   // what the camera must keep in view
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
/** A rectangle with rounded corners, as a shape (or a hole, into a Path), centred on cx, cy. */
function roundedRect(w, h, r, cx = 0, cy = 0, into = new THREE.Shape()) {
  const x = cx - w / 2, y = cy - h / 2;
  into.moveTo(x + r, y); into.lineTo(x + w - r, y); into.quadraticCurveTo(x + w, y, x + w, y + r); into.lineTo(x + w, y + h - r);
  into.quadraticCurveTo(x + w, y + h, x + w - r, y + h); into.lineTo(x + r, y + h); into.quadraticCurveTo(x, y + h, x, y + h - r);
  into.lineTo(x, y + r); into.quadraticCurveTo(x, y, x + r, y);
  return into;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });   // throws where there is no WebGL: the page draws flat
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
  const matDie = std(0xffffff, 0.32), matPip = std(0x1c2a34, 0.5), matRed = std(0xc0262d, 0.5);

  // ---------- the table ----------
  // A slab seen from above and in front, as the card games' tipped table: the top in polished mahogany (painted below, in the page's
  // own --tk-top colours), a brass line inset round it, then down its front a brass band and dark wood, standing on a soft shadow.
  const mesh = (g, m, cast = true, receive = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = receive; o.frustumCulled = false; scene.add(o); return o; };
  const cx = 0, cz = (TOP.z0 + TOP.z1) / 2, W = 2 * TOP.hw, D = TOP.z1 - TOP.z0;
  const woodCanvas = document.createElement("canvas");
  woodCanvas.width = 512; woodCanvas.height = 448;
  const woodTex = track(new CanvasTexture(woodCanvas));
  woodTex.colorSpace = SRGBColorSpace;
  woodTex.repeat.set(1 / W, 1 / D);                                     // the shape's own coordinates are its UVs: one texture over the top
  woodTex.offset.set(0.5, 0.5);
  const matTop = track(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.42, metalness: 0 }));
  const matBand = std(0xcfa24e, 0.32, 0.8), matEdge = std(0x2a1208, 0.62), matLine = std(0xcfa24e, 0.3, 0.85);
  const slab = (y, h, m) => { const g = track(new THREE.ExtrudeGeometry(roundedRect(W, D, TOP.r), { depth: h, bevelEnabled: false, curveSegments: 8 })); g.rotateX(-Math.PI / 2); g.translate(cx, y - h, cz); return mesh(g, m); };
  slab(0, TOP.wood, [matTop, matEdge]);
  slab(-TOP.wood, TOP.band, matBand);
  { const g = track(new THREE.ExtrudeGeometry(roundedRect(W - 0.06, D - 0.06, TOP.r), { depth: TOP.edge, bevelEnabled: false, curveSegments: 8 })); g.rotateX(-Math.PI / 2); g.translate(cx, -DROP, cz); mesh(g, matEdge); }
  { const ring = roundedRect(W - 0.5, D - 0.5, TOP.r * 0.7); ring.holes.push(roundedRect(W - 0.58, D - 0.58, TOP.r * 0.66, 0, 0, new THREE.Path()));
    const g = track(new THREE.ShapeGeometry(ring, 8)); g.rotateX(-Math.PI / 2); g.translate(cx, 0.004, cz); mesh(g, matLine, false, true); }
  // its shadow on the page, soft, a little toward you (the CSS tables' drop shadow); blurred with a canvas shadow, which every browser
  // draws (Safari has no canvas filter), and fading out well inside its own square, so the stage's edge never cuts it
  const groundTex = track((() => { const c = document.createElement("canvas"); c.width = 256; c.height = 224; const x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.62)"; x.shadowBlur = 22; x.shadowOffsetX = 1000;
    x.fillStyle = "#000"; x.beginPath(); x.roundRect(46 - 1000, 40, 164, 144, 20); x.fill(); return new CanvasTexture(c); })());
  { const g = track(new THREE.BoxGeometry(W * 1.3, 0.002, D * 1.3)), m = track(new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false }));
    const o = new THREE.Mesh(g, m); o.position.set(0.12, -DROP - 0.02, cz + 0.35); o.renderOrder = -2; o.frustumCulled = false; scene.add(o); }
  /** The top's wood, in the theme's colours: the grain, a lamp's pool in the middle, the far end in shade. */
  function paintWood(stops) {
    const x = woodCanvas.getContext("2d"), w = woodCanvas.width, h = woodCanvas.height;
    const base = x.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, stops[0]); base.addColorStop(0.56, stops[1]); base.addColorStop(1, stops[2]);
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 520; i++) {                                     // long streaks across, as a plank's grain runs
      const y = rnd() * h, dark = rnd() < 0.62;
      x.strokeStyle = dark ? `rgba(20,6,0,${0.05 + rnd() * 0.11})` : `rgba(255,214,160,${0.025 + rnd() * 0.05})`;
      x.lineWidth = 0.6 + rnd() * 1.8;
      x.beginPath(); x.moveTo(0, y);
      for (let px = 0; px <= w; px += 32) x.lineTo(px, y + Math.sin(px / 90 + i) * 2.2 + (rnd() - 0.5) * 1.2);
      x.stroke();
    }
    const shade = x.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(8,3,1,.5)"); shade.addColorStop(0.46, "rgba(8,3,1,0)");
    x.fillStyle = shade; x.fillRect(0, 0, w, h);
    const pool = x.createRadialGradient(w / 2, h * 0.56, 10, w / 2, h * 0.56, w * 0.5);
    pool.addColorStop(0, "rgba(255,208,150,.2)"); pool.addColorStop(1, "rgba(255,208,150,0)");
    x.fillStyle = pool; x.fillRect(0, 0, w, h);
    woodTex.needsUpdate = true;
  }
  // (the vendored three leaves ShadowMaterial out, which stopped the 3D dice altogether: each die lays a soft blob of its own instead,
  // fainter and wider the higher it is; the top takes the lamp's shadows too, so the blob is only the contact's darkening)
  const blobTex = track((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, "rgba(0,0,0,.85)"); g.addColorStop(.55, "rgba(0,0,0,.4)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c); })());
  const blobMat = track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  const blobGeo = track(new THREE.BoxGeometry(1, 0.002, 1));      // (a thin slab: the vendored three has no PlaneGeometry either)
  const blobs = Array.from({ length: 5 }, () => { const o = new THREE.Mesh(blobGeo, blobMat.clone()); o.frustumCulled = false; o.renderOrder = -1; scene.add(o); return o; });

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
  /** The camera `dist` from the middle at ELEV; `shift` moves the picture up or down (in the screen's own -1..1) without turning it. */
  function pose(dist, shift = 0) {
    camera.position.set(0, Math.sin(ELEV) * dist, TARGET_Z + Math.cos(ELEV) * dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, TARGET_Z);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const t = NEAR * Math.tan(FOV / 2), r = t * (width / height);
    camera.projectionMatrix.makePerspective(-r, r, t + shift * t, -t + shift * t, NEAR, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  /** Where what must be seen falls on the screen, -1..1 each way. */
  function extent() {
    let y0 = Infinity, y1 = -Infinity, x1 = 0;
    for (const [x, y, z] of FIT) { P.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); y0 = Math.min(y0, P.y); y1 = Math.max(y1, P.y); x1 = Math.max(x1, Math.abs(P.x)); }
    return { y0, y1, x1 };
  }
  // the camera comes as close as the table and the dice allow, the table in the middle of its box (it had sat low, with the wood's
  // worth of empty page above it)
  function frameAll() {
    let dist = 6, e;
    for (;;) { pose(dist); e = extent(); if ((e.x1 <= 0.97 && e.y1 - e.y0 <= 1.9) || dist >= 60) break; dist += 0.2; }
    pose(dist, (e.y0 + e.y1) / 2);
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
    renderer.setClearColor(0x000000, 0);
    // the table in the card room's colours (table3d.css: --tk-top's three stops, --tk-brass), so it is the same mahogany, or Office's graphite
    const stops = css.getPropertyValue("--tk-top").match(/#[0-9a-f]{6}/gi) || ["#7C4025", "#5C2D19", "#43200F"];
    paintWood(stops.length >= 3 ? stops : ["#7C4025", "#5C2D19", "#43200F"]);
    const brass = css.getPropertyValue("--tk-brass").trim() || "#CFA24E";
    try { matBand.color.set(brass); matLine.color.set(brass); } catch { /* keep the brass */ }
    matEdge.color.set(root.dataset.theme === "office" ? 0x111317 : night ? 0x1e0d05 : 0x2a1208);
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
    dice.forEach((d, k) => { const h = Math.max(0, d.p.y - DIE / 2), b = blobs[k]; b.position.set(d.p.x + h * 0.25, 0.02, d.p.z + h * 0.3); b.scale.setScalar(DIE * (2.1 + h * 0.5)); b.material.opacity = 0.4 / (1 + h * 0.8); });
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
