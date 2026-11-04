// Four in a row against the computer, with a friend on the same phone, or at a table with a friend each on their
// own phone. The rules are silo-rules.js's (the board's silo-board.js's), the computer silo-bot.js's, the running
// seats.js's. This page draws the board as bitmaps of nothing (an SVG, silo-draw.js), takes a tap on a column as a
// move, lets a disc fall, and shows the four that won. Hard thinks in a worker (silo-think.js) while the page stays
// awake; the coach (a setting) reads the position the same way and points at the best column when asked.
import { rules, STARTS, LEVEL_NAMES } from "./silo-rules.js";
import { replay, H, W } from "./silo-board.js";
import { boardSvg, discGlyph } from "./silo-draw.js";
import { seatPage } from "./seats-ui.js";
import { applyMove } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { tableView } from "./table3d-view.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage } from "./silo-course.js";
import { createThinker } from "./silo-think.js";
import { advise, advised } from "./silo-bot.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "silo:opts", RECORD = "silo:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let opts = { level: "medium", start: "alternate", opponent: "computer", coach: false, voice: true, ...read(OPTS, {}) };
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "medium";
if (!STARTS.some(([k]) => k === opts.start)) opts.start = "alternate";
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
let V = null;
let page = null;
const hotseat = () => !!page && !page.atTable && opts.opponent === "friend";
const nameOf = seat => V?.seats?.[seat]?.name ?? (seat === 0 ? "You" : hotseat() ? "Friend" : "Computer");
const botName = () => (opts.opponent === "friend" ? "Friend" : "Computer");

// The play (Hard's worker) and the coach (the coach's) each think in a worker of their own, so neither holds up the other.
const player = createThinker(), coachThinker = createThinker();
let thinking = null;                  // the moves Hard is working out the answer to
let analysis = null;                  // { moves, res }: the coach's reading of the position
let asked = "";                       // the position the coach was last asked about
let hint = { moves: "", col: -1, want: "" };

// A disc's fall, from where the board last stood: { key (game and discs), start, rows, c, r, ms }; paused with the menu
const FALL_MS = rows => rows * 48 + 150;
let fall = null, drawnKey = "", pausedAt = null;
const gameKey = v => `${v.G.seq}:${v.G.started}`;

const randomRounds = seatRounds("silo");   // random mode's round: a game
page = seatPage({
  rules, id: "silo", app: 1, botName, level: () => opts.level, voice: () => opts.voice,
  pace: s => (advised(s.moves) != null || opts.level !== "hard" ? 650 : 3400),
  hold: () => (hotseat() ? V?.toMove === 1 : thinking !== null),
  onView: v => { V = v; follow(v); draw(); randomRounds(v); think(v); ask(v); },
  onOver, toast, newGame: () => newGame(true),
});

/** A new disc on the board: let it fall. */
function follow(v) {
  if (!v.G) { fall = null; drawnKey = ""; return; }
  const key = gameKey(v), n = v.state.moves.length;
  const was = drawnKey.startsWith(`${key}:`) ? Number(drawnKey.slice(key.length + 1)) : -1;
  drawnKey = `${key}:${n}`;
  if (n === was + 1 && n > 0 && !IN_FRAME && !isPaused()) {
    const [c, r] = replay(v.state.moves).last;
    fall = { key: drawnKey, start: performance.now(), rows: H - r, c, r };
  } else if (n !== was) fall = null;
}
const fallNow = () => {
  if (!fall || fall.key !== drawnKey) return null;
  const ms = (pausedAt ?? performance.now()) - fall.start;
  return ms < FALL_MS(fall.rows) ? { c: fall.c, r: fall.r, rows: fall.rows, ms: Math.max(0, Math.round(ms)) } : null;
};
onPause(() => { pausedAt = performance.now(); $("board").classList.add("still"); },
  () => { if (fall && pausedAt != null) fall.start += performance.now() - pausedAt; pausedAt = null; $("board").classList.remove("still"); });

