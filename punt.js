// Punt: pick an option, stake a share of the pot at the house's odds, or pass (rules in punt-gen.js).
// Solo sessions are saved in this browser. Together, both players share one pot; each stakes up to half of it
// on their own pick, so you can back the same option or hedge against each other. A question settles once
// everyone at the table has bet or passed.
import { makeSession, settle, LEVELS, START_POT, showOdds, showChips } from "./punt-gen.js";
import { createTogether, seatsOf } from "./together.js";
import { bindSwitcher, APPS } from "./apps.js";
import { gameHref, GAMES } from "./rooms.js";

const $ = id => document.getElementById(id);
const STORE = "punt:solo", SEEN_HELP = "punt:help";
const APP = 1;
const ME = "me";                                   // the solo player's seat
const randomSeed = () => Math.floor(Math.random() * 1e9);

// S: { seed, level, questions, index, pot, phase: "bet" | "reveal", bets: { id: { pick, pct } }, log: [result], done }
// a result: { index, pot (before), bets, change }
let S = null;
let pick = null;      // the option chosen on this device for the current question
let pct = 0;          // the stake chosen on this device, as a share of the pot
let shownDone = null;

const me = () => (together.room ? together.room.uid : ME);
const maxPct = () => (together.room ? 50 : 100);
const question = () => S.questions[S.index];
const seated = () => (together.room ? seatsOf(together.room.data).map(([id]) => id) : [ME]);

// ---------- sessions ----------
function freshState(level, players = null) {
  const seed = randomSeed();
  return { v: 1, app: APP, seed, level, questions: makeSession(seed, level), index: 0, pot: START_POT, phase: "bet",
    bets: {}, log: [], done: null, created: Date.now(), ...(players && { players }) };
}
function loadSolo() { try { const s = JSON.parse(localStorage.getItem(STORE)); return s?.questions?.length ? s : null; } catch { return null; } }
function saveSolo() { if (!together.room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

function soloSession(seed, level) {
  S = { v: 1, seed, level, questions: makeSession(seed, level), index: 0, pot: START_POT, phase: "bet", bets: {}, log: [], done: null };
  resetChoice();
  shownDone = null;
  saveSolo();
  history.replaceState(null, "", `#s=${seed}&d=${level}`);
  render();
}

function newSession(level = S.level) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new session? This one isn't finished.")) { render(); return; }
  if (!together.room) { soloSession(randomSeed(), level); return; }
  const next = freshState(level);
  together.act(g => { Object.assign(g, { seed: next.seed, level, questions: next.questions, index: 0, pot: START_POT, phase: "bet", bets: {}, log: [], done: null }); });
}

const resetChoice = () => { pick = null; pct = 0; };

// ---------- betting ----------
/** Applies a change to the session: the solo save, or the room in one transaction. */
function change(fn) {
  if (together.room) return together.act(g => { g.bets ||= {}; g.log = Object.values(g.log || {}); return fn(g); });
  if (fn(S) === false) return Promise.resolve(false);
  saveSolo();
  render();
  return Promise.resolve(true);
}

/** Once everyone at the table has bet or passed: pay out, and show what happened. */
function settleIfReady(g, ids) {
  if (!ids.every(id => g.bets[id])) return;
  const q = g.questions[g.index];
  let total = 0;
  const bets = {};
  for (const id of ids) {
    const { pick: p, pct: share } = g.bets[id];
    const right = p != null && q.options[p].right;
    const { stake, change: c } = p == null ? { stake: 0, change: 0 } : settle(g.pot, share, right, q.offered);
    bets[id] = { pick: p, pct: share, stake, change: c };
    total += c;
  }
  g.log.push({ index: g.index, pot: g.pot, bets, change: total });
  g.pot = Math.max(0, g.pot + total);
  g.phase = "reveal";
  g.bets = {};
}

function place(passing) {
  if (S.done || S.phase !== "bet") return;
  if (!passing && (pick == null || pct <= 0)) { toast(pick == null ? "Pick an option first" : "Set a stake, or pass"); return; }
  const bet = passing ? { pick: null, pct: 0 } : { pick, pct: Math.min(pct, maxPct()) };
  const id = me(), index = S.index;
  change(g => {
    if (g.done || g.phase !== "bet" || g.index !== index) return false;
    g.bets[id] = bet;
    settleIfReady(g, together.room ? seatsOf(g).map(([x]) => x) : [ME]);
  });
}

function next() {
  const index = S.index;
  change(g => {
    if (g.phase !== "reveal" || g.index !== index) return false;
    if (g.index + 1 >= g.questions.length || g.pot <= 0) { g.done = { at: Date.now() }; return; }
    g.index++;
    g.phase = "bet";
  }).then(() => resetChoice());
}

// ---------- rendering ----------
function render() {
  if (!S) return;
  $("level").value = S.level;
  drawPartner();
  const q = question() || S.questions[S.questions.length - 1];
  const last = S.log[S.log.length - 1];
  const reveal = S.phase === "reveal" || S.done;
  $("progress").textContent = `Question ${Math.min(S.index + 1, S.questions.length)} of ${S.questions.length}`;
  const pot = $("pot");
  pot.textContent = showChips(S.pot);
  pot.className = reveal && last ? (last.change > 0 ? "up" : last.change < 0 ? "down" : "") : "";

  $("ask").textContent = q.ask;
  $("prompt").textContent = q.prompt;
  const mine = reveal && last ? last.bets[me()] : null;
  $("options").replaceChildren(...q.options.map((o, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pt-option";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String((reveal ? mine?.pick : pick) === i));
    b.textContent = o.label;
    if (reveal) {
      b.disabled = true;
      if (o.right) b.classList.add("right");
      else if (Object.values(last?.bets || {}).some(x => x.pick === i)) b.classList.add("wrong");
    } else b.addEventListener("click", () => { pick = i; render(); });
    return b;
  }));

  const waiting = !reveal && !!S.bets?.[me()];
  $("betting").hidden = reveal;
  $("result").hidden = !reveal;
  if (!reveal) drawBetting(q, waiting);
  else drawResult(q, last);
  if (S.done && JSON.stringify(S.done) !== shownDone) { shownDone = JSON.stringify(S.done); showDone(); }
}

function drawBetting(q, waiting) {
  $("odds").textContent = showOdds(q.offered);
  const slider = $("stake");
  slider.max = maxPct();
  slider.value = pct;
  slider.disabled = waiting;
  const stake = Math.floor(S.pot * pct / 100);
  $("stakeLine").innerHTML = "";
  if (waiting) $("stakeLine").append(`Your bet is in. Waiting for ${partnerName()}.`);
  else if (stake > 0) {
    const s = document.createElement("b"), w = document.createElement("b");
    s.textContent = showChips(stake); w.textContent = showChips(Math.round(stake * q.offered));
    $("stakeLine").append(`Stake `, s, ` (${pct}%) returns `, w, " if right");
  } else $("stakeLine").append(together.room ? "Stake up to half the shared pot, or pass." : "Choose a stake, or pass.");
  $("chips").replaceChildren(...[0, 5, 10, 25, 50, 100].filter(x => x <= maxPct()).map(x => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.disabled = waiting;
    b.textContent = x === maxPct() ? (together.room ? "Half" : "All in") : `${x}%`;
    b.addEventListener("click", () => { pct = x; render(); });
    return b;
  }));
  $("passBtn").disabled = waiting;
  $("betBtn").disabled = waiting || pick == null || pct <= 0;
  $("betBtn").textContent = stake > 0 ? `Bet ${showChips(stake)}` : "Bet";
}

