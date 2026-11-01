// What Bridges' model view (bridges-3d.js, drawn with three.js) works out that has no picture in it, kept apart so it is
// tested in Node: where the fairways' ships sail, where a viaduct stands on piers, the curve of its arches, the plates of
// numbers on the islands. The model's world has a cell for a unit, the board's middle at the origin, x along a row, z down
// a column (towards the camera at the start) and y up, the water at 0.

/** The world's x and z of the middle of a cell. */
export const cellXZ = (size, r, c) => [c + 0.5 - size / 2, r + 0.5 - size / 2];
/** The number on an island's plate: 4, 4+ (at least) or ≤4 (at most). */
export const labelOf = isle => (isle.kind === 1 ? `${isle.n}+` : isle.kind === 2 ? `≤${isle.n}` : String(isle.n));
/** The heading, a turn about y, that points a ship (whose bow is its +x) along (dx, dz). */
export const headingOf = (dx, dz) => Math.atan2(-dz, dx);

// ---------- the fairways' ships ----------
/**
 * The straight runs of lane at least `min` cells long, in rows and columns: { r, c, len, vertical } from the run's first cell.
 * (A lane where two runs meet is a bend: both are found.)
 */
export function laneRuns(size, lanes, min = 2) {
  const runs = [], at = (r, c) => lanes[r * size + c] === "~";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!at(r, c)) continue;
    if (!(c > 0 && at(r, c - 1))) { let len = 1; while (c + len < size && at(r, c + len)) len++; if (len >= min) runs.push({ r, c, len, vertical: false }); }
    if (!(r > 0 && at(r - 1, c))) { let len = 1; while (r + len < size && at(r + len, c)) len++; if (len >= min) runs.push({ r, c, len, vertical: true }); }
  }
  return runs;
}
/** Which of the cells of a lane belong together (joined edge to edge): an array, a component number for each lane cell and -1 for water. */
export function laneParts(size, lanes) {
  const part = new Int16Array(size * size).fill(-1);
  let n = 0;
  for (let i = 0; i < size * size; i++) {
    if (lanes[i] !== "~" || part[i] >= 0) continue;
    const todo = [i];
    part[i] = n;
    while (todo.length) {
      const k = todo.pop(), r = Math.floor(k / size), c = k % size;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const rr = r + dr, cc = c + dc, j = rr * size + cc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size && lanes[j] === "~" && part[j] < 0) { part[j] = n; todo.push(j); }
      }
    }
    n++;
  }
  return part;
}
const LANE_INSET = 0.5;                     // cells a ship keeps from the end of its run (it is about a cell long)
/**
 * The ships' routes. A lane gets a ship on the longest straight run of each of its parts (at most `max`), to and fro along it, in
 * the middle of the lane; and the sea round the board gets `loops` ships sailing right round it. A route is
 * { kind: "line", x0, z0, x1, z1, speed, turn, phase } or { kind: "loop", radius, speed, dir, phase }: speed in cells a second,
 * turn the seconds a ship takes to come about at the end of a line, phase the seconds into its route it begins.
 */
