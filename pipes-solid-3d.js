// Pipes on a solid: the drawing (November 2026). The solid is drawn on a 2D canvas with an orthographic camera: for a convex
// solid the faces the eye can see never overlap, so there is nothing to sort, no depth buffer and no WebGL to lose. Each
// tile is drawn in its own "art" square, the same 60 units as the flat Puzzle's (centre 30,30, the tile's inradius 30, art
// "up" towards its side 0), through the 2×3 matrix that carries that square onto the screen. The unfolded net draws the
// same tiles through other matrices. Colours are the page's (--pi-*, pipes.css and themes.css).
// Top level touches no DOM: tests/pipes-solid.mjs checks the geometry in Node.
import { chans, basis, halves, unfold, cross, dot } from "./pipes-solid.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => mul(a, 1 / len(a));

// ---------- the art square ----------
export const C = 30;
/** The direction of side s on an n-sided tile in the art square (y down): side 0 up, then counter-clockwise (left, for a square). */
export const dirOf = (n, s) => [-Math.sin(2 * Math.PI * s / n), -Math.cos(2 * Math.PI * s / n)];
/** The middle of side s in the art square. */
export const artMid = (n, s) => { const [x, y] = dirOf(n, s); return [C + C * x, C + C * y]; };
/** The corner between side s and the next, at inradius g. */
export const artCorner = (n, s, g = C) => {
  const th = 2 * Math.PI * (s + .5) / n, r = g / Math.cos(Math.PI / n);
  return [C - r * Math.sin(th), C - r * Math.cos(th)];
};
const f2 = x => Math.round(x * 100) / 100;
const pc = ([x, y]) => `${f2(x)} ${f2(y)}`;

const pathCache = new Map();
/** An SVG path string for a channel of an n-sided tile from side a to side b (a < 0: from the middle): a straight line across, a
 *  quarter-ish arc round the corner two next sides share (as the flat Puzzle's bend), or a smooth curve past the middle for sides
 *  one apart (a pentagon's easy bend). Every one meets a side's middle square on to it, so pipes join across edges. */
export function chanD(n, a, b) {
  const id = `${n}:${a}:${b}`;
  if (pathCache.has(id)) return pathCache.get(id);
  const B = artMid(n, b);
  let d;
  if (a < 0) d = `M${C} ${C}L${pc(B)}`;
  else {
    const A = artMid(n, a), gap = ((b - a) % n + n) % n;
    if (gap * 2 === n) d = `M${pc(A)}L${pc(B)}`;
    else if (gap === 1 || gap === n - 1) {
      const v = artCorner(n, gap === 1 ? a : b), r = C * Math.tan(Math.PI / n);
      const sweep = (A[0] - v[0]) * (B[1] - v[1]) - (A[1] - v[1]) * (B[0] - v[0]) > 0 ? 1 : 0;
      d = `M${pc(A)}A${f2(r)} ${f2(r)} 0 0 ${sweep} ${pc(B)}`;
    } else {
      const k = .4, p1 = [C + (A[0] - C) * k, C + (A[1] - C) * k], p2 = [C + (B[0] - C) * k, C + (B[1] - C) * k];
      d = `M${pc(A)}C${pc(p1)} ${pc(p2)} ${pc(B)}`;
    }
  }
  pathCache.set(id, d);
  return d;
}
/** The tile's ground as a path, inset to inradius g. */
export const groundD = (n, g = 28) => `${Array.from({ length: n }, (_, s) => `${s ? "L" : "M"}${pc(artCorner(n, s, g))}`).join("")}Z`;
/** Where a stud on a channel goes: its middle. */
export function chanMid(n, a, b) {
  const A = artMid(n, a), B = artMid(n, b), gap = ((b - a) % n + n) % n;
  if (gap * 2 === n) return [C, C];
  if (gap === 1 || gap === n - 1) {
    const v = artCorner(n, gap === 1 ? a : b), m = [(A[0] + B[0]) / 2 - v[0], (A[1] + B[1]) / 2 - v[1]], r = C * Math.tan(Math.PI / n), k = r / Math.hypot(m[0], m[1]);
    return [v[0] + m[0] * k, v[1] + m[1] * k];
  }
  return [C + ((A[0] + B[0]) / 2 - C) * .5, C + ((A[1] + B[1]) / 2 - C) * .5];
}

