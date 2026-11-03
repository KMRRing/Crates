// Manifest's cargo as solid shapes, pure (no page, no three.js): each of the eight types is a mesh inside its own cell, a unit
// cube centred on the origin with y up, built here from a few primitives (a box, a frustum, a surface of revolution, a
// tube). manifest-3d.js hands the arrays to three.js, tests/manifest-shapes.mjs weighs the shapes' silhouettes against each
// other (the types must be told apart by outline before colour), and the flat drawing's outlines follow the same sizes.
//
// A mesh is { pos, nor, part, index }: positions and outward normals, and four numbers a vertex: which part of the
// piece it is (a barrel's staves or its head), a seed (which log, which bar), and two coordinates the part may use. The
// shader (manifest-glsl.js) reads the parts to paint each; the numbers below are the contract between the two:
//   crate  0 the box
//   barrel 0 staves, 1 head
//   timber 0 bark, 1 sawn end, 2 rope           (seed: the log, 0..3)
//   ingot  0 the bars                            (seed: layer * 3 + bar)
//   chest  0 body, 1 lid, 2 lid end
//   sack   0 the bag, 1 the knot
//   gold   the ingots' mesh again (same shape, told apart by colour and by the crown stamped on the top: GOLD_MARK)
//   birch  0 bark, 1 sawn end, 2 rope            (seed: the log, 0..5)
// What a piece does not fill of its cell stays empty: a round thing leaves gaps, and what shows through a stack is still
// decided by the cell (the engine's visibleSet).
import { isTimber } from "./manifest-rules.js";
export const MESH_TYPES = 8;

// ---------- a little geometry ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);

// value noise, deterministic: the same lumps in every run on every device
const hash2 = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j);
  return lerp(lerp(hash2(i, j), hash2(i + 1, j), u), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), u), v);
}

// ---------- a mesh being built ----------
const fresh = () => ({ p: [], n: [], a: [], i: [] });
const vert = (m, p, n, part, seed, s, t) => { m.p.push(...p); m.n.push(...n); m.a.push(part, seed, s, t); return m.p.length / 3 - 1; };

/** A surface fn(u, v) -> [x, y, z] over the unit square, nu by nv quads; normals from its slopes, turned outward by hint(point). */
function surface(m, nu, nv, fn, hint, part, seed = 0, uv = (u, v) => [u, v]) {
  const base = m.p.length / 3, e = 1e-3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv, p = fn(u, v);
    let n = unit(cross(sub(fn(u + e, v), fn(u - e, v)), sub(fn(u, v + e), fn(u, v - e))));
    if (dot(n, hint(p, u, v)) < 0) n = [-n[0], -n[1], -n[2]];
    vert(m, p, n, part, seed, ...uv(u, v));
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    m.i.push(a, b, c, b, d, c);
  }
}
/** A flat face from its corners (in order round it), its normal turned away from `inside`. */
function face(m, pts, inside, part, seed = 0, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  let n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
  if (dot(n, sub(c, inside)) < 0) n = [-n[0], -n[1], -n[2]];
  const ids = pts.map((p, k) => vert(m, p, n, part, seed, ...uvs[k]));
  for (let k = 1; k < ids.length - 1; k++) m.i.push(ids[0], ids[k], ids[k + 1]);
}
/** A flat disc (or half) at height y, seen from above (up = 1) or below, a fan from its middle. */
function disc(m, cx, cy, cz, r, up, part, seed = 0, n = 28) {
  const mid = vert(m, [cx, cy, cz], [0, up, 0], part, seed, 0, 0);
  const ring = Array.from({ length: n + 1 }, (_, k) => { const t = k / n * TAU; return vert(m, [cx + Math.cos(t) * r, cy, cz + Math.sin(t) * r], [0, up, 0], part, seed, Math.cos(t), Math.sin(t)); });
  for (let k = 0; k < n; k++) m.i.push(mid, ring[k + 1], ring[k]);
}
/** A box from its extents. */
function box(m, x0, x1, y0, y1, z0, z1, part = 0, seed = 0) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  face(m, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], c, part, seed);
  face(m, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], c, part, seed);
  face(m, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c, part, seed);
  face(m, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], c, part, seed);
  face(m, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c, part, seed);
  face(m, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], c, part, seed);
}
/** A bar with sloping sides, its foot [bx, bz] big and its top [tx, tz] big, centred on (cx, cz), from y0 to y1. */
function frustum(m, cx, cz, y0, y1, [bx, bz], [tx, tz], part, seed) {
  const ring = (y, hx, hz) => [[cx - hx, y, cz - hz], [cx + hx, y, cz - hz], [cx + hx, y, cz + hz], [cx - hx, y, cz + hz]];
  const lo = ring(y0, bx / 2, bz / 2), hi = ring(y1, tx / 2, tz / 2), c = [cx, (y0 + y1) / 2, cz];
  for (let k = 0; k < 4; k++) face(m, [lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]], c, part, seed);
  face(m, hi, c, part, seed);
  face(m, lo, c, part, seed);
}
/** Which way is out on a body of revolution with radius rOf(y), at height y and angle u (a turn): sideways and tilted by the profile's slope. */
const radialOut = (rOf, y, u) => { const e = 0.01, slope = (rOf(y + e) - rOf(y - e)) / (2 * e), a = u * TAU; return [Math.cos(a), -slope, Math.sin(a)]; };
/** A tube along a closed path in the y-z plane at x = x0 (a cord drawn round a bundle). */
function loop(m, x0, path, r, part, seed, nu = 44, nv = 5) {
  const at = u => path(((u % 1) + 1) % 1);
  surface(m, nu, nv, (u, v) => {
    const c = at(u), t = unit(sub(at(u + 1e-3), at(u - 1e-3))), nrm = [0, -t[2], t[1]], a = v * TAU;
    return [x0 + Math.cos(a) * r, c[1] + Math.sin(a) * r * nrm[1], c[2] + Math.sin(a) * r * nrm[2]];
  }, (p, u) => { const c = at(u); return [p[0] - x0, p[1] - c[1], p[2] - c[2]]; }, part, seed, (u, v) => [u * 14, v]);
}
/** A rounded rectangle path in the y-z plane, u from 0 to 1 once round. */
function roundRect(cy, cz, hy, hz) {
  const n = 64;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = k / n * TAU, cs = Math.cos(t), sn = Math.sin(t);
    const e = 6, x = Math.sign(cs) * Math.abs(cs) ** (2 / e), y = Math.sign(sn) * Math.abs(sn) ** (2 / e);   // a superellipse: rounded corners
    pts.push([0, cy + y * hy, cz + x * hz]);
  }
  return u => { const f = u * n, i = Math.floor(f) % n, k = f - Math.floor(f), a = pts[i], b = pts[(i + 1) % n]; return [0, lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; };
}

