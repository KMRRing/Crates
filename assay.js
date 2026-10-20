// Assay: Wordle's genre (README, Assay). Guess the hidden word; each letter of a guess is marked in place, elsewhere
// in the word, or out. One word, several boards at once, a word that dodges, or a three-minute sprint, at four
// lengths and three levels, with Wordle's hard rule or a strict one, and a computer rival if you like. The rules,
// the words, the levels and the daily are assay-engine.js's; the rivals assay-solve.js's; the team's table
// assay-table.js's. Together: the pair as a team, each seeing one colour of the marks (together.js), or everyone
// racing the same word (duel.js), from the partner sheet or a Party.
import { LENGTHS, LEVELS, BOARDS, DAILY, HIT, NEAR, GREY, UNSEEN, SPRINT_MS, newGame, guessIn, rowsOf, solvedAt, limitOf, guessesFor, answersOf,
  lettersOf, scoreOf, sprintSolved, guessesUsed, timeUp, dailyWord, marksOf, seenAs, hide, unhide, packOf, levelOf, meanGuesses, dodgeCands } from "./assay-engine.js";
import { RIVALS, RIVAL_NAMES, rivalPlan, rivalSoFar, rivalMarks } from "./assay-solve.js";
import { freshTeam, isTeam, tidy, guessAt, rowsOfTable, roleAt, resultOf as teamResult, dealAt, limitOfTable } from "./assay-table.js";
import { ENGLISH } from "./assay-words.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { today, arrivedForToday, IN_FRAME, soloHref } from "./suite.js";
import { createDuel } from "./duel.js";
import { isDuel } from "./duel-core.js";
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords, openBranch, branchPath } from "./rooms.js";
import { getSync } from "./net.js";
import { busy, sextant } from "./loading.js";
import { sideways } from "./wide.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const LEX = ENGLISH;
const RUN = "assay:run", PREFS = "assay:prefs", STATS = "assay:stats", DAILY_KEY = "assay:daily", BEST = "assay:best", STREAK = "assay:streak",
  RIVAL_KEY = "assay:rivals", SEEN = "assay:seen", NOTES = "assay:notes";
const APP = 1;                 // the tables' version (the team's and the race's)
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const big = w => w.toUpperCase();
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const NUMBER = { 2: "Two", 4: "Four", 8: "Eight" };
const MODE_NAMES = { classic: "One word", boards: "Boards", dodge: "Dodge", sprint: "Sprint" };
const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };
const RULE_NAMES = { free: "Free", hard: "Hard", strict: "Strict" };
const RULE_LINES = { free: "Any word may be guessed.", hard: "Hard: a letter found stays in place, and every letter shown is used.", strict: "Strict: every guess could be the word." };

// ---------- what you've chosen ----------
const DEFAULTS = { mode: "classic", len: 5, boards: 4, level: "medium", rules: "free", rival: "off", contrast: false };
function cleanPrefs(p) {
  const x = { ...DEFAULTS, ...(p && typeof p === "object" ? p : {}) };
  if (!MODE_NAMES[x.mode]) x.mode = DEFAULTS.mode;
  if (!LENGTHS.includes(x.len)) x.len = DEFAULTS.len;
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

// ---------- the game on the screen ----------
// S: a game of yours (assay-engine.js's, with kind "daily" or "random", the draft being typed, the rival's plan), or
// the race's (S.duel, kept by duel.js apart from yours); T: the team's table as last seen. Everything the screen shows
// is in S (kept in assay:run as it changes), so a partner watching sees it as it stands.
let S = null, T = null;
let joining = null;                       // the rete while this phone sits down at the table in its address
let lobbyMatch = null;                    // a race dealt, not yet started here
const valid = s => !!s && s.v === 1 && Array.isArray(s.secret) && Array.isArray(s.guesses) && LENGTHS.includes(s.len) && Number.isFinite(s.ms);
function save() {
  if (IN_FRAME || !S) return;
  if (S.duel) duel.keep(S); else write(RUN, S);
}
const started = () => !!S && !S.duel && !S.over && (S.guesses.length > 0 || (S.past || []).length > 0);
const dueToday = () => read(DAILY_KEY, {})[today()] == null;

/** Starts a game of yours: today's, or a random one as the menu has it. */
function start(kind) {
  const day = today();
  const g = kind === "daily"
    ? newGame({ lex: LEX, ...DAILY, rules: prefs.rules, words: [dailyWord(day, LEX)], day, seed: day })
    : newGame({ lex: LEX, mode: prefs.mode, len: prefs.len, boards: prefs.boards, level: prefs.level, rules: prefs.rules, seed: randomSeed(), avoid: read(SEEN, []) });
  S = { ...g, kind, draft: "", rival: prefs.rival !== "off" ? rivalPlan(g, prefs.rival, LEX) : null };
  if (kind !== "daily" && g.mode !== "dodge") write(SEEN, [...answersOf(g).slice(0, 8), ...read(SEEN, [])].slice(0, 400));   // a sprint's first few
  fresh = true; reveal = null; shownDone = null;
  clockFrom = null;
  save();
  render();
  clockRun();
}
function confirmStart(kind) {
  if (started() && !confirm(kind === "daily" ? "Leave this word for today's?" : "Start a new word? This one isn't finished.")) return;
  start(kind);
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
  render();
}
function enter() {
  const w = S.draft;
  if (w.length < S.len) { refuse("Not enough letters"); return; }
  const before = S.mode === "sprint" ? S.at : null, r = guessIn(S, w, LEX);
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
  else if (LEX.letter(e.key)) typeKey(LEX.letter(e.key));
  else return;
  e.preventDefault();
});

