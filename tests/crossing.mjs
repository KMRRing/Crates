// Crossing (land): the graph is symmetric and the big piece of land holds Eurasia, Africa and the Americas; known borders
// are there (and known non-borders aren't); shortest crossings are as short as they can be and each step is a border; a run
// deals five routes of the level's length, no country twice, the same for a seed; a route in play steps, errs, backs up,
// arrives and scores as the rules say (crossing-engine.js).
// Run: node tests/crossing.mjs
const E = await import("../crossing-engine.js");
const { COUNTRIES } = await import("../chart-countries.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };

// ---------- the graph ----------
check(COUNTRIES.every(c => E.neighbours(c.name).every(n => E.touches(n, c.name))), "borders run both ways");
check(E.LAND.length >= 140, `a big piece of land (${E.LAND.length} countries)`);
for (const [a, b] of [["France", "Spain"], ["Germany", "Poland"], ["Egypt", "Israel"], ["Panama", "Colombia"], ["Canada", "United States of America"]]) {
  if (E.countryOf(a) && E.countryOf(b)) check(E.touches(a, b), `${a} borders ${b}`);
}
check(!E.touches("France", "Germany") === !E.countryOf("Germany") || E.touches("France", "Germany"), "France and Germany: whatever the source says, only if both are there");
check(!E.touches("Portugal", "France"), "Portugal doesn't border France");
for (const island of ["Japan", "Australia", "Iceland", "Madagascar", "New Zealand"]) check(!E.countryOf(island) || !E.onLand(island), `${island} is not on the land game's land`);
check(E.onLand("Portugal") && E.onLand("South Africa") && E.onLand("Mongolia") && E.onLand("Canada") && E.onLand("Chile"), "Portugal, South Africa, Mongolia, Canada and Chile are all on it");

// ---------- shortest crossings ----------
check(E.parOf("Portugal", "France") === 2, `Portugal to France crosses two borders (${E.parOf("Portugal", "France")})`);
check(E.parOf("France", "France") === 0, "no border from a country to itself");
let walked = 0;
for (const a of E.LAND.filter((_, i) => i % 7 === 0)) for (const b of E.LAND.filter((_, i) => i % 11 === 0)) {
  const path = E.shortest(a, b);
  check(path && path[0] === a && path.at(-1) === b && path.length - 1 === E.parOf(a, b) && path.every((c, i) => !i || E.touches(path[i - 1], c)), `the shortest crossing ${a} to ${b} is a chain of borders as long as par`);
  check(E.parOf(a, b) === E.parOf(b, a), `par is the same each way (${a}, ${b})`);
  walked++;
}
check(walked > 100, `${walked} pairs checked`);
check(E.shortest("Portugal", "Japan") === null || !E.countryOf("Japan"), "no land route to an island");

// ---------- a run ----------
for (const level of E.LEVELS) for (const seed of [1, 2, 3, 99, 12345]) {
  const run = E.dealRun(seed, level), [lo, hi] = E.PAR_RANGE[level], names = run.routes.flatMap(r => [r.from, r.to]);
  check(run.routes.length === E.ROUTES, `${level} ${seed}: ${E.ROUTES} routes (${run.routes.length})`);
  check(new Set(names).size === names.length, `${level} ${seed}: no country twice`);
  check(run.routes.every(r => r.par >= lo && r.par <= hi && E.parOf(r.from, r.to) === r.par), `${level} ${seed}: each route's par is true and in ${lo}-${hi}`);
  check(JSON.stringify(run) === JSON.stringify(E.dealRun(seed, level)), `${level} ${seed}: the same seed deals the same run`);
}
check(JSON.stringify(E.dealRun(1)) !== JSON.stringify(E.dealRun(2)), "another seed deals another run");

// ---------- a route in play ----------
const r0 = E.begin({ from: "Portugal", to: "France", par: 2 });
check(E.here(r0) === "Portugal" && E.crossed(r0) === 0, "a route begins at its start");
let r = E.cross(r0, "France");
check(r.note === "mistake" && r.mistakes === 1 && E.here(r) === "Portugal", "Portugal doesn't touch France: a mistake, you stay");
r = E.cross(r, "Portugal");
check(r.note === "again" && r.mistakes === 1, "tapping where you stand is nothing");
r = E.cross(r, "Spain");
check(r.note === "step" && E.here(r) === "Spain" && E.crossed(r) === 1, "Portugal to Spain is a step");
check(E.back(E.back(r)).path.join() === "Portugal" && E.back(r0) === r0, "back goes a step, and not past the start");
r = E.cross(r, "France");
check(r.note === "arrived" && r.over && E.crossed(r) === 2, "Spain to France arrives");
check(E.cross(r, "Spain").note === "closed", "a finished route takes no more");
check(E.scoreOf(r) === 100 - 8 && !E.clean(r), `par with one mistake scores 92 (${E.scoreOf(r)})`);
let c = E.cross(E.cross(E.begin({ from: "Portugal", to: "France", par: 2 }), "Spain"), "France");
check(E.scoreOf(c) === 100 && E.clean(c), "par, no mistake: 100, clean");
let long = E.begin({ from: "Germany", to: "Poland", par: 1 });
for (const n of ["Czech Republic", "Poland"]) long = E.cross(long, n);
check(E.scoreOf(long) === 100 - 15, "a border beyond par is 15 off");
check(E.scoreOf(E.giveUp(E.begin({ from: "Portugal", to: "France", par: 2 }))) === 0, "a route given up scores nothing");
check(E.totalOf([c, long, E.begin({ from: "Chile", to: "Peru", par: 1 })]) === 100 + 85, "a run's total adds the routes' scores; an unfinished one counts nothing");

console.log(bad ? `crossing: ${bad} problems` : `crossing: ${E.LAND.length} countries on land, ${walked} shortest crossings checked, runs dealt at every level, a route played through`);
if (bad) process.exitCode = 1;
