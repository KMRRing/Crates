// Isomer's knowledge (README, Isomer): the final answers and the themes, from Crates' bank (bank.js, read through
// core.js), every one a clue link of the knowledge base: a thing, the country or commodity it points to, its
// hand-written hint, its topics and difficulty. Pure, no page; tests/isomer.mjs runs it.
//
// A final is asked one of two ways, the two Korbi likes: the thing from its hint and its country or commodity ("A grape
// brandy it claims as its own · Peru" → PISCO), or the country or commodity from one of its clues ("Pisco: a grape
// brandy it claims as its own" → PERU). A theme is a country or commodity with four of its clues, each short enough to
// be a jumble.
import { BANK, TOPICS, GROUPS } from "./core.js";
import { pairKey } from "./known.js";
import { spellings } from "./isomer-words.js";
import { isWord } from "./wordlist.js";

export const TOPIC = Object.fromEntries([...TOPICS.country, ...TOPICS.commodity]);
const GROUP = Object.fromEntries([...GROUPS.country, ...GROUPS.commodity]);
export const NOUN = { country: "country", commodity: "commodity" };

/**
 * A name as a final's letters: { letters, parts } (the letters a to z, and how many in each word: Hudson's Bay is
 * hudsonsbay, 7 and 3), or null when it can't be one: digits or signs, an acronym (OPEC, LNG exports), a word of one
 * letter (K-pop), an apostrophe other than a possessive's. Accents go (Curaçao is curacao); a hyphen parts words.
 */
