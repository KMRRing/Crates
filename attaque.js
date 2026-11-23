// L'Attaque for two: against the computer, two on one phone, or a partner's table. The moves are attaque-board.js's, the game
// on seats.js attaque-rules.js's, the computer attaque-ai.js's (it thinks in a worker, attaque-worker.js, while the board stays
// alive). This page draws the board through the eyes of the side playing here (attaque-draw.js): your pieces show their ranks,
// the other side's only what an attack or a Scout's run has shown. A game starts with each side setting up its army (tap two
// of your pieces to swap them; Shuffle deals another; Ready puts it in), the last army you used kept for the next game; then a
// piece is tapped and then where it goes. Two on one phone, a cover hides the board between turns.
import { rules, ready, readyKey, sideOfSeat, seatOfSide, viewOf, QUIET, TWO_SQUARE } from "./attaque-rules.js";
import { ARMY, COUNT, NAMES, SIDES, FLAG, SCOUT, KCH, validSetup, randomSetup, setupOf, placeSquare, placeOf, positionOf, movesOf, bannedOf, movable } from "./attaque-board.js";
import { LEVEL_NAMES, think } from "./attaque-ai.js";
import { createBoard, glyph } from "./attaque-draw.js";
import { seatPage } from "./seats-ui.js";
import { applyMove } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { load3d } from "./loading.js";
import { ramp } from "./ramp.js";
import { tableView } from "./table3d-view.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sure } from "./sure.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, boardStage } from "./attaque-course.js";
import { explain } from "./attaque-coach.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "attaque:opts", RECORD = "attaque:record", SETUP = "attaque:setup";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const kindOf = ch => KCH.indexOf(ch);
const at = sq => ({ f: Math.floor(sq / 100), t: sq % 100 });

// opts: the next game's opponent ("computer" or "two") and the coach (Hint on or off). The computer's strength is the ramp.
let opts = { mode: "computer", coach: "hints", ...read(OPTS, {}) };
if (!["computer", "two"].includes(opts.mode)) opts.mode = "computer";
if (!["off", "hints"].includes(opts.coach)) opts.coach = "hints";
// a lesson's game plays the level it names, once; every other game the ramp's
let lesson = null, lessonNext = null;
const rampNow = () => ramp("attaque", LEVEL_NAMES.map(([k]) => k), { start: "medium" });
const levelNow = () => lesson || rampNow();
const levelName = () => LEVEL_NAMES.find(([k]) => k === levelNow())?.[1] || "Medium";
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the computer, off the page ----------
let worker = null, workerOff = false, jobId = 0;
const jobs = new Map();
function workerSend(kind, v, side, level) {
  return new Promise(resolve => {
    if (workerOff) { resolve(null); return; }
    try {
      if (!worker) {
        worker = new Worker(new URL("./attaque-worker.js", import.meta.url), { type: "module" });
        worker.onmessage = e => { const j = jobs.get(e.data.id); jobs.delete(e.data.id); j?.(e.data); };
        worker.onerror = () => { workerOff = true; for (const j of jobs.values()) j(null); jobs.clear(); page?.runner.kick(); };
      }
      const id = ++jobId;
      jobs.set(id, resolve);
      worker.postMessage({ id, kind, state: v.state, side, level, seed: v.G.seed, n: v.G.n });
    } catch { workerOff = true; resolve(null); }
  });
}

// ---------- the game ----------
let V = null;                                   // the runner's latest view
let page = null;                                // (declared before seatPage, which hands over the saved game at once)
let drawnGame = "";
let ui = { key: "", sel: -1, hint: null, why: "" };   // the move being made: the piece picked up, the coach's move and its words
let arr = null;                                 // the army being set up on this phone: { key, side, text (as it sees it), sel (a place) }
let uncovered = -1;                             // two on one phone: the side the board was last shown to
let clashSeen = "", clashTimer = 0, wasSetting = false;
const pending = new Set();
const randomRounds = seatRounds("attaque");     // random mode's round: a game

