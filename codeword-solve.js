// Codeword's solvers (README, Codeword), pure. A codeword is a crossword grid whose white cells carry numbers instead of
// letters: the same number is always the same letter, two numbers never the same letter, and every letter of the
// alphabet is in the grid, so the numbers 1 to 26 are the alphabet in some order. A puzzle here is { grid (rows of "#"
// and "."), num (the number in each cell, 0 for a black one), letters (the solution: letters[n] for number n) }.
//
// Two solvers, for two questions:
//  - count(puzzle, known, words): how many ways to letter the grid so every entry is a word, every number one letter
//    and every letter one number, given the numbers already known; stops at two. Against the widest word list, so a
//    puzzle with one answer has no second hiding among rare words. Each number keeps the letters it could still be;
//    each entry the words with its pattern (which cells repeat a number) that its numbers' letters allow, as a bitset
//    over the words of that pattern, so a letter ruled out for a number is one AND per entry it's in; a number down to
//    one letter takes it from every other, a letter left to one number is that number's (every letter is used); and
//    a search over the numbers with fewest letters left counts what's left.
//  - crack(puzzle, known, words): how a person solves it, step by step: an entry where exactly one familiar word fits
//    what's known (its known letters, its repeated numbers, and no unknown cell a letter already used) gives its
//    letters; failing that, a number whose entries between them leave it one letter, or a letter only one number can
//    still be (the cross-check a solver does with a pencil). Each step says how obvious it was: how many familiar
//    words fit the entry's known letters alone, before the repeats and the used letters were weighed. The steps are
//    sound (each is forced), so a puzzle it finishes has one answer among familiar words; count proves the rest.
import { wordsOf, MIN, MAX } from "./wordlist.js";
import { entriesOf } from "./codeword-rules.js";

export { entriesOf };

const A = 97;
const popcount = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
const countOf = d => { let n = 0; for (let i = 0; i < d.length; i++) if (d[i]) n += popcount(d[i]); return n; };
const bits = m => { const out = []; for (let x = m; x; x &= x - 1) out.push(31 - Math.clz32(x & -x)); return out; };
const ALL = (1 << 26) - 1;

// ---------- word lists, by pattern ----------
/** A word's pattern: each letter as the order it first appears in ("letter" is 0,1,2,2,1,3), joined. */
export const patternOf = w => { const seen = new Map(); return [...w].map(ch => { if (!seen.has(ch)) seen.set(ch, seen.size); return seen.get(ch); }).join("."); };
/**
 * A list of words to solve with: the words of wordlist.js up to tier `upto` (variants in or out), with `extra` words
 * of any length (a theme's). Its words of each pattern are grouped and indexed as they're first asked for.
 */
