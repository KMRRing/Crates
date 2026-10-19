// Slipway's workshop: a block of timber worked by hand into a ship's part. No page here (tests/slipway.mjs runs it in
// Node); slipway-3d.js draws it and slipway.js takes the strokes.
//
// The block is a grid of cells, each holding how much wood is left in it (0 none, 255 whole), so a tool can take part
// of a cell and a surface can lie between cells. The part is a shape (a signed distance: negative inside, in cells)
// laid in the block where the player slides it; the ghost outline the page draws is that shape. Every tool takes
// wood and never puts it back: the saw everything on one side of a plane (the side with less of the part in it falls
// away), the plane and the chisel a cap of a sphere where they touch, the drill a cylinder along the line of sight, the
// sandpaper smooths by taking the bumps. Knots are harder: the plane and the chisel take a third as much from them, and
// a knot left in the finished part weakens it. The grade is how little waste is left, how little of the part was cut
// into, and whether a knot is in it.

export const SLACK = 10;                    // cells of spare timber along the block, to slide the part in (round the knots)
export const SOLID = 128;                   // a cell at least this full is wood

// ---------- shapes, in cells (a cell's middle at i + 0.5) ----------
const len2 = (a, b) => Math.sqrt(a * a + b * b);
const box = (x, y, z, cx, cy, cz, hx, hy, hz) => {
  const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
};
/** A round rod along x from x0 to x1, radius r(x) (a taper), its axis at (cy, cz). */
const rod = (x, y, z, x0, x1, cy, cz, r) => Math.max(len2(y - cy, z - cz) - r(Math.max(x0, Math.min(x1, x))), x0 - x, x - x1);
/** A band of an arc in the x-y plane, centred (cx, cy), radius r its middle, w wide, t thick in z, between angles a0 and a1 (0..2π). */
const arc = (x, y, z, cx, cy, cz, r, w, t, a0, a1) => {
  const dx = x - cx, dy = y - cy, d = len2(dx, dy);
  let a = Math.atan2(dy, dx);
  if (a < 0) a += 2 * Math.PI;
  const out = a < a0 ? a0 - a : a > a1 ? a - a1 : 0;
  const ends = out > 0 ? d * Math.sin(Math.min(out, Math.PI / 2)) : -d * Math.sin(Math.min(a - a0, a1 - a, Math.PI / 2));
  return Math.max(Math.abs(d - r) - w / 2, Math.abs(z - cz) - t / 2, ends);
};
const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));

/**
 * The cog's parts, the easiest first: each a name, a line of what it's for, its size in cells (the part's own box, the
 * block adds SLACK along x) and its shape. Every one runs along the grain (x), as a shipwright would take it.
 */
