// Nonogram: a picture hidden in a grid, the runs of each row and column its clues. The pictures are the knowledge
// base's (a country's outline, a flag in colour, a lake), each a puzzle with exactly one answer that reasoning reaches
// (nonogram-pictures.js, nonogram-engine.js), on squares or on a hexagon of hexes (nonogram-hex.js), where every cell
// has three lines; nonogram-board.js draws the one, nonogram-hexboard.js the other. This file keeps the run, the clock
// and the strokes, names the picture, plays the computer (a partner with half the clues, or a rival on its own copy)
// and plays together on duel.js: a race on the same picture, or the clues split between you on one grid.
import { cellAt, withCell, emptyGrid, EMPTY, CROSS, agrees, drawn, wrongCells, knownFrom, nextStep, scoreOf, creditFor, ownerOf, MISTAKE, HINT, WRONG_NAME, CREDIT } from "./nonogram-engine.js";
import { PICTURES, TOPICS, REGIONS, BANDS, SIZES, DAILY, puzzleOf, pictureOf, dealPicture, dailyPicture, namesOf, askOf, poolOf, madeAlready, remember } from "./nonogram-pictures.js";
import { hexGrid, hexOwner, lineName } from "./nonogram-hex.js";
import { PACES, createMind, botMove } from "./nonogram-bot.js";
import { createBoard, HOLD_SECOND } from "./nonogram-board.js";
import { createHexBoard } from "./nonogram-hexboard.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, toggle, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo } from "./suite.js";
import { createDuel } from "./duel.js";
import { busy } from "./loading.js";
import { branchPath } from "./rooms.js";
import { check as checkTyped, normalize } from "./typing.js";
import * as pile from "./pile.js";

dropdown(document.getElementById("size"));

