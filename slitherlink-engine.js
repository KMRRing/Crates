// Slitherlink's rules, puzzles and reasoning. One loop is drawn along the edges of a grid of dots; each number says how
// many of its cell's four sides the loop uses; the loop never crosses or touches itself. Every puzzle made here has
// exactly one answer and is graded by the hardest step a person needs to reach it. No page in it: slitherlink-worker.js
// makes puzzles off the page, slitherlink.js plays them, tests/slitherlink.mjs checks it all in Node.
//
// Edges are numbered row by row: the horizontal ones first (row 0 of dots, its C edges, then row 1…), then the vertical
// ones (cell row 0, its C+1 edges, …). A state is one number an edge: 0 unknown, 1 line, 2 crossed (known not to be
// part of the loop). The marks a player keeps are the same as characters, "0" "1" "2", one string a board.

export const SIZES = [5, 7, 10];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
export const ORDER = ["easy", "medium", "hard"];
export const DAILY = { size: 7, level: "medium" };
export const NONE = "0", LINE = "1", CROSS = "2";
const TRIAL_ROUNDS = 2;            // Medium's trials break within this many rounds of the plain rules; Hard's follow them all the way
const TRIES = 8;                   // puzzles made towards a level before the nearest is dealt

// ---------- the board ----------
const GEO = new Map();
/** The board of R rows and C columns of cells: its edges, corners and cells, and which touch which. */
export function geometry(R, C) {
  const key = `${R}x${C}`;
  if (GEO.has(key)) return GEO.get(key);
  const H = (R + 1) * C, E = H + R * (C + 1), V = (R + 1) * (C + 1), cells = R * C;
  const ea = new Int16Array(E), eb = new Int16Array(E), ce = new Int16Array(cells * 4);
  const vedges = Array.from({ length: V }, () => []), ecells = Array.from({ length: E }, () => []);
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) { const e = r * C + c; ea[e] = r * (C + 1) + c; eb[e] = ea[e] + 1; }
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) { const e = H + r * (C + 1) + c; ea[e] = r * (C + 1) + c; eb[e] = ea[e] + C + 1; }
  for (let e = 0; e < E; e++) { vedges[ea[e]].push(e); vedges[eb[e]].push(e); }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const k = r * C + c, es = [r * C + c, (r + 1) * C + c, H + r * (C + 1) + c, H + r * (C + 1) + c + 1];   // top, bottom, left, right
    es.forEach((e, j) => { ce[k * 4 + j] = e; ecells[e].push(k); });
  }
  const g = { R, C, H, E, V, cells, ea, eb, ce, vedges, ecells };
  GEO.set(key, g);
  return g;
}
/** A puzzle from its clues (one character a cell: a digit, or "-" for none) and, if known, its answer (marks). */
export function puzzleOf(size, grid, sol = null) {
  const g = geometry(size, size);
  return { size, g, grid, clue: Int8Array.from(grid, ch => (ch === "-" ? -1 : +ch)), sol: sol && Uint8Array.from(sol, ch => (ch === LINE ? 1 : 0)), solMarks: sol };
}

// ---------- the rules, as a solver follows them ----------
// `rec`, when given, makes a rule stop at the first thing it settles and say what it was (for a hint): rec.set (the
// edges and what they become), rec.tech and where (rec.cell, rec.vertex or rec.edge).
const note = (rec, e, v) => { (rec.set ??= []).push([e, v]); };

