// Shunt: the rules, pure (plain JSON state, no DOM; the page, the bots and the tests all use this file).
//
// A hexagonal plate of radius 2 (19 cells). You never place a gear: each turn the next gear of the queue is SHOVED in from the
// rim along one of the three hex axes, from either end (30 entries). If the entry cell is empty the gear lands there. Otherwise
// the block of gears from the entry end moves one step inward into the first gap and the new gear takes the entry cell; with no
// gap on the line the entry is illegal. A stud (a rivet: code -2) ends a line and never moves.
// Gears: 0, 1, 2 plain, of pitch A, B, C (the tooth size); 3 an idler (meshes every pitch); 4, 5, 6 a bridge, A+B, A+C, B+C
// (meshes the two pitches it shows; it is ONE gear, so it fuses the families it touches). Two gears that touch mesh when their
// pitch sets meet. Meshed gears turn opposite ways, so a connected group (a TRAIN) with an odd loop JAMS and turns nothing.
// A train of three or more that turns scores VALUE[n], half as much again for each jewel under it. The plate is judged when it
// is full, the queue is out, or no shove is legal. A queue shows five gears ahead; one gear may be held back (once a turn).
//
// A game's moves are a list of integers: -1 swaps the next gear with the hold, e (0..29) shoves at entry e. The state is
// always the level plus its moves (`play`), which is how the page keeps a run and a partner's watching frame draws it.

export const R = 2;
export const CELLS = [];
const IDX = {};
for (let r = -R; r <= R; r++) for (let q = -R; q <= R; q++) { if (Math.abs(q + r) > R) continue; IDX[`${q},${r}`] = CELLS.length; CELLS.push({ q, r }); }
export const N = CELLS.length;
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const at = (q, r) => { const v = IDX[`${q},${r}`]; return v === undefined ? -1 : v; };
export const NB = CELLS.map(c => DIRS.map(d => at(c.q + d[0], c.r + d[1])).filter(x => x >= 0));
const AXES = [[1, 0], [0, 1], [1, -1]];
/** The thirty ways in: { axis, d (the way the gear travels), line (the cells along it, entry first) }. */
export const ENTRIES = [];
AXES.forEach((a, ai) => CELLS.forEach(c => {
  if (at(c.q - a[0], c.r - a[1]) >= 0) return;
  const line = [];
  let q = c.q, r = c.r;
  while (at(q, r) >= 0) { line.push(at(q, r)); q += a[0]; r += a[1]; }
  ENTRIES.push({ axis: ai, d: a, line });
  ENTRIES.push({ axis: ai, d: [-a[0], -a[1]], line: line.slice().reverse() });
}));
/** The pitches a gear meshes by, as a bit set (A=1, B=2, C=4), by code. */
export const PS = [1, 2, 4, 7, 3, 5, 6];
const MESH = PS.map(a => PS.map(b => (a & b) !== 0));
export const VALUE = [0, 0, 0, 10, 16, 20, 22, 23];
export const STUD = -2, EMPTY = -1;
export const VERSION = 1;

const clone = s => ({ ...s, cells: s.cells.slice(), q: s.q.slice(), jewels: s.jewels.slice() });
/** The gear to shove now: the queue's first, or (the queue out) the held one. */
export const cur = s => (s.q.length ? s.q[0] : s.hold);
/** The cells a shove at entry e runs along, up to a stud. */
export function track(s, e) {
  const t = [];
  for (const c of ENTRIES[e].line) { if (s.cells[c] === STUD) break; t.push(c); }
  return t;
}
export function legal(s, e) {
  const t = track(s, e);
  for (let i = 0; i < t.length; i++) if (s.cells[t[i]] === EMPTY) return true;
  return false;
}
export function legalEntries(s) {
  const o = [];
  for (let e = 0; e < ENTRIES.length; e++) if (legal(s, e)) o.push(e);
  return o;
}
export const canSwap = s => !s.swapped && (s.hold >= 0 ? s.q.length > 0 : s.q.length > 1);

/** A level -> a fresh state. level: { stud:[cells], jewels:[cells], start:{cell:code}, deal:[codes], goal:{} } */
export function fresh(L) {
  const cells = new Array(N).fill(EMPTY);
  (L.stud || []).forEach(i => { cells[i] = STUD; });
  Object.keys(L.start || {}).forEach(i => { cells[+i] = L.start[i]; });
  return { v: VERSION, cells, q: L.deal.slice(), hold: -1, swapped: 0, jewels: (L.jewels || []).slice(), goal: { ...(L.goal || {}) }, turn: 0 };
}
export function swap(s) {
  const t = clone(s);
  if (t.hold < 0) t.hold = t.q.shift(); else { const x = t.q[0]; t.q[0] = t.hold; t.hold = x; }
  t.swapped = 1;
  return t;
}
/** Shove the current gear in at entry e: { s, moved:[[from, to]…], at, gear }, or null if the entry is illegal. */
export function shove(s, e) {
  const t = track(s, e);
  let gap = -1;
  for (let i = 0; i < t.length; i++) if (s.cells[t[i]] === EMPTY) { gap = i; break; }
  if (gap < 0) return null;
  const n = clone(s), moved = [], g = cur(s);
  if (n.q.length) n.q.shift(); else n.hold = -1;
  for (let k = gap; k >= 1; k--) { n.cells[t[k]] = n.cells[t[k - 1]]; moved.push([t[k - 1], t[k]]); }
  n.cells[t[0]] = g;
  n.swapped = 0;
  n.turn++;
  return { s: n, moved, at: t[0], gear: g };
}
export const over = s => cur(s) === undefined || cur(s) < 0 || legalEntries(s).length === 0;