export function wordList({ upto = 7, variants = true, extra = [] } = {}) {
  const byLen = new Map(), groups = new Map();
  const ex = extra.map(w => String(w).toLowerCase()).filter(w => /^[a-z]+$/.test(w) && w.length >= MIN && w.length <= MAX);
  const lengthWords = L => {
    if (!byLen.has(L)) byLen.set(L, [...new Set([...wordsOf(L, upto, { variants }), ...ex.filter(w => w.length === L)])]);
    return byLen.get(L);
  };
  // a length's words by pattern, sorted out the first time the length is asked for
  const byPat = new Map();
  const patterned = L => {
    if (!byPat.has(L)) {
      const m = new Map();
      for (const w of lengthWords(L)) { const p = patternOf(w); if (!m.has(p)) m.set(p, []); m.get(p).push(w); }
      byPat.set(L, m);
    }
    return byPat.get(L);
  };
  /** The words of a pattern, indexed: for the k-th distinct letter of the pattern and each letter, the words with it. */
  const group = (L, pat) => {
    const key = `${L}:${pat}`;
    if (groups.has(key)) return groups.get(key);
    const words = patterned(L).get(pat) || [];
    const firsts = [], seen = new Set();
    pat.split(".").forEach((p, i) => { if (!seen.has(p)) { seen.add(p); firsts.push(i); } });
    const K = firsts.length, n = words.length, nw = (n + 31) >>> 5, by = new Uint32Array(K * 26 * nw);
    words.forEach((w, j) => { const bit = (1 << (j & 31)) >>> 0, at = j >>> 5; firsts.forEach((i, k) => { by[(k * 26 + w.charCodeAt(i) - A) * nw + at] |= bit; }); });
    const full = new Uint32Array(nw).fill(0xFFFFFFFF);
    if (n & 31) full[nw - 1] = ((1 << (n & 31)) - 1) >>> 0;
    const g = { L, pat, words, K, firsts, n, nw, by, full };
    groups.set(key, g);
    return g;
  };
  // per length, a bitset per position and letter over all its words, for how many words fit some letters alone
  const plain = new Map();
  const plainOf = L => {
    if (plain.has(L)) return plain.get(L);
    const words = lengthWords(L), n = words.length, nw = (n + 31) >>> 5, pos = new Uint32Array(L * 26 * nw);
    words.forEach((w, j) => { for (let i = 0; i < L; i++) pos[(i * 26 + w.charCodeAt(i) - A) * nw + (j >>> 5)] |= (1 << (j & 31)) >>> 0; });
    const p = { n, nw, pos };
    plain.set(L, p);
    return p;
  };
  /**
   * The words of length L with these letters ([[position, letter], …]) where they say, whatever else they have:
   * { count, words } (words null when there are more than cap: nobody sifts that many).
   */
  let keep = new Uint32Array(64);
  const fitsOf = (L, at, cap = Infinity) => {
    const p = plainOf(L);
    if (!at.length) return { count: p.n, words: p.n <= cap ? lengthWords(L) : null };
    if (keep.length < p.nw) keep = new Uint32Array(p.nw * 2);
    const [i0, c0] = at[0], off0 = (i0 * 26 + c0.charCodeAt(0) - A) * p.nw;
    for (let x = 0; x < p.nw; x++) keep[x] = p.pos[off0 + x];
    for (let a = 1; a < at.length; a++) { const [i, ch] = at[a], off = (i * 26 + ch.charCodeAt(0) - A) * p.nw; for (let x = 0; x < p.nw; x++) keep[x] &= p.pos[off + x]; }
    let count = 0;
    for (let x = 0; x < p.nw; x++) if (keep[x]) count += popcount(keep[x]);
    if (count > cap) return { count, words: null };
    const words = [], all = lengthWords(L);
    for (let x = 0; x < p.nw; x++) for (let v = keep[x]; v; v &= v - 1) words.push(all[(x << 5) | (31 - Math.clz32(v & -v))]);
    return { count, words };
  };
  const set = new Map();
  return { group, lengthWords, fitsOf, has: w => { const L = w.length; if (!set.has(L)) set.set(L, new Set(lengthWords(L))); return set.get(L).has(w); } };
}

// ---------- how many answers ----------
/**
 * How many ways (0, 1 or 2: it stops at two) to letter the puzzle given `known` ({ number: letter }), against `list`
 * (wordList()). `limit` caps the search's steps: past it the answer is null (not known).
 */
export function count(puzzle, known, list, opts = {}) {
  return solutions(puzzle, known, list, opts).count;
}
/**
 * The answers count finds: { count (0, 1, 2, or null past the limit), first, second (each letters[n] for n 1 to 26,
 * as found), steps (the search's) }.
 */
export function solutions(puzzle, known, list, { limit = 20000 } = {}) {
  const S = setUp(puzzle, list);
  if (!S) return { count: 0, steps: 0 };
  const D = startOf(S, known);
  const live = S.entries.map(e => e.g.full.slice());
  let found = 0, steps = 0;
  const answers = [];
  const go = (D, live) => {
    if (++steps > limit) return false;
    if (!propagate(S, D, live)) return true;
    let best = 0;
    for (let n = 1; n <= 26; n++) if (popcount(D[n]) > 1 && (!best || popcount(D[n]) < popcount(D[best]) || (popcount(D[n]) === popcount(D[best]) && S.occ[n].length > S.occ[best].length))) best = n;
    if (!best) { found++; answers.push(["", ...Array.from(D.slice(1), m => (m ? String.fromCharCode(A + 31 - Math.clz32(m)) : ""))]); return true; }
    for (const ch of bits(D[best])) {
      const D2 = D.slice(), live2 = live.map(l => l.slice());
      D2[best] = 1 << ch;
      if (!go(D2, live2)) return false;
      if (found >= 2) return true;
    }
    return true;
  };
  const done = go(D, live);
  return { count: done ? Math.min(found, 2) : null, first: answers[0] || null, second: answers[1] || null, steps };
}
/**
 * The puzzle's entries with their pattern's words, and where each number is (occ[n]: [entry, its k-th distinct
 * number]). whole: every number 1 to 26 is in the grid, so every letter is some number's (a real codeword always; a
 * small test grid not).
 */
