// Trumps: the trick-taking games of a Swiss, a French and a Bavarian table, four players, against the computer or with
// friends each on their own phone: Jass (the Schieber), Belote, Coinche and Schafkopf. The games are trumps-games.js's,
// the running seats.js's, the computer trumps-bot.js's. This page sets the table out the game's way round (Jass and
// Belote pass to the right, Schafkopf to the left), deals your hand along the foot, the trick in the middle, and the
// bidding under your hand: a tap on a card you may play plays it.
import { rules } from "./trumps-rules.js";
import { GAMES, teamOf, COINCHE_VALUES, laufende } from "./trumps-games.js";
import { LEVEL_NAMES } from "./trumps-bot.js";
import { PACKS, JASS_FRENCH, suitOf, rankOf, cardName } from "./trumps-cards.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "trumps:opts", RECORD = "trumps:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// the computer players, by the game's country
const BOTS = { jass: ["Ueli", "Vreni", "Beat"], belote: ["Gérard", "Martine", "Didier"], coinche: ["Gérard", "Martine", "Didier"], schafkopf: ["Sepp", "Resi", "Xaver"] };

let opts = { game: "jass", level: "medium", voice: true, jass: { pack: "swiss", count: "simple", target: 1000, weis: true }, belote: { target: 1000 }, coinche: { target: 2000 }, schafkopf: { deals: 8 }, ...read(OPTS, {}) };
if (!GAMES[opts.game]) opts.game = "jass";
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the cards ----------
// the Swiss and German packs' suit marks, drawn: bells, shields, roses, acorns; hearts, leaves
const ICONS = {
  bell: `<svg viewBox="0 0 20 20"><path d="M10 2.2a1.6 1.6 0 1 1 0 .01M4.6 9.5a5.4 5.4 0 0 1 10.8 0v3.6l1.6 2.1H3l1.6-2.1z" fill="#E1A82E" stroke="#5A3A12" stroke-width="1.1"/><path d="M4.8 11.6h10.4" stroke="#B3302A" stroke-width="1.6"/><circle cx="10" cy="16.6" r="1.6" fill="#5A3A12"/></svg>`,
  shield: `<svg viewBox="0 0 20 20"><path d="M3.5 3h13v6.5c0 4.2-3 6.7-6.5 8.2-3.5-1.5-6.5-4-6.5-8.2z" fill="#E1A82E" stroke="#3B2A12" stroke-width="1.1"/><path d="M3.6 3.1 16.4 13.8" stroke="#B3302A" stroke-width="3"/><path d="M10 3v14.5" stroke="#1E2730" stroke-width="1.1"/></svg>`,
  rose: `<svg viewBox="0 0 20 20"><path d="M5 15.5 2.4 18M15 15.5l2.6 2.5" stroke="#2F7D3B" stroke-width="1.6" stroke-linecap="round"/><g fill="#C2312A" stroke="#6E1610" stroke-width=".9"><circle cx="10" cy="5.2" r="3.3"/><circle cx="14.6" cy="8.6" r="3.3"/><circle cx="12.9" cy="14" r="3.3"/><circle cx="7.1" cy="14" r="3.3"/><circle cx="5.4" cy="8.6" r="3.3"/></g><circle cx="10" cy="10.2" r="2.8" fill="#E8C24A" stroke="#6E1610" stroke-width=".9"/></svg>`,
  acorn: `<svg viewBox="0 0 20 20"><path d="M10 1.8v2.4" stroke="#4A3016" stroke-width="1.4" stroke-linecap="round"/><path d="M4.6 8.4c0-2.8 2.4-4.4 5.4-4.4s5.4 1.6 5.4 4.4z" fill="#7A5226" stroke="#3A2410" stroke-width="1"/><path d="M5.4 8.4h9.2c0 5-2 9-4.6 9.6-2.6-.6-4.6-4.6-4.6-9.6z" fill="#D9A441" stroke="#5A3A12" stroke-width="1"/><path d="M6 6.4h8M5.4 7.6h9.2" stroke="#3A2410" stroke-width=".6" opacity=".6"/></svg>`,
  heart: `<svg viewBox="0 0 20 20"><path d="M10 17.6C4.2 13.2 2 10.2 2 7.2A4.2 4.2 0 0 1 10 5a4.2 4.2 0 0 1 8 2.2c0 3-2.2 6-8 10.4z" fill="#C2312A" stroke="#6E1610" stroke-width="1"/></svg>`,
  leaf: `<svg viewBox="0 0 20 20"><path d="M10 18.4V10M10 2C5 5.4 4.2 10.6 10 15.6 15.8 10.6 15 5.4 10 2z" fill="#3E8E3A" stroke="#1E4A1C" stroke-width="1.1" stroke-linejoin="round"/><path d="M10 4.4v11M10 7.6 7.4 6M10 10.4 7 8.6M10 7.6 12.6 6M10 10.4 13 8.6" stroke="#1E4A1C" stroke-width=".7"/></svg>`,
};
const SUIT_ICON = { swiss: ["bell", "shield", "rose", "acorn"], german: ["bell", "heart", "leaf", "acorn"] };
const packOf = s => GAMES[s.game].pack(s.opts);
/** A card as markup, in its game's pack. */
function card(id, s, { cls = "", data = {} } = {}) {
  const pack = packOf(s), p = PACKS[pack];
  if (pack === "french") {
    const suit = s.game === "jass" ? JASS_FRENCH[suitOf(id)] : suitOf(id);
    return cardHtml({ rank: p.rank[rankOf(id)], suit }, { cls, data, label: cardName(id, "french", s.game === "jass" ? JASS_FRENCH : null) });
  }
  const icon = ICONS[SUIT_ICON[pack][suitOf(id)]];
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  return `<span class="cd tr-cd ${pack}${cls ? ` ${cls}` : ""}"${attrs} role="img" aria-label="${esc(cardName(id, pack))}"><span class="cd-r">${p.rank[rankOf(id)]}</span><span class="tr-s">${icon}</span><span class="tr-pip">${icon}</span></span>`;
}
/** A suit's mark and name in the game's pack. */
function suitMark(s, suit) {
  const pack = packOf(s);
  if (pack === "french") { const f = s.game === "jass" ? JASS_FRENCH[suit] : suit; return { mark: `<span class="tr-fs${f === 0 || f === 2 ? " red" : ""}">${PACKS.french.suits[f]}</span>`, name: PACKS.french.en[f] }; }
  return { mark: `<span class="tr-icon">${ICONS[SUIT_ICON[pack][suit]]}</span>`, name: PACKS[pack].suits[suit] };
}

