// Survey's rules, pure (no page): a block of rock, n cubes each way, hides a body of ore. Seismic readings are printed
// on its faces, one for every straight row of cubes through it, in all three directions: how many of that row's cubes
// are ore, and (with the seams marked) whether the ore lies in one seam, two, or three or more, or (runs given) how long
// each seam is, in order. The rock need not fill its block (a pyramid, a cross, an arch: `present` says which cubes
// there are) and a row's reading can be left off (fog). You chip away the waste
// rock, a cube at a time from the outside in, and what is left is the ore. A cube chipped that was ore stays and
// costs a strike; marking cubes you are sure of costs nothing. Every puzzle has exactly one answer and can be got
// to by reasoning along the rows alone, without a guess (the generator checks both); a hint says which cube the rows
// force next. The page (survey.js, survey-3d.js) draws it and runs the clock; tests/survey.mjs checks this.
//
// A cube's number is x + n(y + nz). A row ("line") is the n cubes along one axis a (0 x, 1 y, 2 z) at the other two
// coordinates (u, v), which are the axes (a+1)%3 and (a+2)%3; its number is a n² + u n + v.

import { WASTE, fullOf, oreOf, targetsOf, round } from "./survey-twist.js";

export const SIZES = {
  small: { label: "Small", n: 3, depth: [2, 3] },     // depth: how many steps of reasoning at the least, for seams marked and for counts only
  medium: { label: "Medium", n: 4, depth: [3, 4] },
  large: { label: "Large", n: 5, depth: [3, 5] },
  vast: { label: "Vast", n: 6, depth: [4, 6] },
};
export const READINGS = { seams: "Seams marked", counts: "Counts only", runs: "Runs given" };
const KIND_NUMBER = { seams: 0, counts: 1, runs: 2 };        // what a block's readings add to its seed's mix: seams and counts as they always were
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
/** The lengths of the seams (runs of ore) of a row, in order (bit i: the i-th cube is ore; rows are at most 8 long). */
function runsOf(m) {
  const out = [];
  let len = 0;
  for (let i = 0; i <= 8; i++) { if (m >> i & 1) len++; else if (len) { out.push(len); len = 0; } }
  return out;
}
/** What a row reads: c (ore cubes), g (seams: 0, 1, 2, or 3 for three or more) and r (the seams' lengths). */
const readMask = m => { const r = runsOf(m); return { c: popcount(m), g: Math.min(3, r.length), r }; };
/** What the kind of reading keeps of one row's: its key, which two rows with the same reading share. */
const keyOf = (kind, cl) => (kind === "counts" ? cl.c : kind === "seams" ? cl.c * 4 + cl.g : cl.r.join(","));
const INDEX = new Map(), EVERY = new Map();
/** Every row of n cubes (bit i: the i-th cube is ore) by its reading's key, for the kind of reading. */
function indexOf(n, kind) {
  const id = `${n}/${kind}`;
  if (!INDEX.has(id)) {
    const by = new Map();
    for (let m = 0; m < 1 << n; m++) { const k = keyOf(kind, readMask(m)); if (!by.has(k)) by.set(k, []); by.get(k).push(m); }
    INDEX.set(id, by);
  }
  return INDEX.get(id);
}
/** Every row there could be: what a row with no reading (fog) might be. */
function everyRow(n) { if (!EVERY.has(n)) EVERY.set(n, Array.from({ length: 1 << n }, (_, m) => m)); return EVERY.get(n); }
/**
 * The readings of a layout: [{ c (ore cubes), g (seams: 0 for none, 1, 2, 3 for three or more), r (the seams' lengths) }] for
 * every row, null for a row with no cube in the rock. `present` (1 for a cube there) is for a rock that doesn't fill its block.
 */
export function readingsOf(n, ore, present = null) {
  return linesOf(n).map(l => {
    let m = 0, any = !present;
    l.cells.forEach((c, i) => { if (ore[c]) m |= 1 << i; if (present?.[c]) any = true; });
    return any ? readMask(m) : null;
  });
}

