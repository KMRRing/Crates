// Asterism's rules, puzzles and reasoning. An N×N board is cut into N regions. Put K stars (1 or 2) in every row, every
// column and every region so that no two stars touch, not even corner to corner. Every puzzle made here has exactly one
// answer and is graded by the hardest step a person needs to reach it. No page in it: asterism-worker.js makes puzzles
// off the page, asterism.js plays them, tests/asterism.mjs checks it all in Node.
//
// A state is one number a cell (0 unknown, 1 star, 2 dot: a cell that holds no star); the marks a player keeps are the
// same as characters, one string a board, row by row. A region is a digit 0 to 9 a cell, the answer 0 or 1 a cell.

import { rngOf, shuffle } from "./loop-engine.js";

export const NONE = "0", STAR = "1", DOT = "2";
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
export const ORDER = ["easy", "medium", "hard", "expert"];
/** The sizes each star count is offered at: two stars a row need a board of 8 or more to have a unique answer at all. */
export const KINDS = { 1: [5, 6, 7, 8, 9, 10], 2: [8, 9, 10] };
export const STARS = [1, 2];
export const SIZES = [5, 6, 7, 8, 9, 10];
export const DAILY = { size: 8, k: 1, level: "medium" };
const TRIES = 40;                  // puzzles made towards a level before the nearest is dealt
const MOVES = 60;                  // boundary moves tried towards a level on one puzzle
const SHORT = 4;                   // rounds a trial may take and still be Hard; longer is Expert
const WORK = 400;                  // puzzles graded towards a level before the nearest is dealt (a count, not a time: a seed must make the same puzzle on every device)

// ---------- the board ----------
const PUZZLES = new Map();
/** The puzzle of a region map (and its answer, if known): the cells' neighbours and the groups (rows, then columns, then
 *  regions) a star count is kept for. */
export function puzzleOf(N, k, reg, sol = null) {
  const key = `${N}.${k}.${reg}`;
  let P = PUZZLES.get(key);
  if (!P) {
    const R = Uint8Array.from(reg, Number), nbr = [], nb4 = [];
    for (let x = 0; x < N * N; x++) {
      const r = Math.floor(x / N), c = x % N, a = [], b = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) { a.push(rr * N + cc); if (!dr || !dc) b.push(rr * N + cc); }
      }
      nbr.push(Int16Array.from(a)); nb4.push(Int16Array.from(b));
    }
    const groups = [];
    for (let i = 0; i < N; i++) groups.push({ kind: "row", id: i, cells: Array.from({ length: N }, (_, c) => i * N + c) });
    for (let i = 0; i < N; i++) groups.push({ kind: "col", id: i, cells: Array.from({ length: N }, (_, r) => r * N + i) });
    for (let i = 0; i < N; i++) groups.push({ kind: "region", id: i, cells: [] });
    for (let x = 0; x < N * N; x++) groups[2 * N + R[x]]?.cells.push(x);
    const of = Array.from({ length: N * N }, (_, x) => [Math.floor(x / N), N + (x % N), 2 * N + R[x]]);
    P = { N, k, reg: R, nbr, nb4, groups, of };
    if (PUZZLES.size > 200) PUZZLES.clear();
    PUZZLES.set(key, P);
  }
  return sol ? { ...P, sol: Uint8Array.from(sol, Number) } : P;
}
export const regionsOk = (N, reg) => reg.length === N * N && /^\d+$/.test(reg) && [...reg].every(c => +c < N);

const starsIn = (st, g) => { let n = 0; for (const c of g.cells) if (st[c] === 1) n++; return n; };
const unknownIn = (st, g) => g.cells.filter(c => st[c] === 0);
/** Whether an unknown cell could still hold a star: no star beside it. */
const isFree = (P, st, c) => { if (st[c] !== 0) return false; for (const d of P.nbr[c]) if (st[d] === 1) return false; return true; };
const freeIn = (P, st, g) => g.cells.filter(c => isFree(P, st, c));

