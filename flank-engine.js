// Flank's computer player: our own search, written for the Codex, nothing of anyone's in it (the strong free
// engines, Edax and others, are GPL). Pure: no page, so the worker, the tests and the bench share it.
//
//  - evaluate(): what a position is worth to the side to move, in hundredths of a disc, from the things a player of this
//    game weighs: corners held, the squares beside an empty corner (X- and C-squares) that give it away, edge discs that
//    can never be turned, how many moves each side has (mobility), discs touching an empty square (the frontier: it
//    hands the other side moves), and, late, the discs themselves. Early on, fewer discs is better.
//  - negamax(): alpha-beta to a fixed depth, moves tried best-guess first (corners, then the ones that leave the other
//    side fewest replies), a pass costing no depth.
//  - solve(): the exact value of a position with few empty squares left, by alpha-beta on the disc difference to the end
//    of the game, fewest-replies first. About twelve empties is a fraction of a second; the coach goes further.
//  - rootScores(): the score of each move at the root, which is all a level, a hint or the coach needs; a level is a
//    search depth and an exact range, never a time, so a slow phone plays as a fast one.
import { legal, flipped, MV, popcount, nextToEmpty } from "./flank-board.js";

const clz = Math.clz32;
const low = w => 31 - clz(w & -w);

// ---------- what a square is worth, for ordering moves and for the first level ----------
export const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

// ---------- edges: which discs on an edge can never be turned ----------
// An edge disc can only be turned along its edge (every other line through it ends there), so whether it can ever be
// turned depends on the edge alone: 3^8 positions, each worked out once by trying every placement of either colour.
// EDGE[p << 8 | o] is the set of squares of the edge that can still be turned by some sequence of placements, p and o
// the two sides' discs on it (bit i the i-th square from a corner).
const EDGE = new Uint8Array(65536).fill(255), SEEN = new Uint8Array(65536);
function edgeTurnable(p, o) {
  const key = p << 8 | o;
  if (SEEN[key]) return EDGE[key];
  SEEN[key] = 1;
  let ever = 0;
  for (let i = 0; i < 8; i++) {
    if ((p | o) >> i & 1) continue;
    for (const side of [0, 1]) {
      const mine = side ? o : p, theirs = side ? p : o;
      let turned = 0;
      for (const d of [-1, 1]) {
        let run = 0, j = i + d;
        while (j >= 0 && j < 8 && (theirs >> j & 1)) { run |= 1 << j; j += d; }
        if (j >= 0 && j < 8 && (mine >> j & 1)) turned |= run;
      }
      const np = side ? p & ~turned : p | turned, no = side ? o | turned : o & ~turned;
      const placed = 1 << i;
      ever |= turned | edgeTurnable(side ? np : np | placed, side ? no | placed : no);
    }
  }
  EDGE[key] = ever;
  return ever;
}
for (let p = 0; p < 256; p++) for (let o = 0; o < 256; o++) if (!(p & o)) edgeTurnable(p, o);
/** The four edges of a board as bytes: top, bottom, left, right (bit i = the i-th square along the edge). */
const col = (x) => (Math.imul(x & 0x01010101, 0x01020408) >>> 24) & 15;
function stableDiff(pl, ph, ol, oh) {
  const pt = pl & 255, ot = ol & 255, pb = ph >>> 24, ob = oh >>> 24;
  const pa = col(pl) | col(ph) << 4, oa = col(ol) | col(oh) << 4;
  const pr = col(pl >>> 7) | col(ph >>> 7) << 4, or = col(ol >>> 7) | col(oh >>> 7) << 4;
  const s = (p, o) => popcount(p & ~EDGE[p << 8 | o]) - popcount(o & ~EDGE[p << 8 | o]);
  return s(pt, ot) + s(pb, ob) + s(pa, oa) + s(pr, or);
}

