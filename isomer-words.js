// Isomer's English (README, Isomer): which ordinary words can be a jumble's answer, how hard each is to unjumble, and
// how to jumble one. Pure, no page; tests/isomer.mjs runs it.
//
// Difficulty is measured the way people unjumble: by trying the arrangements that look most like English first (a
// common start, a common ending, familiar pairs and triples of letters) and stopping at the first one that is a word
// they know. `depth` is how many arrangements such a solver tries before it reaches the answer: BLACK and BEFORE fall
// into place at once (1), ISLAND waits behind 66 likelier-looking strings, ETHNIC behind 167. What looks like English is
// a letter trigram model (each letter's chance after the two before it, a word's start and end counting as letters)
// trained on the word list's common words.
import { wordsOf, isWord, tierOf, RAREST } from "./wordlist.js";

const A = 27, EDGE = 26;                 // 26 letters and the edge of a word
const code = ch => ch.charCodeAt(0) - 97;
const MODEL_TIER = 3;                    // the words a reader's sense of spelling comes from: SCOWL 40 and commoner

// ---------- the model ----------
let LOGP = null;
function model() {
  if (LOGP) return LOGP;
  const tri = new Float64Array(A * A * A), bi = new Float64Array(A * A), uni = new Float64Array(A);
  for (let n = 3; n <= 12; n++) for (const w of wordsOf(n, MODEL_TIER)) {
    let a = EDGE, b = EDGE;
    for (let i = 0; i <= n; i++) {
      const c = i < n ? code(w[i]) : EDGE;
      tri[(a * A + b) * A + c]++; bi[b * A + c]++; uni[c]++;
      a = b; b = c;
    }
  }
  const triCtx = new Float64Array(A * A), biCtx = new Float64Array(A);
  let all = 0;
  for (let i = 0; i < A * A * A; i++) triCtx[Math.floor(i / A)] += tri[i];
  for (let i = 0; i < A * A; i++) biCtx[Math.floor(i / A)] += bi[i];
  for (let c = 0; c < A; c++) all += uni[c];
  // interpolated: mostly the trigram, a little of the pair and the letter alone, so a triple never seen isn't impossible
  LOGP = new Float64Array(A * A * A);
  for (let ab = 0; ab < A * A; ab++) for (let c = 0; c < A; c++) {
    const b = ab % A, p3 = triCtx[ab] ? tri[ab * A + c] / triCtx[ab] : 0, p2 = biCtx[b] ? bi[b * A + c] / biCtx[b] : 0;
    LOGP[ab * A + c] = Math.log(0.7 * p3 + 0.25 * p2 + 0.05 * (uni[c] + 1) / (all + A));
  }
  return LOGP;
}
/** How much a string looks like English (a log-probability: higher is more word-like). */
export function looks(s) {
  const L = model();
  let a = EDGE, b = EDGE, sum = 0;
  for (let i = 0; i <= s.length; i++) {
    const c = i < s.length ? code(s[i]) : EDGE;
    sum += L[(a * A + b) * A + c];
    a = b; b = c;
  }
  return sum;
}

/** Every distinct arrangement of some letters, each passed to fn as an array of letter codes (reused: copy to keep). */
function eachArrangement(codes, fn) {
  const counts = new Array(A).fill(0), cur = [];
  for (const c of codes) counts[c]++;
  const kinds = counts.map((n, c) => (n ? c : -1)).filter(c => c >= 0);
  const go = () => {
    if (cur.length === codes.length) { fn(cur); return; }
    for (const c of kinds) if (counts[c]) { counts[c]--; cur.push(c); go(); cur.pop(); counts[c]++; }
  };
  go();
}
const depths = new Map();
/**
 * How deep the solver goes before it reaches a word: 1 + the arrangements of its letters that look more like English.
 * Every arrangement is scored as it's built (the model's terms added one letter at a time), so a six-letter word's 720
 * cost well under a millisecond.
 */
export function depthOf(word) {
  let d = depths.get(word);
  if (d != null) return d;
  const L = model(), target = looks(word) + 1e-9, codes = [...word].map(code), counts = new Array(A).fill(0);
  for (const c of codes) counts[c]++;
  const kinds = counts.map((n, c) => (n ? c : -1)).filter(c => c >= 0), n = codes.length;
  let higher = 0;
  const go = (len, a, b, sum) => {
    if (len === n) { if (sum + L[(a * A + b) * A + EDGE] > target) higher++; return; }
    for (const c of kinds) if (counts[c]) { counts[c]--; go(len + 1, b, c, sum + L[(a * A + b) * A + c]); counts[c]++; }
  };
  go(0, EDGE, EDGE, 0);
  d = higher + 1;
  depths.set(word, d);
  return d;
}

// ---------- which words a jumble may be ----------
const sig = w => [...w].sort().join("");
const index = new Map();       // length -> Map(letters sorted -> how many words, any tier, either spelling)
/** How many words of the widest list (SCOWL 70, both spellings) these letters spell, counted up to two: the solver's
 *  count of a jumble's solutions. */