const finish = m => {
  const n = m.p.length / 3, index = [];
  // wind every triangle to agree with its vertices' normals, so none is lost to culling
  for (let k = 0; k < m.i.length; k += 3) {
    let [a, b, c] = [m.i[k], m.i[k + 1], m.i[k + 2]];
    const P = i => [m.p[i * 3], m.p[i * 3 + 1], m.p[i * 3 + 2]], N = i => [m.n[i * 3], m.n[i * 3 + 1], m.n[i * 3 + 2]];
    const g = cross(sub(P(b), P(a)), sub(P(c), P(a)));
    const avg = [0, 0, 0]; for (const i of [a, b, c]) { const q = N(i); avg[0] += q[0]; avg[1] += q[1]; avg[2] += q[2]; }
    if (Math.hypot(...g) < 1e-12) continue;                            // a sliver with no area
    if (dot(g, avg) < 0) [b, c] = [c, b];
    index.push(a, b, c);
  }
  return { pos: new Float32Array(m.p), nor: new Float32Array(m.n), part: new Float32Array(m.a), index: n > 65535 ? new Uint32Array(index) : new Uint16Array(index) };
};

// ---------- the six ----------
/** A crate: slatted boards, a hair inside its cell so that neighbours show a seam. */
function crate() {
  const m = fresh();
  box(m, -0.47, 0.47, -0.5, 0.5, -0.47, 0.47);
  return m;
}

/** The barrel's bulge: radius by height (-.5 to .5), fattest at the middle, the heads a good deal narrower. */
export const barrelRadius = y => 0.365 + 0.105 * (1 - (2 * y) ** 2) + 0.012 * Math.max(0, Math.abs(2 * y) - 0.88) * 8;
function barrel() {
  const m = fresh();
  surface(m, 26, 14, (u, v) => { const y = v - 0.5, r = barrelRadius(y), a = u * TAU; return [Math.cos(a) * r, y, Math.sin(a) * r]; },
    (p, u) => radialOut(barrelRadius, p[1], u), 0, 0, (u, v) => [u, v]);
  disc(m, 0, 0.5, 0, barrelRadius(0.5), 1, 1);
  disc(m, 0, -0.5, 0, barrelRadius(-0.5), -1, 1);
  return m;
}

