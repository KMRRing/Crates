// Hitori: shade cells so that no number is left twice in a row or a column (on a hex board, in any of its three
// lines), no two shaded cells touch, and the rest stay joined. The rules, the puzzles and the reasoning are
// hitori-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles are
// made in hitori-worker.js. This file keeps the run, the clock and the taps, draws the board, and plays it together on
// one table (duel.js): a race, everyone the same puzzle on their own phone, or the split board, two players on one
// board, each seeing half of its numbers.
import { SHAPES, SIZES, LEVELS, levelsFor, levelOn, DAILY, puzzleOf, solutions, generate, emptyMarks, nextMark, withMark, solvedBy, breaks, hintFor, ownerOf, aloneSettles, rivalPlan, rivalAt, RIVALS, NONE, SHADE, KEEP, B, U } from "./hitori-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo } from "./suite.js";
import { createDuel } from "./duel.js";
import { busy } from "./loading.js";
import { branchPath } from "./rooms.js";

const $ = id => document.getElementById(id);
const RUN = "hitori:run", TIMES = "hitori:times", PREFS = "hitori:prefs", SPARES = "hitori:spares";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to keep a cell instead of cycling it
const PING_FOR = 4000;               // ms a cell pointed at on a split board stays lit
const SEP = "×";                // 8×8
const IN_PARTY = new URLSearchParams(location.search).has("party");

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const first = name => String(name || "Player").split(" ")[0];
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const kindText = k => `${k.shape === "hex" ? `Hex ${k.size}` : `${k.size}${SEP}${k.size}`} · ${LEVELS[k.level]}`;
const kindKey = k => `${k.shape}:${k.size}:${k.level}`;

// ---------- what you chose ----------
// prefs: the board, the size for each board, the level, the computer rival ("off" or one of RIVALS), and how a match
// for two is played (the split board or a race)
const prefs = { shape: "square", size: { square: 6, hex: 7 }, level: "easy", rival: "off", together: "pair", ...read(PREFS, {}) };
if (!SHAPES[prefs.shape]) prefs.shape = "square";
for (const sh of Object.keys(SHAPES)) if (!SIZES[sh].includes(prefs.size?.[sh])) prefs.size = { ...prefs.size, [sh]: SIZES[sh][Math.min(1, SIZES[sh].length - 1)] };
if (!LEVELS[prefs.level]) prefs.level = "easy";
if (prefs.rival !== "off" && !RIVALS[prefs.rival]) prefs.rival = "off";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ shape: prefs.shape, size: prefs.size[prefs.shape], level: levelOn(prefs.shape, prefs.size[prefs.shape], prefs.level) });

// ---------- making puzzles ----------
// Puzzles are made in a worker, so the screen stays responsive while a large Expert board is steered to its level, and
// a spare for each kind played lately is made in the background and kept, so New puzzle is instant. Where there's no
// worker (no module workers, or its script wouldn't load) they're made on the page, as Delta's boards are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.shape, k.size, k.level));
  try {
    worker ||= new Worker(new URL("./hitori-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.shape, w.k.size, w.k.level));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.shape, k.size, k.level)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, shape: k.shape, size: k.size, level: k.level }); });
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
/** A new puzzle of a kind: the spare if there is one (instant), else made now, the rete showing if it takes a moment. */
async function nextPuzzle(k) {
  const spare = takeSpare(k);
  if (spare) { setTimeout(() => refill(k), 400); return spare; }
  const seed = randomSeed(), done = busy("Making the puzzle", { delay: 250 });
  try { return { seed, puzzle: await make(seed, k) }; } finally { done(); setTimeout(() => refill(k), 400); }
}

// ---------- the run ----------
// S: { v, mode ("random", "daily", "duel" or "pair"), seed, shape, size, level (asked), came (what it graded), grid, sol,
//      marks, by (on a split board, who made each mark), undo, redo, ms, hints, done ({ ms, score } once solved), lit (a
//      hint's cells, its reasons and its words), rival, fresh (a new best) }
let S = null, P = null, plan = null;
let clockFrom = null, savedAt = 0, message = null, paused = false, pointing = false;
const valid = s => !!s && s.v === 1 && SHAPES[s.shape] && SIZES[s.shape].includes(s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.marks.length === s.grid.length && s.sol.length === s.grid.length && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  if (S.mode === "duel") duel.keep(S);
  else if (S.mode !== "pair") write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && (S.mode === "random" || S.mode === "daily") && !S.done && (S.marks.includes(SHADE) || S.marks.includes(KEEP) || S.hints > 0);
const together = () => S?.mode === "duel" || S?.mode === "pair";

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, rival: null, ...s };
  P = puzzleOf(S.shape, S.size, S.grid, S.sol);
  plan = S.rival && RIVALS[S.rival] && !together() ? rivalPlan(P, S.rival, S.seed) : null;
  message = null; pointing = false; clockFrom = null;
  $("level").value = levelOn(S.shape, S.size, S.level);
  offerLevels(S.shape, S.size);
  if (!together() && !IN_FRAME) history.replaceState(null, "", hashOf(S));
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
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, shape: k.shape, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol,
  marks: ".".repeat(puzzle.grid.length), rival: mode === "duel" || mode === "pair" || prefs.rival === "off" ? null : prefs.rival });
function confirmStart(mode, k) {
  if (started() && !confirm("Start a new puzzle? This one isn't solved.")) return false;
  start(mode, k);
  return true;
}

// ---------- the clock ----------
// A solo puzzle counts the time it's on screen (S.ms); a race counts from when the table started it, a split board
// from when the two of you began it (duel.js's clock, the database's time).
function clockRun() {
  if (IN_FRAME || !S || together() || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); cancelPress(); }, () => { paused = false; clockRun(); });   // the menu stops the clock, and the rival with it
