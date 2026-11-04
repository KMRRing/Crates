// Moor's rules, puzzles and reasoning (Tents & trees, as docks and barges). Some cells hold a dock. Every dock has exactly
// one barge, moored orthogonally next to it (above, below, left or right), and every barge belongs to one dock. Barges
// never touch each other, not even corner to corner. The numbers round the board say how many barges lie in each row and
// column. Every puzzle made here has exactly one answer and is graded by the hardest step a person needs to reach it: the
// solver below only reasons (it never guesses and backs out), so a puzzle it finishes has no second answer. No page in it:
// moor-worker.js makes puzzles off the page, moor.js plays them, tests/moor.mjs checks it all in Node.
//
// A state is one number a cell (0 unknown, 1 barge, 2 open water, which includes the docks' own cells); the marks a player
// keeps are the same as characters, one string a board, with open water a dot (a note: only the barges count).

import { rngOf, shuffle } from "./loop-engine.js";

export const NONE = "0", BARGE = "1", WATER = "2";
export const SIZES = [6, 8, 10, 12, 14];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
export const ORDER = ["easy", "medium", "hard", "expert"];
export const DAILY = { size: 8, level: "medium" };
const TRIES = [10, 8, 6, 8];       // boards made towards each level before the nearest is dealt
const STEPS = [6, 7, 7, 6];        // moves tried on a board for each of its cells (by level) before it is given up

// ---------- the board ----------
const GEO = new Map();
/** The board of N×N cells: each cell's four and eight neighbours, and its 2N lines (rows 0..N-1, then columns). */
export function geo(N) {
  if (GEO.has(N)) return GEO.get(N);
  const ns4 = [], ns8 = [], lines = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const a = [], b = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((!dr && !dc) || rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      b.push(rr * N + cc);
      if (!dr || !dc) a.push(rr * N + cc);
    }
    ns4.push(Int16Array.from(a)); ns8.push(Int16Array.from(b));
  }
  for (let r = 0; r < N; r++) lines.push(Int16Array.from({ length: N }, (_, c) => r * N + c));
  for (let c = 0; c < N; c++) lines.push(Int16Array.from({ length: N }, (_, r) => r * N + c));
  const g = { N, ns4, ns8, lines };
  GEO.set(N, g);
  return g;
}
const lineName = (N, l) => (l < N ? `Row ${l + 1}` : `Column ${l - N + 1}`);
export const lineLabel = lineName;

/**
 * A puzzle from its grid ("1" a dock, "0" else, a character a cell) and its answer (the same for barges). The numbers
 * round the board are the answer's counts. The solver reads only the grid and those counts, never the answer.
 */
export function puzzleOf(size, grid, sol = null) {
  const g = geo(size), cells = size * size;
  const dock = Uint8Array.from(grid, ch => (ch === "1" ? 1 : 0)), docks = [];
  for (let x = 0; x < cells; x++) if (dock[x]) docks.push(x);
  const near = new Uint8Array(cells);
  for (let x = 0; x < cells; x++) if (!dock[x]) for (const y of g.ns4[x]) if (dock[y]) near[x] = 1;
  const need = new Int8Array(2 * size);
  if (sol) g.lines.forEach((line, l) => { let n = 0; for (const x of line) if (sol[x] === BARGE) n++; need[l] = n; });
  return { N: size, size, cells, grid, sol, dock, docks, near, need, g, rows: Array.from(need.slice(0, size)), cols: Array.from(need.slice(size)) };
}
/** The state a puzzle starts in: the docks' cells and every cell with no dock beside it are open water. */
export function startOf(P) {
  const st = new Int8Array(P.cells);
  for (let x = 0; x < P.cells; x++) if (P.dock[x] || !P.near[x]) st[x] = 2;
  return st;
}
const unknownIn = st => { let n = 0; for (let i = 0; i < st.length; i++) if (!st[i]) n++; return n; };

