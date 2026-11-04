// Nine Men's Morris's computer player: our own search, nobody else's code. Alpha-beta (negamax) with iterative
// deepening, a transposition table, captures searched one move further than the rest (a mill swings the game, so a
// position where one is on offer is never judged quiet), and an evaluation of pieces (in hand and on the board),
// closed mills, lines two-thirds filled, how free each side's pieces are and, while placing, the points that join most
// lines.
//
// A level is a budget of positions looked at, never a time (a slow phone plays as a fast one, and a game is
// reproducible from its seed), with how far it may look and how far from its best it may stray.
import { N, FULL, MILL_MASK, MILLS_AT, ADJ, DEGREE, popcount, gen, decode, closes, keyOf, positionOfText } from "./morris-board.js";

export const LEVELS = {
  easy: { name: "Easy", nodes: 1800, depth: 2, noise: 170, tie: 0 },
  medium: { name: "Medium", nodes: 24000, depth: 4, noise: 30, tie: 0 },
  hard: { name: "Hard", nodes: 260000, depth: 24, noise: 0, tie: 4 },
};
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
export const levelOf = id => LEVELS[id] || LEVELS.medium;

export const MATE = 100000;
const INF = 1e7, MAXPLY = 30;
const low = m => 31 - Math.clz32(m & -m);

/** Pieces with a move to a neighbouring point (not flying): how many cannot move. */
function freedom(m, empty) {
  let free = 0;
  for (let s = m; s; s &= s - 1) free += popcount(ADJ[low(s)] & empty);
  return free;
}
function degreeSum(m) { let s = 0; for (; m; m &= m - 1) s += DEGREE[low(m)]; return s; }

/** The position's value for the side to move (`me`), in hundredths of a piece. */
export function evaluate(me, opp, hMe, hOpp) {
  const tm = popcount(me) + hMe, to = popcount(opp) + hOpp, empty = FULL & ~(me | opp);
  let s = 110 * (tm - to), mills = 0, twos = 0;
  for (const k of MILL_MASK) {
    const a = me & k, b = opp & k;
    if (a === k) mills++;
    else if (b === k) mills--;
    else if (!b && popcount(a) === 2) twos++;
    else if (!a && popcount(b) === 2) twos--;
  }
  s += 16 * mills + 9 * twos;
  const placing = hMe + hOpp > 0;
  if (placing) s += 3 * (degreeSum(me) - degreeSum(opp));
  // freedom: a side that cannot move loses, and a flying side is free by definition
  const fm = hMe === 0 && popcount(me) === 3 ? 12 : freedom(me, empty), fo = hOpp === 0 && popcount(opp) === 3 ? 12 : freedom(opp, empty);
  s += (placing ? 1 : 3) * (fm - fo);
  return s;
}

/** Whether the side to move, with nothing in hand, has no move. */
function stuck(me, opp) {
  if (popcount(me) === 3) return false;
  const empty = FULL & ~(me | opp);
  for (let s = me; s; s &= s - 1) if (ADJ[low(s)] & empty) return false;
  return true;
}

/** Move numbers, best-looking first, for the search to try (a cut-off comes sooner). */
function ordered(moves, me, opp, hint) {
  const keyed = new Array(moves.length);
  for (let i = 0; i < moves.length; i++) {
    const code = moves[i], { f, t, x } = decode(code);
    let pr = 1;
    if (code === hint) pr += 5000;
    if (x >= 0) pr += 1500;
    for (const k of MILLS_AT[t]) {
      const a = k & opp;
      if (a && popcount(a) === 2 && !(k & me)) pr += 600;          // blocks a mill about to close
      const b = (k & me & ~(f >= 0 ? 1 << f : 0));
      if (b && popcount(b) === 1 && !(k & opp)) pr += 40;          // makes two in a line
    }
    if (f >= 0 && MILLS_AT[f].some(k => (me & k) === k)) pr += 30;   // opens a mill, to close it again
    pr += DEGREE[t] * 4;
    keyed[i] = pr * 16384 + code;
  }
  keyed.sort((a, b) => b - a);
  return keyed.map(v => v % 16384);
}

function newContext(limit) {
  return { nodes: 0, limit, aborted: false, tt: Array.from({ length: 100 }, () => new Map()), size: 0 };
}

