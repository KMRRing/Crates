// Lode's board as a planet, drawn the way Mines draws its cube (mines-3d.js; Korbi, 7 Nov 2026: "exactly like the minesweeper one":
// it turns without limit in any direction, the letters always face you, no gaps between letters and sphere, and it isn't a smooth
// ball: a cube of 54 squares, each a raised tile with walls, on a dark body). The board is Mines' cube (lode-engine.js's
// geometry("cube"): six faces of 3×3 squares, a letter touching those it shares a corner with, round the edges too). Tiles are
// lit as Mines' are (sun from the upper left, earthshine from the lower right, stars behind), by hand on one canvas: no library,
// so it works offline and on an iPhone. Their tints are a world's (the sea, the land, the sand and the ice), and a word's state.
// A finger that starts on a letter traces, as on the flat board (lode-trace.js); one that starts on the open space turns the
// planet as a trackball, and a flick spins it on; two fingers zoom and slide it, a double tap puts it back.
// It answers what the flat view (lode-board.js) answers: set, freeze, clear, trace, path, show.
import { geometry } from "./lode-engine.js";
import { createTracer } from "./lode-trace.js";

// ---------- turns: quaternions [w, x, y, z], from the cube's own frame to the view's (x right, y up, z to you), as Mines' ----------
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
const qaxis = (a, t) => { const s = Math.sin(t / 2); return [Math.cos(t / 2), a[0] * s, a[1] * s, a[2] * s]; };
const matrix = ([w, x, y, z]) => [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
  2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
  2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
const turned = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
/** The least turn taking unit vector u onto unit vector v. */
function between(u, v) {
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  if (d > 1 - 1e-9) return [1, 0, 0, 0];
  if (d < -1 + 1e-9) return qaxis(Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], Math.PI);
  const a = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...a);
  return qaxis([a[0] / l, a[1] / l, a[2] / l], Math.acos(d));
}

const D = 4;                                  // the eye's distance from the middle, in the planet's radius: a gentle perspective
const RAISE = 0.15, GAP = 0.06, BEVEL = 0.1;  // as Mines' cube: a tile stands this many cells up; its foot is inset by GAP, its top by BEVEL more
const MOST = 2.2;                             // the most it zooms in, times the whole planet's size
const LEAST = 0.5;                            // the most it zooms out: half the fitted size, the planet small in the middle (Korbi, 8 November 2026: "scroll out more")
const SPIN_MS = 420;                          // how fast a flick's spin dies away (its time constant)
const GLYPH = 0.8;                            // a letter's size over its tile's size on screen
const TAP_MS = 320, TAP_PX = 6;               // a double tap: two short, still touches this close in time
const unitOf = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const SUN = unitOf([-0.5, 0.5, 0.7]), EARTH = unitOf([0.62, -0.42, 0.66]);
const EARTHSTEPS = 5, SHADES = 16;
// a cube's face turned to you is seen a little from above (16°) and from the right (20°), so the faces there show too
const TILT = qmul(qaxis([0, 1, 0], -20 * Math.PI / 180), qaxis([1, 0, 0], 16 * Math.PI / 180));
const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const SHADOW = [34, 38, 52], EARTHLIGHT = [96, 138, 214], SUNLIGHT = [255, 244, 224];
/** A table of colours for a base, by sunlight and earthshine (Mines'), indexed shade * (EARTHSTEPS + 1) + earth. */
function lighting(base, ambient) {
  const out = [];
  for (let sh = 0; sh <= SHADES; sh++) for (let e = 0; e <= EARTHSTEPS; e++) {
    const lit = Math.pow(sh / SHADES, 0.85), earth = e / EARTHSTEPS;
    const dark = mix(mix(base, SHADOW, 0.62), EARTHLIGHT, 0.2 * earth);
    const day = mix(mix(base, SUNLIGHT, 0.12 * lit), EARTHLIGHT, 0.05 * earth);
    out.push(css(mix(dark, day, Math.min(1, ambient + (1 - ambient) * lit))));
  }
  return out;
}
const tables = new Map();
const tablesFor = base => {
  const key = base.join();
  if (!tables.has(key)) tables.set(key, { tops: lighting(base, 0.3), walls: lighting(mix(base, [0, 0, 0], 0.42), 0.18) });
  return tables.get(key);
};

