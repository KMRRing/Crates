// Slitherlink: draw one loop along the edges of a grid of dots; each number says how many of its cell's four sides the
// loop uses, and the loop never crosses or touches itself; a shaded puzzle also marks some cells as inside the loop
// (tinted) or outside it (dotted). The rules, the puzzles and the reasoning are
// slitherlink-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles
// are made in slitherlink-worker.js. This file keeps the run, the clock and the taps, and draws the board.
import { SIZES, LEVELS, DAILY, NONE, LINE, CROSS, INSIDE, OUTSIDE, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "./slitherlink-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";
import { sure } from "./sure.js";
import { cellEdit, tallyEdit, onceEdit } from "./board-share.js";
import slkCoop from "./slitherlink-coop.js";

const $ = id => document.getElementById(id);
const RUN = "slitherlink:run", TIMES = "slitherlink:times", PREFS = "slitherlink:prefs", SPARES = "slitherlink:spares";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to cross an edge instead of cycling it
const REACH = 0.4;                   // how far from an edge, in cells, a finger still means that edge

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const shadeOn = t => t === "shade";
const kindText = k => `${k.size}×${k.size} · ${LEVELS[k.level]}${shadeOn(k.twist) ? " · Shaded" : ""}`;
const kindKey = k => `${k.size}:${k.level}${shadeOn(k.twist) ? ":shade" : ""}`;

// ---------- played with a partner ----------
// A party of two opened this page (&coop=1, docs/coop.md): the board is the room's, one board for two phones, and what
// this file does to it goes through `coop.edit` as edits instead of a change to S.marks. S is then built from the room's
// board each time it moves (showBoard); undo, redo and a hint's gilt stay each player's own. The clock is the team's.
const COOP = !IN_FRAME && /[?&]coop=1\b/.test(location.search) && /[?&]room=[A-Za-z]{4}\b/.test(location.search);
let coop = null;                       // coop-page.js's controller once the room's board is on the screen
let coopHost = false, team = null, sentDone = false;     // this phone is the host's; the board's start ({ at, ms, hints }); the solve is on its way
const teamMs = () => (team ? (team.ms || 0) + Math.max(0, Date.now() - team.at) : 0);
const hintId = () => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- what you chose ----------
const prefs = { size: 7, level: "easy", twist: "none", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 7;
if (!LEVELS[prefs.level]) prefs.level = "easy";
if (!shadeOn(prefs.twist)) prefs.twist = "none";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ size: prefs.size, level: levelOn(prefs.size, prefs.level), twist: prefs.twist });

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Hitori's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level, shadeOn(k.twist)));
  try {
    worker ||= new Worker(new URL("./slitherlink-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.size, w.k.level, shadeOn(w.k.twist)));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.size, k.level, shadeOn(k.twist))); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, level: k.level, shade: shadeOn(k.twist) }); });
}
const SPARE_KINDS = 6;                 // spares kept for the kinds played most lately
function takeSpare(k) {
  const all = read(SPARES, {}), spare = all[kindKey(k)];
  if (!spare?.puzzle?.grid) return null;
  delete all[kindKey(k)];
  write(SPARES, all);
  return spare;
}
let refilling = false;
function refill(k) {
  if (IN_FRAME || refilling || read(SPARES, {})[kindKey(k)]) return;
  refilling = true;
  const seed = randomSeed();
  make(seed, k).then(puzzle => {
    refilling = false;
    if (!puzzle) return;
    const all = read(SPARES, {});
    all[kindKey(k)] = { seed, puzzle, at: Date.now() };
    const keys = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
    for (const old of keys.slice(SPARE_KINDS)) delete all[old];
    write(SPARES, all);
  });
}
/** A new puzzle of a kind: the spare if there is one (instant), else made now, the mark showing if it takes a moment. */
async function nextPuzzle(k) {
  const spare = takeSpare(k);
  if (spare) { setTimeout(() => refill(k), 400); return spare; }
  const seed = randomSeed(), done = busy("Making the puzzle", { delay: 250 });
  try { return { seed, puzzle: await make(seed, k) }; } finally { done(); setTimeout(() => refill(k), 400); }
}

// ---------- the run ----------
// S: { v, mode ("random" or "daily"), seed, size, level (asked), twist ("shade", or none), came (what it graded), grid, sol, marks, undo, redo, ms,
//      hints, done ({ ms, score } once solved), lit (a hint's edges, its place and its words), fresh (a new best) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const valid = s => !!s && s.v === 1 && SIZES.includes(s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.marks.length && s.grid.length === s.size * s.size && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  if (COOP) {       // the host's own run follows the shared board (it is theirs again when the co-op ends); the guest's is left alone
    if (coopHost) write(RUN, { ...S, undo: [], redo: [], lit: null, ms: Math.round(teamMs()) });
    return;
  }
  write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.done && (S.marks.includes(LINE) || S.marks.includes(CROSS) || S.hints > 0);

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleOf(S.size, S.grid, S.sol);
  message = null; clockFrom = null;
  $("level").value = levelOn(S.size, S.level);
  if (!IN_FRAME) history.replaceState(null, "", hashOf(S));
  drawBoard();
  save();
  clockRun();
  render();
}
/** A new solo puzzle: today's, or a random one of the kind chosen. */
async function start(mode, k = chosenKind()) {
  if (IN_FRAME) return;
  if (COOP) {       // another puzzle for both of you
    if (!coop) return;
    const { seed, puzzle } = await nextPuzzle(k);
    if (puzzle) await coop.renew(shareOf(fromPuzzle("random", seed, k, puzzle)));
    return;
  }
  if (mode === "daily") {
    const done = busy("Making today's puzzle", { delay: 250 });
    let puzzle;
    try { puzzle = await make(today(), DAILY); } finally { done(); }
    if (puzzle) begin(fromPuzzle("daily", today(), DAILY, puzzle));
    return;
  }
  const { seed, puzzle } = await nextPuzzle(k);
  if (puzzle) begin(fromPuzzle("random", seed, k, puzzle));
}
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, size: k.size, level: k.level, twist: puzzle.shade ? "shade" : "none", came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: NONE.repeat(puzzle.sol.length) });
/** The shared board for a puzzle (what the host's run becomes when a partner joins). */
const shareOf = run => slkCoop.share({ [RUN]: JSON.stringify({ v: 1, ms: 0, hints: 0, ...run }) });
async function confirmStart(mode, k) {
  if (started() && !(await sure(coop ? "Start a new puzzle for both of you? This one isn't solved." : "Start a new puzzle? This one isn't solved.", { yes: "New puzzle" }))) return false;
  start(mode, k);
  return true;
}

