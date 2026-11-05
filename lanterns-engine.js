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
// cell: "." white, "#" a rock without a number, "0" to "6" a rock with one, "a" to "f" a rock with a lower bound ("a" is
// 1+ … "f" 6+), "A" to "E" a rock with an upper bound ("A" is ≤1 … "E" ≤5), and a mirror: "/" and "\" on the square
// board; "-", "/" and "\" on the hex one (the three axes).
//
// The twists (5 November 2026, docs/lanterns.md): mirrors bend a beam 90° (hex: reflect it across the mirror's axis), short
// beams end it after k cells, a rock's number may be a bound, and the board may be a hexagon of hexes (a lantern has six
// rays). A plain square puzzle is made exactly as it always was: the generator's random draws are the same, so every old
// seed and daily link is the same puzzle.

import { rngOf, shuffle } from "./loop-engine.js";

export const NONE = "0", LIGHT = "1", DOT = "2";
export const SIZES = [7, 10, 14];
export const HEX_SIZES = [7, 9, 11];          // cells across the middle of a hexagon (37, 61, 91 cells)
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
export const ORDER = ["easy", "medium", "hard", "expert"];
export const DAILY = { size: 10, level: "medium" };
const TRIES = [10, 14, 14, 16];     // boards made towards each level before the nearest is dealt
const ROCKS = [[0.2, 0.28], [0.15, 0.24], [0.12, 0.2], [0.12, 0.2]];   // the share of a board that is rock to start with, by level, from-to (more rock is added to make a puzzle unique)
const SHORT = 2;                    // rounds of the rules a Hard trial follows; an Expert one follows them to the end
const REPAIRS = 70;                 // rocks added to a board, at most, to make its answer the only one
const MIRROR_SHARE = [0.07, 0.13];  // the share of a board that is mirror (taken from the white cells), from-to
const BOUND_SHARE = 0.5;            // the share of numbers a Ranges puzzle tries to weaken to a bound before the unneeded ones are dropped
const NO_LIMIT = 99;                // the upper end of a "n+" bound

// ---------- the twists ----------
export const TWISTS = { ranges: "Ranges", short: "Short beams", mirrors: "Mirrors", hex: "Hex" };
export const TWIST_ORDER = ["ranges", "short", "mirrors", "hex"];
/** A twist as the flags it is: from "mirrors+hex", or the flags themselves (anything else is none). */
export function twistOf(t) {
  const set = new Set(typeof t === "string" ? t.split(/[+ ]/) : TWIST_ORDER.filter(k => t?.[k]));
  const out = { ranges: set.has("ranges"), short: set.has("short"), mirrors: set.has("mirrors"), hex: set.has("hex") };
  out.plain = !TWIST_ORDER.some(k => out[k]);
  return out;
}
/** The canonical name of a twist ("none" for none): the flags in order, joined by "+". */
export const twistKey = t => { const f = twistOf(t), on = TWIST_ORDER.filter(k => f[k]); return on.length ? on.join("+") : "none"; };
export const twistName = t => { const f = twistOf(t), on = TWIST_ORDER.filter(k => f[k]); return on.map(k => TWISTS[k]).join(" + "); };
/** A short beam's reach k, by board and size (drawn once a try, only when the twist is on). */
const reachOf = (hex, size, rng) => (hex ? 2 + Math.floor(rng() * 2) + (size >= 9 ? 1 : 0) : size <= 7 ? 2 + Math.floor(rng() * 2) : size <= 10 ? 3 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3));

// ---------- the board ----------
const BOARDS = new Map();
const SQ3 = Math.sqrt(3);
/** The ways of a hex board as angles (E, W, NE, SW, NW, SE: opposite ways in pairs, as up/down and left/right are on the square one). */
const HEX_ANGLES = [0, 180, 60, 240, 120, 300];
const SQUARE_MIRRORS = ["/", "\\"], HEX_MIRRORS = ["-", "/", "\\"];
/**
 * The board of a shape ("square" or "hex") and size: { shape, N, cells, D (ways a ray goes), nb (each cell's neighbours, −1
 * where the board ends, in the ways' order; the opposite of way d is d ^ 1), xy (centres, a neighbour one unit away), mirrors
 * (the characters of a mirror on this board), turn (for each kind of mirror, the way a beam travelling d leaves) }.
 * Square N×N: the ways are up, down, left, right. Hex: a hexagon of hexes N across (N odd), pointy-top, in axial (q, r).
 */
