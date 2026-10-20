// Bulls' rules, pure (no page): Mastermind and Bulls and Cows, the code-breaking game. A codemaker hides a code of a few
// pegs; the codebreaker guesses, and each guess is scored in key pegs: a bull for every peg of the right colour in the
// right place, a cow for every other peg of a colour the code holds (counted as many times as both have it). The page
// (bulls.js) draws the boards; bulls-lock.js makes the Lock puzzles; bulls-table.js is the table played together;
// tests/bulls.mjs checks all of it.
//
// A code is a list of symbols 0..colours-1. Every code of a board is numbered in order (the first peg the most
// significant), so the computer players work on numbers and lists of them; a key (the score of a guess) is
// bulls * 6 + cows, one small number per outcome (cows are at most five).

export const VARIANTS = {
  small: { label: "Small", pegs: 3, colours: 6, repeats: true, rows: 8, about: "3 pegs, 6 colours, 8 rows" },
  classic: { label: "Classic", pegs: 4, colours: 6, repeats: true, rows: 10, about: "4 pegs, 6 colours, 10 rows" },
  super: { label: "Super", pegs: 5, colours: 8, repeats: true, rows: 12, about: "5 pegs, 8 colours, 12 rows" },
  digits: { label: "Bulls and Cows", pegs: 4, colours: 10, repeats: false, rows: 10, digits: true, about: "4 different digits, 10 rows" },
};
export const DAILY_VARIANT = "classic";      // today's code: Mastermind as it was sold in 1971, the same for everyone
/** The codemaker: Fair hides one code at the start; Devious hides none and answers every guess so that as many codes
 *  as possible still fit, so only skill, never luck, breaks it. */
export const MAKERS = { fair: "Fair", devious: "Devious" };
/** The computer as a codebreaker: Easy loses track of old rows (each older row is forgotten with this chance, the
 *  latest never); Medium guesses at random among the codes that fit every row; Hard plays Knuth's minimax. */
export const LEVELS = { easy: { label: "Easy", forget: 0.4 }, medium: { label: "Medium" }, hard: { label: "Hard" } };

const BASE = 6;                               // key = bulls * BASE + cows
export const keyOf = (b, c) => b * BASE + c;
export const bullsOf = key => Math.floor(key / BASE);
export const cowsOf = key => key % BASE;
const BUDGET = 1e6;                           // scores a computer move may weigh on the big boards: a fraction of a second on a phone

// ---------- randomness: seeded, so a seed is the same game on every device ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const mix = (a, b) => (Math.imul((a >>> 0) ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul((b >>> 0) + 1, 0xC2B2AE35)) >>> 0;
export const randomSeed = () => Math.floor(Math.random() * 2 ** 31) + 1;
/** Today's code's seed: the suite's day (the UTC date as YYYYMMDD), so it's the same code everywhere. */
export const daySeed = day => mix(day, 0xB0115);

// ---------- a board's codes ----------
const SPACES = new Map();
/** Every code of a board, numbered: { p, C, N, D (the pegs, N × p), K (each colour's count, N × C), at (code number → index) }. */
export function space(id) {
  if (SPACES.has(id)) return SPACES.get(id);
  const v = VARIANTS[id], p = v.pegs, C = v.colours, total = C ** p, list = [];
  const d = new Array(p);
  for (let n = 0; n < total; n++) {
    let x = n;
    for (let k = p - 1; k >= 0; k--) { d[k] = x % C; x = Math.floor(x / C); }
    if (!v.repeats && new Set(d).size < p) continue;
    list.push(n);
  }
  const N = list.length, D = new Uint8Array(N * p), K = new Uint8Array(N * C), at = new Int32Array(total).fill(-1);
  list.forEach((n, i) => {
    at[n] = i;
    for (let k = p - 1, x = n; k >= 0; k--, x = Math.floor(x / C)) { D[i * p + k] = x % C; K[i * C + (x % C)]++; }
  });
  const sp = { id, p, C, N, D, K, at, win: keyOf(p, 0), table: null };
  SPACES.set(id, sp);
  return sp;
}
/** A code's index among its board's codes (-1 if it isn't one: a repeat where none are allowed, a colour out of range). */
export function indexOf(sp, code) {
  if (!Array.isArray(code) || code.length !== sp.p) return -1;
  let n = 0;
  for (const x of code) { if (!Number.isInteger(x) || x < 0 || x >= sp.C) return -1; n = n * sp.C + x; }
  return sp.at[n];
}
export const codeAt = (sp, i) => Array.from(sp.D.subarray(i * sp.p, (i + 1) * sp.p));

