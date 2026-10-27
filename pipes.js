// Pipes: Pipe Dream's game on a board (pipes-engine.js), and the descent in 3D (pipes-deep.js, drawn by
// pipes-3d.js). This file draws the board and the queue, takes taps and keys, runs the clock, keeps both runs and the
// bests, and plays a match for everyone at the table on the same seed (duel.js).
import * as B from "./pipes-engine.js";
import * as G from "./pipes-deep.js";
import { createShaftView } from "./pipes-3d.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
import { today, IN_FRAME } from "./suite.js";           // the day, the same for everyone (UTC); a partner watching's frame
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const KEY = { flat: "pipes:flat", deep: "pipes:deep", prefs: "pipes:prefs", best: "pipes:best", daily: "pipes:daily" };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const num = v => Math.round(v).toLocaleString("en-GB");
const signed = v => `${v < 0 ? "−" : "+"}${num(Math.abs(v))}`;
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- the state ----------
// prefs: the mode on show ("flat", the board; "deep", the shaft in 3D), the pace (1, Normal; 1.5 or 2, the countdown
// and the oil taking that many times as long) and a match's length on the board (levels; 0: till the spill). Each mode
// keeps its own run, so trying the other leaves yours where it was.
let prefs = { mode: "flat", length: 0, pace: 1, ...read(KEY.prefs, {}) };
const PACES = [[1, "Normal"], [1.5, "Slower"], [2, "Slowest"]];
const paceName = p => (PACES.find(([v]) => v === p) || PACES[0])[1];
/** The pace a new game plays at: a match's own, else yours. */
const paceNow = () => (match ? match.pace || 1 : PACES.some(([v]) => v === prefs.pace) ? prefs.pace : 1);
let mode = prefs.mode === "deep" ? "deep" : "flat";
// the board's run: { v, kind: "random" | "daily" | "duel", seed, pace (as it's played now) and slowest (the slowest it
// was played at, which its score counts under), n (the level), total (the levels' points before this one's, or with it
// once it's over), phase: "play" | "done" (a level cleared, its card up) | "over", P (the level: pipes-engine.js; kept
// once it's over, so the card stands over the board as it ended), last (how the level went), at }; L is its level
let F = null, L = null;
// the descent: { v, kind, seed, slowest, D (pipes-deep.js, its pace in it), phase: "play" | "over", at }; S its shaft
let R = null, S = null;
let match = null;            // a match being played here: { mode, seed, length, pace }
let turns = 0;               // quarter turns given the piece in hand: the 3D view swings the piece round only for these
let view = null;             // the 3D view, made the first time the shaft shows
let raf = 0, last = 0, held = false;

const save = () => {
  const now = Date.now();
  if (F) F.at = now;
  if (R) R.at = now;
  if (match) { duel.keep({ match, F, R }); tell(); return; }
  if (mode === "flat" && F) write(KEY.flat, F);
  if (mode === "deep" && R) write(KEY.deep, R);
};
let savedAt = 0;
const saveSoon = () => { const now = performance.now(); if (now - savedAt > 1000) { savedAt = now; save(); } };

