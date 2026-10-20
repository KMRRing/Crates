// Assay's rules (README, Assay), pure: no page in it, so tests/assay.mjs runs every part in Node. A hidden word; each
// guess, itself a word, is marked letter by letter: right place, elsewhere in the word, or not in it (a repeated
// letter marked exactly as Wordle marks it: the right places first, then elsewhere for as many as the word has left).
// Here too: the hard and strict rules, how hard a word is (a human-style solver's guesses, never its rarity alone), the
// levels and the daily, several boards at once, the word that dodges, the sprint, and the game as it's kept.
import { ENGLISH } from "./assay-words.js";
import { GRADES } from "./assay-grades.js";

export const GREY = 0, NEAR = 1, HIT = 2;
export const LENGTHS = [4, 5, 6, 7];
export const BOARDS = [1, 2, 4, 8];
export const LEVELS = ["easy", "medium", "hard"];
export const RULES = ["free", "hard", "strict"];
export const MODES = ["classic", "boards", "dodge", "sprint"];
// Six guesses for five letters, as Wordle. Four letters is the hard length (whole families differ in one letter:
// bake, cake, fake, lake, make…), and gets a seventh; six and seven letters give away more with every guess and keep
// six. Several boards share the guesses, with as many more as Dordle, Quordle and Octordle give.
const ROWS = { 4: 7, 5: 6, 6: 6, 7: 6 };
const EXTRA = { 1: 0, 2: 1, 4: 3, 8: 7 };
export const guessesFor = (len, boards = 1) => (ROWS[len] || 6) + (EXTRA[boards] ?? 0);
export const SPRINT_MS = 180000;     // three minutes
const SPRINT_WORDS = 60;             // more than anyone solves in three minutes
export const DAILY = Object.freeze({ mode: "classic", len: 5, boards: 1, level: "medium" });

// ---------- marking ----------
/** The marks of a guess against the answer, letter by letter: HIT, NEAR or GREY. Works on any alphabet. */
export function marksOf(guess, answer) {
  const n = guess.length, out = new Array(n).fill(GREY), used = new Array(n).fill(false);
  for (let i = 0; i < n; i++) if (guess[i] === answer[i]) { out[i] = HIT; used[i] = true; }
  for (let i = 0; i < n; i++) {
    if (out[i] === HIT) continue;
    for (let j = 0; j < n; j++) if (!used[j] && answer[j] === guess[i]) { used[j] = true; out[i] = NEAR; break; }
  }
  return out;
}
/** Marks as one number (base 3, the first letter lowest): the solvers sort words by it. */
export const codeOfMarks = marks => marks.reduce((c, m, i) => c + m * 3 ** i, 0);
export const marksOfCode = (code, n) => Array.from({ length: n }, (_, i) => Math.floor(code / 3 ** i) % 3);
export const allHit = n => 3 ** n - 1;
const sameMarks = (a, b) => a.length === b.length && a.every((m, i) => m === b[i]);
/** Whether a word could still be the answer after these rows ({ guess, marks }). */
export const fits = (word, rows) => rows.every(r => sameMarks(marksOf(r.guess, word), r.marks));

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];
const big = l => l.toUpperCase();
const times = n => (n === 2 ? "twice" : `${n} times`);
const countIn = (w, l) => [...w].filter(c => c === l).length;
/**
 * Why a guess breaks the rules after these rows, in words, or null when it's allowed. Free: anything. Hard (Wordle's
 * hard mode): a letter found in place stays there, and every letter shown to be in the word is used, as often as
 * shown. Strict: the guess could be the answer, so a letter shown elsewhere moves, and a letter shown out stays out.
 */
export function rulesBreak(guess, rows, rules) {
  if (rules !== "hard" && rules !== "strict") return null;
  for (const r of rows) for (let i = 0; i < r.marks.length; i++) {
    if (r.marks[i] === HIT && guess[i] !== r.guess[i]) return `The ${ORD[i]} letter must be ${big(r.guess[i])}`;
  }
  for (const r of rows) {
    const shown = new Map();
    r.marks.forEach((m, i) => { if (m !== GREY) shown.set(r.guess[i], (shown.get(r.guess[i]) || 0) + 1); });
    for (const [l, n] of shown) if (countIn(guess, l) < n) return n > 1 ? `Use ${big(l)} ${times(n)}` : `Use the ${big(l)}`;
  }
  if (rules !== "strict") return null;
  for (const r of rows) for (let i = 0; i < r.marks.length; i++) {
    if (r.marks[i] === NEAR && guess[i] === r.guess[i]) return `${big(guess[i])} can't be ${ORD[i]}`;
    if (r.marks[i] === GREY) {
      const l = r.guess[i], inWord = r.marks.filter((m, j) => m !== GREY && r.guess[j] === l).length;
      if (!inWord && guess.includes(l)) return `There's no ${big(l)}`;
      if (inWord && countIn(guess, l) > inWord) return inWord === 1 ? `There's only one ${big(l)}` : `There are only ${inWord} ${big(l)}s`;
      if (inWord && guess[i] === l) return `${big(l)} can't be ${ORD[i]}`;
    }
  }
  return fits(guess, rows) ? null : "That can't be the word";
}

