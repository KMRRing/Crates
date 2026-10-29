// Dandan: the communal-deck game of Forgetful Fish, played against the computer or a friend at a table. The rules are
// dandan-engine.js's, the cards dandan-cards.js's and dandan-spells.js's, the computer players dandan-bot.js's (Hard's
// look-ahead, dandan-think.js, runs in dandan-worker.js so the table never stops while it thinks), the coach's words
// dandan-coach.js's, the running seats.js's (solo, or a table through seats-ui.js). This page draws the table: the
// other player's side across the top, the library, the turn and the graveyard between, yours below, under it the card
// read (with the stack and any question) beside the log, then your hand, the coach's line and the buttons. A card is
// read by pointing at it or tapping it; what it can do now is a button, and a spell that needs a target lights the
// legal ones on the table.
import { rules } from "./dandan-rules.js";
import { LEVEL_NAMES } from "./dandan-bot.js";
import { moves, afterFetch, bottomFor, payment, MOST_MULLS } from "./dandan-engine.js";
import { think, BUDGET } from "./dandan-think.js";
import { adviceLine, verdict, moveSaid, sameMove, whyNote, reasons, evidence, forgetKnown } from "./dandan-coach.js";
import { CARDS, DECK, HALVES, NAMES, BASICS, costWords, total, parseCost } from "./dandan-cards.js";
import { nm, defOf, perm, pt, isLand, isCreature, manaAlts, payFrom, topKnown, needType, poolOf, knownIn, knOf, typesOf } from "./dandan-core.js";
import { same } from "./dandan-spells.js";
import { seatPage, fillNames } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sextant } from "./loading.js";
import { createTable3d } from "./dandan-3d.js";
import { curveOf, worthDrawing, captionOf, readoutOf, chartSvg, pointAt, BOX, addResult, recordOf, emptyRecord } from "./dandan-advantage.js";
import { noteDecision, emptyReview, reviewHtml } from "./dandan-review.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "dandan:opts", RECORD = "dandan:record", STREAK = "dandan:streak", REVIEW = "dandan:review";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// the coach: off; hints, when you ask; check, each move of yours weighed the moment it's made, and a word on one it
// would have made otherwise, with no Hint (22 October 2026: the decision is yours, then set against its); always, its
// move at each of your decisions, ringed on the table
const COACH = [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"], ["review", "Review"]];
// how long Hard and the coach think over a move (dandan-think.js's DEPTH, coachBudget), with what that takes on a phone
const THINKING = [["quick", "Quick"], ["long", "Long"], ["deep", "Deep"], ["deepest", "Deepest"]];
const THINK_TIME = {
  quick: "on a phone, under a second a move as a rule.", long: "on a phone, a second or two a move; up to ten.",
  deep: "on a phone, several seconds a move; up to forty.", deepest: "on a phone, half a minute a move; up to two minutes.",
};
// the computer's pace: how long what it does stays on the table before its next move, or until you tap
const PACES = [["quick", "Quick"], ["steady", "1.5 s"], ["slow", "3 s"], ["tap", "Tap to continue"]];
const SHOWN_MS = { steady: 1500, slow: 3000 };
// the table as tiles, or as a battlefield seen at an angle, its cards illustrated and moving (dandan-3d.js)
const VIEWS = [["table", "Table"], ["3d", "3D"]];
let opts = { level: "hard", hold: false, manual: false, reveals: true, coach: "hints", think: "quick", pace: "quick", full: true, view: "table", ...read(OPTS, {}) };
// Show revealed cards (Menu): off, nothing marks what you have seen of the other hand or of the library (the cards known
// there, the top card when it is known), and the coach stops naming them: you have to remember
const sees = () => opts.reveals !== false;
forgetKnown(!sees());
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "hard";
if (!COACH.some(([k]) => k === opts.coach)) opts.coach = "hints";
if (!THINKING.some(([k]) => k === opts.think)) opts.think = "quick";
if (!PACES.some(([k]) => k === opts.pace)) opts.pace = "quick";
if (!VIEWS.some(([k]) => k === opts.view)) opts.view = "table";
let table3d = null;                                // the 3D view, once the page is wired (the foot of this file)
const in3d = () => opts.view === "3d" && !!table3d;
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- words ----------
/** A card's name short enough for a small card; the full name is on its detail and in the log. */
const SHORT = {
  "Narset's Reversal": "Reversal", "Izzet Boilerworks": "Izzet", "Mystic Sanctuary": "Sanctuary", "Mystic Retrieval": "Retrieval",
  "Lórien Revealed": "Lórien", "Halimar Depths": "Halimar", "Thundering Falls": "Falls", "Lonely Sandbar": "Sandbar", "Chart a Course": "Chart",
  "Deem Inferior": "Deem", "Take Inventory": "Inventory", "Gone Missing": "Missing", "Memory Lapse": "Lapse", "Piracy Charm": "Charm",
  "Commit // Memory": "Commit", "Flood Plain": "Flood Plain", "Remote Isle": "Remote Isle",
};
/** Where a long name may break on a small card (a soft hyphen shows only when the line does break). */
const SOFT = { Brainstorm: "Brain­storm", Inventory: "Inven­tory", Sanctuary: "Sanc­tuary", Retrieval: "Retrie­val", Reversal: "Rever­sal", Missing: "Miss­ing", Repulse: "Re­pulse", Halimar: "Hali­mar", Sandbar: "Sand­bar" };
const short = name => SHORT[name] || name;
const LAND_CODE = { "Flood Plain": "Fld", "Halimar Depths": "Hal", "Izzet Boilerworks": "Izz", "Lonely Sandbar": "Sbr", "Mystic Sanctuary": "Sct", "Remote Isle": "Rem", "Thundering Falls": "Fls" };
const STEP_WORDS = { upkeep: "upkeep", draw: "draw", main1: "main phase", attackers: "attack", blockers: "blocks", damage: "combat", main2: "second main", end: "end step" };
const MODE_WORDS = ["Islandwalk", "+2/−1", "Discard"];
const STACK_WORDS = { "@fetch": "Flood Plain’s search", "@isle": "Islandcycling", "@cycle": "Cycling", "@clue": "Clue", "@dandan": "Dandân sacrificed",
  "@depths": "Halimar Depths", "@falls": "Thundering Falls", "@boil": "Izzet Boilerworks", "@sanct": "Mystic Sanctuary" };
const TYPE_WORDS = { land: "Land", creature: "Creature", instant: "Instant", sorcery: "Sorcery", token: "Token" };
const TYPE_ORDER = { land: 0, creature: 1, instant: 2, sorcery: 3 };

/** A cost as mana pips: generic in grey, blue and red in their colours. */
function pips(cost) {
  const out = [...String(cost || "").matchAll(/\{(\w)\}/g)].map(([, x]) => `<i class="dd-pip ${/\d/.test(x) ? "g" : x}">${x}</i>`).join("");
  return out ? `<span class="dd-pips" aria-label="cost ${esc(costWords(cost))}">${out}</span>` : "";
}

let V = null;                                      // the view on screen
let page = null;                                   // set once the runner is up
const S = () => V?.state;
const nameOf = seat => V?.seats?.[seat]?.name ?? (seat === 0 ? "You" : "Gill");
const isMe = seat => V?.seat != null && seat === V.seat;
const IRREGULAR = { has: "have", is: "are", fetches: "fetch" };
/** A log line in words: the seats named, and when the viewer's name is the stock "You" the grammar follows it. */
function words(text) {
  const t = fillNames(text, V.seats);
  if (V.seat == null || V.seats[V.seat]?.name !== "You") return t;
  return t.replace(/\bYou's\b/g, "Your").replace(/\bYou ([a-z]+)\b/g, (m, verb) => `You ${IRREGULAR[verb] || (verb.endsWith("s") ? verb.slice(0, -1) : verb)}`);
}

// ---------- what's on screen, apart from the game: the pick being made ----------
const blank = () => ({ look: null, arm: null, tap: null, picks: [], atk: [], blk: [], blkSel: null, order: [], bend: null, dlgOff: false, yard: false });
let ui = blank(), uiKey = "";
let hover = null;                                  // the card a mouse or pen is on, read below your side (a finger taps instead)
const POINTER = matchMedia("(hover: hover)").matches;
let MV = [];                                       // the moves the viewer could make now (every card once)
// the cards in your hand a Flood Plain's Island would pay for (name → the Flood Plain), worked out once a decision; and
// the card a "Fetch first" was for, read again with its Cast button once the Island is in
let FETCH = new Map(), fetchKey = "", fetchFor = null;
let CARD = null, CARD_GO = [];                     // the card in its sheet ({ id }), and the sheet's buttons
// the coach's weighing of your decision now ({ key, r, state, seat }), asked once (a Hint, or Always unasked); the Hint
// asked for and its answer; a decision it couldn't weigh (no answer came); its word on your last move it would have
// made otherwise (Check, Always); and this game's moves of yours with its verdict on each, for the review at the end
let advice = null, weighing = null, hintAsked = null, hinted = null, failed = null, word = null, notes = [], notesGame = 0;

// ---------- the look-ahead off this thread: Hard's moves, and the coach ----------
// Two workers (dandan-worker.js): one for the computer's moves, one for the coach, so neither waits on the other. A
// browser with no worker thinks here, in fewer deals (the computer's move then the runner's own, on this thread).
const workers = {};
function workerFor(kind) {
  const k = kind === "move" ? "bot" : "coach";
  if (workers[k] === undefined) {
    try {
      const w = new Worker(new URL("./dandan-worker.js", import.meta.url), { type: "module" });
      const waiting = new Map();
      w.onmessage = e => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); f?.(e.data); };
      w.onerror = () => { workers[k] = false; for (const f of waiting.values()) f({ error: "no worker" }); waiting.clear(); };
      workers[k] = { w, waiting, n: 0 };
    } catch { workers[k] = false; }
  }
  return workers[k];
}
/** A request to the look-ahead: "move" (the computer's), "think" (the coach's weighing), "check" (with a move of yours kept in). */
function askThink(kind, state, seat, move = null) {
  const wk = workerFor(kind);
  if (!wk) {
    try { return Promise.resolve({ result: think(state, seat, { ...BUDGET.here, must: kind === "check" ? move : null }) }); }
    catch (err) { return Promise.resolve({ error: String(err) }); }
  }
  return new Promise(res => { const id = ++wk.n; wk.waiting.set(id, res); wk.w.postMessage({ id, kind, state, seat, move, depth: opts.think }); });
}
/** A position's key: the state as the runner hands it to the computer (FNV-1a of its JSON). */
function keyOf(state) {
  const str = JSON.stringify(state);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return `${h}:${str.length}`;
}
// Hard's moves, worked out in the worker while the runner is held: the runner asks rules.bot as usual and gets the
// move from here at once (the same move it would work out itself: the look-ahead stops at so many deals, not a time)
const botMoves = new Map();
let botAsked = "";
function holdForBot() {
  if (!page || opts.level !== "hard") return false;
  const v = page.view;
  if (!v.G || v.over || v.mode !== "solo" || v.toMove == null || !v.seats[v.toMove]?.bot) return false;
  const key = keyOf(v.state);
  if (botMoves.has(key) || workers.bot === false) return false;
  if (botAsked !== key) {
    botAsked = key;
    askThink("move", v.state, v.toMove).then(({ move, error }) => {
      if (move) { botMoves.set(key, move); if (botMoves.size > 40) botMoves.delete(botMoves.keys().next().value); }
      else if (error) { console.warn("dandan: the worker's move failed", error); workers.bot = false; }
      page.runner.kick();
    });
  }
  return true;
}
const pageRules = { ...rules, bot: (s, seat, ctx) => (ctx.level === "hard" && botMoves.get(keyOf(s))) || rules.bot(s, seat, ctx) };
/**
 * Thinking changed in the menu: what Hard and the coach were working out at the old depth is dropped (their workers
 * stopped, what they owed answered as stale) and asked again at the new one: Hard's move, a Hint asked for, Always's.
 */
function rethink() {
  for (const k of ["bot", "coach"]) {
    const wk = workers[k];
    if (!wk) continue;
    wk.w.terminate();
    workers[k] = undefined;
    for (const f of wk.waiting.values()) f({ stale: true });
  }
  botMoves.clear();
  botAsked = "";
  const asked = !!V?.G && hintAsked === decisionOf(V) && !hinted;
  advice = weighing = hinted = hintAsked = failed = null;
  if (asked) hint(); else draw();
  page.runner.kick();
}

