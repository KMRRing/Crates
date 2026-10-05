// Slate's referee for Suggest and Check. Both ask about complete winning boards: every across and down run a word
// from the full list (repeats allowed, as the win rule allows), every field's rule kept on every field, including
// the whole-field rules that can't be judged until the field is full. Our fill is just one such board.
//
// Suggest: a word for a slot that appears on some winning board keeping every letter you've entered.
// Check: the fewest letters that must change for a winning board to exist, keeping all the rest. Letters are
// protected by rings counted outward through crossings from the word you asked about: no nearer letter changes
// while changes further out would do; among equals, fewer letters, then typed letters before letters of placed
// words. Runs in slate-worker.js, off the page.
import { EASY, VALID, gridOf, rowsOf, fieldsOf, jointsOf } from "./slate-gen.js";

// ---------- the full word list, indexed ----------
// Per length: the words, common ones first (a search that takes them in order prefers them), and per position and
// letter a bitset of the words with that letter there.
const FULL = {};
function fullIndex(L) {
  if (FULL[L]) return FULL[L];
  const easy = new Set(EASY[L] || []), all = [...VALID].filter(w => w.length === L);
  const words = [...all.filter(w => easy.has(w)), ...all.filter(w => !easy.has(w))];
  const n = Math.ceil(words.length / 32), pos = Array.from({ length: L }, () => ({}));
  words.forEach((w, j) => { for (let i = 0; i < L; i++) (pos[i][w[i]] ||= new Uint32Array(n))[j >> 5] |= 1 << (j & 31); });
  const full = new Uint32Array(n).fill(0xFFFFFFFF);
  if (words.length % 32) full[n - 1] = (1 << (words.length % 32)) - 1;
  return (FULL[L] = { words, pos, full, n, at: new Map(words.map((w, j) => [w, j])) });
}
const and = (a, b) => { for (let i = 0; i < a.length; i++) a[i] &= b ? b[i] : 0; return a; };
const popcount = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
const count = m => { let n = 0; for (let i = 0; i < m.length; i++) if (m[i]) n += popcount(m[i]); return n; };
const has = (m, j) => (m[j >> 5] >>> (j & 31)) & 1;
function bitsOf(m) {
  const out = [];
  for (let i = 0; i < m.length; i++) for (let x = m[i]; x; x &= x - 1) out.push((i << 5) | (31 - Math.clz32(x & -x)));
  return out;
}
const now = () => performance.now();

// ---------- letter sets, as 26-bit masks ----------
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"], ALL = (1 << 26) - 1;
const code = c => c.charCodeAt(0) - 65;
const bit = c => 1 << code(c);
const where = pred => LETTERS.reduce((b, c, i) => (pred(c) ? b | (1 << i) : b), 0);
const VOWELS = where(c => "AEIOU".includes(c));
/** The words of a slot length with any of these letters at position i (cached). */
const MASKS = {};
function maskOf(ix, i, bits) {
  const cache = ((MASKS[ix.words[0].length] ||= [])[i] ||= new Map());
  if (cache.has(bits)) return cache.get(bits);
  const m = new Uint32Array(ix.n);
  LETTERS.forEach((c, j) => { const p = ix.pos[i][c]; if (bits >> j & 1 && p) for (let x = 0; x < m.length; x++) m[x] |= p[x]; });
  cache.set(bits, m);
  return m;
}