// ---------- Hard thinks in the worker ----------
/** The computer's turn at Hard: ask the worker for the move, and let the runner have it when it comes. */
function think(v) {
  if (!page || !v.G || v.over || !page.host || hotseat()) { thinking = null; return; }
  const who = v.toMove, moves = v.state.moves;
  const mine = v.seats[who]?.bot;
  if (opts.level !== "hard" || !mine || advised(moves) != null) { thinking = null; return; }
  if (thinking === moves) return;
  thinking = moves;
  player.ask(moves).then(res => {
    if (res && res.col != null) advise(moves, res.col);
    if (thinking === moves) { thinking = null; page.runner.kick(); draw(); }
  });
}

// ---------- the coach ----------
/** The coach reads the position (when it is on, or a hint is wanted), and says what it finds. */
function ask(v) {
  if (!page || !v.G || v.over || IN_FRAME) return;
  const moves = v.state.moves;
  if (hint.moves !== moves) hint = { moves: "", col: -1, want: hint.want === moves ? moves : "" };
  if ((!opts.coach && hint.want !== moves) || asked === moves) return;
  asked = moves;
  coachThinker.ask(moves).then(res => {
    if (res) analysis = { moves, res };
    if (V?.state?.moves === moves) {
      if (hint.want === moves && res) hint = { moves, col: res.col, want: "" };
      draw();
    }
  });
}
function coachLine() {
  if (!opts.coach || !V?.G || V.over) return "";
  if (!analysis || analysis.moves !== V.state.moves) return "The coach is reading the position…";
  const { res } = analysis, s = V.state, n = s.moves.length, mover = V.toMove, viewer = V.seat ?? mover;
  const sign = mover === viewer ? 1 : -1;
  const who = seat => (seat === viewer ? "you" : nameOf(seat));
  if (res.exact) {
    if (res.value === 0) return "Solved: a draw with the best play.";
    const winner = res.value > 0 ? mover : 1 - mover, discs = 22 - Math.abs(res.value);
    const left = discs - (res.value > 0 ? Math.floor(n / 2) : Math.ceil(n / 2));
    return `Solved: ${who(winner)} ${winner === viewer ? "win" : "wins"} by force, in at most ${left} more ${left === 1 ? "move" : "moves"}.`;
  }
  const v = res.value * sign;
  if (Math.abs(res.value) > 9000) return `Looked ${res.depth} moves ahead: ${v > 0 ? "you have" : `${nameOf(1 - viewer)} has`} a forced win.`;
  const lean = Math.abs(v) < 80 ? "about even" : `${v > 0 ? "you" : nameOf(1 - viewer)} ${Math.abs(v) < 250 ? "a little ahead" : "ahead"}`;
  return `Looked ${res.depth} moves ahead: ${lean}. Not solved yet.`;
}

// ---------- drawing ----------
function draw() {
  if (!page) return;
  drawSeats();
  drawBoard();
  drawStatus();
  const c = $("coach"), words = coachLine();
  c.hidden = !opts.coach;
  c.textContent = words;
  drawControls();
}

function drawSeats() {
  const v = V;
  if (!v?.G) { $("them").replaceChildren(); $("mine").replaceChildren(); return; }
  const mine = v.seat ?? 0, theirs = 1 - mine, s = v.state;
  for (const [box, seat] of [[$("them"), theirs], [$("mine"), mine]]) {
    const turn = !v.over && v.toMove === seat;
    box.className = `si-seat ${seat === mine ? "mine" : "them"}${turn ? " turn" : ""}`;
    const note = turn && s.moves.length === 0 ? "starts" : turn && v.seats[seat]?.bot && !hotseat() ? `<span class="si-dots">thinking</span>` : "";
    const wins = s.score[seat];
    box.innerHTML = `${discGlyph(seat)}<b class="si-name">${esc(nameOf(seat))}</b>${note ? `<span class="si-note">${note}</span>` : ""}<span class="si-wins">${wins}<small> won</small></span>`;
  }
}

