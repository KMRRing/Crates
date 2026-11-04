// The Odds course's arithmetic (odds-math.js), each figure checked against a count of every case or a brute-force search
// that does not use the formula under test.
import * as M from "../odds-math.js";
import { STATEMENTS, QUANTITIES, PAST_JOBS, GUESSES } from "../odds-data.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const F = M.frac, T = M.fracText;

// ---------- fractions ----------
check(T(F(6, 36)) === "1/6" && T(F(-4, -8)) === "1/2" && T(M.add(F(1, 3), F(1, 6))) === "1/2" && T(M.mul(F(2, 3), F(3, 4))) === "1/2" && T(M.div(F(1, 2), F(1, 4))) === "2", "fractions stay in lowest terms");
check(M.choose(52, 2) === 1326n && M.choose(47, 2) === 1081n && M.choose(5, 0) === 1n && M.choose(3, 5) === 0n, "n choose k");

// ---------- two dice, counted ----------
check(M.THROWS.length === 36 && new Set(M.THROWS.map(t => t.join())).size === 36, "36 distinct throws");
const count = (f, g = () => true) => { let n = 0, m = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (g(a, b)) { m++; if (f(a, b)) n++; } return [n, m]; };
for (const [name, f] of [["sum7", (a, b) => a + b === 7], ["sum4", (a, b) => a + b === 4], ["sum10up", (a, b) => a + b >= 10], ["doubles", (a, b) => a === b], ["any6", (a, b) => a === 6 || b === 6], ["both6", (a, b) => a === 6 && b === 6]]) {
  const [n] = count(f);
  check(M.throwSet(name).length === n && T(M.probOf(name)) === T(F(n, 36)), `${name}: ${n} of 36`);
}
check(T(M.probOf("both6", "any6")) === "1/11" && M.throwSet("any6").length === 11, "both sixes given at least one: 1/11");
check(T(M.probOf("both6", "first6")) === "1/6", "both sixes given the first is a six: 1/6");
check(T(M.beforeSeven(4)) === "1/3" && T(M.beforeSeven(8)) === "5/11", "a 4 before a 7: 3/(3+6); an 8: 5/11");
// the race, simulated: throw until a 4 or a 7
{
  const r = M.rng(11); let four = 0, trials = 40000;
  for (let i = 0; i < trials; i++) for (;;) { const s = 2 + Math.floor(r() * 6) + Math.floor(r() * 6); if (s === 4) { four++; break; } if (s === 7) break; }
  check(near(four / trials, 1 / 3, 0.01), `a 4 before a 7 in ${trials} races: ${(four / trials).toFixed(3)}`);
}

// ---------- cards ----------
check(T(M.allGood(52, 4, 2, true)) === "1/169" && T(M.allGood(52, 4, 2, false)) === "1/221", "two aces: 1/169 with the first put back, 1/221 without");
{ // every ordered pair of distinct cards
  let pairs = 0, aces = 0;
  for (let i = 0; i < 52; i++) for (let j = 0; j < 52; j++) if (i !== j) { pairs++; if (i < 4 && j < 4) aces++; }
  check(T(F(aces, pairs)) === "1/221", "1/221 by listing all 2,652 ordered pairs");
}
{ // nine outs, two cards from 47: list every pair
  let pairs = 0, hit = 0;
  for (let i = 0; i < 47; i++) for (let j = i + 1; j < 47; j++) { pairs++; if (i < 9 || j < 9) hit++; }
  check(T(M.atLeastOne(47, 9, 2)) === T(F(hit, pairs)) && T(F(hit, pairs)) === "378/1081" && near(M.num(M.atLeastOne(47, 9, 2)), 0.3497, 5e-5), `nine outs, two cards: ${hit}/${pairs} = 34.97%`);
  check(near(M.num(F(9, 47)), 0.1915, 5e-5), "nine outs, one card: 19.1%");
}
{ // the sims agree
  const r = M.rng(5), a = M.drawTrials(r, { N: 52, K: 4, n: 2, back: true, times: 300000 }) / 300000, b = M.drawTrials(r, { N: 52, K: 4, n: 2, back: false, times: 300000 }) / 300000;
  check(near(a, 1 / 169, 0.0008) && near(b, 1 / 221, 0.0008) && a > b, `sim of two aces: ${a.toFixed(5)} with, ${b.toFixed(5)} without`);
  const o = M.outsTrials(M.rng(6), { N: 47, K: 9, n: 2, times: 100000 }) / 100000;
  check(near(o, 378 / 1081, 0.006), `sim of nine outs: ${o.toFixed(4)}`);
}

