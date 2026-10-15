// Gammon's course asked of GNU Backgammon again (tools/gnubg.mjs: money play, 2-ply): every play a lesson asks for, and
// every cube question, against the verdicts the lessons keep (gnubg in gammon-course.js). Prints what gnubg says now
// beside what's kept, and fails if its first choice or its cube verdict differs, or an equity has moved by more than
// 0.01. Run: GNUBG_HINTS=<the package's folder> node tools/gammon-check.mjs
import { hints, cube, shutdown } from "./gnubg.mjs";
import { COURSE, boardOf, diceOf, playOf } from "../gammon-course.js";
import { lessonsOf } from "../course.js";

const key = p => `${p.me.join()}|${p.op.join()}`;
let bad = 0;
for (const { lesson: l } of lessonsOf(COURSE)) for (const [i, st] of l.steps.entries()) {
  const where = `${l.id} step ${i + 1}`, { me, op } = boardOf(st);
  if (st.answer == null && !st.gnubg) continue;
  if (st.quiz && !st.gnubg) continue;
  if (st.quiz) {
    const c = await cube(me, op), act = c.double === "no-double" || c.double === "too-good" ? c.double : `double/${c.take === "take" ? "take" : "pass"}`;
    const moved = Math.abs(c.cubeful - st.gnubg.nd) > 0.01 || Math.abs(c.takeEquity - st.gnubg.dt) > 0.01;
    console.log(`${act === st.gnubg.act && !moved ? "ok  " : "DIFF"} ${where}: ${act}, no double ${c.cubeful.toFixed(3)}, taken ${c.takeEquity.toFixed(3)} (kept ${st.gnubg.act}, ${st.gnubg.nd}, ${st.gnubg.dt})`);
    if (act !== st.gnubg.act || moved) bad++;
    continue;
  }
  const list = await hints(me, op, diceOf(st), 4), right = new Set([st.answer, ...(st.accept || [])].map(t => key(playOf(st, t))));
  const first = right.has(key(list[0]));
  const moved = (st.gnubg || []).some(([text, eq]) => { const p = playOf(st, text), h = list.find(x => key(x) === key(p)); return !h || Math.abs(h.equity - eq) > 0.01; });
  console.log(`${first && !moved ? "ok  " : "DIFF"} ${where}: ${list.slice(0, 3).map(h => `${h.text} ${h.equity.toFixed(3)}`).join(" | ")}${st.gnubg ? "" : " (none kept)"}`);
  if (!first || moved) bad++;
}
shutdown();
console.log(bad ? `\n${bad} differ` : "\nevery verdict as kept");
process.exit(bad ? 1 : 0);
