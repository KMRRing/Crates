// Topple's rules, pure (no page): a table of sixty-one hexagons, four out from the middle every way. Dominoes stand on it
// in three colours, a piece of them at a time: three pieces in hand, laid anywhere they fit, in the order you like, the
// next three dealt when all three are down. The knock is on the table's time, not yours: when a hand's last piece is
// down and a knock has come due (every hand at first, then less often), you push one domino, in one of the six
// directions, before the next is laid. The table deals how hard: a push is weak, medium or strong, known from the
// knock before, and a domino that falls knocks, of the dominoes of its own colour on the three hexagons ahead of it
// (straight on, and sixty degrees either side), the one straight on if it was a weak push, the one straight on or else
// the two either side if it was a medium one, and all three if it was strong. Each after that falls the way it was
// knocked and does the same. A domino at more than sixty degrees to the way a fall is going (to
// the side, or behind) is never taken: so a line falls end to end, bending by sixty degrees where it must, and a blob
// falls along the way it's pushed and leaves much of itself standing. A knock scores ten times how many fell times the
// steps they took (a long chain pushed from its end beats a blob of as many, and where and which way it's pushed
// matters), doubled when the fall passes the bell, a mark on one hexagon that moves on when it's rung. A hand that fits nowhere, with no knock to make first, ends the game. The page
// (topple.js) draws it; tests/topple.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a colour 0–2 a hexagon, -1 empty), hand (three
// { piece, colour }, null where one has been laid), ax (the way each standing domino faces, 0–2: the axis its flat
// sides are square to, so a line of them stands face to face), due (a knock to make before the next piece), force (how hard the
// next knock is: 1 weak, 2 medium, 3 strong), credit (knocks owed, fractions of one), bell (its hexagon), rung, sets
// (hands dealt), laid, felled, score, over }.

export const R = 4, HAND = 3, COLOURS = 3;
/** How hard a push is, as the number of the three hexagons ahead of a falling domino it can knock. */
export const WEAK = 1, MEDIUM = 2, STRONG = 3;
export const FORCE_NAMES = ["weak", "medium", "strong"];
export const forceName = f => FORCE_NAMES[f - 1];
// how often the table deals each (weak, medium, strong); the first knock of a game is always medium, the rule to learn
export const FORCE_ODDS = [1.5, 4.5, 4];

// ---------- the table ----------
// A hexagon is (q, r) in axial coordinates from the middle one: q along a row (east), r down the rows, each row half a
// hexagon along from the one above. Its number counts row by row.
export const CELLS = [];
for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -R - r); q <= Math.min(R, R - r); q++) CELLS.push([q, r]);
export const SIZE = CELLS.length;
const WIDTH = 2 * R + 1, GRID = new Array(WIDTH * WIDTH).fill(-1);
CELLS.forEach(([q, r], i) => { GRID[(r + R) * WIDTH + q + R] = i; });
/** The number of the hexagon at (q, r), or -1 off the table. */
export const at = (q, r) => (Math.abs(q) > R || Math.abs(r) > R ? -1 : GRID[(r + R) * WIDTH + q + R]);
/** The six directions, turning from east a sixty degrees at a time (towards the top of the table): E, NE, NW, W, SW, SE. */
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const DIR_NAMES = ["east", "north-east", "north-west", "west", "south-west", "south-east"];
// NEXT[i][d]: the hexagon beside i in direction d, or -1 at the edge
const NEXT = CELLS.map(([q, r]) => DIRS.map(([dq, dr]) => at(q + dq, r + dr)));
export const next = (i, d) => NEXT[i][d];

