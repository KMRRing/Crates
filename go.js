// Go against the computer, or two on one phone. The rules are go-rules.js's (Chinese area scoring, positional superko), the
// computer is the KataGo g170 network searched by go-search.js in a worker (go-worker.js) while the board stays alive, and
// this page draws the board (go-view.js), takes a tap as a move (a second tap on the same point confirms it, unless you turn
// that off), and runs the end: after two passes the computer marks the stones it thinks are dead, you mark them as you see
// them, and the area is counted. The game is kept as its moves (go:run), so Undo and a reload are a replay.
import { BLACK, WHITE, PASS, SIZES, MAX_HANDICAP, newGame, replay, isLegal, ptName, areaScore, result, groupAt, opp, neighbours } from "./go-rules.js";
import { LEVELS, DEFAULT_LEVEL, levelOf, visitsFor } from "./go-levels.js";
import { createBoard } from "./go-view.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
import { roundOver } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sure } from "./sure.js";
import { waitMark } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "go:opts", RUN = "go:run", RECORD = "go:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NET = "g170-b6c96-s175395328-d26788732";

// opts: the next game's choices. side: "b" or "w" (the colour you play) or "two" (two people on this phone).
let opts = { size: 9, side: "b", level: DEFAULT_LEVEL, handicap: 0, confirm: true, estimate: false, ...read(OPTS, {}) };
if (!SIZES.includes(opts.size)) opts.size = 9;
if (!["b", "w", "two"].includes(opts.side)) opts.side = "b";
if (!(opts.handicap === 0 || (opts.handicap >= 2 && opts.handicap <= MAX_HANDICAP))) opts.handicap = 0;
opts.level = levelOf(opts.level).id;
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the run: the game and what the page shows of it ----------
// run: { game, human ("b" | "w" | "two"), level, phase ("play" | "scoring" | "over"), dead: [points], result, est: { n, wr, score, own } }
const sane = r => r && r.game && SIZES.includes(r.game.size) && Array.isArray(r.game.moves) && ["play", "scoring", "over"].includes(r.phase);
let run = read(RUN, null);
if (!sane(run)) run = null;
let R = null;                                    // the replay of run.game: pos, seen, made
let pending = -1;                                // the point tapped once, awaiting its confirmation
let thinking = 0;                                // the id of the request out to the worker, 0 for none
let held = null;                                 // the computer's answer that came while the game stood still
let paused = false;
let ready = false, dead = false;                 // the worker has loaded the net / could not

const saveRun = () => write(RUN, run);
const humanColour = () => (run.human === "b" ? BLACK : run.human === "w" ? WHITE : 0);
const syncReplay = () => { try { R = replay(run.game); } catch (e) { console.error(e); run = null; R = null; } };
const humanToMove = () => run.phase === "play" && !run.game.resigned && (run.human === "two" || humanColour() === R.pos.toMove);
const computerToMove = () => run.phase === "play" && !run.game.resigned && run.human !== "two" && humanColour() !== R.pos.toMove;

// ---------- the worker ----------
let worker = null, nextId = 1;
const waiting = new Map();
function startWorker() {
  try {
    worker = new Worker(new URL("./go-worker.js", import.meta.url), { type: "module" });
  } catch (e) { console.error(e); dead = true; return; }
  worker.onmessage = e => {
    const m = e.data;
    if (m.ready) { ready = true; draw(); if (run && computerToMove() && !thinking) think(); wantRead(); return; }
    if (m.error && !m.id) { dead = true; console.error("go-worker:", m.error); draw(); toast("The computer player couldn't start", 4000); return; }
    const cb = waiting.get(m.id);
    if (cb) { waiting.delete(m.id); cb(m); }
  };
  worker.onerror = e => { console.error(e); dead = true; draw(); };
}
function ask(msg) {
  return new Promise((resolve, reject) => {
    if (!worker || dead) { reject(new Error("no computer")); return; }
    const id = nextId++;
    waiting.set(id, m => (m.error ? reject(new Error(m.error)) : resolve({ id, ...m })));
    worker.postMessage({ ...msg, id });
  });
}

