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
  // Maths: questions from maths-bank.js instead of the clue bank, from whichever stages and difficulties the player
  // picks (dealt in seeded order, cycling once a pool runs dry); priced from each question's difficulty
  maths: { label: "Maths", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./maths-bank.js", note: "1 is routine GCSE, 10 the hardest first-year university. Roughly GCSE 1–4, IB SL 2–6, IB HL 4–8, Y1 Uni 6–10." },
  // Refining: the same machinery on refining-bank.js: how a refinery works, unit by unit
  refining: { label: "Refining", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./refining-bank.js", note: "1 is what anyone on a trading floor knows, 7 and up is for engineers. Basics 1–3, units 2–7, the blending chemistry 3–7, specs and economics 2–6." },
  // Reasoning: critical reasoning on reasoning-bank.js: arguments, flaws, inference, statistics, decisions
  reasoning: { label: "Reasoning", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./reasoning-bank.js", note: "3 is a clear fallacy, 8 is a base-rate or selection trap. Most sit at 5–6." },
  // Words: a word, pick its synonym; Capitals and Flags: the world's countries; Patterns: what comes next
  words: { label: "Words", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./words-bank.js", note: "Advanced words at 1–4, rare at 5–7, obscure at 8–10." },
  cities: { label: "Cities", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./cities-bank.js", note: "Capitals, which country a city is in, and what a city is known for: ports, refineries, exchanges, companies, culture. 1–3 is common knowledge, 5 and up is for traders." },
  flags: { label: "Flags", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./flags-bank.js", note: "1–3 are flags everyone knows, 9 the Pacific micro-states. Distractors come from the same region." },
  patterns: { label: "Patterns", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./patterns-bank.js", note: "1–3 are counting and squares, 7 and up need two steps or a trick." },
  wine: { label: "Wine", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./wine-bank.js", note: "Brut's cards: 1–3 is what any wine list assumes, 6 and up is for the trade." },
  art: { label: "Art", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./art-bank.js", note: "Paintings shown as pictures: who, where, which movement; and the art world's stories." },
  economics: { label: "Economics", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./eco-bank.js", note: "Markets with their diagrams, macro and money, trade and finance, the ideas." },
  physics: { label: "Physics", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./phy-bank.js", note: "Motion and energy, electricity and waves, heat and nuclei, the modern picture." },
  chemistry: { label: "Chemistry", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./chm-bank.js", note: "Atoms and bonds, reactions, organic chemistry and fuels, industry." },
  code: { label: "Code", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./cs-bank.js", note: "Data and algorithms, code to read, paradigms, systems and the web." },
  philosophy: { label: "Philosophy", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./phil-bank.js", note: "The ancients and moderns, ethics and politics, knowledge and mind." },
  religion: { label: "Religion", questions: 15, spread: 0.3, margin: 0.05, maths: true, bank: "./rel-bank.js", note: "The faiths, their calendars, food rules and etiquette: what to know before the meeting." },
};
/** A typical player's chance of knowing a maths question outright, by its difficulty (1 routine GCSE … 10 hardest Y1 Uni). */
export const knowsMaths = d => Math.min(0.9, Math.max(0.15, 0.9 - 0.08 * (d - 1)));
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
 * The chance a typical player picks exactly the right options: each right one is known with the chance given
 * (knowns, one per right option), and the rest are guessed among the options not already known to be right.
 */
function chanceRight(knowns, n) {
  const k = knowns.length;
  let total = 0;
  for (let known = 0; known < 1 << k; known++) {
    let p = 1, m = 0;
    knowns.forEach((c, i) => { if (known >> i & 1) { p *= c; m++; } else p *= 1 - c; });
    total += p / choose(n - m, k - m);
  }
  return total;
}

/** A question's chances: a typical player's chance of picking exactly the right options, and its fair price. */
function odds(knowns, n, noise) {
  const fair = chanceRight(knowns, n);
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
    d: Math.min(...ds), ...odds(ds.map(d => KNOWS[d]), n, noise), key: p.w,
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
    d: Math.min(...ds), ...odds(ds.map(d => KNOWS[d]), n, noise), key: p.w,
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

/**
 * A batch of maths questions: the pool (the bank, filtered to the chosen stages and difficulties) in the order the
 * seed shuffles it, taking up from where the run has got to, and round again once it runs dry; noise as for any
 * batch. stages: a label per stage id, for the small line above each question.
 */
function mathsQuestions(seed, pool, stages, count, start, dueKeys = [], seenKeys = new Set()) {
  const L = LEVELS.maths, rnd = rng(mix(seed, start)), out = [];
  // learning mode: due questions lead each block (at most half of it), spread through it, then unseen questions, then the rest
  let order = shuffle(rng(seed), [...pool]);
  if (dueKeys.length || seenKeys.size) {
    const dueSet = new Set(dueKeys);
    const dueFirst = order.filter(q => dueSet.has(q.id)).slice(0, Math.ceil(count / 2));
    const rest = [...order.filter(q => !dueSet.has(q.id) && !seenKeys.has(q.id)), ...order.filter(q => !dueSet.has(q.id) && seenKeys.has(q.id))];
    const block = rest.slice(0, Math.max(0, count - dueFirst.length));
    dueFirst.forEach((q, i) => block.splice(Math.min(block.length, Math.floor((i + 0.5) * (block.length + dueFirst.length) / dueFirst.length)), 0, q));
    order = [...block, ...rest.slice(Math.max(0, count - dueFirst.length))];
  }
  if (!order.length) return out;
  const z = shuffle(rnd, Array.from({ length: count }, (_, i) => quantile((i + 0.5) / count)));
  const m = z.map(v => Math.exp(L.spread * v)), mean = m.reduce((a, b) => a + b, 0) / count;
  for (let i = 0; i < count; i++) {
    const q = order[(start + i) % order.length];
    const right = q.o.map((label, k) => ({ label, right: q.a.includes(k) }));
    out.push({
      kind: "maths", cat: "maths", prompt: q.q, ask: `${q.area === (stages[q.lv] || q.lv) ? q.area : `${q.area}, ${stages[q.lv] || q.lv}`}, level ${q.d}`,
      options: right, need: q.s, notes: [{ label: right.filter(o => o.right).map(o => o.label).join(" and "), text: q.x }],
      ...(q.svg && { svg: q.svg }), ...(q.pic && { pic: q.pic }), ...(q.code && { code: q.code }), d: q.d, ...odds(q.a.map(() => knowsMaths(q.d)), q.o.length, m[i] / mean), key: q.id,
    });
  }
  priceBatch(L, out);
  return out;
}

/**
 * A run's questions: all of them for a fixed length (balanced as one batch), the first batch for an endless run.
 * For Maths, pass { pool, stages }: the filtered bank and a label per stage id.
 */
export function makeSession(seed, levelId, lengthId = "standard", maths = null) {
  const count = lengthId === "endless" ? BATCH : LENGTHS[lengthId]?.questions ?? LEVELS[levelId].questions;
  if (LEVELS[levelId].maths) return mathsQuestions(seed, maths.pool, maths.stages, count, 0, maths.dueKeys, maths.seenKeys);
  return makeQuestions(seed, levelId, count, 0, new Set());
}
/** The next batch of an endless run, following the questions dealt so far. */
export const moreQuestions = (seed, levelId, dealt, maths = null) => (LEVELS[levelId].maths
  ? mathsQuestions(seed, maths.pool, maths.stages, BATCH, dealt.length, maths.dueKeys, maths.seenKeys)
  : makeQuestions(seed, levelId, BATCH, dealt.length, new Set(dealt.map(q => q.key))));

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

// ---------- how well you judge what you know ----------
// A record is one settled question for one player: { o: odds paid, f: stake as a share of the pot (0 = pass),
// r: 1 if the pick was right, 0 if wrong, null if passed without a pick }.

/** Stake bands, by how much of the pot was staked: the size of a bet is how sure the player says they are. */
export const BANDS = [{ label: "up to 10%", lo: 0, hi: 0.1 }, { label: "10% to 30%", lo: 0.1, hi: 0.3 }, { label: "over 30%", lo: 0.3, hi: 1 }];

/** The Kelly stake for a chance p at odds o (the share of the pot that grows it fastest in the long run). */
export const kellyStake = (p, o) => Math.max(0, Math.min(1, (p * o - 1) / (o - 1)));

/**
 * Two views of how well a player judges their own knowledge.
 *
 * Expected outcome (what a fixed run cares about): the edge per bet at flat stakes (how much each chip staked
 * would earn if every bet were the same size) and the return on the chips actually staked; plus the hit rate
 * against the hit rate the prices needed.
 *
 * Kelly (what the long run cares about): bets grouped by stake size, since a bigger stake says "I'm surer".
 * For each group, how often those bets were right and what Kelly would stake at that hit rate and those odds;
 * then the ratio of what was staked to what Kelly would stake, and the growth a question that staking Kelly at
 * those hit rates would have given (with hindsight, so it flatters Kelly a little).
 */
export function knowledgeStats(records) {
  const bets = records.filter(x => x.f > 0), passes = records.filter(x => !(x.f > 0));
  const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const right = bets.filter(x => x.r === 1).length;
  const out = {
    questions: records.length, bets: bets.length, right,
    hitRate: bets.length ? right / bets.length : null,
    needed: mean(bets.map(x => 1 / x.o)),                                            // hit rate the prices needed
    edge: mean(bets.map(x => (x.r === 1 ? x.o - 1 : -1))),                            // per bet, flat stakes
    roi: bets.length ? bets.reduce((t, x) => t + x.f * (x.r === 1 ? x.o - 1 : -1), 0) / bets.reduce((t, x) => t + x.f, 0) : null,
    passes: passes.length,
    passPicks: passes.filter(x => x.r != null).length,
    passRight: passes.filter(x => x.r === 1).length,
  };
  out.bands = BANDS.map(b => {
    const xs = bets.filter(x => x.f > b.lo && x.f <= b.hi);
    if (!xs.length) return { ...b, n: 0 };
    const p = xs.filter(x => x.r === 1).length / xs.length, o = mean(xs.map(x => x.o));
    return { ...b, n: xs.length, hit: p, stake: mean(xs.map(x => x.f)), kelly: kellyStake(p, o) };
  });
  const used = out.bands.filter(b => b.n);
  const staked = used.reduce((t, b) => t + b.n * b.stake, 0), kelly = used.reduce((t, b) => t + b.n * b.kelly, 0);
  out.sizing = staked && kelly ? staked / kelly : null;                               // 1 = staking like Kelly
  const growth = list => (list.length ? Math.exp(mean(list)) - 1 : null);
  const kellyOf = x => used.find(b => x.f > b.lo && x.f <= b.hi)?.kelly ?? 0;
  out.growth = growth(records.map(x => (x.f > 0 ? Math.log(Math.max(1e-9, 1 + x.f * (x.r === 1 ? x.o - 1 : -1))) : 0)));
  out.kellyGrowth = growth(records.map(x => (x.f > 0 ? Math.log(Math.max(1e-9, 1 + kellyOf(x) * (x.r === 1 ? x.o - 1 : -1))) : 0)));
  return out;
}
