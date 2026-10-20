// Calcudoku (October 2026): fill the grid so every row and column holds each digit once, and every cage makes its
// target by its operation (the genre KenKen made famous). The rules, the grids and the solvers are
// calcudoku-engine.js and its pieces (every grid is generated, has one solution, and is graded by the hardest technique
// a person needs); the board is the digit grid Sudoku made (digits.js), its cages drawn as heavy rules. This file
// keeps the run (your entries, the clock, hints), the computer (a rival racing you, or a partner holding half the
// clues), and the table: a race on one grid, or Together, the clues shared out so nobody can finish alone.
import { RULES, SIZES, LEVELS, DAILY, levelsOf, levelFor, decode, validGrid, viewOf } from "./calcudoku-engine.js";
import { stateOf, nextStep, say } from "./calcudoku-logic.js";
import { racePlan, placedBy, partnerMove, PACES } from "./calcudoku-bot.js";
import { shapeOf, rng, mix, bit } from "./calcudoku-grid.js";
import { labelOf, holds, readCage } from "./calcudoku-cage.js";
import { createBoard } from "./digits.js";
import { freshEntries, validEntries, write as writeDigit, pencil, rub, fill, set, undo, redo, repeats } from "./digits-edit.js";
import { coopOf, placeCoop, hintCoop, coopValues, shareOf, orphanShares, placedBy as placedBySeat } from "./calcudoku-room.js";
import { createDuel } from "./duel.js";
import { presentSlots } from "./duel-core.js";
import { branchPath } from "./rooms.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, toggle, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo } from "./suite.js";
import { busy } from "./loading.js";

dropdown(document.getElementById("size"));

const $ = id => document.getElementById(id);
const RUN = "calcudoku:run", SETTINGS = "calcudoku:settings", TIMES = "calcudoku:times", SPARES = "calcudoku:spares", TOGETHER = "calcudoku:together";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves while the clock runs (a partner watching sees it that often)
const LEND_AFTER = 20000;            // ms a share of the clues goes unheld (its player away) before the others see it
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = x => String(x).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const first = name => String(name || "Player").split(" ")[0];
const setAt = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);

// ---------- settings: what the next grid deals, and how play goes ----------
const DEFAULTS = { rules: "classic", size: 6, level: "medium", computer: "off", pace: "keen", repeats: true, tidy: true };
let settings = { ...DEFAULTS, ...read(SETTINGS, {}) };
if (!RULES[settings.rules]) settings.rules = "classic";
if (!SIZES[settings.size]) settings.size = 6;
settings.size = Number(settings.size);
settings.level = levelFor(settings.rules, settings.size, LEVELS[settings.level] ? settings.level : "medium");
if (!PACES[settings.pace]) settings.pace = "keen";
const saveSettings = () => write(SETTINGS, settings);
const kindKey = k => `${k.rules}:${k.size}:${k.level}`;
const kindOf = p => ({ rules: p.rules, size: p.n, level: p.level });
const kindName = k => `${RULES[k.rules].label} ${SIZES[k.size].label} · ${LEVELS[k.level].label}`;
/** Today's in the strip: it's always classic, so the size and level say it. */
const dayName = k => `Today's · ${SIZES[k.size].label} · ${LEVELS[k.level].label}`;