function drawResult(q, last) {
  const v = $("verdict");
  if (!last) { v.textContent = ""; return; }
  const mine = last.bets[me()];
  v.className = "pt-verdict" + (last.change > 0 ? " won" : last.change < 0 ? " lost" : "");
  const signed = n => `${n > 0 ? "+" : n < 0 ? "−" : ""}${showChips(Math.abs(n))}`;
  if (together.room) {
    const parts = Object.entries(last.bets).map(([id, b]) => `${id === me() ? "You" : nameOf(id)} ${b.pick == null ? "passed" : `${signed(b.change)}`}`);
    v.textContent = `${parts.join(", ")}. Pot ${signed(last.change)}.`;
  } else if (!mine || mine.pick == null) v.textContent = "Passed.";
  else v.textContent = mine.change > 0 ? `Right! ${signed(mine.change)}` : `Wrong. ${signed(mine.change)}`;
  $("notes").replaceChildren(...q.notes.map(n => {
    const li = document.createElement("li"), b = document.createElement("b");
    b.textContent = n.label;
    li.append(b, `: ${n.text}`);
    return li;
  }));
  const verdict = q.offered > q.fair ? "more than it was worth" : q.offered < q.fair ? "less than it was worth" : "about what it was worth";
  $("house").textContent = `The house put a typical player's chance at ${Math.round(q.chance * 100)}%, a fair price of ${showOdds(q.fair)}. It paid ${showOdds(q.offered)}: ${verdict}.`;
  $("nextBtn").hidden = !!S.done;
  $("nextBtn").textContent = S.index + 1 >= S.questions.length || S.pot <= 0 ? "See how you did" : "Next question";
}

