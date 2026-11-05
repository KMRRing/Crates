// Rack (a word game on a board) against the computer, or at a table with friends on their own phones. The rules are
// rack-rules.js's, the computer player rack-bot.js's, the running seats.js's (seats-ui.js). This page draws the board and your
// rack, takes your tiles one at a time (tap a tile, tap a square; tap a laid tile to take it back), says what the word is
// worth or why it is refused as you go, and shows a game's end with the leftover tiles settled.
import { rules, CELLS, HAND, valueOf, premiumAt, evaluate, isEmptyBoard } from "./rack-rules.js";
import { ramp } from "./ramp.js";
import { LEVEL_NAMES, bestPlay, warm } from "./rack-bot.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "rack:opts", RECORD = "rack:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["", "Quill", "Sable", "Pip"];                                // the computer players, by seat

let opts = { level: "medium", players: 2, ...read(OPTS, {}) };
// Korbi, 4 November 2026: the menu is the minimum it needs to be. The computer players' strength is the hidden
// ramp (ramp.js), its first step the old saved choice.
const OLD_LEVEL = LEVEL_NAMES.some(([k]) => k === opts.level) ? opts.level : "medium";
const levelNow = () => ramp("rack", LEVEL_NAMES.map(([k]) => k), { start: OLD_LEVEL });
if (![2, 3, 4].includes(opts.players)) opts.players = 2;
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

