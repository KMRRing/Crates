// Landfall's Kelvin's machine (`kelvin` levels): every leg brings a line of soundings; laid on the chart where the ship truly is, its
// depths agree with the chart's and the fix comes out near the truth; laid somewhere they disagree, or far outside the fog, it is refused;
// and a cast takes minutes, not a quarter of an hour hove to. Run: node tests/landfall-kelvin.mjs
import { LEVELS } from "../landfall-levels.js";
import { newVoyage, apply, moves, lineMisfit, levelOf } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const KELVIN = LEVELS.filter(L => L.kelvin);
check(KELVIN.length >= 3 && KELVIN.every(L => L.section === 15 && L.bed && L.year >= 1876), `Kelvin's machine has its own chapter, from 1876, on charted bottoms (${KELVIN.map(L => L.name).join(", ")})`);

let watches = 0, sized = 0, fitsTruth = 0, nearTruth = 0, flat = 0, refusedFar = 0, quick = 0, once = 0;
for (const L of KELVIN) for (let seed = 1; seed <= 8; seed++) {
  const S = newVoyage(L.id, seed);
  for (let i = 0; i < 30 && S.phase !== "end"; i++) {
    if (S.phase === "ritual") { apply(S, { t: "step", d: S.leg.run }); continue; }
    if (S.phase === "find") {
      watches++;
      const n = S.watch.line.sounds.length;
      if (n >= 3 && n <= 9 && S.watch.line.sounds.every(x => x.depth === null || x.depth > 0)) sized++;
      const truthOff = [S.T[0] - S.E[0], S.T[1] - S.E[1]];
      if (lineMisfit(S, S.T) <= 2.2) fitsTruth++;
      const far = structuredClone(S), cast = structuredClone(S);
      const r = apply(far, { t: "trace", off: [truthOff[0] + 60, truthOff[1] - 60] });
      if (r.ok && !r.accepted) refusedFar++;
      const m0 = cast.watch.min; apply(cast, { t: "sound" }); if (cast.watch.min - m0 <= 3) quick++;
      const before = Math.hypot(S.E[0] - S.T[0], S.E[1] - S.T[1]), t = apply(S, { t: "trace", off: truthOff });
      if (t.flat) flat++;
      else if (t.accepted && Math.hypot(S.E[0] - S.T[0], S.E[1] - S.T[1]) < Math.max(2, 0.5 * before)) nearTruth++;
      if (!moves(S).includes("trace")) once++;
      apply(S, { t: "skipsight" }); continue;
    }
    if (S.phase === "steer") { const H = levelOf(S).harbour; apply(S, { t: "sail", course: (Math.atan2(H.x - S.E[0], H.y - S.E[1]) * 180 / Math.PI + 360) % 360 }); }
  }
}
check(watches >= 40 && sized === watches, `every watch brings a line of three to nine soundings (${watches} watches)`);
check(fitsTruth >= 0.8 * watches, `laid where the ship truly is, the line fits the chart (${fitsTruth}/${watches}; the rest stretched by the log and the current)`);
check(nearTruth >= 0.7 * (watches - flat), `...and laid there, the fix comes out near the truth (${nearTruth}/${watches - flat})`);
check(flat >= 1 && flat <= 0.4 * watches, `a line over the even deep is not a place, wherever it is laid (${flat}/${watches}); over the banks it is`);
check(refusedFar === watches, "laid sixty miles off, it is refused: the depths disagree, or the fog does, or the ground is too even to say");
check(quick === watches && once === watches, "the machine casts at full speed in three minutes, and a line is laid once a watch");
{
  const S = newVoyage("on-soundings", 2);
  apply(S, { t: "step", d: S.leg.run });
  check(!S.watch.line && !moves(S).includes("trace"), "the lead's chapter has no machine: one cast a watch, hove to");
}
process.exit(bad ? 1 : 0);