function setUp(puzzle, list) {
  const entries = entriesOf(puzzle.grid, puzzle.num).map(e => ({ ...e, g: list.group(e.cells.length, e.pat) }));
  if (entries.some(e => !e.g.n)) return null;
  const occ = Array.from({ length: 27 }, () => []);
  entries.forEach((e, i) => e.distinct.forEach((n, k) => occ[n].push([i, k])));
  const present = new Set(puzzle.num.filter(n => n > 0));
  return { entries, occ, present, whole: present.size === 26 };
}
/** Each number's letters to begin with: all of them, or the one it's known to be; none for a number not in the grid. */
function startOf(S, known) {
  const D = new Int32Array(27);
  for (const n of S.present) D[n] = ALL;
  for (const [n, ch] of Object.entries(known || {})) if (S.present.has(Number(n))) D[n] = 1 << (ch.charCodeAt(0) - A);
  return D;
}
/**
 * Narrows the numbers' letters and the entries' words until nothing more follows (in place); false on a contradiction.
 * An entry keeps a word only if each of its numbers can be that word's letter; a number keeps a letter only if each of
 * its entries has a word giving it; a number down to one letter takes it from the rest; a letter only one number can be
 * goes to that number.
 */
function propagate(S, D, live) {
  const { entries, occ } = S;
  const allowed = new Int32Array(27);
  let changed = true;
  // first pass: every entry's words against every number's letters
  for (let i = 0; i < entries.length; i++) if (!filter(entries[i], D, live[i])) return false;
  while (changed) {
    changed = false;
    allowed.fill(ALL);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i], g = e.g, l = live[i];
      e.distinct.forEach((n, k) => {
        let m = 0;
        for (const ch of bits(D[n])) {
          const off = (k * 26 + ch) * g.nw;
          for (let x = 0; x < g.nw; x++) if (l[x] & g.by[off + x]) { m |= 1 << ch; break; }
        }
        allowed[n] &= m;
      });
    }
    for (const n of S.present) {
      const m = D[n] & allowed[n];
      if (!m) return false;
      if (m !== D[n]) { D[n] = m; changed = true; }
    }
    // one to one: a settled number's letter is no other's; a letter only one number can be is that number's
    let settled = 0;
    for (const n of S.present) if (popcount(D[n]) === 1) {
      if (settled & D[n]) return false;
      settled |= D[n];
    }
    for (const n of S.present) if (popcount(D[n]) > 1 && D[n] & settled) { D[n] &= ~settled; if (!D[n]) return false; changed = true; }
    if (S.whole) for (let ch = 0; ch < 26; ch++) {
      let only = 0, k = 0;
      for (let n = 1; n <= 26 && k < 2; n++) if (D[n] >> ch & 1) { only = n; k++; }
      if (!k) return false;
      if (k === 1 && D[only] !== 1 << ch) { D[only] = 1 << ch; changed = true; }
    }
    if (changed) for (let i = 0; i < entries.length; i++) if (!filter(entries[i], D, live[i])) return false;
  }
  return true;
}
/** Keeps an entry's words that its numbers' letters allow; false if none is left. */
function filter(e, D, l) {
  const g = e.g;
  for (let k = 0; k < e.distinct.length; k++) {
    const d = D[e.distinct[k]];
    if (d === ALL) continue;
    if (popcount(d) <= 13) {                       // few letters left: keep the words with one of them
      const keep = scratch(g.nw);
      for (const ch of bits(d)) { const off = (k * 26 + ch) * g.nw; for (let x = 0; x < g.nw; x++) keep[x] |= g.by[off + x]; }
      for (let x = 0; x < g.nw; x++) l[x] &= keep[x];
    } else for (const ch of bits(ALL & ~d)) {      // many: drop the words with one of the others
      const off = (k * 26 + ch) * g.nw;
      for (let x = 0; x < g.nw; x++) l[x] &= ~g.by[off + x];
    }
  }
  return countOf(l) > 0;
}
let spare = new Uint32Array(1024);
/** An emptied buffer of n words, reused (the solvers are never re-entered while one is in use). */
function scratch(n) { if (spare.length < n) spare = new Uint32Array(n * 2); spare.fill(0, 0, n); return spare; }


