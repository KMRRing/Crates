// Speed maths and Fuel maths (README, Speed maths): the run, apart from any page so tests/speedmaths.mjs plays it in Node.
// One engine under two tiles: a pool says what is dealt (the mercantile pool's sums and shop-and-kitchen chains in
// speedmaths-pool.js, the fuels deck in speedfuels-data.js), a mode says how it is dealt and for how long. Everything is
// dealt from the run's seed and the index of the sum, so the same seed is the same sums on every device, a run saved
// halfway is picked up by remembering one number, and a match at a table gives everyone the same sums.
import { rng, hashParts, pick, drawFigs, chainProblem, judge } from "./speedmaths-core.js";
import { POOL as MERCANTILE } from "./speedmaths-pool.js";
import { POOL as FUELS } from "./speedfuels-data.js";

export const POOLS = { mercantile: MERCANTILE, fuels: FUELS };

// ---------- the modes ----------
// kind: what the sums are. Sprint: one exact operation, typed answer goes in by itself when it is right. Estimate: one or
// two steps, typed to a stated number of significant figures. Chains: a figure and three to six steps, in a trader's order.
// Today's: the same mix for everyone, from the day's seed.
export const MODES = {
  sprint: { label: "Sprint", secs: 60, kind: "sum" },
  estimate: { label: "Estimate", secs: 90, kind: "est" },
  chains: { label: "Chains", secs: 180, kind: "chain" },
  daily: { label: "Today's", secs: 150, kind: "mixed" },
};
/** Today's run, a cycle of six: four plain sums, an estimate, a chain; each cycle a little harder. */
export const DAILY_CYCLE = ["sum", "sum", "est", "sum", "sum", "chain"];
/** A run is a clock and a score: a streak of five right adds a point to each answer, ten adds two. */
export const STREAK_STEP = 5, STREAK_MAX = 2;
const LOG_KEEP = 150;

/** The day's seed for a pool: the same for everyone, new at midnight UTC (day is days.js's today()). */
export const dailySeed = (pool, day) => hashParts("speed", pool, day);

// ---------- starting a run ----------
/** The options a pool accepts, with anything missing or unknown set right: { kinds: [sum kinds ticked], range }. */
export function normOpts(pool, opts = {}) {
  const P = POOLS[pool], ids = P.kinds.map(([id]) => id);
  const kinds = ids.filter(id => (opts.kinds ?? ids).includes(id));
  const range = P.ranges ? (P.ranges.some(([r]) => r === opts.range) ? opts.range : P.range) : null;
  return { kinds: kinds.length ? kinds : ids, range };
}
/**
 * A new run: { v, pool, mode, seed, opts, secs, day, i (the sum on screen), typed, used (ms of clock gone), since (used when
 * this sum came), score, streak, top (longest streak), right, missed, log ([i, typed, code, ms]: code e exact, c close,
 * w wrong, s skipped), over }. The daily's options are fixed: nothing of yours is in it.
 */
export function startRun({ pool = "mercantile", mode = "sprint", seed, opts, day = null, secs } = {}) {
  if (!POOLS[pool] || !MODES[mode]) throw new Error(`no such run: ${pool} ${mode}`);
  return {
    v: 2, pool, mode, seed: seed >>> 0, opts: normOpts(pool, mode === "daily" ? {} : opts), secs: secs ?? MODES[mode].secs, day: mode === "daily" ? day : null,
    i: 0, typed: "", used: 0, since: 0, score: 0, streak: 0, top: 0, right: 0, missed: 0, log: [], over: false,
  };
}
/** The day's run for a pool. */
export const dailyRun = (pool, day) => startRun({ pool, mode: "daily", seed: dailySeed(pool, day), day });
/** A match at a table (duel.js): everyone gets this one. */
export const matchRun = m => startRun({ pool: m.pool, mode: "sprint", seed: m.seed, opts: m.opts, secs: m.secs });
/** Whether a run read back from storage is one (a saved run from an older version, or damage, is dropped). */
export function validRun(run) {
  return !!run && run.v === 2 && !!POOLS[run.pool] && !!MODES[run.mode] && Number.isInteger(run.seed) && Number.isInteger(run.i) && run.i >= 0
    && Array.isArray(run.log) && !!run.opts && Array.isArray(run.opts.kinds) && run.opts.kinds.length > 0 && run.secs > 0
    && POOLS[run.pool].kinds.some(([id]) => id === run.opts.kinds[0]);
}

// ---------- dealing the i-th sum ----------
/** What sort of sum the i-th is: "sum", "est" or "chain". */
export function kindAt(run, i) {
  const k = MODES[run.mode].kind;
  return k === "mixed" ? DAILY_CYCLE[i % DAILY_CYCLE.length] : k;
}
/** How far into the run, from 0.3 to 1: the sums reach for bigger numbers as it goes (Today's starts a little higher). */
export const rampAt = (run, i) => Math.min(1, (run.mode === "daily" ? 0.4 : 0.3) + 0.05 * i);
/** The most steps the i-th estimate or chain may have, and the fewest. */
export function stepsAt(run, i, kind) {
  const cycle = run.mode === "daily" ? Math.floor(i / DAILY_CYCLE.length) : 0;
  if (kind === "est") return run.mode === "daily" ? [1, cycle >= 1 ? 2 : 1] : [1, i < 4 ? 1 : 2];
  return run.mode === "daily" ? [3, Math.min(5, 3 + cycle)] : [3, Math.min(6, 3 + Math.floor(i / 2))];
}

const defMemo = new Map();
/** The definition for the i-th estimate or chain: from those within the step limits, leaning to the longest the ramp
 *  allows, and never the same as the one before it of its kind. */
