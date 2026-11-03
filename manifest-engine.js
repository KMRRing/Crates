// Manifest: a stack of the League's packages drops onto the quay, holds, and is shipped; then you're asked about it.
//
// Each round opens with the tally: the questions to come, posted by kind and not by detail (a ware's count, tier 2's
// count, a spot on tier 2, the stack seen from behind), each with a price. You choose what to watch. Once the stack is
// down you can ship it early: the share of the hold time you didn't use is a bonus on the round. Then the questions
// open in full: answer any, pass any. A right answer pays its price, a wrong one costs a life, a pass costs nothing.
// Prices grow with the rounds and follow your record: what you usually get right pays less.
//
// Every fourth round is a change round: the stack goes aboard, the quay stays empty for a moment, and the stack comes
// back with one package different; in later ones it comes back turned round, or with two packages swapped.
// A run is twelve rounds, or until the lives run out.
//
// A package is one of eight kinds of cargo of a Hanseatic quay (manifest-rules.js: crates, barrels, oak, ingots, chests,
// sacks, gold, birch), each its own shape: the outline, the hue and the lightness tell them apart, so no one rests on colour alone.
// The code says "ware" for a cargo type (what the first version called a colour); a cell holds its number, 1 to 8 (never 3 or 8,
// the two trees), or 9 and 10 for a cell of a log of oak or birch: timber is always a long log, two cells, one piece (`pieces`;
// Korbi, 4 November 2026: "there should be no short logs ever"). Everything asked is asked of pieces, and what one
// piece is of the other's cells is the rules' business; a piece is named by its low cell's key.
// The stacks obey the rules of manifest-rules.js, the rounds are made from a recipe (how big, which cargo, which
// questions), and the levels of manifest-levels.js are recipes in a ladder (docs/manifest.md).
//
// Together (the end of this file): a table of two to six plays the rounds in step, against each other or as one team
// that sees the stack in parts.
import { CARGO, TYPES, CODES, TIMBER, BIRCH, isTimber, isLong, typeOf, longOf, pieceWeight, pieceWorth, CARRIES, axisOf, canPlace, room, loadAbove, validate, columnProblems, weightOf, worthOf, columnOf, deduceColumn, totals, pieces } from "./manifest-rules.js";
import { outlineOf } from "./manifest-shapes.js";

export const LIVES = 3, ROUNDS = 12;
/**
 * The six types as the art draws them, numbered as a cell holds them (the order they come in on the ladder). `hex` is the
 * cargo's own colour (pine, oak, dark bark, pewter, painted navy, burlap); the flat drawing shades it .72 on a left face, .86 on a
 * right one and 1.05 on a top. Outline comes first in telling them apart (manifest-shapes.js), then lightness and hue;
 * tests/manifest.mjs measures both: the silhouettes against each other, the colours for a normal eye and the three dichromacies.
 */
const LOOK = { crate: "#C9A267", barrel: "#7C4E2A", timber: "#5B3A1E", ingot: "#8E9CAB", chest: "#2F3E5C", sack: "#CDBB90", gold: "#C07A08", birch: "#E4DECB" };
export const WARES = CARGO.map(c => ({ id: c.key, name: c.name, hex: LOOK[c.key] }));
export { CARGO, TYPES, CODES, validate, weightOf, worthOf, pieces, typeOf, isLong };
export const VIEWS = { all: "All at once", layers: "Tier by tier", slices: "Slice by slice", pair: "Two tiers, then the rest" };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
/** One of xs, each as likely as its weight. */
function pickBy(r, xs, weight) {
  const ws = xs.map(weight);
  let k = r() * ws.reduce((a, b) => a + b, 0), i = 0;
  while (i < xs.length - 1 && k >= ws[i]) k -= ws[i++];
  return xs[i];
}
const shuffle = (r, xs) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;
const keyOf = (x, y, z) => `${x},${y},${z}`;
const unkey = k => k.split(",").map(Number);

/**
 * A recipe is how a round is made: `x`, `y` the floor, `z` the tiers the quay allows, `types` the cargo in play (numbers),
 * `kinds` the questions it may ask, `want` the kinds it tries to carry (the stack is dealt again, from the same seed's
 * stream, until they can all be asked), `orders` how many are posted, `exposure` the hold in ms once the last piece has
 * landed, `change` null or the kind of change round ("ware", "turned", "swap"), and `views` the views that take turns
 * (none: the rotation Random has always had), and `logs` how many logs of timber the stack has at least (default one wherever
 * the floor can hold a log, `fitFloor`).
 *
 * Random's recipe for round r: the stack grows to 4×4×3, the cargo from three types to eight, the questions widen, and
 * every fourth round is a change round (a ware, then turned, then swapped).
 */
export function levelOf(r) {
  const kinds = ["count", "total", "tier", "spot", "top", "most"];
  if (r >= 3) kinds.push("turned");
  if (r >= 5) kinds.push("which", "weight");
  if (r >= 7) kinds.push("load", "fits");
  if (r >= 9) kinds.push("worth", "column");
  const [x, y, z, types, orders, exposure] = RAMP[Math.min(r, RAMP.length) - 1];
  return {
    x, y, z, types: LADDER.filter(t => !isTimber(t) || holdsLog(x, y)).slice(0, types), kinds, want: [], views: null, exposure, orders,
    change: r % 4 === 0 ? ["ware", "turned", "swap"][(r / 4 - 1) % 3] : null,
  };
}
/** Whether a floor can hold timber (Korbi, 4 November 2026: "no short logs ever"): a log joins two columns, and a table of six shares
 *  the stack in whole columns, a log's two going to one player, so it needs the floor to have seven columns or more. A floor that
 *  cannot gets another cargo type instead: Random's first round has ingots where the third type would be oak. */
export const holdsLog = (x, y) => x * y >= 7;
/** A recipe as the floor allows it: without the trees where the floor cannot hold a log. */
export const fitFloor = L => (L.types.some(isTimber) && !holdsLog(L.x, L.y) ? { ...L, types: L.types.filter(t => !isTimber(t)) } : L);
/** The most logs a stack of this recipe has (a table of six needs six stretches of the floor to share, and a log joins two columns;
 *  and the stack is no forest) and the fewest it is dealt again until it has. */
const logsMost = L => (holdsLog(L.x, L.y) ? Math.min(L.x * L.y - 6, 1 + Math.floor(L.x * L.y * L.z / 10)) : 0);
const logsLeast = L => (L.types.some(isTimber) ? Math.min(L.logs ?? 1, logsMost(L)) : 0);
/** The order the types come into Random: a type is dealt once the ladder reaches it. */
export const LADDER = [1, 2, 3, 4, 5, 6, 8, 7];
/**
 * Random's ramp, a row a round (x, y, z, how many of the ladder's types, orders, the hold in ms), and Today's: one thing
 * grows a round, nothing leaps (3 November 2026: "slow down the increase in difficulty. it really ramps up massively in
 * round 10"; it was a stack of 4×4×3 from round 9 with a fifth type and two more kinds of question at once). `difficulty`
 * measures it; the round after is never more than STEP harder, and round 10 is about the old round 8.
 */
const RAMP = [
  [3, 2, 2, 3, 3, 9000], [4, 2, 2, 3, 3, 8800], [4, 2, 2, 3, 3, 8600], [3, 3, 2, 3, 3, 8400], [3, 3, 2, 4, 3, 8200], [4, 3, 2, 4, 3, 8000],
  [4, 3, 2, 5, 3, 7800], [3, 3, 3, 5, 3, 7600], [3, 3, 3, 6, 3, 7400], [4, 4, 2, 6, 3, 7200], [4, 3, 3, 7, 3, 7200], [4, 3, 3, 8, 3, 7000],
  [4, 3, 3, 8, 4, 6800], [4, 4, 3, 8, 4, 6500], [4, 4, 3, 8, 4, 6300], [4, 4, 3, 8, 4, 6100],
];
export const STEP = 1.2;
/** How hard a recipe is, 1 for the first round's: the stack's size, the cargo in play, the kinds of question, how many are
 *  asked, and how short the hold. */
export const difficulty = L => Math.sqrt(L.x * L.y * L.z / 12) * (1 + 0.1 * (L.types.length - 3)) * (1 + 0.03 * (L.kinds.length - 6)) * (1 + 0.08 * (L.orders - 3)) * Math.sqrt(9000 / L.exposure);

