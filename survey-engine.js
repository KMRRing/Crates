// Survey's rules, pure (no page): a block of rock, n cubes each way, hides a body of ore. Seismic readings are printed
// on its faces, one for every straight row of cubes through it, in all three directions: how many of that row's cubes
// are ore, and (with the seams marked) whether the ore lies in one seam, two, or three or more. You chip away the waste
// rock, a cube at a time from the outside in, and what is left is the ore. A cube chipped that was ore stays and
// costs a strike; marking cubes you are sure of costs nothing. Every puzzle has exactly one answer and can be got
// to by reasoning along the rows alone, without a guess (the generator checks both); a hint says which cube the rows
// force next. The page (survey.js, survey-3d.js) draws it and runs the clock; tests/survey.mjs checks this.
//
// A cube's number is x + n(y + nz). A row ("line") is the n cubes along one axis a (0 x, 1 y, 2 z) at the other two
// coordinates (u, v), which are the axes (a+1)%3 and (a+2)%3; its number is a n² + u n + v.

export const SIZES = {
  small: { label: "Small", n: 3, depth: [2, 3] },     // depth: how many steps of reasoning at the least, for seams marked and for counts only
  medium: { label: "Medium", n: 4, depth: [3, 4] },
  large: { label: "Large", n: 5, depth: [3, 5] },
  vast: { label: "Vast", n: 6, depth: [4, 6] },
};
export const READINGS = { seams: "Seams marked", counts: "Counts only" };
export const STRIKE = 20;      // seconds added to your time for a cube chipped that was ore
export const HINT = 30;        // and for a hint

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];

export const cellAt = (n, x, y, z) => x + n * (y + n * z);
export const coordsOf = (n, i) => [i % n, Math.floor(i / n) % n, Math.floor(i / (n * n))];
/** The cubes of every row of a block: lines[k] = [n cube numbers], in order along the row. */
const LINES = new Map();
export function linesOf(n) {
  if (LINES.has(n)) return LINES.get(n);
  const out = [];
  for (let a = 0; a < 3; a++) for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
    const cells = [];
    for (let i = 0; i < n; i++) { const p = [0, 0, 0]; p[a] = i; p[(a + 1) % 3] = u; p[(a + 2) % 3] = v; cells.push(cellAt(n, p[0], p[1], p[2])); }
    out.push({ a, u, v, cells });
  }
  LINES.set(n, out);
  return out;
}
/** The three rows through a cube, as row numbers. */
export function linesThrough(n, i) {
  const p = coordsOf(n, i);
  return [0, 1, 2].map(a => a * n * n + p[(a + 1) % 3] * n + p[(a + 2) % 3]);
}

// ---------- what a row can be ----------
const popcount = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const seamsOf = m => popcount(m & ~(m << 1));                 // runs of ore: where one starts, the cube before it is not ore
const PATTERNS = new Map();
/** Every row (bit i: the i-th cube is ore) with c ore cubes and, if g >= 0, g seams (3: three or more). */
function patterns(n, c, g) {
  const key = `${n},${c},${g}`;
  if (PATTERNS.has(key)) return PATTERNS.get(key);
  const out = [];
  for (let m = 0; m < 1 << n; m++) if (popcount(m) === c) { const s = seamsOf(m); if (g < 0 || (g === 3 ? s >= 3 : s === g)) out.push(m); }
  PATTERNS.set(key, out);
  return out;
}
/** The readings of a layout: [{ c (ore cubes), g (seams: 0 for none, 1, 2, 3 for three or more) }] for every row. */
export function readingsOf(n, ore) {
  return linesOf(n).map(l => { let m = 0; l.cells.forEach((c, i) => { if (ore[c]) m |= 1 << i; }); return { c: popcount(m), g: m ? Math.min(3, seamsOf(m)) : 0 }; });
}

/**
 * What the rows force, given what is known (st: -1 unknown, 0 waste, 1 ore, for every cube): the cubes whose value
 * every row pattern that fits agrees on, [{ cell, v, line }], or null if some row has no pattern that fits (what is
 * known contradicts the readings). seams false: the readings give the counts only.
 */