export function spellings(letters) {
  const n = letters.length;
  if (!index.has(n)) {
    const m = new Map();
    for (const w of wordsOf(n, RAREST)) { const s = sig(w); m.set(s, Math.min(2, (m.get(s) || 0) + 1)); }
    index.set(n, m);
  }
  return index.get(n).get(sig(letters)) || 0;
}
/** A word made from another by an ending (a plural, -ed, -ing, -est): a jumble of one gives itself away by its ending. */
export function inflected(w) {
  const is = s => s.length >= 3 && isWord(s);
  if (w.endsWith("s") && !w.endsWith("ss") && (is(w.slice(0, -1)) || (w.endsWith("es") && is(w.slice(0, -2))) || (w.endsWith("ies") && is(`${w.slice(0, -3)}y`)))) return true;
  if (w.endsWith("ed") && (is(w.slice(0, -2)) || is(w.slice(0, -1)) || (w.endsWith("ied") && is(`${w.slice(0, -3)}y`)) || (w.at(-3) === w.at(-4) && is(w.slice(0, -3))))) return true;
  if (w.endsWith("ing") && (is(w.slice(0, -3)) || is(`${w.slice(0, -3)}e`) || (w.at(-4) === w.at(-5) && is(w.slice(0, -4))))) return true;
  if (w.endsWith("est") && (is(w.slice(0, -3)) || is(w.slice(0, -2)))) return true;
  return false;
}
const pools = new Map();
/**
 * The words of `n` letters a jumble may be, no rarer than tier `tier`: ordinary words (one spelling's only left out, so
 * nobody's answer is the other side's typo), no inflections, and exactly one arrangement of their letters spelling a
 * word, so a jumble has one answer. Each with its tier and its letters counted.
 */
export function pool(n, tier) {
  const key = `${n}:${tier}`;
  if (!pools.has(key)) {
    const out = [];
    for (const w of wordsOf(n, tier, { variants: false })) {
      if (inflected(w) || spellings(w) !== 1) continue;
      const counts = new Uint8Array(26);
      for (const ch of w) counts[code(ch)]++;
      out.push({ w, tier: tierOf(w), counts });
    }
    pools.set(key, out);
  }
  return pools.get(key);
}
/** Whether a word (its letter counts) holds every letter of a group, as many times as the group has it. */
export const holds = (counts, group) => {
  const need = new Uint8Array(26);
  for (const ch of group) if (++need[code(ch)] > counts[code(ch)]) return false;
  return true;
};

// ---------- jumbling ----------
const pairsOf = s => new Set([...s].slice(1).map((c, i) => s[i] + c));
/** A jumble that hides its answer: not the word, not any word, no letter where the answer has it, and no pair of
 *  neighbours the answer has (FLOAT never jumbles to TLOAF: LO and OA show through). */
export function hides(jumble, answer) {
  if (jumble === answer || isWord(jumble)) return false;
  for (let i = 0; i < answer.length; i++) if (jumble[i] === answer[i]) return false;
  const pairs = pairsOf(answer);
  for (let i = 1; i < jumble.length; i++) if (pairs.has(jumble[i - 1] + jumble[i])) return false;
  return true;
}
const hideable = new Map();
/** Whether any jumble of a word hides it (BANANA's and KNOCK's letters can't help keeping a pair of neighbours): a
 *  word that can't be hidden isn't dealt. */
export function canHide(word) {
  if (hideable.has(word)) return hideable.get(word);
  let found = false;
  const counts = new Array(A).fill(0), cur = [], n = word.length, pairs = pairsOf(word);
  for (const ch of word) counts[code(ch)]++;
  // built a letter at a time, leaving out at once a letter in its own place or a pair the word has
  const go = () => {
    if (found) return;
    if (cur.length === n) { found = hides(String.fromCharCode(...cur.map(c => c + 97)), word); return; }
    for (let c = 0; c < 26 && !found; c++) {
      if (!counts[c] || code(word[cur.length]) === c || (cur.length && pairs.has(String.fromCharCode(cur.at(-1) + 97, c + 97)))) continue;
      counts[c]--; cur.push(c); go(); cur.pop(); counts[c]++;
    }
  };
  go();
  hideable.set(word, found);
  return found;
}
/**
 * The jumble a word is shown as, by `style`: "plain" (a jumble that looks like no word: the eye isn't led astray),
 * "lure" (the most word-like jumble that still hides the answer: a reader fixes on a wrong reading, as solvers are known
 * to with jumbles that look like English) or "any". r: a seeded random number generator.
 */
export function jumble(word, r, style = "any") {
  const fair = [];
  eachArrangement([...word].map(code), cur => { const s = String.fromCharCode(...cur.map(c => c + 97)); if (hides(s, word)) fair.push(s); });
  if (!fair.length) {                                           // a word too short or too repetitive to hide fully: no letter in place
    const loose = [];
    eachArrangement([...word].map(code), cur => { const s = String.fromCharCode(...cur.map(c => c + 97)); if (s !== word && !isWord(s) && [...s].every((c, i) => c !== word[i])) loose.push(s); });
    return loose.length ? loose[Math.floor(r() * loose.length)] : [...word].reverse().join("");
  }
  if (style === "any" || fair.length < 4) return fair[Math.floor(r() * fair.length)];
  const ranked = fair.map(s => ({ s, v: looks(s) })).sort((a, b) => b.v - a.v || (a.s < b.s ? -1 : 1));
  if (style === "lure") return ranked[Math.floor(r() * Math.min(3, ranked.length))].s;
  const low = ranked.slice(Math.floor(ranked.length / 2));
  return low[Math.floor(r() * low.length)].s;
}
/**
 * The order a longer run of letters stands in (the circled letters, in the tray), by trying shuffles, since there are
 * too many arrangements to list: no pair of neighbours any of `answers` has. Returns the shuffled indices.
 */
export function jumbleLong(letters, answers, r) {
  const pairs = new Set(answers.flatMap(w => [...pairsOf(w)])), whole = answers.join("");
  const spell = order => order.map(i => letters[i]).join("");
  const ok = s => s !== whole && [...s].slice(1).every((c, i) => !pairs.has(s[i] + c));
  let fallback = null;
  for (let t = 0; t < 400; t++) {
    const order = letters.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const s = spell(order);
    if (ok(s)) return order;
    if (!fallback && s !== whole) fallback = order;
  }
  return fallback || letters.map((_, i) => letters.length - 1 - i);
}
