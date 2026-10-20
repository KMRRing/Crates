// Bulls: Mastermind and Bulls and Cows. Break a hidden code from the key pegs each guess earns (a bull for a peg right
// and in its place, a cow for a colour right but elsewhere); duel the computer, each breaking the other's code; or open a
// Lock, a code to be reasoned out from clues alone. The rules and the computer players are bulls-engine.js's, the locks
// bulls-lock.js's, playing together bulls-table.js's (Team: your guess's keys show to the others, not you; Race; Versus);
// this file draws the board and keeps the game. Everything shown is kept under bulls: keys, so a partner watching sees it.
import { VARIANTS, DAILY_VARIANT, MAKERS, LEVELS, fitting, narrow, symbolsOf, fits, invalid, daySeed, randomSeed, newBreak, guessBreak, revealed,
  newDuel, setDuelCode, duelGuess, duelReply, duelSecret, noteResult, rng } from "./bulls-engine.js";
import { LOCK_LEVELS, makeLock, lockSteps, WRONG, HINT } from "./bulls-lock.js";
import { PLAYS, KINDS, freshTable, isTable, tidy, teamGuess, teamTry, begin, setCode, ownGuess, ownTry, ownHint, keysShown, handOf, targetOf, setterOf, breakerOf,
  allSet, runOf, standings, isOver, resultOf, newGameAt, lockOf, lockReady } from "./bulls-table.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, onPause, isPaused } from "./menu.js";
import { today, arrivedForToday, IN_FRAME, soloHref } from "./suite.js";   // the day, the same for everyone (UTC); a watching frame writes nothing
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { busy, sextant } from "./loading.js";
import { scale, sideways } from "./wide.js";
import { leaderboard } from "./standings.js";

