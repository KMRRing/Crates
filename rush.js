// Gambit's puzzle rush (Gambit, Menu, Puzzle rush): chess puzzles, as many as you can, with the settings every game's
// rush shares (rush-core.js, rush-menu.js): Random or Today's; 3 min with five seconds' grace a puzzle, 5 min, or
// Survival; three misses end the run. An easy warm-up starts the clock; the puzzles climb from below your rating, kept
// across runs. The bank is 20,000 Lichess puzzles in ten files by rating band (puzzles/), fetched as a run climbs into
// them and kept on the device; the board is chess-board.js. Together, a puzzle battle (duel.js). It's a page of its own
// under Gambit's header, not a part of gambit.html, so it keeps the identity it had as a game (rush): its keys (rush:),
// what your partner sees you playing, and the battle's requests and Party's.
import { mountPuzzle, solutionSan } from "./chess-board.js";
import * as pile from "./pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, toggle, line, onPause } from "./menu.js";
import { today, IN_FRAME } from "./suite.js";          // the day, the same for everyone (UTC); a partner watching's frame
import { createDuel } from "./duel.js";
import { busy } from "./loading.js";
import { MODES, STRIKES, modeOf, rng, clockText, spentOf, nextPuzzleAt, rated, targetOf, nearest, noteRun, endTitle } from "./rush-core.js";
import { rushMenu, ratingText } from "./rush-menu.js";

const $ = id => document.getElementById(id);
const BEST = "rush:best", DAILY = "rush:daily", RATING = "rush:rating", RUN = "rush:run", GAMBIT_OPTS = "gambit:opts";
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const n0 = n => Number(n).toLocaleString("en-GB");

// S: the run, { mode, daily, seed, duel, at, used (Set of ids), solved, strikes, misses: [{ id, rating, line }], ratings (of
// those solved), started (null until the warm-up is solved), warming, over, why, ratingAtStart, current, step, puzzleAt,
// free, spentAtEnd }
let S = null, board = null, tick = 0;
// the next run's kind and clock: the last run's, until the menu picks another; a battle's clock is its match's
const last = read(RUN, null);
let next = { kind: last?.daily ? "daily" : "random", mode: modeOf(last?.mode) }, pick = null, battleMode = "three";

// ---------- the bank, by rating band ----------
const bandOf = rating => Math.max(600, Math.min(2400, Math.floor(rating / 200) * 200));
const bands = new Map();   // band -> puzzles, once fetched
async function loadBand(b) {
  if (bands.has(b)) return bands.get(b);
  const res = await fetch(`./puzzles/band-${String(b).padStart(4, "0")}.txt`);
  if (!res.ok) throw new Error(`band ${b}`);
  const list = (await res.text()).trim().split("\n").map(line => {
    const [id, fen, moves, r, t] = line.split("|");
    return { id, fen, moves: moves.split(" "), rating: Number(r), themes: t ? t.split(",") : [] };
  });
  bands.set(b, list);
  return list;
}
const firstBands = () => Promise.all([loadBand(600), loadBand(800), loadBand(1000)]);
/** The first bands, fetched once (the rete while they come): false if they can't be. */
async function ready() {
  if (bands.has(1000)) return true;
  const done = busy("Loading the puzzles");
  try { await firstBands(); return true; }
  catch (e) {
    console.error(e);
    say(navigator.onLine === false ? "The puzzles need a connection the first time." : "The puzzles didn't load: try again.", "bad");
    return false;
  } finally { done(); }
}

// ---------- your rating: a running one across every run (rush-core.js's rated) ----------
const rating = read(RATING, { r: 1000, n: 0 });
function rate(p, solved, missesSoFar) { Object.assign(rating, rated(rating, p, solved, missesSoFar)); write(RATING, rating); }

