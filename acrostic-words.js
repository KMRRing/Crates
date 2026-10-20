// The words Acrostic works with (README, Classics: Acrostic), for the generator and the solvers (acrostic-make.js,
// acrostic-solve.js), never the page: the answers are the clue bank's words (clues.js), each with its clues; the text's
// words are read against wordlist.js, the commonest tiers for a person's eye, a wider one for the proof that the
// letters fit together only one way. Each is unpacked the first time it's asked for.
import { cluedWords, cluesOf, MIN as CLUED_MIN, MAX as CLUED_MAX } from "./clues.js";
import { wordsOf, tierOf } from "./wordlist.js";

const A = 65;
export const code = ch => ch.charCodeAt(0) - A;

// ---------- the answers ----------
// Every clued word, upper case, with its tier (wordlist.js: 0 the commonest), its letters as codes and counts, and its
// clues. Indexed by length and by the letter the spine puts in it (the first, or the last for a telestich), and by its
// letters less that one, so the last two answers of a fill are found by looking up what's left.
let answerData = null;
export function answers() {
  if (answerData) return answerData;
  const list = [];
  // a word's letters less its spine letter (the first, or the last), as [letter, count, …] and as a mask: what it takes
  // from the text beside the spine
  const tail = (counts, less) => { const t = []; let m = 0; for (let c = 0; c < 26; c++) { const n = counts[c] - (c === less ? 1 : 0); if (n > 0) { t.push(c, n); m |= 1 << c; } } return { t, m }; };
  for (let n = CLUED_MIN; n <= CLUED_MAX; n++) for (const w of cluedWords(n)) {
    const word = w.toUpperCase(), codes = Uint8Array.from(word, code), counts = new Uint8Array(26);
    for (const c of codes) counts[c]++;
    const first = tail(counts, codes[0]), last = tail(counts, codes[n - 1]);
    list.push({ word, n, tier: Math.max(0, tierOf(w)), codes, counts, clues: cluesOf(w), tail: { first: first.t, last: last.t }, tmask: { first: first.m, last: last.m } });
  }
  // how hard each letter is to house: the rarer in the bank's words, the sooner a fill should find it a word
  const freq = new Float64Array(26);
  for (const x of list) for (let c = 0; c < 26; c++) freq[c] += x.counts[c];
  const total = freq.reduce((a, b) => a + b, 0);
  const rarity = Array.from(freq, f => Math.min(8, 0.04 / Math.max(1e-4, f / total)));
  const byEnd = { first: new Map(), last: new Map() }, bag = { first: new Map(), last: new Map() };
  list.forEach((x, id) => {
    for (const at of ["first", "last"]) {
      const s = at === "first" ? x.codes[0] : x.codes[x.n - 1];
      const k = s;
      if (!byEnd[at].has(k)) byEnd[at].set(k, []);
      byEnd[at].get(k).push(id);
      const key = bagKey(s, x.counts, s);
      if (!bag[at].has(key)) bag[at].set(key, []);
      bag[at].get(key).push(id);
    }
  });
  const byLength = new Map();
  list.forEach((x, id) => { if (!byLength.has(x.n)) byLength.set(x.n, []); byLength.get(x.n).push(id); });
  answerData = { list, byEnd, bag, byLength, rarity, has: new Set(list.map(x => x.word)) };
  return answerData;
}
/** The key of a bag of letters with the spine's letter set apart: "E:ADTW" (counts less one of `less`). */
export function bagKey(spine, counts, less = -1) {
  let k = String.fromCharCode(A + spine) + ":";
  for (let c = 0; c < 26; c++) { const n = counts[c] - (c === less ? 1 : 0); if (n > 0) k += String.fromCharCode(A + c).repeat(n); }
  return k;
}

// ---------- reading the text ----------
// Words of one and two letters, which wordlist.js (3 to 15) doesn't hold: the common ones a reader completes on sight,
// and a few more the proof allows, since a wider list is the stricter test.
const SHORT_COMMON = ["A", "I", "O", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "HE", "IF", "IN", "IS", "IT", "ME", "MY", "NO", "OF", "OH", "ON", "OR", "SO", "TO", "UP", "US", "WE"];
const SHORT_MORE = ["AH", "HA", "HI", "LO", "OX", "YE", "EH", "AD", "EX", "ID", "MA", "PA", "OW", "AX", "OK"];