// ---------- the clock ----------
// A puzzle counts the time it's on screen (S.ms); it stands while the menu, the rules or the games screen is open.
function clockRun() {
  if (COOP || IN_FRAME || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); cancelPress(); }, () => { paused = false; clockRun(); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : COOP ? teamMs() : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in slitherlink:times by size, level and shading, lowest first, not slitherlink:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, slitherlink:today).
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, level: s.came || s.level, twist: s.twist })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, level: S.came || S.level, twist: S.twist }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
/** A tap cycles the edge (clear, line, crossed); a hold crosses it, or clears it if crossed. */
function press(e, how) {
  if (!S || S.done || IN_FRAME || paused || e < 0) return;
  const from = S.marks[e], to = how === "hold" ? (from === CROSS ? NONE : CROSS) : nextMark(from);
  setEdge(e, from, to);
  if (to === LINE) navigator.vibrate?.(8);
}
function setEdge(e, from, to, undoable = true, weak = false) {
  if (from === to) return;
  if (coop) coop.edit(cellEdit("marks", e, from, to, weak));      // shows at once (showBoard) and goes to the room
  else S.marks = withMark(S.marks, e, to);
  if (undoable) { S.undo.push([e, from, to]); if (S.undo.length > 400) S.undo.shift(); S.redo = []; }
  S.lit = null;
  changed(e);
}
function undo() {
  const last = S?.undo.pop();
  if (!last || S.done) return;
  const [e, from, to] = last;
  S.redo.push(last);
  setEdge(e, to, from, false, true);        // an undo only puts back what is still as you left it: a mark your partner changed since stays theirs
}
function redo() {
  const next = S?.redo.pop();
  if (!next || S.done) return;
  const [e, from, to] = next;
  S.undo.push(next);
  setEdge(e, from, to, false);
}
/** After any change: the line says what broke (from the rules alone, never the answer), the end is settled the moment
 *  the lines are the answer, and the run is kept. */