function showDone() {
  const bets = S.log.flatMap(r => Object.entries(r.bets).filter(([id, b]) => id === me() && b.pick != null).map(([, b]) => b));
  const won = bets.filter(b => b.change > 0).length;
  $("doneTitle").textContent = S.pot <= 0 ? "Bust" : S.pot > START_POT ? "Up on the house" : S.pot < START_POT ? "Down on the day" : "Level";
  const stats = [["Final pot", showChips(S.pot)], ["Growth", `${(S.pot / START_POT).toFixed(2)}×`], ["Bets won", `${won} of ${bets.length}`]];
  $("doneStats").replaceChildren(...stats.map(([label, value]) => {
    const box = document.createElement("div"), dd = document.createElement("dd"), dt = document.createElement("dt");
    dd.textContent = value; dt.textContent = label;
    box.append(dd, dt);
    return box;
  }));
  const passes = S.log.filter(r => r.bets[me()]?.pick == null).length;
  $("doneNote").textContent = `${passes} pass${passes === 1 ? "" : "es"}. The same session for anyone with the link: ${location.origin}${location.pathname}#s=${S.seed}&d=${S.level}`;
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- together ----------
function nameOf(id) { return together.room?.data?.players?.[id]?.name || "your partner"; }
function partnerName() { return together.partner()?.name || "your partner"; }
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "";
  if (!together.online) { el.append("Reconnecting… bets made now may not reach your partner."); return; }
  const p = together.partner();
  if (!p) { el.append(`Game ${together.room.code}: waiting for your partner to join.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
  if (p.game) {
    const go = document.createElement("a");
    go.href = gameHref(p.game);
    go.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, go);
    return;
  }
  const theirs = Object.keys(S.bets || {}).some(id => id !== me());
  el.append("Sharing a pot with ", b, S.phase === "bet" && theirs ? " (their bet is in)." : ".");
}

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
  game: "punt",
  app: APP,
  toast,
  askName,
  valid: g => !!g?.questions,
  fresh: players => freshState(S?.level || "medium", players),
  onState: val => {
    const moved = !S || S.seed !== val.seed || S.index !== val.index || S.phase !== val.phase;
    S = { ...val, bets: val.bets || {}, log: Object.values(val.log || {}) };
    if (moved) resetChoice();
    if (moved && !val.done) shownDone = null;
    render();
  },
  onPresence: () => drawPartner(),
  onLeave: () => { S = loadSolo(); if (!S) { soloSession(randomSeed(), "easy"); return; } resetChoice(); render(); },
});

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }
function drawMenu() {
  const body = $("menuBody");
  body.innerHTML = "";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  button("New session", () => newSession());
  button("How to play", () => $("helpDlg").showModal());
  const room = together.room;
  if (!room) {
    button("Play together", async () => { if (await together.start()) openMenu(); });
    const row = add("form", "join-run");
    const input = document.createElement("input");
    input.placeholder = "Code"; input.maxLength = 4; input.autocapitalize = "characters";
    const go = document.createElement("button");
    go.className = "btn"; go.type = "submit"; go.textContent = "Join";
    row.append(input, go);
    row.addEventListener("submit", e => {
      e.preventDefault();
      const code = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (code.length === 4) { $("menuDlg").close(); together.join(code); }
    });
    button("Copy a link to this session", async () => {
      try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast(location.href, 6000); }
    }, "link");
  } else {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("h3", null, `Game ${room.code}`);
    add("p", "stats", "Send this link to your partner: you share one pot, and each of you stakes up to half of it on your own pick. Switching games (tap the title) keeps you both in this room, and each game's progress is kept.");
    add("p", "room-link", link);
    button("Copy link", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); } });
    button("Leave the room", () => together.leave(), "link");
  }
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "punt");
document.querySelector(".pt-mark").innerHTML = APPS.find(a => a.id === "punt").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("helpClose").addEventListener("click", () => $("helpDlg").close());
$("helpGo").addEventListener("click", () => $("helpDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneNew").addEventListener("click", () => { $("doneDlg").close(); newSession(); });
$("level").addEventListener("change", e => newSession(e.target.value));
$("stake").addEventListener("input", e => { pct = Number(e.target.value); render(); });
$("passBtn").addEventListener("click", () => place(true));
$("betBtn").addEventListener("click", () => place(false));
$("nextBtn").addEventListener("click", next);
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("hashchange", () => {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("s")), level = h.get("d");
  if (!together.room && seed && LEVELS[level] && !(S && S.seed === seed && S.level === level)) soloSession(seed, level);
});

// for tests and debugging
window.__punt = { get state() { return S; }, get together() { return together; } };

// start: a shared session (#s=…&d=…), the saved one, or a fresh Easy session for a first visit
const hash = new URLSearchParams(location.hash.slice(1));
const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
S = loadSolo();
const linked = Number(hash.get("s")), linkedLevel = hash.get("d");
if (linked && LEVELS[linkedLevel] && !(S && S.seed === linked && S.level === linkedLevel)) soloSession(linked, linkedLevel);
else if (!S) soloSession(randomSeed(), "easy");
else { shownDone = S.done ? JSON.stringify(S.done) : null; history.replaceState(null, "", `${location.search}#s=${S.seed}&d=${S.level}`); render(); }
if (!localStorage.getItem(SEEN_HELP) && !code) { $("helpDlg").showModal(); try { localStorage.setItem(SEEN_HELP, "1"); } catch { /* private mode */ } }
if (code.length === 4) together.join(code);
