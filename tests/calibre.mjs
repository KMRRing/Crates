// Calibre: the engine's rules on their own, then every level: unsolved at the start, solved by its worked solution,
// and that solution built only from the level's tray; then the workings, and every lesson's pictures.
import { run, judge, startDesign, solved, partsUsed, radius, rateText, workings, inState } from "../calibre-engine.js";
import { LEVELS, CHAPTERS } from "../calibre-levels.js";
import { ALL_LESSONS, TEACHES } from "../calibre-lessons.js";
import { sceneDesign, motionOf, workAround } from "../calibre-scenes.js";
import { buildTest, isRight, missedTap, readNumbers, rightAnswer, seeded, wordsOf, QUIZ } from "../calibre-quiz.js";
import { GLOSSARY } from "../calibre-levels.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log("FAIL", what); } };
const W = (teeth, layer = 1) => ({ kind: "wheel", teeth, layer });

// two wheels: the driven turns faster by the ratio of teeth, the other way
let r = run({ plate: 10, arbors: [{ id: "a", x: 0, y: 0, drive: 60, parts: [W(60)] }, { id: "b", x: radius(60) + radius(30), y: 0, parts: [W(30)] }] });
check(r.rates.b === -120 && r.meshes.length === 1, `a 60 drives a 30 at twice its speed, the other way (got ${r.rates.b})`);
// a triangle of meshes locks
const s = 4;
r = run({ plate: 10, arbors: [{ id: "a", x: 0, y: 0, drive: 60, parts: [W(40)] }, { id: "b", x: s, y: 0, parts: [W(40)] }, { id: "c", x: s / 2, y: s * Math.sqrt(3) / 2, parts: [W(40)] }] });
check(r.jammed.length === 3 && r.rates.b === 0, "three wheels meshing in a triangle lock");
// a wheel over another arbor's pivot clashes; a wheel off the plate clashes
r = run({ plate: 10, arbors: [{ id: "a", x: 0, y: 0, parts: [W(60)] }, { id: "post", x: 1, y: 0, parts: [] }] });
check(r.clashes.some(c => c.kind === "pivot"), "a wheel can't cover another arbor's pivot");
r = run({ plate: 3, arbors: [{ id: "a", x: 0, y: 0, parts: [W(80)] }] });
check(r.clashes.some(c => c.kind === "outside"), "a wheel can't stick out of the plate");
// the escapement: no fork and the spring runs away; a fork alone locks; fork and balance in line, and the beat sets the pace
const ex = radius(40) + radius(10);
const train = extra => ({ plate: 12, arbors: [{ id: "barrel", x: 0, y: 0, power: -1, parts: [W(40)] }, { id: "esc", x: ex, y: 0, parts: [{ kind: "pinion", teeth: 10, layer: 1 }, { kind: "escape", teeth: 15, layer: 9 }] }, ...extra] });
const fork = { id: "fork", x: ex + 2, y: 0, parts: [{ kind: "fork", layer: 9 }] }, bal = { id: "bal", x: ex + 4.8, y: 0, parts: [{ kind: "balance", vph: 18000, layer: 10 }] };
check(run(train([])).runaway, "an escape wheel with no pallet fork runs away");
check(run(train([fork])).locked, "a pallet fork with no balance locks the train");
r = run(train([fork, bal]));
check(Math.abs(Math.abs(r.rates.esc) - 600) < 1e-9, `fork and balance in line: a 15-tooth escape wheel at 18,000 vph turns 600 times an hour (got ${r.rates.esc})`);
check(run(train([fork, { ...bal, y: 2.8, x: ex + 2 }])).escapements[0].state === "locked", "a balance out of line with the fork doesn't engage it");
r = run({ plate: 10, arbors: [{ id: "barrel", x: 0, y: 0, power: -1, parts: [W(40)] }] });
check(r.runaway, "a barrel with no escapement runs away");
check(rateText(60) === "1 a minute, clockwise" && rateText(-1) === "1 an hour, anticlockwise" && rateText(1 / 12) === "once every 12 hours, clockwise", `rates read naturally (${rateText(1 / 12)})`);

