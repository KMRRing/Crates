// Crossword's solvers (README, Crossword), pure: they read a puzzle (crossword-engine.js makes them) and never a page.
//  - countSolutions: how many ways the grid can be filled with an answer its clue allows in every entry, up to a
//    limit. A forward knowledge clue allows its answer and the other answers the knowledge base says it fits, of its
//    length (Vikings, six letters: Norway or Sweden); an ordinary clue every word of its length the bank gives the
//    same clue (Limb: arm and leg); the theme's keystone any answer of its kind and length. A puzzle is dealt only
//    when the count is exactly one: the crossings settle what a clue alone can't.
//  - simulate: a person solving it, as a model: each entry is known from its clue with a chance by its kind and
//    difficulty, and the crossings then make others certain (one word of the language fits the letters) or likelier
//    (a pattern jogs the memory), round after round, until nothing more comes. A grid's difficulty is how such
//    solvers fare on it: how many finish, how much of it they get, how many rounds of crossings it takes.
import { wordsOf } from "./wordlist.js";
import { answerNames } from "./crossword-kb.js";

// ---------- seeded numbers (mulberry32, as gridfill.js runs on) ----------
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the words a person might think of ----------
// A pattern of known letters makes a word certain only when nothing else in the language fits it: the words a
// well-read solver knows (wordlist.js to SCOWL size 35, both spellings), not just the clued ones a grid is filled from.
const KNOWN_TIER = 2;
const matching = new Map();
/** How many of `words` fit a pattern ("T.O.L": letters known, dots not), counted once per pattern. */
function fits(kind, words, pattern) {
  const key = `${kind}:${pattern}`;
  let n = matching.get(key);
  if (n === undefined) {
    n = 0;
    outer: for (const w of words) {
      for (let i = 0; i < pattern.length; i++) if (pattern[i] !== "." && w[i] !== pattern[i]) continue outer;
      if (++n > 1) break;
    }
    matching.set(key, n);
  }
  return n;
}
const upperWords = new Map();
function dictionary(len) {
  if (!upperWords.has(len)) upperWords.set(len, wordsOf(len, KNOWN_TIER).map(w => w.toUpperCase()));
  return upperWords.get(len);
}
/** Whether an entry's known letters leave it one answer only: a word nothing else in the language fits, or a country
 *  or commodity no other one of its kind does. A reverse entry's answer (a gas field, a festival) has no such list. */
function certain(e, pattern) {
  if (!pattern.includes(".")) return true;
  const known = pattern.replace(/\./g, "").length;
  if (known * 2 < e.len) return false;                          // half the letters at least, as a solver would want
  if (e.kind === "word") return fits("w", dictionary(e.len), pattern) === 1;
  if (e.kind === "fwd" || e.kind === "key") return fits(e.cat, answerNames(e.cat).filter(w => w.length === e.len), pattern) === 1;
  return false;
}

// ---------- counting solutions ----------
/**
 * The words each entry's clue allows, by entry: its answer and the others the clue fits (above). `names(cat, len)`
 * gives the keystone's: every answer of its kind and length.
 */
export function allowed(puzzle, sameClue) {
  return puzzle.entries.map(e => {
    if (e.kind === "word") return [...new Set([e.letters, ...sameClue(e)])];
    if (e.kind === "fwd") return [e.letters, ...(e.alts || [])];
    if (e.kind === "key") return [...new Set([e.letters, ...answerNames(e.cat).filter(w => w.length === e.len)])];
    return [e.letters];
  });
}
/**
 * How many fills of the grid give every entry a word its clue allows, up to `limit` (two is enough to know there's
 * more than one). Depth first, the entry with fewest words left first.
 */
