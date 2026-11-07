// Backgammon: backgammon against the computer, or at a table with a friend each on their own phone. The rules are
// gammon-rules.js's (the board's gammon-board.js's), the computer gammon-bot.js's, the running seats.js's. This page
// draws the board as the one playing it sees it, their home board at the bottom right, and takes a play a move at a
// time: a tap on a checker moves it, or shows where it may go when it may go more than one way; Undo takes moves back
// until Done sends the play. The other side's play is shown a move at a time.
import { rules, MATCHES, mayDouble } from "./gammon-rules.js";
import { plays, apply, pips } from "./gammon-board.js";
import { LEVEL_NAMES, botTurn } from "./gammon-bot.js";
import { boardSvg } from "./gammon-draw.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { ramp } from "./ramp.js";
import { tableView } from "./table3d-view.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage } from "./gammon-course.js";
import { createRush } from "./gammon-rush-ui.js";
import { bestsLine } from "./rush-core.js";
import "./pwa.js";
import { load3d } from "./loading.js";

const $ = id => document.getElementById(id);
const OPTS = "gammon:opts", RECORD = "gammon:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const BOT = "Dimitri";

let opts = { match: 3, cube: true, level: "medium", ...read(OPTS, {}) };
if (!MATCHES.includes(opts.match)) opts.match = 3;
// Korbi, 4 November 2026: the menu is the minimum it needs to be. A match to 3 points with the doubling cube, whatever an
// older save chose (a match in hand keeps its own rules, in its state). The computer's strength is the hidden ramp, its
// first step the old saved choice (a lesson's match plays its own level, once).
const OLD_LEVEL = opts.level;
Object.assign(opts, { match: 3, cube: true });
let lesson = null, lessonNext = null;
const levelNow = () => lesson || ramp("gammon", LEVEL_NAMES.map(([k]) => k), { start: OLD_LEVEL });
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
// your play as you make it: the moves so far, the checker picked up; for the position and roll it was made on
let ui = { key: "", made: [], sel: null, hinted: false };
// the other side's play shown a move at a time: the position on the board, and the play it's showing
let shown = { key: "", me: null, op: null, frames: [], timer: 0 };
const nameOf = seat => V?.seats?.[seat]?.name ?? BOT;
const me = () => V?.seat ?? 0;
const isMe = seat => V?.seat != null && seat === V.seat;
const lastKey = s => (s?.last ? `${s.game}:${s.last.ply}` : "");
// (before the page: seatPage may hand over the first view at once, and follow() asks whose seat is yours)
let page = null;
const randomRounds = seatRounds("gammon", ["gameover"]);   // random mode's round: a game of the match
page = seatPage({
  rules, id: "gammon", app: 1, pace: 700, botName: () => BOT, level: () => levelNow(),
  onView: v => { V = v; follow(v); draw(); randomRounds(v); }, onOver, toast, newGame: newMatch,
});

/** A new play by the other side: shown a move at a time, from the position before it. */
function follow(v) {
  const s = v?.state;
  if (!s?.pos) return;
  const my = me(), key = lastKey(s), mine = s.pos[my], theirs = s.pos[1 - my];
  if (key === shown.key) return;
  const before = shown.me && shown.op ? [shown.me, shown.op] : null;
  shown.key = key;
  clearTimeout(shown.timer);
  shown.frames = [];
  if (before && s.last && s.last.seat !== my && s.last.moves.length) {
    // replay their moves on what was on the board; if it lands where the table is, show it move by move
    let [o, m] = [before[1], before[0]];
    const frames = [];
    for (const mv of s.last.moves) { [o, m] = apply(o, m, mv); frames.push([m, o]); }
    if (JSON.stringify(frames.at(-1)) === JSON.stringify([mine, theirs])) {
      shown.frames = frames;
      const step = () => {
        const f = shown.frames.shift();
        if (!f) return;
        [shown.me, shown.op] = f;
        drawBoard();
        if (shown.frames.length) shown.timer = setTimeout(step, 420);
        else draw();
      };
      shown.timer = setTimeout(step, 250);
      return;
    }
  }
  shown.me = mine;
  shown.op = theirs;
}
const animating = () => shown.frames.length > 0;

