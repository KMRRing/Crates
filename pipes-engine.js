// Pipes: oil is already flowing. Tap tiles to turn them and build a route from the wellhead to the terminal
// ahead of the flow; a tile the flow enters is locked. Pressure drops a notch every tile, so long routes must
// pass through pumps. From level 4 two products run at once, from two wellheads to their own terminals, crossing
// only where the board has a crossing; from level 7 they meet at a blender first and the blend goes on to a
// third terminal. Every level is carved from a real route before it's scrambled, so it's always solvable.
//
// Tiles: { kind, rot (0–3 quarter turns), fixed }. Kinds: "straight" (openings N and S at rot 0), "bend" (N and
// E), "cross" (two channels N–S and E–W), "pump" (a straight or a bend, by its `shape`, that restores pressure),
// "rock" (nothing), "well" (a source; its opening is S at rot 0), "term" (a terminal; its opening is N at rot 0),
// "blender" (inlets W and E, outlet S at rot 0). Directions: 0 N, 1 E, 2 S, 3 W.

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const PRODUCTS = { crude: { name: "Crude", colour: "#2C2A28" }, gas: { name: "Gas", colour: "#2F6FDE" }, blend: { name: "Blend", colour: "#7A4BC9" } };
export const LIVES = 3;
const OPENINGS = { straight: [0, 2], bend: [0, 1], cross: [0, 1, 2, 3], rock: [], well: [2], term: [0], blender: [1, 2, 3] };
const opposite = d => (d + 2) % 4;
export const shapeOf = tile => (tile.kind === "pump" ? tile.shape : tile.kind);
export const openings = tile => OPENINGS[shapeOf(tile)].map(d => (d + tile.rot) % 4);
export const hasOpening = (tile, d) => openings(tile).includes(d);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;
const key = (x, y) => `${x},${y}`;

/** How hard level n is. */
export function levelOf(n) {
  return {
    w: Math.min(7, 5 + Math.floor((n - 1) / 3)),
    h: Math.min(9, 7 + Math.floor((n - 1) / 3)),
    products: n >= 4 ? 2 : 1,
    blender: n >= 7,
    tick: Math.max(700, 1500 - 70 * (n - 1)),          // ms the flow takes to cross a tile
    plan: Math.max(5000, 11000 - 500 * (n - 1)),       // ms before the flow starts
    pressure: 9,                                       // tiles before a flow stalls, without a pump
    minPath: 8 + n,                                    // the carved route is at least this long
    rock: Math.min(0.2, 0.06 + 0.02 * (n - 1)),        // the share of spare cells that are rock
  };
}

// ---------- carving a level ----------
/** A random walk from a to b that avoids `blocked`, at least minLen long, as a list of cells; null if it fails. */
function carve(r, w, h, a, b, blocked, minLen, tries = 400) {
  for (let t = 0; t < tries; t++) {
    const path = [a], seen = new Set([key(...a), ...blocked]);
    let cur = a, ok = false;
    for (let steps = 0; steps < w * h * 2; steps++) {
      if (cur[0] === b[0] && cur[1] === b[1]) { ok = true; break; }
      // prefer moves that don't overshoot; random otherwise
      const options = DIRS.map((d, i) => [cur[0] + d[0], cur[1] + d[1], i]).filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h && !seen.has(key(x, y)));
      if (!options.length) break;
      const towards = options.filter(([x, y]) => Math.abs(x - b[0]) + Math.abs(y - b[1]) < Math.abs(cur[0] - b[0]) + Math.abs(cur[1] - b[1]));
      const from = towards.length && r() < 0.55 ? towards : options;        // lean towards the goal, wander otherwise
      const pick = from[int(r, 0, from.length - 1)];
      cur = [pick[0], pick[1]];
      seen.add(key(...cur));
      path.push(cur);
    }
    if (ok && path.length >= minLen) return path;
  }
  return null;
}
/** The direction from cell a to its neighbour b. */
const dirTo = (a, b) => DIRS.findIndex(d => a[0] + d[0] === b[0] && a[1] + d[1] === b[1]);
/** The tile kind and rotation that joins openings d1 and d2 (straight or bend), as { kind, rot }. */
function joining(d1, d2) {
  if (d1 === opposite(d2)) return { kind: "straight", rot: Math.min(d1, d2) % 2 };
  for (let rot = 0; rot < 4; rot++) { const o = OPENINGS.bend.map(d => (d + rot) % 4); if (o.includes(d1) && o.includes(d2)) return { kind: "bend", rot }; }
  return null;
}