export function forced(n, clues, seams, st) {
  const L = linesOf(n), full = (1 << n) - 1, out = [], seen = new Set();
  for (let k = 0; k < L.length; k++) {
    let om = 0, wm = 0;
    L[k].cells.forEach((c, i) => { if (st[c] === 1) om |= 1 << i; else if (st[c] === 0) wm |= 1 << i; });
    let and = full, or = 0, any = false;
    for (const p of patterns(n, clues[k].c, seams ? clues[k].g : -1)) if ((p & wm) === 0 && (p & om) === om) { and &= p; or |= p; any = true; }
    if (!any) return null;
    for (let i = 0; i < n; i++) {
      const c = L[k].cells[i];
      if (st[c] >= 0 || seen.has(c)) continue;
      if (and >> i & 1) { out.push({ cell: c, v: 1, line: k }); seen.add(c); }
      else if (!(or >> i & 1)) { out.push({ cell: c, v: 0, line: k }); seen.add(c); }
    }
  }
  return out;
}
/** Reasons along the rows until nothing more follows: { st, depth } (depth: the rounds of reasoning, each using only what the round before settled), or null on a contradiction. */
export function reason(n, clues, seams, st0 = null) {
  const st = st0 ? Int8Array.from(st0) : new Int8Array(n * n * n).fill(-1);
  let depth = 0;
  for (;;) {
    const f = forced(n, clues, seams, st);
    if (!f) return null;
    if (!f.length) break;
    for (const { cell, v } of f) st[cell] = v;
    depth++;
  }
  return { st, depth, solved: !st.includes(-1) };
}

// ---------- a puzzle ----------
/** A body of ore grown from one cube by adding a neighbour of a cube it has, to `target` cubes. */
function grow(n, r, target) {
  const ore = new Uint8Array(n ** 3), cells = [];
  const first = [Math.floor(r() * n), Math.floor(r() * n), Math.floor(r() * n)];
  ore[cellAt(n, ...first)] = 1; cells.push(first);
  for (let guard = 0; cells.length < target && guard < 4000; guard++) {
    const [cx, cy, cz] = cells[Math.floor(r() * cells.length)], d = AXES[Math.floor(r() * 6)];
    const x = cx + d[0], y = cy + d[1], z = cz + d[2];
    if (x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n || ore[cellAt(n, x, y, z)]) continue;
    ore[cellAt(n, x, y, z)] = 1; cells.push([x, y, z]);
  }
  return ore;
}
/** One to three bodies, then fractured a little: some ore broken off, some waste turned to ore beside it. */
function layout(n, r) {
  const target = Math.max(4, Math.round(n ** 3 * 0.5 * (0.85 + 0.3 * r()))), bodies = 1 + Math.floor(r() * 3), ore = new Uint8Array(n ** 3);
  for (let b = 0; b < bodies; b++) { const body = grow(n, r, Math.max(3, Math.round(target / bodies))); for (let i = 0; i < ore.length; i++) if (body[i]) ore[i] = 1; }
  const out = ore.slice();
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = cellAt(n, x, y, z);
    if (ore[i]) { if (r() < 0.1) out[i] = 0; }
    else if (r() < 0.06 && AXES.some(d => { const a = x + d[0], b = y + d[1], c = z + d[2]; return a >= 0 && b >= 0 && c >= 0 && a < n && b < n && c < n && ore[cellAt(n, a, b, c)]; })) out[i] = 1;
  }
  return out;
}
/** Can every waste cube be chipped in the end: does each have a way out to the surface through waste? (A cube sealed inside the ore could never be reached.) */
export function reachable(n, ore) {
  const seen = new Uint8Array(n ** 3), stack = [];
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = cellAt(n, x, y, z);
    if (!ore[i] && (x === 0 || y === 0 || z === 0 || x === n - 1 || y === n - 1 || z === n - 1)) { seen[i] = 1; stack.push([x, y, z]); }
  }
  while (stack.length) {
    const [x, y, z] = stack.pop();
    for (const d of AXES) {
      const a = x + d[0], b = y + d[1], c = z + d[2];
      if (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n) continue;
      const j = cellAt(n, a, b, c);
      if (!ore[j] && !seen[j]) { seen[j] = 1; stack.push([a, b, c]); }
    }
  }
  return ore.every((o, i) => o || seen[i]);
}
/**
 * A puzzle from a seed: { seed, size, readings, n, ore (1 for ore), clues (readingsOf), depth }. The same seed makes the
 * same puzzle. It has one answer, got by reasoning along the rows (depth rounds of it) without a guess, every waste
 * cube can be reached, and it takes at least the reasoning its size and readings ask for, if some layout in the
 * first tries does (else the hardest of those).
 */