// ---------- what a state breaks ----------
/** Per line: barges, and the most more it could hold (runs of unknown cells hold half their length, rounded up). */
function lineStats(P, st) {
  const { g } = P, b = new Int8Array(2 * P.N), cap = new Int16Array(2 * P.N);
  for (let l = 0; l < g.lines.length; l++) {
    let run = 0, n = 0, room = 0;
    for (const x of g.lines[l]) {
      const v = st[x];
      if (v === 1) n++;
      if (v === 0) run++;
      else { room += (run + 1) >> 1; run = 0; }
    }
    b[l] = n; cap[l] = room + ((run + 1) >> 1);
  }
  return { b, cap };
}
/** A maximum matching of the docks onto distinct cells beside them that are not open water (Kuhn's): { ok, bad: the first dock left out }. */
function dockMatch(P, st) {
  const { g, docks } = P, owner = new Map();
  const seen = new Set();
  const grab = d => {
    for (const c of g.ns4[d]) {
      if (st[c] === 2 || seen.has(c)) continue;
      seen.add(c);
      if (!owner.has(c) || grab(owner.get(c))) { owner.set(c, d); return true; }
    }
    return false;
  };
  for (const d of docks) { seen.clear(); if (!grab(d)) return { ok: false, bad: d }; }
  return { ok: true };
}
/** A maximum matching of the placed barges onto docks beside them: { ok, bad: the first barge left out }. */
function bargeMatch(P, st) {
  const { g, dock } = P, owner = new Map(), seen = new Set();
  const grab = b => {
    for (const d of g.ns4[b]) {
      if (!dock[d] || seen.has(d)) continue;
      seen.add(d);
      if (!owner.has(d) || grab(owner.get(d))) { owner.set(d, b); return true; }
    }
    return false;
  };
  for (let b = 0; b < P.cells; b++) if (st[b] === 1) { seen.clear(); if (!grab(b)) return { ok: false, bad: b }; }
  return { ok: true };
}
/** The first rule a state breaks, or null: { kind: touch | over | room | bare | match, ... }. Used by every proof by contradiction. */
export function broken(P, st) {
  const { g, N } = P;
  for (let x = 0; x < P.cells; x++) if (st[x] === 1) for (const y of g.ns8[x]) if (y > x && st[y] === 1) return { kind: "touch", cells: [x, y] };
  const { b, cap } = lineStats(P, st);
  for (let l = 0; l < 2 * N; l++) {
    if (b[l] > P.need[l]) return { kind: "over", line: l };
    if (P.need[l] - b[l] > cap[l]) return { kind: "room", line: l };
  }
  for (const d of P.docks) { let any = false; for (const c of g.ns4[d]) if (st[c] !== 2) any = true; if (!any) return { kind: "bare", dock: d }; }
  const m = dockMatch(P, st);
  if (!m.ok) return { kind: "match", dock: m.bad };
  const n = bargeMatch(P, st);
  if (!n.ok) return { kind: "match", barge: n.bad };
  return null;
}

// ---------- the steps of reasoning ----------
// A pass looks at a state and adds what it settles to `out` as { x, v (1 barge, 2 water), tech, focus (cells to ring), ... }.
const add = (out, d) => { out.push(d); if (out.stopWhen && out.stopWhen(d)) out.stop = true; };
const barges = st => { const r = []; for (let x = 0; x < st.length; x++) if (st[x] === 1) r.push(x); return r; };

