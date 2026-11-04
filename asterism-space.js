// Asterism in space: the board as a pane of dark glass floating in deep space, each region a nebula of its own colour held
// in a pale rule, a star an ignition (a bloom and a four-point flare) hovering over the glass, a dot a speck of dust.
// One 2D canvas drawn by hand in perspective (the way Mines' Moon is, mines-3d.js): no WebGL, so nothing can lose a context
// on an iPhone, and the same pixels on every device. The glass is a flat plane: each cell's nebula is a piece of one picture
// made once a puzzle (`nebula`), laid on the cell's projected corners (an affine fit to three of them: a cell is small, so
// the perspective inside it is below a pixel), the rest is paths and a few pre-drawn glow sprites.
//
// The page turns the pane like a turntable, tilted back (drag, twist), a flick spins on a moment and stops, and the pane
// stays where it was left (4 November 2026, Korbi: the ease-back to rest was annoying); `resetView` is the way home. A tap
// picks through the same projection run backwards (`pickCell`), with the slack of a third of a cell round the pane. The
// page asks it what it asks the flat view: what to show (set), which cell is under a finger (cellAt), where a cell is
// (where), and where a finger is on the board (boardPoint, for the dotting stroke).
//
// Battery: nothing is drawn unless something moves. A finger on it draws every frame, a flick, a flare, a sweep or the
// end of a puzzle thirty a second, and the glow of a conflict and the slow float fifteen, for twenty seconds after
// anything last happened; then the last frame stands. Hidden pages and the menu or rules (onPause) draw nothing.
import { STAR, DOT } from "./asterism-engine.js";

// ---------- the projection (pure maths: Node tests it) ----------
/** Where the pane rests: turned a little, tilted back 24°. Yaw is about the vertical, pitch tips the top away. */
export const REST = { yaw: -0.14, pitch: 0.42 };
/** How far a finger may turn it. */
export const LIMITS = { yaw: 0.95, lo: 0.0, hi: 1.12 };
/** A solid turns all the way round, and over its poles (almost); it rests with three faces showing. */
export const SOLID = { rest: { yaw: 0.7, pitch: 0.55 }, lo: -1.45, hi: 1.45 };
const DIST = 2.9;                      // the eye's distance from the pane's middle, in pane widths: a gentle perspective
const LIFT = 0.3;                      // how far a star hovers over the glass, in cells
const THICK = 0.2;                     // the glass's thickness, in cells

/** The 3×3 turn (row by row) from the pane's own frame (x right, y down, z toward you) to the eye's: tilt, then turn. */
export function poseMatrix(yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  // Ry(yaw) · Rx(pitch), with Rx: y' = y·cp − z·sp, z' = y·sp + z·cp
  return [cy, sy * sp, sy * cp, 0, cp, -sp, -sy, cy * sp, cy * cp];
}
/** A point of the pane (cells from its middle; z toward you) to the screen: [x, y, px per cell there]. */
export function project(R, N, f, cx, cy, x, y, z) {
  const rx = R[0] * x + R[1] * y + R[2] * z, ry = R[3] * x + R[4] * y + R[5] * z, rz = R[6] * x + R[7] * y + R[8] * z;
  const s = f / (DIST * N - rz);
  return [cx + s * rx, cy + s * ry, s];
}
/** The size (px per cell at the middle) at which the pane, at rest, just fits a W×H box with `margin` px to spare. */
export function fitScale(N, W, H, margin) {
  const R = poseMatrix(REST.yaw, REST.pitch);
  let mx = 1e-9, my = 1e-9;
  for (const x of [-N / 2, N / 2]) for (const y of [-N / 2, N / 2]) for (const z of [-THICK, LIFT]) {
    const [sx, sy] = project(R, N, 1, 0, 0, x, y, z);
    mx = Math.max(mx, Math.abs(sx)); my = Math.max(my, Math.abs(sy));
  }
  return Math.max(1, Math.min((W / 2 - margin) / mx, (H / 2 - margin) / my));
}
/** The plane z = z0 under a screen point, as [x, y] in cells from the middle, or null if the eye looks away from it. */
export function unproject(R, N, f, cx, cy, sx, sy, z0 = 0) {
  const a = (sx - cx) / f, b = (sy - cy) / f, d = DIST * N;
  const den = R[2] * a + R[5] * b - R[8];
  if (Math.abs(den) < 1e-6) return null;
  const w = (z0 - R[8] * d) / den;
  if (!(w > 0)) return null;
  return [R[0] * a * w + R[3] * b * w + R[6] * (d - w), R[1] * a * w + R[4] * b * w + R[7] * (d - w)];
}
/** The cell under a screen point (row · N + column), or −1. The glass is picked half way up a star's hover, so a tap on
 *  a star and a tap on its cell agree; a third of a cell round the pane counts as its edge cell. */
export function pickCell(R, N, f, cx, cy, sx, sy, slack = 0.34) {
  const p = unproject(R, N, f, cx, cy, sx, sy, LIFT / 2);
  if (!p) return -1;
  const u = p[0] + N / 2, v = p[1] + N / 2;
  if (u < -slack || v < -slack || u > N + slack || v > N + slack) return -1;
  const c = Math.min(N - 1, Math.max(0, Math.floor(u))), r = Math.min(N - 1, Math.max(0, Math.floor(v)));
  return r * N + c;
}

// ---------- the look ----------
// [hue, saturation %, lightness %, pattern] of each region's nebula: muted and dim, told apart by value, by a faint pattern
// laid in it and by the rule that holds it (never by hue alone: ten regions, and eyes differ).
const HUES = [[236, 34, 26, 0], [208, 16, 27, 1], [176, 30, 24, 2], [270, 22, 30, 3], [34, 38, 27, 4], [222, 26, 19, 5], [300, 16, 26, 6], [76, 18, 25, 7], [190, 24, 29, 8], [44, 34, 30, 9]];
const hsla = ([h, s, l], a, dl = 0) => `hsla(${h}, ${s}%, ${Math.min(96, l + dl)}%, ${a})`;
const TEX = 44;                        // px a cell has in the nebula picture
const SKY = ["#03050B", "#070B17", "#04060D"];
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const easeOutBack = t => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const easeIO = t => t * t * (3 - 2 * t);
const bump = (a, len) => (a <= 0 || a >= len ? 0 : Math.sin(Math.PI * a / len) ** 2);   // 0 to 1 to 0 over len ms

const ASLEEP = 20000;                  // ms after anything happens that the float and the glow of a conflict keep drawing
const SLOW_MS = 20, SLOW_FRAMES = 36;  // a frame this slow on average, this many times over, hands the page back to the flat grid
const SWEEP_MS = 520, SWEEP_STEP = 85; // a light running down a completed row, column or region: how long it burns in a cell, how fast it travels

export const SPACE_AVAILABLE = () => {
  try { return !!document.createElement("canvas").getContext("2d"); } catch { return false; }
};