export function boardOf(shape, N) {
  const key = `${shape}:${N}`;
  if (BOARDS.has(key)) return BOARDS.get(key);
  let b;
  if (shape === "hex") {
    const R = (N - 1) / 2, at = new Map(), qr = [];
    for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++) { at.set(`${q},${r}`, qr.length); qr.push([q, r]); }
    const D = [[1, 0], [-1, 0], [1, -1], [-1, 1], [0, -1], [0, 1]];
    const nb = qr.map(([q, r]) => D.map(([dq, dr]) => at.get(`${q + dq},${r + dr}`) ?? -1));
    const xy = qr.map(([q, r]) => [q + r / 2, (SQ3 / 2) * r]);
    // a mirror lies along one axis (0°, 60° or 120°) and reflects a beam: a way at angle φ leaves at 2·axis − φ; a beam along the axis slides through
    const turn = [0, 60, 120].map(axis => HEX_ANGLES.map(phi => HEX_ANGLES.indexOf((((2 * axis - phi) % 360) + 360) % 360)));
    b = { shape, N, cells: qr.length, D: 6, nb, xy, qr, mirrors: HEX_MIRRORS, turn };
  } else {
    const nb = Array.from({ length: N * N }, (_, x) => {
      const r = Math.floor(x / N), c = x % N;
      return [r > 0 ? x - N : -1, r < N - 1 ? x + N : -1, c > 0 ? x - 1 : -1, c < N - 1 ? x + 1 : -1];
    });
    const xy = Array.from({ length: N * N }, (_, x) => [(x % N) + 0.5, Math.floor(x / N) + 0.5]);
    // "/" turns a beam going up to the right, right to up, down to left, left to down; "\" the other way
    b = { shape, N, cells: N * N, D: 4, nb, xy, mirrors: SQUARE_MIRRORS, turn: [[3, 2, 1, 0], [2, 3, 0, 1]] };
  }
  BOARDS.set(key, b);
  return b;
}
/** The square board of N×N cells: each cell's four neighbours (−1 where the board ends), in the order up, down, left, right. */
export const board = N => boardOf("square", N);
export const cellsOf = (shape, size) => boardOf(shape, size).cells;

/** The character of a rock's number: exact "0".."6", a lower bound "a".."f", an upper bound "A".."E". rel: 0 exact, 1 at least, 2 at most. */
export const charOf = (n, rel) => (rel === 1 ? String.fromCharCode(96 + n) : rel === 2 ? String.fromCharCode(64 + n) : String(n));
/** [n, rel] of a grid character that is a rock with a number, else null. */
function numOfChar(ch) {
  if (ch >= "0" && ch <= "6") return [+ch, 0];
  if (ch >= "a" && ch <= "f") return [ch.charCodeAt(0) - 96, 1];
  if (ch >= "A" && ch <= "E") return [ch.charCodeAt(0) - 64, 2];
  return null;
}

/**
 * The cells a lantern on x lights along its rays, with the mirrors in the way: { cells (the others, once each), self (a beam comes
 * back to x: a lantern there would shine on itself), paths (when asked, for drawing: for each way x leaves, the cells the beam
 * crosses in order, mirrors included, and how it ended: "edge", "rock" or "reach") }. k is the reach in cells each way (0: no
 * limit). A rock stops a beam, a mirror turns it and lets it go on, a lantern or a lit cell doesn't stop it. Beams are reversible,
 * so x lights y exactly when y lights x: a beam that comes back to x is followed on round until it would repeat, so that holds
 * for x too (the reasoning below relies on it).
 */
