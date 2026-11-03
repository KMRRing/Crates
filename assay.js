// Assay: Wordle's genre (README, Assay). Guess the hidden word; each letter of a guess is marked in place, elsewhere
// in the word, or out. One word, several boards at once, a word that dodges, or a three-minute sprint, at four
// lengths and three levels, with Wordle's hard rule or a strict one, and a computer rival if you like. The rules,
// the words, the levels and the daily are assay-engine.js's; the rivals assay-solve.js's; the team's table
// assay-table.js's. Together: the pair as a team, each seeing one colour of the marks (together.js), or everyone
// racing the same word (duel.js), from the partner sheet or a Party. Levels (assay-levels.js) are a ladder of recipes
// beside free play, each kept as it was left (assay:lruns), its stars in assay:camp. Words are one of three games (the
// lexicon, assay-lexicons.js): the other two, primes and equations (assay-numbers.js), are played alone, in free play
// and on the ladder, with every mode; the daily, the team and the race are words.
import { LENGTHS, LEVELS, BOARDS, DAILY, HIT, NEAR, GREY, UNSEEN, SPRINT_MS, newGame, guessIn, rowsOf, solvedAt, limitOf, guessesFor, answersOf,
  scoreOf, sprintSolved, guessesUsed, timeUp, dailyWord, seenAs, unhide, packOf, levelOf, meanGuesses } from "./assay-engine.js";
import { RIVALS, RIVAL_NAMES, rivalPlan, rivalSoFar, rivalMarks } from "./assay-solve.js";
import { freshTeam, isTeam, tidy, guessAt, rowsOfTable, roleAt, resultOf as teamResult, dealAt, limitOfTable } from "./assay-table.js";
import { ENGLISH } from "./assay-words.js";
import { lexOf, unitOf, nounOf, ready, IDS } from "./assay-lexicons.js";
import * as LV from "./assay-levels.js";
import { miniature } from "./assay-mini.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { today, arrivedForToday, IN_FRAME, soloHref } from "./suite.js";
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";
import { isDuel } from "./duel-core.js";
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords, openBranch, branchPath } from "./rooms.js";
import { getSync } from "./net.js";
import { busy, whileBusy, waitMark } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const LEX = ENGLISH;                      // the daily's, the team's and the race's
/** The lexicon on the screen: the team's is English, a game's is its own, else what the menu has chosen. */
const lexNow = () => (T ? ENGLISH : S ? lexOf(S.lang) : lexOf(prefs.lang));
const RUN = "assay:run", PREFS = "assay:prefs", STATS = "assay:stats", DAILY_KEY = "assay:daily", BEST = "assay:best", STREAK = "assay:streak",
  RIVAL_KEY = "assay:rivals", SEEN = "assay:seen", NOTES = "assay:notes", TRACK = "assay:track", CAMP = "assay:camp", LRUNS = "assay:lruns";
const STAR = "★", HOLLOW = "☆";
const APP = 1;                 // the tables' version (the team's and the race's)
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inWords = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
const big = w => w.toUpperCase();
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const NUMBER = { 2: "Two", 4: "Four", 8: "Eight" };
const MODE_NAMES = { classic: "One word", boards: "Boards", dodge: "Dodge", sprint: "Sprint" };
const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };
const RULE_NAMES = { free: "Free", hard: "Hard", strict: "Strict" };
const RULE_LINES = { free: "Any word may be guessed.", hard: "Hard: a letter found stays in place, and every letter shown is used.", strict: "Strict: every guess could be the word." };

// ---------- what you've chosen ----------
const DEFAULTS = { lang: "en", mode: "classic", len: 5, boards: 4, level: "medium", rules: "free", rival: "off", contrast: false };
function cleanPrefs(p) {
  const x = { ...DEFAULTS, ...(p && typeof p === "object" ? p : {}) };
  if (!MODE_NAMES[x.mode]) x.mode = DEFAULTS.mode;
  if (!IDS.includes(x.lang)) x.lang = DEFAULTS.lang;
  const lens = lexOf(x.lang).lengths;
  if (!lens.includes(x.len)) x.len = lens.includes(DEFAULTS.len) ? DEFAULTS.len : lens.at(-1);
  if (!BOARDS.includes(x.boards) || x.boards === 1) x.boards = DEFAULTS.boards;
  if (!LEVELS.includes(x.level)) x.level = DEFAULTS.level;
  if (!RULE_NAMES[x.rules]) x.rules = DEFAULTS.rules;
  if (x.rival !== "off" && !RIVALS.includes(x.rival)) x.rival = "off";
  x.contrast = !!x.contrast;
  return x;
}
let prefs = cleanPrefs(read(PREFS, null));
const setPref = (k, v) => { prefs = cleanPrefs({ ...prefs, [k]: v }); write(PREFS, prefs); };
const applyContrast = () => document.documentElement.classList.toggle("as-contrast", prefs.contrast);

// ---------- the levels ----------
/** The campaign as kept: the level being played and the stars won in each, mended if it is not what it should be. */
function readCamp() {
  const c = read(CAMP, null), stars = LV.LEVELS.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const open = stars.findIndex(s => s < 1);                          // the first level not beaten is the last one open
  return { at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, open < 0 ? LV.COUNT - 1 : open)) : 0, stars };
}
let camp = readCamp();
/** Whether level n (0 on) is open: the first, and any whose one before is beaten. */
const isOpen = n => n === 0 || camp.stars[n - 1] >= 1;
// Someone who has played before carries on with free play (the daily among it); a new player begins on the ladder.
let track = read(TRACK, null);
if (track !== "levels" && track !== "free") track = read(RUN, null) ? "free" : "levels";

// ---------- the game on the screen ----------
// S: a game of yours (assay-engine.js's, with kind "daily" or "random", the draft being typed, the rival's plan), or
// the race's (S.duel, kept by duel.js apart from yours); T: the team's table as last seen. Everything the screen shows
// is in S (kept in assay:run as it changes), so a partner watching sees it as it stands.
let S = null, T = null;
let joining = null;                       // the mark while this phone sits down at the table in its address
let lobbyMatch = null;                    // a race dealt, not yet started here
const valid = s => !!s && s.v === 1 && Array.isArray(s.secret) && Array.isArray(s.guesses) && lexOf(s.lang).lengths.includes(s.len) && Number.isFinite(s.ms);
function save() {
  if (IN_FRAME || !S) return;
  if (S.duel) duel.keep(S);
  else if (S.kind === "level") write(LRUNS, { ...read(LRUNS, {}), [S.lv]: S });
  else write(RUN, S);
}
/** The game saved for the way being played (and the level), or null. */
function savedGame() {
  const g = track === "levels" ? read(LRUNS, {})[camp.at] : read(RUN, null);
  return valid(g) && !g.duel && (track === "levels" ? g.kind === "level" && g.lv === camp.at : g.kind !== "level") ? g : null;
}
const started = () => !!S && !S.duel && !S.over && (S.guesses.length > 0 || (S.past || []).length > 0);
const dueToday = () => read(DAILY_KEY, {})[today()] == null;

/** Puts game g on the table as yours: `extra` is what makes it a daily's or a level's. */
function begin(g, kind, extra = {}) {
  S = { ...g, kind, ...extra, draft: "", rival: prefs.rival !== "off" ? rivalPlan(g, prefs.rival, lexOf(g.lang)) : null };
  if (kind !== "daily" && g.mode !== "dodge" && g.lang === "en") write(SEEN, [...answersOf(g).slice(0, 8), ...read(SEEN, [])].slice(0, 400));   // a sprint's first few
  fresh = true; reveal = null; shownDone = null;
  clockFrom = null;
  save();
  render();
  clockRun();
}
const loaded = new Set();
/** Makes a lexicon ready to deal from: equations have a file to fetch, said while it comes; the others are ready. */
async function prepare(lex) {
  if (!lex.load || loaded.has(lex.id)) return;
  await whileBusy(`Loading the ${nounOf(lex)}s`, () => ready(lex));
  loaded.add(lex.id);
}
/** Starts a game of yours: today's, or a random one as the menu has it. */
async function start(kind) {
  const day = today(), lex = kind === "daily" ? LEX : lexOf(prefs.lang);
  await prepare(lex);
  begin(kind === "daily"
    ? newGame({ lex, ...DAILY, rules: prefs.rules, words: [dailyWord(day, lex)], day, seed: day })
    : newGame({ lex, mode: prefs.mode, len: prefs.len, boards: prefs.boards, level: prefs.level, rules: prefs.rules, seed: randomSeed(), avoid: read(SEEN, []) }), kind);
}
function confirmStart(kind) {
  if (started() && !confirm(kind === "daily" ? "Leave this word for today's?" : "Start a new word? This one isn't finished.")) return;
  start(kind);
}
/** A word of level n (0 on): the level's own the first time, until it is cleared; another from the same recipe after that or when asked. */
async function startLevel(n, again = false) {
  camp.at = n;
  if (!IN_FRAME) write(CAMP, camp);
  await prepare(LV.lexOfLevel(n));
  begin(LV.levelGame(n, !again && camp.stars[n] < 1 ? LV.seedOf(n) : randomSeed(), read(SEEN, [])), "level", { lv: n });
}
function confirmLevelWord() {
  if (started() && !confirm("Start a new word of this level? This one isn't finished.")) return;
  startLevel(camp.at, true);
}
/** Plays level n (0 on) as it was left, or with a new word if it was not begun. */
async function playLevel(n) {
  if (!isOpen(n)) return;
  clockStop();
  camp.at = n;
  write(CAMP, camp);
  track = "levels";
  write(TRACK, track);
  await resume();
}
async function setTrack(next) {
  if (next === track) return;
  clockStop();
  track = next;
  write(TRACK, track);
  await resume();
}