const $ = id => document.getElementById(id);
const RUN = "nonogram:run", SETTINGS = "nonogram:settings", TIMES = "nonogram:times", SEEN = "nonogram:seen", STATS = "nonogram:stats";
const SAVE_EVERY = 5000;                 // ms between saves of a picture in play (a partner watching sees it that often)
const SEEN_KEEP = 80;                    // pictures remembered as dealt lately, so they don't come round again soon
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05), a minus before a score below nothing. */
const fmt = secs => { const neg = secs < 0, s = Math.abs(Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return `${neg ? "−" : ""}${h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`}`; };
const TOPIC_ONE = { countries: "country", flags: "flag", lakes: "lake" };
const S3 = Math.sqrt(3);

// ---------- settings (the menu's) ----------
const DEFAULTS = { topic: "countries", region: "world", band: "any", grid: "square", nameIt: true, mistakes: "shown", computer: "off", pace: "medium", together: "split" };
const settings = { ...DEFAULTS, ...read(SETTINGS, {}) };
if (!TOPICS[settings.topic] && settings.topic !== "all") settings.topic = DEFAULTS.topic;
if (!REGIONS.some(([id]) => id === settings.region)) settings.region = DEFAULTS.region;
if (!BANDS[settings.band] && settings.band !== "any") settings.band = "any";
if (settings.grid !== "hex") settings.grid = "square";
if (!PACES[settings.pace]) settings.pace = "medium";
const saveSettings = () => { if (!IN_FRAME) write(SETTINGS, settings); };
const GRIDS = [["square", "Squares"], ["hex", "Hexes"]];
// a flag is a rectangle and stays on squares: on hexes the menu's flags are countries, and back on squares flags again
const topicNow = () => (settings.grid === "hex" && settings.topic === "flags" ? "countries" : settings.topic);
const topicChoices = () => [...Object.entries(TOPICS).filter(([k]) => !(settings.grid === "hex" && k === "flags")), ["all", "All"]];

// ---------- the game on the board ----------
// S: { v, id (the picture), size, hex (on hexes), mode ("random" | "daily" | "duel"), day, play ("solo" | "split" |
// "race"), grid, undo, redo (strokes: [[cell, before, after]…]), ms, mistakes, hints, name ({ typed, right, early,
// credit, hidden } once named), done, score, fresh (a new best), rules ({ mistakes, nameIt, computer, pace }: as it was
// dealt), rival ({ grid, done, ms }: the computer's own copy) }
let S = null, P = null, pic = null;
let tool = 1;                             // the colour that fills (1… for a flag's colours), or CROSS
let clockFrom = null, savedAt = 0, message = null, paused = false, hintCells = [], hintLine = null;
let stroke = null;                        // { action, orig: Map(cell → value before), stopped, at, held: [cell, value] (a mistake not yet counted), timer }
const handlers = { onStroke, onLine, onZoom: () => drawZoom() };
const boards = { square: createBoard($("board"), handlers), hex: createHexBoard($("hexBoard"), handlers) };
let board = boards.square;
/** The board a puzzle is drawn on, the square grid's or the hexagon's; the other is put away. */
function useBoard(hex) {
  const next = hex ? boards.hex : boards.square;
  if (board !== next) { board.set(null, ""); board = next; }
  $("board").hidden = hex; $("hexBoard").hidden = !hex;
}
/** A line's name, for a hint or a partner pointing at it. */
const lineLabel = k => (P.hex ? lineName(P.R, k) : k < P.h ? `row ${k + 1}` : `column ${k - P.h + 1}`);
/** With the computer as partner, the lines it reads: the columns, or on hexes every other line of each direction. */
const computerReads = k => (P.hex ? hexOwner(P.R, k, [0, 1]) === 1 : k >= P.h);

const rules = () => S?.rules || { mistakes: settings.mistakes, nameIt: settings.nameIt, computer: "off", pace: settings.pace };
const checked = () => rules().mistakes === "shown";
const splitWithComputer = () => S?.play === "split" && S.mode !== "duel";

// ---------- the clock ----------
// A solo picture counts the time spent on screen (S.ms); a match's counts from when the table started it (duel.js).
function clockRun() {
  if (IN_FRAME || !S || S.mode === "duel" || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); botSleep(); }, () => { paused = false; clockRun(); botWake(); });
const elapsed = () => (!S ? 0 : S.done ? S.ms : S.mode === "duel" ? Math.max(0, duel.now() - (S.begun || duel.now())) : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));

// ---------- keeping ----------
function save() {
  if (IN_FRAME || !S) return;
  if (S.mode === "duel") duel.keep(S); else write(RUN, S);
  savedAt = performance.now();
}
const valid = s => !!s && s.v === 1 && !!pictureOf(s.id) && !!SIZES[s.size] && typeof s.grid === "string" && Array.isArray(s.undo) && Number.isFinite(s.ms);
const started = () => !!S && S.mode !== "duel" && !S.done && (/[^.]/.test(S.grid) || S.hints > 0);
const bestKey = () => `${pic.topic}:${S.size}${S.hex ? ":hex" : ""}`;
/** A finished picture's score as the best of its kind and size (lowest wins); true if it's a new best. In
 *  nonogram:times, not nonogram:best, which the games screen would read as highest-wins. */
function recordBest(score) {
  const times = read(TIMES, {}), k = bestKey(), fresh = times[k] == null || score < times[k];
  if (fresh) { times[k] = score; write(TIMES, times); }
  return fresh;
}
function noteSeen(id) {
  const seen = read(SEEN, []).filter(x => x !== id);
  seen.unshift(id);
  write(SEEN, seen.slice(0, SEEN_KEEP));
}
function bump(field) { const st = read(STATS, {}); st[field] = (st[field] || 0) + 1; write(STATS, st); }

// ---------- starting ----------
const hashFor = s => (s.mode === "daily" ? `#d=${s.day}` : `#p=${s.id}&z=${s.size}${s.hex ? "&g=hex" : ""}`);
/**
 * A picture's puzzle, made with the rete showing when it isn't made yet: a sparse Large picture can take a moment, and
 * the page should say so rather than freeze. The yield lets the rete draw before the work starts.
 */
async function made(id, size, hex = false, label = "Drawing the picture") {
  const grid = hex ? "hex" : "square";
  if (madeAlready(id, size, grid)) return puzzleOf(id, size, grid);
  const done = busy(label, { delay: 0 });
  await new Promise(res => setTimeout(res, 30));
  try { return puzzleOf(id, size, grid); } finally { done(); }
}
let beginning = 0;                                                // the latest begin; an older one still making its picture gives way
/** Puts a picture on the board: `s` { id, size, hex?, mode, day?, play? }; `run` what is kept of it (else fresh). True
 *  once it's there; false if the picture makes no puzzle at that size; null if a later begin took its place. */
async function begin(s, run = null, at = {}) {
  const mine = ++beginning, pz = await made(s.id, s.size, !!s.hex);
  if (mine !== beginning) return null;
  if (!pz) { toast(`That picture can't be drawn at this size${s.hex ? " on hexes" : ""}`); return false; }
  P = pz; pic = pictureOf(s.id);
  const r = rules();
  S = run || { v: 1, id: s.id, size: s.size, hex: !!s.hex, mode: s.mode, day: s.day ?? null, play: s.play || "solo", grid: emptyGrid(P), undo: [], redo: [], ms: 0, mistakes: 0, hints: 0,
    name: null, done: false, rules: s.rules || { ...r }, rival: null };
  Object.assign(S, at);
  if (S.rules.computer === "rival" && !S.rival && S.mode !== "duel") S.rival = { grid: emptyGrid(P), done: false, ms: 0 };
  tool = P.colours > 1 ? Math.min(tool > 0 ? tool : 1, P.colours) : tool === CROSS ? CROSS : 1;
  message = null; hintCells = []; hintLine = null; stroke = null; clockFrom = null;
  $("size").value = S.size;
  useBoard(!!P.hex);
  board.set(P, S.grid, boardExtras());
  if (S.done) board.reveal(true);
  if (S.mode !== "duel" && !IN_FRAME) history.replaceState(null, "", hashFor(S));
  buildTools();
  save();
  clockRun();
  botStart();
  render();
  prepare();
  return true;
}
const DAILY_RULES = { mistakes: "shown", nameIt: true, computer: "off", pace: "medium" };
/** A new picture: today's, or one dealt from the menu's choices (learning mode first offering what's due again). */
async function start(mode = "random", size = $("size").value) {
  if (mode === "daily") {
    const day = today(), done = busy("Drawing today's picture");
    await new Promise(res => setTimeout(res, 30));
    const id = dailyPicture(day);
    done();
    if (!id) { toast("No picture for today"); return; }
    await begin({ id, size: DAILY.size, mode: "daily", day, rules: DAILY_RULES });
    return;
  }
  const got = await nextPick(size);
  if (!got) { toast("Nothing to draw there at this size: try another region or size"); return; }
  noteSeen(got.id);
  const computer = settings.computer, play = computer === "partner" ? "split" : "solo";
  if (await begin({ id: got.id, size, hex: settings.grid === "hex", mode: "random", play, rules: { mistakes: settings.mistakes, nameIt: settings.nameIt, computer, pace: settings.pace } }) && got.nearest)
    note(`No ${BANDS[settings.band].toLowerCase()} picture here at this size: this is the nearest.`);
}
// The next random picture is dealt (and its puzzle made) while you play this one, so Next is instant; it's dealt
// again if the choices it was dealt for have changed by then.
let upcoming = null;                                              // { key, got }
const dealKey = size => JSON.stringify([topicNow(), settings.region, settings.band, settings.grid, size, pile.learning()]);
function dealNow(size) {
  const seen = read(SEEN, []), prefer = pile.learning() ? learningPicks() : [];
  return dealPicture({ topic: topicNow(), region: settings.region, size, band: settings.band, grid: settings.grid, seen, prefer });
}
async function nextPick(size) {
  const key = dealKey(size);
  if (upcoming?.key === key && upcoming.got && upcoming.got.id !== S?.id) { const got = upcoming.got; upcoming = null; return got; }
  const done = busy("Drawing the picture");
  await new Promise(res => setTimeout(res, 30));
  try { return dealNow(size); } finally { done(); }
}
let maker = null, asked = 0;
function prepare() {
  if (IN_FRAME || duel.on) return;
  const size = $("size").value, key = dealKey(size);
  if (upcoming?.key === key) return;
  const args = { topic: topicNow(), region: settings.region, size, band: settings.band, grid: settings.grid, seen: [S?.id, ...read(SEEN, [])].filter(Boolean), prefer: pile.learning() ? learningPicks() : [] };
  try {
    maker ??= new Worker(new URL("./nonogram-worker.js", import.meta.url), { type: "module" });
    const n = ++asked;
    maker.onmessage = ({ data }) => {
      if (data.n !== asked || dealKey($("size").value) !== key) return;
      if (data.puzzle) remember(data.puzzle);
      upcoming = { key, got: data.got };
    };
    maker.postMessage({ n, args });
  } catch (e) {                                                   // no module workers here: on the page, when it's idle
    console.warn("Nonogram: no worker", e);
    setTimeout(() => { if (!duel.on && dealKey($("size").value) === key) upcoming = { key, got: dealNow(size) }; }, 2500);
  }
}
/** Learning mode's picks: pictures you couldn't name, due again; then those about what other games found you weak on. */
function learningPicks() {
  const due = pile.due("nonogram").map(it => it.key).filter(id => pictureOf(id));
  const weak = pile.weakElsewhere("nonogram");
  const cross = PICTURES.filter(p => weak.has(p.about) && !due.includes(p.id)).sort((a, b) => weak.get(b.about) - weak.get(a.about)).map(p => p.id);
  return [...due, ...cross.slice(0, 5)];
}

// ---------- strokes ----------
/** What a stroke does to a cell as it is: its new value, or null if it leaves the cell alone. A fill never covers a
 *  cell crossed out (they guard what you're sure of), and the first cell decides whether a stroke fills or clears. */
function target(action, v) {
  if (action.kind === "fill") return v === EMPTY || (v > 0 && v !== action.colour) ? action.colour : null;
  if (action.kind === "clear") return v === action.colour ? EMPTY : null;
  if (action.kind === "cross") return v === EMPTY ? CROSS : null;
  return v === CROSS ? EMPTY : null;                               // uncross
}
/** Whether putting v in cell i goes against the answer (only filling or crossing can). */
const isMistake = (i, v) => (v > 0 ? P.answer[i] !== v : v === CROSS ? P.answer[i] !== 0 : false);
function onStroke(phase, cells, { button } = {}) {
  if (!S || S.done || IN_FRAME || paused || !P || board.revealed) return;
  if (phase === "start") {
    const v = cellAt(S.grid, cells[0]), cross = button === 2 || tool === CROSS;
    const action = cross ? { kind: v === CROSS ? "uncross" : "cross" } : { kind: v === tool ? "clear" : "fill", colour: tool };
    stroke = { action, orig: new Map(), stopped: false, at: performance.now(), held: null, timer: 0 };
    hintCells = []; hintLine = null;
    paint(cells);
  } else if (!stroke) return;
  else if (phase === "move") paint(cells);
  else if (phase === "end") { countHeld(); endStroke(); }
  else cancelStroke();
}
function paint(cells) {
  const want = new Set(cells);
  for (const [i, before] of [...stroke.orig]) if (!want.has(i)) { setCell(i, before); stroke.orig.delete(i); }   // the finger came back
  if (!stroke.stopped) for (const i of cells) {
    if (stroke.orig.has(i)) continue;
    const v = cellAt(S.grid, i), next = target(stroke.action, v);
    if (next == null) continue;
    if (checked() && isMistake(i, next)) {
      stroke.stopped = true;
      // the first finger of a pinch lands on a cell too: a mistake that soon waits to see if a second finger follows
      const soon = HOLD_SECOND - (performance.now() - stroke.at);
      if (soon > 0) { const s = stroke; s.held = [i, next]; s.timer = setTimeout(() => { if (stroke === s) countHeld(); }, soon); }
      else mistake(i, next);
      break;
    }
    stroke.orig.set(i, v);
    setCell(i, next);
  }
  board.update(S.grid, boardExtras());
}
/** A mistake held back at a stroke's start, counted now the stroke is sure. */
function countHeld() {
  if (!stroke?.held) return;
  const [i, v] = stroke.held;
  stroke.held = null; clearTimeout(stroke.timer);
  mistake(i, v);
  board.update(S.grid, boardExtras());
}
function endStroke() {
  const changes = [...stroke.orig].map(([i, before]) => [i, before, cellAt(S.grid, i)]).filter(([, b, a]) => b !== a);
  stroke = null;
  if (changes.length) { S.undo.push(changes); if (S.undo.length > 300) S.undo.shift(); S.redo = []; }
  changed();
}
function cancelStroke() {
  clearTimeout(stroke.timer);
  for (const [i, before] of stroke.orig) setCell(i, before);
  stroke = null;
  board.update(S.grid, boardExtras());
  render();
}
/** A mistake, where they're shown: the cell takes what it really is, the clock 20 seconds. */
function mistake(i, tried) {
  const truth = P.answer[i] || CROSS;
  setCell(i, truth);
  S.mistakes++;
  if (S.play === "split" && S.mode === "duel") split.penalty();
  board.flash(i);
  navigator.vibrate?.(60);
  note(tried === CROSS ? `That cell is filled: +${MISTAKE} s.` : truth === CROSS ? `That cell is blank: +${MISTAKE} s.` : `That cell is ${P.names?.[truth] || "another colour"}: +${MISTAKE} s.`, "bad");
}
/** Sets one cell of the grid (and of the shared grid in a split match). */
function setCell(i, v) {
  S.grid = withCell(S.grid, i, v);
  if (S.mode === "duel" && S.play === "split") split.write(i, v);
}
function undo() {
  if (!S || S.done || IN_FRAME || !S.undo.length) return;
  const changes = S.undo.pop(), back = [];
  for (const [i, before, after] of changes) if (cellAt(S.grid, i) === after) { setCell(i, before); back.push([i, before, after]); }
  if (back.length) S.redo.push(back);
  hintCells = []; hintLine = null;
  changed(false);
}
function redo() {
  if (!S || S.done || IN_FRAME || !S.redo.length) return;
  const changes = S.redo.pop(), again = [];
  for (const [i, before, after] of changes) if (cellAt(S.grid, i) === before) { setCell(i, after); again.push([i, before, after]); }
  if (again.length) S.undo.push(again);
  changed(false);
}
/** The grid changed: drawn, kept, the end settled the moment the last cell is right, the computer woken. */
function changed(clearMessage = true) {
  if (clearMessage && message?.tone !== "bad") message = null;
  board.update(S.grid, boardExtras());
  if (!S.done && complete()) finish();
  else { save(); tellSoon(); botWake(); }
  render();
}
/** Done: every filled cell of the picture filled, where mistakes are shown (so nothing wrong stands); otherwise, as on
 *  paper, every row and column agreeing with its clue. */
const complete = () => (checked() ? drawn(S.grid, P.answer) === 1 : agrees(P, S.grid));

// ---------- hints ----------
/** A hint: the next cell the clues force, the simplest way a person would see it, filled in (or crossed out) and its
 *  line named. Where mistakes are hidden and one stands, the hint points it out instead. */
function useHint() {
  if (!S || S.done || IN_FRAME || paused || board.revealed) return;
  if (!checked()) {
    const wrong = wrongCells(S.grid, P.answer);
    if (wrong.length) {
      S.hints++;
      if (S.mode === "duel" && S.play === "split") split.penalty();
      hintCells = [wrong[0]];
      note(`Hint: the ringed cell is wrong (+${HINT} s).`, "good");
      changed(false);
      return;
    }
  }
  const st = knownFrom(P, S.grid, P.answer), allow = S.play === "split" ? myLine : null;
  let step = nextStep(P, st, allow);
  if (!step && allow) step = nextStep(P, knownFrom(P, S.grid, P.answer));     // your lines say no more: theirs do
  if (!step) { note("The clues tell no more than you've drawn."); return; }
  const [i, c] = step.cells[0];
  S.hints++;
  if (S.mode === "duel" && S.play === "split") split.penalty();
  setCell(i, c || CROSS);
  hintCells = [i];
  hintLine = P.hex && step.rule !== "contradiction" ? step.line : null;            // a slant is easier lit than named
  // a clash comes from the lines through the cell together, so it names none
  const why = step.rule === "contradiction" ? ": anything else there leads to a clash"
    : `, from ${lineLabel(step.line)}: ${!P.clues[step.line].length ? "its clue is 0, so none of it is filled" : step.rule === "simple" ? "its runs pushed both ways overlap there" : "every way its runs can lie agrees"}`;
  note(`Hint (+${HINT} s): ${c ? "filled" : "blank"}${why}.`, "good");
  changed(false);
}

// ---------- the end ----------
function finish() {
  message = null; hintCells = []; hintLine = null;
  if (S.mode === "duel") { (S.play === "split" ? split.finished : race.finished)(); return; }
  if (clockFrom != null) { S.ms += performance.now() - clockFrom; clockFrom = null; }
  S.done = true;
  S.score = scoreOf(S);
  botSleep();
  const counts = S.rules.computer !== "partner";                  // with the computer drawing half, the time isn't yours alone
  if (counts) S.fresh = recordBest(S.score);
  if (S.mode === "daily") noteDayTime("nonogram", S.score, S.day); // today's: the first finish counts
  bump("solved");
  save();
  board.reveal();
  render();
  if (S.rules.nameIt && !S.name) setTimeout(() => { if (S?.done && !S.name) openName(true); }, 1150);
}

// ---------- naming it ----------
const NAME_TOPIC_NAMES = new Map();
function namesFor(topic) {                                        // every name a picture of this kind goes by, for the list
  if (!NAME_TOPIC_NAMES.has(topic)) NAME_TOPIC_NAMES.set(topic, [...new Set(PICTURES.filter(p => p.topic === topic).flatMap(p => [p.name]))].sort((a, b) => a.localeCompare(b)));
  return NAME_TOPIC_NAMES.get(topic);
}
let naming = null;                                                 // { final }
function openName(final = false) {
  if (!S || !pic || S.name || IN_FRAME || !rules().nameIt) return;
  if (S.mode === "duel" && S.play === "split" && split.named()) return;
  naming = { final };
  const hidden = 1 - drawn(S.grid, P.answer), credit = creditFor(S.size, hidden);
  $("nameHead").textContent = final ? "What is it?" : "Name it";
  $("nameAsk").textContent = final ? askOf(pic.topic) : `${askOf(pic.topic)} Right now takes ${credit} s off; wrong adds ${WRONG_NAME} s. One go.`;
  $("nameNote").textContent = ""; $("nameNote").className = "ng-name-note";
  $("nameSkip").textContent = final ? "I don't know" : "Not yet";
  $("nameInput").value = "";
  $("nameInput").disabled = false; $("nameGo").disabled = false;
  drawPicture($("namePic"), final);
  listNames("");
  if (!$("nameDlg").open) $("nameDlg").showModal();
  $("nameInput").focus();
}
function listNames(typed) {
  const t = normalize(typed), all = namesFor(pic.topic);
  const hits = t ? all.filter(n => normalize(n).startsWith(t)).concat(all.filter(n => !normalize(n).startsWith(t) && normalize(n).includes(t))).slice(0, 8) : [];
  $("nameList").replaceChildren(...hits.map(n => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.textContent = n;
    b.addEventListener("click", () => { $("nameInput").value = n; submitName(); });
    li.append(b);
    return li;
  }));
}
function submitName() {
  if (!naming || !S || S.name) return;
  const typed = $("nameInput").value.trim();
  if (!typed) { $("nameInput").focus(); return; }
  const res = checkTyped(typed, namesOf(pic)), early = !S.done, hidden = 1 - drawn(S.grid, P.answer);
  const name = { typed, right: res.right, early, credit: early && res.right ? creditFor(S.size, hidden) : 0, hidden: Math.round(hidden * 100) / 100 };
  if (S.mode === "duel" && S.play === "split") split.name(name);
  S.name = name;
  learnt(res.right);
  const note2 = $("nameNote");
  note2.className = `ng-name-note ${res.right ? "good" : "bad"}`;
  note2.textContent = res.right ? `Right: ${pic.name}${res.exact ? "" : ` (${res.answer})`}${name.credit ? `, ${name.credit} s off` : ""}.`
    : early ? `Not that: +${WRONG_NAME} s. You'll see what it is when it's drawn.` : `It's ${pic.name}.`;
  $("nameInput").disabled = true; $("nameGo").disabled = true;
  $("nameSkip").textContent = "Close";
  if (S.done && S.mode !== "duel") { S.score = scoreOf(S); save(); }
  if (S.mode === "duel" && S.play === "race") race.tell();
  setTimeout(() => { if ($("nameDlg").open && naming) closeName(); }, res.right ? 1300 : 2400);
  save();
  render();
}
function skipName() {
  if (naming?.final && S && !S.name) {                            // don't know it: that's a miss, for the pile
    S.name = { typed: "", right: false, early: false, credit: 0, hidden: 0 };
    learnt(false);
    save();
  }
  closeName();
}
function closeName() { naming = null; if ($("nameDlg").open) $("nameDlg").close(); render(); }
/** The pile: a picture you couldn't name comes back in Deck as a question (its picture, four names to pick from) and in
 *  this game's learning mode as a picture again; one named right that was due moves up. */
