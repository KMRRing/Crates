// Landfall's land (landfall-land.js and the engine's "landmark"): a summit rises out of the sea as the ship closes it and shows from
// as far as its height allows, the skyline is the summits' shapes at their bearings, the coastal views tell the shapes apart, and a
// summit named is a line through it, one taken for another a line through the wrong one. Run: node tests/landfall-land.mjs
import { LEVELS } from "../landfall-levels.js";
import { hillLook, inRange, dropAt, skyline, AZS, SHAPES, viewOf } from "../landfall-land.js";
import { newVoyage, apply, moves, levelOf } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const hill = { name: "Test", x: 0, y: 0, h: 400, w: 4, shape: "flat" };

check(Math.abs(dropAt(20) - 92) < 3 && inRange(400, 40) && !inRange(400, 50) && inRange(100, 22) && !inRange(100, 26), "the earth's curve hides the foot of the land, and a summit shows from 2.08 (√h + √e) miles");
{
  const alts = [40, 30, 20, 10].map(d => hillLook(hill, [-d, 0]).alt);
  check(alts.every((a, i) => i === 0 || a > alts[i - 1]) && hillLook(hill, [-10, 0]).az === 90, `the land rises as she closes it (${alts.map(a => a.toFixed(2)).join(", ")} degrees at 40, 30, 20, 10 miles), at its bearing`);
}
{
  const L = { hills: [hill, { ...hill, name: "Peak", y: 20, shape: "peak", h: 600 }] }, line = skyline(L, [-15, 0], AZS);
  const at = az => line[Math.round(az * 2) % 720];
  check(at(90).who === 0 && at(90).alt > 1 && at(270).alt === 0 && line.filter(s => s.who === 1).length > 0, "the skyline stands at the summits' bearings and nowhere else, each part owned by its summit");
}
{
  const shapes = Object.keys(SHAPES), sig = shapes.map(sh => viewOf({ ...hill, shape: sh }, 24).map(v => Math.round(v * 4)).join(","));
  check(new Set(sig).size === shapes.length, `every shape of the views is drawn differently (${shapes.join(", ")})`);
}
const HILLED = LEVELS.filter(L => L.hills);
check(HILLED.length >= 3 && HILLED.every(L => L.section === 12), `the land has its own chapter (${HILLED.map(L => L.name).join(", ")})`);
for (const L of HILLED) check(new Set(L.hills.map(h => h.shape)).size === L.hills.length && L.hills.every(h => h.h >= 300), `${L.name}: no two of its summits share a shape`);

// naming a summit in play
{
  let right = 0, through = 0, tried = 0, once = true, sawEarly = 0;
  for (let seed = 1; seed <= 60 && tried < 12; seed++) {
    const S = newVoyage("landfall", seed), L = levelOf(S);
    for (let i = 0; i < 30 && S.phase !== "end" && !(S.phase === "find" && S.watch.hills?.some(h => h.seen)); i++) {
      if (S.phase === "ritual") apply(S, { t: "step", d: S.leg.run });
      else if (S.phase === "find") apply(S, { t: "skipsight" });
      else apply(S, { t: "sail", course: (Math.atan2(L.harbour.x - S.T[0], L.harbour.y - S.T[1]) * 180 / Math.PI + 360) % 360 });
    }
    if (S.phase !== "find") continue;
    tried++;
    const at = S.watch.hills.findIndex(h => h.seen), other = (at + 1) % L.hills.length, twin = structuredClone(S);
    const r = apply(S, { t: "landmark", at, as: at }), w = apply(twin, { t: "landmark", at, as: other });
    if (Math.hypot(L.hills[at].x - S.T[0], L.hills[at].y - S.T[1]) > 30) sawEarly++;
    if (r.accepted && S.watch.plot.line.name === L.hills[at].name && S.watch.plot.line.p[1] === L.hills[at].y) right++;
    if (!w.accepted || twin.watch.plot.line.name === L.hills[other].name) through++;
    if (S.watch.hills[at].done !== true || !moves(S).includes("landmark") === S.watch.hills.some(h => h.seen && !h.done)) once = false;
  }
  check(tried >= 8 && right >= 0.8 * tried && through === tried && once, `a summit named is a line through it, one taken for another a line through the wrong one, each once a watch (${right}/${tried})`);
  check(sawEarly >= tried / 2, `the land shows farther off than a light: its summit more than thirty miles away in ${sawEarly} of ${tried}`);
}
{
  const old = newVoyage("the-light-on-the-skerry", 2);
  check(!("hills" in old.watch), "a coast with no charted summits has no land to take, as before");
}
process.exit(bad ? 1 : 0);
