// The suite's dice on a table, drawn with three.js (vendor/three.js, kept on the device, so it plays offline). Lifted from
// Yacht's dice and grown: bevelled dice with the faces engraved into a texture atlas (pips, or a game's own pictures,
// like Cartel's role glyphs), in gold, bone or ebony; a throw that tumbles and settles on the face the game already
// decided; leather cups that cover a die and lift off it; a die turned over to be shown; a dashed frame for a die only you
// know and a dot for one everyone has seen. It also holds the room: renderer, lights, a camera that is a perspective one
// made from the bundle's orthographic one (the bundle has none), fitted to a set of points or locked to the page's pixels,
// the pointing, the battery saver and a loop that draws only while something moves. A game gives it a host box and says,
// whenever its state changes, which dice there are (stage.setDice); what moved, rolled, was revealed or went is worked out
// from the difference (dice3d-geo.js diffDice), never from the game's rules, and the face a die shows is always the game's.
// docs/dice3d.md says how a game adopts it.
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";
import { FACES, FRAME, PIP_AT, ATLAS, cellOf, faceAt, atlasUV, keyNumber, tumble, diffDice, seeded, mix } from "./dice3d-geo.js";
import { flatMode } from "./mode3d.js";

export { FACES, PIP_AT, keyNumber, scatter } from "./dice3d-geo.js";
const PCF = 1;                                                       // the plain PCF shadow map (the soft one is not in the bundle)
const NEAR = 1, FAR = 400;
const clamp01 = u => Math.max(0, Math.min(1, u));
const ease = u => u * u * (3 - 2 * u);
const calm = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const V = new THREE.Vector3(), W = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0);