/** Two on one phone: the second seat is a person on this phone, so the runner leaves it alone. */
const isTwo = v => !!v?.G && v.mode === "solo" && !!v.G.options?.two;
function syncTwo(v) {
  const t = page?.runner?.table;
  if (!t || !t.local) return;
  const players = t.data.players;
  if (isTwo(v)) players.p2 ||= { name: "Blue", seat: 1, online: true };
  else delete players.p2;
}
/** The side setting up on this phone now, or null. */
function arranger(v) {
  if (!v?.G || v.over || v.state.phase !== "setup") return null;
  const s = v.state;
  if (isTwo(v)) return s.rdy[0] === "0" ? 0 : s.rdy[1] === "0" ? 1 : null;
  if (v.seat == null) return null;
  const side = sideOfSeat(s, v.seat);
  return s.rdy[side] === "0" ? side : null;
}
/** The side to move when it is a person on this phone, else null. */
function mover(v) {
  if (!v?.G || v.over || v.state.phase !== "play" || v.toMove == null) return null;
  if (isTwo(v)) return v.state.t;
  return v.seat != null && v.toMove === v.seat ? v.state.t : null;
}
/** The side whose eyes the board is drawn through. */
function eyes(v) {
  if (!v?.G) return 0;
  const s = v.state;
  if (isTwo(v)) return s.phase === "setup" ? arranger(v) ?? 0 : s.t;
  return v.seat != null ? sideOfSeat(s, v.seat) : 0;
}
/** Two on one phone, the board waits under a cover until the side whose turn it is has the phone. */
const covered = v => isTwo(v) && !v.over && eyes(v) !== uncovered;
const gameKey = v => (v?.G ? `${v.G.seq}:${v.G.started}:${v.state.moves.length}:${v.state.rdy}` : "");

/** The page holds the computer's move while the worker is still finding it (so the main thread never does). */
function hold() {
  const v = V;
  if (!v?.G || v.over || workerOff || isTwo(v) || v.state.phase !== "play") return false;
  const who = v.toMove;
  return who != null && !!v.seats[who]?.bot && !ready.has(readyKey(v.state, levelNow()));
}
function work(v) {
  if (!v?.G || v.over || IN_FRAME || v.state.phase !== "play") return;
  const s = v.state, who = v.toMove, L = levelNow(), key = `m${gameKey(v)}`;
  const runsBot = who != null && v.seats[who]?.bot && !isTwo(v) && (v.mode === "solo" || v.me?.driver);
  if (!runsBot || ready.has(readyKey(s, L)) || pending.has(key)) return;
  pending.add(key);
  workerSend("move", v, sideOfSeat(s, who), L).then(r => {
    pending.delete(key);
    if (r?.code != null && !r.error) { ready.set(readyKey(s, L), r.code); page.runner.kick(); }
  });
}

// ---------- the board ----------
const board = createBoard($("board"), { onTap: sq => tap(sq) });
// Menu, View: the flat board, or the 3D one (attaque-3d.js, loaded when it is wanted: a campaign map on a walnut table, the pieces
// painted cards in brass stands). The flat board is drawn under it all the same, unseen, as the one record of the position; a
// partner's watching frame, and a device without WebGL, see the flat board.
const view = tableView("attaque", ["board", "Board"]);
let board3d = null, making3d = false;
async function make3d() {
  if (making3d || board3d) return;
  making3d = true;
  try {
    const { createBoard: create3d } = await load3d(import("./attaque-3d.js"));
    if (view.get() === "3d" && !board3d) {
      board3d = create3d($("board3"), { onTap: sq => tap(sq) !== false, onLost: () => { view.fail(); drop3d(); toast("3D stopped working here: the flat board."); draw(); } });
      if (isPaused()) board3d.hold(true);
    }
  } catch (err) {
    console.warn("L'Attaque: no 3D here, so the board is drawn flat.", err);
    view.fail();
    $("board3").replaceChildren();
  }
  making3d = false;
  draw();
}
function drop3d() { board3d?.dispose(); board3d = null; }
onPause(() => board3d?.hold(true), () => board3d?.hold(false));
function applyView() {
  const want = view.get() === "3d";
  if (want && !board3d) make3d();
  if (!want && board3d) drop3d();
  $("app").classList.toggle("at3", want && !!board3d);
}

