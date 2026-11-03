// Factor, an island trading game against computer players, or at a table with friends each on their own phone. The rules
// and words are factor-rules.js's (the island's geometry factor-board.js's), the computer players factor-bot.js's, the
// running seats.js's (seats-ui.js), the island's picture factor-draw.js's. This page draws the players across the top, the
// island, your hand and your buttons below it; a tap on a ringed corner, edge or hex is the move the step asks for, and the
// build buttons ring where a road, post or factory may go.
import { rules, COSTS, TARGETS, DEFAULTS, CARD_NAMES, CARD_TEXT, cards, pointsOf, roadLength, playable, piecesLeft, postSpots, roadSpots, factorySpots, victims, has } from "./factor-rules.js";
import { LEVEL_NAMES, suggest, wants } from "./factor-bot.js";
import { newTrade, stepTrade, toMode, resolve, composeHtml, answerHtml, pickHtml } from "./factor-trade.js";
import { startSkip, settle, declines, asked } from "./factor-skip.js";
import { HEXES, RES } from "./factor-board.js";
import { boardSvg, resIcon, ASPECT } from "./factor-draw.js";
import { rulesHtml } from "./factor-sheet.js";
import { handIcon, devIcon, roadIcon, fleetCard } from "./factor-icons.js";
import { flightsBetween, markOf, worth } from "./factor-flights.js";
import { createFlights } from "./factor-fly.js";
import { seatPage, fillNames } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "factor:opts", RECORD = "factor:record";
const VIEW = "suite:factor-view";             // the camera the player arranged: suite: keys stay on the device (its screen is its own)
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sum = a => a.reduce((t, x) => t + x, 0);
const NAMES = ["Hinrich", "Gesa", "Claus", "Wiebke"];                  // the computer players, by seat: Hanseatic first names

let opts = { level: "medium", vp: DEFAULTS.vp, seats: DEFAULTS.seats, voice: true, flat: false, autoDecline: false, ...read(OPTS, {}) };
if (!TARGETS.includes(opts.vp)) opts.vp = DEFAULTS.vp;
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "medium";      // Easy is gone (October 2026)
if (![3, 4].includes(opts.seats)) opts.seats = DEFAULTS.seats;
const saveOpts = () => write(OPTS, opts);
/** The camera kept on this device, as the 3D island wrote it. A watching frame reads it but never writes: its game is the partner's. */
const keptView = () => { try { return localStorage.getItem(VIEW); } catch { return null; } };
const keepView = text => {
  if (IN_FRAME) return;
  try { if (text) localStorage.setItem(VIEW, text); else localStorage.removeItem(VIEW); } catch { /* private mode */ }
};

