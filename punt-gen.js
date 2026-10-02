// Punt: a question from the Crates bank, two to four options (sometimes more than one right), and house odds.
// You pick an option and stake part of your pot, or pass. The house prices each question from how hard its
// clue is, plus noise: sometimes it overpays, sometimes it underpays. Knowing the answer is half of it; the
// other half is seeing when the price is wrong and sizing the bet to how sure you are.
import { BANK } from "./core.js";

// questions: per session; options: how many choices a question may have; diff: clue difficulties dealt;
// spread: how far the house's guess at your chances strays (bigger = more mispriced, easier to exploit);
// margin: the house's cut; multi: how often a clue that fits several answers shows more than one of them.
export const LEVELS = {
  easy: { label: "Easy", questions: 12, options: [2, 2, 3], diff: [1, 1, 2], spread: 0.16, margin: 0.03, multi: 0.15 },
  medium: { label: "Medium", questions: 15, options: [2, 3, 3, 4], diff: [1, 2, 2, 3], spread: 0.1, margin: 0.05, multi: 0.25 },
  hard: { label: "Hard", questions: 15, options: [3, 4, 4], diff: [2, 3, 3], spread: 0.06, margin: 0.06, multi: 0.35 },
};
export const START_POT = 1000;

// The house's view of how likely a typical player is to know a clue, by its difficulty.
const KNOWS = { 1: 0.6, 2: 0.35, 3: 0.15 };