/** The logs of a bundle of timber lying along x: centres (y, z), radius, length and where along x each lies. The rope that
 *  ties them is round the lot. */
export const LOGS = [
  { y: -0.268, z: -0.232, r: 0.232, len: 0.97, at: 0.0 },
  { y: -0.268, z: 0.232, r: 0.229, len: 0.93, at: 0.025 },
  { y: 0.196, z: -0.232, r: 0.229, len: 0.95, at: -0.02 },
  { y: 0.196, z: 0.232, r: 0.232, len: 0.98, at: 0.0 },
];
function timber() {
  const m = fresh();
  LOGS.forEach((L, k) => {
    const lumps = (u, v) => 1 + 0.045 * (noise(Math.cos(u * TAU) * 2.2 + k * 9, Math.sin(u * TAU) * 2.2 + v * 5) - 0.5);
    surface(m, 18, 6, (u, v) => { const a = u * TAU, r = L.r * lumps(u, v); return [L.at + (v - 0.5) * L.len, L.y + Math.sin(a) * r, L.z + Math.cos(a) * r]; },
      p => [0, p[1] - L.y, p[2] - L.z], 0, k, (u, v) => [u, v]);
    for (const sgn of [1, -1]) {
      const x = L.at + sgn * L.len / 2, mid = vert(m, [x, L.y, L.z], [sgn, 0, 0], 1, k, 0, 0);
      const ring = Array.from({ length: 25 }, (_, q) => { const a = q / 24 * TAU; return vert(m, [x, L.y + Math.sin(a) * L.r * lumps(a / TAU, sgn > 0 ? 1 : 0), L.z + Math.cos(a) * L.r * lumps(a / TAU, sgn > 0 ? 1 : 0)], [sgn, 0, 0], 1, k, Math.sin(a), Math.cos(a)); });
      for (let q = 0; q < 24; q++) m.i.push(mid, ring[q], ring[q + 1]);
    }
  });
  for (const x of [-0.29, 0.29]) loop(m, x, roundRect(-0.015, 0, 0.463, 0.478), 0.022, 2, 0);
  return m;
}

/** The slender logs of a bundle of birch lying along x, six in a pyramid (three, two, one): the end is a triangle, where oak's is a
 *  square of four thick logs, so the two trees are told apart by outline before colour. */
