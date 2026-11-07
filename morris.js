// Nine Men's Morris for two, against the computer, two on one phone, a partner's match or a table of friends. The rules of a
// move are morris-board.js's, the game on seats.js morris-rules.js's, the computer morris-search.js's (its work is done in a
// worker, morris-worker.js, while the board stays alive). This page draws the board (morris-draw.js) and turns taps into a
// move: a point to place on; a piece, then the point it goes to; and, when that closes a mill, the piece to take. The move
// is made whole when the last tap is in, so a game is only ever its finished moves. The coach (Menu, Coach) gives the best
// move and who is ahead on request; Undo replays the game a move shorter.
import { rules, ready, readyKey, seatOf, colourOf, positionOf, lastOf, startOf } from "./morris-rules.js";
import { movesOf, decode, encode, phaseOf, replay, N } from "./morris-board.js";
import { LEVEL_NAMES, levelOf, MATE } from "./morris-search.js";
import { createBoard } from "./morris-draw.js";
import { seatPage } from "./seats-ui.js";
import { applyMove } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { ramp } from "./ramp.js";
import { tableView } from "./table3d-view.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sure } from "./sure.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage } from "./morris-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "morris:opts", RECORD = "morris:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const COLOURS = { d: "Dark", l: "Light" };

// opts: the next game's choices (mode "computer" or "two", colour you play, the computer's level) and how it looks and
// helps (coach "off", "hints" or "always"; marks on the points a piece may go to)
let opts = { mode: "computer", level: "medium", colour: "dark", coach: "hints", marks: true, ...read(OPTS, {}) };
if (!["computer", "two"].includes(opts.mode)) opts.mode = "computer";
if (!["off", "hints", "always"].includes(opts.coach)) opts.coach = "hints";
if (!["dark", "light", "either"].includes(opts.colour)) opts.colour = "dark";
// Korbi, 4 November 2026: the menu is the minimum it needs to be. Either colour (the sides alternate), the points a piece
// may go to marked, whatever an older save chose. The computer's strength is the hidden ramp, its first step the old saved
// choice (a lesson's game plays Easy, once). The coach is on or off (a saved Always stays Always).
const OLD_LEVEL = opts.level;
Object.assign(opts, { colour: "either", marks: true });
let lesson = null, lessonNext = null;
const levelNow = () => lesson || ramp("morris", LEVEL_NAMES.map(([k]) => k), { start: OLD_LEVEL });
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the search, off the page ----------
let worker = null, workerOff = false, jobId = 0;
const jobs = new Map();
function workerSend(kind, v) {
  return new Promise(resolve => {
    if (workerOff) { resolve(null); return; }
    try {
      if (!worker) {
        worker = new Worker(new URL("./morris-worker.js", import.meta.url), { type: "module" });
        worker.onmessage = e => { const j = jobs.get(e.data.id); jobs.delete(e.data.id); j?.(e.data); };
        worker.onerror = () => { workerOff = true; for (const j of jobs.values()) j(null); jobs.clear(); page?.runner.kick(); };
      }
      const id = ++jobId;
      jobs.set(id, resolve);
      worker.postMessage({ id, kind, state: v.state, level: levelNow(), seed: v.G.seed, n: v.G.n });
    } catch { workerOff = true; resolve(null); }
  });
}

// ---------- the game ----------
let V = null;                                   // the runner's latest view
let page = null;                                // (declared before seatPage, which hands over the saved game at once)
let drawnGame = "";
let ui = { key: "", sel: -1, pend: null, hint: null };   // the move being made: the piece picked up, a mill's choice of piece to take, the coach's move
const pending = new Set();
const randomRounds = seatRounds("morris");      // random mode's round: a game

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
const gameKey = v => (v?.G ? `${v.G.seq}:${v.state.moves.length}` : "");

