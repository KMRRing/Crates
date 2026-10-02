// Punt: a question from the Crates bank, two or four options (sometimes more than one right, and then you're
// told how many and must pick all of them), and house odds. You pick and stake part of your pot, or pass. The
// house prices each question from how hard its clue is, plus noise: sometimes it overpays, sometimes it
// underpays. Knowing the answer is half of it; the other half is seeing when the price is wrong and sizing the
// bet to how sure you are.
//
// Runs are dealt in balanced batches, so they're comparable: within a batch the mix of question kinds, option
// counts and clue difficulties is exactly the level's mix, and the house's mispricings are an even spread of its
// noise, shuffled, averaging out to exactly its margin. Runs differ in which questions they get, never in how
// generous the house happened to be.
import { BANK } from "./core.js";

// questions: a standard run's length; options: how many choices a question may have (two or four, so they fill
// the 2×2 grid: three would leave one dangling) and diff: clue difficulties, both dealt in these proportions;
// spread: how far the house's price strays from fair, as a multiplier (bigger = more mispriced, easier to exploit;
// a multiplier keeps a long shot's mispricing in proportion); margin: the house's cut; multi: how often a clue
// that fits several answers shows more than one of them.
export const LEVELS = {
  easy: { label: "Easy", questions: 12, options: [2, 2, 2, 4], diff: [1, 1, 2], spread: 0.45, margin: 0.03, multi: 0.15 },
  medium: { label: "Medium", questions: 15, options: [2, 4, 4], diff: [1, 2, 2, 3], spread: 0.3, margin: 0.05, multi: 0.25 },
  hard: { label: "Hard", questions: 15, options: [4], diff: [2, 3, 3], spread: 0.18, margin: 0.06, multi: 0.35 },
};
// How long a run is: the level's standard length, 100 questions, or endless (dealt a batch at a time).
export const LENGTHS = {
  standard: { label: "Standard" },
  hundred: { label: "100 questions", questions: 100 },
  endless: { label: "Endless" },
};
export const BATCH = 20;
const KINDS = ["clue", "clue", "clue", "answer", "answer"];   // three clue questions to two answer questions
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
/** The value below which a share p of a standard normal distribution lies (Acklam's approximation). */
function quantile(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const tail = q => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
/** count values, repeating the given ones in proportion, shuffled. */
const deck = (rnd, values, count) => shuffle(rnd, Array.from({ length: count }, (_, i) => values[i % values.length]));
/** A different random stream for each batch of a run. */
const mix = (seed, start) => (seed ^ Math.imul(start + 1, 0x9E3779B1)) >>> 0;

// ---------- the bank, indexed ----------
// every clue-answer pair, and for each clue text, which answers carry it
const PAIRS = BANK.flatMap((a, i) => a.words.map(w => ({ a: i, w: w.w, hint: w.hint, d: w.d })));
const CARRIERS = new Map();
for (const p of PAIRS) { if (!CARRIERS.has(p.w)) CARRIERS.set(p.w, new Set()); CARRIERS.get(p.w).add(p.a); }
const pairOf = (a, w) => PAIRS.find(p => p.a === a && p.w === w);
const NOUN = { country: "country", commodity: "commodity" };
const PLURAL_NOUN = { country: "countries", commodity: "commodities" };

/** Whether a clue gives an answer away by naming it. */
const names = (w, a) => [BANK[a].name, ...(BANK[a].aliases || [])].some(n => n.length > 3 && w.toLowerCase().includes(n.toLowerCase()));

/** Odds as shown and paid: steps of 0.05 below 2, 0.1 above, never under 1.05 or over 9.9. */
const price = x => Math.min(9.9, Math.max(1.05, x < 2 ? Math.round(x * 20) / 20 : Math.round(x * 10) / 10));

const choose = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };

/**
 * The chance a typical player picks exactly the right options: each right one is known with the chance its
 * clue's difficulty suggests, and the rest are guessed among the options not already known to be right.
 */
function chanceRight(difficulties, n) {
  const k = difficulties.length;
  let total = 0;
  for (let known = 0; known < 1 << k; known++) {
    let p = 1, m = 0;
    difficulties.forEach((d, i) => { if (known >> i & 1) { p *= KNOWS[d]; m++; } else p *= 1 - KNOWS[d]; });
    total += p / choose(n - m, k - m);
  }
  return total;
}

