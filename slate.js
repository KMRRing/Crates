// Slate: solo and together play. Boards and rules come from slate-gen.js. Together games live in the app's
// shared rooms (rooms.js): the room's glyph branch holds this game's state (slate-room.js), a pair's or a party's of
// up to six; everyone fills the one board and sees everything, each player's letters and cursor in their own colour.
import { generate, gridOf, rowsOf, VALID, fieldsOf, judge, notesFrom, lettersFrom, isSolved, jointsOf, key, unkey, clearable, eligibleCells, wordAt, keyVerdicts } from "./slate-gen.js";
import { branchPath, openBranch, enterRoom, leaveRoom, sitDown, seatsOf, pickSeat, otherHere, gameHref, GAMES, joiningWords } from "./rooms.js";
import { askedFor, freshTable, seatsFor, logOf, ownersFrom, placedBy, presentSlots, cursorsOf, storable } from "./slate-room.js";
import { bindSwitcher, APPS } from "./apps.js";
import { busy, sextant } from "./loading.js";
import { reloadFresh } from "./pwa.js";
import { getSync } from "./net.js";
import { reportDuo, today, noteDayTime, arrivedForToday, playerId, sayWhere } from "./suite.js";
const DAILY_LEVEL = "medium";      // today's puzzle: a medium board, the same for everyone
import { dropdown } from "./dropdown.js";
import { part, action, mirror, isPaused, onPause } from "./menu.js";
import { sideways, scale } from "./wide.js";

dropdown(document.getElementById("level"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
// Saves, the room branch and the switcher id keep the game's first name (Glyph), so saved boards and rooms in
// play carry on after the rename.
const GAME = "glyph";
const STORE = "glyph:solo";
const CHECKS = 2, REVEALS = 2, HINTS = 2;
/** Checks, rule reveals and suggestions per board: unlimited on Easy, two each otherwise. */
const limitsFor = level => (level === "easy" ? { checks: Infinity, reveals: Infinity, hints: Infinity } : { checks: CHECKS, reveals: REVEALS, hints: HINTS });
let GAP = 6;          // between cells, in px: 6 on a phone, more where the page is drawn larger (fitLayout)
const PALETTE = { single: ["s", ["Blue", "Green", "Teal"]], pair: ["p", ["Yellow", "Orange", "Sand"]], whole: ["w", ["Violet", "Pink", "Plum"]] };
const KIND = { single: "single letters", pair: "pairs", whole: "whole field" };
const HOW = {
  single: "Each letter is judged on its own.",
  pair: "Each pair of neighbours, read left to right and top to bottom.",
  whole: "Judged as a whole once every cell is filled.",
};
const roomPath = code => branchPath(code, GAME);
const randomSeed = () => Math.floor(Math.random() * 1e9);

// ---------- state ----------
let S = null;        // { seed, level, board, log, done } — the solo save, or the room's game
let room = null;     // together: { code, uid, pid, sync, unwatch, data, here, online }
let cursor = null;    // the cell being typed into
let dir = "Across";   // which way typing runs; tapping the cursor's cell again turns it
let pending = {};     // letters typed into the current word but not placed yet, by cell
let shownDone = null;
let clearLevel = 0;   // Clear escalates on repeated presses: broken words, then rule-breakers, then everything
let clockFrom = null; // solo: when the board's clock last started running (paused while the page is hidden)
let thinking = false; // a check or suggestion is being worked out

const grid = () => gridOf(rowsOf(S.board));
const fields = () => fieldsOf(S.board);
const placements = () => S.log.filter(e => e.word).length;
const checksUsed = () => S.log.filter(e => e.check).length;
/** The latest check's verdict: the letters it found must change, by cell (checks from before October 2026 had none). */
const lastCheck = () => { for (let i = S.log.length - 1; i >= 0; i--) if (S.log[i].check) return S.log[i].check.v === 2 ? S.log[i].check.out || {} : {}; return {}; };
const hintsUsed = () => S.log.filter(e => e.hint != null).length;
const revealed = () => new Set(S.log.filter(e => e.reveal != null).map(e => e.reveal));
const other = d => (d === "Across" ? "Down" : "Across");
const slotFor = (k, d) => grid().slots.find(s => s.dir === d && s.cells.includes(k));
const currentSlot = () => slotFor(cursor, dir) || slotFor(cursor, other(dir));
/** The same word: grid() builds fresh slot objects on every call, so comparing them with === never matches. */
const sameWord = (a, b) => a?.dir === b?.dir && a?.cells[0] === b?.cells[0];

/** Back to the start: the cursor on the first row's first cell, typing across. */
function resetCursor() {
  const g = grid(), first = g.slots.find(s => s.dir === "Across") || g.slots[0];
  cursor = first.cells[0]; dir = first.dir; pending = {}; clearLevel = 0;
}

function styleOf(i) {
  const fs = fields(), f = fs[i], [prefix, names] = PALETTE[f.rule.type];
  const n = fs.slice(0, i).filter(g => g.rule.type === f.rule.type).length % 3;
  return { tint: `var(--g${prefix}${n})`, edge: `var(--g${prefix}${n}e)`, name: names[n], type: f.rule.type };
}

// ---------- the clock ----------
// Solo boards count the time spent on screen (S.ms). Together boards count from when the board was dealt
// to when it ended, since two people come and go.
function clockRun() {
  if (room || joining || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms = (S.ms || 0) + performance.now() - clockFrom;
  clockFrom = null;
  saveSolo();
}
onPause(() => clockPause(), () => clockRun());   // the menu stops the clock too
function elapsed() {
  if (room || S.startedAt) return S.startedAt ? (S.done?.at || Date.now()) - S.startedAt : 0;
  return (S.ms || 0) + (clockFrom != null ? performance.now() - clockFrom : 0);
}
const clockText = ms => {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, pad = n => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

// ---------- solo ----------
function loadSolo() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s?.board && Array.isArray(s.log)) return s; } catch { /* fresh */ }
  return null;
}
function saveSolo() { if (!room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

function soloBoard(seed, level) {
  const board = generate(seed, level);
  S = { seed, level, board, log: [], done: null, ms: 0 };
  shownDone = null;
  clockFrom = null;
  clockRun();
  resetCursor();
  history.replaceState(null, "", `${location.pathname}${room ? "" : location.search}#s=${seed}&d=${level}`);
  saveSolo();
  render();
}

// ---------- actions (solo writes the save; together writes the room) ----------
/**
 * Applies a change: to the solo save, or to the room in one transaction. Returns whether it was saved.
 * (Firebase may first offer a transaction an empty cached value; answering null makes it check the server
 * instead of abandoning the move.)
 */
async function act(change) {
  if (!room) { change(S); saveSolo(); afterChange(); return true; }
  let newer = false;
  try {
    const r = await room.sync.tx(roomPath(room.code), cur => {
      if (cur === null) return null;
      if (!cur.board) return undefined;
      if ((cur.app || 0) > APP) { newer = true; return undefined; }
      cur.app = APP;
      cur.log = logOf(cur);
      return change(cur) === false ? undefined : storable(cur);
    });
    if (newer) { updateApp(); return false; }
    return !!r.value?.board;
  } catch (e) {
    console.error(e);
    toast("Couldn't save that: check your connection and try again");
    return false;
  }
}

// Bumped when together games change shape, so a device still running older code reloads instead of mangling them
// (5: a party's table of up to six, and each player's cursor).
const APP = 5;

/** Another device runs newer code: switch to the newest version, once per session. */
async function updateApp() {
  try { if (sessionStorage.getItem("slate:updated")) { toast("Someone at the table has a newer version: close and reopen Slate"); return; }
    sessionStorage.setItem("slate:updated", "1"); } catch { /* private mode */ }
  toast("Updating to the newest version…");
  await reloadFresh();
}

function place() {
  if (S.done) return;
  const slot = currentSlot(), before = lettersFrom(S.board, S.log);
  const word = slot.cells.map(k => pending[k] || before[k] || "").join("");
  if (word.length !== slot.cells.length) {
    // a frame: letters stay on the board, aren't judged and don't count until they're part of a real word
    if (!Object.keys(pending).length) { toast("Type a letter first"); return; }
    const draft = pending;
    pending = {};
    submit({ draft }, draft);
    toast("Not a full word, so these letters aren't judged yet. Clear removes them.");
    render();
    return;
  }
  if (!VALID.has(word)) {
    // still placed, like a frame: shown underlined, not judged and not counted until it's a real word
    if (!Object.keys(pending).length) { toast(`${word} isn't in the word list`); return; }
    const draft = pending;
    pending = {};
    submit({ draft }, draft);
    toast(`${word} isn't in the word list, so it isn't judged`);
    render();
    return;
  }
  if (!Object.keys(pending).length && slot.cells.every(k => before[k])) { toast(`${word} is already on the board`); return; }
  const typed = pending;
  pending = {};
  clearLevel = 0;
  submit({ slot: slot.id, word }, typed);
  const after = { ...before };
  slot.cells.forEach((k, i) => { after[k] = word[i]; });
  const broken = grid().slots.filter(s => s !== slot && s.cells.some(k => slot.cells.includes(k))
    && s.cells.every(k => after[k]) && !VALID.has(s.cells.map(k => after[k]).join("")));
  if (broken.length) toast(`That broke ${broken.map(s => `${s.dir.toLowerCase()} ${s.num} (${s.cells.map(k => after[k]).join("")})`).join(" and ")}`);
  render();
}

/** Adds a move to the log. If a together move doesn't save, the letters you typed come back so nothing is lost. */
function submit(entry, typed) {
  act(g => { if (g.done) return false; g.log.push({ ...entry, ...(room && { by: room.uid }) }); })
    .then(ok => { if (!ok && room && !S.done) { pending = { ...typed, ...pending }; render(); } });
}

/** A button's name, with how many are left as a small badge on its corner (none when there's no limit): "Suggest (2)"
 *  written out didn't fit four buttons to a row. */
function labelLeft(btn, text, left) {
  btn.textContent = text;
  btn.setAttribute("aria-label", left === Infinity ? text : `${text}, ${left} left`);
  if (left === Infinity) return;
  const badge = document.createElement("span");
  badge.className = "g-left";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = String(left);
  btn.appendChild(badge);
}

// ---------- the referee: Check and Suggest ----------
// Both judge against every winning board (any real words, every rule kept), not our fill, and run in a worker
// (slate-worker.js, slate-solve.js) since a hard board can take a moment on a phone.
let referee = null, asked = 0;
const waiting = new Map();
async function ask(kind, payload) {
  try {
    if (!referee) {
      referee = new Worker(new URL("./slate-worker.js", import.meta.url), { type: "module" });
      referee.onmessage = e => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
      referee.onerror = () => { waiting.forEach(done => done({ timeout: true })); waiting.clear(); referee = null; };
    }
  } catch {                                                       // no module workers here: work it out on the page
    const m = await import("./slate-solve.js");
    return kind === "check" ? m.checkBoard(payload.board, payload.letters, payload.placed, payload.slot) : m.suggestWord(payload.board, payload.letters, payload.slot);
  }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, resolve); referee.postMessage({ id, kind, ...payload }); });
}
/** Every letter entered: placed, typed short of a word, or typed into the current word and not placed yet. */
const enteredLetters = () => ({ ...lettersFrom(S.board, S.log), ...pending });