function draw() {
  if (!page) return;
  drawSeat($("them"), V, 1 - me());
  drawSeat($("mine"), V, me());
  drawBoard();
  drawControls();
}

function drawSeat(box, v, seat) {
  if (!v?.G) { box.replaceChildren(); return; }
  const s = v.state, pos = s.pos[seat], turn = rules.toMove(s) === seat || (s.step === "blocked" && s.turn === seat);
  const score = s.match > 1 ? `<span class="gm-score">${s.score[seat]}<small>/${s.match}</small></span>` : "";
  const cube = s.cubeOn && s.owner === seat ? `<span class="gm-own">cube ${s.cube}</span>` : "";
  box.className = `gm-seat ${box.id === "mine" ? "mine" : "them"}${turn ? " turn" : ""}`;
  box.innerHTML = `<i class="gm-swatch ${seat === me() ? "mine" : "theirs"}"></i><b class="gm-name">${esc(nameOf(seat))}</b>${cube}<span class="gm-pips">${pips(pos)} pips</span>${score}`;
}

/** The legal plays of the roll in hand, worked out once per turn. */
let legalCache = { key: "", list: [] };
function legalNow(s) {
  const key = `${s.game}:${s.ply}:${s.dice.join("")}`;
  if (legalCache.key !== key) legalCache = { key, list: plays(s.pos[s.turn], s.pos[1 - s.turn], s.dice) };
  return legalCache.list;
}
/** Where things stand in your play: the position after your moves so far, the moves that may come next, and how many make a play. */
function inPlay(s) {
  const key = `${V.G.seq}:${s.game}:${s.ply}`;
  if (ui.key !== key) ui = { key, made: [], sel: null, hinted: false };
  const legal = legalNow(s), my = s.pos[me()], op = s.pos[1 - me()];
  let m = my, o = op;
  for (const mv of ui.made) [m, o] = apply(m, o, mv);
  const prefix = ui.made.map(x => `${x[0]}>${x[1]}`).join(" ");
  const fits = legal.filter(p => p.moves.slice(0, ui.made.length).map(x => `${x[0]}>${x[1]}`).join(" ") === prefix);
  const next = fits.map(p => p.moves[ui.made.length]).filter(Boolean);
  return { me: m, op: o, next, need: legal[0].moves.length, done: ui.made.length === legal[0].moves.length };
}

const view = tableView("gammon", ["board", "Board"]);                // Menu, View: the flat board or the 3D one (gammon-3d.js, loaded when asked for)
// The 3D board is made once asked for and kept while it stays chosen; the flat one draws meanwhile and wherever the 3D one can't be
// made (no WebGL, or a lost context: that is for this visit only, the choice stays). Its camera is the device's own (a `suite:` key;
// a watching frame draws the flat board and never writes it).
const CAM = "suite:gammon-cam";
let board3d = null, making3d = false, lost3d = false;
const keptCam = () => { try { return localStorage.getItem(CAM); } catch { return null; } };
const keepCam = text => { if (IN_FRAME) return; try { if (text) localStorage.setItem(CAM, text); else localStorage.removeItem(CAM); } catch { /* private mode */ } };
async function make3d() {
  if (making3d) return;
  making3d = true;
  try {
    const { createBoard } = await load3d(import("./gammon-3d.js"));
    if (view.get() === "3d" && !board3d) board3d = createBoard($("board"), { view: keptCam(), onView: keepCam, onTap: tapPt, onLost: () => { lost3d = true; toast("3D stopped working here: the flat board."); drawBoard(); } });
  } catch (err) {
    console.warn("Backgammon: no 3D here, so the board is drawn flat.", err);
    lost3d = true;
    toast("No 3D on this device: the flat board.");
  }
  making3d = false;
  drawBoard();
}