// ---------- the computer's move ----------
async function think() {
  if (!run || !computerToMove() || thinking || dead) return;
  const game = JSON.parse(JSON.stringify(run.game)), at = game.moves.length;
  const level = levelOf(run.level);
  thinking = at + 1;
  draw();
  try {
    const out = await ask({ type: "move", game, visits: visitsFor(level, game.size), temperature: level.temperature, seed: (Date.now() & 0x7fffffff) | 1, noPass: R.pos.passes === 0 });
    if (!run || run.game.moves.length !== at || thinking !== at + 1) return;       // the game moved on (Undo, a new game)
    thinking = 0;
    held = out;
    if (!paused) applyHeld();
  } catch (e) {
    thinking = 0;
    console.error(e);
    toast("The computer player couldn't answer", 3500);
    draw();
  }
}
function applyHeld() {
  const out = held;
  held = null;
  if (!out || !run || !computerToMove()) { draw(); return; }
  run.est = { n: run.game.moves.length, wr: out.winrate, score: out.score, own: out.own };
  // the computer gives up a lost game once it is clear (every look under 3 per cent, well into the game)
  run.low = out.winrate < 0.03 ? (run.low || 0) + 1 : 0;
  if (run.low >= 3 && run.game.moves.length > run.game.size * 3 && R.pos.passes === 0) {
    run.game.resigned = run.human === "b" ? "w" : "b";
    finish();
    return;
  }
  play(out.move, true);
}
onPause(() => { paused = true; }, () => { paused = false; if (held) applyHeld(); });

// ---------- a move ----------
function why(pt) {
  if (R.pos.b[pt]) return "That point is taken";
  if (pt === R.pos.ko) return "Ko: you can't take back at once";
  if (!R.pos.playable(pt)) return "No liberty there: that would be suicide";
  return "That would bring back an earlier position (superko)";
}
function play(pt, byComputer = false) {
  if (!run || run.phase !== "play") return;
  if (!isLegal(R, pt)) { if (!byComputer) toast(why(pt)); return; }
  run.game.moves.push(pt);
  pending = -1;
  syncReplay();
  saveRun();
  if (byComputer && pt === PASS) toast("The computer passes");
  if (R.pos.passes >= 2) { enterScoring(); return; }
  draw();
  if (computerToMove()) think(); else wantRead();
}
function tap(pt) {
  if (!run || IN_FRAME) return;
  if (run.phase === "scoring") { toggleDead(pt); return; }
  if (!humanToMove() || thinking) return;
  if (!isLegal(R, pt)) { pending = -1; draw(); toast(why(pt)); return; }
  if (opts.confirm && pending !== pt) { pending = pt; draw(); return; }
  play(pt);
}
function pass() {
  if (!humanToMove() || thinking) return;
  play(PASS);
}
async function resign() {
  if (!run || run.phase !== "play" || thinking) return;
  if (!(await sure("Resign this game?", { yes: "Resign", no: "Keep playing" }))) return;
  run.game.resigned = run.human === "two" ? (R.pos.toMove === BLACK ? "b" : "w") : run.human;
  finish();
}
function undo() {
  if (!run || thinking || run.phase !== "play") return;
  const g = run.game;
  if (!g.moves.length) return;
  g.moves.pop();
  // back to a position where a person is to move: against the computer, its reply goes too
  if (run.human !== "two" && g.moves.length) { syncReplay(); if (computerToMove()) g.moves.pop(); }
  run.dead = []; run.low = 0; run.est = null;
  pending = -1; held = null;
  syncReplay();
  saveRun();
  draw();
  if (computerToMove()) think(); else wantRead();
}