/** The page holds the computer's move while the worker is still finding it (so the main thread never does). */
function hold() {
  const v = V;
  if (!v?.G || v.over || workerOff || isTwo(v)) return false;
  const who = v.toMove;
  return who != null && !!v.seats[who]?.bot && !ready.has(readyKey(v.state, levelNow()));
}
/** Work for the worker after a view: the computer's move, and the coach's judgement of the position. */
const coachCache = new Map();                   // position → { score (dark's view), code }
function work(v) {
  if (!v?.G || v.over || IN_FRAME) return;
  const s = v.state, key = gameKey(v), who = v.toMove;
  const runsBot = who != null && v.seats[who]?.bot && !isTwo(v) && (v.mode === "solo" || v.me?.driver);
  if (runsBot && !ready.has(readyKey(s, levelNow())) && !pending.has(`m${key}`)) {
    pending.add(`m${key}`);
    workerSend("move", v).then(r => {
      pending.delete(`m${key}`);
      if (r?.code != null && !r.error) { ready.set(readyKey(s, levelNow()), r.code); page.runner.kick(); }
    });
  }
  if (coaching(v) && opts.coach === "always" && !coachCache.has(key)) judgeFor(v);
}
const inflight = new Map();
function judgeFor(v) {
  const key = gameKey(v);
  if (coachCache.has(key)) return Promise.resolve(coachCache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const job = workerSend("judge", v).then(r => {
    inflight.delete(key);
    if (!r || r.error) return null;
    coachCache.set(key, r);
    if (coachCache.size > 60) coachCache.delete(coachCache.keys().next().value);
    drawAhead(V);
    return r;
  });
  inflight.set(key, job);
  return job;
}

// ---------- the board ----------
const board = createBoard($("board"), { onTap: pt => tap(pt) });
const view = tableView("morris", ["board", "Board"]);                  // Menu, View: the flat board or the board tipped away from you (morris-3d.css)
const applyView = () => $("app").classList.toggle("mo3", view.get() === "3d");

function draw() {
  applyView();
  if (!page) return;
  const v = V, s = v?.G ? v.state : null;
  const id = v?.G ? `${v.G.seq}:${v.G.started}:${v.mode}` : "";
  const still = id !== drawnGame || !s;
  drawnGame = id;
  const key = gameKey(v);
  if (ui.key !== key) ui = { key, sel: -1, pend: null, hint: null };
  const who = mover(v);
  let b = s?.b, legal = [], take = [], sel = -1;
  if (s && who != null) {
    const list = movesOf(positionOf(s)).map(decode);
    if (ui.pend) {
      b = tentative(s.b, ui.pend, s.t);
      take = ui.pend.cands.map(m => m.x);
    } else if (phaseOf(positionOf(s)) === "place") legal = opts.marks ? [...new Set(list.map(m => m.t))] : [];
    else if (ui.sel >= 0) { sel = ui.sel; legal = opts.marks ? list.filter(m => m.f === ui.sel).map(m => m.t) : []; }
  }
  const hint = s && ui.hint && who != null && !ui.pend ? ui.hint : null;
  board.draw({ b, legal, sel, take, last: s ? lastOf(s) : null, hint, still, tap: who != null });
  $("app").classList.toggle("nomarks", !opts.marks);
  drawSeats(v);
  drawStatus(v);
  drawAhead(v);
  drawControls(v);
}
/** The board with a move made on it but not yet its capture. */
function tentative(b, m, colour) {
  const a = [...b];
  if (m.f >= 0) a[m.f] = ".";
  a[m.t] = colour;
  return a.join("");
}

function nameOf(v, seat) {
  const s = v.state;
  if (isTwo(v)) return COLOURS[colourOf(s, seat)];
  if (v.mode === "solo") return seat === 0 ? "You" : "Computer";
  if (v.seat === seat) return "You";
  const w = v.seats?.[seat];
  return w?.name ? `${w.name}${w.bot ? " (computer)" : ""}` : "Opponent";
}
const countOn = (b, c) => { let n = 0; for (let i = 0; i < N; i++) if (b[i] === c) n++; return n; };
function drawSeats(v) {
  const far = $("far"), near = $("near");
  if (!v?.G) { far.replaceChildren(); near.replaceChildren(); return; }
  const s = v.state, me = isTwo(v) ? 0 : v.seat ?? 0;
  for (const [box, seat] of [[far, 1 - me], [near, me]]) {
    const c = colourOf(s, seat), turn = !v.over && v.toMove === seat, hand = c === "d" ? s.hd : s.hl, on = countOn(s.b, c);
    const sub = isTwo(v) ? "" : v.mode === "solo" && seat === 1 ? `${levelOf(levelNow()).name} · ${COLOURS[c]}` : COLOURS[c];   // two on one phone: the name is the colour already
    box.className = `mo-seat ${box.id}${turn ? " turn" : ""}`;
    box.innerHTML = `<i class="mo-swatch ${c}"></i><b class="mo-name">${esc(nameOf(v, seat))}</b><small>${esc(sub)}</small>
      <span class="mo-hand" role="img" aria-label="${hand} to place">${`<i class="${c}"></i>`.repeat(hand)}</span><span class="mo-count" aria-label="${on} on the board">${on}</span>`;
  }
}

function resultText(v) {
  const s = v.state, r = s.result;
  if (!r.winner) return "A draw";
  const win = seatOf(s, r.winner);
  if (isTwo(v)) return `${COLOURS[r.winner]} wins`;
  if (v.seat != null && win === v.seat) return "You win";
  return `${nameOf(v, win)} wins`;
}
function drawStatus(v) {
  const el = $("status");
  el.classList.remove("big");
  if (!v?.G) { el.textContent = ""; return; }
  const s = v.state;
  if (v.over) { el.textContent = resultText(v); el.classList.add("big"); return; }
  const who = v.toMove, p = positionOf(s), phase = phaseOf(p), last = lastOf(s);
  const took = last?.x >= 0 ? `${isTwo(v) ? COLOURS[last.by] : nameOf(v, seatOf(s, last.by))} took a piece. ` : "";
  let text;
  if (mover(v) != null) {
    if (ui.pend) text = "A mill: take one of their pieces";
    else if (phase === "place") text = `${isTwo(v) ? `${COLOURS[s.t]}: place` : "Your move: place"} a piece (${s.t === "d" ? s.hd : s.hl} left)`;
    else text = `${isTwo(v) ? `${COLOURS[s.t]}: ` : "Your move: "}${phase === "fly" ? "fly a piece anywhere" : "slide a piece"}`;
  } else if (v.seats?.[who]?.bot && !v.seats[who].away) text = `${nameOf(v, who)} is thinking…`;
  else text = `${nameOf(v, who)} to move`;
  el.textContent = took + text;
}

// ---------- the coach ----------
const coaching = v => !IN_FRAME && !!v?.G && v.mode === "solo" && opts.coach !== "off";
/** Dark's share of the balance, 0 to 1, for the meter. */
const share = score => (Math.abs(score) > MATE - 500 ? (score > 0 ? 0.97 : 0.03) : 1 / (1 + Math.exp(-score / 320)));
function drawAhead(v) {
  const el = $("ahead");
  el.hidden = !coaching(v);
  if (el.hidden) return;
  const key = gameKey(v), r = coachCache.get(key), asked = opts.coach === "always" || ui.asked;
  el.classList.toggle("wait", !r || !asked);
  if (!r || !asked || v.over) {
    el.innerHTML = `<div class="mo-meter"><b style="width:0"></b><i></i></div><span>${v.over ? "" : asked ? "Weighing…" : "Hint shows who is ahead"}</span>`;
    return;
  }
  const dark = share(r.score), who = c => (isTwo(v) ? COLOURS[c] : nameOf(v, seatOf(v.state, c)));
  let text;
  if (Math.abs(r.score) > MATE - 500) text = `${who(r.score > 0 ? "d" : "l")} wins by force`;
  else text = dark > 0.66 ? `${who("d")} is ahead` : dark < 0.34 ? `${who("l")} is ahead` : dark > 0.56 ? `${who("d")} a little ahead` : dark < 0.44 ? `${who("l")} a little ahead` : "Even";
  el.innerHTML = `<div class="mo-meter" role="img" aria-label="${esc(text)}"><b style="width:${(dark * 100).toFixed(1)}%"></b><i></i></div><span>${esc(text)}</span>`;
}
async function hint() {
  const v = V, who = mover(v);
  if (who == null || !coaching(v)) return;
  const key = gameKey(v);
  ui = { key, sel: -1, pend: null, hint: null, asked: true };      // asked: the meter says it is weighing
  draw();
  const r = await judgeFor(v);
  if (!V?.G || gameKey(V) !== key) return;
  if (!r || r.code == null) { toast("No hint to give"); return; }
  ui.hint = decode(r.code);
  draw();
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
async function commit(m) {
  ui = { key: ui.key, sel: -1, pend: null, hint: null };
  const why = await move(encode(m.f, m.t, m.x));
  if (why) { toast(why); draw(); }
}
/** The moves of one piece to one point are done when none of them takes a piece, else the player picks which to take. */
function chosen(cands) {
  if (cands.length === 1 && cands[0].x < 0) { commit(cands[0]); return; }
  ui = { ...ui, sel: -1, hint: null, pend: { f: cands[0].f, t: cands[0].t, cands } };
  draw();
}
function tap(pt) {
  const v = V, who = mover(v);
  if (who == null) return;
  const s = v.state, p = positionOf(s), c = s.t, o = c === "d" ? "l" : "d", list = movesOf(p).map(decode);
  if (ui.pend) {
    const hit = ui.pend.cands.find(m => m.x === pt);
    if (hit) { commit(hit); return; }
    ui = { ...ui, pend: null };                 // anywhere else puts the move back
    if (s.b[pt] !== c) { draw(); return; }
  }
  ui.hint = null;
  const phase = phaseOf(p);
  if (phase === "place") {
    if (s.b[pt] !== ".") { toast("That point is taken"); return; }
    chosen(list.filter(m => m.t === pt));
    return;
  }
  if (s.b[pt] === c) {
    if (ui.sel === pt) ui.sel = -1;
    else if (!list.some(m => m.f === pt)) { toast("That piece is blocked"); return; }
    else ui.sel = pt;
    draw();
    return;
  }
  if (s.b[pt] === o) { toast(ui.sel < 0 ? "Tap one of your own pieces to move it" : "That point is taken"); return; }
  if (ui.sel < 0) { toast("Tap one of your own pieces first"); return; }
  const cands = list.filter(m => m.f === ui.sel && m.t === pt);
  if (!cands.length) { toast(phase === "fly" ? "Pick an empty point" : "A piece slides along a line to the next point"); return; }
  chosen(cands);
}
/** How many moves Undo takes: back to a position where it is a person's turn, with something undone. */
function takeBackCount(v) {
  const s = v?.G ? v.state : null;
  if (!s || !s.undo || !s.moves.length || v.mode !== "solo") return 0;
  if (isTwo(v)) return 1;
  const ps = replay(s.moves, startOf(s));
  if (!ps) return 0;
  for (let i = s.moves.length - 1; i >= 0; i--) if (seatOf(s, ps[i].t) === 0) return s.moves.length - i;
  return 0;
}
async function takeBack() {
  const n = takeBackCount(V);
  if (!n) return;
  ui = { key: ui.key, sel: -1, pend: null, hint: null };
  const why = await move({ undo: n });
  if (why) toast(why);
}

$("controls").innerHTML = `<button class="btn mo-btn" type="button" data-act="back">Undo</button><button class="btn mo-btn" type="button" data-act="hint">Hint</button><button class="btn mo-btn" type="button" data-act="new">New</button>`;
function drawControls(v) {
  const [back, hintBtn, again] = $("controls").children;
  back.disabled = !takeBackCount(v) || IN_FRAME;
  hintBtn.disabled = !(v?.mode === "solo" && coaching(v) && mover(v) != null);
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
    if (V?.G && !V.over && V.state.moves.length > 8 && !(await sure("Start a new game? This one isn't finished.", { yes: "New game", no: "Keep playing" }))) return;
    newGame();
  }
});

