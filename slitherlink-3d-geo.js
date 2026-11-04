// Portolan's chart in 3D: the plain arithmetic (no three.js, so Node tests it). Board coordinates are the flat board's: a corner is
// (x, y) with x across to C and y down to R, an edge's index as slitherlink-engine.js has it (the horizontal edges first, then the
// vertical ones), so the 3D view and the 2D one read taps the same way. Once the loop is drawn its inside is the land and its
// outside the sea; everything here that makes the land, the sea, the harbour and the cog's course is derived from the lines drawn.
import { LINE } from "./slitherlink-engine.js";

export const MARGIN = 0.4;                     // the vellum beyond the outermost dots, in cells
export const SUB = 5, SEA_SUB = 3;             // a cell of land is 5x5 squares, a cell of sea 3x3
export const LAND_BASE = 0.012, HILL = 1.1;    // where the land starts above the vellum; the tallest a hill gets, in cells
export const REACH = 0.4;                      // how far from an edge, in cells, a finger still means that edge (the flat board's)

/** A deterministic 0..1 from a lattice point, for the hills (the same coast gives the same island on every phone). */
const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => (vnoise(x * 0.9, y * 0.9, s) * 0.58 + vnoise(x * 1.9 + 7, y * 1.9 + 3, s) * 0.3 + vnoise(x * 4 + 1, y * 4 + 9, s) * 0.12);

/** A flat board's corner count and where an edge runs: [x1, y1, x2, y2]. */
export function edgeEnds(g, e) {
  const W = g.C + 1, a = g.ea[e], b = g.eb[e];
  return [a % W, Math.floor(a / W), b % W, Math.floor(b / W)];
}
/** Which cells the drawn lines enclose (1 inside): an even-odd count of the vertical lines left of a cell on its row. */
export function insideCells(g, marks) {
  const { R, C, H } = g, out = new Uint8Array(R * C);
  for (let r = 0; r < R; r++) {
    let par = 0;
    for (let c = 0; c < C; c++) { if (marks[H + r * (C + 1) + c] === LINE) par ^= 1; out[r * C + c] = par; }
  }
  return out;
}
/** The drawn lines as segments [x1, y1, x2, y2]. */
export function coastSegments(g, marks) {
  const out = [];
  for (let e = 0; e < g.E; e++) if (marks[e] === LINE) out.push(edgeEnds(g, e));
  return out;
}
/** The distance from a point to the nearest of a set of axis-aligned segments. */
export function coastDistance(segs, x, y) {
  let best = Infinity;
  for (const [x1, y1, x2, y2] of segs) {
    const dx = Math.max(Math.min(x1, x2) - x, 0, x - Math.max(x1, x2)), dy = Math.max(Math.min(y1, y2) - y, 0, y - Math.max(y1, y2)), d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
/** The island's height at a point `d` from the coast: nothing at the shore, rising with a hill's noise, never above HILL. */
export function heightAt(d, x, y) {
  const rise = 1 - Math.exp(-d * 1.15), n = fbm(x, y, 3);
  return HILL * rise * (0.3 + 0.9 * n) * Math.min(1, 0.6 + d * 0.25);
}
/** The loop in order, as corners [x, y] (a closed loop's corners once each), or null if the lines aren't one loop. */
export function loopPath(g, marks) {
  const W = g.C + 1, start = marks.indexOf(LINE);
  if (start < 0) return null;
  const used = new Set(), path = [];
  let at = g.ea[start], e = start, n = 0;
  const first = at;
  do {
    path.push([at % W, Math.floor(at / W)]);
    used.add(e);
    at = g.ea[e] === at ? g.eb[e] : g.ea[e];
    const next = g.vedges[at].find(f => marks[f] === LINE && !used.has(f));
    if (next == null) break;
    e = next;
  } while (at !== first && ++n < g.E);
  return at === first && path.length >= 4 ? path : null;
}
const area2 = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; } return s; };
/** A course round the coast, `out` cells to sea of it, with its corners rounded: the cog's way. Returns [x, y] points, closed (no repeat). */
export function seaCourse(path, out) {
  if (!path) return [];
  const sign = area2(path) > 0 ? 1 : -1;                    // which side is outward depends on the way round
  const n = path.length, pts = path.map((p, i) => {
    const a = path[(i + n - 1) % n], b = path[(i + 1) % n];
    const t1 = [Math.sign(p[0] - a[0]), Math.sign(p[1] - a[1])], t2 = [Math.sign(b[0] - p[0]), Math.sign(b[1] - p[1])];
    const k = 1 + t1[0] * t2[0] + t1[1] * t2[1];                          // 2 on a straight run, 1 at a corner, which moves out along the diagonal
    return [p[0] + ((t1[1] + t2[1]) * sign * out) / k, p[1] - ((t1[0] + t2[0]) * sign * out) / k];
  });
  let cur = pts;
  for (let k = 0; k < 3; k++) {                             // Chaikin's cut: corners rounded
    const nxt = [];
    for (let i = 0; i < cur.length; i++) { const a = cur[i], b = cur[(i + 1) % cur.length]; nxt.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    cur = nxt;
  }
  return cur;
}
/** Total length of a closed polyline, and the point and heading at a distance along it. */
export function course(poly) {
  const n = poly.length, cum = [0];
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[n];
  return {
    total,
    /** The distance along to the polyline's corner nearest a point. */
    nearest(x, y) { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.hypot(poly[i][0] - x, poly[i][1] - y); if (d < bd) { bd = d; best = cum[i]; } } return best; },
    at(s) {
      s = ((s % total) + total) % total;
      let i = 0; while (i < n - 1 && cum[i + 1] < s) i++;
      const a = poly[i], b = poly[(i + 1) % n], f = (s - cum[i]) / ((cum[i + 1] - cum[i]) || 1);
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    },
  };
}