export const PARTS = [
  { id: "wedge", name: "Mast wedge", tools: "saw", line: "Driven round the mast where it passes the deck, to hold it tight: two saw cuts.",
    size: [30, 12, 12], sdf: (x, y, z) => { const top = lerp(10, 4, (x - 3) / 24); return Math.max(3 - x, x - 27, Math.abs(z - 6) - 3.5, 2 - y, (y - top) / Math.hypot(1, 6 / 24)); } },
  { id: "treenail", name: "Treenail", tools: "saw, plane", line: "A wooden peg, a trenail: the cog's planks are pinned to her frames with hundreds of them.",
    size: [30, 10, 10], sdf: (x, y, z) => rod(x, y, z, 3, 27, 5, 5, u => (u < 7 ? lerp(1.6, 3.2, (u - 3) / 4) : 3.2)) },
  { id: "pin", name: "Belaying pin", tools: "saw, plane, chisel", line: "A ship's ropes are made fast round these, in a rail by the mast.",
    size: [34, 10, 10], sdf: (x, y, z) => rod(x, y, z, 3, 31, 5, 5, u => (u < 13 ? 3.4 : u < 15 ? 4 : lerp(2.6, 2, (u - 15) / 16))) },
  { id: "beam", name: "Deck beam", tools: "saw, plane", line: "It runs across the hull under the deck: its top is cambered, higher in the middle, so water runs off.",
    size: [56, 14, 12], sdf: (x, y, z) => { const camber = 2.4 * (1 - ((x - 28) / 25) ** 2); return Math.max(3 - x, x - 53, Math.abs(z - 6) - 4, 3 - y, y - (8 + camber)); } },
  { id: "sheave", name: "Block shell", tools: "saw, chisel, drill", line: "The shell of a block, the sailor's pulley: a rounded case, a slot for the sheave, a hole for its pin.",
    size: [26, 18, 14], sdf: (x, y, z) => {
      const shell = box(x, y, z, 13, 9, 7, 9, 6.2, 4.2) - 1.8;
      const slot = box(x, y, z, 13, 9, 7, 6.5, 9, 1.6);
      const hole = len2(x - 13, y - 9) - 1.7;
      return Math.max(shell, -slot, -hole);
    } },
  { id: "tiller", name: "Tiller", tools: "saw, plane, chisel", line: "The helmsman's bar, through the rudder's head: square where it fits the mortise, round where the hand goes.",
    size: [60, 12, 12], sdf: (x, y, z) => { const sq = box(x, y, z, 10, 6, 6, 7, 3.6, 3.6); const round = rod(x, y, z, 15, 57, 6, 6, u => lerp(3.4, 2.1, (u - 15) / 42)); return Math.min(sq, round); } },
  { id: "frame", name: "Frame", tools: "saw, chisel, plane", line: "A rib: the frames give the hull its shape, and the planks are pinned to them.",
    size: [56, 26, 10], sdf: (x, y, z) => arc(x, y, z, 28, 28, 5, 21, 5, 6, Math.PI * 1.1, Math.PI * 1.9) },
  { id: "yard", name: "Yard", tools: "saw, plane", line: "The spar the sail hangs from, thickest in the middle and tapering to both arms.",
    size: [64, 10, 10], sdf: (x, y, z) => rod(x, y, z, 3, 61, 5, 5, u => lerp(3.6, 1.6, Math.abs(u - 32) / 29)) },
  { id: "stem", name: "Stem", tools: "saw, chisel, plane", line: "The timber that rises from the keel to make her bow, curved as she is.",
    size: [32, 30, 10], sdf: (x, y, z) => arc(x, y, z, 4, 28, 5, 23, 5.5, 6, Math.PI * 1.5, Math.PI * 1.97) },
  { id: "rudder", name: "Rudder", tools: "saw, plane, chisel, drill", line: "Hung on the sternpost, which was new in the cog's day: the stock above, the blade below, a hole for the tiller.",
    size: [54, 22, 10], sdf: (x, y, z) => {
      const stock = rod(x, y, z, 2, 20, 15, 5, () => 2.6);
      const blade = Math.max(box(x, y, z, 31, 10, 5, 21, 7.5, 3), Math.abs(z - 5) - lerp(2.8, 1.2, (x - 10) / 42));
      return Math.max(Math.min(stock, blade), -(len2(x - 6, z - 5) - 1.3));
    } },
  { id: "mast", name: "Masthead", tools: "saw, plane, drill", line: "The top of the mast, tapered, with a hole through it for the halyard that hoists the yard.",
    size: [64, 12, 12], sdf: (x, y, z) => Math.max(rod(x, y, z, 2, 62, 6, 6, u => lerp(4.2, 2.8, (u - 2) / 60)), -(len2(x - 54, z - 6) - 1.3)) },
];

// ---------- a block for a part ----------
/** A small random generator from a seed (the same block every time from the same seed). */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/**
 * A block of timber for part p (an index or a part): { part, nx, ny, nz, d (Uint8Array, whole), knots: [[x, y, z, r]],
 * off (where along the block the part lies), flip (end for end), target (Float32Array: the part's distance at each cell) }.
 */