export function trace(B, black, mir, k, x, wantPaths = false) {
  const { nb, D, turn } = B, seen = new Set(), paths = wantPaths ? [] : null;
  let self = false;
  const cap = B.cells * D + 8;
  for (let d0 = 0; d0 < D; d0++) {
    let at = x, d = d0, steps = 0, ended = "edge";
    const path = wantPaths ? [] : null;
    for (;;) {
      if (k && steps >= k) { ended = "reach"; break; }
      const y = nb[at][d];
      if (y < 0) { ended = "edge"; break; }
      if (++steps > cap) { ended = "reach"; break; }
      if (mir[y]) { path?.push(y); d = turn[mir[y] - 1][d]; at = y; continue; }
      if (black[y]) { ended = "rock"; break; }
      path?.push(y);
      if (y === x) { self = true; if (d === d0) { ended = "reach"; break; } }
      else seen.add(y);
      at = y;
    }
    paths?.push({ cells: path, ended, way: d });
  }
  return { cells: [...seen], self, paths };
}

/** A puzzle from its grid and, if known, its answer (one character a cell, "1" a lantern). `o`: { board: "hex" | "square", k: reach }. */
export function puzzleOf(size, grid, sol = null, o = {}) {
  const hex = o.board === "hex", B = boardOf(hex ? "hex" : "square", size), cells = B.cells, nb = B.nb, k = o.k | 0;
  const black = Uint8Array.from(grid, ch => (ch === "." ? 0 : 1));
  const mir = Uint8Array.from(grid, ch => B.mirrors.indexOf(ch) + 1);
  const num = new Int8Array(cells).fill(-1), rel = new Uint8Array(cells), lo = new Uint8Array(cells), hi = new Uint8Array(cells);
  for (let x = 0; x < cells; x++) {
    const v = numOfChar(grid[x]);
    if (!v) continue;
    num[x] = v[0]; rel[x] = v[1];
    lo[x] = rel[x] === 2 ? 0 : v[0];
    hi[x] = rel[x] === 1 ? NO_LIMIT : v[0];
  }
  // what a lantern on a cell lights: the cell, and the cells its rays reach (the cell comes first); self: it would shine on itself
  const self = new Uint8Array(cells);
  const see = Array.from({ length: cells }, (_, x) => {
    if (black[x]) return new Int16Array(0);
    const t = trace(B, black, mir, k, x);
    if (t.self) self[x] = 1;
    return Int16Array.from([x, ...t.cells]);
  });
  // the white cells touching a numbered rock
  const touch = Array.from({ length: cells }, (_, x) => (num[x] < 0 ? [] : nb[x].filter(y => y >= 0 && !black[y])));
  const whites = Int16Array.from(Array.from(black, (b, x) => (b ? -1 : x)).filter(x => x >= 0));
  const rocks = Int16Array.from(Array.from(num, (n, x) => (n >= 0 ? x : -1)).filter(x => x >= 0));
  return { size, N: size, cells, board: B, shape: B.shape, k, nb, grid, black, mir, num, rel, lo, hi, self, see, touch, whites, rocks, sol: sol && Int8Array.from(sol, Number), solMarks: sol };
}
const gridOf = (B, black, mir, num, rel) => Array.from(black, (b, x) => (!b ? "." : mir[x] ? B.mirrors[mir[x] - 1] : num[x] < 0 ? "#" : charOf(num[x], rel ? rel[x] : 0))).join("");
/** The state a puzzle starts from: nothing known. */
export const startOf = P => new Int8Array(P.cells);
/** A rock's number as it is shown: "2", "2+", "≤1". */
export const numberText = (P, b) => (P.rel[b] === 1 ? `${P.num[b]}+` : P.rel[b] === 2 ? `≤${P.num[b]}` : String(P.num[b]));

