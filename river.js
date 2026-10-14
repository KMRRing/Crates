// River: Xiangqi (象棋, Chinese chess) against Fairy-Stockfish at a strength you choose, two players on one phone, or
// a match with your partner. The rules are river-rules.js's (the board's own referee), the board river-board.js's, the
// computer's moves and the coach the engine's (uci.js, in a worker, loaded only when a game against it needs it; the
// coach's judgement is uci-coach.js's). The game in play is kept as it changes (river:game) and picked up on reload; a
// partner watching draws it from there.
import * as X from "./river-rules.js";
import { mountBoard, discSvg, diagramSvg, setPictures, pieceMark } from "./river-board.js";
import { LEVELS, levelById, HINT, REVIEW, SETUP } from "./river-levels.js";
import { OPENINGS, openingOf } from "./river-openings.js";
import { Engine, WORKERS, levelMove } from "./uci.js";
import { COACH, isCoach, createCoach } from "./uci-coach.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { busy, sextant } from "./loading.js";
import { createCourse, progress } from "./river-learn.js";
import { createRush } from "./river-rush-ui.js";

const $ = id => document.getElementById(id);
const GAME = "river:game", OPTS = "river:opts", BEST = "river:best", RECORD = "river:record";
const APP = 1;                                                   // the room's version: a device on older code updates
const PACE = 700;                                                // the computer's move shows no sooner than this after yours
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rating = n => n.toLocaleString("en-GB");

// ---------- settings and the game ----------
// opts: the board's look (facing, script), the coach, and the next game's choices (mode, level, colour), which the
// menu sets.
let opts = { facing: false, script: "traditional", pieces: "characters", mode: "engine", level: "2", colour: "red", coach: "hints", ...read(OPTS, {}) };
if (!["traditional", "simplified"].includes(opts.script)) opts.script = "traditional";
if (!["characters", "pictures"].includes(opts.pieces)) opts.pieces = "characters";
setPictures(opts.pieces === "pictures");
if (!isCoach(opts.coach)) opts.coach = "hints";
const saveOpts = () => write(OPTS, opts);
/**
 * G: the game in play, river-rules.js's state and the page's: { v, start, moves, result, red, mode ("engine" or "two"),
 * level, created, hint, lesson, marks, review, counted }. With the computer, seat 0 is you and 1 the computer, `red` the
 * seat playing Red; two players on one phone are seat 0 (Red) and 1 (Black). hint: the coach's strongest moves for the
 * position it was asked in ({ at, moves, cp, mate, auto }: auto, its advice unasked); lesson: its word on your last
 * move, if that gave a good deal away; marks: ? and ?? by the moves it faulted; review: the end's look back, once made;
 * counted: the game has gone into your record.
 */
function freshGame() {
  const red = opts.mode === "two" ? 0 : opts.colour === "black" ? 1 : opts.colour === "either" ? (Math.random() < 0.5 ? 0 : 1) : 0;
  return { ...X.newGame({ red }), mode: opts.mode === "two" ? "two" : "engine", level: levelById(opts.level).id, created: Date.now(), hint: null, lesson: null, marks: {}, review: null, counted: false };
}
function loadGame() {
  const g = X.fromRoom(read(GAME, null));
  if (!g || !X.replay(g).ok) return freshGame();
  // a hint kept before the coach showed its strongest moves had one move: it reads as a list of one
  const hint = g.hint ? { ...g.hint, moves: g.hint.moves || (g.hint.move ? [g.hint.move] : []) } : null;
  return { ...g, mode: g.mode === "two" ? "two" : "engine", level: levelById(g.level).id, created: g.created || Date.now(), hint, lesson: g.lesson || null, marks: g.marks || {}, review: g.review || null, counted: !!g.counted };
}
let G = loadGame();
const save = () => { if (!IN_FRAME && !together.room) write(GAME, G); };

