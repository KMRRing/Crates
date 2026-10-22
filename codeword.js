// Codeword: a crossword grid with no clues, every cell a number, the same number always the same letter, all 26 letters
// somewhere in it; a few are given and the rest you crack from the shapes of the words. Tap a cell, then a letter:
// every cell of that number takes it. The rules are codeword-rules.js's; making a grid, a hint and a computer rival's
// pace need the word lists and run in a worker (codeword-worker.js, codeword-engine.js). Together: a race on the same
// grid (duel.js), or the split key for a pair, each holding half the numbers (codeword-room.js, on together.js).
import { SIZES, LEVEL_NAMES, GIVENS, DAILY, HINT, CHECK, holderOf, pack, unpack, layoutOf, mysteryNums, newRun, letterOf, isFixed, isGiven, holding, place, erase, undo, filled, isFull, isSolved, rightOf, check, show, score } from "./codeword-rules.js";
import { BRANCH, freshTable, isTable, marker, puzzleOf, letterAt, holdingAt, isFixedAt, suggestionFor, filledAt, solvedAt, isMarked, whyNot, writeIn, takeOut, takeBack, suggest, wave, checkAt, hintAt, rightAt, newGrid, resultOf, tableScore } from "./codeword-room.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME, reportDuo } from "./suite.js";
import { createDuel } from "./duel.js";
import { createTogether } from "./together.js";
import { openBranch, joiningWords } from "./rooms.js";
import { getSync } from "./net.js";
import { busy } from "./loading.js";

dropdown(document.getElementById("level"));   // the header dropdown in the suite's style (dropdown.js)

const $ = id => document.getElementById(id);
const RUN = "codeword:run", TIMES = "codeword:times", OPTS = "codeword:opts";
const SAVE_EVERY = 5000;                     // ms between saves of a grid in play (a partner watching sees it that often)
const KINDS = { "": "Off", countries: "Country", commodities: "Commodity", cities: "City" };
const RIVAL_NAMES = { "": "Off", steady: "Steady", sharp: "Sharp", ace: "Ace" };

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inWords = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const first = name => String(name || "Your partner").split(" ")[0];

// the menu's choices for the next grid, and how a pair plays together
let opts = { level: "medium", size: "medium", mystery: "", rival: "", pair: "split", ...read(OPTS, {}) };
if (!LEVEL_NAMES[opts.level]) opts.level = "medium";
if (!SIZES[opts.size]) opts.size = "medium";
if (!(opts.mystery in KINDS)) opts.mystery = "";
if (!(opts.rival in RIVAL_NAMES)) opts.rival = "";
const keepOpts = () => write(OPTS, opts);
$("level").value = opts.level;