/** A question's chances: a typical player's chance of picking exactly the right options, and its fair price. */
function odds(difficulties, n, noise) {
  const fair = chanceRight(difficulties, n);
  return { chance: fair, fair: price(1 / fair), noise };
}

/**
 * Prices a batch: each question pays the fair price times its share of the noise, less the margin, scaled by
 * one factor for the whole batch, found so that a typical player's average return per unit staked is exactly
 * 1 − margin. (Without it, rounding and the 1.05× floor would quietly make a batch of short-priced questions
 * generous.)
 */
function priceBatch(L, questions) {
  const target = 1 - L.margin;
  const value = k => questions.reduce((t, q) => t + q.chance * price(k * target * q.noise / q.chance), 0) / questions.length;
  let lo = 0.5, hi = 1.5;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (value(mid) > target) hi = mid; else lo = mid; }
  const k = (lo + hi) / 2;
  for (const q of questions) { q.offered = price(k * target * q.noise / q.chance); delete q.noise; }
}

/**
 * The plan for a batch: each question's kind, option count, clue difficulty and noise, dealt so the batch has
 * exactly the level's mix, and noise that is an even spread of the house's (normal quantiles, shuffled) scaled so
 * its average is exactly 1.
 */
function plan(rnd, L, count) {
  const z = shuffle(rnd, Array.from({ length: count }, (_, i) => quantile((i + 0.5) / count)));
  const m = z.map(v => Math.exp(L.spread * v)), mean = m.reduce((s, v) => s + v, 0) / count;
  return { kinds: deck(rnd, KINDS, count), options: deck(rnd, L.options, count), diffs: deck(rnd, L.diff, count), noise: m.map(v => v / mean) };
}

/** A clue-answer pair of this difficulty not used yet in the run (once a difficulty runs dry, its pairs come round again). */
function freshPair(rnd, used, d) {
  let pool = PAIRS.filter(x => x.d === d && !used.has(x.w));
  if (!pool.length) { PAIRS.filter(x => x.d === d).forEach(x => used.delete(x.w)); pool = PAIRS.filter(x => x.d === d); }
  return pick(rnd, pool);
}

/** Wrong options: same kind of answer, mostly from the same region or sector (so they're plausible). */
function decoys(rnd, a, avoid, count) {
  const kin = (x, sameGroup) => BANK[x].cat === BANK[a].cat && !avoid.has(x) && (!sameGroup || BANK[x].group === BANK[a].group);
  const near = shuffle(rnd, BANK.map((_, x) => x).filter(x => kin(x, true)));
  const far = shuffle(rnd, BANK.map((_, x) => x).filter(x => kin(x, false) && !near.includes(x)));
  return [...near, ...far].slice(0, count);
}

/** "Which commodity is this about?" A clue, and answers to pick from (any that carry the clue are right). */
function clueQuestion(rnd, L, used, n, d, noise) {
  const p = freshPair(rnd, used, d), carriers = CARRIERS.get(p.w);
  const others = shuffle(rnd, [...carriers].filter(x => x !== p.a && BANK[x].cat === BANK[p.a].cat));
  // sometimes more than one of the answers carrying the clue is offered; at least one option is always wrong
  const extra = others.length && rnd() < L.multi ? (rnd() < 0.5 ? 1 : 2) : 0;
  const right = [p.a, ...others.slice(0, Math.min(extra, n - 2))];
  const wrong = decoys(rnd, p.a, carriers, n - right.length);
  if (wrong.length < n - right.length) return null;
  const options = shuffle(rnd, [...right, ...wrong]);
  if (options.some(x => names(p.w, x))) return null;
  const ds = right.map(x => pairOf(x, p.w)?.d ?? p.d);
  return {
    kind: "clue", cat: BANK[p.a].cat, prompt: p.w,
    ask: right.length > 1 ? `Which ${PLURAL_NOUN[BANK[p.a].cat]} is this about?` : `Which ${NOUN[BANK[p.a].cat]} is this about?`,
    options: options.map(x => ({ label: BANK[x].name, right: right.includes(x) })), need: right.length,
    notes: right.map(x => ({ label: BANK[x].name, text: pairOf(x, p.w)?.hint || p.hint })),
    d: Math.min(...ds), ...odds(ds, n, noise), key: p.w,
  };
}