/**
 * The run's next puzzle: the one nearest what the run aims at (rush-core.js's targetOf: your rating, today's climb, or a
 * battle's by the puzzle's number, the same at every phone) and not used yet, in its band; the next band up is fetched
 * ahead of need, and a band used up gives way to the next.
 */
async function pickPuzzle() {
  const r = rng(S.seed ^ (S.at * 7919)), target = targetOf(S, rating.r, r), b = bandOf(target), list = await loadBand(b);
  if (b < 2400) loadBand(b + 200).catch(() => {});
  const p = list.some(q => !S.used.has(q.id)) ? nearest(list, S.used, target, r) : (await loadBand(b < 2400 ? b + 200 : b - 200)).find(q => !S.used.has(q.id));
  S.used.add(p.id);
  return p;
}

/** A new run of the next kind, opening on an easy warm-up: the clock, the count and the rating start when it's solved.
 *  A run under way is ended first, its count kept as a best. */
async function start() {
  if (duel.on) return;
  if (S && !S.over && S.started != null) finish("time", true);
  clearInterval(tick);
  board?.destroy(); board = null;
  S = null;
  drawHud(); drawBar();
  if (!(await ready())) { drawBar(); return; }
  const daily = next.kind === "daily", mode = modeOf(next.mode);
  S = { mode, daily, seed: daily ? Number(today()) : Math.floor(Math.random() * 2 ** 31), at: 0, used: new Set(), solved: 0, strikes: 0, misses: [], ratings: [],
    started: null, warming: true, over: false, why: null, ratingAtStart: rating.r, current: null, step: 0, puzzleAt: null, free: 0 };
  tick = setInterval(clock, 250);
  drawHud(); drawBar();
  serve();
}
const spent = () => spentOf(S, performance.now());
function clock() {
  const c = $("clock"), ms = MODES[modeOf(S?.mode || (duel.on ? battleMode : next.mode))].ms;
  if (!ms) { c.textContent = ""; c.classList.remove("low"); return; }
  if (!S || S.started == null) { c.textContent = clockText(ms); c.classList.remove("low"); return; }   // not running yet
  const left = Math.max(0, ms - (S.over ? S.spentAtEnd ?? ms : spent()));
  c.textContent = clockText(left);
  c.classList.toggle("low", left < 20000 && !S.over);
  if (left <= 0 && !S.over) finish("time");
}
async function serve() {
  if (!S || S.over) return;
  const run = S;
  nextPuzzleAt(S, performance.now());
  const p = await pickPuzzle();
  if (S !== run || S.over) return;
  S.current = p;
  S.at++;
  mount(p);
}
/** The next puzzle on the board after `ms`, if the run is still this one. */
function serveIn(ms) { const run = S; setTimeout(() => { if (S === run && !S.over) serve(); }, ms); }
const sideOf = p => (p.fen.split(" ")[1] === "w" ? "Black" : "White");
/** A puzzle on the board: from its first move, or from a step part-way (a run picked up). */
function mount(p, step = 0) {
  say(S.warming ? `${sideOf(p)} to move. Solve this one to start the clock.` : `${sideOf(p)} to move`);
  $("meta").textContent = "";
  board?.destroy();
  board = mountPuzzle($("board"), p, { interactive: !IN_FRAME && !S.over, replyMs: 300, firstMs: 450, startStep: step, onStep: keepRun, onDone: solved => settle(p, solved) });
  keepRun(step);
}
const metaOf = p => `Rated ${n0(p.rating)}${p.themes.length ? ` · ${p.themes.join(", ")}` : ""}`;

