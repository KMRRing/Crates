// Portolan: draw one loop along the edges of a grid of dots; each number says how many of its cell's four sides the
// loop uses, and the loop never crosses or touches itself; a shaded puzzle also marks some cells as inside the loop
// (tinted) or outside it (dotted). The rules, the puzzles and the reasoning are
// slitherlink-engine.js's (every puzzle has one answer, and is graded by the hardest step a person needs); the puzzles
// are made in slitherlink-worker.js. This file keeps the run, the clock and the taps, and draws the board.
import { SIZES, HEX_SIZES, SHAPES, TWIST_NAMES, LEVELS, DAILY, NONE, LINE, CROSS, INSIDE, OUTSIDE, puzzleOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn, startMarks, fitsBoard, twistOn, labelOf } from "./slitherlink-engine.js";
import { LEVELS as LADDER, CHAPTERS, COUNT, chapterOf, seedOf, kindOf, parOf, starsFor } from "./slitherlink-levels.js";
import { scale } from "./wide.js";
import { wants3D, onDefaultChange } from "./mode3d.js";
import { sound } from "./slitherlink-sound.js";
import { edgeAtPoint } from "./slitherlink-3d-geo.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, toggle, onPause, isPaused, todayPart } from "./menu.js";
import { ramp } from "./ramp.js";
import { rungs, startFor, split } from "./ramp-steps.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";
import { sure } from "./sure.js";
import { cellEdit, tallyEdit, onceEdit } from "./board-share.js";
import slkCoop from "./slitherlink-coop.js";