/**
 * The stack for a round: cells[x][y][z] holds a cargo type's number (1 to 8 but not the trees) or a log's code (9, 10), or 0 for
 * empty; columns stand on the quay. Only what the rules allow is put down (canPlace), so a column ends early when nothing may go
 * on, and cargo likes to stand with its own kind, as it is stowed. Timber is dealt as the trees' type numbers and then made into
 * logs (`joinLogs`), so a recipe without timber deals the very stacks it always did.
 */
function makeStack(r, L) {
  const cells = [], trees = L.types.some(isTimber);
  for (let x = 0; x < L.x; x++) {
    cells.push([]);
    for (let y = 0; y < L.y; y++) {
      const h = int(r, 1, L.z), col = [];
      while (col.length < h) {
        const ok = L.types.filter(t => canPlace(col, t, L.z)), below = col[col.length - 1];
        if (!ok.length) break;
        // a tree likes to lie end to end with the same tree, which is what a log is made of
        const near = trees ? alongBefore(cells, x, y, col.length) : 0;
        if (near && isTimber(near) && ok.includes(near) && r() < 0.6) { col.push(near); continue; }
        // heavy goes low, so what can carry more is dealt first and more often (else most columns would end at a chest or a sack)
        col.push(below && ok.includes(below) && r() < 0.4 ? below : pickBy(r, ok, t => 1 + CARRIES[t].filter(u => L.types.includes(u)).length));
      }
      cells[x].push(Array.from({ length: L.z }, (_, z) => col[z] || 0));
    }
  }
  if (trees) joinLogs(r, cells, L);
  return cells;
}
/** The cell dealt before (x, y, z) in the line its tier's timber lies along (cells are dealt by x, then y), or 0. */
const alongBefore = (cells, x, y, z) => (axisOf(z) === "x" ? cells[x - 1]?.[y]?.[z] : cells[x]?.[y - 1]?.[z]) || 0;
/**
 * The logs: pairs of one tree end to end on a tier, in the line its timber lies along (a run is paired from its low end, as `pieces`
 * pairs it), become logs, as many as the recipe allows. The rules are per cell, so both halves stand where they stood. Every other
 * cell of a tree (a leftover of an odd run, or past the most) is another cargo type that stands there, or, where none does, one
 * that does once what stood above it is gone (a column is never left empty: every player of a table has a column); what that leaves
 * lone (a half whose other half went) goes the same way, until no one-cell log is left.
 */
function joinLogs(r, cells, L) {
  const X = cells.length, Y = cells[0].length, pairs = [];
  for (let z = 0; z < L.z; z++) {
    const alongX = axisOf(z) === "x", lines = alongX ? Y : X, length = alongX ? X : Y;
    for (let line = 0; line < lines; line++) {
      let run = [];
      const flush = () => { for (let k = 0; k + 1 < run.length; k += 2) pairs.push([run[k], run[k + 1]]); run = []; };
      for (let i = 0; i < length; i++) {
        const at = alongX ? [i, line, z] : [line, i, z], c = cells[at[0]][at[1]][z];
        if (isTimber(c) && run.length && cells[run[0][0]][run[0][1]][z] === c) run.push(at);
        else { flush(); if (isTimber(c)) run = [at]; }
      }
      flush();
    }
  }
  shuffle(r, pairs).slice(0, logsMost(L)).forEach(([a, b]) => { const c = longOf(cells[a[0]][a[1]][a[2]]); for (const [x, y, z] of [a, b]) cells[x][y][z] = c; });
  const others = L.types.filter(t => !isTimber(t));
  for (let lone = pieces(cells, 0).broken; lone.length; lone = pieces(cells, 0).broken) for (const k of lone) {
    const [x, y, z] = unkey(k), row = cells[x][y];
    if (standsAs(r, row, z, others, L.z)) continue;
    row.fill(0, z + 1);                                                   // what stood above it was in the way: without it, one of the others will do
    if (!standsAs(r, row, z, others, L.z)) row.fill(0, z);
  }
}
/** Give cell z of a column one of these types, the first that leaves the column standing (in an order drawn from r); false if none does. */
function standsAs(r, row, z, types, limit) {
  for (const t of shuffle(r, types)) { row[z] = t; if (!columnProblems(row, limit).length) return true; }
  return false;
}
const each = (cells, fn) => cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c) fn(x, y, z, c); })));
const copy = cells => cells.map(col => col.map(row => [...row]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The cell codes a piece could be exchanged for with the stack still standing: another type of `types` (not a tree: its footprint
 *  would be two cells) for a one-cell piece, the other tree's log for a log (the footprint stays the same: two cells, a line). */
function swaps(cells, piece, types, limit) {
  const c = piece.code, mine = piece.cells;
  const options = piece.long ? [piece.type === TIMBER ? BIRCH : TIMBER].filter(t => types.includes(t)).map(longOf) : types.filter(t => !isTimber(t));
  return options.filter(n => {
    if (n === c) return false;
    for (const [x, y, z] of mine) cells[x][y][z] = n;
    const ok = !validate(cells, limit).length;
    for (const [x, y, z] of mine) cells[x][y][z] = c;
    return ok;
  });
}
/** The stack with this piece's cells given another code. */
function recoded(cells, piece, code) {
  const m = copy(cells);
  for (const [x, y, z] of piece.cells) m[x][y][z] = code;
  return m;
}
/** A log is dealt only if both its halves show (each as much as a piece must to be pointed at, CLEAR_SEEN): a trunk that goes behind
 *  a crate would leave its length, its weight and its count to a guess. Seen all at once, such a log is dealt as another cargo of `types`
 *  that stands there (never a one-cell log: there is none). The whole stack decides, for a team as for one: a player's own part
 *  shows at least as much of each log. Returns whether every log left shows; false when a hidden one has nothing to be instead. */
export function replaceHidden(cells, types) {
  const others = types.filter(t => !isTimber(t));
  for (;;) {
    const px = pixelsOf(cells), hidden = pieces(cells, 0).list.filter(p => p.long && p.cells.some(([x, y, z]) => px.get(keyOf(x, y, z)) < CLEAR_SEEN));
    if (!hidden.length) return true;
    // the cargo that takes its place covers other pixels than the halves did, so what shows is looked at again
    let changed = false;
    for (const p of hidden) for (const t of others) {
      for (const [x, y, z] of p.cells) cells[x][y][z] = t;
      if (p.cells.every(([x, y]) => !columnProblems(cells[x][y]).length)) { changed = true; break; }
      for (const [x, y, z] of p.cells) cells[x][y][z] = p.code;
    }
    if (!changed) return false;
  }
}

// A quarter turn (clockwise, seen from above): cell (x, y) goes to (Y−1−y, x), so a log lying along x ends
// up along y. Turned stacks are drawn with their timber that way round (axisOf in manifest-rules.js).
/** The stack turned by this many quarter turns. */
export function turn(cells, turns) {
  let out = cells;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const Y = out[0].length, X = out.length;
    out = Array.from({ length: Y }, (_, x) => Array.from({ length: X }, (_, y) => out[y][Y - 1 - x].slice()));
  }
  return out;
}
/** Where cell (x, y, z) of an X×Y stack ends up after the turns, as a key. */
export function turnKey(x, y, z, X, Y, turns) {
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) { [x, y] = [Y - 1 - y, x]; [X, Y] = [Y, X]; }
  return keyOf(x, y, z);
}
/** The stack in a mirror: front and back rows change places. No turn can make it, unless the stack is symmetric. */
export const mirror = cells => cells.map(col => [...col].reverse());
/** The key a piece goes by in a stack laid out after `turns` quarter turns, given the key of any one of its cells: its low cell
 *  along that layout's axis (a long log's low cell is not the one the same cell turns into: turnKey maps cells, not pieces). */
export const anchorKey = (cells, turns, k) => pieces(cells, turns).at.get(k)?.key ?? k;

// ---------- isometric geometry and visibility ----------
// The whole-stack view hides inner packages. Which ones show is settled the way the screen settles it: the cubes
// are drawn back to front onto a small raster of ids, and a cube is visible if any of its pixels survive.
const ISO = { w: 0.866, h: 0.5 };
/** A cell's proportions: length, width and height. A cube (the first version's cells were the 1.9-long container shape). */
export const BOX = { L: 1, W: 1, H: 1 };
/** The cell's extent along x and y and its height, and the stack's quarter turns (a cube turns into itself, but a log of
 *  timber lies along the other axis: what the pieces cover of the screen, in visibleSet, depends on it). */
