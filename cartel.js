// Cartel: you against computer players. Rules and the referee are in cartel-engine.js, the players in
// cartel-ai.js. Your view is built the same way theirs is: a Mind follows the events as your seat sees them,
// so the table shows exactly what you could know, no more.
import { newGame, act, respond, respondBlock, keepProof, freeReroll, freeAsk, bid, seen, mustHit, rng, ROLES, ABILITIES, RULES, totalDice } from "./cartel-engine.js";
import { Player, Mind, PERSONAS } from "./cartel-ai.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, onPause, ticks } from "./menu.js";

const $ = id => document.getElementById(id);
import { noteStreak } from "./suite.js";
const STORE = "cartel:game", TABLE = "cartel:table", PACE = "cartel:pace";
// How the computer players' moves come: each shown for a while, or each held until you tap.
const PACES = {
  fast: { label: "Fast", ms: 700 },
  steady: { label: "Steady", ms: 1600 },
  tap: { label: "Tap to continue", ms: null },
};
const ME = 0;

let g = null;                 // the game (the referee's truth)
let ais = [];                 // the computer players, by seat (null for you)
let mind = null;              // what you know
let publicMind = null;        // what everyone knows (to show which of your dice the table has seen)
let ui = null;                // your choices in progress
let timer = null;
let freeAsked = -1;           // the turn a computer player last considered its free reroll
let askAsked = -1;            // and its free question

const freshUi = () => ({ panel: null, reroll: new Set(), free: null, ask: { target: null, type: "count", f: 4, n: 15 }, claim: { ability: "bank", target: null, face: 4 }, hit: null, bid: null });
const name = i => (i === ME ? "You" : g.players[i].name);
/** "You take" / "Quant takes". */
const verb = (i, base) => (i === ME ? base : base.endsWith("s") || base.endsWith("sh") ? `${base}es` : `${base}s`);
const myPlain = () => g.players[ME].dice.filter(d => d.kind === "plain").length;
const others = () => g.players.filter(p => !p.out && p.i !== ME);
const faceLabel = f => `${f}s`;

// ---------- games ----------
/** The opponents chosen last time (personality ids), or three different ones at random. */
function chosenOpponents() {
  try { const t = JSON.parse(localStorage.getItem(TABLE)); if (Array.isArray(t) && t.length >= 2 && t.every(x => PERSONAS[x])) return t; } catch { /* first visit */ }
  const ids = Object.keys(PERSONAS).sort(() => Math.random() - 0.5);
  return ids.slice(0, 3);
}

function startGame(opponents = chosenOpponents()) {
  try { localStorage.setItem(TABLE, JSON.stringify(opponents)); } catch { /* private mode */ }
  const seats = [{ name: "You", persona: null }, ...opponents.map(id => ({ name: PERSONAS[id].name, persona: id }))];
  g = newGame(Math.floor(Math.random() * 1e9), seats);
  setup();
  loop();
}

function setup() {
  ais = g.players.map((p, i) => (p.persona ? new Player(i, g.players.length, p.persona, g.seed + 7919 * (i + 1)) : null));
  mind = new Mind(ME, g.players.length);
  publicMind = new Mind(null, g.players.length);
  ui = freshUi();
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ ...g, r: undefined, rstate: g.r.state() })); } catch { /* private mode */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (!s?.players || !s.events) return null;
    s.r = rng(s.rstate);
    delete s.rstate;
    return s;
  } catch { return null; }
}

// ---------- the loop: whoever is due moves ----------
/** The pace chosen (an earlier "fast" switch carries over as Fast). */
function pace() {
  try {
    const p = localStorage.getItem(PACE);
    if (PACES[p]) return p;
    return localStorage.getItem("cartel:fast") === "1" ? "fast" : "steady";
  } catch { return "steady"; }
}
let waiting = null;           // in Tap to continue: the next computer move, held until you tap
/**
 * Runs the next computer move after the chosen pace: a pause, or (Tap to continue) your next tap. Once you're out,
 * the rest of the game plays itself quickly.
 */
// the menu holds the computer's next move until it closes
let heldMove = null, nextMove = null;
onPause(() => { if (timer != null && nextMove) { clearTimeout(timer); timer = null; heldMove = nextMove; } },
  () => { if (heldMove) { const fn = heldMove; heldMove = null; schedule(fn); } });
function schedule(fn) {
  nextMove = fn;
  if (g.players[ME].out) { timer = setTimeout(fn, 120); return; }
  const ms = PACES[pace()].ms;
  if (ms != null) { timer = setTimeout(fn, ms); return; }
  waiting = fn;
  renderControls();
}
/** A tap anywhere on the table (not the header's buttons or a sheet) shows the next computer move. */
function tapOn(e) {
  if (!waiting || e.target.closest("header, dialog")) return;
  const fn = waiting;
  waiting = null;
  fn();
}

function loop() {
  clearTimeout(timer);
  waiting = null;
  mind.follow(g, e => seen(e, ME));
  publicMind.follow(g, e => ({ ...e, priv: undefined }));
  for (const ai of ais) ai?.sync(g, seen);
  save();
  render();
  if (g.over) { showOver(); return; }
  const c = g.pending;
  if (c?.type === "proof") {                        // a proven claim: its owner keeps the die shown or puts it back
    if (c.claimant === ME) { showProof(); return; }
    const ai = ais[c.claimant];
    schedule(() => { keepProof(g, ai.keepProof(g)); loop(); });
    return;
  }
  if (c) {
    if (c.challenger === ME) { showChallenge(); return; }
    const ai = ais[c.challenger];
    schedule(() => { if (c.type === "block") respondBlock(g, ai.challengeBlock(g)); else respond(g, ai.challenge(g)); loop(); });
    return;
  }
  if (g.turn === ME) return;                        // your controls are up
  const ai = ais[g.turn];
  schedule(() => {
    try {
      // the free move first: Legal's reroll, to hide a die the table has seen (asked once a turn)
      if (g.step === "act" && !g.freeUsed && freeAsked !== g.moves) {
        freeAsked = g.moves;
        const die = ai.free(g);
        if (die != null) { freeReroll(g, die); loop(); return; }
      }
      if (!g.askUsed && askAsked !== g.moves && g.step === "bid") {      // a question after the move, for the bid
        askAsked = g.moves;
        const q = ai.ask(g);
        if (q) { freeAsk(g, q.target, q.question); loop(); return; }
      }
      if (g.step === "act") act(g, ai.action(g)); else bid(g, ai.bid(g));
    } catch (e) {
      console.error(e);                              // a move the referee refused: fall back to the plainest legal one
      if (g.step === "act") act(g, mustHit(g) ? { type: "hit", target: others()[0]?.i ?? alive0() } : { type: "pass" });
      else bid(g, g.bid ? { call: true } : { q: 1, f: 2 });
    }
    loop();
  });
}
const alive0 = () => g.players.find(p => !p.out && p.i !== g.turn).i;

