// Tribute: Guan Dan (掼蛋) at a table of four, you and a computer partner across the table against two computer
// players, or you and your partner together against them. The rules are tribute-engine.js's, the players
// tribute-bot.js's (they think in tribute-worker.js, off this thread); this file deals, shows the table and your
// cards in their columns, takes your plays, runs the others at a pace you can follow, keeps the levels over a match,
// and coaches as you choose: a hint when you ask, the computer's play in your seat and why; a check of each move of
// yours, where it would have played otherwise, by how much and why; or its play at every decision.
import * as E from "./tribute-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { GAMES, roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sideways, SIDEWAYS } from "./wide.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "tribute:run", OPTS = "tribute:opts", STATS = "tribute:stats";
// The coach: off; hints, when you ask; check, a hint when you ask and a word on each move of yours it would have made
// otherwise; on (Always), its play at every decision as well.
const COACH = ["off", "hints", "check", "on"];
const APP = 1;
const BOTS = ["Wei", "Lin", "Fang"];                             // right, across (your partner), left
const PACE = { quick: 420, steady: 850, slow: 1500 };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const clone = x => JSON.parse(JSON.stringify(x));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- state ----------
// G: the hand in play (the engine's state, the match's levels in it). S: the table: { names, humans }.
let G = null, S = null;
let opts = { mode: "deals", deals: 6, pace: "steady", counter: false, bots: "hard", coach: "hints", full: false, side: null, ...read(OPTS, {}) };
if (!COACH.includes(opts.coach)) opts.coach = "hints";
let me = 0;
const selected = new Set();
let hint = null;                                                 // { key, list, at, auto, ready }: the coach's plays now
let C = [];                                                      // the coach's checks of your moves this hand (check, always)
const isHuman = seat => !!S?.humans?.includes(seat);
const nameOf = seat => (seat === me && !together.room ? "You" : S?.names?.[seat] || "?");
/** A seat as a sentence's subject: you as "You" at a table together too, where your seat is labelled with your name. */
const who = seat => (seat === me ? "You" : nameOf(seat));
const keyNow = () => (G ? `${G.handNo}:${G.log.length}` : "");
/** A phone held sideways (tribute.css's last query): the table takes the screen, your cards lie along its edge. */
const low = () => matchMedia(`${SIDEWAYS} and (max-height: 500px)`).matches;
/** Held sideways, your cards in a row along the table's edge or stacked in columns as upright (Menu): on a phone (its
 *  short side a phone's, whichever way it's held, so the menu says the same either way) in a row, on a tablet stacked,
 *  unless you choose. */
const sideOf = () => opts.side || (Math.min(innerWidth, innerHeight) <= 500 ? "row" : "stack");
const FACE = r => (r === 15 ? "lvl" : ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][r] || "");

