// The referee of the Chess course (chess-lessons.js, chess-stage.js): positions written as piece lists, and every question a lesson asks
// put to Gambit's own rules (gambit-rules.js on chess.js) rather than answered by hand. A puzzle's right moves are computed here (a mate
// by looking for it, a win of material by a small material search with the captures played out), and tests/chess-course.mjs holds each
// lesson's stored answers to what this module finds. No DOM: the tests load it in Node.
import { Chess } from "./vendor/chess.js";
import * as G from "./gambit-rules.js";

export const { START, uciOf } = G;
export const FILES = "abcdefgh";
export const EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1";
export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const sqIdx = sq => [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
export const sqName = (f, r) => FILES[f] + (r + 1);
/** Light or dark, by the colouring of the board (a1 is dark). */
export const isDark = sq => { const [f, r] = sqIdx(sq); return (f + r) % 2 === 0; };
export const points = n => `${n} point${n === 1 ? "" : "s"}`;

/** A position from a piece list: capitals are White's, small letters Black's, then the square: "Ke1 Qd1 ke8 pa7". */
export function fenOf(text, { turn = "w", castle = "-", ep = "-", half = 0, full = 1 } = {}) {
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const tok of text.trim().split(/\s+/).filter(Boolean)) {
    const piece = tok[0], sq = tok.slice(1);
    if (!/^[KQRBNPkqrbnp]$/.test(piece) || !/^[a-h][1-8]$/.test(sq)) throw new Error(`no piece "${tok}"`);
    const [f, r] = sqIdx(sq);
    if (grid[r][f]) throw new Error(`two pieces on ${sq}`);
    grid[r][f] = piece;
  }
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let s = "", gap = 0;
    for (let f = 0; f < 8; f++) { const p = grid[r][f]; if (!p) gap++; else { if (gap) s += gap; gap = 0; s += p; } }
    if (gap) s += gap;
    rows.push(s);
  }
  return `${rows.join("/")} ${turn} ${castle} ${ep} ${half} ${full}`;
}

/** A position loaded without the checks a real game needs, so a bare board (a lesson on the squares) loads too. */
export function load(fen) { const c = new Chess(); c.load(fen, { skipValidation: true }); return c; }
const asMove = uci => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
export const legal = fen => load(fen).moves({ verbose: true });
export const legalUcis = fen => legal(fen).map(uciOf);
/** The move played: { fen, san, move, chess }, or null when it isn't legal. */
export function after(fen, uci) {
  const c = load(fen);
  let move = null;
  try { move = c.move(asMove(uci)); } catch { move = null; }
  return move ? { fen: c.fen(), san: move.san, move, chess: c } : null;
}
export const turnOf = fen => fen.split(" ")[1];
const swapTurn = (fen, turn) => { const p = fen.split(" "); p[1] = turn; p[3] = "-"; return p.join(" "); };
/** For a piece to wander on its own (the lessons on how each piece moves): every move of either colour, as if it were that colour's turn. */
export function freeMoves(fen) {
  const out = [];
  for (const t of ["w", "b"]) { try { out.push(...load(swapTurn(fen, t)).moves({ verbose: true })); } catch { /* a bare board */ } }
  return out;
}
/** A move of either colour played, the turn passing as if it were that colour's: the new position, or null. */
export function freeMove(fen, uci) {
  const piece = load(fen).get(uci.slice(0, 2));
  return piece ? after(swapTurn(fen, piece.color), uci) : null;
}
export const kingSquare = (fen, colour) => { for (const row of load(fen).board()) for (const p of row) if (p && p.type === "k" && p.color === colour) return p.square; return null; };
/** The king's square if the side to move is in check. */
export const checkedKing = fen => { const c = load(fen); return c.inCheck() ? kingSquare(fen, c.turn()) : null; };
export const piecesOf = (fen, colour) => load(fen).board().flat().filter(p => p && (!colour || p.color === colour));
export const balance = fen => piecesOf(fen).reduce((s, p) => s + (p.color === "w" ? 1 : -1) * VAL[p.type], 0);

// ---------- mates ----------
/** The moves of the side to move that mate at once. */
export const mateMoves = fen => legal(fen).filter(m => m.san.endsWith("#")).map(uciOf);
/** Can the side to move, in c, force mate within n of its own moves? (c is left as it was.) */
export function mates(c, n) { return firstMates(c, n, true).length > 0; }
function firstMates(c, n, any = false) {
  const out = [];
  for (const m of c.moves({ verbose: true })) {
    const mv = { from: m.from, to: m.to, promotion: m.promotion };
    c.move(mv);
    let ok = c.isCheckmate();
    if (!ok && n > 1 && !c.isStalemate()) {
      const replies = c.moves({ verbose: true });
      ok = replies.length > 0 && replies.every(r => { c.move({ from: r.from, to: r.to, promotion: r.promotion }); const good = mates(c, n - 1); c.undo(); return good; });
    }
    c.undo();
    if (ok) { out.push(uciOf(m)); if (any) break; }
  }
  return out;
}
/** Every first move that forces mate within n moves of the side to move. */
export const forcedMates = (fen, n) => firstMates(load(fen), n);
/** The defender's most stubborn reply to a move that forces mate in n: the one leaving the attacker the fewest ways to go on. */
export function stubborn(fen, n) {
  const c = load(fen), replies = c.moves({ verbose: true });
  let best = null, fewest = Infinity;
  for (const r of replies) {
    c.move({ from: r.from, to: r.to, promotion: r.promotion });
    const k = firstMates(c, n).length;
    c.undo();
    if (k < fewest) { fewest = k; best = r; }
  }
  return best ? uciOf(best) : null;
}

