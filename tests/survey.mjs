const S = await import("../survey-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const touching = (a, b) => a.some(([x, y]) => b.some(([u, v]) => Math.abs(x - u) <= 1 && Math.abs(y - v) <= 1));
let problems = 0, total = 0;
for (const sizeId of Object.keys(S.SIZES)) for (let seed = 1; seed <= 40; seed++) {
  const c = S.makeConcession(seed, sizeId), again = S.makeConcession(seed, sizeId);
  total++;
  if ([...c.ore].join() !== [...again.ore].join()) { problems++; console.log("not repeatable"); }
  if (c.bodies.length !== S.SIZES[sizeId].bodies || c.bodies.some(b => b.length < 2 || b.length > 3)) { problems++; console.log("bodies wrong", sizeId, seed); }
  for (let i = 0; i < c.bodies.length; i++) for (let j = i + 1; j < c.bodies.length; j++) if (touching(c.bodies[i], c.bodies[j])) { problems++; console.log("bodies touch", sizeId, seed); }
  // every body is connected
  for (const b of c.bodies) { const ok = b.every(([x, y], i) => i === 0 || b.slice(0, i).some(([u, v]) => Math.abs(x - u) + Math.abs(y - v) === 1)); if (!ok) { problems++; console.log("a body isn't connected"); } }
  // readings add up: all rows sum to the ore count, and a drill on an ore cell says 1
  const rows = Array.from({ length: c.n }, (_, y) => S.read(c, "line", "row", y)).reduce((t, v) => t + v, 0);
  if (rows !== c.ore.size) { problems++; console.log("rows don't sum"); }
  const [x, y] = c.bodies[0][0];
  if (S.read(c, "drill", x, y) !== 1 || S.read(c, "magnet", x, y) < 2) { problems++; console.log("drill/magnet wrong"); }
}
check(problems === 0, `${total} concessions: repeatable, the right number of 2–3-cell bodies, connected, never touching, readings add up`);
// a run: probing costs credits, a wrong claim costs 10, the right one ends it; the brute-force way (drill everything) can't afford to finish
{
  const c = S.makeConcession(3, "small"), run = S.newRun(c);
  const v = S.probe(c, run, "line", "row", 0);
  check(v === S.read(c, "line", "row", 0) && run.credits === c.budget - 2 && S.probe(c, run, "line", "row", 0) === null, "a line costs 2 and can't be bought twice");
  S.probe(c, run, "magnet", 2, 2); S.probe(c, run, "drill", 0, 0);
  check(run.credits === c.budget - 10, "a magnetometer costs 3, a drill 5");
  run.ore = new Set(["0,0"]);
  check(S.claim(c, run) === false && run.credits === c.budget - 20 && !run.done, "a wrong claim costs 10 and the run goes on");
  run.ore = new Set(c.ore);
  check(S.claim(c, run) === true && run.done, "the right claim ends the run");
}
// readings pin layouts down: all rows plus all columns of a small board leave few layouts; adding drills leaves one
{
  const c = S.makeConcession(11, "small"), readings = [];
  for (let i = 0; i < c.n; i++) { readings.push({ tool: "line", a: "row", b: i, value: S.read(c, "line", "row", i) }); readings.push({ tool: "line", a: "col", b: i, value: S.read(c, "line", "col", i) }); }
  const some = S.layoutsConsistent(c, readings, 500);
  for (const k of c.ore) { const [x, y] = k.split(",").map(Number); readings.push({ tool: "drill", a: x, b: y, value: 1 }); }
  const one = S.layoutsConsistent(c, readings, 500);
  check(some.length >= 1 && some.some(l => [...l].every(k => c.ore.has(k))) && one.length === 1, `rows and columns leave ${some.length} layouts on a 5×5; drilling the ore leaves 1`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
