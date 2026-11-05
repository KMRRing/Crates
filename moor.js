// Moor: moor a barge beside every dock. Each dock gets exactly one barge, orthogonally beside it; no two barges touch (not even
// corner to corner); the numbers round the board are the barges in each row and column. The rules, the puzzles and the
// reasoning are moor-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles
// are made in moor-worker.js. This file keeps the run, the clock and the taps, and draws the board; the harbour in 3D is
// moor-3d.js's, loaded when first asked for (as Bridges' is).
import { SIZES, HEX_SIZES, HEX_LEVELS, LEVELS, DAILY, TWISTS, NONE, BARGE, WATER, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn, lineLabel, cluesOf, wallsOf, boardOf, sizeOn, twistOn, hasTwist, twistName, flagsOf } from "./moor-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, ticks, action, line, onPause, isPaused, todayPart } from "./menu.js";
import { ramp } from "./ramp.js";
import { rungs, startFor, split } from "./ramp-steps.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { wants3D, onDefaultChange } from "./mode3d.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";
import { sure } from "./sure.js";

const $ = id => document.getElementById(id);
const RUN = "moor:run", TIMES = "moor:times", PREFS = "moor:prefs", SPARES = "moor:spares";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const DRAG = 12;                     // px a finger moves before a press is a stroke, painting cell after cell

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const shapeOf = o => (o?.shape === "hex" ? "hex" : "square");
/** A kind of puzzle in words: 8×8 · Medium; Hex 7 · Hard · Sea walls + Ranges. */
const SHORT = { walls: "Walls", doubles: "Doubles", ranges: "Ranges" };
const kindText = (k, short = false) => `${shapeOf(k) === "hex" ? `Hex ${k.size}` : `${k.size}×${k.size}`} · ${LEVELS[k.level]}${hasTwist(k.twist) ? ` · ${short ? twistOn(k.twist).split("+").map(t => SHORT[t]).join(" + ") : twistName(k.twist)}` : ""}`;
/** What a kind is kept under (spares, bests): a plain square puzzle's key is what it always was. */
const kindKey = k => (shapeOf(k) === "square" && !hasTwist(k.twist) ? `${k.size}:${k.level}` : `${shapeOf(k)}:${twistOn(k.twist)}:${k.size}:${k.level}`);