let toastTimer = 0;
function toast(msg, ms = 2800) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// declared before seatPage, which draws the saved game at once (a let below it isn't there yet)
let V = null, page = null;
let seen = { seq: -1, h: null }, pulse = { until: 0, d: [0, 0, 0, 0, 0] }, pulseTimer = 0;   // your hand's last change, shown a moment
let island = null, viewReady = false;                                                         // the 3D island, once it's made
let flights = null, flown = null;                                                             // cards in the air, and the move they were last worked out from
// what the page holds between moves: the build mode, the cards picked to give up on a 7, the trade sheet's choices
const ui = { key: "", mode: null, discard: [0, 0, 0, 0, 0], pick: [], t: newTrade("bank"), ans: null, tview: null, dismissed: "", skip: null, auto: "" };
const randomRounds = seatRounds("factor");   // random mode's round: a game
page = seatPage({
  rules, id: "factor", app: 1, pace: 800, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; follow(v); draw(); showFlights(v); setTimeout(() => { autoOpen(v); autoAnswer(v); }, 0); randomRounds(v); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
const who = seat => (isMe(seat) ? "You" : nameOf(seat));
const turnNow = () => !!(V?.G && !V.over && V.seat != null && V.toMove === V.seat);
const sayOf = v => esc(fillNames(v.G?.say?.text, v.seats));
const pl = (n, w, many = `${w}s`) => `${n} ${n === 1 ? w : many}`;
const costWords = c => c.map((n, i) => (n ? `${n} ${RES[i]}` : "")).filter(Boolean).join(", ");
const cardWords = (c, any = 0) => [...c.map((n, i) => (n ? `${n}${resIcon(i, "in")}` : "")), any ? `${any} any` : ""].filter(Boolean).join(" ");

// ---------- what changed in your hand, shown for a moment ----------
function follow(v) {
  if (!v?.G || v.seat == null) return;
  const key = `${v.G.seq}:${v.G.n}`;
  ui.skip = settle(ui.skip, v.G, v.state, v.seat);                 // Skip trades ends when the turn comes round to this seat
  if (key !== ui.key) { ui.key = key; ui.mode = null; ui.discard = [0, 0, 0, 0, 0]; ui.pick = []; }
  const h = v.state.hand[v.seat];
  if (seen.seq === v.G.seq && seen.h) {
    const d = h.map((n, i) => n - seen.h[i]);
    if (d.some(Boolean)) { pulse = { until: Date.now() + 1900, d }; clearTimeout(pulseTimer); pulseTimer = setTimeout(draw, 1950); }
  }
  seen = { seq: v.G.seq, h: [...h] };
}

// ---------- cards in the air ----------
// Worked out from the difference between the game before a move and after it (factor-flights.js), never from anything the
// engine drew at random, so a page opened mid-turn has nothing to replay. The decks stand over the island: the bank's left
// of its middle, the development deck's right; a seat is its plate's icon (your own hand: the tile of the kind).
const centreOf = el => { const r = el?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
const plateOf = seat => document.querySelector(`#seats [data-seat="${seat}"]`);
/** The element a flight starts from or lands at, for a point on a seat or its fleet. */
function seatEl(pt, f) {
  if (pt.at === "fleet") return plateOf(pt.seat)?.querySelector(".fc-fleet") || plateOf(pt.seat);
  if (isMe(pt.seat)) return f.what === "dev" ? $("hand").querySelector(".dev") : $("hand").querySelector(`[data-r="${f.kind}"]`);
  const plate = plateOf(pt.seat);
  return plate?.querySelector(f.what === "dev" ? ".fc-n-dev" : ".fc-n-hand") || plate;
}
function placeOf(pt, f) {
  const box = $("board").getBoundingClientRect(), at = x => (box.width ? { x: box.left + box.width * x, y: box.top + box.height * .5 } : null);
  switch (pt.at) {
    case "bank": return at(.32);
    case "devs": return at(.68);
    case "table": return at(.5);
    default: return centreOf(seatEl(pt, f));
  }
}
function landed(f) {
  if (f.to.at === "seat" || f.to.at === "fleet") seatEl(f.to, f)?.animate([{ scale: 1.22 }, { scale: 1 }], { duration: 240, easing: "ease-out" });
}
function showFlights(v) {
  const G = v.G;
  if (!G) { flown = null; return; }
  if (worth(flown, G)) { const list = flightsBetween(flown.state, v.state, v.seat); if (list.length) flights?.run(list); }
  if (!flown || flown.seq !== G.seq || flown.n !== G.n) flown = { ...markOf(G), state: v.state };
}

// ---------- what the tap on the island does ----------
function spots() {
  if (!turnNow()) return {};
  const s = V.state, seat = V.seat;
  switch (s.step) {
    case "setup": return s.part === "post" ? { v: new Set(postSpots(s, seat, { setup: true })) } : { e: new Set(roadSpots(s, seat, s.last)) };
    case "blockade": return { h: new Set(HEXES.map((_, i) => i).filter(i => i !== s.robber)) };
    case "causeway": return { e: new Set(roadSpots(s, seat)) };
    case "main":
      if (ui.mode === "road") return { e: new Set(roadSpots(s, seat)) };
      if (ui.mode === "post") return { v: new Set(postSpots(s, seat)) };
      if (ui.mode === "factory") return { v: new Set(factorySpots(s, seat)) };
      return {};
    default: return {};
  }
}
async function play(move) {
  const why = await page.move(move);
  if (why) toast(why);
  return !why;
}
$("board").addEventListener("click", async e => {
  const t = e.target.closest("[data-v],[data-e],[data-h]");
  if (!t || !turnNow()) return;
  const s = V.state, at = Number(t.dataset.v ?? t.dataset.e ?? t.dataset.h);
  let move = null;
  if (t.dataset.h != null) move = { t: "blockade", hex: at };
  else if (s.step === "setup") move = { t: "build", what: s.part, at };
  else if (s.step === "causeway") move = { t: "build", what: "road", at };
  else if (ui.mode) move = { t: "build", what: ui.mode, at };
  if (move) { ui.mode = null; await play(move); }
});

// ---------- drawing ----------
function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { for (const id of ["seats", "strip", "board", "hand", "bar"]) $(id).innerHTML = ""; return; }
  drawSeats(v);
  drawStrip(v);
  drawBoard(v);
  drawHand(v);
  drawBar(v);
  if ($("tradeDlg").open) drawTrade();
  if ($("cardsDlg").open) drawCards();
}

/** A seat's plate: its colour, name and points; then the cards in its hand and its development cards, its road, and each Privateer it has played. */
function drawSeats(v) {
  const s = v.state;
  $("seats").style.setProperty("--n", s.seats);
  $("seats").innerHTML = Array.from({ length: s.seats }, (_, i) => {
    const mine = isMe(i), turn = s.turn === i && !v.over, ask = v.toMove === i && v.toMove !== s.turn && !v.over;
    const pts = pointsOf(s, i, mine || v.over), road = roadLength(s, i), fleet = s.played[i], hand = cards(s, i), devs = s.devs[i].length;
    const holdsRoad = s.longest === i, holdsFleet = s.army === i;
    const fleetWords = `${pl(fleet, "Privateer")} played${holdsFleet ? ", the largest fleet" : ""}`;
    const fleetShown = fleet > 3 ? `${fleetCard()}<b>${fleet}</b>` : fleetCard().repeat(fleet);
    return `<div class="fc-seat${turn ? " turn" : ""}${ask ? " ask" : ""}${mine ? " me" : ""}" data-seat="${i}">
      <div class="fc-who"><i class="fc-sw p${i}"></i><b class="fc-name">${esc(who(i))}</b><span class="fc-pts" title="Points" aria-label="${pl(pts, "point")}">${pts}</span></div>
      <div class="fc-tally"><span class="fc-n fc-n-hand" role="img" aria-label="${pl(hand, "card")} in hand">${handIcon()}<b>${hand}</b></span><span class="fc-n fc-n-dev" role="img" aria-label="${pl(devs, "development card")}">${devIcon()}<b>${devs}</b></span></div>
      <div class="fc-tally"><span class="fc-n fc-n-road${holdsRoad ? " hold" : ""}" role="img" aria-label="Road of ${pl(road, "piece")}${holdsRoad ? ", the longest road" : ""}">${roadIcon()}<b>${road}</b></span>${fleet ? `<span class="fc-fleet${holdsFleet ? " hold" : ""}" role="img" aria-label="${fleetWords}" title="${fleetWords}">${fleetShown}</span>` : ""}</div>
    </div>`;
  }).join("");
}

/** What the strip says: your move's prompt, or the last thing that happened. */
function prompt(v) {
  const s = v.state;
  if (v.over) return `The game goes to <b>${esc(who(s.winner))}</b>, with ${pointsOf(s, s.winner)} points.`;
  if (v.seat == null) return sayOf(v);
  if (turnNow()) {
    switch (s.step) {
      case "setup": return s.part === "post" ? `<b>Found a post</b>: tap a ringed corner${s.si >= s.seats ? ". This one pays out the land round it" : ""}` : "<b>Now a road</b> beside it: tap a ringed edge";
      case "roll": return "<b>Your turn</b>: roll the dice";
      case "discard": return `<b>Seven</b>: give up ${pl(s.owe[v.seat], "card")} (${sum(ui.discard)} chosen): tap your cards`;
      case "blockade": return "<b>Move the blockade</b>: tap a hex";
      case "steal": return "<b>Take a card</b> from…";
      case "causeway": return `<b>A free road</b> (${s.free} to go): tap a ringed edge`;
      case "pick": return "<b>Answers are in</b>: take one, or turn them all down";
      case "offer": return `${esc(who(s.offer.from))} gives ${cardWords(s.offer.give, s.offer.ag)} for ${cardWords(s.offer.get, s.offer.aw)}`;
      case "main": return ui.mode ? `<b>${{ road: "A road", post: "A post", factory: "A factory" }[ui.mode]}</b>: tap a ringed ${ui.mode === "road" ? "edge" : "corner"}` : sayOf(v) || "<b>Your move</b>";
      default: return sayOf(v);
    }
  }
  if (s.step === "offer" && v.toMove != null && v.toMove !== v.seat && s.offer.from === v.seat) return `<b>Waiting for ${esc(who(v.toMove))}</b>: ${cardWords(s.offer.give, s.offer.ag)} for ${cardWords(s.offer.get, s.offer.aw)}`;
  if (s.step === "offer" && v.toMove != null && v.toMove !== v.seat) return `${esc(who(s.offer.from))} offers ${cardWords(s.offer.give, s.offer.ag)} for ${cardWords(s.offer.get, s.offer.aw)}`;
  return sayOf(v);
}
function drawStrip(v) {
  const s = v.state, total = s.roll[0] + s.roll[1];
  const dice = s.roll[0] ? `<span class="fc-dice${total === 7 ? " seven" : ""}" aria-label="Rolled ${total}"><i>${s.roll[0]}</i><i>${s.roll[1]}</i></span>` : "";
  $("strip").innerHTML = `<span class="fc-say">${prompt(v)}</span>${dice}`;
}
function drawBoard(v) {
  if (!viewReady) return;
  const box = $("board"), sp = { ...spots(), mark: v.state.mark };
  if (island) { island.set(v.state, sp); return; }
  box.style.setProperty("--aspect", ASPECT);
  box.innerHTML = boardSvg(v.state, sp);
}

// ---------- the island: in 3D where the device can draw it and the player hasn't asked for it flat ----------
// Flat is the same island as an SVG (factor-draw.js), for a phone low on battery or a device without WebGL: both take
// the same taps, so nothing else on the page knows which it has.
async function useView() {
  if (island && opts.flat) { island.dispose(); island = null; }
  if (!island && !opts.flat) {
    try { island = (await import("./factor-3d.js")).createIsland($("board"), { view: keptView(), onView: keepView }); }
    catch (err) { console.warn("Factor: no 3D here, so the island is drawn flat.", err); island = null; }
  }
  $("app").classList.toggle("three", !!island);
  $("board").classList.toggle("three", !!island);
  viewReady = true;
  if (!island) $("board").replaceChildren();
  draw();
}

function drawHand(v) {
  const box = $("hand");
  if (v.seat == null) { box.innerHTML = `<p class="fc-watch">Watching: you take a seat at the next game.</p>`; return; }
  const s = v.state, h = s.hand[v.seat], live = Date.now() < pulse.until, disc = turnNow() && s.step === "discard";
  box.innerHTML = [0, 1, 2, 3, 4].map(r => {
    const d = live ? pulse.d[r] : 0;
    const badge = disc && ui.discard[r] ? `<em class="fc-delta down">−${ui.discard[r]}</em>` : d ? `<em class="fc-delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d)}</em>` : "";
    return `<button type="button" class="fc-res r${r}${disc && ui.discard[r] ? " chosen" : ""}" data-r="${r}" aria-label="${h[r]} ${RES[r]}">${resIcon(r)}<b class="n">${h[r]}</b><small>${RES[r]}</small>${badge}</button>`;
  }).join("") + `<button type="button" class="fc-res dev" data-act="cards" aria-label="Your cards: ${s.devs[v.seat].length}"><svg class="fc-ic" viewBox="-1 -1 2 2" aria-hidden="true" fill="currentColor"><rect x="-.62" y="-.9" width="1.24" height="1.8" rx=".14" fill="none" stroke="currentColor" stroke-width=".16"/><path d="M0 -.5L.28 .02L0 .5L-.28 .02Z"/></svg><b class="n">${s.devs[v.seat].length}</b><small>cards</small></button>`;
}
$("hand").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || !V?.G) return;
  if (b.dataset.act === "cards") { openCards(); return; }
  const r = Number(b.dataset.r);
  if (!turnNow() || V.state.step !== "discard" || !Number.isInteger(r)) return;
  const owe = V.state.owe[V.seat], have = V.state.hand[V.seat][r];
  if (sum(ui.discard) < owe && ui.discard[r] < have) ui.discard[r]++; else ui.discard[r] = 0;
  draw();
});

