// Stow's 3D view (Korbi, 4 November 2026: "a proper 3D mode with the hanseatic items instead of just boring boxes"), drawn
// with three.js (vendor/three.js, kept on the device): the hold of a cog seen from above, its timber ribs, planking and
// deck edge, the cargo aboard and each piece stowed as a lot of Hanseatic goods (stow-goods.js) tied with rope in the
// piece's enamel. It stands in for stow-3d.js's SVG drawing and keeps its interface (holdScene, drawPiece), and its
// projection: the camera is orthographic and maps the plan exactly as stow-3d.js's lens does, so the page's picking (a
// pointer to the drawing's units, the nearest place a piece fits) works through it unchanged, and the SVG on top of the
// canvas keeps the turning arrows and the hatch. The frame never changes with the view (frameOf).
// It draws only while something moves: a draw call rebuilds the cargo and asks for one frame; a frame asks for the next
// only while a wall is rising, a lot is leaving, or the like.
import * as THREE from "./vendor/three.js";
import { geometry, lens, deckField, cellsOf, reachFor, frameOf, turnArrow, f3, RAD } from "./stow-3d.js";
import * as G from "./stow-goods.js";

const PCF_SOFT = THREE.PCFSoftShadowMap;
const dpr = () => Math.min(2, window.devicePixelRatio || 1);

// ---------- the page's colours, read from its tokens ----------
let probe = null, probeCtx = null;
function cssRgb(expr) {
  if (!probe) { probe = document.createElement("i"); probe.setAttribute("aria-hidden", "true"); probe.style.cssText = "position:fixed;left:-9px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none"; document.body.appendChild(probe); }
  probe.style.color = "#000"; probe.style.color = expr;
  const css = getComputedStyle(probe).color;
  const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(css), c = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/.exec(css);
  if (m) return [+m[1], +m[2], +m[3]];
  if (c) return [c[1], c[2], c[3]].map(v => Math.round(v * 255));
  probeCtx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probeCtx.clearRect(0, 0, 1, 1); probeCtx.fillStyle = "#000"; probeCtx.fillStyle = css; probeCtx.fillRect(0, 0, 1, 1);
  return [...probeCtx.getImageData(0, 0, 1, 1).data].slice(0, 3);
}
const mixc = (a, b, k) => a.map((v, i) => v * k + b[i] * (1 - k));
let tk = null, tkKey = "";
/** The enamels (tints 1 to 8 as stow.css has them), the brass, good and bad, and whether it is night. */
function tokens() {
  const key = `${document.documentElement.dataset.theme}|${document.documentElement.dataset.mode}|${matchMedia("(prefers-color-scheme: dark)").matches}`;
  if (tk && key === tkKey) return tk;
  tkKey = key;
  const c = [0, 1, 2, 3].map(k => cssRgb(`var(--c${k})`)), sheet = cssRgb("var(--sheet)"), yard = cssRgb("var(--yard)");
  const light = x => x.map(v => v / 255);
  tk = {
    enamel: [null, c[2], c[1], c[0], c[3], mixc(c[2], sheet, 0.52), mixc(c[1], sheet, 0.52), mixc(c[0], sheet, 0.52), mixc(c[3], sheet, 0.52)].map(x => x && light(x)),
    brass: light(cssRgb("var(--brass)")), bad: light(cssRgb("var(--sw-bad)")), good: light(cssRgb("var(--sw-good)")),
    night: (yard[0] * 0.3 + yard[1] * 0.59 + yard[2] * 0.11) / 255 < 0.45, key,
  };
  return tk;
}
const lin = ([r, g, b]) => new THREE.Color().setRGB(r, g, b);          // a token's colour; three converts nothing, the page is sRGB

// ---------- the renderers: one for the hold, one for the pieces of the tray and the hand ----------
let holdGL = null, pieceGL = null, broken = false;
function makeGL() {
  if (broken) return null;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (typeof WebGL2RenderingContext === "undefined" || !(renderer.getContext() instanceof WebGL2RenderingContext)) { renderer.dispose(); broken = true; return null; }
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCF_SOFT;
    return renderer;
  } catch { broken = true; return null; }
}
/** Whether this device can draw the view at all. */
export function supported() { holdGL ??= makeGL(); return !!holdGL; }

// ---------- a stage: lights and instanced goods ----------
const B1 = new THREE.Vector3(), B2 = new THREE.Vector3(), B3 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
const goodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
const ropeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
const decalMat = new THREE.MeshBasicMaterial({ vertexColors: true });
decalMat.polygonOffset = true; decalMat.polygonOffsetFactor = -2; decalMat.polygonOffsetUnits = -2;
const ropeGeo = new THREE.BoxGeometry(1, 1, 1);