// ---------- value and spread ----------
check(T(M.expected(M.DIE)) === "7/2" && T(M.variance(M.DIE)) === "35/12" && near(M.sd(M.DIE), 1.7078, 1e-4), "a die: mean 7/2, variance 35/12, sd 1.708");
check(T(M.expected(M.oneFace(6, 1))) === "1/6", "six on one face, lose 1 otherwise: +1/6");
{
  const coin = [[F(1, 2), 1], [F(1, 2), -1]], long = [[F(1, 100), 99], [F(99, 100), -1]];
  check(T(M.expected(coin)) === "0" && T(M.expected(long)) === "0" && near(M.sd(coin), 1) && near(M.sd(long), Math.sqrt(99)), "a coin and a 1% long shot: both worth 0, sd 1 and 9.95");
  // variance by listing the 6 faces another way
  const faces = [1, 2, 3, 4, 5, 6], m = faces.reduce((a, b) => a + b) / 6, v = faces.reduce((a, b) => a + (b - m) ** 2, 0) / 6;
  check(near(v, 35 / 12), "variance as the mean squared distance");
}
check(near(M.standardError(M.sd(M.DIE), 100), 0.17078, 1e-4), "100 throws: the average of a die is within 0.171 of 3.5 (one standard error)");
{ // the mean of n throws really varies by sd/sqrt(n)
  const r = M.rng(3), n = 100, means = [];
  for (let k = 0; k < 4000; k++) means.push(M.runningMean(r, n).sum / n);
  const m = means.reduce((a, b) => a + b) / means.length, s = Math.sqrt(means.reduce((a, b) => a + (b - m) ** 2, 0) / means.length);
  check(near(m, 3.5, 0.02) && near(s, 0.1708, 0.01), `spread of 100-throw averages: mean ${m.toFixed(3)}, sd ${s.toFixed(4)}`);
}
{ const [h, t] = M.afterRun(M.rng(9), 400000, 5); check(near(h / (h + t), 0.5, 0.02) && h + t > 10000, `after five heads: ${h} heads, ${t} tails`); }
{ const c = M.throwTotals(M.rng(2), 36000); check(near(c[7] / 36000, 1 / 6, 0.01) && near(c[2] / 36000, 1 / 36, 0.005) && c.reduce((a, b) => a + b) === 36000, "totals of two dice in a sim"); }

// ---------- evidence ----------
{
  const f = M.frequencies(10000, F(1, 100), F(9, 10), F(9, 100));
  check([f.have, f.clear, f.haveFlag, f.clearFlag, f.flagged].map(T).join() === "100,9900,90,891,981" && T(f.posterior) === "10/109" && near(M.num(f.posterior), 0.09174, 1e-5), "cargo test: 100, 9,900, 90, 891, 981 flagged; 10/109 = 9.2%");
  check(T(M.posterior(F(1, 100), F(9, 10), F(9, 100))) === "10/109", "Bayes' formula gives the same");
  // by building a population of 10,000 and counting
  let flagged = 0, bad = 0;
  for (let i = 0; i < 10000; i++) {
    const off = i < 100, flag = off ? i < 90 : (i - 100) % 100 < 9;
    if (flag) { flagged++; if (off) bad++; }
  }
  check(flagged === 981 && bad === 90, "counting 10,000 cargoes one by one: 981 flagged, 90 off-spec");
  // the half-and-half prior: 1/11
  check(T(M.posterior(F(1, 11), F(9, 10), F(9, 100))) === "1/2", "at a base rate of 1/11 a flag is a coin flip");
  check(T(M.likelihoodRatio(F(9, 10), F(9, 100))) === "10", "likelihood ratio 10");
}
{
  const p = M.posterior(F(1, 20), F(4, 5), F(1, 10));
  check(T(p) === "8/27" && near(M.num(p), 0.2963, 1e-4), "late shipment: 8/27 = 29.6%");
  check(T(M.toOdds(F(1, 20))) === "1/19" && T(M.fromOdds(F(8, 19))) === "8/27", "odds 1:19 times 8 is 8:19, which is 8/27");
  const twice = M.update(M.update(F(1, 20), true, F(4, 5), F(1, 10)), true, F(4, 5), F(1, 10));
  check(T(twice) === "64/83" && near(M.num(twice), 0.7711, 1e-4), "two alerts: 64/83 = 77.1%");
  check(T(M.update(F(1, 20), false, F(4, 5), F(1, 10))) === "2/173", "one clear: odds × 2/9");
  check(T(M.posterior(F(1, 50), F(19, 20), F(1, 20))) === "19/68" && near(M.num(M.posterior(F(1, 50), F(19, 20), F(1, 20))), 0.2794, 1e-4), "a 95% signal on a 2% event: 28%");
}