// ---------- placements: the ways a group can still hold its stars ----------
/** Every way `need` more stars can go in the free cells of a group with no two touching. */
function placements(P, st, g, need, limit = 5000) {
  const free = freeIn(P, st, g), out = [], pick = [];
  const go = from => {
    if (out.length >= limit) return;
    if (pick.length === need) { out.push(pick.slice()); return; }
    for (let i = from; i < free.length; i++) {
      const c = free[i];
      if (pick.some(p => P.nbr[c].includes(p))) continue;
      pick.push(c); go(i + 1); pick.pop();
    }
  };
  go(0);
  return out;
}
/** Whether a group can still hold its stars (it has some arrangement left). */
function feasible(P, st, g) {
  const need = P.k - starsIn(st, g);
  if (need <= 0) return need === 0;
  const free = freeIn(P, st, g);
  if (free.length < need) return false;
  if (need === 1) return true;
  const pick = [];
  const go = from => {
    if (pick.length === need) return true;
    for (let i = from; i < free.length; i++) {
      const c = free[i];
      if (pick.some(p => P.nbr[c].includes(p))) continue;
      pick.push(c); if (go(i + 1)) return true; pick.pop();
    }
    return false;
  };
  return go(0);
}
/** The first group a state breaks, or null: two stars touching, too many in a group, or a group with no room left. */
function contradiction(P, st, only = null) {
  for (const g of (only || P.groups)) {
    const n = starsIn(st, g);
    if (n > P.k) return { why: "many", group: g };
    if (n < P.k && !feasible(P, st, g)) return { why: "room", group: g };
  }
  return null;
}
const touching = (P, st) => { for (let x = 0; x < st.length; x++) if (st[x] === 1) for (const d of P.nbr[x]) if (d > x && st[d] === 1) return [x, d]; return null; };

// ---------- the steps a person takes, the simplest first ----------
// level 0: what a star, a full group and a group with just enough cells force
// level 1: a group's few arrangements, a star that would leave a group no room, a region or line confined to one line or region
// level 2: the same counting across two lines or regions, and a short trial (a cell supposed, its consequences followed
// a few rounds until a rule breaks)
// level 3: the counting across three, and a longer trial, followed through the level-1 steps too
const need = (P, st, g) => P.k - starsIn(st, g);

function basic(P, st) {
  for (const g of P.groups) {
    const n = need(P, st, g), unk = unknownIn(st, g);
    if (n > 0 && unk.length === n) return { level: 0, tech: "only", set: unk.map(c => [c, 1]), group: g, cells: g.cells };
  }
  for (const g of P.groups) {
    const unk = unknownIn(st, g);
    if (unk.length && need(P, st, g) === 0) return { level: 0, tech: "full", set: unk.map(c => [c, 2]), group: g, cells: g.cells };
  }
  for (let c = 0; c < st.length; c++) {
    if (st[c] !== 1) continue;
    const set = [];
    for (const d of P.nbr[c]) if (st[d] === 0) set.push([d, 2]);
    if (set.length) return { level: 0, tech: "touch", set, cells: [c], from: c };
  }
  return null;
}

/** A group whose arrangements leave cells empty (or full) in every one. */
function pattern(P, st) {
  for (const g of P.groups) {
    const n = need(P, st, g);
    if (n < 2) continue;
    const all = placements(P, st, g, n);
    if (!all.length) continue;
    const times = new Map();
    for (const a of all) for (const c of a) times.set(c, (times.get(c) || 0) + 1);
    const set = [];
    for (const c of unknownIn(st, g)) {
      const t = times.get(c) || 0;
      if (t === all.length) set.push([c, 1]); else if (t === 0) set.push([c, 2]);
    }
    if (set.length) return { level: 1, tech: "pattern", set, group: g, cells: g.cells, ways: all.length, need: n };
  }
  return null;
}

/** A cell where a star would leave some group with no room for its stars. */
function look(P, st) {
  for (let c = 0; c < st.length; c++) {
    if (!isFree(P, st, c)) continue;
    const s2 = st.slice();
    s2[c] = 1;
    const touched = new Set(P.of[c]);
    for (const d of P.nbr[c]) { s2[d] = 2; for (const g of P.of[d]) touched.add(g); }
    for (const gi of P.of[c]) {
      const g = P.groups[gi];
      if (starsIn(s2, g) === P.k) for (const x of g.cells) if (s2[x] === 0) { s2[x] = 2; for (const h of P.of[x]) touched.add(h); }
    }
    const gone = contradiction(P, s2, [...touched].map(i => P.groups[i]));
    if (gone) return { level: 1, tech: "look", set: [[c, 2]], group: gone.group, cells: [c, ...gone.group.cells], why: gone.why };
  }
  return null;
}