/**
 * Check: the fewest letters that must change for a winning board to exist, keeping all the others, nearest the
 * highlighted word protected first. They're outlined in orange until they change; a clean board says so.
 */
async function check() {
  if (S.done || thinking) return;
  if (checksUsed() >= limitsFor(S.level).checks) { toast("No checks left on this board"); return; }
  const letters = enteredLetters(), slot = currentSlot();
  if (!Object.keys(letters).length) { toast("Nothing to check yet: put some letters down first"); return; }
  const onBoard = lettersFrom(S.board, S.log), placed = [...eligibleCells(S.board, onBoard)].filter(k => !pending[k]);
  thinking = true; render(); toast("Checking…");
  const r = await ask("check", { board: S.board, letters, placed, slot: slot.id });
  thinking = false;
  if (r.timeout) { render(); toast("Couldn't finish the check in time, so it wasn't spent. Try again."); return; }
  const entry = { v: 2, at: slot.id, out: r.out || {}, proven: !!r.proven };
  const ok = await act(g => {
    if (g.done || g.log.filter(e => e.check).length >= limitsFor(g.level).checks) return false;
    g.log.push({ check: entry, ...(room && { by: room.uid }) });
  });
  if (!ok) { render(); return; }
  const n = Object.keys(entry.out).length;
  toast(!n ? "All of this can still win."
    : `${n === 1 ? "The orange letter has" : `These ${n} orange letters have`} to change; everything else can stay.${entry.proven ? "" : " (The fewest found in the time: a smaller change may exist.)"}`);
}

/**
 * Suggest: a word for the highlighted word that lies on a winning board keeping every letter entered; our fill's
 * word where it can be. Typed in for you to place with Enter. Spent only when there's a word to give.
 */
async function suggestWord() {
  if (S.done || thinking) return;
  if (hintsUsed() >= limitsFor(S.level).hints) { toast("No suggestions left on this board"); return; }
  const slot = currentSlot();
  if (!slot) { toast("Tap a cell first"); return; }
  const letters = enteredLetters();
  if (slot.cells.every(k => letters[k])) { toast("This word is full, so there's nothing to suggest. Check tells you whether it can stay."); return; }
  thinking = true; render(); toast("Looking for a word that can win…");
  const r = await ask("suggest", { board: S.board, letters, slot: slot.id });
  thinking = false;
  const now = enteredLetters();
  if (slot.cells.some(k => (now[k] || "") !== (letters[k] || ""))) { render(); toast("The word changed while I looked: ask again"); return; }
  if (!r.word) {
    render();
    toast(r.proven ? "No winning board keeps your current letters, so nothing was spent. Check shows which have to change."
      : "No solution found with your current letters, so nothing was spent. Check shows which have to change.");
    return;
  }
  const ok = await act(g => {
    if (g.done || g.log.filter(e => e.hint != null).length >= limitsFor(g.level).hints) return false;
    g.log.push({ hint: slot.id, ...(room && { by: room.uid }) });
  });
  if (!ok) { render(); return; }
  const placed = lettersFrom(S.board, S.log);
  slot.cells.forEach((k, i) => { if (!placed[k]) pending[k] = r.word[i]; });
  render();
  toast(`Try ${r.word}: Enter places it`);
}

/** Clear: first press empties letters that aren't in a real word, the next also words breaking a rule you can see, the next everything. */
function clear() {
  if (S.done) return;
  const letters = lettersFrom(S.board, S.log);
  if (!Object.keys(letters).length) { toast("The board is already empty"); clearLevel = 0; return; }
  pending = {};
  const level = clearLevel + 1;
  clearLevel = level >= 3 ? 0 : level;
  const cells = clearable(S.board, letters, level);
  const words = n => `${n} letter${n === 1 ? "" : "s"}`;
  if (!cells.length) {
    toast(level === 1 ? "Every letter is part of a real word. Press Clear again to remove words that break a rule."
      : "No word breaks a rule. Press Clear again to empty the board.");
    render();
    return;
  }
  // at a table, emptying the board takes everyone's letters: asked first when some are someone else's
  if (level === 3 && room) {
    const placer = ownersFrom(S.board, S.log);
    if (cells.some(k => placer[k] && placer[k] !== room.uid) && !confirm("Empty the whole board, the others' letters too?")) { render(); return; }
  }
  act(g => { if (g.done) return false; g.log.push({ clear: cells, ...(room && { by: room.uid }) }); });
  toast(level === 1 ? `Cleared ${words(cells.length)} that weren't part of a real word. Press again to clear rule-breakers too.`
    : level === 2 ? `Cleared ${words(cells.length)} in words that break a rule. Press again to empty the board.`
      : "Board cleared.");
}

