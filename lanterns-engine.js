// Lanterns' rules, puzzles and reasoning (Akari, "Light Up": a Nikoli genre). A grid of white cells and rocks (black
// cells). Light a lantern in some white cells: a lantern shines along its row and column up to the next rock or the
// edge. Every white cell must be lit, no lantern may shine on another, and a rock with a number has exactly that many
// lanterns on the four cells touching it (a rock without one says nothing). Every puzzle made here has exactly one
// answer and is graded by the hardest step a person needs to reach it: the solver below only reasons (it never guesses
// and backs out), so a puzzle it finishes has no second answer. No page in it: lanterns-worker.js makes puzzles off the
// page, lanterns.js plays them, tests/lanterns.mjs checks it all in Node.
//
// A state is one number a cell (0 unknown, 1 lantern, 2 no lantern); the marks a player keeps are the same as
// characters, one string a board, with "no lantern" a dot. A rock is never marked. A puzzle's grid is one character a
// cell: "." white, "#" a rock without a number, "0" to "4" a rock with one.

import { rngOf, shuffle } from "./loop-engine.js";

export const NONE = "0", LIGHT = "1", DOT = "2";
export const SIZES = [7, 10, 14];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
export const ORDER = ["easy", "medium", "hard", "expert"];
export const DAILY = { size: 10, level: "medium" };
const TRIES = [10, 14, 14, 16];     // boards made towards each level before the nearest is dealt
const ROCKS = [[0.2, 0.28], [0.15, 0.24], [0.12, 0.2], [0.12, 0.2]];   // the share of a board that is rock to start with, by level, from-to (more rock is added to make a puzzle unique)
const SHORT = 2;                    // rounds of the rules a Hard trial follows; an Expert one follows them to the end
const REPAIRS = 70;                 // rocks added to a board, at most, to make its answer the only one

// ---------- the board ----------
const BOARDS = new Map();
/** The board of N×N cells: each cell's four neighbours (−1 where the board ends), in the order up, down, left, right. */
export function board(N) {
  if (BOARDS.has(N)) return BOARDS.get(N);
  const nb = Array.from({ length: N * N }, (_, x) => {
    const r = Math.floor(x / N), c = x % N;
    return [r > 0 ? x - N : -1, r < N - 1 ? x + N : -1, c > 0 ? x - 1 : -1, c < N - 1 ? x + 1 : -1];
  });
  const b = { N, nb };
  BOARDS.set(N, b);
  return b;
}
/** A puzzle from its grid and, if known, its answer (one character a cell, "1" a lantern). */
export function puzzleOf(size, grid, sol = null) {
  const { nb } = board(size), cells = size * size;
  const black = Uint8Array.from(grid, ch => (ch === "." ? 0 : 1));
  const num = Int8Array.from(grid, ch => (ch >= "0" && ch <= "4" ? +ch : -1));
  // what a lantern on a cell lights: the cell, and the cells in line with it up to the rocks (the cell comes first)
  const see = Array.from({ length: cells }, (_, x) => {
    if (black[x]) return new Int16Array(0);
    const out = [x];
    for (let d = 0; d < 4; d++) for (let y = nb[x][d]; y >= 0 && !black[y]; y = nb[y][d]) out.push(y);
    return Int16Array.from(out);
  });
  // the white cells touching a numbered rock
  const touch = Array.from({ length: cells }, (_, x) => (num[x] < 0 ? [] : nb[x].filter(y => y >= 0 && !black[y])));
  const whites = Int16Array.from(Array.from(black, (b, x) => (b ? -1 : x)).filter(x => x >= 0));
  const rocks = Int16Array.from(Array.from(num, (n, x) => (n >= 0 ? x : -1)).filter(x => x >= 0));
  return { size, N: size, cells, nb, grid, black, num, see, touch, whites, rocks, sol: sol && Int8Array.from(sol, Number), solMarks: sol };
}
const gridOf = (black, num) => Array.from(black, (b, x) => (!b ? "." : num[x] < 0 ? "#" : String(num[x]))).join("");
/** The state a puzzle starts from: nothing known. */
export const startOf = P => new Int8Array(P.cells);