// ---------- the pieces: chains of one to five dominoes, in every way each lies ----------
// A shape is its hexagons as [q, r] from its first (the top row's leftmost), which is the one that's put on a hexagon.
const keyOf = cells => cells.map(c => c.join(",")).join(";");
function normal(cells) {
  const sorted = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]), [q0, r0] = sorted[0];
  return sorted.map(([q, r]) => [q - q0, r - r0]);
}
// the twelve ways a shape can lie: six turns of sixty degrees, and each flipped (in cube coordinates, x = q, z = r)
const turn = ([q, r]) => [-r, q + r], flip = ([q, r]) => [r, q];
function ways(cells) {
  const out = new Map();
  let c = cells;
  for (let k = 0; k < 6; k++) {
    c = c.map(turn);
    for (const v of [c, c.map(flip)]) { const n = normal(v); out.set(keyOf(n), n); }
  }
  return [...out.values()];
}
const touching = (a, b) => DIRS.some(([dq, dr]) => a[0] + dq === b[0] && a[1] + dr === b[1]);
/** Every shape of n hexagons that's one way of several, found by growing those of n - 1. */
function free(n) {
  let shapes = [[[0, 0]]];
  for (let k = 1; k < n; k++) {
    const grown = new Map();
    for (const s of shapes) for (const [q, r] of s) for (const [dq, dr] of DIRS) {
      const c = [q + dq, r + dr];
      if (s.some(([a, b]) => a === c[0] && b === c[1])) continue;
      const bigger = [...s, c], canon = ways(bigger).map(keyOf).sort()[0];
      if (!grown.has(canon)) grown.set(canon, normal(bigger));
    }
    shapes = [...grown.values()];
  }
  return shapes;
}
// A chain is a piece that could fall in one go: no three of its dominoes all touching, none touching more than three
// of the rest (a line, a bend, an arc, a wave, a fork of three). Blobs fall too whole to need any thought.
const triangle = s => s.some(a => s.some(b => s.some(c => a !== b && b !== c && a !== c && touching(a, b) && touching(b, c) && touching(a, c))));
const touchesMost = s => Math.max(...s.map(c => s.filter(d => d !== c && touching(c, d)).length));
const straight = s => new Set(s.map(c => c[1])).size === 1 || new Set(s.map(c => c[0])).size === 1 || new Set(s.map(c => c[0] + c[1])).size === 1;
// how often each size is dealt; within a size, a straight line comes twice as often as any other shape
const SIZES = [[1, 1], [2, 3], [3, 7.5], [4, 9.5], [5, 2]];
const FAMILIES = SIZES.flatMap(([n, weight]) => {
  const shapes = free(n).filter(s => !triangle(s) && touchesMost(s) <= 3), w = s => (straight(s) ? 2 : 1), total = shapes.reduce((a, s) => a + w(s), 0);
  return shapes.map(s => [(weight * w(s)) / total, ways(s)]);
});
/** Every piece by name (its hexagons from its first, as "q,r;q,r"): its hexagons and how often it's dealt. */
export const PIECES = Object.fromEntries(FAMILIES.flatMap(([weight, all]) => all.map(cells => [keyOf(cells), { cells, weight: weight / all.length }])));
const NAMES = Object.keys(PIECES).sort(), TOTAL = NAMES.reduce((a, k) => a + PIECES[k].weight, 0);

// ---------- the deal ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function dealOne(s) {
  let r = draw(s.seed, s.n++) * TOTAL, piece = NAMES[NAMES.length - 1];
  for (const k of NAMES) if ((r -= PIECES[k].weight) < 0) { piece = k; break; }
  return { piece, colour: Math.floor(draw(s.seed, s.n++) * COLOURS) };
}
function deal(s) { s.sets++; s.hand = Array.from({ length: HAND }, () => dealOne(s)); }
/**
 * The way each domino of a piece faces, from the shape alone: 0–2, the axis (a direction and its opposite, as DIRS
 * numbers them mod 3) its flat sides are square to. One beside a single other faces it; a line faces along itself; a
 * bend between two faces the way the chain runs through it; a lone domino takes a fixed turn from where it stands, so a
 * table of them isn't all one way. `coords` are [q, r] and need not be on the table.
 */
export function axesOfCoords(coords) {
  const has = new Set(coords.map(c => c.join(",")));
  return coords.map(([q, r]) => {
    const dirs = DIRS.flatMap(([dq, dr], d) => (has.has(`${q + dq},${r + dr}`) ? [d] : []));
    if (!dirs.length) return (((q * 5 + r * 7) % 3) + 3) % 3;
    if (dirs.length === 1) return dirs[0] % 3;
    if (dirs.length === 2) {
      const [a, b] = dirs, gap = (b - a + 6) % 6;
      if (gap === 3) return a % 3;
      const from = gap === 2 ? a : gap === 4 ? b : a;                // the one of the pair the other lies two on from
      return (from + 2) % 3;
    }
    const count = [0, 0, 0];
    for (const d of dirs) count[d % 3]++;
    return count.indexOf(Math.max(...count));
  });
}
/** The same for hexagons by number: the axes of the dominoes laid on them. */
export const axesOf = laid => axesOfCoords(laid.map(i => CELLS[i]));

/** The bell to an empty hexagon at random (none on a full table). */
function hang(s) {
  const empty = s.cells.flatMap((c, i) => (c < 0 ? [i] : []));
  s.bell = empty.length ? empty[Math.floor(draw(s.seed, s.n++) * empty.length)] : -1;
}