export function lettersOf(name) {
  const s = String(name || "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[’‘]/g, "'");
  if (/[^A-Za-z' -]/.test(s) || /[A-Z]{2}/.test(s)) return null;
  const words = s.replace(/'s\b/g, "s").split(/[\s-]+/).filter(Boolean);
  if (!words.length || words.some(w => w.length < 2 || w.includes("'"))) return null;
  return { letters: words.join("").toLowerCase(), parts: words.map(w => w.length) };
}
const sorted = s => [...s].sort().join("");

// a clue gives its answer away if it names it ("White gold" under Gold), and a hint its clue if it says it. Compared
// in a plain form (lower case, no accents, words parted by single spaces), cheaper than typing.js's for six thousand clues.
const plain = s => ` ${String(s || "").normalize("NFD").replace(/[^ -~]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const NAMES = BANK.map(a => [a.name, ...(a.aliases || [])].filter(n => n.length > 3).map(n => plain(n).trim()));
const names = (text, a) => { const t = plain(text); return NAMES[a].some(n => t.includes(n)); };
const says = (hint, w) => plain(hint).includes(plain(w));

/** The answer's name as letters, if a final can be it (not UK, UAE or HVO: acronyms). */
const ANSWER = BANK.map(a => lettersOf(a.name));
const topicsOf = w => (w.topics || []).filter(t => TOPIC[t]);
const entitiesOf = (a, w) => [...new Set([w?.entity, BANK[a].entity].filter(Boolean))];

let clueLetters = null, finals = null;
/** Each clue's name as letters, by answer and clue. */
const CLUE = () => (clueLetters ||= BANK.map(a => a.words.map(w => lettersOf(w.w))));
/**
 * Every final there is: { kind: "name" (the thing) | "behind" (its country or commodity), a, i (the answer and its
 * clue, by their places in the bank), cat, text (as shown once found), letters, parts, d, topics, hint, clue (the
 * thing's name), context (what the clue is shown with) }. Made the first time a puzzle is dealt, not when the page
 * opens: a puzzle kept from before draws without it.
 */
export function finalsAll() {
  if (finals) return finals;
  finals = [];
  BANK.forEach((a, ai) => {
    // how many of the answer's clues spell each set of letters: a thing shown with its answer is one of those clues
    const spelled = new Map();
    for (const l of CLUE()[ai]) if (l) { const s = sorted(l.letters); spelled.set(s, (spelled.get(s) || 0) + 1); }
    const mine = ANSWER[ai];
    a.words.forEach((w, wi) => {
      if (names(w.w, ai) || says(w.hint, w.w)) return;         // nothing to find if the clue gives itself away
      const base = { a: ai, i: wi, cat: a.cat, d: w.d || 2, topics: topicsOf(w), hint: w.hint, clue: w.w };
      const thing = CLUE()[ai][wi];
      if (thing && thing.letters.length >= 4 && spelled.get(sorted(thing.letters)) === 1) finals.push({ ...base, kind: "name", text: w.w, ...thing, context: a.name });
      // its country or commodity, from the clue: not if the hint names it, nor if another answer the clue fits spells the same
      if (mine && mine.letters.length >= 4 && !names(w.hint, ai)
        && !(w.alt || []).some(x => ANSWER[x] && sorted(ANSWER[x].letters) === sorted(mine.letters))) finals.push({ ...base, kind: "behind", text: a.name, ...mine, context: w.w });
    });
  });
  return finals;
}

/** A final's clue as it's shown: a tag line (the answer and topic, or what kind of thing it is) and the hint. */
export function clueOf(f) {
  const topic = f.topics.map(t => TOPIC[t]).filter(Boolean)[0];
  if (f.kind === "name") return { tag: `${f.context}${topic ? ` · ${topic}` : ""}`, text: f.hint };
  return { tag: `A ${NOUN[f.cat]}${topic ? ` · ${topic}` : ""}`, text: `${f.context}: ${f.hint}` };
}
/** The two halves of a final's clue, for a pair who each hold one (README, Isomer, Together). */
export function halvesOf(f) {
  const c = clueOf(f);
  return f.kind === "name" ? [{ text: f.hint }, { tag: c.tag }] : [{ text: f.context }, { tag: c.tag, text: f.hint }];
}
/** In Double, the thing's country or commodity, clued by what the thing is to it. */
export function partnerOf(f) {
  const a = BANK[f.a];
  return { kind: "behind", a: f.a, i: f.i, cat: a.cat, d: f.d, topics: f.topics, hint: f.hint, clue: f.clue, text: a.name, ...ANSWER[f.a], context: f.clue };
}
export const pairedClue = f => ({ tag: `Its ${NOUN[f.cat]}${GROUP[BANK[f.a].group] ? ` · ${GROUP[BANK[f.a].group]}` : ""}`, text: `The ${NOUN[f.cat]} the first answer points to` });
/** Whether a "name" final's answer can stand beside it in Double (UK and HVO can't: acronyms). */
export const pairable = f => f.kind === "name" && !!ANSWER[f.a] && ANSWER[f.a].letters.length >= 4;

// ---------- themes ----------
/** A theme's clue can be a jumble: one word of four to eight letters whose letters spell no English word but itself
 *  (CHOPIN can't: PHONIC; KURTA can't: KRAUT). */
function jumbleable(l) {
  if (!l || l.parts.length !== 1 || l.letters.length < 4 || l.letters.length > 8) return null;
  const words = spellings(l.letters);
  return words === 0 || (words === 1 && isWord(l.letters)) ? l.letters : null;
}
let themes = null;
/** Every answer a theme can be, with its clues that can be jumbles: { a, cat, letters, parts, text, clues: [{ i, letters, text, hint, d, topics }] }. */
export function themesAll() {
  if (themes) return themes;
  themes = [];
  BANK.forEach((a, ai) => {
    if (!ANSWER[ai] || ANSWER[ai].letters.length < 4 || ANSWER[ai].letters.length > 10) return;
    const clues = [];
    a.words.forEach((w, wi) => {
      if (names(w.w, ai) || says(w.hint, w.w)) return;
      const letters = jumbleable(CLUE()[ai][wi]);
      if (letters && !clues.some(c => c.letters === letters)) clues.push({ i: wi, letters, text: w.w, hint: w.hint, d: w.d || 2, topics: topicsOf(w), alt: w.alt || [] });
    });
    if (clues.length >= 4) themes.push({ a: ai, cat: a.cat, text: a.name, ...ANSWER[ai], clues });
  });
  return themes;
}

// ---------- weights: your topics ----------
/** How likely a clue is to be dealt under a mix of topics (Crates' rule): its likeliest topic's weight; 0 never. */
export const weightOf = (topics, mix) => (!mix || !topics.length ? 1 : Math.max(...topics.map(t => mix[t] ?? 1)));

// ---------- the review pile and what you're known to know ----------
/** The clue as known.js keys it (answer>clue), so a final found tells Punt's name-it you know it. */
export const pairOf = ({ a, i }) => { const w = BANK[a].words[i]; return w?.entity && BANK[a].entity ? pairKey(BANK[a].entity, w.entity) : null; };
/** A key for the pile: the same clue asked the same way is the same card. */
export const pileKey = f => `${f.kind}/${BANK[f.a].entity || BANK[f.a].name}/${BANK[f.a].words[f.i]?.entity || f.clue}`;
/**
 * A final not found, as the pile keeps it (README, Deck): a name-it question, the hint with its answer and topic, the
 * name to give; with four options too (the answer's other clues, or other countries or commodities), as Deck asks a card
 * it has no typed form for.
 */
export function cardOf(f, r) {
  const a = BANK[f.a], topic = f.topics.map(t => TOPIC[t]).filter(Boolean)[0];
  const shuffle = xs => { const o = [...xs]; for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; } return o; };
  let options, prompt, ask;
  if (f.kind === "name") {
    ask = `Name it · ${a.name}${topic ? ` · ${topic}` : ""}`;
    prompt = f.hint;
    options = [f.text, ...shuffle(a.words.filter(w => w.w !== f.text && !names(w.w, f.a)).map(w => w.w)).slice(0, 3)];
  } else {
    const carriers = new Set([f.a, ...(a.words[f.i]?.alt || [])]);
    ask = `Name the ${NOUN[f.cat]}`;
    prompt = `${f.context}: ${f.hint}`;
    options = [f.text, ...shuffle(BANK.filter((b, bi) => b.cat === f.cat && !carriers.has(bi)).map(b => b.name)).slice(0, 3)];
  }
  const order = shuffle(options);
  return { name: true, ask, prompt, answer: f.text, options: order, right: [order.indexOf(f.text)], need: 1,
    note: `${f.clue}: ${a.name}: ${f.hint}`, about: entitiesOf(f.a, a.words[f.i]) };
}
