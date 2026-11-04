// Asterism: the board is cut into as many regions as it is wide; put one star (or two) in every row, every column and
// every region so that no two stars touch, not even corner to corner. The rules, the puzzles and the reasoning are
// asterism-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles are
// made in asterism-worker.js. This file keeps the run, the clock and the taps, and draws the board.
import { KINDS, STARS, LEVELS, DAILY, NONE, STAR, DOT, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "./asterism-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";
import { sure } from "./sure.js";

const $ = id => document.getElementById(id);
const RUN = "asterism:run", TIMES = "asterism:times", PREFS = "asterism:prefs", SPARES = "asterism:spares";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to place a star at once instead of cycling the cell
const DRAG = 12;                     // px a finger moves before a press is a stroke, dotting cell after cell

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode, or full */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const kindText = k => `${k.size}×${k.size} · ${plural(k.k, "star")} · ${LEVELS[k.level]}`;
const kindKey = k => `${k.size}:${k.k}:${k.level}`;
const cap = t => t[0].toUpperCase() + t.slice(1);

// ---------- what you chose ----------
const prefs = { size: 8, k: 1, level: "easy", ...read(PREFS, {}) };
if (!STARS.includes(prefs.k)) prefs.k = 1;
if (!KINDS[prefs.k].includes(prefs.size)) prefs.size = 8;
if (!LEVELS[prefs.level]) prefs.level = "easy";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ size: prefs.size, k: prefs.k, level: levelOn(prefs.size, prefs.k, prefs.level) });

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Hitori's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.k, k.level));
  try {
    worker ||= new Worker(new URL("./asterism-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.size, w.k.k, w.k.level));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.size, k.k, k.level)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, k: k.k, level: k.level }); });
}
const SPARE_KINDS = 6;                 // spares kept for the kinds played most lately
function takeSpare(k) {
  const all = read(SPARES, {}), spare = all[kindKey(k)];
  if (!spare?.puzzle?.reg) return null;
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
// S: { v, mode ("random" or "daily"), seed, size, k, level (asked), came (what it graded), reg, sol, marks, undo, redo (each
//      [cell, from, to, stroke]: a stroke's cells undo together), ms, hints, done ({ ms, score } once solved), lit (a hint's
//      cells, its evidence and its words), fresh (a new best) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, paused = false;
const valid = s => !!s && s.v === 1 && KINDS[s.k]?.includes(s.size) && typeof s.reg === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.size * s.size && s.marks.length === s.sol.length && s.reg.length === s.sol.length && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.done && (S.marks.includes(STAR) || S.marks.includes(DOT) || S.hints > 0);

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleOf(S.size, S.k, S.reg, S.sol);
  clockFrom = null;
  $("level").value = levelOn(S.size, S.k, S.level);
  if (!IN_FRAME) history.replaceState(null, "", hashOf(S));
  drawBoard();
  save();
  clockRun();
  render();
}
/** A new puzzle: today's, or a random one of the kind chosen. */
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
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, size: k.size, k: k.k, level: k.level, came: puzzle.level, reg: puzzle.reg, sol: puzzle.sol, marks: NONE.repeat(puzzle.sol.length) });
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
onPause(() => { paused = true; clockPause(); cancelPress(); }, () => { paused = false; clockRun(); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in asterism:times by size, stars and level, lowest first, not asterism:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, asterism:today).
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, k: s.k, level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, k: S.k, level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
let strokeAt = 0;                    // a stroke dotting cell after cell is one step to undo: its cells share a number
const newStroke = () => (strokeAt = Math.max(Date.now(), strokeAt + 1));   // (a time, so a saved run's numbers never meet a new one)
/** A tap cycles the cell (empty, dot, star); a hold makes it a star at once, or clears it if it is one. */
function press(x, how) {
  if (!S || S.done || IN_FRAME || paused || x < 0) return;
  const from = S.marks[x], to = how === "hold" ? (from === STAR ? NONE : STAR) : nextMark(from);
  setCell(x, from, to);
  if (to === STAR) navigator.vibrate?.(8);
}
function setCell(x, from, to, stroke = 0) {
  if (from === to) return;
  S.marks = withMark(S.marks, x, to);
  S.undo.push([x, from, to, stroke]);
  if (S.undo.length > 600) S.undo.shift();
  S.redo = [];
  S.lit = null;
  changed();
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
  changed();
}
const undo = () => step(S?.undo || [], S?.redo || [], true);
const redo = () => step(S?.redo || [], S?.undo || [], false);
/** After any change: the end is settled the moment the stars are the answer, and the run is kept. */
function changed() {
  if (!S.done && solvedBy(P, S.marks)) finish();
  else save();
  paint();
  render();
}

// ---------- hints ----------
const groupName = g => (g.kind === "row" ? `row ${g.id + 1}` : g.kind === "col" ? `column ${g.id + 1}` : "the marked region");
const listOf = (word, ids) => {
  const n = ids.map(i => i + 1);
  return n.length === 1 ? `${word} ${n[0]}` : `${word}s ${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
};
/** A step of reasoning in words, as a hint says it. */
function explain(x) {
  const k = P.k, stars = plural(k, "star");
  switch (x.tech) {
    case "only": {
      const n = x.set.length;
      return `${cap(groupName(x.group))} needs ${plural(n, "more star")} and has just ${plural(n, "cell")} left that could hold ${n === 1 ? "it" : "them"}: ${n === 1 ? "this is a star" : "these are stars"}.`;
    }
    case "full": return `${cap(groupName(x.group))} has all its ${stars}: the rest of its cells are empty.`;
    case "touch": return "Stars never touch, not even at a corner: the cells around this star are empty.";
    case "pattern": {
      const dots = x.set.some(([, m]) => m === 2), stars2 = x.set.some(([, m]) => m === 1);
      const tail = dots && stars2 ? "Some cells are used by every way and some by none: those are marked." : dots ? "None of them uses these cells, so they are empty." : "All of them use these cells, so they are stars.";
      return `${cap(groupName(x.group))} still needs ${plural(x.need, "star")}, and with none touching there are only ${x.ways} ways to place ${k === 1 ? "it" : "them"}. ${tail}`;
    }
    case "look": return `A star here would leave ${groupName(x.group)} no room for ${x.group.kind === "region" || P.k === 1 ? "its star" : "its stars"}: so this cell is empty.`;
    case "count": {
      const word = x.orient === "col" ? "column" : "row", lines = listOf(word, x.lines), regions = x.regions.length === 1 ? "the marked region" : `the ${x.regions.length} marked regions`;
      if (x.dir === "regions-in-lines") return `${cap(lines)} must hold ${plural(x.stars, "star")}. ${cap(regions)} lie${x.regions.length === 1 ? "s" : ""} wholly inside ${x.lines.length === 1 ? "it" : "them"} and need${x.regions.length === 1 ? "s" : ""} as many, so the other cells of ${x.lines.length === 1 ? "that" : "those"} ${word}${x.lines.length === 1 ? "" : "s"} are empty.`;
      return `${cap(lines)} must hold ${plural(x.stars, "star")}, all inside ${regions}. That leaves nothing for the rest of ${x.regions.length === 1 ? "that region" : "those regions"}: its other cells are empty.`;
    }
    case "trial": {
      const was = x.supposed === 1 ? "a star" : "empty", is = x.supposed === 1 ? "empty" : "a star";
      return `Suppose this cell were ${was}: ${x.rounds} ${x.rounds === 1 ? "step" : "steps"} of consequences on, a rule breaks. So it is ${is}.`;
    }
  }
  return "";
}
function useHint() {
  if (!S || S.done || IN_FRAME || paused) return;
  const h = hintFor(P, S.marks);
  if (!h) return;
  S.hints++;
  let set, text, evidence = [];
  if (h.wrong != null) {
    set = [[h.wrong, h.should]];
    text = h.should === DOT ? "Hint: this star is not part of the answer. It is a dot now." : "Hint: this one is a star, not a dot. It is a star now.";
  } else if (h.step) {
    set = h.step.set.map(([x, m]) => [x, String(m)]);
    evidence = h.step.cells || [];
    const said = explain(h.step);
    text = `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    set = [[h.reveal, h.should]];
    text = "Hint: this one is a star.";
  }
  const hinted = newStroke();                                       // a hint's cells are one step too
  for (const [x, m] of set) { const was = S.marks[x]; if (was !== m) { S.marks = withMark(S.marks, x, m); S.undo.push([x, was, m, hinted]); } }
  S.redo = [];
  S.lit = { set: set.map(([x]) => x), evidence, text };
  changed();
}

