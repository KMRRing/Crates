// What Bridges' model view (bridges-3d.js, drawn with three.js) works out that has no picture in it, kept apart so it is
// tested in Node: where the ships sail (through whatever water is free), where a viaduct stands on piers, the curve of its
// arches, the plates of numbers on the islands. The model's world has a cell for a unit, the board's middle at the origin, x along a row, z down
// a column (towards the camera at the start) and y up, the water at 0.

/** The world's x and z of the middle of a cell. */
export const cellXZ = (size, r, c) => [c + 0.5 - size / 2, r + 0.5 - size / 2];
/** The number on an island's plate: 4, 4+ (at least) or ≤4 (at most). */
export { labelOf } from "./bridges-engine.js";
/** An island's radius in cells from its number: a one is an islet, an eight nearly fills its cell. Islands are two cells apart at least, so even two eights leave a cell of water for the bridge. */
export const islandRadius = n => 0.28 + 0.032 * (Math.max(1, Math.min(8, n || 1)) - 1);
/** The heading, a turn about y, that points a ship (whose bow is its +x) along (dx, dz). */
export const headingOf = (dx, dz) => Math.atan2(-dz, dx);

// ---------- the ships: they sail through whatever water is free ----------
// A ship may go where nothing stands: not on an island, not under a built low bridge, not under a viaduct's pier; and under a
// viaduct only across it, through one of its arches (a ship's masts clear them), never along its length. The sea is the board
// and `SEA_MARGIN` cells of open water round it, so there is always a way round the board. Bridges change as the player
// builds, so the sea is worked out again from the marks and a ship whose way is blocked plans another.
export const SEA_MARGIN = 2;
const SHIP_DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];       // [row, column] steps; a step along a column (0, ±1) is a move along x

/**
 * The sea for the marks: { size, margin, w, blocked, axis } on a grid `w` cells across (the board and its margin).
 * `blocked` is 1 where no ship goes; `axis` is 1 or 2 under a viaduct that runs along x or along z, where a ship may cross but not go along.
 */
export function seaOf(lay, marks, margin = SEA_MARGIN) {
  const { size, isl, links } = lay, w = size + 2 * margin, blocked = new Uint8Array(w * w), axis = new Uint8Array(w * w), at = (r, c) => (r + margin) * w + (c + margin);
  for (const o of isl) blocked[at(o.r, o.c)] = 1;
  links.forEach((k, l) => {
    if (!+marks[l]) return;
    const a = isl[k.a], b = isl[k.b], span = k.vertical ? b.r - a.r : b.c - a.c, piers = k.high ? piersOf(lay, l) : [];
    for (let i = 1; i < span; i++) {
      const j = k.vertical ? at(a.r + i, a.c) : at(a.r, a.c + i);
      if (!k.high || piers.includes(i)) blocked[j] = 1; else axis[j] = k.vertical ? 2 : 1;
    }
  });
  return { size, margin, w, blocked, axis };
}
/** The world x and z of the middle of a sea cell. */
export const seaXZ = (sea, j) => cellXZ(sea.size, Math.floor(j / sea.w) - sea.margin, (j % sea.w) - sea.margin);
/** The sea cell that world point (x, z) is in, or -1 outside the sea. */
export function seaCell(sea, x, z) {
  const c = Math.floor(x + sea.size / 2) + sea.margin, r = Math.floor(z + sea.size / 2) + sea.margin;
  return r < 0 || r >= sea.w || c < 0 || c >= sea.w ? -1 : r * sea.w + c;
}
/** The cells a ship can move to from cell j in one step. */
function seaSteps(sea, j) {
  const { w, blocked, axis } = sea, r = Math.floor(j / w), c = j % w, out = [];
  if (blocked[j]) return out;
  for (const [dr, dc] of SHIP_DIRS) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= w || cc < 0 || cc >= w) continue;
    const k = rr * w + cc, along = dr === 0 ? 1 : 2;           // moving along x (a column step) is axis 1, along z axis 2
    if (!blocked[k] && axis[j] !== along && axis[k] !== along) out.push(k);
  }
  return out;
}
/** Steps from cell `from` to every cell a ship can reach (an Int16Array, -1 where it can't). */
export function openWater(sea, from) {
  const dist = new Int16Array(sea.w * sea.w).fill(-1), todo = [from];
  if (from < 0 || sea.blocked[from]) return dist;
  dist[from] = 0;
  for (let q = 0; q < todo.length; q++) for (const k of seaSteps(sea, todo[q])) if (dist[k] < 0) { dist[k] = dist[todo[q]] + 1; todo.push(k); }
  return dist;
}
/** The shortest way from cell `from` to cell `to` as the cells in between, both ends included, or null. */
export function sailFrom(sea, from, to) {
  if (from < 0 || to < 0 || sea.blocked[from] || sea.blocked[to]) return null;
  const back = new Int32Array(sea.w * sea.w).fill(-2), todo = [from];
  back[from] = -1;
  for (let q = 0; q < todo.length && back[to] === -2; q++) for (const k of seaSteps(sea, todo[q])) if (back[k] === -2) { back[k] = todo[q]; todo.push(k); }
  if (back[to] === -2) return null;
  const cells = [];
  for (let j = to; j >= 0; j = back[j]) cells.push(j);
  return cells.reverse();
}
const CORNER = 0.4;                                          // cells a ship starts to turn before the middle of a corner cell
/**
 * A route through cells `cells` with its corners rounded: { pts, len } where pts are [x, z, heading, distance from the start] about a tenth of a cell apart.
 */
