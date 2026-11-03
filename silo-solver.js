// Four in a row's engine: bitboards, a negamax with alpha-beta, a transposition table, and moves tried in the order that finds
// a cut soonest. Two searches share the board code:
//   solve   the exact result of a position, to the last disc: who wins, and how soon (the score below). It is the
//           engine of Pons's published method (the tutorial "Solving Connect Four: how to build a perfect AI", Apache
//           2.0 in its code; this is written afresh in JavaScript for the two-word board below and shares only the
//           method): a position's score from the mover's side is 22 minus the discs the winner has played when they
//           win, 0 for a draw and the same, negative, for a loss. Late positions solve in a blink; from about a dozen
//           discs on it takes seconds; from the empty board no phone could.
//   think   a search to a depth with a hand-made judgement at the end, for the positions the solver can't finish,
//           which is every position early in the game (Hard's and the coach's opening play).
//   tactics every move's forced result within a few plies (a win, or a loss, that cannot be avoided), which is what
//           the weaker levels see, or miss.
//
// The board is 49 bits, a column of 7 (6 rows and a sentinel row on top that stops runs wrapping to the next column)
// by 7 columns, held in two numbers so the bit operations stay in 32 bits: `a` the columns 0 to 3 (bits 0..27) and `b`
// the columns 4 to 6 (bits 0..20 of b, column 4 first). A position is the mover's discs (pa, pb) and everyone's
// (ma, mb): the opponent's are the difference, and a move hands the position over by xor.
import { N, ORDER, colsOf } from "./silo-board.js";

const M28 = 0x0FFFFFFF, M21 = 0x001FFFFF;
const COLM = 0x3F;
const FULL_A = COLM | (COLM << 7) | (COLM << 14) | (COLM << 21), FULL_B = COLM | (COLM << 7) | (COLM << 14);
const BOT_A = 1 | (1 << 7) | (1 << 14) | (1 << 21), BOT_B = 1 | (1 << 7) | (1 << 14);
// rows, for the judgement: bit r of each column (r 0..5)
const rowA = r => (1 << r) | (1 << (7 + r)) | (1 << (14 + r)) | (1 << (21 + r)), rowB = r => (1 << r) | (1 << (7 + r)) | (1 << (14 + r));
const ROW135_A = rowA(1) | rowA(3) | rowA(5), ROW135_B = rowB(1) | rowB(3) | rowB(5);   // the even rows (2nd, 4th, 6th) from 1
const ROW24_A = rowA(2) | rowA(4), ROW24_B = rowB(2) | rowB(4);                          // the odd rows from the third
export const MIN_SCORE = -18, MAX_SCORE = 18;
const WIN = 10000;                                                                        // think's win: 10000 less the discs played