// at a table together: D is the room's game, `me` this device's seat in it
let D = null;
const inRoom = () => !!together.room && !!D;
const cur = () => (inRoom() ? D : G);
const mySeat = () => (inRoom() ? seatsOf(D).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
/** The seats this device moves for: yours, or both on one phone. */
const handSeats = () => (inRoom() ? [mySeat()] : G.mode === "two" ? [0, 1] : [0]);
/** Whether Red sits at the bottom of the board. */
const bottomRed = () => (inRoom() ? D.red === mySeat() : G.mode === "two" ? true : G.red === 0);

// ---------- the engine ----------
const engine = new Engine(WORKERS.fairy, { setup: SETUP });
const FULL = { MultiPV: 1, "Skill Level": 20, UCI_LimitStrength: false };     // the engine unlimited: the review
// Xiangqi's engine scores a soldier at about 1.25 of a chess pawn: the coach's judgement is scaled to match (uci-coach.js)
const coach = createCoach(engine, { limit: HINT.limit, alone: HINT.alone, scale: 1.25 });
let engineUp = false;
/** The engine, started if it isn't: the rete shows while it loads (a moment, or the first download). */
async function ensureEngine() {
  if (engineUp) return true;
  const done = busy("Loading the engine");
  try { await engine.start(); engineUp = true; return true; }
  catch (e) {
    console.error(e);
    toast(navigator.onLine === false ? "The computer player needs a connection the first time" : "The computer player couldn't start");
    return false;
  } finally { done(); }
}
/** The engine, started quietly (the coach thinking while you do, unasked): false if it can't start. */
async function quietEngine() {
  if (engineUp) return true;
  try { await engine.start(); engineUp = true; return true; } catch { return false; }
}

// ---------- the turn ----------
let gen = 0, thinking = false, hinting = null, slide = false;      // hinting: the position the coach is looking at
let replayed = null;
/** The game replayed (every position, every move), kept until its moves change. */
const played = () => {
  const g = cur(), key = `${g.start}|${g.moves}`;
  if (replayed?.key !== key) replayed = { key, p: X.replay(g) };
  return replayed.p;
};
function afterMove(animate = true) {
  gen++;
  looking = false;
  slide = animate;
  save();
  render();
  slide = false;
  settle();
  kick();
  advise();
}
/** A move made by hand on the board. */
function onMove(from, to) {
  const g = cur(), seat = X.waitingOn(g), uci = X.uciOf(from, to);
  if (seat === null || !handSeats().includes(seat)) return;
  if (inRoom()) { moveTogether(uci); return; }
  const before = X.movesOf(G), next = X.act(G, seat, { move: uci });
  if (!next) { render(); return; }
  G = { ...next, hint: null, lesson: null };
  if (checking()) checkMove(before, uci);
  afterMove();
}
/** The computer's move, when it's the computer's turn and the game isn't standing still. */
function kick() { setTimeout(think, 0); }
async function think() {
  if (IN_FRAME || inRoom() || rush.on || G.mode !== "engine" || G.result || X.waitingOn(G) !== 1 || thinking || isPaused()) return;
  const g0 = gen, t0 = performance.now();
  thinking = true;
  render();
  try {
    if (!(await ensureEngine())) { thinking = false; render(); return; }
    const level = levelById(G.level);
    await judging;                                                // the coach's word on your move comes before the reply
    const { move } = await levelMove(engine, level, { fen: G.start, moves: X.movesOf(G) });
    await sleep(Math.max(0, PACE - (performance.now() - t0)));
    while (isPaused() || rush.on) await sleep(200);               // the menu, the rules or the rush is open: the move waits
    thinking = false;
    if (g0 !== gen || inRoom()) { render(); kick(); return; }    // taken back, or a new game, meanwhile
    const next = move && X.act(G, 1, { move });
    if (!next) throw new Error(`the engine's move ${move} isn't legal here`);
    G = { ...next, hint: null };
    afterMove();
  } catch (e) {
    thinking = false;
    console.error(e);
    engine.stop(); engineUp = false;
    toast("The computer player stumbled: tap Retry");
    render();
  }
}
onPause(() => render(), () => { render(); kick(); advise(); });

// ---------- the coach ----------
// Menu, Coach: off, silent (no Hint); hints, the strongest moves when you ask; check, Hint too, and after each move of
// yours that gave a good deal away (a mistake, ?, or a blunder, ??) its word on it and the better moves, until your
// next; always, the strongest moves as arrows at each of yours without asking, and the same word. Not at a table
// together: a match is the two of you.
const coachOn = () => !inRoom() && !IN_FRAME && !rush.on && opts.coach !== "off";
const checking = () => coachOn() && (opts.coach === "check" || opts.coach === "on");
const always = () => coachOn() && opts.coach === "on";
const keyOf = g => `${g.start}|${g.moves}`;
/** The coach's strongest moves for the position on the board, if it has given them. */
const liveHint = g => (g.hint && g.hint.at === X.movesOf(g).length && g.hint.moves?.length ? g.hint : null);
/** The strongest moves for the side to move, on the board as arrows with what the engine makes of the position: asked
 *  for (Hint), or the coach's advice unasked (auto, Always). */
async function hint(auto = false) {
  const g = cur(), key = keyOf(g);
  if (!coachOn() || hinting === key || thinking || g.result || !handSeats().includes(X.waitingOn(g))) return;
  const at = X.movesOf(g).length, g0 = gen;
  hinting = key;
  render();
  try {
    if (!(await (auto ? quietEngine() : ensureEngine()))) return;
    const lines = await coach.analyse(g.start, X.movesOf(g));
    if (g0 !== gen || !lines.length) return;
    const moves = coach.strongest(lines), top = lines.find(l => l.pv[0] === moves[0]);
    G = { ...G, hint: { at, moves, cp: top.cp ?? null, mate: top.mate ?? null, auto } };
    save();
  } catch (e) { console.error(e); if (!auto) toast("The hint didn't come: try again"); engine.stop(); engineUp = false; }
  finally { if (hinting === key) hinting = null; render(); }
}
/** At each of your moves, under Check and Always: the coach looks at the position while you think (Always shows what
 *  it finds), so its word after your move comes quickly. */
function advise() {
  const g = cur();
  if (!checking() || g.result || thinking || !handSeats().includes(X.waitingOn(g))) return;
  if (always()) { if (!liveHint(g)) hint(true); return; }
  quietEngine().then(ok => { if (ok && keyOf(cur()) === keyOf(g)) coach.analyse(g.start, X.movesOf(g)).catch(() => {}); });
}
/**
 * Your move judged against the position's analysis (uci-coach.js's check): a mistake or a blunder is marked in the list
 * and gets the coach's word, the better moves with it, until your next move. The computer's reply waits for it.
 */
let judging = Promise.resolve();                                // the check of your last move, while it runs
function checkMove(before, move) {
  const start = G.start, ply = before.length;
  judging = (async () => {
    if (!(await quietEngine())) return;
    const c = await coach.check(start, before, move);
    const now = X.movesOf(G);
    if (!c || G.start !== start || now[ply] !== move || now.slice(0, ply).join(" ") !== before.join(" ")) return;   // taken back meanwhile
    const marks = { ...G.marks };
    if (c.mark) marks[ply] = c.mark; else delete marks[ply];
    // the word is on the last move made by hand: with the computer, its reply may have come since; two on one phone,
    // the other's move would be a newer one, with its own check coming
    const latest = now.length - ply - 1 <= (G.mode === "two" ? 0 : 1);
    const lesson = c.mark ? { ply, move, better: c.strongest, mark: c.mark, loss: c.loss, missed: c.missed, allows: c.allows } : null;
    G = { ...G, marks, ...(latest ? { lesson } : {}) };
    save();
    render();
  })().catch(e => { console.error(e); engine.stop(); engineUp = false; });
}
/** The marks and the word of moves no longer in the game, after a take-back, dropped. */
function trimmed(state) {
  const n = X.movesOf(state).length, marks = Object.fromEntries(Object.entries(state.marks || {}).filter(([ply]) => Number(ply) < n));
  return { ...state, marks, lesson: state.lesson && state.lesson.ply < n ? state.lesson : null };
}
// Show: the board as it stood before the move the coach faulted, its better moves and yours drawn on it
let looking = false;
function setCoach(v) {
  opts.coach = v;
  saveOpts();
  if (G.hint?.auto && v !== "on") G = { ...G, hint: null };
  if (v === "off" || v === "hints") looking = false;
  save();
  render();
  advise();
}

/** How many of the last moves Take back takes: with the computer, back to your move with one of yours undone. */
function takeBackCount() {
  const g = cur(), all = X.movesOf(g);
  if (!all.length || inRoom()) return 0;
  if (g.mode === "two") return 1;
  const startRed = X.parseFen(g.start).red, seatOf = i => ((i % 2 === 0) === startRed ? g.red : 1 - g.red);
  let n = 0;
  while (n < all.length && (n === 0 || seatOf(all.length - n) !== 0)) n++;   // back past the computer's to one of yours
  return seatOf(all.length - n) === 0 ? n : 0;
}
function takeBack() {
  const n = takeBackCount();
  if (!n) return;
  G = trimmed({ ...X.act(G, 0, { undo: n }), hint: null, review: null });    // still counted, if it had ended
  thinking = false;
  afterMove(false);
}
function resign() {
  const g = cur();
  if (g.result) return;
  if (inRoom()) { together.act(d => { const n = X.act(X.fromRoom(d), mySeat(), { resign: true }); if (!n) return false; Object.assign(d, n); }); return; }
  if (!confirm("Resign this game?")) return;
  G = { ...X.act(G, G.mode === "two" ? X.waitingOn(G) : 0, { resign: true }), hint: null };
  afterMove(false);
}
function newGame() {
  G = freshGame();
  closeDialogs();
  afterMove(false);
  if (G.mode === "engine") ensureEngine();
}

// ---------- the end ----------
const WHY = { checkmate: "Checkmate (將死)", stalemate: "No move left (困斃): the side that can't move loses", perpetual: "Perpetual check (長將) loses",
  repetition: "The same position three times: a draw", sixty: "Sixty moves each without a capture: a draw", material: "Neither side can attack: a draw", resigned: "Resigned" };
/** Notes a finished game once: your record against the level, and the strongest level beaten for the games screen. */
/**
 * A game's end: its sheet, and once (as it first ends) its place in your record. Taking back after the end and playing
 * on shows the new end and its review, but the record keeps the first: a take-back can't turn a loss into a level beaten.
 */
let endShown = null;                                             // the game whose end has been shown
function settle() {
  const g = cur();
  if (!g.result || inRoom() || IN_FRAME || endShown === G) return;
  if (!G.counted) recordEnd();
  endShown = G;
  showEnd();
}
function recordEnd() {
  const g = cur();
  G = { ...G, counted: true };
  save();
  if (G.mode === "engine") {
    const youRed = G.red === 0, won = g.result.winner === (youRed ? "red" : "black"), lost = g.result.winner && !won;
    const rec = read(RECORD, {}), r = rec[G.level] || { w: 0, d: 0, l: 0 };
    rec[G.level] = { w: r.w + (won ? 1 : 0), d: r.d + (g.result.winner ? 0 : 1), l: r.l + (lost ? 1 : 0) };
    write(RECORD, rec);
    if (won) write(BEST, Math.max(read(BEST, 0) || 0, levelById(G.level).rating));
  }
}
/** Who resigned: the side that didn't win, named as the page names it. */
function loserName(g) {
  const red = g.result.winner === "black";
  if (inRoom()) return (D.red === mySeat()) === red ? "You" : partnerName();
  if (g.mode === "engine") return (g.red === 0) === red ? "You" : "The computer";
  return red ? "Red" : "Black";
}
function headline(g) {
  const r = g.result;
  if (!r) return "";
  if (!r.winner) return "A draw";
  if (inRoom()) return r.winner === (D.red === mySeat() ? "red" : "black") ? "You win" : `${partnerName()} wins`;
  if (g.mode === "engine") return r.winner === (g.red === 0 ? "red" : "black") ? "You win" : "The computer wins";
  return r.winner === "red" ? "Red wins" : "Black wins";
}
/** Your colour, when you're one side: "red", "black", or null (two players on one phone). */
const yourColour = () => (inRoom() ? (D.red === mySeat() ? "red" : "black") : G.mode === "engine" ? (G.red === 0 ? "red" : "black") : null);
/**
 * The moves where you lost most, by the engine's evaluation: each position of the game searched once (REVIEW), a move's
 * cost the score before it less the score after it, both from the mover's side (a mate counted as ten pawns, so one
 * missed mate doesn't drown the rest). Kept in the game (review), so a reload or a partner watching shows it as it is.
 */
let reviewing = null;
async function review() {
  const g = cur(), all = X.movesOf(g);
  if (!g.result || inRoom() || IN_FRAME || reviewing || g.review?.at === all.length || all.length < 2) return;
  const key = `${g.start}|${g.moves}`;
  reviewing = { done: 0, of: all.length + 1 };
  drawEnd();
  try {
    if (!(await ensureEngine())) return;
    const p = played(), scores = [], bests = [];
    for (let i = 0; i <= all.length; i++) {
      if (!X.legalMoves(p.positions[i]).length) { scores.push(-1000); bests.push(null); }       // no move left loses
      else {
        const r = await engine.search({ fen: g.start, moves: all.slice(0, i), limit: REVIEW.limit, options: FULL });
        const l = r.lines[0], v = l?.mate != null ? (l.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, l?.cp ?? 0));
        scores.push(v); bests.push(r.best);
      }
      if (`${cur().start}|${cur().moves}` !== key) return;        // taken back meanwhile
      reviewing.done = i + 1;
      drawEnd();
    }
    const you = yourColour(), items = [];
    p.moves.forEach((m, i) => {
      const mover = p.positions[i].red ? "red" : "black";
      if (you && mover !== you) return;
      const loss = scores[i] + scores[i + 1];
      if (loss < 50 || !bests[i] || bests[i] === m.uci) return;
      const b = X.parseUci(bests[i]);
      items.push({ ply: i, move: m.uci, better: b ? bests[i] : null, loss, mover });
    });
    items.sort((a, b) => b.loss - a.loss);
    G = { ...G, review: { at: all.length, items: items.slice(0, 3) } };
    save();
  } catch (e) { console.error(e); toast("The review didn't finish"); engine.stop(); engineUp = false; }
  finally { reviewing = null; drawEnd(); }
}
const lossWords = cp => (cp >= 900 ? "the game" : `about ${(cp / 100).toFixed(1)}`);
function showEnd() {
  if (!cur().result || IN_FRAME) return;
  drawEnd();
  if (!$("endDlg").open) $("endDlg").showModal();
  review();
}
function drawEnd() {
  const g = cur();
  if (!g.result) return;
  $("endHead").textContent = headline(g);
  const n = Math.ceil(X.movesOf(g).length / 2), o = openingOf(played().positions);
  const how = g.result.why === "resigned" ? `${loserName(g)} resigned` : WHY[g.result.why] || "";
  const lines = [`<p>${esc(how)}, after ${n} move${n === 1 ? "" : "s"}.${o ? ` The opening: ${esc(opts.script === "simplified" ? o.sc : o.tc)} (${esc(o.py)}), ${esc(o.en)}.` : ""}</p>`];
  if (!inRoom() && g.mode === "engine") {
    const lv = levelById(g.level), best = read(BEST, 0);
    lines.push(`<p>Against ${esc(lv.name)} (${rating(lv.rating)}).${best ? ` The strongest you've beaten: ${esc(LEVELS.filter(l => l.rating <= best).pop()?.name || "")} (${rating(best)}).` : ""}</p>`);
  }
  const r = g.review?.at === X.movesOf(g).length ? g.review : null, p = played();
  const named = (i, uci) => { const m = X.parseUci(uci); const n = X.notate(p.positions[i], m.from, m.to, opts.script); return `${n.cn} <span class="rv-wxf">${esc(n.wxf)}</span>`; };
  if (r) {
    lines.push(`<h4 class="rv-sub">${yourColour() ? "Where you lost most" : "Where each side lost most"}</h4>`);
    if (!r.items.length) lines.push(`<p>No move ${yourColour() ? "of yours " : ""}gave away half a soldier or more, by the engine's reckoning.</p>`);
    else lines.push(`<ol class="rv-review">${r.items.map(it => `<li><b>${Math.floor(it.ply / 2) + 1}${it.ply % 2 ? "…" : "."} ${named(it.ply, it.move)}</b>${yourColour() ? "" : ` (${cap(it.mover)})`}: ${lossWords(it.loss)} given away; better was <b>${named(it.ply, it.better)}</b>.</li>`).join("")}</ol>`);
  } else if (reviewing) lines.push(`<p class="rv-reviewing"><span class="rv-wait"></span>Reviewing the game: ${reviewing.done} of ${reviewing.of} positions</p>`);
  $("endBody").innerHTML = lines.join("");
  $("endBody").querySelector(".rv-wait")?.append(sextant());
  $("endAgain").hidden = inRoom();
}

// ---------- drawing ----------
const PIECE_EN = ["", "general", "advisor", "elephant", "horse", "chariot", "cannon", "soldier"];
const board = mountBoard($("board"), {
  onMove,
  legal: from => {
    const g = cur(), seat = X.waitingOn(g);
    if (seat === null || !handSeats().includes(seat) || thinking || IN_FRAME) return [];
    const pos = played().positions.at(-1);
    return X.movesFrom(pos, from).map(m => m.to);
  },
  // a tap on one of the other side's pieces, on your move: where it could go and what it guards, drawn and said
  reach: p => X.reachOf(played().positions.at(-1), p),
  onPeek: (p, r) => {
    if (p == null) return;
    const v = played().positions.at(-1).b[p], takes = r.moves.filter(q => played().positions.at(-1).b[q]).length;
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    toast(`${v > 0 ? "Red" : "Black"}'s ${PIECE_EN[Math.abs(v)]} ${X.charOf(v, opts.script)}: ${r.moves.length ? `${n(r.moves.length, "point", "points")} to go to${takes ? `, ${n(takes, "of them a take", "of them takes")}` : ""}` : "nowhere to go"}; ${r.guards.length ? `guards ${n(r.guards.length, "piece", "pieces")}` : "guards nothing"}`, 3600);
  },
});
/** The general's disc of a side, small, before a seat's name. */
const tag = red => discSvg(red ? X.GENERAL : -X.GENERAL, opts.script, { size: 1.15 });
function seatLabel(red) {
  const g = cur(), you = inRoom() ? (D.red === mySeat()) === red : g.mode === "engine" ? (g.red === 0) === red : null;
  if (inRoom()) return you ? "You" : partnerName();
  if (g.mode === "engine") { const lv = levelById(g.level); return you ? "You" : `${lv.name} · ${rating(lv.rating)}`; }
  return red ? "Red" : "Black";
}
/** The pieces each side has taken, as small characters. */
function captures(p) {
  const out = { red: [], black: [] };
  p.moves.forEach((m, i) => { if (m.capture) { const v = p.positions[i].b[m.to]; out[v > 0 ? "black" : "red"].push(v); } });
  for (const k of ["red", "black"]) out[k].sort((a, b) => Math.abs(a) - Math.abs(b));
  return out;
}
/** A seat's strip: its general's disc, who sits there (the far seat) or what's said (the near one), what it has taken. */
function drawSeat(el, red, p, words = null) {
  const g = cur(), toMove = !g.result && p.positions.at(-1).red === red;
  const taken = captures(p)[red ? "red" : "black"];
  const busyHere = thinking && !inRoom() && g.mode === "engine" && (g.red !== 0) === red;   // the computer's seat, while it thinks
  el.innerHTML = `<span class="rv-who${toMove ? " turn" : ""}">${tag(red)}${words ?? "<b></b>"}</span><span class="rv-taken" aria-label="Taken">${taken.map(v => `<i class="${v > 0 ? "red" : "black"}">${pieceMark(v, opts.script)}</i>`).join("")}</span>`;
  if (words === null) el.querySelector("b").textContent = seatLabel(red);
  el.querySelector(".rv-wait")?.append(sextant());
  if (busyHere) { const s = document.createElement("span"); s.className = "rv-thinking"; s.append(sextant(), "thinking"); el.querySelector(".rv-who").append(s); }
}
/** A move in the engine's words named from a position: Chinese notation, and WXF's beside it. */
function named(pos, uci) {
  const m = X.parseUci(uci), n = m ? X.notate(pos, m.from, m.to, opts.script) : null;
  return `<b>${esc(n?.cn || uci)}</b> <span class="rv-wxf">${esc(n?.wxf || "")}</span>`;
}
/** "a", "a or b", "a, b or c". */
const either = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
/** A move's number as the list writes it: 12. for Red's, 12… for Black's. */
function numbered(ply) {
  const startRed = X.parseFen(cur().start).red, n = Math.floor((ply + (startRed ? 0 : 1)) / 2) + 1;
  return `${n}${(ply % 2 === 0) === startRed ? "." : "…"}`;
}
function sayLine(p) {
  const g = cur(), pos = p.positions.at(-1), seat = X.waitingOn(g);
  if (g.result) return `<b>${esc(headline(g))}</b> · ${esc(g.result.why === "resigned" ? `${loserName(g)} resigned` : WHY[g.result.why] || "")}`;
  if (looking && g.lesson) {
    const L = g.lesson, m = p.moves[L.ply], n = X.notate(p.positions[L.ply], m.from, m.to, opts.script);
    return `Before ${esc(numbered(L.ply))} ${esc(n.cn)}: the coach's ${L.better.length > 1 ? "moves" : "move"} in green`;
  }
  const check = X.inCheck(pos) ? `<b class="rv-check">Check</b> (將軍) · ` : "";
  if (hinting === keyOf(g)) return `${check}<span class="rv-wait"></span>The coach is looking…`;
  const h = coachOn() ? liveHint(g) : null;
  if (h) return `${check}${h.auto ? "Coach" : "Hint"}: ${either(h.moves.map(u => named(pos, u)))} · ${esc(evalWords(h, pos.red))}`;
  const o = openingOf(p.positions), opening = o ? ` · <span class="rv-open">${esc(opts.script === "simplified" ? o.sc : o.tc)} ${esc(o.en)}</span>` : "";
  if (inRoom()) return `${check}${seat === mySeat() ? "Your move" : `${esc(partnerName())} to move`}${opening}`;
  if (g.mode === "two") return `${check}${pos.red ? "Red" : "Black"} to move${opening}`;
  return `${check}${seat === 0 ? "Your move" : thinking ? "The computer is thinking" : "The computer's move"}${opening}`;
}
/** What the engine's score says, in words, for the side to move (`red`): a hint is always for the side to move. */
function evalWords(h, red) {
  const g = cur(), you = g.mode === "engine" && !inRoom() ? (g.red === 0) === red : inRoom() ? (D.red === mySeat()) === red : null;
  const mover = you === true ? "you" : red ? "Red" : "Black", other = you === true ? (inRoom() ? partnerName() : "the computer") : red ? "Black" : "Red";
  if (h.mate != null) { const n = Math.abs(h.mate), who = h.mate > 0 ? mover : other; return `${cap(who)} ${who === "you" ? "mate" : "mates"} in ${n}`; }
  const cp = h.cp ?? 0, a = Math.abs(cp), side = cp > 0 ? mover : other, sign = cp > 0 ? "+" : cp < 0 ? "−" : "";
  const how = a < 30 ? "about level" : a < 100 ? `a little better for ${side}` : a < 250 ? `better for ${side}` : a < 600 ? `much better for ${side}` : `winning for ${side}`;
  return `${how} (${sign}${(a / 100).toFixed(1)})`;
}
const cap = s => s[0].toUpperCase() + s.slice(1);
function drawList(p) {
  const list = $("list"), g = cur(), startRed = X.parseFen(g.start).red;
  const marks = coachOn() ? g.marks || {} : {};
  const items = p.moves.map((m, i) => {
    const n = X.notate(p.positions[i], m.from, m.to, opts.script), red = (i % 2 === 0) === startRed, mark = marks[i] || "";
    return `<li class="${red ? "red" : "black"}${i === p.moves.length - 1 ? " last" : ""}${mark ? " faulted" : ""}">${red ? `<small>${Math.floor(i / 2) + 1}.</small>` : ""}<span><b>${esc(n.cn)}${mark ? `<em>${mark}</em>` : ""}</b><i>${esc(n.wxf)}</i></span></li>`;
  });
  list.innerHTML = items.join("") || `<li class="rv-none">${g.mode === "two" ? "Red moves first" : "Red moves first: 紅先"}</li>`;
  list.scrollLeft = list.scrollWidth;
  list.scrollTop = list.scrollHeight;
}
function drawBar() {
  const bar = $("bar"), g = cur();
  bar.replaceChildren();
  const button = (text, fn, cls = "", disabled = false) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `rv-go ${cls}`.trim(); b.textContent = text; b.disabled = disabled;
    b.addEventListener("click", fn);
    bar.append(b);
    return b;
  };
  if (IN_FRAME) return;
  if (inRoom()) {
    if (g.result) button("Back to solo", () => together.leave(), "quiet");
    else button("Resign", resign, "quiet");
    return;
  }
  // two buttons at most, Take back always first: held sideways the column has room for no more
  const yours = handSeats().includes(X.waitingOn(g));
  const retry = !g.result && g.mode === "engine" && !engineUp && X.waitingOn(g) === 1 && !thinking;
  button("Take back", takeBack, "quiet", !takeBackCount());
  if (g.result) button("New game", newGame);
  else if (retry) button("Retry", () => kick());
  else if (opts.coach === "hints" || opts.coach === "check") button("Hint", () => hint(), "quiet", !yours || thinking || hinting === keyOf(g) || !!liveHint(g));
}
/** The coach's word on your last move, under Check and Always, in a room kept for it so the page holds its size as it
 *  speaks and falls quiet; Show puts the board back as it stood before the move, the better moves drawn on it. */