const $ = id => document.getElementById(id);
const RUN = "bulls:run", PREFS = "bulls:prefs", STATS = "bulls:stats", LOCKS = "bulls:locks", DUELS = "bulls:duels", TODAY = "bulls:count", TABLE = "bulls:table";
const APP = 1;                                 // the table's version
const THINK = { easy: 1600, medium: 1300, hard: 1000 };   // ms the computer takes over a guess, so its turn reads as a turn
const SAVE_EVERY = 5000;                       // ms between saves of a lock's clock while it runs
const NAMES = ["red", "yellow", "green", "blue", "white", "black", "purple", "orange"];
const PLACES = ["first", "second", "third", "fourth", "fifth"];

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = secs => { const s = Math.max(0, Math.round(secs)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
const empty = p => new Array(p).fill(-1);
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const list = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

// ---------- what the player has chosen ----------
const DEFAULTS = { play: "break", variant: "classic", maker: "fair", cpu: "medium", lock: "medium", aid: "off", table: { kind: "break", play: "team", variant: "classic", level: "medium" } };
let prefs = (() => {
  const p = { ...DEFAULTS, ...read(PREFS, {}) }, t = { ...DEFAULTS.table, ...(p.table || {}) };
  if (!["break", "duel", "lock"].includes(p.play)) p.play = "break";
  if (!VARIANTS[p.variant]) p.variant = "classic";
  if (!MAKERS[p.maker]) p.maker = "fair";
  if (!LEVELS[p.cpu]) p.cpu = "medium";
  if (!LOCK_LEVELS[p.lock]) p.lock = "medium";
  if (!["off", "count", "marks"].includes(p.aid)) p.aid = "off";
  if (!KINDS[t.kind]) t.kind = "break";
  if (!PLAYS[t.play] || (t.kind === "lock" && t.play === "versus")) t.play = "team";
  if (!VARIANTS[t.variant]) t.variant = "classic";
  if (!LOCK_LEVELS[t.level]) t.level = "medium";
  return { ...p, table: t };
})();
const keepPrefs = () => write(PREFS, prefs);

// ---------- the solo game ----------
// run: a game of Break (bulls-engine's, with the day for today's), a duel, or a lock { kind: "lock", level, seed, tries,
// strikes, hints, ms, done }; each with the row being entered (input, its selected peg sel), the notes (symbol -> 1
// ruled out, 2 known in) and, in a duel, which board is on show (view).
let run = null;
const LOCK_CACHE = new Map(), SLOW_LOCKS = new Set(["expert"]);
const lockFor = (level, seed) => { const k = `${level}/${seed}`; if (!LOCK_CACHE.has(k)) LOCK_CACHE.set(k, makeLock(level, seed)); return LOCK_CACHE.get(k); };
const validRun = r => !!r && Number.isInteger(r.seed) && Array.isArray(r.input) && (r.kind === "lock" ? !!LOCK_LEVELS[r.level] && Array.isArray(r.tries)
  : ["break", "duel"].includes(r.kind) && !!VARIANTS[r.variant] && Array.isArray(r.rows) && (r.kind === "break" || Array.isArray(r.cpu)));
const save = () => { if (run && !G) write(RUN, run); };
const pegsOf = r => (r.kind === "lock" ? lockFor(r.level, r.seed).p : VARIANTS[r.variant].pegs);
function withWork(r) { return { ...r, input: empty(pegsOf(r)), sel: 0, notes: {}, view: "mine" }; }
/** Whether a game is under way that a new one would leave unfinished. */
const started = () => !!run && !run.done && (run.kind === "lock" ? run.tries.length > 0 || run.hints > 0 || run.ms > 30000 : run.rows.length > 0);
function startBreak({ daily = false, variant = prefs.variant, maker = prefs.maker, seed } = {}) {
  const day = daily ? today() : null;
  run = withWork({ ...newBreak({ variant: daily ? DAILY_VARIANT : variant, maker, daily, seed: seed ?? (daily ? daySeed(day) : randomSeed()) }), day });
  begun();
}
function startDuel({ variant = prefs.variant, level = prefs.cpu, seed = randomSeed() } = {}) { run = withWork(newDuel({ variant, level, seed })); begun(); }
function startLock({ level = prefs.lock, seed = randomSeed() } = {}) {
  const deal = () => { run = withWork({ kind: "lock", level, seed, tries: [], strikes: 0, hints: 0, ms: 0, done: false }); begun(); };
  if (LOCK_CACHE.has(`${level}/${seed}`) || !SLOW_LOCKS.has(level)) { deal(); return; }
  // an Expert is one lock in twenty tried, a fraction of a second here and more on a phone: the rete turns meanwhile,
  // drawn before the work starts (it can't paint while the work holds the page)
  const done = busy("Making a lock", { delay: 0 });
  setTimeout(() => { try { lockFor(level, seed); deal(); } finally { done(); } }, 40);
}
function begun() {
  message = null;
  clockFrom = null;
  if (!IN_FRAME) history.replaceState(null, "", hashFor(run));
  save();
  clockRun();
  render();
  cpuSoon();
}
/** A game from the menu, the end panel or a link: asks before leaving one under way. */
function startPicked(how = prefs.play, opts = {}) {
  if (started() && !confirm("Start a new game? This one isn't finished.")) return false;
  if (how === "daily") startBreak({ daily: true });
  else if (how === "duel") startDuel(opts);
  else if (how === "lock") startLock(opts);
  else startBreak(opts);
  return true;
}
const dayDone = () => read(TODAY, null)?.key === today();

// ---------- the clock: a lock's time on screen ----------
let clockFrom = null, savedAt = 0;
function clockRun() {
  if (IN_FRAME || G || run?.kind !== "lock" || run.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockStop() {
  if (clockFrom == null) return;
  run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
const lockSecs = r => (r.ms + (clockFrom != null ? performance.now() - clockFrom : 0)) / 1000;
const lockScore = r => Math.round(lockSecs(r)) + WRONG * r.strikes + HINT * r.hints;

// ---------- the computer's turn in a duel ----------
let cpuTimer = 0;
function cpuSoon() {
  clearTimeout(cpuTimer);
  if (IN_FRAME || G || run?.kind !== "duel" || run.done || !run.mine || run.cpu.length >= run.rows.length) return;
  cpuTimer = setTimeout(() => {
    if (isPaused() || document.hidden) return;              // it waits with you: the menu's close starts it again
    const row = duelReply(run);
    if (!row) return;
    if (run.done) finishDuel();
    save();
    render();
  }, THINK[run.level] || 1200);
}
onPause(() => { clockStop(); clearTimeout(cpuTimer); }, () => { clockRun(); cpuSoon(); });

// ---------- the work in hand: the row being entered and the notes, solo or at the table ----------
let tableWork = null;                          // { key (the table's game), input, sel, notes, view }
function work() {
  if (!G) return run;
  const key = `${together.room?.code}/${G.created}/${G.n}`;
  if (tableWork?.key !== key) {
    const kept = read(TABLE, null);
    tableWork = kept?.key === key && Array.isArray(kept.input) ? kept : { key, input: empty(gamePegs()), sel: 0, notes: {}, view: "mine" };
  }
  return tableWork;
}
const keepWork = () => { if (G) write(TABLE, tableWork); else save(); };
const gamePegs = () => (G ? (G.game.kind === "lock" ? lockOf(G.game).p : VARIANTS[G.game.variant].pegs) : pegsOf(run));

// ---------- the model: what the screen shows, solo or at the table ----------
let message = null;                            // { text, tone } until the next move
const say = (text, tone = "") => { message = text ? { text, tone } : null; drawLine(model()); };
const COUNTS = new Map();
/** Codes still fitting after each row, worked out once a board (the aid's figures, and the end's). */
function leftAfter(variant, rows) {
  const key = `${variant}:${JSON.stringify(rows.map(r => [r.g, r.b, r.c]))}`;
  if (!COUNTS.has(key)) {
    const out = [];
    let fit = fitting(variant, []);
    for (const r of rows) { fit = narrow(variant, fit, r); out.push(fit.length); }
    COUNTS.set(key, out);
    if (COUNTS.size > 24) COUNTS.delete(COUNTS.keys().next().value);
  }
  return COUNTS.get(key);
}
/** Codes on a board, and the codes still fitting a list of rows (the last of leftAfter's, kept). */
const codesOn = variant => { const v = VARIANTS[variant]; let n = 1; for (let k = 0; k < v.pegs; k++) n *= v.repeats ? v.colours : v.colours - k; return n; };
const fitCount = (variant, rows) => (rows.length ? leftAfter(variant, rows).at(-1) : codesOn(variant));
const SYMBOLS = new Map();
function symbolsFor(variant, rows) {
  const key = `${variant}:${JSON.stringify(rows.map(r => [r.g, r.b, r.c]))}`;
  if (!SYMBOLS.has(key)) { SYMBOLS.set(key, symbolsOf(variant, rows)); if (SYMBOLS.size > 12) SYMBOLS.delete(SYMBOLS.keys().next().value); }
  return SYMBOLS.get(key);
}
/** A clue's score in words, as two short lines (the lock puzzles' own phrasing, cut to fit beside four digits). */
const lockSay = (b, c) => (!b && !c ? ["nothing", "right"] : b && c ? [`${b} in place`, `${c} misplaced`] : b ? [`${b} right`, "in place"] : [`${c} right`, "misplaced"]);

/** Everything the screen draws, from the game in hand. */
function model() {
  if (G) return tableModel();
  if (!run) return null;
  if (run.kind === "lock") return lockModel();
  if (run.kind === "duel") return duelModel();
  return breakModel();
}
function boardInfo(variant) {
  const v = VARIANTS[variant];
  return { kind: "break", variant, p: v.pegs, C: v.colours, digits: !!v.digits, repeats: v.repeats, limit: v.rows };
}
/** Break's rows as drawn: the guesses made (keys, and the codes left after each where shown), then the rows to come. */
function breakRows(info, rows, { input, showLeft, seal = () => null, by = () => null, now = true } = {}) {
  const left = showLeft ? leftAfter(info.variant, rows.filter((r, i) => !seal(r, i))) : null;
  let seen = 0;
  const out = rows.map((r, i) => {
    const sealed = seal(r, i);
    if (!sealed) seen++;
    return { n: i + 1, g: r.g, b: r.b, c: r.c, sealed, by: by(r, i), left: showLeft && !sealed ? left[seen - 1] : null, copy: true };
  });
  for (let i = rows.length; i < info.limit; i++) out.push({ n: i + 1, g: i === rows.length && now ? input : null, future: i > rows.length || !now, now: i === rows.length && now });
  return out;
}
function breakModel() {
  const info = boardInfo(run.variant), w = run, done = !!run.done, aid = prefs.aid !== "off" || done;
  const m = { ...info, rows: breakRows(info, run.rows, { input: w.input, showLeft: aid && run.rows.length > 0, now: !done }) };
  m.where = run.daily ? `Today's code · ${info.digits ? "Bulls and Cows" : "Classic"}` : `${VARIANTS[run.variant].label}${run.maker === "devious" ? " · devious" : ""}`;
  m.aside = done ? `${plural(run.rows.length, "guess", "guesses")}` : `Guess <b>${run.rows.length + 1}</b> of ${info.limit}`;
  m.shield = { open: done, code: done ? revealed(run) : null, label: done ? "The code" : "Code", note: done ? "" : prefs.aid !== "off" ? `${fitCount(run.variant, run.rows)} codes fit` : run.maker === "devious" ? "No code hidden: it answers" : "" };
  m.entry = !done;
  m.go = { text: "Guess", ok: !done };
  m.visible = run.rows;
  if (done) {
    const broke = run.done === "broken";
    m.result = { good: broke, text: broke ? `Broken in ${plural(run.rows.length, "guess", "guesses")}.` : "Not broken: the code is at the top.", small: breakNote() };
  }
  return m;
}
function breakNote() {
  if (run.daily) return run.day === today() ? "Today's code is the same for everyone; your partner's guesses show on the games screen." : "That was an earlier day's code.";
  const r = read(STATS, {})[`${run.variant}/${run.maker}`];
  return r?.broken ? `${VARIANTS[run.variant].label}${run.maker === "devious" ? ", devious" : ""}: ${r.broken} of ${r.played} broken, ${(r.guesses / r.broken).toFixed(1)} guesses on average.` : "";
}
function duelModel() {
  // held sideways both boards show at once, so the main one is always yours; on a phone the other is a tab
  const info = boardInfo(run.variant), done = !!run.done, side = sideways(), theirs = run.view === "theirs" && !!run.mine && !side;
  const m = { ...info, duel: true };
  if (!run.mine) {
    m.rows = breakRows(info, [], { input: null, now: false });
    m.where = `Duel · ${VARIANTS[run.variant].label} · ${LEVELS[run.level].label}`;
    m.aside = "";
    m.shield = { open: true, code: run.input.some(x => x >= 0) ? run.input : null, label: "Your code", note: "For the computer" };
    m.entry = true;
    m.go = { text: "Set my code", ok: true, setting: true };
    m.visible = [];
    return m;
  }
  const rows = theirs ? run.cpu : run.rows;
  m.rows = breakRows(info, rows, { input: run.input, showLeft: (prefs.aid !== "off" && !theirs) || done, now: !done && !theirs });
  m.where = `Duel · ${VARIANTS[run.variant].label} · ${LEVELS[run.level].label}`;
  m.aside = `You <b>${run.rows.length}</b> · Computer <b>${run.cpu.length}</b>`;
  if (side) m.other = { title: `Computer's guesses: ${run.cpu.length}`, code: run.mine, rows: breakRows(info, run.cpu, { now: false }) };
  else { m.tabs = [["mine", `Your guesses (${run.rows.length})`], ["theirs", `Computer's (${run.cpu.length})`]]; m.tab = theirs ? "theirs" : "mine"; }
  m.shield = theirs ? { open: true, code: run.mine, label: "Your code", note: "" }
    : { open: done, code: done ? duelSecret(run) : null, label: "Its code", note: prefs.aid !== "off" && !done ? `${fitCount(run.variant, run.rows)} codes fit` : "" };
  m.entry = !done;
  const waiting = run.rows.length > run.cpu.length;
  m.go = { text: "Guess", ok: !done && !waiting };
  m.thinking = waiting && !done;
  m.visible = run.rows;
  if (done) {
    const r = run.done;
    m.result = { good: r === "won", text: r === "won" ? `You win: broken in ${run.rows.length}.` : r === "lost" ? `The computer wins: it broke yours in ${run.cpu.length}.` : run.rows.at(-1)?.b === info.p ? `A draw: both broken in ${run.rows.length}.` : "A draw: neither code broken.",
      small: duelNote() };
  }
  return m;
}
function duelNote() {
  const r = read(DUELS, {})[`${run.variant}/${run.level}`];
  return r ? `Against ${LEVELS[run.level].label} on ${VARIANTS[run.variant].label}: ${r.won} won, ${r.lost} lost, ${r.drawn} drawn.` : "";
}
function lockModel() {
  const L = lockFor(run.level, run.seed), done = run.done;
  const m = { kind: "lock", p: L.p, C: 10, digits: true, repeats: false, limit: L.clues.length, lock: L };
  m.rows = L.clues.map((cl, i) => ({ n: i + 1, g: cl.g, b: cl.b, c: cl.c, say: lockSay(cl.b, cl.c), clue: i, hot: hotClues.includes(i) }));
  m.where = `Lock · ${LOCK_LEVELS[run.level].label}`;
  const pen = WRONG * run.strikes + HINT * run.hints;
  m.aside = `<b>${fmt(done ? run.score ?? lockScore(run) : lockSecs(run) + pen)}</b>${pen ? ` <small>+${pen} s</small>` : ""}`;
  m.shield = { open: done, code: done ? L.secret : null, label: done ? "Opened" : "Lock", note: done ? "" : `${L.p} different digits` };
  m.entry = !done;
  m.go = { text: "Open", ok: !done };
  m.hint = !done;
  if (done) {
    const best = read(LOCKS, {})[run.level]?.best;
    m.result = { good: true, text: `Opened in ${fmt(run.score)}.`, small: [run.strikes || run.hints ? `${[run.strikes ? plural(run.strikes, "wrong code") : "", run.hints ? plural(run.hints, "hint") : ""].filter(Boolean).join(" and ")}, ${WRONG} s each.` : "", best != null ? `Your best at ${LOCK_LEVELS[run.level].label}: ${fmt(best)}.` : ""].filter(Boolean).join(" ") };
  }
  return m;
}
let hotClues = [];                              // the clues the last hint read, lit

// ---------- drawing ----------
function pegEl(sym, digits, cls = "") {
  const s = el("span", `bu-peg${digits ? " digit" : ""}${cls ? ` ${cls}` : ""}`);
  if (sym == null || sym < 0) { s.classList.add("empty"); return s; }
  if (digits) s.textContent = String(sym);
  else { s.dataset.c = String(sym); s.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><use href="#bu-m${sym}"/></svg>`; }
  return s;
}
const symName = (sym, digits) => (digits ? String(sym) : NAMES[sym]);
function keysEl(b, c, p) {
  const box = el("span", "bu-keys");
  box.style.setProperty("--kc", String(Math.ceil(p / 2)));
  for (let i = 0; i < p; i++) box.append(el("i", `bu-key${i < b ? " bull" : i < b + c ? " cow" : ""}`));
  box.setAttribute("role", "img");
  box.setAttribute("aria-label", `${plural(b, "bull")}, ${plural(c, "cow")}`);
  return box;
}
/** The notes on a symbol: the player's own (1 out, 2 in), else with the aid's marks on, what the rows say. */
function markOf(sym, m, auto) {
  const own = work()?.notes?.[sym];
  if (own) return own === 1 ? "out" : "in";
  if (auto?.out.includes(sym)) return "out auto";
  if (auto?.in.includes(sym)) return "in auto";
  return "";
}
function autoMarks(m) {
  if (prefs.aid !== "marks" || m.kind !== "break" || !m.entry) return null;
  return symbolsFor(m.variant, m.visible || []);
}
function render() {
  const m = model();
  if (!m) return;
  const auto = autoMarks(m);
  $("app").classList.toggle("locking", m.kind === "lock");
  drawStrip(m); drawRival(m); drawBoard(m, auto); drawOther(m); drawEntry(m); drawPad(m, auto); drawActs(m); drawLine(m); drawResult(m);
  requestAnimationFrame(fitRows);
}
/** The other board of a duel, held sideways: the opponent's guesses at your code, your code over them. */
function drawOther(m) {
  const box = $("other");
  box.hidden = !m.other;
  if (!m.other) { box.querySelector(".bu-rows").replaceChildren(); return; }   // nothing of an earlier game left behind
  const code = el("span", "code");
  for (const x of m.other.code || []) code.append(pegEl(x, m.digits));
  box.querySelector(".bu-other-cap").textContent = m.other.title;
  box.querySelector(".bu-other-head").replaceChildren(el("span", "lab", "Your code"), code);
  box.querySelector(".bu-rows").replaceChildren(...m.other.rows.map(r => rowEl(r, m, null, false)));
}
const shown = {};
const put = (id, html) => { if (shown[id] !== html) { shown[id] = html; $(id).innerHTML = html; } };
function drawStrip(m) {
  put("where", m.where || "");
  put("aside", m.aside || "");
  drawTeam();
}
function drawRival(m) {
  const r = $("rival");
  r.hidden = !m.rival;
  if (m.rival) r.replaceChildren(...m.rival);
}
function drawBoard(m, auto) {
  const tabs = $("tabs");
  tabs.hidden = !m.tabs;
  if (m.tabs) {
    tabs.replaceChildren(...m.tabs.map(([id, text]) => {
      const b = el("button", "", text);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === m.tab));
      b.addEventListener("click", () => { const w = work(); if (w.view !== id) { w.view = id; keepWork(); render(); } });
      return b;
    }));
  }
  drawShield(m);
  const box = $("rows");
  box.replaceChildren(...m.rows.map(r => rowEl(r, m, auto)));
}
/** The code under its shutter, drawn again only when it changes; the shutter opening on a game's end turns its pegs over. */
let shieldWas = null;
function drawShield(m) {
  const s = m.shield, code = s.open && s.code ? s.code : null, sig = JSON.stringify([s.label, code, s.note, m.p, m.digits]);
  if (shieldWas?.sig === sig) return;
  const opening = !!code && shieldWas && !shieldWas.code && shieldWas.game === gameKey();
  shieldWas = { sig, code, game: gameKey() };
  const sh = $("shield"), row = el("span", "code");
  sh.className = `bu-shield${s.open ? " open" : ""}${opening ? " opening" : ""}`;
  for (let k = 0; k < m.p; k++) row.append(code ? pegEl(code[k], m.digits) : el("span", "hole", "?"));
  sh.replaceChildren(el("span", "lab", s.label), row, el("span", "note", s.note || ""));
  sh.setAttribute("aria-label", code ? `${s.label}: ${code.map(x => symName(x, m.digits)).join(", ")}` : `${s.label}: hidden`);
}
/** Which game is on the board (the shutter turns its pegs over only when that game's code comes out). */
const gameKey = () => (G ? `${G.created}/${G.n}/${work()?.view}` : run ? `${run.kind}/${run.seed}/${run.view}` : "");
function rowEl(r, m, auto, copyable = true) {
  const li = el("li", `bu-row${r.now || r.hot ? " now" : ""}${r.future ? " future" : ""}${r.sealed ? " sealed" : ""}${r.hidden ? " hidden-clue" : ""}`);
  const n = el("span", "n");
  if (r.by != null) n.append(badge(r.by)); else n.textContent = String(r.n);   // at a table: whose guess it was
  li.append(n);
  const pegs = el("span", "pegs");
  if (r.hidden) {
    for (let k = 0; k < m.p; k++) pegs.append(el("span", "bu-peg digit empty"));
  } else for (let k = 0; k < m.p; k++) {
    const sym = r.g ? r.g[k] : -1, mark = sym >= 0 && !r.now ? markOf(sym, m, auto) : "";
    const p = pegEl(sym, m.digits, mark);
    if (m.kind === "lock" && sym >= 0) p.dataset.sym = String(sym);
    pegs.append(p);
  }
  li.append(pegs);
  if (r.hidden) li.append(el("span", "say", r.hidden));
  else if (r.say) { const s = el("span", "say two"); s.append(el("span", "", r.say[0]), el("span", "", r.say[1])); li.append(s); }
  else if (r.left != null) li.append(el("span", "left", r.left === 1 ? "1 code" : `${r.left} codes`));
  else li.append(el("span"));
  if (r.sealed) li.append(el("span", "bu-sealed", r.sealed));
  else if (r.b != null && !r.hidden) li.append(keysEl(r.b, r.c, m.p));
  else li.append(el("span"));
  if (r.g && !r.now && !r.future) {
    const words = r.g.map(x => symName(x, m.digits)).join(", ");
    li.setAttribute("aria-label", r.hidden ? `Clue ${r.n}: ${r.hidden}` : `${m.kind === "lock" ? "Clue" : "Guess"} ${r.n}: ${words}${r.sealed ? `: ${r.sealed}` : r.b != null ? `: ${plural(r.b, "bull")}, ${plural(r.c, "cow")}` : ""}`);
    if (copyable && r.copy && m.entry && m.kind === "break") { li.classList.add("copyable"); li.dataset.copy = JSON.stringify(r.g); }
  }
  return li;
}
/** The rows share the board's height, as large as it lets them be; a board too short for them scrolls in its box. */
function fitRows() {
  const box = $("rows"), n = box.children.length;
  if (!n) return;
  // held sideways the board has the height; a lock's few clues may take more of it
  const s = scale(), lock = $("app").classList.contains("locking"), most = sideways() ? (lock ? 76 : 64) : lock ? 52 : 44;
  const h = Math.floor(Math.max(22 * s, Math.min(most * s, box.clientHeight / n)));
  $("board").style.setProperty("--bu-rowh", `${h.toFixed(1)}px`);
  box.querySelector(".bu-row.now")?.scrollIntoView({ block: "nearest" });
  const other = $("other"), list = other.querySelector(".bu-rows"), k = list.children.length;
  if (!other.hidden && k) other.style.setProperty("--bu-rowh", `${Math.floor(Math.max(18 * s, Math.min(36 * s, list.clientHeight / k)))}px`);
}
let wasSideways = sideways();
addEventListener("resize", () => {                             // the screen turned: sideways a duel shows both boards
  if (sideways() !== wasSideways) { wasSideways = sideways(); render(); } else requestAnimationFrame(fitRows);
});
function drawEntry(m) {
  const w = work(), box = $("entry");
  box.classList.toggle("five", m.p >= 5);
  box.style.visibility = m.entry ? "" : "hidden";
  box.replaceChildren(...w.input.map((sym, k) => {
    const b = el("button", `bu-slot${m.digits ? " digit-slot" : ""}`);
    b.type = "button";
    b.dataset.slot = String(k);
    b.setAttribute("aria-pressed", String(w.sel === k));
    b.setAttribute("aria-label", `${PLACES[k]} peg: ${sym >= 0 ? symName(sym, m.digits) : "empty"}`);
    b.append(pegEl(sym, m.digits));
    return b;
  }));
}
function drawPad(m, auto) {
  const pad = $("pad"), w = work(), C = m.digits ? 10 : m.C;
  pad.className = `bu-pad${m.digits ? " digits" : C > 6 ? " eight" : ""}${noting ? " noting" : ""}`;
  pad.style.setProperty("--cols", String(m.digits ? 5 : C));
  pad.style.visibility = m.entry ? "" : "hidden";
  pad.setAttribute("aria-label", m.digits ? "Digits" : "Colours");
  const order = m.digits ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] : [...Array(C).keys()];
  pad.replaceChildren(...order.map(sym => {
    const b = el("button", "bu-pick");
    b.type = "button";
    b.dataset.sym = String(sym);
    const mark = markOf(sym, m, auto), used = !m.repeats && w.input.includes(sym);
    if (used) b.classList.add("used");
    b.append(pegEl(sym, m.digits, mark));
    b.setAttribute("aria-label", `${symName(sym, m.digits)}${mark.startsWith("out") ? ", ruled out" : mark.startsWith("in") ? ", in the code" : ""}`);
    return b;
  }));
}
function drawActs(m) {
  const go = $("goBtn");
  go.textContent = m.go?.text || "Guess";
  go.disabled = !m.go?.ok || IN_FRAME;
  $("notesBtn").textContent = m.go?.setting ? "Random" : "Notes";
  $("notesBtn").setAttribute("aria-pressed", String(!m.go?.setting && noting));
  $("hintBtn").hidden = !m.hint;
  for (const id of ["notesBtn", "backBtn", "hintBtn"]) $(id).disabled = !m.entry || IN_FRAME;
}
function drawLine(m) {
  const l = $("line");
  l.className = `bu-line${message?.tone ? ` ${message.tone}` : ""}`;
  if (!m) { l.textContent = ""; return; }
  if (m.thinking && !message) { l.replaceChildren(sextant(), m.thinkText || "The computer is working out its guess…"); return; }
  if (m.waiting && !message) { l.replaceChildren(sextant(), m.waiting); return; }
  l.textContent = message ? message.text : m.result ? "" : m.say ?? howTo(m);
}
function howTo(m) {
  if (m.go?.setting) return m.duel ? "Set a code for the computer to break: pick pegs, or Random." : "Set a code for the next player to break: pick pegs, or Random.";
  if (m.kind === "lock") return "One code fits every clue: find it. Tap a clue's digit to rule it out, again to mark it in.";
  const w = work();
  if (prefs.aid === "marks" && w.input.every(x => x >= 0) && !fits(m.variant, m.visible || [], w.input)) return "That one can't be the code: it doesn't fit every row.";
  return noting ? `Notes: tap a ${m.digits ? "digit" : "colour"} to rule it out, again to mark it in, again to clear it.`
    : `Pick ${m.p} ${m.digits ? "different digits" : "pegs"}, then Guess. A bull ● is right and in place, a cow ○ right but elsewhere.`;
}
function drawResult(m) {
  const done = !!m.result;
  $("play").style.visibility = done ? "hidden" : "";
  $("result").hidden = !done;
  if (!done) return;
  const v = $("verdict");
  v.className = `bu-verdict${m.result.good ? " good" : ""}`;
  v.replaceChildren(m.result.text);
  if (m.result.small) v.append(el("small", "", m.result.small));
  $("moreBtn").hidden = !G;
  $("nextBtn").textContent = G ? "Another game" : run?.daily && run.day === today() ? "A random code" : "Another";
}

// ---------- taps ----------
let noting = false;                             // the Notes button: pad taps mark symbols instead of entering them
function tapPick(sym) {
  const m = model();
  if (!m?.entry || IN_FRAME) return;
  const w = work();
  if (noting && !m.go?.setting) { cycleNote(sym); return; }
  const at = w.sel != null && w.sel >= 0 && w.sel < w.input.length ? w.sel : w.input.indexOf(-1);
  if (at < 0) { say("The row is full: tap a peg in it to change that one, or Guess."); navigator.vibrate?.(10); return; }
  if (!m.repeats) { const was = w.input.indexOf(sym); if (was >= 0 && was !== at) w.input[was] = -1; }   // a digit moves rather than repeats
  w.input[at] = sym;
  const after = w.input.findIndex((x, i) => i > at && x < 0);       // on to the next empty peg, else the first, else none
  w.sel = after >= 0 ? after : w.input.indexOf(-1) >= 0 ? w.input.indexOf(-1) : null;
  message = null;
  keepWork();
  render();
}
function tapSlot(k) {
  const m = model();
  if (!m?.entry || IN_FRAME) return;
  const w = work();
  if (w.sel === k && w.input[k] >= 0) w.input[k] = -1;          // the selected peg tapped again comes out
  w.sel = k;
  keepWork();
  render();
}
function backspace() {
  const w = work();
  if (!w || IN_FRAME) return;
  let k = w.sel != null && w.input[w.sel] >= 0 ? w.sel : -1;
  if (k < 0) for (let i = w.input.length - 1; i >= 0; i--) if (w.input[i] >= 0) { k = i; break; }
  if (k < 0) return;
  w.input[k] = -1;
  w.sel = k;
  keepWork();
  render();
}
function cycleNote(sym) {
  const w = work();
  const next = ((w.notes[sym] || 0) + 1) % 3;
  if (next) w.notes[sym] = next; else delete w.notes[sym];
  keepWork();
  render();
}
function copyRow(g) {
  const w = work(), m = model();
  if (!m?.entry || !Array.isArray(g) || g.length !== w.input.length) return;
  w.input = g.slice();
  w.sel = null;
  keepWork();
  say("That row is in the entry: change a peg and Guess.");
  render();
}
function randomCode() {
  const m = model(), w = work();
  if (!m?.go?.setting) return;
  const r = rng(randomSeed()), C = m.digits ? 10 : m.C, code = [];
  while (code.length < m.p) { const x = Math.floor(r() * C); if (m.repeats || !code.includes(x)) code.push(x); }
  w.input = code;
  w.sel = null;
  keepWork();
  render();
}
/** The main button: guess, set your code, or try a lock's code. */
function go() {
  if (IN_FRAME) return;
  if (G) { goTable(); return; }
  const w = run, input = w.input.slice();
  if (run.kind === "lock") { tryLock(input); return; }
  if (run.kind === "duel" && !run.mine) {
    const bad = setDuelCode(run, input);
    if (bad) { say(bad, "bad"); return; }
    w.input = empty(input.length); w.sel = 0; message = null;
    save(); render();
    return;
  }
  const res = run.kind === "duel" ? duelGuess(run, input) : guessBreak(run, input);
  if (res.error) { say(res.error, "bad"); navigator.vibrate?.(15); return; }
  w.input = empty(input.length); w.sel = 0; message = null;
  if (run.kind === "break" && run.done) finishBreak();
  save(); render();
  cpuSoon();
}
function tryLock(input) {
  const L = lockFor(run.level, run.seed);
  if (input.some(x => x < 0)) { say(`Fill all ${L.p} digits.`, "bad"); return; }
  if (new Set(input).size < input.length) { say("Every digit is different.", "bad"); return; }
  run.tries.push(input);
  if (input.every((d, k) => d === L.secret[k])) {
    clockStop();
    run.done = true;
    run.score = lockScore(run);
    const all = read(LOCKS, {}), r = all[run.level] || { opened: 0, total: 0, best: null };
    r.opened++; r.total += run.score;
    if (r.best == null || run.score < r.best) r.best = run.score;
    all[run.level] = r;
    write(LOCKS, all);
    message = null;
    navigator.vibrate?.([20, 40, 20]);
  } else {
    run.strikes++;
    say(`Not that one: ${WRONG} seconds on the clock. Every clue holds it.`, "bad");
    navigator.vibrate?.(60);
  }
  save(); render();
}
function useHint() {
  if (IN_FRAME) return;
  if (G) { hintTable(); return; }
  if (run?.kind !== "lock" || run.done) return;
  const L = lockFor(run.level, run.seed), steps = lockSteps(L.p, L.clues);
  const step = steps[Math.min(run.hints, steps.length - 1)];
  if (!step) return;
  if (run.hints < steps.length) run.hints++;
  noteStep(run, step);
  hotClues = step.clues;
  say(`Hint: ${step.text} (+${HINT} s)`, "good");
  save(); render();
}
/** What a hint says, on the notes: digits ruled out struck, digits found ringed. */
function noteStep(w, step) {
  for (const d of step.out) w.notes[d] = 1;
  for (const d of [...step.in, ...step.at.map(([, d]) => d)]) w.notes[d] = 2;
}
function finishBreak() {
  if (IN_FRAME) return;
  const all = read(STATS, {}), key = `${run.variant}/${run.maker}`;
  all[key] = noteResult(all[key], run);
  write(STATS, all);
  // today's code counts the moment it's broken (or its rows run out), the first finish of the day only
  if (run.daily && run.day === today() && !dayDone()) write(TODAY, { key: run.day, v: run.done === "broken" ? run.rows.length : 0 });
  navigator.vibrate?.(run.done === "broken" ? [20, 40, 20] : 80);
}
function finishDuel() {
  const all = read(DUELS, {}), key = `${run.variant}/${run.level}`, r = all[key] || { won: 0, lost: 0, drawn: 0 };
  r[run.done === "won" ? "won" : run.done === "lost" ? "lost" : "drawn"]++;
  all[key] = r;
  write(DUELS, all);
}

// ---------- together: the table (together.js; bulls-table.js its rules) ----------
let G = null, offset = 0, stopOffset = null, shownOver = null, beginAsked = null, joining = null;
const now = () => Date.now() + offset;
const joined = () => { joining?.(); joining = null; };
const people = () => (together.room && together.slot != null
  ? [{ slot: together.slot, name: together.room.name, me: true, here: true }, ...together.others()].sort((a, b) => a.slot - b.slot) : []);
const nameOf = slot => { const p = people().find(x => x.slot === slot); return p?.me ? "You" : first(p?.name); };
const present = () => people().filter(p => p.here).map(p => p.slot);
function badge(slot) {
  const p = people().find(x => x.slot === slot), b = el("i", "bu-by", (Array.from(first(p?.name))[0] || "?").toUpperCase());
  b.style.setProperty("--who", `var(--p${slot % 6})`);
  b.setAttribute("aria-hidden", "true");
  return b;
}
function drawTeam() {
  const box = $("team");
  box.hidden = !G;
  if (!G) return;
  const all = people();
  box.replaceChildren(...all.map(p => { const b = badge(p.slot); b.classList.toggle("me", !!p.me); b.classList.toggle("away", !p.here); b.title = `${p.me ? "You" : p.name}${p.here ? "" : " (away)"}`; return b; }));
  box.setAttribute("aria-label", `At the table: ${all.map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`).join(", ")}`);
}
const describe = G0 => `${PLAYS[G0.play]} ${G0.kind === "lock" ? `Lock, ${LOCK_LEVELS[G0.level].label}` : `Break, ${VARIANTS[G0.variant].label}`}`;
/** The table's game, as this seat sees it. */
function tableModel() {
  const T = G.game, me = together.slot, w = work(), over = isOver(T, present());
  const m = T.kind === "lock" ? { kind: "lock", p: lockOf(T).p, C: 10, digits: true, repeats: false, lock: lockOf(T) } : boardInfo(T.variant);
  m.where = describe(T);
  m.rival = rivalLine(T, me);
  if (T.kind === "lock") return tableLock(T, me, m, over);
  if (T.play === "team") {
    const B = T.board, done = !!B.done, others = people().filter(p => !p.me).map(p => first(p.name));
    const seal = r => (keysShown(T, r, me) ? null : others.length === 1 ? `ask ${others[0]}` : "ask them");
    m.rows = breakRows(m, B.rows, { input: w.input, showLeft: prefs.aid !== "off" || done, seal, by: r => r.by, now: !done });
    m.visible = B.rows.filter(r => keysShown(T, r, me));
    m.aside = done ? plural(B.rows.length, "guess", "guesses") : `Guess <b>${B.rows.length + 1}</b> of ${m.limit}`;
    m.shield = { open: done, code: done ? targetOf(T, me) : null, label: done ? "The code" : "Code", note: done ? "" : prefs.aid !== "off" ? `${fitCount(T.variant, m.visible)} fit what you see` : "Keys go to the others" };
    m.entry = !done;
    m.go = { text: "Guess", ok: !done };
    if (!done && B.rows.at(-1)?.by === me && !keysShown(T, B.rows.at(-1), me)) m.say = `Your guess is scored on the others' screens: ask ${list(people().filter(p => !p.me).map(p => first(p.name))) || "them"} what it got.`;
    if (done) m.result = { good: B.done.how === "broken", text: B.done.how === "broken" ? `Broken together in ${B.rows.length}${B.done.by != null ? `: ${nameOf(B.done.by) === "You" ? "your" : `${nameOf(B.done.by)}'s`} guess` : ""}.` : "Not broken: the code is at the top.", small: "Every key shows to everyone now." };
    return m;
  }
  // Race and Versus: this seat's own board
  const S = T.seats?.[`s${me}`], inRing = T.ring.includes(me);
  if (T.play === "versus" && inRing && !T.codes?.[`s${me}`]?.length) {
    m.rows = breakRows(m, [], { input: null, now: false });
    m.aside = "";
    const breaker = breakerOf(T, me);
    m.shield = { open: true, code: w.input.some(x => x >= 0) ? w.input : null, label: "Your code", note: `For ${nameOf(breaker)}` };
    m.entry = true;
    m.go = { text: "Set my code", ok: true, setting: true };
    m.visible = [];
    return m;
  }
  const side = sideways(), theirs = T.play === "versus" && w.view === "theirs" && inRing && !side;
  if (T.play === "versus" && inRing) {
    const b = breakerOf(T, me), theirRows = T.seats?.[`s${b}`]?.rows || [];
    if (side) m.other = { title: `${nameOf(b)}'s guesses: ${theirRows.length}`, code: T.codes[`s${me}`], rows: breakRows(m, theirRows, { now: false }) };
    else { m.tabs = [["mine", `Yours (${S?.rows.length || 0})`], ["theirs", `${nameOf(b)}'s on yours (${theirRows.length})`]]; m.tab = theirs ? "theirs" : "mine"; }
  }
  if (theirs) {
    const b = breakerOf(T, me), theirRows = T.seats?.[`s${b}`]?.rows || [];
    m.rows = breakRows(m, theirRows, { input: null, showLeft: false, now: false });
    m.shield = { open: true, code: T.codes[`s${me}`], label: "Your code", note: "" };
    m.entry = false;
    m.go = { text: "Guess", ok: false };
    m.aside = `${plural(theirRows.length, "guess", "guesses")}`;
    if (over) m.result = tableResult(T, me);
    return m;
  }
  const rows = S?.rows || [], done = !!S?.done;
  m.rows = breakRows(m, rows, { input: w.input, showLeft: prefs.aid !== "off" || done, now: !done && !!S });
  m.visible = rows;
  m.aside = done ? plural(rows.length, "guess", "guesses") : `Guess <b>${rows.length + 1}</b> of ${m.limit}`;
  const target = S ? targetOf(T, me) : null;
  m.shield = { open: done, code: done ? target : null, label: done ? "The code" : T.play === "versus" ? `${nameOf(setterOf(T, me))}'s code` : "Code", note: done ? "" : prefs.aid !== "off" && S ? `${fitCount(T.variant, rows)} codes fit` : "" };
  m.entry = !!S && !done;
  m.go = { text: "Guess", ok: !!S && !done };
  if (!S) m.waiting = T.play === "versus" ? (inRing ? `Waiting for ${list(T.ring.filter(s => !T.codes?.[`s${s}`]?.length).map(s => first(nameOf(s))))} to set a code` : "This game began before you sat down: you're in the next one") : "Starting…";
  if (done) m.result = over ? tableResult(T, me) : { good: S.done === "broken", text: S.done === "broken" ? `Broken in ${rows.length}.` : "Not broken.", small: "Waiting for the others to finish." };
  return m;
}
function tableLock(T, me, m, over) {
  const L = m.lock, w = work();
  if (T.play === "team") {
    const B = T.board, mine = handOf(T, me), done = !!B.done;
    const holders = i => T.ring.filter(s => handOf(T, s).includes(i));
    m.rows = L.clues.map((cl, i) => (mine.includes(i) || done ? { n: i + 1, g: cl.g, b: cl.b, c: cl.c, say: lockSay(cl.b, cl.c), clue: i }
      : { n: i + 1, g: null, hidden: `${list(holders(i).map(s => first(nameOf(s))))}'s clue` }));
    m.aside = `<b>${fmt(((done ? B.done.at : now()) - T.dealt) / 1000 + WRONG * B.strikes)}</b>${B.strikes ? ` <small>${plural(B.strikes, "strike")}</small>` : ""}`;
    m.shield = { open: done, code: done ? L.secret : null, label: done ? "Opened" : "Lock", note: done ? "" : mine.length ? `You hold ${plural(mine.length, "clue")} of ${L.clues.length}` : "No clues for you this game" };
    m.entry = !done;
    m.go = { text: "Open", ok: !done };
    const last = B.tries.at(-1);
    if (!done && last && !last.ok) m.say = `${nameOf(last.by)} tried ${last.a.join(" ")}: not it (+${WRONG} s). Tell each other your clues.`;
    if (done) m.result = { good: true, text: `Opened together in ${fmt(runOf(T, me).secs)}${B.done.by != null ? `: ${nameOf(B.done.by) === "You" ? "you" : nameOf(B.done.by)} found it` : ""}.`, small: B.strikes ? `${plural(B.strikes, "wrong code")} on the way.` : "" };
    return m;
  }
  const S = T.seats?.[`s${me}`], done = !!S?.done;
  m.rows = L.clues.map((cl, i) => ({ n: i + 1, g: cl.g, b: cl.b, c: cl.c, say: lockSay(cl.b, cl.c), clue: i, hot: hotClues.includes(i) }));
  const secs = S ? ((S.at ?? now()) - S.from) / 1000 + WRONG * (S.strikes + S.hints) : 0;
  m.aside = `<b>${fmt(secs)}</b>${S && (S.strikes || S.hints) ? ` <small>+${WRONG * (S.strikes + S.hints)} s</small>` : ""}`;
  m.shield = { open: done, code: done ? L.secret : null, label: done ? "Opened" : "Lock", note: `${L.p} different digits` };
  m.entry = !!S && !done;
  m.go = { text: "Open", ok: !!S && !done };
  m.hint = !!S && !done;
  if (!S) m.waiting = "Starting…";
  if (done) m.result = over ? tableResult(T, me) : { good: true, text: `Opened in ${fmt(runOf(T, me).secs)}.`, small: "Waiting for the others to finish." };
  return m;
}
function tableResult(T, me) {
  const rows = standings(T), mine = rows.find(r => r.slot === me), tops = rows.filter(r => r.rank === 1);
  const text = tops.length > 1 ? (tops.some(r => r.slot === me) ? "A draw." : `${list(tops.map(r => nameOf(r.slot)))} share it.`) : tops[0]?.slot === me ? "You win." : `${nameOf(tops[0]?.slot)} wins.`;
  const how = mine ? (T.kind === "lock" ? `You opened it in ${fmt(mine.run.secs)}.` : mine.run.done === "broken" ? `You broke it in ${mine.run.guesses}.` : "You didn't break it.") : "";
  return { good: tops.length === 1 && tops[0]?.slot === me, text, small: how };
}
/** The others at the table as they go: their guesses (never what they guessed), or their time once done. */
function rivalLine(T, me) {
  if (T.play === "team") return null;
  const out = [];
  for (const p of people().filter(x => !x.me)) {
    const S = T.seats?.[`s${p.slot}`], r = S ? runOf(T, p.slot) : null;
    let text;
    if (!S) text = T.play === "versus" && T.ring.includes(p.slot) && !T.codes?.[`s${p.slot}`]?.length ? "setting a code" : p.here ? "not begun" : "away";
    else if (S.done) text = T.kind === "lock" ? `open ${fmt(r.secs)} ✓` : S.done === "broken" ? `${r.guesses} ✓` : "not broken";
    else text = T.kind === "lock" ? `${plural(S.tries.length, "try", "tries")}` : `${plural(S.rows.length, "guess", "guesses")}`;
    const span = el("span");
    span.append(el("b", "", first(p.name)), ` ${text}`);
    if (out.length) out.push(" · ");
    out.push(span);
  }
  return out.length ? out : null;
}
function maybeBegin() {
  const T = G?.game;
  if (!T || T.play === "team" || T.seats?.[`s${together.slot}`] || beginAsked === G.n) return;
  if (T.play === "versus" && (!T.ring.includes(together.slot) || !allSet(T))) return;
  beginAsked = G.n;
  const n = G.n, slot = together.slot;
  together.act(g => begin(tidy(g), { n, slot, now: now() })).then(ok => { if (!ok && G?.n === n) beginAsked = null; });
}
async function goTable() {
  const T = G.game, w = work(), input = w.input.slice(), n = G.n, slot = together.slot;
  let out = null;
  const clear = () => { w.input = empty(input.length); w.sel = 0; keepWork(); };
  if (T.kind === "break" && T.play === "versus" && !T.codes?.[`s${slot}`]?.length) {
    const bad = invalid(T.variant, input);
    if (bad) { say(bad, "bad"); return; }
    await together.act(g => { out = setCode(tidy(g), { n, slot, code: input, now: now() }); return out === "ok"; });
    if (out === "ok" || out === "set") { clear(); render(); } else if (out) say(out === "moved" ? "The table moved on" : out, "bad");
    return;
  }
  if (T.kind === "lock") {
    if (input.some(x => x < 0)) { say(`Fill all ${lockOf(T).p} digits.`, "bad"); return; }
    if (new Set(input).size < input.length) { say("Every digit is different.", "bad"); return; }
    await together.act(g => { out = (T.play === "team" ? teamTry : ownTry)(tidy(g), { n, slot, answer: input, now: now() }); return out === "open" || out === "wrong"; });
    if (out === "wrong") { say(`Not that one: ${WRONG} seconds on the clock.`, "bad"); navigator.vibrate?.(60); }
    else if (out === "open") { clear(); navigator.vibrate?.([20, 40, 20]); }
    else if (out) say(out === "over" ? "It's already open" : out === "moved" ? "The table moved on" : out, "bad");
    render();
    return;
  }
  const bad = invalid(T.variant, input);
  if (bad) { say(bad, "bad"); return; }
  const seen = T.play === "team" ? T.board.rows.length : T.seats?.[`s${slot}`]?.rows.length ?? 0;
  await together.act(g => { out = (T.play === "team" ? teamGuess : ownGuess)(tidy(g), { n, slot, seen, guess: input, now: now() }); return ["ok", "broken", "out"].includes(out); });
  if (["ok", "broken", "out"].includes(out)) { clear(); message = null; }
  else if (out === "taken") say(T.play === "team" ? `Too late: ${nameOf(G.game.board?.rows.at(-1)?.by)} guessed first. Your row is still there.` : "That guess was already in.", "bad");
  else if (out) say(out === "moved" ? "The table moved on" : out === "over" ? "It's over" : out, "bad");
  render();
}
async function hintTable() {
  const T = G.game, S = T.seats?.[`s${together.slot}`];
  if (T.kind !== "lock" || T.play !== "race" || !S || S.done) return;
  const n = G.n, slot = together.slot, seen = S.hints, L = lockOf(T), steps = lockSteps(L.p, L.clues), step = steps[Math.min(seen, steps.length - 1)];
  if (!step) return;
  const ok = await together.act(g => ownHint(tidy(g), { n, slot, seen }));
  if (!ok) return;
  const w = work();
  noteStep(w, step);
  keepWork();
  hotClues = step.clues;
  say(`Hint: ${step.text} (+${HINT} s)`, "good");
  render();
}
/** A new game for the table, as this player's menu sets it (asked first while one is under way). */
async function dealAgain() {
  if (!G) return;
  const T = G.game, over = isOver(T, present()), mid = !over && (T.play === "team" ? (T.board.rows?.length || T.board.tries?.length) : Object.keys(T.seats || {}).length);
  if (mid && !confirm("Deal a new game for the table? This one isn't finished.")) return;
  const n = G.n, slots = people().map(p => p.slot);
  await together.act(g => newGameAt(tidy(g), { n, deal: { ...prefs.table, seed: randomSeed() }, slots, now: now() }));
}
function openDone() {
  const T = G.game, me = together.slot, body = $("doneBody");
  body.replaceChildren();
  const res = T.play === "team" ? null : tableResult(T, me);
  $("doneTitle").textContent = T.play === "team" ? (T.kind === "lock" || T.board.done.how === "broken" ? "Together" : "Not this time") : res.text.replace(/\.$/, "");
  if (T.play === "team") {
    const r = runOf(T, me);
    body.append(el("p", "", T.kind === "lock" ? `Opened in ${fmt(r.secs)}${T.board.strikes ? `, with ${plural(T.board.strikes, "wrong code")}` : ""}.` : T.board.done.how === "broken" ? `Broken in ${plural(r.guesses, "guess", "guesses")}, in ${fmt(r.ms / 1000)}.` : "The rows ran out."));
  } else {
    body.append(leaderboard(standings(T).map(r => ({ name: nameOf(r.slot), seat: r.slot, me: r.slot === me,
      value: r.run.score ?? 999, shown: T.kind === "lock" ? fmt(r.run.secs ?? 0) : r.run.done === "broken" ? `${r.run.guesses} · ${fmt((r.run.ms || 0) / 1000)}` : "not broken",
      note: T.kind === "lock" ? (r.run.strikes || r.run.hints ? `${[r.run.strikes ? plural(r.run.strikes, "wrong code") : "", r.run.hints ? plural(r.run.hints, "hint") : ""].filter(Boolean).join(", ")}` : "") : "" })), { lower: true }));
    body.append(el("p", "", T.kind === "lock" ? "The quickest wins: time, and 30 seconds for each wrong code or hint." : "The fewest guesses wins, then the quicker."));
  }
  body.append(action("Another game", () => { $("doneDlg").close(); dealAgain(); }, "primary"), action("Back to solo", () => { $("doneDlg").close(); backToSolo(); }, "link"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
let making = null;                              // the table's Expert lock being made, behind the rete
function onState(val) {
  const next = tidy(structuredClone(val));
  if (!lockReady(next.game)) {                                // made once a phone, the rete turning meanwhile
    const key = `${next.created}/${next.n}`;
    if (making !== key) {
      making = key;
      const done = busy("Making the lock", { delay: 0 });
      setTimeout(() => { try { lockOf(next.game); } finally { done(); making = null; } if (together.room?.data) onState(together.room.data); }, 40);
    }
    return;
  }
  joined();
  const was = G;
  G = next;
  if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
  if (was?.n !== G.n) {
    hotClues = []; message = null; noting = false;
    if ($("doneDlg").open) $("doneDlg").close();
    if (was) toast("A new game");
  }
  maybeBegin();
  render();
  if (isOver(G.game, present()) && shownOver !== G.n) { shownOver = G.n; openDone(); }
}
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "bulls",
  app: APP,
  toast,
  askName,
  valid: isTable,
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => freshTable(players, { app: APP, people: ask?.people, now: Date.now(), deal: { ...prefs.table, seed: randomSeed() } }),
  onState,
  onPresence: () => { if (G) { render(); if (isOver(G.game, present()) && shownOver !== G.n) { shownOver = G.n; openDone(); } } },
  onLeave: () => {
    joined();
    G = null; shownOver = null; beginAsked = null; tableWork = null; hotClues = []; message = null;
    stopOffset?.(); stopOffset = null;
    if ($("doneDlg").open) $("doneDlg").close();
    solo();
  },
  result: g => resultOf(tidy(structuredClone(g)), together.slot, present()),
});
const backToSolo = () => { if (together.room) together.leave(); else location.replace(soloHref()); };

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room || joining) { tableMenu(body); return; }
  pickDaily ??= run?.kind === "break" && run.daily ? true : !dayDone();         // today's first, while it's still to play
  part(body, "play").append(action(run && !run.done ? "New game" : "Play again", () => startPicked(prefs.play === "break" && pickDaily ? "daily" : prefs.play), "primary"));
  const content = part(body, "content");
  content.append(choice("Play", [["break", "Break"], ["duel", "Duel"], ["lock", "Lock"]], prefs.play, v => { prefs.play = v; keepPrefs(); openMenu(); }));
  if (prefs.play === "break") {
    content.append(choice("Code", [["random", "Random"], ["daily", "Today's"]], pickDaily ? "daily" : "random", v => { pickDaily = v === "daily"; openMenu(); }));
    if (pickDaily) content.append(line(`Today's code is Classic, the same for everyone${dayDone() ? `: ${todayWords()}` : ""}.`));
    else content.append(boardChoice(), choice("Codemaker", Object.entries(MAKERS), prefs.maker, v => { prefs.maker = v; keepPrefs(); }));
  } else if (prefs.play === "duel") {
    content.append(boardChoice(), choice("Computer", Object.entries(LEVELS).map(([k, x]) => [k, x.label]), prefs.cpu, v => { prefs.cpu = v; keepPrefs(); }));
  } else {
    content.append(choice("Level", Object.entries(LOCK_LEVELS).map(([k, x]) => [k, x.label]), prefs.lock, v => { prefs.lock = v; keepPrefs(); openMenu(); }), line(LOCK_LEVELS[prefs.lock].about));
  }
  part(body, "settings").append(choice("Help", [["off", "Off"], ["count", "Count"], ["marks", "Marks"]], prefs.aid, v => { prefs.aid = v; keepPrefs(); render(); }));
  part(body, "about").append(line(aboutLine()), action("Copy a link to this game", copyLink, "link"));
  const how = el("p", "note", "Mastermind (1970) came from Bulls and Cows, a pencil game older than anyone remembers. Each guess earns a bull for every peg of the right colour in its place and a cow for every other of a colour the code holds. Break: the computer hides a code; Devious hides none and answers to keep the most codes alive, so only skill breaks it. Duel: you and the computer each break the other's code, turn about. Lock: no guessing, the clues alone hold the code. Help counts the codes still possible (Count) and marks the colours ruled out or in (Marks).");
  body.append(how);
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
let pickDaily = null;                           // the menu's Code choice for Break: today's or a random one
const boardChoice = () => choice("Board", Object.entries(VARIANTS).map(([k, v]) => [k, v.label]), prefs.variant, v => { prefs.variant = v; keepPrefs(); });
function todayWords() { const t = read(TODAY, null); return t?.key === today() ? (t.v ? `you broke it in ${t.v}` : "you didn't break it") : ""; }
function aboutLine() {
  if (run?.kind === "lock") { const r = read(LOCKS, {})[run.level]; return r?.opened ? `${LOCK_LEVELS[run.level].label} locks: ${r.opened} opened, best ${fmt(r.best)}, ${fmt(r.total / r.opened)} on average.` : `${LOCK_LEVELS[run.level].label} locks: none opened yet.`; }
  if (run?.kind === "duel") return duelNote() || "No duels finished on this board yet.";
  const today_ = dayDone() ? `Today's code: ${todayWords()}. ` : "";
  return `${today_}${(run && breakNote()) || "No codes broken on this board yet."}`;
}
function tableMenu(body) {
  const table = part(body, "together");
  if (!G) { const wait = line(joiningWords()); wait.prepend(sextant()); table.append(wait, action("Back to solo", backToSolo, "link")); if (!$("menuDlg").open) $("menuDlg").showModal(); return; }
  const t = prefs.table, set = (k, v) => { prefs.table = { ...prefs.table, [k]: v }; if (prefs.table.kind === "lock" && prefs.table.play === "versus") prefs.table.play = "team"; keepPrefs(); openMenu(); };
  table.append(line(`This game: ${describe(G.game)}.`), action("New game for the table", dealAgain, "primary"),
    choice("Play", Object.entries(PLAYS).filter(([k]) => !(t.kind === "lock" && k === "versus")), t.play, v => set("play", v)),
    choice("Game", Object.entries(KINDS), t.kind, v => set("kind", v)),
    t.kind === "break" ? choice("Board", Object.entries(VARIANTS).map(([k, v]) => [k, v.label]), t.variant, v => set("variant", v))
      : choice("Level", Object.entries(LOCK_LEVELS).map(([k, x]) => [k, x.label]), t.level, v => set("level", v)));
  const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
  table.append(line(`At the table: ${list(all)}. The choices are for the next game.`), action("Back to solo", backToSolo, "link"));
  part(body, "settings").append(choice("Help", [["off", "Off"], ["count", "Count"], ["marks", "Marks"]], prefs.aid, v => { prefs.aid = v; keepPrefs(); render(); }));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- links ----------
function hashFor(r) {
  if (!r) return location.pathname + location.search;
  if (r.kind === "lock") return `#l=${r.seed}&lv=${r.level}`;
  if (r.kind === "duel") return `#u=${r.seed}&v=${r.variant}&c=${r.level}`;
  return r.daily ? `#d=${r.day}` : `#b=${r.seed}&v=${r.variant}&m=${r.maker}`;
}
/** The game a link names (#b= a code, #d= a day's, #u= a duel, #l= a lock), or null. */
function linked() {
  const h = new URLSearchParams(location.hash.slice(1));
  const n = k => { const x = Number(h.get(k)); return Number.isInteger(x) && x > 0 ? x : null; };
  if (n("l")) return { kind: "lock", seed: n("l"), level: LOCK_LEVELS[h.get("lv")] ? h.get("lv") : "medium" };
  if (n("u")) return { kind: "duel", seed: n("u"), variant: VARIANTS[h.get("v")] ? h.get("v") : "classic", level: LEVELS[h.get("c")] ? h.get("c") : "medium" };
  if (n("d")) return { kind: "break", daily: true, day: n("d") };
  if (n("b")) return { kind: "break", seed: n("b"), variant: VARIANTS[h.get("v")] ? h.get("v") : "classic", maker: MAKERS[h.get("m")] ? h.get("m") : "fair" };
  return null;
}
const sameGame = (r, l) => !!r && !!l && r.kind === l.kind && (l.daily ? r.daily && r.day === l.day : r.seed === l.seed && (r.variant ?? null) === (l.variant ?? null) && (r.level ?? null) === (l.level ?? null) && (r.maker ?? "fair") === (l.maker ?? "fair"));
function startLinked(l) {
  if (l.kind === "lock") startLock(l);
  else if (l.kind === "duel") startDuel(l);
  else if (l.daily) { run = withWork({ ...newBreak({ variant: DAILY_VARIANT, daily: true, seed: daySeed(l.day) }), day: l.day }); begun(); }
  else startBreak(l);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${hashFor(run)}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "bulls");
document.querySelector(".bu-mark").innerHTML = APPS.find(a => a.id === "bulls")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneDlg").addEventListener("click", e => { if (e.target === $("doneDlg")) $("doneDlg").close(); });
$("pad").addEventListener("click", e => { const b = e.target.closest(".bu-pick"); if (b) tapPick(Number(b.dataset.sym)); });
$("entry").addEventListener("click", e => { const b = e.target.closest(".bu-slot"); if (b) tapSlot(Number(b.dataset.slot)); });
$("rows").addEventListener("click", e => {
  const m = model();
  if (!m?.entry || IN_FRAME) return;
  const peg = e.target.closest(".bu-peg[data-sym]");
  if (m.kind === "lock" && peg) { cycleNote(Number(peg.dataset.sym)); return; }   // a lock's digits are crossed out where they stand
  const row = e.target.closest(".bu-row.copyable");
  if (row) copyRow(JSON.parse(row.dataset.copy));
});
$("goBtn").addEventListener("click", go);
$("backBtn").addEventListener("click", backspace);
$("hintBtn").addEventListener("click", useHint);
$("notesBtn").addEventListener("click", () => { if (model()?.go?.setting) { randomCode(); return; } noting = !noting; message = null; render(); });
$("nextBtn").addEventListener("click", () => {
  if (G) { dealAgain(); return; }
  if (run?.daily && run.day === today()) startBreak();
  else startPicked(run?.kind === "duel" ? "duel" : run?.kind === "lock" ? "lock" : "break", run?.kind === "break" ? { variant: run.variant, maker: run.maker } : run?.kind === "duel" ? { variant: run.variant, level: run.level } : { level: run?.level });
});
$("moreBtn").addEventListener("click", () => { if (G) openDone(); });
document.addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]") || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea")) return;
  const m = model();
  if (!m?.entry) return;
  if (e.key === "Enter") { e.preventDefault(); go(); }
  else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
  else if (/^[0-9]$/.test(e.key)) {
    const d = Number(e.key), sym = m.digits ? d : d - 1;           // colours by 1 to 8, as the pad lists them
    if (sym >= 0 && sym < (m.digits ? 10 : m.C)) tapPick(sym);
  }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) clockStop(); else { clockRun(); cpuSoon(); together.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("pagehide", () => clockStop());
window.addEventListener("hashchange", () => { const l = linked(); if (!G && l && !sameGame(run, l)) startLinked(l); });
setInterval(() => {
  const m = model();
  if (!m || m.kind !== "lock") return;
  put("aside", m.aside || "");                                 // the clock
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockStop(); clockRun(); savedAt = performance.now(); }
}, 500);

function solo() {
  run = read(RUN, null);
  if (!validRun(run)) run = null;
  const l = linked();
  if (l && !sameGame(run, l) && !IN_FRAME) { startLinked(l); return; }
  if (arrivedForToday() && !IN_FRAME && !(run?.daily && run.day === today())) {
    if (!started() || confirm("Today's code is waiting. Leave the game you've started?")) { startBreak({ daily: true }); return; }
  }
  if (run?.done && !dayDone() && !IN_FRAME) { startBreak({ daily: true }); return; }   // a game over gives way to today's code, while it's still to play
  if (run) {
    const resume = () => { clockRun(); render(); cpuSoon(); };
    if (run.kind === "lock" && SLOW_LOCKS.has(run.level) && !LOCK_CACHE.has(`${run.level}/${run.seed}`)) {
      const done = busy("Making the lock", { delay: 0 });
      setTimeout(() => { try { lockFor(run.level, run.seed); resume(); } finally { done(); } }, 40);
    } else resume();
    return;
  }
  if (IN_FRAME) return;
  if (!dayDone()) startBreak({ daily: true }); else startPicked(prefs.play);   // a first visit of the day opens on today's code
}

// for tests and debugging
window.__bulls = { get run() { return run; }, get table() { return G; }, get prefs() { return prefs; }, model, go, tapPick, tapSlot, backspace, useHint, startPicked, together };

// a table in the address (a duo match, a party's game): the rete until it's drawn, and no solo game dealt under it
const code = roomInAddress();
if (code) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { joined(); solo(); } }); }
else solo();
