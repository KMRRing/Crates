// The suite's English word list (README, Classics): every word of 3 to 15 letters, a to z, with how common it is. A
// word's tier is an index into TIERS, the SCOWL sizes it comes from: tier 0 (size 10) is the commonest few thousand
// words, tier 7 (size 70) the widest list kept. A word game takes its answers from the common tiers and accepts a wider
// one, and may leave out the words only one spelling has (colour, color) so nobody's answer is the other side's typo.
import { TIERS, WORDS } from "./wordlist-data.js";

export { TIERS };
export const MIN = 3, MAX = 15, RAREST = TIERS.length - 1;

// a length's words are unpacked the first time a game asks for it
const unpacked = new Map();
function lengthOf(n) {
  let u = unpacked.get(n);
  if (!u) {
    const [run, tiers] = WORDS[n] || ["", ""], count = tiers.length, list = new Array(count), tier = new Uint8Array(count), variant = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      list[i] = run.slice(i * n, i * n + n);
      const c = tiers.charCodeAt(i), upper = c < 97;
      tier[i] = c - (upper ? 65 : 97);
      variant[i] = upper ? 1 : 0;
    }
    u = { list, tier, variant, at: new Map(list.map((w, i) => [w, i])) };
    unpacked.set(n, u);
  }
  return u;
}

const lists = new Map();
/**
 * The words of `n` letters no rarer than tier `upto`, in alphabetical order. `variants: false` leaves out the words
 * only one spelling has. The same array comes back each time it's asked for: don't change it.
 */
export function wordsOf(n, upto = RAREST, { variants = true } = {}) {
  if (!(n >= MIN && n <= MAX)) return [];
  const key = `${n}:${upto}:${variants}`;
  if (!lists.has(key)) {
    const { list, tier, variant } = lengthOf(n);
    lists.set(key, Object.freeze(list.filter((_, i) => tier[i] <= upto && (variants || !variant[i]))));
  }
  return lists.get(key);
}

/** Where a word is in its length's list, or null when it isn't a word here (any case is fine). */
function find(word) {
  const w = String(word ?? "").toLowerCase();
  if (w.length < MIN || w.length > MAX) return null;
  const u = lengthOf(w.length), i = u.at.get(w);
  return i == null ? null : { u, i };
}
/** A word's tier, or -1 when it isn't a word here. */
export const tierOf = word => { const f = find(word); return f ? f.u.tier[f.i] : -1; };
/** Whether it's a word, no rarer than tier `upto`. */
export const isWord = (word, upto = RAREST) => { const t = tierOf(word); return t >= 0 && t <= upto; };
/** Whether only one spelling of English has it (colour, color). */
export const isVariant = word => { const f = find(word); return !!f && f.u.variant[f.i] === 1; };