// ---------- the evaluation ----------
// the four corners, each with the square diagonally in (X) and the two beside it on the edges (C)
const CORNERS = [
  { l: 1, h: 0, xl: 1 << 9, xh: 0, cl: 1 << 1 | 1 << 8, ch: 0 },
  { l: 1 << 7, h: 0, xl: 1 << 14, xh: 0, cl: 1 << 6 | 1 << 15, ch: 0 },
  { l: 0, h: 1 << 24, xl: 0, xh: 1 << 17, cl: 0, ch: 1 << 16 | 1 << 25 },
  { l: 0, h: 1 << 31, xl: 0, xh: 1 << 22, cl: 0, ch: 1 << 23 | 1 << 30 },
];
const CL = 0x81, CH = 0x81000000 | 0;
/** The numbers the evaluation weighs, in hundredths of a disc. Exported so a bench can try others. */
export const EVAL = { corner: 2600, x: 1000, c: 350, stable: 200, mobility: 380, late: 220, frontier: 110, discs: 0, parity: 90 };

export function evaluate(pl, ph, ol, oh) {
  const nP = popcount(pl) + popcount(ph), nO = popcount(ol) + popcount(oh), e = 64 - nP - nO;
  let s = EVAL.corner * (popcount(pl & CL) + popcount(ph & CH) - popcount(ol & CL) - popcount(oh & CH));
  const occL = pl | ol, occH = ph | oh;
  for (let i = 0; i < 4; i++) {
    const k = CORNERS[i];
    if ((occL & k.l) | (occH & k.h)) continue;                      // the corner is taken: the squares beside it are no danger
    s -= EVAL.x * (popcount(pl & k.xl) + popcount(ph & k.xh) - popcount(ol & k.xl) - popcount(oh & k.xh));
    s -= EVAL.c * (popcount(pl & k.cl) + popcount(ph & k.ch) - popcount(ol & k.cl) - popcount(oh & k.ch));
  }
  s += EVAL.stable * stableDiff(pl, ph, ol, oh);
  const mP = mobilityOf(pl, ph, ol, oh), mO = mobilityOf(ol, oh, pl, ph);
  // moves matter most while there are many squares to fight over, and a side with none is in trouble
  const wm = EVAL.mobility * (e > 40 ? 1.2 : e > 20 ? 1 : 0.7);
  s += wm * (mP - mO) + (mO === 0 ? 900 : 0) - (mP === 0 ? 900 : 0);
  nextToEmpty(~occL, ~occH);
  const fl = MV[0], fh = MV[1];
  s -= EVAL.frontier * (popcount(pl & fl) + popcount(ph & fh) - popcount(ol & fl) - popcount(oh & fh)) * (e > 12 ? 1 : 0.4);
  // discs: a liability early, an asset at the end (the exact search takes over there)
  s += (e > 44 ? -EVAL.late * 0.25 : e > 28 ? 0 : EVAL.late * (28 - e) / 28) * (nP - nO) * 0.5;
  if (e & 1) s += EVAL.parity;                                       // the last move of an odd region is the mover's
  return s | 0;
}
function mobilityOf(pl, ph, ol, oh) { legal(pl, ph, ol, oh); return popcount(MV[0]) + popcount(MV[1]); }

// ---------- searching ----------
let nodes = 0, limit = Infinity;
const ABORT = { abort: true };
const PRI = new Int16Array(64);
for (let i = 0; i < 64; i++) PRI[i] = WEIGHTS[i];
// per ply: the moves of the node and their sort keys (a stack, so a search allocates nothing)
const MOVES = new Int8Array(80 * 32), KEYS = new Int32Array(80 * 32);

