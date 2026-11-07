// Lode's board as a planet (Korbi, 7 Nov 2026: "like the 3d cube minesweeper: in space, squares but rounded so appearance is
// spherical, a planet"). The same 48 letters, the same touching (a letter touches the ones the flat board says it does, so every
// word is the same path), drawn by hand on one canvas, no library, so it works offline and on an iPhone: each letter a rounded
// tile standing a little off a small sea-blue planet, in space, sunlit from the upper left. The board is laid on the planet the
// way a map is laid round its middle, an azimuthal one (K degrees of sky a cell, so tiles stay square-ish and shrink only as they
// near the edge); the far side is open sea, so a finger that starts off the letters turns the planet and one that starts on a
// letter traces, as on the flat board (lode-trace.js). Two fingers zoom, a double tap puts it back (camera-kit.js).
// It answers what the flat view (lode-board.js) answers: set, freeze, clear, trace, path.
import { CELLS, geometry } from "./lode-engine.js";
import { centres, extent, coord } from "./lode-board.js";
import { createTracer } from "./lode-trace.js";
import { bindOrbit } from "./camera-kit.js";

const K = 14 * Math.PI / 180;           // radians of sky a cell
const D = 4.6, FIT = D;                 // the camera's distance in planet radii, and the distance that frames the planet whole
const LIFT = 0.04;                      // a tile stands this high above the sea (planet radii)
const HOME = { yaw: 0, pitch: 0, dist: FIT };
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const SUN = norm([-0.55, 0.6, 0.62]);   // in the view's frame (x right, y up, z to you): the light stays put as the planet turns
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const TILE = { plain: [236, 226, 202], theme: [128, 198, 188], span: [246, 200, 90], shown: [192, 190, 206], sealed: [96, 104, 128], picked: [140, 224, 255] };
const SLOTS = [[224, 122, 95], [61, 153, 112], [224, 184, 74], [122, 162, 227], [181, 141, 224], [224, 122, 168]];   // a team's words, in their finders' colours (the flat board's --p0..5)
const INK = [27, 36, 48], SHADE = [16, 22, 46];

/** A polygon with its corners cut twice (Chaikin): a square comes out rounded, a hexagon too. */
const rounded = poly => {
  for (let k = 0; k < 2; k++) {
    const out = [];
    poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); });
    poly = out;
  }
  return poly;
};
const OUTLINE = {
  square: rounded([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(p => p.map(x => x * 0.46))),
  hex: rounded(Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30), r = 0.96 / Math.sqrt(3); return [r * Math.cos(a), r * Math.sin(a)]; })),
};
/** The unit vector on the planet for a point of the board, in cells from its middle (v grows down the board, y up the sky). */
const sky = (u, v) => {
  const rho = Math.hypot(u, v), r = rho * K;
  return rho < 1e-9 ? [0, 0, 1] : [u * Math.sin(r) / rho, -v * Math.sin(r) / rho, Math.cos(r)];
};
const STARS = (() => { let s = 7; const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); return Array.from({ length: 90 }, () => [next(), next(), 0.4 + next() * 1.1, 0.25 + next() * 0.6]); })();

