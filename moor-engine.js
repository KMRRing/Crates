// Moor's rules, puzzles and reasoning (Tents & trees, as docks and barges). Some cells hold a dock. Every dock has exactly
// one barge, moored next to it (orthogonally on a square board, any of six neighbours on a hex one), and every barge
// belongs to one dock. Barges never touch each other (a square board's corners count). The numbers round the board say how
// many barges lie in each line (a row and a column; on a hex board three directions). Every puzzle made here has exactly one
// answer and is graded by the hardest step a person needs to reach it: the solver below only reasons (it never guesses and
// backs out), so a puzzle it finishes has no second answer. No page in it: moor-worker.js makes puzzles off the page, moor.js
// plays them, tests/moor.mjs checks it all in Node.
//
// The twists (docs/moor.md): SEA WALLS stand on the edge between two cells that lie side by side. A wall breaks "beside": a
// barge across a wall from a dock is not beside that dock. A wall also separates: two barges side by side across a wall do
// not touch (a corner is never walled: diagonal barges always touch). DOUBLE DOCKS (grid character "2") take exactly two
// barges, each still belonging to one dock. RANGES make a line's number a bound: "3+" at least, "≤3" at most (a string of
// "=", "+", "-" a line). The HEX board is a hexagon of hexes: beside and touching are the same six neighbours.
//
// A state is one number a cell (0 unknown, 1 barge, 2 open water, which includes the docks' own cells); the marks a player
// keeps are the same as characters, one string a board, with open water a dot (a note: only the barges count).

import { rngOf, shuffle } from "./loop-engine.js";

export const NONE = "0", BARGE = "1", WATER = "2";
export const SIZES = [6, 8, 10, 12, 14];
export const HEX_SIZES = [5, 7, 9, 11];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
export const ORDER = ["easy", "medium", "hard", "expert"];
export const DAILY = { size: 8, level: "medium" };
export const TWISTS = { walls: "Sea walls", doubles: "Double docks", ranges: "Ranges" };
const TWIST_ORDER = ["walls", "doubles", "ranges"];
const TRIES = [10, 8, 6, 8];       // boards made towards each level before the nearest is dealt
const STEPS = [6, 7, 7, 6];        // moves tried on a board for each of its cells (by level) before it is given up
const SQ3 = Math.sqrt(3);
const OPEN = 999;                  // a bound with no upper end ("3+")

/** The twists a name holds: "none", or any of walls, doubles and ranges joined by "+" (a word that is no twist holds none). */
export function flagsOf(twist) {
  const words = String(twist || "none").split("+"), f = { walls: false, doubles: false, ranges: false };
  for (const w of words) if (w in f) f[w] = true;
  return f;
}
/** The canonical name of a set of twists ("none" for no twist). */
export const twistOn = twist => { const f = flagsOf(twist), on = TWIST_ORDER.filter(t => f[t]); return on.length ? on.join("+") : "none"; };
export const hasTwist = twist => twistOn(twist) !== "none";
export const twistName = twist => twistOn(twist).split("+").filter(t => TWISTS[t]).map(t => TWISTS[t]).join(" + ");

// ---------- the boards ----------
const GEO = new Map();
/**
 * The board of N×N cells: each cell's four and eight neighbours, and its 2N lines (rows 0..N-1, then columns). Every board
 * has the same fields: `nb` (the cells a dock's barge may lie in, before walls), `nt` (the cells a barge may not touch),
 * `lines` (each an array of cells in order), `ldir` (the direction of each line), `xy` (the middle of each cell in the
 * drawing's units) and `clue` (where each line's number stands).
 */
export function geo(N) {
  if (GEO.has(N)) return GEO.get(N);
  const ns4 = [], ns8 = [], lines = [], ldir = [], xy = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const a = [], b = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((!dr && !dc) || rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      b.push(rr * N + cc);
      if (!dr || !dc) a.push(rr * N + cc);
    }
    ns4.push(Int16Array.from(a)); ns8.push(Int16Array.from(b)); xy.push([c + 0.5, r + 0.5]);
  }
  for (let r = 0; r < N; r++) { lines.push(Int16Array.from({ length: N }, (_, c) => r * N + c)); ldir.push(0); }
  for (let c = 0; c < N; c++) { lines.push(Int16Array.from({ length: N }, (_, r) => r * N + c)); ldir.push(1); }
  const clue = [...Array.from({ length: N }, (_, r) => [-0.45, r + 0.5]), ...Array.from({ length: N }, (_, c) => [c + 0.5, -0.3])];
  const g = { shape: "square", N, size: N, cells: N * N, ns4, ns8, nb: ns4, nt: ns8, lines, ldir, xy, clue };
  GEO.set(N, g);
  return g;
}
const HEX = new Map();
/**
 * A hexagon of hexes, `m` across the middle (m odd), in axial coordinates (q, r), rows of constant r, drawn pointy-top
 * (a cell's middle is ([√3·(q + r/2)], 1.5·r), a hex of circumradius 1). Three lines through every cell: its row, the line of
 * constant q (running down to the right) and of constant q+r (running down to the left, read from its top). Each line's number
 * stands past one end, chosen so no two stand in one place (tests/moor.mjs): rows at the left, the down-right lines past
 * their lower end, the down-left lines past their top.
 */