// ---------- how a person solves it ----------
/**
 * Solves a puzzle as a person would, from `known` ({ number: letter }), with the words of `list` as the words they'd
 * think of (wordList({ upto }), a vocabulary). A person brings words to mind from an entry's known letters (the words
 * that fit those alone are its `fits`, what they have to sift), then rules them out by the cells that repeat a number,
 * the cells that can't (two numbers are two letters) and the letters used elsewhere. They write an entry in when one
 * word is left and they could sift what fitted: no more than `sift` words (a solver's skill; 1 is a word its known
 * letters give away). Failing a word, a cross-check with a pencil: a number whose entries with short lists left (no
 * more than `pencil` words, each among few enough to sift) leave it one letter whichever word each turns out to be;
 * and the last number takes the last letter. Each time it takes the most obvious step there is: a word before a
 * cross-check, the word fewest words fit first.
 *
 * views: null, one solver seeing every number; or [the numbers one solver sees, the numbers the other sees] (two
 * Sets), the split key: each sees only their own numbers in the grid (the other's cells show none), writes in only
 * their own, and a word either works out gives the other the letters of their cells in it, which they write in.
 * alone (0 or 1, with views): that solver only. What they work out of the other's cells they know cell by cell, never
 * seeing where else those numbers are, and nothing the other would have found is written in.
 *
 * Returns { steps, known (every number's letter found), done (every number found; alone, every one of theirs) }; a
 * step is { kind ("word", "cross" or "last"), by (the solver: null, 0 or 1), entry (its index among entriesOf's),
 * word (a word step's), gives ([[number, letter], …] written in), cells ([[cell, letter], …] learnt alone of the
 * other's cells), fits (0 but for a word), unknown (how many letters it found) }.
 */