export const boxFor = (turns = 0) => ({ X: BOX.L, Y: BOX.W, H: BOX.H, turns });
/** Screen position of the corner of cell (x, y, z) as the page draws it. */
export const isoPoint = (x, y, z, b = boxFor(0)) => ({ sx: (x * b.X - y * b.Y) * ISO.w, sy: (x * b.X + y * b.Y) * ISO.h - z * b.H });
/** The three faces of a cube as polygons in screen units: top, left (the +y face), right (the +x face). */
export function cubeFaces(x, y, z, b = boxFor(0)) {
  const p = (dx, dy, dz) => { const q = isoPoint(x + dx, y + dy, z + dz, b); return [q.sx, q.sy]; };
  return {
    top: [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)],
    left: [p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1)],
    right: [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)],
  };
}
/** Draw order: far to near. Each cell is { x, y, z, c } and, in a long log, `half` (0 the low cell along the tier's axis, 1 the high one) and
 *  `piece` (the log's key), as the stack lies after `turns` quarter turns. */
export const drawOrder = (cells, turns = 0) => {
  const out = [];
  each(cells, (x, y, z, c) => out.push({ x, y, z, c }));
  if (out.some(o => isLong(o.c))) {
    const at = pieces(cells, turns).at;
    for (const o of out) {
      if (!isLong(o.c)) continue;
      const p = at.get(keyOf(o.x, o.y, o.z));
      if (p.long) { o.half = p.key === keyOf(o.x, o.y, o.z) ? 0 : 1; o.piece = p.key; }
    }
  }
  return out.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);
};
/** The ms from the last package's landing until the stack holds still (its bounce settles). */
export const LANDING = 450;
/**
 * When each package lands, by the round's view: { times: { "x,y,z": ms after the drop begins }, last }. Tier by
 * tier and slice by slice pause between tiers or slices; two tiers, then the rest quickly; all at once, one after
 * another without a pause.
 */
export function dropTimes(cells, view) {
  const times = {};
  let k = 0, last = 0;
  const stagger = 45, pause = 1300;
  for (const cube of drawOrder(cells)) {
    // a long log lands as one, at its low cell's moment (its high cell is drawn after it)
    if (cube.half === 1 && times[cube.piece] != null) { times[keyOf(cube.x, cube.y, cube.z)] = times[cube.piece]; continue; }
    let at;
    if (view === "layers") at = cube.z * pause + k * stagger;
    else if (view === "slices") at = cube.y * pause + k * stagger;
    else if (view === "pair") at = cube.z < 2 ? cube.z * pause + k * stagger : 2 * pause + 600 + k * 25;
    else at = k * 35;
    times[keyOf(cube.x, cube.y, cube.z)] = at;
    last = Math.max(last, at);
    k++;
  }
  return { times, last };
}
/** What a piece covers of the screen, as convex polygons: the outline of its model (a barrel leaves the corners of its cell
 *  empty, and a corner of the cell that shows through is not the piece), or the cell's three faces for a cell that holds no cargo. */
function coverOf(cube, b, boxes = false) {
  if (boxes || !(cube.c >= 1 && cube.c <= CODES)) return Object.values(cubeFaces(cube.x, cube.y, cube.z, b));
  const mid = isoPoint(cube.x + 0.5, cube.y + 0.5, cube.z + 0.5, b);
  return [outlineOf(cube.c, isTimber(cube.c) && axisOf(cube.z, b.turns || 0) === "y", cube.half ?? null).map(([sx, sy]) => [mid.sx + sx * b.X, mid.sy + sy * b.H])];
}
/** The set of "x,y,z" keys of pieces you can see in the isometric view: the cells are drawn back to front, each as the outline
 *  of its piece (convex, so filled a row of pixels at a time: a pixel is in it when its centre lies from the left crossing of
 *  the row up to the right one), and a piece is seen if enough of it survives (MIN_SEEN pixels: a hair of it is not a piece).
 *  A long log is one piece: its two halves' pixels are added, and it is seen by both its cells (a log with half of it hidden shows
 *  the other half to be there, the same tree on the same tier). */
export function visibleSet(cells, b = boxFor(0)) {
  const out = new Set();
  for (const [k, n] of seenPixels(cells, b)) if (n >= MIN_SEEN) out.add(k);
  return out;
}
/** The pieces a question may point at: enough of each shows to be found and read (CLEAR_SEEN, a sixth of a whole piece in
 *  the picture, not the hair of it visibleSet counts). `boxes`: the stack drawn as plain boxes (under tarpaulin, as the
 *  turned question draws it), so the cargo's own shapes don't count. */
export function clearSet(cells, b = boxFor(0), boxes = false) {
  const out = new Set();
  for (const [k, n] of seenPixels(cells, b, boxes)) if (n >= CLEAR_SEEN) out.add(k);
  return out;
}
/** How many raster pixels of each cell survive in the view, by key: a long log's halves apart (seenPixels has them added). */
export const pixelsOf = (cells, b = boxFor(0)) => seenPixels(cells, b, false, true);
function seenPixels(cells, b = boxFor(0), boxes = false, apart = false) {
  const order = drawOrder(cells, b.turns || 0), out = new Map();
  if (!order.length) return out;
  const polys = order.map(cube => ({ key: keyOf(cube.x, cube.y, cube.z), faces: coverOf(cube, b, boxes) }));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polys) for (const f of p.faces) for (const [qx, qy] of f) { minX = Math.min(minX, qx); maxX = Math.max(maxX, qx); minY = Math.min(minY, qy); maxY = Math.max(maxY, qy); }
  const res = 14;                                                     // pixels per cube unit: plenty to catch a sliver
  const W = Math.ceil((maxX - minX) * res) + 1, H = Math.ceil((maxY - minY) * res) + 1;
  const buf = new Int32Array(W * H);
  polys.forEach((p, id) => {
    for (const face of p.faces) {
      const poly = face.map(q => [(q[0] - minX) * res, (q[1] - minY) * res]), n = poly.length;
      let top = Infinity, bottom = -Infinity;
      for (const [, qy] of poly) { top = Math.min(top, qy); bottom = Math.max(bottom, qy); }
      for (let py = Math.max(0, Math.floor(top)); py <= Math.min(H - 1, Math.ceil(bottom)); py++) {
        const cy = py + 0.5;
        let left = Infinity, right = -Infinity;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((yi > cy) !== (yj > cy)) { const x = (xj - xi) * (cy - yi) / (yj - yi) + xi; if (x < left) left = x; if (x > right) right = x; }
        }
        if (left > right) continue;
        for (let px = Math.max(0, Math.ceil(left - 0.5)); px < right - 0.5 && px < W; px++) buf[py * W + px] = id + 1;
      }
    }
  });
  const count = new Int32Array(polys.length + 1);
  for (let i = 0; i < buf.length; i++) count[buf[i]]++;
  polys.forEach((p, id) => out.set(p.key, count[id + 1]));
  if (!boxes && !apart) {                                              // a long log is seen as one: the sum of its halves, for both
    order.forEach((cube, id) => {
      if (cube.half !== 0) return;
      const mate = order.findIndex(o => o.piece === cube.piece && o.half === 1), n = count[id + 1] + count[mate + 1];
      out.set(polys[id].key, n);
      out.set(polys[mate].key, n);
    });
  }
  return out;
}
const MIN_SEEN = 6;                                                   // of 14 pixels to the cell's edge: about 1.5% of a piece's outline
const CLEAR_SEEN = 90;                                                // a whole box is about 510 pixels of the raster

// ---------- orders ----------
// Each kind: its base price (before the round's growth and your record), and what the tally says about it.
export const KINDS = {
  count: { name: "Count", base: 60 },
  total: { name: "Total", base: 50 },
  tier: { name: "Tier", base: 50 },
  spot: { name: "Spot", base: 80 },
  top: { name: "Top", base: 60 },
  most: { name: "Most", base: 50 },
  turned: { name: "Turned", base: 140 },
  which: { name: "Which stack", base: 150 },
  weight: { name: "Weight", base: 70 },
  worth: { name: "Worth", base: 70 },
  load: { name: "Load", base: 90 },
  fits: { name: "Room", base: 110 },
  column: { name: "Column", base: 130 },
  change: { name: "Change", base: 150 },
  changeTurned: { name: "Change, turned", base: 220 },
  swap: { name: "Swap", base: 220 },
};
/**
 * Number options around the truth: five, evenly spaced, never negative, the truth at a place drawn evenly from those
 * that fit. Scattered at random round the truth, the truth would sit in the middle more often than not, and picking
 * the middle option would pay without looking.
 */
