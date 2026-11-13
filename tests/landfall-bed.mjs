// Landfall's lead (landfall-bed.js and the engine's "sound"): the bottom shelves up to the coast and stands up over a bank, the leadsman
// calls the marks as they were called, a cast costs a quarter of an hour once a watch, finds no bottom past its line, and a sounding on a
// slope is a line along the contour that shrinks the fog across it and not along it. Run: node tests/landfall-bed.mjs
import { LEVELS, levelById } from "../landfall-levels.js";
import { depthAt, offshore, bottomAt, leadsmanCall } from "../landfall-bed.js";
import { newVoyage, apply, moves, CAST_MIN } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const BEDS = LEVELS.filter(L => L.bed);

check(BEDS.filter(L => L.section === 10).length >= 3 && BEDS.every(L => L.section === 10 || L.kelvin), `the lead has its own chapter, and Kelvin's machine sounds after it (${BEDS.map(L => L.name).join(", ")})`);
for (const L of BEDS) {
  const H = [L.harbour.x, L.harbour.y], far = [H[0] * 0.2, H[1] * 0.2], near = [H[0] * 0.9, H[1] * 0.9];
  check(depthAt(L, far) > depthAt(L, near) && depthAt(L, near) > depthAt(L, H) - 0.01 && depthAt(L, H) < 40, `${L.name}: the bottom shelves up toward the coast (${depthAt(L, far).toFixed(0)}, ${depthAt(L, near).toFixed(0)}, ${depthAt(L, H).toFixed(0)} fathoms)`);
  check(L.shoals.every(s => depthAt(L, [s.x, s.y]) < 2.5 && bottomAt(L, [s.x, s.y]) === "rock"), `${L.name}: every shoal is a rock the lead finds in a fathom or two`);
  const ashore = L.land[0][0], inland = offshore(L, ashore) <= 0 && depthAt(L, [ashore[0] + 0, ashore[1]], true) <= L.bed.shore + 0.01;
  check(inland && depthAt(L, ashore) >= 0.5, `${L.name}: the shelf runs on under the land for a reckoning gone ashore, and a real cast never reads less than half a fathom`);
}
{
  const pit = levelById("the-silver-pit"), P = pit.bed.banks.find(b => b.name === "the Silver Pit"), D = pit.bed.banks.find(b => b.name === "the Dogger");
  check(depthAt(pit, [P.x, P.y]) > depthAt(pit, [D.x, D.y]) + 20 && bottomAt(pit, [P.x, P.y]) === "soft mud" && bottomAt(pit, [D.x - 20, D.y]) === "sand and broken shell", "the Silver Pit is a muddy hole in the Dogger's sand and shell");
}
check(leadsmanCall(5) === "By the mark, five" && leadsmanCall(6) === "By the deep, six" && leadsmanCall(7.5) === "And a half, seven" && leadsmanCall(9.75) === "A quarter less ten" && leadsmanCall(12.25) === "And a quarter, twelve" && leadsmanCall(43) === "43 fathoms", "the leadsman calls the marks, the deeps, the halves and the quarters");

// the cast in play
{
  const S = newVoyage("on-soundings", 3);
  apply(S, { t: "step", d: S.leg.run });
  check(moves(S).includes("sound"), "on a level with a charted bottom the lead can be cast in a watch");
  const before = S.watch.min, r = apply(S, { t: "sound" });
  check(r.ok && S.watch.min === before + CAST_MIN && !moves(S).includes("sound"), `a cast takes ${CAST_MIN} minutes hove to, once a watch`);
  check(r.flat || r.bottom === false || Number.isFinite(r.depth), "...and brings up a depth, or none past the line, or a bottom too flat to say anything");
  const old = newVoyage("the-light-on-the-skerry", 3);
  apply(old, { t: "step", d: old.leg.run });
  check(!moves(old).includes("sound") && !("sound" in old.watch), "a level without a charted bottom has no lead, and its voyages are as they were");
}
{
  // a sounding on the slope near the coast: across the contour the fog shrinks, along it it stays
  let tried = 0, good = 0, along = 0, across = 0;
  for (let seed = 1; seed <= 30 && tried < 12; seed++) {
    const S = newVoyage("on-soundings", seed);
    while (S.phase !== "end" && S.w < 3) { if (S.phase === "ritual") apply(S, { t: "step", d: S.leg.run }); else if (S.phase === "find") apply(S, { t: "skipsight" }); else apply(S, { t: "sail", course: 95 }); }
    if (S.phase === "end") continue;
    apply(S, { t: "step", d: S.leg.run });
    const P0 = S.P.map(r => [...r]), r = apply(S, { t: "sound" });
    if (!r.accepted) continue;
    tried++;
    const l = S.watch.plot.line, n = [-l.dir[1], l.dir[0]], v = (P, u) => u[0] * u[0] * P[0][0] + 2 * u[0] * u[1] * P[0][1] + u[1] * u[1] * P[1][1];
    if (v(S.P, n) < 0.6 * v(P0, n)) across++;
    if (v(S.P, l.dir) > 0.8 * v(P0, l.dir)) along++;
    if (Math.abs(n[0]) > 0.8) good++;                                   // the coast runs north and south of the course (095): the contour does too
  }
  check(tried >= 8 && across >= 0.8 * tried && along >= 0.8 * tried && good >= 0.8 * tried, `near the coast a sounding is a line along the contour: it shrinks the fog across it (${across}/${tried}) and not along it (${along}/${tried}), and the contour runs with the coast (${good}/${tried})`);
}
process.exit(bad ? 1 : 0);
