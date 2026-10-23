// Guilloché's workshop (guilloche-engine.js): a pass cut by a rosette (lobes, throw, shape, index, feed, a second
// rosette), the plate compared as a picture (the same engraving alike to a pixel, a step of any knob not), the eight levels
// each made from a seed with a hidden setting every one of whose neighbours is told apart, setting a knob and taking it
// back, the grade by taps against par, and a run kept through JSON.
import { G, WIN, STARS, SLACK, SHAPES, KNOBS, LEVELS, stepOf, clampKnob, passes, raster, alike, near, settingsOf, makeJob, newRun, platesOf, match, closeness, solved, setKnob, undo, starsFor, finish, say } from "../guilloche-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near_ = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 7919);
const BARE = { R: 0.5, k: 2, a: 1, shape: 0, n: 1, index: 0, feed: 0, k2: 1, a2: 0 };

// ---------- one pass, and many ----------
{
  const p = passes({ ...BARE, k: 3, a: 5 })[0], r = i => Math.hypot(p[2 * i], p[2 * i + 1]);
  // twelve o'clock is a point at angle 0: x = 0, y = -r; r = R + a·0.02·sin(k·0) = R there, the waves round it
  check(near_(p[0], 0) && near_(p[1], -0.5) && near_(p[2 * 720], p[0], 1e-4) && near_(p[2 * 720 + 1], p[1], 1e-4), "a pass starts at twelve o'clock on its radius and closes on itself");
  const rs = Array.from({ length: 721 }, (_, i) => r(i));
  check(near_(Math.max(...rs), 0.5 + 5 * 0.02, 1e-3) && near_(Math.min(...rs), 0.5 - 5 * 0.02, 1e-3), "a rosette's throw is how far the point rides in and out of the radius (a step of throw is a fiftieth of the plate's radius)");
  const crest = [...rs.keys()].filter(i => i > 0 && i < 720 && rs[i] > rs[i - 1] && rs[i] >= rs[i + 1]);
  check(crest.length === 3, "a rosette of three lobes cuts three waves in the ring");
  const flat = passes({ ...BARE, a: 0 })[0];
  check(Array.from({ length: 721 }, (_, i) => Math.hypot(flat[2 * i], flat[2 * i + 1])).every(x => near_(x, 0.5, 1e-4)), "without throw the pass is a circle");
  for (const [shape, name] of [[0, "wave"], [1, "scallop"], [2, "point"]]) {
    const q = passes({ ...BARE, k: 4, a: 5, shape })[0], rr = Array.from({ length: 721 }, (_, i) => Math.hypot(q[2 * i], q[2 * i + 1]));
    check(near_(Math.max(...rr), 0.6, 2e-3) && near_(Math.min(...rr), 0.4, 2e-3), `a ${name} rosette rides the same distance either way`);
  }
  const sc = passes({ ...BARE, k: 1, a: 5, shape: 1 })[0];
  check(near_(Math.hypot(sc[0], sc[1]), 0.4, 1e-3), "a scallop's cusp is at the rosette's zero, the inner end of its throw, pointing in");
  // many passes: the index turns the rosette between them, the feed steps outward
  const many = passes({ ...BARE, k: 4, a: 3, n: 5, index: 45, feed: 2 });
  check(many.length === 5 && near_(Math.hypot(many[3][0], many[3][1]), 0.5 + 2 * 0.006 * 3 + 3 * 0.02 * Math.sin((3 * 45 * Math.PI) / 180), 1e-4), "n passes, the jth at its radius plus j feeds and its rosette turned j indexes");
  const two = passes({ ...BARE, k: 3, a: 3, k2: 5, a2: 2 })[0];
  const t = (100 / 720) * 2 * Math.PI, want = 0.5 + 0.06 * Math.sin(3 * t) + 0.04 * Math.sin(5 * t);
  check(near_(Math.hypot(two[200], two[201]), want, 1e-4), "a second rosette's waves are added to the first's");
  const big = passes({ ...BARE, R: 0.95, a: 10, a2: 8, k2: 2 })[0];
  check(Array.from({ length: 721 }, (_, i) => Math.hypot(big[2 * i], big[2 * i + 1])).every(x => x <= 0.99 + 1e-6), "a cut never runs off the plate");
}