/** Lines and regions that must hold the same stars. If the regions lying wholly inside some lines need as many stars as
 *  the lines do, the lines' other cells are empty; and the same the other way round. `s` lines (or regions) at a time. */
function counting(P, st, s) {
  const N = P.N, open = P.groups.map(g => unknownIn(st, g));
  const needs = P.groups.map((g, i) => (open[i].length ? need(P, st, g) : 0));
  const inReg = Array.from({ length: 2 * N }, () => new Int16Array(N));        // open cells of a line in a region
  for (let i = 0; i < 2 * N; i++) for (const c of open[i]) inReg[i][P.reg[c]]++;
  for (const o of [0, N]) {
    const subsets = pickSets(N, s);
    for (const S of subsets) {
      const lines = S.map(i => o + i);
      const cells = new Set(lines.flatMap(l => open[l]));
      const needL = lines.reduce((t, l) => t + needs[l], 0);
      if (needL <= 0) continue;
      // regions wholly inside the lines
      const inside = [];
      for (let r = 0; r < N; r++) {
        const total = open[2 * N + r].length;
        if (total && needs[2 * N + r] > 0 && S.reduce((t, i) => t + inReg[o + i][r], 0) === total) inside.push(r);
      }
      if (inside.length && inside.reduce((t, r) => t + needs[2 * N + r], 0) === needL) {
        const keep = new Set(inside);
        const set = [...cells].filter(c => !keep.has(P.reg[c])).map(c => [c, 2]);
        if (set.length) return { level: s === 1 ? 1 : s === 2 ? 2 : 3, tech: "count", dir: "regions-in-lines", orient: o ? "col" : "row", lines: S, regions: inside, stars: needL, set, cells: [...lines.flatMap(l => P.groups[l].cells), ...inside.flatMap(r => P.groups[2 * N + r].cells)] };
      }
    }
    // the other way: lines wholly inside regions
    for (const S of subsets) {
      const regs = S, rcells = regs.flatMap(r => open[2 * N + r]);
      const needR = regs.reduce((t, r) => t + needs[2 * N + r], 0);
      if (needR <= 0) continue;
      const inside = [];
      for (let i = 0; i < N; i++) {
        const total = open[o + i].length;
        if (total && needs[o + i] > 0 && regs.reduce((t, r) => t + inReg[o + i][r], 0) === total) inside.push(i);
      }
      if (inside.length && inside.reduce((t, i) => t + needs[o + i], 0) === needR) {
        const gone = new Set(inside.flatMap(i => open[o + i]));
        const set = rcells.filter(c => !gone.has(c)).map(c => [c, 2]);
        if (set.length) return { level: s === 1 ? 1 : s === 2 ? 2 : 3, tech: "count", dir: "lines-in-regions", orient: o ? "col" : "row", lines: inside, regions: regs, stars: needR, set, cells: [...inside.flatMap(i => P.groups[o + i].cells), ...regs.flatMap(r => P.groups[2 * N + r].cells)] };
      }
    }
  }
  return null;
}
const SETS = new Map();
function pickSets(N, s) {
  const key = `${N}.${s}`;
  if (!SETS.has(key)) {
    const out = [], pick = [];
    const go = from => { if (pick.length === s) { out.push(pick.slice()); return; } for (let i = from; i < N; i++) { pick.push(i); go(i + 1); pick.pop(); } };
    go(0);
    SETS.set(key, out);
  }
  return SETS.get(key);
}

/** Follows what a supposed cell forces with the steps up to `power` (0: the level-0 steps; 1: all but the trials and the
 *  look) until a rule breaks. Returns the rounds it took, or 0 if it never does. */