/** The key for guess i against code j (both indices). */
export function keyFor(sp, i, j) {
  if (sp.table) return sp.table[i * sp.N + j];
  const { p, C, D, K } = sp;
  let b = 0, t = 0;
  for (let k = 0; k < p; k++) if (D[i * p + k] === D[j * p + k]) b++;
  for (let c = 0; c < C; c++) { const x = K[i * C + c], y = K[j * C + c]; t += x < y ? x : y; }
  return b * BASE + t - b;
}
/** Small boards keep every score in a table (Classic's is 1.7 MB): Knuth's search then costs lookups, not counting. */
function tabled(sp) {
  if (sp.table || sp.N > 1296) return sp;
  const T = new Uint8Array(sp.N * sp.N);
  for (let i = 0; i < sp.N; i++) for (let j = 0; j < sp.N; j++) T[i * sp.N + j] = keyFor(sp, i, j);
  sp.table = T;
  return sp;
}

/** The key pegs for a guess against a code, as lists of symbols: { b, c }. */
export function score(guess, code) {
  let b = 0, t = 0;
  const cg = new Map(), cc = new Map();
  guess.forEach((x, k) => { if (x === code[k]) b++; cg.set(x, (cg.get(x) || 0) + 1); });
  for (const x of code) cc.set(x, (cc.get(x) || 0) + 1);
  for (const [x, n] of cg) t += Math.min(n, cc.get(x) || 0);
  return { b, c: t - b };
}
/** Why a guess can't be played on this board, in a few words, or null if it can. */
export function invalid(id, guess) {
  const v = VARIANTS[id];
  if (!Array.isArray(guess) || guess.length !== v.pegs || guess.some(x => !Number.isInteger(x) || x < 0)) return `Fill all ${v.pegs} ${v.digits ? "digits" : "pegs"}`;
  if (guess.some(x => x >= v.colours)) return "Not on this board";
  if (!v.repeats && new Set(guess).size < guess.length) return "Every digit different";
  return null;
}
/** The hidden code for a seed: any of the board's codes, each as likely. */
export function secretOf(id, seed) {
  const sp = space(id);
  return codeAt(sp, Math.floor(rng(mix(seed, 0x5EC)) () * sp.N));
}

// ---------- what the rows say ----------
// rows: [{ g: guess, b, c }], the guesses made and their keys
const rowKeys = (sp, rows) => rows.map(r => ({ i: indexOf(sp, r.g), k: keyOf(r.b, r.c) }));
/** The indices of the codes every row allows. */
export function fitting(id, rows) {
  const sp = space(id), rk = rowKeys(sp, rows), out = [];
  for (let j = 0; j < sp.N; j++) if (rk.every(r => r.i >= 0 && keyFor(sp, r.i, j) === r.k)) out.push(j);
  return out;
}
export const countFitting = (id, rows) => fitting(id, rows).length;
/** Whether a guess could still be the code: it scores against every row as the rows were scored. */
export function fits(id, rows, guess) {
  return rows.every(r => { const s = score(r.g, guess); return s.b === r.b && s.c === r.c; });
}
/** What every code the rows allow agrees on, per symbol: out (in none of them), in (in all of them). */
export function symbolsOf(id, rows) {
  const sp = space(id), fit = fitting(id, rows), seen = new Array(sp.C).fill(0);
  for (const j of fit) for (let c = 0; c < sp.C; c++) if (sp.K[j * sp.C + c]) seen[c]++;
  return { out: seen.flatMap((n, c) => (n === 0 ? [c] : [])), in: seen.flatMap((n, c) => (fit.length && n === fit.length ? [c] : [])), left: fit.length };
}

// ---------- the codemakers ----------
/**
 * The devious codemaker's answer to a guess: of the codes still fitting every row, it sorts them by the key this
 * guess would get and answers with the largest group, so as many codes as possible stay possible (a tie goes away
 * from a win, then by the seed). It never contradicts itself: some code always fits every answer it gave.
 */