// ---------- the end: dead stones, then the count ----------
async function enterScoring() {
  run.phase = "scoring";
  run.dead = [];
  pending = -1;
  saveRun();
  draw();
  try {
    const out = await ask({ type: "read", game: JSON.parse(JSON.stringify(run.game)) });
    if (!run || run.phase !== "scoring") return;
    // the net's ownership is for the side to move: a stone it thinks the other side owns is dead, group by group
    const sign = R.pos.toMove === BLACK ? 1 : -1, own = out.own.map(v => v * sign), seen = new Set(), deadPts = [];
    const stones = [];
    for (let i = 0; i < R.pos.b.length; i++) {
      const c = R.pos.b[i];
      if (!c || seen.has(i)) continue;
      R.pos.group(i, stones);
      let against = 0;
      for (const s of stones) { seen.add(s); if ((c === BLACK ? -own[s] : own[s]) > 0.4) against++; }
      if (against * 2 > stones.length) deadPts.push(...stones);
    }
    run.dead = deadPts;
    run.est = { n: run.game.moves.length, wr: out.winrate, score: out.score, own: out.own };
    saveRun();
    draw();
    if (deadPts.length) toast("Dead stones marked: tap a group to change", 3200);
  } catch { /* no computer: mark them yourself */ }
}
function toggleDead(pt) {
  const group = groupAt(R.pos, pt);
  if (!group.length) return;
  const set = new Set(run.dead);
  const off = group.every(s => set.has(s));
  for (const s of group) { if (off) set.delete(s); else set.add(s); }
  run.dead = [...set];
  saveRun();
  draw();
}
function resume() {
  if (!run || run.phase !== "scoring") return;
  run.game.moves.splice(-2, 2);
  run.phase = "play"; run.dead = [];
  syncReplay();
  saveRun();
  draw();
  if (computerToMove()) think();
}
function finish() {
  syncReplay();
  const res = result(run.game, R.pos, new Set(run.dead || []));
  run.phase = "over";
  run.result = { text: res.text, winner: res.winner, margin: res.margin, black: res.black ?? null, white: res.white ?? null, resigned: run.game.resigned };
  saveRun();
  if (!IN_FRAME && run.human !== "two") {
    const rec = read(RECORD, { played: 0, won: 0 });
    rec.played++;
    const won = res.winner === run.human;
    if (won) rec.won++;
    write(RECORD, rec);
    noteStreak("go", won);
  }
  draw();
  if (!IN_FRAME) roundOver("go");
  setTimeout(() => { if (run?.phase === "over") showEnd(); }, 700);
}
function showEnd() {
  const r = run.result, komi = run.game.komi;
  const who = c => (c === "b" ? "Black" : "White");
  $("endHead").textContent = run.human !== "two" ? (r.winner === run.human ? "You win" : "The computer wins") : r.text.split(" by ")[0];
  const rows = r.resigned
    ? `<li class="${r.winner === "b" ? "won" : ""}"><i class="go-swatch b"></i><span class="nm">Black</span><b></b></li><li class="${r.winner === "w" ? "won" : ""}"><i class="go-swatch w"></i><span class="nm">White</span><b></b></li>`
    : `<li class="${r.winner === "b" ? "won" : ""}"><i class="go-swatch b"></i><span class="nm">Black, area</span><b>${r.black}</b></li>
       <li class="${r.winner === "w" ? "won" : ""}"><i class="go-swatch w"></i><span class="nm">White, area${komi ? ` + komi ${komi}` : ""}</span><b>${r.white + komi}</b></li>`;
  $("endBody").innerHTML = `<ol class="go-tally">${rows}</ol><p class="go-end-note">${esc(r.text)}${r.resigned ? "" : ". Area scoring: stones plus the empty points only one side surrounds"}.</p>`;
  if (!$("endDlg").open) $("endDlg").showModal();
}

// ---------- the estimate (Menu, Show who is ahead) ----------
let reading = 0;
async function wantRead() {
  if (!opts.estimate || !run || run.phase !== "play" || dead || !ready || reading) return;
  if (run.est?.n === run.game.moves.length) return;
  const n = run.game.moves.length;
  reading = n + 1;
  try {
    const out = await ask({ type: "read", game: JSON.parse(JSON.stringify(run.game)) });
    reading = 0;
    if (!run || run.game.moves.length !== n) { wantRead(); return; }
    run.est = { n, wr: out.winrate, score: out.score, own: out.own };
    saveRun();
    draw();
  } catch { reading = 0; }
}

