// Traverse's Atlas play (landfall-atlas-engine.js) on the real packs: three true bearings fix a start to within metres, a perfect
// play earns three stars and every name right, a wrong name is caught, a compass error moves the fix the way it should, and
// same-named summits are told apart. Skips quietly where no pack is built yet.
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { grid, terrain, decode, distanceBearing } from "../landfall-terrain.js";
import { newPlay, takeBearing, crossing, mark, finish, compassOf, starsFor } from "../landfall-atlas-engine.js";
import { tellApart } from "../landfall-atlas-pack.js";

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
if (bad) { console.log(`${bad} failed`); process.exit(1); }