// ---------- a board, ready to search ----------
// Rules become letter sets wherever they can: a single-letter field (and a no-vowels field) narrows its cells for
// good; a pair, once one letter is down, narrows the other; a whole field narrows its empty cells as letters
// arrive (no repeats, one vowel, one shape or row) and, with one cell left, to exactly the letters that pass.
const PREPARED = new WeakMap();
function prepare(board) {
  if (PREPARED.has(board)) return PREPARED.get(board);
  const grid = gridOf(rowsOf(board)), stat = Object.fromEntries(grid.cells.map(k => [k, ALL])), pairs = [], wholes = [];
  for (const f of fieldsOf(board)) {
    const t = f.rule.test;
    if (f.rule.type === "single") f.cells.forEach(k => { stat[k] &= where(t); });
    else if (f.rule.type === "pair") {
      const fwd = LETTERS.map(x => where(y => t(x, y))), bwd = LETTERS.map(y => where(x => t(x, y)));
      jointsOf(f.cells).forEach(([a, b]) => pairs.push({ cells: [a, b], fwd, bwd, ok: ls => t(ls[0], ls[1]) }));
    } else {
      if (f.rule.id === "noVowels") f.cells.forEach(k => { stat[k] &= ALL & ~VOWELS; });
      const same = LETTERS.map(x => where(y => t([x, y])));          // for one shape / one row: what goes with x
      wholes.push({ n: wholes.length, cells: f.cells, id: f.rule.id, test: t, same });
    }
  }
  const slots = grid.slots.map(s => {
    const ix = fullIndex(s.cells.length), base = ix.full.slice();
    s.cells.forEach((k, i) => { if (stat[k] !== ALL) and(base, maskOf(ix, i, stat[k])); });
    const touches = r => r.cells.some(k => s.cells.includes(k));
    return { id: s.id, cells: s.cells, ix, base, pairs: pairs.filter(touches), wholes: wholes.filter(touches) };
  });
  const prefer = Object.fromEntries(grid.slots.map(s => [s.id, s.cells.map(k => board.sol[k]).join("")]));
  const P = { slots, stat, pairs, wholes, prefer, seen: new Map() };
  PREPARED.set(board, P);
  return P;
}

/** Whether a whole field's letters so far (null for empty cells) can still pass. */
function wholeMayPass(w, ls) {
  const known = ls.filter(Boolean);
  if (known.length === ls.length) return w.test(ls);
  switch (w.id) {
    case "noDup": return new Set(known).size === known.length;
    case "noVowels": return !known.some(c => VOWELS & bit(c));
    case "oneVowel": return known.filter(c => VOWELS & bit(c)).length <= 1;
    case "oneShape": case "oneRow": return known.every(c => w.same[code(known[0])] & bit(c));
    default: return true;
  }
}

/** For each empty cell the rules narrow, the letters still possible there; null when some cell has none. */
function narrowed(P, letters) {
  const dyn = {};
  const narrow = (k, bits) => { dyn[k] = (dyn[k] ?? ALL) & bits; };
  for (const p of P.pairs) {
    const [a, b] = p.cells, x = letters[a], y = letters[b];
    if (x && !y) narrow(b, p.fwd[code(x)]);
    else if (y && !x) narrow(a, p.bwd[code(y)]);
  }
  for (const w of P.wholes) {
    const open = w.cells.filter(k => !letters[k]), known = w.cells.filter(k => letters[k]).map(k => letters[k]);
    if (!open.length || !known.length) continue;
    if (!wholeMayPass(w, w.cells.map(k => letters[k] || null))) return null;
    if (w.id === "noDup") { const used = known.reduce((b, c) => b | bit(c), 0); open.forEach(k => narrow(k, ALL & ~used)); }
    else if (w.id === "oneVowel" && known.some(c => VOWELS & bit(c))) open.forEach(k => narrow(k, ALL & ~VOWELS));
    else if (w.id === "oneShape" || w.id === "oneRow") open.forEach(k => narrow(k, w.same[code(known[0])]));
    if (open.length === 1) {                     // the last cell: exactly the letters that make the field pass
      const k = open[0];
      narrow(k, where(c => w.test(w.cells.map(x => letters[x] || c))));
    } else if (open.length === 2 && w.id === "anagram") {
      // two cells left of a field that must rearrange into a word: only letters some pair completes (remembered)
      const [k1, k2] = open, d1 = (dyn[k1] ?? ALL) & P.stat[k1], d2 = (dyn[k2] ?? ALL) & P.stat[k2];
      const key = `${w.n}|${w.cells.map(k => letters[k] || ".").join("")}|${d1}|${d2}`;
      let both = P.seen.get(key);
      if (!both) {
        both = [0, 0];
        for (const c1 of LETTERS) if (d1 & bit(c1)) for (const c2 of LETTERS) if (d2 & bit(c2)
          && w.test(w.cells.map(x => letters[x] || (x === k1 ? c1 : c2)))) { both[0] |= bit(c1); both[1] |= bit(c2); }
        P.seen.set(key, both);
      }
      narrow(k1, both[0]); narrow(k2, both[1]);
    }
  }
  for (const k in dyn) if (!(dyn[k] & P.stat[k])) return null;
  return dyn;
}

