// Reversi for two, against the computer, two on one phone, a partner's match or a table of friends. The rules are
// flank-board.js's (the squares as bitboards) and flank-rules.js's (the game on seats.js), the computer flank-bot.js's
// on flank-engine.js's search, which runs in a worker (flank-think.js) while the board stays alive. This page draws the
// board (flank-board-ui.js), the discs turning as the only movement, marks the squares you may play quietly, and takes
// a tap as a move. The coach (Menu, Coach) gives the best move on request and who is ahead, exactly once the end of
// the game is in sight; Undo replays the game a move shorter.
import { rules, prime, primed, colourOf, seatOf } from "./flank-rules.js";
import { position, movesOf, tally, replay, sqName } from "./flank-board.js";
import { LEVEL_NAMES, levelOf } from "./flank-bot.js";
import { createThinker, COACH, verdict, share } from "./flank-think.js";
import { createBoard } from "./flank-board-ui.js";
import { seatPage } from "./seats-ui.js";
import { applyMove } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { tableView } from "./table3d-view.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sure } from "./sure.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage } from "./flank-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "flank:opts", RECORD = "flank:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const COLOURS = { d: "Dark", l: "Light" };

// opts: the next game's choices (mode "computer" or "two", colour you play, the computer's level) and how it looks and
// helps (coach "off", "hints" or "always"; legal-move marks)
let opts = { mode: "computer", level: "medium", colour: "dark", coach: "hints", marks: true, ...read(OPTS, {}) };
if (!["computer", "two"].includes(opts.mode)) opts.mode = "computer";
if (!["off", "hints", "always"].includes(opts.coach)) opts.coach = "hints";
if (!["dark", "light", "either"].includes(opts.colour)) opts.colour = "dark";
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the game ----------
let V = null;                                   // the runner's latest view
let page = null;                                // (declared before seatPage, which hands over the saved game at once)
let holding = false;                            // the computer's move is being worked out: the runner waits
let drawnGame = "";
const mind = createThinker(), coachMind = createThinker();
const randomRounds = seatRounds("flank");       // random mode's round: a game

/** Two on one phone: the second seat is a person on this phone, so the runner leaves it alone. */
const isTwo = v => !!v?.G && v.mode === "solo" && !!v.G.options?.two;
function syncTwo(v) {
  const t = page?.runner?.table;
  if (!t || !t.local) return;
  const players = t.data.players;
  if (isTwo(v)) players.p2 ||= { name: "Light", seat: 1, online: true };
  else delete players.p2;
}
/** Who this device moves for in a view: the seat to move when it is a person here, else null. */
function mover(v) {
  if (!v?.G || v.over || v.toMove == null) return null;
  if (isTwo(v)) return v.toMove;
  return v.seat != null && v.toMove === v.seat ? v.seat : null;
}
const keyOf = s => `${s.b}|${s.t}`;

// ---------- the board ----------
const board = createBoard($("board"), { onTap: sq => tap(sq) });
let hintAt = { key: "", sq: -1 };
const coachCache = new Map();                   // position → the coach's scores
let coachBusy = "";
let shown = 0;

const view = tableView("flank", ["board", "Board"]);                  // Menu, View: the flat board (the default) or the board tipped away from you (flank-3d.css)
const applyView = () => $("app").classList.toggle("fk3", view.get() === "3d");

function draw() {
  applyView();
  if (!page) return;
  const v = V, s = v?.G ? v.state : null;
  const id = v?.G ? `${v.G.seq}:${v.G.started}:${v.mode}` : "";
  const still = id !== drawnGame || !s;
  drawnGame = id;
  const who = mover(v), legal = who != null && opts.marks && s ? movesOf({ b: s.b, t: s.t, over: s.over }) : [];
  board.draw({
    b: s?.b, legal, last: s?.last?.sq ?? -1, flips: s?.last?.flips || [], still,
    hint: s && hintAt.key === keyOf(s) && who != null ? hintAt.sq : -1, tap: who != null,
  });
  $("app").classList.toggle("nomarks", !opts.marks);
  drawSeats(v);
  drawStatus(v);
  drawAhead(v);
  drawControls(v);
}