/** A barge may touch no other: the eight cells round it are water. */
function touch(P, st, out) {
  for (const x of barges(st)) for (const y of P.g.ns8[x]) if (st[y] === 0) { add(out, { x: y, v: 2, tech: "touch", focus: [x] }); if (out.stop) return; }
}
/** A line that has all its barges: the rest is water. */
function full(P, st, out) {
  const { b } = lineStats(P, st);
  for (let l = 0; l < 2 * P.N; l++) if (b[l] === P.need[l]) for (const x of P.g.lines[l]) if (st[x] === 0) { add(out, { x, v: 2, tech: "full", line: l, focus: [] }); if (out.stop) return; }
}
/** A line with as many places left as barges to come: they are all barges. */
function fill(P, st, out) {
  const { b } = lineStats(P, st);
  for (let l = 0; l < 2 * P.N; l++) {
    let u = 0;
    for (const x of P.g.lines[l]) if (st[x] === 0) u++;
    if (u && P.need[l] - b[l] === u) for (const x of P.g.lines[l]) if (st[x] === 0) { add(out, { x, v: 1, tech: "fill", line: l, focus: [] }); if (out.stop) return; }
  }
}
/** A dock with one place left for its barge: the barge is there. */
function lone(P, st, out) {
  for (const d of P.docks) {
    let only = -1, n = 0;
    for (const c of P.g.ns4[d]) if (st[c] !== 2) { n++; only = c; }
    if (n === 1 && st[only] === 0) { add(out, { x: only, v: 1, tech: "lone", focus: [d] }); if (out.stop) return; }
  }
}
/** A barge beside one dock only is that dock's: a place beside that dock and no other dock is water. */
function served(P, st, out) {
  const { g, dock } = P;
  for (const b of barges(st)) {
    const mine = []; for (const d of g.ns4[b]) if (dock[d]) mine.push(d);
    if (mine.length !== 1) continue;
    const d = mine[0];
    for (const c of g.ns4[d]) {
      if (c === b || st[c] !== 0) continue;
      let others = 0; for (const e of g.ns4[c]) if (dock[e] && e !== d) others++;
      if (!others) { add(out, { x: c, v: 2, tech: "served", focus: [b, d] }); if (out.stop) return; }
    }
  }
}
/** A dock's barge is in one of its few places: a cell touching every one of them is water. */
function pair(P, st, out) {
  const { g } = P;
  for (const d of P.docks) {
    const C = []; for (const c of g.ns4[d]) if (st[c] !== 2) C.push(c);
    if (C.length < 2) continue;
    for (const x of g.ns8[C[0]]) {
      if (st[x] !== 0 || C.includes(x)) continue;
      let all = true; for (let i = 1; i < C.length && all; i++) if (!g.ns8[C[i]].includes(x)) all = false;
      if (all) { add(out, { x, v: 2, tech: "pair", focus: [d, ...C] }); if (out.stop) return; }
    }
  }
}
/** The state with a supposition made: a cell a barge (its eight neighbours water) or water. */
function suppose(P, st, x, v) {
  const s = st.slice();
  s[x] = v;
  if (v === 1) for (const y of P.g.ns8[x]) if (s[y] === 0) s[y] = 2;
  return s;
}
const cellsToTry = (P, st) => { const r = []; for (let x = 0; x < P.cells; x++) if (st[x] === 0) r.push(x); return r; };
/** A cell that cannot be a barge, or cannot be water, because a rule breaks at once (a line out of room, a dock or a barge with no partner). */
function test(P, st, out) {
  for (const x of cellsToTry(P, st)) {
    for (const v of [1, 2]) {
      const why = broken(P, suppose(P, st, x, v));
      if (why) { add(out, { x, v: 3 - v, tech: "test", supposed: v, why, focus: focusOf(why) }); if (out.stop) return; break; }
    }
  }
}
function focusOf(why) {
  if (why.dock != null) return [why.dock];
  if (why.barge != null) return [why.barge];
  return why.cells || [];
}

/** Settles what the plain rules settle, over and over, until nothing is left to settle or a rule breaks: the breaking, or null. */
function propagate(P, st) {
  for (;;) {
    let changed = false;
    for (const pass of EASY) {
      const out = [];
      pass(P, st, out);
      for (const d of out) {
        if (st[d.x] === d.v) continue;
        if (st[d.x] !== 0) return { kind: "clash", cells: [d.x] };
        st[d.x] = d.v;
        changed = true;
      }
    }
    const why = broken(P, st);
    if (why) return why;
    if (!changed) return null;
  }
}
/** A cell supposed barge or water, the plain rules followed until a rule breaks: a trial. */
function trial(P, st, out) {
  for (const x of cellsToTry(P, st)) {
    for (const v of [1, 2]) {
      const s = suppose(P, st, x, v), why = propagate(P, s);
      if (why) { add(out, { x, v: 3 - v, tech: "trial", supposed: v, why, focus: focusOf(why) }); if (out.stop) return; break; }
    }
  }
}
const EASY = [touch, full, fill, lone, served];
const PASSES = [[touch, full, fill, lone, served], [pair], [test], [trial]];