export function crack(puzzle, known, list, { sift = 12, pencil = 6, views = null, alone = null, maxSteps = 120 } = {}) {
  const entries = entriesOf(puzzle.grid, puzzle.num);
  const present = new Set(puzzle.num.filter(n => n > 0)), whole = present.size === 26;
  const occ = Array.from({ length: 27 }, () => []);
  entries.forEach((e, i) => e.distinct.forEach(n => occ[n].push(i)));
  const letter = new Array(27).fill(null);      // each number's letter, once written in (the givens to begin with)
  const cellAt = new Map();                     // alone: cells of the other's numbers worked out, cell by cell
  let used = 0, theirs = 0;                     // letters written in; letters of the other's cells worked out alone
  const solvers = views == null ? [null] : alone == null ? [0, 1] : [alone];
  const sees = (v, n) => v == null || views[v].has(n);
  const write = (n, ch) => { letter[n] = ch; used |= 1 << (ch.charCodeAt(0) - A); };
  for (const [n, ch] of Object.entries(known || {})) if (present.has(Number(n))) write(Number(n), ch);
  const at = (e, p) => letter[e.nums[p]] ?? cellAt.get(e.cells[p]) ?? null;
  const mine = n => (alone == null ? present.has(n) : views[alone].has(n));
  const toFind = () => [...present].filter(n => letter[n] == null && mine(n));

  // the words that fit an entry's known letters change only when one of its letters is found: kept by what's known
  const fitted = entries.map(() => ({ sig: null, f: null }));
  /** What solver v makes of an entry: { fits, left (the words it could be) }, or null with too many to sift or nothing to find. */
  const consider = (v, e) => {
    const L = e.cells.length, got = [], open = [];
    for (let p = 0; p < L; p++) { const ch = at(e, p); if (ch) got.push([p, ch]); else open.push(p); }
    if (!open.length || !got.length) return null;          // full, or not a letter to start from
    const memo = fitted[e.id], sig = got.map(([p, ch]) => p + ch).join("");
    if (memo.sig !== sig) { memo.sig = sig; memo.f = list.fitsOf(L, got, sift); }
    const f = memo.f;
    if (!f.words) return null;
    const left = f.words.filter(w => {
      for (let a = 0; a < open.length; a++) {
        const p = open[a], c = w.charCodeAt(p) - A, vp = sees(v, e.nums[p]);
        if (used >> c & 1 || (vp && theirs >> c & 1)) return false;
        for (let b = 0; b < a; b++) {
          const q = open[b], vq = sees(v, e.nums[q]), same = w[p] === w[q];
          if (vp && vq) { if ((e.nums[p] === e.nums[q]) !== same) return false; }
          else if (vp || vq) { if (same) return false; }      // one of v's numbers and one of the other's: two letters
        }
      }
      return true;
    });
    return { fits: f.count, left };
  };
  /** Writes in what a step found; alone, the other's cells are only known where they are. */
  const take = step => {
    for (const [n, ch] of step.gives) write(n, ch);
    for (const [k, ch] of step.cells) { cellAt.set(k, ch); theirs |= 1 << (ch.charCodeAt(0) - A); }
  };
  const steps = [];
  for (let guard = 0; guard < maxSteps && toFind().length; guard++) {
    // a word: an entry with one word left, among few enough to have sifted, the fewest first
    let best = null;
    for (const v of solvers) for (let i = 0; i < entries.length; i++) {
      const e = entries[i], c = consider(v, e);
      if (!c || c.left.length !== 1 || (best && c.fits >= best.fits)) continue;
      const w = c.left[0], gives = new Map(), cells = [];
      e.cells.forEach((k, p) => {
        if (at(e, p)) return;
        const n = e.nums[p];
        if (alone == null || sees(v, n)) gives.set(n, w[p]); else cells.push([k, w[p]]);
      });
      best = { kind: "word", by: v, entry: i, word: w, fits: c.fits, gives: [...gives], cells, unknown: gives.size + cells.length };
    }
    if (best) { steps.push(best); take(best); continue; }
    // the last letter, for the last number (only with every letter in the grid, so the last letter is known)
    const open = [...present].filter(n => letter[n] == null);
    if (whole && open.length === 1 && alone == null && popcount(ALL & ~used) === 1) {
      const step = { kind: "last", by: solvers.find(v => sees(v, open[0])) ?? null, entry: occ[open[0]][0], fits: 0, gives: [[open[0], String.fromCharCode(A + 31 - Math.clz32(ALL & ~used))]], cells: [], unknown: 1 };
      steps.push(step); take(step);
      continue;
    }
    // a cross-check: a number its short lists leave one letter
    let step = null;
    for (const v of solvers) {
      for (const n of open) {
        if (!sees(v, n) || !mine(n)) continue;
        let can = ALL & ~used & ~(v == null ? 0 : theirs), lists = 0;
        for (const i of occ[n]) {
          const e = entries[i], c = consider(v, e);
          if (!c || c.left.length > pencil || !c.left.length) continue;
          const p = e.nums.indexOf(n);
          can &= c.left.reduce((m, w) => m | (1 << (w.charCodeAt(p) - A)), 0);
          lists++;
          if (popcount(can) <= 1) break;
        }
        if (lists && popcount(can) === 1) { step = { kind: "cross", by: v, entry: occ[n][0], fits: 0, gives: [[n, String.fromCharCode(A + 31 - Math.clz32(can))]], cells: [], unknown: 1 }; break; }
      }
      if (step) break;
    }
    if (!step) break;
    steps.push(step);
    take(step);
  }
  const found = Object.fromEntries([...present].filter(n => letter[n] != null).map(n => [n, letter[n]]));
  return { steps, known: found, done: !toFind().length };
}