// ---------- where the art square lands ----------
/** A tile's art square in 3D: a point (x, y) of it is c + (x - 30) * ex + (y - 30) * ey. */
export function artFrame(T) {
  const e0 = unit(sub(T.mids[0], T.c)), k = len(sub(T.mids[0], T.c)) / C;
  return { c: T.c, ex: mul(cross(e0, T.N), k), ey: mul(e0, -k) };
}
/** The solid's tile t drawn for a camera on a canvas of w × h css pixels: the matrix [a, b, c, d, e, f] of its art square, or
 *  null if turned away from the eye. */
export function solidMatrix(T, cam, w, h) {
  const { d, r, u } = basis(cam.yaw, cam.pitch);
  if (dot(T.N, d) <= 1e-6) return null;
  const { hx, hy } = halves(cam.aspect, cam.zoom), F = artFrame(T);
  const lin = v => [dot(v, r) / hx * w / 2, -dot(v, u) / hy * h / 2];
  const X = lin(F.ex), Y = lin(F.ey), P = [(dot(F.c, r) / hx + 1) * w / 2, (1 - dot(F.c, u) / hy) * h / 2];
  return [X[0], X[1], Y[0], Y[1], P[0] - C * X[0] - C * Y[0], P[1] - C * X[1] - C * Y[1]];
}
/** The net's tile drawn so the whole net fits a canvas of w × h css pixels: [matrix, polygon in pixels] per tile, plus the net. */
export function netLayout(S, w, h, pad = 14) {
  const N = unfold(S), sc = Math.min((w - 2 * pad) / N.w, (h - 2 * pad) / N.h);
  const ox = (w - N.w * sc) / 2, oy = (h - N.h * sc) / 2;
  const px = p => [(p[0] - N.minX) * sc + ox, (N.minY + N.h - p[1]) * sc + oy];
  const tiles = N.tiles.map(t => {
    const c = t.c, m = t.mids[0], dx = m[0] - c[0], dy = m[1] - c[1], l = Math.hypot(dx, dy), d0x = dx / l, d0y = dy / l, P = px(c);
    const X = [d0y * sc, d0x * sc], Y = [-d0x * sc, d0y * sc];
    return { m: [X[0], X[1], Y[0], Y[1], P[0] - C * X[0] - C * Y[0], P[1] - C * X[1] - C * Y[1]], poly: t.poly.map(px) };
  });
  return { tiles, faces: N.faces.map(f => f.poly.map(px)), cuts: N.cuts.map(k => ({ at: px(k.at), out: [k.out[0], -k.out[1]], pair: k.pair })) };
}
/** Applies a tile matrix to a point of the art square. */
export const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** The pixel scale of a matrix: how many pixels an art unit is, on average (the icons that stand upright use it). */
export const scaleOf = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

const inside = (poly, [x, y]) => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], z = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (z) { if (sign && Math.sign(z) !== sign) return false; sign = Math.sign(z); }
  }
  return true;
};
/** The tile under a point of the net (pixels), or -1. */
export function netPick(layout, x, y) {
  return layout.tiles.findIndex(t => inside(t.poly, [x, y]));
}

// ---------- the colours ----------
const COLOURS = { ground: "--pi-ground", tile: "--pi-tile", edge: "--pi-tile-edge", pipe: "--pi-pipe", dark: "--pi-pipe-dark", rock: "--pi-rock",
  accent: "--pi-in", good: "--pi-good", bad: "--pi-bad", oil: "--pi-oil", brass: "--brass", ink: "--ink-soft" };
let palette = null, paletteAt = 0;
/** The page's colours as the canvas can take them (a custom property is resolved by an element's own `color`). Read again after a
 *  moment, so a change of theme or of day and night shows. */