/** sRGB bytes-as-fractions to the linear values a vertex colour wants. */
const lin = c => c.map(v => v * v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const SAND = [0.86, 0.77, 0.52], GRASS = [0.36, 0.56, 0.24], MEADOW = [0.52, 0.64, 0.28], OCHRE = [0.72, 0.58, 0.28], ROCK = [0.58, 0.47, 0.34];
/** The land's colour at a height `h` and distance `d` from the shore: sand, then green, ochre uphill, rock on the tops. */
export function landColour(h, d, x, y) {
  const n = hash(Math.floor(x * 4), Math.floor(y * 4), 9) - 0.5;
  let c = mix(SAND, GRASS, Math.min(1, Math.max(0, (d - 0.12) / 0.35)));
  c = mix(c, MEADOW, Math.min(1, Math.max(0, n + 0.5)) * 0.5);
  c = mix(c, OCHRE, Math.min(1, Math.max(0, (h - 0.28) / 0.28)));
  c = mix(c, ROCK, Math.min(1, Math.max(0, (h - 0.6) / 0.22)));
  return lin(c.map(v => Math.min(1, Math.max(0, v + n * 0.06))));
}
const SHALLOW = [0.42, 0.74, 0.72], MID = [0.13, 0.4, 0.6], DEEP = [0.05, 0.15, 0.36];
export function seaColour(d) { return lin(d < 1 ? mix(SHALLOW, MID, d) : mix(MID, DEEP, Math.min(1, (d - 1) / 3))); }

/**
 * The island: the squares of the cells inside the loop, shared corners, each raised by heightAt, coloured by land. Triangles wind
 * so the top faces up. Returns flat arrays for a BufferGeometry, the hill-top, and the sample function the harbour and the trees use.
 */
export function landMesh(g, marks) {
  const inside = insideCells(g, marks), segs = coastSegments(g, marks), { R, C } = g, S = SUB, cache = new Map();
  const positions = [], colors = [], index = [];
  const top = { x: 0, y: 0, h: -1 };
  const vert = (ix, iy) => {
    const key = iy * (C * S + 1) + ix;
    let v = cache.get(key);
    if (v == null) {
      const x = ix / S, y = iy / S, d = coastDistance(segs, x, y), h = heightAt(d, x, y);
      v = positions.length / 3;
      positions.push(x, h, y);
      colors.push(...landColour(h, d, x, y));
      cache.set(key, v);
      if (h > top.h) { top.h = h; top.x = x; top.y = y; }
    }
    return v;
  };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!inside[r * C + c]) continue;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const ix = c * S + i, iy = r * S + j, a = vert(ix, iy), b = vert(ix + 1, iy), d = vert(ix, iy + 1), e = vert(ix + 1, iy + 1);
      if ((i + j) % 2) index.push(a, d, b, b, d, e); else index.push(a, d, e, a, e, b);       // the diagonal alternates, so no grain shows
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), index: new Uint32Array(index), top, inside, segs };
}
/** The sea: every square of the vellum that is not land (the margin too), coloured by its distance from the coast. Corners are not shared (squares are flat colour-blended). */
export function seaMesh(g, marks, w, h) {
  const inside = insideCells(g, marks), segs = coastSegments(g, marks), { R, C } = g, positions = [], colors = [], index = [];
  const lines = (n, m) => { const out = [-m]; for (let i = 0; i < n * SEA_SUB; i++) out.push(i / SEA_SUB); out.push(n, n + m); return out; };
  const xs = lines(C, w), ys = lines(R, h);
  for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (cx > 0 && cx < C && cy > 0 && cy < R && inside[Math.floor(cy) * C + Math.floor(cx)]) continue;
    const k = positions.length / 3;
    for (const [x, y] of [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i], ys[j + 1]], [xs[i + 1], ys[j + 1]]]) { positions.push(x, 0, y); colors.push(...seaColour(coastDistance(segs, x, y))); }
    index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), index: new Uint32Array(index) };
}