/** Your move or bid, through the referee; a refusal shows as a message. */
function play(fn) {
  try { fn(); ui = freshUi(); } catch (e) { toast(e.message.replace(/^./, c => c.toUpperCase())); return; }
  loop();
}

// ---------- rendering ----------
function render() {
  renderSeats();
  renderCentre();
  renderMine();
  renderControls();
}

// ---------- dice ----------
// Pips on a 3×3 grid; a die you can't see is a dark cup.
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}
/** A die: { face (null = hidden), kind, how ("peek" = only you know), seen (everyone has seen it) }. */
function dieSvg({ face, kind, how, seen }, size) {
  const gold = kind === "gold";
  const svg = svgEl("svg", { viewBox: "0 0 24 24", width: size, height: size, class: "ct-die", role: "img" });
  svg.setAttribute("aria-label", face == null ? `hidden ${kind} die` : `${kind} ${face}${gold ? `, ${ROLES[face]}` : ""}${how === "peek" ? ", only you know" : ""}`);
  if (face == null) {
    svgEl("rect", { x: 1.2, y: 1.2, width: 21.6, height: 21.6, rx: 5, fill: "#1A0B0F", stroke: gold ? "#C9A23B" : "#6B4B52", "stroke-width": 1.6 }, svg);
    svgEl("text", { x: 12, y: 16.2, "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: gold ? "#C9A23B" : "#8C6E75", "font-family": "Archivo, Arial, sans-serif" }, svg).textContent = "?";
    return svg;
  }
  svgEl("rect", { x: 1.2, y: 1.2, width: 21.6, height: 21.6, rx: 5, fill: gold ? "#EBC768" : "#F6EEE6", stroke: gold ? "#A47A17" : "#C9BBAA",
    "stroke-width": 1.6, ...(how === "peek" ? { "stroke-dasharray": "2.4 1.8" } : {}) }, svg);
  for (const [c, r] of PIPS[face]) svgEl("circle", { cx: 6 + 6 * c, cy: 6 + 6 * r, r: face === 1 ? 3 : 2.1, fill: face === 1 ? "#8E2C3B" : "#2A1015" }, svg);
  if (seen) svgEl("circle", { cx: 20.5, cy: 3.5, r: 3, fill: "#8E2C3B", stroke: "#F6EEE6", "stroke-width": 1.2 }, svg);
  return svg;
}
const byKind = list => [...list].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "gold" ? -1 : 1));

// ---------- what a role does (tap a gold die) ----------
const blockedBy = ability => (ABILITIES[ability].blockers || []).map(r => ROLES[r]).join(" or ");
function roleInfo(face) {
  const blocks = Object.entries(ABILITIES).filter(([, x]) => x.blockers?.includes(face)).map(([id]) => ({ steal: "steals", sanction: "sanctions" }[id] || id));
  return {
    1: [`Counts as any face in bids.`, `Free move, once a turn: reroll one of your dice in secret (say, one that landed face up).`],
    2: [`Take ${RULES.banker} dice from the bank. They land face up, for everyone to see.`],
    3: [`Steal ${RULES.steal} plain dice from a player.`, `${blockedBy("steal")} blocks it.`],
    4: [`The player you pick shows you all their dice; only you see them.`, `Works as a bluff too: they can't check whether you're a real Auditor.`],
    5: [`Blocks ${blocks.join(" and ")} aimed at you.`],
    6: [`Inquiry: the referee tells you how many dice on the table show a face. Only a real Regulator gets an answer.`,
      `Sanction: pay ${RULES.sanction} dice and a player loses a gold die. ${blockedBy("sanction")} blocks it; the dice are spent either way.`],
  }[face];
}
function showRole(face, whose) {
  const head = $("roleHead");
  head.replaceChildren(dieSvg({ face, kind: "gold" }, 40));
  const t = document.createElement("div");
  const h = document.createElement("h2"), sub = document.createElement("p");
  h.id = "roleName";
  h.textContent = ROLES[face];
  sub.textContent = whose === ME ? "One of your gold dice" : whose != null ? `${name(whose)}'s gold die` : "A gold die";
  t.append(h, sub);
  head.appendChild(t);
  const lines = [...roleInfo(face), "Anyone can claim any role, true or not. If they're challenged, a gold die showing it proves them right."];
  $("roleBody").replaceChildren(...lines.map((line, k) => { const p = document.createElement("p"); p.textContent = line; if (k === lines.length - 1) p.className = "ct-note"; return p; }));
  $("roleDlg").showModal();
}

// ---------- the seats ----------
// Each seat keeps its player's whole last turn (their move and what came of it, their question with both answers
// when you're part of it, their bid or call) until their next turn starts, so a round played fast can still be read.
const ACTS = new Set(["pass", "take", "reroll", "hit", "claim", "ask", "bid", "call"]);
/**
 * The game's events cut into turns, oldest first: { p, events }. A turn runs from its player's first move to their
 * bid or call and what that cost; challenges, blocks and payments in between belong to it.
 */
function turnsOf(events) {
  const turns = [];
  let cur = null, closed = true;
  for (const e of events) {
    if (ACTS.has(e.t) && (closed || e.p !== cur.p)) { cur = { p: e.p, events: [] }; turns.push(cur); closed = false; }
    cur?.events.push(e);
    if (e.t === "bid" || e.t === "call") closed = true;
  }
  return turns;
}
/** A question in a few words: "how many 4s?", "any 6s?", "odd total?", "total 15+?". */
const shortQuestion = q => ({ count: `how many ${q.f}s?`, any: `any ${q.f}s?`, odd: "odd total?", atLeast: `total ${q.n}+?` }[q.type]);
const answerWord = a => (typeof a === "number" ? String(a) : a ? "yes" : "no");
/**
 * Both answers to a question you're part of: what the asker said about their hand and what the one asked said
 * about theirs (each learned the other's). Null when you're not part of it: those answers stay private.
 */
