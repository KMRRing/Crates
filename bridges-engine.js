// Bridges (Hashiwokakero): islands numbered with how many bridges they need, joined by one or two straight bridges,
// none crossing, until every island is in one network. The rules, the puzzles and the reasoning live here, with no page
// in it: bridges-worker.js makes puzzles off the page, bridges.js plays them, tests/bridges.mjs checks it all in Node.
// Every puzzle made here has exactly one answer and is graded by the hardest step a person needs to reach it.
//
// A board is a grid string, one character a cell: "." for water, a digit for an island. A link is a place a bridge
// could go: two islands in one row or column with nothing between them (and a cell of water at least between). Links
// are numbered from the islands in reading order, each island's link to its right and then the one below it. A state
// is a bound on each link, lo (bridges that must be there) and hi (at most), and what a player keeps is one character
// a link, "0" "1" "2", the bridges drawn.

export const SIZES = [7, 9, 11];
export const LEVELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
export const ORDER = ["easy", "medium", "hard"];
export const DAILY = { size: 9, level: "medium" };
const TRIES = 600;                 // layouts tried towards a level before the nearest is dealt

// ---------- the board ----------
const LAYOUTS = new Map();
/** The islands of a grid and the links between them: { size, isl, at, links, byIsl, cross }. */
export function layoutOf(size, grid) {
  const key = `${size}:${grid}`;
  if (LAYOUTS.has(key)) return LAYOUTS.get(key);
  const isl = [], at = new Int16Array(size * size).fill(-1);
  for (let i = 0; i < grid.length; i++) if (grid[i] !== ".") { at[i] = isl.length; isl.push({ r: Math.floor(i / size), c: i % size, n: +grid[i] }); }
  const links = [], byIsl = isl.map(() => []);
  const add = (a, b, vertical) => { byIsl[a].push(links.length); byIsl[b].push(links.length); links.push({ a, b, vertical }); };
  isl.forEach((x, a) => {
    for (let c = x.c + 1; c < size; c++) { const b = at[x.r * size + c]; if (b >= 0) { if (c - x.c >= 2) add(a, b, false); break; } }
    for (let r = x.r + 1; r < size; r++) { const b = at[r * size + x.c]; if (b >= 0) { if (r - x.r >= 2) add(a, b, true); break; } }
  });
  // two links cross when one's row is strictly inside the other's rows and its column inside the other's columns
  const cross = links.map(() => []);
  links.forEach((h, i) => {
    if (h.vertical) return;
    links.forEach((v, j) => {
      if (!v.vertical) return;
      const r = isl[h.a].r, c = isl[v.a].c;
      if (c > isl[h.a].c && c < isl[h.b].c && r > isl[v.a].r && r < isl[v.b].r) { cross[i].push(j); cross[j].push(i); }
    });
  });
  const lay = { size, isl, at, links, byIsl, cross };
  LAYOUTS.set(key, lay);
  return lay;
}
/** A puzzle from its grid and, if known, its answer (a character a link, the bridges there). */
export function puzzleOf(size, grid, sol = null) {
  const lay = layoutOf(size, grid);
  return { size, grid, lay, sol: sol && Uint8Array.from(sol, Number), solMarks: sol };
}

// ---------- the rules, as a solver follows them ----------
const freshState = lay => ({
  lo: new Int8Array(lay.links.length),
  hi: Int8Array.from(lay.links, l => Math.min(2, lay.isl[l.a].n, lay.isl[l.b].n)),
});
const copyOf = st => ({ lo: st.lo.slice(), hi: st.hi.slice() });
const find = (par, x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };

/**
 * The rules followed until nothing more is settled, or for `rounds` rounds: each island's number and the bridges that
 * can't cross, and, with `net`, that all the islands must end up joined. -1 if they break, 0 otherwise; with `rec`
 * given, it stops at the first bridge that must be there and says what settled it (returns 2).
 */