/** The army being set up here follows the game and the side: the last army this phone used, or the one dealt. */
function syncArr(v, side) {
  if (side == null) { arr = null; return; }
  const key = `${v.G.seq}:${v.G.started}:${side}`;
  if (arr?.key === key) return;
  const saved = read(SETUP, null), mine = !isTwo(v) || side === 0;
  arr = { key, side, sel: -1, text: mine && validSetup(saved) ? saved : setupOf(v.state, side), ids: Array.from({ length: ARMY }, (_, i) => side * ARMY + i) };
}

function draw() {
  applyView();
  if (!page) return;
  const v = V, s = v?.G ? v.state : null;
  const id = v?.G ? `${v.G.seq}:${v.G.started}:${v.mode}` : "";
  let still = id !== drawnGame || !s;
  drawnGame = id;
  const key = gameKey(v);
  if (ui.key !== key) ui = { key, sel: -1, hint: null, why: "" };
  const me = eyes(v), cover = covered(v), setting = arranger(v);
  syncArr(v, setting);
  // an army put in is drawn from the game, its pieces numbered by place, not as they were shuffled about: no slide across the board
  if (wasSetting && setting == null) still = true;
  wasSetting = setting != null;
  const pieces = [];
  let legal = [], area = [], sel = -1, clash = -1, last = null;
  if (s && !cover) {
    const p = positionOf(s), reveal = !!v.over;
    for (let pid = 0; pid < 2 * ARMY; pid++) {
      const side = pid >= ARMY ? 1 : 0;
      if (p.pos[pid] < 0 || side === setting) continue;
      const mine = side === me;
      pieces.push({ id: pid, sq: p.pos[pid], side, kind: mine || reveal || p.seen[pid] ? p.kind[pid] : -1, shown: mine && !reveal && !!p.seen[pid], moved: !mine && !reveal && !p.seen[pid] && !!p.moved[pid] });
    }
    if (setting != null) {
      for (let i = 0; i < ARMY; i++) pieces.push({ id: arr.ids[i], sq: placeSquare(setting, i), side: setting, kind: kindOf(arr.text[i]) });
      area = Array.from({ length: ARMY }, (_, i) => placeSquare(setting, i));
      sel = arr.sel >= 0 ? placeSquare(setting, arr.sel) : -1;
    } else if (mover(v) != null && ui.sel >= 0) {
      sel = ui.sel;
      legal = movesOf(p, p.t, bannedOf(s.moves)).filter(m => Math.floor(m / 100) === sel).map(m => m % 100);
    }
    if (s.moves.length) last = at(s.moves[s.moves.length - 1]);
    if (s.fx && s.fx.n === s.moves.length) clash = s.fx.t;
  }
  const shown = { pieces, flip: me === 1, sel, legal, last, hint: ui.hint, clash, area, still, tap: !cover && (mover(v) != null || setting != null) };
  board.draw(shown);
  if (board3d) {
    const fx = s?.fx, fight = fx && fx.n === s.moves.length && fx.a != null && !cover ? { key: `${v.G.seq}:${v.G.started}:${fx.n}`, a: fx.a, d: fx.d, r: fx.r, t: fx.t } : null;
    board3d.set({ ...shown, fight });
  }
  drawCover(v, cover);
  drawSeats(v);
  drawStatus(v);
  drawRoster(v);
  drawControls(v);
  drawCoach(v, cover);
  drawClash(v, cover, still);
}