// ---------- the board's run ----------
function startFlat(kind, seed = kind === "daily" ? today() : randomSeed()) {
  const pace = paceNow();
  F = { v: 2, kind, seed, pace, slowest: pace, n: 1, total: 0, phase: "play", P: B.newPlay(), at: Date.now() };
  L = B.deal(seed, 1, pace);
  showFlat(true);
  save();
}
function nextLevel() {
  if (F.phase !== "done") return;
  F.n++;
  F.P = B.newPlay();
  F.phase = "play";
  L = B.deal(F.seed, F.n, F.pace || 1);
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
  if (F.phase === "over" && !match) noteBest("flat", { score: F.total, level: F.n }, F.slowest || 1);
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
// kept as { flat, deep, "flat:slower", "deep:slowest", … }: a slower game is an easier one, so it keeps a best of its
// own (the games screen shows the highest of them)
const paced = (m, pace) => (pace > 1 ? `${m}:${paceName(pace).toLowerCase()}` : m);
/** A run's end, against the best of its mode at the slowest pace it was played at, and today's if it was today's. */
function noteBest(m, result, pace) {
  if (IN_FRAME) return;
  const k = paced(m, pace), best = read(KEY.best, {}) || {};
  if (!best[k] || result.score > best[k].score) { best[k] = result; write(KEY.best, best); }
  const run = m === "flat" ? F : R;
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
  if (F && F.phase !== "over") {
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
    if (F?.phase === "play" && F.P && !F.P.over) {
      const P = F.P, cells = P.path.length, pts = B.pointsOf(P), flowing = P.flowing;
      B.advance(L, P, dt);
      if (P.path.length !== cells || P.flowing !== flowing) { drawPathCells(cells); drawRoute(); saveSoon(); }
      if (B.pointsOf(P) !== pts) popPoints(P, pts);
      drawOil();
      drawFlatHud();
      if (P.over) { levelOver(); showFlat(false); }
    }
  } else if (R && S) {
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
  if (mode === "flat" && F?.phase === "play" && F.P && !F.P.over) {
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
const T = 60, MID = 30;
const el = (tag, attrs = {}, parent = null) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (parent) parent.appendChild(n); return n; };
const edge = d => [MID + B.DIRS[d][0] * MID, MID + B.DIRS[d][1] * MID];
/** A channel's line through a square, from side a to side b (a < 0: from the middle): straight, or a quarter circle
 *  round the corner the two sides share. Its length too, for the oil running along it. */
function channel(a, b) {
  const [bx, by] = edge(b);
  if (a < 0) return { d: `M${MID} ${MID}L${bx} ${by}`, len: MID };
  const [ax, ay] = edge(a);
  if (a === B.back(b)) return { d: `M${ax} ${ay}L${bx} ${by}`, len: T };
  const cx = MID + (B.DIRS[a][0] + B.DIRS[b][0]) * MID, cy = MID + (B.DIRS[a][1] + B.DIRS[b][1]) * MID;
  const sweep = (ax - cx) * (by - cy) - (ay - cy) * (bx - cx) > 0 ? 1 : 0;
  return { d: `M${ax} ${ay}A${MID} ${MID} 0 0 ${sweep} ${bx} ${by}`, len: Math.PI * MID / 2 };
}
/** A channel's pipe along a line: its dark edge, the brass and a shine; a crossing's upright channel first lays a strip
 *  of ground, so it bridges the other. */
function pipeAlong(g, d, bridge = false) {
  if (bridge) el("path", { d, class: "pipe-edge", "stroke-width": 26, stroke: "var(--pi-ground)" }, g);
  el("path", { d, class: "pipe-edge", "stroke-width": 22 }, g);
  el("path", { d, class: "pipe", "stroke-width": 16 }, g);
  el("path", { d, class: "pipe-shine", "stroke-width": 4 }, g);
}
/** A piece's pipe in a square (and the queue's tiles), channel by channel; oil(i) draws the oil in channel i straight
 *  after its pipe, so whatever lies over a channel (a crossing's bridge) lies over its oil too. */
function drawPipe(g, piece, oil = () => {}) {
  const chs = B.PIECES[piece], order = piece === "x" ? [1, 0] : chs.map((_, i) => i);
  for (const i of order) {
    pipeAlong(g, channel(chs[i][0], chs[i][1]).d, piece === "x" && i === 0);
    oil(i);
  }
}
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
  el("rect", { x: 2, y: 2, width: T - 4, height: T - 4, rx: 8, fill: fixed?.k === "rock" ? "var(--pi-rock)" : "var(--pi-tile)", stroke: "var(--pi-tile-edge)", "stroke-width": 1 }, g);
  if (fixed?.k === "rock") { for (const [cx, cy, r] of [[20, 24, 9], [38, 36, 11], [24, 42, 6]]) el("circle", { cx, cy, r, fill: "var(--pi-tile-edge)" }, g); return; }
  if (fixed?.k === "source") {
    pipeAlong(g, channel(-1, fixed.d).d);
    oil(s => s.a < 0)();
    // the wellhead: a derrick over it
    el("path", { d: "M18 46 L30 12 L42 46 M22 35 H38 M25 24 H35", fill: "none", stroke: "var(--pi-in)", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
    el("rect", { x: 13, y: 44, width: 34, height: 5, rx: 2, fill: "var(--pi-in)" }, g);
  } else if (fixed?.k === "terminal") {
    pipeAlong(g, channel(-1, fixed.d).d);
    // the terminal: a tank with its roof, flying a flag
    el("rect", { x: 13, y: 22, width: 34, height: 26, rx: 4, fill: "var(--pi-good)", stroke: "#fff", "stroke-width": 2 }, g);
    el("path", { d: "M13 26 Q30 15 47 26", fill: "var(--pi-good)", stroke: "#fff", "stroke-width": 2 }, g);
    el("path", { d: "M40 18 V6 L50 9 L40 12", fill: "#fff", stroke: "#fff", "stroke-width": 1.5, "stroke-linejoin": "round" }, g);
  } else if (fixed?.k === "pump" || fixed?.k === "tank") {
    drawPipe(g, fixed.piece, inChannel(fixed.piece));
    if (fixed.k === "pump") {
      el("circle", { cx: MID, cy: MID, r: 13, class: "fixed-mark" }, g);
      el("path", { d: fixed.piece === "h" ? "M25 24 l10 6 l-10 6 z" : "M24 25 l6 10 l6 -10 z", fill: "#fff" }, g);
    } else el("rect", { x: fixed.piece === "h" ? 12 : 17, y: fixed.piece === "h" ? 17 : 12, width: fixed.piece === "h" ? 36 : 26, height: fixed.piece === "h" ? 26 : 36, rx: 8, class: "tank-body" }, g);
  } else if (P?.grid[c]) drawPipe(g, P.grid[c], inChannel(P.grid[c]));
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
  const a = B.ahead(L, P);
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
let routeLength = 0;
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
/** A tap on a square: the next piece laid there (or over a piece of yours, a blast). */
function tapSquare(c) {
  if (IN_FRAME || mode !== "flat" || F?.phase !== "play" || !F.P || F.P.over) return;
  const P = F.P, r = B.place(L, P, c);
  if (r === "laid" || r === "blast") {
    drawCell(c);
    if (r === "blast") {
      cellG[c].classList.remove("blast"); void cellG[c].getBBox(); cellG[c].classList.add("blast");
      toast(`Blasted: ${signed(B.POINTS.blast)}`, 1200);
      navigator.vibrate?.(25);
    }
    drawQueue(true);
    drawRoute();
    drawFlatHud();
    save();
  } else if (r === "oil") toast("The oil's in that one");
  else if (r === "busy") toast("A blast going off: a moment");
}

// ---------- the queue ----------
/** A board piece as a small tile, for the queue. */
function pieceTile(piece, first) {
  const box = document.createElement("span");
  box.className = `pi-q${first ? " first" : ""}`;
  const svg = el("svg", { viewBox: "0 0 60 60", "aria-hidden": "true" });
  drawPipe(svg, piece);
  box.append(svg);
  box.setAttribute("aria-label", { h: "straight across", v: "straight up and down", ne: "bend up and right", nw: "bend up and left", se: "bend down and right", sw: "bend down and left", x: "crossing" }[piece]);
  return box;
}
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
function drawFlatStatus() {
  const P = F?.P, go = $("goBtn");
  $("ahead").hidden = true;
  // what the line and the button say: text, the button's words, whether it's quiet, pressable, or away (it keeps its
  // room when there's nothing to press, so the board never changes size); written only when it changes
  let text, label = "", quiet = true, off = false, away = false;
  if (!P || F.phase !== "play") { text = F?.phase === "done" ? `Level ${F.n} cleared` : F ? "The run is over" : ""; away = true; }
  else {
    const route = `route ${routeLength} of ${L.quota}`;
    if (!P.flowing) { text = `Oil in ${Math.ceil((L.countdown - P.t) / 1000)} s · ${route}`; label = `Oil now · +${B.POINTS.early} a second`; }
    else if (P.hurry) { text = `Hurrying: double points · ${route}`; label = "Hurrying"; off = true; }
    else { text = `${P.count >= L.quota ? "Quota met" : "Flowing"} · ${route}`; label = `Hurry · ×${B.HURRY}, double points`; quiet = routeLength < L.quota; }
  }
  const key = `${text}|${label}|${quiet}|${off}|${away}`;
  if (key === flatKey) return;
  flatKey = key;
  $("status").textContent = text;
  go.classList.toggle("away", away);
  if (away) return;
  go.textContent = label; go.disabled = off; go.classList.toggle("quiet", quiet);
}
let flatKey = "";
/** The board's run on show: the board, the queue, the numbers, and a level's card when it's over. */
function showFlat(fresh) {
  $("board").hidden = false; $("shaft").hidden = true;
  $("flatControls").hidden = false; $("deepControls").hidden = true;
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
  const pace = F.slowest || 1, best = bestOf("flat", pace), day = todayOf("flat", pace), at = pace > 1 ? `, ${paceName(pace).toLowerCase()}` : "";
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

// ---------- switching between the board and the shaft ----------
/** Shows a mode: its run where it was left (or a fresh one), the other kept as it is. */
function setMode(m) {
  if (m !== "flat" && m !== "deep") m = "flat";
  if (mode !== m && !match) save();
  mode = m;
  if (!match) { prefs.mode = m; write(KEY.prefs, prefs); }
  $("app").classList.toggle("deep", m === "deep");
  if (m === "flat") {
    if (!F) { F = loadRun(KEY.flat); if (F) L = B.deal(F.seed, F.n, F.pace || 1); }
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
/** A run kept here, if it's this version's. */
function loadRun(key) {
  const v = read(key, null);
  return v?.v === 2 ? v : null;
}

// ---------- the rules ----------
function showRules() {
  const lv = B.levelOf(1);
  let top = 1;                                          // the first level as hard as any after it
  while (top < 60 && JSON.stringify({ ...B.levelOf(top), n: 0 }) !== JSON.stringify({ ...B.levelOf(top + 1), n: 0 })) top++;
  const last = B.levelOf(top);
  $("rulesBody").innerHTML = `
    <p>Lay pipe ahead of the oil. On the board, the pieces come off a queue and go wherever you tap; in 3D, the oil comes down a shaft and you lay its pipe at the open end, a segment at a time.</p>
    <h4>The board</h4>
    <p>The next piece is the large one at the left of the queue; tap a square and it goes there. Pieces can't be turned: straights, bends and crossings come as they are, in bags of thirteen, so no shape stays away long.</p>
    <p>After a countdown (${lv.countdown / 1000} seconds on level 1) the oil leaves the wellhead and runs from piece to piece, a piece every ${lv.fill / 1000} seconds at first. It must pass through the level's quota of pipe (${lv.quota} on level 1) before it spills: off the edge, into rock, into an empty square or a piece that doesn't take it in. Short of the quota, the spill ends the run; past it, the level is cleared.</p>
    <ul>
      <li><b>Blasting</b>: tap one of your pieces the oil hasn't reached and the next piece replaces it. It costs ${-B.POINTS.blast} points and a moment before you can lay again.</li>
      <li><b>Crossings</b> carry the oil straight across either way, and it may pass through one twice, once each way: a loop, worth ${B.POINTS.loop} more.</li>
      <li><b>Pumps</b> (from level 3) are fixed straights: ${B.POINTS.pump} when the oil goes through one. <b>Tanks</b> (from level 5) take ${B.TANK} times as long to fill: time in hand.</li>
      <li><b>The terminal</b> (from level 4): lead the oil into it once the quota is met for ${B.POINTS.terminal} and a clean end to the level. Into it any sooner, it's refused: a spill.</li>
    </ul>
    <p>The dashed line shows where the oil will go as the board stands; the ringed square is where its route needs a piece next, and a red cross is where it would spill.</p>
    <p><b>Points</b>: ${B.POINTS.pipe} for each piece the oil passes through; on a level cleared, ${-B.POINTS.unused} less for each piece of yours it never reached. Oil now starts it before the countdown is out, ${B.POINTS.early} for each second left (on a level cleared); once it flows, Hurry runs it ${B.HURRY} times faster to the end of the level, and everything it fills from then scores double.</p>
    <p>Every level is faster than the one before, its quota longer and its rock more, until level ${top}: ${last.fill / 1000} seconds a piece, a quota of ${last.quota}, ${last.countdown / 1000} seconds' countdown. From there on they stay as hard.</p>
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
    <p>The times above are the Normal pace. The menu's Pace slows it down: Slower takes half as long again over everything (the countdown, the oil's every pipe or square, the wait at the wellhead), Slowest twice as long; the boards and the shaft stay the same. It changes the game under way at once. A slower game is an easier one, so it keeps bests of its own, and a game counts under the slowest pace it was played at.</p>
    <h4>Today's and together</h4>
    <p>Today's run and today's shaft are the same for everyone, dealt from the day. In a match, everyone at the table gets the same boards and pieces (or the same shaft), at the pace the match was dealt at, each on their own phone: the highest score wins. On the board, the menu's Match length sets how many levels a match runs: 5, 10, or till the spill.</p>`;
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
    settings.append(choice("Pace (the next match)", PACES, PACES.some(([v]) => v === prefs.pace) ? prefs.pace : 1, v => { prefs.pace = v; write(KEY.prefs, prefs); }));
    if (prefs.mode === "flat") settings.append(matchLength());
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const run = mode === "flat" ? F : R;
  pick ??= run?.kind === "daily" ? "daily" : "random";
  part(body, "play").append(action("New game", () => confirmStart(pick), "primary"), action("The rules", showRules, "link"));
  part(body, "content").append(choice(mode === "flat" ? "Run" : "Shaft", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  part(body, "settings").append(toggle("3D", mode === "deep", on => { $("menuDlg").close(); setMode(on ? "deep" : "flat"); }),
    choice("Pace", PACES, paceNow(), v => { setPace(v); openMenu(); }));
  part(body, "together").append(matchLength());
  // the bests at the pace you're playing at (a slower game keeps its own)
  const pace = paceNow(), at = pace > 1 ? `, ${paceName(pace).toLowerCase()}` : "";
  const fb = bestOf("flat", pace), db = bestOf("deep", pace), ft = todayOf("flat", pace), dt = todayOf("deep", pace);
  part(body, "about").append(
    line(`The board${at}: ${fb ? `best ${num(fb.score)} (level ${fb.level})` : "no run finished yet"}${ft ? `, today ${num(ft.score)}` : ""}.`),
    line(`3D${at}: ${db ? `best ${num(db.score)} (${num(db.depth)} m)` : "no descent yet"}${dt ? `, today ${num(dt.score)}` : ""}.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(kind) {
  const run = mode === "flat" ? F : R;
  const begun = run && run.phase !== "over" && (mode === "flat" ? run.n > 1 || run.P?.next > 0 : run.D.pipe.length > 1);
  if (begun && !confirm("Start a new game? This one isn't finished.")) return;
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
    pace: PACES.some(([v]) => v === prefs.pace) ? prefs.pace : 1 }),
  describe: m => {
    const pace = m.pace > 1 ? `, at the ${paceName(m.pace).toLowerCase()} pace` : "";
    return m.mode === "deep" ? `The same shaft for everyone${pace}: the highest score wins` : `The same boards for everyone, ${m.length ? `${m.length} levels` : "till the spill"}${pace}: the highest score wins`;
  },
  extra: () => null,
  play: (m, { kept }) => {
    cancelAnimationFrame(raf);
    match = { mode: m.mode === "deep" ? "deep" : "flat", seed: m.seed, length: m.length || 0, pace: m.pace || 1 };
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
  $("board").replaceChildren(); cellG = [];
  $("board").hidden = false; $("shaft").hidden = true;
  $("flatControls").hidden = false; $("deepControls").hidden = true;
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
$("goBtn").addEventListener("click", () => {
  if (IN_FRAME || mode !== "flat" || F?.phase !== "play" || !F.P) return;
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
  const kept = mode === "flat" ? F : R;
  if (!kept || match || IN_FRAME || !!kept.still === on) return;
  if (on) kept.still = true; else delete kept.still;
  save();
}
onPause(() => { if (!match) { cancelAnimationFrame(raf); held = true; standStill(true); } }, () => { if (held) { held = false; standStill(false); run(); } });
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
window.__pipes = { get F() { return F; }, get L() { return L; }, get R() { return R; }, get S() { return S; }, get mode() { return mode; }, B, G, step, tapSquare, act, setMode, startFlat, startDeep, duel };

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
  const shown = read(KEY.prefs, {})?.mode;                  // your own mode, whatever a match just played
  setMode(shown === "deep" ? "deep" : "flat");
  const kept = mode === "flat" ? F : R;
  if (IN_FRAME && kept?.at && !kept.still) catchUp(Date.now() - kept.at);
  run();
}
// a match in the address: its run, with no solo one dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });
else solo();