// ---------- the workers: grids, hints and rivals, off the page ----------
// Two: one for what the player waits on (a grid, a hint, a rival's solve), one for the grid made ahead, so a hint
// never waits behind it.
const workers = { now: null, ahead: null }, jobs = new Map();
let jobN = 0;
function work(msg, which = "now") {
  if (!workers[which]) {
    try {
      const w = new Worker(new URL("./codeword-worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => { const j = jobs.get(e.data.id); if (j) { jobs.delete(e.data.id); e.data.error ? j.reject(new Error(e.data.error)) : j.resolve(e.data); } };
      w.onerror = e => { console.error(e); for (const [id, j] of jobs) if (j.w === w) { jobs.delete(id); j.reject(new Error("worker")); } if (workers[which] === w) workers[which] = null; };
      workers[which] = w;
    } catch (e) { console.error(e); workers[which] = null; }
  }
  const w = workers[which];
  if (!w) return inPage(msg);
  const id = ++jobN;
  return new Promise((resolve, reject) => { jobs.set(id, { resolve, reject, w }); w.postMessage({ ...msg, id }); });
}
/** Where workers can't run, the same on the page (a stall of a second or two, under the rete). */
async function inPage(msg) {
  const E = await import("./codeword-engine.js");
  if (msg.make) {
    const T = msg.make.mystery ? (await import("./codeword-themes.js")).themeOf(msg.make.mystery, msg.make.level) : null;
    const p = E.makePuzzle(msg.make.seed, { level: msg.make.level, size: msg.make.size, split: !!msg.make.split, mystery: T });
    return { puzzle: p ? pack(p) : null };
  }
  if (msg.hint) return { hint: E.hintFor(unpack(msg.hint.puzzle), msg.hint.right) };
  if (msg.rival) return { plan: E.rivalPlan(unpack(msg.rival.puzzle), msg.rival.rival, msg.rival.seed) };
  return {};
}
// a grid made ahead for the next random one with the same choices, so New grid is at once
const spare = new Map();
const optKey = o => `${o.level}/${o.size}/${o.mystery || ""}/${o.split ? 1 : 0}`;
async function makeGrid(o, seed, words = "Setting the grid") {
  const k = optKey(o), ready = spare.get(k);
  if (ready && seed == null) { spare.delete(k); return ready; }
  const done = busy(words);
  try {
    const r = await work({ make: { seed: seed ?? randomSeed(), level: o.level, size: o.size, mystery: o.mystery || "", split: !!o.split } });
    return r.puzzle;
  } finally { done(); }
}
function makeSpare(o) {
  const k = optKey(o);
  if (spare.has(k) || IN_FRAME) return;
  spare.set(k, null);
  work({ make: { seed: randomSeed(), level: o.level, size: o.size, mystery: o.mystery || "", split: !!o.split } }, "ahead")
    .then(r => { if (r.puzzle) spare.set(k, r.puzzle); else spare.delete(k); }, () => spare.delete(k));
}
// a grid made ahead is a promise of one until it's there
const takeSpare = o => { const k = optKey(o), p = spare.get(k); if (p) { spare.delete(k); return p; } return null; };

// ---------- what's on the board ----------
// S: a solo grid or a race's: { mode ("random", "daily", "link" or "duel"), opts ({ level, size, mystery }), puzzle
// (packed), run (codeword-rules.js), fresh (a new best), rival ({ kind, plan } or null), at (the cursor: { k, dir }) }.
// T: the split key's table, when playing it (codeword-room.js). P: the puzzle unpacked; LAY its layout.
let S = null, T = null, P = null, LAY = null;
let at = { k: -1, dir: "across" };
let clockFrom = null, savedAt = 0, message = null, paused = false, won = false;
// the database's time, so the split key's clock reads the same on both phones (a race's is duel.js's)
let offset = 0, stopOffset = null;
const now = () => Date.now() + offset;

/** What the board shows and what a key does, the same for a solo grid and the split key. */
const B = {
  get split() { return !!T; },
  letter: n => (T ? letterAt(T, P, n) : letterOf(P, S.run, n)),
  fixed: n => (T ? isFixedAt(T, P, n) : isFixed(P, S.run, n)),
  given: n => isGiven(P, n),
  marked: n => (T ? isMarked(T, n) : S.run.marks.includes(n)),
  mine: n => !T || holderOf(n) === mySlot(),                       // a number this player sees and writes in
  sug: n => (T ? suggestionFor(T, n) : null),
  holding: ch => (T ? holdingAt(T, P, ch) : holding(P, S.run, ch)),
  filled: () => (T ? filledAt(T, P) : filled(P, S.run)),
  solved: () => (T ? solvedAt(T, P) : isSolved(P, S.run)),
  done: () => (T ? !!T.done : !!S?.run.done),
};

// ---------- the clock ----------
// A solo grid counts the time on screen (run.ms); a race's from when the table started it (duel.js); the split key's
// from the deal (the table's created).
const racing = () => !!S?.duel;
function clockRun() {
  if (IN_FRAME || !S || T || racing() || S.run.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); }, () => { paused = false; clockRun(); });   // the menu stops the clock, and the rival with it
function elapsed() {
  if (T) return Math.max(0, (T.done || now()) - T.created);
  if (!S) return 0;
  if (S.run.done) return S.run.ms;
  if (racing()) return Math.max(0, duel.now() - S.begun);
  return S.run.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
}

// ---------- keeping ----------
function save() {
  if (IN_FRAME || !S || T) return;
  if (S.duel) duel.keep(S); else write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.duel && !T && !S.run.done && (Object.keys(S.run.put).length > 0 || S.run.hints > 0);
const valid = s => !!s && !!unpack(s.puzzle) && !!s.run && typeof s.run.put === "object" && Number.isFinite(s.run.ms) && Array.isArray(s.run.marks);
const bestKey = o => `${o.level}:${o.size}`;
/** Records a solved grid's score as the best for its level and size (lowest wins); true if it's a new best. */
function recordBest(sc) {
  const times = read(TIMES, {}), k = bestKey(S.opts), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- starting ----------
const hashFor = s => (s.mode === "daily" ? `#d=${unpack(s.puzzle).seed}` : `#s=${unpack(s.puzzle).seed}&l=${s.opts.level}&z=${s.opts.size}${s.opts.mystery ? `&m=${s.opts.mystery}` : ""}`);
/** Puts a grid on the board: `s` is { mode, opts, puzzle, … }, `run` what's written in it so far. */
function begin(s, run = newRun()) {
  S = { at: null, rival: null, ...s, run };
  T = null;
  P = unpack(S.puzzle);
  LAY = layoutOf(P);
  won = false;
  message = null;
  clockFrom = null;
  at = S.at && P.num[S.at.k] ? S.at : firstAt();
  $("level").value = S.mode === "daily" ? opts.level : S.opts.level;   // the menu offers the level a random grid will have
  if (!S.duel && !IN_FRAME) history.replaceState(null, "", hashFor(S));
  // a rival's row is there from the start (its solve follows from the worker), so the grid doesn't shrink under you
  const racer = !S.duel && !IN_FRAME && !S.run.done && S.mode !== "daily" && (S.rival?.kind || opts.rival);
  if (racer && !S.rival?.plan) S.rival = { kind: racer, plan: null };
  build();
  save();
  clockRun();
  render();
  if (!S.duel && !IN_FRAME && S.mode !== "daily") makeSpare({ ...S.opts, split: false });
  if (racer && !S.rival.plan) setRival(racer);
}
/** A new grid: a random one with the menu's choices (the level from the header), or today's, the same for everyone. */
async function start(mode, level = opts.level) {
  const daily = mode === "daily";
  const o = daily ? { level: DAILY.level, size: DAILY.size, mystery: DAILY.mystery } : { level, size: opts.size, mystery: opts.mystery };
  const puzzle = daily ? await makeGrid(o, today(), "Setting today's grid") : takeSpare(o) || await makeGrid(o, null);
  if (!puzzle) { toast("Couldn't make a grid: try again"); return; }
  begin({ mode, opts: o, puzzle });
}

// ---------- the cursor ----------
/** Where the cursor starts: the first cell, across first, of a number that's yours and has no letter yet. */
function firstAt() {
  const open = c => B.mine(P.num[c]) && !B.letter(P.num[c]);
  const e = LAY.entries.find(x => x.dir === "across" && x.cells.some(open)) || LAY.entries.find(x => x.cells.some(open)) || LAY.entries[0];
  return { k: e.cells.find(open) ?? e.cells[0], dir: e.dir };
}
const entryAt = (k, dir) => { const i = (dir === "down" ? LAY.down : LAY.across)[k]; return i >= 0 ? LAY.entries[i] : null; };
const curEntry = () => entryAt(at.k, at.dir) || entryAt(at.k, at.dir === "across" ? "down" : "across");
function tapCell(k) {
  if (!P.num[k]) return;
  if (k === at.k) {                                 // the same cell again: the other way, if there is one
    const other = at.dir === "across" ? "down" : "across";
    if (entryAt(k, other)) at = { k, dir: other };
  } else at = { k, dir: entryAt(k, at.dir) ? at.dir : at.dir === "across" ? "down" : "across" };
  message = null;
  remember();
  render();
}
/**
 * The next cell along the entry whose number has no letter yet, after the cursor (round to the start); else the cursor.
 * `took`: a number just given a letter that the table hasn't sent back yet.
 */
function nextOpen(took = 0) {
  const e = curEntry();
  if (!e) return at.k;
  const i = e.cells.indexOf(at.k);
  for (let j = 1; j <= e.cells.length; j++) { const c = e.cells[(i + j) % e.cells.length], n = P.num[c]; if (n !== took && !B.letter(n)) return c; }
  return at.k;
}
function step(dk) {                                 // the arrow keys: to the next white cell that way
  const C = LAY.cols, R = LAY.rows;
  let r = (at.k / C) | 0, c = at.k % C;
  const [dr, dc] = dk;
  for (;;) { r += dr; c += dc; if (r < 0 || c < 0 || r >= R || c >= C) return; if (P.num[r * C + c]) break; }
  const k = r * C + c, dir = dr ? "down" : "across";
  at = { k, dir: entryAt(k, dir) ? dir : dir === "down" ? "across" : "down" };
  remember();
  render();
}
let remembered = 0;
function remember() {                                // the cursor is kept with the run, for a partner watching
  if (!S || T || IN_FRAME) return;
  S.at = at;
  clearTimeout(remembered);
  remembered = setTimeout(save, 400);
}

// ---------- moves ----------
function say(text, tone = "") { message = text ? { text, tone } : null; drawLine(); }
/** A letter key: the cursor's number takes it (in the split key, a suggestion when the number is the other's). */
function key(ch) {
  if (!P || B.done() || IN_FRAME || paused || at.k < 0) return;
  const n = P.num[at.k];
  if (T) { tableKey(n, ch); return; }
  const r = place(P, S.run, n, ch);
  if (!r.ok) {
    say(r.why === "fixed" ? `${n} is ${isGiven(P, n) ? "given" : "shown"}: ${P.letters[n].toUpperCase()}.` : `${ch.toUpperCase()} is fixed on ${r.on}.`, "bad");
    navigator.vibrate?.(12);
    return;
  }
  message = r.moved ? { text: `${ch.toUpperCase()} moved from ${r.moved} to ${n}.`, tone: "" } : null;
  at = { ...at, k: nextOpen() };
  changed();
}
function del() {
  if (!P || B.done() || IN_FRAME || paused || at.k < 0) return;
  const n = P.num[at.k];
  if (T) { tableDel(n); return; }
  if (!erase(P, S.run, n)) {                         // nothing to take out here: back a cell, and take that one's out
    const e = curEntry(), i = e ? e.cells.indexOf(at.k) : -1;
    if (i > 0) { at = { ...at, k: e.cells[i - 1] }; erase(P, S.run, P.num[at.k]); }
  }
  message = null;
  changed();
}
function back() {
  if (!P || B.done() || IN_FRAME || paused) return;
  if (T) { together.act(g => takeBack(g, mySlot())); return; }
  const n = undo(P, S.run);
  if (!n) { say("Nothing to undo."); return; }
  const k = LAY.cellsOf[n][0];
  if (k != null) at = { k, dir: entryAt(k, at.dir) ? at.dir : at.dir === "across" ? "down" : "across" };
  message = null;
  changed();
}
async function useHint() {
  if (!P || B.done() || IN_FRAME || paused) return;
  const right = T ? rightAt(T) : rightOf(P, S.run);
  const done = busy("Looking for a way in", { delay: 400 });
  let h = null;
  try { h = (await work({ hint: { puzzle: T ? T.puzzle : S.puzzle, right } })).hint; } catch (e) { console.error(e); } finally { done(); }
  if (!h) return;
  if (T) { await together.act(g => hintAt(g, h.n, now())); }
  else { show(P, S.run, h.n); }
  const e = LAY.entries[h.entry];
  if (e) at = { k: e.cells[e.nums.indexOf(h.n)], dir: e.dir };
  say(`+${HINT} s: ${h.n} is ${P.letters[h.n].toUpperCase()}, in the word at the cursor.`, "good");
  if (!T) changed(); else render();
}
function useCheck() {
  if (!P || B.done() || IN_FRAME || paused) return;
  if (T) { const wrong = wrongCount(); together.act(g => checkAt(g)).then(ok => { if (ok) sayChecked(wrong); }); return; }
  check(P, S.run);
  sayChecked(S.run.marks.length);
  changed();
}
const wrongCount = () => [...Array(26).keys()].map(i => i + 1).filter(n => !B.fixed(n) && B.letter(n) && B.letter(n) !== P.letters[n]).length;
function sayChecked(wrong) {
  say(wrong ? `+${CHECK} s: ${plural(wrong, "letter")} wrong, struck through.` : `+${CHECK} s: every letter in is right.`, wrong ? "bad" : "good");
}
/** After a move: the end is settled the moment the last letter is right; else kept, and the table told. */
function changed() {
  if (!T && S && !S.run.done && isSolved(P, S.run)) finish();
  else { save(); tellSoon(); }
  remember();
  render();
}
function finish() {
  const r = S.run;
  if (racing()) r.ms = Math.max(0, duel.now() - S.begun);
  else if (clockFrom != null) { r.ms += performance.now() - clockFrom; clockFrom = null; }
  r.done = true;
  const sc = score(r);
  if (S.duel) { tell(true); save(); }
  else {
    S.fresh = recordBest(sc);
    if (S.mode === "daily") noteDayTime("codeword", sc, P.seed);   // today's grid: the first solve's score
    save();
  }
  celebrate();
}
function celebrate() {
  won = true;
  $("board").classList.add("won");
  navigator.vibrate?.([30, 40, 30]);
}

// ---------- the computer rival ----------
// A solo grid can be raced against a computer player (the menu's Race the computer): its solve, worked out from the
// givens by the solver at its skill and paced as a person would be (rivalPlan in codeword-engine.js), plays out on the
// grid's own clock, so it stands still with the menu open and goes on from where it was after a reload.
async function setRival(kind) {
  if (!S || S.duel || T || IN_FRAME || !kind) { if (S && !kind) { S.rival = null; save(); render(); } return; }
  const s = S;
  if (s.rival?.kind !== kind) { s.rival = { kind, plan: null }; render(); }
  try {
    const { plan } = await work({ rival: { puzzle: s.puzzle, rival: kind, seed: P.seed } });
    if (S !== s || s.rival?.kind !== kind) return;      // another grid, or another rival, since
    s.rival = { kind, plan };
    save();
    render();
  } catch (e) { console.error(e); }
}
/** Where the rival is on this grid's clock: { name, letters, done, end }; its letters are the givens till its solve is in. */
function rivalNow() {
  if (!S?.rival || !RIVAL_NAMES[S.rival.kind]) return null;
  const plan = S.rival.plan || [], t = elapsed(), got = plan.filter(x => x.at <= t), letters = P.givens.length + got.reduce((n, x) => n + x.gives.length, 0);
  const end = plan.at(-1)?.at ?? 0;
  return { name: RIVAL_NAMES[S.rival.kind], letters: Math.min(26, letters), done: plan.length > 0 && t >= end, end };
}

// ---------- drawing ----------
/** The board's cells, made once a grid. */
function build() {
  const board = $("board");
  board.style.setProperty("--n", LAY.cols);
  board.classList.remove("won");
  board.replaceChildren(...P.num.map((n, k) => {
    const c = document.createElement("div");
    c.className = n ? "cw-c" : "cw-c x";
    c.dataset.k = k;
    if (n) { c.setAttribute("role", "gridcell"); c.append(document.createElement("i"), document.createElement("b"), document.createElement("s")); }
    return c;
  }));
  buildKeys();
}
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
function buildKeys() {
  const kbd = $("kbd");
  if (kbd.childElementCount) return;
  ROWS.forEach((row, i) => {
    const r = document.createElement("div");
    r.className = "cw-krow";
    const add = (text, cls, fn, label) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = text; if (label) b.setAttribute("aria-label", label); b.addEventListener("click", fn); r.append(b); return b; };
    if (i === 1) r.append(Object.assign(document.createElement("span"), { className: "half" }));
    if (i === 2) add("<span>↔</span>", "wide dir", () => { const k = at.k, other = at.dir === "across" ? "down" : "across"; if (entryAt(k, other)) { at = { k, dir: other }; remember(); render(); } }, "Across or down");
    for (const ch of row) add(`${ch}<small></small>`, "", () => key(ch)).dataset.ch = ch;
    if (i === 1) r.append(Object.assign(document.createElement("span"), { className: "half" }));
    if (i === 2) add("⌫", "wide del", del, "Delete");
    kbd.append(r);
  });
  // the key as a printed codeword has it, 1 to 26 with each letter found (shown held sideways, where there's room)
  $("keytable").replaceChildren(...[...Array(26).keys()].map(i => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.n = i + 1;
    b.append(Object.assign(document.createElement("i"), { textContent: i + 1 }), document.createElement("b"));
    b.addEventListener("click", () => jumpTo(i + 1));
    return b;
  }));
}
/** The cursor to a number's first cell. */
function jumpTo(n) {
  const k = LAY?.cellsOf[n]?.[0];
  if (k == null || !B.mine(n)) return;
  at = { k, dir: entryAt(k, at.dir) ? at.dir : at.dir === "across" ? "down" : "across" };
  message = null;
  remember();
  render();
}
const mySlot = () => together.slot ?? 0;
/** The key table: your numbers (all 26 alone, your 13 in the split key), each with its letter, the cursor's ringed. */
function drawTable() {
  const n0 = at.k >= 0 ? P.num[at.k] : 0;
  for (const b of $("keytable").children) {
    const n = Number(b.dataset.n), mine = B.mine(n), l = B.letter(n) || "";
    if (b.hidden !== !mine) b.hidden = !mine;
    const cls = `${l ? "has" : ""}${B.fixed(n) ? " fixed" : ""}${B.marked(n) ? " bad" : ""}${n === n0 ? " on" : ""}`.trim();
    if (b.className !== cls) b.className = cls;
    const lb = b.lastChild;
    if (lb.textContent !== l) lb.textContent = l;
    b.setAttribute("aria-label", `${n}${l ? `, ${l.toUpperCase()}` : ""}`);
  }
}
/** The cells as they stand: numbers (yours, in the split key), letters, the cursor's word and number, marks, suggestions. */
function drawBoard() {
  const cells = $("board").children, e = curEntry(), word = new Set(e?.cells || []), n0 = at.k >= 0 ? P.num[at.k] : 0;
  for (let k = 0; k < cells.length; k++) {
    const n = P.num[k];
    if (!n) continue;
    const c = cells[k], mine = B.mine(n), l = B.letter(n), sug = mine ? B.sug(n) : null;
    const cls = `cw-c${mine ? "" : " theirs"}${B.given(n) ? " given" : B.fixed(n) ? " shown" : ""}${B.marked(n) ? " bad" : ""}${word.has(k) ? " word" : ""}${n === n0 && mine ? " same" : ""}${k === at.k ? " cur" : ""}`;
    if (c.className !== cls) c.className = cls;
    const [i, b, s] = c.children, num = mine ? String(n) : "", let_ = l || "", sl = sug && !l ? sug.l : "";
    if (i.textContent !== num) i.textContent = num;
    if (b.textContent !== let_) b.textContent = let_;
    if (s.textContent !== sl) { s.textContent = sl; s.style.setProperty("--sug", `var(--p${sug?.by ?? 1})`); }
    c.setAttribute("aria-label", `${mine ? `number ${n}` : "a number of your partner's"}${l ? `, ${l.toUpperCase()}` : ""}`);
  }
}
function drawKeys() {
  const n0 = at.k >= 0 ? P?.num[at.k] : 0, sug = n0 && B.mine(n0) ? B.sug(n0) : null, off = !P || B.done() || IN_FRAME;
  $("kbd").classList.toggle("off", !!P && B.done());
  for (const b of $("kbd").querySelectorAll("button[data-ch]")) {
    const ch = b.dataset.ch, on = P ? B.holding(ch) : 0;
    const cls = `${on ? "used" : ""}${on && B.fixed(on) ? " fixed" : ""}${on && on === n0 ? " on" : ""}${sug?.l === ch ? " sug" : ""}`.trim();
    if (b.className !== cls) b.className = cls;
    if (sug?.l === ch) b.style.setProperty("--sug", `var(--p${sug.by})`);
    const small = b.querySelector("small"), txt = on && B.mine(on) ? String(on) : "";
    if (small.textContent !== txt) small.textContent = txt;
    b.disabled = off;
  }
  for (const b of $("kbd").querySelectorAll("button.wide")) b.disabled = off;
}
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!P) { put("clock", "0:00"); put("found", ""); for (const id of ["undoBtn", "hintBtn", "checkBtn"]) $(id).disabled = true; $("rival").hidden = true; return; }
  const hints = T ? T.hints || 0 : S.run.hints, checks = T ? T.checks || 0 : S.run.checks;
  put("clock", fmt(elapsed() / 1000 + HINT * hints + CHECK * checks));   // the score as it stands: a hint and a check are on the clock
  put("found", `${B.filled()} of 26`);
  const off = B.done() || IN_FRAME;
  $("undoBtn").disabled = off || (!T && !S.run.log.length);
  $("hintBtn").disabled = off;
  $("checkBtn").disabled = off;
  drawRival();
}
function drawRival() {
  const el = $("rival"), r = rivalNow();
  if (!r || duel.on || T) { el.hidden = true; return; }
  el.hidden = false;
  const text = r.done ? `${r.name} cracked it in ${fmt(r.end / 1000)}` : `${r.name}: ${r.letters} of 26`;
  if (el.textContent !== text) el.textContent = text;
}
function drawLine() {
  const l = $("line");
  let text, tone = message?.tone || "";
  if (message) text = message.text;
  else if (!P) text = duel.on ? "The same grid for everyone at the table." : "";
  else if (B.done()) text = mysteryLine() || `${LEVEL_NAMES[P.level]}, ${P.grid.length} by ${P.grid.length}${!T && S.mode === "daily" ? ": today's grid" : ""}.`;
  else if (T) {
    const n = at.k >= 0 ? P.num[at.k] : 0, partner = first(together.partner()?.name), s = n && B.mine(n) ? B.sug(n) : null;
    const [mine, theirs] = mySlot() ? ["14 to 26", "1 to 13"] : ["1 to 13", "14 to 26"];
    text = n && !B.mine(n) ? (B.letter(n) ? `${partner}'s number: ${B.letter(n).toUpperCase()}.` : `${partner}'s number: tap a letter to suggest it.`)
      : s ? `${partner} suggests ${s.l.toUpperCase()} for ${n}: tap it to write it in.`
      : filledAt(T, P) === 26 ? "Every number has a letter, but some are wrong: Check strikes them through."
      : `You hold ${mine}, ${partner} ${theirs}: only your numbers show.`;
  } else if (isFull(P, S.run)) { text = "Every number has a letter, but some are wrong: Check strikes them through."; tone = "bad"; }
  else {
    const n = at.k >= 0 ? P.num[at.k] : 0;
    const many = n ? LAY.cellsOf[n].length : 0;
    text = n && B.fixed(n) ? `${n} is ${B.given(n) ? "given" : "shown"}: ${P.letters[n].toUpperCase()}.`
      : n ? `${n} is in ${plural(many, "cell")}: a letter here fills ${many === 1 ? "it" : many === 2 ? "both" : "them all"}.` : "Tap a cell, then a letter.";
  }
  if (l.textContent !== text) l.textContent = text;
  l.className = `cw-line${tone ? ` ${tone}` : ""}`;
}
function mysteryLine() {
  if (!P?.mystery) return "";
  const nums = mysteryNums(P), got = nums.every(n => B.letter(n) === P.letters[n]);
  return got ? `The mystery ${KINDS[P.mystery.kind]?.toLowerCase() || "word"}: ${P.mystery.word.toUpperCase()}.` : "";
}
function drawMystery() {
  const box = $("mystery");
  if (!P?.mystery) { box.hidden = true; return; }
  box.hidden = false;
  const nums = mysteryNums(P), key = `${P.seed}/${P.mystery.word}/${T ? mySlot() : ""}`;
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.replaceChildren(Object.assign(document.createElement("span"), { textContent: `${KINDS[P.mystery.kind] || "Mystery"}` }),
      ...nums.map(() => { const e = document.createElement("em"); e.append(document.createElement("i"), document.createElement("b")); return e; }));
  }
  const ems = box.querySelectorAll("em");
  nums.forEach((n, j) => {
    const [i, b] = ems[j].children, num = B.mine(n) ? String(n) : "", l = B.letter(n) || "";
    if (i.textContent !== num) i.textContent = num;
    if (b.textContent !== l) b.textContent = l;
  });
  box.classList.toggle("got", nums.every(n => B.letter(n) === P.letters[n]));
}
function drawResult() {
  const done = !!P && B.done();
  $("result").hidden = !done;
  if (!done) return;
  const v = $("verdict");
  if (T) {
    v.textContent = `Cracked together in ${fmt(tableScore(T))}.${T.hints || T.checks ? ` (${[T.hints ? plural(T.hints, "hint") : "", T.checks ? plural(T.checks, "check") : ""].filter(Boolean).join(", ")} in that.)` : ""}`;
    $("nextBtn").textContent = "A new grid";
  } else {
    const r = S.run, sc = score(r), bits = [];
    if (r.hints) bits.push(plural(r.hints, "hint"));
    if (r.checks) bits.push(plural(r.checks, "check"));
    const best = read(TIMES, {})[bestKey(S.opts)], rv = S.rival?.plan ? rivalNow() : null, mine = sc * 1000;   // hints and checks count against you
    const vs = rv ? (rv.end < mine ? ` ${rv.name} was ${fmt((mine - rv.end) / 1000)} quicker.` : ` You beat ${rv.name} by ${fmt((rv.end - mine) / 1000)}.`) : "";
    v.textContent = `Cracked: ${fmt(sc)}${bits.length ? ` (${bits.join(", ")})` : ""}.${S.duel ? "" : S.fresh ? " A new best." : best != null ? ` Your best: ${fmt(best)}.` : ""}${vs}`;
    $("nextBtn").textContent = S.duel ? "The result" : S.mode === "daily" ? "A random grid" : "Another grid";
  }
  v.className = "cw-verdict good";
}
function render() {
  if (!P) { lobby(); return; }
  drawBoard(); drawTable(); drawKeys(); drawStrip(); drawLine(); drawMystery(); drawResult();
}
/** Before a race starts, or while a table is joined: no grid yet. */
function lobby() {
  $("board").replaceChildren();
  $("mystery").hidden = true;
  $("result").hidden = true;
  drawKeys(); drawStrip(); drawLine();
}

