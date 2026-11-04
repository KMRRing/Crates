// Atoll: shade the sea. Each number is an island of that many cells (joined edge to edge, with that one number in it);
// the rest of the board is sea, in one piece and with no 2×2 block of it. The rules, the puzzles and the reasoning are
// nurikabe-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles are
// made in nurikabe-worker.js. This file keeps the run, the clock and the taps, and draws the board.
import { SIZES, LEVELS, DAILY, NONE, SEA, LAND, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "./nurikabe-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { wants3D, onDefaultChange } from "./mode3d.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";
import { sure } from "./sure.js";
import { cellEdit, tallyEdit, onceEdit } from "./board-share.js";
import nurikabeCoop from "./nurikabe-coop.js";

const $ = id => document.getElementById(id);
const RUN = "nurikabe:run", TIMES = "nurikabe:times", PREFS = "nurikabe:prefs", SPARES = "nurikabe:spares";
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
const prefs = { size: 8, level: "easy", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 8;
if (!LEVELS[prefs.level]) prefs.level = "easy";
// prefs.view is the player's own choice ("model" or "2d"), kept only when they make one; with none the suite's default applies (mode3d.js).
// ("board" was the old default, written into every save: dropped.) `viewShown` is what is on the screen now.
if (prefs.view !== "model" && prefs.view !== "2d") delete prefs.view;
let viewShown = wants3D(prefs.view, "model") ? "model" : "board";
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
    worker ||= new Worker(new URL("./nurikabe-worker.js", import.meta.url), { type: "module" });
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
//      cell: 0 clear, 1 sea, 2 island dot), undo, redo (each [cell, from, to, stroke]: a stroke's cells undo together),
//      ms, hints, done ({ ms, score } once solved), lit (a hint's cells, the cells it read and its words), fresh (a new best) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const valid = s => !!s && s.v === 1 && SIZES.includes(s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.marks.length && s.grid.length === s.size * s.size && s.marks.length === s.grid.length && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  if (COOP) {       // the host's own run follows the shared board (it is theirs again when the co-op ends); the guest's is left alone
    if (coopHost) write(RUN, { ...S, undo: [], redo: [], lit: null, ms: Math.round(teamMs()) });
    return;
  }
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
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: NONE.repeat(puzzle.sol.length) });
/** The shared board for a puzzle (what the host's run becomes when a partner joins). */
const shareOf = run => nurikabeCoop.share({ [RUN]: JSON.stringify({ v: 1, ms: 0, hints: 0, ...run }) });
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
onPause(() => { paused = true; clockPause(); cancelPress(); model?.hold(true); }, () => { paused = false; clockRun(); model?.hold(false); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : COOP ? teamMs() : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in nurikabe:times by size and level, lowest first, not nurikabe:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, nurikabe:today).
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
let strokeAt = 0;                    // a stroke painted over several cells is one step to undo: its cells share a number
const newStroke = () => (strokeAt = Math.max(Date.now(), strokeAt + 1));   // (a time, so a saved run's numbers never meet a new one)
/** A tap cycles the cell (clear, sea, island dot); a right-click dots it, or clears it if dotted. A number can't be marked. */
function press(x, how) {
  if (!S || S.done || IN_FRAME || paused || x < 0 || P.clue[x]) return;
  const from = S.marks[x], to = how === "dot" ? (from === LAND ? NONE : LAND) : nextMark(from);
  setCell(x, from, to);
  if (to === SEA) navigator.vibrate?.(8);
}
function setCell(x, from, to, stroke = 0) {
  if (from === to) return;
  if (coop) coop.edit(cellEdit("marks", x, from, to));      // shows at once (showBoard) and goes to the room
  else S.marks = withMark(S.marks, x, to);
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
  const group = last[3] || -1, edits = [];
  do {
    const [x, was, now] = from.pop();
    to.push([x, was, now, group > 0 ? group : 0]);
    // an undo only puts back what is still as you left it: a mark your partner changed since stays theirs
    if (coop) edits.push(cellEdit("marks", x, back ? now : was, back ? was : now, back));
    else S.marks = withMark(S.marks, x, back ? was : now);
  } while (group > 0 && from.at(-1)?.[3] === group);
  if (coop) coop.edit(edits);
  S.lit = null;
  changed(-1);
}
const undo = () => step(S?.undo || [], S?.redo || [], true);
const redo = () => step(S?.redo || [], S?.undo || [], false);
/** After any change: the line says what broke (from the rules alone, never the answer), the end is settled the moment
 *  the sea shaded is the answer, and the run is kept. */
function changed(at = -1) {
  if (at >= 0) {
    const br = breaks(P, S.marks);
    if (S.marks[at] === SEA && br.pool.includes(at)) note("A 2×2 block of sea isn't allowed: one of its four is island.", "bad");
    else if (S.marks[at] === SEA && br.cut.includes(at)) note("That sea is cut off from the rest: the sea must be one piece.", "bad");
    else if (S.marks[at] === LAND && br.island.includes(at)) note("That island has two numbers, or more cells than its number.", "bad");
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
  const sea = x.set.every(([, v]) => v === 1);
  switch (x.tech) {
    case "complete": return "An island that has all its cells is walled in: every cell touching it is sea.";
    case "between": return "A cell touching two islands would join them into one with two numbers, or one too big for its number: it is sea.";
    case "grow": return "An island that needs more cells has only one way out: that cell is island.";
    case "pool": return "Three cells of a 2×2 block are sea: the fourth is island, or the sea would pool.";
    case "count": return sea ? "Every island cell is already found (the numbers add up to that many): all the rest is sea." : "Only as many cells are left as the islands still need: they are all island.";
    case "reach": return "No island has enough cells left to reach this cell: it is sea.";
    case "cut": return "This cell is the only link between parts of the sea. Left as island it would cut the sea in two: it is sea.";
    case "trial": {
      const was = x.supposed === 1 ? "sea" : "island", is = x.supposed === 1 ? "island" : "sea";
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
  let set, text, focus = [];
  if (h.wrong != null) {
    set = [[h.wrong, h.should]];
    text = h.should === SEA ? "Hint: this one is sea. It is shaded now." : "Hint: this one is island. It is dotted now.";
  } else if (h.step) {
    set = h.step.set.map(([x, v]) => [x, String(v)]);
    focus = h.step.focus || [];
    const said = explain(h.step);
    text = `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    set = [[h.reveal, h.should]];
    text = h.should === SEA ? "Hint: this one is sea." : "Hint: this one is island.";
  }
  const hinted = newStroke();                                       // a hint's cells are one step too
  if (coop) {       // the marks and the hint taken, together: the hint counts once for both of you
    const marks = set.filter(([x, m]) => S.marks[x] !== m);
    for (const [x, m] of marks) S.undo.push([x, S.marks[x], m, hinted]);
    S.redo = [];
    coop.edit([...marks.map(([x, m]) => cellEdit("marks", x, S.marks[x], m)), tallyEdit("hints", hintId())]);
  } else for (const [x, m] of set) setCell(x, S.marks[x], m, hinted);
  S.lit = { set: set.map(([x]) => x), focus, text };
  message = null;
  save();
  paint();
  render();
}

// ---------- the end ----------
/** The sea is the answer: the time stands for both of you, whoever saw it first (a value that is set once, board-share.js). */
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
  if (S.mode === "daily") noteDayTime("nurikabe", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("nurikabe");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
// The board is N×N cells of one unit; cell x = row · N + column.
let svg = null, cellEls = [];
const rc = x => [Math.floor(x / P.N), x % P.N];
function drawBoard() {
  const { N } = P, pad = 0.2;
  svg = svgEl("svg", { viewBox: `${-pad} ${-pad} ${N + 2 * pad} ${N + 2 * pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap a cell to shade it as sea, again to dot it as island, or drag to paint.`, class: "nk-svg" });
  svgEl("rect", { x: -pad / 2, y: -pad / 2, width: N + pad, height: N + pad, rx: 0.12, class: "nk-paper" }, svg);
  cellEls = Array.from({ length: P.cells }, (_, x) => {
    const [r, c] = rc(x), g = svgEl("g", { class: "nk-c" }, svg);
    svgEl("rect", { x: c, y: r, width: 1, height: 1, class: "nk-cell" }, g);
    svgEl("circle", { cx: c + 0.5, cy: r + 0.5, r: 0.1, class: "nk-dot" }, g);
    if (P.clue[x]) svgEl("text", { x: c + 0.5, y: r + 0.5 + 0.2, class: "nk-num" }, g).textContent = P.clue[x];
    svgEl("rect", { x: c + 0.07, y: r + 0.07, width: 0.86, height: 0.86, class: "nk-ring" }, g);
    return { g, d: Math.round((r + c) * 55) };
  });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** Each cell's look from the run: sea, island dot, a rule broken, lit or read by a hint; each number's: whole or over. */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), pool = new Set(br.pool), cut = new Set(br.cut), over = new Set(br.island), done = new Set(br.done);
  const lit = new Set(S.lit?.set || []), why = new Set(S.lit?.focus || []);
  for (let x = 0; x < cellEls.length; x++) {
    const m = S.marks[x];
    const cls = ["nk-c", m === SEA ? "sea" : m === LAND ? "land" : "", pool.has(x) ? "pool" : "", cut.has(x) ? "cut" : "", over.has(x) ? "over" : "", done.has(x) ? "done" : "",
      lit.has(x) ? "lit" : why.has(x) ? "why" : ""].filter(Boolean).join(" ");
    if (cellEls[x].g.getAttribute("class") !== cls) cellEls[x].g.setAttribute("class", cls);
  }
  feedModel({ pool, cut, over, done, lit, why });
}
/** The solve, shown: the sea turns gilt from the top left. */
function wave() {
  model?.celebrate();
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  cellEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
  svg.classList.add("solved");
}

// ---------- 3D: the same board as solid land with the sea carved out as a river (nurikabe-3d.js, loaded when first asked for) ----------
let model = null, modelFor = null;
/** The model follows the run: a new puzzle is built into it, every change of the marks, the rules broken or a hint's cells is shown. */
function feedModel(sets) {
  if (!model || viewShown !== "model" || !S || !P) return;
  if (modelFor !== P) { model.set({ N: P.N, clue: P.clue }); modelFor = P; }
  model.update({ marks: S.marks, ...sets, solved: !!S.done });
}
/** Flat (the default and the simple mode) or model (`prefs.view` keeps "board" and "model"). The model's code (three.js) comes only when it is first wanted; where there is no WebGL the flat board stays. */
async function setView(v, remember = true) {
  if (v === "model" && !model) {
    try {
      model = (await import("./nurikabe-3d.js")).createModel($("model"), { press, playable: () => !!S && !S.done && !IN_FRAME && !paused });
    } catch (err) { console.warn("Atoll: no 3D here.", err); toast("This browser can't draw 3D."); v = "board"; }
  }
  viewShown = v;
  if (remember) { prefs.view = v === "model" ? "model" : "2d"; savePrefs(); }
  const on = v === "model";
  $("board").closest(".nk-card").classList.toggle("is-model", on);
  $("model").hidden = !on;
  model?.show(on);
  if (on) paint();
}

// ---------- the board under a finger: a tap cycles a cell, a drag paints cell after cell ----------
let pressing = null;   // { id, x, y, from (the cell pressed), stroke ({ id, at (the cell the finger is in), mode }) }
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
/** Paints a cell with the stroke's mark (a number is left alone). */
function paintCell(x, s) {
  if (x < 0 || P.clue[x]) return;
  setCell(x, S.marks[x], s.mode, s.id);
  if (s.mode === SEA && S.marks[x] === SEA) navigator.vibrate?.(5);
}
addEventListener("pointermove", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const p = toBoard(ev);
  if (!pressing.stroke) {
    if (Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) <= DRAG * scale()) return;
    // the mark a tap on the cell pressed would have made, laid on every cell the finger crosses
    const from = pressing.from;
    pressing.stroke = { id: newStroke(), at: from, mode: from < 0 || P.clue[from] ? SEA : nextMark(S.marks[from]) };
    paintCell(from, pressing.stroke);
  }
  const s = pressing.stroke, to = cellAt(p);
  if (to < 0) return;
  // step cell by cell, so a quick drag leaves no gaps
  while (s.at !== to) {
    const [r, c] = rc(s.at), [tr, tc] = rc(to), dr = tr - r, dc = tc - c;
    s.at = Math.abs(dr) >= Math.abs(dc) ? s.at + Math.sign(dr) * P.N : s.at + Math.sign(dc);
    paintCell(s.at, s);
  }
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
  else if (!/[12]/.test(S.marks)) text = "Tap a cell to shade it as sea, again to dot it as island (a note), again to clear it. Or drag to paint a run of cells.";
  else text = "Each number is an island of that many cells. The rest is sea: one piece, with no 2×2 block of it.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `nk-say${tone ? ` ${tone}` : ""}`;
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
    <p>Shade the sea. Each number marks an island of exactly that many cells; everything that isn't an island is sea. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>The rules</h4>
    <p>An island is cells joined edge to edge, with <b>one</b> number in it, and as many cells as that number says. Two islands never touch edge to edge (they may touch at a corner).</p>
    <p>The sea is <b>one connected piece</b>: from any sea cell you can walk to any other through sea. And the sea <b>has no 2×2 block</b>: a pool of four sea cells in a square is not allowed.</p>
    <p><b>An example.</b> A 1 is an island of one cell, so all four cells touching it are sea. A cell between two numbers can't belong to either, or it would join them: it's sea.</p>
    <h4>Playing</h4>
    <p>Tap a cell to shade it as sea, again to dot it as island (a note for yourself, nothing more), again to clear it; a right-click dots a cell at once. Drag to paint a run of cells with the mark a tap on the first one would make. Only the sea counts: the puzzle is solved the moment exactly its answer is shaded. Undo and Redo step through your strokes, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: a 2×2 pool of sea, sea cut off from the rest, an island with two numbers or too many cells, all in oxblood. That comes from the rules, never the answer. A number turns green once its island is whole. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it makes the next step a person would take and says why, the cells it settled ringed in gilt.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how many numbers it shows. <b>Easy</b>: the plain rules (an island with all its cells is walled in; a cell between two islands is sea; an island with one way out takes it; a cell no island can reach is sea; three sea cells in a 2×2 leave the fourth island). <b>Medium</b>: the sea kept in one piece as well (a cell that is the only link between parts of the sea is sea). <b>Hard</b>: a supposition too, a cell supposed one way and followed until a rule breaks. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>An 8×8 at Medium, the same for everyone. Its first solve counts the moment the sea is right, and is Atoll's figure on the games screen.</p>`;
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
  play.append(action(viewShown === "model" ? "Play in 2D" : "Play in 3D", () => setView(viewShown === "model" ? "board" : "model"), "link"), action("The rules", showRules, "link"));
  if (!COOP) content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") {
    content.append(choice("Size", SIZES.map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
    content.append(mirror("Level", $("level")));
  } else content.append(line(`Today's puzzle is ${kindText(DAILY)}: the same for everyone.`));
  if (coop) part(body, "together").append(line(`Co-op with ${coop.otherName}: one board for you both.`), action(coop.host ? "End the co-op" : "Leave the co-op", () => coop.leave(), "link"));
  const best = S && !COOP ? bestOf(S) : null;
  const about = part(body, "about");
  about.append(line(S ? `${kindText({ size: S.size, level: S.came || S.level })}: ${COOP ? (S.done ? "solved" : "not solved yet") : best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Shade the sea round the islands."));
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
  const clearing = newStroke();                                      // one step to undo
  if (coop) {
    const marks = [...S.marks].map((m, x) => (m !== NONE ? [x, m] : null)).filter(Boolean);
    for (const [x, m] of marks) S.undo.push([x, m, NONE, clearing]);
    S.redo = [];
    S.lit = null;
    coop.edit(marks.map(([x, m]) => cellEdit("marks", x, m, NONE)));
    changed();
    return;
  }
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
bindSwitcher($("appsBtn"), "nurikabe");
document.querySelector(".nk-mark").innerHTML = APPS.find(a => a.id === "nurikabe")?.logo || "";
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
window.__nurikabe = {
  get model() { return model; }, setView, get state() { return S; }, get puzzle() { return P; }, get coop() { return coop; }, press, useHint, undo, redo, start,
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

/** The board of a party of two: the room's, drawn each time it moves (coop-page.js). */
function showBoard(board, info) {
  const run = nurikabeCoop.run(board), wasDone = !!S?.done;
  team = board.start || team;
  coopHost = info.host;
  if (info.fresh || !S) {
    S = { undo: [], redo: [], ms: 0, lit: null, ...run };
    P = puzzleOf(S.size, S.grid, S.sol);
    message = null; sentDone = false;
    cancelPress();                                          // a finger painting on the board that has just been replaced
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
  coop = await startCoop("nurikabe", {
    toast, show: showBoard,
    fresh: async () => { const k = chosenKind(), { seed, puzzle } = await nextPuzzle(k); return shareOf(fromPuzzle("random", seed, k, puzzle)); },
    bar: el => { $("kind").hidden = true; $("kind").after(el); },
  });
  if (!coop && !IN_FRAME) solo();
}
$("level").value = chosenKind().level;
if (viewShown === "model") setView("model", false);
onDefaultChange(is3D => { if (!prefs.view && S) setView(is3D ? "model" : "board", false); });   // Settings' 2D mode, live
if (COOP) joinPartner().catch(e => { console.error(e); solo(); }); else solo();