function learnt(right) {
  if (IN_FRAME) return;
  if (right) { bump("named"); pile.answer("nonogram", pic.id, true); return; }
  const others = poolOf(pic.topic, pic.regions[0] || "world").filter(p => p.id !== pic.id && p.name !== pic.name);
  const picks = [];
  while (picks.length < 3 && others.length) picks.push(others.splice(Math.floor(Math.random() * others.length), 1)[0].name);
  pile.record("nonogram", pic.id, {
    ask: `Nonogram · ${TOPIC_ONE[pic.topic]}`, prompt: askOf(pic.topic), svg: svgOf(P), options: [pic.name, ...picks], right: [0],
    note: `${pic.flag ? `${pic.flag} ` : ""}${pic.name}${pic.note ? `: ${pic.note}` : "."}`, about: [pic.about],
  }, "wrong");
}
/** The finished picture as an SVG, small, for Deck: a one-colour picture in the page's ink, a flag in its colours. */
function svgOf(pz) {
  if (pz.hex) return hexSvgOf(pz);
  const rects = [];
  for (let y = 0; y < pz.h; y++) for (let x = 0; x < pz.w;) {
    const c = pz.answer[y * pz.w + x];
    let e = x + 1;
    while (e < pz.w && pz.answer[y * pz.w + e] === c) e++;
    if (c) rects.push(`<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${pz.palette ? pz.palette[c] : "currentColor"}"/>`);
    x = e;
  }
  const bg = pz.palette?.[0] ? `<rect width="${pz.w}" height="${pz.h}" fill="${pz.palette[0]}"/>` : "";
  return `<svg viewBox="-0.5 -0.5 ${pz.w + 1} ${pz.h + 1}" aria-hidden="true">${bg}${rects.join("")}<rect x="0" y="0" width="${pz.w}" height="${pz.h}" fill="none" stroke="currentColor" stroke-width="0.08" opacity=".4"/></svg>`;
}
/** A hexagon's picture for Deck: so small a hex reads as a brick (each row half a brick on from the last, as the hexes
 *  are), so a row's run of outline or of the land inside it is one rect, the land lighter. */