// ---------- a seeded random source (integers only, so a deal is the same on every device) ----------
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
export const hashOf = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function shuffled(xs, r) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = r() % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- the answers of a length, packed for the solvers ----------
const packs = new Map();
/**
 * A lexicon's answers of a length as the solvers use them: words, tiers, each word's letters as numbers in one flat
 * array (L, n to a word), where each word is, and the human-style solver's weights (a common word comes to mind
 * first; a word of different letters is the kind people try).
 */
export function packOf(lex, len) {
  const key = `${lex.id}:${len}`;
  if (!packs.has(key)) {
    const list = lex.answers(len), N = list.length, L = new Uint16Array(N * len), tier = new Uint8Array(N), weight = new Int32Array(N);
    list.forEach(({ w, tier: t }, i) => {
      for (let k = 0; k < len; k++) L[i * len + k] = w.charCodeAt(k);
      tier[i] = t;
      weight[i] = [8, 4, 1][Math.min(2, t)] * (new Set(w).size === len ? 2 : 1);
    });
    packs.set(key, { lex, len, N, words: list.map(x => x.w), tier, weight, L, at: new Map(list.map((x, i) => [x.w, i])) });
  }
  return packs.get(key);
}
/** The marks of answer-pool word g against word a, as a code (the solvers' inner loop: no arrays made). */
export function codeAt(P, g, a) {
  const n = P.len, L = P.L, go = g * n, ao = a * n;
  let code = 0, used = 0, mult = 1;
  for (let i = 0; i < n; i++) if (L[go + i] === L[ao + i]) used |= 1 << i;
  const hits = used;
  for (let i = 0; i < n; i++, mult *= 3) {
    if (hits >> i & 1) { code += 2 * mult; continue; }
    const c = L[go + i];
    for (let j = 0; j < n; j++) if (!(used >> j & 1) && L[ao + j] === c) { used |= 1 << j; code += mult; break; }
  }
  return code;
}
/** The same for a guess outside the pool (a string) against pool word a. */
export function codeFor(P, guess, a) { return codeOfMarks(marksOf(guess, P.words[a])); }

// ---------- how hard a word is ----------
// The measure is the number of guesses a human-style player needs: one who opens with a word people open with, then
// guesses only words that could still be the answer, the commoner ones first and those of different letters rather
// than repeats. Played RUNS times from a seed made from the word itself, so it is the same everywhere. A word in a
// large family that differs by one letter (hatch, latch, match, patch…) takes this player many guesses, a rare word
// does too (it comes to mind late), a repeated letter as well; a word that splits the field cleanly takes few.
export const RUNS = 32;
const OPENERS = { 4: ["tale", "care", "sore", "rate", "lane", "tone", "pale", "mile"], 5: ["slate", "crane", "trace", "stare", "raise", "arise", "irate", "store"],
  6: ["stream", "rental", "silent", "listen", "master", "orange", "planet", "island"], 7: ["painter", "central", "trainee", "general", "station", "reality", "airline", "antler"] };
