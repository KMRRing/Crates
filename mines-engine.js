// Mines: Minesweeper on fields proven to need no guess. The rules of a field (digging, flags, chording, the end: a
// mine dug ends the field, lost), how a field is dealt (generated, then cleared by the solver in mines-solve.js from its marked start, and kept
// only if it needs no guess and its reasoning fits the level asked), its grade, its 3BV, the daily, hints, and the
// split that gives each player of a team part of the numbers. A field is whatever says who touches whom: a flat
// tiling (mines-grid.js) or a shape on a sphere (mines-solid.js), and nothing here asks which. Pure, no page:
// tests/mines.mjs runs it in Node.
import { SHAPES as FLAT, neighbours, shareOf } from "./mines-grid.js";
import { SOLIDS, solidBoard, solidShares } from "./mines-solid.js";
import { createSolver, solve } from "./mines-solve.js";

/** Every shape a field takes: the two flat tilings, and the three solids on a sphere. */
export const SHAPES = { ...FLAT, ...SOLIDS };
export const TILINGS = Object.keys(FLAT);
export const BODIES = Object.keys(SOLIDS);
export const isSolid = shape => !!SOLIDS[shape];
export const SIZES = { small: { label: "Small" }, medium: { label: "Medium" }, large: { label: "Large" } };
export const LEVELS = { easy: { label: "Easy" }, medium: { label: "Medium" }, hard: { label: "Hard" } };
export const HINT = 20;       // seconds a hint costs (a mine costs the field: it ends it, 4 November 2026)

// Each shape's fields. Flat ones upright (a phone's screen): [columns, rows]. Squares are Minesweeper's own three; hexes
// are sized to about the same number of cells. A solid's are [k, k]: cells along the cube's edge, the cuts along a
// rhombicuboctahedron's edge, g of the football's GP(g,g); chosen for about the same number of cells as the flat ones
// (the cube 96, 294 and 486; the rhombicuboctahedron 104, 234 and 416; the football 122, 272 and 482).
export const FIELDS = {
  square: { small: [9, 9], medium: [16, 16], large: [16, 30] },
  hex: { small: [8, 10], medium: [14, 18], large: [16, 30] },
  cube: { small: [4, 4], medium: [7, 7], large: [9, 9] },
  rhombi: { small: [2, 2], medium: [3, 3], large: [4, 4] },
  football: { small: [2, 2], medium: [3, 3], large: [4, 4] },
};
// Mines per field, by level. Squares keep the classic counts where they meet them (Beginner's 10, Intermediate's 40,
// Expert's 99). Hexes take more mines for the same difficulty (six neighbours give each number less to say). A solid has
// no edge, and the edge is where a flat field sticks: its corners and sides hide the fifty-fifties. So a solid takes
// more mines than its flat tiling for the same reasoning, measured the same way (tests/mines.mjs keeps them honest).
export const MINES = {
  square: { small: [10, 13, 16], medium: [32, 40, 50], large: [60, 75, 99] },
  hex: { small: [12, 15, 18], medium: [38, 48, 55], large: [72, 90, 104] },
  cube: { small: [18, 22, 26], medium: [54, 60, 72], large: [88, 96, 116] },
  rhombi: { small: [14, 19, 24], medium: [34, 42, 50], large: [62, 76, 94] },
  football: { small: [20, 24, 28], medium: [52, 60, 66], large: [92, 106, 118] },
};
// What each level asks of the reasoning, as the solver measures it (mines-solve.js). `needs` is the hardest technique a
// field requires, [least, most], in the solver's levels (1 one number, 2 two numbers, 3 a group of numbers, 4 the mines
// left): Easy needs only 1, Medium 2 at most, Hard at least 3, and on a Large Hard field a real deduction of that kind
// (`deep`, a round of level 3 or 4) at least once. `hard` counts the rounds that needed more than one number, so two
// fields of one level still differ. Measured on samples of each field (tests/mines.mjs keeps them honest). On hexes two
// numbers almost never prove more than one does, so a hex field is made harder by its mines and the count. A solid
// asks what its flat tiling asks of a field its size.
const NEEDS = { easy: [1, 1], medium: [1, 2], hard: [3, 4] };
const band = (level, hard, extra = {}) => ({ needs: NEEDS[level], hard, ...extra });
const SQUARE_BANDS = {
  small: { easy: band("easy", [0, 0]), medium: band("medium", [1, 4]), hard: band("hard", [3, 99]) },
  medium: { easy: band("easy", [0, 0]), medium: band("medium", [1, 5]), hard: band("hard", [5, 99]) },
  large: { easy: band("easy", [0, 0]), medium: band("medium", [2, 7]), hard: band("hard", [10, 99], { deep: 2 }) },
};
const HEX_BANDS = {
  small: { easy: band("easy", [0, 0]), medium: band("medium", [0, 1]), hard: band("hard", [1, 99]) },
  medium: { easy: band("easy", [0, 0]), medium: band("medium", [0, 1]), hard: band("hard", [1, 99]) },
  large: { easy: band("easy", [0, 0]), medium: band("medium", [0, 2]), hard: band("hard", [1, 99], { deep: 2 }) },
};
export const TARGET = { square: SQUARE_BANDS, hex: HEX_BANDS, cube: SQUARE_BANDS, rhombi: SQUARE_BANDS, football: HEX_BANDS };
const LEVEL_AT = { easy: 0, medium: 1, hard: 2 };
const TRIES = 400;            // fields tried for one deal before the closest to the level is taken (always one that needs no guess)