export function hexGeo(m) {
  if (HEX.has(m)) return HEX.get(m);
  const R = (m - 1) / 2, at = new Map(), qr = [];
  for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++) { at.set(`${q},${r}`, qr.length); qr.push([q, r]); }
  const D = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];
  const nb = qr.map(([q, r]) => Int16Array.from(D.map(([dq, dr]) => at.get(`${q + dq},${r + dr}`)).filter(j => j !== undefined)));
  const xy = qr.map(([q, r]) => [SQ3 * (q + r / 2), 1.5 * r]);
  const lines = [], ldir = [], clue = [];
  const family = (d, key, order, step, atEnd) => {
    const by = new Map();
    qr.forEach((p, i) => { const k = key(p); if (!by.has(k)) by.set(k, []); by.get(k).push(i); });
    for (const k of [...by.keys()].sort((a, b) => a - b)) {
      const line = by.get(k).sort((a, b) => order(qr[a]) - order(qr[b])), end = atEnd ? line.at(-1) : line[0], s = atEnd ? 1 : -1;
      lines.push(Int16Array.from(line)); ldir.push(d); clue.push([xy[end][0] + s * step[0], xy[end][1] + s * step[1]]);
    }
  };
  family(0, ([, r]) => r, ([q]) => q, [SQ3, 0], false);
  family(1, ([q]) => q, ([, r]) => r, [SQ3 / 2, 1.5], true);
  family(2, ([q, r]) => q + r, ([, r]) => r, [-SQ3 / 2, 1.5], false);
  const g = { shape: "hex", N: m, size: m, cells: qr.length, nb, nt: nb, lines, ldir, xy, clue, qr };
  HEX.set(m, g);
  return g;
}
/** The board of a shape ("square" or "hex") and size. */
export const boardOf = (shape, size) => (shape === "hex" ? hexGeo(size) : geo(size));
/** Whether a size is one a shape has. */
export const sizeOn = (shape, size) => (shape === "hex" ? HEX_SIZES : SIZES).includes(size);

const lineName = (N, l) => (l < N ? `Row ${l + 1}` : `Column ${l - N + 1}`);
/** A line's name in words: Row 3, Column 5 (a square board); Row 3, Diagonal ↘ 2 and Diagonal ↙ 6 (a hex one). */
export function lineLabel(P, l) {
  if (typeof P === "number") return lineName(P, l);        // (the square board's, by its side)
  if (P.shape !== "hex") return lineName(P.N, l);
  const m = P.N;
  return l < m ? `Row ${l + 1}` : l < 2 * m ? `Diagonal ↘ ${l - m + 1}` : `Diagonal ↙ ${l - 2 * m + 1}`;
}

// ---------- walls ----------
const wkey = (a, b) => (a < b ? a * 1024 + b : b * 1024 + a);
/** Walls as a string ("3-4,10-11", each pair the two cells either side) and back. */
export const wallsText = set => [...set].sort((a, b) => a - b).map(k => `${Math.floor(k / 1024)}-${k % 1024}`).join(",");
export function wallsOf(text) {
  const set = new Set();
  for (const part of String(text || "").split(",")) {
    const [a, b] = part.split("-").map(Number);
    if (Number.isInteger(a) && Number.isInteger(b) && a !== b) set.add(wkey(a, b));
  }
  return set;
}

/**
 * A puzzle from its grid ("0" no dock, "1" a dock, "2" a double dock, a character a cell) and its answer (the same for
 * barges). The numbers round the board are the answer's counts; `opts` are the twists: shape ("square" or "hex"), walls (as
 * wallsText) and ranges (a character a line: "=" the number, "+" at least, "-" at most). The solver reads only the grid, the
 * walls and the numbers, never the answer.
 */