function numberOptions(r, truth, steps = null) {
  const step = steps ? pick(r, steps) : truth >= 8 ? int(r, 1, 2) : 1, places = [0, 1, 2, 3, 4].filter(k => truth - k * step >= 0);
  const at = pick(r, places);
  return [0, 1, 2, 3, 4].map(k => truth + (k - at) * step);
}
/** The gaps between options for a sum of weights or worths: wider the bigger it is, so that adding up is the way to it. */
const stepsFor = n => (n < 8 ? [1] : n < 20 ? [1, 2] : n < 60 ? [2, 3, 5] : [5, 10]);
/** A how-many question in the tense its view allows (what you could see, what lies on the bottom two tiers, what there was). */
const howMany = (what, view, all = "", note = "") => (view === "all" ? `How many ${what} could you see${all}${note}?` : view === "pair" ? `How many ${what} are there on the bottom two tiers${note}?` : `How many ${what} were there${all}${note}?`);
const turnWords = t => (t === 2 ? "from behind" : "from the side");

/** What you saw in a view: every package when they arrive tier by tier or slice by slice; the visible ones all at once; the bottom two tiers otherwise. */
function seenIn(cells, view, visible) {
  const seen = new Set();
  each(cells, (x, y, z) => { const k = keyOf(x, y, z); if (view === "all" ? visible.has(k) : view === "pair" ? z < 2 : true) seen.add(k); });
  return seen;
}

/** The key to a question about weights, worths or room, printed on the question itself (Korbi, 3 November 2026: "it doesn't
 *  tell you what weighs what"): the round's cargo and, for each, what the question's numbers are made of (`w` weight in cwt,
 *  `worth` in marks, `bears` the most that may rest on it). The weights are the same in every round; what is printed is the
 *  truth the answer is worked from. */
const legendOf = (L, cols, trees = false) => ({ types: L.types.filter(t => trees || !isTimber(t)), cols });
/** A question's key as rows to print: [{ id, name, long, w, worth, bears }] with only the columns it asks for. A tree's row is its log,
 *  the whole piece: two cells' weight and worth (a key to a column holds no tree: a column with a log in it is never asked about). */
export const legendRows = legend => legend.types.map(id => ({
  id, name: isTimber(id) ? `${CARGO[id - 1].name} log` : CARGO[id - 1].name, long: isTimber(id),
  ...Object.fromEntries(legend.cols.map(k => [k, k === "w" ? pieceWeight(id) : k === "worth" ? pieceWorth(id) : CARGO[id - 1][k]])),
}));
/** One order of a kind, or null if the stack can't make a fair one: { type, posted, question }. */
function makeOrder(r, type, cells, L, view, visible) {
  const seen = seenIn(cells, view, visible), seenCells = [...seen].map(unkey);
  // what is asked is asked of pieces: a log is one, named by its low cell (a stack with none has a piece in every cell)
  const P = pieces(cells, 0), pcs = seenCells.filter(([x, y, z]) => P.at.get(keyOf(x, y, z)).key === keyOf(x, y, z));
  const typeAt = ([x, y, z]) => typeOf(cells[x][y][z]), treeAt = ([x, y, z]) => isTimber(cells[x][y][z]);
  const note = ps => (ps.some(treeAt) ? " (a log is one piece)" : "");
  const used = [...new Set(seenCells.map(typeAt))].sort((a, b) => a - b);
  const where = view === "all" ? " you could see" : view === "pair" ? " on the bottom two tiers" : "";
  const X = cells.length, Y = cells[0].length;
  if (used.length < 2 && ["spot", "top", "turned"].includes(type)) return null;     // one cargo seen: nothing to choose between
  switch (type) {
    case "count": {
      const c = pick(r, used), mine = pcs.filter(p => typeAt(p) === c), n = mine.length;
      return { type, posted: `How many of one kind of cargo${where}`, question: { as: "number", text: howMany(CARGO[c - 1].plural, view), ware: c, answer: n, options: numberOptions(r, n) } };
    }
    case "total": {
      const n = pcs.length;
      return { type, posted: `How many pieces${where} in all`, question: { as: "number", text: howMany("pieces", view, " in all", note(pcs)), answer: n, options: numberOptions(r, n) } };
    }
    case "tier": {
      const tiers = [...new Set(seenCells.map(([, , z]) => z))].filter(z => view !== "pair" || z < 2);
      const z = pick(r, tiers), here = P.list.filter(p => p.cells[0][2] === z), n = here.length;
      return { type, posted: `How many on tier ${z + 1}`, question: { as: "number", text: `How many pieces on tier ${z + 1}${here.some(p => p.long) ? " (a log is one piece)" : ""}?`, tier: z, answer: n, options: numberOptions(r, n) } };
    }
    case "weight": case "worth": {
      const sums = totals(cells, seen), n = type === "weight" ? sums.w : sums.v;
      const what = view === "all" ? "the pieces you could see" : view === "pair" ? "the bottom two tiers" : "the whole stack";
      const text = type === "weight" ? `How much did ${what} weigh, in cwt (hundredweight)?` : `What ${what === "the whole stack" ? "was" : "were"} ${what} worth, in marks?`;
      return { type, posted: type === "weight" ? `The weight of ${what}` : `The worth of ${what}`, question: { as: "number", text, legend: legendOf(L, type === "weight" ? ["w"] : ["worth"], true), answer: n, options: numberOptions(r, n, stepsFor(n)) } };
    }
    case "load": {
      // a piece with something on it: the tier-by-tier views show every piece, so the whole column has been seen. A log in
      // the weight (or marked) is left out: it rests half on each of two columns, and the key gives a piece one weight
      const spots = seenCells.filter(([x, y, z]) => cells[x][y][z + 1] && !cells[x][y].slice(z).some(isTimber));
      if (!spots.length) return null;
      const [x, y, z] = pick(r, spots), n = loadAbove(columnOf(cells, x, y), z);
      return { type, posted: "The weight on a piece", question: { as: "number", text: "How much weight rests on the marked piece, in cwt?", legend: legendOf(L, ["w"]), cell: { x, y, z }, answer: n, options: numberOptions(r, n, stepsFor(n)) } };
    }
    case "fits": {
      // a column, a cargo to put on it, and how many the rules let you stack there (support, load and the quay's tiers)
      const combos = [];
      cells.forEach((col, x) => col.forEach((row, y) => {
        const column = row.filter(Boolean);
        if (column.length && !column.some(isTimber) && column.every((_, z) => seen.has(keyOf(x, y, z)))) for (const t of L.types) if (!isTimber(t)) combos.push([x, y, column, t, room(column, t, L.z)]);
      }));
      if (!combos.length) return null;
      const some = combos.filter(c => c[4] > 0), [x, y, column, t, n] = pick(r, some.length && r() < 0.75 ? some : combos);
      return { type, posted: "Room on a column", question: { as: "number", text: `The quay stacks ${L.z} tiers high. How many more ${CARGO[t - 1].plural} could go on the marked column, one on another?`, legend: legendOf(L, ["w", "bears"]), cell: { x, y, z: column.length - 1 }, put: t, answer: n, options: numberOptions(r, n) } };
    }
    case "column": {
      // the top of a column is in sight and what is under it is not, but the rules say what it is (deduceColumn)
      if (view !== "all") return null;
      const spots = [];
      cells.forEach((col, x) => col.forEach((row, y) => {
        const h = row.filter(Boolean).length;
        if (h < 2 || row.some(isTimber) || !visible.has(keyOf(x, y, h - 1))) return;
        const shown = row.slice(0, h).map((t, z) => (visible.has(keyOf(x, y, z)) ? t : null));
        if (shown.includes(null) && deduceColumn(shown, L.types.filter(t => !isTimber(t)))) spots.push([x, y, h - 1]);
      }));
      if (!spots.length) return null;
      const [x, y, z] = pick(r, spots), n = columnOf(cells, x, y).reduce((s, t) => s + weightOf(t), 0);
      return { type, posted: "The weight of a column", question: { as: "number", text: "The marked piece tops its column. How much does the whole column weigh, in cwt?", legend: legendOf(L, ["w"]), cell: { x, y, z }, answer: n, options: numberOptions(r, n, stepsFor(n)) } };
    }
    case "spot": {
      const z = pick(r, [...new Set(seenCells.map(([, , zz]) => zz))]);
      const [x, y] = pick(r, pcs.filter(([, , zz]) => zz === z));
      return { type, posted: `A cargo at a spot on tier ${z + 1}`, question: { as: "ware", text: `Which cargo is the marked piece on tier ${z + 1}?`, cell: { x, y, z }, answer: typeAt([x, y, z]), options: used } };
    }
    case "top": {
      const tops = [];
      cells.forEach((col, x) => col.forEach((row, y) => { const h = row.filter(Boolean).length; if (h && visible.has(keyOf(x, y, h - 1))) tops.push([x, y, h - 1]); }));
      const [x, y, z] = pick(r, tops);
      return { type, posted: "The top of a column", question: { as: "ware", text: "Which cargo is on top of the marked column?", cell: { x, y, z }, answer: typeAt([x, y, z]), options: used } };
    }
    case "most": {
      const tally = used.map(c => [c, pcs.filter(p => typeAt(p) === c).length]).sort((a, b) => b[1] - a[1]);
      if (tally.length < 2 || tally[0][1] === tally[1][1]) return null;
      return { type, posted: `The most common cargo${where}`, question: { as: "ware", text: view === "all" ? "Which cargo could you see most of?" : view === "pair" ? "Which cargo is most common on the bottom two tiers?" : "Which cargo is most common?", answer: tally[0][0], options: used } };
    }
    case "turned": {
      // a package you saw, marked on the stack turned round and drawn in grey: which ware is it? The grey stack is plain boxes,
      // so what shows of the marked one is counted on boxes, and enough of it must (3 November 2026: "I can't see the marked
      // piece in this one, very unclear")
      const turns = int(r, 1, 3), turned = turn(cells, turns), shows = clearSet(turned, boxFor(turns), true);
      const spots = pcs.filter(([x, y, z]) => shows.has(turnKey(x, y, z, X, Y, turns)));
      if (!spots.length) return null;
      const [x, y, z] = pick(r, spots);
      return { type, posted: `A spot, the stack seen ${turnWords(turns)}`, question: { as: "ware", text: `The stack seen ${turnWords(turns)}: which cargo is the marked piece?`, turns, cell: { x, y, z }, at: turnKey(x, y, z, X, Y, turns), answer: typeAt([x, y, z]), options: used } };
    }
    case "which": {
      // four stacks turned the same way: yours, its mirror image, and yours with a package or two changed
      const turns = int(r, 1, 3), b = boxFor(turns), turned = turn(cells, turns), shows = clearSet(turned, b);
      const both = pcs.filter(([x, y, z]) => shows.has(turnKey(x, y, z, X, Y, turns)));
      if (!both.length) return null;
      // a decoy is a stack that could stand (one that breaks a stacking rule would give itself away), and what it changed shows
      // in it (a smaller piece in the place of a larger one could hide itself, and the decoy would look like yours)
      const showing = (d, spots) => { const v = clearSet(d, b); return spots.every(([x, y, z]) => v.has(turnKey(x, y, z, X, Y, turns))) ? d : null; };
      const changeWare = () => {
        const [x, y, z] = pick(r, both), piece = P.at.get(keyOf(x, y, z)), other = swaps(cells, piece, used, L.z);
        if (!other.length) return null;
        return showing(turn(recoded(cells, piece, pick(r, other)), turns), [[x, y, z]]);
      };
      // two pieces of a size (both one cell, or both logs) trade their cargo
      const swapTwo = () => {
        const pairs = [], at = ([x, y, z]) => P.at.get(keyOf(x, y, z));
        both.forEach((a, i) => both.slice(i + 1).forEach(bb => { if (at(a).long === at(bb).long && at(a).code !== at(bb).code) pairs.push([a, bb]); }));
        if (!pairs.length) return null;
        const [a, bb] = pick(r, pairs), m = recoded(recoded(cells, at(a), at(bb).code), at(bb), at(a).code);
        return validate(m, L.z).length ? null : showing(turn(m, turns), [a, bb]);
      };
      const mirrored = mirror(cells), mirrorIsTurn = [0, 1, 2, 3].some(t => same(turn(cells, t), mirrored));
      const decoys = [];
      const offer = s => { if (s && !same(s, turned) && !decoys.some(d => same(d, s))) decoys.push(s); };
      if (!mirrorIsTurn) offer(turn(mirrored, turns));
      for (let tries = 0; decoys.length < 3 && tries < 30; tries++) offer(tries % 2 ? swapTwo() : changeWare());
      if (decoys.length < 3) return null;
      const stacks = shuffle(r, [turned, ...decoys]);
      return { type, posted: "The stack you saw, turned", question: { as: "stack", text: `Which of these is the stack you saw, seen ${turnWords(turns)}?`, turns, stacks, answer: stacks.findIndex(s => s === turned) } };
    }
  }
  return null;
}