/**
 * Level n of a run: { n, w, h, tiles[y][x], solution[y][x] (the rotations that work), heads (products and their
 * wellheads), terminals, level }. Carves one route per product (two crossing at a crossing, or two into a blender
 * and one on from it), drops pumps so the pressure budget holds, fills the rest, then scrambles the rotations.
 */
export function makeLevel(seed, n) {
  const L = levelOf(n), r = rng(mix(seed, n));
  for (let attempt = 0; attempt < 200; attempt++) {
    const built = L.blender ? buildBlender(r, L) : L.products === 2 ? buildTwo(r, L) : buildOne(r, L);
    if (!built) continue;
    const level = { n, w: L.w, h: L.h, level: L, ...built };
    if (solved(level).over?.win) return level;                     // the carved route really works, pumps and all
  }
  throw new Error("couldn't build a level");
}

/** Lays a route's tiles into a grid (joining kinds), with pumps every `pressure` tiles. Returns false on a clash. */
function layRoute(grid, path, L, product) {
  let sincePump = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const [x, y] = path[i], into = opposite(dirTo(path[i - 1], path[i])), out = dirTo(path[i], path[i + 1]);
    const j = joining(into, out);
    if (!j) return false;
    const cell = grid[y][x];
    if (cell) {
      // a second route may cross a straight of the first at right angles: that cell becomes a crossing
      if (cell.kind === "straight" && j.kind === "straight" && cell.rot !== j.rot) { grid[y][x] = { kind: "cross", rot: 0, products: [cell.products[0], product] }; sincePump++; continue; }
      return false;
    }
    sincePump++;
    if (sincePump >= L.pressure - 3) { grid[y][x] = { kind: "pump", shape: j.kind, rot: j.rot, products: [product] }; sincePump = 0; }
    else grid[y][x] = { ...j, products: [product] };
  }
  return true;
}
const emptyGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
/** A well tile facing the route's first step, and its head. */
function wellFor(grid, path, product) {
  const dir = dirTo(path[0], path[1]);
  grid[path[0][1]][path[0][0]] = { kind: "well", rot: (dir + 2) % 4, products: [product] };
  return { product, at: path[0], dir };
}
/** A terminal tile facing the route's last step. */
function termFor(grid, path, product) {
  const last = path[path.length - 1], opening = opposite(dirTo(path[path.length - 2], last));
  grid[last[1]][last[0]] = { kind: "term", rot: opening, products: [product] };
  return { product, at: last, dir: opening };
}
const footprint = grid => { const s = new Set(); grid.forEach((row, y) => row.forEach((c, x) => { if (c) s.add(key(x, y)); })); return s; };
function finish(grid, L, r, heads, terminals) {
  // the rest: random tiles, some rock; then scramble every turnable tile
  const solution = grid.map(row => row.map(c => (c ? c.rot : 0)));
  const tiles = grid.map(row => row.map(c => {
    if (c) return { kind: c.kind, shape: c.shape, rot: c.rot, fixed: ["well", "term", "blender", "rock"].includes(c.kind) };
    if (r() < L.rock) return { kind: "rock", rot: 0, fixed: true };
    const kind = ["straight", "bend", "bend", "cross", "pump"][int(r, 0, 4)];
    return { kind, shape: kind === "pump" ? ["straight", "bend"][int(r, 0, 1)] : undefined, rot: int(r, 0, 3), fixed: false };
  }));
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (!tiles[y][x].fixed) tiles[y][x].rot = int(r, 0, 3);
  return { tiles, solution, heads, terminals };
}
function buildOne(r, L) {
  const grid = emptyGrid(L.w, L.h);
  const well = [int(r, 1, L.w - 2), 0], term = [int(r, 1, L.w - 2), L.h - 1];
  const path = carve(r, L.w, L.h, well, term, [], L.minPath);
  if (!path) return null;
  if (!layRoute(grid, path, L, "crude")) return null;
  return finish(grid, L, r, [wellFor(grid, path, "crude")], [termFor(grid, path, "crude")]);
}
function buildTwo(r, L) {
  const grid = emptyGrid(L.w, L.h);
  const wellA = [int(r, 0, Math.floor(L.w / 2) - 1), 0], wellB = [int(r, Math.ceil(L.w / 2), L.w - 1), 0];
  const termA = [int(r, Math.ceil(L.w / 2), L.w - 1), L.h - 1], termB = [int(r, 0, Math.floor(L.w / 2) - 1), L.h - 1];   // they have to cross
  const pathA = carve(r, L.w, L.h, wellA, termA, [key(...wellB), key(...termB)], L.minPath);
  if (!pathA) return null;
  if (!layRoute(grid, pathA, L, "crude")) return null;
  // the second route may only touch the first at crossings: block its bends, pumps and ends
  const blocked = [key(...wellA), key(...termA)];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c && c.kind !== "straight") blocked.push(key(x, y)); }));
  const pathB = carve(r, L.w, L.h, wellB, termB, blocked, L.minPath);
  if (!pathB) return null;
  if (!layRoute(grid, pathB, L, "gas")) return null;
  if (!grid.flat().some(c => c && c.kind === "cross")) return null;
  return finish(grid, L, r, [wellFor(grid, pathA, "crude"), wellFor(grid, pathB, "gas")], [termFor(grid, pathA, "crude"), termFor(grid, pathB, "gas")]);
}
function buildBlender(r, L) {
  const grid = emptyGrid(L.w, L.h);
  const bx = int(r, 2, L.w - 3), by = int(r, Math.floor(L.h / 2) - 1, Math.floor(L.h / 2) + 1);
  const blender = [bx, by];
  const wellA = [int(r, 0, 1), 0], wellB = [int(r, L.w - 2, L.w - 1), 0], term = [int(r, 1, L.w - 2), L.h - 1];
  const inW = [bx - 1, by], inE = [bx + 1, by], outS = [bx, by + 1];
  const taken = [key(...blender), key(...inW), key(...inE), key(...outS), key(...wellA), key(...wellB), key(...term)];
  const pathA = carve(r, L.w, L.h, wellA, inW, taken.filter(k => k !== key(...inW)), Math.max(4, Math.floor(L.minPath / 2)));
  if (!pathA) return null;
  if (!layRoute(grid, [...pathA, blender], L, "crude")) return null;
  const used1 = footprint(grid);
  const pathB = carve(r, L.w, L.h, wellB, inE, [...taken.filter(k => k !== key(...inE)), ...used1], Math.max(4, Math.floor(L.minPath / 2)));
  if (!pathB) return null;
  if (!layRoute(grid, [...pathB, blender], L, "gas")) return null;
  const used2 = footprint(grid);
  const pathC = carve(r, L.w, L.h, outS, term, [...taken.filter(k => k !== key(...outS) && k !== key(...term)), ...used2], Math.max(3, Math.floor(L.minPath / 2)));
  if (!pathC) return null;
  if (!layRoute(grid, [blender, ...pathC], L, "blend")) return null;
  grid[by][bx] = { kind: "blender", rot: 0, products: ["blend"] };
  return finish(grid, L, r, [wellFor(grid, pathA, "crude"), wellFor(grid, pathB, "gas")], [termFor(grid, [blender, ...pathC], "blend")]);
}

