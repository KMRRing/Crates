// Tribute: Guan Dan (掼蛋) at a table of four, you and a computer partner across the table against two computer
// players, or you and your partner together against them. The rules are tribute-engine.js's, the players
// tribute-bot.js's (they think in tribute-worker.js, off this thread); this file deals, shows the table and your
// cards in their columns, takes your plays, runs the others at a pace you can follow, keeps the levels over a match,
// and gives a hint: the computer's play in your seat and why.
import * as E from "./tribute-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { GAMES, roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sideways } from "./wide.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "tribute:run", OPTS = "tribute:opts", STATS = "tribute:stats";
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
let opts = { mode: "deals", deals: 6, pace: "steady", counter: false, ...read(OPTS, {}) };
let me = 0;
const selected = new Set();
let hint = null;                                                 // { key, list, at }: the hint's plays, cycling
const isHuman = seat => !!S?.humans?.includes(seat);
const nameOf = seat => (seat === me && !together.room ? "You" : S?.names?.[seat] || "?");
const keyNow = () => (G ? `${G.handNo}:${G.log.length}` : "");
const FACE = r => (r === 15 ? "lvl" : ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][r] || "");

/** A state read from the room put back in shape: Firebase drops empty lists and nulls. */
function normalize(g) {
  if (!g) return g;
  g.hands = [0, 1, 2, 3].map(i => g.hands?.[i] || []);
  g.played = [0, 1, 2, 3].map(i => g.played?.[i] || []);
  g.out = g.out || [];
  g.log = (g.log || []).map(e => ({ ...e, cards: e.cards || (e.e === "play" ? [] : undefined) }));
  g.top = g.top ? { ...g.top, cards: g.top.cards || [] } : null;
  g.levels = [0, 1].map(i => g.levels?.[i] ?? 2);
  g.results = g.results || [];
  g.result = g.result ?? null;
  if (g.tribute) g.tribute = { ...g.tribute, payers: g.tribute.payers || [], pays: g.tribute.pays || [], returns: (g.tribute.returns || []).map(r => ({ ...r, card: r.card ?? null })) };
  g.opts = { ...E.DEFAULTS, ...(g.opts || {}) };
  g.passes = g.passes || 0;
  return g;
}

/** A state as the room keeps it: each seat's cards under its own key, so a seat with none (out, or not yet played)
 *  doesn't shift the others along when an empty list is dropped. */
const toRoom = g => ({ ...g, hands: { ...g.hands }, played: { ...g.played } });