/** Rings: the asked slot is 0, the slots crossing it 1, and so on; a cell takes its nearest slot's ring. */
export function ringsFrom(P, anchor) {
  const dist = new Map([[anchor, 0]]), queue = [anchor];
  while (queue.length) {
    const s = queue.shift(), d = dist.get(s), cells = P.slots[s].cells;
    for (const t of P.slots) if (!dist.has(t.id) && t.cells.some(k => cells.includes(k))) { dist.set(t.id, d + 1); queue.push(t.id); }
  }
  const far = Math.max(...dist.values()) + 1, ring = {};
  for (const s of P.slots) for (const k of s.cells) ring[k] = Math.min(ring[k] ?? Infinity, dist.get(s.id) ?? far);
  return ring;
}

/**
 * A winning board keeping these letters: depth-first, the slot with the fewest words left first, each slot's words
 * tried preferred word first, then common words. Returns { fill, done }: fill null with done true means none
 * exists; done false means time ran out first.
 */
function winningBoard(P, fixed, { prefer = P.prefer, deadline = Infinity } = {}) {
  const letters = { ...fixed }, used = new Set();
  let found = null, steps = 0, timeUp = false;
  const maskFor = (s, dyn) => {
    const m = s.base.slice();
    for (let i = 0; i < s.cells.length; i++) {
      const k = s.cells[i], c = letters[k];
      if (c) and(m, s.ix.pos[i][c]);
      else if (dyn[k] != null) and(m, maskOf(s.ix, i, dyn[k]));
    }
    return m;
  };
  const at = (s, w, k) => letters[k] || (s.cells.includes(k) ? w[s.cells.indexOf(k)] : null);
  const fits = (s, w) => s.pairs.every(p => { const ls = p.cells.map(k => at(s, w, k)); return !ls[0] || !ls[1] || p.ok(ls); })
    && s.wholes.every(f => wholeMayPass(f, f.cells.map(k => at(s, w, k))));
  const go = () => {
    if (found || timeUp) return;
    if ((++steps & 127) === 0 && now() > deadline) { timeUp = true; return; }
    const dyn = narrowed(P, letters);
    if (!dyn) return;
    let pick = null, pickMask = null, pickN = Infinity;
    for (const s of P.slots) {
      if (used.has(s.id)) continue;
      const m = maskFor(s, dyn), n = count(m);
      if (!n) return;
      if (n < pickN) { pick = s; pickMask = m; pickN = n; }
    }
    if (!pick) { found = { ...letters }; return; }     // every slot holds a word, every rule checked on the way in
    const fresh = pick.cells.filter(k => !letters[k]);
    const pref = prefer[pick.id] != null ? pick.ix.at.get(prefer[pick.id]) : undefined;
    let order = bitsOf(pickMask);
    if (pref !== undefined && has(pickMask, pref)) order = [pref, ...order.filter(j => j !== pref)];
    used.add(pick.id);
    for (const j of order) {
      const w = pick.ix.words[j];
      if (!fits(pick, w)) continue;
      fresh.forEach(k => { letters[k] = w[pick.cells.indexOf(k)]; });
      go();
      fresh.forEach(k => { delete letters[k]; });
      if (found || timeUp) break;
    }
    used.delete(pick.id);
  };
  go();
  return { fill: found, done: !timeUp };
}

/** All k-element subsets of xs, in order. */
function* subsets(xs, k, from = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = from; i <= xs.length - (k - acc.length); i++) { acc.push(xs[i]); yield* subsets(xs, k, i + 1, acc); acc.pop(); }
}
/** The smallest set of cells meeting every conflict; among equals, the one with fewest placed cells. */
function hittingSet(conflicts, placed) {
  if (!conflicts.length) return [];
  const pool = [...new Set(conflicts.flat())];
  for (let k = 1; k <= pool.length; k++) {
    let best = null, bestPlaced = Infinity;
    for (const d of subsets(pool, k)) {
      if (!conflicts.every(c => c.some(x => d.includes(x)))) continue;
      const p = d.filter(x => placed.has(x)).length;
      if (p < bestPlaced) { best = d; bestPlaced = p; if (!p) break; }
    }
    if (best) return best;
  }
  return pool;
}