const pop = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return Math.imul((x + (x >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24; };

// ---------- cells that would win ----------
let WA = 0, WB = 0;
/** ORs into WA/WB the cells that complete a run of four along a direction of shift s, for the discs (pa, pb). */
function dir(pa, pb, s) {
  const s2 = s + s, s3 = s2 + s, k = 28 - s, k2 = 28 - s2, k3 = 28 - s3;
  const l1a = (pa << s) & M28, l1b = ((pb << s) | (pa >>> k)) & M21;
  const l2a = (pa << s2) & M28, l2b = ((pb << s2) | (pa >>> k2)) & M21;
  const l3a = (pa << s3) & M28, l3b = ((pb << s3) | (pa >>> k3)) & M21;
  const r1a = ((pa >>> s) | (pb << k)) & M28, r1b = pb >>> s;
  const r2a = ((pa >>> s2) | (pb << k2)) & M28, r2b = pb >>> s2;
  const r3a = ((pa >>> s3) | (pb << k3)) & M28, r3b = pb >>> s3;
  WA |= (l1a & l2a & (l3a | r1a)) | (r1a & r2a & (l1a | r3a));
  WB |= (l1b & l2b & (l3b | r1b)) | (r1b & r2b & (l1b | r3b));
}
/** WA/WB: the empty cells where a disc of the player holding (pa, pb) would make four, given everything in (ma, mb). */
function winning(pa, pb, ma, mb) {
  WA = (pa << 1) & (pa << 2) & (pa << 3) & M28;
  WB = ((pb << 1) | (pa >>> 27)) & ((pb << 2) | (pa >>> 26)) & ((pb << 3) | (pa >>> 25)) & M21;
  dir(pa, pb, 7); dir(pa, pb, 6); dir(pa, pb, 8);
  WA &= FULL_A & ~ma;
  WB &= FULL_B & ~mb;
}
/** A column's disc value to the mirror image (columns reversed), for the symmetric key. */
let KA = 0, KB = 0;
function canon(ka, kb) {
  const c0 = ka & 127, c1 = (ka >>> 7) & 127, c2 = (ka >>> 14) & 127, c3 = (ka >>> 21) & 127, c4 = kb & 127, c5 = (kb >>> 7) & 127, c6 = (kb >>> 14) & 127;
  const ma = c6 | (c5 << 7) | (c4 << 14) | (c3 << 21), mb = c2 | (c1 << 7) | (c0 << 14);
  if (mb < kb || (mb === kb && ma < ka)) { KA = ma; KB = mb; } else { KA = ka; KB = kb; }
}
const hashOf = (ka, kb, shift) => {
  let h = Math.imul(ka, 0x9E3779B1) ^ Math.imul(kb + 0x7F4A7C15, 0x85EBCA6B);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2C1B3C6D);
  return (h ^ (h >>> 13)) >>> shift;
};

/** The position after the moves: { pa, pb, ma, mb, nb } for the mover. */
export function load(moves) {
  let fa = 0, fb = 0, ma = 0, mb = 0;
  const h = [0, 0, 0, 0, 0, 0, 0];
  const cols = colsOf(moves);
  cols.forEach((c, k) => {
    const bit = c < 4 ? 1 << (7 * c + h[c]) : 1 << (7 * (c - 4) + h[c]);
    if (c < 4) { ma |= bit; if (!(k & 1)) fa |= bit; } else { mb |= bit; if (!(k & 1)) fb |= bit; }
    h[c]++;
  });
  const nb = cols.length;
  return nb & 1 ? { pa: ma ^ fa, pb: mb ^ fb, ma, mb, nb } : { pa: fa, pb: fb, ma, mb, nb };
}

/**
 * A solver with its own tables. bits: the exact table's size as a power of two (22 is 4M positions, 38 MB; the page
 * and the worker take that, a test less); thinkBits: the depth-limited search's. Returns the searches and their
 * counters; the tables survive from one call to the next, so a game's later positions are cheaper than its earlier.
 */
export function createSolver({ bits = 22, thinkBits = 20, weights = {} } = {}) {
  const WT = { odd: 60, other: 12, mid: 5, ...weights };
  const SHIFT = 32 - bits, SIZE = 1 << bits;
  const tka = new Int32Array(SIZE), tkb = new Int32Array(SIZE), tv = new Uint8Array(SIZE);
  const TS = 32 - thinkBits, TSIZE = 1 << thinkBits;
  const uka = new Int32Array(TSIZE), ukb = new Int32Array(TSIZE), ud = new Int8Array(TSIZE), uf = new Uint8Array(TSIZE), uv = new Int16Array(TSIZE), um = new Int8Array(TSIZE);
  let nodes = 0, limit = Infinity, aborted = false;

  // the moves tried at each depth, kept in arrays by the number of discs so the search allocates nothing
  const candA = new Int32Array((N + 2) * 8), candB = new Int32Array((N + 2) * 8), candS = new Int32Array((N + 2) * 8), candC = new Int8Array((N + 2) * 8);

  /** Lists the playable cells `posA`/`posB` into the slots of ply nb, best first (most cells that would win after it,
   *  middle columns first among equals); returns how many. */
  function order(nb, pa, pb, ma, mb, posA, posB, hint) {
    const base = nb * 8;
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const c = ORDER[i];
      let ba = 0, bb = 0;
      if (c < 4) { ba = posA & (127 << (7 * c)); if (!ba) continue; } else { bb = posB & (127 << (7 * (c - 4))); if (!bb) continue; }
      winning(pa | ba, pb | bb, ma | ba, mb | bb);
      let s = (pop(WA) + pop(WB)) * 4;
      if (c === hint) s += 100;
      // insertion, best first; equals keep the middle-out order
      let j = n++;
      while (j > 0 && candS[base + j - 1] < s) { candA[base + j] = candA[base + j - 1]; candB[base + j] = candB[base + j - 1]; candS[base + j] = candS[base + j - 1]; candC[base + j] = candC[base + j - 1]; j--; }
      candA[base + j] = ba; candB[base + j] = bb; candS[base + j] = s; candC[base + j] = c;
    }
    return n;
  }

  // ---------- the exact search ----------
  /**
   * The score of a position for its mover, searched inside (alpha, beta). Returns a score; anything outside the window
   * is a bound. A search that runs out of its node budget sets `aborted` and returns 0: its result is not to be used.
   */
  function nm(pa, pb, ma, mb, nb, alpha, beta) {
    if (++nodes > limit) { aborted = true; return 0; }
    const posA = (ma + BOT_A) & FULL_A, posB = (mb + BOT_B) & FULL_B;
    winning(pa, pb, ma, mb);
    if ((WA & posA) | (WB & posB)) return (N + 1 - nb) >> 1;                     // the mover wins next move
    const oa = pa ^ ma, ob = pb ^ mb;
    winning(oa, ob, ma, mb);
    const owa = WA, owb = WB;
    let pA = posA, pB = posB;
    const fa = owa & posA, fb = owb & posB;
    if (fa | fb) {
      if (((fa & (fa - 1)) | (fb & (fb - 1))) || (fa && fb)) return -((N - nb) >> 1);   // two cells to stop: lost
      pA = fa; pB = fb;
    }
    // not under a cell where they would win
    pA &= ~(((owa >>> 1) | (owb << 27)) & M28);
    pB &= ~(owb >>> 1);
    if (!(pA | pB)) return -((N - nb) >> 1);
    if (nb >= N - 2) return 0;
    const min = -((N - 2 - nb) >> 1);
    if (alpha < min) { alpha = min; if (alpha >= beta) return alpha; }
    const max = (N - 1 - nb) >> 1;
    if (beta > max) { beta = max; if (alpha >= beta) return beta; }
    canon(pa + ma, pb + mb);
    const ka = KA, kb = KB, idx = hashOf(ka, kb, SHIFT);
    if (tv[idx] && tka[idx] === ka && tkb[idx] === kb) {
      const v = tv[idx];
      if (v > 37) { const lo = v - 56; if (alpha < lo) { alpha = lo; if (alpha >= beta) return alpha; } }
      else { const hi = v - 19; if (beta > hi) { beta = hi; if (alpha >= beta) return beta; } }
    }
    const n = order(nb, pa, pb, ma, mb, pA, pB, -1), base = nb * 8;
    for (let i = 0; i < n; i++) {
      const ba = candA[base + i], bb = candB[base + i];
      const score = -nm(oa, ob, ma | ba, mb | bb, nb + 1, -beta, -alpha);
      if (aborted) return 0;
      if (score >= beta) {
        tka[idx] = ka; tkb[idx] = kb; tv[idx] = score + 56;                      // a lower bound
        return score;
      }
      if (score > alpha) alpha = score;
    }
    if (alpha >= MIN_SCORE) { tka[idx] = ka; tkb[idx] = kb; tv[idx] = alpha + 19; }   // an upper bound
    return alpha;
  }

  /** The exact score of a position (for its mover), or null if the node budget ran out first. */
  function solveAt(pos, nodeLimit = Infinity) {
    limit = nodeLimit; aborted = false; nodes = 0;
    const { pa, pb, ma, mb, nb } = pos;
    // the score of an immediate win or loss is known without the search
    let min = -((N - nb) >> 1), max = (N + 1 - nb) >> 1;
    while (min < max) {
      let med = min + ((max - min) >> 1);
      if (med <= 0 && (min >> 1) < med) med = min >> 1;
      else if (med >= 0 && (max >> 1) > med) med = max >> 1;
      const r = nm(pa, pb, ma, mb, nb, med, med + 1);
      if (aborted) return null;
      if (r <= med) max = r; else min = r;
    }
    return min;
  }
  /** The score of the position the move string reaches. */
  const solve = (moves, nodeLimit = Infinity) => solveAt(load(moves), nodeLimit);
  const startOf = (pos, c) => {
    // the position after the mover plays column c: null if the column is full
    const posA = (pos.ma + BOT_A) & FULL_A, posB = (pos.mb + BOT_B) & FULL_B;
    const ba = c < 4 ? posA & (127 << (7 * c)) : 0, bb = c >= 4 ? posB & (127 << (7 * (c - 4))) : 0;
    if (!(ba | bb)) return null;
    return { pa: pos.pa ^ pos.ma, pb: pos.pb ^ pos.mb, ma: pos.ma | ba, mb: pos.mb | bb, nb: pos.nb + 1, ba, bb };
  };
  /** Whether the mover wins at once by playing column c. */
  function winsAt(pos, c) {
    const posA = (pos.ma + BOT_A) & FULL_A, posB = (pos.mb + BOT_B) & FULL_B;
    winning(pos.pa, pos.pb, pos.ma, pos.mb);
    return c < 4 ? !!(WA & posA & (127 << (7 * c))) : !!(WB & posB & (127 << (7 * (c - 4))));
  }

  /**
   * The exact score of every column for the mover (null for a full column), best first in `best`: the columns whose
   * score is the top one. Null if the budget (nodes, across all the columns) ran out.
   */
  function scores(moves, nodeLimit = Infinity) {
    const pos = load(moves), out = Array(7).fill(null);
    let left = nodeLimit;
    for (let c = 0; c < 7; c++) {
      const child = startOf(pos, c);
      if (!child) continue;
      if (winsAt(pos, c)) { out[c] = (N + 1 - pos.nb) >> 1; continue; }
      if (child.nb >= N) { out[c] = 0; continue; }
      const r = solveAt(child, left);
      left -= nodes;
      if (r === null) return null;
      out[c] = -r;
    }
    const top = Math.max(...out.filter(x => x !== null));
    return { scores: out, top, best: ORDER.filter(c => out[c] === top) };
  }

  // ---------- the search to a depth ----------
  /** The judgement of a position for its mover, in hundredths of a disc, about: threats where the zugzwang (the
   *  filling of the board, which gives the first mover the odd rows and the second the even) favours them, and the
   *  middle columns. */
  function judge(pa, pb, ma, mb, nb) {
    winning(pa, pb, ma, mb);
    const mea = WA, meb = WB;
    const oa = pa ^ ma, ob = pb ^ mb;
    winning(oa, ob, ma, mb);
    const first = !(nb & 1);                                                  // the mover moves first
    const goodMeA = first ? ROW24_A : ROW135_A, goodMeB = first ? ROW24_B : ROW135_B;
    const goodOpA = first ? ROW135_A : ROW24_A, goodOpB = first ? ROW135_B : ROW24_B;
    let s = 0;
    s += WT.odd * (pop(mea & goodMeA) + pop(meb & goodMeB)) + WT.other * (pop(mea & ~goodMeA) + pop(meb & ~goodMeB));
    s -= WT.odd * (pop(WA & goodOpA) + pop(WB & goodOpB)) + WT.other * (pop(WA & ~goodOpA) + pop(WB & ~goodOpB));
    // the middle: a disc in column 3 is worth 3, in 2 and 4 two, in 1 and 5 one
    const mid = (a, b) => 3 * pop(a & (127 << 21)) + 2 * (pop(a & (127 << 14)) + pop(b & 127)) + (pop(a & (127 << 7)) + pop(b & (127 << 7)));
    s += WT.mid * (mid(pa, pb) - mid(oa, ob));
    return s;
  }
  /**
   * Alpha-beta to `depth` plies. With `judging` the leaves are judged; without, a leaf is 0, so the value is a win or
   * a loss only where one is forced inside the depth (tactics). A win is WIN less the discs played when it's made.
   * tt: whether the table is used (not for tactics, whose values mean something else).
   */
  function ab(pa, pb, ma, mb, nb, depth, alpha, beta, judging, tt) {
    if (++nodes > limit) { aborted = true; return 0; }
    const posA = (ma + BOT_A) & FULL_A, posB = (mb + BOT_B) & FULL_B;
    winning(pa, pb, ma, mb);
    if ((WA & posA) | (WB & posB)) return WIN - (nb + 1);
    const oa = pa ^ ma, ob = pb ^ mb;
    winning(oa, ob, ma, mb);
    const owa = WA, owb = WB;
    let pA = posA, pB = posB;
    const fa = owa & posA, fb = owb & posB;
    if (fa | fb) {
      if (((fa & (fa - 1)) | (fb & (fb - 1))) || (fa && fb)) return -(WIN - (nb + 2));
      pA = fa; pB = fb;
    }
    pA &= ~(((owa >>> 1) | (owb << 27)) & M28);
    pB &= ~(owb >>> 1);
    if (!(pA | pB)) return -(WIN - (nb + 2));
    if (nb >= N - 1) return 0;
    if (depth <= 0) return judging ? judge(pa, pb, ma, mb, nb) : 0;
    let hint = -1, idx = 0, ka = 0, kb = 0, mir = false;
    const a0 = alpha;
    if (tt) {
      canon(pa + ma, pb + mb);
      ka = KA; kb = KB; idx = hashOf(ka, kb, TS);
      mir = ka !== pa + ma || kb !== pb + mb;                                  // keyed as the mirror image: its columns reversed
      if (uf[idx] && uka[idx] === ka && ukb[idx] === kb) {
        if (ud[idx] >= depth) {
          const f = uf[idx], v = uv[idx];
          if (f === 1) return v;
          if (f === 2 && v > alpha) alpha = v; else if (f === 3 && v < beta) beta = v;
          if (alpha >= beta) return v;
        }
        hint = mir ? 6 - um[idx] : um[idx];
      }
    }
    const n = order(nb, pa, pb, ma, mb, pA, pB, hint), base = nb * 8;
    let best = -WIN - 1, bestC = -1;
    for (let i = 0; i < n; i++) {
      const ba = candA[base + i], bb = candB[base + i];
      const v = -ab(oa, ob, ma | ba, mb | bb, nb + 1, depth - 1, -beta, -alpha, judging, tt);
      if (aborted) return 0;
      if (v > best) { best = v; bestC = candC[base + i]; }
      if (v > alpha) { alpha = v; if (alpha >= beta) break; }
    }
    if (tt) {
      uka[idx] = ka; ukb[idx] = kb; ud[idx] = depth; uv[idx] = best; um[idx] = mir ? 6 - bestC : bestC;
      uf[idx] = best <= a0 ? 3 : best >= beta ? 2 : 1;
    }
    return best;
  }

  /**
   * The mover's best move by a search deepening one ply at a time until the node budget is spent or the depth is
   * reached. Returns { col, value (in hundredths of a disc; ±(WIN − discs) when a win or loss is forced), depth,
   * moves: every column's value at the last full depth }, or null when not even the first depth finished.
   */
  function think(moves, { depth = 12, nodeLimit = 400000 } = {}) {
    const pos = load(moves);
    let result = null;
    const spent0 = 0;
    let total = spent0;
    for (let d = 1; d <= depth; d++) {
      limit = nodeLimit - total; aborted = false; nodes = 0;
      const vals = Array(7).fill(null);
      let best = -Infinity, bestC = -1;
      const posA = (pos.ma + BOT_A) & FULL_A, posB = (pos.mb + BOT_B) & FULL_B;
      const cols = ORDER.filter(c => (c < 4 ? posA & (127 << (7 * c)) : posB & (127 << (7 * (c - 4)))));
      // last depth's best first
      if (result) cols.sort((x, y) => (y === result.col) - (x === result.col));
      for (const c of cols) {
        const child = startOf(pos, c);
        let v;
        if (winsAt(pos, c)) v = WIN - (pos.nb + 1);
        else if (child.nb >= N) v = 0;
        else v = -ab(child.pa, child.pb, child.ma, child.mb, child.nb, d - 1, -(WIN + 1), best === -Infinity ? WIN + 1 : -best, true, true);
        if (aborted) break;
        vals[c] = v;
        if (v > best) { best = v; bestC = c; }
      }
      total += nodes;
      if (aborted) break;
      result = { col: bestC, value: best, depth: d, moves: vals, nodes: total };
      if (Math.abs(best) > WIN - 100) break;                                   // a forced result: deeper tells nothing new
    }
    return result;
  }
  // (think's root narrows the window with `best`, so a column that is not better returns only a bound: its value in
  // `moves` is then an upper bound, which is all the move choice needs)

  /**
   * Every move's forced result within `depth` plies, for the weaker levels' sight. Returns for each legal column
   * { c, win: plies to a forced win (1 = this move wins) or 0, lose: plies to a forced loss or 0 }.
   */
  function tactics(moves, depth = 6) {
    const pos = load(moves), out = [];
    const posA = (pos.ma + BOT_A) & FULL_A, posB = (pos.mb + BOT_B) & FULL_B;
    limit = Infinity; aborted = false;
    for (const c of ORDER) {
      const child = startOf(pos, c);
      if (!child) continue;
      if (winsAt(pos, c)) { out.push({ c, win: 1, lose: 0 }); continue; }
      if (child.nb >= N) { out.push({ c, win: 0, lose: 0 }); continue; }
      nodes = 0;
      const v = -ab(child.pa, child.pb, child.ma, child.mb, child.nb, depth - 1, -WIN, WIN, false, false);
      let win = 0, lose = 0;
      if (v > WIN - 100) win = (WIN - v) - pos.nb;                             // the win's disc number less the discs played
      else if (v < -(WIN - 100)) lose = (WIN + v) - pos.nb;
      out.push({ c, win, lose });
    }
    void posA; void posB;
    return out;
  }

  return {
    solve, solveAt, scores, think, tactics, load,
    get nodes() { return nodes; },
    clear() { tv.fill(0); uf.fill(0); },
  };
}

/** A score in words: who wins and in how many discs of their own (the mover's side). */
export function scoreWords(score) {
  if (score === 0) return "a draw";
  const own = 22 - Math.abs(score);
  return `${score > 0 ? "a win" : "a loss"} with ${own === 1 ? "their first disc" : `disc ${own}`}`;
}