function nameOf(v, seat) {
  const s = v.state;
  if (isTwo(v)) return SIDES[sideOfSeat(s, seat)];
  if (v.mode === "solo") return seat === 0 ? "You" : "Computer";
  if (v.seat === seat) return "You";
  const w = v.seats?.[seat];
  return w?.name ? `${w.name}${w.bot ? " (computer)" : ""}` : "Opponent";
}
const sideName = (v, side) => nameOf(v, seatOfSide(v.state, side));
const leftOf = (s, side) => { let n = 0; for (let i = 0; i < ARMY; i++) if (s.at.slice(2 * (side * ARMY + i), 2 * (side * ARMY + i) + 2) !== "--") n++; return n; };
function drawSeats(v) {
  const far = $("far"), near = $("near");
  if (!v?.G) { far.replaceChildren(); near.replaceChildren(); return; }
  const s = v.state, me = eyes(v);
  for (const [box, side] of [[far, 1 - me], [near, me]]) {
    const turn = !v.over && s.phase === "play" && s.t === side, setting = !v.over && s.phase === "setup" && s.rdy[side] === "0";
    const comp = v.mode === "solo" && !isTwo(v) && seatOfSide(s, side) === 1;
    const sub = isTwo(v) ? "" : comp ? `${levelName()} · ${SIDES[side]}` : SIDES[side];
    box.className = `at-seat ${box.id}${turn || setting ? " turn" : ""}`;
    box.innerHTML = `<i class="at-swatch" data-side="${side}"></i><b class="at-name">${esc(sideName(v, side))}</b><small>${esc(sub)}</small>
      <span class="at-count" aria-label="${leftOf(s, side)} pieces left">${leftOf(s, side)}</span>`;
  }
}

/** The last attack in words, from the side the board is drawn for: "Your Captain took their Sergeant". */
function fightText(v) {
  const s = v.state, fx = s.fx;
  if (!fx || fx.n !== s.moves.length) return "";
  const A = NAMES[kindOf(fx.ak)], D = NAMES[kindOf(fx.dk)], me = eyes(v);
  const own = side => (isTwo(v) ? `${SIDES[side]}'s` : side === me ? "your" : "their");
  const a = `${own(fx.by)} ${A}`, d = `${own(1 - fx.by)} ${D}`;
  const text = fx.dk === "F" ? `${a} took ${d}` : fx.dk === "B" && fx.r < 0 ? `${d} blew up ${a}` : fx.r > 0 ? `${a} took ${d}` : fx.r < 0 ? `${d} stopped ${a}` : `${a} and ${d} both fell`;
  return text[0].toUpperCase() + text.slice(1);
}
function resultText(v) {
  const r = v.state.result;
  if (r.winner < 0) return "A draw";
  if (isTwo(v)) return `${SIDES[r.winner]} wins`;
  const win = seatOfSide(v.state, r.winner);
  return v.seat != null && win === v.seat ? "You win" : `${nameOf(v, win)} wins`;
}
function drawStatus(v) {
  const el = $("status");
  el.classList.remove("big");
  if (!v?.G || covered(v)) { el.textContent = ""; return; }
  const s = v.state;
  if (v.over) { el.textContent = resultText(v); el.classList.add("big"); return; }
  if (s.phase === "setup") {
    const side = arranger(v);
    if (side != null) el.textContent = `${isTwo(v) ? `${SIDES[side]}: set` : "Set"} up your army: tap two pieces to swap them`;
    else { const wait = [0, 1].find(k => s.rdy[k] === "0"); el.textContent = `${sideName(v, wait)} ${sideName(v, wait) === "You" ? "are" : "is"} setting up`; }
    return;
  }
  const who = v.toMove, fight = fightText(v);
  let text;
  if (mover(v) != null) text = isTwo(v) ? `${SIDES[s.t]} to move` : "Your move";
  else if (v.seats?.[who]?.bot && !v.seats[who].away) text = `${nameOf(v, who)} is thinking…`;
  else text = `${nameOf(v, who)} to move`;
  el.textContent = fight ? `${fight}. ${text}` : text;
}

