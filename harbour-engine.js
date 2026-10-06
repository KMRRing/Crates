// Harbour's rules, apart from the page: a harbour of hexes, jetties, and ships whose programs all run in lockstep.
// The page (harbour.js) draws it, harbour-tape.js edits the programs, and tests/harbour.mjs replays reference
// solutions through the same rules.
//
// Each hour every ship carries out its program's instruction for that hour. Programs loop, and the longest sets the
// loop's length for all of them, so ships stay in step for good. Moves happen together. A ship that would end on land
// or off the map runs aground; two that would end on one tile, or pass through each other, collide; either ends the
// run. A ship may move onto a tile another is leaving that same hour: ships can follow each other. Then loads and
// discharges, each in full or not at all, and one that can't happen does nothing: a load needs the jetty's whole
// parcel on hand and room for it aboard; a discharge needs the cargo to be the size the jetty takes and on its spec.
// That rule (an impossible transfer is no transfer) is what later levels build their logic on. Last, every
// refinery's tank fills at its rate, up to what it holds; when it's full the refinery waits.

// The harbour is hexes, pointy side up, every odd row set half a hex to the right; a tile is (x, y), its column and
// row. Ships steer as ships do, relative to their heading: ahead; port, a 60° turn to the left and one hex on; starboard,
// the same to the right; astern, a hex back still facing the same way. A program written so runs the same turned to any
// of the six directions (or mirrored, port and starboard swapped): a module can be reused facing another way.
export const HEADINGS = ["E", "NE", "NW", "W", "SW", "SE"];       // counterclockwise: a port turn is one on
const AXIAL = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const STEER = { A: 0, P: 1, S: -1 };                       // ahead, port, starboard: the turn, then a hex on
export const ASTERN = "B", LOAD = "L", DISCHARGE = "D", WAIT = ".";
export const OPS = [...Object.keys(STEER), ASTERN, LOAD, DISCHARGE, WAIT];
export const moves = op => op in STEER || op === ASTERN;

/** The hex next to (x, y) in direction h (0 east, then counterclockwise). */
export function neighbour(x, y, h) {
  const [dq, dr] = AXIAL[((h % 6) + 6) % 6], q = x - (y - (y & 1)) / 2 + dq, r = y + dr;
  return { x: q + (r - (r & 1)) / 2, y: r };
}

/** Where a ship at (x, y) facing h ends up after one instruction, and which way it then faces. */
export function steer(ship, op) {
  if (op === ASTERN) return { ...neighbour(ship.x, ship.y, ship.h + 3), h: ship.h };
  if (op in STEER) { const h = (ship.h + STEER[op] + 6) % 6; return { ...neighbour(ship.x, ship.y, h), h }; }
  return { x: ship.x, y: ship.y, h: ship.h };
}

// Ships come in classes, the same in every level: what each carries and what it costs to hire. A level offers some of
// them, so many of each (its fleet); a ship's type is its class, the level's first if it has none.
export const CLASSES = {
  coaster: { name: "Coaster", cap: 4, cost: 20 },
  handy: { name: "Handy", cap: 8, cost: 26 },
};
export const classOf = (level, ship) => CLASSES[ship.type || Object.keys(level.fleet)[0]];
export const typeOf = (level, ship) => ship.type || Object.keys(level.fleet)[0];
export const jettiesOf = level => level.jetties;
export const total = cargo => Object.values(cargo).reduce((a, b) => a + b, 0);
const priceOf = (level, j) => level.products?.[j.product]?.price || 0;
const pct = v => `${Math.round(v * 100)}%`;

/** The level's grid: its size, and what each tile is (land, water, or a jetty, by its letter on the map). */
export function grid(level) {
  const rows = level.map, h = rows.length, w = rows[0].length, J = jettiesOf(level);
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return "off";
    const c = rows[y][x];
    return c === "." ? "water" : J[c] ? c : "land";
  };
  return { w, h, at, afloat: (x, y) => !["land", "off"].includes(at(x, y)), jetty: (x, y) => J[at(x, y)] || null };
}

/** A program as it plays, hour by hour. A program is a row of items: an instruction (null for an empty hour) or a loop
 * { n, body } that plays its body n times. */
export function flatten(prog) {
  const out = [];
  for (const it of prog) if (it && typeof it === "object") for (let k = 0; k < it.n; k++) out.push(...it.body); else out.push(it ?? null);
  return out;
}

/** The loop's length: the longest program, up to its last instruction (empty hours after it don't count). */
export function period(solution) {
  return Math.max(1, ...solution.ships.map(s => flatten(s.prog).reduce((n, op, i) => (op ? i + 1 : n), 0)));
}

/** Instructions as written: each counts once, a loop's body once however often it plays, empty hours not at all. */
export const instructions = solution => solution.ships.reduce((n, s) =>
  n + s.prog.reduce((m, it) => m + (it && typeof it === "object" ? it.body.filter(Boolean).length : it ? 1 : 0), 0), 0);

const okOp = op => op === null || OPS.includes(op);
const okItem = it => okOp(it) || (!!it && typeof it === "object" && Number.isInteger(it.n) && it.n >= 2 && it.n <= 99
  && Array.isArray(it.body) && it.body.length > 0 && it.body.every(okOp));

/** Why a solution can't run as placed: ships off the water, two on one tile, more of a class than the fleet has.
 * null when it can. */
