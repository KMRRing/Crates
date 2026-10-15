// Banquet's rush on the page (Menu, Call it): the rush's sheet (rush-sheet.js) with the course's stage
// (banquet-course.js: the hands, Lao Wang's last throws, the calls; tap a call, then Call), the bank banquet-rush.js deals,
// and the verdict: the right call and why.
import { handStage } from "./banquet-course.js";
import { PUZZLES, stepOf, judge, callText, whyText, askText } from "./banquet-rush.js";
import { createRushSheet } from "./rush-sheet.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The verdict as markup: right or not, the right call, and why. */
function verdict(p, j) {
  const head = j.verdict === "best" ? `<b class="rush-hit">✓ Right</b> ${esc(callText(p.mode, p.best))}.` : `<b class="rush-miss">✗ Not that</b> It's ${esc(callText(p.mode, p.best))}; yours, ${esc(callText(p.mode, j.mine.name))}.`;
  return `<p class="ln-say">${head}</p><p class="ln-msg ${j.verdict === "wrong" ? "no" : "ok"}">${esc(whyText(p))}</p>`;
}

/** The sheet, made once. inFrame: a partner watching (nothing kept). */
export const createRush = ({ inFrame = false } = {}) => createRushSheet({
  key: "banquet", cls: "bq", title: "Call it",
  loadBank: async () => PUZZLES,
  stage: handStage(), stepOf,
  picked: (p, st) => st.sel,
  judge, ask: askText, verdict,
  intro: "Call it, as fast as a banquet table wants it: both hands shown, the total in its verse, first with the numbers on the calls and then without; then 十五二十's Cantonese; then Lao Wang's last throws to read, and the call his habits make likeliest. They start easy and get harder.",
}, { inFrame });
