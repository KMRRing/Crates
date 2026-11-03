// Factor's one trade sheet. You pick what you give and what you ask for as tiles (the five resources and a "?" for any kind) with
// a toggle at the top, Players | Bank, and the sheet is the same in both: the bank fixes the other side to itself at your
// rates (shown on the tiles) and trades at once; Players sends the offer to the table, whose answers are counter-proposals
// naming the specific cards, which you take one of or turn all down. The same tiles answer an offer that comes to you.
// This file is the sheet's arithmetic and markup (pure strings, tested in Node); factor.js keeps its state and the taps.
import { MAX_ANY, MAX_OFFERS, cards, rates, bankOf, bankFit, bankWhy, counterWhy, answerOf, isExact } from "./factor-rules.js";
import { RES } from "./factor-board.js";
import { resIcon } from "./factor-draw.js";

const sum = a => a.reduce((t, x) => t + x, 0);
const ZERO = () => [0, 0, 0, 0, 0];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A fresh compose state: nothing chosen; `mode` "players" or "bank" (the toggle). */
export const newTrade = (mode = "bank") => ({ mode, give: ZERO(), ag: 0, get: ZERO(), aw: 0 });
/** The compose state with a side's counts changed, as the tiles allow. side "g" (give) or "w" (get), k 0..4 or 5 for "?", dir ±1. */
export function stepTrade(t, s, me, side, k, dir) {
  const bank = t.mode === "bank", hand = s.hand[me], rt = rates(s, me), give = side === "g", arr = give ? t.give : t.get;
  if (k === 5) {
    const key = give ? "ag" : "aw", total = sum(arr) + t[key];
    if (dir > 0 && t[key] < MAX_ANY && (!give || total < cards(s, me))) t[key]++;
    else if (dir < 0 && t[key] > 0) t[key]--;
    return t;
  }
  const by = give && bank ? rt[k] : 1, other = give ? t.get : t.give;
  if (dir > 0) {
    if (other[k] > 0) return t;
    const cap = give ? hand[k] : bank ? bankOf(s, k) : 9;
    if (arr[k] + by <= cap) arr[k] += by;
  } else arr[k] = Math.max(0, arr[k] - by);
  return t;
}
/** Switching to the bank: what is given is rounded down to whole lots of each kind's rate. */
export function toMode(t, s, me, mode) {
  t.mode = mode;
  if (mode === "bank") { const rt = rates(s, me); t.give = t.give.map((n, k) => n - (n % rt[k])); }
  return t;
}

/**
 * What the compose sheet would do now: { move, why, give, get } (move: the engine's, or null with `why` in words, "" when
 * there is nothing yet to say). Players: the offer as chosen, with its ?s. Bank: the trade that fits the ?s, if any.
 * `order`: the kinds the bank's "?" should ask for first.
 */
export function resolve(s, me, t, { on, order }) {
  const spec = { give: t.give, get: t.get, ag: t.ag, aw: t.aw };
  if (!on) return { move: null, why: "Trade on your own turn, after the roll.", ...spec };
  if (sum(t.give) + t.ag < 1 || sum(t.get) + t.aw < 1) return { move: null, why: "", ...spec };
  if (t.mode === "players") {
    if (s.offers >= MAX_OFFERS) return { move: null, why: "No offers left this turn.", ...spec };
    if (t.give.some((n, i) => n > s.hand[me][i])) return { move: null, why: "You don't hold that.", ...spec };
    if (sum(t.give) + t.ag > cards(s, me)) return { move: null, why: "You don't hold that many cards.", ...spec };
    return { move: { t: "offer", give: [...t.give], get: [...t.get], ag: t.ag, aw: t.aw }, why: "", ...spec };
  }
  const fit = bankFit(s, me, t.give, t.ag, t.get, t.aw, order);
  if (!fit) {
    const why = t.ag || t.aw ? "The bank can't make that trade from what you hold." : bankWhy(s, me, t.give, t.get) || "The bank can't make that trade.";
    return { move: null, why, ...spec };
  }
  return { move: { t: "bank", give: fit.give, get: fit.get }, why: "", ...spec, give: fit.give, get: fit.get, ag: 0, aw: 0, fitted: !!(t.ag || t.aw) };
}

