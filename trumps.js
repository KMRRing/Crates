// Trumps: the trick-taking games of a Swiss, a French and a Bavarian table, four players, against the computer or with
// friends each on their own phone: Jass (the Schieber), Belote, Coinche and Schafkopf. The games are trumps-games.js's,
// the running seats.js's, the computer trumps-bot.js's. This page sets the table out the game's way round (Jass and
// Belote pass to the right, Schafkopf to the left), deals your hand along the foot, the trick in the middle, and the
// bidding under your hand: a tap on a card you may play plays it. The cards are as large as the screen allows, your
// hand the trick's size (fitTable); Full screen (the menu) gives them the header's row too.
import { rules } from "./trumps-rules.js";
import { GAMES, teamOf, COINCHE_VALUES, laufende, sortHand } from "./trumps-games.js";
import { LEVEL_NAMES, aheadKey, remember, THINK, thinksAhead } from "./trumps-bot.js";
import { weighCards, bidOptions } from "./trumps-think.js";
import { adviceWords, verdictOf, cardRows, bidAdvice, bidVerdict, bidRows, pct, signed } from "./trumps-coach.js";
import { sextant } from "./loading.js";
import { PACKS, JASS_FRENCH, suitOf, rankOf, cardName, packCard, suitIcon, LOOK } from "./trumps-cards.js";
import { deckPics } from "./trumps-deck.js";
import { cardHtml, backHtml } from "./cards.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, cardStage } from "./trumps-course.js";
import { createRush } from "./trumps-rush-ui.js";
import { bestsLine } from "./rush-core.js";
import { sideways } from "./wide.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "trumps:opts", RECORD = "trumps:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// the computer players, by the game's country
const BOTS = { jass: ["Ueli", "Vreni", "Beat"], belote: ["Gérard", "Martine", "Didier"], coinche: ["Gérard", "Martine", "Didier"], schafkopf: ["Sepp", "Resi", "Xaver"] };

let opts = { game: "jass", level: "medium", voice: true, full: false, jass: { pack: "swiss", count: "simple", target: 1000, weis: true }, belote: { target: 1000 }, coinche: { target: 2000 }, schafkopf: { deals: 8 }, ...read(OPTS, {}) };
if (!GAMES[opts.game]) opts.game = "jass";
const saveOpts = () => write(OPTS, opts);
// Schafkopf's cards simple (the suits' marks, the rank in the corner) or as the whole Bavarian pack, drawn
// (trumps-deck.js), at the table and in the course and the rush alike
const applyLook = () => { LOOK.german = opts.look === "pictures" ? deckPics() : null; };
applyLook();

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the cards ----------
const packOf = s => GAMES[s.game].pack(s.opts);
/** A card as markup, in its game's pack. */
function card(id, s, { cls = "", data = {} } = {}) {
  const pack = packOf(s), p = PACKS[pack];
  if (pack === "french") {
    const suit = s.game === "jass" ? JASS_FRENCH[suitOf(id)] : suitOf(id);
    return cardHtml({ rank: p.rank[rankOf(id)], suit }, { cls, data, label: cardName(id, "french", s.game === "jass" ? JASS_FRENCH : null) });
  }
  return packCard(id, pack, { cls, data });
}
/** A suit's mark and name in the game's pack. */
function suitMark(s, suit) {
  const pack = packOf(s);
  if (pack === "french") { const f = s.game === "jass" ? JASS_FRENCH[suit] : suit; return { mark: `<span class="tr-fs${f === 0 || f === 2 ? " red" : ""}">${PACKS.french.suits[f]}</span>`, name: PACKS.french.en[f] }; }
  return { mark: `<span class="tr-icon">${suitIcon(pack, suit)}</span>`, name: PACKS[pack].suits[suit] };
}

