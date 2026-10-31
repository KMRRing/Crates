// Slitherlink's rules, puzzles and reasoning. One loop is drawn along the edges of a grid of dots; each number says how
// many of its cell's four sides the loop uses; the loop never crosses or touches itself. Every puzzle made here has
// exactly one answer and is graded by the hardest step a person needs to reach it. No page in it: slitherlink-worker.js
// makes puzzles off the page, slitherlink.js plays them, tests/slitherlink.mjs checks it all in Node.
//
// Edges are numbered row by row: the horizontal ones first (row 0 of dots, its C edges, then row 1…), then the vertical
// ones (cell row 0, its C+1 edges, …). A state is one number an edge: 0 unknown, 1 line, 2 crossed (known not to be
// part of the loop). The marks a player keeps are the same as characters, "0" "1" "2", one string a board.

import { NONE, LINE, CROSS, TRIAL_ROUNDS, geometry, vertexRule, note, loopSolver, rngOf, shuffle, randomLoop, outlineMarks } from "./loop-engine.js";
export { NONE, LINE, CROSS, geometry };

export const SIZES = [5, 7, 10];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
export const ORDER = ["easy", "medium", "hard"];
export const DAILY = { size: 7, level: "medium" };
const TRIES = 8;                   // puzzles made towards a level before the nearest is dealt

// ---------- the board ----------
// (the board itself, its edges and corners, is loop-engine.js's)
/** A puzzle from its clues (one character a cell: a digit, or "-" for none) and, if known, its answer (marks). */
export function puzzleOf(size, grid, sol = null) {
  const g = geometry(size, size);
  return { size, g, grid, clue: Int8Array.from(grid, ch => (ch === "-" ? -1 : +ch)), sol: sol && Uint8Array.from(sol, ch => (ch === LINE ? 1 : 0)), solMarks: sol };
}

// ---------- the rules, as a solver follows them ----------
// `rec`, when given, makes a rule stop at the first thing it settles and say what it was (for a hint): rec.set (the
// edges and what they become), rec.tech and where (rec.cell, rec.vertex or rec.edge).

/** One sweep of the two local rules. Returns -1 on a contradiction, 1 if it settled something, else 0. */
function sweep(g, clue, st, rec) {
  const { ce, cells } = g;
  let changed = 0;
  // a cell: its number is how many of its four sides are lines
  for (let k = 0; k < cells; k++) {
    const n = clue[k];
    if (n < 0) continue;
    let l = 0, u = 0;
    for (let j = 0; j < 4; j++) { const s = st[ce[k * 4 + j]]; if (s === 1) l++; else if (s === 0) u++; }
    if (l > n || l + u < n) return -1;
    if (u && (l === n || l + u === n)) {
      const v = l === n ? 2 : 1;
      for (let j = 0; j < 4; j++) { const e = ce[k * 4 + j]; if (st[e] === 0) { st[e] = v; if (rec) note(rec, e, v); } }
      if (rec) { rec.tech = v === 2 ? "full" : "short"; rec.cell = k; return 1; }
      changed = 1;
    }
  }
  // a corner: the loop passes through it (two lines) or not at all (none)
  const v = vertexRule(g, st, rec);
  if (v < 0) return -1;
  return changed || v ? 1 : 0;
}

/** Whether the lines drawn so far, with edge `e` added, satisfy every number exactly. */
function satisfiedWith(g, clue, st, e) {
  for (let k = 0; k < g.cells; k++) {
    if (clue[k] < 0) continue;
    let l = 0;
    for (let j = 0; j < 4; j++) { const f = g.ce[k * 4 + j]; if (st[f] === 1 || f === e) l++; }
    if (l !== clue[k]) return false;
  }
  return true;
}
const { loopRule, propagate, trialStep, solveAs, gradeOf, count, firstAnswer } = loopSolver({ sweep, closes: satisfiedWith });
export { solveAs, gradeOf, count };

// ---------- the answer of a puzzle ----------
/** The answer of a puzzle that has one, as marks. */
export function answerOf(size, grid) {
  const P = puzzleOf(size, grid), st = firstAnswer(P.g, P.clue);
  return st ? Array.from(st, x => String(x)).join("") : null;
}

