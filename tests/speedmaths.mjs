// Speed maths and Fuel maths (README, Speed maths): the one rule that says whether a typed answer is right, the dealing,
// the scoring and the saved run, in Node (no page). The rule is the thing to be sure of: an estimate typed to one or two
// significant figures is accepted within a band or when it is the exact figure rounded as asked, and a decimal slip never is.
import { roundSf, near, parseTyped, judge, BAND, chainRel, askText, fmtOff, slipOf, fmtTyped, fmtNum, fmtAnswer, rng, hashParts, values, stepText, chainProblem, mul, pct } from "../speedmaths-core.js";
import { POOLS, MODES, DAILY_CYCLE, startRun, dailyRun, matchRun, validRun, normOpts, problemAt, submit, autoMatches, bonusNow, finish, summary, missesOf, lastAnswer, isBest, dailySeed, kindAt, STREAK_STEP, STREAK_MAX } from "../speedmaths-engine.js";
import { SUM_KINDS, RANGES } from "../speedmaths-pool.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const p1 = answer => ({ answer, sf: 1 }), p2 = answer => ({ answer, sf: 2 }), sum = answer => ({ answer, sf: 0 });
const ok = (p, t) => judge(p, t).ok;

// ---------- reading what is typed ----------
check(parseTyped("4,031") === 4031 && parseTyped(" 12.5 ") === 12.5 && parseTyped("0.5") === 0.5 && parseTyped(".5") === 0.5 && parseTyped("7.") === 7 && parseTyped("12.0") === 12,
  "typed figures read as numbers: commas out, a leading point, a trailing one, 12.0 is 12");
check(["", " ", ".", "-", "abc", "1.2.3", "1e3", "12 3x"].every(t => Number.isNaN(parseTyped(t))) && parseTyped("−4") === -4,
  "nothing, a lone point, letters and two points are not figures");
check(judge(sum(12), "").grade === "none" && judge(p2(12), ".").grade === "none" && !ok(sum(12), "x"), "nothing typed is a skip, never right");
check(roundSf(4031, 2) === 4000 && roundSf(4031, 1) === 4000 && roundSf(0.0137, 1) === 0.01 && roundSf(0.0137, 2) === 0.014 && roundSf(14.9, 1) === 10
  && roundSf(15, 1) === 20 && roundSf(1000, 2) === 1000 && roundSf(999.9, 2) === 1000 && roundSf(0, 2) === 0 && roundSf(-4031, 2) === -4000,
  "significant figures: 4,031 to 2 is 4,000, 0.0137 to 1 is 0.01, 999.9 to 2 is 1,000, powers of ten stay put");
check(fmtTyped("4031") === "4,031" && fmtTyped("1234.5") === "1,234.5" && fmtTyped("0.") === "0." && fmtTyped("-5") === "−5" && fmtNum(7.45) === "7.45" && fmtNum(1200) === "1,200" && fmtAnswer(18.5912) === "18.59" && fmtAnswer(11664.3) === "11,664",
  "figures grouped as they are typed and shown");

// ---------- an exact sum is exact ----------
check(ok(sum(85), "85") && ok(sum(85), "85.0") && ok(sum(85), "085") && !ok(sum(85), "84") && !ok(sum(85), "85.1") && !ok(sum(85), "850") && !ok(sum(85), "8.5"),
  "a plain sum takes only its answer (85.0 and 085 are 85; a slip of a zero is not)");
check(ok(sum(112.5), "112.5") && !ok(sum(112.5), "112") && !ok(sum(112.5), "113") && !ok(sum(112.5), "112.4"), "a sum with a decimal answer is exact too");

// ---------- the band: 5% at one significant figure, 1% at two ----------
check(BAND[1] === 0.05 && BAND[2] === 0.01, "the bands are 5% and 1%");
check(ok(p2(4031), "4031") && ok(p2(4031), "4000") && ok(p2(4031), "4030") && ok(p2(4031), "4,050") && !ok(p2(4031), "4100") && !ok(p2(4031), "3900") && !ok(p2(4031), "4072"),
  "to 2 s.f., 4,031 takes 4,000 to 4,071 (within 1%) and not 4,100");
check(judge(p2(4031), "4031").grade === "exact" && judge(p2(4031), "4000").grade === "close" && judge(p2(18.5912), "18.59").grade === "exact" && judge(p2(4031), "4100").grade === "wrong",
  "exact, close and wrong are told apart (exact: the figure to four s.f.)");