/** One move of a game (-1 swaps, e shoves): the new state, or null if it is not allowed. */
export function step(s, m) {
  if (over(s)) return null;
  if (m === -1) return canSwap(s) ? swap(s) : null;
  if (!Number.isInteger(m) || m < 0 || m >= ENTRIES.length) return null;
  return shove(s, m)?.s || null;
}
/** The state after a list of moves from the level, or null if one of them is not allowed. */
export function play(L, moves) {
  let s = fresh(L);
  for (const m of moves) { s = step(s, m); if (!s) return null; }
  return s;
}
/** A bot's path of [swap?, entry] pairs as moves. */
export const movesOf = path => path.flatMap(([sw, e]) => (sw ? [-1, e] : [e]));

/** Trains: the groups of meshing gears, two-coloured by turning direction (sg); a JAM is an odd loop. */
export function judge(s) {
  const c = s.cells, comp = new Int16Array(N).fill(-1), sg = new Int8Array(N), comps = [];
  const jw = new Uint8Array(N);
  s.jewels.forEach(i => { jw[i] = 1; });
  let edges = 0, score = 0, jams = 0;
  for (let i = 0; i < N; i++) {
    if (c[i] < 0 || comp[i] >= 0) continue;
    const k = comps.length, list = [i];
    comp[i] = k; sg[i] = 1;
    let jam = false;
    for (let a = 0; a < list.length; a++) {
      const x = list[a];
      for (const y of NB[x]) {
        if (c[y] < 0 || !MESH[c[x]][c[y]]) continue;
        if (y > x) edges++;
        if (comp[y] < 0) { comp[y] = k; sg[y] = -sg[x]; list.push(y); } else if (sg[y] === sg[x]) jam = true;
      }
    }
    let j = 0;
    for (const x of list) j += jw[x];
    const n = list.length, value = jam || n < 3 ? 0 : VALUE[Math.min(n, 7)] * (1 + 0.5 * j);
    if (jam) jams++;
    score += value;
    comps.push({ cells: list, n, jam, j, value });
  }
  return { comp, sg, comps, score, edges, jams };
}
/** The goal's parts, each { id, have, need, ok }. */
export function goalCheck(s, J) {
  J = J || judge(s);
  const g = s.goal, parts = [];
  if (g.score != null) parts.push({ id: "score", have: J.score, need: g.score, ok: J.score >= g.score });
  if (g.trains) { const have = J.comps.filter(t => !t.jam && t.n >= g.trains.m).length; parts.push({ id: "trains", have, need: g.trains.k, ok: have >= g.trains.k }); }
  if (g.jewels) {
    const have = s.jewels.filter(j => { const t = J.comps[J.comp[j]]; return t && !t.jam && t.n >= 3; }).length;
    parts.push({ id: "jewels", have, need: s.jewels.length, ok: have >= s.jewels.length });
  }
  if (g.nojam) parts.push({ id: "nojam", have: J.jams, need: 0, ok: J.jams === 0 });
  return { parts, ok: parts.every(p => p.ok) };
}
/** What a shove does, raw material for words: trains broken (by old train), joined, new jams, the score change. */
export function effect(s, r) {
  const A = judge(s), B = judge(r.s), where = new Map(r.moved.map(m => [m[0], m[1]]));
  const broken = [], joined = [];
  A.comps.forEach(t => {
    if (t.n < 2) return;
    const now = new Set(t.cells.map(x => B.comp[where.has(x) ? where.get(x) : x]));
    if (now.size > 1) broken.push(t);
  });
  B.comps.forEach(t => {
    const olds = new Set();
    t.cells.forEach(x => { if (x === r.at) return; const from = r.moved.find(m => m[1] === x); olds.add(A.comp[from ? from[0] : x]); });
    const real = [...olds].filter(k => k >= 0 && A.comps[k].n >= 2);
    if (real.length > 1) joined.push({ t, from: real.map(k => A.comps[k]) });
  });
  return { A, B, broken, joined, moved: r.moved.length, newJams: B.comps.filter(t => t.jam).length - A.comps.filter(t => t.jam).length };
}

/** Whether a stored state is one this file made and can go on from (a stale or damaged run is let go of, never trusted). */
export function sound(s) {
  const gear = c => Number.isInteger(c) && c >= -2 && c <= 6;
  return !!s && s.v === VERSION && Array.isArray(s.cells) && s.cells.length === N && s.cells.every(gear) && Array.isArray(s.q) && s.q.every(c => gear(c) && c >= 0)
    && Number.isInteger(s.hold) && s.hold >= -1 && s.hold <= 6 && Array.isArray(s.jewels) && s.jewels.every(j => Number.isInteger(j) && j >= 0 && j < N) && !!s.goal && typeof s.goal === "object";
}
/** A state after a round through a store that keeps no empty arrays or objects (tests/rtdb.js): the missing ones put back. */
export function mend(s) {
  return { ...s, q: s.q || [], jewels: s.jewels || [], goal: s.goal || {} };
}