export function puzzleOf(size, grid, sol = null, opts = {}) {
  const shape = opts.shape === "hex" ? "hex" : "square", g = boardOf(shape, size), cells = g.cells;
  const walls = opts.walls instanceof Set ? opts.walls : wallsOf(opts.walls);
  const cap = Int8Array.from(grid, ch => (ch === "2" ? 2 : ch === "1" ? 1 : 0)), docks = [], dock = new Uint8Array(cells);
  for (let x = 0; x < cells; x++) if (cap[x]) { docks.push(x); dock[x] = 1; }
  let beside = g.nb, touch = g.nt, gap = null;
  if (walls.size) {
    beside = g.nb.map((a, x) => a.filter(y => !walls.has(wkey(x, y))));
    touch = g.nt.map((a, x) => a.filter(y => !walls.has(wkey(x, y))));
  }
  gap = walls.size ? g.lines.map(line => Uint8Array.from({ length: line.length - 1 }, (_, i) => (walls.has(wkey(line[i], line[i + 1])) ? 1 : 0))) : (g.noGap ||= g.lines.map(line => new Uint8Array(line.length - 1)));
  const near = new Uint8Array(cells);
  for (let x = 0; x < cells; x++) if (!dock[x]) for (const y of beside[x]) if (dock[y]) near[x] = 1;
  const L = g.lines.length, need = new Int8Array(L), lo = new Int16Array(L), hi = new Int16Array(L);
  const ranges = opts.ranges && /[+-]/.test(opts.ranges) ? String(opts.ranges) : "";
  if (sol) g.lines.forEach((line, l) => {
    let n = 0; for (const x of line) if (sol[x] === BARGE) n++;
    need[l] = n;
    const kind = ranges[l] || "=";
    lo[l] = kind === "-" ? 0 : n; hi[l] = kind === "+" ? OPEN : n;
  });
  const P = { shape, N: size, size, cells, grid, sol, dock, cap, docks, near, need, lo, hi, g, beside, touch, gap, walls, ranges, rows: Array.from(need.slice(0, size)), cols: Array.from(need.slice(size, 2 * size)) };
  return P;
}
/** The numbers as printed, a line each: "3", "3+" (at least), "≤3" (at most). */
export const cluesOf = P => Array.from(P.need, (n, l) => (P.ranges[l] === "+" ? `${n}+` : P.ranges[l] === "-" ? `≤${n}` : String(n)));
/** How many barges a puzzle holds: its docks' slots. */
export const totalOf = P => P.docks.reduce((a, d) => a + P.cap[d], 0);
/** The state a puzzle starts in: the docks' cells and every cell with no dock beside it are open water. */
export function startOf(P) {
  const st = new Int8Array(P.cells);
  for (let x = 0; x < P.cells; x++) if (P.dock[x] || !P.near[x]) st[x] = 2;
  return st;
}
const unknownIn = st => { let n = 0; for (let i = 0; i < st.length; i++) if (!st[i]) n++; return n; };