// ---------- markup ----------
const chip = (n, k) => `<span class="fc-tc"><b>${n}</b>${resIcon(k, "in")}</span>`;
/** A trade in small pictures: each kind's cards, and "any" for the ?s. */
export const tradeChips = (c, any = 0) => [...c.map((n, k) => (n ? chip(n, k) : "")), ...(any ? [`<span class="fc-tc"><b>${any}</b><i class="fc-q in" aria-hidden="true">?</i></span>`] : [])].join("") || `<span class="fc-tc">nothing</span>`;
/** Words for a trade, for a screen reader or a line: "2 timber, 1 clay and 1 of any kind". */
export const tradeText = (c, any = 0) => [...c.map((n, k) => (n ? `${n} ${RES[k]}` : "")).filter(Boolean), ...(any ? [`${any} of any kind`] : [])].join(", ") || "nothing";

/** One tile: a resource (or "?") with its count, tapped to add one lot, and a smaller button to take one away. */
function tile(side, k, n, { sub = "", up = true, down = n > 0, verb }) {
  const name = k === 5 ? "any kind" : RES[k];
  return `<div class="fc-tl ${k === 5 ? "any" : `r${k}`}${n ? " has" : ""}">
    <button type="button" class="fc-tb" data-add="${side},${k}" ${up ? "" : "disabled"} aria-label="${verb} more ${name}">${k === 5 ? `<i class="fc-q" aria-hidden="true">?</i>` : resIcon(k)}<b>${n}</b><small>${sub}</small></button>
    <button type="button" class="fc-tm" data-sub="${side},${k}" ${down ? "" : "disabled"} aria-label="${verb} fewer ${name}">−</button></div>`;
}
const tiles = (side, arr, any, per, verb, withAny = true) => `<div class="fc-tiles">${[0, 1, 2, 3, 4].map(k => tile(side, k, arr[k], { verb, ...per(k) })).join("")}${withAny ? tile(side, 5, any, { verb, ...per(5) }) : `<span></span>`}</div>`;

/** The compose sheet: the toggle, the two rows of tiles, what it comes to, the send button. */
export function composeHtml(s, me, t, r, { on }) {
  const hand = s.hand[me], rt = rates(s, me), bank = t.mode === "bank";
  const give = tiles("g", t.give, t.ag, k => (k === 5
    ? { sub: "any", up: on && t.ag < MAX_ANY && sum(t.give) + t.ag < cards(s, me) }
    : { sub: bank ? `${rt[k]}:1` : `have ${hand[k]}`, up: on && t.get[k] === 0 && t.give[k] + (bank ? rt[k] : 1) <= hand[k] }), "Give", true);
  const ask = tiles("w", t.get, t.aw, k => (k === 5
    ? { sub: "any", up: on && t.aw < MAX_ANY }
    : { sub: bank ? `bank ${bankOf(s, k)}` : "", up: on && t.give[k] === 0 && bankOf(s, k) > (bank ? t.get[k] : -1) }), "Ask for", true);
  const seg = `<div class="fc-seg" role="tablist" aria-label="Trade with"><button type="button" role="tab" data-mode="players" aria-selected="${!bank}" class="${bank ? "" : "on"}">Players</button><button type="button" role="tab" data-mode="bank" aria-selected="${bank}" class="${bank ? "on" : ""}">Bank</button></div>`;
  const has = sum(r.give) + r.ag > 0 || sum(r.get) + r.aw > 0;
  const line = has ? `<div class="fc-sum" aria-label="${esc(`Give ${tradeText(r.give, r.ag)}, get ${tradeText(r.get, r.aw)}`)}"><span>${tradeChips(r.give, r.ag)}</span><i class="fc-arrow" aria-hidden="true">→</i><span>${tradeChips(r.get, r.aw)}</span>${r.fitted ? `<em>fitted</em>` : ""}</div>` : "";
  const left = MAX_OFFERS - s.offers;
  const note = r.why ? `<p class="fc-tnote">${esc(r.why)}</p>` : !bank && on ? `<p class="fc-tnote">${left > 0 ? `${left} ${left === 1 ? "offer" : "offers"} left this turn.` : "No offers left this turn."}</p>` : "";
  return `${seg}<h3>${bank ? "Give" : "Offer"}</h3>${give}<h3>${bank ? "Get" : "Ask for"}</h3>${ask}${line}
    <button type="button" class="btn primary fc-offer" data-send="1" ${r.move ? "" : "disabled"}>${bank ? "Trade with the bank" : "Offer to the table"}</button>${note}`;
}

