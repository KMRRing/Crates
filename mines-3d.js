// Mines' solid fields on the page (mines-solid.js): the cube, the sphere and the geodesic sphere, drawn on one canvas
// in perspective, by hand (no library, so it works offline). A hidden cell is a tile standing up from the surface (on
// the cube, a little cube), a dug one is sunk level with it, so the field reads as the flat one does; it's lit from
// the upper left, so each face shows which way it turns. A finger turns the solid like a trackball and a flick spins
// it on a moment; two fingers zoom, and slide it once it's larger than its box. Only the half facing you is drawn, back
// to front. The page asks it what it asks
// the flat view (mines-draw.js): what to show (set), which cell is under a finger (cellAt), where a cell is (where);
// and here also whether a cell is fair to tap (fair): one seen edge-on is a slanted sliver, so it is turned to face
// you before a tap on it counts (face).
import { solidBoard } from "./mines-solid.js";
import { probeIn, readPalette, flagGlyph, mineGlyph, startGlyph, css, mix, alpha } from "./mines-draw.js";
import { scale } from "./wide.js";

// ---------- turns: quaternions [w, x, y, z], from the solid's own frame to the view's (x right, y up, z to you) ----------
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
const qaxis = (a, t) => { const s = Math.sin(t / 2); return [Math.cos(t / 2), a[0] * s, a[1] * s, a[2] * s]; };
/** The turn as a 3×3 matrix, row by row. */
function matrix([w, x, y, z]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
const turned = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
/** The least turn taking unit vector u onto unit vector v. */
function between(u, v) {
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  if (d > 1 - 1e-9) return [1, 0, 0, 0];
  if (d < -1 + 1e-9) return qaxis(Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], Math.PI);   // straight round, about any axis across
  const a = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...a);
  return qaxis([a[0] / l, a[1] / l, a[2] / l], Math.acos(d));
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map(x => -x); d = -d; }
  if (d > 0.9995) return qnorm(a.map((x, i) => x + (b[i] - x) * t));
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((x, i) => x * wa + b[i] * wb);
}
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const D = 4;                                              // the eye's distance from the middle, in the solid's radius: a gentle perspective
const COMFORT = { cube: 34, sphere: 36, geodesic: 40 };   // a thumb's cell in px on a phone, as the flat view's: a square's side, a hexagon's width, a triangle's side
const AREA_TO_SIZE = { cube: 1, sphere: 1.0746, geodesic: 1.5197 };   // that size from the square root of a cell's area (a hexagon's is 0.93 of its width, a triangle's 0.66 of its side)
const RAISE = { cube: 0.16, sphere: 0.12, geodesic: 0.1 };            // how far a hidden tile stands up, in cells
const GAP = 0.06, BEVEL = 0.1;                            // a tile's foot inset from the cell's outline, and its top inset more (a bevel), as shares of the way to the middle
const GLYPH = { cube: 0.5, sphere: 0.45, geodesic: 0.36 }; // a number's or a flag's room, over the cell's size on screen (as the flat view's)
const FAIR_FACING = 0.42;                                 // a cell turned further from you than this (the cosine) turns to you before a tap on it counts,
const FAIR_SIZE = 0.5;                                    // as does one drawn smaller than this share of a thumb's cell (one facing you never is, however far out it's zoomed)
const MOST = 2.4, ENOUGH = 0.8;                           // as the flat view's: the most it zooms in, times a thumb's size; how near a thumb's size the whole solid may be and still open whole
const SPIN_MS = 420;                                      // how fast a flick's spin dies away (its time constant)
const TURN_MS = 380;                                      // how long turning a cell to face you takes
const SINK_MS = 140;                                      // how long a dug tile takes to sink
const LIGHT = (() => { const v = [-0.38, 0.55, 0.74], l = Math.hypot(...v); return v.map(x => x / l); })();   // from the upper left, in front
const SHADES = 16;                                        // steps of light a colour is kept at, so a frame builds no colour strings
// a cube's face turned to you is seen a little from above (16°) and from the right (20°), so the faces there show too
// (it still faces you at nine-tenths: well inside fair)
const TILT = qmul(qaxis([0, 1, 0], -20 * Math.PI / 180), qaxis([1, 0, 0], 16 * Math.PI / 180));
/** The phone asks for less motion: a turn to a cell happens at once, and a flick doesn't spin on. */
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createSolidView(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "mn-canvas";
  canvas.setAttribute("role", "img");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  const probe = probeIn(host);

  let f = null, B = null;                   // the field, and its solid (mines-solid.js's board)
  let W = 1, H = 1, dpr = 1, k = 1;         // the box, and the zoom: px per unit of the solid at its middle's depth
  let q = [1, 0, 0, 0];                     // how the solid is turned
  let ox = 0, oy = 0;                       // where its middle is, from the box's middle in px: zoomed in, it slides (two fingers)
  let S = { cells: "", reader: null, me: 0, told: "", end: null, hint: null, focus: -1, pings: [], asks: [], colour: s => s };
  let P = null;                             // the palette (mines-draw.js), and each colour at every step of light
  const wave = new Map();                   // cell -> when it sinks open on screen (a flood opens as a wave from the cell dug)
  let frame = 0, spin = null, turn = null;  // a flick's spin { axis, w (rad a ms), at }; a turn to a cell { from, to, x0, y0, x1, y1, at }
  const drags = [];                         // the last moves of a drag, [{ t, dx, dy }], for a flick's speed
  let settled = null;                       // told when a spin or a turn comes to rest (the page keeps the view)

  // ---------- the solid's cells, in flat arrays (worked out once a field) ----------
  // per cell: its middle C and normal N, and its outline's points from off[i] to off[i + 1]: RIM the outline itself (a
  // dug cell's floor), BASE inset to a tile's foot, FOOT inset again (a tile's top, before it's raised); U, the cube's
  // face's first axis (to square a face up when it's turned to you)
  let n = 0, off = null, C = null, N = null, U = null, RIM = null, BASE = null, FOOT = null, lift = 0;
  // each frame: the cells facing you, back to front; per cell its middle and normal turned, how squarely it faces you,
  // and on screen its top or floor (FX/FY) and a tile's foot (BX/BY), the middle of that face, and its area
  let order = [], VC = null, VN = null, facing = null, FX = null, FY = null, BX = null, BY = null, MX = null, MY = null, AREA = null;
  let raisedNow = null;                     // per cell: the height its tile stood at in the last frame (0: a floor)

  function build() {
    const cells = B.cells;
    n = cells.length;
    off = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + cells[i].pts.length;
    const m = off[n];
    C = new Float64Array(3 * n); N = new Float64Array(3 * n); U = new Float64Array(3 * n);
    RIM = new Float64Array(3 * m); BASE = new Float64Array(3 * m); FOOT = new Float64Array(3 * m);
    for (let i = 0; i < n; i++) {
      const cell = cells[i];
      for (let a = 0; a < 3; a++) { C[3 * i + a] = cell.c[a]; N[3 * i + a] = cell.nrm[a]; U[3 * i + a] = cell.u ? cell.u[a] : 0; }
      cell.pts.forEach((p, j) => {
        const at = 3 * (off[i] + j);
        for (let a = 0; a < 3; a++) {
          RIM[at + a] = p[a];
          BASE[at + a] = cell.c[a] + (p[a] - cell.c[a]) * (1 - GAP);
          FOOT[at + a] = cell.c[a] + (p[a] - cell.c[a]) * (1 - GAP - BEVEL);
        }
      });
    }
    lift = RAISE[B.shape] * B.size;
    VC = new Float64Array(3 * n); VN = new Float64Array(3 * n); facing = new Float64Array(n);
    FX = new Float32Array(m); FY = new Float32Array(m); BX = new Float32Array(m); BY = new Float32Array(m);
    MX = new Float32Array(n); MY = new Float32Array(n); AREA = new Float32Array(n); raisedNow = new Float32Array(n);
    order = [];
  }

  // ---------- the palette ----------
  function palette() {
    P = readPalette(probe);
    // the solid's body, seen in the grooves round its tiles: a dark brass by day, below the dial at night
    P.core = P.dark ? mix(P.yard, [0, 0, 0], 0.42) : mix(P.edge, P.ink, 0.55);
    const shaded = col => Array.from({ length: SHADES + 1 }, (_, s) => {
      const lit = s / SHADES;
      return css(mix(mix(col, P.core, 0.4 * (1 - lit)), [255, 255, 255], (P.dark ? 0.06 : 0.12) * lit));
    });
    P.tops = shaded(P.tile);
    P.walls = shaded(mix(P.tile, P.edge, P.dark ? 0.35 : 0.6));
    P.floors = shaded(P.dug);
    P.struck = shaded(mix(P.dug, P.bad, 0.3));
    P.edgeCss = css(P.edge);
    P.seamCss = css(mix(P.dug, P.rule, 0.8));
    P.coreCss = css(P.core);
    P.numCss = P.nums.map(c => css(c));
  }

  // ---------- the view: how large, and how turned ----------
  const outer = () => 1 + (B ? lift : 0);                  // the tiles' tops reach a little past the solid's radius
  /** The zoom at which the whole solid, turned any way, fits the box. */
  const fitK = () => Math.max(1, (Math.min(W, H) / 2 - 4) * Math.sqrt(D * D - outer() ** 2) / (outer() * D));
  /** The zoom at which a cell facing you in the middle is a thumb's size. */
  const comfortK = () => (B ? (COMFORT[B.shape] * scale()) / (B.size * D / (D - B.front)) : 1);
  const maxK = () => Math.max(fitK(), comfortK() * MOST);
  /** How far the solid reaches on screen from its middle, turned any way, at zoom kk. */
  const reach = (kk = k) => kk * outer() * D / Math.sqrt(D * D - outer() ** 2);
  /** Keeps the zoom in range, and the solid over the middle of the box: it slides only as far as it's larger than the box. */
  function clamp() {
    k = Math.min(maxK(), Math.max(fitK(), k));
    const rx = Math.max(0, reach() - W / 2 + 6), ry = Math.max(0, reach() - H / 2 + 6);
    ox = Math.min(rx, Math.max(-rx, ox)); oy = Math.min(ry, Math.max(-ry, oy));
  }
  const larger = () => fitK() < comfortK() * ENOUGH;
  const zoomed = () => k > fitK() * 1.02;
  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const was = k / Math.max(1e-6, fitK()), wx = ox / Math.max(1e-6, reach()), wy = oy / Math.max(1e-6, reach());
    W = r.width; H = r.height; dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    if (f) { k = was * fitK(); ox = wx * reach(); oy = wy * reach(); clamp(); }
    draw();
  }
  new ResizeObserver(resize).observe(host);
  /** Where a point of the solid (in its own frame) lands in the box, turned by R and slid by (sx, sy). */
  function onScreen(R, p, sx = ox, sy = oy) {
    const v = turned(R, p), s = D / (D - v[2]);
    return { x: W / 2 + sx + k * v[0] * s, y: H / 2 + sy - k * v[1] * s, z: v[2] };
  }

  /**
   * The turn that brings cell i to face you, from turn `from`. On the cube the face is also squared to the screen, rows
   * level, and then tipped a little (TILT) so the faces above and beside it show: seen dead square, a cube is a flat
   * grid.
   */
  function facingTurn(i, from = q) {
    const R = matrix(from), nv = turned(R, [N[3 * i], N[3 * i + 1], N[3 * i + 2]]);
    let t = between(nv, [0, 0, 1]);
    if (B.shape === "cube") {
      const u = turned(matrix(t), turned(R, [U[3 * i], U[3 * i + 1], U[3 * i + 2]]));
      const ang = Math.atan2(u[1], u[0]), snap = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
      t = qmul(TILT, qmul(qaxis([0, 0, 1], snap - ang), t));
    }
    return qnorm(qmul(t, from));
  }

  /** The slide that brings cell i's face to the middle of the box, turned by `to` (as far as the solid may slide). */
  function centring(i, to) {
    const R = matrix(to), m = onScreen(R, [C[3 * i], C[3 * i + 1], C[3 * i + 2]], 0, 0);
    const keep = [ox, oy];
    ox = W / 2 - m.x; oy = H / 2 - m.y;
    clamp();
    const out = [ox, oy];
    [ox, oy] = keep;
    return out;
  }

  /** Shows a field: f (mines-engine's), and how to open on it: "fit", "comfort", or a kept view { z, q, x, y }. */
  function setField(field, view = "comfort") {
    f = field;
    B = solidBoard(f.shape, f.w);
    build();
    wave.clear(); spin = null; turn = null; drags.length = 0;
    ox = 0; oy = 0;
    resize();
    const kept = view && typeof view === "object" && Array.isArray(view.q) && view.q.length === 4 && view.q.every(Number.isFinite) && Math.hypot(...view.q) > 0.5;
    if (kept) {
      q = qnorm(view.q); k = Number.isFinite(view.z) ? view.z * comfortK() : fitK();
      clamp();
      ox = (Number(view.x) || 0) * reach(); oy = (Number(view.y) || 0) * reach();
    } else {
      // the start faces you, in the middle of the box when the solid is larger than it
      q = facingTurn(f.start, [1, 0, 0, 0]); k = view === "fit" || !larger() ? fitK() : comfortK();
      clamp();
      [ox, oy] = centring(f.start, q);
    }
    clamp();
    draw();
  }

  /** What to draw: as the flat view's set() (mines-draw.js). opened: cells just dug open, from `from`: they sink as a wave. */
  function set(next, opened = null, from = -1) {
    S = { ...S, ...next };
    if (opened?.length && f) {
      const now = performance.now(), o = from >= 0 ? from : opened[0];
      for (const c of opened) {
        const d = Math.hypot(C[3 * c] - C[3 * o], C[3 * c + 1] - C[3 * o + 1], C[3 * c + 2] - C[3 * o + 2]) / B.size;
        wave.set(c, now + 22 * d);
      }
    }
    draw();
  }

  // ---------- turning ----------
  /** How far the surface facing you moves on screen for a turn of one radian: a drag turns it that much, so the cell under the finger follows it. */
  const follow = () => k * B.front * D / (D - B.front);
  function rest() { if (!spin && !turn) settled?.(); }
  /** Moves the turn on to `now`: a flick's spin dying away, a turn towards a cell easing in. True while still moving. */
  function advance(now) {
    if (turn) {
      const t = Math.min(1, (now - turn.at) / TURN_MS), e = ease(t);
      q = slerp(turn.from, turn.to, e);
      ox = turn.x0 + (turn.x1 - turn.x0) * e; oy = turn.y0 + (turn.y1 - turn.y0) * e;
      if (t >= 1) { turn = null; rest(); }
    } else if (spin) {
      const dt = Math.min(64, now - spin.at);
      spin.at = now;
      q = qnorm(qmul(qaxis(spin.axis, spin.w * dt), q));
      spin.w *= Math.exp(-dt / SPIN_MS);
      if (spin.w < 0.00015) { spin = null; rest(); }
    }
    return !!(turn || spin);
  }
  /** A drag: turns the solid as a trackball turns, about the axis across the drag. */
  function panBy(dx, dy) {
    if (!f || (!dx && !dy)) return;
    spin = null; turn = null;
    const d = Math.hypot(dx, dy);
    q = qnorm(qmul(qaxis([dy / d, dx / d, 0], d / follow()), q));
    const now = performance.now();
    drags.push({ t: now, dx, dy });
    while (drags.length && now - drags[0].t > 100) drags.shift();
    draw();
  }
  /** A finger down: whatever spin or turn was going stops under it. */
  function grab() { spin = null; turn = null; drags.length = 0; }
  /** A finger up after a drag: a flick spins on, slowing. */
  function release() {
    const now = performance.now(), recent = drags.filter(m => now - m.t < 80);
    drags.length = 0;
    if (recent.length < 2) { rest(); return; }
    const dx = recent.reduce((s, m) => s + m.dx, 0), dy = recent.reduce((s, m) => s + m.dy, 0);
    const ms = Math.max(16, now - recent[0].t), speed = Math.hypot(dx, dy) / ms;
    if (speed < 0.25 || still()) { rest(); return; }
    const d = Math.hypot(dx, dy);
    spin = { axis: [dy / d, dx / d, 0], w: speed / follow(), at: now };
    draw();
  }
  /** Two fingers moving together: the solid slides, as far as it's larger than the box (it turns under one finger). */
  function shiftBy(dx, dy) { if (!f) return; ox += dx; oy += dy; clamp(); draw(); }
  /** Turns cell i to face you, squarely, sliding it to the middle of the box if the solid is larger than the box. */
  function face(i) {
    if (!f || i < 0 || i >= n) return;
    spin = null;
    const to = facingTurn(i), [x1, y1] = centring(i, to);
    if (still()) { q = to; ox = x1; oy = y1; turn = null; rest(); draw(); return; }
    turn = { from: q, to, x0: ox, y0: oy, x1, y1, at: performance.now() };
    draw();
  }

  // ---------- where a cell is, now ----------
  /** Cell i as it's turned now: its face's middle on the page box, how squarely it faces you, its size in a thumb's measure. */
  function measure(i) {
    const R = matrix(q), up = raised(i) ? lift : 0;
    const c = turned(R, [C[3 * i] + N[3 * i] * up, C[3 * i + 1] + N[3 * i + 1] * up, C[3 * i + 2] + N[3 * i + 2] * up]);
    const nv = turned(R, [N[3 * i], N[3 * i + 1], N[3 * i + 2]]);
    const e = [-c[0], -c[1], D - c[2]], el = Math.hypot(...e), fc = (nv[0] * e[0] + nv[1] * e[1] + nv[2] * e[2]) / el;
    let area = 0, px = 0, py = 0, x0 = 0, y0 = 0;
    for (let j = off[i]; j < off[i + 1]; j++) {
      const { x, y } = onScreen(R, up ? [FOOT[3 * j] + N[3 * i] * up, FOOT[3 * j + 1] + N[3 * i + 1] * up, FOOT[3 * j + 2] + N[3 * i + 2] * up] : [RIM[3 * j], RIM[3 * j + 1], RIM[3 * j + 2]]);
      if (j > off[i]) area += px * y - x * py; else { x0 = x; y0 = y; }
      px = x; py = y;
    }
    area += px * y0 - x0 * py;
    const s = D / (D - c[2]);
    return { x: W / 2 + ox + k * c[0] * s, y: H / 2 + oy - k * c[1] * s, facing: fc, size: Math.sqrt(Math.abs(area) / 2) * AREA_TO_SIZE[B.shape] };
  }
  /** Whether a tap on cell i counts as it is: it faces you squarely enough and is drawn large enough. */
  function fair(i) {
    if (!f || i < 0 || i >= n) return false;
    const m = measure(i);
    return m.facing >= FAIR_FACING && m.size >= FAIR_SIZE * COMFORT[B.shape] * scale();
  }
  /** Brings a cell into view, facing you, if it isn't (a hint names it, say). */
  function reveal(i) {
    if (!f || i < 0 || i >= n) return;
    const m = measure(i), margin = Math.min(W, H) * 0.08;
    if (m.facing < 0.7 || m.x < margin || m.x > W - margin || m.y < margin || m.y > H - margin) face(i);
    else draw();
  }

  // ---------- drawing ----------
  const hiddenCh = ch => ch === "." || (ch >= "0" && ch <= "5");
  function raised(i) {
    const ch = S.cells?.[i] || ".";
    if (hiddenCh(ch)) return true;
    const t = wave.get(i);
    return ch === "o" && t != null && performance.now() < t + SINK_MS;
  }
  function draw() { if (!frame) frame = requestAnimationFrame(paint); }

  let paintMs = 0;                          // how long the last frame took to draw (the tests watch it stays smooth)
  function paint() {
    const now = performance.now();
    paintFrame(now);
    paintMs = performance.now() - now;
  }
  function paintFrame(now) {
    frame = 0;
    if (!P) palette();
    let moving = f ? advance(now) : false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!f) return;
    const R = matrix(q), cx = W / 2 + ox, cy = H / 2 + oy, cs = S.cells || "", over = !!S.end;

    // which cells face you, back to front
    order = [];
    for (let i = 0; i < n; i++) {
      const c = turned(R, [C[3 * i], C[3 * i + 1], C[3 * i + 2]]), nv = turned(R, [N[3 * i], N[3 * i + 1], N[3 * i + 2]]);
      VC[3 * i] = c[0]; VC[3 * i + 1] = c[1]; VC[3 * i + 2] = c[2];
      VN[3 * i] = nv[0]; VN[3 * i + 1] = nv[1]; VN[3 * i + 2] = nv[2];
      const ex = -c[0], ey = -c[1], ez = D - c[2];
      facing[i] = (nv[0] * ex + nv[1] * ey + nv[2] * ez) / Math.hypot(ex, ey, ez);
      if (facing[i] > -0.02) order.push(i);
    }
    order.sort((a, b) => VC[3 * a + 2] - VC[3 * b + 2]);

    // the solid's body first: it shows in the grooves round the tiles
    ctx.fillStyle = P.coreCss;
    if (B.shape === "cube") {
      const a = B.front, sides = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
      for (const [axis, sign] of sides) {
        const nv = turned(R, axis === 0 ? [sign, 0, 0] : axis === 1 ? [0, sign, 0] : [0, 0, sign]);
        const fc = turned(R, axis === 0 ? [sign * a, 0, 0] : axis === 1 ? [0, sign * a, 0] : [0, 0, sign * a]);
        if (nv[0] * -fc[0] + nv[1] * -fc[1] + nv[2] * (D - fc[2]) <= 0) continue;
        ctx.beginPath();
        for (const [s1, s2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const p = [0, 0, 0];
          p[axis] = sign * a; p[(axis + 1) % 3] = s1 * a; p[(axis + 2) % 3] = s2 * a;
          const v = turned(R, p), s = D / (D - v[2]);
          ctx.lineTo(cx + k * v[0] * s, cy - k * v[1] * s);
        }
        ctx.closePath(); ctx.fill();
      }
    } else {
      // a sphere's cells are flat, so its body is their outlines (a circle would show past them at the rim); only those
      // facing you, all wound one way, so the outlines add up and none cuts a hole in another
      ctx.beginPath();
      for (const i of order) {
        if (facing[i] <= 0) continue;
        for (let j = off[i]; j < off[i + 1]; j++) {
          const px = RIM[3 * j], py = RIM[3 * j + 1], pz = RIM[3 * j + 2];
          const s = D / (D - (R[6] * px + R[7] * py + R[8] * pz));
          const x = cx + k * (R[0] * px + R[1] * py + R[2] * pz) * s, y = cy - k * (R[3] * px + R[4] * py + R[5] * pz) * s;
          if (j === off[i]) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fill("nonzero");
    }

    // the cells, back to front; what's on a cell is drawn with it, upright on the screen whichever way the solid turns
    // so a number always reads, and a tile standing nearer covers it as it should
    ctx.lineJoin = "round";
    ctx.font = `800 100px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const glyph = (i, ch) => {
      const x = MX[i], y = MY[i], s0 = GLYPH[B.shape] * Math.sqrt(AREA[i]) * AREA_TO_SIZE[B.shape];
      if (ch === "o" && f.nums[i] > 0) {
        const reader = S.reader ? S.reader(i) : null, mine = reader == null || reader === S.me, told = S.told?.[i] === "1";
        if (mine || told || over) {
          const v = f.nums[i], size = (s0 * (v >= 10 ? 1.0 : 1.25)) / 100;
          ctx.fillStyle = P.numCss[Math.min(12, v)];
          ctx.setTransform(dpr * size, 0, 0, dpr * size, dpr * x, dpr * (y + s0 * 0.06));
          ctx.fillText(String(v), 0, 0);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else { ctx.fillStyle = alpha(P.seats[S.colour(reader) % 6], 0.55); ctx.beginPath(); ctx.arc(x, y, s0 * 0.16, 0, Math.PI * 2); ctx.fill(); }
        if (told && !mine && !over) { ctx.fillStyle = css(P.seats[S.colour(reader) % 6]); ctx.fillRect(x - s0 * 0.4, y + s0 * 0.62, s0 * 0.8, Math.max(1.5, s0 * 0.09)); }
      } else if (ch === "x") mineGlyph(ctx, P, x, y, s0 * 1.5, P.bad);
      else if (ch >= "0" && ch <= "5") {
        flagGlyph(ctx, P, x, y, s0 * 1.5, S.reader ? P.seats[S.colour(Number(ch)) % 6] : P.flag);
        if (over && !f.mine[i]) {
          ctx.strokeStyle = css(P.bad); ctx.lineWidth = Math.max(1.5, s0 * 0.14);
          ctx.beginPath(); ctx.moveTo(x - s0 * 0.6, y - s0 * 0.6); ctx.lineTo(x + s0 * 0.6, y + s0 * 0.6); ctx.stroke();
        }
      } else if (ch === "." && over && f.mine[i]) {
        if (S.end.won) flagGlyph(ctx, P, x, y, s0 * 1.5, P.brass); else mineGlyph(ctx, P, x, y, s0 * 1.5, P.ink);
      }
      if (i === f.start && ch === "." && !over) startGlyph(ctx, P, x, y, s0);
    };
    for (const i of order) {
      let ch = cs[i] || ".", sink = 0;
      const t = wave.get(i);
      if (t != null && ch === "o") {
        if (now < t) { ch = "."; moving = true; }
        else if (now < t + SINK_MS) { sink = (now - t) / SINK_MS; moving = true; }
        else wave.delete(i);
      }
      const nx = VN[3 * i], ny = VN[3 * i + 1], nz = VN[3 * i + 2];
      const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]), shade = Math.round(lit * SHADES);
      const tile = hiddenCh(ch) || sink > 0, up = tile ? lift * (1 - sink) : 0;
      raisedNow[i] = up;
      // the face on top (a tile's top, or the floor) and, for a tile, its foot, on screen; a top is turned and then
      // raised along the turned normal, which is the same as raising it first
      let area = 0, mx = 0, my = 0;
      const j0 = off[i], j1 = off[i + 1], src = tile ? FOOT : RIM, ux = up * nx, uy = up * ny, uz = up * nz;
      for (let j = j0; j < j1; j++) {
        const px = src[3 * j], py = src[3 * j + 1], pz = src[3 * j + 2];
        const X = R[0] * px + R[1] * py + R[2] * pz + ux, Y = R[3] * px + R[4] * py + R[5] * pz + uy, Z = R[6] * px + R[7] * py + R[8] * pz + uz;
        const s = D / (D - Z);
        FX[j] = cx + k * X * s; FY[j] = cy - k * Y * s;
        mx += FX[j]; my += FY[j];
        if (tile) {
          const bx = BASE[3 * j], by = BASE[3 * j + 1], bz = BASE[3 * j + 2];
          const wx = R[0] * bx + R[1] * by + R[2] * bz, wy = R[3] * bx + R[4] * by + R[5] * bz, wz = R[6] * bx + R[7] * by + R[8] * bz;
          const sb = D / (D - wz);
          BX[j] = cx + k * wx * sb; BY[j] = cy - k * wy * sb;
        }
      }
      for (let j = j0; j < j1; j++) { const jn = j + 1 < j1 ? j + 1 : j0; area += FX[j] * FY[jn] - FX[jn] * FY[j]; }
      MX[i] = mx / (j1 - j0); MY[i] = my / (j1 - j0); AREA[i] = Math.abs(area) / 2;
      if (area >= 0 && !tile) continue;                  // a floor seen from behind
      if (tile) {
        // its walls that face you and its top, as one shape in the walls' colour; then the top over it
        ctx.beginPath();
        for (let j = j0; j < j1; j++) {
          const jn = j + 1 < j1 ? j + 1 : j0;
          const wa = (BX[j] * BY[jn] - BX[jn] * BY[j]) + (BX[jn] * FY[jn] - FX[jn] * BY[jn]) + (FX[jn] * FY[j] - FX[j] * FY[jn]) + (FX[j] * BY[j] - BX[j] * FY[j]);
          if (wa >= 0) continue;
          ctx.moveTo(BX[j], BY[j]); ctx.lineTo(BX[jn], BY[jn]); ctx.lineTo(FX[jn], FY[jn]); ctx.lineTo(FX[j], FY[j]); ctx.closePath();
        }
        if (area < 0) { ctx.moveTo(FX[j0], FY[j0]); for (let j = j0 + 1; j < j1; j++) ctx.lineTo(FX[j], FY[j]); ctx.closePath(); }
        ctx.fillStyle = P.walls[Math.round(shade * 0.7)];
        ctx.fill();
        if (area < 0) {
          ctx.beginPath(); ctx.moveTo(FX[j0], FY[j0]); for (let j = j0 + 1; j < j1; j++) ctx.lineTo(FX[j], FY[j]); ctx.closePath();
          ctx.fillStyle = sink > 0 ? P.floors[shade] : P.tops[shade];
          ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = P.edgeCss; ctx.stroke();
        }
      } else {
        ctx.beginPath(); ctx.moveTo(FX[j0], FY[j0]); for (let j = j0 + 1; j < j1; j++) ctx.lineTo(FX[j], FY[j]); ctx.closePath();
        ctx.fillStyle = ch === "x" ? P.struck[Math.round(SHADES / 2 + shade / 2)] : P.floors[Math.round(SHADES / 2 + shade / 2)];
        ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = P.seamCss; ctx.stroke();
      }
      if (area < 0) glyph(i, ch);
    }

    // rings: a held number's neighbours, a hint, numbers asked for, cells pointed at (those facing you: drawn this frame)
    const shown = i => facing[i] > 0.02;
    const near = S.focus >= 0 ? f.nb[S.focus] : [];
    for (const i of near) if (shown(i)) { ring(i, 0.1); ctx.lineWidth = 2; ctx.strokeStyle = css(P.brass); ctx.stroke(); }
    if (S.hint) {
      for (const i of S.hint.from || []) if (shown(i)) { ring(i, 0.12); ctx.lineWidth = 2.5; ctx.strokeStyle = css(P.proof); ctx.stroke(); }
      for (const i of S.hint.cells || []) if (shown(i)) { ring(i, 0.12); ctx.lineWidth = 3; ctx.strokeStyle = css(S.hint.mine ? P.bad : P.good); ctx.stroke(); }
    }
    for (const a of S.asks || []) {
      if (a.cell < 0 || a.cell >= n || S.told?.[a.cell] === "1" || !shown(a.cell)) continue;
      ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = css(P.seats[S.colour(a.seat) % 6]);
      ctx.beginPath(); ctx.arc(MX[a.cell], MY[a.cell], Math.sqrt(AREA[a.cell]) * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of S.pings || []) {
      const age = (Date.now() - p.at) / 1000;
      if (age < 0 || age > 4 || p.cell < 0 || p.cell >= n) continue;
      moving = true;
      if (!shown(p.cell)) continue;
      const ph = age % 1, col = P.seats[S.colour(p.seat) % 6], r0 = Math.sqrt(AREA[p.cell]) * 0.55;
      ctx.strokeStyle = alpha(col, 1 - ph * 0.85); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(MX[p.cell], MY[p.cell], r0 * (1 + ph * 1.4), 0, Math.PI * 2); ctx.stroke();
      ring(p.cell, 0.12); ctx.lineWidth = 2.5; ctx.strokeStyle = css(col); ctx.stroke();
    }
    if (moving) draw();
  }
  /** Cell i's face as last drawn, drawn in a little (shrink: the share of the way to its middle) as a path. */
  function ring(i, shrink) {
    ctx.beginPath();
    for (let j = off[i]; j < off[i + 1]; j++) {
      const x = MX[i] + (FX[j] - MX[i]) * (1 - shrink), y = MY[i] + (FY[j] - MY[i]) * (1 - shrink);
      if (j === off[i]) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // ---------- fingers ----------
  const inPoly = (xs, ys, j0, j1, x, y) => {
    let ok = false;
    for (let j = j0, p = j1 - 1; j < j1; p = j++) {
      if ((ys[j] > y) !== (ys[p] > y) && x < ((xs[p] - xs[j]) * (y - ys[j])) / (ys[p] - ys[j]) + xs[j]) ok = !ok;
    }
    return ok;
  };
  /** The cell under a point on the page, or -1: the nearest of those drawn there (a tile's walls are its own). */
  function cellAt(clientX, clientY) {
    if (!f || !order.length) return -1;
    const r = canvas.getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top;
    for (let o = order.length - 1; o >= 0; o--) {
      const i = order[o], j0 = off[i], j1 = off[i + 1];
      if (facing[i] <= 0) continue;
      if (inPoly(FX, FY, j0, j1, x, y)) return i;
      if (raisedNow[i] > 0) {
        for (let j = j0; j < j1; j++) {
          const jn = j + 1 < j1 ? j + 1 : j0, xs = [BX[j], BX[jn], FX[jn], FX[j]], ys = [BY[j], BY[jn], FY[jn], FY[j]];
          if (inPoly(xs, ys, 0, 4, x, y)) return i;
        }
      }
    }
    // a groove between tiles: the nearest cell facing you, within a cell's reach
    let best = -1, dist = Infinity;
    for (const i of order) {
      if (facing[i] <= 0) continue;
      const d = Math.hypot(MX[i] - x, MY[i] - y);
      if (d < dist) { dist = d; best = i; }
    }
    return best >= 0 && dist <= Math.sqrt(AREA[best]) * 0.8 ? best : -1;
  }
  /** Zooms by `by` about a point on the page (a pinch's middle, the wheel's pointer): what's under it stays there. */
  function zoomAt(by, clientX, clientY) {
    if (!f) return;
    const r = canvas.getBoundingClientRect(), was = k;
    const px = Number.isFinite(clientX) ? clientX - r.left - W / 2 : 0, py = Number.isFinite(clientY) ? clientY - r.top - H / 2 : 0;
    k *= by;
    clamp();
    ox = px - (px - ox) * (k / was); oy = py - (py - oy) * (k / was);
    clamp();
    draw();
  }
  /** Between the whole solid and a thumb's size, about the middle of the box. */
  function toggleZoom() {
    if (!f) return;
    const r = canvas.getBoundingClientRect();
    zoomAt((zoomed() ? fitK() : comfortK()) / k, r.left + W / 2, r.top + H / 2);
  }
  /** The view to keep: the zoom against a thumb's size, the turn, and the slide as a share of the solid's reach. */
  const view = () => ({ z: Math.round((k / comfortK()) * 1000) / 1000, q: q.map(x => Math.round(x * 1e5) / 1e5),
    x: Math.round((ox / reach()) * 1000) / 1000, y: Math.round((oy / reach()) * 1000) / 1000 });

  // the theme or the night changes: the palette again
  const repaint = () => { P = null; draw(); };
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", repaint);
  document.fonts?.ready?.then(repaint);

  /** No field: the stage empty. */
  function clear() { f = null; B = null; spin = null; turn = null; wave.clear(); order = []; draw(); }
  /** Where cell i's face is on the page (for the tests' fingers): its middle, whether it's in the box and facing you, and fair to tap. */
  function where(i) {
    const r = canvas.getBoundingClientRect(), m = measure(i);
    return { x: r.left + m.x, y: r.top + m.y, inside: m.facing > 0 && m.x >= 0 && m.x <= W && m.y >= 0 && m.y <= H, facing: m.facing, fair: fair(i) };
  }

  return {
    canvas, solid: true, setField, set, clear, draw, cellAt, where, zoomAt, panBy, shiftBy, toggleZoom, view, reveal, repaint,
    grab, release, face, fair,
    get larger() { return !!f && larger(); }, get zoomed() { return !!f && zoomed(); },
    get moving() { return !!(spin || turn); },
    get paintMs() { return paintMs; },
    set settled(fn) { settled = fn; },
    label(text) { canvas.setAttribute("aria-label", text); },
  };
}
