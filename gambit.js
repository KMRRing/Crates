// Gambit: chess against Stockfish at a strength you choose, two players on one phone, or a match with your partner. The
// rules are chess.js's (gambit-rules.js keeps the game as plain JSON), the board chess-board.js's, the pieces Rush's;
// the computer's moves, the coach and the review at the end are Stockfish's (uci.js, in a worker, loaded only when a
// game against it needs it; the coach's judgement is uci-coach.js's). The game in play is kept as it changes
// (gambit:game) and picked up on reload.
import * as G from "./gambit-rules.js";
import { mountBoard } from "./chess-board.js";
import { PIECES } from "./chess-pieces.js";
import { LEVELS, levelById, HINT, REVIEW } from "./gambit-levels.js";
import { openingOf } from "./gambit-openings.js";
import { Engine, WORKERS, levelMove } from "./uci.js";
import { COACH, isCoach, createCoach } from "./uci-coach.js";
import { Chess } from "./vendor/chess.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { busy, sextant } from "./loading.js";

const $ = id => document.getElementById(id);
const GAME = "gambit:game", OPTS = "gambit:opts", BEST = "gambit:best", RECORD = "gambit:record";
const APP = 1;
const PACE = 700;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rating = n => n.toLocaleString("en-GB");
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- settings and the game ----------
let opts = { mode: "engine", level: "3", colour: "white", coords: true, coach: "hints", ...read(OPTS, {}) };
if (!isCoach(opts.coach)) opts.coach = "hints";
const saveOpts = () => write(OPTS, opts);
/**
 * the game in play: gambit-rules.js's state and the page's: { v, start, moves, result, white, mode ("engine" or "two"),
 * level, created, hint, lesson, marks, review, counted }. With the computer, seat 0 is you and 1 the computer, `white`
 * the seat playing White; two players on one phone are seat 0 (White) and 1 (Black). hint: the coach's strongest moves
 * for the position it was asked in ({ at, moves, cp, mate, auto }: auto, its advice unasked); lesson: its word on your
 * last move, if that gave a good deal away; marks: ? and ?? by the moves it faulted; review: the end's look back, once
 * made; counted: the game has gone into your record.
 */
function freshGame() {
  const white = opts.mode === "two" ? 0 : opts.colour === "black" ? 1 : opts.colour === "either" ? (Math.random() < 0.5 ? 0 : 1) : 0;
  return { ...G.newGame({ white }), mode: opts.mode === "two" ? "two" : "engine", level: levelById(opts.level).id, created: Date.now(), hint: null, lesson: null, marks: {}, review: null, counted: false };
}
function loadGame() {
  const g = G.fromRoom(read(GAME, null));
  if (!g || !G.replay(g).ok) return freshGame();
  // a hint kept before the coach showed its strongest moves had one move: it reads as a list of one
  const hint = g.hint ? { ...g.hint, moves: g.hint.moves || (g.hint.move ? [g.hint.move] : []) } : null;
  return { ...g, mode: g.mode === "two" ? "two" : "engine", level: levelById(g.level).id, created: g.created || Date.now(), hint, lesson: g.lesson || null, marks: g.marks || {}, review: g.review || null, counted: !!g.counted };
}
let S = loadGame();
const save = () => { if (!IN_FRAME && !together.room) write(GAME, S); };

