// Pegs (cribbage for two) against the computer, or at a table with a friend on their own phone. The rules are
// pegs-rules.js's, the computer player pegs-bot.js's, the running seats.js's (seats-ui.js). This page draws the table:
// the board with each side's two pegs, the other hand as backs, the crib and the starter, the cards played this round
// with the count, and each count of the show itemised; your cards along the foot.
import { rules, TO, SHOW_MS, RANKS, rankOf, suitOf, value, short, cardName, playable } from "./pegs-rules.js";
import { LEVEL_NAMES } from "./pegs-bot.js";
import { seatPage } from "./seats-ui.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "pegs:opts", RECORD = "pegs:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Marlow", "Rowan"];                                         // the computer players, by seat

let opts = { level: "hard", to: 121, voice: false, ...read(OPTS, {}) };
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "hard";
if (!TO.includes(opts.to)) opts.to = 121;
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

const face = id => ({ rank: RANKS[rankOf(id)], suit: suitOf(id) });
const card = (id, cls = "") => cardHtml(face(id), { cls, label: cardName(id) });
const cards = (ids, cls = "") => ids.map(id => card(id, cls)).join("");

let V = null, sel = [], selFor = "", page = null;
const randomRounds = seatRounds("pegs", ["show"]);                          // random mode's round: a deal
page = seatPage({
  rules, id: "pegs", app: 1, pace: 1100, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const mine = () => V?.seat ?? 0;                                           // the seat drawn at the foot (a watcher sees seat 0's)
const isMe = seat => V?.seat != null && seat === V.seat;
const myTurn = v => !!(v?.G && v.seat != null && v.toMove === v.seat);
const who = seat => (isMe(seat) ? "You" : nameOf(seat));
const whose = seat => (isMe(seat) ? "your" : `${nameOf(seat)}'s`);
const verb = (seat, you, they) => (isMe(seat) ? you : they);

// ---------- what's said ----------
function lastLine(s) {
  const l = s.last;
  if (!l || l.did === "deal") return `${who(s.dealer)} ${verb(s.dealer, "deal", "deals")}.`;
  if (l.did === "heels") return `His heels: ${l.pts} for ${who(l.seat)}.`;
  if (l.did === "go") return `One for go to ${who(l.seat)}.`;
  if (l.did === "last") return `One for last card to ${who(l.seat)}.`;
  if (l.did === "play") return `${who(l.seat)} ${verb(l.seat, "play", "plays")} the ${short(l.card)}${l.pts ? `: ${l.why} for ${l.pts}` : ""}.${l.go != null ? ` ${who(l.go)} ${verb(l.go, "say", "says")} go.` : ""}`;
  return "";
}
function breakdown(sh) {
  const rows = [];
  if (sh.fifteens) rows.push([`Fifteens × ${sh.fifteens}`, sh.fifteens * 2]);
  if (sh.pairs) rows.push([`Pairs × ${sh.pairs}`, sh.pairs * 2]);
  if (sh.run) rows.push([`Run of ${sh.run.len}${sh.run.n > 1 ? ` × ${sh.run.n}` : ""}`, sh.run.len * sh.run.n]);
  if (sh.flush) rows.push([`Flush of ${sh.flush === 5 ? "five" : "four"}`, sh.flush]);
  if (sh.nobs) rows.push(["His nobs", 1]);
  if (!rows.length) rows.push(["Nothing: a nineteen hand", 0]);
  return rows;
}
function finalLine(s) {
  const f = s.final;
  return `${who(f.winner)} ${verb(f.winner, "win", "wins")}, ${f.scores[f.winner]} to ${f.scores[f.loser]}${f.skunk ? (f.skunk > 1 ? ": a double skunk" : ": a skunk") : ""}.`;
}

// ---------- the table ----------
function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { for (const id of ["table", "hand", "status", "strip", "bar"]) $(id).innerHTML = ""; return; }
  const s = v.state, me = mine();
  const key = `${v.G.seq}:${s.deal}:${s.step}:${(s.hands[me] || []).length}`;
  if (key !== selFor) { selFor = key; sel = []; }
  $("strip").innerHTML = `Deal <b>${s.deal}</b> · game to ${s.opts.to} · ${esc(who(s.dealer))} ${verb(s.dealer, "have", "has")} the crib`;
  drawTable(v);
  drawHand(v);
  $("status").innerHTML = statusLine(v);
  drawBar(v);
}

function lane(s, seat) {
  const to = s.opts.to, pct = n => `${Math.min(100, (n / to) * 100)}%`;
  const marks = (to === 121 ? [61, 91] : [31]).map(n => `<i class="pg-line" style="left:${pct(n)}"></i>`).join("");
  return `<div class="pg-lane${isMe(seat) ? " me" : ""}"><span class="pg-nm">${esc(who(seat))}</span>
    <span class="pg-track" role="img" aria-label="${esc(who(seat))}: ${s.scores[seat]} of ${to}">${marks}<i class="pg-peg back" style="left:${pct(s.prev[seat])}"></i><i class="pg-peg front" style="left:${pct(s.scores[seat])}"></i></span>
    <b class="pg-pts">${s.scores[seat]}</b></div>`;
}

function drawTable(v) {
  const s = v.state, me = mine(), foe = 1 - me, box = $("table");
  const board = `<div class="pg-board">${lane(s, foe)}${lane(s, me)}</div>`;
  const foeCards = s.step === "show" || s.step === "over" ? 0 : s.hands[foe].length;
  const backs = foeCards ? `<span class="pg-backs">${s.hands[foe].map(() => backHtml()).join("")}</span>` : "";
  const turn = (s.step === "play" || s.step === "discard") && v.toMove === foe;
  const head = `<div class="pg-foe${turn ? " turn" : ""}"><p class="pg-who"><b>${esc(nameOf(foe))}</b>${s.dealer === foe ? '<span class="pg-deal">Crib</span>' : ""}</p>${backs}</div>`;
  let mid;
  if (s.step === "show" && s.show) mid = showHtml(v);
  else if (s.step === "over") mid = `<div class="pg-mid pg-over"><p class="pg-result">${esc(finalLine(s))}</p></div>`;
  else if (s.step === "discard") {
    mid = `<div class="pg-mid"><div class="pg-crib"><span class="pg-cribcards">${[0, 1, 2, 3].map(i => backHtml(i < s.crib.length ? "" : "empty")).join("")}</span><small>${esc(whose(s.dealer))} crib</small></div><p class="pg-last">${esc(lastLine(s))}</p></div>`;
  } else {
    const count = s.seq.reduce((a, e) => a + value(e.card), 0);
    mid = `<div class="pg-mid"><div class="pg-play">
      <div class="pg-starter"><small>Starter</small>${card(s.starter)}</div>
      <div class="pg-count"><small>Count</small><b>${count}</b></div>
      <div class="pg-crib"><span class="pg-cribcards">${[0, 1, 2, 3].map(() => backHtml()).join("")}</span><small>${esc(whose(s.dealer))} crib</small></div></div>
      <div class="pg-seq cd-line">${s.seq.map(e => card(e.card, e.seat === me ? "mine" : "")).join("") || '<span class="pg-new">New round</span>'}</div>
      <p class="pg-last">${esc(lastLine(s))}</p></div>`;
  }
  box.innerHTML = head + board + mid;
}

function showHtml(v) {
  const s = v.state, sh = s.show;
  const title = sh.stage === 2 ? `${esc(whose(sh.seat))} crib` : `${esc(whose(sh.seat))} hand`;
  const left = Math.max(0, (s.until ?? 0) - Date.now());
  const rows = breakdown(sh).map(([t, p]) => `<tr><td>${esc(t)}</td><td>${p}</td></tr>`).join("");
  const here = `<span class="cd-line pg-showcards">${cards(sh.cards)}<span class="pg-plus">+</span>${card(s.starter, "starter")}</span>`;
  return `<div class="pg-mid pg-showing"><p class="pg-title">${title}</p>${here}
    <table class="pg-rows"><tbody>${rows}</tbody><tfoot><tr><td>${esc(who(sh.seat))} ${verb(sh.seat, "score", "scores")}</td><td>${sh.total}</td></tr></tfoot></table>
    <span class="pg-next" aria-hidden="true"><i style="animation-duration:${SHOW_MS}ms;animation-delay:-${Math.min(SHOW_MS, SHOW_MS - left)}ms"></i></span></div>`;
}

// ---------- your cards ----------
function drawHand(v) {
  const box = $("hand"), s = v.state;
  if (v.seat == null) { box.innerHTML = `<p class="pg-watch">Watching: you sit down at the next game.</p>`; return; }
  const showing = s.step === "show" || s.step === "over";
  const hand = showing ? s.keep[v.seat] : s.hands[v.seat];
  const count = s.seq.reduce((a, e) => a + value(e.card), 0);
  const ok = s.step === "play" && myTurn(v) ? new Set(playable(hand, count)) : null;
  let html = "";
  for (const id of [...hand].sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b))) {
    html += cardHtml(face(id), { cls: [sel.includes(id) && "sel", (showing || (ok && !ok.has(id))) && "dim"].filter(Boolean).join(" "), data: { id }, label: cardName(id) });
  }
  box.innerHTML = html;
  fitRow(box, hand.length, { max: 1.2 });
}
$("hand").addEventListener("click", e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c || !V?.G || !myTurn(V)) return;
  const s = V.state, id = Number(c.dataset.id);
  if (s.step === "discard") sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id].slice(-2);
  else if (s.step === "play") sel = sel[0] === id ? [] : [id];
  else return;
  draw();
});

