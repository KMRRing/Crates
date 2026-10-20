// Sudoku (October 2026): fill the grid so every row, column and region holds each digit once. The rules, the grids
// and the solvers are sudoku-engine.js and its pieces (every grid is generated, has one solution, and is graded by the
// hardest technique a person needs); the board is the digit grid (digits.js), which Calcudoku and Kakuro share. This
// file keeps the run (your entries, the clock, hints), the computer (a rival racing you, or a partner holding half the
// givens), and the table: a race on one grid, or Together, the givens shared out so nobody can finish alone.
import { RULES, SIZES, LEVELS, DAILY, levelsOf, levelFor, decode, validGrid, shapeFor, viewOf } from "./sudoku-engine.js";
import { stateOf, nextStep, say } from "./sudoku-logic.js";
import { racePlan, placedBy, partnerMove, PACES } from "./sudoku-bot.js";
import { boxRegions, rng, mix, bit } from "./sudoku-grid.js";
import { createBoard } from "./digits.js";
import { freshEntries, validEntries, write as writeDigit, pencil, rub, fill, set, undo, redo, repeats } from "./digits-edit.js";
import { coopOf, placeCoop, hintCoop, coopValues, shareOf, orphanShares, placedBy as placedBySeat } from "./sudoku-room.js";
import { createDuel } from "./duel.js";
import { presentSlots, runOf } from "./duel-core.js";
import { branchPath } from "./rooms.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, toggle, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo } from "./suite.js";
import { busy } from "./loading.js";

dropdown(document.getElementById("level"));

const $ = id => document.getElementById(id);
const RUN = "sudoku:run", SETTINGS = "sudoku:settings", TIMES = "sudoku:times", SPARES = "sudoku:spares", TOGETHER = "sudoku:together";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves while the clock runs (a partner watching sees it that often)
const LEND_AFTER = 20000;            // ms a share of the givens goes unheld (its player away) before the others see it
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = x => String(x).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const first = name => String(name || "Player").split(" ")[0];

// ---------- settings: what the next grid deals, and how play goes ----------
const DEFAULTS = { rules: "classic", size: 9, level: "medium", computer: "off", pace: "keen", repeats: true, tidy: true };
let settings = { ...DEFAULTS, ...read(SETTINGS, {}) };
if (!RULES[settings.rules]) settings.rules = "classic";
if (!SIZES[settings.size]) settings.size = 9;
settings.level = levelFor(settings.rules, settings.size, LEVELS[settings.level] ? settings.level : "medium");
if (!PACES[settings.pace]) settings.pace = "keen";
const saveSettings = () => write(SETTINGS, settings);
const kindKey = k => `${k.rules}:${k.size}:${k.level}`;
const kindName = k => `${RULES[k.rules].label}${Number(k.size) === 6 ? " 6×6" : ""} · ${LEVELS[k.level].label}`;

