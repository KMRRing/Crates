// Slipway's workshop: a block of timber with a ship's part laid in it as a ghost. No page here (the tests run it in Node);
// slipway-3d.js draws it, slipway-puzzle.js is the rules (what each tool may do), slipway.js takes the strokes.
//
// The block is a grid of cells, each holding how much wood is left in it (0 none, 255 whole), so a tool can take part of a
// cell and the surface can lie between cells. The part is a shape (a signed distance, in cells: negative inside) laid in
// the block where the player slides it; the ghost the page draws is that shape. Tools only take wood: the saw everything
// beyond a plane, the plane the high wood under its sole, the drill a cylinder along the line of sight.

export const SOLID = 128;                   // a cell at least this full is wood
export const CELL = 0.06, EYE = 14;         // a cell's size in the scene, and how far the camera stands from the block (scene units: far, so little perspective)
export const EYE_CELLS = EYE / CELL;
/** The named views, as [azimuth, elevation] in degrees: side and end look square along z and x, top straight down (just short of it, so up stays defined). */
export const VIEWS = { corner: [-30, 26], side: [0, 0], top: [0, 89.9], end: [90, 0] };

// ---------- shapes, in cells (a cell's middle at i + 0.5) ----------
/** A box centred (cx, cy, cz) with half sizes (hx, hy, hz), as a signed distance. */
export const box = (x, y, z, cx, cy, cz, hx, hy, hz) => {
  const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
};
/** A round bar along the y axis through (cx, cz), radius r: negative inside. (A hole is its inverse.) */
export const bar = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) - r;
/**
 * A solid with flat faces: the planes [nx, ny, nz, c] each mean n·p <= c. Its signed distance is the greatest of the
 * planes' (exact inside, a little short outside near the corners), and `planes` keeps them as unit normals for the saw
 * to find (slipway-puzzle.js snaps a cut to them).
 */
export function hull(planes) {
  const P = planes.map(([a, b, c, d]) => { const l = Math.hypot(a, b, c); return [a / l, b / l, c / l, d / l]; });
  return { planes: P, sdf: (x, y, z) => { let m = -Infinity; for (const [a, b, c, d] of P) m = Math.max(m, a * x + b * y + c * z - d); return m; } };
}
/** The six faces of a box from the origin to (x, y, z), as planes for hull(). */
export const boxPlanes = (x, y, z) => [[-1, 0, 0, 0], [1, 0, 0, x], [0, -1, 0, 0], [0, 1, 0, y], [0, 0, -1, 0], [0, 0, 1, z]];

// ---------- a block for a level ----------
export const idx = (b, i, j, k) => i + b.nx * (j + b.ny * k);
/**
 * A block for a level: { level, nx, ny, nz, d (Uint8Array, whole), knots, off (where along the block the part lies), flip
 * (end for end), target (Float32Array: the part's distance at each cell), inside (the part's cells), planes, holes }.
 * The block is the part's box plus `slack` cells along x, to slide the part in.
 */
