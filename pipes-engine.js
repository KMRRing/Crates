// Pipes: oil is already flowing. Tap tiles to turn them and build a route from the wellhead to a terminal ahead of
// the flow; a tile the flow enters is locked. Pressure drops a notch every tile and only a pump refills it, so every
// board has a direct line that runs dry and a detour through a pump that doesn't: the detour leaves and rejoins the
// line at two bends, the same tiles turned the other way. A level pays its netback: the price of the terminal reached,
// less 10 a tile of pipe and 40 a pump fired, plus time. On levels 3 and 4 there are two terminals, the far one dearer
// to reach, priced so that either can be the better pick. The campaign runs in acts of five levels, each bringing one
// new idea onto a gentle board and ramping within itself: crude alone; crude and HVO crossing; the HVO unit, which
// hydrotreats used cooking oil into HVO and bio-naphtha for their own terminals (as a renewable diesel plant really
// does); then the open field, the three in turn. Every level is carved from real routes before it's scrambled, and each is proved by running it:
// the routes deliver, the direct lines stall.
//
// Tiles: { kind, rot (0–3 quarter turns), fixed }. Kinds: "straight" (openings N and S at rot 0), "bend" (N and
// E), "cross" (two channels N–S and E–W), "pump" (a straight or a bend, by its `shape`, that restores pressure),
// "rock" (nothing), "well" (a source; its opening is S at rot 0), "term" (a terminal; its opening is N at rot 0),
// "unit" (the HVO unit: used cooking oil in at N, HVO out W, bio-naphtha out E at rot 0). Directions: 0 N, 1 E, 2 S, 3 W.

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// pace: how much slower than the level's tick a product crosses a tile; delay: ms after the start before it flows,
// when it shares the board (crude lets the HVO get going); source: what a product starts from
export const PRODUCTS = {
  crude: { name: "Crude", colour: "#2C2A28", pace: 1.5, delay: 8000, source: "wellhead" },
  hvo: { name: "HVO", colour: "#3A9A5B", pace: 1, delay: 0, source: "HVO plant" },
  uco: { name: "UCO", colour: "#C48A2C", pace: 1.3, delay: 0, source: "UCO tank" },
  naphtha: { name: "Bio-naphtha", colour: "#8E62C9", pace: 1, delay: 0 },
};
export const COSTS = { tile: 10, pump: 40 };        // netback: each tile of pipe the flow fills, each pump it passes
export const LIVES = 3;
const OPENINGS = { straight: [0, 2], bend: [0, 1], cross: [0, 1, 2, 3], rock: [], well: [2], term: [0], unit: [0, 1, 3] };
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

/**
 * The campaign, in acts of five levels. Each act brings one new idea onto a gentle board and ramps within itself; the
 * next starts gentler again. Speeds and planning time never pass a floor: HVO at least 1.9 s a tile, 15 s to plan.
 */