// ---------- together: a race on the same grid (duel.js) ----------
// Everyone at the table gets the match's grid, dealt once on the phone that starts it and sent with the match, and
// cracks it on their own phone from the moment the table starts; the others show in the strip as the letters they have.
// The lowest score (time plus hints and checks) wins. Your own grid, bests and today's stay as they were.
const duel = createDuel({
  game: "codeword", name: "Codeword", accent: "--cw-in", line: $("others"), toast, lower: true,
  deal: async () => {
    const o = { level: $("level").value, size: opts.size, mystery: opts.mystery };
    const puzzle = takeSpare(o) || await makeGrid(o, null, "Setting the grid for everyone");
    return { level: o.level, size: o.size, mystery: o.mystery, puzzle };
  },
  describe: m => `${LEVEL_NAMES[m.level] || "Medium"}, ${SIZES[m.size]?.n || 13} by ${SIZES[m.size]?.n || 13}: the same grid for everyone, the fastest to crack it wins`,
  play: (match, { begun, kept }) => {
    if (!unpack(match.puzzle)) { toast("That match's grid didn't arrive whole"); return; }
    const same = kept && kept.puzzle?.key === match.puzzle.key && kept.puzzle.nums === match.puzzle.nums && valid(kept);
    begin({ mode: "duel", duel: true, opts: { level: match.level, size: match.size, mystery: match.mystery || "" }, puzzle: match.puzzle, begun, at: same ? kept.at : null }, same ? kept.run : newRun());
    tell(S.run.done);
  },
  onLobby: match => { S = null; P = null; $("level").value = LEVEL_NAMES[match.level] ? match.level : "medium"; render(); },
  onLeave: () => solo(),
});
/** What the table sees of this grid: the letters in, and the score once it's cracked. */
function tell(done = false) {
  if (!S?.duel) return;
  const r = S.run, got = filled(P, r);
  duel.report(done ? { score: score(r), text: `${fmt(score(r))}, cracked`, done: true } : { score: 26 - got, text: `${got} of 26` });
}
let tellTimer = 0;
function tellSoon() {   // a report for every letter would be a write for every letter
  if (!S?.duel || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (S?.duel && !S.run.done) tell(); }, 1500);
}