// ---------- the end ----------
function finish() {
  const ms = S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
  clockFrom = null;
  S.done = { ms, score: scoreOf(ms) };
  S.lit = null;
  S.fresh = recordBest(S.done.score);
  if (S.mode === "daily") noteDayTime("asterism", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("asterism");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
// The board is N×N cells of one unit; cell x = row · N + column. Every cell is a group: its wash, its marks and an overlay.
let svg = null, cellEls = [];
/** A five-pointed star round (cx, cy). */
const starAt = (cx, cy) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.17 : 0.4;
  return `${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`;
}).join(" ");
function drawBoard() {
  const { N } = P, pad = 0.2;
  svg = svgEl("svg", { viewBox: `${-pad} ${-pad} ${N + 2 * pad} ${N + 2 * pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap a cell to dot it, again to make it a star, again to clear it.`, class: "ast-svg" });
  svgEl("rect", { x: -pad / 2, y: -pad / 2, width: N + pad, height: N + pad, rx: 0.12, class: "ast-paper" }, svg);
  cellEls = Array.from({ length: N * N }, (_, x) => {
    const r = Math.floor(x / N), c = x % N, g = svgEl("g", { class: "ast-c" }, svg);
    svgEl("rect", { x: c, y: r, width: 1, height: 1, class: `ast-t r${P.reg[x]}` }, g);
    svgEl("circle", { cx: c + 0.5, cy: r + 0.5, r: 0.09, class: "ast-dot" }, g);
    svgEl("polygon", { points: starAt(c + 0.5, r + 0.5), class: "ast-star" }, g);
    svgEl("rect", { x: c + 0.05, y: r + 0.05, width: 0.9, height: 0.9, class: "ast-ov" }, g);
    return { g, d: Math.round((r + c) * 55) };
  });
  let lattice = "", rules = "";
  for (let i = 1; i < N; i++) lattice += `M${i} 0V${N}M0 ${i}H${N}`;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = r * N + c;
    if (c < N - 1 && P.reg[x] !== P.reg[x + 1]) rules += `M${c + 1} ${r}V${r + 1}`;
    if (r < N - 1 && P.reg[x] !== P.reg[x + N]) rules += `M${c} ${r + 1}H${c + 1}`;
  }
  svgEl("path", { d: lattice, class: "ast-lattice" }, svg);
  svgEl("path", { d: rules, class: "ast-rule" }, svg);
  svgEl("rect", { x: 0, y: 0, width: N, height: N, class: "ast-frame" }, svg);
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** Each cell's look from the run: star, dot, a rule it breaks, a hint's cell, a hint's evidence. */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), lit = new Set(S.lit?.set || []), why = new Set(S.lit?.evidence || []), short = new Set();
  for (const i of br.short) for (const c of P.groups[i].cells) short.add(c);
  for (let x = 0; x < cellEls.length; x++) {
    const m = S.marks[x], cls = ["ast-c", m === STAR ? "s1" : m === DOT ? "s2" : "", br.bad.has(x) || short.has(x) ? "bad" : "", lit.has(x) ? "lit" : why.has(x) ? "why" : ""].filter(Boolean).join(" ");
    if (cellEls[x].g.getAttribute("class") !== cls) cellEls[x].g.setAttribute("class", cls);
  }
}
/** The solve, shown: the stars flash from the top left. */
function wave() {
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  cellEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
  svg.classList.add("solved");
}

