// Yacht (yacht.html): the five-dice game against the clock of nothing, alone for a best score and a daily (the same dice
// for everyone that day), or with up to three computer players or friends at a table. The rules are yacht-rules.js's, the
// computer players yacht-bot.js's, the running seats.js's (solo, or a table through seats-ui.js). This page draws the
// dice (flat, or thrown on a felt in 3D: yacht-3d.js), the score sheet and the two buttons.
import { rules, CATS, CAT_HELP, ROUNDS, BONUS, BONUS_AT, scoreOf, totals, winners, roundOf, openOf } from "./yacht-rules.js";
import { LEVEL_NAMES, advise } from "./yacht-bot.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { tableView } from "./table3d-view.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, today, arrivedForToday } from "./suite.js";
import { sure } from "./sure.js";
import { die } from "./yacht-die.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./yacht-course.js";
import { yachtStage } from "./yacht-course-stage.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "yacht:opts", RECORD = "yacht:record", BEST = "yacht:best", DAILY = "yacht:daily";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Tern", "Gull", "Skua"];                                  // the computer players, by seat (yours is 0)

// the menu's choices: the next game's (players) and the page's own
let opts = { seats: 1, level: "hard", quick: false, ...read(OPTS, {}) };
if (!(opts.seats >= 1 && opts.seats <= 4)) opts.seats = 1;
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the table ----------
let V = null;                                     // the view on screen
let ui = { key: "", sel: null };                  // the category picked, for the position it was picked in
let rolledKey = null;                             // the roll whose dice last tumbled
let freshN = -1;                                  // the move whose score was last lit
let page = null;                                  // set once the runner is up (it draws its first view while starting)
const randomRounds = seatRounds("yacht");         // random mode's round: a game
page = seatPage({
  rules, id: "yacht", app: 1, pace: 800, botName: s => NAMES[s - 1] || `Seat ${s + 1}`, level: () => opts.level, voice: () => false,
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const nameOf = seat => (seat === V?.seat ? "You" : V?.seats?.[seat]?.name ?? NAMES[seat - 1] ?? `Seat ${seat + 1}`);
const isMe = seat => V?.seat != null && seat === V.seat;
const myTurn = v => !!v?.G && v.seat != null && v.state.step === "play" && v.state.turn === v.seat;

function draw() {
  if (!page) return;
  const v = V;
  document.body.classList.toggle("ya-watch", !!v?.G && v.seat == null);
  const s = v?.G ? v.state : null;
  const rolledNow = s ? `${v.G.seq}:${s.turn}:${roundOf(s, s.turn)}:${s.left}` : "";
  const rolled = s && s.left < 3 && rolledKey !== null && rolledKey !== rolledNow;       // a roll has just come in (not a reload's first draw)
  if (ui.key !== rolledNow) ui = { key: rolledNow, sel: null };
  drawStatus(v);
  drawStage(v, rolled);
  rolledKey = rolledNow;
  drawSheet(v);
  drawControls(v);
}

function drawStatus(v) {
  const box = $("status");
  if (!v?.G) { box.textContent = ""; return; }
  const s = v.state;
  if (s.step === "over") { box.innerHTML = "Game over"; return; }
  const who = isMe(s.turn) ? "Your turn" : `${esc(nameOf(s.turn))}’s turn`, round = roundOf(s, s.turn) + 1;
  const rolls = s.left === 3 ? "three rolls" : s.left === 0 ? "no rolls left" : `${s.left} ${s.left === 1 ? "roll" : "rolls"} left`;
  box.innerHTML = `Round <b>${round}</b> of ${ROUNDS} · ${who} · ${rolls}`;
}

// ---------- the dice: flat, or on the felt (yacht-3d.js, loaded when asked for) ----------
const view = tableView("yacht", ["flat", "Flat"]);
let three = null, making3d = false, lost3d = false;
async function make3d() {
  if (making3d) return;
  making3d = true;
  try {
    const { createYacht3d } = await import("./yacht-3d.js");
    if (view.get() === "3d" && !three) {
      const host = document.createElement("div");
      host.className = "ya-3d";
      host.id = "clothHost";
      $("stage").replaceChildren(host);
      three = createYacht3d(host, { onTap: tapDie, onLost: () => { lost3d = true; toast("3D stopped working here: the flat dice."); drawStageNow(); } });
    }
  } catch (err) {
    console.warn("Yacht: no 3D here, so the dice are drawn flat.", err);
    lost3d = true;
    toast("No 3D on this device: the flat dice.");
  }
  making3d = false;
  drawStageNow();
}
const drawStageNow = () => { if (V) drawStage(V, false); };

/** The dice as both drawings are given them. */
function diceOf(v) {
  const s = v.state, mine = myTurn(v), canHold = mine && s.left > 0 && s.left < 3;
  return { dice: s.dice, held: s.held, blank: s.left === 3 || s.step === "over", canHold, rolls: s.left };
}

function drawStage(v, rolled) {
  const want3d = view.get() === "3d" && !lost3d;
  if (!want3d && three) { three.dispose(); three = null; $("stage").replaceChildren(); }
  if (want3d && !three) { make3d(); if (!three) return; }
  if (!v?.G) { if (!three) $("stage").replaceChildren(); return; }
  const d = diceOf(v), s = v.state;
  if (three) { three.set({ ...d, key: `${v.G.seq}:${s.turn}:${roundOf(s, s.turn)}:${s.left}`, seed: v.G.seed }); return; }
  let box = $("stage").firstElementChild;
  if (!box?.classList.contains("ya-dice")) { box = document.createElement("div"); box.className = "ya-dice"; box.addEventListener("click", onDiceClick); $("stage").replaceChildren(box); }
  box.innerHTML = d.dice.map((f, i) => `<button type="button" class="ya-die-btn${d.held[i] ? " held" : ""}${d.blank ? " blank" : ""}${rolled && !d.held[i] ? " rolling" : ""}" data-i="${i}" ${d.canHold ? "" : "disabled"} aria-pressed="${!!d.held[i]}" aria-label="${f ? `Die showing ${f}${d.held[i] ? ", held" : ""}` : "Die, not rolled"}">${die(d.blank ? 0 : f)}</button>`).join("");
}
function onDiceClick(e) {
  const b = e.target.closest(".ya-die-btn");
  if (b && !b.disabled) tapDie(Number(b.dataset.i));
}
async function tapDie(i) {
  if (!myTurn(V) || V.state.left === 0 || V.state.left === 3) return;
  const held = [...V.state.held];
  held[i] = held[i] ? 0 : 1;
  const why = await page.move({ t: "hold", hold: held });
  if (why) toast(why);
}

// ---------- the score sheet ----------
function drawSheet(v) {
  const box = $("sheet");
  if (!v?.G) { box.replaceChildren(); return; }
  const s = v.state, seats = Array.from({ length: s.seats }, (_, i) => i);
  const live = myTurn(v) && s.left < 3, tot = s.sheets.map(totals), top = Math.max(...tot.map(t => t.total));
  const fresh = s.last && v.G.n !== freshN ? s.last : null;
  if (fresh) freshN = v.G.n;
  const cell = (seat, c) => {
    const val = s.sheets[seat][c], mine = isMe(seat);
    if (val >= 0) return `<td class="${mine ? "me " : ""}${fresh && fresh.seat === seat && fresh.c === c ? "fresh" : ""}">${val}</td>`;
    if (live && mine) {
      const pts = scoreOf(c, s.dice);
      return `<td class="me open pot${pts ? "" : " zero"}${ui.sel === c ? " sel" : ""}" data-c="${c}">${pts}</td>`;
    }
    return `<td class="${mine ? "me " : ""}open">·</td>`;
  };
  const head = `<thead><tr><th></th>${seats.map(i => `<th class="${s.step === "play" && s.turn === i ? "turn" : ""}" title="${esc(nameOf(i))}">${esc(nameOf(i))}</th>`).join("")}</tr></thead>`;
  const rows = CATS.map((cat, c) => {
    const pick = live && s.sheets[v.seat][c] < 0;
    return `<tr class="${pick ? "pickable" : ""}${c === 5 ? "" : ""}"><th scope="row" data-c="${pick ? c : ""}" class="${ui.sel === c ? "sel" : ""}" title="${esc(CAT_HELP[c])}">${cat.name}</th>${seats.map(i => cell(i, c)).join("")}</tr>`
      + (c === 5 ? `<tr class="sub rule"><th scope="row">Bonus<small>${BONUS_AT} = +${BONUS}</small></th>${seats.map(i => `<td class="${tot[i].bonus ? "got" : ""}">${tot[i].bonus ? `+${BONUS}` : `${tot[i].upper}/${BONUS_AT}`}</td>`).join("")}</tr>` : "");
  }).join("");
  const foot = `<tr class="total"><th scope="row">Total</th>${seats.map(i => `<td class="${s.seats > 1 && tot[i].total === top && tot[i].total > 0 ? "lead" : ""}">${tot[i].total}</td>`).join("")}</tr>`;
  box.innerHTML = `<table class="ya-grid" aria-label="Score sheet">${head}<tbody>${rows}${foot}</tbody></table>`;
}
$("sheet").addEventListener("click", async e => {
  const t = e.target.closest("[data-c]");
  if (!t || t.dataset.c === "" || !myTurn(V) || V.state.left === 3) return;
  const c = Number(t.dataset.c);
  if (V.state.sheets[V.seat][c] >= 0) return;
  if (opts.quick) { await scoreIn(c); return; }
  ui.sel = ui.sel === c ? null : c;
  drawSheet(V);
  drawControls(V);
});

// ---------- your move ----------
function drawControls(v) {
  const box = $("controls");
  if (!v?.G) { box.innerHTML = `<button class="btn primary wide" type="button" data-act="new">New game</button>`; return; }
  const s = v.state;
  if (v.seat == null) { box.innerHTML = `<p class="ya-watching">Watching: you sit down at the next game.</p>`; return; }
  if (s.step === "over") {
    box.innerHTML = `<button class="btn" type="button" data-act="result">The result</button><button class="btn primary" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  const mine = myTurn(v);
  if (!mine) {
    const who = v.seats[s.turn];
    box.innerHTML = `<p class="ya-watching">${who?.bot && !who.away ? `${esc(who.name)} is playing…` : `${esc(who?.name || "Someone")}’s turn`}</p>`;
    return;
  }
  const canRoll = s.left > 0 && !s.held.every(Boolean), sel = ui.sel;
  const rollWord = "Roll";
  const rollSub = s.left === 0 ? "none left" : s.left === 3 ? "three rolls" : s.held.every(Boolean) ? "let a die go" : `${s.left} left`;
  const pts = sel != null ? scoreOf(sel, s.dice) : null;
  const scoreSub = s.left === 3 ? "roll first" : sel != null ? CATS[sel].name : opts.quick ? "tap a row" : "pick a row";
  box.innerHTML = `<button class="btn${canRoll && (s.left === 3 || sel == null) ? " primary" : ""}" type="button" data-act="roll" ${canRoll ? "" : "disabled"}><b>${rollWord}</b><small>${rollSub}</small></button>
    <button class="btn${sel != null || s.left === 0 ? " primary" : ""}" type="button" data-act="score" ${sel != null ? "" : "disabled"}><b>${pts != null ? `Score ${pts}` : "Score"}</b><small>${esc(scoreSub)}</small></button>`;
}
async function scoreIn(c) {
  const why = await page.move({ t: "score", c });
  if (why) toast(why);
}
$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "result") { showEnd(V); return; }
  if (act === "roll") { const why = await page.move({ t: "roll" }); if (why) toast(why); return; }
  if (act === "score" && ui.sel != null) await scoreIn(ui.sel);
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, mine = totals(s.sheets[v.seat]).total;
  if (s.seats === 1) {
    const best = read(BEST, 0);
    if (mine > (typeof best === "number" ? best : 0)) write(BEST, mine);
    if (s.opts.daily) {                                          // counted the moment the last category is written, not when the result opens
      const days = read(DAILY, {});
      if (!(days[s.opts.daily] >= mine)) { days[s.opts.daily] = mine; write(DAILY, days); }
    }
  } else {
    const r = read(RECORD, { played: 0, won: 0 }), won = winners(s).includes(v.seat);
    r.played++;
    if (won) r.won++;
    write(RECORD, r);
  }
  setTimeout(() => { if (V?.over) showEnd(V); }, 700);
}
function showEnd(v) {
  const s = v.state, tot = s.sheets.map(totals), win = winners(s);
  const rows = Array.from({ length: s.seats }, (_, i) => i).sort((a, b) => tot[b].total - tot[a].total);
  const mine = v.seat != null && win.includes(v.seat);
  const best = read(BEST, 0);
  $("endHead").textContent = s.seats === 1 ? `${tot[0].total} points` : mine ? (win.length > 1 ? "You share the win" : "You win") : `${win.map(nameOf).join(" and ")} ${win.length > 1 ? "share it" : "wins"}`;
  const t = v.seat != null ? tot[v.seat] : tot[0];
  $("endBody").innerHTML = `<ol class="ya-standings">${rows.map(i => `<li class="${win.includes(i) && s.seats > 1 ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nameOf(i))}</span><b>${tot[i].total}</b></li>`).join("")}</ol>
    <p class="ya-end-note">${t.bonus ? `Upper bonus earned (+${BONUS}).` : `Upper section ${t.upper} of ${BONUS_AT}: no bonus.`}${s.seats === 1 && best ? ` Best ${best}.` : ""}${s.opts.daily ? " Today’s daily." : ""}</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
async function newGame() {
  $("endDlg").open && $("endDlg").close();
  await page.deal({}, opts.seats);
}
async function dailyGame({ ask = true } = {}) {
  if (page.atTable) { toast("The daily is played alone"); return; }
  const s = V?.state;
  if (ask && s && s.step === "play" && s.sheets.some(sh => sh.some(x => x >= 0)) && !(await sure("Leave the game you’re playing for today’s daily?"))) return;
  $("endDlg").open && $("endDlg").close();
  await page.deal({ daily: today() }, 1);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const row = (name, help, pts) => `<tr><td>${name}</td><td>${help}</td><td>${pts}</td></tr>`;
  $("rulesBody").innerHTML = `
    <p>Yacht is an old dice game, played with five dice and a score sheet. A game is ${ROUNDS} rounds. In each, you roll all five dice, then up to twice more, putting aside (holding) any you like and rolling the rest. When you stop, you write the dice in one category of your sheet, each category once. A category may be taken for 0 when nothing fits. The highest total wins.</p>
    <h3>The categories</h3>
    <table>
    ${CATS.map((c, i) => row(c.name, CAT_HELP[i], i < 6 ? "face × count" : i === 8 || i === 9 ? "30" : i === 11 ? "50" : "sum")).join("")}
    </table>
    <p><b>Upper bonus.</b> Ones to Sixes together scoring ${BONUS_AT} or more (three of each face is exactly ${BONUS_AT}) earn ${BONUS} extra.</p>
    <p><b>Alone</b>, you play for a best score; Menu, Today’s daily, deals every player the same dice that day. <b>With others</b> (Menu, Players, or Invite players), you take turns, and the dice you roll are your own.</p>
    <p>On a phone, tap a die after a roll to hold it, tap a score in the sheet to choose a category, then Score. In 3D, tap the dice on the table.</p>`;
  $("rulesDlg").showModal();
}

// Learn: the lessons on the course sheet; their last step starts a game, asking before it leaves one begun
async function playFromCourse() {
  if (page.atTable) { toast("Lessons end back at your table"); return; }
  const s = V?.state;
  if (s && s.step === "play" && s.sheets.some(sh => sh.some(x => x >= 0)) && !(await sure("Leave the game you’re playing for a new one?"))) return;
  await newGame();
}
const course = createCourse({ id: "yacht", course: COURSE, stage: yachtStage(), cls: "ya", inFrame: IN_FRAME, onRules: showRules, onPlay: playFromCourse });

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const content = part(body, "content");
  if (!page.atTable) {
    const days = read(DAILY, {}), got = days[today()];
    content.append(action(got != null ? `Today’s daily: you made ${got}. Play it again` : "Today’s daily", () => dailyGame(), ""));
  }
  if (V && myTurn(V) && V.state.left < 3 && V.state.left >= 0) {
    content.append(action("Hint", () => { const h = advise(V.state, V.seat); toast(`${h.name} for ${h.pts} looks best`); }, "link"));
  }
  const cp = progressOf("yacht", COURSE);
  content.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Yacht, from the rules", () => course.open()));
  content.append(action("The rules", showRules, "link"));
  const set = part(body, "settings");
  set.append(view.choice(() => draw()));
  set.append(choice("Players", [[1, "Alone"], [2, "2"], [3, "3"], [4, "4"]], opts.seats, v => { opts.seats = Number(v); saveOpts(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(toggle("Score with one tap on a row", opts.quick, on => { opts.quick = on; saveOpts(); }));
  set.append(line("Players apply from the next game."));
  const r = read(RECORD, { played: 0, won: 0 }), best = read(BEST, 0);
  part(body, "about").append(line(`${best ? `Best alone: ${best}. ` : ""}${r.played ? `Won ${r.won} of ${r.played} games against others.` : "No game against others yet."}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "yacht");
document.querySelector(".ya-mark").innerHTML = APPS.find(a => a.id === "yacht")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.addEventListener("resize", () => { if (V) draw(); });
window.__yacht = { page, course, get view() { return V; }, opts, get three() { return three; }, openOf };
// the games screen's tile opens today's while it's still to play; the first time, a game is dealt at once: the table is the menu
const forToday = arrivedForToday();
if (!IN_FRAME && !page.atTable && !new URLSearchParams(location.search).get("table")) {
  if (forToday) dailyGame();
  else if (!page.view.G) newGame();
}
draw();
