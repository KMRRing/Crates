// Sic Bo's stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step
// may carry any of:
//   dice: "4 4 2" the three dice, with what they make (the total, and Big, Small or the triple);
//   ways: true | { pick, ask } how many of the 216 throws make each total, 3 to 18 (pick: one picked out; ask: the counts
//     left off, for a step that asks for one);
//   edges: [[key, label]] what the house keeps on each bet, as bars;
//   layout: { groups, bets: { key: HK$ }, lit: [keys] } the betting layout, the groups drawn (sicbo-layout.js's), with
//     chips on it and the winning bets ringed;
//   screen: "345 641 …" the screen over the table after those throws (oldest first);
//   terms: [[zh, jyutping, english]] words of the floor.
// Every exercise is a choice the course itself asks, so the stage only draws.
import { OUTCOMES, totalOf, sizeOf, edgeOf, paysText, kindOf, stats } from "./sicbo-engine.js";
import { layoutHtml, lastHtml, statsHtml, statsLabel } from "./sicbo-layout.js";
import { dieSvg, parseDice } from "./casino-dice.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** Throws written "345 641 444" as lists of faces, oldest first; throws for anything that isn't dice. */
export const parseRounds = text => String(text || "").trim().split(/\s+/).filter(Boolean).map(parseDice);

/** How many of the 216 throws add up to each total, 3 to 18. */
export const WAYS = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 3, OUTCOMES.filter(d => totalOf(d) === i + 3).length]));

function diceHtml(text) {
  const d = parseDice(text), size = sizeOf(d), words = size === "triple" ? "Triple" : size === "big" ? "Big" : "Small";
  return `<div class="ss-dice">${d.map(f => dieSvg(f, "big")).join("")}<div class="ss-sign ${size}"><b>${totalOf(d)}</b><span>${words}</span></div></div>`;
}
function waysHtml(w) {
  const { pick = null, ask = false } = typeof w === "object" ? w : {}, top = Math.max(...Object.values(WAYS));
  const col = ([t, n]) => {
    t = Number(t);
    const cls = [t === pick && "pick", (t === 3 || t === 18) && "tri"].filter(Boolean).join(" ");
    return `<div class="${cls}"><i style="--h:${n / top}"></i><b>${ask ? "" : n}</b><span>${t}</span></div>`;
  };
  const words = ask ? "" : Object.entries(WAYS).map(([t, n]) => `${n} ways make ${t}`).join(", ");
  return `<div class="ss-ways" role="img" aria-label="How many of the 216 throws make each total${words ? `: ${words}` : ""}">${Object.entries(WAYS).map(col).join("")}</div>`;
}
/** A bet's pay, short, as the bars print it. */
const paid = key => (kindOf(key) === "s" ? "1·2·3 to 1" : paysText(key));
function edgesHtml(list) {
  const edges = list.map(([key, label]) => [label, paid(key), edgeOf(key)]), top = Math.max(0.5, ...edges.map(e => e[2]));
  return `<div class="ss-edges">${edges.map(([label, pays, e]) => `<div><span>${esc(label)}<small>${esc(pays)}</small></span><i style="--w:${e / top}"></i><b>${(100 * e).toFixed(2)}%</b></div>`).join("")}</div>`;
}
function screenHtml(text) {
  const st = stats(parseRounds(text), 100);
  return `<div class="sb-board ss-screen" aria-label="${esc(statsLabel(st))}"><div class="sb-last">${lastHtml(st)}</div><div class="sb-stats">${statsHtml(st)}</div></div>`;
}
const layoutBlock = l => `<div class="ss-layout">${layoutHtml({ bets: l.bets || {}, lit: new Set(l.lit || []), groups: l.groups, plain: true })}</div>`;
function termsHtml(terms) {
  return `<dl class="cs-terms">${terms.map(([zh, jp, en]) => `<div><dt>${esc(zh)}</dt><dd><i>${esc(jp)}</i>${esc(en)}</dd></div>`).join("")}</dl>`;
}

export function sicboStage() {
  let box = null;
  return {
    mount(b) { box = b; },
    task: () => false,
    hint() {},
    draw(s) {
      const parts = [];
      if (s.dice) parts.push(diceHtml(s.dice));
      if (s.ways) parts.push(waysHtml(s.ways));
      if (s.edges) parts.push(edgesHtml(s.edges));
      if (s.layout) parts.push(layoutBlock(s.layout));
      if (s.screen) parts.push(screenHtml(s.screen));
      if (s.terms) parts.push(termsHtml(s.terms));
      box.innerHTML = `<div class="ss">${parts.join("")}</div>`;
    },
  };
}