// ---------- the table ----------
let V = null, page = null;
page = seatPage({
  rules, id: "trumps", app: 1, pace: 650, botName: s => (BOTS[V?.state?.game || opts.game] || BOTS.jass)[(s + 3) % 3] || `Seat ${s + 1}`,
  level: () => opts.level, voice: () => opts.voice, onView: v => { V = v; draw(); }, onOver, toast, newGame,
});
const me = () => V?.seat ?? 0;
const nameOf = seat => V?.seats?.[seat]?.name ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
/** Where a seat sits from mine: the next to play on my right in Jass and Belote, on my left in Schafkopf. */
function placeOf(s, seat) {
  const d = (seat - me() + 4) % 4;
  if (d === 0) return "me";
  if (d === 2) return "top";
  return (d === 1) === GAMES[s.game].ccw ? "right" : "left";
}
const seatAt = (s, place) => [0, 1, 2, 3].find(i => placeOf(s, i) === place);

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("info").innerHTML = ""; for (const id of ["seatTop", "seatLeft", "seatRight"]) $(id).replaceChildren(); $("centre").innerHTML = ""; $("hand").innerHTML = ""; $("controls").innerHTML = `<button class="btn primary tr-go" type="button" data-act="new">New game</button>`; return; }
  drawInfo(v.state);
  for (const [id, place] of [["seatTop", "top"], ["seatLeft", "left"], ["seatRight", "right"]]) drawSeat($(id), v.state, seatAt(v.state, place));
  drawCentre(v.state);
  drawHand(v.state);
  drawControls(v.state);
}

