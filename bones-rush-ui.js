// Bones' puzzle rush on the page (Menu, Puzzle rush): the rush's sheet (rush-sheet.js) with the course's stage
// (bones-course.js: the others with their tiles and knocks, the line, your tiles; tap a tile, its place, Lay), the bank
// bones-puzzles.js, and the verdict in Bones' terms (bones-rush.js): what the best and yours were worth over the
// puzzle's deals, the best laid on the line, and what it does.
import { tileStage, tableOf, playName } from "./bones-course.js";
import { stepOf, judge, playWords, worthText, doesText, whyText, askText } from "./bones-rush.js";
import { createRushSheet } from "./rush-sheet.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The verdict as markup: best, as good or not, the worths, and what the best does. */
function verdict(p, j) {
  // Fives and Threes counts a game won as 100 points: an average that big is mostly games won
  const big = p.game === "fives" && [j.best, j.mine, j.next].some(x => x && Math.abs(x.value) >= 20 && x.value < 90) ? ", a game won counted as 100" : "";
  const deals = `over ${p.n} deals of the tiles you couldn't see${big}`, words = n => esc(playWords(n, p));
  const head = j.verdict === "best" ? `<b class="rush-hit">✓ Best</b> ${words(p.best)} ${esc(doesText(p, j.best.value))} ${deals}${j.next ? `; the next best ${esc(worthText(p, j.next.value))}` : ""}.`
    : j.verdict === "fine" ? `<b class="rush-hit">✓ As good</b> Yours, ${words(j.mine.name)}, ${esc(worthText(p, j.mine.value))}; the best, ${words(p.best)}, ${esc(worthText(p, j.best.value))} ${deals}.`
      : `<b class="rush-miss">✗ Not the best</b> ${words(p.best)} ${esc(doesText(p, j.best.value))} ${deals}; yours, ${words(j.mine.name)}, ${esc(worthText(p, j.mine.value))}.`;
  const why = whyText(p);
  return `<p class="ln-say">${head}</p>${why ? `<p class="ln-msg ${j.verdict === "wrong" ? "no" : "ok"}">${esc(why)}</p>` : ""}`;
}

/** The sheet, made once. inFrame: a partner watching (nothing kept). */
export const createRush = ({ inFrame = false } = {}) => createRushSheet({
  key: "bones", cls: "bn",
  loadBank: async () => (await import("./bones-puzzles.js")).PUZZLES,
  stage: tileStage(), stepOf,
  picked: (p, st) => playName(tableOf(stepOf(p)), { tile: st.sel, end: st.end }),
  judge, ask: askText, verdict,
  intro: "Positions from the computer players' own games, Partnership, Gaple and Fives and Threes, where one tile is clearly best: worked out over hundreds of deals of the tiles you can't see, each played to the end of the hand. Find it. They start easy and get harder.",
}, { inFrame });
