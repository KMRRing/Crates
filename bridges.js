// Bridges: join islands with one or two straight bridges, none crossing, until every island has as many bridges as its
// number and all the islands are one network. The rules, the puzzles and the reasoning are bridges-engine.js's (every
// puzzle has one answer, and is graded by the hardest step a person needs); the puzzles are made in bridges-worker.js.
// This file keeps the run, the clock and the taps, and draws the board. Two ways to play: Levels (bridges-levels.js: a ladder
// of puzzles in chapters, each bringing a twist, with stars, each kept as it was left, as Topple's are) and Free play (a size,
// a difficulty and a twist, a random puzzle or today's).
import { SIZES, LEVELS, DAILY, TWISTS, puzzleOf, generate, nextMark, withMark, solvedBy, crossed, crossings, breaks, whatBreaks, labelOf, hintFor, levelOn, twistOn, flagsOf } from "./bridges-engine.js";
import { LEVELS as LADDER, CHAPTERS, COUNT, LADDER_VERSION, chapterOf, seedOf, kindOf, parOf, starsFor, migrate } from "./bridges-levels.js";
import { playable as valid, fromPuzzle, scoreOf as scoreFor, HINT } from "./bridges-run.js";
import { createDuel } from "./duel.js";
import { cellEdit, tallyEdit, onceEdit } from "./board-share.js";
import coopOf, { shareRun } from "./bridges-coop.js";
import { raceLevel, matchOf, matchValid, nameOf, reportOf } from "./bridges-race.js";
import { sure } from "./sure.js";
import { miniature } from "./bridges-mini.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
// RUN: the free puzzle in play. TRACK: "levels" or "free", the way played. CAMP: the level being played and the stars won in
// each. LRUNS: the puzzle of each level as it was left (by level).
const RUN = "bridges:run", TIMES = "bridges:times", PREFS = "bridges:prefs", SPARES = "bridges:spares", TRACK = "bridges:track", CAMP = "bridges:camp", LRUNS = "bridges:lruns";
const STAR = "★", HOLLOW = "☆";
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to clear a link instead of adding a bridge
const REACH = 0.32;                  // how far from a link, in cells, a finger still means that link
const DISC = 0.36;                   // an island's radius, in cells: a finger on an island means no link
const CASE = 0.15;                   // half the width of a viaduct's casing, in cells (bridges.css): a finger within it is on the viaduct

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const twistName = t => twistOn(t).split("+").filter(x => TWISTS[x]).map(x => TWISTS[x]).join(" + ");
const hasTwist = t => !!t && twistOn(t) !== "none";
const kindText = k => `${k.size}×${k.size} · ${LEVELS[k.level]}${hasTwist(k.twist) ? ` · ${twistName(k.twist)}` : ""}`;
const kindKey = k => `${k.size}:${k.level}${hasTwist(k.twist) ? `:${twistOn(k.twist)}` : ""}`;

// ---------- what you chose ----------
const prefs = { size: 9, level: "easy", twist: "none", view: "chart", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 9;
if (!LEVELS[prefs.level]) prefs.level = "easy";
if (!TWISTS[prefs.twist]) prefs.twist = "none";
if (prefs.view !== "model") prefs.view = "chart";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ size: prefs.size, level: levelOn(prefs.size, prefs.level), twist: prefs.twist });

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Hitori's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level, k.twist));
  try {
    worker ||= new Worker(new URL("./bridges-worker.js", import.meta.url), { type: "module" });
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
// S: { v, mode ("random", "daily" or "level"), seed, lv (the level, 0 on, in a level), size, level (the difficulty asked),
//      came (what it graded), twist, grid, kinds, realms, hills, roads and straits (a twist's strings, when it has them), sol, marks, undo, redo, ms,
//      hints, done ({ ms, score } once solved), lit (a hint's links, its island and its words), fresh (a new best) }
// (a twist's strings: kinds, realms, hills, straits a character a cell or a gap, roads a character a link)
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const isLevel = s => s?.mode === "level";
const racing = () => S?.mode === "duel";                       // a race at a table (duel.js): the match's run, kept apart from your own

// A party of two opened this page (&coop=1, docs/coop.md): the board is the room's, one board for two phones, and what this file
// does to the bridges goes through `coop.edit` as edits instead of a change to S.marks. S is built from the room's board each
// time it moves (showBoard); undo, redo and a hint's gilt stay each player's own. The clock is the team's.
const COOP = !IN_FRAME && /[?&]coop=1\b/.test(location.search) && /[?&]room=[A-Za-z]{4}\b/.test(location.search);
let coop = null;                       // coop-page.js's controller once the room's board is on the screen
let coopHost = false, team = null, sentDone = false;     // this phone is the host's; the board's start ({ at, ms, hints }); the solve is on its way
const teamMs = () => (team ? (team.ms || 0) + Math.max(0, Date.now() - team.at) : 0);
const hintId = () => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function save() {
  if (IN_FRAME || !S) return;
  if (COOP) {                      // the host's own run follows the shared board (it is theirs again when the co-op ends); the guest's is left alone
    if (coopHost) { const kept = { ...S, undo: [], redo: [], lit: null, ms: Math.round(teamMs()) }; if (isLevel(S)) write(LRUNS, { ...read(LRUNS, {}), [S.lv]: kept }); else write(RUN, kept); }
    return;
  }
  if (racing()) { duel.keep(S); return; }                      // never in your own run, bests or today's
  if (isLevel(S)) write(LRUNS, { ...read(LRUNS, {}), [S.lv]: S }); else write(RUN, S);
  savedAt = performance.now();
}
const startedRun = r => !!r && !r.done && (/[123]/.test(r.marks) || r.hints > 0);
const started = () => startedRun(S);

// ---------- the levels ----------
/** The campaign as kept: the level being played and the stars won in each, mended if it is not what it should be. A save from before
 *  the ladder was reordered (reefs and fairways went on 3 November 2026) is carried over to the new numbers first, stars and puzzles left half done. */
function readCamp() {
  let c = read(CAMP, null);
  if (c?.v !== LADDER_VERSION) {
    const m = migrate(c, read(LRUNS, {}));
    c = m.camp;
    if (!IN_FRAME) { write(CAMP, c); write(LRUNS, m.runs); }
  }
  const stars = LADDER.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const open = stars.findIndex(x => x < 1);                          // the first level not solved is the last one open
  return { v: LADDER_VERSION, at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, open < 0 ? COUNT - 1 : open)) : 0, stars };
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
  return n === ch.from ? { text: `${ch.name}. ${ch.about}`, tone: "" } : null;
}