// every level
const ids = new Set();
for (const L of LEVELS) {
  check(!ids.has(L.id), `${L.id}: a unique id`); ids.add(L.id);
  check(CHAPTERS.some(c => c.id === L.chapter), `${L.id}: its chapter exists`);
  check(L.primer?.length && L.task && L.goals?.length && L.par >= 0, `${L.id}: a primer, a task, goals and a par`);
  const start = judge(L, startDesign(L));
  check(!start.ok, `${L.id} "${L.title}": not already solved at the start`);
  const end = judge(L, solved(L));
  check(end.ok, `${L.id} "${L.title}": its solution works (${end.problems.join(" ")} ${end.goals.filter(g => !g.ok).map(g => `${g.goal.arbor} ${g.actual}`).join(", ")})`);
  // the solution uses only what the tray holds
  const need = {};
  for (const a of L.solution.add || []) { const k = `${a.part.kind}:${a.part.teeth ?? a.part.vph}`; need[k] = (need[k] || 0) + 1; }
  for (const [k, n] of Object.entries(need)) {
    const [kind, v] = k.split(":"), have = L.tray.filter(t => t.kind === kind && String(t.teeth ?? t.vph) === v).reduce((m, t) => m + t.n, 0);
    check(have >= n, `${L.id}: the tray holds ${n} × ${k} (has ${have})`);
  }
  check(partsUsed(solved(L)) <= L.par, `${L.id}: the solution makes par (${partsUsed(solved(L))} parts, par ${L.par})`);
}
// the workings: a path from the power, step by step, whose ratios multiply to the train's, through a reverser's clutch too
{
  const L = LEVELS.find(l => l.id === "2.2"), d = solved(L), out = run(d), path = workings(d, out, "seconds");
  check(path?.length === 3 && Math.abs(path.reduce((m, st) => m * st.k, 1) - out.rates.seconds / out.rates.barrel) < 1e-9, "the workings' ratios multiply to the train's, barrel to seconds");
  check(workings(d, out, "barrel")?.length === 0, "the workings of the power itself are an empty path");
  const R = LEVELS.find(l => l.id === "10.1"), [ccw, cw] = R.scenarios.map(sc => inState(solved(R), sc));
  const wound = workings(ccw, run(ccw), "ratchet");
  check(wound?.some(st => st.clutch) && wound.at(-1).to === "ratchet", "the workings follow a reverser's one-way clutch to the ratchet");
  check(workings(cw, run(cw), "ratchet") === null, "turned the other way the clutch slips, and nothing drives the ratchet");
}