/** Spends one of the board's two reveals on a field's rule; a single-letter rule then colours the whole keyboard. */
function reveal(i) {
  if (S.done || revealed().has(i)) return;
  if (revealed().size >= limitsFor(S.level).reveals) { toast("No rule reveals left on this board"); return; }
  act(g => {
    const used = new Set(g.log.filter(e => e.reveal != null).map(e => e.reveal));
    if (g.done || used.has(i) || used.size >= limitsFor(g.level).reveals) return false;
    g.log.push({ reveal: i, ...(room && { by: room.uid }) });
  });
}

function giveUp() {
  if (S.done) { showDone(); return; }
  if (!confirm("Show our fill and end this board?")) return;
  clockPause();
  act(g => { if (g.done) return false; g.done = { gaveUp: true, at: Date.now() }; });
}

function newBoard(level = S.level) {
  if (!S.done && placements() && !confirm("Leave this board unfinished?")) { $("level").value = S.daily ? "today" : S.level; return; }
  $("menuDlg").close();
  if (level === "today") {                                     // today's puzzle: solo, timed for the games screen
    if (room) { $("level").value = S.daily ? "today" : S.level; return; }
    soloBoard(today(), DAILY_LEVEL); S.daily = today(); saveSolo(); render(); return;
  }
  if (!room) { soloBoard(randomSeed(), level); return; }
  const seed = randomSeed(), board = generate(seed, level);
  act(g => { g.level = level; g.seed = seed; g.board = board; g.log = []; g.done = null; g.startedAt = Date.now(); });
}

/** Solved boards end themselves; both players see the result. */
function afterChange() {
  if (!S.done && isSolved(S.board, lettersFrom(S.board, S.log))) {
    clockPause();
    if (S.daily && !room) noteDayTime("slate", (S.ms || 0) / 1000, S.daily);    // today's puzzle: the first solve's time
    act(g => { if (g.done) return false; g.done = { won: true, at: Date.now() }; });
    return;
  }
  render();
}

// ---------- together ----------
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

async function connect() {
  try { return await getSync(); }
  catch (e) { console.error(e); toast("Couldn't reach the game server"); return null; }
}

/**
 * Slate's state for a table: a fresh board at your own board's level (Easy before you've had one), these players
 * seated, as many seats as the request asked for.
 */
function freshState(players, { ask = null, asked = null } = {}) {
  const seed = randomSeed(), level = S?.level || "easy";
  return freshTable(players, { app: APP, seed, level, board: generate(seed, level), ask, asked });
}

const validTable = g => !!g?.board;
/** The request this page was opened for (?new=, its time), while it's the room's latest and was said yes to; else null. */
const askedHere = shared => askedFor(shared.ask, Number(new URLSearchParams(location.search).get("new")) || 0);

/**
 * Sits down at the table in a room. Opened for a request said yes to (?new=: a party's host's, or your partner's), it's a
 * new table, seating as many as the request asked for: whoever arrives first deals it and the others sit down at it.
 * You get your own seat back on any of your devices (sitDown in rooms.js); when every seat is someone else's, you can
 * carry on as one of them (say after moving from laptop to phone): you take over that seat, and their other device
 * leaves the game.
 */
async function join(code) {
  const sync = await connect();
  if (!sync) return false;
  // the branch held in this page's cache while joining: the joining transaction takes one round trip, not two (a cold
  // cache sends a blind first try the database turns down), and the board is drawn the moment the room is entered
  const warm = sync.watch(roomPath(code), () => {}, () => {});
  try {
    const shared = await openBranch(sync, code, GAME);
    if (!shared) { toast("No game with that code"); return false; }
    const before = shared[GAME] || null, seats = seatsOf(before), pid = playerId(), asked = askedHere(shared);
    if ((before?.app || 0) > APP) { updateApp(); return false; }
    const anew = !validTable(before) || (!!asked && before.asked !== asked);
    let takeover = null;
    if (!anew && seats.length >= seatsFor(before) && !seats.some(([id, p]) => id === sync.uid || (p.pid && p.pid === pid))) {
      takeover = await pickSeat(seats);
      if (!takeover) return false;
    }
    const name = takeover ? seats.find(([id]) => id === takeover)[1].name : await askName();
    if (!name) return false;
    // a new table is dealt before the transaction, marked with the request it's for
    const initial = anew ? freshState({ [sync.uid]: { name, slot: 0, pid, online: true } }, { ask: asked ? shared.ask : null, asked }) : null;
    let newer = false;
    const r = await sync.tx(roomPath(code), cur => {
      newer = !!cur && (cur.app || 0) > APP;
      const next = newer ? undefined : sitDown(cur, { uid: sync.uid, pid, name }, { initial, asked, takeover, valid: validTable, slots: g => g?.people || 2 });
      return next ? storable(next) : next;
    });
    if (newer) { updateApp(); return false; }
    if (!r.committed || !r.value) {
      toast(validTable(r.value) && seatsOf(r.value).length >= seatsFor(r.value) ? "Someone else just took the free seat" : "No game with that code");
      return false;
    }
    enter(code, sync, name, pid);
    return true;
  } catch (e) { explain(e); return false; }
  finally { setTimeout(() => warm?.(), 0); }                 // once the room's own watch has it
}

function enter(code, sync, name, pid) {
  clockPause();
  room = { code, sync, uid: sync.uid, pid, data: null, here: {}, online: true };
  setRoomParam(code);
  watchRoom();
  room.stopHere = enterRoom(sync, code, GAME, name, here => { if (room) { room.here = here; drawSoon(); } }, pid);
  room.stopPresence = sync.presence?.(`${roomPath(code)}/players/${sync.uid}`);
  room.stopConnection = sync.connection?.(ok => { if (room) { room.online = ok; drawPartner(); } });
}

function watchRoom() {
  room.unwatch?.();
  room.unwatch = room.sync.watch(roomPath(room.code), onRoom, explain);
}

/** Back from the background (Safari may have frozen the page): reconnect and fetch the room afresh. */
function resync() {
  if (!room || document.hidden) return;
  room.sync.reconnect?.();
  watchRoom();
}

const reportedDone = new Set();   // boards finished together, recorded once per visit
/** A board's identity at the table: a new board (New board, or a new table) has a new seed and a new start. */
const boardOf = s => (s ? `${s.seed}/${s.startedAt}` : null);
function onRoom(val) {
  if (!room) return;
  if ((val?.app || 0) > APP) { updateApp(); return; }
  if (!validTable(val)) { toast("That game has ended"); leave(); return; }
  if (!seatsOf(val).some(([id]) => id === room.uid)) {
    // your seat went to another device, or a new table was dealt for a new request (its players on their way)
    const moved = val.asked === room.data?.asked || seatsOf(val).some(([, p]) => room.pid && p.pid === room.pid);
    toast(moved ? "This game continued on another device" : "A new game started at the table");
    room.data = val;
    leave();
    return;
  }
  const was = room.data;
  room.data = val;
  seated();
  const next = { seed: val.seed, level: val.level, board: val.board, log: logOf(val), done: val.done || null, startedAt: val.startedAt || val.created };
  const fresh = boardOf(S) !== boardOf(next);
  S = next;
  if (fresh) { resetCursor(); shownDone = null; }
  else news(was);
  // a board finished together is a team result for the duo record: solved, in the time it took (lower is better)
  if (S.done && !reportedDone.has(`${S.seed}-${S.startedAt}`)) {
    reportedDone.add(`${S.seed}-${S.startedAt}`);
    reportDuo("slate", `${S.seed}-${S.startedAt}`, S.done.won ? { score: Math.round(((S.done.at || 0) - (S.startedAt || 0)) / 1000), won: true, coop: true, lower: true } : { score: null, won: false, coop: true, lower: true })
      .catch(e => console.error(e));
  }
  try {
    if (!S.done && isSolved(S.board, lettersFrom(S.board, S.log))) afterChange();
    drawSoon();
    if ($("menuDlg").open && menuDrawn !== menuKey()) drawMenu();
  } catch (e) {
    // one bad update must never freeze the screen for the rest of the game
    console.error(e);
    toast("Something went wrong showing the last move; it's still saved");
  }
}