// ---------- dealing: grids are made in a worker (a hard one takes a phone a few seconds) ----------
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
async function ask(job) {
  const local = async () => {
    const E = await import("./calcudoku-engine.js");
    return job.kind === "grid" ? { grid: E.encode(E.generate(job)) } : { split: E.splitFor(E.decode(job.grid), job.k, job.seed) };
  };
  if (workerless) return local();
  try {
    worker ||= new Worker(new URL("./calcudoku-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { const w = waiting.get(e.data.id); waiting.delete(e.data.id); if (w) (e.data.error ? w.fail(e.data.error) : w.done(e.data)); };
    worker.onerror = () => { workerless = true; worker = null; for (const w of waiting.values()) w.local(); waiting.clear(); };
  } catch { workerless = true; return local(); }
  const id = ++asked;
  return new Promise((done, fail) => {
    waiting.set(id, { done, fail, local: () => local().then(done, fail) });
    worker.postMessage({ id, ...job });
  });
}
const gridOf = async kind => (await ask({ kind: "grid", seed: kind.seed ?? randomSeed(), rules: kind.rules, size: kind.size, level: kind.level })).grid;
/** A spare grid of each kind is kept, made in the background, so New grid is at once even for a 9×9 Expert. */
function takeSpare(kind) {
  const all = read(SPARES, {}), spare = all[kindKey(kind)];
  if (!spare || !validGrid(spare)) return null;
  delete all[kindKey(kind)];
  write(SPARES, all);
  return spare;
}
let refilling = false;
function refill(kind) {
  if (refilling || IN_FRAME || read(SPARES, {})[kindKey(kind)]) return;
  refilling = true;
  gridOf(kind).then(g => { const all = read(SPARES, {}); all[kindKey(kind)] = g; write(SPARES, all); }).catch(e => console.error(e)).finally(() => { refilling = false; });
}
/** A new grid of this kind: the spare (at once), else made now with the rete showing. */
async function dealGrid(kind, words = "Setting the grid") {
  const spare = kind.seed == null ? takeSpare(kind) : null, next = { rules: kind.rules, size: kind.size, level: kind.level };
  if (spare) { setTimeout(() => refill(next), 1500); return spare; }
  const done = busy(words, { delay: 200 });
  try { return await gridOf(kind); } finally { done(); setTimeout(() => refill(next), 1500); }
}

// ---------- the run (solo) ----------
// S: { v, mode ("random", "daily", "rival", "pair"), grid (encoded), entries (digits-edit.js), sel, notes (the Notes
// switch), ms (time on screen), hints, wrong (cells a hint marked wrong), done ({ ms, score, at, fresh }), pace (the
// computer's), split (pair: the clues shared with the computer), by (pair: who placed each digit, "0" you, "1" it),
// bot (pair: { cell, digit, due } its next digit, due on your clock) }
let S = null, P = null, SH = null, FULL = null, WAYS = new Map(), board = null, boardFor = "";
let clockFrom = null, savedAt = 0, message = null, hintShown = null, highlight = 0, flash = null, plan = null;

function setGrid(grid) {
  P = decode(grid);
  SH = shapeOf(P.n);
  WAYS = new Map();                                  // the cages' ways, kept for this grid's views
  FULL = viewOf(P, null, null, WAYS).view;
  plan = null;
  $("app").classList.toggle("cd-n4", P.n === 4);
}
function begin(s) {
  S = s;
  setGrid(S.grid);
  if (S.mode === "rival") plan = racePlan(FULL, S.pace, P.seed);
  message = null; hintShown = null; highlight = 0; flash = null;
  clockFrom = null;
  if (!IN_FRAME) history.replaceState(null, "", `${location.search}${hashFor(S)}`);
  syncSize(P.n);
  soloBoard();
  if (S.mode === "pair" && !S.done) botPlan();
  save();
  clockRun();
  render();
}
const fresh = (grid, mode, extra = {}) => ({ v: 1, mode, grid, entries: freshEntries(grid.n * grid.n), sel: -1, notes: false, ms: 0, hints: 0, wrong: [], done: null, ...extra });
/** A new solo grid: today's, or a random one of the settings' kind, with the computer if it's switched on. */
async function start(mode = "random") {
  const daily = mode === "daily";
  const kind = daily ? { ...DAILY, seed: today() } : { rules: settings.rules, size: settings.size, level: settings.level };
  let grid;
  try { grid = await dealGrid(kind, daily ? "Setting today's grid" : "Setting the grid"); }
  catch (e) { console.error(e); toast("Couldn't make a grid, try again"); return; }
  if (M) return;                                     // sat down at a table meanwhile
  const computer = daily ? "off" : settings.computer;
  const s = fresh(grid, daily ? "daily" : computer === "rival" ? "rival" : computer === "partner" ? "pair" : "random", computer !== "off" && !daily ? { pace: settings.pace } : {});
  if (s.mode === "pair") {
    const done = busy("Sharing out the clues", { delay: 300 });
    try { s.split = (await ask({ kind: "split", grid, k: 2, seed: grid.seed })).split; } finally { done(); }
    s.by = ".".repeat(grid.n * grid.n);
  }
  begin(s);
}
const startedSolo = () => !!S && !S.done && (S.entries.past.length > 0 || S.hints > 0);
function confirmStart(mode) {
  if (startedSolo() && !confirm("Start a new grid? This one isn't finished.")) return false;
  start(mode);
  return true;
}
function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S);
  savedAt = performance.now();
}
const validRun = s => !!s && s.v === 1 && validGrid(s.grid) && validEntries(s.entries, s.grid.n * s.grid.n) && Number.isFinite(s.ms)
  && (s.mode !== "pair" || (typeof s.split === "string" && typeof s.by === "string"));
const hashFor = s => (s.mode === "daily" ? `#d=${s.grid.seed}` : `#s=${s.grid.seed}&r=${s.grid.rules}&z=${s.grid.n}&l=${s.grid.level}`);
function hashKind() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("d")) return { mode: "daily", seed: Number(h.get("d")), ...DAILY };
  const seed = Number(h.get("s")), rules = h.get("r"), size = Number(h.get("z")), level = h.get("l");
  return seed && RULES[rules] && SIZES[size] && LEVELS[level] ? { mode: "random", seed, rules, size, level: levelFor(rules, size, level) } : null;
}
const sameGrid = (s, k) => !!s && s.grid.seed === k.seed && s.grid.rules === k.rules && s.grid.n === k.size && (k.mode !== "daily" || s.mode === "daily");