// ---------- the computer players and the coach, each in a worker ----------
// Two workers, so the coach's thinking (a check takes up to three seconds) never holds up a player's move.
const workers = { players: null, coach: null };
let asked = 0, local = null;
const answers = new Map();                                       // id → [the worker's role, its answer's callback]
function workerFor(role) {
  if (workers[role] === null) {
    try {
      const w = new Worker(new URL("./tribute-worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => { const [, done] = answers.get(e.data.id) || []; answers.delete(e.data.id); done?.(e.data); };
      w.onerror = () => {
        workers[role] = false;
        for (const [id, [r, done]] of answers) if (r === role) { answers.delete(id); done({ decision: null }); }
      };
      workers[role] = w;
    } catch { workers[role] = false; }
  }
  return workers[role];
}
/** How strong the computer players are: the room's setting at a table together, so both devices play the same. */
const skill = () => ((together.room ? S?.bots : opts.bots) === "medium" ? "medium" : "hard");
/** The computer's choice in a seat now: { action, why }; `kind`: "decide", or "hints": the plays weighed, hard's choice
 *  first, each with what speaks for and against it (tribute-bot.js's weigh). */
async function think(state, seat, kind = "decide", extra = {}) {
  state.names = [0, 1, 2, 3].map(s => (s === seat ? "you" : nameOf(s)));   // for the reasons it gives
  const role = kind === "decide" ? "players" : "coach", worker = workerFor(role);
  let reply = null;
  if (worker) reply = await new Promise(res => { const id = ++asked; answers.set(id, [role, res]); worker.postMessage({ id, state, seat, kind, skill: skill(), ...extra }); });
  if (reply?.decision) return reply.decision;
  local ||= await import("./tribute-bot.js");
  if (kind === "hints") return local.hints(state, seat, { search: 12, against: skill() });
  if (kind === "check") return local.checkMove(state, seat, extra.action, { search: 12, worlds: 40, outBudget: 1500, against: skill() });
  if (kind === "weigh") return local.weigh(state, seat);
  if (kind === "playout") return local.playOut(state, seat, extra.actions, { worlds: 40 });
  return local.decide(state, seat, { skill: skill(), search: skill() === "hard" ? 12 : 0 });
}

// ---------- the match ----------
function newMatch() {
  me = 0;
  S = { v: 1, names: ["You", BOTS[0], BOTS[1], BOTS[2]], humans: [0], started: Date.now() };
  G = E.newGame({ mode: opts.mode, deals: opts.deals }, (Math.random() * 2 ** 32) >>> 0);
  closeDialogs();
  afterChange();
}
function nextHand() {
  if (!G || G.phase !== "over") return;
  if (together.room) { nextTogether(); return; }
  $("resultDlg").close();
  if (G.result.over) { newMatch(); return; }
  G = E.nextHand(G, (Math.random() * 2 ** 32) >>> 0);
  afterChange();
}
function save() {
  if (IN_FRAME) return;
  if (rush) write(RUSH, rush);
  else if (!together.room) write(RUN, { G, S, C });
}

// ---------- the turn ----------
let timer = null, busyWith = null, gen = 0;
const paused = () => !together.room && isPaused();
function kick(ms = 0) { clearTimeout(timer); timer = setTimeout(step, ms); }
function afterChange() {
  gen++;
  keepPicked();
  hint = null;
  save();
  render();
  kick(0);
}
/** The cards you've picked, kept as the others play, so you can pick yours while they think (each of their moves used
 *  to drop them): those still in your hand, none carried into another hand. Your own move takes them (mine). */
let pickedIn = "";
function keepPicked() {
  if (pickedIn !== handId()) { selected.clear(); pickedIn = handId(); return; }
  const hand = new Set(G?.hands[me] || []);
  for (const id of selected) if (!hand.has(id)) selected.delete(id);
}
/**
 * At a table together, the device that sat down first moves the computer players while its player is here; the
 * other steps in only when a move hasn't come for a few seconds (that page asleep, or gone). Both used to work out
 * every move and race to save it: twice the work on each phone, and the loser's try thrown away.
 */
const BACKUP_MS = 4000;
const backup = () => !!together.room && mySlot() !== 0 && !!together.partner()?.online && !together.partner()?.game;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function step() {
  timer = null;
  if (rush) { render(); return; }                               // a puzzle: nobody else moves
  if (!G || IN_FRAME) return;
  if (G.phase === "over") { handOver(); return; }
  const waiting = E.waitingOn(G);
  advise();
  const bot = waiting.find(s => !isHuman(s));
  if (bot === undefined || busyWith !== null || paused()) { render(); return; }
  const g0 = gen, snap = clone(G), slow = PACE[opts.pace] || PACE.steady;
  busyWith = bot;
  render();
  sleep(backup() ? BACKUP_MS : 0)
    .then(() => (g0 !== gen ? [null] : Promise.all([think(snap, bot), sleep(slow)])))
    .then(([d]) => {
      busyWith = null;
      if (g0 !== gen || !G || paused()) { render(); kick(0); return; }
      if (!d?.action) { console.error("no decision", d); render(); return; }
      apply(bot, d.action);
    }).catch(e => { busyWith = null; console.error(e); toast("A computer player stumbled"); render(); });
}
function apply(seat, act) {
  if (rush) { if (seat === me) rushAnswer(act); return; }
  if (together.room) { applyTogether(seat, act); return; }
  try { E.act(G, seat, act); }
  catch (e) { console.error(e); toast("That play isn't allowed now"); render(); return; }
  afterChange();
}

// ---------- your move ----------
function playSelected() {
  if (!G || E.asked(G, me) !== "play") return;
  const cards = [...selected];
  if (!cards.length) { toast("Pick the cards to play"); return; }
  const top = G.top?.reading || null, reading = E.readingFor(cards, G.level, top);
  if (!reading) {
    const any = E.classify(cards, G.level)[0];
    toast(!any ? "Those cards don't make a play" : top ? `${cap(E.playName(any))} doesn't beat ${E.playName(top)}` : "That isn't a play");
    return;
  }
  mine({ t: "play", cards, as: reading });
}
function pass() { if (G && E.asked(G, me) === "play" && G.top) mine({ t: "pass" }); }
function returnSelected() {
  if (!G || E.asked(G, me) !== "return") return;
  const ok = E.returnable(G.hands[me], G.level);
  const pick = [...selected].filter(id => ok.includes(id));
  if (pick.length !== 1) { toast("Pick one card of 10 or lower to give back"); return; }
  mine({ t: "return", card: pick[0] });
}
/** Your move: checked by the coach (check, always) against the table as it was, then made. */
function mine(act) {
  if (!rush && (opts.coach === "check" || opts.coach === "on")) check(act);
  selected.clear();
  apply(me, act);
}
// ---------- the coach ----------
/** The coach's plays for your decision now (hard's choice first), worked out once for the hint and the advice. */
function plays(auto) {
  const key = keyNow();
  if (hint?.key !== key) {
    const h = { key, list: null, at: 0, auto };
    h.ready = think(clone(G), me, "hints").then(list => { h.list = Array.isArray(list) ? list : list ? [list] : []; if (hint === h) render(); });
    hint = h;
  }
  return hint;
}
/** Hint: the coach's play, its cards picked for you; tapped again, the others it weighed. */
async function showHint() {
  if (!G || !E.asked(G, me) || opts.coach === "off") return;
  const fresh = hint?.key !== keyNow(), h = plays(false);
  if (h.auto) h.auto = false;                                    // its advice, now taken as a hint: the same play, picked
  else if (!fresh && h.list) h.at = (h.at + 1) % Math.max(1, h.list.length);
  render();
  await h.ready;
  const p = hint === h ? h.list?.[h.at] : null;
  if (!p) return;
  selected.clear();
  if (p.action.t === "play") for (const id of p.action.cards) selected.add(id);
  if (p.action.t === "return") selected.add(p.action.card);
  render();
}
/** Always: the coach's play at each of your decisions, its cards marked, nothing picked. */
function advise() { if (opts.coach === "on" && !rush && G && E.asked(G, me)) plays(true); }
/**
 * Check and Always: your move set against the coach's, from the table as it was (tribute-bot.js's checkMove): kept for
 * the coach's word on it and the hand's review, in the run, so it's there after a reload; the plays weighed, for Why?,
 * only in memory.
 */
const checked = new WeakMap();
const handId = () => `${S?.started}:${G?.handNo}`;
function check(act) {
  const hand = handId(), note = { hand, mine: act, done: false, differs: false, words: "", gap: null, more: 0 };
  if (C[0]?.hand !== hand) C = [];
  C.push(note);
  think(clone(G), me, "check", { action: act }).then(c => {
    note.done = true;
    if (c) {
      note.differs = !!c.differs;
      if (c.differs) Object.assign(note, { words: c.words, gap: c.sure ? c.gap : null, more: c.more });
      checked.set(note, c);
    }
    if (C.includes(note)) { save(); render(); }
  });
}
/** The coach's word on your last move it would have made otherwise, until a move of yours it agrees with. */
function verdict() {
  if ((opts.coach !== "check" && opts.coach !== "on") || rush) return null;
  for (let i = C.length - 1; i >= 0; i--) {
    if (C[i].hand !== handId()) return null;
    if (C[i].differs) return C[i];
    if (C[i].done) return null;
  }
  return null;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const mid = s => s.charAt(0).toLowerCase() + s.slice(1);  // "Beat it with a pair of As" mid-sentence, its ranks kept
/** The plays the hint weighed (or a puzzle's), side by side: each one's numbers, what speaks for it and against it;
 *  Pick takes its cards (not in a puzzle, once answered). */
function showWhy(list = hint?.key === keyNow() ? hint.list : null) {
  if (!list?.length) return;
  const mineIn = list.some(o => o.yours), picks = !rush && !mineIn;    // a puzzle's or a check's: your move's made
  const pctOf = x => `${Math.round(x * 100)}%`;
  const looked = list.some(o => o.levels != null);
  let html = `${list[0].why ? `<p class="tb-why-lead">${esc(list[0].why)}</p>` : ""}${list[0].out ? `<p class="tb-why-out">${esc(list[0].out)}</p>` : ""}<ol class="tb-opts">`;
  list.forEach((o, i) => {
    const stats = [];
    if (o.plays != null) stats.push(o.plays ? `${o.plays} play${o.plays === 1 ? "" : "s"} to go out after it` : "out");
    if (o.holds != null && o.plays) stats.push(`holds ${pctOf(o.holds)}`);
    if (o.levels != null) stats.push(`${o.levels >= 0 ? "+" : "−"}${Math.abs(o.levels).toFixed(1)} levels`);
    const pc = [...o.pros.map(x => `<li class="pro">${esc(cap(x))}</li>`), ...o.cons.map(x => `<li class="con">${esc(cap(x))}</li>`)].join("");
    const tag = o.yours ? '<span class="tb-yours">yours</span>' : "";
    html += `<li class="tb-opt${i === 0 ? " best" : ""}${o.yours && i ? " missed" : ""}"><div class="tb-opt-head"><b>${esc(o.title)}</b>${tag}<span class="tb-stat">${stats.join(" · ")}</span>${o.action.t === "pass" || !picks ? "" : `<button type="button" class="link" data-pick="${i}">Pick</button>`}</div>${pc ? `<ul class="tb-pc">${pc}</ul>` : ""}</li>`;
  });
  html += `</ol><p class="tb-why-note">${rush ? "The best play first." : mineIn ? "The coach's choice first, then yours." : "The computer's choice is first."} Plays to go out: what your hand needs after it, split as the computer would. Holds: the chance no opponent beats it except with a bomb, from every card played, what the tribute showed (a card paid or given back is with the player who got it; a payer holds nothing above the card he paid) and how often the computer's players beat a play like it.${looked ? ` Levels: the rest of the hand played out in ${rush ? `${rushPuzzle()?.n || "hundreds of"} deals` : "deals"} of the cards you can't see, fitted to what's been played, and what that did to your side's levels on average.` : ""}</p>`;
  $("whyBody").innerHTML = html;
  $("whyDlg").showModal();
  $("whyDlg").scrollTop = 0;
}
$("whyBody").addEventListener("click", e => {
  const b = e.target.closest("[data-pick]");
  if (!b || !hint?.list) return;
  hint.at = Number(b.dataset.pick);
  const h = hint.list[hint.at];
  selected.clear();
  if (h.action.t === "play") for (const id of h.action.cards) selected.add(id);
  if (h.action.t === "return") selected.add(h.action.card);
  $("whyDlg").close();
  render();
});

// ---------- the table ----------
const pos = seat => ["me", "right", "top", "left"][(seat - me + 4) % 4];
/** A card as an element's inner markup: its rank and suit in the corner (the jokers lettered down the side). */
function face(id, level) {
  if (E.isJoker(id)) return `<span class="r">J<br>O<br>K<br>E<br>R</span>`;
  const r = E.rankOf(id), s = E.suitOf(id);
  return `<span class="r">${FACE(r)}</span><span class="s">${E.SUITS[s]}</span>${E.isWild(id, level) ? '<span class="w" aria-hidden="true">★</span>' : ""}`;
}
const cardClass = (id, level) => {
  const c = ["tb-card"];
  if (E.isJoker(id)) c.push("joker", E.rankOf(id) === E.BJ ? "big" : "small");
  else { if (E.suitOf(id) % 2 === 1) c.push("red"); if (E.rankOf(id) === level) c.push(E.isWild(id, level) ? "wild" : "level"); }
  return c.join(" ");
};
const mini = (ids, level, cls = "") => `<span class="tb-cards ${cls}">${ids.map(id => `<span class="${cardClass(id, level)}" aria-label="${E.cardName(id)}">${face(id, level)}</span>`).join("")}</span>`;
/** What each seat has done in the trick under way: its play, or a pass. */
function trickActs() {
  const acts = {};
  for (let i = G.log.length - 1; i >= 0; i--) {
    const e = G.log[i];
    if (e.e === "trick" || e.e === "lead" || e.e === "return" || e.e === "tribute" || e.e === "resist" || e.e === "no-tribute") break;
    if ((e.e === "play" || e.e === "pass") && !(e.seat in acts)) acts[e.seat] = e;
  }
  return acts;
}
function drawSeats() {
  const acts = trickActs(), lvl = G.level;
  for (let seat = 0; seat < 4; seat++) {
    const box = $(`seat${(seat - me + 4) % 4}`);
    const n = G.hands[seat].length, place = G.out.indexOf(seat);
    const turn = (G.phase === "play" && G.turn === seat) || busyWith === seat || (G.phase === "return" && E.waitingOn(G).includes(seat));
    const a = acts[seat];
    const isTop = G.top && G.top.seat === seat && a?.e === "play";
    const mate = E.teamOf(seat) === E.teamOf(me);
    let html = `<div class="tb-who${turn ? " on" : ""}${mate ? " mate" : ""}"><b>${esc(nameOf(seat))}</b>`;
    if (seat !== me) html += place >= 0 ? `<span class="tb-place">${["1st", "2nd", "3rd"][place]}</span>` : `<span class="tb-n" aria-label="${n} cards">${n}</span>`;
    else if (place >= 0) html += `<span class="tb-place">${["1st", "2nd", "3rd"][place]}</span>`;
    if (turn && seat !== me) html += '<span class="tb-dots" aria-hidden="true">…</span>';
    html += "</div>";
    if (a?.e === "play") html += `<div class="tb-play${isTop ? " best" : ""}">${mini(a.cards, lvl)}</div>`;
    else if (a?.e === "pass") html += '<div class="tb-play pass">Pass</div>';
    else html += '<div class="tb-play none"></div>';
    box.innerHTML = html;
  }
}
function drawStrip() {
  const us = E.teamOf(me), lv = G.levels, r = G.level;
  const decl = G.declarer < 0 ? "" : G.declarer === us ? " (yours)" : " (theirs)";
  if (rush) { $("strip").innerHTML = `<span class="tb-lvl">Level <b>${FACE(r)}</b>${decl} · <span class="tb-wild">♥${FACE(r)}</span> wild</span>${rushStatus()}`; return; }
  const left = G.opts.mode === "deals" ? `hand ${G.handNo + 1} of ${G.opts.deals}` : "to the ace";
  $("strip").innerHTML = `<span class="tb-lvl">Level <b>${FACE(r === 15 ? 15 : r)}</b>${decl} · <span class="tb-wild">♥${FACE(r)}</span> wild</span><span class="tb-score">Us <b>${FACE(lv[us])}</b> · them <b>${FACE(lv[1 - us])}</b> · ${left}</span>`;
}
/** The news at a hand's start: who led, who paid tribute and what came back. */
function drawNews() {
  const box = $("news");
  const lines = [];
  for (const e of G.log) {
    if (e.e === "lead") lines.push(`${who(e.seat)} ${e.seat === me ? "hold" : "holds"} the turned-up ${E.cardName(e.card)}, and ${e.seat === me ? "lead" : "leads"}.`);
    else if (e.e === "resist") lines.push(`${e.seats.map(who).join(" and ")} ${e.seats.length > 1 || e.seats[0] === me ? "hold" : "holds"} both big jokers: no tribute.`);
    else if (e.e === "tribute") lines.push(`${who(e.from)} ${e.from === me ? "pay" : "pays"} ${e.to === me ? "you" : nameOf(e.to)} ${E.isJoker(e.card) ? "the " : ""}${E.cardName(e.card)}.`);
    else if (e.e === "return") lines.push(`${who(e.from)} ${e.from === me ? "give" : "gives"} back ${E.cardName(e.card)}.`);
  }
  const playing = G.log.some(e => e.e === "play" || e.e === "pass");
  box.hidden = !lines.length || playing;
  box.innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join("");
}

// ---------- your cards: in columns by rank, the strongest on the left ----------
function columns(hand, level) {
  const cols = new Map();
  for (const id of hand) {
    const v = E.isWild(id, level) ? 15.5 : E.valueOf(id, level);
    if (!cols.has(v)) cols.set(v, []);
    cols.get(v).push(id);
  }
  return [...cols.entries()].sort((a, b) => b[0] - a[0]).map(([v, ids]) => ids.sort((a, b) => E.suitOf(a) - E.suitOf(b)));
}
/** Upright, or a tablet's height: a column to a rank, its cards each showing at least their corner. A tablet held
 *  sideways draws them larger, with the width to spare; a phone held sideways (stacked, by choice) at a phone's size. */
function stacked(cols, rem, room) {
  const big = sideways() && !low(), W = (big ? 3.2 : 2.6) * rem, H = (big ? 4.4 : 3.6) * rem;
  const pitch = cols.length > 1 ? Math.min(W + 0.2 * rem, (room - W) / (cols.length - 1)) : W;
  const deepest = Math.max(1, ...cols.map(c => c.length));
  // each card behind another shows its whole corner, the rank and the suit under it: with the rank alone, a straight
  // flush (five ranks in a row in one suit) couldn't be seen in the hand. A deep column (five or more of a rank) has
  // its corners drawn smaller (tight), so it doesn't take the table's room.
  const index = 2.1 * rem, small = 1.8 * rem, most = H + 7.2 * rem;
  const tight = deepest > 1 && (most - H) / (deepest - 1) < index;
  const drop = deepest > 1 ? (tight ? small : index) : 0;
  const x0 = Math.max(0, (room - (cols.length ? (cols.length - 1) * pitch + W : 0)) / 2);
  const at = [];
  cols.forEach((col, c) => col.forEach((id, i) => at.push({ id, x: x0 + c * pitch, y: i * drop, z: i + 1 })));
  return { W, H, at, tight, height: H + (deepest - 1) * drop + 0.3 * rem };
}
/** Held sideways, in a row (a phone's way, by choice a tablet's): the hand fanned along the table's edge, each card
 *  showing its corner, a little more room between ranks than within one, as a hand is held. On a phone, larger in full
 *  screen, where the row has the whole width; on a tablet as large as its stacked cards. */
function fanned(cols, rem, room) {
  const big = !low() ? 1.4 : opts.full ? 1.1 : 1, W = 2.25 * big * rem, H = 3.2 * big * rem;
  const n = cols.reduce((s, c) => s + c.length, 0), breaks = Math.max(0, cols.length - 1);
  const least = 1.05 * rem;                                     // a corner, still readable and still a target
  let gap = 0.22 * rem, pitch = n > 1 ? (room - W - breaks * gap) / (n - 1) : 0;
  if (pitch < least && n > 1) { gap = breaks ? Math.max(0, (room - W - (n - 1) * least) / breaks) : 0; pitch = Math.max((room - W - breaks * gap) / (n - 1), 0.6 * rem); }
  pitch = Math.min(pitch, W * 0.66);
  const x0 = Math.max(0, (room - W - (n - 1) * pitch - breaks * gap) / 2), at = [];
  let k = 0;
  cols.forEach((col, c) => col.forEach(id => { at.push({ id, x: x0 + k * pitch + c * gap, y: 0, z: k + 1 }); k++; }));
  return { W, H, at, height: H };
}
let handH = 0;                                                   // your cards' height as last laid out, for the plays'
function drawHand() {
  const box = $("hand");
  const hand = G.hands[me], level = G.level, cols = columns(hand, level);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const fan = sideways() && sideOf() === "row";
  const lay = fan ? fanned(cols, rem, box.clientWidth || 480) : stacked(cols, rem, box.clientWidth || 360);
  handH = lay.H;
  box.classList.toggle("fan", fan);
  $("app").classList.toggle("fanned", fan);                      // full screen on a phone: a row goes under the console too
  // on the page, so the table can leave room for the cards at its foot when they lie on it (a phone on its side)
  $("app").style.setProperty("--tb-cw", `${lay.W}px`); $("app").style.setProperty("--tb-ch", `${lay.H}px`); $("app").style.setProperty("--tb-hh", `${lay.height}px`);
  const ask = E.asked(G, me), ok = ask === "return" ? new Set(E.returnable(hand, level)) : null;
  // the coach's play, marked while it's advice (Always), until a Hint picks it
  const adv = hint?.auto && hint.key === keyNow() ? hint.list?.[0]?.action : null;
  const advised = new Set(adv?.t === "play" ? adv.cards : adv?.t === "return" ? [adv.card] : []);
  let html = "";
  for (const { id, x, y, z } of lay.at) {
    const cls = [cardClass(id, level)];
    if (selected.has(id)) cls.push("sel");
    if (advised.has(id)) cls.push("advised");
    if (ok && !ok.has(id)) cls.push("dim");
    html += `<button type="button" class="${cls.join(" ")}" data-id="${id}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;z-index:${z}" aria-label="${E.cardName(id)}${selected.has(id) ? ", picked" : ""}">${face(id, level)}</button>`;
  }
  box.innerHTML = html;
  box.classList.toggle("tight", !!lay.tight);
  box.style.height = `${lay.height.toFixed(0)}px`;
}
// Tap a card to pick it or put it back; drag across your cards, along the row or down a column, to pick (or put back,
// as the first card went) every one you pass. A return takes one card: the last you touch.
let drag = null;                                                 // { pick: picking or putting back, done: ids this drag }
function touch(b) {
  const id = Number(b.dataset.id);
  if (drag.done.has(id)) return;
  drag.done.add(id);
  if (E.asked(G, me) === "return") { selected.clear(); selected.add(id); }
  else if (drag.pick) selected.add(id);
  else selected.delete(id);
  render();
}
const startDrag = b => { drag = { pick: !selected.has(Number(b.dataset.id)), done: new Set() }; touch(b); };
$("hand").addEventListener("pointerdown", e => {
  const b = e.target.closest(".tb-card");
  if (!b || !G || e.button > 0) return;
  $("hand").setPointerCapture(e.pointerId);                     // the drag stays the hand's as its cards are redrawn
  startDrag(b);
});
$("hand").addEventListener("pointermove", e => {
  const b = drag && document.elementFromPoint(e.clientX, e.clientY)?.closest("#hand .tb-card");
  if (b) touch(b);
});
for (const end of ["pointerup", "pointercancel"]) $("hand").addEventListener(end, () => { drag = null; });
// a card picked from the keyboard (Enter, Space): a pointer's tap is the pointerdown above, so its click is passed over
$("hand").addEventListener("click", e => {
  const b = !e.detail && e.target.closest(".tb-card");
  if (!b || !G) return;
  startDrag(b);
  drag = null;
});

// ---------- the buttons ----------
function drawActions() {
  const box = $("actions"), say = $("say");
  box.replaceChildren();
  say.classList.remove("kept");
  if (rush) { drawRush(box, say); return; }
  // a coach that speaks unasked keeps its room under your cards, so the table doesn't change size as it speaks
  say.classList.toggle("kept", (opts.coach === "check" || opts.coach === "on") && G.phase !== "over");
  const now = hint?.key === keyNow() ? hint : null, h = now?.list?.[now.at], last = verdict();
  say.hidden = !(now || last || say.classList.contains("kept"));
  if (now) {
    const n = now.list?.length || 0, label = now.auto ? "Coach" : `Hint${n > 1 ? ` ${now.at + 1}/${n}` : ""}`;
    say.innerHTML = !h ? `<b>${label}</b> <span class="tb-thinking">thinking…</span>`
      : `<b>${label}</b> ${esc(h.why)}${h.pros ? ' <button type="button" class="link tb-why-btn">Why?</button>' : ""}`;
    say.querySelector(".tb-why-btn")?.addEventListener("click", () => showWhy());   // not the click itself as the list
  } else if (last) {
    const c = checked.get(last);
    say.innerHTML = `<b class="tb-miss">Coach</b> ${esc(last.words)}${c ? ' <button type="button" class="link tb-why-btn">Why?</button>' : ""}`;
    // the sheet leads with the verdict: its numbers are the check's deals, not the ones the coach decided in
    say.querySelector(".tb-why-btn")?.addEventListener("click", () => showWhy([{ ...c.list[0], why: last.words }, ...c.list.slice(1)]));
  } else say.replaceChildren();
  if (G.phase === "over") { box.append(goBtn(G.result.over ? "The final score" : "Next hand", () => showResult(), "primary")); return; }
  const ask = E.asked(G, me);
  if (!ask) {
    const who = busyWith ?? E.waitingOn(G)[0];
    const p = document.createElement("p");
    p.className = "tb-wait";
    p.textContent = paused() ? "Paused" : who !== undefined && who >= 0 ? `${nameOf(who)} to ${G.phase === "return" ? "give a card back" : "play"}…` : "";
    box.append(p);
    return;
  }
  if (opts.coach !== "off") box.append(goBtn("Hint", showHint, "quiet"));
  if (ask === "return") {
    const to = G.tribute.returns.find(r => r.from === me && r.card === null)?.to;
    const p = document.createElement("p");
    p.className = "tb-wait";
    p.textContent = `Give ${nameOf(to)} a card back: 10 or lower.`;
    box.prepend(p);
    box.append(goBtn("Give back", returnSelected, "primary"));
    return;
  }
  moveButtons(box);
}
/** Pass (when there's a play to answer), Clear, and the play your picked cards make. */
function moveButtons(box) {
  if (G.top) box.append(goBtn("Pass", pass, ""));
  if (selected.size) {
    const clear = goBtn("", () => { selected.clear(); render(); }, "quiet tb-clear");
    clear.innerHTML = '<span class="long">Clear</span><span class="short" aria-hidden="true">×</span>';
    clear.setAttribute("aria-label", "Clear");
    box.append(clear);
  }
  const top = G.top?.reading || null, reading = selected.size ? E.readingFor([...selected], G.level, top) : null;
  const play = goBtn(reading ? `Play ${E.playName(reading).replace(/^an? /, "")}` : G.top ? "Beat it" : "Lead", playSelected, "primary");
  play.disabled = !reading;
  box.append(play);
  if (play.scrollWidth > play.clientWidth + 1) play.classList.add("two");   // its name in two lines, in the row's height
}
function goBtn(text, fn, kind = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `tb-go${kind ? ` ${kind}` : ""}`;
  b.textContent = text;
  b.addEventListener("click", fn);
  return b;
}

// ---------- the card counter: what's still out there, from what you've seen ----------
function drawCounter() {
  const box = $("counter");
  box.hidden = !(opts.counter || rush) || !G;
  if (box.hidden) return;
  const seen = new Set(G.hands[me]);
  for (const p of G.played) for (const id of p) seen.add(id);
  const left = {};
  for (let id = 0; id < 108; id++) if (!seen.has(id)) { const v = E.isWild(id, G.level) ? "★" : FACE(E.valueOf(id, G.level)) || (E.rankOf(id) === E.BJ ? "BJ" : "SJ"); left[v] = (left[v] || 0) + 1; }
  const order = ["BJ", "SJ", "★", "lvl", "A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
  box.innerHTML = order.filter(v => v !== FACE(G.level)).map(v => `<span class="${left[v] ? "" : "gone"}"><b>${v === "lvl" ? FACE(G.level) : v}</b>${left[v] || 0}</span>`).join("");
}

// ---------- the end of a hand ----------
let shownFor = null;
function handOver() {
  render();
  const id = `${S?.started}:${G.handNo}`;
  if (shownFor === id) return;
  shownFor = id;
  record();
  setTimeout(() => { if (G?.phase === "over" && !$("resultDlg").open) showResult(); }, 700);
}
function record() {
  if (together.room || IN_FRAME || !G?.result) return;
  const r = G.result, us = E.teamOf(me);
  const st = read(STATS, { hands: 0, firsts: 0, oneTwo: 0, matches: 0, wins: 0 });
  st.hands++;
  if (r.team === us) { st.firsts++; if (r.gain === 3) st.oneTwo++; }
  if (r.over) { st.matches++; if (r.winner === us) st.wins++; noteStreak("tribute", r.winner === us); }
  write(STATS, st);
  save();
}
function showResult() {
  if (!G?.result) return;
  const r = G.result, us = E.teamOf(me), ours = r.team === us;
  const order = r.order.map((s, i) => `<li${E.teamOf(s) === us ? ' class="us"' : ""}><span>${["1st", "2nd", "3rd", "4th"][i]}</span> ${esc(nameOf(s))}</li>`).join("");
  const how = r.gain === 3 ? "first and second" : r.gain === 2 ? "first and third" : "first and last";
  $("resultHead").textContent = ours ? `Your side goes out ${how}` : `They go out ${how}`;
  let html = `<ol class="tb-order">${r.gain === 3 ? r.order.slice(0, 2).map((s, i) => `<li${E.teamOf(s) === us ? ' class="us"' : ""}><span>${["1st", "2nd"][i]}</span> ${esc(nameOf(s))}</li>`).join("") : order}</ol>`;
  html += `<p class="tb-gain">${ours ? "You rise" : "They rise"} ${r.gain} level${r.gain > 1 ? "s" : ""}, to ${FACE(r.levels[r.team])}.${r.passedA ? " That passes the ace." : ""}</p>`;
  html += `<p class="tb-levels">Us <b>${FACE(r.levels[us])}</b> · them <b>${FACE(r.levels[1 - us])}</b></p>`;
  if (r.over) html += `<p class="tb-final">${r.winner === us ? "You win the match." : "They win the match."}</p>`;
  else html += `<p class="tb-next">The next hand is played at ${ours ? "your" : "their"} level, ${FACE(r.levels[r.team])}${r.gain === 3 ? "; both of the other side pay tribute" : "; the last out pays tribute"}.</p>`;
  html += review();
  $("resultBody").innerHTML = html;
  $("nextBtn").textContent = r.over ? "New match" : "Next hand";
  const dlg = $("resultDlg");
  dlg.showModal();
  dlg.scrollTop = 0;
  $("nextBtn").focus({ preventScroll: true });
}

/** The coach's review of your hand (check, always): how often it would have played as you did, and the moves where it
 *  wouldn't that cost most, in its words. */
function review() {
  const notes = C.filter(n => n.hand === handId() && n.done);
  if (!notes.length || (opts.coach !== "check" && opts.coach !== "on")) return "";
  const differs = notes.filter(n => n.differs), worst = differs.slice().sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0) || b.more - a.more).slice(0, 3);
  let html = `<h3 class="tb-sub">Your play</h3><p class="tb-review-lead">You and the coach agreed on ${notes.length - differs.length} of ${notes.length} move${notes.length === 1 ? "" : "s"}${differs.length > worst.length ? `; the ${worst.length} that cost most:` : "."}</p>`;
  if (worst.length) html += `<ul class="tb-review">${worst.map(n => `<li>${esc(n.words)}</li>`).join("")}</ul>`;
  return html;
}

// ---------- full screen ----------
/**
 * Full screen (Menu): the header's buttons go onto the table, at its top right, and the levels at its top left, in a
 * band along its top; on a phone held sideways the console lies on the cloth too, above your cards, which take the
 * whole width. Where the browser can, the page goes full screen as well (an app on the home screen already is).
 */
function placeFull() {
  const app = $("app"), table = $("table"), top = document.querySelector("header.top"), strip = $("strip"), on = !!opts.full;
  app.classList.toggle("full", on);
  if (on) {
    if (top.parentElement !== table) table.append(top);
    if (low() ? strip.parentElement !== app : strip.parentElement !== table) (low() ? table.before(strip) : table.append(strip));
  } else if (top.parentElement !== app) { app.prepend(top); top.after(strip); }
}
function fullScreen(on) {
  try {
    if (on && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch { /* a browser without it: the layout alone */ }
}

function render() {
  placeFull();
  if (!G) return;
  drawStrip();
  drawSeats();
  drawNews();
  drawCounter();
  drawHand();
  drawActions();
  drawPartner();
  fitPlays();
}

// ---------- the plays on the table: as large as your cards, larger where the table has the room ----------
/**
 * The size the plays' cards are drawn at (--tb-pf, the font their cards are measured in): three rows of plays in the
 * table's height, its names and gaps taken out; a play of six cards, each showing its corner, in half its width (the
 * two at the sides share a row); and at most a quarter larger than your own cards. A short table (a small phone, the
 * counter on, the coach's room kept) puts your partner's name and yours beside your plays (flat), not over and under
 * them, where that keeps the plays nearer their size. Worked out when a hand first shows and kept, so the plays don't
 * grow as your hand shrinks and the table with it; made smaller only if the table must (a hint's words taking its
 * room). A row too long even so (a bomb of eight) draws its cards closer.
 */
const PLAY = { w: 2.74, h: 3.79, step: 1.5 };                    // a play's card and the corner it shows, in its em
let fit = { key: "", pf: 0, flat: false };
function fitPlays() {
  const t = $("table"), cs = getComputedStyle(t), px = v => parseFloat(v) || 0;
  const w = t.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight), h = t.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom);
  if (w <= 0 || h <= 0) return;                                  // not laid out (a frame's first moment): nothing to fit
  const rem = px(getComputedStyle(document.documentElement).fontSize) || 16;
  const name = (t.querySelector(".tb-who")?.offsetHeight || 1.4 * rem) + px(getComputedStyle($("seat0")).rowGap);
  const half = w / 2 - .2 * rem;                                 // .tb-left and .tb-right: up to half, less a gap
  const most = Math.min(half / (PLAY.w + 5 * PLAY.step), (handH || 3.6 * rem) * 1.25 / PLAY.h), rows = h - 2 * px(cs.rowGap);
  const tall = Math.min(most, (rows - 3 * name) / 3 / PLAY.h), flat = Math.min(most, (rows - name) / 3 / PLAY.h);
  const key = `${rush ? `rush:${here()}` : `${S?.started}:${G.handNo}`}@${innerWidth}x${innerHeight}`;
  if (key !== fit.key) fit = { key, flat: tall < .9 * most, pf: 0 };
  fit.pf = Math.max(6, fit.pf ? Math.min(fit.pf, fit.flat ? flat : tall) : fit.flat ? flat : tall);
  t.classList.toggle("flat", fit.flat);
  t.style.setProperty("--tb-pf", `${fit.pf.toFixed(2)}px`);
  // flat, the plays across and yours keep clear of the names at their left: as far again on the right, so they centre
  const named = fit.flat ? 2 * (Math.max(...["seat2", "seat0"].map(id => $(id).querySelector(".tb-who")?.offsetWidth || 0)) + .4 * rem) : 0;
  for (const row of t.querySelectorAll(".tb-cards")) {
    const n = row.children.length, room = row.closest(".tb-left, .tb-right") ? half : w - named;
    if (n > 1 && fit.pf * (PLAY.w + (n - 1) * PLAY.step) > room) row.style.setProperty("--tb-step", `${Math.max(.6 * fit.pf, (room - PLAY.w * fit.pf) / (n - 1)).toFixed(2)}px`);
  }
}
function closeDialogs() { for (const id of ["resultDlg", "whyDlg", "rushDlg"]) if ($(id).open) $(id).close(); }

// ---------- puzzle rush ----------
// Positions from the computer players' own hands where one play is clearly best (tribute-rush.js; the bank,
// tribute-puzzles.js, loads with the first rush). Find it while five minutes run: the clock stands while you read a
// verdict and while the menu or the rules are open; three misses end the run. An answer is judged by the plays the
// puzzle weighed, each tried in hundreds of deals of the cards you couldn't see; a play outside them is tried against
// the best in deals of its own. The run is kept as it goes (tribute:rush), the best score in tribute:rushBest.
const RUSH = "tribute:rush", RUSH_BEST = "tribute:rushBest", RUSH_SEEN = "tribute:rushSeen", RUSH_MS = 5 * 60 * 1000;
let rush = null, bank = null, rushLib = null, ticking = null, savedAt = 0;
async function loadRush() {
  rushLib ||= await import("./tribute-rush.js");
  bank ||= (await import("./tribute-puzzles.js")).PUZZLES;
}
const rushPuzzle = () => (rush && bank ? bank.find(p => p.id === rush.order[rush.i]) : null);
const here = () => `${rush.seed}:${rush.i}`;                     // which puzzle of which run: an answer worked out late lands only there
const clockText = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const lv = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;
function rushStatus() {
  const marks = "✗".repeat(rush.strikes) + "○".repeat(Math.max(0, 3 - rush.strikes));
  return `<span class="tb-rush"><b>Puzzle ${rush.i + 1}</b> · ✓ ${rush.score} · <span class="tb-strikes" aria-label="${rush.strikes} of 3 missed">${marks}</span> · <span id="rushClock">${clockText(rush.left)}</span></span>`;
}
async function startRush() {
  const done = busy("Dealing the puzzles", { delay: 150 });
  try { await loadRush(); } finally { done(); }
  const seed = (Math.random() * 2 ** 32) >>> 0;
  rush = { v: 1, seed, order: rushLib.runOrder(bank, seed, read(RUSH_SEEN, [])), i: 0, score: 0, strikes: 0, left: RUSH_MS, answer: null, over: false, log: [] };
  closeDialogs();
  showRushPuzzle();
}
/** The puzzle in hand laid on the table: its seat yours, the others named as at your own table. */
function showRushPuzzle() {
  const p = rushPuzzle();
  if (!p) { endRush(); return; }
  G = rushLib.replay(p); me = p.seat;
  const names = []; names[me] = "You";
  for (let k = 1; k < 4; k++) names[(me + k) % 4] = BOTS[k - 1];
  S = { v: 1, names, humans: [me], started: 0 };
  gen++; selected.clear(); hint = null;
  // left while a play was being checked (it wasn't counted yet): asked again; answered, but not yet in words: put now
  if (rush.answer?.verdict === "unweighed") rush.answer = null;
  if (rush.answer) for (const id of rushLib.weighed(p).best.action.cards || []) selected.add(id);
  save(); render(); tick();
  if (rush.answer && !rush.answer.list) explainRush(p, here());
}
function tick() {
  clearInterval(ticking);
  if (!rush || rush.over || IN_FRAME) return;
  let last = Date.now();
  ticking = setInterval(() => {
    const now = Date.now(), dt = now - last;
    last = now;
    if (!rush || rush.answer || rush.over || isPaused() || document.hidden) return;
    rush.left -= dt;
    const el = $("rushClock");
    if (el) el.textContent = clockText(rush.left);
    if (rush.left <= 0) { rush.left = 0; endRush(); }
    else if (now - savedAt > 3000) { savedAt = now; save(); }
  }, 250);
}
/** Your answer: judged at once from the puzzle (a play it didn't weigh, by a look-ahead), then explained in words. */
async function rushAnswer(action) {
  if (!rush || rush.answer || rush.over) return;
  const p = rushPuzzle(), at = here(), j = rushLib.judge(p, G, action);
  rush.answer = { action, verdict: j.verdict, gap: j.gap, mine: j.mine?.value ?? null, list: null };
  if (j.verdict === "unweighed") {
    render();
    const out = await think(clone(G), me, "playout", { actions: [j.best.action, action] });
    if (!rush || here() !== at) return;
    const mean = v => (v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    const b = mean(out?.vals?.[0]), m = mean(out?.vals?.[1]);
    const gap = b !== null && m !== null ? b - m : 1;
    rush.answer.verdict = gap <= 0.1 ? "fine" : "wrong";
    rush.answer.gap = Math.max(0, gap);
    rush.answer.mine = j.best.value - rush.answer.gap;
    rush.answer.checked = out?.n || 0;
  }
  if (rush.answer.verdict === "wrong") rush.strikes++; else rush.score++;
  rush.log.push({ id: p.id, verdict: rush.answer.verdict, gap: rush.answer.gap });
  write(RUSH_SEEN, [...read(RUSH_SEEN, []).filter(id => id !== p.id), p.id].slice(-150));
  if (rush.strikes >= 3) rush.over = true;
  selected.clear();
  for (const id of rushLib.weighed(p).best.action.cards || []) selected.add(id);
  save(); render();
  explainRush(p, at);
}
/** The puzzle's plays in words (the hint's reckoning, without a look-ahead) with what each was worth in its deals. */
async function explainRush(p, at) {
  const list = await think(clone(G), me, "weigh");
  if (!rush || here() !== at || !rush.answer) return;
  const sig = a => rushLib.signature(a, G.level), mine = sig(rush.answer.action);
  const words = new Map((Array.isArray(list) ? list : []).map(o => [sig(o.action), o]));
  const titled = a => words.get(sig(a))?.title || (a.t === "pass" ? "Pass" : `Play ${E.playName(E.readingFor(a.cards, G.level, null) || { type: "single", key: 0 })}`);
  const item = (a, value) => {
    const w = words.get(sig(a));
    return { action: a, title: titled(a), pros: (w?.pros || []).slice(), cons: (w?.cons || []).slice(), plays: w?.plays ?? null, holds: w?.holds ?? null, levels: value, yours: sig(a) === mine };
  };
  // the best first, then yours, then the others by what they were worth
  const { opts, best } = rushLib.weighed(p);
  const rest = opts.filter(o => o !== best).map(o => item(o.action, o.value));
  if (!opts.some(o => sig(o.action) === mine) && rush.answer.mine !== null) rest.push(item(rush.answer.action, rush.answer.mine));
  rest.sort((x, y) => y.yours - x.yours || y.levels - x.levels);
  const top = item(best.action, best.value), a = rush.answer, yours = rest.find(o => o.yours);
  const over = `${p.n} deals of the cards you couldn't see`, also = a.checked ? ` (set against it in ${a.checked} deals of its own)` : "";
  top.why = a.verdict === "best" ? `You found it: ${mid(top.title)}, ${lv(best.value)} levels a hand over ${over}.`
    : a.verdict === "fine" ? `Yours, ${mid(yours?.title || "your play")}${also}, did as well as the best, ${mid(top.title)}: ${lv(a.mine)} levels a hand against ${lv(best.value)} over ${over}.`
    : `The best was ${mid(top.title)}: ${lv(best.value)} levels a hand over ${over}; yours, ${mid(yours?.title || "your play")}${also}, ${lv(a.mine)}.`;
  top.out = (Array.isArray(list) ? list[0]?.out : null) || null;
  rush.answer.list = [top, ...rest];
  save(); render();
}
function nextRush() {
  if (!rush) return;
  if (rush.over || rush.left <= 0) { endRush(); return; }
  rush.i++; rush.answer = null;
  showRushPuzzle();
}
function endRush() {
  if (!rush) return;
  rush.over = true;
  clearInterval(ticking);
  const before = read(RUSH_BEST, 0), best = Math.max(before, rush.score);
  if (best > before) write(RUSH_BEST, best);
  save(); render();
  $("rushHead").textContent = rush.left <= 0 ? "Time" : rush.strikes >= 3 ? "Three misses" : "The end of the bank";
  const missed = rush.log.filter(x => x.verdict === "wrong").length;
  $("rushBody").innerHTML = `<p class="tb-rush-score"><b>${rush.score}</b> solved${rush.score > before ? " · your best" : before ? ` · best ${before}` : ""}</p>`
    + `<p class="tb-rush-sub">${rush.log.length} answered, ${missed} missed, ${clockText(rush.left)} left on the clock.</p>`;
  if (!$("rushDlg").open) $("rushDlg").showModal();
}
function leaveRush() {
  rush = null;
  clearInterval(ticking);
  try { localStorage.removeItem(RUSH); } catch { /* private mode */ }
  closeDialogs();
  load();
}
/** The verdict, or the question while it's open; and your buttons. */
function drawRush(box, say) {
  const a = rush.answer, p = rushPuzzle();
  say.hidden = false;
  if (!a) {
    const top = G.top, mate = E.partnerOf(me);
    const ask = top ? `${nameOf(top.seat)}${top.seat === mate ? ", your partner," : ""} played ${E.playName(top.reading)}. Your best answer?` : "Your lead. The best play?";
    say.innerHTML = `<b>Find the best play</b> ${esc(ask)}`;
    if (rush.over) { box.append(goBtn("See the score", endRush, "primary")); return; }
    moveButtons(box);
    return;
  }
  if (a.verdict === "unweighed") { say.innerHTML = `<b>Checking</b> <span class="tb-thinking">your play against the best, in deals of the cards you can't see…</span>`; return; }
  const { opts, best } = rushLib.weighed(p);
  const second = opts.filter(o => o !== best).sort((x, y) => y.value - x.value)[0];
  const also = a.checked ? `, set against it in ${a.checked} deals of its own,` : "";
  const bestWords = a.list?.[0], mineWords = a.list?.find(o => o.yours);
  let html;
  if (a.verdict === "best") html = `<b class="tb-hit">✓ Best</b> ${esc(cap(bestWords?.title || "the best play"))}: ${lv(best.value)} levels a hand over ${p.n} deals of the cards you couldn't see${second ? `; the next best ${lv(second.value)}` : ""}.${bestWords?.pros[0] ? ` ${esc(cap(bestWords.pros[0]))}.` : ""}`;
  else if (a.verdict === "fine") html = `<b class="tb-hit">✓ As good</b> Yours${also} does ${lv(a.mine)} levels a hand, within a tenth of the best: ${esc(mid(bestWords?.title || "the best play"))}, ${lv(best.value)} over ${p.n} deals.`;
  else html = `<b class="tb-miss">✗ Not the best</b> ${esc(cap(bestWords?.title || "another play"))} does ${lv(best.value)} levels a hand over ${p.n} deals; yours${also} ${lv(a.mine)}, ${a.gap.toFixed(1)} worse.${mineWords?.cons[0] ? ` Against yours: ${esc(mineWords.cons[0])}.` : ""}${bestWords?.pros[0] ? ` For the best: ${esc(bestWords.pros[0])}.` : ""}`;
  say.innerHTML = `${html}${a.list ? ' <button type="button" class="link tb-why-btn">Why?</button>' : ' <span class="tb-thinking">…</span>'}`;
  say.querySelector(".tb-why-btn")?.addEventListener("click", () => showWhy(rush.answer.list));
  box.append(goBtn(rush.over ? "See the score" : "Next puzzle", nextRush, "primary"));
}

// ---------- together: partners across the table, against two computer players ----------
// The two of you sit at seats 0 and 2, which are one side (the first to sit down at 0, the other across), so you
// always play as partners; the computer players take 1 and 3.
let roomData = null, joining = null;                            // joining: the rete while you sit down, until the table's drawn
const seated = () => { joining?.(); joining = null; };
const mySlot = () => (together.room ? seatsOf(roomData).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
function freshRoom(players) {
  const names = ["", BOTS[0], "", BOTS[2]];
  for (const [, p] of Object.entries(players)) names[p.slot === 1 ? 2 : 0] = p.name;
  const game = E.toRoom(E.newGame({ mode: opts.mode, deals: opts.deals }, (Math.random() * 2 ** 32) >>> 0));
  return { v: 1, app: APP, created: Date.now(), players, game, table: { names, humans: [0, 2], started: Date.now(), bots: opts.bots } };
}
function onRoomState(g) {
  roomData = g;
  me = mySlot() === 1 ? 2 : 0;
  const names = [...(g.table?.names || [])];
  for (const [, p] of seatsOf(g)) names[p.slot === 1 ? 2 : 0] = p.name;
  // a seat kept for your partner until they sit down: theirs by the name they go by here, if they're about
  const partner = together.partner()?.name;
  for (const s of [0, 2]) names[s] ||= s === me ? together.room?.name || "You" : partner || "Your partner";
  S = { ...g.table, names, humans: [0, 2] };
  // your own move already on the table, on its way: an older state meanwhile (a seat coming online) doesn't take it back
  const behind = pending && g.game?.handNo === pending.handNo && (g.game.log?.length || 0) < pending.len;
  if (!behind) {
    const was = G ? `${G.handNo}:${G.log.length}` : "";
    G = E.fromRoom(clone(g.game));
    if (`${G.handNo}:${G.log.length}` !== was) { gen++; keepPicked(); hint = null; }
  }
  if (G.phase !== "over" && $("resultDlg").open) $("resultDlg").close();
  render();
  seated();
  if (!behind) kick(0);
}
let pending = null;                                              // your move on its way to the room: { handNo, len } it makes
/** A move at the table together, as one transaction on the room's copy. Your own shows at once: the room's answer is a
 *  round trip away (seconds, from far enough), and only you move your seat, so it comes back as you made it or not at
 *  all (then the room's state is put back). */
async function applyTogether(seat, act) {
  const len = G.log.length, handNo = G.handNo;
  let shown = null;
  if (seat === me) {
    try {
      const next = clone(G);
      E.act(next, seat, act);
      G = next; gen++; selected.clear(); hint = null;
      pending = shown = { handNo, len: G.log.length };
      render();
    } catch { /* not a move the rules allow: the room's own check turns it down */ }
  }
  const ok = await together.act(g => {
    const game = E.fromRoom(g.game);
    if (game.handNo !== handNo || game.log.length !== len) return false;   // someone moved first
    try { E.act(game, seat, act); } catch { return false; }
    g.game = E.toRoom(game);
  });
  if (pending === shown) pending = null;
  if (!ok) {
    if (roomData) G = E.fromRoom(clone(roomData.game));
    render(); kick(300);
  }
}
async function nextTogether() {
  const handNo = G.handNo;
  $("resultDlg").close();
  await together.act(g => {
    const game = E.fromRoom(g.game);
    if (game.handNo !== handNo || game.phase !== "over") return false;
    if (game.result.over) { const fresh = freshRoom(g.players); g.game = fresh.game; g.table = fresh.table; }
    else g.game = E.toRoom(E.nextHand(game, (Math.random() * 2 ** 32) >>> 0));
  });
}
function drawPartner() {
  if (!together.room) return;
  const p = together.partner();
  if (!p) toastOnce("Waiting for your partner to join…");
  else if (p.game && p.game !== "tribute") toastOnce(`${p.name} is in ${GAMES[p.game]?.name || "another game"}`);
}
let toldAt = "";
function toastOnce(msg) { if (toldAt === msg) return; toldAt = msg; toast(msg, 3000); }
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "tribute",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1 && !!g.game && !!g.table,
  fresh: freshRoom,
  onState: onRoomState,
  onPresence: render,
  onLeave: () => { roomData = null; seated(); load(); },
  // a match played to its end: the pair's record, as a team
  result: g => {
    const game = g.game;
    if (game?.phase !== "over" || !game.result?.over) return null;
    return { match: `${g.table?.started}`, score: game.result.levels?.[0] ?? null, won: game.result.winner === 0, coop: true, lower: false };
  },
});

// ---------- the menu ----------
let toastTimer = null;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const set = (k, v) => { opts[k] = v; write(OPTS, opts); render(); };
  if (together.room) part(body, "together").append(line(`You and your partner play together against ${BOTS[0]} and ${BOTS[2]}.`), action("Back to solo", () => together.leave(), "link"));
  else if (rush) part(body, "play").append(action("New puzzle rush", () => startRush(), "primary"), action("Back to the match", () => leaveRush(), "link"));
  else part(body, "play").append(action("New match", () => newMatch(), "primary"), action("Puzzle rush", () => startRush(), ""));
  const content = part(body, "content");
  content.append(choice("Match", [["deals", "Six hands"], ["toA", "To the ace"]], opts.mode, v => set("mode", v)));
  if (G && G.opts.mode !== opts.mode) content.append(line("This takes effect with a new match."));
  const bots = together.room ? S?.bots || "hard" : opts.bots;
  part(body, "settings").append(
    choice("Computer players", [["medium", "Medium"], ["hard", "Hard"]], bots, v => {
      set("bots", v);
      if (together.room) together.act(g => { if (!g.table) return false; g.table.bots = v; });
    }),
    choice("Coach", [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]], opts.coach, v => { set("coach", v); hint = null; advise(); render(); }),
    choice("Pace", [["quick", "Quick"], ["steady", "Steady"], ["slow", "Slow"]], opts.pace, v => set("pace", v)),
    toggle("Card counter", opts.counter, v => set("counter", v)),
    toggle("Full screen", !!opts.full, v => { fullScreen(v); set("full", v); }),
    choice("Held sideways, your cards", [["row", "In a row"], ["stack", "Stacked"]], sideOf(), v => set("side", v)),
  );
  const st = read(STATS, null), rushBest = read(RUSH_BEST, 0);
  if (rushBest) part(body, "about").append(line(`Puzzle rush: best ${rushBest} solved`));
  if (st?.hands) part(body, "about").append(line(`${st.hands} hand${st.hands === 1 ? "" : "s"}, your side out first in ${st.firsts} (${st.oneTwo} one-two)${st.matches ? ` · ${st.matches} match${st.matches === 1 ? "" : "es"}, won ${st.wins}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the rules ----------
function rules() {
  return `<p><b>Two decks, four players, two sides.</b> 108 cards, 27 each; your partner sits across from you, and play passes to the right. Be first out of cards, and get your partner out soon after.</p>
<p><b>The level.</b> Each side has a level, from 2 up to the ace; the hand is played at the level of the side that won the last one (2 to begin). The level's cards rank above the ace, below the jokers: 2 3 4 … K A, level, small joker, big joker. The two ♥ of the level are wild (★): either stands for any card but a joker, in any play; alone, it's just a level card.</p>
<p><b>Plays.</b> A single; a pair; three alike; a full house (three and a pair); a straight of exactly five; three pairs in a row; two triples in a row. In a straight or a run the ace may be low or high, and a level card counts as itself. Lead anything; the next players must play the same kind (and length), higher, or pass. When everyone else passes, the last to play leads. If he has just gone out, his partner leads.</p>
<p><b>Bombs</b> beat any play: four alike, then five alike, then a straight flush (five in a row in one suit), then six alike up to ten, and on top the four jokers. Between bombs, the bigger tier wins, then the higher rank.</p>
<p><b>Rising.</b> The side whose player goes out first rises: three levels if his partner is out second, two if third, one if last. The other side stays where it is.</p>
<p><b>Tribute.</b> From the second hand the last out gives the first out his highest card (never a ★); the first out gives back any card of 10 or lower. If one side went out first and second, both of the other side pay, the higher card to the first. Whoever paid leads. Holding both big jokers between them, the payers pay nothing, and the first out leads.</p>
<p><b>Winning.</b> A match of six hands goes to the side with the higher level (another hand if they're level). Played to the ace, a side must win a hand at its own ace, its partner not last.</p>`;
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "tribute");
document.querySelector(".tb-mark").innerHTML = APPS.find(a => a.id === "tribute")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("whyClose").addEventListener("click", () => $("whyDlg").close());
$("rushAgain").addEventListener("click", () => startRush());
$("rushLeave").addEventListener("click", () => leaveRush());
$("whyDlg").addEventListener("click", e => { if (e.target === $("whyDlg")) $("whyDlg").close(); });
$("helpBtn").addEventListener("click", () => { $("rulesBody").innerHTML = rules(); $("rulesDlg").showModal(); });
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", nextHand);
$("tableBtn").addEventListener("click", () => $("resultDlg").close());
$("rulesDlg").addEventListener("click", e => { if (e.target === $("rulesDlg")) $("rulesDlg").close(); });
onPause(() => { clearTimeout(timer); render(); }, () => kick(0));
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
let resizeTimer = null;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 60); });