// ---------- the rules, as a solver follows them ----------
/** Records a cell a rule settled, for a hint. */
const note = (rec, x, v) => { (rec.set ??= []).push([x, v]); };
/** The cells a lantern lights, as a flag a cell. */
function litOf(P, st) {
  const lit = new Uint8Array(P.cells);
  for (const x of P.whites) if (st[x] === 1) for (const y of P.see[x]) lit[y] = 1;
  return lit;
}
/** The lanterns already on the four cells round a rock, and the cells still open. */
function aroundRock(P, st, b) {
  let l = 0, u = 0;
  for (const y of P.touch[b]) { if (st[y] === 1) l++; else if (!st[y]) u++; }
  return [l, u];
}

/**
 * One sweep of the plain rules. Returns -1 on a contradiction, 1 if it settled something, else 0. With `rec`, it stops at
 * the first thing it settles and says what it was (rec.set, rec.tech, rec.focus).
 */
function sweep(P, st, rec) {
  let changed = 0;
  const put = (x, v) => { if (st[x] === v) return true; if (st[x]) return false; st[x] = v; changed = 1; if (rec) note(rec, x, v); return true; };
  const done = (tech, focus) => { if (rec?.set?.length) { rec.tech = tech; rec.focus = focus; return true; } return false; };
  // a lantern lights its whole line: nothing else there can be a lantern
  for (const x of P.whites) {
    if (st[x] !== 1) continue;
    for (const y of P.see[x]) if (y !== x && !put(y, 2)) return -1;
    if (done("shine", [x])) return 1;
  }
  // a numbered rock: all its lanterns found closes the cells round it; only as many cells left as it needs fills them
  for (const b of P.rocks) {
    const n = P.num[b], [l, u] = aroundRock(P, st, b);
    if (l > n || l + u < n) return -1;
    if (!u) continue;
    if (l === n) { for (const y of P.touch[b]) if (!st[y]) put(y, 2); if (done("full", [b])) return 1; }
    else if (l + u === n) { for (const y of P.touch[b]) if (!st[y]) put(y, 1); if (done("need", [b])) return 1; }
  }
  // a cell nothing lights yet: it needs a lantern from among the cells that could light it
  const lit = litOf(P, st);
  for (const x of P.whites) {
    if (lit[x]) continue;
    let only = -1, n = 0;
    for (const y of P.see[x]) if (!st[y]) { n++; only = y; }
    if (!n) return -1;
    if (n === 1) {
      put(only, 1);
      if (done("dark", [x])) return 1;
      for (const y of P.see[only]) lit[y] = 1;                  // (what is lit has changed)
    }
  }
  return changed;
}
/** Whether a state breaks a rule outright. */
function broken(P, st) {
  const lit = litOf(P, st);
  for (const x of P.whites) {
    if (st[x] === 1) { for (const y of P.see[x]) if (y !== x && st[y] === 1) return true; }
    if (!lit[x]) { let any = false; for (const y of P.see[x]) if (!st[y]) { any = true; break; } if (!any) return true; }
  }
  for (const b of P.rocks) { const [l, u] = aroundRock(P, st, b); if (l > P.num[b] || l + u < P.num[b]) return true; }
  return false;
}
/** Runs the plain rules until they settle nothing more. Returns -1 on a contradiction, else 0. */
function propagate(P, st, rounds = Infinity) {
  for (let i = 0; i < rounds; i++) {
    const r = sweep(P, st);
    if (r < 0) return -1;
    if (!r) return 0;
  }
  return broken(P, st) ? -1 : 0;
}
/** A lantern put on a cell and the cells it lights shut: whether that already breaks a rule. */
function strands(P, st, x) {
  const t = st.slice();
  t[x] = 1;
  for (const y of P.see[x]) if (y !== x) { if (t[y] === 1) return true; t[y] = 2; }
  return broken(P, t);
}
/** Lookahead: a cell where a lantern would at once leave a cell unlightable, or a rock with too few or too many, has none.
 *  Returns -1 on a contradiction, 1 if it settled something, else 0. */
