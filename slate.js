// Slate: solo and together play. Boards and rules come from slate-gen.js. Together games live in the app's
// shared rooms (rooms.js): the room's glyph branch holds this game's state; both players see everything.
import { generate, gridOf, rowsOf, VALID, fieldsOf, judge, notesFrom, lettersFrom, isSolved, jointsOf, key, unkey, clearable, eligibleCells, wordAt } from "./slate-gen.js";
import { branchPath, openRoom, createRoom, enterRoom, leaveRoom, reseat, pickSeat, otherHere, gameHref, GAMES } from "./rooms.js";
import { bindSwitcher, APPS } from "./apps.js";
import { reloadFresh } from "./pwa.js";
import { getSync } from "./net.js";
import { reportDuo } from "./suite.js";
import { dropdown } from "./dropdown.js";

dropdown(document.getElementById("level"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
// Saves, the room branch and the switcher id keep the game's first name (Glyph), so saved boards and rooms in
// play carry on after the rename.
const GAME = "glyph";
const STORE = "glyph:solo";
const CHECKS = 2, REVEALS = 2, HINTS = 2;
/** Checks, rule reveals and suggestions per board: unlimited on Easy, two each otherwise. */
const limitsFor = level => (level === "easy" ? { checks: Infinity, reveals: Infinity, hints: Infinity } : { checks: CHECKS, reveals: REVEALS, hints: HINTS });
const GAP = 6;
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
let room = null;     // together: { code, uid, sync, unwatch, data }
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
  if (room || !S || S.done || clockFrom != null || document.hidden) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms = (S.ms || 0) + performance.now() - clockFrom;
  clockFrom = null;
  saveSolo();
}
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
      cur.log = Object.values(cur.log || {});
      return change(cur) === false ? undefined : cur;
    });
    if (newer) { updateApp(); return false; }
    return !!r.value?.board;
  } catch (e) {
    console.error(e);
    toast("Couldn't save that: check your connection and try again");
    return false;
  }
}

// Bumped when together games change shape, so a device still running older code reloads instead of mangling them.
const APP = 4;