/** What the others did that the board alone doesn't say: a check's verdict, a rule revealed. */
function news(was) {
  if (!was || boardOf({ seed: was.seed, startedAt: was.startedAt || was.created }) !== boardOf(S)) return;
  for (const e of S.log.slice(logOf(was).length)) {
    if (!e.by || e.by === room.uid) continue;
    const who = firstName(room.data.players?.[e.by]?.name);
    if (e.check) {
      const n = Object.keys(e.check.out || {}).length;
      toast(n ? `${who} checked: ${n === 1 ? "the orange letter has" : `these ${n} orange letters have`} to change` : `${who} checked: all of this can still win`);
    } else if (e.reveal != null && fields()[e.reveal]) toast(`${who} revealed the ${styleOf(e.reveal).name} field's rule`);
  }
}

function leave() {
  if (room) {
    // the others stop seeing your cursor (a seat that's no longer yours is left alone)
    if (room.data?.players?.[room.uid]?.at) room.sync.update(`${roomPath(room.code)}/players/${room.uid}`, { at: null })?.catch?.(() => {});
    room.unwatch?.();
    room.stopPresence?.();
    room.stopConnection?.();
    room.stopHere?.();
    leaveRoom(room.sync, room.code);
  }
  room = null;
  sharedAt = null;
  clearTimeout(cursorTimer);
  seated();
  setRoomParam(null);
  S = loadSolo();
  if (!S) { soloBoard(randomSeed(), $("level").value || "easy"); return; }
  resetCursor();
  shownDone = S.done ? JSON.stringify(S.done) : null;
  clockRun();
  render();
}

function explain(e) {
  console.error(e);
  toast(/permission/i.test(String(e?.message || e)) ? "Playing together isn't switched on in Firebase yet" : "Couldn't reach the game server");
}

function setRoomParam(code) {
  const u = new URL(location.href);
  if (code) { u.searchParams.set("room", code); u.hash = ""; } else u.searchParams.delete("room");
  u.searchParams.delete("new");           // the request's table is dealt: a reload sits down at it again
  history.replaceState(null, "", u);
  sayWhere();                             // your partner sees you at the table, or back in solo
}

// The rete covers your own board while you sit down at a table, so nothing goes into it by mistake; it waits as you
// left it, for Back to solo.
let joining = null;
function seated() { joining?.(); joining = null; }

// Each player's cursor, for the others to see where they're typing: written (at most every 150 ms) when it moves.
let sharedAt = null, cursorTimer = 0;
function shareCursor() {
  if (!room) return;
  const at = S.done || !cursor ? null : { k: cursor, d: dir }, said = JSON.stringify(at);
  clearTimeout(cursorTimer);
  if (said === sharedAt) return;
  cursorTimer = setTimeout(() => {
    if (!room?.data?.players?.[room.uid]) return;        // not seated (any more): a write would leave a stray entry
    sharedAt = said;
    room.sync.update(`${roomPath(room.code)}/players/${room.uid}`, { at })?.catch?.(e => console.error(e));
  }, 150);
}

// A room's news redraws the board; a cell redrawn under a finger loses its tap, so while one is down on the board the
// drawing waits for it to lift (the tap then draws anyway).
let pressing = false, owed = false;
function drawSoon() { if (pressing) owed = true; else render(); }
function lifted() {
  pressing = false;
  if (owed) { owed = false; setTimeout(render, 0); }
}

// ---------- drawing ----------
function render() {
  if (!S) return;
  const g = grid(), fs = fields(), letters = lettersFrom(S.board, S.log);
  if (!cursor || !g.cells.includes(cursor)) resetCursor();
  const slot = currentSlot(), left = limitsFor(S.level).checks - checksUsed(), hintsLeft = limitsFor(S.level).hints - hintsUsed();
  $("level").value = S.daily ? "today" : S.level;
  labelLeft($("checkBtn"), "Check", left);
  $("checkBtn").disabled = !!S.done || left === 0 || thinking;
  labelLeft($("hintBtn"), "Suggest", hintsLeft);
  $("hintBtn").disabled = !!S.done || hintsLeft === 0 || thinking;
  $("clearBtn").disabled = !!S.done;
  const notes = notesFrom(S.board, S.log);
  drawPartner();
  drawBoard(g, fs, letters, slot);
  // the fields sheet only when what it shows has changed: a ? redrawn under a finger loses its tap
  const fieldsKey = `${boardOf(S)}|${S.log.length}|${!!S.done}`;
  if (fieldsKey !== fieldsDrawn) { fieldsDrawn = fieldsKey; drawFields(fs, notes); }
  drawKeys(fs, notes);
  shareCursor();
  const doneKey = S.done ? JSON.stringify(S.done) : null;
  if (doneKey && doneKey !== shownDone) { shownDone = doneKey; showDone(); }
}
let fieldsDrawn = null;

// ---------- the table: who's at it, in their colours ----------
const firstName = name => String(name || "Player").split(" ")[0];
const seatColour = slot => `var(--p${(slot || 0) % 6})`;
/** Each seated player's seat, by device id. */
const slotsById = () => Object.fromEntries(seatsOf(room?.data).map(([id, p]) => [id, p.slot]));
/** A player's name with the dot of their colour; dimmed while they're away. */
function seatChip(name, slot, here = true) {
  const b = document.createElement("b");
  b.className = `g-seat${here ? "" : " away"}`;
  b.style.setProperty("--seat", seatColour(slot));
  b.textContent = here ? name : `${name} (away)`;
  return b;
}
/** "a", "a and b", "a, b and c", of nodes. */
function listOf(nodes) {
  return nodes.flatMap((n, i) => (i === 0 ? [n] : [i === nodes.length - 1 ? " and " : ", ", n]));
}

/**
 * The line over the board at a table: everyone at it in their colours, so each knows whose letters are whose (you
 * first); away while their phone sleeps or they've left. Your partner in another game of the room: where, and a link.
 */