/** The contract and the scores, along the top. */
function drawInfo(s) {
  const g = GAMES[s.game];
  let contract = "";
  const c = s.contract;
  if (c) {
    if (s.game === "jass") contract = c.mode === "trump" ? `${suitMark(s, c.suit).mark} ${esc(suitMark(s, c.suit).name)}` : c.mode === "obe" ? "Obenabe ▼" : "Undenufe ▲";
    else if (s.game === "schafkopf") contract = c.type === "sau" ? `Sauspiel ${suitMark(s, c.ace).mark}` : c.type === "wenz" ? "Wenz" : `Solo ${suitMark(s, c.trump).mark}`;
    else contract = `${s.game === "coinche" ? `${c.value === 250 ? "Capot" : c.value} ` : ""}${suitMark(s, c.suit).mark}${c.coinche ? ` ${c.coinche === 2 ? "surcoinché" : "coinché"}` : ""}`;
    const who = s.game === "jass" ? c.chooser : s.game === "schafkopf" ? c.declarer : c.taker;
    contract += ` <small>${esc(isMe(who) ? "you" : nameOf(who))}${s.game === "jass" && c.mult > 1 ? ` · ×${c.mult}` : ""}</small>`;
  }
  let score;
  if (g.teams === "fixed") {
    const mine = teamOf(me());
    score = `<span class="tr-score"><b>${s.scores[mine]}</b> us · <b>${s.scores[1 - mine]}</b> them <small>to ${s.opts.target}</small></span>`;
  } else score = `<span class="tr-score"><b>${s.scores[me()] > 0 ? "+" : ""}${s.scores[me()]}</b> you <small>deal ${s.handNo} of ${s.opts.deals}</small></span>`;
  $("info").innerHTML = `<span class="tr-game">${esc(g.name)}</span>${contract ? `<span class="tr-contract">${contract}</span>` : ""}${score}`;
}

/** What a seat last said this hand, for its bubble. */
function bidWords(s, b) {
  if (!b) return "";
  if (s.game === "jass") return b.t === "push" ? "Schiebe" : b.mode === "obe" ? "Obenabe" : b.mode === "unde" ? "Undenufe" : suitMark(s, b.suit).name;
  if (s.game === "belote") return b.t === "pass" ? "Passe" : b.suit != null ? `À ${suitMark(s, b.suit).name}` : "Je prends";
  if (s.game === "coinche") return b.t === "pass" ? "Passe" : b.t === "coinche" ? "Coinche !" : b.t === "surcoinche" ? "Surcoinche !" : `${b.value === 250 ? "Capot" : b.value} ${PACKS.french.suits[b.suit]}`;
  return b.t === "pass" ? "Weiter" : b.type === "sau" ? "I spui" : b.type === "wenz" ? "Wenz" : "Solo";
}
function drawSeat(box, s, seat) {
  const turn = rules.toMove(s) === seat, n = s.hands[seat].length;
  const last = [...s.bidlog].reverse().find(b => b.seat === seat);
  const bubble = s.step === "bid" && last ? `<span class="tr-bubble">${esc(bidWords(s, last))}</span>` : "";
  const team = GAMES[s.game].teams === "fixed" ? (teamOf(seat) === teamOf(me()) ? " partner" : "") : "";
  const role = s.contract && s.game === "schafkopf" && seat === s.contract.declarer ? `<span class="tr-role">plays</span>` : s.contract && s.game === "jass" && seat === s.contract.chooser ? `<span class="tr-role">trump</span>` : s.contract && (s.game === "belote" || s.game === "coinche") && seat === s.contract.taker ? `<span class="tr-role">took</span>` : "";
  const dealer = seat === s.dealer ? `<span class="tr-dealer" title="dealer">D</span>` : "";
  box.className = `tr-seat ${box.classList[1]}${turn ? " turn" : ""}${team}`;
  box.innerHTML = `<span class="tr-name">${esc(nameOf(seat))}${dealer}</span>${role}<span class="tr-backs">${Array.from({ length: Math.min(n, 9) }, () => backHtml()).join("")}</span>${bubble}${weisLine(s, seat)}`;
}
/** A Jass player's Weis, said during the first trick (the side with the best one scores all of its own). */
function weisLine(s, seat) {
  if (s.game !== "jass" || !s.weis || !s.contract || s.tricks.length > 1 || (s.tricks.length === 0 && s.trick.length === 0)) return "";
  const w = s.weis[seat] || [];
  if (!w.length) return "";
  const total = w.reduce((a, x) => a + x.value, 0);
  return `<span class="tr-weis">Weis ${total}</span>`;
}