/** What both drawings of the board are given. */
function boardView() {
  const v = V;
  if (!v?.G) return { me: Array(26).fill(0), op: Array(26).fill(0) };
  const s = v.state, my = me();
  let vw = { me: shown.me || s.pos[my], op: shown.op || s.pos[1 - my], dice: [], myDice: true, cube: s.cubeOn ? s.cube : null, owner: s.owner, seat: my };
  const myTurn = !animating() && s.step === "move" && s.turn === my && v.seat != null;
  if (animating() && s.last) vw = { ...vw, dice: s.last.dice, myDice: false, used: 0 };
  else if (s.step === "move" || s.step === "blocked") vw = { ...vw, dice: s.dice, myDice: s.turn === my };
  else if (s.last?.dice?.length && (s.step === "roll" || s.step === "take")) vw = { ...vw, dice: s.last.dice, myDice: s.last.seat === my, used: 4 };
  if (myTurn) {
    const p = inPlay(s);
    const targets = ui.sel != null ? [...new Set(p.next.filter(m => m[0] === ui.sel).map(m => m[1]))] : [];
    vw = { ...vw, me: p.me, op: p.op, used: ui.made.length, sel: ui.sel, targets, from: [...new Set(p.next.map(m => m[0]))].filter(i => i !== 25) };
  }
  if (!myTurn && s.last && s.last.seat !== my && !animating()) vw.from = s.last.moves.map(m => 25 - m[0]).filter(i => i >= 1 && i <= 24);
  return vw;
}
function drawBoard() {
  const want3d = view.get() === "3d" && !lost3d;
  if (!want3d && board3d) { board3d.dispose(); board3d = null; }
  if (want3d && !board3d) make3d();
  $("app").classList.toggle("gm3", !!board3d);
  if (board3d) board3d.set(boardView());
  else $("board").innerHTML = boardSvg(boardView());
}

/** A tap on a point (1..24), the bar (25) or the tray (0): the flat board's click and the 3D board's tap both come here. True when it did something. */
function tapPt(pt) {
  const s = V?.state;
  if (!s || animating() || s.step !== "move" || s.turn !== V.seat) return false;
  const p = inPlay(s);
  const go = mv => { ui.made.push([mv[0], mv[1]]); ui.sel = null; draw(); return true; };
  // a destination of the checker picked up
  if (ui.sel != null) {
    const mv = p.next.find(m => m[0] === ui.sel && m[1] === pt);
    if (mv) return go(mv);
  }
  // a checker of yours: moved at once if it can go only one way, else picked up to show where it may go
  const from = p.me[25] ? 25 : pt;
  const ways = [...new Map(p.next.filter(m => m[0] === from).map(m => [m[1], m])).values()];
  if (!ways.length || pt === 0) { ui.sel = null; drawBoard(); return false; }
  if (ways.length === 1) return go(ways[0]);
  ui.sel = ui.sel === from ? null : from;
  drawBoard();
  return true;
}
$("board").addEventListener("click", e => {
  const hit = e.target.closest("[data-pt]");
  if (hit) tapPt(Number(hit.dataset.pt));
});