function look(P, st, rec) {
  let changed = 0;
  for (const x of P.whites) {
    if (st[x]) continue;
    if (!strands(P, st, x)) continue;
    st[x] = 2; changed = 1;
    if (rec) { note(rec, x, 2); rec.tech = "look"; rec.focus = [x]; return 1; }
    if (broken(P, st)) return -1;
  }
  return changed;
}
/** A supposition: a cell set to a value and followed by the rules for some rounds: does a rule break? */
function breaksWith(P, st, x, v, rounds) {
  const t = st.slice();
  t[x] = v;
  return propagate(P, t, rounds) < 0;
}
/** One trial pass: every cell whose lantern, or whose lack of one, breaks a rule when followed through is settled the other
 *  way (all that the state allows at once, or with `rec` only the first, for a hint). Returns whether a cell was settled. */
function trialStep(P, st, rounds, rec) {
  let any = false;
  for (const x of P.whites) {
    if (st[x]) continue;
    for (const v of [1, 2]) {
      if (!breaksWith(P, st, x, v, rounds)) continue;
      const is = 3 - v;
      st[x] = is;
      any = true;
      if (rec) { note(rec, x, is); rec.tech = "trial"; rec.supposed = v; rec.depth = rounds; rec.focus = [x]; return true; }
      break;
    }
  }
  return any;
}
const unknownIn = (P, st) => { let n = 0; for (const x of P.whites) if (!st[x]) n++; return n; };
/** Solves by reasoning alone with the techniques up to a level (0 easy … 3 expert): { ok, st, broken }. */
export function solveAs(P, level, st = startOf(P)) {
  st = st.slice();
  for (;;) {
    if (propagate(P, st) < 0) return { ok: false, st, broken: true };
    if (!unknownIn(P, st)) return { ok: true, st, broken: false };
    if (level >= 1) {
      const q = look(P, st);
      if (q < 0) return { ok: false, st, broken: true };
      if (q) continue;
    }
    if (level >= 2 && trialStep(P, st, SHORT)) continue;
    if (level >= 3 && trialStep(P, st, Infinity)) continue;
    return { ok: false, st, broken: false };
  }
}
/** The lowest level (0 easy … 3 expert) that solves a puzzle by reasoning, or −1 if none. */
export function gradeOf(P, upto = 3) {
  for (let lv = 0; lv <= upto; lv++) if (solveAs(P, lv).ok) return lv;
  return -1;
}

// ---------- the answers of a puzzle, by a search that guesses ----------
/** Up to `limit` answers (as states) of a puzzle, found by search with the plain rules between guesses. */
export function solutions(P, limit = 2, st = startOf(P)) {
  const out = [];
  const go = s => {
    if (out.length >= limit || propagate(P, s) < 0) return;
    // a cell to guess: an unknown cell nothing lights, the one with fewest ways to be lit (else any unknown cell)
    const lit = litOf(P, s);
    let pick = -1, best = 1e9;
    for (const x of P.whites) {
      if (lit[x]) continue;
      let n = 0;
      for (const y of P.see[x]) if (!s[y]) n++;
      if (n < best) { best = n; pick = x; }
    }
    if (pick < 0) {
      const free = P.whites.find(x => !s[x]);
      if (free == null) { out.push(s); return; }
      s[free] = 2; go(s);                              // (a cell already lit and not shut: a lantern there would be lit twice)
      return;
    }
    const cand = Array.from(P.see[pick]).filter(y => !s[y]);
    // pick is lit by a lantern on one of cand: guess the first is a lantern, or is not
    const y = cand[0], a = s.slice(), b = s;
    a[y] = 1; go(a);
    b[y] = 2; go(b);
  };
  go(st.slice());
  return out;
}
export const count = (P, limit = 2, st = startOf(P)) => solutions(P, limit, st).length;
/** The answer of a puzzle that has one, as a string ("1" a lantern, else "0"). */
export function answerOf(size, grid) {
  const s = solutions(puzzleOf(size, grid), 1)[0];
  return s ? Array.from(s, v => (v === 1 ? "1" : "0")).join("") : null;
}