export function deviousAnswer(id, rows, guess, seed) {
  const sp = space(id), gi = indexOf(sp, guess), fit = fitting(id, rows);
  if (gi < 0 || !fit.length) return null;
  const sizes = new Map();
  for (const j of fit) { const k = keyFor(sp, gi, j); sizes.set(k, (sizes.get(k) || 0) + 1); }
  const top = Math.max(...sizes.values());
  let keys = [...sizes].filter(([, n]) => n === top).map(([k]) => k);
  if (keys.length > 1) keys = keys.filter(k => k !== sp.win);
  keys.sort((a, b) => a - b);
  const k = keys[Math.floor(rng(mix(seed, rows.length + 1))() * keys.length)];
  return { b: bullsOf(k), c: cowsOf(k) };
}

// ---------- the computer as codebreaker ----------
/** The first guess of Knuth's search on each board (the search from every code finds the first two; the big boards'
 *  are the best of their kind by the same measure, since searching all 32,768 there would take a phone minutes). */
const OPENERS = { small: [0, 1, 2], classic: [0, 0, 1, 1], super: [0, 0, 1, 2, 3], digits: [0, 1, 2, 3] };
const SAMPLE = 1000;                          // codes a big board's search scores against while more than this many fit
/**
 * Knuth's minimax (1977): the guess, from every code, whose worst answer leaves the fewest codes; a tie goes to a
 * guess that could itself be the code, then to the lowest. On Classic that breaks every code in five guesses at most,
 * 4.476 on average. Where every guess against every fitting code would cost more than BUDGET, it weighs a sample:
 * half fitting codes, half any, against at most SAMPLE of the fitting ones.
 */
function minimax(sp, fit, r) {
  if (fit.length <= 2) return fit[0];
  const inFit = new Uint8Array(sp.N);
  for (const j of fit) inFit[j] = 1;
  let pool = null, target = fit;
  if (sp.N * fit.length > (sp.table ? 4 * BUDGET : BUDGET)) {   // a lookup costs a quarter of a count
    if (fit.length > SAMPLE) target = Array.from({ length: SAMPLE }, () => fit[Math.floor(r() * fit.length)]);
    const size = Math.max(16, Math.floor(BUDGET / target.length)), own = fit.slice();
    for (let i = own.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [own[i], own[j]] = [own[j], own[i]]; }
    pool = own.slice(0, Math.ceil(size / 2));
    while (pool.length < size) pool.push(Math.floor(r() * sp.N));
  }
  const count = new Int32Array(BASE * BASE);
  let best = -1, most = Infinity, bestFits = 0;
  const weigh = g => {
    count.fill(0);
    let m = 0;
    for (const j of target) { const k = keyFor(sp, g, j); if (++count[k] > m) { m = count[k]; if (m > most) return; } }
    if (m < most || (m === most && inFit[g] && !bestFits)) { most = m; best = g; bestFits = inFit[g]; }
  };
  if (pool) for (const g of pool) weigh(g); else for (let g = 0; g < sp.N; g++) weigh(g);
  return best;
}
/**
 * The computer's next guess at a code, from its own rows so far: Easy forgets older rows now and then (as a person
 * misreads or loses track), Medium picks any code that fits every row, Hard plays Knuth's minimax. The seed makes a
 * guess the same however often it's worked out.
 */
export function breakerGuess(id, rows, level = "hard", seed = 1) {
  const sp = space(id), r = rng(mix(seed, 31 * rows.length + 7));
  if (level === "hard") {
    tabled(sp);
    if (!rows.length) return OPENERS[id].slice();
    const fit = fitting(id, rows);
    return codeAt(sp, fit.length ? minimax(sp, fit, r) : 0);
  }
  const tried = new Set(rows.map(x => indexOf(sp, x.g)));
  const kept = level === "easy" ? rows.filter((_, i) => i === rows.length - 1 || r() >= LEVELS.easy.forget) : rows;
  let fit = fitting(id, kept).filter(j => !tried.has(j));
  if (!fit.length) fit = fitting(id, rows);                     // what it forgot left nothing: it looks again
  return codeAt(sp, fit[Math.floor(r() * fit.length)] ?? 0);
}