/** The engine's puzzle for a run. */
const puzzleFor = s => puzzleOf(s.size, s.grid, s.sol, s.kinds || "", s.realms || "", s.hills || "", s.roads || "", { straits: s.straits || "", tree: flagsOf(s.twist).tree });
/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleFor(S);
  message = isLevel(S) && !started() && !S.done ? introOf(S.lv) : null; clockFrom = null;
  $("level").value = levelOn(S.size, S.level);
  if (!racing()) {                                             // a race leaves your way of playing, your level and the address alone
    track = isLevel(S) ? "levels" : "free";
    if (isLevel(S)) camp.at = S.lv;                            // a link's level is the one in hand now
    if (!IN_FRAME) { write(TRACK, track); if (isLevel(S)) write(CAMP, camp); history.replaceState(null, "", hashOf(S)); }
  }
  drawBoard();
  save();
  clockRun();
  render();
}
/** A new solo puzzle: today's, or a random one of the kind chosen. */
async function start(mode, k = chosenKind()) {
  if (IN_FRAME) return;
  if (COOP) { coopAnother(); return; }
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
  if (!isOpen(n)) return;
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
  if (g) { begin(g); if (!IN_FRAME) refill(chosenKind()); return; }
  if (track === "levels") await levelBlock(camp.at); else await start("random");
}
async function setTrack(next) {
  if (next === track) return;
  clockPause();
  track = next;
  write(TRACK, track);
  await resume();
}
async function confirmStart(mode, k) {
  if (started() && !(await sure("Start a new puzzle? This one isn't solved.", { yes: "New puzzle" }))) return false;
  start(mode, k);
  return true;
}

// ---------- the clock ----------
// A puzzle counts the time it's on screen (S.ms); it stands while the menu, the rules or the games screen is open.
function clockRun() {
  if (racing() || COOP || IN_FRAME || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;     // a race's clock is the table's, from the start everyone shares; a co-op's is the team's
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); cancelPress(); model?.hold(true); }, () => { paused = false; clockRun(); model?.hold(false); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : COOP ? teamMs() : racing() ? Math.max(0, duel.now() - S.begun) : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => scoreFor(ms, S?.hints || 0);

// ---------- bests ----------
// Kept in bridges:times by size and level, lowest first, not bridges:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, bridges:today).
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, level: s.came || s.level, twist: s.twist })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, level: S.came || S.level, twist: S.twist }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}
/** The puzzle as the stars see it: its islands and the difficulty it graded to. */
const forStars = () => ({ grid: S.grid, level: S.came || S.level });
/** Writes a solved level's stars (the best it has had); true if this solve improved on them. */
function recordLevel(sc) {
  const n = S.lv, stars = starsFor(forStars(), sc), fresh = stars > camp.stars[n];
  if (fresh) { camp.stars[n] = stars; write(CAMP, camp); }
  return fresh;
}

// ---------- marks ----------
/** A tap adds a bridge to the link (none, one, two, none); a hold clears it. */
function press(l, how) {
  if (!S || S.done || IN_FRAME || paused || l < 0) return;
  const from = S.marks[l], to = how === "hold" ? "0" : nextMark(from, P.lay.links[l].cap);
  if (to !== "0" && from === "0" && crossed(P, S.marks, l)) { note("A bridge there would cross another.", "bad"); render(); return; }
  setLink(l, from, to);
  if (to !== "0") navigator.vibrate?.(8);
}
function setLink(l, from, to, undoable = true, weak = false, more = []) {
  if (from === to) return;
  if (coop) coop.edit([cellEdit("marks", l, from, to, weak), ...more]);     // shows at once (showBoard) and goes to the room
  else S.marks = withMark(S.marks, l, to);
  if (undoable) { S.undo.push([l, from, to]); if (S.undo.length > 400) S.undo.shift(); S.redo = []; }
  S.lit = null;
  changed(l);
}
function undo() {
  const last = S?.undo.pop();
  if (!last || S.done) return;
  const [l, from, to] = last;
  S.redo.push(last);
  setLink(l, to, from, false, true);        // together, an undo only puts back what is still as you left it: a bridge your partner changed since stays theirs
}
function redo() {
  const next = S?.redo.pop();
  if (!next || S.done) return;
  const [l, from, to] = next;
  S.undo.push(next);
  setLink(l, from, to, false);
}
/** After any change: the end is settled the moment the bridges are the answer, and the run is kept. What is broken is said
 *  by the line under the board for as long as it is (`trouble`, from the marks), not only by the tap that broke it. */
function changed(at = -1) {
  if (at >= 0) message = null;                                   // what the last tap said (a bridge refused) is spent
  if (!S.done && solvedBy(P, S.marks)) finish();
  else { save(); tellSoon(); }
  paint();
  render();
}
function note(text, tone = "") { message = text ? { text, tone } : null; }