// ---------- random numbers ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, xs) => xs[Math.floor(rnd() * xs.length)];
const shuffle = (rnd, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const normal = rnd => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

// ---------- the bank, indexed ----------
// every clue-answer pair, and for each clue text, which answers carry it
const PAIRS = BANK.flatMap((a, i) => a.words.map(w => ({ a: i, w: w.w, hint: w.hint, d: w.d })));
const CARRIERS = new Map();
for (const p of PAIRS) { if (!CARRIERS.has(p.w)) CARRIERS.set(p.w, new Set()); CARRIERS.get(p.w).add(p.a); }
const pairOf = (a, w) => PAIRS.find(p => p.a === a && p.w === w);
const NOUN = { country: "country", commodity: "commodity" };

/** Whether a clue gives an answer away by naming it. */
const names = (w, a) => [BANK[a].name, ...(BANK[a].aliases || [])].some(n => n.length > 3 && w.toLowerCase().includes(n.toLowerCase()));

/** Odds as shown and paid: steps of 0.05 below 2, 0.1 above, never under 1.05 or over 9.9. */
const price = x => Math.min(9.9, Math.max(1.05, x < 2 ? Math.round(x * 20) / 20 : Math.round(x * 10) / 10));

/**
 * The house's price for a question: its guess at the chance a player picks a right option (knowing the clue,
 * or guessing among the options), knocked about by noise, less its margin.
 */
function odds(rnd, L, d, right, n) {
  const fair = KNOWS[d] + (1 - KNOWS[d]) * (right / n);
  const guess = Math.min(0.97, Math.max(0.08, fair + normal(rnd) * L.spread));
  return { chance: fair, fair: price(1 / fair), offered: price((1 - L.margin) / guess) };
}

/** Wrong options: same kind of answer, mostly from the same region or sector (so they're plausible). */
function decoys(rnd, a, avoid, count) {
  const kin = (x, sameGroup) => BANK[x].cat === BANK[a].cat && !avoid.has(x) && (!sameGroup || BANK[x].group === BANK[a].group);
  const near = shuffle(rnd, BANK.map((_, x) => x).filter(x => kin(x, true)));
  const far = shuffle(rnd, BANK.map((_, x) => x).filter(x => kin(x, false) && !near.includes(x)));
  return [...near, ...far].slice(0, count);
}

/** "Which commodity is this about?" A clue, and answers to pick from (any that carry the clue are right). */
function clueQuestion(rnd, L, used) {
  const p = pick(rnd, PAIRS.filter(x => L.diff.includes(x.d) && !used.has(x.w)));
  const n = pick(rnd, L.options), carriers = CARRIERS.get(p.w);
  const others = shuffle(rnd, [...carriers].filter(x => x !== p.a && BANK[x].cat === BANK[p.a].cat));
  // sometimes more than one of the answers carrying the clue is offered; at least one option is always wrong
  const extra = others.length && rnd() < L.multi ? (rnd() < 0.5 ? 1 : 2) : 0;
  const right = [p.a, ...others.slice(0, Math.min(extra, n - 2))];
  const wrong = decoys(rnd, p.a, carriers, n - right.length);
  if (wrong.length < n - right.length) return null;
  const options = shuffle(rnd, [...right, ...wrong]);
  if (options.some(x => names(p.w, x))) return null;
  const d = Math.min(...right.map(x => pairOf(x, p.w)?.d ?? p.d));
  return {
    kind: "clue", cat: BANK[p.a].cat, prompt: p.w, ask: `Which ${NOUN[BANK[p.a].cat]} is this about?`,
    options: options.map(x => ({ label: BANK[x].name, right: right.includes(x) })),
    notes: right.map(x => ({ label: BANK[x].name, text: pairOf(x, p.w)?.hint || p.hint })),
    d, ...odds(rnd, L, d, right.length, n), key: p.w,
  };
}

/** "Which goes with Chile?" An answer, and clues to pick from (any clue Chile carries is right). */
function answerQuestion(rnd, L, used) {
  const p = pick(rnd, PAIRS.filter(x => L.diff.includes(x.d) && !used.has(x.w)));
  const a = p.a, mine = new Set(BANK[a].words.map(w => w.w));
  const n = pick(rnd, L.options);
  const extra = rnd() < L.multi ? 1 : 0;
  const second = extra && n > 2 ? pick(rnd, BANK[a].words.filter(w => w.w !== p.w && L.diff.includes(w.d) && !names(w.w, a))) : null;
  const right = [p.w, ...(second ? [second.w] : [])];
  // wrong clues: from answers of the same kind, mostly nearby, that this answer doesn't carry
  const pool = decoys(rnd, a, new Set([a]), 12).flatMap(x => BANK[x].words.filter(w => !mine.has(w.w) && L.diff.includes(w.d)).map(w => w.w));
  const wrong = shuffle(rnd, [...new Set(pool)]).slice(0, n - right.length);
  if (wrong.length < n - right.length || right.some(w => names(w, a)) || wrong.some(w => names(w, a))) return null;
  const options = shuffle(rnd, [...right, ...wrong]);
  const d = Math.min(...right.map(w => pairOf(a, w).d));
  return {
    kind: "answer", cat: BANK[a].cat, prompt: BANK[a].name, ask: "Which clue goes with",
    options: options.map(w => ({ label: w, right: right.includes(w) })),
    notes: right.map(w => ({ label: w, text: pairOf(a, w).hint })),
    d, ...odds(rnd, L, d, right.length, n), key: p.w,
  };
}

/** A session's questions for this seed and level: the same seed always gives the same session. */
export function makeSession(seed, levelId) {
  const L = LEVELS[levelId], rnd = rng(seed), used = new Set(), out = [];
  for (let tries = 0; out.length < L.questions && tries < 400; tries++) {
    const q = rnd() < 0.6 ? clueQuestion(rnd, L, used) : answerQuestion(rnd, L, used);
    if (!q) continue;
    used.add(q.key);
    out.push(q);
  }
  return out;
}

/** What a bet returns: stake = pct% of the pot (rounded down); a right pick wins stake × (odds − 1). */
export function settle(pot, pct, right, offered) {
  const stake = Math.floor(pot * pct / 100);
  return { stake, change: stake === 0 ? 0 : right ? Math.round(stake * (offered - 1)) : -stake };
}

/** How odds read: 2.1× or 1.35×. */
export const showOdds = x => `${x < 2 ? x.toFixed(2).replace(/0$/, "") : x.toFixed(1)}×`;
/** How chips read: 12,450. */
export const showChips = n => Math.round(n).toLocaleString("en-US");
