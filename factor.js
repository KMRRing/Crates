// Factor, an island trading game against computer players, or at a table with friends each on their own phone. The rules
// and words are factor-rules.js's (the island's geometry factor-board.js's), the computer players factor-bot.js's, the
// running seats.js's (seats-ui.js), the island's picture factor-draw.js's. This page draws the players across the top, the
// island, your hand and your buttons below it; a tap on a ringed corner, edge or hex is the move the step asks for, and the
// build buttons ring where a road, post or factory may go.
import { rules, COSTS, TARGETS, DEFAULTS, CARD_NAMES, CARD_TEXT, MAX_OFFERS, cards, pointsOf, roadLength, playable, rates, piecesLeft, postSpots, roadSpots, factorySpots, victims, bankOf, has } from "./factor-rules.js";
import { LEVEL_NAMES } from "./factor-bot.js";
import { HEXES, RES } from "./factor-board.js";
import { boardSvg, resIcon, ASPECT } from "./factor-draw.js";
import { rulesHtml } from "./factor-sheet.js";
import { seatPage, fillNames } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "factor:opts", RECORD = "factor:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sum = a => a.reduce((t, x) => t + x, 0);
const NAMES = ["Hinrich", "Gesa", "Claus", "Wiebke"];                  // the computer players, by seat: Hanseatic first names