function bothAnswers(e) {
  if (e.p !== ME && e.target !== ME) return null;
  const aboutTarget = e.priv?.[e.p]?.answer, aboutAsker = e.priv?.[e.target]?.answer;
  if (aboutTarget == null || aboutAsker == null) return null;
  const who = i => (i === ME ? "you" : name(i));
  return `${who(e.p)} ${answerWord(aboutAsker)} · ${who(e.target)} ${answerWord(aboutTarget)}`;
}
// How much each kind of line matters when a turn has more than its seat can show: losses first, then the move and what
// came of it, then a question with its answers (they go together), then the bid (the middle of the table shows it too),
// and last a Fixer reroll.
const KEEP = { bad: 6, act: 5, answer: 4, ask: 4, bid: 3, free: 2 };
const MAX_LINES = 7;
/** Where the least telling of a turn's lines starts, by their kinds, and how many go with it: a question takes its
 * answers along, so neither is left without the other. */
function weakest(kinds) {
  const i = kinds.reduce((lo, k, j) => (KEEP[k] < KEEP[kinds[lo]] ? j : lo), 0);
  if (kinds[i] === "ask" && kinds[i + 1] === "answer") return [i, 2];
  if (kinds[i] === "answer" && kinds[i - 1] === "ask") return [i - 1, 2];
  return [i, 1];
}
/** A turn as at most seven short lines, { text, cls }, in the order things happened. */
function turnLines(turn) {
  const who = i => (i === ME ? "you" : name(i));
  const out = [];
  let move = null, fixer = false;                    // the move's line, which its outcome finishes; a Fixer reroll before it
  const finish = more => { if (move) move.text += more; };
  for (const raw of turn.events) {
    const e = seen(raw, ME);
    switch (e.t) {
      case "claim":
        if (e.free) { out.push(move = { text: "Fixer reroll", cls: "free" }); fixer = true; break; }
        // a claim aimed at a player names them; the others name the role
        out.push(move = { text: e.target != null ? `${{ steal: "Trader", audit: "Auditor", sanction: "Sanction" }[e.ability] || ROLES[e.role]} on ${who(e.target)}`
          : e.ability === "inquiry" ? "Inquiry" : ROLES[e.role], cls: "act" });
        break;
      case "take": out.push(move = { text: `Took a ${e.dice[0].face}`, cls: "act" }); break;
      case "reroll": out.push(move = { text: `Rerolled ${e.dice.length}`, cls: "act" }); break;
      case "pass": out.push(move = { text: "Passed", cls: "act" }); break;
      case "hit": out.push(move = { text: `Hit ${who(e.target)}`, cls: "act" }); break;
      case "challenge": finish(e.held ? ": true" : ": a bluff, caught"); if (!e.held && move) move.cls = "bad"; break;
      case "kept": finish(", kept shown"); break;
      case "putBack": finish(", put back"); break;
      case "block": finish(`: blocked (${ROLES[e.role]})`); break;
      case "banker": finish(" +3"); break;
      case "trader": finish(e.none ? ": nothing" : `: stole ${e.lost.length}`); break;
      case "inquiry": finish(`: ${e.face}s${e.count != null ? ` = ${e.count}` : ""}`); break;
      case "ask": {
        const both = bothAnswers(raw);
        out.push({ text: `Asked ${who(e.target)}: ${shortQuestion(e.question)}`, cls: "ask" });
        if (both) out.push({ text: both, cls: "answer" });   // between two others, the answers are theirs: no line for them
        break;
      }
      case "bid": out.push({ text: `Bid ${e.q}×${faceLabel(e.f)}`, cls: "bid" }); break;
      case "call": out.push({ text: `Call ${e.bid.q}×${faceLabel(e.bid.f)}: ${e.held ? "held" : "bust"}`, cls: "bid" }); break;
      case "loseGold": if (e.p === turn.p) out.push({ text: `Lost a gold ${ROLES[e.die.face]}`, cls: "bad" }); break;
      case "out": if (e.p === turn.p) out.push({ text: "Out", cls: "bad" }); break;
    }
  }
  // a Fixer reroll that went through quietly rides on the move's line
  if (fixer && out[0]?.cls === "free" && out[0].text === "Fixer reroll" && out[1]?.cls === "act") { out[1].text = `Fixer · ${out[1].text}`; out.shift(); }
  while (out.length > MAX_LINES) out.splice(...weakest(out.map(ln => ln.cls)));
  return out;
}
/** Each player's latest turn, by seat. */
function lastTurns() {
  const last = {};
  for (const t of turnsOf(g.events)) last[t.p] = t;
  return last;
}
const shownLines = {};                                // per seat, the turn last drawn and how many lines it had
/** A seat's log of its player's last turn; lines that weren't there when the table was last drawn pop in. */
function turnLog(turn, p) {
  const box = document.createElement("div");
  box.className = "ct-log";
  if (!turn) return box;
  const lines = turnLines(turn), start = turn.events[0].n;
  const before = shownLines[p]?.start === start ? shownLines[p].count : 0;
  lines.forEach((ln, k) => {
    const row = document.createElement("div");
    row.className = `ct-log-line ${ln.cls}${k >= before ? " fresh" : ""}`;
    row.dataset.kind = ln.cls;
    row.textContent = row.title = ln.text;
    box.appendChild(row);
  });
  shownLines[p] = { start, count: lines.length };
  return box;
}

