// Contract: bridge, four at a table, North–South against East–West, a Chicago match of four deals, against the
// computer or with friends each on their own phone (seats.js runs it, the computer in every seat nobody has). This page
// sets the table out from your seat (you at the foot, partner across, the opponents either side), the auction in the
// middle while it's bid, the bidding box under your hand; then the trick in the middle, dummy's cards laid out after
// the opening lead (yours to play when your side declares). The rules are contract-core.js's and contract-rules.js's,
// the bidding contract-sayc.js's (Standard American Yellow Card), the computer's card play contract-play.js's, its
// thinking contract-worker.js's (the double-dummy solver, in WebAssembly, off the page's thread).
import { rules, aheadKey, remember, dummyOf, DEALS, DEAL_MS } from "./contract-rules.js";
import { THINK } from "./contract-play.js";
import { SUITS, RANKS, COMPASS, SEATS, SIDES, suitOf, rankOf, sortHand, legalCards, legalCalls, callText, bidOf, bidCall, contractText,
  vulText, sideOf, NT, dealScore, cardText, hcp } from "./contract-core.js";
import { chooseCall, explainCall, showText } from "./contract-sayc.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, courseStage } from "./contract-course.js";
import { createRush } from "./contract-rush-ui.js";
import { bestsLine } from "./rush-core.js";
import { sextant } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "contract:opts", RECORD = "contract:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

let opts = { level: "hard", voice: true, hints: true, ...read(OPTS, {}) };
if (!LEVELS.some(([k]) => k === opts.level)) opts.level = "hard";
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
const FACE_SUIT = [1, 0, 2, 3];                                  // cards.js numbers its suits ♦ ♣ ♥ ♠
const face = c => ({ rank: RANKS[rankOf(c)], suit: FACE_SUIT[suitOf(c)] });
const card = (c, cls = "", data = {}) => cardHtml(face(c), { cls, data, label: cardText(c) });
const red = s => s === 1 || s === 2;
const suitMark = s => `<span class="bd-s${red(s) ? " red" : ""}">${SUITS[s]}</span>`;
/** A call as markup: the strain's mark in its colour. */
function callHtml(call) {
  const b = bidOf(call);
  if (!b) return `<span class="bd-word">${esc(callText(call))}</span>`;
  return `${b.level}${b.strain === NT ? "NT" : suitMark(b.strain)}`;
}
const contractHtml = c => (c ? `${c.level}${c.strain === NT ? "NT" : suitMark(c.strain)}${c.doubled === 2 ? " XX" : c.doubled ? " X" : ""}` : "Passed out");
/** A hand written suit by suit, as bridge columns write it: each suit's mark and its cards, high to low. */
function suitRows(hand, { lit = null } = {}) {
  return [3, 2, 1, 0].map(s => {
    const cs = hand.filter(c => suitOf(c) === s).sort((a, b) => b - a);
    return `<span class="bd-row">${suitMark(s)}<span>${cs.length ? cs.map(c => `<i${c === lit ? ' class="lit"' : ""}>${RANKS[rankOf(c)]}</i>`).join("") : "—"}</span></span>`;
  }).join("");
}