check(ok(p2(5000), "5050") && !ok(p2(5000), "5051") && ok(p2(5000), "4950") && !ok(p2(5000), "4949"), "the edge of the band: exactly 1% out is in, a hair more is not");
check(ok(p1(14.9), "15") && ok(p1(14.9), "10") && ok(p1(14.9), "14.5") && !ok(p1(14.9), "14") && !ok(p1(14.9), "20") && !ok(p1(14.9), "16"),
  "to 1 s.f., 14.9 takes 15 (the band) and 10 (the figure rounded as asked), not 14 (6% out) or 20");
check(ok(p1(14.9), "15.6") && !ok(p1(14.9), "15.7"), "to 1 s.f. the band is 5%: 15.6 is in, 15.7 is out");
// 14.9 and 15.1 are 1% apart but round to 10 and 20 at one s.f.: the band is what stops that cliff being unfair
check(ok(p1(15.1), "15") && ok(p1(14.9), "15") && ok(p1(15.1), "20") && ok(p1(15.1), "14.5"), "either side of a rounding cliff, 15 is right");
check(ok(p1(1.4), "1") && ok(p1(1.4), "1.4") && ok(p1(1.4), "1.45") && !ok(p1(1.4), "2") && !ok(p1(1.4), "1.6") && ok(p1(11664), "10000") && ok(p1(11664), "12000") && !ok(p1(11664), "11000") && !ok(p1(11664), "9000"),
  "an exact figure starting with a 1 can be 29% out when rounded as asked (1.4 is 1), and only that rounding is let through");
check(ok(p2(0.0137), "0.014") && ok(p2(0.0137), "0.0137") && !ok(p2(0.0137), "0.0145") && !ok(p2(0.0137), "0.14") && !ok(p2(0.0137), "0.0014"), "small figures: the same bands");
check(ok(p2(2.5), "2.5") && ok(p2(2.5), "2.51") && !ok(p2(2.5), "2.6") && ok(p1(2.5), "3") && ok(p1(2.5), "2.4") && !ok(p1(2.5), "2.7") && !ok(p1(2.5), "2.2"), "2.5: the half goes up, and 2.4 is within 5%");

// ---------- a slip of the decimal point is never close ----------
for (const [a, t] of [[4031, "403.1"], [4031, "40310"], [4031, "403100"], [18.59, "185.9"], [18.59, "1.859"], [0.0137, "0.137"], [365.6, "36.56"], [365.6, "3656"], [95, "9.5"], [95, "950"]]) {
  check(!ok(p1(a), t) && !ok(p2(a), t) && !ok(sum(a), t), `${t} for ${a} is a zero out: wrong at either significance, and for a sum`);
}
check(slipOf(450, 45) === 1 && slipOf(4.5, 45) === -1 && slipOf(45000, 45) === 3 && slipOf(46, 45) === 0 && slipOf(45, 45) === 0 && slipOf(-450, 45) === 0, "a slip of the point is named: a zero too many or short");
check(fmtOff(0.0004) === "under 0.1%" && fmtOff(0.0123) === "1.2%" && fmtOff(0.16) === "16%" && fmtOff(12) === "more than ten times out", "how far out, as a person says it");

// ---------- a chain is let off a little more for each step past the third ----------
check(chainRel(2, 3) === 0.01 && chainRel(2, 4) === 0.015 && chainRel(2, 5) === 0.02 && Math.abs(chainRel(2, 6) - 0.025) < 1e-12 && Math.abs(chainRel(1, 6) - 0.125) < 1e-12 && chainRel(1, 2) === 0.05,
  "a chain's band grows by half a band a step past the third: 1% at three steps, 2% at five");
{
  const c = { answer: 4031, sf: 2, rel: chainRel(2, 5) };
  check(ok(c, "4100") && ok(c, "3980") && !ok(c, "4130") && ok(c, "4000") && askText(c) === "to 2 s.f., within 2%" && askText(p1(3)) === "to 1 s.f., within 5%" && askText(sum(3)) === "exact",
    "a five-step chain at two figures takes 2%, and the page says what it asks");
}