// ---------- together: the split key (together.js; codeword-room.js) ----------
// The pair's one grid, the key split between them: seat 0 holds 1 to 13, seat 1 14 to 26. Each sees only their own
// numbers, writes letters in only for them, and suggests letters for the other's cells; the time runs from the deal.
let reported = null;
const together = createTogether({
  game: BRANCH, app: 1, toast, askName,
  valid: isTable,
  slots: 2,
  // the table, with the one who deals it already seated (sitDown hands a new table over as it's dealt)
  fresh: async players => {
    const puzzle = await makeGrid({ level: $("level").value, size: opts.size, mystery: opts.mystery, split: true }, null, "Setting the grid for you both");
    return freshTable(players, { app: 1, puzzle, asked: Number(new URLSearchParams(location.search).get("new")) || 0, now: now() });
  },
  onState: g => {
    const changedGrid = !T || T.puzzle.key !== g.puzzle.key || T.puzzle.nums !== g.puzzle.nums;
    if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || null;
    T = g;
    S = null;
    if (changedGrid) { P = puzzleOf(g); LAY = layoutOf(P); won = false; build(); at = firstAt(); $("level").value = P.level; }
    // the pair's record goes under the game's own id (together.js's result would file it under the branch's)
    if (g.done && !won) { celebrate(); const r = resultOf(g); if (r && reported !== r.match) { reported = r.match; reportDuo("codeword", r.match, r).catch(e => console.error(e)); } }
    if (!g.done) { won = false; $("board").classList.remove("won"); }
    render();
    firstDrawn?.();
  },
  onPresence: () => render(),
  onLeave: () => { T = null; stopOffset?.(); stopOffset = null; offset = 0; solo(); },
});
let firstDrawn = null;
/** A key in the split key: your number takes the letter; the other's number gets it suggested. */
function tableKey(n, ch) {
  const slot = mySlot(), partner = first(together.partner()?.name);
  if (!B.mine(n)) {
    if (B.fixed(n) || B.letter(n) === ch) return;
    together.act(g => suggest(g, slot, n, ch, now()));
    say(`Suggested ${ch.toUpperCase()} to ${partner}.`, "good");
    return;
  }
  const why = whyNot(T, slot, n, ch);
  if (why) {
    say(why === "fixed" ? `${n} is ${B.given(n) ? "given" : "shown"}: ${P.letters[n].toUpperCase()}.` : why === "taken" ? `${ch.toUpperCase()} is fixed on another number.`
      : why === "partner" ? `${ch.toUpperCase()} is on one of ${partner}'s numbers: theirs to move.` : "", "bad");
    navigator.vibrate?.(12);
    return;
  }
  together.act(g => writeIn(g, slot, n, ch, now()));
  at = { ...at, k: nextOpen(n) };
  message = null;
  render();
}
function tableDel(n) {
  const slot = mySlot();
  if (!B.mine(n)) { together.act(g => suggest(g, slot, n, "", now())); return; }
  if (B.sug(n) && !B.letter(n)) { together.act(g => wave(g, slot, n)); return; }
  together.act(g => takeOut(g, slot, n));
}