// ---------- plates as pictures ----------
{
  const cuts = [{ ...BARE, k: 6, a: 4, n: 12, index: 30 }];
  const a = raster(cuts), b = raster(cuts.map(c => ({ ...c })));
  check(a.length === G * G && alike(a, b) === 1 && alike(a, a) === 1, "the same engraving is alike to a pixel");
  const step = (cut, name, d) => raster([{ ...cut, [name]: cut[name] + d }]);
  check(["k", "a", "n", "index"].every(n => alike(a, step(cuts[0], n, stepOf(n))) < WIN) && ["k", "a", "n", "index"].every(n => alike(a, step(cuts[0], n, -stepOf(n))) < WIN),
    "a step either way of any knob makes a plate that isn't the same");
  const n = raster([{ ...cuts[0], n: 13 }]);
  check(alike(a, n) < WIN, "one pass more in twelve shows (a count at each place tells a dense rose's passes)");
  const ring = { ...BARE, R: 0.55, k: 6, a: 4 }, w = raster([ring]);
  check(near(a, b) === 1 && near(w, raster([{ ...ring, a: 5 }])) > near(w, raster([{ ...ring, k: 9 }])) && near(a, raster([])) === 0, "near forgives a little: a ring a step of throw out is nearer than one with other lobes; nothing cut is nowhere near");
  const q = raster([{ ...cuts[0], R: 0.6 }]);
  check(alike(a, q) < 0.5 && near(a, q) < 0.9, "a plate cut at another radius is another plate");
}

// ---------- the levels ----------
check(LEVELS.length === 8 && new Set(LEVELS.map(l => l.id)).size === 8 && LEVELS.every(l => l.name && l.story && l.cuts.length >= 1 && l.cuts.every(c => c.free.length && c.free.every(n => n in KNOBS && c.ranges[n].length === 2))),
  "eight levels, each with a name, a story and cuts with knobs and ranges");
check(LEVELS[0].id === "wave" && LEVELS.at(-1).id === "master" && LEVELS.map(l => l.cuts.length).join() === "1,1,1,1,1,2,3,3", "the wave ring first and the master dial last, a zone more as the dial grows");
LEVELS.forEach((L, li) => {
  let same = 0, differs = 0, clear = 0, within = 0, fixedOk = 0;
  for (const seed of SEEDS) {
    const j = makeJob(li, seed), k = makeJob(li, seed), c = makeJob(li, seed + 1);
    if (JSON.stringify(j.answer) === JSON.stringify(k.answer)) same++;
    if (JSON.stringify(j.answer) !== JSON.stringify(c.answer)) differs++;
    if (j.clear < WIN - 0.005) clear++;
    if (j.answer.every((v, i) => j.cuts[i].free.every(n => v[n] >= j.cuts[i].ranges[n][0] && (L.closed || v[n] <= j.cuts[i].ranges[n][1]) && v[n] === clampKnob(n, v[n])))) within++;
    if (j.answer.every((v, i) => Object.keys(v).every(n => v[n] !== newRun(j).vals[i][n]))) fixedOk++;
  }
  check(same === SEEDS.length && differs >= SEEDS.length - 2, `${L.name}: made the same from a seed, another from another`);
  check(within === SEEDS.length && fixedOk === SEEDS.length, `${L.name}: every knob inside its range and away from where the machine starts`);
  check(clear === SEEDS.length, `${L.name}: a step either way of any knob is told apart from the target (${clear} of ${SEEDS.length})`);
});
{
  // the rose closes: passes times index is a whole turn of the rosette
  const closed = SEEDS.every(s => { const v = makeJob(2, s).answer[0]; return v.n * v.index === 360; });
  check(closed, "a rose's passes times index is 360°, so the rose closes");
  check(makeJob(0, 5).par === 2 && makeJob(2, 5).par === 4 && makeJob(7, 5).par === LEVELS[7].cuts.reduce((n, c) => n + c.free.length, 0), "par is the knobs to set, a tap each (two for a wave ring, four for a rose)");
}