function propagate(lay, st, rounds = Infinity, rec = null, net = true) {
  const { isl, links, byIsl, cross } = lay, { lo, hi } = st, nI = isl.length, L = links.length;
  for (let round = 0; round < rounds; round++) {
    let changed = false;
    // an island: its bridges add up to its number, so each link has at least what the others can't carry and at most what the others leave
    for (let i = 0; i < nI; i++) {
      const ls = byIsl[i], n = isl[i].n;
      let sl = 0, sh = 0;
      for (const l of ls) { sl += lo[l]; sh += hi[l]; }
      if (sl > n || sh < n) return -1;
      for (const l of ls) {
        const nl = n - (sh - hi[l]), nh = n - (sl - lo[l]);
        if (nl > lo[l]) {
          if (nl > hi[l]) return -1;
          sl += nl - lo[l]; lo[l] = nl; changed = true;
          if (rec) { rec.step = { tech: sh === n ? "all" : "need", at: i, link: l, to: nl }; return 2; }
        }
        if (nh < hi[l]) {
          if (nh < lo[l]) return -1;
          sh -= hi[l] - nh; hi[l] = nh; changed = true;
        }
      }
    }
    // a bridge keeps every link that would cross it empty
    for (let l = 0; l < L; l++) {
      if (!lo[l]) continue;
      for (const k of cross[l]) {
        if (lo[k]) return -1;
        if (hi[k]) { hi[k] = 0; changed = true; }
      }
    }
    if (!net) { if (!changed) return 0; continue; }
    // the network: islands joined by bridges that must be there; a group that has all its bridges and isn't all the islands is shut off
    const par = Int16Array.from({ length: nI }, (_, i) => i);
    for (let l = 0; l < L; l++) if (lo[l]) par[find(par, links[l].a)] = find(par, links[l].b);
    const size = new Int16Array(nI), need = new Int16Array(nI);
    for (let i = 0; i < nI; i++) {
      let s = 0;
      for (const l of byIsl[i]) s += lo[l];
      const root = find(par, i);
      size[root]++; need[root] += isl[i].n - s;
    }
    for (let i = 0; i < nI; i++) if (find(par, i) === i && need[i] === 0 && size[i] < nI) return -1;
    const pot = Int16Array.from({ length: nI }, (_, i) => i);      // and the islands that could ever be joined must be all of them
    for (let l = 0; l < L; l++) if (hi[l]) pot[find(pot, links[l].a)] = find(pot, links[l].b);
    for (let i = 1; i < nI; i++) if (find(pot, i) !== find(pot, 0)) return -1;
    // one more bridge on a link would shut its group off: it takes no more than it has
    for (let l = 0; l < L; l++) {
      if (hi[l] <= lo[l]) continue;
      const ra = find(par, links[l].a), rb = find(par, links[l].b);
      const sz = ra === rb ? size[ra] : size[ra] + size[rb], left = (ra === rb ? need[ra] : need[ra] + need[rb]) - 2;
      if (left === 0 && sz < nI) { hi[l] = lo[l]; changed = true; }
    }
    if (!changed) return 0;
  }
  return 0;
}
/** Every link settled, every island has its number, and the bridges join all the islands. */
function complete(lay, st) {
  const { isl, links, byIsl } = lay, { lo, hi } = st;
  for (let l = 0; l < links.length; l++) if (lo[l] !== hi[l]) return false;
  const par = Int16Array.from({ length: isl.length }, (_, i) => i);
  for (let i = 0; i < isl.length; i++) if (byIsl[i].reduce((s, l) => s + lo[l], 0) !== isl[i].n) return false;
  for (let l = 0; l < links.length; l++) if (lo[l]) par[find(par, links[l].a)] = find(par, links[l].b);
  for (let i = 1; i < isl.length; i++) if (find(par, i) !== find(par, 0)) return false;
  return true;
}

/**
 * A trial: suppose a link has at least k bridges, or at most k, and follow the rules; if they break, the opposite holds. Settles every link it can: 1 if it settled any, 0 if none, -1 if the puzzle has no answer. With
 * `rec`, it stops at the first bridge that must be there (2).
 */
function trial(lay, st, rec = null) {
  const { lo, hi } = st;
  let any = 0;
  for (let l = 0; l < lo.length; l++) {
    for (let k = lo[l] + 1; k <= hi[l]; k++) {                     // at least k: if that breaks, at most k - 1
      const t = copyOf(st);
      t.lo[l] = k;
      if (propagate(lay, t) < 0) {
        hi[l] = k - 1; any = 1;
        const p = propagate(lay, st, Infinity, rec);
        if (p < 0) return -1;
        if (p === 2) return 2;
        break;
      }
    }
    for (let k = hi[l] - 1; k >= lo[l]; k--) {                     // at most k: if that breaks, at least k + 1
      const t = copyOf(st);
      t.hi[l] = k;
      if (propagate(lay, t) < 0) {
        if (rec) { lo[l] = k + 1; rec.step = { tech: "trial", at: lay.links[l].a, link: l, to: k + 1, supposed: k }; return 2; }
        lo[l] = k + 1; any = 1;
        const p = propagate(lay, st, Infinity, rec);
        if (p < 0) return -1;
        if (p === 2) return 2;
        break;
      }
    }
  }
  return any;
}
/**
 * Solve with what a person at a level can do: 0, each island's number and the bridges that can't cross; 1, that the
 * islands must all be joined too (a group with all its bridges can't be left on its own); 2, a trial of one link as
 * well. { ok, st }; with `rec`, it stops at the first bridge that must be there ({ ok: false, raised: true }, the step
 * in rec.step).
 */