function drawCoach(p) {
  const el = $("coach"), g = cur(), on = checking() && !g.result;
  el.hidden = !on;
  if (!on) return;
  const L = g.lesson, m = L ? p.moves[L.ply] : null;
  if (!m) { el.replaceChildren(); return; }
  const before = p.positions[L.ply], other = g.mode === "two" ? (before.red ? "Black" : "Red") : "the computer";
  const worth = L.loss < 150 ? "a soldier's worth" : `${(L.loss / 100).toFixed(1)} soldiers' worth`;
  const what = L.allows ? `lets ${other} mate in ${L.allows}` : L.missed ? `misses a mate in ${L.missed}` : L.loss >= 900 ? "gives the game away" : `gives away about ${worth}`;
  // the best named in full, the others as good counted (Show draws them all): three names in both notations take a
  // phone's two lines and more
  const n = X.notate(before, m.from, m.to, opts.script), more = L.better.length - 1;
  el.innerHTML = `<b class="rv-miss">Coach</b> ${esc(numbered(L.ply))} <b>${esc(n.cn)}${L.mark}</b> ${what}; better was ${named(before, L.better[0])}${more ? `, or ${more === 1 ? "one more" : `${more} more`} as good` : ""}. <button type="button" class="link rv-look">${looking ? "Back to the game" : "Show"}</button>`;
  el.scrollTop = 0;
  el.querySelector(".rv-look").addEventListener("click", () => { looking = !looking; render(); });
}
/** The point of a general in check in a position, or −1. */
function checkPoint(pos) {
  if (X.inCheck(pos)) for (let q = 0; q < 90; q++) if (pos.b[q] === (pos.red ? X.GENERAL : -X.GENERAL)) return q;
  return -1;
}
const arrowOf = (uci, bad = false) => ({ ...X.parseUci(uci), bad });
function render() {
  const p = played(), g = cur(), L = checking() ? g.lesson : null;
  if (looking && !(L && p.moves[L.ply])) looking = false;
  if (looking) {
    // before the faulted move: the coach's better moves and yours, nothing to play
    const before = p.positions[L.ply];
    board.draw({ pos: before, bottomRed: bottomRed(), facing: opts.facing, script: opts.script, last: p.moves[L.ply - 1] || null,
      arrows: [...L.better.map(u => arrowOf(u)), arrowOf(L.move, true)], hand: false, check: checkPoint(before), slide: false });
  } else {
    const pos = p.positions.at(-1), hand = !IN_FRAME && !g.result && handSeats().includes(X.waitingOn(g)) && !thinking, h = coachOn() ? liveHint(g) : null;
    board.draw({ pos, bottomRed: bottomRed(), facing: opts.facing, script: opts.script, last: p.moves.at(-1), arrows: h ? h.moves.map(u => arrowOf(u)) : [], hand, check: checkPoint(pos), slide });
  }
  const red = bottomRed();
  drawSeat($("far"), !red, p);
  drawSeat($("near"), red, p, `<span class="rv-say">${sayLine(p)}</span>`);
  drawCoach(p);
  drawList(p);
  drawBar();
}