// ---------- the computer's thinking, in a worker ----------
// The double-dummy solver weighs a card over many deals of the hands it can't see (contract-play.js), a second or so,
// in a worker (contract-worker.js) while the table waits its pace; the table's move takes what it worked out. Solo,
// the table holds the computer's card until it's in; at a table this phone runs (where nothing holds it), the pace
// waits as long as the level may think and a little more, and only a card still not in by then is played by the rules
// of thumb. The hint asks the same worker about your seat.
const PACE = 700, BID_PACE = 650, LATE = 600;
let worker = null, asked = 0;
const answers = new Map();
function workerNow() {
  if (worker === null) {
    try {
      worker = new Worker(new URL("./contract-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = e => { const done = answers.get(e.data.id); answers.delete(e.data.id); done?.(e.data.error ? null : e.data.answer); if (e.data.error) console.warn("contract worker:", e.data.error); };
      worker.onerror = () => { worker = false; for (const [id, done] of answers) { answers.delete(id); done(null); } };
    } catch { worker = false; }
  }
  return worker;
}
function ask(msg) {
  const w = workerNow();
  if (!w) return Promise.resolve(null);
  return new Promise(res => { const id = ++asked; answers.set(id, res); w.postMessage({ id, ...msg }); });
}
const thinks = () => opts.level !== "easy";
let want = null, ahead = { key: null, since: 0, done: true };
function lookAhead(v) {
  want = null;
  if (!v?.G || v.over || v.toMove == null || !v.seats[v.toMove]?.bot || v.state.step !== "play" || !thinks()) return;
  if (IN_FRAME || (v.mode !== "solo" && !v.me?.driver)) return;
  want = aheadKey(v.state, v.toMove, opts.level);
  if (ahead.key === want) return;
  const a = ahead = { key: want, since: Date.now(), done: false };
  ask({ kind: "move", state: v.state, seat: v.toMove, level: opts.level }).then(move => {
    a.done = true;
    if (move) remember(a.key, move);
    if (ahead === a) page?.runner.kick();
  });
}
const holding = () => want != null && !(ahead.key === want && ahead.done);
function paceNow(s) {
  if (s.step === "bid") return BID_PACE;
  if (want == null || ahead.key !== want) return PACE;
  const spent = Date.now() - ahead.since;
  return Math.max(150, (ahead.done ? PACE : (THINK[opts.level]?.ms ?? PACE) + LATE) - spent);
}

// ---------- the table ----------
let V = null, page = null;
const randomRounds = seatRounds("contract", ["scored"]);   // random mode's round: a deal played (one passed out is dealt again, no round)
page = seatPage({
  rules, id: "contract", app: 1, pace: paceNow, hold: holding, botName: s => SEATS[s],
  level: () => opts.level, voice: () => opts.voice, onView: v => { V = v; lookAhead(v); draw(); randomRounds(v); }, onOver, toast, newGame,
});
const me = () => V?.seat ?? 0;
const nameOf = seat => (V?.seats?.[seat]?.name ?? SEATS[seat]);
const isMe = seat => V?.seat != null && seat === V.seat;
const whoName = seat => (isMe(seat) ? "You" : nameOf(seat));
/** Where a seat sits from mine: partner across, the next to play (my left-hand opponent) on the left. */
function placeOf(seat) {
  const d = (seat - me() + 4) % 4;
  return ["me", "left", "top", "right"][d];
}
const seatAt = place => [0, 1, 2, 3].find(i => placeOf(i) === place);

// what the line over your hand says: a hint, a call explained, or the table's state
let said = null;                     // { key, html }: a hint or an explanation, until the table moves on
let hint = null;                     // { key, kind, card | call, list, html }
let pick = { level: null, call: null };
const keyOf = s => `${s.no}|${s.dealer}|${s.step}|${s.auction.length}|${s.tricks.length}|${s.trick.length}`;

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) {
    $("info").innerHTML = "";
    for (const id of ["seatTop", "seatLeft", "seatRight"]) $(id).replaceChildren();
    $("centre").innerHTML = "";
    $("hand").innerHTML = "";
    $("aside").innerHTML = "";
    $("say").textContent = "";
    $("controls").innerHTML = `<button class="btn primary bd-go" type="button" data-act="new">New match</button>`;
    return;
  }
  const s = v.state;
  if (said && said.key !== keyOf(s)) said = null;
  if (hint && hint.key !== keyOf(s)) hint = null;
  if (s.step !== "bid" || s.turn !== v.seat) pick = { level: null, call: null };
  $("app").dataset.step = s.step;
  drawInfo(s);
  const top = seatAt("top");
  $("table").classList.toggle("open-top", !!(s.contract && s.dummyShown && top === dummyOf(s) && isMe(s.contract.declarer) && s.step !== "scored" && s.step !== "over"));
  for (const [id, place] of [["seatTop", "top"], ["seatLeft", "left"], ["seatRight", "right"]]) drawSeat($(id), s, seatAt(place));
  fitColumns();
  drawCentre(s);
  drawAside(s);
  drawHand(s);
  drawSay(s);
  drawControls(s);
}

/** The line across the top: the deal and who's vulnerable, the contract, the tricks, the match's score. */
function drawInfo(s) {
  const mine = sideOf(me()), vul = s.vul;
  const vulWord = vul[0] && vul[1] ? "both vul" : vul[0] ? "N–S vul" : vul[1] ? "E–W vul" : "none vul";
  const contract = s.contract ? `<button class="bd-contract" type="button" data-act="auction">${contractHtml(s.contract)} <small>${esc(COMPASS[s.contract.declarer])}</small></button>`
    : `<span class="bd-contract idle">${s.step === "bid" ? "Bidding" : ""}</span>`;
  const tricks = s.contract && s.step !== "bid" ? `<span class="bd-tricks" title="tricks"><b>${s.won[mine]}</b>–<b>${s.won[1 - mine]}</b></span>` : "";
  $("info").innerHTML = `<span class="bd-deal">Deal ${s.no}/${DEALS}<small class="${vul[mine] ? "vul" : ""}">${vulWord}</small></span>${contract}${tricks}<span class="bd-score">us <b>${s.scores[mine]}</b> · them <b>${s.scores[1 - mine]}</b></span>`;
}