const openersOf = P => (OPENERS[P.len] || []).map(w => P.at.get(w)).filter(i => i != null);
/** One game of the human-style player for answer `ans`; its guesses, at most 20. */
export function humanGame(P, ans, r, openers = openersOf(P)) {
  let g = openers.length ? openers[r() % openers.length] : r() % P.N;
  if (g === ans && openers.length > 1) g = openers[(openers.indexOf(g) + 1) % openers.length];   // the measure is solving, not a lucky opener
  let cands = null, tries = 1;
  while (g !== ans && tries < 20) {
    const code = codeAt(P, g, ans), next = [];
    for (const i of cands || P.words.keys()) if (i !== g && codeAt(P, g, i) === code) next.push(i);
    cands = next;
    let total = 0;
    for (const i of cands) total += P.weight[i];
    let pick = r() % total;
    for (const i of cands) { pick -= P.weight[i]; if (pick < 0) { g = i; break; } }
    tries++;
  }
  return tries;
}
/** A word's grade: the human-style player's guesses summed over RUNS games (divide by RUNS for the mean). */
export function gradeOf(P, i) {
  const r = rng(hashOf(P.words[i])), openers = openersOf(P);
  let sum = 0;
  for (let k = 0; k < RUNS; k++) sum += humanGame(P, i, r, openers);
  return sum;
}
// The grades are worked out ahead (assay-grades.mjs writes assay-grades.js, tests/assay.mjs checks it): grading every
// word on the phone would take many seconds. Answers the file doesn't match (the word list has changed since, and the
// test is failing until it's rerun) have no grades, and the levels go by how common a word is meanwhile.
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
export const packGrades = gs => Array.from(gs, g => DIGITS[g >> 6] + DIGITS[g & 63]).join("");
const unpackGrades = s => Int32Array.from({ length: s.length / 2 }, (_, i) => DIGITS.indexOf(s[2 * i]) * 64 + DIGITS.indexOf(s[2 * i + 1]));
const gradeTables = new Map();
/** Every word's grade, in the pack's order (an Int32Array), or null when the kept grades are for other answers. */
export function gradesOf(P) {
  const key = `${P.lex.id}:${P.len}`;
  if (!gradeTables.has(key)) {
    const kept = GRADES?.[P.lex.id]?.[P.len];
    gradeTables.set(key, kept && kept.n === P.N && kept.sum === hashOf(P.words.join(" ")) ? unpackGrades(kept.g) : null);
  }
  return gradeTables.get(key);
}

// ---------- the levels ----------
// Easy: a common word (the two commonest tiers) no harder than the middle of all; Medium: neither among the easiest
// fifth nor the hardest tenth, the daily's level; Hard: among the hardest quarter. The bands are quantiles of the
// length's own grades, since a longer word gives more away with every guess.
const levelLists = new Map();
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
/** The pack indices of a level's answers, in alphabetical order. */
export function levelOf(P, level) {
  const key = `${P.lex.id}:${P.len}:${level}`;
  if (!levelLists.has(key)) {
    const g = gradesOf(P), sorted = g ? [...g].sort((a, b) => a - b) : [], q = f => quantile(sorted, f);
    const keep = !g ? (level === "easy" ? i => P.tier[i] <= 1 : level === "hard" ? i => P.tier[i] >= 1 : () => true)
      : level === "easy" ? i => P.tier[i] <= 1 && g[i] <= q(.5) : level === "hard" ? i => g[i] >= q(.75) : i => g[i] >= q(.2) && g[i] <= q(.9);
    levelLists.set(key, Object.freeze([...P.words.keys()].filter(keep)));
  }
  return levelLists.get(key);
}
/** A level's answers' mean grade, as guesses (for the menu's line and the tests); NaN without grades. */
export function meanGuesses(P, level) {
  const g = gradesOf(P), list = levelOf(P, level);
  return g ? list.reduce((s, i) => s + g[i], 0) / list.length / RUNS : NaN;
}

// ---------- dealing ----------
/** `count` different answers of a length and level, from the seed; words in `avoid` (seen lately) only when needed. */
export function deal({ lex = ENGLISH, len = 5, level = "medium", seed = 1, count = 1, avoid = [] }) {
  const P = packOf(lex, len), list = levelOf(P, level), r = rng(seed), skip = new Set(avoid), out = [];
  const order = shuffled(list, r);
  for (const i of order) { if (out.length >= count) break; if (!skip.has(P.words[i])) out.push(P.words[i]); }
  for (const i of order) { if (out.length >= count) break; if (!out.includes(P.words[i])) out.push(P.words[i]); }
  return out;
}
// The daily: five letters, Medium, one board, the same for everyone. The day's word is the next in one fixed shuffle
// of Medium's words, counted in days from the day Assay began, so no word comes back for years.
const EPOCH = Date.UTC(2026, 9, 20);
export const dayNumber = day => Math.round((Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) - EPOCH) / 864e5);
const dailyOrders = new Map();
/** The day's word (day as YYYYMMDD). */
export function dailyWord(day, lex = ENGLISH) {
  const P = packOf(lex, DAILY.len);
  if (!dailyOrders.has(lex.id)) dailyOrders.set(lex.id, shuffled(levelOf(P, DAILY.level), rng(0xA55A1)));
  const order = dailyOrders.get(lex.id), d = dayNumber(day);
  return P.words[order[((d % order.length) + order.length) % order.length]];
}

