// Solitaire: Klondike (draw one or three), FreeCell and Spider (one, two or four suits), each with a deal of the day.
// The rules are solitaire-engine.js's, the deals and hints solitaire-solver.js's (searched in solitaire-worker.js), the
// table solitaire-board.js's (drawn and touched). This file keeps the game in play, the clock and the records.
//
// A game in play is its deal (variant, key, try: the cards are shuffled from them, the same on every device) and the list
// of moves made (packed numbers), so undo is "play the list again without the last move" and a save is a few hundred
// numbers. A game of each variant is kept, so changing variant in the header leaves the others where they were.
import * as E from "./solitaire-engine.js";
import { createBoard } from "./solitaire-board.js";
import { COURSE, boardStage } from "./solitaire-course.js";
import { createCourse, progressOf } from "./course.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, toggle, action, line, mirror, onPause, isPaused } from "./menu.js";
import { statsOf as statsIn, addStats as addIn, totalWins, life } from "./solitaire-record.js";
import { today, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { busy, progress } from "./loading.js";
import { sure } from "./sure.js";
import * as sound from "./solitaire-sound.js";
import { defaultIs3D } from "./mode3d.js";

const $ = id => document.getElementById(id);
const PREFS = "solitaire:prefs", TIMES = "solitaire:times", DAILIES = "solitaire:dailies", DEALS = "solitaire:deals", SPARES = "solitaire:spares", STATS = "solitaire:stats", WINS = "solitaire:wins";
const GAME = id => `solitaire:game:${id}`;
const SAVE_EVERY = 5000;             // ms between saves of a clock running (a partner watching sees it that often)
// A game counts as played with the player's first move (Korbi, 3 Nov 2026: an abandoned game is a loss): leaving it,
// dealing again or closing the app leaves it a loss, and winning it makes it a win. solitaire-record.js has the rule.
const KEEP_DEALS = 40, KEEP_DAYS = 10;

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (!IN_FRAME) try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomKey = () => 1 + Math.floor(Math.random() * 2 ** 31);
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Milliseconds as 1:05 (or 1:02:05). */
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isAuto = x => !!(x & (1 << 19));

// ---------- what you chose ----------
const prefs = { variant: "klondike1", mode: "random", auto: true, four: false, ...read(PREFS, {}) };
if (!E.VARIANTS[prefs.variant]) prefs.variant = "klondike1";
if (prefs.mode !== "daily") prefs.mode = "random";
const savePrefs = () => write(PREFS, prefs);
// prefs.view ("3d" or "flat"), .tilt and .yaw (degrees) are written only when the player picks one; with none the suite's
// 2D/3D default (mode3d.js, the main menu's battery saver) decides, so it must never be written in for them.
// prefs.sound is off only when the player turned it off.
sound.setOn(!IN_FRAME && prefs.sound !== false);
sound.unlock();

// ---------- looking for deals and moves ----------
// Off the page, in a worker: a two-suit Spider deal can take a few seconds on a phone. A spare random deal of the game in
// play is looked for in the background (a second worker), so the next New deal is instant. Where there is no worker the
// page does it, as the other puzzles' do.
const workers = {}, waiting = new Map();
let workerless = false, asked = 0;
function ask(msg, { lane = "main", onTried = null } = {}) {
  const inline = async () => (await import("./solitaire-solver.js")).answer(msg, onTried);
  if (workerless) return lane === "main" ? inline() : Promise.resolve(null);
  try {
    if (!workers[lane]) {
      const w = workers[lane] = new Worker(new URL("./solitaire-worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => {
        const p = waiting.get(e.data.id);
        if (!p) return;
        if ("tried" in e.data) p.onTried?.(e.data.tried);
        else { waiting.delete(e.data.id); p.resolve(e.data.result); }
      };
      w.onerror = () => {
        workerless = true;
        for (const w2 of Object.values(workers)) w2.terminate();
        for (const [id, p] of [...waiting]) { waiting.delete(id); p.fallback(); }
      };
    }
  } catch { workerless = true; return lane === "main" ? inline() : Promise.resolve(null); }
  const id = ++asked;
  return new Promise(resolve => {
    waiting.set(id, { resolve, onTried, fallback: () => (lane === "main" ? inline().then(resolve) : resolve(null)) });
    workers[lane].postMessage({ ...msg, id });
  });
}
const dealName = (id, key) => `${id}:${key}`;
function triedFor(id, key) { const t = read(DEALS, {})[dealName(id, key)]; return Number.isInteger(t) ? t : null; }
function keepTried(id, key, t) {
  const all = read(DEALS, {});
  all[dealName(id, key)] = t;
  const names = Object.keys(all);
  for (const old of names.slice(0, Math.max(0, names.length - KEEP_DEALS))) delete all[old];
  write(DEALS, all);
}
function takeSpare(id) {
  const all = read(SPARES, {}), sp = all[id];
  if (!Number.isInteger(sp?.key) || !Number.isInteger(sp?.tryNo)) return null;
  delete all[id];
  write(SPARES, all);
  return sp;
}
let refilling = false;
async function refill(id) {
  if (IN_FRAME || refilling || workerless || !E.CHECKED(id)) return;
  refilling = true;
  try {
    const day = today();
    if (prefs.mode === "daily" && triedFor(id, day) == null) {         // today's deal, searched ahead of the tap that asks for it
      const r = await ask({ op: "deal", variant: id, key: day }, { lane: "spare" });
      if (r?.certified) keepTried(id, day, r.tryNo);
    }
    if (!read(SPARES, {})[id]) {
      const key = randomKey(), r = await ask({ op: "deal", variant: id, key }, { lane: "spare" });
      if (r?.certified) { const all = read(SPARES, {}); all[id] = { key, tryNo: r.tryNo }; write(SPARES, all); }
    }
  } finally { refilling = false; }
}

// ---------- the game in play ----------
// S: { v, id, mode ("random" | "daily"), key, tryNo, certified, log (packed moves), redo (groups of them undone), ms, hints,
//      done ({ ms, moves, hints } once won), counted (its first move went into played), scored (its win into wins) }
let S = null, G = null, ORDER = null;
let plan = null, planAt = 0, hintMove = null, rev = 0, thinking = false, autoToken = 0, flashing = null;
let clockFrom = null, savedAt = 0, said = "";

const V = () => E.VARIANTS[S.id];
const validGame = s => !!s && s.v === 1 && !!E.VARIANTS[s.id] && Number.isInteger(s.key) && Number.isInteger(s.tryNo) && Array.isArray(s.log) && s.log.every(Number.isInteger) && Number.isFinite(s.ms);
const movesOf = s => s.log.filter(x => !isAuto(x)).length;
const started = () => !!S && !S.done && !!S.counted;
const statsOf = id => statsIn(read(STATS, {}), read(TIMES, {}), id);
function addStats(id, delta) {
  if (!delta) return;
  const all = addIn(read(STATS, {}), read(TIMES, {}), id, delta.played, delta.wins);
  write(STATS, all);
  write(WINS, totalWins(all, read(TIMES, {}), E.IDS));      // what the games screen's tile shows
}
/** A deal already won today is practice: it is not counted either way. */
const practice = () => S.mode === "daily" && !!read(DAILIES, {})[S.key]?.[S.id];
function save() {
  if (IN_FRAME || !S) return;
  write(GAME(S.id), S);
  savedAt = performance.now();
}

/** Puts a game on the table. */
function begin(s, fresh = false) {
  autoToken++; rev++;
  S = { v: 1, certified: E.CHECKED(s.id), redo: [], ms: 0, hints: 0, done: null, ...s };
  ORDER = E.shuffled(S.id, S.key, S.tryNo);
  const r = E.replay(S.id, ORDER, S.log);
  G = r.s;
  if (r.done < S.log.length) S.log.length = r.done;                // a save that isn't this game's rules: as far as it goes
  plan = null; hintMove = null; clockFrom = null; said = "";
  prefs.variant = S.id;
  savePrefs();
  $("variant").value = S.id;
  $("table").classList.remove("won");
  say(!prefs.seen && !IN_FRAME && !S.log.length ? "Tap a card to send it where it goes, or drag it. Tap the stock for more cards." : "");
  if (fresh) { sound.shuffle(); sound.dealing(7, 0.07, 0.7); }
  draw(true, fresh);
  save();
  if (S.done) { $("verdict").textContent = verdict(); }
  clockRun();
}

/** A new deal of a variant: today's, or a random one (the spare if there is one). */
async function deal(mode, id = prefs.variant) {
  let key, tryNo = null, certified = E.CHECKED(id);
  if (mode === "daily") key = today();
  else { const sp = takeSpare(id); if (sp) { key = sp.key; tryNo = sp.tryNo; } else key = randomKey(); }
  if (tryNo == null) tryNo = triedFor(id, key);
  if (tryNo == null) {
    tryNo = 0;
    if (certified) {
      const done = busy(`Dealing ${E.titleOf(id)}`, { delay: 250 });
      try {
        const r = await ask({ op: "deal", variant: id, key }, { onTried: t => progress("Looking for a deal you can win", Math.min(0.9, (t + 1) / 12)) });
        tryNo = r.tryNo; certified = r.certified;
      } finally { done(); }
    }
    if (certified) keepTried(id, key, tryNo);
  }
  begin({ id, mode, key, tryNo, certified, log: [] }, true);
  if (mode === "random") setTimeout(() => refill(id), 700);
}
/** New deal: asks first when a game well under way would be given up (it ends the streak). */
async function newDeal(mode) {
  if (S && !S.done && S.mode === "daily" && mode === "daily" && S.key === today() && S.id === prefs.variant) { restart(); return; }
  if (started()) {
    if (!(await sure("Leave this game? It counts as a loss.", { yes: "New deal", no: "Keep playing" }))) return;
  }
  await deal(mode);
}
async function restart() {
  if (!S) return;
  if (started() && !(await sure("Start this deal again? The game so far counts as a loss.", { yes: "Start again", no: "Keep playing" }))) return;
  begin({ ...S, log: [], redo: [], ms: 0, hints: 0, done: null, counted: false }, true);
}
async function switchTo(id) {
  if (S && id === S.id) return;
  const kept = read(GAME(id), null);
  if (validGame(kept) && !kept.done) { begin(kept); return; }
  await deal(prefs.mode === "daily" && !(read(DAILIES, {})[today()] || {})[id] ? "daily" : "random", id);
}

// ---------- playing ----------
/** Makes a move. auto: one the game made on its own (it undoes with the move before). → whether it was made. */
function commit(m, auto = false) {
  const why = E.whyNot(G, m);
  if (why) { say(why, "bad"); return false; }
  if (!auto) {
    autoToken++; S.redo = []; say("");
    if (!prefs.seen) { prefs.seen = true; savePrefs(); }
    if (!IN_FRAME) addStats(S.id, life(S, practice()).first());      // a loss until it is won
  }
  const runs = G.runs.length;
  E.applyMut(G, m);
  S.log.push(E.pack(m, auto));
  rev++;
  sayMove(m, G.runs.length > runs);
  if (plan) { if (plan[planAt] && E.sameMove(plan[planAt], m)) planAt++; else plan = null; }
  hintMove = null;
  if (!auto) clockRun();
  save();
  draw();
  return true;
}
/** After a move of the player's: the game won, or the cards that go up of themselves going up (a setting). */
async function settle() {
  const my = ++autoToken;
  if (E.won(G)) { win(); return; }
  if (!prefs.auto || V().game === "spider") return;
  for (let n = 0; ; n++) {
    const m = E.autoStep(G, "safe");
    if (!m) return;
    await sleep(Math.max(35, 110 - n * 8));
    if (my !== autoToken) return;
    commit(m, true);
    if (E.won(G)) { win(); return; }
  }
}
function play(m) { if (commit(m)) settle(); }
/** The sound of a move: a card to a foundation (or a run leaving Spider's table) thunks, the stock turns with a snap, any other flicks. */
function sayMove(m, runOff = false) {
  const f = E.kindOf(m.f), t = E.kindOf(m.t);
  if (t === E.FND || runOff) { sound.flick(0.55); setTimeout(() => sound.thunk(), 55); }
  else if (f === E.STK) { if (V().game === "spider") sound.dealing(10, 0.04); else sound.snap(); }
  else sound.flick();
}

/** A tap: the stock turns; a card goes where it goes best; one that can't says why. */
function tapped(spot) {
  if (!S || S.done || thinking) return;
  const { kind, place, n } = spot;
  if (kind === "stock") {
    const m = E.stockMove(G);
    if (m) play(m); else say(V().game === "klondike" ? "The stock and the waste are both empty." : "The stock is empty.", "bad");
    return;
  }
  if (kind === "stuck") { say(E.whyNot(G, { f: place, t: place, n }), "bad"); flash(E.cardsAt(G, place, n)); return; }
  const m = E.bestMove(G, place, n);
  if (m) play(m);
  else { say(n > 1 ? "That run has nowhere to go." : "That card has nowhere to go.", "bad"); flash(E.cardsAt(G, place, n)); }
}
function flash(uids) {
  if (!uids) return;
  flashing = new Set(uids);
  draw();
  setTimeout(() => { flashing = null; draw(); }, 380);
}

/** The game is won: counted once (a second go at a day's deal already won is practice), and the table celebrates. */
function win() {
  clockPause();
  S.done = { ms: Math.round(S.ms), moves: movesOf(S), hints: S.hints };
  const days = read(DAILIES, {}), replay = S.mode === "daily" && !!days[S.key]?.[S.id];
  if (!IN_FRAME && !replay && S.counted && !S.scored) {
    addStats(S.id, life(S, false).won());
    const times = read(TIMES, {}), t = times[S.id] || { best: null };
    if (!S.hints && (t.best == null || S.done.ms < t.best)) t.best = S.done.ms;
    times[S.id] = t;
    write(TIMES, times);
    if (S.mode === "daily") {
      days[S.key] = { ...days[S.key], [S.id]: S.done.ms };
      for (const old of Object.keys(days).sort().slice(0, -KEEP_DAYS)) delete days[old];
      write(DAILIES, days);
    }
  }
  save();
  $("verdict").textContent = verdict(replay);
  $("table").classList.add("won");
  $("table").querySelectorAll(".cd").forEach((e, i) => e.style.setProperty("--n", i % 52));
  draw();
  roundOver("solitaire");
}
function verdict(replay = false) {
  const d = S.done, t = read(TIMES, {})[S.id];
  const best = !S.hints && t?.best === d.ms && statsOf(S.id).wins > 1 ? " A best time." : "";
  return `Won in ${fmt(d.ms)}, ${plural(d.moves, "move")}${d.hints ? `, ${plural(d.hints, "hint")}` : ""}.${best}${replay ? " Today's deal again: not counted." : ""}`;
}

function undo() {
  if (!S || S.done || !S.log.length || thinking) return;
  autoToken++; rev++;
  const group = [];
  while (S.log.length && isAuto(S.log.at(-1))) group.unshift(S.log.pop());
  if (S.log.length) group.unshift(S.log.pop());
  S.redo.push(group);
  G = E.replay(S.id, ORDER, S.log).s;
  plan = null; hintMove = null;
  say("");
  sound.flick(0.5);
  save();
  draw();
}
function redo() {
  if (!S || S.done || !S.redo.length || thinking) return;
  autoToken++; rev++;
  const group = S.redo.pop();
  for (const x of group) {
    const m = E.unpack(x);
    if (E.whyNot(G, m)) { S.redo = []; break; }
    E.applyMut(G, m);
    S.log.push(x);
  }
  plan = null; hintMove = null;
  sound.flick(0.5);
  save();
  draw();
  if (E.won(G)) win();
}

// ---------- hints ----------
/** Every card face up and nothing in the way: the rest is the cards going up, and the game can do it. */
function canFinish() {
  if (!S || S.done || V().game === "spider" || G.down.some(d => d > 0)) return false;
  const t = E.cloneGame(G);
  let n = 0;
  for (let m; (m = E.autoStep(t, "all")); n++) E.applyMut(t, m);
  return n > 0 && E.won(t);
}
async function finishUp() {
  const my = ++autoToken;
  for (let n = 0; ; n++) {
    const m = E.autoStep(G, "all");
    if (!m) break;
    await sleep(Math.max(30, 90 - n * 5));
    if (my !== autoToken) return;
    commit(m, true);
  }
  if (E.won(G)) win();
}
async function hint() {
  if (!S || S.done || thinking) return;
  if (canFinish()) { finishUp(); return; }
  hintMove = null;
  if (!plan || planAt >= plan.length) {
    const my = rev, done = busy("Looking for a move", { delay: 350 });
    thinking = true;
    say("Looking for a move…");
    draw();
    let r = null;
    try { r = await ask({ op: "hint", game: G }); } finally { done(); thinking = false; }
    if (my !== rev) { draw(); return; }                                 // the game moved on while it looked
    if (r?.line?.length) { plan = r.line.map(E.unpack); planAt = 0; }
    else {
      const part = r?.hint?.length ? E.unpack(r.hint[0]) : null;
      hintMove = part;
      say(`${r?.full ? "I can't find a win from here in the time I have" : "I can't find a win from here"}. ${part ? `This may help: ${E.sayMove(G, part).toLowerCase()} ` : ""}Undo to go back.`, "bad");
      draw();
      return;
    }
  }
  hintMove = plan[planAt];
  S.hints++;
  say(E.sayMove(G, hintMove));
  save();
  draw();
}

// ---------- the clock ----------
const elapsed = () => (S ? S.ms + (clockFrom != null ? performance.now() - clockFrom : 0) : 0);
function clockRun() {
  if (IN_FRAME || !S || S.done || clockFrom != null || !S.log.length || isPaused() || document.hidden) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => clockPause(), () => clockRun());

// ---------- drawing ----------
const board = createBoard($("table"), {
  fourColour: prefs.four, readonly: IN_FRAME,
  onTap: tapped, onMove: play, onReject: text => say(text, "bad"),
});

// ---------- the table in 3D ----------
// The 3D view (solitaire-3d.js, three.js) is loaded only when it is wanted; where there is no WebGL, or the GL context is lost,
// the flat table stays or comes back. A watching frame is always flat.
const ANGLED = 38;
let failed3d = false, viewing = 0;
const wants3D = () => !IN_FRAME && !failed3d && (prefs.view ? prefs.view === "3d" : defaultIs3D());
const tiltNow = () => (typeof prefs.tilt === "number" ? prefs.tilt : ANGLED);
async function applyView() {
  const my = ++viewing, want = wants3D();
  if (want && !board.view) {
    try {
      const m = await import("./solitaire-3d.js");
      if (my !== viewing || board.view) return;
      const v = m.createView($("table"), {
        onCamera: (tilt, yaw) => { prefs.tilt = Math.round(tilt); prefs.yaw = Math.round(yaw); savePrefs(); showTilt(); },
        onLost: () => { failed3d = true; applyView(); },
      });
      v.setCamera(tiltNow(), prefs.yaw || 0, false);
      board.setView(v);
    } catch (err) { console.warn("Solitaire: no 3D here.", err); failed3d = true; }
  } else if (!want && board.view) {
    const v = board.view;
    board.setView(null);
    v.dispose();
  }
  showTilt();
}
function showTilt() {
  const b = $("tiltBtn"), v = board.view;
  b.hidden = !v;
  if (!v) return;
  const { tilt } = v.camera();
  b.textContent = tilt < 1 ? "Top" : Math.abs(tilt - ANGLED) < 1 ? "Angled" : "Tilted";
}
$("tiltBtn").addEventListener("click", () => { board.view?.preset(); showTilt(); });
addEventListener("settings:flat", () => { if (!prefs.view) applyView(); });
onPause(() => board.view?.hold(true), () => board.view?.hold(false));
function say(text, kind = "") {
  said = text;
  const el = $("line");
  el.textContent = text;
  el.className = `so-say${kind ? ` ${kind}` : ""}`;
}
function draw(instant = false, deal = false) {
  if (!S) return;
  board.render(G, { hint: hintMove, bad: flashing, instant, deal });
  const done = !!S.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  $("moves").textContent = movesOf(S);
  $("kind").textContent = `${S.mode === "daily" ? "Today's deal" : "Random deal"}${S.certified ? "" : " · uncertified"}`;
  $("undoBtn").disabled = !S.log.length || thinking;
  $("redoBtn").disabled = !S.redo.length || thinking;
  const fin = canFinish();
  $("hintBtn").querySelector("b").textContent = fin ? "Finish" : "Hint";
  $("hintBtn").querySelector("small").textContent = fin ? "the rest goes up" : "a move that wins";
  $("hintBtn").disabled = thinking;
  drawTime();
  if (!said && !done && !E.moves(G).length) say("No moves left. Undo, or start a new deal.", "bad");
}
function drawTime() { if (S) $("time").textContent = fmt(elapsed()); }

// ---------- the rules ----------
const RULES = {
  klondike: `<h4>Klondike</h4>
    <p>Seven columns of 1 to 7 cards, the top card of each face up. Build a column down in alternating colours (a red 6 on a black 7); a run of face-up cards moves together. Only a king goes into an empty column.</p>
    <p>Turn cards from the stock (one at a time, or three) onto the waste; its top card is in play. When the stock is gone, turn the waste over to make it again, as often as you like.</p>
    <p>The four foundations are built up from the ace, one suit each. Win with all 52 cards up. A card on a foundation may come back down to a column.</p>`,
  freecell: `<h4>FreeCell</h4>
    <p>Eight columns, every card face up. Build a column down in alternating colours; any card may go into an empty column. The four free cells hold one card each, for as long as you need.</p>
    <p>A run moves one card at a time through the free cells and empty columns: with two free cells and one empty column you can carry six at once. The game works it out and says when you ask for too many.</p>
    <p>The four foundations are built up from the ace, one suit each. Win with all 52 up. A card on a foundation stays there.</p>`,
  spider: `<h4>Spider</h4>
    <p>Ten columns: four of six cards and six of five, the top card of each face up. Any card goes on a card one rank higher, in any suit; any card may go into an empty column. Only a run of one suit, each card a rank below the last, moves together.</p>
    <p>When no column is empty, deal a row from the stock: one card face up on each column. A run from king down to ace in one suit leaves the table; clear all eight runs to win. There are one, two or four suits: with fewer, the same 104 cards are spades (and hearts) over and over.</p>`,
};
function showRules() {
  const g = prefs.variant.replace(/\d$/, "");
  $("rulesBody").innerHTML = `${RULES[g]}<h4>The deals</h4>
    <p>The card is dealt from the day's number, the same for everyone. Every deal but four-suit Spider's has been searched by the game's solver and can be won (a two-suit deal the solver can't crack within its budget is dealt as it falls, and called uncertified). Four-suit Spider is uncertified: some deals cannot be won. A hint is that solver's next move. Undo is unlimited; the clock starts with your first move.</p>
    <h4>The count</h4><p>A game is played from your first move and is a loss unless you win it: leaving it, dealing again or closing the app leaves it a loss, and a game you come back to and win is one win. Hints don't count against you, but a best time needs none. A day's deal counts once.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play"), content = part(body, "content"), settings = part(body, "settings"), about = part(body, "about");
  play.append(action(prefs.mode === "daily" ? "Today's deal" : "New deal", () => newDeal(prefs.mode), "primary"));
  if (S && S.log.length && !S.done) play.append(action("Start this deal again", restart));
  play.append(action("Learn Solitaire", () => course.open()), action("The rules", showRules, "link"));
  content.append(mirror("Game", $("variant")));
  content.append(choice("Deal", [["random", "Random"], ["daily", "Today's"]], prefs.mode, v => { prefs.mode = v; savePrefs(); openMenu(); }));
  const days = read(DAILIES, {})[today()] || {};
  if (prefs.mode === "daily") content.append(line(E.IDS.filter(id => days[id] != null).length ? `Won today: ${E.IDS.filter(id => days[id] != null).map(id => `${E.titleOf(id)} ${fmt(days[id])}`).join(", ")}.` : "Today's deal is the same for everyone."));
  settings.append(toggle("Move cards up by themselves", prefs.auto, on => { prefs.auto = on; savePrefs(); }));
  settings.append(toggle("Four-colour suits", prefs.four, on => { prefs.four = on; savePrefs(); board.setFourColour(on); }));
  if (!IN_FRAME) {
    settings.append(choice("Table", [["3d", "3D"], ["flat", "Flat"]], wants3D() ? "3d" : "flat", v => { prefs.view = v; failed3d = false; savePrefs(); applyView().then(openMenu); }));
    if (board.view) settings.append(choice("Camera", [["top", "Top"], ["angled", "Angled"]], board.view.camera().tilt < ANGLED / 2 ? "top" : "angled", v => { board.view.setCamera(v === "top" ? 0 : ANGLED, 0); board.view.commit(); showTilt(); }));
    else if (failed3d) settings.append(line("This browser can't draw 3D."));
    settings.append(toggle("Sound", prefs.sound !== false, on => { prefs.sound = on; savePrefs(); sound.setOn(on); if (on) sound.flick(); }));
  }
  const st = statsOf(prefs.variant), t = read(TIMES, {})[prefs.variant];
  about.append(line(st.played ? `${E.titleOf(prefs.variant)}: ${st.wins} won of ${st.played} played${t?.best != null ? `, best ${fmt(t.best)}` : ""}.` : `${E.titleOf(prefs.variant)}: nothing played yet.`));
  if (!E.CHECKED(prefs.variant)) about.append(line("Uncertified: some deals cannot be won."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the course ----------
const stage = boardStage();
const course = createCourse({ id: "solitaire", course: COURSE, cls: "so", inFrame: IN_FRAME, onRules: showRules, stage });

// ---------- wiring ----------
dropdown($("variant"));
bindSwitcher($("appsBtn"), "solitaire");
document.querySelector(".so-mark").innerHTML = APPS.find(a => a.id === "solitaire")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => deal(S?.mode === "daily" ? "random" : prefs.mode));
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", hint);
$("variant").addEventListener("change", () => switchTo($("variant").value));
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else clockRun(); });
addEventListener("pagehide", () => clockPause());
setInterval(() => {
  drawTime();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__solitaire = {
  get state() { return S; }, get game() { return G; }, get plan() { return plan; }, get next() { return plan?.[planAt] ?? null; }, board, stage, prefs, course, play, undo, redo, hint, deal, tapped, switchTo, canFinish,
  progressOf: () => progressOf("solitaire", COURSE),
};

async function startUp() {
  applyView();
  const kept = read(GAME(prefs.variant), null);
  if (validGame(kept)) begin(kept);
  else if (!IN_FRAME) await deal(prefs.mode === "daily" ? "daily" : "random");
  if (!IN_FRAME && S) setTimeout(() => refill(S.id), 1500);
}
startUp();
