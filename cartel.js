// Cartel: you against computer players. Rules and the referee are in cartel-engine.js, the players in
// cartel-ai.js. Your view is built the same way theirs is: a Mind follows the events as your seat sees them,
// so the table shows exactly what you could know, no more.
import { newGame, act, respond, bid, seen, beats, mustHit, rng, ROLES, POWERS, RULES, totalDice } from "./cartel-engine.js";
import { Player, Mind, PERSONAS } from "./cartel-ai.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const STORE = "cartel:game", TABLE = "cartel:table", FAST = "cartel:fast", SEEN_HELP = "cartel:help";
const ME = 0;

let g = null;                 // the game (the referee's truth)
let ais = [];                 // the computer players, by seat (null for you)
let mind = null;              // what you know
let publicMind = null;        // what everyone knows (to show which of your dice the table has seen)
let ui = null;                // your choices in progress
let timer = null;

const freshUi = () => ({ panel: null, reroll: new Set(), ask: { target: null, type: "count", f: 4, n: 15 }, claim: { role: 2, target: null, face: 4 }, hit: null, bid: null });
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
const delay = () => (localStorage.getItem(FAST) === "1" ? 150 : g.players[ME].out ? 120 : 700);

function loop() {
  clearTimeout(timer);
  mind.follow(g, e => seen(e, ME));
  publicMind.follow(g, e => ({ ...e, priv: undefined }));
  for (const ai of ais) ai?.sync(g, seen);
  save();
  render();
  if (g.over) { showOver(); return; }
  const c = g.pending;
  if (c) {
    if (c.challenger === ME) { showChallenge(); return; }
    timer = setTimeout(() => { respond(g, ais[c.challenger].challenge(g)); loop(); }, delay());
    return;
  }
  if (g.turn === ME) return;                        // your controls are up
  const ai = ais[g.turn];
  timer = setTimeout(() => {
    try {
      if (g.step === "act") act(g, ai.action(g)); else bid(g, ai.bid(g));
    } catch (e) {
      console.error(e);                              // a move the referee refused: fall back to the plainest legal one
      if (g.step === "act") act(g, mustHit(g) ? { type: "hit", target: others()[0]?.i ?? alive0() } : { type: "pass" });
      else bid(g, g.bid ? { call: true } : { q: 1, f: 2 });
    }
    loop();
  }, delay());
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
  renderBid();
  renderLog();
  renderMe();
  renderControls();
}

function dieEl({ face, kind, how, open }, extra = "") {
  const el = document.createElement("span");
  el.className = `ct-die${kind === "gold" ? " gold" : ""}${face == null ? " cup" : ""}${how === "peek" ? " peek" : ""}${open ? " open" : ""}${extra}`;
  el.textContent = face == null ? "?" : face;
  el.title = face == null ? `A hidden ${kind} die` : `${kind === "gold" ? `Gold ${face}: ${ROLES[face]}` : `Plain ${face}`}${how === "peek" ? " (only you know)" : ""}`;
  return el;
}
const byKind = list => [...list].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "gold" ? -1 : 1));

function renderSeats() {
  $("seats").replaceChildren(...g.players.filter(p => p.i !== ME).map(p => {
    const card = document.createElement("div");
    card.className = `ct-seat${g.turn === p.i && !g.over ? " turn" : ""}${p.out ? " out" : ""}`;
    const who = document.createElement("div");
    who.className = "ct-who";
    const b = document.createElement("b"), s = document.createElement("span");
    b.textContent = p.name;
    s.textContent = p.out ? "out" : PERSONAS[p.persona].trait;
    who.append(b, s);
    const dice = document.createElement("div");
    dice.className = "ct-dice";
    dice.append(...byKind(mind.known(p.i)).map(d => dieEl({ ...d, open: d.how === "public" })));
    card.append(who, dice);
    return card;
  }));
}