/** The other side's army left, by rank: what every attack has shown, so what a player at the board would know. */
const ORDER = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 0];
function drawRoster(v) {
  const el = $("roster");
  if (!v?.G || covered(v)) { el.replaceChildren(); return; }
  const s = v.state, them = 1 - eyes(v), lost = Array(COUNT.length).fill(0);
  for (let i = 0; i < ARMY; i++) {
    const pid = them * ARMY + i;
    if (s.at.slice(2 * pid, 2 * pid + 2) === "--") lost[kindOf(s.pk[pid])]++;
  }
  el.dataset.side = them;
  el.innerHTML = `<small>${isTwo(v) ? SIDES[them] : "Theirs"}</small>${ORDER.map(k => {
    const n = COUNT[k] - lost[k];
    return `<span class="at-chip${n ? "" : " gone"}" title="${NAMES[k]}"><i>${glyph(k)}</i>${COUNT[k] > 1 ? `<sub>${n}</sub>` : ""}</span>`;
  }).join("")}`;
}

function drawCover(v, cover) {
  const el = $("cover");
  el.hidden = !cover;
  if (!cover) return;
  const side = eyes(v);
  el.dataset.side = side;
  el.innerHTML = `<b>${SIDES[side]}</b><span>${v.state.phase === "setup" ? "sets up" : "to move"}</span><small>Pass the phone, then tap here</small>`;
}
$("cover").addEventListener("click", () => { uncovered = eyes(V); draw(); });

/** The attack just made, as two pieces face to face for a moment over the board. */
function drawClash(v, cover, still) {
  const el = $("clash"), s = v?.G ? v.state : null, fx = s?.fx;
  if (!s || cover || !fx || fx.n !== s.moves.length) return;
  const key = `${v.G.seq}:${v.G.started}:${fx.n}`;
  if (clashSeen === key) return;
  clashSeen = key;
  if (still) return;                                               // a game opened again: the attack is old news
  const pc = (side, ch) => `<span class="at-mini" data-side="${side}">${glyph(kindOf(ch))}</span>`;
  el.innerHTML = `${pc(fx.by, fx.ak)}<i>${fx.r > 0 ? "takes" : fx.r < 0 ? "falls to" : "and"}</i>${pc(1 - fx.by, fx.dk)}${fx.r === 0 ? "<i>both fall</i>" : ""}`;
  el.classList.add("on");
  clearTimeout(clashTimer);
  clashTimer = setTimeout(() => el.classList.remove("on"), 1900);
}

// ---------- the coach ----------
const coaching = v => !IN_FRAME && !!v?.G && v.mode === "solo" && opts.coach !== "off";
/** The coach's words for its move, over their army and the buttons until the move is made or the note is tapped away (the
 *  layout never moves for it). */
function drawCoach(v, cover) {
  const el = $("coach"), show = !!ui.why && !cover && coaching(v) && !v.over;
  el.hidden = !show;
  if (!show || el.dataset.why === ui.why) return;
  el.dataset.why = ui.why;
  const head = document.createElement("b");
  head.textContent = "Coach";
  el.replaceChildren(head, document.createTextNode(ui.why));
}
$("coach").addEventListener("click", () => { ui.why = ""; draw(); });
async function hint() {
  const v = V, side = mover(v);
  if (side == null || !coaching(v)) return;
  const key = gameKey(v);
  let r = await workerSend("hint", v, side, "hard");
  if (!r || r.error) { const view = viewOf(v.state, side), code = think(view, "medium").code; r = { code, why: code == null ? "" : explain(view, code) }; }
  if (!V?.G || gameKey(V) !== key) return;
  if (r.code == null) { toast("No hint to give"); return; }
  ui.hint = at(r.code);
  ui.sel = ui.hint.f;
  ui.why = r.why || "";
  draw();
}

