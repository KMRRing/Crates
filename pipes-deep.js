// Pipes in 3D: the descent. The oil comes down a shaft, slowly at first, and you lay its pipe a segment at a time at
// the open end, each turned the way you want it to go before it goes down: round the rock, through the boons on the
// way (barrels, charges that blast a rock, tanks that hold the oil back). The deeper the oil, the faster it runs; it's
// over when it catches the open end. Pure: pipes-3d.js draws it, pipes.js runs the clock, tests/pipes.mjs plays it.
//
// The shaft is SIDE squares across each way and as deep as you get: x east, y south, z down (0 at the surface).
// Sides: 0 east, 1 west, 2 south, 3 north, 4 down, 5 up; side d's opposite is d ^ 1.
import { mix, rng } from "./pipes-engine.js";

export const SIDE = 4;
export const D3 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const DOWN = 4, UP = 5;
export const opp = d => d ^ 1;
export const CAP = 6;              // the most pipe that can be laid ahead of the oil
export const START = 6000;         // ms before the oil leaves the wellhead
export const TANK3 = 4;            // a tank holds the oil this many times as long as a pipe
export const HURRY3 = 5;           // Hurry: the oil this many times faster, until it's HURRY_STOP squares behind you
export const HURRY_STOP = 2;
export const METRES = 10;          // a layer of the shaft, in metres
export const BARREL = 50;          // a barrel's points (a metre is one)
const CHUNK = 12;                  // layers made at a time
export const WELL = [1, 1];        // the wellhead's square at the surface
/** How long the oil takes over a square of pipe at depth z, ms: slow at the top, faster all the way down, to a floor
 *  (at the Normal pace; a slower one takes that many times as long, the wait at the wellhead too). */
export const fillTime = z => Math.max(450, Math.round(3200 * 0.98 ** z));
/** The wait at the wellhead at a descent's pace. */
export const startOf = D => START * (D.pace || 1);

// ---------- the pieces ----------
// straight and long (two squares) carry on the way the pipe goes; elbow turns it; jog steps it one square sideways
// and carries on. The ones that turn can be laid four ways, a quarter turn apart about the way the pipe goes.
export const PIECES3 = { straight: { cells: 1, turns: false }, elbow: { cells: 1, turns: true }, jog: { cells: 2, turns: true }, long: { cells: 2, turns: false } };
export const KINDS3 = Object.keys(PIECES3);
const BAG3 = ["straight", "straight", "straight", "elbow", "elbow", "elbow", "elbow", "jog", "jog", "long"];
function shuffled(a, r) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
/** The i-th piece of the queue on a seed, in shuffled bags of ten: the same for everyone on the same shaft. */
export function pieceAt3(seed, i) {
  const bag = Math.floor(i / BAG3.length);
  return shuffled(BAG3, rng(mix(seed, bag, 7)))[i % BAG3.length];
}
/** The sides square to side t, in the order a quarter turn about t takes them. */
export function across(t) {
  const axis = t >> 1;
  return axis === 2 ? [0, 2, 1, 3] : axis === 0 ? [2, 4, 3, 5] : [0, 4, 1, 5];
}
const step = (c, d) => ({ x: c.x + D3[d][0], y: c.y + D3[d][1], z: c.z + D3[d][2] });
export const key3 = (x, y, z) => (z * SIDE + y) * SIDE + x;
const inside = (x, y, z) => x >= 0 && y >= 0 && x < SIDE && y < SIDE && z >= 0;

// ---------- the shaft ----------
/** The shaft on a seed: its rock and boons, made twelve layers at a time as they're needed. */
export const shaftOf = seed => ({ seed, chunks: [] });
const density = z => Math.min(0.25, 0.04 + 0.0025 * z);
/**
 * Twelve layers from layer 12·ci: a vein first, a way down kept clear of rock (stepping a square sideways in a layer
 * now and then), then rock scattered round it, denser with depth, and the formations: a slab (a whole layer of rock
 * but the vein's squares and a gap or two more) in about half the chunks, a pillar or two (a column a few layers
 * tall); then the boons, on
 * squares the rock left open. Nothing within three layers of the surface.
 */
