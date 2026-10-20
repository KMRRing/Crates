// Codeword's rules (README, Codeword), pure and light: what a page needs to play, with no word list in it (making a
// puzzle and finding a hint need one, and run in a worker: codeword-engine.js). A codeword is a crossword grid with no
// clues: every white cell holds a number from 1 to 26, the same number is always the same letter, two numbers are never
// the same letter, and every letter of the alphabet is somewhere in the grid. A few letters are given; the rest you
// crack from the shapes of the words.
//
// A puzzle here is { seed, level, size, split, grid (rows of "#" and "."), num (each cell's number, 0 for a black
// one), letters (the answer: letters[n] for number n), givens (the numbers given), grade, mystery ({ kind, word }:
// spelt under the grid in its numbers, or null) }, kept and sent packed (pack, unpack).

export const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
/** Grid sizes: the side of the square. */
export const SIZES = { small: { label: "Small", n: 11 }, medium: { label: "Medium", n: 13 }, large: { label: "Large", n: 15 } };
/** The levels' names and how many letters each gives (the skill each needs is the engine's). */
export const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
export const GIVENS = { easy: 4, medium: 3, hard: 2, expert: 1 };
/** Today's grid is the same for everyone, so its options are fixed. */
export const DAILY = { level: "medium", size: "medium", mystery: "" };
/** Seconds a hint and a check add to the time. */
export const HINT = 30, CHECK = 20;
/** The split key: who holds a number (seat 0 the numbers 1 to 13, seat 1 the rest). */
export const holderOf = n => (n <= 13 ? 0 : 1);
export const HALVES = [new Set([...Array(13).keys()].map(i => i + 1)), new Set([...Array(13).keys()].map(i => i + 14))];
const NUMBERS = [...Array(26).keys()].map(i => i + 1);

// ---------- a puzzle kept, and sent to a table ----------
/**
 * A puzzle as it's kept and sent: { v, seed, level, size, split, rows, nums (a letter a cell for its number: A for 1
 * to Z for 26, # for black), key (the answer, a letter a number), givens, grade, kind and word (the mystery, or "")
 * }. Small (a 13×13 grid in about 300 characters) and safe for the database (nothing it would drop or refuse).
 */
export const pack = p => ({ v: 1, seed: p.seed, level: p.level, size: p.size, split: !!p.split, rows: p.grid,
  nums: p.num.map(n => (n ? String.fromCharCode(64 + n) : "#")).join(""), key: p.letters.slice(1).join(""), givens: p.givens, grade: p.grade,
  kind: p.mystery?.kind || "", word: p.mystery?.word || "" });
/** A kept puzzle back to the one made, or null if it isn't one. */
export function unpack(o) {
  if (!o || o.v !== 1 || !Array.isArray(o.rows) || typeof o.nums !== "string" || typeof o.key !== "string" || !/^[a-z]{26}$/.test(o.key)) return null;
  const C = o.rows[0]?.length || 0;
  if (!C || o.rows.some(r => typeof r !== "string" || r.length !== C) || o.nums.length !== o.rows.length * C) return null;
  const num = [...o.nums].map(ch => (ch === "#" ? 0 : ch.charCodeAt(0) - 64));
  if (num.some((n, k) => n < 0 || n > 26 || (n === 0) !== (o.rows[(k / C) | 0][k % C] === "#"))) return null;
  const word = /^[a-z]{3,15}$/.test(o.word || "") ? o.word : "";
  return { seed: o.seed, level: LEVEL_NAMES[o.level] ? o.level : "medium", size: SIZES[o.size] ? o.size : "medium", split: !!o.split,
    grid: o.rows, num, letters: ["", ...o.key], givens: Object.values(o.givens || {}).filter(n => n >= 1 && n <= 26), grade: o.grade ?? 0,
    mystery: word ? { kind: o.kind || "", word } : null };
}

// ---------- the board ----------
/** The entries of a grid, across then down, each { id, dir, row, col, cells, nums, distinct (its numbers, in order of first appearance), pat }. */
export function entriesOf(grid, num) {
  const R = grid.length, C = grid[0].length, out = [];
  const white = (r, c) => r >= 0 && c >= 0 && r < R && c < C && grid[r][c] !== "#";
  for (const [dr, dc] of [[0, 1], [1, 0]]) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!white(r, c) || white(r - dr, c - dc) || !white(r + dr, c + dc)) continue;
    const cells = [];
    for (let k = 0; white(r + k * dr, c + k * dc); k++) cells.push((r + k * dr) * C + c + k * dc);
    if (cells.length < 3) continue;
    const nums = cells.map(k => num[k]), seen = new Map();
    const pat = nums.map(n => { if (!seen.has(n)) seen.set(n, seen.size); return seen.get(n); }).join(".");
    out.push({ id: out.length, dir: dr ? "down" : "across", row: r, col: c, cells, nums, distinct: [...seen.keys()], pat });
  }
  return out;
}
/** Every cell of each number (cellsOf[n]), the entries, and for each cell its across and down entries. */
export function layoutOf(p) {
  const cellsOf = Array.from({ length: 27 }, () => []);
  p.num.forEach((n, k) => { if (n) cellsOf[n].push(k); });
  const entries = entriesOf(p.grid, p.num), across = new Int32Array(p.num.length).fill(-1), down = new Int32Array(p.num.length).fill(-1);
  for (const e of entries) for (const k of e.cells) (e.dir === "across" ? across : down)[k] = e.id;
  return { cellsOf, entries, across, down, cols: p.grid[0].length, rows: p.grid.length };
}
/** The mystery word's numbers, one a letter (every letter is in the grid, so each has one). */
export const mysteryNums = p => (p.mystery ? [...p.mystery.word].map(ch => p.letters.indexOf(ch)) : []);