// ---------- making a puzzle ----------
/** The loop's edges (marks, "1" on the loop and "2" off it) and the number in every cell. */
function loopMarks(g, loop) {
  const marks = outlineMarks(g, loop);
  const clue = new Int8Array(g.cells);
  for (let k = 0; k < g.cells; k++) for (let j = 0; j < 4; j++) if (marks[g.ce[k * 4 + j]] === LINE) clue[k]++;
  return { marks: marks.join(""), clue };
}
/** Takes numbers away, in random order, for as long as a solver of the level can still finish the puzzle. */
function pare(g, clue, level, rng) {
  for (const k of shuffle(Array.from({ length: g.cells }, (_, i) => i), rng)) {
    const was = clue[k];
    clue[k] = -1;
    if (!solveAs(g, clue, level).ok) clue[k] = was;
  }
}
/**
 * A puzzle of a size and level, the same for the same seed: { size, grid, sol, level } with level what it came to (the
 * nearest when the asked-for one wouldn't come in the tries allowed).
 */
export function generate(seed, size, level) {
  const want = Math.max(0, ORDER.indexOf(level)), g = geometry(size, size), rng = rngOf(seed);
  let best = null;
  for (let t = 0; t < TRIES; t++) {
    const { marks, clue } = loopMarks(g, randomLoop(size, size, rng));
    pare(g, clue, want, rng);
    const got = gradeOf(g, clue);
    if (got < 0) continue;
    const found = { size, grid: Array.from(clue, n => (n < 0 ? "-" : String(n))).join(""), sol: marks, level: ORDER[got] };
    if (got === want) return found;
    if (!best || Math.abs(got - want) < Math.abs(ORDER.indexOf(best.level) - want)) best = found;
  }
  return best;
}
/** The level a size can be had at that is nearest the one asked for (every level is offered for every size here). */
export const levelOn = (size, level) => (LEVELS[level] ? level : "medium");

// ---------- marks ----------
export const nextMark = m => (m === NONE ? LINE : m === LINE ? CROSS : NONE);
export const withMark = (marks, i, m) => marks.slice(0, i) + m + marks.slice(i + 1);
const stateOf = marks => Int8Array.from(marks, ch => +ch);

/** Whether the lines drawn are the answer (crossed edges are the player's notes and don't count). */
export function solvedBy(P, marks) {
  for (let e = 0; e < P.g.E; e++) if ((marks[e] === LINE) !== (P.sol[e] === 1)) return false;
  return true;
}
/**
 * What the marks break, from the rules alone (never the answer): the numbers with too many lines, the corners with
 * three lines or a dead end (one line, every other side crossed), a closed loop that isn't the answer, and the
 * numbers already met.
 */
export function breaks(P, marks) {
  const { g, clue } = P, st = stateOf(marks), over = [], met = [], bad = [], loop = [];
  for (let k = 0; k < g.cells; k++) {
    if (clue[k] < 0) continue;
    let l = 0;
    for (let j = 0; j < 4; j++) if (st[g.ce[k * 4 + j]] === 1) l++;
    if (l > clue[k]) over.push(k); else if (l === clue[k]) met.push(k);
  }
  for (let x = 0; x < g.V; x++) {
    let l = 0, u = 0;
    for (const e of g.vedges[x]) { if (st[e] === 1) l++; else if (!st[e]) u++; }
    if (l > 2 || (l === 1 && !u)) bad.push(x);
  }
  const par = new Int16Array(g.V).map((_, i) => i);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  let closing = -1;
  for (let e = 0; e < g.E; e++) {
    if (st[e] !== 1) continue;
    const a = find(g.ea[e]), b = find(g.eb[e]);
    if (a === b) closing = e; else par[a] = b;
  }
  if (closing >= 0 && !solvedBy(P, marks)) {
    const root = find(g.ea[closing]);
    for (let e = 0; e < g.E; e++) if (st[e] === 1 && find(g.ea[e]) === root) loop.push(e);
  }
  return { over, met, bad, loop };
}

// ---------- hints ----------
/**
 * The next thing to tell a player: a mark that is wrong, put right ({ wrong, should }); else the next step a person
 * would take, simplest first ({ step: { set, tech, … } }); else one edge of the answer ({ reveal, should }).
 */
export function hintFor(P, marks) {
  const { g, clue } = P;
  for (let e = 0; e < g.E; e++) {
    const should = P.sol[e] ? LINE : CROSS;
    if (marks[e] !== NONE && marks[e] !== should) return { wrong: e, should };
  }
  const st = stateOf(marks), rec = {};
  if (propagate(g, clue, st.slice()) >= 0) {
    if (sweep(g, clue, st.slice(), rec) > 0 || loopRule(g, clue, st.slice(), rec) > 0) return { step: rec };
    const r2 = {};
    if (trialStep(g, clue, st, TRIAL_ROUNDS, r2) || trialStep(g, clue, st, Infinity, r2)) return { step: r2 };
  }
  const e = st.indexOf(0);
  return e < 0 ? null : { reveal: e, should: P.sol[e] ? LINE : CROSS };
}