// ---------- the run, kept ----------
// as it stands after every move: a partner watching sees the puzzle on the board, how far into it, the count, the strikes
// and the clock; and an untimed run (or one still on its warm-up) comes back after a reload. A timed run can't be paused,
// so leaving the page ends it (below).
function keepRun(step = S?.step || 0) {
  if (!S) return;
  S.step = step;
  if (S.duel) { keepDuel(); return; }
  const timed = S.started != null, g = MODES[S.mode].grace;
  write(RUN, { mode: S.mode, daily: S.daily, seed: S.seed, at: S.at, used: [...S.used], solved: S.solved, strikes: S.strikes, misses: S.misses,
    ratings: S.ratings, warming: S.warming, over: S.over, why: S.why || null, ratingAtStart: S.ratingAtStart, current: S.current || null, step,
    spent: timed ? (S.over ? S.spentAtEnd ?? null : Math.round(spent())) : null,
    grace: timed && g && S.puzzleAt != null && !S.over ? Math.round(Math.min(g, performance.now() - S.puzzleAt)) : null,   // of this puzzle's grace, used
    savedAt: Date.now() });
}
/** Picks a kept run up where it was: in a watching frame whatever your partner is playing, a moment late (their clock
 *  run on by the time since they moved), finished runs too; here, an untimed run, or one still on its warm-up. */
function resumeRun() {
  const r = read(RUN, null);
  if (!r || !MODES[r.mode] || !r.current || (r.over && !IN_FRAME)) return false;
  if (!IN_FRAME && MODES[r.mode].ms && !r.warming) return false;
  S = { ...r, used: new Set(r.used || []), over: false, started: null, puzzleAt: null, free: 0, spentAtEnd: null };
  if (r.spent != null) {                                     // the clock as it stood, the puzzle's grace with it
    const now = performance.now(), lag = IN_FRAME && !r.over ? Math.max(0, Date.now() - r.savedAt) : 0, used = r.grace ?? 0;
    if (r.grace != null) S.puzzleAt = now - used - lag;
    S.started = now - r.spent - lag - used;
  }
  next = { kind: S.daily ? "daily" : "random", mode: S.mode };
  clearInterval(tick);
  tick = setInterval(clock, 250);
  drawHud(); drawBar();
  mount(S.current, r.step || 0);
  if (r.over) finish(r.why || "time", !IN_FRAME);           // a frame: the run as it ended, its results open
  return true;
}
function settle(p, solved) {
  if (!S || S.over) return;
  const line = solutionSan(p).slice(1).join(" ");
  if (S.warming) {                                   // the warm-up: solving it starts the run; a miss shows the line and serves another
    if (solved) {
      S.warming = false;
      S.started = performance.now();
      S.puzzleAt = S.started; S.free = 0;
      say("Go.", "good");
      serveIn(350);
    } else {
      say(`Not that one: ${line}. Another warm-up.`, "bad");
      serveIn(1400);
    }
    drawHud();
    keepRun();
    return;
  }
  rate(p, solved, S.misses.length);
  if (solved) { if (pile.has("rush", p.id)) pile.answer("rush", p.id, true); }
  else pile.record("rush", p.id, { id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes }, "miss");
  if (solved) {
    S.solved++;
    S.ratings.push(p.rating);
    say("Solved", "good");
  } else {
    S.strikes++;
    S.misses.push({ id: p.id, rating: p.rating, line: solutionSan(p).join(" ") });
    say(`Not that one: ${line}`, "bad");
    navigator.vibrate?.(70);
  }
  $("meta").textContent = metaOf(p);
  drawHud();
  tell();
  keepRun();
  if (S.strikes >= STRIKES) { finish("strikes"); return; }
  serveIn(solved ? 350 : 1400);
}
/** The run's end: its best kept (not a battle's: the table has that), the board left as it stands, and the results (not
 *  when you left it yourself). */
function finish(why, quiet = false) {
  if (!S || S.over) return;
  S.over = true;
  S.why = why;
  if (S.started != null) S.spentAtEnd = Math.round(spent());
  keepRun();
  clearInterval(tick);
  clock();
  board?.stop();
  if (S.duel) {
    tell(true);
    say(endTitle(why));
    $("meta").textContent = "";
    drawBar();
    return;
  }
  const res = noteRun(read(BEST, {}), read(DAILY, {}), { kind: S.daily ? "daily" : "random", mode: S.mode, score: S.solved }, today());
  write(BEST, res.bests);
  if (S.daily) write(DAILY, res.daily);
  S.best = res.best;
  drawBar();
  if (!quiet) results();
}
/** The run's results: the count, accuracy, your rating and how it moved, your best; the hardest solved; each miss with
 *  its line and a link to it on Lichess. */