/** A field's settings, checked: { shape, size, level } with anything unknown replaced by its default. */
export const settingsOf = (o = {}) => ({
  shape: SHAPES[o.shape] ? o.shape : "square",
  size: SIZES[o.size] ? o.size : "small",
  level: LEVELS[o.level] ? o.level : "medium",
});
/** The field's name in words: "Medium hexes, hard", "Small cube, easy". */
export const describe = o => { const s = settingsOf(o); return `${SIZES[s.size].label} ${SHAPES[s.shape].label.toLowerCase()}, ${LEVELS[s.level].label.toLowerCase()}`; };
/** How many columns and rows (or k, a solid's), cells and mines a field of these settings has. */
export function dims(o) {
  const s = settingsOf(o), [w, h] = FIELDS[s.shape][s.size];
  return { ...s, w, h, n: graphOf(s.shape, w, h).n, count: MINES[s.shape][s.size][LEVEL_AT[s.level]] };
}

const graphs = new Map();
/** Who touches whom on a field of this shape: { n, nb }, worked out once a shape and size (every deal shares it). */
export function graphOf(shape, w, h) {
  if (isSolid(shape)) return solidBoard(shape, w);
  const key = `${shape}:${w}:${h}`;
  let g = graphs.get(key);
  if (!g) graphs.set(key, g = { n: w * h, nb: neighbours(shape, w, h) });
  return g;
}