// ---------- geometry ----------
/** Geometries joined into one: positions, normals, and where the first has them uvs and colours; indices. */
export function merge(list) {
  const has = n => !!list[0].attributes[n], keys = ["position", "normal", ...(has("uv") ? ["uv"] : []), ...(has("color") ? ["color"] : [])];
  const arr = Object.fromEntries(keys.map(k => [k, []])), idx = [];
  let base = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    for (const k of keys) { const a = g.attributes[k]; for (let i = 0; i < n; i++) { arr[k].push(a.getX(i)); if (a.itemSize > 1) arr[k].push(a.getY(i)); if (a.itemSize > 2) arr[k].push(a.getZ(i)); } }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < n; i++) idx.push(i + base);
    base += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  for (const k of keys) out.setAttribute(k, new THREE.Float32BufferAttribute(arr[k], list[0].attributes[k].itemSize));
  out.setIndex(idx);
  return out;
}
/** A geometry's vertices painted one colour (a vertex-coloured material then shades it). */
export function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
}
const GRID = [0, 0.35, 0.7, 1];
/** The die's body, one edge long: a box with rounded edges and corners, each face with its own part of the atlas. */
export function dieGeometry(r = 0.09) {
  const seg = 8, g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  const inner = 0.5 - r, c = new THREE.Vector3();
  // the grid is bunched in the bevel so it is round, not a chamfer: indexes 0..8 across, three in each bevel
  const at = k => (k <= 3 ? -0.5 + r * GRID[k] : k >= 5 ? 0.5 - r * GRID[8 - k] : 0);
  const snap = x => at(Math.round((x + 0.5) * seg));
  for (let i = 0; i < p.count; i++) {
    const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i), face = faceAt(n.getX(i), n.getY(i), n.getZ(i));   // by the box face the vertex was made for: an edge vertex belongs to one of its two
    // the picture is laid on by where the point sat on the (bunched) box, before it is rounded
    V.set(snap(ox), snap(oy), snap(oz));
    const [u, v] = atlasUV(face, V.x, V.y, V.z);
    uv[i * 2] = u; uv[i * 2 + 1] = v;
    c.set(Math.max(-inner, Math.min(inner, V.x)), Math.max(-inner, Math.min(inner, V.y)), Math.max(-inner, Math.min(inner, V.z)));
    V.sub(c);
    if (V.lengthSq() < 1e-12) V.set(n.getX(i), n.getY(i), n.getZ(i)); else V.normalize();
    n.setXYZ(i, V.x, V.y, V.z);
    V.multiplyScalar(r).add(c);
    p.setXYZ(i, V.x, V.y, V.z);
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/**
 * A solid of revolution about the y axis from a profile [[radius, y, colour?], …] traced with the outside on its right
 * (up the outside of a cup, over the top, down the inside), with normals from the profile and a colour per point.
 */
export function lathe(profile, seg = 28) {
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color(), n = profile.length;
  for (let j = 0; j < n; j++) {
    const a = profile[Math.max(0, j - 1)], b = profile[Math.min(n - 1, j + 1)];
    let nr = b[1] - a[1], ny = -(b[0] - a[0]);
    const len = Math.hypot(nr, ny) || 1;
    nr /= len; ny /= len;
    c.set(profile[j][2] ?? 0xffffff);
    for (let s = 0; s <= seg; s++) {
      const t = (s / seg) * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
      pos.push(profile[j][0] * cs, profile[j][1], profile[j][0] * sn);
      nor.push(nr * cs, ny, nr * sn);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < n - 1; j++) for (let s = 0; s < seg; s++) {
    const a = j * (seg + 1) + s, b = a + 1, d = a + seg + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
/** A box from a corner to a corner, painted. */
export function slab(x0, y0, z0, x1, y1, z1, color) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return color == null ? g : paint(g, color);
}
/** A cup to turn upside down over a die (one edge): leather outside, a band at the rim, hollow inside. `band` and `top` are colours. */
export function cupGeometry({ leather = 0x2a1a14, band = 0xc8923a, top = band, inside = 0x120a07, R = 0.6, H = 1.3, wall = 0.07 } = {}) {
  const prof = [[R, 0, band], [R, H * 0.13, band], [R * 0.98, H * 0.16, leather], [R * 0.9, H * 0.7, leather], [R * 0.72, H * 0.93, leather],
    [R * 0.4, H, top], [R * 0.15, H, top], [0, H, top], [0, H - wall, inside], [R * 0.4 - wall, H - wall, inside], [R * 0.7 - wall, H * 0.93 - wall, inside],
    [R * 0.88 - wall, H * 0.7, inside], [R - wall, 0, inside]];
  return lathe(prof, 24);
}
/** A square frame of thin bars (dashed when `dashes` is more than 0), `side` long, lying flat. */
export function frameGeometry(side = 1.2, bar = 0.055, dashes = 0) {
  const parts = [], len = dashes ? (side / dashes) * 0.55 : side + bar;
  const bars = dashes || 1;
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < bars; i++) {
      const along = dashes ? -side / 2 + (i + 0.5) * (side / dashes) : 0;
      const g = new THREE.BoxGeometry(len, 0.012, bar);
      g.translate(along, 0, side / 2);
      g.rotateY(k * Math.PI / 2);
      parts.push(g);
    }
  }
  return merge(parts);
}

// ---------- the faces: one atlas per style, painted on canvases ----------
/** The look of a die: base colour, ink (what is engraved), the 1's ink, roughness, metalness, and `art` to paint a face. */
export const DIE_STYLES = {
  gold: { base: "#E2B34A", edge: "#C58E2A", ink: "#3A2208", one: "#6A1422", rough: 0.3, metal: 0.4, glow: "#F7DF98" },
  bone: { base: "#F4ECD8", edge: "#DCCBA6", ink: "#241810", one: "#8E2C3B", rough: 0.42, metal: 0, glow: "#FFFFFF" },
  ebony: { base: "#211B19", edge: "#0E0B0A", ink: "#E4C174", one: "#E4C174", rough: 0.28, metal: 0.1, glow: "#4A403A" },
};
/** Pips, engraved: a game's own art uses the same call, ctx at the cell's corner, s the cell's side, layer "color" or "bump". */
export function pipArt(ctx, v, s, layer, st) {
  const off = 0.24 * s, rad = (v === 1 ? 0.125 : 0.088) * s;
  for (const [a, b] of PIP_AT[v]) {
    const x = s / 2 + a * off, y = s / 2 + b * off;
    const grad = ctx.createRadialGradient(x - rad * 0.25, y - rad * 0.25, rad * 0.1, x, y, rad);
    if (layer === "bump") { grad.addColorStop(0, "#000"); grad.addColorStop(0.7, "#222"); grad.addColorStop(1, "#7a7a7a"); }
    else { const ink = v === 1 ? st.one : st.ink; grad.addColorStop(0, ink); grad.addColorStop(1, shade(ink, 0.8)); }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
}
/** A colour darkened (k below 1) or lightened (above 1), as #rrggbb. */
export function shade(css, k) {
  const c = new THREE.Color(css);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return `#${c.getHexString()}`;
}
function paintAtlas(st, layer, cell) {
  const canvas = document.createElement("canvas");
  canvas.width = cell * ATLAS.cols; canvas.height = cell * ATLAS.rows;
  const ctx = canvas.getContext("2d"), rng = seeded(7);
  for (let v = 1; v <= 6; v++) {
    const { col, row } = cellOf(v);
    ctx.save();
    ctx.translate(col * cell, row * cell);
    ctx.beginPath(); ctx.rect(0, 0, cell, cell); ctx.clip();
    if (layer === "bump") { ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, cell, cell); }
    else {
      // the body: a little darker toward the edge, as a worn die is, with pores
      const g = ctx.createRadialGradient(cell * 0.45, cell * 0.4, cell * 0.05, cell / 2, cell / 2, cell * 0.75);
      g.addColorStop(0, st.glow ? shade(st.base, 1.06) : st.base); g.addColorStop(0.65, st.base); g.addColorStop(1, st.edge);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cell, cell);
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < cell * 0.9; i++) { ctx.fillStyle = rng() < 0.5 ? "#000" : "#fff"; ctx.fillRect(rng() * cell, rng() * cell, 1 + rng() * 1.6, 1 + rng() * 1.6); }
      ctx.globalAlpha = 1;
    }
    (st.art || pipArt)(ctx, v, cell, layer, st);
    ctx.restore();
  }
  return canvas;
}
function atlasTexture(st, layer, cell, srgb) {
  const t = new CanvasTexture(paintAtlas(st, layer, cell));
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// ---------- the turn a die has to show a face ----------
const MQ = new THREE.Matrix4();
const faceQuats = {};
for (const [, , , v] of FACES) {
  const f = FRAME[v];
  // rows right, normal, down: it takes the face's right to x, its normal to y and its down to z
  MQ.set(f.right[0], f.right[1], f.right[2], 0, f.n[0], f.n[1], f.n[2], 0, f.down[0], f.down[1], f.down[2], 0, 0, 0, 0, 1);
  faceQuats[v] = new THREE.Quaternion().setFromRotationMatrix(MQ);
}
/** The die's turn that shows `value` on top, its picture's top toward -z, turned `yaw` about the vertical. */
export function showing(value, yaw = 0) {
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(faceQuats[value] || faceQuats[1]);
}

// ---------- the stage ----------
/**
 * A stage in `host` (a box with a size). Options:
 *   camera { elev (degrees above the table, 58), fov (26), target [x, 0, z], span (world units across the box: locks the
 *            camera to the page's pixels) | fit [[x, y, z]…] (every point must stay in view) }
 *   shadows (true; off under the battery saver), clear (colour, or (night) => colour), onSkin(night, stage),
 *   onLost() (the WebGL context went), cell (atlas cell size, 192)
 * Throws where there is no WebGL: the page draws flat.
 */
export function createDiceStage(host, o = {}) {
  const lowPower = o.lowPower ?? flatMode();
  const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: false, powerPreference: "low-power" });
  const wantShadows = o.shadows !== false && !lowPower;
  renderer.shadowMap.enabled = wantShadows;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%";
  host.replaceChildren(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  const cam = { elev: 58, fov: 26, target: [0, 0, 0], ...o.camera };
  const ELEV = cam.elev * Math.PI / 180, FOV = cam.fov * Math.PI / 180;
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6), hemi = new THREE.HemisphereLight(0xfff4e4, 0x4a3a2c, 1.0);
  sun.castShadow = wantShadows;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, hemi);

  const own = [];
  const track = x => { own.push(x); return x; };
  const std = (color, roughness = 0.6, metalness = 0, extra = {}) => track(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
  const mesh = (g, m, { cast = true, receive = true, at } = {}) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = cast; x.receiveShadow = receive; x.frustumCulled = false;
    if (at) x.position.set(...at);
    scene.add(x);
    return x;
  };

  let width = 1, height = 1, night = false, dead = false, dirty = false, frameId = 0, lastDraw = 0, frames = 0;
  const skinners = [], framers = [], anims = [];
  const P = new THREE.Vector3();

  // ----- the camera -----
  let dist = 20, span = cam.span || null, fitPoints = cam.fit || null;
  const T = new THREE.Vector3(...cam.target);
  function pose(d) {
    dist = d;
    camera.position.set(T.x, T.y + Math.sin(ELEV) * d, T.z + Math.cos(ELEV) * d);
    camera.up.set(0, 1, 0);
    camera.lookAt(T);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const t = NEAR * Math.tan(FOV / 2), r = t * (width / height);
    camera.projectionMatrix.makePerspective(-r, r, t, -t, NEAR, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  const fits = () => fitPoints.every(([x, y, z]) => { P.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); return Math.abs(P.x) <= 1 && Math.abs(P.y) <= 1; });
  function frame_() {
    if (span) pose(span / (2 * Math.tan(FOV / 2) * (width / height)));
    else if (fitPoints) { let d = 6; pose(d); while (!fits() && d < 200) { d += 0.25; pose(d); } }
    else pose(dist);
    // the sun's shadow box follows what is in view
    const half = (span || dist) * 0.8;
    sun.position.set(T.x - half * 0.45, T.y + half * 1.1, T.z + half * 0.6);
    sun.target.position.copy(T);
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  /** The table point under a pixel of the box (x, y from its top left), at height `y`; null when the ray misses. */
  function worldAt(sx, sy, y = 0) {
    P.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    V.copy(P).sub(camera.position);
    if (Math.abs(V.y) < 1e-9) return null;
    const t = (y - camera.position.y) / V.y;
    return t > 0 ? V.multiplyScalar(t).add(camera.position).clone() : null;
  }
  /** Pixels (from the box's top left) of a world point. */
  function screenOf(p) { P.copy(p).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); return [(P.x + 1) / 2 * width, (1 - P.y) / 2 * height]; }
  /** How many world units one pixel is, across the screen, at a pixel of the table plane. */
  function unitsPerPx(sx, sy) { const a = worldAt(sx - 1, sy), b = worldAt(sx + 1, sy); return a && b ? a.distanceTo(b) / 2 : 1; }

  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.max(1, Math.min(lowPower ? 1 : devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (width * height)))));
    renderer.setSize(width, height, false);
    frame_();
    resized = performance.now();
    for (const f of framers) f(stage);
    invalidate();
  }
  function applySkin() {
    const root = document.documentElement;
    night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    const clear = typeof o.clear === "function" ? o.clear(night) : o.clear;
    if (clear != null) renderer.setClearColor(clear, 1);
    sun.intensity = night ? 2.1 : 2.6;
    hemi.intensity = night ? 0.8 : 1.0;
    for (const f of skinners) f(night, stage);
    invalidate();
  }

  // ----- drawing, only while something moves -----
  let resized = 0;
  function invalidate() { dirty = true; if (!frameId && !dead) frameId = requestAnimationFrame(loop); }
  /** Starts an animation: fn(now) returns true while it goes on. */
  function go(fn) { anims.push(fn); invalidate(); }
  let last = 0;
  function loop(t) {
    frameId = 0;
    const gap = lowPower ? 50 : 30;
    if (t - lastDraw < gap) { if (dirty || anims.length) frameId = requestAnimationFrame(loop); return; }
    if (document.hidden) { return; }                        // nothing to see: it draws again when the page does
    const dt = last ? Math.min(100, t - last) : 16;
    last = t; lastDraw = t;
    const now = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](now)) anims.splice(i, 1);
    let moving = false;
    for (const f of framers) if (f.tick?.(dt, now)) moving = true;
    if (pool.update(dt, now)) moving = true;
    dirty = false;
    renderer.render(scene, camera);
    frames++;
    if (anims.length || moving) invalidate(); else last = 0;
  }
  document.addEventListener("visibilitychange", invalidate);

  // ----- the dice -----
  const pool = (() => {
    const cell = o.cell || 192, kinds = new Map(), live = new Map();          // style name → { mesh, mat }; id → die
    const CAP = o.capacity || 72;
    const styleOf = s => {
      const name = typeof s === "string" ? s : s.name;
      let k = kinds.get(name);
      if (!k) {
        const st = typeof s === "string" ? DIE_STYLES[s] : { ...DIE_STYLES.bone, ...s };
        const map = track(atlasTexture(st, "color", cell, true)), bump = track(atlasTexture(st, "bump", cell, false));
        const mat = std(0xffffff, st.rough, st.metal, { map, bumpMap: bump, bumpScale: o.bumpScale ?? 2.2 });
        const m = new THREE.InstancedMesh(track(dieGeometry()), mat, CAP);
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
        scene.add(m);
        k = { name, mesh: m, mat, items: [] };
        kinds.set(name, k);
      }
      return k;
    };
    // cups (gold and plain dice have their own: a band of brass, or of leather), marks
    const cupMats = std(0xffffff, 0.55, 0.12, { vertexColors: true, side: 2 });
    const cupSets = new Map();
    const cupFor = (key, spec) => {
      let c = cupSets.get(key);
      if (!c) {
        const m = new THREE.InstancedMesh(track(cupGeometry(spec)), cupMats, CAP);
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m);
        c = { mesh: m, items: [] };
        cupSets.set(key, c);
      }
      return c;
    };
    const dashMat = std(0xf6eede, 0.5, 0, { emissive: 0x3a3426 }), ringMat = std(0xe9c46a, 0.4, 0.3, { emissive: 0x4a3a10 }), dotMat = std(0x9a2f40, 0.35, 0, { emissive: 0x3a0c14 });
    const marks = {
      dash: new THREE.InstancedMesh(track(frameGeometry(1.22, 0.06, 4)), dashMat, CAP),
      ring: new THREE.InstancedMesh(track(frameGeometry(1.3, 0.09, 0)), ringMat, CAP),
      dot: new THREE.InstancedMesh(track((() => { const g = new THREE.SphereGeometry(0.12, 12, 8); g.scale(1, 0.5, 1); return g; })()), dotMat, CAP),
    };
    for (const m of Object.values(marks)) { m.frustumCulled = false; m.receiveShadow = true; m.count = 0; scene.add(m); }

    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), PP = new THREE.Vector3(), QQ = new THREE.Quaternion();
    const jitter = id => { const h = keyNumber(String(id)); return ((h % 997) / 997 - 0.5) * 0.5; };

    /** A die's resting state is `rest`; an animation takes over `p`, `q`, `sc` until it ends. */
    function make(e) {
      const d = { id: e.id, style: e.style, value: e.value ?? 1, cover: !!e.cover, rest: null, p: new THREE.Vector3(), q: new THREE.Quaternion(), sc: 1, token: null, anim: false,
        lift: 0, liftTo: 0, cup: e.cover ? 0 : 1, cupTo: e.cover ? 0 : 1, leaving: false, dashed: false, ring: false, dot: false, size: e.size, gold: !!e.gold, flip: 0 };
      return d;
    }
    const restOf = e => ({ x: e.x, z: e.z, size: e.size, yaw: e.yaw ?? jitter(e.id) });
    function settle(d) { const r = d.rest; d.p.set(r.x, r.size / 2, r.z); d.q.copy(showing(d.value, r.yaw)); d.sc = 1; d.anim = false; }
    const cancel = d => { d.token = null; d.anim = false; };
    function animate(d, fn) {
      const token = d.token = {};
      d.anim = true;
      go(t => {
        if (d.token !== token) return false;
        if (fn(t)) return true;
        if (d.token === token) { d.token = null; if (!d.leaving) settle(d); d.anim = false; }
        return false;
      });
    }
    /** A tumble from where the die is to its rest, landing on its value. */
    function toss(d, delay = 0, from = null) {
      const r = d.rest, end = showing(d.value, r.yaw);
      if (calm()) { settle(d); return; }
      const tb = tumble(mix(keyNumber(String(d.id)), d.value)), s = r.size;
      const p0 = from ? new THREE.Vector3(from.x, s * (from.y ?? 0.5), from.z) : d.p.clone(), t0 = performance.now() + delay, ms = tb.ms * (from ? 0.9 : 0.62);
      const axis = new THREE.Vector3(tb.ax, tb.ay, tb.az).normalize(), whirl = new THREE.Quaternion();
      d.sc = 1;
      animate(d, t => {
        if (t < t0) return true;
        const u = clamp01((t - t0) / ms), out = 1 - (1 - u) ** 3;
        d.p.set(p0.x + (r.x - p0.x) * out, s / 2 + s * 2.1 * tb.bounce * (from ? 1 : 0.55) * Math.abs(Math.cos(u * Math.PI * 2.6)) * (1 - u) ** 2.2 * (u < 0.12 ? 1 + (0.12 - u) * 6 : 1), p0.z + (r.z - p0.z) * out);
        whirl.setFromAxisAngle(axis, tb.turns * Math.PI * 2 * (1 - u) ** 2);
        d.q.copy(whirl).multiply(end);
        return u < 1;
      });
    }
    /** A hop (or, for a small step, a glide) to a new rest. */
    function hop(d, rest) {
      const r0 = d.rest, p0 = d.p.clone(), q0 = d.q.clone(), far = Math.hypot(rest.x - p0.x, rest.z - p0.z) / rest.size;
      d.rest = rest;
      const end = showing(d.value, rest.yaw);
      if (calm()) { settle(d); return; }
      const t0 = performance.now(), ms = far < 1.7 ? 200 : 420, rise = far < 1.7 ? 0 : 0.9 * rest.size;
      animate(d, t => {
        const u = clamp01((t - t0) / ms), e = ease(u);
        d.p.set(p0.x + (rest.x - p0.x) * e, rest.size / 2 + (p0.y - rest.size / 2) * (1 - e) + rise * Math.sin(Math.PI * u), p0.z + (rest.z - p0.z) * e);
        d.q.copy(q0).slerp(end, e);
        return u < 1;
      });
      void r0;
    }
    /** Turned over to show its face: it hops and spins a half turn. */
    function turn(d, delay = 0) {
      const r = d.rest, end = showing(d.value, r.yaw);
      if (calm()) { settle(d); return; }
      const t0 = performance.now() + delay, ms = 560, flipper = new THREE.Quaternion(), s = r.size;
      d.sc = 1;
      animate(d, t => {
        if (t < t0) { d.q.copy(flipper.setFromAxisAngle(AX, Math.PI)).multiply(end); d.p.set(r.x, s / 2, r.z); return true; }
        const u = clamp01((t - t0) / ms), e = ease(u);
        d.p.set(r.x, s / 2 + s * 0.85 * Math.sin(Math.PI * e), r.z);
        d.q.copy(flipper.setFromAxisAngle(AX, Math.PI * (1 - e))).multiply(end);
        return u < 1;
      });
    }
    /** Appears: grows from nothing with a small hop (or flies in from `from`). */
    function appear(d, from) {
      if (calm()) { settle(d); return; }
      if (from) { toss(d, 0, from); return; }
      const r = d.rest, t0 = performance.now(), ms = 300, s = r.size, end = showing(d.value, r.yaw);
      animate(d, t => {
        const u = clamp01((t - t0) / ms);
        d.sc = ease(u);
        d.p.set(r.x, s / 2 + s * 0.5 * Math.sin(Math.PI * u), r.z);
        d.q.copy(end);
        return u < 1;
      });
    }
    function leave(d, to) {
      d.leaving = true;
      if (calm()) { live.delete(d.id); return; }
      const t0 = performance.now(), ms = 300, p0 = d.p.clone(), s = d.rest.size;
      animate(d, t => {
        const u = clamp01((t - t0) / ms), e = ease(u);
        d.sc = 1 - e;
        if (to) d.p.set(p0.x + (to.x - p0.x) * e, s / 2 + s * 0.8 * Math.sin(Math.PI * u), p0.z + (to.z - p0.z) * e);
        if (u >= 1) { live.delete(d.id); return false; }
        return true;
      });
    }

    let before = [], first = true;
    /** The dice to show now: the diff with the last call decides what moves. `snap` puts everything in place at once. */
    function setDice(list, { snap = false } = {}) {
      const after = list.map(e => ({ ...e, size: e.size || 1 }));
      const diff = diffDice(before, after);
      const instant = snap || first || calm() || (performance.now() - resized < 250 && !diff.born.length && !diff.gone.length);
      const byId = new Map(after.map(e => [e.id, e]));
      const apply = (d, e) => {
        d.style = e.style; d.gold = !!e.gold; d.dashed = !!e.dashed; d.ring = !!e.ring; d.dot = !!e.dot; d.liftTo = e.lift ? 0.32 : 0; d.size = e.size;
        d.cupSpec = e.cup;
      };
      for (const e of after) {
        let d = live.get(e.id);
        if (!d || d.leaving) { d = make(e); live.set(e.id, d); d.rest = restOf(e); d.value = e.value ?? 1; apply(d, e); if (instant) settle(d); else appear(d, e.from); continue; }
        apply(d, e);
        const rest = restOf(e);
        if (instant) { cancel(d); d.rest = rest; d.value = e.value ?? d.value; d.cover = !!e.cover; d.cupTo = d.cup = e.cover ? 0 : 1; settle(d); continue; }
        if (diff.revealed.includes(byId.get(e.id)) || diff.covered.includes(byId.get(e.id))) {
          const reveal = diff.revealed.some(x => x.id === e.id);
          d.rest = rest; d.value = e.value ?? d.value; d.cover = !!e.cover;
          d.cupTo = e.cover ? 0 : 1;
          if (reveal) { turn(d, 160); } else { cancel(d); d.cup = 0.69; settle(d); }
        } else if (diff.rolled.some(x => x.id === e.id)) {
          d.rest = rest; d.value = e.value ?? d.value; toss(d, 0, null);
        } else if (diff.moved.some(x => x.id === e.id)) {
          d.value = e.value ?? d.value; hop(d, rest);
        } else { d.rest = rest; if (!d.anim) settle(d); }
      }
      for (const o2 of diff.gone) { const d = live.get(o2.id); if (d && !d.leaving) { if (instant) live.delete(o2.id); else leave(d, o2.to); } }
      before = after;
      first = false;
      invalidate();
    }

    const dtEase = (a, b, dt, tau) => a + (b - a) * (1 - Math.exp(-dt / tau));
    /** Writes every die into the instance buffers; true while something still settles (lifts, cups). */
    function update(dt) {
      for (const k of kinds.values()) k.items.length = 0;
      for (const c of cupSets.values()) c.items.length = 0;
      const dashes = [], rings = [], dots = [];
      let moving = false;
      for (const d of live.values()) {
        const s = d.size;
        d.lift = dtEase(d.lift, d.liftTo, dt, 70); if (Math.abs(d.lift - d.liftTo) > 0.004) moving = true; else d.lift = d.liftTo;
        const cupWas = d.cup;
        d.cup = dtEase(d.cup, d.cupTo, dt, d.cupTo > d.cup ? 130 : 90);
        if (Math.abs(d.cup - d.cupTo) > 0.004) moving = true; else d.cup = d.cupTo;
        void cupWas;
        const covered = d.cup < 0.02 && d.cover;
        const lifted = d.lift * s;
        const rest = d.rest;
        if (!covered && !(d.cup >= 1 && d.cover)) {
          const k = styleOf(d.style);
          if (k.items.length < CAP && d.sc > 0.001) {
            PP.set(d.p.x, d.p.y + lifted, d.p.z);
            S.set(s * d.sc, s * d.sc, s * d.sc);
            M.compose(PP, d.q, S);
            k.items.push(M.clone());
          }
        }
        // the cup: down over the die, or rising off it, tilting away, until it is gone
        const cupShown = d.cup < 0.995 && (d.cover || d.cup < 0.995);
        if (cupShown && d.cupSpec !== false) {
          const set = cupFor(d.gold ? "gold" : "plain", d.gold ? { band: 0xe0b04a, top: 0xc99a3a, leather: 0x4a2c1c } : { band: 0x6b4a38, top: 0x4a2c1c, leather: 0x3d2418 });
          const t = d.cup, fade = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
          PP.set(rest.x + t * 0.55 * s, t * 1.5 * s, rest.z + t * 0.1 * s);
          QQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -t * 0.55);
          S.set(s * fade, s * fade, s * fade);
          M.compose(PP, QQ, S);
          if (set.items.length < CAP) set.items.push(M.clone());
        }
        if (d.dashed && !covered && d.sc > 0.5) dashes.push([rest.x, 0.014 * s, rest.z, s, rest.yaw]);
        if (d.ring && !covered && d.sc > 0.5) rings.push([d.p.x, 0.016 * s, d.p.z, s, rest.yaw]);
        if (d.dot && !covered && d.sc > 0.5) dots.push([d.p.x + 0.3 * s, d.p.y + lifted + 0.5 * s, d.p.z - 0.3 * s, s]);
      }
      for (const k of kinds.values()) {
        k.items.forEach((m, i) => k.mesh.setMatrixAt(i, m));
        k.mesh.count = k.items.length; k.mesh.instanceMatrix.needsUpdate = true;
      }
      for (const c of cupSets.values()) {
        c.items.forEach((m, i) => c.mesh.setMatrixAt(i, m));
        c.mesh.count = c.items.length; c.mesh.instanceMatrix.needsUpdate = true;
      }
      const put = (mesh, list, tint) => {
        const n = Math.min(CAP, list.length);
        for (let i = 0; i < n; i++) {
          const [x, y, z, s, yaw = 0] = list[i];
          QQ.setFromAxisAngle(UP, yaw);
          M.compose(PP.set(x, y, z), QQ, S.set(s, s, s));
          mesh.setMatrixAt(i, M);
        }
        mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
        void tint;
      };
      put(marks.dash, dashes); put(marks.ring, rings); put(marks.dot, dots);
      return moving;
    }
    /** The id of the die nearest a pixel, if one is within reach. */
    function pick(sx, sy) {
      let best = null, near = Infinity;
      for (const d of live.values()) {
        if (d.leaving) continue;
        const [x, y] = screenOf(d.p), [ex] = screenOf(W.copy(d.p).setX(d.p.x + d.size * 0.75)), r = Math.max(10, Math.abs(ex - x) * 1.05), dist2 = Math.hypot(x - sx, y - sy);
        if (dist2 < r && dist2 < near) { near = dist2; best = d.id; }
      }
      return best;
    }
    function reset() { for (const d of live.values()) cancel(d); live.clear(); before = []; first = true; }
    return { setDice, update, pick, reset, live, styleOf, get count() { return live.size; } };
  })();

  /** The classic rectangular table (felt in a wooden rim edged in brass), x across, z toward the player. */
  function addTable({ w = 11, d = 8.4, felt = 0x2f6a56, rim = 0x5a3b25, brass = 0xc8923a, edge = 0.55 } = {}) {
    const matFelt = std(felt, 0.96), matRim = std(rim, 0.5), matBrass = std(brass, 0.34, 0.55);
    const box = (bw, bh, bd, x, y, z, m) => mesh(track(new THREE.BoxGeometry(bw, bh, bd)), m, { cast: false, at: [x, y, z] });
    box(w, 0.4, d, 0, -0.2, 0, matFelt);
    box(w + 2 * edge, 0.7, edge, 0, -0.05, -(d / 2 + edge / 2), matRim); box(w + 2 * edge, 0.7, edge, 0, -0.05, d / 2 + edge / 2, matRim);
    box(edge, 0.7, d, -(w / 2 + edge / 2), -0.05, 0, matRim); box(edge, 0.7, d, w / 2 + edge / 2, -0.05, 0, matRim);
    for (const [bw, bd, x, z] of [[w, 0.07, 0, -d / 2], [w, 0.07, 0, d / 2], [0.07, d, -w / 2, 0], [0.07, d, w / 2, 0]]) box(bw, 0.05, bd, x, 0.01, z, matBrass).castShadow = false;
    skinners.push(n => matFelt.color.set(n ? new THREE.Color(felt).multiplyScalar(0.7) : felt));
    return { felt: matFelt, rim: matRim, brass: matBrass };
  }

  const ac = new AbortController();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const mo = new MutationObserver(applySkin);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); o.onLost?.(); }, { signal: ac.signal });
  canvas.addEventListener("webglcontextrestored", invalidate, { signal: ac.signal });

  const stage = {
    THREE, scene, camera, renderer, host, sun, hemi, std, mesh, track, lowPower,
    get night() { return night; }, get width() { return width; }, get height() { return height; },
    worldAt, screenOf, unitsPerPx, pose, invalidate, go, addTable,
    /** Fit the camera to world points that must stay in view (leaves any pixel lock). */
    fit(points) { fitPoints = points; span = null; frame_(); invalidate(); },
    /** Lock the camera to the box's pixels: the box spans `units` world units across at the target. */
    lock(units) { span = units; fitPoints = null; frame_(); invalidate(); },
    onSkin(fn) { skinners.push(fn); fn(night, stage); },
    /** fn(stage) when the box changes size (after the camera is refitted); fn.tick(dt, now) may return true to keep drawing. */
    onResize(fn) { framers.push(fn); },
    setDice: pool.setDice, pick: pool.pick, reset: pool.reset, dice: pool.live,
    get busy() { return anims.length > 0; }, get frames() { return frames; },
    /** The face on top of each live die, read from how it lies (for tests: it should be the game's). */
    faceUp: id => { const d = pool.live.get(id); return d ? FACES.reduce((b, [x, y, z, v]) => { const up = V.set(x, y, z).applyQuaternion(d.q).y; return up > b[0] ? [up, v] : b; }, [-2, 0])[1] : null; },
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      ac.abort();
      document.removeEventListener("visibilitychange", invalidate);
      ro.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", applySkin);
      for (const x of own) x.dispose?.();
      scene.traverse(x => { x.dispose?.(); if (x.isInstancedMesh) x.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
    },
  };
  applySkin();
  resize();
  return stage;
}