export function smoothRoute(sea, cells) {
  const P = cells.map(j => seaXZ(sea, j)), pts = [], head = (a, b) => headingOf(b[0] - a[0], b[1] - a[1]);
  const push = (x, z, h) => { const last = pts.at(-1), d = last ? last[3] + Math.hypot(x - last[0], z - last[1]) : 0; pts.push([x, z, h, d]); };
  if (P.length < 2) { push(...(P[0] || [0, 0]), 0); return { pts, len: 0 }; }
  push(P[0][0], P[0][1], head(P[0], P[1]));
  for (let i = 1; i < P.length; i++) {
    const u = [P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]], v = i + 1 < P.length ? [P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]] : null;
    if (!v || (u[0] === v[0] && u[1] === v[1])) { push(P[i][0], P[i][1], head(P[i - 1], P[i])); continue; }
    const a = [P[i][0] - u[0] * CORNER, P[i][1] - u[1] * CORNER], b = [P[i][0] + v[0] * CORNER, P[i][1] + v[1] * CORNER];
    push(a[0], a[1], head(P[i - 1], P[i]));
    for (let t = 1; t <= 6; t++) {                          // a quarter turn as a curve, the corner cell's middle its control point
      const k = t / 6, x = (1 - k) * (1 - k) * a[0] + 2 * (1 - k) * k * P[i][0] + k * k * b[0], z = (1 - k) * (1 - k) * a[1] + 2 * (1 - k) * k * P[i][1] + k * k * b[1];
      const dx = 2 * (1 - k) * (P[i][0] - a[0]) + 2 * k * (b[0] - P[i][0]), dz = 2 * (1 - k) * (P[i][1] - a[1]) + 2 * k * (b[1] - P[i][1]);
      push(x, z, headingOf(dx, dz));
    }
  }
  return { pts, len: pts.at(-1)[3] };
}
/** Where a ship is `s` cells along a route: { x, z, heading }. */
export function routeAt(route, s) {
  const { pts } = route;
  if (s <= 0 || pts.length === 1) return { x: pts[0][0], z: pts[0][1], heading: pts[0][2] };
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][3] <= s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], k = b[3] > a[3] ? Math.min(1, (s - a[3]) / (b[3] - a[3])) : 0;
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, heading: b[2] };
}
const noise = (a, b) => { let t = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)) >>> 0; t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d) >>> 0; t ^= t >>> 12; return (t >>> 0) / 4294967296; };
/** How many ships a board of this size has. */
export const shipsFor = size => (size <= 7 ? 2 : size <= 9 ? 3 : 4);
/**
 * The ships: `count` of them, each sailing from where it is to another place in the free water, and on to another when it
 * gets there, the same every time for the same `seed` and the same sea. { ships, setSea(sea), advance(seconds) }; a ship is
 * { x, z, heading, speed (cells a second), route, s }. When the sea changes, a ship whose way ahead is blocked plans
 * another, and one that sits where a bridge now stands is moved to the nearest water.
 */
