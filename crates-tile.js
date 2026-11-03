// How a word sits on a tile of the Crates/Lots board (crates-board.js): one type size for every tile, so a word too long
// for a line is broken at a sensible point, never shrunk. Pure, so tests/crates-tile.mjs can run it in Node.

/** The longest run of letters a tile's line holds at the board's type size (checked on the widest words in the bank). */
export const LINE = 9;

const SOFT = "­";
const ONSET = /^(ch|sh|th|ph|ck|ng|gh|sc|sk|st|sp|sw|[bcdfgkptw]r|[bcfgps]l)$/;
const isVowel = ch => /[aeiouyäöüéèêáàíóúâîôûæøå]/i.test(ch);

/** A long word with soft hyphens (drawn only where a line breaks) at syllable-like boundaries near its middle: between
 *  two consonants (Hammer-fest) is best, after a vowel before a consonant (Anti-bacterial) next. Cuts again until no run
 *  is longer than LINE. */
function cut(word) {
  if (word.length <= LINE) return word;
  const mid = word.length / 2;
  let best = Math.round(mid), bestScore = Infinity;
  const from = word.length <= 2 * LINE ? Math.max(3, word.length - LINE) : 3;         // two runs when two will do
  for (let i = from; i <= (word.length <= 2 * LINE ? Math.min(LINE, word.length - 3) : word.length - 3); i++) {
    const a = word[i - 1], b = word[i], pair = (a + b).toLowerCase(), ahead = (b + (word[i + 1] || "")).toLowerCase();
    let cost = 6;
    if (/[a-zß]/.test(a) && /[A-Z]/.test(b)) cost = -6;                       // TotalEnergies, ArcelorMittal
    else if (!isVowel(a) && !isVowel(b)) cost = ONSET.test(pair) ? 8 : 1;     // never inside sch, th, tr, ck...
    else if (isVowel(a) && !isVowel(b)) cost = isVowel(word[i + 1] || "") || ONSET.test(ahead) ? 0 : 3; // Anti-bacterial, Hydro-treating
    const score = cost + Math.abs(i - mid) * 0.6;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return cut(word.slice(0, best)) + SOFT + cut(word.slice(best));
}

/** A tile's text ready to draw: every run of letters longer than LINE (between spaces and hyphens) cut with soft hyphens. */
export const tileText = text => text.replace(/­/g, "").replace(/[^ -]+/g, cut);

/** The runs a tile's text draws as, split at spaces, hyphens and soft hyphens: none is longer than LINE (the rule the test holds). */
export const runsOf = text => tileText(text).split(/[ ­-]/).filter(Boolean);