class Stage {
  constructor(cap, shadows) {
    this.cap = cap;
    this.three = new THREE.Scene();
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    this.sun.castShadow = shadows;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 2.5;
    this.three.add(this.sun, this.sun.target, this.hemi);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);
    this.meshes = new Map();
    this.shadows = shadows;
  }
  mesh(key, geo, mat, order = 0) {
    let it = this.meshes.get(key);
    if (!it) {
      const mesh = new THREE.InstancedMesh(geo, mat, this.cap);
      mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = order;
      mesh.castShadow = this.shadows && mat !== haloMat && mat !== decalMat; mesh.receiveShadow = this.shadows && mat !== haloMat && mat !== decalMat;
      this.three.add(mesh);
      this.meshes.set(key, it = { mesh, n: 0 });
    }
    return it;
  }
  begin() { for (const it of this.meshes.values()) it.n = 0; }
  /** One instance of a mesh at a place, turned `yaw`, scaled (sx, sy, sz), in a colour. */
  put(key, geo, mat, x, y, z, yaw, sx, sy, sz, col, order) {
    const it = this.mesh(key, geo, mat, order);
    if (it.n >= this.cap) return;
    Q.setFromAxisAngle(E, yaw); V.set(x, y, z); S.set(sx, sy, sz);
    it.mesh.setMatrixAt(it.n, M4.compose(V, Q, S));
    if (col) it.mesh.setColorAt(it.n, C.setRGB(col[0], col[1], col[2]));
    it.n++;
  }
  /** An instance with its own basis (a decal on a face): right, up, normal. */
  putBasis(key, geo, x, y, z, r, u, n, size) {
    const it = this.mesh(key, geo, decalMat, 3);
    if (it.n >= this.cap) return;
    M4.makeBasis(B1.set(r[0] * size, r[1] * size, r[2] * size), B2.set(u[0] * size, u[1] * size, u[2] * size), B3.set(n[0] * size, n[1] * size, n[2] * size)).setPosition(x, y, z);
    it.mesh.setMatrixAt(it.n++, M4);
  }
  end() { for (const { mesh, n } of this.meshes.values()) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; } }
  light(night, around, reach) {
    const [sc, si, hs, hg, hi] = night ? [0xcfd9ff, 1.6, 0xaab8e8, 0x6b6f86, 0.95] : [0xfff1da, 2.5, 0xeaf1ff, 0xc9b99a, 1.05];
    this.sun.color.set(sc); this.sun.intensity = si; this.hemi.color.set(hs); this.hemi.groundColor.set(hg); this.hemi.intensity = hi;
    this.sun.position.set(around[0] - 6, around[1] + 13, around[2] + 8); this.sun.target.position.set(...around);
    const r = reach + 1;
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 4, far: 40 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }
  /** Points the camera as stow-3d.js's lens does, so a frame [x, y, w, h] of the drawing is the picture. */
  aim(cam, frame) {
    const a = cam.az * RAD, e = cam.el * RAD, c = this.cam, D = 70;
    c.left = frame[0]; c.right = frame[0] + frame[2]; c.top = -frame[1]; c.bottom = -(frame[1] + frame[3]);
    c.position.set(D * Math.cos(e) * Math.sin(a), D * Math.sin(e), D * Math.cos(e) * Math.cos(a));
    c.up.set(0, 1, 0); c.lookAt(0, 0, 0); c.near = 5; c.far = D * 2;
    c.updateMatrixWorld(); c.updateProjectionMatrix();
  }
}