export function solveAs(lay, level, st = freshState(lay), rec = null) {
  for (;;) {
    const p = propagate(lay, st, Infinity, rec, level >= 1);
    if (p < 0) return { ok: false, st, broken: true };
    if (p === 2) return { ok: false, st, raised: true };
    if (complete(lay, st)) return { ok: true, st };
    if (level < 2) return { ok: false, st };
    const got = trial(lay, st, rec);
    if (got === 2) return { ok: false, st, raised: true };
    if (got < 0) return { ok: false, st, broken: true };
    if (!got) return { ok: false, st };
  }
}
/** The lowest level (0 to 2) that solves the puzzle by reasoning, or -1 when none does. */
export function gradeOf(lay) {
  for (let lv = 0; lv < 3; lv++) if (solveAs(lay, lv).ok) return lv;
  return -1;
}

// ---------- counting answers (the proof, and the tests') ----------
/** How many answers the board has, counted up to `limit`: a search that guesses, the rules followed after every guess. */
export function count(lay, limit = 2, st = freshState(lay)) {
  if (propagate(lay, st) < 0) return 0;
  if (complete(lay, st)) return 1;
  const l = st.lo.findIndex((v, i) => v < st.hi[i]);
  if (l < 0) return 0;
  let n = 0;
  for (let v = st.lo[l]; v <= st.hi[l]; v++) {
    const t = copyOf(st);
    t.lo[l] = t.hi[l] = v;
    n += count(lay, limit - n, t);
    if (n >= limit) break;
  }
  return n;
}
/** The answer of a board that has one, as bridges a link. */
export function answerOf(size, grid) {
  const lay = layoutOf(size, grid), r = solveAs(lay, 2);
  if (r.ok) return Array.from(r.st.lo, String).join("");
  const go = (st = freshState(lay)) => {
    if (propagate(lay, st) < 0) return null;
    if (complete(lay, st)) return st;
    const l = st.lo.findIndex((v, i) => v < st.hi[i]);
    for (let v = st.lo[l]; v <= st.hi[l]; v++) { const t = copyOf(st); t.lo[l] = t.hi[l] = v; const s = go(t); if (s) return s; }
    return null;
  };
  const s = go();
  return s ? Array.from(s.lo, String).join("") : null;
}

// ---------- making a puzzle ----------
export const rngOf = seed => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/**
 * A board with bridges already across it: islands grown from one, each joined to an earlier one by a straight run of
 * water, then more bridges between islands side by side where nothing crosses. Returns the grid and the answer.
 */
export function randomBoard(size, rng, wanted, extra) {
  const occ = new Uint8Array(size * size);                         // 0 water, 1 island, 2 a bridge over it
  const isl = [], bridges = [];
  const place = (r, c) => { occ[r * size + c] = 1; isl.push([r, c]); };
  place(Math.floor(rng() * size), Math.floor(rng() * size));
  const touchesIsland = (r, c) => DIRS.some(([dr, dc]) => { const y = r + dr, x = c + dc; return y >= 0 && y < size && x >= 0 && x < size && occ[y * size + x] === 1; });
  for (let guard = 0; isl.length < wanted && guard < wanted * 40; guard++) {
    const [r0, c0] = isl[Math.floor(rng() * isl.length)], [dr, dc] = DIRS[Math.floor(rng() * 4)];
    const reach = 2 + Math.floor(rng() * 4), ends = [];
    for (let s = 1; s <= reach; s++) {
      const r = r0 + dr * s, c = c0 + dc * s;
      if (r < 0 || r >= size || c < 0 || c >= size || occ[r * size + c]) break;
      if (s >= 2 && !touchesIsland(r, c)) ends.push(s);
    }
    if (!ends.length) continue;
    const s = ends[Math.floor(rng() * ends.length)], k = rng() < 0.35 ? 2 : 1;
    for (let t = 1; t < s; t++) occ[(r0 + dr * t) * size + c0 + dc * t] = 2;
    place(r0 + dr * s, c0 + dc * s);
    bridges.push([r0, c0, r0 + dr * s, c0 + dc * s, k]);
  }
  // extra bridges between islands side by side, over water only
  for (const [r0, c0] of isl) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    let s = 1;
    while (true) {
      const r = r0 + dr * s, c = c0 + dc * s;
      if (r >= size || c >= size || occ[r * size + c] !== 0) break;
      s++;
    }
    const r = r0 + dr * s, c = c0 + dc * s;
    if (s < 2 || r >= size || c >= size || occ[r * size + c] !== 1 || rng() >= extra) continue;
    for (let t = 1; t < s; t++) occ[(r0 + dr * t) * size + c0 + dc * t] = 2;
    bridges.push([r0, c0, r, c, rng() < 0.4 ? 2 : 1]);
  }
  const numbers = new Map(isl.map(([r, c]) => [r * size + c, 0]));
  for (const [r1, c1, r2, c2, k] of bridges) { numbers.set(r1 * size + c1, numbers.get(r1 * size + c1) + k); numbers.set(r2 * size + c2, numbers.get(r2 * size + c2) + k); }
  const grid = Array.from({ length: size * size }, (_, i) => (numbers.has(i) ? String(numbers.get(i)) : ".")).join("");
  const lay = layoutOf(size, grid), keyOf = (x, y) => `${Math.min(x, y)}:${Math.max(x, y)}`;
  const by = new Map(bridges.map(([r1, c1, r2, c2, k]) => [keyOf(r1 * size + c1, r2 * size + c2), k]));
  const sol = lay.links.map(l => by.get(keyOf(lay.isl[l.a].r * size + lay.isl[l.a].c, lay.isl[l.b].r * size + lay.isl[l.b].c)) || 0).join("");
  return { grid, sol };
}
/**
 * A puzzle of a size and level, the same for the same seed: { size, grid, sol, level } with level what it came to (the
 * nearest when the level asked for wouldn't come in the tries allowed). Boards are made at random and kept when a solver
 * of the level finishes them: that proves the answer is the only one, since every step it takes is forced.
 */