function nameOf(v, seat) {
  const s = v.state;
  if (isTwo(v)) return COLOURS[colourOf(s, seat)];
  if (v.mode === "solo") return seat === 0 ? "You" : "Computer";
  if (v.seat === seat) return "You";
  const w = v.seats?.[seat];
  return w?.name ? `${w.name}${w.bot ? " (computer)" : ""}` : "Opponent";
}
function drawSeats(v) {
  const far = $("far"), near = $("near");
  if (!v?.G) { far.replaceChildren(); near.replaceChildren(); return; }
  const s = v.state, me = isTwo(v) ? 0 : v.seat ?? 0, n = tally(s.b);
  for (const [box, seat] of [[far, 1 - me], [near, me]]) {
    const c = colourOf(s, seat), turn = !v.over && v.toMove === seat;
    const sub = isTwo(v) ? "" : v.mode === "solo" && seat === 1 ? `${levelOf(opts.level).name} · ${COLOURS[c]}` : COLOURS[c];   // two on one phone: the name is the colour already
    box.className = `fk-seat ${box.id}${turn ? " turn" : ""}`;
    box.innerHTML = `<i class="fk-swatch ${c}"></i><b class="fk-name">${esc(nameOf(v, seat))}</b><small>${esc(sub)}</small><span class="fk-count" aria-label="${n[c]} discs">${n[c]}</span>`;
  }
}

function resultText(v) {
  const s = v.state, r = s.result;
  if (!r.winner) return `Drawn, ${r.d} each`;
  const win = seatOf(s, r.winner), hi = Math.max(r.d, r.l), lo = Math.min(r.d, r.l);
  if (isTwo(v)) return `${COLOURS[r.winner]} wins, ${hi} to ${lo}`;
  if (v.seat != null && win === v.seat) return `You win, ${hi} to ${lo}`;
  return `${nameOf(v, win)} wins, ${hi} to ${lo}`;
}
function drawStatus(v) {
  const el = $("status");
  el.classList.remove("big");
  if (!v?.G) { el.textContent = ""; return; }
  const s = v.state;
  if (v.over) { el.textContent = resultText(v); el.classList.add("big"); return; }
  const passed = s.last?.passed ? `${isTwo(v) ? COLOURS[s.last.passed] : nameOf(v, seatOf(s, s.last.passed))} passed. ` : "";
  const who = v.toMove;
  let text;
  if (isTwo(v)) text = `${COLOURS[s.t]} to move`;
  else if (v.seat != null && who === v.seat) text = "Your move";
  else if (v.seats?.[who]?.bot && !v.seats[who].away) text = `${nameOf(v, who)} is thinking…`;
  else text = `${nameOf(v, who)} to move`;
  el.textContent = passed + text;
}

// ---------- the coach ----------
const coaching = v => !IN_FRAME && !!v?.G && v.mode === "solo" && opts.coach !== "off";
function drawAhead(v) {
  const el = $("ahead");
  el.hidden = !coaching(v);
  if (el.hidden) return;
  const s = v.state, scores = coachCache.get(keyOf(s));
  const asked = opts.coach === "always" || hintAt.key === keyOf(s);
  el.classList.toggle("wait", !scores || !asked);
  if (!scores || !asked || v.over) {
    el.innerHTML = `<div class="fk-meter"><b style="width:0"></b><i></i></div><span>${v.over ? "" : asked ? "Weighing…" : "Hint shows who is ahead"}</span>`;
    return;
  }
  const w = verdict(scores, s.t), dark = share(w), who = c => (isTwo(v) ? COLOURS[c] : nameOf(v, seatOf(s, c)));
  let text;
  if (w.exact) text = w.margin === 0 ? "A draw, played out" : `${who(w.margin > 0 ? "d" : "l")} wins by ${Math.abs(w.margin)}, played out`;
  else text = dark > 0.62 ? `${who("d")} is ahead` : dark < 0.38 ? `${who("l")} is ahead` : dark > 0.54 ? `${who("d")} a little ahead` : dark < 0.46 ? `${who("l")} a little ahead` : "Even";
  el.innerHTML = `<div class="fk-meter" role="img" aria-label="${esc(text)}"><b style="width:${(dark * 100).toFixed(1)}%"></b><i></i></div><span>${esc(text)}</span>`;
}
function coachWork(v) {
  if (!coaching(v) || opts.coach !== "always" || v.over) return;
  const key = keyOf(v.state);
  if (coachCache.has(key) || coachBusy) return;
  askCoach(v.state);
}
function askCoach(s) {
  const key = keyOf(s);
  if (coachCache.has(key)) return Promise.resolve(coachCache.get(key));
  coachBusy = key;
  return coachMind.ask({ kind: "coach", b: s.b, t: s.t, ...COACH, all: false }).then(scores => {
    coachCache.set(key, scores);
    if (coachCache.size > 80) coachCache.delete(coachCache.keys().next().value);
    return scores;
  }).catch(() => null).finally(() => { coachBusy = ""; draw(); coachWork(V); });
}
async function hint() {
  const v = V, who = mover(v);
  if (who == null || !coaching(v)) return;
  const s = v.state, key = keyOf(s);
  hintAt = { key, sq: -1 };
  draw();
  const scores = await askCoach(s);
  if (!scores?.length || !V?.G || keyOf(V.state) !== key) return;
  hintAt = { key, sq: scores[0].sq };
  draw();
}

