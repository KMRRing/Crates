// Guilloché's workshop (guilloche-engine.js): a pass cut by a rosette (lobes, throw, shape, index, feed, a second
// rosette), the plate compared as a picture (the same engraving alike to a pixel, a step of any knob not), the fifteen levels
// each made from a seed with a hidden setting every one of whose neighbours is told apart, setting a knob and taking it
// back, the grade by taps against par, and a run kept through JSON.
import { WATCHES, METALS, FINISHES, BEZELS, HANDS, MARKS, STRAPS, watchOf, luma, ghostOf } from "../guilloche-watch.js";
import { CLUE_CAP, CUT_NAMES, cutNames, LESSONS, lessonJob, lessonRun, lessonStep, stepDone, takeClue, clueText, G, WIN, STARS, SLACK, SHAPES, KNOBS, LEVELS, stepOf, clampKnob, passes, raster, alike, near, settingsOf, makeJob, newRun, platesOf, match, closeness, maxPasses, solved, setKnob, undo, starsFor, finish, say } from "../guilloche-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near_ = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 7919);
const BARE = { R: 0.5, k: 2, a: 1, shape: 0, n: 1, index: 0, feed: 0, k2: 1, a2: 0 };
const IX = Object.fromEntries(LEVELS.map((l, i) => [l.id, i]));          // a level's place by its name, so the tests follow the order the levels are in

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
check(LEVELS.length === 15 && new Set(LEVELS.map(l => l.id)).size === 15 && LEVELS.every(l => l.name && l.story && l.cuts.length >= 1 && l.cuts.every(c => c.free.length && c.free.every(n => n in KNOBS && c.ranges[n].length === 2))),
  "fifteen levels, each with a name, a story and cuts with knobs and ranges");
check(LEVELS[0].id === "rose" && LEVELS[1].id === "lines" && LEVELS[2].id === "paris" && IX.master === 11 && LEVELS.at(-1).id === "grand" && LEVELS.map(l => l.cuts.length).join() === "1,1,1,1,1,1,1,1,2,3,3,3,3,4,5",
  "a rose to show off, straight lines and Paris pyramids straight after, then the rings, a cut more as the face grows to the registers");
check(LEVELS.slice(1, 3).every(l => l.cuts[0].kind === "lines") && LEVELS[IX.barley].cuts[0].kind === "lines" && LEVELS[IX.medallion].cuts[0].kind === "lines", "the straight levels cut lines");
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
  const closed = SEEDS.every(s => { const v = makeJob(IX.rose, s).answer[0]; return v.n * v.index === 360; });
  check(closed, "a rose's passes times index is 360°, so the rose closes");
  check(makeJob(IX.wave, 5).par === 2 && makeJob(IX.rose, 5).par === 4 && makeJob(14, 5).par === LEVELS[14].cuts.reduce((n, c) => n + c.free.length, 0), "par is the knobs to set, a tap each (two for a wave ring, four for a rose)");
}