// ---------- goods, ropes and paint for a set of cells ----------
const hash = n => { let h = Math.imul(n + 0x9e3779b1, 2654435761); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
/** The good a lot is: dangerous goods are barrels, reefers crates, heavy cargo ingots or chests, the rest by lot. */
export function goodFor(lot, mark, heavy) {
  if (mark === "dg3" || mark === "dg5") return "barrel";
  if (mark === "flake") return "crate";
  if (heavy) return lot % 2 ? "ingot" : "chest";
  return ["crate", "bale", "sack", "timber", "chest", "barrel"][((lot % 6) + 6) % 6];
}
// Loose cargo's pieces are one of four colours: each is a good of its own
const LOOSE = [0, 0, 1, 2, 5];
const classes = new Map();
function classOf(g, col) {
  const c = g.cells[col], rel = c.pts.map(p => [p[0] - c.x, p[1] - c.y]), key = rel.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(";");
  let k = classes.get(key + g.dh);
  if (!k) classes.set(key + g.dh, k = { key, rel, prism: null, halo: null, pad: null, h: g.dh });
  return k;
}
const prismOf = k => k.prism ||= G.prismGeo(k.rel, k.h);
const haloOf = k => k.halo ||= G.haloGeo(k.rel, k.h);
const padOf = k => k.pad ||= G.padGeo(k.rel);

/**
 * Puts cells' goods, rope and paint on a stage. `cells`: { col, z, dx, dy, dz (offsets), k (scale), lot (the good's), grp
 * (what is tied together), kind ("lot" | "cargo" | "stamp"), tint (1 to 8), mark, heavy, id }. `has(col, z)` says whether a
 * cell is filled (for the faces to paint). Returns nothing; the stage is filled.
 */
function place(st, field, g, cells, has, T) {
  const square = field.kind === "square", dh = g.dh, geos = G.goodGeos(), decals = G.decalGeos();
  const groups = new Map();
  for (const c of cells) {
    if (c.kind !== "lot") continue;
    const q = g.cells[c.col], b = groups.get(c.grp) || groups.set(c.grp, [1e9, -1e9, 1e9, -1e9]).get(c.grp);
    b[0] = Math.min(b[0], q.x); b[1] = Math.max(b[1], q.x); b[2] = Math.min(b[2], q.y); b[3] = Math.max(b[3], q.y);
  }
  const at = new Map(cells.map(c => [c.z * field.n2 + c.col, c]));
  for (const c of cells) {
    const q = g.cells[c.col], x = q.x - g.cx + (c.dx || 0), z = q.y - g.cy + (c.dz || 0), y = c.z * dh + (c.dy || 0), k = c.k ?? 1;
    let col, good;
    if (c.kind === "cargo") { good = ["crate", "barrel", "sack", "crate"][Math.floor(hash(c.id) * 4)]; col = [0.66, 0.6, 0.55]; }
    else if (c.kind === "stamp") { good = "crate"; col = [0.9, 0.52, 0.42]; }
    else {
      good = goodFor(c.lot, c.mark, c.heavy);
      const e = T.enamel[c.tint] || [1, 1, 1], w = c.mark === "flake" ? [0.8, 0.93, 1] : [1, 1, 1], s = c.heavy ? 0.74 : 1;
      col = [0, 1, 2].map(i => (w[i] * 0.78 + e[i] * 0.22) * s);
    }
    if (square) {
      let yaw = 0;
      if (good === "timber") { const b = groups.get(c.grp); yaw = b && b[3] - b[2] > b[1] - b[0] ? Math.PI / 2 : 0; }
      const f = 2 * g.inr * k;
      st.put(good, geos[good], goodMat, x, y + 0.5 * dh * k, z, yaw, f, dh * k, f, col);
    } else {
      const cl = classOf(g, c.col);
      st.put(`prism|${cl.key}`, prismOf(cl), goodMat, x, y, z, 0, k, k, k, col.map(v => v * (good === "bale" ? 1.2 : good === "sack" ? 1.05 : good === "barrel" ? 0.8 : 0.95)));
    }
  }
  // rope round each lot, in its enamel: along every side that no cell of the lot stands against, high and at the waist
  for (const c of cells) {
    if (c.kind !== "lot") continue;
    const q = g.cells[c.col], e = T.enamel[c.tint] || [0.8, 0.8, 0.8], y0 = c.z * dh + (c.dy || 0), kk = c.k ?? 1;
    for (const ed of q.edges) {
      const o = ed.nb >= 0 ? at.get(c.z * field.n2 + ed.nb) : null;
      if (o && o.kind === "lot" && o.grp === c.grp) continue;
      const mx = (ed.a[0] + ed.b[0]) / 2 - g.cx + (c.dx || 0), mz = (ed.a[1] + ed.b[1]) / 2 - g.cy + (c.dz || 0), len = Math.hypot(ed.b[0] - ed.a[0], ed.b[1] - ed.a[1]);
      const yaw = -Math.atan2(ed.b[1] - ed.a[1], ed.b[0] - ed.a[0]);
      for (const h of [0.84, 0.3]) st.put("rope", ropeGeo, ropeMat, mx + ed.nx * 0.012, y0 + dh * h * kk, mz + ed.ny * 0.012, yaw, (len + 0.05) * kk, 0.06 * kk, 0.06 * kk, e);
    }
    if (!has(c.col, c.z + 1)) {                       // and a strap over the top, for a lot of one cell
      const lone = !q.edges.some(ed => { const o = ed.nb >= 0 ? at.get(c.z * field.n2 + ed.nb) : null; return o && o.kind === "lot" && o.grp === c.grp; });
      if (lone && square) {
        const x = q.x - g.cx + (c.dx || 0), z = q.y - g.cy + (c.dz || 0);
        st.put("rope", ropeGeo, ropeMat, x, y0 + dh * 1.005 * kk, z, 0, 0.95 * kk, 0.06 * kk, 0.075 * kk, e);
        st.put("rope", ropeGeo, ropeMat, x, y0 + dh * 1.005 * kk, z, Math.PI / 2, 0.95 * kk, 0.06 * kk, 0.075 * kk, e);
      }
    }
  }
  // paint on the faces that show: a dangerous good's placard, a reefer's snowflake, a consignment's stamp
  for (const c of cells) {
    const kind = c.kind === "stamp" ? "stamp" : c.kind === "lot" ? c.mark : null;
    if (!kind || !decals[kind]) continue;
    const q = g.cells[c.col], y0 = c.z * dh + (c.dy || 0), k = c.k ?? 1, size = Math.min(0.62, 0.64 * g.inr * 2) * k;
    for (const ed of q.edges) {
      if (ed.nb >= 0 && has(ed.nb, c.z)) continue;
      const mx = (ed.a[0] + ed.b[0]) / 2 - g.cx + (c.dx || 0), mz = (ed.a[1] + ed.b[1]) / 2 - g.cy + (c.dz || 0);
      const d = square && c.kind === "lot" && c.mark !== "flake" ? 0.004 : 0.012;
      st.putBasis(kind, decals[kind], mx + ed.nx * d, y0 + dh * 0.52 * k, mz + ed.ny * d, [ed.ny, 0, -ed.nx], [0, 1, 0], [ed.nx, 0, ed.ny], size);
    }
    if (!has(c.col, c.z + 1)) st.putBasis(kind, decals[kind], q.x - g.cx + (c.dx || 0), y0 + dh * k + 0.012, q.y - g.cy + (c.dz || 0), [1, 0, 0], [0, 0, -1], [0, 1, 0], size);
  }
}

// ---------- the hold ----------
/**
 * The hold in 3D, with stow-3d.js's holdScene interface: frame, setCam(cam), centre(i), px, draw(o) (o as holdScene's
 * and also: lot (cell → the lot it belongs to), dead (empty cells no piece can fill), plugLive (floor cell → whether a
 * reefer is on its plug)), plus release().
 */
export function holdScene3D(svg, fieldIn) {
  const field = deckField(fieldIn), g = geometry(field), n2 = field.n2, T0 = tokens();
  holdGL ??= makeGL();
  const renderer = holdGL, host = svg.parentElement;
  let canvas = renderer.domElement, cam = null, L = null, raf = 0, last = null, goneKey = "", goneT0 = 0, dead = false;
  const st = new Stage(Math.max(field.n * 2, 64) + 8, true);
  st.cap = Math.max(field.n * 12, 256);
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame = frameOf(field, 0.8);
  canvas.style.cssText = "position:absolute;pointer-events:none;display:block;border-radius:6px;background:var(--sheet)";
  svg.classList.add("deep");
  host.insertBefore(canvas, svg);
  svg.style.position = "relative";

  // the shell: the floor and the plinth under it; a wall, its deck edge and ledges along each side; a rib at each corner
  const shell = new THREE.Group(), floorM = { p: [], n: [], c: [], i: [] };
  const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const plain = hex => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, metalness: 0 });
  const postMat = plain(0x4b3220), rimMat = plain(0x5f4129), brassMat = new THREE.MeshStandardMaterial({ color: 0xcaa13d, roughness: 0.4, metalness: 0.5 }), ledgeMat = plain(0x8d6742);
  for (const c of g.cells) {
    const rel = c.pts.map(p => [p[0] - c.x, p[1] - c.y]);
    G.tileInto(floorM, rel, c.x - g.cx, c.y - g.cy, G.HOLD.tile, G.HOLD.seam);
    G.plinthInto(floorM, rel, c.x - g.cx, c.y - g.cy, G.HOLD.plinth);
  }
  const H = g.H, CURB = 0.3, walls = [], corners = new Map(), unit = new THREE.BoxGeometry(1, 1, 1);
  const wallGeo = G.wallGeo(H), ped = (mesh, shadow = true) => { mesh.castShadow = mesh.receiveShadow = shadow; shell.add(mesh); return mesh; };
  const key = p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  for (const c of g.cells) for (const e of c.edges) {
    if (e.nb >= 0) continue;
    const mx = (e.a[0] + e.b[0]) / 2 - g.cx, mz = (e.a[1] + e.b[1]) / 2 - g.cy, len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), yaw = Math.atan2(e.nx, e.ny);
    const mesh = ped(new THREE.Mesh(wallGeo, woodMat));
    mesh.position.set(mx, 0, mz); mesh.rotation.y = yaw; mesh.scale.set(len + 0.14, 1, 1);
    const rim = ped(new THREE.Mesh(unit, rimMat));
    rim.rotation.y = yaw; rim.scale.set(len + 0.2, 0.14, 0.3);
    const ledges = [];
    for (let d = 1; d < field.decks; d++) {
      const l = ped(new THREE.Mesh(unit, ledgeMat));
      l.scale.set(len, 0.09, 0.26);
      l.position.set(mx - e.nx * 0.13, d * g.dh - 0.045, mz - e.ny * 0.13); l.rotation.y = yaw;
      ledges.push(l);
    }
    const w = { e, mesh, rim, ledges, level: 1, to: 1, mx, mz, nx: e.nx, nz: e.ny };
    walls.push(w);
    for (const p of [e.a, e.b]) (corners.get(key(p)) || corners.set(key(p), { p, walls: [] }).get(key(p))).walls.push(w);
  }
  const ribs = [...corners.values()].map(k => ({ ...k, post: ped(new THREE.Mesh(unit, postMat)), cap: ped(new THREE.Mesh(unit, brassMat)) }));
  const floor = new THREE.Mesh(G.geo(floorM), woodMat);
  floor.receiveShadow = true;
  shell.add(floor);
  st.three.add(shell);
  /** Lowers or raises the walls: a wall's height, its deck edge on top, and the ribs, from the curb to the full hold. */
  function stand() {
    const hOf = w => CURB + w.level * (H - CURB);
    for (const w of walls) {
      const h = hOf(w);
      w.mesh.visible = true;
      w.mesh.scale.y = h / H;
      w.rim.position.set(w.mx + w.nx * 0.1, h + 0.07, w.mz + w.nz * 0.1);
      for (const l of w.ledges) l.visible = w.level > 0.5;
    }
    for (const r of ribs) {
      const h = Math.max(...r.walls.map(hOf)), x = r.p[0] - g.cx, z = r.p[1] - g.cy;
      r.post.scale.set(0.17, h + 0.14, 0.17); r.post.position.set(x, (h + 0.14) / 2, z);
      r.cap.scale.set(0.23, 0.09, 0.23); r.cap.position.set(x, h + 0.2, z);
    }
  }
  stand();
  // the lighter that takes cleared goods away
  const lighter = new THREE.Mesh(G.lighterGeo(), woodMat);
  lighter.visible = false; lighter.castShadow = true; st.three.add(lighter);

  function layout() {
    const r = svg.getBoundingClientRect(), h = host.getBoundingClientRect(), d = dpr();
    if (!r.width) return false;
    canvas.style.left = `${r.left - h.left}px`; canvas.style.top = `${r.top - h.top}px`;
    canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
    const w = Math.round(r.width * d), hh = Math.round(r.height * d);
    if (canvas.width !== w || canvas.height !== hh) renderer.setSize(w, hh, false);
    renderer.setPixelRatio(1);
    return true;
  }
  function aim() {
    st.aim(cam, frame);
    const a = cam.az * RAD, ca = Math.cos(a), sa = Math.sin(a);
    for (const w of walls) w.to = sa * w.e.nx + ca * w.e.ny > 1e-6 ? 0 : 1;            // the walls on the near side drop, so the eye sees in
    if (still()) for (const w of walls) w.level = w.to;
    st.light(T0.night, [0, 0, 0], g.R + g.H);
  }
  function frameNow(now) {
    let more = false;
    for (const w of walls) {
      const d = w.to - w.level;
      if (Math.abs(d) > 0.004) { w.level += d * 0.3; more = true; } else w.level = w.to;
    }
    stand();
    if (last && goneT0) {
      const p = (now - goneT0) / 340;
      if (p < 1) { build(last, p); more = true; } else if (goneKey) { goneT0 = 0; build(last, 1); }
    }
    return more;
  }
  function tick(now) {
    raf = 0;
    if (dead || !layout()) return;
    const more = frameNow(now);
    renderer.render(st.three, st.cam);
    if (more) ask();
  }
  const ask = () => { if (!raf && !dead) raf = requestAnimationFrame(tick); };

  // the cargo: rebuilt for each draw, from the board
  function build(o, goneP = 0) {
    const T = tokens();
    const { board, tint = [], ghost = null, ghostTint = 1, lit = null, gone = null, lift = null, bad = null, seat = null, marks = null, heavy = null, plugs = null, lot = null, deadCells = null, plugLive = null } = o;
    const mine = new Set(ghost || []), cells = [], tintOf = i => (mine.has(i) && !board[i] ? ghostTint : tint[i] || 0);
    // what is tied together: the lot given, else cells of one enamel touching
    const grp = new Int32Array(field.n).fill(-1);
    let next = 0;
    for (let i = 0; i < field.n; i++) {
      if (!(board[i] || mine.has(i)) || grp[i] >= 0) continue;
      const ghostCell = mine.has(i) && !board[i], tn = tintOf(i);
      if (board[i] === 2 || (!tn && !ghostCell)) continue;
      const id = lot ? (ghostCell ? 1e5 + (lot[i] ?? 0) : lot[i]) : next++;
      if (lot) { grp[i] = id; continue; }
      const todo = [i]; grp[i] = id;
      while (todo.length) {
        const a = todo.pop(), col = a % n2, z = Math.floor(a / n2), nbs = g.cells[col].edges.map(e => e.nb).filter(v => v >= 0).map(v => z * n2 + v);
        if (z > 0) nbs.push(a - n2); if (z < field.decks - 1) nbs.push(a + n2);
        for (const b of nbs) if (grp[b] < 0 && !!board[b] === !!board[i] && board[b] !== 2 && (mine.has(b) && !board[b]) === ghostCell && tintOf(b) === tn) { grp[b] = id; todo.push(b); }
      }
    }
    const away = [0, 0];
    if (gone?.size) { let sx = 0, sz = 0; for (const i of gone) { sx += g.cells[i % n2].x - g.cx; sz += g.cells[i % n2].y - g.cy; } const l = Math.hypot(sx, sz) || 1; away[0] = sx / l; away[1] = sz / l; }
    const ease = t => 1 - (1 - t) * (1 - t);
    for (let i = 0; i < field.n; i++) {
      const ghostCell = mine.has(i) && !board[i];
      if (!board[i] && !ghostCell) continue;
      const col = i % n2, z = Math.floor(i / n2), c = { col, z, id: i, k: 1, lot: 0, grp: grp[i], tint: tintOf(i), mark: marks?.get(i) || null, heavy: !!heavy?.has(i) };
      if (board[i] === 2) c.kind = "stamp"; else if (c.tint || ghostCell) c.kind = "lot"; else c.kind = "cargo";
      if (c.kind === "lot") c.lot = lot ? (ghostCell ? lot[i] ?? 0 : lot[i]) : LOOSE[c.tint % LOOSE.length];
      c.dy = (lift?.get(i) || 0) * g.dh;
      if (gone?.has(i)) {
        const p = ease(Math.min(1, goneP)), reach = g.R + 1.4 - Math.hypot(g.cells[col].x - g.cx, g.cells[col].y - g.cy);
        c.dx = away[0] * p * reach; c.dz = away[1] * p * reach; c.dy += p * (g.H + 0.3 - z * g.dh); c.k = Math.max(0.12, 1 - 0.8 * p);
      }
      cells.push(c);
    }
    st.begin();
    const has = (col, z) => z >= 0 && z < field.decks && !!board[z * n2 + col] && !gone?.has(z * n2 + col);
    place(st, field, g, cells, has, T);
    // sockets on the floor where no cargo stands, a ring on the cargo that covers one
    const decals = G.decalGeos();
    for (const i of plugs || []) {
      const q = g.cells[i % n2];
      if (!board[i] && !mine.has(i)) st.putBasis("socket", decals.socket, q.x - g.cx, 0.05, q.y - g.cy, [1, 0, 0], [0, 0, -1], [0, 1, 0], g.inr * 1.1);
      else if (plugLive && !board[i + n2] && !mine.has(i + n2)) st.putBasis(plugLive.get(i) ? "live" : "blocked", plugLive.get(i) ? decals.live : decals.blocked, q.x - g.cx, g.dh + 0.02, q.y - g.cy, [1, 0, 0], [0, 0, -1], [0, 1, 0], g.inr * 0.9);
    }
    // the glows: a seat in gilt, a rule broken in oxblood, what a move would clear and where the piece would go in the piece's enamel
    const glow = (i, col, flat = false) => {
      const cl = classOf(g, i % n2), q = g.cells[i % n2], z = Math.floor(i / n2);
      st.put(flat ? `pad|${cl.key}` : `halo|${cl.key}`, flat ? padOf(cl) : haloOf(cl), haloMat, q.x - g.cx, z * g.dh + (lift?.get(i) || 0) * g.dh, q.y - g.cy, 0, 1, 1, 1, col, 6);
    };
    const seen = new Set();
    for (const i of seat || []) { seen.add(i); glow(i, T.brass); }
    for (const i of bad || []) if (!seen.has(i)) { seen.add(i); glow(i, T.bad); }
    for (const i of lit || []) if (!seen.has(i) && !gone?.has(i)) { seen.add(i); glow(i, T.enamel[ghostTint] || T.brass); }
    for (const i of mine) if (!seen.has(i) && !board[i]) glow(i, T.enamel[ghostTint] || T.brass);
    for (const i of deadCells || []) glow(i, T.bad, true);
    st.end();
    // the lighter, alongside while goods leave
    if (gone?.size && goneP < 1) {
      const p = ease(Math.min(1, goneP * 2.4)), out = g.R + 1.25, yaw = Math.atan2(away[0], away[1]);
      lighter.visible = true;
      lighter.position.set(away[0] * (out + (1 - p) * 2.2), 0.05, away[1] * (out + (1 - p) * 2.2));
      lighter.rotation.y = yaw + Math.PI / 2;
    } else lighter.visible = false;
  }

  const mine0 = o => new Set(o.ghost || []);
  // ---------- the interface ----------
  const scene = {
    frame, px: 30, decks: field.decks,
    setCam(c) { cam = c; L = lens(g, cam); aim(); ask(); },
    centre(i) { const c = g.cells[i % n2]; return L.p(c.x, c.y, (Math.floor(i / n2) + 0.5) * g.dh); },
    draw(o) {
      last = o;
      const gone = o.gone;
      const k = gone?.size ? [...gone].join() : "";
      if (k !== goneKey) { goneKey = k; goneT0 = k ? performance.now() : 0; }
      build(o, goneT0 ? 0 : gone?.size ? 1 : 0);
      // the arrows and the lettering over the picture, in the drawing's own units
      const out = [];
      if (o.sides) {
        const xs = g.cells.flatMap(c => c.pts.map(p => p[0])), ys = g.cells.flatMap(c => c.pts.map(p => p[1]));
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), my = (y0 + y1) / 2, mx = (x0 + x1) / 2;
        const [px, py] = L.p(x0 - 0.45, my, g.H), [sx, sy] = L.p(x1 + 0.45, my, g.H);
        out.push(`<text class="side3" x="${f3(px)}" y="${f3(py)}">P</text><text class="side3" x="${f3(sx)}" y="${f3(sy)}">S</text>`,
          `<polygon class="bow3" points="${[L.p(mx - 0.32, y0 - 0.14, g.H), L.p(mx + 0.32, y0 - 0.14, g.H), L.p(mx, y0 - 0.6, g.H)].map(q => `${f3(q[0])},${f3(q[1])}`).join(" ")}"/>`);
      }
      // a consignment (stamped cargo) some crate covers shows through them, as the flat drawing's x-ray does (Korbi, 7 November 2026:
      // "a way to see the target crates through the other crates"): its footprint outlined at mid height, dashed, over the picture
      const bd = o.board, shut = i => !!bd[i] && !o.gone?.has(i);
      for (let i = 0; i < field.n; i++) {
        if (bd[i] !== 2 || o.gone?.has(i)) continue;
        const col = i % n2, z = Math.floor(i / n2), c = g.cells[col];
        let covered = false;
        for (let y = z + 1; y < field.decks && !covered; y++) covered = shut(y * n2 + col) || (mine0(o).has(y * n2 + col));
        if (!covered) for (const e of c.edges) if (e.nb >= 0) for (let y = z; y < field.decks && !covered; y++) covered = shut(y * n2 + e.nb) && bd[y * n2 + e.nb] !== 2;
        if (!covered) continue;
        const h = (z + 0.5) * g.dh, pts = c.pts.map(p => L.p(p[0], p[1], h));
        out.push(`<polygon class="xray${o.lit?.has(i) ? " going" : ""}" points="${pts.map(q => `${f3(q[0])},${f3(q[1])}`).join(" ")}"/>`);
      }
      const [fx, fy, fw, fh] = frame, r = Math.min(20 / (scene.px || 30), fw * 0.09);
      out.push(turnArrow(fx + r * 1.25, fy + fh - r * 1.25, r, -1), turnArrow(fx + fw - r * 1.25, fy + fh - r * 1.25, r, 1));
      svg.innerHTML = out.join("");
      ask();
    },
    release() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (canvas.parentNode) canvas.remove();
      svg.classList.remove("deep");
      st.three.traverse(o => { if (o.isMesh && o.geometry && o.geometry !== ropeGeo) { /* shared geometry is kept */ } });
      wallGeo.dispose(); unit.dispose();
      for (const { mesh } of st.meshes.values()) mesh.dispose();
    },
    get canvas() { return canvas; },
    get debug() { return { st, renderer, walls, shell }; },
    /** For tests and the page's resize: draw the last frame again. */
    again() { if (cam) { aim(); ask(); } },
  };
  new ResizeObserver(() => { if (!dead) ask(); }).observe(svg);
  svg.setAttribute("viewBox", frame.map(f3).join(" "));
  return scene;
}