// ---------- the rules, as a solver follows them ----------
/** Records a cell a rule settled, for a hint. */
const note = (rec, x, v) => { (rec.set ??= []).push([x, v]); };
/** The cells a lantern lights, as a flag a cell. */
function litOf(P, st) {
  const lit = new Uint8Array(P.cells);
  for (const x of P.whites) if (st[x] === 1) for (const y of P.see[x]) lit[y] = 1;
  return lit;
}
/** The lanterns already on the cells round a rock, and the cells still open. */
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
  // a cell whose own light comes back to it (mirrors): a lantern there would shine on itself
  for (const x of P.whites) {
    if (!P.self[x]) continue;
    if (st[x] === 1) return -1;
    if (!st[x]) { put(x, 2); if (done("self", [x])) return 1; }
  }
  // a lantern lights its whole line: nothing else there can be a lantern
  for (const x of P.whites) {
    if (st[x] !== 1) continue;
    for (const y of P.see[x]) if (y !== x && !put(y, 2)) return -1;
    if (done("shine", [x])) return 1;
  }
  // a numbered rock: all its lanterns found closes the cells round it; only as many cells left as it needs fills them
  for (const b of P.rocks) {
    const [l, u] = aroundRock(P, st, b);
    if (l > P.hi[b] || l + u < P.lo[b]) return -1;
    if (!u) continue;
    if (l === P.hi[b]) { for (const y of P.touch[b]) if (!st[y]) put(y, 2); if (done("full", [b])) return 1; }
    else if (l + u === P.lo[b]) { for (const y of P.touch[b]) if (!st[y]) put(y, 1); if (done("need", [b])) return 1; }
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
    if (st[x] === 1) { if (P.self[x]) return true; for (const y of P.see[x]) if (y !== x && st[y] === 1) return true; }
    if (!lit[x]) { let any = false; for (const y of P.see[x]) if (!st[y]) { any = true; break; } if (!any) return true; }
  }
  for (const b of P.rocks) { const [l, u] = aroundRock(P, st, b); if (l > P.hi[b] || l + u < P.lo[b]) return true; }
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
export function answerOf(size, grid, o = {}) {
  const s = solutions(puzzleOf(size, grid, null, o), 1)[0];
  return s ? Array.from(s, v => (v === 1 ? "1" : "0")).join("") : null;
}

// ---------- making a puzzle ----------
/** A set of lanterns for a board with these rocks, at random: every white cell lit, none shining on another. Null if a cell can't be lit
 *  (only where mirrors make a cell shine on itself). */
function lanternsFor(P, rng) {
  const lights = new Uint8Array(P.cells), lit = new Uint8Array(P.cells);
  for (const x of shuffle(Array.from(P.whites), rng)) {
    if (lit[x] || P.self[x]) continue;
    lights[x] = 1;
    for (const y of P.see[x]) lit[y] = 1;
  }
  for (const x of P.whites) if (!lit[x]) return null;
  return lights;
}
/** Whether a set of lanterns (a flag a cell) answers a board of these rocks: every white cell lit, none shining on another,
 *  and each numbered rock touching exactly its number (a number below zero says nothing). Scans rows and columns, so a
 *  generator can ask it thousands of times. Plain square boards only; `answersOn` is the same for every board. */
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
/** The same for any board: the lanterns are walked along their rays (mirrors and a reach included). */
function answersOn(B, black, mir, k, num, set) {
  const cells = B.cells, cnt = new Uint8Array(cells), lamps = [];
  for (let x = 0; x < cells; x++) if (set[x]) { if (black[x]) return false; lamps.push(x); cnt[x]++; }
  for (const x of lamps) {
    const t = trace(B, black, mir, k, x);
    if (t.self) return false;
    for (const y of t.cells) if (++cnt[y] > 1 && set[y]) return false;
  }
  for (let x = 0; x < cells; x++) {
    if (!black[x]) { if (!cnt[x]) return false; }
    else if (!mir[x] && num[x] >= 0) {
      let l = 0;
      for (const y of B.nb[x]) if (y >= 0) l += set[y];
      if (l !== num[x]) return false;
    }
  }
  return true;
}
/**
 * A board with an answer that is its only one: rocks scattered at random, a set of lanterns that lights every cell, every
 * rock numbered with the lanterns it touches, and, for as long as another answer exists, a rock added where the first
 * answer still holds and the other does not. `tw` (flags) and `k` (the reach) add the twists; a plain board draws what it always did.
 */