let opts = { level: "medium", vp: DEFAULTS.vp, seats: DEFAULTS.seats, voice: true, flat: false, ...read(OPTS, {}) };
if (!TARGETS.includes(opts.vp)) opts.vp = DEFAULTS.vp;
if (![3, 4].includes(opts.seats)) opts.seats = DEFAULTS.seats;
const saveOpts = () => write(OPTS, opts);

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
// what the page holds between moves: the build mode, the cards picked to give up on a 7, the trade sheet's choices
const ui = { key: "", mode: null, discard: [0, 0, 0, 0, 0], tab: "bank", give: -1, og: [0, 0, 0, 0, 0], ow: [0, 0, 0, 0, 0], pick: [] };
page = seatPage({
  rules, id: "factor", app: 1, pace: 800, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; follow(v); draw(); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
const who = seat => (isMe(seat) ? "You" : nameOf(seat));
const turnNow = () => !!(V?.G && !V.over && V.seat != null && V.toMove === V.seat);
const sayOf = v => esc(fillNames(v.G?.say?.text, v.seats));
const pl = (n, w, many = `${w}s`) => `${n} ${n === 1 ? w : many}`;
const costWords = c => c.map((n, i) => (n ? `${n} ${RES[i]}` : "")).filter(Boolean).join(", ");
const cardWords = c => c.map((n, i) => (n ? `${n}${resIcon(i, "in")}` : "")).filter(Boolean).join(" ");

// ---------- what changed in your hand, shown for a moment ----------
function follow(v) {
  if (!v?.G || v.seat == null) return;
  const key = `${v.G.seq}:${v.G.n}`;
  if (key !== ui.key) { ui.key = key; ui.mode = null; ui.discard = [0, 0, 0, 0, 0]; ui.pick = []; }
  const h = v.state.hand[v.seat];
  if (seen.seq === v.G.seq && seen.h) {
    const d = h.map((n, i) => n - seen.h[i]);
    if (d.some(Boolean)) { pulse = { until: Date.now() + 1900, d }; clearTimeout(pulseTimer); pulseTimer = setTimeout(draw, 1950); }
  }
  seen = { seq: v.G.seq, h: [...h] };
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

function drawSeats(v) {
  const s = v.state;
  $("seats").style.setProperty("--n", s.seats);
  $("seats").innerHTML = Array.from({ length: s.seats }, (_, i) => {
    const mine = isMe(i), turn = s.turn === i && !v.over, ask = v.toMove === i && v.toMove !== s.turn && !v.over;
    const pts = pointsOf(s, i, mine || v.over), road = roadLength(s, i), fleet = s.played[i];
    return `<div class="fc-seat${turn ? " turn" : ""}${ask ? " ask" : ""}${mine ? " me" : ""}">
      <div class="fc-who"><i class="fc-sw p${i}"></i><b class="fc-name">${esc(who(i))}</b><span class="fc-pts" title="Points">${pts}</span></div>
      <div class="fc-sub"><span>${pl(cards(s, i), "card")}</span><span>${s.devs[i].length} dev</span></div>
      <div class="fc-sub"><span class="${s.longest === i ? "hold" : ""}" title="Longest road">road ${road}</span><span class="${s.army === i ? "hold" : ""}" title="Privateers played">fleet ${fleet}</span></div>
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
      case "pick": return "<b>Several said yes</b>: choose who you trade with";
      case "offer": return `${esc(who(s.offer.from))} gives ${cardWords(s.offer.give)} for ${cardWords(s.offer.get)}`;
      case "main": return ui.mode ? `<b>${{ road: "A road", post: "A post", factory: "A factory" }[ui.mode]}</b>: tap a ringed ${ui.mode === "road" ? "edge" : "corner"}` : sayOf(v) || "<b>Your move</b>";
      default: return sayOf(v);
    }
  }
  if (s.step === "offer" && v.toMove != null && v.toMove !== v.seat && s.offer.from === v.seat) return `<b>Waiting for ${esc(who(v.toMove))}</b>: ${cardWords(s.offer.give)} for ${cardWords(s.offer.get)}`;
  if (s.step === "offer" && v.toMove != null && v.toMove !== v.seat) return `${esc(who(s.offer.from))} offers ${cardWords(s.offer.give)} for ${cardWords(s.offer.get)}`;
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
    try { island = (await import("./factor-3d.js")).createIsland($("board")); }
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
    case "offer": bar.innerHTML = btn("No", "decline") + btn("Yes", "accept", { cls: "primary", off: has(s.hand[me], s.offer.get) ? "" : "You don't hold that" }); return;
    case "pick": {
      const yes = s.offer.resp.map((r, i) => (r === 1 ? i : -1)).filter(i => i >= 0);
      bar.innerHTML = yes.map(o => btn(esc(who(o)), "pick", { cls: "primary", data: `data-with="${o}"` })).join("") + btn("None", "pick", { data: `data-with="-1"`, cls: "side" });
      return;
    }
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
    default: break;
  }
});

// ---------- the trade sheet ----------
function openTrade() {
  ui.give = -1; ui.og = [0, 0, 0, 0, 0]; ui.ow = [0, 0, 0, 0, 0];
  drawTrade();
  if (!$("tradeDlg").open) $("tradeDlg").showModal();
}
function drawTrade() {
  const v = V, body = $("tradeBody");
  if (!v?.G || v.seat == null) { body.innerHTML = ""; return; }
  const s = v.state, me = v.seat, h = s.hand[me], rt = rates(s, me), on = turnNow() && s.step === "main";
  const chip = (r, attrs, inner, cls = "") => `<button type="button" class="fc-chip r${r}${cls}" ${attrs}>${resIcon(r)}<b>${inner}</b></button>`;
  let html = `<div class="fc-seg" role="tablist"><button type="button" role="tab" data-tab="bank" class="${ui.tab === "bank" ? "on" : ""}">Bank</button><button type="button" role="tab" data-tab="table" class="${ui.tab === "table" ? "on" : ""}">Players</button></div>`;
  if (!on) html += `<p class="fc-tnote">Trade on your own turn, after the roll.</p>`;
  if (ui.tab === "bank") {
    html += `<h3>Give</h3><div class="fc-chips">${[0, 1, 2, 3, 4].map(r => chip(r, `data-give="${r}" ${on && h[r] >= rt[r] ? "" : "disabled"}`, `${h[r]} <small>${rt[r]}:1</small>`, ui.give === r ? " on" : "")).join("")}</div>
      <h3>Get one</h3><div class="fc-chips">${[0, 1, 2, 3, 4].map(r => chip(r, `data-get="${r}" ${on && ui.give >= 0 && r !== ui.give && bankOf(s, r) > 0 ? "" : "disabled"}`, `${bankOf(s, r)} <small>in bank</small>`)).join("")}</div>
      <p class="fc-tnote">${ui.give >= 0 ? `${rt[ui.give]} ${RES[ui.give]} buy one of anything the bank holds.` : "Tap what to give, then what you want. A post or factory at a harbour improves the rate: 3:1, or 2:1 for its own resource."}</p>`;
  } else {
    const step = (kind, r) => {
      const arr = kind === "g" ? ui.og : ui.ow, cap = kind === "g" ? h[r] : 9, lock = kind === "g" ? ui.ow[r] > 0 : ui.og[r] > 0;
      return `<div class="fc-step r${r}">${resIcon(r)}<button type="button" data-step="${kind},${r},1" ${arr[r] < cap && !lock && on ? "" : "disabled"} aria-label="More ${RES[r]}">+</button><b>${arr[r]}</b><button type="button" data-step="${kind},${r},-1" ${arr[r] > 0 && on ? "" : "disabled"} aria-label="Fewer ${RES[r]}">−</button></div>`;
    };
    const ok = on && sum(ui.og) > 0 && sum(ui.ow) > 0 && s.offers < MAX_OFFERS;
    html += `<h3>You give</h3><div class="fc-steps">${[0, 1, 2, 3, 4].map(r => step("g", r)).join("")}</div>
      <h3>You want</h3><div class="fc-steps">${[0, 1, 2, 3, 4].map(r => step("w", r)).join("")}</div>
      <button type="button" class="btn primary fc-offer" data-offer="1" ${ok ? "" : "disabled"}>Offer to the table</button>
      <p class="fc-tnote">Each player says yes or no, and you choose among the yeses. ${MAX_OFFERS - s.offers > 0 ? `${pl(MAX_OFFERS - s.offers, "offer")} left this turn.` : "No offers left this turn."}</p>`;
  }
  body.innerHTML = html;
}
$("tradeBody").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const d = b.dataset;
  if (d.tab) { ui.tab = d.tab; drawTrade(); return; }
  if (d.give != null) { ui.give = ui.give === Number(d.give) ? -1 : Number(d.give); drawTrade(); return; }
  if (d.get != null) { const give = ui.give; ui.give = -1; await play({ t: "bank", give, get: Number(d.get) }); drawTrade(); return; }
  if (d.step) {
    const [kind, r, by] = d.step.split(",");
    const arr = kind === "g" ? ui.og : ui.ow;
    arr[Number(r)] = Math.max(0, arr[Number(r)] + Number(by));
    drawTrade();
    return;
  }
  if (d.offer) {
    const move = { t: "offer", give: [...ui.og], get: [...ui.ow] };
    ui.og = [0, 0, 0, 0, 0]; ui.ow = [0, 0, 0, 0, 0];
    if (await play(move)) $("tradeDlg").close(); else drawTrade();
  }
});
$("tradeClose").addEventListener("click", () => $("tradeDlg").close());

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
  play.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(choice("Points to win", TARGETS.map(n => [n, String(n)]), opts.vp, v => { opts.vp = Number(v); keep(); }));
  set.append(choice("Players", [[3, "3"], [4, "4"]], opts.seats, v => { opts.seats = Number(v); keep(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; keep(); }));
  set.append(line("The points and players apply from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; keep(); }));
  set.append(toggle("Flat island, to save battery", opts.flat, on => { opts.flat = on; keep(); useView(); }));
  const r = read(RECORD, { played: 0, won: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
// what things cost, always in view where the screen has room for it (sideways); on a phone the build buttons say what's lacking
$("costs").innerHTML = [["Road", COSTS.road], ["Post", COSTS.post], ["Factory", COSTS.factory], ["Card", COSTS.dev]]
  .map(([n, c]) => `<span class="fc-ref-row"><b>${n}</b><span>${c.map((k, i) => (k ? `${k > 1 ? k : ""}${resIcon(i, "in")}` : "")).join("")}</span></span>`).join("");
bindSwitcher($("appsBtn"), "factor");
document.querySelector(".fc-mark").innerHTML = APPS.find(a => a.id === "factor")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__factor = { page, get view() { return V; }, opts, ui, draw, get island() { return island; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
await useView();
