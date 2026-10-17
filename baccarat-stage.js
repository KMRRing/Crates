// Baccarat's stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step
// may carry any of:
//   hands: { player: "8 2", banker: "K 3 5" } the two hands (a third card laid sideways), with their totals;
//   road: { kind: "big" | "bead" | 1 | 2 | 3 | "board", seq: "B B P T Bp…", flash: "B" | "P", w } a road from a run of results
//     (B, P, T; a b after one for a Banker pair, a p for a Player pair), the whole scoreboard for "board";
//   layout: { table: "commission" | "nocommission", sides: ["pairs", "six"…], stakes: { banker: 1000 } } the betting layout
//     with those side bets (SIDES), chips on it;
//   sign: { min, max, side } a table's limit sign;
//   tableau: true the Banker's drawing rules as a chart, or { bt, v } with one cell picked out;
//   terms: [[zh, jyutping, english]] words the floor uses;
//   peel: [{ card: "7", edge: "right" | "bottom" | "top" | "left", at: .5, label }] cards part squeezed, as stills;
//   burn: "7" the first card out of a new shoe, turned, and the cards it sends unseen to the discard.
// Every exercise is a choice the course itself asks, so the stage only draws.
import { RANKS, SPOTS, SIDES, rankOf, total, bankerDraws, burnCount, MIN, MAX, SIDE_MAX } from "./baccarat-engine.js";
import { roadSvg, scoreboard } from "./baccarat-roads.js";
import { peeledSvg } from "./baccarat-squeeze.js";
import { cardHtml, backHtml } from "./cards.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hk = n => `HK$${n.toLocaleString("en-GB")}`;
/** Cards written as text ("8 2 K"): their ids, suits dealt round so a hand's look varies (♠ ♥ ♣ ♦). */
export function parseHand(text, offset = 0) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).map((tok, i) => {
    const r = RANKS.indexOf(tok.toUpperCase() === "T" ? "10" : tok.toUpperCase());
    if (r < 0) throw new Error(`no card "${tok}"`);
    return r * 4 + [3, 2, 1, 0][(i + offset) % 4];
  });
}
/** A run of results written as text ("B Bb P Tp"): [{ w, bp, pp }]. */
export function parseSeq(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).map(tok => {
    if (!/^[BPT][bp]{0,2}$/.test(tok)) throw new Error(`no result "${tok}"`);
    return { w: tok[0], bp: tok.slice(1).includes("b"), pp: tok.slice(1).includes("p") };
  });
}

function handsHtml(h) {
  const side = (name, zh, cls, text, offset) => {
    const ids = parseHand(text, offset);
    const cards = ids.map((id, k) => cardHtml({ rank: RANKS[rankOf(id)], suit: id & 3 }, { cls: k === 2 ? "third" : "" })).join("");
    return `<div class="bs-hand ${cls}"><div class="bc-hand-head"><b>${zh}</b><span>${name}</span><i class="bc-total">${ids.length ? total(ids) : ""}</i></div><div class="bs-cards">${cards}</div></div>`;
  };
  return `<div class="bs-hands">${side("Player", "閒", "p", h.player, 0)}${side("Banker", "莊", "b", h.banker, 1)}</div>`;
}
const short = n => (n >= 1000 ? `${n / 1000}K` : String(n));
/** What a spot pays, in words, at this kind of table. */
export const paysAt = (sp, table) => (sp.id === "banker" && table === "nocommission" ? "1 to 1, half when it wins with six" : sp.pays);
/**
 * The betting layout as markup, the table's (buttons) and the course's pictures alike: the side bets above, the Tie first
 * and then those of the sets in `sides` (SIDES' ids, in SIDES' order), three to a row; Player and Banker below, nearest
 * the player. Each spot has its name (in Chinese too where the floor letters it so) and what it pays; `chip(id)` is what
 * lies on it (a stake, a result), `state(id)` its further classes, `label(id)` its name for a screen reader.
 */
