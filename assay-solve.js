// Assay's computer players (README, Assay: the rival), pure: each level a way of solving, not a dice roll on a
// result. Novice forgets what's elsewhere in the word (it plays on what's in place and what's out); Steady is the
// human-style player that grades the words (assay-engine.js): it guesses only what could still be the word, the
// commoner first; Sharp guesses the possible word that splits the rest best (the most information); Master may
// guess any word that splits them best, a word that can't be the answer included, and closes on one when it can.
// Each guess comes after a person's thinking time. A rival's whole game is worked out when the game starts (it
// doesn't depend on yours), so it is kept with the game and shows the same after a reload and to a partner watching.
import { packOf, codeAt, codeFor, marksOf, codeOfMarks, marksOfCode, rng, hashOf, humanGame, levelOf, guessesFor, allHit, unhide, dodgeStep, SPRINT_MS, HIT, GREY } from "./assay-engine.js";
import { ENGLISH } from "./assay-words.js";

export const RIVALS = ["novice", "steady", "sharp", "master"];
export const RIVAL_NAMES = { novice: "Novice", steady: "Steady", sharp: "Sharp", master: "Master" };
// thinking time a guess, ms: a base and a spread either side
const THINK = { novice: [22000, 10000], steady: [16000, 7000], sharp: [11000, 5000], master: [8000, 4000] };
// the best first guess by information over each length's answers (seven letters: within a hair of the best, latrine,
// and a word people open with); tests/assay.mjs checks each is still among the best
export const BEST_OPENER = { 4: "tale", 5: "slate", 6: "satire", 7: "certain" };