// ---------- dealing: grids are made in a worker (a hard one takes a phone a few seconds) ----------
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
async function ask(job) {
  const local = async () => {
    const E = await import("./sudoku-engine.js");
    return job.kind === "grid" ? { grid: E.encode(E.generate(job)) } : { split: E.splitFor(E.decode(job.grid), job.k, job.seed) };
  };
  if (workerless) return local();
  try {
    worker ||= new Worker(new URL("./sudoku-worker.js", import.meta.url), { type: "module" });
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
/** A spare grid of each kind is kept, made in the background, so New grid is at once even for an Expert. */
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
// computer's), split (pair: the givens shared with the computer), by (pair: who placed each digit, "0" you, "1" it),
// bot (pair: { cell, digit, due } its next digit, due on your clock) }
let S = null, P = null, SH = null, board = null, boardFor = "";
let clockFrom = null, savedAt = 0, message = null, hintShown = null, highlight = 0, flash = null, plan = null;
const solo = () => !M;

function setGrid(grid) {
  P = decode(grid);
  SH = shapeFor(P);
  plan = null;
}
function begin(s) {
  S = s;
  setGrid(S.grid);
  if (S.mode === "rival") plan = racePlan(SH, P.givens, S.pace, P.seed);
  message = null; hintShown = null; highlight = 0; flash = null;
  clockFrom = null;
  if (!IN_FRAME) history.replaceState(null, "", `${location.search}${hashFor(S)}`);
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
    const done = busy("Sharing out the givens", { delay: 300 });
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

// ---------- the clock: time on screen, standing still while the menu is open ----------
function clockRun() {
  if (IN_FRAME || !solo() || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;
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

// ---------- what the board shows ----------
/** The cells a player holds the given of (1), can't see (sealed: 2), or that were lent while their player is away (3). */
function seenGivens(split, mine, lent = []) {
  const n = P.n * P.n, out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!P.givens[i]) continue;
    const who = split ? split[i] : "*";
    out[i] = who === "*" || who === String(mine) ? 1 : lent.includes(Number(who)) ? 3 : 2;
  }
  return out;
}
/** Which Killer sums a player sees: every one solo; at a table, theirs, the shared ones and those lent to them. */
const sumsSeen = (split, mine, lent = []) => P.cages.map((c, i) => !split || split[i] === "*" || split[i] === String(mine) || lent.includes(Number(split[i])));

/** The view of a grid for the board, from its parts: values, fixed, sealed, lent, notes, owners. */
function viewFrom({ placed, notes, split, mine, lent, owners }) {
  const cells = P.n * P.n, seen = P.cages ? null : seenGivens(split, mine, lent);
  const values = new Array(cells), fixed = new Array(cells), sealed = new Set(), lentCells = new Set();
  for (let i = 0; i < cells; i++) {
    const g = seen?.[i];
    if (g === 1 || g === 3) { values[i] = P.givens[i]; fixed[i] = true; if (g === 3) lentCells.add(i); }
    else { values[i] = g === 2 ? 0 : placed[i] || 0; fixed[i] = false; if (g === 2) sealed.add(i); }
  }
  return { values, fixed, sealed, lent: lentCells, notes, owners };
}
/** The units a digit may not repeat in: rows, columns, regions (diagonals in Diagonals) and Killer's cages. */
const unitsForRepeats = () => [...SH.units, ...(P.cages || []).map(c => c.cells)];
const writable = (view, i) => !view.fixed[i] && !view.sealed.has(i);

function soloView() {
  const v = viewFrom({ placed: S.entries.v, notes: S.entries.n, split: S.mode === "pair" ? S.split : null, mine: 0, owners: S.mode === "pair" ? [...S.by].map(ch => (ch === "." ? null : Number(ch))) : null });
  return v;
}

// ---------- the board ----------
/** The board for your own grid: with the computer as partner, a Killer's sums are only those you hold. */
const soloBoard = () => makeBoard(S.mode === "pair" && P.cages && !S.done ? sumsSeen(S.split, 0) : null, S.mode === "pair" && !S.done ? "pair" : "");
function makeBoard(sumsVisible = null, key = "") {
  const id = `${P.seed}/${P.rules}/${P.n}/${key}`;
  if (board && boardFor === id) return;
  board?.destroy();
  boardFor = id;
  const n = P.n, seen = sumsVisible || (P.cages ? P.cages.map(() => true) : null);
  board = createBoard($("board"), {
    rows: n, cols: n, digits: Array.from({ length: n }, (_, i) => i + 1),
    regions: P.regions || boxRegions(n),
    cages: P.cages ? P.cages.map((c, i) => ({ cells: c.cells, label: seen[i] ? c.sum : "?" })) : [],
    diagonals: P.rules === "x",
    peers: i => [...SH.peers[i]],
    pad: $("pad"),
    tools: ["undo", "redo", "erase", "notes", { id: "hint", label: "Hint", note: `+${HINT} s` }],
    onInput,
    name: "Sudoku grid",
  });
}

// ---------- input ----------
function onInput(a) {
  if (IN_FRAME) return;
  if (M) { matchInput(a); return; }
  if (!S || S.done || isPaused()) return;
  const view = soloView();
  if (a.type !== "select" && a.type !== "notes") { hintShown = null; message = null; }
  switch (a.type) {
    case "select": S.sel = a.cell; highlight = 0; if (hintShown && !hintShown.cells.includes(a.cell)) hintShown = null; break;
    case "notes": S.notes = !S.notes; break;
    case "digit": {
      const i = S.sel;
      if (i < 0 || !writable(view, i)) { highlight = highlight === a.value ? 0 : a.value; break; }
      const changed = a.note ? pencil(S.entries, i, a.value) : writeDigit(S.entries, i, a.value, { clear: settings.tidy ? [...SH.peers[i]] : [] });
      if (changed && !a.note && S.entries.v[i]) { S.wrong = S.wrong.filter(c => c !== i); unitsDone(i); }
      if (S.mode === "pair") { S.by = setAt(S.by, i, S.entries.v[i] ? "0" : "."); botAfterYou(); }
      break;
    }
    case "erase": if (S.sel >= 0 && writable(view, S.sel)) { rub(S.entries, S.sel); if (S.mode === "pair") { S.by = setAt(S.by, S.sel, S.entries.v[S.sel] ? S.by[S.sel] : "."); botAfterYou(); } } break;
    case "undo": undo(S.entries); afterHistory(); break;
    case "redo": redo(S.entries); afterHistory(); break;
    case "tool": if (a.id === "hint") soloHint(); break;
  }
  checkDone();
  save();
  render();
}
const setAt = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);
/** After an undo or redo: who placed each digit follows the cells (an undone digit of yours is nobody's). */
function afterHistory() {
  if (S.mode !== "pair") return;
  S.by = [...S.by].map((ch, i) => (S.entries.v[i] ? (ch === "." ? "0" : ch) : ".")).join("");
  botAfterYou();
}
/** A unit that's just been filled sweeps with light (whether it's right or not: the sweep tells nothing). */
function unitsDone(i) {
  const v = M ? matchView() : soloView();
  const full = SH.unitsOf[i].filter(u => [...SH.units[u]].every(c => v.values[c] || v.sealed.has(c)));
  if (full.length) flash = { key: `${i}:${Date.now()}`, cells: [...new Set(full.flatMap(u => [...SH.units[u]]))] };
}
function checkDone() {
  if (!S || S.done) return;
  const v = S.entries.v, cells = P.n * P.n;
  for (let i = 0; i < cells; i++) if ((P.givens[i] || v[i]) !== P.solution[i]) {
    if ([...Array(cells).keys()].every(c => P.givens[c] || v[c])) message = { text: `Every cell is filled, but some digits aren't right. Hint shows one (+${HINT} s).`, tone: "bad" };
    return;
  }
  finishSolo();
}
function finishSolo() {
  if (clockFrom != null) { S.ms += performance.now() - clockFrom; clockFrom = null; }
  const score = Math.round(S.ms / 1000) + HINT * S.hints;
  S.done = { ms: Math.round(S.ms), score, at: Date.now() };
  S.bot = null;
  if (S.mode !== "pair") {
    const times = read(TIMES, {}), key = kindKey({ rules: P.rules, size: P.n, level: P.level });
    S.done.fresh = times[key] == null || score < times[key];
    if (S.done.fresh) { times[key] = score; write(TIMES, times); }
  }
  if (S.mode === "daily") noteDayTime("sudoku", score, P.seed);       // today's grid: the first solve, time and hints
  flash = { key: `done:${S.done.at}`, cells: [...Array(P.n * P.n).keys()] };
  hintShown = null;
  save();
}

// ---------- hints: the next step, named, on the board ----------
/**
 * A hint costs 30 s. A wrong digit comes first (logic from a wrong grid leads nowhere), then pencil marks that leave
 * out the digit a cell needs, then the easiest step from the grid as it stands, your pencil marks counted where you've
 * made them: named, its cells lit, and its target picked out (a digit's cell selected, so you write it yourself).
 */
function hintFor({ view, placed, notes, solutionAt }) {
  const cells = P.n * P.n;
  const wrong = [...Array(cells).keys()].filter(i => placed[i] && writable(view, i) && placed[i] !== solutionAt(i));
  if (wrong.length) return { cells: wrong, focus: [wrong[0]], wrong, text: wrong.length > 1 ? `${plural(wrong.length, "digit")} aren't right: they're struck through.` : "This digit isn't right." };
  const bad = [...Array(cells).keys()].filter(i => !view.values[i] && !view.sealed.has(i) && notes[i] && !(notes[i] & bit(solutionAt(i))));
  if (bad.length) return { cells: bad, focus: [bad[0]], text: "Your pencil marks here leave out the digit this cell needs." };
  // the marks were just checked to hold each cell's digit, so narrowing to them leaves every cell something
  const values = Uint8Array.from(view.values), st = stateOf(view.shape, values);
  for (let i = 0; i < cells; i++) if (!values[i] && notes[i]) st.cand[i] &= notes[i];
  const step = nextStep(view.shape, st, { upTo: 4 });
  if (!step) return null;
  const focus = step.place ? [step.place[0]] : [...new Set(step.elim.map(([c]) => c))];
  return { cells: step.cells || focus, focus, step, text: `${say(view.shape, step)}` };
}
function soloHint() {
  const view = soloView(), shape = S.mode === "pair" ? viewOf(P, S.split, 0).shape : SH;
  const h = hintFor({ view: { ...view, shape }, placed: S.entries.v, notes: S.entries.n, solutionAt: i => P.solution[i] });
  if (!h) { message = { text: S.mode === "pair" ? "Nothing more follows from what you can see: Almanac's digits will." : "Nothing more to find here.", tone: "" }; return; }
  S.hints++;
  showHint(h, S, view, strike => { set(S.entries, strike); });
}
/** Puts a hint on the board: its cells lit, its target selected; eliminations struck from your pencil marks there. */
function showHint(h, run, view, strikeNotes) {
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
  const view = viewOf(P, S.split, 1, S.entries.v), moves = [...S.by].filter(ch => ch === "1").length;
  const free = i => !P.givens[i] && !S.entries.v[i];
  const move = partnerMove(view.shape, view.givens, S.pace, rng(mix(P.seed, "partner", moves)), free);
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
  if (!S.entries.v[cell] && !P.givens[cell]) {
    S.entries.v[cell] = digit;
    S.entries.n[cell] = 0;
    if (settings.tidy) for (const p of SH.peers[cell]) S.entries.n[p] &= ~bit(digit);
    S.by = setAt(S.by, cell, "1");
    unitsDone(cell);
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
function render() {
  if (M) { renderMatch(); return; }
  if (!S || !P) return;
  soloBoard();
  const view = soloView(), done = !!S.done;
  const marks = { sealed: view.sealed, lent: view.lent, wrong: new Set(S.wrong || []) };
  if (settings.repeats) marks.conflict = repeats(view.values, unitsForRepeats());
  if (hintShown) { marks.lit = new Set(hintShown.cells); marks.focus = new Set(hintShown.focus); }
  board.draw({
    values: view.values, fixed: view.fixed, notes: S.entries.n, colours: view.owners, marks,
    selected: done ? -1 : S.sel, highlight, notesMode: S.notes, counts: S.mode === "pair" ? null : countsOf(view.values),
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
  put("kind", S.mode === "daily" ? `Today's · ${kindName({ rules: P.rules, size: P.n, level: P.level })}` : kindName({ rules: P.rules, size: P.n, level: P.level }));
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
    : S.mode === "pair" ? (P.cages ? "A ? is a sum only Almanac can see, as it can't see some of yours. Its digits are in copper." : "You and Almanac each see some givens the other can't (hatched). Its digits are in copper.")
    : P.cages ? "Each cage adds up to its sum, with no digit twice. Tap a cell, then a digit." : "Tap a cell, then a digit. Notes writes in pencil.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `su-line${message?.tone ? ` ${message.tone}` : ""}`;
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
    const best = read(TIMES, {})[kindKey({ rules: P.rules, size: P.n, level: P.level })];
    tail = S.done.fresh ? "A new best." : best != null ? `Your best: ${fmt(best)}.` : "";
  }
  $("verdict").replaceChildren(`Solved: ${fmt(S.done.score)}.`, Object.assign(document.createElement("span"), { textContent: `${bits.join(", ")}. ${tail}`.trim() }));
}
const dailyPlayed = () => read("sudoku:today", null)?.key === today();

// ---------- together: a race on one grid, or Together, the givens shared out (duel.js is the table) ----------
// The match is { seed, mode ("race" or "split"), grid (encoded, the same for everyone) }. A race: each solves their
// own copy from the countdown, the others' progress in the strip, the lowest time (hints added) wins. Together: one
// grid for the table (sudoku-room.js), each seeing their own share of the givens; anyone writes anywhere; the team's
// time is from the start to the last digit. Your own grid, bests and today's stay as they were.
let M = null;            // this device's side of the match: { match, n, begun, P, entries, sel, notes, hints, done, split, part, k, … }
let roomVal = null, stopWatch = null, reportTimer = 0, lentSince = {};
const togetherMode = () => read(TOGETHER, null) || (new URLSearchParams(location.search).has("party") ? "race" : "split");
const duel = createDuel({
  game: "sudoku", name: "Sudoku", accent: "--sudoku-in", line: $("table"), toast, lower: true,
  deal: async () => {
    const grid = await dealGrid({ rules: settings.rules, size: settings.size, level: settings.level });
    return { seed: grid.seed, mode: togetherMode(), grid };
  },
  describe: m => `${kindName({ rules: m.grid.rules, size: m.grid.n, level: m.grid.level })}: ${m.mode === "split" ? "one grid for the table, each of you seeing your own share of the givens" : "the same grid for everyone, the fastest solve wins"}`,
  play: (match, at) => { playMatch(match, at).catch(e => { console.error(e); toast("Couldn't start the match"); }); },
  onLobby: match => lobby(match),
  onLeave: () => { leaveMatch(); },
});

function lobby(match) {
  clockPause();
  M = { match, n: null, lobby: true };
  setGrid(match.grid);
  makeBoard(P.cages ? P.cages.map(() => false) : null, "lobby");
  render();
}
async function playMatch(match, { begun, kept, n }) {
  clockPause();
  setGrid(match.grid);
  const cells = P.n * P.n, same = kept && kept.n === n && kept.seed === match.seed;
  M = { match, n, begun, mode: match.mode, sel: same ? kept.sel : -1, notes: same ? !!kept.notes : false, hints: same ? kept.hints || 0 : 0,
    entries: same && validEntries(kept.entries, cells) ? kept.entries : freshEntries(cells), done: same ? kept.done || null : null, wrong: [], hist: same ? kept.hist || [] : [] };
  message = null; hintShown = null; highlight = 0;
  if (M.mode === "split") {
    // nothing of the grid shows until the shares are known: until then every given would look like yours
    M.waiting = true;
    makeBoard(P.cages ? P.cages.map(() => false) : null, `w${n}`);
    watchRoom();
    const g = duel.together.room?.data, sh = shareOf(g, duel.together.slot), mine = M;
    M.part = sh.part; M.k = sh.k;
    const doneWait = busy("Sharing out the givens", { delay: 300 });
    try { const split = (await ask({ kind: "split", grid: match.grid, k: sh.k, seed: match.seed })).split; if (M !== mine) return; M.split = split; } finally { doneWait(); }
    M.waiting = false;
    coopArrived();
  }
  matchBoard();
  keepMatch();
  render();
  tellSoon();
}
/** The match's board: at a Together table of Killer, the sums you see are yours, the shared ones and any lent. */
function matchBoard() {
  if (M.mode !== "split" || !P.cages) { makeBoard(null, `m${M.n}`); return; }
  const lent = lentShares();
  makeBoard(sumsSeen(M.split, M.part, lent), `m${M.n}:${lent.join(",")}`);
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
  stopWatch = room.sync.watch(branchPath(room.code, "sudoku"), val => { roomVal = val; if (M && !M.lobby) { coopArrived(); render(); } }, e => console.error(e));
}
const coop = () => coopOf(roomVal?.n === M?.n ? roomVal : { n: M?.n }, P.n * P.n);
const matchMs = () => (M?.done ? M.done.ms : Math.max(0, duel.now() - (M?.begun || duel.now())));
function keepMatch() { if (M && !M.lobby) duel.keep({ n: M.n, seed: M.match.seed, entries: M.entries, sel: M.sel, notes: M.notes, hints: M.hints, done: M.done, hist: M.hist }); }

/** The shares lent to everyone: those nobody here has held for LEND_AFTER. */
function lentShares() {
  if (M?.mode !== "split" || !roomVal) return [];
  const present = presentSlots(roomVal, duel.together.room?.here, "sudoku", duel.together.room?.uid);
  const orphans = present.length ? orphanShares(roomVal, present) : [], now = performance.now();
  for (const q of Object.keys(lentSince)) if (!orphans.includes(Number(q))) delete lentSince[q];
  for (const q of orphans) lentSince[q] ??= now;
  return orphans.filter(q => now - lentSince[q] >= LEND_AFTER);
}
function matchView() {
  if (M.mode !== "split") return viewFrom({ placed: M.entries.v, notes: M.entries.n, split: null, mine: 0 });
  const c = coop(), placed = coopValues(c, P).map((d, i) => (P.givens[i] ? 0 : d));
  for (const [i, d] of Object.entries(M.pending || {})) placed[i] = d;
  const owners = [...c.by].map(ch => (ch === "." ? null : Number(ch)));
  // solved, every given is everyone's: the grid shows whole
  return viewFrom({ placed, notes: M.entries.n, split: M.done ? null : M.split, mine: M.part, lent: lentShares(), owners });
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
    reportDuo("sudoku", `${roomVal.created}-${roomVal.n}`, { score: M.done.score, won: true, coop: true, lower: true }).catch(e => console.error(e));
  }
}

function matchInput(a) {
  if (!M || M.lobby || M.waiting || M.done) return;
  const view = matchView();
  if (a.type !== "select" && a.type !== "notes") { hintShown = null; message = null; }
  const split = M.mode === "split";
  switch (a.type) {
    case "select": M.sel = a.cell; highlight = 0; if (hintShown && !hintShown.cells.includes(a.cell)) hintShown = null; break;
    case "notes": M.notes = !M.notes; break;
    case "digit": {
      const i = M.sel;
      if (i < 0 || !writable(view, i)) { highlight = highlight === a.value ? 0 : a.value; break; }
      if (a.note) { pencil(M.entries, i, a.value); break; }
      if (split) { const to = view.values[i] === a.value ? 0 : a.value; placeShared(i, to, view.values[i]); if (to) tidyNotes(i, to); unitsDone(i); }
      else { writeDigit(M.entries, i, a.value, { clear: settings.tidy ? [...SH.peers[i]] : [] }); if (M.entries.v[i]) unitsDone(i); raceDone(); }
      break;
    }
    case "erase":
      if (M.sel < 0 || !writable(view, M.sel)) break;
      if (split && view.values[M.sel]) placeShared(M.sel, 0, view.values[M.sel]); else rub(M.entries, M.sel);
      break;
    case "undo": if (split) sharedHistory(-1); else undo(M.entries); break;
    case "redo": if (split) sharedHistory(1); else redo(M.entries); break;
    case "tool": if (a.id === "hint") matchHint(); break;
  }
  keepMatch();
  tellSoon();
  render();
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
  const view = matchView();
  if (dir < 0) {
    const last = M.hist.pop();
    if (!last) return;
    const [cell, from, to] = last;
    if ((view.values[cell] || 0) === to) placeShared(cell, from, to, false);
    (M.future ||= []).push(last);
  } else {
    const next = M.future?.pop();
    if (!next) return;
    const [cell, from, to] = next;
    if ((view.values[cell] || 0) === from) placeShared(cell, to, from, false);
    M.hist.push(next);
  }
}
function raceDone() {
  if (M.mode !== "race" || M.done) return;
  const cells = P.n * P.n;
  if (![...Array(cells).keys()].every(i => (P.givens[i] || M.entries.v[i]) === P.solution[i])) return;
  const ms = matchMs();
  M.done = { ms, score: Math.round(ms / 1000) + HINT * M.hints, at: Date.now() };
  flash = { key: `done:${M.n}`, cells: [...Array(cells).keys()] };
  keepMatch();
  tell(true);
}
function matchHint() {
  const split = M.mode === "split", view = matchView();
  const shape = split ? viewOf(P, M.split, M.part, null).shape : SH;
  const placed = split ? view.values.map((v, i) => (view.fixed[i] ? 0 : v)) : M.entries.v;
  const h = hintFor({ view: { ...view, shape }, placed, notes: M.entries.n, solutionAt: i => P.solution[i] });
  if (!h) { message = { text: "Nothing more follows from what you can see: the others' digits will.", tone: "" }; return; }
  if (split) duel.together.act(t => hintCoop(t, M.n, P.n * P.n)); else M.hints++;
  showHint(h, M, view, strike => set(M.entries, strike));
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
  const left = [...Array(P.n * P.n).keys()].filter(i => !P.givens[i] && M.entries.v[i] !== P.solution[i]).length;
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
    put("clock", "0:00"); put("penalty", ""); put("kind", kindName({ rules: P.rules, size: P.n, level: P.level }));
    $("line").textContent = M.match.mode === "split" ? "Together: one grid for the table, each of you seeing your own share of the givens." : "A race: the same grid for everyone, the fastest solve wins.";
    $("pad").classList.remove("away"); $("result").hidden = true;
    return;
  }
  matchBoard();
  const view = matchView(), done = !!M.done, split = M.mode === "split";
  const marks = { sealed: view.sealed, lent: view.lent, wrong: new Set(M.wrong || []) };
  if (settings.repeats) marks.conflict = repeats(view.values, unitsForRepeats());
  if (hintShown) { marks.lit = new Set(hintShown.cells); marks.focus = new Set(hintShown.focus); }
  board.draw({
    values: view.values, fixed: view.fixed, notes: M.entries.n, colours: view.owners, marks,
    selected: done ? -1 : M.sel, highlight, notesMode: M.notes, counts: split ? null : countsOf(view.values),
    off: { undo: done || !(split ? M.hist.length : M.entries.past.length), redo: done || !(split ? M.future?.length : M.entries.future.length), erase: done, notes: done, hint: done },
    veiled: false, flash,
  });
  const hints = split ? coop().hints || 0 : M.hints;
  put("clock", fmt(matchMs() / 1000 + HINT * hints));
  put("penalty", hints ? `+${HINT * hints} s` : "");
  put("kind", `${split ? "Together" : "Race"} · ${kindName({ rules: P.rules, size: P.n, level: P.level })}`);
  const l = $("line"), text = done ? "" : message ? message.text
    : split ? (lentShares().length ? `A player is away: their ${P.cages ? "sums are" : "givens are (in grey)"} shown until they're back.`
      : P.cages ? "A ? is a sum only someone else can see: ask them, or work round it." : "Hatched cells are givens only someone else can see: ask them, or work round them.")
    : "The same grid for everyone: the fastest solve wins.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `su-line${message?.tone ? ` ${message.tone}` : ""}`;
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
  else content.append(line("Today's grid is a classic 9×9 at Medium, the same for everyone; its time is the games screen's figure."));
  if (pick === "random") settingsPart(body, false); else settingsPart(body, true);
  const best = S ? read(TIMES, {})[kindKey({ rules: P.rules, size: P.n, level: P.level })] : null;
  part(body, "about").append(
    line(S ? `${kindName({ rules: P.rules, size: P.n, level: P.level })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}. A hint adds ${HINT} s.` : `A hint adds ${HINT} s.`),
    action("Copy a link to this grid", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The rules, size and level the next grid deals (the level from the header's select, as every game has it). */
function contentPart(body, atTable) {
  const content = part(body, "content");
  content.append(
    choice("Rules", Object.entries(RULES).map(([k, r]) => [k, r.label]), settings.rules, v => { settings.rules = v; settings.level = levelFor(v, settings.size, settings.level); saveSettings(); syncLevel(); openMenu(); }),
    choice("Size", [9, 6].map(k => [String(k), SIZES[k].label]), String(settings.size), v => { settings.size = Number(v); settings.level = levelFor(settings.rules, settings.size, settings.level); saveSettings(); syncLevel(); openMenu(); }),
    mirror("Level", $("level")),
    line(`${LEVELS[settings.level].label}: ${levelNote()}.${atTable ? " Another grid deals it for everyone." : ""}`));
}
function levelNote() {
  const spec = levelsOf(settings.rules, settings.size)[settings.level];
  if (Number(settings.size) === 6 && settings.rules !== "killer") return { easy: "singles only, with digits to spare", medium: "singles only, not a digit to spare", hard: "more than singles" }[settings.level];
  if (settings.rules === "killer") return { easy: "the cages' sums and singles", medium: "the rule of 45 and locked candidates", hard: "longer cages, fish and wings" }[settings.level];
  return spec ? LEVELS[settings.level].note.toLowerCase() : "";
}
function settingsPart(body, atTable) {
  const s = part(body, "settings");
  if (!atTable) {
    s.append(choice("Computer", [["off", "Off"], ["rival", "Race it"], ["partner", "With it"]], settings.computer, v => { settings.computer = v; saveSettings(); openMenu(); }));
    if (settings.computer !== "off") s.append(choice("Its pace", Object.entries(PACES).map(([k, p]) => [k, p.label]), settings.pace, v => { settings.pace = v; saveSettings(); }),
      line(settings.computer === "rival" ? "Almanac solves the same grid alongside you, step by step at a person's pace." : "You and Almanac each see part of the givens; its digits show as it finds them. From the next grid."));
  }
  s.append(toggle("Mark repeats", settings.repeats, v => { settings.repeats = v; saveSettings(); render(); }),
    toggle("Clear pencil marks as you write", settings.tidy, v => { settings.tidy = v; saveSettings(); }));
}
/** The level select offers what the rules and size have (no Expert on a 6×6 or in Killer). */
function syncLevel() {
  const sel = $("level"), have = levelsOf(settings.rules, settings.size);
  for (const o of sel.options) o.disabled = !have[o.value];
  sel.value = settings.level;
}
function fillNotes() {
  if (!S || S.done) return;
  const view = soloView(), st = stateOf(S.mode === "pair" ? viewOf(P, S.split, 0).shape : SH, Uint8Array.from(view.values)), notes = {};
  for (let i = 0; i < P.n * P.n; i++) if (!view.values[i] && !view.sealed.has(i)) notes[i] = st.cand[i];
  fill(S.entries, notes);
  save();
  render();
}
function giveUp() {
  if (!S || S.done || !confirm("Show the solution and end this grid? It won't count.")) return;
  clockPause();
  const cells = P.n * P.n;
  set(S.entries, [...Array(cells).keys()].filter(i => !P.givens[i]).map(i => [i, P.solution[i], 0]));
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
bindSwitcher($("appsBtn"), "sudoku");
document.querySelector(".su-mark").innerHTML = APPS.find(a => a.id === "sudoku")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("nextBtn").addEventListener("click", () => { if (M) { if (M.mode === "split") nextMatch(); else duel.open(); } else start("random"); });
$("todayBtn").addEventListener("click", () => start("daily"));
$("level").addEventListener("change", () => {
  settings.level = levelFor(settings.rules, settings.size, $("level").value);
  saveSettings();
  syncLevel();
  if (duel.on) return;                               // at a table, it's what Another grid deals
  pick = "random";
  confirmStart("random");
});
syncLevel();
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); } render(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => {
  const k = hashKind();
  if (!duel.on && k && !(S && S.grid.seed === k.seed && S.grid.rules === k.rules && S.grid.n === k.size)) linkStart(k);
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
  if (k && !(S && S.grid.seed === k.seed && S.grid.rules === k.rules && S.grid.n === k.size && S.mode === k.mode)) { await linkStart(k); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && S.grid.seed === today())) {
    if (!startedSolo() || confirm("Today's grid is waiting. Leave the one you've started?")) { await start("daily"); return; }
  }
  if (S) begin(S);
  else if (!IN_FRAME) await start("daily");          // a first visit opens today's grid; a partner's frame shows only theirs
}

// for tests and debugging
window.__sudoku = { get state() { return S; }, get match() { return M; }, get puzzle() { return P; }, get board() { return board; }, onInput, start, duel, settings };

const forToday = arrivedForToday();
if (duel.inAddress) duel.join().then(ok => { if (!ok) loadSolo(); });
else loadSolo();