/**
 * What the rows force, given what is known (st: -1 unknown, 0 waste, 1 ore, for every cube): the cubes whose value
 * every row pattern that fits agrees on, [{ cell, v, line }], or null if some row has no pattern that fits (what is
 * known contradicts the readings). `frame` is { n, kind (how the rows are read), present (cubes there, or null for all) }; a
 * row whose reading is null has none to go by (fog) and can be anything the rock allows.
 */
export function forcedIn(frame, clues, st) {
  if (twisted(frame)) return forcedTwist(frame, clues, st);
  const { n, kind, present } = frame, L = linesOf(n), full = (1 << n) - 1, out = [], seen = new Set(), by = indexOf(n, kind);
  for (let k = 0; k < L.length; k++) {
    const cells = L[k].cells;
    let pm = full, om = 0, wm = 0;
    if (present) { pm = 0; cells.forEach((c, i) => { if (present[c] && !frame.hard?.[c]) pm |= 1 << i; }); if (!pm && !cells.some(c => present[c])) continue; }   // granite is in the rock but is never ore
    cells.forEach((c, i) => { if (st[c] === 1) om |= 1 << i; else if (st[c] === 0) wm |= 1 << i; });
    const list = clues[k] ? by.get(keyOf(kind, clues[k])) || [] : everyRow(n);
    let and = full, or = 0, any = false;
    for (const p of list) if ((p & ~pm) === 0 && (p & wm) === 0 && (p & om) === om) { and &= p; or |= p; any = true; }
    if (!any) return null;
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      if (st[c] >= 0 || seen.has(c) || (present && !present[c])) continue;
      if (and >> i & 1) { out.push({ cell: c, v: 1, line: k }); seen.add(c); }
      else if (!(or >> i & 1)) { out.push({ cell: c, v: 0, line: k }); seen.add(c); }
    }
  }
  return out;
}
/** Reasons along the rows until nothing more follows: { st, depth } (depth: the rounds of reasoning, each using only what the round before settled), or null on a contradiction. */
export function reasonIn(frame, clues, st0 = null) {
  if (twisted(frame)) return reasonTwist(frame, clues, st0);
  const { n, present } = frame, st = st0 ? Int8Array.from(st0) : new Int8Array(n * n * n).fill(-1);
  if (present && !st0) for (let i = 0; i < st.length; i++) if (!present[i] || frame.hard?.[i]) st[i] = 0;        // no cube there, or granite: nothing to find
  let depth = 0;
  for (;;) {
    const f = forcedIn(frame, clues, st);
    if (!f) return null;
    if (!f.length) break;
    for (const { cell, v } of f) st[cell] = v;
    depth++;
  }
  return { st, depth, solved: !st.includes(-1) };
}
/** A full block read by seams (or counts only): the first form of the rules, kept for the callers that only ever had that. */
export const forced = (n, clues, seams, st) => forcedIn({ n, kind: seams ? "seams" : "counts", present: null }, clues, st);
export const reason = (n, clues, seams, st0 = null) => reasonIn({ n, kind: seams ? "seams" : "counts", present: null }, clues, st0);
/** The frame of a puzzle's rules. */
export const frameOf = p => ({ n: p.n, kind: p.kind, present: p.present, hard: p.hard, ores: p.ores, cut: p.cut, lamps: p.lamps });