function elapsed() {
  if (!S) return 0;
  if (S.done) return S.done.ms;
  if (together()) return Math.max(0, duel.now() - (S.begun || duel.now()));
  return S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
}
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in hitori:times by kind, lowest first, not hitori:best (the games screen reads a best as highest-is-best); the
// games screen's figure is today's time (noteDayTime, hitori:today).
const bestOf = s => read(TIMES, {})[kindKey({ shape: s.shape, size: s.size, level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ shape: S.shape, size: S.size, level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
const cellsOf = () => P.board.cells;
const sees = i => S.mode !== "pair" || ownerOf(P.board, i) === S.slot;
/** A tap cycles the cell (unmarked, shaded, kept); a hold keeps it, or clears it if kept. */
function press(i, how) {
  if (!S || S.done || IN_FRAME || paused || i < 0) return;
  if (pointing) { point(i); return; }
  const from = S.marks[i], to = how === "hold" ? (from === KEEP ? NONE : KEEP) : nextMark(from);
  setCell(i, from, to);
  if (to === SHADE) navigator.vibrate?.(8);
}
function setCell(i, from, to, undoable = true) {
  if (from === to) return;
  S.marks = withMark(S.marks, i, to);
  if (S.mode === "pair") { S.by = withMark(S.by || "-".repeat(cellsOf()), i, String(S.slot)); pairWrite(i, to); }
  if (undoable) { S.undo.push([i, from, to]); if (S.undo.length > 400) S.undo.shift(); S.redo = []; }
  S.lit = null;
  changed(i);
}
function undo() {
  const last = S?.undo.pop();
  if (!last || S.done) return;
  const [i, from, to] = last;
  if (S.marks[i] !== to) { changed(); return; }          // on a split board, your partner has marked it since
  S.redo.push(last);
  setCell(i, to, from, false);
}
function redo() {
  const next = S?.redo.pop();
  if (!next || S.done) return;
  const [i, from, to] = next;
  if (S.marks[i] !== from) { changed(); return; }
  S.undo.push(next);
  setCell(i, from, to, false);
}
/** After any change: the line says what broke (the rules alone, never the answer), the end is settled the moment the
 *  shading is the answer, and the run is kept. */
function changed(at = -1) {
  const br = breaks(P, S.marks);
  if (at >= 0 && br.touch.includes(at)) note("Two shaded cells touch: one of them is wrong.", "bad");
  else if (at >= 0 && br.twice.includes(at)) note(`That ${P.val[at]} is kept twice in one ${P.shape === "hex" ? "line" : "row or column"}.`, "bad");
  else if (at >= 0 && br.cut.length) note("The shading cuts the board apart: the kept cells must stay joined.", "bad");
  else if (at >= 0) message = null;
  if (!S.done && solvedBy(P, S.marks)) finish();
  else { save(); tellSoon(); }
  drawCells();
  render();
}
function note(text, tone = "") { message = text ? { text, tone } : null; }

// ---------- hints ----------
const lineWord = () => (P.shape === "hex" ? "line" : "row or column");
const linesWord = () => (P.shape === "hex" ? "its lines" : "its row and column");
const BROKE = {
  touch: "two shaded cells would touch", twice: "a number would be kept twice in one line", split: "the kept cells would be cut apart",
  needless: "a shaded number would have no rival left to need it", both: "a cell would have to be both",
};
/** A step of reasoning in words, as a hint says it. */
function explain(x) {
  const v = P.val[x.why[0] ?? x.set[0][0]], n = x.set.length;
  switch (x.tech) {
    case "beside": return n > 1 ? "These cells touch a shaded one, so they are kept." : "It touches a shaded cell, so it is kept.";
    case "rival": return `That ${v} is kept, so ${n > 1 ? `the other ${v}s in ${linesWord()} are` : `the other ${v} in ${linesWord()} is`} shaded.`;
    case "pair": return `Two ${v}s side by side: one of them stays, so ${n > 1 ? `the other ${v}s in that line are` : `the other ${v} in that line is`} shaded.`;
    case "sandwich": return `Between two ${v}s: shaded, it would leave both ${v}s kept. So it is kept.`;
    case "lone": return n > 1 ? `These numbers have no rival left in ${linesWord()}: kept.` : `This ${P.val[x.set[0][0]]} has no rival left in ${linesWord()}: kept.`;
    case "cut": return "Shading it would cut the board in two, so it is kept.";
    case "walled": return `Kept, this ${P.val[x.set[0][0]]} would shade every cell round it and wall itself in. So it is shaded.`;
    case "trial": {
      const was = x.supposed === B ? "shaded" : "kept", is = x.supposed === B ? "kept" : "shaded";
      return `Suppose it were ${was}: ${x.depth > 1 ? `${x.depth} rounds of consequences on, ` : ""}${BROKE[x.kind] || "a rule would break"}. So it is ${is}.`;
    }
  }
  return "";
}
function useHint() {
  if (!S || S.done || IN_FRAME || paused) return;
  const h = hintFor(P, S.marks);
  if (!h) return;
  S.hints++;
  if (S.mode === "pair") pairHint();
  let set, why = [], text;
  if (h.wrong != null) {
    set = [[h.wrong, h.should]];
    text = h.should === KEEP ? "Hint: this one shouldn't be shaded. It is kept now." : "Hint: this one shouldn't be kept. It is shaded now.";
  } else if (h.step) {
    set = h.step.set.map(([i, v]) => [i, v === B ? SHADE : KEEP]);
    why = h.step.why;
    const said = explain(h.step);
    text = S.mode === "pair" ? `Hint: ${set.length > 1 ? "the gold cells are" : "the gold cell is"} settled.` : `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    set = [[h.reveal, SHADE]];
    text = "Hint: this one is shaded.";
  }
  for (const [i, m] of set) setCell(i, S.marks[i], m);
  S.lit = { set: set.map(([i]) => i), why, text };
  message = null;
  save();
  drawCells();
  render();
}

// ---------- the end ----------
function finish() {
  const ms = together() && S.mode === "pair" ? pairDoneMs() : together() ? Math.max(0, duel.now() - S.begun) : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
  clockFrom = null;
  S.done = { ms, score: scoreOf(ms) };
  S.lit = null;
  if (S.mode === "duel") { tell(true); save(); }
  else if (S.mode === "pair") pairDone(ms);
  else {
    S.fresh = recordBest(S.done.score);
    if (S.mode === "daily") noteDayTime("hitori", S.done.score, S.seed);       // today's puzzle: the first solve's time
    save();
  }
  wave();
}

// ---------- the computer rival ----------
// It plays the same puzzle on a timetable worked out from the engine's own solve (rivalPlan), on your clock: it stands
// while the menu is open and while the page is away, as you do.
function rivalNow() {
  if (!plan || !S) return null;
  return rivalAt(plan, S.done ? S.done.ms : elapsed(), cellsOf());
}
function drawRival() {
  const el = $("rival");
  if (S?.mode === "pair") { drawPair(); return; }
  const r = rivalNow();
  el.hidden = !r;
  if (!r) return;
  const name = `${RIVALS[S.rival].label} computer`;
  const text = r.finished ? `${name}: solved in ${fmt(r.at / 1000)}` : `${name}: ${Math.round((100 * r.done) / r.of)}%`;
  if (el.dataset.text === text) return;
  el.dataset.text = text;
  el.replaceChildren(Object.assign(document.createElement("span"), { className: "hi-bar", style: `--to: ${r.finished ? 1 : r.done / r.of}` }), text);
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
/**
 * Text on the board: its units are cells, so its text is under a unit tall, which Safari lays out badly (it rounds the
 * font's metrics); each number is set a hundred times larger and scaled back down, centred by an explicit offset (as
 * Delta's are).
 */
const TEXT_SCALE = 100;
let svg = null, cellEls = [];
const SQ3 = Math.sqrt(3);
function hexPoints([x, y], r) { return Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return `${(x + r * Math.cos(a)).toFixed(3)},${(y + r * Math.sin(a)).toFixed(3)}`; }).join(" "); }
function drawBoard() {
  const board = P.board, hex = board.shape === "hex", pad = 0.08;
  const centre = i => (hex ? board.xy[i] : [board.xy[i][0] + 0.5, board.xy[i][1] + 0.5]);
  const xs = board.xy.map((_, i) => centre(i)[0]), ys = board.xy.map((_, i) => centre(i)[1]);
  const hw = hex ? SQ3 / 2 : 0.5, hh = hex ? 1 : 0.5;
  const box = [Math.min(...xs) - hw - pad, Math.min(...ys) - hh - pad, Math.max(...xs) - Math.min(...xs) + 2 * (hw + pad), Math.max(...ys) - Math.min(...ys) + 2 * (hh + pad)];
  svg = svgEl("svg", { viewBox: box.map(v => v.toFixed(3)).join(" "), role: "grid", "aria-label": `${kindText(S)}: the board`, class: `hi-svg ${hex ? "hex" : "square"}` });
  const two = board.m >= 10;
  cellEls = board.xy.map((_, i) => {
    const [x, y] = centre(i), g = svgEl("g", { class: "hi-cell" }, svg);
    if (hex) svgEl("polygon", { points: hexPoints([x, y], 0.94), class: "hi-tile" }, g);
    else svgEl("rect", { x: (x - 0.46).toFixed(3), y: (y - 0.46).toFixed(3), width: 0.92, height: 0.92, rx: 0.1, class: "hi-tile" }, g);
    svgEl("circle", { cx: x.toFixed(3), cy: y.toFixed(3), r: hex ? 0.62 : 0.36, class: "hi-ring" }, g);
    const size = (hex ? 0.78 : 0.56) * (two && P.val[i] >= 10 ? 0.82 : 1);
    const t = svgEl("text", { x: 0, y: 0, dy: "0.36em", class: "hi-num", "font-size": size * TEXT_SCALE, transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${1 / TEXT_SCALE})` }, g);
    t.textContent = String(P.val[i]);
    return { g, t, x, y };
  });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  drawCells();
}
/** Each cell's look from the run: shaded, kept (in its keeper's colour on a split board), hidden, broken, lit. */
function drawCells() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), touch = new Set(br.touch), twice = new Set(br.twice), cut = new Set(br.cut);
  const lit = new Set(S.lit?.set || []), why = new Set(S.lit?.why || []), pings = pingsNow();
  const solved = !!S.done;
  for (let i = 0; i < cellEls.length; i++) {
    const { g, t } = cellEls[i], m = S.marks[i], hidden = !solved && !sees(i);
    const cls = ["hi-cell", m === SHADE ? "shaded" : m === KEEP ? "kept" : "", hidden ? "hidden" : "", touch.has(i) || twice.has(i) ? "bad" : "", cut.has(i) ? "cut" : "",
      lit.has(i) ? "lit" : "", why.has(i) ? "why" : "", pings.has(i) ? "ping" : ""].filter(Boolean).join(" ");
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
    const keeper = S.mode === "pair" && m === KEEP ? S.by?.[i] : null;
    const ring = keeper && keeper !== "-" ? `var(--p${keeper})` : "";
    if (g.style.getPropertyValue("--keeper") !== ring) g.style.setProperty("--keeper", ring);
    const ping = pings.get(i);
    if (g.style.getPropertyValue("--pinger") !== (ping ?? "")) g.style.setProperty("--pinger", ping ?? "");
    const want = hidden ? "" : String(P.val[i]);
    if (t.textContent !== want) t.textContent = want;
  }
}
/** The solve, shown: a wave of the kept cells, from the top left (or the hex's top) down. */
function wave() {
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  cellEls.forEach(({ g, x, y }) => g.style.setProperty("--d", `${Math.round((x + y) * 40)}ms`));
  svg.classList.add("solved");
}