// ---------- your buttons ----------
const btn = (label, act, { cls = "", off = "", data = "" } = {}) => `<button type="button" class="btn fc-go ${cls}${off ? " off" : ""}" data-act="${act}" ${off ? `aria-disabled="true" data-why="${esc(off)}"` : ""} ${data}>${label}</button>`;
const promptBox = text => `<p class="fc-prompt">${text}</p>`;

/** Why a build button can't be pressed now, or "". */
function whyNot(what) {
  const s = V.state, seat = V.seat, left = piecesLeft(s, seat), hand = s.hand[seat];
  const lacks = c => c.map((n, i) => Math.max(0, n - hand[i]));
  const need = c => { const l = lacks(c); return sum(l) ? `You lack ${costWords(l)}` : ""; };
  if (what === "road") return left.road < 1 ? "No roads left" : need(COSTS.road) || (roadSpots(s, seat).length ? "" : "No place for a road: it must join your roads or buildings");
  if (what === "post") return left.post < 1 ? "No posts left" : need(COSTS.post) || (postSpots(s, seat).length ? "" : "A post goes at the end of one of your roads, with an empty corner between it and any building");
  if (what === "factory") return left.factory < 1 ? "No factories left" : need(COSTS.factory) || (factorySpots(s, seat).length ? "" : "A factory goes on one of your posts");
  if (what === "buy") return s.deck.length < 1 ? "The deck is empty" : need(COSTS.dev);
  return "";
}

