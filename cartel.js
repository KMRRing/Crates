// Cartel: you against computer players. Rules and the referee are in cartel-engine.js, the players in
// cartel-ai.js. Your view is built the same way theirs is: a Mind follows the events as your seat sees them,
// so the table shows exactly what you could know, no more.
import { newGame, act, respond, respondBlock, freeReroll, freeAsk, bid, seen, mustHit, rng, ROLES, ABILITIES, RULES, totalDice } from "./cartel-engine.js";
import { Player, Mind, PERSONAS } from "./cartel-ai.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const STORE = "cartel:game", TABLE = "cartel:table", PACE = "cartel:pace", SEEN_HELP = "cartel:help";
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
function schedule(fn) {
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
      if (!g.askUsed && askAsked !== g.moves && g.step === "act") {
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

// ---------- the seats ----------
// What each player said last, as a bubble at their seat: moves, claims, challenges, bids and calls.
const BUBBLE = new Set(["pass", "take", "reroll", "ask", "hit", "claim", "challenge", "allow", "block", "blocked", "bid", "call", "loseGold", "out"]);
const animated = {};
function bubbleText(e) {
  const who = i => (i === ME ? "you" : name(i));
  switch (e.t) {
    case "pass": return "Passes";
    case "take": return `Takes a ${e.dice[0].face}`;
    case "reroll": return `Rerolls ${e.dice.length}`;
    case "ask": return `Asks ${who(e.target)}: ${questionText(e.question)}`;
    case "hit": return `Hits ${who(e.target)}!`;
    case "claim": return e.ability === "sanction" ? `Sanction on ${who(e.target)}` : `${ROLES[e.role]}${e.target != null ? ` on ${who(e.target)}` : ""}`;
    case "challenge": return e.held ? "Challenges… wrong" : "Challenges: bluff!";
    case "allow": return "Lets it go";
    case "block": return `Blocks as ${ROLES[e.role]}`;
    case "blocked": return "Accepts the block";
    case "bid": return `${e.q} × ${faceLabel(e.f)}`;
    case "call": return `Calls! ${e.held ? "It held" : "Busted"}`;
    case "loseGold": return `Loses a gold ${e.die.face}`;
    case "out": return "Out";
    default: return "";
  }
}
function lastSaid(i) {
  for (let k = g.events.length - 1; k >= 0; k--) {
    const e = g.events[k];
    if (BUBBLE.has(e.t) && e.p === i) return { e: seen(e, ME), k };
  }
  return null;
}

function renderSeats() {
  const lap = g.players.length * 3;
  $("seats").replaceChildren(...g.players.filter(p => p.i !== ME).map(p => {
    const seat = document.createElement("div");
    seat.className = `ct-seat${g.turn === p.i && !g.over ? " turn" : ""}${p.out ? " out" : ""}`;
    const plaque = document.createElement("div");
    plaque.className = "ct-plaque";
    const b = document.createElement("b"), t = document.createElement("span");
    b.textContent = p.name;
    t.textContent = p.out ? "out" : PERSONAS[p.persona].trait;
    plaque.append(b, t);
    const dice = document.createElement("div");
    dice.className = "ct-dice";
    dice.append(...byKind(mind.known(p.i)).map(d => dieSvg(d, 20)));
    seat.append(plaque, dice);
    const said = lastSaid(p.i);
    if (said) {
      const bubble = document.createElement("div");
      bubble.className = `ct-bubble${g.events.length - said.k > lap ? " old" : ""}${(animated[p.i] ?? -1) < said.k ? " fresh" : ""}`;
      bubble.textContent = bubbleText(said.e);
      animated[p.i] = said.k;
      seat.appendChild(bubble);
    }
    return seat;
  }));
}

// ---------- the middle of the table ----------
function renderCentre() {
  const box = $("centre"), b = g.bid;
  box.innerHTML = "";
  const marker = document.createElement("div");
  marker.className = `ct-marker${b ? "" : " open"}`;
  if (b) {
    marker.append(`${b.q} ×`, dieSvg({ face: b.f, kind: "plain" }, 26));
    const by = document.createElement("small");
    by.textContent = b.by === ME ? "your bid" : `${name(b.by)}'s bid`;
    marker.appendChild(by);
  } else marker.textContent = "No bid: the next player opens";
  box.appendChild(marker);
  // the last call's verdict stays on the table until someone bids again
  const lastBidOrCall = [...g.events].reverse().find(e => e.t === "bid" || e.t === "call");
  if (lastBidOrCall?.t === "call") {
    const v = document.createElement("div");
    v.className = `ct-verdict ${lastBidOrCall.held ? "held" : "broke"}`;
    const loser = lastBidOrCall.held ? lastBidOrCall.p : lastBidOrCall.bid.by;
    v.textContent = `${lastBidOrCall.bid.q} × ${faceLabel(lastBidOrCall.bid.f)} ${lastBidOrCall.held ? "held" : "busted"}: ${name(loser)} ${verb(loser, "pay")} a die`;
    box.appendChild(v);
  }
  const tally = document.createElement("div");
  tally.className = "ct-tally";
  tally.textContent = `${totalDice(g)} dice on the table`;
  box.appendChild(tally);
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
  // dice that just changed under you shake once
  const last = g.events[g.events.length - 1];
  const shaken = last && (last.t === "reroll" || last.t === "legal") && last.p === ME && shookAt < last.n
    ? new Set([].concat(last.dice || last.die)) : new Set();
  if (shaken.size) shookAt = last.n;
  const picking = ui.panel === "reroll" || ui.panel === "free";
  const dice = document.createElement("div");
  dice.className = "ct-dice";
  dice.append(...byKind(me.dice).map(d => {
    const fig = document.createElement("figure");
    const svg = dieSvg({ face: d.face, kind: d.kind, seen: seenByAll.has(d.id) }, 36);
    if (shaken.has(d.id)) svg.classList.add("shake");
    const chosen = ui.panel === "free" ? ui.free === d.id : ui.reroll.has(d.id);
    if (picking) { svg.classList.add("pickable"); if (chosen) svg.classList.add("picked"); }
    fig.appendChild(svg);
    if (d.kind === "gold") { const cap = document.createElement("figcaption"); cap.textContent = ROLES[d.face]; fig.appendChild(cap); }
    if (picking) fig.addEventListener("click", () => {
      if (ui.panel === "free") ui.free = ui.free === d.id ? null : d.id;
      else if (ui.reroll.has(d.id)) ui.reroll.delete(d.id); else ui.reroll.add(d.id);
      render();
    });
    return fig;
  }));
  box.append(plaque, dice);
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
    case "legal": return `${n(x.p)} ${verb(x.p, "reroll")} a die.`;
    case "inquiry": return `${n(x.p)} ${verb(x.p, "learn")} how many ${faceLabel(x.face)} are out${x.count != null ? `: ${x.count}` : ""}.`;
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
    legal: "reroll one of their dice (a free move)", inquiry: "count a face on the table", sanction: `sanction ${t}, paying ${RULES.sanction} dice`,
  }[e.ability];
}
const questionText = q => ({ odd: "is the total odd?", atLeast: `is the total at least ${q.n}?`, any: `any ${faceLabel(q.f)}?`, count: `how many ${faceLabel(q.f)}?` }[q.type]);
/** An answer as you saw it: about them if you asked, about the asker if you were asked. */
function answerText(e, a) {
  const about = e.p === ME ? (e.target === ME ? "you" : name(e.target)) : name(e.p);
  const v = typeof a === "number" ? String(a) : a ? "yes" : "no";
  return `(${about}: ${v})`;
}

// ---------- your turn ----------
/** A face to choose, shown as a die. */
function faceBtn(f, fn, parent, pressed) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn face";
  b.setAttribute("aria-pressed", String(pressed));
  b.setAttribute("aria-label", `${f}s`);
  b.appendChild(dieSvg({ face: f, kind: "plain" }, 24));
  b.addEventListener("click", fn);
  parent.appendChild(b);
  return b;
}
function renderControls() {
  const box = $("controls");
  box.innerHTML = "";
  const add = (tag, cls, text, parent = box) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; parent.appendChild(el); return el; };
  const btn = (text, fn, parent, cls = "btn", pressed = null) => {
    const b = add("button", cls, text, parent); b.type = "button";
    if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
    b.addEventListener("click", fn); return b;
  };
  if (g.over) return;
  if (g.players[ME].out) { add("p", "ct-waiting", "You're out: the others play on."); return; }
  if (waiting) {
    add("p", "ct-waiting", "Tap anywhere for the next move");
    btn("Next move", () => {}, add("div", "ct-row ct-next"), "btn primary");   // its click reaches the table's tap handler
    return;
  }
  if (g.turn !== ME || g.pending) { add("p", "ct-waiting", g.pending ? `${name(g.pending.challenger)} ${verb(g.pending.challenger, "decide")} whether to challenge…` : `${name(g.turn)} is thinking…`); return; }

  // the free moves, once each a turn: a question, and Legal's reroll to hide one of your dice
  if (!g.freeUsed || !g.askUsed) {
    const free = add("div", "ct-row");
    if (!g.askUsed) btn("Ask (free)", () => { ui.panel = ui.panel === "ask" ? null : "ask"; render(); }, free, "btn", ui.panel === "ask");
    if (!g.freeUsed) btn(ui.panel === "free" ? "Legal: tap a die" : "Legal: free reroll", () => { ui.panel = ui.panel === "free" ? null : "free"; ui.free = null; render(); }, free, "btn", ui.panel === "free");
    if (ui.panel === "ask" && !g.askUsed) {
      drawPanel(add("div", "ct-panel"), add, btn);
      if (g.step === "bid") return;
    }
    if (ui.panel === "free" && !g.freeUsed) {
      const panel = add("div", "ct-panel");
      add("p", "ct-step", `Claim Legal to reroll one of your dice, secretly: say, one that landed face up. ${g.players[ME].dice.some(d => d.kind === "gold" && d.face === 5) ? "Your gold dice show it." : "Your gold dice don't show it: this is a bluff."} ${name(nextAfter(ME))} may challenge.`, panel);
      const go = btn(ui.free != null ? "Reroll that die" : "Tap one of your dice", () => play(() => freeReroll(g, ui.free)), panel, "btn primary");
      go.disabled = ui.free == null;
      if (g.step === "bid") return;
    }
  }

  if (g.step === "act") {
    const forced = mustHit(g);
    add("p", "ct-step", forced ? "Your hand is full: you have to hit someone." : "Your move");
    const row = add("div", "ct-row");
    const panels = forced ? [["hit", "Hit"]] : [["take", "Take"], ["reroll", "Reroll"], ["claim", "Claim a role"], ["hit", "Hit"], ["pass", "Pass"]];
    for (const [id, label] of panels) {
      const b = btn(label, () => {
        if (id === "take") play(() => act(g, { type: "take" }));
        else if (id === "pass") play(() => act(g, { type: "pass" }));
        else { ui.panel = ui.panel === id ? null : id; render(); }
      }, row, "btn", ui.panel === id);
      if (id === "take" && myPlain() >= RULES.cap) b.disabled = true;
      if (id === "hit" && myPlain() < RULES.hit) b.disabled = true;
    }
    if (ui.panel && ui.panel !== "free" && ui.panel !== "ask") {
      const panel = add("div", "ct-panel");
      drawPanel(panel, add, btn);
      requestAnimationFrame(() => panel.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
    return;
  }

  // the bid
  const b = g.bid;
  if (!ui.bid) {
    const mineOf = f => g.players[ME].dice.filter(d => d.face === f || d.face === 1).length;
    const best = [2, 3, 4, 5, 6].sort((x, y) => mineOf(y) - mineOf(x))[0];
    ui.bid = b ? { f: b.f, q: b.q + 1 } : { f: best, q: Math.max(1, Math.round(totalDice(g) / 3) - 2) };
  }
  const minFor = f => (!b ? 1 : f > b.f ? b.q : b.q + 1);
  if (ui.bid.q < minFor(ui.bid.f)) ui.bid.q = minFor(ui.bid.f);
  add("p", "ct-step", b ? `Raise ${name(b.by) === "You" ? "your" : `${name(b.by)}'s`} ${b.q} × ${faceLabel(b.f)}, or call it` : "Open the bidding");
  const panel = add("div", "ct-panel");
  const faces = add("div", "ct-row", null, panel);
  for (let f = 2; f <= 6; f++) faceBtn(f, () => { ui.bid.f = f; if (ui.bid.q < minFor(f)) ui.bid.q = minFor(f); render(); }, faces, ui.bid.f === f);
  const step = add("div", "ct-stepper", null, panel);
  btn("−", () => { if (ui.bid.q > minFor(ui.bid.f)) { ui.bid.q--; render(); } }, step);
  add("b", null, String(ui.bid.q), step);
  btn("+", () => { if (ui.bid.q < totalDice(g)) { ui.bid.q++; render(); } }, step);
  const mine = g.players[ME].dice.filter(d => d.face === ui.bid.f || d.face === 1).length;
  add("span", "ct-step", `You hold ${mine} (with wilds)`, step);
  const two = add("div", "ct-two", null, panel);
  const call = btn(b ? `Call ${b.q} × ${faceLabel(b.f)}` : "Call", () => play(() => bid(g, { call: true })), two);
  call.disabled = !b;
  btn(`Bid ${ui.bid.q} × ${faceLabel(ui.bid.f)}`, () => play(() => bid(g, { q: ui.bid.q, f: ui.bid.f })), two, "btn primary");
}

function drawPanel(panel, add, btn) {
  const targets = (pick, selected) => {
    const row = add("div", "ct-row", null, panel);
    for (const p of others()) btn(p.name, () => pick(p.i), row, "btn", selected === p.i);
  };
  switch (ui.panel) {
    case "reroll": {
      add("p", "ct-step", "Tap the dice to reroll (rerolling a gold die changes your role).", panel);
      const n = ui.reroll.size;
      const go = btn(n ? `Reroll ${n} ${n === 1 ? "die" : "dice"}` : "Reroll", () => play(() => act(g, { type: "reroll", dice: [...ui.reroll] })), panel, "btn primary");
      go.disabled = !n;
      break;
    }
    case "ask": {
      const a = ui.ask;
      a.target ??= others()[0]?.i;
      targets(i => { a.target = i; render(); }, a.target);
      const kinds = add("div", "ct-row", null, panel);
      for (const [type, label] of [["count", "How many …"], ["any", "Any …"], ["odd", "Odd total?"], ["atLeast", "Total at least …"]]) btn(label, () => { a.type = type; render(); }, kinds, "btn", a.type === type);
      if (a.type === "count" || a.type === "any") {
        const fr = add("div", "ct-row", null, panel);
        for (let f = 1; f <= 6; f++) faceBtn(f, () => { a.f = f; render(); }, fr, a.f === f);
      } else if (a.type === "atLeast") {
        const st = add("div", "ct-stepper", null, panel);
        btn("−", () => { a.n = Math.max(2, a.n - 1); render(); }, st);
        add("b", null, String(a.n), st);
        btn("+", () => { a.n = Math.min(60, a.n + 1); render(); }, st);
      }
      add("p", "ct-step", "They learn the same answer about your hand.", panel);
      btn("Ask", () => play(() => freeAsk(g, a.target, { type: a.type, f: a.f, n: a.n })), panel, "btn primary");
      break;
    }
    case "claim": {
      const c = ui.claim, mine = g.players[ME].dice.filter(d => d.kind === "gold").map(d => d.face);
      const roles = add("div", "ct-row", null, panel);
      for (const [id, x] of Object.entries(ABILITIES)) {
        if (x.free) continue;
        const b = btn(`${x.label} (${x.role})`, () => { c.ability = id; render(); }, roles, "btn", c.ability === id);
        if (x.cost && myPlain() < x.cost) b.disabled = true;
      }
      const x = ABILITIES[c.ability];
      add("p", "ct-step", `${x.label}: ${{ bank: "take 3 dice from the bank", steal: "steal 2 dice from a player (they can block it as Auditor or Legal)", audit: "look at all of a player's dice", inquiry: "learn how many dice on the table show a face", sanction: `pay ${RULES.sanction} dice and a player loses a gold die (they can block it as Legal; the dice are spent either way)` }[c.ability]}. Your gold dice ${mine.includes(x.role) ? "show it" : "don't show it: this is a bluff"}.`, panel);
      if (x.target) { c.target ??= others()[0]?.i; targets(i => { c.target = i; render(); }, c.target); }
      if (c.ability === "inquiry") {
        const fr = add("div", "ct-row", null, panel);
        for (let f = 2; f <= 6; f++) faceBtn(f, () => { c.face = f; render(); }, fr, c.face === f);
      }
      const go = btn(`Claim ${x.label}${x.target ? ` against ${name(c.target)}` : ""}`, () => play(() => act(g, { type: "claim", ability: c.ability, target: x.target ? c.target : undefined, picks: myPicks(c) })), panel, "btn primary");
      if (x.cost && myPlain() < x.cost) go.disabled = true;
      break;
    }
    case "hit": {
      ui.hit ??= others()[0]?.i;
      targets(i => { ui.hit = i; render(); }, ui.hit);
      btn(`Hit ${name(ui.hit)} (pay ${RULES.hit} dice)`, () => play(() => act(g, { type: "hit", target: ui.hit })), panel, "btn primary");
      break;
    }
  }
}

/** Your picks for an ability: which face an inquiry counts. (A steal takes dice you can't see, at random.) */
function myPicks(c) {
  return c.ability === "inquiry" ? { face: c.face } : {};
}
const nextAfter = i => { let j = i; do { j = (j + 1) % g.players.length; } while (g.players[j].out); return j; };

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
    $("challengeKnow").textContent = `${knowText} If they're bluffing, they ${stakeText("lose")} and the ${what} goes ahead; if not, you ${stakeText("lose", true)}.`;
    $("allowBtn").textContent = "Accept the block";
    $("challengeBtn").textContent = "Challenge the block";
  } else {
    const x = ABILITIES[c.ability], blockers = c.target === ME ? x.blockers || [] : [];
    $("challengeText").textContent = `${name(c.claimant)} ${verb(c.claimant, "claim")} ${ROLES[x.role]} to ${purpose(c)}.`;
    $("challengeKnow").textContent = `${knowText} A bluffer caught ${stakeText("loses")}; if it's true, you ${stakeText("lose", true)}.` +
      (blockers.length ? ` Or block it by claiming ${blockers.map(r => ROLES[r]).join(" or ")} yourself.` : "") +
      (c.ability === "sanction" && c.target === ME ? " If it goes through, you lose a gold die." : "");
    $("allowBtn").textContent = "Let it go";
    $("challengeBtn").textContent = "Challenge";
    if (blockers.length) {
      const mine = g.players[ME].dice.filter(d => d.kind === "gold").map(d => d.face);
      for (const role of blockers) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = `Block as ${ROLES[role]}${mine.includes(role) ? "" : " (bluff)"}`;
        b.addEventListener("click", () => answer({ block: role }));
        blockBtns.appendChild(b);
      }
    }
  }
  if (!$("challengeDlg").open) $("challengeDlg").showModal();
}
/** What losing a challenge costs, in words. */
function stakeText(verbForm, challenger = false) {
  if (RULES.goldStakes) return `${verbForm} a gold die`;
  const n = challenger ? RULES.challengeStake : RULES.bluffStake;
  return `${verbForm === "lose" ? "pay" : "pays"} ${n} dice`;
}