// ---------- what you chose ----------
const prefs = { size: 8, level: "easy", board: "square", twists: "none", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 8;
if (!LEVELS[prefs.level]) prefs.level = "easy";
if (prefs.board !== "hex") prefs.board = "square";
prefs.twists = twistOn(prefs.twists);
// prefs.view is the player's own choice ("model" or "2d"), kept only when they make one; with none the suite's default applies (mode3d.js).
// ("chart" was the old default, written into every save: dropped.) `viewShown` is what is on the screen now.
if (prefs.view !== "model" && prefs.view !== "2d") delete prefs.view;
let viewShown = wants3D(prefs.view, "model") ? "model" : "chart";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
// Korbi, 4 November 2026: the menu is the minimum it needs to be. Size and level are one hidden ramp, its first rung the old
// saved choice; the ladder steps up after a puzzle solved without a hint.
// Each board has a ramp of its own (`moor:ramp` for the square one, as ever; `moor:ramp:hex`), and the twists ticked in the menu are dealt at whatever rung it is on.
const LEVEL_KEYS = Object.keys(LEVELS);
const RUNGS = { square: rungs(SIZES, LEVEL_KEYS), hex: rungs(HEX_SIZES, LEVEL_KEYS, (s, l) => HEX_LEVELS[s].includes(l)) };
const OLD = { size: prefs.size, level: prefs.level };
const chosenKind = () => {
  const hex = prefs.board === "hex", { size, level } = split(ramp("moor", RUNGS[prefs.board], hex ? { id: "hex" } : { start: startFor(RUNGS.square, SIZES, LEVEL_KEYS, OLD.size, OLD.level) }));
  return { size: Number(size), level: levelOn(Number(size), level, prefs.board), twist: prefs.twists, shape: prefs.board };
};

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level, k.twist, k.shape));
  try {
    worker ||= new Worker(new URL("./moor-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.size, w.k.level, w.k.twist, w.k.shape));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.size, k.level, k.twist, k.shape)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, level: k.level, twist: k.twist, shape: k.shape }); });
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
// S: { v, mode ("random" or "daily"), seed, size, level (asked), came (what it graded), grid, sol, marks (a character a
//      cell: 0 clear, 1 barge, 2 open water), undo, redo (each [cell, from, to, stroke]: a stroke's cells undo together),
//      ms, hints, done ({ ms, score } once solved), lit (a hint's cells, the cells it read and its words), fresh (a new best);
//      and, when the puzzle has them, shape ("hex"), walls (text), ranges (a character a line), twist (what was asked) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const valid = s => !!s && s.v === 1 && sizeOn(shapeOf(s), s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.marks.length && s.grid.length === boardOf(shapeOf(s), s.size).cells && s.marks.length === s.grid.length && Number.isFinite(s.ms)
  && (s.walls == null || typeof s.walls === "string") && (s.ranges == null || (typeof s.ranges === "string" && s.ranges.length === boardOf(shapeOf(s), s.size).lines.length));
/** The engine's puzzle for a run. */
const puzzleFor = s => puzzleOf(s.size, s.grid, s.sol, { shape: shapeOf(s), walls: s.walls || "", ranges: s.ranges || "" });
/** The twists a puzzle holds, as a twist name: what is in it, not what was asked. */
const twistsOf = s => twistOn([s.walls ? "walls" : "", /2/.test(s.grid) ? "doubles" : "", s.ranges ? "ranges" : ""].filter(Boolean).join("+"));

function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.done && (/[12]/.test(S.marks) || S.hints > 0);

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleFor(S);
  if (viewShown === "model" && !can3D()) setView("chart", false);
  message = null; clockFrom = null;
  if (!IN_FRAME) history.replaceState(null, "", hashOf(S));
  drawBoard();
  save();
  clockRun();
  render();
}
/** A new solo puzzle: today's, or a random one of the kind chosen. */
async function start(mode, k = chosenKind()) {
  if (IN_FRAME) return;
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
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: NONE.repeat(puzzle.sol.length),
  ...(shapeOf(k) === "hex" ? { shape: "hex" } : {}), ...(hasTwist(k.twist) ? { twist: twistOn(k.twist) } : {}), ...(puzzle.walls ? { walls: puzzle.walls } : {}), ...(puzzle.ranges ? { ranges: puzzle.ranges } : {}) });
/** The kind a run was dealt as. */
const kindOfRun = s => ({ size: s.size, level: s.level, twist: s.twist || "none", shape: shapeOf(s) });
async function confirmStart(mode, k) {
  if (started() && !(await sure("Start a new puzzle? This one isn't solved.", { yes: "New puzzle" }))) return false;
  start(mode, k);
  return true;
}

// ---------- the clock ----------
// A puzzle counts the time it's on screen (S.ms); it stands while the menu, the rules or the games screen is open.
function clockRun() {
  if (IN_FRAME || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); cancelPress(); model?.hold(true); }, () => { paused = false; clockRun(); model?.hold(false); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in moor:times by size and level, lowest first, not moor:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, moor:today).
const bestOf = s => read(TIMES, {})[kindKey({ ...kindOfRun(s), level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ ...kindOfRun(S), level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
let strokeAt = 0;                    // a stroke painted over several cells is one step to undo: its cells share a number
const newStroke = () => (strokeAt = Math.max(Date.now(), strokeAt + 1));   // (a time, so a saved run's numbers never meet a new one)
/** A tap cycles the cell (clear, barge, open water); a right-click marks open water, or clears it if marked. A dock can't be marked. */
function press(x, how) {
  if (!S || S.done || IN_FRAME || paused || x < 0 || P.dock[x]) return;
  const from = S.marks[x], to = how === "dot" ? (from === WATER ? NONE : WATER) : nextMark(from);
  setCell(x, from, to);
  if (to === BARGE) navigator.vibrate?.(8);
}
function setCell(x, from, to, stroke = 0) {
  if (from === to) return;
  S.marks = withMark(S.marks, x, to);
  S.undo.push([x, from, to, stroke]);
  if (S.undo.length > 400) S.undo.shift();
  S.redo = [];
  S.lit = null;
  changed(x);
}
/** Takes back (or does again) the last step: one cell, or every cell of the stroke it was part of. */
function step(from, to, back) {
  if (!S || S.done) return;
  const last = from.at(-1);
  if (!last) return;
  const group = last[3] || -1;
  do {
    const [x, was, now] = from.pop();
    to.push([x, was, now, group > 0 ? group : 0]);
    S.marks = withMark(S.marks, x, back ? was : now);
  } while (group > 0 && from.at(-1)?.[3] === group);
  S.lit = null;
  changed(-1);
}
const undo = () => step(S?.undo || [], S?.redo || [], true);
const redo = () => step(S?.redo || [], S?.undo || [], false);
/** After any change: the line says what broke (from the rules alone, never the answer), the end is settled the moment
 *  the barges moored are the answer, and the run is kept. */
function changed(at = -1) {
  if (at >= 0) {
    const br = breaks(P, S.marks);
    if (S.marks[at] === BARGE && br.touch.includes(at)) note(hex ? "Barges can't touch: none lies in a cell beside another." : "Barges can't touch, not even corner to corner.", "bad");
    else if (S.marks[at] === BARGE && br.stray.includes(at)) note(P.cap.some(c => c === 2) ? "That barge has no dock of its own: a dock has as many barges as its landing stage says, moored right beside it." : "That barge has no dock of its own: each dock has one barge, moored right beside it.", "bad");
    else {
      const l = S.marks[at] === BARGE ? br.over.find(l => P.g.lines[l].includes(at)) : null;
      note(l != null ? `${lineLabel(P, l)} holds ${P.ranges[l] === "-" ? "at most" : "only"} ${P.need[l]}.` : null, "bad");
    }
  }
  if (!S.done && solvedBy(P, S.marks)) finish();
  else save();
  paint();
  render();
}
function note(text, tone = "") { message = text ? { text, tone } : null; }

// ---------- hints ----------
/** Why a rule would break, in words: a hint's "so it is…". */
function whyText(w) {
  const l = w.line != null ? lineLabel(P, w.line) : "";
  switch (w.kind) {
    case "room": return `${l} would not have room for all its barges (they can't touch)`;
    case "over": return `${l} would hold more barges than its number`;
    case "touch": return "two barges would touch";
    case "bare": return "a dock would not have places left for its barges";
    case "match": return "the docks and barges could not be paired off, one each";
    default: return "two rules would disagree";
  }
}
/** A step of reasoning in words, as a hint says it. */
function explain(d) {
  const other = d.supposed === 1 ? "a barge" : "open water";
  switch (d.tech) {
    case "fill": return `${lineLabel(P, d.line)} ${P.ranges[d.line] === "+" ? `needs at least ${P.need[d.line]} and has` : "has"} exactly as many places left as barges it still needs: every one of them is a barge.`;
    case "lone": return P.cap[d.focus[0]] === 2 ? "This double dock has only two places left for its two barges: both are barges." : "This dock has only one place left for its barge: there.";
    case "pair": return "This double dock takes two barges that cannot touch, and only the ways that fit leave a barge here.";
    case "test": return `If this were ${other}, ${whyText(d.why)}. So it is ${d.supposed === 1 ? "open water" : "a barge"}.`;
    case "trial": return `Suppose it were ${other}: following the plain rules, ${whyText(d.why)}. So it is ${d.supposed === 1 ? "open water" : "a barge"}.`;
  }
  return "";
}
function useHint() {
  if (!S || S.done || IN_FRAME || paused) return;
  const h = hintFor(P, S.marks);
  if (!h) return;
  S.hints++;
  let set, text, focus = [];
  if (h.wrong != null) {
    set = [[h.wrong, h.should]];
    text = h.should === BARGE ? "Hint: a barge goes here. It is moored now." : "Hint: this one is open water. It is marked now.";
  } else if (h.step) {
    set = [[h.step.x, BARGE]];
    focus = h.step.focus || [];
    const said = explain(h.step);
    text = `Hint: ${said}`;
  } else {
    set = [[h.reveal, BARGE]];
    text = "Hint: a barge goes here.";
  }
  const hinted = newStroke();                                       // a hint's cells are one step too
  for (const [x, m] of set) setCell(x, S.marks[x], m, hinted);
  S.lit = { set: set.map(([x]) => x), focus, text };
  message = null;
  save();
  paint();
  render();
}

// ---------- the end ----------
function finish() {
  const ms = S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
  clockFrom = null;
  S.done = { ms, score: scoreOf(ms) };
  S.lit = null;
  S.fresh = recordBest(S.done.score);
  if (S.mode === "random") { const k = chosenKind(); if (k.size === S.size && k.level === S.level && k.shape === shapeOf(S)) ramp.won(!S.hints); }
  if (S.mode === "daily") noteDayTime("moor", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("moor");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
// A square board is N×N cells of one unit; cell x = row · N + column, the counts in the margin above and to the left. A hex board
// is drawn in the engine's units (a hex of circumradius 1, √3 across); every cell's glyphs (dock, barge, waves) are drawn in a
// square frame of one unit about the cell's middle and scaled up by KHEX on a hex board.
const MARGIN = 0.9, KHEX = 1.5, SQ3 = Math.sqrt(3);
let svg = null, cellEls = [], lineEls = [], hex = false;
const rc = x => [Math.floor(x / P.N), x % P.N];
const xyOf = x => P.g.xy[x];
/** The outline of a cell about (cx, cy), `r` its half-size (a square's half side; a hex's circumradius). */
const outline = (cx, cy, r) => (hex
  ? `M${[0, 1, 2, 3, 4, 5].map(i => `${(cx + r * Math.cos(Math.PI / 6 + i * Math.PI / 3)).toFixed(3)} ${(cy + r * Math.sin(Math.PI / 6 + i * Math.PI / 3)).toFixed(3)}`).join("L")}Z`
  : `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}Z`);
/** The drawing's box: the square board and its margin, or the hex board and its numbers. */
function viewBoxOf() {
  const pad = 0.2;
  if (!hex) return [-MARGIN, -MARGIN, P.N + MARGIN + pad, P.N + MARGIN + pad, pad];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of P.g.xy) { x0 = Math.min(x0, x - SQ3 / 2); x1 = Math.max(x1, x + SQ3 / 2); y0 = Math.min(y0, y - 1); y1 = Math.max(y1, y + 1); }
  for (const [x, y] of P.g.clue) { x0 = Math.min(x0, x - 0.55); x1 = Math.max(x1, x + 0.55); y0 = Math.min(y0, y - 0.5); y1 = Math.max(y1, y + 0.5); }
  return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, pad];
}
function drawBoard() {
  const { N } = P;
  hex = P.shape === "hex";
  const [vx, vy, vw, vh, pad] = viewBoxOf();
  svg = svgEl("svg", { viewBox: `${vx} ${vy} ${vw} ${vh}`, role: "img", "aria-label": `${kindText({ ...kindOfRun(S), level: S.came || S.level, twist: twistsOf(S) })}: the board. Tap a cell to moor a barge, again to mark open water, again to clear it.`, class: `mr-svg${hex ? " hex" : ""}` });
  if (!hex) svgEl("rect", { x: -pad / 2, y: -pad / 2, width: N + pad, height: N + pad, rx: 0.12, class: "mr-paper" }, svg);
  const k = hex ? KHEX : 1;
  cellEls = Array.from({ length: P.cells }, (_, x) => {
    const [cx, cy] = xyOf(x), g = svgEl("g", { class: "mr-c" }, svg);
    svgEl("path", { d: outline(cx, cy, hex ? 1 : 0.5), class: "mr-cell" }, g);
    const f = svgEl("g", { transform: `translate(${cx} ${cy})${hex ? ` scale(${k})` : ""}` }, g);
    let hull = null, posts = [];
    if (P.dock[x] && P.cap[x] === 2) {
      // a double dock: a wide landing stage on six piles, two posts
      svgEl("rect", { x: -0.46, y: -0.34, width: 0.92, height: 0.68, rx: 0.06, class: "mr-plat" }, f);
      svgEl("path", { d: "M-.42 -.17H.42M-.42 0H.42M-.42 .17H.42", class: "mr-plank" }, f);
      for (const [dx, dy] of [[-0.38, -0.27], [0, -0.27], [0.38, -0.27], [-0.38, 0.27], [0, 0.27], [0.38, 0.27]]) svgEl("circle", { cx: dx, cy: dy, r: 0.065, class: "mr-pile" }, f);
      posts = [svgEl("circle", { cx: -0.18, cy: 0, r: 0.1, class: "mr-post" }, f), svgEl("circle", { cx: 0.18, cy: 0, r: 0.1, class: "mr-post" }, f)];
    } else if (P.dock[x]) {
      svgEl("rect", { x: -0.38, y: -0.38, width: 0.76, height: 0.76, rx: 0.06, class: "mr-plat" }, f);
      svgEl("path", { d: "M-.34 -.13H.34M-.34 .13H.34", class: "mr-plank" }, f);
      for (const [dx, dy] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) svgEl("circle", { cx: dx, cy: dy, r: 0.075, class: "mr-pile" }, f);
      posts = [svgEl("circle", { cx: 0, cy: 0, r: 0.12, class: "mr-post" }, f)];
    } else {
      svgEl("path", { d: "M-.28 -.1q.14-.14 .28 0t.28 0M-.28 .12q.14-.14 .28 0t.28 0", class: "mr-wave" }, f);
      // a barge lying along its dock: the hull points along the edge it is moored to (turned in paint)
      hull = svgEl("g", { class: "mr-barge" }, f);
      svgEl("path", { d: "M-.41 -.2H.2L.42 0L.2 .2H-.41Z", class: "mr-hull" }, hull);
      svgEl("rect", { x: -0.35, y: -0.13, width: 0.52, height: 0.26, rx: 0.03, class: "mr-deck" }, hull);
      svgEl("rect", { x: -0.27, y: -0.09, width: 0.17, height: 0.18, rx: 0.02, class: "mr-crate" }, hull);
      svgEl("rect", { x: -0.04, y: -0.09, width: 0.13, height: 0.18, rx: 0.02, class: "mr-crate" }, hull);
    }
    svgEl("path", { d: outline(cx, cy, hex ? 0.9 : 0.43), class: "mr-ring" }, g);
    return { g, hull, posts, turn: "", d: Math.round((hex ? cx * 22 + cy * 14 : (cx + cy) * 55)) };
  });
  // sea walls: a stone wall on the edge between two cells, a post at each end
  for (const key of P.walls) {
    const a = Math.floor(key / 1024), b = key % 1024, [ax, ay] = xyOf(a), [bx, by] = xyOf(b);
    const mx = (ax + bx) / 2, my = (ay + by) / 2, deg = Math.atan2(bx - ax, -(by - ay)) * 180 / Math.PI, half = 0.47;
    const w = svgEl("g", { class: "mr-wall", transform: `translate(${mx} ${my}) rotate(${deg})` }, svg);
    svgEl("rect", { x: -half, y: -0.11, width: 2 * half, height: 0.22, rx: 0.05, class: "mr-stone" }, w);
    svgEl("path", { d: `M${-half + 0.1} 0H${half - 0.1}`, class: "mr-course" }, w);
    for (const sgn of [-1, 1]) svgEl("circle", { cx: sgn * half, cy: 0, r: 0.12, class: "mr-bollard" }, w);
  }
  // the counts: a row's at its left, a column's above (a square board); at the end of each line (a hex board). A bound, "3+" or "≤3", sits on a warm plate.
  const texts = cluesOf(P);
  lineEls = texts.map((txt, l) => {
    const [x, y] = hex ? P.g.clue[l] : l < N ? [-0.45, l + 0.5] : [l - N + 0.5, -0.49], dy = hex ? 0.23 : 0.19, w = hex ? 0.9 : 0.74, h = hex ? 0.76 : 0.62;
    if (P.ranges[l] === "+" || P.ranges[l] === "-") svgEl("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 0.12, class: "mr-bound" }, svg);
    const t = svgEl("text", { x, y: y + dy, class: "mr-clue", ...(hex ? { "font-size": 0.74 } : {}) }, svg);
    t.textContent = txt;
    return t;
  });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** Which way a barge lies: along the edge of the dock beside it, across the line to the dock (a dock above or below, level; to a side, upright). */
function angleOf(x) {
  const [bx, by] = xyOf(x);
  for (const d of P.beside[x]) {
    if (!P.dock[d]) continue;
    const [dx, dy] = xyOf(d);
    return Math.round(Math.atan2(dy - by, dx - bx) * 180 / Math.PI + 90) % 180;
  }
  return 0;
}
/** Each cell's look from the run: barge, open water, a rule broken, lit or read by a hint; each dock's: moored; each count's: whole or over. */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), touch = new Set(br.touch), stray = new Set(br.stray), moored = new Set(br.moored), half = new Set(br.partial);
  const lit = new Set(S.lit?.set || []), why = new Set(S.lit?.focus || []);
  for (let x = 0; x < cellEls.length; x++) {
    const m = S.marks[x], el = cellEls[x];
    const cls = ["mr-c", m === BARGE ? "barge" : m === WATER ? "water" : "", touch.has(x) ? "touch" : "", stray.has(x) ? "stray" : "", moored.has(x) ? "moored" : half.has(x) ? "half" : "",
      lit.has(x) ? "lit" : why.has(x) ? "why" : ""].filter(Boolean).join(" ");
    if (el.g.getAttribute("class") !== cls) el.g.setAttribute("class", cls);
    if (el.hull && m === BARGE) {
      const turn = `rotate(${angleOf(x)})`;
      if (el.turn !== turn) { el.turn = turn; el.hull.setAttribute("transform", turn); }
    }
  }
  const done = new Set(br.full), over = new Set(br.over);
  lineEls.forEach((t, i) => {
    const cls = `mr-clue${over.has(i) ? " over" : done.has(i) ? " done" : ""}`;
    if (t.getAttribute("class") !== cls) t.setAttribute("class", cls);
  });
  feedModel(br);
}
/** The solve, shown: the barges turn gilt from the top left. */
function wave() {
  if (svg) {
    svg.classList.remove("solved");
    void svg.getBoundingClientRect();
    cellEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
    svg.classList.add("solved");
  }
  model?.celebrate();
}

// ---------- 3D: the same board as a harbour, played the same way (moor-3d.js, loaded when first asked for) ----------
let model = null, modelFor = null;
/** Whether the harbour can draw the puzzle in hand (moor-3d.js). */
const can3D = () => !!P && (model?.draws ? model.draws(P) : P.shape === "square" && !P.walls.size && !P.docks.some(d => P.cap[d] === 2) && !P.ranges);
/** The model follows the run: a new puzzle is built into it, a change of marks moors and casts off barges, a hint's cells glow. */
function feedModel(br) {
  if (!model || viewShown !== "model" || !S || !P || !can3D()) return;
  if (modelFor !== P) { model.set(P); modelFor = P; }
  model.update(S.marks, br || breaks(P, S.marks), S.lit);
}
/** Chart (2D) or harbour (3D; `prefs.view` keeps "chart" and "model"). The model's code (three.js) comes only when it is first wanted; where there is no WebGL the chart stays. */
async function setView(v, remember = true) {
  if (v === "model" && P && !can3D()) { toast("The harbour doesn't draw this board yet."); v = "chart"; remember = false; }
  if (v === "model" && !model) {
    try {
      model = (await import("./moor-3d.js")).createModel($("model"), { press, stroke: strokeFrom, playable: () => !!S && !S.done && !IN_FRAME && !paused });
      if (paused) model.hold(true);
    } catch (err) { console.warn("Moor: no 3D here.", err); toast("This browser can't draw 3D."); v = "chart"; }
  }
  viewShown = v;
  if (remember) { prefs.view = v === "model" ? "model" : "2d"; savePrefs(); }
  const on = v === "model";
  $("card").classList.toggle("is-model", on);
  $("model").hidden = !on;
  $("viewBtn").innerHTML = on ? "<b>2D</b><small>the chart</small>" : "<b>3D</b><small>the harbour</small>";
  $("viewBtn").setAttribute("aria-pressed", String(on));
  model?.show(on);
  if (on) feedModel();
}

// ---------- the board under a finger: a tap cycles a cell, a drag marks open water cell after cell ----------
let pressing = null;   // { id, x, y, from (the cell pressed), stroke (reach(cell) once it paints) }
/** A point of the screen in the board's units (one a cell), or null. */
function toBoard(ev) {
  const m = svg?.getScreenCTM();
  return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : null;
}
/** The cell a point of the board is in, or -1 off the board. */
function cellAt(p) {
  if (!p) return -1;
  if (!hex) return p.x < 0 || p.y < 0 || p.x >= P.N || p.y >= P.N ? -1 : Math.floor(p.y) * P.N + Math.floor(p.x);
  let best = -1, near = 1.02;           // (a hex's middle is at most 1 from any point of it)
  for (let x = 0; x < P.cells; x++) { const d = Math.hypot(P.g.xy[x][0] - p.x, P.g.xy[x][1] - p.y); if (d < near) { near = d; best = x; } }
  return best;
}
/** The cell a step from `at` towards `to` reaches: along the row or column that is farther off (a square board), or the neighbour nearest `to` (a hex board). */
function stepToward(at, to) {
  if (hex) {
    let best = at, near = Infinity;
    for (const y of P.g.nb[at]) { const d = Math.hypot(P.g.xy[y][0] - P.g.xy[to][0], P.g.xy[y][1] - P.g.xy[to][1]); if (d < near) { near = d; best = y; } }
    return best;
  }
  const [r, c] = rc(at), [tr, tc] = rc(to), dr = tr - r, dc = tc - c;
  return Math.abs(dr) >= Math.abs(dc) ? at + Math.sign(dr) * P.N : at + Math.sign(dc);
}
function down(ev) {
  if (ev.button > 0) { if (ev.button === 2) press(cellAt(toBoard(ev)), "dot"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  ev.preventDefault();
  cancelPress();
  const from = cellAt(toBoard(ev));
  try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, from, stroke: null };
}
function cancelPress() { pressing = null; }
/** Paints a cell with the stroke's mark: open water on clear cells, or (a stroke that began on open water) clearing open water; barges and docks are left alone. */
function paintCell(x, s) {
  if (x < 0 || P.dock[x]) return;
  const cur = S.marks[x];
  if (s.mode === WATER ? cur === NONE : cur === WATER) setCell(x, cur, s.mode, s.id);
}
/** A drag that began on cell `from`: opens water on clear cells (or, begun on open water, clears it) and returns reach(to), which steps
 *  cell by cell so a quick drag leaves no gaps. The 2D board and the 3D harbour paint the same way. */
function beginStroke(from) {
  const s = { id: newStroke(), at: from, mode: from >= 0 && S.marks[from] === WATER ? NONE : WATER };
  paintCell(from, s);
  return to => {
    if (to < 0) return;
    for (let guard = 0; s.at !== to && guard < 200; guard++) {
      const next = stepToward(s.at, to);
      if (next === s.at) break;
      s.at = next;
      paintCell(s.at, s);
    }
  };
}
const strokeFrom = from => (!S || S.done || IN_FRAME || paused ? null : beginStroke(from));
addEventListener("pointermove", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  if (!pressing.stroke) {
    if (Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) <= DRAG * scale()) return;
    pressing.stroke = beginStroke(pressing.from);
  }
  pressing.stroke(cellAt(toBoard(ev)));
});
addEventListener("pointerup", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const { from, stroke: drew } = pressing;
  cancelPress();
  if (!drew) press(from, "tap");
});
addEventListener("pointercancel", cancelPress);

// ---------- drawing the rest ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S) { put("time", "0:00"); put("penalty", ""); put("kind", ""); return; }
  put("time", fmt(elapsed() / 1000 + penalty()));
  put("penalty", penalty() ? `+${penalty()} s` : "");
  put("kind", `${S.mode === "daily" ? "Today · " : ""}${kindText({ ...kindOfRun(S), level: S.came || S.level, twist: twistsOf(S) }, true)}`);
  $("kind").classList.toggle("long", $("kind").textContent.length > 26);
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (S.came && S.came !== S.level && !/[12]/.test(S.marks)) text = `No ${LEVELS[S.level]} puzzle came of this ${hex ? "board" : "size"} this time: this one is ${LEVELS[S.came]}.`;
  else if (!/[12]/.test(S.marks)) text = "Tap a cell to moor a barge, again to mark open water (a note), again to clear it. Or drag to mark a run of open water.";
  else text = rulesLine();
  if (l.textContent !== text) l.textContent = text;
  l.className = `mr-say${tone ? ` ${tone}` : ""}`;
}
/** The rules in a line, for this puzzle's twists. */
function rulesLine() {
  const f = flagsOf(twistsOf(S)), bits = [`Every dock gets ${f.doubles ? "as many barges as its stage holds (one, or two on a double dock)" : "one barge"}, moored beside it.`,
    hex ? "Barges never lie in cells beside each other." : "Barges never touch, not even at a corner."];
  if (f.walls) bits.push("A wall breaks 'beside' and 'touching' across it.");
  bits.push(f.ranges ? "A number counts the barges in its line; 3+ is at least three, ≤3 at most." : hex ? "The numbers count the barges in each row and diagonal." : "The numbers count the barges in each row and column.");
  return bits.join(" ");
}
function drawResult() {
  const done = !!S?.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const d = S.done, bits = [`${fmt(d.ms / 1000)} on the clock`], best = bestOf(S);
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${penalty()} s)`);
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
    <p>Moor a barge beside every dock. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>The rules</h4>
    <p>Each dock gets <b>exactly one barge</b>, moored in a cell right beside it: above, below, to the left or to the right (not diagonally). Each barge belongs to its own dock, so there are as many barges as docks.</p>
    <p>No two barges touch, <b>not even corner to corner</b>: every barge has open water all round it. Barges may lie beside other docks than their own.</p>
    <p>The numbers beside the rows and above the columns say <b>how many barges</b> lie in that row or column.</p>
    <p><b>An example.</b> A dock in a corner has two cells beside it. A row marked 0 has no barge at all, so the cells in it are open water, and a dock whose other places are taken has only one place left.</p>
    <h4>Twists</h4>
    <p><b>Sea walls.</b> A short wall stands on the edge between two cells. A barge across a wall from a dock is not beside that dock, and two barges side by side across a wall do not touch (at a corner, a wall never separates them: diagonal barges still touch).</p>
    <p><b>Double docks.</b> A dock drawn as a wide landing stage with two posts takes exactly <b>two</b> barges, each beside it; each barge still belongs to one dock only. Its two barges cannot touch, so on a square board they lie on opposite sides.</p>
    <p><b>Ranges.</b> A number may be a bound: <b>3+</b> is at least three barges in that line, <b>≤3</b> at most three. The puzzle still has one answer.</p>
    <p><b>Hex board.</b> A hexagon of hexes. A dock's barge lies in any of the six cells round it, and barges may not lie in cells beside each other (there is no corner). The numbers count the barges in the rows and in both diagonals.</p>
    <h4>Playing</h4>
    <p>Tap a cell to moor a barge, again to mark it as open water (a note for yourself, nothing more), again to clear it; a right-click marks open water at once. Drag to mark a run of open water, or to clear one. Only the barges count: the puzzle is solved the moment exactly the answer's barges are moored. Undo and Redo step through your strokes, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: two barges touching, a barge with no dock of its own, a row or column with too many; all in oxblood. That comes from the rules, never the answer. A number turns green once its row or column is complete, and a dock's piles turn green once it has its barge. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it moors the next barge a person could find, says why, and rings the cells it read in gilt.</p>
    <h4>3D</h4>
    <p>The 3D button turns the board into a harbour: timber docks, barges on the water and the counts painted on the quay. It is the same puzzle, played the same way; drag to turn the view, pinch or use the wheel to zoom.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how few clues it shows. <b>Easy</b>: the plain rules (a barge's neighbours are water; a full line is closed; a line with exactly as many places as barges is filled; a dock with as many places left as barges takes them all). <b>Medium</b>: also a dock whose barge is in one of two places leaves water in every cell that touches both (a double dock: only the pairs of places that do not touch are possible). <b>Hard</b>: also a cell tested at once (a barge here would leave a row without room, or a dock without a place). <b>Expert</b>: a trial, a cell supposed one way and the plain rules followed until a rule breaks. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A plain 8×8 at Medium, the same for everyone. Its first solve counts the moment the barges are right, and is Moor's figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// the menu: Play (a new puzzle, clearing the board, 3D, the rules), Content (random or today's, the size, the level), About
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const content = part(body, "content");
  const play = part(body, "play");
  play.append(action("New puzzle", () => confirmStart("random"), "primary"));
  content.append(choice("Board", [["square", "Square"], ["hex", "Hex"]], prefs.board, v => { prefs.board = v; savePrefs(); refill(chosenKind()); openMenu(); }));
  content.append(ticks("Twists", Object.entries(TWISTS), twistOn(prefs.twists).split("+").filter(t => TWISTS[t]), v => { prefs.twists = twistOn(v.join("+")); savePrefs(); refill(chosenKind()); }));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action(viewShown === "model" ? "Play in 2D" : "Play in 3D", () => setView(viewShown === "model" ? "chart" : "model"), "link"), action("The rules", showRules, "link"));
  todayPart(body, { app: "moor", play: () => start("daily"), playing: S?.mode === "daily" && S.seed === today(), busy: started() });
  const best = S ? bestOf(S) : null;
  const about = part(body, "about");
  about.append(line(S ? `${kindText({ ...kindOfRun(S), level: S.came || S.level, twist: twistsOf(S) })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Moor a barge beside every dock."));
  about.append(action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
async function clearBoard() {
  if (!S || S.done) return;
  if (!(await sure("Clear every mark on the board?", { yes: "Clear" }))) return;
  if (S.done) return;
  const clearing = newStroke();                                      // one step to undo
  for (let x = 0; x < S.marks.length; x++) if (S.marks[x] !== NONE) setCell(x, S.marks[x], NONE, clearing);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- links: #s=SEED&n=8&l=medium (#d= for a day's) ----------
// (t= the twists asked for, b=hex for the hex board; a plain square puzzle's link is what it always was)
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}${hasTwist(s.twist) ? `&t=${twistOn(s.twist)}` : ""}${shapeOf(s) === "hex" ? "&b=hex" : ""}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const shape = h.get("b") === "hex" ? "hex" : "square", fallback = shape === "hex" ? 7 : 8;
  const size = sizeOn(shape, Number(h.get("n"))) ? Number(h.get("n")) : fallback, twist = twistOn(h.get("t"));
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium", shape), twist, shape } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle));
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "moor");
document.querySelector(".mr-mark").innerHTML = APPS.find(a => a.id === "moor")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => start("random"));
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
$("viewBtn").addEventListener("click", () => setView(viewShown === "model" ? "chart" : "model"));
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else clockRun(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__moor = {
  get state() { return S; }, get puzzle() { return P; }, get model() { return model; }, press, useHint, undo, redo, start, setView,
  /** Where a cell's middle is on the screen, for tests that tap or drag it as a finger would. */
  cellOf: x => { const m = svg.getScreenCTM(), [cx, cy] = xyOf(x); return { x: cx * m.a + m.e, y: cy * m.d + m.f }; },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
async function solo() {
  const kept = read(RUN, null);
  S = null;
  if (valid(kept)) S = kept;
  const l = linked();
  if (l && !(S && S.seed === l.seed && S.mode === l.mode && S.size === l.k.size && shapeOf(S) === l.k.shape && twistOn(S.twist) === l.k.twist)) { openLinked(l); return; }
  const todays = forToday && !IN_FRAME && !(S?.mode === "daily" && S.seed === today());
  if (S) { const s = S; S = null; begin(s); if (!IN_FRAME) refill(chosenKind()); }       // yours is on the board while it asks about today's
  if (todays && (!S || !started() || await sure("Today's puzzle is waiting. Leave the one you've started?", { yes: "Today's puzzle", no: "Keep mine" }))) { start("daily"); return; }
  if (!S) { if (IN_FRAME) render(); else start("random"); }
}
solo().then(() => { if (viewShown === "model") setView("model", false); });
onDefaultChange(is3D => { if (!prefs.view && S) setView(is3D ? "model" : "chart", false); });   // Settings' 2D mode, live
