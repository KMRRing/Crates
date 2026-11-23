// What one side of a game of L'Attaque knows, as Ataraxos's network reads it (attaque-net.js). The game is replayed from its
// armies' first squares in Ataraxos's own board (its CUDA engine, src/env/cuda/action_kernels.cu, ported move for move): every
// piece keeps which kinds of enemy piece it has threatened, run from, stood beside, guarded a square against, and been guarded
// against; the dead are kept with where and how they died; the hidden pieces are counted by kind. From that, for the side to move:
// 355 planes of 10 x 10 (src/env/cuda/infostate_kernels.cu), the last 32 moves (a -1 where a piece left, a +1 where it went), and
// each piece's number (the square it started on, as the side sees the board), all seen from the side's own end, lakes left out.
// Ataraxos's board: square row * 10 + column, Red's army on 0 to 39 (Red is its player 1, Blue player 2); ours is turned round
// (99 - square). Its kinds: Spy 0, Scout 1 … Marshal 9, Flag 10, Bomb 11, lake 12, empty 13, hidden 15.
import { CELLS, FEATURES } from "./attaque-net.js";

export const LAKES = [42, 43, 46, 47, 52, 53, 56, 57];
const LAKE = new Set(LAKES), CELL_OF = new Int16Array(100).fill(-1);
{ let k = 0; for (let d = 0; d < 100; d++) if (!LAKE.has(d)) CELL_OF[d] = k++; }
/** The 92 squares the network reads, by square, and back (-1 for a lake). */
export const cellOf = d => CELL_OF[d];
const T_FLAG = 10, T_BOMB = 11, T_LAKE = 12, T_EMPTY = 13, HIDDEN = 15, SPY = 0, MINER = 2, MARSHAL = 9;
const COUNTS = [1, 8, 5, 4, 4, 4, 3, 2, 1, 1, 1, 6];
const MAX_MOVES = 4000, MAX_QUIET = 200, HISTORY = 32;
/** Our kinds (Flag 0, Spy 1, Scout 2 … Marshal 10, Bomb 11) as Ataraxos's. */
export const kindToType = k => (k === 0 ? T_FLAG : k === 11 ? T_BOMB : k - 1);
const bit = t => 1 << t;
const empty = () => ({ type: T_EMPTY, color: 0, visible: 1, moved: 0, id: 0xff, thr: 0, eva: 0, adj: 0, pro: 0, proA: 0, wasBy: 0, wasA: 0 });
const lake = () => ({ ...empty(), type: T_LAKE, color: 3 });
const adjacent = (s, d) => (d === s + 1 && d % 10 !== 0) || (d === s - 1 && s % 10 !== 0) || d === s + 10 || d === s - 10;
const neighbours = d => [d >= 10 ? d - 10 : -1, d < 90 ? d + 10 : -1, d % 10 > 0 ? d - 1 : -1, d % 10 < 9 ? d + 1 : -1].filter(x => x >= 0);

/**
 * A game replayed in Ataraxos's board. kinds: our kind of each of the 80 pieces (Red's 0 to 39, Blue's 40 to 79); start: each
 * piece's square when play began, in our board. Then play(from, to) for each move, in our board, sides taking turns from Red.
 */
