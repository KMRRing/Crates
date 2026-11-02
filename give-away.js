// A question whose right answer is a word of the question teaches nothing: "The Shanghai Futures Exchange trades copper
// in …" → Shanghai (2 November 2026, Korbi: "if the answer is a word that is in the question … just skip these
// questions. no need to rearrange the knowledge graph if it's worthwhile knowledge"). The knowledge stays where it is;
// the build leaves such a question out of the banks (tools/build-kb.mjs) and Punt's deal of Crates' clues
// skips them as it deals (punt-gen.js). Pure, so Node tests load it.

// words that carry nothing: an answer made only of them can't be "in" the question
const STOP = new Set(("the a an of in on at to for and or is are was were which who what where when how this that these those with from by as it its " +
  "into than then there their they has have had be been being his her him she he not no yes one two three four five about around over some more most " +
  "first last named called many much each every").split(" "));

/** Lower case, accents off. */
export const fold = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Every word of a text (letters and digits), folded. */
const words = s => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** The words of an answer that would give it away if the question had them: three letters or more, or with a digit in
 *  it, or a capital letter standing alone ("(C)", which tells Institute Cargo Clauses (A) from (C)); not the little words. */
function telling(answer) {
  const out = [];
  for (const raw of String(answer).split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const w = fold(raw);
    if (raw.length === 1 && /\p{Lu}/u.test(raw)) out.push({ w, capital: raw });
    else if (/\d/.test(w) || (w.length >= 3 && !STOP.has(w))) out.push({ w });
  }
  return out;
}

/** Whether a word is in the question's: the same word, or one the other's beginning (Tunis and Tunisia, baron and baroness). */
const inWords = (w, ws) => ws.some(t => t === w || (w.length >= 5 && t.length >= 5 && (t.startsWith(w) || w.startsWith(t))));

/** Whether every telling word of `name` is in `text`: the text names it. */
export function mentions(text, name) {
  const ts = telling(name);
  if (!ts.length) return false;
  const ws = words(text), capitals = new Set(String(text).split(/[^\p{L}\p{N}]+/u).filter(x => x.length === 1));
  return ts.every(t => (t.capital ? capitals.has(t.capital) : inWords(t.w, ws)));
}

/** A question of a bank ({ q, o: options, a: the right ones' indexes }) whose right answer is a word of it. A question
 *  that names its candidates ("Which is sweeter, Brut or Extra Dry?") gives nothing away: one of the wrong options is in it too. */
export function givesAway(item) {
  if (!item || typeof item.q !== "string" || !Array.isArray(item.o) || !Array.isArray(item.a) || !item.a.length) return false;
  const right = item.a.map(i => item.o[i]).filter(o => typeof o === "string");
  if (!right.length || !right.every(o => mentions(item.q, o))) return false;
  return !item.o.some((o, i) => !item.a.includes(i) && typeof o === "string" && mentions(item.q, o));
}