// ---------- the drawing ----------
const board = createBoard($("board"), { onTap: tap });
function estimateBlack() {
  const e = run.est;
  if (!e || e.n !== run.game.moves.length || !R) return null;
  const sign = R.pos.toMove === BLACK ? 1 : -1;
  return { own: e.own.map(v => v * sign), wr: R.pos.toMove === BLACK ? e.wr : 1 - e.wr, score: e.score * sign };
}
function draw() {
  const status = $("status"), controls = $("controls"), ahead = $("ahead");
  if (!run) { status.textContent = ""; controls.replaceChildren(); return; }
  const n = run.game.size, est = estimateBlack();
  const deadSet = new Set(run.dead || []);
  let owner = null;
  if (run.phase !== "play" && !run.game.resigned) owner = areaScore(R.pos, deadSet).owner;
  board.draw({
    size: n, stones: R.pos.b, last: R.made.length && R.made.at(-1).pt >= 0 ? R.made.at(-1).pt : -1, ko: R.pos.ko, dead: deadSet, owner,
    estimate: opts.estimate && run.phase === "play" && est ? est.own : null, pending: humanToMove() ? pending : -1, toMove: R.pos.toMove,
    locked: IN_FRAME,
  });
  // one line of text beside the menu button
  const turn = R.pos.toMove === BLACK ? "Black" : "White", caps = R.pos.caps;
  status.replaceChildren();
  if (run.phase === "over") status.textContent = run.result.text;
  else if (run.phase === "scoring") status.textContent = "Mark the dead stones, then count";
  else if (thinking) { status.append(waitMark(), document.createTextNode(ready ? " The computer is thinking" : " Waking the computer")); }
  else status.textContent = `${run.human === "two" ? turn : humanToMove() ? "Your move" : turn} · captured ${caps[BLACK]}–${caps[WHITE]}${run.game.handicap ? ` · handicap ${run.game.handicap}` : ""}`;
  // who is ahead
  if (opts.estimate && est && run.phase === "play") {
    const pct = Math.round(est.wr * 100), lead = est.score;
    ahead.hidden = false;
    ahead.innerHTML = `<div class="go-meter" role="img" aria-label="Black ${pct} per cent"><b style="width:${pct}%"></b><i></i></div><span>Black ${pct}% · ${lead >= 0 ? "B" : "W"}+${Math.abs(lead).toFixed(1)}</span>`;
  } else ahead.hidden = true;
  // the buttons
  const btn = (text, fn, cls = "", disabled = false) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = text; b.disabled = disabled; b.addEventListener("click", fn); return b; };
  controls.replaceChildren();
  if (run.phase === "play") {
    const mine = humanToMove() && !thinking;
    controls.append(btn("Pass", pass, "", !mine), btn("Undo", undo, "", !!thinking || !run.game.moves.length), btn("Resign", resign, "", !!thinking));
  } else if (run.phase === "scoring") {
    controls.append(btn("Play on", resume), btn("Undo marks", () => { run.dead = []; saveRun(); draw(); }, "", !deadSet.size), btn("Count", finish, "primary"));
  } else controls.append(btn("The result", showEnd), btn("New game", () => startGame(), "primary"));
}

// ---------- a new game ----------
function startGame() {
  if ($("endDlg").open) $("endDlg").close();
  const g = newGame({ size: opts.size, handicap: opts.side === "two" ? 0 : opts.handicap });
  run = { game: g, human: opts.side, level: opts.level, phase: "play", dead: [], result: null, est: null, low: 0 };
  pending = -1; thinking = 0; held = null; reading = 0;
  syncReplay();
  saveRun();
  draw();
  if (computerToMove()) think(); else wantRead();
}
$("endAgain").addEventListener("click", () => startGame());
$("endBoard").addEventListener("click", () => $("endDlg").close());

