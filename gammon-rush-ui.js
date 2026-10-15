// Gammon's puzzle rush on the page (Menu, Puzzle rush): the rush's sheet (rush-sheet.js) with the course's board
// (gammon-course.js: tap a checker, its point if it may go more than one way, Undo, Play), the bank gammon-puzzles.js,
// and the verdict in GNU Backgammon's terms (gammon-rush.js): what the best and yours are worth, the best played, and
// what it does.
import { boardStage } from "./gammon-course.js";
import { stepOf, judge, nameOf, worthText, whyText, askText } from "./gammon-rush.js";
import { createRushSheet } from "./rush-sheet.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The verdict as markup: best, as good or not, gnubg's equities, and what the best does. */
function verdict(p, j) {
  const eq = o => esc(worthText(o.value));
  const head = j.verdict === "best" ? `<b class="rush-hit">✓ Best</b> ${esc(p.best)}: GNU Backgammon rates it ${eq(j.best)}${j.next ? `; the next best, ${esc(j.next.name)}, ${eq(j.next)}` : ""}.`
    : j.verdict === "fine" ? `<b class="rush-hit">✓ As good</b> Yours, ${esc(j.mine.name)}, ${eq(j.mine)}; the best, ${esc(p.best)}, ${eq(j.best)}.`
      : `<b class="rush-miss">✗ Not the best</b> ${esc(p.best)}, ${eq(j.best)}; yours, ${esc(j.mine.name)}, ${eq(j.mine)}: ${esc(worthText(j.best.value - j.mine.value).slice(1))} of a game less.`;
  const why = whyText(p);
  return `<p class="ln-say">${head}</p>${why ? `<p class="ln-msg ${j.verdict === "wrong" ? "no" : "ok"}">${esc(why)}</p>` : ""}`;
}

/** The sheet, made once. inFrame: a partner watching (nothing kept). */
export const createRush = ({ inFrame = false } = {}) => createRushSheet({
  key: "gammon", cls: "gm",
  loadBank: async () => (await import("./gammon-puzzles.js")).PUZZLES,
  stage: boardStage(), stepOf: p => ({ ...stepOf(p), race: p.race }),
  picked: (p, st) => nameOf(p, st.made || []),
  judge, ask: askText, verdict,
  intro: "Positions from the computer players' own games where one play is clearly best: every play the roll allows weighed by GNU Backgammon (money play), the best ahead of the next by at least 0.06 of a game. Find it. They start easy and get harder.",
}, { inFrame });
