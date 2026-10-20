// Writes wordlist-data.js, the words behind wordlist.js (README, Classics), from SCOWL as the npm package
// wordlist-english packs it, less every word on a list of offensive terms (the npm package naughty-words). A Claude
// runs it, not Korbi: install both packages somewhere outside the repo, then
//   node tools/build-wordlist.mjs <that node_modules folder>
// Kept: every word of 3 to 15 letters, a to z only (SCOWL writes names with a capital, so they fall away with
// abbreviations, hyphens and apostrophes), with the SCOWL size it first appears at and whether it is one spelling's only.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/build-wordlist.mjs <node_modules folder>"); process.exit(1); }
const need = createRequire(path.resolve(dir, "wordlist.cjs"));
// words that list catches in their everyday senses (an escort, a hooker in rugby, a swinger in golf, pegging a currency)
const ALLOW = new Set(["escort", "snatch", "suck", "sucks", "domination", "scat", "skeet", "grope", "hooker", "swinger", "eunuch", "playboy",
  "sexual", "sexuality", "sexually", "fingering", "snowballing", "shrimping", "pegging", "bareback", "nude", "nudity", "voyeur", "sadism",
  "monger", "mongers",
  // and words that only look like an offensive word's forms (butter, a cocker spaniel, to dicker, spiced, a titter, a titer)
  "butt", "butts", "butted", "butter", "butters", "buttes", "butting", "cocked", "cocker", "cockers", "cocking", "dicker", "dickers",
  "spiced", "spicer", "spices", "spicing", "titter", "titters", "titer", "titers", "sexes", "smuts"]);
const LISTS = need("wordlist-english"), BAD = new Set(need("naughty-words").en.map(w => w.toLowerCase()).filter(w => !ALLOW.has(w)));
const SIZES = [10, 20, 35, 40, 50, 55, 60, 70], MIN = 3, MAX = 15, LETTERS = /^[a-z]+$/;
// SCOWL files a word's plurals and tenses beside it, so an offensive word's own forms (its -s, -es, -ed, -ing, -er, -ers,
// a y turned ies or ied, a doubled consonant) are left out with it
const STEMS = [["", ""], ["s", ""], ["es", ""], ["ed", ""], ["d", ""], ["ing", ""], ["er", ""], ["ers", ""], ["ies", "y"], ["ied", "y"]];
const blocked = w => !ALLOW.has(w) && STEMS.some(([end, put]) => {
  if (!w.endsWith(end)) return false;
  const stem = w.slice(0, w.length - end.length) + put;
  return BAD.has(stem) || (end && /(.)\1$/.test(stem) && BAD.has(stem.slice(0, -1)));
});
const NOTICE = fs.readFileSync(path.join(dir, "wordlist-english", "Copyright"), "utf8").split("\n\n").slice(0, 2).join("\n\n");

// "english/<size>" is the words every spelling shares; "english/american/<size>" and "english/british/<size>" the
// ones only that spelling has. A word's tier is the first size it appears at, in any of the three.
const tier = new Map(), shared = new Set();
SIZES.forEach((size, t) => {
  for (const [name, common] of [[`english/${size}`, true], [`english/american/${size}`, false], [`english/british/${size}`, false]]) {
    for (const w of LISTS[name] || []) {
      if (w.length < MIN || w.length > MAX || !LETTERS.test(w) || blocked(w)) continue;
      if (!tier.has(w)) tier.set(w, t);
      if (common) shared.add(w);
    }
  }
});

const byLength = {};
for (const w of [...tier.keys()].sort()) (byLength[w.length] ??= []).push(w);
const WORDS = {};
for (let n = MIN; n <= MAX; n++) {
  const list = byLength[n] || [];
  // one letter per word for its tier, a for size 10 to h for size 70; upper case for one spelling's only
  WORDS[n] = [list.join(""), list.map(w => String.fromCharCode((shared.has(w) ? 97 : 65) + tier.get(w))).join("")];
}

const out = `// The words of wordlist.js (README, Classics), written by tools/build-wordlist.mjs from SCOWL; don't edit, rebuild.
// For each length: its words run together in alphabetical order, then one letter per word for its tier: a to h for
// SCOWL sizes 10 to 70, upper case when the word is one spelling's only (colour, color).
//
${NOTICE.split("\n").map(l => `// ${l}`.trimEnd()).join("\n")}
export const TIERS = ${JSON.stringify(SIZES)};
export const WORDS = ${JSON.stringify(WORDS)};
`;
fs.writeFileSync(new URL("../wordlist-data.js", import.meta.url), out);
const counts = Object.entries(WORDS).map(([n, [, t]]) => `${n}:${t.length}`).join(" ");
console.log(`wordlist-data.js: ${tier.size} words (${counts}), ${(out.length / 1024).toFixed(0)} KB`);
