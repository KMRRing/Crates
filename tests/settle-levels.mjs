// Settle's levels (settle-levels.js, made by settle-plan.mjs into settle-book.js; the redesign of 23 November 2026): 24 in three
// chapters, each proved again here: nothing casts before a pour, the solver's par is the stored one, the par rises through each
// chapter, from a chapter's third level on at most two first pours keep the par; chapters one and two keep every crucible one size,
// three mixes them; and the Random and Today's melts, the same on every device and made quickly.
// Run: node tests/settle-levels.mjs
import { startOf, solve, movesOf, pour, keyOf } from "../settle-engine.js";
import { LEVELS, CHAPTERS, playOf, gradeOf, meltOf, MELTS } from "../settle-levels.js";
import { mouldOf } from "../settle-alloys.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const T0 = Date.now();

check(LEVELS.length === 24 && CHAPTERS.every(C => LEVELS.filter(L => L.ch === C.id).length === 8) && LEVELS.every((L, k) => L.id === `${L.ch}-${k % 8 + 1}`), "24 levels, eight to each of three chapters, in order");
check(LEVELS.every(L => L.name && L.tip && L.tip.length <= 140), "every level has a name and a tip");
{
  const problems = [];
  for (const L of LEVELS) {
    const E = playOf(L), s = startOf(E), sv = solve(E, s);
    if (s.cast.some(Boolean)) problems.push(`${L.id}: casts before a pour`);
    if (sv.par !== L.par) problems.push(`${L.id}: par ${sv.par}, stored ${L.par}`);
    const measures = L.fill.flat().length, needed = L.moulds.reduce((t, id) => t + Object.values(mouldOf(id).parts).reduce((a, b) => a + b, 0), 0);
    if (measures !== needed) problems.push(`${L.id}: ${measures} measures for moulds of ${needed}`);
    if (L.fill.some((f, i) => f.length > L.caps[i])) problems.push(`${L.id}: a crucible over its rim`);
    if (L.ch < 3 && new Set(L.caps).size !== 1) problems.push(`${L.id}: crucibles of more than one size before chapter three`);
    if (L.ch === 3 && new Set(L.caps).size === 1) problems.push(`${L.id}: chapter three with crucibles all one size`);
    if (+L.id.split("-")[1] >= 3) { const firsts = movesOf(E, s).filter(([a, b]) => sv.toWin.get(keyOf(pour(E, s, a, b).state)) === sv.par - 1).length; if (firsts > 2) problems.push(`${L.id}: ${firsts} first pours keep the par`); }
  }
  check(!problems.length, `every level starts with nothing cast, its par proved, its measures exactly its moulds', its crucibles as its chapter wants, and few right first pours${problems.length ? `: ${problems.join("; ")}` : ""}`);
  const rising = CHAPTERS.every(C => { const p = LEVELS.filter(L => L.ch === C.id).map(L => L.par); return p.at(-1) > p[0] && Math.max(...p.slice(0, 3)) <= Math.min(...p.slice(-3)); });
  check(rising, `the par rises through each chapter (${CHAPTERS.map(C => LEVELS.filter(L => L.ch === C.id).map(L => L.par).join(",")).join(" | ")})`);
  check(LEVELS.filter(L => L.ch === 2).every(L => L.moulds.some(id => Object.keys(mouldOf(id).parts).length > 1)), "every Alloys level has a mould that is a mix");
}
{
  const a = MELTS.map((_, k) => meltOf(k, 4242)), b = MELTS.map((_, k) => meltOf(k, 4242));
  check(a.every((L, k) => L.id === "melt" && L.seed && JSON.stringify(L) === JSON.stringify(b[k])), "a melt from a seed is the same on every device, on every rung");
  check(a.every((L, k) => L.par >= MELTS[k].par[0] && L.par <= MELTS[k].par[1] && gradeOf(L).ok), "every rung's melt is a puzzle with its par in the rung's range");
  const days = [20261123, 20261124, 20261125, 20261126, 20261127].map(d => meltOf("daily", d)), key = d => JSON.stringify([d.fill.map(f => f.join("")).sort(), d.moulds.slice().sort()]);
  check(new Set(days.map(key)).size === 5 && days.every(d => d.par >= 6 && d.par <= 10), "today's melt changes with the day (five days, five melts), par 6 to 10");
}

check(Date.now() - T0 < 5000, `the whole file runs in under five seconds (${Date.now() - T0} ms)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle levels: every level proved, the curve, the melts");