function answer(decision) {
  $("challengeDlg").close();
  const c = g.pending;
  play(() => (c.type === "block" ? respondBlock(g, decision === true) : respond(g, decision)));
}

// ---------- the end ----------
function showOver() {
  const w = g.over.winner;
  $("overTitle").textContent = w === ME ? "You win the table" : `${g.players[w].name} wins`;
  const order = g.events.filter(e => e.t === "out").map(e => name(e.p));
  $("overText").textContent = `Out, in order: ${order.join(", ")}. ${g.moves} turns.`;
  if (!$("overDlg").open) $("overDlg").showModal();
}

// ---------- menu ----------
function openMenu() {
  const body = $("menuBody");
  body.innerHTML = "";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("h3", null, "Opponents");
  add("p", "stats", "Choose two or three. They keep what they learn, read your habits and play their character.");
  let picked = chosenOpponents();
  const row = add("div", "ct-row");
  const draw = () => {
    row.replaceChildren(...Object.entries(PERSONAS).map(([id, p]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = `${p.name}, ${p.trait}`;
      b.setAttribute("aria-pressed", String(picked.includes(id)));
      b.addEventListener("click", () => {
        picked = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id].slice(-3);
        draw();
      });
      return b;
    }));
  };
  draw();
  const go = add("button", "btn primary wide", "New game with these");
  go.type = "button";
  go.addEventListener("click", () => {
    if (picked.length < 2) { toast("Pick at least two opponents"); return; }
    if (!g.over && g.moves > 2 && !confirm("Start a new game? This one isn't finished.")) return;
    $("menuDlg").close();
    startGame(picked);
  });
  add("h3", null, "Computer turns");
  add("p", "stats", "Fast and Steady show each move for a moment; Tap to continue holds each one until you tap.");
  const paces = add("div", "ct-row");
  const drawPaces = () => paces.replaceChildren(...Object.entries(PACES).map(([id, p]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = p.label;
    b.setAttribute("aria-pressed", String(pace() === id));
    b.addEventListener("click", () => {
      try { localStorage.setItem(PACE, id); } catch { /* private mode */ }
      drawPaces();
      const computerDue = g.pending ? g.pending.challenger !== ME : g.turn !== ME;
      if (!g.over && computerDue) loop();                    // a move already waiting takes the new pace
    });
    return b;
  }));
  drawPaces();
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
$("helpClose").addEventListener("click", () => $("helpDlg").close());
$("helpGo").addEventListener("click", () => $("helpDlg").close());
$("historyClose").addEventListener("click", () => $("historyDlg").close());
$("overClose").addEventListener("click", () => $("overDlg").close());
$("overNew").addEventListener("click", () => { $("overDlg").close(); startGame(); });
$("challengeBtn").addEventListener("click", () => answer(true));
$("allowBtn").addEventListener("click", () => answer(false));
$("challengeDlg").addEventListener("cancel", e => e.preventDefault());   // a claim against you needs an answer
$("app").addEventListener("click", tapOn);

window.__cartel = { get game() { return g; }, get mind() { return mind; }, get ais() { return ais; }, loop: () => loop() };

g = load();
if (g && !g.over) { setup(); loop(); } else startGame();
if (!localStorage.getItem(SEEN_HELP)) { $("helpDlg").showModal(); try { localStorage.setItem(SEEN_HELP, "1"); } catch { /* private mode */ } }