// ---------- the flow ----------
/**
 * A run of a level: { tiles (with rot as turned), heads: [{ product, x, y, into (the direction it entered by),
 * progress 0–1, pressure, done, stalled }], fill: { "x,y": [{ product, into, out }] } (what's in each tile),
 * delivered, over: null | { win } , spill: { x, y, why } | null, blender: { waiting: [products] } }.
 */
export function newRun(level) {
  return {
    tiles: level.tiles.map(row => row.map(t => ({ ...t, locked: false }))),
    heads: level.heads.map(h => ({ product: h.product, x: h.at[0], y: h.at[1], into: opposite(h.dir), progress: 0, pressure: level.level.pressure, done: false })),
    fill: {},
    delivered: 0,
    tilesFilled: 0,
    over: null,
    spill: null,
    waiting: [],
  };
}
/** Turn a tile a quarter clockwise, if it can be. Returns true if it turned. */
export function turn(run, x, y) {
  const t = run.tiles[y]?.[x];
  if (!t || t.fixed || t.locked) return false;
  t.rot = (t.rot + 1) % 4;
  return true;
}
/** Where a head leaves a tile it entered by `into`: the exit direction, or null for a terminal or blender. */
function exitOf(tile, into) {
  const o = openings(tile);
  if (tile.kind === "well") return o[0];                           // the source: the flow leaves by its one opening
  if (!o.includes(into)) return undefined;                         // no opening on the side it came from: a spill
  if (tile.kind === "term" || tile.kind === "blender") return null;
  if (tile.kind === "cross") return opposite(into);
  return o.find(d => d !== into);
}
/**
 * Advance the flow by dt ms. Heads move `tick` ms a tile. Returns the run. `boost` multiplies the speed (the
 * player pumping it once the route is ready).
 */