function renderBid() {
  const bar = $("bidBar"), b = g.bid;
  bar.innerHTML = "";
  const main = document.createElement("span"), small = document.createElement("small");
  main.textContent = b ? `${name(b.by)} bid ${b.q} × ${faceLabel(b.f)}` : "No bid yet";
  small.textContent = `${totalDice(g)} dice on the table`;
  bar.append(main, small);
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
    case "claim": return `${n(x.p)} ${verb(x.p, "claim")} ${POWERS[x.role].name}${x.target != null ? ` against ${x.target === ME ? "you" : n(x.target)}` : ""}.`;
    case "challenge": return x.held
      ? `${n(x.p)} ${verb(x.p, "challenge")}: true, a gold ${x.die.face}. ${n(x.p)} ${verb(x.p, "pay")} 2.`
      : `${n(x.p)} ${verb(x.p, "challenge")}: a bluff! ${n(x.claimant)} ${verb(x.claimant, "pay")} 2.`;
    case "allow": return `${n(x.p)} ${verb(x.p, "let")} it go.`;
    case "trader": return `${n(x.p)} ${verb(x.p, "take")} ${x.dice.length} dice: ${x.dice.map(d => d.face).join(", ")}.`;
    case "broker": return x.none ? `${n(x.p)} ${verb(x.p, "get")} nothing.` : `${n(x.p)} ${verb(x.p, "take")} ${x.lost.length} from ${x.target === ME ? "you" : n(x.target)}.`;
    case "scout": return `${n(x.p)} ${verb(x.p, "look")} at a die of ${x.target === ME ? "yours" : n(x.target)}${x.face ? `: a ${x.face}` : ""}.`;
    case "enforcer": return `${x.target === ME ? "You have" : `${n(x.target)} has`} to reroll a die.`;
    case "insider": return `${n(x.p)} ${verb(x.p, "learn")} how many ${faceLabel(x.face)} are out${x.count != null ? `: ${x.count}` : ""}.`;
    case "bid": return `${n(x.p)} ${verb(x.p, "bid")} ${x.q} × ${faceLabel(x.f)}.`;
    case "call": return `${n(x.p)} ${verb(x.p, "call")} ${x.bid.q} × ${faceLabel(x.bid.f)}: ${x.held ? "it holds" : "it doesn't hold"}.`;
    case "loseGold": return `${n(x.p)} ${verb(x.p, "lose")} a gold die (${x.die.face}, ${ROLES[x.die.face]}).`;
    case "out": return `${n(x.p)} ${x.p === ME ? "are" : "is"} out.`;
    case "win": return x.p === ME ? "You win the table!" : `${n(x.p)} wins.`;
    default: return null;
  }
}
const questionText = q => ({ odd: "is the total odd?", atLeast: `is the total at least ${q.n}?`, any: `any ${faceLabel(q.f)}?`, count: `how many ${faceLabel(q.f)}?` }[q.type]);
/** An answer as you saw it: about them if you asked, about the asker if you were asked. */
function answerText(e, a) {
  const about = e.p === ME ? (e.target === ME ? "you" : name(e.target)) : name(e.p);
  const v = typeof a === "number" ? String(a) : a ? "yes" : "no";
  return `(${about}: ${v})`;
}

function renderLog() {
  const lines = g.events.map(e => line(seen(e, ME))).filter(Boolean);
  const recent = lines.slice(-4);
  const items = recent.map(t => { const li = document.createElement("li"); li.textContent = t; return li; });
  if (lines.length > 4) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.textContent = "Everything so far";
    b.addEventListener("click", () => { $("history").replaceChildren(...lines.map(t => { const x = document.createElement("li"); x.textContent = t; return x; })); $("historyDlg").showModal(); });
    li.appendChild(b);
    items.unshift(li);
  }
  $("log").replaceChildren(...items);
}