// ---------- a piece on its own: the tray and the hand ----------
let trayStage = null;
const cache = new Map();
/**
 * drawPiece's counterpart: the piece's goods drawn in the hold's view into an image in `svg` (a still, kept by what it
 * shows). `lot` (the good it is), `tint`, `mark`, `heavy` as in the hold; `px`: drawing units to pixels, for the hand.
 */
export function drawPiece3D(svg, field, piece, cam, { fit = false, tint = 1, reach = null, mark = null, heavy = false, lot = null, px = 30 } = {}) {
  const { f, cells } = cellsOf(field, piece), g = geometry(f), L = lens(g, cam), n2 = f.n2, dh = g.dh;
  // the picture's frame, as stow-3d.js's drawPiece takes it
  const all = [];
  let mx = 0, my = 0;
  for (const c of cells) {
    const q = g.cells[c.col], m = L.p(q.x, q.y, (c.z + 0.5) * dh);
    mx += m[0] / cells.length; my += m[1] / cells.length;
    for (const p of q.pts) for (const z of [c.z, c.z + 1]) all.push(L.p(p[0], p[1], z * dh));
  }
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), pad = 0.06;
  const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad };
  let view;
  if (fit) { const r = reach || reachFor(field); view = [mx - r, my - r, 2 * r, 2 * r]; } else view = [box.x, box.y, box.w, box.h];
  svg.setAttribute("viewBox", view.map(f3).join(" "));
  const T = tokens(), d = dpr(), ppu = fit ? 150 / view[2] * d : Math.max(18, px) * d;
  const w = Math.max(8, Math.min(480, Math.round(view[2] * ppu))), h = Math.max(8, Math.min(480, Math.round(view[3] * ppu)));
  const key = [f.kind, cells.map(c => `${c.col}.${c.z}`).join(), Math.round(cam.az), Math.round(cam.el), view.map(f3).join(), tint, lot, mark, heavy, w, h, T.key].join("|");
  let url = cache.get(key);
  if (!url) {
    pieceGL ??= makeGL();
    if (!pieceGL) return { box, cx: mx, cy: my };
    trayStage ??= new Stage(160, false);
    const st = trayStage, items = cells.map((c, j) => ({ col: c.col, z: c.z, id: j, k: 1, lot: lot ?? LOOSE[tint % LOOSE.length], grp: 0, kind: "lot", tint, mark, heavy }));
    st.begin();
    const has = (col, z) => cells.some(c => c.col === col && c.z === z);
    place(st, f, g, items, has, T);
    st.end();
    st.light(T.night, [0, 0, 0], 4);
    st.hemi.intensity *= 1.25;
    st.aim(cam, view);
    pieceGL.setSize(w, h, false);
    pieceGL.render(st.three, st.cam);
    url = pieceGL.domElement.toDataURL("image/png");
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    cache.set(key, url);
  }
  svg.innerHTML = `<image href="${url}" x="${f3(view[0])}" y="${f3(view[1])}" width="${f3(view[2])}" height="${f3(view[3])}" preserveAspectRatio="none"/>`;
  return { box, cx: mx, cy: my };
}