function follow(P, st, power) {
  let rounds = 0;
  for (;;) {
    const bad = touching(P, st) || contradiction(P, st);
    if (bad) return rounds || 1;
    const step = basic(P, st) || (power >= 1 && (pattern(P, st) || counting(P, st, 1) || counting(P, st, 2)));
    if (!step) return 0;
    for (const [c, m] of step.set) st[c] = m;
    rounds++;
  }
}
/** A cell supposed a star (or empty) and followed until a rule breaks: it is the other. The quickest found. */
function trial(P, st, power, within = Infinity, level = power === 0 ? 2 : 3) {
  let best = null;
  for (let c = 0; c < st.length; c++) {
    if (st[c] !== 0) continue;
    for (const v of [1, 2]) {
      const s2 = st.slice();
      s2[c] = v;
      const r = follow(P, s2, power);
      if (r && r <= within && (!best || r < best.rounds)) best = { level, tech: "trial", set: [[c, 3 - v]], supposed: v, rounds: r, cells: [c] };
    }
  }
  return best;
}

/** The simplest step that makes a mark, or null. */
export function findStep(P, st, maxLevel = 3) {
  const a = basic(P, st);
  if (a || maxLevel < 1) return a;
  const b = counting(P, st, 1) || pattern(P, st) || look(P, st);
  if (b || maxLevel < 2) return b;
  const c = counting(P, st, 2) || trial(P, st, 0, SHORT);
  if (c || maxLevel < 3) return c;
  return counting(P, st, 3) || trial(P, st, 0, Infinity, 3) || trial(P, st, 1);
}

const applied = (st, step) => { for (const [c, m] of step.set) st[c] = m; };
/** Solves from a state with the steps up to `maxLevel`: whether it got there, the hardest level it used, the steps. */
export function solveAs(P, maxLevel = 3, from = null) {
  const st = from ? Int8Array.from(from) : new Int8Array(P.N * P.N);
  let level = 0, steps = 0;
  for (;;) {
    const step = findStep(P, st, maxLevel);
    if (!step) break;
    applied(st, step);
    level = Math.max(level, step.level);
    steps++;
  }
  const solved = P.groups.every(g => starsIn(st, g) === P.k) && !touching(P, st);
  return { st, solved, level, steps };
}
/** The level a puzzle is: the hardest step reasoning needs, or -1 if reasoning alone doesn't finish it. */
export function gradeOf(P) { const r = solveAs(P, 3); return r.solved ? r.level : -1; }

// ---------- the answer: a plain search, nothing of the solver's ----------
/** Up to `limit` answers, found row by row. */
export function answers(P, limit = 2) {
  const { N, k } = P, out = [], rows = [];
  const combos = [];
  const mk = (from, pick) => { if (pick.length === k) { combos.push(pick.slice()); return; } for (let c = from; c < N; c++) { pick.push(c); mk(c + 2, pick); pick.pop(); } };
  mk(0, []);
  const col = new Int8Array(N), reg = new Int8Array(N);
  // cells a region still has in the rows below row r
  const below = Array.from({ length: N + 1 }, () => new Int16Array(N));
  for (let r = N - 1; r >= 0; r--) { below[r].set(below[r + 1]); for (let c = 0; c < N; c++) below[r][P.reg[r * N + c]]++; }
  const go = r => {
    if (out.length >= limit) return;
    if (r === N) { out.push(rows.flatMap((cb, rr) => cb.map(c => rr * N + c))); return; }
    for (const cb of combos) {
      const prev = rows[r - 1];
      if (prev && cb.some(c => prev.some(p => Math.abs(p - c) < 2))) continue;
      let used = 0, ok = true;
      for (const c of cb) {
        const g = P.reg[r * N + c];
        col[c]++; reg[g]++; used++;
        if (col[c] > k || reg[g] > k) { ok = false; break; }
      }
      if (ok) {
        rows.push(cb);
        let fine = true;
        for (let c = 0; c < N && fine; c++) if (k - col[c] > N - 1 - r) fine = false;
        for (let g = 0; g < N && fine; g++) if (k - reg[g] > below[r + 1][g]) fine = false;
        if (fine) go(r + 1);
        rows.pop();
      }
      for (let i = 0; i < used; i++) { const c = cb[i]; col[c]--; reg[P.reg[r * N + c]]--; }
      if (out.length >= limit) return;
    }
  };
  go(0);
  return out;
}

