// The shore round Bridges' 3D sea, pure (no picture in it, so tests run it in Node): an irregular ring of beaches and cliffs, a few
// rocks, pines and perhaps a lighthouse, seeded by the puzzle so every puzzle has a bay of its own. The camera may tilt, turn and
// zoom, and the sea is a square: the land must reach as far as the camera can ever see, and the water (and the ships) must stay inside
// the coast, so the board and its plates are all that is ever drawn on water.
//
// The coast is a polar grid round the board's middle: `N` angles, and for each a waterline radius and a row of stations out from it
// (a distance beyond the waterline, a height). Beaches and cliffs are two height profiles over the same stations, blended by how
// cliffy the angle is. Everything is a few thousand triangles, built once with the puzzle.
import { fitDistance, SEA_MARGIN } from "./bridges-model.js";

const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;
export const N = 72;                                          // angles round the ring
export const FOV = 30 * DEG, MIN_EL = 30 * DEG, MAX_EL = 80 * DEG, MAX_ZOOM = 3.6;     // the camera's limits, as bridges-3d.js has them (tests/bridges-coast.mjs reads that file and fails when they differ)
/** The sea reaches this far past the board's square (its plates, the strait numbers) before the water ends: the ships sail inside it. */
export const BOARD_PAD = 1.0;
/** The nearest the waterline comes to the board's square, along a side and at a corner. */
export const GAP = 1.6;

/** A 32-bit number from any seed (a number or a string). */
export function hashOf(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A small deterministic random stream (mulberry32). */
export function streamOf(seed) {
  let a = hashOf(seed);
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- how far the camera can see ----------
/**
 * The farthest point of the water's plane (y = 0), from the board's middle, that any view can show: every turn, every elevation, every zoom
 * and where it may look at that zoom, on cards from tall to wide. The camera stands where `fitDistance` puts it for the board's own box
 * (the plates over it included) and a zoom brings it nearer. The land is built to this radius and a little over, so no edge of the world shows.
 */
const reaches = new Map();
/** The cards' shapes (width over height) the land is made for: a phone upright with room to spare to a phone on its side. */
export const ASPECTS = [0.45, 0.6, 0.9, 1.4, 1.9];
export function reachOf(size) {
  if (reaches.has(size)) return reaches.get(size);
  const half = size / 2 + BOARD_PAD, ty = Math.tan(FOV / 2), box = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1.4]) box.push(sx * half, y, sz * half);
  let far = 0;
  for (const aspect of ASPECTS) for (const el of [MIN_EL, 42 * DEG, 60 * DEG, MAX_EL]) for (let k = 0; k < 16; k++) {
    const az = (k / 16) * TAU, tx = ty * aspect, fit = fitDistance(box, az, el, [0, 0.15, 0], tx, ty, 0, 0);
    for (const zoom of [1, 1.6, 2.6, MAX_ZOOM]) {
      const lim = (size / 2) * (1 - 1 / zoom) + 0.5, dist = fit / zoom;
      for (const [px, pz] of zoom === 1 ? [[0, 0]] : [[lim, lim], [-lim, lim], [lim, -lim], [-lim, -lim], [0, 0]]) far = Math.max(far, seenFrom(az, el, dist, px, pz, tx, ty));
    }
  }
  reaches.set(size, far);
  return far;
}
/** The farthest the camera at (az, el, dist) looking at (px, 0.15, pz) sees along y = 0, from the board's middle: the screen's corners and edge middles, where its rays meet the water. */
export function seenFrom(az, el, dist, px, pz, tx, ty) {
  const cE = Math.cos(el), sE = Math.sin(el), ex = px + Math.sin(az) * cE * dist, ey = 0.15 + sE * dist, ez = pz + Math.cos(az) * cE * dist;
  const bx = Math.sin(az) * cE, by = sE, bz = Math.cos(az) * cE;                    // backward: from `look` to the camera
  const rx = Math.cos(az), rz = -Math.sin(az);                                      // right
  const ux = by * rz, uy = bz * rx - bx * rz, uz = -by * rx;                         // up = backward × right
  let far = 0;
  for (const [u, v] of [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1], [-1, 0], [1, 0], [0, -1]]) {
    const dx = rx * u * tx + ux * v * ty - bx, dy = uy * v * ty - by, dz = rz * u * tx + uz * v * ty - bz;
    if (dy >= -1e-6) return Infinity;                                               // a ray at or above the horizon: nothing to say it stops
    const t = -ey / dy;
    far = Math.max(far, Math.hypot(ex + dx * t, ez + dz * t));
  }
  return far;
}