function changed(at = -1) {
  const br = breaks(P, S.marks);
  if (at >= 0 && S.marks[at] === LINE) {
    const g = P.g, over = g.ecells[at].some(k => br.over.includes(k)), three = [g.ea[at], g.eb[at]].some(x => g.vedges[x].filter(f => S.marks[f] === LINE).length > 2);
    if (over) note("A number has more lines round it than it says.", "bad");
    else if (three) note("Three lines meet at a corner: the loop passes through a corner once.", "bad");
    else if (br.loop.includes(at)) note("That closes a loop that isn't the answer: the loop must meet every number.", "bad");
    else if (g.ecells[at].some(k => br.shade.includes(k))) note("That leaves a shaded cell outside the loop or a dotted one inside it.", "bad");
    else message = null;
  } else if (at >= 0) message = null;
  if (!S.done && solvedBy(P, S.marks)) finish();
  else save();
  paint();
  render();
}
function note(text, tone = "") { message = text ? { text, tone } : null; }

// ---------- hints ----------
/** A step of reasoning in words, as a hint says it. */
function explain(x) {
  const many = x.set.length > 1;
  switch (x.tech) {
    case "full": return `This number has all its lines: the ${many ? "other sides are" : "other side is"} crossed.`;
    case "short": return `This number needs every side it has left: ${many ? "they are lines" : "it is a line"}.`;
    case "two": return `A corner the loop already passes through is done: ${many ? "its other sides are" : "its other side is"} crossed.`;
    case "through": return "A line runs into this corner and has only one way on: it is a line.";
    case "dead": return "A corner with one side left can't be passed through: that side is crossed.";
    case "sides": return x.set[0][1] === 1
      ? "The shading and the lines so far put the two sides of this edge on opposite sides of the loop (one inside, one outside): it is a line."
      : "The shading and the lines so far put the two sides of this edge on the same side of the loop (both inside or both outside): it is crossed.";
    case "loop": return "A line here would join the two ends of one path and close a loop before the rest is drawn: it is crossed.";
    case "closed": return "The loop is closed, so nothing else is part of it: every other edge is crossed.";
    case "trial": {
      const was = x.supposed === 1 ? "a line" : "crossed", is = x.supposed === 1 ? "crossed" : "a line";
      return `Suppose it were ${was}: ${x.depth > 1 ? `${x.depth} rounds of consequences on, ` : ""}the rules break. So it is ${is}.`;
    }
  }
  return "";
}
function useHint() {
  if (!S || S.done || IN_FRAME || paused) return;
  const h = hintFor(P, S.marks);
  if (!h) return;
  if (!coop) S.hints++;
  let set, text, cell = null, cell2 = null, vertex = null;
  if (h.wrong != null) {
    set = [[h.wrong, h.should]];
    text = h.should === CROSS ? "Hint: this one isn't part of the loop. It is crossed now." : "Hint: this one is part of the loop. It is drawn now.";
  } else if (h.step) {
    set = h.step.set.map(([e, v]) => [e, String(v)]);
    ({ cell, cell2, vertex } = h.step);
    const said = explain(h.step);
    text = `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    set = [[h.reveal, h.should]];
    text = h.should === LINE ? "Hint: this one is part of the loop." : "Hint: this one isn't part of the loop.";
  }
  if (coop) {       // the marks and the hint taken, together: the hint counts once for both of you
    const marks = set.filter(([e, m]) => S.marks[e] !== m);
    for (const [e, m] of marks) S.undo.push([e, S.marks[e], m]);
    S.redo = [];
    coop.edit([...marks.map(([e, m]) => cellEdit("marks", e, S.marks[e], m)), tallyEdit("hints", hintId())]);
  } else for (const [e, m] of set) setEdge(e, S.marks[e], m);
  S.lit = { set: set.map(([e]) => e), cell: cell ?? null, cell2: cell2 ?? null, vertex: vertex ?? null, text };
  message = null;
  save();
  paint();
  render();
}

// ---------- the end ----------
/** The loop is the answer: the time stands for both of you, whoever saw it first (a value that is set once, board-share.js). */
function finishTogether() {
  if (S.done || sentDone || !coop) return;
  sentDone = true;
  const ms = Math.round(teamMs());
  coop.edit(onceEdit("done", { ms, score: scoreOf(ms), by: coop.together.room?.name || "" }));
}
function finish() {
  if (coop) { finishTogether(); return; }
  const ms = S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
  clockFrom = null;
  S.done = { ms, score: scoreOf(ms) };
  S.lit = null;
  S.fresh = recordBest(S.done.score);
  if (S.mode === "daily") noteDayTime("slitherlink", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("slitherlink");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
/** The numbers are set a hundred times larger and scaled back down, centred by an explicit offset: Safari lays out text
 *  under a unit tall badly (as Hitori's and Delta's are). */
const TEXT_SCALE = 100;
let svg = null, edgeEls = [], cellEls = [], dotEls = [];
function drawBoard() {
  const { R, C, E, V, cells, ea, eb } = P.g, pad = 0.4, at = x => [x % (C + 1), Math.floor(x / (C + 1))];
  svg = svgEl("svg", { viewBox: `${-pad} ${-pad} ${C + 2 * pad} ${R + 2 * pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap an edge to draw it, again to cross it.`, class: `slk-svg${P.shaded ? " shaded" : ""}` });
  svgEl("rect", { x: -pad / 2, y: -pad / 2, width: C + pad, height: R + pad, rx: 0.12, class: "slk-paper" }, svg);
  cellEls = Array.from({ length: cells }, (_, k) => {
    const x = k % C + 0.5, y = Math.floor(k / C) + 0.5, g = svgEl("g", { class: "slk-cell" }, svg);
    svgEl("rect", { x: x - 0.4, y: y - 0.4, width: 0.8, height: 0.8, rx: 0.1, class: "slk-ring" }, g);
    const n = P.clue[k];
    if (n === INSIDE) svgEl("rect", { x: x - 0.4, y: y - 0.4, width: 0.8, height: 0.8, rx: 0.1, class: "slk-in-mark" }, g);       // inside the loop: the cell tinted
    if (n === OUTSIDE) svgEl("circle", { cx: x, cy: y, r: 0.13, class: "slk-out-mark" }, g);                                         // outside it: a dot
    if (n < 0 || n > 4) return { g };
    const t = svgEl("text", { x: 0, y: 0, dy: "0.36em", class: "slk-num", "font-size": 0.56 * TEXT_SCALE, transform: `translate(${x} ${y}) scale(${1 / TEXT_SCALE})` }, g);
    t.textContent = String(n);
    return { g };
  });
  edgeEls = Array.from({ length: E }, (_, e) => {
    const [x1, y1] = at(ea[e]), [x2, y2] = at(eb[e]), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, g = svgEl("g", { class: "slk-e" }, svg);
    svgEl("line", { x1, y1, x2, y2, class: "slk-guide" }, g);
    svgEl("line", { x1, y1, x2, y2, class: "slk-seg" }, g);
    svgEl("path", { d: `M${mx - 0.1} ${my - 0.1}L${mx + 0.1} ${my + 0.1}M${mx - 0.1} ${my + 0.1}L${mx + 0.1} ${my - 0.1}`, class: "slk-x" }, g);
    return { g, d: Math.round((mx + my) * 40) };
  });
  dotEls = Array.from({ length: V }, (_, x) => { const [cx, cy] = at(x); return svgEl("circle", { cx, cy, r: 0.07, class: "slk-dot" }, svg); });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** Each edge's look from the run: line, crossed, lit by a hint, part of a wrong loop; each number's: met, over, a hint's. */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), over = new Set([...br.over, ...br.shade]), met = new Set(br.met), wrong = new Set(br.loop), bad = new Set(br.bad);
  const lit = new Set(S.lit?.set || []);
  for (let e = 0; e < edgeEls.length; e++) {
    const m = S.marks[e], cls = ["slk-e", m === LINE ? "ln" : m === CROSS ? "cr" : "", lit.has(e) ? "lit" : "", wrong.has(e) ? "wrong" : ""].filter(Boolean).join(" ");
    if (edgeEls[e].g.getAttribute("class") !== cls) edgeEls[e].g.setAttribute("class", cls);
  }
  cellEls.forEach(({ g }, k) => {
    const cls = ["slk-cell", over.has(k) ? "over" : met.has(k) ? "met" : "", S.lit?.cell === k || S.lit?.cell2 === k ? "why" : ""].filter(Boolean).join(" ");
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
  dotEls.forEach((d, x) => d.setAttribute("class", `slk-dot${bad.has(x) ? " bad" : S.lit?.vertex === x ? " lit" : ""}`));
}
/** The solve, shown: the loop turns gilt from the top left. */
function wave() {
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  edgeEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
  svg.classList.add("solved");
}

// ---------- the board under a finger: a tap cycles an edge, a hold crosses it ----------
let pressing = null;   // { id, edge, x, y, timer, held }
/** The edge nearest a finger, if one is close enough: the nearest grid line of either kind. */
function edgeAt(ev) {
  const m = svg?.getScreenCTM();
  if (!m) return -1;
  const { x, y } = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()), { R, C, H } = P.g;
  const gx = Math.min(C, Math.max(0, Math.round(x))), gy = Math.min(R, Math.max(0, Math.round(y)));
  const dv = Math.abs(x - gx), dh = Math.abs(y - gy);
  if (Math.min(dv, dh) > REACH) return -1;
  if (dh <= dv) return gy * C + Math.min(C - 1, Math.max(0, Math.floor(x)));
  return H + Math.min(R - 1, Math.max(0, Math.floor(y))) * (C + 1) + gx;
}
function down(ev) {
  if (ev.button > 0) { if (ev.button === 2) press(edgeAt(ev), "hold"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  ev.preventDefault();
  cancelPress();
  const edge = edgeAt(ev);
  if (edge < 0) return;
  try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: ev.pointerId, edge, x: ev.clientX, y: ev.clientY, held: false };
  pressing.timer = setTimeout(() => { if (!pressing) return; pressing.held = true; navigator.vibrate?.(14); press(pressing.edge, "hold"); }, HOLD);
}
function cancelPress() { if (pressing) clearTimeout(pressing.timer); pressing = null; }
addEventListener("pointermove", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  if (Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) > 12 * scale()) cancelPress();   // a slip off the edge is no tap
});
addEventListener("pointerup", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const { edge, held } = pressing;
  cancelPress();
  if (!held) press(edge, "tap");
});
addEventListener("pointercancel", cancelPress);

// ---------- drawing the rest ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S) { put("time", "0:00"); put("penalty", ""); put("kind", ""); return; }
  put("time", fmt(elapsed() / 1000 + penalty()));
  put("penalty", penalty() ? `+${penalty()} s` : "");
  put("kind", `${S.mode === "daily" ? "Today · " : ""}${kindText({ size: S.size, level: S.came || S.level, twist: S.twist })}`);
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (S.came && S.came !== S.level && !S.marks.includes(LINE)) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!S.marks.includes(LINE) && !S.marks.includes(CROSS)) text = `Tap an edge to draw it, again to cross it (not part of the loop), again to clear it. Hold an edge to cross it.${shadeOn(S.twist) ? " A tinted cell is inside the loop, a dotted one outside." : ""}`;
  else text = shadeOn(S.twist) ? "One loop, through no corner twice, every number met, shaded cells inside it and dotted ones outside." : "One loop, through no corner twice, with every number met.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `slk-say${tone ? ` ${tone}` : ""}`;
}
function drawResult() {
  const done = !!S?.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const d = S.done, bits = [`${fmt(d.ms / 1000)} on the clock`], best = COOP ? null : bestOf(S);
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${penalty()} s)`);
  if (COOP) { $("verdict").textContent = `Solved together: ${fmt(d.score)}. ${bits.join(", ")}.`; return; }
  const tail = S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
  $("verdict").textContent = `Solved: ${fmt(d.score)}. ${bits.join(", ")}.${tail}`;
}
function render() {
  const off = !S || !!S.done || IN_FRAME;
  for (const b of [$("undoBtn"), $("redoBtn"), $("hintBtn")]) b.disabled = off;
  if (S && !off) { $("undoBtn").disabled = !S.undo.length; $("redoBtn").disabled = !S.redo.length; }
  if (!S) $("board").replaceChildren();
  drawStrip(); drawLine(); drawResult();
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
// the rules: a sheet of their own, from the header's Rules and the menu
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Draw one closed loop along the lines between the dots. Every number says how many of the four sides of its cell the loop uses. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>The rules</h4>
    <p>The loop is a single closed ring: it never crosses itself, never branches, and never touches itself at a corner, so every dot it uses has exactly two lines. A cell without a number can have any number of sides on the loop, and the loop need not reach every dot.</p>
    <p><b>An example.</b> A 0 has none of its sides in the loop, so all four are crossed. A 3 beside a 0 must use its three other sides. And a corner with a line coming in and only one way on has to take it.</p>
    <h4>Playing</h4>
    <p>Tap an edge to draw it, again to cross it (a small mark for "not part of the loop", a note for yourself), again to clear it; hold an edge, or right-click it, to cross it at once. Only the lines count: the puzzle is solved the moment exactly its answer is drawn. Undo and Redo step through your marks, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: a number with too many lines in oxblood, three lines at a corner, a dead end, or a loop closed round the wrong cells. That comes from the rules, never the answer. A number turns pale once it has all its lines. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it makes the next step a person would take and says why, the edges it settled in gilt.</p>
    <h4>Shaded puzzles</h4>
    <p>The menu's Clues choice, With shading, marks some cells as being on one side of the loop: a <b>tinted</b> cell is inside the loop, a <b>dotted</b> one outside it (a cell with one of these has no number). The loop is the line between inside and outside, so a line runs between a tinted cell and a dotted one, never between two tinted or two dotted; and the sides carry on through the lines you have drawn and crossed, so a tinted cell with a crossed edge to its neighbour makes that neighbour tinted too. A cell that clashes with what you have drawn turns oxblood. The outside of the board counts as outside.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how many numbers it shows. <b>Easy</b>: the numbers and the corners alone (a number with all its lines crosses its other sides; a corner with two lines is done; a line with one way on takes it; a line may not close the loop early). <b>Medium</b>: a short trial as well, an edge supposed one way and followed for a couple of rounds until a rule breaks. <b>Hard</b>: a trial followed as far as it goes, with few numbers to help. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size, level and kind of clue. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A 7×7 at Medium, the same for everyone. Its first solve counts the moment the loop is drawn, and is Slitherlink's figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// the menu: Play (a new puzzle, clearing the board, the rules), Content (random or today's, the size, the level), About
let pick = null;                                              // what New puzzle starts: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const content = part(body, "content");
  pick = COOP ? "random" : pick ?? (S?.mode === "daily" ? "daily" : "random");
  const play = part(body, "play");
  play.append(action(COOP ? "Another puzzle" : "New puzzle", () => confirmStart(pick), "primary"));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action("The rules", showRules, "link"));
  if (!COOP) content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") {
    content.append(choice("Size", SIZES.map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
    content.append(mirror("Level", $("level")));
    content.append(choice("Clues", [["none", "Numbers"], ["shade", "With shading"]], prefs.twist, v => { prefs.twist = v; savePrefs(); kindChanged(); openMenu(); }));
  } else content.append(line(`Today's puzzle is ${kindText(DAILY)}: the same for everyone.`));
  if (coop) part(body, "together").append(line(`Co-op with ${coop.otherName}: one board for you both.`), action(coop.host ? "End the co-op" : "Leave the co-op", () => coop.leave(), "link"));
  const best = S && !COOP ? bestOf(S) : null;
  const about = part(body, "about");
  about.append(line(S ? `${kindText({ size: S.size, level: S.came || S.level, twist: S.twist })}: ${COOP ? (S.done ? "solved" : "not solved yet") : best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Draw the loop."));
  if (!COOP) about.append(action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The size changed in the menu: the header's level follows, and a spare is made ready. */
function kindChanged() {
  const k = chosenKind();
  $("level").value = k.level;
  refill(k);
}
async function clearBoard() {
  if (!S || S.done) return;
  if (!(await sure(coop ? "Clear every mark on the board? It clears it for both of you." : "Clear every mark on the board?", { yes: "Clear" }))) return;
  if (S.done) return;
  if (coop) {
    const marks = [...S.marks].map((m, e) => (m !== NONE ? [e, m] : null)).filter(Boolean);
    for (const [e, m] of marks) S.undo.push([e, m, NONE]);
    S.redo = [];
    S.lit = null;
    coop.edit(marks.map(([e, m]) => cellEdit("marks", e, m, NONE)));
    changed();
    return;
  }
  for (let e = 0; e < S.marks.length; e++) if (S.marks[e] !== NONE) setEdge(e, S.marks[e], NONE);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- links: #s=SEED&n=7&l=medium&t=shade (#d= for a day's; t only for a shaded puzzle) ----------
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}${shadeOn(s.twist) ? "&t=shade" : ""}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const size = SIZES.includes(Number(h.get("n"))) ? Number(h.get("n")) : 7;
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium"), twist: !h.get("d") && h.get("t") === "shade" ? "shade" : "none" } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle));
}

// ---------- wiring ----------
dropdown($("level"));   // the header dropdown in the suite's style (see dropdown.js)
bindSwitcher($("appsBtn"), "slitherlink");
document.querySelector(".slk-mark").innerHTML = APPS.find(a => a.id === "slitherlink")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => start("random"));
$("level").addEventListener("change", async () => {
  const v = $("level").value;
  if (S && S.mode !== "daily" && v === S.level && S.size === prefs.size) return;
  const before = prefs.level;
  prefs.level = v; savePrefs();
  if (!(await confirmStart("random"))) { prefs.level = before; savePrefs(); $("level").value = S ? levelOn(S.size, S.level) : before; }
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); coop?.together.resync(); } });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { if (COOP) return; const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__slitherlink = {
  get state() { return S; }, get puzzle() { return P; }, get coop() { return coop; }, press, useHint, undo, redo, start, edgeAt,
  /** Where an edge's middle is on the screen, for tests that tap it as a finger would. */
  screenOf: e => {
    const m = svg.getScreenCTM(), { ea, eb, C } = P.g, at = x => [x % (C + 1), Math.floor(x / (C + 1))];
    const [x1, y1] = at(ea[e]), [x2, y2] = at(eb[e]), x = (x1 + x2) / 2, y = (y1 + y2) / 2;
    return { x: x * m.a + m.e, y: y * m.d + m.f };
  },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
async function solo() {
  const kept = read(RUN, null);
  S = null;
  if (valid(kept)) S = kept;
  const l = linked();
  if (l && !(S && S.seed === l.seed && S.mode === l.mode && S.size === l.k.size)) { openLinked(l); return; }
  const todays = forToday && !IN_FRAME && !(S?.mode === "daily" && S.seed === today());
  if (S) { const s = S; S = null; begin(s); if (!IN_FRAME) refill(chosenKind()); }       // yours is on the board while it asks about today's
  if (todays && (!S || !started() || await sure("Today's puzzle is waiting. Leave the one you've started?", { yes: "Today's puzzle", no: "Keep mine" }))) { start("daily"); return; }
  if (!S) { if (IN_FRAME) render(); else start("random"); }
}

/** The board of a party of two: the room's, drawn each time it moves (coop-page.js). */
function showBoard(board, info) {
  const run = slkCoop.run(board), wasDone = !!S?.done;
  team = board.start || team;
  coopHost = info.host;
  if (info.fresh || !S) {
    S = { undo: [], redo: [], ms: 0, lit: null, ...run };
    P = puzzleOf(S.size, S.grid, S.sol);
    message = null; sentDone = false;
    $("level").value = levelOn(S.size, S.level);
    drawBoard();
  } else {
    S.marks = run.marks; S.hints = run.hints; S.done = run.done;
  }
  if (S.done) S.lit = null;
  else if (solvedBy(P, S.marks)) finishTogether();
  if (S.done && !wasDone && !info.fresh) wave();
  save();
  paint();
  render();
}
async function joinPartner() {
  const { startCoop } = await import("./coop-page.js");
  coop = await startCoop("slitherlink", {
    toast, show: showBoard,
    fresh: async () => { const k = chosenKind(), { seed, puzzle } = await nextPuzzle(k); return shareOf(fromPuzzle("random", seed, k, puzzle)); },
    bar: el => { $("kind").hidden = true; $("kind").after(el); },
  });
  if (!coop && !IN_FRAME) solo();
}
$("level").value = chosenKind().level;
if (COOP) joinPartner().catch(e => { console.error(e); solo(); }); else solo();