/** How hard the next knock is, dealt from the seed. */
function pushOf(s) {
  const total = FORCE_ODDS.reduce((a, b) => a + b, 0);
  let r = draw(s.seed, s.n++) * total;
  for (let k = 0; k < FORCE_ODDS.length; k++) if ((r -= FORCE_ODDS[k]) < 0) return k + 1;
  return STRONG;
}

// ---------- the pace of the knocks ----------
// A knock after every hand to start with, so a bad hand is soon relieved; then fewer, so the table fills and the chains
// set up grow: the rate (knocks a hand) falls in a straight line from one at the sixteenth hand to seven in ten at the
// fifty-sixth, and stays there. Each finished hand adds the rate to a credit, and a knock falls due when it reaches one.
// (Tuned by playing games out with the strengths dealt: a player who keeps lines whole lasts about a hundred pieces, one
// who lays every piece in the corner about forty.)
export const PACE = { from: 16, to: 56, end: 0.7 };
export const rate = sets => (sets <= PACE.from ? 1 : sets >= PACE.to ? PACE.end : 1 - ((sets - PACE.from) / (PACE.to - PACE.from)) * (1 - PACE.end));
const EPS = 1e-9;
/** How many hands until the knock falls due, counting the one in play (0: it's due now). */
export function untilKnock(s) {
  if (s.due) return 0;
  let credit = s.credit, k = 0;
  do credit += rate(s.sets + k++); while (credit < 1 - EPS && k < 1000);
  return k;
}

/** A new game from a seed: an empty table, the bell on it, three pieces, and a knock after the first hand. */
export function newGame(seed) {
  const s = { v: 4, seed: seed >>> 0, n: 0, cells: new Array(SIZE).fill(-1), ax: new Array(SIZE).fill(-1), hand: [], due: false, force: MEDIUM, credit: 0, bell: -1, rung: 0, sets: 0, laid: 0, felled: 0, score: 0, over: false };
  deal(s);
  hang(s);
  return s;
}

// ---------- laying a piece ----------
/** The hexagons a piece would cover with its first on (q, r), or null if it doesn't fit there. */
export function cover(cells, piece, q, r) {
  const out = [];
  for (const [dq, dr] of PIECES[piece].cells) {
    const i = at(q + dq, r + dr);
    if (i < 0 || cells[i] >= 0) return null;
    out.push(i);
  }
  return out;
}
export const fitsAnywhere = (cells, piece) => CELLS.some(([q, r]) => cover(cells, piece, q, r));
const stuck = s => !s.hand.some(h => h && fitsAnywhere(s.cells, h.piece));

// ---------- a knock ----------
/**
 * What pushing the domino on hexagon `start` in direction `dir` brings down: the dominoes in the order they fall, each
 * as [hexagon, step (0 the one pushed, 1 those it knocks, …), the hexagon of the one that knocked it (-1 for the first)].
 * Each falls the way it was knocked and knocks, of its own colour, by how hard the push is (`force`): a weak one the
 * domino straight ahead; a medium one that, or where none of its colour stands there the two at sixty degrees either
 * side; a strong one all three. So a weak push's fall is a part of a medium one's, and that of a strong one's. Empty
 * for an empty hexagon.
 */
export function chain(cells, start, dir, force = MEDIUM) {
  const c = cells[start];
  if (!(c >= 0)) return [];
  const step = new Map([[start, 0]]), by = new Map([[start, -1]]), way = new Map([[start, dir]]), queue = [start];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k], d = way.get(i), ahead = NEXT[i][d], left = (d + 1) % 6, right = (d + 5) % 6;
    const goes = force === WEAK ? [d] : force === STRONG ? [d, left, right] : ahead >= 0 && cells[ahead] === c ? [d] : [left, right];
    for (const e of goes) {
      const j = NEXT[i][e];
      if (j >= 0 && cells[j] === c && !step.has(j)) { step.set(j, step.get(i) + 1); by.set(j, i); way.set(j, e); queue.push(j); }
    }
  }
  return queue.map(i => [i, step.get(i), by.get(i)]);
}
/** The dominoes of a colour joined to hexagon i along their sides, all of them, whether a knock would take them or not. */
export function group(cells, i) {
  const c = cells[i];
  if (!(c >= 0)) return [];
  const seen = new Set([i]), queue = [i];
  for (let k = 0; k < queue.length; k++) for (const j of NEXT[queue[k]]) if (j >= 0 && cells[j] === c && !seen.has(j)) { seen.add(j); queue.push(j); }
  return queue;
}
/** The steps a knock's fall takes (as chain gives it): from the one pushed, counting it. */
export const stepsOf = fell => (fell.length ? Math.max(...fell.map(f => f[1])) + 1 : 0);
/** Ten times the dominoes felled by one knock times the steps they take (a straight run from its end: its length). */
export const worth = (n, steps = n) => 10 * n * steps;
/** What a push on hexagon i towards `dir` would come to: { fell (as chain gives it), steps, rings (the bell's hexagon among them), gain }. */
export function knockOn(cells, i, dir, bell = -1, force = MEDIUM) {
  const fell = chain(cells, i, dir, force), steps = stepsOf(fell), rings = bell >= 0 && fell.some(f => f[0] === bell);
  return { fell, steps, rings, gain: worth(fell.length, steps) * (rings ? 2 : 1) };
}
/**
 * The best push on the dominoes joined to hexagon i: { at, dir, fell (how many), steps, rings, gain, size (how many are
 * joined) }, the one scoring most (felling most where they score the same). Every domino of them, every direction:
 * they're at most the table, so this is quick.
 */
