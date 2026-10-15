// River's puzzle rush on the page (Menu, Puzzle rush): Xiangqi tactics, as many as you can, with the settings every
// game's rush shares (rush-core.js, rush-menu.js): Random, Today's (the same for everyone) or River's own Patterns; 3 min
// with five seconds' grace a puzzle, 5 min, or Survival; three misses end the run. As Gambit's chess puzzles do, it opens
// on an easy warm-up that starts the clock and counts for nothing, and the puzzles climb from below your rating as you
// solve them, against a running rating kept across runs. The bank is river-puzzles.txt, loaded with the first run; the
// board is river-board.js's, every move judged against the puzzle's line, any move that mates where the line mates
// (river-rush.js has the rules of it, without a page). The run is kept after every move (river:rush), so a partner
// watching sees it and a run without a clock comes back after a reload.
import * as X from "./river-rules.js";
import { mountBoard } from "./river-board.js";
import { MODES, STRIKES, rng, parsePuzzle, puzzleLine, themeWords, patternWords, patternSay, lineOf, solverOf, answers, targetOf, nearest, rated } from "./river-rush.js";
import { modeOf, clockText, spentOf, nextPuzzleAt, noteRun, endTitle } from "./rush-core.js";
import { rushMenu } from "./rush-menu.js";
import { onPause } from "./menu.js";
import { today, IN_FRAME } from "./suite.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "river:rush", BEST = "river:rushBest", DAILY = "river:rushDaily", RATING = "river:rushRating";
const FIRST_MS = 450, REPLY_MS = 300, REVEAL_MS = 1000;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let bank = null;
/** The puzzles, easiest first, fetched once (the service worker keeps the file, so it loads offline too). */
async function loadBank() {
  if (bank) return bank;
  const res = await fetch("./river-puzzles.txt");
  if (!res.ok) throw new Error(`the puzzles: ${res.status}`);
  bank = (await res.text()).trim().split("\n").map(parsePuzzle);
  return bank;
}
/** The point of a general in check in a position, or −1. */
function checkPoint(pos) {
  if (X.inCheck(pos)) for (let q = 0; q < 90; q++) if (pos.b[q] === (pos.red ? X.GENERAL : -X.GENERAL)) return q;
  return -1;
}

// ---------- a puzzle on the board ----------
/**
 * A puzzle on the board in `host`: the position from the solver's side, the other side's mistake played after a beat,
 * then your moves, each checked against the line. A move made while the reply is coming is a premove (its points ringed
 * in violet; the same move again takes it back), played the instant the reply lands if it's legal then. A wrong move is
 * drawn as an oxblood arrow, the line's move joining it in green. opts: { interactive, startStep (the moves already
 * made: a run picked up part-way), reveal (the whole line played out, a move a second: a miss looked at again),
 * onStep(step) after every move, onDone(solved), script() }. Returns { stop (no more moves), destroy (its timers too),
 * redraw, move(uci) (as a hand would make it: the tests), step }.
 */
export function playPuzzle(host, p, opts) {
  const red = solverOf(p) === "Red";
  let pos = X.parseFen(p.fen), step = 0, last = null, arrows = [], pre = null, done = !opts.interactive, slide = false;
  const timers = [], later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const board = mountBoard(host, { onMove, legal });
  const yours = () => pos.red === red;
  function legal(from) {
    if (done || step >= p.moves.length) return [];
    const as = yours() ? pos : { b: pos.b, red };               // the reply still to come: your moves as if it were your turn
    return X.legalMoves(as).filter(m => m.from === from).map(m => m.to);
  }
  function onMove(from, to) {
    if (done) return;
    if (!yours()) { pre = pre?.from === from && pre.to === to ? null : { from, to }; draw(); return; }
    attempt(from, to);
  }
  function attempt(from, to) {
    pre = null;
    if (!answers(p, pos, step, X.uciOf(from, to))) {
      arrows = [{ from, to, bad: true }];
      finish(false);
      later(() => { arrows = [X.parseUci(p.moves[step]), { from, to, bad: true }]; draw(); }, 500);
      return;
    }
    play(X.uciOf(from, to));
    if (step >= p.moves.length) { finish(true); return; }
    later(reply, REPLY_MS);
  }
  function play(uci) {
    const m = X.parseUci(uci);
    pos = X.after(pos, m.from, m.to);
    last = m; step++; slide = true;
    opts.onStep?.(step);
    draw();
  }
  function reply() {
    if (step >= p.moves.length || (done && opts.interactive)) return;
    play(p.moves[step]);
    if (!opts.interactive) return;
    if (pre) { const q = pre; pre = null; if (X.isLegal(pos, q.from, q.to)) attempt(q.from, q.to); else draw(); }
  }
  function finish(solved) { if (done) return; done = true; draw(); opts.onDone?.(solved); }
  function draw() {
    board.draw({ pos, bottomRed: red, facing: false, script: opts.script(), last, arrows, hand: !done, check: checkPoint(pos), slide, pre: done ? null : pre });
    slide = false;
  }
  draw();
  if (opts.reveal) p.moves.forEach((u, i) => later(() => play(u), FIRST_MS + i * REVEAL_MS));
  else {
    // picked up part-way: the moves made so far at once, and the other side's next one as it would have come
    const n = Math.min(opts.startStep || 0, p.moves.length - 1);
    for (const u of p.moves.slice(0, n)) { const m = X.parseUci(u); pos = X.after(pos, m.from, m.to); last = m; step++; }
    if (n) draw();
    if (step % 2 === 0) later(reply, n ? REPLY_MS : FIRST_MS);   // the other side's moves are the even ones
  }
  return {
    stop() { done = true; pre = null; draw(); },
    destroy() { timers.forEach(clearTimeout); done = true; },
    redraw: draw,
    move(uci) { const m = X.parseUci(uci); if (m && legal(m.from).includes(m.to)) onMove(m.from, m.to); },   // as a hand would (the tests)
    get step() { return step; },
  };
}

