// The suite's word list (wordlist.js, README Classics): every length from 3 to 15 is there, its words a to z only,
// sorted, each once, each with a tier; the tiers nest (a common word is in every wider list); a common word is common
// and a non-word isn't a word; the words only one spelling has are marked; case doesn't matter; and Slate's own common
// words are all among the commonest here, but for the two the offensive-terms list takes; and an offensive word's
// plurals and tenses are left out with it, while words that only look like them (butter, spiced) stay.
import { TIERS, MIN, MAX, RAREST, wordsOf, tierOf, isWord, isVariant } from "../wordlist.js";
import { WORDS } from "../wordlist-data.js";
import { EASY } from "../slate-gen.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(TIERS.length === 8 && TIERS.every((t, i) => !i || t > TIERS[i - 1]) && RAREST === 7 && MIN === 3 && MAX === 15, "eight tiers, SCOWL sizes rising; words of 3 to 15 letters");
{
  let packed = true, clean = true, sorted = true, tiered = true;
  for (let n = MIN; n <= MAX; n++) {
    const [run, tiers] = WORDS[n] || ["", ""];
    if (!tiers.length || run.length !== tiers.length * n) packed = false;
    if (!/^[a-z]*$/.test(run) || !/^[a-hA-H]*$/.test(tiers)) clean = false;
    const all = wordsOf(n);
    for (let i = 1; i < all.length; i++) if (!(all[i - 1] < all[i])) { sorted = false; break; }
    for (let t = 1; t <= RAREST; t++) {
      const narrow = wordsOf(n, t - 1), wide = new Set(wordsOf(n, t));
      if (narrow.some(w => !wide.has(w)) || wide.size < narrow.length) tiered = false;
    }
  }
  check(packed, "every length has words, each the length it's filed under, one tier letter each");
  check(clean, "a to z only; tiers a to h, upper case for one spelling's only");
  check(sorted, "alphabetical, each word once");
  check(tiered, "the tiers nest: a word in a narrower list is in every wider one");
}
check(["house", "water", "people", "about", "cat"].every(w => tierOf(w) === 0), "everyday words are in the commonest tier");
check(["quixotic", "obfuscate"].every(w => tierOf(w) > 1 && isWord(w)), "rarer words are words, in a rarer tier");
check(!isWord("xyzzy") && !isWord("qzx") && tierOf("ab") === -1 && tierOf("a".repeat(16)) === -1, "non-words, and words too short or too long, aren't words");
check(tierOf("HOUSE") === tierOf("house") && isWord("Water"), "case doesn't matter");
check(isVariant("colour") && isVariant("color") && isVariant("theatre") && !isVariant("house") && !isVariant("xyzzy"), "spellings only one side has are marked");
check(!wordsOf(6, RAREST, { variants: false }).includes("colour") && wordsOf(6).includes("colour"), "and can be left out");
check(wordsOf(5, 0) === wordsOf(5, 0) && Object.isFrozen(wordsOf(5, 0)), "a list comes back the same each time, and can't be changed");
check(wordsOf(2).length === 0 && wordsOf(16).length === 0, "no list outside 3 to 15 letters");
check(!isWord("bastards") && !isWord("orgies"), "an offensive word's plurals and tenses are left out with it");
check(["butter", "spiced", "titter", "cocked", "dicker", "monger", "sexes"].every(w => isWord(w)), "words that only look like those forms stay");
{
  // Slate's common words come from SCOWL sizes 10 to 20 too; two it keeps are on the offensive-terms list here
  const missing = Object.values(EASY).flat().map(w => w.toLowerCase()).filter(w => !isWord(w, 1));
  check(missing.length <= 2, `Slate's common words are among the commonest here (${missing.length} left out)`);
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
