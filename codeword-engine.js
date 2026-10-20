// Codeword's engine (README, Codeword): making puzzles, grading them, finding a hint and pacing a computer rival, pure
// (no page). It needs the word lists, so a page runs it in a worker (codeword-worker.js); the rules a page plays by are
// codeword-rules.js.
//
// A puzzle is made from its seed and options alone, so a link or today's grid is the same grid on every device: a
// dense grid (gridfill.js) filled with common words and all 26 letters, a cipher that numbers the letters in a shuffled
// order, and the given letters, chosen so that a solver of the level's skill cracks it without guessing (crack,
// codeword-solve.js) and that it has one answer against the widest word list (count). A mystery word, when asked for,
// is a thing of one kind from the knowledge base spelt in the grid's numbers under it (codeword-themes.js). For the
// split key (two players, each holding half the numbers) the cipher is also chosen so that each holds about half the
// cells, and that the two crack it together while neither can alone.
import { makeGrid, fillGrid, wordSource, seeded, mix, shuffled } from "./gridfill.js";
import { wordList, count, crack } from "./codeword-solve.js";
import { ALPHABET, SIZES, HALVES, layoutOf } from "./codeword-rules.js";

/**
 * A solver's skill: how many words that fit an entry's known letters they'll sift for the one that also fits its
 * repeats and the letters used elsewhere (sift), and how short a list they'll pencil across entries (pencil, 0 for
 * none). The rungs a puzzle is graded on; its grade is the lowest rung that cracks it.
 */
export const SKILLS = [
  { sift: 1, pencil: 0 },     // 0: only words the known letters give away
  { sift: 2, pencil: 0 },
  { sift: 4, pencil: 0 },
  { sift: 8, pencil: 3 },
  { sift: 16, pencil: 4 },
  { sift: 32, pencil: 6 },
  { sift: 64, pencil: 8 },    // 6
];
/** The levels: how many letters are given, and the rungs of skill a puzzle of the level may need. */
export const LEVELS = {
  easy: { givens: 4, grade: [0, 2] },     // never more than four words to weigh
  medium: { givens: 3, grade: [3, 3] },   // somewhere up to eight, or a cross-check between two short lists
  hard: { givens: 2, grade: [4, 5] },     // somewhere sixteen or more
  expert: { givens: 1, grade: [5, 6] },   // one letter to start from, and thirty or more to weigh
};
// Words the list has that would read as mistakes in a grid (plurals of little words, odd verb forms); they're left out
// of the fill, never out of what's checked for a second answer.
const ODD = ["mys", "mes", "pis", "sics", "drys", "mads", "hows", "hims", "shes", "geed", "bani", "ains", "ays", "ems", "ens", "nus",
  "ors", "ids", "ohs", "ahs", "ums", "ers", "eds", "dos", "las", "mas", "pas", "tis", "yeas", "nays", "hes", "wens", "ifs", "ins", "ups", "buts", "offs"];

// ---------- the word lists ----------
// The fill's words (common, one spelling for everyone), what's checked for a second answer (every word kept, both
// spellings), and what a solver is taken to know (the commoner half of that), each made once.
let FILL = null, WIDE = null, KNOWN = null;
const fillWords = () => (FILL ||= wordSource({ upto: 2, variants: false, exclude: ODD }));
export const wideList = () => (WIDE ||= wordList({ upto: 7, variants: true }));
export const knownList = () => (KNOWN ||= wordList({ upto: 3, variants: true }));
export const fillList = () => fillWords();