// ---------- material, searched ----------
/** Material for the side to move, in pawns. */
export function evalMat(c) {
  const t = c.turn();
  let s = 0;
  for (const row of c.board()) for (const p of row) if (p) s += (p.color === t ? 1 : -1) * VAL[p.type];
  return s;
}
const weigh = m => (m.captured ? 10 * VAL[m.captured] - VAL[m.piece] : 0) + (m.promotion ? 8 : 0);
const ordered = moves => moves.sort((a, b) => weigh(b) - weigh(a));
const play = (c, m) => c.move({ from: m.from, to: m.to, promotion: m.promotion });
function quiet(c, alpha, beta, depth, ply) {
  const inCheck = c.inCheck();
  let stand = 0;
  if (!inCheck) {
    // standing pat before any move is generated: most leaves end here, and generating moves is what costs
    stand = evalMat(c);
    if (stand >= beta || depth <= 0) return Math.max(stand, alpha);
  }
  let moves = c.moves({ verbose: true });
  if (!moves.length) return inCheck ? -1000 + ply : 0;
  if (!inCheck) {
    if (stand > alpha) alpha = stand;
    moves = moves.filter(m => m.captured || m.promotion);
  }
  for (const m of ordered(moves)) {
    play(c, m);
    const v = -quiet(c, -beta, -alpha, depth - 1, ply + 1);
    c.undo();
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function negamax(c, depth, alpha, beta, ply) {
  const moves = c.moves({ verbose: true });
  if (!moves.length) return c.inCheck() ? -1000 + ply : 0;
  if (depth <= 0) return quiet(c, alpha, beta, 8, ply);
  let best = -Infinity;
  for (const m of ordered(moves)) {
    play(c, m);
    const v = -negamax(c, depth - 1, -beta, -alpha, ply + 1);
    c.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
/** Every legal move with what it is worth to the mover in pawns after `depth` plies of best play on both sides (captures played out), best first. */
export function rankMoves(fen, depth = 3) {
  const c = load(fen), out = [];
  let best = -Infinity;
  for (const m of ordered(c.moves({ verbose: true }))) {
    play(c, m);
    // a window just under the best so far: a move as good is exact, a worse one only bounded (it is not the best, which is all that is asked)
    const v = c.isCheckmate() ? 1000 : -negamax(c, depth - 1, -Infinity, -(best - 1), 1);
    c.undo();
    if (v > best) best = v;
    out.push({ uci: uciOf(m), san: m.san, v });
  }
  return out.sort((a, b) => b.v - a.v);
}
/** The best moves of a position by material: { value, base (before the move), moves (all that reach the best value), ranked }. */
export function bestOf(fen, depth = 3) {
  const ranked = rankMoves(fen, depth), value = ranked[0]?.v ?? 0, c = load(fen);
  return { value, base: evalMat(c), moves: ranked.filter(r => r.v === value).map(r => r.uci), ranked };
}
/** The line of best play from here, in SAN. */
export function lineOf(fen, depth = 3, plies = depth) {
  const out = [];
  let cur = fen;
  for (let i = 0; i < plies; i++) {
    const r = rankMoves(cur, Math.max(1, depth - i))[0];
    if (!r) break;
    const a = after(cur, r.uci);
    out.push(a.san);
    cur = a.fen;
  }
  return out;
}

// ---------- why a move is not the one ----------
const side = colour => (colour === "w" ? "White" : "Black");
/** A short reason a legal move does not do what a mating puzzle (in n moves) asks. */
export function whyNotMate(fen, uci, n = 1) {
  const a = after(fen, uci), c = a.chess, foe = side(c.turn());
  if (c.isStalemate()) return `${a.san} stalemates ${foe}: no move and no check is a draw, not a win.`;
  if (n === 1) {
    if (!c.inCheck()) return `${a.san} is not even check, so it cannot be mate.`;
    const r = c.moves({ verbose: true }).sort((x, y) => (y.piece === "k") - (x.piece === "k") || weigh(y) - weigh(x))[0];
    return r.piece === "k" ? `${a.san} is check, but ${foe} steps out with ${r.san}.` : `${a.san} is check, but ${foe} answers ${r.san}.`;
  }
  const r = c.moves({ verbose: true }).find(m => { play(c, m); const ok = !mates(c, n - 1); c.undo(); return ok; });
  return r ? `After ${a.san}, ${foe} has ${r.san}, and there is no forced mate.` : "That does not force mate.";
}
/** A short reason a move loses to a threat of mate in one (a puzzle that asks you to parry it). */
export function whyNotParried(fen, uci) {
  const a = after(fen, uci), mate = a && mateMoves(a.fen)[0];
  return mate ? `${a.san} leaves ${side(a.chess.turn())} ${after(a.fen, mate).san}, mate.` : "That does not help.";
}
/** A short reason a move is not the best by material: what the best reply does to it. */
export function whyNotBest(fen, uci, best) {
  const a = after(fen, uci), c = a.chess, foe = side(c.turn());
  if (c.isCheckmate()) return null;
  const replies = rankMoves(a.fen, 1), reply = replies[0];       // one ply and the captures played out: fast enough for a phone
  if (!reply) return `${a.san} leaves ${foe} no move, a stalemate and a draw.`;
  const got = -reply.v - best.base, bestGain = best.value - best.base;
  const r = after(a.fen, reply.uci);
  if (r.chess.isCheckmate()) return `${foe} replies ${r.san}: checkmate.`;
  if (got < 0) {
    const took = r.move.captured ? `${r.san} takes your ${NAME[r.move.captured]}` : `${foe} plays ${r.san}`;
    return `${took}, and you end up ${points(-got)} down.`;
  }
  if (got < bestGain) return `${foe} answers ${r.san} and you ${got ? `win only ${points(got)}` : "gain nothing"}: another move wins ${points(bestGain)}.`;
  return "That works, but another move is better.";
}

// ---------- what the board shows, worked out from the pieces ----------
/** The squares a piece can move to now, as the rules have it (a bare list of squares). */
export const targets = (fen, sq) => [...new Set(legal(fen).filter(m => m.from === sq).map(m => m.to))];
/** The squares of one colour's pieces (not the king) that the other side attacks and nothing of their own defends. */
export function loose(fen, colour) {
  const c = load(fen), out = [];
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== colour || p.type === "k") continue;
    if (c.attackers(p.square, colour === "w" ? "b" : "w").length && !c.attackers(p.square, colour).length) out.push(p.square);
  }
  return out;
}
const pawnsOf = (fen, colour) => piecesOf(fen, colour).filter(p => p.type === "p").map(p => sqIdx(p.square));
/** Pawns with no pawn of their own colour on a neighbouring file. */
export function isolated(fen, colour) {
  const mine = pawnsOf(fen, colour), files = new Set(mine.map(([f]) => f));
  return mine.filter(([f]) => !files.has(f - 1) && !files.has(f + 1)).map(([f, r]) => sqName(f, r));
}
/** Pawns that have a friend ahead of them or behind them on the same file (every pawn of a doubled pair is named). */
export function doubled(fen, colour) {
  const mine = pawnsOf(fen, colour);
  return mine.filter(([f, r]) => mine.some(([g, s]) => g === f && s !== r)).map(([f, r]) => sqName(f, r));
}
/** Pawns with no enemy pawn in front of them on their file or the next two. */
export function passed(fen, colour) {
  const foe = pawnsOf(fen, colour === "w" ? "b" : "w");
  return pawnsOf(fen, colour).filter(([f, r]) => !foe.some(([g, s]) => Math.abs(g - f) <= 1 && (colour === "w" ? s > r : s < r))).map(([f, r]) => sqName(f, r));
}
/** Squares in the enemy half that a pawn of this colour guards and no enemy pawn can ever attack (none stands beside and ahead of it). */
export function outposts(fen, colour) {
  const c = load(fen), mine = pawnsOf(fen, colour), foe = pawnsOf(fen, colour === "w" ? "b" : "w"), out = [];
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    if (colour === "w" ? r < 3 || r > 5 : r > 4 || r < 2) continue;
    const guarded = mine.some(([g, s]) => Math.abs(g - f) === 1 && s === (colour === "w" ? r - 1 : r + 1));
    const chased = foe.some(([g, s]) => Math.abs(g - f) === 1 && (colour === "w" ? s > r : s < r));
    const holder = c.get(sqName(f, r));
    if (guarded && !chased && (!holder || holder.color !== (colour === "w" ? "b" : "w") || holder.type !== "p")) out.push(sqName(f, r));
  }
  return out;
}
/** Files with no pawn of either colour on them, then the files only the other side's pawns block ({ open, half: { w: files open to White, b: … } }). */
export function filesOf(fen) {
  const pawns = piecesOf(fen).filter(p => p.type === "p"), has = (f, colour) => pawns.some(p => FILES.indexOf(p.square[0]) === f && p.color === colour);
  const open = [], half = { w: [], b: [] };
  for (let f = 0; f < 8; f++) {
    if (!has(f, "w") && !has(f, "b")) open.push(FILES[f]);
    else if (!has(f, "w")) half.w.push(FILES[f]);
    else if (!has(f, "b")) half.b.push(FILES[f]);
  }
  return { open, half };
}
/** How many of its own pawns stand on the colour of a bishop's square (more is worse: they shut it in). */
export function pawnsOnColour(fen, bishopSq) {
  const colour = piecesOf(fen).find(p => p.square === bishopSq).color, dark = isDark(bishopSq);
  return piecesOf(fen, colour).filter(p => p.type === "p" && isDark(p.square) === dark).length;
}