// ---------- information ----------
const counts = new Int32Array(3 ** 8), touched = new Int32Array(4096);
/** How well a guess (pack index) splits the candidates: the information in bits (more is better). */
function splitBits(P, g, cands) {
  let k = 0;
  for (const c of cands) { const code = codeAt(P, g, c); if (!counts[code]++) touched[k++] = code; }
  let s = 0;
  for (let i = 0; i < k; i++) { const n = counts[touched[i]]; s += n * Math.log2(n); counts[touched[i]] = 0; }
  return Math.log2(cands.length) - s / cands.length;
}
/** The largest group of candidates a guess leaves (against the dodging word, the size it keeps). */
function worstGroup(P, g, cands) {
  let k = 0, worst = 0;
  for (const c of cands) { const code = codeAt(P, g, c); if (!counts[code]++) touched[k++] = code; }
  for (let i = 0; i < k; i++) { worst = Math.max(worst, counts[touched[i]]); counts[touched[i]] = 0; }
  return worst;
}
const sample = (xs, n, r) => {
  if (xs.length <= n) return xs;
  const a = [...xs];
  for (let i = 0; i < n; i++) { const j = i + (r() % (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
const weighted = (P, cands, r) => {
  let total = 0;
  for (const i of cands) total += P.weight[i];
  let pick = r() % total;
  for (const i of cands) { pick -= P.weight[i]; if (pick < 0) return i; }
  return cands[0];
};

// ---------- what each level knows ----------
/** The words that fit everything shown (pack indices), narrowed by one more row. */
const narrow = (P, cands, g, code) => cands.filter(c => codeAt(P, g, c) === code);
/** Novice's words: right letters in their places, no letter shown out; what's elsewhere it forgets. */
function noviceNarrow(P, cands, g, code) {
  const m = marksOfCode(code, P.len), n = P.len, gw = P.words[g];
  const inWord = new Set([...gw].filter((l, i) => m[i] !== GREY));
  return cands.filter(c => {
    const w = P.words[c];
    for (let i = 0; i < n; i++) {
      if (m[i] === HIT && w[i] !== gw[i]) return false;
      if (m[i] === GREY && !inWord.has(gw[i]) && w.includes(gw[i])) return false;
    }
    return c !== g;
  });
}

/** The next guess on one board, from what this level knows (cands), or the probes it may try. */
function nextGuess(level, P, cands, r, first) {
  if (first) return level === "sharp" || level === "master" ? P.at.get(BEST_OPENER[P.len]) ?? cands[0] : humanOpener(P, r);
  if (cands.length <= 2 || level === "novice" || level === "steady") return level === "novice" || level === "steady" ? weighted(P, cands, r) : cands[0];
  const probes = level === "master" ? [...sample(cands, 60, r), ...sample([...P.words.keys()], 240, r)] : sample(cands, 160, r);
  const field = sample(cands, 400, r), isCand = new Set(cands);
  let best = -1, bestScore = -Infinity;
  for (const g of probes) {
    const s = splitBits(P, g, field) + (isCand.has(g) ? 1 / cands.length : 0);   // a word that may be the answer could also win now
    if (s > bestScore + 1e-9) { bestScore = s; best = g; }
  }
  return best;
}
const humanOpener = (P, r) => {
  const open = ["slate", "crane", "trace", "stare", "raise", "arise", "irate", "store", "tale", "care", "sore", "rate", "lane", "tone",
    "stream", "rental", "silent", "listen", "master", "orange", "planet", "painter", "central", "trainee", "general", "station"].map(w => P.at.get(w)).filter(i => i != null);
  return open.length ? open[r() % open.length] : r() % P.N;
};

/** A thinking time for this guess (ms). */
function thinking(level, r, { first, sure, boards }) {
  const [base, spread] = THINK[level];
  let t = base - spread + (r() % (2 * spread + 1));
  if (first) t *= .45;                      // an opener is ready before the game starts
  if (sure) t *= .55;                       // only one word left: type it
  return Math.round(t * (1 + .12 * Math.max(0, boards - 1)));
}

// ---------- a rival's game ----------
/**
 * The rival's whole game for game g, at this level: { level, rows: [{ guess, at, word, marks? }], done (when its
 * last guess lands, ms of play), won, score (as scoreOf would give it) }. `word` is the sprint word a guess was for;
 * `marks` the dodging word's answer to it.
 */
export function rivalPlan(g, level, lex = ENGLISH) {
  const P = packOf(lex, g.len), r = rng(hashOf(`${g.seed}:${level}:${g.mode}:${g.len}:${g.boards}`)), rows = [];
  let clock = 0;
  const all = () => [...P.words.keys()];
  if (g.mode === "sprint") {
    let word = 0, solved = 0;
    while (clock < SPRINT_MS && word < g.secret.length) {
      const ans = P.at.get(unhide(g.secret[word]));
      let cands = all(), known = all(), won = false;
      for (let k = 0; k < guessesFor(g.len) && clock < SPRINT_MS; k++) {
        const guess = nextGuess(level, P, level === "novice" ? known : cands, r, k === 0);
        clock += thinking(level, r, { first: k === 0, sure: cands.length === 1, boards: 1 });
        if (clock >= SPRINT_MS) break;
        rows.push({ guess: P.words[guess], at: clock, word });
        if (guess === ans) { won = true; break; }
        const code = codeAt(P, guess, ans);
        cands = narrow(P, cands, guess, code); known = noviceNarrow(P, known, guess, code);
      }
      if (won) solved++;
      word++;
    }
    return { level, rows, done: Math.min(clock, SPRINT_MS), won: solved > 0, solved, score: 1000 - solved };
  }
  if (g.mode === "dodge") {
    let cands = levelOf(P, g.level), won = false;
    for (let k = 0; k < 30 && !won; k++) {
      let guess;
      if (k === 0) guess = nextGuess(level, P, cands, r, true);
      else if (cands.length === 1) guess = cands[0];
      else if (level === "master" || level === "sharp") {
        const probes = level === "master" ? [...sample(cands, 80, r), ...sample(all(), 220, r)] : sample(cands, 200, r);
        guess = probes.reduce((b, p) => { const w = worstGroup(P, p, cands); return w < b.w ? { p, w } : b; }, { p: cands[0], w: Infinity }).p;
      } else guess = level === "novice" ? cands[r() % cands.length] : weighted(P, cands, r);
      clock += thinking(level, r, { first: k === 0, sure: cands.length === 1, boards: 1 });
      const step = dodgeStep(P, cands, P.words[guess]);
      rows.push({ guess: P.words[guess], at: clock, marks: step.marks });
      won = step.marks.every(m => m === HIT);
      cands = step.cands;
    }
    return { level, rows, done: clock, won, score: won ? rows.length : 999 };
  }
  // one board or several: each board's candidates as this level knows them; the guesses are shared
  const n = g.mode === "boards" ? g.boards : 1, answers = g.secret.map(s => P.at.get(unhide(s)));
  const cands = answers.map(() => all()), known = answers.map(() => all()), solved = answers.map(() => false);
  const limit = guessesFor(g.len, n);
  for (let k = 0; k < limit && solved.some(s => !s); k++) {
    const open = [...answers.keys()].filter(b => !solved[b]);
    let guess;
    if (k === 0) guess = nextGuess(level, P, cands[0], r, true);
    else if (n === 1) guess = nextGuess(level, P, level === "novice" ? known[0] : cands[0], r, false);
    else guess = boardsGuess(level, P, open.map(b => (level === "novice" ? known[b] : cands[b])), r);
    clock += thinking(level, r, { first: k === 0, sure: open.some(b => cands[b].length === 1), boards: open.length });
    rows.push({ guess: P.words[guess], at: clock });
    for (const b of open) {
      if (guess === answers[b]) { solved[b] = true; continue; }
      const code = codeAt(P, guess, answers[b]);
      cands[b] = narrow(P, cands[b], guess, code); known[b] = noviceNarrow(P, known[b], guess, code);
    }
  }
  const left = solved.filter(s => !s).length;
  return { level, rows, done: clock, won: !left, score: left ? limit + left : rows.length };
}
/** On several boards: finish a board that's down to one word; else the guess that tells most across the boards. */
function boardsGuess(level, P, fields, r) {
  const sure = fields.find(f => f.length === 1);
  if (sure) return sure[0];
  if (level === "novice" || level === "steady") return weighted(P, fields.reduce((a, b) => (b.length < a.length ? b : a)), r);
  const probes = [...new Set(fields.flatMap(f => sample(f, level === "master" ? 30 : 20, r)))];
  if (level === "master") probes.push(...sample([...P.words.keys()], 60, r));
  const cut = fields.map(f => sample(f, 150, r)), isCand = new Set(fields.flat());
  let best = probes[0], bestScore = -Infinity;
  for (const g of probes) {
    let s = isCand.has(g) ? .5 : 0;
    for (const f of cut) s += splitBits(P, g, f);
    if (s > bestScore + 1e-9) { bestScore = s; best = g; }
  }
  return best;
}

/** What the rival has done by `ms` of play: the rows that have landed. */
export const rivalSoFar = (plan, ms) => (plan?.rows || []).filter(row => row.at <= ms);
/** Whether the rival has finished by then. */
export const rivalDone = (plan, ms) => !!plan && ms >= plan.done;
/** A rival row's marks on board b of game g (the dodging word's are kept with the row). */
export function rivalMarks(g, row, b = 0) {
  if (row.marks) return row.marks;
  const answer = unhide(g.secret[g.mode === "sprint" ? row.word : b]);
  return marksOf(row.guess, answer);
}
export { codeOfMarks, codeFor, allHit };