function renderMe() {
  const me = g.players[ME];
  document.querySelector(".ct-me").classList.toggle("turn", g.turn === ME && !g.over);
  const seenByAll = new Set(publicMind.known(ME).filter(d => d.face != null).map(d => d.id));
  const picking = ui.panel === "reroll";
  $("myDice").replaceChildren(...byKind(me.dice).map(d => {
    const el = dieEl({ face: d.face, kind: d.kind, open: seenByAll.has(d.id) }, picking ? ` pickable${ui.reroll.has(d.id) ? " picked" : ""}` : "");
    if (d.kind === "gold") { const s = document.createElement("small"); s.textContent = ROLES[d.face]; el.appendChild(s); }
    if (picking) el.addEventListener("click", () => { ui.reroll.has(d.id) ? ui.reroll.delete(d.id) : ui.reroll.add(d.id); render(); });
    return el;
  }));
  $("meNote").textContent = me.out ? "You're out." : `${myPlain()} plain${seenByAll.size ? `, ${seenByAll.size} seen by everyone` : ""}`;
  $("notes").replaceChildren(...mind.notes().map(nt => { const li = document.createElement("li"); li.textContent = `${nt.p == null ? "Table" : name(nt.p)}: ${nt.text}`; return li; }));
}

// ---------- your turn ----------
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
  if (g.turn !== ME || g.pending) { add("p", "ct-waiting", g.pending ? `${name(g.pending.challenger)} ${verb(g.pending.challenger, "decide")} whether to challenge…` : `${name(g.turn)} is thinking…`); return; }

  if (g.step === "act") {
    const forced = mustHit(g);
    add("p", "ct-step", forced ? "Your hand is full: you have to hit someone." : "Your move");
    const row = add("div", "ct-row");
    const panels = forced ? [["hit", "Hit"]] : [["take", "Take"], ["reroll", "Reroll"], ["ask", "Ask"], ["claim", "Claim a role"], ["hit", "Hit"], ["pass", "Pass"]];
    for (const [id, label] of panels) {
      const b = btn(label, () => {
        if (id === "take") play(() => act(g, { type: "take" }));
        else if (id === "pass") play(() => act(g, { type: "pass" }));
        else { ui.panel = ui.panel === id ? null : id; render(); }
      }, row, "btn", ui.panel === id);
      if (id === "take" && myPlain() >= RULES.cap) b.disabled = true;
      if (id === "hit" && myPlain() < RULES.hit) b.disabled = true;
    }
    if (ui.panel) {
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
  for (let f = 2; f <= 6; f++) btn(`${f}s`, () => { ui.bid.f = f; if (ui.bid.q < minFor(f)) ui.bid.q = minFor(f); render(); }, faces, "btn", ui.bid.f === f);
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
        for (let f = 1; f <= 6; f++) btn(`${f}s`, () => { a.f = f; render(); }, fr, "btn", a.f === f);
      } else if (a.type === "atLeast") {
        const st = add("div", "ct-stepper", null, panel);
        btn("−", () => { a.n = Math.max(2, a.n - 1); render(); }, st);
        add("b", null, String(a.n), st);
        btn("+", () => { a.n = Math.min(60, a.n + 1); render(); }, st);
      }
      add("p", "ct-step", "They learn the same answer about your hand.", panel);
      btn("Ask", () => play(() => act(g, { type: "ask", target: a.target, question: { type: a.type, f: a.f, n: a.n } })), panel, "btn primary");
      break;
    }
    case "claim": {
      const c = ui.claim;
      const roles = add("div", "ct-row", null, panel);
      for (const f of [2, 3, 4, 5, 6]) btn(`${POWERS[f].name} (${f})`, () => { c.role = f; render(); }, roles, "btn", c.role === f);
      const power = POWERS[c.role];
      add("p", "ct-step", `${power.name}: ${{ 2: "take 3 dice from the bank", 3: "steal 2 dice from a player", 4: "look at one of a player's dice", 5: "make one of a player's dice reroll", 6: "learn how many dice show a face" }[c.role]}. Your gold dice ${g.players[ME].dice.filter(d => d.kind === "gold" && d.face === c.role).length ? "show it" : "don't show it: this is a bluff"}.`, panel);
      if (power.target) { c.target ??= others()[0]?.i; targets(i => { c.target = i; render(); }, c.target); }
      if (c.role === 6) {
        const fr = add("div", "ct-row", null, panel);
        for (let f = 2; f <= 6; f++) btn(`${f}s`, () => { c.face = f; render(); }, fr, "btn", c.face === f);
      }
      btn(`Claim ${power.name}${power.target ? ` against ${name(c.target)}` : ""}`, () => play(() => act(g, { type: "claim", role: c.role, target: power.target ? c.target : undefined, picks: myPicks(c) })), panel, "btn primary");
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

/** Your picks for a role: look at or reroll a die you know least about, spend the gold die you'd miss least. */
function myPicks(c) {
  const picks = {};
  if (c.target != null) {
    const theirs = mind.known(c.target);
    if (c.role === 4) picks.die = (theirs.find(d => d.kind === "gold" && d.face == null) || theirs.find(d => d.face == null) || theirs[0])?.id;
    if (c.role === 5) picks.die = (theirs.find(d => d.kind === "gold" && d.face != null && d.face !== 1) || theirs.find(d => d.kind === "gold") || theirs[0])?.id;
  }
  if (c.role === 6) picks.face = c.face;
  const gold = g.players[ME].dice.filter(d => d.kind === "gold");
  const seenByAll = new Set(publicMind.known(ME).filter(d => d.face != null).map(d => d.id));
  picks.spend = (gold.find(d => d.face === 1) || gold.find(d => seenByAll.has(d.id)) || gold.find(d => d.face === c.role) || gold[0])?.id;
  return picks;
}

// ---------- challenges aimed at you ----------
function showChallenge() {
  const c = g.pending, power = POWERS[c.role];
  $("challengeText").textContent = `${name(c.claimant)} ${verb(c.claimant, "claim")} ${power.name}: ${c.target === ME ? `${power.says} you` : power.says}.`;
  const theirGold = mind.known(c.claimant).filter(d => d.kind === "gold");
  const known = theirGold.filter(d => d.face != null).map(d => d.face);
  $("challengeKnow").textContent = `${known.length ? `You know ${known.length === theirGold.length ? "their gold dice" : "one of their gold dice"}: ${known.join(", ")}.` : "You haven't seen their gold dice."} A bluffer caught pays you ${RULES.stake}; if it's true, you pay ${RULES.stake}.`;
  if (!$("challengeDlg").open) $("challengeDlg").showModal();
}
function answerChallenge(yes) {
  $("challengeDlg").close();
  play(() => respond(g, yes));
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
  const fast = add("button", "btn wide", localStorage.getItem(FAST) === "1" ? "Computer turns: fast" : "Computer turns: steady");
  fast.type = "button";
  fast.addEventListener("click", () => {
    try { localStorage.setItem(FAST, localStorage.getItem(FAST) === "1" ? "0" : "1"); } catch { /* private mode */ }
    fast.textContent = localStorage.getItem(FAST) === "1" ? "Computer turns: fast" : "Computer turns: steady";
  });
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
$("challengeBtn").addEventListener("click", () => answerChallenge(true));
$("allowBtn").addEventListener("click", () => answerChallenge(false));
$("challengeDlg").addEventListener("cancel", e => e.preventDefault());   // a claim against you needs an answer

window.__cartel = { get game() { return g; }, get mind() { return mind; }, get ais() { return ais; } };

g = load();
if (g && !g.over) { setup(); loop(); } else startGame();
if (!localStorage.getItem(SEEN_HELP)) { $("helpDlg").showModal(); try { localStorage.setItem(SEEN_HELP, "1"); } catch { /* private mode */ } }