// ---------- the computer's pace ----------
// What the computer does stays on the table a while before its next move (1.5 s, 3 s), or until you tap Continue
// (solo); Quick is the runner's own pace. A move of yours, and what follows from it at once, needs no waiting: you made
// it. A turn's first line marks the turn and isn't something done.
// fresh: the newest thing done (n counts them, ln is the log's last line read), when it came, whether your own move did
// it; tapped: the n Continue was last tapped at
let fresh = { game: 0, ln: 0, n: 0, at: 0, mine: true }, tapped = 0;
function noteFresh(prev, v) {
  const s = v.state;
  if (!s) return;
  const ln = s.ln || 0;
  if (v.G.seq !== fresh.game) { fresh = { game: v.G.seq, ln, n: 0, at: 0, mine: true }; tapped = 0; return; }
  if (ln <= fresh.ln) return;
  if (!s.log.some(e => e.n > fresh.ln && !/^Turn \d+:/.test(e.t))) { fresh.ln = ln; return; }
  const mine = !!prev?.G && prev.G.seq === v.G.seq && prev.seat != null && prev.toMove === prev.seat;
  fresh = { game: v.G.seq, ln, n: fresh.n + 1, at: Date.now(), mine };
}
const BASE_PACE = () => (opts.level === "hard" ? 450 : 1000);
/**
 * How long the computer's next move waits: Quick, the runner's pace; else what it last did stays its while, and a move
 * of its that showed nothing (a pass) doesn't hold up the next, which is the one to see.
 */
function paceNow() {
  const ms = SHOWN_MS[opts.pace];
  return ms && !fresh.mine ? Math.max(250, fresh.at + ms - Date.now()) : BASE_PACE();
}
/** Tap to continue: the computer's next move waits, after something it did, until Continue. */
const tapHold = () => opts.pace === "tap" && !IN_FRAME && !!V?.G && V.mode === "solo" && !V.over && V.toMove != null
  && !!V.seats[V.toMove]?.bot && !fresh.mine && fresh.n > tapped;
function goOn() {
  tapped = fresh.n;
  draw();
  page.runner.kick();
}

const randomRounds = seatRounds("dandan");   // random mode's round: a game
page = seatPage({
  rules: pageRules, id: "dandan", app: 1, pace: paceNow, botName: () => "Gill", level: () => opts.level, voice: () => false,
  // Hard works its move out while a tap is awaited, so it comes the moment you tap
  hold: () => { const thinking = holdForBot(); return tapHold() || thinking; },
  onView: v => {
    noteFresh(V, v);
    V = v;
    const key = v.G ? `${v.G.seq}:${v.G.n}` : "";
    if (key !== uiKey) {
      // a move was made: the picks it was for are over, and the card sheet opened for them; a card being read in the
      // middle stays up while it's still there
      const look = ui.look;
      ui = blank();
      uiKey = key;
      // (in 3D the card read stands over the table: there it goes once the card has gone somewhere else, played or cast)
      const at = look && v.state ? placeOf(v.state, look.id) : "";
      if (at && (!in3d() || at === look.at)) ui.look = look;
      closeCard();
    }
    draw();
    randomRounds(v);
  },
  onOver, toast, newGame,
});

// ---------- the coach ----------
// It weighs a decision in its own worker (dandan-think.js: each move played out a turn ahead in the same deals of the
// cards you can't see), so the table never waits on it: a Hint or Always's advice in a moment, a check a little after
// your move. (A partner's frame, watched from the games screen, coaches nobody.)
// the coach shows itself (a Hint, its line above the buttons) in Hints, Check and Always; its word on your moves is
// shown in Check and Always; and it weighs your moves, to keep where it would have played otherwise for the review, in
// those two and in Review, where nothing is shown while you play
const coaching = () => opts.coach !== "off" && opts.coach !== "review" && !IN_FRAME;
const speaks = () => (opts.coach === "check" || opts.coach === "on") && !IN_FRAME;
const weighs = () => (speaks() || opts.coach === "review") && !IN_FRAME;
const decisionOf = v => `${v.G.seq}:${v.G.n}`;
/** Whether the decision now is yours: priority, or a question put to you. */
const myDecision = () => !!V?.G && V.seat != null && !V.over && V.toMove === V.seat;
function weigh(v) {
  const key = decisionOf(v);
  if (advice?.key === key) return Promise.resolve(advice);
  if (weighing?.key === key) return weighing.promise;
  const state = structuredClone(v.state), seat = v.seat;
  const promise = askThink("think", state, seat).then(({ result, stale }) => {
    if (stale) return null;                        // asked again at another depth (rethink)
    if (weighing?.key === key) weighing = null;
    if (!result) { failed = key; return null; }
    const a = { key, r: result, state, seat };
    if (V?.G && decisionOf(V) === key) advice = a;
    return a;
  });
  weighing = { key, promise };
  return promise;
}
/** Always: the coach's move at each of your decisions, unasked. */
function advise(v) {
  if (opts.coach !== "on" || IN_FRAME || !myDecision() || [advice?.key, weighing?.key, failed].includes(decisionOf(v))) return;
  weigh(v).then(a => { if (a && V?.G && decisionOf(V) === a.key) draw(); });
}
/** A Hint: the coach's move for the decision you're at (Hints and Always; Check gives none). */
async function hint() {
  if (!myDecision() || opts.coach === "check") return;
  const key = decisionOf(V);
  hintAsked = key;
  draw();
  const a = await weigh(V);
  if (a && V?.G && decisionOf(V) === key) hinted = { key, r: a.r };
  draw();
}
/** Check and Always: a move of yours set against the coach's, from the table as it was before it. */
async function checkMove(state, seat, move, game, started) {
  const { result } = await askThink("check", state, seat, move);
  if (!result || V?.G?.seq !== game) return;
  const vd = verdict(result, move, state, seat);
  notes.push(vd ? { agreed: false, gap: vd.gap, words: vd.words } : { agreed: true });
  keepForReview(vd, state, seat, started);
  // the word stays until another replaces it, or the turn after next: a decision here comes in a run of several
  // (a spell, then the questions it asks), and the ones it agrees with mustn't take it away at once
  if (vd && speaks()) word = { words: vd.words, r: result, mine: move, state, seat, turn: state.turn };
  draw();
}
/** A decision of yours weighed (null: the coach agreed), kept for the review sheet with the game it was in. */
function keepForReview(vd, state, seat, started) {
  if (!IN_FRAME) write(REVIEW, noteDecision(read(REVIEW, null), vd, { game: started, state, seat }));
}
/** The coach's move at this decision, while it stands: the Hint asked for, or Always's. */
function advised(v) {
  if (!v?.G || !coaching()) return null;
  const key = decisionOf(v);
  if (hinted?.key === key) return hinted.r.best;
  return opts.coach === "on" && advice?.key === key ? advice.r.best : null;
}
const WHY = ' <button type="button" class="link dd-why" data-why="1">Why?</button>';
const waiting = () => `${sextant().outerHTML}The coach is weighing it…`;
/** What the coach says now: its move when asked or in Always, its word on your last move, or how the game went by its lights. */
function coachLine(v) {
  const s = v.state, key = decisionOf(v), turn = myDecision();
  if (turn && hinted?.key === key) return `<b>Hint</b>: ${esc(adviceLine(hinted.r, s, v.seat))}${WHY}`;
  if (turn && hintAsked === key && !hinted && failed !== key) return waiting();
  if (turn && opts.coach === "on" && failed !== key) return advice?.key === key ? `<b>Coach</b>: ${esc(adviceLine(advice.r, advice.state, advice.seat))}${WHY}` : waiting();
  if (!speaks()) return "";
  if (word && !s.over) return `<b class="dd-miss">Coach</b> ${esc(word.words)}${WHY}`;
  if (s.over && notes.length) {
    const agreed = notes.filter(n => n.agreed).length;
    return `<b>Your play</b>: the coach agreed with ${agreed} of your ${notes.length} decision${notes.length === 1 ? "" : "s"}${agreed < notes.length ? ' <button type="button" class="link dd-why" data-why="review">Where it differed</button>' : ""}`;
  }
  return "";
}
function drawCoach(v) {
  const box = $("coach");
  box.hidden = !coaching() || v.seat == null;
  if (box.hidden) return;
  const ask = opts.coach === "check" ? "" : `<button type="button" class="btn dd-hint" data-act="hint" ${myDecision() ? "" : "disabled"}>Hint</button>`;
  box.innerHTML = `<span class="dd-says">${coachLine(v)}</span>${ask}`;
}
$("coach").addEventListener("click", e => {
  if (e.target.closest("[data-act=hint]")) { hint(); return; }
  // the line itself opens Why? too: a long word is cut short, and its link with it
  const b = e.target.closest(".dd-why") || e.target.closest(".dd-says")?.querySelector(".dd-why");
  if (b) showWhy(b.dataset.why === "review" ? "review" : "");
});

/**
 * The places on the table that make up the coach's move, to ring: a card in your hand ("c:id"), a permanent or a
 * stack item or a player as a target ("t:" and the target's key), a pile, a button by its words, a row of a question's
 * sheet ("o:" and its words), a card of the order chips ("q:id").
 */
function rings(m) {
  const out = new Set();
  if (!m) return out;
  const s = S(), tk = t => (t ? `t:${targetKey(t)}` : "");
  switch (m.t) {
    case "pass": out.add("b:Pass"); break;
    case "land": case "cycle": out.add(`c:${m.card}`); break;
    case "cast":
      out.add(m.from === "yard" ? "pile:yard" : `c:${m.card}`);
      for (const t of m.targets || []) out.add(tk(t));
      break;
    case "ability": out.add(`t:c:${m.id}`); break;
    case "keep": out.add("b:Keep"); break;
    case "mull": out.add("b:Mulligan"); break;
    case "attack": if (m.ids?.length) { for (const id of m.ids) out.add(`t:c:${id}`); out.add("b:Attack"); } else out.add("b:No attack"); break;
    case "block": if (m.pairs?.length) { for (const [b, a] of m.pairs) { out.add(`t:c:${b}`); out.add(`t:c:${a}`); } out.add("b:Block"); } else out.add("b:No blocks"); break;
    case "bottom": case "discard": case "putback": for (const id of m.cards || []) out.add(`c:${id}`); break;
    case "order": for (const id of m.cards || []) out.add(`q:${id}`); break;
    case "surveil": out.add(m.yard ? "b:Graveyard" : "b:Keep on top"); break;
    case "owner": out.add(m.bottom ? "b:Bottom" : "b:Second from top"); break;
    case "search": case "pick": out.add(m.card == null ? "o:none" : `o:${nm(m.card)}`); if (s.pending?.for === "boil" && m.card != null) out.add(`o:id:${m.card}`); break;
    case "name": out.add(`o:${m.name}`); break;
    case "bend": out.add(`o:${m.from}`); out.add(`o:to:${m.to}`); break;
    case "retarget": out.add(m.targets?.length ? `o:t:${targetKey(m.targets[0])}` : "o:none"); break;
  }
  return out;
}
let RING = new Set();                              // this draw's rings

// ---------- the table, drawn ----------
const canAct = () => V?.G && V.seat != null && !S().over && !S().pending && S().prio === V.seat;

function draw() {
  if (!page) return;
  const v = V;
  document.body.classList.toggle("dd-watch", !!v?.G && v.seat == null);
  if (!v?.G) {
    if (in3d()) table3d.empty();
    else {
      for (const id of ["foe", "mid", "me", "hand", "log"]) $(id).replaceChildren();
      $("read").innerHTML = `<p class="dd-lead">One deck of eighty cards, one library, one graveyard, shared. Win with Dandâns, which can only attack across an Island.</p>`;
    }
    $("controls").innerHTML = `<button class="btn primary dd-go" type="button" data-act="new">New game</button>`;
    return;
  }
  const s = S(), me = v.seat ?? 0;
  if (v.G.seq !== notesGame) { notesGame = v.G.seq; notes = []; word = null; hover = null; }
  if (word && s.turn > word.turn + 1) word = null;
  if (advice && advice.key !== decisionOf(v)) advice = null;
  if (hinted && hinted.key !== decisionOf(v)) hinted = null;
  MV = canAct() ? moves(s, v.seat) : [];
  if (!canAct()) FETCH = new Map();
  else if (fetchKey !== decisionOf(v)) { fetchKey = decisionOf(v); FETCH = afterFetch(s, v.seat); }
  if (fetchFor && (fetchFor.game !== v.G.seq || fetchFor.turn !== s.turn || !s.hand[me].includes(fetchFor.id))) fetchFor = null;
  if (fetchFor && MV.some(m => m.t === "cast" && m.from === "hand" && DECK[m.card] === DECK[fetchFor.id])) { ui.look = { id: fetchFor.id, at: "hand" }; fetchFor = null; }
  RING = myDecision() ? rings(advised(v)) : new Set();
  const q = question();
  if (in3d()) table3d.draw(q);
  else {
    drawZone($("foe"), 1 - me, q);
    drawStrip();
    drawZone($("me"), me, q);
    drawRead(q);
    drawHand(q);
    drawLog();
  }
  drawCoach(v);
  drawControls(q);
  syncDialogs(q);
  advise(v);
}

