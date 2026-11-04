// Solitaire's table in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline). The table is still
// the flat plane of the 2D board with the same layout, one board pixel a unit; the cards are thin slabs with real thickness,
// face up or face down, stacked as they lie; a soft shadow is a blurred quad under each (a card lifted by a finger casts a
// longer one); a card that moves slides in an arc and a card that turns over turns. The camera looks straight down at the
// table (the 2D board exactly) or tilts away from it up to TILT_MAX, with a little yaw, round the table's middle.
//
// This file only renders and unprojects. solitaire-board.js keeps the 2D rules of touch: it hands over each frame's layout
// (`set`), asks which card is under a finger (`pick`) and where a pointer is on the table (`toTable`), and moves the camera
// for a two-finger drag (`orbitBy`). The felt is not drawn: the canvas is see-through over the table's baize, so the baize
// and its brass frame are the 2D page's own. Faces are textures painted on canvases (CanvasTexture, from vendor/three-tex.js,
// which the trimmed three.js leaves out) in the page's card colours.
// It draws only while something moves, at most a frame per animation tick, so a settled table costs nothing.
// Throws where there is no WebGL (the page then keeps the 2D table).
import * as THREE from "./vendor/three.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";

const DEG = Math.PI / 180;
export const FOV = 28 * DEG, TILT_MAX = 55, YAW_MAX = 14, ANGLED = 38;
const ASPECT = 1.4;                                   // a card is 1 wide and 1.4 high, as the 2D card is 2.5em by 3.5em
const FRAME_MS = 1000 / 50;

// ---------- the camera's maths: pure, so a test can check it without a browser ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** The camera `dist` from the table's middle, `tilt` degrees from straight above toward the near edge, turned `yaw` degrees round: its position and axes. */
export function poseOf(tilt, yaw, dist) {
  const th = tilt * DEG, ph = yaw * DEG;
  const pos = [Math.sin(th) * Math.sin(ph) * dist, Math.cos(th) * dist, Math.sin(th) * Math.cos(ph) * dist];
  const f = unit([-pos[0], -pos[1], -pos[2]]);
  // screen up is the far side of the table, whatever the tilt (at 0 tilt, "up" is rotated with the yaw)
  const up = [-Math.cos(th) * Math.sin(ph), Math.sin(th), -Math.cos(th) * Math.cos(ph)];
  const right = unit(cross(f, up)), top = cross(right, f);
  return { pos, f, right, up: top };
}
/** A point of the table's world in the camera's normalised screen (-1..1 each way; z the depth in front of the camera). */
export function project(P, p, aspect) {
  const v = sub(p, P.pos), z = dot(v, P.f), t = Math.tan(FOV / 2);
  return [dot(v, P.right) / z / (t * aspect), dot(v, P.up) / z / t, z];
}
/** The nearest camera distance at which the table's four corners (W by H) are all on screen. At no tilt that is exactly the distance at which a board pixel is a screen pixel. */
export function fitDistance(W, H, tilt, yaw, aspect = W / H) {
  const corners = [[-W / 2, 0, -H / 2], [W / 2, 0, -H / 2], [W / 2, 0, H / 2], [-W / 2, 0, H / 2]];
  const d0 = H / 2 / Math.tan(FOV / 2);
  const fits = d => { const P = poseOf(tilt, yaw, d); return corners.every(c => { const s = project(P, c, aspect); return s[2] > 0 && Math.abs(s[0]) <= 1.0001 && Math.abs(s[1]) <= 1.0001; }); };
  let lo = d0 * 0.5, hi = d0 * 3;
  if (fits(lo)) return lo;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}
/** Where the ray through a normalised screen point meets the horizontal plane `h` high: board pixels from the table's middle ({x, z}). */
export function groundAt(P, nx, ny, aspect, h = 0) {
  const t = Math.tan(FOV / 2);
  const d = [P.f[0] + P.right[0] * nx * t * aspect + P.up[0] * ny * t, P.f[1] + P.right[1] * nx * t * aspect + P.up[1] * ny * t, P.f[2] + P.right[2] * nx * t * aspect + P.up[2] * ny * t];
  if (d[1] > -1e-6) return null;
  const s = (h - P.pos[1]) / d[1];
  return { x: P.pos[0] + d[0] * s, z: P.pos[2] + d[2] * s };
}

// ---------- the colours of the page, read as the 2D cards read them ----------
const FAMILY = () => getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name) || "").trim() || fallback;
const FOUR = ["#1F6DB0", "#1B7A58", null, null];       // ♦ ♣ in four-colour mode; ♥ ♠ stay red and black
const SUITS = ["♦", "♣", "♥", "♠"];
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const pow2 = n => 2 ** Math.ceil(Math.log2(Math.max(2, n)));
const hex = s => { const c = new THREE.Color(); try { c.set(s); } catch { c.set("#888888"); } return c; };
/** `a` mixed `t` of the way to `b` (css colours → hex). */
function mix(a, b, t) {
  const x = hex(a), y = hex(b);
  return `#${new THREE.Color(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t).getHexString()}`;
}