export function countSolutions(puzzle, choices, limit = 2) {
  const cells = new Array(puzzle.rows.length * puzzle.rows[0].length).fill(null);
  const E = puzzle.entries, done = new Array(E.length).fill(false);
  let count = 0;
  const fitsHere = (e, w) => e.cells.every((k, i) => cells[k] === null || cells[k] === w[i]);
  const step = () => {
    if (count >= limit) return;
    let best = -1, bestList = null;
    for (let j = 0; j < E.length; j++) {
      if (done[j]) continue;
      const list = choices[j].filter(w => fitsHere(E[j], w));
      if (!list.length) return;
      if (!bestList || list.length < bestList.length) { best = j; bestList = list; }
    }
    if (best < 0) { count++; return; }
    const e = E[best];
    done[best] = true;
    for (const w of bestList) {
      const wrote = [];
      e.cells.forEach((k, i) => { if (cells[k] === null) { cells[k] = w[i]; wrote.push(k); } });
      step();
      for (const k of wrote) cells[k] = null;
      if (count >= limit) break;
    }
    done[best] = false;
  };
  step();
  return count;
}

// ---------- a person solving it ----------
/**
 * How likely a solver is to know an entry from its clue alone, by kind and difficulty (index d − 1): a plain word's
 * easy clue nearly always, its harder one more often than not; a country or commodity from its clue well (there are
 * only so many, and the length narrows them); a clue's own name from its reason far less (recall, not recognition);
 * a starred clue less still until the theme is known.
 */
export const TYPICAL = { word: [0.9, 0.6], fwd: [0.85, 0.62, 0.4], rev: [0.55, 0.3, 0.12], star: [0.55, 0.3, 0.12], key: [0, 0, 0] };
const chanceOf = (model, e, themeKnown) => {
  const row = model[e.kind] || model.word, p = row[Math.min(row.length, Math.max(1, e.d || 1)) - 1];
  return e.kind === "star" && !themeKnown ? p * 0.5 : p;
};
/** With some letters in, a pattern jogs the memory: a word's more than a name's (`f`, the share of letters known). */
const withLetters = (p, e, f) => p + (1 - p) * (e.kind === "rev" || e.kind === "star" ? f ** 3 : f ** 2);

/**
 * One solver's go at the puzzle: { finished, share (of entries solved), rounds (of crossings it took), order (the
 * entries in the order they came) }. `model` is the chances above (TYPICAL); `rnd` seeded.
 */
export function simulate(puzzle, model, rnd) {
  const E = puzzle.entries, known = new Array(puzzle.rows.length * puzzle.rows[0].length).fill(null);
  const solved = new Array(E.length).fill(false), last = new Array(E.length).fill(-1), order = [];
  const pattern = e => e.cells.map(k => known[k] || ".").join("");
  const write = j => { solved[j] = true; order.push(j); E[j].cells.forEach((k, i) => { known[k] = E[j].letters[i]; }); };
  const themeKnown = () => E.filter((e, j) => e.kind === "star" && solved[j]).length >= 2 || E.some((e, j) => e.kind === "key" && solved[j]);
  let rounds = 0;
  for (let round = 0; ; round++) {
    let progress = false;
    for (let j = 0; j < E.length; j++) {
      if (solved[j]) continue;
      const e = E[j], pat = pattern(e), k = pat.replace(/\./g, "").length;
      if (k === last[j]) continue;                               // nothing new since it was last tried
      last[j] = k;
      let p = chanceOf(model, e, themeKnown());
      if (e.kind === "key" && themeKnown()) p = 0.7;              // the theme seen in the starred answers names it
      if (certain(e, pat) || rnd() < (k ? withLetters(p, e, k / e.len) : p)) { write(j); progress = true; }
    }
    if (!progress) break;
    rounds = round;
  }
  const n = solved.filter(Boolean).length;
  return { finished: n === E.length, share: n / E.length, rounds, order };
}
/**
 * How a grid comes out for `runs` typical solvers: { finish (the share who complete it with no help), share (how
 * much of it the average one gets), rounds (how many rounds of crossings a finisher needed, on average) }.
 */
export function grade(puzzle, { runs = 24, seed = 1, model = TYPICAL } = {}) {
  const rnd = seeded(seed ^ 0x51ED);
  let fin = 0, share = 0, rounds = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulate(puzzle, model, rnd);
    if (r.finished) { fin++; rounds += r.rounds; }
    share += r.share;
  }
  return { finish: fin / runs, share: share / runs, rounds: fin ? rounds / fin : null };
}

export const REVEAL_COST = 30, CHECK_COST = 15;             // seconds: a letter revealed, a wrong letter a check finds