export function newBlock(level, at = level.place) {
  const [px, ny, nz] = level.size, nx = px + (level.slack || 0);
  const b = { level, nx, ny, nz, px, d: new Uint8Array(nx * ny * nz).fill(255), knots: level.knots.map(k => k.slice()), off: 0, flip: false, target: null, inside: null, planes: [], holes: [], kerfs: [], grain: level.grain || 0 };
  place(b, at?.off ?? (level.slack || 0) / 2, !!at?.flip);
  return b;
}
/** Lays the part in the block, `off` cells along it, end for end if `flip`: works out the target and where its faces and holes lie. */
export function place(b, off, flip) {
  const L = b.level;
  b.off = Math.max(0, Math.min(b.nx - b.px, off));
  b.flip = !!flip;
  const a = b.flip ? -1 : 1, e = b.flip ? b.px + b.off : -b.off;       // part x = a * block x + e
  const t = new Float32Array(b.nx * b.ny * b.nz), inside = [];
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k), v = L.shape.sdf(a * (i + 0.5) + e, j + 0.5, k + 0.5);
    t[m] = v;
    if (v < 0) inside.push(m);
  }
  b.target = t;
  b.inside = Int32Array.from(inside);
  b.ip = new Float32Array(inside.length * 3);                          // the part's cells' middles, x y z each
  b.g = [0, 0, 0];                                                     // the part's centre of mass
  inside.forEach((m, q) => { const c = centre(b, m); b.ip.set(c, q * 3); b.g[0] += c[0]; b.g[1] += c[1]; b.g[2] += c[2]; });
  b.g = b.g.map(v => v / (inside.length || 1));
  // the part's own planes, in the block's coordinates: n·p <= c (a flat face a saw can follow)
  b.planes = (L.shape.planes || []).map(([nx, ny, nz, c]) => [nx * a, ny, nz, c - nx * e]);
  // a wall the back saw can score, and a dish the gouge can follow, in the block's coordinates
  const px = x => (x - e) / a;
  b.walls = (L.walls || []).map(w => { const u = [w.u[0] * a, w.u[1], w.u[2]], at = [px(w.at[0]), w.at[1], w.at[2]]; return { u, at, s: u[0] * at[0] + u[1] * at[1] + u[2] * at[2] }; });
  b.hollows = (L.hollows || []).map(h => ({ ...h, at: [px(h.at[0]), h.at[1], h.at[2]] }));
  b.holes = (L.holes || []).map(h => {
    // a hole's place across its axis (0 x, 1 y, 2 z): (y, z) for an axis along x, (x, z) along y, (x, y) along z, in part coordinates
    const bx = x => (x - e) / a;                                        // block x from part x
    return h.axis === 0 ? { axis: 0, at: h.at.slice() } : { axis: h.axis, at: [bx(h.at[0]), h.at[1]] };
  });
  return b;
}
/** The box (lo, hi in cells) round the wood that's left. */
export function woodBox(b) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    if (b.d[i + b.nx * (j + b.ny * k)] < SOLID) continue;
    if (i < lo[0]) lo[0] = i; if (j < lo[1]) lo[1] = j; if (k < lo[2]) lo[2] = k;
    if (i + 1 > hi[0]) hi[0] = i + 1; if (j + 1 > hi[1]) hi[1] = j + 1; if (k + 1 > hi[2]) hi[2] = k + 1;
  }
  return lo[0] === Infinity ? [0, 0, 0, b.nx, b.ny, b.nz] : [...lo, ...hi];
}
/** Where the camera stands (in cells) for a view [azimuth°, elevation°]: it looks at the middle of the wood that's left. */
export function eyeFor(b, [az, el]) {
  const w = woodBox(b), r = Math.PI / 180;
  return [(w[0] + w[3]) / 2 + EYE_CELLS * Math.cos(el * r) * Math.sin(az * r), (w[1] + w[4]) / 2 + EYE_CELLS * Math.sin(el * r), (w[2] + w[5]) / 2 + EYE_CELLS * Math.cos(el * r) * Math.cos(az * r)];
}
/** Whether a point lies in a knot. */
export const inKnot = (b, x, y, z) => b.knots.some(([kx, ky, kz, kr]) => (x - kx) ** 2 + (y - ky) ** 2 + (z - kz) ** 2 < kr * kr);
/** A cell's middle, from its index. */
export const centre = (b, m) => { const i = m % b.nx, j = Math.floor(m / b.nx) % b.ny, k = Math.floor(m / (b.nx * b.ny)); return [i + 0.5, j + 0.5, k + 0.5]; };

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
/** Where a ray (origin o, direction d, in cells) first meets wood: { p, n, t } or null. */
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

