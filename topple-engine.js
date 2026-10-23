// Topple's rules, pure (no page): a table of sixty-one hexagons, four out from the middle every way. Dominoes stand on it
// in three colours, a piece of them at a time: three pieces in hand, laid anywhere they fit, in the order you like, the
// next three dealt when all three are down.
//
// A standing domino is a slab, the same front and back, so what it has is an axis: the way its broad faces look, a way
// and its opposite. There are six, thirty degrees apart: an even axis looks at two neighbouring hexagons (a hexagon
// axis), an odd one at the two lines between neighbours that touch (a line axis: the side those two neighbours share).
// A domino falls along its axis. Falling at a hexagon it knocks the domino there, if that one's broad face is mostly
// toward it (its axis within thirty degrees of the fall); falling at a line it knocks the dominoes on both hexagons
// either side of the line, each unless it stands edge-on (its axis square to the fall). Each one knocked falls along
// its own axis, the way nearer the fall that knocked it, and knocks in turn. Only a domino's own colour is knocked.
// So a straight line falls end to end, a bend of sixty degrees falls through when the domino at the bend faces the line
// between the way the fall comes in and the way it goes on, a sharper turn is never taken, and a domino facing a line
// is the one way to bring down two. Turning a domino is free, as often as you like.
//
// The knock is on the table's time, not yours: when a hand's last piece is down and a knock has come due (every hand at
// first, then less often), you push one domino, either way along its axis, before the next is laid. A knock scores ten
// times how many fell times the steps they took (a long chain pushed from its end beats a blob of as many), doubled
// when the fall passes the bell, a mark on one hexagon that moves on when it's rung. A knock that's due may instead be
// skipped (`skip`): nothing falls, and the next knock scores as much again, which adds to the bell's (both: three times).
// A hand that fits nowhere, with no knock to make first, ends the game. The page (topple.js) draws it; tests/topple.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a colour 0–2 a hexagon, -1 empty), ax (each
// standing domino's axis, 0–5, -1 where none stands), hand (three { piece, colour }, null where one has been laid), due
// (a knock to make before the next piece), boost (1 after a knock was skipped, until the next one is made), credit (knocks owed, fractions of one), bell (its hexagon), rung, sets (hands
// dealt), laid, felled, score, over }; a game of a level also has level (0 on) and stars (0–3, the most its score has
// reached).
//
// The levels (topple-levels.js) change the table and what a fall does, by their `rules`: stones and water where nothing
// is laid, a height for every hexagon (a fall never climbs), gilded hexagons (a knock that fells a domino on one scores
// double), colours that are tall (reaching the hexagon past the next as well) and a pearl colour (3) that every colour
// knocks and that knocks every colour. Every function that takes rules takes them last, and without them plays Classic,
// the table as it has always been; a game's own are `rulesOf(game)`.

import { FREE, ROCK, WATER, VOID, PEARL, levelRules, starsAt } from "./topple-levels.js";

export { FREE, ROCK, WATER, PEARL };
export const R = 4, HAND = 3, COLOURS = 3;
/** What `cells` holds for a ball (a domino is its colour, 0 or more; an empty hexagon -1): so everything that asks `>= 0` for a domino is false for a ball. */
export const BALL = -2;
/** The most hexagons a ball can roll on a hit: it takes 2 and a step more for each two steps the fall that hit it had come. */
export const MAXM = 6;
/** The rules a game is played by: its level's, or Classic's. */
export const rulesOf = g => (g && g.level >= 0 ? levelRules(g.level) : FREE);
/** Whether a fall of colour a brings down a domino of colour b: its own colour, or a pearl either way. */
const kin = (a, b) => a === b || a === PEARL || b === PEARL;
/** The version of a game as saved: 5 since the six axes (October 2026); one of version 4 is carried over by migrate. */
export const VERSION = 5;

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
/** The direction (0–5) from hexagon i to its neighbour j, or -1 if they aren't neighbours. */
export const dirTo = (i, j) => NEXT[i].indexOf(j);

