// Codeword's mystery words (README, Codeword): under the grid, a row of numbers that spells a thing of one kind from
// the knowledge base once its letters are cracked, as a puzzle magazine's codeword hides a word in shaded squares;
// knowing the kind is a way in ("a country of six letters ending in A"). Read from the built banks, never kb/ itself:
// countries from Punt's flags bank (with how well known each is), the commodities and cities from kb-index.js, the
// knowledge base's things by subject. Names of one word, 4 to 12 letters, a to z; a commodity must also be a word
// (copper, cocoa, naphtha), which leaves out the trade's abbreviations (HVO, UCOME, RINs). Loaded only when chosen.
import { MATHS as FLAGS } from "./flags-bank.js";
import { SUBJECTS, SUBJECT } from "./kb-index.js";
import { isWord } from "./wordlist.js";

export const THEMES = {
  countries: { label: "Country", one: "country" },
  commodities: { label: "Commodity", one: "commodity" },
  cities: { label: "City", one: "city" },
};
const fit = w => /^[a-z]{4,12}$/.test(w);
const ofSubject = label => { const i = SUBJECTS.findIndex(s => s.label === label); return Object.entries(SUBJECT).filter(([, s]) => s === i).map(([id]) => id); };
let made = null;
function lists() {
  if (made) return made;
  const countries = FLAGS.map(q => ({ w: String(q.o[q.a[0]]).toLowerCase(), known: q.lv })).filter(c => fit(c.w));
  made = {
    countries: { all: countries.map(c => c.w), well: countries.filter(c => c.known === "ea").map(c => c.w), fair: countries.filter(c => c.known !== "ha").map(c => c.w) },
    commodities: (() => { const w = ofSubject("Commodities").filter(id => fit(id) && isWord(id)); return { all: w, well: w, fair: w }; })(),
    cities: (() => { const w = ofSubject("Cities").filter(fit); return { all: w, well: w, fair: w }; })(),
  };
  return made;
}
/**
 * A kind's words: { id, all (every one there is), pool (the ones a mystery may be at this level: the well-known
 * countries on Easy and Medium, all but the obscure on Hard and Expert) }; null for none.
 */
export function themeOf(id, level = "medium") {
  const t = THEMES[id] && lists()[id];
  if (!t) return null;
  return { id, all: t.all, pool: level === "easy" || level === "medium" ? t.well : t.fair };
}