/** The moves in ml/mh listed at MOVES[base..], best-guess first; returns how many. */
function order(pl, ph, ol, oh, ml, mh, base, byReplies) {
  let n = 0;
  for (let w = ml; w !== 0;) { const b = w & -w; w ^= b; MOVES[base + n++] = 31 - clz(b); }
  for (let w = mh; w !== 0;) { const b = w & -w; w ^= b; MOVES[base + n++] = 32 + 31 - clz(b); }
  for (let i = 0; i < n; i++) {
    const sq = MOVES[base + i];
    let k = PRI[sq] * 8;
    if (byReplies) {
      flipped(sq, pl, ph, ol, oh);
      const fl = MV[0], fh = MV[1];
      const bl = sq < 32 ? 1 << sq : 0, bh = sq < 32 ? 0 : 1 << (sq - 32);
      k -= mobilityOf(ol & ~fl, oh & ~fh, pl | fl | bl, ph | fh | bh) * 70;
    }
    KEYS[base + i] = k;
  }
  for (let i = 1; i < n; i++) {                                      // insertion sort, highest key first
    const sq = MOVES[base + i], k = KEYS[base + i];
    let j = i - 1;
    while (j >= 0 && KEYS[base + j] < k) { MOVES[base + j + 1] = MOVES[base + j]; KEYS[base + j + 1] = KEYS[base + j]; j--; }
    MOVES[base + j + 1] = sq; KEYS[base + j + 1] = k;
  }
  return n;
}

/**
 * The exact value, in discs, for the side to move (pl, ph) of playing the game out from here, both sides at their best;
 * alpha and beta bound what is wanted (a value outside is only known to be outside). The game ends when neither side
 * can move, and the discs are counted as they stand (no empty square is given to the winner).
 */
export function solve(pl, ph, ol, oh, alpha = -64, beta = 64, passed = false) {
  nodes++;
  if (nodes > limit) throw ABORT;
  if (!legal(pl, ph, ol, oh)) {
    if (passed) return popcount(pl) + popcount(ph) - popcount(ol) - popcount(oh);
    return -solve(ol, oh, pl, ph, -beta, -alpha, true);
  }
  const ml = MV[0], mh = MV[1];
  const e = 64 - popcount(pl | ol) - popcount(ph | oh);
  const base = e * 32, n = order(pl, ph, ol, oh, ml, mh, base, e > 7);
  let best = -64;
  for (let i = 0; i < n; i++) {
    const sq = MOVES[base + i];
    flipped(sq, pl, ph, ol, oh);
    const fl = MV[0], fh = MV[1], bl = sq < 32 ? 1 << sq : 0, bh = sq < 32 ? 0 : 1 << (sq - 32);
    const v = -solve(ol & ~fl, oh & ~fh, pl | fl | bl, ph | fh | bh, -beta, -alpha, false);
    if (v > best) { best = v; if (v > alpha) { alpha = v; if (alpha >= beta) break; } }
  }
  return best;
}

const LEAF_EXACT = 6;                                                 // a leaf with this few empty squares is played out
function negamax(pl, ph, ol, oh, depth, alpha, beta, passed) {
  nodes++;
  if (nodes > limit) throw ABORT;
  if (!legal(pl, ph, ol, oh)) {
    if (passed) { const d = popcount(pl) + popcount(ph) - popcount(ol) - popcount(oh); return d * 100 + (d > 0 ? 20000 : d < 0 ? -20000 : 0); }
    return -negamax(ol, oh, pl, ph, depth, -beta, -alpha, true);
  }
  const ml = MV[0], mh = MV[1];
  const e = 64 - popcount(pl | ol) - popcount(ph | oh);
  if (depth <= 0) {
    if (e <= LEAF_EXACT) { const d = solve(pl, ph, ol, oh, -64, 64); return d * 100 + (d > 0 ? 20000 : d < 0 ? -20000 : 0); }
    return evaluate(pl, ph, ol, oh);
  }
  const base = 40 * 32 + depth * 32;                                  // a stack row per depth (below the solver's)
  const n = order(pl, ph, ol, oh, ml, mh, base, depth >= 3);
  let best = -1e9;
  for (let i = 0; i < n; i++) {
    const sq = MOVES[base + i];
    flipped(sq, pl, ph, ol, oh);
    const fl = MV[0], fh = MV[1], bl = sq < 32 ? 1 << sq : 0, bh = sq < 32 ? 0 : 1 << (sq - 32);
    const v = -negamax(ol & ~fl, oh & ~fh, pl | fl | bl, ph | fh | bh, depth - 1, -beta, -alpha, false);
    if (v > best) { best = v; if (v > alpha) { alpha = v; if (alpha >= beta) break; } }
  }
  return best;
}