function makeChunk(seed, ci, entry) {
  const r = rng(mix(seed, ci, 3)), z0 = ci * CHUNK, at = new Map(), vein = new Set();
  let [vx, vy] = entry;
  for (let z = z0; z < z0 + CHUNK; z++) {
    vein.add(key3(vx, vy, z));
    if (z > 1 && r() < 0.45) {
      const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => inside(vx + dx, vy + dy, z));
      const [dx, dy] = ways[Math.floor(r() * ways.length)];
      vx += dx; vy += dy;
      vein.add(key3(vx, vy, z));
    }
  }
  const rock = (x, y, z) => { if (z >= 3 && !vein.has(key3(x, y, z))) at.set(key3(x, y, z), "rock"); };
  for (let z = z0; z < z0 + CHUNK; z++) for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) if (r() < density(z)) rock(x, y, z);
  if (ci > 0 && r() < 0.55) {
    const z = z0 + 2 + Math.floor(r() * (CHUNK - 4)), gaps = new Set();
    for (let n = 1 + Math.floor(r() * 2); n > 0; n--) gaps.add(key3(Math.floor(r() * SIDE), Math.floor(r() * SIDE), z));
    for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) if (!gaps.has(key3(x, y, z))) rock(x, y, z); else at.delete(key3(x, y, z));
  }
  for (let n = ci === 0 ? 0 : r() < 0.6 ? 1 : 2; n > 0; n--) {
    const x = Math.floor(r() * SIDE), y = Math.floor(r() * SIDE), z1 = z0 + Math.floor(r() * CHUNK), h = 3 + Math.floor(r() * 4);
    for (let z = z1; z < Math.min(z0 + CHUNK, z1 + h); z++) rock(x, y, z);
  }
  // boons: a barrel in most layers, now and then a charge or a tank, each on an open square
  for (let z = Math.max(2, z0); z < z0 + CHUNK; z++) {
    for (const [kind, p, from] of [["barrel", 0.4, 2], ["charge", 0.09, 5], ["tank", 0.07, 8]]) {
      if (z < from || r() >= p) continue;
      const open = [];
      for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) if (!at.has(key3(x, y, z))) open.push(key3(x, y, z));
      if (open.length) at.set(open[Math.floor(r() * open.length)], kind);
    }
  }
  return { at, exit: [vx, vy] };
}
function chunkOf(S, ci) {
  while (S.chunks.length <= ci) S.chunks.push(makeChunk(S.seed, S.chunks.length, S.chunks.length ? S.chunks[S.chunks.length - 1].exit : WELL));
  return S.chunks[ci];
}
/** What the shaft was made with at a square: "rock", "barrel", "charge", "tank" or null (outside it, "wall"). */
export function madeAt(S, x, y, z) {
  if (!inside(x, y, z)) return "wall";
  return chunkOf(S, Math.floor(z / CHUNK)).at.get(key3(x, y, z)) || null;
}

// ---------- the descent ----------
/**
 * A descent under way: pipe (its squares from the wellhead, each { x, y, z, a, b }: the sides the oil comes in and
 * goes out by; tank: true where a tank was laid through), cur (the piece in hand), turn (how it's turned: an index
 * into its ways), next (the queue's place), hold (a piece set aside) and held (set aside already, for the piece in
 * hand), oil ({ i, p }: the square of pipe it's in and how far through), t (ms since the start), flowing, hurry,
 * charges, barrels, blasted and taken (squares of rock blasted and of boons laid through, as keys), deepest (the
 * deepest layer the oil has passed), over ({ why, at } once the oil has caught the open end), pace (1, or slower: the
 * oil's every square and the wait at the wellhead taking that many times as long).
 */