// ---------- the same sums on every device ----------
{
  const a = rng(12345), b = rng(12345), c = rng(12346);
  const xs = Array.from({ length: 6 }, () => a()), ys = Array.from({ length: 6 }, () => b()), zs = Array.from({ length: 6 }, () => c());
  check(same(xs, ys) && !same(xs, zs) && xs.every(x => x >= 0 && x < 1), "a seed gives the same stream every time, and another seed another");
  check(hashParts("a", 1, "b") === hashParts("a", 1, "b") && hashParts("a", 1, "b") !== hashParts("a", 2, "b") && hashParts(1, 12) !== hashParts(11, 2), "the hash of the parts is stable and keeps the parts apart");
}
const texts = (run, n) => Array.from({ length: n }, (_, i) => { const p = problemAt(run, i); return p.kind === "sum" ? `${p.prompt}=${p.answer}` : `${p.id}:${p.start.v}:${p.steps.map(s => s.n).join(",")}=${p.answer}`; });
for (const pool of Object.keys(POOLS)) {
  for (const mode of Object.keys(MODES)) {
    const a = startRun({ pool, mode, seed: 777, day: 20261103 }), b = startRun({ pool, mode, seed: 777, day: 20261103 }), c = startRun({ pool, mode, seed: 778, day: 20261103 });
    const ta = texts(a, 40), tb = texts(b, 40), tc = texts(c, 40);
    // the i-th sum is a function of the seed and i alone: asking out of order, or again, changes nothing
    const order = [31, 3, 17, 0, 39, 8];
    check(same(ta, tb) && !same(ta, tc) && order.every(i => texts(a, 40)[i] === ta[i] && problemAt(a, i).key === problemAt(b, i).key), `${pool} ${mode}: a seed deals the same 40 sums every time, and another seed others`);
  }
}
{
  // every sum a person can type, in every pool and mode, over many seeds
  let n = 0, worst = null;
  for (const pool of Object.keys(POOLS)) for (const mode of Object.keys(MODES)) for (let seed = 1; seed <= 25; seed++) {
    const run = startRun({ pool, mode, seed: seed * 7919, day: 20261103 });
    for (let i = 0; i < 24; i++) {
      const p = problemAt(run, i);
      n++;
      const typeable = Number.isFinite(p.answer) && p.answer >= 1 && p.answer < 1e8 || p.kind === "sum" && p.answer > 0;
      const chainOk = p.kind === "sum" || (p.steps.length >= 1 && p.steps.length === p.n && near(p.steps.at(-1).value, p.answer) && p.steps.every(s => Number.isFinite(s.value) && s.value !== 0 && stepText(s)));
      const sfOk = p.kind === "sum" ? p.sf === 0 : (p.sf === 1 || p.sf === 2);
      if (!(typeable && chainOk && sfOk) && !worst) worst = `${pool}/${mode}/${seed}/${i} ${JSON.stringify(p).slice(0, 120)}`;
    }
  }
  check(!worst, `${n} sums dealt, every answer one a person can type, every chain's steps agreeing with its answer${worst ? `: ${worst}` : ""}`);
}

// ---------- the modes deal what they say ----------
{
  const r = startRun({ pool: "mercantile", mode: "sprint", seed: 5 });
  check(Array.from({ length: 60 }, (_, i) => problemAt(r, i)).every(p => p.kind === "sum" && p.sf === 0 && p.worth === 1), "a sprint is exact one-step sums");
  const kinds = new Set(Array.from({ length: 80 }, (_, i) => problemAt(r, i).id));
  check(kinds.size === SUM_KINDS.length, "a sprint on everything deals every operation");
  const only = startRun({ pool: "mercantile", mode: "sprint", seed: 5, opts: { kinds: ["mul", "div"], range: 20 } });
  check(Array.from({ length: 60 }, (_, i) => problemAt(only, i).id).every(k => k === "mul" || k === "div") && same(only.opts, { kinds: ["mul", "div"], range: 20 }), "ticked operations are the only ones dealt");
  const small = startRun({ pool: "mercantile", mode: "sprint", seed: 9, opts: { kinds: ["add"], range: 20 } }), big = startRun({ pool: "mercantile", mode: "sprint", seed: 9, opts: { kinds: ["add"], range: 1000 } });
  const top = run => Math.max(...Array.from({ length: 40 }, (_, i) => problemAt(run, i).answer));
  check(top(small) <= 40 && top(big) > 200, "the range sets how far the numbers reach (to 20: nothing past 40; to 1,000: well past 200)");
  const early = Array.from({ length: 6 }, (_, i) => problemAt(startRun({ pool: "mercantile", mode: "sprint", seed: 100 + i, opts: { kinds: ["mul"] } }), 0).answer);
  const late = Array.from({ length: 6 }, (_, i) => problemAt(startRun({ pool: "mercantile", mode: "sprint", seed: 100 + i, opts: { kinds: ["mul"] } }), 40).answer);
  check(Math.max(...early) < Math.max(...late) && early.reduce((a, b) => a + b) < late.reduce((a, b) => a + b), "the sums reach for bigger numbers as a run goes on");
  const est = startRun({ pool: "mercantile", mode: "estimate", seed: 5 });
  check(Array.from({ length: 30 }, (_, i) => problemAt(est, i)).every(p => p.kind === "chain" && p.n <= 2 && p.sf >= 1), "an estimate is one or two steps, typed to significant figures");
  const ch = startRun({ pool: "mercantile", mode: "chains", seed: 5 });
  const lens = Array.from({ length: 30 }, (_, i) => problemAt(ch, i).n);
  check(lens.every(n => n >= 3 && n <= 6) && Math.max(...lens) > Math.min(...lens.slice(0, 2)) && lens.slice(0, 2).every(n => n === 3), "chains run three to six steps, longer as the run goes");
  const d = dailyRun("mercantile", 20261103);
  check(Array.from({ length: 18 }, (_, i) => kindAt(d, i)).join() === Array.from({ length: 18 }, (_, i) => DAILY_CYCLE[i % DAILY_CYCLE.length]).join()
    && new Set(Array.from({ length: 18 }, (_, i) => problemAt(d, i).kind)).size === 2, "Today's is a cycle of sums, an estimate and a chain");
}