/**
 * The 3D table in `host` (the board's root element, which the canvas is put into). opts: { onLost() (the GL context was
 * lost: the page goes back to 2D), reduced (prefer-reduced-motion) }.
 * → { build(cards), set(frame), pick(cx, cy), toTable(cx, cy, h), topOf(uid), liftHeight(), orbitBy(dx, dy), commit(), preset(),
 *     camera(), setCamera(tilt, yaw, soft), hold(on), restyle(), setFourColour(on), resize(), dispose(), canvas }.
 */
export function createView(host, opts = {}) {
  const reduced = opts.reduced ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "so-gl";
  canvas.setAttribute("aria-hidden", "true");
  host.insertBefore(canvas, host.firstChild);
  let lost = false;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; opts.onLost?.(); });

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Moor's is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};

  // ---------- state ----------
  let W = 0, H = 0, cw = 0, ch = 0, thick = 1, em = 16, dpr = Math.min(devicePixelRatio || 1, 2);
  let frame = null, held = false, shown = true, rafId = 0, lastDraw = 0, lastNow = 0;
  let tilt = 0, yaw = 0, tTilt = 0, tYaw = 0, dist = 600, pose = null, camBusy = false;
  let four = false, won = false, wonAt = 0;
  const cards = new Map();                 // uid → { mesh, shadow, rank, suit, tgt, cur, delay, ring }
  const slotMeshes = [], dropMeshes = [], hintMeshes = [], rings = new Map();
  let badge = null, badgeKey = "", sparks = null, spark = [], sheen = null;
  const tex = new Map();                   // key → { tex, canvas, paint }
  const mats = new Map();
  let fam = FAMILY(), col = null;

  // ---------- geometry ----------
  const quad = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    g.setIndex([0, 3, 2, 0, 2, 1]);
    return g;
  })();
  /** A unit card: 1 wide, 1.4 high, 1 deep, centred; its top cap's picture is the face, its bottom cap's the back (materials 0, 1; the rim is 2). */
  const slab = (() => {
    const w = 1, h = ASPECT, r = 0.08, s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 5 });
    const pos = g.attributes.position, uv = g.attributes.uv, caps = g.groups[0], rim = g.groups[1], half = caps.count / 2;
    const bottomFirst = pos.getZ(caps.start) < 0.5;                       // which half of the caps is the z = 0 one
    for (let i = caps.start; i < caps.start + caps.count; i++) {
      const bottom = bottomFirst ? i < caps.start + half : i >= caps.start + half;
      uv.setXY(i, pos.getX(i) + 0.5, (bottom ? -pos.getY(i) : pos.getY(i)) / ASPECT + 0.5);
    }
    g.groups = [
      { start: caps.start, count: half, materialIndex: bottomFirst ? 1 : 0 },
      { start: caps.start + half, count: half, materialIndex: bottomFirst ? 0 : 1 },
      { start: rim.start, count: rim.count, materialIndex: 2 },
    ];
    g.translate(0, 0, -0.5); g.rotateX(-Math.PI / 2);
    return g;
  })();

  // ---------- textures: drawn on canvases in the page's colours ----------
  function canvasTex(key, w, h, paint) {
    let t = tex.get(key);
    if (!t) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w); canvas.height = Math.round(h);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      t = { texture, canvas, paint };
      tex.set(key, t);
      paint(canvas.getContext("2d"), canvas.width, canvas.height);
      texture.needsUpdate = true;
    }
    return t.texture;
  }
  const texW = () => Math.max(128, Math.min(256, pow2(cw * dpr * 1.25)));
  const suitColor = suit => (four && FOUR[suit]) || (suit === 0 || suit === 2 ? col.red : col.black);
  function paintFace(rank, suit) {
    return (c, w, h) => {
      const e = w / 2.5, b = Math.max(1, w / Math.max(cw, 1));
      c.clearRect(0, 0, w, h);
      c.fillStyle = col.face; c.fillRect(0, 0, w, h);
      c.strokeStyle = col.edge; c.lineWidth = b * 2; rrect(c, 0, 0, w, h, 0.2 * e); c.stroke();
      c.fillStyle = suitColor(suit); c.textBaseline = "top"; c.textAlign = "left";
      c.font = `800 ${0.95 * e}px ${fam}`;
      const x = 0.12 * e + b, y = 0.1 * e + b, rw = c.measureText(rank).width;
      c.fillText(rank, x, y);
      c.font = `800 ${0.85 * e}px ${fam}`;
      c.fillText(SUITS[suit], x + rw + 0.05 * e - (rank.length > 1 ? 0.07 * e : 0), y + 0.03 * e);
      c.font = `800 ${1.55 * e}px ${fam}`; c.textAlign = "right"; c.textBaseline = "alphabetic";
      c.fillText(SUITS[suit], w - 0.1 * e, h - 0.2 * e);
    };
  }
  function paintBack(c, w, h) {
    const e = w / 2.5;
    c.fillStyle = col.back; c.fillRect(0, 0, w, h);
    c.strokeStyle = col.backLine35; c.lineWidth = 0.05 * e;
    const step = 0.27 * e;
    c.save(); rrect(c, 0.16 * e, 0.16 * e, w - 0.32 * e, h - 0.32 * e, 0.1 * e); c.clip();
    for (let k = -h; k < w + h; k += step) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.moveTo(k, h); c.lineTo(k + h, 0); c.stroke(); }
    c.restore();
    c.strokeStyle = col.backLine; c.lineWidth = 0.05 * e; rrect(c, 0.14 * e, 0.14 * e, w - 0.28 * e, h - 0.28 * e, 0.1 * e); c.stroke();
  }
  function readColours() {
    fam = FAMILY();
    const face = css("--cd-face", "#FCF9F1"), edge = css("--cd-edge", "#C9B78E"), line = css("--cd-back-line", "#C8923A"), back = css("--cd-back", "#2F4A66");
    col = { face, edge, red: css("--cd-red", "#B3302A"), black: css("--cd-black", "#1E2730"), back, backLine: line, backLine35: mix(back, line, 0.35), rim: mix(face, edge, 0.45),
      gilt: css("--so-gilt", "#E2B865"), bad: css("--so-bad", "#A8382B"), chalk: css("--so-chalk", "rgba(244,238,220,.34)"), cream: "#F4EEDC" };
  }
  function faceMat(rank, suit) {
    const key = `f${rank}${suit}`;
    let m = mats.get(key);
    if (!m) { m = new THREE.MeshBasicMaterial({ toneMapped: false }); m.map = canvasTex(key, texW(), texW() * ASPECT, paintFace(rank, suit)); mats.set(key, m); }
    return m;
  }
  function plainMat(key, color, extra = {}) {
    let m = mats.get(key);
    if (!m) { m = new THREE.MeshBasicMaterial({ toneMapped: false, ...extra }); mats.set(key, m); }
    m.color.set(color);
    return m;
  }
  /** A see-through picture on a quad: a slot's outline, a ring, a shadow, the badge. */
  function pictureMat(key, w, h, paint) {
    let m = mats.get(key);
    if (!m) { m = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false, side: 2 }); m.map = canvasTex(key, w, h, paint); mats.set(key, m); }
    return m;
  }
  const dash = (c, on, off) => c.setLineDash([on, off]);

  // The picture sizes follow the card's, with room round it for a glow or a shadow.
  const PAD = 0.22;                                       // of a card's width, each side
  function shadowMat() {
    const fresh = !mats.has("shadow");
    const m = pictureMat("shadow", 128, 180, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.save();
      c.shadowColor = "rgba(0,0,0,1)"; c.shadowBlur = 22; c.shadowOffsetX = 1000;
      c.fillStyle = "#000";
      rrect(c, 28 - 1000, 28, w - 56, h - 56, 9); c.fill();
      c.restore();
    });
    if (fresh) m.opacity = 0.34;
    return m;
  }
  const frameBox = (c, w, h) => { const iw = w / (1 + 2 * PAD), ih = iw * ASPECT; return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih, e: iw / 2.5 }; };
  function ringMat(kind) {
    const base = texW(), w = base * (1 + 2 * PAD), h = base * ASPECT * (1 + 2 * PAD) - 0;
    return pictureMat(`ring:${kind}`, w, base * ASPECT + base * 2 * PAD, (c, W2, H2) => {
      c.clearRect(0, 0, W2, H2);
      const b = frameBox(c, W2, H2), colr = kind === "bad" ? col.bad : col.gilt, r = 0.2 * b.e;
      c.save();
      if (kind === "gilt" || kind === "bad") { c.shadowColor = colr; c.shadowBlur = 0.5 * b.e; }
      c.strokeStyle = colr; c.lineWidth = 0.14 * b.e;
      if (kind === "dash") dash(c, 0.35 * b.e, 0.22 * b.e);
      rrect(c, b.x - 0.04 * b.e, b.y - 0.04 * b.e, b.w + 0.08 * b.e, b.h + 0.08 * b.e, r); c.stroke();
      c.restore();
    });
  }
  function dropMat(over) {
    const base = texW();
    return pictureMat(`drop:${over ? 1 : 0}`, base * (1 + 2 * PAD), base * ASPECT + base * 2 * PAD, (c, W2, H2) => {
      c.clearRect(0, 0, W2, H2);
      const b = frameBox(c, W2, H2), r = 0.25 * b.e;
      c.globalAlpha = over ? 0.42 : 0.18; c.fillStyle = col.gilt; rrect(c, b.x, b.y, b.w, b.h, r); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = col.gilt; c.lineWidth = 0.12 * b.e; if (!over) dash(c, 0.4 * b.e, 0.25 * b.e);
      rrect(c, b.x, b.y, b.w, b.h, r); c.stroke();
    });
  }
  /** A slot's outline: dashed chalk (a stock that holds cards has none), a suit's ghost, the stock's recycle arrow. */
  function slotMat(s) {
    const key = `slot:${s.kind}:${s.suit ?? ""}:${s.empty ? 1 : 0}:${s.recycle ? 1 : 0}:${s.full ? 1 : 0}`;
    const base = texW();
    return pictureMat(key, base * (1 + 2 * PAD), base * ASPECT + base * 2 * PAD, (c, W2, H2) => {
      c.clearRect(0, 0, W2, H2);
      const b = frameBox(c, W2, H2);
      const outline = !(s.full || (s.kind === "stock" && !s.empty));
      if (outline) { c.strokeStyle = col.chalk; c.lineWidth = Math.max(1, b.e * 0.05); dash(c, 0.22 * b.e, 0.16 * b.e); rrect(c, b.x, b.y, b.w, b.h, 0.2 * b.e); c.stroke(); c.setLineDash([]); }
      c.fillStyle = col.chalk; c.textAlign = "center"; c.textBaseline = "middle";
      if (s.kind === "fnd" && s.suit != null && !s.full) { c.font = `${1.7 * b.e}px ${fam}`; c.fillText(SUITS[s.suit], b.x + b.w / 2, b.y + b.h / 2 + 0.08 * b.e); }
      if (s.recycle) { c.font = `${1.5 * b.e}px ${fam}`; c.fillText("↻", b.x + b.w / 2, b.y + b.h / 2); }
    });
  }
  function badgeMat(n) {
    const base = texW();
    return pictureMat(`badge:${n}`, base * 0.9, base * 0.42, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const e = base / 2.5;
      c.fillStyle = "rgba(12,28,20,.78)"; rrect(c, 0, 0, w, h, h / 2); c.fill();
      c.fillStyle = col.cream; c.font = `800 ${0.66 * e}px ${fam}`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(n), w / 2, h / 2 + 0.03 * e);
    });
  }
  function sheenMat() {
    return pictureMat("sheen", 256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      const night = document.documentElement.dataset.mode === "night" || (document.documentElement.dataset.mode !== "day" && matchMedia?.("(prefers-color-scheme: dark)").matches);
      g.addColorStop(0, `rgba(255,248,214,${night ? 0.07 : 0.13})`); g.addColorStop(1, "rgba(255,248,214,0)");
      c.clearRect(0, 0, w, h); c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
  }

  // ---------- the cards ----------
  let faces = [], texSize = 0;
  /** The cards to draw (uid, rank, suit); they are made when the first frame says how large a card is. */
  function build(list) { faces = list; made = false; }
  let made = false;
  function make() {
    purge();
    texSize = texW();
    readColours();
    const rim = plainMat("rim", col.rim), back = plainMat("back-mat", "#ffffff");
    back.map = canvasTex("back", texSize, texSize * ASPECT, paintBack);
    for (const { uid, rank, suit } of faces) {
      const mesh = new THREE.Mesh(slab, [faceMat(rank, suit), back, rim]);
      mesh.frustumCulled = false;
      const shadow = new THREE.Mesh(quad, shadowMat());
      shadow.renderOrder = -1; shadow.frustumCulled = false;
      mesh.visible = shadow.visible = false;
      scene.add(shadow, mesh);
      cards.set(uid, { mesh, shadow, rank, suit, tgt: null, cur: null, delay: 0, t0: 0, lift: 0 });
    }
    sheen = new THREE.Mesh(quad, sheenMat()); sheen.renderOrder = -3; sheen.frustumCulled = false; scene.add(sheen);
    sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: col.gilt, toneMapped: false }), 56);
    sparks.frustumCulled = false; sparks.renderOrder = 5; sparks.count = 0;
    scene.add(sparks);
    made = true;
  }
  /** Everything made from a picture or a card goes (a new variant, or cards that need a larger picture). */
  function purge() {
    for (const c of cards.values()) scene.remove(c.mesh, c.shadow);
    for (const m of [...slotMeshes, ...dropMeshes, ...hintMeshes, badge, sheen, sparks]) if (m) scene.remove(m);
    for (const r of rings.values()) scene.remove(r.mesh);
    cards.clear(); rings.clear(); slotMeshes.length = dropMeshes.length = hintMeshes.length = 0;
    badge = sheen = sparks = null; badgeKey = ""; spark = [];
    for (const t of tex.values()) t.texture.dispose();
    for (const m of mats.values()) m.dispose();
    tex.clear(); mats.clear();
  }
  /** The ring of a hint or a flash on one card. */
  function ringFor(key, kind) {
    let r = rings.get(key);
    if (!r) { r = { mesh: new THREE.Mesh(quad, ringMat(kind)), kind }; r.mesh.renderOrder = 3; r.mesh.frustumCulled = false; scene.add(r.mesh); rings.set(key, r); }
    else if (r.kind !== kind) { r.mesh.material = ringMat(kind); r.kind = kind; }
    return r;
  }
  function poolMesh(pool, i, mat, order) {
    let m = pool[i];
    if (!m) { m = new THREE.Mesh(quad, mat); m.renderOrder = order; m.frustumCulled = false; scene.add(m); pool[i] = m; }
    if (m.material !== mat) m.material = mat;
    return m;
  }

  // ---------- one frame of the board's layout ----------
  const elev = h => (h + 0.5) * thick;                  // the middle of a slab h cards up
  const SLOT_K = 1 + 2 * PAD;
  /**
   * Hands the view a layout: frame = { cw, ch, W, H, pos: Map uid → { x, y, h, up, stock }, slots: [{ x, y, kind, suit, count, pile, empty,
   * recycle, full, hintTo }], hintFrom, hintTo, lit, bad (sets of uids), drag: { uids, dx, dy, lift }, drops: [{ x, y, h }], over, instant,
   * deal (a new deal: the cards fly in from `dealFrom`), won, sparks: [{ x, y, h }] }. Positions are board pixels, a card's top left.
   */
  function set(f) {
    if (!f.cw || !f.W || !f.H) return;
    frame = f;
    const grew = made && texW() !== texSize;
    W = f.W; H = f.H; cw = f.cw; ch = f.ch; em = cw / 2.5; thick = Math.max(0.6, cw * 0.016);
    if (!made || grew) make();
    if (`${W}x${H}` !== sized) resize();
    const now = performance.now(), snap = f.instant || reduced;
    let flying = 0;
    if (f.deal && !reduced) for (const p of f.pos.values()) if (!p.stock) flying++;
    const order = f.deal && !reduced ? [...f.pos.entries()].filter(([, p]) => !p.stock).sort((a, b) => a[1].h - b[1].h || a[1].x - b[1].x).map(([uid]) => uid) : [];
    const rankOf = new Map(order.map((uid, i) => [uid, i]));
    for (const [uid, c] of cards) {
      const p = f.pos.get(uid);
      if (!p) { c.mesh.visible = c.shadow.visible = false; c.tgt = null; continue; }
      c.tgt = { x: p.x + cw / 2 - W / 2, z: p.y + ch / 2 - H / 2, e: p.h, up: p.up ? 1 : 0 };
      if (!c.cur || snap) { c.cur = { x: c.tgt.x, z: c.tgt.z, e: c.tgt.e, flip: c.tgt.up }; c.delay = 0; }
      if (rankOf.has(uid)) {                           // dealt: it starts on the pile it comes from, face down, and goes when its turn comes
        const from = f.dealFrom || { x: (W - cw) / 2, y: 0 };
        c.cur = { x: from.x + cw / 2 - W / 2, z: from.y + ch / 2 - H / 2, e: 24 + flying - rankOf.get(uid), flip: 0 };
        c.delay = Math.min(1000, rankOf.get(uid) * 9); c.t0 = now;
      }
      c.mesh.visible = c.shadow.visible = true;
    }
    if (f.won && !won) { won = true; wonAt = now; } else if (!f.won) won = false;
    for (const s of f.sparks || []) burst(s.x + cw / 2 - W / 2, s.y + ch / 2 - H / 2, elev(s.h) + thick);
    wake();
  }

  // ---------- the camera ----------
  let sized = "";
  function resize() {
    if (!W || !H) return;
    sized = `${W}x${H}`;
    const w = Math.round(W * renderer.getPixelRatio()), cur = renderer.getSize(new THREE.Vector2());
    if (cur.x !== W || cur.y !== H || canvas.width !== w) renderer.setSize(W, H, false);
    camBusy = true; aim(true);
  }
  function aim(snap = false) {
    const a = reduced || snap ? 1 : 0.22;
    tilt += (tTilt - tilt) * a; yaw += (tYaw - yaw) * a;
    if (Math.abs(tTilt - tilt) < 0.03) tilt = tTilt;
    if (Math.abs(tYaw - yaw) < 0.03) yaw = tYaw;
    camBusy = tilt !== tTilt || yaw !== tYaw;
    const aspect = W / H;
    dist = fitDistance(W, H, tilt, yaw, aspect);
    pose = poseOf(tilt, yaw, dist);
    const near = dist * 0.1, top = near * Math.tan(FOV / 2), right = top * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, dist * 4);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.position.set(...pose.pos);
    camera.up.set(...pose.up);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    if (sheen) { sheen.position.set(0, 0.05, 0); sheen.scale.set(W * 1.5, 1, H * 1.3); }
  }
  const clampTilt = t => Math.max(0, Math.min(TILT_MAX, t));
  const clampYaw = y => Math.max(-YAW_MAX, Math.min(YAW_MAX, y));
  /** Aims the camera (`soft`: it glides there). */
  function setCamera(t, y, soft = true) {
    tTilt = clampTilt(t); tYaw = clampYaw(y);
    camBusy = true;
    if (W) aim(!soft || reduced);
    wake();
  }

  // ---------- from a pointer to the table, and back ----------
  function ndc(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return [((cx - r.left) / (r.width || 1)) * 2 - 1, 1 - ((cy - r.top) / (r.height || 1)) * 2];
  }
  /** The point of the table (or of a plane `h` above it) under a pointer, in board pixels. */
  function toTable(cx, cy, h = 0) {
    if (!pose) return { x: cx, y: cy };
    const [nx, ny] = ndc(cx, cy), g = groundAt(pose, nx, ny, W / H, h);
    return g ? { x: g.x + W / 2, y: g.z + H / 2 } : { x: W / 2, y: 0 };
  }
  /** The card whose face is under a pointer, the highest first (a card's face is as high as its pile, so the tilted view picks the card it shows), or -1. */
  function pick(cx, cy) {
    if (!pose || !frame) return -1;
    const [nx, ny] = ndc(cx, cy);
    let best = -1, bestH = -1;
    for (const [uid, c] of cards) {
      const t = c.tgt; if (!t) continue;
      const g = groundAt(pose, nx, ny, (t.e + 1) * thick);
      if (g && Math.abs(g.x - t.x) <= cw / 2 && Math.abs(g.z - t.z) <= ch / 2 && (t.e > bestH || (t.e === bestH && uid > best))) { best = uid; bestH = t.e; }
    }
    return best;
  }
  const topOf = uid => { const c = cards.get(uid); return c?.tgt ? (c.tgt.e + 1) * thick : 0; };
  const liftHeight = () => ch * 0.3;

  // ---------- a gesture on the camera ----------
  /** A drag of dx, dy pixels: up tilts the table away, across turns it a little. */
  function orbitBy(dx, dy) {
    setCamera(tTilt - dy * 0.3, tYaw - dx * 0.08, false);
  }
  /** The gesture is over: the page keeps the pick. */
  function commit() { opts.onCamera?.(tTilt, tYaw); }
  /** The camera's button: straight above, or at the angle. → which. */
  function preset() {
    const top = tTilt >= ANGLED / 2;
    setCamera(top ? 0 : ANGLED, 0);
    commit();
    return top ? "top" : "angled";
  }

  // ---------- sparkle: a few gilt chips thrown up where a suit is complete ----------
  const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3(), sa = new THREE.Vector3();
  function burst(x, z, y) {
    if (reduced) return;
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random() * 0.9) * cw * 1.5;
      spark.push({ x, y, z, vx: Math.cos(a) * s, vy: (0.6 + Math.random() * 1.1) * cw * 1.8, vz: Math.sin(a) * s, life: 0, max: 0.7 + Math.random() * 0.5, size: cw * (0.05 + Math.random() * 0.06), spin: Math.random() * 6 });
    }
    if (spark.length > 56) spark.splice(0, spark.length - 56);
  }
  function stepSparks(dt) {
    if (!sparks) return;
    for (let i = spark.length - 1; i >= 0; i--) {
      const p = spark[i];
      p.life += dt;
      if (p.life >= p.max) { spark.splice(i, 1); continue; }
      p.vy -= cw * 7 * dt; p.x += p.vx * dt; p.y = Math.max(0.5, p.y + p.vy * dt); p.z += p.vz * dt; p.vx *= 0.985; p.vz *= 0.985;
    }
    let n = 0;
    for (const p of spark) {
      const s = p.size * (0.4 + 1.2 * (1 - p.life / p.max));
      sq.setFromAxisAngle(sa.set(0.3, 1, 0.2).normalize(), p.spin + p.life * 9);
      sm.compose(sp.set(p.x, p.y, p.z), sq, ss.set(s, s * 0.35, s));
      sparks.setMatrixAt(n++, sm);
    }
    sparks.count = n;
    sparks.instanceMatrix.needsUpdate = true;
  }

  // ---------- drawing ----------
  /** Moves everything a step toward where it is going; → whether anything is still on its way. */
  function step(dt, now) {
    const f = frame;
    let busy = false;
    const k = reduced ? 1 : 1 - Math.exp(-15 * dt), kDrag = reduced ? 1 : 1 - Math.exp(-42 * dt), kFlip = reduced ? 1 : 1 - Math.exp(-11 * dt), kLift = reduced ? 1 : 1 - Math.exp(-22 * dt);
    const dragIndex = f.drag ? new Map(f.drag.uids.map((u, i) => [u, i])) : null;
    // the surface under the carried cards, for their shadow: the highest card they are over
    let under = 0;
    if (dragIndex) {
      const lead = cards.get(f.drag.uids[0])?.cur;
      if (lead) for (const [uid, c] of cards) {
        const t = c.tgt;
        if (t && !dragIndex.has(uid) && Math.abs(t.x - lead.x) < cw && Math.abs(t.z - lead.z) < ch) under = Math.max(under, (t.e + 1) * thick);
      }
    }
    for (const [uid, c] of cards) {
      const t = c.tgt, cur = c.cur;
      if (!t || !cur) continue;
      const waiting = c.delay && now - c.t0 < c.delay;
      const di = dragIndex?.get(uid), dragged = di != null;
      const tx = dragged ? t.x + f.drag.dx : t.x, tz = dragged ? t.z + f.drag.dy - f.drag.lift : t.z;
      if (waiting) busy = true;
      else {
        const kk = dragged ? kDrag : k, dx = tx - cur.x, dz = tz - cur.z;
        c.far = Math.hypot(dx, dz);
        cur.x += dx * kk; cur.z += dz * kk; cur.e += (t.e - cur.e) * kk; cur.flip += (t.up - cur.flip) * kFlip;
        if (Math.hypot(tx - cur.x, tz - cur.z) < 0.06 && Math.abs(t.e - cur.e) < 0.01) { cur.x = tx; cur.z = tz; cur.e = t.e; c.far = 0; } else busy = true;
        if (Math.abs(t.up - cur.flip) < 0.004) cur.flip = t.up; else busy = true;
      }
      const want = dragged ? liftHeight() + di * thick * 0.4 : 0;
      c.lift += (want - c.lift) * kLift;
      if (Math.abs(want - c.lift) < 0.05) c.lift = want; else busy = true;
      // the arc: higher the farther a card has still to go, and while it turns over
      let rise = reduced ? 0 : Math.min((c.far || 0) * 0.22, ch * 0.5) + Math.sin(Math.PI * cur.flip) * ch * 0.5 + c.lift;
      let hop = 0;
      if (won && !reduced) {
        const since = now - wonAt - (uid % 52) * 18;
        if (since < 900) busy = true;
        if (since > 0 && since < 900) hop = Math.sin((since / 900) * Math.PI) * em * 0.5;
      }
      const jx = f.bad?.has(uid) && !reduced ? (busy = true, Math.sin(now * 0.06) * em * 0.12) : 0;
      const y = elev(cur.e) + rise + hop;
      c.mesh.position.set(cur.x + jx, y, cur.z);
      c.mesh.scale.set(cw, thick, cw);
      c.mesh.rotation.set(Math.PI * (1 - cur.flip), 0, 0);
      // its shadow lies on the table, or on the cards under a carried one; it is longer and fainter the higher the card is
      const surface = dragged ? under : 0, h = Math.max(0, y - thick / 2 - surface), grow = 1.6 + h * 0.2;
      c.shadow.position.set(cur.x + jx + 0.5 + h * 0.28, surface + 0.2, cur.z + 0.9 + h * 0.5);
      c.shadow.scale.set(cw + grow * 2 + 6, 1, ch + grow * 2 + 6);
      c.cx = cur.x + jx; c.cy = y; c.cz = cur.z;
    }
    // slots, the stock's count, rings, the places a carried card may go
    f.slots.forEach((s, i) => {
      const m = poolMesh(slotMeshes, i, slotMat(s), -2);
      m.position.set(s.x + cw / 2 - W / 2, 0.1, s.y + ch / 2 - H / 2);
      m.scale.set(cw * SLOT_K, 1, cw * ASPECT + cw * 2 * PAD);
      m.visible = true;
    });
    for (let i = f.slots.length; i < slotMeshes.length; i++) slotMeshes[i].visible = false;
    const st = f.slots.find(s => s.kind === "stock");
    if (st?.count) {
      const key = String(st.count);
      if (!badge) { badge = new THREE.Mesh(quad, badgeMat(key)); badge.renderOrder = 4; badge.frustumCulled = false; scene.add(badge); badgeKey = key; }
      if (badgeKey !== key) { badge.material = badgeMat(key); badgeKey = key; }
      badge.visible = true;
      badge.scale.set(cw * 0.5, 1, cw * 0.4);
      badge.position.set(st.x + cw - em * 0.12 - cw * 0.25 - W / 2, elev(Math.max(0, st.pile - 1)) + thick * 0.6, st.y + ch - em * 0.12 - cw * 0.2 - H / 2);
    } else if (badge) badge.visible = false;
    const want = new Map();
    f.hintFrom?.forEach(u => want.set(u, "gilt"));
    f.lit?.forEach(u => want.set(u, "gilt"));
    f.hintTo?.forEach(u => { if (!want.has(u)) want.set(u, "dash"); });
    f.bad?.forEach(u => want.set(u, "bad"));
    for (const r of rings.values()) r.mesh.visible = false;
    for (const [uid, kind] of want) {
      const c = cards.get(uid);
      if (!c?.tgt) continue;
      const r = ringFor(uid, kind);
      r.mesh.visible = true;
      r.mesh.position.set(c.cx, c.cy + thick / 2 + 0.4, c.cz);
      r.mesh.scale.set(cw * SLOT_K, 1, cw * ASPECT + cw * 2 * PAD);
    }
    const pulsing = !!f.hintFrom?.size && !reduced;
    ringMat("gilt").opacity = pulsing ? 0.55 + 0.45 * Math.sin(now * 0.005) : 1;
    if (pulsing) busy = true;
    let n = 0;
    for (const d of f.drops || []) {
      const m = poolMesh(dropMeshes, n, dropMat(n === f.over), 2);
      n++;
      m.visible = true;
      m.position.set(d.x + cw / 2 - W / 2, elev(d.h) + thick * 0.5 + 0.3, d.y + ch / 2 - H / 2);
      m.scale.set(cw * SLOT_K, 1, cw * ASPECT + cw * 2 * PAD);
    }
    for (let i = n; i < dropMeshes.length; i++) dropMeshes[i].visible = false;
    let hi = 0;
    for (const s of f.slots) {
      if (!s.hintTo) continue;
      const m = poolMesh(hintMeshes, hi++, ringMat("dash"), 3);
      m.visible = true;
      m.position.set(s.x + cw / 2 - W / 2, elev(Math.max(0, s.pile ?? 0)) - thick * 0.4, s.y + ch / 2 - H / 2);
      m.scale.set(cw * SLOT_K, 1, cw * ASPECT + cw * 2 * PAD);
    }
    for (let i = hi; i < hintMeshes.length; i++) hintMeshes[i].visible = false;
    if (spark.length) { stepSparks(dt); busy = true; } else if (sparks?.count) { sparks.count = 0; sparks.instanceMatrix.needsUpdate = true; }
    return busy;
  }
  function draw(now) {
    if (lost || !W || !frame) return false;
    const dt = Math.min(0.05, Math.max(0.001, (now - (lastNow || now - 16)) / 1000));
    lastNow = now;
    if (camBusy) aim();
    const busy = step(dt, now);
    renderer.render(scene, camera);
    return busy || camBusy;
  }
  function loop(now) {
    rafId = 0;
    if (!shown || held || document.hidden || lost) { lastNow = 0; return; }
    if (now - lastDraw >= FRAME_MS - 3) {
      lastDraw = now;
      if (draw(now)) rafId = requestAnimationFrame(loop); else lastNow = 0;
    } else rafId = requestAnimationFrame(loop);
  }
  function wake() {
    if (!shown || held || lost || !frame || rafId) return;
    rafId = requestAnimationFrame(loop);
  }
  /** Stands still (the menu is open) or goes on. */
  function hold(on) { held = on; if (!on) { lastNow = 0; wake(); } }
  document.addEventListener("visibilitychange", onVisible);
  function onVisible() { if (!document.hidden) { lastNow = 0; wake(); } }

  function setFourColour(on) { four = !!on; restyle(); }
  /** The page's colours changed (theme, day or night, four colours): the pictures are painted again. */
  function restyle() {
    if (!made) return;
    readColours();
    for (const t of tex.values()) { t.paint(t.canvas.getContext("2d"), t.canvas.width, t.canvas.height); t.texture.needsUpdate = true; }
    mats.get("rim")?.color.set(col.rim);
    sparks?.material.color.set(col.gilt);
    wake();
  }
  const mo = new MutationObserver(() => restyle());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  const dark = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  dark?.addEventListener?.("change", restyle);
  document.fonts?.ready?.then(() => { if (!lost) restyle(); }).catch(() => {});

  function dispose() {
    cancelAnimationFrame(rafId); rafId = 0; shown = false;
    mo.disconnect(); dark?.removeEventListener?.("change", restyle);
    document.removeEventListener("visibilitychange", onVisible);
    purge();
    slab.dispose(); quad.dispose();
    renderer.dispose();
    canvas.remove();
  }

  readColours();
  return {
    canvas, build, set, wake, pick, toTable, topOf, liftHeight, orbitBy, commit, preset, setCamera, hold, restyle, setFourColour, resize, dispose,
    camera: () => ({ tilt: tTilt, yaw: tYaw }),
    /** For tests: the camera's state, and where a card's face is on the page. */
    get state() { return { tilt, yaw, dist, W, H, cards: cards.size, moving: camBusy || !!rafId }; },
    screenOf(uid) {
      const c = cards.get(uid);
      if (!c?.tgt || !pose) return null;
      const p = project(pose, [c.tgt.x, (c.tgt.e + 1) * thick, c.tgt.z], W / H), r = canvas.getBoundingClientRect();
      return { x: r.left + ((p[0] + 1) / 2) * r.width, y: r.top + ((1 - p[1]) / 2) * r.height };
    },
  };
}