function hexSvgOf(pz) {
  const g = hexGrid(pz.R), R = pz.R, kind = i => (pz.answer[i] ? 1 : pz.land?.[i] ? 2 : 0), rects = [];
  for (const row of g.lines.slice(0, 2 * R + 1)) {
    for (let a = 0; a < row.length;) {
      const k = kind(row[a]);
      let b = a + 1;
      while (b < row.length && kind(row[b]) === k) b++;
      const [q, r] = g.cells[row[a]];
      if (k) rects.push(`<rect x="${(S3 * (q + r / 2 + R)).toFixed(2)}" y="${1.5 * (r + R)}" width="${(S3 * (b - a)).toFixed(2)}" height="1.5"${k === 2 ? ' opacity=".4"' : ""}/>`);
      a = b;
    }
  }
  return `<svg viewBox="-0.5 -0.5 ${(S3 * (2 * R + 1) + 1).toFixed(2)} ${3 * R + 2.5}" fill="currentColor" aria-hidden="true">${rects.join("")}</svg>`;
}
/** The picture into a small canvas: as drawn so far, or (final) as it is. */
function drawPicture(canvas, final) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth || 128, H = canvas.clientHeight || 96;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext("2d"), cs = getComputedStyle(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const ink = cs.getPropertyValue("--ink").trim(), land = cs.getPropertyValue(pic.topic === "lakes" ? "--ng-water" : "--ng-land").trim(), tile = cs.getPropertyValue("--tile").trim();
  if (P.hex) {                                                     // hexes, the outline drawn and (final) the land inside it
    const g = hexGrid(P.R), u = Math.min(W / (S3 * (2 * P.R + 1)), H / (3 * P.R + 2)), cx = W / 2, cy = H / 2;
    for (let i = 0; i < g.n; i++) {
      const [q, r] = g.cells[i], x = cx + S3 * (q + r / 2) * u, y = cy + 1.5 * r * u, v = final ? (P.answer[i] ? 1 : P.land?.[i] ? 2 : 0) : Math.max(0, cellAt(S.grid, i));
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k - Math.PI / 2; ctx[k ? "lineTo" : "moveTo"](x + Math.cos(a) * u * 1.02, y + Math.sin(a) * u * 1.02); }
      ctx.fillStyle = tile; ctx.fill();
      if (v) { ctx.fillStyle = final ? land : ink; ctx.globalAlpha = v === 2 ? 0.42 : 1; ctx.fill(); ctx.globalAlpha = 1; }
    }
    return;
  }
  const px = Math.min(W / P.w, H / P.h), x0 = (W - px * P.w) / 2, y0 = (H - px * P.h) / 2;
  ctx.fillStyle = tile; ctx.fillRect(x0, y0, px * P.w, px * P.h);
  for (let i = 0; i < P.answer.length; i++) {
    const v = final ? P.answer[i] : Math.max(0, cellAt(S.grid, i));
    const col = v ? (P.palette ? P.palette[v] : final ? land : ink) : final ? P.palette?.[0] : null;
    if (!col) continue;
    ctx.fillStyle = col; ctx.fillRect(x0 + (i % P.w) * px, y0 + Math.floor(i / P.w) * px, px + 0.3, px + 0.3);
  }
  ctx.strokeStyle = cs.getPropertyValue("--tile-edge").trim(); ctx.lineWidth = 1; ctx.strokeRect(x0 - 0.5, y0 - 0.5, px * P.w + 1, px * P.h + 1);
}