export const ACT_LENGTH = 5;
export const ACTS = [
  { name: "Crude", news: "One product to its terminal; on levels 3 and 4, a near terminal and a far one to choose between." },
  { name: "Crude and HVO", news: "Crude from its wellhead, HVO from its plant, each to its own terminal; they cross only at a crossing." },
  { name: "The HVO unit", news: "Used cooking oil into the HVO unit: HVO out one side, bio-naphtha out the other, each to its terminal." },
  { name: "The open field", news: "Everything so far, in turn, on the biggest field." },
];
export const actOf = n => Math.min(ACTS.length, 1 + Math.floor((n - 1) / ACT_LENGTH));
/** How hard level n is, and what it holds. */
export function levelOf(n) {
  const pressure = 8, a = 1 + Math.floor((n - 1) / ACT_LENGTH), i = (n - 1) % ACT_LENGTH;   // the act (open-ended), and the place in it
  const kind = a === 1 ? "one" : a === 2 ? "two" : a === 3 ? "unit" : ["one", "two", "unit", "two", "unit"][i];
  return {
    act: Math.min(a, ACTS.length), place: i, kind,
    w: a === 1 ? 5 : a === 2 ? 6 : 7,
    h: a === 1 ? 7 : a === 2 ? 8 : 9,
    products: kind === "two" ? 2 : 1,
    unit: kind === "unit",
    terminals: (a === 1 && (i === 2 || i === 3)) || (a >= 4 && kind === "one") ? 2 : 1,   // one product: a near and a far terminal
    tick: Math.max(1900, 2800 - 150 * (a - 1) - 70 * i),   // ms HVO takes to cross a tile; crude and UCO are slower
    plan: Math.max(15000, 22000 - 1000 * (a - 1) - 400 * i),   // ms before anything flows
    pressure,                                           // tiles a flow can enter after the wellhead or a pump
    minPath: Math.min(18, Math.max(pressure + 2, 8 + 2 * a + i)),   // the carved line is at least this long, so it runs dry
    rock: Math.min(0.12, 0.05 + 0.01 * (a - 1) + 0.005 * i),        // the share of spare cells that are rock
    margin: 250 + 50 * n,                               // what a level nets over its routes' costs, before time
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

const step = ([x, y], d) => [x + DIRS[d][0], y + DIRS[d][1]];
const inside = (L, [x, y]) => x >= 0 && y >= 0 && x < L.w && y < L.h;
/** The sides a route enters and leaves its cell i by. */
const sidesAt = (route, i) => [opposite(dirTo(route[i - 1], route[i])), dirTo(route[i], route[i + 1])];
const round10 = v => Math.round(v / 10) * 10;

/**
 * Level n of a run: { n, w, h, tiles[y][x], solution[y][x] (the rotations of the best routes), heads (products and
 * their wellheads), terminals (each with its price), routes (the designed routes, as cells), directs (the lines that
 * run dry), choice (two terminals: which nets more, and by how much), level }. Carves a line per product, gives lines
 * a detour through a pump, places pumps where pressure needs them, fills the rest, scrambles the rotations, and
 * accepts the board only once running it proves the routes deliver and the direct lines stall.
 */
export function makeLevel(seed, n) {
  const L = levelOf(n), r = rng(mix(seed, n));
  for (let attempt = 0; attempt < 400; attempt++) {
    const built = L.unit ? buildUnit(r, L) : L.products === 2 ? buildTwo(r, L) : buildOne(r, L);
    if (!built) continue;
    const level = { n, w: L.w, h: L.h, level: L, unit: L.unit, ...built };
    if (!proven(level)) continue;
    price(level, r);
    return level;
  }
  throw new Error("couldn't build a level");
}

/** Lays a route's tiles into a grid (joining kinds), its ends excluded. A second route may cross a straight of an
 *  earlier one at right angles: that cell becomes a crossing. Returns false on any other clash. */
function layRoute(grid, route, product) {
  for (let i = 1; i < route.length - 1; i++) {
    const [x, y] = route[i], j = joining(...sidesAt(route, i));
    if (!j) return false;
    const cell = grid[y][x];
    if (cell) {
      if (cell.kind === "straight" && j.kind === "straight" && cell.rot !== j.rot && !cell.junction) { grid[y][x] = { kind: "cross", rot: 0, products: [cell.products[0], product] }; continue; }
      return false;
    }
    grid[y][x] = { ...j, products: [product] };
  }
  return true;
}
const emptyGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
/** A well tile facing the route's first step, and its head. */
function wellFor(grid, route, product) {
  const dir = dirTo(route[0], route[1]);
  grid[route[0][1]][route[0][0]] = { kind: "well", rot: (dir + 2) % 4, products: [product] };
  return { product, at: route[0], dir };
}
/** A terminal tile facing the route's last step. */
function termFor(grid, route, product) {
  const last = route[route.length - 1], opening = opposite(dirTo(route[route.length - 2], last));
  grid[last[1]][last[0]] = { kind: "term", rot: opening, products: [product] };
  return { product, at: last, dir: opening };
}
const footprint = grid => { const s = new Set(); grid.forEach((row, y) => row.forEach((c, x) => { if (c) s.add(key(x, y)); })); return s; };

/**
 * A detour for a laid line: two of its bends, and a fresh path between their far sides (the cells each bend reaches
 * when turned the other way), longer than the stretch it bypasses, laid as pipe. The bends become junctions, the same
 * tiles serving either way. Returns { route (the line through the detour), bypass: [first, last] (its indices on
 * that route) } or null; the bypassed stretch stays on the board as it was, the direct line.
 */
function addDetour(r, grid, L, line, product) {
  const used = footprint(grid);
  const bends = [];
  for (let i = 1; i < line.length - 1; i++) { const c = grid[line[i][1]][line[i][0]]; if (c?.kind === "bend" && !c.junction) bends.push(i); }
  for (let t = 0; t < 50 && bends.length >= 2; t++) {
    const I = bends[int(r, 0, bends.length - 1)], later = bends.filter(j => j - I >= 3 && j - I <= 9);
    if (!later.length) continue;
    const J = later[int(r, 0, later.length - 1)];
    const from = step(line[I], opposite(sidesAt(line, I)[1])), to = step(line[J], opposite(sidesAt(line, J)[0]));
    if (!inside(L, from) || !inside(L, to) || used.has(key(...from)) || used.has(key(...to)) || key(...from) === key(...to)) continue;
    const direct = J - I - 1;
    const by = carve(r, L.w, L.h, from, to, [...used], direct + 2, 30);
    if (!by || by.length > direct + 8) continue;
    const route = [...line.slice(0, I + 1), ...by, ...line.slice(J)], end = I + by.length + 1;
    for (let k = I; k <= end; k++) {
      const [x, y] = route[k], j = joining(...sidesAt(route, k));
      grid[y][x] = { ...j, products: [product], ...(k === I || k === end ? { junction: true } : {}) };
    }
    return { route, bypass: [I + 1, I + by.length] };
  }
  return null;
}
/**
 * A branch to a nearer terminal: from a bend on the route before `before`, turned the other way, a short path to a
 * free cell on the board's edge below the top row, where a terminal stands. Returns { route, term } or null.
 */
function addBranch(r, grid, L, route, before, product) {
  const used = footprint(grid);
  const ends = [];
  for (let y = 2; y < L.h; y++) for (let x = 0; x < L.w; x++) if ((x === 0 || x === L.w - 1 || y === L.h - 1) && !used.has(key(x, y))) ends.push([x, y]);
  const bends = [];
  for (let i = 2; i < before; i++) { const c = grid[route[i][1]][route[i][0]]; if (c?.kind === "bend" && !c.junction) bends.push(i); }
  for (let t = 0; t < 40 && bends.length && ends.length; t++) {
    const K = bends[int(r, 0, bends.length - 1)], from = step(route[K], opposite(sidesAt(route, K)[1]));
    if (!inside(L, from) || used.has(key(...from))) continue;
    const goal = ends[int(r, 0, ends.length - 1)], dist = Math.abs(goal[0] - from[0]) + Math.abs(goal[1] - from[1]);
    if (dist < 1 || dist > 5) continue;
    const br = carve(r, L.w, L.h, from, goal, [...used], 2, 30);
    if (!br || br.length > 7) continue;
    const near = [...route.slice(0, K + 1), ...br];
    if (!layRoute(grid, near.slice(K), product)) continue;
    grid[route[K][1]][route[K][0]].junction = true;
    return { route: near, term: termFor(grid, near, product) };
  }
  return null;
}
/**
 * Turns cells of a route into pumps where its pressure needs them, so that no stretch after a refill (the wellhead,
 * the HVO unit's outlet, a pump) enters more tiles than the budget, its end counting. `forced` route indices are pumps
 * whatever (a detour's middle); the rest go as late as the budget allows, on plain straights and bends. Pumps already
 * on the route count. False if the budget can't be kept.
 */
function placePumps(grid, route, budget, forced = []) {
  const at = i => grid[route[i][1]][route[i][0]];
  const free = i => { const c = at(i); return !!c && (c.kind === "straight" || c.kind === "bend") && !c.junction; };
  const pumps = new Set(forced.filter(free));
  route.forEach((_, i) => { if (at(i)?.kind === "pump") pumps.add(i); });
  let last = 0;
  for (let i = 1; i < route.length; i++) {
    if (i - last > budget) {                        // entering cell i would be one tile too many: refill before it
      let p = i - 1;
      while (p > last && !pumps.has(p) && !free(p)) p--;
      if (p <= last) return false;
      pumps.add(p);
      last = p;
    }
    if (pumps.has(i)) last = i;
  }
  for (const i of pumps) { const c = at(i); if (c.kind !== "pump") grid[route[i][1]][route[i][0]] = { kind: "pump", shape: c.kind, rot: c.rot, products: c.products }; }
  return true;
}
/** Gives each line a detour where one can be carved, places the pumps, and finishes the board. Null without any. */
function withDetours(r, grid, L, lines, heads, terminals) {
  const routes = [], directs = [];
  // in a shuffled order, so the first line to claim the room for a detour isn't always the crude's
  for (const { line, product } of lines.map(l => [r(), l]).sort((a, b) => a[0] - b[0]).map(([, l]) => l)) {
    const d = addDetour(r, grid, L, line, product);
    if (d) { routes.push({ route: d.route, product, forced: [Math.floor((d.bypass[0] + d.bypass[1]) / 2)] }); directs.push({ route: line, product }); }
    else routes.push({ route: line, product, forced: [] });
  }
  if (!directs.length) return null;
  for (const { route, forced } of routes) if (!placePumps(grid, route, L.pressure, forced)) return null;
  return finish(grid, L, r, heads, terminals, routes.map(x => x.route), directs);
}

function buildOne(r, L) {
  const grid = emptyGrid(L.w, L.h);
  const well = [int(r, 1, L.w - 2), 0], end = [int(r, 0, L.w - 1), L.h - 1];
  const line = carve(r, L.w, L.h, well, end, [], L.minPath);
  if (!line || !layRoute(grid, line, "crude")) return null;
  const head = wellFor(grid, line, "crude"), far = termFor(grid, line, "crude");
  const d = addDetour(r, grid, L, line, "crude");
  if (!d) return null;
  const near = L.terminals === 2 ? addBranch(r, grid, L, d.route, d.bypass[0] - 1, "crude") : null;
  if (L.terminals === 2 && !near) return null;
  if (!placePumps(grid, d.route, L.pressure, [Math.floor((d.bypass[0] + d.bypass[1]) / 2)])) return null;
  if (near && !placePumps(grid, near.route, L.pressure)) return null;
  return finish(grid, L, r, [head], near ? [far, near.term] : [far], near ? [d.route, near.route] : [d.route], [{ route: line, product: "crude" }]);
}
function buildTwo(r, L) {
  const grid = emptyGrid(L.w, L.h);
  const wellA = [int(r, 0, Math.floor(L.w / 2) - 1), 0], wellB = [int(r, Math.ceil(L.w / 2), L.w - 1), 0];
  const termA = [int(r, Math.ceil(L.w / 2), L.w - 1), L.h - 1], termB = [int(r, 0, Math.floor(L.w / 2) - 1), L.h - 1];   // they have to cross
  const pathA = carve(r, L.w, L.h, wellA, termA, [key(...wellB), key(...termB)], L.minPath);
  if (!pathA || !layRoute(grid, pathA, "crude")) return null;
  // the second line may only touch the first at crossings: block its bends and ends
  const blocked = [key(...wellA), key(...termA)];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c && c.kind !== "straight") blocked.push(key(x, y)); }));
  const pathB = carve(r, L.w, L.h, wellB, termB, blocked, L.minPath);
  if (!pathB || !layRoute(grid, pathB, "hvo")) return null;
  if (!grid.flat().some(c => c && c.kind === "cross")) return null;
  const heads = [wellFor(grid, pathA, "crude"), wellFor(grid, pathB, "hvo")], terminals = [termFor(grid, pathA, "crude"), termFor(grid, pathB, "hvo")];
  return withDetours(r, grid, L, [{ line: pathA, product: "crude" }, { line: pathB, product: "hvo" }], heads, terminals);
}
/** The HVO unit: used cooking oil comes down from its tank to the unit; HVO leaves it to the west, bio-naphtha to the
 *  east, each to its own terminal. */