// ---------- the twists: two ores, a fault ----------
/** Whether the readings need the three-state solver (two ores, or rows read in two halves by a fault). */
const twisted = f => f.ores === 2 || !!f.cut;
const TYPE = [WASTE, 2, 4, 6];                       // what a known state (0 waste, 1 silver or ore, 2 gold, 3 ore of either kind) leaves a cube
/** The masks of what every cube may be, from what is known (st: -1 unknown, 0 waste, 1 silver or ore, 2 gold, 3 ore of either kind). */
function domOf(frame, st) {
  const { n, present, hard } = frame, dom = new Uint8Array(n ** 3);
  for (let i = 0; i < dom.length; i++) dom[i] = (present && !present[i]) || hard?.[i] ? WASTE : st[i] < 0 ? fullOf(frame) : TYPE[st[i]] & fullOf(frame);
  return dom;
}
/** A mask as what it settles: 0 waste, 1 ore, -1 not yet. */
const classOf = (frame, m) => (m === WASTE ? 0 : (m & WASTE) === 0 && m ? 1 : -1);
function forcedTwist(frame, clues, st) {
  const dom = domOf(frame, st), r = round(frame, linesOf(frame.n), clues, dom);
  if (!r) return null;
  const out = [];
  for (let i = 0; i < dom.length; i++) {
    if (st[i] >= 0 || frame.hard?.[i] || (frame.present && !frame.present[i]) || r.dom[i] === dom[i]) continue;
    const c = classOf(frame, r.dom[i]);
    if (c >= 0) out.push({ cell: i, v: c, line: rowOf(frame, clues, i, dom) });
  }
  return out;
}
/** A row through a cube that settles it on its own, with what is known (for a hint to light). */
function rowOf(frame, clues, i, dom) {
  const L = linesOf(frame.n), ks = linesThrough(frame.n, i);
  for (const k of ks) { const r = round(frame, [L[k]], [clues[k]], dom); if (r && classOf(frame, r.dom[i]) >= 0) return k; }
  return ks[0];
}
function reasonTwist(frame, clues, st0) {
  let dom = domOf(frame, st0 ?? new Int8Array(frame.n ** 3).fill(-1)), depth = 0;
  const L = linesOf(frame.n);
  for (;;) {
    const r = round(frame, L, clues, dom);
    if (!r) return null;
    if (!r.changed) break;
    dom = r.dom; depth++;
  }
  const st = Int8Array.from(dom, m => classOf(frame, m));
  return { st, depth, solved: !st.includes(-1) };
}

// ---------- a puzzle ----------
/** A body of ore grown from one cube by adding a neighbour of a cube it has, to `target` cubes (within the rock, if it has a shape). */
function grow(n, r, target, present) {
  const ore = new Uint8Array(n ** 3), cells = [];
  let first;
  if (present) { const there = []; present.forEach((v, i) => { if (v) there.push(i); }); first = coordsOf(n, there[Math.floor(r() * there.length)]); }
  else first = [Math.floor(r() * n), Math.floor(r() * n), Math.floor(r() * n)];
  ore[cellAt(n, ...first)] = 1; cells.push(first);
  for (let guard = 0; cells.length < target && guard < 4000; guard++) {
    const [cx, cy, cz] = cells[Math.floor(r() * cells.length)], d = AXES[Math.floor(r() * 6)];
    const x = cx + d[0], y = cy + d[1], z = cz + d[2];
    if (x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n || ore[cellAt(n, x, y, z)] || (present && !present[cellAt(n, x, y, z)])) continue;
    ore[cellAt(n, x, y, z)] = 1; cells.push([x, y, z]);
  }
  return ore;
}
/** One to three bodies, then fractured a little: some ore broken off, some waste turned to ore beside it. */
function layout(n, r, present, total) {
  const target = Math.max(4, Math.round(total * 0.5 * (0.85 + 0.3 * r()))), bodies = 1 + Math.floor(r() * 3), ore = new Uint8Array(n ** 3);
  for (let b = 0; b < bodies; b++) { const body = grow(n, r, Math.max(3, Math.round(target / bodies)), present); for (let i = 0; i < ore.length; i++) if (body[i]) ore[i] = 1; }
  const out = ore.slice();
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = cellAt(n, x, y, z);
    if (present && !present[i]) continue;
    if (ore[i]) { if (r() < 0.1) out[i] = 0; }
    else if (r() < 0.06 && AXES.some(d => { const a = x + d[0], b = y + d[1], c = z + d[2]; return a >= 0 && b >= 0 && c >= 0 && a < n && b < n && c < n && ore[cellAt(n, a, b, c)]; })) out[i] = 1;
  }
  return out;
}
/**
 * Can every waste cube be chipped in the end: does each have a way out to the surface through waste? (A cube sealed inside
 * the ore could never be reached.) Where there is no rock, there is air: a cube beside a gap is on the surface.
 */