// ---------- the shore ----------
/** Stations: how far beyond the waterline each ring of the land lies; the last is moved out to the world's end. Heights of a beach and a cliff at each (below the sea at the first, at the waterline at the second). */
const D = [-0.8, 0, 0.14, 0.5, 1.3, 2.7, 4.6, 7.2, 10.5, 15, 21, 30, 42, 58, 78, 100];
const BEACH = [-0.45, 0.02, 0.07, 0.18, 0.33, 0.56, 1.0, 1.6, 2.3, 2.9, 3.4, 4.2, 4.8, 5.3, 5.6, 5.8];
const CLIFF = [-0.5, -0.02, 0.5, 0.95, 1.06, 1.4, 1.9, 2.5, 3.1, 3.6, 4.0, 4.5, 4.9, 5.3, 5.6, 5.8];

/**
 * The coast for a puzzle: `seed` (any number or string) and the board's `size`. Returns
 *  { n, far, seaHalf, water[n], cliff[n], dist[], high[n][k] (heights), rad[n][k] (radii), tris, rocks, pines, lighthouse }
 * where the grid's point (i, k) lies at angle i * TAU / n (0 along +x, turning towards +z), radius rad[i][k], height high[i][k];
 * `tris` is a flat list of triangles { p: Float32Array of 9, role } for the land: "sand", "cliff", "cliffHi", "grass", "grassHi" or "hill";
 * `rocks` and `pines` are { x, y, z, s, ry } and `lighthouse` { x, y, z, ry } or null.
 */
export function coastOf(seed, size) {
  const rnd = streamOf(`coast:${seed}:${size}`), half = size / 2 + BOARD_PAD, n = N;
  // smooth periodic noise: a few sines with seeded phases
  const wave = () => { const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], am = [0.55 + rnd() * 0.3, 0.45 + rnd() * 0.3, 0.3 + rnd() * 0.25, 0.2 + rnd() * 0.2]; return t => am[0] * Math.sin(2 * t + ph[0]) + am[1] * Math.sin(3 * t + ph[1]) + am[2] * Math.sin(5 * t + ph[2]) + am[3] * Math.sin(7 * t + ph[3]); };
  const bay = wave(), rough = wave(), lean = wave();
  const water = new Float32Array(n), rawCliff = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU, edge = half / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t)));       // the board's square, along this angle
    water[i] = Math.max(edge + GAP, half * 1.15 + 2.1 + bay(t) * 1.5 + rough(t) * 0.35);
    rawCliff[i] = bay(t) * 0.7 + lean(t);
  }
  // a gentle smoothing so the line is a shore and not a saw
  const tmp = Float32Array.from(water);
  for (let i = 0; i < n; i++) water[i] = tmp[i] * 0.5 + (tmp[(i + n - 1) % n] + tmp[(i + 1) % n]) * 0.25;
  for (let i = 0; i < n; i++) { const t = (i / n) * TAU, edge = half / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))); water[i] = Math.max(water[i], edge + GAP); }
  // cliffs where the noise is high: by rank, so every coast has both a good share of cliff and of beach
  const sorted = Float32Array.from(rawCliff).sort(), lo = sorted[Math.floor(n * 0.4)], hi = sorted[Math.floor(n * 0.62)] + 1e-6;
  const cliff = Float32Array.from(rawCliff, v => smooth(lo, hi, v));
  const lowest = water.reduce((a, b) => Math.min(a, b), Infinity), far = Math.max(reachOf(size) * 1.04 + 2, water.reduce((a, b) => Math.max(a, b), 0) + 12);
  // the stations out to the world's end: the ones past it are dropped and the last stands just beyond it, at every angle
  let K = D.findIndex(d => lowest + d >= far);
  K = K < 0 ? D.length : K + 1;
  const dist = D.slice(0, K); dist[K - 1] = Math.max(dist[K - 1], far - lowest + 0.5);
  // the grid: a point's radius and height; the land beyond the first few stations is rough, a little, so it reads as ground and not as a cloth
  const rad = [], high = [];
  for (let i = 0; i < n; i++) {
    const rr = [], hh = [];
    for (let k = 0; k < K; k++) {
      const d = dist[k], inland = smooth(0.4, 6, d), c = cliff[i];
      let h = lerp(BEACH[k], CLIFF[k], c), r = water[i] + d;
      if (k > 1 && k < K - 1) { h += (rnd() - 0.5) * (0.06 + 0.5 * inland) * (0.6 + 0.6 * c) * (k > 10 ? 2 : 1); r += (rnd() - 0.5) * 0.16 * (1 - inland * 0.5) * (k > 10 ? 6 : 1); }
      rr.push(r); hh.push(h);
    }
    rad.push(rr); high.push(hh);
  }
  const at = (i, k) => { const t = (((i % n) + n) % n / n) * TAU, r = rad[((i % n) + n) % n][k]; return [Math.cos(t) * r, high[((i % n) + n) % n][k], Math.sin(t) * r]; };
  const tris = [];
  const push = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
    if (ny < 0) { [b, c] = [c, b]; ny = -ny; }                                          // always facing up
    const my = (a[1] + b[1] + c[1]) / 3, slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / Math.max(ny, 1e-3), odd = tris.length & 1;
    const role = slope > 0.8 ? (my > 1.7 ? "cliffHi" : odd ? "cliffHi" : "cliff") : my < 0.36 ? "sand" : my < 2.3 ? (odd ? "grassHi" : "grass") : "hill";
    tris.push({ p: Float32Array.of(...a, ...b, ...c), role });
  };
  for (let i = 0; i < n; i++) for (let k = 0; k < K - 1; k++) {
    const a = at(i, k), b = at(i + 1, k), c = at(i + 1, k + 1), d = at(i, k + 1);
    if ((i + k) & 1) { push(a, b, c); push(a, c, d); } else { push(a, b, d); push(b, c, d); }
  }
  const coast = { n, far, seaHalf: water.reduce((a, b) => Math.max(a, b), 0) + 1.2, water, cliff, dist, high, rad, tris, rocks: [], pines: [], lighthouse: null, half };
  // things on the land: rocks along the shore (more where it is cliff), pines in clumps on the land behind, a lighthouse on the cliffiest head
  const place = (i, d) => {                                                      // a point at angle index i (fractional), `d` beyond the waterline
    const t = (i / n) * TAU, r = waterAt(coast, i) + d, x = Math.cos(t) * r, z = Math.sin(t) * r;
    return { x, z, y: groundAt(coast, x, z) };
  };
  const rocks = 8 + Math.floor(size * 0.9) + Math.floor(rnd() * 6), clear = size / 2 + SEA_MARGIN + 0.3;       // a rock never stands where a ship may sail (the board's square, its margin and a hull's width)
  for (let q = 0; q < rocks; q++) for (let tries = 0; tries < 10; tries++) {
    const i = rnd() * n, c = cliffAt(coast, i), onBeach = rnd() < 0.3 * (1 - c), d = onBeach ? 0.3 + rnd() * 0.9 : -(0.15 + rnd() * 1.3 + c * 0.6);
    const p = place(i, d), s = 0.14 + rnd() * 0.26 + (onBeach ? -0.04 : 0.05);
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) < clear + s) continue;
    coast.rocks.push({ x: p.x, y: Math.max(p.y, 0) + s * 0.25, z: p.z, s, ry: rnd() * TAU });
    break;
  }
  const clumps = 5 + Math.floor(rnd() * 3);
  for (let q = 0; q < clumps; q++) {
    const i0 = rnd() * n, d0 = 1.6 + rnd() * 5.5, count = 4 + Math.floor(rnd() * 6);
    for (let m = 0; m < count; m++) {
      const i = i0 + (rnd() - 0.5) * 5, d = d0 + (rnd() - 0.5) * 2.6, p = place(i, d);
      if (p.y < 0.3 || p.y > 2.6) continue;
      coast.pines.push({ x: p.x, y: p.y, z: p.z, s: 0.8 + rnd() * 0.6, ry: rnd() * TAU });
    }
  }
  // the lighthouse, on the head that is cliffiest and sticks out furthest, set back from the edge
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < n; i++) { const v = cliff[i] * 2 + (water[i] - half) * 0.15 + cliff[(i + 1) % n] + cliff[(i + n - 1) % n]; if (v > bestV) { bestV = v; best = i; } }
  if (cliff[best] > 0.85 && cliff[(best + 2) % n] > 0.5 && cliff[(best + n - 2) % n] > 0.5) {
    const p = place(best, 1.7);
    coast.lighthouse = { x: p.x, y: p.y, z: p.z, ry: rnd() * TAU };
  }
  return coast;
}