function drawPartner() {
  const el = $("partner");
  if (!room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (room.online === false) { el.append(sextant(), "Reconnecting… moves made now may not reach the others."); return; }
  const g = room.data, here = new Set(presentSlots(g, room.here, room.uid));
  const others = seatsOf(g).filter(([id, p]) => id !== room.uid && !(room.pid && p.pid === room.pid)).sort((a, b) => a[1].slot - b[1].slot);
  if (seatsFor(g) === 2) {
    const there = otherHere(room.here, room.uid, room.pid, GAME);
    if (there && there.game !== GAME && GAMES[there.game]) {
      // your partner has another game of the room open: say which, and offer to follow
      const go = document.createElement("a");
      go.href = gameHref(there.game);
      go.textContent = "Join them";
      el.append(seatChip(firstName(there.name), others[0]?.[1].slot ?? 1, there.online !== false), ` is in ${GAMES[there.game].name}. `, go);
      return;
    }
  }
  const mine = seatChip("You", g?.players?.[room.uid]?.slot);
  if (!others.length) { el.append(mine, ": waiting for ", seatsFor(g) > 2 ? "the others" : "your partner", " to join"); return; }
  el.append(...listOf([mine, ...others.map(([, p]) => seatChip(firstName(p.name), p.slot, here.has(p.slot)))]));
}

function drawBoard(g, fs, letters, slot) {
  const el = $("board"), size = fitLayout(g);
  el.style.width = `${g.W * size + (g.W - 1) * GAP}px`;
  el.style.height = `${g.H * size + (g.H - 1) * GAP}px`;
  const at = k => { const [r, c] = unkey(k); return { x: c * (size + GAP), y: r * (size + GAP) }; };
  const owner = {};
  fs.forEach((f, i) => f.cells.forEach(k => { owner[k] = i; }));
  const verdict = judge(S.board, letters);
  const mustGo = lastCheck();
  const bad = new Set(g.slots.filter(s => s.cells.every(k => letters[k]) && !VALID.has(s.cells.map(k => letters[k]).join(""))).flatMap(s => s.cells));
  const eligible = eligibleCells(S.board, letters);   // letters in a complete real word: the only ones judged
  const nodes = fs.flatMap((f, i) => (f.rule.type === "whole" ? [cage(f.cells, styleOf(i), at, size)] : []));   // under the cells
  // at a table: each letter in the colour of whoever put it there, and the word each of the others is on, under a bar
  // of their colour with their initial where their cursor is
  const placer = room ? ownersFrom(S.board, S.log) : {}, seatOf = room ? slotsById() : {};
  const peerWord = {}, peerAt = {};
  for (const p of room && !S.done ? cursorsOf(room.data, room.here, room.uid, room.pid) : []) {
    const word = slotFor(p.k, p.d) || slotFor(p.k, other(p.d));
    if (!word) continue;
    for (const k of word.cells) peerWord[k] ??= p.slot;
    (peerAt[p.k] ||= []).push(p);
  }

  for (const k of g.cells) {
    const { x, y } = at(k), i = owner[k], cell = document.createElement("div");
    cell.className = "g-cell";
    Object.assign(cell.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.5}px` });
    if (i != null) {
      const st = styleOf(i);
      if (st.type === "whole") cell.classList.add("whole");    // its cage, drawn underneath, gives colour and outline
      else { cell.style.background = st.tint; cell.style.borderColor = st.edge; }
    }
    if (!S.done && slot.cells.includes(k)) cell.classList.add(k === cursor ? "cursor" : "sel");
    const typed = pending[k] || null;
    const ch = document.createElement("span");
    if (typed) { ch.className = "pending"; ch.textContent = typed; }
    else if (letters[k]) {
      ch.className = "ch"; ch.textContent = letters[k];
      if (seatOf[placer[k]] != null) { ch.classList.add("by"); ch.style.setProperty("--by", seatColour(seatOf[placer[k]])); }
    }
    cell.appendChild(ch);
    if (peerWord[k] != null) { cell.classList.add("peer"); cell.style.setProperty("--peer", seatColour(peerWord[k])); }
    if (peerAt[k]) {
      const tags = document.createElement("span");
      tags.className = "g-peers";
      tags.setAttribute("aria-hidden", "true");
      for (const p of peerAt[k]) {
        const t = document.createElement("i");
        t.style.background = seatColour(p.slot);
        t.textContent = firstName(p.name).slice(0, 1).toUpperCase();
        tags.appendChild(t);
      }
      cell.appendChild(tags);
      cell.title = `${peerAt[k].map(p => firstName(p.name)).join(" and ")} ${peerAt[k].length > 1 ? "are" : "is"} here`;
    }
    if (!typed && letters[k]) {
      const v = verdict.cells[k];
      if (v && eligible.has(k)) cell.appendChild(mark(v.ok));
      if (bad.has(k)) cell.classList.add("broken");
      else if (!eligible.has(k)) { cell.classList.add("draft"); cell.title = "Not part of a real word yet"; }
    }
    if (mustGo[k] && (typed || letters[k]) === mustGo[k]) {
      // the last check found this letter has to change: outlined until it does
      cell.classList.add("must-go");
      cell.title = "Check: this letter has to change for a winning board";
    }
    if (S.done && !letters[k]) { ch.className = "pending"; ch.textContent = S.board.sol[k]; }
    cell.dataset.k = k;
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;
    cell.setAttribute("aria-label", `${letters[k] || "Empty"}${i != null ? `, ${styleOf(i).name} field` : ""}`);
    cell.addEventListener("click", () => { if (doubleTap(k)) define(k); else select(k); });
    nodes.push(cell);
  }

  fs.forEach((f, i) => {
    const st = styleOf(i);
    if (f.rule.type === "pair") {
      for (const [a, b] of jointsOf(f.cells)) {
        const pa = at(a), pb = at(b), across = pa.y === pb.y, join = document.createElement("div");
        join.className = "g-join";
        const thick = Math.max(12, size * 0.32);
        Object.assign(join.style, across
          ? { left: `${pa.x + size - 4}px`, top: `${pa.y + (size - thick) / 2}px`, width: `${GAP + 8}px`, height: `${thick}px` }
          : { left: `${pa.x + (size - thick) / 2}px`, top: `${pa.y + size - 4}px`, width: `${thick}px`, height: `${GAP + 8}px` });
        join.style.background = st.edge;
        const v = verdict.joints.find(j => j.a === a && j.b === b);
        if (v && eligible.has(a) && eligible.has(b)) join.appendChild(mark(v.ok));
        nodes.push(join);
      }
    } else if (f.rule.type === "whole" && i in verdict.wholes && f.cells.every(k => eligible.has(k))) {
      const first = f.cells.slice().sort((a, b) => at(a).y - at(b).y || at(a).x - at(b).x)[0], { x, y } = at(first);
      const badge = document.createElement("div");
      badge.className = "g-badge";
      Object.assign(badge.style, { left: `${x - 9}px`, top: `${y - 9}px` });
      badge.appendChild(mark(verdict.wholes[i]));
      nodes.push(badge);
    }
  });
  el.replaceChildren(...nodes);
}

/**
 * Sizes the board and the keyboard to the visible screen (Safari's bars included). Upright, the board is as large as
 * the width allows while the keyboard keeps its minimum height, then the keys grow into whatever height is left.
 * Sideways (#app.beside), the board has the left column under the header to itself and the keys stand beside it, as
 * tall as that column lets them be. Every size grows with the page where it's drawn larger (an upright tablet).
 */
function fitLayout(g) {
  const k = scale(), vh = window.visualViewport?.height || window.innerHeight, side = sideways();
  GAP = 6 * k;
  // measured from what sits above the board, since the board centres itself in the space it gets (beside it, the
  // partner's line is in the other column)
  const above = $("partner").hidden || side ? document.querySelector("#app > .top") : $("partner");
  const top = above.getBoundingClientRect().bottom + window.scrollY + 12 * k;
  const app = getComputedStyle($("app"));
  const bottom = parseFloat(app.paddingBottom) || 0;
  const [minKey, maxKey, keyGap] = [MIN_KEY * k, MAX_KEY * k, KEY_GAP * k];
  // a small board's cells stop at 84px on a phone; beside the keys, the larger column lets them grow to 100
  const fit = (width, height) => Math.max(34 * k, Math.min((width - GAP * (g.W - 1)) / g.W, (height - GAP * (g.H - 1)) / g.H, (side ? 100 : 84) * k));
  if (side) {
    const width = parseFloat(app.gridTemplateColumns), room = vh - top - bottom;   // the first column's width
    const keys = (room - $("actions").offsetHeight - 12 * k - 2 * keyGap) / 3;
    document.documentElement.style.setProperty("--g-key-h", `${Math.max(minKey, Math.min(maxKey, keys))}px`);
    return fit(width, room);
  }
  const width = $("app").clientWidth - parseFloat(app.paddingLeft) - parseFloat(app.paddingRight);
  const fixed = $("actions").offsetHeight + 24 * k + 2 * keyGap;    // actions and the gaps around and between rows
  const size = fit(width, vh - top - bottom - fixed - 3 * minKey);
  const spare = vh - top - bottom - fixed - (g.H * size + (g.H - 1) * GAP);
  document.documentElement.style.setProperty("--g-key-h", `${Math.max(minKey, Math.min(maxKey, spare / 3))}px`);
  return size;
}
const MIN_KEY = 44, MAX_KEY = 66, KEY_GAP = 6;   // px on a phone

/** The field of the clicked cell, if it has one and the board is in play. */
function cursorField(fs) {
  if (!cursor || S.done) return null;
  const i = fs.findIndex(f => f.cells.includes(cursor));
  return i >= 0 ? i : null;
}

// What the keyboard's colours mean, by the type of the cursor's field (its title, for a pointer or a screen reader).
const KEYS_MEAN = {
  single: name => `Letters the ${name} field has taken (green) and rejected (red)`,
  pair: name => `Letters known to go with the ${name} field's letters beside this cell (green) and known not to (red)`,
  whole: name => `Letters known to complete the ${name} field with the letters in its other cells (green) and known not to (red)`,
};

/**
 * Colours the keyboard for the cursor's cell: green for a letter known to pass there, red for one known to fail, from
 * what its field has told you or its rule once revealed (keyVerdicts in slate-gen.js): a single field's letters, a
 * pair field's pairs with the lettered neighbours, a whole field's letters once its other cells are all filled.
 */
function drawKeys(fs, notes) {
  const i = cursorField(fs);
  const verdict = i == null ? null : keyVerdicts(fs[i], notes[i], enteredLetters(), cursor, revealed().has(i));
  $("kbd").title = verdict ? KEYS_MEAN[fs[i].rule.type](styleOf(i).name) : "";
  const mustGo = (!S.done && cursor && lastCheck()[cursor]) || null;   // the last check said this letter has to change here
  document.querySelectorAll("#kbd button[data-key]").forEach(b => {
    const ch = b.dataset.key, v = verdict ? verdict(ch) : null;
    b.classList.toggle("ok", v === true);
    b.classList.toggle("no", v === false);
    b.classList.toggle("must-go", ch === mustGo);
  });
}

/**
 * A whole field's cage: one tinted shape with one dashed outline around all its cells, bridging the gaps
 * between neighbouring cells, so the group reads as one piece.
 */
function cage(cells, st, at, size) {
  const inside = new Set(cells), rects = [];
  for (const k of cells) {
    const [r, c] = unkey(k), { x, y } = at(k);
    rects.push([x, y, x + size, y + size]);
    const right = `${r},${c + 1}`, below = `${r + 1},${c}`, diag = `${r + 1},${c + 1}`;
    if (inside.has(right)) rects.push([x + size, y, x + size + GAP, y + size]);
    if (inside.has(below)) rects.push([x, y + size, x + size, y + size + GAP]);
    if (inside.has(right) && inside.has(below) && inside.has(diag)) rects.push([x + size, y + size, x + size + GAP, y + size + GAP]);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "g-cage");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", outlineOf(rects));
  path.setAttribute("fill", st.tint);
  path.setAttribute("stroke", st.edge);
  svg.appendChild(path);
  return svg;
}

/** The outline of a union of axis-aligned rectangles, as an SVG path (each loop traced clockwise). */
function outlineOf(rects) {
  const xs = [...new Set(rects.flatMap(r => [r[0], r[2]]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap(r => [r[1], r[3]]))].sort((a, b) => a - b);
  const filled = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some(r => cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3]);
  };
  const segs = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (!filled(i, j)) continue;
    if (!filled(i, j - 1)) segs.push([xs[i], ys[j], xs[i + 1], ys[j]]);
    if (!filled(i + 1, j)) segs.push([xs[i + 1], ys[j], xs[i + 1], ys[j + 1]]);
    if (!filled(i, j + 1)) segs.push([xs[i + 1], ys[j + 1], xs[i], ys[j + 1]]);
    if (!filled(i - 1, j)) segs.push([xs[i], ys[j + 1], xs[i], ys[j]]);
  }
  const from = new Map();
  segs.forEach(s => { const k = `${s[0]},${s[1]}`; if (!from.has(k)) from.set(k, []); from.get(k).push(s); });
  const used = new Set(), loops = [];
  for (const first of segs) {
    if (used.has(first)) continue;
    const pts = [[first[0], first[1]]];
    for (let s = first; s && !used.has(s); s = (from.get(`${s[2]},${s[3]}`) || []).find(t => !used.has(t))) {
      used.add(s);
      pts.push([s[2], s[3]]);
    }
    const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
    if (x0 === x1 && y0 === y1) pts.pop();                       // the loop closed on its start
    // drop points in the middle of straight runs, so dashes flow round the shape
    const keep = pts.filter((p, n) => {
      const a = pts[(n - 1 + pts.length) % pts.length], b = pts[(n + 1) % pts.length];
      return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
    });
    loops.push(roundedLoop(keep, CELL_RADIUS));
  }
  return loops.join("");
}
const CELL_RADIUS = 9;   // matches .g-cell's border-radius, so a cage's corners follow the cells'