// ---------- the word that dodges (Absurdle's rule) ----------
// No word is chosen. Every guess is marked to keep as many words in play as it can: of the ways the guess could be
// marked, the one most words still fit, ties to the one that shows least (fewest in place, then fewest elsewhere).
// It is beaten by leaving it one word, and then guessing it.
/** The marks the dodging word gives `guess`, and the words still in play after it (pack indices). */
export function dodgeStep(P, cands, guess) {
  const groups = new Map();
  for (const i of cands) { const c = codeFor(P, guess, i); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); }
  let best = null;
  for (const [code, list] of groups) {
    const m = marksOfCode(code, P.len), x = { code, list, h: m.filter(v => v === HIT).length, e: m.filter(v => v === NEAR).length };
    if (!best || list.length > best.list.length || (list.length === best.list.length && (x.h < best.h || (x.h === best.h && (x.e < best.e || (x.e === best.e && code < best.code)))))) best = x;
  }
  return { marks: marksOfCode(best.code, P.len), cands: best.list };
}

// ---------- hiding the answers in what's kept ----------
// A game, a table and a link carry their answers, so that a reload, a partner and another phone have them; shifted a
// different way at every letter, so a glance at them gives nothing away. Letters outside a to z pass unchanged.
const shift = (w, k) => [...w].map((c, i) => (/[a-z]/.test(c) ? String.fromCharCode(97 + ((c.charCodeAt(0) - 97 + k * (7 * i + 3)) % 26 + 26) % 26) : c)).join("");
export const hide = w => shift(w, 1);
export const unhide = w => shift(w, -1);

// ---------- a game ----------
// { v, mode, len, boards, level, rules, seed, day (a daily's), secret (the answers, hidden), guesses, over: null, "won",
// "lost" or "time", ms (time played) }; a sprint adds { at (the word being played), past: [{ guesses, won }] }, the
// dodging word { left, marks } (the words still in play, and the marks it gave).
export function newGame({ lex = ENGLISH, mode = "classic", len = 5, boards = 1, level = "medium", rules = "free", seed = 1, words = null, day = null, avoid = [] } = {}) {
  boards = mode === "boards" ? (BOARDS.includes(boards) && boards > 1 ? boards : 4) : 1;
  const count = mode === "sprint" ? SPRINT_WORDS : mode === "dodge" ? 0 : boards;
  const answers = words || (count ? deal({ lex, len, level, seed, count, avoid }) : []);
  const g = { v: 1, lang: lex.id, mode, len, boards, level, rules: boards === 1 && RULES.includes(rules) ? rules : "free", seed, day, secret: answers.map(hide), guesses: [], over: null, ms: 0 };
  if (mode === "sprint") { g.at = 0; g.past = []; }
  if (mode === "dodge") { g.left = levelOf(packOf(lex, len), level).length; g.marks = []; }
  return g;
}
/** The answers, as words. */
export const answersOf = g => g.secret.map(unhide);
/** The rows of board b: { guess, marks }, up to the guess that solved it (a sprint's: its current word's). */
export function rowsOf(g, b = 0) {
  if (g.mode === "dodge") return g.guesses.map((guess, i) => ({ guess, marks: g.marks[i] }));
  const answer = g.mode === "sprint" ? unhide(g.secret[g.at]) : unhide(g.secret[b]), rows = [];
  for (const guess of g.guesses) {
    const marks = marksOf(guess, answer);
    rows.push({ guess, marks });
    if (marks.every(m => m === HIT)) break;
  }
  return rows;
}
/** The guess (0 the first) that solved board b, or -1. */
export function solvedAt(g, b = 0) {
  const rows = rowsOf(g, b), last = rows.at(-1);
  return last && last.marks.every(m => m === HIT) ? rows.length - 1 : -1;
}
/** How many guesses a game allows (a sprint's: each word's; the dodging word: no limit). */
export const limitOf = g => (g.mode === "dodge" ? Infinity : guessesFor(g.len, g.boards));
/** Whether a typed word may be guessed now: null, or why not. The rules hold on one board (on several, each board's
 *  hints would contradict the others', so several boards always play free). */
export function refusal(g, word, lex = ENGLISH) {
  if (g.over) return "The game is over";
  if (word.length !== g.len) return `${g.len} letters`;
  if (!lex.accepts(word)) return "Not in the word list";
  return g.boards > 1 ? null : rulesBreak(word, rowsOf(g, 0), g.rules);
}
/**
 * Plays a guess. Returns { ok: false, why } for a guess refused (not a word, against the rules), else { ok: true,
 * solved: the boards it solved, over }. A sprint moves to its next word when one is solved or its guesses run out.
 */
