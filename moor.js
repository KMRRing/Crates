// Moor: moor a barge beside every dock. Each dock gets exactly one barge, orthogonally beside it; no two barges touch (not even
// corner to corner); the numbers round the board are the barges in each row and column. The rules, the puzzles and the
// reasoning are moor-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles
// are made in moor-worker.js. This file keeps the run, the clock and the taps, and draws the board; the harbour in 3D is
// moor-3d.js's, loaded when first asked for (as Bridges' is).
import { SIZES, LEVELS, DAILY, NONE, BARGE, WATER, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn, lineLabel } from "./moor-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused, todayPart } from "./menu.js";
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
const kindText = k => `${k.size}×${k.size} · ${LEVELS[k.level]}`;
const kindKey = k => `${k.size}:${k.level}`;

// ---------- what you chose ----------
const prefs = { size: 8, level: "easy", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 8;
if (!LEVELS[prefs.level]) prefs.level = "easy";
// prefs.view is the player's own choice ("model" or "2d"), kept only when they make one; with none the suite's default applies (mode3d.js).
// ("chart" was the old default, written into every save: dropped.) `viewShown` is what is on the screen now.
if (prefs.view !== "model" && prefs.view !== "2d") delete prefs.view;
let viewShown = wants3D(prefs.view, "model") ? "model" : "chart";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ size: prefs.size, level: levelOn(prefs.size, prefs.level) });

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level));
  try {
    worker ||= new Worker(new URL("./moor-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.size, w.k.level));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.size, k.level)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, level: k.level }); });
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
//      ms, hints, done ({ ms, score } once solved), lit (a hint's cells, the cells it read and its words), fresh (a new best) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const valid = s => !!s && s.v === 1 && SIZES.includes(s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.marks.length && s.grid.length === s.size * s.size && s.marks.length === s.grid.length && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.done && (/[12]/.test(S.marks) || S.hints > 0);

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
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: NONE.repeat(puzzle.sol.length) });
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
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
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
    if (S.marks[at] === BARGE && br.touch.includes(at)) note("Barges can't touch, not even corner to corner.", "bad");
    else if (S.marks[at] === BARGE && br.stray.includes(at)) note("That barge has no dock of its own: each dock has one barge, moored right beside it.", "bad");
    else {
      const l = S.marks[at] === BARGE ? br.over.find(l => l === Math.floor(at / P.N) || l === P.N + (at % P.N)) : null;
      note(l != null ? `${lineLabel(P.N, l)} holds only ${P.need[l]}.` : null, "bad");
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
  const l = w.line != null ? lineLabel(P.N, w.line) : "";
  switch (w.kind) {
    case "room": return `${l} would not have room for all its barges (they can't touch)`;
    case "over": return `${l} would hold more barges than its number`;
    case "touch": return "two barges would touch";
    case "bare": return "a dock would have no place left for its barge";
    case "match": return "the docks and barges could not be paired off, one each";
    default: return "two rules would disagree";
  }
}
/** A step of reasoning in words, as a hint says it. */
function explain(d) {
  const other = d.supposed === 1 ? "a barge" : "open water";
  switch (d.tech) {
    case "fill": return `${lineLabel(P.N, d.line)} has exactly as many places left as barges to come: every one of them is a barge.`;
    case "lone": return "This dock has only one place left for its barge: there.";
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
  if (S.mode === "daily") noteDayTime("moor", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("moor");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
// The board is N×N cells of one unit; cell x = row · N + column. The counts stand in the margin above and to the left.
const MARGIN = 0.9;
let svg = null, cellEls = [], rowEls = [], colEls = [];
const rc = x => [Math.floor(x / P.N), x % P.N];
function drawBoard() {
  const { N } = P, pad = 0.2;
  svg = svgEl("svg", { viewBox: `${-MARGIN} ${-MARGIN} ${N + MARGIN + pad} ${N + MARGIN + pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap a cell to moor a barge, again to mark open water, again to clear it.`, class: "mr-svg" });
  svgEl("rect", { x: -pad / 2, y: -pad / 2, width: N + pad, height: N + pad, rx: 0.12, class: "mr-paper" }, svg);
  cellEls = Array.from({ length: P.cells }, (_, x) => {
    const [r, c] = rc(x), g = svgEl("g", { class: "mr-c" }, svg);
    svgEl("rect", { x: c, y: r, width: 1, height: 1, class: "mr-cell" }, g);
    let hull = null;
    if (P.dock[x]) {
      svgEl("rect", { x: c + 0.12, y: r + 0.12, width: 0.76, height: 0.76, rx: 0.06, class: "mr-plat" }, g);
      svgEl("path", { d: `M${c + 0.16} ${r + 0.37}H${c + 0.84}M${c + 0.16} ${r + 0.63}H${c + 0.84}`, class: "mr-plank" }, g);
      for (const [dx, dy] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) svgEl("circle", { cx: c + dx, cy: r + dy, r: 0.075, class: "mr-pile" }, g);
      svgEl("circle", { cx: c + 0.5, cy: r + 0.5, r: 0.12, class: "mr-post" }, g);
    } else {
      svgEl("path", { d: `M${c + 0.22} ${r + 0.4}q.14-.14 .28 0t.28 0M${c + 0.22} ${r + 0.62}q.14-.14 .28 0t.28 0`, class: "mr-wave" }, g);
      // a barge lying along its dock: the hull points along the edge it is moored to (turned in paint)
      hull = svgEl("g", { class: "mr-barge" }, g);
      svgEl("path", { d: "M-.41 -.2H.2L.42 0L.2 .2H-.41Z", class: "mr-hull" }, hull);
      svgEl("rect", { x: -0.35, y: -0.13, width: 0.52, height: 0.26, rx: 0.03, class: "mr-deck" }, hull);
      svgEl("rect", { x: -0.27, y: -0.09, width: 0.17, height: 0.18, rx: 0.02, class: "mr-crate" }, hull);
      svgEl("rect", { x: -0.04, y: -0.09, width: 0.13, height: 0.18, rx: 0.02, class: "mr-crate" }, hull);
    }
    svgEl("rect", { x: c + 0.07, y: r + 0.07, width: 0.86, height: 0.86, class: "mr-ring" }, g);
    return { g, hull, turn: "", d: Math.round((r + c) * 55) };
  });
  // the counts: row by row down the left, column by column along the top
  rowEls = Array.from({ length: N }, (_, r) => { const t = svgEl("text", { x: -0.45, y: r + 0.5 + 0.19, class: "mr-clue" }, svg); t.textContent = P.rows[r]; return t; });
  colEls = Array.from({ length: N }, (_, c) => { const t = svgEl("text", { x: c + 0.5, y: -0.3, class: "mr-clue" }, svg); t.textContent = P.cols[c]; return t; });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** Which way a barge lies: along the edge of the dock beside it (a dock above or below, level; to a side, upright). */
function angleOf(x) {
  const { N } = P, [r, c] = rc(x);
  if ((r > 0 && P.dock[x - N]) || (r < N - 1 && P.dock[x + N])) return 0;
  if ((c > 0 && P.dock[x - 1]) || (c < N - 1 && P.dock[x + 1])) return 90;
  return 0;
}
/** Each cell's look from the run: barge, open water, a rule broken, lit or read by a hint; each dock's: moored; each count's: whole or over. */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), touch = new Set(br.touch), stray = new Set(br.stray), moored = new Set(br.moored);
  const lit = new Set(S.lit?.set || []), why = new Set(S.lit?.focus || []);
  for (let x = 0; x < cellEls.length; x++) {
    const m = S.marks[x], el = cellEls[x];
    const cls = ["mr-c", m === BARGE ? "barge" : m === WATER ? "water" : "", touch.has(x) ? "touch" : "", stray.has(x) ? "stray" : "", moored.has(x) ? "moored" : "",
      lit.has(x) ? "lit" : why.has(x) ? "why" : ""].filter(Boolean).join(" ");
    if (el.g.getAttribute("class") !== cls) el.g.setAttribute("class", cls);
    if (el.hull && m === BARGE) {
      const [r, c] = rc(x), turn = `translate(${c + 0.5} ${r + 0.5}) rotate(${angleOf(x)})`;
      if (el.turn !== turn) { el.turn = turn; el.hull.setAttribute("transform", turn); }
    }
  }
  const done = new Set(br.full), over = new Set(br.over);
  [...rowEls, ...colEls].forEach((t, i) => {
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
/** The model follows the run: a new puzzle is built into it, a change of marks moors and casts off barges, a hint's cells glow. */
function feedModel(br) {
  if (!model || viewShown !== "model" || !S || !P) return;
  if (modelFor !== P) { model.set(P); modelFor = P; }
  model.update(S.marks, br || breaks(P, S.marks), S.lit);
}
/** Chart (2D) or harbour (3D; `prefs.view` keeps "chart" and "model"). The model's code (three.js) comes only when it is first wanted; where there is no WebGL the chart stays. */
async function setView(v, remember = true) {
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
  if (!p || p.x < 0 || p.y < 0 || p.x >= P.N || p.y >= P.N) return -1;
  return Math.floor(p.y) * P.N + Math.floor(p.x);
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
    while (s.at !== to) {
      const [r, c] = rc(s.at), [tr, tc] = rc(to), dr = tr - r, dc = tc - c;
      s.at = Math.abs(dr) >= Math.abs(dc) ? s.at + Math.sign(dr) * P.N : s.at + Math.sign(dc);
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
  put("kind", `${S.mode === "daily" ? "Today · " : ""}${kindText({ size: S.size, level: S.came || S.level })}`);
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (S.came && S.came !== S.level && !/[12]/.test(S.marks)) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!/[12]/.test(S.marks)) text = "Tap a cell to moor a barge, again to mark open water (a note), again to clear it. Or drag to mark a run of open water.";
  else text = "Every dock gets one barge, moored beside it. Barges never touch, not even at a corner. The numbers count the barges in each row and column.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `mr-say${tone ? ` ${tone}` : ""}`;
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
    <h4>Playing</h4>
    <p>Tap a cell to moor a barge, again to mark it as open water (a note for yourself, nothing more), again to clear it; a right-click marks open water at once. Drag to mark a run of open water, or to clear one. Only the barges count: the puzzle is solved the moment exactly the answer's barges are moored. Undo and Redo step through your strokes, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: two barges touching, a barge with no dock of its own, a row or column with too many; all in oxblood. That comes from the rules, never the answer. A number turns green once its row or column is complete, and a dock's piles turn green once it has its barge. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it moors the next barge a person could find, says why, and rings the cells it read in gilt.</p>
    <h4>3D</h4>
    <p>The 3D button turns the board into a harbour: timber docks, barges on the water and the counts painted on the quay. It is the same puzzle, played the same way; drag to turn the view, pinch or use the wheel to zoom.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how few clues it shows. <b>Easy</b>: the plain rules (a barge's neighbours are water; a full row or column is closed; a row with exactly as many places as barges is filled; a dock with one place left takes it). <b>Medium</b>: also a dock whose barge is in one of two places leaves water in every cell that touches both. <b>Hard</b>: also a cell tested at once (a barge here would leave a row without room, or a dock without a place). <b>Expert</b>: a trial, a cell supposed one way and the plain rules followed until a rule breaks. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>An 8×8 at Medium, the same for everyone. Its first solve counts the moment the barges are right, and is Moor's figure on the games screen.</p>`;
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
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action(viewShown === "model" ? "Play in 2D" : "Play in 3D", () => setView(viewShown === "model" ? "chart" : "model"), "link"), action("The rules", showRules, "link"));
  todayPart(body, { app: "moor", play: () => start("daily"), playing: S?.mode === "daily" && S.seed === today(), busy: started() });
  content.append(choice("Size", SIZES.map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
  content.append(mirror("Level", $("level")));
  const best = S ? bestOf(S) : null;
  const about = part(body, "about");
  about.append(line(S ? `${kindText({ size: S.size, level: S.came || S.level })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Moor a barge beside every dock."));
  about.append(action("Copy a link to this puzzle", copyLink, "link"));
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
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const size = SIZES.includes(Number(h.get("n"))) ? Number(h.get("n")) : 8;
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium") } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle));
}

// ---------- wiring ----------
dropdown($("level"));   // the header dropdown in the suite's style (see dropdown.js)
bindSwitcher($("appsBtn"), "moor");
document.querySelector(".mr-mark").innerHTML = APPS.find(a => a.id === "moor")?.logo || "";
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
  cellOf: x => { const m = svg.getScreenCTM(), [r, c] = rc(x); return { x: (c + 0.5) * m.a + m.e, y: (r + 0.5) * m.d + m.f }; },
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
$("level").value = chosenKind().level;
solo().then(() => { if (viewShown === "model") setView("model", false); });
onDefaultChange(is3D => { if (!prefs.view && S) setView(is3D ? "model" : "chart", false); });   // Settings' 2D mode, live