function statusLine(v) {
  const s = v.state;
  if (s.step === "over") return `<span>${esc(finalLine(s))}</span>`;
  if (s.step === "show") return `<span>${s.won != null ? "" : "Tap for the next count, or wait."}</span>`;
  if (v.seat == null) return `<span>${esc(nameOf(v.toMove ?? 0))} to play.</span>`;
  if (!myTurn(v)) return `<span>${esc(nameOf(v.toMove ?? 1 - v.seat))} ${v.seats[v.toMove ?? 0]?.bot ? "is thinking…" : "to play."}</span>`;
  if (s.step === "discard") return `<span>Pick two cards for ${esc(whose(s.dealer))} crib${sel.length ? `: <b>${sel.map(short).join(" ")}</b>` : ""}.</span>`;
  const count = s.seq.reduce((a, e) => a + value(e.card), 0);
  return `<span>Count <b>${count}</b>. ${sel.length ? `Play the <b>${short(sel[0])}</b>.` : "Pick a card to play."}</span>`;
}

function drawBar(v) {
  const bar = $("bar"), s = v.state;
  const b = (act, text, { primary = true, off = false } = {}) => `<button type="button" class="btn${primary ? " primary" : ""} pg-go" data-act="${act}"${off ? " disabled" : ""}>${text}</button>`;
  if (s.step === "show") { bar.innerHTML = b("next", s.won != null ? "See the result" : s.show?.stage === 2 ? "Next deal" : "Next count"); return; }
  if (s.step === "over") { bar.innerHTML = page.host ? b("again", "New game") : ""; return; }
  if (!myTurn(v)) { bar.innerHTML = ""; return; }
  if (s.step === "discard") { bar.innerHTML = b("crib", sel.length === 2 ? `To the crib: ${sel.map(short).join(" ")}` : "To the crib", { off: sel.length !== 2 }); return; }
  bar.innerHTML = b("play", sel.length ? `Play ${short(sel[0])}` : "Play", { off: !sel.length });
}