export function createPlanetView(host, { onTrace = () => {}, onSubmit = () => {}, usable = () => true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "lo-planet";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The letters, on a planet");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let board = null, geo = null, shape = "square", cells = [], view = {}, path = [], owner = [];
  let cam = { ...HOME };
  let W = 1, H = 1, dpr = 1, raf = 0, shown = true, font = "sans-serif";
  const at = Array.from({ length: CELLS }, () => ({ x: 0, y: 0, eux: 0, euy: 0, evx: 0, evy: 0, z: -1 }));   // per cell, the last frame: its middle and its two sides on screen, how squarely it faces you

  // ---------- the board's cells, on the planet (worked out once a board's shape) ----------
  function lay(sh) {
    shape = sh;
    const [w, h] = extent(sh), pts = centres(sh), out = OUTLINE[sh];
    cells = pts.map(([x, y]) => {
      const u = x - w / 2, v = y - h / 2;
      return { c: sky(u, v), eu: sky(u + 0.25, v), ev: sky(u, v + 0.25), ring: out.map(([a, b]) => sky(u + a, v + b)) };
    });
  }

  // ---------- what the board shows ----------
  function recolour() {
    owner = new Array(CELLS).fill(null);
    for (const f of view.found || []) for (const c of board.words[f.w].cells) owner[c] = { kind: f.kind, slot: f.slot };
  }
  function set(b, v = {}) {
    const fresh = !board || board.letters !== b.letters || board.shape !== b.shape;
    board = b; view = v;
    if (fresh) { geo = geometry(b.shape); lay(b.shape === "hex" ? "hex" : "square"); finger.reset(); }
    recolour();
    schedule();
  }

  // ---------- the frame ----------
  const turned = () => {
    const th = -cam.yaw, ph = cam.pitch, cy = Math.cos(th), sy = Math.sin(th), cx = Math.cos(ph), sx = Math.sin(ph);
    return p => { const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy; return [x, p[1] * cx - z * sx, p[1] * sx + z * cx]; };
  };
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    font = getComputedStyle(canvas).fontFamily || "sans-serif";
  }
  function schedule() { if (!raf && shown) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

  function draw() {
    if (!shown) return;
    resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H / 2, zoom = FIT / cam.dist;
    const s0 = 0.47 * Math.min(W, H) * Math.sqrt(D * D - 1) / D, s = s0 * zoom, R = s * D / Math.sqrt(D * D - 1);   // px of a planet radius at its middle, and the silhouette's
    const rot = turned();
    const proj = p => { const f = s * D / (D - p[2]); return [cx + p[0] * f, cy - p[1] * f]; };
    // space
    const sp = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) / 2);
    sp.addColorStop(0, "#0d1530"); sp.addColorStop(1, "#04060f");
    ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, a] of STARS) { ctx.globalAlpha = a; ctx.fillStyle = "#dfe8ff"; ctx.beginPath(); ctx.arc(x * W, y * H, r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // the planet: a glow, then the sea, lit from the sun's side
    const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.16);
    glow.addColorStop(0, "rgba(110,170,255,.38)"); glow.addColorStop(1, "rgba(110,170,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, 7); ctx.fill();
    const sea = ctx.createRadialGradient(cx + R * SUN[0] * 0.45, cy - R * SUN[1] * 0.45, R * 0.05, cx, cy, R * 1.05);
    sea.addColorStop(0, "#3c78ab"); sea.addColorStop(0.55, "#1a3a66"); sea.addColorStop(1, "#080e22");
    ctx.fillStyle = sea; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    // a graticule on the sea, so a turn shows
    ctx.strokeStyle = "rgba(170,205,255,.13)"; ctx.lineWidth = 1;
    const line = f => { ctx.beginPath(); let pen = false; for (let t = 0; t <= 72; t++) { const p = rot(f(t / 72)); if (p[2] < 0.02) { pen = false; continue; } const [x, y] = proj(p); if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; } ctx.stroke(); };
    for (let lat = -60; lat <= 60; lat += 20) { const a = lat * Math.PI / 180; line(t => [Math.cos(a) * Math.sin(t * 2 * Math.PI), Math.sin(a), Math.cos(a) * Math.cos(t * 2 * Math.PI)]); }
    for (let lon = 0; lon < 180; lon += 20) { const b = lon * Math.PI / 180; line(t => { const a = t * 2 * Math.PI; return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; }); }
    if (!board) return;

    // each cell: where its middle and sides are on screen, and how squarely it faces you
    const up = 1 + LIFT, scr = (p, r = up) => proj(rot(p.map(x => x * r)));
    const order = [];
    cells.forEach((cell, i) => {
      const c = rot(cell.c), a = at[i];
      a.z = c[2];
      if (c[2] < -0.12) return;
      const [x, y] = scr(cell.c), [ux, uy] = scr(cell.eu), [vx, vy] = scr(cell.ev);
      a.x = x; a.y = y; a.eux = (ux - x) * 4; a.euy = (uy - y) * 4; a.evx = (vx - x) * 4; a.evy = (vy - y) * 4;
      order.push(i);
    });
    order.sort((p, q) => at[p].z - at[q].z);
    const lit = n => Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
    const shade = (base, l) => rgb(mix(mix(base, SHADE, 0.65), base, 0.22 + 0.78 * Math.pow(l, 0.8)));
    const tint = i => {
      if (path.includes(i)) return TILE.picked;
      const o = owner[i];
      if (o) return o.slot != null ? SLOTS[o.slot % SLOTS.length] : TILE[o.kind] || TILE.theme;
      return view.sealed?.[i] ? TILE.sealed : TILE.plain;
    };
    const outline = (cell, r) => cell.ring.map(p => scr(p, r));
    const trace = pts => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

    // the tiles, back to front: a dark foot on the sea, the top lit across its curve
    for (const i of order) {
      const cell = cells[i], base = tint(i);
      trace(outline(cell, 1)); ctx.fillStyle = "rgba(4,8,22,.85)"; ctx.fill();
      const top = outline(cell, up), ls = cell.ring.map(p => lit(rot(p)));
      let hi = 0, lo = 0;
      ls.forEach((l, k) => { if (l > ls[hi]) hi = k; if (l < ls[lo]) lo = k; });
      trace(top);
      if (hi !== lo) { const g = ctx.createLinearGradient(top[hi][0], top[hi][1], top[lo][0], top[lo][1]); g.addColorStop(0, shade(base, ls[hi])); g.addColorStop(1, shade(base, ls[lo])); ctx.fillStyle = g; } else ctx.fillStyle = shade(base, ls[hi]);
      ctx.fill();
      ctx.strokeStyle = "rgba(8,12,30,.6)"; ctx.lineWidth = 1; ctx.stroke();
    }
    // the others' traces and your own, over the tiles but under the letters
    const through = (cs, colour, w, dash) => {
      ctx.strokeStyle = colour; ctx.lineWidth = w; ctx.lineCap = ctx.lineJoin = "round"; ctx.setLineDash(dash);
      ctx.beginPath(); let pen = false;
      for (const c of cs) { if (at[c].z < 0.05) { pen = false; continue; } if (pen) ctx.lineTo(at[c].x, at[c].y); else ctx.moveTo(at[c].x, at[c].y); pen = true; }
      ctx.stroke(); ctx.setLineDash([]);
    };
    for (const o of view.others || []) {
      const colour = rgb(SLOTS[o.slot % SLOTS.length]);
      through(o.cells, colour, 3, [6, 5]);
      for (const c of o.cells) if (at[c].z > 0.05) { trace(outline(cells[c], up)); ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.stroke(); }
    }
    if (path.length > 1) through(path, "rgba(190,240,255,.85)", 5, []);
    const hint = view.hint && board.words[view.hint.w];
    if (hint) for (const c of hint.cells) if (at[c].z > 0.05) { trace(outline(cells[c], up)); ctx.strokeStyle = "#fff4c2"; ctx.lineWidth = 3; ctx.stroke(); }

    // the letters, lying in each tile's own surface
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const i of order) {
      const a = at[i];
      ctx.save();
      ctx.transform(a.eux / 40, a.euy / 40, a.evx / 40, a.evy / 40, a.x, a.y);
      ctx.fillStyle = rgb(INK);
      if (view.sealed?.[i] && !owner[i]) { ctx.fillStyle = "rgba(226,232,246,.85)"; ctx.font = `700 8px ${font}`; ctx.fillText(coord(i), 0, 0); }
      else { ctx.font = `750 21px ${font}`; ctx.fillText(board.letters[i], 0, 1); }
      if (hint && view.hint.step === 2) { const k = hint.cells.indexOf(i); if (k >= 0) { ctx.font = `800 9px ${font}`; ctx.fillStyle = "#8a5a00"; ctx.fillText(String(k + 1), 14, -12); } }
      ctx.restore();
    }
    for (const o of view.others || []) {
      const c = o.cells[o.cells.length - 1];
      if (c == null || at[c].z < 0.05) continue;
      ctx.fillStyle = rgb(SLOTS[o.slot % SLOTS.length]); ctx.beginPath(); ctx.arc(at[c].x + 9, at[c].y + 9, 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#0b1020"; ctx.font = `800 9px ${font}`; ctx.fillText((Array.from(String(o.name || "?"))[0] || "?").toUpperCase(), at[c].x + 9, at[c].y + 9.5);
    }
  }

  // ---------- the finger: a letter under it traces, the open sea turns the planet ----------
  /** The letter whose tile a point is over, within `reach` (in cells, measured on the tile's own surface, so a tile seen slantwise isn't harder to hit), or -1. */
  function pick(q, reach) {
    let best = -1, d = reach;
    for (let i = 0; i < CELLS; i++) {
      const a = at[i];
      if (a.z < 0.2) continue;
      const det = a.eux * a.evy - a.euy * a.evx;
      if (Math.abs(det) < 1e-3) continue;
      const dx = q.x - a.x, dy = q.y - a.y, m = Math.hypot((dx * a.evy - dy * a.evx) / det, (a.eux * dy - a.euy * dx) / det);
      if (m < d) { d = m; best = i; }
    }
    return best;
  }
  const finger = createTracer({ touch: () => geo.touch, pick, usable, step: 5, changed: p => { path = p; schedule(); }, onTrace, onSubmit });
  let active = null, tracing = false, travel = 0, last = null, onLetter = false;
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0 || !board) return;
    if (active != null) return;                                     // a second finger zooms, it never traces
    active = e.pointerId; travel = 0; last = local(e);
    const q = local(e), c = pick(q, 0.55);
    onLetter = c >= 0 && usable(c);
    tracing = onLetter && finger.down(q, e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (e.pointerId !== active) return;
    const q = local(e);
    travel += Math.abs(q.x - last.x) + Math.abs(q.y - last.y); last = q;
    if (tracing) finger.move(q, e.pointerId);
  });
  const lift = cancelled => e => {
    if (e.pointerId !== active) return;
    active = null;
    if (tracing) finger.up(e.pointerId, cancelled);
    else if (!cancelled && travel < 6) finger.clear();              // a tap on the sea clears; a turn doesn't
    tracing = false;
  };
  canvas.addEventListener("pointerup", lift(false));
  canvas.addEventListener("pointercancel", lift(true));
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  bindOrbit(canvas, {
    get: () => cam, fit: () => FIT, pitch: [-1.25, 1.25], zoom: [0.45, 1.1],
    set: v => { if (tracing) return; cam = v; schedule(); },
    reset: () => { if (onLetter) return; cam = { ...HOME }; schedule(); },   // a double tap on a letter is the word being submitted, not a wish to go home
  });
  if (typeof ResizeObserver === "function") new ResizeObserver(() => schedule()).observe(host);

  return {
    set, draw: schedule, frame: draw, clear: finger.clear,
    get path() { return finger.path; },
    freeze: finger.freeze,
    trace: finger.set,
    /** Shown or not (the flat board is the other). */
    show(on) { shown = !!on; canvas.style.display = on ? "" : "none"; if (on) schedule(); },
    get camera() { return { ...cam }; },
    /** Where a cell's middle is on the last frame, and whether it faces you (tests). */
    where: i => ({ ...at[i] }),
    pick,
  };
}