// ---------- odds and prices ----------
check(near(M.oddsAgainst(F(1, 6)), 5) && near(M.oddsAgainst(F(1, 4)), 3) && near(M.oddsAgainst(F(1, 2)), 1) && near(M.decimalOdds(F(1, 6)), 6) && near(M.decimalOdds(F(1, 3)), 3), "odds against and decimal odds");
check(T(M.impliedBy(3, 1)) === "1/4" && T(M.impliedBy(2, 1)) === "1/3" && T(M.impliedBy(5, 2)) === "2/7", "a to b against implies b/(a+b)");
{
  const o = M.overround([F(45, 100), F(35, 100), F(25, 100)]);
  check(T(o.total) === "21/20" && T(o.margin) === "1/20" && T(o.fair[0]) === "3/7" && o.fair.reduce((s, x) => M.add(s, x), F(0)).n === 1n, "105% book: margin 5%, first fair chance 45/105 = 3/7");
}
check(T(F(200, 1200)) === "1/6", "paying 200 to win a prize of 1,000: break-even 200/1,200 = 1/6"); // C/(P+C), kept as a worked line in the course
check(T(M.beforeSeven(4)) === "1/3", "a fair payout for the 4-before-7 race is 2 to 1 against");
check(T(M.buyerEV(F(5, 36), F(4, 25))) === "-19/900" && near(M.num(M.buyerEV(F(5, 36), F(16, 100))), -0.02111, 1e-5), "buying a contract on a total of 8 at 16p: −2.1p");
check(T(M.edgeOf(F(1, 6), 4)) === "-1/6" && T(M.edgeOf(F(1, 6), 5)) === "0" && T(M.edgeOf(F(1, 36), 30)) === "-5/36" && T(M.edgeOf(F(1, 6), 4)) === T(M.expected([[F(1, 6), 4], [F(5, 6), -1]])), "house edge: 4-to-1 on a die face −1/6; 30-to-1 on a double 12: −5/36");
{
  const pays = M.poolPays([500, 300, 200], F(1, 10));
  check(pays.map(T).join() === "9/5,3,9/2" && T(M.poolEV(F(3, 10), pays[2])) === "7/20", "pool: 900 to share; pays 1.8, 3.0, 4.5 per 1; with p = 30% on the 20% runner EV +0.35");
  check(T(M.div(F(20, 100), F(9, 10))) === "2/9", "break-even chance on the 20% runner: 0.2/0.9 = 2/9");
}

// ---------- Kelly ----------
{
  check(near(M.kelly(0.6, 1), 0.2) && near(M.kelly(0.55, 1), 0.1) && near(M.kelly(0.4, 2), 0.1) && M.kelly(0.45, 1) === 0 && near(M.kelly(0.75, 1), 0.5), "Kelly: 0.2, 0.1, 0.1 (2-to-1 at 40%), 0, 0.5");
  // the growth curve's top, found by search without the formula
  for (const [p, b] of [[0.6, 1], [0.55, 1], [0.4, 2], [0.75, 1], [0.3, 4]]) {
    let best = 0, at = 0;
    for (let i = 0; i < 100000; i++) { const f = i / 100000, g = M.growth(f, p, b); if (g > best) { best = g; at = f; } }
    check(near(at, M.kelly(p, b), 2e-5), `p=${p}, ${b}-to-1: search finds the top at ${at.toFixed(4)}`);
  }
  const g1 = M.growth(0.1, 0.6, 1), g2 = M.growth(0.2, 0.6, 1);
  check(near(g2, 0.020136, 1e-6) && near(g1 / g2, 0.7471, 1e-4), `half Kelly keeps ${(100 * g1 / g2).toFixed(1)}% of the growth`);
  const z = M.ruinPoint(0.6, 1);
  check(near(M.growth(z, 0.6, 1), 0, 1e-9) && z > 0.38 && z < 0.4 && M.growth(0.4, 0.6, 1) < 0 && M.growth(0.38, 0.6, 1) > 0, `growth is zero at ${z.toFixed(4)}, negative at twice Kelly`);
  check(near(M.growth(0.2, 0.55, 1), -0.000130, 1e-5) && M.growth(0.2, 0.55, 1) < 0, "full Kelly on a 60% guess when the truth is 55%: growth about 0");
  check(M.ruinPoint(0.4, 1) === 0 && M.kelly(0.5, 1) === 0, "no edge, no Kelly");
  // simulated: the median final wealth follows exp(n g)
  const r = M.rng(21), s = M.wealthPaths(r, { p: 0.6, b: 1, f: 0.2, bets: 100, paths: 4000, keep: 5 });
  check(s.drawn.length === 5 && s.drawn[0].length === 101 && near(Math.log(s.median), 100 * M.growth(0.2, 0.6, 1), 0.35), `median after 100 bets at Kelly ${s.median.toFixed(2)} ≈ e^(100g) = ${Math.exp(100 * M.growth(0.2, 0.6, 1)).toFixed(2)}`);
  const half = M.wealthPaths(M.rng(22), { p: 0.6, b: 1, f: 0.1, bets: 100, paths: 4000 }), dbl = M.wealthPaths(M.rng(23), { p: 0.6, b: 1, f: 0.4, bets: 100, paths: 4000 });
  check(half.halved < s.halved && s.halved < dbl.halved && half.below < dbl.below && dbl.median < s.median, `risk of ever halving: ${(100 * half.halved).toFixed(0)}% half Kelly, ${(100 * s.halved).toFixed(0)}% Kelly, ${(100 * dbl.halved).toFixed(0)}% double`);
}