let V = null, page = null;
const randomRounds = seatRounds("rack");                                    // random mode's round: a game
page = seatPage({
  rules, id: "rack", app: 1, pace: 1100, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => levelNow(),
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
const myTurn = v => !!(v?.G && v.seat != null && v.toMove === v.seat && !v.over);
const who = seat => (isMe(seat) ? "You" : nameOf(seat));
const verb = (seat, you, they) => (isMe(seat) ? you : they);

// ---------- what you are doing this turn ----------
// pend: the squares you have laid tiles on, each { ch (a capital, or lower case for a blank), slot (which tile of the rack) };
// order: the rack as you have arranged it (positions → slots); sel: the position of the tile you hold, if any.
const pend = new Map();
let order = [], orderFor = "", sel = null, stamp = "", blankAt = null;

function sync(v) {
  const s = v.state, key = `${v.G.seq}:${s.moves}:${s.step}`;
  if (key !== stamp) { stamp = key; pend.clear(); sel = null; }
  const rack = v.seat != null ? s.racks[v.seat] : "";
  const kind = [...rack].sort().join("");
  if (kind !== orderFor || order.length !== rack.length) {
    orderFor = kind;
    order = [...rack].map((_, k) => k).sort((a, b) => (rack[a] === "?" ? "~" : rack[a]).localeCompare(rack[b] === "?" ? "~" : rack[b]) || a - b);
    sel = null;
  }
}
const put = () => [...pend].map(([i, p]) => [i, p.ch]);
const used = () => new Set([...pend.values()].map(p => p.slot));

// ---------- what's said ----------
function lastLine(s) {
  const l = s.last;
  if (!l) return "";
  if (l.did === "play") return `${who(l.seat)} ${verb(l.seat, "play", "plays")} <b>${esc(l.words.join(", "))}</b> for ${l.score}${l.bingo ? ", using all seven tiles" : ""}.`;
  if (l.did === "swap") return `${who(l.seat)} ${verb(l.seat, "swap", "swaps")} ${l.n} ${l.n === 1 ? "tile" : "tiles"}.`;
  return `${who(l.seat)} ${verb(l.seat, "pass", "passes")}.`;
}
function statusLine(v) {
  const s = v.state;
  if (s.step === "over") return esc(finalLine(s));
  if (v.seat == null) return `${lastLine(s)}<br>${esc(nameOf(v.toMove ?? 0))} to play.`;
  if (!myTurn(v)) return `${lastLine(s)}<br>${esc(nameOf(v.toMove))} ${v.seats[v.toMove]?.bot ? "is thinking…" : "to play."}`;
  if (pend.size) {
    const r = evaluate(s.board, put());
    return r.error ? esc(r.error) : `<b>${esc(r.words.map(w => w.word).join(" · "))}</b><br><em>${r.score}</em> points${r.bingo ? " with all seven tiles" : ""}`;
  }
  if (isEmptyBoard(s.board)) return "Lay your first word across the star.<br>Tap a tile, then a square.";
  return `${lastLine(s)}<br>Your move.`;
}
function finalLine(s) {
  const w = s.winners;
  if (w.length > 1) return `A tie: ${s.scores[w[0]]} each.`;
  return `${who(w[0])} ${verb(w[0], "win", "wins")} the game, ${s.scores[w[0]]} to ${Math.max(...s.scores.filter((_, i) => i !== w[0]))}.`;
}

// ---------- drawing ----------
const LABEL = { W: "3W", w: "2W", L: "3L", l: "2L", "*": "★" };
function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { for (const id of ["strip", "board", "rack", "status", "bar"]) $(id).innerHTML = ""; return; }
  sync(v);
  const s = v.state;
  $("strip").innerHTML = Array.from({ length: s.seats }, (_, k) => `<span class="rk-pl${s.step === "play" && v.toMove === k ? " turn" : ""}"><b>${esc(who(k))}</b><span>${s.scores[k]}</span></span>`).join("")
    + `<span class="rk-bag">Bag ${s.bag.length}</span>`;
  drawBoard(v);
  drawRack(v);
  $("status").innerHTML = `<span>${statusLine(v)}</span>`;
  drawBar(v);
}

function drawBoard(v) {
  const s = v.state, last = new Set(s.step === "play" || s.step === "over" ? s.last?.cells || [] : []);
  let html = "";
  for (let i = 0; i < CELLS; i++) {
    const ch = s.board[i], p = pend.get(i);
    if (ch !== "." || p) {
      const c = p ? p.ch : ch, blank = c === c.toLowerCase();
      html += `<div class="rk-sq t${blank ? " blank" : ""}${p ? " pend" : ""}${!p && last.has(i) ? " last" : ""}" data-i="${i}"><b>${c.toUpperCase()}</b>${blank ? "" : `<i>${valueOf(c)}</i>`}</div>`;
    } else {
      const m = premiumAt(i);
      html += `<div class="rk-sq ${m === "*" ? "s" : m === "." ? "" : m}" data-i="${i}">${LABEL[m] || ""}</div>`;
    }
  }
  $("board").innerHTML = html;
}

function drawRack(v) {
  const box = $("rack");
  if (v.seat == null) { box.innerHTML = ""; return; }
  const rack = v.state.racks[v.seat], gone = used();
  box.innerHTML = order.map((slot, p) => {
    const t = rack[slot], blank = t === "?";
    return `<button type="button" class="rk-t${blank ? " blank" : ""}${sel === p ? " sel" : ""}${gone.has(slot) ? " gone" : ""}" data-p="${p}" aria-label="${blank ? "blank" : t}"${myTurn(v) ? "" : " disabled"}><b>${blank ? "" : t}</b>${blank ? "" : `<i>${valueOf(t)}</i>`}</button>`;
  }).join("");
}

function drawBar(v) {
  const bar = $("bar"), s = v.state;
  const b = (act, text, { primary = false, off = false } = {}) => `<button type="button" class="btn${primary ? " primary" : ""} rk-go${act === "play" ? " play" : ""}" data-act="${act}"${off ? " disabled" : ""}>${text}</button>`;
  if (s.step === "over") { bar.innerHTML = page.host ? b("again", "New game", { primary: true }) : b("results", "Results"); return; }
  const mine = myTurn(v), r = mine && pend.size ? evaluate(s.board, put()) : null;
  bar.innerHTML = b("shuffle", "Shuffle", { off: v.seat == null }) + b("recall", "Recall", { off: !pend.size }) + b("swap", "Swap", { off: !mine })
    + b("play", r && !r.error ? `Play ${r.score}` : "Play", { primary: true, off: !r || !!r.error });
}

// ---------- your moves ----------
async function play(m) {
  const why = await page.move(m);
  if (why) toast(why);
}
$("rack").addEventListener("click", e => {
  const t = e.target.closest(".rk-t[data-p]");
  if (!t || !myTurn(V)) return;
  const p = Number(t.dataset.p);
  if (used().has(order[p])) return;
  sel = sel === p ? null : p;
  draw();
});
$("board").addEventListener("click", e => {
  const c = e.target.closest("[data-i]");
  if (!c || !myTurn(V)) return;
  const i = Number(c.dataset.i);
  if (pend.has(i)) { pend.delete(i); draw(); return; }                       // take a laid tile back
  if (V.state.board[i] !== "." || sel == null) return;
  const slot = order[sel], tile = V.state.racks[V.seat][slot];
  if (tile === "?") { blankAt = { i, slot }; openBlank(); return; }
  pend.set(i, { ch: tile, slot });
  sel = null;
  draw();
});
$("bar").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled || !V?.G) return;
  const a = b.dataset.act;
  if (a === "play") return void play({ t: "play", put: put() });
  if (a === "recall") { pend.clear(); sel = null; draw(); return; }
  if (a === "shuffle") { for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; } sel = null; draw(); return; }
  if (a === "swap") return void openSwap();
  if (a === "again") return void newGame();
  if (a === "results") showEnd(V);
});