// ---------- coming to a table ----------
/**
 * A page opened in a room: a game started from Party (?party=, however many at the table) is a race, as Party offers
 * it; a pair's request is the split key or a race, whichever the first of the two to arrive prefers (the menu's A pair
 * plays), written for that request in the split key's branch so the second goes to the same. A reload, or Join from
 * the partner sheet, goes back to the table you're at.
 */
async function arrive(code) {
  const q = new URLSearchParams(location.search), at0 = Number(q.get("new")) || 0;
  try {
    const sync = await getSync(), shared = await openBranch(sync, code, BRANCH), ask = shared?.ask, cur = shared?.[BRANCH] || null;
    const fresh = !!at0 && ask?.at === at0 && ask.answer === "yes";
    if (fresh && (q.get("party") || (Number(ask.people) || 2) > 2)) return "race";
    if (!fresh) return isTable(cur) ? "split" : "race";
    let mode = cur?.asked === at0 ? (cur.mode === "race" ? "race" : "split") : null;
    if (!mode) {
      const r = await sync.tx(`crates/rooms/${code}/${BRANCH}`, now => (now?.asked === at0 ? undefined : marker(opts.pair, at0)));
      mode = r.value?.mode === "race" ? "race" : "split";
    }
    return mode;
  } catch (e) { console.error(e); return "race"; }
}
async function joinSplit(code) {
  const done = busy(joiningWords());
  try {
    const drawn = new Promise(res => { firstDrawn = res; setTimeout(res, 8000); });
    if (!(await together.join(code))) return false;
    await drawn;
    return true;
  } finally { firstDrawn = null; done(); }
}