// ---------- moves ----------
async function move(m, seat) {
  const v = page.view;
  if (!isTwo(v)) return page.move(m);
  // two on one phone: whoever's turn it is moves, from this phone
  if (seat == null) return "";
  let why = "";
  const ok = await page.runner.table.act(cur => {
    if (!cur.game || cur.game.seq !== v.G.seq) { why = "That game has ended"; return false; }
    const r = applyMove(rules, cur.game, seat, m, Date.now());
    if (r.error) { why = r.error; return false; }
    cur.game = r.G;
  });
  return ok ? "" : why || "Couldn't make that move";
}
async function commit(code) {
  ui = { key: ui.key, sel: -1, hint: null, why: "" };
  const why = await move(code, V.toMove);
  if (why) { toast(why); draw(); }
}
function tapSetup(sq, side) {
  const i = placeOf(side, sq);
  if (i < 0) { toast("Your army sets up in your four rows"); return; }
  if (arr.sel < 0) arr.sel = i;
  else if (arr.sel === i) arr.sel = -1;
  else {
    const t = [...arr.text];
    [t[arr.sel], t[i]] = [t[i], t[arr.sel]];
    [arr.ids[arr.sel], arr.ids[i]] = [arr.ids[i], arr.ids[arr.sel]];          // the two pieces change places (they slide)
    arr.text = t.join("");
    arr.sel = -1;
  }
  draw();
}
function tap(sq) {
  const v = V;
  if (covered(v)) return false;
  const setting = arranger(v);
  if (setting != null) { tapSetup(sq, setting); return true; }
  const side = mover(v);
  if (side == null) return false;
  const s = v.state, p = positionOf(s), pid = p.board[sq], ban = bannedOf(s.moves);
  ui.hint = null;
  if (pid >= 0 && (pid >= ARMY ? 1 : 0) === side) {
    if (ui.sel === sq) { ui.sel = -1; draw(); return; }
    const k = p.kind[pid];
    if (!movable(k)) { toast(k === FLAG ? "The Flag never moves" : "A Bomb never moves"); return; }
    if (!movesOf(p, side, ban).some(m => Math.floor(m / 100) === sq)) { toast(movesOf(p, side).some(m => Math.floor(m / 100) === sq) ? TWO_SQUARE : "That piece is boxed in"); return; }
    ui.sel = sq;
    draw();
    return;
  }
  if (ui.sel < 0) { toast(pid >= 0 ? "Tap one of your own pieces first" : "Tap one of your pieces, then where it goes"); return; }
  const code = ui.sel * 100 + sq;
  if (!movesOf(p, side, ban).includes(code)) {
    toast(code === ban ? TWO_SQUARE : p.kind[p.board[ui.sel]] === SCOUT ? "A Scout runs along a line, never over a piece or a lake" : "A piece steps one square up, down or sideways");
    return;
  }
  commit(code);
}
async function readyUp() {
  const v = V, side = arranger(v);
  if (side == null) return;
  const text = arr.text;
  if (!isTwo(v) || side === 0) write(SETUP, text);
  const why = await move({ setup: text }, seatOfSide(v.state, side));
  if (why) toast(why);
}

let controlsFor = "";
function drawControls(v) {
  const box = $("controls"), setting = arranger(v) != null;
  const want = setting ? "setup" : "play";
  if (controlsFor !== want) {
    controlsFor = want;
    const list = setting ? [["shuffle", "Shuffle"], ["ready", "Ready"], ["new", "New"]] : [["hint", "Hint"], ["new", "New"]];
    box.innerHTML = list.map(([act, label]) => `<button class="btn at-btn" type="button" data-act="${act}">${label}</button>`).join("");
    box.dataset.n = list.length;
  }
  const btn = act => box.querySelector(`[data-act="${act}"]`);
  const cover = covered(v);
  if (setting) { btn("shuffle").disabled = cover || IN_FRAME; btn("ready").disabled = cover || IN_FRAME; btn("ready").classList.add("primary"); }
  else btn("hint").disabled = cover || !(coaching(v) && mover(v) != null);
  btn("new").disabled = !page.host || IN_FRAME;
  btn("new").classList.toggle("primary", !!v?.over);
}
$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "shuffle" && arr) { arr.text = randomSetup(); arr.sel = -1; draw(); }
  else if (act === "ready") readyUp();
  else if (act === "hint") hint();
  else if (act === "new") {
    if (V?.G && !V.over && V.state.moves.length > 6 && !(await sure("Start a new game? This one isn't finished.", { yes: "New game", no: "Keep playing" }))) return;
    newGame();
  }
});