/** Puts a pass's findings on the state: whether any changed, or null if one clashes with what is there. */
function apply(st, out) {
  let changed = false;
  for (const d of out) {
    if (st[d.x] === d.v) continue;
    if (st[d.x] !== 0) return null;
    st[d.x] = d.v; changed = true;
  }
  return changed;
}
/** Reasons as a person at `level` (0 Easy .. 3 Expert) would, simplest first. { st, solved, top (the hardest class used), why (a rule broke: only a bad puzzle) }. */
export function solveAs(P, level, st = startOf(P)) {
  let top = 0;
  for (;;) {
    const why = propagate(P, st);
    if (why) return { st, solved: false, top, why };
    if (!unknownIn(st)) return { st, solved: true, top };
    let moved = false;
    outer: for (let lv = 1; lv <= level; lv++) {
      for (const pass of PASSES[lv]) {
        const out = [];
        pass(P, st, out);
        const r = apply(st, out);
        if (r === null) return { st, solved: false, top, why: { kind: "clash", cells: [] } };
        if (r) { top = Math.max(top, lv); moved = true; break outer; }
      }
    }
    if (!moved) return { st, solved: false, top };
  }
}
/** The easiest level (0..3) at which the reasoning finishes the puzzle, or -1 if even Expert cannot. */
export function gradeOf(P, upto = 3) {
  for (let lv = 0; lv <= upto; lv++) if (solveAs(P, lv).solved) return lv;
  return -1;
}
/** How many answers the puzzle has (up to `limit`), by plain search over where each dock's barge goes: for tests, and small boards only. */
export function count(P, limit = 2) {
  const { g, dock, docks } = P, tents = new Set(), found = new Set(), here = new Int8Array(2 * P.N);
  const go = i => {
    if (found.size >= limit) return;
    if (i === docks.length) {
      for (let l = 0; l < 2 * P.N; l++) if (here[l] !== P.need[l]) return;
      found.add([...tents].sort((a, b) => a - b).join(","));
      return;
    }
    for (const c of g.ns4[docks[i]]) {
      if (dock[c] || tents.has(c)) continue;
      let ok = true; for (const y of g.ns8[c]) if (tents.has(y)) ok = false;
      const r = Math.floor(c / P.N), k = P.N + (c % P.N);
      if (!ok || here[r] >= P.need[r] || here[k] >= P.need[k]) continue;
      tents.add(c); here[r]++; here[k]++;
      go(i + 1);
      tents.delete(c); here[r]--; here[k]--;
    }
  };
  go(0);
  return found.size;
}

// ---------- making puzzles ----------
const gridOf = (N, docks) => { const a = new Array(N * N).fill("0"); for (const d of docks) a[d] = "1"; return a.join(""); };
const solOf = (N, tents) => { const a = new Array(N * N).fill("0"); for (const t of tents) a[t] = "1"; return a.join(""); };
/** A puzzle from planted barges and their docks (pairs [barge, dock]). */
const fromPairs = (N, pairs) => puzzleOf(N, gridOf(N, pairs.map(p => p[1])), solOf(N, pairs.map(p => p[0])));