// ---------- the board under a finger: a tap cycles a cell, a hold makes a star, a drag dots cell after cell ----------
let pressing = null;   // { id, cell, x, y, timer, held, stroke ({ id, mode }) }
/** The cell under a point of the screen, or -1. */
function cellAt(ev) {
  const m = svg?.getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()), { N } = P;
  return p.x < 0 || p.y < 0 || p.x >= N || p.y >= N ? -1 : Math.floor(p.y) * N + Math.floor(p.x);
}
function down(ev) {
  if (ev.button > 0) { if (ev.button === 2) press(cellAt(ev), "hold"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  ev.preventDefault();
  cancelPress();
  const cell = cellAt(ev);
  if (cell < 0) return;
  try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: ev.pointerId, cell, x: ev.clientX, y: ev.clientY, held: false, stroke: null };
  pressing.timer = setTimeout(() => { if (!pressing || pressing.stroke) return; pressing.held = true; navigator.vibrate?.(14); press(pressing.cell, "hold"); }, HOLD);
}
function cancelPress() { if (pressing) clearTimeout(pressing.timer); pressing = null; }
/** A finger dotting: the first cell decides, an empty one starts dotting empty cells, a dot starts rubbing dots out. */
function stroke(ev) {
  const x = cellAt(ev), s = pressing.stroke;
  if (x < 0) return;
  const was = S.marks[x];
  s.mode ??= was === NONE ? DOT : was === DOT ? NONE : null;
  if (s.mode == null || was === STAR || was === s.mode) return;
  setCell(x, was, s.mode, s.id);
}
addEventListener("pointermove", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  if (!pressing.stroke) {
    if (Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) <= DRAG * scale()) return;
    clearTimeout(pressing.timer);
    pressing.stroke = { id: newStroke(), mode: null };
    const x = pressing.cell, was = S.marks[x];                         // the cell it began on counts too
    pressing.stroke.mode = was === NONE ? DOT : was === DOT ? NONE : null;
    if (pressing.stroke.mode != null && was !== STAR) setCell(x, was, pressing.stroke.mode, pressing.stroke.id);
  }
  stroke(ev);
});
addEventListener("pointerup", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const { cell, held, stroke: drew } = pressing;
  cancelPress();
  if (!held && !drew && cell >= 0) press(cell, "tap");
});
addEventListener("pointercancel", cancelPress);