// ---------- the end ----------
function onOver(v) {
  if (IN_FRAME) return;
  const s = v.state, r = s.result, mine = isTwo(v) ? null : v.seat != null && r.winner >= 0 && seatOfSide(s, r.winner) === v.seat;
  if (mine !== null && v.seat != null) {
    const rec = read(RECORD, { played: 0, won: 0, drawn: 0 });
    rec.played++;
    if (mine) rec.won++;
    if (r.winner < 0) rec.drawn++;
    write(RECORD, rec);
    noteStreak("attaque", !!mine);
    if (!page.atTable && !isTwo(v) && !lesson) { rampNow(); mine ? ramp.won(true) : r.winner >= 0 ? ramp.lost() : ramp.won(false); }
  }
  setTimeout(() => { if (V?.over && V.G === v.G) showEnd(V); }, 1400);
}
function showEnd(v) {
  const s = v.state, r = s.result, who = side => sideName(v, side), loser = 1 - r.winner;
  $("endHead").textContent = resultText(v);
  const rows = [0, 1].map(side => `<li class="${r.winner === side ? "won" : ""}"><i class="at-swatch" data-side="${side}"></i><span class="nm">${esc(who(side))}</span><b>${leftOf(s, side)}</b></li>`);
  const note = r.why === "flag" ? `${who(r.winner)} took the Flag.` : r.why === "stuck" ? (r.winner < 0 ? "Neither side had a piece that could move." : `${who(loser)} had no piece that could move.`)
    : r.why === "quiet" ? `${QUIET} moves went by without an attack.` : r.why === "resign" ? `${who(loser)} resigned.` : "";
  $("endBody").innerHTML = `<ol class="at-tally">${rows.join("")}</ol><p class="at-end-note">${esc(note)} ${s.moves.length} move${s.moves.length === 1 ? "" : "s"}. The figures are pieces left; the board now shows both armies.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  lesson = lessonNext; lessonNext = null;
  ui = { key: "", sel: -1, hint: null, why: "" };
  arr = null;
  ready.clear();
  const two = opts.mode === "two" && !page.atTable;
  uncovered = two ? 0 : -1;
  page.deal({ colour: two || page.atTable ? "red" : "either", two }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endBoard").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const k = n => `<span class="at-mini" data-side="0">${glyph(n)}</span>`;
  $("rulesBody").innerHTML = `
    <p>L'Attaque (1909) is the game Stratego grew from: two armies, each hidden from the other, and the first to take the other's Flag wins. This is played by today's tournament rules.</p>
    <h3>The armies</h3>
    <p>Each side has forty pieces, the higher rank beating the lower: ${k(10)} Marshal, ${k(9)} General, ${k(8)} Colonels (2), ${k(7)} Majors (3), ${k(6)} Captains (4), ${k(5)} Lieutenants (4), ${k(4)} Sergeants (4), ${k(3)} Miners (5), ${k(2)} Scouts (8) and ${k(1)} the Spy; and six ${k(11)} Bombs and ${k(0)} the Flag, which never move.</p>
    <h3>Setting up</h3>
    <p>Each side sets up in its own four rows, the other side seeing only the backs. Tap two of your pieces to swap them, Shuffle for another army, and Ready when it suits you. Your last army is kept for the next game.</p>
    <h3>Moving</h3>
    <p>Red begins. A piece steps one square up, down or sideways, never into a lake or onto its own side. A Scout runs any distance along a line, as far as the first piece or lake, and may attack at the end of its run. A piece may not go back and forth between the same two squares a fourth time running.</p>
    <h3>Attacks</h3>
    <p>Moving onto an enemy piece attacks it, and both are shown. The lower rank is taken; equal ranks are both taken. The Spy takes the Marshal if the Spy attacks (attacked, it falls to anything). A Bomb takes any piece that attacks it, except a Miner, which takes the Bomb.</p>
    <h3>The end</h3>
    <p>Taking the Flag wins. A side that cannot move on its turn loses. ${QUIET} moves without an attack make a draw.</p>
    <h3>Here</h3>
    <p class="at-rules-note">Tap a piece, then a marked square. Your pieces the other side has seen are outlined; their pieces that have moved (so are no Bomb or Flag) carry a bar. The row under the board is their army left. Hint asks the coach for a move, and says why (tap its note to put it away). The computer plays harder as you win and easier as you lose.</p>`;
  $("rulesDlg").showModal();
}

function showAbout() {
  $("aboutBody").innerHTML = `
    <p>Everything is worked out on this phone: nothing is sent anywhere, and it plays offline.</p>
    <h3>Hard, and the coach</h3>
    <p>Ataraxos's player: a neural network (a transformer of 8 layers, about 15 million weights) trained by playing Stratego against itself, from the Ataraxos project of Carnegie Mellon and other universities (Nature, 2026). It is the trained policy alone, without the search the project adds on top of it: it reads what its side has seen of the game (where every piece started, which have moved, what each attack showed, and which pieces have chased, run from or guarded which) and draws its move from the odds it gives each, so it can't be read; the coach gives you the move it rates highest. Its weights are kept here in 8 bits each (13.5 MB). The arithmetic is our own; the project's code and weights are MIT licensed:</p>
    <pre>Copyright (c) 2023 Gabriele Farina
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. See vendor/ataraxos/LICENSE.txt for the whole text.</pre>
    <h3>Easy and Medium</h3>
    <p>Our own search: it deals your hidden pieces many times over, each deal one the board allows, looks a few moves ahead in each, and plays the move that does best across them.</p>`;
  $("aboutDlg").showModal();
}

const course = createCourse({
  id: "attaque", course: COURSE, cls: "at", inFrame: IN_FRAME, onRules: showRules, stage: boardStage(),
  onPlay: step => {
    if (page.atTable) { toast("Your table plays on: try a game against Easy when you're back to solo"); return; }
    opts.mode = "computer";
    lessonNext = step?.level || "easy";
    saveOpts();
    newGame();
  },
});

function openMenu() {
  rampNow();                                      // the shared level row is for the ramp read last: this game's
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("attaque", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn L'Attaque, from the rules", () => course.open()));
  if (!IN_FRAME) play.append(action("The rules on one page", showRules, "link"));
  if (V?.G && !V.over && !IN_FRAME && (isTwo(V) || V.seat != null)) {
    play.append(action("Resign", async () => {
      if (!(await sure("Resign this game?", { yes: "Resign", no: "Keep playing" }))) return;
      const v = V, seat = isTwo(v) ? seatOfSide(v.state, eyes(v)) : v.seat;
      const why = await move({ resign: true }, seat);
      if (why) toast(why);
    }, "link"));
  }
  const content = part(body, "content");
  content.append(choice("Opponent", [["computer", "Computer"], ["two", "Two on this phone"]], opts.mode, v => { opts.mode = v; saveOpts(); }));
  const set = part(body, "settings");
  set.append(view.choice(() => draw()));
  set.append(line("The opponent applies from the next game."));
  set.append(toggle("Coach", opts.coach !== "off", on => { opts.coach = on ? "hints" : "off"; saveOpts(); ui.hint = null; ui.why = ""; draw(); }));
  const r = read(RECORD, { played: 0, won: 0, drawn: 0 }), st = read("attaque:streak", { now: 0, best: 0 });
  const about = part(body, "about");
  about.append(line(r.played ? `Won ${r.won} of ${r.played} games against the computer or a friend${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  about.append(action("About the computer", showAbout, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the page on its runner ----------
// (last: seatPage hands over the saved game at once, and everything the first view draws must exist by then)
page = seatPage({
  rules, id: "attaque", app: 1, pace: 600, botName: () => "Computer", level: () => levelNow(), voice: () => false,
  onView: v => { V = v; syncTwo(v); draw(); work(v); randomRounds(v); },
  onOver, toast, newGame, hold,
});
syncTwo(page.view);
page.runner.update();

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "attaque");
document.querySelector(".at-mark").innerHTML = APPS.find(a => a.id === "attaque")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("aboutClose").addEventListener("click", () => $("aboutDlg").close());
window.__attaque = { page, get view() { return V; }, opts, board, get board3d() { return board3d; }, course, get ui() { return ui; }, get arr() { return arr; }, ready };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