// ---------- the computer ----------
// As a partner (split with the computer): you have the rows, it has the columns (on hexes, every other line of each
// direction each), and it works from the grid you share. As a rival: it solves its own copy alongside you, at its
// pace, and the strip says how far it has got.
let bot = null;                                                   // { mind, queue, timer, stuck, rival }
function botStart() {
  botSleep();
  bot = null;
  if (!S || S.done || IN_FRAME || S.mode === "duel") return;
  const who = S.rules.computer;
  if (who === "partner") bot = { mind: createMind(P, computerReads), queue: null, timer: 0, rival: false };
  else if (who === "rival" && S.rival && !S.rival.done) bot = { mind: createMind(P), queue: null, timer: 0, rival: true };
  botWake(900);
}
function botSleep() { if (bot) { clearTimeout(bot.timer); bot.timer = 0; } }
function botWake(delay = 500) {
  if (!bot || !S || S.done || paused || document.hidden || IN_FRAME || bot.timer) return;
  bot.timer = setTimeout(botTick, bot.queue?.cells.length ? 0 : delay);
}
function botTick() {
  bot.timer = 0;
  if (!S || S.done || paused || document.hidden) return;
  const grid = () => (bot.rival ? S.rival.grid : S.grid);
  if (bot.queue?.cells.length) {                                  // drawing what it saw, a cell at a time
    const [i, c] = bot.queue.cells.shift(), ms = bot.queue.each.shift(), v = c || CROSS;
    if (cellAt(grid(), i) !== v) {
      if (bot.rival) { S.rival.grid = withCell(S.rival.grid, i, v); if (drawn(S.rival.grid, P.answer) === 1) { S.rival.done = true; S.rival.ms = elapsed(); note(`The computer has finished: ${fmt(S.rival.ms / 1000)}.`); save(); render(); return; } }
      else { setCell(i, v); board.update(S.grid, boardExtras()); if (complete()) { finish(); return; } }
    }
    save(); render();
    bot.timer = setTimeout(botTick, ms);
    return;
  }
  const mv = botMove(bot.mind, grid(), PACES[S.rules.pace] || PACES.medium);
  bot.stuck = !mv;
  bot.queue = mv;
  render();
  if (mv) bot.timer = setTimeout(botTick, mv.think);
}

// ---------- drawing the page ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
const myLine = k => (S?.play !== "split" ? true : S.mode === "duel" ? split.mine(k) : !computerReads(k));
function boardExtras() {
  const hidden = S?.play === "split" ? (k => (myLine(k) ? null : S.mode === "duel" ? split.owner(k) : 1)) : null;
  return { hidden, hint: hintCells, hintLine, locked: IN_FRAME || !!S?.done, point: S?.mode === "duel" ? split.points() : [] };
}
function drawStrip() {
  if (!S || !P) { put("clock", "0:00"); put("penalty", ""); put("drawn", ""); put("what", ""); return; }
  const n = S.name, pen = S.mode === "duel" && S.play === "split" ? split.teamPenalty()
    : MISTAKE * S.mistakes + HINT * S.hints + (n?.early ? (n.right ? -n.credit : WRONG_NAME) : 0);
  put("clock", fmt(elapsed() / 1000));
  put("penalty", pen ? `${pen > 0 ? "+" : "−"}${Math.abs(pen)} s` : "");
  $("penalty").className = pen < 0 ? "good" : "";
  put("drawn", `${Math.floor(drawn(S.grid, P.answer) * 100)}%`);
  const what = S.mode === "daily" ? "Today's" : S.mode === "duel" ? (S.play === "split" ? "Split" : "Race") : TOPIC_ONE[pic.topic];
  put("what", `${what} · ${P.hex ? `${P.n} hexes` : `${P.w} × ${P.h}`} · ${BANDS[P.band]}`);
  if (S.mode !== "duel") {                                         // the computer, as rival or partner, in the line under the strip
    const r = $("rival");
    if (S.rules.computer === "rival" && S.rival) { r.hidden = false; r.textContent = S.rival.done ? `Computer: finished in ${fmt(S.rival.ms / 1000)}` : `Computer (${PACES[S.rules.pace].label.toLowerCase()}): ${Math.floor(drawn(S.rival.grid, P.answer) * 100)}%`; }
    else if (S.rules.computer === "partner") { r.hidden = false; r.textContent = `Partner: the computer (${PACES[S.rules.pace].label.toLowerCase()}), reading ${P.hex ? "the shaded lines" : "the columns"}${bot?.stuck ? ", waiting on you" : ""}`; }
    else r.hidden = true;
  }
}
function drawLine() {
  const l = $("line");
  let text = message?.text;
  if (!text) {
    if (!S) text = "The same picture for everyone at the table.";
    else if (S.done) text = "";
    else if (S.play === "split") text = S.mode === "duel" ? split.help()
      : P.hex ? "You read the lines with numbers: fill what they tell you, and the computer works the shaded ones from what you draw."
      : "You read the rows: fill what they tell you, and the computer works its columns from what you draw.";
    else if (P.hex) text = "Tap a hex to fill it, or drag along any of its three lines: a row, or a slant either way. Cross out what's blank.";
    else if (P.colours > 1) text = "Pick a colour, then tap a cell or drag along a row or column. Runs of different colours may touch.";
    else text = "Tap a cell to fill it, or drag along a row or column. Cross out what you know is blank.";
  }
  if (l.textContent !== text) l.textContent = text;
  l.className = `ng-line${message?.tone ? ` ${message.tone}` : ""}`;
}
function drawResult() {
  const done = !!S?.done && !$("nameDlg").open;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const v = $("verdict"), head = document.createElement("b");
  head.textContent = `${pic.flag && pic.topic !== "lakes" ? `${pic.flag} ` : ""}${pic.name}`;
  v.replaceChildren(head, document.createElement("br"));
  if (S.mode === "duel") {                                         // a match: the team's time, or the way to the race's result
    const pen = S.play === "split" ? split.teamPenalty() : S.score - Math.round(S.ms / 1000);
    v.append(S.play === "split" ? `Drawn together: ${fmt(S.score)}${pen ? ` (${fmt(S.ms / 1000)} on the clock, ${pen > 0 ? "+" : "−"}${Math.abs(pen)} s)` : ""}.` : `Yours: ${fmt(S.score)}.`);
    $("nextBtn").textContent = S.play === "split" ? "Another together" : "The result";
    return;
  }
  const n = S.name, bits = [`${fmt(S.ms / 1000)} on the clock`];
  if (S.mistakes) bits.push(`${plural(S.mistakes, "mistake")} (+${MISTAKE * S.mistakes} s)`);
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${HINT * S.hints} s)`);
  if (n?.early) bits.push(n.right ? `named with ${Math.round(n.hidden * 100)}% to draw (−${n.credit} s)` : `named wrong (+${WRONG_NAME} s)`);
  const best = read(TIMES, {})[bestKey()];
  v.append(`${fmt(S.score)}: ${bits.join(", ")}.`);
  if (S.rules.computer === "rival" && S.rival) {
    const s2 = document.createElement("span"), won = !S.rival.done || S.rival.ms > S.ms;
    s2.className = won ? "good" : "bad";
    s2.textContent = won ? " You beat the computer." : ` The computer was quicker: ${fmt(S.rival.ms / 1000)}.`;
    v.append(s2);
  }
  if (n && !n.early) { const s3 = document.createElement("span"); s3.className = n.right ? "good" : "bad"; s3.textContent = n.right ? " Named." : " Not named: it'll come back."; v.append(s3); }
  if (S.rules.computer !== "partner") v.append(S.fresh ? " A new best." : best != null ? ` Best ${fmt(best)}.` : "");
  $("nextBtn").textContent = S.mode === "daily" ? "A random picture" : "Next picture";
}
function drawZoom() {
  const b = $("zoomBtn"), on = !!P && (board.small || board.zoomed) && !S?.done;   // pinched in, there's a way back out
  b.hidden = !on;
  b.classList.toggle("hex", !!P?.hex);
  if (!on) return;
  const z = board.zoomed;
  b.setAttribute("aria-label", z ? "Zoom out" : "Zoom in");
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6${z ? "" : "M10.5 7.5v6"}"/></svg>`;
}
function buildTools() {
  const box = $("tools");
  box.replaceChildren();
  if (!P) return;
  const mk = (value, label, swatch) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ng-tool"; b.dataset.tool = String(value);
    if (swatch) { const s = document.createElement("span"); s.className = "ng-swatch"; s.style.background = swatch; b.append(s); }
    else if (value === CROSS) b.insertAdjacentHTML("beforeend", '<svg class="ng-cross" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>');
    else { const s = document.createElement("span"); s.className = "ng-swatch"; s.style.background = "var(--ink)"; b.append(s); }
    if (label) b.append(label);
    b.setAttribute("aria-label", value === CROSS ? "Cross out" : P.names?.[value] ? `Fill ${P.names[value]}` : "Fill");
    b.addEventListener("click", () => { tool = value; render(); });
    box.append(b);
  };
  if (P.colours > 1) { for (let c = 1; c <= P.colours; c++) mk(c, "", P.palette[c]); mk(CROSS, ""); }
  else { mk(1, "Fill"); mk(CROSS, "Cross"); }
}
function render() {
  if (!S || !P) { lobby(); return; }
  for (const b of $("tools").children) b.setAttribute("aria-pressed", String(Number(b.dataset.tool) === tool));
  const off = S.done || IN_FRAME;
  for (const b of $("tools").children) b.disabled = off;
  $("undoBtn").disabled = off || !S.undo.length;
  $("redoBtn").disabled = off || !S.redo.length;
  $("hintBtn").disabled = off;
  const canName = rules().nameIt && !S.name && !(S.mode === "duel" && S.play === "split" && split.named());
  $("nameBtn").disabled = off || !canName;
  $("nameBtn").hidden = !rules().nameIt;
  $("nameSmall").textContent = canName && !S.done ? `−${creditFor(S.size, 1 - drawn(S.grid, P.answer))} s` : S.name ? (S.name.right ? "right" : "wrong") : "";
  $("hintBtn").querySelector("small").textContent = `+${HINT} s`;
  drawStrip(); drawLine(); drawResult(); drawZoom();
}
/** The board before a match starts: no picture yet. */
function lobby() {
  board.set(null, "");
  $("result").hidden = true;
  $("controls").hidden = false;
  $("tools").replaceChildren();
  for (const b of $("app").querySelectorAll(".ng-act")) b.disabled = true;
  drawStrip(); drawLine(); drawZoom();
}
function note(text, tone = "") { message = text ? { text, tone } : null; drawLine(); }
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
/** A clue tapped: in a split match, the others see that line lit (it's the one you're talking about). */
function onLine(k) { if (S?.mode === "duel" && S.play === "split") split.point(k); }