/** The harbour: where on the coast the town and the pier are, and which way is out to sea. Taken from the course's start, so it is the same every time. */
export function harbourOf(path) {
  if (!path) return null;
  const sign = area2(path) > 0 ? 1 : -1, a = path[0], b = path[1], tx = Math.sign(b[0] - a[0]), ty = Math.sign(b[1] - a[1]);
  return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, out: [sign * ty, -sign * tx] };
}

/** Where a ray from `o` along `d` meets the plane y = 0, as board-world [x, z], or null if it never does. */
export function groundPoint(o, d) {
  if (Math.abs(d[1]) < 1e-9) return null;
  const t = -o[1] / d[1];
  return t > 0 ? [o[0] + d[0] * t, o[2] + d[2] * t] : null;
}
/** The edge a point of the board means, or -1: the nearest grid line of either kind within REACH (the flat board's rule, used by both views). */
export function edgeAtPoint(g, x, y) {
  const { R, C, H } = g, gx = Math.min(C, Math.max(0, Math.round(x))), gy = Math.min(R, Math.max(0, Math.round(y)));
  const dv = Math.abs(x - gx), dh = Math.abs(y - gy);
  if (Math.min(dv, dh) > REACH) return -1;
  if (dh <= dv) return gy * C + Math.min(C - 1, Math.max(0, Math.floor(x)));
  return H + Math.min(R - 1, Math.max(0, Math.floor(y))) * (C + 1) + gx;
}

export const DEG = Math.PI / 180;
export const FOV = 9 * DEG, ELEVATION = 78 * DEG;
/**
 * How far the camera stands, looking at the board's middle from the near side, for the vellum (`hw` and `hh` half-sides) to fill a frame
 * with `tx`, `ty` the tangents of its half-angles and `padX`, `padY` the share of the frame left round it.
 */
export function fitDistance(hw, hh, el, tx, ty, padX, padY) {
  const se = Math.sin(el), ce = Math.cos(el);
  let d = 4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const along = sz * hh * ce, across = sx * hw, up = -sz * hh * se;
    d = Math.max(d, along + Math.abs(across) / (tx * (1 - padX)), along + Math.abs(up) / (ty * (1 - padY)));
  }
  return d;
}