// ---------- the clock ----------
// A game of yours counts the time it's on the screen (the rival thinks while you do, and the sprint runs out); the
// menu, the rules and the games screen stop it. A race counts from the start everyone shares, and doesn't stop.
let clockFrom = null;
function clockRun() {
  if (IN_FRAME || !S || S.duel || S.over || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockStop() {
  if (clockFrom == null || !S) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
const elapsed = () => (!S ? 0 : S.duel ? Math.max(0, duel.now() - S.begun) : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
onPause(() => clockStop(), () => clockRun());

// ---------- typing ----------
let fresh = true;            // nothing typed into this game yet (the hint line shows)
let reveal = null;           // { board rows key, at }: the row just played, turning over
let shake = false;
function typeKey(k) {
  if (IN_FRAME || joining) return;
  if (T) { teamKey(k); return; }
  if (!S || S.over || (S.duel && !duel.playing)) return;
  if (k === "ENTER") { enter(); return; }
  if (k === "BACK") S.draft = S.draft.slice(0, -1);
  else if (S.draft.length < S.len) S.draft += k;
  fresh = false; message = null;
  save();
  render(true);
}
function enter() {
  const w = S.draft;
  if (w.length < S.len) { refuse(`Not enough ${unitOf(lexOf(S.lang))}`); return; }
  const before = S.mode === "sprint" ? S.at : null, r = guessIn(S, w, lexOf(S.lang));
  if (!r.ok) { refuse(r.why); return; }
  S.draft = "";
  // a sprint's word solved or spent moves on at once: its last row turns over on a board that's already the next
  reveal = { at: performance.now(), key: S.mode === "sprint" && S.at !== before ? null : rowKey() };
  if (S.mode === "sprint" && S.at !== before) note(S.past.at(-1).won ? `${big(answersOf(S)[before])}: solved` : `It was ${big(answersOf(S)[before])}`, S.past.at(-1).won ? "good" : "bad");
  if (S.over) finish(); else { save(); tell(); }
  render();
}
const rowKey = () => `${S.seed}:${S.mode === "sprint" ? S.at : 0}:${S.guesses.length - 1}`;
function refuse(why) {
  note(why, "bad");
  shake = true;
  render();
  navigator.vibrate?.(30);
  setTimeout(() => { shake = false; render(); }, 380);
}
let message = null;          // { text, tone } until the next key
function note(text, tone = "") { message = text ? { text, tone } : null; drawSay(); }
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === "Enter") typeKey("ENTER");
  else if (e.key === "Backspace") typeKey("BACK");
  else if (lexNow().letter(e.key)) typeKey(lexNow().letter(e.key));
  else return;
  e.preventDefault();
});

// ---------- the end of a game ----------
function finish() {
  clockStop();
  if (S.duel) { tell(true); save(); }
  else { record(); roundOver("assay"); }
  save();
  setTimeout(() => { if (S?.over) showDone(); }, revealMs() + 350);
}
const revealMs = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : (S?.len || 5) * 110 + 250);
const modeKey = s => (s.kind === "daily" ? "daily" : `${s.lang && s.lang !== "en" ? `${s.lang}-` : ""}${s.mode}-${s.len}${s.mode === "boards" ? `x${s.boards}` : ""}-${s.level}`);
/** Counts a game of yours the moment it's over: its stats, today's (the daily), and the rival's record. */
function record() {
  if (IN_FRAME || S.counted) return;
  S.counted = true;
  const won = S.over === "won" || (S.mode === "sprint" && sprintSolved(S) > 0), used = S.mode === "sprint" ? sprintSolved(S) : S.guesses.length;
  if (S.kind === "level") {                                     // a level counts in its stars (the best it has had), not in the stats of free play
    S.stars = LV.starsFor(S.lv, S);
    S.better = S.stars > camp.stars[S.lv];
    if (S.better) { camp.stars[S.lv] = S.stars; write(CAMP, camp); }
  } else {
    const stats = read(STATS, {}), st = stats[modeKey(S)] || { played: 0, won: 0, dist: {}, now: 0, best: 0 };
    st.played++;
    if (won) { st.won++; st.now++; st.best = Math.max(st.best, st.now); st.dist[used] = (st.dist[used] || 0) + 1; } else st.now = 0;
    if (S.mode === "sprint" || S.mode === "dodge") st.top = st.top == null ? used : S.mode === "sprint" ? Math.max(st.top, used) : (won ? Math.min(st.top, used) : st.top);
    stats[modeKey(S)] = st;
    write(STATS, stats);
  }
  if (S.kind === "daily") {
    const days = read(DAILY_KEY, {}), day = S.day;
    if (days[day] == null) {                                     // the first play of a day counts; a replay doesn't
      days[day] = won ? used : guessesFor(5) + 1;
      write(DAILY_KEY, days);
      const best = read(BEST, null);
      if (won && (best == null || used < best)) write(BEST, used);
      const s = read(STREAK, null) || { now: 0, best: 0, last: null }, yesterday = today(new Date(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) - 864e5));
      s.now = won ? (s.last === yesterday ? s.now + 1 : 1) : 0;
      s.best = Math.max(s.best, s.now);
      if (won) s.last = day;
      write(STREAK, s);
    }
  }
  if (S.rival) {
    const r = read(RIVAL_KEY, {}), mine = { score: scoreOf(S), ms: S.ms }, theirs = { score: S.rival.score, ms: S.rival.done };
    const k = mine.score - theirs.score || mine.ms - theirs.ms;
    const x = r[S.rival.level] || { w: 0, l: 0, d: 0 };
    if (k < 0) x.w++; else if (k > 0) x.l++; else x.d++;
    r[S.rival.level] = x;
    S.beat = k < 0 ? "won" : k > 0 ? "lost" : "drew";
    write(RIVAL_KEY, r);
  }
}

// ---------- drawing the boards ----------
// The boards are drawn once a game (their size never changes while it's played) and repainted as it goes. Their
// tiles size themselves to the room they're given (assay.css, container units): the script only says how many tiles
// and boards there are, and how the boards stand, side by side or in rows, as the room is shaped.
let built = null;             // { key, boards: [[row elements]], tiles }
function boardsView() {
  if (T) {
    const role = roleAt(T, team.slot ?? 0), over = !!T.over;
    const rows = rowsOfTable(T).map(r => ({ ...r, marks: over ? r.marks : seenAs(r.marks, role) }));
    // the letters being typed: yours, else those of whoever's turn it is, as they come
    const typing = T.players?.[Object.keys(T.players).find(id => T.players[id].slot === T.turn)]?.draft || "";
    const mine = !!myDraft || T.turn === team.slot;
    return { key: `t:${T.created}:${T.n}:${T.len}`, len: T.len, rows: limitOfTable(T), fit: limitOfTable(T), boards: [{ rows, solved: T.over === "won" }],
      draft: T.over ? "" : mine ? myDraft : typing, draftBy: mine ? team.slot : T.turn, team: true };
  }
  if (!S) {
    const m = lobbyMatch || { len: prefs.len };
    return { key: `lobby:${m.len}`, len: m.len, rows: guessesFor(m.len), fit: guessesFor(m.len), boards: [{ rows: [], solved: false }], draft: "" };
  }
  const n = S.mode === "boards" ? S.boards : 1, dodge = S.mode === "dodge";
  const boards = Array.from({ length: n }, (_, b) => ({ rows: rowsOf(S, b), solved: S.mode !== "sprint" && solvedAt(S, b) >= 0 }));
  const fit = dodge ? 8 : limitOf(S), rows = dodge ? Math.max(fit, S.guesses.length + (S.over ? 0 : 1)) : fit;
  return { key: `s:${S.seed}:${S.mode}:${S.len}:${n}:${S.mode === "sprint" ? S.at : 0}:${rows}`, len: S.len, rows, fit, boards, draft: S.over ? "" : S.draft };
}
/**
 * How the boards stand in their room: the arrangement whose tiles come out largest, among those whose tiles still
 * fit across at a legible size. The room may scroll down (eight boards on a phone do), never across.
 */