/** The views each kind can be asked after: what is asked about a piece nobody saw (the turning ones never with the two-tier
 *  view; load and room need every piece of a column, so they follow the views that show them all; a column's hidden
 *  pieces exist only where the view hides some). */
const ALL_VIEWS = ["layers", "all", "slices", "pair"], WHOLE = ["layers", "slices"];
export const KIND_VIEWS = { count: ALL_VIEWS, total: ALL_VIEWS, most: ALL_VIEWS, weight: ALL_VIEWS, worth: ALL_VIEWS, tier: ["layers", "slices", "pair"], spot: ["layers", "slices", "pair"],
  top: ["all"], turned: ["layers", "slices", "all"], which: ["layers", "slices", "all"], load: WHOLE, fits: WHOLE, column: ["all"] };
/** The recipe's kinds that its view can carry. */
const kindsFor = (view, kinds) => kinds.filter(k => KIND_VIEWS[k]?.includes(view));
/** The view of round r: a recipe's own take turns, else the rotation Random has always had; a change round is all at once. */
const viewFor = (r, L) => (L.change ? "all" : L.views ? L.views[(r - 1) % L.views.length] : ["layers", "all", "slices", "pair"][(r - 1 - Math.floor((r - 1) / 4)) % 4]);

/**
 * A change round: the stack comes back with one package a different ware; turned a quarter round as well; or with two
 * packages of different wares swapped, so the counts of each ware can't give it away. The changed packages are
 * ones you could see (seen), and can see again when the whole stack comes back (visible, or the turned stack's own).
 */
function makeChange(r, cells, L, seen, visible, variant) {
  // a piece is named by its low cell: a long log is one spot, and its other cell is not
  const P = pieces(cells, 0), at = ([x, y, z]) => P.at.get(keyOf(x, y, z));
  const clear0 = clearSet(cells), spots = [...seen].filter(k => clear0.has(k) && P.at.get(k).key === k).map(unkey), X = cells.length, Y = cells[0].length;
  // what comes back is a stack that could stand: a piece is changed for a type the stack still bears (a log for the other
  // tree's, in the same two cells), two are swapped only where both stand in the other's place and are of a size
  const alts = s => swaps(cells, at(s), L.types, L.z);
  const pairs = [], traded = (a, b) => recoded(recoded(cells, at(a), at(b).code), at(b), at(a).code);
  if (variant === "swap") {
    spots.forEach((a, i) => spots.slice(i + 1).forEach(b => {
      if (at(a).long !== at(b).long || at(a).code === at(b).code) return;
      if (!validate(traded(a, b), L.z).length) pairs.push([a, b]);
    }));
  }
  // a piece looks different from what it replaces (its outline covers other pixels), so what comes back is checked too: both
  // pieces of a swap, or the changed one, must show in the stack that returns
  if (variant === "swap") {
    for (const [a, b] of shuffle(r, pairs)) {
      const back = traded(a, b), shows = clearSet(back);
      if (shows.has(keyOf(...a)) && shows.has(keyOf(...b)))
        return { type: "swap", posted: "Two pieces swap places", question: { as: "pair", text: "Two pieces swapped places. Tap both.", turns: 0, back, answer: [keyOf(...a), keyOf(...b)].sort() } };
    }
  }
  const attempt = t => {
    const shows = t ? clearSet(turn(cells, t), boxFor(t)) : clear0;
    for (const spot of shuffle(r, spots.filter(([a, b, c]) => shows.has(turnKey(a, b, c, X, Y, t))))) {
      for (const alt of shuffle(r, alts(spot))) {
        const changed = recoded(cells, at(spot), alt);
        if (clearSet(t ? turn(changed, t) : changed, boxFor(t)).has(turnKey(...spot, X, Y, t))) return { spot, changed, turns: t };
      }
    }
    return null;
  };
  const turns0 = variant === "turned" ? pick(r, [1, 3]) : 0;
  const hit = attempt(turns0) || (turns0 ? attempt(0) : null);                 // nothing seen both ways: plain change
  if (!hit) return null;
  const { spot: [x, y, z], changed, turns } = hit;
  // the answer is the piece as the picture lays it (a long log by its low cell there: the page takes a tap on either half for it)
  const back = turns ? turn(changed, turns) : changed;
  return turns
    ? { type: "changeTurned", posted: "Spot the change, the stack turned", question: { as: "cell", text: `The stack's come back seen ${turnWords(turns)}, and one piece is now another cargo. Tap it.`, turns, back, answer: anchorKey(back, turns, turnKey(x, y, z, X, Y, turns)), cell: { x, y, z } } }
    : { type: "change", posted: "Spot the change", question: { as: "cell", text: "One piece is now another cargo. Tap it.", turns: 0, back, answer: keyOf(x, y, z), cell: { x, y, z } } };
}