function drawBar(v) {
  const bar = $("bar");
  if (v.over) { bar.innerHTML = page.host ? btn("New game", "new", { cls: "primary" }) : promptBox("The host starts the next game"); return; }
  if (v.seat == null) { bar.innerHTML = promptBox("Watching"); return; }
  const s = v.state, me = v.seat, mine = turnNow();
  if (!mine) {
    const mainShown = s.turn === me && s.step === "main";
    bar.innerHTML = s.step === "discard" && s.owe[me] === 0 ? promptBox(`${esc(who(v.toMove))} is giving up cards…`) : promptBox(v.toMove != null ? `${esc(who(v.toMove))} ${mainShown ? "is answering" : "is thinking"}…` : "…");
    return;
  }
  switch (s.step) {
    case "setup": bar.innerHTML = promptBox(sayOf(v)); return;
    case "roll": {
      const knight = playable(s, me).includes("privateer") && !s.playedDev;
      bar.innerHTML = btn("Roll the dice", "roll", { cls: "primary" }) + (knight ? btn("Privateer", "privateer", { cls: "side" }) : "");
      return;
    }
    case "discard": {
      const n = sum(ui.discard);
      bar.innerHTML = btn("Clear", "clear", { off: n ? "" : "Tap your cards to choose what to give up", cls: "side" }) + btn(`Give up ${n} of ${s.owe[me]}`, "discard", { cls: "primary", off: n === s.owe[me] ? "" : `Choose ${s.owe[me]} cards` });
      return;
    }
    case "blockade": bar.innerHTML = promptBox(sayOf(v)); return;
    case "steal": bar.innerHTML = victims(s, s.robber, me).map(o => btn(`Take from ${esc(who(o))}`, "steal", { data: `data-from="${o}"` })).join(""); return;
    case "causeway": bar.innerHTML = btn("Skip the rest", "skip"); return;
    case "offer": {
      const o = s.offer, exact = !o.ag && !o.aw && has(s.hand[me], o.get);
      bar.innerHTML = btn("No", "decline") + (exact ? btn("Yes", "accept", { cls: "primary" }) : "") + btn(exact ? "Counter" : "Answer", "answer", exact ? {} : { cls: "primary" }) + btn("Skip trades", "skiptrades", { cls: "side" });
      return;
    }
    case "pick": bar.innerHTML = btn("Answers", "answers", { cls: "primary" }) + btn("Decline all", "pick", { data: `data-with="-1"`, cls: "side" }); return;
    case "main": {
      const m = x => ({ off: whyNot(x), cls: ui.mode === x ? "on" : "" });
      bar.innerHTML = btn("Road", "road", m("road")) + btn("Post", "post", m("post")) + btn("Factory", "factory", m("factory")) +
        btn("Card", "buy", { off: whyNot("buy") }) + btn("Trade", "trade") + btn("End", "end", { cls: "primary" });
      return;
    }
    default: bar.innerHTML = "";
  }
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("button[data-act]");
  if (!b || !V?.G) return;
  const act = b.dataset.act, s = V.state;
  if (b.classList.contains("off")) { toast(b.dataset.why || "Not now"); return; }
  switch (act) {
    case "new": newGame(); break;
    case "roll": await play({ t: "roll" }); break;
    case "privateer": await play({ t: "play", card: "privateer" }); break;
    case "road": case "post": case "factory": ui.mode = ui.mode === act ? null : act; draw(); break;
    case "buy": ui.mode = null; await play({ t: "buy" }); if (V?.state.bought && V.state.devs[V.seat].length) toast(`You bought a ${CARD_NAMES[V.state.bought]}`, 2600); break;
    case "trade": ui.mode = null; openTrade(); break;
    case "end": ui.mode = null; await play({ t: "end" }); break;
    case "clear": ui.discard = [0, 0, 0, 0, 0]; draw(); break;
    case "discard": await play({ t: "discard", n: [...ui.discard] }); break;
    case "steal": await play({ t: "steal", from: Number(b.dataset.from) }); break;
    case "skip": await play({ t: "skip" }); break;
    case "accept": await play({ t: "answer", yes: true }); break;
    case "decline": await play({ t: "answer", yes: false }); break;
    case "pick": await play({ t: "pick", with: Number(b.dataset.with) }); break;
    case "answers": case "answer": ui.dismissed = ""; openTrade(); break;
    case "skiptrades": ui.skip = startSkip(V.G); toast("Skipping trades until your turn comes round"); await play({ t: "answer", yes: false }); break;
    default: break;
  }
});