/**
 * The fewest of one ring's letters to drop so a winning board keeps the rest, with everything kept so far, rings
 * further out left free. Exact by learning conflicts: drop the smallest set meeting every conflict known; if the
 * rest still can't win, shrink them to a set that can't all stay (each one needed for the clash) and repeat.
 */
function ringDrops(P, kept, here, placed, deadline) {
  const cells = Object.keys(here), conflicts = [];
  const pick = ks => Object.fromEntries(ks.map(k => [k, here[k]]));
  const feasible = (ks, cap = Infinity) => winningBoard(P, { ...kept, ...pick(ks) }, { deadline: Math.min(deadline, now() + cap) });
  for (;;) {
    const drop = hittingSet(conflicts, placed), keep = cells.filter(k => !drop.includes(k));
    const r = feasible(keep);
    if (r.fill) return { drop, proven: true };
    if (!r.done) return { drop: cells, proven: false };          // out of time: dropping the whole ring always works
    // shrink the clash: a letter leaves it only when it's proven to clash without that letter. A test that runs
    // long leaves the letter in, which keeps the clash true, just less sharp; the answer stays exact either way.
    let core = keep;
    for (const k of keep) {
      const without = core.filter(c => c !== k), t = feasible(without, 200);
      if (t.done && !t.fill) core = without;
    }
    conflicts.push(core);
  }
}

/**
 * Check: which of these letters must change for a winning board to exist, keeping all the others. anchor is the
 * slot asked about; placed, the cells in placed words. Returns { empty } with nothing to check, { clean } when a
 * winning board keeps everything, { out: { cell: letter }, proven } otherwise (proven: nothing smaller would do
 * under the ring order), or { timeout } when time ran out before any answer.
 */
export function checkBoard(board, letters, placed, anchor, { ms = 3000 } = {}) {
  const cells = Object.keys(letters);
  if (!cells.length) return { empty: true };
  const P = prepare(board), deadline = now() + ms, placedSet = new Set(placed);
  const all = winningBoard(P, letters, { deadline });
  if (all.fill) return { clean: true };
  const ring = ringsFrom(P, anchor), kept = {};
  let proven = all.done;
  for (const d of [...new Set(cells.map(k => ring[k]))].sort((a, b) => a - b)) {
    const here = Object.fromEntries(cells.filter(k => ring[k] === d).map(k => [k, letters[k]]));
    if (now() > deadline) return { timeout: true };
    const { drop, proven: p } = ringDrops(P, kept, here, placedSet, deadline);
    proven &&= p;
    for (const k of Object.keys(here)) if (!drop.includes(k)) kept[k] = here[k];
  }
  const out = {};
  for (const k of cells) if (!(k in kept)) out[k] = letters[k];
  return Object.keys(out).length ? { out, proven } : { clean: true };
}

/**
 * Suggest: a word for the slot that appears on some winning board keeping every letter entered; our fill's word
 * where it can, else common words first. { full } when the slot has no empty cell, { word }, or { none, proven }:
 * proven when no winning board keeps these letters, not proven when time ran out first.
 */
export function suggestWord(board, letters, slotId, { ms = 2500 } = {}) {
  const P = prepare(board), slot = P.slots[slotId];
  if (slot.cells.every(k => letters[k])) return { full: true };
  const r = winningBoard(P, letters, { deadline: now() + ms });
  if (!r.fill) return { none: true, proven: r.done };
  return { word: slot.cells.map(k => r.fill[k]).join("") };
}

/** For tests: a winning board keeping exactly these letters, if any ({ fill, done }). */
export function winning(board, letters, { ms = 3000 } = {}) {
  return winningBoard(prepare(board), letters, { deadline: now() + ms });
}