// ---------- randomness that is the same on every device ----------
/** A seeded generator of numbers in [0, 1) (mulberry32: integer arithmetic only, so every device draws the same). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A 32-bit hash of anything printable, to seed a field by its seed and settings together. */
export function hash(...parts) {
  let h = 2166136261;
  for (const ch of parts.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- a field ----------
/** A field from its mines: { shape, w, h, n, nb, mine, nums, count, start }. */
export function fieldOf(shape, w, h, mine, start) {
  const { n, nb } = graphOf(shape, w, h), nums = new Int8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) { count += mine[i]; let m = 0; for (const j of nb[i]) m += mine[j]; nums[i] = m; }
  return { shape, w, h, n, nb, mine, nums, count, start };
}
/** Mines laid at random, none on the start or round it, so the start is empty and opens a patch. */
function lay(d, nb, R) {
  // a start is a cell with a whole neighbourhood: all of a flat shape's, the commonest number on a solid
  const full = isSolid(d.shape) ? graphOf(d.shape, d.w, d.h).most : SHAPES[d.shape].most, inner = [];
  for (let i = 0; i < d.n; i++) if (nb[i].length === full) inner.push(i);
  const start = inner[Math.floor(R() * inner.length)];
  const banned = new Set([start, ...nb[start]]), free = [];
  for (let i = 0; i < d.n; i++) if (!banned.has(i)) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const mine = new Uint8Array(d.n);
  for (let k = 0; k < d.count; k++) mine[free[k]] = 1;
  return { mine, start };
}
/** How a solve compares with what the level asks: 0 inside the target, else how far outside (the technique level weighs most). */
function miss(grade, target) {
  const [lo, hi] = target.hard, [nlo, nhi] = target.needs;
  const needs = grade.top < nlo ? (nlo - grade.top) * 100 : grade.top > nhi ? (grade.top - nhi) * 100 : 0;
  const deep = target.deep && grade.deep < target.deep ? (target.deep - grade.deep) * 50 : 0;
  return needs + deep + (grade.hard < lo ? lo - grade.hard : grade.hard > hi ? grade.hard - hi : 0);
}
/**
 * A solve's grade: { top (the hardest level used, which is what the field needs: the solver always takes the cheapest
 * proof there is), hard (rounds needing more than one number), deep (rounds needing a group of numbers or the count),
 * rounds }.
 */
export const gradeOf = r => ({ top: r.max, hard: r.rounds[2] + r.rounds[3] + r.rounds[4], deep: r.rounds[3] + r.rounds[4], rounds: r.rounds });

/** Whether a team of two needs both of its players: neither one's share of the numbers clears the field alone. */
export function needsBoth(f) {
  for (const k of [0, 1]) if (solve(f, { sees: i => readerOf(f, i, 2) === k }).solved) return false;
  return true;
}

/**
 * Deals a field: { seed, shape, size, level, team } -> the field, its grade, its 3BV. The same seed and settings give
 * the same field on every device. It's the first field that the solver clears from its start without a guess and
 * whose reasoning meets the level; after TRIES fields, the closest of those it cleared. team: also neither player of
 * a team of two can clear it with their share of the numbers alone.
 */
export function deal({ seed, shape, size, level, team = false }) {
  const d = dims({ shape, size, level }), target = TARGET[d.shape][d.size][d.level];
  const R = rng(hash(seed, d.shape, d.size, d.level, team ? "team" : "solo"));
  const { nb } = graphOf(d.shape, d.w, d.h);
  let best = null;
  for (let tries = 0; ; tries++) {
    // a field that never comes (a team's split refusing everything at the densest) gives up a mine at a time:
    // a deal always ends, with a field that needs no guess
    const count = Math.max(1, d.count - Math.floor(tries / (TRIES * 2)));
    const { mine, start } = lay({ ...d, count }, nb, R);
    const f = fieldOf(d.shape, d.w, d.h, mine, start);
    const r = solve(f);
    if (!r.solved || (team && !needsBoth(f))) { if (best && tries >= TRIES) return finish(best); continue; }
    const g = gradeOf(r), m = miss(g, target);
    if (!best || m < best.m) best = { f, g, m, tries };
    if (m === 0 || tries >= TRIES) return finish(best);
  }
  function finish({ f, g }) { return { ...f, seed, size: d.size, level: d.level, team, grade: g, bbbv: bbbv(f) }; }
}

/**
 * The field's 3BV (Bechtel's Board Benchmark Value): the fewest clicks that clear it without flags or chords, each
 * empty patch one (it opens its whole border), each number no empty cell touches one more. Speed players measure a
 * field's work by it, and a time by 3BV a second.
 */
export function bbbv(f) {
  const seen = new Uint8Array(f.n);
  let clicks = 0;
  for (let i = 0; i < f.n; i++) {
    if (f.mine[i] || f.nums[i] !== 0 || seen[i]) continue;
    clicks++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      for (const j of f.nb[c]) {
        if (seen[j] || f.mine[j]) continue;
        seen[j] = 1;
        if (f.nums[j] === 0) stack.push(j);
      }
    }
  }
  for (let i = 0; i < f.n; i++) if (!f.mine[i] && !seen[i]) clicks++;
  return clicks;
}