// a tile's own colour: the world's, then the state of its word. Pale, so the letters read; a found word's is stronger.
const WORLD = { sea: [150, 188, 216], land: [182, 202, 150], sand: [214, 196, 150], ice: [226, 234, 244] };
const TILE = { theme: [96, 190, 170], span: [246, 196, 70], shown: [186, 184, 204], sealed: [96, 104, 128], picked: [140, 224, 255] };
const SLOTS = [[224, 122, 95], [61, 153, 112], [224, 184, 74], [122, 162, 227], [181, 141, 224], [224, 122, 168]];   // a team's words, in their finders' colours (the flat board's --p0..5)
const INK = "#1b2430", HALO = "rgba(250,247,238,.75)", CORE = "rgb(12,14,22)";
/** A cell's name where a team's sealed letter asks for it: its face (A to F) and its place on the face, 1 to 9. */
export const coordOf = i => `${"ABCDEF"[Math.floor(i / 9)]}${(i % 9) + 1}`;

export function createPlanetView(host, { onTrace = () => {}, onSubmit = () => {}, usable = () => true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "lo-planet";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The letters, on a planet");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  const geo = geometry("cube"), B = geo.solid, n = geo.n;
  let board = null, view = {}, path = [], owner = [];
  let W = 1, H = 1, dpr = 1, raf = 0, shown = true, font = "sans-serif", sky = null;
  let k = 1, q = [1, 0, 0, 0], ox = 0, oy = 0;   // the zoom (px a planet radius at its middle's depth), how it is turned, and where its middle is from the box's
  let spin = null, frame = 0;                    // a flick's spin { axis, w (rad a ms), at }
  const drags = [];                              // the last moves of a drag, for a flick's speed

  // ---------- the cells, in flat arrays (worked out once) ----------
  const off = new Int32Array(n + 1);
  B.cells.forEach((c, i) => { off[i + 1] = off[i] + c.pts.length; });
  const m = off[n];
  const C = new Float64Array(3 * n), N = new Float64Array(3 * n), U = new Float64Array(3 * n);
  const BASE = new Float64Array(3 * m), FOOT = new Float64Array(3 * m);
  const tint = new Array(n);
  B.cells.forEach((cell, i) => {
    for (let a = 0; a < 3; a++) { C[3 * i + a] = cell.c[a]; N[3 * i + a] = cell.nrm[a]; U[3 * i + a] = cell.u ? cell.u[a] : 0; }
    cell.pts.forEach((p, j) => {
      for (let a = 0; a < 3; a++) {
        BASE[3 * (off[i] + j) + a] = cell.c[a] + (p[a] - cell.c[a]) * (1 - GAP);
        FOOT[3 * (off[i] + j) + a] = cell.c[a] + (p[a] - cell.c[a]) * (1 - GAP - BEVEL);
      }
    });
    // the world's tint, by a smooth turbulence of where the cell lies, ice at the poles
    const c = cell.c, w = Math.sin(c[0] * 3.1 + 1.3) * Math.cos(c[1] * 2.7 + 0.4) + Math.sin(c[2] * 4.1 - 0.7) * 0.8 + Math.sin(c[0] * 5.3 + c[1] * 3.3) * 0.4;
    tint[i] = Math.abs(c[1]) > 0.8 ? WORLD.ice : w > 0.55 ? WORLD.sand : w > -0.15 ? WORLD.land : WORLD.sea;
  });
  const lift = RAISE * B.size;
  const VC = new Float64Array(3 * n), VN = new Float64Array(3 * n), facing = new Float64Array(n);
  const FX = new Float32Array(m), FY = new Float32Array(m), BX = new Float32Array(m), BY = new Float32Array(m);
  const MX = new Float32Array(n), MY = new Float32Array(n), AREA = new Float32Array(n);
  let order = [];

  // ---------- the view: how large, and how turned ----------
  const outer = 1 + lift;
  const fitK = () => Math.max(1, (Math.min(W, H) / 2 - 4) * Math.sqrt(D * D - outer * outer) / (outer * D));
  const reach = (kk = k) => kk * outer * D / Math.sqrt(D * D - outer * outer);
  function clamp() {
    k = Math.min(fitK() * MOST, Math.max(fitK() * LEAST, k));
    const rx = Math.max(0, reach() - W / 2 + 6), ry = Math.max(0, reach() - H / 2 + 6);
    ox = Math.min(rx, Math.max(-rx, ox)); oy = Math.min(ry, Math.max(-ry, oy));
  }
  /** The turn that brings cell i to face you, its face squared up to the screen and tipped a little (TILT), so the faces beside it show. */
  function facingTurn(i) {
    const nv = [N[3 * i], N[3 * i + 1], N[3 * i + 2]];
    let t = between(nv, [0, 0, 1]);
    const u = turned(matrix(t), [U[3 * i], U[3 * i + 1], U[3 * i + 2]]);
    const ang = Math.atan2(u[1], u[0]), snap = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
    t = qmul(TILT, qmul(qaxis([0, 0, 1], snap - ang), t));
    return qnorm(t);
  }
  const HOME = () => facingTurn(4);              // the middle of the first face
  q = HOME();
  function home() { spin = null; q = HOME(); k = fitK(); ox = 0; oy = 0; clamp(); schedule(); }

  function resize() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), was = k / Math.max(1e-6, fitK());
    if (w !== W || h !== H || !canvas.width) {
      W = w; H = h;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      sky = null;
      k = was * fitK(); clamp();
    }
    font = getComputedStyle(canvas).fontFamily || "sans-serif";
  }
  const schedule = () => { if (!raf && shown) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

  // ---------- what the board shows ----------
  function recolour() {
    owner = new Array(n).fill(null);
    for (const f of view.found || []) for (const c of board.words[f.w].cells) owner[c] = { kind: f.kind, slot: f.slot };
  }
  function set(b, v = {}) {
    const fresh = !board || board.letters !== b.letters;
    board = b; view = v;
    if (fresh) { finger.reset(); if (!board) return; }
    recolour();
    schedule();
  }
  const baseOf = i => {
    if (path.includes(i)) return TILE.picked;
    const o = owner[i];
    if (o) return o.slot != null ? SLOTS[o.slot % SLOTS.length] : TILE[o.kind] || TILE.theme;
    return view.sealed?.[i] ? TILE.sealed : tint[i];
  };

  // ---------- the sky: stars, a haze of sunlight, the Earth (drawn once a size and kept), as Mines' ----------
  function paintSky() {
    sky = document.createElement("canvas");
    sky.width = canvas.width; sky.height = canvas.height;
    const g = sky.getContext("2d");
    g.scale(dpr, dpr);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0A0E1C"); bg.addColorStop(1, "#04060C");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const haze = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H) * 0.9);
    haze.addColorStop(0, "rgba(255,236,200,.16)"); haze.addColorStop(1, "rgba(255,236,200,0)");
    g.fillStyle = haze; g.fillRect(0, 0, W, H);
    let a = 0x2F6A9C1;
    const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0, cnt = Math.round(W * H / 1900); i < cnt; i++) {
      const x = rnd() * W, y = rnd() * H, big = rnd() < 0.08, r = big ? 0.9 + rnd() * 0.6 : 0.35 + rnd() * 0.5, t = rnd();
      g.fillStyle = `rgba(${t < 0.2 ? "255,214,180" : t > 0.8 ? "180,206,255" : "240,242,250"},${(big ? 0.9 : 0.35 + rnd() * 0.5).toFixed(2)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const er = Math.min(W, H) * 0.05, ex = W * 0.87, ey = H * 0.92;
    const globe = g.createRadialGradient(ex - er * 0.35, ey - er * 0.4, er * 0.1, ex, ey, er);
    globe.addColorStop(0, "#9CC8FF"); globe.addColorStop(0.55, "#3C74C8"); globe.addColorStop(1, "#16336A");
    g.fillStyle = globe; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
    const glow = g.createRadialGradient(ex, ey, er, ex, ey, er * 2.4);
    glow.addColorStop(0, "rgba(110,160,255,.28)"); glow.addColorStop(1, "rgba(110,160,255,0)");
    g.fillStyle = glow; g.beginPath(); g.arc(ex, ey, er * 2.4, 0, Math.PI * 2); g.fill();
  }

  // ---------- drawing ----------
  /** Moves the turn on to `now`: a flick's spin dying away. True while still moving. */
  function advance(now) {
    if (!spin) return false;
    const dt = Math.min(64, now - spin.at);
    spin.at = now;
    q = qnorm(qmul(qaxis(spin.axis, spin.w * dt), q));
    spin.w *= Math.exp(-dt / SPIN_MS);
    if (spin.w < 0.00015) spin = null;
    return !!spin;
  }
  function draw() {
    if (!shown) return;
    raf = 0;
    resize();
    let moving = advance(performance.now());
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!sky) paintSky();
    ctx.drawImage(sky, 0, 0, W, H);
    if (!board) return;
    const R = matrix(q), cx = W / 2 + ox, cy = H / 2 + oy;

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

    // the body, seen in the grooves round the tiles: the outlines of those facing you, all wound one way so they add up
    ctx.fillStyle = CORE;
    ctx.beginPath();
    for (const i of order) {
      if (facing[i] <= 0) continue;
      B.cells[i].pts.forEach((p, j) => {
        const s = D / (D - (R[6] * p[0] + R[7] * p[1] + R[8] * p[2]));
        const x = cx + k * (R[0] * p[0] + R[1] * p[1] + R[2] * p[2]) * s, y = cy - k * (R[3] * p[0] + R[4] * p[1] + R[5] * p[2]) * s;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill("nonzero");

    // the tiles, back to front: every one stands up from the body, its walls that face you, then its top
    ctx.lineJoin = "round";
    const faceUp = new Uint8Array(n);
    for (const i of order) {
      const nx = VN[3 * i], ny = VN[3 * i + 1], nz = VN[3 * i + 2];
      const lit = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]), earthLit = Math.max(0, nx * EARTH[0] + ny * EARTH[1] + nz * EARTH[2]);
      const shadeAt = Math.min(SHADES, Math.max(0, Math.round(lit * SHADES)));
      const shade = shadeAt * (EARTHSTEPS + 1) + Math.round(Math.min(1, earthLit) * EARTHSTEPS);
      const T = tablesFor(baseOf(i));
      let area = 0, mx = 0, my = 0;
      const j0 = off[i], j1 = off[i + 1], ux = lift * nx, uy = lift * ny, uz = lift * nz;
      for (let j = j0; j < j1; j++) {
        const px = FOOT[3 * j], py = FOOT[3 * j + 1], pz = FOOT[3 * j + 2];
        const X = R[0] * px + R[1] * py + R[2] * pz + ux, Y = R[3] * px + R[4] * py + R[5] * pz + uy, Z = R[6] * px + R[7] * py + R[8] * pz + uz;
        const s = D / (D - Z);
        FX[j] = cx + k * X * s; FY[j] = cy - k * Y * s;
        mx += FX[j]; my += FY[j];
        const bx = BASE[3 * j], by = BASE[3 * j + 1], bz = BASE[3 * j + 2];
        const wx = R[0] * bx + R[1] * by + R[2] * bz, wy = R[3] * bx + R[4] * by + R[5] * bz, wz = R[6] * bx + R[7] * by + R[8] * bz;
        const sb = D / (D - wz);
        BX[j] = cx + k * wx * sb; BY[j] = cy - k * wy * sb;
      }
      for (let j = j0; j < j1; j++) { const jn = j + 1 < j1 ? j + 1 : j0; area += FX[j] * FY[jn] - FX[jn] * FY[j]; }
      MX[i] = mx / (j1 - j0); MY[i] = my / (j1 - j0); AREA[i] = Math.abs(area) / 2;
      ctx.beginPath();
      for (let j = j0; j < j1; j++) {
        const jn = j + 1 < j1 ? j + 1 : j0;
        const wa = (BX[j] * BY[jn] - BX[jn] * BY[j]) + (BX[jn] * FY[jn] - FX[jn] * BY[jn]) + (FX[jn] * FY[j] - FX[j] * FY[jn]) + (FX[j] * BY[j] - BX[j] * FY[j]);
        if (wa >= 0) continue;
        ctx.moveTo(BX[j], BY[j]); ctx.lineTo(BX[jn], BY[jn]); ctx.lineTo(FX[jn], FY[jn]); ctx.lineTo(FX[j], FY[j]); ctx.closePath();
      }
      if (area < 0) { ctx.moveTo(FX[j0], FY[j0]); for (let j = j0 + 1; j < j1; j++) ctx.lineTo(FX[j], FY[j]); ctx.closePath(); }
      ctx.fillStyle = T.walls[shade];
      ctx.fill();
      if (area < 0) {
        faceUp[i] = 1;
        ctx.beginPath(); ctx.moveTo(FX[j0], FY[j0]); for (let j = j0 + 1; j < j1; j++) ctx.lineTo(FX[j], FY[j]); ctx.closePath();
        ctx.fillStyle = T.tops[shade];
        ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(14,16,24,.55)"; ctx.stroke();
      }
    }

    // the limb: the planet darkens towards its rim, so it reads as a ball
    const lr = reach();
    const limb = ctx.createRadialGradient(cx, cy, lr * 0.55, cx, cy, lr);
    limb.addColorStop(0, "rgba(4,6,12,0)"); limb.addColorStop(1, "rgba(4,6,12,.5)");
    ctx.fillStyle = limb; ctx.beginPath(); ctx.arc(cx, cy, lr, 0, Math.PI * 2); ctx.fill();

    // the others' traces and your own, over the tiles but under the letters
    const seen = i => facing[i] > 0.05 && faceUp[i];
    const through = (cs, colour, w, dash) => {
      ctx.strokeStyle = colour; ctx.lineWidth = w; ctx.lineCap = ctx.lineJoin = "round"; ctx.setLineDash(dash);
      ctx.beginPath(); let pen = false;
      for (const c of cs) { if (!seen(c)) { pen = false; continue; } if (pen) ctx.lineTo(MX[c], MY[c]); else ctx.moveTo(MX[c], MY[c]); pen = true; }
      ctx.stroke(); ctx.setLineDash([]);
    };
    const ring = (i, shrink) => {
      ctx.beginPath();
      for (let j = off[i]; j < off[i + 1]; j++) {
        const x = MX[i] + (FX[j] - MX[i]) * (1 - shrink), y = MY[i] + (FY[j] - MY[i]) * (1 - shrink);
        if (j === off[i]) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    for (const o of view.others || []) {
      const colour = css(SLOTS[o.slot % SLOTS.length]);
      through(o.cells, colour, 3, [6, 5]);
      for (const c of o.cells) if (seen(c)) { ring(c, 0.08); ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.stroke(); }
    }
    if (path.length > 1) through(path, "rgba(190,240,255,.85)", 5, []);
    const hint = view.hint && board.words[view.hint.w];
    if (hint) for (const c of hint.cells) if (seen(c)) { ring(c, 0.08); ctx.strokeStyle = "#fff4c2"; ctx.lineWidth = 3; ctx.stroke(); }

    // the letters: upright on the screen whichever way the planet turns, so they always read
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    const put = (text, x, y, px, bold = 800) => {
      ctx.font = `${bold} 100px ${font}`;
      ctx.setTransform(dpr * px / 100, 0, 0, dpr * px / 100, dpr * x, dpr * y);
      ctx.lineWidth = 12; ctx.strokeStyle = HALO; ctx.strokeText(text, 0, 0);
      ctx.fillStyle = INK; ctx.fillText(text, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    for (const i of order) {
      if (!faceUp[i] || facing[i] < 0.15) continue;      // a tile seen nearly edge-on is a sliver: no letter on it
      const size = Math.sqrt(AREA[i]);
      if (view.sealed?.[i] && !owner[i]) {
        ctx.fillStyle = "rgba(226,232,246,.9)"; ctx.font = `700 100px ${font}`;
        ctx.setTransform(dpr * size * 0.3 / 100, 0, 0, dpr * size * 0.3 / 100, dpr * MX[i], dpr * MY[i]);
        ctx.fillText(coordOf(i), 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        continue;
      }
      put(board.letters[i], MX[i], MY[i] + size * 0.04, size * GLYPH);
      if (hint && view.hint.step === 2) { const idx = hint.cells.indexOf(i); if (idx >= 0) put(String(idx + 1), MX[i] + size * 0.32, MY[i] - size * 0.32, size * 0.26); }
    }
    for (const o of view.others || []) {
      const c = o.cells[o.cells.length - 1];
      if (c == null || !seen(c)) continue;
      const size = Math.sqrt(AREA[c]);
      ctx.fillStyle = css(SLOTS[o.slot % SLOTS.length]); ctx.beginPath(); ctx.arc(MX[c] + size * 0.3, MY[c] + size * 0.3, 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#0b1020"; ctx.font = `800 9px ${font}`; ctx.fillText((Array.from(String(o.name || "?"))[0] || "?").toUpperCase(), MX[c] + size * 0.3, MY[c] + size * 0.3 + 0.5);
    }
    if (moving) schedule();
  }

  // ---------- the finger: a letter under it traces, the open space turns the planet ----------
  /** The letter whose tile a point is over, within `reach` (in tiles, from its middle, as the tile is seen), or -1. */
  function pick(p, reachCells) {
    let best = -1, d = reachCells;
    for (const i of order) {
      if (facing[i] < 0.2) continue;
      const m = Math.hypot(p.x - MX[i], p.y - MY[i]) / Math.max(1, Math.sqrt(AREA[i]));
      if (m < d) { d = m; best = i; }
    }
    return best;
  }
  const finger = createTracer({ touch: () => geo.touch, pick, usable, step: 5, changed: p => { path = p; schedule(); }, onTrace, onSubmit });
  const follow = () => k * B.front * D / (D - B.front);       // how far the surface facing you moves on screen for a turn of one radian
  function panBy(dx, dy) {
    const d = Math.hypot(dx, dy);
    if (!d) return;
    spin = null;
    q = qnorm(qmul(qaxis([dy / d, dx / d, 0], d / follow()), q));
    const now = performance.now();
    drags.push({ t: now, dx, dy });
    while (drags.length && now - drags[0].t > 100) drags.shift();
    schedule();
  }
  function flick() {
    const now = performance.now(), recent = drags.filter(mv => now - mv.t < 80);
    drags.length = 0;
    if (recent.length < 2) return;
    const dx = recent.reduce((s, mv) => s + mv.dx, 0), dy = recent.reduce((s, mv) => s + mv.dy, 0);
    const ms = Math.max(16, now - recent[0].t), speed = Math.hypot(dx, dy) / ms;
    if (speed < 0.25 || still()) return;
    const d = Math.hypot(dx, dy);
    spin = { axis: [dy / d, dx / d, 0], w: speed / follow(), at: now };
    schedule();
  }
  /** Zooms by `by` about a point of the box: what's under it stays there. */
  function zoomAt(by, px = 0, py = 0) {
    const was = k;
    k *= by; clamp();
    ox = px - (px - ox) * (k / was); oy = py - (py - oy) * (k / was);
    clamp(); schedule();
  }

  const pts = new Map();                                      // the fingers down: id -> { x, y }
  let tracing = false, onLetter = false, travel = 0, pinch = null, tapAt = 0;
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0 || !board) return;
    canvas.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size === 2) {                                     // a second finger zooms; it never traces
      if (tracing) { finger.up([...pts.keys()][0], true); tracing = false; }
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (pts.size > 2) return;
    spin = null; drags.length = 0; travel = 0;
    const c = pick(p, 0.55);
    onLetter = c >= 0 && usable(c);
    tracing = onLetter && finger.down(p, e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    const was = pts.get(e.pointerId);
    if (!was) return;
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.d > 0 && d > 0) zoomAt(d / pinch.d, mx - W / 2, my - H / 2);
      ox += mx - pinch.mx; oy += my - pinch.my; clamp();
      pinch = { d, mx, my };
      schedule();
      return;
    }
    if (pts.size !== 1) return;
    travel += Math.abs(p.x - was.x) + Math.abs(p.y - was.y);
    if (tracing) finger.move(p, e.pointerId);
    else panBy(p.x - was.x, p.y - was.y);
  });
  const lift_ = cancelled => e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; return; }
    if (tracing) { finger.up(e.pointerId, cancelled); tracing = false; return; }
    if (cancelled) return;
    if (travel < TAP_PX) {                                     // a tap on the open space clears the trace; two put the planet back
      finger.clear();
      const now = Date.now();
      if (now - tapAt < TAP_MS) { tapAt = 0; home(); } else tapAt = now;
    } else flick();
  };
  canvas.addEventListener("pointerup", lift_(false));
  canvas.addEventListener("pointercancel", lift_(true));
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0014), e.clientX - r.left - W / 2, e.clientY - r.top - H / 2);
  }, { passive: false });
  if (typeof ResizeObserver === "function") new ResizeObserver(() => schedule()).observe(host);

  return {
    set, draw: schedule, frame: draw, clear: finger.clear,
    get path() { return finger.path; },
    freeze: finger.freeze,
    trace: finger.set,
    /** Shown or not (the flat board is the other). */
    show(on) { shown = !!on; canvas.style.display = on ? "" : "none"; if (on) schedule(); },
    get camera() { return { q: [...q], zoom: k / fitK(), x: ox, y: oy }; },
    /** Turns the planet by a drag of (dx, dy) px, as a finger on the open space would (tests). */
    turnBy: panBy,
    /** Where a cell's middle is on the last frame, and how squarely it faces you; `z` is that, `up` whether its top is drawn (tests). */
    where: i => ({ x: MX[i], y: MY[i], z: facing[i], size: Math.sqrt(AREA[i]), up: facing[i] > 0 }),
    pick,
  };
}