/**
 * The order questions are asked in: those whose pictures and answers give least away first. A turned spot's grey
 * stack shows the shape, so it comes after the counts; the four stacks of which-stack show nearly everything, so it
 * comes last. Questions come one at a time, so nothing later is seen before what comes earlier is answered or passed.
 */
export const ASK_ORDER = ["count", "total", "weight", "worth", "tier", "most", "load", "fits", "spot", "top", "column", "turned", "which"];
/** How many stacks a round may deal, from the same stream, to carry the questions its recipe wants. */
const TRIES = 80;

/**
 * Round r of a run: { r, level, cells, view, visible, seen, parts, orders }. Orders are fixed by the seed; prices are
 * not. Played together by a team of `team` (two to six), the stack is the same, shared out in parts (splitStack), one
 * to each player; and all at once, where each part is drawn alone, the team saw what any of them could see of their
 * own part (seen): more than the whole stack shows, as nobody else's packages stand in front of theirs, so the
 * orders are made of that. (The whole stack's own are in it too: one it shows by a sliver shows at least as much with
 * fewer in front, though the raster that finds it may miss a sliver drawn to another frame.)
 */
export function makeRound(seed, r, team = 0, recipe = null) {
  const L = fitFloor(recipe || levelOf(r)), rand = rng(mix(seed, r)), least = logsLeast(L);
  const view = viewFor(r, L);
  const wanted = L.change ? [] : L.want.filter(k => KIND_VIEWS[k]?.includes(view));
  // the stack is dealt again (from the same stream, so on every device the same) until it can carry every wanted question
  // and the full number of orders, or the tries run out and the best of them stands
  let best = null;
  for (let attempt = 0, tries = wanted.length || L.change || least ? TRIES : 6; attempt < tries; attempt++) {
    const cells = makeStack(rand, L);
    const shown = view === "all" && least ? replaceHidden(cells, L.types) : true;
    // a recipe with timber wants its logs in the stack that is asked about (a deal with fewer, or one with a log that hides, is a miss, dealt again)
    const short = !shown || pieces(cells, 0).list.filter(p => p.long).length < least ? 1 : 0;
    if (short && attempt < tries - 1) continue;                      // too few logs to ask about: dealt again before the costly part
    const visible = visibleSet(cells), parts = team > 1 ? splitStack(cells, team) : null;
    const seen = parts && view === "all" ? new Set([...visible, ...parts.flatMap(part => [...visibleSet(partCells(cells, part))])]) : visible;
    const orders = [];
    if (L.change) {
      const o = makeChange(rand, cells, L, seen, visible, L.change);
      if (o) orders.push(o);
    } else {
      const kinds = kindsFor(view, L.kinds), first = wanted.filter(k => kinds.includes(k));
      for (const type of [...first, ...shuffle(rand, kinds.filter(k => !first.includes(k)))]) {
        if (orders.length >= L.orders) break;
        const o = makeOrder(rand, type, cells, L, view, seen);
        if (o) orders.push(o);
      }
      orders.sort((a, b) => ASK_ORDER.indexOf(a.type) - ASK_ORDER.indexOf(b.type));
    }
    const got = wanted.filter(k => orders.some(o => o.type === k)).length;
    const R = { r, level: L, cells, view, visible, seen, parts, orders };
    if (!best || short < best.short || (short === best.short && (got > best.got || (got === best.got && orders.length > best.R.orders.length)))) best = { short, got, R };
    if (!short && got === wanted.length && orders.length >= (L.change ? 1 : L.orders)) break;
  }
  return best.R;
}

// ---------- a stack in parts, for a team ----------
/**
 * The stack shared out among n players, so that every package is seen by exactly one of them: each gets whole
 * columns of the floor (a part stands on the floor as it was stacked, nothing hanging in the air, and looks the same in
 * every view), one stretch of the floor each. The columns are taken slice by slice, each slice back the way the last
 * came, so a stretch stays in one piece, and the stretches are cut where the parts come out most even: the fewest
 * between the largest and the smallest part (never more than the tallest column), then the evenest spread. (A stack with long
 * logs is shared in groups of columns, below: a stretch of the floor only where no log reaches past it.)
 * Returns n lists of package keys, in the stretches' order.
 */
export function splitStack(cells, n) {
  const X = cells.length, Y = cells[0].length, snake = [], index = new Map();
  for (let y = 0; y < Y; y++) for (let k = 0; k < X; k++) {
    const x = y % 2 ? X - 1 - k : k, keys = [];
    cells[x][y].forEach((c, z) => { if (c) keys.push(keyOf(x, y, z)); });
    index.set(`${x},${y}`, snake.length);
    snake.push(keys);
  }
  // A long log stands on two columns, and a player gets whole columns standing on the floor: the columns it joins go to one player
  // (turning the stack turns neither the columns nor the log), and the stack is shared out in these groups, each first at its
  // earliest column's place in the snake. A stack with no long log has a group to a column.
  const home = snake.map((_, i) => i), root = i => { while (home[i] !== i) i = home[i] = home[home[i]]; return i; };
  for (const p of pieces(cells, 0).list) if (p.long) {
    const [a, b] = p.cells.map(([x, y]) => root(index.get(`${x},${y}`)));
    if (a !== b) home[Math.max(a, b)] = Math.min(a, b);
  }
  const groups = new Map();
  snake.forEach((keys, i) => { const g = root(i); groups.set(g, [...(groups.get(g) || []), ...keys]); });
  const cols = [...groups.values()];
  const parts = Math.max(1, Math.min(n, cols.length)), sizes = cols.map(c => c.length);
  let best = null;
  // every way of cutting the snake into `parts` stretches (at most 3,003, for sixteen columns and six players)
  const cut = (start, left, ends) => {
    if (left === 1) {
      const all = [...ends, cols.length], sums = all.map((end, i) => sizes.slice(i ? all[i - 1] : 0, end).reduce((a, b) => a + b, 0));
      const score = [Math.max(...sums) - Math.min(...sums), sums.reduce((a, b) => a + b * b, 0)];
      if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { score, ends: all };
      return;
    }
    for (let end = start + 1; end <= cols.length - (left - 1); end++) cut(end, left - 1, [...ends, end]);
  };
  cut(0, parts, []);
  return best.ends.map((end, i) => cols.slice(i ? best.ends[i - 1] : 0, end).flat());
}
/** The stack with only these packages in it (a player's part), the rest of the floor empty. */
export function partCells(cells, keys) {
  const mine = new Set(keys);
  return cells.map((col, x) => col.map((row, y) => row.map((c, z) => (mine.has(keyOf(x, y, z)) ? c : 0))));
}

// ---------- prices ----------
/** How much prices have grown by round r. */
export const growth = r => 1 + 0.12 * (r - 1);
/** What your record does to a kind's price: a hit rate of a half leaves it, usually right pays less, usually wrong more. */
export function skillFactor(rec) {
  const h = ((rec?.h || 0) + 1) / ((rec?.t || 0) + 2);
  return Math.min(1.4, Math.max(0.6, 1.45 - 0.9 * h));
}
/** An order's price in round r, given your record for its kind; to the nearest 5. */
export const priceOf = (type, r, rec) => Math.max(5, Math.round(KINDS[type].base * growth(r) * skillFactor(rec) / 5) * 5);
/** Your record after an answer: recent answers count most. */
export const recordAfter = (rec, right) => ({ t: (rec?.t || 0) * 0.95 + 1, h: (rec?.h || 0) * 0.95 + (right ? 1 : 0) });
/** Shipping early: the round's answers pay up to half as much again, by the share of the hold time left. */
export const shipBonus = left => 1 + 0.5 * Math.max(0, Math.min(1, left));