// ---------- Today's: seeded by the day, the same for everyone, nothing of yours in it ----------
{
  const a = dailyRun("mercantile", 20261103), b = dailyRun("mercantile", 20261103), c = dailyRun("mercantile", 20261104), f = dailyRun("fuels", 20261103);
  check(a.seed === dailySeed("mercantile", 20261103) && a.seed === b.seed && a.seed !== c.seed && a.seed !== f.seed, "today's seed is the day's, and each pool has its own");
  check(same(texts(a, 30), texts(b, 30)) && !same(texts(a, 30), texts(c, 30)) && !same(texts(a, 30), texts(f, 30)), "the same day deals the same sums on any device, another day or pool others");
  const mine = startRun({ pool: "mercantile", mode: "daily", seed: dailySeed("mercantile", 20261103), opts: { kinds: ["add"], range: 20 }, day: 20261103 });
  check(same(texts(a, 30), texts(mine, 30)) && same(mine.opts, a.opts), "your menu's operations and range are not in today's: it is comparable");
}

// ---------- a match at a table: everyone gets the same ----------
{
  const m = { seed: 4242, pool: "mercantile", opts: normOpts("mercantile", { kinds: ["add", "mul"], range: 100 }), secs: 60 };
  const mine = matchRun(m), theirs = matchRun(JSON.parse(JSON.stringify(m)));
  check(same(texts(mine, 40), texts(theirs, 40)) && mine.secs === 60 && mine.mode === "sprint", "a match deals the same sums to every phone, through the database's JSON");
  check(same(normOpts("mercantile", { kinds: [], range: 7 }), { kinds: SUM_KINDS.map(([k]) => k), range: 100 }) && same(normOpts("fuels", {}).kinds, POOLS.fuels.kinds.map(([k]) => k)) && normOpts("fuels", {}).range === null,
    "options with nothing ticked, or an unknown range, are the defaults");
}