export function paletteOf(host) {
  const now = Date.now();
  if (palette && now - paletteAt < 400) return palette;
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";
  host.append(probe);
  palette = {};
  for (const [k, v] of Object.entries(COLOURS)) { probe.style.color = ""; probe.style.color = `var(${v})`; palette[k] = getComputedStyle(probe).color; }
  probe.remove();
  paletteAt = now;
  return palette;
}
export const forgetPalette = () => { palette = null; };

// ---------- drawing a tile ----------
const strokeD = (ctx, d, colour, width, dash = null) => {
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  ctx.stroke(new Path2D(d));
};
/** A channel's pipe along a path: its dark edge, the brass and a shine; a crossing's upright channel first lays a strip of ground. */
function pipeAlong(ctx, d, P, { bridge = false, old = false } = {}) {
  ctx.lineCap = "butt";
  if (bridge) strokeD(ctx, d, P.ground, 26);
  strokeD(ctx, d, old ? P.ground : P.dark, 22);
  strokeD(ctx, d, old ? P.dark : P.pipe, 16);
  if (!old) { ctx.globalAlpha = .28; strokeD(ctx, d, "#fff", 4); ctx.globalAlpha = 1; }
}
/** A piece of an n-sided tile as pipe. */
export function pipePiece(ctx, n, piece, P, old = false) {
  const cs = chans(n, piece), order = piece[0] === "x" ? [1, 0] : cs.map((_, i) => i);
  for (const i of order) pipeAlong(ctx, chanD(n, cs[i][0], cs[i][1]), P, { bridge: piece[0] === "x" && i === 0, old });
}

let icons = null;                                    // Path2D is the browser's: made when first drawn, so Node can load this file
const iconPaths = () => icons || (icons = { derrick: new Path2D("M18 46 L30 12 L42 46 M22 35 H38 M25 24 H35"), flag: new Path2D("M40 18 V6 L50 9 L40 12"), roof: new Path2D("M13 26 Q30 15 47 26"),
  tank: new Path2D("M17 22H43A4 4 0 0 1 47 26V44A4 4 0 0 1 43 48H17A4 4 0 0 1 13 44V26A4 4 0 0 1 17 22Z") });

/**
 * Draws one tile. t: { n, m (the matrix), dpr, shade (0..1 darkening), cell (the level's cell or null), piece, oil: [{a, b}…] (the
 * channels with oil in them), stub (oil in the wellhead's or the terminal's stub), stake: { n, state }, route, feed ([{a, b}]: the
 * oil's way from each end), ring ("" | "next" | "out"), spill (the oil is stopped here), hint ("wrong": a piece in the way), ghost (a hint's piece) }.
 */