// ---------- rules, about, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Go is an old game for two. Black and white stones go on the points where the lines cross, Black first. Stones never move; they are taken when surrounded.</p>
    <h3>A move</h3>
    <p>Play on any empty point, or pass. A stone or a connected group of stones lives by its liberties, the empty points next to it. A move that takes away a group's last liberty takes the group off the board. You may not play where your own stone would have no liberty, unless the move takes something.</p>
    <h3>Ko</h3>
    <p>No move may bring back a whole-board position that has stood before (positional superko). The usual case is the ko: a single stone taken and retaken, so after a capture you must play elsewhere first.</p>
    <h3>The end</h3>
    <p>When both sides pass in a row the game stops. Dead stones, which could not live if play went on, come off, and each side scores its stones plus the empty points only it surrounds (Chinese area scoring). White adds komi, 7.5 in an even game, for moving second. The computer marks the stones it thinks are dead; tap a group to mark or unmark it, or Play on to carry on.</p>
    <h3>Handicap</h3>
    <p>The weaker player may take Black with 2 to 9 stones set on the star points before White's first move; the komi is then a half point.</p>
    <p class="go-rules-note">Tap a point once to see the stone, tap it again to play (Menu turns that off). Undo takes back your move and the reply.</p>`;
  $("rulesDlg").showModal();
}
function showAbout() {
  $("aboutBody").innerHTML = `
    <p>The computer is a neural network from the KataGo project, searched by our own code on this phone: nothing is sent anywhere, and it plays offline once the game has loaded.</p>
    <h3>The network</h3>
    <p>${NET}: 6 residual blocks of 96 channels (about 1.1 million weights, 3.8 MB), from KataGo's first public training run (g170, 2019 to 2020). KataGo's training site publishes that run's networks as public domain (CC0). The file used is the one in the KataGo repository's test models.</p>
    <h3>The engine</h3>
    <p>The arithmetic is our own, in WebAssembly, written from KataGo's published model format; the search is a plain Monte Carlo tree search. Nothing of KataGo's engine code is in the page. KataGo itself is MIT licensed:</p>
    <pre>Copyright 2025 David J Wu ("lightvector") and/or other authors of the content in this repository.
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. See vendor/go/LICENSE-KataGo.txt for the whole text.</pre>
    <h3>Levels</h3>
    <p>${LEVELS.map(l => `<b>${esc(l.name)}</b>: ${esc(l.note)}`).join(". ")}.</p>`;
  $("aboutDlg").showModal();
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New game", async () => {
    if (run && run.phase === "play" && run.game.moves.length > 8 && !(await sure("Start a new game? This one isn't finished.", { yes: "New game", no: "Keep playing" }))) return;
    startGame();
  }, "primary"));
  play.append(action("The rules", showRules, "link"));
  const content = part(body, "content");
  content.append(choice("Board", SIZES.map(s => [s, `${s}×${s}`]), opts.size, v => { opts.size = +v; saveOpts(); }));
  content.append(choice("You play", [["b", "Black"], ["w", "White"], ["two", "Two on this phone"]], opts.side, v => { opts.side = v; saveOpts(); openMenu(); }));
  if (opts.side !== "two") {
    content.append(choice("The computer", LEVELS.map(l => [l.id, l.name]), opts.level, v => { opts.level = v; saveOpts(); openMenu(); }));
    content.append(line(levelOf(opts.level).note + "."));
    content.append(choice("Handicap", [[0, "None"], ...Array.from({ length: MAX_HANDICAP - 1 }, (_, i) => [i + 2, String(i + 2)])], opts.handicap, v => { opts.handicap = +v; saveOpts(); }));
  }
  content.append(line("These apply from the next game. Komi is 7.5, or a half point with a handicap."));
  const set = part(body, "settings");
  set.append(toggle("Tap twice to play a stone", opts.confirm, on => { opts.confirm = on; pending = -1; saveOpts(); draw(); }));
  set.append(toggle("Show who is ahead", opts.estimate, on => { opts.estimate = on; saveOpts(); draw(); wantRead(); }));
  const rec = read(RECORD, { played: 0, won: 0 }), st = read("go:streak", { now: 0, best: 0 });
  const about = part(body, "about");
  about.append(line(rec.played ? `Won ${rec.won} of ${rec.played} games against the computer${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games against the computer finished yet."));
  about.append(action("About the computer", showAbout, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "go");
document.querySelector(".go-mark").innerHTML = APPS.find(a => a.id === "go")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("aboutClose").addEventListener("click", () => $("aboutDlg").close());
if (!IN_FRAME) startWorker();
if (run) syncReplay();
if (!run || !R) startGame(); else { draw(); if (!IN_FRAME && computerToMove()) think(); }
window.__go = { get run() { return run; }, get R() { return R; }, opts, tap, startGame, get ready() { return ready; }, get dead() { return dead; } };
void opp; void neighbours;
