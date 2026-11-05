// Lanterns: light the water. Put lanterns on white cells so that every white cell is lit; a lantern shines along its row and
// column up to the next rock, no lantern may shine on another, and a numbered rock has exactly that many lanterns on the
// four cells touching it. The rules, the puzzles and the reasoning are lanterns-engine.js's (every puzzle has one answer,
// and is graded by the hardest step a person needs); the puzzles are made in lanterns-worker.js. Twists (5 November 2026):
// mirrors, short beams, bounds on a rock's number, and a hex board; the ladder of levels that brings them in is
// lanterns-levels.js's. This file keeps the run, the clock and the taps, and draws the flat board; lanterns-3d.js draws the
// same run as a sea of lighthouses, loaded when first asked for. Played alone: Dujiang's co-op and head-to-head are not done for it.
import { SIZES, HEX_SIZES, LEVELS, DAILY, NONE, LIGHT, DOT, TWISTS, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn, cellsOf, twistOf, twistKey, twistName, numberText, trace, boardOf } from "./lanterns-engine.js";
import { LEVELS as LADDER, CHAPTERS, COUNT, chapterOf, seedOf, kindOf, parOf, starsFor } from "./lanterns-levels.js";
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
const RUN = "lanterns:run", TIMES = "lanterns:times", PREFS = "lanterns:prefs", SPARES = "lanterns:spares", TRACK = "lanterns:track", CAMP = "lanterns:camp", LRUNS = "lanterns:lruns";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to mark a cell with a dot instead of cycling it
const SLIP = 12;                     // px a finger may stray and still be a tap
const STAR = "★", HOLLOW = "☆";

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
// A kind of puzzle is { size, level, twist }, twist a name ("mirrors+hex") or "none". A run keeps `board` ("hex"), `reach` (a short beam's
// k) and `twist` only when it has them, so a plain run is saved as it always was.
const twistIn = k => twistKey(k?.twist);
const kindText = k => {
  const f = twistOf(k.twist), others = twistName({ ...f, hex: false });
  return `${f.hex ? `Hex ${k.size}` : `${k.size}×${k.size}`} · ${LEVELS[k.level]}${others ? ` · ${others}` : ""}${k.reach ? ` · Reach ${k.reach}` : ""}`;
};
/** A kind's key in the bests and spares: the plain ones keep the key they always had. */
const kindKey = k => (twistIn(k) === "none" ? `${k.size}:${k.level}` : `${twistIn(k)}:${k.size}:${k.level}`);