/** When the open panel wants a target, who's picked and how to pick: the seats on the table do the choosing. */
function targeting() {
  if (!g || g.over || g.turn !== ME || g.pending) return null;
  const first = others()[0]?.i;
  if (g.step === "act" && ui.panel === "claim" && ABILITIES[ui.claim.ability]?.target) return { picked: ui.claim.target ??= first, pick: i => { ui.claim.target = i; render(); } };
  if (g.step === "act" && ui.panel === "hit") return { picked: ui.hit ??= first, pick: i => { ui.hit = i; render(); } };
  if (g.step === "bid" && ui.panel === "ask") return { picked: ui.ask.target ??= first, pick: i => { ui.ask.target = i; render(); } };
  return null;
}
function renderSeats() {
  const aim = targeting(), turns = lastTurns();
  // the dice at every seat take two rows: as the biggest hand grows, all of them shrink to fit (the seats keep their height)
  const opponents = g.players.filter(p => p.i !== ME), most = Math.max(1, ...opponents.map(p => mind.known(p.i).length));
  const width = ($("seats").clientWidth || 340) / Math.max(1, opponents.length) - 14, perRow = Math.ceil(most / 2);
  $("seats").style.setProperty("--seat-die", `${Math.max(13, Math.min(18, Math.floor((width - (perRow - 1) * 3) / perRow)))}px`);
  $("seats").replaceChildren(...g.players.filter(p => p.i !== ME).map(p => {
    const seat = document.createElement("div");
    const canTarget = aim && !p.out;
    seat.className = `ct-seat${g.turn === p.i && !g.over ? " turn" : ""}${p.out ? " out" : ""}${canTarget ? " targetable" : ""}${canTarget && aim.picked === p.i ? " picked" : ""}`;
    if (canTarget) { seat.setAttribute("role", "button"); seat.addEventListener("click", () => aim.pick(p.i)); }
    const plaque = document.createElement("div");
    plaque.className = "ct-plaque";
    const b = document.createElement("b");
    b.textContent = p.out ? `${p.name} · out` : p.name;
    plaque.title = PERSONAS[p.persona].trait;
    plaque.appendChild(b);
    const dice = document.createElement("div");
    dice.className = "ct-dice";
    dice.append(...byKind(mind.known(p.i)).map(d => {
      const svg = dieSvg(d, 20);
      svg.style.width = svg.style.height = "var(--seat-die, 20px)";
      if (d.kind === "gold" && d.face != null) { svg.classList.add("ct-tappable"); svg.addEventListener("click", e => { e.stopPropagation(); showRole(d.face, p.i); }); }
      return svg;
    }));
    seat.append(plaque, dice, turnLog(turns[p.i], p.i));
    return seat;
  }));
  // a long line wraps onto two: rather than cut the last one off part-way, drop whole lines, least telling first, until it fits
  for (const box of $("seats").querySelectorAll(".ct-log"))
    while (box.scrollHeight > box.clientHeight + 1 && box.children.length > 1) {
      const [at, n] = weakest([...box.children].map(r => r.dataset.kind));
      for (let k = 0; k < n; k++) box.children[at].remove();
    }
}

// ---------- the middle of the table ----------
function renderCentre() {
  const box = $("centre"), b = g.bid;
  box.innerHTML = "";
  const marker = document.createElement("div");
  marker.className = `ct-marker${b ? "" : " open"}`;
  const by = document.createElement("small");
  // with no bid standing, the last call's verdict sits where the bid stood, until someone bids again
  const lastBidOrCall = [...g.events].reverse().find(e => e.t === "bid" || e.t === "call");
  if (b) {
    marker.append(`${b.q} ×`, dieSvg({ face: b.f, kind: "plain" }, 24));
    by.textContent = `${b.by === ME ? "your bid" : `${name(b.by)}'s bid`} · ${totalDice(g)} dice`;
  } else if (lastBidOrCall?.t === "call") {
    const c = lastBidOrCall, loser = c.held ? c.p : c.bid.by;
    marker.classList.add(c.held ? "held" : "broke");
    marker.append(`${c.bid.q} × ${faceLabel(c.bid.f)} ${c.held ? "held" : "busted"}`);
    by.textContent = `${name(loser)} ${verb(loser, "pay")} · ${totalDice(g)} dice`;
  } else {
    marker.append("No bid yet");
    by.textContent = `${totalDice(g)} dice on the table`;
  }
  marker.appendChild(by);
  box.appendChild(marker);
  const lines = g.events.map(e => line(seen(e, ME))).filter(Boolean);
  if (lines.length) {
    const ticker = document.createElement("button");
    ticker.type = "button";
    ticker.className = "ct-ticker";
    ticker.textContent = lines[lines.length - 1];
    ticker.title = "Everything so far";
    ticker.addEventListener("click", () => { $("history").replaceChildren(...lines.map(t => { const x = document.createElement("li"); x.textContent = t; return x; })); $("historyDlg").showModal(); });
    box.appendChild(ticker);
  }
}

// ---------- you ----------
let shookAt = -1;
function renderMine() {
  const me = g.players[ME], box = $("mine");
  box.className = `ct-mine${g.turn === ME && !g.over ? " turn" : ""}`;
  box.innerHTML = "";
  const plaque = document.createElement("div");
  plaque.className = "ct-plaque";
  const b = document.createElement("b"), t = document.createElement("span");
  b.textContent = "You";
  const seenByAll = new Set(publicMind.known(ME).filter(d => d.face != null).map(d => d.id));
  t.textContent = me.out ? "out" : `${myPlain()} plain${seenByAll.size ? `, ${seenByAll.size} seen by everyone` : ""}`;
  plaque.append(b, t);
  // your last question, with both answers, stays with you until your next turn
  const myTurn = lastTurns()[ME], asked = myTurn?.events.find(e => e.t === "ask");
  const mine = document.createElement("p");
  mine.className = "ct-mine-ask";
  if (asked) mine.textContent = `You asked ${name(asked.target)}: ${shortQuestion(asked.question)} ${bothAnswers(asked) || ""}`.trim();
  // dice that just changed under you shake once
  const last = g.events[g.events.length - 1];
  const shaken = last && (last.t === "reroll" || last.t === "freeReroll") && last.p === ME && shookAt < last.n
    ? new Set([].concat(last.dice || last.die)) : new Set();
  if (shaken.size) shookAt = last.n;
  const fixing = ui.panel === "claim" && ui.claim.ability === "reroll", picking = ui.panel === "reroll" || fixing;
  // one row of dice, always: they shrink as your hand grows
  const count = me.dice.length, room = (box.clientWidth || 340) - 8, gap = count > 7 ? 4 : 7;
  box.style.setProperty("--mine-gap", `${gap}px`);
  box.style.setProperty("--mine-die", `${Math.max(22, Math.min(36, Math.floor((room - (count - 1) * gap) / count)))}px`);
  const dice = document.createElement("div");
  dice.className = "ct-dice";
  dice.append(...byKind(me.dice).map(d => {
    const fig = document.createElement("figure");
    const svg = dieSvg({ face: d.face, kind: d.kind, seen: seenByAll.has(d.id) }, 36);
    svg.style.width = svg.style.height = "var(--mine-die, 36px)";
    if (shaken.has(d.id)) svg.classList.add("shake");
    const chosen = fixing ? ui.free === d.id : ui.reroll.has(d.id);
    if (picking) { svg.classList.add("pickable"); if (chosen) svg.classList.add("picked"); }
    fig.appendChild(svg);
    if (d.kind === "gold") { const cap = document.createElement("figcaption"); cap.textContent = ROLES[d.face]; fig.appendChild(cap); }
    if (!picking && d.kind === "gold") { fig.classList.add("ct-tappable"); fig.addEventListener("click", e => { e.stopPropagation(); showRole(d.face, ME); }); }
    if (picking) fig.addEventListener("click", () => {
      if (fixing) ui.free = ui.free === d.id ? null : d.id;
      else if (ui.reroll.has(d.id)) ui.reroll.delete(d.id); else ui.reroll.add(d.id);
      render();
    });
    return fig;
  }));
  box.append(plaque, dice, mine);
  $("notes").replaceChildren(...mind.notes().map(nt => { const li = document.createElement("li"); li.textContent = `${nt.p == null ? "Table" : name(nt.p)}: ${nt.text}`; return li; }));
}

