// Schafkopf's puzzle rush on the page (Menu, Puzzle rush): the rush's sheet (rush-sheet.js) with the course's stage
// (trumps-course.js: the game and who plays it, the tricks played and what each side has, the trick, your hand; tap a
// card, then Play), the bank trumps-puzzles.js, and the verdict in Schafkopf's terms (trumps-rush.js): how often the
// best and yours won the game over the deals of the cards you couldn't see, the best played, and what it does.
import { cardStage, tokenOf } from "./trumps-course.js";
import { stepOf, judge, playWords, worthText, gamesText, alike, whyText, askText } from "./trumps-rush.js";
import { createRushSheet } from "./rush-sheet.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * The verdict as markup: best, as good or not, how often each won the game, and where two win alike what each comes
 * to on average; then what the best does.
 */
function verdict(p, j) {
  const deals = `of ${p.n} deals of the cards you couldn't see`, words = n => esc(playWords(n)), Words = n => esc(playWords(n).replace(/^t/, "T"));
  const badge = j.verdict === "wrong" ? `<b class="rush-miss">✗ Not the best</b>` : j.verdict === "fine" ? `<b class="rush-hit">✓ As good</b>` : `<b class="rush-hit">✓ Best</b>`;
  // the best against the next best, or against yours
  const other = j.verdict === "best" ? j.next : j.mine, them = j.verdict === "best" ? `the next best, ${other && words(other.name)}` : `yours, ${words(j.mine.name)}`;
  let head;
  if (!other) head = `${Words(p.best)} wins the game ${worthText(j.best)} ${deals}.`;
  else if (alike(j.best, other)) head = `${Words(p.best)} and ${them}, win the game alike (${j.best.win}% and ${other.win}% ${deals}), but the best comes to ${gamesText(j.best)} a hand, ${j.verdict === "best" ? "the next" : "yours"} ${gamesText(other)}: a game won counts 1, Schneider and schwarz one more each.`;
  else head = `${Words(p.best)} wins the game ${worthText(j.best)} ${deals}; ${them}, ${worthText(other)}.`;
  const why = whyText(p);
  return `<p class="ln-say">${badge} ${head}</p>${why ? `<p class="ln-msg ${j.verdict === "wrong" ? "no" : "ok"}">${esc(why)}</p>` : ""}`;
}

/** The sheet, made once. inFrame: a partner watching (nothing kept). */
export const createRush = ({ inFrame = false } = {}) => createRushSheet({
  key: "trumps", cls: "tr",
  loadBank: async () => (await import("./trumps-puzzles.js")).PUZZLES,
  stage: cardStage(), stepOf,
  picked: (p, st) => tokenOf(st.sel),
  judge, ask: askText, verdict,
  intro: "Schafkopf positions from the computer players' own games, Sauspiel, Solo and Wenz, late in a hand where one card is clearly best: worked out over a hundred deals and more of the cards you can't see, each played to the end with every card seen. Find it. They start easy and get harder.",
}, { inFrame });