// for tests and debugging
window.__tribute = { get state() { return G; }, get me() { return me; }, get together() { return together; }, get selected() { return [...selected]; },
  get rush() { return rush; }, startRush, nextRush, leaveRush,
  apply: (seat, a) => apply(seat, a), mine, newMatch, nextHand, select(ids) { selected.clear(); for (const id of ids) selected.add(id); render(); }, playSelected, pass, showHint,
  get checks() { return C; }, get hint() { return hint; } };

function load() {
  const r = read(RUSH, null);
  if (r?.v === 1) { resumeRush(r); return; }
  const run = read(RUN, null);
  if (run?.G?.v === 1 && run?.S) {
    G = E.fromRoom(run.G); S = run.S; C = run.C || []; me = 0;
    closeDialogs();
    gen++;
    render();
    kick(0);
    return;
  }
  newMatch();
}
/** A rush left open: back where it was (an answer and its words kept), or its score if it was over. */
async function resumeRush(r) {
  await loadRush();
  rush = r;
  if (!rushPuzzle()) { leaveRush(); return; }
  showRushPuzzle();
  if (rush.over) endRush();
}
// Opened for a duo match: your solo match isn't dealt or played on while you sit down (its computer players would
// move on without you); it waits as you left it, for Back to solo, or for a join that doesn't come off.
const code = roomInAddress();
if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) { seated(); load(); } });
} else load();