// ---------- what a state breaks ----------
/** Per line: barges, and the most more it could hold (a run of unknown cells holds every other one, unless a wall lies between). */
function lineStats(P, st) {
  const L = P.g.lines.length, b = new Int8Array(L), cap = new Int16Array(L);
  for (let l = 0; l < L; l++) {
    const line = P.g.lines[l], gap = P.gap[l];
    let n = 0, room = 0, took = false;
    for (let i = 0; i < line.length; i++) {
      const v = st[line[i]];
      if (v === 1) n++;
      if (v === 0) {
        if (took && !gap[i - 1]) took = false;
        else { room++; took = true; }
      } else took = false;
    }
    b[l] = n; cap[l] = room;
  }
  return { b, cap };
}
/** A maximum matching of the docks (as many slots as barges each takes) onto distinct cells beside them that are not open water (Kuhn's): { ok, bad: the first dock left out }. */
function dockMatch(P, st) {
  const owner = new Map(), seen = new Set();
  const grab = d => {
    for (const c of P.beside[d]) {
      if (st[c] === 2 || seen.has(c)) continue;
      seen.add(c);
      if (!owner.has(c) || grab(owner.get(c))) { owner.set(c, d); return true; }
    }
    return false;
  };
  for (const d of P.docks) for (let k = 0; k < P.cap[d]; k++) { seen.clear(); if (!grab(d)) return { ok: false, bad: d }; }
  return { ok: true };
}
/** A maximum matching of the placed barges onto docks beside them, a dock taking as many as it has slots: { ok, bad: the first barge left out, owners: Map dock → its barges }. */
function bargeMatch(P, st) {
  const owners = new Map(), seen = new Set();
  const grab = b => {
    for (const d of P.beside[b]) {
      if (!P.cap[d] || seen.has(d)) continue;
      seen.add(d);
      let o = owners.get(d);
      if (!o) owners.set(d, o = []);
      if (o.length < P.cap[d]) { o.push(b); return true; }
      for (let i = 0; i < o.length; i++) if (grab(o[i])) { o[i] = b; return true; }
    }
    return false;
  };
  for (let b = 0; b < P.cells; b++) if (st[b] === 1) { seen.clear(); if (!grab(b)) return { ok: false, bad: b, owners }; }
  return { ok: true, owners };
}
/** The first rule a state breaks, or null: { kind: touch | over | room | bare | match, ... }. Used by every proof by contradiction. */
export function broken(P, st) {
  for (let x = 0; x < P.cells; x++) if (st[x] === 1) for (const y of P.touch[x]) if (y > x && st[y] === 1) return { kind: "touch", cells: [x, y] };
  const { b, cap } = lineStats(P, st);
  for (let l = 0; l < b.length; l++) {
    if (b[l] > P.hi[l]) return { kind: "over", line: l };
    if (P.lo[l] - b[l] > cap[l]) return { kind: "room", line: l };
  }
  for (const d of P.docks) { let n = 0; for (const c of P.beside[d]) if (st[c] !== 2) n++; if (n < P.cap[d]) return { kind: "bare", dock: d }; }
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

/** A barge may touch no other: the cells round it (the eight, or the six of a hex board; none across a wall) are water. */
function touch(P, st, out) {
  for (const x of barges(st)) for (const y of P.touch[x]) if (st[y] === 0) { add(out, { x: y, v: 2, tech: "touch", focus: [x] }); if (out.stop) return; }
}
/** A line that has all its barges (as many as it may hold): the rest is water. */
function full(P, st, out) {
  const { b } = lineStats(P, st);
  for (let l = 0; l < b.length; l++) if (b[l] === P.hi[l]) for (const x of P.g.lines[l]) if (st[x] === 0) { add(out, { x, v: 2, tech: "full", line: l, focus: [] }); if (out.stop) return; }
}
/** A line with as many places left as barges it needs still: they are all barges. */
function fill(P, st, out) {
  const { b } = lineStats(P, st);
  for (let l = 0; l < b.length; l++) {
    let u = 0;
    for (const x of P.g.lines[l]) if (st[x] === 0) u++;
    if (u && P.lo[l] - b[l] === u) for (const x of P.g.lines[l]) if (st[x] === 0) { add(out, { x, v: 1, tech: "fill", line: l, focus: [] }); if (out.stop) return; }
  }
}
/** A dock with exactly as many places left as barges it takes: they are all barges. */
function lone(P, st, out) {
  for (const d of P.docks) {
    const A = []; for (const c of P.beside[d]) if (st[c] !== 2) A.push(c);
    if (A.length !== P.cap[d]) continue;
    for (const c of A) if (st[c] === 0) { add(out, { x: c, v: 1, tech: "lone", focus: [d] }); if (out.stop) return; }
  }
}
/** A dock whose barges are all found (barges beside it and no other dock): a place beside that dock and no other dock is water. */
function served(P, st, out) {
  const { dock } = P;
  for (const d of P.docks) {
    const mine = [];
    for (const b of P.beside[d]) {
      if (st[b] !== 1) continue;
      let docks = 0; for (const e of P.beside[b]) if (dock[e]) docks++;
      if (docks === 1) mine.push(b);
    }
    if (mine.length < P.cap[d]) continue;
    for (const c of P.beside[d]) {
      if (st[c] !== 0) continue;
      let others = 0; for (const e of P.beside[c]) if (dock[e] && e !== d) others++;
      if (!others) { add(out, { x: c, v: 2, tech: "served", focus: [...mine, d] }); if (out.stop) return; }
    }
  }
}
/** The ways a dock's barges can lie: the sets of its open places, as many as it takes, no two touching. */
function waysOf(P, C, need) {
  const ways = [], pick = [];
  const go = from => {
    if (pick.length === need) { ways.push(pick.slice()); return; }
    for (let i = from; i < C.length; i++) {
      let ok = true; for (const p of pick) if (P.touch[p].includes(C[i])) ok = false;
      if (!ok) continue;
      pick.push(C[i]); go(i + 1); pick.pop();
    }
  };
  go(0);
  return ways;
}
/** A dock's barge is in one of its few places: a cell touching every one of them is water. A double dock's two lie in one of the ways two places that do not touch can be picked: a place in none of them is water, one in all of them is a barge, and a cell that touches one of each is water. */
function pair(P, st, out) {
  for (const d of P.docks) {
    const C = []; for (const c of P.beside[d]) if (st[c] !== 2) C.push(c);
    const need = P.cap[d];
    if (C.length <= need) continue;
    if (need === 1) {
      for (const x of P.touch[C[0]]) {
        if (st[x] !== 0 || C.includes(x)) continue;
        let all = true; for (let i = 1; i < C.length && all; i++) if (!P.touch[C[i]].includes(x)) all = false;
        if (all) { add(out, { x, v: 2, tech: "pair", focus: [d, ...C] }); if (out.stop) return; }
      }
      continue;
    }
    const ways = waysOf(P, C, need);
    if (!ways.length) continue;
    for (const c of C) {
      if (st[c] !== 0) continue;
      const inAll = ways.every(w => w.includes(c)), inNone = !ways.some(w => w.includes(c));
      if (inAll) { add(out, { x: c, v: 1, tech: "pair", focus: [d, ...C] }); if (out.stop) return; }
      else if (inNone) { add(out, { x: c, v: 2, tech: "pair", focus: [d, ...C] }); if (out.stop) return; }
    }
    const seen = new Set();
    for (const c of C) for (const x of P.touch[c]) {
      if (st[x] !== 0 || C.includes(x) || seen.has(x)) continue;
      seen.add(x);
      if (ways.every(w => w.some(p => P.touch[p].includes(x)))) { add(out, { x, v: 2, tech: "pair", focus: [d, ...C] }); if (out.stop) return; }
    }
  }
}
/** The state with a supposition made: a cell a barge (the cells it touches water) or water. */
function suppose(P, st, x, v) {
  const s = st.slice();
  s[x] = v;
  if (v === 1) for (const y of P.touch[x]) if (s[y] === 0) s[y] = 2;
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
/** How many answers the puzzle has (up to `limit`), by plain search over where each dock's barges go: for tests, and small boards only. */
export function count(P, limit = 2) {
  const { dock, docks } = P, tents = new Set(), found = new Set(), here = new Int16Array(P.g.lines.length);
  const lineOf = Array.from({ length: P.cells }, () => []);
  P.g.lines.forEach((line, l) => { for (const x of line) lineOf[x].push(l); });
  const slots = []; for (const d of docks) for (let k = 0; k < P.cap[d]; k++) slots.push([d, k]);
  const go = (i, after) => {
    if (found.size >= limit) return;
    if (i === slots.length) {
      for (let l = 0; l < here.length; l++) if (here[l] < P.lo[l] || here[l] > P.hi[l]) return;
      found.add([...tents].sort((a, b) => a - b).join(","));
      return;
    }
    const [d, k] = slots[i];
    for (const c of P.beside[d]) {
      if (dock[c] || tents.has(c) || (k && c <= after)) continue;
      let ok = true; for (const y of P.touch[c]) if (tents.has(y)) ok = false;
      if (ok) for (const l of lineOf[c]) if (here[l] >= P.hi[l]) ok = false;
      if (!ok) continue;
      tents.add(c); for (const l of lineOf[c]) here[l]++;
      go(i + 1, c);
      tents.delete(c); for (const l of lineOf[c]) here[l]--;
    }
  };
  go(0, -1);
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
// ---------- making puzzles with twists, and hex boards ----------
// The plain square puzzle above is untouched (its random draws are what every old seed, link and daily is). A puzzle with a
// twist or on a hex board is made by the same kind of search, over planted barges, their docks and the walls, with the
// solver of the level as the judge; the walls that do nothing are taken out afterwards, and the ranges are loosened one at a
// time while the level still finishes the puzzle.
const stateGrid = (B, pairs) => { const a = new Array(B.cells).fill("0"); for (const [, d] of pairs) a[d] = a[d] === "0" ? "1" : "2"; return a.join(""); };
const stateSol = (B, pairs) => { const a = new Array(B.cells).fill("0"); for (const [t] of pairs) a[t] = "1"; return a.join(""); };
const puzzleOfState = (B, st, ranges = "") => puzzleOf(B.size, stateGrid(B, st.pairs), stateSol(B, st.pairs), { shape: B.shape, walls: st.walls, ranges });
const edgesOf = B => B.edges || (B.edges = B.nb.flatMap((a, x) => Array.from(a).filter(y => y > x).map(y => [x, y])));

/** Whether planted pairs [barge, dock] and walls are a legal board: docks hold at most one barge (two with double docks), each barge beside its dock with no wall between, and no two barges touch but across a wall. */
function legal(B, st, doubles) {
  const tents = new Set(st.pairs.map(p => p[0])), isDock = new Set(st.pairs.map(p => p[1])), use = new Map();
  if (tents.size !== st.pairs.length) return false;
  for (const [t, d] of st.pairs) {
    if (isDock.has(t) || !B.nb[t].includes(d) || st.walls.has(wkey(t, d))) return false;
    use.set(d, (use.get(d) || 0) + 1);
    if (use.get(d) > (doubles ? 2 : 1)) return false;
    for (const y of B.nt[t]) if (tents.has(y) && !st.walls.has(wkey(t, y))) return false;
  }
  return true;
}
/** Barges dealt at random that touch none, a few side by side across a new wall (if walls), each given a dock beside it (a few docks take two, if doubles). */
function dealState(B, rng, density, T) {
  const want = Math.max(2, Math.round(B.cells * density)), tents = [], blocked = new Uint8Array(B.cells), walls = new Set();
  for (const x of shuffle(Array.from({ length: B.cells }, (_, i) => i), rng)) {
    if (tents.length >= want) break;
    if (blocked[x]) continue;
    tents.push(x); blocked[x] = 1;
    for (const y of B.nt[x]) blocked[y] = 1;
  }
  if (T.walls) {
    const have = new Set(tents);
    for (let k = 0, n = Math.ceil(tents.length * 0.35); k < n; k++) {
      const t = tents[Math.floor(rng() * tents.length)], u = B.nb[t][Math.floor(rng() * B.nb[t].length)];
      if (have.has(u)) continue;
      let alone = true; for (const y of B.nt[u]) if (have.has(y) && y !== t) alone = false;
      if (!alone) continue;
      have.add(u); tents.push(u); walls.add(wkey(t, u));
    }
  }
  const isTent = new Set(tents), slots = new Map(), owners = new Map();
  for (let x = 0; x < B.cells; x++) slots.set(x, T.doubles && rng() < 0.4 ? 2 : 1);
  const seen = new Set();
  const grab = t => {
    for (const c of shuffle([...B.nb[t]], rng)) {
      if (isTent.has(c) || seen.has(c)) continue;
      seen.add(c);
      let o = owners.get(c);
      if (!o) owners.set(c, o = []);
      if (o.length < slots.get(c)) { o.push(t); return true; }
      for (let i = 0; i < o.length; i++) if (grab(o[i])) { o[i] = t; return true; }
    }
    return false;
  };
  for (const t of shuffle(tents.slice(), rng)) { seen.clear(); grab(t); }
  const pairs = []; for (const [d, o] of owners) for (const t of o) pairs.push([t, d]);
  if (T.walls) {
    const edges = edgesOf(B), at = new Set(pairs.map(p => wkey(p[0], p[1])));
    for (let k = 0, n = Math.round(B.cells * (0.06 + 0.08 * rng())); k < n; k++) {
      const [a, b] = edges[Math.floor(rng() * edges.length)], key = wkey(a, b);
      if (!at.has(key)) walls.add(key);
    }
  }
  return { pairs, walls };
}
/** A random change to a planted board, or null when it came to nothing legal: a barge given another dock, moved, a pair added or taken away; with walls one put up or taken down, or a barge added across a new wall; with doubles a dock given a second barge or one taken away. */
function mutateState(B, st, rng, T) {
  const pairs = st.pairs.map(p => p.slice()), walls = new Set(st.walls), roll = rng(), i = Math.floor(rng() * pairs.length);
  const room = skip => {      // the docks a barge at t could take
    const use = new Map(), tents = new Set(pairs.map(p => p[0]));
    for (const [, d] of pairs) use.set(d, (use.get(d) || 0) + 1);
    return t => B.nb[t].filter(c => !tents.has(c) && c !== skip && !walls.has(wkey(t, c)) && (use.get(c) || 0) < (T.doubles ? 2 : 1));
  };
  const pick = a => a[Math.floor(rng() * a.length)];
  if (roll < 0.28 && pairs.length) {
    const options = room(pairs[i][1])(pairs[i][0]).filter(c => c !== pairs[i][1]);
    if (!options.length) return null;
    pairs[i][1] = pick(options);
  } else if (roll < 0.46 && pairs.length) {
    const t = Math.floor(rng() * B.cells);
    pairs.splice(i, 1);
    const options = room(-1)(t);
    if (!options.length) return null;
    pairs.push([t, pick(options)]);
  } else if (roll < 0.58) {
    const t = Math.floor(rng() * B.cells), options = room(-1)(t);
    if (!options.length) return null;
    pairs.push([t, pick(options)]);
  } else if (roll < 0.63) {
    if (pairs.length <= 3) return null;
    pairs.splice(i, 1);
  } else if (T.walls && roll < 0.75) {
    const [a, b] = pick(edgesOf(B));
    walls.add(wkey(a, b));
  } else if (T.walls && roll < 0.82) {
    if (!walls.size) return null;
    walls.delete(pick([...walls]));
  } else if (T.walls && roll < 0.89) {
    const t = pick(pairs)[0], u = pick([...B.nb[t]]), options = room(-1)(u);
    if (!options.length) return null;
    walls.add(wkey(t, u)); pairs.push([u, pick(options)]);
  } else if (T.doubles && roll < 0.97) {
    const d = pick(pairs)[1], use = pairs.filter(p => p[1] === d).length;
    if (use === 2) { pairs.splice(pairs.findIndex(p => p[1] === d), 1); }
    else {
      const t = pick(B.nb[d].filter(c => !pairs.some(p => p[0] === c) && !walls.has(wkey(c, d))) || []);
      if (t == null) return null;
      pairs.push([t, d]);
    }
  } else return null;
  const next = { pairs, walls };
  return legal(B, next, T.doubles) ? next : null;
}
const doublesIn = st => { const use = new Map(); for (const [, d] of st.pairs) use.set(d, (use.get(d) || 0) + 1); let n = 0; for (const v of use.values()) if (v > 1) n++; return n; };

/** The walls a puzzle needs: each tried out of the puzzle in turn, and kept only if the level no longer finishes it without. */
function pareWalls(B, st, rng, want, T) {
  let walls = new Set(st.walls);
  for (const k of shuffle([...walls], rng)) {
    const next = new Set(walls); next.delete(k);
    const cand = { pairs: st.pairs, walls: next };
    if (!legal(B, cand, T.doubles)) continue;
    if (arrived(puzzleOfState(B, cand), want)) walls = next;
  }
  return walls;
}
/** The ranges a puzzle can bear: lines taken one at a time in random order, a line's number made "at least" or "at most" while the level still finishes the puzzle. Returns the ranges string ("" when no line took one). */
function loosenRanges(B, st, rng, want, share) {
  const P0 = puzzleOfState(B, st), L = P0.g.lines.length, mark = new Array(L).fill("="), order = shuffle(Array.from({ length: L }, (_, l) => l), rng);
  let made = 0;
  const goal = Math.max(2, Math.round(L * share));
  for (const l of order) {
    if (made >= goal) break;
    const n = P0.need[l], first = rng() < 0.5 ? "+" : "-";
    for (const kind of [first, first === "+" ? "-" : "+"]) {
      // "at least 0" and "at most" the whole line's room say nothing
      if (kind === "+" && n < 1) continue;
      if (kind === "-" && n >= (P0.g.lines[l].length + 1) >> 1) continue;
      mark[l] = kind;
      if (solveAs(puzzleOfState(B, st, mark.join("")), want).solved) { made++; break; }
      mark[l] = "=";
    }
  }
  return made >= 2 ? mark.join("") : "";
}
/** One search for a puzzle of a grade on a board with twists (null when none came). */
function buildTwisted(seed, B, want, T, tag) {
  const rng = rngOf(seed * 7 + want * 31 + tag);
  const budget = Math.round(B.cells * STEPS[want]);
  for (let attempt = 0; attempt < TRIES[want]; attempt++) {
    let st = dealState(B, rng, 0.17 + rng() * 0.07, T);
    if (!legal(B, st, T.doubles)) continue;
    // (a board must keep its twist while it is steered to the level: a missing double dock counts against it)
    const owed = s => (T.doubles ? Math.max(0, (s.pairs.length >= 8 ? 2 : 1) - doublesIn(s)) : 0);
    let P = puzzleOfState(B, st), score = distance(P, want) + 3 * owed(st);
    for (let step = 0; step < budget && !(arrived(P, want) && !owed(st)); step++) {
      const next = mutateState(B, st, rng, T);
      if (!next) continue;
      const Q = puzzleOfState(B, next), q = distance(Q, want) + 3 * owed(next);
      if (q < score || (q === score && rng() < 0.5) || (q <= score + 2 && rng() < 0.03)) { st = next; P = Q; score = q; }
    }
    if (!arrived(P, want) || owed(st)) continue;
    if (T.walls) {
      st = { pairs: st.pairs, walls: pareWalls(B, st, rng, want, T) };
      if (st.walls.size < 2) continue;
    }
    let ranges = "";
    if (T.ranges) { ranges = loosenRanges(B, st, rng, want, 0.25 + 0.15 * rng()); if (!ranges) continue; }
    const Q = puzzleOfState(B, st, ranges), level = gradeOf(Q);
    if (level < 0) continue;
    const out = { grid: Q.grid, sol: Q.sol, level: ORDER[level] };
    if (B.shape === "hex") out.shape = "hex";
    if (st.walls.size) out.walls = wallsText(st.walls);
    if (ranges) out.ranges = ranges;
    return out;
  }
  return null;
}
const tagOf = (T, shape) => (T.walls ? 1 : 0) + (T.doubles ? 2 : 0) + (T.ranges ? 4 : 0) + (shape === "hex" ? 8 : 0);
/**
 * The puzzle for a seed, size, level and board: { grid, sol, level (what it came to; the nearest level when none came at the
 * one asked for) } and, as it has them, `shape` ("hex"), `walls` (as wallsText) and `ranges`. A plain square puzzle is the
 * one this game has always made for the seed; `twist` ("walls", "doubles", "ranges", or several joined by "+") and the hex
 * board each make theirs.
 */
export function generate(seed, size, level, twist = "none", shape = "square") {
  const T = flagsOf(twist), want = Math.max(0, ORDER.indexOf(level)), hex = shape === "hex";
  const order = [want, ...[0, 1, 2, 3].filter(l => l !== want).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b)];
  if (!hex && !T.walls && !T.doubles && !T.ranges) {
    for (let round = 0; round < 4; round++) for (const lv of order) { const found = build(seed + round * 7919, size, lv); if (found) return found; }
    return null;
  }
  const B = boardOf(hex ? "hex" : "square", size), tag = tagOf(T, shape);
  for (let round = 0; round < 4; round++) for (const lv of order) { const found = buildTwisted(seed + round * 7919, B, lv, T, tag); if (found) return found; }
  return null;
}
/** The level a size can be had at that is nearest the one asked for (a 6×6 board has no puzzle that needs a trial: Expert is Hard there). */
export const levelOn = (size, level, shape = "square") => (!LEVELS[level] ? "medium" : shape === "hex" ? (HEX_LEVELS[size] || ORDER).includes(level) ? level : nearestIn(HEX_LEVELS[size] || ORDER, level) : size <= 6 && level === "expert" ? "hard" : level);
const nearestIn = (list, level) => list.reduce((a, b) => (Math.abs(ORDER.indexOf(b) - ORDER.indexOf(level)) < Math.abs(ORDER.indexOf(a) - ORDER.indexOf(level)) ? b : a));
/** The levels each hex size can honestly give (measured, docs/moor.md): a 5 across (19 cells) has only Easy; a 7 across gives Medium and Expert about six times in ten (else the nearest comes, and the line says so). */
export const HEX_LEVELS = { 5: ["easy"], 7: ORDER, 9: ORDER, 11: ORDER };

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
 * dock of their own), over (lines with too many barges), full (lines that can take no more), moored (docks with all their
 * barges), partial (double docks with one of their two) }.
 */