function line(e) {
  const n = name, x = e;
  switch (x.t) {
    case "start": return `${n(x.turn)} ${verb(x.turn, "start")}.`;
    case "pass": return `${n(x.p)} ${verb(x.p, "pass")}.`;
    case "take": return `${n(x.p)} ${verb(x.p, "take")} a die from the bank: a ${x.dice[0].face}.`;
    case "reroll": return `${n(x.p)} ${verb(x.p, "reroll")} ${x.dice.length} ${x.dice.length === 1 ? "die" : "dice"}.`;
    case "ask": return `${n(x.p)} ${verb(x.p, "ask")} ${x.target === ME ? "you" : n(x.target)}: ${questionText(x.question)}${x.answer != null ? ` ${answerText(x, x.answer)}` : ""}`;
    case "hit": return `${n(x.p)} ${verb(x.p, "hit")} ${x.target === ME ? "you" : n(x.target)}.`;
    case "claim": return `${n(x.p)} ${verb(x.p, "claim")} ${ROLES[x.role]} to ${purpose(x)}.`;
    case "challenge": return x.held
      ? `${n(x.p)} ${verb(x.p, "challenge")}: true, a gold ${x.die.face}.`
      : `${n(x.p)} ${verb(x.p, "challenge")}: a bluff!`;
    case "allow": return `${n(x.p)} ${verb(x.p, "let")} it go.`;
    case "block": return `${n(x.p)} ${verb(x.p, "block")} the ${x.ability === "sanction" ? "sanction" : "steal"} as ${ROLES[x.role]}.`;
    case "blocked": return `${n(x.p)} ${verb(x.p, "accept")} the block.`;
    case "banker": return `${n(x.p)} ${verb(x.p, "take")} ${x.dice.length} dice from the bank: ${x.dice.map(d => d.face).join(", ")}.`;
    case "trader": return x.none ? `${n(x.p)} ${verb(x.p, "get")} nothing.` : `${n(x.p)} ${verb(x.p, "steal")} ${x.lost.length} from ${x.target === ME ? "you" : n(x.target)}.`;
    case "audit": return `${n(x.p)} ${verb(x.p, "look")} at all of ${x.target === ME ? "your" : `${n(x.target)}'s`} dice${x.faces ? `: ${Object.values(x.faces).join(", ")}` : ""}.`;
    case "freeReroll": return `${n(x.p)} ${verb(x.p, "reroll")} a die.`;
    case "kept": return `${n(x.p)} ${verb(x.p, "keep")} the proven ${ROLES[x.role]} shown.`;
    case "putBack": return `${n(x.p)} ${verb(x.p, "put")} the proven ${ROLES[x.role]} back in the cup, rerolled unseen.`;
    case "inquiry": return x.unanswered
      ? `The referee doesn't answer: your gold dice don't show a Regulator.`
      : `${n(x.p)} ${verb(x.p, "ask")} the referee how many ${faceLabel(x.face)} are out${x.count != null ? `: ${x.count}` : ""}.`;
    case "sanction": return `${n(x.p)} ${verb(x.p, "sanction")} ${x.target === ME ? "you" : n(x.target)}.`;
    case "bid": return `${n(x.p)} ${verb(x.p, "bid")} ${x.q} × ${faceLabel(x.f)}.`;
    case "call": return `${n(x.p)} ${verb(x.p, "call")} ${x.bid.q} × ${faceLabel(x.bid.f)}: ${x.held ? "it holds" : "it doesn't hold"}.`;
    case "loseGold": return `${n(x.p)} ${verb(x.p, "lose")} a gold die (${x.die.face}, ${ROLES[x.die.face]}).`;
    case "out": return `${n(x.p)} ${x.p === ME ? "are" : "is"} out.`;
    case "win": return x.p === ME ? "You win the table!" : `${n(x.p)} wins.`;
    default: return null;
  }
}
/** What a claim is for, in words: "steal from you", "sanction Quant, paying 4". */
function purpose(e) {
  const t = e.target === ME ? "you" : e.target != null ? name(e.target) : "";
  return {
    bank: "take 3 dice from the bank", steal: `steal 2 dice from ${t}`, audit: `look at all of ${e.target === ME ? "your" : `${t}'s`} dice`,
    reroll: "reroll one of their dice (a free move)", inquiry: "count a face on the table", sanction: `sanction ${t}, paying ${RULES.sanction} dice`,
  }[e.ability];
}
const questionText = q => ({ odd: "is the total odd?", atLeast: `is the total at least ${q.n}?`, any: `any ${faceLabel(q.f)}?`, count: `how many ${faceLabel(q.f)}?` }[q.type]);
/** An answer as you saw it: about them if you asked, about the asker if you were asked. */
function answerText(e, a) {
  const about = e.p === ME ? (e.target === ME ? "you" : name(e.target)) : name(e.p);
  const v = typeof a === "number" ? String(a) : a ? "yes" : "no";
  return `(${about}: ${v})`;
}

