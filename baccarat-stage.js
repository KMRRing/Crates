// Baccarat's stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step
// may carry any of:
//   hands: { player: "8 2", banker: "K 3 5" } the two hands (a third card laid sideways), with their totals;
//   road: { kind: "big" | "bead" | 1 | 2 | 3 | "board", seq: "B B P T Bp…", flash: "B" | "P", w } a road from a run of results
//     (B, P, T; a b after one for a Banker pair, a p for a Player pair), the whole scoreboard for "board";
//   layout: { table: "commission" | "nocommission", stakes: { banker: 1000 } } the betting layout, chips on it;
//   sign: { min, max, side } a table's limit sign;
//   tableau: true the Banker's drawing rules as a chart, or { bt, v } with one cell picked out;
//   terms: [[zh, jyutping, english]] words the floor uses.
// Every exercise is a choice the course itself asks, so the stage only draws.
import { RANKS, SPOTS, rankOf, total, bankerDraws, MIN, MAX, SIDE_MAX } from "./baccarat-engine.js";
import { roadSvg, scoreboard } from "./baccarat-roads.js";
import { cardHtml } from "./cards.js";

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
function layoutHtml({ table = "commission", stakes = {} }) {
  const spots = SPOTS.filter(s => s.id !== "super6" || table === "nocommission");
  return `<div class="bc-spots bs-spots">${spots.map(sp => {
    const cls = sp.id === "player" || sp.id === "banker" ? "main" : sp.id === "super6" ? "wide" : "side";
    const pays = sp.id === "banker" && table === "nocommission" ? "1:1 · 6 pays ½" : sp.pays.replace(" to ", ":");
    return `<div class="bc-spot ${cls} ${sp.id}"><span class="zh">${sp.zh}</span><span class="en">${sp.name}</span><span class="odds">${pays}</span>${stakes[sp.id] ? `<span class="bc-stake">${stakes[sp.id] >= 1000 ? `${stakes[sp.id] / 1000}K` : stakes[sp.id]}</span>` : ""}</div>`;
  }).join("")}</div>`;
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
      if (s.layout) parts.push(layoutHtml(s.layout));
      if (s.sign) parts.push(signHtml(s.sign));
      if (s.tableau) parts.push(tableauHtml(s.tableau));
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