export function createSight(kinds, start) {
  const board = Array.from({ length: 100 }, (_, d) => (LAKE.has(d) ? lake() : empty()));
  const hidden = [COUNTS.slice(), COUNTS.slice()], unmoved = [40, 40];
  const deaths = [new Uint8Array(40), new Uint8Array(40)], status = [[], []];
  const history = [];
  let prevDst = 0xff, prevPrevDst = 0xff, lastType = 0xff, moves = 0, quiet = 0, toMove = 1;
  for (let id = 0; id < 80; id++) {
    const abs = 99 - start[id], color = id < 40 ? 1 : 2;
    board[abs] = { ...empty(), type: kindToType(kinds[id]), color, visible: 0, id: color === 1 ? abs : 99 - abs };
  }
  const zero = board.map(p => ({ ...p }));

  function protect(a, b, c, player) {
    const pr = board[a], pe = board[b], ag = board[c];
    if (ag.color !== 3 - player || !(pe.color === player || pe.color === 0) || pr.color !== player) return;
    const t = p => (p.visible ? p.type : HIDDEN);
    pr.pro |= bit(t(pe)); pr.proA |= bit(t(ag)); pe.wasBy |= bit(t(pr)); pe.wasA |= bit(t(ag));
  }
  /** Ataraxos's ApplyActionsKernel, for one move from `fa` to `ta` (its squares) by `player`. */
  function apply(fa, ta, player) {
    moves++; quiet++;
    // the pieces now beside the other side's last mover, and around this side's own last move's square
    if (lastType !== 0xff && prevDst !== 0xff) for (const n of neighbours(prevDst)) if (board[n].color === player) board[n].adj |= bit(lastType);
    if (prevPrevDst !== 0xff) {
      const pp = board[prevPrevDst];
      if (pp.color === player) { for (const n of neighbours(prevPrevDst)) { const p = board[n]; if (p.color === 3 - player) pp.adj |= bit(p.visible ? p.type : HIDDEN); } }
      else if (pp.color === 3 - player && pp.visible) for (const n of neighbours(prevPrevDst)) if (board[n].color === player) board[n].adj |= bit(pp.type);
    }
    const from = { ...board[fa] }, to = { ...board[ta] }, toWasVisible = to.visible;
    if (lastType !== 0xff && ta !== prevDst && adjacent(fa, prevDst)) from.eva |= bit(lastType);
    if (!from.moved && !from.visible) unmoved[player - 1]--;
    from.moved = 1;
    if (to.color) {                                                      // an attack: both are shown
      quiet = 0;
      if (!from.visible) { hidden[player - 1][from.type]--; from.visible = 1; }
      if (!to.visible) { hidden[to.color - 1][to.type]--; to.visible = 1; if (!to.moved) unmoved[to.color - 1]--; }
    }
    const steps = Math.abs(Math.floor(ta / 10) - Math.floor(fa / 10)) + Math.abs((ta % 10) - (fa % 10));
    if (steps >= 2 && !from.visible) { hidden[player - 1][from.type]--; from.visible = 1; }
    board[fa] = empty();
    const toWins = (to.type < T_FLAG && to.type > from.type && !(to.type === MARSHAL && from.type === SPY)) || (to.type === T_BOMB && from.type !== MINER);
    const tie = to.type === from.type;
    const die = (p, reason) => { deaths[p.color - 1][p.id] = 1; status[p.color - 1][p.id] = { reason, type: p.type, loc: ta }; };
    if (toWins) { die(from, toWasVisible ? 0 : 2); board[ta] = to; }
    else if (tie) { die(from, toWasVisible ? 1 : 2); die(to, toWasVisible ? 4 : 5); board[ta] = empty(); }
    else {
      if (to.type !== T_EMPTY) die(to, toWasVisible ? 3 : 5);
      else for (const n of neighbours(ta)) { const p = board[n]; if (p.color === 3 - player) from.thr |= bit(p.visible ? p.type : HIDDEN); }
      board[ta] = from;
    }
    const P = (a, b, c) => protect(a, b, c, player), d = prevDst, t = ta, f = fa;
    // the four patterns of a guard: a protector two away from an aggressor, the protectee between; or diagonal
    const around = (x, fn) => {
      const r = Math.floor(x / 10), c = x % 10;
      if (r >= 2) fn(-20, -10); if (r < 8) fn(20, 10); if (c >= 2) fn(-2, -1); if (c < 8) fn(2, 1);
      if (r < 9 && c >= 1) { fn(9, -1); fn(9, 10); }
      if (r < 9 && c < 9) { fn(11, 1); fn(11, 10); }
      if (r > 0 && c >= 1) { fn(-11, -1); fn(-11, -10); }
      if (r > 0 && c < 9) { fn(-9, 1); fn(-9, -10); }
    };
    const between = (x, fn) => {
      const r = Math.floor(x / 10), c = x % 10;
      if (r < 9 && r > 0) { fn(10, -10); fn(-10, 10); }
      if (r < 9 && c > 0) { fn(10, -1); fn(-1, 10); }
      if (r < 9 && c < 9) { fn(10, 1); fn(1, 10); }
      if (r > 0 && c > 0) { fn(-10, -1); fn(-1, -10); }
      if (r > 0 && c < 9) { fn(-10, 1); fn(1, -10); }
      if (c < 9 && c > 0) { fn(-1, 1); fn(1, -1); }
    };
    if (lastType !== 0xff) around(d, (far, mid) => P(d + far, d + mid, d));              // the other side's last mover, the aggressor
    if (!(toWins || tie)) around(t, (far, mid) => P(t, t + mid, t + far));               // this piece guards: the protectee beside it
    if (!toWins) between(t, (a, b) => P(t + a, t, t + b));                               // this piece (or the square a tie emptied) guarded
    if (toWins) around(t, (far, mid) => P(t + far, t + mid, t));                         // a defender just shown, the aggressor
    between(f, (a, b) => P(f + a, f, f + b));                                            // the square it left, guarded
    lastType = toWins || tie ? 0xff : from.visible ? from.type : HIDDEN;
    prevPrevDst = prevDst; prevDst = ta;
    history.push([fa, ta]);
  }

  /** The 92 x 643 numbers for the side to move (player 1 Red, 2 Blue): the network's input. */
  function features() {
    const P = toMove, O = 3 - P, out = new Float32Array(CELLS * FEATURES);
    const pov = d => (P === 1 ? d : 99 - d);
    const set = (ch, d, v = 1) => { const k = CELL_OF[pov(d)]; if (k >= 0) out[k * FEATURES + ch] = v; };
    const probs = (forPlayer, d, base) => {
      const p = board[d], nh = hidden[2 - forPlayer], nu = unmoved[2 - forPlayer];
      if (p.type >= T_LAKE || p.color === forPlayer) return;
      if (p.visible) { set(base + p.type, d); return; }
      const total = nh.reduce((a, b) => a + b, 0), denom = total - nh[T_FLAG] - nh[T_BOMB];
      if (p.moved) { for (let k = 0; k < 10; k++) set(base + k, d, nh[k] / denom); return; }
      if (total !== nh[T_FLAG] + nh[T_BOMB]) { const norm = (nu - nh[T_FLAG] - nh[T_BOMB]) / (nu * denom); for (let k = 0; k < 10; k++) set(base + k, d, nh[k] * norm); }
      set(base + T_FLAG, d, nh[T_FLAG] / nu); set(base + T_BOMB, d, nh[T_BOMB] / nu);
    };
    const KINDS11 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, HIDDEN], KINDS13 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, T_BOMB, T_EMPTY, HIDDEN];
    for (let d = 0; d < 100; d++) {
      const p = board[d];
      if (p.type < T_LAKE && p.color === P) set(p.type, d);
      probs(P, d, 12);
      probs(O, d, 24);
      set(36, d, !p.visible && p.color === P ? 1 : 0); set(37, d, !p.visible && p.color !== P ? 1 : 0); set(38, d, p.type === T_EMPTY ? 1 : 0);
      set(39, d, p.moved && p.color === P ? 1 : 0); set(40, d, p.moved && p.color !== P ? 1 : 0);
      set(41, d, moves / MAX_MOVES); set(42, d, quiet / MAX_QUIET);
      KINDS11.forEach((t, i) => {
        const ours = p.color === P && !p.visible, theirs = p.color === O && !p.visible;
        if (ours) { set(43 + i, d, p.thr & bit(t) ? 1 : 0); set(54 + i, d, p.eva & bit(t) ? 1 : 0); set(65 + i, d, p.adj & bit(t) ? 1 : 0); }
        if (theirs) { set(76 + i, d, p.thr & bit(t) ? 1 : 0); set(87 + i, d, p.eva & bit(t) ? 1 : 0); set(98 + i, d, p.adj & bit(t) ? 1 : 0); }
      });
      KINDS13.forEach((t, i) => {
        const ours = p.color === P && !p.visible, theirs = p.color === O && !p.visible;
        if (ours) { set(251 + i, d, p.pro & bit(t) ? 1 : 0); set(264 + i, d, p.proA & bit(t) ? 1 : 0); set(277 + i, d, p.wasBy & bit(t) ? 1 : 0); set(290 + i, d, p.wasA & bit(t) ? 1 : 0); }
        if (theirs) { set(303 + i, d, p.pro & bit(t) ? 1 : 0); set(316 + i, d, p.proA & bit(t) ? 1 : 0); set(329 + i, d, p.wasBy & bit(t) ? 1 : 0); set(342 + i, d, p.wasA & bit(t) ? 1 : 0); }
      });
    }
    // the dead, on the squares they started on, by kind; and where and how each died
    const DEAD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, T_BOMB];
    for (let d = 0; d < 100; d++) {
      if (d >= 40 && d < 60) continue;
      const z = zero[d], rel = d < 40 ? d : 99 - d, dead = deaths[d >= 60 ? 1 : 0][rel];
      if (!dead || z.color === 0) continue;
      DEAD.forEach((t, i) => { if (z.type === t) set((z.color === P ? 109 : 120) + i, d); });
    }
    for (const [who, base] of [[P, 131], [O, 191]]) for (const s of status[who - 1]) if (s && s.type < 10) set(base + s.reason * 10 + s.type, s.loc);
    // the last moves, oldest first, the latest last
    for (let delta = 1; delta <= Math.min(HISTORY, history.length); delta++) {
      const [fa, ta] = history[history.length - delta], ch = 355 + HISTORY - delta;
      set(ch, fa, -1); set(ch, ta, 1);
    }
    // each piece's number: ours the square it started on as we see the board, theirs 99 less that
    for (let d = 0; d < 100; d++) {
      const p = board[d], id = p.color === P ? p.id : p.color === O ? 99 - p.id : 255;
      set(355 + HISTORY + id, d);
    }
    return out;
  }

  return {
    /** A move in our board (squares 0 to 99, Blue's back row first). */
    play(f, t) { apply(99 - f, 99 - t, toMove); toMove = 3 - toMove; },
    features,
    /** A move of ours as the network's (from, to) cells for the side to move. */
    cells(f, t) { const pov = d => (toMove === 1 ? 99 - d : d); return [CELL_OF[pov(f)], CELL_OF[pov(t)]]; },
    get toMove() { return toMove; },
    get moves() { return moves; },
    /** For tests: the replayed board, the hidden counts and the deaths. */
    peek: () => ({ board, hidden, unmoved, deaths, status, prevDst, prevPrevDst, lastType }),
  };
}
