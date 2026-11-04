// Codeword's engine (README, Codeword): making puzzles, grading them, and finding a hint, pure
// (no page). It needs the word lists, so a page runs it in a worker (codeword-worker.js); the rules a page plays by are
// codeword-rules.js.
//
// A puzzle is made from its seed and options alone, so a link or today's grid is the same grid on every device: a
// dense grid (gridfill.js) filled with common words and all 26 letters, a cipher that numbers the letters in a shuffled
// order, and the given letters: the letters of the answer to the question the grid opens on (codeword-clues.js), chosen
// so that a solver of the level's skill cracks it without guessing (crack, codeword-solve.js) and that it has one answer
// against the widest word list (count). The answer is spelt in the grid's numbers under it. For the
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
/**
 * The levels: the rungs of skill a puzzle of the level may need, measured with the answer's letters given (a grid
 * opens on a clue whose answer's letters are the givens: three to nine of them). The candidates are tried for the one
 * whose letters leave the grid in the window, so Hard and Expert take words poor in the common letters (cocoa, Iraq).
 */
export const LEVELS = {
  easy: { grade: [0, 2] },     // never more than four words to weigh
  medium: { grade: [3, 3] },   // somewhere up to eight, or a cross-check between two short lists
  hard: { grade: [4, 5] },     // somewhere sixteen or more
  expert: { grade: [5, 6] },   // thirty or more
};
const levelOf = level => (LEVELS[level] ? level : "medium");
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
 * A puzzle (codeword-rules.js says what one is), made from the seed and these: level, size, clues (the candidates,
 * codeword-clues.js: a word and the question it answers), split (a puzzle for the split key). The same arguments make
 * the same puzzle everywhere; null if every try failed (it never has in the tests).
 *
 * The clue is chosen with the grid: for each grid and cipher the candidates are tried in the seed's order, each with
 * its word's letters as the givens, and the first that a solver of the level's skill cracks (the lowest rung that does
 * is in the level's window) and that leaves one answer is the puzzle's. A level whose window no grid reaches (Hard,
 * mostly) settles for the nearest found, after four grids once one is within a rung.
 */
export function makePuzzle(seed, { level = "medium", size = "medium", clues = [], split = false, tries = 16 } = {}) {
  const lv = levelOf(level), sz = SIZES[size] ? size : "medium", L = LEVELS[lv], Z = SIZES[sz], [lo, hi] = L.grade;
  const known = knownList(), wide = wideList(), pool = clues.filter(c => c.word.length <= Z.n);
  if (!pool.length) return null;
  let best = null;
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
      for (const cand of shuffled(pool, rnd).slice(0, 30)) {
        const givens = [...new Set(cand.word)].map(ch => numOf[ch]).sort((a, b) => a - b), grade = gradeOf(puzzle, givens, known);
        if (grade >= SKILLS.length) continue;
        const off = grade < lo ? lo - grade : grade > hi ? grade - hi : 0;
        if (best && off >= best.off && off) continue;
        const knownGivens = Object.fromEntries(givens.map(k => [k, puzzle.letters[k]]));
        if (split && !splits(puzzle, knownGivens, known, SKILLS[Math.min(hi + 1, SKILLS.length - 1)])) continue;
        if (count(puzzle, knownGivens, wide) !== 1) continue;
        const made = { seed, level: lv, size: sz, split: !!split, ...puzzle, givens, grade, mystery: { kind: cand.kind, word: cand.word }, clue: cand.clue, off };
        if (!off) return strip(made);
        best = made;
      }
    }
    if (best && best.off <= 1 && t >= 3) break;
  }
  return best && strip(best);
}
const strip = ({ off, ...p }) => p;

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