export function reachable(n, ore, present = null) {
  const seen = new Uint8Array(n ** 3), stack = [], there = i => !present || present[i];
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = cellAt(n, x, y, z);
    if (!there(i) || ore[i]) continue;
    const open = x === 0 || y === 0 || z === 0 || x === n - 1 || y === n - 1 || z === n - 1
      || (present && AXES.some(d => !present[cellAt(n, x + d[0], y + d[1], z + d[2])]));      // (an edge cube was handled above, so these neighbours are all inside the block)
    if (open) { seen[i] = 1; stack.push([x, y, z]); }
  }
  while (stack.length) {
    const [x, y, z] = stack.pop();
    for (const d of AXES) {
      const a = x + d[0], b = y + d[1], c = z + d[2];
      if (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n) continue;
      const j = cellAt(n, a, b, c);
      if (there(j) && !ore[j] && !seen[j]) { seen[j] = 1; stack.push([a, b, c]); }
    }
  }
  return ore.every((o, i) => o || !there(i) || seen[i]);
}
const sum = a => a.reduce((t, v) => t + v, 0);
/**
 * Leaves the reading off `share` of the rows that have one (fog), a row at a time in random order, keeping each only if the
 * rock can still be got by reasoning without it. Returns { clues, depth } with the readings that are left.
 */
function fog(frame, clues, share, r) {
  const rows = clues.map((c, k) => (c ? k : -1)).filter(k => k >= 0);
  for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  const out = clues.slice(), want = Math.round(rows.length * share);
  let off = 0;
  for (const k of rows) {
    if (off >= want) break;
    const keep = out[k];
    out[k] = null;
    if (reasonIn(frame, out)?.solved) off++; else out[k] = keep;
  }
  return { clues: out, depth: reasonIn(frame, out).depth };
}
/**
 * The best rock of a few tries (the first that needs at least `want` rounds of reasoning, else the hardest of the first
 * `patience`): { ore, clues, depth } with one answer reached by reasoning along the rows, a sensible amount of ore, no
 * waste cube sealed in. `present` is the rock's shape (null: it fills the block), `share` the fog.
 */
function build({ n, present, kind, want, share = 0, r }) {
  const total = present ? sum(present) : n ** 3, frame = { n, kind, present };
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const ore = layout(n, r, present, total), count = sum(ore);
    if (count < total * 0.28 || count > total * 0.6 || !reachable(n, ore, present)) continue;
    let clues = readingsOf(n, ore, present), got = reasonIn(frame, clues);
    if (!got?.solved) continue;
    if (share) { const f = fog(frame, clues, share, r); clues = f.clues; got = { ...got, depth: f.depth }; }
    if (!best || got.depth > best.depth) best = { ore, clues, depth: got.depth };
    if (best.depth >= want || attempt >= 60) break;                 // hard enough, or out of patience for a harder one
  }
  if (!best) throw new Error("couldn't make a puzzle");
  return best;
}
// ---------- twists: granite, lanterns, two ores, a fault ----------
/** Whether a cube of the rock is on its surface (a face of the block, or beside a gap): seen, and chippable, from the start. */
const onSurface = (n, present, i) => {
  const [x, y, z] = coordsOf(n, i);
  return x === 0 || y === 0 || z === 0 || x === n - 1 || y === n - 1 || z === n - 1 || AXES.some(d => !present[cellAt(n, x + d[0], y + d[1], z + d[2])]);
};
/**
 * What a lantern chipped lights: its six neighbours and, one lantern among the waste lighting the next, theirs. Waste there
 * crumbles at once, ore shows (no strike), granite and gaps are left. `p` is { n, present, hard, ore, lamps }; `done` the cubes
 * already gone or shown, which this adds to. Returns { gone, shown }.
 */
