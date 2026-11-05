// Survey flat (Settings' 2D mode, battery saver; where there is no WebGL): the block cut into layers, drawn on a plain canvas.
// n slices of n by n cubes, one for each layer z, and one more, "depth", that holds the readings of the rows running through
// the layers. A row along x has its reading at the left of its line in its layer, a row along y at the top of its column, and a
// row through the layers (z) in the depth slice at its x and y. Same rules and same input as survey-3d.js (this file answers
// the same calls: set, update, pick, focus, halo, ...), so survey.js works either; the readings are the same plates of the page.
import { linesOf, coordsOf, cellAt } from "./survey-engine.js";
import { skinNow } from "./survey-skin.js";
import { plateOf, plateShape, plateText } from "./survey-plate.js";

const GAP = 0.55;                 // between slices, in cubes
const MAX_ZOOM = 4, PAD = 0.3;    // the zoom; the edge round the whole, in cubes
const CHIP_MS = 240, STRIKE_MS = 420, MARK_MS = 180;
const calm = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ---------- where things are (pure: tests/survey-flat.mjs) ----------
const FIT = 0.95;                 // a plate (a plain one is 0.86 of a cube) may use this much of the room it is given, so two never touch
/**
 * The slices on a W by H screen: n layers and one more, the depth slice, in the grid of columns that makes the cubes largest.
 * A layer has a margin on the left (the plates of its x rows) and on the top (those of its y rows); the depth slice holds the
 * plates of the rows through the layers, one in each cube's place. `wide` says how wide the widest plate of each kind is, in
 * cubes ({ x, y, z }, 1 for a number or two): a wider plate gets a wider left margin, the top plates stagger in 2 or 3 tiers
 * (every other column's one higher), and the depth slice's squares are widened. { u (a cube's side, px), tiers, at: [{ x, y, w, h,
 * mw (left margin), mh (top margin), cw (a square's width) }], x0, y0, x1, y1 (the whole) }.
 */
