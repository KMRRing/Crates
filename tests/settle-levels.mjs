// Crucible's levels (settle-levels.js, made by settle-plan.mjs into settle-book.js; the redesign of 23 November 2026): 70 in eight
// chapters that grow longer, each proved again here: nothing casts before a pour, the solver's par is the stored one, the par rises
// through each chapter, from a chapter's third level on at most two first pours keep the par; chapters one and two keep every crucible
// one size, three mixes them; a chapter's idea (spare metal, dross and the slag pot, the teapot ladle, zinc and charcoal, liquation)
// never shows before its chapter; and the Random and Today's melts, the same on every device and made quickly.
// Run: node tests/settle-levels.mjs
import { startOf, solve, movesOf, pour, keyOf } from "../settle-engine.js";
import { LEVELS, CHAPTERS, playOf, gradeOf, meltOf, MELTS } from "../settle-levels.js";
import { mouldOf } from "../settle-alloys.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
// the file's own work, in processor time: a wall clock also counts the other tests run beside it
const cpuMs = () => { const u = process.cpuUsage(); return Math.round((u.user + u.system) / 1000); };

const sizes = CHAPTERS.map(C => LEVELS.filter(L => L.ch === C.id).length);
check(LEVELS.length === 70 && sizes.join() === "8,8,8,8,9,9,10,10" && LEVELS.every(L => L.id === `${L.ch}-${LEVELS.filter(M => M.ch === L.ch).indexOf(L) + 1}`),
  `70 levels in eight chapters that grow longer (${sizes.join(", ")}), in order`);
check(LEVELS.every(L => L.name && L.tip && L.tip.length <= 140), "every level has a name and a tip");
{
  const problems = [];
  for (const L of LEVELS) {
    const E = playOf(L), s = startOf(E), sv = solve(E, s);
    if (s.cast.some(Boolean)) problems.push(`${L.id}: casts before a pour`);
    if (sv.par !== L.par) problems.push(`${L.id}: par ${sv.par}, stored ${L.par}`);
    // liquation turns lead rich and black copper plain one for one, so measures are counted by family; charcoal and dross are no metal
    const family = m => ({ Pr: "Pb", Bk: "Cu" })[m] || m, tally = list => list.reduce((t, m) => (t[family(m)] = (t[family(m)] || 0) + 1, t), {});
    const have = tally(L.fill.flat().filter(m => m !== "C" && m !== "X")), want = tally(L.moulds.flatMap(id => Object.entries(mouldOf(id).parts).flatMap(([m, n]) => Array(n).fill(m))));
    const metals = new Set([...Object.keys(have), ...Object.keys(want)]);
    if ([...metals].some(m => (have[m] || 0) < (want[m] || 0))) problems.push(`${L.id}: too little metal for its moulds`);
    if (L.ch < 4 && [...metals].some(m => (have[m] || 0) !== (want[m] || 0))) problems.push(`${L.id}: spare metal before chapter four`);
    const flat = L.fill.flat(), kinds = L.kinds || [];
    for (const [ch, what, seen] of [[5, "dross or a slag pot", flat.includes("X") || kinds.includes("slag")], [6, "a teapot ladle", kinds.includes("teapot")],
      [7, "zinc or charcoal", flat.includes("Zn") || flat.includes("C")], [8, "black copper", flat.includes("Bk")]]) if (seen && L.ch < ch) problems.push(`${L.id}: ${what} before chapter ${ch}`);
    if (L.fill.some((f, i) => f.length > L.caps[i])) problems.push(`${L.id}: a crucible over its rim`);
    if (L.ch < 3 && new Set(L.caps).size !== 1) problems.push(`${L.id}: crucibles of more than one size before chapter three`);
    if (L.ch === 3 && new Set(L.caps).size === 1) problems.push(`${L.id}: chapter three with crucibles all one size`);
    if (+L.id.split("-")[1] >= 3) { const firsts = movesOf(E, s).filter(([a, b]) => sv.toWin.get(keyOf(pour(E, s, a, b).state)) === sv.par - 1).length; if (firsts > 2) problems.push(`${L.id}: ${firsts} first pours keep the par`); }
  }
  check(!problems.length, `every level starts with nothing cast, its par proved, metal enough for its moulds (exactly, before Spare metal), its crucibles as its chapter wants, no idea before its chapter, and few right first pours${problems.length ? `: ${problems.join("; ")}` : ""}`);
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

check(cpuMs() < 5000, `the whole file runs in under five seconds of processor time (${cpuMs()} ms)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle levels: every level proved, the curve, the melts");