/** The waterline's radius at a fractional angle index. */
export function waterAt(coast, i) {
  const n = coast.n, a = Math.floor(i), f = i - a, u = ((a % n) + n) % n, w = (u + 1) % n;
  return lerp(coast.water[u], coast.water[w], f);
}
/** How cliffy (0 to 1) the shore is at a fractional angle index. */
export function cliffAt(coast, i) {
  const n = coast.n, a = Math.floor(i), f = i - a, u = ((a % n) + n) % n, w = (u + 1) % n;
  return lerp(coast.cliff[u], coast.cliff[w], f);
}
/** The land's height at (x, z): the grid's, interpolated (Infinity-safe: below the first station it is the sea floor, past the last it is the last). */
export function groundAt(coast, x, z) {
  const n = coast.n, t = Math.atan2(z, x), fi = (((t / TAU) % 1) + 1) % 1 * n, r = Math.hypot(x, z), i0 = Math.floor(fi), f = fi - i0;
  const heightAlong = i => {
    const u = ((i % n) + n) % n, rr = coast.rad[u], hh = coast.high[u];
    if (r <= rr[0]) return hh[0];
    for (let k = 1; k < rr.length; k++) if (r <= rr[k]) return lerp(hh[k - 1], hh[k], (r - rr[k - 1]) / (rr[k] - rr[k - 1] || 1));
    return hh[hh.length - 1];
  };
  return lerp(heightAlong(i0), heightAlong(i0 + 1), f);
}