// ---------- answering and scoring ----------
{
  const run = startRun({ pool: "mercantile", mode: "sprint", seed: 31 });
  const right = () => String(problemAt(run).answer), pts = [];
  check(autoMatches(run, right()) && !autoMatches(run, "") && !autoMatches(run, "0.5") && bonusNow(run) === 0, "an exact sum goes in by itself when it is right, and not before");
  for (let i = 0; i < 12; i++) pts.push(submit(run, right(), (i + 1) * 1000).points);
  check(same(pts, [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3]) && STREAK_STEP === 5 && STREAK_MAX === 2,
    "a point for a sum, and a point more to each answer for every five in a row, up to two");
  check(run.score === pts.reduce((a, b) => a + b) && run.streak === 12 && run.top === 12 && run.right === 12 && run.i === 12 && run.log.length === 12, "the score, the streak and the log add up");
  const slow = submit(run, "", 13500);
  check(slow.grade === "none" && !slow.ok && slow.points === 0 && run.streak === 0 && run.missed === 1 && run.top === 12 && slow.ms === 1500, "nothing typed is a skip: it costs the streak, not the best streak");
  const wrong = submit(run, "9999", 15000);
  check(wrong.grade === "wrong" && run.missed === 2 && run.right === 12 && wrong.ms === 1500 && run.typed === "", "a wrong figure is wrong, and the line is clear for the next");
  const miss = missesOf(run);
  check(miss.length === 2 && miss[0].grade === "wrong" && miss[0].text === "9999" && miss[1].grade === "none" && lastAnswer(run).grade === "wrong", "the misses come newest first, for the review");
  const s = finish(run);
  check(run.over && s.score === run.score && s.right === 12 && s.missed === 2 && s.top === 12 && s.answered === 14 && s.avgMs === Math.round(15000 / 14) && summary(run).score === s.score, "a finished run says how it went");
  check(isBest(null, 5) && isBest(undefined, 1) && isBest(4, 5) && !isBest(5, 5) && !isBest(9, 5) && !isBest(null, 0), "a best is a score above the last, and a first score counts");
}
{
  // estimates and chains: worth by steps and figures, graded as the rule says
  const run = startRun({ pool: "fuels", mode: "chains", seed: 11 });
  const p = problemAt(run), exactTyped = String(Number(p.answer.toPrecision(4)));
  check(p.worth === 2 * p.n + (p.sf === 2 ? 1 : 0), "a chain is worth two a step, and a point more at two figures");
  const r = submit(run, exactTyped, 4000);
  check(r.ok && r.grade === "exact" && r.points === p.worth, "the exact figure scores its worth");
  const q = problemAt(run), roundedTo = String(roundSf(q.answer, q.sf));
  const r2 = submit(run, roundedTo, 9000);
  check(r2.ok && r2.points === q.worth, "the figure rounded as asked scores too");
  const t = problemAt(run), slip = submit(run, String(t.answer * 10), 12000);
  check(!slip.ok && slip.grade === "wrong" && run.streak === 0, "a zero too many scores nothing");
}

// ---------- kept and picked up again ----------
{
  const run = startRun({ pool: "mercantile", mode: "estimate", seed: 99, opts: { kinds: ["add", "sub"], range: 100 } });
  for (let i = 0; i < 5; i++) submit(run, String(problemAt(run).answer), (i + 1) * 3000);
  run.typed = "12"; run.used = 16000;
  const saved = JSON.parse(JSON.stringify(run));
  check(validRun(saved) && same(texts(saved, 12), texts(run, 12)) && saved.i === 5 && saved.typed === "12", "a run kept as JSON and read back is the same run, at the same sum, with what was typed");
  const next = submit(saved, String(problemAt(saved).answer), 20000), twin = submit(run, String(problemAt(run).answer), 20000);
  check(next.points === twin.points && saved.score === run.score && saved.log.length === run.log.length, "and goes on exactly as the one that was not kept");
  check(!validRun(null) && !validRun({}) && !validRun({ ...saved, v: 2 }) && !validRun({ ...saved, pool: "nowhere" }) && !validRun({ ...saved, mode: "marathon" }) && !validRun({ ...saved, seed: "x" }) && !validRun({ ...saved, opts: { kinds: [] } })
    && !validRun({ ...saved, opts: { kinds: ["nonsense"], range: 100 } }) && !validRun({ ...saved, log: null }), "a run from an older version, or damaged, is dropped");
}
{
  const run = startRun({ pool: "mercantile", mode: "sprint", seed: 1 });
  for (let i = 0; i < 200; i++) submit(run, "", i);
  check(run.log.length <= 150 && run.missed === 200 && run.i === 200, "the log is kept to what the review wants; the counts go on");
}

// ---------- the pools ----------
{
  const m = POOLS.mercantile, f = POOLS.fuels;
  check(m.defs.length >= 20 && f.defs.length >= 20 && [m, f].every(P => new Set(P.defs.map(d => d.id)).size === P.defs.length), "both pools have a deck, every definition with an id of its own");
  check(RANGES.length === 3 && RANGES.some(([r]) => r === m.range) && m.ranges === RANGES && f.ranges === null && m.constants.length > 0 && f.constants.length > 0, "the mercantile pool has ranges; each has the conversion factors a person rounds");
  const nothing = [...m.defs, ...f.defs].filter(d => !(d.n >= 1 && d.n <= 6 && (d.sf === 1 || d.sf === 2) && d.name && d.topic && d.figs && typeof d.build === "function"));
  check(!nothing.length, "every definition says its steps, its significant figures, its name and its topic");
  const fuelWords = /\b(oil|crude|diesel|gasoline|jet|barrel|bbl|FAME|HVO|ethanol|CO2e|refinery|tanker|MJ|kbd)\b/i;   // the trade's words; a car's fuel is everyone's
  const leaky = JSON.stringify(m.defs.map(d => [d.name, d.topic, d.build(Object.fromEntries(Object.entries(d.figs).map(([k, v]) => [k, v[0]])))])).match(fuelWords);
  check(!leaky, `the public pool says nothing of oil${leaky ? `: ${leaky[0]}` : ""}`);
}

