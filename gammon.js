// Gammon: backgammon against the computer, or at a table with a friend each on their own phone. The rules are
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
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage } from "./gammon-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "gammon:opts", RECORD = "gammon:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const BOT = "Dimitri";

let opts = { match: 3, cube: true, level: "medium", voice: true, ...read(OPTS, {}) };
if (!MATCHES.includes(opts.match)) opts.match = 3;
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
let page = null;
page = seatPage({
  rules, id: "gammon", app: 1, pace: 700, botName: () => BOT, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; follow(v); draw(); }, onOver, toast, newGame: newMatch,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? BOT;
const me = () => V?.seat ?? 0;
const isMe = seat => V?.seat != null && seat === V.seat;
const lastKey = s => (s?.last ? `${s.game}:${s.last.ply}` : "");

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

function drawBoard() {
  const box = $("board"), v = V;
  if (!v?.G) { box.innerHTML = boardSvg({ me: Array(26).fill(0), op: Array(26).fill(0) }); return; }
  const s = v.state, my = me();
  let view = { me: shown.me || s.pos[my], op: shown.op || s.pos[1 - my], dice: [], myDice: true, cube: s.cubeOn ? s.cube : null, owner: s.owner, seat: my };
  const myTurn = !animating() && s.step === "move" && s.turn === my && v.seat != null;
  if (animating() && s.last) view = { ...view, dice: s.last.dice, myDice: false, used: 0 };
  else if (s.step === "move" || s.step === "blocked") view = { ...view, dice: s.dice, myDice: s.turn === my };
  else if (s.last?.dice?.length && (s.step === "roll" || s.step === "take")) view = { ...view, dice: s.last.dice, myDice: s.last.seat === my, used: 4 };
  if (myTurn) {
    const p = inPlay(s);
    const targets = ui.sel != null ? [...new Set(p.next.filter(m => m[0] === ui.sel).map(m => m[1]))] : [];
    view = { ...view, me: p.me, op: p.op, used: ui.made.length, sel: ui.sel, targets, from: [...new Set(p.next.map(m => m[0]))].filter(i => i !== 25) };
  }
  if (!myTurn && s.last && s.last.seat !== my && !animating()) view.from = s.last.moves.map(m => 25 - m[0]).filter(i => i >= 1 && i <= 24);
  box.innerHTML = boardSvg(view);
}

$("board").addEventListener("click", e => {
  const hit = e.target.closest("[data-pt]");
  const s = V?.state;
  if (!hit || !s || animating() || s.step !== "move" || s.turn !== V.seat) return;
  const pt = Number(hit.dataset.pt), p = inPlay(s);
  const go = mv => { ui.made.push([mv[0], mv[1]]); ui.sel = null; draw(); };
  // a destination of the checker picked up
  if (ui.sel != null) {
    const mv = p.next.find(m => m[0] === ui.sel && m[1] === pt);
    if (mv) { go(mv); return; }
  }
  // a checker of yours: moved at once if it can go only one way, else picked up to show where it may go
  const from = p.me[25] ? 25 : pt;
  const ways = [...new Map(p.next.filter(m => m[0] === from).map(m => [m[1], m])).values()];
  if (!ways.length || (pt === 0)) { ui.sel = null; drawBoard(); return; }
  if (ways.length === 1) { go(ways[0]); return; }
  ui.sel = ui.sel === from ? null : from;
  drawBoard();
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
    <p>Bear off all fifteen first. A gammon (two points): the other side has borne none off. A backgammon (three): and still has one on the bar or in your home board. A match goes to 1, 3, 5 or 7 points.</p>
    <h3>The cube</h3>
    <p>Before you roll you may double: the other side takes and plays on for twice the points, the cube now theirs to double back, or drops and gives you the game at what it was. The game after someone first comes within a point of the match (the Crawford game) is played without the cube.</p>
    <h3>Here</h3>
    <p class="gm-rules-note">Tap a checker: it moves if it can go only one way, otherwise the points it may go to are ringed. Undo takes moves back; Done plays them. Hint shows the computer's play on Hard. The computer: Easy wobbles, Medium plays what it judges best, Hard looks a roll ahead.</p>`;
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
    opts.level = level;
    saveOpts();
    newMatch();
  },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New match", newMatch, "primary"));
  page.menu(play);
  const cp = progressOf("gammon", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Gammon, from the rules", () => course.open()), action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  set.append(choice("A match to", MATCHES.map(n => [n, n === 1 ? "1 game" : `${n} points`]), opts.match, v => { opts.match = Number(v); saveOpts(); }));
  set.append(toggle("The doubling cube", opts.cube, on => { opts.cube = on; saveOpts(); }));
  set.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line("The match and the cube apply from the next match."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("gammon:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} matches${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No matches finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "gammon");
document.querySelector(".gm-mark").innerHTML = APPS.find(a => a.id === "gammon")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__gammon = { page, get view() { return V; }, opts, mayDouble, course };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newMatch();
draw();
