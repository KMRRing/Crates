// Crown: draughts (checkers) against the computer, two on one phone, or at a table with a friend each on their own phone.
// The rules are crown-board.js's (the sets as data), the game's crown-rules.js on seats.js, the computer crown-search.js
// (worked out in crown-worker.js, off the page). This page draws the board as the one playing it sees it, their men at the
// top, and takes a move by taps: a piece picked up shows where it may land; a multi-jump is one move, tapped landing by
// landing or by its last square when the route is the only one.
import { rules, SETS, SET_IDS, legalMoves, counts, toArray, ready, readyKey, LEVEL_NAMES, SIDE_LABEL } from "./crown-rules.js";
import { applyMove } from "./seats.js";
import { inHand, mustSquares, tapSquare } from "./crown-tap.js";
import { boardSvg, centreOf, pieceSvg } from "./crown-draw.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak, noteDayTime, arrivedForToday, today } from "./suite.js";
import { sure } from "./sure.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage, dayCourse } from "./crown-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "crown:opts", RECORD = "crown:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const BOT = "Computer";

let opts = { set: "english", you: "ink", level: "medium", vs: "computer", mark: true, ahead: false, labels: false, voice: true, ...read(OPTS, {}) };
if (!SETS[opts.set]) opts.set = "english";
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
        worker = new Worker(new URL("./crown-worker.js", import.meta.url), { type: "module" });
        worker.onmessage = e => { const j = jobs.get(e.data.id); jobs.delete(e.data.id); j?.(e.data); };
        worker.onerror = () => { workerOff = true; for (const j of jobs.values()) j(null); jobs.clear(); page?.runner.kick(); };
      }
      const id = ++jobId;
      jobs.set(id, resolve);
      worker.postMessage({ id, kind, state: v.state, level: opts.level, seed: v.G.seed, n: v.G.n });
    } catch { workerOff = true; resolve(null); }
  });
}

// ---------- the table ----------
let V = null;
let ui = { key: "", sel: null, partial: [], hint: [], flash: 0 };
let shown = { key: "", anim: null, token: 0 };
let aheadFor = { key: "", score: null };
const pending = new Set();
let page = null;
const S = () => V?.state;
const hot = () => !!S()?.hot;
const actor = () => (hot() ? S().turn : V?.seat ?? null);
const sideAt = seat => S().sides[seat];
const nameOf = seat => (hot() ? (seat === 0 ? "Player 1" : "Player 2") : V?.seats?.[seat]?.name ?? BOT);
const bottomSeat = () => (V?.seat != null && !hot() ? V.seat : 0);
const bottomSide = () => (S() ? sideAt(bottomSeat()) : 0);
const posKey = () => (V?.G ? `${V.G.seq}:${S().ply}` : "");

const randomRounds = seatRounds("crown");
page = seatPage({
  rules, id: "crown", app: 1, pace: 700, botName: (seat, G) => (G?.state?.hot ? "Player 2" : BOT), level: () => opts.level, voice: () => opts.voice,
  hold, onView: v => { V = v; follow(v); work(v); draw(); randomRounds(v); }, onOver, toast, newGame: newGame,
});

/** The page holds the computer's move while the worker is still finding it (so the main thread never does), and always on a friend's turn. */
function hold() {
  const v = V;
  if (!v?.G || v.over) return false;
  if (v.state.hot) return true;
  if (workerOff) return false;
  const who = v.toMove;
  return who != null && !!v.seats[who]?.bot && !ready.has(readyKey(v.state, opts.level));
}

/** Work for the worker after a view: the computer's move, and the coach's judgement of the position. */
function work(v) {
  if (!v?.G || v.over || IN_FRAME) return;
  const s = v.state, key = `${v.G.seq}:${s.ply}`;
  const who = v.toMove;
  const runsBot = !s.hot && who != null && v.seats[who]?.bot && (v.mode === "solo" || v.me?.driver);
  if (runsBot && !ready.has(readyKey(s, opts.level)) && !pending.has(`m${key}`)) {
    pending.add(`m${key}`);
    workerSend("move", v).then(r => {
      pending.delete(`m${key}`);
      if (r?.path) { ready.set(readyKey(s, opts.level), r.path); page.runner.kick(); }
    });
  }
  if (opts.ahead && aheadFor.key !== key && !pending.has(`a${key}`)) {
    pending.add(`a${key}`);
    workerSend("judge", v).then(r => { pending.delete(`a${key}`); if (r && !r.error) { aheadFor = { key, score: r.score }; drawAhead(); } });
  }
}