// ---------- a game of Break: you against the codemaker ----------
/** A new game: the board, the seed, the codemaker, today's or not. */
export function newBreak({ variant = "classic", seed = randomSeed(), maker = "fair", daily = false } = {}) {
  return { kind: "break", variant, seed, maker: daily ? "fair" : maker, daily, rows: [], done: null };
}
/** The code, once the game is over: the one hidden at the start, or the one the devious codemaker was left with. */
export function revealed(game) {
  if (game.maker !== "devious") return secretOf(game.variant, game.seed);
  const fit = fitting(game.variant, game.rows);
  return fit.length ? codeAt(space(game.variant), fit[0]) : null;
}
/** A guess: its row ({ g, b, c }), or { error } why it can't be played. The game is over at a full row of bulls or at the last row. */
export function guessBreak(game, guess) {
  if (game.done) return { error: "The game is over" };
  const bad = invalid(game.variant, guess);
  if (bad) return { error: bad };
  const s = game.maker === "devious" ? deviousAnswer(game.variant, game.rows, guess, game.seed) : score(guess, secretOf(game.variant, game.seed));
  const row = { g: guess.slice(), b: s.b, c: s.c };
  game.rows.push(row);
  if (s.b === VARIANTS[game.variant].pegs) game.done = "broken";
  else if (game.rows.length >= VARIANTS[game.variant].rows) game.done = "out";
  return { row };
}

// ---------- a duel: you and the computer each break the other's code ----------
// You set a code for the computer, it hides one for you, and you take turns: your guess, then its. The fewer guesses
// wins; the same number is a draw, and so is neither breaking the other's within the rows.
export function newDuel({ variant = "classic", seed = randomSeed(), level = "medium" } = {}) {
  return { kind: "duel", variant, seed, level, mine: null, rows: [], cpu: [], done: null };
}
/** The code the computer hides for you. */
export const duelSecret = duel => secretOf(duel.variant, mix(duel.seed, 2));
export function setDuelCode(duel, code) {
  if (duel.mine) return "Your code is set";
  const bad = invalid(duel.variant, code);
  if (bad) return bad;
  duel.mine = code.slice();
  return null;
}
/** Your guess at the computer's code: its row, or { error }. The computer answers with its own guess after it. */
export function duelGuess(duel, guess) {
  if (duel.done || !duel.mine) return { error: duel.done ? "The duel is over" : "Set your code first" };
  if (duel.rows.length > duel.cpu.length) return { error: "The computer is guessing" };
  const bad = invalid(duel.variant, guess);
  if (bad) return { error: bad };
  const s = score(guess, duelSecret(duel)), row = { g: guess.slice(), b: s.b, c: s.c };
  duel.rows.push(row);
  return { row };
}
/** The computer's guess at your code, after yours; settles the duel once a turn ends with a code broken or the rows full. */
export function duelReply(duel) {
  if (duel.done || !duel.mine || duel.cpu.length >= duel.rows.length) return null;
  const g = breakerGuess(duel.variant, duel.cpu, duel.level, mix(duel.seed, 3)), s = score(g, duel.mine), row = { g, b: s.b, c: s.c };
  duel.cpu.push(row);
  const pegs = VARIANTS[duel.variant].pegs, mine = duel.rows.at(-1).b === pegs, theirs = s.b === pegs;
  if (mine || theirs) duel.done = mine && theirs ? "draw" : mine ? "won" : "lost";
  else if (duel.rows.length >= VARIANTS[duel.variant].rows) duel.done = "draw";
  return row;
}

// ---------- records ----------
/** A finished game of Break into its board's record: { played, broken, guesses (of the broken), by: [count by guesses] }. */
export function noteResult(record, game) {
  const r = { played: 0, broken: 0, guesses: 0, by: [], ...(record || {}) };
  r.by = Array.from({ length: VARIANTS[game.variant].rows + 1 }, (_, i) => r.by?.[i] || 0);
  r.played++;
  if (game.done === "broken") { r.broken++; r.guesses += game.rows.length; r.by[game.rows.length]++; } else r.by[0]++;
  return r;
}