const view = tableView("silo", ["board", "Board"]);                   // Menu, View: the flat board (the default) or the frame leaning back on its feet (silo-3d.css)
const applyView = () => $("app").classList.toggle("si3", view.get() === "3d");

function drawBoard() {
  applyView();
  const box = $("board"), v = V;
  if (!v?.G) { box.innerHTML = boardSvg({ enabled: false }); return; }
  const s = v.state, myTurn = !v.over && v.toMove != null && !fallNow() && (hotseat() ? true : v.seat === v.toMove);
  box.innerHTML = boardSvg({
    moves: s.moves, first: s.first, line: v.over && s.winner >= 0 ? s.line : [], fall: fallNow(),
    hint: hint.moves === s.moves ? hint.col : -1, enabled: myTurn,
  });
  // the board is redrawn when the fall ends, so the drop does not stand marked as falling
  const f = fallNow();
  if (f) { clearTimeout(drawBoard.t); drawBoard.t = setTimeout(draw, FALL_MS(f.rows) - f.ms + 30); }
}

function drawStatus() {
  const v = V, el = $("status");
  if (!v?.G) { el.textContent = ""; return; }
  const say = html => { el.innerHTML = `<span>${html}</span>`; };
  const s = v.state, me = v.seat;
  if (v.over) {
    say(s.winner === -1 ? "A draw: the board is full."
      : hotseat() || me == null || s.winner !== me ? `<b>${esc(nameOf(s.winner))}</b> makes four in a row.` : "<b>You</b> make four in a row.");
    return;
  }
  if (me == null) { el.textContent = `${nameOf(v.toMove)} to move`; return; }
  if (hotseat()) { say(`<b>${esc(nameOf(v.toMove))}</b>: your move`); return; }
  say(v.toMove === me ? `<b>Your move</b>: tap a column` : v.seats[v.toMove]?.bot ? `${esc(nameOf(v.toMove))} is thinking<span class="si-dots"></span>` : `${esc(nameOf(v.toMove))} to move`);
}

function drawControls() {
  const box = $("controls"), v = V;
  if (!v?.G) { box.innerHTML = `<button class="btn primary si-go" type="button" data-act="new">New game</button>`; return; }
  const play = !v.over && (hotseat() || v.seat === v.toMove);
  const buttons = [];
  if (opts.coach && !v.over) buttons.push(`<button class="btn si-go" type="button" data-act="hint" ${play ? "" : "disabled"}>Hint</button>`);
  buttons.push(`<button class="btn si-go${v.over ? " primary" : ""}" type="button" data-act="new" ${page.host ? "" : "disabled"}>${v.over ? "Play again" : "New game"}</button>`);
  box.innerHTML = buttons.join("");
}

// ---------- moves ----------
async function tap(c) {
  const v = V;
  if (!v?.G || v.over || fallNow()) return;
  const who = v.toMove;
  let why = "";
  if (hotseat() && who === 1) {
    // a friend on this phone: their move is made from here, as their seat
    const t = page.runner.table;
    const ok = await t.act(cur => {
      if (!cur.game) return false;
      const r = applyMove(rules, cur.game, 1, { c }, t.now());
      if (r.error) { why = r.error; return false; }
      cur.game = r.G;
    });
    if (!ok && !why) why = "Couldn't make that move: try again";
  } else if (v.seat === who) why = await page.move({ c });
  else return;
  if (why) toast(why);
}
$("board").addEventListener("click", e => {
  const hit = e.target.closest("[data-col]");
  if (hit) tap(Number(hit.dataset.col));
});
$("board").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.col != null) { e.preventDefault(); tap(Number(e.target.dataset.col)); }
});

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  if (b.dataset.act === "new") { await newGame(false); return; }
  if (b.dataset.act === "hint") {
    hint.want = V.state.moves;
    if (analysis?.moves === V.state.moves) { hint = { moves: analysis.moves, col: analysis.res.col, want: "" }; draw(); return; }
    asked = "";
    ask(V);
    toast("The coach is reading the position…", 1500);
  }
});