function buildUnit(r, L) {
  const grid = emptyGrid(L.w, L.h);
  const ux = int(r, 2, L.w - 3), uy = int(r, 2, Math.floor(L.h / 2));
  const unit = [ux, uy], inN = [ux, uy - 1], outW = [ux - 1, uy], outE = [ux + 1, uy];
  const tank = [int(r, 1, L.w - 2), 0];
  const termHvo = [int(r, 0, Math.floor(L.w / 2) - 1), L.h - 1], termNaphtha = [int(r, Math.ceil(L.w / 2), L.w - 1), L.h - 1];
  const taken = [unit, inN, outW, outE, tank, termHvo, termNaphtha].map(c => key(...c));
  const pathF = carve(r, L.w, L.h, tank, inN, taken.filter(k => k !== key(...inN) && k !== key(...tank)), Math.max(3, Math.floor(L.minPath / 2)));
  if (!pathF) return null;
  const lineF = [...pathF, unit];
  if (!layRoute(grid, lineF, "uco")) return null;
  const pathH = carve(r, L.w, L.h, outW, termHvo, [...taken.filter(k => k !== key(...outW) && k !== key(...termHvo)), ...footprint(grid)], Math.max(4, Math.floor(L.minPath / 2)));
  if (!pathH) return null;
  const lineH = [unit, ...pathH];
  if (!layRoute(grid, lineH, "hvo")) return null;
  const pathN = carve(r, L.w, L.h, outE, termNaphtha, [...taken.filter(k => k !== key(...outE) && k !== key(...termNaphtha)), ...footprint(grid)], Math.max(4, Math.floor(L.minPath / 2)));
  if (!pathN) return null;
  const lineN = [unit, ...pathN];
  if (!layRoute(grid, lineN, "naphtha")) return null;
  grid[uy][ux] = { kind: "unit", rot: 0, products: ["hvo", "naphtha"] };
  const heads = [wellFor(grid, pathF, "uco")], terminals = [termFor(grid, lineH, "hvo"), termFor(grid, lineN, "naphtha")];
  return withDetours(r, grid, L, [{ line: lineF, product: "uco" }, { line: lineH, product: "hvo" }, { line: lineN, product: "naphtha" }], heads, terminals);
}
function finish(grid, L, r, heads, terminals, routes, directs) {
  // the rest: random tiles, some rock; then scramble every turnable tile
  const solution = grid.map(row => row.map(c => (c ? c.rot : 0)));
  const tiles = grid.map(row => row.map(c => {
    if (c) return { kind: c.kind, shape: c.shape, rot: c.rot, fixed: ["well", "term", "unit", "rock"].includes(c.kind) };
    if (r() < L.rock) return { kind: "rock", rot: 0, fixed: true };
    const kind = ["straight", "bend", "bend", "cross", "pump"][int(r, 0, 4)];
    return { kind, shape: kind === "pump" ? ["straight", "bend"][int(r, 0, 1)] : undefined, rot: int(r, 0, 3), fixed: false };
  }));
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (!tiles[y][x].fixed) tiles[y][x].rot = int(r, 0, 3);
  return { tiles, solution, heads, terminals, routes, directs };
}