/** The space view in `host`. hooks: { slow() } is told if the device draws it too slowly. */
export function createSpace(host, hooks = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "ast-space";
  canvas.setAttribute("role", "img");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motion.matches;

  let P = null, S = null, N = 0, marks = "", cellsN = 0;
  let W = 1, H = 1, dpr = 1, cx = 0, cy = 0, f = 1;
  let rest = REST, yaw = REST.yaw, pitch = REST.pitch, vyaw = 0, vpitch = 0, grabbed = false, touchedAt = -1e9, hot = -1, homing = null;
  const moves = [];                                      // the last moves of a drag [t, dyaw, dpitch], for a flick
  let R = poseMatrix(yaw, pitch);                        // the pose last drawn (a tap is picked with it)
  let VX = new Float32Array(0), VY = new Float32Array(0);
  let tex = null, edges = [], groupsDone = null, regionOf = null;
  let born = null, gone = null, dust = null;             // per cell: when its star ignited / went out / its dot appeared
  let sweeps = [], winAt = null, bad = new Set(), lit = new Set(), why = new Set(), lastPlaced = -1;
  let raf = 0, last = 0, awakeUntil = 0, halted = false, dead = false, slowCount = 0;
  const stats = { ms: 0, frames: 0, avg: 0 };

  // ---------- sprites: glows drawn once ----------
  const sprite = (size, paint) => { const c = document.createElement("canvas"); c.width = c.height = size; paint(c.getContext("2d"), size); return c; };
  const radial = (size, stops) => sprite(size, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const BLOOM = radial(128, [[0, "rgba(255,246,226,1)"], [0.16, "rgba(236,208,146,.42)"], [0.5, "rgba(190,150,86,.11)"], [1, "rgba(170,130,70,0)"]]);
  const EMBER = radial(128, [[0, "rgba(226,170,150,.95)"], [0.18, "rgba(150,50,42,.5)"], [0.5, "rgba(104,30,28,.16)"], [1, "rgba(90,24,24,0)"]]);
  const SOFT = radial(48, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,.3)"], [1, "rgba(255,255,255,0)"]]);
  const UNDER = radial(256, [[0, "rgba(86,100,150,.34)"], [0.45, "rgba(52,56,110,.12)"], [1, "rgba(30,30,80,0)"]]);
  const FLARE = sprite(128, (g, s) => {                  // a four-point flare: two thin streaks, a fainter pair on the diagonals
    const streak = (len, w, a) => {
      const gr = g.createLinearGradient(s / 2 - len, 0, s / 2 + len, 0);
      gr.addColorStop(0, "rgba(240,224,180,0)"); gr.addColorStop(0.5, `rgba(250,240,214,${a * 0.7})`); gr.addColorStop(1, "rgba(240,224,180,0)");
      g.fillStyle = gr; g.fillRect(s / 2 - len, s / 2 - w / 2, 2 * len, w);
    };
    streak(s / 2, 2.4, 1);
    g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 2); g.translate(-s / 2, -s / 2); streak(s / 2, 2.4, 1); g.restore();
    g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.translate(-s / 2, -s / 2); streak(s * 0.3, 1.6, 0.5); g.translate(s / 2, s / 2); g.rotate(Math.PI / 2); g.translate(-s / 2, -s / 2); streak(s * 0.3, 1.6, 0.5); g.restore();
  });

  // ---------- the sky: stars far and near, nebulae behind ----------
  let sky = null, mid = [], near = [];
  function buildSky() {
    sky = document.createElement("canvas");
    sky.width = Math.round(W * dpr); sky.height = Math.round(H * dpr);
    const g = sky.getContext("2d");
    g.scale(dpr, dpr);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, SKY[1]); bg.addColorStop(0.55, SKY[2]); bg.addColorStop(1, SKY[0]);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const r = rng(0x5A17E3);
    g.globalCompositeOperation = "lighter";
    for (const [h, x, y, rad, a] of [[240, 0.2, 0.18, 0.7, 0.07], [200, 0.85, 0.34, 0.6, 0.05], [270, 0.3, 0.82, 0.62, 0.05], [226, 0.75, 0.9, 0.55, 0.06], [180, 0.1, 0.5, 0.45, 0.04]]) {
      const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, rad * Math.max(W, H));
      gr.addColorStop(0, `hsla(${h}, 34%, 40%, ${a})`); gr.addColorStop(1, `hsla(${h}, 34%, 30%, 0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    for (let i = 0, n = Math.round(W * H / 1500); i < n; i++) {          // the far stars, fixed
      g.fillStyle = `rgba(${r() < 0.2 ? "240,222,190" : r() > 0.75 ? "196,206,228" : "226,230,238"}, ${(0.14 + r() * 0.4).toFixed(2)})`;
      const s = 0.5 + r() * 0.7;
      g.fillRect(r() * W, r() * H, s, s);
    }
    mid = Array.from({ length: Math.round(W * H / 5200) }, () => ((() => { const x = r() * W, y = r() * H, s = 0.8 + r() * 0.9, a = (0.25 + r() * 0.4).toFixed(2), k = r(); return { x, y, s, col: `rgba(${k < 0.25 ? "240,220,186" : k > 0.75 ? "190,202,228" : "230,234,242"},${a})` }; })()));
    near = Array.from({ length: Math.max(8, Math.round(W * H / 15000)) }, () => ({ x: r() * W, y: r() * H, s: 5 + r() * 9, a: 0.25 + r() * 0.35, p: r() * 6.28 }));
  }

  // ---------- the nebulae: one picture of the whole pane, made once a puzzle ----------
  function buildNebula() {
    const n = N * TEX;
    tex = document.createElement("canvas"); tex.width = tex.height = n;
    const g = tex.getContext("2d"), r = rng(hashOf(P.reg.join("")));
    edges = [];
    for (let k = 0; k < N; k++) {
      const col = HUES[k % HUES.length], cells = [];
      for (let x = 0; x < N * N; x++) if (P.reg[x] === k) cells.push(x);
      g.save();
      g.beginPath();
      for (const x of cells) g.rect((x % N) * TEX, Math.floor(x / N) * TEX, TEX, TEX);
      g.clip();
      for (const x of cells) {                                     // a dim plate, a little brighter at the middle
        const px = (x % N) * TEX + TEX / 2, py = Math.floor(x / N) * TEX + TEX / 2;
        const gr = g.createRadialGradient(px, py, 0, px, py, TEX * 0.78);
        gr.addColorStop(0, hsla(col, 0.92)); gr.addColorStop(1, hsla(col, 0.78, -6));
        g.fillStyle = gr; g.fillRect(px - TEX / 2, py - TEX / 2, TEX, TEX);
      }
      g.globalCompositeOperation = "lighter";
      for (let i = 0, m = Math.min(10, 2 + Math.round(cells.length * 0.5)); i < m; i++) {   // soft clouds across the cells
        const x = cells[Math.floor(r() * cells.length)], px = (x % N) * TEX + r() * TEX, py = Math.floor(x / N) * TEX + r() * TEX, rad = TEX * (1.1 + r() * 1.5);
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, hsla(col, 0.07 + r() * 0.06, 6 + r() * 8)); gr.addColorStop(1, hsla(col, 0));
        g.fillStyle = gr; g.fillRect(px - rad, py - rad, 2 * rad, 2 * rad);
      }
      g.globalCompositeOperation = "source-over";
      for (let i = 0, m = cells.length * 2; i < m; i++) {         // a few faint grains
        const x = cells[Math.floor(r() * cells.length)];
        g.fillStyle = hsla(col, 0.16 + r() * 0.2, 26);
        g.fillRect((x % N) * TEX + r() * TEX, Math.floor(x / N) * TEX + r() * TEX, 1.2, 1.2);
      }
      pattern(g, col[3], hsla(col, 0.34, 20), n);                 // the region's own faint pattern, so colour is never the only sign
      g.restore();
    }
    for (let rr = 0; rr < N; rr++) for (let c = 0; c < N; c++) {   // the rules between regions, as vertex pairs of the (N+1)² lattice
      const x = rr * N + c;
      if (c < N - 1 && P.reg[x] !== P.reg[x + 1]) edges.push(rr * (N + 1) + c + 1, (rr + 1) * (N + 1) + c + 1);
      if (rr < N - 1 && P.reg[x] !== P.reg[x + N]) edges.push((rr + 1) * (N + 1) + c, (rr + 1) * (N + 1) + c + 1);
    }
  }
  /** A region's pattern over the whole picture (the clip keeps it in the region): ten that differ in direction and kind. */
  function pattern(g, k, ink, n) {
    const st = TEX / 4;                                           // spacing: four lines or dots to a cell
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1.1;
    g.beginPath();
    if (k === 1 || k === 5) for (let o = -n; o < n * 2; o += st) { g.moveTo(o, 0); g.lineTo(o + n, n); }                    // "\" hatch
    if (k === 4 || k === 5) for (let o = -n; o < n * 2; o += st) { g.moveTo(o, n); g.lineTo(o + n, 0); }                                // "/" hatch
    if (k === 3) for (let y = st / 2; y < n; y += st) { g.moveTo(0, y); g.lineTo(n, y); }                                             // horizontal rules
    if (k === 6) for (let x = st / 2; x < n; x += st) { g.moveTo(x, 0); g.lineTo(x, n); }                                              // vertical rules
    if (k === 8) for (let y = st; y < n; y += st * 2) for (let x = 0; x < n; x += st * 2) { g.moveTo(x, y); g.lineTo(x + st, y - st / 2); g.lineTo(x + st * 2, y); }   // waves
    g.stroke();
    if (k === 2) for (let y = st / 2; y < n; y += st) for (let x = st / 2; x < n; x += st) g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);       // dots
    if (k === 7) { g.beginPath(); for (let y = st; y < n; y += st * 2) for (let x = st; x < n; x += st * 2) { g.moveTo(x + 2.4, y); g.arc(x, y, 2.4, 0, 6.2832); } g.stroke(); }   // rings
    if (k === 9) { g.beginPath(); for (let y = st; y < n; y += st * 2) for (let x = st; x < n; x += st * 2) { g.moveTo(x - 2.5, y); g.lineTo(x + 2.5, y); g.moveTo(x, y - 2.5); g.lineTo(x, y + 2.5); } g.stroke(); }   // crosses
  }
  const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  // ---------- size ----------
  function resize() {
    const b = host.getBoundingClientRect();
    const w = Math.max(40, Math.round(b.width)), h = Math.max(40, Math.round(b.height));
    const d = Math.min(2, window.devicePixelRatio || 1);            // never past 2: a phone's 3 only costs
    if (w === W && h === H && d === dpr && sky) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    cx = W / 2; cy = H / 2 + 2;
    fit();
    buildSky();
    wake();
  }
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  ro?.observe(host);
  addEventListener("resize", resize);

  // ---------- what the page tells it ----------
  /** The state to show. `opts`: { bad (cells that break a rule), lit (a hint's cells), why (its evidence) }. */
  function set(Pn, Sn, opts = {}) {
    const fresh = Pn !== P;
    P = Pn; S = Sn;
    if (!P || !S) return;
    const now = performance.now();
    if (fresh) {
      N = P.N || 0; marks = S.marks; cellsN = P.n;
      mesh = null;
      if (P.topo) { buildMesh(); rest = mesh.closed ? SOLID.rest : REST; } else { rest = REST; VX = new Float32Array((N + 1) * (N + 1)); VY = new Float32Array((N + 1) * (N + 1)); }
      born = new Float64Array(cellsN).fill(-1e9); gone = new Float64Array(cellsN).fill(-1e9); dust = new Float64Array(cellsN).fill(-1e9);
      sweeps = []; winAt = S.done ? -1e9 : null; lastPlaced = -1;
      yaw = rest.yaw; pitch = rest.pitch; vyaw = vpitch = 0; homing = null;
      fit();
      if (!mesh) buildNebula();
      groupsDone = completeGroups(S.marks, opts.bad);
      canvas.setAttribute("aria-label", `The board, in space: ${mesh ? (mesh.closed ? "a cube" : "a hexagon") : `${N} by ${N}`}. Tap a cell to dot it, again to make it a star, again to clear it. Drag along a row or column to dot cells; turn the board with two fingers, or with the Turn button.`);
    } else if (S.marks !== marks) {
      for (let x = 0; x < cellsN; x++) {
        const was = marks[x], is = S.marks[x];
        if (was === is) continue;
        if (is === STAR) { born[x] = now; lastPlaced = x; } else if (was === STAR) gone[x] = now;
        if (is === DOT) dust[x] = now;
      }
      marks = S.marks;
      const done = completeGroups(marks, opts.bad);
      if (!S.done && !still()) for (const gi of done) if (!groupsDone.has(gi)) startSweep(gi, now);
      groupsDone = done;
    }
    if (S.done && winAt === null) winAt = now;
    if (!S.done) winAt = null;
    bad = opts.bad || new Set(); lit = new Set(opts.lit || []); why = new Set(opts.why || []);
    wake();
  }
  /** Groups holding all their stars with none of them breaking a rule. */
  function completeGroups(m, badSet) {
    const out = new Set();
    P.groups.forEach((g, gi) => {
      let n = 0, ok = true;
      for (const x of g.cells) if (m[x] === STAR) { n++; if (badSet?.has(x)) ok = false; }
      if (n === P.k && ok) out.add(gi);
    });
    return out;
  }
  function startSweep(gi, now) {
    const cells = P.groups[gi].cells;
    const from = cells.includes(lastPlaced) ? lastPlaced : cells[0], fr = Math.floor(from / N), fc = from % N;
    if (mesh) { const a = mesh.cells[from].c; sweeps.push({ t0: now, items: cells.map(x => [x, Math.hypot(...mesh.cells[x].c.map((v, i) => v - a[i])) / mesh.size * SWEEP_STEP]) }); return; }
    sweeps.push({ t0: now, items: cells.map(x => [x, Math.hypot(Math.floor(x / N) - fr, (x % N) - fc) * SWEEP_STEP]) });
  }
  const clear = () => { P = null; S = null; N = 0; mesh = null; };
  /** A finger is down on cell x (it shows which one a tap would change), or on none (-1). */
  function press(x) { hot = x; wake(); }

  // ---------- turning ----------
  const clampPose = () => {
    if (mesh?.closed) { yaw = ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; pitch = Math.max(SOLID.lo, Math.min(SOLID.hi, pitch)); return; }
    yaw = Math.max(-LIMITS.yaw, Math.min(LIMITS.yaw, yaw)); pitch = Math.max(LIMITS.lo, Math.min(LIMITS.hi, pitch));
  };
  function grab() { grabbed = true; vyaw = vpitch = 0; homing = null; moves.length = 0; touchedAt = performance.now(); wake(); }
  function drag(dx, dy) {
    const now = performance.now(), ky = 0.0062, kp = 0.0058;
    yaw += dx * ky; pitch -= dy * kp; clampPose();
    moves.push([now, dx * ky, -dy * kp]);
    while (moves.length && now - moves[0][0] > 90) moves.shift();
    touchedAt = now; wake();
  }
  /** Two fingers twisting: the pane turns about the vertical by the angle (radians, clockwise on the screen is positive). */
  function twist(a) { yaw += a * 0.9; clampPose(); touchedAt = performance.now(); wake(); }
  function release() {
    if (!grabbed) return;
    grabbed = false;
    const now = performance.now(), recent = moves.filter(m => now - m[0] < 90);
    if (recent.length > 1 && !still()) {                               // a flick spins on for a moment, then stops where it is
      const span = Math.max(16, now - recent[0][0]);
      vyaw = 0.6 * recent.reduce((a, m) => a + m[1], 0) / span; vpitch = 0.6 * recent.reduce((a, m) => a + m[2], 0) / span;
    }
    moves.length = 0;
    touchedAt = now;
    wake();
  }
  /** Back to the opening pose (the menu's Reset view): a short glide, at once for reduced motion. */
  function resetView() {
    vyaw = vpitch = 0;
    if (still()) { yaw = rest.yaw; pitch = rest.pitch; homing = null; } else { clampPose(); homing = { t0: performance.now(), y0: yaw, p0: pitch }; }
    wake();
  }
  const HOME_MS = 380;
  function stepPose(now, dt) {
    if (grabbed) return;
    if (homing) {
      const t = Math.min(1, (now - homing.t0) / HOME_MS), e = 1 - (1 - t) ** 3;
      yaw = homing.y0 + (rest.yaw - homing.y0) * e; pitch = homing.p0 + (rest.pitch - homing.p0) * e;
      if (t >= 1) homing = null;
      return;
    }
    if (Math.abs(vyaw) > 1e-5 || Math.abs(vpitch) > 1e-5) {
      yaw += vyaw * dt; pitch += vpitch * dt;
      const k = Math.exp(-dt / 280); vyaw *= k; vpitch *= k;
      clampPose();
      if (Math.abs(vyaw) < 4e-5 && Math.abs(vpitch) < 4e-5) vyaw = vpitch = 0;
    }
  }

  // ---------- the loop ----------
  function wake(ms = ASLEEP) { awakeUntil = Math.max(awakeUntil, performance.now() + ms); schedule(); }
  function schedule() { if (!raf && !halted && !dead && !document.hidden && P && S) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const busy = grabbed || vyaw !== 0 || vpitch !== 0 || homing || now - touchedAt < 1400 || sweeps.length > 0 || recent(now) || (winAt != null && now - winAt < 30000);
    const fps = grabbed ? 60 : busy ? 30 : 15;
    if (now - last < 1000 / fps - 4) { schedule(); return; }
    const t0 = performance.now();
    frame(now);
    const ms = performance.now() - t0;
    stats.ms = ms; stats.frames++; stats.avg = stats.avg ? stats.avg * 0.9 + ms * 0.1 : ms;
    if (!mesh && stats.frames > 12 && ms > SLOW_MS) { if (++slowCount >= SLOW_FRAMES) { halted = true; hooks.slow?.(); return; } } else if (slowCount > 0 && ms < SLOW_MS / 2) slowCount--;
    if (busy || now < awakeUntil) schedule();
  }
  const recent = now => { for (let i = 0; i < born.length; i++) if (now - born[i] < 1400 || now - gone[i] < 500) return true; return false; };
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(4000); };
  document.addEventListener("visibilitychange", onVis);
  const pause = () => { halted = true; cancelAnimationFrame(raf); raf = 0; };
  const resume = () => { halted = false; wake(4000); };

  // ---------- a cube or a hexagon board: cells as polygons (asterism-solid.js) ----------
  // The cube's cells lie on the unit sphere (the cube projected radially, as Mines' solids are), the hexagon board on a
  // plane; both are drawn by hand in perspective, the cells facing you only, as polygons through their projected corners.
  // The region's look is its dim colour, shaded by the light, a faint mark in each cell (as the nebula's pattern is on
  // the square pane), and the brass rule that holds it.
  const DM = 4;                                              // the eye's distance from the middle, in the solid's radius
  const LIGHT = [-0.35, -0.55, 0.76];
  let mesh = null, PX = null, PY = null, PZ = null, CX = null, CY = null, CS = null, CZ = null, VIS = null, NZ = null;
  const shadeCache = new Map();
  function buildMesh() {
    const M = P.topo.mesh, idx = new Map(), V = [], cv = [];
    const key = p => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;
    for (const cell of M.cells) cv.push(cell.pts.map(p => { const k = key(p); let i = idx.get(k); if (i === undefined) { i = V.length / 3; idx.set(k, i); V.push(p[0], p[1], p[2]); } return i; }));
    const owner = new Map();
    cv.forEach((ids, x) => ids.forEach((a, j) => { const b = ids[(j + 1) % ids.length], k = a < b ? `${a}-${b}` : `${b}-${a}`; let l = owner.get(k); if (!l) owner.set(k, l = []); l.push(x); }));
    const rules = [], rim = [];
    for (const [k, cells] of owner) {
      const [a, b] = k.split("-").map(Number);
      if (cells.length === 1) rim.push(a, b, cells[0]);
      else if (P.reg[cells[0]] !== P.reg[cells[1]]) rules.push(a, b, cells[0], cells[1]);
    }
    const nV = V.length / 3, n = M.cells.length;
    mesh = { V: Float32Array.from(V), cv, rules, rim, closed: M.closed, size: M.size, cells: M.cells };
    PX = new Float32Array(nV); PY = new Float32Array(nV); PZ = new Float32Array(nV);
    CX = new Float32Array(n); CY = new Float32Array(n); CS = new Float32Array(n); CZ = new Float32Array(n); VIS = new Float32Array(n); NZ = new Float32Array(n);
  }
  function fit() {
    if (mesh) f = (Math.min(W, H) / 2 - Math.max(8, Math.min(W, H) * 0.035)) * Math.sqrt(DM * DM - 1) * (mesh.closed ? 1 : 0.9);
    else if (N) f = fitScale(N, W, H, Math.max(8, Math.min(W, H) * 0.035));
  }
  /** Projects the vertices and each cell's middle for the pose; VIS is how squarely a cell faces you (0 or less: away). */
  function projectMesh() {
    const V = mesh.V, nV = V.length / 3;
    for (let i = 0; i < nV; i++) {
      const x = V[3 * i], y = V[3 * i + 1], z = V[3 * i + 2];
      const rx = R[0] * x + R[1] * y + R[2] * z, ry = R[3] * x + R[4] * y + R[5] * z, rz = R[6] * x + R[7] * y + R[8] * z, s = f / (DM - rz);
      PX[i] = cx + s * rx; PY[i] = cy + s * ry; PZ[i] = rz;
    }
    mesh.cells.forEach((c, x) => {
      const [X, Y, Z] = c.c, rx = R[0] * X + R[1] * Y + R[2] * Z, ry = R[3] * X + R[4] * Y + R[5] * Z, rz = R[6] * X + R[7] * Y + R[8] * Z, s = f / (DM - rz);
      const [a, b, d] = c.nrm, nx = R[0] * a + R[1] * b + R[2] * d, ny = R[3] * a + R[4] * b + R[5] * d, nz = R[6] * a + R[7] * b + R[8] * d;
      const ex = -rx, ey = -ry, ez = DM - rz, el = Math.hypot(ex, ey, ez);
      CX[x] = cx + s * rx; CY[x] = cy + s * ry; CS[x] = s * mesh.size; CZ[x] = rz; NZ[x] = nz;
      VIS[x] = (nx * ex + ny * ey + nz * ez) / el;
    });
  }
  const FACING = 0.04;
  const polyPath = x => {
    const ids = mesh.cv[x];
    ctx.beginPath(); ctx.moveTo(PX[ids[0]], PY[ids[0]]);
    for (let j = 1; j < ids.length; j++) ctx.lineTo(PX[ids[j]], PY[ids[j]]);
    ctx.closePath();
  };
  /** The cell under a point of the canvas: the nearest of those facing you with the point inside, or -1 (a sliver seen edge-on is not one). */
  function meshPick(sx, sy) {
    let best = -1, bz = -1e9;
    for (let x = 0; x < VIS.length; x++) {
      if (VIS[x] < 0.22 || CZ[x] < bz) continue;
      const ids = mesh.cv[x];
      let inside = false;
      for (let i = 0, j = ids.length - 1; i < ids.length; j = i++) {
        const xi = PX[ids[i]], yi = PY[ids[i]], xj = PX[ids[j]], yj = PY[ids[j]];
        if ((yi > sy) !== (yj > sy) && sx < (xj - xi) * (sy - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) { best = x; bz = CZ[x]; }
    }
    return best;
  }
  /** A faint mark in a cell, one of ten, told by its shape and direction (never by colour). */
  function markIn(x, kind, u) {
    const ids = mesh.cv[x], ax = PX[ids[1]] - PX[ids[0]], ay = PY[ids[1]] - PY[ids[0]], al = Math.hypot(ax, ay) || 1;
    const ex = ax / al, ey = ay / al, fx = -ey, fy = ex, cxx = CX[x], cyy = CY[x], h = u * 0.22;
    const seg = (x1, y1, x2, y2) => { ctx.moveTo(cxx + ex * x1 + fx * y1, cyy + ey * x1 + fy * y1); ctx.lineTo(cxx + ex * x2 + fx * y2, cyy + ey * x2 + fy * y2); };
    ctx.beginPath();
    switch (kind) {
      case 1: seg(-h, -h, h, h); seg(-h, 0, 0, h); seg(0, -h, h, 0); break;               // "\" hatch
      case 2: for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.moveTo(cxx + ex * a * h * 0.7 + fx * b * h * 0.7 + 1, cyy + ey * a * h * 0.7 + fy * b * h * 0.7); ctx.arc(cxx + ex * a * h * 0.7 + fx * b * h * 0.7, cyy + ey * a * h * 0.7 + fy * b * h * 0.7, 1, 0, 6.2832); } break;
      case 3: seg(-h * 1.3, -h * 0.5, h * 1.3, -h * 0.5); seg(-h * 1.3, h * 0.5, h * 1.3, h * 0.5); break;   // two rules along the cell
      case 4: seg(-h, h, h, -h); seg(-h, 0, 0, -h); seg(0, h, h, 0); break;                // "/" hatch
      case 5: seg(-h, -h, h, h); seg(-h, h, h, -h); break;                                  // a cross
      case 6: seg(-h * 0.5, -h * 1.3, -h * 0.5, h * 1.3); seg(h * 0.5, -h * 1.3, h * 0.5, h * 1.3); break;   // two rules across it
      case 7: ctx.moveTo(cxx + h, cyy); ctx.arc(cxx, cyy, h, 0, 6.2832); break;              // a ring
      case 8: seg(-h * 1.3, 0, -h * 0.65, -h * 0.5); seg(-h * 0.65, -h * 0.5, 0, 0); seg(0, 0, h * 0.65, -h * 0.5); seg(h * 0.65, -h * 0.5, h * 1.3, 0); break;   // a wave
      case 9: seg(-h, 0, h, 0); seg(0, -h, 0, h); break;                                    // a plus
      default: return;
    }
    ctx.stroke();
  }
  /** Lines through a cell (its belts, or rows): what a press shows, so a belt can be followed by eye. */
  const linesOf = x => P.of[x].filter(gi => P.groups[gi].kind !== "region");

  function frameMesh(now, calm, win, wage, wb, yw, pt) {
    projectMesh();
    const n = mesh.cells.length, unit = f / DM * mesh.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    drawSky(now, yw, pt, calm, win);
    const ur = f / Math.sqrt(DM * DM - 1) * (mesh.closed ? 1.18 : 1.05);
    ctx.globalAlpha = 0.5 + 0.35 * wb;
    ctx.drawImage(UNDER, cx - ur, cy - ur * 0.9, 2 * ur, 2 * ur * 0.9);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // the cells facing you, dim and shaded, a faint mark in each
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const shown = [];
    for (let x = 0; x < n; x++) if (VIS[x] > FACING) shown.push(x);
    shown.sort((a, b) => CZ[a] - CZ[b]);
    for (const x of shown) {
      const r = P.reg[x], hue = HUES[r % HUES.length], lit = Math.max(0, (R[0] * mesh.cells[x].nrm[0] + R[1] * mesh.cells[x].nrm[1] + R[2] * mesh.cells[x].nrm[2]) * LIGHT[0] + (R[3] * mesh.cells[x].nrm[0] + R[4] * mesh.cells[x].nrm[1] + R[5] * mesh.cells[x].nrm[2]) * LIGHT[1] + NZ[x] * LIGHT[2]);
      const shade = (0.55 + 0.55 * lit) * (0.62 + 0.38 * Math.min(1, VIS[x] * 1.6)), q = `${r}:${Math.round(shade * 24)}`;
      let col = shadeCache.get(q);
      if (!col) shadeCache.set(q, col = `hsl(${hue[0]}, ${hue[1]}%, ${Math.min(60, hue[2] * 1.25 * shade).toFixed(1)}%)`);
      polyPath(x); ctx.fillStyle = col; ctx.fill();
    }
    ctx.strokeStyle = "rgba(1,3,8,.9)"; ctx.lineWidth = Math.max(1.2, unit * 0.07);
    for (const x of shown) { polyPath(x); ctx.stroke(); }
    ctx.lineWidth = 1;
    for (const x of shown) {
      if (VIS[x] < 0.3 || unit < 11) continue;
      const hue = HUES[P.reg[x] % HUES.length];
      ctx.strokeStyle = ctx.fillStyle = `hsla(${hue[0]}, ${hue[1]}%, ${Math.min(80, hue[2] + 24)}%, ${(0.36 * Math.min(1, VIS[x] * 1.4)).toFixed(2)})`;
      markIn(x, hue[3], CS[x]);
      if (hue[3] === 2) ctx.fill();
    }

    // lights across the plates: the belts through a finger's cell, a hint's cells, sweeps, the end, a conflict
    const quad = polyPath;
    ctx.globalCompositeOperation = "lighter";
    if (hot >= 0) for (const gi of linesOf(hot)) for (const x of P.groups[gi].cells) if (VIS[x] > FACING) { quad(x); ctx.fillStyle = "rgba(214,190,130,.075)"; ctx.fill(); }
    for (const x of lit) if (VIS[x] > FACING) { quad(x); ctx.fillStyle = "rgba(214,176,100,.17)"; ctx.fill(); }
    if (hot >= 0 && VIS[hot] > FACING) { quad(hot); ctx.fillStyle = "rgba(190,200,222,.13)"; ctx.fill(); }
    if (sweeps.length) {
      for (const sw of sweeps) for (const [x, delay] of sw.items) {
        const v = bump(now - sw.t0 - delay, SWEEP_MS);
        if (v > 0.01 && VIS[x] > FACING) { quad(x); ctx.fillStyle = `rgba(206,194,150,${(0.3 * v).toFixed(3)})`; ctx.fill(); }
      }
      sweeps = sweeps.filter(sw => now - sw.t0 < SWEEP_MS + sw.items.reduce((m, i) => Math.max(m, i[1]), 0));
    }
    if (wb > 0.01) for (const x of shown) { quad(x); ctx.fillStyle = `rgba(214,184,120,${(0.075 * wb).toFixed(3)})`; ctx.fill(); }
    const pulse = calm ? 0.7 : 0.5 + 0.5 * Math.sin(now / 240);
    for (const x of bad) if (marks[x] !== STAR && VIS[x] > FACING) { quad(x); ctx.fillStyle = `rgba(150,40,34,${(0.16 + 0.12 * pulse).toFixed(3)})`; ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";

    // the rules that hold each region (where either side faces you), and a hexagon board's rim
    const rule = (a, b, c1, c2) => PZ[a] > -0.12 && PZ[b] > -0.12 && (VIS[c1] > FACING || (c2 != null && VIS[c2] > FACING));
    ctx.beginPath();
    for (let i = 0; i < mesh.rules.length; i += 4) if (rule(mesh.rules[i], mesh.rules[i + 1], mesh.rules[i + 2], mesh.rules[i + 3])) { ctx.moveTo(PX[mesh.rules[i]], PY[mesh.rules[i]]); ctx.lineTo(PX[mesh.rules[i + 1]], PY[mesh.rules[i + 1]]); }
    ctx.strokeStyle = `rgba(196,170,112,${(0.1 + 0.08 * wb).toFixed(3)})`; ctx.lineWidth = Math.max(3, unit * 0.16); ctx.stroke();
    ctx.strokeStyle = "rgba(214,200,164,.84)"; ctx.lineWidth = Math.max(1.4, unit * 0.06); ctx.stroke();
    if (mesh.rim.length) {
      ctx.beginPath();
      for (let i = 0; i < mesh.rim.length; i += 3) if (VIS[mesh.rim[i + 2]] > FACING) { ctx.moveTo(PX[mesh.rim[i]], PY[mesh.rim[i]]); ctx.lineTo(PX[mesh.rim[i + 1]], PY[mesh.rim[i + 1]]); }
      ctx.strokeStyle = `rgb(${196 + Math.round(24 * wb)},${164 + Math.round(30 * wb)},${98 + Math.round(24 * wb)})`; ctx.lineWidth = Math.max(1.6, unit * 0.09); ctx.stroke();
    }

    // rings: a broken rule, a hint's cell, its evidence (dashed), a finger's cell
    ctx.lineWidth = Math.max(1.4, unit * 0.075);
    for (const x of bad) if (marks[x] !== STAR && VIS[x] > FACING) { quad(x); ctx.strokeStyle = `rgba(196,86,74,${(0.6 + 0.3 * pulse).toFixed(2)})`; ctx.setLineDash([unit * 0.18, unit * 0.12]); ctx.stroke(); }
    ctx.setLineDash([]);
    for (const x of lit) if (VIS[x] > FACING) { quad(x); ctx.strokeStyle = "rgba(226,190,116,.95)"; ctx.lineWidth = Math.max(2, unit * 0.12); ctx.stroke(); }
    ctx.lineWidth = Math.max(1.4, unit * 0.075); ctx.setLineDash([unit * 0.16, unit * 0.1]);
    for (const x of why) if (VIS[x] > FACING) { quad(x); ctx.strokeStyle = "rgba(226,190,116,.9)"; ctx.stroke(); }
    ctx.setLineDash([]);
    if (hot >= 0 && VIS[hot] > FACING) { quad(hot); ctx.strokeStyle = "rgba(214,218,232,.8)"; ctx.lineWidth = Math.max(1.6, unit * 0.09); ctx.stroke(); }

    // dust, and the stars (the nearest cells last)
    ctx.globalCompositeOperation = "lighter";
    for (const x of shown) {
      if (marks[x] !== DOT) continue;
      const fade = calm ? 1 : Math.min(1, (now - dust[x]) / 280), sz = CS[x] * 0.34 * Math.min(1, VIS[x] * 1.6);
      ctx.globalAlpha = 0.32 * fade; ctx.drawImage(SOFT, CX[x] - sz, CY[x] - sz, 2 * sz, 2 * sz);
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = "#B9C2D6"; ctx.beginPath(); ctx.arc(CX[x], CY[x], Math.max(1, CS[x] * 0.055), 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    for (let x = 0; x < n; x++) {
      if (marks[x] !== STAR) {
        const a = now - gone[x];
        if (a < 450 && !calm && VIS[x] > FACING) {
          const sz = CS[x] * 1.5 * (1 - a / 450 * 0.5);
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * (1 - a / 450); ctx.drawImage(BLOOM, CX[x] - sz, CY[x] - sz, 2 * sz, 2 * sz); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        }
        continue;
      }
      if (VIS[x] <= 0.1) continue;
      const isBad = bad.has(x), age = calm ? 900 : now - born[x], u = CS[x] * Math.min(1, 0.55 + VIS[x] * 0.6);
      const lift = mesh.cells[x].nrm, px = CX[x] + (R[0] * lift[0] + R[1] * lift[1] + R[2] * lift[2]) * f / DM * mesh.size * 0.3, py = CY[x] + (R[3] * lift[0] + R[4] * lift[1] + R[5] * lift[2]) * f / DM * mesh.size * 0.3;
      const pop = age < 0 ? 0 : age < 460 ? easeOutBack(age / 460) : 1;
      const flash = calm ? (age < 1400 ? 0.25 : 0) : 0.6 * Math.exp(-Math.max(0, age) / 320);
      const gl = 1 + 0.3 * wb, throb = isBad && !calm ? 0.85 + 0.25 * pulse : 1, spr = isBad ? EMBER : BLOOM;
      ctx.globalCompositeOperation = "lighter";
      const pool = u * 1.15 * Math.max(0.2, pop), flat = Math.max(0.35, VIS[x]);
      ctx.globalAlpha = 0.2 + 0.1 * wb; ctx.drawImage(spr, CX[x] - pool, CY[x] - pool * flat, 2 * pool, 2 * pool * flat);
      const bl = u * (1.05 + 0.6 * flash) * pop * gl * throb;
      ctx.globalAlpha = 0.8; ctx.drawImage(spr, px - bl, py - bl, 2 * bl, 2 * bl);
      if (flash > 0.03) { const fs = u * (0.8 + 1.1 * flash); ctx.globalAlpha = Math.min(1, flash); ctx.drawImage(FLARE, px - fs, py - fs, 2 * fs, 2 * fs); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      const rOut = u * 0.36 * Math.max(0.01, pop), rIn = rOut * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? rIn : rOut, X = px + rad * Math.cos(an), Y = py + rad * Math.sin(an); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.closePath();
      ctx.fillStyle = isBad ? "#D9A596" : "#F6EBCB"; ctx.fill();
      ctx.lineWidth = Math.max(1, u * 0.05); ctx.strokeStyle = isBad ? "#8E2F2A" : "#B8933F"; ctx.lineJoin = "round"; ctx.stroke();
      if (isBad) {
        ctx.beginPath(); ctx.arc(px, py, u * (0.5 + 0.06 * pulse), 0, 6.2832);
        ctx.strokeStyle = `rgba(190,80,68,${(0.7 + 0.3 * pulse).toFixed(2)})`; ctx.lineWidth = Math.max(1.4, u * 0.07); ctx.setLineDash([u * 0.16, u * 0.1]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  /** The sky, and the near stars sliding a little against it as the board turns. */
  function drawSky(now, yw, pt, calm, win) {
    ctx.drawImage(sky, 0, 0, W, H);
    const drift = calm ? 0 : now / 1000 * (win ? 3 : 1.6), px = (yw - rest.yaw) * W, py = (pt - rest.pitch) * H;
    ctx.globalCompositeOperation = "lighter";
    for (const s of mid) {
      const x = (((s.x - px * 0.1 - drift * 0.5) % W) + W) % W, y = (((s.y + py * 0.1) % H) + H) % H;
      ctx.fillStyle = s.col; ctx.fillRect(x, y, s.s, s.s);
    }
    for (const s of near) {
      const x = (((s.x - px * 0.28 - drift) % W) + W) % W, y = (((s.y + py * 0.28) % H) + H) % H, tw = calm ? 0.8 : 0.65 + 0.35 * Math.sin(now / 700 + s.p);
      ctx.globalAlpha = s.a * tw; ctx.drawImage(SOFT, x - s.s, y - s.s, 2 * s.s, 2 * s.s);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- one frame ----------
  function frame(now) {
    if (!P || !S || !born) return;
    const dt = Math.min(64, now - last || 16);
    last = now;
    const calm = still();
    stepPose(now, dt);
    const win = winAt != null, wage = win ? (calm ? 1e9 : now - winAt) : 0, wb = win ? easeIO(Math.min(1, wage / 3200)) : 0;   // wb: the end's slow brightening, 0 to 1
    const fy = calm ? 0 : Math.sin(now / 2300) * 0.016 + (win ? Math.sin(now / 5200) * 0.05 : 0), fp = calm ? 0 : Math.sin(now / 1900 + 1) * 0.011;
    const yw = yaw + fy, pt = pitch + fp;
    R = poseMatrix(yw, pt);
    if (mesh) { frameMesh(now, calm, win, wage, wb, yw, pt); return; }
    const d = DIST * N, half = N / 2, M = N + 1;
    for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) {
      const x = c - half, y = r - half, rx = R[0] * x + R[1] * y, ry = R[3] * x + R[4] * y, rz = R[6] * x + R[7] * y, s = f / (d - rz);
      VX[r * M + c] = cx + s * rx; VY[r * M + c] = cy + s * ry;
    }
    const at = (x, y, z) => project(R, N, f, cx, cy, x - half, y - half, z);
    const unit = f / d;                                             // px a cell has at the middle

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    drawSky(now, yw, pt, calm, win);

    // the glow the pane throws on the dark under it
    const under = at(N / 2, N / 2, -1.6), ur = unit * N * 0.95;
    ctx.globalAlpha = 0.55 + 0.35 * wb;
    ctx.drawImage(UNDER, under[0] - ur, under[1] - ur * 0.85, 2 * ur, 2 * ur * 0.85);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // the glass: its sides where they face you, then its top
    const cam = [R[6] * d, R[7] * d];
    const corner = (x, y, z) => at(x, y, z);
    const top = [corner(0, 0, 0), corner(N, 0, 0), corner(N, N, 0), corner(0, N, 0)], low = [corner(0, 0, -THICK), corner(N, 0, -THICK), corner(N, N, -THICK), corner(0, N, -THICK)];
    const sides = [[0, 1, cam[1] < -half], [1, 2, cam[0] > half], [2, 3, cam[1] > half], [3, 0, cam[0] < -half]];
    ctx.fillStyle = "#05070F"; ctx.beginPath();
    low.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    for (const [a, b, face] of sides) {
      if (!face) continue;
      const g = ctx.createLinearGradient(top[a][0], top[a][1], low[a][0], low[a][1]);
      g.addColorStop(0, "rgba(150,148,132,.5)"); g.addColorStop(1, "rgba(40,46,70,.5)");
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(top[a][0], top[a][1]); ctx.lineTo(top[b][0], top[b][1]); ctx.lineTo(low[b][0], low[b][1]); ctx.lineTo(low[a][0], low[a][1]); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(5,8,18,.94)"; ctx.beginPath();
    top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();

    // the nebulae, a piece to each cell
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const a = r * M + c, ax = VX[a], ay = VY[a];
      ctx.setTransform(dpr * (VX[a + 1] - ax) / TEX, dpr * (VY[a + 1] - ay) / TEX, dpr * (VX[a + M] - ax) / TEX, dpr * (VY[a + M] - ay) / TEX, dpr * ax, dpr * ay);
      ctx.drawImage(tex, c * TEX, r * TEX, TEX, TEX, 0, 0, TEX, TEX);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // a sheen across the glass that slides as it turns
    ctx.save();
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.clip();
    const sx = top[0][0] + (top[2][0] - top[0][0]) * (0.5 + (yw - REST.yaw) * 0.9), sy = top[0][1] + (top[2][1] - top[0][1]) * (0.5 + (yw - REST.yaw) * 0.9);
    const sg = ctx.createLinearGradient(sx - (top[1][0] - top[0][0]) * 0.5, sy - (top[1][1] - top[0][1]) * 0.5, sx + (top[1][0] - top[0][0]) * 0.5, sy + (top[1][1] - top[0][1]) * 0.5);
    sg.addColorStop(0, "rgba(190,196,214,0)"); sg.addColorStop(0.5, "rgba(190,196,214,.055)"); sg.addColorStop(1, "rgba(190,196,214,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const quad = x => {
      const r = Math.floor(x / N), c = x % N, a = r * M + c;
      ctx.beginPath(); ctx.moveTo(VX[a], VY[a]); ctx.lineTo(VX[a + 1], VY[a + 1]); ctx.lineTo(VX[a + M + 1], VY[a + M + 1]); ctx.lineTo(VX[a + M], VY[a + M]); ctx.closePath();
    };

    // lights across plates: a hint's cells, a finger, sweeps, the end
    ctx.globalCompositeOperation = "lighter";
    for (const x of lit) { quad(x); ctx.fillStyle = "rgba(214,176,100,.17)"; ctx.fill(); }
    if (hot >= 0) { quad(hot); ctx.fillStyle = "rgba(190,200,222,.13)"; ctx.fill(); }
    if (sweeps.length) {
      for (const sw of sweeps) for (const [x, delay] of sw.items) {
        const v = bump(now - sw.t0 - delay, SWEEP_MS);
        if (v > 0.01) { quad(x); ctx.fillStyle = `rgba(206,194,150,${(0.3 * v).toFixed(3)})`; ctx.fill(); }
      }
      sweeps = sweeps.filter(sw => now - sw.t0 < SWEEP_MS + sw.items.reduce((m, i) => Math.max(m, i[1]), 0));
    }
    if (wb > 0.01) {                                                // solved: the whole field warms slowly, no flash
      ctx.fillStyle = `rgba(214,184,120,${(0.075 * wb).toFixed(3)})`;
      ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    }
    // a conflict pulses a dull oxblood (and is ringed, so it never rests on colour alone)
    const pulse = calm ? 0.7 : 0.5 + 0.5 * Math.sin(now / 240);
    for (const x of bad) {
      if (marks[x] === STAR) continue;
      quad(x); ctx.fillStyle = `rgba(150,40,34,${(0.16 + 0.12 * pulse).toFixed(3)})`; ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // the lattice, then the rules that hold each region, then the pane's rim
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(2,4,10,.62)"; ctx.lineWidth = Math.max(1, unit * 0.045);
    ctx.beginPath();
    for (let i = 1; i < N; i++) { ctx.moveTo(VX[i], VY[i]); ctx.lineTo(VX[N * M + i], VY[N * M + i]); ctx.moveTo(VX[i * M], VY[i * M]); ctx.lineTo(VX[i * M + N], VY[i * M + N]); }
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(196,170,112,${(0.1 + 0.08 * wb).toFixed(3)})`; ctx.lineWidth = Math.max(3, unit * 0.18);
    ctx.beginPath();
    for (let i = 0; i < edges.length; i += 2) { ctx.moveTo(VX[edges[i]], VY[edges[i]]); ctx.lineTo(VX[edges[i + 1]], VY[edges[i + 1]]); }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(214,200,164,.82)"; ctx.lineWidth = Math.max(1.4, unit * 0.06);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${196 + Math.round(24 * wb)},${164 + Math.round(30 * wb)},${98 + Math.round(24 * wb)},.88)`; ctx.lineWidth = Math.max(1.6, unit * 0.08);
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();

    // rings: a broken rule, a hint's cell, a hint's evidence (dashed): outlines say it, colour only helps
    ctx.lineWidth = Math.max(1.4, unit * 0.075);
    for (const x of bad) {
      if (marks[x] === STAR) continue;
      quad(x); ctx.strokeStyle = `rgba(196,86,74,${(0.6 + 0.3 * pulse).toFixed(2)})`; ctx.setLineDash([unit * 0.18, unit * 0.12]); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const x of lit) { quad(x); ctx.strokeStyle = "rgba(226,190,116,.95)"; ctx.lineWidth = Math.max(2, unit * 0.12); ctx.stroke(); }
    ctx.lineWidth = Math.max(1.4, unit * 0.075); ctx.setLineDash([unit * 0.16, unit * 0.1]);
    for (const x of why) { quad(x); ctx.strokeStyle = "rgba(226,190,116,.9)"; ctx.stroke(); }
    ctx.setLineDash([]);
    if (hot >= 0) { quad(hot); ctx.strokeStyle = "rgba(214,218,232,.8)"; ctx.lineWidth = Math.max(1.6, unit * 0.09); ctx.stroke(); }

    // dust: a marked-empty cell is a faint speck
    ctx.globalCompositeOperation = "lighter";
    for (let x = 0; x < N * N; x++) {
      if (marks[x] !== DOT) continue;
      const r = Math.floor(x / N), c = x % N, p = at(c + 0.5, r + 0.5, 0.04), fade = calm ? 1 : Math.min(1, (now - dust[x]) / 280), sz = p[2] * 0.34;
      ctx.globalAlpha = 0.32 * fade; ctx.drawImage(SOFT, p[0] - sz, p[1] - sz, 2 * sz, 2 * sz);
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = "#B9C2D6"; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1, p[2] * 0.055), 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // stars: a pool of light on the glass under each, the star hovering over it with its bloom, and a flare as it ignites
    for (let x = 0; x < N * N; x++) {
      const r = Math.floor(x / N), c = x % N;
      if (marks[x] !== STAR) {
        const a = now - gone[x];
        if (a < 450 && !calm) {                                       // one that was just cleared: a last glow, going out
          const p = at(c + 0.5, r + 0.5, LIFT), sz = p[2] * 1.5 * (1 - a / 450 * 0.5);
          ctx.globalAlpha = 0.5 * (1 - a / 450); ctx.drawImage(BLOOM, p[0] - sz, p[1] - sz, 2 * sz, 2 * sz); ctx.globalAlpha = 1;
        }
        continue;
      }
      const isBad = bad.has(x), age = calm ? 900 : now - born[x];
      const p = at(c + 0.5, r + 0.5, LIFT), g0 = at(c + 0.5, r + 0.5, 0.02), u = p[2];
      const pop = age < 0 ? 0 : age < 460 ? easeOutBack(age / 460) : 1;
      const flash = calm ? (age < 1400 ? 0.25 : 0) : 0.6 * Math.exp(-Math.max(0, age) / 320);
      const gl = 1 + 0.3 * wb;                                         // the end: each star glows a little more, slowly
      const throb = isBad && !calm ? 0.85 + 0.25 * pulse : 1;
      const spr = isBad ? EMBER : BLOOM;
      ctx.globalCompositeOperation = "lighter";
      const pool = g0[2] * 1.15 * Math.max(0.2, pop);                  // the light it throws down on the glass
      ctx.globalAlpha = 0.2 + 0.1 * wb; ctx.drawImage(spr, g0[0] - pool, g0[1] - pool * 0.7, 2 * pool, 2 * pool * 0.7);
      const bl = u * (1.05 + 0.6 * flash) * pop * gl * throb;
      ctx.globalAlpha = 0.8; ctx.drawImage(spr, p[0] - bl, p[1] - bl, 2 * bl, 2 * bl);
      const fl = flash;
      if (fl > 0.03) { const fs = u * (0.8 + 1.1 * fl); ctx.globalAlpha = Math.min(1, fl); ctx.drawImage(FLARE, p[0] - fs, p[1] - fs, 2 * fs, 2 * fs); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      const rOut = u * 0.36 * Math.max(0.01, pop), rIn = rOut * 0.42;       // the star itself, upright to the eye
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? rIn : rOut;
        const X = p[0] + rad * Math.cos(an), Y = p[1] + rad * Math.sin(an);
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.closePath();
      ctx.fillStyle = isBad ? "#D9A596" : "#F6EBCB"; ctx.fill();
      ctx.lineWidth = Math.max(1, u * 0.05); ctx.strokeStyle = isBad ? "#8E2F2A" : "#B8933F"; ctx.lineJoin = "round"; ctx.stroke();
      if (isBad) {                                                     // a ring: a conflict is seen without colour
        ctx.beginPath(); ctx.arc(p[0], p[1], u * (0.5 + 0.06 * pulse), 0, 6.2832);
        ctx.strokeStyle = `rgba(190,80,68,${(0.7 + 0.3 * pulse).toFixed(2)})`; ctx.lineWidth = Math.max(1.4, u * 0.07); ctx.setLineDash([u * 0.16, u * 0.1]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  // ---------- asked by the page ----------
  const local = ev => { const b = canvas.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
  /** The cell under a pointer, or -1; `slack` (cells round the pane that still count as its edge) 0 asks "is it on the pane". */
  function cellAt(ev, slack) {
    if (!P) return -1;
    if (mesh) { const [mx, my] = local(ev); return meshPick(mx, my); }
    if (!N) return -1;
    const [x, y] = local(ev);
    return pickCell(R, N, f, cx, cy, x, y, slack);
  }
  /** A pointer on the board in board units (a cell is 1 wide, from the top left), unclamped; null if the eye looks away. */
  function boardPoint(ev) {
    if (!P || !N || mesh) return null;
    const [x, y] = local(ev), p = unproject(R, N, f, cx, cy, x, y, LIFT / 2);
    return p ? { x: p[0] + N / 2, y: p[1] + N / 2 } : null;
  }
  /** Where a cell's middle is on the screen (client px), as it is drawn now. */
  function where(x) {
    if (mesh) { const b = canvas.getBoundingClientRect(); return { x: b.left + CX[x], y: b.top + CY[x] }; }
    const b = canvas.getBoundingClientRect(), p = project(R, N, f, cx, cy, (x % N) + 0.5 - N / 2, Math.floor(x / N) + 0.5 - N / 2, LIFT / 2);
    return { x: b.left + p[0], y: b.top + p[1] };
  }
  /** One frame drawn now (tests; the first frame after a set). */
  function drawNow() { frame(performance.now()); }
  function destroy() {
    dead = true; cancelAnimationFrame(raf); raf = 0;
    ro?.disconnect(); removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis);
    canvas.remove();
  }
  resize();
  return {
    canvas, set, clear, press, grab, drag, twist, release, resetView, cellAt, boardPoint, linesOf: x => (mesh ? linesOf(x) : []),
    /** Whether a cell faces you well enough to follow a line across; and how big a cell is on the screen (px). */
    faces: x => !!mesh && VIS[x] > 0.15, get cellPx() { return mesh ? f / DM * mesh.size : f / (DIST * N); }, get isMesh() { return !!mesh; }, where, pause, resume, destroy, drawNow, stats,
    get pose() { return { yaw, pitch }; }, get asleep() { return !raf; },
  };
}