// ---------- the shortcut a person takes is accepted ----------
// A person rounds the conversion factors (3.785 litres a gallon is 3.8, 7.45 barrels a tonne is 7.5), so for every definition
// and every combination of its figures, working it with its factors rounded to two significant figures must still be
// accepted at the figures the definition asks: or the page would call a good estimate wrong.
function* combos(figs) {
  const keys = Object.keys(figs);
  const walk = function* (i, acc) {
    if (i === keys.length) { yield { ...acc }; return; }
    for (const o of figs[keys[i]]) { acc[keys[i]] = o; yield* walk(i + 1, acc); }
  };
  yield* walk(0, {});
}
for (const [id, P] of Object.entries(POOLS)) {
  let n = 0, drawn = 0, short = null, untypeable = null;
  for (const d of P.defs) for (const figs of combos(d.figs)) {
    n++;
    const p = chainProblem(d, figs);
    if (!p) { untypeable ??= `${d.id} ${JSON.stringify(figs).slice(0, 80)}`; continue; }
    drawn++;
    const rounded = p.steps.map(s => (P.constants.some(c => near(c, s.n)) ? { ...s, n: roundSf(s.n, 2) } : s));
    const v = values(p.start.v, rounded).at(-1);
    if (!judge(p, v).ok && !short) short = `${d.id} ${JSON.stringify(figs).slice(0, 80)}: ${fmtAnswer(v)} for ${fmtAnswer(p.answer)}`;
  }
  check(!untypeable, `${id}: every combination of figures makes an answer a person can type (${n})${untypeable ? `: ${untypeable}` : ""}`);
  check(!short, `${id}: the factors rounded to two figures, the shortcut, are accepted for all ${drawn} combinations${short ? `: ${short}` : ""}`);
}
{
  // and a shortcut too coarse is not: 7.45 rounded to 7 is 6% out, which two figures do not take
  const d = POOLS.fuels.defs.find(x => x.id === "t-bbl"), p = chainProblem(d, { kt: 60, fuel: { name: "diesel", bbl: 7.45 } });
  check(ok(p, String(60 * 7.5)) && !ok(p, String(60 * 7)), "7.5 barrels a tonne is a fair shortcut for 7.45 at two figures, and 7 is not");
  const g = POOLS.mercantile.defs.find(x => x.id === "gal-l"), q = chainProblem(g, { gal: 15 });
  check(ok(q, String(15 * 3.8)) && ok(q, "57") && !ok(q, "60") && !ok(q, "45"), "15 gallons: 15 × 3.8 or 57 is right; 60 and 45 are not");
}

// ---------- a chain's words and its arithmetic are one thing ----------
{
  const def = { id: "t", name: "t", topic: "t", n: 3, sf: 2, figs: {}, build: () => ({ start: { v: 100, say: "units" }, steps: [mul(1.5, "a unit", "money"), pct(20, "of that", "20% of that"), mul(12, "months", "a year")] }) };
  const p = chainProblem(def, {});
  check(near(p.answer, 100 * 1.5 * 0.2 * 12) && p.steps.map(s => s.value).join() === "150,30,360" && p.unit === "a year" && p.n === 3 && p.rel === chainRel(2, 3) && p.worth === 7
    && stepText(p.steps[0]) === "× 1.5 a unit" && stepText(p.steps[1]) === "20% of that", "a chain folds its steps into its answer, and says each as it works it");
  const small = { ...def, build: () => ({ start: { v: 2, say: "x" }, steps: [mul(0.1, "", "y"), mul(2, "", "z"), mul(2, "", "w")] }) };
  check(chainProblem(small, {}) === null, "an answer under 1 is never dealt (the dealer draws again)");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("speedmaths: the rule, the dealing, the scoring and the saved run all hold");