let D = null;                                                    // the room's game, at a table together
const inRoom = () => !!together.room && !!D;
const cur = () => (inRoom() ? D : S);
const mySeat = () => (inRoom() ? seatsOf(D).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
const handSeats = () => (inRoom() ? [mySeat()] : S.mode === "two" ? [0, 1] : [0]);
/** Whether White sits at the bottom of the board. */
const bottomWhite = () => (inRoom() ? D.white === mySeat() : S.mode === "two" ? true : S.white === 0);
/** Your colour, when you're one side: "white", "black", or null (two players on one phone). */
const yourColour = () => (inRoom() ? (D.white === mySeat() ? "white" : "black") : S.mode === "engine" ? (S.white === 0 ? "white" : "black") : null);

let replayed = null;
const played = () => {
  const g = cur(), key = `${g.start}|${g.moves}`;
  if (replayed?.key !== key) replayed = { key, p: G.replay(g) };
  return replayed.p;
};

// ---------- the engine ----------
const engine = new Engine(WORKERS.stockfish);
const FULL = { MultiPV: 1, "Skill Level": 20, UCI_LimitStrength: false };     // the engine unlimited: the review
const coach = createCoach(engine, { limit: HINT.limit, alone: HINT.alone });
let engineUp = false;
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
function onMove(uci) {
  const g = cur(), seat = G.waitingOn(g);
  if (seat === null || !handSeats().includes(seat)) return;
  if (inRoom()) { moveTogether(uci); return; }
  const before = G.movesOf(S), next = G.act(S, seat, { move: uci });
  if (!next) { render(); return; }
  S = { ...next, hint: null, lesson: null };
  if (checking()) checkMove(before, G.movesOf(S).at(-1));
  afterMove();
}
function kick() { setTimeout(think, 0); }
async function think() {
  if (IN_FRAME || inRoom() || S.mode !== "engine" || S.result || G.waitingOn(S) !== 1 || thinking || isPaused()) return;
  const g0 = gen, t0 = performance.now();
  thinking = true;
  render();
  try {
    if (!(await ensureEngine())) { thinking = false; render(); return; }
    await judging;                                                // the coach's word on your move comes before the reply
    const { move } = await levelMove(engine, levelById(S.level), { fen: S.start, moves: G.movesOf(S) });
    await sleep(Math.max(0, PACE - (performance.now() - t0)));
    while (isPaused()) await sleep(200);
    thinking = false;
    if (g0 !== gen || inRoom()) { render(); kick(); return; }
    const next = move && G.act(S, 1, { move });
    if (!next) throw new Error(`the engine's move ${move} isn't legal here`);
    S = { ...next, hint: null };
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
const coachOn = () => !inRoom() && !IN_FRAME && opts.coach !== "off";
const checking = () => coachOn() && (opts.coach === "check" || opts.coach === "on");
const always = () => coachOn() && opts.coach === "on";
const keyOf = g => `${g.start}|${g.moves}`;
/** The coach's strongest moves for the position on the board, if it has given them. */
const liveHint = g => (g.hint && g.hint.at === G.movesOf(g).length && g.hint.moves?.length ? g.hint : null);
/** The strongest moves for the side to move, on the board as arrows with what the engine makes of the position: asked
 *  for (Hint), or the coach's advice unasked (auto, Always). */
async function hint(auto = false) {
  const g = cur(), key = keyOf(g);
  if (!coachOn() || hinting === key || thinking || g.result || !handSeats().includes(G.waitingOn(g))) return;
  const at = G.movesOf(g).length, g0 = gen;
  hinting = key;
  render();
  try {
    if (!(await (auto ? quietEngine() : ensureEngine()))) return;
    const lines = await coach.analyse(g.start, G.movesOf(g));
    if (g0 !== gen || !lines.length) return;
    const moves = coach.strongest(lines), top = lines.find(l => l.pv[0] === moves[0]);
    S = { ...S, hint: { at, moves, cp: top.cp ?? null, mate: top.mate ?? null, auto } };
    save();
  } catch (e) { console.error(e); if (!auto) toast("The hint didn't come: try again"); engine.stop(); engineUp = false; }
  finally { if (hinting === key) hinting = null; render(); }
}
/** At each of your moves, under Check and Always: the coach looks at the position while you think (Always shows what
 *  it finds), so its word after your move comes quickly. */
function advise() {
  const g = cur();
  if (!checking() || g.result || thinking || !handSeats().includes(G.waitingOn(g))) return;
  if (always()) { if (!liveHint(g)) hint(true); return; }
  quietEngine().then(ok => { if (ok && keyOf(cur()) === keyOf(g)) coach.analyse(g.start, G.movesOf(g)).catch(() => {}); });
}
/**
 * Your move judged against the position's analysis (uci-coach.js's check): a mistake or a blunder is marked in the list
 * and gets the coach's word, the better moves with it, until your next move. The computer's reply waits for it.
 */
let judging = Promise.resolve();                                // the check of your last move, while it runs
function checkMove(before, move) {
  const start = S.start, ply = before.length;
  judging = (async () => {
    if (!(await quietEngine())) return;
    const c = await coach.check(start, before, move);
    const now = G.movesOf(S);
    if (!c || S.start !== start || now[ply] !== move || now.slice(0, ply).join(" ") !== before.join(" ")) return;   // taken back meanwhile
    const marks = { ...S.marks };
    if (c.mark) marks[ply] = c.mark; else delete marks[ply];
    // the word is on the last move made by hand: with the computer, its reply may have come since; two on one phone,
    // the other's move would be a newer one, with its own check coming
    const latest = now.length - ply - 1 <= (S.mode === "two" ? 0 : 1);
    const lesson = c.mark ? { ply, move, better: c.strongest, mark: c.mark, loss: c.loss, missed: c.missed, allows: c.allows } : null;
    S = { ...S, marks, ...(latest ? { lesson } : {}) };
    save();
    render();
  })().catch(e => { console.error(e); engine.stop(); engineUp = false; });
}
/** The marks and the word of moves no longer in the game, after a take-back, dropped. */
function trimmed(state) {
  const n = G.movesOf(state).length, marks = Object.fromEntries(Object.entries(state.marks || {}).filter(([ply]) => Number(ply) < n));
  return { ...state, marks, lesson: state.lesson && state.lesson.ply < n ? state.lesson : null };
}
// Show: the board as it stood before the move the coach faulted, its better moves and yours drawn on it
let looking = false;
function setCoach(v) {
  opts.coach = v;
  saveOpts();
  if (S.hint?.auto && v !== "on") S = { ...S, hint: null };
  if (v === "off" || v === "hints") looking = false;
  save();
  render();
  advise();
}

function takeBackCount() {
  const g = cur(), all = G.movesOf(g);
  if (!all.length || inRoom()) return 0;
  if (g.mode === "two") return 1;
  const whiteFirst = new Chess(g.start).turn() === "w", seatOf = i => ((i % 2 === 0) === whiteFirst ? g.white : 1 - g.white);
  let n = 0;
  while (n < all.length && (n === 0 || seatOf(all.length - n) !== 0)) n++;
  return seatOf(all.length - n) === 0 ? n : 0;
}
function takeBack() {
  const n = takeBackCount();
  if (!n) return;
  S = trimmed({ ...G.act(S, 0, { undo: n }), hint: null, review: null });    // still counted, if it had ended
  thinking = false;
  afterMove(false);
}
function resign() {
  const g = cur();
  if (g.result) return;
  if (inRoom()) { together.act(d => { const n = G.act(G.fromRoom(d), mySeat(), { resign: true }); if (!n) return false; Object.assign(d, n); }); return; }
  if (!confirm("Resign this game?")) return;
  S = { ...G.act(S, S.mode === "two" ? G.waitingOn(S) : 0, { resign: true }), hint: null };
  afterMove(false);
}
function newGame() {
  S = freshGame();
  closeDialogs();
  afterMove(false);
  if (S.mode === "engine") ensureEngine();
}

// ---------- the end, and the review ----------
const WHY = { checkmate: "Checkmate", stalemate: "Stalemate: a draw", repetition: "The same position three times: a draw", fifty: "Fifty moves without a capture or a pawn move: a draw",
  material: "Not enough material to mate: a draw", resigned: "Resigned" };
/**
 * A game's end: its sheet, and once (as it first ends) its place in your record. Taking back after the end and playing
 * on shows the new end and its review, but the record keeps the first: a take-back can't turn a loss into a level beaten.
 */
let endShown = null;                                             // the game whose end has been shown
function settle() {
  const g = cur();
  if (!g.result || inRoom() || IN_FRAME || endShown === S) return;
  if (!S.counted) recordEnd();
  endShown = S;
  showEnd();
}
function recordEnd() {
  const g = cur();
  S = { ...S, counted: true };
  save();
  if (S.mode === "engine") {
    const won = g.result.winner === yourColour(), lost = g.result.winner && !won;
    const rec = read(RECORD, {}), r = rec[S.level] || { w: 0, d: 0, l: 0 };
    rec[S.level] = { w: r.w + (won ? 1 : 0), d: r.d + (g.result.winner ? 0 : 1), l: r.l + (lost ? 1 : 0) };
    write(RECORD, rec);
    if (won) write(BEST, Math.max(read(BEST, 0) || 0, levelById(S.level).rating));
  }
}
/** Who resigned: the side that didn't win, named as the page names it. */
function loserName(g) {
  const loser = g.result.winner === "white" ? "black" : "white", you = yourColour();
  if (inRoom()) return loser === you ? "You" : partnerName();
  if (g.mode === "engine") return loser === you ? "You" : "The computer";
  return cap(loser);
}
function headline(g) {
  const r = g.result;
  if (!r) return "";
  if (!r.winner) return "A draw";
  const you = yourColour();
  if (inRoom()) return r.winner === you ? "You win" : `${partnerName()} wins`;
  if (g.mode === "engine") return r.winner === you ? "You win" : "The computer wins";
  return r.winner === "white" ? "White wins" : "Black wins";
}
/**
 * The moves where you lost most, by the engine's evaluation: each position searched once (REVIEW), your move's cost the
 * score before it less the score after it, both from your side (a mate counted as ten pawns, so one missed mate doesn't
 * drown the rest). Kept in the game (review), so a reload or a partner watching shows it without searching again.
 */
let reviewing = null;
async function review() {
  const g = cur(), all = G.movesOf(g);
  if (!g.result || inRoom() || IN_FRAME || reviewing || g.review?.at === all.length || all.length < 2) return;
  const key = `${g.start}|${g.moves}`;
  reviewing = { done: 0, of: all.length + 1 };
  drawEnd();
  try {
    if (!(await ensureEngine())) return;
    const p = played(), scores = [], bests = [];
    for (let i = 0; i <= all.length; i++) {
      const c = new Chess(p.fens[i]);
      if (c.isGameOver()) { scores.push(c.isCheckmate() ? -1000 : 0); bests.push(null); }
      else {
        const r = await engine.search({ fen: p.fens[i], limit: REVIEW.limit, options: FULL });
        const l = r.lines[0], v = l?.mate != null ? (l.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, l?.cp ?? 0));
        scores.push(v); bests.push(r.best);
      }
      if (`${cur().start}|${cur().moves}` !== key) return;        // taken back meanwhile
      reviewing.done = i + 1;
      drawEnd();
    }
    const you = yourColour(), whiteFirst = new Chess(g.start).turn() === "w", items = [];
    p.history.forEach((m, i) => {
      const mover = (i % 2 === 0) === whiteFirst ? "white" : "black";
      if (you && mover !== you) return;
      const loss = scores[i] + scores[i + 1];                      // before, less after from the mover's side
      if (loss < 50 || !bests[i] || bests[i] === G.uciOf(m)) return;
      const c = new Chess(p.fens[i]);
      let better = null;
      try { better = c.move({ from: bests[i].slice(0, 2), to: bests[i].slice(2, 4), promotion: bests[i][4] })?.san; } catch { better = null; }
      items.push({ ply: i, san: m.san, better: better || bests[i], loss, mover });
    });
    items.sort((a, b) => b.loss - a.loss);
    S = { ...S, review: { at: all.length, items: items.slice(0, 3) } };
    save();
  } catch (e) { console.error(e); toast("The review didn't finish"); engine.stop(); engineUp = false; }
  finally { reviewing = null; drawEnd(); }
}
function drawEnd() {
  const g = cur();
  if (!g.result) return;
  $("endHead").textContent = headline(g);
  const n = Math.ceil(G.movesOf(g).length / 2), o = openingOf(played().fens);
  const how = g.result.why === "resigned" ? `${loserName(g)} resigned` : WHY[g.result.why] || "";
  const lines = [`<p>${esc(how)}, after ${n} move${n === 1 ? "" : "s"}.${o ? ` ${esc(o.eco)} ${esc(o.name)}.` : ""}</p>`];
  if (!inRoom() && g.mode === "engine") {
    const lv = levelById(g.level), best = read(BEST, 0);
    lines.push(`<p>Against ${esc(lv.name)} (${rating(lv.rating)}).${best ? ` The strongest you've beaten: ${esc(LEVELS.filter(l => l.rating <= best).pop()?.name || "")} (${rating(best)}).` : ""}</p>`);
  }
  const r = g.review?.at === G.movesOf(g).length ? g.review : null;
  if (r) {
    lines.push(`<h4 class="gb-sub">${yourColour() ? "Where you lost most" : "Where each side lost most"}</h4>`);
    if (!r.items.length) lines.push("<p>No move of yours gave away half a pawn or more, by the engine's reckoning.</p>");
    else lines.push(`<ol class="gb-review">${r.items.map(it => `<li><b>${Math.floor(it.ply / 2) + 1}${it.ply % 2 ? "…" : "."} ${esc(it.san)}</b>${yourColour() ? "" : ` (${cap(it.mover)})`}: about ${lossWords(it.loss)} given away; better was <b>${esc(it.better)}</b>.</li>`).join("")}</ol>`);
  } else if (reviewing) lines.push(`<p class="gb-reviewing"><span class="gb-wait"></span>Reviewing the game: ${reviewing.done} of ${reviewing.of} positions</p>`);
  $("endBody").innerHTML = lines.join("");
  $("endBody").querySelector(".gb-wait")?.append(sextant());
  $("endAgain").hidden = inRoom();
}
const lossWords = cp => (cp >= 900 ? "the game" : cp < 150 ? "a pawn" : `${(cp / 100).toFixed(1)} pawns`);
function showEnd() {
  if (!cur().result || IN_FRAME) return;
  drawEnd();
  if (!$("endDlg").open) $("endDlg").showModal();
  review();
}

// ---------- drawing ----------
const board = mountBoard($("board"), { onMove });
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function seatLabel(white) {
  const g = cur(), you = yourColour(), mine = you ? (you === "white") === white : null;
  if (inRoom()) return mine ? "You" : partnerName();
  if (g.mode === "engine") { const lv = levelById(g.level); return mine ? "You" : `${lv.name} · ${rating(lv.rating)}`; }
  return white ? "White" : "Black";
}
/** The pieces each side has taken (by the colour that took them), and the material balance in White's favour. */
function captures(p) {
  const out = { white: [], black: [] };
  let balance = 0;
  for (const m of p.history) {
    if (m.captured) { out[m.color === "w" ? "white" : "black"].push(m.captured); balance += (m.color === "w" ? 1 : -1) * VALUE[m.captured]; }
    if (m.promotion) balance += (m.color === "w" ? 1 : -1) * (VALUE[m.promotion] - 1);
  }
  for (const k of ["white", "black"]) out[k].sort((a, b) => VALUE[a] - VALUE[b]);
  return { ...out, balance };
}
const mini = code => `<svg class="gb-mini" viewBox="0 0 45 45" aria-hidden="true">${PIECES[code]}</svg>`;
function drawSeat(el, white, p, words = null) {
  const g = cur(), toMove = !g.result && p.chess.turn() === (white ? "w" : "b");
  const c = captures(p), taken = c[white ? "white" : "black"], lead = white ? c.balance : -c.balance;
  const busyHere = thinking && !inRoom() && g.mode === "engine" && (g.white !== 0) === white;
  el.innerHTML = `<span class="gb-who${toMove ? " turn" : ""}">${mini(white ? "wK" : "bK")}${words ?? "<b></b>"}</span><span class="gb-taken" aria-label="Taken">${taken.map(t => mini((white ? "b" : "w") + t.toUpperCase())).join("")}${lead > 0 ? `<small>+${lead}</small>` : ""}</span>`;
  if (words === null) el.querySelector("b").textContent = seatLabel(white);
  el.querySelector(".gb-wait")?.append(sextant());
  if (busyHere) { const s = document.createElement("span"); s.className = "gb-thinking"; s.append(sextant(), "thinking"); el.querySelector(".gb-who").append(s); }
}
function evalWords(h, whiteToMove) {
  const you = yourColour(), moverIsYou = you ? (you === "white") === whiteToMove : false;
  const mover = moverIsYou ? "you" : whiteToMove ? "White" : "Black", other = moverIsYou ? (inRoom() ? partnerName() : "the computer") : whiteToMove ? "Black" : "White";
  if (h.mate != null) { const n = Math.abs(h.mate), who = h.mate > 0 ? mover : other; return `${cap(who)} ${who === "you" ? "mate" : "mates"} in ${n}`; }
  const cp = h.cp ?? 0, a = Math.abs(cp), side = cp > 0 ? mover : other, sign = cp > 0 ? "+" : cp < 0 ? "−" : "";
  const how = a < 30 ? "about level" : a < 80 ? `a little better for ${side}` : a < 200 ? `better for ${side}, about a pawn` : a < 500 ? `much better for ${side}` : `winning for ${side}`;
  return `${how} (${sign}${(a / 100).toFixed(1)})`;
}
/** A move in the engine's words as SAN from a position (the engine's words if chess.js won't take it). */
function sanOf(fen, uci) {
  try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })?.san || uci; } catch { return uci; }
}
/** "a", "a or b", "a, b or c". */
const either = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
/** A move's number as the list writes it: 12. for White's, 12… for Black's. */
function numbered(ply) {
  const whiteFirst = new Chess(cur().start).turn() === "w", n = Math.floor((ply + (whiteFirst ? 0 : 1)) / 2) + 1;
  return `${n}${(ply % 2 === 0) === whiteFirst ? "." : "…"}`;
}
function sayLine(p) {
  const g = cur(), seat = G.waitingOn(g), whiteToMove = p.chess.turn() === "w";
  if (g.result) return `<b>${esc(headline(g))}</b> · ${esc(g.result.why === "resigned" ? `${loserName(g)} resigned` : WHY[g.result.why] || "")}`;
  if (looking && g.lesson) return `Before ${esc(numbered(g.lesson.ply))} ${esc(p.history[g.lesson.ply]?.san || "")}: the coach's ${g.lesson.better.length > 1 ? "moves" : "move"} in green`;
  const check = p.chess.inCheck() ? `<b class="gb-check">Check</b> · ` : "";
  if (hinting === keyOf(g)) return `${check}<span class="gb-wait"></span>The coach is looking…`;
  const h = coachOn() ? liveHint(g) : null;
  if (h) {
    const names = h.moves.map(u => `<b>${esc(sanOf(p.chess.fen(), u))}</b>`);
    return `${check}${h.auto ? "Coach" : "Hint"}: ${either(names)} · ${esc(evalWords(h, whiteToMove))}`;
  }
  const o = openingOf(p.fens), opening = o ? ` · <span class="gb-open">${esc(o.eco)} ${esc(o.name)}</span>` : "";
  if (inRoom()) return `${check}${seat === mySeat() ? "Your move" : `${esc(partnerName())} to move`}${opening}`;
  if (g.mode === "two") return `${check}${whiteToMove ? "White" : "Black"} to move${opening}`;
  return `${check}${seat === 0 ? "Your move" : thinking ? "The computer is thinking" : "The computer's move"}${opening}`;
}
function drawList(p) {
  const list = $("list"), whiteFirst = new Chess(cur().start).turn() === "w";
  const marks = coachOn() ? cur().marks || {} : {};
  const items = p.history.map((m, i) => {
    const white = (i % 2 === 0) === whiteFirst, mark = marks[i] || "";
    return `<li class="${white ? "white" : "black"}${i === p.history.length - 1 ? " last" : ""}${mark ? " faulted" : ""}">${white ? `<small>${Math.floor(i / 2) + 1}.</small>` : ""}<b>${esc(m.san)}${mark ? `<i>${mark}</i>` : ""}</b></li>`;
  });
  list.innerHTML = items.join("") || `<li class="gb-none">White moves first</li>`;
  list.scrollLeft = list.scrollWidth;
  list.scrollTop = list.scrollHeight;
}
function drawBar() {
  const bar = $("bar"), g = cur();
  bar.replaceChildren();
  const button = (text, fn, cls = "", disabled = false) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `gb-go ${cls}`.trim(); b.textContent = text; b.disabled = disabled;
    b.addEventListener("click", fn);
    bar.append(b);
  };
  if (IN_FRAME) return;
  if (inRoom()) { if (g.result) button("Back to solo", () => together.leave(), "quiet"); else button("Resign", resign, "quiet"); return; }
  // two buttons at most, Take back always first: held sideways the column has room for no more
  const yours = handSeats().includes(G.waitingOn(g));
  const retry = !g.result && g.mode === "engine" && !engineUp && G.waitingOn(g) === 1 && !thinking;
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
  const L = g.lesson;
  if (!L || !p.history[L.ply]) { el.replaceChildren(); return; }
  const before = p.fens[L.ply], mover = (L.ply % 2 === 0) === (new Chess(g.start).turn() === "w") ? "white" : "black";
  const other = g.mode === "two" ? cap(mover === "white" ? "black" : "white") : "the computer";
  const what = L.allows ? `lets ${other} mate in ${L.allows}` : L.missed ? `misses a mate in ${L.missed}` : L.loss >= 900 ? "gives the game away"
    : `gives away about ${L.loss < 150 ? "a pawn" : `${(L.loss / 100).toFixed(1)} pawns`}`;
  const better = either(L.better.map(u => `<b>${esc(sanOf(before, u))}</b>`));
  el.innerHTML = `<b class="gb-miss">Coach</b> ${esc(numbered(L.ply))} ${esc(p.history[L.ply].san)}${L.mark} ${what}; better was ${better}. <button type="button" class="link gb-look">${looking ? "Back to the game" : "Show"}</button>`;
  el.querySelector(".gb-look").addEventListener("click", () => { looking = !looking; render(); });
  el.scrollTop = 0;
}
const arrowOf = (uci, bad = false) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), bad });
/** The square of the king in check in a position, if one is. */
function checkSquare(chess) {
  if (chess.inCheck()) for (const row of chess.board()) for (const sq of row) if (sq?.type === "k" && sq.color === chess.turn()) return sq.square;
  return null;
}
function render() {
  const p = played(), g = cur(), L = checking() ? g.lesson : null;
  if (looking && !(L && p.history[L.ply])) looking = false;
  if (looking) {
    // before the faulted move: the coach's better moves and yours, nothing to play
    const prev = p.history[L.ply - 1];
    board.draw({ fen: p.fens[L.ply], white: bottomWhite(), moves: [], last: prev ? { from: prev.from, to: prev.to } : null,
      arrows: [...L.better.map(u => arrowOf(u)), arrowOf(L.move, true)], check: checkSquare(new Chess(p.fens[L.ply])), slide: false });
  } else {
    const last = p.history.at(-1), hand = !IN_FRAME && !g.result && handSeats().includes(G.waitingOn(g)) && !thinking, h = coachOn() ? liveHint(g) : null;
    board.draw({ fen: p.chess.fen(), white: bottomWhite(), moves: hand ? p.chess.moves({ verbose: true }) : [], last: last ? { from: last.from, to: last.to } : null,
      arrows: h ? h.moves.map(u => arrowOf(u)) : [], check: checkSquare(p.chess), slide });
  }
  $("board").classList.toggle("gb-plain", !opts.coords);
  const white = bottomWhite();
  drawSeat($("far"), !white, p);
  drawSeat($("near"), white, p, `<span class="gb-say">${sayLine(p)}</span>`);
  drawCoach(p);
  drawList(p);
  drawBar();
}