/** A closed rectilinear loop with every corner rounded: outward corners curve one way, inward ones the other. */
function roundedLoop(pts, radius) {
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const inLen = Math.hypot(p[0] - a[0], p[1] - a[1]), outLen = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const u = [(p[0] - a[0]) / inLen, (p[1] - a[1]) / inLen], v = [(b[0] - p[0]) / outLen, (b[1] - p[1]) / outLen];
    const start = [p[0] - u[0] * r, p[1] - u[1] * r], end = [p[0] + v[0] * r, p[1] + v[1] * r];
    const clockwise = u[0] * v[1] - u[1] * v[0] > 0;          // screen y points down
    return `${i ? "L" : "M"}${start.join(",")}A${r},${r} 0 0 ${clockwise ? 1 : 0} ${end.join(",")}`;
  }).join("") + "Z";
}

function mark(ok) {
  const m = document.createElement("span");
  m.className = ok ? "g-mark-ok" : "g-mark-no";
  m.textContent = ok ? "✓" : "✕";
  m.setAttribute("aria-label", ok ? "passes" : "fails");
  return m;
}

function drawFields(fs, notes) {
  const shown = revealed(), left = limitsFor(S.level).reveals - shown.size, badge = $("revealsBadge");
  badge.hidden = left === Infinity || !!S.done;
  badge.innerHTML = `${left} × <span class="g-q" aria-hidden="true">?</span>`;
  badge.setAttribute("aria-label", `${left} rule reveal${left === 1 ? "" : "s"} left`);
  $("fields").replaceChildren(...fs.map((f, i) => {
    const st = styleOf(i), row = document.createElement("div");
    row.className = "g-field";
    const sw = document.createElement("div");
    sw.className = `g-swatch ${st.type}`;
    sw.style.background = st.tint; sw.style.borderColor = st.edge;
    const name = document.createElement("div");
    name.className = "g-fname";
    name.textContent = `${st.name}: ${KIND[st.type]}, ${f.cells.length} cells`;
    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "g-ask";
    ask.textContent = "?";
    ask.setAttribute("aria-label", `Reveal the ${st.name} field's rule`);
    ask.disabled = !!S.done || shown.has(i) || left <= 0;
    ask.addEventListener("click", () => reveal(i));
    row.append(sw, name, ask);
    line(row, HOW[st.type]);
    const ok = [...notes[i].ok].sort(), no = [...notes[i].no].sort();
    const label = st.type === "single" ? ["Takes", "Rejects"] : ["Passed", "Failed"];
    noteLine(row, label[0], ok, "ok");
    noteLine(row, label[1], no, "no");
    if (S.done || shown.has(i)) { const r = line(row, "Rule: "); const b = document.createElement("span"); b.className = "rule"; b.textContent = f.rule.text; r.appendChild(b); }
    return row;
  }));
}
function line(row, text) { const d = document.createElement("div"); d.className = "g-fline"; d.append(text); row.appendChild(d); return d; }
function noteLine(row, label, items, kind) {
  const d = line(row, `${label}: `);
  if (!items.length) { d.append("nothing yet"); return; }
  const box = document.createElement("span");
  box.className = "g-notes";
  items.forEach(t => { const s = document.createElement("span"); s.className = `g-note ${kind}`; s.textContent = t; box.appendChild(s); });
  d.appendChild(box);
}