export function newBlock(p, seed = 1) {
  const part = typeof p === "number" ? PARTS[p] : p;
  const [px, ny, nz] = part.size, nx = px + SLACK, r = rng(seed);
  const knots = [];
  const count = 1 + Math.floor(r() * 2);
  for (let k = 0; k < count; k++) knots.push([2 + r() * (nx - 4), 1.5 + r() * (ny - 3), 1.5 + r() * (nz - 3), 1.3 + r() * 1.1]);
  const b = { part, nx, ny, nz, d: new Uint8Array(nx * ny * nz).fill(255), knots, off: SLACK / 2, flip: false, target: null };
  place(b, b.off, b.flip);
  return b;
}
export const idx = (b, i, j, k) => i + b.nx * (j + b.ny * k);
/** Lays the part in the block, `off` cells along it, end for end if `flip`: works out the target again. */
export function place(b, off, flip) {
  b.off = Math.max(0, Math.min(SLACK, off));
  b.flip = !!flip;
  const t = new Float32Array(b.nx * b.ny * b.nz), px = b.part.size[0];
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    let x = i + 0.5 - b.off;
    if (b.flip) x = px - x;
    t[idx(b, i, j, k)] = b.part.sdf(x, j + 0.5, k + 0.5);
  }
  b.target = t;
  return b;
}
/** How hard a cell is to cut: 1 for clear wood, less in a knot. */
function give(b, x, y, z) {
  let g = 1;
  for (const [kx, ky, kz, kr] of b.knots) if ((x - kx) ** 2 + (y - ky) ** 2 + (z - kz) ** 2 < kr * kr) g = 0.33;
  return g;
}
const inKnot = (b, x, y, z) => b.knots.some(([kx, ky, kz, kr]) => (x - kx) ** 2 + (y - ky) ** 2 + (z - kz) ** 2 < kr * kr);