// ---------- your turn ----------
function drawControls() {
  const box = $("controls"), v = V;
  if (!v?.G) { box.innerHTML = `<button class="btn primary gm-go" type="button" data-act="new">New match</button>`; return; }
  const s = v.state, my = v.seat;
  if (my == null) { box.innerHTML = `<p class="gm-status">Watching: you sit down at the next match.</p>`; return; }
  if (s.step === "over") {
    const won = s.winners.includes(my);
    box.innerHTML = `<p class="gm-status">${won ? "You win" : `${esc(nameOf(s.winners[0]))} wins`}${s.match > 1 ? `, ${s.score[s.winners[0]]} to ${s.score[1 - s.winners[0]]}` : ""}</p><button class="btn primary gm-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New match" : "The result"}</button>`;
    return;
  }
  if (s.step === "gameover") {
    const r = s.result;
    box.innerHTML = `<p class="gm-status big">${isMe(r.winner) ? "You win" : `${esc(nameOf(r.winner))} wins`} ${r.kind === 3 ? "a backgammon" : r.kind === 2 ? "a gammon" : r.kind === 0 ? "(cube dropped)" : "the game"}: ${r.points} ${r.points === 1 ? "point" : "points"}</p>`;
    return;
  }
  if (animating()) { box.innerHTML = `<p class="gm-status">${esc(nameOf(1 - my))} moves</p>`; return; }
  if (s.step === "roll" && s.turn === my) {
    box.innerHTML = `<p class="gm-status">Double, or roll?</p><div class="gm-row two"><button class="btn gm-btn" type="button" data-act="double">Double to ${s.cube * 2}</button><button class="btn primary gm-btn" type="button" data-act="roll">Roll</button></div>`;
    return;
  }
  if (s.step === "take" && s.turn !== my) {
    box.innerHTML = `<p class="gm-status">${esc(nameOf(s.turn))} doubles to ${s.cube * 2}. Take it and play on for ${s.cube * 2}, or drop and lose ${s.cube}?</p><div class="gm-row two"><button class="btn gm-btn" type="button" data-act="drop">Drop</button><button class="btn primary gm-btn" type="button" data-act="take">Take</button></div>`;
    return;
  }
  if (s.step === "move" && s.turn === my) {
    const p = inPlay(s);
    const status = p.done && ui.hinted ? "The computer's play: Done to make it" : p.done ? "Done? Or undo." : ui.sel != null ? "Tap where it goes" : p.need ? `Your move: ${s.dice[0] === s.dice[1] ? `double ${s.dice[0]}s` : `${s.dice[0]} and ${s.dice[1]}`}` : "No move";
    box.innerHTML = `<p class="gm-status">${status}</p><div class="gm-row three"><button class="btn gm-btn" type="button" data-act="undo" ${ui.made.length ? "" : "disabled"}>Undo</button><button class="btn gm-btn" type="button" data-act="hint">Hint</button><button class="btn primary gm-btn" type="button" data-act="done" ${p.done ? "" : "disabled"}>Done</button></div>`;
    return;
  }
  const who = s.step === "take" ? `${nameOf(s.turn)} doubled: you decide` : s.step === "blocked" ? `${isMe(s.turn) ? "You" : nameOf(s.turn)} can't move` : `${esc(nameOf(s.turn))} ${s.step === "roll" ? "is deciding" : "is thinking"}…`;
  box.innerHTML = `<p class="gm-status">${esc(who)}</p>`;
}

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act, s = V.state;
  if (act === "new") { newMatch(); return; }
  if (act === "result") { showEnd(V); return; }
  if (act === "undo") { ui.made.pop(); ui.sel = null; ui.hinted = false; draw(); return; }
  if (act === "hint") {
    // the Hard computer's play, from the start of the turn
    const moves = botTurn(s.pos[V.seat], s.pos[1 - V.seat], s.dice, { level: "hard" });
    ui.made = moves.map(m => [m[0], m[1]]);
    ui.sel = null;
    ui.hinted = true;
    draw();
    return;
  }
  const move = act === "done" ? { t: "play", moves: ui.made } : { t: act };
  const why = await page.move(move);
  if (why) toast(why);
});