export function generate(seed, size, level) {
  const want = Math.max(0, ORDER.indexOf(level)), rng = rngOf(seed);
  let best = null;
  for (let t = 0; t < TRIES; t++) {
    const wanted = Math.round(size * size * (0.2 + rng() * 0.14)), extra = [0.45, 0.15, 0.2][want] * (0.5 + rng());
    const { grid, sol } = randomBoard(size, rng, wanted, extra), lay = layoutOf(size, grid);
    if (lay.isl.length < 4) continue;
    const got = gradeOf(lay);
    if (got < 0) continue;
    const found = { size, grid, sol, level: ORDER[got] };
    if (got === want) return found;
    if (!best || Math.abs(got - want) < Math.abs(ORDER.indexOf(best.level) - want)) best = found;
  }
  return best;
}
export const levelOn = (size, level) => (LEVELS[level] ? level : "medium");

// ---------- marks ----------
export const nextMark = m => String((+m + 1) % 3);
export const withMark = (marks, i, m) => marks.slice(0, i) + m + marks.slice(i + 1);

/** Whether the bridges drawn are the answer. */
export function solvedBy(P, marks) {
  for (let l = 0; l < P.sol.length; l++) if (+marks[l] !== P.sol[l]) return false;
  return true;
}
/** Whether drawing a bridge on a link would cross one already drawn. */
export const crossed = (P, marks, l) => P.lay.cross[l].some(k => marks[k] !== "0");
/**
 * What the marks break, from the rules alone (never the answer): the islands with more bridges than their number, the
 * islands met, and the islands in a group that has all its bridges while others are left out.
 */
export function breaks(P, marks) {
  const { isl, links, byIsl } = P.lay, over = [], met = [], cut = [];
  const par = Int16Array.from({ length: isl.length }, (_, i) => i), sum = isl.map((x, i) => { const s = byIsl[i].reduce((t, l) => t + +marks[l], 0); if (s > x.n) over.push(i); else if (s === x.n) met.push(i); return s; });
  for (let l = 0; l < links.length; l++) if (+marks[l]) par[find(par, links[l].a)] = find(par, links[l].b);
  const full = new Map(), size = new Map();
  isl.forEach((x, i) => { const r = find(par, i); size.set(r, (size.get(r) || 0) + 1); full.set(r, (full.get(r) ?? true) && sum[i] === x.n); });
  isl.forEach((x, i) => { const r = find(par, i); if (full.get(r) && size.get(r) < isl.length) cut.push(i); });
  return { over, met, cut };
}

// ---------- hints ----------
/**
 * The next thing to tell a player: a link with more bridges than the answer ({ wrong, should }); else the next bridge a
 * person would see must be there, simplest first ({ step: { tech, at, link, to, … } }); else one link of the answer
 * ({ reveal, should }).
 */
export function hintFor(P, marks) {
  const { lay } = P;
  for (let l = 0; l < P.sol.length; l++) if (+marks[l] > P.sol[l]) return { wrong: l, should: String(P.sol[l]) };
  const st = freshState(lay);
  for (let l = 0; l < P.sol.length; l++) st.lo[l] = +marks[l];
  const rec = {};
  if (solveAs(lay, 2, st, rec).raised && rec.step) return { step: rec.step };
  const l = P.sol.findIndex((v, i) => v > +marks[i]);
  return l < 0 ? null : { reveal: l, should: String(P.sol[l]) };
}