// ---------- straight lines ----------
{
  const L = { R: 0.85, kind: "lines", pitch: 5, angle: 0, cross: 0, a: 0, k: 2, shape: 0, index: 0 }, P = c => passes({ ...L, ...c });
  const flat = P({}), ys = flat.map(a => a[1]);
  check(flat.length === 17 && ys.every((y, i) => near_(y, (i - 8) * 0.1, 1e-6)) && flat.every(a => near_(a[1], a.at(-1), 1e-6)),
    "a straight cut is a line every pitch (a fiftieth of the radius a step), level at angle 0, across the plate");
  check(flat.every(a => Math.hypot(a[0], a[1]) <= L.R + 1e-6 && Math.hypot(a.at(-2), a.at(-1)) <= L.R + 1e-6), "a line ends where the plate does");
  check(P({ angle: 90 }).every((a, i) => near_(a[0], 0.8 - i * 0.1, 1e-6) || near_(a[0], -0.8 + i * 0.1, 1e-6)), "at 90° the lines stand upright");
  check(P({ cross: 90 }).length === 34 && P({ cross: 0 }).length === 17, "a cross cuts a second set of lines at an angle to the first, and none is off");
  const half = P({ cross: 90 }).slice(17), dir = a => [a.at(-2) - a[0], a.at(-1) - a[1]], d1 = dir(flat[8]), d2 = dir(half[8]);
  check(near_(d1[0] * d2[0] + d1[1] * d2[1], 0, 1e-5), "at 90° the second set is square to the first: the pyramids of a clous de Paris");
  const holed = P({ holes: [[0, 0, 0.3]] });
  check(holed.length > 17 && holed.every(a => { for (let i = 0; i < a.length; i += 2) if (Math.hypot(a[i], a[i + 1]) < 0.3 - 1e-6) return false; return true; }), "a line stops short of a hole, so a medallion can sit in the field");
  const waved = P({ a: 2, k: 4 });
  check(waved.every((a, j) => { for (let i = 1; i < a.length; i += 2) if (Math.abs(a[i] - ys[j]) > 2 * 0.02 + 1e-6) return false; return true; }) && waved.some(a => a.some((v, i) => i % 2 && Math.abs(v - a[1]) > 0.01)), "a rosette's wave rides along a line, a throw of 2 at most 2 fiftieths of the radius off");
  const dense = LEVELS.filter(l => l.cuts.some(c => c.kind === "lines"));
  check(dense.every(l => l.cuts.every(c => c.kind !== "lines" || Array.from({ length: 24 }, (_, i) => makeJob(LEVELS.indexOf(l), 1000 + i * 7919)).every(j => platesOf(j, newRun(j)).every((s, ci) => passes(s).length <= maxPasses(j.cuts[ci]) && passes(settingsOf(j.cuts[ci], j.answer[ci])).length <= maxPasses(j.cuts[ci]))))), "no straight cut ever has more lines than its most (the 3D piece reserves that many)");
  // a plate of lines is no picture to nudge towards, so how near it is comes from how far its knobs are
  const job = makeJob(IX.paris, 31), run = newRun(job), ans = job.answer[0], c0 = closeness(job, run);
  setKnob(job, run, 0, "pitch", ans.pitch); const c1 = closeness(job, run);
  setKnob(job, run, 0, "angle", ans.angle); const c2 = closeness(job, run);
  check(c0 < c1 && c1 < c2 && c2 < 1, "each knob set right brings a plate of lines nearer the target, in tenths rather than none until the last tap");
  const off = newRun(job); off.vals[0].pitch = ans.pitch + 1; off.vals[0].angle = ans.angle; off.vals[0].cross = ans.cross;
  check(closeness(job, off) > 0.5 && closeness(job, off) < 1 && !solved(job, off), "a pitch a step off reads as near but not the same");
  const mixed = makeJob(IX.medallion, 5), mr = newRun(mixed);
  mixed.answer.forEach((v, i) => Object.keys(v).forEach(n => setKnob(mixed, mr, i, n, v[n])));
  check(solved(mixed, mr) && closeness(mixed, mr) === 1 && mixed.cuts[0].holes.every(h => mixed.cuts.some(c => c.at && Math.hypot(c.at[0] - h[0], c.at[1] - h[1]) + c.size <= h[2] + 1e-9)), "a medallion in a field: the field's hole holds the medallion, and the whole plate is told by its parts");
}

// ---------- setting a knob, and taking it back ----------
{
  const job = makeJob(IX.rose, 77), run = newRun(job);
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
  const job = makeJob(IX.ribbon, 9), par = job.par, three = Math.ceil(par * SLACK.three[0]) + SLACK.three[1], two = Math.ceil(par * SLACK.two[0]) + SLACK.two[1];
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
  const job = makeJob(IX.rose, 123), run = newRun(job), v = job.answer[0];
  const other = { ...v, index: -v.index };
  Object.keys(other).forEach(n => setKnob(job, run, 0, n, other[n]));
  check(alike(raster(platesOf(job, run)), job.goal) > 0.9, "and so an answer indexed the other way is close (the engraving is what is checked)");
}