const $ = id => document.getElementById(id);
const RUN = "slitherlink:run", TIMES = "slitherlink:times", PREFS = "slitherlink:prefs", SPARES = "slitherlink:spares", SOUND = "slitherlink:sound";
const CAMP = "slitherlink:camp", LRUNS = "slitherlink:lruns", FREE = "slitherlink:free";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to cross an edge instead of cycling it

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const shadeOn = t => t === "shade";
const hexOn = b => b === "hex";
/** A run's or a kind's twist as the engine names it: "shade" (only an old link or a run in progress), or none, ranges, tunnels, ranges+tunnels. */
const twistFor = (t, board = "square") => (shadeOn(t) ? "shade" : twistOn(t, board));
const hasTwist = t => twistFor(t) !== "none" && !shadeOn(t);
const boardText = k => (hexOn(k.board) ? `Hex ${k.size}` : `${k.size}×${k.size}`);
const kindText = k => `${boardText(k)} · ${LEVELS[k.level]}${shadeOn(k.twist) ? " · Shaded" : hasTwist(k.twist) ? ` · ${TWIST_NAMES[twistFor(k.twist, k.board)]}` : ""}`;
const kindKey = k => `${hexOn(k.board) ? "hex" : ""}${k.size}:${k.level}${shadeOn(k.twist) ? ":shade" : hasTwist(k.twist) ? `:${twistFor(k.twist, k.board)}` : ""}`;
/** What the engine needs to build a run's board besides its size and grid. */
const specOf = s => ({ shape: s.board === "hex" ? "hex" : "square", tun: s.tun || "" });
/** Whether a run is a level of the ladder. */
const isLevel = s => !!s && Number.isInteger(s.lv);

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
// prefs.view is the player's own choice ("3d" or "flat"), kept only when they make one; with none the suite's default applies (mode3d.js).
if (prefs.view !== "3d" && prefs.view !== "flat") delete prefs.view;
let viewShown = wants3D(prefs.view, "3d") ? "3d" : "flat";
sound.on = read(SOUND, true);
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
// Korbi, 4 November 2026: the menu is the minimum it needs to be. Size and level are one hidden ramp, its first rung the old
// saved choice; the ladder steps up after a puzzle solved without a hint.
const RUNGS = rungs(SIZES, Object.keys(LEVELS));
const OLD = { size: prefs.size, level: prefs.level };
// 5 November 2026 (Korbi): the menu's Free play chooses a board (Square or Hex) and a twist; the honeycomb has a ramp of its own
// (`slitherlink:ramp:hex`), the square board's is still `slitherlink:ramp`.
prefs.board = hexOn(prefs.board) ? "hex" : "square";
prefs.mix = twistOn(prefs.mix, prefs.board);
const HEX_RUNGS = rungs(HEX_SIZES, Object.keys(LEVELS));
const chosenKind = (board = prefs.board) => {
  const twist = twistOn(prefs.mix, board);
  if (hexOn(board)) { const { size, level } = split(ramp("slitherlink", HEX_RUNGS, { id: "hex" })); return { board, size: Number(size), level, twist }; }
  const { size, level } = split(ramp("slitherlink", RUNGS, { start: startFor(RUNGS, SIZES, Object.keys(LEVELS), OLD.size, OLD.level) }));
  return { board, size: Number(size), level: levelOn(Number(size), level), twist };
};
const DAILY_KIND = { ...DAILY, board: "square", twist: "none" };

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Cull's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
const gen = (seed, k) => generate(seed, k.size, k.level, shadeOn(k.twist), { shape: k.board, twist: k.twist });
function make(seed, k) {
  if (workerless) return Promise.resolve(gen(seed, k));
  try {
    worker ||= new Worker(new URL("./slitherlink-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(gen(w.seed, w.k));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(gen(seed, k)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, level: k.level, shade: shadeOn(k.twist), shape: k.board, twist: k.twist }); });
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
const valid = s => !!s && s.v === 1 && fitsBoard(s) && typeof s.marks === "string" && typeof s.sol === "string" && s.sol.length === s.marks.length && Number.isFinite(s.ms);

// The puzzle in hand is always `slitherlink:run` (a partner joining reads that key); a level of the ladder is also kept as it was
// left in `slitherlink:lruns`, and the free puzzle put aside while a level is played in `slitherlink:free`.
function save() {
  if (IN_FRAME || !S) return;
  if (COOP) {       // the host's own run follows the shared board (it is theirs again when the co-op ends); the guest's is left alone
    if (coopHost) write(RUN, { ...S, undo: [], redo: [], lit: null, ms: Math.round(teamMs()) });
    return;
  }
  write(RUN, S);
  if (isLevel(S)) write(LRUNS, { ...read(LRUNS, {}), [S.lv]: S });
  savedAt = performance.now();
}
/** Whether a run has been played on: a mark of the player's (a causeway's lines are the puzzle's) or a hint taken. */
const startedRun = (r, p = P) => !!r && !r.done && (r.hints > 0 || Array.from(r.marks).some((m, e) => m !== NONE && !p?.locked?.[e]));
const started = () => startedRun(S);

// ---------- the levels ----------
/** The campaign as kept: the level in hand and the stars won in each, mended if it is not what it should be. */
function readCamp() {
  const c = read(CAMP, null), stars = LADDER.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const open = stars.findIndex(x => x < 1);                          // the first level not solved is the last one open
  return { v: 1, at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, open < 0 ? COUNT - 1 : open)) : 0, stars };
}
const camp = readCamp();
/** Whether level n (0 on) is open: the first, and any whose one before is solved. */
const isOpen = n => n === 0 || camp.stars[n - 1] >= 1;
/** What a level says when it is first met: its chapter's idea if it is the chapter's first, else nothing. */
function introOf(n) {
  const ch = CHAPTERS[chapterOf(n)];
  return n === ch.from ? { text: `${ch.name}. ${ch.about}`, tone: "" } : null;
}

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleOf(S.size, S.grid, S.sol, specOf(S));
  message = isLevel(S) && !started() && !S.done ? introOf(S.lv) : null; clockFrom = null;
  if (isLevel(S)) { camp.at = S.lv; if (!IN_FRAME) write(CAMP, camp); }
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
    try { puzzle = await make(today(), DAILY_KIND); } finally { done(); }
    if (puzzle) begin(fromPuzzle("daily", today(), DAILY_KIND, puzzle));
    return;
  }
  holdFree();
  const { seed, puzzle } = await nextPuzzle(k);
  if (puzzle) begin(fromPuzzle("random", seed, k, puzzle));
}
/** A run from a made puzzle: the board and twist it came as, and the lines a causeway starts with. */
function fromPuzzle(mode, seed, k, puzzle, extra = {}) {
  const board = puzzle.shape === "hex" ? "hex" : "square", tun = puzzle.tun || "", twist = puzzle.shade ? "shade" : twistOn(puzzle.twist, board);
  const marks = startMarks(puzzleOf(k.size, puzzle.grid, puzzle.sol, { shape: board, tun }));
  return { mode, seed, board, size: k.size, level: k.level, twist, tun, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks, ...extra };
}
/** A puzzle of level n (0 on): the level's own the first time it is played, a new one after that or when asked. */
async function levelBlock(n, again = false) {
  if (IN_FRAME) return;
  holdFree();
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
  const kept = read(LRUNS, {})[n];
  if (valid(kept) && isLevel(kept) && kept.lv === n && !kept.done) { holdFree(); begin(kept); refill(kindOf(n)); } else await levelBlock(n);
}
/** The free puzzle in hand is kept aside while a level is played. */
function holdFree() {
  if (IN_FRAME || !S || isLevel(S) || S.done || !started()) return;
  write(FREE, S);
}
/** Free play: the puzzle put aside, or a new one. */
async function playFree() {
  clockPause();
  const kept = read(FREE, null);
  if (valid(kept) && !isLevel(kept) && !kept.done) { write(FREE, null); begin(kept); return; }
  await start("random");
}
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
onPause(() => { paused = true; clockPause(); cancelPress(); model?.hold(true); }, () => { paused = false; clockRun(); model?.hold(false); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : COOP ? teamMs() : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in slitherlink:times by size, level and shading, lowest first, not slitherlink:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, slitherlink:today).
const kindOfRun = s => ({ board: s.board, size: s.size, level: s.came || s.level, twist: s.twist });
const bestOf = s => read(TIMES, {})[kindKey(kindOfRun(s))];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey(kindOfRun(S)), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}
/** Writes a solved level's stars (the best it has had); true if this solve improved on them. */
function recordLevel(sc) {
  const n = S.lv, stars = starsFor(P.g.cells, S.came || S.level, S.twist, sc), fresh = stars > camp.stars[n];
  if (fresh) { camp.stars[n] = stars; write(CAMP, camp); }
  return fresh;
}

