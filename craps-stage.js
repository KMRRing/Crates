// Craps' stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step may
// carry any of:
//   dice: "3 4" the two dice, with what they make (the total, and the stickman's call when `call` says what it is);
//   call: { before, after } the point before the throw and after it, for the call over the dice;
//   ways: true | { pick, ask } how many of the 36 throws make each total, 2 to 12 (pick: one picked out; ask: the counts
//     left off, for a step that asks for one);
//   edges: [[key, label]] what the house keeps on each bet, as bars (an additional bet's is none, drawn green);
//   odds: [0, 1, 5] what the house keeps of all the money on a pass line bet with that many times its size behind it;
//   layout: { groups, bets: { key: HK$ }, lit: [keys], point } the betting layout, the groups drawn (craps-layout.js's),
//     with chips on it, the winning bets ringed and the puck on the point;
//   screen: "34 11 66 …" the screen over the table after those throws (oldest first, one die after the other);
//   terms: [[zh, jyutping, english]] words of the floor.
// Every exercise is a choice the course itself asks, so the stage only draws.
import { WAYS, edgeOf, edgeWithOdds, paysShort, paysText, stats, totalOf, callOf } from "./craps-engine.js";
import { layoutHtml, lastHtml, statsHtml, statsLabel } from "./craps-layout.js";
import { dieSvg, parseDice } from "./casino-dice.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** Throws written "34 11 66" (two dice each) as lists of faces, oldest first; throws for anything that isn't dice. */
export const parseRounds = text => String(text || "").trim().split(/\s+/).filter(Boolean).map(parseDice).map(d => { if (d.length !== 2) throw new Error(`not two dice: ${d}`); return d; });

function diceHtml(text, call) {
  const d = parseDice(text), c = call ? callOf(d, call.before ?? null, call.after ?? null) : null;
  return `<div class="cps-dice">${d.map(f => dieSvg(f, "big")).join("")}<div class="cps-sign ${c?.side || ""}"><b>${totalOf(d)}</b>${c?.words ? `<span>${esc(c.words)}</span>` : ""}</div></div>`;
}
function waysHtml(w) {
  const { pick = null, ask = false } = typeof w === "object" ? w : {}, top = Math.max(...Object.values(WAYS));
  const col = ([t, n]) => {
    t = Number(t);
    const cls = [t === pick && "pick", t === 7 && "seven"].filter(Boolean).join(" ");
    return `<div class="${cls}"><i style="--h:${n / top}"></i><b>${ask ? "" : n}</b><span>${t}</span></div>`;
  };
  const words = ask ? "" : Object.entries(WAYS).map(([t, n]) => `${n} ways make ${t}`).join(", ");
  return `<div class="cps-ways" role="img" aria-label="How many of the 36 throws make each total${words ? `: ${words}` : ""}">${Object.entries(WAYS).map(col).join("")}</div>`;
}
function barsHtml(rows) {
  const top = Math.max(0.05, ...rows.map(r => r.edge));
  return `<div class="cps-edges">${rows.map(r => `<div class="${r.edge === 0 ? "fair" : ""}" title="${esc(r.title || "")}"><span>${esc(r.label)}<small>${esc(r.pays || "")}</small></span><i style="--w:${r.edge / top}"></i><b>${(100 * r.edge).toFixed(2)}%</b></div>`).join("")}</div>`;
}
const edgesHtml = list => barsHtml(list.map(([key, label]) => ({ label, pays: paysShort(key), title: paysText(key), edge: edgeOf(key) })));
const oddsHtml = times => barsHtml(times.map(n => ({ label: n ? `Pass with ${n}× odds` : "Pass line alone", edge: edgeWithOdds(n) })));
function screenHtml(text) {
  const st = stats(parseRounds(text), 100);
  return `<div class="cr-board cps-screen" aria-label="${esc(statsLabel(st))}"><div class="cr-last">${lastHtml(st)}</div><div class="cr-stats">${statsHtml(st)}</div></div>`;
}
const layoutBlock = l => `<div class="cps-layout">${layoutHtml({ bets: l.bets || {}, lit: new Set(l.lit || []), point: l.point ?? null, groups: l.groups, plain: true })}</div>`;
function termsHtml(terms) {
  return `<dl class="cs-terms">${terms.map(([zh, jp, en]) => `<div><dt>${esc(zh)}</dt><dd><i>${esc(jp)}</i>${esc(en)}</dd></div>`).join("")}</dl>`;
}

export function crapsStage() {
  let box = null;
  return {
    mount(b) { box = b; },
    task: () => false,
    hint() {},
    draw(s) {
      const parts = [];
      if (s.dice) parts.push(diceHtml(s.dice, s.call));
      if (s.ways) parts.push(waysHtml(s.ways));
      if (s.odds) parts.push(oddsHtml(s.odds));
      if (s.edges) parts.push(edgesHtml(s.edges));
      if (s.layout) parts.push(layoutBlock(s.layout));
      if (s.screen) parts.push(screenHtml(s.screen));
      if (s.terms) parts.push(termsHtml(s.terms));
      box.innerHTML = `<div class="cps">${parts.join("")}</div>`;
    },
  };
}