// ---------- what you chose ----------
const prefs = { size: 10, level: "easy", board: "square", twists: [], ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 10;
if (!LEVELS[prefs.level]) prefs.level = "easy";
if (prefs.board !== "hex") prefs.board = "square";
prefs.twists = Array.isArray(prefs.twists) ? prefs.twists.filter(t => TWISTS[t] && t !== "hex") : [];
// prefs.view is the player's own choice ("model" or "2d"), kept only when they make one; with none the suite's default applies (mode3d.js).
// ("flat" was the old default, written into every save: dropped.) `viewShown` is what is on the screen now.
if (prefs.view !== "model" && prefs.view !== "2d") delete prefs.view;
let viewShown = wants3D(prefs.view, "model") ? "model" : "flat";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
// Korbi, 4 November 2026: the menu is the minimum it needs to be. Size and level are one hidden ramp, its first rung the old
// saved choice; the ladder steps up after a puzzle solved without a hint. One ramp for the square board, one for the hex board
// (7 across has no Expert: docs/lanterns.md) and one for the square board with twists on (no Expert: it rarely comes and takes long).
const LEVEL_KEYS = Object.keys(LEVELS);
const RUNGS = rungs(SIZES, LEVEL_KEYS);
const RUNGS_TWIST = rungs(SIZES, LEVEL_KEYS, (s, l) => l !== "expert");
const RUNGS_HEX = rungs(HEX_SIZES, LEVEL_KEYS, (s, l) => !(l === "expert" && Number(s) < 9));
const OLD = { size: prefs.size, level: prefs.level };
/** The kind the hidden ramp deals now, for the board and twists chosen in Free play. */
const chosenKind = () => {
  const hex = prefs.board === "hex", twist = twistKey({ hex, ...Object.fromEntries(prefs.twists.map(t => [t, true])) });
  const rung = hex ? ramp("lanterns", RUNGS_HEX, { id: "hex", start: startFor(RUNGS_HEX, HEX_SIZES, LEVEL_KEYS, 9, OLD.level) })
    : prefs.twists.length ? ramp("lanterns", RUNGS_TWIST, { id: "twist", start: startFor(RUNGS_TWIST, SIZES, LEVEL_KEYS, OLD.size, OLD.level) })
      : ramp("lanterns", RUNGS, { start: startFor(RUNGS, SIZES, LEVEL_KEYS, OLD.size, OLD.level) });
  const { size, level } = split(rung);
  return { size: Number(size), level: levelOn(Number(size), level), twist };
};

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Cull's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level, k.twist));
  try {
    worker ||= new Worker(new URL("./lanterns-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.size, w.k.level, w.k.twist));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.size, k.level, k.twist)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, level: k.level, twist: k.twist }); });
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
// S: { v, mode ("random", "daily" or "level"), lv (a level's number), seed, size, level (asked), came (what it graded), twist (a name, only when
//      there is one), board ("hex" only), reach (a short beam's k), grid, sol, marks (a character a cell: 0 clear, 1 lantern, 2 dot),
//      undo, redo (each [cell, from, to, stroke]: a hint's or a clearing's cells undo together), ms, hints, done ({ ms, score } once
//      solved), lit (a hint's cells, the cells it read and its words), fresh (a new best) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const isLevel = s => s?.mode === "level" && Number.isInteger(s.lv);
const hexOf = s => s?.board === "hex";
const valid = s => !!s && s.v === 1 && (hexOf(s) ? HEX_SIZES : SIZES).includes(s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.marks.length && s.grid.length === cellsOf(hexOf(s) ? "hex" : "square", s.size) && s.marks.length === s.grid.length && Number.isFinite(s.ms);
const kindOfRun = s => ({ size: s.size, level: s.came || s.level, twist: s.twist || "none", reach: s.reach });
/** The engine's puzzle for a run. */
const puzzleFor = s => puzzleOf(s.size, s.grid, s.sol, { board: s.board, k: s.reach });

function save() {
  if (IN_FRAME || !S) return;
  if (isLevel(S)) write(LRUNS, { ...read(LRUNS, {}), [S.lv]: S }); else write(RUN, S);
  savedAt = performance.now();
}
const startedRun = r => !!r && !r.done && (/[12]/.test(r.marks) || r.hints > 0);
const started = () => startedRun(S);

// ---------- the levels ----------
/** The campaign as kept: the level being played and the stars won in each, mended if it is not what it should be. */
function readCamp() {
  const c = read(CAMP, null), stars = LADDER.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const open = stars.findIndex(x => x < 1);                          // the first level not solved is the last one open
  return { v: 1, at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, open < 0 ? COUNT - 1 : open)) : 0, stars };
}
let camp = readCamp();
/** Whether level n (0 on) is open: the first, and any whose one before is solved. */
const isOpen = n => n === 0 || camp.stars[n - 1] >= 1;
// A player with a free puzzle in hand from before levels came carries on with it; anyone else begins on the ladder.
let track = read(TRACK, null);
if (track !== "levels" && track !== "free") track = valid(read(RUN, null)) ? "free" : "levels";
/** The puzzle saved for the way being played (and the level), or null. */
function savedGame() {
  const g = track === "levels" ? read(LRUNS, {})[camp.at] : read(RUN, null);
  return valid(g) && (track === "levels" ? isLevel(g) && g.lv === camp.at : !isLevel(g)) ? g : null;
}
/** What a level says when it is first met: its chapter's idea if it is the chapter's first, else nothing. */
function introOf(n) {
  const ch = CHAPTERS[chapterOf(n)];
  return n === ch.from && n > 0 ? { text: `${ch.name}. ${ch.about}`, tone: "" } : null;
}

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleFor(S);
  message = isLevel(S) && !started() && !S.done ? introOf(S.lv) : null; clockFrom = null;
  track = isLevel(S) ? "levels" : "free";
  if (isLevel(S)) camp.at = S.lv;                                    // a link's level is the one in hand now
  if (!IN_FRAME) { write(TRACK, track); if (isLevel(S)) write(CAMP, camp); history.replaceState(null, "", hashOf(S)); }
  if (viewShown === "model" && modelBlocked()) setView("flat", false);
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
const fromPuzzle = (mode, seed, k, puzzle, extra = {}) => ({
  mode, seed, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: NONE.repeat(puzzle.sol.length),
  ...(twistIn(k) !== "none" ? { twist: twistIn(k) } : {}), ...(puzzle.board ? { board: puzzle.board } : {}), ...(puzzle.k ? { reach: puzzle.k } : {}), ...extra,
});
async function confirmStart(mode, k) {
  if (started() && !(await sure("Start a new puzzle? This one isn't solved.", { yes: "New puzzle" }))) return false;
  start(mode, k);
  return true;
}
/** A puzzle of level n (0 on): the level's own the first time it is played, a new one after that or when asked. */
async function levelBlock(n, again = false) {
  if (IN_FRAME) return;
  const k = kindOf(n);
  let seed, puzzle;
  if (!again && camp.stars[n] < 1) {
    seed = seedOf(n);
    const done = busy("Making the puzzle", { delay: 250 });
    try { puzzle = await make(seed, k); } finally { done(); }
  } else ({ seed, puzzle } = await nextPuzzle(k));
  if (puzzle) begin(fromPuzzle("level", seed, k, puzzle, { lv: n }));
}
/** Plays level n (0 on) as it was left, or new if it was not begun. */
async function playLevel(n) {
  if (!isOpen(n) || IN_FRAME) return;
  clockPause();
  camp.at = n;
  write(CAMP, camp);
  track = "levels";
  write(TRACK, track);
  await resume();
}
/** The puzzle of the way now chosen, as it was left (else a new one). */
async function resume() {
  const g = savedGame();
  if (g) { begin(g); if (!IN_FRAME && !isLevel(g)) refill(chosenKind()); return; }
  if (track === "levels") await levelBlock(camp.at); else await start("random");
}
async function setTrack(next) {
  if (next === track) return;
  clockPause();
  track = next;
  write(TRACK, track);
  await resume();
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
// Kept in lanterns:times by size and level (and twist), lowest first, not lanterns:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, lanterns:today). A level's record is its stars.
const bestOf = s => read(TIMES, {})[kindKey(kindOfRun(s))];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey(kindOfRun(S)), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}
/** The puzzle as the stars see it: its grid, the level it graded to and its twist. */
const forStars = () => ({ grid: S.grid, level: S.came || S.level, twist: S.twist });
/** Writes a solved level's stars (the best it has had); true if this solve improved on them. */
function recordLevel(sc) {
  const n = S.lv, stars = starsFor(forStars(), sc), fresh = stars > camp.stars[n];
  if (fresh) { camp.stars[n] = stars; write(CAMP, camp); }
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
    if (S.marks[at] === LIGHT && P.self[at]) note("That lantern would shine on itself: its beam comes back off the mirrors.", "bad");
    else if (S.marks[at] === LIGHT && br.clash.includes(at)) note("That lantern shines on another one: no two may see each other.", "bad");
    else if (S.marks[at] === LIGHT && P.nb[at].some(y => y >= 0 && br.over.includes(y))) note("A rock has more lanterns than it allows.", "bad");
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
  const rock = x.focus?.[0], rel = rock != null ? P.rel[rock] : 0, f = twistOf(S.twist);
  switch (x.tech) {
    case "shine": return f.mirrors ? "A lantern lights its whole line, bent by the mirrors, up to the rocks. Another lantern anywhere on it would shine on it: those cells have none."
      : f.hex ? "A lantern lights all six rays up to the rocks. Another lantern there would shine on it: those cells have none."
        : "A lantern lights its whole row and column up to the rocks. Another lantern there would shine on it: those cells have none.";
    case "full": return rel === 2 ? "This rock has all the lanterns its bound allows. The cells touching it can have no more." : "This rock has all its lanterns. The cells touching it can have no more.";
    case "need": return rel === 1 ? "This rock has only as many open cells touching it as its bound needs lanterns: they all get one."
      : "This rock has only as many open cells touching it as it needs lanterns: they all get one.";
    case "dark": return f.short ? "Only one cell within reach can still light this one, so that cell takes the lantern." : "Only one cell can still light this one, so that cell takes the lantern.";
    case "self": return "A lantern here would be lit by its own beam coming back off the mirrors: it has none.";
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
  if (isLevel(S)) S.fresh = recordLevel(S.done.score);
  else {
    S.fresh = recordBest(S.done.score);
    if (S.mode === "random") { const k = chosenKind(); if (k.size === S.size && k.level === S.level && twistIn(k) === twistIn(S)) ramp.won(!S.hints); }
  }
  if (S.mode === "daily") noteDayTime("lanterns", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("lanterns");
  wave();
  model?.spin();
}

// ---------- the flat board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
// The board is drawn to a viewBox in cell units, a neighbour one unit away: a square N×N is N wide, a hex board is drawn pointy-top
// (hexes 1 wide, 2/√3 tall). Cell x's middle is P.board.xy[x].
let svg = null, cellEls = [], lampEls = [], beamEl = null;
const HEXR = 1 / Math.sqrt(3);                                        // a hex's corner is this far from its middle
const hexPoints = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`; }).join(" ");
/** A mirror's slash across a cell's middle (cx, cy): "/" and "\" on the square board; "-", "/" and "\" along the three axes of a hex. */
function slashOf(ch, cx, cy, hex) {
  const a = ch === "-" ? 0 : ch === "/" ? (hex ? 60 : 45) : (hex ? 120 : 135), r = hex ? 0.36 : 0.34, dx = Math.cos((a * Math.PI) / 180) * r, dy = -Math.sin((a * Math.PI) / 180) * r;
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
}
/** A lighthouse in a cell (drawn to the cell's unit square, shown only on a cell with a lantern). */
function lighthouse(parent, c, r) {
  const g = svgEl("g", { class: "lan-lamp", transform: `translate(${c} ${r})`, display: "none" }, parent);
  svgEl("path", { d: "M.33 .34H.2M.67 .34H.8M.36 .2L.27 .12M.64 .2L.73 .12", class: "lan-ray" }, g);
  svgEl("polygon", { points: ".35,.88 .65,.88 .59,.42 .41,.42", class: "lan-tower" }, g);
  svgEl("polygon", { points: ".381,.72 .619,.72 .604,.6 .396,.6", class: "lan-band" }, g);
  svgEl("rect", { x: ".4", y: ".27", width: ".2", height: ".15", class: "lan-room" }, g);
  svgEl("polygon", { points: ".37,.27 .5,.11 .63,.27", class: "lan-cap" }, g);
  return g;
}
function drawBoard() {
  const B = P.board, hex = P.shape === "hex", pad = 0.2, xs = B.xy.map(p => p[0]), ys = B.xy.map(p => p[1]), ry = hex ? HEXR : 0.5;
  const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5, y0 = Math.min(...ys) - ry - (P.k ? 0.8 : 0), y1 = Math.max(...ys) + ry;
  const what = hex ? "hexagonal board" : "board";
  svg = svgEl("svg", { viewBox: `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`, role: "img", "aria-label": `${kindText(kindOfRun(S))}: the ${what}. Tap a cell to light a lantern on it, again to dot it as having none. Hold to dot a cell at once.`, class: "lan-svg" });
  svgEl("rect", { x: x0 - pad / 2, y: y0 - pad / 2, width: x1 - x0 + pad, height: y1 - y0 + pad, rx: 0.12, class: "lan-paper" }, svg);
  if (P.k) {                                                          // the reach of a short beam, on the board as well as in the rules
    const g = svgEl("g", { class: "lan-reach" }, svg), ty = y0 + 0.4;
    svgEl("path", { d: `M${x0 + 0.1} ${ty}H${x0 + 0.45}M${x0 + 0.5} ${ty - 0.18}L${x0 + 0.62} ${ty - 0.3}M${x0 + 0.5} ${ty + 0.18}L${x0 + 0.62} ${ty + 0.3}`, class: "lan-ray" }, g);
    svgEl("text", { x: x0 + 0.78, y: ty + 0.2, class: "lan-reach-t" }, g).textContent = `Reach ${P.k}`;
    svgEl("path", { d: `M${x0 + 3.3} ${ty}H${x0 + 3.3 + Math.min(P.k, 5) * 0.5}`, class: "lan-reach-bar" }, g);
  }
  lampEls = [];
  cellEls = Array.from({ length: P.cells }, (_, x) => {
    const [cx, cy] = B.xy[x], g = svgEl("g", { class: "lan-c" }, svg), rock = P.black[x] ? 1 : 0, r = hex ? HEXR : 0.5;
    const shape = rock ? (P.mir[x] ? "lan-rock lan-mir" : "lan-rock") : "lan-cell";
    if (hex) svgEl("polygon", { points: hexPoints(cx, cy, r), class: shape }, g); else svgEl("rect", { x: cx - 0.5, y: cy - 0.5, width: 1, height: 1, class: shape }, g);
    if (P.mir[x]) svgEl("line", { ...slashOf(B.mirrors[P.mir[x] - 1], cx, cy, hex), class: "lan-slash" }, g);
    else if (rock) {
      if (P.num[x] >= 0) {
        if (P.rel[x]) svgEl("circle", { cx, cy, r: 0.37, class: "lan-plate" }, g);              // a bound sits on a warm plate, as Bridges' do
        svgEl("text", { x: cx, y: cy + (P.rel[x] ? 0.15 : 0.2), class: P.rel[x] ? "lan-num lan-bound" : "lan-num" }, g).textContent = numberText(P, x);
      }
    } else svgEl("circle", { cx, cy, r: 0.09, class: "lan-dot" }, g);
    if (hex) svgEl("polygon", { points: hexPoints(cx, cy, r * 0.84), class: "lan-ring" }, g); else svgEl("rect", { x: cx - 0.43, y: cy - 0.43, width: 0.86, height: 0.86, class: "lan-ring" }, g);
    return { g, d: Math.round((cx + cy - 1) * 55) };
  });
  if (P.mir.some(m => m)) beamEl = svgEl("path", { class: "lan-beam" }, svg);       // mirrors: the beams are drawn, bent
  else beamEl = null;
  for (let x = 0; x < P.cells; x++) {
    const lamp = P.black[x] ? null : lighthouse(svg, P.board.xy[x][0] - 0.5, P.board.xy[x][1] - 0.5);
    lampEls.push(lamp);
  }
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
    const lamp = lampEls[x];
    if (lamp) {
      lamp.setAttribute("display", m === LIGHT ? "inline" : "none");
      const lc = clash.has(x) ? "lan-lamp clash" : "lan-lamp";
      if (lamp.getAttribute("class") !== lc) lamp.setAttribute("class", lc);
    }
  }
  if (beamEl) {                                                       // each lantern's beams as drawn lines, bending where they meet a mirror
    const d = [];
    for (let x = 0; x < P.cells; x++) {
      if (S.marks[x] !== LIGHT) continue;
      for (const { cells } of trace(P.board, P.black, P.mir, P.k, x, true).paths) {
        if (!cells.length) continue;
        d.push(`M${[x, ...cells].map(c => P.board.xy[c].map(v => v.toFixed(3)).join(" ")).join("L")}`);
      }
    }
    beamEl.setAttribute("d", d.join(""));
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
/** What the sea can't draw yet: set to nothing once it can. */
const modelBlocked = () => false;
/** The sea follows the run: a new puzzle is built into it, a change of marks raises and lowers lighthouses, a hint's cells glow. */
function feedModel() {
  if (!model || viewShown !== "model" || !S || !P) return;
  if (modelFor !== P) { model.set({ size: S.size, grid: S.grid, board: S.board, reach: S.reach }); modelFor = P; }
  model.update(S.marks, lastBreaks || breaks(P, S.marks), S.lit);
}
/** Flat (2D) or the sea (3D; `prefs.view` keeps "flat" and "model"). The sea's code (three.js) comes only when first wanted; where there is no WebGL the flat board stays. */
async function setView(v, remember = true) {
  if (v === "model" && modelBlocked()) { toast("3D doesn't draw this twist yet."); v = "flat"; }
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
  if (!p) return -1;
  if (P.shape !== "hex") {
    if (p.x < 0 || p.y < 0 || p.x >= P.N || p.y >= P.N) return -1;
    return Math.floor(p.y) * P.N + Math.floor(p.x);
  }
  let best = -1, d2 = 0.5 * 0.5 * 1.35;                              // inside the hex's own circle, near enough
  P.board.xy.forEach(([cx, cy], x) => { const d = (p.x - cx) ** 2 + (p.y - cy) ** 2; if (d < d2) { d2 = d; best = x; } });
  return best;
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
  put("kind", `${S.mode === "daily" ? "Today · " : isLevel(S) ? `Level ${S.lv + 1} · ` : ""}${kindText(kindOfRun(S))}`);
}
/** The rules, in a line: what the plain game says, changed by the twists on this board. */
function ruleLine() {
  const f = twistOf(S.twist), said = [f.hex && "Six rays.", S.reach && `Beams reach ${S.reach} cells.`, f.mirrors && "Mirrors turn a beam.", f.ranges && "2+ is at least, ≤1 at most."].filter(Boolean);
  return `${said.join(" ")} A number counts the lanterns touching its rock. Light every white cell, none shining on another.`.trim();
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (S.came && S.came !== S.level && !/[12]/.test(S.marks)) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!/[12]/.test(S.marks)) text = viewShown === "model" ? "Tap a shoal to raise a lighthouse, again to mark it with a buoy (no lantern), again to clear it. Hold to buoy it at once. Drag to turn, pinch or scroll to zoom."
    : S.reach || S.twist ? ruleLine() : "Tap a cell to light a lantern, again to dot it as having none (a note), again to clear it. Hold to dot a cell at once.";
  else text = ruleLine();
  if (l.textContent !== text) l.textContent = text;
  l.className = `lan-say${tone ? ` ${tone}` : ""}`;
}
function drawResult() {
  const done = !!S?.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const d = S.done, bits = [`${fmt(d.ms / 1000)} on the clock`], best = isLevel(S) ? null : bestOf(S);
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${penalty()} s)`);
  const stars = isLevel(S) ? starsFor(forStars(), d.score) : 0;
  const tail = isLevel(S) ? ` ${STAR.repeat(stars)}${HOLLOW.repeat(3 - stars)} Par ${fmt(parOf(forStars()))}.` : S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
  $("verdict").textContent = `Solved: ${fmt(d.score)}. ${bits.join(", ")}.${tail}`;
  $("nextBtn").textContent = isLevel(S) ? (S.lv + 1 < COUNT ? "Next level" : "Levels") : "Another puzzle";
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
    <h4>The twists</h4>
    <p><b>Ranges.</b> A rock's number may only be a bound: <b>2+</b> is at least two lanterns beside it, <b>≤1</b> at most one. Bounds sit on a warm plate, as Bridges' do.</p>
    <p><b>Short beams.</b> A lantern lights only so many cells each way: the reach is written on the board (<b>Reach 3</b>), and a rock still stops a beam short of it. Cells far from every rock can be lit now only by a lantern near them.</p>
    <p><b>Mirrors.</b> A rock with a slash is a mirror. It has no number, and it is not white, but it doesn't stop a beam: the beam <b>turns</b> there, a quarter turn, and carries on. Lines of light are no longer straight, so a lantern can light a cell round a corner. A lantern may not be lit by another lantern's reflected light, nor by its own beam coming back to it: such a cell can never hold a lantern.</p>
    <p><b>Hex.</b> On the hexagonal board a lantern shines along its <b>six rays</b>, three lines through the cell, and a rock may have up to six lanterns beside it. A mirror lies along one of the three axes (a dash, or one of the two slashes) and reflects the beam across it: a beam running along its own axis slides straight through. Hex boards have no Expert at 7 across.</p>
    <h4>Playing</h4>
    <p>Tap a cell to light a lantern on it, again to dot it (a note that it has none), again to clear it; hold a cell, or right-click it, to dot it at once. Only the lanterns count: the puzzle is solved the moment exactly its answer is lit. Undo and Redo step through your marks, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: two lanterns shining on each other, a rock with too many, a rock that can't get its number any more, a cell that nothing can light now (outlined in red), all in oxblood. That comes from the rules, never the answer. A number turns green once its rock has all its lanterns. Hint (+${HINT}&nbsp;s) puts a wrong mark right first; otherwise it makes the next step a person would take and says why, the cells it settled ringed in gilt.</p>
    <h4>The sea</h4>
    <p>The same puzzle, played in 3D: the white cells are shoals, the rocks stand out of the water with their numbers, and a lantern is a lighthouse whose beams sweep out along its rays. 3D is the 3D button under the board or the menu's Play in 3D; the puzzle, the clock and your marks are the same in both. Drag to turn the board, pinch or scroll to zoom, double-tap the water to put it back.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how many numbers it shows. <b>Easy</b>: the plain rules (a lantern's line has no other; a rock with all its lanterns is closed; a rock that needs every cell round it gets them; a cell with one place to be lit from gets a lantern there). <b>Medium</b>: looking ahead one step too (a lantern that would at once leave a cell dark, or a rock short, isn't there). <b>Hard</b>: a short supposition, a lantern put in or taken out and followed for a couple of steps until a rule breaks. <b>Expert</b>: a supposition followed to the end, with as few numbers as will do. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <p>The menu's <b>Levels</b> are a ladder in chapters, one new twist each, ending in a gauntlet that mixes them. Solving a level opens the next; any open level can be played again at any time, and is kept as you left it. The first time a level is the same puzzle for everyone; after that it is a new one. Stars are for the score: one for solving it, two for a score within twice the par, three within the par. <b>Free play</b> chooses the board and any twists; the size and level climb as you solve.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each board, twist, size and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A 10×10 at Medium, the plain game, the same for everyone. Its first solve counts the moment the last cell is lit, and is Lanterns' figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// ---------- the ladder of levels, in the menu ----------
/** A level's board in miniature, drawn from the level's own seed: the shape of the board and a mark of each twist, not the puzzle. */
function miniature(L, seed) {
  const f = twistOf(L.twist), hex = f.hex, B = boardOf(hex ? "hex" : "square", 7);
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const xs = B.xy.map(p => p[0]), ys = B.xy.map(p => p[1]), x0 = Math.min(...xs) - 0.5, y0 = Math.min(...ys) - (hex ? HEXR : 0.5), w = Math.max(...xs) + 0.5 - x0, h = Math.max(...ys) + (hex ? HEXR : 0.5) - y0;
  const side = Math.max(w, h), ox = x0 - (side - w) / 2, oy = y0 - (side - h) / 2;
  let out = "";
  const lamps = [];
  B.xy.forEach(([cx, cy], i) => {
    const roll = rnd(), rock = roll < 0.2, mirror = f.mirrors && !rock && roll > 0.9, shape = hex ? `<polygon points="${hexPoints(cx, cy, HEXR * 0.94)}"` : `<rect x="${cx - 0.47}" y="${cy - 0.47}" width="0.94" height="0.94"`;
    out += `${shape} class="${rock || mirror ? "r" : "w"}"/>`;
    if (mirror) { const s = slashOf(B.mirrors[Math.floor(rnd() * B.mirrors.length)], cx, cy, hex); out += `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" class="m"/>`; }
    else if (rock && f.ranges && rnd() < 0.4) out += `<circle cx="${cx}" cy="${cy}" r="0.27" class="b"/>`;
    else if (!rock && lamps.length < 3 && rnd() < 0.08) lamps.push([cx, cy]);
  });
  for (const [cx, cy] of lamps) {
    out += `<circle cx="${cx}" cy="${cy}" r="0.24" class="l"/>`;
    if (f.short) out += `<path d="M${cx - 0.9} ${cy}H${cx + 0.9}M${cx} ${cy - 0.9}V${cy + 0.9}" class="s"/>`;
  }
  return `<svg viewBox="${ox} ${oy} ${side} ${side}" aria-hidden="true">${out}</svg>`;
}
/** The levels, three to a row under their chapter: each its board in miniature, its number and name and the stars won. Those not open yet are dimmed. */
function levelList() {
  const all = document.createElement("div");
  all.className = "lan-levels";
  CHAPTERS.forEach((ch, c) => {
    const head = document.createElement("h3"), grid = document.createElement("div"), to = CHAPTERS[c + 1]?.from ?? COUNT;
    head.className = "lan-chap";
    head.textContent = ch.name;
    grid.className = "lan-lgrid";
    for (let n = ch.from; n < to; n++) {
      const L = LADDER[n], won = camp.stars[n], b = document.createElement("button"), map = document.createElement("div"), row = document.createElement("div"),
        num = document.createElement("b"), stars = document.createElement("span"), name = document.createElement("div"), size = document.createElement("div");
      b.type = "button";
      b.disabled = !isOpen(n);
      b.className = won ? "done" : "";
      if (n === camp.at && track === "levels") b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Level ${n + 1}, ${L.name}${won ? `, ${plural(won, "star")}` : ""}${b.disabled ? ", not open yet" : ""}`);
      map.className = "lan-lmap";
      map.innerHTML = miniature(L, seedOf(n));
      row.className = "lan-lrow";
      num.textContent = n + 1;
      stars.textContent = isOpen(n) ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : "";
      row.append(num, stars);
      name.className = "lan-lname";
      name.textContent = L.name;
      size.className = "lan-lsize";
      size.textContent = kindText(L);
      b.append(map, row, name, size);
      b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
      grid.append(b);
    }
    const about = document.createElement("p");
    about.className = "lan-chap-about";
    about.textContent = ch.about;
    all.append(head, about, grid);
  });
  return all;
}

// the menu: Play (a new puzzle, clearing the board, 3D, the rules), Content (Levels, or Free play: the board and twists), About
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const levels = track === "levels", content = part(body, "content");
  const play = part(body, "play");
  play.append(action("New puzzle", () => (levels ? confirmLevelBlock() : confirmStart("random")), "primary"));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action(viewShown === "model" ? "Play in 2D" : "Play in 3D", () => setView(viewShown === "model" ? "flat" : "model"), "link"), action("The rules", showRules, "link"));
  content.append(choice("Play", [["levels", "Levels"], ["free", "Free play"]], track, v => { setTrack(v); openMenu(); }));
  if (levels) content.append(levelList());
  else {
    content.append(choice("Board", [["square", "Square"], ["hex", "Hex"]], prefs.board, v => { prefs.board = v; savePrefs(); confirmStart("random"); }));
    content.append(ticks("Twists", [["ranges", "Ranges"], ["short", "Short beams"], ["mirrors", "Mirrors"]], prefs.twists, v => { prefs.twists = v; savePrefs(); }));
  }
  todayPart(body, { app: "lanterns", play: () => start("daily"), playing: S?.mode === "daily" && S.seed === today(), busy: started() });
  const about = part(body, "about");
  if (levels) {
    const solved = camp.stars.filter(Boolean).length;
    about.append(line(`${solved} of ${COUNT} levels solved, ${plural(camp.stars.reduce((a, b) => a + b, 0), "star")}. Three stars within the par, two within twice it.`));
  } else {
    const best = S && !isLevel(S) ? bestOf(S) : null;
    about.append(line(S && !isLevel(S) ? `${kindText(kindOfRun(S))}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Light every white cell."));
  }
  about.append(action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** Another puzzle of the level being played. */
async function confirmLevelBlock() {
  if (started() && !(await sure("Start a new puzzle of this level? This one isn't solved.", { yes: "New puzzle" }))) return false;
  levelBlock(camp.at, true);
  return true;
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

// ---------- links: #s=SEED&n=10&l=medium (#d= for a day's; &t=mirrors+hex only with a twist), #lv=LEVEL&s=SEED for a level's ----------
const hashOf = s => (isLevel(s) ? `#lv=${s.lv}&s=${s.seed}` : `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}${s.twist ? `&t=${s.twist}` : ""}`);
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  if (h.has("lv")) {                                                 // a level's: only if it is open
    const lv = Number(h.get("lv"));
    return Number.isInteger(lv) && lv >= 0 && lv < COUNT && isOpen(lv) ? { seed, mode: "level", lv, k: kindOf(lv) } : null;
  }
  const twist = h.get("d") ? "none" : twistKey(h.get("t") || "none"), sizes = twistOf(twist).hex ? HEX_SIZES : SIZES, n = Number(h.get("n"));
  const size = sizes.includes(n) ? n : sizes.includes(10) ? 10 : 9;
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium"), twist } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle, l.mode === "level" ? { lv: l.lv } : {}));
}
const sameBlock = (a, l) => !!a && a.seed === l.seed && a.mode === l.mode && (l.mode === "level" ? a.lv === l.lv : a.size === l.k.size && (a.twist || "none") === l.k.twist);

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "lanterns");
document.querySelector(".lan-mark").innerHTML = APPS.find(a => a.id === "lanterns")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => {
  if (isLevel(S) && S.done) { if (S.lv + 1 < COUNT) playLevel(S.lv + 1); else openMenu(); } else start("random");
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
$("viewBtn").addEventListener("click", () => setView(viewShown === "model" ? "flat" : "model"));
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else clockRun(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const l = linked(); if (l && !sameBlock(S, l)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__lanterns = {
  get state() { return S; }, get puzzle() { return P; }, get model() { return model; }, get camp() { return camp; }, get track() { return track; }, press, useHint, undo, redo, start, setView, playLevel, setTrack, openMenu,
  /** Where a cell's middle is on the screen, for tests that tap or hold it as a finger would. */
  cellOf: x => { const m = svg.getScreenCTM(), [cx, cy] = P.board.xy[x]; return { x: cx * m.a + m.e, y: cy * m.d + m.f }; },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
async function solo() {
  S = null;
  const kept = savedGame(), l = linked();
  if (l && !sameBlock(kept, l)) { openLinked(l); return; }
  if (forToday && !IN_FRAME) {                                       // today's is a free puzzle: the one in hand, if it is today's, else a new one after asking about the one begun
    const free = read(RUN, null), mine = valid(free) && !isLevel(free) ? free : null;
    if (mine?.mode === "daily" && mine.seed === today()) { begin(mine); refill(chosenKind()); return; }
    if (!startedRun(mine) || (await sure("Today's puzzle is waiting. Leave the one you've started?", { yes: "Today's puzzle", no: "Keep mine" }))) { start("daily"); return; }
  }
  if (IN_FRAME) { if (kept) begin(kept); else render(); return; }
  await resume();
}
if (viewShown === "model") setView("model", false);
onDefaultChange(is3D => { if (!prefs.view && S) setView(is3D ? "model" : "flat", false); });   // Settings' 2D mode, live
solo();