export function layoutOf(n, W, H, wide = {}) {
  const tiers = Math.min(3, Math.max(1, Math.ceil((wide.y || 1) / FIT - 1e-6)));
  const mw = Math.max(1, (wide.x || 1) / FIT), dw = Math.max(1, (wide.z || 1) / FIT);
  const sizes = Array.from({ length: n + 1 }, (_, k) => (k < n ? { w: mw + n, h: tiers + n, mw, mh: tiers, cw: 1 } : { w: 1 + n * dw, h: 1 + n, mw: 1, mh: 1, cw: dw }));
  let best = null;
  for (let cols = 1; cols <= n + 1; cols++) {
    const rows = Math.ceil((n + 1) / cols), colW = Array(cols).fill(0), rowH = Array(rows).fill(0);
    sizes.forEach((s, k) => { colW[k % cols] = Math.max(colW[k % cols], s.w); rowH[Math.floor(k / cols)] = Math.max(rowH[Math.floor(k / cols)], s.h); });
    const w = colW.reduce((a, b) => a + b, 0) + (cols - 1) * GAP + 2 * PAD, h = rowH.reduce((a, b) => a + b, 0) + (rows - 1) * GAP + 2 * PAD;
    const u = Math.min(W / w, H / h);
    if (!best || u > best.u + 1e-9) best = { u, cols, rows, w, h, colW, rowH };
  }
  const { u, cols, w, h, colW, rowH } = best;
  const ox = (W - w * u) / 2 + PAD * u, oy = (H - h * u) / 2 + PAD * u;
  const colX = colW.map((_, c) => colW.slice(0, c).reduce((a, b) => a + b + GAP, 0)), rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((a, b) => a + b + GAP, 0));
  const at = sizes.map((s, k) => ({ ...s, x: ox + colX[k % cols] * u, y: oy + rowY[Math.floor(k / cols)] * u }));
  return { n, u, cols, tiers, at, x0: ox - PAD * u, y0: oy - PAD * u, x1: ox - PAD * u + w * u, y1: oy - PAD * u + h * u };
}
/** The box of the cube (x, y) in slice k; y counts up from the bottom row, as in the 3D block. */
export function cubeBox(L, k, x, y) {
  const a = L.at[k];
  return { x: a.x + (a.mw + x * a.cw) * L.u, y: a.y + (a.mh + L.n - 1 - y) * L.u, w: a.cw * L.u, h: L.u };
}
/** What a point (in the layout's own pixels) is on: { k (slice), x, y } for a cube's square, or null. Slice n is the depth one. */
export function squareAt(L, px, py) {
  const { n, u } = L;
  for (let k = 0; k <= n; k++) {
    const a = L.at[k], x = Math.floor((px - a.x - a.mw * u) / (a.cw * u)), row = Math.floor((py - a.y - a.mh * u) / u);
    if (px >= a.x + a.mw * u && py >= a.y + a.mh * u && x >= 0 && x < n && row >= 0 && row < n) return { k, x, y: n - 1 - row };
  }
  return null;
}
/** The cube number a point picks, given which cubes are still in the block: only the layers pick, never the depth slice. */
export function cubeAt(L, px, py, inBlock) {
  const s = squareAt(L, px, py);
  if (!s || s.k >= L.n) return -1;
  const i = cellAt(L.n, s.x, s.y, s.k);
  return inBlock(i) ? i : -1;
}
/** Where a row's plate sits (its middle, layout pixels): at the left of the line (x rows), above the column (y rows; in a tier) or in the depth slice (z rows). */
export function plateAt(L, ln) {
  const { u } = L, { a, u: p, v: q } = ln;
  if (a === 0) { const b = cubeBox(L, q, 0, p), s = L.at[q]; return [s.x + (s.mw * u) / 2, b.y + u / 2]; }
  if (a === 1) { const b = cubeBox(L, p, q, 0), s = L.at[p]; return [b.x + u / 2, s.y + (s.mh - 1 - (q % L.tiers) + 0.5) * u]; }
  const b = cubeBox(L, L.n, p, q);
  return [b.x + b.w / 2, b.y + u / 2];
}
/** The slices and cubes a row lights: every cube of it, and for a row through the layers the depth slice's square too. */
export function rowSquares(n, ln) {
  const out = ln.cells.map(c => { const [x, y, z] = coordsOf(n, c); return { k: z, x, y }; });
  if (ln.a === 2) out.push({ k: n, x: ln.u, y: ln.v });
  return out;
}