// ---------- the two sides ----------
const targetKey = t => `${t.k}:${t.sid ?? t.id ?? t.seat}`;
const armedKeys = () => new Set((ui.arm?.moves || []).map(m => targetKey(m.targets[0])));

function drawZone(box, seat, q) {
  const s = S(), armed = armedKeys();
  const mine = s.bf.filter(p => p.ctl === seat);
  const cre = mine.filter(isCreature), lnd = mine.filter(isLand), tok = mine.filter(p => !isLand(p) && !isCreature(p));
  const untapped = lnd.filter(p => !p.tapped).length;
  const turn = s.active === seat && !s.over && s.step !== "mull";
  const them = seat !== (V.seat ?? 0);
  // what you know is in their hand (seen going there), and mana floating in a pool until the step ends
  const known = them && V.seat != null && sees() ? knownIn(s, seat, V.seat).length : 0, pool = poolOf(s, seat);
  box.className = `dd-zone ${them ? "foe" : "me"}${turn ? " turn" : ""}${V.toMove === seat ? " move" : ""}`;
  box.innerHTML = `<header class="dd-zh${armed.has(`p:${seat}`) ? " tgt" : ""}${RING.has(`t:p:${seat}`) ? " advised" : ""}" data-tk="p:${seat}"${them ? ' data-act="known"' : ""}>
      <b class="dd-who">${esc(nameOf(seat))}</b>
      <span class="dd-meta">${them ? `hand ${s.hand[seat].length}${known ? `, ${known} known` : ""} · ` : ""}${untapped} of ${lnd.length} lands ready${pool ? ` · <b class="dd-float">${pool.split("").map(c => `<i class="dd-pip ${c === "U" || c === "R" ? c : "g"}">${c}</i>`).join("")} floating</b>` : ""}</span>
      <span class="dd-life" aria-label="${s.life[seat]} life">${s.life[seat]}</span></header>
    <div class="dd-cres">${cre.map(p => creTile(p, q, armed)).join("")}</div>
    <div class="dd-lands">${[...lnd, ...tok].sort(landOrder).map(p => landChip(p, armed)).join("")}</div>`;
}
const landOrder = (a, b) => (nm(a.id) === "Clue") - (nm(b.id) === "Clue") || (nm(a.id) === "Island" ? 0 : 1) - (nm(b.id) === "Island" ? 0 : 1) || a.id - b.id;

/** A Dandân: its power and toughness as they stand, and what's been done to it. */
function creTile(p, q, armed) {
  const s = S(), [a, b] = pt(p), base = defOf(p.id).pt;
  const att = s.combat?.att.includes(p.id), pairs = s.combat?.blk || [];
  const link = pairs.findIndex(([x, y]) => x === p.id || y === p.id);
  const mineBlk = ui.blk.findIndex(([x, y]) => x === p.id || y === p.id);
  const pending = q?.pick;
  const can = (pending === "attack" && S().pending.ids.includes(p.id)) || (pending === "block" && (S().pending.blockers.includes(p.id) || S().pending.attackers.includes(p.id)));
  const chosen = ui.atk.includes(p.id) || ui.blkSel === p.id;
  const tags = [att ? "attacking" : "", p.tapped && !att ? "tapped" : "", p.walk ? "islandwalk" : "", needType(p) !== "Island" ? `wants ${needType(p)}` : "", p.ent >= s.turn && p.ctl === s.active ? "new" : ""].filter(Boolean);
  const num = link >= 0 ? link + 1 : mineBlk >= 0 ? mineBlk + 1 : 0;
  return `<button type="button" class="dd-cre${p.tapped ? " tapped" : ""}${att ? " att" : ""}${can ? " can" : ""}${chosen ? " sel" : ""}${armed.has(`c:${p.id}`) ? " tgt" : ""}${ui.look?.id === p.id ? " look" : ""}${RING.has(`t:c:${p.id}`) ? " advised" : ""}" data-perm="${p.id}" data-tk="c:${p.id}" aria-label="Dandân ${a} ${b}${tags.length ? `, ${tags.join(", ")}` : ""}">
    <span class="dd-pt"><b class="${a !== base[0] ? "chg" : ""}">${a}</b>/<b class="${b !== base[1] ? "chg" : ""}">${b}</b></span>
    <span class="dd-cn">Dandân</span><span class="dd-tags">${tags.map(esc).join(" · ")}</span>${num ? `<i class="dd-link">${num}</i>` : ""}</button>`;
}

/** A land (or a Clue): its mana, tapped or not; a basic Island is only its colour, the rest carry a short name. */
function landChip(p, armed) {
  const clue = nm(p.id) === "Clue", alts = clue ? [] : manaAlts(p), cols = [...new Set(alts.flat())];
  const basic = nm(p.id) === "Island" && !p.tc;
  const mana = alts.map(a => a.join("")).join("/");
  const text = clue ? "Clue" : basic ? "U" : LAND_CODE[nm(p.id)] || mana;
  const cls = clue ? "dd-clue" : cols.length > 1 ? "duo" : cols.length ? `m${cols[0]}` : "m0";
  return `<button type="button" class="dd-land ${cls}${p.tapped ? " tapped" : ""}${p.tc ? " bent" : ""}${armed.has(`c:${p.id}`) ? " tgt" : ""}${ui.tap ? (ui.tap.ids.includes(p.id) ? " pay" : payable(p) ? " can" : "") : ""}${ui.look?.id === p.id ? " look" : ""}${RING.has(`t:c:${p.id}`) ? " advised" : ""}" data-perm="${p.id}" data-tk="c:${p.id}" aria-label="${esc(nm(p.id))}${p.tapped ? ", tapped" : ""}${ui.tap?.ids.includes(p.id) ? ", chosen to tap" : ""}">${esc(text)}</button>`;
}

// ---------- between the two sides: the library, the turn and who's to move, the graveyard ----------
function waitLine() {
  const s = S(), tm = V.toMove;
  if (s.over || tm == null) return "";
  if (V.seat == null) return `${nameOf(tm)} to move`;
  if (tm === V.seat) return s.pending ? "Your answer" : s.stack.length ? "Your priority: answer, or let it resolve" : "Your move";
  if (tapHold()) return `${esc(nameOf(tm))} waits for your tap`;
  return `${sextant().outerHTML}${esc(nameOf(tm))} is ${s.pending ? "choosing" : "thinking"}`;
}
function headline() {
  const s = S();
  if (s.over) return s.winner < 0 ? "A drawn game" : isMe(s.winner) ? "You won" : `${nameOf(s.winner)} won`;
  if (s.step === "mull") return "Opening hands";
  return `Turn ${s.turn} · ${isMe(s.active) ? "your" : `${esc(nameOf(s.active))}’s`} ${STEP_WORDS[s.step] || s.step}`;
}
/** A stack item's name and what it's aimed at. */
function itemWords(it) {
  const tw = t => (t.k === "s" ? stackName(S().stack.find(x => x.sid === t.sid)) : t.k === "p" ? nameOf(t.seat) : t.k === "g" ? nm(t.id) : nm(t.id));
  const to = it.targets.map(tw).filter(Boolean).join(", ");
  return { name: stackName(it), to };
}
const stackName = it => (it ? STACK_WORDS[it.name] || it.name : "a spell");

function drawStrip() {
  const s = S(), lib = s.lib.length, known = sees() ? topKnown(s, V.seat ?? 0) : null;
  $("mid").innerHTML = `<button type="button" class="dd-pile" data-act="lib" aria-label="Library, ${lib} cards"><b>${lib}</b><small class="${known != null ? "known" : ""}">${known != null ? `▲ ${esc(short(nm(known)))}` : "Library"}</small></button>
    <div class="dd-phase"><b>${headline()}</b><span class="dd-wait">${waitLine()}</span></div>
    <button type="button" class="dd-pile${RING.has("pile:yard") ? " advised" : ""}" data-act="yard" aria-label="Graveyard, ${s.yard.length} cards"><b>${s.yard.length}</b><small>Graveyard</small></button>`;
}

// ---------- below your side: the card read, and what has happened ----------
// The left column: the question put to you or the target being chosen, then the stack, then the card read: the one
// tapped (the buttons below act on it), else the one a mouse or pen is on, else the stack's top (what's being cast, in
// full). The right: the log.
/** What's said above the stack: the question put to you, the target being chosen, or how the game ended (both views). */
function readHead(q = question()) {
  const s = S();
  return q ? q.say
    : ui.tap ? `<p class="dd-q">${esc(ui.tap.label)}: tap the lands to pay with</p><p class="dd-sub">It costs ${pips(costText(ui.tap.cost))}: ${ui.tap.ids.length} chosen${tapDone() ? "" : ", not enough yet"}.</p>`
    : ui.arm ? `<p class="dd-q">${esc(ui.arm.label)}: choose ${ui.arm.moves[0].targets[0].k === "p" ? "a player" : ui.arm.moves[0].targets[0].k === "g" ? "a card in the graveyard" : "a target"}</p><p class="dd-sub">The lit ones are legal.</p>`
    : s.over ? `<p class="dd-q">${esc(words(s.log[s.log.length - 1]?.t || ""))}</p>` : "";
}
function drawRead(q = question()) {
  const s = S(), armed = armedKeys(), head = readHead(q);
  const stack = s.stack.length ? `<div class="dd-stack" aria-label="The stack, the last cast on top">${[...s.stack].reverse().map(it => {
    const w = itemWords(it);
    return `<button type="button" class="dd-st ${isMe(it.ctl) ? "mine" : "theirs"}${armed.has(`s:${it.sid}`) ? " tgt" : ""}${RING.has(`t:s:${it.sid}`) ? " advised" : ""}" data-tk="s:${it.sid}" data-sid="${it.sid}">
      <b>${esc(w.name)}</b><span>${esc(nameOf(it.ctl))}${w.to ? ` → ${esc(w.to)}` : ""}</span></button>`;
  }).join("")}</div>` : "";
  const top = s.stack[s.stack.length - 1], id = q || ui.arm ? null : ui.look?.id ?? hover ?? top?.card ?? top?.src ?? null;
  const card = id != null ? detail(id) : head || stack ? "" : `<p class="dd-sub">${POINTER ? "Point at a card to read it here." : "Tap a card to read it here."}</p>`;
  $("read").innerHTML = head + stack + card;
}
/** The card a pointer or a tap is on: in the hand, on the table, on the stack, named in a line. */
function cardAt(el) {
  const c = el.closest?.("[data-card], [data-perm], [data-sid], [data-look], [data-qc]");
  if (!c) return null;
  if (c.dataset.sid != null) { const it = S()?.stack.find(x => x.sid === Number(c.dataset.sid)); return it?.card ?? it?.src ?? null; }
  const n = Number(c.dataset.card ?? c.dataset.perm ?? c.dataset.look ?? c.dataset.qc);
  return Number.isInteger(n) ? n : null;
}
$("app").addEventListener("pointerover", e => {
  if (e.pointerType === "touch" || !V?.G) return;
  const id = cardAt(e.target);
  if (id == null || id === hover) return;
  hover = id;
  if (in3d()) table3d.read(); else drawRead();
});