export function routesOf(size, lanes = "", loops = 1, max = 4) {
  const routes = [];
  if (lanes) {
    const part = laneParts(size, lanes), best = new Map();
    for (const run of laneRuns(size, lanes)) {
      const p = part[run.r * size + run.c], was = best.get(p);
      if (!was || run.len > was.len) best.set(p, run);
    }
    [...best.values()].sort((a, b) => b.len - a.len || a.r - b.r || a.c - b.c).slice(0, max).forEach((run, k) => {
      const [x, z] = cellXZ(size, run.r, run.c), a = -0.5 + LANE_INSET, b = run.len - 0.5 - LANE_INSET;
      routes.push(run.vertical
        ? { kind: "line", x0: x, z0: z + a, x1: x, z1: z + b, speed: 0.2 + 0.03 * (k % 3), turn: 6, phase: 9 * k }
        : { kind: "line", x0: x + a, z0: z, x1: x + b, z1: z, speed: 0.2 + 0.03 * (k % 3), turn: 6, phase: 9 * k });
    });
  }
  const radius = size * Math.SQRT1_2 + 1.5;
  for (let k = 0; k < loops; k++) routes.push({ kind: "loop", radius: radius + 0.9 * k, speed: 0.26 - 0.04 * k, dir: k % 2 ? -1 : 1, phase: (k * 47) % 100 });
  return routes;
}
/** Where a ship is `t` seconds along its route: { x, z, heading }. A line is sailed to the end, come about slowly, sailed back, and so on. */
export function shipAt(route, t) {
  t += route.phase;
  if (route.kind === "loop") {
    const a = route.dir * (route.speed / route.radius) * t, x = Math.cos(a) * route.radius, z = Math.sin(a) * route.radius;
    return { x, z, heading: headingOf(-route.dir * Math.sin(a), route.dir * Math.cos(a)) };
  }
  const dx = route.x1 - route.x0, dz = route.z1 - route.z0, len = Math.hypot(dx, dz), run = len / route.speed, cycle = 2 * (run + route.turn), u = ((t % cycle) + cycle) % cycle;
  const ux = dx / len, uz = dz / len, forward = headingOf(ux, uz);
  const along = f => ({ x: route.x0 + dx * f, z: route.z0 + dz * f });
  if (u < run) return { ...along(u / run), heading: forward };
  if (u < run + route.turn) { const k = (u - run) / route.turn, s = k * k * (3 - 2 * k); return { ...along(1), heading: forward + Math.PI * s }; }
  if (u < 2 * run + route.turn) return { ...along(1 - (u - run - route.turn) / run), heading: forward + Math.PI };
  const k = (u - 2 * run - route.turn) / route.turn, s = k * k * (3 - 2 * k);
  return { ...along(0), heading: forward + Math.PI + Math.PI * s };
}
/** The buoys that mark a lane: one on each side of each cell along its straight runs, but not where the lane goes on (at a bend, across the way), { x, z, red }. */
export function buoysOf(size, lanes) {
  const out = [], seen = new Set(), at = (r, c) => r >= 0 && r < size && c >= 0 && c < size && lanes[r * size + c] === "~";
  for (const { r, c, len, vertical } of laneRuns(size, lanes, 1)) {
    for (let i = 0; i < len; i++) for (const side of [-1, 1]) {
      const rr = vertical ? r + i : r, cc = vertical ? c : c + i;
      if (at(vertical ? rr : rr + side, vertical ? cc + side : cc)) continue;
      const [x, z] = cellXZ(size, rr, cc), px = vertical ? x + side * 0.46 : x, pz = vertical ? z : z + side * 0.46, key = `${px.toFixed(2)}:${pz.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x: px, z: pz, red: (i + (side > 0 ? 1 : 0)) % 2 === 0 });
    }
  }
  return out;
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
    if (i - last < 2 || lanes[cell(i)] === "~" || under.has(cell(i))) continue;
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
/**
 * The side of a viaduct's wall as a closed outline (x along the span in cells, y up) with an arch under each stretch between
 * supports: the islands' ends (its first and last stand `reach` cells in from the island's middle, inside the hill) and its
 * piers (`pier` cells wide). The wall runs from `below` under the water to `top`.
 */
export function wallOutline(span, piers, { reach = 0.5, pier = 0.1, rise = 0.7, top = 0.76, below = -0.06 } = {}) {
  const stops = [0, ...piers, span], pts = [[0, below]];
  for (let i = 0; i + 1 < stops.length; i++) {
    const x0 = stops[i] + (i === 0 ? reach : pier / 2), x1 = stops[i + 1] - (i + 2 === stops.length ? reach : pier / 2);
    if (x1 - x0 < 0.3) continue;
    pts.push([x0, below], ...archPoints(x0, x1, rise), [x1, below]);
  }
  pts.push([span, below], [span, top], [0, top]);
  return pts;
}

// ---------- playing on the model: which link a finger is on ----------
/**
 * Where link `l` lies in the world, for picking and for its guide: the line between its islands, its ends set `pad` cells in from
 * the island's middle (a finger on an island means the island, not one of its four links), at the height its bridge has:
 * { x0, z0, x1, z1, y, high }. `deck` and `viaduct` are the heights of a low bridge and of the top of a viaduct.
 */
export function linkLine(lay, size, l, { deck = 0.17, viaduct = 0.8, pad = 0.45 } = {}) {
  const k = lay.links[l], a = lay.isl[k.a], b = lay.isl[k.b], [x0, z0] = cellXZ(size, a.r, a.c), [x1, z1] = cellXZ(size, b.r, b.c);
  const dx = Math.sign(x1 - x0), dz = Math.sign(z1 - z0);
  return { x0: x0 + dx * pad, z0: z0 + dz * pad, x1: x1 - dx * pad, z1: z1 - dz * pad, y: k.high ? viaduct : deck, high: !!k.high };
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