// ---------- the rules ----------
function rules() {
  const s = opts.script, d = v => discSvg(v, s, { size: 2.2 });
  const piece = (v, name, py, en, how, pic = "") => `<div class="rv-rule-piece"><span class="rv-pair">${d(v)}${d(-v)}</span><div><b>${name}</b> <i>${py}</i> · ${en}<p>${how}</p>${pic ? `<figure class="rv-figure">${pic}</figure>` : ""}</div></div>`;
  const R = X.GENERAL, H = X.HORSE, E = X.ELEPHANT, C = X.CANNON, P = X.SOLDIER, K = X.CHARIOT;
  const pics = {
    general: diagramSvg({ cols: 3, rows: 6, pieces: [[1, 0, -R], [1, 3, K], [1, 5, R]], dots: [[1, 1], [1, 2], [1, 4]], crosses: [[0, 3], [2, 3]], label: "The chariot between the generals can move only along their file" }, s),
    elephant: diagramSvg({ cols: 5, rows: 5, pieces: [[2, 2, E], [1, 1, -P]], dots: [[4, 0], [0, 4], [4, 4]], crosses: [[0, 0]], label: "The elephant's eye blocked: not to the top left" }, s),
    horse: diagramSvg({ cols: 5, rows: 5, pieces: [[2, 2, H], [2, 1, -P]], dots: [[0, 1], [4, 1], [0, 3], [4, 3], [1, 4], [3, 4]], crosses: [[1, 0], [3, 0]], label: "The horse's leg hobbled: not the two points over it" }, s),
    cannon: diagramSvg({ cols: 6, rows: 3, pieces: [[0, 1, C], [2, 1, -P], [5, 1, -K]], dots: [[1, 1], [0, 0], [0, 2]], crosses: [[2, 1]], rings: [[5, 1]], label: "The cannon takes over one screen" }, s),
  };
  return `
<p>Two armies face each other across a river, on the points where the lines cross. Red moves first (紅先), then each side in turn. You win by checkmating the other general, or by leaving the other side with no move at all.</p>
<h4>The pieces</h4>
${piece(X.GENERAL, "帥 / 將", "shuài / jiàng", "General", "One point along a line, inside the palace (九宮, the nine points with the cross). The two generals may never face each other on an open file (將帥不能照面): a move that leaves them facing is illegal, so a piece alone between them may move only along their file.", pics.general)}
${piece(X.ADVISOR, "仕 / 士", "shì", "Advisor", "One point diagonally, inside the palace.")}
${piece(X.ELEPHANT, "相 / 象", "xiàng", "Elephant", "Exactly two points diagonally, never across the river. If the point in between is occupied, it can't go that way (塞象眼, blocking the elephant's eye).", pics.elephant)}
${piece(X.HORSE, "傌 / 馬", "mǎ", "Horse", "One point along a line, then one diagonally outward. If the point next to it in that direction is occupied, it can't go that way (蹩馬腿, hobbling the horse's leg).", pics.horse)}
${piece(X.CHARIOT, "俥 / 車", "jū", "Chariot", "Any distance along a line, like a rook. The strongest piece.")}
${piece(X.CANNON, "炮 / 砲", "pào", "Cannon", "Moves like a chariot, but captures only by jumping over exactly one piece of either side on the way (炮架, the cannon's screen).", pics.cannon)}
${piece(X.SOLDIER, "兵 / 卒", "bīng / zú", "Soldier", "One point forward. Once across the river (過河兵) it may also step sideways; never back.")}
<h4>How a game ends</h4>
<p><b>Checkmate</b> (將死): the general is attacked (將軍, check) and nothing can save it. <b>No move left</b> (困斃): the side that can't move loses; in Xiangqi there is no stalemate draw.</p>
<p><b>Repetition</b>: the same position for the third time ends the game. If one side gave check with every move since it first stood, that side loses (長將, perpetual check, is forbidden); otherwise it's a draw. <b>Sixty moves</b> each without a capture (自然限著) are a draw, and so is a board where neither side has a chariot, horse, cannon or soldier left.</p>
<h4>Reading the moves</h4>
<p>A move is the piece, the file it stands on, how it moves and where to: <b>炮二平五</b> is "cannon on file two across to file five", the commonest opening (當頭炮, the central cannon). Each side counts files from its own right, Red in Chinese numerals (一 to 九), Black in figures (1 to 9). 進 (jìn) is forward, 退 (tuì) back, 平 (píng) across. A piece moving straight along its file gives the ranks moved (俥九進一: one forward), a horse, elephant or advisor the file it lands on (傌二進三). Two like pieces on one file are front and rear (前, 後). WXF writes the same in letters: K A E H R C P, + forward, − back, = across (C2=5).</p>
<p>The river reads 楚河 漢界, "the Chu river, the Han border", after the war between the states of Chu and Han that founded the Han dynasty.</p>
<h4>The openings</h4>
<p>The names a club player gives the first moves, shown as you play them (each counts mirrored too: 炮八平五 is as central as 炮二平五):</p>
<ul class="rv-openings">${OPENINGS.map(o => `<li><b>${s === "simplified" ? o.sc : o.tc}</b> <i>${o.py}</i> · ${o.en}: ${openingMoves(o.line)}</li>`).join("")}</ul>
<h4>The computer</h4>
<p>The computer player is Fairy-Stockfish (GPL v3: <a href="vendor/fairy-stockfish/Copying.txt" target="_blank" rel="noopener">licence</a>, <a href="https://github.com/fairy-stockfish/Fairy-Stockfish" target="_blank" rel="noopener">source</a>), playing at the strength you choose in the menu. It's also the coach (Menu, Coach): Hints shows its strongest moves when you ask, as arrows, with what it makes of the position; Check adds a word after a move of yours that gave a good deal away, a mistake (?) or a blunder (??), with the better move, and Show puts the board back to see it; Always shows the strongest moves at each of yours without asking.</p>`;
}