// ---------- the board under a finger: a tap cycles a cell, a hold keeps it ----------
let pressing = null;   // { id, cell, x, y, timer, held }
function cellAt(e) {
  if (!svg) return -1;
  const ctm = svg.getScreenCTM();
  if (!ctm) return -1;
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  let best = -1, d2 = Infinity;
  for (let i = 0; i < cellEls.length; i++) { const dx = cellEls[i].x - pt.x, dy = cellEls[i].y - pt.y, d = dx * dx + dy * dy; if (d < d2) { d2 = d; best = i; } }
  return d2 <= (P.shape === "hex" ? 1 : 0.5) ? best : -1;
}
function down(e) {
  if (e.button > 0) { if (e.button === 2) press(cellAt(e), "hold"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  e.preventDefault();
  cancelPress();
  const cell = cellAt(e);
  if (cell < 0) return;
  try { svg.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: e.pointerId, cell, x: e.clientX, y: e.clientY, held: false };
  pressing.timer = setTimeout(() => { if (!pressing) return; pressing.held = true; navigator.vibrate?.(14); press(pressing.cell, "hold"); }, HOLD);
}
function cancelPress() { if (pressing) clearTimeout(pressing.timer); pressing = null; }
addEventListener("pointermove", e => {
  if (!pressing || e.pointerId !== pressing.id) return;
  if (Math.hypot(e.clientX - pressing.x, e.clientY - pressing.y) > 12 * scale()) cancelPress();   // a slip off the cell is no tap
});
addEventListener("pointerup", e => {
  if (!pressing || e.pointerId !== pressing.id) return;
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
  put("kind", `${S.mode === "daily" ? "Today · " : ""}${kindText({ shape: S.shape, size: S.size, level: S.came || S.level })}`);
  drawRival();
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "The same puzzle for everyone at the table.";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (pointing) text = "Tap the cell to show your partner.";
  else if (S.mode === "pair") text = `You see the numbers on the ${S.slot === 0 ? "top" : "bottom"} half, your partner the ${S.slot === 0 ? "bottom" : "top"}: tell each other what you need. Point shows a cell on both phones.`;
  else if (S.came && S.came !== S.level && !S.marks.includes(SHADE)) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!S.marks.includes(SHADE) && !S.marks.includes(KEEP)) text = "Tap a cell to shade it, again to keep it, again to clear it. Hold a cell to keep it.";
  else text = `No number left twice in a ${lineWord()}, no two shaded cells touching, the rest joined in one piece.`;
  if (l.textContent !== text) l.textContent = text;
  l.className = `hi-line${tone ? ` ${tone}` : ""}`;
}
function drawResult() {
  const done = !!S?.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const d = S.done, bits = [`${fmt(d.ms / 1000)} on the clock`];
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${penalty()} s)`);
  let tail = "";
  if (S.mode === "pair") tail = " Solved together.";
  else if (S.mode !== "duel") {
    const r = rivalNow(), best = bestOf(S);
    if (r) tail = r.finished && r.at / 1000 < d.score ? ` The computer was ${fmt(d.score - r.at / 1000)} quicker.` : ` You beat the ${RIVALS[S.rival].label.toLowerCase()} computer${r.finished ? ` by ${fmt(r.at / 1000 - d.score)}` : ""}.`;
    tail += S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
  }
  $("verdict").textContent = `Solved: ${fmt(d.score)}. ${bits.join(", ")}.${tail}`;
  $("nextBtn").textContent = S.mode === "duel" ? "The result" : S.mode === "pair" ? "Another board" : "Another puzzle";
}
function render() {
  document.getElementById("app").classList.toggle("pairing", S?.mode === "pair");
  $("redoBtn").hidden = S?.mode === "pair";
  $("pointBtn").hidden = S?.mode !== "pair";
  $("pointBtn").setAttribute("aria-pressed", String(pointing));
  const off = !S || !!S.done || IN_FRAME;
  for (const b of [$("undoBtn"), $("redoBtn"), $("pointBtn"), $("hintBtn")]) b.disabled = off;
  if (S && !off) { $("undoBtn").disabled = !S.undo.length; $("redoBtn").disabled = !S.redo.length; }
  if (!S) $("board").replaceChildren();
  drawStrip(); drawLine(); drawResult();
}
/** The board's levels: those this shape and size offer (a hex board has no Medium; the widest no Expert). */
function offerLevels(shape, size) {
  const offered = levelsFor(shape, size);
  for (const o of $("level").options) o.disabled = !offered.includes(o.value);
}

// ---------- together: one table (duel.js), a race or the split board ----------
// A match is dealt by whoever starts it: a race (everyone the same puzzle on their own phone; the lowest time plus
// hints wins; up to six, from a party too) or, for two, the split board (one board for both, each seeing the numbers
// on their half only, one time for the team). The table is duel.js's; the split board's marks are kept in it beside
// the runs (pair: { n, k: marks, b: who marked each, h: hints, done }), written in a transaction a mark.
const duel = createDuel({
  game: "hitori", name: "Hitori", accent: "--hi-in", line: $("duelLine"), toast, lower: true,
  deal: dealMatch,
  describe: m => (m.mode === "pair" ? `The split board, ${kindText(m)}: you each see half the numbers, and solve it as one` : `A race, ${kindText(m)}: the same puzzle for everyone, the fastest solve wins`),
  play: (match, { begun, kept }) => (match.mode === "pair" ? playPair(match) : playRace(match, begun, kept)),
  onLobby: match => { S = null; P = null; svg = null; $("level").value = LEVELS[match.level] ? match.level : "easy"; render(); },
  onLeave: () => { stopTable(); solo(); },
});
/** The match the table plays next: a party's is a race; a pair's is the split board or a race, as chosen. */
async function dealMatch() {
  const mode = IN_PARTY || prefs.together === "race" ? "race" : "pair", k = chosenKind();
  for (let n = 0; n < 6; n++) {
    const { seed, puzzle } = await nextPuzzle(k);
    if (!puzzle) continue;
    if (mode === "pair" && !splitHolds(puzzle, k)) continue;      // one half alone could finish it: another
    return { seed, mode, shape: k.shape, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid };
  }
  throw new Error("hitori: no puzzle for the match");
}
/** Whether neither half of a split board can be finished from its own numbers. */
function splitHolds(puzzle, k) {
  const Q = puzzleOf(k.shape, k.size, puzzle.grid, puzzle.sol);
  return [0, 1].every(slot => aloneSettles(Q, Array.from({ length: Q.board.cells }, (_, i) => ownerOf(Q.board, i) === slot)).includes(U));
}
/** The answer to a match's puzzle, found here (the table carries the numbers only). */
const answerOf = m => Array.from(solutions(puzzleOf(m.shape, m.size, m.grid), 1)[0] || []).join("");
const mySlot = () => duel.together.slot ?? 0;
const tableNow = () => duel.together.room?.data || null;

function playRace(match, begun, kept) {
  const same = valid(kept) && kept.seed === match.seed && kept.grid === match.grid;
  const s = same ? kept : { ...fromPuzzle("duel", match.seed, match, { grid: match.grid, sol: answerOf(match), level: match.came }), rival: null };
  begin({ ...s, mode: "duel", begun });
  tell(!!S.done);
}
/** What the table sees of a race: how much of the answer's shading you have right, and your score once solved. */
function tell(done = false) {
  if (S?.mode !== "duel") return;
  if (done) { duel.report({ score: S.done.score, text: fmt(S.done.score), done: true, ms: S.done.ms }); return; }
  let right = 0, of = 0;
  for (let i = 0; i < cellsOf(); i++) if (P.sol[i]) { of++; if (S.marks[i] === SHADE) right++; }
  duel.report({ score: of - right, text: `${Math.round((100 * right) / Math.max(1, of))}%` });
}
let tellTimer = 0;
function tellSoon() {   // a report for every tap would be a write for every tap
  if (S?.mode !== "duel" || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (S?.mode === "duel" && !S.done) tell(); }, 1500);
}

// the split board
const pairOf = g => (g?.pair && g.pair.n === g.n ? g.pair : null);
let tableSeen = null, tableTimer = 0;
function playPair(match) {
  const g = tableNow(), p = pairOf(g), slot = mySlot();
  begin({ ...fromPuzzle("pair", match.seed, match, { grid: match.grid, sol: answerOf(match), level: match.came }), rival: null, mode: "pair", slot,
    marks: p?.k || ".".repeat(match.grid.length), by: p?.b || "-".repeat(match.grid.length), hints: p?.h || 0, begun: g?.start || duel.now(), n: g?.n });
  tableSeen = g;
  if (p?.done) pairSeen(p);
  watchTable();
}
/** The table as together.js last saw it, followed on the page: the partner's marks, pointing and the solve. */
function watchTable() {
  clearInterval(tableTimer);
  tableTimer = setInterval(() => {
    const g = tableNow();
    if (!g || g === tableSeen || S?.mode !== "pair") return;        // together.js gives each new state a new object
    tableSeen = g;
    if (g.n !== S.n) return;                                          // a new match: duel.js deals it
    const p = pairOf(g);
    if (p) {
      S.marks = p.k; S.by = p.b; S.hints = p.h || 0;
      if (p.done && !S.done) pairSeen(p);
      else if (!S.done && solvedBy(P, S.marks)) finish();
    }
    drawCells(); render();
  }, 150);
}
function stopTable() { clearInterval(tableTimer); tableTimer = 0; tableSeen = null; }
function pairWrite(i, to) {
  const n = S.n, slot = String(S.slot), cells = cellsOf();
  duel.together.act(g => {
    if (g.n !== n) return false;
    const p = pairOf(g) || { n, k: ".".repeat(cells), b: "-".repeat(cells), h: 0 };
    if (p.done) return false;
    p.k = withMark(p.k, i, to); p.b = withMark(p.b, i, slot);
    g.pair = p;
  });
}
function pairHint() {
  const n = S.n, cells = cellsOf();
  duel.together.act(g => { if (g.n !== n) return false; const p = pairOf(g) || { n, k: ".".repeat(cells), b: "-".repeat(cells), h: 0 }; p.h = (p.h || 0) + 1; g.pair = p; });
}
const pairDoneMs = () => Math.max(0, duel.now() - S.begun);
function pairDone(ms) {
  // the board as solved goes with the solve: the mark that finished it may not be at the table yet
  const n = S.n, at = S.begun + ms, k = S.marks, b = S.by;
  duel.together.act(g => { if (g.n !== n) return false; const p = pairOf(g) || { n, h: 0 }; if (p.done) return false; Object.assign(p, { k, b, done: { at } }); g.pair = p; });
  record(ms);
}
/** The board solved on the other phone: the same result here. */
function pairSeen(p) {
  const ms = Math.max(0, p.done.at - S.begun);
  S.done = { ms, score: scoreOf(ms) };
  record(ms);
  wave();
}
const recorded = new Set();
function record(ms) {
  const g = tableNow(), id = `${g?.created}-${g?.n}`;
  if (recorded.has(id)) return;
  recorded.add(id);
  reportDuo("hitori", id, { score: scoreOf(ms), won: true, coop: true, lower: true }).catch(e => console.error(e));
}
// pointing: a cell shown to your partner, lit in your colour on both phones for a few seconds
function point(i) {
  pointing = false;
  const room = duel.together.room;
  if (room && tableNow()?.players?.[room.uid]) room.sync.update(`${branchPath(room.code, "hitori")}/players/${room.uid}`, { ping: `${i}:${Math.round(duel.now())}` })?.catch?.(e => console.error(e));
  render();
}
/** The cells pointed at now: Map(cell -> the pointer's colour). */
function pingsNow() {
  const out = new Map(), g = S?.mode === "pair" ? tableNow() : null;
  if (!g) return out;
  for (const p of Object.values(g.players || {})) {
    const [cell, at] = String(p?.ping || "").split(":").map(Number);
    if (Number.isInteger(cell) && duel.now() - at < PING_FOR) out.set(cell, `var(--p${p.slot ?? 0})`);
  }
  return out;
}
/** The split board's line: who sees which half, in their colours, and who's pointing. */
function drawPair() {
  const el = $("rival"), g = tableNow();
  el.hidden = !g;
  if (!g) return;
  const others = duel.together.others(), mine = mySlot();
  const sig = JSON.stringify([others.map(o => [o.name, o.slot, o.here]), mine]);
  if (el.dataset.text === sig) return;
  el.dataset.text = sig;
  const chip = (name, slot, here = true) => { const b = document.createElement("b"); b.className = `hi-seat${here ? "" : " away"}`; b.style.setProperty("--seat", `var(--p${slot})`); b.textContent = here ? name : `${name} (away)`; return b; };
  el.replaceChildren(chip("You", mine), mine === 0 ? " top half · " : " bottom half · ", ...(others.length ? [chip(first(others[0].name), others[0].slot, others[0].here), others[0].slot === 0 ? " top half" : " bottom half"] : ["waiting for your partner"]));
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
// the menu: Play (a new puzzle, clearing the board), Content (random or today's, the board, its size, the level),
// Together (in a match: the next match's way of playing), Settings (the computer rival), About (your best, the rules)
let pick = null;                                              // what New puzzle starts: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const k = chosenKind();
  const content = part(body, "content");
  const boardChoices = () => {
    content.append(choice("Board", Object.entries(SHAPES), prefs.shape, v => { prefs.shape = v; savePrefs(); kindChanged(); openMenu(); }));
    content.append(choice("Size", SIZES[prefs.shape].map(n => [n, String(n)]), prefs.size[prefs.shape], v => { prefs.size = { ...prefs.size, [prefs.shape]: v }; savePrefs(); kindChanged(); openMenu(); }));
    content.append(mirror("Level", $("level")));
  };
  if (duel.on) {
    const tog = part(body, "together"), m = duel.match, pairOk = !IN_PARTY && (tableNow() ? Object.keys(tableNow().players || {}).length <= 2 : true);
    if (S?.mode === "pair") {
      tog.append(action(S.done ? "Another board" : "A new board", () => { if (S.done || confirm("Start a new board? This one isn't solved.")) duel.again(); }, S.done ? "primary" : ""));
    } else duel.menu(tog);
    if (pairOk) tog.append(choice("Next match", [["pair", "Split board"], ["race", "Race"]], prefs.together, v => { prefs.together = v; savePrefs(); }));
    if (S?.mode === "pair") tog.append(action("Back to solo", () => duel.leave(), "link"));
    if (m) tog.append(line(`This match: ${m.mode === "pair" ? "the split board" : "a race"}, ${kindText(m)}.`));
    boardChoices();
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= S?.mode === "daily" ? "daily" : "random";
  const play = part(body, "play");
  play.append(action("New puzzle", () => confirmStart(pick), "primary"));
  if (S && !S.done && (S.marks.includes(SHADE) || S.marks.includes(KEEP))) play.append(action("Clear the board", clearBoard));
  content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") boardChoices();
  else content.append(line(`Today's puzzle is ${kindText(DAILY)}: the same for everyone.`));
  part(body, "settings").append(choice("Computer rival", [["off", "Off"], ...Object.entries(RIVALS).map(([id, r]) => [id, r.label])], prefs.rival, v => { prefs.rival = v; savePrefs(); }),
    line(prefs.rival === "off" ? "From the next puzzle, a computer can solve it beside you, at a person's pace." : "It plays from the next puzzle, on your clock."));
  const best = S ? bestOf(S) : null;
  const rules = Object.assign(document.createElement("p"), { className: "note", textContent: `Shade cells so that no number is left twice in a ${S?.shape === "hex" ? "line (a hex board has three directions of them)" : "row or column"}. Shaded cells never touch side by side, and the cells left unshaded stay joined in one piece. Every puzzle has exactly one answer, found by reasoning alone. A hint costs ${HINT} seconds: it puts a wrong mark right, or makes the next step and says why.` });
  part(body, "about").append(
    line(S ? `${kindText({ shape: S.shape, size: S.size, level: S.came || S.level })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Shade the repeats."),
    rules, action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The board or its size changed in the menu: the header's levels follow, and the level moves to one the board offers. */
function kindChanged() {
  const k = chosenKind();
  offerLevels(k.shape, k.size);
  $("level").value = k.level;
  refill(k);
}
function clearBoard() {
  if (!S || S.done) return;
  if (!confirm("Clear every mark on the board?")) return;
  const cells = cellsOf();
  for (let i = 0; i < cells; i++) if (S.marks[i] !== NONE) setCell(i, S.marks[i], NONE);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- links: #s=SEED&b=square&n=8&l=medium (#d= for a day's) ----------
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&b=${s.shape}&n=${s.size}&l=${s.level}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const shape = SHAPES[h.get("b")] ? h.get("b") : "square", size = SIZES[shape].includes(Number(h.get("n"))) ? Number(h.get("n")) : SIZES[shape][1];
  return { seed, mode: h.get("d") ? "daily" : "random", k: { shape, size, level: levelOn(shape, size, LEVELS[h.get("l")] ? h.get("l") : "medium") } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle));
}

// ---------- wiring ----------
dropdown($("level"));   // the header dropdown in the suite's style (see dropdown.js)
bindSwitcher($("appsBtn"), "hitori");
document.querySelector(".hi-mark").innerHTML = APPS.find(a => a.id === "hitori")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("nextBtn").addEventListener("click", () => {
  if (S?.mode === "duel") duel.open();
  else if (S?.mode === "pair") duel.again();
  else start("random");
});
$("level").addEventListener("change", () => {
  const v = $("level").value;
  if (duel.on) {                                                // a new match at that level, for everyone at the table
    prefs.level = v; savePrefs();
    const ok = S?.mode === "pair" ? (S.done || confirm("Start a new board at that level? This one isn't solved.")) && (duel.again(), true) : duel.newMatch();
    if (!ok) $("level").value = duel.match?.level || v;
    return;
  }
  if (S && S.mode !== "daily" && v === S.level && S.shape === prefs.shape && S.size === prefs.size[prefs.shape]) return;
  const before = prefs.level;
  prefs.level = v; savePrefs();
  if (!confirmStart("random")) { prefs.level = before; savePrefs(); $("level").value = S ? levelOn(S.shape, S.size, S.level) : before; }
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
$("pointBtn").addEventListener("click", () => { pointing = !pointing; message = null; render(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const l = linked(); if (!duel.on && l && !(S && S.seed === l.seed && S.mode === l.mode)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (S.mode === "pair") drawCells();                             // a pointed cell lights and fades on the clock
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__hitori = {
  get state() { return S; }, get puzzle() { return P; }, get duel() { return duel; }, get plan() { return plan; },
  press, useHint, undo, redo, start, cellAt,
  /** Where a cell is on the screen, for tests that tap it as a finger would. */
  screenOf: i => { const m = svg.getScreenCTM(); return { x: cellEls[i].x * m.a + m.e, y: cellEls[i].y * m.d + m.f }; },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
function solo() {
  const kept = read(RUN, null);
  S = null;
  if (valid(kept) && kept.mode !== "duel" && kept.mode !== "pair") S = kept;
  const l = linked();
  if (l && !(S && S.seed === l.seed && S.mode === l.mode && S.shape === l.k.shape && S.size === l.k.size)) { openLinked(l); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && S.seed === today())) {
    if (!started() || confirm("Today's puzzle is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  if (S) { const s = S; S = null; begin(s); if (!IN_FRAME) refill(chosenKind()); }
  else if (IN_FRAME) render();
  else start("random");
}
offerLevels(prefs.shape, prefs.size[prefs.shape]);
$("level").value = chosenKind().level;
// a match in the address: its table, with no solo puzzle made under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });
else solo();