// ---------- making a puzzle ----------
/** A random arrangement of K stars a row and column, none touching: cells, or null. */
function randomStars(N, k, rng) {
  const rows = [], col = new Int8Array(N), combos = [];
  const mk = (from, pick) => { if (pick.length === k) { combos.push(pick.slice()); return; } for (let c = from; c < N; c++) { pick.push(c); mk(c + 2, pick); pick.pop(); } };
  mk(0, []);
  let budget = 4000;
  const go = r => {
    if (--budget < 0) return false;
    if (r === N) return true;
    for (const cb of shuffle(combos.slice(), rng)) {
      const prev = rows[r - 1];
      if (prev && cb.some(c => prev.some(p => Math.abs(p - c) < 2))) continue;
      if (cb.some(c => col[c] >= k)) continue;
      for (const c of cb) col[c]++;
      rows.push(cb);
      let fine = true;
      for (let c = 0; c < N && fine; c++) if (k - col[c] > N - 1 - r) fine = false;
      if (fine && go(r + 1)) return true;
      rows.pop();
      for (const c of cb) col[c]--;
    }
    return false;
  };
  return go(0) ? rows.flatMap((cb, r) => cb.map(c => r * N + c)) : null;
}

/** Regions round a set of stars: each region holds K of them, joined by a path if K is 2, then every region grows cell by
 *  cell. `spread` makes the sizes uneven: a high one leaves some regions as small as their stars. */
function regionsAround(N, k, stars, rng, spread) {
  const reg = new Int8Array(N * N).fill(-1);
  const pairs = [];
  if (k === 1) for (const s of stars) pairs.push([s]);
  else {
    const left = shuffle(stars.slice(), rng), dist = (a, b) => Math.abs(Math.floor(a / N) - Math.floor(b / N)) + Math.abs((a % N) - (b % N));
    while (left.length) {
      const a = left.pop();
      let bi = 0, bd = 1e9;
      left.forEach((b, i) => { const d = dist(a, b) + rng() * 3; if (d < bd) { bd = d; bi = i; } });
      pairs.push([a, left.splice(bi, 1)[0]]);
    }
  }
  shuffle(pairs, rng);
  pairs.forEach((p, i) => { for (const s of p) reg[s] = i; });
  const four = x => { const r = Math.floor(x / N), c = x % N, a = []; if (r > 0) a.push(x - N); if (r < N - 1) a.push(x + N); if (c > 0) a.push(x - 1); if (c < N - 1) a.push(x + 1); return a; };
  if (k === 2) {
    for (let i = 0; i < pairs.length; i++) {      // a path from one star to the other through cells nobody has
      const [a, b] = pairs[i], from = new Map([[a, -1]]), queue = [a];
      for (let q = 0; q < queue.length && !from.has(b); q++) for (const y of shuffle(four(queue[q]), rng)) if (!from.has(y) && (reg[y] < 0 || y === b)) { from.set(y, queue[q]); queue.push(y); }
      if (!from.has(b)) return null;
      for (let x = from.get(b); x >= 0; x = from.get(x)) reg[x] = i;
    }
  }
  const weight = pairs.map(() => 0.15 + rng() ** (1 + spread) * 2);
  const front = pairs.map((_, i) => { const f = new Set(); reg.forEach((r, x) => { if (r === i) for (const y of four(x)) if (reg[y] < 0) f.add(y); }); return f; });
  let free = reg.filter(r => r < 0).length;
  while (free > 0) {
    let total = 0;
    for (let i = 0; i < pairs.length; i++) if (front[i].size) total += weight[i];
    if (!total) return null;
    let t = rng() * total, pick = 0;
    for (let i = 0; i < pairs.length; i++) if (front[i].size) { t -= weight[i]; pick = i; if (t <= 0) break; }
    const cells = [...front[pick]], x = cells[Math.floor(rng() * cells.length)];
    reg[x] = pick; free--;
    for (const f of front) f.delete(x);
    for (const y of four(x)) if (reg[y] < 0) front[pick].add(y);
  }
  return reg;
}