// ---------- the tools: each takes wood and says how much (in cells) ----------
/** Takes `amount` (0..1 of a whole cell) from a cell, never below what's there. */
function take(b, m, amount) {
  if (amount <= 0) return 0;
  const before = b.d[m], after = Math.max(0, Math.min(before, Math.round(before - 255 * amount)));
  b.d[m] = after;
  return (before - after) / 255;
}
/** The saw: everything beyond the plane u·p = s (u a unit normal, pointing at the waste) goes, the cells the plane passes through losing the part of them beyond it. */
export function cut(b, u, s) {
  let took = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const v = u[0] * (i + 0.5) + u[1] * (j + 0.5) + u[2] * (k + 0.5) - s;
    if (v <= -0.5) continue;
    took += take(b, idx(b, i, j, k), Math.min(1, v + 0.5));
  }
  return took;
}
/** The drill: a hole of radius r from where it touches (p), straight along d, right through. */
export function drill(b, p, d, r = 1.5) {
  const l = Math.hypot(...d), ux = d[0] / l, uy = d[1] / l, uz = d[2] / l;
  let took = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const wx = i + 0.5 - p[0], wy = j + 0.5 - p[1], wz = k + 0.5 - p[2], t = wx * ux + wy * uy + wz * uz;
    if (t < -1) continue;
    const off = Math.hypot(wx - ux * t, wy - uy * t, wz - uz * t), amount = Math.max(0, Math.min(1, r - off + 0.5));
    if (amount > 0) took += take(b, idx(b, i, j, k), amount);
  }
  return took;
}
export const SOLE = 3.5, REACH = 2.5;                // the plane's sole is 7 cells across; it takes the top three layers of the waste under it
/** The stroke tools: how wide (sole, to each side), how deep (reach), how near the line they stop (floor), and whether a knot stops them. */
export const STROKE = {
  plane: { sole: SOLE, reach: REACH, floor: 0.5, knots: true },
  adze: { sole: 4.5, reach: 4.5, floor: 1.4, knots: false },
};
/**
 * A stroke tool (the plane, the adze): its sole lies flat on the wood facing n and is drawn along the points `pts` (on the
 * surface). Under the sole it takes the highest waste, `reach` cells deep from the highest wood under it, and never past
 * the line (the part's own surface, plus the tool's `floor`). A knot under the sole stops the plane. Returns { took, knot }.
 */
export function plane(b, n, pts, o = STROKE.plane) {
  const hits = [];
  let top = -Infinity, knot = false;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k);
    if (b.d[m] < 16 || b.target[m] <= o.floor) continue;               // gone already, or the part (or the line)
    const x = i + 0.5, y = j + 0.5, z = k + 0.5;
    let near = Infinity;
    for (const q of pts) {
      const wx = x - q[0], wy = y - q[1], wz = z - q[2], a = wx * n[0] + wy * n[1] + wz * n[2];
      near = Math.min(near, Math.hypot(wx - n[0] * a, wy - n[1] * a, wz - n[2] * a));
    }
    if (near > o.sole) continue;
    if (o.knots && inKnot(b, x, y, z)) { knot = true; continue; }
    hits.push(m);
    top = Math.max(top, x * n[0] + y * n[1] + z * n[2]);
  }
  if (knot) return { took: 0, knot: true };
  let took = 0;
  for (const m of hits) {
    const c = centre(b, m);
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] >= top - o.reach + 1e-6) took += take(b, m, 1);
  }
  return { took, knot: false };
}
export const SHAVE = { sole: 3.5, skin: 1.6 };
/**
 * The spokeshave: it follows the surface under the stroke, taking the thin skin (cells within `sole` of the stroke's
 * points that lie over the line). Deep stock under it (more than `skin` cells over the line) jams it, and a knot stops it.
 * Returns { took, knot, jam }.
 */
export function shave(b, pts, o = SHAVE) {
  const hits = [];
  let knot = false, jam = false;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k);
    if (b.d[m] < 16 || b.target[m] <= 0.5) continue;
    const x = i + 0.5, y = j + 0.5, z = k + 0.5;
    let near = Infinity;
    for (const q of pts) near = Math.min(near, Math.hypot(x - q[0], y - q[1], z - q[2]));
    if (near > o.sole) continue;
    if (inKnot(b, x, y, z)) knot = true;
    if (b.target[m] > o.skin) jam = true;
    hits.push(m);
  }
  if (knot || jam) return { took: 0, knot, jam };
  let took = 0;
  for (const m of hits) took += take(b, m, 1);
  return { took, knot: false, jam: false };
}
export const CHOP = { half: 3.6, depth: 8 };
/**
 * The chisel: a column `half` cells to each side of the line of the blow (p, along the axis d) and `depth` layers deep from
 * the highest waste in it, taking only the cells `free` allows (the ones whose grain-wise walls are scored). Never past the line. Returns { took, blocked }: the cells it refused.
 */