/** One sweep of the two local rules. Returns -1 on a contradiction, 1 if it settled something, else 0. */
function sweep(g, clue, st, rec) {
  const { ce, vedges, cells, V } = g;
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
  for (let x = 0; x < V; x++) {
    const es = vedges[x];
    let l = 0, u = 0;
    for (const e of es) { const s = st[e]; if (s === 1) l++; else if (s === 0) u++; }
    if (l > 2) return -1;
    let v = 0, tech = "";
    if (l === 2) { if (u) { v = 2; tech = "two"; } }
    else if (l === 1) { if (!u) return -1; if (u === 1) { v = 1; tech = "through"; } }
    else if (u === 1) { v = 2; tech = "dead"; }
    if (!v) continue;
    for (const e of es) if (st[e] === 0) { st[e] = v; if (rec) note(rec, e, v); }
    if (rec) { rec.tech = tech; rec.vertex = x; return 1; }
    changed = 1;
  }
  return changed;
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
/** The loop rule: a line may only join the two ends of one path when that closes the whole answer. Returns -1, 1 or 0. */
function loopRule(g, clue, st, rec) {
  const par = new Int16Array(g.V);
  for (let i = 0; i < g.V; i++) par[i] = i;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  let cyc = -1, lines = 0, root0 = -1, single = true;
  for (let e = 0; e < g.E; e++) {
    if (st[e] !== 1) continue;
    lines++;
    const a = find(g.ea[e]), b = find(g.eb[e]);
    if (a === b) { if (cyc >= 0) return -1; cyc = e; } else par[a] = b;
  }
  if (!lines) return 0;
  for (let e = 0; e < g.E; e++) {
    if (st[e] !== 1) continue;
    const r = find(g.ea[e]);
    if (root0 < 0) root0 = r; else if (r !== root0) { single = false; break; }
  }
  let changed = 0;
  if (cyc >= 0) {
    // a closed loop: any other line is a second loop, and nothing more may be added to it
    if (!single) return -1;
    for (let e = 0; e < g.E; e++) if (st[e] === 0) { st[e] = 2; changed = 1; if (rec) note(rec, e, 2); }
    if (rec && changed) { rec.tech = "closed"; rec.edge = cyc; }
    return changed;
  }
  for (let e = 0; e < g.E; e++) {
    if (st[e] !== 0 || find(g.ea[e]) !== find(g.eb[e])) continue;
    if (single && satisfiedWith(g, clue, st, e)) continue;       // the last edge of the answer
    st[e] = 2; changed = 1;
    if (rec) { note(rec, e, 2); rec.tech = "loop"; rec.edge = e; return 1; }
  }
  return changed;
}
/** The rules followed until nothing more is settled, or for `rounds` rounds. -1 if they break, else 0. */
function propagate(g, clue, st, rounds = Infinity) {
  for (let i = 0; i < rounds; i++) {
    const a = sweep(g, clue, st, null);
    if (a < 0) return -1;
    const b = loopRule(g, clue, st, null);
    if (b < 0) return -1;
    if (!a && !b) return 0;
  }
  return 0;
}
const complete = (g, st) => { let lines = 0; for (let e = 0; e < g.E; e++) { if (!st[e]) return false; if (st[e] === 1) lines++; } return lines > 0; };

/**
 * A trial: suppose an edge is a line, or crossed, and follow the rules for `rounds` rounds; if they break, it is the
 * other. Settles every edge it can, and says whether it settled any (-1 when the puzzle has no answer).
 */
function trial(g, clue, st, rounds) {
  let any = 0;
  for (let e = 0; e < g.E; e++) {
    if (st[e]) continue;
    for (const v of [1, 2]) {
      const t = st.slice();
      t[e] = v;
      if (propagate(g, clue, t, rounds) < 0) {
        st[e] = 3 - v;
        if (propagate(g, clue, st) < 0) return -1;
        any = 1;
        break;
      }
    }
  }
  return any;
}
/** The first edge a trial settles, and how many rounds it took to break: for a hint. */
function trialStep(g, clue, st, rounds, rec) {
  for (let e = 0; e < g.E; e++) {
    if (st[e]) continue;
    for (const v of [1, 2]) {
      const t = st.slice();
      t[e] = v;
      if (propagate(g, clue, t, rounds) < 0) {
        let depth = 1;
        while (propagate(g, clue, Int8Array.from(st).fill(v, e, e + 1), depth) >= 0 && depth < 60) depth++;
        Object.assign(rec, { set: [[e, 3 - v]], tech: "trial", edge: e, supposed: v, depth });
        return true;
      }
    }
  }
  return false;
}

/**
 * Solve with what a person at a level can do: 0, the rules alone; 1, a trial that breaks within a couple of rounds
 * too; 2, any trial of one supposed edge. { ok, st, need } with need the hardest kind of step used.
 */
export function solveAs(g, clue, level, st = new Int8Array(g.E)) {
  let need = 0;
  for (;;) {
    if (propagate(g, clue, st) < 0) return { ok: false, st, need, broken: true };
    if (complete(g, st)) return { ok: true, st, need };
    let got = 0;
    if (level >= 1) { got = trial(g, clue, st, TRIAL_ROUNDS); if (got) need = Math.max(need, 1); }
    if (got < 0) return { ok: false, st, need, broken: true };
    if (!got && level >= 2) { got = trial(g, clue, st, Infinity); if (got) need = 2; }
    if (got < 0) return { ok: false, st, need, broken: true };
    if (!got) return { ok: false, st, need };
  }
}
/** The lowest level (0 to 2) that solves the puzzle by reasoning, or -1 when none does. */
export function gradeOf(g, clue) {
  for (let lv = 0; lv < 3; lv++) if (solveAs(g, clue, lv).ok) return lv;
  return -1;
}

// ---------- counting answers (the proof, and the tests') ----------
/** How many answers the clues have, counted up to `limit`: a search, the rules followed after every guess. */
export function count(g, clue, limit = 2, st = new Int8Array(g.E)) {
  if (propagate(g, clue, st) < 0) return 0;
  if (complete(g, st)) return 1;
  let pick = -1;
  for (let x = 0; x < g.V && pick < 0; x++) {                  // follow a path from where it ends, if there is one
    let l = 0, free = -1;
    for (const e of g.vedges[x]) { if (st[e] === 1) l++; else if (!st[e] && free < 0) free = e; }
    if (l === 1) pick = free;
  }
  if (pick < 0) pick = st.indexOf(0);
  if (pick < 0) return 0;
  let n = 0;
  for (const v of [1, 2]) {
    const t = st.slice();
    t[pick] = v;
    n += count(g, clue, limit - n, t);
    if (n >= limit) break;
  }
  return n;
}
/** The answer of a puzzle that has one, as marks. */
export function answerOf(size, grid) {
  const P = puzzleOf(size, grid), r = solveAs(P.g, P.clue, 2);
  if (r.ok) return Array.from(r.st, s => String(s)).join("");
  const find = (st = new Int8Array(P.g.E)) => {
    if (propagate(P.g, P.clue, st) < 0) return null;
    if (complete(P.g, st)) return st;
    const e = st.indexOf(0);
    for (const v of [1, 2]) { const t = st.slice(); t[e] = v; const s = find(t); if (s) return s; }
    return null;
  };
  const s = find();
  return s ? Array.from(s, x => String(x)).join("") : null;
}

// ---------- making a puzzle ----------
const rngOf = seed => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * A closed loop, as the cells inside it: a region grown cell by cell that stays in one piece, has no hole in it and
 * touches itself at no corner, so its outline is one loop that never meets itself.
 */
function randomLoop(R, C, rng) {
  const W = C + 2, at = (r, c) => (r + 1) * W + c + 1, ins = new Uint8Array((R + 2) * W);
  const target = Math.round(R * C * (0.5 + rng() * 0.2));
  ins[at(Math.floor(rng() * R), Math.floor(rng() * C))] = 1;
  let size = 1;
  const outsideJoined = () => {                              // every outside cell, the ring round the board too, reached from its corner
    const seen = new Uint8Array(ins.length), todo = [0];
    seen[0] = 1;
    let reached = 0;
    while (todo.length) {
      const i = todo.pop();
      reached++;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= ins.length || seen[j] || ins[j]) continue;
        if ((j % W === 0 && i % W === W - 1) || (j % W === W - 1 && i % W === 0)) continue;   // no wrapping round the edge
        seen[j] = 1; todo.push(j);
      }
    }
    return reached === ins.length - size;
  };
  const pinched = i => {                                     // two diagonal cells in, the other two out, at any corner of cell i
    for (const [dr, dc] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
      const a = i + dr * W + dc, b = a + 1, c = a + W, d = c + 1;
      if ((ins[a] && ins[d] && !ins[b] && !ins[c]) || (ins[b] && ins[c] && !ins[a] && !ins[d])) return true;
    }
    return false;
  };
  while (size < target) {
    const cand = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const i = at(r, c);
      if (!ins[i] && (ins[i - 1] || ins[i + 1] || ins[i - W] || ins[i + W])) cand.push(i);
    }
    shuffle(cand, rng);
    let added = false;
    for (const i of cand) {
      ins[i] = 1; size++;
      if (!pinched(i) && outsideJoined()) { added = true; break; }
      ins[i] = 0; size--;
    }
    if (!added) break;
  }
  return { ins, at };
}
/** The loop's edges (marks, "1" on the loop and "2" off it) and the number in every cell. */
function loopMarks(g, { ins, at }) {
  const { R, C, H } = g, marks = new Array(g.E).fill(CROSS);
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) if (ins[at(r - 1, c)] !== ins[at(r, c)]) marks[r * C + c] = LINE;
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) if (ins[at(r, c - 1)] !== ins[at(r, c)]) marks[H + r * (C + 1) + c] = LINE;
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