function arrange(n, len, rows) {
  if (n === 1) return [1, 1];
  const box = $("boards"), w = box.clientWidth || 1, h = box.clientHeight || 1, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const gap = .1875 * rem, bgap = .625 * rem, least = 1.125 * rem;     // as assay.css has them for several boards
  const options = (n === 2 ? [[2, 1], [1, 2]] : n === 4 ? [[2, 2], [4, 1], [1, 4]] : [[2, 4], [4, 2], [8, 1]]).map(([c, r]) => {
    const across = (w - (c - 1) * bgap - c * (len - 1) * gap) / (c * len), down = (h - (r - 1) * bgap - r * (rows - 1) * gap) / (r * rows);
    return { c, r, across, size: Math.min(across, down) };
  });
  const fitting = options.filter(o => o.across >= least);
  return [...(fitting.length ? fitting : options)].sort((a, b) => b.size - a.size).map(o => [o.c, o.r])[0];
}
function buildBoards(v) {
  const box = $("boards"), [bc, br] = arrange(v.boards.length, v.len, v.fit);
  const grid = el("div", "as-grid");
  grid.style.cssText = `--len: ${v.len}; --rows: ${v.fit}; --bc: ${bc}; --br: ${br};`;
  grid.classList.toggle("multi", v.boards.length > 1);
  grid.classList.toggle("team", !!v.team);
  const boards = v.boards.map((_, b) => {
    const board = el("div", "as-board");
    board.setAttribute("aria-label", v.boards.length > 1 ? `Board ${b + 1}` : "Board");
    const rows = Array.from({ length: v.rows }, () => {
      const row = el("div", "as-row");
      for (let i = 0; i < v.len; i++) row.append(el("span", "as-tile"));
      if (v.team) row.prepend(el("i", "as-by"));
      board.append(row);
      return row;
    });
    grid.append(board);
    return { board, rows };
  });
  box.replaceChildren(grid);
  built = { key: `${v.key}:${bc}x${br}`, v, boards, bc, br };
}
const MARK = { [HIT]: "h", [NEAR]: "n", [GREY]: "g", [UNSEEN]: "u" };
const SAY = { [HIT]: "in place", [NEAR]: "elsewhere", [GREY]: "not in the word", [UNSEEN]: "not yours to see" };
/** Draws the boards; `typing` when only the letters in the row being typed in changed, so the rows already played stay as they are. */
function drawBoards(typing = false) {
  const v = boardsView(), [bc, br] = arrange(v.boards.length, v.len, v.fit);
  if (!built || built.key !== `${v.key}:${bc}x${br}`) { buildBoards(v); typing = false; }
  const lastKey = S && !T ? rowKey() : T ? `t:${T.n}:${T.guesses.length - 1}` : null;
  const turning = reveal && reveal.key === lastKey && performance.now() - reveal.at < revealMs() + 100;
  v.boards.forEach((b, bi) => {
    const { board, rows } = built.boards[bi];
    board.classList.toggle("solved", b.solved);
    rows.forEach((row, ri) => {
      if (typing && ri !== b.rows.length) return;
      const done = b.rows[ri], draft = !done && !b.solved && ri === b.rows.length ? v.draft : "";
      row.classList.toggle("now", !done && !b.solved && ri === b.rows.length && (!S || !S.over));
      row.classList.toggle("shake", shake && !done && ri === b.rows.length);
      row.classList.toggle("turn", !!(turning && done && ri === b.rows.length - 1));
      row.classList.toggle("win", !!(done && b.solved && ri === b.rows.length - 1 && !turning));
      if (v.team) {
        const by = row.querySelector(".as-by"), who = done ? done.by : draft ? v.draftBy : null;
        by.hidden = who == null;
        if (who != null) { by.textContent = initialOf(who); by.style.setProperty("--who", `var(--p${who % 6})`); }
      }
      [...row.querySelectorAll(".as-tile")].forEach((tile, i) => {
        const letter = done ? done.guess[i] : draft[i] || "";
        tile.textContent = lexNow().show ? lexNow().show(letter) : letter;
        tile.className = `as-tile${done ? ` ${MARK[done.marks[i]]}` : letter ? " d" : ""}`;
        tile.style.setProperty("--i", String(i));
        if (done) tile.setAttribute("aria-label", `${big(letter)}, ${SAY[done.marks[i]]}`); else tile.removeAttribute("aria-label");
      });
    });
  });
  if (turning) setTimeout(() => render(), Math.max(0, revealMs() + 120 - (performance.now() - reveal.at)));
  const now = $("boards").querySelector(".as-row.now");
  if (now && built.v.rows > built.v.fit) now.scrollIntoView({ block: "nearest" });
}

// ---------- the keyboard ----------
let keyNodes = null, keysFor = null;
function buildKeys() {
  const lex = lexNow(), rows = lex.rows.map((letters, r) => (r === lex.rows.length - 1 ? ["ENTER", ...letters, "BACK"] : r === 1 ? ["", ...letters, ""] : [...letters]));
  keyNodes = new Map();
  tapOf.clear();
  keysFor = lex.id;
  $("keys").replaceChildren(...rows.map(keys => {
    const row = el("div", "as-krow");
    for (const k of keys) {
      if (!k) { row.append(el("span", "as-half")); continue; }
      const b = el("button", `as-key${k.length > 1 ? " wide" : ""}`);
      b.type = "button";
      if (k === "ENTER") { b.textContent = "Enter"; b.classList.add("enter"); }
      else if (k === "BACK") { b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>'; b.setAttribute("aria-label", "Delete"); }
      else { b.append(el("span", "as-segs"), el("span", "as-l", lex.show ? lex.show(k) : k)); b.dataset.key = k; }
      tapOf.set(b, k);
      row.append(b);
      if (k.length === 1) keyNodes.set(k, b);
    }
    return row;
  }));
}
// A key answers as the finger goes down (no wait for the click), and a tap that lands between keys or just off their edge goes
// to the nearest one: the gaps are a seventh of a key's pitch, and a thumb typing fast lands in them (Chrome moves such a
// tap to a key itself; Safari doesn't, and the letter was lost). One listener on the keyboard, not on each key, so the gaps
// belong to it. The click a tap brings after it is passed over; a click with no tap before it is a keyboard's Enter or Space
// on a focused key. A key held down does not repeat.
const tapOf = new Map();          // key button -> its key ("a", "ENTER", "BACK")
const holding = new Map();        // pointer id -> the button it pressed, to lift when it lets go
let lastLift = -1e9;
function keyAt(x, y) {
  const reach = parseFloat(getComputedStyle(document.documentElement).fontSize) * .5;
  let best = null, nearest = reach + 1;
  for (const b of tapOf.keys()) {
    const r = b.getBoundingClientRect(), d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (d < nearest) { nearest = d; best = b; }
  }
  return best;
}
$("keys").addEventListener("pointerdown", e => {
  e.preventDefault();
  if (e.button > 0) return;
  const b = keyAt(e.clientX, e.clientY);
  if (!b) return;
  holding.set(e.pointerId, b);
  b.classList.add("down");
  keyTap(tapOf.get(b));
});
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  $("keys").addEventListener(type, e => { holding.get(e.pointerId)?.classList.remove("down"); holding.delete(e.pointerId); lastLift = performance.now(); });
}
$("keys").addEventListener("click", e => {
  const b = e.target.closest?.(".as-key");
  if (b && tapOf.has(b) && performance.now() - lastLift > 500) keyTap(tapOf.get(b));
});
function keyTap(k) {
  if (T && notesOn && k.length === 1) { toggleNote(k); return; }
  typeKey(k);
}
function drawKeys() {
  const v = boardsView(), n = v.boards.length;
  // what each letter has shown on each board (a solved board's letters no longer matter)
  const per = v.boards.map(b => {
    const out = {};
    for (const { guess, marks } of b.rows) [...guess].forEach((l, i) => { if (marks[i] !== UNSEEN && !(out[l] >= marks[i])) out[l] = marks[i]; });
    return out;
  });
  const struck = T ? notes() : "";
  for (const [k, b] of keyNodes) {
    const marks = per.map(p => p[k]), segs = b.querySelector(".as-segs");
    if (n === 1) { b.dataset.m = marks[0] == null ? "" : MARK[marks[0]]; segs.replaceChildren(); }
    else {
      b.dataset.m = v.boards.every((bd, i) => bd.solved || marks[i] === GREY) && marks.some(m => m === GREY) ? "g" : "";
      if (segs.childElementCount !== n) segs.replaceChildren(...v.boards.map(() => el("i")));
      segs.style.setProperty("--sc", String(n <= 2 ? 2 : n === 4 ? 2 : 4));
      [...segs.children].forEach((s, i) => { s.className = v.boards[i].solved ? "x" : marks[i] == null ? "" : MARK[marks[i]]; });
    }
    b.classList.toggle("struck", struck.includes(k));
  }
  $("keys").classList.toggle("multi", n > 1);
  $("keys").classList.toggle("off", !!(IN_FRAME || joining || (!S && !T) || (S && S.duel && !duel.playing)));
}