function showDone() {
  const g = grid(), letters = lettersFrom(S.board, S.log);
  const ours = g.slots.every(s => s.cells.every(k => letters[k] === S.board.sol[k]));
  $("doneTitle").textContent = S.done.won ? "Solved" : "Our fill";
  const stats = [["Placements", placements()], ["Checks", checksUsed()], ["Clues", revealed().size], ["Suggestions", hintsUsed()], ["Time", clockText(elapsed())]];
  $("doneStats").replaceChildren(...stats.flatMap(([label, value]) => {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = label; dd.textContent = value;
    const box = document.createElement("div");
    box.append(dd, dt);
    return [box];
  }));
  // our fill, when yours differs (or you asked to see it)
  const words = document.createElement("p");
  words.className = "g-ours";
  if (!(ours && S.done.won)) words.textContent = `Our fill: ${g.slots.map(s => s.cells.map(k => S.board.sol[k]).join("")).join(", ")}`;
  // at a table, who placed how many of the words, in their colours
  const by = room ? placedBy(S.log) : {}, team = room ? seatsOf(room.data).sort((a, b) => a[1].slot - b[1].slot) : [];
  const share = document.createElement("p");
  share.className = "g-share";
  if (team.length > 1) share.append("Words placed: ", ...team.flatMap(([id, p], n) => [n ? " · " : "", seatChip(id === room.uid ? "You" : firstName(p.name), p.slot), ` ${by[id] || 0}`]));
  $("doneOurs").replaceChildren(...(team.length > 1 ? [share] : []), words);
  $("doneRules").replaceChildren(...fields().map((f, i) => { const li = document.createElement("li"); li.textContent = `${styleOf(i).name}: ${f.rule.text}`; return li; }));
  $("doneDlg").showModal();
}

// ---------- the menu ----------
function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }

// the menu: Play (a new board, the fill or result); in a room, back to solo; else a link to this board. Redrawn by the
// room's news only when it changes, so a button isn't replaced under a finger.
let menuDrawn = null;
const menuKey = () => `${room?.code || ""}|${!!S?.done}`;
function drawMenu() {
  const body = $("menuBody");
  menuDrawn = menuKey();
  body.replaceChildren();
  $("menuTitle").textContent = room ? "Playing together" : "Menu";
  part(body, "play").append(action("New board", () => newBoard(), "primary"), action(S.done ? "Show the result" : "Show our fill", giveUp));
  if (!room) part(body, "content").append(mirror("Difficulty", $("level")));
  if (room) part(body, "together").append(action("Back to solo", () => leave(), "link"));
  else part(body, "about").append(action("Copy this board's link", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Board link copied"); } catch { toast(location.href); }
  }, "link"));
}

// ---------- definitions ----------
// A double tap on a cell defines the complete words through it from Slate's own dictionary (slate-defs.js), so it
// works offline and has every word players may place. It is loaded on the first lookup, not with the board.
let lastTap = { k: null, t: 0, before: null };
/** A key press in between ends a double tap: tap, type, tap is two taps, and undoing the first would undo the typing. */
const forgetTap = () => { lastTap = { k: null, t: 0, before: null }; };
/** True on the second tap of the same cell within 350 ms. The first tap has already moved or turned the cursor (and
 *  changing word drops typed letters); that is undone, so a double tap only looks words up. */
function doubleTap(k) {
  const now = performance.now(), again = lastTap.k === k && now - lastTap.t < 350;
  if (again) {
    ({ cursor, dir, pending } = lastTap.before);
    forgetTap();
    render();
  } else lastTap = { k, t: now, before: { cursor, dir, pending: { ...pending } } };
  return again;
}
try { localStorage.removeItem("glyph:defs"); } catch { /* the old online lookup's cache, no longer read */ }
const SENSE = { n: "noun", v: "verb", a: "adjective", r: "adverb", p: "preposition", c: "conjunction", d: "determiner", o: "pronoun", i: "exclamation", x: "abbreviation", k: "contraction" };
const FORM = { p: "plural of", s: "present tense of", d: "past tense of", g: "-ing form of", c: "comparative of", t: "superlative of", f: "form of", v: "variant spelling of" };
let DEFS = null, loadingDefs = null;
const loadDefs = () => (loadingDefs ??= import("./slate-defs.js").then(m => (DEFS = m.DEFS), err => { loadingDefs = null; throw err; }));
/** A word's senses ({pos, text}) and the base words it is a form of ({base, how}), from its dictionary line. */
function entryOf(word) {
  const senses = [], forms = [];
  for (const part of (DEFS[word] || "").split("|")) {
    if (part.startsWith("=")) { const [base, how] = part.slice(1).split("."); forms.push({ base, how }); }
    else if (part) senses.push({ pos: SENSE[part[0]], text: part.slice(1) });
  }
  return { senses, forms };
}
const make = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
function sensesList(senses) {
  const list = make("ol");
  for (const s of senses) { const li = make("li"); li.append(make("span", s.pos, "pos"), s.text); list.appendChild(li); }
  return list;
}
/** One word: its senses, then what it is a form of. A word with no senses of its own (BILLS) shows its base's. */
function entryBox(word) {
  const box = make("div"), { senses, forms } = entryOf(word.toLowerCase());
  box.append(make("h3", word));
  if (senses.length) box.append(sensesList(senses));
  for (const { base, how } of forms) {
    const line = make("p", senses.length ? `Also ${how === "f" || how === "v" ? "a" : "the"} ${FORM[how]} ` : `${FORM[how][0].toUpperCase()}${FORM[how].slice(1)} `);
    line.append(make("b", base.toUpperCase()));
    box.append(line);
    if (!senses.length) box.append(sensesList(entryOf(base).senses));
  }
  if (!senses.length && !forms.length) box.append(make("p", "Not in Slate's dictionary: one of the word list's rarest words."));
  return box;
}
/** The complete words through a cell, defined: a double tap on the board. */
async function define(k) {
  const letters = enteredLetters();
  const words = [...new Set(grid().slots.filter(s => s.cells.includes(k)).map(s => wordAt(s, letters)).filter(w => w && VALID.has(w)))];
  if (!words.length) { toast("Finish a word through this cell first"); return; }
  const body = $("defineBody"), show = () => body.replaceChildren(...words.map(entryBox), make("p", "Definitions: Open English WordNet (CC BY 4.0), and Slate's own for words it lacks.", "credit"));
  if (DEFS) show();
  else { const p = make("p", "Looking it up…"); p.prepend(sextant()); body.replaceChildren(p); }
  if (!$("defineDlg").open) $("defineDlg").showModal();
  if (!DEFS) {
    try { await loadDefs(); show(); }
    catch { body.replaceChildren(make("p", "The dictionary didn't load. Open Slate once with a connection and it stays on the device.")); }
  }
}