/** A card's type line in words. */
const typeLine = d => (d.type === "creature" ? `Creature · ${d.pt[0]}/${d.pt[1]} Fish` : d.type === "land" ? (d.subs.length ? `Land — ${d.subs.join(" ")}` : "Land") : TYPE_WORDS[d.type] + (d.aftermath ? " · aftermath" : ""));
/** What's been done to a permanent on the table. */
function stateWords(p) {
  return [p.tapped ? "Tapped" : "Untapped", isCreature(p) && p.ent >= S().turn && p.ctl === S().active ? "came this turn" : "", p.walk ? "has islandwalk" : "",
    ...(p.tc || []).map(([a, b]) => `its text now says ${b} for ${a}`), p.pump ? `${p.pump[0] >= 0 ? "+" : ""}${p.pump[0]}/${p.pump[1] >= 0 ? "+" : ""}${p.pump[1]} this turn` : "",
    `under ${isMe(p.ctl) ? "your" : `${nameOf(p.ctl)}’s`} control`].filter(Boolean).join(" · ");
}
/** A card's name as a chip that opens it. */
const chip = id => `<button type="button" class="dd-chip dd-name" data-look="${id}">${esc(nm(id))}</button>`;
/** A card read in full: the halves of a split card, the text in our words, and what's been done to it on the table. */
function detail(id) {
  const full = nm(id), p = perm(S(), id);
  return (HALVES[full] || [full]).map(h => {
    const d = CARDS[h];
    return `<div class="dd-detail"><div class="dd-dh"><b>${esc(h)}</b>${pips(d.cost)}</div><div class="dd-dt">${esc(typeLine(d))}</div><p>${esc(d.text)}</p></div>`;
  }).join("") + (p ? `<p class="dd-state">${esc(stateWords(p))}</p>` : "");
}

// ---------- your hand ----------
/** A hand in the order it's held: lands, the Dandân, instants, sorceries, each by cost (both views). */
const handOrder = hand => [...hand].sort((a, b) => TYPE_ORDER[defOf(a).type] - TYPE_ORDER[defOf(b).type] || total(parseCost(defOf(a).cost)) - total(parseCost(defOf(b).cost)) || a - b);
function drawHand(q) {
  const box = $("hand"), s = S();
  box.className = "dd-hand";
  if (V.seat == null) { box.innerHTML = `<p class="dd-watching">Watching: you sit down at the next game.</p>`; return; }
  const ids = handOrder(s.hand[V.seat]);
  const usable = new Set(MV.filter(m => m.from !== "yard").map(m => DECK[m.card]));
  box.dataset.n = ids.length;
  box.className = `dd-hand${canAct() ? " act" : ""}`;
  box.innerHTML = ids.map(id => {
    const d = defOf(id), pick = ui.picks.indexOf(id);
    return `<button type="button" class="dd-card ${d.type}${usable.has(DECK[id]) ? " can" : FETCH.has(DECK[id]) ? " fetch" : ""}${ui.look?.id === id ? " look" : ""}${pick >= 0 ? " sel" : ""}${RING.has(`c:${id}`) ? " advised" : ""}" data-card="${id}" aria-label="${esc(DECK[id])}">
      ${pips(d.cost)}<span class="dd-cn">${esc(SOFT[short(DECK[id])] || short(DECK[id]))}</span><span class="dd-ct">${TYPE_WORDS[d.type]}</span>${pick >= 0 ? `<i class="dd-link">${q?.ordered ? pick + 1 : "✓"}</i>` : ""}</button>`;
  }).join("");
}

function drawLog() {
  const box = $("log");
  box.innerHTML = S().log.map(e => `<li>${esc(words(e.t))}</li>`).join("");
  box.scrollTop = box.scrollHeight;
}

// ---------- the questions put to you ----------
/**
 * Your pending question as the page asks it: { say (html for the middle), buttons, pick (a choice made on the table or in
 * the hand), ordered, dlg ({ title, html, choices }: a list to choose from, in a sheet) }.
 */
function question() {
  const s = S(), q = s.pending, me = V.seat;
  if (!q || q.seat !== me) return null;
  const send = m => act(m);
  const say = (t, sub = "") => `<p class="dd-q">${t}</p>${sub ? `<p class="dd-sub">${sub}</p>` : ""}`;
  const picked = ui.picks.length;
  switch (q.t) {
    case "mull": {
      const shown = s.reveal && s.reveal.seat !== me ? `<p class="dd-sub">${esc(nameOf(s.reveal.seat))} showed ${s.reveal.cards.map(chip).join(" ")} and took a free mulligan.</p>` : "";
      // the first mulligan is free, and so is one of a hand short of lands or spells (shown); bottomFor counts the rest
      const put = bottomFor(q.taken), next = bottomFor(q.taken + 1);
      const why = q.free ? "Fewer than two lands or two spells: a free mulligan, and the hand is shown."
        : q.first ? "The first mulligan is free." : put ? `Keep it and put ${put} on the bottom; another mulligan, ${next}.` : "The free mulligan is taken: another puts one on the bottom.";
      return {
        say: say("Keep this hand?", `${why} Tap a card to read it.`) + shown,
        buttons: [
          { label: "Mulligan", sub: q.free ? "free · shown" : next ? `bottom ${next}` : "free", off: s.mull.n[me] >= MOST_MULLS && !q.free, fn: () => send({ t: "mull" }) },
          { label: "Keep", kind: "primary", sub: put ? `bottom ${put}` : "", fn: () => send({ t: "keep" }) }],
      };
    }
    case "bottom": return handPick(q, "bottom", `Put ${q.n} on the bottom of the library`, "Tap a card to read it and put it away.", "Bottom", { t: "bottom", cards: ui.picks });
    case "discard": return handPick(q, "discard", `Discard ${q.n === 1 ? "a card" : `${q.n} cards`}`, q.why ? `${q.why}.` : "", "Discard", { t: "discard", cards: ui.picks });
    case "putback": return {
      ...handPick(q, "putback", `Put ${q.n} back on top of the library`, q.n > 1 ? "The first you choose goes on top, the second under it." : "", "Put back", { t: "putback", cards: ui.picks }), ordered: true,
    };
    case "attack": return {
      pick: "attack", say: say("Attack?", "Tap the Dandâns that attack. One that is blocked trades with its blocker: 4 damage each way, and both die."),
      buttons: [
        { label: "No attack", fn: () => send({ t: "attack", ids: [] }) },
        { label: ui.atk.length ? `Attack with ${ui.atk.length}` : "Attack", kind: "primary", off: !ui.atk.length, fn: () => send({ t: "attack", ids: ui.atk }) }],
    };
    case "block": return {
      pick: "block", say: say(`${esc(nameOf(s.active))} attacks with ${q.attackers.length}`, "Tap one of your Dandâns, then the attacker it blocks. Tap a paired one to take it off."),
      buttons: [
        { label: "No blocks", fn: () => send({ t: "block", pairs: [] }) },
        { label: ui.blk.length ? `Block with ${ui.blk.length}` : "Block", kind: "primary", off: !ui.blk.length, fn: () => send({ t: "block", pairs: ui.blk }) }],
    };
    case "order": {
      const ids = q.cards, chosen = ui.order;
      return {
        say: say("Order the top of the library", "Tap each to read it and put it next, from the top down.") + `<div class="dd-chips">${ids.map(id => `<button type="button" class="dd-chip${chosen.includes(id) ? " sel" : ""}${RING.has(`q:${id}`) ? " advised" : ""}" data-qc="${id}">${chosen.includes(id) ? `<i>${chosen.indexOf(id) + 1}</i>` : ""}${esc(nm(id))}</button>`).join("")}</div>`,
        buttons: [
          { label: "Keep order", fn: () => send({ t: "order", cards: ids }) },
          { label: "Set order", kind: "primary", off: chosen.length !== ids.length, fn: () => send({ t: "order", cards: chosen }) }],
      };
    }
    case "surveil": return {
      say: say("Surveil 1", `The top card is ${chip(q.card)}. Keep it there, or put it in the graveyard?`),
      buttons: [{ label: "Graveyard", fn: () => send({ t: "surveil", yard: true }) }, { label: "Keep on top", kind: "primary", fn: () => send({ t: "surveil", yard: false }) }],
    };
    case "owner": return {
      say: say(`${chip(q.target)} goes into the library`, "As its owner you choose where."),
      buttons: [{ label: "Bottom", fn: () => send({ t: "owner", bottom: true }) }, { label: "Second from top", kind: "primary", fn: () => send({ t: "owner", bottom: false }) }],
    };
    default: return dialogQuestion(q, send, say);
  }
}
/** A choice of cards from the hand (bottom, discard, put back): tapped in the hand, then confirmed. */
function handPick(q, pick, title, sub, label, move) {
  return {
    pick, n: q.n, say: `<p class="dd-q">${esc(title)}</p>${sub ? `<p class="dd-sub">${esc(sub)}</p>` : ""}`,
    buttons: [{ label, sub: `${ui.picks.length} of ${q.n}`, kind: "primary", off: ui.picks.length !== q.n, fn: () => act(move) }],
  };
}

/** The questions with a list to choose from open in a sheet over the table (and come back from its button if it's closed). */
function dialogQuestion(q, send, say) {
  const s = S(), group = ids => {
    const by = new Map();
    for (const id of ids) { const k = nm(id); if (!by.has(k)) by.set(k, []); by.get(k).push(id); }
    return [...by];
  };
  const list = (rows, none) => ({ rows, none });
  switch (q.t) {
    case "search": {
      const rows = group(q.ids).map(([name, ids]) => ({ label: name, sub: ids.length > 1 ? `× ${ids.length}` : "", card: ids[0], ring: `o:${name}`, fn: () => send({ t: "search", card: ids[0] }) }));
      return { say: say(q.to === "bf" ? "Fetch a land" : "Find an Island"), buttons: [reopen()], dlg: { title: q.to === "bf" ? "Fetch a land" : "Find an Island", ...list(rows, { label: "Find nothing", ring: "o:none", fn: () => send({ t: "search", card: null }) }) } };
    }
    case "pick": {
      if (q.for === "boil") {
        const rows = q.ids.map(id => { const p = perm(s, id); return { label: nm(id), sub: p?.tapped ? "tapped" : "untapped", card: id, ring: `o:id:${id}`, fn: () => send({ t: "pick", card: id }) }; });
        return { say: say("Return a land you control to your hand"), buttons: [reopen()], dlg: { title: "Return a land to your hand", ...list(rows) } };
      }
      const title = q.for === "drop" ? "Put a creature or land from your hand onto the battlefield" : "Put an instant or sorcery from the graveyard on top of the library";
      const rows = group(q.ids).map(([name, ids]) => ({ label: name, sub: ids.length > 1 ? `× ${ids.length}` : "", card: ids[0], ring: `o:${name}`, fn: () => send({ t: "pick", card: ids[0] }) }));
      return { say: say(title), buttons: [reopen()], dlg: { title, ...list(rows, q.optional ? { label: "None", ring: "o:none", fn: () => send({ t: "pick", card: null }) } : null) } };
    }
    case "bend": {
      const p = perm(s, q.target), from = q.froms.length === 1 ? q.froms[0] : ui.bend;
      const title = `Mind Bend: ${nm(q.target)}`, rows = [];
      if (q.froms.length > 1) rows.push({ head: "Change which land type?" }, ...q.froms.map(f => ({ label: f, on: f === from, ring: `o:${f}`, fn: () => { ui.bend = f; draw(); } })));
      if (from) rows.push({ head: `${from} becomes` }, ...BASICS.filter(t => t !== from).map(t => ({ label: t, ring: `o:to:${t}`, fn: () => send({ t: "bend", from, to: t }) })));
      const note = nm(q.target) === "Dandân" ? "Its text will name the new type in place of Island: it attacks only a player who controls one, and it is sacrificed when its controller has none."
        : p && isLand(p) ? "Wherever the land’s text names the type, it names the new one, for good: an Island turned into a Swamp no longer counts as an Island." : "";
      return { say: say(title), buttons: [reopen()], dlg: { title, note, rows } };
    }
    case "name": {
      const seen = new Map();
      for (const id of [...s.hand[V.seat], ...s.yard, ...s.exile, ...s.bf.map(p => p.id), ...s.stack.map(i => i.card).filter(c => c != null)]) { const k = DECK[id]; if (k) seen.set(k, (seen.get(k) || 0) + 1); }
      const rows = NAMES.map(n => ({ label: n, sub: `${DECK.filter(x => x === n).length - (seen.get(n) || 0)} unseen`, card: DECK.indexOf(n), ring: `o:${n}`, fn: () => send({ t: "name", name: n }) }));
      return { say: say("Name a card"), buttons: [reopen()], dlg: { title: "Name a card", note: "Unseen: not in your hand, the graveyard, exile or on the table. Those are in the library or the other hand.", rows, cols: true } };
    }
    case "retarget": {
      // the Reversal resolving is a target too: a copied counter aimed at it does nothing
      const self = q.sid, labels = q.options.map(o => (o[0].k === "s" && o[0].sid === self ? "Narset’s Reversal itself: the copy does nothing" : o.map(tword).join(", "))), seen = {};
      const rows = q.options.map((o, i) => ({ label: labels.filter(l => l === labels[i]).length > 1 ? `${labels[i]} · ${(seen[labels[i]] = (seen[labels[i]] || 0) + 1)}` : labels[i], ring: `o:t:${targetKey(o[0])}`, fn: () => send({ t: "retarget", targets: o }) }));
      return { say: say("Choose new targets for the copy"), buttons: [reopen()], dlg: { title: "New target for the copy", ...list(rows, { label: "Keep the targets", ring: "o:none", fn: () => send({ t: "retarget" }) }) } };
    }
  }
  return null;
}
const reopen = () => ({ label: "Answer", sub: "reopen the question", kind: "primary", fn: () => { ui.dlgOff = false; draw(); } });
/** A target in words. */
function tword(t) {
  const s = S();
  if (t.k === "s") return stackName(s.stack.find(x => x.sid === t.sid));
  if (t.k === "p") return nameOf(t.seat);
  const p = perm(s, t.id);
  return p && !isLand(p) && nm(t.id) !== "Clue" ? `${nm(t.id)} (${isMe(p.ctl) ? "yours" : "theirs"})` : p ? `${nm(t.id)} (${isMe(p.ctl) ? "yours" : "theirs"})` : nm(t.id);
}