/** The answer sheet for an offer to you: the same tiles, filled in with a first guess; yes if it is the offer as it stands, else a counter. */
export function answerHtml(s, me, a, { name, skipping }) {
  const o = s.offer, hand = s.hand[me], proposer = s.hand[o.from], fixed = o.ag > 0 || o.aw > 0;
  // `a.give` is what the proposer gives (you get), `a.get` what you give
  const needGet = sum(o.get) + o.aw, needGive = sum(o.give) + o.ag;
  const yourSide = tiles("g", a.get, 0, k => ({
    sub: `have ${hand[k]}`,
    up: k < 5 && a.give[k] === 0 && a.get[k] < hand[k] && (!fixed || sum(a.get) < needGet),
    down: k < 5 && a.get[k] > (fixed ? o.get[k] : 0),
  }), "Give", false);
  const theirSide = tiles("w", a.give, 0, k => ({
    sub: `has ${proposer[k]}`,
    up: k < 5 && a.get[k] === 0 && a.give[k] < proposer[k] && (!fixed || sum(a.give) < needGive),
    down: k < 5 && a.give[k] > (fixed ? o.give[k] : 0),
  }), "Get", false);
  const why = counterWhy(s, me, a), exact = !fixed && isExact(o, a);
  const head = `<p class="fc-asks"><b>${esc(name)}</b> offers ${tradeChips(o.give, o.ag)} for ${tradeChips(o.get, o.aw)}</p>`;
  const hint = fixed ? `<p class="fc-tnote">Name the cards for each ?: ${[o.ag ? `${o.ag} of theirs` : "", o.aw ? `${o.aw} of yours` : ""].filter(Boolean).join(" and ")}.</p>` : "";
  return `${head}<h3>You give</h3>${yourSide}<h3>You get</h3>${theirSide}${hint}
    <div class="fc-answer"><button type="button" class="btn" data-answer="no">No</button><button type="button" class="btn primary" data-answer="${exact ? "yes" : "counter"}" ${why ? "disabled" : ""}>${exact ? "Yes" : "Counter"}</button></div>
    <button type="button" class="btn fc-skip${skipping ? " on" : ""}" data-skip="1">Skip trades</button><p class="fc-tnote">${why && !exact && fixed ? esc(why.replace(/\{s\d+\}/g, "They")) : "Skip trades turns down every offer until your own turn comes round."}</p>`;
}

/** The answers to your offer: each seat's counter in pictures, to take one of or turn them all down. */
export function pickHtml(s, who) {
  const o = s.offer;
  const rows = o.resp.map((r, i) => {
    if (i === o.from) return "";
    const a = answerOf(o, i), name = esc(who(i));
    if (!a) return `<li class="no"><span class="nm"><i class="fc-sw p${i}"></i>${name}</span><span class="fc-tnote">no</span></li>`;
    const exact = isExact(o, a);
    return `<li><span class="nm"><i class="fc-sw p${i}"></i>${name}</span><span class="fc-sum" aria-label="${esc(`${who(i)}: you give ${tradeText(a.give)}, you get ${tradeText(a.get)}`)}">${tradeChips(a.give)}<i class="fc-arrow" aria-hidden="true">→</i>${tradeChips(a.get)}</span>
      <button type="button" class="btn primary" data-take="${i}">${exact ? "Yes" : "Accept"}</button></li>`;
  }).join("");
  return `<p class="fc-asks">You offered ${tradeChips(o.give, o.ag)} for ${tradeChips(o.get, o.aw)}</p><ul class="fc-answers">${rows}</ul><button type="button" class="btn fc-offer" data-take="-1">Decline all</button>`;
}