// ---------- looking into the block ----------
/** How full the block is at a point (trilinear between the cells' middles), 0..255; outside the block 0. */
export function sample(b, x, y, z) {
  x -= 0.5; y -= 0.5; z -= 0.5;
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k;
  const at = (a, c, e) => (a < 0 || c < 0 || e < 0 || a >= b.nx || c >= b.ny || e >= b.nz ? 0 : b.d[idx(b, a, c, e)]);
  const l = (a, c) => a + (c - a) * u;
  const x00 = l(at(i, j, k), at(i + 1, j, k)), x10 = l(at(i, j + 1, k), at(i + 1, j + 1, k));
  const x01 = l(at(i, j, k + 1), at(i + 1, j, k + 1)), x11 = l(at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1));
  return (x00 + (x10 - x00) * v) + ((x01 + (x11 - x01) * v) - (x00 + (x10 - x00) * v)) * w;
}
/** The surface's outward normal at a point. */
export function normalAt(b, x, y, z, e = 0.6) {
  const gx = sample(b, x + e, y, z) - sample(b, x - e, y, z), gy = sample(b, x, y + e, z) - sample(b, x, y - e, z), gz = sample(b, x, y, z + e) - sample(b, x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  return [-gx / l, -gy / l, -gz / l];
}
/** Where a ray (origin o, direction d, in cells) first meets wood: { p, n } or null. */
export function hit(b, o, d) {
  const l = Math.hypot(...d), dir = d.map(v => v / l);
  // the ray against the block's box first, so a far camera doesn't march through empty air
  let t0 = 0, t1 = Infinity;
  const hi = [b.nx, b.ny, b.nz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-9) { if (o[a] < 0 || o[a] > hi[a]) return null; continue; }
    let ta = (0 - o[a]) / dir[a], tb = (hi[a] - o[a]) / dir[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (t0 > t1) return null;
  let prev = t0;
  for (let t = t0; t <= t1 + 0.5; t += 0.2) {
    const p = [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t];
    if (sample(b, ...p) >= SOLID) {
      let lo = prev, up = t;                                             // the edge between, by halves
      for (let s = 0; s < 6; s++) { const m = (lo + up) / 2; if (sample(b, o[0] + dir[0] * m, o[1] + dir[1] * m, o[2] + dir[2] * m) >= SOLID) up = m; else lo = m; }
      const q = [o[0] + dir[0] * up, o[1] + dir[1] * up, o[2] + dir[2] * up];
      return { p: q, n: normalAt(b, ...q), t: up };
    }
    prev = t;
  }
  return null;
}

// ---------- the tools: each takes wood, returns how much it took (in cells) ----------
/**
 * The cells open to the air when a stroke begins (any not whole, or beside one that isn't wood): a stroke of the plane
 * or the chisel takes only from those, so going over the same place again in one stroke takes nothing more, and a
 * deeper cut is another stroke, as at the bench.
 */
export function exposed(b) {
  const m = new Uint8Array(b.d.length), { nx, ny, nz, d } = b;
  const open = (i, j, k) => i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz || d[i + nx * (j + ny * k)] < SOLID;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = i + nx * (j + ny * k);
    m[n] = d[n] < 255 || open(i - 1, j, k) || open(i + 1, j, k) || open(i, j - 1, k) || open(i, j + 1, k) || open(i, j, k - 1) || open(i, j, k + 1) ? 1 : 0;
  }
  return m;
}
/** Takes `amount` (0..1 of a whole cell) from a cell, never below what's there. */
function take(b, n, amount) {
  if (amount <= 0 || (b.mask && !b.mask[n])) return 0;
  const before = b.d[n], after = Math.max(0, Math.min(before, Math.round(before - 255 * amount)));
  b.d[n] = after;
  return (before - after) / 255;
}
/**
 * The saw: everything on one side of the plane n·p + c = 0 goes; of the two sides, the one with less of the part in it
 * (the offcut). Cells the plane passes through lose the part of them on that side. Returns { took, side, into }: into
 * is how many cells of the part it cut away (a cut through the part is allowed, and graded).
 */
export function saw(b, n, c) {
  const l = Math.hypot(...n), [a, e, f] = n.map(v => v / l), cc = c / l;
  let plus = 0, minus = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k);
    if (b.target[m] >= 0 || b.d[m] < SOLID) continue;
    const s = a * (i + 0.5) + e * (j + 0.5) + f * (k + 0.5) + cc;
    if (s > 0) plus++; else minus++;
  }
  const side = plus <= minus ? 1 : -1;
  let took = 0, into = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k), s = side * (a * (i + 0.5) + e * (j + 0.5) + f * (k + 0.5) + cc);
    if (s <= -0.5 || !b.d[m]) continue;
    const before = b.d[m];
    took += take(b, m, Math.min(1, s + 0.5));
    if (b.target[m] < -0.5 && before >= SOLID && b.d[m] < SOLID) into++;
  }
  return { took, side, into };
}
/** A cap of a sphere: where a tool touches the wood at p (outward normal n), radius r, `depth` deep. */
function cap(b, p, n, r, depth, kind) {
  const c = [p[0] + n[0] * (r - depth), p[1] + n[1] * (r - depth), p[2] + n[2] * (r - depth)];
  const lo = c.map(v => Math.floor(v - r - 1)), hi = c.map(v => Math.ceil(v + r + 1));
  let took = 0;
  for (let k = Math.max(0, lo[2]); k < Math.min(b.nz, hi[2]); k++) for (let j = Math.max(0, lo[1]); j < Math.min(b.ny, hi[1]); j++) for (let i = Math.max(0, lo[0]); i < Math.min(b.nx, hi[0]); i++) {
    const x = i + 0.5, y = j + 0.5, z = k + 0.5, dist = Math.hypot(x - c[0], y - c[1], z - c[2]);
    const amount = Math.max(0, Math.min(1, r - dist + 0.5));
    if (amount > 0) took += take(b, idx(b, i, j, k), amount * (kind === "sand" ? 1 : give(b, x, y, z)));
  }
  return took;
}
/**
 * The plane: its sole lies flat on the wood, facing n, and its blade is set to cut at the height `cut` along n (n·x =
 * cut): under the sole, a disc R across round p, everything above that height goes, high spots and all, and hollows
 * are left. Through a stroke the page keeps the blade a shaving under the highest wood the sole has passed over, so it
 * never sinks into a hollow and digs, going over the same place again takes nothing more, and the next stroke, set on
 * the surface this one left, takes the next shaving. Wood more than two cells proud of the
 * blade is too much for one pass.
 */