export function breaks(P, marks) {
  const st = stateOf(P, marks), touchSet = new Set();
  const bs = barges(st);
  for (const x of bs) for (const y of P.touch[x]) if (st[y] === 1) { touchSet.add(x); touchSet.add(y); }
  const { b } = lineStats(P, st), over = [], fullLines = [];
  for (let l = 0; l < b.length; l++) { if (b[l] > P.hi[l]) over.push(l); else if (b[l] === P.hi[l] || (P.hi[l] === OPEN && b[l] >= P.lo[l])) fullLines.push(l); }
  // barges onto docks, a dock taking as many as it has slots (augmenting paths); a barge that cannot get a dock, and every barge that competes for the same few, is stray
  const owners = new Map(), seen = new Set();
  const grab = bg => {
    for (const d of P.beside[bg]) {
      if (!P.cap[d] || seen.has(d)) continue;
      seen.add(d);
      let o = owners.get(d);
      if (!o) owners.set(d, o = []);
      if (o.length < P.cap[d]) { o.push(bg); return true; }
      for (let i = 0; i < o.length; i++) if (grab(o[i])) { o[i] = bg; return true; }
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
      for (const d of P.beside[bg]) if (P.cap[d] && owners.has(d)) for (const o of owners.get(d)) if (!seenB.has(o)) { seenB.add(o); todo.push(o); }
    }
  }
  const moored = [], partial = [];
  for (const [d, o] of owners) {
    if (o.some(bg => stray.has(bg))) continue;
    if (o.length === P.cap[d]) moored.push(d); else if (o.length) partial.push(d);
  }
  return { touch: [...touchSet], stray: [...stray], over, full: fullLines, moored, partial };
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