/** The middle: the trick, each card on its player's side; the turned card while Belote is bid; a hand's score. */
function drawCentre(s) {
  const box = $("centre");
  if (s.step === "scored" || s.step === "over") { box.innerHTML = handResult(s); return; }
  const trick = s.step === "bid" ? [] : s.trick;
  const win = s.step === "trick" ? s.tricks.at(-1)?.winner : null;
  const cards = trick.map(t => `<span class="tr-play at-${placeOf(s, t.seat)}${t.seat === win ? " win" : ""}">${card(t.card, s)}</span>`).join("");
  let middle = "";
  if (s.step === "bid" && s.game === "belote") middle = `<span class="tr-turned">${card(s.turned, s)}<small>${s.round === 1 ? "turned up" : "round two"}</small></span>`;
  else if (s.step === "bid") middle = `<span class="tr-bidding">${esc(bidPrompt(s))}</span>`;
  box.innerHTML = `<div class="tr-trick">${cards}${middle}</div>${s.tricks.length && s.step === "play" && !s.trick.length ? `<span class="tr-count">trick ${s.tricks.length + 1}</span>` : ""}`;
}
function bidPrompt(s) {
  const who = isMe(s.turn) ? "you" : nameOf(s.turn);
  if (s.game === "jass") return `${s.pushed ? "Pushed: " : ""}${who} ${isMe(s.turn) ? "choose" : "chooses"} trumps`;
  if (s.game === "coinche") return s.auction.value ? `${s.auction.value} ${PACKS.french.suits[s.auction.suit]} by ${isMe(s.auction.by) ? "you" : nameOf(s.auction.by)}${s.auction.coinche ? ", coinché" : ""}` : "Bidding";
  if (s.game === "schafkopf") return s.call ? `${isMe(s.call.seat) ? "You play" : `${nameOf(s.call.seat)} plays`} ${s.call.type === "sau" ? "a Sauspiel" : s.call.type === "wenz" ? "a Wenz" : "a Solo"}` : "Who plays?";
  return "";
}
function handResult(s) {
  const r = s.result;
  if (!r) return "";
  const mine = teamOf(me());
  if (s.game === "schafkopf") {
    const c = s.contract, side = r.side.map(nameOf).join(" and ");
    return `<div class="tr-result"><b>${esc(side)} ${r.won ? "win" : "lose"}</b><span>${r.pts[0]} to ${r.pts[1]}${r.schwarz ? " · schwarz" : r.schneider ? " · Schneider" : ""}${r.laufende ? ` · ${r.laufende} Laufende` : ""}</span>
      <span class="tr-delta ${r.delta[me()] >= 0 ? "up" : "down"}">${r.delta[me()] >= 0 ? "+" : ""}${r.delta[me()]} for you</span><small>${c.type === "sau" ? "Sauspiel" : c.type === "wenz" ? "Wenz" : "Solo"}, ${r.amount} a player</small></div>`;
  }
  if (s.game === "jass") {
    const extra = t => [r.weis[t] ? `Weis ${r.weis[t]}` : "", r.stoeck[t] ? "Stöck 20" : "", r.match === t ? "match 100" : ""].filter(Boolean).join(", ");
    return `<div class="tr-result"><b>Us ${r.delta[mine]} · them ${r.delta[1 - mine]}</b><span>cards ${r.pts[mine]}${extra(mine) ? ` + ${extra(mine)}` : ""}${r.mult > 1 ? ` · ×${r.mult}` : ""}</span><small>them: cards ${r.pts[1 - mine]}${extra(1 - mine) ? ` + ${extra(1 - mine)}` : ""}</small></div>`;
  }
  const att = teamOf(s.contract.taker);
  return `<div class="tr-result"><b>${att === mine ? "We" : "They"} ${r.made ? "made it" : "went down"}</b><span>us ${r.delta[mine]} · them ${r.delta[1 - mine]}</span><small>cards ${r.pts[mine]} to ${r.pts[1 - mine]}${r.bel[mine] ? " · belote ours" : r.bel[1 - mine] ? " · belote theirs" : ""}</small></div>`;
}