// ---------- proving and pricing a level ----------
/** The rotations that make a route flow, on top of `base`: each cell between its ends turned to join its sides. */
export function rotsFor(base, route) {
  const rots = base.map(row => row.slice());
  for (let i = 1; i < route.length - 1; i++) { const [x, y] = route[i], j = joining(...sidesAt(route, i)); if (j) rots[y][x] = j.rot; }
  return rots;
}
/** The level played with the given rotations, run to the end in quarter-second steps. */
export function runWith(level, rots) {
  const run = newRun(level);
  run.tiles.forEach((row, y) => row.forEach((t, x) => { t.rot = rots[y][x]; }));
  for (let i = 0; i < 4000 && !run.over; i++) advance(level, run, 250);
  return run;
}
/** The level played with its solution's rotations, run to the end: for checking a level, and for tests. */
export const solved = level => runWith(level, level.solution);
/** Whether a flow from `head` could reach the cell `target` with no pump refilling it: tiles turned freely, a pump
 *  passing flow like the pipe it's shaped as. One product only. */
export function reachableDry(level, head, target) {
  const seen = new Set(), P = level.level.pressure;
  const go = ([x, y], into, n) => {                 // n: tiles entered so far, this one counting
    if (!inside(level, [x, y]) || n > P) return false;
    const t = level.tiles[y][x];
    if (x === target[0] && y === target[1]) return hasOpening(t, into);
    if (t.fixed || n === P || seen.has(key(x, y))) return false;
    const shape = shapeOf(t), outs = shape === "bend" ? [(into + 1) % 4, (into + 3) % 4] : shape === "straight" || shape === "cross" ? [opposite(into)] : [];
    seen.add(key(x, y));
    const found = outs.some(out => go(step([x, y], out), opposite(out), n + 1));
    seen.delete(key(x, y));
    return found;
  };
  return go(step(head.at, head.dir), opposite(head.dir), 1);
}
/** A board is accepted when its routes deliver, every direct line stalls for want of pressure, and (one product) no
 *  route at all reaches the far terminal without a pump. */