// ---------- together, on duel.js ----------
// Two ways (the menu's Together, for the next match): Split, the default for a pair, one grid between you and the clues
// dealt out, the rows to one and the columns to the other (at a table of more, every line round the table), so neither
// can finish alone and each has to say what their lines need; and Race, the same picture for everyone, each on their
// own grid, the lowest score winning (a party's default). Your own picture, bests and today's stay as they were.
const inParty = /[?&]party=[A-Za-z]{4}\b/.test(location.search);
let chosen = false;                                               // Split or Race picked in the menu this time
function matchDeal() {
  const size = SIZES[$("size").value] ? $("size").value : "medium", grid = settings.grid;
  const got = dealPicture({ topic: topicNow(), region: settings.region, size, band: settings.band, grid, seen: read(SEEN, []) })
    || dealPicture({ topic: "countries", region: "world", size: "medium", grid });
  // a party's first match is a race (a table of friends each with a phone); a pair's is split, and the menu's choice
  // is the next match's
  const mode = inParty && !chosen ? "race" : settings.together;
  return { seed: Math.floor(Math.random() * 2 ** 31), id: got.id, size: SIZES[size] ? size : "medium", grid, mode, mistakes: settings.mistakes, nameIt: settings.nameIt };
}
const describeMatch = m => {
  const p = pictureOf(m.id), z = `${(SIZES[m.size]?.label || "Medium").toLowerCase()}${m.grid === "hex" ? ", on hexes" : ""}`;
  return m.mode === "split" ? `Split: one ${TOPIC_ONE[p?.topic] || "picture"} (${z}) between you, the clues dealt out, so you'll have to talk`
    : `Race: the same ${TOPIC_ONE[p?.topic] || "picture"} (${z}) for everyone, the lowest score wins`;
};
const duel = createDuel({
  game: "nonogram", name: "Nonogram", accent: "--ng-in", line: $("rival"), toast, lower: true,
  deal: matchDeal, describe: describeMatch,
  play: (match, { begun, kept, n }) => {
    const size = SIZES[match.size] ? match.size : "medium", id = pictureOf(match.id) ? match.id : "c-france", play = match.mode === "split" ? "split" : "race";
    const hex = match.grid === "hex", r = { mistakes: match.mistakes === "hidden" ? "hidden" : "shown", nameIt: match.nameIt !== false, computer: "off", pace: "medium" };
    const same = kept?.id === id && kept.size === size && kept.play === play && !!kept.hex === hex && valid(kept);
    split.stop();
    begin({ id, size, hex, mode: "duel", play, rules: r }, same ? kept : null, { begun, n }).then(ok => {
      if (!ok) return;
      if (play === "split") split.start(n); else race.tell();
    });
  },
  onLobby: match => { split.stop(); S = null; P = null; $("size").value = SIZES[match.size] ? match.size : "medium"; render(); },
  onLeave: () => { split.stop(); solo(); },
  extra: () => (S && pic ? Object.assign(document.createElement("p"), { textContent: `${pic.flag && pic.topic !== "lakes" ? `${pic.flag} ` : ""}${pic.name}${S.name ? (S.name.right ? ": you named it" : ": not named") : ""}.` }) : null),
  extraTitle: "The picture",
});

// the race: each on their own grid; the others see how much is drawn, then the score
const race = {
  tell(done = false) {
    if (S?.mode !== "duel" || S.play !== "race" || !P) return;
    const left = P.answer.reduce((n, c, i) => n + (c && cellAt(S.grid, i) !== c ? 1 : 0), 0);
    // a finished run's score is its time; one still going ranks by what's left, after every finished one
    duel.report(done ? { score: S.score, text: fmt(S.score), done: true, ms: S.ms } : { score: 1e6 + left, text: `${Math.floor(drawn(S.grid, P.answer) * 100)}%` });
  },
  finished() {
    S.ms = elapsed(); S.done = true; S.score = scoreOf(S);
    board.reveal();
    save(); render();
    if (S.rules.nameIt && !S.name) setTimeout(() => { if (S?.done && !S.name) openName(true); }, 1150);
    race.tell(true);
  },
};
let tellTimer = 0;
function tellSoon() {                                              // a report for every stroke would be a write for every stroke
  if (S?.mode !== "duel" || S.play !== "race" || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (S?.mode === "duel" && !S.done) race.tell(); }, 1500);
}