// ---------- the rules ----------
function rules() {
  const pc = code => `<svg class="gb-rule-pc" viewBox="0 0 45 45" aria-hidden="true">${PIECES[code]}</svg>`;
  const row = (t, name, how) => `<div class="gb-rule-piece"><span>${pc("w" + t)}${pc("b" + t)}</span><div><b>${name}</b><p>${how}</p></div></div>`;
  return `
<p>Chess as FIDE's Laws of Chess have it. White moves first. You win by checkmating the other king: attacking it (check) so that no move saves it.</p>
<h4>The pieces</h4>
${row("K", "King", "One square any way. It may never move into check. Once a game, if neither it nor the rook has moved, nothing stands between them and it isn't in check or passing through an attacked square, it castles: two squares toward the rook, which jumps to its other side.")}
${row("Q", "Queen", "Any distance in a straight line or along a diagonal.")}
${row("R", "Rook", "Any distance along a rank or a file.")}
${row("B", "Bishop", "Any distance along a diagonal, so always on its own colour.")}
${row("N", "Knight", "Two squares one way and one to the side, jumping over anything between.")}
${row("P", "Pawn", "One square forward, two on its first move; it captures one square diagonally forward. A pawn that has just moved two squares past an enemy pawn beside it can be taken as if it had moved one (en passant), on the very next move only. On the last rank it becomes a queen, rook, bishop or knight.")}
<h4>How a game ends</h4>
<p><b>Checkmate</b> wins. A player with no legal move who isn't in check is <b>stalemated</b>: a draw. A position reached for the third time, fifty moves each without a capture or a pawn move, or too little left to mate (a king alone, or with one bishop or knight) are draws here at once, without a claim.</p>
<h4>Reading the moves</h4>
<p>Moves are in standard algebraic notation: the piece's letter (K, Q, R, B, N; none for a pawn) and the square it goes to, x for a capture, + for check and # for mate, O-O and O-O-O for castling, =Q for a promotion: <b>Nf3</b>, <b>exd5</b>, <b>Qxf7#</b>. The opening's name, with its ECO code (the Encyclopaedia of Chess Openings' index), shows as you play.</p>
<h4>The computer</h4>
<p>The computer player is Stockfish (GPL v3: <a href="vendor/stockfish/Copying.txt" target="_blank" rel="noopener">licence</a>, <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">source</a>), playing at the strength you choose in the menu. It's also the coach (Menu, Coach): Hints shows its strongest moves when you ask, as arrows, with what it makes of the position; Check adds a word after a move of yours that gave a good deal away, a mistake (?) or a blunder (??), with the better move, and Show puts the board back to see it; Always shows the strongest moves at each of yours without asking. At the end, it shows where you lost most.</p>`;
}

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick = { mode: opts.mode, level: opts.level, colour: opts.colour };
  if (inRoom()) {
    part(body, "together").append(line(`A match with ${partnerName()}: you play ${yourColour() === "white" ? "White" : "Black"}.`),
      ...(cur().result ? [] : [action("Resign", resign, "")]), action("Back to solo", () => together.leave(), "link"));
  } else {
    const g = cur();
    part(body, "play").append(action("New game", () => {
      if (!S.result && G.movesOf(S).length > 1 && !confirm("Start a new game? This one isn't finished.")) return;
      Object.assign(opts, pick); saveOpts(); newGame();
    }, "primary"), ...(!g.result && G.movesOf(g).length ? [action("Resign", resign, "link")] : []));
    part(body, "content").append(
      choice("Opponent", [["engine", "Computer"], ["two", "Two players"]], pick.mode, v => { pick.mode = v; }),
      choice("Strength", LEVELS.map(l => [l.id, `${l.name} ${rating(l.rating)}`]), pick.level, v => { pick.level = v; }),
      choice("You play", [["white", "White"], ["black", "Black"], ["either", "Either"]], pick.colour, v => { pick.colour = v; }));
  }
  const set = part(body, "settings");
  if (!inRoom()) set.append(choice("Coach", COACH, opts.coach, setCoach));
  set.append(toggle("Coordinates on the board", opts.coords, on => { opts.coords = on; saveOpts(); render(); }));
  const best = read(BEST, 0), rec = read(RECORD, {});
  const record = LEVELS.filter(l => rec[l.id]).map(l => `${l.name} ${rec[l.id].w}–${rec[l.id].d}–${rec[l.id].l}`).join(", ");
  part(body, "about").append(line(best ? `Strongest beaten: ${LEVELS.filter(l => l.rating <= best).pop()?.name} (${rating(best)})` : "No computer level beaten yet"),
    ...(record ? [line(`Won, drawn, lost: ${record}`)] : []));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function closeDialogs() { for (const d of document.querySelectorAll("dialog[open]")) d.close(); }

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
    const next = G.act(G.fromRoom(d), seat, { move: uci });
    if (!next) return false;
    Object.assign(d, { moves: next.moves, result: next.result || null });
  });
  if (!ok) render();
}
let joining = null;
const seated = () => { joining?.(); joining = null; };
const together = createTogether({
  game: "gambit",
  app: APP,
  toast,
  askName,
  valid: d => d?.v === 1 && typeof d.white === "number",
  fresh: players => ({ ...G.newGame({ white: Math.random() < 0.5 ? 0 : 1 }), app: APP, created: Date.now(), players }),
  onState: d => {
    seated();
    const before = D ? G.movesOf(D).length : -1;
    D = { ...G.fromRoom(d), players: d.players, created: d.created || 0, asked: d.asked || null };
    gen++;
    slide = before >= 0 && G.movesOf(D).length === before + 1;
    render();
    slide = false;
    if (D.result) { drawEnd(); if (!$("endDlg").open) $("endDlg").showModal(); }
  },
  onPresence: () => render(),
  onLeave: () => { D = null; seated(); closeDialogs(); render(); kick(); },
  result: d => {
    if (!d?.result || !together.room) return null;
    const slot = seatsOf(d).find(([id]) => id === together.room.uid)?.[1].slot ?? 0;
    return { match: `${d.created || 0}`, score: null, won: d.result.winner === (d.white === slot ? "white" : "black"), coop: false };
  },
});

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "gambit");
document.querySelector(".gb-mark").innerHTML = APPS.find(a => a.id === "gambit")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", () => { $("rulesBody").innerHTML = rules(); $("rulesDlg").showModal(); });
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("rulesDlg").addEventListener("click", e => { if (e.target === $("rulesDlg")) $("rulesDlg").close(); });
$("endBoard").addEventListener("click", () => $("endDlg").close());
$("endAgain").addEventListener("click", () => { $("endDlg").close(); newGame(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
addEventListener("resize", () => render());
window.__gambit = { get game() { return cur(); }, get engineUp() { return engineUp; }, get judging() { return judging; }, onMove, newGame, takeBack, hint, review, setCoach, G };

render();
const code = roomInAddress();
if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) { seated(); kick(); } });
} else if (!IN_FRAME && S.mode === "engine" && !S.result) {
  if (G.waitingOn(S) === 1) kick();
  else engine.start().then(() => { engineUp = true; render(); advise(); }, () => {});
} else advise();