const connected = (N, reg, r, without) => {
  const cells = []; reg.forEach((v, x) => { if (v === r && x !== without) cells.push(x); });
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), queue = [cells[0]];
  for (let q = 0; q < queue.length; q++) {
    const x = queue[q], rr = Math.floor(x / N), c = x % N;
    for (const y of [rr > 0 && x - N, rr < N - 1 && x + N, c > 0 && x - 1, c < N - 1 && x + 1]) if (y !== false && reg[y] === r && y !== without && !seen.has(y)) { seen.add(y); queue.push(y); }
  }
  return seen.size === cells.length;
};

/** Mends a region map until it has the one answer it was made from: a second answer has a star in a cell ours has not;
 *  that cell joins a neighbouring region, which gives the second answer a region with too many stars. */
function mend(N, k, reg, sol, rng) {
  const mine = new Set(sol), key = sol.slice().sort((x, y) => x - y).join();
  for (let t = 0; t < 90; t++) {
    const P = puzzleOf(N, k, Array.from(reg).join("")), found = answers(P, 2);
    if (!found.length) return null;
    const other = found.find(a => a.slice().sort((x, y) => x - y).join() !== key);
    if (!other) return reg;
    const tries = [];
    for (const c of other) {
      if (mine.has(c)) continue;
      const r = Math.floor(c / N), col = c % N;
      for (const y of [r > 0 && c - N, r < N - 1 && c + N, col > 0 && c - 1, col < N - 1 && c + 1]) if (y !== false && reg[y] !== reg[c]) tries.push([c, reg[y]]);
    }
    shuffle(tries, rng);
    const use = tries.find(([c]) => connected(N, reg, reg[c], c));
    if (!use) return null;
    reg[use[0]] = use[1];
  }
  return null;
}

/** A region map one boundary cell different that still has the one answer, or null. */
function moved(N, k, reg, stars, rng) {
  const mine = new Set(stars), cells = [];
  for (let c = 0; c < N * N; c++) {
    if (mine.has(c)) continue;
    const r = Math.floor(c / N), col = c % N;
    for (const y of [r > 0 && c - N, r < N - 1 && c + N, col > 0 && c - 1, col < N - 1 && c + 1]) if (y !== false && reg[y] !== reg[c]) cells.push([c, reg[y]]);
  }
  shuffle(cells, rng);
  for (const [c, to] of cells.slice(0, 6)) {
    if (!connected(N, reg, reg[c], c)) continue;
    const next = Int8Array.from(reg);
    next[c] = to;
    const found = answers(puzzleOf(N, k, Array.from(next).join("")), 2);
    if (found.length === 1) return next;
  }
  return null;
}

/** A puzzle of the size and star count, steered towards the level asked: { size, k, reg, sol, level }, or null. */
export function generate(seed, N, k, level) {
  const want = Math.max(0, ORDER.indexOf(level)), rng = rngOf(seed);
  let best = null, work = 0;
  const cap = k === 2 ? WORK / 3 : WORK;               // (two stars grade slowly)
  for (let t = 0; t < TRIES && work < cap; t++) {
    const stars = randomStars(N, k, rng);
    if (!stars) continue;
    const spread = want === 0 ? 3 : want === 1 ? 2 : rng() * 2;
    const reg = regionsAround(N, k, stars, rng, spread);
    if (!reg) continue;
    const mended = mend(N, k, reg, stars, rng);
    if (!mended) continue;
    let text = Array.from(mended).join(""), got = gradeOf(puzzleOf(N, k, text));
    work++;
    if (got < 0) continue;
    // not the level yet: move region boundaries a cell at a time, keeping the one answer, towards it
    for (let m = 0; m < MOVES && got !== want && work < cap; m++) {
      const next = moved(N, k, mended, stars, rng);
      if (!next) continue;
      const g = gradeOf(puzzleOf(N, k, Array.from(next).join("")));
      work++;
      if (g >= 0 && Math.abs(g - want) <= Math.abs(got - want)) { mended.set(next); got = g; text = Array.from(next).join(""); }
    }
    const found = { size: N, k, reg: text, sol: Array.from({ length: N * N }, (_, x) => (stars.includes(x) ? 1 : 0)).join(""), level: ORDER[got] };
    if (got === want) return found;
    if (!best || Math.abs(got - want) < Math.abs(ORDER.indexOf(best.level) - want)) best = found;
  }
  return best;
}
/** The level asked for, or Medium if it is not one. */
export const levelOn = (size, k, level) => (LEVELS[level] ? level : "medium");