// ---------- making a puzzle ----------
/** The lowest rung of SKILLS that cracks the puzzle from these givens (SKILLS.length if none does). */
export function gradeOf(puzzle, givens, list = knownList()) {
  const known = Object.fromEntries(givens.map(n => [n, puzzle.letters[n]]));
  let lo = 0, hi = SKILLS.length;                   // the answer is in [lo, hi]
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (crack(puzzle, known, list, SKILLS[mid]).done) hi = mid; else lo = mid + 1;
  }
  return lo;
}
/**
 * A puzzle (codeword-rules.js says what one is), made from the seed and these: level, size, mystery (a kind's words,
 * themeOf in codeword-themes.js, to choose the mystery word from; or null), split (a puzzle for the split key). The
 * same arguments make the same puzzle everywhere; null if every try failed (it never has in the tests).
 */
export function makePuzzle(seed, { level = "medium", size = "medium", mystery = null, split = false, tries = 16 } = {}) {
  const lv = LEVELS[level] ? level : "medium", sz = SIZES[size] ? size : "medium", L = LEVELS[lv], Z = SIZES[sz];
  const known = knownList(), wide = wideList();
  const word = mystery?.pool?.length ? shuffled(mystery.pool.filter(w => w.length <= Z.n), seeded(mix(seed, 0x3157)))[0] : null;
  for (let t = 0; t < tries; t++) {
    const s = mix(seed, t), rnd = seeded(mix(s, 0xC0DE));
    const grid = makeGrid({ size: Z.n, style: "dense", seed: s });
    if (!grid) continue;
    const fill = fillGrid(grid, { words: fillWords(), seed: s, budget: 20000, cover: ALPHABET });
    if (!fill) continue;
    // the cipher; for the split key, one that shares the cells fairly and that a pair cracks together but neither alone
    for (let c = 0; c < (split ? 8 : 1); c++) {
      const order = shuffled([...ALPHABET], rnd), numOf = Object.fromEntries(order.map((ch, i) => [ch, i + 1]));
      const puzzle = { grid, num: fill.grid.join("").split("").map(ch => (ch === "#" ? 0 : numOf[ch])), letters: ["", ...order] };
      if (split) { const mine = puzzle.num.filter(k => k >= 1 && k <= 13).length / puzzle.num.filter(k => k > 0).length; if (mine < 0.42 || mine > 0.58) continue; }
      const givens = chooseGivens(puzzle, L, rnd, known);
      if (!givens) continue;
      const knownGivens = Object.fromEntries(givens.list.map(k => [k, puzzle.letters[k]]));
      if (split && !splits(puzzle, knownGivens, known, SKILLS[Math.min(L.grade[1] + 1, SKILLS.length - 1)])) continue;
      if (count(puzzle, knownGivens, wide) !== 1) continue;
      return { seed, level: lv, size: sz, split: !!split, ...puzzle, givens: givens.list.sort((a, b) => a - b), grade: givens.grade, mystery: word ? { kind: mystery.id, word } : null };
    }
  }
  return null;
}
/**
 * Givens for a level: { list, grade }, or null. Sets of the level's size are drawn at random until one falls in the
 * level's window of skill (it cracks at the window's top rung and not below its bottom one: two cracks at most); if
 * none does, one is built a letter at a time, each the one of a few that lets a solver at the window's top get
 * furthest, which makes the easiest opening the level allows.
 */
function chooseGivens(puzzle, L, rnd, list, sets = 16) {
  const [lo, hi] = L.grade, numbers = [...Array(26).keys()].map(i => i + 1);
  const known = ns => Object.fromEntries(ns.map(n => [n, puzzle.letters[n]]));
  const fits = ns => crack(puzzle, known(ns), list, SKILLS[hi]).done && (lo === 0 || !crack(puzzle, known(ns), list, SKILLS[lo - 1]).done);
  for (let i = 0; i < sets; i++) {
    const ns = shuffled(numbers, rnd).slice(0, L.givens);
    if (fits(ns)) return { list: ns, grade: gradeOf(puzzle, ns, list) };
  }
  const ns = [];
  while (ns.length < L.givens) {
    let best = null, most = -1;
    for (const n of shuffled(numbers.filter(k => !ns.includes(k)), rnd).slice(0, 8)) {
      const r = crack(puzzle, known([...ns, n]), list, SKILLS[hi]), got = Object.keys(r.known).length + (r.done ? 100 : 0);
      if (got > most) { most = got; best = n; }
    }
    ns.push(best);
  }
  const grade = gradeOf(puzzle, ns, list);
  return grade <= hi && grade >= lo - 1 ? { list: ns, grade } : null;
}
/** Whether the split key works: the two halves crack it together, and neither half alone finishes its own numbers. */
export function splits(puzzle, known, list, skill) {
  return crack(puzzle, known, list, { ...skill, views: HALVES }).done
    && !crack(puzzle, known, list, { ...skill, views: HALVES, alone: 0 }).done
    && !crack(puzzle, known, list, { ...skill, views: HALVES, alone: 1 }).done;
}

