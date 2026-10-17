// Roulette's stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step
// may carry any of:
//   wheel: true the wheel; or { pocket, around } with a pocket picked out (and `around` pockets either side of it);
//   layout: { bets: { key: HK$ }, dolly, lit: [keys] } the betting layout with chips on it (the dolly on a number, the
//     winning bets lit);
//   screen: "17 32 0 5 …" the screen over the table after those numbers (oldest first);
//   terms: [[zh, jyutping, english]] words of the floor.
// Every exercise is a choice the course itself asks, so the stage only draws.
import { WHEEL, colourOf, label, stats, neighbours } from "./roulette-engine.js";
import { layoutFor, layoutSvg } from "./roulette-layout.js";
import { wheelSvg } from "./roulette-wheel.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dot = p => `<span class="rl-ball ${colourOf(p)}">${label(p)}</span>`;
/** Numbers written as text ("17 32 0"): their pockets. */
export const parsePockets = text => String(text || "").trim().split(/\s+/).filter(Boolean).map(Number);

function screenHtml(text) {
  const st = stats(parsePockets(text), 100);
  const pct = n => `${Math.round((100 * n) / st.spins)}%`;
  return `<div class="rl-board rs-screen"><div class="rl-last">${st.last.map(dot).join("")}</div>
    <div class="rl-stats"><span><i class="red">Red</i> ${pct(st.red)}</span><span><i>Black</i> ${pct(st.black)}</span><span><i class="green">0</i> ${pct(st.green)}</span><span>Odd ${pct(st.odd)}</span><span>Even ${pct(st.even)}</span><span>Hot ${st.hot.slice(0, 3).map(label).join(" ")}</span><span>Cold ${st.cold.slice(0, 3).map(label).join(" ")}</span></div></div>`;
}
function termsHtml(terms) {
  return `<dl class="cs-terms">${terms.map(([zh, jp, en]) => `<div><dt>${esc(zh)}</dt><dd><i>${esc(jp)}</i>${esc(en)}</dd></div>`).join("")}</dl>`;
}
/** The wheel, still, with a pocket (and its neighbours) picked out by a ring round them. */
function wheelHtml(w) {
  const pick = typeof w === "object" ? w : null, svg = wheelSvg({ ball: 0, ballR: pick ? 0.77 : 0.95, turn: pick ? -WHEEL.indexOf(pick.pocket) * (360 / 37) : 0 });
  const ring = pick ? `<p class="rs-around">${neighbours(pick.pocket, pick.around || 0).map(dot).join("")}</p>` : "";
  return `<div class="rs-wheel">${svg}${ring}</div>`;
}

export function rouletteStage() {
  let box = null;
  return {
    mount(b) { box = b; },
    task: () => false,
    hint() {},
    draw(s) {
      const parts = [];
      if (s.wheel) parts.push(wheelHtml(s.wheel));
      if (s.screen) parts.push(screenHtml(s.screen));
      if (s.layout) parts.push(`<div class="rs-layout"></div>`);
      if (s.terms) parts.push(termsHtml(s.terms));
      box.innerHTML = `<div class="rs">${parts.join("")}</div>`;
      const slot = box.querySelector(".rs-layout");
      if (slot) {
        // the layout as big as its share of the stage allows
        const room = box.clientHeight - [...box.querySelectorAll(".rs > :not(.rs-layout)")].reduce((a, el) => a + el.offsetHeight + 12, 0);
        const plan = layoutFor(Math.min(box.clientWidth, 420), Math.max(160, room - 8));
        slot.innerHTML = layoutSvg(plan, { bets: s.layout.bets || {}, lit: new Set(s.layout.lit || []), dolly: s.layout.dolly ?? null });
      }
    },
  };
}