// ---------- the computer's move ----------
// The runner calls rules.bot() synchronously, which finds the scores the worker worked out (flank-rules.js); until they
// are in, the runner is held (hold()) and the board says the computer is thinking.
let botKey = "";
function botWork(v) {
  const who = v?.toMove;
  const mine = v?.G && !v.over && who != null && v.seats?.[who]?.bot && !IN_FRAME && (v.mode === "solo" || v.me?.driver) && !isTwo(v);
  if (!mine) { if (holding) { holding = false; } return; }
  const s = v.state, level = opts.level, key = `${level}|${keyOf(s)}`;
  if (primed(s.b, s.t, level)) { holding = false; return; }
  if (botKey === key) return;
  botKey = key;
  holding = true;
  mind.ask({ kind: "move", b: s.b, t: s.t, level }).then(scores => prime(s.b, s.t, level, scores)).catch(() => {}).finally(() => {
    if (botKey !== key) { botWork(V); return; }                     // taken back, or another game or level, meanwhile
    holding = false;
    page.runner.kick();
  });
}

// ---------- moves ----------
async function move(m) {
  const v = page.view;
  if (!isTwo(v)) return page.move(m);
  // two on one phone: whoever's turn it is moves, from this phone
  const who = v.toMove;
  if (who == null) return "";
  let why = "";
  const ok = await page.runner.table.act(cur => {
    if (!cur.game || cur.game.seq !== v.G.seq) { why = "That game has ended"; return false; }
    const r = applyMove(rules, cur.game, who, m, Date.now());
    if (r.error) { why = r.error; return false; }
    cur.game = r.G;
  });
  return ok ? "" : why || "Couldn't make that move";
}
async function tap(sq) {
  if (mover(V) == null) return;
  const why = await move(sq);
  if (why) toast(why);
}
/** How many moves Undo takes: back to a position where it is a person's turn, with something undone. */
function takeBackCount(v) {
  const s = v?.G ? v.state : null;
  if (!s || !s.undo || !s.moves.length || v.mode !== "solo") return 0;
  if (isTwo(v)) return 1;
  const ps = replay(s.moves, position(s.start, s.t0));
  if (!ps) return 0;
  for (let i = s.moves.length - 1; i >= 0; i--) if (seatOf(s, ps[i].t) === 0) return s.moves.length - i;
  return 0;
}
async function takeBack() {
  const n = takeBackCount(V);
  if (!n) return;
  hintAt = { key: "", sq: -1 };
  const why = await move({ undo: n });
  if (why) toast(why);
}

$("controls").innerHTML = `<button class="btn fk-btn" type="button" data-act="back">Undo</button><button class="btn fk-btn" type="button" data-act="hint">Hint</button><button class="btn fk-btn" type="button" data-act="new">New</button>`;
function drawControls(v) {
  const [back, hintBtn, again] = $("controls").children;
  back.disabled = !takeBackCount(v) || IN_FRAME;
  hintBtn.disabled = !(v?.mode === "solo" && coaching(v) && mover(v) != null && !holding);
  again.disabled = !page.host || IN_FRAME;
  again.classList.toggle("primary", !!v?.over);
}
$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "back") takeBack();
  else if (act === "hint") hint();
  else if (act === "new") {
    if (V?.G && !V.over && V.state.moves.length > 6 && !(await sure("Start a new game? This one isn't finished.", { yes: "New game", no: "Keep playing" }))) return;
    newGame();
  }
});