export function plane(b, p, n, cut = p[0] * n[0] + p[1] * n[1] + p[2] * n[2] - 0.1, R = 3.4) {
  const lo = p.map(v => Math.floor(v - R - 3)), hi = p.map(v => Math.ceil(v + R + 3));
  let took = 0;
  for (let k = Math.max(0, lo[2]); k < Math.min(b.nz, hi[2]); k++) for (let j = Math.max(0, lo[1]); j < Math.min(b.ny, hi[1]); j++) for (let i = Math.max(0, lo[0]); i < Math.min(b.nx, hi[0]); i++) {
    const x = i + 0.5, y = j + 0.5, z = k + 0.5;
    const along = x * n[0] + y * n[1] + z * n[2] - cut;
    if (along < -0.5 || along > 2) continue;
    const w = [x - p[0], y - p[1], z - p[2]], a = w[0] * n[0] + w[1] * n[1] + w[2] * n[2];
    const radial = Math.hypot(w[0] - n[0] * a, w[1] - n[1] * a, w[2] - n[2] * a);
    const amount = Math.min(1, along + 0.5) * Math.min(1, Math.max(0, R - radial + 0.5));
    if (amount > 0) took += take(b, idx(b, i, j, k), amount * give(b, x, y, z));
  }
  return took;
}
/** Where a stroke of the plane begun at p (facing n) cuts: a shaving of 0.45 of a cell below the surface it touched. */
export const planeCut = (p, n) => p[0] * n[0] + p[1] * n[1] + p[2] * n[2] - 0.45;
/** A normal held square: within 8° of one of the block's axes, it's that axis (a face meant to be flat stays flat). */
export function steady(n) {
  const l = Math.hypot(...n) || 1, a = n.map(v => Math.abs(v) / l), m = Math.max(...a), i = a.indexOf(m);
  if (m < Math.cos(8 * Math.PI / 180)) return n;
  const out = [0, 0, 0];
  out[i] = Math.sign(n[i]);
  return out;
}
/** The chisel: a small, deeper cut. */
export const chisel = (b, p, n) => cap(b, p, n, 1.25, 0.8, "chisel");
/** The drill: a hole of radius 1.5 from where it touches, straight along d, right through. */
export function drill(b, p, d, r = 1.5) {
  const l = Math.hypot(...d), u = d.map(v => v / l);
  let took = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const w = [i + 0.5 - p[0], j + 0.5 - p[1], k + 0.5 - p[2]], t = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
    if (t < -1) continue;
    const off = Math.hypot(w[0] - u[0] * t, w[1] - u[1] * t, w[2] - u[2] * t);
    const amount = Math.max(0, Math.min(1, r - off + 0.5));
    if (amount > 0) took += take(b, idx(b, i, j, k), amount);
  }
  return took;
}
/** Sandpaper: round p, each cell no fuller than the average of it and its neighbours (it smooths, and never adds). */
export function sand(b, p, r = 2.4) {
  const lo = p.map(v => Math.floor(v - r)), hi = p.map(v => Math.ceil(v + r));
  const next = [];
  for (let k = Math.max(0, lo[2]); k < Math.min(b.nz, hi[2]); k++) for (let j = Math.max(0, lo[1]); j < Math.min(b.ny, hi[1]); j++) for (let i = Math.max(0, lo[0]); i < Math.min(b.nx, hi[0]); i++) {
    if (Math.hypot(i + 0.5 - p[0], j + 0.5 - p[1], k + 0.5 - p[2]) > r) continue;
    const at = (a, c, e) => (a < 0 || c < 0 || e < 0 || a >= b.nx || c >= b.ny || e >= b.nz ? 0 : b.d[idx(b, a, c, e)]);
    const avg = (at(i, j, k) * 2 + at(i - 1, j, k) + at(i + 1, j, k) + at(i, j - 1, k) + at(i, j + 1, k) + at(i, j, k - 1) + at(i, j, k + 1)) / 8;
    next.push([idx(b, i, j, k), avg]);
  }
  let took = 0;
  for (const [m, avg] of next) took += take(b, m, (b.d[m] - avg) / 255 * 0.8);
  return took;
}