// ---------- the strip over the board, the line under it ----------
function drawStrip() {
  const what = $("what"), count = $("count"), rival = $("rival"), lb = $("levelBtn");
  rival.hidden = true;
  lb.hidden = !(S && !T && S.kind === "level" && !S.duel);
  if (!lb.hidden) lb.textContent = `Level ${S.lv + 1}`;
  if (T) {
    what.replaceChildren(el("b", "", "Together"), ` · ${T.len} letters · ${LEVEL_NAMES[T.level] || ""}`);
    count.textContent = T.over ? (T.over === "won" ? `Solved in ${T.guesses.length}` : "Not solved") : `Guess ${T.guesses.length + 1} of ${limitOfTable(T)}`;
    drawNotesButton();
    return;
  }
  $("notesBtn")?.remove();
  if (!S) { what.replaceChildren(el("b", "", "The race"), lobbyMatch ? ` · ${describeMatch(lobbyMatch)}` : ""); count.textContent = ""; return; }
  // what's being played, shortest first: one word needs no name, several boards their count
  const lvl = S.kind === "level" && !S.duel;
  const kind = S.duel ? "Race" : S.kind === "daily" ? "Today's" : lvl ? `Level ${S.lv + 1}` : S.mode === "boards" ? `${NUMBER[S.boards]} boards` : S.mode === "classic" ? null : MODE_NAMES[S.mode];
  const lx = lexOf(S.lang);
  const bits = [(S.duel || lvl) && S.mode === "boards" ? `${NUMBER[S.boards]} boards` : null, lvl && (S.mode === "dodge" || S.mode === "sprint") ? MODE_NAMES[S.mode] : null, lx.id === "en" ? null : lx.name, `${S.len} ${unitOf(lx)}`, S.kind === "daily" || lvl ? null : LEVEL_NAMES[S.level], S.rules !== "free" ? RULE_NAMES[S.rules] : null].filter(Boolean);
  what.replaceChildren(...(kind ? [el("b", "", kind), " · "] : []), bits.join(" · "));
  if (S.mode === "sprint") {
    const left = Math.max(0, SPRINT_MS - elapsed());
    count.replaceChildren(el("b", "", clock(left)), ` · ${plural(sprintSolved(S), "solved", "solved")}`);
  } else if (S.mode === "dodge") count.replaceChildren(el("b", "", plural(S.left, "word")), " left");
  else count.replaceChildren(S.over ? (S.over === "won" ? `Solved in ${S.guesses.length}` : "Not solved") : `Guess ${S.guesses.length + 1} of ${limitOf(S)}`);
  if (S.rival) drawRival(rival);
}
/** The rival, as it goes: its latest row's marks (its letters are kept for the end), or how far it has got. */
function drawRival(box) {
  const plan = S.rival, ms = S.over ? Infinity : elapsed(), rows = rivalSoFar(plan, ms), name = RIVAL_NAMES[plan.level];
  box.hidden = false;
  box.replaceChildren(el("b", "", name));
  if (S.mode === "sprint") { box.append(` ${rows.filter((r, k) => rivalMarks(S, r).every(m => m === HIT)).length} solved`); }
  else if (S.mode === "boards") {
    const solved = new Set();
    rows.forEach(r => answersOf(S).forEach((w, b) => { if (r.guess === w) solved.add(b); }));
    box.append(` ${solved.size}/${S.boards}`);
  } else {
    const last = rows.at(-1);
    if (last) { const strip = el("span", "as-mini"); for (const m of rivalMarks(S, last)) strip.append(el("i", MARK[m])); box.append(strip); }
    const done = ms >= plan.done;
    box.append(done && plan.won ? ` ✓ ${plan.rows.length}` : ` ${rows.length || "…"}`);
  }
  box.setAttribute("aria-label", `${name}, the computer: ${rows.length} guesses so far`);
}
function drawSay() {
  const box = $("say");
  box.className = "as-say";
  box.replaceChildren();
  if (message) { box.textContent = message.text; if (message.tone) box.classList.add(message.tone); return; }
  if (joining) { box.append(waitMark(), joiningWords()); return; }
  if (T) {
    if (T.over) { box.append(T.over === "won" ? `Solved together in ${T.guesses.length}. ` : `It was ${big(unhide(T.secret))}. `, linkButton("Another word", () => teamNext())); return; }
    const mine = T.turn === team.slot, theirs = nameOfSlot(T.turn);
    box.textContent = mine ? "Your turn: say what you see, then guess" : awayTurn() ? `${theirs} is away: anyone may guess` : `${theirs}'s turn: tell them what you see`;
    return;
  }
  if (!S) { box.textContent = duel.on ? "The word comes when everyone's ready" : ""; return; }
  if (S.over) {
    const text = S.mode === "sprint" ? `Time: ${plural(sprintSolved(S), "word")} solved. ` : S.over === "won" ? `Solved in ${S.guesses.length}. ` : `It was ${answersOf(S).filter((w, b) => solvedAt(S, b) < 0).map(big).join(", ")}. `;
    box.append(text, linkButton(S.duel ? "The result" : "How it went", () => (S.duel ? duel.open() : showDone())));
    return;
  }
  if (fresh && !S.guesses.length) box.textContent = S.mode === "dodge" ? "No word is chosen: it dodges every guess it can" : S.mode === "sprint" ? `As many ${nounOf(lexOf(S.lang))}s as you can in three minutes` : `Guess the ${S.len}-${S.lang === "en" ? "letter" : lexOf(S.lang).unit.replace(/s$/, "")} ${nounOf(lexOf(S.lang))}${S.mode === "boards" ? "s" : ""}`;
}
const linkButton = (text, fn) => { const b = el("button", "link", text); b.type = "button"; b.addEventListener("click", fn); return b; };

/** Draws everything; after a letter typed or deleted (`typing`) just the row it is in and the line under the board, since nothing else changed. */
function render(typing = false) {
  if (typing && keyNodes && keysFor === lexNow().id) { drawBoards(true); drawSay(); return; }
  if (!keyNodes || keysFor !== lexNow().id) buildKeys();
  if (!duel.on) drawTeamLine();
  drawStrip();
  drawBoards();
  drawKeys();
  drawSay();
}

