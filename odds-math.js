// The arithmetic behind the Odds course (odds-course.js): pure functions, no page. Everything the course says as a number
// is worked out here (exactly, as a fraction, wherever the answer is one), and tests/odds.mjs checks each against a count
// of every case or a brute-force search, so a lesson can't state a figure the maths doesn't give.

// ---------- exact fractions (BigInt, always in lowest terms) ----------
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
/** n/d as a fraction in lowest terms. */
export function frac(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Error("division by zero");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
export const div = (a, b) => frac(a.n * b.d, a.d * b.n);
export const eq = (a, b) => a.n === b.n && a.d === b.d;
export const num = a => Number(a.n) / Number(a.d);
/** "1/6", "0", "3". */
export const fracText = a => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);
/** n choose k, exactly. */
export function choose(n, k) {
  if (k < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

// ---------- counting: two dice ----------
/** The 36 equally likely throws of two dice, [first, second], in reading order (index = 6 × (first − 1) + second − 1). */
export const THROWS = Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1]);
/** Events on two dice, named: a throw is [a, b]. */
export const EVENTS = {
  sum7: ([a, b]) => a + b === 7,
  sum4: ([a, b]) => a + b === 4,
  sum8: ([a, b]) => a + b === 8,
  sum10up: ([a, b]) => a + b >= 10,
  doubles: ([a, b]) => a === b,
  any6: ([a, b]) => a === 6 || b === 6,
  both6: ([a, b]) => a === 6 && b === 6,
  first6: ([a]) => a === 6,
  even: ([a, b]) => (a + b) % 2 === 0,
  sum12: ([a, b]) => a + b === 12,
  sumAtLeast9: ([a, b]) => a + b >= 9,
  fiveUp: ([a, b]) => a >= 5 && b >= 5,
};
/** The indices of the throws in an event, restricted to those in `given` (an event name) when it is set. */
export function throwSet(event, given = null) {
  const f = EVENTS[event], g = given ? EVENTS[given] : () => true;
  return THROWS.map((t, i) => (g(t) && f(t) ? i : -1)).filter(i => i >= 0);
}
/** P(event | given) as a fraction: how many of the given throws are in the event. */
export function probOf(event, given = null) {
  const space = THROWS.filter(t => (given ? EVENTS[given](t) : true));
  return frac(space.filter(EVENTS[event]).length, space.length);
}
/** Ways to throw a total with two dice. */
export const waysTo = total => THROWS.filter(([a, b]) => a + b === total).length;
/** A total comes up before a 7 (the throws repeated until one of the two): ways / (ways + 6). */
export const beforeSeven = total => frac(waysTo(total), waysTo(total) + waysTo(7));

// ---------- cards: drawing without putting back ----------
/** Exactly k successes in n cards drawn from N holding K good ones (the hypergeometric): C(K,k)C(N−K,n−k)/C(N,n). */
export function hyper(N, K, n, k) { return frac(choose(K, k) * choose(N - K, n - k), choose(N, n)); }
/** At least one good card in n drawn. */
export const atLeastOne = (N, K, n) => sub(frac(1), hyper(N, K, n, 0));
/** All of the first n cards drawn good, putting each back (or not). */
export function allGood(N, K, n, back) {
  let p = frac(1);
  for (let i = 0; i < n; i++) p = mul(p, back ? frac(K, N) : frac(K - i, N - i));
  return p;
}

// ---------- value and spread ----------
/** A bet's outcomes [[probability (fraction), payoff (fraction or integer)]…]: the expected value, exactly. */
const asF = x => (typeof x === "object" ? x : frac(x));
export function expected(outs) { return outs.reduce((s, [p, x]) => add(s, mul(asF(p), asF(x))), frac(0)); }
/** The variance, exactly: E[X²] − E[X]². */
export function variance(outs) {
  const m = expected(outs), m2 = expected(outs.map(([p, x]) => [p, mul(asF(x), asF(x))]));
  return sub(m2, mul(m, m));
}
export const sd = outs => Math.sqrt(num(variance(outs)));
/** The mean of n independent plays varies by sd / √n (the standard error). */
export const standardError = (sdOne, n) => sdOne / Math.sqrt(n);
/** A fair die. */
export const DIE = [1, 2, 3, 4, 5, 6].map(x => [frac(1, 6), x]);
/** A bet that pays `win` on one face of a die and loses `lose` on the other five: its outcomes. */
export const oneFace = (win, lose) => [[frac(1, 6), win], [frac(5, 6), -lose]];

// ---------- evidence ----------
/** Natural frequencies for a test: of `pop` cases, `prior` is the share that have it, `sens` the share of those the test
 *  flags, `fpr` the share of the rest it flags anyway. Everything as exact counts when the numbers divide; fractions. */