/** Pairs [barge, dock] dealt at random: barges that touch none, a distinct free cell beside each for its dock. */
function dealPairs(N, rng, density) {
  const g = geo(N), want = Math.max(2, Math.round(N * N * density)), tents = [], blocked = new Uint8Array(N * N);
  for (const x of shuffle(Array.from({ length: N * N }, (_, i) => i), rng)) {
    if (tents.length >= want) break;
    if (blocked[x]) continue;
    tents.push(x); blocked[x] = 1;
    for (const y of g.ns8[x]) blocked[y] = 1;
  }
  const isTent = new Set(tents), taken = new Map(), seen = new Set();
  const grab = t => {
    for (const c of shuffle([...g.ns4[t]], rng)) {
      if (isTent.has(c) || seen.has(c)) continue;
      seen.add(c);
      if (!taken.has(c) || grab(taken.get(c))) { taken.set(c, t); return true; }
    }
    return false;
  };
  for (const t of tents) { seen.clear(); grab(t); }
  const pairs = []; for (const [d, t] of taken) pairs.push([t, d]);
  return pairs;
}
const validPairs = (N, pairs) => {
  const g = geo(N), isTent = new Set(pairs.map(p => p[0])), isDock = new Set(pairs.map(p => p[1]));
  if (isTent.size !== pairs.length || isDock.size !== pairs.length) return false;
  for (const [t, d] of pairs) {
    if (isDock.has(t) || isTent.has(d) || !g.ns4[t].includes(d)) return false;
    for (const y of g.ns8[t]) if (isTent.has(y)) return false;
  }
  return true;
};
/** A random change to the planted pairs: a barge given another dock, moved, a pair added or one taken away. */
function mutate(N, pairs, rng) {
  const g = geo(N), next = pairs.map(p => p.slice());
  const roll = rng(), i = Math.floor(rng() * next.length);
  const free = (t, skip) => {
    const used = new Set(next.map(p => p[1])), tents = new Set(next.map(p => p[0]));
    return g.ns4[t].filter(c => !used.has(c) && !tents.has(c) && c !== skip);
  };
  if (roll < 0.4 && next.length) {
    const options = free(next[i][0], next[i][1]);
    if (!options.length) return null;
    next[i][1] = options[Math.floor(rng() * options.length)];
  } else if (roll < 0.65 && next.length) {
    const t = Math.floor(rng() * N * N);
    next.splice(i, 1);
    const options = free(t, -1);
    if (!options.length) return null;
    next.push([t, options[Math.floor(rng() * options.length)]]);
  } else if (roll < 0.85) {
    const t = Math.floor(rng() * N * N), options = free(t, -1);
    if (!options.length) return null;
    next.push([t, options[Math.floor(rng() * options.length)]]);
  } else if (next.length > 3) next.splice(i, 1);
  else return null;
  return validPairs(N, next) ? next : null;
}
const stuck = (P, level) => unknownIn(solveAs(P, level).st);

/** How far a board is from a puzzle of the level: cells the level leaves undecided (heavily), and, above Easy, a level below that finishes it (a little for each cell short of three left). */
const distance = (P, want) => (want ? 4 * stuck(P, want) + Math.max(0, 3 - stuck(P, want - 1)) : stuck(P, 0));
const arrived = (P, want) => stuck(P, want) === 0 && (!want || stuck(P, want - 1) > 0);

/** One search for a puzzle of a grade: dealt, then changed a piece at a time towards one the level finishes and the level below does not (unique, as the reasoning only reasons). */
function build(seed, size, want) {
  const rng = rngOf(seed * 7 + want);
  const budget = Math.round(size * size * STEPS[want]);
  for (let attempt = 0; attempt < TRIES[want]; attempt++) {
    let pairs = dealPairs(size, rng, 0.17 + rng() * 0.07);
    if (!validPairs(size, pairs)) continue;
    let P = fromPairs(size, pairs), score = distance(P, want);
    for (let step = 0; step < budget && !arrived(P, want); step++) {
      const next = mutate(size, pairs, rng);
      if (!next) continue;
      const Q = fromPairs(size, next), q = distance(Q, want);
      // keep a change that is no farther (now and then one a little farther, so the search does not stall)
      if (q < score || (q === score && rng() < 0.5) || (q <= score + 2 && rng() < 0.03)) { pairs = next; P = Q; score = q; }
    }
    if (!arrived(P, want)) continue;
    const level = gradeOf(P);
    if (level < 0) continue;
    return { grid: P.grid, sol: P.sol, level: ORDER[level] };
  }
  return null;
}
/** The puzzle for a seed, size and level: { grid, sol, level (what it came to; the nearest level when none came at the one asked for) }. */
export function generate(seed, size, level) {
  const want = Math.max(0, ORDER.indexOf(level));
  const order = [want, ...[0, 1, 2, 3].filter(l => l !== want).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b)];
  for (let round = 0; round < 4; round++) for (const lv of order) { const found = build(seed + round * 7919, size, lv); if (found) return found; }
  return null;
}
/** The level a size can be had at that is nearest the one asked for (a 6×6 board has no puzzle that needs a trial: Expert is Hard there). */
export const levelOn = (size, level) => (!LEVELS[level] ? "medium" : size <= 6 && level === "expert" ? "hard" : level);

