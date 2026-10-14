// Gambit: chess against Stockfish at a strength you choose, two players on one phone, or a match with your partner. The
// rules are chess.js's (gambit-rules.js keeps the game as plain JSON), the board chess-board.js's, the pieces Rush's;
// the computer's moves, the hints and the review at the end are Stockfish's (uci.js, in a worker, loaded only when a
// game against it needs it). The game in play is kept as it changes (gambit:game) and picked up on reload.
import * as G from "./gambit-rules.js";
import { mountBoard } from "./chess-board.js";
import { PIECES } from "./chess-pieces.js";
import { LEVELS, levelById, HINT, REVIEW } from "./gambit-levels.js";
import { openingOf } from "./gambit-openings.js";
import { Engine, WORKERS, levelMove } from "./uci.js";
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
let opts = { mode: "engine", level: "3", colour: "white", coords: true, ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);
/**
 * the game in play: gambit-rules.js's state and the page's: { v, start, moves, result, white, mode ("engine" or "two"),
 * level, created, hint, review, counted }. With the computer, seat 0 is you and 1 the computer, `white` the seat
 * playing White; two players on one phone are seat 0 (White) and 1 (Black). review: the end's look back, once made.
 */
function freshGame() {
  const white = opts.mode === "two" ? 0 : opts.colour === "black" ? 1 : opts.colour === "either" ? (Math.random() < 0.5 ? 0 : 1) : 0;
  return { ...G.newGame({ white }), mode: opts.mode === "two" ? "two" : "engine", level: levelById(opts.level).id, created: Date.now(), hint: null, review: null, counted: false };
}
function loadGame() {
  const g = G.fromRoom(read(GAME, null));
  if (!g || !G.replay(g).ok) return freshGame();
  return { ...g, mode: g.mode === "two" ? "two" : "engine", level: levelById(g.level).id, created: g.created || Date.now(), hint: g.hint || null, review: g.review || null, counted: !!g.counted };
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
const FULL = { MultiPV: 1, "Skill Level": 20, UCI_LimitStrength: false };     // the engine unlimited: hints and the review
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

// ---------- the turn ----------
let gen = 0, thinking = false, hinting = false, slide = false;
function afterMove(animate = true) {
  gen++;
  slide = animate;
  save();
  render();
  slide = false;
  settle();
  kick();
}
function onMove(uci) {
  const g = cur(), seat = G.waitingOn(g);
  if (seat === null || !handSeats().includes(seat)) return;
  if (inRoom()) { moveTogether(uci); return; }
  const next = G.act(S, seat, { move: uci });
  if (!next) { render(); return; }
  S = { ...next, hint: null };
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
onPause(() => render(), () => { render(); kick(); });

async function hint() {
  const g = cur();
  if (hinting || thinking || g.result || inRoom()) return;
  const at = G.movesOf(g).length, g0 = gen;
  hinting = true;
  render();
  try {
    if (!(await ensureEngine())) return;
    const r = await engine.search({ fen: g.start, moves: G.movesOf(g), limit: HINT.limit, options: FULL });
    if (g0 !== gen || !r.best) return;
    S = { ...S, hint: { at, move: r.best, cp: r.lines[0]?.cp ?? null, mate: r.lines[0]?.mate ?? null } };
    save();
  } catch (e) { console.error(e); toast("The hint didn't come: try again"); engine.stop(); engineUp = false; }
  finally { hinting = false; render(); }
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
  S = { ...G.act(S, 0, { undo: n }), hint: null, review: null, counted: false };
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
function settle() {
  const g = cur();
  if (!g.result || inRoom() || IN_FRAME || S.counted) return;
  S = { ...S, counted: true };
  save();
  if (S.mode === "engine") {
    const won = g.result.winner === yourColour(), lost = g.result.winner && !won;
    const rec = read(RECORD, {}), r = rec[S.level] || { w: 0, d: 0, l: 0 };
    rec[S.level] = { w: r.w + (won ? 1 : 0), d: r.d + (g.result.winner ? 0 : 1), l: r.l + (lost ? 1 : 0) };
    write(RECORD, rec);
    if (won) write(BEST, Math.max(read(BEST, 0) || 0, levelById(S.level).rating));
  }
  showEnd();
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
function sayLine(p) {
  const g = cur(), seat = G.waitingOn(g), whiteToMove = p.chess.turn() === "w";
  if (g.result) return `<b>${esc(headline(g))}</b> · ${esc(g.result.why === "resigned" ? `${loserName(g)} resigned` : WHY[g.result.why] || "")}`;
  const check = p.chess.inCheck() ? `<b class="gb-check">Check</b> · ` : "";
  if (hinting) return `${check}<span class="gb-wait"></span>The coach is looking…`;
  const h = g.hint && g.hint.at === G.movesOf(g).length ? g.hint : null;
  if (h) {
    let san = h.move;
    try { san = new Chess(p.chess.fen()).move({ from: h.move.slice(0, 2), to: h.move.slice(2, 4), promotion: h.move[4] })?.san || h.move; } catch { /* the engine's words */ }
    return `${check}Hint: <b>${esc(san)}</b> · ${esc(evalWords(h, whiteToMove))}`;
  }
  const o = openingOf(p.fens), opening = o ? ` · <span class="gb-open">${esc(o.eco)} ${esc(o.name)}</span>` : "";
  if (inRoom()) return `${check}${seat === mySeat() ? "Your move" : `${esc(partnerName())} to move`}${opening}`;
  if (g.mode === "two") return `${check}${whiteToMove ? "White" : "Black"} to move${opening}`;
  return `${check}${seat === 0 ? "Your move" : thinking ? "The computer is thinking" : "The computer's move"}${opening}`;
}
function drawList(p) {
  const list = $("list"), whiteFirst = new Chess(cur().start).turn() === "w";
  const items = p.history.map((m, i) => {
    const white = (i % 2 === 0) === whiteFirst;
    return `<li class="${white ? "white" : "black"}${i === p.history.length - 1 ? " last" : ""}">${white ? `<small>${Math.floor(i / 2) + 1}.</small>` : ""}<b>${esc(m.san)}</b></li>`;
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
  const yours = handSeats().includes(G.waitingOn(g));
  button("Hint", hint, "quiet", !!g.result || !yours || thinking || hinting);
  button("Take back", takeBack, "quiet", !takeBackCount());
  if (g.result) button("New game", newGame);
  else if (g.mode === "engine" && !engineUp && G.waitingOn(g) === 1 && !thinking) button("Retry", () => kick());
}
function render() {
  const p = played(), g = cur(), last = p.history.at(-1);
  const hand = !IN_FRAME && !g.result && handSeats().includes(G.waitingOn(g)) && !thinking;
  const h = g.hint && g.hint.at === G.movesOf(g).length ? { from: g.hint.move.slice(0, 2), to: g.hint.move.slice(2, 4) } : null;
  let check = null;
  if (p.chess.inCheck()) for (const row of p.chess.board()) for (const sq of row) if (sq?.type === "k" && sq.color === p.chess.turn()) check = sq.square;
  board.draw({ fen: p.chess.fen(), white: bottomWhite(), moves: hand ? p.chess.moves({ verbose: true }) : [], last: last ? { from: last.from, to: last.to } : null, arrow: h, check, slide });
  $("board").classList.toggle("gb-plain", !opts.coords);
  const white = bottomWhite();
  drawSeat($("far"), !white, p);
  drawSeat($("near"), white, p, `<span class="gb-say">${sayLine(p)}</span>`);
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
<p>The computer player is Stockfish (GPL v3: <a href="vendor/stockfish/Copying.txt" target="_blank" rel="noopener">licence</a>, <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">source</a>), playing at the strength you choose in the menu. Hint shows its move for you on the board and what it makes of the position; at the end, it shows where you lost most.</p>`;
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
  part(body, "settings").append(toggle("Coordinates on the board", opts.coords, on => { opts.coords = on; saveOpts(); render(); }));
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
window.__gambit = { get game() { return cur(); }, get engineUp() { return engineUp; }, onMove, newGame, takeBack, hint, review, G };

render();
const code = roomInAddress();
if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) { seated(); kick(); } });
} else if (!IN_FRAME && S.mode === "engine" && !S.result) {
  if (G.waitingOn(S) === 1) kick();
  else engine.start().then(() => { engineUp = true; render(); }, () => {});
}