// ---------- a run: what you've written in ----------
/**
 * A solo run: { put (your letter for each number you've written in), shown (numbers a hint gave: fixed, like a given),
 * log (what undo takes back: [number, its letter before, its letter after, the number the letter moved from]), hints,
 * checks, marks (the numbers the last check found wrong, until they change), ms (time on the clock), done }.
 */
export const newRun = () => ({ put: {}, shown: {}, log: [], hints: 0, checks: 0, marks: [], ms: 0, done: false });
export const isGiven = (p, n) => p.givens.includes(n);
/** Whether a number's letter can't change: given, or shown by a hint. */
export const isFixed = (p, run, n) => isGiven(p, n) || !!run.shown?.[n];
/** A number's letter as it stands: given, shown or written in; null if it has none. */
export const letterOf = (p, run, n) => (isFixed(p, run, n) ? p.letters[n] : run.put[n] || null);
/** The number a letter is on now, or 0. */
export const holding = (p, run, ch) => NUMBERS.find(n => letterOf(p, run, n) === ch) || 0;
/**
 * Writes letter ch in for number n. A letter on another number moves here (that number goes blank: two numbers are
 * never one letter), unless it's fixed there. { ok, why ("fixed": n is given or shown; "taken": ch is fixed on
 * another number, `on`), moved (the number it came from, or 0) }.
 */
export function place(p, run, n, ch) {
  if (isFixed(p, run, n)) return { ok: false, why: "fixed" };
  const m = holding(p, run, ch);
  if (m === n) return { ok: true, moved: 0 };
  if (m && isFixed(p, run, m)) return { ok: false, why: "taken", on: m };
  const before = run.put[n] || null;
  if (m) delete run.put[m];
  run.put[n] = ch;
  run.log.push([n, before, ch, m]);
  run.marks = run.marks.filter(x => x !== n && x !== m);
  return { ok: true, moved: m };
}
/** Takes a number's letter out; false if it had none or is fixed. */
export function erase(p, run, n) {
  if (isFixed(p, run, n) || !run.put[n]) return false;
  run.log.push([n, run.put[n], null, 0]);
  delete run.put[n];
  run.marks = run.marks.filter(x => x !== n);
  return true;
}
/** Takes back the last change; the number it was on, or 0 when there's nothing to undo. */
export function undo(p, run) {
  const last = run.log.pop();
  if (!last) return 0;
  const [n, before, after, m] = last;
  if (before) run.put[n] = before; else delete run.put[n];
  if (m) run.put[m] = after;
  run.marks = run.marks.filter(x => x !== n && x !== m);
  return n;
}
/** How many numbers have a letter (given, shown or written). */
export const filled = (p, run) => NUMBERS.filter(n => letterOf(p, run, n)).length;
/** The numbers written in with the wrong letter. */
export const wrongOf = (p, run) => Object.entries(run.put).filter(([n, ch]) => ch && ch !== p.letters[n] && !isFixed(p, run, Number(n))).map(([n]) => Number(n));
export const isFull = (p, run) => filled(p, run) === 26;
export const isSolved = (p, run) => isFull(p, run) && !wrongOf(p, run).length;
/** What a run has right: { number: letter } for the givens, the hints and each letter written in right. */
export const rightOf = (p, run) => Object.fromEntries(NUMBERS.filter(n => letterOf(p, run, n) === p.letters[n]).map(n => [n, p.letters[n]]));
/** A check: marks the numbers written in wrong (until they change), for CHECK seconds. */
export function check(p, run) {
  run.checks++;
  run.marks = wrongOf(p, run);
  return run.marks;
}
/**
 * A hint's letter shown for good, for HINT seconds: number n gets its letter (taken off any wrong number it was on),
 * fixed like a given. Nothing before it can be undone (the hint can't).
 */
export function show(p, run, n) {
  if (!n || isFixed(p, run, n)) return false;
  const ch = p.letters[n], m = holding(p, run, ch);
  if (m && m !== n) delete run.put[m];
  delete run.put[n];
  run.shown[n] = 1;
  run.hints++;
  run.log = [];
  run.marks = run.marks.filter(x => x !== n && x !== m);
  return true;
}
/** A run's score: seconds on the clock, and the hints' and checks' seconds; lower is better. */
export const score = run => Math.round(run.ms / 1000) + HINT * run.hints + CHECK * run.checks;