// ---------- the grade ----------
/**
 * How the part is coming on: { waste (0..1 of the spare wood still on), over (the waste left as a share of the part's
 * own volume), into (0..1 of the part cut away), knots (how many knots are in the part), score (0..100), stars (0..3) }.
 * The score counts the waste against the part, not against the block, so roughing out is nothing: a treenail left
 * square is a star, planed to an octagon two, rounded three. A band a cell wide either side of the line is neither,
 * as a pencil line is.
 */
export function grade(b) {
  let spare = 0, left = 0, part = 0, gone = 0;
  const knotIn = new Set();
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k), t = b.target[m], d = b.d[m] / 255;
    if (t > 0.7) { spare++; left += d; }
    else if (t < -0.7) {
      part++; gone += 1 - d;
      if (d > 0.5) b.knots.forEach((kn, q) => { if ((i + 0.5 - kn[0]) ** 2 + (j + 0.5 - kn[1]) ** 2 + (k + 0.5 - kn[2]) ** 2 < kn[3] * kn[3]) knotIn.add(q); });
    }
  }
  const waste = spare ? left / spare : 0, over = part ? left / part : 0, into = part ? gone / part : 0, knots = knotIn.size;
  const score = Math.max(0, Math.min(100, Math.round(100 - 100 * Math.min(1, over) - 300 * into - 12 * knots)));
  const stars = score >= 90 ? 3 : score >= 75 ? 2 : score >= 55 ? 1 : 0;
  return { waste, over, into, knots, score, stars };
}

// ---------- the surface, for drawing: naive surface nets ----------
/**
 * The wood's surface as triangles: { pos (Float32Array, in cells), nor, count } where the grid crosses SOLID. Surface
 * nets: a vertex in every cube of eight cells' middles that the surface passes through (at the mean of where it crosses
 * the cube's edges), and a quad across each edge between two cells, one wood and one not, joining the four cubes round
 * it, wound so it faces out. `of` picks another grid (the offcut's) of the same size.
 */
