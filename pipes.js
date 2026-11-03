// Pipes: Pipe Dream's game on a board (pipes-engine.js), and the descent in 3D (pipes-deep.js, drawn by
// pipes-3d.js). The board plays two ways: Plan, where the oil moves a square for each piece you lay and nothing runs on
// a clock, and Rush, Pipe Dream's own, where it does. This file draws the board and the queue, takes taps and keys,
// runs the clock, keeps the runs and the bests, and plays a match for everyone at the table on the same seed (duel.js).
import * as B from "./pipes-engine.js";
import * as G from "./pipes-deep.js";
import { createShaftView } from "./pipes-3d.js";
import { el, T, MID, channel, drawPipe, drawGround, drawSource, drawTerminal, pieceTile } from "./pipes-draw.js";
import { createPuzzle } from "./pipes-puzzle-ui.js";
import { STAR_LIFTS } from "./pipes-puzzle.js";
import { sure } from "./sure.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
import { today, IN_FRAME } from "./suite.js";           // the day, the same for everyone (UTC); a partner watching's frame
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";

const $ = id => document.getElementById(id);
const KEY = { flat: "pipes:flat", plan: "pipes:plan", deep: "pipes:deep", prefs: "pipes:prefs", best: "pipes:best", daily: "pipes:daily" };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const num = v => Math.round(v).toLocaleString("en-GB");
const signed = v => `${v < 0 ? "−" : "+"}${num(Math.abs(v))}`;
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- the state ----------
// prefs: the mode on show ("flat", the board; "deep", the shaft in 3D), how the board plays (flow: "plan" or "rush"), the
// pace (1, Normal; 1.5 or 2, the countdown and the oil taking that many times as long: Rush's and 3D's) and a match's
// length on the board (levels; 0: till the spill). Each mode, and each flow of the board, keeps its own run, so trying
// another leaves yours where it was.
let prefs = { mode: "flat", flow: "plan", length: 0, pace: 1, ...read(KEY.prefs, {}) };
const FLOWS = [["plan", "Plan"], ["rush", "Rush"]];
const flowOf = v => (v === "rush" ? "rush" : "plan");
const keyOf = f => (f === "plan" ? KEY.plan : KEY.flat);     // Rush keeps the board's first key: its runs and bests were Pipes' only ones
let flow = flowOf(prefs.flow);                              // how the board on show plays
const planned = () => F?.flow === "plan";
const PACES = [[1, "Normal"], [1.5, "Slower"], [2, "Slowest"]];
const paceName = p => (PACES.find(([v]) => v === p) || PACES[0])[1];
/** The pace a new game plays at: a match's own, else yours. */
const paceNow = () => (match ? match.pace || 1 : PACES.some(([v]) => v === prefs.pace) ? prefs.pace : 1);
const MODES = [["puzzle", "Puzzle"], ["flat", "Board"], ["deep", "3D"]];
const modeOf = v => (v === "deep" || v === "puzzle" ? v : "flat");
let mode = modeOf(prefs.mode);          // "puzzle" (levels to fit, pipes-puzzle-ui.js), "flat" (the board) or "deep" (the shaft)
// the board's run: { v, kind: "random" | "daily" | "duel", seed, flow ("plan"; a run with none is Rush's), pace (as it's played now) and slowest (the slowest it
// was played at, which its score counts under), n (the level), total (the levels' points before this one's, or with it
// once it's over), phase: "play" | "done" (a level cleared, its card up) | "over", P (the level: pipes-engine.js; kept
// once it's over, so the card stands over the board as it ended), last (how the level went), at }; in Plan also sel (the
// square tapped once, the piece shown there ghosted), snaps (the level so far before each of the last few pieces, for
// Undo) and running (Run the oil under way); all kept with the run, so a partner watching sees what you see. L is its level
let F = null, L = null;
// the descent: { v, kind, seed, slowest, D (pipes-deep.js, its pace in it), phase: "play" | "over", at }; S its shaft
let R = null, S = null;
let match = null;            // a match being played here: { mode, seed, length, pace, flow }
let turns = 0;               // quarter turns given the piece in hand: the 3D view swings the piece round only for these
let view = null;             // the 3D view, made the first time the shaft shows
let raf = 0, last = 0, held = false;

const save = () => {
  const now = Date.now();
  if (F) F.at = now;
  if (R) R.at = now;
  if (match) { duel.keep({ match, F, R }); tell(); return; }
  if (mode === "flat" && F) write(keyOf(F.flow), F);
  if (mode === "deep" && R) write(KEY.deep, R);
};
let savedAt = 0;
const saveSoon = () => { const now = performance.now(); if (now - savedAt > 1000) { savedAt = now; save(); } };

// ---------- the board's run ----------
/** How a new board plays: a match's own, else yours. */
const flowNow = () => (match ? flowOf(match.flow) : flow);
function startFlat(kind, seed = kind === "daily" ? today() : randomSeed(), how = flowNow()) {
  const plan = how === "plan", pace = plan ? 1 : paceNow();      // Plan has no clock to slow
  L = B.deal(seed, 1, pace);
  F = { v: 2, kind, seed, ...(plan ? { flow: "plan" } : {}), pace, slowest: pace, n: 1, total: 0, phase: "play", P: B.newPlay(L, plan), at: Date.now() };
  showFlat(true);
  save();
}
function nextLevel() {
  if (F.phase !== "done") return;
  F.n++;
  L = B.deal(F.seed, F.n, F.pace || 1);
  F.P = B.newPlay(L, planned());
  F.phase = "play";
  delete F.sel; delete F.snaps; delete F.running;
  showFlat(true);
  save();
}
/** A level over: its points go to the run; cleared, the next level waits behind the card; spilled short of the quota,
 *  the run is over (as a match's is after its last level). */
function levelOver() {
  const P = F.P, pts = B.pointsOf(P);
  F.last = { n: F.n, pts: { ...P.pts }, total: pts, win: P.over.win, why: P.over.why, count: P.count, quota: L.quota, blasts: P.blasts,
    unused: P.pts.unused / B.POINTS.unused };
  F.total += pts;
  F.phase = P.over.win && !(match?.length && F.n >= match.length) ? "done" : "over";
  if (!P.over.win) navigator.vibrate?.([60, 40, 60]);
  delete F.sel; delete F.running;
  if (F.phase === "over" && !match) noteBest(planned() ? "plan" : "flat", { score: F.total, level: F.n }, F.slowest || 1);
  save();
  if (F.phase === "over") tell(true);
  if (!match) roundOver("pipes");                          // a level over: cleared (the next waits) or the run with it
}

// ---------- the descent ----------
function startDeep(kind, seed = kind === "daily" ? today() : randomSeed()) {
  const pace = paceNow();
  R = { v: 2, kind, seed, slowest: pace, D: G.newDescent(seed, pace), phase: "play", at: Date.now() };
  S = G.shaftOf(seed);
  R.D.turn = G.firstTurn(S, R.D);
  view?.reset();
  showDeep(true);
  save();
}
function descentOver() {
  R.phase = "over";
  navigator.vibrate?.([60, 40, 60]);
  if (!match) noteBest("deep", { score: G.scoreOf(R.D), depth: G.depthOf(R.D) }, R.slowest || 1);
  save();
  tell(true);
  if (!match) roundOver("pipes");
}

// ---------- bests: by mode and pace, and today's ----------
// kept as { plan, flat (Rush's), deep, "flat:slower", "deep:slowest", … }: a slower game is an easier one, so it keeps a
// best of its own (the games screen shows the highest of them)
const paced = (m, pace) => (pace > 1 ? `${m}:${paceName(pace).toLowerCase()}` : m);
/** A run's end, against the best of its mode at the slowest pace it was played at, and today's if it was today's. */
function noteBest(m, result, pace) {
  if (IN_FRAME) return;
  const k = paced(m, pace), best = read(KEY.best, {}) || {};
  if (!best[k] || result.score > best[k].score) { best[k] = result; write(KEY.best, best); }
  const run = m === "deep" ? R : F;
  if (run.kind === "daily" && run.seed === today()) {
    const d = read(KEY.daily, {}) || {}, day = d[today()] || {};
    if (!day[k] || result.score > day[k].score) { day[k] = result; d[today()] = day; write(KEY.daily, d); }
  }
}
const bestOf = (m, pace = 1) => (read(KEY.best, {}) || {})[paced(m, pace)] || null;
const todayOf = (m, pace = 1) => ((read(KEY.daily, {}) || {})[today()] || {})[paced(m, pace)] || null;
/** The pace changed in the menu: your next game plays at it, and so does the one under way, from now (its score then
 *  counts under the slowest pace it was played at). In a match the pace is the match's: it's for the next one. */