export function advance(level, run, dt, boost = 1) {
  if (run.over) return run;
  const tick = level.level.tick / boost;
  for (const h of run.heads) {
    if (h.done) continue;
    h.progress += dt / tick;
    while (h.progress >= 1 && !h.done && !run.over) {
      h.progress -= 1;
      const tile = run.tiles[h.y][h.x];
      tile.locked = true;
      const exit = exitOf(tile, h.into);
      if (exit === undefined) { spill(run, h, "no opening"); break; }
      if (tile.kind === "pump") h.pressure = level.level.pressure;
      if (tile.kind === "term") {
        const okProduct = level.terminals.find(t => t.at[0] === h.x && t.at[1] === h.y)?.product === h.product;
        if (!okProduct) { spill(run, h, "wrong product"); break; }
        h.done = true;
        run.delivered++;
        break;
      }
      if (tile.kind === "blender") {
        h.done = true;
        run.waiting.push(h.product);
        if (run.waiting.length === 2) {           // both in: the blend leaves by the outlet
          const out = (2 + tile.rot) % 4, nx = h.x + DIRS[out][0], ny = h.y + DIRS[out][1];
          run.heads.push({ product: "blend", x: nx, y: ny, into: opposite(out), progress: 0, pressure: level.level.pressure, done: false });
          if (!enter(level, run, run.heads[run.heads.length - 1], nx, ny, opposite(out))) break;
        }
        break;
      }
      const nx = h.x + DIRS[exit][0], ny = h.y + DIRS[exit][1];
      // pressure: each tile entered costs a notch; at zero the flow can't go on
      if (h.pressure <= 0) { h.stalled = true; run.over = { win: false, why: "pressure" }; run.spill = { x: h.x, y: h.y, why: "pressure", product: h.product }; break; }
      h.pressure--;
      if (!enter(level, run, h, nx, ny, opposite(exit))) break;
      h.x = nx; h.y = ny; h.into = opposite(exit);
    }
  }
  if (!run.over && run.heads.every(h => h.done)) {
    const wanted = level.terminals.length;
    run.over = { win: run.delivered >= wanted };
  }
  return run;
}
/** A head moving into cell (nx, ny) from direction `into`: fills it or spills. */
function enter(level, run, h, nx, ny, into) {
  const next = run.tiles[ny]?.[nx];
  if (!next || next.kind === "rock") { spill(run, h, "the edge"); return false; }
  if (!hasOpening(next, into)) { spill(run, h, "no opening", nx, ny); return false; }
  const k = key(nx, ny), there = run.fill[k] || [];
  // a crossing carries two products, one per channel; a blender takes one at each inlet; anything else holds one
  const room = next.kind === "cross" ? there.length === 1 && there[0].into % 2 !== into % 2
    : next.kind === "blender" ? there.length === 1 && there[0].into !== into
    : false;
  if (there.length && !room) { spill(run, h, "already full", nx, ny); return false; }
  run.fill[k] = [...there, { product: h.product, into, out: next.kind === "term" || next.kind === "blender" ? null : exitOf(next, into) }];
  run.tilesFilled++;
  next.locked = true;
  return true;
}
function spill(run, h, why, x = h.x, y = h.y) {
  run.over = { win: false, why };
  run.spill = { x, y, why, product: h.product };
}
/** The level played with its solution's rotations, run to the end: for checking a level, and for tests. */
export function solved(level) {
  const run = newRun(level);
  run.tiles.forEach((row, y) => row.forEach((t, x) => { t.rot = level.solution[y][x]; }));
  for (let i = 0; i < 400 && !run.over; i++) advance(level, run, level.level.tick);
  return run;
}

/** Points at the end of a level: tiles filled, the terminals, and the time left on the clock. */
export const points = (level, run, msLeft) => run.tilesFilled * 10 * level.level.products + (run.over?.win ? 200 * level.n + Math.round(msLeft / 100) : 0);