// ---------- hints ----------
/** A step of reasoning in words, as a hint says it. */
const WORD = ["no", "one", "two", "three"];
function explain(x) {
  const bridges = plural(x.to, "bridge");
  if (x.strait != null) {                                         // a strait is a sum like an island's, over the roads that cross it
    const n = P.lay.groups[x.strait].mx;
    if (x.tech === "all") return `The strait marked ${n} needs every bridge the roads across it can carry: this link takes ${WORD[x.to]}.`;
    return `The other roads across the strait marked ${n} can't carry enough, so this link has at least ${bridges}.`;
  }
  const n = labelOf(P.lay.isl[x.at]);
  switch (x.tech) {
    case "all": return `The ${n} here needs every bridge its links can carry: this link takes ${WORD[x.to]}.`;
    case "need": return `The other links of this ${n} can't carry enough, so this link has at least ${bridges}.`;
    case "trial": return `Suppose this link had ${x.supposed === 0 ? "no bridge" : plural(x.supposed, "bridge")} at most: the rules break. So it has at least ${bridges}.`;
  }
  return "";
}
function useHint() {
  if (!S || S.done || IN_FRAME || paused) return;
  const h = hintFor(P, S.marks);
  if (!h) return;
  if (!coop) S.hints++;                                          // together a hint is the room's (a tally, counted once for both of you)
  let link, to, island = null, strait = null, text;
  if (h.wrong != null) {
    ({ wrong: link, should: to } = h);
    text = to === "0" ? "Hint: there is no bridge here. It is cleared now." : "Hint: this link has fewer bridges than that. It is put right now.";
  } else if (h.step) {
    link = h.step.link; island = h.step.at ?? null; strait = h.step.strait ?? null;
    to = String(h.step.to);
    const said = explain(h.step);
    text = `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    ({ reveal: link, should: to } = h);
    text = "Hint: this link has a bridge, or two.";
  }
  setLink(link, S.marks[link], to, true, false, coop ? [tallyEdit("hints", hintId())] : []);
  S.lit = { set: [link], island, strait, text };
  message = null;
  save();
  paint();
  render();
}

// ---------- the end ----------
/** The bridges are the answer: the time stands for both of you, whoever saw it first (a value that is set once, board-share.js). */
function finishTogether() {
  if (S.done || sentDone || !coop) return;
  sentDone = true;
  const ms = Math.round(teamMs());
  coop.edit(onceEdit("done", { ms, score: scoreOf(ms), by: coop.together.room?.name || "" }));
}
function finish() {
  if (coop) { finishTogether(); return; }
  const ms = racing() ? Math.max(0, duel.now() - S.begun) : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
  clockFrom = null;
  S.done = { ms, score: scoreOf(ms) };
  S.lit = null;
  if (racing()) {                                                // the race's result goes to the table; nothing of your own changes
    save();
    tell(true);
    wave();
    if (prefs.view === "model") model?.spin();
    return;
  }
  S.fresh = isLevel(S) ? recordLevel(S.done.score) : recordBest(S.done.score);
  if (S.mode === "daily") noteDayTime("bridges", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("bridges");
  wave();
  if (prefs.view === "model") model?.spin();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
/** The numbers are set a hundred times larger and scaled back down, centred by an explicit offset: Safari lays out text
 *  under a unit tall badly (as Hitori's and Delta's are). */
const TEXT_SCALE = 100;
let svg = null, linkEls = [], islEls = [], straitEls = [], seg = [];
/** What the marks break now, in words (bridges-engine.js's whatBreaks), for the line under the board. */
let trouble = "";
const MARGIN = 0.78;                // room a strait's badge takes at the board's left or top edge, in cells
const BADGE = 0.31;                 // its radius
function drawBoard() {
  const { size, lay } = P, pad = 0.3, at = i => [lay.isl[i].c + 0.5, lay.isl[i].r + 0.5];
  const x0 = lay.groups.some(g => !g.across) ? -(pad / 2 + MARGIN) : -pad, y0 = lay.groups.some(g => g.across) ? -(pad / 2 + MARGIN) : -pad;      // a strait's number sits in the margin, so the margin grows only for one that has it
  svg = svgEl("svg", { viewBox: `${x0} ${y0} ${size + pad - x0} ${size + pad - y0}`, role: "img", "aria-label": `${kindText({ size: S.size, level: S.came || S.level, twist: S.twist })}: the board. Tap a link between two islands to build a bridge.`, class: "brg-svg" });
  svgEl("rect", { x: x0 + pad / 2, y: y0 + pad / 2, width: size + pad / 2 - (x0 + pad / 2), height: size + pad / 2 - (y0 + pad / 2), rx: 0.12, class: "brg-paper" }, svg);
  straitEls = lay.groups.map(g => {                                              // straits: a dashed line across the sea, its number in the margin
    const k = g.gap + 1, e = svgEl("g", { class: "brg-strait" }, svg), mid = (g.across ? y0 : x0) + pad / 2 + MARGIN / 2;
    const [bx, by] = g.across ? [k, mid] : [mid, k], end = size + pad / 2 - 0.04;
    svgEl("line", g.across ? { x1: k, y1: mid + BADGE, x2: k, y2: end, class: "brg-sline" } : { x1: mid + BADGE, y1: k, x2: end, y2: k, class: "brg-sline" }, e);
    svgEl("circle", { cx: bx, cy: by, r: BADGE, class: "brg-sbadge" }, e);
    const t = svgEl("text", { x: 0, y: 0, dy: "0.36em", class: "brg-snum", "font-size": 0.42 * TEXT_SCALE, transform: `translate(${bx} ${by}) scale(${1 / TEXT_SCALE})` }, e);
    t.textContent = String(g.mx);
    return e;
  });
  seg = lay.links.map(l => { const [x1, y1] = at(l.a), [x2, y2] = at(l.b); return { x1, y1, x2, y2 }; });
  // low links first, then the viaducts over them: a viaduct is cased in the paper's colour, so a low bridge under it seems to pass beneath
  linkEls = [];
  [...lay.links.keys()].sort((a, b) => lay.links[a].high - lay.links[b].high).forEach(i => {
    const l = lay.links[i], { x1, y1, x2, y2 } = seg[i], g = svgEl("g", { class: "brg-l" }, svg), off = d => (l.vertical ? { dx: d, dy: 0 } : { dx: 0, dy: d });
    const line = (d, cls) => { const { dx, dy } = off(d); svgEl("line", { x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy, class: cls }, g); };
    // a road's width is drawn in the road: a wide one is a bed with three lanes, a narrow one is pinched by a wedge each side of its middle, an ordinary one is a single line as ever
    if (l.cap === 3) { line(0, "brg-bed"); for (const d of [-0.14, 0, 0.14]) line(d, "brg-guide"); } else line(0, "brg-guide");
    if (l.high) { line(0, "brg-case"); line(0, "brg-piers"); }
    line(0, "brg-b brg-one");
    for (const s of [-1, 1]) line(s * 0.09, "brg-b brg-two");
    if (l.cap === 3) for (const d of [-0.14, 0, 0.14]) line(d, "brg-b brg-three");
    if (l.cap === 1) {                                              // a narrow road is pinched: a wedge from each side points at the middle of it
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, pt = (u, v) => (l.vertical ? `${mx + v},${my + u}` : `${mx + u},${my + v}`);
      for (const s of [-1, 1]) svgEl("polygon", { points: [pt(-0.2, s * 0.38), pt(0.2, s * 0.38), pt(0, s * 0.1)].join(" "), class: "brg-post" }, g);
    }
    linkEls[i] = { g, d: Math.round((x1 + y1) * 40) };
  });
  islEls = lay.isl.map((isle, i) => {
    const [x, y] = at(i), g = svgEl("g", { class: islandClass(i) }, svg);
    if (isle.hill) for (const r of [DISC + 0.09, DISC + 0.17]) svgEl("circle", { cx: x, cy: y, r, class: "brg-hill" }, g);       // a hill: contour lines round it
    svgEl("circle", { cx: x, cy: y, r: DISC + (isle.hill ? 0.26 : 0.1), class: "brg-halo" }, g);        // drawn only round an island that breaks a rule
    svgEl("circle", { cx: x, cy: y, r: DISC, class: "brg-disc" }, g);
    const t = svgEl("text", { x: 0, y: 0, dy: "0.36em", class: "brg-num", "font-size": (isle.kind || isle.n > 9 ? 0.4 : 0.5) * TEXT_SCALE, transform: `translate(${x} ${y}) scale(${1 / TEXT_SCALE})` }, g);
    t.textContent = labelOf(isle);
    return g;
  });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** An island's classes: its realm, whether its number is only a bound and whether it is a hill, then (from the run) met, over, shut off, a hint's. */
const islandClass = (i, extra = []) => ["brg-i", P.lay.isl[i].realm ? "r1" : "", P.lay.isl[i].kind ? "rng" : "", P.lay.isl[i].hill ? "hill" : "", ...extra].filter(Boolean).join(" ");
const NO_LINKS = new Set();
/** Each link's look from the run (its bridges, a hint's, the wave) and each island's (met, over, shut off, a hint's). */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), over = new Set(br.over), met = new Set(br.met), cut = new Set(br.cut), lit = new Set(S.lit?.set || []), ring = new Set(br.ring), looped = new Set(br.ring.flatMap(l => [P.lay.links[l].a, P.lay.links[l].b]));
  const cross = coop ? crossings(P, S.marks) : NO_LINKS;           // two partners can lay crossing bridges at once; alone a tap across is refused
  trouble = cross.size ? "Two bridges cross each other: clear one of them." : whatBreaks(P, S.marks, br);
  linkEls.forEach(({ g }, l) => {
    const { a, b } = P.lay.links[l], wrong = S.marks[l] !== "0" && (over.has(a) || over.has(b) || (cut.has(a) && cut.has(b)) || ring.has(l) || cross.has(l));   // a bridge on an island that has too many, inside a group shut off, round a ring, or across another
    const cls = ["brg-l", P.lay.isl[a].realm ? "k1" : "", P.lay.links[l].high ? "hi" : "", S.marks[l] !== "0" ? `c${S.marks[l]}` : "", wrong ? "bad" : "", lit.has(l) ? "lit" : ""].filter(Boolean).join(" ");
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
  islEls.forEach((g, i) => {
    const cls = islandClass(i, [over.has(i) ? "over" : met.has(i) ? "met" : "", cut.has(i) ? "cut" : "", looped.has(i) ? "loop" : "", S.lit?.island === i ? "why" : ""]);
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
  straitEls.forEach((g, k) => {
    const cls = `brg-strait${br.straitsOver.includes(k) ? " over" : br.straitsMet.includes(k) ? " met" : ""}${S.lit?.strait === k ? " why" : ""}`;
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
  feedModel(br);
}
/** The solve, shown: the bridges turn gilt from the top left. */
function wave() {
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  linkEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
  svg.classList.add("solved");
}

// ---------- 3D: the same board as a relief with ships, played the same way (bridges-3d.js, loaded when first asked for) ----------
let model = null, modelFor = null;
/** The model follows the run: a new puzzle is built into it, a change of marks shows and hides bridges, a hint's link glows. */
function feedModel(br) {
  if (!model || prefs.view !== "model" || !S || !P) return;
  if (modelFor !== P) { model.set({ lay: P.lay, size: P.size }); modelFor = P; }
  model.update(S.marks, br || breaks(P, S.marks), S.lit);
}
/** Chart (2D) or model (3D; `prefs.view` keeps "chart" and "model"). The model's code (three.js) comes only when it is first wanted; where there is no WebGL the chart stays. */
async function setView(v, remember = true) {
  if (v === "model" && !model) {
    try {
      model = (await import("./bridges-3d.js")).createModel($("model"), {
        press, playable: () => !!S && !S.done && !IN_FRAME && !paused, blocked: l => S.marks[l] === "0" && crossed(P, S.marks, l),
      });
    }
    catch (err) { console.warn("Bridges: no 3D here.", err); toast("This browser can't draw 3D."); v = "chart"; }
  }
  prefs.view = v;
  if (remember) savePrefs();
  const on = v === "model";
  $("card").classList.toggle("is-model", on);
  $("model").hidden = !on;
  $("viewBtn").innerHTML = on ? "<b>2D</b><small>the chart</small>" : "<b>3D</b><small>scenic view</small>";
  $("viewBtn").setAttribute("aria-pressed", String(on));
  model?.show(on);
  if (on) feedModel();
  drawLine();
}

// ---------- the board under a finger: a tap adds a bridge, a hold clears the link ----------
let pressing = null;   // { id, link, x, y, timer, held }
const toCells = ev => {
  const m = svg?.getScreenCTM();
  return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : null;
};
/** The link nearest a finger, if one is close enough and the finger isn't on an island. */
function linkAt(ev) {
  const pt = toCells(ev);
  if (!pt) return -1;
  let best = -1, d2 = REACH * REACH;
  for (let l = 0; l < seg.length; l++) {
    const { x1, y1, x2, y2 } = seg[l];
    if (Math.hypot(pt.x - x1, pt.y - y1) < DISC + 0.04 || Math.hypot(pt.x - x2, pt.y - y2) < DISC + 0.04) continue;   // on an island
    const cx = Math.min(Math.max(pt.x, Math.min(x1, x2)), Math.max(x1, x2)), cy = Math.min(Math.max(pt.y, Math.min(y1, y2)), Math.max(y1, y2));
    // a link no bridge can go on (another crosses it) loses a tie where two meet, so the tap lands on the one that can be built
    // a finger on a viaduct's casing means the viaduct, not the low bridge that seems to pass under it
    const d = P.lay.links[l].high ? Math.max(0, (pt.x - cx) ** 2 + (pt.y - cy) ** 2 - CASE * CASE) - 1e-6 + (S.marks[l] === "0" && crossed(P, S.marks, l) ? 0.05 : 0)
      : (pt.x - cx) ** 2 + (pt.y - cy) ** 2 + (S.marks[l] === "0" && crossed(P, S.marks, l) ? 0.05 : 0);
    if (d < d2) { d2 = d; best = l; }
  }
  return best;
}
function down(ev) {
  if (ev.button > 0) { if (ev.button === 2) press(linkAt(ev), "hold"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  ev.preventDefault();
  cancelPress();
  const link = linkAt(ev);
  if (link < 0) return;
  try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: ev.pointerId, link, x: ev.clientX, y: ev.clientY, held: false };
  pressing.timer = setTimeout(() => { if (!pressing) return; pressing.held = true; navigator.vibrate?.(14); press(pressing.link, "hold"); }, HOLD);
}
function cancelPress() { if (pressing) clearTimeout(pressing.timer); pressing = null; }
addEventListener("pointermove", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  if (Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) > 12 * scale()) cancelPress();   // a slip off the link is no tap
});
addEventListener("pointerup", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const { link, held } = pressing;
  cancelPress();
  if (!held) press(link, "tap");
});
addEventListener("pointercancel", cancelPress);

// ---------- drawing the rest ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S) { put("time", "0:00"); put("penalty", ""); put("kind", ""); return; }
  put("time", fmt(elapsed() / 1000 + penalty()));
  put("penalty", penalty() ? `+${penalty()} s` : "");
  put("kind", isLevel(S) ? `Par ${fmt(parOf(forStars()))} · ${LADDER[S.lv].name}` : `${S.mode === "daily" ? "Today · " : racing() ? "Race · " : ""}${kindText({ size: S.size, level: S.came || S.level, twist: S.twist })}`);
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (trouble) { text = trouble; tone = "bad"; }
  else if (S.came && S.came !== S.level && !/[123]/.test(S.marks)) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!/[123]/.test(S.marks)) {
    const twisted = hasTwist(S.twist);                    // a twist's sentence needs the room, so the first line is shorter with one
    text = prefs.view === "model" ? "Tap a dashed line to build a bridge, again for another, again to clear it. Hold to clear. Drag to turn, pinch or scroll to zoom."
      : twisted ? "Tap a dotted line to build a bridge, again for another, again to clear it. Hold to clear." : "Tap the dotted line between two islands to build a bridge, again for a second, again to clear it. Hold to clear.";
    if (twisted && prefs.view !== "model") text += twistHint();
  } else text = goalLine();
  if (l.textContent !== text) l.textContent = text;
  l.className = `brg-say${tone ? ` ${tone}` : ""}`;
}
/** The line under a board with bridges on it: what is asked, with a word for each twist the puzzle has. */
function goalLine() {
  const f = flagsOf(S.twist);
  const bits = [f.ranges ? "Every island its number or within its bound" : "Every island with as many bridges as its number", f.realms ? "each colour one network" : "all of them joined", "no bridge crossing another"];
  if (f.hills) bits[2] += " (a viaduct goes over)";
  if (f.straits) bits.push("each strait with its bridges");
  if (f.tree) bits.push("no ring");
  return `${bits.join(", ")}.`;
}
/** What a twist adds to the first line: one short sentence for the first twist the puzzle has. */
function twistHint() {
  const f = flagsOf(S.twist);
  return f.straits ? " A number on a dashed line counts the bridges that cross it."
    : f.tree ? " No ring: the bridges never come back round to where they started."
    : f.wide ? " A road with three lanes holds up to three bridges."
    : f.narrow ? " A road pinched by two wedges holds one bridge only."
    : f.hills ? " A bridge between two ringed hills goes over the bridges below it."
    : f.realms ? " Islands of one colour join only each other."
    : f.ranges ? " 4+ is at least four, ≤3 at most three." : "";
}
function drawResult() {
  const done = !!S?.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const d = S.done, bits = [`${fmt(d.ms / 1000)} on the clock`], best = isLevel(S) || racing() ? null : bestOf(S);
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${penalty()} s)`);
  const shared = !!coop || (isLevel(S) && camp.stars[S.lv] < 1);          // a solve for two (or left from one) earns no stars and no best: they are for one player alone
  const stars = isLevel(S) && !shared ? starsFor(forStars(), d.score) : 0;
  const tail = shared ? (isLevel(S) && !coop ? " Shared solves earn no stars: a new puzzle of this level is yours to play alone." : "")
    : isLevel(S) ? ` ${STAR.repeat(stars)}${HOLLOW.repeat(3 - stars)} Par ${fmt(parOf(forStars()))}.` : racing() ? "" : S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
  $("verdict").textContent = `${coop ? "Solved together" : "Solved"}: ${fmt(d.score)}. ${bits.join(", ")}.${tail}`;
  $("nextBtn").textContent = racing() ? "The result" : coop || shared ? "Another puzzle" : isLevel(S) ? (S.lv + 1 < COUNT ? "Next level" : "Levels") : "Another puzzle";
}
/** The header: in a level the difficulty and the size are the level's own, so the difficulty dropdown gives way to the level. */
function chrome() {
  const level = isLevel(S);
  $("app").classList.toggle("lv", level);
  $("level").hidden = level;
  levelDropdown.sync();
  $("levelBtn").hidden = !level;
  if (level) $("levelBtn").textContent = `Level ${S.lv + 1}`;
}
function render() {
  chrome();
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
    <p>Join the islands with bridges until every island has exactly as many bridges as its number and all the islands are one network. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>The rules</h4>
    <p>A bridge runs straight, in a row or a column, from an island to the next island along it. There may be one or two bridges between a pair of islands, never three (unless the road is wide), and bridges never cross each other or pass over an island. Every island ends up with as many bridges as its number, and you can walk from any island to any other over the bridges.</p>
    <p><b>An example.</b> A 1 beside a 1 can't be joined to it, or the two would be shut off together from the rest. An island that has only one way out takes all its bridges there. And an 8 has a double bridge in each of its four directions.</p>
    <h4>Playing</h4>
    <p>Tap the dotted line between two islands to build a bridge, again to make it double, again to clear it; hold a link, or right-click it, to clear it at once. A bridge can't be built across another. The puzzle is solved the moment exactly its answer is built. Undo and Redo step through your marks, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: an island with too many bridges in oxblood, a group that has all its bridges while other islands are left out ringed, a ring of bridges where there may be none. That comes from the rules, never the answer. An island turns blue once it has its number. Hint (+${HINT}&nbsp;s) puts a wrong bridge right first; otherwise it makes the next step a person would take and says why, the link it settled in gilt and the island that says so ringed.</p>
    <h4>Twists</h4>
    <p><b>Ranges.</b> Some numbers are only a bound: <b>4+</b> is at least four bridges, <b>≤3</b> at most three. The rest of the rules hold, and the puzzle still has one answer.</p>
    <p><b>Two realms.</b> Two colours of island. A bridge joins two islands of one colour; an island of the other colour in the way stops a link as any island does. Each colour must be one network of its own.</p>
    <p><b>Viaducts.</b> Some islands are hills, ringed like a map's contour lines. A bridge between two hills is a viaduct, drawn cased and ribbed with piers: it goes over any low bridge it meets, which seems to pass under it. Two viaducts, or two low bridges, still can't cross. A hill and an island below it are joined by an ordinary low bridge.</p>
    <p><b>Narrow roads.</b> A road pinched by a wedge each side of its middle holds one bridge, never two.</p>
    <p><b>Wide roads.</b> A road drawn with three lanes holds up to three bridges, so an island may have more than eight.</p>
    <p><b>Straits.</b> A dashed line across the sea with a number at its end: exactly that many bridges cross it, a double bridge counting twice.</p>
    <p><b>No loops.</b> The bridges never close a ring: walking over them you can't come back to an island without turning round. A double bridge is not a ring.</p>
    <h4>Levels</h4>
    <p>The menu's Levels are a ladder of puzzles in chapters, one new twist each. Solving a level opens the next; any open level can be played again at any time, and is kept as you left it. The first time a level is the same puzzle for everyone; after that it is a new one. Stars are for the score: one for solving it, two for a score within twice the par, three within the par.</p>
    <h4>Difficulty</h4>
    <p>A puzzle's difficulty is the hardest step it needs, never how many islands it has. <b>Easy</b>: each island's number alone, and what can't cross (an island whose links can only just carry its number takes every bridge they can; one whose other links are too few takes the rest here). <b>Medium</b>: that the islands must all be joined too (a group with all its bridges can't be left on its own, so no bridge may shut one off). <b>Hard</b>: a trial as well, a link supposed to have at most so many bridges and followed until a rule breaks. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size, difficulty and twist. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A plain 9×9 at Medium, the same for everyone. Its first solve counts the moment the bridges are the answer, and is Bridges' figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// the menu: Play (a new puzzle, clearing the board, the rules), Content (Levels or Free play; in Levels the ladder, in Free play