// ---------- the end ----------
const WHY = {
  two: loser => `${loser} was down to two pieces.`,
  blocked: loser => `${loser} had no move.`,
  resign: loser => `${loser} resigned.`,
};
function onOver(v) {
  if (IN_FRAME) return;
  const s = v.state, r = s.result, mine = isTwo(v) ? null : v.seat != null && r.winner && seatOf(s, r.winner) === v.seat;
  if (mine !== null && v.seat != null) {
    const rec = read(RECORD, { played: 0, won: 0, drawn: 0 });
    rec.played++;
    if (mine) rec.won++;
    if (!r.winner) rec.drawn++;
    write(RECORD, rec);
    noteStreak("morris", !!mine);
    if (!page.atTable && !isTwo(v) && !lesson) { levelNow(); mine ? ramp.won(true) : r.winner ? ramp.lost() : ramp.won(false); }
  }
  setTimeout(() => { if (V?.over && V.G === v.G) showEnd(V); }, 1100);
}
function showEnd(v) {
  const s = v.state, r = s.result, who = c => (isTwo(v) ? COLOURS[c] : nameOf(v, seatOf(s, c)));
  $("endHead").textContent = resultText(v);
  const rows = ["d", "l"].map(c => `<li class="${r.winner === c ? "won" : ""}"><i class="mo-swatch ${c}"></i><span class="nm">${esc(who(c))}</span><b>${countOn(s.b, c) + (c === "d" ? s.hd : s.hl)}</b></li>`);
  const loser = r.winner === "d" ? "l" : "d";
  const note = r.why === "repeat" ? "The same position came up a third time." : (WHY[r.why]?.(who(loser)) || "");
  $("endBody").innerHTML = `<ol class="mo-tally">${rows.join("")}</ol><p class="mo-end-note">${esc(note)} ${s.moves.length} moves. The figures are pieces left, on the board and in hand.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  lesson = lessonNext; lessonNext = null;
  ui = { key: "", sel: -1, pend: null, hint: null };
  ready.clear();
  const two = opts.mode === "two" && !page.atTable;
  page.deal({ colour: two || page.atTable ? "dark" : opts.colour, two, undo: !page.atTable }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endBoard").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Nine Men's Morris is an old game for two, played on a board of three squares joined by lines. Each side has nine pieces. The aim is to leave the other side with two pieces, or with no move.</p>
    <h3>Placing</h3>
    <p>Dark begins. In turn each side puts a piece on any empty point, until all eighteen are down.</p>
    <h3>Moving</h3>
    <p>Then the sides slide a piece a turn along a line to a neighbouring empty point. A side down to three pieces may fly: move any piece to any empty point.</p>
    <h3>Mills</h3>
    <p>Three of your pieces in a line is a mill. Closing one, by placing or by moving, takes one of the other side's pieces off the board. Take a piece that is not in a mill; if every piece is in a mill, any may go. Opening a mill and closing it again takes another piece each time.</p>
    <h3>The end</h3>
    <p>A side that is down to two pieces (counting any still in hand) loses, and so does a side that cannot move on its turn. The same position a third time, with the same side to move, is a draw.</p>
    <h3>Here</h3>
    <p class="mo-rules-note">Tap a point to place; tap a piece, then a marked point, to move. When a move closes a mill, tap the piece to take. Hint shows the coach's best move and who is ahead; Undo takes back your last move and the reply. The computer plays harder as you win and easier as you lose.</p>`;
  $("rulesDlg").showModal();
}