// ---------- the trade sheet ----------
// One sheet for three moments: composing your own offer or bank trade (Players | Bank), answering an offer that has come to
// you (the same tiles, pre-filled), and choosing among the answers to yours. factor-trade.js draws it; the taps are here.
function tradeView() {
  if (!V?.G || V.seat == null || V.over) return null;
  const s = V.state;
  if (s.step === "offer" && V.toMove === V.seat) return "answer";
  if (s.step === "pick" && V.toMove === V.seat) return "pick";
  return "compose";
}
function offerKey() { return `${V.G.seq}:${V.G.n}`; }
/** The counter-proposal the answer sheet starts from: the offer itself when it has no ?, else the computer's best guess at filling it. */
function firstAnswer() {
  const s = V.state, o = s.offer;
  if (!o.ag && !o.aw) return { give: [...o.give], get: [...o.get] };
  const guess = suggest(s, V.seat);
  return guess ? { give: guess.give, get: guess.get } : { give: [...o.give], get: [...o.get] };
}
function openTrade() {
  if (!ui.t) ui.t = newTrade("bank");
  drawTrade();
  if (!$("tradeDlg").open) $("tradeDlg").showModal();
}
function drawTrade() {
  const v = V, body = $("tradeBody"), view = tradeView();
  if (!view) { body.innerHTML = ""; return; }
  const s = v.state, me = v.seat;
  $("tradeDlg").querySelector("h2").textContent = view === "answer" ? "An offer" : view === "pick" ? "The answers" : "Trade";
  if (ui.tview && ui.tview !== view && $("tradeDlg").open && ui.tview !== "compose") $("tradeDlg").close();     // that offer is settled
  ui.tview = view;
  if (view === "pick") { body.innerHTML = pickHtml(s, who); return; }
  if (view === "answer") {
    if (!ui.ans || ui.ans.key !== offerKey()) ui.ans = { key: offerKey(), ...firstAnswer() };
    body.innerHTML = answerHtml(s, me, ui.ans, { name: who(s.offer.from), skipping: declines(opts, ui.skip, v.G, s, me) });
    return;
  }
  const on = turnNow() && s.step === "main";
  const r = resolve(s, me, ui.t, { on, order: wants(s, me) });
  body.innerHTML = composeHtml(s, me, ui.t, r, { on });
}
/** Opens the sheet by itself when an answer or a choice waits for you (and nothing else is open, and you haven't put it away). */
function autoOpen(v) {
  if (IN_FRAME || !v?.G || v.seat == null || v.over || $("tradeDlg").open) return;
  const view = tradeView();
  if (view !== "answer" && view !== "pick") return;
  if (document.querySelector("dialog[open]") || ui.dismissed === offerKey() || declines(opts, ui.skip, v.G, v.state, v.seat)) return;
  openTrade();
}
/** Skip trades: an offer to a seat that is skipping is turned down unseen, once. */
function autoAnswer(v) {
  if (IN_FRAME || !v?.G || v.over) return;
  if (!asked(v.state, v.toMove, v.seat) || !declines(opts, ui.skip, v.G, v.state, v.seat)) return;
  const key = offerKey();
  if (ui.auto === key) return;
  ui.auto = key;
  setTimeout(() => { if (V?.G && offerKey() === key && asked(V.state, V.toMove, V.seat)) play({ t: "answer", yes: false }); }, 0);
}
$("tradeBody").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const d = b.dataset, view = tradeView(), s = V.state, me = V.seat;
  if (view === "pick") {
    if (d.take != null) { await play({ t: "pick", with: Number(d.take) }); $("tradeDlg").close(); }
    return;
  }
  if (view === "answer") {
    const a = ui.ans;
    if (d.add || d.sub) {
      const [side, k] = (d.add || d.sub).split(","), by = d.add ? 1 : -1;
      const arr = side === "g" ? a.get : a.give;                // the sheet's "you give" row is what the proposer gets
      arr[Number(k)] = Math.max(0, arr[Number(k)] + by);
    } else if (d.answer) {
      const move = d.answer === "no" ? { t: "answer", yes: false } : d.answer === "yes" ? { t: "answer", yes: true } : { t: "answer", counter: { give: [...a.give], get: [...a.get] } };
      if (await play(move)) $("tradeDlg").close();
      return drawTrade();
    } else if (d.skip) {
      ui.skip = startSkip(V.G);
      toast("Skipping trades until your turn comes round");
      if (await play({ t: "answer", yes: false })) $("tradeDlg").close();
      return drawTrade();
    }
    return drawTrade();
  }
  const on = turnNow() && s.step === "main";
  if (d.mode) toMode(ui.t, s, me, d.mode);
  else if (d.add || d.sub) { const [side, k] = (d.add || d.sub).split(","); stepTrade(ui.t, s, me, side, Number(k), d.add ? 1 : -1); }
  else if (d.send) {
    const r = resolve(s, me, ui.t, { on, order: wants(s, me) });
    if (r.move) {
      const mode = ui.t.mode;
      ui.t = newTrade(mode);
      if (await play(r.move)) { if (r.move.t === "offer") $("tradeDlg").close(); }
    }
  }
  drawTrade();
});
function putAway() { if (V?.G && tradeView() !== "compose") ui.dismissed = offerKey(); $("tradeDlg").close(); }
$("tradeClose").addEventListener("click", putAway);
$("tradeDlg").addEventListener("cancel", () => { if (V?.G && tradeView() !== "compose") ui.dismissed = offerKey(); });