// ---------- making a puzzle ----------
/** A set of lanterns for a board with these rocks, at random: every white cell lit, none shining on another. */
function lanternsFor(P, rng) {
  const lights = new Uint8Array(P.cells), lit = new Uint8Array(P.cells);
  for (const x of shuffle(Array.from(P.whites), rng)) {
    if (lit[x]) continue;
    lights[x] = 1;
    for (const y of P.see[x]) lit[y] = 1;
  }
  return lights;
}
/** Whether a set of lanterns (a flag a cell) answers a board of these rocks: every white cell lit, none shining on another,
 *  and each numbered rock touching exactly its number (a number below zero says nothing). Scans rows and columns, so a
 *  generator can ask it thousands of times. */
function answers(N, black, num, set) {
  const row = new Uint8Array(N * N), col = new Uint8Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0, from = 0; c <= N; c++) {
    if (c < N && !black[r * N + c]) continue;
    let k = 0;
    for (let i = from; i < c; i++) k += set[r * N + i];
    if (k > 1) return false;
    for (let i = from; i < c; i++) row[r * N + i] = k;
    from = c + 1;
  }
  for (let c = 0; c < N; c++) for (let r = 0, from = 0; r <= N; r++) {
    if (r < N && !black[r * N + c]) continue;
    let k = 0;
    for (let i = from; i < r; i++) k += set[i * N + c];
    if (k > 1) return false;
    for (let i = from; i < r; i++) col[i * N + c] = k;
    from = r + 1;
  }
  const { nb } = board(N);
  for (let x = 0; x < N * N; x++) {
    if (black[x]) {
      if (num[x] < 0 || set[x]) { if (set[x]) return false; continue; }
      let l = 0;
      for (const y of nb[x]) if (y >= 0) l += set[y];
      if (l !== num[x]) return false;
    } else if (!row[x] && !col[x]) return false;
  }
  return true;
}
/**
 * A board with an answer that is its only one: rocks scattered at random, a set of lanterns that lights every cell, every
 * rock numbered with the lanterns it touches, and, for as long as another answer exists, a rock added where the first
 * answer still holds and the other does not.
 */
function unique(size, rng, want) {
  const N = size, share = ROCKS[want][0] + rng() * (ROCKS[want][1] - ROCKS[want][0]), { nb } = board(N);
  const black = new Uint8Array(N * N);
  for (let x = 0; x < N * N; x++) black[x] = rng() < share ? 1 : 0;
  if (black.every(b => b)) return null;
  const lights = lanternsFor(puzzleOf(N, gridOf(black, new Int8Array(N * N).fill(0))), rng);
  const numbered = () => {
    const num = new Int8Array(N * N).fill(-1);
    for (let x = 0; x < N * N; x++) if (black[x]) { let l = 0; for (const y of nb[x]) if (y >= 0 && lights[y]) l++; num[x] = l; }
    return num;
  };
  for (let t = 0; t < REPAIRS; t++) {
    const num = numbered(), P = puzzleOf(N, gridOf(black, num));
    const alt = solutions(P, 2).find(s => Array.from(s, (v, x) => (v === 1 ? 1 : 0)).some((v, x) => v !== lights[x]));
    if (!alt) return { black, lights, num, P };
    const other = Uint8Array.from(alt, v => (v === 1 ? 1 : 0));
    // a cell the first answer lights without a lantern, turned to rock: it must keep that answer and break the other
    let made = false;
    for (const x of shuffle(Array.from(P.whites).filter(y => !lights[y]), rng)) {
      black[x] = 1;
      const n2 = numbered();
      if (answers(N, black, n2, lights) && !answers(N, black, n2, other)) { made = true; break; }
      black[x] = 0;
    }
    if (!made) return null;
  }
  return null;
}
/** Takes the numbers off the rocks, in random order, for as long as a solver of the level can still finish the puzzle. */
function pare(P, level, rng) {
  const num = Int8Array.from(P.num);
  let Q = P;
  for (const b of shuffle(Array.from(Q.rocks), rng)) {
    const was = num[b];
    num[b] = -1;
    const T = { ...Q, num: Int8Array.from(num), rocks: Q.rocks.filter(y => y !== b) };      // (the rest of a puzzle's parts don't depend on its numbers)
    if (solveAs(T, level).ok) Q = T; else num[b] = was;
  }
  return num;
}
/**
 * A puzzle of a size and level, the same for the same seed: { size, grid, sol, level } with level what it came to (the
 * nearest when the asked-for one wouldn't come in the tries allowed).
 */