// ---------- input ----------
/** Tapping a cell puts the cursor there, running across by default; tapping the cursor's cell again turns it. */
function select(k) {
  if (S.done) return;
  const before = currentSlot();
  if (k === cursor) {
    if (!slotFor(k, other(dir))) return;
    dir = other(dir);
  } else {
    cursor = k;
    dir = slotFor(k, "Across") ? "Across" : "Down";
  }
  if (!sameWord(currentSlot(), before)) pending = {};   // typed letters belong to their word
  render();
}

function typeKey(k) {
  if (S.done) return;
  forgetTap();
  const slot = currentSlot(), at = slot.cells.indexOf(cursor);
  if (k === "ENTER") { place(); return; }
  if (k === "BACK") { erase(slot, at); return; }
  if (/^[A-Z]$/.test(k)) {
    pending[cursor] = k;
    if (at < slot.cells.length - 1) cursor = slot.cells[at + 1];
  }
  render();
}

/**
 * Delete empties the cell under the cursor, typed or placed, and the cursor stays there. On an empty cell it steps
 * back one cell and empties that one, so pressing it repeatedly walks back along the word.
 */
function erase(slot, at) {
  const letters = lettersFrom(S.board, S.log);
  if (!pending[cursor] && !letters[cursor]) {
    if (at === 0) return;
    cursor = slot.cells[at - 1];
  }
  const target = cursor;
  delete pending[target];
  if (letters[target]) act(g => { if (g.done) return false; g.log.push({ clear: [target], ...(room && { by: room.uid }) }); });
  render();
}

/**
 * Arrow keys, as in the New York Times crossword: pressed across the word being typed where another word crosses,
 * the first press turns to that word; otherwise the cursor moves to the next cell that way, over gaps, and typing
 * then runs that way wherever a word does.
 */
function arrow(way) {
  if (S.done || !cursor) return;
  forgetTap();
  const [dr, dc] = { Up: [-1, 0], Down: [1, 0], Left: [0, -1], Right: [0, 1] }[way];
  const axis = dr ? "Down" : "Across", before = currentSlot();
  if (before.dir !== axis && slotFor(cursor, axis)) dir = axis;   // the word shown, not dir: a cell in one word shows it either way
  else {
    const rows = rowsOf(S.board), cells = new Set(grid().cells);
    const inside = (r, c) => r >= 0 && c >= 0 && r < rows.length && c < rows[0].length;
    let [r, c] = unkey(cursor), next = null;
    do { r += dr; c += dc; if (cells.has(key(r, c))) next = key(r, c); } while (!next && inside(r, c));
    if (!next) return;
    cursor = next;
    if (slotFor(cursor, axis)) dir = axis;
  }
  if (!sameWord(currentSlot(), before)) pending = {};   // typed letters belong to their word, as with a tap
  render();
}

function buildKeyboard() {
  const rows = [[..."QWERTYUIOP"], ["", ..."ASDFGHJKL", ""], ["ENTER", ..."ZXCVBNM", "BACK"]];
  const label = { BACK: "⌫", ENTER: "Place" };
  $("kbd").replaceChildren(...rows.map(keys => {
    const r = document.createElement("div");
    r.className = "g-krow";
    keys.forEach(k => {
      if (!k) { const gap = document.createElement("span"); gap.className = "g-half"; r.appendChild(gap); return; }
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label[k] || k;
      if (k.length === 1) b.dataset.key = k;
      else b.classList.add("wide");
      if (k === "ENTER") b.classList.add("place");
      if (k === "BACK") b.setAttribute("aria-label", "Delete");
      b.addEventListener("click", () => typeKey(k));
      r.appendChild(b);
    });
    return r;
  }));
}

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.replaceChildren(...(msg.endsWith("…") ? [sextant()] : []), msg);   // still working: the small sextant says so
  // float just above the action buttons, so the board stays visible
  t.style.top = `${Math.max(8, $("actions").getBoundingClientRect().top - t.offsetHeight - 10)}px`;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
}

document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (!S || joining) return;                  // no board yet: a room is being joined (a hardware keyboard reaches under the rete)
  if (e.key === "Enter") typeKey("ENTER");
  else if (e.key === "Backspace") typeKey("BACK");
  else if (e.key.startsWith("Arrow")) arrow(e.key.slice(5));
  else if (/^[a-z]$/i.test(e.key)) typeKey(e.key.toUpperCase());
  else return;
  e.preventDefault();
});
$("menuBtn").addEventListener("click", openMenu);
$("fieldsBtn").addEventListener("click", () => $("fieldsDlg").showModal());
$("fieldsClose").addEventListener("click", () => $("fieldsDlg").close());
$("fieldsDlg").addEventListener("click", e => { if (e.target === $("fieldsDlg")) $("fieldsDlg").close(); });
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneNew").addEventListener("click", () => { $("doneDlg").close(); newBoard(); });
$("checkBtn").addEventListener("click", check);
$("hintBtn").addEventListener("click", suggestWord);
$("defineClose").addEventListener("click", () => $("defineDlg").close());
$("clearBtn").addEventListener("click", clear);
$("level").addEventListener("change", e => newBoard(e.target.value));
window.addEventListener("resize", () => render());
$("board").addEventListener("pointerdown", () => { pressing = true; });
addEventListener("pointerup", lifted);
addEventListener("pointercancel", lifted);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) resync(); });   // restored from Safari's page cache
window.addEventListener("pagehide", clockPause);
window.visualViewport?.addEventListener("resize", () => render());   // Safari's bars coming and going

// ---------- start ----------
document.querySelector(".g-mark").innerHTML = APPS.find(a => a.id === GAME).logo;
bindSwitcher($("appsBtn"), GAME);
buildKeyboard();
const params = new URLSearchParams(location.search);
const code = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const forToday = arrivedForToday();          // from the games screen's tile: today's puzzle, still to play
const hash = Object.fromEntries(location.hash.slice(1).split("&").filter(Boolean).map(p => p.split("=")));
S = loadSolo();                              // a table dealt as you sit down is at your own board's level
/** Your own board: a shared link's, today's from the games screen's tile, the saved one, or a fresh Easy one. */
function soloStart() {
  if (hash.s && hash.d && (!S || String(S.seed) !== hash.s || S.level !== hash.d)) soloBoard(+hash.s, ["easy", "medium", "hard"].includes(hash.d) ? hash.d : "easy");
  else if (!S && forToday && !code) { soloBoard(today(), DAILY_LEVEL); S.daily = today(); saveSolo(); render(); }
  else if (!S) soloBoard(randomSeed(), "easy");
  else {
    shownDone = S.done ? JSON.stringify(S.done) : null; history.replaceState(null, "", `${location.pathname}${location.search}#s=${S.seed}&d=${S.level}`); render();
    // today's, once the board you left is drawn (it asks before leaving one you've started)
    if (forToday && !code && S.daily !== today()) setTimeout(() => newBoard("today"), 0);
  }
  clockRun();
}
// a room in the address: the board you share from the first moment, never your own while the room is joined (the others
// would be on another board until it was, your own clock running), and your own only if the join doesn't come off. The
// rete stays until the table's board is drawn (onRoom).
if (code.length === 4) {
  joining = busy(joiningWords(), { delay: 0 });
  join(code).then(ok => { if (!ok) { seated(); setRoomParam(null); soloStart(); } });
} else soloStart();
window.__slate = { get state() { return S; }, get room() { return room; }, get slot() { return S && currentSlot(); }, get cursor() { return cursor; },
  get table() { return room?.data || null; } };