function setPace(v) {
  prefs.pace = v; write(KEY.prefs, prefs);
  if (match || IN_FRAME) return;
  if (F && F.phase !== "over" && !planned()) {
    F.pace = v; F.slowest = Math.max(F.slowest || 1, v);
    L = B.deal(F.seed, F.n, v);
  }
  if (R && R.phase !== "over") { R.D.pace = v; R.slowest = Math.max(R.slowest || 1, v); }
  save();
  if (mode === "flat") { flatKey = ""; drawFlatHud(); } else { statusKey = ""; drawDeepStatus(); }
}

// ---------- the clock ----------
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min(100, now - last) : 0;
  last = now;
  step(dt, now);
}
/** The game on by dt ms: the board's level or the descent, and what shows of it. */
function step(dt, now = performance.now()) {
  // a watching frame holds still while your partner's game does (their menu open, their app out of sight)
  if (IN_FRAME && (mode === "flat" ? F : R)?.still) dt = 0;
  if (mode === "flat") {
    if (planned()) { if (F.running && F.phase === "play" && F.P && !F.P.over) runOn(dt); }
    else if (F?.phase === "play" && F.P && !F.P.over) {
      const P = F.P, cells = P.path.length, pts = B.pointsOf(P), flowing = P.flowing;
      B.advance(L, P, dt);
      if (P.path.length !== cells || P.flowing !== flowing) { drawPathCells(cells); drawRoute(); saveSoon(); }
      if (B.pointsOf(P) !== pts) popPoints(P, pts);
      drawOil();
      drawFlatHud();
      if (P.over) { levelOver(); showFlat(false); }
    }
  } else if (mode === "deep" && R && S) {                      // the puzzle has no clock
    if (R.phase === "play" && !R.D.over) {
      const D = R.D, i = D.oil.i, was = G.depthOf(D);
      G.advance(S, D, dt);
      if (D.oil.i !== i) { drawDeepHud(); saveSoon(); }
      if (Math.floor(G.depthOf(D) / 100) > Math.floor(was / 100) && !IN_FRAME) toast(`${num(G.depthOf(D))} m down`, 1200);
      if (D.over) { descentOver(); showDeep(false); }
      else drawDeepStatus();
    }
    view?.draw(S, R.D, { ghost: ghostOf(), now, turns });
  }
}
function run() { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); }
/** Time gone by while nobody was looking: a match's clock (which doesn't stop), or a partner's game as a watching
 *  frame picks it up (at most half a minute: an older copy is a player who has gone). The engines walk a long step
 *  piece by piece exactly as short ones, so it's one step, then one drawing. */
function catchUp(ms) {
  if (IN_FRAME) ms = Math.min(ms, 30000);
  if (!(ms > 0)) return;
  if (mode === "flat" && F?.phase === "play" && F.P && !F.P.over && !planned()) {
    B.advance(L, F.P, ms);
    if (F.P.over) levelOver();
    showFlat(false);
  } else if (mode === "deep" && R?.phase === "play" && !R.D.over) {
    G.advance(S, R.D, ms);
    if (R.D.over) descentOver();
    showDeep(false);
  }
  if (match) save();
}

// ---------- the board, drawn ----------
/** A square of the board drawn afresh: its ground, what's fixed there or laid, the oil in it (each channel it has
 *  passed full, the one it's in now as far as it has come), and over them what stands on the square. */
function drawCell(c) {
  const g = cellG[c];
  if (!g) return;
  g.replaceChildren();
  const fixed = L.cells[c], P = F.P, head = P?.path.length ? P.path[P.path.length - 1] : null;
  const oil = test => () => {
    for (const s of P?.path || []) {
      if (s.c !== c || !test(s)) continue;
      const { d, len } = channel(s.a, s.b), now = s === head && !P.over;
      const n = el("path", { d, class: "oil", "stroke-width": 9, "stroke-dasharray": `${len} ${len}`, "stroke-dashoffset": now ? len * (1 - P.p) : 0 }, g);
      if (now) { n.dataset.head = "1"; n.dataset.len = len; }
    }
  };
  const inChannel = piece => i => oil(s => B.channelOf(piece, s.a)?.i === i)();
  drawGround(g, fixed?.k === "rock");
  if (fixed?.k === "rock") return;
  if (fixed?.k === "source") drawSource(g, fixed.d, oil(s => s.a < 0));
  else if (fixed?.k === "terminal") drawTerminal(g, fixed.d);
  else if (fixed?.k === "pump" || fixed?.k === "tank") {
    drawPipe(g, fixed.piece, inChannel(fixed.piece));
    if (fixed.k === "pump") {
      el("circle", { cx: MID, cy: MID, r: 13, class: "fixed-mark" }, g);
      el("path", { d: fixed.piece === "h" ? "M25 24 l10 6 l-10 6 z" : "M24 25 l6 10 l6 -10 z", fill: "#fff" }, g);
    } else el("rect", { x: fixed.piece === "h" ? 12 : 17, y: fixed.piece === "h" ? 17 : 12, width: fixed.piece === "h" ? 36 : 26, height: fixed.piece === "h" ? 26 : 36, rx: 8, class: "tank-body" }, g);
  } else {
    if (P?.grid[c]) drawPipe(g, P.grid[c], inChannel(P.grid[c]));
    if (c === pickedSquare()) {
      // Plan's first tap: the piece as it would lie, faint, and a frame (red where laying it ends the level in a spill)
      const out = outcome();
      drawPipe(el("g", { class: "ghost" }, g), B.pieceAt(L, P.next));
      el("rect", { x: 3, y: 3, width: T - 6, height: T - 6, rx: 8, class: `pick${out.over && !out.over.win ? " bad" : P.grid[c] ? " blast-pick" : ""}` }, g);
    }
  }
}
let cellG = [];
function buildBoard() {
  const board = $("board");
  const svg = el("svg", { viewBox: `0 0 ${B.COLS * T} ${B.ROWS * T}`, role: "img", "aria-label": "The board" });
  cellG = [];
  // each square's drawing sits in a group inside the one that puts it in place: a blast's animation transforms the
  // inner one, which would otherwise replace the placing (the square jumped to the board's corner while it played)
  for (let c = 0; c < B.COLS * B.ROWS; c++) { const [x, y] = B.xy(c); cellG.push(el("g", {}, el("g", { transform: `translate(${x * T} ${y * T})` }, svg))); }
  el("g", { class: "overlay" }, svg);
  el("g", { class: "pops" }, svg);
  // a square is taken by where the finger lands (a tap on a phone isn't always delivered to the shape under it); at
  // once, on the finger going down, as an arcade game must
  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    const r = svg.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * B.COLS), y = Math.floor((e.clientY - r.top) / r.height * B.ROWS);
    if (x >= 0 && y >= 0 && x < B.COLS && y < B.ROWS) tapSquare(y * B.COLS + x);
  });
  svg.addEventListener("contextmenu", e => e.preventDefault());
  board.replaceChildren(svg);
  for (let c = 0; c < cellG.length; c++) drawCell(c);
}
/** The squares the oil has moved into since `from` (and the one it left), drawn afresh. */
function drawPathCells(from) {
  const P = F.P;
  for (let i = Math.max(0, from - 1); i < P.path.length; i++) drawCell(P.path[i].c);
}
/** Each frame: the oil in the square it's filling, a little further on. */
function drawOil() {
  const P = F.P;
  if (!P?.flowing) return;
  const n = $("board").querySelector("path[data-head]");
  if (n) n.setAttribute("stroke-dashoffset", Number(n.dataset.len) * (1 - P.p));
}
/** The way the oil will go as the board stands, dashed, and where it would spill: the square to fill next ringed, or a
 *  red cross where it would run out. */