// ---------- scoring and calibration ----------
check(near(M.brierOne(0.8, true), 0.04) && near(M.brierOne(0.9, false), 0.81) && near(M.brierOne(0.5, true), 0.25), "Brier: 0.04, 0.81, 0.25");
for (const p of [0.1, 0.3, 0.5, 0.7, 0.95]) {
  let bq = 0, bv = Infinity, lq = 0, lv = -Infinity;
  for (let i = 1; i < 1000; i++) { const q = i / 1000; if (M.expectedBrier(q, p) < bv) { bv = M.expectedBrier(q, p); bq = q; } if (M.expectedLog(q, p) > lv) { lv = M.expectedLog(q, p); lq = q; } }
  check(near(bq, p, 1e-3) && near(lq, p, 1e-3), `honest is best at p=${p}: Brier and log both peak at ${bq}`);
}
{
  let rec = M.emptyCalib();
  for (const [c, ok] of [[70, true], [70, false], [90, true], [90, true], [90, false], [99, true]]) rec = M.addCalib(rec, `q${rec.n}`, c, ok);
  check(rec.n === 6 && M.reliability(rec).map(r => `${r.c}:${r.rate.toFixed(2)}x${r.n}`).join() === "70:0.50x2,90:0.67x3,99:1.00x1", "reliability points");
  const brier = (0.09 + 0.49 + 0.01 + 0.01 + 0.81 + 0.0001) / 6;
  check(near(M.meanBrier(rec), brier, 1e-6), "mean Brier of the record");
  check(near(M.overconfidence(rec), (0.7 * 2 + 0.9 * 3 + 0.99 - 4) / 6, 1e-9) && M.overconfidence(M.emptyCalib()) === null, "overconfidence: stated minus right");
  let long = M.emptyCalib();
  for (let i = 0; i < 100; i++) long = M.addCalib(long, `s${i % 50}`, 70, true);
  check(long.seen.length === 40 && long.n === 100, "the record remembers the last 40 statements asked");
  // a perfectly calibrated forecaster is found out by many answers
  const r = M.rng(4); let cal = M.emptyCalib();
  for (let i = 0; i < 6000; i++) { const c = M.CONF[i % 6]; cal = M.addCalib(cal, "x", c, r() < c / 100); }
  check(M.reliability(cal).every(x => near(x.rate, x.c / 100, 0.05)) && Math.abs(M.overconfidence(cal)) < 0.02, "honest 50..99% answers plot on the diagonal");
}
check(M.inside(10, 20, 10) && M.inside(10, 20, 20) && !M.inside(10, 20, 20.1) && !M.inside(10, 20, 9.9), "a range holds its ends");

// ---------- reference classes ----------
check(M.quantile(PAST_JOBS, 0.5) === 15 && near(M.quantile(PAST_JOBS, 0.8), 21.8) && M.quantile(PAST_JOBS, 0) === 9 && M.quantile(PAST_JOBS, 1) === 30 && PAST_JOBS.filter(d => d <= 10).length === 1, "ten past jobs: median 15 days, 80% by day 21.8, one in ten within 10 days");
{
  const { truth, guesses } = GUESSES, m = M.mean(guesses), errs = guesses.map(g => Math.abs(g - truth));
  check(m === 98 && Math.abs(m - truth) === 2 && M.mean(errs) === 30, "the crowd's average is off by 2, the typical guess by 30");
}

// ---------- the data ----------
check(new Set(STATEMENTS.map(s => s.id)).size === STATEMENTS.length && STATEMENTS.length >= 40 && STATEMENTS.every(s => s.s && typeof s.t === "boolean" && s.x), `${STATEMENTS.length} statements, each with a fact`);
{ const t = STATEMENTS.filter(s => s.t).length; check(t / STATEMENTS.length > 0.4 && t / STATEMENTS.length < 0.65, `a fair mix of true and false (${t} of ${STATEMENTS.length} true)`); }
check(new Set(QUANTITIES.map(q => q.id)).size === QUANTITIES.length && QUANTITIES.every(q => q.lo < q.t && q.t < q.hi && (!q.log || q.lo > 0)), `${QUANTITIES.length} quantities, each inside its slider`);

process.exit(bad ? 1 : 0);