export function invalid(level, solution) {
  const g = grid(level), seen = new Set(), used = {};
  for (const [i, s] of solution.ships.entries()) {
    const type = typeOf(level, s), n = (used[type] = (used[type] || 0) + 1);
    if (!(type in level.fleet) || !CLASSES[type]) return `This harbour has no ${CLASSES[type]?.name || type}s`;
    if (n > level.fleet[type]) return `The fleet has ${level.fleet[type]} ${CLASSES[type].name}${level.fleet[type] > 1 ? "s" : ""}`;
    if (!g.afloat(s.x, s.y)) return `Ship ${i + 1} isn't on water`;
    if (!Number.isInteger(s.h ?? 0) || (s.h ?? 0) < 0 || (s.h ?? 0) > 5) return `Ship ${i + 1} has no heading`;
    if (seen.has(`${s.x},${s.y}`)) return `Two ships start on one tile`;
    seen.add(`${s.x},${s.y}`);
    if (!Array.isArray(s.prog) || !s.prog.every(okItem)) return `Ship ${i + 1}'s program has something it can't run`;
  }
  return null;
}

/** Why a cargo is off a jetty's spec (each product's share of it between a least and a most), or null if it's on. */
export function offSpec(level, spec, cargo) {
  const all = total(cargo);
  for (const [p, [lo, hi]] of Object.entries(spec || {})) {
    const share = (cargo[p] || 0) / all, name = level.products?.[p]?.name || p;
    if (share < lo - 1e-9) return `${name} ${pct(share)}, needs at least ${pct(lo)}`;
    if (share > hi + 1e-9) return `${name} ${pct(share)}, needs at most ${pct(hi)}`;
  }
  return null;
}

/** The run before its first hour. */
export function start(level, solution) {
  const ships = solution.ships.map(s => ({ x: s.x, y: s.y, h: s.h ?? 0, type: typeOf(level, s), cargo: {} })), tanks = {};
  for (const [k, j] of Object.entries(jettiesOf(level))) if (j.tank) tanks[k] = j.tank.start || 0;
  return { t: 0, ships, tanks, delivered: 0, bought: 0, visited: new Set(ships.map(s => `${s.x},${s.y}`)), done: null, crash: null, events: [] };
}

/** One hour: a new state (the old one is left as it was, so the page can step and redraw from either). */
export function step(level, solution, state) {
  if (state.done || state.crash) return state;
  const g = grid(level), P = period(solution), t = state.t, plays = solution.ships.map(s => flatten(s.prog));
  const op = i => plays[i][t % P] || WAIT;
  const from = state.ships, to = from.map((s, i) => steer(s, op(i)));
  const next = { ...state, t: t + 1, events: [] };
  const crash = (kind, ships, at) => ({ ...next, crash: { kind, ships, at, t: t + 1 } });

  for (const [i, p] of to.entries()) if (!g.afloat(p.x, p.y)) return crash("aground", [i], [p.x, p.y]);
  for (let i = 0; i < to.length; i++) for (let j = i + 1; j < to.length; j++) {
    const swapped = to[i].x === from[j].x && to[i].y === from[j].y && to[j].x === from[i].x && to[j].y === from[i].y;
    const shared = to[i].x === to[j].x && to[i].y === to[j].y;
    if (swapped || shared) return crash("collision", [i, j], [to[i].x, to[i].y]);
  }

  next.ships = to.map((p, i) => ({ ...p, type: from[i].type, cargo: { ...from[i].cargo } }));
  next.tanks = { ...state.tanks };
  next.visited = new Set(state.visited);
  for (const s of next.ships) next.visited.add(`${s.x},${s.y}`);
  for (const [i, s] of next.ships.entries()) {
    const key = g.at(s.x, s.y), j = g.jetty(s.x, s.y);
    if (!j) continue;
    if (op(i) === LOAD && j.kind === "load") {
      const p = j.parcel, onHand = j.tank ? next.tanks[key] : Infinity;
      if (CLASSES[s.type].cap - total(s.cargo) < p || onHand < p) continue;
      s.cargo[j.product] = (s.cargo[j.product] || 0) + p;
      if (j.tank) next.tanks[key] -= p;
      next.bought += p * priceOf(level, j);
      next.events.push({ ship: i, kind: "load" });
    }
    // a discharge takes the jetty's parcel out of the ship's blend, every product in its share; the rest stays aboard
    if (op(i) === DISCHARGE && j.kind === "discharge") {
      const amount = total(s.cargo), p = j.parcel;
      if (!amount) continue;
      const why = amount < p - 1e-9 ? `carries ${+amount.toFixed(2)}, the jetty takes ${p}` : offSpec(level, j.spec, s.cargo);
      if (why) { next.events.push({ ship: i, kind: "refused", why }); continue; }
      const keep = (amount - p) / amount;
      for (const k of Object.keys(s.cargo)) { s.cargo[k] *= keep; if (s.cargo[k] < 1e-9) delete s.cargo[k]; }
      next.delivered++;
      next.events.push({ ship: i, kind: "discharge" });
    }
  }
  for (const [k, j] of Object.entries(jettiesOf(level))) if (j.tank) next.tanks[k] = Math.min(j.tank.cap, next.tanks[k] + j.tank.rate);
  if (next.delivered >= level.target) next.done = t + 1;
  return next;
}

/** Runs to the end: done, crashed, or out of hours. */
export function run(level, solution, limit = level.maxCycles) {
  let s = start(level, solution);
  while (!s.done && !s.crash && s.t < limit) s = step(level, solution, s);
  return s;
}

/** The four measures, each kept for itself: what it cost (ships hired and product bought), the hours to the last
 * delivery, the water used (every tile a ship was on at some point) and the instructions written. */
export function score(level, solution, final) {
  const hire = solution.ships.reduce((n, s) => n + classOf(level, s).cost, 0);
  return { cost: hire + final.bought, hours: final.done, water: final.visited.size, instructions: instructions(solution) };
}
