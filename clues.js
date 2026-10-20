// The clue bank for ordinary English words (README, Classics), shared by Crossword and Acrostic: the commonest words of
// wordlist.js (its tiers 0 to 2, SCOWL sizes 10 to 35) of 3 to 12 letters, both spellings' words only (never colour or
// color), each with up to two clues: an easy one, a plain definition, and a harder one, another sense or a fair lateral
// reading. The clues are in clues-data.js, unpacked a length at a time the first time a game asks for that length.
//
//   cluesOf(word)          [{ text, d }]: d is 1 for the easy clue, 2 for the harder, the easy one first; [] when the
//                          bank has none. Any case. The same frozen array comes back each time.
//   hasClue(word)          whether the bank has a clue for it.
//   cluedWords(n, upto)    the words of n letters that have a clue, commonest first: by wordlist.js tier, none rarer
//                          than tier `upto` (2, all of them, by default), alphabetical within a tier. Lower case, the
//                          same frozen array each time.
//   MIN, MAX               the lengths the bank covers, 3 and 12.
import { CLUES } from "./clues-data.js";

export const MIN = 3, MAX = 12;
const RAREST = 2, NONE = Object.freeze([]);

const unpacked = new Map();
function lengthOf(n) {
  let u = unpacked.get(n);
  if (!u) {
    const clues = new Map(), tiers = (CLUES[n] || []).map(block => {
      const words = [];
      for (const line of block.split("\n")) {
        if (!line) continue;
        const [word, easy, hard] = line.split("|"), list = [];
        if (easy) list.push(Object.freeze({ text: easy, d: 1 }));
        if (hard) list.push(Object.freeze({ text: hard, d: 2 }));
        clues.set(word, Object.freeze(list));
        words.push(word);
      }
      return words;
    });
    u = { clues, tiers };
    unpacked.set(n, u);
  }
  return u;
}

export function cluesOf(word) {
  const w = String(word ?? "").toLowerCase();
  return w.length >= MIN && w.length <= MAX ? lengthOf(w.length).clues.get(w) || NONE : NONE;
}

export const hasClue = word => cluesOf(word).length > 0;

const lists = new Map();
export function cluedWords(n, upto = RAREST) {
  n = Number(n);
  if (!(Number.isInteger(n) && n >= MIN && n <= MAX)) return NONE;
  const key = `${n}:${upto}`;
  if (!lists.has(key)) lists.set(key, Object.freeze(lengthOf(n).tiers.slice(0, Math.max(0, upto + 1)).flat()));
  return lists.get(key);
}