// ---------- your turn: the tray under the table ----------
// One card: a title, then on your move four equal action tiles and a panel for whatever the chosen move needs; on
// your bid, the bid itself with the question beside it. Built from equal-width grids, each panel ending in the
// button that commits it, and sized so the whole screen never needs to scroll.
const ICONS = {
  take: '<rect x="3" y="7" width="12" height="12" rx="3"/><path d="M19 3v7M15.5 6.5h7"/>',
  reroll: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
  claim: '<path d="M12 3.5l2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.3 7 18.9l.9-5.6-4-3.9 5.6-.8z"/>',
  hit: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
};
/** Each claim in a few words, for the role cards (tap a gold die for the whole story). */
const POWER = { reroll: "Free: reroll a die", bank: "Take 3", steal: "Steal 2", audit: "See a hand", inquiry: "Count a face", sanction: `Pay ${RULES.sanction}: a gold die` };

/** Elements for the tray: el("div", "class", parent, text). */
function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  parent?.appendChild(n);
  return n;
}
function button(cls, parent, content, fn, pressed = null) {
  const b = el("button", cls, parent);
  b.type = "button";
  if (typeof content === "string") b.textContent = content; else b.append(...content);
  if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
  b.addEventListener("click", fn);
  return b;
}
const icon = id => { const t = document.createElement("template"); t.innerHTML = `<svg class="ct-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg>`; return t.content.firstChild; };
/** A grid of columns: a number of equal ones, or a template. */
const grid = (parent, cols) => { const g2 = el("div", "ct-grid", parent); g2.style.gridTemplateColumns = typeof cols === "number" ? `repeat(${cols}, minmax(0, 1fr))` : cols; return g2; };
/** The faces to pick from, as dice in a grid. */
function faces(parent, from, picked, pick) {
  const row = grid(parent, 7 - from);
  for (let f = from; f <= 6; f++) {
    const b = button("ct-choice ct-face", row, [dieSvg({ face: f, kind: "plain" }, 24)], () => pick(f), picked === f);
    b.setAttribute("aria-label", `${f}s`);
  }
}
/** A − number + stepper. */
function stepper(parent, value, down, up, note) {
  const row = el("div", "ct-stepper", parent);
  button("ct-step-btn", row, "−", down).setAttribute("aria-label", "fewer");
  el("b", "ct-count", row, String(value));
  button("ct-step-btn", row, "+", up).setAttribute("aria-label", "more");
  if (note) el("span", "ct-note", row, note);
}
const go = (parent, text, fn, disabled = false, small = null) => {
  const b = button("ct-go", parent, small ? [document.createTextNode(text), el("small", null, null, small)] : text, fn);
  b.disabled = disabled;
  return b;
};
const toggle = id => { ui.panel = ui.panel === id ? null : id; render(); };

function renderControls() {
  const box = $("controls");
  box.innerHTML = "";
  if (g.over) return;
  if (g.players[ME].out) { el("p", "ct-waiting", box, "You're out: the others play on."); return; }
  if (waiting) {
    el("p", "ct-waiting", box, "Tap anywhere for the next move");
    button("ct-go", box, "Next move", () => {});            // its click reaches the table's tap handler
    return;
  }
  if (g.turn !== ME || g.pending) {
    const c = g.pending;
    el("p", "ct-waiting", box, c?.type === "proof" ? `${name(c.claimant)} ${verb(c.claimant, "decide")} whether to keep the ${ROLES[c.role]} shown…`
      : c ? `${name(c.challenger)} ${verb(c.challenger, "decide")} whether to challenge…` : `${name(g.turn)} is thinking…`);
    return;
  }
  const tray = el("section", "ct-tray", box);
  const b = g.bid, forced = g.step === "act" && mustHit(g);
  if (g.step === "bid" || forced || !ui.panel) el("h3", "ct-tray-title", tray, g.step === "bid" ? (ui.panel === "ask" ? "Ask before you bid" : b ? "Your bid" : "Open the bidding") : forced ? "Your hand is full: hit someone" : "Your move");
  if (g.step === "act") {
    // no Pass: taking a die is always at least as good, and rerolling a face-up die covers the rest
    const tiles = grid(tray, 4);
    tiles.classList.add("ct-actions");
    for (const [id, text] of [["take", "Take"], ["reroll", "Reroll"], ["claim", "Claim"], ["hit", "Hit"]]) {
      const t = button("ct-action", tiles, [icon(id), el("span", null, null, text)], () => {
        if (id === "take") play(() => act(g, { type: "take" }));
        else toggle(id);
      }, ui.panel === id);
      t.disabled = (forced && id !== "hit") || (id === "take" && myPlain() >= RULES.cap) || (id === "hit" && myPlain() < RULES.hit);
    }
    if (ui.panel === "claim") claimPanel(el("div", "ct-panel", tray));
    if (ui.panel === "reroll") rerollPanel(el("div", "ct-panel", tray));
    if (ui.panel === "hit") hitPanel(el("div", "ct-panel", tray));
    return;
  }
  if (ui.panel === "ask" && !g.askUsed) { askPanel(el("div", "ct-panel", tray)); return; }
  bidPanel(el("div", "ct-panel ct-panel-bid", tray));
}