function drawSeat(box, s, seat) {
  const place = placeOf(seat), turn = rules.toMove(s) === seat || (s.step === "play" && s.turn === seat), n = s.hands[seat].length;
  const dummy = s.contract && seat === dummyOf(s) && s.dummyShown, declarer = s.contract && seat === s.contract.declarer;
  const partner = sideOf(seat) === sideOf(me());
  const tags = [seat === s.dealer && s.step === "bid" ? `<span class="bd-tag" title="dealer">D</span>` : "", declarer && s.step !== "bid" ? `<span class="bd-tag on">declarer</span>` : "", dummy ? `<span class="bd-tag">dummy</span>` : ""].join("");
  const head = `<span class="bd-name${partner ? " partner" : ""}"><b>${esc(nameOf(seat))}</b><small>${COMPASS[seat]}</small>${tags}</span>`;
  let body = "";
  const reveal = s.step === "scored" || s.step === "over";
  if (reveal) body = `<span class="bd-rows">${suitRows(s.dealt[seat])}</span>`;
  else if (dummy && place === "top" && isMe(s.contract.declarer)) body = "";            // drawn as cards to play, below
  else if (dummy) body = `<span class="bd-rows">${suitRows(s.hands[seat])}</span>`;
  else if (s.step === "play" || s.step === "trick") body = `<span class="bd-backs">${Array.from({ length: Math.min(n, 13) }, () => backHtml()).join("")}</span>`;
  else if (s.step === "bid" && turn) body = `<span class="bd-think">thinking</span>`;
  box.className = `bd-seat at-${place}${turn && !reveal ? " turn" : ""}${dummy ? " dummy" : ""}`;
  if (dummy && place === "top" && isMe(s.contract.declarer) && !reveal) {
    // your side declares and dummy is your partner: dummy's cards, yours to play, as a hand
    const live = s.step === "play" && s.turn === seat, ok = live ? new Set(legalCards(s.hands[seat], s.trick)) : null;
    const best = hint?.card != null && live ? hint.card : null;
    box.innerHTML = `${head}<div class="bd-dummy cd-row" data-seat="${seat}">${sortHand(s.hands[seat]).map(c => card(c, live ? `${ok.has(c) ? "ok" : "dim"}${c === best ? " coach" : ""}` : "", { card: c })).join("")}</div>`;
    fitRow(box.querySelector(".bd-dummy"), s.hands[seat].length, { max: 1.05, min: 0.6 });
    return;
  }
  box.innerHTML = `${head}${body}`;
}

/** A hand as a bridge column, a suit a line, as large as its seat allows: a long suit would run out of a narrow one. */
function fitColumns() {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  for (const el of document.querySelectorAll("#table .bd-rows")) {
    el.style.fontSize = "";
    const room = el.closest(".bd-seat").clientWidth - 6, size = parseFloat(getComputedStyle(el).fontSize);
    if (el.scrollWidth > room) el.style.fontSize = `${Math.max(size * room / el.scrollWidth, rem * 0.56)}px`;
  }
}

