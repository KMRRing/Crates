// Contract's table (Menu, View: Table): the pieces that make the page a bridge table on Table 2.0's surface (table3d.css,
// .tk-surface), as pure strings and numbers so Node can test them. contract.js draws them; contract-3d.css dresses them.
//   plaqueHtml     the brass plaque: the contract and who is vulnerable
//   wonHtml        the tricks a side has taken, stacked at the table's edge
//   columnsHtml    a hand laid face up in columns, a suit a column, the cards overlapping so each shows its rank
//   columnsEm      how large those cards may be in the room a seat has
//   callKind       the colour of a bid card: pass green, double red, redouble blue (as a bidding box's)
import { HOLD_ORDER, suitOf } from "./contract-core.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** "pass", "x", "xx" or "bid": what a call's card looks like. */
export const callKind = call => (call === "P" ? "pass" : call === "X" ? "x" : call === "XX" ? "xx" : "bid");

/**
 * The plaque screwed to the rail: the contract (`contract`: markup, "" while it is bid) and its declarer, the deal, and a tab for
 * each side that is vulnerable lit in red enamel. `vul` is [north–south, east–west]; `mine` the side you play for (it is named
 * first). Tapping it opens the auction (the page wires `data-act="auction"`).
 */
export function plaqueHtml({ contract = "", declarer = "", deal = 1, deals = 4, vul = [false, false], mine = 0, label = "" }) {
  const tab = (side, word) => `<i class="bd-vt${vul[side] ? " on" : ""}${side === mine ? " us" : ""}">${word}</i>`;
  const sides = [mine, 1 - mine].map(side => tab(side, side === 0 ? "N–S" : "E–W")).join("");
  const body = contract
    ? `<span class="bd-pl-c">${contract}<small class="bd-pl-d">${esc(declarer)}</small></span>`
    : `<span class="bd-pl-c idle">Bidding</span>`;
  const tag = contract ? "button" : "span";
  return `<${tag} class="bd-plaque${contract ? "" : " idle"}"${contract ? ` type="button" data-act="auction"` : ""} aria-label="${esc(label)}">`
    + `<span class="bd-pl-n">Deal ${deal}/${deals}</span>${body}<span class="bd-pl-v" aria-hidden="true">${sides}</span></${tag}>`;
}

/** The tricks a side has taken: a packet of cards face down for each, laid one on the last (at most 13), and the count. */
export function wonHtml(n, { label = "", us = false } = {}) {
  const k = Math.max(0, Math.min(13, Math.floor(n) || 0));
  const packets = Array.from({ length: k }, (_, i) => `<i class="bd-pk" style="--k:${i}"></i>`).join("");
  return `<span class="bd-won${us ? " us" : ""}${k ? "" : " none"}" aria-label="${esc(`${label}: ${k} ${k === 1 ? "trick" : "tricks"}`)}"><span class="bd-pile">${packets}</span><b class="bd-wn">${esc(label)} ${k}</b></span>`;
}

/**
 * A hand laid face up in columns, spades, hearts, clubs, diamonds left to right, the highest card of each at the top. `card(c)`
 * gives a card's markup. A suit the hand has none of is an empty slot, so the columns stay where they were as the play goes on.
 */
export function columnsHtml(hand, card) {
  return `<span class="bd-cols">${HOLD_ORDER.map(s => {
    const cs = hand.filter(c => suitOf(c) === s).sort((a, b) => b - a);
    return `<span class="bd-col${cs.length ? "" : " void"}" data-suit="${s}">${cs.map(c => card(c)).join("")}</span>`;
  }).join("")}</span>`;
}

/** The longest column of a hand laid in columns, in cards. */
export const tallest = hand => Math.max(0, ...HOLD_ORDER.map(s => hand.filter(c => suitOf(c) === s).length));

/**
 * The font size (px) at which a hand's columns fit a room { w, h }: four cards across (2.5em each, a quarter between) and the
 * tallest column down (3.5em for the last card and 1.25em for each above it); no larger than `max`.
 */
export function columnsEm(room, longest, { max = 15, gap = 0.25, strip = 1.25 } = {}) {
  if (!(room.w > 0) || !(room.h > 0)) return 0;
  const across = room.w / (4 * 2.5 + 3 * gap), down = room.h / (3.5 + Math.max(0, longest - 1) * strip);
  return Math.min(max, across, down);
}