function unique(size, rng, want, tw, k) {
  const B = boardOf(tw.hex ? "hex" : "square", size), N = size, cells = B.cells, o = { board: tw.hex ? "hex" : "square", k };
  const share = ROCKS[want][0] + rng() * (ROCKS[want][1] - ROCKS[want][0]), { nb } = B;
  const black = new Uint8Array(cells), mir = new Uint8Array(cells);
  for (let x = 0; x < cells; x++) black[x] = rng() < share ? 1 : 0;
  if (black.every(b => b)) return null;
  if (tw.mirrors) {
    const ms = MIRROR_SHARE[0] + rng() * (MIRROR_SHARE[1] - MIRROR_SHARE[0]);
    for (let x = 0; x < cells; x++) if (!black[x] && rng() < ms) { black[x] = 1; mir[x] = 1 + Math.floor(rng() * B.mirrors.length); }
    if (!mir.some(m => m)) return null;
  }
  const noNums = new Int8Array(cells).fill(0);
  const lights = lanternsFor(puzzleOf(N, gridOf(B, black, mir, noNums), null, o), rng);
  if (!lights) return null;
  const numbered = () => {
    const num = new Int8Array(cells).fill(-1);
    for (let x = 0; x < cells; x++) if (black[x] && !mir[x]) { let l = 0; for (const y of nb[x]) if (y >= 0 && lights[y]) l++; num[x] = l; }
    return num;
  };
  const plain = tw.plain, fits = (n2, set) => (plain ? answers(N, black, n2, set) : answersOn(B, black, mir, k, n2, set));
  for (let t = 0; t < REPAIRS; t++) {
    const num = numbered(), P = puzzleOf(N, gridOf(B, black, mir, num), null, o);
    const alt = solutions(P, 2).find(s => Array.from(s, (v, x) => (v === 1 ? 1 : 0)).some((v, x) => v !== lights[x]));
    if (!alt) return { black, mir, lights, num, P };
    const other = Uint8Array.from(alt, v => (v === 1 ? 1 : 0));
    // a cell the first answer lights without a lantern, turned to rock: it must keep that answer and break the other
    let made = false;
    for (const x of shuffle(Array.from(P.whites).filter(y => !lights[y]), rng)) {
      black[x] = 1;
      const n2 = numbered();
      if (fits(n2, lights) && !fits(n2, other)) { made = true; break; }
      black[x] = 0;
    }
    if (!made) return null;
  }
  return null;
}
/** A puzzle like Q with the rock b given a number (n < 0: none) and a kind of bound. The rest of a puzzle's parts don't depend on its numbers. */
function withNumber(Q, b, n, rel = 0) {
  const T = { ...Q, num: Int8Array.from(Q.num), rel: Uint8Array.from(Q.rel), lo: Uint8Array.from(Q.lo), hi: Uint8Array.from(Q.hi) };
  T.num[b] = n; T.rel[b] = rel;
  T.lo[b] = rel === 2 ? 0 : Math.max(0, n); T.hi[b] = rel === 1 ? NO_LIMIT : Math.max(0, n);
  if (n < 0) T.rocks = Q.rocks.filter(y => y !== b);
  return T;
}
/** Weakens numbers to bounds ("n+" or "≤n"), at random and as far as a solver of the level can still finish. Returns the puzzle. */
function bound(P, level, rng) {
  let Q = P;
  for (const b of shuffle(Array.from(Q.rocks), rng)) {
    if (rng() >= BOUND_SHARE) continue;
    const n = Q.num[b], up = Q.touch[b].length;
    const kinds = [];
    if (n >= 1) kinds.push(1);
    if (n >= 1 && n < up) kinds.push(2);
    if (!kinds.length) continue;
    const T = withNumber(Q, b, n, kinds[kinds.length === 1 ? 0 : Math.floor(rng() * kinds.length)]);
    if (solveAs(T, level).ok) Q = T;
  }
  return Q;
}
/** Takes the numbers off the rocks, in random order, for as long as a solver of the level can still finish the puzzle. A Ranges
 *  puzzle goes through its exact numbers first and its bounds last, and keeps `keep` bounds whether or not it needs them. */