// ---------- today's field ----------
// One field a day, the same for everyone (the suite's day, UTC), growing through the week as a newspaper's puzzles do:
// Monday's small and easy, the weekend's large; the twists take their turn.
export const WEEK = [
  { shape: "hex", size: "large", level: "hard" },        // Sunday
  { shape: "square", size: "small", level: "easy" },     // Monday
  { shape: "hex", size: "small", level: "medium" },
  { shape: "square", size: "medium", level: "medium" },
  { shape: "cube", size: "small", level: "medium" },
  { shape: "square", size: "medium", level: "hard" },
  { shape: "square", size: "large", level: "hard" },     // Saturday: Expert
];
/** The day's field settings, from the day as YYYYMMDD. */
export function daily(day) {
  const y = Math.floor(day / 10000), m = Math.floor(day / 100) % 100, d = day % 100;
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const weekdayOf = day => WEEKDAYS[new Date(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100)).getUTCDay()];

// ---------- a field in play ----------
// A run keeps every cell as one character of a string, so it saves and travels as it is (the database keeps a string
// whole, where a list could come back with holes): "." hidden, "o" open, "0"-"5" a flag (the seat that placed it, 0
// alone), "x" the mine that was dug: the end of the field, lost (it stays shown).
export const HIDDEN = ".", OPEN = "o", STRUCK = "x";
export const isFlag = ch => ch >= "0" && ch <= "5";

/** A fresh run on a field: nothing open, the clock at nought. */
export const newRun = f => ({ cells: HIDDEN.repeat(f.n), hints: 0, ms: 0, done: false, won: false, lost: false });

const put = (cells, i, ch) => cells.slice(0, i) + ch + cells.slice(i + 1);
/** Every safe cell is open. */
export function cleared(f, cells) {
  for (let i = 0; i < f.n; i++) if (!f.mine[i] && cells[i] !== OPEN) return false;
  return true;
}
/** Mines not yet flagged or struck: what the counter shows (less than nought if there are too many flags). */
export function minesLeft(f, cells) {
  let m = f.count;
  for (const ch of cells) if (ch === STRUCK || isFlag(ch)) m--;
  return m;
}
/** Safe cells still to open. */
export function safeLeft(f, cells) {
  let k = 0;
  for (let i = 0; i < f.n; i++) if (!f.mine[i] && cells[i] !== OPEN) k++;
  return k;
}
export const started = (f, cells) => cells[f.start] === OPEN;

/**
 * Digs cell i. Returns { ok, opened: [cells], struck, why } and changes the run: an empty cell opens its neighbours,
 * and theirs; a mine is the end of the field, lost (4 November 2026: no time penalty, no going on); the last safe
 * cell open is the end, won. Refused (ok false, why): an open or flagged cell, or anywhere but the start before it's open.
 */