// ---------- the other side's move, shown ----------
function follow(v) {
  const s = v?.state;
  if (!s) return;
  const key = `${v.G.seq}:${s.ply}`;
  if (key === shown.key) return;
  const prev = shown.key;
  shown.key = key;
  shown.anim = null;
  ui = { key: "", sel: null, partial: [], hint: [], flash: 0 };
  const [seq, ply] = prev ? prev.split(":").map(Number) : [-1, -1];
  if (s.last && !s.hot && seq === v.G.seq && ply === s.ply - 1 && s.last.seat !== v.seat && s.last.before && !document.hidden) {
    shown.anim = { ...s.last, token: ++shown.token };
  }
}
const animating = () => !!shown.anim;

// ---------- drawing ----------
function draw() {
  if (!page) return;
  drawSeats();
  drawBoard();
  drawControls();
  drawAhead();
}

const swatch = side => `<svg viewBox="-5 -5 10 10" aria-hidden="true">${pieceSvg(side === 0 ? 1 : -1, 0, 0)}</svg>`;
function drawSeats() {
  const v = V, bs = bottomSeat();
  for (const [box, seat] of [[$("them"), 1 - bs], [$("mine"), bs]]) {
    if (!v?.G) { box.replaceChildren(); continue; }
    const s = v.state, c = counts(toArray(s.board)), side = sideAt(seat);
    const men = c[side * 2], kings = c[side * 2 + 1];
    const turn = !s.result && s.turn === seat;
    box.className = `cr-seat ${box.id === "mine" ? "mine" : "them"}${turn ? " turn" : ""}`;
    box.innerHTML = `<i class="cr-swatch">${swatch(side)}</i><b class="cr-name">${esc(nameOf(seat))}</b><small>${SIDE_LABEL[side]}</small><span class="cr-count"><b>${men + kings}</b> ${men + kings === 1 ? "piece" : "pieces"}${kings ? `, ${kings} ${kings === 1 ? "king" : "kings"}` : ""}</span>`;
  }
}

/** The legal moves of the position on the table, worked out once per position. */
let legalCache = { key: "", list: [] };
function legalNow() {
  const k = `${posKey()}:${S().board}`;
  if (legalCache.key !== k) legalCache = { key: k, list: S().result ? [] : legalMoves(S()) };
  return legalCache.list;
}
const canAct = () => !!V?.G && !V.over && !animating() && actor() != null && S().turn === actor();

function drawBoard() {
  const box = $("board"), v = V;
  if (!v?.G) { box.innerHTML = ""; return; }
  const s = v.state, bottom = bottomSide();
  const view = { set: s.set, board: s.board, bottom, labels: opts.labels, last: s.last ? [...s.last.path] : [] };
  if (animating()) {
    view.board = shown.anim.before;
    view.last = [];
  } else if (canAct()) {
    const list = legalNow(), must = mustSquares(list);
    if (opts.mark || ui.flash > Date.now()) view.must = ui.sel == null ? must : [];
    if (ui.sel != null) {
      const h = inHand(legalNow(), ui);
      view.sel = ui.sel;
      view.hops = h.hops;
      view.ends = h.ends;
      if (ui.partial.length) {
        const last = ui.partial[ui.partial.length - 1], p = s.board[ui.sel];
        view.hide = [ui.sel];
        view.ghost = { sq: last, piece: p === "o" ? 1 : p === "O" ? 2 : p === "x" ? -1 : -2 };
        view.gone = h.cands[0]?.caps.slice(0, ui.partial.length) || [];
      }
    }
    if (ui.hint.length) view.hint = ui.hint;
  } else if (ui.hint.length && !s.result) view.hint = ui.hint;
  box.innerHTML = boardSvg(view);
  if (animating()) runAnim(shown.anim);
}

/** The other side's piece slid along its path; the pieces it took go when it lands. */
function runAnim(a) {
  const finish = () => { if (shown.anim?.token !== a.token) return; shown.anim = null; draw(); };
  const svg = $("board").querySelector("svg"), el = svg?.querySelector(`[data-pc="${a.path[0]}"]`);
  const total = 300 * (a.path.length - 1);
  setTimeout(finish, total + 400);
  if (!el?.animate) { setTimeout(finish, 250); return; }
  try {
    const bottom = bottomSide();
    const frames = a.path.map(sq => { const c = centreOf(S().set, sq, bottom); return { transform: `translate(${c.x}px, ${c.y}px)` }; });
    el.parentNode.append(el);                                           // on top of the others for the trip
    const an = el.animate(frames, { duration: total, easing: "ease-in-out", fill: "forwards" });
    an.onfinish = finish;
  } catch { setTimeout(finish, 250); }
}