export function generate(seed, size, level) {
  const want = Math.max(0, ORDER.indexOf(level)), rng = rngOf(seed);
  let best = null;
  for (let t = 0, tries = TRIES[want] * (size < 14 ? 2 : 1); t < tries; t++) {
    const base = unique(size, rng, want);
    if (!base) continue;
    const from = gradeOf(base.P);
    if (from < 0) continue;                                     // even every number doesn't settle it by reasoning
    const num = pare(base.P, Math.max(want, from), rng), P = puzzleOf(size, gridOf(base.black, num));
    const got = gradeOf(P);
    if (got < 0) continue;
    const found = { size, grid: P.grid, sol: Array.from(base.lights, v => (v ? "1" : "0")).join(""), level: ORDER[got] };
    if (got === want) return found;
    if (!best || Math.abs(got - want) < Math.abs(ORDER.indexOf(best.level) - want)) best = found;
  }
  return best;
}
/** The level a size can be had at that is nearest the one asked for (every level is offered for every size here). */
export const levelOn = (size, level) => (LEVELS[level] ? level : "medium");

// ---------- marks ----------
export const nextMark = m => (m === NONE ? LIGHT : m === LIGHT ? DOT : NONE);
export const withMark = (marks, i, m) => marks.slice(0, i) + m + marks.slice(i + 1);
export const stateOf = (P, marks) => Int8Array.from(marks, ch => +ch);

/** Whether the lanterns set are the answer (dots are the player's notes and don't count). */
export function solvedBy(P, marks) {
  for (let x = 0; x < P.cells; x++) if ((marks[x] === LIGHT) !== (P.sol[x] === 1)) return false;
  return true;
}
/**
 * What the marks break, from the rules alone (never the answer): { clash: lanterns shining on each other, over: numbered
 * rocks with too many lanterns, short: numbered rocks that can no longer get their number, dark: cells that nothing can
 * light any more, done: numbered rocks with exactly theirs, lit: a flag a cell for the cells lit }.
 */
export function breaks(P, marks) {
  const st = stateOf(P, marks), lit = litOf(P, st), clash = [], over = [], short = [], dark = [], done = [];
  for (const x of P.whites) {
    if (st[x] === 1 && P.see[x].some(y => y !== x && st[y] === 1)) clash.push(x);
    if (!lit[x] && !P.see[x].some(y => !st[y] && !lit[y])) dark.push(x);
  }
  for (const b of P.rocks) {
    const [l, u] = aroundRock(P, st, b), n = P.num[b];
    if (l > n) over.push(b);
    else if (l === n) { if (n) done.push(b); }
    else if (l + P.touch[b].filter(y => !st[y] && !lit[y]).length < n) short.push(b);
  }
  return { clash, over, short, dark, done, lit };
}

// ---------- hints ----------
/**
 * The next thing to tell a player: a mark that is wrong, put right ({ wrong, should }); else the next step a person
 * would take, simplest first ({ step: { set, tech, focus, … } }); else one cell of the answer ({ reveal, should }).
 */
export function hintFor(P, marks) {
  for (const x of P.whites) {
    const should = P.sol[x] ? LIGHT : DOT;
    if (marks[x] !== NONE && marks[x] !== should) return { wrong: x, should };
  }
  const st = stateOf(P, marks), rec = {};
  if (propagate(P, st.slice()) >= 0) {
    if (sweep(P, st.slice(), rec) > 0) return { step: rec };
    const r1 = {};
    if (look(P, st.slice(), r1) > 0) return { step: r1 };
    const r2 = {};
    if (trialStep(P, st, SHORT, r2) || trialStep(P, st, Infinity, r2)) return { step: r2 };
  }
  const x = P.whites.find(y => !st[y]);
  return x == null ? null : { reveal: x, should: P.sol[x] ? LIGHT : DOT };
}