function drawRoute() {
  const layer = $("board").querySelector(".overlay");
  if (!layer) return;
  layer.replaceChildren();
  const P = F.P;
  if (!P || P.over || F.phase !== "play") return;
  // with a square picked, the route as it would run with the piece laid there
  const c = pickedSquare(), shown = c < 0 ? P : { ...P, grid: P.grid.map((x, i) => (i === c ? B.pieceAt(L, P.next) : x)) };
  const a = B.ahead(L, shown);
  routeEnd = a.end; routeCells = a.cells.length;
  for (const s of a.cells) {
    const [x, y] = B.xy(s.c);
    el("path", { d: channel(s.a, s.b).d, class: "route", transform: `translate(${x * T} ${y * T})` }, layer);
  }
  const at = a.end.c, [x, y] = B.xy(at);
  if (a.end.why === "open") el("rect", { x: x * T + 4, y: y * T + 4, width: T - 8, height: T - 8, rx: 8, class: "next" }, layer);
  else if (a.end.why === "terminal") el("rect", { x: x * T + 3, y: y * T + 3, width: T - 6, height: T - 6, rx: 8, class: "next", style: "stroke: var(--pi-good)" }, layer);
  else {
    // the edge: a cross on the board's rim past the last square; otherwise on the square that stops it
    let cx = x * T + MID, cy = y * T + MID;
    if (a.end.why === "edge") { const lastS = a.cells.length ? a.cells[a.cells.length - 1] : P.path.length ? P.path[P.path.length - 1] : { c: L.source.c, b: L.source.d }; cx += B.DIRS[lastS.b][0] * (MID - 6); cy += B.DIRS[lastS.b][1] * (MID - 6); }
    el("path", { d: `M${cx - 8} ${cy - 8}L${cx + 8} ${cy + 8}M${cx + 8} ${cy - 8}L${cx - 8} ${cy + 8}`, class: "spill-x" }, layer);
  }
  routeLength = a.length;
}
let routeLength = 0, routeEnd = null, routeCells = 0;     // the route drawn: its pipe, where it ends and the pieces between the oil and that end
/** Points rising off the square they were made in: a crossing passed both ways, a pump, the terminal. */
function popPoints(P, before) {
  const layer = $("board").querySelector(".pops"), gained = B.pointsOf(P) - before;
  const s = P.path[P.path.length - (P.over ? 1 : 2)] || P.path[P.path.length - 1];
  if (!layer || !s || gained <= B.POINTS.pipe * 2) return;
  const [x, y] = B.xy(P.over?.why === "terminal" ? P.over.c : s.c);
  const t = el("text", { x: x * T + MID, y: y * T + MID + 5, "text-anchor": "middle", "font-size": 15, class: "pop" }, layer);
  t.textContent = signed(gained);
  t.addEventListener("animationend", () => t.remove());
}
/** A tap on a square: the next piece laid there (or over a piece of yours, a blast). In Plan the first tap picks the
 *  square, showing the piece there and the route that would follow, and a second on the same square lays it. */
function tapSquare(c) {
  if (IN_FRAME || mode !== "flat" || F?.phase !== "play" || !F.P || F.P.over || F.running) return;
  const P = F.P;
  if (planned() && F.sel !== c) {
    if (L.cells[c]) return pickSquare(-1);
    if (B.oiled(P, c)) { toast("The oil's in that one"); return pickSquare(-1); }
    return pickSquare(c);
  }
  const before = P.path.length, pts = B.pointsOf(P);
  if (planned()) snap();
  const r = B.place(L, P, c);
  if (r === "laid" || r === "blast") {
    if (planned()) delete F.sel;
    drawCell(c);
    if (r === "blast") {
      cellG[c].classList.remove("blast"); void cellG[c].getBBox(); cellG[c].classList.add("blast");
      toast(`Blasted: ${signed(B.POINTS.blast)}`, 1200);
      navigator.vibrate?.(25);
    }
    if (planned()) {
      drawPathCells(before);
      popPoints(P, pts);
      drawOil();
    }
    drawQueue(true);
    drawRoute();
    drawFlatHud();
    if (P.over) { levelOver(); showFlat(false); } else save();
  } else {
    if (planned()) F.snaps.pop();
    if (r === "oil") toast("The oil's in that one");
    else if (r === "busy") toast("A blast going off: a moment");
  }
}

// ---------- Plan: picking a square, taking a piece back, running the oil ----------
/** The square tapped once, while a piece can be laid there (-1: none). */
const pickedSquare = () => (planned() && F.phase === "play" && F.P && !F.P.over && !F.running && F.sel >= 0 ? F.sel : -1);
/** The level as laying the next piece on the picked square would leave it: a copy, nothing is laid. */
function outcome() {
  const c = pickedSquare();
  if (c < 0) return null;
  const Q = JSON.parse(JSON.stringify(F.P));
  B.place(L, Q, c);
  return { over: Q.over };
}
function pickSquare(c) {
  const was = F.sel ?? -1;
  if (c === was) return;
  if (c < 0) delete F.sel; else F.sel = c;
  if (was >= 0) drawCell(was);
  if (c >= 0) drawCell(c);
  drawRoute();
  drawFlatHud();
  save();
}
/** The level as it stands, before a piece goes down: what Undo takes back to (the last few only). */
function snap() {
  const { undos, ...rest } = F.P;
  F.snaps = [...(F.snaps || []), JSON.stringify(rest)].slice(-B.UNDOS);
}
function undo() {
  if (IN_FRAME || mode !== "flat" || !planned() || F.phase !== "play" || F.running || !F.P || F.P.over || !F.P.undos || !F.snaps?.length) return;
  F.P = { ...JSON.parse(F.snaps.pop()), undos: F.P.undos - 1 };
  delete F.sel;
  showFlat(false);
  save();
}
let runAcc = 0, runEvery = 100;
/** Run the oil: once the route as laid clears the level, the oil is let go along it to the end. */
function runTheOil() {
  const P = F?.P;
  if (IN_FRAME || mode !== "flat" || !planned() || F.phase !== "play" || !P || P.over || F.running || !B.winsNow(L, P)) return;
  const was = F.sel ?? -1;
  delete F.sel;
  if (!P.flowing) P.lead = 1;
  if (reduced()) B.runOut(L, P);
  else { F.running = true; runAcc = 0; runEvery = Math.max(40, Math.min(140, 3200 / (B.ahead(L, P).cells.length + 1))); }
  if (was >= 0) drawCell(was);
  if (P.over) { drawPathCells(0); drawRoute(); levelOver(); showFlat(false); return; }
  drawRoute();
  drawFlatHud();
  save();
}
/** The oil walking the route, a square every runEvery ms. */
function runOn(dt) {
  const P = F.P;
  runAcc += dt;
  while (runAcc >= runEvery && !P.over) {
    runAcc -= runEvery;
    const cells = P.path.length, pts = B.pointsOf(P);
    B.beat(L, P);
    drawPathCells(cells);
    if (B.pointsOf(P) !== pts) popPoints(P, pts);
  }
  drawOil();
  drawRoute();
  drawFlatHud();
  if (P.over) { levelOver(); showFlat(false); } else saveSoon();
}