const course = createCourse({
  id: "morris", course: COURSE, cls: "mo", inFrame: IN_FRAME, onRules: showRules, stage: boardStage(),
  onPlay: step => {
    if (page.atTable) { toast("Your table plays on: try a game against Easy when you're back to solo"); return; }
    opts.mode = "computer";
    lessonNext = step?.level || "easy";
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
  const cp = progressOf("morris", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Nine Men's Morris, from the rules", () => course.open()));
  if (V?.G && !V.over && !IN_FRAME && (isTwo(V) || V.seat != null)) {
    play.append(action("Resign", async () => {
      if (await sure("Resign this game?", { yes: "Resign", no: "Keep playing" })) { const why = await move({ resign: true }); if (why) toast(why); }
    }, "link"));
  }
  const content = part(body, "content");
  content.append(choice("Opponent", [["computer", "Computer"], ["two", "Two on this phone"]], opts.mode, v => { opts.mode = v; saveOpts(); }));
  const set = part(body, "settings");
  set.append(view.choice(() => draw()));
  set.append(line("The opponent applies from the next game."));
  set.append(toggle("Coach", opts.coach !== "off", on => { opts.coach = on ? "hints" : "off"; saveOpts(); ui.hint = null; draw(); work(V); }));
  const r = read(RECORD, { played: 0, won: 0, drawn: 0 }), st = read("morris:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games against the computer or a friend${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the page on its runner ----------
// (last: seatPage hands over the saved game at once, and everything the first view draws must exist by then)
page = seatPage({
  rules, id: "morris", app: 1, pace: 650, botName: () => "Computer", level: () => levelNow(), voice: () => false,
  onView: v => { V = v; syncTwo(v); draw(); work(v); randomRounds(v); },
  onOver, toast, newGame, hold,
});
syncTwo(page.view);
page.runner.update();

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "morris");
document.querySelector(".mo-mark").innerHTML = APPS.find(a => a.id === "morris")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__morris = { page, get view() { return V; }, opts, course, board, get ui() { return ui; }, ready };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
