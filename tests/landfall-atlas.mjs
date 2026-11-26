// Traverse's Atlas play (landfall-atlas-engine.js) on the real packs: three true bearings fix a start to within metres, a perfect
// play earns three stars and every name right, a wrong name is caught, a compass error moves the fix the way it should, and
// same-named summits are told apart. Skips quietly where no pack is built yet.
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { grid, terrain, decode, distanceBearing } from "../landfall-terrain.js";
import { newPlay, takeBearing, crossing, mark, finish, compassOf, starsFor } from "../landfall-atlas-engine.js";
import { tellApart } from "../landfall-atlas-pack.js";
import { blank, learn, areaState, peakState, tested, dayNumber, sideOf, TEST } from "../landfall-atlas-mastery.js";
import { LESSONS } from "../landfall-atlas-lessons.js";
import { seesNow } from "../landfall-atlas-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(starsFor(150) === 3 && starsFor(450) === 2 && starsFor(900) === 1 && starsFor(1500) === 0, "stars: 200 m, 500 m and a kilometre");
const twins = tellApart([{ name: "Breithorn", ele: 3780 }, { name: "Breithorn", ele: 3785, listed: 3785 }, { name: "Eiger", ele: 3967 }]);
check(twins[0].name === "Breithorn (3780 m)" && twins[1].name === "Breithorn (3785 m)" && twins[2].name === "Eiger", "two summits of one name are told apart by height");

const dir = new URL("../landfall-atlas/alps/", import.meta.url);
if (!existsSync(new URL("bernese.json", dir))) console.log("ok   no Alps pack built yet");
else {
  const P = JSON.parse(readFileSync(new URL("bernese.json", dir)));
  const load = (k, G) => grid([G.w, G.s, G.e, G.n], G.cols, G.rows, decode(gunzipSync(readFileSync(new URL(`bernese.${k}.bin.gz`, dir))), G.cols, G.rows));
  const pack = { ...P, region: "alps", at: terrain([Object.assign(load("fine", P.fine), { fine: true }), load("far", P.far)]) };
  const trueB = (s, i) => distanceBearing(s.lat, s.lon, pack.landmarks[i].lat, pack.landmarks[i].lon).b;
  // the three landmarks a start sees that are spread widest round the compass
  const spread = s => { const bs = s.sees.map(i => [i, trueB(s, i)]).sort((a, b) => a[1] - b[1]); return [bs[0][0], bs[Math.floor(bs.length / 3)][0], bs[Math.floor(2 * bs.length / 3)][0]]; };
  let worst = 0, perfect = true, play = null;
  for (let k = 0; k < Math.min(10, pack.starts.length); k++) {
    play = { ...newPlay(pack, { seed: k + 1, level: "easy" }), start: k };
    const s = pack.starts[k];
    for (const i of spread(s)) play = takeBearing(play, compassOf(play, trueB(s, i)), i);
    const c = crossing(pack, play.bearings);
    worst = Math.max(worst, distanceBearing(s.lat, s.lon, c.lat, c.lon).d);
    const done = finish(pack, mark(play, c.lat, c.lon));
    perfect &&= done.stars === 3 && done.named.every(n => n.right);
  }
  // readings are kept to a tenth of a degree, which on a peak 100 km off is 90 m either way: no closer than that is asked
  check(worst < 150, `three true bearings fix each of 10 Bernese starts to within 150 m (worst ${Math.round(worst)} m)`);
  check(perfect, "a perfect play earns three stars and every landmark named right");
  const s = pack.starts[0], seen = s.sees[0], other = pack.landmarks.findIndex((l, i) => i !== seen && Math.abs(((trueB(s, i) - trueB(s, seen) + 540) % 360) - 180) > 20);
  const wrong = finish(pack, mark(takeBearing({ ...newPlay(pack, { level: "easy" }), start: 0 }, trueB(s, seen), other), s.lat, s.lon));
  check(!wrong.named[0].right, "naming a summit 20 degrees off the line is caught");
  // a compass that reads half a degree low turns every line by as much: the fix moves, by about the distance times the angle
  let dev = { ...newPlay(pack, { seed: 3, level: "hard" }), start: 0, deviation: 0.5 };
  for (const i of spread(s)) dev = takeBearing(dev, compassOf(dev, trueB(s, i)), i);
  const cd = crossing(pack, dev.bearings), moved = distanceBearing(s.lat, s.lon, cd.lat, cd.lon).d;
  check(moved > 50 && moved < 2000, `a half-degree compass error moves the fix ${Math.round(moved)} m`);
  check([1, 2, 3, 4, 5, 6, 7, 8].every(seed => Math.abs(newPlay(pack, { seed, level: "hard" }).deviation) <= 0.5 && newPlay(pack, { seed, level: "medium" }).deviation === 0), "only Hard has a compass error, of half a degree at most");
}
// the master test: five fixes of two stars or more in a row; a miss starts it again; once passed it stays passed
let T = blank();
for (const st of [3, 2, 1, 2, 2, 3, 2]) T = tested(T, "alps", st);
check(!T.tests.alps.passed && T.tests.alps.streak === 5 - 1, "a one-star fix in the master test starts the streak again");
T = tested(T, "alps", 2);
check(T.tests.alps.passed && tested(T, "alps", 0).tests.alps.passed, `${TEST} in a row pass the master test, for good`);
check(dayNumber(20261127) - dayNumber(20261126) === 1 && dayNumber(20270101) - dayNumber(20261231) === 1, "day numbers count days across a month and a year");