export function paintTile(ctx, t, P) {
  const { n, m, dpr } = t, put = (mm = m) => ctx.setTransform(mm[0] * dpr, mm[1] * dpr, mm[2] * dpr, mm[3] * dpr, mm[4] * dpr, mm[5] * dpr);
  const rock = t.cell?.k === "rock";
  put();
  ctx.lineJoin = "round";
  ctx.fillStyle = rock ? P.rock : P.tile;
  ctx.strokeStyle = P.edge; ctx.lineWidth = 1; ctx.setLineDash([]);
  const ground = new Path2D(groundD(n));
  ctx.fill(ground); ctx.stroke(ground);
  if (rock) {
    ctx.fillStyle = P.edge;
    for (const [cx, cy, r] of [[20, 24, 9], [38, 36, 11], [24, 42, 6]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
  } else {
    const k = t.cell?.k;
    if (k === "source" || k === "terminal") {
      pipeAlong(ctx, chanD(n, -1, t.cell.d), P);
      if (t.stub) strokeD(ctx, chanD(n, -1, t.cell.d), P.oil, 9);
    } else if (t.piece) {
      pipePiece(ctx, n, t.piece, P, k === "old");
      for (const o of t.oil || []) strokeD(ctx, chanD(n, o.a, o.b), P.oil, 9);
    }
    if (t.ghost) { ctx.globalAlpha = .55; pipePiece(ctx, n, t.ghost, P); ctx.globalAlpha = 1; }
    for (const [list, alpha] of [[t.route, .75], [t.feed, .5]]) for (const s of list || []) { ctx.globalAlpha = alpha; strokeD(ctx, chanD(n, s.a, s.b), P.accent, 2.5, [5, 5]); ctx.globalAlpha = 1; }
  }
  // shade by the light, over the tile's art
  if (t.shade > 0.01) { ctx.fillStyle = `rgba(0,0,0,${t.shade})`; ctx.fill(new Path2D(groundD(n, 30))); }
  put();
  if (t.hint === "wrong") strokeD(ctx, groundD(n, 25), P.bad, 3);
  else if (t.ghost) strokeD(ctx, groundD(n, 25), P.accent, 3, [6, 4]);
  if (t.ring) strokeD(ctx, groundD(n, 24), t.ring === "out" ? P.good : P.accent, 3.5);
  if (t.spill) { ctx.lineCap = "round"; strokeD(ctx, "M22 22L38 38M38 22L22 38", P.bad, 5); }
  // what stands upright on the tile whichever way it lies: the derrick, the tank, the studs on old pipe, a stake's number
  const s = scaleOf(m), at = ([x, y]) => apply(m, [x, y]);
  const upright = (px, py, k = 1) => ctx.setTransform(s * k * dpr, 0, 0, s * k * dpr, (px - C * s * k) * dpr, (py - C * s * k) * dpr);
  const [cx, cy] = at([C, C]);
  if (t.cell?.k === "source") {
    upright(cx, cy);
    ctx.fillStyle = P.accent; ctx.strokeStyle = P.accent; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.setLineDash([]);
    ctx.stroke(iconPaths().derrick); ctx.fillRect(13, 44, 34, 5);
  } else if (t.cell?.k === "terminal") {
    upright(cx, cy);
    ctx.fillStyle = P.good; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.lineJoin = "round";
    const { roof, flag, tank } = iconPaths();
    ctx.fill(tank); ctx.stroke(tank);
    ctx.fill(roof); ctx.stroke(roof);
    ctx.fillStyle = "#fff"; ctx.fill(flag); ctx.lineWidth = 1.5; ctx.stroke(flag);
  } else if (t.cell?.k === "old" && t.piece) {
    for (const [a, b] of chans(n, t.piece)) {
      const [x, y] = at(chanMid(n, a, b));
      upright(x, y, .55);
      ctx.beginPath(); ctx.arc(C, C, 6 * 1.1, 0, 7); ctx.fillStyle = P.accent; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  if (t.stake) {
    const [x, y] = at([15, 15]);
    upright(x, y, 1.25);                                      // a stake must be found on a tile turned away: larger than the flat Puzzle's
    ctx.beginPath(); ctx.arc(C, C, 10, 0, 7);
    ctx.fillStyle = t.stake.state === "ok" ? P.good : t.stake.state === "bad" ? P.bad : P.accent; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "800 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(t.stake.n), C, C + .5);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** A hand piece as a small SVG icon (a string of SVG markup), on an n-sided tile. Classes are the page's (.pipe, .pipe-edge, .pipe-shine). */
export function iconSvg(n, kind) {
  const piece = kind === "x" ? "x0" : `${kind}0`, cs = chans(n, piece), order = kind === "x" ? [1, 0] : cs.map((_, i) => i);
  const one = (d, bridge) => `${bridge ? `<path d="${d}" class="pipe-edge" stroke-width="26" stroke="var(--pi-ground)"/>` : ""}<path d="${d}" class="pipe-edge" stroke-width="22"/><path d="${d}" class="pipe" stroke-width="16"/><path d="${d}" class="pipe-shine" stroke-width="4"/>`;
  return `<svg viewBox="0 0 60 60" aria-hidden="true">${order.map(i => one(chanD(n, cs[i][0], cs[i][1]), kind === "x" && i === 0)).join("")}</svg>`;
}