/** The middle: the auction while it's bid; the trick; a deal's result. */
function drawCentre(s) {
  const box = $("centre");
  if (s.step === "bid") { box.innerHTML = auctionTable(s, { live: true }); return; }
  if (s.step === "passed") { box.innerHTML = `<div class="bd-result"><b>Passed out</b><span>Nobody opened: the cards are dealt again.</span></div>`; return; }
  if (s.step === "scored" || s.step === "over") { box.innerHTML = resultCard(s); return; }
  const win = s.step === "trick" ? s.tricks.at(-1)?.winner : null;
  const cards = s.trick.map(t => `<span class="bd-play at-${placeOf(t.seat)}${t.seat === win ? " win" : ""}">${card(t.card)}</span>`).join("");
  const n = s.tricks.length + (s.step === "trick" ? 0 : 1);
  box.innerHTML = `<div class="bd-trick">${cards}</div><span class="bd-count">${s.step === "trick" ? `${esc(whoName(win))} ${isMe(win) ? "take" : "takes"} it` : `Trick ${Math.min(13, n)}`}</span>`;
}
/** The auction as bridge writes it, a column a seat, starting from your left: each call a button that says what it shows. */
function auctionTable(s, { live = false } = {}) {
  const order = [1, 2, 3, 0].map(d => (me() + d) % 4);
  const head = order.map(seat => `<th class="${s.vul[sideOf(seat)] ? "vul" : ""}${sideOf(seat) === sideOf(me()) ? " us" : ""}">${COMPASS[seat]}<small>${esc(isMe(seat) ? "you" : nameOf(seat))}</small></th>`).join("");
  const cells = [];
  for (let i = 0; i < order.indexOf(s.dealer); i++) cells.push(`<td></td>`);
  s.auction.forEach((a, i) => cells.push(`<td><button type="button" class="bd-call" data-call-at="${i}">${callHtml(a.call)}</button></td>`));
  if (live && s.step === "bid") cells.push(`<td class="next">${s.turn === me() ? "?" : "…"}</td>`);
  const rows = [];
  for (let i = 0; i < cells.length; i += 4) rows.push(`<tr>${cells.slice(i, i + 4).join("")}${"<td></td>".repeat(Math.max(0, 4 - cells.slice(i, i + 4).length))}</tr>`);
  return `<div class="bd-auction"><table><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}
function resultCard(s) {
  const r = s.result, mine = sideOf(me());
  if (s.step === "over") {
    const [a, b] = [s.scores[mine], s.scores[1 - mine]];
    return `<div class="bd-result"><b>${a > b ? "You win the match" : a < b ? "They win the match" : "The match is drawn"}</b><span>us ${a} · them ${b}</span><small>${DEALS} deals of Chicago</small></div>`;
  }
  if (!r) return "";
  const c = s.contract, need = c.level + 6, diff = r.tricks - need;
  const how = diff >= 0 ? (diff ? `made, ${diff} over` : "made") : `down ${-diff}`;
  const ours = sideOf(c.declarer) === mine, pts = r.ns * (mine === 0 ? 1 : -1);
  return `<div class="bd-result"><b>${contractHtml(c)} by ${esc(nameOf(c.declarer))}: ${how}</b>
    <span class="bd-delta ${pts >= 0 ? "up" : "down"}">${pts >= 0 ? "+" : "−"}${Math.abs(pts)} ${pts >= 0 ? "to us" : "to them"}</span>
    <small>${r.parts.map(([k, x]) => `${esc(k)} ${x < 0 ? "−" : ""}${Math.abs(x)}`).join(" · ")}${ours ? "" : ""}</small>
    <span class="bd-next"><i style="animation-duration:${DEAL_MS}ms"></i></span>
    <button class="link bd-review-btn" type="button" data-act="review">The four hands</button></div>`;
}
/** Held sideways, the auction stays beside the table through the play. */
function drawAside(s) {
  $("aside").innerHTML = s.step !== "bid" && s.auction.length ? auctionTable(s) : "";
}

/** Your hand along the foot: the cards you may play lifted on your turn (dummy's, at the top, on dummy's). */
function drawHand(s) {
  const box = $("hand"), seat = V.seat;
  if (seat == null) { box.innerHTML = `<p class="bd-status">Watching: you sit down at the next match.</p>`; return; }
  const live = s.step === "play" && s.turn === seat && rules.toMove(s) === seat;
  const ok = live ? new Set(legalCards(s.hands[seat], s.trick)) : null, best = live && hint?.card != null ? hint.card : null;
  const hand = sortHand(s.step === "scored" || s.step === "over" ? s.dealt[seat] : s.hands[seat]);
  box.innerHTML = hand.map(c => card(c, live ? `${ok.has(c) ? "ok" : "dim"}${c === best ? " coach" : ""}` : "", { card: c })).join("");
  box.classList.toggle("is-dummy", !!(s.contract && seat === dummyOf(s) && s.step !== "bid"));
  fitRow(box, hand.length, { max: 1.25 });
}

/** The line over your hand: a hint or a call explained while they last, else what the table waits on. */
function drawSay(s) {
  const el = $("say");
  if (hint?.html) { el.innerHTML = hint.html; return; }
  if (said?.html) { el.innerHTML = said.html; return; }
  el.innerHTML = esc(statusOf(s));
  el.querySelector(".bd-wait")?.append(sextant());
}
function statusOf(s) {
  const seat = V.seat, who = rules.toMove(s);
  if (s.step === "bid") return who === seat ? (s.auction.length ? "Your call. Tap a call in the auction to see what it showed." : "Your call: you're the dealer.") : `${nameOf(who)} is thinking…`;
  if (s.step === "play") {
    const dummy = dummyOf(s), hand = s.turn;
    if (who === seat) {
      if (hand !== seat) return `Dummy's card: you play it${s.trick.length ? "" : " (dummy leads)"}.`;
      return !s.tricks.length && !s.trick.length ? "Your opening lead." : s.trick.length ? "Your card: follow suit if you can." : "Your lead.";
    }
    if (hand === dummy) return `${nameOf(s.contract.declarer)} plays dummy's card…`;
    return `${nameOf(hand)} is thinking…`;
  }
  if (s.step === "trick") return "";
  if (s.step === "passed") return "Passed out.";
  if (s.step === "scored") return s.no >= DEALS ? "The last deal of the match." : `Deal ${s.no + 1} of ${DEALS} next.`;
  return "";
}

