// Crown's computer player: our own search, no one else's code. Alpha-beta (negamax) with iterative deepening, a
// transposition table, captures searched to their end (a capture is compulsory, so a position where one is on offer is
// never "quiet" and is not judged: it is searched on), and an evaluation of men, kings, advancement, the back rank,
// the centre and, in an ending, how close the stronger side's kings are to the weaker's pieces.
//
// The levels differ in how far it looks (a node budget, so a move costs the same on every device and a game is
// reproducible from its seed), how often it is blind to a shot (a move searched to the end of its captures only, one
// quiet move deep), and how far from its best it may stray. Hard is the whole budget and never blind.
import { SETS, geo, movesOf, play, toArray, sideOf, crownRowOf, counts } from "./crown-board.js";

export const LEVELS = {
  easy: { name: "Easy", nodes: 700, depth: 3, blind: 0.4, noise: 40 },
  medium: { name: "Medium", nodes: 12000, depth: 8, blind: 0.1, noise: 8 },
  hard: { name: "Hard", nodes: 130000, depth: 40, blind: 0, noise: 0 },
};
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

const INF = 1e6, MATE = 100000, MAXPLY = 80, TT_BITS = 17, TT_SIZE = 1 << TT_BITS;

/** A tiny seeded generator for the hash keys (the same on every device). */
function keyGen(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) | 0; };
}
const pieceIndex = p => (p === 1 ? 0 : p === 2 ? 1 : p === -1 ? 2 : 3);

const engines = new Map();
/** The search for a set (built once: tables for the evaluation and the hash). */
export function engineFor(setId) {
  let e = engines.get(setId);
  if (!e) engines.set(setId, e = build(setId));
  return e;
}