export function frequencies(pop, prior, sens, fpr) {
  const have = mul(frac(pop), asF(prior)), clear = sub(frac(pop), have);
  const haveFlag = mul(have, asF(sens)), clearFlag = mul(clear, asF(fpr));
  return { have, clear, haveFlag, clearFlag, flagged: add(haveFlag, clearFlag), posterior: div(haveFlag, add(haveFlag, clearFlag)) };
}
/** P(have it | flagged) by Bayes' theorem: P(F|H)P(H) / (P(F|H)P(H) + P(F|not H)P(not H)). */
export function posterior(prior, sens, fpr) {
  const pr = asF(prior), a = mul(asF(sens), pr), b = mul(asF(fpr), sub(frac(1), pr));
  return div(a, add(a, b));
}
/** Odds form: prior odds × likelihood ratio = posterior odds. Odds as a fraction (for : against). */
export const toOdds = p => div(p, sub(frac(1), p));
export const fromOdds = o => div(o, add(frac(1), o));
export const likelihoodRatio = (sens, fpr) => div(asF(sens), asF(fpr));
/** Updates a probability on a flag (true: the test flagged; false: it cleared) with sensitivity and false alarm rate. */
export function update(p, flagged, sens, fpr) {
  const s = asF(sens), f = asF(fpr);
  const lr = flagged ? div(s, f) : div(sub(frac(1), s), sub(frac(1), f));
  return fromOdds(mul(toOdds(p), lr));
}

// ---------- odds and prices ----------
/** Odds against an event of probability p, "a to 1" as a number: (1 − p) / p. */
export const oddsAgainst = p => num(div(sub(frac(1), p), p));
/** Decimal odds (the total returned per 1 staked) at a fair price: 1 / p. */
export const decimalOdds = p => num(div(frac(1), p));
/** The probability an "a to b against" price implies: b / (a + b). */
export const impliedBy = (a, b) => frac(b, a + b);
/** A book's prices as probabilities: their sum above 1 is the margin (the overround); the fair ones are scaled to sum to 1. */
export function overround(ps) { const total = ps.reduce((s, p) => add(s, p), frac(0)); return { total, margin: sub(total, frac(1)), fair: ps.map(p => div(p, total)) }; }
/** A bet paying `pays`-to-1 (stake kept on a win) on an event of probability p: expected profit per 1 staked. */
export const edgeOf = (p, pays) => sub(mul(asF(p), frac(pays + 1)), frac(1));
/** The fair price of a contract paying 1 if the event happens is p; the buyer's expected profit at a price. */
export const buyerEV = (p, price) => sub(asF(p), asF(price));
/** A pool (pari-mutuel): money staked on each runner; the house keeps `take`; a winner is paid its share of the rest.
 *  Returns, per runner, the payout per 1 staked if it wins, as a fraction. */
export function poolPays(stakes, take) {
  const total = stakes.reduce((s, x) => s + x, 0), kept = mul(frac(total), sub(frac(1), asF(take)));
  return stakes.map(x => div(kept, frac(x)));
}
/** Your expected profit per 1 staked on a runner of a pool, if you think it wins with probability p. */
export const poolEV = (p, pays) => sub(mul(asF(p), pays), frac(1));