export function longest(cells, i, bell = -1, force = MEDIUM) {
  const all = group(cells, i);
  let best = { at: -1, dir: -1, fell: 0, steps: 0, rings: false, gain: 0 };
  for (const j of all) for (let dir = 0; dir < 6; dir++) {
    const k = knockOn(cells, j, dir, bell, force);
    if (k.gain > best.gain || (k.gain === best.gain && k.fell.length > best.fell)) best = { at: j, dir, fell: k.fell.length, steps: k.steps, rings: k.rings, gain: k.gain };
  }
  return { ...best, size: all.length };
}
/** The dominoes standing, joined by colour: one hexagon of each, how many, and its best push (longest's), most first. */
export function chains(cells, bell = -1, force = MEDIUM) {
  const seen = new Set(), out = [];
  cells.forEach((c, i) => {
    if (c < 0 || seen.has(i)) return;
    const all = group(cells, i);
    for (const j of all) seen.add(j);
    out.push({ at: i, length: all.length, best: longest(cells, i, bell, force) });
  });
  return out.sort((a, b) => b.length - a.length);
}

/**
 * Lays the piece in hand slot `slot` with its first domino on (q, r): the game after it, and what happened, for the page
 * to show: laid (its hexagons), dealt (a new hand came), due (a knock is to be made now), over. Pure; throws if a knock
 * is to be made first, or the piece isn't there or doesn't fit.
 */
export function lay(game, slot, q, r) {
  const s = structuredClone(game), h = s.hand[slot];
  if (s.over || !h) throw new Error("no piece there");
  if (s.due) throw new Error("knock first");
  const laid = cover(s.cells, h.piece, q, r);
  if (!laid) throw new Error("it doesn't fit there");
  const faces = axesOf(laid);
  laid.forEach((i, k) => { s.cells[i] = h.colour; s.ax[i] = faces[k]; });
  s.laid++;
  s.hand[slot] = null;
  const dealt = s.hand.every(k => !k);
  if (dealt) {
    deal(s);
    s.credit += rate(s.sets - 1);
    if (s.credit >= 1 - EPS) { s.credit -= 1; s.due = true; }
  }
  s.over = !s.due && stuck(s);
  return { state: s, laid, dealt, due: s.due, over: s.over };
}
/**
 * Pushes the domino on a hexagon towards a direction, the knock that's due, as hard as the game says: the game after it
 * (with the next knock's force dealt), the fall (as chain gives it), its steps, whether it rang the bell and the gain. Pure; throws with no knock due or no domino there.
 */
export function knock(game, i, dir) {
  const s = structuredClone(game);
  if (s.over || !s.due) throw new Error("no knock due");
  const k = knockOn(s.cells, i, dir, s.bell, s.force);
  if (!k.fell.length) throw new Error("no domino there");
  for (const [j] of k.fell) { s.cells[j] = -1; s.ax[j] = -1; }
  s.score += k.gain;
  s.felled += k.fell.length;
  s.due = false;
  s.force = pushOf(s);
  if (k.rings) { s.rung++; hang(s); }
  s.over = stuck(s);
  return { state: s, fell: k.fell, steps: k.steps, rang: k.rings, gain: k.gain, over: s.over };
}
/** Every way to lay a piece in hand: [{ slot, q, r }] (none while a knock is due). For the tests and the tuning players. */
export function moves(s) {
  const out = [];
  if (s.due) return out;
  s.hand.forEach((h, slot) => {
    if (!h) return;
    for (const [q, r] of CELLS) if (cover(s.cells, h.piece, q, r)) out.push({ slot, q, r });
  });
  return out;
}
export const filled = s => s.cells.filter(c => c >= 0).length;