/** Under your hand: the bidding box while it's bid, else the hint. */
function drawControls(s) {
  const box = $("controls"), seat = V.seat;
  if (seat == null) { box.innerHTML = ""; return; }
  if (s.step === "over") {
    box.innerHTML = `<div class="bd-bar"><button class="btn primary bd-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New match" : "The result"}</button></div>`;
    return;
  }
  if (s.step === "bid") { box.innerHTML = biddingBox(s); return; }
  const mineNow = s.step === "play" && rules.toMove(s) === seat;
  const hintBtn = opts.hints ? `<button class="btn bd-hint" type="button" data-act="hint"${mineNow ? "" : " disabled"}>Hint</button>` : "";
  box.innerHTML = `<div class="bd-bar">${hintBtn}<button class="btn bd-aux" type="button" data-act="auction">Auction</button><button class="btn bd-aux" type="button" data-act="review"${s.history.length || s.step === "scored" ? "" : " disabled"}>Review</button></div>`;
}
function biddingBox(s) {
  const seat = V.seat, mine = s.turn === seat, legal = new Set(mine ? legalCalls(s.auction, seat) : []);
  const levelOk = l => [0, 1, 2, 3, 4].some(st => legal.has(bidCall(l, st)));
  const hintCall = hint?.call && mine ? hint.call : null;
  const levels = [1, 2, 3, 4, 5, 6, 7].map(l => `<button class="btn bd-lv${pick.level === l ? " on" : ""}${hintCall && bidOf(hintCall)?.level === l ? " coach" : ""}" type="button" data-level="${l}"${levelOk(l) ? "" : " disabled"}>${l}</button>`).join("");
  const strains = [0, 1, 2, 3, 4].map(st => {
    const call = pick.level ? bidCall(pick.level, st) : null, ok = call && legal.has(call);
    return `<button class="btn bd-st${call && pick.call === call ? " on" : ""}${hintCall === call && call ? " coach" : ""}" type="button" data-strain="${st}"${ok ? "" : " disabled"}>${st === NT ? "NT" : suitMark(st)}</button>`;
  }).join("");
  const dbl = legal.has("XX") ? "XX" : "X";
  const bid = pick.call ? `Bid ${callHtml(pick.call)}` : "Bid";
  const hintBtn = opts.hints ? `<button class="btn bd-hint" type="button" data-act="hint"${mine ? "" : " disabled"}>Hint</button>` : "";
  return `<div class="bd-box${mine ? "" : " wait"}"><div class="bd-levels">${levels}</div><div class="bd-strains">${strains}</div>
    <div class="bd-calls"><button class="btn bd-pass${hintCall === "P" ? " coach" : ""}" type="button" data-call="P"${legal.has("P") ? "" : " disabled"}>Pass</button><button class="btn bd-dbl${hintCall === dbl ? " coach" : ""}" type="button" data-call="${dbl}"${legal.has(dbl) ? "" : " disabled"}>${dbl === "XX" ? "Rdbl" : "Dbl"}</button>${hintBtn}<button class="btn primary bd-bid" type="button" data-act="bid"${pick.call ? "" : " disabled"}>${bid}</button></div></div>`;
}