/** A new game: asks first if one is in play (the tally is kept); `fresh` starts the tally over. */
async function newGame(fresh) {
  const v = V;
  if (v?.G && !v.over && v.state.moves.length > 1 && !IN_FRAME && !(await sure("Leave this game and start a new one?", { yes: "New game" }))) return;
  thinking = null; hint = { moves: "", col: -1, want: "" }; analysis = null; asked = "";
  page.deal({ start: opts.start, fresh: !!fresh }, 2);
}

// ---------- the end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, r = read(RECORD, { played: 0, won: 0, drawn: 0 });
  r.played++;
  if (s.winner === -1) r.drawn++;
  else if (s.winner === v.seat && !hotseat()) r.won++;
  write(RECORD, r);
  if (!hotseat() && s.winner !== -1) noteStreak("silo", s.winner === v.seat);
}

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Four in a row for two. Seven columns, six high. Players take turns to drop a disc into a column; it falls to rest on the bottom or on the disc below.</p>
    <h3>Winning</h3>
    <p>The first to line up four of their discs, across, up and down, or along a diagonal, wins. A line of five or more counts. If the board fills with no four, it is a draw.</p>
    <h3>The discs</h3>
    <p>Ochre with a ring, and blue with a diamond. The pattern is there so the two never depend on colour alone.</p>
    <h3>Here</h3>
    <p>Tap a column to drop a disc in it. The computer at Easy often misses a win or a block; at Medium it rarely misses one coming next move, and sometimes misses a trap three or four moves off; at Hard it misses nothing, and from about a dozen discs on it plays the perfect move. With the coach on, a Hint points at the best column and a line says who is winning.</p>`;
  $("rulesDlg").showModal();
}

// Learn (the header): the game taught from nothing (silo-course.js) on the course's sheet (course.js), with the same
// board; its lessons end in games against Easy and Hard. The Rules sheet opens from the course's map and the menu.
const course = createCourse({
  id: "silo", course: COURSE, cls: "si", inFrame: IN_FRAME, onRules: showRules, stage: boardStage(),
  onPlay: step => {
    const level = step?.level || "easy", name = LEVEL_NAMES.find(([k]) => k === level)?.[1] || level;
    if (page.atTable) { toast(`Your table plays on: try a game against ${name} when you're back to solo`); return; }
    opts.level = level;
    opts.opponent = "computer";
    saveOpts();
    newGame(true);
  },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", () => newGame(false), "primary"));
  page.menu(play);
  const cp = progressOf("silo", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn four in a row, from the rules", () => course.open()));
  play.append(action("The rules on one page", showRules, "link"));
  if (!page.atTable && page.host) {
    const content = part(body, "content");
    content.append(choice("Opponent", [["computer", "Computer"], ["friend", "Two on this phone"]], opts.opponent, v => { opts.opponent = v; saveOpts(); thinking = null; page.runner.kick(); draw(); }));
    if (opts.opponent === "computer") content.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); thinking = null; draw(); }));
  }
  const set = part(body, "settings");
  set.append(view.choice(() => drawBoard()));
  set.append(choice("Who starts", STARTS, opts.start, v => { opts.start = v; saveOpts(); }));
  set.append(toggle("Coach: hints, and who is winning", opts.coach, on => { opts.coach = on; saveOpts(); asked = ""; if (V) ask(V); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  if (page.host) set.append(action("Start a new tally", () => newGame(true), "link"));
  const r = read(RECORD, { played: 0, won: 0, drawn: 0 }), st = read("silo:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${r.drawn ? `, ${r.drawn} drawn` : ""}${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "silo");
document.querySelector(".si-mark").innerHTML = APPS.find(a => a.id === "silo")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__silo = { page, get view() { return V; }, opts, course, tap, get analysis() { return analysis; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame(true);
if (V) { think(V); ask(V); }     // a view that came before the page was ready
draw();