// ---------- the end ----------
function onOver(v) {
  if (IN_FRAME) return;
  const s = v.state, r = s.result, mine = isTwo(v) ? null : v.seat != null && r.winner && seatOf(s, r.winner) === v.seat;
  if (mine !== null && v.seat != null) {
    const rec = read(RECORD, { played: 0, won: 0, drawn: 0 });
    rec.played++;
    if (mine) rec.won++;
    if (!r.winner) rec.drawn++;
    write(RECORD, rec);
    noteStreak("flank", !!mine);
  }
  setTimeout(() => { if (V?.over && V.G === v.G) showEnd(V); }, 1100);
}
function showEnd(v) {
  const s = v.state, r = s.result, left = 64 - r.d - r.l;
  $("endHead").textContent = resultText(v).split(",")[0];
  const rows = ["d", "l"].map(c => `<li class="${r.winner === c ? "won" : ""}"><i class="fk-swatch ${c}"></i><span class="nm">${esc(isTwo(v) ? COLOURS[c] : nameOf(v, seatOf(s, c)))}</span><b>${r[c]}</b></li>`);
  $("endBody").innerHTML = `<ol class="fk-tally">${rows.join("")}</ol><p class="fk-end-note">${left ? `Neither side could move with ${left} ${left === 1 ? "square" : "squares"} still empty. ` : "The board is full. "}${s.moves.length} moves.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  hintAt = { key: "", sq: -1 };
  botKey = "";
  const two = opts.mode === "two" && !page.atTable;
  page.deal({ colour: two || page.atTable ? "dark" : opts.colour, two, undo: !page.atTable }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endBoard").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Reversi is an old game, for two. Each disc has a dark side and a light side; on the board you are the colour showing. Dark moves first, from the usual start of two discs each in the middle.</p>
    <h3>A move</h3>
    <p>Place a disc on an empty square so that, in a straight line (across, down or diagonally), it brackets one or more of the other side's discs between the new disc and one of your own. Every disc so bracketed turns over to your colour, in every direction at once. A move must turn at least one disc; the squares you may play are marked.</p>
    <h3>Passing and the end</h3>
    <p>With no square to play you pass, and the other side moves again. When neither side can move, usually because the board is full, the side with more discs wins.</p>
    <h3>Playing well</h3>
    <p>Corners can never be turned, and the squares touching an empty corner give it away. Moves matter more than discs: the side with more choices is the one that can wait. Early on, fewer discs is often better. The Learn course goes through all of it.</p>
    <h3>Here</h3>
    <p class="fk-rules-note">Tap a marked square to play. Hint shows the coach's best move and who is ahead; Undo takes back your last move and the reply. The computer: Easy slips often, Medium looks a few moves ahead, Hard looks eight moves ahead and plays out the last fourteen squares exactly.</p>`;
  $("rulesDlg").showModal();
}

const course = createCourse({
  id: "flank", course: COURSE, cls: "fk", inFrame: IN_FRAME, onRules: showRules, stage: boardStage(),
  onPlay: step => {
    if (page.atTable) { toast("Your table plays on: try a game against Easy when you're back to solo"); return; }
    opts.mode = "computer";
    opts.level = step?.level || "easy";
    saveOpts();
    newGame();
  },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("flank", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Reversi, from the rules", () => course.open()));
  play.append(action("The rules on one page", showRules, "link"));
  const content = part(body, "content");
  content.append(choice("Opponent", [["computer", "Computer"], ["two", "Two on this phone"]], opts.mode, v => { opts.mode = v; saveOpts(); }));
  content.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); botKey = ""; botWork(V); }));
  content.append(choice("You play", [["dark", "Dark (first)"], ["light", "Light"], ["either", "Either"]], opts.colour, v => { opts.colour = v; saveOpts(); }));
  const set = part(body, "settings");
  set.append(view.choice(() => draw()));
  set.append(line("The opponent and colour apply from the next game."));
  set.append(choice("Coach", [["off", "Off"], ["hints", "Hints"], ["always", "Always"]], opts.coach, v => { opts.coach = v; saveOpts(); hintAt = { key: "", sq: -1 }; draw(); coachWork(V); }));
  set.append(toggle("Mark the squares you may play", opts.marks, on => { opts.marks = on; saveOpts(); draw(); }));
  const r = read(RECORD, { played: 0, won: 0, drawn: 0 }), st = read("flank:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games against the computer or a friend${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the page on its runner ----------
// (last: seatPage hands over the saved game at once, and everything the first view draws must exist by then)
page = seatPage({
  rules, id: "flank", app: 1, pace: 650, botName: () => "Computer", level: () => opts.level, voice: () => false,
  onView: v => { V = v; syncTwo(v); draw(); botWork(v); coachWork(v); randomRounds(v); },
  onOver, toast, newGame, hold: () => holding,
});
syncTwo(page.view);
page.runner.update();

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "flank");
document.querySelector(".fk-mark").innerHTML = APPS.find(a => a.id === "flank")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__flank = { page, get view() { return V; }, opts, course, board, prime, mind };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
