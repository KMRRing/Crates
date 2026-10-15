// Contract's puzzle rush on the page (Menu, Puzzle rush): the rush's sheet (rush-sheet.js) with the course's stage
// (contract-course.js: the contract, the auction, dummy, the trick, your hand; tap a card, then Play), the bank
// contract-puzzles.js, and the verdict (contract-rush.js): how often the best card and yours made or beat the contract
// over the deals of the cards you couldn't see, the best played, and what it does.
import { courseStage } from "./contract-course.js";
import { stepOf, judge, askText, whyText, stateOf } from "./contract-rush.js";
import { createRushSheet } from "./rush-sheet.js";
import { cardText, sideOf } from "./contract-core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cardSpan = name => `<b class="bd-card${/[♥♦]/.test(name) ? " red" : ""}">${esc(name)}</b>`;

/** The verdict as markup: best, as good or not, how often the best and the next (or yours) made or beat the contract. */
function verdict(p, j) {
  const decl = sideOf(stateOf(p).contract.declarer) === 0, does = decl ? "makes it" : "beats it";
  const badge = j.verdict === "wrong" ? `<b class="rush-miss">✗ Not the best:</b>` : j.verdict === "fine" ? `<b class="rush-hit">✓ As good:</b>` : `<b class="rush-hit">✓ Best:</b>`;
  const other = j.verdict === "best" || j.verdict === "fine" ? j.next : j.mine;
  const them = other ? `; ${j.verdict === "wrong" ? "yours" : "the next best"}, ${cardSpan(other.name)}, ${other.make}%` : "";
  const head = `${cardSpan(p.best)} ${does} in ${j.best.make}% of ${p.n} deals${them}.`;
  const why = whyText(p);
  return `<p class="ln-say">${badge} ${head}</p>${why ? `<p class="ln-msg ${j.verdict === "wrong" ? "no" : "ok"}">${esc(why)}</p>` : ""}`;
}

/** The sheet, made once. inFrame: a partner watching (nothing kept). */
export const createRush = ({ inFrame = false } = {}) => createRushSheet({
  key: "contract", cls: "bd",
  loadBank: async () => (await import("./contract-puzzles.js")).PUZZLES,
  stage: courseStage(), stepOf,
  picked: (p, st) => (st.sel == null ? null : cardText(st.sel)),
  judge, ask: askText, verdict,
  intro: "Positions late in deals the computer players bid and played, where one card makes the contract (or beats it) clearly more often than the rest: worked out over 160 deals of the cards you can't see, each solved with every card seen. Find it. They start easy and get harder.",
}, { inFrame });