/** Your hand along the foot: the cards you may play lifted on your turn. */
function drawHand(s) {
  const box = $("hand"), seat = V.seat;
  if (seat == null) { box.innerHTML = `<p class="tr-status">Watching: you sit down at the next game.</p>`; return; }
  const g = GAMES[s.game], hand = sortHand(s, s.hands[seat]);
  const mine = s.step === "play" && s.turn === seat, ok = mine ? new Set(g.legal(s, seat)) : null;
  box.innerHTML = hand.map(id => card(id, s, { cls: mine ? (ok.has(id) ? "ok" : "dim") : "", data: { card: id } })).join("");
  fitRow(box, hand.length, { max: 1.25 });
}
/** A hand sorted as a player holds it: by suit, trumps together and on the right, each suit high to low. */
function sortHand(s, hand) {
  const g = GAMES[s.game];
  const key = id => {
    let su = suitOf(id), hi;
    if (s.contract) {
      // a card's strength: how it fares led against the lowest of its suit
      const t = { ...s, trick: [] };
      hi = 0;
      for (const o of hand) if (o !== id && g.winner(t, [{ seat: 0, card: id }, { seat: 1, card: o }]) === 0) hi++;
      if (s.game === "schafkopf" && (rankOf(id) === "Q" || rankOf(id) === "J" || suitOf(id) === s.contract.trump) && !(s.contract.type === "wenz" && rankOf(id) !== "J")) su = 9;
      else if ((s.game === "jass" && s.contract.mode === "trump" && su === s.contract.suit) || ((s.game === "belote" || s.game === "coinche") && su === s.contract.suit)) su = 9;
    } else hi = ["6", "7", "8", "9", "T", "J", "Q", "K", "A"].indexOf(rankOf(id));
    return su * 100 + hi;
  };
  return [...hand].sort((a, b) => key(a) - key(b));
}
$("hand").addEventListener("click", async e => {
  const el = e.target.closest("[data-card]");
  const s = V?.state;
  if (!el || !s || s.step !== "play" || s.turn !== V.seat) return;
  const id = Number(el.dataset.card);
  if (!GAMES[s.game].legal(s, V.seat).includes(id)) { toast(followHint(s)); return; }
  const why = await page.move({ t: "card", card: id });
  if (why) toast(why);
});
function followHint(s) {
  if (s.game === "schafkopf" && s.contract.type === "sau" && s.hands[V.seat].some(id => rankOf(id) === "A" && suitOf(id) === s.contract.ace)) return "The called ace: it must come when its suit is led, and can't be thrown away";
  if (s.game === "belote" || s.game === "coinche") return "Follow suit; if you can't, trump (and beat a trump in), unless your partner holds the trick";
  if (s.game === "jass") return "Follow suit or trump; never under a trump already in, unless you've nothing else";
  return "Follow suit if you can";
}