export function lightUp(p, lamp, done) {
  const { n } = p, gone = [], shown = [], stack = [lamp], lamps = new Set(p.lamps);
  while (stack.length) {
    const [x, y, z] = coordsOf(n, stack.pop());
    for (const d of AXES) {
      const a = x + d[0], b = y + d[1], c = z + d[2];
      if (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n) continue;
      const j = cellAt(n, a, b, c);
      if (!p.present[j] || p.hard?.[j] || done.has(j)) continue;
      done.add(j);
      if (p.ore[j]) shown.push(j); else { gone.push(j); if (lamps.has(j)) stack.push(j); }
    }
  }
  return { gone, shown };
}
/** The rows' readings of a twisted block: as readingsOf, with the target of each channel (an ore, a side of the fault) too. */
function readingsTwist(frame, ore, gold) {
  const { n, present } = frame, L = linesOf(n);
  return L.map(l => {
    let m = 0, any = false;
    const states = l.cells.map((c, i) => { if (present[c]) any = true; if (ore[c] && !frame.hard?.[c]) { m |= 1 << i; return gold?.[c] ? 2 : 1; } return 0; });
    return any ? { ...readMask(m), t: targetsOf(frame, l.a, states) } : null;
  });
}
/**
 * What is known once every lantern is chipped: st (-1 unknown, 0 waste, 1 ore or silver, 2 gold) with granite, gaps, the
 * lanterns and what they light settled. Chipping a lantern costs nothing, so a player can always start here.
 */