// ---------- drawing the rest ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S) { put("time", "0:00"); put("penalty", ""); put("kind", ""); return; }
  put("time", fmt(elapsed() / 1000 + penalty()));
  put("penalty", penalty() ? `+${penalty()} s` : "");
  put("kind", `${S.mode === "daily" ? "Today · " : ""}${kindText({ size: S.size, k: S.k, level: S.came || S.level })}`);
}
/** What the marks break, in words (from the rules alone). */
function brokenText() {
  const br = breaks(P, S.marks);
  if (br.touch.length) return "Two stars touch: stars never touch, not even at a corner.";
  const over = br.over[0] != null ? P.groups[br.over[0]] : null;
  if (over) return `${cap(over.kind === "region" ? "a region" : groupName(over))} holds more than ${plural(P.k, "star")}.`;
  const short = br.short[0] != null ? P.groups[br.short[0]] : null;
  if (short) return `${cap(short.kind === "region" ? "a region" : groupName(short))} has no room left for its ${P.k === 1 ? "star" : "stars"}: a mark must be wrong.`;
  return "";
}
function drawLine() {
  const l = $("line");
  let text, tone = "", bad = S && !S.lit ? brokenText() : "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (bad) { text = bad; tone = "bad"; }
  else if (S.came && S.came !== levelOn(S.size, S.k, S.level) && !started()) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!started()) text = `Put ${plural(S.k, "star")} in every row, column and region, none touching. Tap a cell to dot it (no star), again for a star; drag to dot many cells.`;
  else text = `${plural(S.k, "star")} in every row, column and region; no two touch, even at a corner. A dot is your own note: only the stars count.`;
  if (l.textContent !== text) l.textContent = text;
  l.className = `ast-say${tone ? ` ${tone}` : ""}`;
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
    <p>The board is cut into as many regions as it is wide, each outlined in a heavy rule. Put stars in the cells so that <b>every row, every column and every region holds exactly the same number of stars</b> (one on the easier boards, two on the larger ones), and <b>no two stars touch</b>, not even corner to corner. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>Playing</h4>
    <p>Tap a cell to dot it (a dot is your own note: "no star here"), again to make it a star, again to clear it. Hold a cell, or right-click it, to make it a star at once. Drag across cells to dot many at once (start on a dot to rub dots out). Only the stars count: the puzzle is solved the moment exactly its answer is starred. Undo and Redo step through your marks, and the menu clears the board.</p>
    <p>A broken rule shows at once, in oxblood, with a line under the board saying which: two stars touching, a row, column or region with too many, or one with no room left for its stars. That comes from the rules, never the answer. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it makes the next step a person would take and says why, the cells it settled in gilt and the cells that say so dashed.</p>
    <h4>Finding the stars</h4>
    <p><b>A star's surroundings.</b> The eight cells round a star are empty. <b>A full group.</b> A row, column or region with all its stars has the rest empty. <b>Just enough room.</b> A group that has exactly as many cells left as stars to place has stars in them all.</p>
    <p><b>A group's few ways.</b> Two stars in a short row can go only so many ways without touching; a cell none of those ways uses is empty. <b>No room left.</b> If a star in a cell would leave some row, column or region with nowhere for its stars, the cell is empty. <b>A region held to a line.</b> A region wholly inside one row has the row's star: the row's other cells are empty (and the same the other way round).</p>
    <p><b>Counting.</b> The same across two or three lines: if two regions lie wholly inside two rows, they use up the rows' stars, and the rows' other cells are empty. <b>A trial.</b> Suppose a cell is a star (or empty), follow what that forces, and if a rule breaks, it is the other.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how many stars it starts with. <b>Easy</b>: a star's surroundings, full groups and just enough room. <b>Medium</b>: a group's few ways, a star that would leave no room, a region held to a line. <b>Hard</b>: counting across two lines or regions, and a short trial. <b>Expert</b>: across three, and a long trial. Two stars a row start at Medium: they need those steps from the first move. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size, star count and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>An 8×8 with one star at Medium, the same for everyone. Its first solve counts the moment the last star is placed, and is Asterism's figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// the menu: Play (a new puzzle, clearing the board, the rules), Content (random or today's, the stars, the size, the level), About