// ---------- your cards ----------
function openCards() {
  ui.pick = [];
  drawCards();
  if (!$("cardsDlg").open) $("cardsDlg").showModal();
}
/** Why a card can't be played now, or "". */
function cardWhy(c) {
  const s = V.state, me = V.seat;
  if (c === "patent") return "A hidden point: it counts by itself";
  if (!turnNow() || s.turn !== me) return "Not your turn";
  if (s.playedDev) return "One card a turn";
  if (!playable(s, me).includes(c)) return "Bought this turn: tomorrow";
  if (s.step === "roll" && c !== "privateer") return "Roll first";
  if (s.step !== "main" && s.step !== "roll") return "Not now";
  return "";
}
function drawCards() {
  const v = V, body = $("cardsBody");
  if (!v?.G || v.seat == null) { body.innerHTML = ""; return; }
  const s = v.state, held = {};
  for (const c of s.devs[v.seat]) held[c] = (held[c] || 0) + 1;
  const kinds = Object.keys(CARD_NAMES).filter(c => held[c]);
  if (ui.cardPick) {
    const c = ui.cardPick, need = c === "windfall" ? 2 : 1;
    body.innerHTML = `<p>${c === "windfall" ? "Take two resources from the bank" : "Name the resource to corner"}${ui.pick.length ? `: ${ui.pick.map(r => RES[r]).join(" and ")}` : ""}</p>
      <div class="fc-chips">${[0, 1, 2, 3, 4].map(r => `<button type="button" class="fc-chip r${r}" data-pick="${r}">${resIcon(r)}<b>${RES[r]}</b></button>`).join("")}</div>
      <button type="button" class="btn" data-back="1">Back</button>`;
    ui.need = need;
    return;
  }
  body.innerHTML = kinds.length ? `<ul class="fc-card-list">${kinds.map(c => {
    const why = cardWhy(c);
    return `<li><div><b>${CARD_NAMES[c]}</b> <span class="fc-x">×${held[c]}</span><p>${CARD_TEXT[c]}</p></div>${c === "patent" ? `<span class="fc-hid">hidden point</span>` : `<button type="button" class="btn${why ? " off" : " primary"}" data-card="${c}" ${why ? `aria-disabled="true" data-why="${esc(why)}"` : ""}>Play</button>`}</li>`;
  }).join("")}</ul>` : `<p class="fc-tnote">No cards yet. A card costs ${costWords(COSTS.dev)}; buy one with Card.</p>`;
}
$("cardsBody").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || !V?.G) return;
  const d = b.dataset;
  if (d.back) { ui.cardPick = null; ui.pick = []; drawCards(); return; }
  if (d.pick != null) {
    ui.pick.push(Number(d.pick));
    if (ui.pick.length < ui.need) { drawCards(); return; }
    const c = ui.cardPick, move = c === "windfall" ? { t: "play", card: c, res: [...ui.pick] } : { t: "play", card: c, res: ui.pick[0] };
    ui.cardPick = null; ui.pick = [];
    if (await play(move)) $("cardsDlg").close(); else drawCards();
    return;
  }
  if (!d.card) return;
  if (b.classList.contains("off")) { toast(d.why || "Not now"); return; }
  if (d.card === "windfall" || d.card === "corner") { ui.cardPick = d.card; ui.pick = []; drawCards(); return; }
  if (await play({ t: "play", card: d.card })) $("cardsDlg").close(); else drawCards();
});
$("cardsClose").addEventListener("click", () => { ui.cardPick = null; ui.pick = []; $("cardsDlg").close(); });
$("cardsDlg").addEventListener("close", () => { ui.cardPick = null; ui.pick = []; });

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, won = s.winner === v.seat;
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1400);
}
function showEnd(v) {
  const s = v.state, order = Array.from({ length: s.seats }, (_, i) => i).sort((a, b) => pointsOf(s, b) - pointsOf(s, a) || (a === s.winner ? -1 : 0));
  $("endHead").textContent = s.winner === v.seat ? "You win" : `${nameOf(s.winner)} wins`;
  const parts = i => {
    let posts = 0, works = 0;
    for (let k = 0; k < s.vo.length; k++) if (s.vo[k] === i + 1) { if (s.vl[k] === 2) works++; else posts++; }
    const patents = s.devs[i].filter(c => c === "patent").length;
    return [posts && pl(posts, "post"), works && pl(works, "factory", "factories"), s.longest === i && "longest road", s.army === i && "largest fleet", patents && pl(patents, "patent")].filter(Boolean).join(", ") || "nothing yet";
  };
  $("endBody").innerHTML = `<ol class="fc-standings">${order.map(i => `<li class="${i === s.winner ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm"><i class="fc-sw p${i}"></i>${esc(who(i))}</span><span class="fc-small">${parts(i)}</span><b>${pointsOf(s, i)}</b></li>`).join("")}</ol>
    <p class="fc-end-note">${pl(s.turnNo, "turn")}; first to ${s.opts.vp} points.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal({ vp: opts.vp }, opts.seats);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml({ vp: V?.state?.opts?.vp || opts.vp });
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  play.append(toggle("Decline trades automatically", !!opts.autoDecline, on => { opts.autoDecline = on; saveOpts(); if (V?.G) autoAnswer(V); }));
  play.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(choice("Points to win", TARGETS.map(n => [n, String(n)]), opts.vp, v => { opts.vp = Number(v); keep(); }));
  set.append(choice("Players", [[3, "3"], [4, "4"]], opts.seats, v => { opts.seats = Number(v); keep(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; keep(); }));
  set.append(line("The points and players apply from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; keep(); }));
  set.append(toggle("Flat island, to save battery", opts.flat, on => { opts.flat = on; keep(); useView(); }));
  if (island) {
    set.append(line("Drag the island to turn it, pinch to zoom, two fingers to move it, double-tap to reset."));
    set.append(action("Reset view", () => island?.resetView()));
  }
  const r = read(RECORD, { played: 0, won: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
flights = createFlights({ where: placeOf, land: landed });
onPause(() => flights.hold(true), () => flights.hold(false));
bindSwitcher($("appsBtn"), "factor");
document.querySelector(".fc-mark").innerHTML = APPS.find(a => a.id === "factor")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__factor = { page, get view() { return V; }, opts, ui, draw, get island() { return island; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
await useView();