export function chop(b, p, d, free, o = CHOP) {
  const ax = d.findIndex(v => Math.abs(v) > 0.5), others = [0, 1, 2].filter(a => a !== ax), sgn = Math.sign(d[ax]), hits = [];
  let top = -Infinity, blocked = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k);
    if (b.d[m] < 16 || b.target[m] <= 0.5) continue;
    const c = [i + 0.5, j + 0.5, k + 0.5];
    if (Math.abs(c[others[0]] - p[others[0]]) > o.half || Math.abs(c[others[1]] - p[others[1]]) > o.half || (c[ax] - p[ax]) * sgn < -1) continue;
    if (!free(c)) { blocked++; continue; }
    hits.push([m, -c[ax] * sgn]);
    top = Math.max(top, -c[ax] * sgn);
  }
  let took = 0;
  for (const [m, h] of hits) if (h >= top - o.depth + 0.5 + 1e-6) took += take(b, m, 1);
  return { took, blocked };
}
/** The gouge: the waste inside a sphere of radius r about c goes (never the part). */
export function gouge(b, c, r) {
  let took = 0;
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k);
    if (b.d[m] < 16 || b.target[m] <= 0.5) continue;
    if (Math.hypot(i + 0.5 - c[0], j + 0.5 - c[1], k + 0.5 - c[2]) <= r + 0.3) took += take(b, m, 1);
  }
  return took;
}
export const WALL = 1.8;
/** Whether wood round a bore (or a dish's rim) of radius r about the line (p, d) is thinner than WALL anywhere along it: it would split. */
export function thin(b, p, d, r, from = 0) {
  const l = Math.hypot(...d), u = d.map(v => v / l);
  const e1 = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let a = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  const al = Math.hypot(...a); a = a.map(v => v / al);
  const c = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
  const reach = Math.hypot(b.nx, b.ny, b.nz) + 12;
  for (let t = from; t < reach; t += 1) {
    const q = [p[0] + u[0] * t, p[1] + u[1] * t, p[2] + u[2] * t];
    if (sample(b, ...q) < SOLID) continue;
    for (let k = 0; k < 8; k++) {
      const th = k * Math.PI / 4, dx = Math.cos(th) * a[0] + Math.sin(th) * c[0], dy = Math.cos(th) * a[1] + Math.sin(th) * c[1], dz = Math.cos(th) * a[2] + Math.sin(th) * c[2];
      for (let s = r + 0.5; s <= r + WALL + 1e-6; s += 0.5) if (sample(b, q[0] + dx * s, q[1] + dy * s, q[2] + dz * s) < SOLID) return true;
    }
  }
  return false;
}

// ---------- the grade ----------
/**
 * How the part is coming on: { waste (0..1 of the spare wood still on), left (the waste still on, in cells), over (that as a
 * share of the part's own volume), into (0..1 of the part cut away), knots (how many knots are in the part) }. A band a cell wide either side
 * of the line is neither, as a pencil line is.
 */
export function grade(b) {
  let spare = 0, left = 0, part = 0, gone = 0;
  const knotIn = new Set();
  for (let k = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
    const m = idx(b, i, j, k), t = b.target[m], d = b.d[m] / 255;
    if (t > 0.7) { spare++; left += d; }
    else if (t < -0.7) {
      part++; gone += 1 - d;
      if (d > 0.5) for (let q = 0; q < b.knots.length; q++) { const kn = b.knots[q]; if ((i + 0.5 - kn[0]) ** 2 + (j + 0.5 - kn[1]) ** 2 + (k + 0.5 - kn[2]) ** 2 < kn[3] * kn[3]) knotIn.add(q); }
    }
  }
  return { waste: spare ? left / spare : 0, left, over: part ? left / part : 0, into: part ? gone / part : 0, knots: knotIn.size };
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
