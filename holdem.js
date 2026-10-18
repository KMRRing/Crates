// Texas Hold'em (德州撲克) against computer players, or at a table with friends each on their own phone. The rules and
// words are holdem-rules.js's, the computer players holdem-bot.js's, the running seats.js's (seats-ui.js), the coach
// holdem-think.js's (in holdem-worker.js, off this thread) with its words from holdem-coach.js. This page draws the
// table: the other seats round its top, flanking yours at the foot, the pot and the board between them; your two cards,
// the coach as you choose (a hint when you ask, a word on each move of yours it would have made otherwise, or its move at
// every decision), the size of a raise, and your buttons below.
import { rules, alive, legal, sizes, blindsOf, potOf, HANDS, RAKES, DEFAULTS, STACK, SHOW_MS, FOLDED_MS } from "./holdem-rules.js";
import { LEVEL_NAMES } from "./holdem-bot.js";
import { think, sameMove, BUDGET } from "./holdem-think.js";
import { moveSaid, adviceLine, verdict, gain, near } from "./holdem-coach.js";
import { score, describe, equity, vsRandom, rankOf, suitOf, RANKS, RANK_WORDS, RANK_PLURAL, cardName } from "./holdem-eval.js";
import { seatPage, fillNames } from "./seats-ui.js";
import { seeded, mix } from "./seats.js";
import { cardHtml, backHtml } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { rulesHtml } from "./holdem-sheet.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./holdem-course.js";
import { holdemStage } from "./holdem-stage.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "holdem:opts", RECORD = "holdem:record", BEST = "holdem:best";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = n => Number(n).toLocaleString("en-GB");
const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));
const NAMES = ["Ah Keung", "Mei Ling", "Lao Ho", "Siu Ming", "Ah Lan", "Dai Lo"];   // the computer players, by seat

// the coach: off; hints, when you ask; check, a hint when you ask and a word on each move of yours it would have made
// otherwise; on (Always), its move at each of your decisions as well
const COACH = [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]];
let opts = { level: "hard", hands: DEFAULTS.hands, rake: DEFAULTS.rake, seats: 5, odds: false, voice: true, coach: "hints", ...read(OPTS, {}) };
if (!COACH.some(([k]) => k === opts.coach)) opts.coach = "hints";
if (!HANDS.includes(opts.hands)) opts.hands = DEFAULTS.hands;
if (!RAKES.includes(opts.rake)) opts.rake = DEFAULTS.rake;
if (!(opts.seats >= 2 && opts.seats <= 6)) opts.seats = 5;
const saveOpts = () => write(OPTS, opts);
const gameOptions = () => ({ hands: opts.hands, rake: opts.rake });

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

const face = id => ({ rank: RANKS[rankOf(id)] === "T" ? "10" : RANKS[rankOf(id)], suit: suitOf(id) });
const card = (id, cls = "") => cardHtml(face(id), { cls, label: cardName(id) });
const cards = (ids, cls = "") => `<span class="cd-line">${ids.map(id => card(id, cls)).join("")}</span>`;
const cap = s => s[0].toUpperCase() + s.slice(1);