async function play(m) {
  const why = await page.move(m);
  if (why) toast(why);
}
$("bar").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled || !V?.G) return;
  const a = b.dataset.act;
  if (a === "next") return void play({ t: "next" });
  if (a === "crib") return void play({ t: "crib", cards: sel });
  if (a === "play") return void play({ t: "play", card: sel[0] });
  if (a === "again") newGame();
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.final.winner === v.seat;
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("pegs", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, f = s.final, me = mine();
  $("endHead").textContent = f.winner === v.seat ? "You win" : `${nameOf(f.winner)} wins`;
  $("endBody").innerHTML = `<table class="pg-tally"><tbody>${[me, 1 - me].map(k => `<tr class="${k === f.winner ? "won" : ""}"><th>${esc(who(k))}</th><td><b>${f.scores[k]}</b></td></tr>`).join("")}</tbody></table>
    <p class="pg-end-note">${s.deal} deals${f.skunk ? `. ${f.skunk > 1 ? "A double skunk" : "A skunk"}: ${esc(who(f.loser))} didn't reach ${f.skunk > 1 ? 61 : s.opts.to === 121 ? 91 : 31}.` : "."}</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal({ to: opts.to }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Cribbage for two: be first to peg round the board to 121 (or 61, the short game). Six cards each; each puts two in the <b>crib</b>, which is the dealer's. The starter is turned up (a jack, <b>his heels</b>, is two for the dealer).</p>
    <p><b>The play.</b> The one who didn't deal leads. Each plays a card in turn, calling the count, which may not pass 31. Scoring as you go: 15 or 31 two; a pair two, three alike six, four alike twelve; a run of three or more (the last cards played, in any order) as many as its length. When you can't play, you say go; the other plays on if they can, and the last to play scores one for go (two for exactly 31); the count starts again. One for the last card.</p>
    <p><b>The show.</b> The one who didn't deal counts four cards and the starter, then the dealer, then the dealer counts the crib. Fifteens two each, pairs two each, runs by their length, four cards of a suit four (five with the starter; the crib needs all five), and the jack of the starter's suit in your hand one (his nobs). Pegs counts for you, and says how.</p>
    <p><b>The board.</b> Two pegs a side: the front peg is your score and the back peg where it was before. First to 121 wins at once, in the middle of the play or of a count. A loser left under 91 is skunked; under 61, double skunked.</p>`;
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  play.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  set.append(choice("Computer player", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(choice("A game goes to", TO.map(n => [n, String(n)]), opts.to, v => { opts.to = Number(v); saveOpts(); }));
  set.append(line("The length applies from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("pegs:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "pegs");
document.querySelector(".pg-mark").innerHTML = APPS.find(a => a.id === "pegs")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__pegs = { page, get view() { return V; }, opts };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