/**
 * The score of each move at the root, for the side to move (pl, ph) against (ol, oh): [{ sq, score, exact }], best
 * first. score is in hundredths of a disc, or, where exact, a whole number of discs (the game played out) times 100
 * plus a win or loss mark (so a heuristic score and an exact one compare).
 *   depth    plies to look (the root's moves are 1); iterative deepening from 1.
 *   exact    solve to the end when this few squares are empty.
 *   all      score every move (full window); else only the best is sure and the rest are bounds at most that.
 *   nodes    a limit on the positions searched; the deepest finished iteration is kept.
 */
export function rootScores(pl, ph, ol, oh, { depth = 4, exact = 10, all = false, nodes: cap = Infinity } = {}) {
  nodes = 0; limit = cap;
  if (!legal(pl, ph, ol, oh)) return [];
  const ml = MV[0], mh = MV[1];
  const e = 64 - popcount(pl | ol) - popcount(ph | oh);
  const base = 0, n = order(pl, ph, ol, oh, ml, mh, 30 * 32, true);
  let list = [];
  for (let i = 0; i < n; i++) list.push({ sq: MOVES[30 * 32 + i], score: 0, exact: false });
  const child = sq => {
    flipped(sq, pl, ph, ol, oh);
    const fl = MV[0], fh = MV[1], bl = sq < 32 ? 1 << sq : 0, bh = sq < 32 ? 0 : 1 << (sq - 32);
    return [ol & ~fl, oh & ~fh, pl | fl | bl, ph | fh | bh];
  };
  const sure = d => d * 100 + (d > 0 ? 20000 : d < 0 ? -20000 : 0);
  if (e <= exact) {                                                   // played out to the end: every move's exact value
    try {
      let alpha = -64;
      list.forEach((m, i) => {
        const [a, b, c, d] = child(m.sq);
        const v = all || i === 0 ? -solve(a, b, c, d, -64, 64 - (all ? 0 : 0)) : -solve(a, b, c, d, -alpha - 1, -alpha);
        if (all || i === 0) { m.score = sure(v); m.exact = true; if (v > alpha) alpha = v; return; }
        if (v > alpha) { const w = -solve(a, b, c, d, -64, -alpha); m.score = sure(w); m.exact = true; alpha = Math.max(alpha, w); }   // better: its value
        else { m.score = sure(v); m.exact = v <= alpha; m.bound = true; }                                                              // no better than alpha
      });
    } catch (x) { if (x !== ABORT) throw x; list = list.map(m => ({ ...m, score: 0, exact: false })); }
    return list.sort((p, q) => q.score - p.score);
  }
  let done = null;
  try {
    for (let d = 1; d <= depth; d++) {
      let alpha = -1e9;
      const scored = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i], [a, b, c, dd] = child(m.sq);
        let v;
        if (all || i === 0) v = -negamax(a, b, c, dd, d - 1, -1e9, 1e9, false);
        else { v = -negamax(a, b, c, dd, d - 1, -alpha - 1, -alpha, false); if (v > alpha) v = -negamax(a, b, c, dd, d - 1, -1e9, -alpha, false); }
        scored.push({ sq: m.sq, score: v, exact: false });
        if (v > alpha) alpha = v;
      }
      scored.sort((p, q) => q.score - p.score);
      list = scored;                                                  // the best first, to start the next depth with
      done = scored;
    }
  } catch (x) { if (x !== ABORT) throw x; }
  return done || list;
}
/** The positions the last search looked at. */
export const nodesSearched = () => nodes;