// the split: one grid in the room (split/m<match>: g, the cells as "value@seat"; pen, each seat's mistakes and hints;
// name, the team's one go at naming it; done, when it was finished; look, the line each is pointing at)
const split = (() => {
  let base = null, stopWatch = null, data = {}, n = 0, reported = null;
  const room = () => duel.together.room;
  const mySlot = () => duel.together.slot ?? 0;
  /** Who is at the table now, by seat, lowest first: the clues are dealt among them, so nobody away holds a line. */
  function seats() {
    const here = duel.together.others().filter(o => o.here).map(o => o.slot);
    return [...new Set([mySlot(), ...here])].sort((a, b) => a - b);
  }
  /** The seat that reads line k (ownerOf in nonogram-engine.js): two at the table, the rows and the columns; on hexes
   *  (hexOwner in nonogram-hex.js) every other line of each direction, or three a direction each. */
  const owner = k => (P.hex ? hexOwner(P.R, k, seats()) : ownerOf(k, P.h, seats()));
  /** What this seat reads, in a few words, for the others' line and the help. */
  function reads() {
    const s = seats();
    if (s.length < 2) return "every line";
    if (P.hex) return s.length === 3 ? ["the rows", "the falling slants", "the rising slants"][s.indexOf(mySlot())] : s.length === 2 ? "every other line" : "some of each";
    return s.length === 2 ? (owner(0) === mySlot() ? "the rows" : "the columns") : "some of each";
  }
  const encode = v => (v === EMPTY ? null : `${v === CROSS ? "x" : v}@${mySlot()}`);
  function gridFrom(g) {
    let out = emptyGrid(P);
    for (const [key, val] of Object.entries(g || {})) {
      const i = Number(key.slice(1)), v = String(val).split("@")[0];
      if (i >= 0 && i < P.answer.length) out = withCell(out, i, v === "x" ? CROSS : Number(v));
    }
    return out;
  }
  function onData(val) {
    data = val || {};
    if (!S || S.mode !== "duel" || S.play !== "split" || !P) return;
    if (!stroke) S.grid = gridFrom(data.g);
    if (data.name && !S.name) S.name = data.name;
    if (data.done && !S.done) { finishedAt(data.done.at); return; }
    if (!S.done && complete()) { split.finished(); return; }
    board.update(S.grid, boardExtras());
    render();
  }
  function finishedAt(at) {
    S.done = true;
    S.ms = Math.max(0, at - (room()?.data?.start || S.begun || at));
    S.score = Math.round(S.ms / 1000) + split.teamPenalty();
    botSleep();
    board.update(S.grid, boardExtras());
    board.reveal();
    save(); render();
    duel.report({ score: 0, text: `${fmt(S.score)} together` });
    if (reported !== n) { reported = n; reportDuo("nonogram", `split-${room().data?.created || ""}-${n}`, { score: S.score, coop: true, lower: true }).catch(e => console.error(e)); }
    if (S.rules.nameIt && !S.name) setTimeout(() => { if (S?.done && !S.name) openName(true); }, 1150);
  }
  return {
    start(match) {
      n = match;
      const r = room();
      if (!r) return;
      base = `${branchPath(r.code, "nonogram")}/split/m${n}`;
      stopWatch?.();
      stopWatch = r.sync.watch(base, onData, e => console.error(e));
      if (n > 1) r.sync.update(`${branchPath(r.code, "nonogram")}/split`, { [`m${n - 1}`]: null })?.catch?.(() => {});   // the last match's grid
      // the others' line says what each reads (everyone's progress is the one grid's, on the strip already)
      duel.report({ score: 0, text: `reading ${reads()}` });
    },
    stop() { stopWatch?.(); stopWatch = null; base = null; data = {}; },
    write(i, v) { const r = room(); if (base && r) r.sync.update(`${base}/g`, { [`c${i}`]: encode(v) })?.catch?.(e => console.error(e)); },
    penalty() { const r = room(); if (base && r) r.sync.update(`${base}/pen`, { [`s${mySlot()}`]: { m: S.mistakes, h: S.hints } })?.catch?.(() => {}); },
    teamPenalty() {
      const pen = { ...(data.pen || {}), [`s${mySlot()}`]: { m: S?.mistakes || 0, h: S?.hints || 0 } };
      const nm = data.name || S?.name;
      return Object.values(pen).reduce((a, p) => a + MISTAKE * (p.m || 0) + HINT * (p.h || 0), 0) + (nm?.early ? (nm.right ? -nm.credit : WRONG_NAME) : 0);
    },
    named: () => !!data.name,
    name(nm) { const r = room(); if (base && r) r.sync.tx(`${base}/name`, cur => (cur ? undefined : { ...nm, slot: mySlot() })).catch(e => console.error(e)); },
    mine: k => owner(k) === mySlot(),
    owner,
    point(k) { const r = room(); if (base && r) r.sync.update(`${base}/look`, { [`s${mySlot()}`]: { line: k, at: duel.now() } })?.catch?.(() => {}); toast(`Pointed at ${lineLabel(k)}`); },
    points() {
      const now = duel.now();
      return Object.entries(data.look || {}).filter(([s, l]) => s !== `s${mySlot()}` && now - (l.at || 0) < 6000).map(([s, l]) => ({ slot: Number(s.slice(1)), line: l.line }));
    },
    help() {
      const s = seats();
      if (s.length < 2) return "Your partner's away: their clues show until they're back.";
      if (s.length === 2 && !P.hex) return `You have the ${owner(0) === mySlot() ? "rows" : "columns"}; tell your partner what yours need. Tap a clue to point at it.`;
      if (s.length === 3 && P.hex) return `You have the ${reads()}; the shaded clues are the others'. Tap a clue to point at it.`;
      return `Your clues are the lines with numbers; the shaded ones are ${s.length === 2 ? "your partner's" : "the others'"}. Tap a clue to point at it.`;
    },
    finished() {
      const r = room();
      if (!base || !r) return;
      const at = duel.now();
      r.sync.tx(`${base}/done`, cur => (cur ? undefined : { at })).then(res => { if (res?.value?.at) finishedAt(res.value.at); }).catch(e => console.error(e));
    },
  };
})();