/** Another device runs newer code: switch to the newest version, once per session. */
async function updateApp() {
  try { if (sessionStorage.getItem("slate:updated")) { toast("Your partner has a newer version: close and reopen Slate"); return; }
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
  if (!S.done && placements() && !confirm("Leave this board unfinished?")) { $("level").value = S.level; return; }
  $("menuDlg").close();
  if (!room) { soloBoard(randomSeed(), level); return; }
  const seed = randomSeed(), board = generate(seed, level);
  act(g => { g.level = level; g.seed = seed; g.board = board; g.log = []; g.done = null; g.startedAt = Date.now(); });
}

/** Solved boards end themselves; both players see the result. */
function afterChange() {
  if (!S.done && isSolved(S.board, lettersFrom(S.board, S.log))) {
    clockPause();
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

/** Slate's state for a room: a fresh board, with these players seated. */
function freshState(players) {
  const seed = randomSeed();
  return { v: 1, app: APP, created: Date.now(), startedAt: Date.now(), level: S.level, seed, board: generate(seed, S.level),
    log: [], done: null, players };
}

async function together() {
  const name = await askName();
  if (!name) return;
  const sync = await connect();
  if (!sync) return;
  try {
    const code = await createRoom(sync, GAME, freshState({ [sync.uid]: { name, slot: 0, online: true } }));
    if (!code) { toast("Couldn't start a game, try again"); return; }
    enter(code, sync, name);
    openMenu();
  } catch (e) { explain(e); }
}

/** The players in a room: [id, player] for each seat (leftovers from devices that handed a seat over are skipped). */
const seatsOf = data => Object.entries(data?.players || {}).filter(([, p]) => p && p.slot != null);

/**
 * Joins a game. When both seats are taken, you can carry on as either player, for example after moving from
 * laptop to phone: you take over that seat (and name) and the other device leaves the game.
 */
async function join(code) {
  const sync = await connect();
  if (!sync) return false;
  try {
    const shared = await openRoom(sync, code);
    if (!shared) { toast("No game with that code"); return false; }
    const seen = shared.glyph || null;
    const seats = seatsOf(seen);
    let takeover = null;
    if (!seats.some(([id]) => id === sync.uid) && seats.length >= 2) {
      takeover = await pickSeat(seats);
      if (!takeover) return false;
    }
    const name = takeover ? seats.find(([id]) => id === takeover)[1].name : await askName();
    if (!name) return false;
    let full = false;
    const r = await sync.tx(roomPath(code), cur => {
      full = false;
      // the room began in another game: Slate starts its side of it with a fresh board
      if (cur === null) return seen ? null : freshState({ [sync.uid]: { name, slot: 0, online: true } });
      if (!cur.board) return undefined;
      cur.players = Object.fromEntries(seatsOf(cur));
      if (cur.players[sync.uid]) { cur.players[sync.uid].name = name; return cur; }
      if (takeover && cur.players[takeover]) {
        const next = reseat(cur, takeover, sync.uid);       // their seat, moves and all, are now this device's
        next.players[sync.uid] = { ...next.players[sync.uid], online: true };
        return next;
      }
      const slots = Object.values(cur.players).map(p => p.slot);
      if (slots.length >= 2) { full = true; return undefined; }
      cur.players[sync.uid] = { name, slot: slots.includes(0) ? 1 : 0, online: true };
      return cur;
    });
    if (!r.committed || !r.value) { toast(full ? "Someone else just took the free seat" : "No game with that code"); return false; }
    enter(code, sync, name);
    return true;
  } catch (e) { explain(e); return false; }
}

function enter(code, sync, name) {
  clockPause();
  room = { code, sync, uid: sync.uid, data: null, here: {} };
  setRoomParam(code);
  watchRoom();
  room.stopHere = enterRoom(sync, code, GAME, name, here => { if (room) { room.here = here; drawPartner(); } });
  room.stopPresence = sync.presence?.(`${roomPath(code)}/players/${sync.uid}`);
  room.online = true;
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
function onRoom(val) {
  if (!room) return;
  if ((val?.app || 0) > APP) { updateApp(); return; }
  if (!val?.board) { toast("That game has ended"); leave(); return; }
  if (!seatsOf(val).some(([id]) => id === room.uid)) { toast("This game continued on another device"); leave(); return; }
  room.data = val;
  const fresh = !S || S.board !== val.board && JSON.stringify(S.board) !== JSON.stringify(val.board);
  S = { seed: val.seed, level: val.level, board: val.board, log: Object.values(val.log || {}), done: val.done || null, startedAt: val.startedAt || val.created };
  if (fresh) { resetCursor(); shownDone = null; }
  // a board finished together is a team result for the duo record: solved, in the time it took (lower is better)
  if (S.done && !reportedDone.has(`${S.seed}-${S.startedAt}`)) {
    reportedDone.add(`${S.seed}-${S.startedAt}`);
    reportDuo("slate", `${S.seed}-${S.startedAt}`, S.done.won ? { score: Math.round(((S.done.at || 0) - (S.startedAt || 0)) / 1000), won: true, coop: true, lower: true } : { score: null, won: false, coop: true, lower: true })
      .catch(e => console.error(e));
  }
  try {
    if (!S.done && isSolved(S.board, lettersFrom(S.board, S.log))) afterChange();
    render();
    if ($("menuDlg").open) drawMenu();
  } catch (e) {
    // one bad update must never freeze the screen for the rest of the game
    console.error(e);
    toast("Something went wrong showing the last move; it's still saved");
  }
}

function leave() {
  room?.unwatch?.();
  room?.stopPresence?.();
  room?.stopConnection?.();
  room?.stopHere?.();
  if (room) leaveRoom(room.sync, room.code);
  room = null;
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
  history.replaceState(null, "", u);
}

// ---------- drawing ----------
function render() {
  if (!S) return;
  const g = grid(), fs = fields(), letters = lettersFrom(S.board, S.log);
  if (!cursor || !g.cells.includes(cursor)) resetCursor();
  const slot = currentSlot(), left = limitsFor(S.level).checks - checksUsed(), hintsLeft = limitsFor(S.level).hints - hintsUsed();
  $("level").value = S.level;
  $("checkBtn").textContent = left === Infinity ? "Check" : `Check (${left})`;
  $("checkBtn").disabled = !!S.done || left === 0 || thinking;
  $("hintBtn").textContent = hintsLeft === Infinity ? "Suggest" : `Suggest (${hintsLeft})`;
  $("hintBtn").disabled = !!S.done || hintsLeft === 0 || thinking;
  $("clearBtn").disabled = !!S.done;
  const notes = notesFrom(S.board, S.log);
  drawPartner();
  drawBoard(g, fs, letters, slot);
  drawFields(fs, notes);
  drawKeys(fs, notes);
  const doneKey = S.done ? JSON.stringify(S.done) : null;
  if (doneKey && doneKey !== shownDone) { shownDone = doneKey; showDone(); }
}

function drawPartner() {
  const el = $("partner");
  if (!room) { el.hidden = true; return; }
  const seated = seatsOf(room.data).find(([id]) => id !== room.uid);
  const there = otherHere(room.here, room.uid);
  el.hidden = false;
  el.innerHTML = "";
  if (room.online === false) { el.append("Reconnecting… moves made now may not reach your partner."); return; }
  if (there && there.game !== GAME) {
    // your partner has another game of the room open: say which, and offer to follow
    const b = document.createElement("b");
    b.textContent = there.name;
    const go = document.createElement("a");
    go.href = gameHref(there.game);
    go.textContent = `Join them`;
    el.append(b, ` is in ${GAMES[there.game].name}${there.online ? "" : " (away)"}. `, go);
    return;
  }
  if (!seated && !there) { el.append(`Game ${room.code}: waiting for your partner to join.`); return; }
  const name = seated?.[1].name || there.name, away = there ? !there.online : seated[1].online === false;
  const b = document.createElement("b");
  b.textContent = name + (away ? " (away)" : "");
  el.append("Playing with ", b, ".");
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
    else if (letters[k]) { ch.className = "ch"; ch.textContent = letters[k]; }
    cell.appendChild(ch);
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
 * Sizes the board and the keyboard to the visible screen (Safari's bars included): the board as large as the width
 * allows while the keyboard keeps its minimum height, then the keys grow into whatever height is left.
 */
function fitLayout(g) {
  const vh = window.visualViewport?.height || window.innerHeight;
  // measured from what sits above the board, since the board centres itself in the space it gets
  const above = $("partner").hidden ? document.querySelector("#app > .top") : $("partner");
  const top = above.getBoundingClientRect().bottom + window.scrollY + 12;
  const app = getComputedStyle($("app"));
  const width = $("app").clientWidth - parseFloat(app.paddingLeft) - parseFloat(app.paddingRight);
  const bottom = parseFloat(app.paddingBottom) || 0;
  const fixed = $("actions").offsetHeight + 12 + 12 + 2 * KEY_GAP;    // actions and the gaps around and between rows
  const boardRoom = vh - top - bottom - fixed - 3 * MIN_KEY;
  const size = Math.max(34, Math.min((width - GAP * (g.W - 1)) / g.W, (boardRoom - GAP * (g.H - 1)) / g.H, 84));
  const spare = vh - top - bottom - fixed - (g.H * size + (g.H - 1) * GAP);
  document.documentElement.style.setProperty("--g-key-h", `${Math.max(MIN_KEY, Math.min(MAX_KEY, spare / 3))}px`);
  return size;
}
const MIN_KEY = 44, MAX_KEY = 66, KEY_GAP = 6;

/** The field of the clicked cell, if it has one and the board is in play. */
function cursorField(fs) {
  if (!cursor || S.done) return null;
  const i = fs.findIndex(f => f.cells.includes(cursor));
  return i >= 0 ? i : null;
}

/**
 * What a letter would do in the clicked cell of a pair field, against every neighbour in the field that has a
 * letter (placed or typed), each pair read in the field's direction: true if it's known to pass with all of them,
 * false if known to fail with one, null if not known. Known from the pairs tried so far, or from the rule once
 * revealed. Null altogether while no neighbour in the field has a letter.
 */
function pairVerdicts(fs, notes, i) {
  const f = fs[i], letters = { ...lettersFrom(S.board, S.log), ...pending };
  const ends = jointsOf(f.cells).filter(([a, b]) => a === cursor || b === cursor)
    .map(([a, b]) => (a === cursor ? { other: b, before: false } : { other: a, before: true }))
    .filter(e => letters[e.other]);
  if (!ends.length) return null;
  const rule = revealed().has(i) ? f.rule : null;
  return c => {
    let all = true;
    for (const { other, before } of ends) {
      const [x, y] = before ? [letters[other], c] : [c, letters[other]], pair = `${x}→${y}`;
      const ok = rule ? rule.test(x, y) : notes[i].ok.has(pair) ? true : notes[i].no.has(pair) ? false : null;
      if (ok === false) return false;
      if (ok !== true) all = false;
    }
    return all ? true : null;
  };
}

/**
 * Colours the keyboard for the clicked cell. In a single-letter field: the letters the field has taken (green) and
 * rejected (red). In a pair field with a lettered neighbour: the letters known to go with it (green) and known not
 * to (red), from the pairs tried so far. With the rule revealed, every letter.
 */
function drawKeys(fs, notes) {
  const i = cursorField(fs), type = i != null ? fs[i].rule.type : null;
  const known = type === "single" && revealed().has(i) ? fs[i].rule : null;
  const verdict = type === "pair" ? pairVerdicts(fs, notes, i) : type === "single"
    ? c => (known ? known.test(c) : notes[i].ok.has(c) ? true : notes[i].no.has(c) ? false : null) : null;
  $("kbd").title = !verdict ? "" : type === "single" ? `Letters the ${styleOf(i).name} field has taken (green) and rejected (red)`
    : `Letters known to go with the ${styleOf(i).name} field's letters beside this cell (green) and known not to (red)`;
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
  $("doneOurs").replaceChildren(words);
  $("doneRules").replaceChildren(...fields().map((f, i) => { const li = document.createElement("li"); li.textContent = `${styleOf(i).name}: ${f.rule.text}`; return li; }));
  $("doneDlg").showModal();
}

// ---------- the menu ----------
function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }

function drawMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; body.appendChild(e); return e; };
  add("button", "btn primary wide", "New board").addEventListener("click", () => newBoard());
  if (room) {
    $("menuTitle").textContent = "Playing together";
    add("button", "btn wide", S.done ? "Show the result" : "Show our fill").addEventListener("click", () => { $("menuDlg").close(); giveUp(); });
    add("button", "link", "Back to solo").addEventListener("click", () => { $("menuDlg").close(); leave(); });
    return;
  }
  $("menuTitle").textContent = "Menu";
  add("p", "stats", "To play together, link with your partner on the games screen (tap the title) and ask them from there.");
  add("button", "btn wide", S.done ? "Show the result" : "Show our fill").addEventListener("click", () => { $("menuDlg").close(); giveUp(); });
  add("button", "link", "Copy this board's link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Board link copied"); } catch { toast(location.href); }
  });
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
  else body.replaceChildren(make("p", "Looking it up…"));
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
  t.textContent = msg;
  // float just above the action buttons, so the board stays visible
  t.style.top = `${Math.max(8, $("actions").getBoundingClientRect().top - t.offsetHeight - 10)}px`;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
}

document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
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
const hash = Object.fromEntries(location.hash.slice(1).split("&").filter(Boolean).map(p => p.split("=")));
S = loadSolo();
if (hash.s && hash.d && (!S || String(S.seed) !== hash.s || S.level !== hash.d)) soloBoard(+hash.s, ["easy", "medium", "hard"].includes(hash.d) ? hash.d : "easy");
else if (!S) soloBoard(randomSeed(), "easy");
else { shownDone = S.done ? JSON.stringify(S.done) : null; history.replaceState(null, "", `${location.pathname}${location.search}#s=${S.seed}&d=${S.level}`); render(); }
clockRun();
if (code.length === 4) join(code).then(ok => { if (!ok) setRoomParam(null); });
window.__slate = { get state() { return S; }, get room() { return room; }, get slot() { return S && currentSlot(); }, get cursor() { return cursor; } };
