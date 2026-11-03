// Pipes, the puzzle: the solver that proves a level has its answer (and how many). It runs the oil from the wellhead and,
// at every empty square, tries each piece of the hand that takes the oil in, so every route it finds uses the hand
// exactly, passes all the old pipe and the stakes in order, and ends in the terminal's inlet. Used by the generator
// (pipes-puzzle-make.js) and tests/pipes-puzzle.mjs; no page loads it, the levels carry their answers.
import { KINDS, SIDE, beyond, back, channelOf, isCrossing, xy, layerOf } from "./pipes-puzzle.js";

/**
 * Every route that solves the level L, up to `cap` of them: { routes: ["EESSW…"], nodes, capped }, a route being the
 * side the oil leaves each square by (layRoute turns it into the pieces). `capped` is true when it stopped at the cap,
 * or at `limit` squares tried (then `aborted` too: the count is only a lower bound). `order(kinds)` puts the pieces to try
 * at a square in another order (a player who tries them as they come to mind: the harness measures how long that takes).
 */
export function solve(L, cap = 2, limit = 4e6, order = null) {
  const n = L.size, kinds = KINDS.filter(k => L.hand[k]), hand = { ...L.hand };
  const filled = new Uint8Array(n), placed = Array(n).fill(null), dirs = [], routes = [];
  const t = beyond(L, L.terminal.c, L.terminal.d);
  const [tx, ty] = xy(L, t), tz = layerOf(L, t);
  const dist = Array.from({ length: n }, (_, c) => { const [x, y] = xy(L, c); return Math.abs(x - tx) + Math.abs(y - ty) + Math.abs(layerOf(L, c) - tz); });
  // a crossing can be passed twice: the passes left to make are the pieces left, the old pipe left, and one more for each crossing
  const doubles = Object.entries(L.hand).reduce((m, [k, v]) => m + (isCrossing(k) ? v : 0), 0) + L.cells.filter(f => f?.k === "old" && isCrossing(f.piece)).length;
  let nodes = 0, left = L.total, oldsLeft = L.olds, nextStake = 1, aborted = false;

  function go(c, a) {
    if (aborted || routes.length >= cap) return;
    if (++nodes > limit) { aborted = true; return; }
    const f = L.cells[c];
    if (f) {
      if (f.k === "terminal") { if (f.d === a && !left && !oldsLeft && nextStake === L.stakes.length + 1) routes.push(dirs.join("")); return; }
      if (f.k !== "old") return;
    }
    if (dist[c] + 1 > left + oldsLeft + doubles) return;
    const stake = L.stakeAt[c], first = !filled[c];
    if (stake && first && stake !== nextStake) return;
    const step = (piece, ch, isOld) => {
      filled[c] |= 1 << ch.i;
      dirs.push(SIDE[ch.out]);
      if (stake && first) nextStake++;
      if (isOld && first) oldsLeft--;
      const next = beyond(L, c, ch.out);
      if (next >= 0) go(next, back(ch.out));
      if (isOld && first) oldsLeft++;
      if (stake && first) nextStake--;
      dirs.pop();
      filled[c] &= ~(1 << ch.i);
    };
    if (f) { const ch = channelOf(f.piece, a); if (ch && !(filled[c] & (1 << ch.i))) step(f.piece, ch, true); return; }
    if (placed[c]) {                                           // a crossing laid on the way in, passed the other way
      if (!isCrossing(placed[c])) return;
      const ch = channelOf(placed[c], a);
      if (ch && !(filled[c] & (1 << ch.i))) step(placed[c], ch, false);
      return;
    }
    for (const k of order ? order(kinds) : kinds) {
      if (!hand[k]) continue;
      const ch = channelOf(k, a);
      if (!ch) continue;
      hand[k]--; left--; placed[c] = k;
      step(k, ch, false);
      hand[k]++; left++; placed[c] = null;
    }
  }
  const first = beyond(L, L.source.c, L.source.d);
  if (first >= 0) go(first, back(L.source.d));
  return { routes, nodes, capped: routes.length >= cap || aborted, aborted };
}