// ---------- the computer players and the coach, each in a worker ----------
// Schafkopf's Hard players think for up to a second or two a card (trumps-think.js), so they think in a worker
// (trumps-worker.js) while the table waits its pace, and the table's move takes what they worked out; the coach in a
// second one, so its look at your cards never holds up a move. Where a worker can't run, they think here, briefly.
const PACE = 650;
const workers = { players: null, coach: null };
let asked = 0;
const answers = new Map();                                       // id → [the worker's role, its answer's callback]
function workerFor(role) {
  if (workers[role] === null) {
    try {
      const w = new Worker(new URL("./trumps-worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => { const [, done] = answers.get(e.data.id) || []; answers.delete(e.data.id); done?.(e.data.error ? null : e.data.answer); };
      w.onerror = () => {
        workers[role] = false;
        for (const [id, [r, done]] of answers) if (r === role) { answers.delete(id); done(null); }
      };
      workers[role] = w;
    } catch { workers[role] = false; }
  }
  return workers[role];
}
/** A worker's answer, or null (no worker, or it failed): the caller then thinks here. */
function ask(role, msg) {
  const w = workerFor(role);
  if (!w) return Promise.resolve(null);
  return new Promise(res => { const id = ++asked; answers.set(id, [role, res]); w.postMessage({ id, ...msg }); });
}
THINK.ms = 600;                                                  // a move not worked out ahead thinks here this long at most
// The computer's move worked out ahead: the decision the table waits on now (want), and the one asked for (ahead).
// Solo, the table holds the move until it's in; at a table with others, this phone runs it and takes it if it's in
// by the pace, else thinks briefly itself.
let want = null, ahead = { key: null, since: 0, done: true };
function lookAhead(v) {
  want = null;
  if (!v?.G || v.over || v.toMove == null || !v.seats[v.toMove]?.bot || (v.state.step !== "play" && v.state.step !== "bid")) return;
  if (!thinksAhead(v.state.game, opts.level) || IN_FRAME || (v.mode !== "solo" && !v.me?.driver)) return;
  want = aheadKey(v.state, v.toMove, opts.level);
  if (ahead.key === want) return;
  const a = ahead = { key: want, since: Date.now(), done: false };
  ask("players", { kind: "move", state: v.state, seat: v.toMove, level: opts.level }).then(move => {
    a.done = true;
    if (move) remember(a.key, move);
    if (ahead === a) page?.runner.kick();
  });
}
const holding = () => (want != null && !(ahead.key === want && ahead.done)) || awaitingDeal();
/** The table's pace, the computer's thinking counted in it. */
const paceNow = () => (want != null && ahead.key === want ? Math.max(120, PACE - (Date.now() - ahead.since)) : PACE);

// ---------- the table ----------
let V = null, page = null;

// Solo, a hand's score stays up until you deal the next (Next hand, or a tap on the score): the table holds its clock
// till then. At a table with others it moves on by itself after a few seconds, so nobody's tap holds up the rest.
let dismissed = null;                                            // the hand whose score you've put away
const handKey = v => `${v.G.seq}:${v.state.handNo}`;
const awaitingDeal = () => V?.mode === "solo" && V.seat != null && V.state?.step === "scored" && dismissed !== handKey(V);
function nextHand() {
  if (!awaitingDeal()) return;
  dismissed = handKey(V);
  page.runner.kick();
}
const nextLabel = s => (GAMES[s.game].done(s) ? "The result" : "Next hand");
page = seatPage({
  // app 2: the table's coach is the table's (house), kept on every phone; an older page at the table updates first
  rules, id: "trumps", app: 2, pace: paceNow, hold: holding, botName: s => (BOTS[V?.state?.game || opts.game] || BOTS.jass)[(s + 3) % 3] || `Seat ${s + 1}`,
  level: () => opts.level, voice: () => opts.voice, onView: v => { V = v; lookAhead(v); draw(); }, onOver, toast, newGame,
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

let coachWas = null;
function draw() {
  if (!page) return;
  if (coach() !== coachWas) { coachWas = coach(); advice = said = null; }   // the table's coach changed: its words go
  const v = V;
  placeFull();
  if (!v?.G) { $("info").innerHTML = ""; for (const id of ["seatTop", "seatLeft", "seatRight"]) $(id).replaceChildren(); $("centre").innerHTML = ""; $("hand").innerHTML = ""; $("controls").innerHTML = `<button class="btn primary tr-go" type="button" data-act="new">New game</button>`; return; }
  if (coach() === "on" && !v.over) { const a = adviceNow(); if (a) a.shown = true; }
  drawInfo(v.state);
  for (const [id, place] of [["seatTop", "top"], ["seatLeft", "left"], ["seatRight", "right"]]) drawSeat($(id), v.state, seatAt(v.state, place));
  drawCentre(v.state);
  drawHand(v.state);
  drawControls(v.state);
  fitTable();
}

// ---------- the sizes ----------
// The cards as large as the screen lets them be, your hand the size of the trick's: one size for both (a card is 2.5
// by 3.5 of it), the largest at which the trick's cross (8.4 by 8.6) fits the table's middle and your hand fits along
// its box with each card showing its corner, for as many cards as the deal gives, so the hand keeps its size as it's
// played out; the others' backs as large as their places let them be. The rest (the header, the line across the top,
// the names, your status or the coach's line) keeps its size, and the cards take what's left: upright the middle and
// your hand share the table's height, sideways your hand has the side column. Sized for the play: the bidding's
// buttons, taller than the play's line, take their room from the table, not from the cards.
const DEALT = { jass: 9, belote: 8, coinche: 8, schafkopf: 8 };
const SHOW = 0.9, BACK_SHOW = 0.62, LIFT = 0.45;       // in a card's size: how much of each card a hand shows; a lifted card's rise
let cardPx = 0;
function fitTable() {
  const s = V?.state;
  if (!s) return;
  const app = $("app"), centre = $("centre"), hand = $("hand"), side = $("side"), n = DEALT[s.game] || 8, beside = sideways();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const room = Math.min(...["seatTop", "seatLeft", "seatRight"].map(id => $(id).clientWidth * 0.92));
  // twice: the backs are capped by the cards' size, and the cards then have what the backs leave
  for (let pass = 0; pass < 2; pass++) {
    // the others' backs, each fanned along its place, no larger than half your cards
    const back = Math.min(room / (2.5 + (n - 1) * BACK_SHOW), cardPx ? cardPx * 0.5 : Infinity);
    app.style.setProperty("--tr-back", `${back.toFixed(2)}px`);
    // the play's line under your hand, measured as it would be drawn in the play
    const probe = playProbe(s), spare = Math.max(0, $("controls").offsetHeight - probe);
    const byHand = hand.clientWidth / (2.5 + (n - 1) * SHOW);
    let byTable = centre.clientWidth / 8.4;
    if (beside) {
      const gap = parseFloat(getComputedStyle(side).rowGap) || 0;
      byTable = Math.min(byTable, centre.clientHeight / 8.6, (side.clientHeight - probe - gap) / (3.5 + LIFT));
    } else byTable = Math.min(byTable, (centre.clientHeight + spare + hand.offsetHeight) / (8.6 + 3.5 + LIFT));
    const size = Math.max(rem, Math.min(byHand, byTable, 6 * rem));
    // a pixel either way isn't worth redrawing the table for (and keeps a measure from chasing its own tail)
    if (Math.abs(size - cardPx) >= 0.5) {
      cardPx = Math.floor(size * 4) / 4;
      app.style.setProperty("--tr-card", `${cardPx}px`);
    }
  }
  spreadHand();
}
/** Your cards along their box: as far apart as it lets them be, up to side by side. */
function spreadHand() {
  const hand = $("hand"), k = hand.querySelectorAll(".cd").length, cw = 2.5 * cardPx;
  if (!cardPx) return;
  const step = k > 1 ? Math.min(cw * 1.04, (hand.clientWidth - cw) / (k - 1)) : 0;
  hand.style.setProperty("--cd-size", `${cardPx}px`);
  hand.style.setProperty("--cd-step", `${Math.max(step, cw * 0.28).toFixed(2)}px`);
}
/** How tall the controls are in the play (your status, or the coach's line): drawn once, unseen, beside the real ones. */
function playProbe(s) {
  let probe = $("ctlProbe");
  if (!probe) {
    probe = document.createElement("div");
    probe.id = "ctlProbe";
    probe.className = "tr-controls tr-probe";
    probe.setAttribute("aria-hidden", "true");
    $("controls").after(probe);
  }
  const html = coaching() ? coachBar(s, "Your card", false) : `<p class="tr-status">Your card</p>`;
  if (probe.dataset.html !== html) { probe.innerHTML = html; probe.dataset.html = html; }
  return probe.offsetHeight;
}

// ---------- full screen ----------
/**
 * Full screen (Menu): the line across the top goes into the header, between the game's mark and the menu, so the two
 * rows are one and the cards have the other's room (Learn is in the menu too). Where the browser can, the page goes
 * full screen as well (an app on the home screen already is); the setting stays when the browser leaves it.
 */
function placeFull() {
  const app = $("app"), top = document.querySelector("header.top"), info = $("info"), on = !!opts.full;
  app.classList.toggle("full", on);
  if (on && info.parentElement !== top) top.querySelector(".top-right").before(info);
  if (!on && info.parentElement === top) top.after(info);
}
function fullScreen(on) {
  try {
    if (on && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch { /* a browser without it: the layout alone */ }
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
    score = `<span class="tr-score"><b>${s.scores[mine]}</b> us · <b>${s.scores[1 - mine]}</b> them <small class="tr-target">to ${s.opts.target}</small></span>`;
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
  const back = LOOK.german && s.game === "schafkopf" ? `<span class="cd tr-cd pic tr-back"><img src="${LOOK.german.back}" alt="" draggable="false"></span>` : backHtml();
  // the name, the dealer's mark and the role on one line; the backs; what's said in a bubble over the table below
  box.innerHTML = `<span class="tr-who"><span class="tr-name">${esc(nameOf(seat))}</span>${dealer}${role}</span><span class="tr-backs">${Array.from({ length: Math.min(n, 9) }, () => back).join("")}</span>${bubble}${weisLine(s, seat)}`;
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
    return `<div class="tr-result"><b>${esc(side)} ${r.side.length > 1 ? (r.won ? "win" : "lose") : r.won ? "wins" : "loses"}</b><span>${r.pts[0]} to ${r.pts[1]}${r.schwarz ? " · schwarz" : r.schneider ? " · Schneider" : ""}${r.laufende ? ` · ${r.laufende} Laufende` : ""}</span>
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
  // the coach's card, once asked for (or always)
  const a = mine && coaching() && advice?.shown && advice.kind === "play" && advice.list && advice.key === aheadKey(s, seat, "coach") ? advice : null;
  const best = a?.list?.[0]?.card;
  box.innerHTML = hand.map(id => card(id, s, { cls: mine ? `${ok.has(id) ? "ok" : "dim"}${id === best ? " coach" : ""}` : "", data: { card: id } })).join("");
  spreadHand();
}
// a tap on a hand's score puts it away too, and deals the next
$("centre").addEventListener("click", () => { if (awaitingDeal()) nextHand(); });
$("hand").addEventListener("click", async e => {
  const el = e.target.closest("[data-card]");
  const s = V?.state;
  if (!el || !s || s.step !== "play" || s.turn !== V.seat) return;
  const id = Number(el.dataset.card);
  if (!GAMES[s.game].legal(s, V.seat).includes(id)) { toast(followHint(s)); return; }
  noteMove(s, { t: "card", card: id });
  const why = await page.move({ t: "card", card: id });
  if (why) toast(why);
});
function followHint(s) {
  if (s.game === "schafkopf" && s.contract.type === "sau" && s.hands[V.seat].some(id => rankOf(id) === "A" && suitOf(id) === s.contract.ace)) return "The called ace: it must come when its suit is led, and can't be thrown away";
  if (s.game === "belote" || s.game === "coinche") return "Follow suit; if you can't, trump (and beat a trump in), unless your partner holds the trick";
  if (s.game === "jass") return "Follow suit or trump; never under a trump already in, unless you've nothing else";
  return "Follow suit if you can";
}

// ---------- the coach ----------
// Schafkopf's coach, as the menu sets it: off; hints, its card (or game) when you ask; check, a hint when you ask and a
// word after each card or bid of yours it would have made otherwise, by how much and why; on (Always), its card marked
// at each of your turns as well. Its look is trumps-think.js's (a card weighed over deals of the cards you can't see,
// in the coach's worker; a game by the bidding's fit, trumps-bids.js), its words trumps-coach.js's. While it's on, its
// line keeps its room under your cards, so the table doesn't change size as it speaks.
const COACH = [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]];
if (!COACH.some(([k]) => k === opts.coach)) opts.coach = "hints";
// At a table the coach is the table's (its house rules, kept on the table), set by its host, a party's host: the same on
// every phone, so the host's Off is everyone's. Solo, it's yours.
const house = () => (page?.atTable ? page.runner.table.data?.house || {} : {});
const coach = () => (COACH.some(([k]) => k === house().coach) ? house().coach : opts.coach);
/** Whether this phone sets the coach: solo, or the table's host. */
const setsRules = () => !page?.atTable || !!page.runner.table.me?.host;
let advice = null;          // its look at your decision now: { key, kind, list, shown, ready }
let said = null;            // its word on your last move it would have made otherwise: { hand, words, kind, state, list, mine, best }
const coaching = () => V?.state?.game === "schafkopf" && coach() !== "off" && V.seat != null && !IN_FRAME;
const checking = () => coaching() && (coach() === "check" || coach() === "on");
const myTurn = s => (s.step === "play" || s.step === "bid") && s.turn === V?.seat;
/** The coach's look at a decision: a card's weighed in its worker (here, more briefly, without one), a game's by the fit. */
function lookAt(s, seat) {
  const a = { key: aheadKey(s, seat, "coach"), kind: s.step, list: null, shown: false };
  if (s.step === "bid") { a.list = bidOptions(s, seat); a.ready = Promise.resolve(a.list); return a; }
  a.ready = ask("coach", { kind: "weigh", state: s, seat }).then(list => (a.list = list || weighCards(s, seat, { deals: 12, ms: 700, keep: true })));
  return a;
}
/** The coach's look at your decision now, asked for once. */
function adviceNow() {
  const s = V?.state;
  if (!coaching() || !s || !myTurn(s)) return null;
  if (advice?.key !== aheadKey(s, V.seat, "coach")) {
    const a = advice = lookAt(s, V.seat);
    a.ready.then(() => { if (advice === a && a.shown) draw(); });
  }
  return advice;
}
function showHint() {
  const a = adviceNow();
  if (!a) return;
  a.shown = true;
  draw();
}
/** Your move set against the coach's (Check, Always), from the table as it was: its word when it would have made another. */
function noteMove(s, move) {
  if (!checking() || !myTurn(s)) return;
  const snap = JSON.parse(JSON.stringify(s)), seat = V.seat, key = aheadKey(snap, seat, "coach");
  const a = advice?.key === key ? advice : lookAt(snap, seat), note = { hand: snap.handNo, pending: true };
  said = note;
  a.ready.then(list => {
    if (said !== note) return;
    const v = list && (snap.step === "bid" ? bidVerdict(snap, seat, list, move) : verdictOf(snap, seat, list, move.card));
    if (!v) said = null;
    else Object.assign(note, { pending: false, words: v.words, best: v.best, kind: snap.step, state: snap, list, mine: move });
    draw();
  });
}
/** The coach's line: its advice on your turn, its word on your last move, or the table's status. */
function coachLine(s, status) {
  const a = advice?.shown && advice.key === (myTurn(s) ? aheadKey(s, V.seat, "coach") : null) ? advice : null;
  const word = said && !said.pending && said.hand === s.handNo ? said : null;
  let text = esc(status), why = false;
  if (a && !a.list) text = `<span class="tr-wait"></span>The coach is looking…`;
  else if (a) { text = `<b class="tr-coach">Coach</b> ${esc(a.kind === "bid" ? bidAdvice(s, V.seat, a.list) : adviceWords(s, V.seat, a.list))}`; why = true; }
  else if (word && !myTurn(s)) { text = `<b class="tr-coach miss">Coach</b> ${esc(word.words)}`; why = true; }
  return { text, why };
}
function coachBar(s, status, next = awaitingDeal()) {
  const { text, why } = coachLine(s, status), turn = myTurn(s) && s.step === "play";
  // Always marks its card unasked: no Hint to ask with; between hands, solo, the next hand is dealt from here
  const hint = next ? `<button class="btn primary tr-hint" type="button" data-act="next">${nextLabel(s)}</button>`
    : coach() === "on" ? "" : `<button class="btn tr-hint" type="button" data-act="hint"${turn ? "" : " disabled"}>Hint</button>`;
  return `<div class="tr-coachbar"><p class="tr-say">${text}</p><span class="tr-coachgo">${hint}${why ? `<button class="link tr-why-btn" type="button" data-act="why">Why?</button>` : ""}</span></div>`;
}
/** The coach's reasons, in a sheet: each card (or game) it weighed, what it wins and comes to, what it does. */
function showWhy() {
  const s = V?.state;
  if (!s) return;
  const turn = myTurn(s) && advice?.shown && advice.list ? advice : null;
  const src = turn ? { kind: advice.kind, state: s, list: advice.list, mine: null, words: null } : said?.words ? said : null;
  if (!src) return;
  const st = src.state, seat = V.seat;
  let rows, lead;
  if (src.kind === "bid") {
    rows = bidRows(st, seat, src.list);
    lead = src.words || bidAdvice(st, seat, src.list);
  } else {
    rows = cardRows(st, seat, src.list);
    lead = src.words || adviceWords(st, seat, src.list);
  }
  const mine = src.mine, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const items = rows.map((r, i) => {
    const isMine = mine && (src.kind === "bid" ? same(r.bid, mine) : r.card === mine.card);
    const face = src.kind === "bid" ? "" : `<span class="tr-why-card">${card(r.card, st)}</span>`;
    return `<li class="${i === 0 ? "best" : ""}${isMine ? " mine" : ""}">${face}<span class="tr-why-text"><b>${esc(r.name)}</b>${isMine ? " <small>yours</small>" : ""}${r.what ? `<span>${esc(r.what)}</span>` : ""}</span><span class="tr-why-num">${r.win != null ? `<b>${pct(r.win)}</b>` : "<b>–</b>"}<small>${signed(r.score)}</small></span></li>`;
  }).join("");
  const n = src.list[0]?.n;
  const note = src.kind === "bid"
    ? "Wins: how often a game like it, from a hand like yours, is won; on average: what it comes to on your score. Fitted to tens of thousands of games played out with every card seen, then to the computer's own play (tools/trumps-bids.mjs)."
    : `Wins: how often your side won the game when the cards you can't see were dealt ${n ? `${n} ways` : "the ways"} they could lie (each hand's size, the Farben shown out of, the call, every card played so far legal) and as the bidding makes likely, each deal played to the end with every card seen and both sides at their best; on average: what that came to on your score.`;
  $("whyBody").innerHTML = `<p class="tr-why-lead">${esc(lead)}</p><ol class="tr-why-list">${items}</ol><p class="tr-why-note">${esc(note)}</p>`;
  if (!$("whyDlg").open) $("whyDlg").showModal();
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
  if (s.step === "scored" && awaitingDeal() && !coaching()) {
    box.innerHTML = `<button class="btn primary tr-go" type="button" data-act="next">${nextLabel(s)}</button>`;
    return;
  }
  if (s.step !== "bid") {
    const who = s.step === "play" ? (isMe(s.turn) ? "Your card" : `${nameOf(s.turn)}…`) : s.step === "trick" ? `${isMe(s.tricks.at(-1).winner) ? "You take" : `${nameOf(s.tricks.at(-1).winner)} takes`} it` : "";
    box.innerHTML = coaching() ? coachBar(s, who) : `<p class="tr-status">${esc(who)}</p>`;
    box.querySelector(".tr-wait")?.append(sextant());
    return;
  }
  if (s.turn !== seat) {
    const status = `${nameOf(s.turn)} ${s.game === "jass" ? "chooses" : "bids"}…`;
    box.innerHTML = coaching() ? coachBar(s, status) : `<p class="tr-status">${esc(status)}</p>`;
    return;
  }
  // the coach's game, once asked for (or always): its button ringed, its words where the question was
  const a = coaching() && advice?.shown && advice.kind === "bid" && advice.key === aheadKey(s, seat, "coach") ? advice : null, coachBid = a?.list?.[0]?.bid || null;
  const bids = GAMES[s.game].bids(s, seat), btn = (b, text, cls = "") => `<button class="btn tr-bid${cls ? ` ${cls}` : ""}${coachBid && JSON.stringify(b) === JSON.stringify(coachBid) ? " coach" : ""}" type="button" data-bid='${esc(JSON.stringify(b))}'>${text}</button>`;
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
    const ask = s.call ? `Over ${s.call.type === "sau" ? "a Sauspiel" : s.call.type === "wenz" ? "a Wenz" : "a Solo"}?` : "Play, or pass (weiter)?";
    const say = coaching() ? `<p class="tr-say tr-bidsay">${a ? `<b class="tr-coach">Coach</b> ${esc(bidAdvice(s, seat, a.list))} <button class="link tr-why-btn" type="button" data-act="why">Why?</button>` : esc(ask)}</p>` : `<p class="tr-status">${ask}</p>`;
    html = `${say}
      ${sau.length ? `<div class="tr-bids three">${sau.map(b => btn(b, `Sauspiel ${suitMark(s, b.ace).mark}<small>auf die ${esc(PACKS.german.suits[b.ace])}-Sau</small>`)).join("")}</div>` : ""}
      <div class="tr-bids five">${wenz ? btn(wenz, "Wenz") : ""}${solo.map(b => btn(b, `Solo ${suitMark(s, b.suit).mark}`)).join("")}</div>
      <div class="tr-bids ${coaching() && coach() !== "on" ? "hint-row" : "one"}">${coaching() && coach() !== "on" ? `<button class="btn tr-hint" type="button" data-act="hint">Hint</button>` : ""}${btn({ t: "pass" }, "Weiter")}</div>`;
  }
  box.innerHTML = html;
}
const multOf = (s, b) => (b.mode === "obe" ? 3 : b.mode === "unde" ? 4 : s.opts.pack === "french" ? [2, 1, 2, 1][b.suit] : [2, 2, 1, 1][b.suit]);

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  if (b.dataset.act === "new") { newGame(); return; }
  if (b.dataset.act === "next") { nextHand(); return; }
  if (b.dataset.act === "result") { showEnd(V); return; }
  if (b.dataset.act === "hint") { showHint(); return; }
  if (b.dataset.act === "why") { showWhy(); return; }
  if (b.dataset.act === "less" || b.dataset.act === "more") {
    const values = [...new Set(GAMES.coinche.bids(V.state, V.seat).filter(x => x.t === "bid").map(x => x.value))];
    coincheValue = values[Math.max(0, Math.min(values.length - 1, values.indexOf(coincheValue) + (b.dataset.act === "more" ? 1 : -1)))];
    drawControls(V.state);
    return;
  }
  if (b.dataset.bid) {
    const m = JSON.parse(b.dataset.bid);
    noteMove(V.state, m);
    const why = await page.move(m);
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
  advice = said = null;                                          // the coach's words were the last game's
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
    <h3>Scoring</h3><p>Aces 11, tens 10, kings 4, Obers 3, Unters 2: 120. The players win with 61. A Sauspiel is worth the tariff (10), a Solo or Wenz 50, with 10 more for Schneider (the players under 31 when they lose, the others under 30 when the players win: 91 makes it, 90 doesn't), 10 more for schwarz (no trick) and 10 for each Laufende (the top trumps one side holds unbroken, three or more, two in a Wenz). In a Sauspiel each of the losing pair pays one of the winners; a soloist is paid by, or pays, all three.</p>`,
};
function showRules() {
  const g = V?.state?.game || opts.game;
  $("rulesBody").innerHTML = RULES[g];
  $("rulesDlg").showModal();
}
// ---------- the course ----------
// Learn (the header): Schafkopf taught from nothing (trumps-course.js) on the course's sheet (course.js), the German
// cards drawn as the table draws them and every rule the rules' own; its last lesson starts a Schafkopf against Easy.
// The Rules sheet opens from the course's map and the menu.
const course = createCourse({
  id: "trumps", course: COURSE, cls: "tr", inFrame: IN_FRAME, stage: cardStage(),
  onRules: () => { $("rulesBody").innerHTML = RULES.schafkopf; $("rulesDlg").showModal(); },
  onPlay: step => {
    const level = step?.level || "easy", name = LEVEL_NAMES.find(([k]) => k === level)?.[1] || level;
    if (page.atTable) { toast(`Your table plays on: try a Schafkopf against ${name} when you're back to solo`); return; }
    opts.game = "schafkopf";
    opts.level = level;
    saveOpts();
    newGame();
  },
});

// Puzzle rush (the menu): Schafkopf's best card in positions from the computer players' own games, against the clock,
// with every game's rush settings, on a sheet of its own (trumps-rush-ui.js); the game waits under it.
const rush = createRush({ inFrame: IN_FRAME });

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("trumps", COURSE);
  play.append(action(cp.done ? `Learn Schafkopf: ${cp.done} of ${cp.of} lessons done` : "Learn Schafkopf, from the rules", () => course.open()));
  if (!IN_FRAME) play.append(action("Puzzle rush", () => rush.open()));
  play.append(action("The rules on one page", showRules, "link"));
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
  // the coach and the cards change at once
  if (opts.game === "schafkopf") {
    // at a table the host's choice goes on the table for every phone; the others see it
    if (setsRules()) set.append(choice("Coach", COACH, coach(), v => {
      opts.coach = v; saveOpts(); advice = null; said = null;
      if (page.atTable) page.runner.table.act(cur => { cur.house = { ...(cur.house || {}), coach: v }; });
      draw();
    }));
    else set.append(line(`Coach: ${COACH.find(([k]) => k === coach())[1]}, as the host set it for the table.`));
    set.append(choice("Cards", [["drawn", "Simple"], ["pictures", "Bavarian"]], opts.look === "pictures" ? "pictures" : "drawn", v => { opts.look = v; saveOpts(); applyLook(); draw(); }));
  }
  set.append(toggle("Full screen", !!opts.full, on => { fullScreen(on); opts.full = on; saveOpts(); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 });
  const rushBests = bestsLine(rush.bests()), about = part(body, "about");
  about.append(line(r.played ? `Won ${r.won} of ${r.played} games.` : "No games finished yet."), ...(rushBests ? [line(rushBests)] : []));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "trumps");
document.querySelector(".tr-mark").innerHTML = APPS.find(a => a.id === "trumps")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("whyClose").addEventListener("click", () => $("whyDlg").close());
addEventListener("resize", () => fitTable());
document.addEventListener("fullscreenchange", () => fitTable());
window.__trumps = { page, get view() { return V; }, opts, laufende, course, rush };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