function negamax(cx, me, opp, hMe, hOpp, depth, alpha, beta, ply) {
  if (++cx.nodes > cx.limit) { cx.aborted = true; return 0; }
  if (popcount(me) + hMe < 3) return -(MATE - ply);
  if (hMe === 0 && stuck(me, opp)) return -(MATE - ply);
  if (depth <= 0) return evaluate(me, opp, hMe, hOpp);

  const table = cx.tt[hMe * 10 + hOpp], key = me * 16777216 + opp, hit = table.get(key);
  let hint = -1;
  if (hit) {
    hint = hit[3];
    if (hit[0] >= depth) {
      if (hit[2] === 0) return hit[1];
      if (hit[2] === 1 && hit[1] >= beta) return hit[1];
      if (hit[2] === 2 && hit[1] <= alpha) return hit[1];
    }
  }
  const moves = ordered(gen(me, opp, hMe), me, opp, hint), a0 = alpha;
  let best = -INF, bestMove = -1;
  for (const code of moves) {
    const { f, t, x } = decode(code);
    const nm = (f < 0 ? me : me & ~(1 << f)) | (1 << t), no = x >= 0 ? opp & ~(1 << x) : opp;
    const ext = x >= 0 && ply < MAXPLY ? 1 : 0;
    const v = -negamax(cx, no, nm, hOpp, f < 0 ? hMe - 1 : hMe, depth - 1 + ext, -beta, -alpha, ply + 1);
    if (cx.aborted) return 0;
    if (v > best) { best = v; bestMove = code; }
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  if (Math.abs(best) < MATE - 400 && cx.size < 400000) {
    table.set(key, [depth, best, best <= a0 ? 2 : best >= beta ? 1 : 0, bestMove]);
    cx.size++;
  }
  return best;
}

/** A position as the search takes it: the side to move first. */
export function sidesOf(p) {
  return p.t === "d" ? [p.d, p.l, p.hd, p.hl] : [p.l, p.d, p.hl, p.hd];
}
const childKey = (p, code) => {
  const { f, t, x } = decode(code), c = p.t, o = c === "d" ? "l" : "d";
  let me = p[c], opp = p[o], hd = p.hd, hl = p.hl;
  if (f >= 0) me &= ~(1 << f); else if (c === "d") hd--; else hl--;
  me |= 1 << t;
  if (x >= 0) opp &= ~(1 << x);
  return `${c === "d" ? me : opp}.${c === "d" ? opp : me}${o}${hd}${hl}`;
};

/**
 * Looks at a position to a level's budget. Returns { scores: [{ code, score }] best first (scores for the side to
 * move; the first is exact, the others may be bounds on a level that only wants the best), depth reached, nodes }.
 * `seen` (position key → times it has stood in the game) lets a repetition be a draw, as the game will call it.
 */
export function look(p, { nodes = 1e9, depth = 40, full = false, tie = 0, seen = null } = {}) {
  const [me, opp, hMe, hOpp] = sidesOf(p), moves = gen(me, opp, hMe);
  if (!moves.length) return { scores: [], depth: 0, nodes: 0 };
  const cx = newContext(Infinity);
  let order = ordered(moves, me, opp, -1), scores = order.map(code => ({ code, score: 0 })), reached = 0;
  const drawn = code => seen && (seen.get(childKey(p, code)) || 0) >= 2;
  for (let d = 1; d <= depth; d++) {
    cx.limit = d === 1 ? Infinity : nodes;
    cx.aborted = false;
    const round = [];
    let best = -INF;
    for (const code of order) {
      let v;
      if (drawn(code)) v = 0;
      else {
        const { f, t, x } = decode(code);
        const nm = (f < 0 ? me : me & ~(1 << f)) | (1 << t), no = x >= 0 ? opp & ~(1 << x) : opp;
        const ext = x >= 0 ? 1 : 0;
        v = -negamax(cx, no, nm, hOpp, f < 0 ? hMe - 1 : hMe, d - 1 + ext, -INF, full ? INF : -(best - tie - 1), 1);
        if (cx.aborted) break;
      }
      round.push({ code, score: v });
      if (v > best) best = v;
    }
    if (cx.aborted) break;
    round.sort((a, b) => b.score - a.score);
    scores = round;
    order = round.map(r => r.code);
    reached = d;
    if (best > MATE - 400 || best < -MATE + 400) break;            // a forced end: no deeper search will change the move
    if (cx.nodes >= nodes) break;
  }
  return { scores, depth: reached, nodes: cx.nodes };
}

/** The move a level plays in a position (a move number), with its score: { code, score, depth, nodes }. */
export function think(p, level, { rng = Math.random, seen = null } = {}) {
  const L = levelOf(level), r = look(p, { nodes: L.nodes, depth: L.depth, full: L.noise > 0, tie: L.tie, seen });
  if (!r.scores.length) return { code: -1, score: 0, depth: 0, nodes: 0 };
  let pick = r.scores[0];
  if (L.noise > 0) {
    let top = -INF;
    for (const m of r.scores) { const v = m.score + (rng() - 0.5) * L.noise; if (v > top) { top = v; pick = m; } }
  } else if (L.tie > 0) {
    const near = r.scores.filter(m => m.score >= r.scores[0].score - L.tie);
    pick = near[Math.floor(rng() * near.length)];
  }
  return { code: pick.code, score: pick.score, depth: r.depth, nodes: r.nodes };
}
/** The coach's reading of a position: the best move and its score for the side to move. */
export function judge(p, { nodes = 60000, seen = null } = {}) {
  const r = look(p, { nodes, depth: 30, tie: 0, seen });
  return r.scores.length ? { code: r.scores[0].code, score: r.scores[0].score, depth: r.depth, nodes: r.nodes } : null;
}
export { keyOf, positionOfText, closes, N };