function results() {
  if (!S?.over) return;
  $("doneTitle").textContent = endTitle(S.why);
  const body = $("doneBody"), attempts = S.solved + S.misses.length, change = Math.round(rating.r - S.ratingAtStart);
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "ru-big", String(S.solved));
  const stats = add("div", "ru-stats");
  for (const [v, label] of [[`${attempts ? Math.round(S.solved / attempts * 100) : 0}%`, "accuracy"], [`${n0(Math.round(rating.r))} (${change >= 0 ? "+" : "−"}${Math.abs(change)})`, "rating"],
    [S.best ?? S.solved, S.daily ? "best today" : `best, ${MODES[S.mode].label}`]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  if (S.solved) add("p", "ru-note", `Hardest solved: ${n0(Math.max(...S.ratings))}. ${S.misses.length ? "The ones that got away:" : "Not a single miss."}`);
  else if (S.misses.length) add("p", "ru-note", "The ones that got away:");
  if (S.misses.length) body.appendChild(missedList(S.misses));
  if (!IN_FRAME) {
    const go = add("div", "ru-end-go");
    const button = (text, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = `gb-go ${cls}`.trim(); b.textContent = text; b.addEventListener("click", fn); go.append(b); };
    button("The game", () => { $("doneDlg").close(); backToGame(); }, "quiet");
    button("Again", () => { $("doneDlg").close(); start(); });
  }
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
/** The puzzles missed, each a link to it on Lichess with the line that was wanted. */
function missedList(misses) {
  const list = document.createElement("ul");
  list.className = "ru-missed";
  for (const m of misses) {
    const li = document.createElement("li"), a = document.createElement("a"), s = document.createElement("span");
    a.href = `https://lichess.org/training/${m.id}`; a.target = "_blank"; a.rel = "noopener"; a.textContent = `Puzzle ${m.id} (${n0(m.rating)})`;
    s.textContent = m.line;
    li.append(a, s);
    list.appendChild(li);
  }
  return list;
}

// ---------- the page ----------
function say(text, tone = "") { const l = $("line"); l.className = `ru-line${tone ? ` ${tone}` : ""}`; l.textContent = text; }
function drawHud() {
  $("solved").textContent = String(S ? S.solved : 0);
  $("rating").textContent = `${n0(Math.round(rating.r))}${rating.n < 20 ? "?" : ""}`;
  $("strikes").replaceChildren(...Array.from({ length: STRIKES }, (_, k) => { const i = document.createElement("i"); i.className = `ru-strike${S && k < S.strikes ? " hit" : ""}`; return i; }));
  $("strikes").setAttribute("aria-label", `${S ? S.strikes : 0} of ${STRIKES} missed`);
  clock();
}
/** The buttons under the board: back to the game, and a new run once there's none under way; at a battle, the table's. */
function drawBar() {
  const bar = $("bar");
  bar.replaceChildren();
  if (IN_FRAME) return;
  const button = (text, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = `gb-go ${cls}`.trim(); b.textContent = text; b.addEventListener("click", fn); bar.append(b); };
  if (duel.on) {
    if (!S) button("Ready", () => duel.open());
    else if (S.over) button("The result", () => duel.open());
    return;
  }
  button("The game", backToGame, "quiet");
  if (!S || S.over) button(S ? "Again" : "Start", () => start());
}
/** Back to Gambit's game: a timed run under way ends (you're asked first); one without a clock waits for next time. */
function backToGame() {
  if (S && !S.over && S.started != null && MODES[S.mode].ms) {
    if (!confirm("End this run and go back to the game?")) return;
    finish("time", true);
  }
  location.href = "gambit.html";
}
// Gambit's Coordinates on the board: one setting for its game and its rush
const coordsOn = () => read(GAMBIT_OPTS, {})?.coords !== false;
const applyCoords = () => $("board").classList.toggle("ch-plain", !coordsOn());
const coordsToggle = () => toggle("Coordinates on the board", coordsOn(), on => { write(GAMBIT_OPTS, { ...read(GAMBIT_OPTS, {}), coords: on }); applyCoords(); });

// ---------- a puzzle battle: the same puzzles for everyone at the table (duel.js) ----------
// Everyone plays the match's clock on the same puzzles in the same order (pickPuzzle), with no warm-up: the countdown
// is the start, and the clock runs from the start the table shares, through the menu and a phone put down alike.
// Most solved wins, then fewer misses; then, in survival, the quicker (on the clock, the same score is a draw). It
// counts for your rating and the pile, as any puzzle does, but not for your bests or today's, and your solo run waits
// where it was.
const duel = createDuel({
  game: "rush", name: "Puzzle rush", accent: "--gb-in", line: $("rival"), toast,
  deal: () => ({ seed: Math.floor(Math.random() * 2 ** 31), mode: modeOf(battleMode) }),
  describe: m => `${MODES[modeOf(m.mode)].label}: the same puzzles, easy to hard`,
  compare: (a, b) => (b.score - a.score) || ((a.strikes || 0) - (b.strikes || 0))
    || (duel.match?.mode === "survival" ? (a.ms ?? Infinity) - (b.ms ?? Infinity) || 0 : 0),
  play: playDuel,
  onLobby: lobby,
  extra: () => (S?.duel && S.misses.length ? missedList(S.misses) : null), extraTitle: "The ones that got away",
  onLeave: () => { S = null; clearInterval(tick); board?.destroy(); board = null; showRating(true); solo(); },
});
const showRating = on => { $("ratingLine").hidden = !on; };
/** The board before a match: empty, the match's clock full, the first puzzles fetched so they're here for the start. */
function lobby(match) {
  clearInterval(tick);
  S = null;
  board?.destroy(); board = null;
  $("board").replaceChildren();
  battleMode = modeOf(match.mode);
  showRating(false);
  drawHud();
  say("Puzzle battle: the same puzzles for everyone");
  $("meta").textContent = "";
  drawBar();
  firstBands().catch(() => {});
}
/** This device's run of the match: from the start the table gave it, or picked up where it was (a reload, or a seat
 *  taken over on another device, where the puzzles before the one it was on are dealt again, unplayed). */
async function playDuel(match, { begun, kept, done, run }) {
  const mode = battleMode = modeOf(match.mode);
  showRating(false);
  clearInterval(tick);
  const k = kept?.seed === match.seed ? kept : null;
  const me = S = { duel: true, mode, seed: match.seed, daily: false, at: 0, used: new Set(), solved: 0, strikes: 0, misses: [], ratings: [],
    warming: false, over: false, ratingAtStart: rating.r, free: 0, puzzleAt: null, current: null, step: 0 };
  S.started = performance.now() - Math.max(0, duel.now() - begun);
  drawBar();
  try { await firstBands(); }
  catch { say("The puzzles need a connection the first time.", "bad"); return; }
  if (S !== me) return;
  if (k) {
    Object.assign(S, { at: k.at, used: new Set(k.used || []), solved: k.solved, strikes: k.strikes, misses: k.misses || [], ratings: k.ratings || [],
      current: k.current || null, step: k.step || 0, free: k.free || 0, ratingAtStart: k.ratingAtStart ?? rating.r });
    if (k.puzzleAt != null) S.puzzleAt = performance.now() - Math.max(0, duel.now() - k.puzzleAt);
  } else if (run?.at > 1) {
    while (S.at < run.at - 1) { await pickPuzzle(); S.at++; }
    if (S !== me) return;
    S.solved = Number(run.score) || 0;
    S.strikes = Number(run.strikes) || 0;
  }
  tick = setInterval(clock, 250);
  drawHud();
  tell();
  if (done || k?.over) { finish(k?.why || "time"); return; }
  if (S.strikes >= STRIKES) { finish("strikes"); return; }
  if (MODES[mode].ms && spent() >= MODES[mode].ms) { finish("time"); return; }
  if (S.current) mount(S.current, S.step); else serve();
}
/** What the table sees of this run as it goes, and at the end. */
function tell(done = false) {
  if (!S?.duel) return;
  duel.report({ score: S.solved, strikes: S.strikes, at: S.at, text: `${S.solved} solved${S.strikes ? `, ${"✗".repeat(S.strikes)}` : ""}`, ...(done ? { done: true } : {}) });
}
/** A battle's run, kept on this device as it goes (duel.js): the clock's marks as server time, so a reload agrees. */
function keepDuel() {
  const g = MODES[S.mode].grace;
  duel.keep({ mode: S.mode, seed: S.seed, at: S.at, used: [...S.used], solved: S.solved, strikes: S.strikes, misses: S.misses, ratings: S.ratings,
    over: S.over, why: S.why || null, ratingAtStart: S.ratingAtStart, current: S.current || null, step: S.step || 0, free: Math.round(S.free || 0),
    puzzleAt: g && S.puzzleAt != null ? Math.round(duel.now() - (performance.now() - S.puzzleAt)) : null });
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
/** The menu: the rush's, as every game's rush has it (rush-menu.js), with Gambit's Coordinates; at a battle, the table's
 *  own (a new match, the match, Back to solo) and its clock, which starts a new match in it for everyone. */
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    duel.menu(part(body, "together"));
    part(body, "content").append(choice("Mode", Object.entries(MODES).map(([id, m]) => [id, m.label]), battleMode, v => {
      $("menuDlg").close();
      const was = battleMode;
      battleMode = v;
      if (!duel.newMatch()) battleMode = was;
    }));
    part(body, "settings").append(coordsToggle());
    part(body, "about").append(line(ratingText(rating)));
  } else {
    pick ??= { ...next };
    rushMenu(body, {
      pick, start: () => { next = { ...pick }; pick = null; start(); }, results: S?.over ? results : null, back: backToGame,
      rating, resetRating: () => { rating.r = 1000; rating.n = 0; write(RATING, rating); drawHud(); },
      bests: read(BEST, {}), daily: read(DAILY, {}), day: today(), inFrame: IN_FRAME,
    });
    part(body, "settings").append(coordsToggle());
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "gambit");
document.querySelector(".gb-mark").innerHTML = APPS.find(a => a.id === "gambit")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
// the menu stops a run's clock: its start moves on by however long the menu was open
let held = false;
onPause(() => { if (S && !S.over && S.started != null && !S.duel) { clearInterval(tick); held = true; } },
  ms => { if (!held) return; held = false; if (S && !S.over && S.started != null) { S.started += ms; if (S.puzzleAt != null) S.puzzleAt += ms; tick = setInterval(clock, 250); clock(); } });
// a timed run can't be paused; a battle's clock runs on while the phone is put down, and the table is fetched afresh
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !IN_FRAME && S && !S.over && S.started != null && MODES[S.mode].ms && !S.duel) finish("time");
  if (!document.hidden) { duel.resync(); if (S?.duel && !S.over) clock(); }
});
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });

// for tests and the look
window.__rush = { get state() { return S; }, start, finish, results, get puzzle() { return S?.current; }, settle: solved => S?.current && settle(S.current, solved), duel };

applyCoords();
drawHud(); drawBar();
const solo = () => { if (!resumeRun() && !IN_FRAME) start(); };
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });     // a battle in the address: no solo run under it
else solo();