// ---------- the buttons ----------
let BTN = [];                                      // this draw's buttons, by position (the page's data-b)
function drawControls(q) {
  const box = $("controls"), s = S();
  if (V.seat == null) { box.innerHTML = `<p class="dd-status">${s.over ? headline() : "Watching"}</p>`; BTN = []; return; }
  let list = [];
  if (s.over) list = [{ label: "The result", kind: "primary", fn: () => showEnd(V) }, ...(page.host ? [{ label: "New game", fn: newGame }] : [])];
  else if (q) list = q.buttons;
  else if (ui.tap) list = [
    { label: "Cancel", fn: () => { ui.tap = null; draw(); } },
    { label: "Pay", sub: tapDone() ? `${ui.tap.ids.length} tapped` : "choose more", kind: "primary", off: !tapDone(), fn: () => act({ ...ui.tap.move, taps: ui.tap.ids }) }];
  else if (ui.arm) list = [{ label: "Cancel", fn: () => { ui.arm = null; closeView(); draw(); } }];
  else if (canAct()) {
    list = lookActions();
    list.push({ label: "Pass", sub: passWords(), kind: list.length ? "" : "primary", fn: () => act({ t: "pass" }) });
  }
  else if (tapHold()) list = [{ label: "Continue", sub: "their next move", kind: "primary", fn: goOn }];
  else list = [{ label: "Wait", sub: s.pending ? "their choice" : "their move", off: true, fn: () => {} }];
  BTN = list;
  box.dataset.n = list.length;
  // the coach's move, ringed on the button that makes it
  const ringed = b => [...RING].some(k => k.startsWith("b:") && (b.label === k.slice(2) || b.label.startsWith(`${k.slice(2)} `)));
  box.innerHTML = list.map((b, i) => `<button type="button" class="btn dd-btn${b.kind === "primary" ? " primary" : ""}${ringed(b) ? " advised" : ""}" data-b="${i}" ${b.off ? "disabled" : ""}><b>${esc(b.label)}</b>${b.sub ? `<small>${b.sub}</small>` : ""}</button>`).join("");
}
function passWords() {
  const s = S();
  if (s.stack.length) return "let it resolve";
  if (s.step === "upkeep") return isMe(s.active) ? "to your draw" : "let them draw";
  return { main1: "move on", attackers: "no change", blockers: "no change", main2: "to the end step", end: "end turn" }[s.step] || "";
}

/** The buttons for the card or permanent being read: what it can do now. */
function lookActions() {
  const id = ui.look?.id;
  if (id == null) return [];
  const out = [];
  const inHand = S().hand[V.seat].includes(id);
  if (inHand) {
    const name = DECK[id], mine = MV.filter(m => m.from !== "yard" && DECK[m.card] === name);
    const land = mine.find(m => m.t === "land");
    if (land) out.push({ label: "Play", sub: "land", fn: () => act({ ...land, card: id }) });
    const casts = mine.filter(m => m.t === "cast"), modes = [...new Set(casts.map(m => m.mode ?? 0))];
    for (const mode of modes) {
      const cands = casts.filter(m => (m.mode ?? 0) === mode).map(m => ({ ...m, card: id }));
      const label = modes.length > 1 ? MODE_WORDS[mode] : "Cast";
      out.push({ label, sub: pips(defOf(id).cost), fn: () => cast(cands, modes.length > 1 ? `${nm(id)}: ${MODE_WORDS[mode]}` : nm(id)) });
    }
    const cyc = mine.find(m => m.t === "cycle");
    if (cyc) out.push({ label: "Cycle", sub: esc(costWords(defOf(id).cycling)), fn: () => act({ ...cyc, card: id }) });
    // its mana only after a Flood Plain's fetch (which resolves first): the fetch, and the card read again once it's in
    if (!out.length && FETCH.has(name)) out.push({ label: "Fetch first", sub: "an Island, to pay", fn: () => { fetchFor = { id, game: V.G.seq, turn: S().turn }; act({ t: "ability", id: FETCH.get(name) }); } });
  } else {
    const ab = MV.find(m => m.t === "ability" && m.id === id);
    if (ab) out.push({ label: nm(id) === "Clue" ? "Crack" : "Fetch", sub: nm(id) === "Clue" ? "2 · draw" : "sacrifice", fn: () => act(ab) });
  }
  return out;
}

/** A spell ready to cast: with one possible target (or none) it goes at once; with several, the table lights them to choose from. */
function cast(cands, label) {
  if (cands.length === 1) { act(cands[0]); return; }
  ui.arm = { moves: cands, label };
  if (cands[0].targets[0].k === "g") openYard();
  draw();
}

/** A cost ({ g, U, R }) as the text pips draw. */
const costText = c => (c.g ? `{${c.g}}` : "") + "{U}".repeat(c.U) + "{R}".repeat(c.R);
/** Which lands are alike for tapping: the same card, bent the same way. */
const landKind = p => nm(p.id) + (p.tc ? JSON.stringify(p.tc) : "");
const payable = p => p.ctl === V.seat && !p.tapped && isLand(p) && manaAlts(p).length > 0;
/**
 * The manual tap (23 October 2026, Korbi: "when I have multiple different lands, there should be a 'manual tap' mode
 * where I select what lands will be tapped": an Izzet Boilerworks should be bouncing a tapped land): with the menu's
 * switch on, a move that costs mana, where the lands you could tap differ and some would stay out of it, waits for you to
 * choose them. It starts from the lands the game would tap, so one tap of Pay does as before.
 */
function tapStart(m) {
  if (!opts.manual || V.seat == null || !["cast", "cycle", "ability"].includes(m.t)) return null;
  const s = S(), pay = payment(s, V.seat, m);
  if (!pay || !pay.plan.taps.length) return null;
  const free = s.bf.filter(payable);
  if (new Set(free.map(landKind)).size < 2 || free.length <= pay.plan.taps.length) return null;
  const label = m.t === "cast" ? `Cast ${nm(m.card)}` : m.t === "cycle" ? `Cycle ${nm(m.card)}` : "Crack a Clue";
  return { move: m, cost: pay.cost, ids: [...pay.plan.taps], label };
}
/** A land tapped in or out of the choice (anything else is read as usual). */
function tapPick(id) {
  const p = perm(S(), id);
  if (!p || !payable(p)) { look(id); return; }
  const t = ui.tap;
  t.ids = t.ids.includes(id) ? t.ids.filter(x => x !== id) : [...t.ids, id];
  draw();
}
const tapDone = () => ui.tap && !!payFrom(S(), V.seat, ui.tap.cost, ui.tap.ids);
async function act(m) {
  if (!m.taps && !ui.tap) {
    const t = tapStart(m);
    if (t) { ui.tap = t; ui.look = null; closeView(); draw(); return; }
  }
  const v = V, before = weighs() && myDecision() ? structuredClone(v.state) : null, seat = v?.seat, key = v?.G ? decisionOf(v) : "";
  const known = advice?.key === key ? advice : hinted?.key === key ? { r: hinted.r } : null, game = v?.G?.seq;
  // holding priority keeps it after a spell or ability goes on the stack, to answer it yourself (fetch a land to shuffle, cycle another card to draw first); a cycled card always does (Korbi, 23 October 2026), and the game moves on where there is nothing you could do
  const hold = m.t === "cycle" || (opts.hold && (m.t === "cast" || m.t === "ability"));
  const why = await page.move(hold ? { ...m, hold: true } : m);
  if (why) { toast(why); return; }
  closeView();
  if (before) {
    if (known && sameMove(known.r.best, m)) { notes.push({ agreed: true }); keepForReview(null, before, seat, v.G.started); draw(); }
    else checkMove(before, seat, m, game, v.G.started);
  }
}

// ---------- taps ----------
$("controls").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.act === "new") { newGame(); return; }
  BTN[Number(b.dataset.b)]?.fn();
});
/** A tap on the table, in either view: they mark their cards, piles and players alike. */
function boardTap(e) {
  const el = e.target.closest("button, [data-tk]");
  if (!el) return;
  if (el.dataset.act === "yard") { openYard(); return; }
  if (el.dataset.act === "lib") { openLibrary(); return; }
  if (el.dataset.act === "log") { openLog(); return; }
  if (el.dataset.act === "unlook") { ui.look = null; draw(); return; }
  if (el.dataset.look) { openCard(Number(el.dataset.look)); return; }
  if (el.dataset.qc) { openCard(Number(el.dataset.qc)); return; }
  const tk = el.dataset.tk;
  if (ui.arm && tk) {
    const hit = ui.arm.moves.find(m => targetKey(m.targets[0]) === tk);
    if (hit) act(hit);
    else toast("That isn’t a legal target");
    return;
  }
  if (el.dataset.perm != null) { permTap(Number(el.dataset.perm)); return; }
  if (el.dataset.sid) { const it = S().stack.find(x => x.sid === Number(el.dataset.sid)); if (it) look(it.card ?? it.src); return; }
  if (el.dataset.act === "known") openLibrary();
}
$("board").addEventListener("click", boardTap);
$("board3d").addEventListener("click", boardTap);
$("hand").addEventListener("click", e => {
  const b = e.target.closest("[data-card]");
  if (b) cardTap(Number(b.dataset.card));
});

/** A card read: in the middle of the table when that's free, else (a question or a target being chosen holds it) in a sheet over it. */
function look(id) {
  if (id == null) return;
  if (question() || ui.arm || ui.tap) { openCard(id); return; }
  ui.look = ui.look?.id === id ? null : { id, at: placeOf(S(), id) };
  draw();
}
/** Where a card read is: on the table or in your hand (else nowhere it's read from). */
const placeOf = (s, id) => (s?.bf.some(p => p.id === id) ? "bf" : s?.hand[V?.seat ?? 0]?.includes(id) ? "hand" : "");
function cardTap(id) {
  // a question up (the mulligan, a card to put away): the card is read in its sheet, and chosen there
  if (question()) { openCard(id); return; }
  // a second tap on a card with exactly one thing to do does it
  if (ui.look?.id === id && canAct()) {
    const a = lookActions();
    if (a.length === 1) { a[0].fn(); return; }
  }
  look(id);
}
function permTap(id) {
  const q = question(), p = perm(S(), id);
  if (!p) return;
  if (ui.tap) { tapPick(id); return; }
  if (q?.pick === "attack") {
    if (!S().pending.ids.includes(id)) { look(id); return; }
    ui.atk = ui.atk.includes(id) ? ui.atk.filter(x => x !== id) : [...ui.atk, id];
    draw();
    return;
  }
  if (q?.pick === "block") {
    const pend = S().pending;
    if (pend.blockers.includes(id)) {
      if (ui.blk.some(([b]) => b === id)) ui.blk = ui.blk.filter(([b]) => b !== id);
      else ui.blkSel = ui.blkSel === id ? null : id;
    } else if (pend.attackers.includes(id) && ui.blkSel != null) {
      ui.blk = [...ui.blk.filter(([b]) => b !== ui.blkSel), [ui.blkSel, id]];
      ui.blkSel = null;
    } else look(id);
    draw();
    return;
  }
  look(id);
}
/** A pick made from a card's sheet: in or out of the hand's picks (bottom, discard, put back), or the order of the top cards. */
function pickTap(id) {
  const q = question();
  if (q?.pick && ["bottom", "discard", "putback"].includes(q.pick)) {
    const i = ui.picks.indexOf(id);
    if (i >= 0) ui.picks.splice(i, 1);
    else if (q.n === 1) ui.picks = [id];
    else if (ui.picks.length < q.n) ui.picks.push(id);
  } else if (S().pending?.t === "order") ui.order = ui.order.includes(id) ? ui.order.filter(x => x !== id) : [...ui.order, id];
  closeCard();
  draw();
}