function bidPanel(panel) {
  const b = g.bid;
  if (!ui.bid) {
    const mineOf = f => g.players[ME].dice.filter(d => d.face === f || d.face === 1).length;
    const best = [2, 3, 4, 5, 6].sort((x, y) => mineOf(y) - mineOf(x))[0];
    ui.bid = b ? { f: b.f, q: b.q + 1 } : { f: best, q: Math.max(1, Math.round(totalDice(g) / 3) - 2) };
  }
  const minFor = f => (!b ? 1 : f > b.f ? b.q : b.q + 1);
  if (ui.bid.q < minFor(ui.bid.f)) ui.bid.q = minFor(ui.bid.f);
  el("p", "ct-context", panel, b ? `${b.by === ME ? "Your" : `${name(b.by)}'s`} ${b.q} × ${faceLabel(b.f)} stands: raise it or call it.` : "Bid any number of any face.");
  faces(panel, 2, ui.bid.f, f => { ui.bid.f = f; if (ui.bid.q < minFor(f)) ui.bid.q = minFor(f); render(); });
  const mine = g.players[ME].dice.filter(d => d.face === ui.bid.f || d.face === 1).length;
  stepper(panel, ui.bid.q, () => { if (ui.bid.q > minFor(ui.bid.f)) { ui.bid.q--; render(); } }, () => { if (ui.bid.q < totalDice(g)) { ui.bid.q++; render(); } },
    `You hold ${mine}, 1s included`);
  // the free question sits beside the bid: once a turn, after your move
  const row = grid(panel, g.askUsed ? "repeat(2, minmax(0, 1fr))" : "minmax(0, .7fr) repeat(2, minmax(0, 1fr))");
  if (!g.askUsed) button("ct-go ct-go-quiet", row, "Ask", () => { ui.panel = "ask"; render(); }).title = "One free question, about one player's whole hand";
  const call = button("ct-go ct-go-quiet", row, b ? `Call ${b.q} × ${faceLabel(b.f)}` : "Call", () => play(() => bid(g, { call: true })));
  call.disabled = !b;
  go(row, `Bid ${ui.bid.q} × ${faceLabel(ui.bid.f)}`, () => play(() => bid(g, { q: ui.bid.q, f: ui.bid.f })));
}

/**
 * Claims, three to a row: the Fixer's free reroll (before your move) and the five powers. A role's name is green
 * when one of your gold dice shows it, red when claiming it would be a bluff.
 */
function claimPanel(panel) {
  const c = ui.claim, mine = g.players[ME].dice.filter(d => d.kind === "gold").map(d => d.face);
  if (c.ability === "reroll" && g.freeUsed) c.ability = "bank";
  const roles = grid(panel, 3);
  for (const [id, x] of Object.entries(ABILITIES).sort((a, b) => a[1].role - b[1].role)) {
    const held = mine.includes(x.role), used = id === "reroll" && g.freeUsed;
    const card = button(`ct-role${x.free ? " free" : ""}`, roles, [dieSvg({ face: x.role, kind: "gold" }, 22), (() => {
      const t = el("span", "ct-role-text");
      el("b", held ? "held" : "bluff", t, ROLES[x.role]);
      el("span", null, t, used ? "Used this turn" : id === "inquiry" && !held ? "No answer if bluffed" : POWER[id]);
      return t;
    })()], () => { c.ability = id; ui.free = null; render(); }, c.ability === id);
    card.setAttribute("aria-label", `${ROLES[x.role]}: ${POWER[id]}. ${held ? "You hold it." : "A bluff: you don't hold it."}`);
    if (used || (x.cost && myPlain() < x.cost)) card.disabled = true;
  }
  const x = ABILITIES[c.ability];
  if (c.ability === "reroll") {
    // the card just picked already says what the Fixer does; the button only claims it, like every other claim
    go(panel, ui.free != null ? `Claim ${ROLES[x.role]}` : "Tap one of your dice", () => play(() => freeReroll(g, ui.free)), ui.free == null);
    return;
  }
  const claim = () => play(() => act(g, { type: "claim", ability: c.ability, target: x.target ? c.target : undefined, picks: myPicks(c) }));
  if (c.ability === "inquiry") {
    // the face to count and the claim share one row, so the inquiry is no taller than any other claim
    const row = grid(panel, "repeat(5, minmax(0, 1fr)) minmax(0, 1.9fr)");
    for (let f = 2; f <= 6; f++) button("ct-choice ct-face", row, [dieSvg({ face: f, kind: "plain" }, 22)], () => { c.face = f; render(); }, c.face === f).setAttribute("aria-label", `count ${f}s`);
    go(row, `Count ${c.face}s`, claim);
    return;
  }
  if (x.target) c.target ??= others()[0]?.i;
  const small = x.blockers ? `${x.blockers.map(r => ROLES[r]).join(" or ")} can block it${c.ability === "sanction" ? `; the ${RULES.sanction} dice are spent either way` : ""}` : null;
  go(panel, `Claim ${ROLES[x.role]}${x.target ? ` against ${name(c.target)}` : ""}`, claim, !!(x.cost && myPlain() < x.cost), small);
}

function askPanel(panel) {
  const a = ui.ask;
  a.target ??= others()[0]?.i;
  const kinds = grid(panel, 2);
  for (const [type, text] of [["count", "How many …?"], ["any", "Any …?"], ["odd", "Odd total?"], ["atLeast", "Total at least …?"]]) button("ct-choice", kinds, text, () => { a.type = type; render(); }, a.type === type);
  if (a.type === "count" || a.type === "any") faces(panel, 1, a.f, f => { a.f = f; render(); });
  if (a.type === "atLeast") stepper(panel, a.n, () => { a.n = Math.max(2, a.n - 1); render(); }, () => { a.n = Math.min(60, a.n + 1); render(); });
  const row = grid(panel, "minmax(0, .45fr) minmax(0, 1fr)");
  button("ct-go ct-go-quiet", row, "Back", () => { ui.panel = null; render(); });
  go(row, `Ask ${name(a.target)}: ${questionText(a)}`, () => play(() => freeAsk(g, a.target, { type: a.type, f: a.f, n: a.n })));
}

function rerollPanel(panel) {
  el("p", "ct-note", panel, "Tap the dice to reroll, secretly. Rerolling a gold die changes your role.");
  const n = ui.reroll.size;
  go(panel, n ? `Reroll ${n} ${n === 1 ? "die" : "dice"}` : "Tap your dice", () => play(() => act(g, { type: "reroll", dice: [...ui.reroll] })), !n);
}

function hitPanel(panel) {
  ui.hit ??= others()[0]?.i;
  el("p", "ct-note", panel, `Pay ${RULES.hit} dice: they lose a gold die. Tap a player on the table to choose.`);
  go(panel, `Hit ${name(ui.hit)}`, () => play(() => act(g, { type: "hit", target: ui.hit })));
}

/** Your picks for an ability: which face an inquiry counts. (A steal takes dice you can't see, at random.) */
function myPicks(c) {
  return c.ability === "inquiry" ? { face: c.face } : {};
}

// ---------- claims and blocks you answer ----------
function showChallenge() {
  const c = g.pending, theirs = mind.known(c.claimant).filter(d => d.kind === "gold");
  const known = theirs.filter(d => d.face != null).map(d => d.face);
  const knowText = known.length ? `You know ${known.length === theirs.length ? "their gold dice" : "one of their gold dice"}: ${known.join(", ")}.` : "You haven't seen their gold dice.";
  const blockBtns = $("blockBtns");
  blockBtns.replaceChildren();
  if (c.type === "block") {
    const what = c.base.ability === "sanction" ? "sanction" : "steal";
    $("challengeText").textContent = `${name(c.claimant)} ${verb(c.claimant, "block")} your ${what}, claiming ${ROLES[c.role]}.`;
    $("challengeKnow").textContent = `${knowText} Challenge it: if it's a bluff, they ${stakeText("pay")} and the ${what} goes ahead; if it's true, you ${stakeText("pay", true)}.`;
    $("allowBtn").textContent = "Accept the block";
    $("challengeBtn").textContent = "Challenge the block";
  } else {
    const x = ABILITIES[c.ability], blockers = c.target === ME ? x.blockers || [] : [];
    $("challengeText").textContent = `${name(c.claimant)} ${verb(c.claimant, "claim")} ${ROLES[x.role]} to ${purpose(c)}.`;
    $("challengeKnow").textContent = `${knowText} Challenge it: if it's a bluff, they ${stakeText("pay")}; if it's true, you ${stakeText("pay", true)}.` +
      (blockers.length ? ` Or block it by claiming ${blockers.map(r => ROLES[r]).join(" or ")}.` : "") +
      (c.ability === "sanction" && c.target === ME ? " If it goes through, you lose a gold die." : "");
    $("allowBtn").textContent = "Let it go";
    $("challengeBtn").textContent = "Challenge";
    if (blockers.length) {
      const mine = g.players[ME].dice.filter(d => d.kind === "gold").map(d => d.face);
      for (const role of blockers) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ct-go ct-go-quiet";
        b.textContent = `Block as ${ROLES[role]}${mine.includes(role) ? "" : " (bluff)"}`;
        b.addEventListener("click", () => answer({ block: role }));
        blockBtns.appendChild(b);
      }
    }
  }
  if (!$("challengeDlg").open) $("challengeDlg").showModal();
}
/** Your claim (or block) was proven: keep the gold die shown, or put it back in the cup. */
function showProof() {
  const c = g.pending, role = ROLES[c.role];
  $("proofText").textContent = `Your ${role} is proven.`;
  $("proofKnow").textContent = `Keep it shown and nobody will challenge your ${role} while it stays; but everyone knows one of your gold dice. ` +
    `Put it back and it's rerolled unseen: your gold dice are hidden again, and it may come up as another role.`;
  if (!$("proofDlg").open) $("proofDlg").showModal();
}
function answerProof(keep) {
  $("proofDlg").close();
  play(() => keepProof(g, keep));
}
/** What losing a challenge costs, in words: "pay 3 dice (a gold die if short)". */
function stakeText(verbForm, challenger = false) {
  if (RULES.goldStakes) return `lose a gold die`;
  return `${verbForm} ${challenger ? RULES.challengeStake : RULES.bluffStake} dice (a gold die if short)`;
}