// ---------- sizing ----------
/** Kelly's fraction for a bet that wins b-to-1 with probability p: (bp − q) / b, never below nothing. */
export const kelly = (p, b) => Math.max(0, (b * p - (1 - p)) / b);
/** The long-run growth of the log of wealth per bet when staking the fraction f of it: p ln(1 + bf) + q ln(1 − f). */
export const growth = (f, p, b) => (f >= 1 ? -Infinity : p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f));
/** The stake past which growth turns negative: above Kelly's, where the curve comes back down through zero. 1 if there is no edge. */
export function ruinPoint(p, b) {
  const k = kelly(p, b);
  if (k <= 0) return 0;
  let lo = k, hi = 1 - 1e-12;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (growth(m, p, b) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** A seeded random stream (mulberry32): the simulators run on it so a run can be repeated and tested. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** `paths` runs of `bets` bets at stake fraction f, wealth starting at 1: the summary a lesson shows and the paths themselves. */
export function wealthPaths(rand, { p, b, f, bets, paths, keep = 0 }) {
  const finals = [], drawn = [];
  let broke = 0, halved = 0;
  for (let k = 0; k < paths; k++) {
    let w = 1, low = 1, path = keep > k ? [1] : null;
    for (let i = 0; i < bets; i++) {
      w *= rand() < p ? 1 + b * f : 1 - f;
      if (w < low) low = w;
      if (path) path.push(w);
    }
    finals.push(w);
    if (low <= 0.5) halved++;
    if (w < 1) broke++;
    if (path) drawn.push(path);
  }
  finals.sort((x, y) => x - y);
  return { median: finals[Math.floor(finals.length / 2)], below: broke / paths, halved: halved / paths, drawn };
}

// ---------- sims for the lessons ----------
/** A running mean of plays, a fair die's throws unless `play` says otherwise: the means after each of n plays. */
export function runningMean(rand, n, from = { sum: 0, k: 0 }, play = r => 1 + Math.floor(r() * 6)) {
  const out = [];
  let sum = from.sum, k = from.k;
  for (let i = 0; i < n; i++) { sum += play(rand); k++; out.push([k, sum / k]); }
  return { out, sum, k };
}
/** Flips n fair coins and tells what followed every run of `run` heads: [followed by heads, followed by tails]. */
export function afterRun(rand, n, run) {
  let streak = 0, heads = 0, tails = 0;
  for (let i = 0; i < n; i++) {
    const h = rand() < 0.5;
    if (streak >= run) { if (h) heads++; else tails++; }
    streak = h ? streak + 1 : 0;
  }
  return [heads, tails];
}
/** n throws of two dice: how often each total came up (index 2..12). */
export function throwTotals(rand, n) {
  const c = Array(13).fill(0);
  for (let i = 0; i < n; i++) c[2 + Math.floor(rand() * 6) + Math.floor(rand() * 6)]++;
  return c;
}
/** Draws `n` cards from a deck of N with K good, `times` times, counting how often all were good (back: each put back).
 *  The deck is only counted, never built: a draw is good with chance K/N, and takes a good card out when not put back. */
export function drawTrials(rand, { N, K, n, back, times }) {
  let all = 0;
  for (let t = 0; t < times; t++) {
    let left = N, good = K, ok = true;
    for (let i = 0; i < n && ok; i++) {
      const hit = Math.floor(rand() * left) < good;
      if (!hit) ok = false;
      else if (!back) { left--; good--; }
    }
    if (ok) all++;
  }
  return all;
}
/** How often at least one good card turns up in n drawn (not put back) from N with K good (the outs), over `times` tries. */
export function outsTrials(rand, { N, K, n, times }) {
  let hit = 0;
  for (let t = 0; t < times; t++) {
    let left = N, good = K;
    for (let i = 0; i < n; i++) {
      if (Math.floor(rand() * left) < good) { hit++; break; }
      left--;
    }
  }
  return hit;
}

// ---------- scoring a forecaster ----------
/** The Brier score of a probability q given to an event that happened (1) or not (0): (q − outcome)², lower is better. */
export const brierOne = (q, happened) => (q - (happened ? 1 : 0)) ** 2;
/** The Brier score you expect giving q on an event whose true chance is p: p(1 − q)² + (1 − p)q². Least at q = p. */
export const expectedBrier = (q, p) => p * (1 - q) ** 2 + (1 - p) * q * q;
/** The log score expected, giving q on an event of true chance p: p ln q + (1 − p) ln(1 − q). Greatest at q = p. */
export const expectedLog = (q, p) => (q <= 0 || q >= 1 ? -Infinity : p * Math.log(q) + (1 - p) * Math.log(1 - q));

// ---------- calibration: a record of "I'm c% sure" and whether it was so ----------
/** The confidences offered. */
export const CONF = [50, 60, 70, 80, 90, 99];
export const emptyCalib = () => ({ n: 0, bins: {}, brier: 0, seen: [] });
/** One answer added: the confidence c (one of CONF) in the answer you gave, and whether it was right. Returns the new record. */
export function addCalib(rec, id, c, right, keepSeen = 40) {
  const bins = { ...rec.bins }, [h, n] = bins[c] || [0, 0];
  bins[c] = [h + (right ? 1 : 0), n + 1];
  return { n: rec.n + 1, bins, brier: Math.round((rec.brier + brierOne(c / 100, right)) * 1e6) / 1e6, seen: [...rec.seen.filter(x => x !== id), id].slice(-keepSeen) };
}
/** The reliability points: for each confidence used, how often those answers were right: [{ c, n, rate }]. */
export const reliability = rec => CONF.filter(c => rec.bins[c]).map(c => ({ c, n: rec.bins[c][1], rate: rec.bins[c][0] / rec.bins[c][1] }));
/** The mean Brier score of a record (null with no answers); 0.25 is what saying 50% to everything scores. */
export const meanBrier = rec => (rec.n ? rec.brier / rec.n : null);
/** Over- or under-confidence: the average stated confidence minus the share right (positive: too sure of yourself). */
export function overconfidence(rec) {
  if (!rec.n) return null;
  let stated = 0, right = 0;
  for (const c of CONF) if (rec.bins[c]) { stated += (c / 100) * rec.bins[c][1]; right += rec.bins[c][0]; }
  return (stated - right) / rec.n;
}
/** A 90% interval question settled: a hit if the truth lies inside [lo, hi]. */
export const inside = (lo, hi, truth) => lo <= truth && truth <= hi;

// ---------- reference classes ----------
/** The value below which `q` (0 to 1) of the list falls, by linear interpolation between sorted values. */
export function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b), at = (s.length - 1) * q, lo = Math.floor(at), hi = Math.ceil(at);
  return s[lo] + (s[hi] - s[lo]) * (at - lo);
}
export const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