let V = null, page = null, raiseTo = null, sizeKey = "", eqCache = { key: "", v: null }, oddsCache = { key: "", v: null };
page = seatPage({
  rules, id: "holdem", app: 1, pace: 800, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
const who = seat => (isMe(seat) ? "You" : nameOf(seat));

// ---------- the coach ----------
// It thinks in a worker of its own (holdem-worker.js), so the table never waits on it: a hint or Always's advice in a second
// or two, a check a little longer. Where a browser has no worker, it thinks here, in fewer deals.
// (a partner's frame, watched from the games screen, shows their table and coaches nobody)
const coaching = () => opts.coach !== "off" && !IN_FRAME;
const speaks = () => (opts.coach === "check" || opts.coach === "on") && !IN_FRAME;
const decisionOf = v => `${v.G.seq}:${v.G.n}`;
let worker = null, asked = 0;
const answers = new Map();
function coachWorker() {
  if (worker === null) {
    try {
      worker = new Worker(new URL("./holdem-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = e => { const f = answers.get(e.data.id); answers.delete(e.data.id); f?.(e.data); };
      worker.onerror = () => { worker = false; for (const f of answers.values()) f({ error: "no worker" }); answers.clear(); };
    } catch { worker = false; }
  }
  return worker;
}
function ask(kind, state, seat, move = null) {
  const w = coachWorker();
  if (!w) {
    try { return Promise.resolve({ result: think(state, seat, { ...BUDGET.here, must: kind === "check" ? move : null }) }); }
    catch (err) { return Promise.resolve({ error: String(err) }); }
  }
  return new Promise(res => { const id = ++asked; answers.set(id, res); w.postMessage({ id, kind, state, seat, move }); });
}
// the coach's weighing of your decision now ({ key, r, state, seat }), asked for once: by a Hint, or unasked (Always); a
// decision it couldn't weigh (no answer came) is noted, so nothing waits on it
let advice = null, weighing = null, hintAsked = null, hinted = null, failed = null;
function weigh(v) {
  const key = decisionOf(v);
  if (advice?.key === key) return Promise.resolve(advice);
  if (weighing?.key === key) return weighing.promise;
  const state = structuredClone(v.state), seat = v.seat;
  const promise = ask("think", state, seat).then(({ result }) => {
    if (weighing?.key === key) weighing = null;
    if (!result) { failed = key; return null; }
    const a = { key, r: result, state, seat };
    if (V?.G && decisionOf(V) === key) advice = a;
    return a;
  });
  weighing = { key, promise };
  return promise;
}
// the check's word on your last move it would have made otherwise ({ words, r, mine, state }), until your next move; and
// this hand's moves of yours, each with the coach's verdict, for the review at the hand's end
let word = null, notes = [], notesHand = 0;
async function checkMove(state, seat, move) {
  const { result } = await ask("check", state, seat, move);
  if (!result || state.hand !== V?.state?.hand) return;
  const v = verdict(result, move, state, seat);
  notes.push(v ? { mine: move, agreed: false, gap: v.gap, words: v.words } : { mine: move, agreed: true });
  word = v ? { words: v.words, r: result, mine: move, state } : null;
  draw();
}
/** Asked by Always at each of your decisions: the coach's move, ringed on the button that plays it, the slider set to its raise unless you have moved it. */
function advise(v) {
  if (opts.coach !== "on" || IN_FRAME || !mine() || [advice?.key, weighing?.key, failed].includes(decisionOf(v))) return;
  weigh(v).then(a => {
    if (!a || !V?.G || decisionOf(V) !== a.key) return;
    if (a.r.best.t === "raise" && mine() && (raiseTo == null || raiseTo === legal(V.state, V.seat).minTo)) raiseTo = a.r.best.to;
    draw();
  });
}
/** A new hand: the last one's notes and word go. */
function newHand(v) {
  if (v.state.hand === notesHand || v.state.step !== "bet") return;
  notesHand = v.state.hand;
  notes = [];
  word = null;
}
/** The coach's move at this decision, while it stands: the hint asked for, or Always's advice. */
function advised(v) {
  const key = decisionOf(v);
  if (hinted?.key === key) return hinted.r.best;
  return opts.coach === "on" && advice?.key === key ? advice.r.best : null;
}
const WHY = ' <button type="button" class="link hd-why" data-why="1">Why?</button>';
const WAIT = '<i class="ld" aria-hidden="true"></i>The coach is weighing it…';
/** What the coach says now: its move when asked or in Always, its word on your last move, or how the hand went by its lights. */
function coachLine(v) {
  const s = v.state, key = decisionOf(v), turn = mine();
  if (turn && hinted?.key === key) return `<b>Hint</b>: ${esc(adviceLine(hinted.r, s, v.seat))}${WHY}`;
  if (turn && hintAsked === key && !advice && failed !== key) return WAIT;
  if (turn && opts.coach === "on" && failed !== key) return advice?.key === key ? `<b>Coach</b>: ${esc(adviceLine(advice.r, advice.state, advice.seat))}${WHY}` : WAIT;
  if (!speaks()) return "";
  if (word && s.step === "bet") return `<b class="hd-miss">Coach</b> ${esc(word.words)}${WHY}`;
  if ((s.step === "shown" || s.step === "over") && notes.length) {
    const agreed = notes.filter(n => n.agreed).length;
    return `<b>Your play</b>: the coach agreed with ${agreed} of your ${notes.length} move${notes.length === 1 ? "" : "s"}${agreed < notes.length ? ' <button type="button" class="link hd-why" data-why="review">Where it differed</button>' : ""}`;
  }
  return "";
}
function drawCoach(v) {
  const box = $("coach");
  box.hidden = !coaching() || v.seat == null;
  if (!box.hidden) box.innerHTML = `<span class="hd-says">${coachLine(v)}</span><button type="button" class="btn hd-hint" data-act="hint" ${mine() ? "" : "disabled"}>Hint</button>`;
}
/** A Hint: the coach's move, with the slider set to its size when it raises. */
async function hint() {
  const key = decisionOf(V);
  hintAsked = key;
  draw();
  const a = await weigh(V);
  if (!a || !V?.G || decisionOf(V) !== key) { draw(); return; }
  hinted = { key, r: a.r };
  if (a.r.best.t === "raise") { raiseTo = a.r.best.to; syncSlide(); }
  draw();
}

// ---------- where each seat sits ----------
// Clockwise from you (the next seat to act is on your left, as at a real table): up the left side, across the top, down the right.
const SLOTS = { 2: ["tc"], 3: ["tl", "tr"], 4: ["ml", "tc", "mr"], 5: ["ml", "tl", "tr", "mr"], 6: ["ml", "tl", "tc", "tr", "mr"] };
const slotOf = (seat, n, me) => { const k = (seat - me + n) % n; return k === 0 ? "me" : SLOTS[n][k - 1]; };

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("table").innerHTML = ""; $("hand").innerHTML = ""; $("coach").hidden = true; $("strip").textContent = ""; $("size").innerHTML = ""; $("size").dataset.sig = ""; drawBar(); return; }
  const s = v.state;
  newHand(v);
  if (advice && advice.key !== decisionOf(v)) advice = null;
  if (hinted && hinted.key !== decisionOf(v)) hinted = null;
  $("strip").innerHTML = stripLine(s);
  drawTable(v);
  drawHand(v);
  drawCoach(v);
  drawSize(v);
  drawBar();
  advise(v);
}

/** What the hand's pot was once it was paid: the chips contested, the house's share with them, not the bet nobody called. */
const contested = res => res.pots.filter(p => !p.back).reduce((t, p) => t + p.amount, 0) + res.rake;

function stripLine(s) {
  const street = s.step === "bet" || s.step === "runout" ? ["Before the flop", "The flop", "The turn", "The river"][s.seen >= 5 ? 3 : s.seen === 4 ? 2 : s.seen === 3 ? 1 : 0] : s.step === "over" ? "Game over" : "Showdown";
  return `Hand <b>${s.hand}</b> of ${s.opts.hands} · Pot <b>HK$${fmt(s.step === "shown" || s.step === "over" ? contested(s.result) : potOf(s))}</b> · ${street}`;
}

/** What a seat last did, in a word (the rules keep it as "raise 300", "allin 5000", "fold"…); the amount is the chip beside its name. */
function actWord(last) {
  return ({ fold: "Fold", check: "Check", call: "Call", raise: "Raise", bet: "Bet", allin: "All in", small: "SB", big: "BB" })[String(last || "").split(" ")[0]] || "";
}

/** The chance of winning for each hand still in, while the board is run out: counted over the boards still to come, the same on every redraw. */
function runoutOdds(v) {
  const s = v.state, key = `${v.G.seq}:${s.hand}:${s.seen}`;
  if (eqCache.key === key) return eqCache.v;
  const live = alive(s), res = equity(live.map(i => s.hole[i]), s.board.slice(0, s.seen), { rng: seeded(mix(v.G.seed, s.hand * 7 + s.seen)), samples: 2500 });
  const out = {};
  live.forEach((i, k) => { out[i] = Math.round(res[k].share * 100); });
  eqCache = { key, v: out };
  return out;
}

function drawTable(v) {
  const s = v.state, n = s.seats, me = v.seat ?? 0, { sb, bb } = blindsOf(s);
  const res = s.step === "shown" || s.step === "over" ? s.result : null;
  const turnSeat = s.step === "bet" ? s.turn : null;
  const winners = new Set(res ? res.pots.flatMap(p => p.winners) : []);
  const shown = new Map((res?.shown || []).map(x => [x.seat, x]));
  const odds = s.step === "runout" ? runoutOdds(v) : null;
  // the cards that make the winning hands: lit on the board and in the hands, the rest dimmed
  const lit = new Set();
  if (res && !res.uncontested) for (const w of res.pots[0].winners) for (const c of shown.get(w)?.five || []) lit.add(c);
  const dim = id => (res && !res.uncontested && !lit.has(id) ? "dim" : lit.has(id) ? "lit" : "");

  const plate = seat => {
    const out = s.out[seat], mine = isMe(seat), turn = turnSeat === seat, slot = slotOf(seat, n, me);
    const tags = [seat === sb ? "SB" : "", seat === bb ? "BB" : "", s.rebought.includes(seat) ? "REBUY" : ""].filter(Boolean).map(t => `<i class="hd-tag">${t}</i>`).join("");
    const showHand = (s.open && !out) || (res && shown.has(seat));
    const under = out || mine ? "" : showHand ? `<span class="cd-line">${s.hole[seat].map(id => card(id, dim(id))).join("")}</span>` : `<span class="cd-line">${backHtml()}${backHtml()}</span>`;
    let act = "", cls = "";
    if (res && shown.has(seat)) { act = shown.get(seat).name; cls = " say"; }
    else if (odds && !out) { act = `${odds[seat]}% to win`; cls = " say"; }
    else if (turn && !mine) { act = "thinking"; cls = " think"; }
    else act = actWord(s.last[seat]);
    const money = res ? (res.deltas[seat] ? `<span class="hd-delta ${res.deltas[seat] > 0 ? "up" : "down"}">${signed(res.deltas[seat])}</span>` : "")
      : s.bets[seat] > 0 ? `<span class="hd-bet" title="Bet this round">${fmt(s.bets[seat])}</span>` : "";
    return `<div class="hd-seat at-${slot}${turn ? " turn" : ""}${out ? " out" : ""}${winners.has(seat) ? " win" : ""}${mine ? " me" : ""}">
      <div class="hd-who"><b class="hd-name">${esc(who(seat))}</b>${tags}</div>${seat === s.button ? `<span class="hd-dealer" title="The button (指示器)">D</span>` : ""}
      <div class="hd-money"><span class="hd-stack">${fmt(s.stacks[seat])}</span>${money}</div>
      <div class="hd-under">${under}<span class="hd-act${cls}">${esc(act)}</span></div></div>`;
  };

  const board = Array.from({ length: 5 }, (_, i) => (i < s.seen ? card(s.board[i], dim(s.board[i])) : `<span class="cd-slot"></span>`)).join("");
  const potNow = res ? contested(res) : potOf(s);
  const pot = `Pot HK$${fmt(potNow)}${res?.rake ? ` <small>(house ${fmt(res.rake)})</small>` : ""}`;
  const next = s.step === "shown" ? `<span class="hd-next"><i data-until="${s.until}" data-ms="${res?.uncontested ? FOLDED_MS : SHOW_MS}"></i></span>` : `<span class="hd-next idle"></span>`;
  $("table").innerHTML = Array.from({ length: n }, (_, i) => plate(i)).join("") +
    `<div class="hd-centre"><p class="hd-pot">${pot}</p><div class="hd-board" aria-label="The board">${board}</div><p class="hd-said">${esc(fillNames(v.G.say?.text, v.seats))}</p>${next}</div>`;
  runBar();
}

let barRaf = 0;
function runBar() {
  cancelAnimationFrame(barRaf);
  const bar = document.querySelector(".hd-next i");
  if (!bar) return;
  const until = Number(bar.dataset.until), ms = Number(bar.dataset.ms), now = () => page.runner.table.now();
  const tick = () => { if (!bar.isConnected) return; const left = Math.max(0, until - now()); bar.style.transform = `scaleX(${Math.min(1, left / ms)})`; if (left > 0) barRaf = requestAnimationFrame(tick); };
  tick();
}

// ---------- your cards ----------
/** The two cards in words, before the flop: "Pair of kings", "Ace-king suited". */
function startName(hole) {
  const [a, b] = hole.map(rankOf).sort((x, y) => y - x);
  if (a === b) return `Pair of ${RANK_PLURAL[a]}`;
  return `${cap(RANK_WORDS[a])}-${RANK_WORDS[b]} ${suitOf(hole[0]) === suitOf(hole[1]) ? "suited" : "offsuit"}`;
}
/** Your chance against hands dealt at random to everyone still in, and what the call asks for, when the odds line is on. */
function oddsLine(v) {
  const s = v.state, seat = v.seat, me = legal(s, seat), foes = alive(s).length - 1;
  const key = `${v.G.seq}:${v.G.n}`;
  if (oddsCache.key !== key) oddsCache = { key, v: vsRandom(s.hole[seat], s.board.slice(0, s.seen), foes, { rng: seeded(mix(v.G.seed, v.G.n + 99)), samples: 800 }) };
  const win = Math.round(oddsCache.v * 100);
  return `Wins about ${win}% against ${foes} random hand${foes === 1 ? "" : "s"}${me.toCall ? ` · needs ${Math.round(me.odds * 100)}% to call` : ""}`;
}
function drawHand(v) {
  const box = $("hand");
  if (v.seat == null) { box.innerHTML = `<p class="hd-watch">Watching: you sit down at the next game.</p>`; return; }
  const s = v.state, hole = s.hole[v.seat], out = s.out[v.seat], over = s.step === "over";
  const board = s.board.slice(0, s.seen);
  const made = s.seen >= 3 ? describe(score([...hole, ...board])) : null;
  const name = out ? "Folded" : made ? made.text : startName(hole);
  const odds = !out && !over && opts.odds && s.step === "bet" ? oddsLine(v) : "";
  box.innerHTML = `${cards(hole).replace('class="cd-line"', `class="cd-line${out ? " folded" : ""}"`)}<div class="hd-read" role="status" aria-live="polite"><b>${esc(name)}</b><span class="st">${statusLine(v)}</span>${odds ? `<span>${esc(odds)}</span>` : ""}</div>`;
}

function statusLine(v) {
  const s = v.state;
  if (s.step === "over") return esc(s.winners.includes(v.seat) ? "You win the game" : `${s.winners.map(who).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`);
  if (s.step === "shown") {
    if (v.seat == null) return "";
    const d = s.result.deltas[v.seat];
    return esc(s.out[v.seat] && d <= 0 ? `You folded: ${signed(d)}` : d > 0 ? `You win HK$${fmt(d)}` : d < 0 ? `You lose HK$${fmt(-d)}` : "You get your bet back");
  }
  if (s.step === "runout") return "All in: the cards are turned up";
  if (v.seat == null) return esc(`${nameOf(s.turn)} to act`);
  if (s.out[v.seat]) return "You folded: watch the hand out";
  if (s.turn !== v.seat) { const w = v.seats[s.turn]; return esc(w?.bot && !w.away ? `${w.name} is thinking…` : `${w?.name || "Someone"} to act`); }
  const me = legal(s, v.seat);
  return me.toCall ? `<b>Your move</b> · ${fmt(me.toCall)} to call, pot ${fmt(me.pot)}` : `<b>Your move</b> · check, or bet · pot ${fmt(me.pot)}`;
}

// ---------- the size of a raise, and your buttons ----------
const mine = () => V?.G && V.seat != null && V.state.step === "bet" && V.state.turn === V.seat && !V.state.out[V.seat];
/** The slider is finer for small raises than for large: its position t (0 to 1000) maps to an amount by a square. */
const toOf = (t, lo, hi) => { const x = lo + (hi - lo) * (t / 1000) ** 2; return t >= 1000 ? hi : Math.max(lo, Math.min(hi, Math.round(x / 50) * 50)); };
const tOf = (to, lo, hi) => (hi > lo ? Math.round(1000 * Math.sqrt(Math.max(0, to - lo) / (hi - lo))) : 1000);

function drawSize(v) {
  const box = $("size"), on = mine(), s = v.state;
  const list = on ? sizes(s, v.seat) : [];
  const me = on ? legal(s, v.seat) : null;
  const key = on ? `${v.G.seq}:${v.G.n}` : "";
  if (key !== sizeKey) { sizeKey = key; raiseTo = me?.canRaise ? me.minTo : null; }
  const sig = `${key}:${list.map(x => x.to).join()}`;
  if (box.dataset.sig !== sig || !box.firstChild) {
    box.dataset.sig = sig;
    box.innerHTML = `<div class="hd-presets">${(list.length ? list : [{ key: "min", label: "Min" }, { key: "half", label: "½ pot" }, { key: "three", label: "¾ pot" }, { key: "pot", label: "Pot" }, { key: "all", label: "All in" }])
      .map(x => `<button type="button" class="btn" data-to="${x.to ?? ""}" ${list.length ? "" : "disabled"}>${esc(x.label)}</button>`).join("")}</div>
      <input type="range" class="hd-slide" min="0" max="1000" step="1" aria-label="Raise to" ${list.length > 1 ? "" : "disabled"}>`;
  }
  syncSlide();
}
function syncSlide() {
  const sl = document.querySelector(".hd-slide");
  if (!sl) return;
  const me = mine() ? legal(V.state, V.seat) : null;
  sl.value = me?.canRaise && raiseTo != null ? tOf(raiseTo, me.minTo, me.maxTo) : 0;
}
$("size").addEventListener("input", e => {
  if (!e.target.classList.contains("hd-slide") || !mine()) return;
  const me = legal(V.state, V.seat);
  raiseTo = toOf(Number(e.target.value), me.minTo, me.maxTo);
  drawBar();
});
$("size").addEventListener("click", e => {
  const b = e.target.closest("button[data-to]");
  if (!b || b.disabled || !mine() || b.dataset.to === "") return;
  raiseTo = Number(b.dataset.to);
  syncSlide();
  drawBar();
});

function drawBar() {
  const bar = $("bar"), v = V;
  if (!v?.G || (v.state.step === "over" && page.host)) { bar.innerHTML = `<button type="button" class="btn primary hd-go" data-act="new">New game</button>`; return; }
  const s = v.state, on = mine(), me = on ? legal(s, v.seat) : null;
  const raise = on && me.canRaise && raiseTo != null;
  const to = raise ? Math.max(me.minTo, Math.min(me.maxTo, raiseTo)) : 0;
  const rLabel = !raise ? "Raise" : to >= me.maxTo ? `All in ${fmt(to)}` : `${s.bet ? "Raise to" : "Bet"} ${fmt(to)}`;
  const cLabel = !on ? "Call" : me.toCall ? (me.toCall >= s.stacks[v.seat] ? `All in ${fmt(me.toCall)}` : `Call ${fmt(me.toCall)}`) : "Check";
  // the coach's move, ringed on the button that plays it
  const adv = on && coaching() ? advised(v) : null, ring = (...ts) => (adv && ts.includes(adv.t) ? " advised" : "");
  // a fold is for when there's something to call: a free fold is never right, so it waits
  bar.innerHTML = `<button type="button" class="btn hd-go${ring("fold")}" data-act="fold" ${on && me.toCall ? "" : "disabled"}>Fold</button>
    <button type="button" class="btn hd-go call${ring("check", "call")}" data-act="${on && !me.toCall ? "check" : "call"}" ${on ? "" : "disabled"}>${esc(cLabel)}</button>
    <button type="button" class="btn primary hd-go raise${ring("raise")}" data-act="raise" ${raise ? "" : "disabled"}>${esc(rLabel)}</button>`;
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  const move = act === "raise" ? { t: "raise", to: raiseTo } : { t: act };
  // Check and Always: the move set against the coach's, from the table as it was before it
  const key = decisionOf(V), before = speaks() ? structuredClone(V.state) : null, seat = V.seat, known = advice?.key === key ? advice : null;
  raiseTo = null;
  const why = await page.move(move);
  if (why) { toast(why); return; }
  if (before) {
    if (known && sameMove(known.r.best, move)) { notes.push({ mine: move, agreed: true }); word = null; draw(); }
    else checkMove(before, seat, move);
  }
});

// ---------- why: the coach's choices side by side ----------
const pc = x => `${Math.round(100 * x)}%`;
function showWhy(which) {
  const v = V, s = v?.state;
  if (!s) return;
  let head = "The coach's choices", html = "";
  const listHtml = (r, st, seat, mineMove) => {
    const rows = r.list.slice(0, 8).map((c, i) => {
      const you = mineMove && sameMove(c.move, mineMove);
      const figs = c.move.t === "fold" ? "what folding comes to" : `${gain(c.mean)} (±${near(c.se)}) beyond folding · wins the pot ${pc(c.won)}${c.alone >= 0.01 ? ` · everyone folds ${pc(c.alone)}` : ""}`;
      return `<li class="${i === 0 ? "best" : ""}${you ? " mine" : ""}"><b>${esc(moveSaid(c.move, st, seat))}</b>${i === 0 ? " · the coach's choice" : you ? " · yours" : ""}<span class="hd-fig">${esc(figs)}${c.n ? ` · ${c.n} deals` : ""}</span></li>`;
    }).join("");
    const yours = mineMove && !r.list.slice(0, 8).some(c => sameMove(c.move, mineMove)) ? r.list.find(c => sameMove(c.move, mineMove)) : null;
    const extra = yours ? `<li class="mine"><b>${esc(moveSaid(yours.move, st, seat))}</b> · yours<span class="hd-fig">${esc(`${gain(yours.mean)} (±${near(yours.se)}) beyond folding`)} · ${yours.n} deals</span></li>` : "";
    return `<ol class="hd-choices">${rows}${extra}</ol><p class="hd-why-note">Each move played to the end of the hand in the same ${r.deals} deals of the cards you can't see (the others' drawn from the hands their betting shows), every seat by Medium's rules, the house's commission taken; the figure is the chips it comes to beyond folding, on average.</p>`;
  };
  if (which === "review") {
    head = "Your play this hand";
    const differs = notes.filter(n => !n.agreed).sort((a, b) => b.gap - a.gap);
    html = `<p>The coach agreed with ${notes.length - differs.length} of your ${notes.length} moves. Where it would have played otherwise, the costliest first:</p><ol class="hd-review">${differs.slice(0, 3).map(n => `<li>${esc(n.words)}</li>`).join("")}</ol>`;
  } else if (word && which !== "hint" && !(mine() && (hinted?.key === decisionOf(v) || opts.coach === "on"))) {
    head = "Your last move";
    html = `<p>${esc(word.words)}</p>${listHtml(word.r, word.state, word.state.turn, word.mine)}`;
  } else {
    const a = hinted?.key === decisionOf(v) ? { r: hinted.r, state: s, seat: v.seat } : advice;
    if (!a) return;
    html = listHtml(a.r, a.state, a.seat, null);
  }
  $("whyHead").textContent = head;
  $("whyBody").innerHTML = html;
  if (!$("whyDlg").open) $("whyDlg").showModal();
}
$("coach").addEventListener("click", e => {
  if (e.target.closest("[data-act=hint]")) { if (mine()) hint(); return; }
  // the line itself opens Why? too: a long word is clamped, and its link may be cut off with the end of it
  const b = e.target.closest(".hd-why") || e.target.closest(".hd-says")?.querySelector(".hd-why");
  if (b) showWhy(b.dataset.why === "review" ? "review" : hinted?.key === (V?.G && decisionOf(V)) ? "hint" : "");
});
$("whyClose").addEventListener("click", () => $("whyDlg").close());

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, won = s.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  const best = read(BEST, null);
  if (s.nets[v.seat] > 0 && (typeof best !== "number" || s.nets[v.seat] > best)) write(BEST, s.nets[v.seat]);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1400);
}
function showEnd(v) {
  const s = v.state, order = Array.from({ length: s.seats }, (_, i) => i).sort((a, b) => s.nets[b] - s.nets[a]);
  $("endHead").textContent = s.winners.includes(v.seat) ? (s.winners.length > 1 ? "You share the win" : "You win") : `${s.winners.map(who).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`;
  const detail = i => `won ${s.wins[i]} of ${s.opts.hands}${s.buys[i] > 1 ? `, bought in ${s.buys[i] - 1}× again` : ""}`;
  $("endBody").innerHTML = `<ol class="hd-standings">${order.map(i => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(who(i))}</span><span class="hd-small">${detail(i)}</span><b class="${s.nets[i] > 0 ? "up" : s.nets[i] < 0 ? "down" : ""}">${signed(s.nets[i])}</b></li>`).join("")}</ol>
    <p class="hd-end-note">${s.opts.hands} hands from HK$${fmt(STACK)} each. A result is chips less every buy-in${s.house ? `; the house took HK$${fmt(s.house)} in commission` : ""}.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal(gameOptions(), opts.seats);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml(opts);
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}