/** An opening's moves in Chinese notation, from the start. */
function openingMoves(line) {
  let pos = X.parseFen();
  return line.split(" ").map((u, i) => { const m = X.parseUci(u), n = X.notate(pos, m.from, m.to, opts.script); pos = X.after(pos, m.from, m.to); return `${i % 2 ? "" : `${i / 2 + 1}. `}${n.cn}`; }).join(" ");
}

// ---------- the course ----------
// Learn (the header): the course from the rules to the openings (river-course.js, drawn by river-learn.js); its last
// lesson starts a game against Beginner, you as Red. The Rules sheet, every rule on one page, opens from the course's
// map and the menu.
const course = createCourse({
  script: () => opts.script,
  inFrame: IN_FRAME,
  onPlay: () => { Object.assign(opts, { mode: "engine", level: "1", colour: "red" }); saveOpts(); newGame(); },
});
function showRules() { $("rulesBody").innerHTML = rules(); $("rulesDlg").showModal(); }

// ---------- the puzzle rush ----------
// Menu, Puzzle rush: Xiangqi tactics against the clock (river-rush-ui.js), on a board of its own in the game's place; the
// game waits as it was (the computer's move too) and comes back with The game.
const rush = createRush({
  script: () => opts.script,
  onOpen: () => { $("endDlg").close(); render(); },
  onClose: () => { render(); kick(); advise(); },
});