// ---------- a card read in full, in a sheet ----------
function openCard(id) {
  if (id == null || !Number.isInteger(id)) return;
  CARD = { id };
  fillCard();
  if (!$("cardDlg").open) $("cardDlg").showModal();
}
function closeCard() { CARD = null; if ($("cardDlg").open) $("cardDlg").close(); }
/** What the card's sheet offers to do with it: the question's pick, when the card is one it picks among. */
function cardActs(id) {
  const s = S(), q = question();
  if (!q) return [];
  if (q.pick && ["bottom", "discard", "putback"].includes(q.pick) && s.hand[V.seat].includes(id)) {
    const at = ui.picks.indexOf(id);
    if (at >= 0) return [{ label: q.pick === "putback" ? "Take it back" : "Keep it", fn: () => pickTap(id) }];
    const full = q.n > 1 && ui.picks.length >= q.n;
    const label = q.pick === "bottom" ? "Put on the bottom" : q.pick === "discard" ? "Discard it" : ui.picks.length === 0 ? (q.n > 1 ? "Put back on top" : "Put it back") : "Put back under it";
    return [{ label, kind: "primary", off: full, sub: full ? `${q.n} chosen` : "", fn: () => pickTap(id) }];
  }
  if (s.pending.t === "order" && s.pending.cards.includes(id)) {
    const at = ui.order.indexOf(id);
    return [at >= 0 ? { label: "Take it back", fn: () => pickTap(id) } : { label: ui.order.length ? `Put it ${["", "second", "third"][ui.order.length] || "next"}` : "Put it on top", kind: "primary", fn: () => pickTap(id) }];
  }
  return [];
}
function fillCard() {
  if (!CARD) return;
  const id = CARD.id, full = nm(id), halves = HALVES[full] || [full], p = perm(S(), id);
  $("cardHead").innerHTML = `<span>${esc(full)}</span>${halves.length === 1 ? pips(CARDS[halves[0]].cost) : ""}`;
  const faces = halves.map(h => {
    const d = CARDS[h];
    return `<div class="dd-cd">${halves.length > 1 ? `<div class="dd-dh"><b>${esc(h)}</b>${pips(d.cost)}</div>` : ""}<div class="dd-dt">${esc(typeLine(d))}</div><p>${esc(d.text)}</p></div>`;
  }).join("");
  $("cardBody").innerHTML = faces + (p ? `<p class="dd-state">${esc(stateWords(p))}</p>` : "");
  CARD_GO = cardActs(id);
  $("cardGo").innerHTML = CARD_GO.map((b, i) => `<button type="button" class="btn dd-btn${b.kind === "primary" ? " primary" : ""}" data-c="${i}" ${b.off ? "disabled" : ""}><b>${esc(b.label)}</b>${b.sub ? `<small>${esc(b.sub)}</small>` : ""}</button>`).join("");
  $("cardGo").hidden = !CARD_GO.length;
}
$("cardGo").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b && !b.disabled) CARD_GO[Number(b.dataset.c)]?.fn(); });
$("cardClose").addEventListener("click", closeCard);
$("cardDlg").addEventListener("click", e => { if (e.target === $("cardDlg")) closeCard(); });   // a tap outside the sheet
$("cardDlg").addEventListener("close", () => { CARD = null; });

// ---------- sheets: the question's list, the graveyard, the library ----------
function syncDialogs(q) {
  const dlg = $("askDlg");
  if (q?.dlg && !ui.dlgOff) {
    $("askHead").textContent = q.dlg.title;
    const d = q.dlg, rows = d.rows || [];
    ASK = [];
    // a row that is a card has a second button beside it, to read the card first
    const opt = r => `<button type="button" class="btn dd-opt${r.on ? " primary" : ""}${r.ring && RING.has(r.ring) ? " advised" : ""}" data-d="${ASK.push(r) - 1}"><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</button>`;
    const btn = r => (r.card == null ? opt(r) : `<div class="dd-optrow">${opt(r)}<button type="button" class="btn dd-info" data-look="${r.card}" aria-label="Read ${esc(nm(r.card))}">?</button></div>`);
    const sections = [];                           // a heading starts a new list of options
    for (const r of rows) { if (r.head || !sections.length) sections.push({ head: r.head, rows: [] }); if (!r.head) sections[sections.length - 1].rows.push(r); }
    $("askBody").innerHTML = `${d.note ? `<p class="dd-ask-note">${esc(d.note)}</p>` : ""}${sections.map(sec => `${sec.head ? `<h4>${esc(sec.head)}</h4>` : ""}<div class="dd-opts${d.cols ? " cols" : ""}">${sec.rows.map(btn).join("")}</div>`).join("")}${d.none ? `<div class="dd-opts none">${btn(d.none)}</div>` : ""}`;
    if (!dlg.open) { dlg.showModal(); document.activeElement?.blur?.(); }   // opened by the game, not a tap: no focus ring on its first button
  } else if (dlg.open) dlg.close();
  if ($("viewDlg").open) fillView();
  if ($("cardDlg").open) fillCard();
}
let ASK = [];
$("askBody").addEventListener("click", e => {
  const r = e.target.closest("[data-look]");
  if (r) { openCard(Number(r.dataset.look)); return; }
  const b = e.target.closest("[data-d]");
  if (b) ASK[Number(b.dataset.d)]?.fn();
});
// closing the question's sheet to look at the table leaves its button in the controls
$("askLook").addEventListener("click", () => { ui.dlgOff = true; draw(); });
$("askDlg").addEventListener("cancel", e => { e.preventDefault(); ui.dlgOff = true; draw(); });

let VIEW = "";                                     // "yard" | "lib" | "log" while that sheet is open
function openYard() { VIEW = "yard"; fillView(); if (!$("viewDlg").open) $("viewDlg").showModal(); }
function openLibrary() { VIEW = "lib"; fillView(); if (!$("viewDlg").open) $("viewDlg").showModal(); }
/** The whole log (the 3D view shows its latest line), opened at its foot, the newest. */
function openLog() {
  VIEW = "log";
  fillView();
  const dlg = $("viewDlg");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = dlg.scrollHeight;
}
function closeView() { if ($("viewDlg").open) $("viewDlg").close(); }
let VROWS = [];
function fillView() {
  const s = S(), body = $("viewBody");
  if (!s) return;
  if (VIEW === "log") {
    const dlg = $("viewDlg"), atFoot = dlg.scrollTop + dlg.clientHeight >= dlg.scrollHeight - 4;
    $("viewHead").textContent = "Log";
    body.innerHTML = `<ol class="dd-logsheet">${s.log.map(e => `<li>${esc(words(e.t))}</li>`).join("")}</ol>`;
    if (atFoot) dlg.scrollTop = dlg.scrollHeight;   // following the game, unless you've scrolled back to read
    VROWS = [];
    return;
  }
  if (VIEW === "lib") {
    $("viewHead").textContent = `Library · ${s.lib.length}`;
    const me = V.seat ?? 0, known = s.kn.filter(([id, m]) => (m & (1 << me)) && s.lib.includes(id)).map(([id]) => id).sort((a, b) => s.lib.indexOf(a) - s.lib.indexOf(b));
    const theirs = V.seat != null ? knownIn(s, 1 - me, me) : [];
    if (!sees()) {
      body.innerHTML = `<p class="dd-ask-note">One library for both players. It was shuffled at the start.</p>
        <p class="dd-sub">Revealed cards aren’t shown (Menu, Show revealed cards): remember what you have seen go there, or looked at. ${esc(nameOf(1 - me))} holds ${s.hand[1 - me].length}.</p>`;
      VROWS = [];
      return;
    }
    body.innerHTML = `<p class="dd-ask-note">One library for both players. It was shuffled at the start; you know a card only if you have seen it go there or looked at it.</p>
      ${known.length ? `<ol class="dd-known">${known.map(id => `<li><span>${s.lib.indexOf(id) + 1}</span><button type="button" class="dd-chip dd-name" data-look="${id}">${esc(nm(id))}</button></li>`).join("")}</ol>` : `<p class="dd-sub">You know no card in it.</p>`}
      <h4>${esc(nameOf(1 - me))}’s hand · ${s.hand[1 - me].length}</h4>
      ${theirs.length ? `<p class="dd-sub">You saw these go there: ${theirs.map(chip).join(" ")}</p>` : `<p class="dd-sub">You know none of its cards.</p>`}`;
    VROWS = [];
    return;
  }
  const armG = ui.arm && ui.arm.moves[0].targets[0].k === "g";
  $("viewHead").textContent = armG ? "Choose a card" : `Graveyard · ${s.yard.length}`;
  const by = new Map();
  for (let i = s.yard.length - 1; i >= 0; i--) { const id = s.yard[i], k = DECK[id]; if (!by.has(k)) by.set(k, []); by.get(k).push(id); }
  VROWS = [];
  const rows = [];
  for (const [name, ids] of by) {
    const half = HALVES[name] ? HALVES[name][1] : name;
    const casts = MV.filter(m => m.t === "cast" && m.from === "yard" && DECK[m.card] === name);
    let btn = "";
    if (armG) {
      const hit = ui.arm.moves.find(m => m.targets[0].id === ids[0]);
      if (!hit) continue;
      VROWS.push(() => act2(hit));
      btn = `<button type="button" class="btn dd-sm primary" data-v="${VROWS.length - 1}">Choose</button>`;
    } else if (casts.length) {
      const label = CARDS[half].flashback ? `Flashback ${costWords(CARDS[half].flashback)}` : `Cast ${half}`;
      VROWS.push(() => { closeView(); cast(casts.map(m => ({ ...m, card: ids[0] })), half); });
      btn = `<button type="button" class="btn dd-sm primary" data-v="${VROWS.length - 1}">${esc(label)}</button>`;
    }
    rows.push(`<li><button type="button" class="dd-chip dd-name" data-look="${ids[0]}">${esc(name)}</button>${ids.length > 1 ? `<span class="n">× ${ids.length}</span>` : ""}${btn}</li>`);
  }
  body.innerHTML = `${rows.length ? `<ol class="dd-yard">${rows.join("")}</ol>` : `<p class="dd-sub">${armG ? "No card here is a legal target." : "Empty."}</p>`}
    ${s.exile.length && !armG ? `<h4>Exiled</h4><p class="dd-sub">${s.exile.map(id => esc(nm(id))).join(", ")}</p>` : ""}`;
}
const act2 = m => { closeView(); return act(m); };
$("viewBody").addEventListener("click", e => {
  const r = e.target.closest("[data-look]");
  if (r) { openCard(Number(r.dataset.look)); return; }
  const b = e.target.closest("[data-v]");
  if (b) VROWS[Number(b.dataset.v)]?.();
});
$("viewClose").addEventListener("click", () => { closeView(); if (ui.arm) { ui.arm = null; draw(); } });
$("viewDlg").addEventListener("close", () => { VIEW = ""; });