export function startOf(p) {
  if (!p.lamps?.length) return null;
  const st = new Int8Array(p.n ** 3).fill(-1), done = new Set(), type = j => (p.gold?.[j] ? 2 : 1);
  for (let i = 0; i < st.length; i++) if (!p.present[i] || p.hard?.[i]) st[i] = 0;
  for (const l of p.lamps ?? []) {
    if (!done.has(l)) { done.add(l); st[l] = 0; }
    const lit = lightUp(p, l, done);
    for (const j of lit.gone) st[j] = 0;
    for (const j of lit.shown) st[j] = type(j);
  }
  return st;
}
/** The best rock of a few tries for a twisted block: build(), with granite on its surface, two ores, a fault and lanterns as the twist asks. */
function buildTwist({ n, present, kind, want, share = 0, r, twist }) {
  const all = present ?? new Uint8Array(n ** 3).fill(1), cells = [...all.keys()].filter(i => all[i]), surface = cells.filter(i => onSurface(n, all, i));
  const cut = twist.cut ? { axis: Math.floor(r() * 3), at: 1 + Math.floor(r() * (n - 1)) } : null, ores = twist.ores === 2 ? 2 : 1;
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    let hard = null;
    if (twist.hard) {                                                           // granite: some of the surface, seen from the start
      hard = new Uint8Array(n ** 3);
      const pool = surface.slice();
      for (let k = Math.max(1, Math.round(twist.hard * cells.length)); k > 0 && pool.length; k--) hard[pool.splice(Math.floor(r() * pool.length), 1)[0]] = 1;
    }
    const can = hard ? all.map((v, i) => (v && !hard[i] ? 1 : 0)) : all, total = sum(can);
    const ore = layout(n, r, can, total), count = sum(ore);
    if (count < total * 0.28 || count > total * 0.6 || !reachable(n, hard ? ore.map((o, i) => o | hard[i]) : ore, all)) continue;
    let gold = null;
    if (ores === 2) {                                                           // gold in a lump from one cube of the ore, silver the rest
      gold = new Uint8Array(n ** 3);
      const oreAt = [...ore.keys()].filter(i => ore[i]), want2 = Math.round(count * (0.3 + 0.25 * r())), seen = new Set(), stack = [];
      const first = oreAt[Math.floor(r() * oreAt.length)];
      stack.push(first); seen.add(first);
      for (let g = 0; g < want2 && stack.length; ) {
        const i = stack.splice(Math.floor(r() * stack.length), 1)[0];
        gold[i] = 1; g++;
        const [x, y, z] = coordsOf(n, i);
        for (const d of AXES) { const a = x + d[0], b = y + d[1], c = z + d[2]; if (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n) continue; const j = cellAt(n, a, b, c); if (ore[j] && !seen.has(j)) { seen.add(j); stack.push(j); } }
      }
      if (sum(gold) === 0 || sum(gold) === count) continue;
    }
    let lamps = null;
    if (twist.lamps) {                                                          // lanterns: waste on the surface, the more ore round it the better
      const pool = surface.filter(i => !ore[i] && !hard?.[i]);
      lamps = [];
      for (let k = 0; k < twist.lamps && pool.length; k++) {
        const score2 = i => { const [x, y, z] = coordsOf(n, i); return AXES.reduce((t, d) => { const a = x + d[0], b = y + d[1], c = z + d[2]; return t + (a >= 0 && b >= 0 && c >= 0 && a < n && b < n && c < n && ore[cellAt(n, a, b, c)] ? 1 : 0); }, 0); };
        const top = pool.map(i => [score2(i) + r() * 1.5, i]).sort((a, b) => b[0] - a[0]);
        const at = top[0][1];
        lamps.push(at); pool.splice(pool.indexOf(at), 1);
      }
      if (!lamps.length) continue;
    }
    const frame = { n, kind, present: all, hard, ores, cut, lamps };
    let clues = ores === 2 || cut ? readingsTwist(frame, ore, gold) : readingsOf(n, ore, all);
    const st0 = lamps ? startOf({ n, present: all, hard, ore, gold, lamps }) : null;
    let got = reasonIn(frame, clues, st0);
    if (!got?.solved) continue;
    if (lamps && twist.needLamps && attempt < 150 && reasonIn({ ...frame, lamps: null }, clues)?.solved) continue;     // this one doesn't need its lanterns
    if (share) { const f = fog(frame, clues, share, r); clues = f.clues; got = { ...got, depth: reasonIn(frame, clues, st0).depth }; }
    if (!best || got.depth > best.depth) best = { ore, clues, depth: got.depth, hard, gold, ores: ores === 2 ? 2 : undefined, cut: cut ?? undefined, lamps: lamps ?? undefined };
    if (best.depth >= want || attempt >= 60) break;
  }
  if (!best) throw new Error("couldn't make a puzzle");
  return best;
}
/**
 * A puzzle from a seed: { seed, size, readings, kind, n, present, ore, clues, depth, waste }. The same seed makes the
 * same puzzle. It has one answer, got by reasoning along the rows (depth rounds of it) without a guess, every waste
 * cube can be reached, and it takes at least the reasoning its size and readings ask for, if some layout in the
 * first tries does (else the hardest of those).
 */
export function makePuzzle(seed, sizeId, readings = "seams") {
  const size = SIZES[sizeId] ?? SIZES.small, n = size.n, kind = KIND_NUMBER[readings] != null ? readings : "seams";
  const r = rng(mix(mix(seed, Object.keys(SIZES).indexOf(sizeId)), KIND_NUMBER[kind])), want = size.depth[kind === "counts" ? 1 : 0];
  const got = build({ n, present: null, kind, want, r });
  return { seed, size: sizeId, readings: kind, kind, n, present: new Uint8Array(n ** 3).fill(1), ...got, waste: n ** 3 - sum(got.ore) };
}
/**
 * A puzzle for a level (survey-levels.js): `spec` is { n, present (the rock's shape), kind (how the rows are read), fog
 * (the share of readings left off), depth (the rounds of reasoning it should ask), salt }.
 */
export function makeLevel(spec, seed) {
  const { n, present, kind, fog: share = 0, depth: want, salt = 0, twist = null } = spec, r = rng(mix(mix(seed, 5000 + salt), KIND_NUMBER[kind]));
  const got = twist ? buildTwist({ n, present, kind, want, share, r, twist }) : build({ n, present, kind, want, share, r });
  return { seed, size: null, readings: kind, kind, n, present, ...got, waste: sum(present) - sum(got.hard ?? []) - sum(got.ore) };
}