// ---------- your moves ----------
async function playCard(c) {
  const s = V?.state;
  if (!s || s.step !== "play" || rules.toMove(s) !== V.seat) return;
  if (!legalCards(s.hands[s.turn], s.trick).includes(c)) { toast(`Follow suit: ${SUITS[suitOf(s.trick[0].card)]} was led`); return; }
  hint = null;
  const why = await page.move({ t: "card", card: c });
  if (why) toast(why);
}
async function makeCall(call) {
  const s = V?.state;
  if (!s || s.step !== "bid" || s.turn !== V.seat) return;
  hint = null;
  pick = { level: null, call: null };
  const why = await page.move({ t: "call", call });
  if (why) toast(why);
}
$("hand").addEventListener("click", e => {
  const el = e.target.closest("[data-card]");
  if (el && V?.state?.turn === V.seat) playCard(Number(el.dataset.card));
});
$("seatTop").addEventListener("click", e => {
  const el = e.target.closest(".bd-dummy [data-card]");
  if (el) playCard(Number(el.dataset.card));
});
$("controls").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.act === "new") { newGame(); return; }             // also a table's first: there's no game yet
  if (!V?.G) return;
  const s = V.state;
  if (b.dataset.act === "result") { showEnd(V); return; }
  if (b.dataset.act === "hint") { showHint(); return; }
  if (b.dataset.act === "auction") { showAuction(); return; }
  if (b.dataset.act === "review") { showReview(); return; }
  if (b.dataset.level) { pick = { level: Number(b.dataset.level), call: null }; drawControls(s); return; }
  if (b.dataset.strain) {
    const call = bidCall(pick.level, Number(b.dataset.strain));
    if (pick.call === call) { makeCall(call); return; }        // a second tap on it bids it
    pick.call = call;
    drawControls(s);
    return;
  }
  if (b.dataset.act === "bid" && pick.call) { makeCall(pick.call); return; }
  if (b.dataset.call) makeCall(b.dataset.call);
});
// a call in the auction says what it showed, as the system reads it
function explainAt(i) {
  const s = V?.state;
  if (!s || !s.auction[i]) return;
  const a = s.auction[i], words = explainCall(s.auction, s.dealer, i);
  said = { key: keyOf(s), html: `<b class="bd-who">${esc(whoName(a.seat))}: ${callHtml(a.call)}</b> ${esc(words || "natural")}` };
  drawSay(s);
}
$("centre").addEventListener("click", e => {
  const b = e.target.closest("[data-call-at]");
  if (b) { explainAt(Number(b.dataset.callAt)); return; }
  if (e.target.closest("[data-act=review]")) showReview();
});
$("aside").addEventListener("click", e => { const b = e.target.closest("[data-call-at]"); if (b) explainAt(Number(b.dataset.callAt)); });
$("info").addEventListener("click", e => { if (e.target.closest("[data-act=auction]")) showAuction(); });

// ---------- hints ----------
// Bidding: the call the system makes with your hand, and what it shows. Play: the card the computer would play in your
// seat (the double-dummy sampling, as Hard plays), with how often it reaches your side's goal over the deals weighed.
async function showHint() {
  const s = V?.state;
  if (!s) return;
  const key = keyOf(s);
  if (s.step === "bid") {
    if (s.turn !== V.seat) return;
    const { call, rule } = chooseCall(s.hands[V.seat], s.auction, s.dealer);
    const b = bidOf(call);
    pick = b ? { level: b.level, call } : { level: null, call: null };
    hint = { key, kind: "bid", call, html: `<b class="bd-coach">Hint</b> ${callHtml(call)}: ${esc(meaningLine(rule))}` };
    draw();
    return;
  }
  if (s.step !== "play" || rules.toMove(s) !== V.seat) return;
  hint = { key, kind: "play", card: null, html: `<span class="bd-wait"></span>Thinking it through…` };
  drawSay(s);
  $("say").querySelector(".bd-wait")?.append(sextant());
  const ans = await ask({ kind: "hint", state: s, seat: V.seat });
  if (!hint || hint.key !== key) return;
  if (!ans) { hint = { key, kind: "play", card: null, html: "The hint couldn't be worked out here." }; drawSay(s); return; }
  hint = { key, kind: "play", card: ans.card, list: ans.list, html: playHintLine(s, ans) };
  draw();
}
/** The system's call in words: its name, what it shows partner, and why (a pass is named by its reason or its reading). */
function meaningLine(r) {
  const name = (r.name === "pass" ? "" : r.name) || r.why, why = name === r.why ? "" : r.why;
  const shows = [showText(r), r.forcing && !/forcing/i.test(name) ? "forcing" : ""].filter(Boolean).join("; ");
  const text = name && shows ? `${name} (${shows})` : name || shows || "no bid fits this hand";
  return why ? `${text}: ${why}` : text;
}
function playHintLine(s, ans) {
  const list = ans.list || [], c = ans.card, best = list.find(x => x.card === c);
  const g = s.contract, decl = sideOf(rules.toMove(s)) === sideOf(g.declarer);
  const goal = decl ? `makes ${contractText(g)}` : `beats ${contractText(g)}`;
  if (!best) return `<b class="bd-coach">Hint</b> ${cardSpan(c)}${!s.tricks.length && !s.trick.length ? ": the usual opening lead from this hand" : ": the only card"}.`;
  const next = list.find(x => x.card !== c && suitOf(x.card) !== suitOf(c)) || list.find(x => x.card !== c);
  const pct = x => `${Math.round(x.make * 100)}%`;
  return `<b class="bd-coach">Hint</b> ${cardSpan(c)} ${goal} in ${pct(best)} of ${best.n} deals of the hands you can't see${next ? `; ${cardSpan(next.card)} ${pct(next)}` : ""}.`;
}
const cardSpan = c => `<b class="bd-card${red(suitOf(c)) ? " red" : ""}">${SUITS[suitOf(c)]}${RANKS[rankOf(c)]}</b>`;