function proven(level) {
  const rotsOf = route => rotsFor(level.solution, route);
  if (!level.routes.every(route => runWith(level, rotsOf(route)).over?.win)) return false;
  if (!level.directs.every(d => runWith(level, rotsOf(d.route)).over?.why === "pressure")) return false;
  return level.heads.length > 1 || level.unit || !reachableDry(level, level.heads[0], level.terminals[0].at);
}
/**
 * Prices the terminals. A terminal pays the cost of its designed route (pipe and pumps) plus the level's margin, so
 * a level nets its margin and the time. With two terminals the far one always shows the higher price, but either can
 * be the better pick: the premium is set to beat the far route's extra pipe, pumps and time by 80–180, or to fall
 * short of them by as much. The better route's rotations become the solution.
 */
function price(level, r) {
  const L = level.level;
  const stats = level.routes.map(route => runWith(level, rotsFor(level.solution, route)));
  const cost = run => COSTS.tile * run.tilesFilled + COSTS.pump * run.pumpsFired;
  if (level.terminals.length === 1 || level.heads.length > 1 || level.unit) {
    const all = stats[0], share = round10(L.margin / level.terminals.length);
    level.terminals.forEach(t => { t.price = share + round10(cost(all) / level.terminals.length); });
    return;
  }
  // two terminals for one product: value before price = - pipe - pumps - the time it takes, filled at once (×4)
  const flowMs = run => run.tilesFilled * L.tick * PRODUCTS.crude.pace;
  const value = run => -cost(run) - flowMs(run) / 400;
  const [far, near] = stats, farBetter = r() < 0.5, by = int(r, 8, 18) * 10;
  const nearPrice = round10(L.margin - value(near));
  let farPrice = round10(nearPrice + value(near) - value(far) + (farBetter ? by : -by));
  if (farPrice < nearPrice + 30) farPrice = nearPrice + 30;          // the far terminal always looks dearer
  level.terminals[0].price = farPrice;
  level.terminals[1].price = nearPrice;
  const net = (p, run) => p + value(run);
  const gap = Math.round(net(farPrice, far) - net(nearPrice, near));
  level.choice = { better: gap >= 0 ? "far" : "near", by: Math.abs(gap) };
  if (gap < 0) level.solution = rotsFor(level.solution, level.routes[1]);
}