// ---------- the sheet at the end ----------
function showDone() {
  if (!S?.over || S.duel) return;
  if (shownDone === `${S.seed}:${S.mode}`) { if (!$("doneDlg").open) $("doneDlg").showModal(); return; }
  shownDone = `${S.seed}:${S.mode}`;
  const body = $("doneBody"), title = $("doneTitle");
  body.replaceChildren();
  const won = S.over === "won";
  if (S.mode === "sprint") title.textContent = `${plural(sprintSolved(S), "word")} in three minutes`;
  else if (S.mode === "dodge") title.textContent = `Pinned down in ${S.guesses.length}`;
  else title.textContent = won ? `Solved in ${S.guesses.length}` : S.mode === "boards" ? `${S.boards - answersOf(S).filter((_, b) => solvedAt(S, b) < 0).length} of ${S.boards} solved` : "Not this time";
  const lvl = S.kind === "level", stars = lvl ? (S.stars ?? LV.starsFor(S.lv, S)) : 0;
  if (lvl && stars) title.textContent = `${title.textContent} · ${STAR.repeat(stars)}${HOLLOW.repeat(3 - stars)}`;
  const words = S.mode === "sprint" ? answersOf(S).slice(0, S.past.length) : answersOf(S);
  const list = el("div", "as-words");
  words.forEach((w, b) => {
    const solved = S.mode === "sprint" ? S.past[b]?.won : solvedAt(S, b) >= 0;
    const row = el("div", `as-word${solved ? "" : " missed"}`);
    for (const ch of w) row.append(el("span", `as-tile ${solved ? "h" : "g"}`, lexOf(S.lang).show ? lexOf(S.lang).show(ch) : ch));
    list.append(row);
  });
  body.append(list);
  if (S.lang === "en" && (words.length === 1 || (S.mode === "boards" && S.boards <= 2))) defineInto(body, words);
  if (S.rival) {
    const p = S.rival, name = RIVAL_NAMES[p.level], theirs = S.mode === "sprint" ? `${plural(p.solved, "word")}` : p.won ? `in ${p.rows.length}` : "not at all";
    body.append(el("p", `as-vs ${S.beat || ""}`, `${S.beat === "won" ? "You beat" : S.beat === "lost" ? "Beaten by" : "Level with"} ${name}, who solved it ${theirs}${S.mode === "sprint" ? " in three minutes" : ""}.`));
    if (S.mode !== "sprint" && S.mode !== "boards") body.append(el("p", "as-their", p.rows.map(r => big(r.guess)).join(" · ")));
  }
  const key = modeKey(S), st = lvl ? null : read(STATS, {})[key];
  if (lvl) body.append(el("p", `as-vs ${stars ? "won" : ""}`, `${stars ? `${plural(stars, "star")}${S.better ? ", your best yet" : ""}` : "Not cleared"}. ${LV.parText(S.lv)[0].toUpperCase()}${LV.parText(S.lv).slice(1)}.`));
  if (st) body.append(statsBlock(st, S));
  const buttons = el("div", "as-buttons");
  if (lvl) {
    const next = S.lv + 1;
    if (next < LV.COUNT && isOpen(next)) buttons.append(action("Next level", () => playLevel(next), "primary"));
    buttons.append(action(stars ? "Another word" : "Try again", () => startLevel(S.lv, true), next < LV.COUNT && isOpen(next) ? "" : "primary"));
  } else if (S.kind === "daily" || dueToday()) {
    if (dueToday()) buttons.append(action("Today's word", () => start("daily"), "primary"));
    buttons.append(action(S.kind === "daily" ? "A random word" : "New word", () => start("random"), dueToday() ? "" : "primary"));
  } else buttons.append(action("New word", () => start("random"), "primary"));
  if (S.mode !== "sprint") buttons.append(action("Copy the grid", copyGrid, ""));
  body.append(buttons);
  for (const b of body.querySelectorAll(".btn, .link")) b.addEventListener("click", () => $("doneDlg").close());
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
let shownDone = null;
/** Your record in this kind of game: played, solved, the streak and how many guesses it took (a sprint's and the
 *  dodging word's, their best). */
function statsBlock(st, g) {
  const box = el("div", "as-stat-box"), nums = el("div", "as-stats");
  const pct = st.played ? Math.round(100 * st.won / st.played) : 0;
  const cells = g.mode === "sprint" ? [[st.played, "played"], [st.top ?? 0, "most words"]] : g.mode === "dodge" ? [[st.played, "played"], [st.top ?? "–", "fewest"]]
    : [[st.played, "played"], [`${pct}%`, "solved"], [st.now, "streak"], [st.best, "best streak"]];
  for (const [v, label] of cells) { const d = el("div"); d.append(el("b", "", String(v)), el("span", "", label)); nums.append(d); }
  nums.style.gridTemplateColumns = `repeat(${cells.length}, minmax(0, 1fr))`;
  box.append(nums);
  const limit = g.mode === "sprint" || g.mode === "dodge" ? null : limitOf(g), now = g.over === "won" ? g.guesses.length : null;
  if (limit) {
    const dist = el("div", "as-dist"), most = Math.max(1, ...Object.values(st.dist || {}));
    for (let k = 1; k <= limit; k++) {
      const n = st.dist?.[k] || 0, row = el("div", k === now ? "now" : ""), bar = el("i", "", String(n));
      bar.style.width = `${Math.max(8, 100 * n / most)}%`;
      row.append(el("span", "", String(k)), bar);
      dist.append(row);
    }
    box.append(dist);
  }
  return box;
}
// Slate's dictionary has every four- and five-letter answer (loaded only when one is shown)
let defs = null;
async function defineInto(body, words) {
  if (words.some(w => w.length > 5)) return;
  try { defs ??= (await import("./slate-defs.js")).DEFS; } catch { return; }
  const POS = { n: "noun", v: "verb", a: "adjective", r: "adverb", p: "preposition", c: "conjunction", d: "determiner", o: "pronoun", i: "exclamation" };
  const box = el("div", "as-defs");
  for (const w of words) {
    const senses = (defs[w] || "").split("|").filter(s => s && !s.startsWith("=")).slice(0, 2);
    if (!senses.length) continue;
    const p = el("p", "as-def");
    p.append(el("b", "", big(w)));
    for (const s of senses) { p.append(" ", el("i", "", POS[s[0]] || ""), ` ${s.slice(1)}.`); }
    box.append(p);
  }
  const words0 = body.querySelector(".as-words");
  if (box.childElementCount && words0) words0.after(box);
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayText = day => `${day % 100} ${MONTHS[Math.floor(day / 100) % 100 - 1]} ${Math.floor(day / 10000)}`;
async function copyGrid() {
  const sq = { [HIT]: "🟩", [NEAR]: "🟨", [GREY]: "⬜" }, n = S.mode === "boards" ? S.boards : 1;
  const lx = lexOf(S.lang), size = `${S.len} ${unitOf(lx)}`;
  const what = S.kind === "daily" ? dayText(S.day) : S.kind === "level" ? `level ${S.lv + 1}, ${size}` : S.mode === "dodge" ? `Dodge, ${size}` : S.mode === "boards" ? `${NUMBER[S.boards]} boards, ${size}` : size;
  const score = S.mode === "dodge" ? `in ${S.guesses.length}` : `${S.over === "won" ? S.guesses.length : "X"}/${limitOf(S)}`;
  const head = `Assay ${lx.id === "en" ? "" : `${lx.name} `}${what} ${score}${S.rules !== "free" ? "*" : ""}`;
  const grids = Array.from({ length: n }, (_, b) => rowsOf(S, b).map(r => r.marks.map(m => sq[m]).join("")).join("\n"));
  const text = `${head}\n${grids.join("\n\n")}`;
  try { await navigator.clipboard.writeText(text); toast("Grid copied"); } catch { toast(text, 6000); }
}

// ---------- the race: the same word for everyone (duel.js) ----------
// Everyone at the table plays the match's game on their own phone from the moment it starts: the fewest guesses win,
// then the quicker (a sprint: the most words). Your own game, its stats and today's stay as they were.
const matchFrom = p => {
  const g = newGame({ lex: LEX, mode: p.mode, len: p.len, boards: p.boards, level: p.level, rules: p.rules, seed: randomSeed() });
  return { seed: g.seed, mode: g.mode, len: g.len, boards: g.boards, level: g.level, rules: g.rules, secret: g.secret };
};
const describeMatch = m => [MODE_NAMES[m.mode] === "Boards" ? `${NUMBER[m.boards]} boards` : MODE_NAMES[m.mode], `${m.len} letters`, LEVEL_NAMES[m.level], m.rules !== "free" ? RULE_NAMES[m.rules] : null].filter(Boolean).join(", ")
  + (m.mode === "sprint" ? ": the most words in three minutes" : ": the fewest guesses win, then the quicker");
function playMatch(match, { begun, kept }) {
  const same = kept && kept.seed === match.seed && kept.mode === match.mode && valid(kept);
  const g = same ? kept : { ...newGame({ lex: LEX, mode: match.mode, len: match.len, boards: match.boards, level: match.level, rules: match.rules, seed: match.seed, words: match.secret ? match.secret.map(unhide) : null }), draft: "" };
  S = { ...g, duel: true, begun, kind: "race" };
  lobbyMatch = null; shownDone = null; reveal = null; fresh = !g.guesses.length;
  save();
  render();
  tell(!!S.over);
}
/** What the table sees of your run: guesses so far, and at the end your score. */
function tell(done = false) {
  if (!S?.duel || !duel.playing && !done) return;
  const solved = S.mode === "boards" ? [...Array(S.boards).keys()].filter(b => solvedAt(S, b) >= 0).length : null;
  const text = S.mode === "sprint" ? `${plural(sprintSolved(S), "word")}${done ? "" : ` · ${clock(SPRINT_MS - elapsed())}`}`
    : S.over === "won" ? `solved in ${S.guesses.length}` : S.over ? (S.mode === "boards" ? `${solved}/${S.boards}, out of guesses` : "not solved") : `${plural(S.guesses.length, "guess", "guesses")}${solved != null ? ` · ${solved}/${S.boards}` : ""}`;
  duel.report(done ? { score: scoreOf(S), text, done: true, ms: Math.round(elapsed()) } : { score: guessesUsed(S), text });
}
const duel = createDuel({
  game: "assay", name: "Assay", app: APP, accent: "--assay-in", line: $("others"), toast: roomToast, lower: true,
  deal: () => matchFrom(prefs),
  describe: describeMatch,
  play: (match, at) => playMatch(match, at),
  onLobby: match => { S = null; lobbyMatch = match; built = null; render(); },
  onLeave: () => afterLeave(),
  extra: () => (S?.over ? el("p", "as-their", answersOf(S).map(big).join(" · ")) : null),
  extraTitle: "The word",
});

// ---------- the team: one word for the table, the colours split (together.js) ----------
// The pair takes turns to guess; one sees what's in place, the other what's elsewhere, and a letter is out only when
// neither of you has it lit, so you say what you see. Three or more share the colours round the table, the third
// seeing what's out. While someone types, the others see the letters come. Once it's over, everyone sees everything.
let myDraft = "", notesOn = false, shownTeamDone = null;
const people = () => (team.room && team.slot != null ? [{ slot: team.slot, name: team.room.name, me: true, here: true }, ...team.others()].sort((a, b) => a.slot - b.slot) : []);
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const nameOfSlot = slot => { const p = people().find(x => x.slot === slot); return p?.me ? "You" : first(p?.name); };
const initialOf = slot => (Array.from(first(people().find(x => x.slot === slot)?.name))[0] || "?").toUpperCase();
const awayTurn = () => { const p = people().find(x => x.slot === T?.turn); return !!p && !p.me && !p.here; };
function onTeam(val) {
  seated();
  const was = T;
  T = tidy(structuredClone(val));
  if (!was && T.players?.[team.room.uid]?.draft) sendDraft("");   // letters half typed before a reload are gone here: so for the others
  if (!was || was.n !== T.n) { myDraft = ""; reveal = null; built = null; message = null; }
  else if (T.guesses.length > was.guesses.length) { reveal = { at: performance.now(), key: `t:${T.n}:${T.guesses.length - 1}` }; if (T.guesses.at(-1).by === team.slot) myDraft = ""; }
  render();
  if (T.over && shownTeamDone !== `${T.created}:${T.n}`) { shownTeamDone = `${T.created}:${T.n}`; setTimeout(() => { if (T?.over) teamDone(); }, revealMs() + 350); }
}
let draftTimer = 0;
function teamKey(k) {
  if (T.over) return;
  const mine = T.turn === team.slot || awayTurn();
  if (!mine) { note(`It's ${nameOfSlot(T.turn)}'s turn`, "bad"); return; }
  message = null;
  if (k === "ENTER") { teamGuess(); return; }
  if (k === "BACK") myDraft = myDraft.slice(0, -1); else if (myDraft.length < T.len) myDraft += k;
  render();
  clearTimeout(draftTimer);                          // the others see the letters come, a write at most every 120 ms
  draftTimer = setTimeout(() => sendDraft(myDraft), 120);
}
function sendDraft(text) {
  const room = team.room;
  if (!room) return;
  room.sync.update(`${branchPath(room.code, "assay")}/players/${room.uid}`, { draft: text || null }).catch(e => console.error(e));
}
async function teamGuess() {
  const w = myDraft;
  if (w.length < T.len) { refuse("Not enough letters"); return; }
  if (!LEX.accepts(w)) { refuse("Not in the word list"); return; }
  const at = { n: T.n, k: T.guesses.length, slot: team.slot, w, anyone: awayTurn() };
  let why = null;
  const ok = await team.act(t => {
    why = guessAt(tidy(t), at);
    if (why === "ok" && t.players?.[team.room.uid]) delete t.players[team.room.uid].draft;
    return why === "ok";
  });
  if (!ok && why) note(why === "turn" ? `It's ${nameOfSlot(T.turn)}'s turn` : why === "over" ? "It's over" : "Too late: someone guessed first", "bad");
}
/** The next word for the table, at the length and level of whoever deals it: asks first while this one is under way. */
async function teamNext() {
  if (!T) return;
  if (!T.over && T.guesses.length && !confirm("Deal a new word for the table? This one isn't finished.")) return;
  const n = T.n, seed = randomSeed(), { len, level } = prefs;
  await team.act(t => (t.n === n ? (dealAt(tidy(t), { len, level, seed }), true) : false));
}
/** Who's at the table and what each sees, the kind of mark in its own colour (those away greyed). */
function drawTeamLine() {
  const box = $("others");
  box.hidden = !T;
  if (!T) return;
  box.className = "as-others as-team";
  const SEES = { [HIT]: ["h", "in place"], [NEAR]: ["n", "elsewhere"], [GREY]: ["g", "out"] };
  box.replaceChildren(...people().flatMap((p, i) => {
    const who = el("span", `as-who${p.here ? "" : " away"}`), [cls, words] = SEES[roleAt(T, p.slot)];
    if (!p.me) { const dot = el("i", "as-by", initialOf(p.slot)); dot.style.setProperty("--who", `var(--p${p.slot % 6})`); who.append(dot); }
    who.append(p.me ? "You see " : `${first(p.name)} `, el("b", `as-sees ${cls}`, words), p.here ? "" : " (away)");
    return i ? [" · ", who] : [who];
  }));
}
function teamDone() {
  const body = $("doneBody");
  $("doneTitle").textContent = T.over === "won" ? `Solved together in ${T.guesses.length}` : "Not this time";
  body.replaceChildren();
  const w = unhide(T.secret), row = el("div", `as-word${T.over === "won" ? "" : " missed"}`);
  for (const ch of w) row.append(el("span", `as-tile ${T.over === "won" ? "h" : "g"}`, ch));
  const list = el("div", "as-words"); list.append(row); body.append(list);
  defineInto(body, [w]);
  const by = people().map(p => `${p.me ? "you" : first(p.name)} ${T.guesses.filter(g => g.by === p.slot).length}`).join(", ");
  body.append(el("p", "as-their", `Guesses: ${by}.`));
  const buttons = el("div", "as-buttons");
  buttons.append(action("Another word", () => teamNext(), "primary"), action("Back to solo", backToSolo, "link"));
  body.append(buttons);
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
// notes: your own, on the keyboard (a letter you've worked out is out, struck through)
const notesKey = () => (T && team.room ? `${team.room.code}:${T.created}:${T.n}` : "");
const notes = () => { const n = read(NOTES, null); return n?.key === notesKey() ? n.out || "" : ""; };
function toggleNote(k) {
  const now = notes(), out = now.includes(k) ? now.replace(k, "") : now + k;
  write(NOTES, { key: notesKey(), out });
  drawKeys();
}
function drawNotesButton() {
  let b = $("notesBtn");
  if (!b) {
    b = el("button", "as-notes", "Notes");
    b.id = "notesBtn"; b.type = "button";
    b.addEventListener("click", () => { notesOn = !notesOn; drawNotesButton(); note(notesOn ? "Notes: tap a letter you know is out to strike it" : null); });
    $("strip").append(b);
  }
  b.setAttribute("aria-pressed", String(notesOn));
}
const team = createTogether({
  game: "assay", app: APP, toast: roomToast, askName,
  valid: isTeam,
  slots: t => t?.people || 2,
  fresh: (players, { ask } = {}) => freshTeam(players, { app: APP, people: ask?.people, len: prefs.len, level: prefs.level, seed: randomSeed() }),
  onState: onTeam,
  onPresence: () => { if (T) render(); },
  onLeave: () => afterLeave(),
  result: teamResult,
});

// ---------- the room in the address: which table, and moving between them ----------
// A request from the partner sheet sits the pair down as a team; a Party's (or a pair's request for more than two) to
// a race. A reload sits down at whatever the table holds. Either kind can be swapped for the other from the menu:
// the swapping phone deals the other kind into the room, and the others' phones follow it there.
let lastCode = null, switching = false, ended = false;
const seated = () => { joining?.(); joining = null; };
function roomToast(msg) {
  if (msg === "That game has ended") { ended = true; return; }          // the table changed kind: said once we see what it is
  toast(msg);
}
async function joinRoom(code) {
  lastCode = code;
  joining = busy(joiningWords(), { delay: 0 });
  render();
  let ok = false;
  try {
    const sync = await getSync(), shared = await openBranch(sync, code, "assay");
    const q = new URLSearchParams(location.search), at = Number(q.get("new")) || 0, ask = shared?.ask, here = shared?.assay;
    const asked = !!at && ask?.at === at && ask.game === "assay" && ask.answer === "yes";
    const race = asked ? q.has("party") || (ask.people || 2) > 2 : isDuel(here) ? true : isTeam(here) ? false : q.has("party");
    ok = race ? await duel.join(code) : await team.join(code);
  } catch (e) { console.error(e); }
  seated();
  if (!ok) solo(); else render();
}
/** A table left: back to solo, or (the table's kind changed under it) on to the new one. */
async function afterLeave() {
  seated();
  T = null; S = null; lobbyMatch = null; built = null; myDraft = ""; notesOn = false;
  if ($("doneDlg").open) $("doneDlg").close();
  if (switching) return;
  if (ended && lastCode) {
    ended = false;
    try {
      const sync = await getSync(), shared = await openBranch(sync, lastCode, "assay");
      if (isDuel(shared?.assay)) { toast("The table moved to a race"); if (await duel.join(lastCode)) { render(); return; } }
      else if (isTeam(shared?.assay)) { toast("The table moved to a team game"); if (await team.join(lastCode)) { render(); return; } }
    } catch (e) { console.error(e); }
    toast("That game has ended");
  }
  solo();
}
async function switchTo(kind) {
  const code = lastCode || team.room?.code || duel.together.room?.code;
  if (!code) return;
  switching = true;
  if (kind === "race") team.leave(); else duel.leave();
  switching = false;
  joining = busy(joiningWords(), { delay: 0 });
  const ok = kind === "race" ? await duel.join(code) : await team.join(code);
  seated();
  if (!ok) solo(); else render();
}
const backToSolo = () => { if (team.room) team.leave(); else if (duel.on) duel.leave(); else location.replace(soloHref()); };

// ---------- the rules ----------
// The header's Rules and the menu's The rules: Assay as it's played here, its numbers the engine's own, so the sheet
// can't drift from the game. The clock stands still while it's open, as for the menu (menu.js).
function showRules() {
  // the guesses each length gets, alike lengths together: "six guesses for a word of five, six or seven letters and
  // seven for one of four letters"
  const counts = [...new Set(LENGTHS.map(n => guessesFor(n)))].sort((a, b) => a - b).map((g, i) =>
    `${inWords(g)}${i ? "" : " guesses"} for ${i ? "one" : "a word"} of ${LENGTHS.filter(n => guessesFor(n) === g).map(inWords).join(", ").replace(/, (\w+)$/, " or $1")} letters`);
  $("rulesBody").innerHTML = `
    <p>Find the hidden word. Each guess must be a word of the same length, and each of its letters is marked: <b>green</b> if it's in the word in that place, <b>ochre</b> if it's in the word somewhere else, <b>grey</b> if it isn't in the word at all. High contrast, in Settings, makes the green blue.</p>
    <p><b>For example.</b> The word is CRANE and you guess TRACE: T is grey, R and A green, C ochre, E green. A letter guessed twice is marked the way word-guessing games usually mark it: the ones in place first, then elsewhere for as many as the word has left, the rest grey. Against THOSE, GEESE gets its S and its last E green and the rest grey, since THOSE has only one E.</p>
    <p><b>Guesses.</b> You have ${counts.join(" and ")}: four is the hard length, whole families of its words differing in one letter (BAKE, CAKE, FAKE, LAKE, MAKE). Any word of the length in the word list may be guessed; one that isn't, or a guess too short, shakes and costs nothing. The hidden words are everyday words, never a plural, a past tense or another form of a word.</p>
    <p><b>Playing.</b> Type on the keyboard under the board, Enter at its left and Delete at its right, or on a keyboard of your own. The keys take the colours your guesses have shown, so what's left is plain to see.</p>
    <p><b>Hard and Strict.</b> Settings' Rules: <b>Free</b> takes any word; <b>Hard</b> is the hard mode of word-guessing games, where a letter found in place stays there and every letter shown is used, as often as shown; <b>Strict</b> asks for a word that could still be the answer, so a letter shown elsewhere also moves and a grey one stays out. A guess they forbid is turned away with the reason. A change takes effect at once on a word not yet guessed at, otherwise from the next. Several boards always play free.</p>
    <p><b>Modes.</b> In the menu, with the letters (${inWords(LENGTHS[0])} to ${inWords(LENGTHS.at(-1))}) and the level: <b>One word</b>; <b>Boards</b>, two, four or eight words at once, every guess played on each, with ${guessesFor(5, 2)}, ${guessesFor(5, 4)} or ${guessesFor(5, 8)} guesses at five letters; <b>Dodge</b>, where no word is chosen: each guess is marked to keep as many words in play as it can, and you beat it by leaving it one word and guessing that, in as few guesses as you can; <b>Sprint</b>, as many words as you can in ${inWords(SPRINT_MS / 60000)} minutes, a word solved or spent moving on at once. The levels go by how many guesses a player needs, not by how rare the word is.</p>
    <p><b>Numbers.</b> The menu's Game also has <b>Primes</b>, where the hidden number is a prime of four or five digits and every guess must be a prime too, and <b>Equations</b>, where the hidden sum balances, six to eight characters of digits, + − × ÷ and one =, with a whole number alone on the right (the sum is worked in the usual order: 6÷4×2 is 3), and every guess must balance too. The marks, the keys, the guesses, the rules, the modes and the rival are the same, a digit or a sign at a time. These are played alone, not as the daily or at a table.</p>
    <p><b>The rival.</b> In Settings, the computer plays the same word beside you, at ${RIVALS.map(l => RIVAL_NAMES[l]).join(", ").replace(/, (\w+)$/, " or $1")}; its latest marks show over the board, its words at the end. Fewer guesses win, and equal guesses go to the quicker. It plays on your clock, which stands still while the menu or these rules are open.</p>
    <p><b>Today's word.</b> The same for everyone: ${inWords(DAILY.len)} letters at ${LEVEL_NAMES[DAILY.level]}, ${inWords(guessesFor(DAILY.len))} guesses, and a new one at midnight UTC. It counts the moment your last guess lands, and your streak is the days solved in a row. Hard or Strict may be on for it; Copy the grid then marks your grid with an asterisk, as other word-guessing games do.</p>
    <p><b>Together.</b> With your partner, as a team: one word, guesses taken in turns, and the colours split, one of you seeing what's in place and the other what's elsewhere; a letter is out only when neither of you has it lit, so say what you see. Notes strikes letters out on your own keyboard. Or a race, at a party too: the same word on every phone, the fewest guesses winning, then the quicker.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}

// ---------- the menu ----------
let pick = null;                          // the next game of yours: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on || team.room || joining) {
    const together = part(body, "together");
    if (duel.on) {
      duel.menu(together);
      if (duel.together.others().length === 1) together.append(action("Play as a team instead", () => switchTo("team"), ""));
      nextChoices(part(body, "content"), "The next match", false);
    } else if (team.room) {
      together.append(action("Another word", () => teamNext(), "primary"), action("Race instead", () => switchTo("race"), ""));
      const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
      together.append(line(`At the table: ${all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all.join("")}`), action("Back to solo", backToSolo, "link"));
      const content = part(body, "content");
      content.append(choice("Letters", LENGTHS.map(n => [n, String(n)]), T?.len ?? prefs.len, v => { setPref("len", v); }),
        choice("Words", LEVELS.map(l => [l, LEVEL_NAMES[l]]), prefs.level, v => setPref("level", v)), line("For the next word."));
    } else { const wait = line(joiningWords()); wait.prepend(waitMark()); together.append(wait, action("Back to solo", backToSolo, "link")); }
    settingsPart(body, false);
    showMenu(body);
    return;
  }
  const levels = track === "levels", content = part(body, "content");
  pick ??= (S?.kind === "daily" && !S.over) || dueToday() ? "daily" : "random";
  part(body, "play").append(action(levels ? "New word" : pick === "daily" ? "Today's word" : "New word", () => (levels ? confirmLevelWord() : confirmStart(pick)), "primary"));
  content.append(choice("Play", [["levels", "Levels"], ["free", "Free play"]], track, v => { setTrack(v); openMenu(); }));
  if (levels) content.append(levelList());
  else {
    content.append(choice("Word", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
    if (pick === "random") nextChoices(content, null);
    else content.append(line(`Today's word: five letters, Medium, six guesses, the same for everyone.${dueToday() ? "" : ` You took ${dayResult()}.`}`));
  }
  settingsPart(body, true);
  const about = part(body, "about");
  if (levels) about.append(line(`${camp.stars.filter(Boolean).length} of ${LV.COUNT} levels cleared, ${plural(camp.stars.reduce((a, b) => a + b, 0), "star")}. Each level sets its own rules.`));
  else about.append(line(aboutLine()));
  about.append(line("Words from SCOWL (Kevin Atkinson); meanings from Open English WordNet."));
  showMenu(body);
}
/** The levels, three to a row under their chapter: each its board in miniature, its number and name and the stars won. Those not open yet are dimmed; any open one can be played at any time, as it was left. */
function levelList() {
  const all = el("div", "as-levels");
  LV.CHAPTERS.forEach((ch, c) => {
    const grid = el("div", "as-lgrid"), to = LV.CHAPTERS[c + 1]?.from ?? LV.COUNT;
    all.append(el("h3", "as-chap", ch.name), grid);
    for (let n = ch.from; n < to; n++) {
      const L = LV.LEVELS[n], won = camp.stars[n], open = isOpen(n), b = el("button", won ? "done" : ""), map = el("div", "as-lmap"), row = el("div", "as-lrow");
      b.type = "button";
      b.disabled = !open;
      if (n === camp.at && track === "levels") b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Level ${n + 1}, ${L.name}${won ? `, ${plural(won, "star")}` : ""}${open ? "" : ", not open yet"}`);
      map.innerHTML = miniature(L);
      row.append(el("b", "", String(n + 1)), el("span", "", open ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : ""));
      const bits = [L.mode === "boards" ? `${NUMBER[L.boards]} boards` : L.mode === "dodge" ? "Dodge" : L.mode === "sprint" ? "Sprint" : null, `${L.len} ${unitOf(lexOf(L.lex)).replace("characters", "chars")}`, L.rules !== "free" ? RULE_NAMES[L.rules] : null].filter(Boolean);
      b.append(map, row, el("div", "as-lname", L.name), el("div", "as-lsize", bits.join(" · ")));
      b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
      grid.append(b);
    }
  });
  return all;
}
/** Opens the menu as built, the rules at the foot of its play part. */
function showMenu(body) {
  part(body, "play").append(action("The rules", showRules, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The choices for the next game: the game (words, primes or equations), mode, length, boards, level. */
function nextChoices(box, note, solo = true) {
  const redraw = () => { openMenu(); }, lex = lexOf(solo ? prefs.lang : "en"), unit = unitOf(lex), noun = nounOf(lex);
  if (solo) box.append(choice("Game", IDS.map(id => [id, id === "en" ? "Words" : lexOf(id).name]), prefs.lang, async v => { setPref("lang", v); await prepare(lexOf(v)); redraw(); }));
  box.append(choice("Mode", Object.entries(MODE_NAMES), prefs.mode, v => { setPref("mode", v); redraw(); }),
    choice(unit[0].toUpperCase() + unit.slice(1), lex.lengths.map(n => [n, String(n)]), prefs.len, v => { setPref("len", v); redraw(); }));
  if (prefs.mode === "boards") box.append(choice("Boards", [[2, "Two"], [4, "Four"], [8, "Eight"]], prefs.boards, v => { setPref("boards", v); redraw(); }));
  box.append(choice(lex.id === "en" ? "Words" : lex.name, LEVELS.map(l => [l, LEVEL_NAMES[l]]), prefs.level, v => { setPref("level", v); redraw(); }));
  if (lex.levelNote) box.append(line(lex.levelNote));
  if (lex.load && !loaded.has(lex.id)) { prepare(lex).then(redraw); box.append(line(`${lex.name} are on their way.`)); return; }
  const P = packOf(lex, prefs.len), g = guessesFor(prefs.len, prefs.mode === "boards" ? prefs.boards : 1), mean = meanGuesses(P, prefs.level);
  const say = prefs.mode === "dodge" ? `${levelOf(P, prefs.level).length} ${noun}s to dodge with; no limit, the fewest guesses best.`
    : prefs.mode === "sprint" ? `Three minutes, ${plural(guessesFor(prefs.len), "guess", "guesses")} a ${noun}.`
    : `${plural(g, "guess", "guesses")}${Number.isFinite(mean) ? `; a player like most needs about ${mean.toFixed(1)} on one board` : ""}.`;
  box.append(line(note ? `${note}: ${say}` : say));
}
function settingsPart(body, solo) {
  const settings = part(body, "settings");
  if (!(solo && track === "levels")) settings.append(choice("Rules", Object.entries(RULE_NAMES), prefs.rules, v => {
    setPref("rules", v);
    if (S && !S.duel && !S.guesses.length && S.boards === 1) { S.rules = v; save(); render(); }
    openMenu();
  }), line(prefs.mode === "boards" ? "Several boards always play free." : RULE_LINES[prefs.rules]));
  if (solo) settings.append(choice("Rival", [["off", "Off"], ...RIVALS.map(l => [l, RIVAL_NAMES[l]])], prefs.rival, v => {
    setPref("rival", v);
    if (S && !S.duel && !S.over && !S.guesses.length) { S.rival = v === "off" ? null : rivalPlan(S, v, lexOf(S.lang)); S.ms = 0; save(); render(); }
    openMenu();
  }), line(prefs.rival === "off" ? "The computer can play the same word beside you." : `${RIVAL_NAMES[prefs.rival]} plays the same word beside you, at a person's pace.${rivalRecord()}`));
  settings.append(toggle("High contrast", prefs.contrast, on => { setPref("contrast", on); applyContrast(); }));
}
const rivalRecord = () => { const r = read(RIVAL_KEY, {})[prefs.rival]; return r ? ` You ${r.w}, ${RIVAL_NAMES[prefs.rival]} ${r.l}${r.d ? `, ${plural(r.d, "draw")}` : ""}.` : ""; };
const dayResult = () => { const v = read(DAILY_KEY, {})[today()]; return v > 6 ? "it to the end without it" : plural(v, "guess", "guesses"); };
function aboutLine() {
  const st = read(STATS, {}).daily, s = read(STREAK, null), best = read(BEST, null);
  if (!st) return "Today's word not played yet.";
  return `Today's words: ${st.played} played, ${Math.round(100 * st.won / st.played)}% solved, streak ${s?.now || 0} (longest ${s?.best || 0})${best ? `, best ${best}/6` : ""}.`;
}

// ---------- messages ----------
let toastTimer = 0;
function toast(text, ms = 2200) {
  const t = $("toast");
  t.replaceChildren(...(text.endsWith("…") ? [waitMark()] : []), text);
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
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

// ---------- wiring ----------
document.querySelector(".as-mark").innerHTML = APPS.find(a => a.id === "assay")?.logo || "";
bindSwitcher($("appsBtn"), "assay");
applyContrast();
$("menuBtn").addEventListener("click", openMenu);
$("levelBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneDlg").addEventListener("click", e => { if (e.target === $("doneDlg")) $("doneDlg").close(); });
$("rival").addEventListener("click", () => { if (S?.rival) toast(`${RIVAL_NAMES[S.rival.level]} plays the same word: its marks show as it goes, its words at the end`, 3200); });
addEventListener("resize", () => { if (keyNodes) render(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) clockStop(); else { clockRun(); team.resync(); duel.resync(); } });
addEventListener("pageshow", e => { if (e.persisted) { team.resync(); duel.resync(); } });
addEventListener("pagehide", () => clockStop());
// the clock's tick: the rival's moves, the sprint's time, and a save every few seconds while one runs
let savedAt = 0, lastRival = "";
setInterval(() => {
  if (!S || T) return;
  if (S.mode === "sprint" && !S.over && elapsed() >= SPRINT_MS && (S.duel || clockFrom != null)) { timeUp(S); finish(); render(); return; }
  if (S.mode === "sprint" && !S.over) { drawStrip(); if (S.duel) tellSoon(); }
  if (S.rival && !S.over) { const sig = String(rivalSoFar(S.rival, elapsed()).length); if (sig !== lastRival) { lastRival = sig; drawStrip(); } }
  if (clockFrom != null && performance.now() - savedAt > 5000) { savedAt = performance.now(); clockStop(); clockRun(); }
}, 250);
let tellTimer = 0;
const tellSoon = () => { if (!tellTimer) tellTimer = setTimeout(() => { tellTimer = 0; if (S?.duel && !S.over) tell(); }, 5000); };

/** The game of the way now chosen, as it was left (else a new one); a level cleared goes on to the next that is open. */
async function resume() {
  T = null; built = null;
  S = savedGame();
  if (S) await prepare(lexOf(S.lang));
  if (track === "levels") {
    if (S?.over && !IN_FRAME && S.stars >= 1 && camp.at + 1 < LV.COUNT && isOpen(camp.at + 1)) { camp.at++; write(CAMP, camp); S = savedGame(); }
    if (!S || (S.over && !IN_FRAME)) { await startLevel(camp.at, !!S); return; }     // a word that was played (and told, if lost) is not dealt again
  } else if (!S || (S.over && !IN_FRAME)) { await start(dueToday() ? "daily" : "random"); return; }
  fresh = !S.guesses.length;
  render();
  clockRun();
}
async function solo() {
  prepare(lexOf(prefs.lang));                                // what the menu has chosen is on its way before it is asked for
  if (forToday && !IN_FRAME) {                                // the games screen's tile opens today's word, on the free way
    const run = read(RUN, null);
    if (track !== "free") { track = "free"; write(TRACK, track); }
    if (!(valid(run) && run.kind === "daily" && run.day === today() && !run.duel)) {
      S = valid(run) && !run.duel ? run : null;
      if (!started() || confirm("Today's word is waiting. Leave the one you've started?")) { T = null; built = null; await start("daily"); return; }
    }
  }
  await resume();
}
const forToday = arrivedForToday();
const code = roomInAddress();
if (code && !IN_FRAME) joinRoom(code); else solo();

// for tests and debugging
window.__assay = { get state() { return S; }, get table() { return T; }, get camp() { return camp; }, get track() { return track; }, typeKey, start, startLevel, playLevel, setTrack, duel, team, switchTo, get prefs() { return prefs; }, setPref, showDone };
