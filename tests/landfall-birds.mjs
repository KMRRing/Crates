// Landfall's birds (`colonies`): a flight passes at a twilight only within its birds' range of their rock, the nearest rock's; at dusk it
// flies home to the rock and at dawn out from it; put to its own rock its course is a rough line through it, put to another a line
// through the wrong one. Run: node tests/landfall-birds.mjs
import { LEVELS } from "../landfall-levels.js";
import { BIRDS, drawBird } from "../landfall-birds.js";
import { newVoyage, apply, moves, levelOf } from "../landfall-engine.js";
import { bearing, dist } from "../landfall-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const BIRDED = LEVELS.filter(L => L.colonies);
check(BIRDED.length >= 3 && BIRDED.every(L => L.section === 14 && L.colonies.every(c => BIRDS[c.bird] && c.range >= 10)), `the birds have their own chapter, every colony of a known kind (${BIRDED.map(L => L.name).join(", ")})`);
{
  let drew = 0; const ctx = new Proxy({}, { get: (_, k) => (k === "save" || k === "restore" || k === "translate" || k === "beginPath" || k === "moveTo" || k === "lineTo" || k === "quadraticCurveTo" || k === "closePath" || k === "fill" || k === "ellipse" ? () => { drew++; } : undefined), set: () => true });
  for (const k of Object.keys(BIRDS)) drawBird(ctx, k, 0, 0, 30, 0.5);
  check(drew > 30, "every kind of bird has a shape to draw");
}

let flights = 0, inRange = 0, nearest = 0, homeDusk = 0, outDawn = 0, dusk = 0, dawn = 0, right = 0, wrongThrough = 0, wrongWorse = 0, both = 0;
for (const id of ["morning-flight", "terns-and-gannets"]) for (let seed = 1; seed <= 40; seed++) {
  const S = newVoyage(id, seed), L = levelOf(S);
  for (let i = 0; i < 40 && S.phase !== "end"; i++) {
    if (S.phase === "ritual") { apply(S, { t: "step", d: S.leg.run }); continue; }
    if (S.phase === "find") {
      const at = S.watch.colonies.findIndex(c => c.seen);
      const inR = L.colonies.map((c, j) => ({ j, d: dist(S.T, [c.x, c.y]) })).filter(x => x.d <= L.colonies[x.j].range).sort((a, b) => a.d - b.d);
      if (at >= 0) {
        flights++;
        if (inR.length) inRange++;
        if (inR[0]?.j === at) nearest++;
        const twin = structuredClone(S), other = (at + 1) % L.colonies.length;
        const r = apply(S, { t: "birds", as: at });
        const home = bearing([L.colonies[at].x - S.T[0], L.colonies[at].y - S.T[1]]), off = d => Math.abs(((d % 360) + 540) % 360 - 180);
        const flown = S.watch.plot.observed ?? S.watch.colonies[at].bearing;
        if (S.watch.kind === "dusk") { dusk++; if (off(flown - home - S.compass.err) < 25) homeDusk++; }
        if (S.watch.kind === "dawn") { dawn++; if (off(flown - home - 180 - S.compass.err) < 25) outDawn++; }
        if (r.accepted && S.watch.plot.line.name === L.colonies[at].name) right++;
        if (L.colonies.length > 1) {
          both++;
          const w = apply(twin, { t: "birds", as: other });
          if (!w.accepted || twin.watch.plot.line.name === L.colonies[other].name) wrongThrough++;
          if (dist(twin.E, twin.T) > dist(S.E, S.T)) wrongWorse++;
        }
      } else if (inR.length && S.watch.kind !== "noon") inRange = -999;          // a rock in range and no flight: never
      if (!moves(S).includes("birds") !== !S.watch.colonies.some(c => c.seen && !c.done)) nearest = -999;
      apply(S, { t: "skipsight" }); continue;
    }
    if (S.phase === "steer") apply(S, { t: "sail", course: (bearing([L.harbour.x - S.E[0], L.harbour.y - S.E[1]]) + 360) % 360 });
    else break;
  }
}
check(flights >= 30 && inRange === flights && nearest === flights, `a flight passes only within its birds' range, from the nearest rock, once a watch (${flights} flights)`);
check(dusk >= 8 && dawn >= 8 && homeDusk >= 0.9 * dusk && outDawn >= 0.9 * dawn, `at dusk they fly home to the rock (${homeDusk}/${dusk}), at dawn out from it (${outDawn}/${dawn})`);
check(right >= 0.7 * flights, `put to its own rock, the flight is a line through it (${right}/${flights} plotted)`);
check(both >= 10 && wrongThrough === both && wrongWorse >= 0.6 * both, `put to another rock, the line runs through the wrong one, and the reckoning is worse for it (${wrongWorse}/${both})`);
{
  const S = newVoyage("two-lines-cross", 3);
  apply(S, { t: "step", d: S.leg.run });
  check(!("colonies" in S.watch) && !moves(S).includes("birds"), "a sea with no colonies has no birds to take, as before");
}
process.exit(bad ? 1 : 0);