// ---------- a run ----------
/** A run as the page keeps it (plain, so it saves): gone (waste chipped), shown (ore found by a strike or a hint), marked, strikes, hints, ms played, done. */
export const newRun = () => ({ gone: [], shown: [], marked: [], strikes: 0, hints: 0, ms: 0, done: false });
const set = list => new Set(list);
/** A cube still in the rock and with a face to the open air (the surface, a gap in the rock, or beside a chipped cube): the only ones that can be chipped or marked. */
export function exposed(p, run, i) {
  if (!p.present[i] || p.hard?.[i] || run.gone.includes(i)) return false;
  const n = p.n, [x, y, z] = coordsOf(n, i), gone = set(run.gone);
  return AXES.some(d => { const a = x + d[0], b = y + d[1], c = z + d[2]; return a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n || !p.present[cellAt(n, a, b, c)] || gone.has(cellAt(n, a, b, c)); });
}
export const wasteLeft = (p, run) => p.waste - run.gone.length;
/**
 * Chips a cube: "chipped" (it was waste, and is gone), "strike" (it was ore: it stays, shown, and costs a strike) or "no" (gone
 * already, covered, marked or known to be ore: nothing happens). The last waste cube gone ends the run.
 */
export function chip(p, run, i) {
  if (run.done || run.marked.includes(i) || run.shown.includes(i) || !exposed(p, run, i)) return "no";
  if (p.ore[i]) { run.shown.push(i); run.strikes++; return "strike"; }
  run.gone.push(i);
  let result = "chipped";
  if (p.lamps?.includes(i)) {                                    // a lantern: it lights what is round it, ore shown free, waste crumbling
    const lit = lightUp(p, i, new Set([...run.gone, ...run.shown]));
    run.gone.push(...lit.gone); run.shown.push(...lit.shown);
    run.marked = run.marked.filter(j => !lit.gone.includes(j) && !lit.shown.includes(j));
    result = "lit";
  }
  if (wasteLeft(p, run) === 0) run.done = true;
  return result;
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
  for (let i = 0; i < st.length; i++) if (!p.present[i] || p.hard?.[i]) st[i] = 0;
  for (const i of run.gone) st[i] = 0;
  for (const i of run.shown) st[i] = p.gold?.[i] ? 2 : 1;
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
  const f = forcedIn(frameOf(p), p.clues, known(p, run));
  if (!f?.length) {
    const lamp = p.lamps?.find(l => !run.gone.includes(l));        // the readings may need what a lantern shows
    if (f && lamp != null) { run.hints++; return { cell: lamp, v: 0, line: -1, exposed: true, lamp: true }; }
    return null;
  }
  const gone = set(run.gone), open = f.filter(x => exposed(p, run, x.cell) && !gone.has(x.cell));
  const best = list => list.reduce((b, x) => (b == null || prefer(x.cell) > prefer(b.cell) ? x : b), null);      // the one the caller likes best (the first of equals)
  const pickFrom = best(open.filter(x => x.v === 0)) ?? best(open.filter(x => x.v === 1 && !run.shown.includes(x.cell))) ?? best(open) ?? f[0];
  run.hints++;
  const out = { ...pickFrom, exposed: open.includes(pickFrom) };
  if (out.v === 1 && out.exposed && !run.shown.includes(out.cell)) run.shown.push(out.cell);    // ore you can see is shown from now on, as if found
  return out;
}
/** A row's state in the run: the cubes still in it, and whether it is done (only ore left in it: it has no waste to chip). A row with no reading (fog) is never done, however little is left. */
export function lineState(p, run, k) {
  const gone = set(run.gone), left = linesOf(p.n)[k].cells.filter(c => p.present[c] && !p.hard?.[c] && !gone.has(c)).length, c = p.clues[k]?.c ?? null;
  return { left, count: c, done: c != null && left === c };
}
/** Your time: seconds played, and the penalties. Lower is better. */
export const score = run => Math.round(run.ms / 1000) + STRIKE * run.strikes + HINT * run.hints;