// the course (Learn): its last step is a game of ten hands against Easy players, which it sets up and keeps as the menu's choice
const course = createCourse({
  id: "holdem", course: COURSE, stage: holdemStage(), cls: "hd", inFrame: IN_FRAME, onRules: showRules,
  onPlay: () => {
    if (!page.host) { toast("Only the host starts a game"); return; }
    opts.level = "easy";
    opts.hands = 10;
    saveOpts();
    newGame();
    toast("Ten hands against Easy players: the menu changes both", 3600);
  },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  const cp = progressOf("holdem", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Hold'em, from the rules", () => course.open()));
  page.menu(play);
  play.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(choice("Coach", COACH, opts.coach, v => { opts.coach = v; keep(); word = null; hinted = null; draw(); }));
  set.append(choice("A game is", HANDS.map(n => [n, `${n} hands`]), opts.hands, v => { opts.hands = Number(v); keep(); }));
  set.append(choice("House commission", RAKES.map(n => [n, n ? `${n}%` : "None"]), opts.rake, v => { opts.rake = Number(v); keep(); }));
  set.append(choice("Seats at the table", [2, 3, 4, 5, 6].map(n => [n, String(n)]), opts.seats, v => { opts.seats = Number(v); keep(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; keep(); }));
  set.append(line("The length, commission and seats apply from the next game."));
  set.append(toggle("Odds line", opts.odds, on => { opts.odds = on; keep(); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; keep(); }));
  const r = read(RECORD, { played: 0, won: 0 }), best = read(BEST, null);
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${typeof best === "number" ? `; best result +${fmt(best)}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "holdem");
document.querySelector(".hd-mark").innerHTML = APPS.find(a => a.id === "holdem")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__holdem = { page, get view() { return V; }, opts, course };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