// ---------- the menu ----------
let pick = null;                                                // the next game's choices while the menu is open
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (rush.on) {                                                // the rush's own: its runs, your rating, your bests
    rush.menu(body);
    if (!IN_FRAME) part(body, "play").append(action("The rules on one page", showRules, "link"));
    part(body, "settings").append(choice("Pieces", [["characters", "Characters"], ["pictures", "Pictures"]], opts.pieces, setPieces),
      choice("Characters", [["traditional", "Traditional"], ["simplified", "Simplified"]], opts.script, setScript));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick = { mode: opts.mode, level: opts.level, colour: opts.colour };
  if (inRoom()) {
    part(body, "together").append(line(`A match with ${partnerName()}: you play ${D.red === mySeat() ? "Red" : "Black"}.`),
      ...(cur().result ? [] : [action("Resign", resign, "")]), action("Back to solo", () => together.leave(), "link"));
  } else {
    const g = cur();
    part(body, "play").append(action("New game", () => {
      if (!G.result && X.movesOf(G).length > 1 && !confirm("Start a new game? This one isn't finished.")) return;
      Object.assign(opts, pick); saveOpts(); newGame();
    }, "primary"), ...(!g.result && X.movesOf(g).length ? [action("Resign", resign, "link")] : []));
    const cp = progress();
    part(body, "play").append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Xiangqi, from the rules", () => course.open()),
      action("Puzzle rush", () => { closeDialogs(); rush.open(); }), action("The rules on one page", showRules, "link"));
    part(body, "content").append(
      choice("Opponent", [["engine", "Computer"], ["two", "Two players"]], pick.mode, v => { pick.mode = v; }),
      choice("Strength", LEVELS.map(l => [l.id, `${l.name} ${rating(l.rating)}`]), pick.level, v => { pick.level = v; }),
      choice("You play", [["red", "Red"], ["black", "Black"], ["either", "Either"]], pick.colour, v => { pick.colour = v; }));
  }
  const set = part(body, "settings");
  if (!inRoom()) set.append(choice("Coach", COACH, opts.coach, setCoach));
  set.append(
    toggle("Facing each other", opts.facing, on => { opts.facing = on; saveOpts(); render(); }),
    choice("Pieces", [["characters", "Characters"], ["pictures", "Pictures"]], opts.pieces, setPieces),
    choice("Characters", [["traditional", "Traditional"], ["simplified", "Simplified"]], opts.script, setScript));
  const best = read(BEST, 0), rec = read(RECORD, {});
  const record = LEVELS.filter(l => rec[l.id]).map(l => `${l.name} ${rec[l.id].w}–${rec[l.id].d}–${rec[l.id].l}`).join(", ");
  part(body, "about").append(line(best ? `Strongest beaten: ${LEVELS.filter(l => l.rating <= best).pop()?.name} (${rating(best)})` : "No computer level beaten yet"),
    ...(record ? [line(`Won, drawn, lost: ${record}`)] : []));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function closeDialogs() { for (const d of document.querySelectorAll("dialog[open]")) d.close(); }