// every lesson: a line for the course, its steps ending in the task, each step's picture built from parts it holds
// (names, focus and isolation all on them), never the level's own solution or a later one's, moving no faster than
// two turns a second, and its line under the picture counting something that turns
let steps = 0;
for (const { L, steps: lesson } of ALL_LESSONS()) {
  check(TEACHES[L.id], `${L.id}: the course says what it teaches`);
  check(lesson.length >= 2 && lesson.at(-1).task && lesson.slice(0, -1).every(st => st.say && !st.task), `${L.id}: a lesson of steps, the task last`);
  check(workAround(L, false).length && workAround(L, true).length, `${L.id}: its course picture is framed on where its work happens`);
  lesson.forEach((st, i) => {
    const what = `${L.id} lesson step ${i + 1}`, sc = st.scene;
    steps++;
    let built;
    try { built = sceneDesign(sc, L); } catch (e) { check(false, `${what}: its picture builds (${e.message})`); return; }
    const ids = new Set(built.design.arbors.map(a => a.id)), out = run(built.design);
    for (const id of [...Object.keys(sc.labels || {}), ...(sc.focus || []), ...(sc.only || []), ...(sc.lit ? [sc.lit.a, sc.lit.b] : [])]) check(ids.has(id), `${what}: names ${id}, which its picture holds`);
    if (sc.solved) check(LEVELS.findIndex(l => l.id === sc.from) < LEVELS.indexOf(L), `${what}: shows an earlier level's solution, not ${sc.from}'s`);
    if (sc.state) check(built.level.scenarios?.some(x => x.id === sc.state), `${what}: its state ${sc.state} exists`);
    const { motion, speed, esc } = motionOf(sc, out);
    if (motion === "geared") { const top = Math.max(0, ...Object.values(out.rates).filter(Boolean).map(Math.abs)) * speed / 3600; check(top > 0 && top <= 2.01, `${what}: turns, no faster than two turns a second (${top.toFixed(2)})`); }
    if (["running", "locked"].includes(motion)) check(!!esc, `${what}: ${motion} with an escapement to show`);
    if (motion === "runaway") check(built.design.arbors.some(a => a.power != null) && out.relative, `${what}: runs away with a barrel to let go`);
    if (sc.show === "turns" || sc.show === "rates") check(Object.keys(sc.labels || {}).some(id => out.rates[id]), `${what}: its line counts something that turns`);
  });
}
// the tests after each level. A choice mustn't give itself away (as tests/banks.mjs holds the subject banks to): the right
// option not clearly the longest, nor the only one with a figure, unless every option is a name
const figure = s => /[=≥≤≈×÷√±]|\d/.test(s), nameLike = s => /^(the )?[A-Z0-9]/.test(s) && !/[:;]/.test(s) && s.split(/\s+/).length <= 6;
function givesAway(q) {
  const right = q.options[q.answer], wrong = q.options.filter((_, i) => i !== q.answer);
  if (q.options.every(nameLike)) return false;
  const longest = right.length > Math.max(...wrong.map(w => w.length)) && right.length >= 1.5 * (wrong.reduce((t, w) => t + w.length, 0) / wrong.length) && right.length - Math.max(...wrong.map(w => w.length)) >= 8;
  return longest || (q.options.length >= 3 && figure(right) && wrong.every(w => !figure(w)));
}
check(readNumbers("7,5").includes(7.5) && readNumbers("18,000").includes(18000) && readNumbers(" 4.25 ").includes(4.25) && !readNumbers("").length, "a typed number reads the English and the European way");
for (const [term, def] of GLOSSARY) check(!new RegExp(`\\b${term.toLowerCase().replace(/[-]/g, "[- ]?")}s?\\b`, "i").test(def), `the glossary's ${term} doesn't say its own word`);
let questions = 0;
const kinds = {};
for (const L of LEVELS) {
  check(wordsOf(L).length, `${L.id}: its test has words to ask`);
  for (const seed of [1, 2, 3]) {
    const qs = buildTest(L, solved(L), seeded(seed));
    check(qs.length >= 5 && qs.length <= 11, `${L.id}: a test of five to eleven questions (${qs.length})`);
    qs.forEach((q, i) => {
      const what = `${L.id} test ${seed} question ${i + 1} (${q.kind})`;
      questions++; kinds[q.kind] = (kinds[q.kind] || 0) + 1;
      // a tap has nothing to explain when its part has no glossary meaning: the rings and names on the picture say it
      check(q.ask && (q.explain || q.kind === "tap"), `${what}: asks something and explains it`);
      if (q.scene) { try { const { design } = sceneDesign(q.scene, L), ids = new Set(design.arbors.map(a => a.id)); for (const id of [...Object.keys(q.scene.labels || {}), ...(q.scene.focus || []), q.scene.ring?.id].filter(Boolean)) check(ids.has(id), `${what}: its picture holds ${id}`); } catch (e) { check(false, `${what}: its picture builds (${e.message})`); } }
      if (q.kind === "choice") {
        check(q.options.length >= 2 && new Set(q.options).size === q.options.length && q.options[q.answer] === q.right, `${what}: distinct options, the right one among them`);
        check(isRight(q, q.answer) && !isRight(q, (q.answer + 1) % q.options.length), `${what}: right is right, wrong is wrong`);
        check(!givesAway(q), `${what}: the right option doesn't give itself away (${q.options.join(" | ")})`);
      } else if (q.kind === "number") {
        check(Number.isFinite(q.answer) && q.answer > 0, `${what}: a positive answer (${q.answer})`);
        check(isRight(q, String(q.answer)) && isRight(q, String(q.answer).replace(".", ",")) && !isRight(q, String(q.answer + 1)), `${what}: ${q.answer} is right, typed either way, and ${q.answer + 1} isn't`);
      } else if (q.kind === "word") {
        check(isRight(q, q.answer) && isRight(q, ` The ${q.answer.toUpperCase()} `) && !isRight(q, "mainspring regulator"), `${what}: the word is right however it's typed, another isn't`);
      } else if (q.kind === "tap") {
        const { design } = sceneDesign(q.scene, L);
        check(q.answer.every(id => design.arbors.some(a => a.id === id)) && q.answerName, `${what}: the part to tap is on the picture, and named`);
        const other = design.arbors.find(a => !q.answer.includes(a.id)), said = other && missedTap(q, other.id).toLowerCase();
        check(isRight(q, q.answer[0]) && !isRight(q, other?.id), `${what}: the part is right, another isn't`);
        check(design.arbors.every(a => q.names?.[a.id]) && said.includes(q.names[other.id].toLowerCase()) && said.includes(q.answerName), `${what}: a wrong tap is told what it hit and where the right one is (${said})`);
      } else if (q.kind === "order") {
        check(q.items.length >= 3 && new Set(q.items).size === q.items.length && q.options.some((x, j) => x !== q.items[j]), `${what}: three or more names, dealt out of order`);
        check(isRight(q, [...q.items]) && !isRight(q, [...q.items].reverse()), `${what}: the train's order is right, backwards isn't`);
      } else check(false, `${what}: a kind of question the game asks`);
      check(rightAnswer(q) !== "", `${what}: its right answer can be said`);
    });
  }
}
check(Object.keys(kinds).length === 5, `every kind of question is asked somewhere (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")})`);
check(LEVELS.every(L => (QUIZ[L.id] || []).length >= 2), "every level has questions of its own");
// a test is on what you made: 2.3 built the other way round from its worked solution (80 into 8, then 72 into 12, where
// the solution has 72 into 12, then 80 into 8) is asked about its own counts, and its arbor is named for what it is
{
  const L = LEVELS.find(l => l.id === "2.3"), d = startDesign(L), centre = d.arbors.find(a => a.id === "centre"), secs = d.arbors.find(a => a.id === "seconds");
  const r1 = radius(80) + radius(8), r2 = radius(72) + radius(12), dx = secs.x - centre.x, dy = secs.y - centre.y, D = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + D * D) / (2 * D), h = Math.sqrt(r1 * r1 - a * a), third = { x: centre.x + (a * dx) / D + (h * dy) / D, y: centre.y + (a * dy) / D - (h * dx) / D };
  centre.parts.push({ kind: "wheel", teeth: 80, layer: 2 });
  secs.parts.push({ kind: "pinion", teeth: 12, layer: 3 });
  d.arbors.push({ id: "x1", ...third, parts: [{ kind: "pinion", teeth: 8, layer: 2 }, { kind: "wheel", teeth: 72, layer: 3 }] });
  check(judge(L, d).ok, "2.3 solved the other way round: 80 into 8, then 72 into 12");
  const qs = [1, 2, 3, 4, 5, 6, 7, 8].flatMap(seed => buildTest(L, d, seeded(seed))), ratios = qs.filter(q => q.topic === "ratio");
  check(ratios.length && ratios.every(q => (/^The centre wheel, of 80 teeth, drives the third pinion, of 8 leaves/.test(q.ask) && q.answer === 10) || (/^The third wheel, of 72 teeth, drives the fourth pinion, of 12 leaves/.test(q.ask) && q.answer === 6)),
    `its test asks its own counts: 80 into 8 is 10, 72 into 12 is 6 (${ratios.map(q => `${q.ask.slice(0, 40)}… ${q.answer}`).join("; ")})`);
}
console.log(`calibre: ${LEVELS.length} levels in ${CHAPTERS.length} chapters, every one solvable; ${steps} lesson steps; ${questions} test questions in three deals of every level${bad ? `; ${bad} problems` : ""}`);
if (bad) process.exitCode = 1;