export function guessIn(g, word, lex = ENGLISH) {
  word = String(word || "").toLowerCase();
  const why = refusal(g, word, lex);
  if (why) return { ok: false, why };
  const before = g.mode === "boards" ? Array.from({ length: g.boards }, (_, b) => solvedAt(g, b) >= 0) : [];
  g.guesses.push(word);
  let solved = [];
  if (g.mode === "dodge") {
    const P = packOf(lex, g.len), step = dodgeStep(P, dodgeCands(g, lex, g.guesses.length - 1), word);
    g.marks.push(step.marks);
    g.left = step.cands.length;
    if (step.marks.every(m => m === HIT)) { g.over = "won"; solved = [0]; g.secret = [hide(word)]; }
  } else if (g.mode === "sprint") {
    const won = solvedAt(g, 0) >= 0;
    if (won || g.guesses.length >= limitOf(g)) {
      g.past.push({ guesses: [...g.guesses], won });
      if (won) solved = [0];
      g.guesses = [];
      g.at++;
      if (g.at >= g.secret.length) g.over = "time";
    }
  } else {
    const n = g.mode === "boards" ? g.boards : 1;
    solved = [...Array(n).keys()].filter(b => !before[b] && solvedAt(g, b) >= 0);
    const all = [...Array(n).keys()].every(b => solvedAt(g, b) >= 0);
    if (all) g.over = "won";
    else if (g.guesses.length >= limitOf(g)) g.over = "lost";
  }
  return { ok: true, solved, over: g.over };
}
/** The dodging word's words in play before guess k (replayed from the start: it keeps nothing else). */
export function dodgeCands(g, lex = ENGLISH, k = g.guesses.length) {
  const P = packOf(lex, g.len);
  let cands = levelOf(P, g.level);
  for (let i = 0; i < k; i++) cands = cands.filter(c => codeFor(P, g.guesses[i], c) === codeOfMarks(g.marks[i]));
  return cands;
}
/** A sprint's clock ran out: the game ends with the words it solved. */
export function timeUp(g) { if (g.mode === "sprint" && !g.over) g.over = "time"; }
export const sprintSolved = g => (g.past || []).filter(p => p.won).length;
/** Guesses used: every one played (a sprint's, in all its words). */
export const guessesUsed = g => (g.mode === "sprint" ? (g.past || []).reduce((n, p) => n + p.guesses.length, 0) + g.guesses.length : g.guesses.length);

/** What each letter has shown on board b: { letter: HIT | NEAR | GREY }, the best it has shown. */
export function lettersOf(g, b = 0) {
  const out = {};
  for (const { guess, marks } of rowsOf(g, b)) [...guess].forEach((l, i) => { if (!(out[l] >= marks[i])) out[l] = marks[i]; });
  return out;
}

/**
 * A head-to-head's score for a finished game, lower better: the guesses used, a game not solved counting as the limit
 * and one more for each board left (so solving more boards always beats fewer); a sprint's, the words it didn't
 * solve out of all it was dealt (more solved, lower).
 */
export function scoreOf(g) {
  if (g.mode === "sprint") return 1000 - sprintSolved(g);
  if (g.mode === "dodge") return g.over === "won" ? g.guesses.length : 999;
  const n = g.mode === "boards" ? g.boards : 1, left = [...Array(n).keys()].filter(b => solvedAt(g, b) < 0).length;
  return left ? limitOf(g) + left : g.guesses.length;
}

// ---------- playing together: the colours split between the players ----------
// At a pair's table every guess is shared and every phone knows the marks, but each player sees only their part:
// one sees what's in place, the other what's elsewhere, and neither sees what's out. A letter is out only when
// neither of you has it lit, so you have to say what you see. Three or more share the three kinds round the table,
// the third seeing what's out. Once the game is over, everyone sees everything.
export const UNSEEN = -1;
/** Which kind of mark a seat sees at a table of `people`: HIT, NEAR or GREY. */
export const roleOf = (slot, people, n = 0) => (people <= 2 ? [HIT, NEAR][(slot + n) % 2] : [HIT, NEAR, GREY][(slot + n) % 3]);
/** The marks as that role sees them: its own kind, UNSEEN for the rest. */
export const seenAs = (marks, role) => marks.map(m => (m === role ? m : UNSEEN));