// ---------- together: a table of two to six, the rounds in step ----------
// Everyone at the table plays the same round at the same moment: the room keeps the round and when its tally
// opened, on the database's clock, and every phone runs the tally, the drop and the hold from that. Against: each
// answers their own questions; once everyone at the table has finished, the round is settled for all of them (points,
// lives, the standings), and the next opens once everyone has pressed Next. Together: one run for the table, its lives
// and score; each player is shown only their part of the stack (splitStack), and the questions are the team's, the
// first reply to each counting. Prices are plain in both: a record moves its player's own prices, not a table's.
//
// The room's branch, kept by manifest.js through together.js:
//   { v: 2, app, created, people, players: { uid: { name, slot, pid, online } }, next (the mode a new game takes),
//     game: { n, mode: "against" | "team", seed, created, ready: { s<slot>: t } (Ready before round 1, Next after each),
//       round: { r, at, seats (together: the slots the parts are dealt to), runs: { s<slot>: { q<i>: { g } or { p: 1 },
//         ship, done } } (against), answers: { q<i>: { g, by } or { p: 1, by } }, ship: { s<slot>: t }, shipped
//         (together), settled },
//       totals: { s<slot>: { pts, lives, right, wrong, passed, last, out } } (against), team: { pts, lives, right, wrong,
//       passed, last } (together), over } }
// Times are the database's (ms). Keys are s<slot> and q<i>, never bare numbers, which the database reads back as a list
// with holes. Every change below is made inside the room's transaction, on its freshest copy.

export const BOOK = 6000;            // the tally shows this long before the stack drops
export const LEAD = 800;             // from a round's opening to its tally, so every phone has it by then
export const GRACE = 30000;          // the others done this long (and the questions open as long), the table may go on without the last
export const MODES = { against: "Against", team: "Together" };
const MOST = 6;                      // the most at a table (a party's)

const sk = slot => `s${slot}`;
const qk = i => `q${i}`;
const sameAnswer = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fresh = () => ({ pts: 0, lives: LIVES, right: 0, wrong: 0, passed: 0 });
/** The seated players' slots, in order. */
const seatedSlots = g => Object.values(g?.players || {}).filter(p => p && p.slot != null).map(p => p.slot).sort((a, b) => a - b);
const withMe = (present, slot) => [...new Set([...(present || []), slot])].sort((a, b) => a - b);

/** A new table, in the lobby of its first game. */
export function freshTable(players, { app = 2, people = 2, mode = "against", seed = 1, now = Date.now() } = {}) {
  const g = { v: 2, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, next: MODES[mode] ? mode : "against" };
  newGame(g, { mode: g.next, seed, now });
  return g;
}
export const isTable = g => g?.v === 2 && !!g.game && Number.isInteger(g.game.n) && !!MODES[g.game.mode];
/** A new game at the table, in its lobby until everyone at the table says Ready (`by` already has). */
export function newGame(g, { mode, seed, now = Date.now(), by = null }) {
  g.game = { n: (g.game?.n || 0) + 1, mode: MODES[mode] ? mode : "against", seed, created: now, ...(by != null ? { ready: { [sk(by)]: now } } : {}) };
  return true;
}

/** Where a game stands: "lobby" (before round 1), "play" (a round under way), "results" (one settled), "over". */
export function stageOf(game) {
  if (!game) return null;
  if (game.over) return "over";
  if (!game.round) return "lobby";
  return game.round.settled ? "results" : "play";
}
const made = new Map();
/** The game's round in play (or last settled), as makeRound makes it (a team's in its parts); kept, as it's asked for
 *  on every redraw. Not to be changed by whoever asks. */
export function roundOf(game) {
  const team = game.mode === "team" ? (game.round.seats?.length || 1) : 0, key = `${game.seed}/${game.round.r}/${team}`;
  let R = made.get(key);
  if (!R) {
    R = makeRound(game.seed, game.round.r, team);
    made.set(key, R);
    if (made.size > 24) made.delete(made.keys().next().value);
  }
  return R;
}
/** How a round opened at `at` goes: { at, drop (the stack starts to fall), landed, holdEnd, times (each package's
 *  landing, after drop) }, the same on every phone. */
export function timeline(R, at) {
  const { times, last } = dropTimes(R.cells, R.view), drop = at + BOOK, landed = drop + last + LANDING;
  return { at, drop, landed, holdEnd: landed + R.level.exposure, times };
}
/**
 * The part of a team's stack a player sees, as package keys: null for the whole stack (they're the only one with a
 * part), [] for none (they weren't at the table when the round opened). The parts go round the table a step each
 * round, so nobody keeps the same stretch of the floor.
 */
export function partFor(R, seats, slot) {
  const j = (seats || []).indexOf(slot);
  if (j < 0) return [];
  return R.parts ? R.parts[(j + R.r) % R.parts.length] : null;
}

/** A player's lives: against, their own; together, the team's. */
export const livesOf = (game, slot) => (game.mode === "team" ? game.team?.lives ?? LIVES : game.totals?.[sk(slot)]?.lives ?? LIVES);
/** Whether a player plays the rounds still: against, while they have lives (one out of lives watches); together, always. */
export const playing = (game, slot) => game.mode === "team" || livesOf(game, slot) > 0;
/** The replies a round has: against, a player's own; together, the team's: { q<i>: { g } or { p: 1 } }. */
export function repliesOf(game, slot) {
  const round = game?.round;
  return (round && (game.mode === "team" ? round.answers : round.runs?.[sk(slot)])) || {};
}
/** The question in hand: the first with no reply, or -1. Questions come one at a time, as alone. */
export function firstOpen(replies, n) {
  for (let i = 0; i < n; i++) if (!replies?.[qk(i)]) return i;
  return -1;
}

/**
 * Who the table waits for to go on: { stage, waiting: [slots], without: the one left once everyone else is done, at:
 * from when the table may go on without them }. In a round (against): those at the table still playing who haven't
 * finished it, the last one's grace counted from when the others were done and the questions open; before round 1 and
 * after each, those who haven't said Ready or Next (those still playing, unless everyone here is out: then the
 * watchers move it on). `present`: the slots at the table now (the game open, online); nobody else holds it up.
 */
export function waitingFor(g, present, now) {
  const game = g?.game, stage = stageOf(game), out = { stage, waiting: [], without: null, at: null };
  if (!game || stage === "over" || (stage === "play" && game.mode === "team")) return out;
  let who, mark, from = 0;
  if (stage === "play") {
    who = present.filter(s => playing(game, s));
    mark = s => game.round.runs?.[sk(s)]?.done;
    from = timeline(roundOf(game), game.round.at).holdEnd;
  } else {
    who = stage === "lobby" ? present : present.filter(s => playing(game, s));
    if (!who.length) who = present;
    mark = s => game.ready?.[sk(s)];
  }
  out.waiting = who.filter(s => !mark(s));
  const done = who.filter(s => mark(s));
  if (out.waiting.length === 1 && done.length) { out.without = out.waiting[0]; out.at = Math.max(from, ...done.map(mark)) + GRACE; }
  return out;
}
/** The next round opens: its tally a moment from now, for everyone at once; together, its stack in parts for
 *  those at the table. */
export function openRound(g, present, now) {
  const game = g.game, r = (game.round?.r || 0) + 1;
  if (game.over || r > ROUNDS) return false;
  game.round = { r, at: now + LEAD, ...(game.mode === "team" ? { seats: [...new Set(present)].sort((a, b) => a - b) } : {}) };
  delete game.ready;
  return true;
}
/** Ready (before round 1) or Next (after a round): once everyone at the table has said it, the next round opens (the
 *  first needs two at the table). */
export function sayReady(g, slot, present, now) {
  const game = g?.game, stage = stageOf(game);
  if (slot == null || (stage !== "lobby" && stage !== "results") || game.ready?.[sk(slot)]) return false;
  game.ready = { ...(game.ready || {}), [sk(slot)]: now };
  const here = withMe(present, slot);
  if (!waitingFor(g, here, now).waiting.length && (stage !== "lobby" || here.length >= 2)) openRound(g, here, now);
  return true;
}
/** Going on without the one the table waits for, once their time is up (waitingFor): the round settled with what they
 *  answered (the rest passed), or the next round opened without their Next. */