// ---------- the flow ----------
/**
 * A run of a level: { tiles (with rot as turned), heads: [{ product, x, y, into (the direction it entered by),
 * progress 0–1, pressure, done, stalled }], fill: { "x,y": [{ product, into, out }] } (what's in each tile),
 * delivered, reached (the terminals delivered to, by index), tilesFilled, pumpsFired, over: null | { win, why },
 * spill: { x, y, why } | null }.
 */
export function newRun(level) {
  return {
    tiles: level.tiles.map(row => row.map(t => ({ ...t, locked: false }))),
    heads: level.heads.map(h => ({ product: h.product, x: h.at[0], y: h.at[1], into: opposite(h.dir), progress: 0, pressure: level.level.pressure, done: false })),
    fill: {},
    delivered: 0,
    reached: [],
    tilesFilled: 0,
    pumpsFired: 0,
    over: null,
    spill: null,
  };
}
/** Turn a tile a quarter clockwise (by 1) or anticlockwise (by -1), if it can be. Returns true if it turned. */
export function turn(run, x, y, by = 1) {
  const t = run.tiles[y]?.[x];
  if (!t || t.fixed || t.locked) return false;
  t.rot = (t.rot + by + 4) % 4;
  return true;
}
/** Where a head leaves a tile it entered by `into`: the exit direction, null for a terminal or the HVO unit's inlet,
 *  undefined for no way on (a spill). */
