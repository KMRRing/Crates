// Calibre: the engine's rules on their own, then every level: unsolved at the start, solved by its worked solution,
// and that solution built only from the level's tray.
import { run, judge, startDesign, solved, partsUsed, radius, rateText } from "../calibre-engine.js";
import { LEVELS, CHAPTERS } from "../calibre-levels.js";

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
console.log(`calibre: ${LEVELS.length} levels in ${CHAPTERS.length} chapters, every one solvable${bad ? `; ${bad} problems` : ""}`);
if (bad) process.exitCode = 1;