export function makePuzzle(seed, sizeId, readings = "seams") {
  const size = SIZES[sizeId] ?? SIZES.small, n = size.n, seams = readings !== "counts";
  const r = rng(mix(mix(seed, Object.keys(SIZES).indexOf(sizeId)), seams ? 0 : 1)), want = size.depth[seams ? 0 : 1];
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const ore = layout(n, r), count = ore.reduce((a, b) => a + b, 0);
    if (count < n ** 3 * 0.28 || count > n ** 3 * 0.6 || !reachable(n, ore)) continue;
    const clues = readingsOf(n, ore), got = reason(n, clues, seams);
    if (!got?.solved) continue;
    if (!best || got.depth > best.depth) best = { seed, size: sizeId, readings: seams ? "seams" : "counts", n, ore, clues, depth: got.depth };
    if (best.depth >= want || attempt >= 60) break;                 // hard enough, or out of patience for a harder one
  }
  if (!best) throw new Error("couldn't make a puzzle");
  return best;
}

// ---------- a run ----------
/** A run as the page keeps it (plain, so it saves): gone (waste chipped), shown (ore found by a strike or a hint), marked, strikes, hints, ms played, done. */
export const newRun = () => ({ gone: [], shown: [], marked: [], strikes: 0, hints: 0, ms: 0, done: false });
const set = list => new Set(list);
/** A cube still in the block and with a face to the open air (the surface, or beside a chipped cube): the only ones that can be chipped or marked. */
export function exposed(p, run, i) {
  if (run.gone.includes(i)) return false;
  const n = p.n, [x, y, z] = coordsOf(n, i), gone = set(run.gone);
  return AXES.some(d => { const a = x + d[0], b = y + d[1], c = z + d[2]; return a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n || gone.has(cellAt(n, a, b, c)); });
}
export const wasteLeft = (p, run) => p.ore.reduce((t, o) => t + (o ? 0 : 1), 0) - run.gone.length;
/**
 * Chips a cube: "chipped" (it was waste, and is gone), "strike" (it was ore: it stays, shown, and costs a strike) or "no" (gone
 * already, covered, marked or known to be ore: nothing happens). The last waste cube gone ends the run.
 */
export function chip(p, run, i) {
  if (run.done || run.marked.includes(i) || run.shown.includes(i) || !exposed(p, run, i)) return "no";
  if (p.ore[i]) { run.shown.push(i); run.strikes++; return "strike"; }
  run.gone.push(i);
  if (wasteLeft(p, run) === 0) run.done = true;
  return "chipped";
}
/** Marks a cube as ore, or takes the mark off: true if it changed. Only a cube that can be chipped, and not one already known to be ore. */
export function mark(p, run, i) {
  if (run.done || run.shown.includes(i)) return false;
  const at = run.marked.indexOf(i);
  if (at >= 0) { run.marked.splice(at, 1); return true; }
  if (!exposed(p, run, i)) return false;
  run.marked.push(i);
  return true;
}
/** What is known for sure to the player: waste chipped, ore found. (Marks are their own opinion.) */
export function known(p, run) {
  const st = new Int8Array(p.n ** 3).fill(-1);
  for (const i of run.gone) st[i] = 0;
  for (const i of run.shown) st[i] = 1;
  return st;
}
/**
 * A hint: a cube the readings and what is known force, { cell, v (0 waste, 1 ore), line (the row that says so), exposed }, a cube
 * that can be chipped (or marked) now first; null once there is nothing left to learn. It counts, and costs HINT seconds. Ore it
 * names that can be seen is shown, as if found, so it can't be chipped by mistake. `prefer(cell)` ranks the cubes it could name (the
 * page prefers those on the side turned toward you).
 */
export function hint(p, run, prefer = () => 0) {
  if (run.done) return null;
  const f = forced(p.n, p.clues, p.readings === "seams", known(p, run));
  if (!f?.length) return null;
  const gone = set(run.gone), open = f.filter(x => exposed(p, run, x.cell) && !gone.has(x.cell));
  const best = list => list.reduce((b, x) => (b == null || prefer(x.cell) > prefer(b.cell) ? x : b), null);      // the one the caller likes best (the first of equals)
  const pickFrom = best(open.filter(x => x.v === 0)) ?? best(open.filter(x => x.v === 1 && !run.shown.includes(x.cell))) ?? best(open) ?? f[0];
  run.hints++;
  const out = { ...pickFrom, exposed: open.includes(pickFrom) };
  if (out.v === 1 && out.exposed && !run.shown.includes(out.cell)) run.shown.push(out.cell);    // ore you can see is shown from now on, as if found
  return out;
}
/** A row's state in the run: the cubes still in it, and whether it is done (only ore left in it: it has no waste to chip). */
export function lineState(p, run, k) {
  const gone = set(run.gone), left = linesOf(p.n)[k].cells.filter(c => !gone.has(c)).length, { c } = p.clues[k];
  return { left, count: c, done: left === c };
}
/** Your time: seconds played, and the penalties. Lower is better. */
export const score = run => Math.round(run.ms / 1000) + STRIKE * run.strikes + HINT * run.hints;