// ---------- marks ----------
/** A tap cycles the edge (clear, line, crossed); a hold crosses it, or clears it if crossed. */
function press(e, how) {
  if (!S || S.done || IN_FRAME || paused || e < 0) return;
  if (P.locked?.[e]) { note("A causeway is where the loop crosses itself: its four lines are fixed."); render(); return; }
  const from = S.marks[e], to = how === "hold" ? (from === CROSS ? NONE : CROSS) : nextMark(from);
  setEdge(e, from, to);
  if (to === LINE) navigator.vibrate?.(8);
  if (modelOn()) sound.play(to === LINE ? "quill" : "cross");
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
    case "most": return `This bound has reached its most: the ${many ? "other sides are" : "other side is"} crossed.`;
    case "least": return `This bound needs every side it has left to reach its least: ${many ? "they are lines" : "it is a line"}.`;
    case "tunnel": return "A causeway's four lines are fixed: the loop crosses itself here, straight on both ways.";
    case "loop": return P.tun?.length ? "A line here would join the two ends of one path and close a loop before the rest is drawn (a causeway lets the loop cross itself, but only straight on): it is crossed."
      : "A line here would join the two ends of one path and close a loop before the rest is drawn: it is crossed.";
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
  S.fresh = isLevel(S) ? recordLevel(S.done.score) : recordBest(S.done.score);
  if (modelOn()) sound.play("bell", 0.5);
  if (S.mode === "random") { const k = chosenKind(S.board); if (k.size === S.size && k.level === S.level && twistFor(k.twist, k.board) === twistFor(S.twist, S.board)) ramp.won(!S.hints); }
  if (S.mode === "daily") noteDayTime("slitherlink", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("slitherlink");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
/** The numbers are set a hundred times larger and scaled back down, centred by an explicit offset: Safari lays out text
 *  under a unit tall badly (as Cull's and Delta's are). */
const TEXT_SCALE = 100;
let svg = null, edgeEls = [], cellEls = [], dotEls = [];
/** A cell's clue as printed ("3", "2+", "≤1"), or "" for none. */
const clueText = k => (P.twisted ? labelOf(P.clue[k]) : P.clue[k] >= 0 && P.clue[k] <= 4 ? String(P.clue[k]) : "");
const shrink = (poly, [cx, cy], f) => poly.map(([x, y]) => `${(cx + (x - cx) * f).toFixed(3)},${(cy + (y - cy) * f).toFixed(3)}`).join(" ");
function drawBoard() {
  const v = P.view, hex = v.shape === "hex", [bx0, by0, bx1, by1] = v.box, pad = 0.4, w = bx1 - bx0, h = by1 - by0;
  svg = svgEl("svg", { viewBox: `${bx0 - pad} ${by0 - pad} ${w + 2 * pad} ${h + 2 * pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap an edge to draw it, again to cross it.`, class: `slk-svg${P.shaded ? " shaded" : ""}${hex ? " hex" : ""}` });
  svgEl("rect", { x: bx0 - pad / 2, y: by0 - pad / 2, width: w + pad, height: h + pad, rx: 0.12, class: "slk-paper" }, svg);
  cellEls = Array.from({ length: v.cells }, (_, k) => {
    const [x, y] = v.cpos[k], g = svgEl("g", { class: "slk-cell" }, svg);
    if (hex) svgEl("polygon", { points: shrink(v.cpoly[k], [x, y], 0.8), class: "slk-ring" }, g);
    else svgEl("rect", { x: x - 0.4, y: y - 0.4, width: 0.8, height: 0.8, rx: 0.1, class: "slk-ring" }, g);
    const n = P.clue[k];
    if (P.shaded && n === INSIDE) svgEl("rect", { x: x - 0.4, y: y - 0.4, width: 0.8, height: 0.8, rx: 0.1, class: "slk-in-mark" }, g);       // inside the loop: the cell tinted
    if (P.shaded && n === OUTSIDE) svgEl("circle", { cx: x, cy: y, r: 0.13, class: "slk-out-mark" }, g);                                         // outside it: a dot
    const text = clueText(k);
    if (!text) return { g };
    const bound = text.length > 1;                                    // "2+" and "≤1": a bound, on a warm plate (Bridges' look for a range)
    if (bound) svgEl("rect", { x: x - 0.37, y: y - 0.27, width: 0.74, height: 0.54, rx: 0.12, class: "slk-bound" }, g);
    const t = svgEl("text", { x: 0, y: 0, dy: "0.36em", class: `slk-num${bound ? " bound" : ""}`, "font-size": (bound ? 0.46 : hex ? 0.62 : 0.56) * TEXT_SCALE, transform: `translate(${x} ${y}) scale(${1 / TEXT_SCALE})` }, g);
    t.textContent = text;
    return { g };
  });
  edgeEls = Array.from({ length: v.E }, (_, e) => {
    const [x1, y1, x2, y2] = v.epos[e], mx = (x1 + x2) / 2, my = (y1 + y2) / 2, g = svgEl("g", { class: "slk-e" }, svg);
    svgEl("line", { x1, y1, x2, y2, class: "slk-guide" }, g);
    svgEl("line", { x1, y1, x2, y2, class: "slk-seg" }, g);
    svgEl("path", { d: `M${mx - 0.1} ${my - 0.1}L${mx + 0.1} ${my + 0.1}M${mx - 0.1} ${my + 0.1}L${mx + 0.1} ${my - 0.1}`, class: "slk-x" }, g);
    return { g, d: Math.round((mx + my) * 40) };
  });
  const tuns = new Set(v.tun);
  dotEls = v.dots.map(([cx, cy], x) => svgEl("circle", { cx, cy, r: 0.07, class: tuns.has(x) ? "slk-dot tun" : "slk-dot" }, svg));
  for (const t of v.tun) {                                           // a causeway: the loop's across-strand is a deck laid over the up-down one, which runs under it
    const [x, y] = v.dots[t], d = svgEl("g", { class: "slk-causeway" }, svg);
    svgEl("rect", { x: x - 0.3, y: y - 0.15, width: 0.6, height: 0.3, rx: 0.05, class: "slk-pad" }, d);
    svgEl("line", { x1: x - 0.3, y1: y, x2: x + 0.3, y2: y, class: "slk-deck" }, d);
    svgEl("path", { d: `M${x - 0.15} ${y - 0.15}V${y + 0.15}M${x + 0.15} ${y - 0.15}V${y + 0.15}`, class: "slk-rail" }, d);
  }
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
  showView();
  feedModel(true);
}
/** Each edge's look from the run: line, crossed, lit by a hint, part of a wrong loop; each number's: met, over, a hint's. */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), over = new Set([...br.over, ...br.shade]), met = new Set(br.met), wrong = new Set(br.loop), bad = new Set(br.bad.map(x => P.view.dotOf[x]));
  const lit = new Set(S.lit?.set || []);
  for (let e = 0; e < edgeEls.length; e++) {
    const m = S.marks[e], cls = ["slk-e", m === LINE ? "ln" : m === CROSS ? "cr" : "", lit.has(e) ? "lit" : "", wrong.has(e) ? "wrong" : ""].filter(Boolean).join(" ");
    if (edgeEls[e].g.getAttribute("class") !== cls) edgeEls[e].g.setAttribute("class", cls);
  }
  cellEls.forEach(({ g }, k) => {
    const cls = ["slk-cell", over.has(k) ? "over" : met.has(k) ? "met" : "", S.lit?.cell === k || S.lit?.cell2 === k ? "why" : ""].filter(Boolean).join(" ");
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
  const litDot = S.lit?.vertex != null ? P.view.dotOf[S.lit.vertex] : -1, tuns = new Set(P.view.tun);
  dotEls.forEach((d, x) => d.setAttribute("class", `slk-dot${tuns.has(x) ? " tun" : ""}${bad.has(x) ? " bad" : litDot === x ? " lit" : ""}`));
  feedModel(false, { over, met, wrong, bad, lit });
}

// ---------- 3D: the same board as a cartographer's chart (slitherlink-3d.js, loaded when first asked for) ----------
let model = null, modelFor = null, modelShown = false;
/** Whether the chart is what shows now: asked for, drawable, and a board it draws. */
const modelOn = () => viewShown === "3d" && !!model && !!P && !P.twisted;
/** The chart follows the run: a new puzzle is built into it, every change of the marks, the rules broken, a hint's edges or a solve is shown. */
function feedModel(fresh, sets) {
  if (!modelOn() || !S) return;
  if (fresh || modelFor !== P) { model.set({ g: P.g, clue: P.clue }); modelFor = P; sets = null; }
  if (!sets) { const br = breaks(P, S.marks); sets = { over: new Set([...br.over, ...br.shade]), met: new Set(br.met), wrong: new Set(br.loop), bad: new Set(br.bad), lit: new Set(S.lit?.set || []) }; }
  model.update({ marks: S.marks, over: sets.over, met: sets.met, wrong: sets.wrong, bad: sets.bad, lit: sets.lit, why: [S.lit?.cell ?? -1, S.lit?.cell2 ?? -1], vertex: S.lit?.vertex ?? -1, solved: !!S.done });
}
/** Flat or 3D (`prefs.view` keeps the choice only once made). The chart's code (three.js) comes only when first wanted; where there is no WebGL the flat board stays. */
async function setView(v, remember = true) {
  if (v === "3d" && !model) {
    try {
      model = (await import("./slitherlink-3d.js")).createChart($("model"));
      model.canvas.addEventListener("pointerdown", down);
      model.canvas.addEventListener("contextmenu", e => e.preventDefault());
    } catch (err) { console.warn("Portolan: no 3D here.", err); toast("This browser can't draw 3D."); v = "flat"; }
  }
  viewShown = v;
  if (remember) { prefs.view = v; savePrefs(); }
  showView();
}
/** The card shows the chart or the flat board, whichever the player wants and this puzzle's board allows. */
function showView() {
  const on = modelOn();
  if (on === modelShown && model) return;
  modelShown = on;
  $("board").closest(".slk-card").classList.toggle("is-model", on);
  $("model").hidden = !on;
  model?.show(on);
  if (on) { modelFor = null; paint(); }
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
  let p = null;
  if (modelOn()) p = model.point(ev.clientX, ev.clientY);       // the chart reads the board's own coordinates off the vellum
  else { const m = svg?.getScreenCTM(); if (m) p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()); }
  return p && P ? edgeAtPoint(P.view, p.x, p.y) : -1;
}
function down(ev) {
  if (ev.button > 0) { if (ev.button === 2) press(edgeAt(ev), "hold"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  ev.preventDefault();
  cancelPress();
  const edge = edgeAt(ev);
  if (edge < 0) return;
  sound.unlock();
  try { (modelOn() ? model.canvas : svg).setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
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
  put("kind", isLevel(S) ? `${LADDER[S.lv].name} · par ${fmt(parOf(P.g.cells, S.came || S.level, S.twist))}` : `${S.mode === "daily" ? "Today · " : ""}${kindText(kindOfRun(S))}`);
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (S.came && S.came !== S.level && !started()) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!started()) text = `Tap an edge to draw it, again to cross it (not part of the loop), again to clear it. Hold an edge to cross it.${shadeOn(S.twist) ? " A tinted cell is inside the loop, a dotted one outside." : P.tun?.length ? " At a causeway the loop crosses itself, straight on both ways." : P.twisted && P.clue.some(n => n >= 10) ? " 2+ is at least two sides, ≤1 at most one." : ""}`;
  else text = shadeOn(S.twist) ? "One loop, through no corner twice, every number met, shaded cells inside it and dotted ones outside."
    : `One loop, through no ${hexOn(S.board) ? "corner" : "dot"} twice${P.tun?.length ? " (but crossing itself straight on at each causeway)" : ""}, with every number${P.twisted && P.clue.some(n => n >= 10) ? " and bound" : ""} met.`;
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
  if (isLevel(S)) {
    const n = S.lv, won = camp.stars[n];
    $("verdict").textContent = `Solved: ${fmt(d.score)}. ${bits.join(", ")}. ${plural(won, "star")}${S.fresh ? " (new)" : ""}: three within ${fmt(parOf(P.g.cells, S.came || S.level, S.twist))}.`;
    $("nextBtn").textContent = n + 1 < COUNT ? "Next level" : "Another puzzle";
    return;
  }
  $("nextBtn").textContent = "Another puzzle";
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
    <p>A puzzle shared as a link may come with shading: it marks some cells as being on one side of the loop: a <b>tinted</b> cell is inside the loop, a <b>dotted</b> one outside it (a cell with one of these has no number). The loop is the line between inside and outside, so a line runs between a tinted cell and a dotted one, never between two tinted or two dotted; and the sides carry on through the lines you have drawn and crossed, so a tinted cell with a crossed edge to its neighbour makes that neighbour tinted too. A cell that clashes with what you have drawn turns oxblood. The outside of the board counts as outside.</p>
    <h4>Twists</h4>
    <p><b>Bounds.</b> A number may be only a bound: <b>2+</b> is at least two sides of its cell, <b>≤1</b> at most one. Everything else holds, and the puzzle still has one answer.</p>
    <p><b>Causeways.</b> A square board may have causeway dots, drawn as a deck over a road: there the loop crosses itself, straight on both ways, so all four of the dot's lines are drawn from the start and cannot be changed. Every other dot still has two lines or none.</p>
    <p><b>Honeycomb.</b> Hexagons, each showing 0 to 6 sides; the loop runs along their edges and every corner has two lines or none. A honeycomb corner has only three edges, so a loop cannot cross itself there: the honeycomb has no causeways.</p>
    <h4>Levels</h4>
    <p>The menu's Levels are a ladder of puzzles in chapters, one new twist each, then the gauntlet where they meet. Solving a level opens the next; any open level can be played again at any time, and is kept as you left it. The first time a level is the same puzzle for everyone; after that it is a new one. Stars are for the score: one for solving it, two within twice the par, three within the par.</p>
    <p>A puzzle's level is the hardest step it needs, never how many numbers it shows. <b>Easy</b>: the numbers and the corners alone (a number with all its lines crosses its other sides; a corner with two lines is done; a line with one way on takes it; a line may not close the loop early). <b>Medium</b>: a short trial as well, an edge supposed one way and followed for a couple of rounds until a rule breaks. <b>Hard</b>: a trial followed as far as it goes, with few numbers to help. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size, level and kind of clue. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A plain 7×7 at Medium, the same for everyone. Its first solve counts the moment the loop is drawn, and is Portolan's figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// the menu: Play (a new puzzle, clearing the board, the rules), Content (Levels, or Free play with a board and a twist), About
const STAR = "★", HOLLOW = "☆";
const levelNote = k => `${boardText(k)} · ${LEVELS[k.level]}${hasTwist(k.twist) ? ` · ${TWIST_NAMES[twistFor(k.twist, k.board)]}` : ""}`;
/** The levels, two to a row under their chapter: number, stars won, name and kind. Those not open yet are dimmed; any open one can be played at any time, as it was left. */
function levelList() {
  const all = document.createElement("div");
  all.className = "slk-levels";
  CHAPTERS.forEach((ch, c) => {
    const head = document.createElement("h3"), grid = document.createElement("div"), to = CHAPTERS[c + 1]?.from ?? COUNT;
    head.className = "slk-chap";
    head.textContent = ch.name;
    grid.className = "slk-lgrid";
    for (let n = ch.from; n < to; n++) {
      const L = LADDER[n], won = camp.stars[n], b = document.createElement("button"), row = document.createElement("div"), num = document.createElement("b"),
        stars = document.createElement("span"), name = document.createElement("div"), kind = document.createElement("div");
      b.type = "button";
      b.disabled = !isOpen(n);
      b.className = won ? "done" : "";
      if (isLevel(S) && S.lv === n) b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Level ${n + 1}, ${L.name}${won ? `, ${plural(won, "star")}` : ""}${b.disabled ? ", not open yet" : ""}`);
      row.className = "slk-lrow";
      num.textContent = n + 1;
      stars.textContent = isOpen(n) ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : "";
      row.append(num, stars);
      name.className = "slk-lname";
      name.textContent = L.name;
      kind.className = "slk-lkind";
      kind.textContent = levelNote(L);
      b.append(row, name, kind);
      b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
      grid.append(b);
    }
    all.append(head, grid);
  });
  return all;
}
const TWIST_CHOICES = { square: [["none", "None"], ["ranges", "Ranges"], ["tunnels", "Tunnels"], ["ranges+tunnels", "Both"]], hex: [["none", "None"], ["ranges", "Ranges"]] };
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const levels = isLevel(S) && !COOP, content = part(body, "content");
  const play = part(body, "play");
  play.append(action(COOP ? "Another puzzle" : "New puzzle", () => (levels ? confirmLevelBlock() : confirmStart("random")), "primary"));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action("The rules", showRules, "link"));
  if (!COOP) {
    content.append(choice("Play", [["levels", "Levels"], ["free", "Free play"]], levels ? "levels" : "free", v => { (v === "levels" ? playLevel(camp.at) : playFree()); openMenu(); }));
    if (levels) content.append(levelList());
    else {
      content.append(choice("Board", Object.entries(SHAPES), prefs.board, v => { prefs.board = v; prefs.mix = twistOn(prefs.mix, v); savePrefs(); refill(chosenKind()); openMenu(); }));
      content.append(choice("Twist", TWIST_CHOICES[prefs.board], twistOn(prefs.mix, prefs.board), v => { prefs.mix = v; savePrefs(); refill(chosenKind()); openMenu(); }));
    }
    todayPart(body, { app: "slitherlink", play: () => start("daily"), playing: S?.mode === "daily" && S.seed === today(), busy: started() });
  }
  const look = part(body, "settings");
  look.append(choice("View", [["flat", "Flat"], ["3d", "3D"]], viewShown, v => { setView(v); openMenu(); }), toggle("Sound", sound.on, on => { sound.on = on; write(SOUND, on); if (on) sound.play("quill"); }));
  if (coop) part(body, "together").append(line(`Co-op with ${coop.otherName}: one board for you both.`), action(coop.host ? "End the co-op" : "Leave the co-op", () => coop.leave(), "link"));
  const best = S && !COOP && !isLevel(S) ? bestOf(S) : null;
  const about = part(body, "about");
  if (levels) {
    const solved = camp.stars.filter(Boolean).length;
    about.append(line(`${solved} of ${COUNT} levels solved, ${plural(camp.stars.reduce((a, b) => a + b, 0), "star")}. Three stars within the par, two within twice it.`));
  } else about.append(line(S ? `${kindText(kindOfRun(S))}: ${COOP ? (S.done ? "solved" : "not solved yet") : best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Draw the loop."));
  if (!COOP) about.append(action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** Another puzzle of the level being played. */
async function confirmLevelBlock() {
  if (started() && !(await sure("Start a new puzzle of this level? This one isn't solved.", { yes: "New puzzle" }))) return false;
  levelBlock(S.lv, true);
  return true;
}
async function clearBoard() {
  if (!S || S.done) return;
  if (!(await sure(coop ? "Clear every mark on the board? It clears it for both of you." : "Clear every mark on the board?", { yes: "Clear" }))) return;
  if (S.done) return;
  if (coop) {
    const marks = [...S.marks].map((m, e) => (m !== NONE && !P.locked?.[e] ? [e, m] : null)).filter(Boolean);
    for (const [e, m] of marks) S.undo.push([e, m, NONE]);
    S.redo = [];
    S.lit = null;
    coop.edit(marks.map(([e, m]) => cellEdit("marks", e, m, NONE)));
    changed();
    return;
  }
  for (let e = 0; e < S.marks.length; e++) if (S.marks[e] !== NONE && !P.locked?.[e]) setEdge(e, S.marks[e], NONE);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- links: #s=SEED&n=7&l=medium&b=hex&t=ranges (#d= for a day's; b only for a hex board, t only with a twist), #lv=LEVEL&s=SEED for a level's ----------
const hashOf = s => (isLevel(s) ? `#lv=${s.lv}&s=${s.seed}` : `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}${hexOn(s.board) ? "&b=hex" : ""}${shadeOn(s.twist) ? "&t=shade" : hasTwist(s.twist) ? `&t=${twistFor(s.twist, s.board)}` : ""}`);
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), lv = h.has("lv") ? Number(h.get("lv")) : -1, seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  if (Number.isInteger(lv) && lv >= 0 && lv < COUNT) return { seed, mode: "level", lv, k: kindOf(lv) };
  const board = h.get("b") === "hex" && !h.get("d") ? "hex" : "square", sizes = hexOn(board) ? HEX_SIZES : SIZES, size = sizes.includes(Number(h.get("n"))) ? Number(h.get("n")) : hexOn(board) ? 7 : 7;
  const t = h.get("t"), twist = h.get("d") ? "none" : t === "shade" && !hexOn(board) ? "shade" : twistOn(t, board);
  return { seed, mode: h.get("d") ? "daily" : "random", k: { board, size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium"), twist } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle, l.mode === "level" ? { lv: l.lv } : {}));
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "slitherlink");
document.querySelector(".slk-mark").innerHTML = APPS.find(a => a.id === "slitherlink")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => {
  if (isLevel(S) && !COOP) { if (S.lv + 1 < COUNT && isOpen(S.lv + 1)) playLevel(S.lv + 1); else openMenu(); }
  else start("random");
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); coop?.together.resync(); } });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { if (COOP) return; const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode && (l.mode !== "level" || S.lv === l.lv))) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
/** A board position (corners at whole numbers) on the screen, in whichever view shows. */
const onScreen = (x, y) => {
  if (modelOn()) return model.project(x, y);
  const m = svg.getScreenCTM();
  return { x: x * m.a + m.e, y: y * m.d + m.f };
};
window.__slitherlink = {
  get state() { return S; }, get puzzle() { return P; }, get coop() { return coop; }, press, useHint, undo, redo, start, edgeAt,
  /** Where an edge's middle is on the screen, for tests that tap it as a finger would. */
  screenOf: e => {
    const [x1, y1, x2, y2] = P.view.epos[e];
    return onScreen((x1 + x2) / 2, (y1 + y2) / 2);
  },
  /** Where a corner is on the screen (for the tap-accuracy measure). */
  screenVertex: v => onScreen(...P.view.pos[v]),
  get model() { return model; }, setView, get view() { return viewShown; },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
async function solo() {
  const kept = read(RUN, null);
  S = null;
  if (valid(kept)) S = kept;
  const l = linked();
  if (l && !(S && S.seed === l.seed && S.mode === l.mode && S.size === l.k.size && (l.mode !== "level" || S.lv === l.lv))) { openLinked(l); return; }
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
    P = puzzleOf(S.size, S.grid, S.sol, specOf(S));
    message = null; sentDone = false;
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
if (viewShown === "3d") setView("3d", false);
onDefaultChange(is3D => { if (!prefs.view) setView(is3D ? "3d" : "flat", false); });      // Settings' 2D mode, live
if (COOP) joinPartner().catch(e => { console.error(e); solo(); }); else solo();
