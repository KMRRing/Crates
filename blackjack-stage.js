// Blackjack's stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step
// may carry any of:
//   hands: { dealer: "6", you: "8 8" } the dealer's cards and yours (several hands: you: ["8 3", "8 10"]), with totals;
//   chart: "hard" | "soft" | "pairs" basic strategy's chart for the table's rules, as blackjack-strategy.js works it
//     out, or { kind, row, up } with one cell picked out (and its row and column lit);
//   felt: true the rules as the felt prints them;
//   signals: true the hand signals the dealer reads;
//   terms: [[zh, jyutping, english]] words of the floor.
// Every exercise is a choice the course itself asks, so the stage only draws.
import { RULES, RANKS, rankOf, handOf, isBlackjack } from "./blackjack-engine.js";
import { feltWords, chartHtml } from "./blackjack-rules.js";
import { cardHtml } from "./cards.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** Cards written as text ("A 7 K"): their ids, suits dealt round so a hand's look varies (♠ ♥ ♣ ♦). */
export function parseCards(text, offset = 0) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).map((tok, i) => {
    const r = RANKS.indexOf(tok.toUpperCase() === "T" ? "10" : tok.toUpperCase());
    if (r < 0) throw new Error(`no card "${tok}"`);
    return r * 4 + [3, 2, 1, 0][(i + offset) % 4];
  });
}
const say = cards => { const h = handOf(cards); return isBlackjack(cards) ? "BJ" : h.soft && h.total < 21 ? `${h.total - 10}/${h.total}` : `${h.total}`; };
const row = (cards, cls = "") => `<div class="bjs-hand ${cls}"><div class="bj-cards">${cards.map(id => cardHtml({ rank: RANKS[rankOf(id)], suit: id & 3 })).join("")}</div><i class="bj-total">${cards.length ? say(cards) : ""}</i></div>`;
function handsHtml(h) {
  const dealer = parseCards(h.dealer, 1), yours = [h.you].flat().map((t, i) => parseCards(t, i * 2));
  return `<div class="bjs-felt"><div class="bjs-who">Dealer</div>${row(dealer)}<div class="bjs-who">You</div><div class="bjs-yours">${yours.map(c => row(c)).join("")}</div></div>`;
}

// the signals, drawn: a card and what your hand does over it
const ICON = {
  hit: '<rect x="9" y="12" width="15" height="21" rx="2"/><circle cx="31" cy="27" r="2.6" class="f"/><path d="M27 20.5a7 7 0 0 1 8 0M25.5 17a11 11 0 0 1 11 0"/>',
  stand: '<rect x="12.5" y="15" width="15" height="21" rx="2"/><path d="M8 8h24M8 8l3-3M8 8l3 3M32 8l-3-3M32 8l-3 3"/>',
  double: '<rect x="6" y="12" width="15" height="21" rx="2"/><circle cx="30" cy="21" r="5.5"/><circle cx="30" cy="29" r="5.5" class="f"/>',
  split: '<rect x="3" y="12" width="13" height="19" rx="2"/><rect x="24" y="12" width="13" height="19" rx="2"/><path d="M18 21.5h4M17 21.5l2.5-2.5M17 21.5l2.5 2.5M23 21.5l-2.5-2.5M23 21.5l-2.5 2.5"/>',
};
const SIGNALS = [["hit", "Hit", "tap the felt beside your cards"], ["stand", "Stand", "wave a flat hand over them"], ["double", "Double", "as much again beside your bet"], ["split", "Split", "the same again beside your bet"]];
function signalsHtml() {
  return `<div class="bjs-signals">${SIGNALS.map(([id, name, how]) => `<div><svg class="bjs-icon" viewBox="0 0 40 40" aria-hidden="true">${ICON[id]}</svg><b>${name}</b><small>${how}</small></div>`).join("")}</div>`;
}
function feltHtml() {
  const [one, two] = feltWords(RULES);
  return `<div class="bjs-print"><b>${esc(one)}</b><span>${esc(two)}</span></div>`;
}
function termsHtml(terms) {
  return `<dl class="cs-terms">${terms.map(([zh, jp, en]) => `<div><dt>${esc(zh)}</dt><dd><i>${esc(jp)}</i>${esc(en)}</dd></div>`).join("")}</dl>`;
}

export function blackjackStage() {
  let box = null;
  return {
    mount(b) { box = b; },
    task: () => false,
    hint() {},
    draw(s) {
      const parts = [];
      if (s.hands) parts.push(handsHtml(s.hands));
      if (s.felt) parts.push(feltHtml());
      if (s.chart) parts.push(chartHtml(s.chart, RULES));
      if (s.signals) parts.push(signalsHtml());
      if (s.terms) parts.push(termsHtml(s.terms));
      box.innerHTML = `<div class="bjs">${parts.join("")}</div>`;
    },
  };
}