// ---------- the auction, the review of a deal, the end ----------
function showAuction() {
  const s = V?.state;
  if (!s) return;
  $("reviewHead").textContent = "The auction";
  $("reviewBody").innerHTML = `${auctionTable(s)}<ol class="bd-meanings">${s.auction.map((a, i) => (a.call === "P" && i < s.auction.length - 3 && !explainCall(s.auction, s.dealer, i).replace(/^Pass:?\s*/i, "") ? "" : `<li><b>${esc(COMPASS[a.seat])} ${callHtml(a.call)}</b> ${esc(explainCall(s.auction, s.dealer, i) || "natural")}</li>`)).join("")}</ol>`;
  if (!$("reviewDlg").open) $("reviewDlg").showModal();
}
/** The four hands of the last deal played (or this one, once it's over), the auction and what it came to, and the
 *  tricks the contract makes with every card seen. */
function showReview() {
  const s = V?.state;
  if (!s) return;
  const h = s.step === "scored" || s.step === "over" ? s.history.at(-1) : s.history.at(-1);
  if (!h) { toast("No deal finished yet"); return; }
  const at = place => [0, 1, 2, 3].find(i => placeOf(i) === place);
  const hand = seat => `<div class="bd-dia-hand at-${placeOf(seat)}"><b>${esc(COMPASS[seat])} · ${esc(nameOf(seat))}</b><small>${hcp(h.dealt[seat])} points</small>${suitRows(h.dealt[seat], { lit: h.lead != null && seat === (h.contract.declarer + 1) % 4 ? h.lead : null })}</div>`;
  const r = dealScore(h.contract, h.tricks, h.vul[sideOf(h.contract.declarer)]);
  const need = h.contract.level + 6, diff = h.tricks - need;
  $("reviewHead").textContent = `Deal ${h.no}`;
  $("reviewBody").innerHTML = `<div class="bd-dia">${hand(at("top"))}${hand(at("left"))}<div class="bd-dia-mid">${esc(vulText(h.vul))}<br>${esc(COMPASS[h.dealer])} dealt</div>${hand(at("right"))}${hand(at("me"))}</div>
    <p class="bd-review-line"><b>${contractHtml(h.contract)} by ${esc(nameOf(h.contract.declarer))}</b>: ${h.tricks} tricks, ${diff >= 0 ? (diff ? `made with ${diff} over` : "made") : `down ${-diff}`}, ${Math.abs(r.score)} to ${esc(SIDES[r.score >= 0 ? sideOf(h.contract.declarer) : 1 - sideOf(h.contract.declarer)])}.</p>
    <p class="bd-review-line" id="parLine"><span class="bd-wait"></span>With every card seen…</p>
    ${auctionTable({ ...s, auction: h.auction, dealer: h.dealer, vul: h.vul, step: "done" })}`;
  $("parLine").querySelector(".bd-wait")?.append(sextant());
  if (!$("reviewDlg").open) $("reviewDlg").showModal();
  ask({ kind: "par", state: { dealt: h.dealt, contract: h.contract } }).then(p => {
    const el = $("parLine");
    if (!el) return;
    el.textContent = p ? `With every card seen, ${contractText(h.contract)} by ${COMPASS[h.contract.declarer]} takes ${p.tricks} tricks (the defence's best lead, and both sides at their best).` : "";
  });
}
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, mine = sideOf(v.seat), won = s.scores[mine] > s.scores[1 - mine];
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("contract", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1500);
}
function showEnd(v) {
  const s = v.state, mine = sideOf(v.seat ?? 0), [a, b] = [s.scores[mine], s.scores[1 - mine]];
  $("endHead").textContent = a > b ? "You win the match" : a < b ? "They win the match" : "The match is drawn";
  const rows = s.history.map(h => {
    const ns = h.ns * (mine === 0 ? 1 : -1);
    return `<li><span class="nm">${h.no}. ${contractHtml(h.contract)} ${esc(COMPASS[h.contract.declarer])}, ${h.tricks} tricks</span><b class="${ns >= 0 ? "up" : "down"}">${ns >= 0 ? "+" : "−"}${Math.abs(ns)}</b></li>`;
  }).join("");
  $("endBody").innerHTML = `<ol class="bd-standings">${rows}</ol><p class="bd-end-note">Us ${a}, them ${b}: four deals of Chicago, scored as duplicate scores each deal.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  hint = said = null;
  page.deal({}, 4);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
const RULES = `<p>Bridge is played by four, in two partnerships sitting across from each other: North–South against East–West. All 52 cards are dealt, thirteen each.</p>
  <h3>The auction</h3><p>Starting with the dealer and going clockwise, each player calls: a bid, a pass, a double or a redouble. A bid names a number of tricks over six (one to seven) and a strain: clubs ♣, diamonds ♦, hearts ♥, spades ♠ or notrump, in that order from the lowest. Each bid must be higher than the last: more tricks, or as many in a higher strain. You may double the opponents' last bid, and redouble their double of yours. Three passes after a bid end the auction; four passes at the start, and the cards are dealt again.</p>
  <p>The last bid is the contract. Of the side that won it, whoever first named its strain is declarer; the player on declarer's left leads, and then declarer's partner lays their cards face up as dummy. Declarer plays both hands.</p>
  <h3>The play</h3><p>Thirteen tricks. Each player in turn plays a card; you must follow the suit led if you can, and otherwise may play anything. The highest card of the suit led takes the trick, unless a trump is played (a card of the contract's suit), when the highest trump takes it. Whoever takes a trick leads to the next.</p>
  <h3>The score</h3><p>Made, the contract scores its tricks: 20 a trick in clubs and diamonds, 30 in hearts and spades, 40 for the first in notrump and 30 after; doubled twice that, redoubled four times. A contract worth 100 or more is a game: 300 more, or 500 vulnerable. Less is a part-score: 50 more. A small slam (12 tricks) adds 500 (750 vulnerable), a grand slam (all 13) 1000 (1500). Made doubled, 50 more; redoubled, 100. Overtricks score their trick value, or 100 each doubled (200 vulnerable), twice that redoubled.</p>
  <p>Down, the defenders score 50 a trick (100 vulnerable). Doubled: 100 for the first, 200 for the second and third, 300 for each after; vulnerable, 200 for the first and 300 for each after. Redoubled, twice that.</p>
  <h3>Chicago</h3><p>A match is four deals, the deal passing clockwise. On the first nobody is vulnerable, on the second and third the dealer's side, on the fourth both. Each deal is scored as above and the side with the more points after four wins.</p>
  <h3>The computer's system</h3><p>The computer bids Standard American Yellow Card (SAYC): five-card majors, a 15–17 notrump, strong 2♣, weak twos, Stayman, Jacoby transfers, Jacoby 2NT, negative doubles, Blackwood. Tap any call in the auction to see what it showed.</p>`;
function showRules() { $("rulesBody").innerHTML = RULES; $("rulesDlg").showModal(); }

// ---------- the course ----------
// Learn (the header): bridge taught from nothing (contract-course.js) on the course's sheet (course.js); its last
// lesson starts a match.
const course = createCourse({
  id: "contract", course: COURSE, cls: "bd", inFrame: IN_FRAME, stage: courseStage(),
  onRules: showRules,
  onPlay: step => {
    if (page.atTable) { toast("Your table plays on: start a match when you're back to solo"); return; }
    if (step?.level) { opts.level = step.level; saveOpts(); }
    newGame();
  },
});

// Puzzle rush (the menu): the best card in positions from the computer players' own games, against the clock, with
// every game's rush settings, on a sheet of its own (contract-rush-ui.js); the game waits under it.
const rush = createRush({ inFrame: IN_FRAME });

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New match", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("contract", COURSE);
  play.append(action(cp.done ? `Learn bridge: ${cp.done} of ${cp.of} lessons done` : "Learn bridge, from the rules", () => course.open()));
  if (!IN_FRAME) play.append(action("Puzzle rush", () => rush.open()));
  play.append(action("The last deal", showReview, "link"));
  play.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  set.append(choice("The computer", LEVELS, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line(opts.level === "easy" ? "Easy plays its cards by the rules of thumb." : "Medium and Hard weigh each card over deals of the hands they can't see, solved with every card seen; Hard looks at more of them."));
  set.append(toggle("Hints", opts.hints, on => { opts.hints = on; saveOpts(); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), about = part(body, "about"), rushBests = bestsLine(rush.bests());
  about.append(line(r.played ? `Won ${r.won} of ${r.played} matches.` : "No match finished yet."), ...(rushBests ? [line(rushBests)] : []));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "contract");
document.querySelector(".bd-mark").innerHTML = APPS.find(a => a.id === "contract")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("reviewClose").addEventListener("click", () => $("reviewDlg").close());
addEventListener("resize", () => { if (V?.G) draw(); });
window.__contract = { page, get view() { return V; }, opts, course, rush, ask };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