function pare(P, level, rng, keep = 0) {
  let Q = P;
  const order = shuffle(Array.from(Q.rocks), rng);
  if (keep) order.sort((a, b) => (Q.rel[a] ? 1 : 0) - (Q.rel[b] ? 1 : 0));
  let bounds = order.filter(b => Q.rel[b]).length;
  for (const b of order) {
    if (keep && Q.rel[b] && bounds <= keep) continue;
    const T = withNumber(Q, b, -1);
    if (solveAs(T, level).ok) { Q = T; if (P.rel[b]) bounds--; }
  }
  return Q;
}
/** How many rocks a Ranges puzzle must show as a bound for the twist to be in play. */
const boundsWanted = size => (size >= 14 ? 4 : size >= 10 ? 3 : 2);
/**
 * A puzzle of a size and level, the same for the same seed: { size, grid, sol, level } with level what it came to (the
 * nearest when the asked-for one wouldn't come in the tries allowed). A twist (see twistOf) adds `board: "hex"` and `k` (the
 * reach of a short beam) to what comes back when they are on.
 */
export function generate(seed, size, level, twist = null) {
  const tw = twistOf(twist), want = Math.max(0, ORDER.indexOf(level)), rng = rngOf(seed);
  let best = null;
  for (let t = 0, tries = Math.round(TRIES[want] * (size < 14 || tw.hex ? 2 : 1) * (tw.plain ? 1 : 1.5)); t < tries; t++) {
    const k = tw.short ? reachOf(tw.hex, size, rng) : 0;
    const base = unique(size, rng, want, tw, k);
    if (!base) continue;
    const from = gradeOf(base.P);
    if (from < 0) continue;                                     // even every number doesn't settle it by reasoning
    const lv = Math.max(want, from);
    let Q = base.P;
    if (tw.ranges) Q = bound(Q, lv, rng);
    Q = pare(Q, lv, rng, tw.ranges ? boundsWanted(size) : 0);
    if (tw.ranges && Q.rocks.filter(b => Q.rel[b]).length < boundsWanted(size)) continue;
    const P = puzzleOf(size, gridOf(Q.board, Q.black, Q.mir, Q.num, Q.rel), null, { board: tw.hex ? "hex" : "square", k });
    const got = gradeOf(P);
    if (got < 0) continue;
    const found = { size, grid: P.grid, sol: Array.from(base.lights, v => (v ? "1" : "0")).join(""), level: ORDER[got] };
    if (tw.hex) found.board = "hex";
    if (k) found.k = k;
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
 * What the marks break, from the rules alone (never the answer): { clash: lanterns shining on each other (or on themselves, by
 * mirrors), over: numbered rocks with too many lanterns, short: numbered rocks that can no longer get their number, dark: cells
 * that nothing can light any more, done: numbered rocks whose number is met (an upper bound: reached), lit: a flag a cell for
 * the cells lit }.
 */
export function breaks(P, marks) {
  const st = stateOf(P, marks), lit = litOf(P, st), clash = [], over = [], short = [], dark = [], done = [];
  for (const x of P.whites) {
    if (st[x] === 1 && (P.self[x] || P.see[x].some(y => y !== x && st[y] === 1))) clash.push(x);
    if (!lit[x] && !P.see[x].some(y => !st[y] && !lit[y])) dark.push(x);
  }
  for (const b of P.rocks) {
    const [l] = aroundRock(P, st, b), lo = P.lo[b], hi = P.hi[b];
    if (l > hi) over.push(b);
    else if (l >= lo && (P.rel[b] === 1 || (l === hi && hi))) done.push(b);
    else if (l + P.touch[b].filter(y => !st[y] && !lit[y]).length < lo) short.push(b);
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