// ---------- the view ----------
export function createFlat(host) {
  const canvas = document.createElement("canvas"), labels = document.createElement("div"), ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas");
  canvas.className = "sv-gl"; labels.className = "sv-labels flat";
  host.replaceChildren(canvas, labels);
  let P = null, R = null, n = 0, st = new Int8Array(0), mk = new Uint8Array(0), left = new Int16Array(0), lab = [];
  let W = 1, H = 1, L = null, wide = {}, zoom = 1, tx = 0, ty = 0, skin = skinNow();
  let focusCell = -1, focusUntil = 0, haloCell = -1, haloUntil = 0, hintRows = [], hot = new Set();
  const anims = new Map();      // cube -> { kind, t0 }
  let onView = null, frameId = 0;
  const hex = c => `#${c.toString(16).padStart(6, "0")}`;
  const lines = () => linesOf(n);

  // the layout's pixels -> the screen's (zoom and slide), and back
  const toScreen = (x, y) => [x * zoom + tx, y * zoom + ty];
  const toLayout = (x, y) => [(x - tx) / zoom, (y - ty) / zoom];
  /** Keeps the whole in reach: centred while it fits, else not slid past its edges. */
  function clamp() {
    if (!L) return;
    const fit = (lo, hi, size, t) => ((hi - lo) * zoom <= size ? size / 2 - ((lo + hi) / 2) * zoom : Math.min(-lo * zoom + size * 0.08, Math.max(size - hi * zoom - size * 0.08, t)));
    tx = fit(L.x0, L.x1, W, tx); ty = fit(L.y0, L.y1, H, ty);
  }
  function resize() {
    const r = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (n) { L = layoutOf(n, W, H, wide); clamp(); placeLabels(); }
    invalidate();
  }

  // ---------- the block ----------
  function set(puzzle, run) {
    P = puzzle; R = run; n = puzzle.n;
    anims.clear(); hot = new Set(); focusCell = haloCell = -1; hintRows = []; haloUntil = 0;
    st = new Int8Array(n ** 3).fill(-1); mk = new Uint8Array(n ** 3);
    left = new Int16Array(3 * n * n);
    lab = buildLabels();
    wide = measure();
    L = layoutOf(n, W, H, wide); zoom = 1; tx = ty = 0; clamp();
    update(false);
    viewChanged();
  }
  function buildLabels() {
    labels.replaceChildren();
    return lines().map((ln, k) => {
      if (!ln.cells.some(c => P.present[c])) return { ln, none: true };                               // no rock along this row: no plate
      const cl = P.clues[k], el = document.createElement("div");
      const shape = plateShape(P, cl);
      el.className = `sv-lab${shape}`;
      el.style.visibility = "hidden";
      if (shape === " two") el.innerHTML = plateOf(P, cl.t, ln.a); else el.textContent = plateText(P, cl);
      labels.append(el);
      return { el, ln, shape, x: -1e9, y: -1e9, o: -1, cls: "" };
    });
  }
  /** How wide the widest plate of each direction is, in cubes (a runs plate or one with two ores is wider than a cube): each is set to a known size and measured. */
  function measure() {
    const out = { x: 1, y: 1, z: 1 }, ref = 100, names = ["x", "y", "z"];
    for (const l of lab) if (!l.none) l.el.style.setProperty("--b", `${ref * 0.86}px`);
    for (const l of lab) if (!l.none) out[names[l.ln.a]] = Math.max(out[names[l.ln.a]], l.el.offsetWidth / ref);
    for (const l of lab) if (!l.none) l.el.style.removeProperty("--b");
    return out;
  }
  /** What a cube is in the run now: 0 rock, 1 gone, 2 ore shown (at the end, every cube left is), 3 granite. */
  const stateOf = (i, gone, shown) => (!P.present[i] ? 1 : P.hard?.[i] ? 3 : gone.has(i) ? 1 : R.done || shown.has(i) ? 2 : 0);
  function update(animate = true) {
    if (!P) return;
    const gone = new Set(R.gone), shown = new Set(R.shown), marked = new Set(R.marked), now = performance.now(), first = st[0] === -1;
    let order = 0;
    for (let i = 0; i < n ** 3; i++) {
      const s = stateOf(i, gone, shown), m = s === 0 && marked.has(i) ? 1 : 0;
      if (animate && !first && !calm()) {
        if (s !== st[i] && s === 1) anims.set(i, { kind: "chip", t0: now + order++ * 45, was: st[i] });
        else if (s !== st[i] && s === 2) anims.set(i, { kind: "strike", t0: now });
        else if (m && !mk[i]) anims.set(i, { kind: "mark", t0: now });
      }
      st[i] = s; mk[i] = m;
    }
    lab.forEach((l, k) => { left[k] = l.ln.cells.reduce((t, c) => t + (st[c] === 1 || st[c] === 3 ? 0 : 1), 0); });
    placeLabels();
    invalidate();
  }
  /** Whether a cube has a side to the open air. */
  function exposedNow(i) {
    const [x, y, z] = coordsOf(n, i);
    return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(d => {
      const a = x + d[0], b = y + d[1], c = z + d[2];
      return a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n || st[cellAt(n, a, b, c)] === 1;
    });
  }

  // ---------- the readings over the canvas ----------
  function placeLabels() {
    if (!P || !L) return;
    labels.style.setProperty("--cell", `${(L.u * zoom).toFixed(1)}px`);
    const rowsAll = lines();
    for (let k = 0; k < lab.length; k++) {
      const l = lab[k];
      if (l.none) continue;
      const [x, y] = toScreen(...plateAt(L, rowsAll[k]));
      const empty = left[k] === 0, done = !empty && left[k] === P.clues[k]?.c, on = hot.has(k);
      const o = empty ? 0 : done && !on ? 0.4 : 1, cls = `sv-lab${l.shape}${done ? " done" : ""}${on ? " hot" : ""}`;
      if (Math.abs(x - l.x) > 0.15 || Math.abs(y - l.y) > 0.15) { l.x = x; l.y = y; l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`; }
      if (Math.abs(o - l.o) > 0.01) { l.o = o; l.el.style.opacity = o.toFixed(2); l.el.style.visibility = "visible"; }
      if (cls !== l.cls) { l.cls = cls; l.el.className = cls; }
    }
  }

  // ---------- drawing ----------
  const ease = t => t * t * (3 - 2 * t);
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (!P || !L) return;
    ctx.save();
    ctx.translate(tx, ty); ctx.scale(zoom, zoom);
    const u = L.u, rock = hex(skin.rock), brass = skin.brass != null ? hex(skin.brass) : "#c39a3e", ink = skin.night ? "#e9e3d4" : "#2a2a28";
    const lit = new Set(), litRows = lines();
    for (const k of hot) for (const s of rowSquares(n, litRows[k])) lit.add(s.k * n * n + s.y * n + s.x);
    ctx.font = `800 ${u * 0.42}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k <= n; k++) {
      const o = L.at[k], past = P.cut?.axis === 2 && k < n && k >= P.cut.at;                         // the far side of a fault through the layers
      ctx.strokeStyle = past ? brass : skin.night ? "rgba(233,227,212,.28)" : "rgba(42,42,40,.28)";
      ctx.lineWidth = past ? 2 : 1;
      ctx.strokeRect(o.x + o.mw * u - u * 0.08, o.y + o.mh * u - u * 0.08, u * (n * o.cw + 0.16), u * (n + 0.16));
      ctx.fillStyle = skin.night ? "rgba(233,227,212,.5)" : "rgba(42,42,40,.5)";
      ctx.fillText(k < n ? String(k + 1) : "↓", o.x + (o.mw * u) / 2, o.y + (o.mh - 0.5) * u);   // the layer's number; the depth slice's arrow
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const b = cubeBox(L, k, x, y);
        if (k === n) { ctx.fillStyle = skin.night ? "rgba(233,227,212,.07)" : "rgba(42,42,40,.06)"; ctx.fillRect(b.x + u * 0.06, b.y + u * 0.06, b.w - u * 0.12, u * 0.88); if (lit.has(k * n * n + y * n + x)) shade(b, b.w, brass, 0.3); continue; }
        const i = cellAt(n, x, y, k);
        cube(i, b, u, now, rock, brass, ink);
        if (lit.has(k * n * n + y * n + x)) shade(b, u, brass, 0.32);
      }
    }
    if (P.cut && P.cut.axis < 2) {                                                                 // a fault through a layer: a brass line between the two sides
      ctx.strokeStyle = brass; ctx.lineWidth = 2.5;
      for (let k = 0; k < n; k++) {
        const o = L.at[k]; ctx.beginPath();
        if (P.cut.axis === 0) { const x = o.x + (o.mw + P.cut.at) * u; ctx.moveTo(x, o.y + (o.mh - 0.1) * u); ctx.lineTo(x, o.y + (o.mh + n + 0.1) * u); }
        else { const y = o.y + (o.mh + n - P.cut.at) * u; ctx.moveTo(o.x + (o.mw - 0.1) * u, y); ctx.lineTo(o.x + (o.mw + n + 0.1) * u, y); }
        ctx.stroke();
      }
    }
    const f = haloCell >= 0 && st[haloCell] !== 1 && exposedNow(haloCell) ? haloCell : -1, mark = focusCell >= 0 ? focusCell : f;
    if (mark >= 0) {                                                                               // the cube pressed, or a hint's: ringed in every slice it shows in
      const [x, y, z] = coordsOf(n, mark), b = cubeBox(L, z, x, y);
      ctx.strokeStyle = brass; ctx.lineWidth = 3; ctx.strokeRect(b.x + 1.5, b.y + 1.5, u - 3, u - 3);
      const d = cubeBox(L, n, x, y); ctx.lineWidth = 2; ctx.strokeRect(d.x + 2, d.y + 2, d.w - 4, u - 4);
    }
    ctx.restore();
  }
  const shade = (b, w, color, a) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(b.x, b.y, w, b.h); ctx.globalAlpha = 1; };
  function cube(i, b, u, now, rock, brass, ink) {
    const s = st[i];
    const an = anims.get(i);
    let sc = 1, glow = 0;
    if (an) {
      const t = (now - an.t0) / ({ chip: CHIP_MS, strike: STRIKE_MS, mark: MARK_MS }[an.kind]);
      if (t >= 0) {
        if (an.kind === "chip") sc = Math.max(0, 1 - ease(Math.min(1, t)));
        else if (an.kind === "strike") { sc = 1 + 0.18 * Math.sin(Math.PI * Math.min(1, t)); glow = Math.sin(Math.PI * Math.min(1, t)); }
        else sc = 1 + 0.1 * Math.sin(Math.PI * Math.min(1, t));
      } else if (an.kind === "chip") sc = 1;
    }
    if (!P.present[i]) return;
    const gone = s === 1 && !(an?.kind === "chip" && sc > 0);
    const pad = u * 0.06;
    if (gone) {                                                                                    // a hollow where a cube was
      ctx.fillStyle = skin.night ? "rgba(0,0,0,.28)" : "rgba(60,48,30,.12)";
      round(b.x + pad, b.y + pad, u - 2 * pad, u - 2 * pad, u * 0.12); ctx.fill();
      return;
    }
    const m = (u - 2 * pad) * sc, cx = b.x + u / 2, cy = b.y + u / 2, x = cx - m / 2, y = cy - m / 2;
    const ore = s === 2, silver = ore && P.ores === 2 && !P.gold[i];
    ctx.fillStyle = s === 3 ? skin.granite : ore ? (silver ? skin.silver : skin.ore) : rock;
    round(x, y, m, m, u * 0.12); ctx.fill();
    if (glow) { ctx.globalAlpha = glow * 0.5; ctx.fillStyle = "#fff"; ctx.fill(); ctx.globalAlpha = 1; }
    if (s === 0) {
      if (P.lamps?.includes(i)) { ctx.globalAlpha = 0.7; ctx.fillStyle = skin.lamp; ctx.fill(); ctx.globalAlpha = 1; }
      if (!exposedNow(i)) { ctx.fillStyle = skin.night ? "rgba(8,12,18,.52)" : "rgba(40,30,16,.36)"; ctx.fill(); }   // covered: not yet within reach
      else { ctx.strokeStyle = skin.night ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.55)"; ctx.lineWidth = Math.max(1, u * 0.06); ctx.stroke(); }
      if (mk[i]) {
        ctx.globalAlpha = 0.62; ctx.fillStyle = skin.mark; round(x, y, m, m, u * 0.12); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff8e6"; ctx.beginPath(); const r = u * 0.2; ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
      }
    } else if (s === 3) {
      ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(x + m * 0.2, y + m * 0.8); ctx.lineTo(x + m * 0.8, y + m * 0.2); ctx.moveTo(x + m * 0.2, y + m * 0.5); ctx.lineTo(x + m * 0.5, y + m * 0.2); ctx.stroke();
    } else if (ore) {
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = Math.max(1, u * 0.06); round(x, y, m, m, u * 0.12); ctx.stroke();
    }
  }
  function round(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function invalidate() { if (!frameId) frameId = requestAnimationFrame(frame); }
  function frame() {
    frameId = 0;
    const now = performance.now();
    if (focusUntil && now > focusUntil) { focusUntil = 0; focus(-1); }
    if (haloUntil && now > haloUntil) { haloUntil = 0; haloCell = -1; hintRows = []; relight(); placeLabels(); }
    for (const [i, a] of anims) if (now - a.t0 > Math.max(CHIP_MS, STRIKE_MS, MARK_MS)) anims.delete(i);
    draw(now);
    if (anims.size || focusUntil || haloUntil) frameId = requestAnimationFrame(frame);
  }

  // ---------- looking at it ----------
  const clientToLayout = (cx, cy) => { const r = canvas.getBoundingClientRect(); return toLayout(cx - r.left, cy - r.top); };
  /** The cube under a point of the screen (client coordinates), or -1: a cube still in the block, in its layer. */
  function pick(cx, cy) { return P && L ? cubeAt(L, ...clientToLayout(cx, cy), i => st[i] !== 1 && P.present[i]) : -1; }
  const rowsOf = i => { const c = coordsOf(n, i); return [0, 1, 2].map(a => a * n * n + c[(a + 1) % 3] * n + c[(a + 2) % 3]); };
  function relight() { hot = new Set([...(focusCell >= 0 ? rowsOf(focusCell) : []), ...hintRows]); }
  function focus(i, ms = 0) {
    focusCell = i;
    focusUntil = i >= 0 && ms ? performance.now() + ms : 0;
    relight(); placeLabels(); invalidate();
  }
  function haloAt(i, rows = []) {
    haloCell = i; hintRows = rows;
    haloUntil = i >= 0 || rows.length ? performance.now() + 9000 : 0;
    relight(); placeLabels(); invalidate();
  }
  // the person's hands: a finger slides it, two fingers (or the wheel) zoom
  const viewChanged = () => onView?.([zoom, tx, ty]);
  function zoomBy(f, cx, cy) {
    if (!L) return;
    const r = canvas.getBoundingClientRect(), z = Math.min(MAX_ZOOM, Math.max(1, zoom * f)), k = z / zoom, ax = cx - r.left, ay = cy - r.top;
    tx = ax - (ax - tx) * k; ty = ay - (ay - ty) * k; zoom = z;
    clamp(); placeLabels(); invalidate(); viewChanged();
  }
  function pan(dx, dy) { tx += dx; ty += dy; clamp(); placeLabels(); invalidate(); viewChanged(); }
  function reset() { zoom = 1; tx = ty = 0; clamp(); placeLabels(); invalidate(); viewChanged(); }
  function applySkin() { skin = skinNow(); invalidate(); }
  /** Where a cube is on the page (client coordinates). */
  function where(i) {
    const [x, y, z] = coordsOf(n, i), b = cubeBox(L, z, x, y), [sx, sy] = toScreen(b.x + L.u / 2, b.y + L.u / 2), r = canvas.getBoundingClientRect();
    return [sx + r.left, sy + r.top];
  }

  const sizeWatch = new ResizeObserver(resize), skinWatch = new MutationObserver(applySkin), mq = matchMedia("(prefers-color-scheme: dark)");
  sizeWatch.observe(host);
  skinWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  mq.addEventListener?.("change", applySkin);
  resize();

  function dispose() { cancelAnimationFrame(frameId); frameId = -1; sizeWatch.disconnect(); skinWatch.disconnect(); mq.removeEventListener?.("change", applySkin); }

  return {
    dispose, flat: true, canvas, set, update, pick, focus, halo: haloAt, zoomBy, pan, reset, where,
    set onView(fn) { onView = fn; },
    get away() { return zoom > 1.001; },
    coasting: false,
    grab: () => false, release() {}, orbit() {}, setView() {}, spin() {},
    redraw: invalidate,
    /** Whether a cube can be seen from here: every cube in a layer is, but a covered one is not within reach. */
    visible(i) { return st[i] !== 1 && P.present[i] && exposedNow(i); },
    get skin() { return skin; },
    get live() { return { anims: anims.size, shards: 0, hot: [...hot], halo: haloCell, cellPx: L ? L.u * zoom : 0 }; },
    size: () => [W, H],
    get layout() { return L; },
  };
}