// ---------- the clock: time on screen, standing still while the menu is open ----------
function clockRun() {
  if (IN_FRAME || M || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { clockPause(); render(); }, () => { clockRun(); render(); });
const soloMs = () => (S ? S.ms + (clockFrom != null ? performance.now() - clockFrom : 0) : 0);

// ---------- what a player sees ----------
/** Which cages' clues a player sees: every one solo; at a table, theirs, the shared ones and those lent to them. */
const seenBy = (split, mine, lent = []) => P.cages.map((_, i) => !split || split[i] === "*" || split[i] === String(mine) || lent.includes(Number(split[i])));
/** A player's view for the solvers (a hint, the computer): the clues they see, with nothing else. */
const viewFor = (split, mine, lent = []) => (split ? viewOf(P, [...split].map(x => (lent.includes(Number(x)) ? "*" : x)).join(""), mine, WAYS).view : FULL);
/** The cells to mark as clashes: a digit twice in a row or column, and a full cage (whose clue you see) its digits
 *  don't make. Only what's on the board is read, never the solution. */
function clashes(values, seen) {
  const out = repeats(values, SH.units);
  P.cages.forEach((c, i) => {
    if (!seen[i] || c.cells.some(x => !values[x])) return;
    const ds = c.cells.map(x => values[x]);
    if (!holds(P.rules === "hidden" && c.cells.length > 1 ? "?" : c.op, c.target, ds)) for (const x of c.cells) out.add(x);
  });
  return out;
}

// ---------- the board ----------
/** The board for your own grid: with the computer as partner, the clues are only those you hold. */
const soloBoard = () => makeBoard(S.mode === "pair" && !S.done ? seenBy(S.split, 0) : null);
function makeBoard(seen = null) {
  const labels = P.cages.map((c, i) => (!seen || seen[i] ? labelOf(c, P.rules === "hidden") : "?"));
  const id = `${P.seed}/${P.rules}/${P.n}/${labels.join(",")}`;
  if (board && boardFor === id) return;
  board?.destroy();
  boardFor = id;
  board = createBoard($("board"), {
    rows: P.n, cols: P.n, digits: Array.from({ length: P.n }, (_, i) => i + 1),
    cages: P.cages.map((c, i) => ({ cells: c.cells, label: labels[i] })), cageRules: true,
    peers: i => [...SH.peers[i]],
    pad: $("pad"),
    tools: ["undo", "redo", "erase", "notes", { id: "hint", label: "Hint", note: `+${HINT} s` }],
    onInput,
    name: "Calcudoku grid",
  });
  // a clue someone else holds: its "?" softer, as one still to come
  for (const tag of board.root.querySelectorAll(".dg-l")) tag.classList.toggle("cd-unseen", tag.textContent === "?");
}

// ---------- input ----------
function onInput(a) {
  if (IN_FRAME) return;
  if (M) { matchInput(a); return; }
  if (!S || S.done || isPaused()) return;
  if (a.type !== "select" && a.type !== "notes") { hintShown = null; message = null; }
  switch (a.type) {
    case "select": S.sel = a.cell; highlight = 0; if (hintShown && !hintShown.cells.includes(a.cell)) hintShown = null; break;
    case "notes": S.notes = !S.notes; break;
    case "digit": {
      const i = S.sel;
      if (i < 0) { highlight = highlight === a.value ? 0 : a.value; break; }
      const changed = a.note ? pencil(S.entries, i, a.value) : writeDigit(S.entries, i, a.value, { clear: settings.tidy ? [...SH.peers[i]] : [] });
      if (changed && !a.note && S.entries.v[i]) { S.wrong = S.wrong.filter(c => c !== i); linesDone(i, S.entries.v); }
      if (S.mode === "pair") { S.by = setAt(S.by, i, S.entries.v[i] ? "0" : "."); botAfterYou(); }
      break;
    }
    case "erase": if (S.sel >= 0) { rub(S.entries, S.sel); if (S.mode === "pair") { S.by = setAt(S.by, S.sel, S.entries.v[S.sel] ? S.by[S.sel] : "."); botAfterYou(); } } break;
    case "undo": undo(S.entries); afterHistory(); break;
    case "redo": redo(S.entries); afterHistory(); break;
    case "tool": if (a.id === "hint") soloHint(); break;
  }
  checkDone();
  save();
  render();
}
/** After an undo or redo: who placed each digit follows the cells (an undone digit of yours is nobody's). */
function afterHistory() {
  if (S.mode !== "pair") return;
  S.by = [...S.by].map((ch, i) => (S.entries.v[i] ? (ch === "." ? "0" : ch) : ".")).join("");
  botAfterYou();
}
/** A row or column that's just been filled sweeps with light (whether it's right or not: the sweep tells nothing). */
function linesDone(i, values) {
  const full = SH.unitsOf[i].filter(u => [...SH.units[u]].every(c => values[c]));
  if (full.length) flash = { key: `${i}:${Date.now()}`, cells: [...new Set(full.flatMap(u => [...SH.units[u]]))] };
}
const isSolved = values => values.every((d, i) => d === P.solution[i]);
function checkDone() {
  if (!S || S.done) return;
  if (isSolved(S.entries.v)) { finishSolo(); return; }
  if (S.entries.v.every(Boolean)) message = { text: `Every cell is filled, but some digits aren't right. Hint shows one (+${HINT} s).`, tone: "bad" };
}
function finishSolo() {
  if (clockFrom != null) { S.ms += performance.now() - clockFrom; clockFrom = null; }
  const score = Math.round(S.ms / 1000) + HINT * S.hints;
  S.done = { ms: Math.round(S.ms), score, at: Date.now() };
  S.bot = null;
  if (S.mode !== "pair") {
    const times = read(TIMES, {}), key = kindKey(kindOf(P));
    S.done.fresh = times[key] == null || score < times[key];
    if (S.done.fresh) { times[key] = score; write(TIMES, times); }
  }
  if (S.mode === "daily") noteDayTime("calcudoku", score, P.seed);     // today's grid: the first solve, time and hints
  flash = { key: `done:${S.done.at}`, cells: [...Array(P.n * P.n).keys()] };
  hintShown = null;
  save();
}

// ---------- hints: the next step, named, on the board ----------
/**
 * A hint costs 30 s. A wrong digit comes first (logic from a wrong grid leads nowhere), then pencil marks that leave
 * out the digit a cell needs, then the easiest step from the grid as it stands, your pencil marks counted where you've
 * made them, from the clues you can see: named, its cells lit, and its target picked out (a digit's cell selected, so
 * you write it yourself).
 */
function hintFor({ view, values, notes }) {
  const cells = P.n * P.n, keys = [...Array(cells).keys()];
  const wrong = keys.filter(i => values[i] && values[i] !== P.solution[i]);
  if (wrong.length) return { cells: wrong, focus: [wrong[0]], wrong, text: wrong.length > 1 ? `${plural(wrong.length, "digit")} aren't right: they're struck through.` : "This digit isn't right." };
  const bad = keys.filter(i => !values[i] && notes[i] && !(notes[i] & bit(P.solution[i])));
  if (bad.length) return { cells: bad, focus: [bad[0]], text: "Your pencil marks here leave out the digit this cell needs." };
  // the marks were just checked to hold each cell's digit, so narrowing to them leaves every cell something
  const st = stateOf(view, values);
  for (let i = 0; i < cells; i++) if (!values[i] && notes[i]) st.cand[i] &= notes[i];
  const step = nextStep(view, st, { upTo: 4 });
  if (!step) return null;
  const focus = step.place ? [step.place[0]] : [...new Set(step.elim.map(([c]) => c))];
  return { cells: step.cells || focus, focus, step, text: say(view, step, st) };
}
function soloHint() {
  const view = S.mode === "pair" ? viewFor(S.split, 0) : FULL;
  const h = hintFor({ view, values: S.entries.v, notes: S.entries.n });
  if (!h) { message = { text: S.mode === "pair" ? "Nothing more follows from the clues you can see: Almanac's digits will." : "Nothing more to find here.", tone: "" }; return; }
  S.hints++;
  showHint(h, S, strike => { set(S.entries, strike); });
}
/** Puts a hint on the board: its cells lit, its target selected; eliminations struck from your pencil marks there. */
function showHint(h, run, strikeNotes) {
  hintShown = h;
  if (h.wrong) run.wrong = h.wrong;
  if (h.step?.place) run.sel = h.step.place[0];
  else if (h.focus.length === 1) run.sel = h.focus[0];
  if (h.step?.elim) {
    const strike = h.step.elim.filter(([c, m]) => run.entries.n[c] & m).map(([c, m]) => [c, 0, run.entries.n[c] & ~m]);
    if (strike.length) strikeNotes(strike);
  }
  message = { text: h.text, tone: "teach" };
}

// ---------- the computer ----------
/** A partner's next digit, from what it sees, due on your clock; null while what it sees isn't enough. */
function botPlan() {
  if (!S || S.mode !== "pair" || S.done) return;
  const moves = [...S.by].filter(ch => ch === "1").length;
  const move = partnerMove(viewFor(S.split, 1), S.entries.v, S.pace, rng(mix(P.seed, "partner", moves)), i => !S.entries.v[i]);
  S.bot = move ? { cell: move.cell, digit: move.digit, due: Math.round(soloMs() + move.ms) } : null;
}
/** You changed the grid: the partner thinks again if its cell is taken, or if it was waiting on you. */
function botAfterYou() {
  if (S.mode !== "pair") return;
  if (!S.bot || S.entries.v[S.bot.cell]) botPlan();
}
function botTick() {
  if (!S || S.mode !== "pair" || S.done || IN_FRAME || !S.bot || clockFrom == null || soloMs() < S.bot.due) return;
  const { cell, digit } = S.bot;
  if (!S.entries.v[cell]) {
    S.entries.v[cell] = digit;
    S.entries.n[cell] = 0;
    if (settings.tidy) for (const p of SH.peers[cell]) S.entries.n[p] &= ~bit(digit);
    S.by = setAt(S.by, cell, "1");
    linesDone(cell, S.entries.v);
  }
  botPlan();
  checkDone();
  save();
  render();
}
const rivalLeft = () => (plan ? plan.length - placedBy(plan, soloMs()) : 0);

// ---------- drawing ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
const owners = by => [...by].map(ch => (ch === "." ? null : Number(ch)));
function render() {
  if (M) { renderMatch(); return; }
  if (!S || !P) return;
  soloBoard();
  const done = !!S.done, seen = S.mode === "pair" && !done ? seenBy(S.split, 0) : P.cages.map(() => true), values = S.entries.v;
  const marks = { wrong: new Set(S.wrong || []) };
  if (settings.repeats) marks.conflict = clashes(values, seen);
  if (hintShown) { marks.lit = new Set(hintShown.cells); marks.focus = new Set(hintShown.focus); }
  board.draw({
    values, fixed: new Array(values.length).fill(false), notes: S.entries.n, colours: S.mode === "pair" ? owners(S.by) : null, marks,
    selected: done ? -1 : S.sel, highlight, notesMode: S.notes, counts: countsOf(values),
    off: { undo: done || !S.entries.past.length, redo: done || !S.entries.future.length, erase: done, notes: done, hint: done },
    veiled: !IN_FRAME && !done && isPaused(), flash,
  });
  drawStrip();
  drawLine(done);
  drawResult();
}
function countsOf(values) {
  const out = {};
  for (let d = 1; d <= P.n; d++) out[d] = P.n;
  for (const v of values) if (v) out[v]--;
  return out;
}
function drawStrip() {
  const secs = S.done ? S.done.ms / 1000 : soloMs() / 1000, pen = HINT * S.hints;
  put("clock", fmt(secs + pen));
  put("penalty", pen ? `+${pen} s` : "");
  put("kind", S.mode === "daily" ? dayName(kindOf(P)) : kindName(kindOf(P)));
  const r = $("rival"), pace = PACES[S.pace]?.label.toLowerCase();
  let text = "";
  if (S.mode === "rival" && plan) {
    const left = rivalLeft(), end = plan.at(-1)?.at ?? 0;
    text = left > 0 ? `Almanac (${pace}): ${plural(left, "digit")} to go` : `Almanac (${pace}) finished in ${fmt(end / 1000)}`;
  } else if (S.mode === "pair") {
    const its = [...S.by].filter(ch => ch === "1").length;
    text = `With Almanac (${pace}): ${plural(its, "digit")} of its${S.bot || S.done ? "" : ", waiting on you"}`;
  }
  r.hidden = !text;
  if (r.textContent !== text) r.textContent = text;
}
function drawLine(done) {
  const l = $("line");
  const text = done ? "" : message ? message.text
    : S.mode === "pair" ? "A ? is a clue only Almanac can see, as it can't see yours. Its digits are in copper."
    : P.rules === "hidden" ? "Each cage makes its target by one of + − × ÷: which is yours to find. Tap a cell, then a digit."
    : "Each cage makes its target by its sign; digits may repeat in a cage, never in a line. Tap a cell, then a digit.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `cd-line${message?.tone ? ` ${message.tone}` : ""}`;
}
function drawResult() {
  const done = !!S.done;
  $("pad").classList.toggle("away", done);
  $("result").hidden = !done;
  if (!done) return;
  $("nextBtn").textContent = "Another grid";
  $("todayBtn").hidden = S.mode === "daily" || dailyPlayed();
  if (S.done.shown) { $("verdict").replaceChildren("The solution.", Object.assign(document.createElement("span"), { textContent: "Shown, so it doesn't count." })); return; }
  const bits = [`${fmt(S.done.ms / 1000)} on the clock`];
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${HINT * S.hints} s)`);
  let tail = "";
  if (S.mode === "rival" && plan) {
    const its = Math.round((plan.at(-1)?.at ?? 0) / 1000), gap = Math.abs(its - S.done.score);
    tail = S.done.score < its ? `You beat Almanac by ${fmt(gap)}.` : S.done.score > its ? `Almanac was ${fmt(gap)} quicker.` : "A dead heat with Almanac.";
  } else if (S.mode === "pair") tail = `Almanac placed ${[...S.by].filter(ch => ch === "1").length}, you ${[...S.by].filter(ch => ch === "0").length}.`;
  else {
    const best = read(TIMES, {})[kindKey(kindOf(P))];
    tail = S.done.fresh ? "A new best." : best != null ? `Your best: ${fmt(best)}.` : "";
  }
  $("verdict").replaceChildren(`Solved: ${fmt(S.done.score)}.`, Object.assign(document.createElement("span"), { textContent: `${bits.join(", ")}. ${tail}`.trim() }));
}
const dailyPlayed = () => read("calcudoku:today", null)?.key === today();

// ---------- together: a race on one grid, or Together, the clues shared out (duel.js is the table) ----------
// The match is { seed, mode ("race" or "split"), grid (encoded, the same for everyone) }. A race: each solves their
// own copy from the countdown, the others' progress in the strip, the lowest time (hints added) wins. Together: one
// grid for the table (calcudoku-room.js), each seeing their own share of the cages' clues; anyone writes anywhere; the
// team's time is from the start to the last digit. Your own grid, bests and today's stay as they were.
let M = null;            // this device's side of the match: { match, n, begun, mode, entries, sel, notes, hints, done, split, part, k, … }
let roomVal = null, stopWatch = null, reportTimer = 0, lentSince = {};
const togetherMode = () => read(TOGETHER, null) || (new URLSearchParams(location.search).has("party") ? "race" : "split");
const duel = createDuel({
  game: "calcudoku", name: "Calcudoku", accent: "--calcudoku-in", line: $("table"), toast, lower: true,
  deal: async () => {
    const grid = await dealGrid({ rules: settings.rules, size: settings.size, level: settings.level });
    return { seed: grid.seed, mode: togetherMode(), grid };
  },
  describe: m => `${kindName({ rules: m.grid.rules, size: m.grid.n, level: m.grid.level })}: ${m.mode === "split" ? "one grid for the table, each of you seeing your own share of the clues" : "the same grid for everyone, the fastest solve wins"}`,
  play: (match, at) => { playMatch(match, at).catch(e => { console.error(e); toast("Couldn't start the match"); }); },
  onLobby: match => lobby(match),
  onLeave: () => { leaveMatch(); },
});

function lobby(match) {
  clockPause();
  M = { match, n: null, lobby: true };
  setGrid(match.grid);
  syncSize(P.n);
  makeBoard(P.cages.map(() => false));
  render();
}
async function playMatch(match, { begun, kept, n }) {
  clockPause();
  setGrid(match.grid);
  syncSize(P.n);
  const cells = P.n * P.n, same = kept && kept.n === n && kept.seed === match.seed;
  M = { match, n, begun, mode: match.mode, sel: same ? kept.sel : -1, notes: same ? !!kept.notes : false, hints: same ? kept.hints || 0 : 0,
    entries: same && validEntries(kept.entries, cells) ? kept.entries : freshEntries(cells), done: same ? kept.done || null : null, wrong: [], hist: same ? kept.hist || [] : [] };
  message = null; hintShown = null; highlight = 0;
  if (M.mode === "split") {
    // nothing of the clues shows until the shares are known: until then every clue would look like yours
    M.waiting = true;
    makeBoard(P.cages.map(() => false));
    watchRoom();
    const g = duel.together.room?.data, sh = shareOf(g, duel.together.slot), mine = M;
    M.part = sh.part; M.k = sh.k;
    const doneWait = busy("Sharing out the clues", { delay: 300 });
    try { const split = (await ask({ kind: "split", grid: match.grid, k: sh.k, seed: match.seed })).split; if (M !== mine) return; M.split = split; } finally { doneWait(); }
    M.waiting = false;
    coopArrived();
    sentAt = null;
    shareCursor();
  }
  matchBoard();
  keepMatch();
  render();
  tellSoon();
}
/** The match's board: at a Together table, the clues you see are yours, the shared ones and any lent. */
function matchBoard() {
  if (M.mode !== "split" || M.done) { makeBoard(null); return; }
  makeBoard(seenBy(M.split, M.part, lentShares()));
}
function leaveMatch() {
  stopWatch?.(); stopWatch = null; roomVal = null; M = null; lentSince = {};
  clearTimeout(reportTimer); reportTimer = 0;
  boardFor = "";
  loadSolo();
}
function watchRoom() {
  if (stopWatch) return;
  const room = duel.together.room;
  if (!room) return;
  roomVal = room.data;
  stopWatch = room.sync.watch(branchPath(room.code, "calcudoku"), val => { roomVal = val; if (M && !M.lobby) { coopArrived(); render(); } }, e => console.error(e));
}
const coop = () => coopOf(roomVal?.n === M?.n ? roomVal : { n: M?.n }, P.n * P.n);
const matchMs = () => (M?.done ? M.done.ms : Math.max(0, duel.now() - (M?.begun || duel.now())));
function keepMatch() { if (M && !M.lobby) duel.keep({ n: M.n, seed: M.match.seed, entries: M.entries, sel: M.sel, notes: M.notes, hints: M.hints, done: M.done, hist: M.hist }); }

/** The shares lent to everyone: those nobody here has held for LEND_AFTER. */
function lentShares() {
  if (M?.mode !== "split" || !roomVal) return [];
  const present = presentSlots(roomVal, duel.together.room?.here, "calcudoku", duel.together.room?.uid);
  const orphans = present.length ? orphanShares(roomVal, present) : [], now = performance.now();
  for (const q of Object.keys(lentSince)) if (!orphans.includes(Number(q))) delete lentSince[q];
  for (const q of orphans) lentSince[q] ??= now;
  return orphans.filter(q => now - lentSince[q] >= LEND_AFTER);
}
/** What the board shows at the table: your own copy in a race; the table's grid Together, with what this device has
 *  placed and the room hasn't yet. */
function matchValues() {
  if (M.mode !== "split") return M.entries.v;
  const placed = coopValues(coop());
  for (const [i, d] of Object.entries(M.pending || {})) placed[i] = d;
  return placed;
}
/** The room's grid came in: what this device placed meanwhile is the room's now, and a solved grid ends the match. */
function coopArrived() {
  if (M?.mode !== "split") return;
  const c = coop();
  if (M.pending) for (const i of Object.keys(M.pending)) if (Number(c.v[i]) === M.pending[i]) delete M.pending[i];
  if (c.done && !M.done) {
    const start = roomVal.start || M.begun, secs = Math.round((c.done - start) / 1000);
    M.done = { ms: Math.max(0, c.done - start), score: secs + HINT * (c.hints || 0), at: c.done };
    keepMatch();
    reportDuo("calcudoku", `${roomVal.created}-${roomVal.n}`, { score: M.done.score, won: true, coop: true, lower: true }).catch(e => console.error(e));
  }
}

function matchInput(a) {
  if (!M || M.lobby || M.waiting || M.done) return;
  const values = matchValues(), split = M.mode === "split";
  if (a.type !== "select" && a.type !== "notes") { hintShown = null; message = null; }
  switch (a.type) {
    case "select": M.sel = a.cell; highlight = 0; if (hintShown && !hintShown.cells.includes(a.cell)) hintShown = null; shareCursor(); break;
    case "notes": M.notes = !M.notes; break;
    case "digit": {
      const i = M.sel;
      if (i < 0) { highlight = highlight === a.value ? 0 : a.value; break; }
      if (a.note) { pencil(M.entries, i, a.value); break; }
      if (split) { const to = values[i] === a.value ? 0 : a.value; placeShared(i, to, values[i]); if (to) tidyNotes(i, to); linesDone(i, matchValues()); }
      else { writeDigit(M.entries, i, a.value, { clear: settings.tidy ? [...SH.peers[i]] : [] }); if (M.entries.v[i]) linesDone(i, M.entries.v); raceDone(); }
      break;
    }
    case "erase":
      if (M.sel < 0) break;
      if (split && values[M.sel]) placeShared(M.sel, 0, values[M.sel]); else rub(M.entries, M.sel);
      break;
    case "undo": if (split) sharedHistory(-1); else undo(M.entries); break;
    case "redo": if (split) sharedHistory(1); else redo(M.entries); break;
    case "tool": if (a.id === "hint") matchHint(); break;
  }
  keepMatch();
  tellSoon();
  render();
}
// Where you are on the grid, Together, is written to your seat as you move (at most every 150 ms), so the others see
// which cell you're on and nobody sets off for the same one; theirs show on yours, framed in their colour.
let sentAt = null, cursorTimer = 0;
function shareCursor() {
  const room = duel.together.room;
  if (!room || M?.mode !== "split" || M.lobby || M.waiting) return;
  const at = M.done ? -1 : M.sel;
  clearTimeout(cursorTimer);
  if (at === sentAt) return;
  cursorTimer = setTimeout(() => {
    if (!roomVal?.players?.[room.uid]) return;            // not seated (any more): a write would leave a stray entry
    sentAt = at;
    room.sync.update(`${branchPath(room.code, "calcudoku")}/players/${room.uid}`, { at })?.catch?.(e => console.error(e));
  }, 150);
}
/** The others' cells, those here: { cell: { seat, initial } }. */
function cursorsOf() {
  const room = duel.together.room;
  if (M?.mode !== "split" || !roomVal || !room || M.done) return {};
  const present = new Set(presentSlots(roomVal, room.here, "calcudoku", room.uid)), out = {};
  for (const [id, p] of Object.entries(roomVal.players || {})) {
    if (!p || id === room.uid || (room.pid && p.pid === room.pid) || !present.has(p.slot) || !(p.at >= 0)) continue;
    out[p.at] = { seat: p.slot, initial: first(p.name).slice(0, 1).toUpperCase() };
  }
  return out;
}
/** Your pencil marks of a digit leave the cells that see it, as they do solo. */
function tidyNotes(i, d) { if (settings.tidy) for (const p of SH.peers[i]) M.entries.n[p] &= ~bit(d); }
/** A digit into the shared grid: shown at once, the room's copy following (it's one transaction). */
function placeShared(cell, digit, from, record = true) {
  M.pending = { ...(M.pending || {}), [cell]: digit };
  if (record) { M.hist.push([cell, from || 0, digit]); M.future = []; }
  const g = M.n, slot = duel.together.slot;
  duel.together.act(t => placeCoop(t, { n: g, cell, digit, slot, grid: P, now: duel.now() }));
}
/** Undo and redo of your own digits in the shared grid, each only while the cell still holds what you left there. */
function sharedHistory(dir) {
  const values = matchValues();
  if (dir < 0) {
    const last = M.hist.pop();
    if (!last) return;
    const [cell, from, to] = last;
    if ((values[cell] || 0) === to) placeShared(cell, from, to, false);
    (M.future ||= []).push(last);
  } else {
    const next = M.future?.pop();
    if (!next) return;
    const [cell, from, to] = next;
    if ((values[cell] || 0) === from) placeShared(cell, to, from, false);
    M.hist.push(next);
  }
}
function raceDone() {
  if (M.mode !== "race" || M.done || !isSolved(M.entries.v)) return;
  const ms = matchMs();
  M.done = { ms, score: Math.round(ms / 1000) + HINT * M.hints, at: Date.now() };
  flash = { key: `done:${M.n}`, cells: [...Array(P.n * P.n).keys()] };
  keepMatch();
  tell(true);
}
function matchHint() {
  const split = M.mode === "split", view = split ? viewFor(M.split, M.part, lentShares()) : FULL;
  const h = hintFor({ view, values: matchValues(), notes: M.entries.n });
  if (!h) { message = { text: "Nothing more follows from the clues you can see: the others' digits will.", tone: "" }; return; }
  if (split) duel.together.act(t => hintCoop(t, M.n, P.n * P.n)); else M.hints++;
  showHint(h, M, strike => set(M.entries, strike));
}
/** What the table sees of you: digits to go (a race) or digits placed (Together), and the result once it's in. */
function tell(done = false) {
  if (!M || M.lobby) return;
  if (M.mode === "split") {
    const mine = placedBySeat(coop())[duel.together.slot] || 0;
    duel.report({ score: mine, text: `${plural(mine, "digit")} placed` });
    return;
  }
  if (done || M.done) { duel.report({ score: M.done.score, text: `${fmt(M.done.score)}, solved`, done: true, ms: M.done.ms }); return; }
  const left = M.entries.v.filter((d, i) => d !== P.solution[i]).length;
  duel.report({ score: left, text: `${plural(left, "digit")} to go` });
}
function tellSoon() {
  if (reportTimer) return;
  reportTimer = setTimeout(() => { reportTimer = 0; tell(); }, 1500);
}

function renderMatch() {
  if (!P) return;
  if (M.lobby || M.waiting) {
    const n = P.n * P.n;
    board.draw({ values: new Array(n).fill(0), fixed: new Array(n).fill(false), notes: new Array(n).fill(0), colours: null, marks: {}, selected: -1, highlight: 0, notesMode: false, counts: null,
      off: { undo: true, redo: true, erase: true, notes: true, hint: true }, veiled: true });
    put("clock", "0:00"); put("penalty", ""); put("kind", kindName(kindOf(P)));
    $("line").textContent = M.match.mode === "split" ? "Together: one grid for the table, each of you seeing your own share of the clues." : "A race: the same grid for everyone, the fastest solve wins.";
    $("pad").classList.remove("away"); $("result").hidden = true;
    return;
  }
  matchBoard();
  const done = !!M.done, split = M.mode === "split", values = matchValues(), lent = split ? lentShares() : [];
  const seen = split && !done ? seenBy(M.split, M.part, lent) : P.cages.map(() => true);
  const marks = { wrong: new Set(M.wrong || []) };
  if (settings.repeats) marks.conflict = clashes(values, seen);
  if (hintShown) { marks.lit = new Set(hintShown.cells); marks.focus = new Set(hintShown.focus); }
  board.draw({
    values, fixed: new Array(values.length).fill(false), notes: M.entries.n, colours: split ? owners(coop().by) : null, marks, cursors: cursorsOf(),
    selected: done ? -1 : M.sel, highlight, notesMode: M.notes, counts: split ? null : countsOf(values),
    off: { undo: done || !(split ? M.hist.length : M.entries.past.length), redo: done || !(split ? M.future?.length : M.entries.future.length), erase: done, notes: done, hint: done },
    veiled: false, flash,
  });
  const hints = split ? coop().hints || 0 : M.hints;
  put("clock", fmt(matchMs() / 1000 + HINT * hints));
  put("penalty", hints ? `+${HINT * hints} s` : "");
  put("kind", `${split ? "Together" : "Race"} · ${kindName(kindOf(P))}`);
  const l = $("line"), text = done ? "" : message ? message.text
    : split ? (lent.length ? "A player is away: their clues are shown until they're back." : "A ? is a clue only someone else can see: ask them, or work round it.")
    : "The same grid for everyone: the fastest solve wins.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `cd-line${message?.tone ? ` ${message.tone}` : ""}`;
  $("pad").classList.toggle("away", done);
  $("result").hidden = !done;
  if (done) {
    const v = $("verdict");
    if (split) {
      const by = placedBySeat(coop()), seats = Object.entries(roomVal?.players || {}).filter(([, p]) => p?.slot != null).sort((a, b) => a[1].slot - b[1].slot);
      const who = seats.map(([id, p]) => `${id === duel.together.room?.uid ? "you" : first(p.name)} ${by[p.slot] || 0}`).join(", ");
      v.replaceChildren(`Solved together: ${fmt(M.done.score)}.`, Object.assign(document.createElement("span"), { textContent: `Digits placed: ${who}.${hints ? ` ${plural(hints, "hint")} (+${HINT * hints} s).` : ""}` }));
    } else v.replaceChildren(`Solved: ${fmt(M.done.score)}.`, Object.assign(document.createElement("span"), { textContent: "The match sheet has everyone's." }));
    $("nextBtn").textContent = split ? "Another grid" : "The match";
    $("todayBtn").hidden = true;
  }
}

/** The next match at the table: at once when this one's solved together (nobody's run ends, so duel.js would ask). */
const nextMatch = () => (M?.mode === "split" && M.done ? duel.again() : duel.newMatch());

// ---------- the menu ----------
let pick = null;                     // what the menu's New grid starts: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    const together = part(body, "together"), mode = M?.match?.mode || M?.mode || togetherMode();
    together.append(
      action("Another grid", nextMatch, "primary"),
      action(mode === "split" ? "Race instead" : "Together instead", () => { write(TOGETHER, mode === "split" ? "race" : "split"); nextMatch(); }),
      action("The match", () => duel.open()),
      action("Back to solo", () => duel.leave(), "link"));
    contentPart(body, true);
    settingsPart(body, true);
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= S?.mode === "daily" ? "daily" : "random";
  const play = part(body, "play");
  play.append(action("New grid", () => confirmStart(pick), "primary"));
  if (S && !S.done) {
    play.append(action("Fill in every pencil mark", fillNotes));
    play.append(action("Show the solution", giveUp, "link"));
  }
  const content = part(body, "content");
  content.append(choice("Grid", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") contentPart(body, false);
  else content.append(line("Today's grid is a classic 6×6 at Medium, the same for everyone; its time is the games screen's figure."));
  settingsPart(body, pick !== "random");
  const best = S ? read(TIMES, {})[kindKey(kindOf(P))] : null;
  part(body, "about").append(
    line(S ? `${kindName(kindOf(P))}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}. A hint adds ${HINT} s.` : `A hint adds ${HINT} s.`),
    action("Copy a link to this grid", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The rules, size and level the next grid deals (the size from the header's select, as every game has it). */
function contentPart(body, atTable) {
  const content = part(body, "content"), have = levelsOf(settings.rules, settings.size);
  content.append(
    choice("Rules", Object.entries(RULES).map(([k, r]) => [k, r.label]), settings.rules, v => { settings.rules = v; settings.level = levelFor(v, settings.size, settings.level); saveSettings(); openMenu(); }),
    mirror("Size", $("size")),
    choice("Level", Object.keys(have).map(k => [k, LEVELS[k].label]), settings.level, v => { settings.level = v; saveSettings(); openMenu(); }),
    line(`${RULES[settings.rules].label}: ${RULES[settings.rules].note.toLowerCase()}. ${LEVELS[settings.level].label}: ${LEVELS[settings.level].note.toLowerCase()}.${atTable ? " Another grid deals it for everyone." : ""}`));
}
function settingsPart(body, atTable) {
  const s = part(body, "settings");
  if (!atTable) {
    s.append(choice("Computer", [["off", "Off"], ["rival", "Race it"], ["partner", "With it"]], settings.computer, v => { settings.computer = v; saveSettings(); openMenu(); }));
    if (settings.computer !== "off") s.append(choice("Its pace", Object.entries(PACES).map(([k, p]) => [k, p.label]), settings.pace, v => { settings.pace = v; saveSettings(); }),
      line(settings.computer === "rival" ? "Almanac solves the same grid alongside you, step by step at a person's pace." : "You and Almanac each see part of the clues; its digits show as it finds them. From the next grid."));
  }
  s.append(toggle("Mark clashes", settings.repeats, v => { settings.repeats = v; saveSettings(); render(); }),
    toggle("Clear pencil marks as you write", settings.tidy, v => { settings.tidy = v; saveSettings(); }));
}
/** The header's size: the grid's own while one is shown, the settings' otherwise. */
function syncSize(n = settings.size) { $("size").value = String(n); }
function fillNotes() {
  if (!S || S.done) return;
  const view = S.mode === "pair" ? viewFor(S.split, 0) : FULL, st = stateOf(view, S.entries.v), notes = {};
  // each cell's candidates as its row, its column and its cage (read on its own) allow them; a cage the digits in it
  // already break (a wrong one) narrows nothing
  for (const cage of view.cages) {
    if (!cage.ways) continue;
    const { alive, can } = readCage(cage, st.cand);
    if (alive) cage.cells.forEach((c, j) => { st.cand[c] &= can[j]; });
  }
  for (let i = 0; i < P.n * P.n; i++) if (!S.entries.v[i]) notes[i] = st.cand[i];
  fill(S.entries, notes);
  save();
  render();
}
function giveUp() {
  if (!S || S.done || !confirm("Show the solution and end this grid? It won't count.")) return;
  clockPause();
  set(S.entries, [...Array(P.n * P.n).keys()].map(i => [i, P.solution[i], 0]));
  if (S.mode === "pair") S.split = S.split.replace(/\d/g, "*");
  S.done = { ms: Math.round(S.ms), score: Math.round(S.ms / 1000) + HINT * S.hints, at: Date.now(), shown: true };
  S.bot = null;
  message = null;
  save();
  render();
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "calcudoku");
document.querySelector(".cd-mark").innerHTML = APPS.find(a => a.id === "calcudoku")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("nextBtn").addEventListener("click", () => { if (M) { if (M.mode === "split") nextMatch(); else duel.open(); } else start("random"); });
$("todayBtn").addEventListener("click", () => start("daily"));
$("size").addEventListener("change", () => {
  settings.size = Number($("size").value);
  settings.level = levelFor(settings.rules, settings.size, settings.level);
  saveSettings();
  if (duel.on) return;                               // at a table, it's what Another grid deals
  pick = "random";
  if (!confirmStart("random") && P) { settings.size = P.n; saveSettings(); syncSize(P.n); }    // kept the grid: its size stays
});
syncSize();
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); } render(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => {
  const k = hashKind();
  if (!duel.on && k && !sameGrid(S, k)) linkStart(k);
});
setInterval(() => {
  if (M && !M.lobby) { render(); return; }
  if (!S) return;
  botTick();
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

async function linkStart(k) {
  let grid;
  try { grid = await dealGrid(k, k.mode === "daily" ? "Setting today's grid" : "Setting the grid"); } catch (e) { console.error(e); return; }
  begin(fresh(grid, k.mode));
}
/** Your own grid: a link's, today's from the games screen's tile while it's to play, the saved one, or a first. */
async function loadSolo() {
  S = read(RUN, null);
  if (!validRun(S)) S = null;
  const k = hashKind();
  if (k && !sameGrid(S, k)) { await linkStart(k); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && S.grid.seed === today())) {
    if (!startedSolo() || confirm("Today's grid is waiting. Leave the one you've started?")) { await start("daily"); return; }
  }
  if (S) begin(S);
  else if (!IN_FRAME) await start("daily");          // a first visit opens today's grid; a partner's frame shows only theirs
}

// for tests and debugging
window.__calcudoku = { get state() { return S; }, get match() { return M; }, get puzzle() { return P; }, get board() { return board; }, onInput, start, duel, settings };

const forToday = arrivedForToday();
if (duel.inAddress) duel.join().then(ok => { if (!ok) loadSolo(); });
else loadSolo();