function exitOf(tile, into) {
  const o = openings(tile);
  if (tile.kind === "well") return o[0];                           // the source: the flow leaves by its one opening
  if (!o.includes(into)) return undefined;                         // no opening on the side it came from: a spill
  if (tile.kind === "unit") return into === tile.rot % 4 ? null : undefined;   // only used cooking oil, only at its inlet
  if (tile.kind === "term") return null;
  if (tile.kind === "cross") return opposite(into);
  return o.find(d => d !== into);
}
/** Advance the flow by dt ms of flow time. Heads move `tick` ms a tile (times their product's pace). Returns the run. */
export function advance(level, run, dt) {
  if (run.over) return run;
  run.clock = (run.clock || 0) + dt;
  for (const h of run.heads) {
    if (h.done) continue;
    if (level.heads.length > 1 && run.clock < (PRODUCTS[h.product].delay || 0)) continue;   // crude lets the HVO go first
    const tick = level.level.tick * (PRODUCTS[h.product].pace || 1);
    h.progress += dt / tick;
    while (h.progress >= 1 && !h.done && !run.over) {
      h.progress -= 1;
      const tile = run.tiles[h.y][h.x];
      tile.locked = true;
      const exit = exitOf(tile, h.into);
      if (exit === undefined) { spill(run, h, "no opening"); break; }
      if (tile.kind === "pump") { h.pressure = level.level.pressure; run.pumpsFired++; }
      if (tile.kind === "term") {
        const at = level.terminals.findIndex(t => t.at[0] === h.x && t.at[1] === h.y);
        if (level.terminals[at]?.product !== h.product) { spill(run, h, "wrong product"); break; }
        h.done = true;
        run.delivered++;
        run.reached.push(at);
        break;
      }
      if (tile.kind === "unit") {
        // in: used cooking oil; out: HVO by the west side, bio-naphtha by the east, each with the unit's pressure behind it
        h.done = true;
        for (const [product, side] of [["hvo", 3], ["naphtha", 1]]) {
          const out = (side + tile.rot) % 4, nx = h.x + DIRS[out][0], ny = h.y + DIRS[out][1];
          const nh = { product, x: nx, y: ny, into: opposite(out), progress: 0, pressure: level.level.pressure - 1, done: false };
          run.heads.push(nh);
          if (!enter(level, run, nh, nx, ny, opposite(out))) break;
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
  if (!run.over && run.heads.every(h => h.done)) run.over = { win: true };   // every product home (or into the unit)
  return run;
}
/** A head moving into cell (nx, ny) from direction `into`: fills it or spills. */
function enter(level, run, h, nx, ny, into) {
  const next = run.tiles[ny]?.[nx];
  if (!next || next.kind === "rock") { spill(run, h, "the edge"); return false; }
  if (!hasOpening(next, into)) { spill(run, h, "no opening", nx, ny); return false; }
  const k = key(nx, ny), there = run.fill[k] || [];
  // the HVO unit takes used cooking oil at its inlet only; a crossing carries two products, one per channel; anything else holds one
  if (next.kind === "unit" && (into !== next.rot % 4 || h.product !== "uco")) { spill(run, h, into !== next.rot % 4 ? "no opening" : "wrong product", nx, ny); return false; }
  const room = next.kind === "cross" ? there.length === 1 && there[0].into % 2 !== into % 2 : false;
  if (there.length && !room) { spill(run, h, "already full", nx, ny); return false; }
  run.fill[k] = [...there, { product: h.product, into, out: next.kind === "term" || next.kind === "unit" ? null : exitOf(next, into) }];
  run.tilesFilled++;
  next.locked = true;
  return true;
}
function spill(run, h, why, x = h.x, y = h.y) {
  run.over = { win: false, why };
  run.spill = { x, y, why, product: h.product };
}
/**
 * A level's netback: what the terminals reached pay, less 10 a tile of pipe filled and 40 a pump fired, plus the time
 * left of the bonus window in tenths of a second; never below nothing, and nothing for a spill.
 */
export function score(level, run, msLeft, market = {}) {
  if (!run.over?.win) return { total: 0, revenue: 0, pipe: 0, pumps: 0, time: 0 };
  const revenue = Math.round(run.reached.reduce((s, i) => s + level.terminals[i].price * (market[level.terminals[i].product] ?? 1), 0));
  const pipe = COSTS.tile * run.tilesFilled, pumps = COSTS.pump * run.pumpsFired, time = Math.round(msLeft / 100);
  return { total: Math.max(0, revenue - pipe - pumps + time), revenue, pipe, pumps, time };
}

/**
 * The routes as the board stands, before anything flows: from each wellhead, tile by tile along the pipes, with the
 * pressure left on each. Each line ends delivered (at its own terminal), wrong (at another's), open (the pipe ends or
 * doesn't join the next tile), edge (off the field or into rock), dry (out of pressure) or separated (into the
 * HVO unit, which starts an HVO and a bio-naphtha line of its own). Other products' flows aren't modelled: it's a guide.
 */
export function trace(level, tiles) {
  const lines = [], queue = level.heads.map(h => ({ product: h.product, x: h.at[0], y: h.at[1], dir: openings(tiles[h.at[1]][h.at[0]])[0], pressure: level.level.pressure, from: [h.at[0], h.at[1]] }));
  while (queue.length) {
    const w = queue.shift(), cells = [], seen = new Set();
    let { x, y, dir, pressure } = w, end = "open", terminal = null;
    for (;;) {
      const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1], t = tiles[ny]?.[nx], into = opposite(dir);
      if (!t || t.kind === "rock") { end = "edge"; break; }
      if (!hasOpening(t, into)) { end = "open"; break; }
      if (pressure <= 0) { end = "dry"; break; }
      if (seen.has(key(nx, ny, into))) { end = "open"; break; }
      seen.add(key(nx, ny, into));
      pressure--; x = nx; y = ny;
      cells.push({ x, y, pressure });
      if (t.kind === "term") { terminal = level.terminals.findIndex(tt => tt.at[0] === x && tt.at[1] === y); end = level.terminals[terminal]?.product === w.product ? "delivered" : "wrong"; break; }
      if (t.kind === "unit") {
        if (into !== t.rot % 4 || w.product !== "uco") { end = "open"; break; }
        for (const [product, side] of [["hvo", 3], ["naphtha", 1]]) queue.push({ product, x, y, dir: (side + t.rot) % 4, pressure: level.level.pressure, from: [x, y] });
        end = "separated"; break;
      }
      if (t.kind === "pump") pressure = level.level.pressure;
      const out = exitOf(t, into);
      if (out == null) { end = "open"; break; }
      dir = out;
    }
    lines.push({ product: w.product, from: w.from, cells, end, terminal });
  }
  return lines;
}