let pick = null;                                              // what New puzzle starts: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const content = part(body, "content");
  pick = pick ?? (S?.mode === "daily" ? "daily" : "random");
  const play = part(body, "play");
  play.append(action("New puzzle", () => confirmStart(pick), "primary"));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action("The rules", showRules, "link"));
  content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") {
    content.append(choice("Stars a row", STARS.map(n => [n, String(n)]), prefs.k, v => { prefs.k = v; if (!KINDS[v].includes(prefs.size)) prefs.size = 8; savePrefs(); kindChanged(); openMenu(); }));
    content.append(choice("Size", KINDS[prefs.k].map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
    content.append(mirror("Level", $("level")));
  } else content.append(line(`Today's puzzle is ${kindText(DAILY)}: the same for everyone.`));
  const best = S ? bestOf(S) : null;
  const about = part(body, "about");
  about.append(line(S ? `${kindText({ size: S.size, k: S.k, level: S.came || S.level })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Put the stars in."));
  about.append(action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The size or the stars changed in the menu: the header's level follows, and a spare is made ready. */
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

// ---------- links: #s=SEED&n=8&k=1&l=medium (#d= for a day's) ----------
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&k=${s.k}&l=${s.level}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const k = STARS.includes(Number(h.get("k"))) ? Number(h.get("k")) : 1, size = KINDS[k].includes(Number(h.get("n"))) ? Number(h.get("n")) : 8;
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, k, level: levelOn(size, k, LEVELS[h.get("l")] ? h.get("l") : "medium") } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle));
}

// ---------- wiring ----------
dropdown($("level"));   // the header dropdown in the suite's style (see dropdown.js)
bindSwitcher($("appsBtn"), "asterism");
document.querySelector(".ast-mark").innerHTML = APPS.find(a => a.id === "asterism")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => start("random"));
$("level").addEventListener("change", async () => {
  const v = $("level").value;
  if (S && S.mode !== "daily" && v === levelOn(S.size, S.k, S.level) && S.size === prefs.size && S.k === prefs.k) return;
  const before = prefs.level;
  prefs.level = v; savePrefs();
  if (!(await confirmStart("random"))) { prefs.level = before; savePrefs(); $("level").value = S ? levelOn(S.size, S.k, S.level) : before; }
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else clockRun(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__asterism = {
  get state() { return S; }, get puzzle() { return P; }, press, useHint, undo, redo, start,
  /** Where a cell's middle is on the screen, for tests that tap or drag it as a finger would. */
  cellOf: x => { const m = svg.getScreenCTM(), c = (x % P.N) + 0.5, r = Math.floor(x / P.N) + 0.5; return { x: c * m.a + m.e, y: r * m.d + m.f }; },
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
solo();