export function newDescent(seed, pace = 1) {
  const [x, y] = WELL;
  const D = { seed, pipe: [{ x, y, z: 0, a: UP, b: DOWN, src: true }], cur: pieceAt3(seed, 0), next: 1, hold: null, held: false, turn: 0,
    oil: { i: 0, p: 0 }, t: 0, flowing: false, hurry: false, charges: 0, barrels: 0, blasted: [], taken: [], deepest: 0, over: null, pace };
  return D;
}
// the pipe's squares as a set, kept up as it grows (a descent is plain data, saved as it is)
const laid = new WeakMap();
function pipeSet(D) {
  let m = laid.get(D);
  if (!m || m.pipe !== D.pipe || m.n > D.pipe.length) { m = { pipe: D.pipe, n: 0, set: new Set() }; laid.set(D, m); }
  for (; m.n < D.pipe.length; m.n++) { const c = D.pipe[m.n]; m.set.add(key3(c.x, c.y, c.z)); }
  return m.set;
}
/** What's at a square now: "wall", "rock", "pipe", a boon not yet taken, or null. */
export function contentAt(S, D, x, y, z) {
  const made = madeAt(S, x, y, z);
  if (made === "wall") return made;
  const k = key3(x, y, z);
  if (pipeSet(D).has(k)) return "pipe";
  if (made === "rock") return D.blasted.includes(k) ? null : "rock";
  if (made && D.taken.includes(k)) return null;
  return made;
}
const blocking = what => what === "wall" || what === "rock" || what === "pipe";
/** The pipe's open end: the square the next piece goes into, and the way the pipe is going. */
export function openEnd(D) { const last = D.pipe[D.pipe.length - 1]; return { ...step(last, last.b), d: last.b }; }
/** The pipe laid ahead of the oil (squares it hasn't entered). */
export const lead = D => D.pipe.length - 1 - D.oil.i;
/** Whether a piece taking n squares can be laid now without going more than CAP ahead of the oil. */
export const room = (D, n = 1) => lead(D) + n <= CAP;
/**
 * The ways a piece can be laid at the open end, each { cells: [{ x, y, z, a, b }], exit: { x, y, z, d } }: the squares
 * it takes, and the open end it leaves. One way for a straight or a long, four for an elbow or a jog.
 */
export function waysOf(D, kind) {
  const n = openEnd(D), t = n.d, into = c => ({ x: c.x, y: c.y, z: c.z });
  const one = (cells, d) => { const last = cells[cells.length - 1]; return { cells, exit: { ...step(last, d), d } }; };
  if (kind === "straight") return [one([{ ...into(n), a: opp(t), b: t }], t)];
  if (kind === "long") return [one([{ ...into(n), a: opp(t), b: t }, { ...step(n, t), a: opp(t), b: t }], t)];
  if (kind === "elbow") return across(t).map(q => one([{ ...into(n), a: opp(t), b: q }], q));
  return across(t).map(q => one([{ ...into(n), a: opp(t), b: q }, { ...step(n, q), a: opp(q), b: t }], t));
}
/** Whether a way is open: every square it takes clear of wall, rock and pipe (a boon is laid through and taken). */
export const fits = (S, D, way) => way.cells.every(c => !blocking(contentAt(S, D, c.x, c.y, c.z)));
/** Whether a way leaves the pipe facing wall, rock or pipe (it can be laid: a charge can blast the rock). */
export const deadEnd = (S, D, way) => blocking(contentAt(S, D, way.exit.x, way.exit.y, way.exit.z)) || way.cells.some(c => c.x === way.exit.x && c.y === way.exit.y && c.z === way.exit.z);
/** The way a piece starts turned: down if that's open, else on to open ground, else anything that fits. */
export function firstTurn(S, D, kind = D.cur) {
  const ways = waysOf(D, kind);
  const rank = w => (!fits(S, D, w) ? 3 : deadEnd(S, D, w) ? 2 : w.exit.d === DOWN ? 0 : w.exit.d === UP ? 1.5 : 1);
  let best = 0;
  ways.forEach((w, i) => { if (rank(w) < rank(ways[best])) best = i; });
  return best;
}
/** The piece in hand turned a quarter on. */
export function turnPiece(D) { const n = waysOf(D, D.cur).length; D.turn = (D.turn + 1) % n; return D.turn; }
function nextPiece(S, D) { D.cur = pieceAt3(D.seed, D.next++); D.held = false; D.turn = firstTurn(S, D); }
/**
 * Lays the piece in hand as it's turned. Returns "laid", or why not: "wait" (it would put more than CAP squares ahead
 * of the oil), "blocked", "over". A boon on a square it takes is taken: a barrel's points, a charge to blast with, a
 * tank laid in the pipe.
 */