function drawControls() {
  const box = $("controls"), v = V;
  if (!v?.G) { box.innerHTML = `<button class="btn primary cr-go" type="button" data-act="new">New game</button>`; return; }
  const s = v.state, me = v.seat;
  if (me == null && !hot()) { box.innerHTML = `<p class="cr-status">Watching: you sit down at the next game.</p>`; return; }
  if (s.result) {
    box.innerHTML = `<p class="cr-status big">${resultWords(v)}</p><button class="btn primary cr-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  const list = legalNow();
  let status;
  if (animating()) status = `${nameOf(1 - me)} moves`;
  else if (!canAct()) status = `${nameOf(s.turn)} ${V.seats[s.turn]?.bot ? "is thinking…" : "to move"}`;
  else if (ui.sel != null && ui.partial.length) status = "Tap the next landing, or the piece to stop";
  else if (ui.sel != null) status = "Tap where it goes";
  else status = list[0]?.caps.length ? "You must jump: tap a ringed piece" : hot() ? `${SIDE_LABEL[sideAt(s.turn)]} to move` : "Your move";
  const back = backPlies();
  box.innerHTML = `<p class="cr-status${list[0]?.caps.length && canAct() ? " must" : ""}">${esc(status)}</p><div class="cr-row three"><button class="btn cr-btn" type="button" data-act="back" ${back && !animating() ? "" : "disabled"}>Undo</button><button class="btn cr-btn" type="button" data-act="hint" ${canAct() ? "" : "disabled"}>Hint</button><button class="btn cr-btn" type="button" data-act="resign" ${me == null || animating() ? "disabled" : ""}>${hot() ? "Draw?" : "Resign"}</button></div>`;
}

function resultWords(v) {
  const r = v.state.result;
  if (r.winner == null) return "A draw";
  if (hot()) return `${SIDE_LABEL[sideAt(r.winner)]} wins`;
  return r.winner === v.seat ? "You win" : `${nameOf(r.winner)} wins`;
}

/** How many plies a Take back takes: two (your move and the reply) against the computer, one on a friend's phone; 0 when it can't. */
function backPlies() {
  const s = S();
  if (!V?.G || s.result || V.mode !== "solo" || animating()) return 0;
  if (hot()) return s.ply >= 1 ? 1 : 0;
  if (s.turn !== V.seat) return 0;
  const first = sideAt(V.seat);                       // Ink's first turn is ply 0, Ivory's ply 1
  return s.ply - 2 >= first ? 2 : 0;
}

function drawAhead() {
  const box = $("ahead"), v = V;
  box.hidden = !opts.ahead || !v?.G;
  if (box.hidden) return;
  const have = aheadFor.key === posKey() && aheadFor.score != null;
  const score = have ? aheadFor.score : null;
  const share = score == null ? 50 : 100 / (1 + Math.exp(-score / 160));
  const men = score == null ? 0 : Math.round(Math.abs(score) / 10) / 10;
  const who = score == null ? "" : Math.abs(score) < 25 ? "Level" : `${score > 0 ? "Ink" : "Ivory"} ahead by about ${men < 0.5 ? "half a man" : men + (men === 1 ? " man" : " men")}`;
  box.innerHTML = `<span>Ink</span><span class="cr-bar" aria-hidden="true"><i style="width:${share}%"></i></span><span>${who || "judging…"}</span>`;
}

// ---------- taps ----------
$("board").addEventListener("click", e => {
  const hit = e.target.closest("[data-sq]");
  if (!hit || !canAct()) return;
  tap(Number(hit.dataset.sq));
});

function tap(sq) {
  const s = S(), side = sideAt(actor());
  const r = tapSquare(legalNow(), ui, sq, q => s.board[q] !== "." && (s.board[q] === "o" || s.board[q] === "O" ? 0 : 1) === side);
  ui.hint = [];
  ui.sel = r.ui.sel;
  ui.partial = r.ui.partial;
  if (r.say) toast(r.say);
  if (r.flash) { ui.flash = Date.now() + 1800; setTimeout(draw, 1850); }
  if (r.play) { send(r.play); return; }
  draw();
}

async function send(path) {
  const seat = actor(), m = { path };
  ui = { key: "", sel: null, partial: [], hint: [], flash: 0 };
  if (hot()) {
    let why = "";
    const ok = await page.runner.table.act(cur => {
      const r = applyMove(rules, cur.game, seat, m, Date.now());
      if (r.error) { why = r.error; return false; }
      cur.game = r.G;
    });
    if (!ok) toast(why || "That move can't be made");
    return;
  }
  const why = await page.move(m);
  if (why) toast(why);
}

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "result") { showEnd(V); return; }
  if (act === "back") {
    const plies = backPlies();
    if (!plies) return;
    ui = { key: "", sel: null, partial: [], hint: [], flash: 0 };
    const why = hot() ? await page.runner.table.act(cur => { const r = applyMove(rules, cur.game, actor(), { t: "back", plies }, Date.now()); if (r.error) return false; cur.game = r.G; }).then(ok => (ok ? "" : "Can't take that back")) : await page.move({ t: "back", plies });
    if (why) toast(why);
    return;
  }
  if (act === "hint") {
    b.disabled = true;
    toast("Looking…", 1500);
    const r = await workerSend("hint", V) || null;
    if (!r?.path) { toast("No hint to give"); draw(); return; }
    ui.hint = r.path;
    ui.sel = null; ui.partial = [];
    toast(`Try ${r.path.length > 2 || V.state.board[r.path[0]] === "." ? "the jump marked" : "the move marked"}`, 2200);
    draw();
    return;
  }
  if (act === "resign") {
    if (hot()) {
      if (await sure("Call it a draw? Both of you must agree.")) { await endDraw(); }
      return;
    }
    if (!(await sure("Resign this game?"))) return;
    const why = await page.move({ t: "resign" });
    if (why) toast(why);
  }
});

/** An agreed draw on one phone: a resignation that scores as nobody's. */
async function endDraw() {
  await page.runner.table.act(cur => {
    const G = cur.game;
    if (!G || G.state.result) return false;
    G.state.result = { winner: null, why: "agreed" };
    G.state.say = "A draw, agreed.";
    G.n++;
  });
}

// ---------- the end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const r = v.state.result, won = r.winner === v.seat;
  if (!v.state.hot) {
    const rec = read(RECORD, { played: 0, won: 0, drawn: 0 });
    rec.played++;
    if (won) rec.won++;
    if (r.winner == null) rec.drawn = (rec.drawn || 0) + 1;
    write(RECORD, rec);
    if (r.winner != null) noteStreak("crown", won);
  }
  setTimeout(() => { if (V?.over) showEnd(V); }, 1000);
}
const WHY = {
  blocked: "no move left", captured: "every piece taken", resigned: "resigned", repetition: "the same position a third time",
  quiet: "too long without a capture or a man moving", agreed: "agreed",
};
function showEnd(v) {
  const s = v.state, r = s.result;
  $("endHead").textContent = resultWords(v);
  $("endBody").innerHTML = `<p class="cr-end-note">${r.winner == null ? "Drawn" : "Won"} by ${WHY[r.why] || r.why}, after ${Math.ceil(s.ply / 2)} moves each, ${SETS[s.set].name} draughts.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  ui = { key: "", sel: null, partial: [], hint: [], flash: 0 };
  shown = { key: "", anim: null, token: shown.token + 1 };
  aheadFor = { key: "", score: null };
  ready.clear();
  page.deal({ set: opts.set, you: opts.you, hot: opts.vs === "friend" && !page.atTable }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const set = SETS[opts.set];
  const jumpBack = set.menBack ? "Men jump backwards as well as forwards." : "Men step and jump forward only; a king, once crowned, goes both ways.";
  const kingLine = set.flying ? "A king flies: it moves any distance along a diagonal, and jumps a piece at any distance, landing on any empty square beyond it." : "A king moves and jumps one square at a time, in any diagonal direction.";
  const most = set.most ? "If there is a choice of jumps you must take the route that captures the most pieces." : "If there is a choice of jumps you may take any route, not necessarily the longest.";
  const crown = set.crown === "stop" ? "A man that reaches the far row in the middle of a jump is crowned and the move ends there." : set.crown === "pass" ? "A man that only passes over the far row in the middle of a jump is not crowned; it is crowned only if its move ends there." : "A man that reaches the far row in the middle of a jump is crowned at once and goes on jumping as a king.";
  $("rulesBody").innerHTML = `
    <p>${esc(set.blurb)}</p>
    <h3>The board</h3>
    <p>Pieces stay on the dark squares. Ink starts at the bottom (from the first game's view) and moves first; each side has ${set.rows * set.size / 2} men on the ${set.rows} rows nearest it. The dark square is at each player's left.</p>
    <h3>A move</h3>
    <p>A man steps one square diagonally forward to an empty dark square. ${esc(kingLine)}</p>
    <h3>Jumping</h3>
    <p>A piece jumps by passing over an enemy piece on the next square, landing on the empty square just beyond, and the enemy piece is taken. ${esc(jumpBack)} <b>A jump is compulsory</b>: if you can jump, you must. If your piece can jump again from where it lands, it must go on, and the whole run is one move. ${esc(most)} Pieces taken in a run come off the board only when the run ends, and none is jumped twice.</p>
    <h3>Crowning</h3>
    <p>A man that ends its move on the far row is crowned and becomes a king, shown by a second disc and a brass crown. ${esc(crown)}</p>
    <h3>Winning</h3>
    <p>You win when the other side has no move: every piece taken, or what is left is blocked. The game is drawn when the same position comes up a third time, or when ${set.quiet / 2} moves each go by without a capture or a man moving.</p>
    <h3>Here</h3>
    <p class="cr-rules-note">Tap a piece, then the square it goes to. A ringed piece must jump (Settings can hide the rings). In a run of several jumps, tap each landing square, or just the last when there is only one route. Take back undoes your move and the reply; Hint shows the computer's choice on Hard.</p>`;
  $("rulesDlg").showModal();
}

const course = createCourse({
  id: "crown", course: COURSE, cls: "cr", inFrame: IN_FRAME, onRules: showRules, stage: boardStage(),
  onPlay: step => {
    const level = step?.level || "easy", name = LEVEL_NAMES.find(([k]) => k === level)?.[1] || level;
    if (page.atTable) { toast(`Your table plays on: try a game against ${name} when you're back to solo`); return; }
    opts.level = level;
    if (step?.set && SETS[step.set]) opts.set = step.set;
    opts.vs = "computer";
    saveOpts();
    newGame();
  },
});

// The shot of the day (the menu, or the games screen's tile): one puzzle a day from the bank, a sacrifice that wins, on the
// course sheet as a lesson of one step; the first solve's time is what the games screen shows (noteDayTime).
const DAY = dayCourse(today(), opts.set);
const dayShot = DAY && createCourse({
  id: "crown-day", course: DAY, cls: "cr", inFrame: IN_FRAME,
  stage: boardStage({ onSolved: (step, st) => { if (step.daily && !IN_FRAME) noteDayTime("crown", (Date.now() - (st.started || Date.now())) / 1000); } }),
});
const shotDone = () => read("crown:today", null)?.key === today();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("crown", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Crown, from the rules", () => course.open()));
  if (dayShot) play.append(action(shotDone() ? "The shot of the day: solved" : "The shot of the day", () => dayShot.open(DAY.chapters[0].lessons[0].id)));
  play.append(action("The rules on one page", showRules, "link"));
  const content = part(body, "content");
  content.append(choice("Rules", SET_IDS.map(id => [id, SETS[id].name]), opts.set, v => { opts.set = v; saveOpts(); }));
  content.append(line(`${SETS[opts.set].blurb}`));
  if (!page.atTable) {
    content.append(choice("Play against", [["computer", "The computer"], ["friend", "A friend on this phone"]], opts.vs, v => { opts.vs = v; saveOpts(); }));
    content.append(choice("You play", [["ink", "Ink (first)"], ["ivory", "Ivory"], ["swap", "Each in turn"]], opts.you, v => { opts.you = v; saveOpts(); }));
  }
  const set = part(body, "settings");
  set.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line("The rules, colours and opponent apply from the next game."));
  set.append(toggle("Ring the pieces that must jump", opts.mark, on => { opts.mark = on; saveOpts(); draw(); }));
  set.append(toggle("Show who is ahead", opts.ahead, on => { opts.ahead = on; saveOpts(); aheadFor = { key: "", score: null }; if (V) work(V); draw(); }));
  set.append(toggle("Label the files and ranks", opts.labels, on => { opts.labels = on; saveOpts(); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0, drawn: 0 }), st = read("crown:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${r.drawn ? `, ${r.drawn} drawn` : ""}${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "crown");
document.querySelector(".cr-mark-ico").innerHTML = APPS.find(a => a.id === "crown")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => { if (V) drawBoard(); });
window.__crown = { page, get view() { return V; }, opts, course, ready, get ui() { return ui; } };
const forToday = arrivedForToday();      // from the games screen's tile: today's shot is still to play
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
if (forToday && dayShot && !page.atTable) dayShot.open(DAY.chapters[0].lessons[0].id);
draw();