export const BIRCH_LOGS = (() => {
  const r = 0.165, gap = 0.31, rise = gap * Math.sqrt(3) / 2, lens = [0.97, 0.94, 0.96, 0.93, 0.98, 0.95], ats = [0, 0.02, -0.02, 0.025, 0, -0.015];
  const rows = [[-gap, 0, gap], [-gap / 2, gap / 2], [0]];
  return rows.flatMap((zs, row) => zs.map(z => ({ y: -0.5 + r + 0.024 + row * rise, z, r, len: 0, at: 0 }))).map((L, k) => ({ ...L, len: lens[k], at: ats[k] }));
})();
/** The rope round a bundle of birch: a rounded triangle, the logs' centres pushed out by their radius and the cord's. */
function roundTri(logs, pad) {
  const n = 72, dirs = Array.from({ length: n }, (_, k) => { const t = k / n * TAU; return [Math.cos(t), Math.sin(t)]; });
  const pts = dirs.map(([c, s]) => {
    const best = logs.reduce((a, L) => (L.z * c + L.y * s > a.z * c + a.y * s ? L : a));
    return [0, best.y + s * pad, best.z + c * pad];
  });
  return u => { const f = u * n, i = Math.floor(f) % n, k = f - Math.floor(f), a = pts[i], b = pts[(i + 1) % n]; return [0, lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; };
}
function birch() {
  const m = fresh();
  BIRCH_LOGS.forEach((L, k) => {
    const lumps = (u, v) => 1 + 0.03 * (noise(Math.cos(u * TAU) * 2.2 + k * 9, Math.sin(u * TAU) * 2.2 + v * 5) - 0.5);
    surface(m, 16, 6, (u, v) => { const a = u * TAU, r = L.r * lumps(u, v); return [L.at + (v - 0.5) * L.len, L.y + Math.sin(a) * r, L.z + Math.cos(a) * r]; },
      p => [0, p[1] - L.y, p[2] - L.z], 0, k, (u, v) => [u, v]);
    for (const sgn of [1, -1]) {
      const x = L.at + sgn * L.len / 2, mid = vert(m, [x, L.y, L.z], [sgn, 0, 0], 1, k, 0, 0);
      const ring = Array.from({ length: 21 }, (_, q) => { const a = q / 20 * TAU; return vert(m, [x, L.y + Math.sin(a) * L.r, L.z + Math.cos(a) * L.r], [sgn, 0, 0], 1, k, Math.sin(a), Math.cos(a)); });
      for (let q = 0; q < 20; q++) m.i.push(mid, ring[q], ring[q + 1]);
    }
  });
  for (const x of [-0.29, 0.29]) loop(m, x, roundTri(BIRCH_LOGS, BIRCH_LOGS[0].r + 0.012), 0.012, 2, 0);
  return m;
}

/** The crown stamped on the top of a pile of gold ingots: the second thing, besides its colour, that tells gold from tin. Its
 *  corners are in the crown's own square (across -1 to 1, up -1 to 1 as the viewer sees the top), and `crownAt` puts one on the
 *  cell's top plane (x right, z toward the viewer's left, each -.5 to .5; the isometric view's up is toward -x and -z). Both
 *  drawings read it from here. */
export const GOLD_MARK = [[-1, -1], [-1, 0.9], [-0.5, 0.1], [0, 1], [0.5, 0.1], [1, 0.9], [1, -1]];
export const GOLD_MARK_SIZE = [0.29, 0.27];                                  // half its width and height on the top plane
export const crownAt = ([across, up]) => { const s = across * GOLD_MARK_SIZE[0], t = up * GOLD_MARK_SIZE[1]; return [(s - t) * Math.SQRT1_2, (-s - t) * Math.SQRT1_2]; };

/** A pile of ingots: four layers of three bars, each layer across the one below, every bar a frustum (the foot wider than the top). */
export const INGOT_LAYERS = 4, INGOT_SHRINK = 0.045;
function ingots() {
  const m = fresh(), h = 1 / INGOT_LAYERS;
  for (let layer = 0; layer < INGOT_LAYERS; layer++) {
    for (let k = 0; k < 3; k++) {
      const sc = 1 - INGOT_SHRINK * layer;                                      // each layer a little smaller: a pile, not a block
      const across = (k - 1) * 0.318 * sc, len = 0.94 * sc;
      const foot = [len, 0.3 * sc], top = [len - 0.15, 0.2 * sc];
      const y0 = -0.5 + layer * h, y1 = y0 + h - 0.006;
      if (layer % 2 === 0) frustum(m, 0, across, y0, y1, foot, top, 0, layer * 3 + k);
      else frustum(m, across, 0, y0, y1, [foot[1], foot[0]], [top[1], top[0]], 0, layer * 3 + k);
    }
  }
  return m;
}

/** A chest: a plank box with a lid like half a barrel laid down, longer than it is wide. */
export const CHEST = { hx: 0.47, hz: 0.37, top: 0.02 };
function chest() {
  const m = fresh();
  box(m, -CHEST.hx, CHEST.hx, -0.5, CHEST.top, -CHEST.hz, CHEST.hz, 0, 0);
  const ry = 0.5 - CHEST.top;
  surface(m, 24, 14, (u, v) => { const a = v * Math.PI; return [(u - 0.5) * 2 * CHEST.hx, CHEST.top + Math.sin(a) * ry, Math.cos(a) * CHEST.hz]; },
    p => [0, p[1] - CHEST.top, p[2]], 1, 0, (u, v) => [u, v]);
  for (const sgn of [1, -1]) {   // the lid's two ends, half-ellipses
    const x = sgn * CHEST.hx, mid = vert(m, [x, CHEST.top, 0], [sgn, 0, 0], 2, 0, 0, 0);
    const ring = Array.from({ length: 17 }, (_, q) => { const a = q / 16 * Math.PI; return vert(m, [x, CHEST.top + Math.sin(a) * ry, Math.cos(a) * CHEST.hz], [sgn, 0, 0], 2, 0, Math.cos(a), Math.sin(a)); });
    for (let q = 0; q < 16; q++) m.i.push(mid, ring[q], ring[q + 1]);
  }
  return m;
}

/** A sack: a slumped bag, fat below and drawn in at the top to a tied neck, lumpy where the grain settles. */
export const SACK_KNOT = 0.44;                                           // the height of the cord round the neck (cell y)
const sackProfile = [[-0.5, 0.31], [-0.42, 0.4], [-0.25, 0.46], [0.0, 0.45], [0.2, 0.39], [0.34, 0.29], [0.41, 0.17], [0.455, 0.075], [0.49, 0.095], [0.5, 0.06]];
export const sackRadius = y => {
  for (let i = 1; i < sackProfile.length; i++) {
    const [y1, r1] = sackProfile[i], [y0, r0] = sackProfile[i - 1];
    if (y <= y1) return lerp(r0, r1, smooth(Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))));
  }
  return sackProfile[sackProfile.length - 1][1];
};
function sack() {
  const m = fresh();
  surface(m, 24, 18, (u, v) => {
    const y = -0.5 + v, a = u * TAU, belly = Math.max(0, 1 - Math.abs(v - 0.45) * 2.2);
    const lump = 1 + 0.07 * belly * (noise(Math.cos(a) * 1.8 + 4, Math.sin(a) * 1.8 + y * 5) - 0.5) * 2;
    const lean = 0.05 * Math.max(0, v - 0.35) ** 2 * 3;                // the top slumps a little toward the viewer
    const r = sackRadius(y) * lump;
    return [Math.cos(a) * r + lean, y, Math.sin(a) * r + lean];
  }, (p, u) => radialOut(sackRadius, p[1], u), 0, 0, (u, v) => [u, v]);
  disc(m, 0.0634, 0.5, 0.0634, 0.06, 1, 1);
  return m;
}