export function goOn(g, slot, present, now) {
  const here = withMe(present, slot), w = waitingFor(g, here, now);
  if (w.without == null || w.without === slot || now < w.at) return false;
  return w.stage === "play" ? settle(g, now) : openRound(g, here, now);
}

/**
 * A reply to question i of round r: an answer ({ g: what was given }) or a pass ({ p: 1 }). Against, a player's own,
 * in order: once all of theirs are in they're done, and the round settles if nobody at the table is still playing it.
 * Together, the team's: the first reply to the question in hand counts, and a stale one (answered meanwhile, or the
 * round moved on) changes nothing; the last one settles the round. False when nothing changed.
 */
export function reply(g, slot, r, i, rep, { present = [], now = Date.now() } = {}) {
  const game = g?.game, round = game?.round;
  if (stageOf(game) !== "play" || round.r !== r || slot == null) return false;
  const n = roundOf(game).orders.length, stored = rep?.p ? { p: 1 } : rep?.g != null ? { g: rep.g } : null;
  if (!stored || !(i >= 0 && i < n)) return false;
  if (game.mode === "team") {
    round.answers ??= {};
    if (firstOpen(round.answers, n) !== i) return false;
    round.answers[qk(i)] = { ...stored, by: slot };
    if (firstOpen(round.answers, n) < 0) settle(g, now);
    return true;
  }
  if (!playing(game, slot)) return false;
  const run = (round.runs ??= {})[sk(slot)] ??= {};
  if (firstOpen(run, n) !== i) return false;                       // in already (sent twice), or out of order
  run[qk(i)] = stored;
  if (firstOpen(run, n) < 0) {
    run.done = now;
    settleIfDue(g, withMe(present, slot), now);
  }
  return true;
}
/**
 * Ship it, at `now`. Against, it ends only your own hold, for your own bonus. Together, your part goes, and once
 * everyone at the table with a part has shipped, the team's hold ends then, and the team's answers pay by what was left.
 */
export function ship(g, slot, r, { present = [], now = Date.now() } = {}) {
  const game = g?.game, round = game?.round;
  if (stageOf(game) !== "play" || round.r !== r || slot == null) return false;
  if (game.mode === "team") {
    if (!(round.seats || []).includes(slot) || round.ship?.[sk(slot)] || round.shipped) return false;
    round.ship = { ...(round.ship || {}), [sk(slot)]: now };
    const here = withMe(present, slot);
    if (round.seats.filter(s => here.includes(s)).every(s => round.ship[sk(s)])) round.shipped = now;
    return true;
  }
  if (!playing(game, slot)) return false;
  const run = (round.runs ??= {})[sk(slot)] ??= {};
  if (run.ship) return false;
  run.ship = now;
  return true;
}
/** What shipping at `shipAt` pays a round's answers (as alone): up to half as much again, by the share of the hold left. */
export function bonusAt(R, at, shipAt) {
  return shipAt ? Math.round(shipBonus((timeline(R, at).holdEnd - shipAt) / R.level.exposure) * 100) / 100 : 1;
}
/** The bonus this round's answers are paid at: against, a player's own; together, the team's. */
export const bonusOf = (game, slot) => bonusAt(roundOf(game), game.round.at, game.mode === "team" ? game.round.shipped : game.round.runs?.[sk(slot)]?.ship);

/**
 * The round judged, once, for everyone. Against, each player still playing is paid for their right answers (at their
 * own bonus), loses a life for each wrong one, and has passed what they didn't answer; together, the team. The game is
 * over after the twelfth round, or once nobody (together, the team) has a life left.
 */
export function settle(g, now) {
  const game = g?.game, round = game?.round;
  if (stageOf(game) !== "play") return false;
  const R = roundOf(game), prices = R.orders.map(o => priceOf(o.type, round.r));
  const judge = (t, replies, bonus) => {
    let got = 0;
    R.orders.forEach((o, i) => {
      const a = replies?.[qk(i)];
      if (!a || a.p) t.passed++;
      else if (sameAnswer(a.g, o.question.answer)) { got += Math.round(prices[i] * bonus); t.right++; }
      else { t.lives = Math.max(0, t.lives - 1); t.wrong++; }
    });
    t.pts += got;
    t.last = got;
  };
  if (game.mode === "team") {
    judge(game.team ??= fresh(), round.answers, bonusOf(game));
    if (game.team.lives <= 0 || round.r >= ROUNDS) game.over = now;
  } else {
    const slots = seatedSlots(g);
    game.totals ??= {};
    for (const s of slots) {
      const t = game.totals[sk(s)] ??= fresh();
      if (t.lives <= 0) { delete t.last; continue; }                 // out before this round: watching
      judge(t, round.runs?.[sk(s)], bonusOf(game, s));
      if (t.lives <= 0) t.out = round.r;
    }
    if (round.r >= ROUNDS || slots.every(s => game.totals[sk(s)].lives <= 0)) game.over = now;
  }
  round.settled = now;
  return true;
}
/** Settles the round (against) once nobody at the table is still playing it: everyone here who plays has finished, or
 *  nobody here plays and its hold is over. */
export function settleIfDue(g, present, now) {
  const game = g?.game;
  if (stageOf(game) !== "play" || game.mode !== "against" || waitingFor(g, present, now).waiting.length) return false;
  if (!present.some(s => playing(game, s)) && now < timeline(roundOf(game), game.round.at).holdEnd) return false;
  return settle(g, now);
}

/** The mode a new game is dealt in (the menu's together part); before round 1, this game's too (and everyone says
 *  Ready again). */
export function setNext(g, mode) {
  if (!MODES[mode] || !g?.game) return false;
  g.next = mode;
  if (stageOf(g.game) === "lobby" && g.game.mode !== mode) { g.game.mode = mode; delete g.game.ready; }
  return true;
}
/** Play again, or a new game from the menu: dealt in the next mode by whoever asks first while game n is the one at the
 *  table; one who asks a moment later says Ready to it instead. */
export function again(g, slot, n, { seed, present = [], now = Date.now() } = {}) {
  const game = g?.game;
  if (!game || slot == null) return false;
  if (game.n === n) return newGame(g, { mode: g.next || game.mode, seed, now, by: slot });
  return game.n === n + 1 && stageOf(game) === "lobby" ? sayReady(g, slot, present, now) : false;
}

/** Everyone seated and their game so far (against), by seat: [{ uid, slot, name, pts, last (this round's points; null
 *  for one already out), lives, out (the round they ran out in), right, wrong, passed }]. */
export function scoresOf(g) {
  const game = g?.game;
  return Object.entries(g?.players || {}).filter(([, p]) => p && p.slot != null).sort((a, b) => a[1].slot - b[1].slot).map(([uid, p]) => {
    const t = game?.totals?.[sk(p.slot)];
    return { uid, slot: p.slot, name: p.name || "Player", pts: t?.pts || 0, last: t?.last ?? null, lives: t ? t.lives : LIVES, out: t?.out ?? null,
      right: t?.right || 0, wrong: t?.wrong || 0, passed: t?.passed || 0 };
  });
}
/** How each of the round's questions went for a player (against) or the team: "right", "wrong" or "passed". */
export function verdicts(game, slot) {
  const R = roundOf(game), replies = repliesOf(game, slot);
  return R.orders.map((o, i) => { const a = replies[qk(i)]; return !a || a.p ? "passed" : sameAnswer(a.g, o.question.answer) ? "right" : "wrong"; });
}
/** The game as a player saw it, once it's over, for the pair's record: { match, score, won, coop }. Against, won is
 *  coming first alone; together, the team's score, won if it came through the twelve rounds. Else null. */
export function resultOf(g, slot) {
  const game = g?.game;
  if (!game?.over || slot == null) return null;
  const match = `${game.seed}-${game.created}`;
  if (game.mode === "team") return { match, score: game.team?.pts || 0, won: (game.team?.lives || 0) > 0, coop: true };
  const rows = scoresOf(g), mine = rows.find(x => x.slot === slot);
  if (!mine) return null;
  const top = Math.max(...rows.map(x => x.pts));
  return { match, score: mine.pts, won: mine.pts === top && rows.filter(x => x.pts === top).length === 1, coop: false };
}