// ---------- bidding ----------
let coincheValue = 0;
function drawControls(s) {
  const box = $("controls"), seat = V.seat;
  if (seat == null) { box.innerHTML = ""; return; }
  if (s.step === "over") {
    const won = s.winners.includes(seat);
    box.innerHTML = `<p class="tr-status">${won ? "You win" : "You lose"}</p><button class="btn primary tr-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  if (s.step !== "bid") {
    const who = s.step === "play" ? (isMe(s.turn) ? "Your card" : `${nameOf(s.turn)}…`) : s.step === "trick" ? `${isMe(s.tricks.at(-1).winner) ? "You take" : `${nameOf(s.tricks.at(-1).winner)} takes`} it` : "";
    box.innerHTML = `<p class="tr-status">${esc(who)}</p>`;
    return;
  }
  if (s.turn !== seat) { box.innerHTML = `<p class="tr-status">${esc(nameOf(s.turn))} ${s.game === "jass" ? "chooses" : "bids"}…</p>`; return; }
  const bids = GAMES[s.game].bids(s, seat), btn = (b, text, cls = "") => `<button class="btn tr-bid${cls ? ` ${cls}` : ""}" type="button" data-bid='${esc(JSON.stringify(b))}'>${text}</button>`;
  let html = "";
  if (s.game === "jass") {
    html = `<p class="tr-status">${s.pushed ? "Your partner pushed it to you: choose" : "Choose trumps, or push to your partner"}</p><div class="tr-bids six">${bids.filter(b => b.t === "trump").map(b => {
      const mult = s.opts.count === "swiss" ? ` <small>×${multOf(s, b)}</small>` : "";
      return btn(b, b.mode === "trump" ? `${suitMark(s, b.suit).mark}<span>${esc(suitMark(s, b.suit).name)}${mult}</span>` : `<span>${b.mode === "obe" ? "Obenabe ▼" : "Undenufe ▲"}${mult}</span>`);
    }).join("")}</div>${bids.some(b => b.t === "push") ? `<div class="tr-bids one">${btn({ t: "push" }, "Schiebe: push to your partner")}</div>` : ""}`;
  } else if (s.game === "belote") {
    html = s.round === 1 ? `<p class="tr-status">Take ${suitMark(s, suitOf(s.turned)).name} as trumps, with the turned card?</p><div class="tr-bids two">${btn({ t: "pass" }, "Passe")}${btn({ t: "take" }, `Je prends ${suitMark(s, suitOf(s.turned)).mark}`, "primary")}</div>`
      : `<p class="tr-status">Name another suit as trumps, or pass</p><div class="tr-bids four">${bids.map(b => btn(b, b.t === "pass" ? "Passe" : suitMark(s, b.suit).mark)).join("")}</div>`;
  } else if (s.game === "coinche") {
    const values = [...new Set(bids.filter(b => b.t === "bid").map(b => b.value))];
    if (!values.includes(coincheValue)) coincheValue = values[0] ?? 0;
    const special = bids.filter(b => b.t === "coinche" || b.t === "surcoinche");
    html = `<p class="tr-status">${s.auction.value ? `${s.auction.value} ${PACKS.french.suits[s.auction.suit]} to beat` : "Open the bidding (80 or more), or pass"}</p>
      ${values.length ? `<div class="tr-coinche"><button class="btn tr-step" type="button" data-act="less" ${values.indexOf(coincheValue) > 0 ? "" : "disabled"}>−</button><b class="tr-value">${coincheValue === 250 ? "Capot" : coincheValue}</b><button class="btn tr-step" type="button" data-act="more" ${values.indexOf(coincheValue) < values.length - 1 ? "" : "disabled"}>+</button></div>
      <div class="tr-bids four">${[0, 1, 2, 3].map(su => btn({ t: "bid", value: coincheValue, suit: su }, suitMark(s, su).mark)).join("")}</div>` : ""}
      <div class="tr-bids ${special.length ? "two" : "one"}">${btn({ t: "pass" }, "Passe")}${special.map(b => btn(b, b.t === "coinche" ? "Coinche !" : "Surcoinche !", "primary")).join("")}</div>`;
  } else {
    const sau = bids.filter(b => b.type === "sau"), solo = bids.filter(b => b.type === "solo"), wenz = bids.find(b => b.type === "wenz");
    html = `<p class="tr-status">${s.call ? `Over ${s.call.type === "sau" ? "a Sauspiel" : s.call.type === "wenz" ? "a Wenz" : "a Solo"}?` : "Play, or pass (weiter)?"}</p>
      ${sau.length ? `<div class="tr-bids three">${sau.map(b => btn(b, `Sauspiel ${suitMark(s, b.ace).mark}<small>auf die ${esc(PACKS.german.suits[b.ace])}-Sau</small>`)).join("")}</div>` : ""}
      <div class="tr-bids five">${wenz ? btn(wenz, "Wenz") : ""}${solo.map(b => btn(b, `Solo ${suitMark(s, b.suit).mark}`)).join("")}</div>
      <div class="tr-bids one">${btn({ t: "pass" }, "Weiter")}</div>`;
  }
  box.innerHTML = html;
}
const multOf = (s, b) => (b.mode === "obe" ? 3 : b.mode === "unde" ? 4 : s.opts.pack === "french" ? [2, 1, 2, 1][b.suit] : [2, 2, 1, 1][b.suit]);

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  if (b.dataset.act === "new") { newGame(); return; }
  if (b.dataset.act === "result") { showEnd(V); return; }
  if (b.dataset.act === "less" || b.dataset.act === "more") {
    const values = [...new Set(GAMES.coinche.bids(V.state, V.seat).filter(x => x.t === "bid").map(x => x.value))];
    coincheValue = values[Math.max(0, Math.min(values.length - 1, values.indexOf(coincheValue) + (b.dataset.act === "more" ? 1 : -1)))];
    drawControls(V.state);
    return;
  }
  if (b.dataset.bid) {
    const why = await page.move(JSON.parse(b.dataset.bid));
    if (why) toast(why);
  }
});

// ---------- the end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("trumps", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1500);
}
function showEnd(v) {
  const s = v.state, won = s.winners.includes(v.seat ?? -1), g = GAMES[s.game];
  $("endHead").textContent = won ? "You win" : `${s.winners.map(nameOf).join(" and ")} ${s.winners.length > 1 ? "win" : "wins"}`;
  const rows = g.teams === "fixed"
    ? [0, 1].map(t => `<li class="${s.winners.includes(t) ? "won" : ""}${teamOf(me()) === t ? " me" : ""}"><span class="nm">${esc(nameOf(t))} and ${esc(nameOf(t + 2))}</span><b>${s.scores[t]}</b></li>`)
    : [0, 1, 2, 3].sort((a, b) => s.scores[b] - s.scores[a]).map(i => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nameOf(i))}</span><b>${s.scores[i] > 0 ? "+" : ""}${s.scores[i]}</b></li>`);
  $("endBody").innerHTML = `<ol class="tr-standings">${rows.join("")}</ol><p class="tr-end-note">${g.name}, ${s.handNo} ${s.handNo === 1 ? "hand" : "hands"}.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  page.deal({ game: opts.game, ...opts[opts.game] }, 4);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
const RULES = {
  jass: `<p>The Schieber, Switzerland's Jass: four players, partners sitting across, 36 cards (Swiss: bells, shields, roses, acorns; Under, Ober, King, Ace, the ten is the Banner), nine each. Play passes to the right.</p>
    <h3>Trumps</h3><p>The player after the dealer chooses: a suit as trumps, Obenabe (no trumps, the highest card of the suit led wins) or Undenufe (no trumps, the lowest wins: the six is highest); or pushes (schiebt) the choice to the partner, who must then choose. They lead the first trick either way.</p>
    <p>In trumps the Under (the Bauer, 20) is highest, then the nine (the Nell, 14), then the ace (11), king (4), Ober (3), Banner (10), 8, 7, 6. Other suits: ace (11), king (4), Ober (3), Under (2), Banner (10), 9, 8, 7, 6. In Obenabe and Undenufe each 8 is worth 8, and in Undenufe the six is worth 11 and the ace nothing. The last trick adds 5: 157 in all, and taking all nine tricks (a match) 100 more.</p>
    <h3>Playing</h3><p>Follow suit, or trump: you may always trump, but never under a trump already in the trick (unless you've only trumps). The Bauer never has to be played: holding it as your only trump, you needn't follow trumps.</p>
    <h3>Weis and Stöck</h3><p>Runs of three or more in a suit (20, 50, 100, then 50 more a card) and four alike (Unders 200, nines 150, aces, kings, Obers and Banners 100) are counted in the first trick; only the side with the best single Weis scores, all of its own. The king and Ober of trumps in one hand (Stöck) score 20.</p>
    <p class="tr-rules-note">Menu: the French pack, the Swiss count (acorns and roses single, shields and bells double, Obenabe three, Undenufe four times) and the target.</p>`,
  belote: `<p>Belote, the classic: four players, partners across, 32 cards, play to the right. Five cards each, and one turned up: in turn, take its suit as trumps (the taker gets the turned card and two more) or pass; if all pass, each may name another suit; if all pass again, it's dealt anew. Everyone else gets three more: eight each.</p>
    <h3>The cards</h3><p>Trumps: jack (20), nine (14), ace (11), ten (10), king (4), queen (3), 8, 7. Other suits: ace (11), ten (10), king (4), queen (3), jack (2), 9, 8, 7. The last trick adds 10 (dix de der): 162. King and queen of trumps in one hand (belote, rebelote): 20.</p>
    <h3>Playing</h3><p>Follow suit. If you can't, trump, over any trump already in, unless your partner holds the trick (then play anything). When trumps are led, beat the best trump in if you can.</p>
    <h3>Scoring</h3><p>The takers must make more than the others; if they do, each side scores its points, else the others score 162. All eight tricks (capot): 250. The first side to the target wins.</p>`,
  coinche: `<p>Coinche: Belote with an auction. Eight cards each. In turn, bid a contract (80 to 160 in tens, or capot, all the tricks) with its trump suit, over the last bid, or pass; an opponent may coinche (double) a bid, and the bidder's side may then surcoinche (redouble). Three passes after a bid end the auction; four passes with no bid, a new deal.</p>
    <p>The play is Belote's. The bidders must make their contract in points (belote counted). Made: they score the contract (doubled or redoubled) and, if not coinched, their points rounded to ten, the others theirs. Down: the others score 160 and the contract (doubled or redoubled). Belote, 20, to whoever holds it. The first side to the target wins.</p>`,
  schafkopf: `<p>Schafkopf, Bavaria's: four players, 32 German-suited cards (acorns, leaves, hearts, bells; Unter, Ober, King, Sau, the ace), eight each. Play passes to the left. Each player in turn says whether they'd play, and what; a Solo beats a Wenz, a Wenz a Sauspiel; if all pass, it's thrown in.</p>
    <h3>The games</h3><p>Sauspiel: hearts and all Obers and Unters are trumps; you call an ace (Sau) you don't hold, of a suit you do, and its holder is your secret partner. Wenz: only the four Unters are trumps, you alone against three. Solo: the Obers, Unters and your suit are trumps, you alone. Among trumps the Obers come first, then the Unters (each acorns, leaves, hearts, bells), then the suit's ace, ten, king, 9, 8, 7.</p>
    <h3>Playing</h3><p>Follow the suit led (trumps are one suit: an Ober or Unter is a trump, whatever its suit); if you can't, play anything. The called Sau must be played when its suit is first led, can't be thrown away before the last trick, and its holder can't lead another card of that suit (unless holding four of it).</p>
    <h3>Scoring</h3><p>Aces 11, tens 10, kings 4, Obers 3, Unters 2: 120. The players win with 61. A Sauspiel is worth the tariff (10), a Solo or Wenz 50, with 10 more for Schneider (the losers under 31), 10 more for schwarz (no trick) and 10 for each Laufende (the top trumps one side holds unbroken, three or more, two in a Wenz). In a Sauspiel each of the losing pair pays one of the winners; a soloist is paid by, or pays, all three.</p>`,
};
function showRules() {
  const g = V?.state?.game || opts.game;
  $("rulesBody").innerHTML = RULES[g];
  $("rulesDlg").showModal();
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const content = part(body, "content");
  content.append(choice("Game", [["jass", "Jass"], ["belote", "Belote"], ["coinche", "Coinche"], ["schafkopf", "Schafkopf"]], opts.game, v => { opts.game = v; saveOpts(); openMenu(); }));
  const set = part(body, "settings"), o = opts[opts.game];
  if (opts.game === "jass") {
    set.append(choice("Cards", [["swiss", "Swiss"], ["french", "French"]], o.pack, v => { o.pack = v; saveOpts(); }));
    set.append(choice("Count", [["simple", "All single"], ["swiss", "×1 to ×4"]], o.count, v => { o.count = v; saveOpts(); }));
    set.append(choice("Play to", [[1000, "1000"], [1500, "1500"], [2500, "2500"], [3000, "3000"]], o.target, v => { o.target = Number(v); saveOpts(); }));
    set.append(toggle("Weis and Stöck", o.weis, on => { o.weis = on; saveOpts(); }));
  } else if (opts.game === "belote") set.append(choice("Play to", [[501, "501"], [1000, "1000"]], o.target, v => { o.target = Number(v); saveOpts(); }));
  else if (opts.game === "coinche") set.append(choice("Play to", [[1000, "1000"], [2000, "2000"]], o.target, v => { o.target = Number(v); saveOpts(); }));
  else set.append(choice("Deals", [[8, "8"], [16, "16"], [24, "24"]], o.deals, v => { o.deals = Number(v); saveOpts(); }));
  set.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line("The game and its settings apply from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "trumps");
document.querySelector(".tr-mark").innerHTML = APPS.find(a => a.id === "trumps")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => { if (V?.G) drawHand(V.state); });
window.__trumps = { page, get view() { return V; }, opts, laufende };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