const BUILD = [crate, barrel, timber, ingots, chest, sack, ingots, birch];
const cache = [];
/** The mesh of cargo type 1..8: { pos, nor, part, index }. */
export function meshOf(type) {
  const k = type - 1;
  if (!BUILD[k]) throw new Error(`no cargo type ${type}`);
  return (cache[k] ??= finish(BUILD[k]()));
}

// ---------- silhouettes ----------
/** The scene's isometric view of a point of a cell (x right, y up, z toward the viewer's left), as the engine's isoPoint has it. */
export const screenOf = ([x, y, z]) => [0.866 * (x - z), 0.5 * (x + z) - y];

/** The convex hull of 2D points (monotone chain), counter-clockwise in screen terms. */
export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const outlines = new Map();
/**
 * What a piece of type 1..8 covers of the screen, as a convex polygon in the engine's screen units around the middle of its
 * cell: the hull of its mesh seen by the isometric camera (`alongY`: a bundle of timber lying along y). The engine decides
 * what you could see by these, so a round piece that leaves a corner of its cell empty doesn't count as seen through it.
 */
export function outlineOf(type, alongY = false) {
  const key = type * 2 + (alongY && isTimber(type) ? 1 : 0);
  if (!outlines.has(key)) {
    const { pos } = meshOf(type), yaw = key & 1 ? Math.PI / 2 : 0, c = Math.cos(yaw), s = Math.sin(yaw), pts = [];
    for (let i = 0; i < pos.length; i += 3) pts.push(screenOf([pos[i] * c + pos[i + 2] * s, pos[i + 1], -pos[i] * s + pos[i + 2] * c]));
    outlines.set(key, hull(pts));
  }
  return outlines.get(key);
}

/**
 * The shape's silhouette on an n by n grid, as seen by the isometric camera: a Uint8Array mask over the screen square that
 * holds a whole cell (x from -1 to 1, y from -1.25 to 0.75), triangles filled whichever way they face. `yaw` turns the piece
 * about the vertical first (a quarter turn lays a log along the other axis).
 */
export function silhouette(type, n = 96, yaw = 0) {
  const { pos, index } = meshOf(type), mask = new Uint8Array(n * n), c = Math.cos(yaw), s = Math.sin(yaw);
  const pt = i => { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; const [sx, sy] = screenOf([x * c + z * s, y, -x * s + z * c]); return [(sx + 1) / 2 * n, (sy + 1.25) / 2 * n]; };
  for (let k = 0; k < index.length; k += 3) {
    const A = pt(index[k]), B = pt(index[k + 1]), C = pt(index[k + 2]);
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(n - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(n - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(d) < 1e-9) continue;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const l1 = ((B[1] - C[1]) * (qx - C[0]) + (C[0] - B[0]) * (qy - C[1])) / d, l2 = ((C[1] - A[1]) * (qx - C[0]) + (A[0] - C[0]) * (qy - C[1])) / d, l3 = 1 - l1 - l2;
      if (l1 >= -0.01 && l2 >= -0.01 && l3 >= -0.01) mask[py * n + px] = 1;
    }
  }
  return mask;
}
/** How much two silhouettes overlap, from 0 (nothing shared) to 1 (the same outline): shared area over total area. */
export function overlap(a, b) {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) both++; if (a[i] || b[i]) either++; }
  return either ? both / either : 1;
}