// ---------- marks ----------
export const nextMark = m => (m === NONE ? BARGE : m === BARGE ? WATER : NONE);
export const withMark = (marks, i, m) => marks.slice(0, i) + m + marks.slice(i + 1);
/** The state a player's marks make: barges where moored, open water for the docks, the rest unknown (a water dot is a note). */
export function stateOf(P, marks) {
  const st = new Int8Array(P.cells);
  for (let x = 0; x < P.cells; x++) st[x] = marks[x] === BARGE ? 1 : P.dock[x] ? 2 : 0;
  return st;
}
/** The player has moored exactly the answer's barges. */
export function solvedBy(P, marks) {
  for (let x = 0; x < P.cells; x++) if ((marks[x] === BARGE) !== (P.sol[x] === BARGE)) return false;
  return true;
}
/**
 * What the marks break, from the rules alone (never the answer): { touch (barges that touch another), stray (barges with no
 * dock of their own), over (lines with too many barges), full (lines with exactly theirs), moored (docks with a barge of
 * their own) }.
 */
export function breaks(P, marks) {
  const { g, dock, N } = P, st = stateOf(P, marks), touchSet = new Set();
  const bs = barges(st);
  for (const x of bs) for (const y of g.ns8[x]) if (st[y] === 1) { touchSet.add(x); touchSet.add(y); }
  const { b } = lineStats(P, st), over = [], fullLines = [];
  for (let l = 0; l < 2 * N; l++) { if (b[l] > P.need[l]) over.push(l); else if (b[l] === P.need[l]) fullLines.push(l); }
  // barges onto docks, one each (augmenting paths); a barge that cannot get a dock, and every barge that competes for the same few, is stray
  const owner = new Map(), mate = new Map(), seen = new Set();
  const grab = bg => {
    for (const d of g.ns4[bg]) {
      if (!dock[d] || seen.has(d)) continue;
      seen.add(d);
      if (!owner.has(d) || grab(owner.get(d))) { owner.set(d, bg); mate.set(bg, d); return true; }
    }
    return false;
  };
  const lost = [];
  for (const bg of bs) { seen.clear(); if (!grab(bg)) lost.push(bg); }
  const stray = new Set();
  for (const u of lost) {      // the barges and docks reachable from a barge left out by swapping partners: they cannot all be served
    const todo = [u], seenB = new Set([u]);
    while (todo.length) {
      const bg = todo.pop();
      stray.add(bg);
      for (const d of g.ns4[bg]) if (dock[d] && owner.has(d) && !seenB.has(owner.get(d))) { seenB.add(owner.get(d)); todo.push(owner.get(d)); }
    }
  }
  return { touch: [...touchSet], stray: [...stray], over, full: fullLines, moored: [...owner.keys()].filter(d => !stray.has(owner.get(d))) };
}

// ---------- hints ----------
/**
 * The next thing to tell a player: a mark that is wrong, put right ({ wrong, should }); else the next barge a person
 * would moor, simplest reasoning first ({ step: { x, v, tech, focus, ... } }); else one barge of the answer ({ reveal }).
 * The reasoning starts from the docks alone, so it does not depend on the water the player has or has not marked.
 */
export function hintFor(P, marks) {
  for (let x = 0; x < P.cells; x++) {
    if (P.dock[x]) continue;
    const should = P.sol[x] === BARGE ? BARGE : WATER;
    if (marks[x] !== NONE && marks[x] !== should) return { wrong: x, should };
  }
  const st = startOf(P);
  const want = d => d.v === 1 && marks[d.x] !== BARGE;
  for (;;) {
    let moved = false;
    for (let lv = 0; lv < PASSES.length && !moved; lv++) {
      for (const pass of PASSES[lv]) {
        const out = [];
        out.stopWhen = want;
        pass(P, st, out);
        const pick = out.find(want);
        if (pick) return { step: pick };
        const r = apply(st, out);
        if (r === null) return reveal(P, marks);
        if (r) { moved = true; break; }
      }
    }
    if (!moved) break;
  }
  return reveal(P, marks);
}
function reveal(P, marks) {
  for (let x = 0; x < P.cells; x++) if (P.sol[x] === BARGE && marks[x] !== BARGE) return { reveal: x, should: BARGE };
  return null;
}