// ---------- a blank, a swap ----------
function openBlank() {
  $("blankKeys").innerHTML = Array.from({ length: 26 }, (_, k) => `<button type="button" data-l="${String.fromCharCode(97 + k)}">${String.fromCharCode(65 + k)}</button>`).join("");
  $("blankDlg").showModal();
}
$("blankKeys").addEventListener("click", e => {
  const k = e.target.closest("[data-l]");
  if (!k || !blankAt) return;
  pend.set(blankAt.i, { ch: k.dataset.l, slot: blankAt.slot });
  blankAt = null;
  sel = null;
  $("blankDlg").close();
  draw();
});
$("blankCancel").addEventListener("click", () => { blankAt = null; $("blankDlg").close(); });

let swapping = new Set();
function openSwap() {
  if (!myTurn(V)) return;
  pend.clear(); sel = null; swapping = new Set();
  draw();
  const rack = V.state.racks[V.seat], can = V.state.bag.length >= HAND;
  $("swapNote").textContent = can ? "Tick the tiles to put back in the bag and draw others, or pass the turn." : "The bag holds fewer than seven tiles, so you can't swap now. You can pass.";
  $("swapRack").innerHTML = order.map((slot, p) => { const t = rack[slot]; return `<button type="button" class="rk-t${t === "?" ? " blank" : ""}" data-s="${slot}"${can ? "" : " disabled"}><b>${t === "?" ? "" : t}</b>${t === "?" ? "" : `<i>${valueOf(t)}</i>`}</button>`; }).join("");
  markSwap();
  $("swapDlg").showModal();
}
function markSwap() {
  for (const b of $("swapRack").children) b.classList.toggle("pick", swapping.has(Number(b.dataset.s)));
  $("swapGo").textContent = swapping.size ? `Swap ${swapping.size}` : "Swap";
  $("swapGo").disabled = !swapping.size;
}
$("swapRack").addEventListener("click", e => {
  const b = e.target.closest("[data-s]");
  if (!b || b.disabled) return;
  const slot = Number(b.dataset.s);
  if (!swapping.delete(slot)) swapping.add(slot);
  markSwap();
});
$("swapCancel").addEventListener("click", () => $("swapDlg").close());
$("swapPass").addEventListener("click", () => { $("swapDlg").close(); play({ t: "pass" }); });
$("swapGo").addEventListener("click", () => {
  const rack = V.state.racks[V.seat], tiles = [...swapping].map(k => rack[k]).join("");
  $("swapDlg").close();
  play({ t: "swap", tiles });
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const w = v.state.winners, won = w.length === 1 && w[0] === v.seat;
  if (!page.atTable) { levelNow(); won ? ramp.won(true) : ramp.lost(); }
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("rack", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, f = s.final, me = v.seat ?? 0;
  const seats = [...Array(s.seats).keys()].sort((a, b) => (a === me ? -1 : b === me ? 1 : f.totals[b] - f.totals[a]));
  $("endHead").textContent = s.winners.length > 1 ? "A tie" : s.winners[0] === v.seat ? "You win" : `${nameOf(s.winners[0])} wins`;
  const sign = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
  const row = k => `<tr class="${s.winners.includes(k) ? "won" : ""}"><th>${esc(who(k))}</th><td>${f.totals[k] - f.adj[k]}</td><td>${f.left[k] ? `${f.left[k]} left` : "out"}</td><td>${sign(f.adj[k])}</td><td><b>${f.totals[k]}</b></td></tr>`;
  $("endBody").innerHTML = `<table class="rk-tally"><thead><tr><th></th><td>Words</td><td>Tiles</td><td>Settled</td><td>Total</td></tr></thead><tbody>${seats.map(row).join("")}</tbody></table>
    <p class="rk-end-note">${s.moves} turns. ${f.out >= 0 ? `${esc(who(f.out))} went out and took the others' tiles.` : "Six turns without a word ended it; everyone loses what they hold."}</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal({}, opts.players);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>A word game for two to four. Seven tiles on your rack; lay a word across or down so that it joins the tiles on the board, and every other word your tiles make is a word too. The first word covers the star.</p>
    <p><b>Scoring.</b> A word scores its tiles' values. A new tile on <b>2L</b> or <b>3L</b> counts double or triple; one on <b>2W</b> or <b>3W</b> doubles or triples the whole word. Squares count the turn the tile is laid and never again. A blank (it stands as any letter you choose) scores nothing. Laying all seven tiles in one turn adds 50.</p>
    <p><b>Your turn.</b> Tap a tile, then a square; tap a laid tile to take it back. The line under the board gives the word and what it is worth, or why it is refused. <b>Swap</b> puts tiles back in the bag for others (only while the bag holds seven or more) and <b>Pass</b> gives up the turn; both are in the Swap button.</p>
    <p><b>Words.</b> There is no challenge: a word that isn't in the word list is refused before your turn is used. The list is a large English one (no proper names); a few rare words a word-tile player knows may be missing.</p>
    <p><b>The end.</b> When the bag is empty and a player has used the last tile, that player adds the others' remaining tiles to their score and each of the others loses theirs. Six turns running without a word end the game too, and everyone loses their own remaining tiles.</p>`;
  $("rulesDlg").showModal();
}

/** The best play there is, laid on the board for you to look at, change or play. */
function hint() {
  if (!myTurn(V)) return;
  const best = bestPlay(V.state, V.seat);
  if (!best) { toast("No word fits: swap or pass"); return; }
  pend.clear();
  const gone = new Set();
  for (const [i, ch] of best.put) {
    const tile = ch === ch.toLowerCase() ? "?" : ch, rack = V.state.racks[V.seat];
    const slot = [...rack].findIndex((t, k) => t === tile && !gone.has(k));
    gone.add(slot);
    pend.set(i, { ch, slot });
  }
  sel = null;
  draw();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const playPart = part(body, "play");
  if (page.host) playPart.append(action("New game", newGame, "primary"));
  if (!page.atTable && V?.G && myTurn(V)) playPart.append(action("Show me the best word", hint));
  page.menu(playPart);
  playPart.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  set.append(choice("Players in a new game", [[2, "2"], [3, "3"], [4, "4"]], opts.players, v => { opts.players = Number(v); saveOpts(); }));
  set.append(line("The number of players applies from the next game."));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("rack:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "rack");
document.querySelector(".rk-mark").innerHTML = APPS.find(a => a.id === "rack")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__rack = { page, hint, get view() { return V; }, opts };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
setTimeout(() => warm(levelNow()), 400);                                    // the computer's word list, built while you look at the board