export function layoutHtml({ table = "nocommission", sides = ["pairs"], chip = () => "", state = () => "", label = null, buttons = false, disabled = false } = {}) {
  const side = ["tie", ...SIDES.filter(sd => sides.includes(sd.id)).flatMap(sd => sd.spots)];
  const spot = (id, kind) => {
    const sp = SPOTS.find(x => x.id === id), odds = id === "banker" && table === "nocommission" ? "1:1, 6 pays ½" : sp.odds;
    const inner = kind === "main"
      ? `<span class="zh">${sp.zh}</span><span class="en">${sp.name} <i>${odds}</i></span>${chip(id)}`
      : `<span class="name">${sp.zh ? `<span class="zh">${sp.zh}</span>` : ""}<span class="en">${sp.tag || sp.name}</span></span><span class="odds">${chip(id)}${odds}</span>`;
    const cls = `bc-spot ${kind} ${id}${state(id)}`;
    return buttons ? `<button type="button" class="${cls}" data-spot="${id}"${disabled ? " disabled" : ""} aria-label="${esc(label ? label(id) : `${sp.name}, pays ${paysAt(sp, table)}`)}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
  };
  return `<div class="bc-sides" style="--cols: ${Math.min(3, side.length)}">${side.map(id => spot(id, "side")).join("")}</div><div class="bc-main">${["player", "banker"].map(id => spot(id, "main")).join("")}</div>`;
}
function stakesLayout({ table = "nocommission", sides = ["pairs"], stakes = {} }) {
  return `<div class="bc-spots bs-spots">${layoutHtml({ table, sides, chip: id => (stakes[id] ? `<span class="bc-stake">${short(stakes[id])}</span>` : "") })}</div>`;
}
function signHtml({ min = MIN, max = MAX, side = SIDE_MAX, title = "百家樂 Baccarat" }) {
  return `<div class="bs-sign"><b>${esc(title)}</b><span>Min ${hk(min)}</span><span>Max ${hk(max)}</span><small>和 Tie · 對子 Pairs: max ${hk(side)}</small></div>`;
}
/** The Banker's drawing chart: its total down the side, the Player's third card across; D draws, S stands. */
function tableauHtml(t) {
  const pick = typeof t === "object" ? t : null, heads = [..."0123456789"];
  const rows = [3, 4, 5, 6].map(bt => `<tr><th>${bt}</th>${heads.map(v => {
    const card = Number(v) === 0 ? 9 * 4 + 3 : (Number(v) - 1) * 4 + 3, d = bankerDraws(bt, card), here = pick && pick.bt === bt && pick.v === Number(v);
    return `<td class="${d ? "d" : "s"}${here ? " here" : ""}">${d ? "D" : "S"}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="bs-tableau"><caption>Banker's total ↓ · Player's third card →</caption><thead><tr><th></th>${heads.map(v => `<th>${v}</th>`).join("")}</tr></thead><tbody><tr><th>0–2</th><td colspan="10" class="d">always draws</td></tr>${rows}<tr><th>7</th><td colspan="10" class="s">always stands</td></tr></tbody></table>`;
}
/** Cards part peeled, side by side, each named under it. */
function peelHtml(cards) {
  return `<div class="bs-peel">${cards.map((c, i) => `<figure>${peeledSvg(parseHand(c.card, i)[0], c.edge || "right", c.at ?? .5, c.label || "")}${c.label ? `<figcaption>${esc(c.label)}</figcaption>` : ""}</figure>`).join("")}</div>`;
}
/** The burn: the shoe's first card turned, and as many after it face down as it counts (a 10 or a court card ten). */
function burnHtml(card) {
  const id = parseHand(card)[0], n = burnCount(id);
  return `<div class="bs-burn"><div class="bs-burn-row">${cardHtml({ rank: RANKS[rankOf(id)], suit: id & 3 })}<span class="bs-burn-n">+</span>${Array.from({ length: n }, () => backHtml()).join("")}</div><small>${n} burned unseen</small></div>`;
}
function termsHtml(terms) {
  return `<dl class="bs-terms">${terms.map(([zh, jp, en]) => `<div><dt>${esc(zh)}</dt><dd><i>${esc(jp)}</i>${esc(en)}</dd></div>`).join("")}</dl>`;
}

export function baccaratStage() {
  let box = null;
  return {
    mount(b) { box = b; },
    task: () => false,
    hint() {},
    draw(s) {
      const parts = [];
      if (s.hands) parts.push(handsHtml(s.hands));
      if (s.road) {
        const seq = parseSeq(s.road.seq);
        parts.push(`<div class="bs-road${s.road.kind === "board" ? " board" : ""}">${s.road.kind === "board" ? scoreboard(seq, { w: s.road.w || 20, bead: 6, flash: s.road.flash || null }) : roadSvg(s.road.kind, seq, { w: s.road.w || 12, flash: s.road.flash || null })}</div>`);
      }
      if (s.layout) parts.push(stakesLayout(s.layout));
      if (s.sign) parts.push(signHtml(s.sign));
      if (s.tableau) parts.push(tableauHtml(s.tableau));
      if (s.peel) parts.push(peelHtml(s.peel));
      if (s.burn) parts.push(burnHtml(s.burn));
      if (s.terms) parts.push(termsHtml(s.terms));
      box.innerHTML = `<div class="bs">${parts.join("")}</div>`;
      const cards = box.querySelectorAll(".bs-cards");
      if (cards.length) {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, room = box.clientHeight / (parts.length > 1 ? 2.2 : 1);
        const size = Math.max(.7 * rem, Math.min(room / 4.4, cards[0].clientWidth / 9.4, 2.4 * rem));
        for (const c of cards) c.style.fontSize = `${size}px`;
      }
    },
  };
}