// ---------- the twelve ways, the six axes ----------
// A way is 0–11, thirty degrees a step from east turning towards the top of the table: an even way 2d points at the
// neighbour in direction d, an odd way 2d + 1 at the line between the neighbours d and d + 1. An axis is a way and its
// opposite, 0–5: even axes are hexagon axes, odd ones line axes, and a way's axis is way % 6.
export const WAYS = 12, AXES = 6;
export const isLine = w => w % 2 === 1;
/** The hexagons a domino on hexagon i falling the way w comes down on: the one it points at, or the two either side of the line (-1 off the table). */
export const hitBy = (i, w) => (w % 2 === 0 ? [NEXT[i][w / 2]] : [NEXT[i][(w - 1) / 2], NEXT[i][((w + 1) / 2) % 6]]);
// FAR[i][w]: the hexagon past the one(s) hitBy gives, which a tall domino falling the way w reaches as well: two hexagons
// out along a hexagon way, and along a line way the one hexagon at the line's far end (a hexagon and a half out). It is
// the same whichever of the two hexagons either side of the line it is reached through.
const FAR = CELLS.map((_, i) => Array.from({ length: WAYS }, (_, w) => {
  if (w % 2 === 0) { const near = NEXT[i][w / 2]; return near >= 0 ? NEXT[near][w / 2] : -1; }
  const a = (w - 1) / 2, b = ((w + 1) / 2) % 6, first = NEXT[i][a], second = NEXT[i][b];
  return first >= 0 ? NEXT[first][b] : second >= 0 ? NEXT[second][a] : -1;
}));
/** The hexagon a tall domino on i falling the way w reaches beyond the near ones, or -1: none past a stone on the way, off the table or past its edge. */
export function reachBy(i, w, rules = FREE) {
  const far = FAR[i][w];
  return far >= 0 && !hitBy(i, w).some(j => j >= 0 && rules.terrain[j] === ROCK) ? far : -1;
}
/** How far an axis is from a way, in steps of thirty degrees: 0 square on, 3 edge-on. */
export function offBy(axis, w) {
  const k = (((axis - w) % AXES) + AXES) % AXES;
  return Math.min(k, AXES - k);
}
/** Whether a domino standing with this axis is knocked by one falling the way w: at a hexagon, within thirty degrees; at a line, unless edge-on. */
export const knocks = (w, axis) => axis >= 0 && offBy(axis, w) <= (w % 2 ? 2 : 1);
/** The way a domino with this axis falls when knocked by one falling the way w: the sense of its axis nearer w (never asked when edge-on). */
export function senseOf(axis, w) {
  const k = (((axis - w) % WAYS) + WAYS) % WAYS;
  return Math.min(k, WAYS - k) < 3 ? axis : axis + AXES;
}
/**
 * The axis that carries a fall from the neighbour in direction a on to the one in direction b (0–5, as DIRS): the line
 * between the way the fall comes in and the way it goes on. Straight through that's the line itself, a hexagon axis; at
 * a bend of sixty degrees it's thirty degrees off each, a line axis, so the bend is knocked and its line takes the next.
 * Neighbours that touch each other (a turn of 120°, which no fall takes) it faces between, to knock both.
 */
export function through(a, b) {
  const gap = (((b - a) % 6) + 6) % 6;
  if (gap === 1 || gap === 5) return (2 * (gap === 1 ? a : b) + 1) % AXES;
  const inWay = 2 * ((a + 3) % 6), outWay = 2 * b;
  let turn = (((outWay - inWay) % WAYS) + WAYS) % WAYS;
  if (turn > 6) turn -= WAYS;
  return ((((inWay + turn / 2) % WAYS) + WAYS) % WAYS) % AXES;
}