/**
 * A lexicon of words of one length, for patterns: which words fit the letters known so far, and which letters each
 * unknown place can still take. Each (place, letter) is a bitset over the words, so a pattern is a few ANDs.
 */
export class Lexicon {
  constructor(words) {
    this.words = words;
    this.n = words[0]?.length || 0;
    this.W = Math.ceil(words.length / 32);
    this.codes = words.map(w => Uint8Array.from(w, code));
    this.bits = Array.from({ length: this.n }, () => Array.from({ length: 26 }, () => new Uint32Array(this.W)));
    this.codes.forEach((cs, i) => cs.forEach((c, p) => { this.bits[p][c][i >>> 5] |= 1 << (i & 31); }));
    this.index = new Map(words.map((w, i) => [w, i]));
  }
  has(word) { return this.index.has(word); }
  /**
   * The words that fit `masks` (a 26-bit mask of the letters allowed at each place; ALL for any), as a bitset: the
   * lexicon's own scratch, good until its next match (the solvers read it at once; a copy is theirs to keep).
   */
  match(masks) {
    const out = (this.out ||= new Uint32Array(this.W)), acc = (this.acc ||= new Uint32Array(this.W));
    let first = true;
    for (let p = 0; p < this.n; p++) {
      const m = masks[p];
      if (m === ALL) continue;
      const target = first ? out : acc;
      if (!(m & (m - 1))) target.set(this.bits[p][31 - Math.clz32(m)]);       // one letter: its bitset as it is
      else {
        target.fill(0);
        for (let c = 0; c < 26; c++) if (m & (1 << c)) { const b = this.bits[p][c]; for (let k = 0; k < this.W; k++) target[k] |= b[k]; }
      }
      if (!first) for (let k = 0; k < this.W; k++) out[k] &= acc[k];
      first = false;
    }
    if (first) { out.fill(0xFFFFFFFF); const extra = this.W * 32 - this.words.length; if (extra) out[this.W - 1] >>>= extra; }
    return out;
  }
  /** How many words a match holds, counting no further than `upto`. */
  count(set, upto = Infinity) {
    let n = 0;
    for (let k = 0; k < set.length && n < upto; k++) { let v = set[k]; while (v) { v &= v - 1; n++; } }
    return n;
  }
  /** The words of a match, no more than `upto`. */
  list(set, upto = Infinity) {
    const out = [];
    for (let k = 0; k < set.length && out.length < upto; k++) { let v = set[k]; while (v && out.length < upto) { const b = 31 - Math.clz32(v & -v); out.push(k * 32 + b); v &= v - 1; } }
    return out;
  }
  /** The letters place `p` takes among the words of a match: a 26-bit mask. */
  letters(set, p) {
    if (this.count(set, 48) < 48) { let m = 0; for (const i of this.list(set)) m |= 1 << this.codes[i][p]; return m; }
    let m = 0;
    for (let c = 0; c < 26; c++) { const b = this.bits[p][c]; for (let k = 0; k < this.W; k++) if (b[k] & set[k]) { m |= 1 << c; break; } }
    return m;
  }
}
export const ALL = (1 << 26) - 1;

const lexicons = new Map();
/**
 * The lexicon of `n`-letter words: "common", what a person completes on sight (wordlist.js tiers 0 to 2), or "proof",
 * the wider list the uniqueness proof reads against (to tier 3), the stricter test. null for a length with no words.
 */
export function lexicon(n, kind = "common") {
  const key = `${kind}:${n}`;
  if (!lexicons.has(key)) {
    const words = n <= 2 ? (kind === "proof" ? [...SHORT_COMMON, ...SHORT_MORE] : SHORT_COMMON).filter(w => w.length === n)
      : n <= 15 ? wordsOf(n, kind === "proof" ? 3 : 2).map(w => w.toUpperCase()) : [];
    lexicons.set(key, words.length ? new Lexicon(words) : null);
  }
  return lexicons.get(key);
}
