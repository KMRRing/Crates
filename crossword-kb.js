// Crossword's knowledge entries (README, Crossword), pure: every clue link of Crates' bank (bank.js through core.js) as
// the two entries it can make in a grid. Forward, the clue and its reason name the country or commodity ("Troll · One
// of the largest offshore gas fields ever found (6)" is NORWAY); reverse, the reason and the country name the clue
// ("Norway · One of the largest offshore gas fields ever found (5)" is TROLL), Punt's name-it with the length and the
// crossings to help. An entry that would give itself away is never made: a forward clue naming its answer (Brazilian
// real for Brazil, Swiss franc for Switzerland), a reverse one whose reason has the answer's own word in it (Brown
// cheese: "a sweet caramelised whey cheese").
import { BANK } from "./core.js";

/** The longest and shortest entries a grid takes (a run of two isn't a word, and no grid here runs past thirteen). */
export const SHORTEST = 3, LONGEST = 13;

// letters a grid writes as others (a crossword has no Ø or ß): the same table as typing.js's, and Iceland's thorn
const SPECIAL = { ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", þ: "th", ð: "d", ı: "i" };
const lower = s => String(s ?? "").toLowerCase().replace(/[øæœßłđþðı]/g, c => SPECIAL[c]).normalize("NFD").replace(/\p{M}/gu, "");

/**
 * A name as a grid takes it: its letters (upper case) and its enumeration, the word lengths a printed clue gives
 * ("Oil fund" 3,4; "A-ha" 1-2; "Bio-LNG" 3-3; "Lloyd's" 6). Null when it can't go in a grid: a number or a sign in it
 * (B40, Tate & Lyle, $4/lb), or too short or too long.
 */
export function gridForm(name) {
  const s = lower(name).replace(/[­​-‍⁠]/g, "").replace(/[‐‑–]/g, "-").trim();   // soft hyphens split no word
  if (!s || /[^a-z \-'’.!]/.test(s)) return null;
  const words = s.split(/\s+/).map(w => w.split("-").map(p => p.replace(/[^a-z]/g, "").length));
  if (words.some(parts => parts.every(n => n === 0))) return null;
  const letters = s.replace(/[^a-z]/g, "").toUpperCase();
  if (letters.length < SHORTEST || letters.length > LONGEST) return null;
  const enumer = words.map(parts => parts.filter(n => n > 0).join("-")).join(",");
  return { letters, enumer };
}

/** The words of a text as a solver reads them: lower case, plain letters. */
export const wordsOf = s => lower(s).replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
/** Whether a text's words say a name's (both as wordsOf gives them): as a word or the start of one ("Brazilian" says
 *  Brazil), a phrase as its words in a row. Names of two letters are left alone (us, uk: "most of us" isn't the
 *  United States), and a three-letter one counts only as a whole word (UAE, HVO). */
export function saysWords(t, n) {
  if (!n.length || n.join("").length < 3) return false;
  const short = n.length === 1 && n[0].length === 3;
  for (let i = 0; i + n.length <= t.length; i++) {
    if (n.every((w, j) => (j === n.length - 1 && !short ? t[i + j].startsWith(w) : t[i + j] === w))) return true;
  }
  return false;
}
/** Whether `text` says `name` (saysWords, from plain text). */
export const says = (text, name) => saysWords(wordsOf(text), wordsOf(name));
/** Whether a reason gives away a name: a word of the name (four letters or more) or its stem in the reason ("cheese"
 *  in "a sweet caramelised whey cheese" for Brown cheese, "fjord" for Fjords). */
function echoes(reason, name) {
  const r = wordsOf(reason);
  return wordsOf(name).filter(w => w.length >= 3).some(w => {
    if (w.length === 3) return r.includes(w);                 // a short word only as itself (tea, tin)
    const stem = w.slice(0, Math.max(4, w.length - 2));
    return r.some(x => x.startsWith(stem) || (x.length >= 4 && w.startsWith(x.slice(0, Math.max(4, x.length - 2)))));
  });
}

// A few answers go into a grid under another of their names: the UK's two letters can't be an entry, and the United
// States' twelve fit few grids
const FORWARD_NAME = { uk: "Britain", "united-states": "USA" };
const forwardName = a => FORWARD_NAME[a.entity] || a.name;
/** Every name an answer goes by, for the giveaway checks. */
const namesOf = a => [a.name, forwardName(a), ...(a.aliases || [])];

/**
 * The entries, both ways round, each { key, dir ("fwd" | "rev"), letters, enumer, answer (as written: "Norway",
 * "Oil fund"), lead (what the clue shows in bold: the clue for a forward entry, the country or commodity for a
 * reverse one), hint (the link's reason), d (its difficulty, 1 to 3), topics (its aspects), cat ("country" |
 * "commodity"), a and i (where it is in the bank), about (the knowledge base's entities: the answer's, then the
 * clue's), alts (a forward entry's other answers of its length: the crossings must tell them apart) }.
 */
function build() {
  const out = [];
  const fwdForm = BANK.map(a => gridForm(forwardName(a)));
  BANK.forEach((a, ai) => {
    const own = fwdForm[ai];
    a.words.forEach((w, i) => {
      const about = [a.entity, w.entity].filter(Boolean), pair = `${a.entity}>${w.entity}`;
      const base = { hint: w.hint, d: w.d, topics: w.topics, cat: a.cat, a: ai, i, about, pair };
      // forward: the clue and its reason, naming the answer; not when they say it (Brazilian real, Swiss franc)
      if (own && !namesOf(a).some(n => says(`${w.w} ${w.hint}`, n))) {
        const alts = [...new Set((w.alt || []).map(j => fwdForm[j]).filter(f => f && f.letters.length === own.letters.length && f.letters !== own.letters).map(f => f.letters))];
        out.push({ ...base, key: `f:${pair}`, dir: "fwd", letters: own.letters, enumer: own.enumer, answer: forwardName(a), lead: w.w, alts });
      }
      // reverse: the reason and the answer, naming the clue; not when the reason has the clue's own word in it, or the
      // clue the answer's (the bold name would give it away)
      const item = gridForm(w.w);
      if (item && !echoes(w.hint, w.w) && !namesOf(a).some(n => says(w.w, n))) {
        out.push({ ...base, key: `r:${pair}`, dir: "rev", letters: item.letters, enumer: item.enumer, answer: w.w, lead: a.name, alts: [] });
      }
    });
  });
  return out;
}
let ENTRIES = null;
/** Every knowledge entry (built on first use: the bank is decoded once, here and in core.js). */
export const kbEntries = () => (ENTRIES ||= build());
/** An entry by its key, or null. */
export function kbEntry(key) {
  if (!byKey) byKey = new Map(kbEntries().map(e => [e.key, e]));
  return byKey.get(key) || null;
}
let byKey = null;

let byPair = null, byAnswer = null;
/**
 * The entries that can revise a review card about these things (the knowledge base's entities, as the pile keeps what
 * a card is `about`): the same link's, both ways round, where two of them are one (a Crates clue and its answer); else
 * every entry whose answer is one of them (a country or commodity named from one of its clues, or the thing itself
 * named from its country and reason). None for a card about nothing the clue links know.
 */
export function entriesAbout(ids) {
  if (!byPair) {
    byPair = new Map();
    byAnswer = new Map();
    const add = (m, k, e) => { if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
    for (const e of kbEntries()) {
      add(byPair, e.pair, e);
      const named = e.dir === "fwd" ? e.about[0] : e.about[1];
      if (named) add(byAnswer, named, e);
    }
  }
  const link = ids.flatMap(x => ids.filter(y => y !== x).flatMap(y => byPair.get(`${x}>${y}`) || []));
  return link.length ? link : [...new Set(ids.flatMap(id => byAnswer.get(id) || []))];
}

/** Every country's or commodity's name as a grid writes it, by category: the words a forward clue's answer is among
 *  (a solver who doesn't know it still knows it's one of these). */
let NAMES = null;
export function answerNames(cat) {
  NAMES ||= {
    country: [...new Set(BANK.filter(a => a.cat === "country").map(a => gridForm(forwardName(a))?.letters).filter(Boolean))],
    commodity: [...new Set(BANK.filter(a => a.cat === "commodity").map(a => gridForm(forwardName(a))?.letters).filter(Boolean))],
  };
  return NAMES[cat] || [];
}
/**
 * A knowledge entry as a card for the review pile (pile.js): a name to type, Punt's name-it as Deck asks it (`name`,
 * `prompt`, `answer`), and four options as well, for wherever a card is answered by choosing (the answer and three of
 * its kind: other countries or commodities for a forward entry, the same answer's other clues for a reverse one).
 */
export function reviewCard(e, rnd = Math.random) {
  const a = BANK[e.a], mixUp = xs => xs.map(x => [rnd(), x]).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
  const others = e.dir === "fwd" ? BANK.filter(x => x.cat === a.cat && x !== a).map(x => x.name) : a.words.map(w => w.w).filter(w => w !== e.answer);
  const answer = e.dir === "fwd" ? a.name : e.answer, options = mixUp([answer, ...mixUp(others).slice(0, 3)]);
  return {
    name: true, ask: e.dir === "fwd" ? `Crossword · which ${a.cat}` : "Crossword · name it", prompt: `${e.dir === "fwd" ? e.lead : a.name}: ${e.hint}`,
    answer, note: e.dir === "fwd" ? `${e.lead}: ${e.hint} (${a.name})` : `${e.answer}: ${e.hint} (${a.name})`,
    options, right: [options.indexOf(answer)], need: 1, about: e.about,
  };
}
export { BANK };
