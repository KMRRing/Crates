// Harbour's rules, apart from the page: a harbour on a grid and ships whose programs all run in lockstep. The page
// (harbour.js) draws it and edits the programs; tests/harbour.mjs replays reference solutions through the same rules.
//
// Each hour every ship carries out its program's instruction for that hour. Programs loop, and the longest sets the
// loop's length for all of them, so ships stay in step for good. Moves happen together. A ship that would end on land
// or off the map runs aground; two that would end on one tile, or pass through each other, collide; either ends the
// run. A ship may move onto a tile another is leaving that same hour: ships can follow each other. Then loads and
// discharges, and one that can't happen does nothing: loading where there's nothing to load, discharging an empty
// ship. That rule (an impossible transfer is no transfer) is what later levels build their logic on.

export const MOVES = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const LOAD = "L", DISCHARGE = "D", WAIT = ".";
export const OPS = [...Object.keys(MOVES), LOAD, DISCHARGE, WAIT];
const KIND = { "#": "land", ".": "water", L: "load", D: "discharge" };

/** The level's grid: its size and what each tile is (land, water, or a berth to load or discharge at). */
export function grid(level) {
  const rows = level.map, h = rows.length, w = rows[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? "off" : KIND[rows[y][x]]);
  return { w, h, at, afloat: (x, y) => !["land", "off"].includes(at(x, y)) };
}

/** The loop's length: the longest program, up to its last instruction (empty cells after it don't count). */
export function period(solution) {
  return Math.max(1, ...solution.ships.map(s => s.prog.reduce((n, op, i) => (op ? i + 1 : n), 0)));
}

/** Why a solution can't run as placed: ships off the water, two on one tile, too many. null when it can. */
export function invalid(level, solution) {
  const g = grid(level), seen = new Set();
  if (solution.ships.length > level.maxShips) return `At most ${level.maxShips} ships`;
  for (const [i, s] of solution.ships.entries()) {
    if (!g.afloat(s.x, s.y)) return `Ship ${i + 1} isn't on water`;
    if (seen.has(`${s.x},${s.y}`)) return `Two ships start on one tile`;
    seen.add(`${s.x},${s.y}`);
    if (s.prog.some(op => op && !OPS.includes(op))) return `Ship ${i + 1} has an unknown instruction`;
  }
  return null;
}

/** The run before its first hour. */
export function start(level, solution) {
  const ships = solution.ships.map(s => ({ x: s.x, y: s.y, laden: false }));
  return { t: 0, ships, delivered: 0, visited: new Set(ships.map(s => `${s.x},${s.y}`)), done: null, crash: null, events: [] };
}

/** One hour: a new state (the old one is left as it was, so the page can step and redraw from either). */
export function step(level, solution, state) {
  if (state.done || state.crash) return state;
  const g = grid(level), P = period(solution), t = state.t;
  const op = i => solution.ships[i].prog[t % P] || WAIT;
  const from = state.ships, to = from.map((s, i) => { const d = MOVES[op(i)]; return d ? { x: s.x + d[0], y: s.y + d[1] } : { x: s.x, y: s.y }; });
  const next = { ...state, t: t + 1, events: [] };
  const crash = (kind, ships, at) => ({ ...next, crash: { kind, ships, at, t: t + 1 } });

  for (const [i, p] of to.entries()) if (!g.afloat(p.x, p.y)) return crash("aground", [i], [p.x, p.y]);
  for (let i = 0; i < to.length; i++) for (let j = i + 1; j < to.length; j++) {
    const swapped = to[i].x === from[j].x && to[i].y === from[j].y && to[j].x === from[i].x && to[j].y === from[i].y;
    const shared = to[i].x === to[j].x && to[i].y === to[j].y;
    if (swapped || shared) return crash("collision", [i, j], [to[i].x, to[i].y]);
  }

  next.ships = to.map((p, i) => ({ ...p, laden: from[i].laden }));
  next.visited = new Set(state.visited);
  for (const s of next.ships) next.visited.add(`${s.x},${s.y}`);
  for (const [i, s] of next.ships.entries()) {
    const here = g.at(s.x, s.y);
    if (op(i) === LOAD && here === "load" && !s.laden) { s.laden = true; next.events.push({ ship: i, kind: "load" }); }
    if (op(i) === DISCHARGE && here === "discharge" && s.laden) { s.laden = false; next.delivered++; next.events.push({ ship: i, kind: "discharge" }); }
  }
  if (next.delivered >= level.target) next.done = t + 1;
  return next;
}

/** Runs to the end: done, crashed, or out of hours. */
export function run(level, solution, limit = level.maxCycles) {
  let s = start(level, solution);
  while (!s.done && !s.crash && s.t < limit) s = step(level, solution, s);
  return s;
}

/** The three measures, each kept for itself: what the ships cost to hire, the hours to the last delivery, and the
 * water they used (every tile a ship was on at some point). */
export function score(level, solution, final) {
  return { hire: solution.ships.length * level.shipCost, hours: final.done, water: final.visited.size };
}
