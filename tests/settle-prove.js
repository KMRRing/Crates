// Crucible's book levels proved one at a time, for tests/settle-levels.mjs (chapters one to seven) and tests/settle-late.mjs (eight,
// whose solves are most of the work: apart, each file stays under five seconds). A level starts with nothing cast, its par and
// hardness are the solver's, it has metal enough for its moulds (exactly, before Spare metal), its crucibles as its chapter wants, no
// idea before its chapter, and from its third level on a chapter's levels have at most two first pours that keep the par.
import { startOf, solve, movesOf, pour, keyOf } from "../settle-engine.js";
import { playOf, hardness } from "../settle-levels.js";
import { mouldOf } from "../settle-alloys.js";

/** What is wrong with a book level: a list, empty when nothing is. */
export function problemsOf(L) {
  const problems = [];
  const E = playOf(L), s = startOf(E), sv = solve(E, s);
  if (s.cast.some(Boolean)) problems.push(`${L.id}: casts before a pour`);
  if (sv.par !== L.par) problems.push(`${L.id}: par ${sv.par}, stored ${L.par}`);
  const hard = +hardness(L, E, s, sv).hard.toFixed(2);
  if (hard !== L.hard) problems.push(`${L.id}: hardness ${hard}, stored ${L.hard}`);
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
  return problems;
}