// ---------- the end of a game ----------
function finish() {
  clockStop();
  if (S.duel) { tell(true); save(); }
  else record();
  save();
  setTimeout(() => { if (S?.over) showDone(); }, revealMs() + 350);
}
const revealMs = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : (S?.len || 5) * 110 + 250);
const modeKey = s => (s.kind === "daily" ? "daily" : `${s.mode}-${s.len}${s.mode === "boards" ? `x${s.boards}` : ""}-${s.level}`);
/** Counts a game of yours the moment it's over: its stats, today's (the daily), and the rival's record. */
function record() {
  if (IN_FRAME || S.counted) return;
  S.counted = true;
  const won = S.over === "won" || (S.mode === "sprint" && sprintSolved(S) > 0), used = S.mode === "sprint" ? sprintSolved(S) : S.guesses.length;
  const stats = read(STATS, {}), st = stats[modeKey(S)] || { played: 0, won: 0, dist: {}, now: 0, best: 0 };
  st.played++;
  if (won) { st.won++; st.now++; st.best = Math.max(st.best, st.now); st.dist[used] = (st.dist[used] || 0) + 1; } else st.now = 0;
  if (S.mode === "sprint" || S.mode === "dodge") st.top = st.top == null ? used : S.mode === "sprint" ? Math.max(st.top, used) : (won ? Math.min(st.top, used) : st.top);
  stats[modeKey(S)] = st;
  write(STATS, stats);
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
function drawBoards() {
  const v = boardsView(), [bc, br] = arrange(v.boards.length, v.len, v.fit);
  if (!built || built.key !== `${v.key}:${bc}x${br}`) buildBoards(v);
  const lastKey = S && !T ? rowKey() : T ? `t:${T.n}:${T.guesses.length - 1}` : null;
  const turning = reveal && reveal.key === lastKey && performance.now() - reveal.at < revealMs() + 100;
  v.boards.forEach((b, bi) => {
    const { board, rows } = built.boards[bi];
    board.classList.toggle("solved", b.solved);
    rows.forEach((row, ri) => {
      const done = b.rows[ri], typing = !done && !b.solved && ri === b.rows.length ? v.draft : "";
      row.classList.toggle("now", !done && !b.solved && ri === b.rows.length && (!S || !S.over));
      row.classList.toggle("shake", shake && !done && ri === b.rows.length);
      row.classList.toggle("turn", !!(turning && done && ri === b.rows.length - 1));
      row.classList.toggle("win", !!(done && b.solved && ri === b.rows.length - 1 && !turning));
      if (v.team) {
        const by = row.querySelector(".as-by"), who = done ? done.by : typing ? v.draftBy : null;
        by.hidden = who == null;
        if (who != null) { by.textContent = initialOf(who); by.style.setProperty("--who", `var(--p${who % 6})`); }
      }
      [...row.querySelectorAll(".as-tile")].forEach((tile, i) => {
        const letter = done ? done.guess[i] : typing[i] || "";
        tile.textContent = letter;
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
let keyNodes = null;
function buildKeys() {
  const rows = LEX.rows.map((letters, r) => (r === LEX.rows.length - 1 ? ["ENTER", ...letters, "BACK"] : r === 1 ? ["", ...letters, ""] : [...letters]));
  keyNodes = new Map();
  $("keys").replaceChildren(...rows.map(keys => {
    const row = el("div", "as-krow");
    for (const k of keys) {
      if (!k) { row.append(el("span", "as-half")); continue; }
      const b = el("button", `as-key${k.length > 1 ? " wide" : ""}`);
      b.type = "button";
      if (k === "ENTER") { b.textContent = "Enter"; b.classList.add("enter"); }
      else if (k === "BACK") { b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>'; b.setAttribute("aria-label", "Delete"); }
      else { b.append(el("span", "as-segs"), el("span", "as-l", k)); b.dataset.key = k; }
      // a key answers as the finger goes down (no wait for the click), and only once
      b.addEventListener("pointerdown", e => { e.preventDefault(); if (e.button > 0) return; b.classList.add("down"); keyTap(k); });
      b.addEventListener("pointerup", () => b.classList.remove("down"));
      b.addEventListener("pointerleave", () => b.classList.remove("down"));
      b.addEventListener("click", e => { if (e.detail === 0) keyTap(k); });   // a keyboard's Enter or Space on a focused key
      row.append(b);
      if (k.length === 1) keyNodes.set(k, b);
    }
    return row;
  }));
}
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
  const what = $("what"), count = $("count"), rival = $("rival");
  rival.hidden = true;
  if (T) {
    what.replaceChildren(el("b", "", "Together"), ` · ${T.len} letters · ${LEVEL_NAMES[T.level] || ""}`);
    count.textContent = T.over ? (T.over === "won" ? `Solved in ${T.guesses.length}` : "Not solved") : `Guess ${T.guesses.length + 1} of ${limitOfTable(T)}`;
    drawNotesButton();
    return;
  }
  $("notesBtn")?.remove();
  if (!S) { what.replaceChildren(el("b", "", "The race"), lobbyMatch ? ` · ${describeMatch(lobbyMatch)}` : ""); count.textContent = ""; return; }
  // what's being played, shortest first: one word needs no name, several boards their count
  const kind = S.duel ? "Race" : S.kind === "daily" ? "Today's" : S.mode === "boards" ? `${NUMBER[S.boards]} boards` : S.mode === "classic" ? null : MODE_NAMES[S.mode];
  const bits = [S.duel && S.mode === "boards" ? `${NUMBER[S.boards]} boards` : null, `${S.len} letters`, S.kind === "daily" ? null : LEVEL_NAMES[S.level], S.rules !== "free" ? RULE_NAMES[S.rules] : null].filter(Boolean);
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
  if (joining) { box.append(sextant(), joiningWords()); return; }
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
  if (fresh && !S.guesses.length) box.textContent = S.mode === "dodge" ? "No word is chosen: it dodges every guess it can" : S.mode === "sprint" ? "As many words as you can in three minutes" : `Guess the ${S.len}-letter word${S.mode === "boards" ? "s" : ""}`;
}
const linkButton = (text, fn) => { const b = el("button", "link", text); b.type = "button"; b.addEventListener("click", fn); return b; };

function render() {
  if (!keyNodes) buildKeys();
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
  const words = S.mode === "sprint" ? answersOf(S).slice(0, S.past.length) : answersOf(S);
  const list = el("div", "as-words");
  words.forEach((w, b) => {
    const solved = S.mode === "sprint" ? S.past[b]?.won : solvedAt(S, b) >= 0;
    const row = el("div", `as-word${solved ? "" : " missed"}`);
    for (const ch of w) row.append(el("span", `as-tile ${solved ? "h" : "g"}`, ch));
    list.append(row);
  });
  body.append(list);
  if (words.length === 1 || (S.mode === "boards" && S.boards <= 2)) defineInto(body, words);
  if (S.rival) {
    const p = S.rival, name = RIVAL_NAMES[p.level], theirs = S.mode === "sprint" ? `${plural(p.solved, "word")}` : p.won ? `in ${p.rows.length}` : "not at all";
    body.append(el("p", `as-vs ${S.beat || ""}`, `${S.beat === "won" ? "You beat" : S.beat === "lost" ? "Beaten by" : "Level with"} ${name}, who solved it ${theirs}${S.mode === "sprint" ? " in three minutes" : ""}.`));
    if (S.mode !== "sprint" && S.mode !== "boards") body.append(el("p", "as-their", p.rows.map(r => big(r.guess)).join(" · ")));
  }
  const key = modeKey(S), st = read(STATS, {})[key];
  if (st) body.append(statsBlock(st, S));
  const buttons = el("div", "as-buttons");
  if (S.kind === "daily" || dueToday()) {
    if (dueToday()) buttons.append(action("Today's word", () => start("daily"), "primary"));
    buttons.append(action(S.kind === "daily" ? "A random word" : "New word", () => start("random"), dueToday() ? "" : "primary"));
  } else buttons.append(action("New word", () => start("random"), "primary"));
  if (S.mode !== "sprint") buttons.append(action("Copy the grid", copyGrid, ""));
  body.append(buttons);
  for (const b of body.querySelectorAll(".btn, .link")) b.addEventListener("click", () => $("doneDlg").close());
  $("doneDlg").classList.toggle("as-contrast", prefs.contrast);
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
async function copyGrid() {
  const sq = { [HIT]: "🟩", [NEAR]: "🟨", [GREY]: "⬜" }, n = S.mode === "boards" ? S.boards : 1;
  const head = `Assay ${S.kind === "daily" ? S.day : `${S.len} letters`} ${S.over === "won" ? S.guesses.length : "X"}/${Number.isFinite(limitOf(S)) ? limitOf(S) : "∞"}${S.rules !== "free" ? "*" : ""}`;
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
      nextChoices(part(body, "content"), "The next match");
    } else if (team.room) {
      together.append(action("Another word", () => teamNext(), "primary"), action("Race instead", () => switchTo("race"), ""));
      const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
      together.append(line(`At the table: ${all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all.join("")}`), action("Back to solo", backToSolo, "link"));
      const content = part(body, "content");
      content.append(choice("Letters", LENGTHS.map(n => [n, String(n)]), T?.len ?? prefs.len, v => { setPref("len", v); }),
        choice("Words", LEVELS.map(l => [l, LEVEL_NAMES[l]]), prefs.level, v => setPref("level", v)), line("For the next word."));
    } else { const wait = line(joiningWords()); wait.prepend(sextant()); together.append(wait, action("Back to solo", backToSolo, "link")); }
    settingsPart(body, false);
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= (S?.kind === "daily" && !S.over) || dueToday() ? "daily" : "random";
  part(body, "play").append(action(pick === "daily" ? "Today's word" : "New word", () => confirmStart(pick), "primary"));
  const content = part(body, "content");
  content.append(choice("Word", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") nextChoices(content, null);
  else content.append(line(`Today's word: five letters, Medium, six guesses, the same for everyone.${dueToday() ? "" : ` You took ${dayResult()}.`}`));
  settingsPart(body, true);
  part(body, "about").append(line(aboutLine()), line("Words from SCOWL (Kevin Atkinson); meanings from Open English WordNet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The choices for the next game: mode, length, boards, level. */
function nextChoices(box, note) {
  const redraw = () => { openMenu(); };
  box.append(choice("Mode", Object.entries(MODE_NAMES), prefs.mode, v => { setPref("mode", v); redraw(); }),
    choice("Letters", LENGTHS.map(n => [n, String(n)]), prefs.len, v => { setPref("len", v); redraw(); }));
  if (prefs.mode === "boards") box.append(choice("Boards", [[2, "Two"], [4, "Four"], [8, "Eight"]], prefs.boards, v => { setPref("boards", v); redraw(); }));
  box.append(choice("Words", LEVELS.map(l => [l, LEVEL_NAMES[l]]), prefs.level, v => { setPref("level", v); redraw(); }));
  const P = packOf(LEX, prefs.len), g = guessesFor(prefs.len, prefs.mode === "boards" ? prefs.boards : 1);
  const say = prefs.mode === "dodge" ? `${levelOf(P, prefs.level).length} words to dodge with; no limit, the fewest guesses best.`
    : prefs.mode === "sprint" ? `Three minutes, six guesses a word.` : `${plural(g, "guess", "guesses")}; a player like most needs about ${meanGuesses(P, prefs.level).toFixed(1)} on one board.`;
  box.append(line(note ? `${note}: ${say}` : say));
}
function settingsPart(body, solo) {
  const settings = part(body, "settings");
  settings.append(choice("Rules", Object.entries(RULE_NAMES), prefs.rules, v => {
    setPref("rules", v);
    if (S && !S.duel && !S.guesses.length && S.boards === 1) { S.rules = v; save(); render(); }
    openMenu();
  }), line(prefs.mode === "boards" ? "Several boards always play free." : RULE_LINES[prefs.rules]));
  if (solo) settings.append(choice("Rival", [["off", "Off"], ...RIVALS.map(l => [l, RIVAL_NAMES[l]])], prefs.rival, v => {
    setPref("rival", v);
    if (S && !S.duel && !S.over && !S.guesses.length) { S.rival = v === "off" ? null : rivalPlan(S, v, LEX); S.ms = 0; save(); render(); }
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
  t.replaceChildren(...(text.endsWith("…") ? [sextant()] : []), text);
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
$("menuClose").addEventListener("click", () => $("menuDlg").close());
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

function solo() {
  S = read(RUN, null);
  if (!valid(S) || S.duel) S = null;
  T = null; built = null;
  if (forToday && !IN_FRAME && !(S?.kind === "daily" && S.day === today())) {
    if (!started() || confirm("Today's word is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  if (!S || (S.over && !IN_FRAME)) { start(dueToday() ? "daily" : "random"); return; }
  fresh = !S.guesses.length;
  render();
  clockRun();
}
const forToday = arrivedForToday();
const code = roomInAddress();
if (code && !IN_FRAME) joinRoom(code); else solo();

// for tests and debugging
window.__assay = { get state() { return S; }, get table() { return T; }, typeKey, start, duel, team, switchTo, get prefs() { return prefs; }, setPref, showDone };