// ---------- the pieces: chains of one to five dominoes, in every way each lies ----------
// A shape is its hexagons as [q, r] from its first (the top row's leftmost), which is the one that's put on a hexagon.
const keyOf = cells => cells.map(c => c.join(",")).join(";");
function normal(cells) {
  const sorted = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]), [q0, r0] = sorted[0];
  return sorted.map(([q, r]) => [q - q0, r - r0]);
}
// the twelve ways a shape can lie: six turns of sixty degrees, and each flipped (in cube coordinates, x = q, z = r)
const turnShape = ([q, r]) => [-r, q + r], flip = ([q, r]) => [r, q];
function lies(cells) {
  const out = new Map();
  let c = cells;
  for (let k = 0; k < 6; k++) {
    c = c.map(turnShape);
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
      const bigger = [...s, c], canon = lies(bigger).map(keyOf).sort()[0];
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
  return shapes.map(s => [(weight * w(s)) / total, lies(s)]);
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
// the pieces a level deals from: those no bigger than its `maxSize` (all of them, in the same order and the same total,
// for Classic and any level that keeps to five)
const DEALT = new Map();
function dealtFrom(max) {
  if (!DEALT.has(max)) {
    const names = NAMES.filter(k => PIECES[k].cells.length <= max);
    DEALT.set(max, { names, total: names.reduce((a, k) => a + PIECES[k].weight, 0) });
  }
  return DEALT.get(max);
}
// a pearl comes in a piece of one or two, whatever piece the draw chose: a line of five wild dominoes would join anything
const SMALL = NAMES.filter(k => PIECES[k].cells.length <= 2);
/** A bridge is a straight line of two or three, which may lie on water; a twin is a pair of two colours. */
const isStraight = cells => new Set(cells.map(c => c[1])).size === 1 || new Set(cells.map(c => c[0])).size === 1 || new Set(cells.map(c => c[0] + c[1])).size === 1;
const BRIDGES = NAMES.filter(k => PIECES[k].cells.length >= 2 && PIECES[k].cells.length <= 3 && isStraight(PIECES[k].cells));
const PAIRS = NAMES.filter(k => PIECES[k].cells.length === 2);
/** The colour of the kth domino of a piece in hand: a twin has one of each of its two, any other piece one colour. */
export const colourAt = (h, k) => (h.colours ? h.colours[k] : h.colour);
/**
 * One piece and its colour, two draws. Where the rules deal pearl, the colour's draw below the share of it makes a pearl
 * (and picks which small piece by how far below it falls), and above it the three colours share the rest as they did.
 * Where they deal bridges or twins, a third draw (only then, so the deals of the other levels stay as they were) turns a
 * piece of a colour into one: a bridge, a straight line of two or three that may be laid on water, or a twin, a pair of
 * two colours (the second of the two others, whichever the draw picks).
 */
function dealOne(s, rules) {
  const { names, total } = dealtFrom(rules.maxSize);
  let r = draw(s.seed, s.n++) * total, piece = names[names.length - 1];
  for (const k of names) if ((r -= PIECES[k].weight) < 0) { piece = k; break; }
  const u = draw(s.seed, s.n++);
  const h = u < rules.pearl ? { piece: SMALL[Math.floor((u / rules.pearl) * SMALL.length)], colour: PEARL } : { piece, colour: Math.floor(((u - rules.pearl) / (1 - rules.pearl)) * COLOURS) };
  if (rules.bridges || rules.twins) {
    const v = draw(s.seed, s.n++);
    if (h.colour !== PEARL && v < rules.bridges) return { piece: BRIDGES[Math.floor((v / rules.bridges) * BRIDGES.length)], colour: h.colour, bridge: true };
    if (h.colour !== PEARL && v < rules.bridges + rules.twins) {
      const w = (v - rules.bridges) / rules.twins;
      return { piece: PAIRS[Math.floor(w * PAIRS.length) % PAIRS.length], colour: h.colour, colours: [h.colour, (h.colour + 1 + (Math.floor(w * 977) % 2)) % COLOURS] };
    }
  }
  return h;
}
function deal(s, rules) { s.sets++; s.hand = Array.from({ length: HAND }, () => dealOne(s, rules)); }

/**
 * The way each domino of a piece faces, from the shape alone: its axis, 0–5, chosen so that the piece falls whole from
 * an end where its shape allows. One beside a single other faces it; one with two beside it carries a fall through
 * them (along a line, or at a bend of sixty degrees facing the line between the two ways); the middle of a fork carries
 * it through its two longest arms, since no fall takes all three; a lone domino takes a hexagon axis from where it
 * stands, so a table of them isn't all one way. `coords` are [q, r] and need not be on the table.
 */
export function axesOfCoords(coords) {
  const index = new Map(coords.map((c, k) => [c.join(","), k]));
  const beside = coords.map(([q, r]) => DIRS.flatMap(([dq, dr], d) => (index.has(`${q + dq},${r + dr}`) ? [d] : [])));
  /** How many dominoes lie out along the arm from domino k towards direction d (a piece is a tree: none come back). */
  const arm = (k, d) => {
    const [q, r] = coords[k], first = index.get(`${q + DIRS[d][0]},${r + DIRS[d][1]}`), seen = new Set([k, first]), queue = [first];
    for (let n = 0; n < queue.length; n++) {
      const [cq, cr] = coords[queue[n]];
      for (const [dq, dr] of DIRS) { const j = index.get(`${cq + dq},${cr + dr}`); if (j != null && !seen.has(j)) { seen.add(j); queue.push(j); } }
    }
    return queue.length;
  };
  return coords.map(([q, r], k) => {
    const dirs = beside[k];
    if (!dirs.length) return 2 * ((((q * 5 + r * 7) % 3) + 3) % 3);
    if (dirs.length === 1) return (2 * dirs[0]) % AXES;
    // the two longest arms, the first in direction order where they tie
    const [a, b] = dirs.length === 2 ? dirs : [...dirs].sort((x, y) => arm(k, y) - arm(k, x) || x - y).slice(0, 2);
    return through(a, b);
  });
}
/** The same for hexagons by number: the axes of the dominoes laid on them. */
export const axesOf = laid => axesOfCoords(laid.map(i => CELLS[i]));

/**
 * Balls to the number the level has, each on an empty hexagon of floor (not the bell's) by a draw: a level without them takes no
 * draw, so the deals of the others stay as they were.
 */
function topUp(s, rules) {
  let have = s.cells.filter(c => c === BALL).length;
  while (have < rules.balls) {
    const empty = s.cells.flatMap((c, i) => (c === -1 && !rules.terrain[i] && i !== s.bell ? [i] : []));
    if (!empty.length) return;
    s.cells[empty[Math.floor(draw(s.seed, s.n++) * empty.length)]] = BALL;
    have++;
  }
}
/** The bell to an empty hexagon of floor at random (none on a full table, and none where the level has no bell, which takes no draw). */
function hang(s, rules) {
  if (!rules.bell) { s.bell = -1; return; }
  const empty = s.cells.flatMap((c, i) => (c === -1 && !rules.terrain[i] ? [i] : []));
  s.bell = empty.length ? empty[Math.floor(draw(s.seed, s.n++) * empty.length)] : -1;
}

// ---------- the pace of the knocks ----------
// A knock after every hand to start with, so a bad hand is soon relieved; then fewer, so the table fills and the chains
// set up grow: the rate (knocks a hand) falls in a straight line from one at the `from`th hand to `end` at the `to`th,
// and stays there. Each finished hand adds the rate to a credit, and a knock falls due when it reaches one. (Tuned by
// playing games out, tests/topple.mjs: a careful player who turns its dominoes into long falls lasts about a hundred
// pieces; with free turning it lasted about 170 on the pace before, which tapered to seven in ten at the fifty-sixth.)
export const PACE = { from: 16, to: 36, end: 0.55 };
export const rate = (sets, pace = PACE) => (sets <= pace.from ? 1 : sets >= pace.to ? pace.end : 1 - ((sets - pace.from) / (pace.to - pace.from)) * (1 - pace.end));
const EPS = 1e-9;
/** The pace a game's knocks come at: its level's own, or the game's (which the tests tune, so it's looked up each time). */
const paceOf = rules => rules.pace || PACE;
/** How many hands until the knock falls due, counting the one in play (0: it's due now). */
export function untilKnock(s) {
  if (s.due) return 0;
  const pace = paceOf(rulesOf(s));
  let credit = s.credit, k = 0;
  do credit += rate(s.sets + k++, pace); while (credit < 1 - EPS && k < 1000);
  return k;
}

/**
 * A new game from a seed: an empty table, the bell on it, three pieces, and a knock after the first hand. With a level
 * (0 on), the game of that level: its rules, and `stars` to count the goal's.
 */
export function newGame(seed, level = -1) {
  const s = { v: VERSION, seed: seed >>> 0, n: 0, cells: new Array(SIZE).fill(-1), ax: new Array(SIZE).fill(-1), hand: [], due: false, boost: 0, credit: 0, bell: -1, rung: 0, sets: 0, laid: 0, felled: 0, score: 0, over: false };
  if (level >= 0) { s.level = level; s.stars = 0; }
  const rules = rulesOf(s);
  deal(s, rules);
  hang(s, rules);
  topUp(s, rules);
  return s;
}
/**
 * A game as saved, carried to this version, or null if it can't be. Version 4 (three axes, a DIRS direction mod 3, and a
 * strength for each knock) becomes version 5: each axis doubled, the same hexagon axis of six, the strength dropped.
 * Its deal goes on as it would have, since a knock still moves the draws on by the one the strength took.
 */
export function migrate(g) {
  if (!g || typeof g !== "object" || !Array.isArray(g.cells) || !Array.isArray(g.ax)) return null;
  if (g.v === VERSION) return g;
  if (g.v !== 4) return null;
  const { force, ...rest } = g;
  return { ...rest, v: VERSION, ax: g.ax.map(a => (a >= 0 ? (2 * a) % AXES : -1)) };
}

// ---------- laying a piece ----------
/**
 * The hexagons a piece would cover with its first on (q, r), or null if it doesn't fit there (off the table, taken, or
 * stone or water). A bridge may also lie on water, where nothing else can.
 */
export function cover(cells, piece, q, r, rules = FREE, bridge = false) {
  const out = [];
  for (const [dq, dr] of PIECES[piece].cells) {
    const i = at(q + dq, r + dr), t = i < 0 ? 0 : rules.terrain[i];
    if (i < 0 || cells[i] !== -1 || (t && !(bridge && t === WATER))) return null;
    out.push(i);
  }
  return out;
}
/** `cover` for a piece in hand (a bridge in hand may lie on water). */
export const coverFor = (cells, h, q, r, rules = FREE) => cover(cells, h.piece, q, r, rules, !!h.bridge);
export const fitsAnywhere = (cells, piece, rules = FREE, bridge = false) => CELLS.some(([q, r]) => cover(cells, piece, q, r, rules, bridge));
const stuck = s => { const rules = rulesOf(s); return !s.hand.some(h => h && fitsAnywhere(s.cells, h.piece, rules, !!h.bridge)); };

// ---------- a knock ----------
/** The two ways the domino on hexagon i can be pushed: either along its axis. Empty where none stands. */
export const pushes = (ax, i) => (ax[i] >= 0 ? [ax[i], ax[i] + AXES] : []);
/**
 * A ball hit rolls on in the direction it was hit, from hexagon `from`, with `m` hexagons of momentum: a flat hexagon costs one,
 * a step down nothing (so it runs on), a step up three (one up and no more, and it must have them); it stops at a stone, at a
 * domino it can't knock (edge-on, or on a higher step, or one already down in this fall) and at a domino it knocks, and it
 * hands what it has left, less one, to a ball it meets; over the edge, into water or into a pit it is lost. Pure.
 * Returns { path (the hexagons it rolls to, the last the one it was lost to, -1 off the table), end (where it rests, or -1 if lost), lost, hit (the domino it knocked, or -1), ball (the ball it hit, or -1), left (momentum left) }.
 */
export function rollOf(cells, ax, from, dir, m, rules = FREE, down = () => false) {
  const path = [];
  let at = from, e = m, hit = -1, ball = -1, lost = false;
  while (e > 0) {
    const b = NEXT[at][dir];
    if (b < 0 || rules.terrain[b] === WATER || rules.terrain[b] === VOID) { path.push(b); lost = true; break; }
    if (rules.terrain[b] === ROCK) break;
    const rise = rules.height[b] - rules.height[at];
    if (cells[b] >= 0) { if (rise <= 0 && !down(b) && knocks(2 * dir, ax[b])) hit = b; break; }
    if (cells[b] === BALL) { ball = b; break; }
    const cost = rise > 0 ? 1 + 2 * rise : rise < 0 ? 0 : 1;
    if (rise > 1 || cost > e) break;
    e -= cost;
    at = b;
    path.push(b);
  }
  return { path, end: lost ? -1 : at, lost, hit, ball, left: e };
}
/**
 * What pushing the domino on hexagon `start` the way `way` (0–11, along its axis) brings down, dominoes and balls: { fell, rolls }.
 * `fell` is the dominoes in the order they fall, each as [hexagon, step (0 the one pushed, 1 those it knocks, …), the hexagon of
 * the one that knocked it (-1 for the first; a ball's last hexagon for one a ball knocked), the way it falls]. `rolls` is the
 * balls a fall reached, each { from, step (the step it is hit at), by, dir (0–5, the way it rolls), path, end, lost, hit (the domino it knocks, or -1), meets (the ball it hits, whose roll follows, or -1), left (momentum it has left on meeting), m (its momentum) }: a ball is hit
 * when a domino falls onto its hexagon (on level ground or below, a tall domino's climbs a step), takes the hit's direction (that
 * from the domino to it), rolls a step to a hexagon (`rollOf`) and so brings down what it comes to a step after it stops:
 * a ball hit at step s that rolls k hexagons knocks a domino at step s + k + 1. Both empty for an empty hexagon, or a way across
 * its axis.
 * By the level's rules: a fall goes level or down (a tall domino's climbs a step), a tall domino reaches the hexagon beyond
 * as well (over water, a gap or a domino of another colour, not past a stone), and a pearl is knocked by, and knocks, any colour.
 * A ball's momentum is MAXM at most, 2 and a step more for each two steps the fall had come (and one more from a tall domino).
 */
export function cascade(cells, ax, start, way, rules = FREE) {
  if (!(cells[start] >= 0) || ax[start] !== way % AXES) return { fell: [], rolls: [] };
  const step = new Map([[start, 0]]), by = new Map([[start, -1]]), falls = new Map([[start, way]]), todo = [start], done = [], gone = new Set(), rolls = [], rolled = new Set(), rests = new Set();
  /** A domino found at a step: kept if it is new, or reached sooner than before (a ball can reach one by a longer way than a fall does). */
  const found = (j, at, from, w) => {
    if (gone.has(j) || (step.has(j) && step.get(j) <= at)) return;
    if (!step.has(j)) todo.push(j);
    step.set(j, at); by.set(j, from); falls.set(j, w);
  };
  /** A ball hit at step `at` by hexagon `from`, going direction `dir` with momentum `m`: rolls, and what it knocks is found. */
  const strike = (b, at, from, dir, m) => {
    rolled.add(b);
    const r = rollOf(cells, ax, b, dir, m, rules, j => gone.has(j) || step.has(j) && step.get(j) < at + 1);
    // two balls never rest on one hexagon: the later stops a hexagon short, and so knocks nothing
    while (!r.lost && r.end !== b && rests.has(r.end)) { r.path.pop(); r.end = r.path.length ? r.path[r.path.length - 1] : b; r.hit = r.ball = -1; }
    if (!r.lost) rests.add(r.end);
    const roll = { from: b, step: at, by: from, dir, path: r.path, end: r.end, lost: r.lost, hit: r.hit, meets: r.ball, left: r.left, m };
    rolls.push(roll);
    const last = r.lost ? (r.path.length > 1 ? r.path[r.path.length - 2] : b) : r.end, over = at + r.path.length;
    if (r.hit >= 0) found(r.hit, over + 1, last, senseOf(ax[r.hit], 2 * dir));
    if (r.ball >= 0 && !rolled.has(r.ball)) strike(r.ball, over + 1, last, dir, Math.max(1, r.left - 1));
  };
  while (todo.length) {
    let k = 0;
    for (let n = 1; n < todo.length; n++) if (step.get(todo[n]) < step.get(todo[k])) k = n;
    const i = todo.splice(k, 1)[0], w = falls.get(i), c = cells[i], tall = rules.tall[c], climb = tall ? 1 : 0, at = step.get(i);
    gone.add(i);
    done.push(i);
    const hits = hitBy(i, w);
    if (tall) { const far = reachBy(i, w, rules); if (far >= 0) hits.push(far); }
    for (const j of hits) {
      if (j < 0) continue;
      if (cells[j] === BALL) {
        if (!rolled.has(j) && rules.height[j] - rules.height[i] <= climb && NEXT[i].includes(j)) strike(j, at + 1, i, NEXT[i].indexOf(j), Math.min(MAXM, 2 + (at >> 1) + (tall ? 1 : 0)));
        continue;
      }
      if (!(cells[j] >= 0) || !kin(c, cells[j]) || step.has(j) || !knocks(w, ax[j]) || rules.height[j] - rules.height[i] > climb) continue;
      found(j, at + 1, i, senseOf(ax[j], w));
    }
  }
  return { fell: done.map(i => [i, step.get(i), by.get(i), falls.get(i)]), rolls };
}
/** The dominoes a push brings down, as `cascade` gives them (balls aside). */
export const chain = (cells, ax, start, way, rules = FREE) => cascade(cells, ax, start, way, rules).fell;
// (hexagon, way) pairs a tall domino can reach past the near hexagon, by the hexagon it stands on
const FAR_WAYS = CELLS.map((_, i) => FAR[i].flatMap((j, w) => (j >= 0 ? [[j, w]] : [])));
/**
 * The dominoes of a colour joined to hexagon i along their sides, all of them, whichever way they face (a pearl joins any
 * colour beside it; a tall domino is joined to those it reaches, and they to it).
 */
export function group(cells, i, rules = FREE) {
  const c = cells[i];
  if (!(c >= 0)) return [];
  const seen = new Set([i]), queue = [i], join = j => { if (!seen.has(j)) { seen.add(j); queue.push(j); } };
  for (let k = 0; k < queue.length; k++) {
    const a = queue[k];
    for (const j of NEXT[a]) if (j >= 0 && cells[j] >= 0 && kin(cells[a], cells[j])) join(j);
    if (rules.plain) continue;
    for (const [j, w] of FAR_WAYS[a]) if (cells[j] >= 0 && kin(cells[a], cells[j]) && (rules.tall[cells[a]] || rules.tall[cells[j]]) && reachBy(a, w, rules) === j) join(j);
  }
  return queue;
}
/** The steps a knock's fall takes (as cascade gives it): from the one pushed, counting it, and a ball's roll counts a step a hexagon. */
export const stepsOf = (fell, rolls = []) => Math.max(0, ...fell.map(f => f[1] + 1), ...rolls.map(r => r.step + r.path.length + 1));
/** Ten times the dominoes (and balls) moved by one knock times the steps they take (a straight run from its end: its length). */
export const worth = (n, steps = n) => 10 * n * steps;
/**
 * What a push on hexagon i the way `way` would come to: { fell (as chain gives it), rolls (the balls it sets going, as cascade gives them),
 * units (dominoes and balls), steps, rings (the bell's hexagon among them, or under a ball's roll), gilded (one of them on a gilded
 * hexagon), boosted (a skipped knock stands, `boost`), gain }. The bell and a skipped
 * knock each add a hundred per cent of the points, so both make three times; the gilding then doubles the lot.
 */
export function knockOn(cells, ax, i, way, bell = -1, rules = FREE, boost = 0) {
  const { fell, rolls } = cascade(cells, ax, i, way, rules), steps = stepsOf(fell, rolls), units = fell.length + rolls.length;
  // a ball's hexagon and the ones it rolls over count as reached, for the bell and for gilding
  const reached = rolls.flatMap(r => [r.from, ...r.path.filter(j => j >= 0)]);
  const rings = bell >= 0 && (fell.some(f => f[0] === bell) || reached.includes(bell)), gilded = fell.some(f => rules.gilded[f[0]]) || reached.some(j => rules.gilded[j]);
  // the bell and a skipped knock each add a hundred per cent (both: three times), and the gilding doubles what they come to
  return { fell, rolls, units, steps, rings, gilded, boosted: !!boost, gain: worth(units, steps) * (1 + (rings ? 1 : 0) + (boost ? 1 : 0)) * (gilded ? 2 : 1) };
}
/**
 * The best push on the dominoes joined to hexagon i: { at, way, fell (how many dominoes and balls move), balls (how many of them are balls), steps, rings, gilded, gain, size (how many
 * are joined) }, the one scoring most (felling most where they score the same). Every domino of them, both ways along its
 * axis: they're at most the table, so this is quick.
 */
export function longest(cells, ax, i, bell = -1, rules = FREE, boost = 0) {
  const all = group(cells, i, rules);
  let best = { at: -1, way: -1, fell: 0, balls: 0, steps: 0, rings: false, gilded: false, gain: 0 };
  for (const j of all) for (const way of pushes(ax, j)) {
    const k = knockOn(cells, ax, j, way, bell, rules, boost);
    if (k.gain > best.gain || (k.gain === best.gain && k.units > best.fell)) best = { at: j, way, fell: k.units, balls: k.rolls.length, steps: k.steps, rings: k.rings, gilded: k.gilded, gain: k.gain };
  }
  return { ...best, size: all.length };
}
/** The dominoes standing, joined by colour: one hexagon of each, how many, and its best push (longest's), most first. */
export function chains(cells, ax, bell = -1, rules = FREE, boost = 0) {
  const seen = new Set(), out = [];
  cells.forEach((c, i) => {
    if (c < 0 || seen.has(i)) return;
    const all = group(cells, i, rules);
    for (const j of all) seen.add(j);
    out.push({ at: i, length: all.length, best: longest(cells, ax, i, bell, rules, boost) });
  });
  return out.sort((a, b) => b.length - a.length);
}

/**
 * Lays the piece in hand slot `slot` with its first domino on (q, r), each domino facing as the piece's shape has it:
 * the game after it, and what happened, for the page to show: laid (its hexagons), dealt (a new hand came), due (a
 * knock is to be made now), over. Pure; throws if a knock is to be made first, or the piece isn't there or doesn't fit.
 */
export function lay(game, slot, q, r) {
  const s = structuredClone(game), h = s.hand[slot], rules = rulesOf(s);
  if (s.over || !h) throw new Error("no piece there");
  if (s.due) throw new Error("knock first");
  const laid = coverFor(s.cells, h, q, r, rules);
  if (!laid) throw new Error("it doesn't fit there");
  const faces = axesOf(laid);
  laid.forEach((i, k) => { s.cells[i] = colourAt(h, k); s.ax[i] = faces[k]; });
  s.laid++;
  s.hand[slot] = null;
  const dealt = s.hand.every(k => !k);
  if (dealt) {
    deal(s, rules);
    s.credit += rate(s.sets - 1, paceOf(rules));
    if (s.credit >= 1 - EPS) { s.credit -= 1; s.due = true; }
  }
  s.over = !s.due && stuck(s);
  return { state: s, laid, dealt, due: s.due, over: s.over };
}
/**
 * Turns the domino on hexagon i to stand along `axis` (0–5): free, as often as you like, with a knock due or not. The
 * game after it. Pure; throws on an empty hexagon, an axis that isn't one, or a game that's over.
 */
export function turn(game, i, axis) {
  if (game.over) throw new Error("the game is over");
  if (!(game.cells[i] >= 0)) throw new Error("no domino there");
  if (!Number.isInteger(axis) || axis < 0 || axis >= AXES) throw new Error("no such axis");
  const s = structuredClone(game);
  s.ax[i] = axis;
  return s;
}
/**
 * Pushes the domino on hexagon i the way `way` (either way along its axis), the knock that's due: the game after it,
 * the fall (as chain gives it), its steps, whether it rang the bell and the gain. Pure; throws with no knock due, no
 * domino there, or a way across its axis.
 */
export function knock(game, i, way) {
  const s = structuredClone(game);
  if (s.over || !s.due) throw new Error("no knock due");
  if (!(s.cells[i] >= 0)) throw new Error("no domino there");
  if (!pushes(s.ax, i).includes(way)) throw new Error("a domino falls only along its axis");
  const rules = rulesOf(s), k = knockOn(s.cells, s.ax, i, way, s.bell, rules, s.boost);
  for (const [j] of k.fell) { s.cells[j] = -1; s.ax[j] = -1; }
  for (const r of k.rolls) s.cells[r.from] = -1;                  // the balls are lifted, and set down where they stop (or lost, if they fell off)
  for (const r of k.rolls) if (r.end >= 0) s.cells[r.end] = BALL;
  s.score += k.gain;
  if (s.level >= 0) s.stars = Math.max(s.stars || 0, starsAt(rules, s.score));
  s.felled += k.fell.length;
  s.due = false;
  s.boost = 0;                                                // a skipped knock's hundred per cent is spent on this one
  // the draw that dealt the next knock's strength (weak, medium or strong, retired with the six axes) is still passed
  // over, so a game saved before then deals on as it would have
  s.n++;
  if (k.rings) { s.rung++; hang(s, rules); }
  topUp(s, rules);
  s.over = stuck(s);
  return { state: s, fell: k.fell, rolls: k.rolls, steps: k.steps, rang: k.rings, gilded: k.gilded, boosted: k.boosted, gain: k.gain, over: s.over };
}
/**
 * Whether the knock that's due may be skipped: one is due, none already skipped (the hundred per cent stands once, so
 * skipping goes with knocking), and a piece in hand would fit without the knock (or skipping would end the game).
 */
export const canSkip = s => !s.over && s.due && !s.boost && !stuck({ ...s, due: false });
/**
 * Skips the knock that's due: the next knock scores a hundred per cent more (the bell's is as much again). The knock isn't
 * owed back, so the table goes on as it stands. Pure; throws where `canSkip` says no.
 */
export function skip(game) {
  if (!canSkip(game)) throw new Error("no knock to skip");
  const s = structuredClone(game);
  s.due = false;
  s.boost = 1;
  return { state: s, over: false };
}
/** Every way to lay a piece in hand: [{ slot, q, r }] (none while a knock is due). For the tests and the tuning players. */
export function moves(s) {
  const out = [], rules = rulesOf(s);
  if (s.due) return out;
  s.hand.forEach((h, slot) => {
    if (!h) return;
    for (const [q, r] of CELLS) if (coverFor(s.cells, h, q, r, rules)) out.push({ slot, q, r });
  });
  return out;
}
export const filled = s => s.cells.filter(c => c >= 0).length;