// ---------- clues ----------
{
  const job = makeJob(IX.rose, 77), run = newRun(job);
  const c1 = takeClue(job, run), c2 = takeClue(job, run, c1), c3 = takeClue(job, run, c2), c4 = takeClue(job, run, c3);
  check(c1.tier === 1 && c2.tier === 2 && c3.tier === 3 && c4.tier === 3 && c1.name === c2.name && c2.name === c3.name, "clues on the same knob go on from where to look, to which way, to the setting, and stop there");
  check(run.clues === 3 && c3.text.includes(KNOBS[c3.name].say(job.answer[c3.cut][c3.name])), "the last clue says the setting, and the run remembers the deepest clue taken");
  // the knob a clue is about is the one that brings the plate nearest the target when set right
  const gain = (cut, name) => { const t = newRun(job); t.vals[cut][name] = job.answer[cut][name]; return match(job, t); };
  const best = Math.max(...job.cuts.flatMap((c, i) => c.free.map(n => gain(i, n))));
  check(Math.abs(gain(c1.cut, c1.name) - best) < 1e-9, "a clue is about the knob that matters most");
  // every knob right: nothing to clue
  job.answer.forEach((v, i) => Object.keys(v).forEach(n => setKnob(job, run, i, n, v[n])));
  check(takeClue(job, run) === null, "with every knob right there is nothing to clue");
  // a clue on the knob changed moves on to the next knob at its first tier
  const j2 = makeJob(IX.edge, 5), r2 = newRun(j2), a = takeClue(j2, r2);
  setKnob(j2, r2, a.cut, a.name, j2.answer[a.cut][a.name]);
  const b = takeClue(j2, r2, a);
  check(b && b.name !== a.name && b.tier === 1, "once a knob is right the next clue is about another, from its first tier");
  // direction and size are true
  const j3 = makeJob(IX.wave, 9), r3 = newRun(j3), t = takeClue(j3, r3, { cut: 0, name: "k", tier: 1 });
  const want = j3.answer[0].k, said = clueText(j3, r3, 0, "k", 2);
  check(said.includes(want > r3.vals[0].k ? "up" : "down") && /a little|a fair way|a long way/.test(said), "the second clue says which way and about how far");
  const j4 = makeJob(IX.edge, 3), r4 = newRun(j4);
  check(/waves are/.test(clueText(j4, r4, 0, "shape", 2)) && !/Scallop|Point|Wave/.test(clueText(j4, r4, 0, "shape", 2)), "for a rosette's edge the second clue describes it without naming it");
  check(CLUE_CAP.join() === "3,3,2,1" && starsFor(j2, j2.par, 0) === 3 && starsFor(j2, j2.par, 1) === 3 && starsFor(j2, j2.par, 2) === 2 && starsFor(j2, j2.par, 3) === 1, "stars are capped by the clues taken: where to look is free, which way costs one, the setting two");
  const j5 = makeJob(IX.rose, 123), r5 = newRun(j5);
  takeClue(j5, r5); takeClue(j5, r5, { ...takeClue(j5, newRun(j5)), tier: 2 });
  j5.answer.forEach((v, i) => Object.keys(v).forEach(n => setKnob(j5, r5, i, n, v[n])));
  const d = finish(j5, r5);
  check(d && d.clues === r5.clues && d.stars <= CLUE_CAP[r5.clues], "a plate engraved after clues keeps them in its result and its stars under the cap");
  const j6 = makeJob(IX.dial, 11), r6 = newRun(j6), t6 = takeClue(j6, r6);
  check(j6.cuts.length === 2 && t6.text.startsWith(CUT_NAMES[2][t6.cut]), "on a dial with several cuts a clue says which cut it is about");
}


// ---------- registers ----------
{
  const reg = passes({ ...BARE, R: 0.5, k: 4, a: 3, at: [-0.4, 0.1], size: 0.3 })[0], plain = passes({ ...BARE, R: 0.5, k: 4, a: 3 })[0];
  check(Array.from({ length: 721 }, (_, i) => near_(reg[2 * i], -0.4 + 0.3 * plain[2 * i], 1e-5) && near_(reg[2 * i + 1], 0.1 + 0.3 * plain[2 * i + 1], 1e-5)).every(Boolean),
    "a register's pass is the same pass, scaled to the register's size and set at its centre");
  for (const l of LEVELS.filter(l => l.cuts.some(c => c.at))) {
    // the fullest each cut can be (every range at its top, and the lowest throw's inner edge for the rim): it must stay in its place
    const full = c => settingsOf(c, Object.fromEntries(c.free.map(n => [n, c.ranges[n][1]])));
    let inside = true, apart = true, rimOk = true;
    const regs = l.cuts.filter(c => c.at), rim = l.cuts.filter(c => !c.at).at(-1);        // the last cut with no place of its own is the rim
    for (const c of regs) {
      const s = full(c);
      for (const pts of passes(s)) for (let m = 0; m < pts.length; m += 2) if (Math.hypot(pts[m] - c.at[0], pts[m + 1] - c.at[1]) > c.size * 0.99 + 1e-6) inside = false;
      if (Math.hypot(...c.at) + c.size >= rim.R - (rim.ranges.a[1] + (rim.ranges.a2?.[1] || 0)) * 0.02) rimOk = false;
    }
    for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) if (Math.hypot(regs[i].at[0] - regs[j].at[0], regs[i].at[1] - regs[j].at[1]) < regs[i].size + regs[j].size) apart = false;
    check(inside && apart && rimOk, `${l.name}: every register's cut stays inside its own dial, the registers do not touch, and the rim clears them`);
    check(cutNames(LEVELS.indexOf(l)).length === l.cuts.length, `${l.name}: a name for every tab`);
  }
  const j9 = makeJob(IX.registers, 3), r9 = newRun(j9), c9 = takeClue(j9, r9);
  check(c9.text.startsWith(cutNames(IX.registers)[c9.cut]), "a clue on a face of registers names the register or rim it is about");
}