// ---------- the queue ----------
// a 3D piece in the queue: its shape as it would go down the shaft
const SHAPES3 = { straight: "M20 3V37", long: "M20 1V39M14 20H26", elbow: "M20 3V16Q20 26 30 26H38", jog: "M13 2V13Q13 20 20 20Q27 20 27 27V38" };
function piece3Tile(kind, first, label) {
  const box = document.createElement("span");
  box.className = `pi-q${first ? " first" : ""}${kind ? "" : " empty"}`;
  if (kind) {
    const svg = el("svg", { viewBox: "0 0 40 40", "aria-hidden": "true" });
    const d = SHAPES3[kind];
    el("path", { d, fill: "none", stroke: "var(--pi-pipe-dark)", "stroke-width": 11, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    el("path", { d, fill: "none", stroke: "var(--pi-pipe)", "stroke-width": 7.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    box.append(svg);
  }
  box.setAttribute("aria-label", label || kind || "empty");
  return box;
}
const qLabel = text => { const s = document.createElement("span"); s.className = "pi-q-label"; s.textContent = text; return s; };
let queueKey = "";
function drawQueue(moved = false) {
  const q = $("queue");
  if (mode === "flat") {
    if (!F?.P || F.phase !== "play") { q.replaceChildren(); queueKey = ""; return; }
    const pieces = B.queueOf(L, F.P.next), key = `f${F.n}/${F.P.next}`;
    if (key === queueKey) return;
    queueKey = key;
    q.replaceChildren(qLabel("Next"), ...pieces.map((p, i) => { const t = pieceTile(p, i === 0); if (moved && !reduced()) t.classList.add("slide"); return t; }));
    return;
  }
  if (!R) { q.replaceChildren(); return; }
  const D = R.D, key = `d${D.next}/${D.cur}/${D.hold}/${R.phase}`;
  if (key === queueKey) return;
  queueKey = key;
  const hand = document.createElement("span"), next = document.createElement("span"), hold = document.createElement("span");
  hand.className = "pi-q-group"; next.className = "pi-q-group"; hold.className = "pi-q-group pi-q-hold";
  hand.append(qLabel("In hand"), piece3Tile(R.phase === "play" ? D.cur : null, true, `In hand: ${D.cur}`));
  next.append(qLabel("Next"), ...[0, 1, 2].map(k => piece3Tile(G.pieceAt3(D.seed, D.next + k), false)));
  hold.append(qLabel("Held"), piece3Tile(D.hold, false, D.hold ? `Held: ${D.hold}` : "Nothing held"));
  q.replaceChildren(hand, next, hold);
}

// ---------- what's shown round the board ----------
function setStat(id, text, cls = null) { const n = $(id); if (n.textContent !== text) n.textContent = text; if (cls != null) n.className = cls; }
function drawFlatHud() {
  if (!F) return;
  const P = F.phase === "play" ? F.P : null, live = F.total + (P ? B.pointsOf(P) : 0);
  $("stat1Label").textContent = "Level"; setStat("stat1", String(F.n));
  setStat("score", num(live));
  $("stat3Label").textContent = "To go";
  const left = P ? Math.max(0, L.quota - P.count) : 0;
  setStat("stat3", P ? (left ? String(left) : "✓") : "–", left || !P ? "" : "met");
  drawFlatStatus();
}
/** Plan's line, in pieces: what picking a square shows, how far the oil is from the end of the route laid, or how long
 *  till it leaves; and its buttons' words. */
const PLAN_WHY = { edge: "off the edge", rock: "into rock", open: "into an empty square", shape: "into a piece that won't take it", full: "into pipe it has filled",
  early: "into the terminal short of the quota", loop: "round and round" };
const pieces = n => `${n} piece${n === 1 ? "" : "s"}`;
function planStatus(P) {
  const route = `route ${routeLength} of ${L.quota}`, out = outcome(), why = routeEnd?.why;
  const wins = B.winsNow(L, P);
  let text;
  if (F.running) text = `The oil is running · ${route}`;
  else if (out) {
    text = out.over ? (out.over.win ? "Lay here and the oil goes into the terminal" : `Lay here and the oil spills ${PLAN_WHY[out.over.why] || ""}`)
      : `${P.grid[F.sel] ? `Lay again to blast it (${signed(B.POINTS.blast)})` : "Tap again to lay it"} · ${route}`;
  } else if (!P.flowing) text = `Oil leaves after ${pieces(P.lead)} · ${route}`;
  else if (why === "open") text = routeCells ? `${pieces(routeCells)} laid ahead of the oil · ${route}` : `The oil needs the ringed square · ${route}`;
  else if (why === "terminal") text = `Route runs into the terminal · ${route}`;
  else text = `${wins ? "Quota met" : "Short of the quota"}: route ends ${PLAN_WHY[why] || ""} · ${route}`;
  return { text, label: "Run the oil", quiet: !wins, off: !wins || !!F.running, undo: `Undo · ${P.undos}`, undoOff: !P.undos || !F.snaps?.length || !!F.running };
}
function drawFlatStatus() {
  const P = F?.P, go = $("goBtn"), back = $("undoBtn");
  $("ahead").hidden = true;
  // what the line and the button say: text, the button's words, whether it's quiet, pressable, or away (it keeps its
  // room when there's nothing to press, so the board never changes size); written only when it changes
  let text, label = "", quiet = true, off = false, away = false, undo = "Undo", undoOff = true;
  if (!P || F.phase !== "play") { text = F?.phase === "done" ? `Level ${F.n} cleared` : F ? "The run is over" : ""; away = true; }
  else if (planned()) ({ text, label, quiet, off, undo, undoOff } = planStatus(P));
  else {
    const route = `route ${routeLength} of ${L.quota}`;
    if (!P.flowing) { text = `Oil in ${Math.ceil((L.countdown - P.t) / 1000)} s · ${route}`; label = `Oil now · +${B.POINTS.early} a second`; }
    else if (P.hurry) { text = `Hurrying: double points · ${route}`; label = "Hurrying"; off = true; }
    else { text = `${P.count >= L.quota ? "Quota met" : "Flowing"} · ${route}`; label = `Hurry · ×${B.HURRY}, double points`; quiet = routeLength < L.quota; }
  }
  const key = `${text}|${label}|${quiet}|${off}|${away}|${undo}|${undoOff}`;
  if (key === flatKey) return;
  flatKey = key;
  $("status").textContent = text;
  go.classList.toggle("away", away);
  back.classList.toggle("away", away);
  if (away) return;
  go.textContent = label; go.disabled = off; go.classList.toggle("quiet", quiet);
  back.textContent = undo; back.disabled = undoOff;
}
let flatKey = "";
/** The board's run on show: the board, the queue, the numbers, and a level's card when it's over. */
function showFlat(fresh) {
  leavePuzzle();
  $("board").hidden = false; $("shaft").hidden = true;
  $("flatControls").hidden = false; $("deepControls").hidden = true;
  $("flatControls").classList.toggle("plan", planned()); $("undoBtn").hidden = !planned();
  if (fresh || !cellG.length || $("board").dataset.for !== `${F.seed}/${F.n}`) { buildBoard(); $("board").dataset.for = `${F.seed}/${F.n}`; }
  else for (let c = 0; c < cellG.length; c++) drawCell(c);
  queueKey = ""; flatKey = "";
  drawRoute();
  drawQueue();
  drawFlatHud();
  drawFlatCard();
}

// ---------- the descent, shown ----------
/** The way the piece in hand would be laid as it's turned now, while it can be. */
function ghostOf() {
  if (!R || R.phase !== "play" || R.D.over) return null;
  const D = R.D, ways = G.waysOf(D, D.cur);
  return ways[D.turn % ways.length] || null;
}
function drawDeepHud() {
  if (!R) return;
  const D = R.D;
  $("stat1Label").textContent = "Depth"; setStat("stat1", `${num(G.depthOf(D))} m`);
  setStat("score", num(G.scoreOf(D)));
  $("stat3Label").textContent = "Charges"; setStat("stat3", D.charges ? `✷ ${D.charges}` : "–");
  drawQueue();
  drawDeepStatus();
}
let statusKey = "";
function drawDeepStatus() {
  const D = R?.D;
  if (!D) return;
  const lead = G.lead(D), ghost = ghostOf(), end = G.openEnd(D), facing = G.contentAt(S, D, end.x, end.y, end.z);
  const fit = ghost && G.fits(S, D, ghost), shut = fit && G.deadEnd(S, D, ghost), full = !G.room(D, ghost ? ghost.cells.length : 1);
  const blastable = facing === "rock" && D.charges > 0;
  const text = R.phase === "over" ? "The oil caught up"
    : !D.flowing ? `The oil comes in ${Math.ceil((G.startOf(D) - D.t) / 1000)} s`
    : blastable ? "Rock ahead: blast it with a charge"
    : facing === "rock" || facing === "wall" || facing === "pipe" ? `Shut in by ${facing === "pipe" ? "your own pipe" : facing === "wall" ? "the shaft's wall" : "rock, and no charge"}: the oil will catch up`
    : full ? (lead >= G.CAP ? `${G.CAP} laid ahead: wait for the oil, or hurry it` : "No room yet for two squares: wait for the oil, or hurry it")
    : !fit ? "That way's blocked: turn it, hold it or scrap it"
    : shut ? "That way leads into a dead end"
    : D.hurry ? "Hurrying the oil on"
    : "Turn the piece, then lay it";
  const key = `${text}/${lead}/${full}/${D.hurry}/${D.held}/${D.charges}/${D.turn}/${D.cur}`;
  if (key === statusKey) return;
  statusKey = key;
  $("status").textContent = text;
  const pips = $("ahead");
  pips.hidden = R.phase !== "play";
  if (pips.children.length !== G.CAP) pips.replaceChildren(...Array.from({ length: G.CAP }, () => document.createElement("i")));
  [...pips.children].forEach((n, i) => n.classList.toggle("on", i < lead));
  pips.classList.toggle("low", D.flowing && lead <= 1 && R.phase === "play");     // the oil about to catch up
  pips.title = `${lead} of ${G.CAP} laid ahead of the oil`;
  const playing = R.phase === "play" && !D.over && !IN_FRAME;
  const lay = $("layBtn");
  lay.querySelector("b").textContent = blastable ? "Blast" : "Lay";
  $("layNote").textContent = blastable ? "a charge" : full ? "wait" : "it in";
  lay.disabled = !playing || (!blastable && (full || !fit));
  $("turnBtn").disabled = !playing || G.waysOf(D, D.cur).length < 2;
  $("holdBtn").disabled = !playing || D.held;
  $("holdNote").textContent = D.held ? "used" : D.hold ? "swap" : "set aside";
  $("scrapBtn").disabled = !playing;
  const hurry = $("hurryBtn");
  hurry.disabled = !playing || (!D.hurry && lead <= G.HURRY_STOP);
  hurry.classList.toggle("on", D.hurry);
  $("hurryNote").textContent = D.hurry ? "on" : `×${G.HURRY3}`;
}
function showDeep(fresh) {
  leavePuzzle();
  $("board").hidden = true; $("shaft").hidden = false;
  $("flatControls").hidden = true; $("deepControls").hidden = false;
  if (!view) view = createShaftView($("shaft"), { onTap: () => act("turn") });
  if (fresh) view.reset();
  view.resize();
  queueKey = ""; statusKey = "";
  drawDeepHud();
  drawDeepCard();
  view.draw(S, R.D, { ghost: ghostOf(), still: fresh, turns });
}
/** A move in the descent, from its keys, the keyboard or a tap on the shaft. */
function act(what) {
  if (IN_FRAME || mode !== "deep" || !R || R.phase !== "play" || R.D.over) return;
  const D = R.D;
  let done = false;
  if (what === "turn") { if (G.waysOf(D, D.cur).length > 1) { G.turnPiece(D); turns++; done = true; } }
  else if (what === "lay") {
    const end = G.openEnd(D);
    if (G.contentAt(S, D, end.x, end.y, end.z) === "rock" && D.charges) { done = G.blast(S, D); if (done) { toast("Blasted", 900); navigator.vibrate?.(30); } }
    else {
      const before = { b: D.barrels, c: D.charges, n: D.pipe.length }, r = G.lay(S, D);
      done = r === "laid";
      if (done) {
        if (D.barrels > before.b) toast(`A barrel: +${G.BARREL}`, 1100);
        else if (D.charges > before.c) toast("A charge: blast a rock with it", 1600);
        else if (D.pipe.slice(before.n).some(c => c.took === "tank")) toast("A tank: the oil slows there", 1400);
      } else if (r === "blocked") toast("That way's blocked");
    }
  } else if (what === "hold") done = G.holdPiece(S, D);
  else if (what === "scrap") { done = G.scrap(S, D); if (done) toast("Scrapped: the oil surges", 1000); }
  else if (what === "hurry") { G.hurry(S, D); done = D.hurry; }
  if (!done) return;
  drawDeepHud();
  if (D.over) { descentOver(); showDeep(false); }
  save();
}

// ---------- the cards: a level's result, the run's end ----------
function card(nodes, ...buttons) {
  const box = $("card");
  box.replaceChildren(...nodes);
  if (buttons.length) {
    const row = document.createElement("div");
    row.className = "pi-card-buttons";
    for (const [text, fn, quiet] of buttons) { const b = document.createElement("button"); b.type = "button"; b.className = `pi-go${quiet ? " quiet" : ""}`; b.textContent = text; b.addEventListener("click", fn); row.append(b); }
    box.append(row);
  }
  box.hidden = false;
}
const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function lines(rows) {
  const box = make("div", "pi-lines");
  for (const [label, v, cls] of rows) { const p = make("p", cls || (v < 0 ? "neg" : "")); p.append(make("span", null, label), make("b", null, typeof v === "number" ? signed(v) : v)); box.append(p); }
  return box;
}
const WHY = { edge: "ran off the edge of the board", rock: "ran into rock", open: "reached a square with no pipe", shape: "met a piece that doesn't take it in", full: "met pipe it had already filled",
  early: "reached the terminal before the quota" };
function drawFlatCard() {
  const box = $("card");
  if (!F || F.phase === "play" || !F.last) { box.hidden = true; return; }
  const l = F.last, p = l.pts, rows = l.count ? [[`Pipe ×${l.count}`, p.pipe]] : [];
  if (p.loop) rows.push(["Crossings both ways", p.loop]);
  if (p.pump) rows.push(["Pumps", p.pump]);
  if (p.terminal) rows.push(["The terminal", p.terminal]);
  if (p.early) rows.push(["Oil early", p.early]);
  if (p.unused) rows.push([`Unused ×${l.unused}`, p.unused]);
  if (p.blast) rows.push([`Blasts ×${l.blasts}`, p.blast]);
  rows.push([`Level ${l.n}`, signed(l.total), "sum"]);
  if (F.phase === "done") {
    const h = make("h3", "good", `Level ${l.n} cleared`);
    const why = make("p", "why", l.why === "terminal" ? `It passed ${l.count} pipes, ${l.quota} needed, and into the terminal.` : `It passed ${l.count} pipes, ${l.quota} needed, then ${WHY[l.why] || "spilled"}.`);
    card([h, why, lines(rows), lines([["Run", num(F.total)]])], [`Level ${l.n + 1}`, () => { if (!IN_FRAME) nextLevel(); }]);
    return;
  }
  const won = l.win;
  const h = make("h3", won ? "good" : "bad", won ? "The match is done" : "Run over");
  const why = make("p", "why", won ? `${match?.length || l.n} levels, the same for everyone.` : `It passed ${l.count} pipes of the ${l.quota} needed, then ${WHY[l.why] || "spilled"}.`);
  const big = make("p", "pi-big", num(F.total));
  const kind = planned() ? "plan" : "flat", pace = F.slowest || 1, best = bestOf(kind, pace), day = todayOf(kind, pace), at = pace > 1 ? `, ${paceName(pace).toLowerCase()}` : "";
  const stats = statBoxes([[l.n, "level reached"], [best ? num(best.score) : "–", `your best${at}`], [day ? num(day.score) : "–", `today's${at}`]]);
  if (match) { card([h, why, lines(rows), big], ["See the table", () => duel.open()]); return; }
  card([h, why, lines(rows), big, stats], ["Again", () => startFlat("random")], [F.kind === "daily" ? "A random run" : "Today's run", () => startFlat(F.kind === "daily" ? "random" : "daily"), true]);
}
function statBoxes(items) {
  const box = make("div", "pi-stats");
  for (const [v, label] of items) { const d = make("div"); d.append(make("b", null, String(v)), make("span", null, label)); box.append(d); }
  return box;
}
function drawDeepCard() {
  const box = $("card");
  if (!R || R.phase !== "over") { box.hidden = true; return; }
  const D = R.D, depth = G.depthOf(D);
  const h = make("h3", "bad", `The oil caught up at ${num(depth)} m`);
  const why = make("p", "why", "It reached the open end before the next piece was laid.");
  const rows = [[`Depth ${num(depth)} m`, depth]];
  if (D.barrels) rows.push([`Barrels ×${D.barrels}`, G.BARREL * D.barrels]);
  rows.push(["Score", num(G.scoreOf(D)), "sum"]);
  const big = make("p", "pi-big", num(G.scoreOf(D)));
  if (match) { card([h, why, lines(rows), big], ["See the table", () => duel.open()]); return; }
  const pace = R.slowest || 1, best = bestOf("deep", pace), day = todayOf("deep", pace), at = pace > 1 ? `, ${paceName(pace).toLowerCase()}` : "";
  const stats = statBoxes([[`${num(depth)} m`, "this time"], [best ? num(best.score) : "–", `your best${at}`], [day ? num(day.score) : "–", `today's${at}`]]);
  card([h, why, lines(rows), big, stats], ["Again", () => startDeep("random")], [R.kind === "daily" ? "A random shaft" : "Today's shaft", () => startDeep(R.kind === "daily" ? "random" : "daily"), true]);
}

// ---------- the puzzle ----------
// Levels to fit (pipes-puzzle-ui.js): it keeps its own level and stars under pipes:puzzle and pipes:stars and draws into
// the board, queue, line and buttons; a solved level is a round for the games screen's Random.
const Z = createPuzzle({ $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { if (!match) roundOver("pipes"); }, reduced });
function showPuzzle() {
  $("flatControls").hidden = true; $("deepControls").hidden = true; $("puzzleControls").hidden = false;
  $("app").classList.add("puzzle");
  queueKey = ""; flatKey = ""; statusKey = "";
  Z.show();
}
/** The board or the shaft takes the stage back from the puzzle: its hand, its board's shape and its buttons go. */
function leavePuzzle() {
  $("puzzleControls").hidden = true;
  $("app").classList.remove("puzzle");
  $("scoreLabel").textContent = "Score";
  const q = $("queue"), b = $("board");
  if (q.classList.contains("pi-hand")) { q.className = "pi-queue"; q.replaceChildren(); }
  if (b.style.getPropertyValue("--cols")) { b.style.removeProperty("--cols"); b.style.removeProperty("--rows"); b.dataset.for = ""; b.replaceChildren(); }
}

// ---------- switching between the puzzle, the board and the shaft ----------
/** Shows a mode: its run where it was left (or a fresh one), the others kept as they are. */
function setMode(m) {
  m = modeOf(m);
  if (mode !== m && !match) save();
  mode = m;
  if (!match) { prefs.mode = m; write(KEY.prefs, prefs); }
  $("app").classList.toggle("deep", m === "deep");
  if (m === "puzzle") return showPuzzle();
  if (m === "flat") {
    if (!F) { F = loadRun(keyOf(flow), flow); if (F) L = B.deal(F.seed, F.n, F.pace || 1); }
    if (!F) return startFlat("random");
    delete F.still;
    showFlat(true);
  } else {
    if (!R) { R = loadRun(KEY.deep); if (R) S = G.shaftOf(R.seed); }
    if (!R) return startDeep("random");
    delete R.still;
    showDeep(true);
  }
  // kept at once, as it's shown: a partner's watching frame runs it on from now, not from when it was last played
  if (!match) save();
}
/** A run kept here, if it's this version's (and, on the board, plays the way asked for: a run with no flow is Rush's). */
function loadRun(key, how = null) {
  const v = read(key, null);
  return v?.v === 2 && (how == null || (v.flow === "plan") === (how === "plan")) ? v : null;
}
/** The board plays the other way from here: that way's run where it was left, or a fresh one. */
function setFlow(f) {
  f = flowOf(f);
  if (match || mode !== "flat" || (f === flow && planned() === (f === "plan"))) return;
  save();
  flow = f; prefs.flow = f; write(KEY.prefs, prefs);
  F = null;
  setMode("flat");
}

// ---------- the rules ----------
function showRules() {
  const lv = B.levelOf(1);
  // the level from which the clock's play stops getting harder (Plan's lead has its own run-down, so it's left out)
  const hard = n => { const { n: _n, lead: _lead, ...rest } = B.levelOf(n); return JSON.stringify(rest); };
  let top = 1;
  while (top < 60 && hard(top) !== hard(top + 1)) top++;
  const last = B.levelOf(top);
  let low = 1;                                          // and the level from which the oil leaves after the fewest pieces
  while (low < 60 && B.levelOf(low).lead !== B.levelOf(low + 1).lead) low++;
  $("rulesBody").innerHTML = `
    <p>Lay pipe for the oil. In the puzzle, a hand of pieces fits a board; on the board, the pieces come off a queue and go wherever you tap, ahead of the oil; in 3D, the oil comes down a shaft and you lay its pipe at the open end, a segment at a time. The menu's Game chooses.</p>
    <h4>The puzzle</h4>
    <p>No clock, no queue. Every level is a board and a hand of pieces, and every piece must go down: the oil leaves the wellhead, runs through all of them, and into the terminal. Pieces can't be turned, so the bends in your hand decide which ways the route can turn.</p>
    <ul>
      <li><b>Tap a piece in the hand</b>, then a square, to lay it. <b>Tap a piece you've laid</b> to take it back up (it's in your hand again: tap another square). The dashed line is the oil's way from the wellhead, and back from the terminal; the ringed square is where it needs a piece next, and a red cross is where it's stopped.</li>
      <li><b>Rock</b> can't be built on. <b>Old pipe</b> (dark, studded) is already in the ground, and the oil must run through it. <b>Stakes</b> are numbered: the oil passes them in order. A <b>crossing</b> carries the oil across itself, and the oil may pass it twice.</li>
      <li><b>Undo</b> is free, as many times as you like. <b>Hint</b> shows where the next piece goes, or which of yours is in the way; with one, the level can earn only the one star.</li>
      <li><b>Stars</b>: one for solving a level, two for solving it without a hint, three for that and hardly any piece taken back up (${STAR_LIFTS} at most, and one more for every six pieces in the hand).</li>
    </ul>
    <h4>The board</h4>
    <p>The next piece is the large one at the left of the queue. Pieces can't be turned: straights, bends and crossings come as they are, in bags of thirteen, so no shape stays away long. The oil leaves the wellhead and runs from piece to piece, and it must pass through the level's quota of pipe (${lv.quota} on level 1) before it spills: off the edge, into rock, into an empty square or a piece that doesn't take it in. Short of the quota, the spill ends the run; past it, the level is cleared. The menu's Board switch chooses how the oil is paced.</p>
    <h4>Plan</h4>
    <p>No clock. The oil moves one square on for each piece you lay, so what you have to beat is the pieces, not the seconds. It stays at the wellhead until the first ${lv.lead} pieces are down (${B.levelOf(low).lead} from level ${low}), then each piece you lay moves it a square; a tank holds it for ${B.TANK} pieces. Stop and think as long as you like.</p>
    <ul>
      <li><b>Tap a square once</b> and the piece shows there, faint, with the dashed route the oil would take; the line under the board says what laying it does. <b>Tap it again</b> to lay it. A red frame means the oil would spill the moment you did.</li>
      <li><b>Undo</b> takes back the last piece, and the oil's step with it; ${B.UNDOS} times a level.</li>
      <li><b>Run the oil</b> lights once the route as laid clears the quota (and doesn't run into the terminal short of it): it lets the oil go to the end at once, and the pieces it never reaches cost their points as ever.</li>
      <li>The ringed square is where the route needs a piece next; a piece laid elsewhere still moves the oil, so it can run out of road. A blast (laying over a piece of yours the oil hasn't reached) is a piece like any: the oil moves.</li>
    </ul>
    <h4>Rush</h4>
    <p>Pipe Dream's own: the oil runs on a clock. After a countdown (${lv.countdown / 1000} seconds on level 1) it leaves the wellhead and runs from piece to piece, a piece every ${lv.fill / 1000} seconds at first, while you lay pipe ahead of it.</p>
    <ul>
      <li><b>Blasting</b>: tap one of your pieces the oil hasn't reached and the next piece replaces it. It costs ${-B.POINTS.blast} points and a moment before you can lay again.</li>
      <li>Oil now starts it before the countdown is out, ${B.POINTS.early} for each second left (on a level cleared); once it flows, Hurry runs it ${B.HURRY} times faster to the end of the level, and everything it fills from then scores double.</li>
      <li>Every level is faster than the one before, its quota longer and its rock more, until level ${top}: ${last.fill / 1000} seconds a piece, a quota of ${last.quota}, ${last.countdown / 1000} seconds' countdown. From there on they stay as hard.</li>
    </ul>
    <h4>On either board</h4>
    <ul>
      <li><b>Crossings</b> carry the oil straight across either way, and it may pass through one twice, once each way: a loop, worth ${B.POINTS.loop} more.</li>
      <li><b>Pumps</b> (from level 3) are fixed straights: ${B.POINTS.pump} when the oil goes through one. <b>Tanks</b> (from level 5) are fixed straights that hold the oil ${B.TANK} times as long: time in hand in Rush, ${B.TANK} pieces in Plan.</li>
      <li><b>The terminal</b> (from level 4): lead the oil into it once the quota is met for ${B.POINTS.terminal} and a clean end to the level. Into it any sooner, it's refused: a spill.</li>
    </ul>
    <p>The dashed line shows where the oil will go as the board stands; the ringed square is where its route needs a piece next, and a red cross is where it would spill.</p>
    <p><b>Points</b>: ${B.POINTS.pipe} for each piece the oil passes through; on a level cleared, ${-B.POINTS.unused} less for each piece of yours it never reached.</p>
    <h4>In 3D</h4>
    <p>The menu's 3D switch takes you down a shaft four squares across. The oil waits ${G.START / 1000} seconds at the wellhead, then runs down the pipe, slowly at first (${(G.fillTime(0) / 1000).toFixed(1)} seconds a square) and faster the deeper it gets. It's over when it catches the pipe's open end.</p>
    <ul>
      <li><b>The pieces</b>: a straight, a long straight (two squares), an elbow, and a jog (a square sideways, then on as it was going). The piece in hand shows at the open end in copper, the square it leads into outlined: green if it's open, red if it's shut.</li>
      <li><b>Turn</b> it a quarter about the way the pipe is going (or tap the shaft), then <b>Lay</b> it. An elbow turns the pipe any of the four ways square to it (going down, the four sideways; going sideways, up, down or to either side), and a jog steps any of four ways.</li>
      <li><b>Hold</b> sets the piece in hand aside for the one held before, once a piece. <b>Scrap</b> throws it away for the next, but the oil surges on a square meanwhile.</li>
      <li>You can lay ${G.CAP} squares ahead of the oil at most (the dots by the line under the shaft). A piece taking two squares waits for room for both. <b>Hurry</b> runs the oil ${G.HURRY3} times faster until it's ${G.HURRY_STOP} squares behind you (and lets it go from the wellhead, if it's still waiting there).</li>
      <li><b>On the way</b>, steer round the rock: scattered blocks, pillars, and slabs across the whole shaft but for a gap or two. Lay pipe through the boons to take them: a barrel is worth ${G.BARREL}, a charge blasts the rock the open end faces (Lay becomes Blast), a tank holds the oil back ${G.TANK3} times as long.</li>
    </ul>
    <p><b>Points</b>: a point for every metre the oil gets down (a layer is ${G.METRES} m), and ${G.BARREL} a barrel. Drag the shaft to look round it.</p>
    <h4>Pace</h4>
    <p>In Rush and in 3D the menu's Pace slows the clock down: Slower takes half as long again over everything (the countdown, the oil's every pipe or square, the wait at the wellhead), Slowest twice as long; the boards and the shaft stay the same. It changes the game under way at once. A slower game is an easier one, so it keeps bests of its own, and a game counts under the slowest pace it was played at.</p>
    <h4>Today's and together</h4>
    <p>Today's run and today's shaft are the same for everyone, dealt from the day. In a match, everyone at the table gets the same boards and pieces (or the same shaft), each on their own phone: the highest score wins. On the board, the menu's Match length sets how many levels a match runs: 5, 10, or till the spill; the match is played the way the board is set (Plan or Rush) when it's dealt, and at its pace.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;
}

// ---------- the menu ----------
/** How many levels a match on the board runs: the one choice of a match's own, so your menu has it too. */
const matchLength = () => choice("Match length", [[5, "5 levels"], [10, "10 levels"], [0, "Till the spill"]], prefs.length || 0, v => { prefs.length = v; write(KEY.prefs, prefs); });
let pick = null;      // the kind of run the menu's New game starts
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Menu";
  if (duel.on) {
    duel.menu(part(body, "together"));
    part(body, "play").append(action("The rules", showRules, "link"));
    const settings = part(body, "settings");
    settings.append(toggle("3D (the next match)", prefs.mode === "deep", on => { prefs.mode = on ? "deep" : "flat"; write(KEY.prefs, prefs); openMenu(); }));
    if (prefs.mode !== "deep") settings.append(choice("Board (the next match)", FLOWS, flowOf(prefs.flow), v => { prefs.flow = v; write(KEY.prefs, prefs); openMenu(); }));
    if (prefs.mode === "deep" || flowOf(prefs.flow) === "rush") settings.append(choice("Pace (the next match)", PACES, PACES.some(([v]) => v === prefs.pace) ? prefs.pace : 1, v => { prefs.pace = v; write(KEY.prefs, prefs); }));
    if (prefs.mode !== "deep") settings.append(matchLength());
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  // the three ways to play, each keeping its own run
  const game = choice("Game", MODES, mode, v => { $("menuDlg").close(); setMode(v); });
  if (mode === "puzzle") {
    const solved = Z.run?.solved;
    part(body, "play").append(action(solved ? "Next level" : "Level again", () => (solved ? Z.next() : Z.again()), "primary"), action("The rules", showRules, "link"));
    part(body, "content").append(game, Z.levelList(id => { $("menuDlg").close(); Z.go(id); }));
    part(body, "about").append(line(`${Z.solvedCount()} of ${Z.count} levels solved, ${Z.totalStars()} of ${Z.count * 3} stars. Three stars: no hint, and hardly a piece taken back up.`));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const run = mode === "flat" ? F : R;
  pick ??= run?.kind === "daily" ? "daily" : "random";
  part(body, "play").append(action("New game", () => confirmStart(pick), "primary"), action("The rules", showRules, "link"));
  const content = [game, choice(mode === "flat" ? "Run" : "Shaft", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; })];
  // the board plays two ways, each keeping its own run
  if (mode === "flat") content.push(choice("Board", FLOWS, flow, v => { $("menuDlg").close(); pick = null; setFlow(v); }));
  part(body, "content").append(...content);
  if (mode === "deep" || flow === "rush") part(body, "settings").append(choice("Pace", PACES, paceNow(), v => { setPace(v); openMenu(); }));     // Plan has no clock to slow
  part(body, "together").append(matchLength());
  // the bests at the pace you're playing at (a slower game keeps its own; Plan has no pace)
  const pace = paceNow(), at = pace > 1 ? `, ${paceName(pace).toLowerCase()}` : "";
  const pb = bestOf("plan"), rb = bestOf("flat", pace), db = bestOf("deep", pace), pt = todayOf("plan"), rt = todayOf("flat", pace), dt = todayOf("deep", pace);
  const bestLine = (name, b, t, what, none = "no run finished yet") => line(`${name}: ${b ? `best ${num(b.score)} (${what(b)})` : none}${t ? `, today ${num(t.score)}` : ""}.`);
  part(body, "about").append(
    bestLine("Plan", pb, pt, b => `level ${b.level}`),
    bestLine(`Rush${at}`, rb, rt, b => `level ${b.level}`),
    bestLine(`3D${at}`, db, dt, b => `${num(b.depth)} m`, "no descent yet"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
async function confirmStart(kind) {
  const run = mode === "flat" ? F : R;
  const begun = run && run.phase !== "over" && (mode === "flat" ? run.n > 1 || run.P?.next > 0 : run.D.pipe.length > 1);
  if (begun && !(await sure("Start a new game? This one isn't finished.", { yes: "New game" }))) return;
  pick = null;
  if (mode === "flat") startFlat(kind); else startDeep(kind);
}

// ---------- messages ----------
let toastTimer = null;
function toast(msg, ms = 2000) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- together: the same seed for everyone at the table (duel.js) ----------
// A match deals one seed: on the board, the same levels and the same queues for everyone, for the menu's Length (or
// till the spill); in 3D, the same shaft and pieces. Each plays it on their own phone and the others' scores show under
// yours. A match's clock doesn't stop for the menu. Your own runs, bests and today's stay as they were.
const duel = createDuel({
  game: "pipes", name: "Pipes", accent: "--pi-in", line: $("rival"), toast,
  // the higher score wins, and equal scores draw: the quicker run isn't the better one here (in 3D it's the one the
  // oil caught first)
  compare: (a, b) => (b.score - a.score) || 0,
  deal: () => ({ seed: randomSeed(), mode: prefs.mode === "deep" ? "deep" : "flat", length: prefs.mode === "deep" ? 0 : prefs.length || 0,
    flow: flowOf(prefs.flow), pace: prefs.mode !== "deep" && flowOf(prefs.flow) === "plan" ? 1 : PACES.some(([v]) => v === prefs.pace) ? prefs.pace : 1 }),
  describe: m => {
    const pace = m.pace > 1 ? `, at the ${paceName(m.pace).toLowerCase()} pace` : "";
    return m.mode === "deep" ? `The same shaft for everyone${pace}: the highest score wins`
      : `The same boards for everyone, ${m.flow === "plan" ? "Plan (the oil moves with your pieces), " : ""}${m.length ? `${m.length} levels` : "till the spill"}${pace}: the highest score wins`;
  },
  extra: () => null,
  play: (m, { kept }) => {
    cancelAnimationFrame(raf);
    match = { mode: m.mode === "deep" ? "deep" : "flat", seed: m.seed, length: m.length || 0, pace: m.pace || 1, flow: m.flow === "plan" ? "plan" : "rush" };   // a match dealt before Plan was Rush
    $("card").hidden = true;
    if (kept?.match?.seed === m.seed && (kept.F || kept.R)) {
      F = kept.F; R = kept.R;
      if (F) L = B.deal(F.seed, F.n, F.pace || 1);
      if (R) S = G.shaftOf(R.seed);
      mode = match.mode;
      $("app").classList.toggle("deep", mode === "deep");
      if (mode === "flat") showFlat(true); else showDeep(true);
      catchUp(Date.now() - ((mode === "flat" ? F : R)?.at || Date.now()));
    } else {
      F = R = null;
      mode = match.mode;
      $("app").classList.toggle("deep", mode === "deep");
      if (mode === "flat") startFlat("duel", m.seed); else startDeep("duel", m.seed);
    }
    tell();
    run();
  },
  onLobby: () => { cancelAnimationFrame(raf); match = null; lobby(); },
  onLeave: () => { cancelAnimationFrame(raf); match = null; F = R = null; solo(); },
});
/** What the table sees of this run: the score, and the level or the depth. */
function tell(done = false) {
  if (!match) return;
  if (match.mode === "flat" && F) {
    const live = F.total + (F.phase === "play" && F.P ? B.pointsOf(F.P) : 0), over = F.phase === "over";
    duel.report({ score: live, text: over ? num(live) : `${num(live)} · level ${F.n}`, ...(done || over ? { done: true } : {}) });
  } else if (R) {
    const D = R.D, over = R.phase === "over";
    duel.report({ score: G.scoreOf(D), text: over ? `${num(G.scoreOf(D))} · ${num(G.depthOf(D))} m` : `${num(G.depthOf(D))} m`, ...(done || over ? { done: true } : {}) });
  }
}
/** The board before a match: nothing in play. */
function lobby() {
  F = R = null;
  leavePuzzle();
  $("board").replaceChildren(); cellG = [];
  $("board").hidden = false; $("shaft").hidden = true;
  $("flatControls").hidden = false; $("deepControls").hidden = true;
  $("flatControls").classList.remove("plan"); $("undoBtn").hidden = true;
  $("queue").replaceChildren(); queueKey = ""; flatKey = ""; statusKey = "";
  $("card").hidden = true;
  $("goBtn").classList.add("away");
  setStat("stat1", "–"); setStat("score", "0"); setStat("stat3", "–");
  $("status").textContent = "The same game for everyone";
  $("ahead").hidden = true;
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "pipes");
document.querySelector(".pi-mark").innerHTML = APPS.find(a => a.id === "pipes").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("undoBtn").addEventListener("click", undo);
$("goBtn").addEventListener("click", () => {
  if (IN_FRAME || mode !== "flat" || F?.phase !== "play" || !F.P) return;
  if (planned()) return runTheOil();
  const P = F.P;
  if (!P.flowing) { B.release(L, P); drawPathCells(0); drawRoute(); }
  else B.hurry(L, P);
  drawFlatHud();
  save();
});
for (const [id, what] of [["holdBtn", "hold"], ["scrapBtn", "scrap"], ["turnBtn", "turn"], ["layBtn", "lay"], ["hurryBtn", "hurry"]]) $(id).addEventListener("click", () => act(what));
document.addEventListener("keydown", e => {
  if (mode !== "deep" || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
  if (e.target.closest?.("button, a, input, select, textarea, [role=button]")) return;   // a key on a button is the button's
  const what = { " ": "turn", r: "turn", Enter: "lay", h: "hold", x: "scrap", f: "hurry", b: "lay" }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (what) { e.preventDefault(); act(what); }
});
// the menu and the rules hold the game where it is (a match's clock runs on)
/** Your game standing still (the menu or the rules open, the app out of sight), marked in its save: a partner's
 *  watching frame, which knows only what was last kept, then holds the oil where it is instead of running it on. */
function standStill(on) {
  const kept = mode === "flat" ? F : mode === "deep" ? R : null;       // the puzzle has no clock to hold
  if (!kept || match || IN_FRAME || !!kept.still === on) return;
  if (on) kept.still = true; else delete kept.still;
  save();
}
onPause(() => { if (!match) { cancelAnimationFrame(raf); held = true; Z.pause(); standStill(true); } }, () => { if (held) { held = false; Z.resume(); standStill(false); run(); } });
// a match's clock runs on while the app is out of sight; your own game waits
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); standStill(true); return; }
  if (match && hiddenAt) catchUp(Date.now() - hiddenAt);
  else if (!held) standStill(false);
  hiddenAt = 0;
  duel.resync();
});
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("resize", () => { if (mode === "deep") view?.resize(); });

// for tests and debugging
window.__pipes = { get F() { return F; }, get L() { return L; }, get R() { return R; }, get S() { return S; }, get mode() { return mode; }, Z, B, G, step, tapSquare, undo, runTheOil, act, setMode, setFlow, startFlat, startDeep, duel };

/** Your own game: the old Pipes' saves cleared away (its runs and bests were another game's), then the mode you were
 *  in, where you left it. A watching frame picks it up and runs it on by the time since it was kept. */
function solo() {
  if (!IN_FRAME) {
    for (const k of ["pipes:run", "pipes:acts"]) localStorage.removeItem(k);
    const best = read(KEY.best, null);
    if (best && ("n" in best || typeof best.score === "number")) localStorage.removeItem(KEY.best);
    const daily = read(KEY.daily, null);
    if (daily && Object.values(daily).some(v => typeof v?.score === "number")) localStorage.removeItem(KEY.daily);
  }
  F = R = null;
  const kept = read(KEY.prefs, {});                         // your own mode and way of playing the board, whatever a match just played
  flow = flowOf(kept?.flow);
  // the puzzle opens once, the first time Pipes does after it came (November 2026: it is there to be test-played); the menu's Game goes back
  if (!IN_FRAME && !kept?.puzzleSeen) { prefs.puzzleSeen = true; prefs.mode = kept.mode = "puzzle"; write(KEY.prefs, prefs); }
  setMode(modeOf(kept?.mode));
  const shownRun = mode === "flat" ? F : mode === "deep" ? R : null;
  if (IN_FRAME && shownRun?.at && !shownRun.still) catchUp(Date.now() - shownRun.at);
  run();
}
// a match in the address: its run, with no solo one dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });
else solo();