export function createFleet(count, seed = 1) {
  const ships = Array.from({ length: count }, (_, k) => ({ k, x: 0, z: 0, heading: 0, speed: 0.2 + 0.035 * (k % 3), route: null, s: 0, wait: 0, draws: 0, placed: false }));
  let sea = null;
  const draw = sh => noise(seed * 131 + sh.k, sh.draws++);
  const put = (sh, j) => { [sh.x, sh.z] = seaXZ(sea, j); sh.route = null; sh.s = 0; };
  /** The nearest cell of free water to a point, by walking out over the grid (blocked cells too) until one is free. */
  function nearestFree(x, z) {
    const { w, blocked } = sea, lim = sea.size / 2 + sea.margin - 0.5, from = seaCell(sea, Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z)));
    const seen = new Uint8Array(w * w), todo = [from];
    seen[from] = 1;
    for (let q = 0; q < todo.length; q++) {
      if (!blocked[todo[q]]) return todo[q];
      const r = Math.floor(todo[q] / w), c = todo[q] % w;
      for (const [dr, dc] of SHIP_DIRS) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < w && cc >= 0 && cc < w && !seen[rr * w + cc]) { seen[rr * w + cc] = 1; todo.push(rr * w + cc); } }
    }
    return 0;
  }
  function plan(sh) {
    const here = seaCell(sea, sh.x, sh.z), dist = openWater(sea, here), far = [], near = [];
    dist.forEach((d, j) => { if (d >= 4) far.push(j); else if (d >= 1) near.push(j); });
    const pool = far.length ? far : near;
    if (!pool.length) { sh.route = null; sh.wait = 2; return; }
    const cells = sailFrom(sea, here, pool[Math.floor(draw(sh) * pool.length)]);
    sh.route = { ...smoothRoute(sea, cells), cells };
    sh.s = 0;
  }
  /** Whether the cells of a ship's way, from the one it is in, are all still open. */
  function wayOpen(sh) {
    const here = seaCell(sea, sh.x, sh.z), { cells } = sh.route, i = cells.indexOf(here);
    if (i < 0) return false;
    for (let q = i; q + 1 < cells.length; q++) if (!seaSteps(sea, cells[q]).includes(cells[q + 1])) return false;
    return !sea.blocked[cells[i]];
  }
  return {
    ships,
    /** A new sea (a new puzzle, or the marks changed). */
    setSea(next) {
      const first = !sea || sea.size !== next.size;
      sea = next;
      const corner = openWater(sea, 0);                      // the margin's corner is always water, and it is joined to all the margin
      const home = []; corner.forEach((d, j) => { if (d >= 0) home.push(j); });
      for (const sh of ships) {
        if (first || !sh.placed) { put(sh, home[Math.floor(draw(sh) * home.length)]); sh.placed = true; sh.heading = draw(sh) * Math.PI * 2; continue; }
        const here = seaCell(sea, sh.x, sh.z);
        if (here < 0 || sea.blocked[here]) { put(sh, nearestFree(sh.x, sh.z)); continue; }
        if (sh.route && !wayOpen(sh)) { sh.route = null; sh.s = 0; }
      }
    },
    /** Sails every ship on for `dt` seconds. */
    advance(dt) {
      if (!sea) return;
      for (const sh of ships) {
        if (!sh.route) {
          sh.wait -= dt;
          if (sh.wait > 0) continue;
          plan(sh);
          if (!sh.route) continue;
        }
        sh.s += sh.speed * dt;
        const at = routeAt(sh.route, sh.s);
        sh.x = at.x; sh.z = at.z;
        const turn = ((at.heading - sh.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;     // the bow comes round gently, the short way
        sh.heading += turn * Math.min(1, dt * 4);
        if (sh.s >= sh.route.len) { sh.route = null; sh.wait = 1 + 3 * draw(sh); }
      }
    },
  };
}

// ---------- the viaducts ----------
/**
 * Where a viaduct stands on piers: the offsets along it, in cells from its first island (the islands are 0 and its span), of
 * a pier every other cell where the water under it is free: not a lane (a ship must pass), not where a low link crosses
 * (its bridge may be built). `lay` is the layout; `l` the link's number.
 */
export function piersOf(lay, l, lanes = "") {
  const { size, isl, links } = lay, k = links[l], a = isl[k.a], b = isl[k.b], span = k.vertical ? b.r - a.r : b.c - a.c;
  const cell = i => (k.vertical ? (a.r + i) * size + a.c : a.r * size + a.c + i);
  const under = new Set();
  links.forEach((o, j) => {
    if (o.high || o.vertical === k.vertical) return;
    const p = isl[o.a], q = isl[o.b];
    if (o.vertical) for (let r = p.r + 1; r < q.r; r++) under.add(r * size + p.c); else for (let c = p.c + 1; c < q.c; c++) under.add(p.r * size + c);
  });
  const piers = [];
  let last = 0;
  for (let i = 1; i < span; i++) {
    if (i - last < 2 || under.has(cell(i))) continue;
    piers.push(i);
    last = i;
  }
  return piers;
}
/** The points of an arch's curve from (x0, 0) over its crown to (x1, 0), `n` segments: a half ellipse as high as `rise` at most. */
export function archPoints(x0, x1, rise, n = 10) {
  const mid = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = Math.min(rise, rx * 1.1), pts = [];
  for (let i = 0; i <= n; i++) { const th = Math.PI * (1 - i / n); pts.push([mid + rx * Math.cos(th), ry * Math.sin(th)]); }
  return pts;
}
/** The rise of a timber bridge's deck over its length `len`: a shallow hump `hump` high at the middle, none at the ends, as [x, dy] points, `n` segments. */
export function deckProfile(len, hump, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([(len * i) / n, hump * Math.sin(Math.PI * (i / n))]);
  return pts;
}
/**
 * The side of a viaduct's wall as a closed outline (x along the span in cells, y up) with an arch under each stretch between
 * supports: the islands' ends (its first stands `reach` cells in from the first island's middle, its last `reachEnd` from the other's, inside the hills) and its
 * piers (`pier` cells wide). The wall runs from `below` under the water to `top`.
 */
export function wallOutline(span, piers, { reach = 0.5, reachEnd = reach, pier = 0.1, rise = 0.7, top = 0.76, below = -0.06 } = {}) {
  const stops = [0, ...piers, span], pts = [[0, below]];
  for (let i = 0; i + 1 < stops.length; i++) {
    const x0 = stops[i] + (i === 0 ? reach : pier / 2), x1 = stops[i + 1] - (i + 2 === stops.length ? reachEnd : pier / 2);
    if (x1 - x0 < 0.3) continue;
    pts.push([x0, below], ...archPoints(x0, x1, rise), [x1, below]);
  }
  pts.push([span, below], [span, top], [0, top]);
  return pts;
}

// ---------- playing on the model: which link a finger is on ----------
/**
 * Where link `l` lies in the world, for picking and for its guide: the line between its islands, its ends set `pad` cells in from
 * the island's middle (a finger on an island means the island, not one of its four links; `pad` may be a function of the island, for
 * islands of different sizes), at the height its bridge has:
 * { x0, z0, x1, z1, y, high }. `deck` and `viaduct` are the heights of a low bridge and of the top of a viaduct.
 */
export function linkLine(lay, size, l, { deck = 0.17, viaduct = 0.8, pad = 0.45 } = {}) {
  const k = lay.links[l], a = lay.isl[k.a], b = lay.isl[k.b], [x0, z0] = cellXZ(size, a.r, a.c), [x1, z1] = cellXZ(size, b.r, b.c);
  const dx = Math.sign(x1 - x0), dz = Math.sign(z1 - z0), pa = typeof pad === "function" ? pad(a) : pad, pb = typeof pad === "function" ? pad(b) : pad;
  return { x0: x0 + dx * pa, z0: z0 + dz * pa, x1: x1 - dx * pb, z1: z1 - dz * pb, y: k.high ? viaduct : deck, high: !!k.high };
}
/** The distance from (x, y) to the segment (ax, ay)–(bx, by), on the screen's plane. */
export function segDistance(ax, ay, bx, by, x, y) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
/** How near a finger must be to a link on the screen, in pixels, when a cell of the board is `ppu` pixels across: half a cell, never under a thumb's tip nor so wide that it reaches the next link. */
export const pickTolerance = ppu => Math.max(10, Math.min(24, ppu * 0.5));
/**
 * The link under a finger at (x, y), or -1. `segs` are the links as the screen shows them, { l, ax, ay, bx, by, high, bias },
 * `isles` the islands as discs, { x, y, r }. A finger on an island is on no link. Else the nearest link within `tol` pixels
 * wins; a `bias` (pixels, a link no bridge can go on, where another crosses it) makes it lose a close call; and a viaduct, the one on
 * top, wins a call as close as `tie` pixels over the low bridge that seems to pass under it.
 */
export function pickLink(segs, x, y, tol, isles = [], tie = 3) {
  for (const o of isles) if (Math.hypot(x - o.x, y - o.y) < o.r) return -1;
  const d = segs.map(s => segDistance(s.ax, s.ay, s.bx, s.by, x, y) + (s.bias || 0));
  let best = -1;
  for (let i = 0; i < segs.length; i++) if (d[i] <= tol && (best < 0 || d[i] < d[best])) best = i;
  if (best < 0) return -1;
  for (let i = 0; i < segs.length; i++) if (segs[i].high && d[i] <= tol && d[i] <= d[best] + tie && (!segs[best].high || d[i] < d[best])) best = i;
  return segs[best].l;
}