// ---------- the computer players, in a worker ----------
let worker = null, asked = 0, local = null;
const answers = new Map();
function startWorker() {
  if (worker !== null) return;
  try {
    worker = new Worker(new URL("./tribute-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { const done = answers.get(e.data.id); answers.delete(e.data.id); done?.(e.data); };
    worker.onerror = () => { worker = false; for (const done of answers.values()) done({ decision: null }); answers.clear(); };
  } catch { worker = false; }
}
/** The computer's choice in a seat now: { action, why }; `kind`: "decide" or "hints" (its choice and the others). */
async function think(state, seat, kind = "decide") {
  state.names = [0, 1, 2, 3].map(s => (s === seat ? "you" : nameOf(s)));   // for the reasons it gives
  startWorker();
  let reply = null;
  if (worker) reply = await new Promise(res => { const id = ++asked; answers.set(id, res); worker.postMessage({ id, state, seat, kind }); });
  if (reply?.decision) return reply.decision;
  local ||= await import("./tribute-bot.js");
  return kind === "hints" ? local.hints(state, seat) : local.decide(state, seat, { search: 12 });
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
function save() { if (!together.room && !IN_FRAME) write(RUN, { G, S }); }

// ---------- the turn ----------
let timer = null, busyWith = null, gen = 0;
const paused = () => !together.room && isPaused();
function kick(ms = 0) { clearTimeout(timer); timer = setTimeout(step, ms); }
function afterChange() {
  gen++;
  selected.clear();
  hint = null;
  save();
  render();
  kick(0);
}
function step() {
  timer = null;
  if (!G || IN_FRAME) return;
  if (G.phase === "over") { handOver(); return; }
  const waiting = E.waitingOn(G);
  const bot = waiting.find(s => !isHuman(s));
  if (bot === undefined || busyWith !== null || paused()) { render(); return; }
  const g0 = gen, snap = clone(G), slow = PACE[opts.pace] || PACE.steady;
  busyWith = bot;
  render();
  Promise.all([think(snap, bot), new Promise(r => setTimeout(r, slow))]).then(([d]) => {
    busyWith = null;
    if (g0 !== gen || !G || paused()) { render(); kick(0); return; }
    if (!d?.action) { console.error("no decision", d); render(); return; }
    apply(bot, d.action);
  }).catch(e => { busyWith = null; console.error(e); toast("A computer player stumbled"); render(); });
}
function apply(seat, act) {
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
  apply(me, { t: "play", cards, as: reading });
}
function pass() { if (G && E.asked(G, me) === "play" && G.top) apply(me, { t: "pass" }); }
function returnSelected() {
  if (!G || E.asked(G, me) !== "return") return;
  const ok = E.returnable(G.hands[me], G.level);
  const pick = [...selected].filter(id => ok.includes(id));
  if (pick.length !== 1) { toast("Pick one card of 10 or lower to give back"); return; }
  apply(me, { t: "return", card: pick[0] });
}
async function showHint() {
  if (!G || !E.asked(G, me)) return;
  const key = keyNow();
  if (hint?.key !== key) {
    hint = { key, list: null, at: 0 };
    $("say").hidden = false;
    $("say").innerHTML = '<b>Hint</b> <span class="tb-thinking">thinking…</span>';
    const list = await think(clone(G), me, "hints");
    if (hint?.key !== key) return;
    hint.list = Array.isArray(list) ? list : list ? [list] : [];
  } else if (hint.list) hint.at = (hint.at + 1) % Math.max(1, hint.list.length);
  const h = hint.list?.[hint.at];
  if (!h) return;
  selected.clear();
  if (h.action.t === "play") for (const id of h.action.cards) selected.add(id);
  if (h.action.t === "return") selected.add(h.action.card);
  render();
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

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
  const left = G.opts.mode === "deals" ? `hand ${G.handNo + 1} of ${G.opts.deals}` : "to the ace";
  $("strip").innerHTML = `<span class="tb-lvl">Level <b>${FACE(r === 15 ? 15 : r)}</b>${decl} · <span class="tb-wild">♥${FACE(r)}</span> wild</span><span class="tb-score">Us <b>${FACE(lv[us])}</b> · them <b>${FACE(lv[1 - us])}</b> · ${left}</span>`;
}
/** The news at a hand's start: who led, who paid tribute and what came back. */
function drawNews() {
  const box = $("news");
  const lines = [];
  for (const e of G.log) {
    if (e.e === "lead") lines.push(`${nameOf(e.seat)} ${e.seat === me ? "hold" : "holds"} the turned-up ${E.cardName(e.card)}, and ${e.seat === me ? "lead" : "leads"}.`);
    else if (e.e === "resist") lines.push(`${e.seats.map(nameOf).join(" and ")} ${e.seats.length > 1 ? "hold" : "holds"} both big jokers: no tribute.`);
    else if (e.e === "tribute") lines.push(`${nameOf(e.from)} ${e.from === me ? "pay" : "pays"} ${e.to === me ? "you" : nameOf(e.to)} ${E.cardName(e.card)}.`);
    else if (e.e === "return") lines.push(`${nameOf(e.from)} ${e.from === me ? "give" : "gives"} back ${E.cardName(e.card)}.`);
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
function drawHand() {
  const box = $("hand");
  const hand = G.hands[me], level = G.level, cols = columns(hand, level);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // held sideways the cards are larger, with the width to spare; a column's cards each show at least their corner
  const big = sideways(), W = (big ? 3.2 : 2.6) * rem, H = (big ? 4.4 : 3.6) * rem, room = box.clientWidth || 360;
  box.style.setProperty("--tb-cw", `${W}px`); box.style.setProperty("--tb-ch", `${H}px`);
  const pitch = cols.length > 1 ? Math.min(W + 0.2 * rem, (room - W) / (cols.length - 1)) : W;
  const deepest = Math.max(1, ...cols.map(c => c.length));
  const drop = deepest > 1 ? Math.max(1.12 * rem, Math.min(1.3 * rem, (Math.max(H * 1.9, 7.6 * rem) - H) / (deepest - 1))) : 0;
  const ask = E.asked(G, me), ok = ask === "return" ? new Set(E.returnable(hand, level)) : null;
  const used = cols.length ? (cols.length - 1) * pitch + W : 0;
  const x0 = Math.max(0, (room - used) / 2);
  let html = "";
  cols.forEach((col, c) => col.forEach((id, i) => {
    const cls = [cardClass(id, level)];
    if (selected.has(id)) cls.push("sel");
    if (ok && !ok.has(id)) cls.push("dim");
    html += `<button type="button" class="${cls.join(" ")}" data-id="${id}" style="left:${(x0 + c * pitch).toFixed(1)}px;top:${(i * drop).toFixed(1)}px;z-index:${i + 1}" aria-label="${E.cardName(id)}${selected.has(id) ? ", picked" : ""}">${face(id, level)}</button>`;
  }));
  box.innerHTML = html;
  box.style.height = `${(H + (deepest - 1) * drop + 0.3 * rem).toFixed(0)}px`;
}
$("hand").addEventListener("click", e => {
  const b = e.target.closest(".tb-card");
  if (!b || !G) return;
  const id = Number(b.dataset.id);
  if (E.asked(G, me) === "return") { selected.clear(); selected.add(id); }
  else if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  render();
});

// ---------- the buttons ----------
function drawActions() {
  const box = $("actions"), say = $("say");
  box.replaceChildren();
  const h = hint?.key === keyNow() && hint.list ? hint.list[hint.at] : null;
  say.hidden = !h;
  if (h) say.innerHTML = `<b>Hint</b> ${esc(h.why)}`;
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
  box.append(goBtn("Hint", showHint, "quiet"));
  if (ask === "return") {
    const to = G.tribute.returns.find(r => r.from === me && r.card === null)?.to;
    const p = document.createElement("p");
    p.className = "tb-wait";
    p.textContent = `Give ${nameOf(to)} a card back: 10 or lower.`;
    box.prepend(p);
    box.append(goBtn("Give back", returnSelected, "primary"));
    return;
  }
  if (G.top) box.append(goBtn("Pass", pass, ""));
  if (selected.size) box.append(goBtn("Clear", () => { selected.clear(); render(); }, "quiet"));
  const top = G.top?.reading || null, reading = selected.size ? E.readingFor([...selected], G.level, top) : null;
  const play = goBtn(reading ? `Play ${E.playName(reading).replace(/^an? /, "")}` : G.top ? "Beat it" : "Lead", playSelected, "primary");
  play.disabled = !reading;
  box.append(play);
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
  box.hidden = !opts.counter || !G;
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
  $("resultBody").innerHTML = html;
  $("nextBtn").textContent = r.over ? "New match" : "Next hand";
  const dlg = $("resultDlg");
  dlg.showModal();
  dlg.scrollTop = 0;
  $("nextBtn").focus({ preventScroll: true });
}

function render() {
  if (!G) return;
  drawStrip();
  drawSeats();
  drawNews();
  drawCounter();
  drawHand();
  drawActions();
  drawPartner();
}
function closeDialogs() { if ($("resultDlg").open) $("resultDlg").close(); }

// ---------- together: partners across the table, against two computer players ----------
// The two of you sit at seats 0 and 2, which are one side (the first to sit down at 0, the other across), so you
// always play as partners; the computer players take 1 and 3.
let roomData = null, joining = null;                            // joining: the rete while you sit down, until the table's drawn
const seated = () => { joining?.(); joining = null; };
const mySlot = () => (together.room ? seatsOf(roomData).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
function freshRoom(players) {
  const names = ["", BOTS[0], "", BOTS[2]];
  for (const [, p] of Object.entries(players)) names[p.slot === 1 ? 2 : 0] = p.name;
  const game = toRoom(E.newGame({ mode: opts.mode, deals: opts.deals }, (Math.random() * 2 ** 32) >>> 0));
  return { v: 1, app: APP, created: Date.now(), players, game, table: { names, humans: [0, 2], started: Date.now() } };
}
function onRoomState(g) {
  roomData = g;
  me = mySlot() === 1 ? 2 : 0;
  const names = [...(g.table?.names || [])];
  for (const [, p] of seatsOf(g)) names[p.slot === 1 ? 2 : 0] = p.name;
  for (const s of [0, 2]) names[s] ||= "Your partner";           // a seat kept for them until they sit down
  S = { ...g.table, names, humans: [0, 2] };
  const was = G ? `${G.handNo}:${G.log.length}` : "";
  G = normalize(clone(g.game));
  if (`${G.handNo}:${G.log.length}` !== was) { gen++; selected.clear(); hint = null; }
  if (G.phase !== "over" && $("resultDlg").open) $("resultDlg").close();
  render();
  seated();
  kick(0);
}
async function applyTogether(seat, act) {
  const len = G.log.length, handNo = G.handNo;
  const ok = await together.act(g => {
    const game = normalize(g.game);
    if (game.handNo !== handNo || game.log.length !== len) return false;   // someone moved first
    try { E.act(game, seat, act); } catch { return false; }
    g.game = toRoom(game);
  });
  if (!ok) { render(); kick(300); }
}
async function nextTogether() {
  const handNo = G.handNo;
  $("resultDlg").close();
  await together.act(g => {
    const game = normalize(g.game);
    if (game.handNo !== handNo || game.phase !== "over") return false;
    if (game.result.over) { const fresh = freshRoom(g.players); g.game = fresh.game; g.table = fresh.table; }
    else g.game = toRoom(E.nextHand(game, (Math.random() * 2 ** 32) >>> 0));
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
  else part(body, "play").append(action("New match", () => newMatch(), "primary"));
  const content = part(body, "content");
  content.append(choice("Match", [["deals", "Six hands"], ["toA", "To the ace"]], opts.mode, v => set("mode", v)));
  if (G && G.opts.mode !== opts.mode) content.append(line("This takes effect with a new match."));
  part(body, "settings").append(
    choice("Pace", [["quick", "Quick"], ["steady", "Steady"], ["slow", "Slow"]], opts.pace, v => set("pace", v)),
    toggle("Card counter", opts.counter, v => set("counter", v)),
  );
  const st = read(STATS, null);
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
  apply: (seat, a) => apply(seat, a), newMatch, nextHand, select(ids) { selected.clear(); for (const id of ids) selected.add(id); render(); }, playSelected, pass, showHint };

function load() {
  const run = read(RUN, null);
  if (run?.G?.v === 1 && run?.S) {
    G = normalize(run.G); S = run.S; me = 0;
    closeDialogs();
    gen++;
    render();
    kick(0);
    return;
  }
  newMatch();
}
// Opened for a duo match: your solo match isn't dealt or played on while you sit down (its computer players would
// move on without you); it waits as you left it, for Back to solo, or for a join that doesn't come off.
const code = roomInAddress();
if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) { seated(); load(); } });
} else load();