export function lay(S, D) {
  if (D.over) return "over";
  const way = waysOf(D, D.cur)[D.turn];
  if (!way) return "blocked";
  if (!room(D, way.cells.length)) return "wait";
  if (!fits(S, D, way)) return "blocked";
  for (const c of way.cells) {
    const what = contentAt(S, D, c.x, c.y, c.z), cell = { ...c };
    if (what === "barrel" || what === "charge" || what === "tank") {
      D.taken.push(key3(c.x, c.y, c.z));
      if (what === "barrel") D.barrels++;
      else if (what === "charge") D.charges++;
      else cell.tank = true;
      cell.took = what;
    }
    D.pipe.push(cell);
  }
  nextPiece(S, D);
  return "laid";
}
/** The piece in hand set aside for the one set aside before (or the queue's next), once a piece. */
export function holdPiece(S, D) {
  if (D.over || D.held) return false;
  if (D.hold == null) { D.hold = D.cur; D.cur = pieceAt3(D.seed, D.next++); }
  else [D.hold, D.cur] = [D.cur, D.hold];
  D.held = true;
  D.turn = firstTurn(S, D);
  return true;
}
/** The piece in hand thrown away for the queue's next: the oil surges a square's time on meanwhile. */
export function scrap(S, D) {
  if (D.over) return false;
  nextPiece(S, D);
  advance(S, D, D.flowing ? squareTime(D, D.pipe[D.oil.i]) : fillTime(0) * (D.pace || 1));
  return true;
}
/** A charge blasts the rock the open end faces. */
export function blast(S, D) {
  const n = openEnd(D);
  if (D.over || !D.charges || contentAt(S, D, n.x, n.y, n.z) !== "rock") return false;
  D.blasted.push(key3(n.x, n.y, n.z));
  D.charges--;
  D.turn = firstTurn(S, D);
  return true;
}
/** Hurry: the oil runs HURRY3 times faster until it's HURRY_STOP squares behind the open end (let go at once, if it's
 *  still waiting at the wellhead). */
export function hurry(S, D) {
  if (D.over || lead(D) <= HURRY_STOP) return;
  if (!D.flowing) advance(S, D, startOf(D) - D.t);
  D.hurry = true;
}
function squareTime(D, c) { return (c.src ? fillTime(0) / 2 : fillTime(c.z) * (c.tank ? TANK3 : 1)) * (D.pace || 1) / (D.hurry ? HURRY3 : 1); }
/** The clock moved on by ms: the wellhead's wait, then the oil square by square; it's over when it reaches the open end. */
export function advance(S, D, ms) {
  while (ms > 0 && !D.over) {
    if (!D.flowing) {
      const wait = startOf(D) - D.t;
      if (ms < wait) { D.t += ms; return; }
      D.t += wait; ms -= wait; D.flowing = true;
      continue;
    }
    const c = D.pipe[D.oil.i], span = squareTime(D, c), need = (1 - D.oil.p) * span;
    if (ms < need) { D.oil.p += ms / span; D.t += ms; return; }
    D.t += need; ms -= need;
    D.deepest = Math.max(D.deepest, c.z);
    if (D.oil.i + 1 < D.pipe.length) {
      D.oil.i++; D.oil.p = 0;
      if (D.hurry && lead(D) <= HURRY_STOP) D.hurry = false;
    } else { D.oil.p = 1; D.over = { why: "spill", at: openEnd(D) }; }
  }
}
/** The oil's start, before the wellhead's wait is out. */
export function release(S, D) { if (!D.flowing && !D.over) advance(S, D, startOf(D) - D.t); }
/** Metres down (the deepest layer the oil has passed) and points: a metre each, and each barrel. */
export const depthOf = D => D.deepest * METRES;
export const scoreOf = D => depthOf(D) + BARREL * D.barrels;