// ---------- lessons ----------
{
  check(LEVELS.every(l => LESSONS[l.id]), "every level has a lesson");
  for (const [i, l] of LEVELS.entries()) {
    const job = lessonJob(i), run = lessonRun(job), L = LESSONS[l.id];
    const knobsOk = L.start.length <= l.cuts.length && L.start.every((v, ci) => Object.entries(v).every(([n, x]) => l.cuts[ci].free.includes(n) && x === clampKnob(n, x)));
    check(knobsOk && job.answer === null && job.goal === null, `${l.name}: the lesson starts the machine on knobs of the level, with no target`);
    let walked = true, why = "";
    for (let s = 0; s < L.steps.length; s++) {
      const st = L.steps[s];
      const valid = st.cut < l.cuts.length && Object.entries(st.set).every(([n, x]) => l.cuts[st.cut].free.includes(n) && x === clampKnob(n, x));
      if (!valid) { walked = false; why = `step ${s + 1} sets a knob the cut doesn't have`; break; }
      if (stepDone(job, run)) { walked = false; why = `step ${s + 1} is done before it is asked`; break; }
      if (run.at !== st.cut) run.at = st.cut;
      for (const [n, x] of Object.entries(st.set)) setKnob(job, run, st.cut, n, x);
      if (!stepDone(job, run)) { walked = false; why = `step ${s + 1} is not done when its knobs are set`; break; }
      run.step++;
    }
    check(walked && run.step === L.steps.length && lessonStep(job, run) === undefined, `${l.name}: each lesson step starts undone and is done by setting its knobs${why ? ` (${why})` : ""}`);
    check(L.steps.every(st => st.do.length <= 110 && st.learn.length <= 130), `${l.name}: the lesson's words fit the two lines under the plate`);
  }
  const rose = lessonRun(lessonJob(IX.rose));
  check(rose.vals[0].k === 5 && rose.vals[0].a === 5 && rose.vals[0].n === 1 && rose.at === 0 && rose.step === 0, "a lesson begins on its first step with its start settings and the rest bare");
}

// ---------- the watch of each plate ----------
{
  const hex = x => /^#[0-9a-f]{6}$/i.test(x);
  check(LEVELS.every(l => WATCHES[l.id]) && Object.keys(WATCHES).length === LEVELS.length, "every plate has a watch, and every watch a plate");
  const ok = LEVELS.every(l => { const w = WATCHES[l.id]; return hex(w.dial.base) && hex(w.dial.ink) && FINISHES.includes(w.dial.finish) && METALS[w.case.metal] && (!w.case.body || METALS[w.case.body]) && BEZELS.includes(w.case.bezel) && HANDS.includes(w.hands.style) && METALS[w.hands.metal] && MARKS.includes(w.marks) && STRAPS.includes(w.strap.kind) && hex(w.strap.colour) && Object.values(METALS).every(m => hex(m.hex)); });
  check(ok, "each watch is made of parts the renderer knows: a finish, metals, a bezel, hands, markers and a strap, in valid colours");
  const dials = new Set(LEVELS.map(l => WATCHES[l.id].dial.base)), cases = new Set(LEVELS.map(l => `${WATCHES[l.id].case.metal}/${WATCHES[l.id].case.bezel}`)), names = new Set(LEVELS.map(l => WATCHES[l.id].name));
  check(dials.size === LEVELS.length && cases.size === LEVELS.length && names.size === LEVELS.length, "no two plates share a dial colour, a case (metal and bezel) or a name");
  check(new Set(LEVELS.map(l => WATCHES[l.id].case.metal)).size >= 5 && new Set(LEVELS.map(l => WATCHES[l.id].case.bezel)).size >= 5 && new Set(LEVELS.map(l => WATCHES[l.id].dial.finish)).size >= 3, "the range runs through several metals, bezels and dial finishes");
  check(luma("#000000") === 0 && Math.abs(luma("#ffffff") - 1) < 1e-9 && luma(WATCHES.master.dial.base) < 0.1 && luma(WATCHES.wave.dial.base) > 0.7, "luma tells a dark dial from a light one");
  check(LEVELS.every(l => { const d = WATCHES[l.id].dial; return Math.abs(luma(d.ink) - luma(d.base)) > 0.45; }), "a dial's printing is set against it (a light ink on a dark dial, a dark one on a light)");
  check(LEVELS.every(l => { const g = ghostOf(WATCHES[l.id].dial.base); return Math.abs(luma(g) - luma(WATCHES[l.id].dial.base)) > 0.3; }), "the target drawn over a dial stands out from it");
  check(watchOf("nothing") === WATCHES[LEVELS[0].id], "an unknown plate gets the first plate's watch");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("guilloche: a pass cut by a rosette, plates compared as pictures, fifteen levels from seeds with hidden settings, setting and undoing a knob, stars by taps against par");