// ---------- why: the coach's choices side by side ----------
const pc = x => `${Math.round(100 * x)}%`;
function showWhy(which) {
  const v = V, s = v?.state;
  if (!s) return;
  let head = "The coach’s choices", html = "";
  const listHtml = (r, st, seat, mine) => {
    const rows = r.list.slice(0, 8).map((c, i) => {
      const you = mine && sameMove(c.move, mine);
      const figs = Number.isFinite(c.mean) ? `${pc(c.mean)} to win${c.se ? ` (±${Math.max(1, Math.round(100 * c.se))})` : ""} · ${c.n} deals${i && c.vs ? ` · the coach’s better in ${c.better}, worse in ${c.worse}` : ""}` : "the only move";
      return `<li class="${i === 0 ? "best" : ""}${you ? " mine" : ""}"><b>${esc(moveSaid(c.move, st, seat))}</b>${i === 0 ? " · the coach’s choice" : you ? " · yours" : ""}<span class="dd-fig">${esc(figs)}</span></li>`;
    }).join("");
    const extra = mine && !r.list.slice(0, 8).some(c => sameMove(c.move, mine)) ? r.list.find(c => sameMove(c.move, mine)) : null;
    const yours = extra ? `<li class="mine"><b>${esc(moveSaid(extra.move, st, seat))}</b> · yours<span class="dd-fig">${pc(extra.mean)} to win · ${extra.n} deals</span></li>` : "";
    // the rule of thumb for the coach's move against yours (or the next best), then what the deals showed
    const yoursToo = mine && !sameMove(mine, r.best);
    const vs = yoursToo ? r.list.find(c => sameMove(c.move, mine)) : r.list.find(c => !sameMove(c.move, r.best));
    const why = [...reasons(st, seat, r.best, yoursToo ? mine : vs?.move), ...(vs ? evidence(r.list[0], vs, st, seat, { yours: yoursToo }) : [])].slice(0, 3);
    return `${why.length ? `<p>${esc(why.join(" "))}</p>` : ""}<ol class="dd-choices">${rows}${yours}</ol><p class="dd-why-note">${esc(whyNote(r))}</p>`;
  };
  if (which === "review") {
    head = "Your play this game";
    const differs = notes.filter(n => !n.agreed).sort((a, b) => b.gap - a.gap);
    html = `<p>The coach agreed with ${notes.length - differs.length} of your ${notes.length} decisions. Where it would have played otherwise, the costliest first:</p><ol class="dd-review">${differs.slice(0, 3).map(n => `<li>${esc(n.words)}</li>`).join("")}</ol>`;
  } else if (word && !(myDecision() && advised(v))) {
    head = "Your last move";
    html = `<p>${esc(word.words)}</p>${listHtml(word.r, word.state, word.seat, word.mine)}`;
  } else {
    const a = hinted?.key === decisionOf(v) ? { r: hinted.r, state: s, seat: v.seat } : advice?.key === decisionOf(v) ? advice : null;
    if (!a) return;
    html = listHtml(a.r, a.state, a.seat, null);
  }
  $("whyHead").textContent = head;
  $("whyBody").innerHTML = html;
  if (!$("whyDlg").open) $("whyDlg").showModal();
}
$("whyClose").addEventListener("click", () => $("whyDlg").close());
$("whyDlg").addEventListener("click", e => { if (e.target === $("whyDlg")) $("whyDlg").close(); });

// ---------- a game's end ----------
/** Who the game was against, for the record: a person at the table, or the computer at the level it was set to. */
function opponentOf(v) { return v.seats?.[1 - v.seat]?.uid ? "friend" : opts.level; } // a declaration: onOver runs while the page starts, with a finished game
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winner === v.seat;
  // a finished game opened again (a reload, the other phone) is over again: it counts once, by when it began
  const before = read(RECORD, {}), after = addResult(before, { won, drawn: v.state.winner < 0, vs: opponentOf(v), game: v.G.started });
  if (after !== before) { write(RECORD, after); noteStreak("dandan", won); }
  setTimeout(() => { if (V?.over) showEnd(V); }, 1100);
}
// the end of a game: who won and why, how the game went (the judge's chance of winning at the start of each turn, which
// the rules note as it's played: tap a turn for its chances), and the record
let endCurve = null, endNames = [], endSel = -1;
function paintChart() {
  $("endChart").innerHTML = chartSvg(endCurve, endSel);
  $("endRead").textContent = endSel >= 0 ? readoutOf(endCurve, endSel, endNames) : "Tap a turn on the chart for its chances.";
}
function pickPoint(e) {
  const r = $("endChart").querySelector("svg")?.getBoundingClientRect();
  if (!r?.width) return;
  endSel = pointAt(endCurve, ((e.clientX - r.left) / r.width) * BOX.w);
  paintChart();
}
function stepPoint(e) {
  const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (!k || !$("endChart")) return; // no chart on this game's sheet (the one before's curve is still in endCurve)
  e.preventDefault();
  const n = endCurve.points.length + (endCurve.end == null ? 0 : 1);
  endSel = Math.max(0, Math.min(n - 1, (endSel < 0 ? (k > 0 ? -1 : n) : endSel) + k));
  paintChart();
}
function showEnd(v) {
  const s = v.state, mine = s.winner === v.seat;
  $("endHead").textContent = s.winner < 0 ? "A drawn game" : mine ? "You win" : `${nameOf(s.winner)} wins`;
  const loser = nameOf(1 - s.winner), you = isMe(1 - s.winner);
  const why = s.winner < 0 ? "Both players lost on the same check."
    : s.why === "library" ? `${you ? "You" : loser} drew from an empty library.`
    : s.why === "conceded" ? `${you ? "You" : loser} conceded.`
    : `${you ? "You are" : `${loser} is`} out of life.`;
  endCurve = curveOf(s, v.seat);
  endNames = [nameOf(0), nameOf(1)];
  endSel = -1;
  const drawn = worthDrawing(endCurve), rec = recordOf(read(RECORD, {})), vs = opponentOf(v);
  const dots = rec.last.map(c => `<i class="${c === "W" ? "won" : c === "D" ? "drawn" : "lost"}" title="${c === "W" ? "Won" : c === "D" ? "Drawn" : "Lost"}"></i>`).join("");
  $("endBody").innerHTML = `<p>${esc(why)}</p>
    <ul class="dd-standings"><li class="${isMe(0) ? "me" : ""}"><span>${esc(nameOf(0))}</span><b>${s.life[0]}</b></li><li class="${isMe(1) ? "me" : ""}"><span>${esc(nameOf(1))}</span><b>${s.life[1]}</b></li></ul>
    ${drawn ? `<h3 class="dd-end-h">How the game went</h3>
    <div id="endChart" class="dd-adv-wrap"></div>
    <p id="endRead" class="dd-adv-read" aria-live="polite"></p>
    <p class="dd-adv-cap">${esc(captionOf(endCurve, endNames))} <span class="dd-adv-src">Rated by the computer's judge, which sees both hands.</span></p>` : `<p class="dd-end-note">Over too soon for a chart.</p>`}
    <h3 class="dd-end-h">Your record</h3>
    <p class="dd-rec-top"><b>Won ${rec.won} of ${rec.played}</b> <span>${rec.pct}%</span></p>
    <ul class="dd-rec-rows">${rec.rows.map(r => `<li class="${r.key === vs ? "on" : ""}"><span>${esc(r.label)}</span><b>${r.won} of ${r.played}</b><i>${r.pct}%</i></li>`).join("")}</ul>
    ${rec.last.length > 1 ? `<p class="dd-rec-last" aria-label="The last ${rec.last.length} results, the newest at the right">${dots}</p>` : ""}
    <p class="dd-end-note">${s.turn ? `${s.turn} turn${s.turn === 1 ? "" : "s"}` : "Over before the first turn"}. ${s.lib.length} cards were left in the library. The loser goes first next game.</p>`;
  if (drawn) {
    paintChart();
    $("endChart").addEventListener("click", pickPoint);
  }
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  page.deal({}, 2);
}
/** Whether you may concede: a game of yours still on (a partner's game watched from the games screen isn't yours). */
const mayConcede = () => !!V?.G && !V.over && V.seat != null && !IN_FRAME;
/** Menu, Concede: the game lost there and then, whoever's decision it is, once you've said so (it counts as a loss). */
async function concede() {
  if (!mayConcede() || !confirm(`Concede this game to ${nameOf(1 - V.seat)}? It counts as a loss.`)) return;
  const why = await page.move({ t: "concede" });
  if (why) toast(why);
}
$("endAgain").addEventListener("click", newGame);
$("endDlg").addEventListener("keydown", stepPoint); // the arrows step along the chart from wherever focus is in the sheet
$("endTable").addEventListener("click", () => $("endDlg").close());
/** Menu, Reset win/loss record: the games counted and the run of wins back to nothing, once you've said so. */
function resetRecord() {
  const r = recordOf(read(RECORD, {}));
  if (!confirm(`Reset your record (${r.won} won of ${r.played} games) and your run of wins? This can't be undone.`)) return;
  // the game counted last stays noted: a finished game opened again must not be counted into the new record
  write(RECORD, { ...emptyRecord(), game: read(RECORD, {}).game });
  write(STREAK, { now: 0, best: 0 });
  toast("Record reset");
}

// ---------- the review ----------
// Menu, Review your play: what the coach has kept of your moves (Coach: Review, Check or Always; dandan-review.js), the
// mistakes that come most often and the plays it disagreed with by 5 points or more, one theme's or all
let reviewView = { kind: null, order: "cost" };
function paintReview() { $("reviewBody").innerHTML = reviewHtml(read(REVIEW, null), reviewView); }
function openReview() {
  reviewView = { kind: null, order: "cost" };
  paintReview();
  if (!$("reviewDlg").open) $("reviewDlg").showModal();
}
$("reviewBody").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if ("kind" in b.dataset) {
    reviewView.kind = b.dataset.kind || null;
    paintReview();
    $("reviewBody").querySelector(".dd-rv-playsh")?.scrollIntoView({ block: "start" });
  } else if (b.dataset.order) { reviewView.order = b.dataset.order; paintReview(); }
  else if (b.dataset.clear && confirm("Clear everything the review has kept? This can't be undone.")) { write(REVIEW, emptyReview()); reviewView.kind = null; paintReview(); }
});
$("reviewClose").addEventListener("click", () => $("reviewDlg").close());

// ---------- the log, copied (Menu) ----------
// For checking a game elsewhere (a move of the computer's that looked wrong, the coach's word on one of yours): every
// line of the log, then the table as your seat sees it now (of the other hand only what you've seen go there), then the
// coach's verdicts on your decisions this game.
function logText() {
  const s = S(), me = V.seat ?? 0, foe = 1 - me, level = LEVEL_NAMES.find(([k]) => k === opts.level)?.[1];
  // in the log's own words, seats as {s0} and {s1}, so "You" reads as it does there
  const now = s.over ? (s.winner < 0 ? "Over: a draw." : `Over: {s${s.winner}} won.`)
    : `{s${s.active}}'s ${STEP_WORDS[s.step] || s.step}, turn ${s.turn}.${V.toMove != null ? ` {s${V.toMove}} to ${s.pending ? "answer" : "move"}.` : ""}`;
  const head = words(`Dandan (Forgetful Fish), game ${V.G.seq}: {s${me}} against {s${foe}}${V.seats[foe]?.bot ? ` (the computer, ${level})` : ""}.\n${now}`);
  const gone = (s.log[0]?.n || 1) - 1, lost = gone ? [`(the first ${gone === 1 ? "line wasn't" : `${gone} lines weren't`} kept)`] : [];
  return [head, "", ...lost, ...s.log.map(e => words(e.t)), "", ...tableWords(s, me), ...coachWords()].join("\n");
}
/** The table in words, as `me` sees it. */
function tableWords(s, me) {
  const list = a => (a.length ? a.join(", ") : "none");
  const counted = a => { const c = new Map(); for (const x of a) c.set(x, (c.get(x) || 0) + 1); return [...c].map(([x, k]) => (k > 1 ? `${x} ×${k}` : x)); };
  const permWords = p => {
    const tags = [];
    if (isCreature(p)) {
      const [a, b] = pt(p), base = defOf(p.id).pt;
      if (a !== base[0] || b !== base[1]) tags.push(`${a}/${b}`);
      if (s.combat?.att.includes(p.id)) tags.push("attacking");
      if (p.walk) tags.push("islandwalk");
      if (needType(p) !== "Island") tags.push(`wants ${needType(p)}`);
    }
    if (p.tc && isLand(p)) tags.push(`now ${typesOf(p).join(" and ") || "of no basic type"}`);
    if (p.tapped) tags.push("tapped");
    return `${nm(p.id)}${tags.length ? ` (${tags.join(", ")})` : ""}`;
  };
  const side = seat => {
    const bf = s.bf.filter(p => p.ctl === seat).sort((a, b) => isCreature(b) - isCreature(a) || landOrder(a, b)).map(permWords);
    const hand = seat === me && V.seat != null ? `hand ${list(s.hand[seat].map(id => DECK[id]).sort())}`
      : `hand of ${s.hand[seat].length}${V.seat != null && knownIn(s, seat, me).length ? `, known: ${list(knownIn(s, seat, me).map(id => DECK[id]))}` : ""}`;
    const pool = poolOf(s, seat);
    return `${nameOf(seat)}: ${s.life[seat]} life; ${list(counted(bf))}; ${hand}${pool ? `; ${pool} floating` : ""}.`;
  };
  // the library: how many, and the cards in it you know, by place from the top
  const known = [];
  const nth = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
  if (V.seat != null) s.lib.forEach((id, i) => {
    if (knOf(s, id) & (1 << me)) known.push(`${DECK[id]} ${i === 0 ? "on top" : i === s.lib.length - 1 ? "at the bottom" : `${nth(i + 1)} from the top`}`);
  });
  const stack = s.stack.map(it => `${STACK_WORDS[it.name] || it.name}${it.kind === "trigger" ? ", triggered" : ""} (${nameOf(it.ctl)})${it.targets.length ? ` on ${it.targets.map(t => targetWords(s, t)).join(", ")}` : ""}`);
  return [
    "The table now:", side(me), side(1 - me),
    ...(stack.length ? [`Stack, the last to resolve first: ${stack.reverse().join("; ")}.`] : []),
    `Graveyard${s.yard.length ? `, the oldest first: ${list(s.yard.map(id => DECK[id]))}` : ": empty"}.`,
    ...(s.exile.length ? [`Exile: ${list(s.exile.map(id => DECK[id]))}.`] : []),
    `Library: ${s.lib.length} cards${known.length ? `; known to you: ${known.join(", ")}` : ""}.`,
  ];
}
/** A target in words, for the copied table. */
function targetWords(s, t) {
  if (t.k === "p") return nameOf(t.seat);
  if (t.k === "s") return s.stack.find(x => x.sid === t.sid)?.name || "a spell";
  const p = perm(s, t.id);
  if (p) return `${nm(p.id)} (${nameOf(p.ctl)})`;
  return DECK[t.id] ?? "a card";
}
/** The coach's verdicts on your decisions this game, the costliest differences first. */
function coachWords() {
  if (!notes.length) return [];
  const differs = notes.filter(n => !n.agreed).sort((a, b) => b.gap - a.gap);
  return ["", `The coach agreed with ${notes.length - differs.length} of your ${notes.length} decisions${differs.length ? ". Where it differed:" : "."}`, ...differs.map(n => `- ${n.words}`)];
}
function copyLog() {
  if (!V?.G) { toast("No game to copy yet"); return; }
  copyOut("Log", logText());
}
/** Words to the clipboard within the tap that asked for them; where the browser refuses, a sheet to copy them by hand. */
function copyOut(what, text) {
  const sheet = () => { $("copyHead").textContent = what; $("copyText").value = text; $("copyDlg").showModal(); $("copyText").select(); };
  if (!navigator.clipboard?.writeText) { sheet(); return; }
  navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), sheet);
}