export function dig(f, run, i) {
  if (run.done || i < 0 || i >= f.n) return { ok: false, why: "done" };
  const ch = run.cells[i];
  if (ch !== HIDDEN) return { ok: false, why: isFlag(ch) ? "flag" : "open" };
  if (!started(f, run.cells) && i !== f.start) return { ok: false, why: "start" };
  if (f.mine[i]) {
    run.cells = put(run.cells, i, STRUCK);
    run.done = true;
    run.lost = true;
    return { ok: true, opened: [], struck: i };
  }
  const opened = flood(f, run, i);
  if (cleared(f, run.cells)) { run.done = true; run.won = true; }
  return { ok: true, opened, struck: -1 };
}
/** Opens a safe cell and the patch an empty one opens, in the order a wave would reach them; returns them. */
function flood(f, run, i) {
  const out = [], q = [i], cells = run.cells.split("");
  cells[i] = OPEN;
  for (let k = 0; k < q.length; k++) {
    const c = q[k];
    out.push(c);
    if (f.nums[c] !== 0) continue;
    for (const j of f.nb[c]) if (cells[j] === HIDDEN) { cells[j] = OPEN; q.push(j); }
  }
  run.cells = cells.join("");
  return out;
}
/** Flags or unflags hidden cell i for seat `by`; false if it's open or struck. */
export function flag(f, run, i, by = 0) {
  if (run.done || i < 0 || i >= f.n) return false;
  const ch = run.cells[i];
  if (ch === HIDDEN) { run.cells = put(run.cells, i, String(by)); return true; }
  if (isFlag(ch)) { run.cells = put(run.cells, i, HIDDEN); return true; }
  return false;
}
/** What a number's neighbours hold now: { hidden: [cells], marked (flags, and the mine that ended the field) }. */
export function around(f, cells, i) {
  const hidden = [];
  let marked = 0;
  for (const j of f.nb[i]) { const ch = cells[j]; if (ch === HIDDEN) hidden.push(j); else if (ch === STRUCK || isFlag(ch)) marked++; }
  return { hidden, marked };
}
/**
 * A tap on an open number (chording): with as many flags round it as its number, its other hidden neighbours are dug
 * (a wrong flag means a mine dug: the field is lost); with as many hidden and flagged as its number, the hidden ones are
 * flagged. Returns { kind: "dig" | "flag" | "none", cells, results }.
 */
export function chord(f, run, i, by = 0) {
  if (run.done || run.cells[i] !== OPEN || f.nums[i] === 0) return { kind: "none", cells: [] };
  const { hidden, marked } = around(f, run.cells, i);
  if (!hidden.length) return { kind: "none", cells: [] };
  if (marked === f.nums[i]) {
    const results = [];
    for (const j of hidden) { if (run.done) break; if (run.cells[j] === HIDDEN) results.push({ cell: j, ...dig(f, run, j) }); }
    return { kind: "dig", cells: hidden, results };
  }
  if (marked + hidden.length === f.nums[i]) {
    for (const j of hidden) flag(f, run, j, by);
    return { kind: "flag", cells: hidden };
  }
  return { kind: "none", cells: [] };
}

/** A cleared run's score in seconds: its time, plus HINT a hint. Lower is better. (A lost field has no score.) */
export const score = run => Math.round(run.ms / 1000) + HINT * run.hints;

// ---------- what a player knows, and hints ----------
/**
 * A solver loaded with what a player knows of a run: every open cell, every struck mine, and the numbers this player
 * reads (sees(i), all of them alone). Flags are never trusted: a flag may be wrong. trust: flags by these seats are
 * taken as mines all the same (a computer player trusts its own).
 */
export function knowing(f, cells, { sees = null, trust = [] } = {}) {
  const s = createSolver(f, { sees });
  for (let i = 0; i < f.n; i++) {
    const ch = cells[i];
    if (ch === OPEN) s.st[i] = 0;
    else if (ch === STRUCK || (isFlag(ch) && trust.includes(Number(ch)) && f.mine[i])) s.st[i] = 1;
  }
  s.sync();
  return s;
}
/**
 * A hint: the cheapest thing the numbers a player reads prove now, { level, from (the numbers), cells, mine }, or
 * null. Flags are left out of it (a hint can say a flag is wrong: its cells may include a flagged one).
 */
export function hint(f, run, { sees = null } = {}) {
  if (run.done || !started(f, run.cells)) return null;
  const s = knowing(f, run.cells, { sees });
  // mines already flagged say nothing new: past them to the next deduction (a safe cell is always news: it's hidden)
  for (let guard = 0; guard < f.n; guard++) {
    const d = s.next(4);
    if (!d) return null;
    const news = d.mine ? d.cells.filter(c => !isFlag(run.cells[c])) : d.cells;
    if (news.length) return { ...d, cells: news };
    for (const c of d.cells) s.markMine(c);
  }
  return null;
}

/** The split of a team's numbers: which seat reads cell i, among `people` (a share each, in seat order). */
export function readerOf(f, i, people) {
  if (people <= 1) return 0;
  return isSolid(f.shape) ? solidShares(f.shape, f.w, people)[i] : shareOf(f.shape, f.w, i, people);
}