// random or today's, the size, the difficulty, the twist), About
let pick = null;                                              // what New puzzle starts in Free play: "random" or "daily"
/** The levels, three to a row under their chapter: each its chart in miniature, its number and name and the stars won. Those not open yet are dimmed; any open one can be played at any time, as it was left. */
function levelList() {
  const all = document.createElement("div");
  all.className = "brg-levels";
  CHAPTERS.forEach((ch, c) => {
    const head = document.createElement("h3"), grid = document.createElement("div"), to = CHAPTERS[c + 1]?.from ?? COUNT;
    head.className = "brg-chap";
    head.textContent = ch.name;
    grid.className = "brg-lgrid";
    for (let n = ch.from; n < to; n++) {
      const L = LADDER[n], won = camp.stars[n], b = document.createElement("button"), map = document.createElement("div"), row = document.createElement("div"),
        num = document.createElement("b"), stars = document.createElement("span"), name = document.createElement("div"), size = document.createElement("div");
      b.type = "button";
      b.disabled = !isOpen(n);
      b.className = won ? "done" : "";
      if (n === camp.at && track === "levels") b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Level ${n + 1}, ${L.name}${won ? `, ${plural(won, "star")}` : ""}${b.disabled ? ", not open yet" : ""}`);
      map.className = "brg-lmap";
      map.innerHTML = miniature(L.size, L.twist, seedOf(n));
      row.className = "brg-lrow";
      num.textContent = n + 1;
      stars.textContent = isOpen(n) ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : "";
      row.append(num, stars);
      name.className = "brg-lname";
      name.textContent = L.name;
      size.className = "brg-lsize";
      size.textContent = `${L.size}×${L.size} · ${LEVELS[L.level]}`;
      b.append(map, row, name, size);
      b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
      grid.append(b);
    }
    all.append(head, grid);
  });
  return all;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (coop) {                                                  // in a party of two: one board, the way out
    const play = part(body, "play");
    play.append(action("Another puzzle", coopAnother, "primary"));
    if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
    play.append(action(prefs.view === "model" ? "Play in 2D" : "Play in 3D", () => setView(prefs.view === "model" ? "chart" : "model"), "link"), action("The rules", showRules, "link"));
    part(body, "together").append(line(`Co-op with ${coop.otherName}: one board for you both. If you both change one link at once, the later change stands.`), action(coop.host ? "End the co-op" : "Leave the co-op", () => coop.leave(), "link"));
    part(body, "about").append(line(S ? `${kindText({ size: S.size, level: S.came || S.level, twist: S.twist })}: ${S.done ? "solved" : "not solved yet"}.` : "Join the islands."));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  if (duel.on) {                                                // at a table: the match, the rules, the next match's difficulty
    const play = part(body, "play"), m = duel.match;
    play.append(action(prefs.view === "model" ? "Play in 2D" : "Play in 3D", () => setView(prefs.view === "model" ? "chart" : "model"), "link"), action("The rules", showRules, "link"));
    duel.menu(part(body, "together"));
    const content = part(body, "content");
    content.append(mirror("Next match: difficulty", $("level")));
    if (m) content.append(line(`This match: ${nameOf(m)}, ${m.size}×${m.size}${hasTwist(m.twist) ? ` · ${twistName(m.twist)}` : ""}.`));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const levels = track === "levels", content = part(body, "content"), play = part(body, "play");
  pick ??= S?.mode === "daily" ? "daily" : "random";
  play.append(action("New puzzle", () => (levels ? confirmLevelBlock() : confirmStart(pick)), "primary"));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action(prefs.view === "model" ? "Play in 2D" : "Play in 3D", () => setView(prefs.view === "model" ? "chart" : "model"), "link"));
  play.append(action("The rules", showRules, "link"));
  content.append(choice("Play", [["levels", "Levels"], ["free", "Free play"]], track, v => { setTrack(v); openMenu(); }));
  if (levels) content.append(levelList());
  else {
    content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
    if (pick === "random") {
      content.append(choice("Size", SIZES.map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
      content.append(mirror("Difficulty", $("level")));
      content.append(choice("Twist", Object.entries(TWISTS), prefs.twist, v => { prefs.twist = v; savePrefs(); kindChanged(); openMenu(); }));
    } else content.append(line(`Today's puzzle is ${kindText(DAILY)}: the same for everyone.`));
  }
  const about = part(body, "about");
  if (levels) {
    const solved = camp.stars.filter(Boolean).length;
    about.append(line(`${solved} of ${COUNT} levels solved, ${plural(camp.stars.reduce((a, b) => a + b, 0), "star")}. Three stars within the par, two within twice it.`));
  } else {
    const best = S && !isLevel(S) ? bestOf(S) : null;
    about.append(line(S && !isLevel(S) ? `${kindText({ size: S.size, level: S.came || S.level, twist: S.twist })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Join the islands."));
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
/** The size changed in the menu: the header's level follows, and a spare is made ready. */
function kindChanged() {
  const k = chosenKind();
  $("level").value = k.level;
  refill(k);
}
async function clearBoard() {
  if (!S || S.done) return;
  if (!(await sure(coop ? "Clear every bridge on the board? It clears it for both of you." : "Clear every bridge on the board?", { yes: "Clear" })) || !S || S.done) return;
  if (coop) {
    const laid = Array.from(S.marks, (m, l) => [l, m]).filter(([, m]) => m !== "0");
    for (const [l, m] of laid) S.undo.push([l, m, "0"]);
    S.redo = [];
    S.lit = null;
    coop.edit(laid.map(([l, m]) => cellEdit("marks", l, m, "0")));
    changed();
    return;
  }
  for (let l = 0; l < S.marks.length; l++) if (S.marks[l] !== "0") setLink(l, S.marks[l], "0");
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- links: #s=SEED&n=9&l=medium&t=ranges (#d= for a day's; t only with a twist), #lv=LEVEL&s=SEED for a level's ----------
const hashOf = s => (isLevel(s) ? `#lv=${s.lv}&s=${s.seed}` : `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}${hasTwist(s.twist) ? `&t=${twistOn(s.twist)}` : ""}`);
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  if (h.has("lv")) {                                           // a level's: only if it is open
    const lv = Number(h.get("lv"));
    return Number.isInteger(lv) && lv >= 0 && lv < COUNT && isOpen(lv) ? { seed, mode: "level", lv, k: kindOf(lv) } : null;
  }
  const size = SIZES.includes(Number(h.get("n"))) ? Number(h.get("n")) : 9;
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium"), twist: h.get("d") ? "none" : twistOn(h.get("t") || "none") } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle, isLevel(l) ? { lv: l.lv } : {}));
}
const sameBlock = (a, l) => !!a && a.seed === l.seed && a.mode === l.mode && (isLevel(l) ? a.lv === l.lv : a.size === l.k.size);

// ---------- together: a race (duel.js) ----------
// Everyone at the table gets the same puzzle and plays it on their own phone; the lowest score wins, which is the solo score
// (seconds plus 30 a hint). The match is a recipe taken from a ladder level at the difficulty chosen, picked by the match's
// seed (bridges-race.js), so every twist comes round; the phone that deals makes the puzzle and puts it in the match.
const duel = createDuel({
  game: "bridges", name: "Bridges", accent: "--brg-in", line: $("duelLine"), toast, lower: true,
  deal: dealMatch,
  describe: m => `A race on ${nameOf(m)}${hasTwist(m.twist) ? ` (${twistName(m.twist)})` : ""}, ${LEVELS[m.came] || LEVELS[m.level]}: the same puzzle for everyone, the fastest solve wins`,
  play: (match, { begun, kept }) => { if (matchValid(match)) playRace(match, begun, kept); else toast("This match is from a newer Bridges: update the page."); },
  onLobby: match => { S = null; P = null; svg = null; $("level").value = LEVELS[match.level] ? match.level : "easy"; render(); },
  onLeave: () => { clearTimeout(tellTimer); tellTimer = 0; solo(); },
});
/** The match the table plays next: a level of the ladder at the chosen difficulty, its puzzle made here. */
async function dealMatch() {
  const pick = randomSeed(), lv = raceLevel(prefs.level, pick), { seed, puzzle } = await nextPuzzle(kindOf(lv));
  if (!puzzle) throw new Error("bridges: no puzzle for the match");
  return { pick, ...matchOf(seed, lv, puzzle) };
}
function playRace(match, begun, kept) {
  const same = valid(kept) && kept.seed === match.seed && kept.grid === match.grid;
  begin({ ...(same ? kept : fromPuzzle("duel", match.seed, match, { ...match, level: match.came })), mode: "duel", begun });
  tell(!!S.done);
}
/** What the table sees of this run: how much of the answer is laid, and the score once it is solved. */
function tell(done = false) {
  if (!racing() || !duel.on) return;
  if (done) duel.report({ score: S.done.score, text: fmt(S.done.score), done: true, ms: S.done.ms });
  else duel.report(reportOf(S.sol, S.marks));
}
let tellTimer = 0;
function tellSoon() {   // a report for every tap would be a write for every tap
  if (!racing() || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (racing() && !S.done) tell(); }, 1500);
}

// ---------- together: one board for two (coop-page.js, docs/coop.md) ----------
/** The shared board for a run: the host's puzzle as it is, or a new one. */
const shareOf = run => shareRun({ v: 1, ms: 0, hints: 0, ...run });
/** The board of a party of two: the room's, drawn each time it moves. */
function showBoard(board, info) {
  const run = coopOf.run(board), wasDone = !!S?.done;
  team = board.start || team;
  coopHost = info.host;
  if (info.fresh || !S) {                                       // a board not drawn before: its puzzle on the screen
    S = { undo: [], redo: [], ms: 0, lit: null, ...run };
    P = puzzleFor(S);
    message = null; sentDone = false;
    $("level").value = levelOn(S.size, S.level);
    drawBoard();
  } else { S.marks = run.marks; S.hints = run.hints; S.done = run.done; }
  if (S.done) S.lit = null;
  else if (solvedBy(P, S.marks)) finishTogether();
  if (S.done && !wasDone && !info.fresh) wave();
  save();
  paint();
  render();
}
/** Another puzzle for both of you, of the same kind as this one (a level's recipe, or the free puzzle's size, difficulty and twist). */
async function coopAnother() {
  if (!coop || !S) return;
  if (started() && !(await sure("Start a new puzzle for both of you? This one isn't solved.", { yes: "New puzzle" }))) return;
  const k = { size: S.size, level: S.level, twist: S.twist }, { seed, puzzle } = await nextPuzzle(k);
  if (puzzle) await coop.renew(shareOf(fromPuzzle(isLevel(S) ? "level" : "random", seed, k, puzzle, isLevel(S) ? { lv: S.lv } : {})));
}
async function joinPartner() {
  const { startCoop } = await import("./coop-page.js");
  coop = await startCoop("bridges", {
    toast, show: showBoard,
    fresh: async () => { const k = chosenKind(), { seed, puzzle } = await nextPuzzle(k); return shareOf(fromPuzzle("random", seed, k, puzzle)); },
    bar: el => { $("kind").hidden = true; $("kind").after(el); },
  });
  if (!coop && !IN_FRAME) solo();
}

// ---------- wiring ----------
const levelDropdown = dropdown($("level"));   // the header dropdown in the suite's style (see dropdown.js)
bindSwitcher($("appsBtn"), "bridges");
document.querySelector(".brg-mark").innerHTML = APPS.find(a => a.id === "bridges")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("levelBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => {
  if (racing()) duel.open();
  else if (coop) coopAnother();
  else if (isLevel(S) && camp.stars[S.lv] < 1) levelBlock(S.lv, true);      // a level solved with a partner: a new puzzle of it, to play alone for its stars
  else if (isLevel(S)) { if (S.lv + 1 < COUNT && isOpen(S.lv + 1)) playLevel(S.lv + 1); else openMenu(); }
  else start("random");
});
$("level").addEventListener("change", async () => {
  const v = $("level").value;
  if (duel.on) {                                                 // a new match at that difficulty, for everyone at the table
    prefs.level = v; savePrefs();
    if (!duel.newMatch()) $("level").value = duel.match?.level || v;
    return;
  }
  if (S && S.mode !== "daily" && v === S.level && S.size === prefs.size) return;
  const before = prefs.level;
  prefs.level = v; savePrefs();
  if (!(await confirmStart("random"))) { prefs.level = before; savePrefs(); $("level").value = S ? levelOn(S.size, S.level) : before; }
});
$("viewBtn").addEventListener("click", () => setView(prefs.view === "model" ? "chart" : "model"));
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); coop?.together.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { if (duel.on || COOP) return; const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode && (!isLevel(l) || S.lv === l.lv))) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__bridges = {
  get duel() { return duel; }, get coop() { return coop; }, get state() { return S; }, get model() { return model; }, setView, get puzzle() { return P; }, get camp() { return camp; }, get track() { return track; }, press, useHint, undo, redo, start, playLevel, setTrack, linkAt,
  /** Where a link's middle is on the screen, for tests that tap it as a finger would. */
  screenOf: l => {
    const m = svg.getScreenCTM(), { x1, y1, x2, y2 } = seg[l], x = (x1 + x2) / 2, y = (y1 + y2) / 2;
    return { x: x * m.a + m.e, y: y * m.d + m.f };
  },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
async function solo() {
  S = null;
  const kept = savedGame(), l = linked();
  if (l && !sameBlock(kept, l)) { openLinked(l); return; }
  if (forToday && !IN_FRAME) {                               // today's is a free puzzle: the one in hand, if it is today's, else a new one after asking about the one begun
    const free = read(RUN, null), mine = valid(free) && !isLevel(free) ? free : null;
    if (mine?.mode === "daily" && mine.seed === today()) { begin(mine); refill(chosenKind()); return; }
    if (!startedRun(mine) || (await sure("Today's puzzle is waiting. Leave the one you've started?", { yes: "Leave it" }))) { start("daily"); return; }
  }
  if (IN_FRAME) { if (kept) begin(kept); else render(); return; }
  await resume();
}
$("level").value = chosenKind().level;
// a match in the address: its table, with no solo puzzle made under it
if (COOP) joinPartner().catch(e => { console.error(e); solo(); });
else if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });
else solo();
if (prefs.view === "model") setView("model", false);