// ---------- the end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("gammon", won);
  if (!page.atTable && !lesson) { levelNow(); won ? ramp.won(true) : ramp.lost(); }
  setTimeout(() => { if (V?.over) showEnd(V); }, 1200);
}
function showEnd(v) {
  const s = v.state, mine = s.winners.includes(v.seat ?? -1), w = s.winners[0];
  $("endHead").textContent = mine ? (s.match > 1 ? "You win the match" : "You win") : `${nameOf(w)} wins${s.match > 1 ? " the match" : ""}`;
  const r = s.result;
  $("endBody").innerHTML = `<ol class="gm-standings">${[w, 1 - w].map(i => `<li class="${i === w ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nameOf(i))}</span><b>${s.score[i]}</b></li>`).join("")}</ol>
    <p class="gm-end-note">${s.match > 1 ? `A match to ${s.match}, ${s.game} ${s.game === 1 ? "game" : "games"}. ` : ""}The last: ${r.kind === 3 ? "a backgammon" : r.kind === 2 ? "a gammon" : r.kind === 0 ? "a cube dropped" : "a single game"}${s.cubeOn ? `, the cube on ${s.cube}` : ""}.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newMatch() {
  $("endDlg").open && $("endDlg").close();
  ui = { key: "", made: [], sel: null, hinted: false };
  shown = { key: "", me: null, op: null, frames: [], timer: 0 };
  lesson = lessonNext; lessonNext = null;
  page.deal({ match: opts.match, cube: opts.cube }, 2);
}
$("endAgain").addEventListener("click", newMatch);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Backgammon for two. Each has fifteen checkers that race round the board to their home board (yours at the bottom right) and off it. You move from your 24 point (top right) along the top, down the left and along the bottom to your 1 point, then off.</p>
    <h3>A turn</h3>
    <p>Roll two dice and move a checker the number on each, one after the other (one checker may take both). A double is played four times. A checker may land on an empty point, on your own, or on a point where the other side has a single checker (a blot), which is hit and goes onto the bar; never on a point with two or more of theirs. You must use both dice if you can; if only one can be used, the larger one where it can.</p>
    <p>With a checker on the bar, you must enter it first, into the other side's home board (top right) on the point of a die. Once all fifteen are in your home board, you bear them off: a die takes one off its point, or from the highest point you hold if the die is bigger.</p>
    <h3>Winning</h3>
    <p>Bear off all fifteen first. A gammon (two points): the other side has borne none off. A backgammon (three): and still has one on the bar or in your home board. A match goes to 3 points.</p>
    <h3>The cube</h3>
    <p>Before you roll you may double: the other side takes and plays on for twice the points, the cube now theirs to double back, or drops and gives you the game at what it was. The game after someone first comes within a point of the match (the Crawford game) is played without the cube.</p>
    <h3>Here</h3>
    <p class="gm-rules-note">Tap a checker: it moves if it can go only one way, otherwise the points it may go to are ringed. Undo takes moves back; Done plays them. Hint shows the computer's play on Hard. The computer plays harder as you win and easier as you lose.</p>`;
  $("rulesDlg").showModal();
}

// ---------- the course ----------
// Learn (the header): backgammon taught from nothing (gammon-course.js) on the course's sheet (course.js), the board
// drawn as the table draws it, its points numbered, and every play the board's own; its last lesson starts a match
// against Easy. The Rules sheet opens from the course's map and the menu.
const course = createCourse({
  id: "gammon", course: COURSE, cls: "gm", inFrame: IN_FRAME, onRules: showRules, stage: boardStage(),
  onPlay: step => {
    const level = step?.level || "easy", name = LEVEL_NAMES.find(([k]) => k === level)?.[1] || level;
    if (page.atTable) { toast(`Your table plays on: try a match against ${name} when you're back to solo`); return; }
    lessonNext = level;
    newMatch();
  },
});

// Puzzle rush (the menu): the best play in positions from the computer players' own games, by GNU Backgammon's
// equities, against the clock, with every game's rush settings, on a sheet of its own (gammon-rush-ui.js); the match
// waits under it.
const rush = createRush({ inFrame: IN_FRAME });

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New match", newMatch, "primary"));
  page.menu(play);
  const cp = progressOf("gammon", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn backgammon, from the rules", () => course.open()));
  if (!IN_FRAME) play.append(action("Puzzle rush", () => rush.open()));
  const set = part(body, "settings");
  set.append(view.choice(() => drawBoard()));
  if (board3d) set.append(action("Reset the 3D view", () => board3d?.resetView()));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("gammon:streak", { now: 0, best: 0 });
  const rushBests = bestsLine(rush.bests());
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} matches${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No matches finished yet."), ...(rushBests ? [line(rushBests)] : []));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "gammon");
document.querySelector(".gm-mark").innerHTML = APPS.find(a => a.id === "gammon")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__gammon = { page, get view() { return V; }, opts, mayDouble, course, rush, get board3d() { return board3d; }, get ui() { return ui; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newMatch();
draw();