export function mesh(b, of = b.d) {
  const { nx, ny, nz } = b, X = nx + 1, Y = ny + 1;
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? 0 : of[i + nx * (j + ny * k)]);
  const vid = new Int32Array((nx + 1) * (ny + 1) * (nz + 1)).fill(-1), cube = (i, j, k) => (i + 1) + X * ((j + 1) + Y * (k + 1));
  const verts = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const v = new Array(8);
  for (let k = -1; k < nz; k++) for (let j = -1; j < ny; j++) for (let i = -1; i < nx; i++) {
    let mask = 0;
    for (let q = 0; q < 8; q++) { v[q] = at(i + C[q][0], j + C[q][1], k + C[q][2]); if (v[q] >= SOLID) mask |= 1 << q; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, c] of E) {
      if ((v[a] >= SOLID) === (v[c] >= SOLID)) continue;
      const u = (SOLID - v[a]) / (v[c] - v[a]);
      sx += C[a][0] + (C[c][0] - C[a][0]) * u; sy += C[a][1] + (C[c][1] - C[a][1]) * u; sz += C[a][2] + (C[c][2] - C[a][2]) * u; n++;
    }
    vid[cube(i, j, k)] = verts.length / 3;
    verts.push(i + 0.5 + sx / n, j + 0.5 + sy / n, k + 0.5 + sz / n);
  }
  const tris = [];
  const quad = (a, c, e, f, out) => { if (a < 0 || c < 0 || e < 0 || f < 0) return; if (out) tris.push(a, c, e, a, e, f); else tris.push(a, f, e, a, e, c); };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const solid = at(i, j, k) >= SOLID;
    // across +x: the four cubes round the edge from this cell's middle to the next's
    if (solid !== (at(i + 1, j, k) >= SOLID)) quad(vid[cube(i, j - 1, k - 1)], vid[cube(i, j, k - 1)], vid[cube(i, j, k)], vid[cube(i, j - 1, k)], solid);
    if (solid !== (at(i, j + 1, k) >= SOLID)) quad(vid[cube(i - 1, j, k - 1)], vid[cube(i - 1, j, k)], vid[cube(i, j, k)], vid[cube(i, j, k - 1)], solid);
    if (solid !== (at(i, j, k + 1) >= SOLID)) quad(vid[cube(i - 1, j - 1, k)], vid[cube(i, j - 1, k)], vid[cube(i, j, k)], vid[cube(i - 1, j, k)], solid);
  }
  // the faces on the block's own sides (cells next to outside, at index -1): the loops above start at 0, so do those too
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    if (at(0, j, k) >= SOLID) quad(vid[cube(-1, j - 1, k - 1)], vid[cube(-1, j, k - 1)], vid[cube(-1, j, k)], vid[cube(-1, j - 1, k)], false);
  }
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    if (at(i, 0, k) >= SOLID) quad(vid[cube(i - 1, -1, k - 1)], vid[cube(i - 1, -1, k)], vid[cube(i, -1, k)], vid[cube(i, -1, k - 1)], false);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (at(i, j, 0) >= SOLID) quad(vid[cube(i - 1, j - 1, -1)], vid[cube(i, j - 1, -1)], vid[cube(i, j, -1)], vid[cube(i - 1, j, -1)], false);
  }
  const pos = new Float32Array(tris.length * 3), nor = new Float32Array(tris.length * 3);
  const grid = { ...b, d: of };
  tris.forEach((vi, q) => {
    const x = verts[vi * 3], y = verts[vi * 3 + 1], z = verts[vi * 3 + 2];
    pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z;
    const nn = normalAt(grid, x, y, z);
    nor[q * 3] = nn[0]; nor[q * 3 + 1] = nn[1]; nor[q * 3 + 2] = nn[2];
  });
  return { pos, nor, count: tris.length };
}
/** The part's distance at a point (trilinear between cells), for marking the surface: + spare wood, - cut into the part. */
export function targetAt(b, x, y, z) {
  x -= 0.5; y -= 0.5; z -= 0.5;
  const i = Math.max(0, Math.min(b.nx - 2, Math.floor(x))), j = Math.max(0, Math.min(b.ny - 2, Math.floor(y))), k = Math.max(0, Math.min(b.nz - 2, Math.floor(z)));
  const u = x - i, v = y - j, w = z - k, t = (a, c, e) => b.target[idx(b, a, c, e)];
  const l = (a, c, s) => a + (c - a) * s;
  return l(l(l(t(i, j, k), t(i + 1, j, k), u), l(t(i, j + 1, k), t(i + 1, j + 1, k), u), v), l(l(t(i, j, k + 1), t(i + 1, j, k + 1), u), l(t(i, j + 1, k + 1), t(i + 1, j + 1, k + 1), u), v), w);
}
/** The part alone, as a grid (whole inside its shape), for drawing its ghost. */
export function ghostGrid(b) {
  const g = new Uint8Array(b.d.length);
  for (let m = 0; m < g.length; m++) g[m] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - b.target[m]))));
  return g;
}

// ---------- keeping a block ----------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** The block's wood as text, run-length coded (most of it is whole or gone), for localStorage. */
export function pack(d) {
  const out = [];
  for (let m = 0; m < d.length;) {
    let n = 1;
    while (m + n < d.length && d[m + n] === d[m] && n < 4095) n++;
    out.push(B64[d[m] >> 2], B64[((d[m] & 3) << 4) | (n >> 8)], B64[(n >> 2) & 63], B64[n & 3]);
    m += n;
  }
  return out.join("");
}
export function unpack(text, size) {
  const d = new Uint8Array(size), at = c => B64.indexOf(c);
  let m = 0;
  for (let q = 0; q + 3 < text.length && m < size; q += 4) {
    const a = at(text[q]), c = at(text[q + 1]), e = at(text[q + 2]), f = at(text[q + 3]);
    const v = (a << 2) | (c >> 4), n = ((c & 15) << 8) | (e << 2) | f;
    d.fill(v, m, Math.min(size, m + n));
    m += n;
  }
  return d;
}