// ---------- the rules: a sheet of their own, from the header's Rules and the menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Fill the cells the clues ask for and a picture appears: a country's outline, a flag or a lake. Every puzzle has exactly one answer, reached by reasoning.</p>
    <h4>The rules</h4>
    <p>Every row and every column has a clue: the lengths of its runs of filled cells, in order. 3 1 2 is three filled cells, a gap, one, a gap, two; a gap is one blank cell or more, and blanks may start and end the line. In a flag each run has its colour too, shown on the clue: runs of different colours may touch, runs of the same colour need a gap.</p>
    <p><b>An example.</b> In a row of 10 with the clue 8, the run pushed as far left as it goes fills cells 1 to 8, and as far right 3 to 10: cells 3 to 8 are filled whichever way it lies.</p>
    <p>The menu chooses the pictures (countries, flags, lakes or all), the region and the size (about 100, 225 or 400 cells). On Hexes (Grid, in the menu) the grid is a hexagon of hexagonal cells, each on three lines (its row and two slants), every line with a clue read toward the board; there the picture is a country's or a lake's outline, one cell wide.</p>
    <h4>Playing</h4>
    <p>Fill (for a flag, its colours) and Cross are the tools. A tap fills or crosses one cell, and a drag runs along its row or column; the first cell decides what a stroke does: on an empty cell it fills, on one of its colour it clears, and a fill never covers a cell crossed out. Undo and Redo take whole strokes. A Large picture zooms (pinch, the zoom button or a mouse wheel) and pans (two fingers). On a computer, right-click crosses, X picks the cross, 1 to 7 a colour, and Ctrl+Z undoes.</p>
    <p>A finished line's clue greys, and the lines under your finger light with their clues. Mistakes (in the menu) are Shown at first: a wrong fill or cross is refused, the cell shows what it really is, and it costs ${MISTAKE} seconds. Hidden, as on paper, nothing says you're wrong, and the picture is done when every line agrees with its clue. Hint (+${HINT}&nbsp;s) fills in the next cell the clues force and names the line that says so; with mistakes hidden, it rings a wrong cell first.</p>
    <p>Name it (on at first): once before the picture is finished you may name it, typed. Right takes off up to ${CREDIT.small}, ${CREDIT.medium} or ${CREDIT.large} seconds (Small, Medium, Large), in proportion to how much was still to draw; wrong adds ${WRONG_NAME}. Not named by the end, it asks then, for nothing off.</p>
    <h4>Levels</h4>
    <p>Difficulty is how far the reasoning has to reach, never how many clues there are. <b>Easy</b>: the simple rules alone (push each run as far left and as far right as it goes: a cell inside the same run both ways is filled, a cell no run can reach is blank), in six rounds or fewer. <b>Medium</b>: seven to ten rounds, or the complete line logic somewhere (every way a line's runs can lie that fits what's known: a cell they all agree on is settled). <b>Hard</b>: eleven rounds or more, or a contradiction (suppose a cell filled and follow the lines: if they clash, it's blank). Where a region has nothing of a level at a size, the nearest is dealt and the line says so.</p>
    <h4>Score</h4>
    <p>Your score is your seconds on the clock, plus ${MISTAKE} a mistake and ${HINT} a hint, less a right early name's credit or plus ${WRONG_NAME} for a wrong one; lower is better. Your best is kept for each kind of picture and size, hexes apart. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's picture</h4>
    <p>A country's outline at Medium size and Medium difficulty, on squares, with mistakes shown and Name it on: the same for everyone. Its score counts the moment the last cell is right, and is Nonogram's figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// ---------- the menu ----------
let pick = null;                                                   // the picture the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const content = () => part(body, "content");
  if (duel.on) {
    part(body, "play").append(action("The rules", showRules, "link"));
    duel.menu(part(body, "together"));
    part(body, "together").append(choice("Next match", [["split", "Split"], ["race", "Race"]], inParty && !chosen ? "race" : settings.together, v => { settings.together = v; chosen = true; saveSettings(); }));
    content().append(choice("Grid", GRIDS, settings.grid, v => { settings.grid = v; saveSettings(); openMenu(); }),
      choice("Pictures", topicChoices(), topicNow(), v => { settings.topic = v; saveSettings(); }), mirror("Size", $("size")));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= S?.mode === "daily" ? "daily" : "random";
  const play = part(body, "play");
  play.append(action(pick === "daily" ? "Today's picture" : "New picture", () => confirmStart(pick), "primary"));
  if (S && !S.done) play.append(action("Start this one again", restart, "link"));
  play.append(action("The rules", showRules, "link"));
  const c = content();
  c.append(choice("Picture", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") {
    c.append(choice("Grid", GRIDS, settings.grid, v => { settings.grid = v; saveSettings(); openMenu(); }),
      choice("Pictures", topicChoices(), topicNow(), v => { settings.topic = v; saveSettings(); }),
      choice("Region", REGIONS, settings.region, v => { settings.region = v; saveSettings(); }),
      mirror("Size", $("size")),
      choice("Difficulty", [["any", "Any"], ...Object.entries(BANDS)], settings.band, v => { settings.band = v; saveSettings(); }));
  } else c.append(line("Today's is a country's outline, medium: the same for everyone, named for the score."));
  const st = part(body, "settings");
  st.append(toggle("Name it", settings.nameIt, v => { settings.nameIt = v; saveSettings(); }),
    choice("Mistakes", [["shown", "Shown"], ["hidden", "Hidden"]], settings.mistakes, v => { settings.mistakes = v; saveSettings(); }),
    choice("The computer", [["off", "Off"], ["partner", "Partner"], ["rival", "Rival"]], settings.computer, v => { settings.computer = v; saveSettings(); openMenu(); }));
  if (settings.computer !== "off") st.append(choice("Its pace", Object.entries(PACES).map(([k, p]) => [k, p.label]), settings.pace, v => { settings.pace = v; saveSettings(); }));
  st.append(toggle("Learning mode", pile.learning(), v => pile.setLearning(v)));
  const times = read(TIMES, {}), stats = read(STATS, {});
  const bests = S && pic ? times[bestKey()] : null;
  part(body, "about").append(
    line(S && pic ? `${TOPICS[pic.topic]}, ${SIZES[S.size].label.toLowerCase()}${S.hex ? " on hexes" : ""}: ${bests != null ? `best ${fmt(bests)}` : "not finished yet"}. Mistakes ${MISTAKE} s, hints ${HINT} s; naming it early takes off up to ${CREDIT[S.size]} s.` : "A picture in a grid, a clue on every line."),
    line(`${plural(stats.solved || 0, "picture")} drawn, ${stats.named || 0} named.`),
    action("Copy a link to this picture", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (started() && !confirm("Start a new picture? This one isn't finished.")) return false;
  start(mode);
  return true;
}
function restart() {
  if (!S || S.done || !confirm("Clear the grid and start this picture again? The clock carries on.")) return;
  for (let i = 0; i < P.answer.length; i++) if (cellAt(S.grid, i) !== EMPTY) setCell(i, EMPTY);
  S.undo = []; S.redo = [];
  if (S.rival) S.rival = { grid: emptyGrid(P), done: false, ms: 0 };
  botStart();
  changed();
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "nonogram");
const logo = APPS.find(a => a.id === "nonogram")?.logo;
if (logo) document.querySelector(".ng-mark").innerHTML = logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => { if (!duel.on) start("random"); else if (S?.play === "split") duel.again(); else duel.open(); });
$("size").addEventListener("change", () => {
  if (duel.on) { if (!duel.newMatch()) $("size").value = duel.match?.size || "medium"; return; }
  if (S && $("size").value === S.size && S.mode !== "daily") return;
  if (!confirmStart("random")) $("size").value = S?.size || "medium";
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
$("nameBtn").addEventListener("click", () => openName(false));
$("zoomBtn").addEventListener("click", () => board.toggleZoom());
$("nameForm").addEventListener("submit", e => { e.preventDefault(); submitName(); });
$("nameInput").addEventListener("input", () => listNames($("nameInput").value));
$("nameSkip").addEventListener("click", skipName);
$("nameClose").addEventListener("click", skipName);
$("nameDlg").addEventListener("cancel", e => { e.preventDefault(); skipName(); });
$("nameDlg").addEventListener("close", () => render());
document.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea, dialog[open]") || !S || S.done) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (e.key === "x" || e.key === "X") { tool = CROSS; render(); }
  else if (/^[1-7]$/.test(e.key) && Number(e.key) <= P.colours) { tool = Number(e.key); render(); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) { clockPause(); botSleep(); } else { clockRun(); botWake(); board.redraw(); duel.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const h = hashPicture(); if (!duel.on && h && !isShown(h)) begin(h); });
let ticks = 0;
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
  if (S.mode === "duel" && S.play === "split" && ++ticks % 4 === 0) board.update(S.grid, boardExtras());   // a line pointed at fades after its seconds
}, 250);

/** The picture a link names (#p=ID&z=SIZE, or #d=DAY for a day's), or null. */
function hashPicture() {
  const h = new URLSearchParams(location.hash.slice(1));
  const day = Number(h.get("d"));
  if (day) { const id = dailyPicture(day); return id ? { id, size: DAILY.size, mode: "daily", day, rules: { mistakes: "shown", nameIt: true, computer: "off", pace: "medium" } } : null; }
  const id = h.get("p"), size = SIZES[h.get("z")] ? h.get("z") : "medium", hex = h.get("g") === "hex";
  return id && pictureOf(id) ? { id, size, hex, mode: "random", rules: { mistakes: settings.mistakes, nameIt: settings.nameIt, computer: "off", pace: settings.pace } } : null;
}
/** Whether the run on the board is the picture a link names. */
const isShown = h => !!S && S.id === h.id && S.size === h.size && S.mode === h.mode && !!S.hex === !!h.hex;
/** Opening on a link's picture; one that makes no puzzle there (too thin for a hexagon, say) gives way to the run
 *  kept, or a random picture. */
async function linked(h) {
  if ((await begin(h)) !== false) return;
  const kept = read(RUN, null);
  if (valid(kept) && kept.mode !== "duel") begin({ id: kept.id, size: kept.size, hex: kept.hex, mode: kept.mode, day: kept.day, play: kept.play }, kept);
  else start("random", h.size);
}

// for tests and debugging
window.__nonogram = {
  get state() { return S; }, get puzzle() { return P; }, get picture() { return pic; }, get upcoming() { return upcoming; }, get board() { return board; }, duel, start, begin, useHint, undo, redo,
  setTool: t => { tool = t; render(); }, openName, submitName,
};

const forToday = arrivedForToday();                                // from the games screen's tile: today's, still to play
function solo() {
  S = read(RUN, null);
  if (!valid(S) || S.mode === "duel") S = null;
  const h = hashPicture();
  if (h && !isShown(h)) { linked(h); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && S.day === today())) {
    if (!started() || confirm("Today's picture is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  if (S) begin({ id: S.id, size: S.size, hex: S.hex, mode: S.mode, day: S.day, play: S.play }, S);
  else start("random", $("size").value || "medium");
}
// a match in the address: its picture, with no solo one dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });
else solo();