// ---------- the run ----------
/**
 * The rush on River's page: its board, its line, its count, clock and strikes take the game's places while it's open
 * (#app.rushing). onOpen and onClose tell the page; script() is the characters the menu has set.
 */
export function createRush({ onOpen = () => {}, onClose = () => {}, script = () => "traditional" }) {
  const app = $("app"), host = $("rushBoard");
  // S: the run, as rush.js keeps it: { mode, daily, seed, at, used (ids), solved, strikes, misses, ratings (of those
  // solved), started (null until the warm-up is solved), warming, over, why, ratingAtStart, current, step, puzzleAt, free }
  let S = null, puzzle = null, tick = 0, on = false, pick = null;
  // the next run's kind and clock: the last run's, until the menu picks another (a run of patterns has no clock)
  const last = read(RUN, null);
  const kindOf = r => (r?.patterns ? "patterns" : r?.daily ? "daily" : "random");
  let next = { kind: kindOf(last), mode: last?.patterns ? "three" : modeOf(last?.mode) };

  // your rating: Elo-style against each puzzle's, fast for your first twenty puzzles, then slowly, and a solve's gain
  // halving with each miss in the run, so a careless run can't climb
  const rating = read(RATING, { r: 1000, n: 0 });
  function rate(p, solved, missesSoFar) { Object.assign(rating, rated(rating, p, solved, missesSoFar)); write(RATING, rating); }

  /** The run's next puzzle (river-rush.js chooses it as rush.js does; a run of patterns among the named ones), its
   *  delay's clock started. */
  function nextPuzzle() {
    nextPuzzleAt(S, performance.now());
    const pool = S.patterns ? bank.filter(q => q.patterns.length) : bank;
    const r = rng(S.seed ^ (S.at * 7919)), p = nearest(pool, S.used, targetOf(S, rating.r, r), r);
    S.used.add(p.id);
    return p;
  }

  async function ready() {
    if (bank) return true;
    const done = busy("Loading the puzzles");
    try { await loadBank(); return true; }
    catch (e) {
      console.error(e);
      say(navigator.onLine === false ? "The puzzles need a connection the first time." : "The puzzles didn't load: try again.", "bad");
      return false;
    } finally { done(); }
  }
  /** A new run of the next kind, opening on an easy warm-up; the clock, the count and the rating start when it's solved.
   *  A run under way is ended first, its count kept as a best. */
  async function start() {
    if (S && !S.over && S.started != null) finish("time", true);
    clearInterval(tick);
    puzzle?.destroy(); puzzle = null;
    S = null;
    drawHud(); drawBar();
    if (!(await ready())) { drawBar(); return; }
    const daily = next.kind === "daily", patterns = next.kind === "patterns", mode = patterns ? "survival" : modeOf(next.mode);
    S = { mode, daily, patterns, seed: daily ? Number(today()) : Math.floor(Math.random() * 2 ** 31), at: 0, used: new Set(), solved: 0, strikes: 0, misses: [], ratings: [],
      started: null, warming: true, over: false, why: null, ratingAtStart: rating.r, current: null, step: 0, puzzleAt: null, free: 0 };
    tick = setInterval(clock, 250);
    drawHud(); drawBar();
    serve();
  }
  /** The next puzzle on the board, after `ms`, if the run is still this one. */
  function serveIn(ms) { const run = S; setTimeout(() => { if (S === run && !S.over) serve(); }, ms); }
  async function serve() {
    if (!S || S.over) return;
    const run = S;
    if (!(await ready()) || S !== run) return;
    S.current = nextPuzzle();
    S.at++;
    mount(S.current);
  }
  /** A puzzle on the board: from its first move, or from a step part-way (a run picked up). */
  function mount(p, step = 0) {
    say(S.warming ? `${solverOf(p)} to move. Solve this one to start the clock.` : `${solverOf(p)} to move`);
    $("rushMeta").textContent = "";
    puzzle?.destroy();
    puzzle = playPuzzle(host, p, { interactive: !IN_FRAME && !S.over, startStep: step, script, onStep: keepRun, onDone: solved => settle(p, solved) });
    keepRun(step);
  }
  function settle(p, solved) {
    if (!S || S.over) return;
    const line = lineOf(p, script()).map(n => n.cn).join(" ");
    if (S.warming) {                                             // solving it starts the run; a miss shows the line and serves another
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
    // a run of patterns says what each one is (after a miss's line has been read), and gives you time to read it
    const told = S.patterns ? patternSay(p, script()) : "";
    if (solved) {
      S.solved++;
      S.ratings.push(p.rating);
      say(told ? `✓ ${told}` : "Solved", "good");
    } else {
      S.strikes++;
      S.misses.push({ id: p.id, rating: p.rating, fen: p.fen, moves: p.moves.join(" "), theme: p.theme, patterns: p.patterns });
      say(`Not that one: ${line}`, "bad");
      navigator.vibrate?.(70);
      if (told) { const run = S, at = S.at; setTimeout(() => { if (S === run && S.at === at && S.strikes < STRIKES) say(told, "bad"); }, 1600); }
    }
    $("rushMeta").textContent = metaOf(p);
    drawHud();
    keepRun();
    if (S.strikes >= STRIKES) { finish("strikes"); return; }
    serveIn(S.patterns ? (solved ? 2600 : 3400) : solved ? 350 : 1400);
  }
  /** A puzzle's line over the board once it's done: its rating, what it comes to, its patterns by name. */
  function metaOf(p) {
    const what = themeWords(p), named = patternWords(p, script());
    return `Rated ${p.rating.toLocaleString("en-GB")}${what ? ` · ${what}` : ""}${named ? ` · ${named}` : ""}`;
  }
  /** The run's end: its bests kept, the board left as it stands, and the results (not when you left it yourself). */
  function finish(why, quiet = false) {
    if (!S || S.over) return;
    S.over = true;
    S.why = why;
    keepRun();
    clearInterval(tick);
    clock();
    puzzle?.stop();
    // your best in the clock, any run (a run of patterns its own); and today's run's best, a record for each day
    const res = noteRun(read(BEST, {}), read(DAILY, {}), { kind: kindOf(S), mode: S.mode, score: S.solved }, today());
    write(BEST, res.bests);
    if (S.daily) write(DAILY, res.daily);
    S.best = res.best;
    drawBar();
    if (!quiet) results();
  }
  const missOf = m => parsePuzzle(puzzleLine({ ...m, moves: m.moves.split(" ") }));
  /** The run's results: the count, accuracy, your rating and how it moved, your best; the hardest solved; each miss with
   *  its line, and Show to see it played out. */
  function results() {
    $("rushHead").textContent = endTitle(S.why);
    const body = $("rushBody"), attempts = S.solved + S.misses.length, change = Math.round(rating.r - S.ratingAtStart);
    const stats = [[`${attempts ? Math.round(S.solved / attempts * 100) : 0}%`, "accuracy"],
      [`${Math.round(rating.r).toLocaleString("en-GB")} (${change >= 0 ? "+" : "−"}${Math.abs(change)})`, "rating"], [S.best, S.daily ? "best today" : `best, ${S.patterns ? "Patterns" : MODES[S.mode].label}`]];
    const s = script();
    const missed = S.misses.map((m, i) => {
      const p = missOf(m), what = themeWords(p), named = patternWords(p, s);
      return `<li><b>${esc(solverOf(p))} to move · ${esc(m.rating.toLocaleString("en-GB"))}${what ? ` · ${esc(what)}` : ""}${named ? ` · ${esc(named)}` : ""}</b>`
        + `<span>${lineOf(p, s).map(n => `${esc(n.cn)} <i>${esc(n.wxf)}</i>`).join(", ")}${IN_FRAME ? "" : ` <button type="button" class="link" data-show="${i}">Show</button>`}</span></li>`;
    }).join("");
    body.innerHTML = `<p class="rv-rush-big">${S.solved}</p><div class="rv-rush-stats">${stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`
      + (S.solved ? `<p class="rv-rush-note">Hardest solved: ${Math.max(...S.ratings).toLocaleString("en-GB")}. ${S.misses.length ? "The ones that got away:" : "Not a single miss."}</p>` : S.misses.length ? `<p class="rv-rush-note">The ones that got away:</p>` : "")
      + (missed ? `<ul class="rv-rush-missed">${missed}</ul>` : "")
      + `<div class="rv-end-go"><button class="rv-go quiet" type="button" data-go="back">The game</button><button class="rv-go" type="button" data-go="again">Again</button></div>`;
    body.querySelector("[data-go=again]").addEventListener("click", () => { $("rushDlg").close(); start(); });
    for (const b of body.querySelectorAll("[data-show]")) b.addEventListener("click", () => { $("rushDlg").close(); replay(S.misses[Number(b.dataset.show)]); });
    body.querySelector("[data-go=back]").addEventListener("click", () => { $("rushDlg").close(); close(); });
    body.querySelector("[data-go=again]").hidden = IN_FRAME;
    body.querySelector("[data-go=back]").hidden = IN_FRAME;
    if (!$("rushDlg").open) $("rushDlg").showModal();
  }

  /** A miss played out on the board, the mistake and then the line, a move a second, its moves named above it. */
  function replay(m) {
    const p = missOf(m);
    puzzle?.destroy();
    say(`${solverOf(p)} to move: ${lineOf(p, script()).map(n => n.cn).join(" ")}`);
    $("rushMeta").textContent = metaOf(p);
    puzzle = playPuzzle(host, p, { interactive: false, reveal: true, script });
  }

  // ---------- the clock: 3 min's grace, each puzzle's first five seconds free (rush-core.js) ----------
  const spent = () => spentOf(S, performance.now());
  function clock() {
    const c = $("rushClock"), ms = MODES[modeOf(S?.mode || (next.kind === "patterns" ? "survival" : next.mode))].ms;
    if (!ms) { c.textContent = ""; c.classList.remove("low"); return; }
    if (!S || S.started == null) { c.textContent = clockText(ms); c.classList.remove("low"); return; }   // not running yet
    const left = Math.max(0, ms - (S.over ? S.spentAtEnd ?? ms : spent()));
    c.textContent = clockText(left);
    c.classList.toggle("low", left < 20000 && !S.over);
    if (left <= 0 && !S.over) finish("time");
  }

  // ---------- kept as it goes ----------
  // after every move, yours or the reply: a partner watching sees the puzzle on the board, how far into it, the count,
  // the strikes and the clock; and a run without a clock (or one still on its warm-up) comes back after a reload. A timed
  // run can't be paused, so leaving the page ends it (below).
  function keepRun(step = S?.step || 0) {
    if (!S) return;
    S.step = step;
    const timed = S.started != null, g = MODES[S.mode]?.grace || 0;
    if (S.over && timed && S.spentAtEnd == null) S.spentAtEnd = Math.round(spent());
    write(RUN, { open: on, mode: S.mode, daily: S.daily, patterns: !!S.patterns, seed: S.seed, at: S.at, used: [...S.used], solved: S.solved, strikes: S.strikes, misses: S.misses,
      ratings: S.ratings, warming: S.warming, over: S.over, why: S.why, ratingAtStart: S.ratingAtStart, current: S.current, step,
      spent: timed ? (S.over ? S.spentAtEnd : Math.round(spent())) : null,
      grace: timed && g && S.puzzleAt != null && !S.over ? Math.round(Math.min(g, performance.now() - S.puzzleAt)) : null,   // of this puzzle's delay, used
      savedAt: Date.now() });
  }
  /** A kept run on the board as it stood: here an untimed one or a warm-up, in a watching frame whatever your partner is
   *  playing (their clock run on by the time since they moved), a finished run with its results. */
  function pickUp(r) {
    S = { ...r, used: new Set(r.used || []), over: false, started: null, puzzleAt: null, free: 0, spentAtEnd: null };
    if (r.spent != null) {
      const now = performance.now(), lag = IN_FRAME && !r.over ? Math.max(0, Date.now() - r.savedAt) : 0, used = r.grace ?? 0;
      if (r.grace != null) S.puzzleAt = now - used - lag;
      S.started = now - r.spent - lag - used;
    }
    next = { kind: kindOf(S), mode: S.patterns ? next.mode : S.mode };
    clearInterval(tick);
    tick = setInterval(clock, 250);
    drawHud(); drawBar();
    mount(S.current, r.step || 0);
    if (r.over) finish(r.why || "time", !IN_FRAME);
  }
  const resumable = r => !!r && !!MODES[r.mode] && !!r.current && !r.over && (!MODES[r.mode].ms || r.warming);

  // ---------- the page ----------
  function say(text, tone = "") { const l = $("rushLine"); l.className = `rv-rush rv-rush-line${tone ? ` ${tone}` : ""}`; l.textContent = text; }
  function drawHud() {
    $("rushSolved").textContent = String(S ? S.solved : 0);
    $("rushRating").textContent = `${Math.round(rating.r)}${rating.n < 20 ? "?" : ""}`;
    $("rushStrikes").replaceChildren(...Array.from({ length: STRIKES }, (_, k) => { const i = document.createElement("i"); i.className = `rv-rush-strike${S && k < S.strikes ? " hit" : ""}`; return i; }));
    $("rushStrikes").setAttribute("aria-label", `${S ? S.strikes : 0} of ${STRIKES} missed`);
    clock();
  }
  function drawBar() {
    const bar = $("rushBar");
    bar.replaceChildren();
    if (IN_FRAME) return;
    const button = (text, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = `rv-go ${cls}`.trim(); b.textContent = text; b.addEventListener("click", fn); bar.append(b); };
    button("The game", close, "quiet");
    if (!S || S.over) button(S ? "Again" : "Start", () => start());
  }
  function show() {
    on = true;
    app.classList.add("rushing");
    $("learnBtn").hidden = true;
    onOpen();
  }
  /** The rush from the menu: a run left without a clock (or on its warm-up) where it was, else a new one. */
  function open() {
    show();
    const r = read(RUN, null);
    if (resumable(r)) { pickUp(r); keepRun(); } else start();
  }
  /** Back to the game: a timed run under way ends (you're asked first); one without a clock waits for next time. */
  function close() {
    if (S && !S.over && S.started != null && MODES[S.mode].ms) {
      if (!confirm("End this run and go back to the game?")) return;
      finish("time", true);
    }
    clearInterval(tick);
    puzzle?.destroy(); puzzle = null;
    on = false;
    if (S) keepRun();
    else { const r = read(RUN, null); if (r?.open) write(RUN, { ...r, open: false }); }
    app.classList.remove("rushing");
    $("learnBtn").hidden = false;
    onClose();
  }
  /** At start-up: the rush takes the page if it was open, picking its run up where it can (a watching frame always
   *  shows your partner's), else on a new run of the same kind. True if it did. */
  function boot() {
    const r = read(RUN, null);
    if (!r?.open || !MODES[r.mode]) return false;
    show();
    if (r.current && (IN_FRAME || resumable(r))) pickUp(r);
    else if (IN_FRAME) drawHud();
    else start();
    return true;
  }
  /** The menu while the rush is open, as every game's rush has it (rush-menu.js): a run (Random, Today's, or River's own
   *  Patterns) and its clock, your rating, your bests. */
  function menu(body) {
    pick ??= { ...next };
    rushMenu(body, {
      pick, start: () => { next = { ...pick }; pick = null; start(); }, results: S?.over ? results : null, back: close, backText: "Back to the game",
      own: [["patterns", "Patterns"]], ownNote: "Patterns: the named mates and tricks alone, each said after it's done, with no clock.",
      rating, resetRating: () => { rating.r = 1000; rating.n = 0; write(RATING, rating); drawHud(); },
      bests: read(BEST, {}), daily: read(DAILY, {}), day: today(), inFrame: IN_FRAME,
    });
  }

  $("rushClose").addEventListener("click", () => $("rushDlg").close());
  // the menu, the rules and the games screen stop the clock: its start moves on by however long they were open
  let held = false;
  onPause(() => { if (on && S && !S.over && S.started != null) { clearInterval(tick); held = true; } },
    ms => { if (!held) return; held = false; if (S && !S.over && S.started != null) { S.started += ms; if (S.puzzleAt != null) S.puzzleAt += ms; tick = setInterval(clock, 250); clock(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden && !IN_FRAME && on && S && !S.over && S.started != null && MODES[S.mode].ms) finish("time"); });

  return {
    get on() { return on; }, get state() { return S; }, get rating() { return rating; },
    open, close, boot, menu, start, finish, redraw: () => puzzle?.redraw(),
    get puzzle() { return puzzle; },
  };
}