if (existsSync(new URL("bernese.json", dir))) {
  const P = JSON.parse(readFileSync(new URL("bernese.json", dir)));
  const load = (k, G) => grid([G.w, G.s, G.e, G.n], G.cols, G.rows, decode(gunzipSync(readFileSync(new URL(`bernese.${k}.bin.gz`, dir))), G.cols, G.rows));
  const pack = { ...P, region: "alps", area: "bernese", at: terrain([Object.assign(load("fine", P.fine), { fine: true }), load("far", P.far)]) };
  const s = pack.starts[0], i = s.sees[0], l = pack.landmarks[i], tb = distanceBearing(s.lat, s.lon, l.lat, l.lon).b, d0 = dayNumber(20261127);
  // named right: a side gained, rest one day, then two; named wrong: due again today
  let play = finish(pack, mark(takeBearing({ ...newPlay(pack, { level: "easy" }), start: 0 }, tb, i), s.lat, s.lon));
  let K = learn(blank(), pack, play, d0);
  const k1 = K.peaks[`alps/bernese/${l.id}`];
  check(k1.s === 1 << sideOf(l, s) && k1.gap === 1 && k1.due === d0 + 1, "a summit named right gains the side it was seen from, and is due again tomorrow");
  K = learn(K, pack, play, d0 + 1);
  check(K.peaks[`alps/bernese/${l.id}`].gap === 2 && K.fixes["alps/bernese"] === 2, "named right again, it rests two days; each fix of two stars counts toward the area");
  const other = pack.landmarks.findIndex((x, j) => j !== i && Math.abs(((distanceBearing(s.lat, s.lon, x.lat, x.lon).b - tb + 540) % 360) - 180) > 20);
  const wrong = finish(pack, mark(takeBearing({ ...newPlay(pack, { level: "easy" }), start: 0 }, tb, other), s.lat, s.lon));
  K = learn(K, pack, wrong, d0 + 2);
  check(K.peaks[`alps/bernese/${l.id}`].due === d0 + 2 && peakState(K, pack, i, d0 + 2).due, "the summit really on the line, named wrong, is due again today");
  const A = areaState(K, pack, d0);
  check(A.of > 20 && A.known < A.of && !A.mastered, `an area is ${A.of} summits to know, and isn't mastered after a few fixes`);
}

// every lesson's start is in its pack and sees the summits the lesson names, and enough under its cloud to fix on
const lessonBad = [];
for (const L of LESSONS) {
  const f = new URL(`../landfall-atlas/${L.region}/${L.area}.json`, import.meta.url);
  if (!existsSync(f)) continue;
  const P = JSON.parse(readFileSync(f)), i = P.starts.findIndex(s => s.id === L.start);
  if (i < 0) { lessonBad.push(`${L.id}: no start ${L.start || "(none given)"}`); continue; }
  const sees = seesNow(P, { start: i, cloud: L.cloud || 0 }).map(j => P.landmarks[j].name);
  for (const n of L.sees) if (!sees.includes(n)) lessonBad.push(`${L.id}: ${n} not in sight`);
  if (sees.length < (L.alti ? 2 : 3)) lessonBad.push(`${L.id}: only ${sees.length} summits in sight`);
}
check(!lessonBad.length, `every lesson's start sees what it asks for${lessonBad.length ? `: ${lessonBad.join("; ")}` : ""}`);

if (bad) { console.log(`${bad} failed`); process.exit(1); }