/** "Which goes with Chile?" An answer, and clues to pick from (any clue Chile carries is right). */
function answerQuestion(rnd, L, used, n, d, noise) {
  const p = freshPair(rnd, used, d);
  const a = p.a, mine = new Set(BANK[a].words.map(w => w.w));
  const extra = rnd() < L.multi ? 1 : 0;
  const second = extra && n > 2 ? pick(rnd, BANK[a].words.filter(w => w.w !== p.w && L.diff.includes(w.d) && !names(w.w, a))) : null;
  const right = [p.w, ...(second ? [second.w] : [])];
  // wrong clues: from answers of the same kind, mostly nearby, that this answer doesn't carry
  const pool = decoys(rnd, a, new Set([a]), 12).flatMap(x => BANK[x].words.filter(w => !mine.has(w.w) && L.diff.includes(w.d)).map(w => w.w));
  const wrong = shuffle(rnd, [...new Set(pool)]).slice(0, n - right.length);
  if (wrong.length < n - right.length || right.some(w => names(w, a)) || wrong.some(w => names(w, a))) return null;
  const options = shuffle(rnd, [...right, ...wrong]);
  const ds = right.map(w => pairOf(a, w).d);
  return {
    kind: "answer", cat: BANK[a].cat, prompt: BANK[a].name, ask: right.length > 1 ? "Which clues go with" : "Which clue goes with",
    options: options.map(w => ({ label: w, right: right.includes(w) })), need: right.length,
    notes: right.map(w => ({ label: w, text: pairOf(a, w).hint })),
    d: Math.min(...ds), ...odds(ds, n, noise), key: p.w,
  };
}

/** A balanced batch of questions (see the top). The same seed and start always give the same batch. */
function makeQuestions(seed, levelId, count, start, used) {
  const L = LEVELS[levelId], rnd = rng(mix(seed, start)), p = plan(rnd, L, count), out = [];
  for (let i = 0; i < count; i++) {
    const build = p.kinds[i] === "clue" ? clueQuestion : answerQuestion;
    let q = null;
    for (let tries = 0; !q && tries < 80; tries++) q = build(rnd, L, used, p.options[i], p.diffs[i], p.noise[i]);
    if (!q) continue;                       // vanishingly rare: the batch is one question short
    used.add(q.key);
    out.push(q);
  }
  priceBatch(L, out);
  return out;
}

/** A run's questions: all of them for a fixed length (balanced as one batch), the first batch for an endless run. */
export function makeSession(seed, levelId, lengthId = "standard") {
  const count = lengthId === "endless" ? BATCH : LENGTHS[lengthId]?.questions ?? LEVELS[levelId].questions;
  return makeQuestions(seed, levelId, count, 0, new Set());
}
/** The next batch of an endless run, following the questions dealt so far. */
export const moreQuestions = (seed, levelId, dealt) => makeQuestions(seed, levelId, BATCH, dealt.length, new Set(dealt.map(q => q.key)));

/**
 * The average return per question, compounded: the steady rate per question that turns the starting pot into
 * the pot now (a pass counts as 0%; a bust is −100%). null before any question is settled.
 */
export function averageReturn(log) {
  if (!log.length) return null;
  const growth = log.reduce((g, r) => g * (r.pot > 0 ? (r.pot + r.change) / r.pot : 0), 1);
  return growth > 0 ? growth ** (1 / log.length) - 1 : -1;
}
/** How an average return reads: +1.8% or −0.4%. */
export const showReturn = r => `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r * 100).toFixed(1)}%`;

/** Whether a pick (option indices) is exactly the question's right options: all of them, and nothing else. */
export const pickedRight = (q, pick) => !!pick && pick.length === rightCount(q) && pick.every(i => q.options[i]?.right);
/** How many options are right (older saved questions don't say, so count them). */
export const rightCount = q => q.need ?? q.options.filter(o => o.right).length;

/** What a bet returns: stake = pct% of the pot (rounded down); a right pick wins stake × (odds − 1). */
export function settle(pot, pct, right, offered) {
  const stake = Math.floor(pot * pct / 100);
  return { stake, change: stake === 0 ? 0 : right ? Math.round(stake * (offered - 1)) : -stake };
}

/** How odds read: 2.1× or 1.35×. */
export const showOdds = x => `${x < 2 ? x.toFixed(2).replace(/0$/, "") : x.toFixed(1)}×`;
/** How chips read: 12,450. */
export const showChips = n => Math.round(n).toLocaleString("en-US");