// ---------- marks ----------
export const nextMark = m => (m === NONE ? DOT : m === DOT ? STAR : NONE);
export const withMark = (marks, i, m) => marks.slice(0, i) + m + marks.slice(i + 1);
const stateOf = marks => Int8Array.from(marks, Number);
/** The stars in the marks are the answer: the puzzle is solved the moment they are, however the dots lie. */
export function solvedBy(P, marks) {
  for (let x = 0; x < marks.length; x++) if ((marks[x] === STAR) !== (P.sol[x] === 1)) return false;
  return true;
}

/** What the marks break, from the rules alone (never the answer): stars that touch, a group with too many stars, a group
 *  with no room left for its stars. `bad` is the cells to colour. */
export function breaks(P, marks) {
  const st = stateOf(marks), bad = new Set(), over = [], short = [];
  for (let x = 0; x < st.length; x++) if (st[x] === 1) for (const d of P.nbr[x]) if (st[d] === 1) { bad.add(x); bad.add(d); }
  const touch = [...bad];
  P.groups.forEach((g, i) => {
    const n = starsIn(st, g);
    if (n > P.k) { over.push(i); for (const c of g.cells) if (st[c] === 1) bad.add(c); }
    else if (n < P.k) {
      let room = n;
      for (const c of g.cells) if (isFree(P, st, c)) room++;
      if (room < P.k) short.push(i);
    }
  });
  return { bad, touch, over, short };
}

// ---------- hints ----------
/** A hint: a mark that is wrong first (`wrong`, and what it should be), else the next step a person would take (`step`),
 *  else (when reasoning has nothing from here) one star of the answer (`reveal`). */
export function hintFor(P, marks) {
  for (let x = 0; x < marks.length; x++) {
    if (marks[x] === STAR && P.sol[x] !== 1) return { wrong: x, should: DOT };
    if (marks[x] === DOT && P.sol[x] === 1) return { wrong: x, should: STAR };
  }
  const step = findStep(P, stateOf(marks), 3);
  if (step) return { step };
  for (let x = 0; x < marks.length; x++) if (P.sol[x] === 1 && marks[x] !== STAR) return { reveal: x, should: STAR };
  return null;
}

// ---------- a dotting stroke held to one line ----------
/** Half a cell: how far a stroke goes before it picks row or column. */
export const LOCK_AT = 0.5;
/** The lead the way it moves more must have over the other to pick an axis (a diagonal wobble waits), and the distance at which it is picked anyway. */
const LOCK_RATIO = 1.5, LOCK_FORCE = 1.5;
export const newAxisStroke = (N, c, r, px, py) => ({ N, c, r, px, py, axis: null, at: null });
/**
 * A stroke follows the row or the column through the cell it began on, so a finger that wanders still dots a straight
 * line. The axis is chosen once, when the point (board units: a cell is 1 wide) is half a cell from where the press
 * began, as the way it has moved more, and never changes: to turn, lift and start again. Only the point's place along
 * that line counts (clamped to the board), and every cell between the last place and this one is returned, in order, so
 * a fast finger skips none. Returns the new cells' indexes (empty before the lock and while the finger stays in a cell).
 */
export function axisStroke(st, x, y) {
  const { N, c, r } = st;
  if (!st.axis) {
    const dx = x - st.px, dy = y - st.py;
    const major = Math.max(Math.abs(dx), Math.abs(dy)), minor = Math.min(Math.abs(dx), Math.abs(dy));
    if (major < LOCK_AT || (major < LOCK_FORCE && major < LOCK_RATIO * minor)) return [];   // (a clear lead, else wait for one)
    st.axis = Math.abs(dx) >= Math.abs(dy) ? "row" : "col";
    st.at = st.axis === "row" ? c : r;
  }
  const t = Math.min(N - 1, Math.max(0, Math.floor(st.axis === "row" ? x : y)));
  const out = [], dir = Math.sign(t - st.at);
  for (let i = st.at + dir; dir && i !== t + dir; i += dir) out.push(st.axis === "row" ? r * N + i : i * N + c);
  st.at = t;
  return out;
}