function answer(decision) {
  $("challengeDlg").close();
  const c = g.pending;
  play(() => (c.type === "block" ? respondBlock(g, decision === true) : respond(g, decision)));
}

// ---------- the end ----------
function showOver() {
  const w = g.over.winner;
  if (!g.over.counted) { g.over.counted = true; noteStreak("cartel", w === ME); save(); }   // the longest win streak, once a game
  $("overTitle").textContent = w === ME ? "You win the table" : `${g.players[w].name} wins`;
  const order = g.events.filter(e => e.t === "out").map(e => name(e.p));
  $("overText").textContent = `Out, in order: ${order.join(", ")}. ${g.moves} turns.`;
  if (!$("overDlg").open) $("overDlg").showModal();
}

// ---------- menu ----------
// the menu: Play (a new game with the opponents chosen), Content (two or three opponents), Settings (the pace of the
// computer's turns)
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  let picked = chosenOpponents();
  part(body, "play").append(action("New game", () => {
    if (picked.length < 2) { toast("Pick at least two opponents"); return; }
    if (!g.over && g.moves > 2 && !confirm("Start a new game? This one isn't finished.")) return;
    startGame(picked);
  }, "primary"));
  // the opponents: tick two or three (a fourth ticked lets go of the one ticked longest ago)
  part(body, "content").append(ticks("Opponents (two or three)", Object.entries(PERSONAS).map(([id, p]) => [id, `${p.name}, ${p.trait}`]), picked, next => { picked = next; }, 3));
  part(body, "settings").append(choice("Computer turns", Object.entries(PACES).map(([id, p]) => [id, p.label]), pace(), id => {
    try { localStorage.setItem(PACE, id); } catch { /* private mode */ }
    const c = g.pending, computerDue = c ? (c.type === "proof" ? c.claimant : c.challenger) !== ME : g.turn !== ME;
    if (!g.over && computerDue) loop();                        // a move already waiting takes the new pace
  }));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "cartel");
document.querySelector(".ct-mark").innerHTML = APPS.find(a => a.id === "cartel").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("helpBtn").addEventListener("click", () => $("helpDlg").showModal());
$("roleClose").addEventListener("click", () => $("roleDlg").close());
$("roleDlg").addEventListener("click", e => { if (e.target === $("roleDlg")) $("roleDlg").close(); });   // tap outside closes
$("helpClose").addEventListener("click", () => $("helpDlg").close());
$("historyClose").addEventListener("click", () => $("historyDlg").close());
$("overClose").addEventListener("click", () => $("overDlg").close());
$("overNew").addEventListener("click", () => { $("overDlg").close(); startGame(); });
$("challengeBtn").addEventListener("click", () => answer(true));
$("keepBtn").addEventListener("click", () => answerProof(true));
$("putBackBtn").addEventListener("click", () => answerProof(false));
$("proofDlg").addEventListener("cancel", e => e.preventDefault());   // a choice has to be made: Escape doesn't skip it
$("allowBtn").addEventListener("click", () => answer(false));
$("challengeDlg").addEventListener("cancel", e => e.preventDefault());   // a claim against you needs an answer
$("app").addEventListener("click", tapOn);

window.__cartel = { get game() { return g; }, get mind() { return mind; }, get ais() { return ais; }, loop: () => loop() };

g = load();
if (g && !g.over) { setup(); loop(); } else startGame();