function build(setId) {
  const set = SETS[setId], g = geo(setId), N = g.N, S = g.S;
  const rnd = keyGen(0xC0FFEE ^ N);
  const Z1 = Array.from({ length: 4 }, () => Int32Array.from({ length: N }, rnd)), Z2 = Array.from({ length: 4 }, () => Int32Array.from({ length: N }, rnd));
  const SIDE1 = rnd(), SIDE2 = rnd();
  const MAN = 100, KING = set.flying ? 330 : 160;
  // per-square tables, from Ink's point of view (side 0 advances towards row 0); Ivory reads them mirrored
  const advance = [new Int16Array(N), new Int16Array(N)], centre = new Int16Array(N), edge = new Uint8Array(N), home = [new Uint8Array(N), new Uint8Array(N)], kingCentre = new Int16Array(N);
  const mid = (S - 1) / 2;
  for (let i = 0; i < N; i++) {
    const r = g.row[i], c = g.col[i];
    advance[0][i] = S - 1 - r; advance[1][i] = r;
    const dc = Math.abs(c - mid), dr = Math.abs(r - mid);
    centre[i] = Math.max(0, Math.round((S / 2 - 1 - Math.max(dc, dr) * 0.9)));
    edge[i] = c === 0 || c === S - 1 ? 1 : 0;
    home[0][i] = r === S - 1 ? 1 : 0; home[1][i] = r === 0 ? 1 : 0;
    kingCentre[i] = Math.round(4 - 1.6 * (Math.abs(c - mid) + Math.abs(r - mid)) / 2);
  }
  const advW = set.flying ? 2 : 3;
  // the long diagonal: the main road of a king
  const mainDiag = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (g.row[i] + g.col[i] === S - 1) mainDiag[i] = 1;

  /** The position's value for `side` to move, in hundredths of a man. */
  function evaluate(board, side) {
    let score = 0, men = [0, 0], kings = [0, 0], adv = [0, 0];
    for (let i = 0; i < N; i++) {
      const p = board[i];
      if (!p) continue;
      const s = p > 0 ? 0 : 1, sgn = s === 0 ? 1 : -1;
      if (Math.abs(p) === 1) {
        men[s]++;
        let v = MAN + advW * advance[s][i] + 2 * centre[i] - 2 * edge[i];
        adv[s] += advance[s][i];
        v += home[s][i] ? 7 : 0;           // a man kept at home keeps the other side from a crown
        score += sgn * v;
      } else {
        kings[s]++;
        score += sgn * (KING + 3 * kingCentre[i] + (set.flying && mainDiag[i] ? 12 : 0));
      }
    }
    // an ending: the side ahead brings its kings in on the other's pieces; the side behind wants the main diagonal / a corner
    const mat0 = men[0] * MAN + kings[0] * KING, mat1 = men[1] * MAN + kings[1] * KING, total = men[0] + men[1] + kings[0] + kings[1];
    if (total <= 10 && mat0 !== mat1) {
      const lead = mat0 > mat1 ? 0 : 1, sgn = lead === 0 ? 1 : -1;
      let ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
      for (let i = 0; i < N; i++) {
        const p = board[i];
        if (!p) continue;
        if (sideOf(p) === lead) { if (Math.abs(p) === 2) { ax += g.col[i]; ay += g.row[i]; an++; } } else { bx += g.col[i]; by += g.row[i]; bn++; }
      }
      if (an && bn) score += sgn * Math.round(14 - 2.2 * (Math.abs(ax / an - bx / bn) + Math.abs(ay / an - by / bn)));
    }
    // tempo count in the long game of the big board: more advanced men are worth a little more, already in advW
    return side === 0 ? score : -score;
  }

  /** Hash of a position and the side to move. */
  function hashOf(board, side) {
    let a = side ? SIDE1 : 0, b = side ? SIDE2 : 0;
    for (let i = 0; i < N; i++) { const p = board[i]; if (p) { const z = pieceIndex(p); a ^= Z1[z][i]; b ^= Z2[z][i]; } }
    return [a, b];
  }

  const ttKey = new Int32Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE), ttMove = new Int16Array(TT_SIZE);
  const sig = m => m.path[0] * N + m.path[m.path.length - 1] + (m.caps.length ? 0 : 0);

  /**
   * Searches `board` for `side` to move. opts: nodes (budget), depth (the deepest iteration), blind (a root move is
   * searched blind with this chance), noise (a root move may be chosen within this of the best), rng, quiet (plies
   * since a capture or a man's move), seen (Map of hash → times the position has stood in the game).
   * Returns { move, score, depth, nodes, moves: [{ move, score }] } (null move: none to make).
   */
  function search(boardIn, side, opts = {}) {
    const budget = opts.nodes ?? 20000, maxDepth = opts.depth ?? 40, rng = opts.rng ?? Math.random, seen = opts.seen || null;
    const board0 = boardIn instanceof Int8Array ? boardIn : toArray(boardIn);
    ttKey.fill(0);
    const hist = new Int32Array(N * N);
    let nodes = 0, aborted = false, cap = Infinity;
    const path = [];                 // hashes of the positions on the way down, for repetition
    const [h1, h2] = hashOf(board0, side);

    function child(board, m, h, hb) {
      const from = m.path[0], to = m.path[m.path.length - 1], p = board[from];
      let a = h ^ Z1[pieceIndex(p)][from], b = hb ^ Z2[pieceIndex(p)][from];
      for (const c of m.caps) { const z = pieceIndex(board[c]); a ^= Z1[z][c]; b ^= Z2[z][c]; }
      const np = m.crown ? p * 2 : p, z = pieceIndex(np);
      a ^= Z1[z][to] ^ SIDE1; b ^= Z2[z][to] ^ SIDE2;
      return [play(board, m), a, b];
    }
    function order(list, ttm, ply) {
      const keyed = list.map(m => {
        let k = m.caps.length * 1000 + (m.crown ? 500 : 0) + hist[m.path[0] * N + m.path[m.path.length - 1]];
        if (ttm >= 0 && sig(m) === ttm) k += 100000;
        return [k, m];
      });
      keyed.sort((x, y) => y[0] - x[0]);
      return keyed.map(x => x[1]);
    }

    function negamax(board, side, depth, alpha, beta, ply, h, hb, quiet) {
      if (aborted) return 0;
      if (++nodes > cap) { aborted = true; return 0; }
      // draws: a position met before on this line, a third time in the game, or too long without a capture or a man's move
      for (let i = path.length - 2; i >= 0; i -= 2) if (path[i] === h) return 0;
      if (seen && (seen.get(h) || 0) >= 2) return 0;
      if (quiet >= set.quiet) return 0;
      const moves = movesOf(setId, board, side);
      if (!moves.length) return -MATE + ply;
      const forced = moves[0].caps.length > 0;
      if (depth <= 0 && !forced) return evaluate(board, side);
      if (ply >= MAXPLY) return evaluate(board, side);

      const idx = (h ^ hb) & (TT_SIZE - 1);
      let ttm = -1;
      if (ttKey[idx] === (hb | 1) && depth > 0) {
        ttm = ttMove[idx];
        if (ttDepth[idx] >= depth) {
          const s = ttScore[idx], f = ttFlag[idx];
          if (f === 0) return s;
          if (f === 1 && s >= beta) return s;
          if (f === 2 && s <= alpha) return s;
        }
      }
      const a0 = alpha;
      let best = -INF, bestMove = null;
      path.push(h);
      const list = moves.length > 1 ? order(moves, ttm, ply) : moves;
      for (let i = 0; i < list.length; i++) {
        const m = list[i], p = board[m.path[0]];
        const [nb, nh, nhb] = child(board, m, h, hb);
        const nq = m.caps.length || Math.abs(p) === 1 ? 0 : quiet + 1;
        // a capture is searched on without costing depth when it is forced, so a shot is followed to its end
        const nd = depth <= 0 ? 0 : forced && list.length === 1 ? depth : depth - 1;
        const v = -negamax(nb, 1 - side, nd, -beta, -alpha, ply + 1, nh, nhb, nq);
        if (aborted) { path.pop(); return 0; }
        if (v > best) { best = v; bestMove = m; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) {
          if (!m.caps.length) hist[m.path[0] * N + m.path[m.path.length - 1]] += depth * depth;
          break;
        }
      }
      path.pop();
      if (depth > 0) {
        if (ttDepth[idx] <= depth || ttKey[idx] !== (hb | 1)) {
          ttKey[idx] = hb | 1; ttScore[idx] = best; ttDepth[idx] = depth;
          ttFlag[idx] = best <= a0 ? 2 : best >= beta ? 1 : 0;
          ttMove[idx] = bestMove ? sig(bestMove) : -1;
        }
      }
      return best;
    }

    const root = movesOf(setId, board0, side);
    if (!root.length) return { move: null, score: -MATE, depth: 0, nodes: 0, moves: [] };
    // blind root moves: judged at once, to the end of their captures (a shot beyond is not seen)
    const blindRoll = root.map(() => (opts.blind || 0) > 0 && rng() < opts.blind);
    let result = null, prev = null;
    const quiet0 = opts.quiet || 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const scored = [];
      let alpha = -INF;
      const ttm = result ? sig(result.move) : -1;
      cap = depth === 1 ? Infinity : budget;
      const list = prev ? prev.map(x => x.move) : order(root, ttm, 0);
      for (const m of list) {
        const [nb, nh, nhb] = child(board0, m, h1, h2);
        const p = board0[m.path[0]];
        const nq = m.caps.length || Math.abs(p) === 1 ? 0 : quiet0 + 1;
        const blind = blindRoll[root.indexOf(m)];
        path.length = 0; path.push(h1);
        // the first search of a root move is a full window when noise asks for every score, else only to beat the best
        const wide = (opts.noise || 0) > 0;
        const lo = wide ? -INF : alpha;
        const v = -negamax(nb, 1 - side, blind ? 0 : depth - 1, -INF, -lo, 1, nh, nhb, nq);
        if (aborted) break;
        scored.push({ move: m, score: v });
        if (v > alpha) alpha = v;
      }
      if (aborted) {
        // an iteration cut off keeps what it learned only if it has already looked at the previous best and beaten it
        break;
      }
      scored.sort((x, y) => y.score - x.score);
      result = { move: scored[0].move, score: scored[0].score, depth, moves: scored };
      prev = scored;
      if (Math.abs(scored[0].score) > MATE - 200) break;           // a forced win or loss is found
      if (root.length === 1) break;                                 // nothing to choose
    }
    if (!result) {
      // not even depth 1 within the budget (it cannot happen with a sane budget): the first legal move
      result = { move: root[0], score: 0, depth: 0, moves: root.map(m => ({ move: m, score: 0 })) };
    }
    // the weaker levels stray: any move within `noise` of the best may be played
    let pick = result.move;
    if ((opts.noise || 0) > 0 && result.moves.length > 1) {
      const close = result.moves.filter(x => x.score >= result.score - opts.noise);
      pick = close[Math.floor(rng() * close.length)].move;
    }
    return { move: pick, score: result.score, depth: result.depth, nodes, moves: result.moves };
  }

  return { search, evaluate, hashOf };
}

/** The moves' squares as plain numbers (a move from the database or a worker). */
export const pathOf = m => m.path.slice();

/** The computer's move for a position: { move, score, depth, nodes } (see search). */
export function think(setId, boardText, side, levelId, { rng = Math.random, quiet = 0, seen = null } = {}) {
  const lv = LEVELS[levelId] || LEVELS.medium;
  return engineFor(setId).search(toArray(boardText), side, { nodes: lv.nodes, depth: lv.depth, blind: lv.blind, noise: lv.noise, rng, quiet, seen });
}

/** A judgement of a position for the coach: the Hard search's score for Ink (positive: Ink is ahead), and the best move. */
export function judge(setId, boardText, side, { nodes = 40000, quiet = 0, seen = null } = {}) {
  const r = engineFor(setId).search(toArray(boardText), side, { nodes, depth: 30, quiet, seen });
  return { move: r.move, score: side === 0 ? r.score : -r.score, depth: r.depth, nodes: r.nodes };
}
export { counts };
