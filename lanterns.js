// Lanterns: light the water. Put lanterns on white cells so that every white cell is lit; a lantern shines along its row and
// column up to the next rock, no lantern may shine on another, and a numbered rock has exactly that many lanterns on the
// four cells touching it. The rules, the puzzles and the reasoning are lanterns-engine.js's (every puzzle has one answer,
// and is graded by the hardest step a person needs); the puzzles are made in lanterns-worker.js. This file keeps the run,
// the clock and the taps, and draws the flat board; lanterns-3d.js draws the same run as a sea of lighthouses, loaded when
// first asked for. Played alone: Atoll's co-op and head-to-head are not done for it.
import { SIZES, LEVELS, DAILY, NONE, LIGHT, DOT, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "./lanterns-engine.js";
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
const RUN = "lanterns:run", TIMES = "lanterns:times", PREFS = "lanterns:prefs", SPARES = "lanterns:spares";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to mark a cell with a dot instead of cycling it
const SLIP = 12;                     // px a finger may stray and still be a tap

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const kindText = k => `${k.size}×${k.size} · ${LEVELS[k.level]}`;
const kindKey = k => `${k.size}:${k.level}`;

// ---------- what you chose ----------
const prefs = { size: 10, level: "easy", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 10;
if (!LEVELS[prefs.level]) prefs.level = "easy";
// prefs.view is the player's own choice ("model" or "2d"), kept only when they make one; with none the suite's default applies (mode3d.js).
// ("flat" was the old default, written into every save: dropped.) `viewShown` is what is on the screen now.
if (prefs.view !== "model" && prefs.view !== "2d") delete prefs.view;
let viewShown = wants3D(prefs.view, "model") ? "model" : "flat";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ size: prefs.size, level: levelOn(prefs.size, prefs.level) });

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Cull's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level));
  try {
    worker ||= new Worker(new URL("./lanterns-worker.js", import.meta.url), { type: "module" });
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
//      cell: 0 clear, 1 lantern, 2 dot), undo, redo (each [cell, from, to, stroke]: a hint's or a clearing's cells undo together),
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
// Kept in lanterns:times by size and level, lowest first, not lanterns:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, lanterns:today).
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
let strokeAt = 0;                    // a hint's cells, or a clearing, are one step to undo: its cells share a number
const newStroke = () => (strokeAt = Math.max(Date.now(), strokeAt + 1));   // (a time, so a saved run's numbers never meet a new one)
/** A tap cycles the cell (clear, lantern, dot); a hold or a right-click dots it, or clears it if dotted. A rock can't be marked. */
function press(x, how) {
  if (!S || S.done || IN_FRAME || paused || x < 0 || P.black[x]) return;
  const from = S.marks[x], to = how === "hold" || how === "dot" ? (from === DOT ? NONE : DOT) : nextMark(from);
  setCell(x, from, to);
  if (to === LIGHT) navigator.vibrate?.(8);
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
/** Takes back (or does again) the last step: one cell, or every cell of the group it was part of. */
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
 *  the lanterns lit are the answer, and the run is kept. */
function changed(at = -1) {
  if (at >= 0) {
    const br = breaks(P, S.marks);
    if (S.marks[at] === LIGHT && br.clash.includes(at)) note("That lantern shines on another one: no two may see each other.", "bad");
    else if (S.marks[at] === LIGHT && P.nb[at].some(y => y >= 0 && br.over.includes(y))) note("A rock has more lanterns than its number.", "bad");
    else if (br.dark.length) note("Nothing can light the cell outlined in red any more: a dot or a lantern took its last place.", "bad");
    else if (br.short.length) note("A rock can no longer get its number: too few places are left round it.", "bad");
    else message = null;
  }
  if (!S.done && solvedBy(P, S.marks)) finish();
  else save();
  paint();
  render();
}
function note(text, tone = "") { message = text ? { text, tone } : null; }

// ---------- hints ----------
/** A step of reasoning in words, as a hint says it. */
function explain(x) {
  switch (x.tech) {
    case "shine": return "A lantern lights its whole row and column up to the rocks. Another lantern there would shine on it: those cells have none.";
    case "full": return "This rock has all its lanterns. The cells touching it can have no more.";
    case "need": return "This rock has only as many open cells touching it as it needs lanterns: they all get one.";
    case "dark": return "Only one cell can still light this one, so that cell takes the lantern.";
    case "look": return "A lantern here would leave a cell nothing can light, or a rock short of its number: it has none.";
    case "trial": {
      const was = x.supposed === 1 ? "a lantern" : "no lantern", is = x.supposed === 1 ? "none" : "a lantern";
      return `Suppose it had ${was}: ${x.depth !== Infinity ? "a couple of steps on" : "followed to the end"}, a rule breaks. So it has ${is}.`;
    }
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
    text = h.should === DOT ? "Hint: this one has no lantern. It is dotted now." : "Hint: this one has a lantern. It is lit now.";
  } else if (h.step) {
    set = h.step.set.map(([x, v]) => [x, String(v)]);
    focus = h.step.focus || [];
    const said = explain(h.step);
    text = `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    set = [[h.reveal, h.should]];
    text = h.should === DOT ? "Hint: this one has no lantern." : "Hint: this one has a lantern.";
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
  if (S.mode === "daily") noteDayTime("lanterns", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("lanterns");
  wave();
  model?.spin();
}

// ---------- the flat board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
// The board is N×N cells of one unit; cell x = row · N + column.
let svg = null, cellEls = [];
const rc = x => [Math.floor(x / P.N), x % P.N];
/** A lighthouse in a cell (drawn to the cell's unit square, shown only on a cell with a lantern). */
function lighthouse(parent, c, r) {
  const g = svgEl("g", { class: "lan-lamp", transform: `translate(${c} ${r})` }, parent);
  svgEl("path", { d: "M.33 .34H.2M.67 .34H.8M.36 .2L.27 .12M.64 .2L.73 .12", class: "lan-ray" }, g);
  svgEl("polygon", { points: ".35,.88 .65,.88 .59,.42 .41,.42", class: "lan-tower" }, g);
  svgEl("polygon", { points: ".381,.72 .619,.72 .604,.6 .396,.6", class: "lan-band" }, g);
  svgEl("rect", { x: ".4", y: ".27", width: ".2", height: ".15", class: "lan-room" }, g);
  svgEl("polygon", { points: ".37,.27 .5,.11 .63,.27", class: "lan-cap" }, g);
  return g;
}
function drawBoard() {
  const { N } = P, pad = 0.2;
  svg = svgEl("svg", { viewBox: `${-pad} ${-pad} ${N + 2 * pad} ${N + 2 * pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap a cell to light a lantern on it, again to dot it as having none. Hold to dot a cell at once.`, class: "lan-svg" });
  svgEl("rect", { x: -pad / 2, y: -pad / 2, width: N + pad, height: N + pad, rx: 0.12, class: "lan-paper" }, svg);
  cellEls = Array.from({ length: P.cells }, (_, x) => {
    const [r, c] = rc(x), g = svgEl("g", { class: "lan-c" }, svg);
    svgEl("rect", { x: c, y: r, width: 1, height: 1, class: P.black[x] ? "lan-rock" : "lan-cell" }, g);
    if (P.black[x]) {
      if (P.num[x] >= 0) svgEl("text", { x: c + 0.5, y: r + 0.5 + 0.2, class: "lan-num" }, g).textContent = P.num[x];
    } else {
      svgEl("circle", { cx: c + 0.5, cy: r + 0.5, r: 0.09, class: "lan-dot" }, g);
      lighthouse(g, c, r);
    }
    svgEl("rect", { x: c + 0.07, y: r + 0.07, width: 0.86, height: 0.86, class: "lan-ring" }, g);
    return { g, d: Math.round((r + c) * 55) };
  });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
let lastBreaks = null;
/** Each cell's look from the run: lit, lantern, dot, a rule broken, read or settled by a hint; each rock's: whole, over or short. The 3D sea follows. */
function paint() {
  if (!svg || !S) return;
  const br = lastBreaks = breaks(P, S.marks), clash = new Set(br.clash), dark = new Set(br.dark), over = new Set(br.over), short = new Set(br.short), done = new Set(br.done);
  const lit = new Set(S.lit?.set || []), why = new Set(S.lit?.focus || []);
  for (let x = 0; x < cellEls.length; x++) {
    const m = S.marks[x];
    const cls = ["lan-c", br.lit[x] ? "lit" : "", m === LIGHT ? "light" : m === DOT ? "dot" : "", clash.has(x) ? "clash" : "", dark.has(x) ? "dark" : "", over.has(x) || short.has(x) ? "over" : "",
      done.has(x) ? "done" : "", lit.has(x) ? "hint" : why.has(x) ? "why" : ""].filter(Boolean).join(" ");
    if (cellEls[x].g.getAttribute("class") !== cls) cellEls[x].g.setAttribute("class", cls);
  }
  feedModel();
}
/** The solve, shown: the lit water turns gilt from the top left. */
function wave() {
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  cellEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
  svg.classList.add("solved");
}

// ---------- 3D: the same run as a sea of lighthouses, played the same way (lanterns-3d.js, loaded when first asked for) ----------
let model = null, modelFor = null;
/** The sea follows the run: a new puzzle is built into it, a change of marks raises and lowers lighthouses, a hint's cells glow. */
function feedModel() {
  if (!model || viewShown !== "model" || !S || !P) return;
  if (modelFor !== P) { model.set({ size: S.size, grid: S.grid }); modelFor = P; }
  model.update(S.marks, lastBreaks || breaks(P, S.marks), S.lit);
}
/** Flat (2D) or the sea (3D; `prefs.view` keeps "flat" and "model"). The sea's code (three.js) comes only when first wanted; where there is no WebGL the flat board stays. */
async function setView(v, remember = true) {
  if (v === "model" && !model) {
    try {
      model = (await import("./lanterns-3d.js")).createModel($("model"), { press, playable: () => !!S && !S.done && !IN_FRAME && !paused });
    } catch (err) { console.warn("Lanterns: no 3D here.", err); toast("This browser can't draw 3D."); v = "flat"; }
  }
  viewShown = v;
  if (remember) { prefs.view = v === "model" ? "model" : "2d"; savePrefs(); }
  const on = v === "model";
  $("card").classList.toggle("is-model", on);
  $("model").hidden = !on;
  $("viewBtn").innerHTML = on ? "<b>2D</b><small>the board</small>" : "<b>3D</b><small>the sea</small>";
  $("viewBtn").setAttribute("aria-pressed", String(on));
  model?.show(on);
  if (on) feedModel();
  drawLine();
}

// ---------- the board under a finger: a tap cycles a cell, a hold dots it ----------
let pressing = null;   // { id, x, y, cell, timer, held }
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
  const cell = cellAt(toBoard(ev));
  try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, cell, held: false, timer: 0 };
  if (cell >= 0 && !P.black[cell]) pressing.timer = setTimeout(() => {
    if (!pressing) return;
    pressing.held = true;
    navigator.vibrate?.(14);
    press(cell, "hold");
  }, HOLD);
}
function cancelPress() { if (pressing) clearTimeout(pressing.timer); pressing = null; }
addEventListener("pointermove", ev => {
  if (pressing && ev.pointerId === pressing.id && Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) > SLIP * scale()) cancelPress();     // a slip is no tap
});
addEventListener("pointerup", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const { cell, held } = pressing;
  cancelPress();
  if (!held) press(cell, "tap");
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
  else if (!/[12]/.test(S.marks)) text = viewShown === "model" ? "Tap a shoal to raise a lighthouse, again to mark it with a buoy (no lantern), again to clear it. Hold to buoy it at once. Drag to turn, pinch or scroll to zoom."
    : "Tap a cell to light a lantern, again to dot it as having none (a note), again to clear it. Hold to dot a cell at once.";
  else text = "Light every white cell. A lantern shines along its row and column to the next rock; none may shine on another; a number is the lanterns touching that rock.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `lan-say${tone ? ` ${tone}` : ""}`;
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
    <p>Light the water. Put lanterns on white cells until every white cell is lit. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>The rules</h4>
    <p>A lantern lights its own cell and shines <b>along its row and its column</b>, as far as the next rock or the edge of the board. <b>Every white cell must be lit.</b> <b>No lantern may be lit by another</b>: two in one row or column with no rock between them shine on each other.</p>
    <p>A rock may carry a <b>number</b>: exactly that many lanterns stand on the (up to four) cells touching it, above, below, left and right. A rock with no number says nothing, and the lanterns of the corners don't count. A 0 has none beside it.</p>
    <p><b>An example.</b> A 4 has a lantern on each of its four sides. A cell with a single way to be lit, because rocks wall it in on every other side, must hold a lantern itself.</p>
    <h4>Playing</h4>
    <p>Tap a cell to light a lantern on it, again to dot it (a note that it has none), again to clear it; hold a cell, or right-click it, to dot it at once. Only the lanterns count: the puzzle is solved the moment exactly its answer is lit. Undo and Redo step through your marks, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: two lanterns shining on each other, a rock with too many, a rock that can't get its number any more, a cell that nothing can light now (outlined in red), all in oxblood. That comes from the rules, never the answer. A number turns green once its rock has all its lanterns. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it makes the next step a person would take and says why, the cells it settled ringed in gilt.</p>
    <h4>The sea</h4>
    <p>The same puzzle, played in 3D: the white cells are shoals, the rocks stand out of the water with their numbers, and a lantern is a lighthouse whose beams sweep out along its row and column. 3D is the 3D button under the board or the menu's Play in 3D; the puzzle, the clock and your marks are the same in both. Drag to turn the board, pinch or scroll to zoom, double-tap the water to put it back.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how many numbers it shows. <b>Easy</b>: the plain rules (a lantern's line has no other; a rock with all its lanterns is closed; a rock that needs every cell round it gets them; a cell with one place to be lit from gets a lantern there). <b>Medium</b>: looking ahead one step too (a lantern that would at once leave a cell dark, or a rock short, isn't there). <b>Hard</b>: a short supposition, a lantern put in or taken out and followed for a couple of steps until a rule breaks. <b>Expert</b>: a supposition followed to the end, with as few numbers as will do. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A 10×10 at Medium, the same for everyone. Its first solve counts the moment the last cell is lit, and is Lanterns' figure on the games screen.</p>`;
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
  play.append(action(viewShown === "model" ? "Play in 2D" : "Play in 3D", () => setView(viewShown === "model" ? "flat" : "model"), "link"), action("The rules", showRules, "link"));
  todayPart(body, { app: "lanterns", play: () => start("daily"), playing: S?.mode === "daily" && S.seed === today(), busy: started() });
  content.append(choice("Size", SIZES.map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
  content.append(mirror("Level", $("level")));
  const best = S ? bestOf(S) : null;
  const about = part(body, "about");
  about.append(line(S ? `${kindText({ size: S.size, level: S.came || S.level })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Light every white cell."));
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

// ---------- links: #s=SEED&n=10&l=medium (#d= for a day's) ----------
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const size = SIZES.includes(Number(h.get("n"))) ? Number(h.get("n")) : 10;
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
bindSwitcher($("appsBtn"), "lanterns");
document.querySelector(".lan-mark").innerHTML = APPS.find(a => a.id === "lanterns")?.logo || "";
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
$("viewBtn").addEventListener("click", () => setView(viewShown === "model" ? "flat" : "model"));
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else clockRun(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__lanterns = {
  get state() { return S; }, get puzzle() { return P; }, get model() { return model; }, press, useHint, undo, redo, start, setView,
  /** Where a cell's middle is on the screen, for tests that tap or hold it as a finger would. */
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
if (viewShown === "model") setView("model", false);
onDefaultChange(is3D => { if (!prefs.view && S) setView(is3D ? "model" : "flat", false); });   // Settings' 2D mode, live
solo();