function setScript(v) { opts.script = v; saveOpts(); render(); rush.redraw(); }
function setPieces(v) { opts.pieces = v; setPictures(v === "pictures"); saveOpts(); render(); rush.redraw(); }

// ---------- messages ----------
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- together ----------
const partnerName = () => {
  const other = inRoom() ? seatsOf(D).find(([id]) => id !== together.room.uid)?.[1] : null;
  return other?.name || together.partner()?.name || "Your partner";
};
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
async function moveTogether(uci) {
  const seat = mySeat();
  const ok = await together.act(d => {
    const next = X.act(X.fromRoom(d), seat, { move: uci });
    if (!next) return false;
    Object.assign(d, { moves: next.moves, result: next.result || null });
  });
  if (!ok) render();
}
let joining = null;                                              // the rete while you sit down, until the room's game is drawn
const seated = () => { joining?.(); joining = null; };
const together = createTogether({
  game: "river",
  app: APP,
  toast,
  askName,
  valid: d => d?.v === 1 && typeof d.red === "number",
  fresh: players => ({ ...X.newGame({ red: Math.random() < 0.5 ? 0 : 1 }), app: APP, created: Date.now(), players }),
  onState: d => {
    seated();
    const before = D ? X.movesOf(D).length : -1;
    D = { ...X.fromRoom(d), players: d.players, created: d.created || 0, asked: d.asked || null };
    gen++;
    slide = before >= 0 && X.movesOf(D).length === before + 1;
    render();
    slide = false;
    if (D.result) { drawEnd(); if (!$("endDlg").open) $("endDlg").showModal(); }
  },
  onPresence: () => render(),
  onLeave: () => { D = null; seated(); closeDialogs(); render(); kick(); },
  result: d => {
    if (!d?.result || !together.room) return null;
    const slot = seatsOf(d).find(([id]) => id === together.room.uid)?.[1].slot ?? 0;
    return { match: `${d.created || 0}`, score: null, won: d.result.winner === (d.red === slot ? "red" : "black"), coop: false };
  },
});
// ---------- wiring ----------
bindSwitcher($("appsBtn"), "river");
document.querySelector(".rv-mark").innerHTML = APPS.find(a => a.id === "river")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
document.addEventListener("click", e => { if (e.target.closest("[data-rules]")) showRules(); });
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("rulesDlg").addEventListener("click", e => { if (e.target === $("rulesDlg")) $("rulesDlg").close(); });
$("endBoard").addEventListener("click", () => $("endDlg").close());
$("endAgain").addEventListener("click", () => { $("endDlg").close(); newGame(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
addEventListener("resize", () => render());
// for the tests and the look
window.__river = { get game() { return cur(); }, get engineUp() { return engineUp; }, get judging() { return judging; }, onMove, newGame, takeBack, hint, setCoach, X, course, rush };

render();
const code = roomInAddress();
if (!code && rush.boot()) {
  // the rush was open: it takes the page again, the game waiting under it
} else if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) { seated(); kick(); } });
} else if (!IN_FRAME && G.mode === "engine" && !G.result) {
  if (X.waitingOn(G) === 1) kick();                              // the computer's move: it loads the engine, the rete showing
  else engine.start().then(() => { engineUp = true; render(); advise(); }, () => {});   // yours: it loads quietly meanwhile
} else advise();