// ---------- rules, menu ----------
function showRules() {
  const byType = t => Object.entries(CARDS).filter(([, d]) => d.type === t);
  const row = ([name, d]) => `<li><div class="dd-rh"><b>${esc(name)}</b>${pips(d.cost)}</div><p>${esc(d.text)}</p></li>`;
  const count = n => DECK.filter(x => x === n).length;
  $("rulesBody").innerHTML = `
    <p>Dandan is a way of playing <i>Magic: The Gathering</i> with eighty cards and no deck-building: one communal deck, known in that world as Forgetful Fish. Both players draw from <b>one library</b> and every card that is used goes to <b>one graveyard</b>, which either may use. A card in your hand, or one you put on the table, is yours.</p>
    <p><b>Winning.</b> Each starts on 20 life. The ten Dandâns are the only cards that do damage; the game ends when someone has no life left, or has to draw from an empty library.</p>
    <p><b>The Dandân</b> is a 4/1 for two blue. It can’t attack unless the defending player controls an Island, and is sacrificed as soon as its controller controls none. So the game is about Islands: yours keep your Dandâns alive, theirs let you attack. Take their last Island away (Mind Bend can turn it into a Swamp for good) and their Dandân is gone, and yours can’t reach them.</p>
    <p><b>A turn.</b> Untap, upkeep, draw (the player who goes first doesn’t draw on the first turn), a main phase to play one land and cast anything, attack, blocks, damage, a second main phase, the end step; a hand of more than seven is cut down. Blue instants may be cast any time you hold priority, which is why the game stops for you whenever you could act: the other player’s spell on the stack, their attack, the end of their turn. Where you could do nothing, it moves on by itself.</p>
    <p><b>Who draws next.</b> The library is shared, so the card on top goes to whoever draws next: on your turn, after your draw, that is the other player; on theirs, you. A card put on top in the open (a countered spell) is known to both, and a cantrip in their upkeep takes it before they draw.</p>
    <p><b>The stack.</b> A spell waits there until both players pass in a row; the last one cast resolves first. Memory Lapse counters it (to the top of the library, so the next draw is known), Narset’s Reversal copies it, Commit puts it second from the top. Menu, <i>Hold priority</i>, lets you cast a second spell before the first can be answered.</p>
    <p><b>Mana</b> a land makes and a cost doesn’t use (Izzet Boilerworks’ red, paying for a blue spell) floats until the step ends, and pays for the next thing you do in it.</p>
    <p><b>Owners.</b> A spell or a permanent belongs to the player who cast or played it: Repulse returns a Dandân to its caster’s hand.</p>
    <p><b>Mulligans.</b> Your first mulligan is free: seven new cards, none put on the bottom. A hand with fewer than two lands or fewer than two spells may also be shown and thrown back free, as often as it comes, and doesn't count. Every other mulligan draws seven and, when you keep, puts one on the bottom for each mulligan after the free first. The loser of the last game goes first.</p>
    <h3>Where it plays differently from the paper game</h3>
    <ul class="dd-notes">
      <li>The game moves on by itself where nobody could act. You are asked in your own main phases, at attack and blocks, at the end step when you hold a card that could be cast, and with anything on the stack; at an upkeep when you know the card about to be drawn and could act on it, or, theirs, when you hold a Brainstorm or a Predict. There is no stop at the start or end of combat or in the draw step: what could be done there is done as well at the declarations or the end step.</li>
      <li>Damage from a blocked attacker is dealt for you: enough to kill each blocker in turn. Two Dandâns blocking one attacker is allowed.</li>
      <li>Predict mills the one library whichever player it names, so it names none. Mind Bend changes basic land types: no permanent in this deck has a colour word to change.</li>
      <li>Mystic Sanctuary’s “may” is answered as its card is chosen, when it triggers: choosing none is declining.</li>
    </ul>
    <h3>The cards</h3>
    ${[["Creature", "creature"], ["Instants", "instant"], ["Sorceries", "sorcery"], ["Lands", "land"]].map(([t, k]) => `<h4>${t}</h4><ul class="dd-cards">${byType(k).map(row).join("")}</ul>`).join("")}
    <p class="dd-rules-note">Eighty cards: ${["Island", "Dandân", "Memory Lapse", "Take Inventory"].map(n => `${count(n)} ${n}`).join(", ")}, and the rest in twos. Texts are in our own words; the card names and the format belong to their makers.</p>`;
  $("rulesDlg").showModal();
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  if (mayConcede()) play.append(action("Concede", concede, ""));
  page.menu(play);
  play.append(action("The rules and cards", showRules, "link"));
  play.append(action("Copy log", copyLog, "link"));
  if (opts.full) play.append(action("All games", () => $("appsBtn").click(), "link"));   // the title that opens them is put away
  const set = part(body, "settings");
  set.append(choice("View", VIEWS, opts.view, v => { opts.view = v; saveOpts(); showView(); draw(); }));
  // Thinking: Hard's and the coach's, shown while either is there (at a table the phone that runs the computer thinks
  // on its own thread, at Quick; each phone's coach at its own setting)
  const time = line("");
  const thinkers = () => [opts.level === "hard" && !page.atTable ? "Hard" : "", opts.coach !== "off" ? "the coach" : ""].filter(Boolean);
  const showThinking = () => {
    const who = thinkers();
    for (const el of thinking) el.hidden = !who.length;
    time.textContent = `${who.join(" and ").replace(/^t/, "T")}: ${THINK_TIME[opts.think]}`;
  };
  const thinking = [choice("Thinking", THINKING, opts.think, v => { opts.think = v; saveOpts(); showThinking(); rethink(); }), time];
  set.append(choice("Computer player", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); showThinking(); page.runner.kick(); }), ...thinking);
  showThinking();
  set.append(choice("Computer's pace", PACES, opts.pace, v => { opts.pace = v; saveOpts(); draw(); page.runner.kick(); }));
  const review = read(REVIEW, null), plays = review?.m || 0;
  const reviewNote = line("Review: nothing shows while you play. The coach weighs each move and keeps where it would have played otherwise.");
  const showReviewNote = () => { reviewNote.hidden = opts.coach !== "review"; };
  set.append(choice("Coach", COACH, opts.coach, v => { opts.coach = v; saveOpts(); word = null; hinted = null; showThinking(); showReviewNote(); draw(); }), reviewNote);
  showReviewNote();
  set.append(action(plays ? `Review your play (${plays} to go through)` : "Review your play", openReview, ""));
  set.append(toggle("Full screen", opts.full, fullScreen));
  set.append(toggle("Hold priority when I cast", opts.hold, on => { opts.hold = on; saveOpts(); paintToggles(); }));
  set.append(line("Holding priority lets you cast again before the other player can answer the first spell. A card you cycle always holds it, so you can answer your own cycling."));
  set.append(toggle("Choose which lands to tap", opts.manual, on => { opts.manual = on; saveOpts(); paintToggles(); }));
  set.append(line("With different lands to pay with, you tap them yourself: so an Izzet Boilerworks can return a tapped one."));
  set.append(toggle("Show revealed cards", sees(), on => { opts.reveals = on; saveOpts(); forgetKnown(!on); word = null; draw(); }));
  set.append(line("Off: nothing marks what you have seen of the other hand or the library, and the coach doesn’t name it. You remember it yourself."));
  const r = recordOf(read(RECORD, {})), st = read(STREAK, { now: 0, best: 0 });
  const about = part(body, "about");
  about.append(line(r.played ? `Won ${r.won} of ${r.played} games (${r.pct}%)${st.best > 1 ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (r.played || st.best) about.append(action("Reset win/loss record", resetRecord, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the buttons at the top: hold priority, tap my own lands ----------
// The menu's two switches, always to hand (29 October 2026, Korbi): lit while on, in the header and in full screen too
const TOGGLES = [["holdBtn", "hold", "Hold priority when I cast"], ["tapBtn", "manual", "Choose which lands to tap"]];
function paintToggles() {
  $("quick").hidden = IN_FRAME;
  for (const [id, key] of TOGGLES) $(id).setAttribute("aria-pressed", String(!!opts[key]));
}
for (const [id, key, label] of TOGGLES) {
  $(id).addEventListener("click", () => {
    opts[key] = !opts[key];
    saveOpts();
    paintToggles();
    toast(`${label}: ${opts[key] ? "on" : "off"}`);
  });
}
paintToggles();

// ---------- full screen ----------
// The header gives way to the menu's button, faded at the top right (the title, the partner's pill and Rules go: the
// rules and the other games are in the menu); turned on from the menu, the browser's own full screen too, where it has
// one and isn't an app on the home screen already.
const showFull = () => { $("app").classList.toggle("dd-full", !!opts.full); fitCorner(); };
// the room the corner takes (the menu's button and the two switches) in full screen, for the table's other side to leave
function fitCorner() {
  const r = document.querySelector("#app > .top").getBoundingClientRect();
  $("app").style.setProperty("--dd-corner", opts.full ? `${Math.ceil(innerWidth - r.left + 6)}px` : "");
}
new ResizeObserver(fitCorner).observe(document.querySelector("#app > .top"));
addEventListener("resize", fitCorner);
function fullScreen(on) {
  opts.full = on;
  saveOpts();
  showFull();
  try {
    if (on && document.fullscreenEnabled && !document.fullscreenElement && !matchMedia("(display-mode: standalone)").matches) document.documentElement.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch { /* no full screen to be had */ }
}
showFull();

/** The view chosen in the menu: the table as tiles (#board), or the battlefield in 3D (#board3d, dandan-3d.js). The
 *  hand, the coach's line and the buttons are the same elements in both, drawn by whichever view is showing. */
function showView() {
  const three = opts.view === "3d";
  $("app").classList.toggle("dd3", three);
  $("board").hidden = three;
  $("board3d").hidden = !three;
  table3d?.reset();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "dandan");
document.querySelector(".dd-mark").innerHTML = APPS.find(a => a.id === "dandan")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("copyClose").addEventListener("click", () => $("copyDlg").close());
table3d = createTable3d({
  view: () => V, ui: () => ui, moves: () => MV, rings: () => RING, hover: () => hover, POINTER, LAND_CODE, quiet: IN_FRAME,
  esc, pips, nameOf, isMe, short, soft: n => SOFT[n] || n, words, typeLine, stateWords, itemWords, armedKeys, targetKey, payable,
  headline, waitLine, readHead, canAct, handOrder, fetchable: () => FETCH, sees,
});
showView();
window.__dandan = { page, get view() { return V; }, get ui() { return ui; }, opts };
// the first time, a game is dealt at once: the table is the menu
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