// ---------- setting a knob, and taking it back ----------
{
  const job = makeJob(2, 77), run = newRun(job);
  check(run.vals[0].k === 2 && run.vals[0].n === 1 && run.taps === 0 && !run.done && run.at === 0 && match(job, run) < WIN, "a bare machine: where it starts, no taps, not the target");
  const a = setKnob(job, run, 0, "k", 6), b = setKnob(job, run, 0, "k", 6);
  check(a && a.was === 2 && run.vals[0].k === 6 && !b && run.taps === 1, "a knob set is a tap, the same again nothing");
  const c = setKnob(job, run, 0, "k", 99, false), d = setKnob(job, run, 0, "shape", 1), e = setKnob(job, run, 5, "k", 3);
  check(c && run.vals[0].k === KNOBS.k.max && !d && !e && run.taps === 1, "past the end clamps; a knob that isn't free, or a cut that isn't there, is refused; a hold's further steps are the one tap");
  const f = setKnob(job, run, 0, "index", 17), g = setKnob(job, run, 0, "k", 7, false);
  check(f && run.vals[0].index === 15 && g && run.taps === 2, "index goes in fives");
  undo(job, run, [g]);
  check(run.vals[0].k === KNOBS.k.max && run.taps === 2, "undo puts back what was there; a step that wasn't a new tap takes no tap with it");
  undo(job, run, [a, c, f]);
  check(run.vals[0].k === 2 && run.vals[0].index === 0 && run.taps === 1, "a finger's batch goes back last first, and its one tap");
  check(JSON.stringify(JSON.parse(JSON.stringify(run))) === JSON.stringify(run), "a run keeps through JSON");
}

// ---------- stars ----------
{
  const job = makeJob(3, 9), par = job.par, three = Math.ceil(par * SLACK.three[0]) + SLACK.three[1], two = Math.ceil(par * SLACK.two[0]) + SLACK.two[1];
  check(starsFor(job, par) === 3 && starsFor(job, three) === 3 && starsFor(job, three + 1) === 2 && starsFor(job, two) === 2 && starsFor(job, two + 1) === 1 && STARS.join() === "1,2,3", "three stars within half again par (and two taps), two within three times (and four), else one");
  const run = newRun(job);
  check(finish(job, run) === null && !run.done && /% like the target/.test(say(job, run)), "an unfinished plate gives no result, and the line says how near it is");
  job.answer.forEach((v, i) => Object.keys(v).forEach(n => setKnob(job, run, i, n, v[n])));
  const r = finish(job, run);
  check(solved(job, run) && match(job, run) === 1 && closeness(job, run) === 1 && r && r.stars === 3 && r.taps === par && run.done === r && finish(job, run) === null && /Engraved in/.test(say(job, run)), "set to the answer it is engraved: par taps, three stars, once");
  check(setKnob(job, run, 0, "k", 5) === null && run.taps === par, "a plate engraved takes no more");
}

// ---------- another setting of the same engraving is as good ----------
{
  // a pass turned a whole lobe on is the same pass: index 360° (out of range) is index 0; a rose with index 60° and
  // six passes is, as a set of curves, the one with index -60° and six passes turned the other way
  const a = raster([{ ...BARE, k: 3, a: 4, n: 6, index: 60 }]), b = raster([{ ...BARE, k: 3, a: 4, n: 6, index: -60 }]);
  check(alike(a, b) > 0.98, "a closed rose indexed the other way cuts the same passes in another order: (nearly) the same plate");
  const job = makeJob(2, 123), run = newRun(job), v = job.answer[0];
  const other = { ...v, index: -v.index };
  Object.keys(other).forEach(n => setKnob(job, run, 0, n, other[n]));
  check(alike(raster(platesOf(job, run)), job.goal) > 0.9, "and so an answer indexed the other way is close (the engraving is what is checked)");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("guilloche: a pass cut by a rosette, plates compared as pictures, eight levels from seeds with hidden settings, setting and undoing a knob, stars by taps against par");