// ---------- a hint ----------
/**
 * The number a hint shows, from what's right so far ({ number: letter }): the next letter a strong solver would find
 * (and the entry it's in), else the unknown number in the most cells. null when everything is right.
 */
export function hintFor(p, right) {
  const missing = [...Array(26).keys()].map(i => i + 1).filter(n => !right[n]);
  if (!missing.length) return null;
  const step = crack(p, right, knownList(), { ...SKILLS[SKILLS.length - 1], maxSteps: 1 }).steps[0];
  const n = step?.gives.find(([k]) => !right[k])?.[0];
  const { cellsOf, entries } = layoutOf(p);
  if (n) return { n, entry: step.entry };
  const m = missing.sort((a, b) => cellsOf[b].length - cellsOf[a].length || a - b)[0];
  return { n: m, entry: entries.findIndex(e => e.nums.includes(m)) };
}

// ---------- a computer rival ----------
/**
 * The computer players, each a solver of a skill (a rung of SKILLS), paced as a person: before each step it thinks
 * (think, ms, and per ms for each doubling of the words that fitted what it knew), then writes each letter in (write
 * ms); stuck, it pauses (stuck ms) and thinks a rung harder.
 */
export const RIVALS = {
  steady: { label: "Steady", skill: 2, think: 18000, per: 8000, write: 2500, stuck: 45000 },   // a Medium grid in about 10 minutes
  sharp: { label: "Sharp", skill: 4, think: 9000, per: 4500, write: 1500, stuck: 30000 },     // about 5
  ace: { label: "Ace", skill: 6, think: 4000, per: 2200, write: 900, stuck: 15000 },          // under 3
};
/** A rival's solve: [{ at (ms from the start), gives ([[number, letter], …]) }], to the last letter. Seeded, so the same everywhere. */
export function rivalPlan(p, rival, seed = 1) {
  const R = RIVALS[rival] || RIVALS.sharp, rnd = seeded(mix(seed, 0x51D)), list = knownList();
  let known = Object.fromEntries(p.givens.map(n => [n, p.letters[n]])), rung = R.skill, t = 0;
  const plan = [];
  for (let guard = 0; guard < 12 && Object.keys(known).length < 26; guard++) {
    const r = crack(p, known, list, SKILLS[Math.min(rung, SKILLS.length - 1)]);
    for (const s of r.steps) {
      const hard = s.kind === "word" ? Math.log2(s.fits + 1) : s.kind === "cross" ? 5 : 0.5;
      t += (R.think + R.per * hard) * (0.7 + 0.6 * rnd()) + R.write * s.gives.length;
      plan.push({ at: Math.round(t), gives: s.gives });
    }
    known = r.known;
    if (r.done) break;
    if (rung >= SKILLS.length - 1) {                 // the hardest rung stuck too: it takes a letter (as a hint would)
      const n = [...Array(26).keys()].map(i => i + 1).find(k => !known[k]);
      t += R.stuck;
      plan.push({ at: Math.round(t), gives: [[n, p.letters[n]]] });
      known = { ...known, [n]: p.letters[n] };
    } else { rung++; t += R.stuck; }
  }
  return plan;
}