// ---------- the menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
let pick = null;                                              // the grid the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const sizeChoice = () => choice("Size", Object.entries(SIZES).map(([k, v]) => [k, v.label]), opts.size, v => { opts.size = v; keepOpts(); });
  const kindChoice = () => choice("Mystery word", Object.entries(KINDS), opts.mystery, v => { opts.mystery = v; keepOpts(); });
  if (T) {                                                    // the split key: the table's own
    const t = part(body, "together"), partner = first(together.partner()?.name);
    t.append(line(`The split key with ${partner}: you hold ${mySlot() ? "14 to 26" : "1 to 13"}, ${partner} the rest.`),
      action(T.done ? "A new grid" : "A new grid now", () => tableNewGrid(), T.done ? "primary" : ""), action("Back to solo", () => together.leave(), "link"));
    part(body, "content").append(mirror("Level", $("level")), sizeChoice(), kindChoice());
    showMenu(body);
    return;
  }
  if (duel.on) {                                              // a race: the table's own, and what the next one deals
    duel.menu(part(body, "together"));
    part(body, "content").append(mirror("Level", $("level")), sizeChoice(), kindChoice());
    showMenu(body);
    return;
  }
  pick ??= S?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("New grid", () => confirmStart(pick), "primary"));
  const content = part(body, "content");
  content.append(choice("Grid", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") content.append(mirror("Level", $("level")), sizeChoice(), kindChoice());
  else content.append(line("Today's grid is Medium, 13 by 13: the same for everyone."));
  part(body, "together").append(choice("A pair plays", [["split", "Split key"], ["race", "Race"]], opts.pair, v => { opts.pair = v; keepOpts(); }));
  part(body, "settings").append(choice("Race the computer", Object.entries(RIVAL_NAMES), opts.rival, v => { opts.rival = v; keepOpts(); if (S && !S.run.done && S.mode !== "daily") setRival(v); }));
  const best = S ? read(TIMES, {})[bestKey(S.opts)] : null;
  part(body, "about").append(
    line(S ? `${LEVEL_NAMES[S.opts.level]}, ${SIZES[S.opts.size].n} by ${SIZES[S.opts.size].n}: ${best != null ? `best ${fmt(best)}` : "not cracked yet"}. A hint adds ${HINT} s, a check ${CHECK} s.` : "A crossword with no clues."),
    action("Copy a link to this grid", copyLink, "link"));
  showMenu(body);
}
/** Opens the menu as built, the rules at the foot of its play part. */
function showMenu(body) {
  part(body, "play").append(action("The rules", showRules, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the rules ----------
// The header's Rules and the menu's The rules: Codeword as it's played here, its numbers the rules' own, so the sheet
// can't drift from the game. A solo clock and the computer rival stand still while it's open, as for the menu (menu.js).
function showRules() {
  const sizes = Object.values(SIZES).map(s => `${s.label} ${s.n} by ${s.n}`).join(", "), day = SIZES[DAILY.size].n;
  $("rulesBody").innerHTML = `
    <p>A crossword with no clues. Every white cell holds a number from 1 to 26: the same number is always the same letter, two numbers are never the same letter, and every letter of the alphabet is somewhere in the grid. A few letters are given; crack the rest from the shapes of the words.</p>
    <p><b>For example.</b> Say 12 is T and 7 is E, and a word of three cells reads 12, 3, 7. T?E is THE, TIE or TOE, never TEE, since 3 isn't 7. Find a 3 in a word that only one of H, I and O fits, and every 3 in the grid takes that letter.</p>
    <p><b>Playing.</b> Tap a cell, then a letter: every cell of that number takes it, and the cursor moves on to the word's next empty cell. Tap the cell again, or ↔, to turn between across and down. A letter already on another number moves to this one, and that number goes blank, unless the letter is fixed there. ⌫ takes the cursor's letter out, and Undo takes back the last change. The keys show each letter in use with its number; where there's room (a tall phone, or held sideways) the key table lists 1 to 26 with their letters, and a tap on a number goes to it. On a keyboard: letters, Backspace, the arrows, and Space to turn.</p>
    <p><b>Hint and Check.</b> Hint shows the letter a strong solver would find next, for good: it's fixed like a given, marked with a corner, and the cursor goes to its word. It adds ${HINT} seconds, and nothing before it can be undone. Check strikes through, in red, every letter written in wrong, until it changes, and adds ${CHECK} seconds.</p>
    <p><b>Score.</b> The time plus the hints' and checks' seconds, lower being better; the clock shows it as it stands, and on a grid of your own it stands still while the menu or these rules are open. A grid counts the moment its last letter is right, and bests are kept for each level and size.</p>
    <p><b>Levels.</b> In the menu: Easy gives ${inWords(GIVENS.easy)} letters and never asks you to weigh more than four words at once; Medium gives ${inWords(GIVENS.medium)}, and up to eight words; Hard ${inWords(GIVENS.hard)}, and sixteen or more somewhere; Expert ${inWords(GIVENS.expert)}, and thirty or more. Size: ${sizes}. Every grid has exactly one answer.</p>
    <p><b>Mystery word.</b> In the menu, Country, Commodity or City: a row of numbered boxes under the grid spells a name of that kind, filling in as you crack its letters. Knowing the kind is a way in.</p>
    <p><b>Race the computer.</b> In Settings: Steady, Sharp or Ace solves the same grid beside you at a person's pace, how many letters it has showing under the clock, and the end says who was quicker. Not on today's grid.</p>
    <p><b>Today's grid.</b> ${LEVEL_NAMES[DAILY.level]}, ${day} by ${day}, the same for everyone, and a new one at midnight UTC. It counts the moment its last letter is right.</p>
    <p><b>Together.</b> The split key: one of you holds the numbers 1 to 13, the other 14 to 26. Each sees only their own numbers and writes letters in only for them; tap one of your partner's cells and a letter to suggest it, and they tap it to write it in. Hints and checks are the team's. Or a race: the same grid for everyone, the lowest score winning.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
async function tableNewGrid() {
  if (!T) return;
  if (!T.done && filledAt(T, P) > P.givens.length && !confirm("Start a new grid? This one isn't cracked.")) return;
  const puzzle = await makeGrid({ level: $("level").value, size: opts.size, mystery: opts.mystery, split: true }, null, "Setting the grid for you both");
  if (puzzle) together.act(g => newGrid(g, puzzle, now()));
}
function confirmStart(mode) {
  if (started() && !confirm("Start a new grid? This one isn't cracked.")) return false;
  start(mode);
  return true;
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}
/** The name a player goes by (the suite's, asked once), as duel.js asks it. */
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = document.createElement("dialog");
  dlg.className = "sheet duel-name";
  dlg.innerHTML = `<form method="dialog"><label for="cwName">Your name, so your partner knows who's playing</label>
    <input id="cwName" maxlength="24" autocomplete="nickname" enterkeyhint="go"><button class="btn primary wide" type="submit">Play</button></form>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  const input = dlg.querySelector("input");
  input.focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res(input.value.trim()), { once: true }));
  dlg.remove();
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

// ---------- the grid under a finger ----------
$("board").addEventListener("click", e => {
  const c = e.target.closest(".cw-c");
  if (!c || IN_FRAME || !P) return;
  tapCell(Number(c.dataset.k));
  const n = P.num[at.k], s = B.mine(n) ? B.sug(n) : null;
  if (s && !B.letter(n)) say(`${first(together.partner()?.name)} suggests ${s.l.toUpperCase()} for ${n}: tap it to write it in.`);
});
addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || !P) return;
  const k = e.key;
  if (/^[a-z]$/i.test(k)) { e.preventDefault(); key(k.toLowerCase()); }
  else if (k === "Backspace" || k === "Delete") { e.preventDefault(); del(); }
  else if (k === "ArrowLeft") { e.preventDefault(); step([0, -1]); }
  else if (k === "ArrowRight") { e.preventDefault(); step([0, 1]); }
  else if (k === "ArrowUp") { e.preventDefault(); step([-1, 0]); }
  else if (k === "ArrowDown") { e.preventDefault(); step([1, 0]); }
  else if (k === " " || k === "Enter") { e.preventDefault(); tapCell(at.k); }
});

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "codeword");
document.querySelector(".cw-mark").innerHTML = APPS.find(a => a.id === "codeword")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("undoBtn").addEventListener("click", back);
$("hintBtn").addEventListener("click", useHint);
$("checkBtn").addEventListener("click", useCheck);
$("nextBtn").addEventListener("click", () => { if (T) tableNewGrid(); else if (duel.on) duel.open(); else start("random"); });
$("level").addEventListener("change", () => {
  opts.level = $("level").value;
  keepOpts();
  if (T) { tableNewGrid(); return; }
  if (duel.on) { if (!duel.newMatch()) $("level").value = duel.match?.level || "medium"; return; }
  if (S && $("level").value === S.opts.level && S.mode !== "daily") return;
  if (!confirmStart("random")) $("level").value = S?.opts.level || "medium";
});
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); together.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) { duel.resync(); together.resync(); } });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const h = hashGrid(); if (!duel.on && !T && h && !same(h)) openHash(h); });
setInterval(() => {
  if (!P) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

/** The grid a link names (#s=SEED&l=LEVEL&z=SIZE&m=KIND, or #d=DAY for a day's), or null. */
function hashGrid() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  if (h.get("d")) return { seed, mode: "daily", opts: { level: DAILY.level, size: DAILY.size, mystery: DAILY.mystery } };
  return { seed, mode: "link", opts: { level: LEVEL_NAMES[h.get("l")] ? h.get("l") : "medium", size: SIZES[h.get("z")] ? h.get("z") : "medium", mystery: h.get("m") in KINDS ? h.get("m") : "" } };
}
const same = h => !!S && unpack(S.puzzle)?.seed === h.seed && S.opts.level === h.opts.level && S.opts.size === h.opts.size && (S.opts.mystery || "") === h.opts.mystery && (S.mode === "daily") === (h.mode === "daily");
async function openHash(h) {
  const puzzle = await makeGrid(h.opts, h.seed, h.mode === "daily" ? "Setting today's grid" : "Setting the grid");
  if (puzzle) begin({ mode: h.mode, opts: h.opts, puzzle });
}

// for tests and debugging
window.__codeword = {
  get state() { return S; }, get table() { return T; }, get puzzle() { return P; }, get cursor() { return at; },
  key, del, back, useHint, useCheck, tapCell, start, duel, together, get elapsed() { return elapsed(); },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's grid, still to play
async function solo() {
  T = null;
  S = read(RUN, null);
  if (!valid(S) || S.duel) S = null;
  const h = hashGrid();
  if (h && !same(h) && !IN_FRAME) { await openHash(h); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && unpack(S.puzzle).seed === today())) {
    if (!started() || confirm("Today's grid is waiting. Leave the one you've started?")) { await start("daily"); return; }
  }
  if (S) begin({ mode: S.mode, opts: S.opts, puzzle: S.puzzle, fresh: S.fresh, rival: S.rival, at: S.at }, S.run);
  else if (!IN_FRAME) await start("random");
  else render();
}
// a table in the address: its grid, with no solo one dealt under it
const room = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
if (room.length === 4 && !IN_FRAME) {
  arrive(room).then(mode => (mode === "split" ? joinSplit(room) : duel.join(room))).then(ok => { if (!ok) solo(); }, e => { console.error(e); solo(); });
} else solo();
