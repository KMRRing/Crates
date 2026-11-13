// Landfall's stars through cloud (`unnamed` levels): a star tapped is not named by the game; the navigator names it, the compass catches a
// wrong name, and the almanac works the star it is named as, so a wrong name makes a wrong line. Run: node tests/landfall-cloud.mjs
import { LEVELS } from "../landfall-levels.js";
import { newVoyage, apply, moves, look, BY_HR, sextantTruth } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const CLOUDED = LEVELS.filter(L => L.unnamed);
check(CLOUDED.length >= 3 && CLOUDED.every(L => L.section === 13 && L.lop === 2), `stars through cloud have their own chapter (${CLOUDED.map(L => L.name).join(", ")})`);

/** A watch of the first cloud level with a bright star in sight, its twilight dark enough. */
function aWatch(seed) {
  const S = newVoyage("a-gap-in-the-cloud", seed);
  apply(S, { t: "step", d: S.leg.run });
  for (let m = 0; m < 60; m += 2) {
    const st = [...BY_HR.values()].filter(s => s[5] < 1.6 && s[8] && look(S, s).visible && look(S, s).alt > 15).sort((a, b) => a[5] - b[5]);
    if (st.length >= 2 && m >= 16) return { S, star: st[0][0], other: st[1][0] };
    apply(S, { t: "wait", min: 2 });
  }
  return null;
}
let tried = 0, unnamedFirst = true, caught = 0, rightOk = 0, lineRight = 0, lineWrong = 0;
for (let seed = 1; seed <= 40 && tried < 10; seed++) {
  const w = aWatch(seed);
  if (!w) continue;
  tried++;
  const { S, star, other } = w;
  apply(S, { t: "pick", hr: star });
  if (moves(S).includes("raise") || moves(S).includes("bearing") || !moves(S).includes("name")) unnamedFirst = false;
  // a wrong name: the compass says so
  const twin = structuredClone(S);
  apply(twin, { t: "name", hr: other });
  const b = apply(twin, { t: "bearing" });
  if (b.ok && b.wrong) caught++;
  // the right name: the compass agrees, and the line is near the truth
  apply(S, { t: "name", hr: star });
  const r = apply(S, { t: "bearing" });
  if (r.ok && !r.wrong) rightOk++;
  const sight = X => { apply(X, { t: "raise" }); const t = sextantTruth(X); apply(X, { t: "read", marks: [t, t, t] }); return X.watch.book; };
  const good = sight(S), bad2 = sight(twin);
  // the true intercept from the reckoning is the same for both: the wrong name's book is far from it
  if (good.hr === star && Math.abs(good.z) < 20) lineRight++;
  if (bad2.hr === other && Math.abs(bad2.z - good.z) > 10) lineWrong++;
}
check(tried >= 6, `enough clouded watches with two bright stars to test (${tried})`);
check(unnamedFirst, "a star tapped under cloud must be named before its bearing or its altitude is taken");
check(caught >= 0.8 * tried && rightOk >= 0.8 * tried, `the compass catches a wrong name (${caught}/${tried}) and agrees with a right one (${rightOk}/${tried})`);
check(lineRight >= 0.8 * tried && lineWrong >= 0.8 * tried, `the almanac works the star named: rightly named, a line near the truth (${lineRight}/${tried}); wrongly, one miles from it (${lineWrong}/${tried})`);
{
  const S = newVoyage("two-lines-cross", 3);
  apply(S, { t: "step", d: S.leg.run });
  check(!moves(S).includes("name"), "a clear-sky level names its stars as before");
}
process.exit(bad ? 1 : 0);