function defAt(run, i, kind) {
  const key = `${run.pool}/${run.mode}/${run.seed}/${i}`;
  if (defMemo.has(key)) return defMemo.get(key);
  const [lo, hi] = stepsAt(run, i, kind), P = POOLS[run.pool];
  const cands = P.defs.filter(d => d.n >= lo && d.n <= hi), r = rng(hashParts(run.seed, run.mode, i, "def"));
  const high = cands.filter(d => d.n >= hi - 1), from = high.length >= 3 && r() < 0.5 ? high : cands;
  let d = from[Math.floor(r() * from.length)];
  let j = i - 1;
  while (j >= 0 && kindAt(run, j) !== kind) j--;
  if (j >= 0 && cands.length > 1 && defAt(run, j, kind).id === d.id) {
    const others = cands.filter(x => x.id !== d.id);
    d = others[Math.floor(r() * others.length)];
  }
  if (defMemo.size > 4000) defMemo.clear();
  defMemo.set(key, d);
  return d;
}

const memo = new Map();
/**
 * The i-th sum of a run (the one on screen by default): { kind ("sum" or "chain"), id, topic, answer, unit, sf (0 exact, 1
 * or 2 significant figures), rel, worth, key } and, for a sum, its prompt; for an estimate or chain, its name, start, steps
 * (each with the figure it leaves) and n. A pure function of the run's pool, mode, seed, options and i.
 */
export function problemAt(run, i = run.i) {
  const key = `${run.pool}/${run.mode}/${run.seed}/${run.opts.kinds.join("")}/${run.opts.range}/${i}`;
  let p = memo.get(key);
  if (p) return p;
  const P = POOLS[run.pool], kind = kindAt(run, i), r = rng(hashParts(run.seed, run.mode, i, "p"));
  if (kind === "sum") {
    const k = pick(r, run.opts.kinds), s = P.sum(k, r, rampAt(run, i), run.opts.range);
    p = { kind: "sum", id: k, topic: k, prompt: s.prompt, words: !!s.words, scenario: s.scenario ?? k, answer: s.answer, unit: s.unit ?? "", sf: 0, worth: 1, key };
  } else {
    const def = defAt(run, i, kind);
    for (let tries = 0; tries < 24 && !p; tries++) {
      const figs = drawFigs(def.figs, r), c = chainProblem(def, figs);
      if (c) p = { ...c, figs, key };
    }
    if (!p) throw new Error(`no figures a person can type for ${def.id}`);
  }
  if (memo.size > 4000) memo.clear();
  memo.set(key, p);
  return p;
}

// ---------- answering ----------
/** The points the next right answer earns: its worth and a point for each five in a row, up to two. */
export const bonusNow = run => Math.min(STREAK_MAX, Math.floor(run.streak / STREAK_STEP));
/** Whether what is typed is already the answer to an exact sum: it goes in by itself, as in Zetamac. An estimate waits for Enter. */
export function autoMatches(run, text) {
  const p = problemAt(run);
  return !p.sf && judge(p, text).ok;
}
/**
 * Answers the sum on screen with what has been typed (nothing is a skip), scores it, and brings the next. used is the
 * clock's ms now. Returns { grade, ok, points, problem, text, ms }.
 */
export function submit(run, text, used = run.used) {
  const p = problemAt(run), v = judge(p, text);
  const code = v.grade === "none" ? "s" : v.grade === "exact" ? "e" : v.grade === "close" ? "c" : "w";
  const ms = Math.max(0, Math.round(used - run.since));
  let points = 0;
  if (v.ok) {
    points = p.worth + bonusNow(run);
    run.score += points;
    run.streak++;
    run.right++;
    run.top = Math.max(run.top, run.streak);
  } else { run.streak = 0; run.missed++; }
  run.log.push([run.i, String(text ?? ""), code, ms]);
  if (run.log.length > LOG_KEEP) run.log.shift();
  run.i++;
  run.typed = "";
  run.since = used;
  return { grade: v.grade, ok: v.ok, off: v.off, x: v.x, points, problem: p, text: String(text ?? ""), ms };
}
/** The run is over: the clock ran out. */
export function finish(run) {
  run.over = true;
  run.typed = "";
  return summary(run);
}
/** How a run went: score, right, missed, longest streak, and the average ms an answered sum took. */
export function summary(run) {
  const answered = run.right + run.missed, spent = run.log.reduce((n, e) => n + e[3], 0);
  return { score: run.score, right: run.right, missed: run.missed, top: run.top, answered, avgMs: run.log.length ? Math.round(spent / run.log.length) : 0 };
}
/** The last answer of a run, as the screen tells it: { grade, problem, text } or null. */
export function lastAnswer(run) {
  const e = run.log.at(-1);
  if (!e) return null;
  const problem = problemAt(run, e[0]), v = judge(problem, e[1]);
  return { grade: v.grade, ok: v.ok, off: v.off, x: v.x, problem, text: e[1], ms: e[3] };
}
/** The sums answered wrongly or skipped, newest first, as { problem, text, grade }, for the review. */
export function missesOf(run, limit = 12) {
  const out = [];
  for (let k = run.log.length - 1; k >= 0 && out.length < limit; k--) {
    const [i, text, code] = run.log[k];
    if (code === "w" || code === "s") out.push({ problem: problemAt(run, i), text, grade: code === "s" ? "none" : "wrong" });
  }
  return out;
}
/** A score is a new best of what was kept (a number, or nothing yet). */
export const isBest = (kept, score) => score > 0 && (typeof kept !== "number" || score > kept);

